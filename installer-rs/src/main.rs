#![windows_subsystem = "windows"]

use std::fs::{self, File};
use std::io::{self, Cursor, Read};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use tao::window::{WindowBuilder, WindowId};
use std::sync::Arc;
use wry::dpi::LogicalSize;
use wry::WebViewBuilder;
use http::Request;

#[cfg(target_os = "windows")]
use tao::platform::windows::{WindowBuilderExtWindows, WindowExtWindows};

#[cfg(target_os = "windows")]
fn suppress_window_border(hwnd: isize) {
    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: isize,
            dwAttribute: u32,
            pvAttribute: *const std::ffi::c_void,
            cbAttribute: u32,
        ) -> i32;
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetWindowLongW(hwnd: isize, nIndex: i32) -> i32;
        fn SetWindowLongW(hwnd: isize, nIndex: i32, dwNewLong: i32) -> i32;
        fn SetWindowPos(
            hwnd: isize,
            hWndInsertAfter: isize,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            uFlags: u32,
        ) -> i32;
    }

    unsafe {
        const GWL_STYLE: i32 = -16;
        const GWL_EXSTYLE: i32 = -20;
        const WS_CAPTION: i32 = 0x00C00000;
        const WS_THICKFRAME: i32 = 0x00040000;
        const WS_BORDER: i32 = 0x00800000;
        const WS_DLGFRAME: i32 = 0x00400000;
        const WS_EX_WINDOWEDGE: i32 = 0x00000100;
        const WS_EX_CLIENTEDGE: i32 = 0x00000200;
        const WS_EX_STATICEDGE: i32 = 0x00020000;
        const SWP_FRAMECHANGED: u32 = 0x0020;
        const SWP_NOMOVE: u32 = 0x0002;
        const SWP_NOSIZE: u32 = 0x0001;
        const SWP_NOZORDER: u32 = 0x0004;
        const SWP_NOACTIVATE: u32 = 0x0010;

        // Принудительно вырезаем все стили рамок и заголовков Win32
        let current_style = GetWindowLongW(hwnd, GWL_STYLE);
        let new_style = current_style & !(WS_CAPTION | WS_THICKFRAME | WS_BORDER | WS_DLGFRAME);
        SetWindowLongW(hwnd, GWL_STYLE, new_style);

        let current_ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        let new_ex_style = current_ex_style & !(WS_EX_WINDOWEDGE | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE);
        SetWindowLongW(hwnd, GWL_EXSTYLE, new_ex_style);

        SetWindowPos(
            hwnd,
            0,
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        );

        // DWMWA_BORDER_COLOR = 34 -> 0xFFFFFFFE (DWMWA_COLOR_NONE, полностью скрывает системную границу)
        let border_color: u32 = 0xFFFFFFFE;
        DwmSetWindowAttribute(
            hwnd,
            34,
            &border_color as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<u32>() as u32,
        );

        // DWMWA_WINDOW_CORNER_PREFERENCE = 33 -> 2 (DWMWCP_ROUND)
        let corner: u32 = 2;
        DwmSetWindowAttribute(
            hwnd,
            33,
            &corner as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<u32>() as u32,
        );
    }
}

#[cfg(target_os = "windows")]
const WEBVIEW2_LOADER_DLL: &[u8] = include_bytes!("../WebView2Loader.dll");

#[cfg(target_os = "windows")]
fn ensure_webview2_loader() {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let target_dll = exe_dir.join("WebView2Loader.dll");
            if !target_dll.exists() {
                let _ = std::fs::write(&target_dll, WEBVIEW2_LOADER_DLL);
            }
        }
    }
}

const PAYLOAD_ZIP: &[u8] = include_bytes!("../bundle/payload.zip");

#[derive(Serialize, Deserialize, Clone)]
struct InstallStatus {
    platform: String,
    found: bool,
    install_dir: String,
    app_asar: String,
    is_patched: bool,
    message: String,
}

