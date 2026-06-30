use crate::macro_engine;
use crate::snippet_store::{
    Category, CategoryIcon, CategorySortMode, LibrarySnapshot, MacroAction, Snippet, SnippetInput,
    SnippetStore, SnippetView,
};
use std::collections::{BTreeSet, HashMap};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn get_snippets(store: State<'_, SnippetStore>) -> Result<Vec<SnippetView>, String> {
    store.get_picker_snippets()
}

#[tauri::command]
pub fn get_library_snapshot(store: State<'_, SnippetStore>) -> Result<LibrarySnapshot, String> {
    store.get_snapshot()
}

#[tauri::command]
pub fn add_snippet(
    trigger: String,
    name: String,
    category_id: Option<String>,
    tags: Vec<String>,
    favorite: bool,
    actions: Vec<MacroAction>,
    store: State<'_, SnippetStore>,
) -> Result<Snippet, String> {
    store.add(SnippetInput {
        trigger,
        name,
        category_id,
        tags,
        favorite,
        actions,
    })
}

#[tauri::command]
pub fn update_snippet(
    id: String,
    trigger: String,
    name: String,
    category_id: Option<String>,
    tags: Vec<String>,
    favorite: bool,
    actions: Vec<MacroAction>,
    store: State<'_, SnippetStore>,
) -> Result<Snippet, String> {
    store.update(
        &id,
        SnippetInput {
            trigger,
            name,
            category_id,
            tags,
            favorite,
            actions,
        },
    )
}

#[tauri::command]
pub fn delete_snippet(id: String, store: State<'_, SnippetStore>) -> Result<bool, String> {
    store.delete(&id)
}

