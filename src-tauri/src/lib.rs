mod commands;
mod macro_engine;
mod snippet_store;
mod tray;

use snippet_store::SnippetStore;
use tauri::{Emitter, Manager};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use std::sync::atomic::{AtomicBool, Ordering};

fn picker_last_shown() -> &'static Mutex<Option<Instant>> {
    static CELL: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();
    CELL.get_or_init(|| Mutex::new(None))
}

static SHORTCUT_RECORDING_ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn is_shortcut_recording_active() -> bool {
    SHORTCUT_RECORDING_ACTIVE.load(Ordering::Relaxed)
}

pub fn set_shortcut_recording_active(active: bool) {
    SHORTCUT_RECORDING_ACTIVE.store(active, Ordering::Relaxed);
}


fn toggle_picker(app: &tauri::AppHandle) {
    if is_shortcut_recording_active() {
        return;
    }
    if let Some(picker) = app.get_webview_window("picker") {
        if picker.is_visible().unwrap_or(false) {
            let _ = picker.hide();
        } else {
            let mut timestamp: Option<u32> = None;
            #[cfg(target_os = "linux")]
            {
                if let Ok(startup_id) = std::fs::read_to_string("/tmp/guepardosys-snip-startup-id") {
                    if let Some(pos) = startup_id.rfind("_TIME") {
                        let ts_str = startup_id[pos + 5..].trim();
                        if let Ok(ts) = ts_str.parse::<u32>() {
                            timestamp = Some(ts);
                        }
                    }
                    let _ = std::fs::remove_file("/tmp/guepardosys-snip-startup-id");
                }
            }

            picker.center().unwrap_or_default();
            let _ = picker.set_always_on_top(false);
            let _ = picker.show();
            let _ = picker.set_always_on_top(true);

            #[cfg(target_os = "linux")]
            {
                if let Ok(gtk_win) = picker.gtk_window() {
                    use gtk::prelude::*;
                    if let Some(ts) = timestamp {
                        gtk_win.present_with_time(ts);
                    } else {
                        gtk_win.present();
                    }
                } else {
                    let _ = picker.set_focus();
                }
            }
            #[cfg(not(target_os = "linux"))]
            {
                let _ = picker.set_focus();
            }

            if let Ok(mut last_shown) = picker_last_shown().lock() {
                *last_shown = Some(Instant::now());
            }

            picker.emit("picker-activated", ()).unwrap_or_default();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let store = SnippetStore::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    toggle_picker(app);
                }
            })
            .build()
        )
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let has_picker_arg = argv.iter().any(|arg| arg == "--picker" || arg == "--toggle" || arg == "-p");
            if has_picker_arg {
                toggle_picker(app);
            } else {
                if let Some(main_window) = app.get_webview_window("main") {
                    main_window.show().unwrap_or_default();
                    main_window.set_focus().unwrap_or_default();
                }
            }
        }))
        .manage(store)
        .invoke_handler(tauri::generate_handler![
            commands::get_snippets,
            commands::add_snippet,
            commands::update_snippet,
            commands::delete_snippet,
            commands::execute_macro,
            commands::hide_picker,
            commands::show_manager,
            commands::get_platform_info,
            commands::open_system_settings,
            commands::get_shortcut,
            commands::set_shortcut,
            commands::disable_global_shortcut,
            commands::enable_global_shortcut,
            commands::set_shortcut_recording_active,
            commands::set_onboarding_completed,
            commands::trigger_permission_check,
            commands::check_keyboard_conflicts,
            commands::resolve_keyboard_conflict,
        ])
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    window.hide().unwrap_or_default();
                    api.prevent_close();
                }
                tauri::WindowEvent::Focused(false) => {
                    if window.label() == "picker" {
                        // Avoid focus-loss race condition right after showing the window
                        let should_hide = if let Ok(last_shown) = picker_last_shown().lock() {
                            if let Some(instant) = *last_shown {
                                instant.elapsed().as_millis() > 400
                            } else {
                                true
                            }
                        } else {
                            true
                        };
                        if should_hide {
                            window.hide().unwrap_or_default();
                        } else {
                            // Focus was lost within grace period (usually due to Wayland/XWayland mapping delay),
                            // request focus again.
                            let w = window.clone();
                            std::thread::spawn(move || {
                                std::thread::sleep(std::time::Duration::from_millis(50));
                                let _ = w.set_focus();
                            });
                        }
                    }
                }
                _ => {}
            }
        })
        .setup(|app| {
            // Initialize snippet store with app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            let store = app.state::<SnippetStore>();
            store.init(app_data_dir);

            // Setup system tray
            tray::setup_tray(app.handle())
                .expect("Failed to setup system tray");

            // Load custom global shortcut on startup and register it
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let app_handle = app.handle();
                let (shortcut_str, _, _) = commands::get_shortcut_from_file(app_handle);
                match commands::parse_shortcut(&shortcut_str) {
                    Ok(shortcut) => {
                        if let Err(e) = app.global_shortcut().register(shortcut) {
                            eprintln!("Failed to register startup global shortcut '{}': {}", shortcut_str, e);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to parse startup global shortcut '{}': {}", shortcut_str, e);
                        // Register default fallback
                        let default_str = if cfg!(target_os = "macos") { "Command+;" } else { "Ctrl+;" };
                        if let Ok(default_shortcut) = commands::parse_shortcut(default_str) {
                            let _ = app.global_shortcut().register(default_shortcut);
                        }
                    }
                }

                // On Linux GNOME, also synchronize the system-wide shortcut on startup
                #[cfg(target_os = "linux")]
                {
                    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default().to_lowercase();
                    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default().to_lowercase();
                    if (desktop.contains("gnome") || desktop.contains("ubuntu")) && (session_type == "wayland" || commands::is_gnome_shortcut_registered()) {
                        if let Err(e) = commands::register_gnome_shortcut(app_handle) {
                            eprintln!("Failed to register startup GNOME custom shortcut: {}", e);
                        }
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