/// Поиск каталога Antigravity и app.asar на разных платформах
fn resolve_paths() -> (Option<PathBuf>, Option<PathBuf>, &'static str) {
    if cfg!(target_os = "windows") {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let base = PathBuf::from(local_app_data).join("Programs").join("antigravity");
            let asar = base.join("resources").join("app.asar");
            if asar.exists() {
                return (Some(base), Some(asar), "windows");
            }
        }
        (None, None, "windows")
    } else if cfg!(target_os = "macos") {
        let app_path = PathBuf::from("/Applications/Antigravity.app");
        let asar = app_path.join("Contents").join("Resources").join("app.asar");
        if asar.exists() {
            (Some(app_path), Some(asar), "macos")
        } else {
            (None, None, "macos")
        }
    } else {
        let paths = [
            "/opt/antigravity/resources/app.asar",
            "/opt/Antigravity/resources/app.asar",
            "/usr/lib/antigravity/resources/app.asar",
            "/usr/lib/Antigravity/resources/app.asar",
            "/usr/share/antigravity/resources/app.asar",
            "/usr/share/Antigravity/resources/app.asar",
        ];
        for p in paths {
            let asar = PathBuf::from(p);
            if asar.exists() {
                let dir = asar.parent().and_then(|p| p.parent()).map(PathBuf::from);
                return (dir, Some(asar), "linux");
            }
        }
        if let Some(home) = std::env::var_os("HOME") {
            let user_candidates = [
                PathBuf::from(&home).join(".local").join("share").join("antigravity").join("resources").join("app.asar"),
                PathBuf::from(&home).join(".local").join("share").join("Antigravity").join("resources").join("app.asar"),
            ];
            for user_asar in user_candidates {
                if user_asar.exists() {
                    let dir = user_asar.parent().and_then(|p| p.parent()).map(PathBuf::from);
                    return (dir, Some(user_asar), "linux");
                }
            }
        }
        (None, None, "linux")
    }
}

/// Проверка, пропатчен ли уже app.asar
fn check_is_patched(asar_path: &Path) -> bool {
    if let Ok(mut file) = File::open(asar_path) {
        let mut buf = Vec::new();
        if file.read_to_end(&mut buf).is_ok() {
            let s = String::from_utf8_lossy(&buf);
            return s.contains(".antigravity-mods") || s.contains("shim/h.js");
        }
    }
    false
}

/// Распаковка вшитого полезного груза (payload.zip) в ~/.antigravity-mods
fn extract_payload() -> io::Result<()> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Home directory not found"))?;

    let target_dir = home.join(".antigravity-mods");
    fs::create_dir_all(&target_dir)?;

    let reader = Cursor::new(PAYLOAD_ZIP);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
        
        let outpath = match file.enclosed_name() {
            Some(path) => target_dir.join(path),
            None => continue,
        };

        if file.is_dir() {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)?;
                }
            }
            let mut outfile = File::create(&outpath)?;
            io::copy(&mut file, &mut outfile)?;
        }
    }

    let shim_dir = target_dir.join("shim");
    fs::create_dir_all(&shim_dir)?;
    let main_injector = target_dir.join("loader").join("main-injector.js");
    let main_inj_str = main_injector.to_string_lossy().replace('\\', "/");
    let crash_log_str = target_dir.join("crash.log").to_string_lossy().replace('\\', "/");

    let shim_content = format!(
        "// @ts-check\ntry {{\n  require('{}');\n}} catch (e) {{\n  try {{\n    require('fs').appendFileSync('{}', '[HOOK_ERR] ' + (e.stack || e) + '\\n');\n  }} catch (_) {{}}\n}}\n",
        main_inj_str, crash_log_str
    );
    fs::write(shim_dir.join("h.js"), shim_content)?;

    Ok(())
}

/// Поиск слота для инжекции
fn find_injection_slot(data: &[u8]) -> Option<(usize, usize)> {
    let anchors = [
        "if (!gotTheLock) {\n    electron_1.app.quit();\n    process.exit(0);\n}\n",
        "if (!gotTheLock) {\r\n    electron_1.app.quit();\r\n    process.exit(0);\r\n}\r\n"
    ];

    for anchor in anchors {
        if let Some(pos) = data.windows(anchor.len()).position(|w| w == anchor.as_bytes()) {
            let slot_pos = pos + anchor.len();
            if slot_pos + 250 <= data.len() {
                let slice = String::from_utf8_lossy(&data[slot_pos..slot_pos + 250]);
                if slice.starts_with("//") {
                    let mut len = 166;
                    if let Some(idx) = slice.find("\nlet ") {
                        len = idx + 1;
                    } else if let Some(idx) = slice.find("\r\nlet ") {
                        len = idx + 2;
                    }
                    return Some((slot_pos, len));
                }
            }
        }
    }
    None
}

