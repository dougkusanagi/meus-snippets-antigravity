use crate::snippet_store::MacroAction;
use enigo::{Enigo, Key, Keyboard, Settings, Direction};
use std::thread;
use std::time::Duration;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[cfg(target_os = "linux")]
use evdev::uinput::VirtualDevice;
#[cfg(target_os = "linux")]
use evdev::{AttributeSet, KeyCode, InputEvent, EventType};

#[cfg(target_os = "linux")]
static UINPUT_DEVICE: std::sync::OnceLock<std::sync::Mutex<Option<VirtualDevice>>> = std::sync::OnceLock::new();

#[cfg(target_os = "linux")]
fn get_keyboard_capabilities() -> AttributeSet<KeyCode> {
    let mut keys = AttributeSet::<KeyCode>::new();
    // Add standard modifiers
    keys.insert(KeyCode::KEY_LEFTCTRL);
    keys.insert(KeyCode::KEY_LEFTSHIFT);
    keys.insert(KeyCode::KEY_LEFTALT);
    keys.insert(KeyCode::KEY_LEFTMETA);
    keys.insert(KeyCode::KEY_RIGHTCTRL);
    keys.insert(KeyCode::KEY_RIGHTSHIFT);
    keys.insert(KeyCode::KEY_RIGHTALT);
    keys.insert(KeyCode::KEY_RIGHTMETA);
    
    // Add standard key range
    for code in 1..255 {
        keys.insert(KeyCode::new(code));
    }
    keys
}

#[cfg(target_os = "linux")]
fn get_uinput_device() -> &'static std::sync::Mutex<Option<VirtualDevice>> {
    UINPUT_DEVICE.get_or_init(|| {
        let device = std::fs::OpenOptions::new()
            .write(true)
            .open("/dev/uinput")
            .ok()
            .and_then(|_file| {
                let keys = get_keyboard_capabilities();
                match evdev::uinput::VirtualDevice::builder()
                    .and_then(|b| b.name("Guepardosys Snippet Virtual Keyboard").with_keys(&keys))
                    .and_then(|b| b.build())
                {
                    Ok(dev) => {
                        // Sleep a bit to let the OS register the virtual device
                        std::thread::sleep(std::time::Duration::from_millis(150));
                        Some(dev)
                    }
                    Err(e) => {
                        log::error!("Failed to build uinput virtual device: {}", e);
                        None
                    }
                }
            });
        std::sync::Mutex::new(device)
    })
}

#[cfg(target_os = "linux")]
fn map_key_to_evdev(key_name: &str) -> Option<KeyCode> {
    match key_name {
        "Enter" | "Return" => Some(KeyCode::KEY_ENTER),
        "Tab" => Some(KeyCode::KEY_TAB),
        "Backspace" => Some(KeyCode::KEY_BACKSPACE),
        "Delete" => Some(KeyCode::KEY_DELETE),
        "Escape" | "Esc" => Some(KeyCode::KEY_ESC),
        "ArrowUp" | "Up" => Some(KeyCode::KEY_UP),
        "ArrowDown" | "Down" => Some(KeyCode::KEY_DOWN),
        "ArrowLeft" | "Left" => Some(KeyCode::KEY_LEFT),
        "ArrowRight" | "Right" => Some(KeyCode::KEY_RIGHT),
        "Space" => Some(KeyCode::KEY_SPACE),
        "Home" => Some(KeyCode::KEY_HOME),
        "End" => Some(KeyCode::KEY_END),
        "PageUp" => Some(KeyCode::KEY_PAGEUP),
        "PageDown" => Some(KeyCode::KEY_PAGEDOWN),
        "a" | "A" => Some(KeyCode::KEY_A),
        "b" | "B" => Some(KeyCode::KEY_B),
        "c" | "C" => Some(KeyCode::KEY_C),
        "d" | "D" => Some(KeyCode::KEY_D),
        "e" | "E" => Some(KeyCode::KEY_E),
        "f" | "F" => Some(KeyCode::KEY_F),
        "g" | "G" => Some(KeyCode::KEY_G),
        "h" | "H" => Some(KeyCode::KEY_H),
        "i" | "I" => Some(KeyCode::KEY_I),
        "j" | "J" => Some(KeyCode::KEY_J),
        "k" | "K" => Some(KeyCode::KEY_K),
        "l" | "L" => Some(KeyCode::KEY_L),
        "m" | "M" => Some(KeyCode::KEY_M),
        "n" | "N" => Some(KeyCode::KEY_N),
        "o" | "O" => Some(KeyCode::KEY_O),
        "p" | "P" => Some(KeyCode::KEY_P),
        "q" | "Q" => Some(KeyCode::KEY_Q),
        "r" | "R" => Some(KeyCode::KEY_R),
        "s" | "S" => Some(KeyCode::KEY_S),
        "t" | "T" => Some(KeyCode::KEY_T),
        "u" | "U" => Some(KeyCode::KEY_U),
        "v" | "V" => Some(KeyCode::KEY_V),
        "w" | "W" => Some(KeyCode::KEY_W),
        "x" | "X" => Some(KeyCode::KEY_X),
        "y" | "Y" => Some(KeyCode::KEY_Y),
        "z" | "Z" => Some(KeyCode::KEY_Z),
        _ => None,
    }
}

