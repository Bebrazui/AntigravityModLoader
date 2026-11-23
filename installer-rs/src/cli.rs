use std::fs::{self, File};
use std::io::{self, Cursor, Read, Write};
use std::path::{Path, PathBuf};

const PAYLOAD_ZIP: &[u8] = include_bytes!("../bundle/payload.zip");

const BANNER: &str = r#"
   /$$$$$$                              /$$      /$$                 /$$ /$$                                 /$$                    
 /$$__  $$                            | $$$    /$$$                | $$| $$                                | $$                    
| $$  \ $$  /$$$$$$  /$$   /$$        | $$$$  /$$$$  /$$$$$$   /$$$$$$$| $$        /$$$$$$   /$$$$$$   /$$$$$$$  /$$$$$$   /$$$$$$ 
| $$$$$$$$ /$$__  $$| $$  | $$ /$$$$$$| $$ $$/$$ $$ /$$__  $$ /$$__  $$| $$       /$$__  $$ |____  $$ /$$__  $$ /$$__  $$ /$$__  $$
| $$__  $$| $$  \ $$| $$  | $$|______/| $$  $$$| $$| $$  \ $$| $$  | $$| $$      | $$  \ $$  /$$$$$$$| $$  | $$| $$$$$$$$| $$  \__/
| $$  | $$| $$  | $$| $$  | $$        | $$\  $ | $$| $$  | $$| $$  | $$| $$      | $$  | $$ /$$__  $$| $$  | $$| $$_____/| $$      
| $$  | $$|  $$$$$$$|  $$$$$$$        | $$ \/  | $$|  $$$$$$/|  $$$$$$$| $$$$$$$$|  $$$$$$/|  $$$$$$$|  $$$$$$$|  $$$$$$$| $$      
|__/  |__/ \____  $$ \____  $$        |__/     |__/ \______/  \_______/|________/ \______/  \_______/ \_______/ \_______/|__/      
           /$$  \ $$ /$$  | $$                                                                                                     
          |  $$$$$$/|  $$$$$$/                                                                                                     
           \______/  \______/                                                                                                      
"#;

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
    let asar_path = asar_opt.ok_or("Не найден файл app.asar. Убедитесь, что Antigravity установлена.")?;

    println!("[*] Распаковка файлов модлоадера в ~/.antigravity-mods...");
    extract_payload().map_err(|e| format!("Ошибка распаковки модулей: {}", e))?;

    let backup_path = asar_path.with_extension("asar.original");
    if !backup_path.exists() {
        println!("[*] Создание резервной копии app.asar.original...");
        fs::copy(&asar_path, &backup_path)
            .map_err(|e| format!("Не удалось создать резервную копию app.asar.original: {}", e))?;
    }

    println!("[*] Чтение {}...", asar_path.display());
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
    let mut patch_bytes = payload_code.into_bytes();

    if patch_bytes.len() > slot_len {
        return Err(format!(
            "Код инжекции ({} байт) превышает размер слота ({} байт)",
            patch_bytes.len(),
            slot_len
        ));
    }

    patch_bytes.extend_from_slice(b"// ");
    while patch_bytes.len() < slot_len - 1 {
        patch_bytes.push(b'-');
    }
    patch_bytes.push(b'\n');

    data[slot_pos..slot_pos + slot_len].copy_from_slice(&patch_bytes);
    let devtools_unlocked = patch_debug_console(&mut data);

    fs::write(&asar_path, &data)
        .map_err(|e| format!("Не удалось записать пропатченный app.asar: {}", e))?;

    let dt_status = if devtools_unlocked { " (DevTools F12 активирован)" } else { "" };
    Ok(format!("Модлоадер успешно установлен в {}{}", asar_path.display(), dt_status))
}

fn restore_original() -> Result<String, String> {
    let (_, asar_opt, _) = resolve_paths();
    let asar_path = asar_opt.ok_or("Не найден файл app.asar")?;
    let backup_path = asar_path.with_extension("asar.original");

    if !backup_path.exists() {
        return Err("Резервная копия app.asar.original не найдена. Восстановление невозможно.".to_string());
    }

    fs::copy(&backup_path, &asar_path)
        .map_err(|e| format!("Ошибка восстановления из резервной копии: {}", e))?;

    Ok("Модлоадер успешно удален. app.asar восстановлен до оригинального состояния.".to_string())
}

fn show_status() {
    let (dir_opt, asar_opt, os_name) = resolve_paths();
    println!("------------------------------------------------------------");
    println!("  Платформа:           {}", os_name);
    match (dir_opt, asar_opt) {
        (Some(dir), Some(asar)) => {
            println!("  Каталог Antigravity: {}", dir.display());
            println!("  Файл app.asar:       {}", asar.display());
            let patched = check_is_patched(&asar);
            let state = if patched { "\x1b[32mАКТИВЕН / УСТАНОВЛЕН\x1b[0m" } else { "\x1b[33mНЕ УСТАНОВЛЕН\x1b[0m" };
            println!("  Статус модлоадера:   {}", state);
        }
        _ => {
            println!("  Статус:              \x1b[31mAntigravity не обнаружена в стандартных путях\x1b[0m");
        }
    }
    println!("------------------------------------------------------------");
}

fn prompt_menu() {
    loop {
        println!("{}", BANNER);
        show_status();
        println!();
        println!("  [1] Установить / Переустановить модлоадер");
        println!("  [2] Проверить статус и пути установки");
        println!("  [3] Удалить модлоадер (восстановить оригинальный app.asar)");
        println!("  [4] Выход");
        println!();
        print!("  Выберите действие [1-4]: ");
        let _ = io::stdout().flush();

        let mut input = String::new();
        if io::stdin().read_line(&mut input).is_err() {
            break;
        }

        match input.trim() {
            "1" => {
                println!("\n>>> Запуск установки...");
                match apply_patch() {
                    Ok(m) => println!("\x1b[32m[+] {}\x1b[0m\n", m),
                    Err(e) => eprintln!("\x1b[31m[-] {}\x1b[0m\n", e),
                }
            }
            "2" => {
                println!();
                show_status();
                println!();
            }
            "3" => {
                println!("\n>>> Откат до оригинального app.asar...");
                match restore_original() {
                    Ok(m) => println!("\x1b[32m[+] {}\x1b[0m\n", m),
                    Err(e) => eprintln!("\x1b[31m[-] {}\x1b[0m\n", e),
                }
            }
            "4" | "q" | "exit" => {
                println!("\nВыход.");
                break;
            }
            _ => {
                println!("\x1b[33mНеверный выбор. Введите число от 1 до 4.\x1b[0m\n");
            }
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        match args[1].as_str() {
            "install" => match apply_patch() {
                Ok(m) => println!("[+] {}", m),
                Err(e) => { eprintln!("[-] {}", e); std::process::exit(1); }
            },
            "status" => {
                println!("{}", BANNER);
                show_status();
            },
            "uninstall" => match restore_original() {
                Ok(m) => println!("[+] {}", m),
                Err(e) => { eprintln!("[-] {}", e); std::process::exit(1); }
            },
            "-h" | "--help" | "help" => {
                println!("{}", BANNER);
                println!("Использование: antigravity-modloader-cli [install|status|uninstall]");
            },
            other => {
                eprintln!("Неизвестный аргумент: {}", other);
                std::process::exit(1);
            }
        }
    } else {
        prompt_menu();
    }
}