fn patch_debug_console(data: &mut [u8]) -> bool {
    let target = b"isDebugConsoleEnabled=!1";
    let replace = b"isDebugConsoleEnabled=!0";
    if let Some(pos) = data.windows(target.len()).position(|w| w == target) {
        data[pos..pos + target.len()].copy_from_slice(replace);
        return true;
    }
    false
}

fn apply_patch() -> Result<String, String> {
    let (_, asar_opt, _) = resolve_paths();
    let asar_path = asar_opt.ok_or("Не найден файл app.asar. Убедитесь, что Antigravity установлен.")?;

    extract_payload().map_err(|e| format!("Ошибка распаковки модулей: {}", e))?;

    let backup_path = asar_path.with_extension("asar.original");
    if !backup_path.exists() {
        fs::copy(&asar_path, &backup_path)
            .map_err(|e| format!("Не удалось создать резервную копию app.asar.original: {}", e))?;
    }

    let mut data = fs::read(&asar_path)
        .map_err(|e| format!("Не удалось прочитать app.asar: {}", e))?;

    let (slot_pos, slot_len) = find_injection_slot(&data)
        .ok_or("Не найдена сигнатура точки входа в app.asar. Возможно, версия не поддерживается.")?;

    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .ok_or("Не найдена домашняя директория")?;
    let shim_h = home.join(".antigravity-mods").join("shim").join("h.js");
    let shim_str = shim_h.to_string_lossy().replace('\\', "/");

    let payload_code = format!("try{{require('{}');}}catch(_e){{}}", shim_str);
    if payload_code.len() > slot_len {
        return Err(format!("Код инжектора ({} байт) превышает размер слота ({} байт)", payload_code.len(), slot_len));
    }

    let mut padded = payload_code.into_bytes();
    while padded.len() < slot_len {
        padded.push(b' ');
    }

    data[slot_pos..slot_pos + slot_len].copy_from_slice(&padded);
    patch_debug_console(&mut data);

    fs::write(&asar_path, &data)
        .map_err(|e| format!("Не удалось записать пропатченный app.asar (возможно, Antigravity запущен): {}", e))?;

    Ok("Antigravity ModLoader успешно установлен и активирован!".to_string())
}

fn restore_original() -> Result<String, String> {
    let (_, asar_opt, _) = resolve_paths();
    let asar_path = asar_opt.ok_or("Не найден файл app.asar")?;
    let backup_path = asar_path.with_extension("asar.original");

    if !backup_path.exists() {
        return Err("Резервная копия app.asar.original не найдена!".to_string());
    }

    fs::copy(&backup_path, &asar_path)
        .map_err(|e| format!("Не удалось восстановить app.asar: {}", e))?;

    Ok("Оригинальный app.asar успешно восстановлен!".to_string())
}

fn get_status() -> InstallStatus {
    let (dir_opt, asar_opt, _) = resolve_paths();
    let found = asar_opt.is_some();
    let app_asar = asar_opt.map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    let install_dir = dir_opt.map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    let is_patched = if found {
        check_is_patched(Path::new(&app_asar))
    } else {
        false
    };

    InstallStatus {
        platform: std::env::consts::OS.to_string(),
        found,
        install_dir,
        app_asar,
        is_patched,
        message: if is_patched { "Установлен и активен".to_string() } else { "Не установлен".to_string() },
    }
}

const UI_NOT_INSTALLED: &str = include_str!("installer_ui.html");
const UI_INSTALLED: &str = include_str!("installer_ui_installed.html");

fn render_html(status: &InstallStatus) -> String {
    if status.is_patched {
        UI_INSTALLED.to_string()
    } else {
        UI_NOT_INSTALLED.to_string()
    }
}

