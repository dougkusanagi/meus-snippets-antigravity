use crate::macro_engine;
use crate::snippet_store::{MacroAction, SnippetStore};
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub fn get_snippets(store: State<'_, SnippetStore>) -> Vec<serde_json::Value> {
    let snippets = store.get_all();
    snippets
        .into_iter()
        .map(|s| serde_json::to_value(s).unwrap())
        .collect()
}

#[tauri::command]
pub fn add_snippet(
    trigger: String,
    name: String,
    actions: Vec<MacroAction>,
    store: State<'_, SnippetStore>,
) -> serde_json::Value {
    let snippet = store.add(trigger, name, actions);
    serde_json::to_value(snippet).unwrap()
}

#[tauri::command]
pub fn update_snippet(
    id: String,
    trigger: String,
    name: String,
    actions: Vec<MacroAction>,
    store: State<'_, SnippetStore>,
) -> Result<serde_json::Value, String> {
    match store.update(&id, trigger, name, actions) {
        Some(snippet) => Ok(serde_json::to_value(snippet).unwrap()),
        None => Err(format!("Snippet not found: {}", id)),
    }
}

#[tauri::command]
pub fn delete_snippet(id: String, store: State<'_, SnippetStore>) -> bool {
    store.delete(&id)
}

#[tauri::command]
pub fn execute_macro(
    id: String,
    delete_trigger: bool,
    app: AppHandle,
    store: State<'_, SnippetStore>,
) -> Result<(), String> {
    let snippet = store
        .get_by_id(&id)
        .ok_or_else(|| format!("Snippet not found: {}", id))?;

    if delete_trigger {
        // Delete the trigger text first (trigger length + the hotkey doesn't type anything,
        // but the trigger was typed by the user)
        let trigger_len = snippet.trigger.len();
        macro_engine::delete_trigger(trigger_len)?;

        // Small delay to let the deletions register
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    // Execute the macro actions
    macro_engine::execute(&snippet.actions, &app)?;

    Ok(())
}

#[tauri::command]
pub fn hide_picker(app: AppHandle) {
    if let Some(window) = app.get_webview_window("picker") {
        window.hide().unwrap_or_default();
    }
}

#[tauri::command]
pub fn show_manager(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.show().unwrap_or_default();
        window.set_focus().unwrap_or_default();
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: String,
    pub session_type: String,
    pub desktop: String,
    pub needs_permission: bool,
    pub permission_type: String,
}

#[tauri::command]
pub fn get_platform_info() -> Result<PlatformInfo, String> {
    let os = std::env::consts::OS.to_string();
    
    #[cfg(target_os = "linux")]
    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
    #[cfg(not(target_os = "linux"))]
    let session_type = String::new();

    #[cfg(target_os = "linux")]
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();
    #[cfg(not(target_os = "linux"))]
    let desktop = String::new();

    let mut needs_permission = false;
    let mut permission_type = String::new();

    #[cfg(target_os = "linux")]
    {
        // Under Linux, Wayland session requires system keyboard shortcuts and Remote Control
        if session_type.to_lowercase() == "wayland" {
            needs_permission = true;
            permission_type = "linux-wayland".to_string();
        }
    }

    #[cfg(target_os = "macos")]
    {
        needs_permission = true;
        permission_type = "macos-accessibility".to_string();
    }

    Ok(PlatformInfo {
        os,
        session_type,
        desktop,
        needs_permission,
        permission_type,
    })
}

#[cfg(target_os = "linux")]
fn register_gnome_shortcut() -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current exe path: {}", e))?;
    let exe_str = current_exe.to_string_lossy().to_string();
    let command_to_run = format!("{} --toggle", exe_str);

    // 1. Set name
    let status = std::process::Command::new("gsettings")
        .args(&[
            "set",
            "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/guepardosys-snip/",
            "name",
            "Guepardosys Snippet Search"
        ])
        .status()
        .map_err(|e| format!("Failed to run gsettings set name: {}", e))?;
        
    if !status.success() {
        return Err("gsettings set name returned non-zero status".to_string());
    }

    // 2. Set command
    let status = std::process::Command::new("gsettings")
        .args(&[
            "set",
            "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/guepardosys-snip/",
            "command",
            &command_to_run
        ])
        .status()
        .map_err(|e| format!("Failed to run gsettings set command: {}", e))?;

    if !status.success() {
        return Err("gsettings set command returned non-zero status".to_string());
    }

    // 3. Set binding
    let status = std::process::Command::new("gsettings")
        .args(&[
            "set",
            "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/guepardosys-snip/",
            "binding",
            "<Control>semicolon"
        ])
        .status()
        .map_err(|e| format!("Failed to run gsettings set binding: {}", e))?;

    if !status.success() {
        return Err("gsettings set binding returned non-zero status".to_string());
    }

    // 4. Append to custom-keybindings list
    let output = std::process::Command::new("gsettings")
        .args(&["get", "org.gnome.settings-daemon.plugins.media-keys", "custom-keybindings"])
        .output()
        .map_err(|e| format!("Failed to get custom-keybindings: {}", e))?;

    let out_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let mut paths = Vec::new();
    
    if out_str != "@as []" && !out_str.is_empty() {
        let cleaned = out_str.replace('[', "").replace(']', "");
        for part in cleaned.split(',') {
            let part_trimmed = part.trim();
            if !part_trimmed.is_empty() {
                paths.push(part_trimmed.to_string());
            }
        }
    }

    let new_path = "'/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/guepardosys-snip/'".to_string();
    if !paths.contains(&new_path) {
        paths.push(new_path);
    }

    let formatted_list = format!("[{}]", paths.join(", "));
    
    let status = std::process::Command::new("gsettings")
        .args(&[
            "set",
            "org.gnome.settings-daemon.plugins.media-keys",
            "custom-keybindings",
            &formatted_list,
        ])
        .status()
        .map_err(|e| format!("Failed to update custom-keybindings array: {}", e))?;

    if !status.success() {
        return Err("gsettings set custom-keybindings returned non-zero status".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn open_system_settings() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default().to_lowercase();
        if desktop.contains("gnome") || desktop.contains("ubuntu") {
            match register_gnome_shortcut() {
                Ok(_) => return Ok("registered".to_string()),
                Err(e) => {
                    eprintln!("Failed to register GNOME shortcut: {}", e);
                }
            }
        }

        let _ = std::process::Command::new("gnome-control-center")
            .arg("keyboard")
            .spawn()
            .or_else(|_| {
                std::process::Command::new("gnome-control-center").spawn()
            })
            .or_else(|_| {
                std::process::Command::new("systemsettings").spawn()
            });
            
        Ok("opened".to_string())
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn()
            .or_else(|_| {
                std::process::Command::new("open")
                    .arg("/System/Library/PreferencePanes/Security.prefPane")
                    .spawn()
            });
        Ok("opened".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(&["/C", "start ms-settings:privacy-accessibility"])
            .spawn();
        Ok("opened".to_string())
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, Modifiers, Code};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn get_shortcut_from_file(app: &AppHandle) -> String {
    let default_shortcut = if cfg!(target_os = "macos") {
        "Command+;".to_string()
    } else {
        "Ctrl+;".to_string()
    };
    
    let path = match app.path().app_data_dir() {
        Ok(dir) => dir.join("settings.json"),
        Err(_) => return default_shortcut,
    };
    
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(shortcut) = val.get("shortcut").and_then(|v| v.as_str()) {
                    return shortcut.to_string();
                }
            }
        }
    }
    default_shortcut
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn save_shortcut_to_file(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("settings.json");
    let val = serde_json::json!({
        "shortcut": shortcut
    });
    let content = serde_json::to_string_pretty(&val).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn parse_shortcut(s: &str) -> Result<Shortcut, String> {
    let parts: Vec<&str> = s.split('+').collect();
    if parts.is_empty() {
        return Err("Shortcut string is empty".to_string());
    }
    
    let mut modifiers = Modifiers::empty();
    let mut code_str = "";
    
    for (i, part) in parts.iter().enumerate() {
        let part_trimmed = part.trim();
        let part_lower = part_trimmed.to_lowercase();
        if i == parts.len() - 1 {
            code_str = part_trimmed;
        } else {
            match part_lower.as_str() {
                "ctrl" | "control" => modifiers.insert(Modifiers::CONTROL),
                "alt" => modifiers.insert(Modifiers::ALT),
                "shift" => modifiers.insert(Modifiers::SHIFT),
                "super" | "win" | "meta" => modifiers.insert(Modifiers::SUPER),
                "command" | "cmd" => {
                    modifiers.insert(Modifiers::SUPER);
                }
                "commandorcontrol" | "cmdorctrl" => {
                    #[cfg(target_os = "macos")]
                    modifiers.insert(Modifiers::SUPER);
                    #[cfg(not(target_os = "macos"))]
                    modifiers.insert(Modifiers::CONTROL);
                }
                _ => return Err(format!("Unknown modifier: {}", part_trimmed)),
            }
        }
    }
    
    if code_str.is_empty() {
        return Err("Missing key code in shortcut".to_string());
    }
    
    let code = match_key_code(code_str)?;
    
    Ok(Shortcut::new(Some(modifiers), code))
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn match_key_code(s: &str) -> Result<Code, String> {
    let s_upper = s.to_uppercase();
    match s_upper.as_str() {
        "A" => Ok(Code::KeyA),
        "B" => Ok(Code::KeyB),
        "C" => Ok(Code::KeyC),
        "D" => Ok(Code::KeyD),
        "E" => Ok(Code::KeyE),
        "F" => Ok(Code::KeyF),
        "G" => Ok(Code::KeyG),
        "H" => Ok(Code::KeyH),
        "I" => Ok(Code::KeyI),
        "J" => Ok(Code::KeyJ),
        "K" => Ok(Code::KeyK),
        "L" => Ok(Code::KeyL),
        "M" => Ok(Code::KeyM),
        "N" => Ok(Code::KeyN),
        "O" => Ok(Code::KeyO),
        "P" => Ok(Code::KeyP),
        "Q" => Ok(Code::KeyQ),
        "R" => Ok(Code::KeyR),
        "S" => Ok(Code::KeyS),
        "T" => Ok(Code::KeyT),
        "U" => Ok(Code::KeyU),
        "V" => Ok(Code::KeyV),
        "W" => Ok(Code::KeyW),
        "X" => Ok(Code::KeyX),
        "Y" => Ok(Code::KeyY),
        "Z" => Ok(Code::KeyZ),
        
        "0" => Ok(Code::Digit0),
        "1" => Ok(Code::Digit1),
        "2" => Ok(Code::Digit2),
        "3" => Ok(Code::Digit3),
        "4" => Ok(Code::Digit4),
        "5" => Ok(Code::Digit5),
        "6" => Ok(Code::Digit6),
        "7" => Ok(Code::Digit7),
        "8" => Ok(Code::Digit8),
        "9" => Ok(Code::Digit9),
        
        "SPACE" => Ok(Code::Space),
        "ENTER" | "RETURN" => Ok(Code::Enter),
        "ESCAPE" | "ESC" => Ok(Code::Escape),
        "TAB" => Ok(Code::Tab),
        "BACKSPACE" => Ok(Code::Backspace),
        "DELETE" | "DEL" => Ok(Code::Delete),
        "INSERT" | "INS" => Ok(Code::Insert),
        "HOME" => Ok(Code::Home),
        "END" => Ok(Code::End),
        "PAGEUP" | "PGUP" => Ok(Code::PageUp),
        "PAGEDOWN" | "PGDN" => Ok(Code::PageDown),
        
        "UP" | "ARROWUP" => Ok(Code::ArrowUp),
        "DOWN" | "ARROWDOWN" => Ok(Code::ArrowDown),
        "LEFT" | "ARROWLEFT" => Ok(Code::ArrowLeft),
        "RIGHT" | "ARROWRIGHT" => Ok(Code::ArrowRight),
        
        "F1" => Ok(Code::F1),
        "F2" => Ok(Code::F2),
        "F3" => Ok(Code::F3),
        "F4" => Ok(Code::F4),
        "F5" => Ok(Code::F5),
        "F6" => Ok(Code::F6),
        "F7" => Ok(Code::F7),
        "F8" => Ok(Code::F8),
        "F9" => Ok(Code::F9),
        "F10" => Ok(Code::F10),
        "F11" => Ok(Code::F11),
        "F12" => Ok(Code::F12),
        
        ";" | "SEMICOLON" => Ok(Code::Semicolon),
        "," | "COMMA" => Ok(Code::Comma),
        "." | "PERIOD" => Ok(Code::Period),
        "/" | "SLASH" => Ok(Code::Slash),
        "=" | "EQUAL" => Ok(Code::Equal),
        "-" | "MINUS" => Ok(Code::Minus),
        "[" | "BRACKETLEFT" => Ok(Code::BracketLeft),
        "]" | "BRACKETRIGHT" => Ok(Code::BracketRight),
        "'" | "QUOTE" => Ok(Code::Quote),
        "`" | "BACKQUOTE" => Ok(Code::Backquote),
        "\\" | "BACKSLASH" => Ok(Code::Backslash),
        
        _ => Err(format!("Unsupported key code: {}", s)),
    }
}

#[tauri::command]
pub fn get_shortcut(app: AppHandle) -> String {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        get_shortcut_from_file(&app)
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        "Ctrl+;".to_string()
    }
}

#[tauri::command]
pub fn set_shortcut(app: AppHandle, shortcut: String) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let new_shortcut = parse_shortcut(&shortcut)?;
        
        let old_shortcut_str = get_shortcut_from_file(&app);
        if let Ok(old_shortcut) = parse_shortcut(&old_shortcut_str) {
            let _ = app.global_shortcut().unregister(old_shortcut);
        }
        
        save_shortcut_to_file(&app, &shortcut)?;
        
        app.global_shortcut()
            .register(new_shortcut)
            .map_err(|e| format!("Failed to register shortcut with OS: {}", e))?;
            
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Global shortcuts not supported on this platform".to_string())
    }
}

