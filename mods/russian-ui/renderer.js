// @ts-check
// ============================================================================
//  russian-ui v3.1 — Безопасный перевод интерфейса Antigravity (Полный словарь)
//  • Без склеек предложений и без затирания соседних узлов (0 конфликтов с React)
//  • Строгий блэклист чата, редактора, кода и модов
//  • Поддержка точных фраз, динамических шаблонов с '*' и атрибутов
// ============================================================================
(function () {
  'use strict';

  console.log('[Russian UI v3.1] Initializing comprehensive safe translation...');

  const DICT = {
  "new conversation": "Новый диалог",
  "conversation history": "История диалогов",
  "conversations": "Диалоги",
  "automations": "Автоматизации",
  "customizations": "Пользовательские настройки",
  "settings": "Настройки",
  "marketplace": "Маркетплейс",
  "search": "Поиск",
  "search marketplace": "Поиск в маркетплейсе",
  "search...": "Поиск...",
  "search files": "Поиск файлов",
  "in progress": "В процессе",
  "idle": "В ожидании",
  "now": "сейчас",
  "all": "Все",
  "active": "Активные",
  "disabled": "Отключенные",
  "installed": "Установленные",
  "available": "Доступные",
  "featured": "Рекомендуемые",
  "apply & reload": "Применить и перезагрузить",
  "apply and reload": "Применить и перезагрузить",
  "open folder": "Открыть папку",
  "devtools": "Инструменты разработчика",
  "view details": "Подробнее",
  "view task details": "Сведения о задаче",
  "copy": "Копировать",
  "copied": "Скопировано",
  "copy code": "Копировать код",
  "cancel": "Отмена",
  "save": "Сохранить",
  "save changes": "Сохранить изменения",
  "save as": "Сохранить как",
  "apply": "Применить",
  "close": "Закрыть",
  "delete": "Удалить",
  "remove": "Удалить",
  "rename": "Переименовать",
  "duplicate": "Дублировать",
  "done": "Готово",
  "ok": "ОК",
  "retry": "Повторить",
  "try again": "Попробовать снова",
  "continue": "Продолжить",
  "skip": "Пропустить",
  "confirm": "Подтвердить",
  "undo": "Отменить",
  "redo": "Повторить",
  "cut": "Вырезать",
  "paste": "Вставить",
  "select all": "Выделить всё",
  "share": "Поделиться",
  "send": "Отправить",
  "stop": "Стоп",
  "stop generating": "Остановить генерацию",
  "cancel generation": "Отменить генерацию",
  "edit": "Редактировать",
  "edit message": "Редактировать сообщение",
  "regenerate": "Сгенерировать заново",
  "clear": "Очистить",
  "clear chat": "Очистить чат",
  "clear conversation": "Очистить диалог",
  "delete conversation": "Удалить диалог",
  "archive": "В архив",
  "restore": "Восстановить",
  "download": "Скачать",
  "upload": "Загрузить",
  "import": "Импорт",
  "export": "Экспорт",
  "back": "Назад",
  "next": "Далее",
  "previous": "Назад",
  "show more": "Показать ещё",
  "show less": "Скрыть",
  "show all": "Показать все",
  "view all": "Смотреть все",
  "learn more": "Подробнее",
  "overview": "Обзор",
  "ask anything... @ to mention, / for actions": "Спросите что угодно... @ упомянуть, / действия",
  "ask the agent": "Спросите агента",
  "no model selected": "Модель не выбрана",
  "toggle side panel": "Боковая панель",
  "toggle aux sidebar": "Переключить панель",
  "collapse sidebar": "Свернуть панель",
  "expand sidebar": "Развернуть панель",
  "send message": "Отправить сообщение",
  "connecting": "Подключение",
  "connected": "Подключено",
  "disconnected": "Отключено",
  "loading...": "Загрузка...",
  "loading": "Загрузка",
  "saving...": "Сохранение...",
  "working...": "Выполнение...",
  "working": "Работает",
  "thinking...": "Размышление...",
  "initializing mcp servers": "Инициализация MCP-серверов",
  "no conversations yet": "Диалогов пока нет",
  "no projects yet": "Проектов пока нет",
  "nothing found": "Ничего не найдено",
  "no results found": "Результатов не найдено",
  "files changed": "изменено файлов",
  "file changed": "изменен файл",
  "lines changed": "изменено строк",
  "file": "Файл",
  "view": "Вид",
  "window": "Окно",
  "help": "Справка",
  "about antigravity": "О программе Antigravity",
  "check for updates...": "Проверить обновления...",
  "toggle developer tools": "Инструменты разработчика",
  "reload window": "Перезагрузить окно",
  "zoom in": "Увеличить",
  "zoom out": "Уменьшить",
  "reset zoom": "Сбросить масштаб",
  "appearance": "Внешний вид",
  "theme": "Тема",
  "dark": "Темная",
  "light": "Светлая",
  "system": "Системная",
  "font size": "Размер шрифта",
  "editor": "Редактор",
  "terminal": "Терминал",
  "general": "Основные",
  "account": "Аккаунт",
  "privacy": "Конфиденциальность",
  "security": "Безопасность",
  "shortcuts": "Горячие клавиши",
  "keybindings": "Сочетания клавиш",
  "profile": "Профиль",
  "sign in": "Войти",
  "sign out": "Выйти",
  "logged in as": "Вы вошли как",
  "models": "Модели",
  "temperature": "Температура",
  "context limit": "Лимит контекста",
  "output tokens": "Выходные токены",
  "input tokens": "Входные токены",
  "cached tokens": "Токены из кэша",
  "token usage": "Расход токенов",
  "costs": "Расходы",
  "total cost": "Общая стоимость",
  "tokens": "токенов",
  "steps": "шагов",
  "tools": "инструментов",
  "files": "файлов",
  "seconds": "сек",
  "minutes": "мин",
  "hours": "ч",
  "days": "дн",
  "ago": "назад",
  "just now": "только что",
  "yesterday": "вчера",
  "today": "сегодня",
  "this week": "на этой неделе",
  "last week": "на прошлой неделе",
  "local permissions": "Локальные разрешения",
  "request review": "Запрашивать проверку",
  "every command requires approval.": "Каждая команда требует подтверждения.",
  "default": "По умолчанию",
  "ask before sensitive operations.": "Спрашивать перед важными операциями.",
  "auto": "Автоматически",
  "automatically decide if commands run.": "Автоматически решать о запуске команд.",
  "turbo": "Турбо",
  "run all commands without restrictions.": "Запускать все команды без ограничений.",
  "model": "Модель",
  "view usage": "Использование квот",
  "usage": "Использование квот",
  "gemini models": "Модели Gemini",
  "claude and gpt models": "Модели Claude и GPT",
  "weekly limit": "Недельный лимит",
  "5h limit": "Лимит на 5 часов",
  "left": "осталось",
  "unavailable": "Недоступно",
  "notice": "Инфо",
  "application": "Приложение",
  "notifications": "Уведомления",
  "browser": "Браузер",
  "projects": "Проекты",
  "not in project": "Вне проекта",
  "interface layout": "Макет интерфейса",
  "knowledge work": "Работа с текстом",
  "simplified interface for research, writing, and everyday tasks.": "Упрощенный интерфейс для исследований, текстов и повседневных задач.",
  "software engineering": "Разработка ПО",
  "full interface for coding, developer tools, and managing agents.": "Полный интерфейс для программирования, инструментов разработчика и агентов.",
  "global permissions": "Глобальные разрешения",
  "configure global allowed and denied resource permissions.": "Настройка разрешенных и запрещенных системных ресурсов.",
  "permission preset": "Пресет разрешений",
  "controls the actions the agent can take.": "Определяет действия, доступные агенту.",
  "tool permissions": "Разрешения инструментов",
  "modify permissions for file, terminal, and mcp tools.": "Настройка прав для файлов, терминала и MCP-инструментов.",
  "network access rules": "Правила сетевого доступа",
  "configure allowed and denied urls for reading.": "Настройка разрешенных и запрещенных URL-адресов для чтения.",
  "input box": "Поле ввода",
  "queued messages": "Очередь сообщений",
  "configure when follow-up messages are sent.": "Настройка отправки последующих сообщений.",
  "keyboard shortcuts": "Горячие клавиши",
  "queue": "В очередь",
  "send immediately": "Отправлять сразу",
  "choose which key sends a message in the chat composer.": "Клавиша отправки сообщения в чате.",
  "voice mode": "Голосовой режим",
  "voice": "Голос",
  "the voice used in voice mode. powered by gemini live.": "Голос в голосовом режиме на базе Gemini Live.",
  "not set": "Не выбран",
  "change": "Изменить",
  "microphone": "Микрофон",
  "input device for voice mode and dictation.": "Устройство ввода для голосового режима и диктовки.",
  "system default": "По умолчанию в системе",
  "give feedback": "Оставить отзыв",
  "configure agent execution, queued message delivery, and permissions.": "Настройка выполнения агента, очереди сообщений и разрешений.",
  "ask anything, @ to mention, / for actions": "Спросите что угодно, @ упомянуть, / действия",
  "ask anything, @ to mention, / for actions ": "Спросите что угодно, @ упомянуть, / действия",

  // --- Приложение (Application Settings) ---
  "manage antigravity app settings.": "Управление настройками приложения Antigravity.",
  "prevent sleep": "Предотвращать спящий режим",
  "prevent the computer from sleeping while the app is running.": "Запретить компьютеру переходить в спящий режим во время работы приложения.",
  "keep in menu bar": "Оставлять в панели меню",
  "keep the app accessible from the menu bar and running in the background when all windows are closed.": "Держать приложение в трее и фоновом режиме при закрытии всех окон.",
  "remote control": "Удаленное управление",
  "enable remote control": "Включить удаленное управление",
  "work with local agents from another device.": "Работайте с локальными агентами с другого устройства.",
  "device name": "Имя устройства",
  "scan the code to open this device in remote control, or": "Отсканируйте код для подключения через удаленное управление или",
  "notification settings": "Параметры уведомлений",
  "to modify notification settings, open your operating system's system preferences.": "Для изменения настроек уведомлений откройте системные параметры ОС.",
  "windows subsystem for linux": "Подсистема Windows для Linux (WSL)",
  "run the app against a linux environment. connecting relaunches the app into the selected wsl distro.": "Запуск в среде Linux. Подключение перезапустит приложение в выбранном дистрибутиве WSL.",
  "version": "Версия",
  "app version": "Версия приложения",
  "automatic check for updates": "Автоматическая проверка обновлений",
  "automatically prompt you to restart the app when a new update is available. when disabled, you can check for updates manually from the app menu.": "Предлагать перезапуск при наличии обновлений. Если отключено, проверяйте вручную из меню.",

  // --- Внешний вид (Appearance) ---
  "configure the agent's visual theme and display preferences.": "Настройка темы оформления и параметров отображения агента.",
  "chat": "Чат",
  "conversation steps": "Шаги диалога",
  "choose how much detail is shown during a conversation.": "Степень детализации сообщений и рассуждений в диалоге.",
  "contrast": "Контраст",
  "font": "Шрифт",
  "dark theme": "Темная тема",
  "preset": "Пресет",
  "background": "Фон",
  "foreground": "Текст",
  "accent": "Акцент",
  "chat layout": "Макет чата",
  "conversation width": "Ширина диалога",
  "configure the maximum width of the conversation panel.": "Максимальная ширина панели диалога.",
  "accessibility": "Специальные возможности",
  "screen reader mode": "Режим программы чтения с экрана",
  "optimize the interface and terminal output for screen readers.": "Оптимизация интерфейса и терминала для программ чтения с экрана.",

  // --- Горячие клавиши (Keyboard Shortcuts / Navigation / Controls) ---
  "navigation": "Навигация",
  "open conversation picker": "Открыть выбор диалогов",
  "open file search": "Открыть поиск файлов",
  "open command palette": "Открыть палитру команд",
  "close tab": "Закрыть вкладку",
  "go back": "Назад",
  "go forward": "Вперед",
  "new tab": "Новая вкладка",
  "reopen closed tab": "Заново открыть закрытую вкладку",
  "select previous conversation": "Предыдущий диалог",
  "select next conversation": "Следующий диалог",
  "move conversation up": "Переместить диалог выше",
  "move conversation down": "Переместить диалог ниже",
  "previous side panel tab": "Предыдущая вкладка боковой панели",
  "next side panel tab": "Следующая вкладка боковой панели",
  "open keyboard shortcuts": "Открыть сочетания клавиш",
  "open settings": "Открыть настройки",
  "conversation": "Диалог",
  "focus input": "Фокус на поле ввода",
  "submit prompt (alternate to enter)": "Отправка запроса (альтернатива Enter)",
  "enter always submits. this adds a second shortcut.": "Enter всегда отправляет. Это задает второе сочетание.",
  "jump to previous prompt": "Перейти к предыдущему запросу",
  "jump to next prompt": "Перейти к следующему запросу",
  "toggle model selector": "Переключить выбор модели",
  "toggle project selector": "Переключить выбор проекта",
  "toggle environment selector": "Переключить выбор среды",
  "toggle voice recording": "Запись голоса (вкл/выкл)",
  "mute voice mic": "Заглушить микрофон",
  "mute voice speaker": "Заглушить динамик",
  "find in conversation": "Найти в диалоге",
  "find in pane": "Найти в панели",
  "add to chat/quote": "Добавить в чат / цитировать",
  "comment on selection": "Комментировать выделенное",
  "side question selection": "Задать вопрос по выделенному",
  "split conversation horizontally": "Разделить диалог по горизонтали",
  "split conversation vertically": "Разделить диалог по вертикали",
  "pin / unpin conversation": "Закрепить / открепить диалог",
  "archive this conversation": "Архивировать этот диалог",
  "layout controls": "Управление разметкой",
  "toggle sidebar": "Скрыть / показать боковую панель",
  "toggle maximize side panel": "Развернуть / свернуть боковую панель",
  "toggle overview panel": "Переключить панель обзора",
  "toggle terminal": "Открыть / скрыть терминал",
  "split terminal": "Разделить терминал",
  "new terminal tab": "Новая вкладка терминала",
  "terminal: add to chat": "Терминал: добавить в чат",
  "terminal: select all": "Терминал: выделить всё",

  // --- Уведомления (Notifications) ---
  "manage your notification preferences.": "Управление параметрами уведомлений.",
  "enable notifications for agent": "Включить системные уведомления",
  "show system notifications when your action is needed or the agent finishes.": "Показывать уведомления ОС, когда требуется действие или агент закончил работу.",
  "sound": "Звук",
  "enable sounds for agent": "Включить звуковые сигналы",
  "play a sound when your action is needed or the agent finishes.": "Воспроизводить звук, когда требуется действие или агент закончил работу.",
  "volume": "Громкость",
  "set the volume of agent sounds.": "Настройка громкости звуковых оповещений.",

  // --- Модели и квоты (Models & Usage) ---
  "models & usage": "Модели и квоты",
  "manage your model quota and credits.": "Управление квотами моделей и балансом кредитов.",
  "plan": "Тарифный план",
  "your plan: google ai pro": "Ваш тариф: Google AI Pro",
  "you can upgrade to a google ai ultra plan to receive higher rate limits.": "Вы можете перейти на тариф Google AI Ultra для повышенных лимитов.",
  "model credits": "Кредиты на модели",
  "enable ai credit overages": "Разрешить расход сверх квоты (AI Credits)",
  "when toggled on, antigravity will use your ai credits to fulfill model requests once you're out of model quota. antigravity will always use your model quota first before using ai credits.": "При включении Antigravity использует кредиты после исчерпания базовой квоты. Сначала всегда расходуется лимит квоты.",
  "weekly limit remaining": "Остаток недельного лимита",
  "five hour limit remaining": "Остаток лимита на 5 часов",

  // --- Браузер (Browser) ---
  "configure built-in browser, link opening, and browser subagent preferences.": "Настройка встроенного браузера, открытия ссылок и браузерного субагента.",
  "built-in browser": "Встроенный браузер",
  "open links in": "Открывать ссылки в",
  "choose where links open by default when clicked.": "Куда направлять открываемые ссылки по умолчанию.",
  "download location": "Папка загрузок",
  "folder where files downloaded in the built-in browser are saved.": "Папка для сохранения файлов, скачанных во встроенном браузере.",
  "browsing history": "История браузера",
  "clear visited urls and autocomplete suggestions from the built-in browser.": "Очистить список посещенных страниц и подсказки автозаполнения.",
  "browser subagent": "Браузерный субагент",
  "browser actuation rules": "Правила работы браузера",
  "configure allowed and denied urls for the browser subagent. it runs in the built-in browser, so no separate browser install is needed.": "Настройка разрешенных и запрещенных URL для браузерного субагента. Он работает во встроенном браузере.",

  // --- Аккаунт и телеметрия (Account & Telemetry) ---
  "manage your plan, credentials, and general preferences.": "Управление тарифом, учетными данными и общими параметрами.",
  "enable telemetry": "Включить телеметрию",
  "when toggled on, antigravity collects usage data to help google enhance performance and features.": "При включении Antigravity собирает данные об использовании для улучшения производительности и функций Google.",
  "marketing emails": "Маркетинговые рассылки",
  "receive product updates, tips, and promotions from google antigravity via email.": "Получать обновления продукта, советы и спецпредложения от Google Antigravity по эл. почте.",
  "by using this app, you agree to its": "Используя это приложение, вы принимаете его",
  "terms of service": "Условия использования",

  // --- Форма отзыва (Feedback modal) ---
  "feedback type": "Тип отзыва",
  "bug report": "Отчет об ошибке",
  "feature request": "Предложение функции",
  "auth and billing": "Авторизация и оплата",
  "remote control issue": "Проблема с удаленным управлением",
  "general feedback": "Общий отзыв",
  "description": "Описание",
  "please describe the issue in detail. the more actionable your feedback, the quicker our team can address your request. some helpful information includes:": "Опишите проблему подробно. Чем конкретнее отзыв, тем быстрее команда сможет решить задачу. Полезно указать:",
  "steps to reproduce the issue": "Шаги для воспроизведения проблемы",
  "expected behavior": "Ожидаемое поведение",
  "actual behavior": "Фактическое поведение",
  "any error messages": "Сообщения об ошибках",
  "any relevant information": "Любая полезная информация",
  "steps to reproduce": "Шаги воспроизведения",
  "attach antigravity server logs": "Прикрепить логи сервера Antigravity",
  "send feedback as": "Отправить отзыв как",
  "visit": "Перейдите в",
  "legal help": "Юридическую поддержку",
  "to ask for content changes for legal reasons.": "для запроса изменений контента по юридическим причинам.",

  // --- Настройки вне проектов и разбивка токенов (Non-project Settings & Token Breakdown) ---
  "settings for conversations outside of projects.": "Настройки для диалогов вне проектов.",
  "the breakdown below shows token usage from customizations like rules, skills, and mcp. if a budget is exceeded, large rules are demoted to path pointers and large customizations are excluded automatically.": "Ниже показан расход токенов на правила, навыки и MCP. При превышении бюджета большие правила заменяются ссылками на пути, а крупные расширения исключаются автоматически.",
  "rules": "Правила",
  "other customizations": "Другие настройки",
  "skills": "Навыки",
  "mcp tools": "Инструменты MCP",

  // --- Извлеченные тултипы, действия и диалоги Antigravity ---
  "view diff": "Просмотр изменений",
  "record audio": "Запись аудио",
  "record audio ctrl+m": "Запись аудио Ctrl+M",
  "updated": "Обновлено",
  "review project": "Обзор проекта",
  "accept step": "Принять шаг",
  "cancel step": "Отменить шаг",
  "action required": "Требуется действие",
  "actions available": "Доступные действия",
  "add context": "Добавить контекст",
  "add custom model": "Добавить свою модель",
  "add mcp servers": "Добавить MCP-серверы",
  "add shortcut": "Добавить сочетание клавиш",
  "add workspace": "Добавить рабочую область",
  "add inline comment": "Добавить встроенный комментарий",
  "add to chat": "Добавить в чат",
  "added (staged)": "Добавлено (индексировано)",
  "advanced command access": "Расширенный доступ к командам",
  "advanced file access": "Расширенный доступ к файлам",
  "advanced settings": "Расширенные настройки",
  "advanced web access": "Расширенный доступ в сеть",
  "agent behavior": "Поведение агента",
  "agent edits": "Правки агента",
  "agent host address": "Хост-адрес агента",
  "agent security settings": "Настройки безопасности агента",
  "agent settings": "Настройки агента",
  "agent team": "Команда агентов",
  "agent response": "Ответ агента",
  "agent finished": "Агент завершил работу",
  "agent working": "Агент работает",
  "archive conversation": "Архивировать диалог",
  "archive workspace": "Архивировать рабочую область",
  "archive project": "Архивировать проект",
  "archived only": "Только архивные",
  "artifact viewer": "Просмотр артефактов",
  "attachment error": "Ошибка вложения",
  "audio attachment": "Аудиовложение",
  "background task output": "Вывод фоновой задачи",
  "branch changes": "Изменения ветки",
  "code preview": "Предпросмотр кода",
  "code search": "Поиск по коду",
  "collapse all": "Свернуть всё",
  "collapse all folders": "Свернуть все папки",
  "collapse diffs": "Свернуть изменения",
  "collapse queued messages": "Свернуть очередь сообщений",
  "command center": "Командный центр",
  "command palette": "Палитра команд",
  "command prompt": "Командная строка",
  "commands outside sandbox": "Команды вне песочницы",
  "configure branches": "Настройка веток",
  "diff view": "Просмотр различий",
  "discard changes": "Отменить изменения",
  "discard all changes": "Отменить все изменения",
  "stage changes": "Индексировать изменения",
  "stage all changes": "Индексировать всё",
  "unstage changes": "Убрать из индекса",
  "open file": "Открыть файл",
  "open in editor": "Открыть в редакторе",
  "open terminal": "Открыть терминал",
  "run command": "Выполнить команду",
  "run in terminal": "Запустить в терминале",
  "show diff": "Показать изменения",
  "hide diff": "Скрыть изменения"
};

  const WILDCARDS = [
    { re: /^resets in (.+)$/i, val: 'Сброс через $1' },
    { re: /^worked for (.+)$/i, val: 'Время работы: $1' },
    { re: /^thought for (.+)$/i, val: 'Размышление: $1' },
    { re: /^thinking for (.+)$/i, val: 'Размышление: $1' },
    { re: /^updated\s+(.+)$/i, val: 'Обновлено $1' },
    { re: /^(\d+)%\s*left$/i, val: '$1% осталось' },
    { re: /^(\d+)\s*files?\s*changed$/i, val: 'Изменено файлов: $1' },
    { re: /^(\d+)\s*lines?\s*changed$/i, val: 'Изменено строк: $1' },
    { re: /^(\d+)\s*conversations?$/i, val: '$1 диалогов' },
    { re: /^(\d+)\s*tools?$/i, val: '$1 инструментов' },
    { re: /^(\d+)\s*steps?$/i, val: '$1 шагов' }
  ];

  const ATTRS = ['placeholder', 'title', 'aria-label', 'tooltip', 'data-placeholder'];

  const BLACKLIST_SELECTORS = [
    '.prose',
    '.markdown-body',
    '[data-turn-id]',
    '[data-message-id]',
    '[data-role="assistant"]',
    '[data-role="user"]',
    '[class*="message-bubble"]',
    '[class*="turn-content"]',
    '.monaco-editor',
    '.cm-editor',
    '.view-lines',
    'pre',
    'code',
    'textarea',
    '#agy-mods-sidebar-tab',
    '.agy-mods-screen-overlay',
    '.agy-context-radar',
    'agent-embed',
    '.agy-interactive-widget',
    'iframe'
  ].join(',');

  function isBlacklisted(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return true;
    if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return true;
    }
    try {
      if (el.closest && el.closest(BLACKLIST_SELECTORS)) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function getTranslation(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    // 1. Точное совпадение
    if (DICT[lower]) {
      const trans = DICT[lower];
      const isCapital = /^[A-ZА-ЯЁ]/.test(trimmed);
      return isCapital ? (trans.charAt(0).toUpperCase() + trans.slice(1)) : trans;
    }

    // 2. Шаблоны с regex
    for (let i = 0; i < WILDCARDS.length; i++) {
      const m = trimmed.match(WILDCARDS[i].re);
      if (m) {
        return trimmed.replace(WILDCARDS[i].re, WILDCARDS[i].val);
      }
    }

    return null;
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    if (node.__agy_ru_locked) return;
    if (isBlacklisted(node)) return;

    const raw = (node.nodeValue || '').trim();
    if (!raw || raw.length < 2 || raw.length > 300) return;

    const trans = getTranslation(raw);
    if (trans) {
      node.__agy_ru_locked = true;
      node.nodeValue = node.nodeValue.replace(raw, trans);
      node.__agy_ru_locked = false;
    }
  }

  function translateAttributes(el) {
    if (!el || el.nodeType !== 1) return;
    if (isBlacklisted(el)) return;

    for (let i = 0; i < ATTRS.length; i++) {
      const attr = ATTRS[i];
      const val = el.getAttribute(attr);
      if (val) {
        const trans = getTranslation(val);
        if (trans) {
          el.setAttribute(attr, trans);
        }
      }
    }
  }

  function processElement(root) {
    if (!root) return;
    if (isBlacklisted(root)) return;

    if (root.nodeType === 1) {
      translateAttributes(root);
      const elementsWithAttrs = root.querySelectorAll('[placeholder],[title],[aria-label],[tooltip],[data-placeholder]');
      elementsWithAttrs.forEach(translateAttributes);
    }

    if (root.nodeType === 3) {
      translateTextNode(root);
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      translateTextNode(n);
    }
  }

  function init() {
    processElement(document.body);

    // Синхронный MutationObserver без отложенного таймера requestIdleCallback
    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'childList') {
          for (let a = 0; a < m.addedNodes.length; a++) {
            processElement(m.addedNodes[a]);
          }
        } else if (m.type === 'attributes') {
          // @ts-ignore
          translateAttributes(m.target);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
