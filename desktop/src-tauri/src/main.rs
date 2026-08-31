// The whole wrapper: open ONE frameless always-on-top window loading /pip
// from the running MyWork app, then let the page do everything else -
// sizing, menus, closing - through the injected __TAURI__ API
// (withGlobalTauri). A monitor number as the first CLI argument narrows the
// window to that monitor; the server (pipWindowService.js) passes it when
// "Pop out this monitor" is chosen in the browser. Each launch is its own
// process and window, which is how several monitors float at once.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Listener, Manager, WebviewUrl, WebviewWindowBuilder};

// The right-button window drag. The page cannot drive this itself: macOS
// refuses to start its native drag session from a right-mouse event, and
// moving the window from JS mousemove fails because WKWebView reports
// screen coordinates against a stale window origin once the window moves.
// So the page just emits "begin"/"end" (a plain Tauri event - custom invoke
// commands are ACL-blocked for remote-URL windows, events are not), and
// this thread follows the REAL cursor, read on the Rust side, immune to
// both problems.
static MOVING: AtomicBool = AtomicBool::new(false);

fn start_follow(window: tauri::WebviewWindow) {
    if MOVING.swap(true, Ordering::SeqCst) {
        return; // already following the cursor
    }
    std::thread::spawn(move || {
        let app = window.app_handle().clone();
        let (start_cursor, start_win) =
            match (app.cursor_position(), window.outer_position()) {
                (Ok(c), Ok(w)) => (c, w),
                _ => {
                    MOVING.store(false, Ordering::SeqCst);
                    return;
                }
            };
        while MOVING.load(Ordering::SeqCst) {
            if let Ok(cur) = app.cursor_position() {
                let x = start_win.x + (cur.x - start_cursor.x) as i32;
                let y = start_win.y + (cur.y - start_cursor.y) as i32;
                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            }
            std::thread::sleep(std::time::Duration::from_millis(8));
        }
    });
}

// macOS Spaces ("virtual monitors"). There is NO public API for either
// listing Spaces or placing a window on a chosen one - this uses the same
// private SkyLight calls window-manager utilities use. Read-only listing
// plus moving OUR OWN window is the least invasive form of it, but it is
// still private API: if a macOS update breaks it, the menu simply shows no
// Space entries (list() returning empty) rather than the app failing.
mod spaces {
    use core_foundation::array::CFArray;
    use core_foundation::base::TCFType;
    use core_foundation::number::CFNumber;
    use core_foundation::string::CFString;
    use core_foundation_sys::array::CFArrayRef;
    use core_foundation_sys::base::CFTypeRef;
    use core_foundation_sys::dictionary::{CFDictionaryGetValue, CFDictionaryRef};
    use core_foundation_sys::number::{kCFNumberSInt64Type, CFNumberGetValue, CFNumberRef};

    #[link(name = "SkyLight", kind = "framework")]
    extern "C" {
        fn SLSMainConnectionID() -> i32;
        fn SLSCopyManagedDisplaySpaces(cid: i32) -> CFArrayRef;
        fn SLSMoveWindowsToManagedSpace(cid: i32, window_ids: CFArrayRef, space_id: u64);
    }

    unsafe fn dict_get(d: CFDictionaryRef, key: &str) -> CFTypeRef {
        let k = CFString::new(key);
        CFDictionaryGetValue(d, k.as_CFTypeRef() as _)
    }

    unsafe fn as_i64(n: CFTypeRef) -> Option<i64> {
        if n.is_null() {
            return None;
        }
        let mut out: i64 = 0;
        if CFNumberGetValue(n as CFNumberRef, kCFNumberSInt64Type, &mut out as *mut i64 as _) {
            Some(out)
        } else {
            None
        }
    }

    pub struct SpaceInfo {
        pub id: u64,
        pub label: String,
        pub current: bool,
    }

    /// Every user Space ("Desktop N"), across all displays, in Mission
    /// Control order. Fullscreen-app spaces are skipped - a window cannot
    /// meaningfully live on one.
    pub fn list() -> Vec<SpaceInfo> {
        let mut out = Vec::new();
        unsafe {
            let cid = SLSMainConnectionID();
            let arr = SLSCopyManagedDisplaySpaces(cid);
            if arr.is_null() {
                return out;
            }
            let displays: CFArray<*const std::ffi::c_void> =
                CFArray::wrap_under_create_rule(arr);
            let mut n = 0u32;
            for d in displays.iter() {
                let display = *d as CFDictionaryRef;
                let current_id =
                    as_i64(dict_get(dict_get(display, "Current Space") as CFDictionaryRef as _, "id64"))
                        .unwrap_or(-1);
                let spaces_ref = dict_get(display, "Spaces") as CFArrayRef;
                if spaces_ref.is_null() {
                    continue;
                }
                let spaces: CFArray<*const std::ffi::c_void> =
                    CFArray::wrap_under_get_rule(spaces_ref);
                for s in spaces.iter() {
                    let space = *s as CFDictionaryRef;
                    let ty = as_i64(dict_get(space, "type")).unwrap_or(-1);
                    if ty != 0 {
                        continue; // fullscreen app / system space
                    }
                    let id = match as_i64(dict_get(space, "id64")) {
                        Some(v) => v,
                        None => continue,
                    };
                    n += 1;
                    out.push(SpaceInfo {
                        id: id as u64,
                        label: format!("Desktop {n}"),
                        current: id == current_id,
                    });
                }
            }
        }
        out
    }

