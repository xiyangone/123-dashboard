// dashboard-tauri lib.rs
//
// 职责：
//   * setup：spawn 后端 uvicorn-app sidecar 子进程
//   * RunEvent::ExitRequested：kill sidecar，保证关闭桌面 app 时后端被一起杀掉
//
// 通过 tauri-plugin-shell 的 sidecar API 调用 src-tauri/bin/uvicorn-app-<triple>.exe

use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// 全局存放 sidecar 子进程句柄，方便退出时 kill。
struct SidecarChild(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarChild(Mutex::new(None)))
        .setup(|app| {
            // 启动后端 sidecar：bin/uvicorn-app-<triple>.exe
            let sidecar = app
                .shell()
                .sidecar("uvicorn-app")
                .expect("failed to locate uvicorn-app sidecar");

            let (_rx, child) = sidecar
                .spawn()
                .expect("failed to spawn uvicorn-app sidecar");

            // 保存句柄供退出时使用
            let state = app.state::<SidecarChild>();
            *state.0.lock().unwrap() = Some(child);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // 关闭 app 时把后端 sidecar 一并杀掉
            if let RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<SidecarChild>();
                if let Some(child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