#[cfg(target_os = "linux")]
fn map_modifier_to_evdev(modifier: &str) -> Option<KeyCode> {
    match modifier {
        "Ctrl" | "Control" => Some(KeyCode::KEY_LEFTCTRL),
        "Shift" => Some(KeyCode::KEY_LEFTSHIFT),
        "Alt" => Some(KeyCode::KEY_LEFTALT),
        "Meta" | "Super" | "Cmd" => Some(KeyCode::KEY_LEFTMETA),
        _ => None,
    }
}

/// Maps a key name string to an enigo Key enum
fn map_key(key_name: &str) -> Option<Key> {
    match key_name {
        "Enter" | "Return" => Some(Key::Return),
        "Tab" => Some(Key::Tab),
        "Backspace" => Some(Key::Backspace),
        "Delete" => Some(Key::Delete),
        "Escape" | "Esc" => Some(Key::Escape),
        "ArrowUp" | "Up" => Some(Key::UpArrow),
        "ArrowDown" | "Down" => Some(Key::DownArrow),
        "ArrowLeft" | "Left" => Some(Key::LeftArrow),
        "ArrowRight" | "Right" => Some(Key::RightArrow),
        "Space" => Some(Key::Space),
        "Home" => Some(Key::Home),
        "End" => Some(Key::End),
        "PageUp" => Some(Key::PageUp),
        "PageDown" => Some(Key::PageDown),
        s if s.len() == 1 => {
            let ch = s.chars().next().unwrap();
            Some(Key::Unicode(ch))
        }
        _ => None,
    }
}

/// Maps a modifier name to the corresponding enigo Key
fn map_modifier(modifier: &str) -> Option<Key> {
    match modifier {
        "Ctrl" | "Control" => Some(Key::Control),
        "Shift" => Some(Key::Shift),
        "Alt" => Some(Key::Alt),
        "Meta" | "Super" | "Cmd" => Some(Key::Meta),
        _ => None,
    }
}

