# Antigravity ModLoader

<div align="center">

```text
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
```

**Легковесный, быстрый и современный загрузчик модов для Google Antigravity.**
Кроссплатформенная поддержка Windows, Linux и macOS с автоматическим обходом ограничений и поддержкой автообновлений.

[![Release](https://img.shields.io/github/v/release/Bebrazui/AntigravityModLoader?color=blue&style=flat-square)](https://github.com/Bebrazui/AntigravityModLoader/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-informational?style=flat-square)](#установка)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

</div>

---

## ⚡ Особенности

- 🌐 **Автономный DoH/DoT Прокси (`dns-ai-proxy`)**: Полный обход региональных блокировок доступа к моделям Gemini и PaLM без сторонних VPN. Включает TLS-рукопожатие и умный отбор европейских узлов.
- 🛠️ **Chromium DevTools (`f12-devtools`)**: Полноценная консоль разработчика по клавише `F12` и `Ctrl+Shift+I` в packaged-билдах Electron.
- 📊 **Live Context Radar (`context-radar`)**: Живой мониторинг размера контекстного окна, токенов запроса и плотности кэша в интерфейсе чата.
- 🔄 **Сваппер аккаунтов (`account-switcher`)**: Мгновенное переключение профилей и Google-аккаунтов в один клик.
- 🧩 **Менеджер модов (`core-mod-manager`)**: Встроенная вкладка «Моды» прямо в навигационной панели Antigravity для управления расширениями.
- 🚀 **Автообновление из коробки**: Загрузчик автоматически проверяет свежие релизы на GitHub и тихо обновляет ядро модов без перезаписи настроек пользователя.

---

## 📥 Установка

### Linux / macOS
Установка в один файл:
```bash
curl -fsSL https://raw.githubusercontent.com/Bebrazui/AntigravityModLoader/main/dist/install.sh -o install.sh
chmod +x install.sh
./install.sh
```
*Скрипт автоматически найдёт путь к `app.asar`, создаст резервную копию и применит безопасный хук.*

### Windows
Скачайте готовый установщик из раздела [Releases](https://github.com/Bebrazui/AntigravityModLoader/releases):
- **Графический установщик**: `AntigravityModLoaderSetup.exe` (премиальный интерфейс, сводка статуса, открытие каталога в проводнике).
- **Консольный CLI**: `antigravity-modloader-cli.exe` (для скриптов и терминала).

---

## 🎮 Использование CLI

```bash
# Проверить статус установки и пути
antigravity-modloader-cli status

# Установить или обновить модлоадер
antigravity-modloader-cli install

# Откатить app.asar до чистого оригинала
antigravity-modloader-cli uninstall
```

---

## 📂 Структура репозитория

```text
├── dist/                     # Готовые дистрибутивы (All-in-One install.sh, CLI, архивы)
├── installer-rs/             # Исходный код нативного установщика на Rust (Wry / WebKit / Tao)
├── loader/                   # Ядро загрузчика (инжектор Electron, registry, автопатчер, updater)
├── mods/                     # Модули расширений
│   ├── account-switcher/     # Мод быстрого переключения аккаунтов
│   ├── context-radar/        # Мод радара токенов и контекста
│   ├── core-mod-manager/     # Графический интерфейс управления модами
│   ├── dns-ai-proxy/         # Автономный прокси DoH/DoT
│   └── f12-devtools/         # Мод активации F12
└── version.json              # Текущая версия сборки
```

---

## 📜 Лицензия
Распространяется под лицензией MIT.
