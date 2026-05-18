use serde::Serialize;
use std::{
    io::{ErrorKind, Read, Write},
    net::TcpStream,
    time::Duration,
};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager, RunEvent,
};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

#[derive(Serialize)]
struct LocalBridgeResponse {
    status: u16,
    body: String,
}

#[tauri::command]
async fn local_bridge_get(
    path: String,
    method: Option<String>,
    body: Option<String>,
) -> Result<LocalBridgeResponse, String> {
    tauri::async_runtime::spawn_blocking(move || local_bridge_get_blocking(path, method, body))
        .await
        .map_err(|err| format!("local bridge task failed: {err}"))?
}

fn local_bridge_get_blocking(
    path: String,
    method: Option<String>,
    body: Option<String>,
) -> Result<LocalBridgeResponse, String> {
    if !path.starts_with("/api/") || path.contains("..") || path.contains('\r') || path.contains('\n') {
        return Err("invalid local bridge path".into());
    }
    let method = method.unwrap_or_else(|| "GET".into()).to_uppercase();
    if method != "GET" && method != "POST" {
        return Err("invalid local bridge method".into());
    }
    let body = body.unwrap_or_default();

    let mut stream = TcpStream::connect_timeout(
        &"127.0.0.1:9509".parse().map_err(|err| format!("invalid bridge address: {err}"))?,
        Duration::from_secs(2),
    )
    .map_err(|err| format!("connect 127.0.0.1:9509 failed: {err}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(3)))
        .map_err(|err| format!("set read timeout failed: {err}"))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(3)))
        .map_err(|err| format!("set write timeout failed: {err}"))?;

    let request = if method == "POST" {
        format!(
            "POST {path} HTTP/1.1\r\nHost: 127.0.0.1:9509\r\nConnection: close\r\nAccept: application/json\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            body.as_bytes().len(),
            body
        )
    } else {
        format!(
            "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:9509\r\nConnection: close\r\nAccept: application/json\r\n\r\n"
        )
    };
    stream
        .write_all(request.as_bytes())
        .map_err(|err| format!("write bridge request failed: {err}"))?;

    let mut raw = Vec::new();
    let mut chunk = [0_u8; 8192];
    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => raw.extend_from_slice(&chunk[..n]),
            Err(err) if matches!(err.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) && !raw.is_empty() => {
                break;
            }
            Err(err) => return Err(format!("read bridge response failed: {err}")),
        }
    }
    let text = String::from_utf8_lossy(&raw);
    let (head, body) = text
        .split_once("\r\n\r\n")
        .ok_or_else(|| "invalid bridge HTTP response".to_string())?;
    let status = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .ok_or_else(|| "missing bridge HTTP status".to_string())?;

    Ok(LocalBridgeResponse {
        status,
        body: body.to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![local_bridge_get])
        .setup(|app| {
            // ─── Sidecar: meem-bridge ─────────────────────────────────
            // Bundled Node-compatible runtime + server compiled by `bun build --compile`.
            // Listens on 127.0.0.1:9509.
            match app.shell().sidecar("meem-bridge") {
                Ok(cmd) => {
                    let (mut rx, _child) = cmd.spawn().expect("failed to spawn meem-bridge");
                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(line) => {
                                    eprintln!("[bridge] {}", String::from_utf8_lossy(&line).trim_end());
                                }
                                CommandEvent::Stderr(line) => {
                                    eprintln!("[bridge!] {}", String::from_utf8_lossy(&line).trim_end());
                                }
                                CommandEvent::Terminated(payload) => {
                                    eprintln!("[bridge] terminated: {:?}", payload);
                                    break;
                                }
                                _ => {}
                            }
                        }
                    });
                }
                Err(err) => {
                    eprintln!("[bridge] sidecar lookup failed: {err}");
                }
            }

            // ─── Tray menu ──────────────────────────────────────────────
            let open_item = MenuItem::with_id(app, "open", "打开 Meem", true, None::<&str>)?;
            let agent_item = MenuItem::with_id(app, "open_agent", "智能体", true, None::<&str>)?;
            let separator_a = PredefinedMenuItem::separator(app)?;
            let separator_b = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出 Meem", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &open_item,
                    &separator_a,
                    &agent_item,
                    &separator_b,
                    &quit_item,
                ],
            )?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .tooltip("Meem")
                .icon(Image::new(include_bytes!("../icons/tray.rgba"), 64, 64))
                .icon_as_template(false)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app, None),
                    "open_agent" => show_main(app, Some("/")),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Meem desktop client")
        .run(|_app, event| {
            // Tauri kills child processes on Exit by default; this hook is here for future cleanup.
            if let RunEvent::ExitRequested { .. } = event {
                // no-op; sidecar will be reaped
            }
        });
}

/// Bring the main window forward, optionally navigating the SPA router to `route`.
fn show_main(app: &tauri::AppHandle, route: Option<&str>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
    if let Some(path) = route {
        let js = format!(
            "window.history.pushState({{}}, '', {path:?}); window.dispatchEvent(new PopStateEvent('popstate'));",
        );
        let _ = window.eval(&js);
    }
}