fn paste_text(text: &str, app: &tauri::AppHandle, enigo: &mut Enigo) -> Result<(), String> {
    let clipboard = app.clipboard();
    
    // Save original clipboard content
    let original_text = clipboard.read_text().ok();
    
    // Write the new text to clipboard
    clipboard
        .write_text(text.to_string())
        .map_err(|e| format!("Failed to write to clipboard: {}", e))?;
        
    // Wait a tiny bit for clipboard registration
    thread::sleep(Duration::from_millis(20));
    
    // Press Ctrl+V (or Cmd+V on macOS)
    #[cfg(target_os = "macos")]
    let modifier = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let modifier = Key::Control;
    
    enigo
        .key(modifier, Direction::Press)
        .map_err(|e| format!("Failed to press modifier: {}", e))?;
        
    enigo
        .key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| format!("Failed to click V: {}", e))?;
        
    enigo
        .key(modifier, Direction::Release)
        .map_err(|e| format!("Failed to release modifier: {}", e))?;
        
    // Wait for the paste event to be processed by the target application
    thread::sleep(Duration::from_millis(60));
    
    // Restore original clipboard content
    if let Some(orig) = original_text {
        let _ = clipboard.write_text(orig);
    } else {
        let _ = clipboard.clear();
    }
    
    Ok(())
}

#[cfg(target_os = "linux")]
fn paste_text_uinput(text: &str, app: &tauri::AppHandle, device: &mut VirtualDevice) -> Result<(), String> {
    let clipboard = app.clipboard();
    
    // Save original clipboard content
    let original_text = clipboard.read_text().ok();
    
    // Write the new text to clipboard
    clipboard
        .write_text(text.to_string())
        .map_err(|e| format!("Failed to write to clipboard: {}", e))?;
        
    // Wait a tiny bit for clipboard registration
    thread::sleep(Duration::from_millis(20));
    
    // Press Ctrl+V via uinput
    let ctrl_down = InputEvent::new(EventType::KEY.0, KeyCode::KEY_LEFTCTRL.code(), 1);
    let v_down = InputEvent::new(EventType::KEY.0, KeyCode::KEY_V.code(), 1);
    let v_up = InputEvent::new(EventType::KEY.0, KeyCode::KEY_V.code(), 0);
    let ctrl_up = InputEvent::new(EventType::KEY.0, KeyCode::KEY_LEFTCTRL.code(), 0);
    let sync = InputEvent::new(evdev::EventType::SYNCHRONIZATION.0, 0, 0);

    device.emit(&[ctrl_down, sync.clone()]).map_err(|e| e.to_string())?;
    device.emit(&[v_down, sync.clone()]).map_err(|e| e.to_string())?;
    std::thread::sleep(Duration::from_millis(5));
    device.emit(&[v_up, sync.clone()]).map_err(|e| e.to_string())?;
    device.emit(&[ctrl_up, sync]).map_err(|e| e.to_string())?;
    
    // Wait for the paste event to be processed by the target application
    thread::sleep(Duration::from_millis(60));
    
    // Restore original clipboard content
    if let Some(orig) = original_text {
        let _ = clipboard.write_text(orig);
    } else {
        let _ = clipboard.clear();
    }
    
    Ok(())
}

#[cfg(target_os = "linux")]
fn execute_uinput(actions: &[MacroAction], app: &tauri::AppHandle) -> Result<(), String> {
    let mut device_guard = get_uinput_device().lock().unwrap();
    let device = device_guard.as_mut().unwrap();

    for action in actions {
        match action {
            MacroAction::Text { value } => {
                paste_text_uinput(value, app, device)?;
            }
            MacroAction::Key { key, modifiers } => {
                // Press modifier keys down
                let mods: Vec<KeyCode> = modifiers
                    .as_ref()
                    .map(|m| m.iter().filter_map(|name| map_modifier_to_evdev(name)).collect())
                    .unwrap_or_default();

                for modifier_key in &mods {
                    let ev = InputEvent::new(EventType::KEY.0, modifier_key.code(), 1);
                    let sync = InputEvent::new(evdev::EventType::SYNCHRONIZATION.0, 0, 0);
                    device.emit(&[ev, sync]).map_err(|e| e.to_string())?;
                }

                // Press the main key
                if let Some(main_key) = map_key_to_evdev(key) {
                    let ev_down = InputEvent::new(EventType::KEY.0, main_key.code(), 1);
                    let ev_up = InputEvent::new(EventType::KEY.0, main_key.code(), 0);
                    let sync = InputEvent::new(evdev::EventType::SYNCHRONIZATION.0, 0, 0);

                    device.emit(&[ev_down, sync.clone()]).map_err(|e| e.to_string())?;
                    std::thread::sleep(Duration::from_millis(5));
                    device.emit(&[ev_up, sync]).map_err(|e| e.to_string())?;
                }

                // Release modifier keys (in reverse order)
                for modifier_key in mods.iter().rev() {
                    let ev = InputEvent::new(EventType::KEY.0, modifier_key.code(), 0);
                    let sync = InputEvent::new(evdev::EventType::SYNCHRONIZATION.0, 0, 0);
                    device.emit(&[ev, sync]).map_err(|e| e.to_string())?;
                }
            }
        }

        // Small delay between actions for reliability
        thread::sleep(Duration::from_millis(15));
    }

    Ok(())
}

