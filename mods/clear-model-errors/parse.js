'use strict';
// ============================================================================
//  Разбор строк language_server.log, в которых лежит РЕАЛЬНАЯ причина ошибки,
//  а не обобщённое "Model unavailable".
//
//  Найденные в бинарнике форматы:
//    Run: attempt %d failed (%v), retrying in %v
//    Encountered retryable api error. retrying in %v. Error: %v
//    Encountered retryable api error. retrying in %v. Error (%v): %v
//    API error (attempt %d): %v
//    ... HTTP status %d ..., unexpected status code: %d ...
// ============================================================================

var STATUS_LABELS = {
  400: 'некорректный запрос (400)',
  401: 'нет авторизации (401)',
  403: 'доступ запрещён (403)',
  404: 'эндпоинт или модель не найдены (404)',
  408: 'таймаут запроса (408)',
  409: 'конфликт состояния (409)',
  413: 'слишком большой запрос (413)',
  429: 'лимит запросов (429)',
  500: 'внутренняя ошибка Google (500)',
  501: 'метод не поддерживается (501)',
  502: 'плохой шлюз Google (502)',
  503: 'сервис временно недоступен (503)',
  504: 'таймаут шлюза Google (504)'
};

function pickStatus(text) {
  var patterns = [
    /(?:unexpected\s+http\s+status|unexpected\s+status\s+code|http\s+status)\D{0,12}(\d{3})/i,
    /\bstatus(?:\s+code)?\s*[:=]?\s*(\d{3})\b/i,
    /\b(4\d{2}|5\d{2})\b/
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = patterns[i].exec(text);
    if (m) {
      var code = parseInt(m[1], 10);
      if (code >= 100 && code <= 599) return code;
    }
  }
  return null;
}

function classify(text, status) {
  if (status) {
    if (STATUS_LABELS[status]) return { kind: 'http', summary: STATUS_LABELS[status] };
    if (status >= 500) return { kind: 'http', summary: 'сервер вернул ' + status };
    if (status >= 400) return { kind: 'http', summary: 'клиентская ошибка ' + status };
  }
  if (/forcibly closed|connection reset|reset by peer|wsarecv|wsaeconnreset|broken pipe|unexpected EOF|GOAWAY|RST_STREAM/i.test(text)) {
    return { kind: 'reset', summary: 'соединение разорвано (TCP reset)' };
  }
  if (/context deadline exceeded|deadline exceeded|timed out|timeout|TLS handshake/i.test(text)) {
    return { kind: 'timeout', summary: 'таймаут соединения' };
  }
  if (/no such host|lookup .* failed|could not resolve|dns/i.test(text)) {
    return { kind: 'dns', summary: 'DNS не разрешил имя' };
  }
  if (/x509|certificate|tls:/i.test(text)) {
    return { kind: 'tls', summary: 'ошибка TLS или сертификата' };
  }
  if (/\bEOF\b/.test(text)) return { kind: 'reset', summary: 'сервер закрыл соединение (EOF)' };
  return { kind: 'other', summary: 'ошибка транспорта' };
}

function cleanRaw(text) {
  var s = String(text || '')
    .replace(/^ERROR:\s*logging before google\.Init:\s*/i, '')
    .replace(/^[IWEF]\d{4}\s+\d{2}:\d{2}:\d{2}\.\d+\s+\d+\s+[a-z_0-9]+\.go:\d+\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > 400 ? s.slice(0, 400) + '…' : s;
}

/**
 * Возвращает объект с реальной причиной или null, если строка не про ошибку.
 */
function parseLine(line) {
  if (!line) return null;

  var attempt = null;
  var delay = null;
  var message = null;
  var m;

  if ((m = /Run: attempt (\d+) failed \((.*)\), retrying in ([\d.]+)s/.exec(line))) {
    attempt = parseInt(m[1], 10);
    message = m[2];
    delay = parseFloat(m[3]);
  } else if ((m = /Encountered retryable (?:api )?error\.\s*retrying in ([^.]*)\.\s*Error(?:\s*\(([^)]*)\))?:\s*(.*)$/.exec(line))) {
    delay = m[1] ? String(m[1]).trim() : null;
    message = m[3];
    if (m[2]) message = '[' + m[2] + '] ' + message;
  } else if ((m = /API error(?: \(attempt (\d+)\))?:\s*(.*)$/.exec(line))) {
    attempt = m[1] ? parseInt(m[1], 10) : null;
    message = m[2];
  } else if ((m = /(?:errorreport|error_parsing)\.go:\d+\]\s*(.*)$/.exec(line))) {
    // ERROR: ... errorreport.go:285] failed to get load code assist response:
    //   Post "https://daily-cloudcode-pa...": net/http: TLS handshake timeout
    message = m[1];
  } else if ((m = /Singleflight refresh failed:\s*(.*)$/.exec(line))) {
    // cache.go:157] Cache(loadCodeAssistResponse): Singleflight refresh failed: ...
    message = m[1];
  } else {
    return null;
  }

  if (!message) return null;

  var status = pickStatus(message);
  if (!status && /bad gateway/i.test(message)) status = 502;
  if (!status && /service unavailable/i.test(message)) status = 503;
  if (!status && /too many requests/i.test(message)) status = 429;
  var cls = classify(message, status);

  return {
    at: new Date().toISOString(),
    attempt: attempt,
    delay: delay,
    status: status,
    kind: cls.kind,
    summary: cls.summary,
    raw: cleanRaw(message),
    line: cleanRaw(line)
  };
}

module.exports = {
  parseLine: parseLine,
  classify: classify,
  pickStatus: pickStatus,
  STATUS_LABELS: STATUS_LABELS
};
