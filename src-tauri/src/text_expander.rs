#[cfg(target_os = "windows")]
mod windows_impl {
    use crate::is_shortcut_recording_active;
    use crate::macro_engine;
    use crate::snippet_store::{MacroAction, Snippet, SnippetStore};
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Mutex, OnceLock};
    use std::thread;
    use std::time::Duration;
    use tauri::Manager;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::Threading::GetCurrentProcessId;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetKeyboardLayout, GetKeyboardState, MapVirtualKeyW, ToUnicodeEx, MAPVK_VK_TO_CHAR,
        VK_BACK, VK_DELETE, VK_DIVIDE, VK_DOWN, VK_END, VK_ESCAPE, VK_HOME, VK_LEFT, VK_NEXT,
        VK_PRIOR, VK_RETURN, VK_RIGHT, VK_SPACE, VK_TAB, VK_UP,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetForegroundWindow, GetMessageW,
        GetWindowThreadProcessId, SetWindowsHookExW, TranslateMessage, HC_ACTION, HHOOK,
        KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
    };

    const TRIGGER_PREFIX: char = '/';
    const MAX_BUFFER_CHARS: usize = 100;
    const LLKHF_INJECTED: u32 = 0x0000_0010;
    const TO_UNICODE_NO_STATE_CHANGE: u32 = 0x0004;

    struct ListenerState {
        buffer: String,
    }

    impl ListenerState {
        fn new() -> Self {
            Self {
                buffer: String::new(),
            }
        }

        fn clear_buffer(&mut self) {
            self.buffer.clear();
        }

        fn reset(&mut self) {
            self.clear_buffer();
        }

        fn push_char(&mut self, ch: char) -> Option<String> {
            if ch.is_control() {
                self.reset();
                return None;
            }

            if ch.is_whitespace() {
                self.reset();
                return None;
            }

            if ch == TRIGGER_PREFIX {
                self.buffer.clear();
                self.buffer.push(ch);
                return Some(self.buffer.clone());
            }

            if self.buffer.is_empty() {
                return None;
            }

            self.buffer.push(ch);
            if self.buffer.chars().count() > MAX_BUFFER_CHARS {
                self.clear_buffer();
                return None;
            }

            Some(self.buffer.clone())
        }

        fn backspace(&mut self) {
            self.buffer.pop();
        }
    }

    struct HookRuntime {
        app: tauri::AppHandle,
        state: Mutex<ListenerState>,
        expanding: AtomicBool,
    }

    static RUNTIME: OnceLock<HookRuntime> = OnceLock::new();

    fn reset_listener(runtime: &HookRuntime) {
        if let Ok(mut state) = runtime.state.lock() {
            state.reset();
        }
    }

    pub fn start(app: tauri::AppHandle) {
        if RUNTIME
            .set(HookRuntime {
                app,
                state: Mutex::new(ListenerState::new()),
                expanding: AtomicBool::new(false),
            })
            .is_err()
        {
            return;
        }

        thread::spawn(move || unsafe {
            let Ok(_hook) = SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), None, 0) else {
                eprintln!("Failed to install Windows keyboard hook for text expansion");
                return;
            };

            let mut message = MSG::default();
            while GetMessageW(&mut message, HWND::default(), 0, 0).as_bool() {
                let _ = TranslateMessage(&message);
                let _ = DispatchMessageW(&message);
            }
        });
    }

    unsafe extern "system" fn keyboard_proc(
        code: i32,
        w_param: WPARAM,
        l_param: LPARAM,
    ) -> LRESULT {
        if code == HC_ACTION as i32
            && (w_param.0 as u32 == WM_KEYDOWN || w_param.0 as u32 == WM_SYSKEYDOWN)
        {
            let key_info = &*(l_param.0 as *const KBDLLHOOKSTRUCT);
            if key_info.flags.0 & LLKHF_INJECTED == 0 {
                handle_key_down(key_info);
            }
        }

        unsafe { CallNextHookEx(HHOOK::default(), code, w_param, l_param) }
    }

    fn handle_key_down(key_info: &KBDLLHOOKSTRUCT) {
        let Some(runtime) = RUNTIME.get() else {
            return;
        };

        if runtime.expanding.load(Ordering::Relaxed)
            || is_shortcut_recording_active()
            || is_own_window_focused()
        {
            reset_listener(runtime);
            return;
        }

        let vk = key_info.vkCode;

        if vk == VK_BACK.0 as u32 {
            if let Ok(mut state) = runtime.state.lock() {
                state.backspace();
            }
            return;
        }

        if matches!(
            vk,
            value if value == VK_SPACE.0 as u32
                || value == VK_TAB.0 as u32
                || value == VK_RETURN.0 as u32
                || value == VK_ESCAPE.0 as u32
                || value == VK_DELETE.0 as u32
                || value == VK_LEFT.0 as u32
                || value == VK_RIGHT.0 as u32
                || value == VK_UP.0 as u32
                || value == VK_DOWN.0 as u32
                || value == VK_HOME.0 as u32
                || value == VK_END.0 as u32
                || value == VK_PRIOR.0 as u32
                || value == VK_NEXT.0 as u32
        ) {
            reset_listener(runtime);
            return;
        }

        let Some(ch) = translate_key_to_char(vk, key_info.scanCode) else {
            reset_listener(runtime);
            return;
        };

        let candidate = {
            let Ok(mut state) = runtime.state.lock() else {
                return;
            };
            state.push_char(ch)
        };

        let Some(trigger) = candidate else {
            return;
        };

        if !trigger.starts_with(TRIGGER_PREFIX) {
            return;
        }

        try_expand_trigger(runtime, trigger);
    }

    fn try_expand_trigger(runtime: &HookRuntime, typed_trigger: String) {
        let store = runtime.app.state::<SnippetStore>();
        let snippet_trigger = normalize_inline_trigger(&typed_trigger);
        let Ok(Some(snippet)) = store.get_by_trigger(&snippet_trigger) else {
            return;
        };

        if snippet_requires_user_input(&snippet) {
            return;
        }

        if runtime
            .expanding
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }

        reset_listener(runtime);

        let app = runtime.app.clone();
        thread::spawn(move || {
            let result = (|| -> Result<(), String> {
                macro_engine::delete_trigger(typed_trigger.chars().count())?;
                thread::sleep(Duration::from_millis(40));
                macro_engine::execute(&snippet.actions, &app, &HashMap::new())?;
                let store = app.state::<SnippetStore>();
                store.record_usage(&snippet.id)?;
                Ok(())
            })();

            if let Err(error) = result {
                eprintln!("Failed to expand snippet '{}': {}", snippet.trigger, error);
            }

            if let Some(runtime) = RUNTIME.get() {
                runtime.expanding.store(false, Ordering::SeqCst);
            }
        });
    }

    fn normalize_inline_trigger(typed_trigger: &str) -> String {
        typed_trigger
            .strip_prefix(TRIGGER_PREFIX)
            .unwrap_or(typed_trigger)
            .to_string()
    }

    fn snippet_requires_user_input(snippet: &Snippet) -> bool {
        for action in &snippet.actions {
            let MacroAction::Text { value } = action else {
                continue;
            };

            let mut remaining = value.as_str();
            while let Some(start) = remaining.find("{{") {
                let after_start = &remaining[start + 2..];
                let Some(end) = after_start.find("}}") else {
                    break;
                };
                let name = after_start[..end].trim();
                if !matches!(
                    name,
                    "" | "date" | "time" | "datetime" | "clipboard" | "uuid" | "cursor"
                ) {
                    return true;
                }
                remaining = &after_start[end + 2..];
            }
        }

        false
    }

    fn is_own_window_focused() -> bool {
        unsafe {
            let window = GetForegroundWindow();
            if window.0.is_null() {
                return false;
            }

            let mut process_id = 0;
            let _ = GetWindowThreadProcessId(window, Some(&mut process_id));
            process_id == GetCurrentProcessId()
        }
    }

    fn translate_key_to_char(vk_code: u32, scan_code: u32) -> Option<char> {
        let mut keyboard_state = [0u8; 256];
        unsafe {
            if GetKeyboardState(&mut keyboard_state).is_err() {
                return None;
            }
        }
        if let Some(state) = keyboard_state.get_mut(vk_code as usize) {
            *state |= 0x80;
        }

        let foreground_window = unsafe { GetForegroundWindow() };
        let layout = unsafe {
            if foreground_window.0.is_null() {
                GetKeyboardLayout(0)
            } else {
                let thread_id = GetWindowThreadProcessId(foreground_window, None);
                GetKeyboardLayout(thread_id)
            }
        };

        let mut utf16 = [0u16; 4];
        let translated = unsafe {
            ToUnicodeEx(
                vk_code,
                scan_code,
                &keyboard_state,
                &mut utf16,
                TO_UNICODE_NO_STATE_CHANGE,
                layout,
            )
        };

        if translated < 0 {
            let mut dead_key_sink = [0u16; 4];
            let _ = unsafe {
                ToUnicodeEx(
                    vk_code,
                    scan_code,
                    &keyboard_state,
                    &mut dead_key_sink,
                    TO_UNICODE_NO_STATE_CHANGE,
                    layout,
                )
            };
            return None;
        }

        if translated > 0 {
            return char::from_u32(utf16[0] as u32);
        }

        if vk_code == VK_DIVIDE.0 as u32 {
            return Some('/');
        }

        let fallback = unsafe { MapVirtualKeyW(vk_code, MAPVK_VK_TO_CHAR) };
        if fallback == 0 {
            return None;
        }

        let fallback_char = (fallback & 0x7fff) as u32;
        let ch = char::from_u32(fallback_char)?;
        if ch.is_control() {
            return None;
        }

        Some(ch)
    }

    #[cfg(test)]
    mod tests {
        use super::{normalize_inline_trigger, ListenerState};

        #[test]
        fn starts_tracking_only_after_prefix() {
            let mut state = ListenerState::new();
            assert_eq!(state.push_char('a'), None);
            assert_eq!(state.push_char('/'), Some("/".to_string()));
            state.push_char(' ');
            assert_eq!(state.push_char('/'), Some("/".to_string()));
            assert_eq!(state.push_char('e'), Some("/e".to_string()));
        }

        #[test]
        fn resets_on_whitespace() {
            let mut state = ListenerState::new();
            state.push_char('/');
            assert_eq!(state.push_char('a'), Some("/a".to_string()));
            assert_eq!(state.push_char(' '), None);
            assert_eq!(state.push_char('b'), None);
        }

        #[test]
        fn backspace_updates_candidate() {
            let mut state = ListenerState::new();
            state.push_char('/');
            state.push_char('a');
            state.push_char('b');
            state.backspace();
            assert_eq!(state.push_char('c'), Some("/ac".to_string()));
        }

        #[test]
        fn restarts_tracking_on_prefix_inside_existing_token() {
            let mut state = ListenerState::new();
            assert_eq!(state.push_char('x'), None);
            assert_eq!(state.push_char('/'), Some("/".to_string()));
            assert_eq!(state.push_char('1'), Some("/1".to_string()));
        }

        #[test]
        fn reset_allows_new_prefix_after_external_clear() {
            let mut state = ListenerState::new();
            assert_eq!(state.push_char('x'), None);
            state.reset();
            assert_eq!(state.push_char('/'), Some("/".to_string()));
            assert_eq!(state.push_char('1'), Some("/1".to_string()));
        }

        #[test]
        fn normalizes_prefixed_trigger_before_lookup() {
            assert_eq!(normalize_inline_trigger("/1"), "1");
            assert_eq!(normalize_inline_trigger("/email"), "email");
        }
    }
}

#[cfg(target_os = "windows")]
pub use windows_impl::start;

#[cfg(not(target_os = "windows"))]
pub fn start(_app: tauri::AppHandle) {}