/// Executes a sequence of macro actions using enigo for input simulation and clipboard paste for text blocks
pub fn execute(actions: &[MacroAction], app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if get_uinput_device().lock().unwrap().is_some() {
            return execute_uinput(actions, app);
        }
    }

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize enigo: {}", e))?;

    // On Linux Wayland (when falling back to Enigo), force the permission dialog to trigger
    // BEFORE we modify the clipboard. This prevents the clipboard race condition.
    #[cfg(target_os = "linux")]
    {
        let _ = enigo.key(Key::Shift, Direction::Release);
    }

    for action in actions {
        match action {
            MacroAction::Text { value } => {
                paste_text(value, app, &mut enigo)?;
            }
            MacroAction::Key { key, modifiers } => {
                // Press modifier keys down
                let mods: Vec<Key> = modifiers
                    .as_ref()
                    .map(|m| m.iter().filter_map(|name| map_modifier(name)).collect())
                    .unwrap_or_default();

                for modifier_key in &mods {
                    enigo
                        .key(*modifier_key, Direction::Press)
                        .map_err(|e| format!("Failed to press modifier: {}", e))?;
                }

                // Press the main key
                if let Some(main_key) = map_key(key) {
                    enigo
                        .key(main_key, Direction::Click)
                        .map_err(|e| format!("Failed to press key: {}", e))?;
                }

                // Release modifier keys (in reverse order)
                for modifier_key in mods.iter().rev() {
                    enigo
                        .key(*modifier_key, Direction::Release)
                        .map_err(|e| format!("Failed to release modifier: {}", e))?;
                }
            }
        }

        // Small delay between actions for reliability
        thread::sleep(Duration::from_millis(15));
    }

    Ok(())
}

/// Deletes N characters before the cursor (to remove trigger text)
pub fn delete_trigger(char_count: usize) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(device) = get_uinput_device().lock().unwrap().as_mut() {
            for _ in 0..char_count {
                let key_down = InputEvent::new(EventType::KEY.0, KeyCode::KEY_BACKSPACE.code(), 1);
                let key_up = InputEvent::new(EventType::KEY.0, KeyCode::KEY_BACKSPACE.code(), 0);
                let sync = InputEvent::new(evdev::EventType::SYNCHRONIZATION.0, 0, 0);
                
                device.emit(&[key_down, sync.clone()]).map_err(|e| e.to_string())?;
                std::thread::sleep(Duration::from_millis(5));
                device.emit(&[key_up, sync]).map_err(|e| e.to_string())?;
                std::thread::sleep(Duration::from_millis(5));
            }
            return Ok(());
        }
    }

    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize enigo: {}", e))?;

    for _ in 0..char_count {
        enigo
            .key(Key::Backspace, Direction::Click)
            .map_err(|e| format!("Failed to press backspace: {}", e))?;
        thread::sleep(Duration::from_millis(5));
    }

    Ok(())
}
