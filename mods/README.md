# Руководство по разработке модов для Google Antigravity (ModLoader)

Данное руководство описывает архитектуру загрузчика модов Antigravity, структуру файлов мода, работу с API (Main Process, Renderer Process, стили) и создание интерактивных настроек.

---

## 📁 Структура каталогов

Все моды размещаются в директории:
`%USERPROFILE%\.antigravity-mods\mods\<имя-мода>\` (например: `C:\Users\<user>\.antigravity-mods\mods\my-custom-mod\`)

```text
C:\Users\<user>\.antigravity-mods\
├── config.json               # Глобальный конфиг (список отключенных модов, сохранённые настройки)
├── loader\                   # Движок инжектора (main-injector.js, registry.js, preload-injector.js)
└── mods\                     # Каталог модов
    └── my-custom-mod\        # Папка вашего мода
        ├── manifest.json     # (Обязательно) Манифест мода и схема настроек
        ├── main.js           # (Опционально) Скрипт основного процесса (Node.js / Electron)
        ├── renderer.js       # (Опционально) Скрипт окна интерфейса (DOM / Browser)
        └── style.css         # (Опционально) Стили CSS
```

---

## 1. Манифест мода (`manifest.json`)

Файл `manifest.json` определяет метаданные и настройки, которые автоматически рендерятся в **Core Mod Manager** (в боковой панели Antigravity).

```json
{
  "id": "my-custom-mod",
  "name": "My Custom Mod",
  "version": "1.0.0",
  "author": "Ваше имя",
  "description": "Краткое описание того, что делает этот мод",
  "main": "main.js",
  "renderer": "renderer.js",
  "styles": [
    "style.css"
  ],
  "settings": {
    "featureEnabled": {
      "title": "Включить функцию",
      "description": "Описание назначения переключателя",
      "type": "boolean",
      "default": true
    },
    "serverUrl": {
      "title": "Адрес сервера",
      "description": "Хост или URL для подключения",
      "type": "text",
      "default": "127.0.0.1"
    },
    "port": {
      "title": "Порт",
      "description": "Числовой порт подключения",
      "type": "number",
      "default": 8080,
      "min": 1,
      "max": 65535
    },
    "mode": {
      "title": "Режим работы",
      "description": "Выбор режима из списка",
      "type": "select",
      "default": "fast",
      "options": [
        { "value": "fast", "label": "Быстрый" },
        { "value": "secure", "label": "Безопасный" }
      ]
    }
  }
}
```

### Поддерживаемые типы настроек:
- `boolean`: Рендерится как стилизованный тумблер (toggle switch).
- `text`: Текстовое поле ввода.
- `number`: Числовое поле с поддержкой `min` и `max`.
- `select`: Выпадающий список с массивом объектов `{ "value": "...", "label": "..." }`.

---

## 2. Основной процесс (`main.js`)

Выполняется в среде **Node.js** главного процесса Electron при старте Antigravity. Имеет полный доступ к системным API, файловой системе, сетевым сессиям и IPC.

### Сигнатура:
```javascript
// @ts-check
module.exports = function(api, mod) {
  // api содержит:
  // - api.app (Electron App)
  // - api.BrowserWindow
  // - api.session (Electron Session)
  // - api.net (Electron Net)
  // - api.ipcMain
  // - api.registerIpcHandler(channel, handler)
  
  // mod содержит данные из manifest.json:
  // - mod.id, mod.name, mod.dir, mod.settings и т.д.

  console.log(`[${mod.name}] Инициализация main.js`);

  // Чтение настроек мода
  const { getConfig } = require('../../loader/registry');
  const cfg = getConfig();
  const settings = (cfg.modSettings && cfg.modSettings[mod.id]) || {};

  // Регистрация пользовательского IPC обработчика
  api.registerIpcHandler('my-action', async (event, payload) => {
    return { success: true, received: payload };
  });

  // Пример: управление сетевой сессией Electron
  if (api.session && api.session.defaultSession) {
    // api.session.defaultSession.setProxy(...)
  }
};
```

---

## 3. Скрипт интерфейса (`renderer.js`)

Выполняется в браузере (рендерере интерфейса Antigravity) после загрузки DOM. Имеет доступ к объекту `window.ModAPI`.

```javascript
// @ts-check
(function() {
  console.log('[MyMod] Renderer загружен');

  // 1. Чтение сохраненных настроек в UI:
  if (window.ModAPI) {
    const isEnabled = window.ModAPI.getSetting('my-custom-mod', 'featureEnabled', true);
    const serverUrl = window.ModAPI.getSetting('my-custom-mod', 'serverUrl', '127.0.0.1');
    console.log('Текущие настройки:', { isEnabled, serverUrl });
  }

  // 2. Вызов IPC-обработчика из main.js:
  async function callBackend() {
    if (window.ModAPI && window.ModAPI.invokeMain) {
      const result = await window.ModAPI.invokeMain('my-action', { foo: 'bar' });
      console.log('Ответ от main.js:', result);
    }
  }

  // 3. Добавление своих элементов в DOM интерфейса:
  const myBtn = document.createElement('button');
  myBtn.className = 'my-custom-btn';
  myBtn.textContent = 'Моя кнопка';
  myBtn.addEventListener('click', callBackend);
  document.body.appendChild(myBtn);
})();
```

### Методы `window.ModAPI` в Renderer:
- `window.ModAPI.getSetting(modId, key, fallback)` — получить сохранённое значение настройки.
- `window.ModAPI.invokeMain(channel, ...args)` — вызвать зарегистрированный обработчик в `main.js`.
- `window.ModAPI.injectCSS(id, css)` — динамически встроить CSS.
- `window.ModAPI.getLoadedMods()` — получить список активных модов.

---

## 4. Стили (`style.css`)

Все файлы стилей, перечисленные в массиве `"styles"` в `manifest.json`, автоматически инжектятся в окно приложения при старте и перезагрузке.

```css
/* Пример кастомизации UI */
.my-custom-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(24, 24, 27, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #FAFAFA;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  z-index: 10000;
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

.my-custom-btn:hover {
  background: #3B82F6;
  border-color: #60A5FA;
}
```

---

## 5. Управление и отладка

1. **Включение / Отключение мода**:
   - Нажмите иконку **🧩 (Mod Manager)** на боковой панели слева снизу.
   - Переключите тумблер напротив вашего мода.
   - Измените нужные параметры в шестерёнке ⚙️.
   - Нажмите **Apply & Reload** в шапке окна для применения изменений.

2. **Логи и отладка**:
   - Логи падений и загрузчика пишутся в: `C:\Users\<user>\.antigravity-mods\crash.log`.
   - Логи `console.log` из `renderer.js` доступны в DevTools Electron (`Ctrl+Shift+I` или `F12`).