#[tauri::command]
pub fn execute_macro(
    id: String,
    delete_trigger: bool,
    variables: HashMap<String, String>,
    app: AppHandle,
    store: State<'_, SnippetStore>,
) -> Result<(), String> {
    let snippet = store
        .get_by_id(&id)?
        .ok_or_else(|| format!("Snippet not found: {}", id))?;

    if delete_trigger {
        let trigger_len = snippet.trigger.chars().count();
        macro_engine::delete_trigger(trigger_len)?;
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    macro_engine::execute(&snippet.actions, &app, &variables)?;
    store.record_usage(&id)?;
    Ok(())
}

#[tauri::command]
pub fn duplicate_snippet(id: String, store: State<'_, SnippetStore>) -> Result<Snippet, String> {
    store.duplicate(&id)
}

#[tauri::command]
pub fn set_snippet_favorite(
    id: String,
    favorite: bool,
    store: State<'_, SnippetStore>,
) -> Result<Snippet, String> {
    store.set_favorite(&id, favorite)
}

#[tauri::command]
pub fn export_snippets(store: State<'_, SnippetStore>) -> Result<String, String> {
    store.export_json()
}

#[tauri::command]
pub fn import_snippets(
    content: String,
    replace: bool,
    store: State<'_, SnippetStore>,
) -> Result<usize, String> {
    store.import_json(&content, replace)
}

#[tauri::command]
pub fn create_category(
    name: String,
    parent_id: Option<String>,
    icon: Option<CategoryIcon>,
    store: State<'_, SnippetStore>,
) -> Result<Category, String> {
    store.create_category(name, parent_id, icon)
}

#[tauri::command]
pub fn update_category(
    id: String,
    name: String,
    parent_id: Option<String>,
    icon: Option<CategoryIcon>,
    store: State<'_, SnippetStore>,
) -> Result<Category, String> {
    store.update_category(&id, name, parent_id, icon)
}

#[tauri::command]
pub fn delete_category(id: String, store: State<'_, SnippetStore>) -> Result<bool, String> {
    store.delete_category(&id)
}

#[tauri::command]
pub fn reorder_categories(
    parent_id: Option<String>,
    ordered_ids: Vec<String>,
    store: State<'_, SnippetStore>,
) -> Result<Vec<Category>, String> {
    store.reorder_categories(parent_id, ordered_ids)
}

#[tauri::command]
pub fn set_category_sort_mode(
    parent_id: Option<String>,
    sort_mode: CategorySortMode,
    store: State<'_, SnippetStore>,
) -> Result<(), String> {
    store.set_category_sort_mode(parent_id, sort_mode)
}

#[tauri::command]
pub fn export_backup_to_file(path: String, store: State<'_, SnippetStore>) -> Result<(), String> {
    store.export_to_file(PathBuf::from(path).as_path())
}

#[tauri::command]
pub fn import_backup_from_file(
    path: String,
    replace: bool,
    store: State<'_, SnippetStore>,
) -> Result<usize, String> {
    store.import_from_file(PathBuf::from(path).as_path(), replace)
}

#[tauri::command]
pub fn import_textexpander_csv_from_file(
    path: String,
    replace: bool,
    store: State<'_, SnippetStore>,
) -> Result<usize, String> {
    store.import_textexpander_csv_from_file(PathBuf::from(path).as_path(), replace)
}

#[tauri::command]
pub fn choose_backup_export_path(
    app: AppHandle,
    suggested_name: String,
) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name(suggested_name)
        .set_title("Exportar backup")
        .blocking_save_file();

    Ok(file_path
        .and_then(|path| path.into_path().ok())
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn choose_backup_import_path(app: AppHandle) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_title("Importar backup")
        .blocking_pick_file();

    Ok(file_path
        .and_then(|path| path.into_path().ok())
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn choose_textexpander_import_path(app: AppHandle) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("CSV", &["csv"])
        .set_title("Importar snippets do TextExpander")
        .blocking_pick_file();

    Ok(file_path
        .and_then(|path| path.into_path().ok())
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn get_snippet_variables(
    id: String,
    store: State<'_, SnippetStore>,
) -> Result<Vec<String>, String> {
    let snippet = store
        .get_by_id(&id)?
        .ok_or_else(|| format!("Snippet not found: {id}"))?;
    let builtins = ["date", "time", "datetime", "clipboard", "uuid", "cursor"];
    let mut variables = BTreeSet::new();

    for action in snippet.actions {
        if let MacroAction::Text { value } = action {
            let mut remaining = value.as_str();
            while let Some(start) = remaining.find("{{") {
                let after_start = &remaining[start + 2..];
                let Some(end) = after_start.find("}}") else {
                    break;
                };
                let name = after_start[..end].trim();
                if !name.is_empty()
                    && !builtins.contains(&name)
                    && name.chars().all(|character| {
                        character.is_alphanumeric() || character == '_' || character == '-'
                    })
                {
                    variables.insert(name.to_string());
                }
                remaining = &after_start[end + 2..];
            }
        }
    }

    Ok(variables.into_iter().collect())
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
    pub uinput_active: bool,
}

#[cfg(target_os = "linux")]
fn is_uinput_accessible() -> bool {
    std::fs::OpenOptions::new()
        .write(true)
        .open("/dev/uinput")
        .is_ok()
}

#[cfg(target_os = "linux")]
pub fn is_gnome_shortcut_registered() -> bool {
    let desktop = std::env::var("XDG_CURRENT_DESKTOP")
        .unwrap_or_default()
        .to_lowercase();
    if !desktop.contains("gnome") && !desktop.contains("ubuntu") {
        return false;
    }

    let output = match std::process::Command::new("gsettings")
        .args(&[
            "get",
            "org.gnome.settings-daemon.plugins.media-keys",
            "custom-keybindings",
        ])
        .output()
    {
        Ok(out) => out,
        Err(_) => return false,
    };

    let out_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let path =
        "'/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/guepardosys-snip/'";
    if !out_str.contains(path) {
        return false;
    }

    let path_without_quotes =
        "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/guepardosys-snip/";
    let binding_output = match std::process::Command::new("gsettings")
        .args(&[
            "get",
            &format!(
                "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:{}",
                path_without_quotes
            ),
            "binding",
        ])
        .output()
    {
        Ok(out) => out,
        Err(_) => return false,
    };
    let binding_str = String::from_utf8_lossy(&binding_output.stdout)
        .trim()
        .to_string();

    if binding_str.is_empty() || binding_str == "''" || binding_str == "@as []" {
        return false;
    }

    true
}

#[tauri::command]
#[allow(unused_mut)]
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
    let uinput_active = is_uinput_accessible();
    #[cfg(not(target_os = "linux"))]
    let uinput_active = false;

    #[cfg(target_os = "linux")]
    {
        // Under Linux, Wayland session requires system keyboard shortcuts and Remote Control
        if session_type.to_lowercase() == "wayland" {
            // Always set permission type so the wizard can show remote interaction info
            permission_type = "linux-wayland".to_string();
            if !is_gnome_shortcut_registered() {
                needs_permission = true;
            }
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
        uinput_active,
    })
}

#[cfg(target_os = "linux")]
fn to_gnome_binding(shortcut_str: &str) -> String {
    let parts: Vec<&str> = shortcut_str.split('+').collect();
    let mut gnome_parts = Vec::new();

    for (i, part) in parts.iter().enumerate() {
        let part_lower = part.trim().to_lowercase();
        if i == parts.len() - 1 {
            // Key
            let key_sym = match part_lower.as_str() {
                ";" | "semicolon" => "semicolon",
                "," | "comma" => "comma",
                "." | "period" => "period",
                "/" | "slash" => "slash",
                "=" | "equal" => "equal",
                "-" | "minus" => "minus",
                "[" | "bracketleft" => "bracketleft",
                "]" | "bracketright" => "bracketright",
                "'" | "quote" | "apostrophe" => "apostrophe",
                "`" | "backquote" | "grave" => "grave",
                "\\" | "backslash" => "backslash",
                "space" => "space",
                "enter" | "return" => "Return",
                "escape" | "esc" => "Escape",
                "tab" => "Tab",
                "backspace" => "BackSpace",
                "delete" | "del" => "Delete",
                "insert" | "ins" => "Insert",
                "home" => "Home",
                "end" => "End",
                "pageup" | "pgup" => "Page_Up",
                "pagedown" | "pgdn" => "Page_Down",
                "up" | "arrowup" => "Up",
                "down" | "arrowdown" => "Down",
                "left" | "arrowleft" => "Left",
                "right" | "arrowright" => "Right",
                other => other,
            };
            gnome_parts.push(key_sym.to_string());
        } else {
            // Modifier
            let mod_str = match part_lower.as_str() {
                "ctrl" | "control" => "<Control>",
                "alt" => "<Alt>",
                "shift" => "<Shift>",
                "super" | "win" | "meta" | "command" | "cmd" => "<Super>",
                _ => "",
            };
            if !mod_str.is_empty() {
                gnome_parts.push(mod_str.to_string());
            }
        }
    }
    gnome_parts.join("")
}

#[cfg(target_os = "linux")]
pub fn register_gnome_shortcut(app: &AppHandle) -> Result<(), String> {
    let current_exe =
        std::env::current_exe().map_err(|e| format!("Failed to get current exe path: {}", e))?;
    let exe_str = current_exe.to_string_lossy().to_string();
    let command_to_run = format!("{} --toggle", exe_str);

    // Get current user display shortcut
    let (_, display_shortcut, _) = get_shortcut_from_file(app);
    let gnome_binding = to_gnome_binding(&display_shortcut);

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
            &gnome_binding
        ])
        .status()
        .map_err(|e| format!("Failed to run gsettings set binding: {}", e))?;

    if !status.success() {
        return Err("gsettings set binding returned non-zero status".to_string());
    }

    // 4. Append to custom-keybindings list
    let output = std::process::Command::new("gsettings")
        .args(&[
            "get",
            "org.gnome.settings-daemon.plugins.media-keys",
            "custom-keybindings",
        ])
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

    let new_path =
        "'/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/guepardosys-snip/'"
            .to_string();
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
pub fn open_system_settings(_app: AppHandle) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        let desktop = std::env::var("XDG_CURRENT_DESKTOP")
            .unwrap_or_default()
            .to_lowercase();
        if desktop.contains("gnome") || desktop.contains("ubuntu") {
            match register_gnome_shortcut(&_app) {
                Ok(_) => return Ok("registered".to_string()),
                Err(e) => {
                    eprintln!("Failed to register GNOME shortcut: {}", e);
                }
            }
        }

        let _ = std::process::Command::new("gnome-control-center")
            .arg("keyboard")
            .spawn()
            .or_else(|_| std::process::Command::new("gnome-control-center").spawn())
            .or_else(|_| std::process::Command::new("systemsettings").spawn());

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

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    if !matches!(url.split(':').next(), Some("http") | Some("https")) {
        return Err("Only http and https URLs are supported".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|error| format!("Failed to open browser: {error}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|error| format!("Failed to open browser: {error}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|error| format!("Failed to open browser: {error}"))?;
    }

    Ok(())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn get_shortcut_from_file(app: &AppHandle) -> (String, String, bool) {
    let default_shortcut = if cfg!(target_os = "macos") {
        "Command+;".to_string()
    } else {
        "Ctrl+;".to_string()
    };

    let path = match app.path().app_data_dir() {
        Ok(dir) => dir.join("settings.json"),
        Err(_) => return (default_shortcut.clone(), default_shortcut, false),
    };

    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                let shortcut = val
                    .get("shortcut")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| default_shortcut.clone());

                let display = val
                    .get("display")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| shortcut.clone());

                let onboarding_completed = val
                    .get("onboarding_completed")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                return (shortcut, display, onboarding_completed);
            }
        }
    }
    (default_shortcut.clone(), default_shortcut, false)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn save_shortcut_to_file(
    app: &AppHandle,
    shortcut: &str,
    display: &str,
    onboarding_completed: bool,
) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("settings.json");
    let val = serde_json::json!({
        "shortcut": shortcut,
        "display": display,
        "onboarding_completed": onboarding_completed
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
        "INTLRO" => Ok(Code::IntlRo),
        "INTLBACKSLASH" => Ok(Code::IntlBackslash),

        _ => Err(format!("Unsupported key code: {}", s)),
    }
}