/// Запуск безрамочного нативного GUI окна
fn run_native_gui() {
    let event_loop = EventLoop::new();

    // Создаем полностью безрамочное окно без тени (тень вызывает 1px белую линию на Windows 11)
    let mut builder = WindowBuilder::new()
        .with_title("Antigravity ModLoader")
        .with_inner_size(LogicalSize::new(500.0, 660.0))
        .with_resizable(false)
        .with_decorations(false)
        .with_transparent(false)
        .with_visible(false);

    #[cfg(target_os = "windows")]
    {
        builder = builder.with_undecorated_shadow(false);
    }

    let window = Arc::new(builder.build(&event_loop).expect("Не удалось создать нативное окно"));

    #[cfg(target_os = "windows")]
    suppress_window_border(window.hwnd());

    let status = get_status();
    let html_content = render_html(&status);

    let window_for_ipc = Arc::clone(&window);
    let webview = WebViewBuilder::new()
        .with_html(html_content)
        .with_background_color((2, 6, 11, 255))
        .with_ipc_handler(move |req: Request<String>| {
            let body = req.body().trim();
            let action = if body.starts_with('{') {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(body) {
                    v.get("action").and_then(|a| a.as_str()).unwrap_or("install").to_string()
                } else {
                    "install".to_string()
                }
            } else {
                body.to_string()
            };

            match action.as_str() {
                "close" => {
                    std::process::exit(0);
                }
                "minimize" => {
                    window_for_ipc.set_minimized(true);
                }
                "explore_mods" => {
                    let home = std::env::var_os("USERPROFILE")
                        .or_else(|| std::env::var_os("HOME"))
                        .map(std::path::PathBuf::from);
                    if let Some(h) = home {
                        let mods_dir = h.join(".antigravity-mods").join("mods");
                        if cfg!(target_os = "windows") {
                            let _ = std::process::Command::new("explorer").arg(mods_dir).spawn();
                        } else if cfg!(target_os = "macos") {
                            let _ = std::process::Command::new("open").arg(mods_dir).spawn();
                        } else {
                            let _ = std::process::Command::new("xdg-open").arg(mods_dir).spawn();
                        }
                    }
                }
                "launch_app" => {
                    if cfg!(target_os = "windows") {
                        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
                            let exe = std::path::PathBuf::from(local_app_data)
                                .join("Programs")
                                .join("antigravity")
                                .join("Antigravity.exe");
                            if exe.exists() {
                                let _ = std::process::Command::new(exe).spawn();
                            }
                        }
                    } else if cfg!(target_os = "macos") {
                        let _ = std::process::Command::new("open").arg("-a").arg("Antigravity").spawn();
                    } else {
                        let _ = std::process::Command::new("antigravity").spawn();
                    }
                }
                "install" => {
                    let (success, text) = match apply_patch() {
                        Ok(m) => (true, m),
                        Err(e) => (false, e),
                    };
                    eprintln!("[IPC] install -> success: {}, msg: {}", success, text);
                }
                "uninstall" => {
                    let (success, text) = match restore_original() {
                        Ok(m) => (true, m),
                        Err(e) => (false, e),
                    };
                    eprintln!("[IPC] uninstall -> success: {}, msg: {}", success, text);
                }
                _ => ()
            }
        })
        .build(&*window)
        .expect("Не удалось инициализировать WebView");

    window.set_visible(true);

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;

        match event {
            Event::WindowEvent { event, .. } => match event {
                WindowEvent::CloseRequested => *control_flow = ControlFlow::Exit,
                _ => (),
            },
            _ => {
                let _ = &webview;
            }
        }
    });
}

fn main() {
    #[cfg(target_os = "windows")]
    ensure_webview2_loader();

    let args: Vec<String> = std::env::args().collect();
    let cmd = args.get(1).map(|s| s.as_str()).unwrap_or("gui");

    match cmd {
        "install" | "--install" | "-i" => {
            println!("[*] Установка Antigravity ModLoader...");
            match apply_patch() {
                Ok(msg) => println!("[OK] {}", msg),
                Err(err) => {
                    eprintln!("[ERROR] {}", err);
                    std::process::exit(1);
                }
            }
        }
        "uninstall" | "--uninstall" | "-u" => {
            println!("[*] Восстановление оригинального Antigravity...");
            match restore_original() {
                Ok(msg) => println!("[OK] {}", msg),
                Err(err) => {
                    eprintln!("[ERROR] {}", err);
                    std::process::exit(1);
                }
            }
        }
        "status" | "--status" | "-s" => {
            let status = get_status();
            println!("====================================================");
            println!("       Antigravity ModLoader Setup (Rust)           ");
            println!("====================================================");
            println!("Платформа:  {}", status.platform);
            println!("Статус:     {}", if status.found { "Найден Antigravity" } else { "Не найден" });
            println!("Каталог:    {}", status.install_dir);
            println!("app.asar:   {}", status.app_asar);
            println!("Модлоадер:  {}", if status.is_patched { "УСТАНОВЛЕН (Активен)" } else { "НЕ УСТАНОВЛЕН" });
            println!("====================================================");
        }
        _ => {
            run_native_gui();
        }
    }
}
