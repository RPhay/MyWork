#![cfg_attr(all(not(debug_assertions), target_os = "macos"), windows_subsystem = "windows")]

use tauri::{Manager, WindowEvent};

#[cfg(target_os = "macos")]
use cocoa::appkit::NSWindow;
#[cfg(target_os = "macos")]
use cocoa::base::{id, nil};
#[cfg(target_os = "macos")]
use cocoa::foundation::NSRect;
#[cfg(target_os = "macos")]
use objc::msg_send;
#[cfg(target_os = "macos")]
use objc::sel;
#[cfg(target_os = "macos")]
use objc::sel_impl;

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let window = app.get_window("main").unwrap();

      #[cfg(target_os = "macos")]
      {
        let ns_window = window.ns_window().unwrap() as id;
        unsafe {
          let _: () = msg_send![ns_window, setLevel: 25]; // NSFloatingWindowLevel
          let _: () = msg_send![ns_window, setCollectionBehavior: 1 << 8]; // NSWindowCollectionBehaviorTransient
        }
      }

      window.set_always_on_top(true).ok();

      Ok(())
    })
    .on_window_event(|event| {
      if let tauri::WindowEvent::Moved(_) = event.event {
        if let Some(window) = event.window.get_window("main") {
          if let Ok(position) = window.outer_position() {
            let monitor = window.current_monitor().ok().flatten();
            if let Some(monitor) = monitor {
              let monitor_pos = monitor.position();
              let window_width = window.outer_size().ok().map(|s| s.width).unwrap_or(600);

              let x = position.x;
              let y = position.y;
              let snap_distance = 20;

              let (new_x, new_y) = if (x - monitor_pos.x).abs() < snap_distance {
                (monitor_pos.x, y) // Snap to left
              } else if (x + window_width as i32 - (monitor_pos.x + monitor.size().width as i32)).abs() < snap_distance {
                (monitor_pos.x + monitor.size().width as i32 - window_width as i32, y) // Snap to right
              } else if y - monitor_pos.y < snap_distance {
                (x, monitor_pos.y) // Snap to top
              } else {
                (x, y)
              };

              if (new_x, new_y) != (x, y) {
                let _ = window.set_position(tauri::LogicalPosition::new(new_x, new_y));
              }
            }
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
