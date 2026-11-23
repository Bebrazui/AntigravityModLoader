# russian-ui — русский интерфейс Antigravity (v2)

Мод перевода интерфейса Antigravity на русский язык.
**Перевод выполняется только целыми строками** — пословного перевода нет,
поэтому английские фразы не склеиваются в полурусский мусор.

## Файлы

| Файл | Назначение |
|---|---|
| `manifest.json` | метаданные мода |
| `renderer.js` | словари + движок перевода |
| `style.css` | стили уведомления и панели |
| `README.md` | эта документация |

`main.js` не нужен — мод работает целиком в renderer-процессе.

## Как включить

Перезапустите Antigravity (или Mod Manager → **Apply & Reload**).
В консоли появится `[Russian UI v2] initialized`.

## Горячие клавиши

| Комбинация | Действия |
|---|---|
| `Ctrl+Alt+T` | вкл / выкл перевод (состояние сохраняется) |
| `Ctrl+Alt+U` | панель непереведённых строк |

## Как работает перевод

0. **Без видимой подмены.** Перевод выполняется синхронно в колбэке
   `MutationObserver`, который браузер выполняет микрозадачей **до отрисовки
   кадра** — русский текст появляется сразу, английский «мигает» лишь при
   очень поздних ленивых панелях (тогда срабатывает страховочный проход
   через 1.5 с / 4 с).
1. **Точное совпадение** — весь текст узла равен строке из словаря
   (регистр и хвостовой `.`/`?`/`…` не учитываются).
2. **Шаблоны с `*`** — для динамических строк:
   `resets in *` → `Сброс через *`, `learn more about *` → `Узнать больше: *`.
3. **Фразы, разорванные разметкой** (`<strong>`, `<code>` внутри предложения) —
   элемент переводится целиком, если склейка текстовых узлов совпала со словарём.
4. Атрибуты: `placeholder`, `title`, `aria-label`, `alt`, `value` кнопок.
5. Свои правки помечаются (`__agy_ru_applied`), чтобы наблюдатель не зациклился;
   если React перезаписал узел — перевод применяется снова.
6. Оригинал запоминается в узле: `Ctrl+Alt+T` полностью возвращает английский.

## Что не переводится (намеренно)

- тексты сообщений агента и пользователя;
- редакторы кода (Monaco/CodeMirror), `pre`, `code`;
- имена файлов в дереве проекта;
- поля ввода и `contenteditable`;
- собственный UI мода (`.agy-ru`).

## Как добавить новые строки

Строка переводится только если она целиком есть в словаре. Поэтому:

1. Откройте нужный экран (настройки, меню модели и т.д.).
2. `Ctrl+Alt+U` → **Собрать** → **Копировать**.
3. Пришлите мне список — я переведу и допишу словарь.

Или добавьте вручную в `renderer.js`:

```js
// в PHRASES — ключом идёт вся строка в нижнем регистре:
'weekly limit remaining': 'Остаток недельного лимита',

// в WILDCARDS — если строка динамическая:
'resets in *': 'Сброс через *',
```

после правки — Apply & Reload.

## Покрытие на старте (v2.3)

Поле ввода: `Ask anything`, `@ to mention`, `/ for actions` (+ варианты
склейки в один placeholder). Статусы агента: `Check`, `Checked`, `Analyze`,
`Analyzed`, `Ran`, `Run`, `Reading`, `Writing`, `Editing`, `Searching`,
`Executing`, `Planning`, `Creating`, `Updating`, `Installing`, `Applying`,
`Glob`, `Grep`, `Waiting`, `Resolved`, `Skipped` и др.
Из скриншотов добавлено: страницы настроек **Внешний вид** (`Contrast`,
`Light/Dark Theme`, `Preset`, `Background`, `Foreground`, `Accent`,
`Default`, `Strong`, описание «Configure the agent's visual theme…»),
**Application** (`Prevent Sleep`, `Keep In Menu Bar`, `Remote Control`,
`Device Name`, `Notifications`, `Open System Preferences`,
`Windows Subsystem for Linux` + все описания), **Основные**
(`Commands Outside Sandbox`, `Browser`, `Browser JavaScript Execution
Policy`, `Browser Actuation Rules`, `Always Proceed`), боковое меню
(`Application`, `Conversations`, `Not in Project`, `Shortcuts`,
`Provide Feedback`), лимиты и модели (`Weekly/Five Hour Limit Remaining`,
`Resets in …`, `View Usage`, `Leaving Soon`), чат и навигация.