#[tauri::command]
pub fn get_shortcut(app: AppHandle) -> serde_json::Value {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let (shortcut, display, onboarding_completed) = get_shortcut_from_file(&app);
        serde_json::json!({
            "shortcut": shortcut,
            "display": display,
            "onboardingCompleted": onboarding_completed
        })
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        serde_json::json!({
            "shortcut": "Ctrl+;",
            "display": "Ctrl+;",
            "onboardingCompleted": true
        })
    }
}

#[tauri::command]
pub fn set_shortcut(app: AppHandle, shortcut: String, display: String) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let new_shortcut = parse_shortcut(&shortcut)?;

        let (old_shortcut_str, _, onboarding_completed) = get_shortcut_from_file(&app);
        let old_shortcut = parse_shortcut(&old_shortcut_str).ok();
        if let Some(previous) = old_shortcut.clone() {
            let _ = app.global_shortcut().unregister(previous);
        }

        if let Err(error) = app.global_shortcut().register(new_shortcut.clone()) {
            if let Some(previous) = old_shortcut {
                let _ = app.global_shortcut().register(previous);
            }
            return Err(format!("Failed to register shortcut with OS: {error}"));
        }

        if let Err(error) = save_shortcut_to_file(&app, &shortcut, &display, onboarding_completed) {
            let _ = app.global_shortcut().unregister(new_shortcut);
            if let Some(previous) = parse_shortcut(&old_shortcut_str).ok() {
                let _ = app.global_shortcut().register(previous);
            }
            return Err(error);
        }

        #[cfg(target_os = "linux")]
        {
            let desktop = std::env::var("XDG_CURRENT_DESKTOP")
                .unwrap_or_default()
                .to_lowercase();
            let session_type = std::env::var("XDG_SESSION_TYPE")
                .unwrap_or_default()
                .to_lowercase();
            if (desktop.contains("gnome") || desktop.contains("ubuntu"))
                && (session_type == "wayland" || is_gnome_shortcut_registered())
            {
                if let Err(e) = register_gnome_shortcut(&app) {
                    eprintln!("Failed to update GNOME custom shortcut: {}", e);
                }
            }
        }

        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Global shortcuts not supported on this platform".to_string())
    }
}