    pub fn move_window(window_number: i64, space_id: u64) {
        unsafe {
            let cid = SLSMainConnectionID();
            let ids = CFArray::from_CFTypes(&[CFNumber::from(window_number)]);
            SLSMoveWindowsToManagedSpace(cid, ids.as_concrete_TypeRef(), space_id);
        }
    }
}

fn window_number(window: &tauri::WebviewWindow) -> Option<i64> {
    let ptr = window.ns_window().ok()?;
    let obj = ptr as *mut objc2::runtime::AnyObject;
    let n: isize = unsafe { objc2::msg_send![obj, windowNumber] };
    Some(n as i64)
}

fn main() {
    // CLI: <monitor> [x y]  - x/y are logical screen coordinates of the
    // navbar monitor being popped out, sent by the browser page through the
    // server, so the window opens on the SAME screen right over it.
    let args: Vec<String> = std::env::args().collect();
    let monitor: Option<u32> = args.get(1).and_then(|a| a.parse().ok());
    let pos: (f64, f64) = match (
        args.get(2).and_then(|a| a.parse().ok()),
        args.get(3).and_then(|a| a.parse().ok()),
    ) {
        (Some(x), Some(y)) => (x, y),
        _ => (80.0, 80.0),
    };

    tauri::Builder::default()
        .setup(move |app| {
            let url = match monitor {
                Some(n) => format!("http://localhost:3000/pip?monitor={n}"),
                None => "http://localhost:3000/pip".to_string(),
            };
            let title = match monitor {
                Some(n) => format!("Focus monitor {n}"),
                None => "Focus monitors".to_string(),
            };
            // Transparent + shadowless: the page paints nothing but the
            // monitor square, so the window must add nothing around it - no
            // background, and no rectangular shadow betraying a window edge.
            // NOT visible_on_all_workspaces: the window opens on the ACTIVE
            // macOS Space - the one the browser was on when the pop-out was
            // asked for - and stays off the others unless the pop-out's own
            // menu turns "show on all virtual monitors" on
            // (focus-desktop.js calls setVisibleOnAllWorkspaces).
            let window = WebviewWindowBuilder::new(app, "monitors", WebviewUrl::External(url.parse()?))
                .title(title)
                .decorations(false)
                .always_on_top(true)
                .transparent(true)
                .shadow(false)
                .position(pos.0, pos.1)
                .inner_size(400.0, 56.0)
                .resizable(false)
                .build()?;

            let drag_window = window.clone();
            app.listen_any("pip-move", move |event| {
                if event.payload().contains("begin") {
                    start_follow(drag_window.clone());
                } else {
                    MOVING.store(false, Ordering::SeqCst);
                }
            });

            // The page asks for the Space list when its menu opens and gets
            // it back as an event; picking one sends the id to move to.
            let list_window = window.clone();
            app.listen_any("pip-spaces-request", move |_| {
                let payload: Vec<serde_json::Value> = spaces::list()
                    .into_iter()
                    .map(|s| {
                        serde_json::json!({ "id": s.id, "label": s.label, "current": s.current })
                    })
                    .collect();
                let _ = list_window.emit("pip-spaces-list", payload);
            });

            let move_window_handle = window.clone();
            app.listen_any("pip-space-move", move |event| {
                // payload is the JSON-encoded space id string, e.g. "\"42\""
                let id: Option<u64> = event
                    .payload()
                    .trim_matches(|c| c == '"' || c == '\\')
                    .parse()
                    .ok();
                if let (Some(space_id), Some(win_no)) = (id, window_number(&move_window_handle)) {
                    spaces::move_window(win_no, space_id);
                }
            });

            // Self-test: MYWORK_PIP_SPACETEST=1 lists the Spaces to stderr
            // and moves the window to the first non-current one, so the move
            // call's behaviour on this macOS can be read from the log.
            if std::env::var("MYWORK_PIP_SPACETEST").is_ok() {
                let test_window = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    let all = spaces::list();
                    for s in &all {
                        eprintln!("[spacetest] {} id={} current={}", s.label, s.id, s.current);
                    }
                    if let Some(target) = all.iter().find(|s| !s.current) {
                        if let Some(win_no) = window_number(&test_window) {
                            eprintln!("[spacetest] moving window {} to {}", win_no, target.label);
                            spaces::move_window(win_no, target.id);
                        }
                    } else {
                        eprintln!("[spacetest] only one Space exists - nothing to move to");
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MyWork Monitors");
}
