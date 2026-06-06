// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Fix for WebKitGTK/Wayland crashes (Error 71) on some Linux systems (especially NVIDIA).
        // For a macro-expander app, X11/XWayland is also much more stable for global keyboard shortcuts
        // and keyboard simulation (enigo) than native Wayland.
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        if std::env::var("GDK_BACKEND").is_err() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
        if let Ok(startup_id) = std::env::var("DESKTOP_STARTUP_ID") {
            let _ = std::fs::write("/tmp/guepardosys-snip-startup-id", startup_id);
        }
    }

    guepardosys_snip_lib::run()
}
