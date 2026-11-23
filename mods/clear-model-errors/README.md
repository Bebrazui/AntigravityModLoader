# clear-model-errors

Показывает **реальную причину** вместо обобщённого `Model unavailable`:

```
Model unavailable, retrying in 4s (attempt 1/9)
        ↓
Модель не ответила — повтор через 4 с (попытка 1 из 9) — сервер вернул 429 (лимит запросов)
```

## Откуда берётся реальная причина

`language_server.exe` при каждом сбое пишет в
`%APPDATA%\Antigravity\logs\language_server.log` строку с настоящей ошибкой:

```
Run: attempt 1 failed (request failed: ... HTTP status 429: ...), retrying in 4s
Encountered retryable api error. retrying in 4s. Error (RESOURCE_EXHAUSTED): HTTP status 429
API error (attempt 3): unexpected HTTP status 502
... wsarecv: An existing connection was forcibly closed by the remote host.
```

Мод (`main.js`) читает этот лог (только чтение, с конца файла), разбирает строку
и присылает в UI:

```json
{
  "at": "2026-11-21T11:32:42.920Z",
  "attempt": 1,
  "delay": 4,
  "status": 429,
  "kind": "http",
  "summary": "лимит запросов (429)",
  "raw": "request failed: ... HTTP status 429 ..."
}
```

Renderer подставляет `summary` в сообщение, а `raw` — в подсказку при наведении
и в консоль DevTools.

## Что распознаётся

| Причина | Как показывается |
|---|---|
| HTTP 429 | `— сервер вернул 429 (лимит запросов)` |
| HTTP 502 / 503 / 504 | `— сервис временно недоступен (503)` и т.п. |
| HTTP 404 | `— эндпоинт или модель не найдены (404)` |
| HTTP 401 / 403 | `— нет авторизации (401)` / `— доступ запрещён (403)` |
| TCP reset (`wsarecv`, `wsasend`, `forcibly closed`) | `— соединение разорвано (TCP reset)` |
| таймаут (`context deadline exceeded`, `timeout`) | `— таймаут соединения` |
| DNS (`no such host`) | `— DNS не разрешил имя` |
| TLS / сертификат | `— ошибка TLS или сертификата` |

## Важно про «реальный ответ сервера»

Трафик модели идёт по TLS **сквозь** локальный прокси (`CONNECT`), поэтому сам
прокси HTTP-статус видеть не может. Но language server этот статус видит и пишет
в лог — оттуда мод его и берёт.

Если в логе только `forcibly closed`, значит сервер не вернул HTTP-ответ вообще:
соединение оборвалось на уровне TCP (RST). Это и есть настоящая причина, а не
429/503.

## Диагностика

- `%USERPROFILE%\.antigravity-mods\model-last-error.json` — последняя разобранная ошибка;
- в DevTools: `__AGY_CLEAR_ERRORS__.last()` — та же структура;
- `__AGY_CLEAR_ERRORS__.rescan()` — принудительный скан DOM.

## Настройки

```json
"modSettings": {
  "clear-model-errors": {
    "style": "short",          // "short" | "full"
    "hintFromAttempt": 3,
    "tooltipOriginal": true,   // оригинал + сырая ошибка в title
    "consoleLog": false
  }
}
```

## Файлы

```
manifest.json   описание мода
main.js         чтение language_server.log -> window.__AGY_MODEL_LAST_ERROR__
parse.js        разбор строк лога (можно тестировать отдельно: node -e ...)
renderer.js     замена текста в UI + подстановка реальной причины
```

## Требования

- модлоадер пропатчен (`app.asar` содержит `.antigravity-mods`);
- приложение запущено через лаунчер модлоадера;
- мод не в `disabledMods`.

## Ограничения

- показывается только ошибка, которую language server успел записать в лог;
- если Google поменяет формат строки, правило в `parse.js` перестанет срабатывать;
- системные уведомления Windows не перехватываются.