#[tauri::command]
pub fn disable_global_shortcut(app: AppHandle) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let (shortcut_str, _, _) = get_shortcut_from_file(&app);
        if let Ok(shortcut) = parse_shortcut(&shortcut_str) {
            let _ = app.global_shortcut().unregister(shortcut);
        }
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
pub fn enable_global_shortcut(app: AppHandle) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let (shortcut_str, _, _) = get_shortcut_from_file(&app);
        if let Ok(shortcut) = parse_shortcut(&shortcut_str) {
            // Unregister first to prevent double registration issues
            let _ = app.global_shortcut().unregister(shortcut.clone());
            app.global_shortcut()
                .register(shortcut)
                .map_err(|e| format!("Failed to register global shortcut: {}", e))?;
        }
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
pub fn set_shortcut_recording_active(active: bool) {
    crate::set_shortcut_recording_active(active);
}

#[tauri::command]
pub fn set_onboarding_completed(app: AppHandle, completed: bool) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let (shortcut, display, _) = get_shortcut_from_file(&app);
        save_shortcut_to_file(&app, &shortcut, &display, completed)?;
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
pub fn trigger_permission_check() -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use enigo::{Direction, Enigo, Key, Keyboard, Settings};
        let mut enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("Failed to initialize enigo: {}", e))?;

        let _ = enigo.key(Key::Shift, Direction::Press);
        let _ = enigo.key(Key::Shift, Direction::Release);
    }
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardConflicts {
    pub has_alt_space_conflict: bool,
    pub has_ctrl_semicolon_conflict: bool,
}

