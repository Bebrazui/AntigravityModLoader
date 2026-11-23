import base64

with open(r'c:\Users\ttt79\.antigravity-mods\dist\payload.zip', 'rb') as f:
    b64_data = base64.b64encode(f.read()).decode('ascii')

script_template = r'''#!/usr/bin/env bash
# Antigravity ModLoader - Self-contained All-in-One Installer

BANNER='
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
'

if [ -n "$SUDO_USER" ]; then
    USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    REAL_USER="$SUDO_USER"
else
    USER_HOME="$HOME"
    REAL_USER="$USER"
fi

MODS_DIR="$USER_HOME/.antigravity-mods"
SHIM_DIR="$MODS_DIR/shim"
CONFIG_CUSTOM="$MODS_DIR/custom_path.txt"

find_asar() {
    if [ -f "$CONFIG_CUSTOM" ]; then
        SAVED_P=$(cat "$CONFIG_CUSTOM" | tr -d '\r\n')
        if [ -n "$SAVED_P" ] && [ -f "$SAVED_P" ]; then
            echo "$SAVED_P"
            return
        fi
    fi

    if [ "$(uname)" == "Darwin" ]; then
        echo "/Applications/Antigravity.app/Contents/Resources/app.asar"
    else
        CANDIDATES=(
            "/opt/antigravity/resources/app.asar"
            "/opt/Antigravity/resources/app.asar"
            "/usr/lib/antigravity/resources/app.asar"
            "/usr/lib/Antigravity/resources/app.asar"
            "/usr/share/antigravity/resources/app.asar"
            "/usr/share/Antigravity/resources/app.asar"
            "$USER_HOME/.local/share/antigravity/resources/app.asar"
            "$USER_HOME/.local/share/Antigravity/resources/app.asar"
        )
        for p in "${CANDIDATES[@]}"; do
            if [ -f "$p" ]; then
                echo "$p"
                return
            fi
        done
        echo ""
    fi
}

APP_ASAR=$(find_asar)

show_status() {
    echo "------------------------------------------------------------"
    echo "  Пользователь:        $REAL_USER ($USER_HOME)"
    echo "  Платформа:           $(uname -s)"
    if [ -n "$APP_ASAR" ] && [ -f "$APP_ASAR" ]; then
        echo "  Файл app.asar:       $APP_ASAR"
        if grep -Fq ".antigravity-mods" "$APP_ASAR" 2>/dev/null; then
            echo -e "  Статус модлоадера:   \033[32mАКТИВЕН / УСТАНОВЛЕН\033[0m"
        else
            echo -e "  Статус модлоадера:   \033[33mНЕ УСТАНОВЛЕН\033[0m"
        fi
    else
        echo -e "  Статус:              \033[31mAntigravity не обнаружена (пункт [4] для ручного пути)\033[0m"
    fi
    echo "------------------------------------------------------------"
}

set_custom_path() {
    echo ""
    echo "=== Указать пользовательский путь к Antigravity ==="
    echo "Примеры:"
    echo "  /opt/antigravity/resources/app.asar"
    echo "  /opt/antigravity"
    echo ""
    read -p "Введите путь: " user_path
    user_path=$(eval echo "$user_path" | tr -d '\r\n')

    if [ -z "$user_path" ]; then
        echo "Отмена."
        return
    fi

    if [ -d "$user_path" ]; then
        if [ -f "$user_path/resources/app.asar" ]; then
            user_path="$user_path/resources/app.asar"
        elif [ -f "$user_path/app.asar" ]; then
            user_path="$user_path/app.asar"
        fi
    fi

    if [ -f "$user_path" ]; then
        mkdir -p "$MODS_DIR"
        echo "$user_path" > "$CONFIG_CUSTOM"
        APP_ASAR="$user_path"
        echo -e "\033[32m[+] Путь сохранен: $APP_ASAR\033[0m"
    else
        echo -e "\033[31m[-] Файл не существует: $user_path\033[0m"
    fi
}

extract_embedded_payload() {
    echo "[*] Распаковка вшитых модулей в $MODS_DIR..."
    TMP_ZIP="$MODS_DIR/embedded_payload.zip"
    
    sed -n '/^__PAYLOAD_BEGIN__$/,/^__PAYLOAD_END__$/p' "$0" | grep -v '^__PAYLOAD_' | base64 -d > "$TMP_ZIP"

    if [ ! -s "$TMP_ZIP" ]; then
        echo -e "\033[31m[-] Ошибка декодирования встроенного архива.\033[0m"
        return 1
    fi

    if command -v unzip >/dev/null 2>&1; then
        unzip -q -o "$TMP_ZIP" -d "$MODS_DIR"
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import zipfile; zipfile.ZipFile('$TMP_ZIP').extractall('$MODS_DIR')"
    elif command -v node >/dev/null 2>&1; then
        node -e "
          const cp = require('child_process');
          try { cp.execSync('unzip -q -o \"$TMP_ZIP\" -d \"$MODS_DIR\"'); } catch(_) {}
        "
    fi

    rm -f "$TMP_ZIP"
}

do_install() {
    if [ -z "$APP_ASAR" ] || [ ! -f "$APP_ASAR" ]; then
        echo -e "\033[31m[-] Ошибка: Antigravity app.asar не найден.\033[0m"
        echo -e "Используйте пункт [4], чтобы указать путь вручную."
        return 1
    fi

    ASAR_DIR="$(dirname "$APP_ASAR")"
    if [ ! -w "$ASAR_DIR" ] || [ ! -w "$APP_ASAR" ]; then
        if [ "$EUID" -ne 0 ]; then
            echo -e "\033[33m[!] Требуются права суперпользователя для записи в $ASAR_DIR\033[0m"
            exec sudo bash "$0" "$@"
        fi
    fi

    mkdir -p "$MODS_DIR"
    mkdir -p "$SHIM_DIR"

    extract_embedded_payload

    if [ ! -f "$MODS_DIR/loader/auto-patcher.js" ]; then
        echo -e "\033[31m[-] Ошибка: модули не распаковались в $MODS_DIR\033[0m"
        return 1
    fi

    echo "[*] Создание резервной копии app.asar.original..."
    BACKUP_ASAR="${APP_ASAR}.original"
    if [ ! -f "$BACKUP_ASAR" ]; then
        cp "$APP_ASAR" "$BACKUP_ASAR"
    fi

    echo "[*] Генерация shim/h.js..."
    cat << EOF > "$SHIM_DIR/h.js"
// @ts-check
try {
  require('$MODS_DIR/loader/main-injector.js');
} catch (e) {
  try {
    require('fs').appendFileSync('$MODS_DIR/crash.log', '[HOOK_ERR] ' + (e.stack || e) + '\n');
  } catch (_) {}
}
EOF

    chown -R "$REAL_USER" "$MODS_DIR" 2>/dev/null || true

    echo "[*] Применение патча к $APP_ASAR..."
    if command -v node >/dev/null 2>&1; then
        node -e "
          const ap = require('$MODS_DIR/loader/auto-patcher.js');
          ap.setCustomAsarPath('$APP_ASAR');
          const res = ap.ensurePatched();
          if (res && res.success) {
            console.log('\x1b[32m[+] Модлоадер успешно установлен!\x1b[0m');
          } else {
            console.error('\x1b[31m[-] Ошибка патча:\x1b[0m', res);
            process.exit(1);
          }
        "
    else
        echo -e "\033[31m[-] Node.js не найден. Установите nodejs.\033[0m"
        return 1
    fi
}

do_uninstall() {
    BACKUP_ASAR="${APP_ASAR}.original"
    ASAR_DIR="$(dirname "$APP_ASAR")"
    if [ ! -w "$ASAR_DIR" ] || [ ! -w "$APP_ASAR" ]; then
        if [ "$EUID" -ne 0 ]; then
            echo -e "\033[33m[!] Требуются права суперпользователя для изменения файлов в $ASAR_DIR\033[0m"
            exec sudo bash "$0" "$@"
        fi
    fi

    if [ -f "$BACKUP_ASAR" ]; then
        cp "$BACKUP_ASAR" "$APP_ASAR"
        echo -e "\033[32m[+] app.asar успешно восстановлен из оригинала. Модлоадер удален.\033[0m"
    else
        echo -e "\033[31m[-] Резервная копия $BACKUP_ASAR не найдена.\033[0m"
    fi
}

if [ "$1" == "install" ]; then
    do_install
    exit $?
elif [ "$1" == "status" ]; then
    echo "$BANNER"
    show_status
    exit 0
elif [ "$1" == "uninstall" ]; then
    do_uninstall
    exit $?
fi

while true; do
    clear 2>/dev/null || true
    echo "$BANNER"
    show_status
    echo ""
    echo "  [1] Установить / Переустановить модлоадер"
    echo "  [2] Проверить статус и пути установки"
    echo "  [3] Удалить модлоадер (восстановить оригинальный app.asar)"
    echo "  [4] Указать свой путь к Antigravity (если не найдено)"
    echo "  [5] Выход"
    echo ""
    read -p "  Выберите действие [1-5]: " choice
    case "$choice" in
        1)
            echo ""
            do_install
            read -p "Нажмите Enter для продолжения..."
            ;;
        2)
            echo ""
            show_status
            read -p "Нажмите Enter для продолжения..."
            ;;
        3)
            echo ""
            do_uninstall
            read -p "Нажмите Enter для продолжения..."
            ;;
        4)
            set_custom_path
            APP_ASAR=$(find_asar)
            read -p "Нажмите Enter для продолжения..."
            ;;
        5|q|exit)
            echo "Выход."
            break
            ;;
        *)
            echo "Неверный выбор."
            sleep 1
            ;;
    esac
done
exit 0

__PAYLOAD_BEGIN__
'''

full_script = script_template + b64_data + '\n__PAYLOAD_END__\n'
full_script = full_script.replace('\r\n', '\n')

with open(r'c:\Users\ttt79\.antigravity-mods\dist\install.sh', 'w', encoding='utf-8', newline='\n') as f:
    f.write(full_script)

with open(r'C:\Users\ttt79\Downloads\install.sh', 'w', encoding='utf-8', newline='\n') as f:
    f.write(full_script)

print('Generated clean install.sh, size:', len(full_script))
