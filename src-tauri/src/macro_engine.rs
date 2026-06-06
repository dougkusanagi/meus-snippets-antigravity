use crate::snippet_store::MacroAction;
use enigo::{Enigo, Key, Keyboard, Settings, Direction};
use std::thread;
use std::time::Duration;
use tauri_plugin_clipboard_manager::ClipboardExt;

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

/// Executes a sequence of macro actions using enigo for input simulation and clipboard paste for text blocks
pub fn execute(actions: &[MacroAction], app: &tauri::AppHandle) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize enigo: {}", e))?;

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