#[tauri::command]
#[allow(unused_mut)]
pub fn check_keyboard_conflicts() -> Result<KeyboardConflicts, String> {
    let mut has_alt_space_conflict = false;
    let mut has_ctrl_semicolon_conflict = false;

    #[cfg(target_os = "linux")]
    {
        // 1. Check Alt+Space window menu shortcut in GNOME
        if let Ok(output) = std::process::Command::new("gsettings")
            .args(&[
                "get",
                "org.gnome.desktop.wm.keybindings",
                "activate-window-menu",
            ])
            .output()
        {
            let out_str = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if out_str.contains("alt") && out_str.contains("space") {
                has_alt_space_conflict = true;
            }
        }

        // 2. Check IBus emoji hotkey
        if let Ok(output) = std::process::Command::new("gsettings")
            .args(&["get", "org.freedesktop.ibus.panel.emoji", "hotkey"])
            .output()
        {
            let out_str = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if out_str.contains("control")
                && (out_str.contains("semicolon") || out_str.contains(";"))
            {
                has_ctrl_semicolon_conflict = true;
            }
        }
    }

    Ok(KeyboardConflicts {
        has_alt_space_conflict,
        has_ctrl_semicolon_conflict,
    })
}

#[tauri::command]
pub fn resolve_keyboard_conflict(_conflict_type: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if _conflict_type == "alt-space" {
            let status = std::process::Command::new("gsettings")
                .args(&[
                    "set",
                    "org.gnome.desktop.wm.keybindings",
                    "activate-window-menu",
                    "[]",
                ])
                .status()
                .map_err(|e| format!("Failed to resolve alt-space conflict: {}", e))?;
            if !status.success() {
                return Err("Failed to clear activate-window-menu setting".to_string());
            }
        } else if _conflict_type == "ctrl-semicolon" {
            let status = std::process::Command::new("gsettings")
                .args(&["set", "org.freedesktop.ibus.panel.emoji", "hotkey", "[]"])
                .status()
                .map_err(|e| format!("Failed to resolve ctrl-semicolon conflict: {}", e))?;
            if !status.success() {
                return Err("Failed to clear ibus emoji hotkey".to_string());
            }
        }
    }
    Ok(())
}
