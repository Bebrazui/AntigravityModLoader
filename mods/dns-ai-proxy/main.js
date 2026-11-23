// @ts-check
const net = require('net');
const tls = require('tls');
const https = require('https');
const dns = require('dns');
const crypto = require('crypto');

/**
 * DNS-AI Proxy & Geo-Unblock Engine
 * Точный перенос логики из import json.py на чистый асинхронный Node.js:
 * 1. AI-домены (daily-cloudcode-pa, cloudcode-pa, aicode) -> DoH через cf.dns-ai.ru (узел в Нидерландах, сквозной TLS)
 * 2. API_PIN_HOSTS -> GFE Seeds (фронтенды Google www.google.com, oauth2, accounts)
 * 3. DNS-over-TLS (DoT) через 194.87.196.13 (dns.dns-ai.ru:853)
 * 4. Конкурентное TLS-прощупывание IP (Fast Connect Race)
 * 5. Полноценный HTTP CONNECT relay с полузакрытием сокетов (SHUT_WR)
 */

const DOT_HOST = '194.87.196.13';
const DOT_SNI = 'dns.dns-ai.ru';
const LISTEN_IP = '127.0.0.1';
const DEFAULT_PORT = 53129;
const HTTP_OK = Buffer.from('HTTP/1.1 200 Connection Established\r\n\r\n');

const API_PIN_HOSTS = new Set([
  'daily-cloudcode-pa.googleapis.com',
  'cloudcode-pa.googleapis.com'
]);

const GFE_SEEDS = ['www.google.com', 'oauth2.googleapis.com', 'accounts.google.com'];
const GFE_TTL = 600 * 1000;

const AI_HOSTS = new Set([
  'daily-cloudcode-pa.googleapis.com',
  'cloudcode-pa.googleapis.com',
  'aicode.googleapis.com'
]);

const NODE_LOOKUP_HOST = 'daily-cloudcode-pa.googleapis.com';
const DNSAI_DOH_HOST = 'cf.dns-ai.ru';
const DNSAI_TTL = 600 * 1000;
// Запасные проверенные узлы (Нидерланды)
const SMART_PINS = ['31.58.216.201'];

const IPS_TTL = 300 * 1000;
const BAD_TTL = 15 * 1000;
const PROBE_TIMEOUT = 4000;
const MAX_PARALLEL = 8;

// Состояние кэшей
const dnsCache = new Map();     // domain -> ip
const domainIps = new Map();    // domain -> { expires: number, ips: string[] }
const badIps = new Map();       // ip -> retryAfter: number
let gfeIps = [];
let gfeChecked = 0;
let dotDeadUntil = 0;
let smartNodeIps = [];
let smartNodeExpires = 0;
let verifiedAiNode = null;
let verifiedAiNodeExpires = 0;

let serverInstance = null;
let activePort = DEFAULT_PORT;

/**
 * Парсер DNS A-записей из бинарного wireformat ответа
 * @param {Buffer} data
 * @returns {string[]}
 */
function parseARecords(data) {
  try {
    if (data.length < 12) return [];
    const ancount = data.readUInt16BE(6);
    let off = 12;
    // Пропускаем Question section
    while (off < data.length && data[off] !== 0) {
      off += data[off] + 1;
    }
    off += 5; // 0x00 + QTYPE (2) + QCLASS (2)

    const ips = [];
    for (let i = 0; i < ancount; i++) {
      if (off >= data.length) break;
      if ((data[off] & 0xC0) === 0xC0) {
        off += 2;
      } else {
        while (off < data.length && data[off] !== 0) {
          off += data[off] + 1;
        }
        off += 1;
      }
      if (off + 10 > data.length) break;
      const rtype = data.readUInt16BE(off);
      const rdlen = data.readUInt16BE(off + 8);
      off += 10;
      if (rtype === 1 && rdlen === 4 && off + 4 <= data.length) {
        const ip = `${data[off]}.${data[off+1]}.${data[off+2]}.${data[off+3]}`;
        ips.push(ip);
      }
      off += rdlen;
    }
    return ips;
  } catch (_) {
    return [];
  }
}

/**
 * DoH A-запрос через wireformat к cf.dns-ai.ru
 * @param {string} host
 * @param {string} name
 * @returns {Promise<string[]>}
 */
function dohLookup(host, name) {
  return new Promise((resolve) => {
    try {
      const tid = crypto.randomBytes(2);
      const flags = Buffer.from([0x01, 0x00]);
      const qdcount = Buffer.from([0x00, 0x01]);
      const rest = Buffer.alloc(6);

      const parts = name.split('.');
      const qnameParts = [];
      for (const p of parts) {
        qnameParts.push(Buffer.from([p.length]));
        qnameParts.push(Buffer.from(p, 'ascii'));
      }
      qnameParts.push(Buffer.from([0x00]));
      const qtype = Buffer.from([0x00, 0x01]);
      const qclass = Buffer.from([0x00, 0x01]);

      const wire = Buffer.concat([tid, flags, qdcount, rest, ...qnameParts, qtype, qclass]);
      const b64 = wire.toString('base64url');

      const req = https.get(`https://${host}/dns-query?dns=${b64}`, {
        timeout: 4000,
        headers: { 'accept': 'application/dns-message' }
      }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            const body = Buffer.concat(chunks);
            resolve(parseARecords(body));
          } else {
            resolve([]);
          }
        });
      });

      req.on('error', () => resolve([]));
      req.on('timeout', () => {
        req.destroy();
        resolve([]);
      });
    } catch (_) {
      resolve([]);
    }
  });
}

/**
 * DoT резолв через 194.87.196.13:853 с жестким таймаутом 1.5 сек (как в Python)
 * @param {string} domain
 * @returns {Promise<string[]>}
 */
function dotLookup(domain) {
  if (Date.now() < dotDeadUntil) return Promise.resolve([]);

  return new Promise((resolve) => {
    let finished = false;
    const timeoutTimer = setTimeout(() => {
      if (!finished) {
        finished = true;
        dotDeadUntil = Date.now() + 60000;
        try { sock.destroy(); } catch (_) {}
        resolve([]);
      }
    }, 1500);

    let sock = null;
    try {
      const tid = crypto.randomBytes(2);
      const flags = Buffer.from([0x01, 0x00]);
      const qdcount = Buffer.from([0x00, 0x01]);
      const rest = Buffer.alloc(6);

      const parts = domain.split('.');
      const qnameParts = [];
      for (const p of parts) {
        qnameParts.push(Buffer.from([p.length]));
        qnameParts.push(Buffer.from(p, 'ascii'));
      }
      qnameParts.push(Buffer.from([0x00]));
      const wire = Buffer.concat([tid, flags, qdcount, rest, ...qnameParts, Buffer.from([0, 1, 0, 1])]);
      const lenBuf = Buffer.alloc(2);
      lenBuf.writeUInt16BE(wire.length);
      const packet = Buffer.concat([lenBuf, wire]);

      sock = tls.connect(853, DOT_HOST, {
        servername: DOT_SNI,
        timeout: 1500,
        rejectUnauthorized: false
      }, () => {
        sock.write(packet);
      });

      let buf = Buffer.alloc(0);
      sock.on('data', d => {
        buf = Buffer.concat([buf, d]);
        if (buf.length >= 2) {
          const totalLen = buf.readUInt16BE(0);
          if (buf.length >= 2 + totalLen) {
            if (!finished) {
              finished = true;
              clearTimeout(timeoutTimer);
              sock.end();
              const ips = parseARecords(buf.slice(2));
              resolve(ips);
            }
          }
        }
      });

      const onFail = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutTimer);
          dotDeadUntil = Date.now() + 60000;
          try { sock.destroy(); } catch (_) {}
          resolve([]);
        }
      };

      sock.on('error', onFail);
      sock.on('timeout', onFail);
    } catch (_) {
      if (!finished) {
        finished = true;
        clearTimeout(timeoutTimer);
        resolve([]);
      }
    }
  });
}

/**
 * Google Frontend IPs (GFE Seeds)
 * @returns {Promise<string[]>}
 */
async function getGfeCandidates() {
  const now = Date.now();
  if (gfeIps.length > 0 && now < gfeChecked) {
    return [...gfeIps];
  }

  const found = new Set();
  for (const seed of GFE_SEEDS) {
    try {
      const records = await dns.promises.resolve4(seed);
      for (const ip of records) found.add(ip);
      if (found.size >= 8) break;
    } catch (_) {}
  }

  if (found.size > 0) {
    gfeIps = Array.from(found).slice(0, 8);
    gfeChecked = now + GFE_TTL;
  }
  return [...gfeIps];
}

/**
 * Рабочий узел DNS-AI для AI-доменов с обязательной TLS-проверкой
 * Проверяет реальным рукопожатием, отсекает мертвые узлы DoH и откатывается на SMART_PINS.
 * @returns {Promise<string[]>}
 */
async function getSmartIps(domain) {
  const now = Date.now();
  if (verifiedAiNode && now < verifiedAiNodeExpires) {
    return [verifiedAiNode];
  }

  // 1. Получаем свежие IP из DoH
  let candidates = [];
  try {
    candidates = await dohLookup(DNSAI_DOH_HOST, NODE_LOOKUP_HOST);
  } catch (_) {}

  // 2. Объединяем с резервными пинами
  const allCandidates = [...candidates];
  for (const pin of SMART_PINS) {
    if (!allCandidates.includes(pin)) {
      allCandidates.push(pin);
    }
  }

  // 3. Параллельно тестируем TLS-рукопожатием (SNI = daily-cloudcode-pa)
  const probePromises = allCandidates.map(async (ip) => {
    const ok = await probeTls(ip, 443, NODE_LOOKUP_HOST, 2000);
    return { ip, ok };
  });

  const results = await Promise.all(probePromises);
  const working = results.find(r => r.ok);

  if (working) {
    verifiedAiNode = working.ip;
    verifiedAiNodeExpires = now + DNSAI_TTL;
    return [working.ip];
  }

  // Крайний фолбэк на SMART_PINS
  return [...SMART_PINS];
}

/**
 * Полный резолв всех A-записей (DoT + System DNS + GFE)
 * @param {string} domain
 * @returns {Promise<string[]>}
 */
async function resolveAll(domain) {
  const ips = [];
  const add = (ip) => {
    if (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && !ips.includes(ip)) {
      ips.push(ip);
    }
  };

  const dotPromise = dotLookup(domain);
  const sysPromise = dns.promises.resolve4(domain).catch(() => []);

  const [dotIps, sysIps] = await Promise.all([dotPromise, sysPromise]);
  dotIps.forEach(add);
  sysIps.forEach(add);

  if (API_PIN_HOSTS.has(domain)) {
    const gfe = await getGfeCandidates();
    return [...gfe, ...ips.filter(ip => !gfe.includes(ip))];
  }

  return ips;
}

/**
 * TLS-прощупывание IP адреса
 * @param {string} ip
 * @param {number} port
 * @param {string} sni
 * @param {number} timeout
 * @returns {Promise<boolean>}
 */
function probeTls(ip, port, sni, timeout) {
  return new Promise((resolve) => {
    let done = false;
    const socket = net.createConnection({ host: ip, port, timeout }, () => {
      const tlsSock = tls.connect({
        socket,
        servername: sni,
        rejectUnauthorized: false,
        timeout
      }, () => {
        done = true;
        try { tlsSock.destroy(); } catch (_) {}
        resolve(true);
      });
      tlsSock.on('error', () => { if (!done) { done = true; resolve(false); } });
      tlsSock.on('timeout', () => { if (!done) { done = true; tlsSock.destroy(); resolve(false); } });
    });

    socket.on('error', () => { if (!done) { done = true; resolve(false); } });
    socket.on('timeout', () => { if (!done) { done = true; socket.destroy(); resolve(false); } });
  });
}

/**
 * Выбор проверенных живых IP
 * @param {string} domain
 * @param {number} port
 * @returns {Promise<string[]>}
 */
async function pickIps(domain, port) {
  const now = Date.now();
  const ent = domainIps.get(domain);
  if (ent && ent.expires > now) {
    const alive = ent.ips.filter(ip => (badIps.get(ip) || 0) <= now);
    if (alive.length > 0) return alive;
  }

  const ips = await resolveAll(domain);
  if (!ips || ips.length === 0) return [];
  if (ips.length === 1) {
    domainIps.set(domain, { expires: now + IPS_TTL, ips: [...ips] });
    return ips;
  }

  // Конкурентное TLS-прощупывание
  const results = [];
  const probes = ips.map(async (ip) => {
    const start = Date.now();
    const ok = await probeTls(ip, port, domain, PROBE_TIMEOUT);
    if (ok) {
      results.push({ latency: Date.now() - start, ip });
    } else {
      badIps.set(ip, Date.now() + BAD_TTL);
    }
  });

  await Promise.race([
    Promise.all(probes),
    new Promise(res => setTimeout(res, 2500))
  ]);

  if (results.length > 0) {
    results.sort((a, b) => a.latency - b.latency);
    const good = results.map(r => r.ip);
    domainIps.set(domain, { expires: Date.now() + IPS_TTL, ips: good });
    return good;
  }

  const alive = ips.filter(ip => (badIps.get(ip) || 0) <= Date.now());
  domainIps.set(domain, { expires: Date.now() + 30000, ips: [...ips] });
  return alive.length > 0 ? alive : ips;
}

/**
 * Быстрое подключение к одному из IP (гонка сокетов)
 * @param {string} domain
 * @param {number} port
 * @param {number} totalTimeout
 * @param {number} perIpTimeout
 * @param {string[]} [explicitIps]
 * @returns {Promise<net.Socket>}
 */
function connectOnce(domain, port, totalTimeout, perIpTimeout, explicitIps) {
  return new Promise(async (resolve, reject) => {
    const ips = explicitIps || await pickIps(domain, port);
    if (!ips || ips.length === 0) {
      return reject(new Error('no address for ' + domain));
    }

    let resolved = false;
    const errors = [];
    const sockets = [];

    const cleanup = () => {
      resolved = true;
      sockets.forEach(s => {
        try { s.destroy(); } catch (_) {}
      });
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error(`Timeout connecting to ${domain} (${errors.join('; ')})`));
      }
    }, totalTimeout);

    const targetIps = ips.slice(0, MAX_PARALLEL);
    targetIps.forEach(ip => {
      const sock = new net.Socket();
      sock.setNoDelay(true);
      sock.setKeepAlive(true);
      sock.setTimeout(perIpTimeout);
      sockets.push(sock);

      sock.connect({ host: ip, port }, () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          badIps.delete(ip);
          if (!explicitIps) {
            domainIps.set(domain, {
              expires: Date.now() + IPS_TTL,
              ips: [ip, ...ips.filter(i => i !== ip)]
            });
          }
          // Закрываем остальные сокеты гонки
          sockets.forEach(s => {
            if (s !== sock) {
              try { s.destroy(); } catch (_) {}
            }
          });
          sock.setTimeout(0); // снимаем начальный connect timeout
          resolve(sock);
        } else {
          try { sock.destroy(); } catch (_) {}
        }
      });

      const onFail = (err) => {
        try { sock.destroy(); } catch (_) {}
        if (!resolved) {
          badIps.set(ip, Date.now() + BAD_TTL);
          errors.push(`${ip}: ${err ? (err.message || err) : 'failed'}`);
          if (errors.length >= targetIps.length) {
            resolved = true;
            clearTimeout(timer);
            reject(new Error(`All addresses failed for ${domain}: ${errors.slice(0, 3).join('; ')}`));
          }
        }
      };

      sock.on('error', onFail);
      sock.on('timeout', onFail);
    });
  });
}

/**
 * Быстрое подключение с поддержкой AI-узлов Нидерландов
 * @param {string} domain
 * @param {number} port
 * @param {number} [budget]
 * @returns {Promise<net.Socket>}
 */
async function connectFast(domain, port, budget = 7000) {
  // Для AI-доменов сначала пробуем узел DNS-AI (Нидерланды)
  if (AI_HOSTS.has(domain)) {
    try {
      const node = await getSmartIps(domain);
      if (node && node.length > 0) {
        return await connectOnce(domain, port, Math.min(3500, budget), 2000, node);
      }
    } catch (_) {}
  }

  // Общий цикл подключения (до 2 попыток с переопросом IP)
  const deadline = Date.now() + budget;
  let lastErr = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - Date.now();
    if (left <= 500) break;
    try {
      return await connectOnce(domain, port, Math.min(left, 4500), 2500);
    } catch (err) {
      lastErr = err;
      domainIps.delete(domain);
      dnsCache.delete(domain);
    }
  }

  throw lastErr || new Error(`Timeout connecting to ${domain}`);
}

/**
 * Двусторонний пайпинг (relay) с полузакрытием SHUT_WR для SSE / генераций
 * @param {net.Socket} client
 * @param {net.Socket} remote
 */
function relay(client, remote) {
  client.setNoDelay(true);
  remote.setNoDelay(true);
  client.setKeepAlive(true, 10000);
  remote.setKeepAlive(true, 10000);

  // Таймаут бездействия 600 сек (для длинных reasoning шагов)
  client.setTimeout(600000);
  remote.setTimeout(600000);

  client.on('data', chunk => {
    if (!remote.destroyed) remote.write(chunk);
  });

  remote.on('data', chunk => {
    if (!client.destroyed) client.write(chunk);
  });

  client.on('end', () => {
    try { remote.end(); } catch (_) {}
  });

  remote.on('end', () => {
    try { client.end(); } catch (_) {}
  });

  const cleanup = () => {
    try { client.destroy(); } catch (_) {}
    try { remote.destroy(); } catch (_) {}
  };

  client.on('error', cleanup);
  remote.on('error', cleanup);
  client.on('timeout', cleanup);
  remote.on('timeout', cleanup);
}

/**
 * Обработка входящего HTTP CONNECT клиента
 * @param {net.Socket} client
 */
function handleClient(client) {
  let initialBuffer = Buffer.alloc(0);

  const onData = async (data) => {
    initialBuffer = Buffer.concat([initialBuffer, data]);
    const sepIdx = initialBuffer.indexOf('\r\n\r\n');
    if (sepIdx === -1) {
      if (initialBuffer.length > 8192) {
        client.destroy();
      }
      return;
    }

    client.removeListener('data', onData);
    const head = initialBuffer.slice(0, sepIdx).toString('utf8');
    const leftover = initialBuffer.slice(sepIdx + 4);

    const firstLine = head.split('\r\n')[0] || '';
    const parts = firstLine.split(' ');
    if (parts.length < 2 || parts[0].toUpperCase() !== 'CONNECT') {
      try {
        client.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      } catch (_) {
        client.destroy();
      }
      return;
    }

    const target = parts[1];
    let host = target;
    let port = 443;
    if (target.includes(':')) {
      const p = target.split(':');
      host = p[0];
      port = parseInt(p[1], 10) || 443;
    }

    try {
      const remote = await connectFast(host, port);
      client.write(HTTP_OK, () => {
        if (leftover.length > 0) {
          remote.write(leftover);
        }
        relay(client, remote);
      });
    } catch (err) {
      try {
        client.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
      } catch (_) {
        client.destroy();
      }
    }
  };

  client.on('data', onData);
  client.on('error', () => {
    try { client.destroy(); } catch (_) {}
  });
}

/**
 * Запуск локального прокси-сервера
 * @param {number} [port]
 * @returns {Promise<number>}
 */
function startProxy(port = DEFAULT_PORT) {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      return resolve(activePort);
    }

    const srv = net.createServer((socket) => {
      handleClient(socket);
    });

    srv.on('error', (err) => {
      // @ts-ignore
      if (err.code === 'EADDRINUSE') {
        console.warn(`[DNS-AI Proxy] Port ${port} in use, picking random available port...`);
        // Пробуем на случайном свободном порту
        const fallback = net.createServer((s) => handleClient(s));
        fallback.listen(0, LISTEN_IP, () => {
          // @ts-ignore
          activePort = fallback.address().port;
          serverInstance = fallback;
          console.log(`[DNS-AI Proxy] Server listening on http://127.0.0.1:${activePort}`);
          resolve(activePort);
        });
        fallback.on('error', reject);
      } else {
        reject(err);
      }
    });

    srv.listen(port, LISTEN_IP, () => {
      activePort = port;
      serverInstance = srv;
      console.log(`[DNS-AI Proxy] Server successfully listening on http://127.0.0.1:${activePort}`);
      resolve(activePort);
    });
  });
}

function stopProxy() {
  if (serverInstance) {
    try { serverInstance.close(); } catch (_) {}
    serverInstance = null;
  }
}

function getActivePort() {
  return activePort;
}

function clearCache() {
  dnsCache.clear();
  domainIps.clear();
  badIps.clear();
  gfeIps = [];
  gfeChecked = 0;
  dotDeadUntil = 0;
  smartNodeIps = [];
  smartNodeExpires = 0;
}

module.exports = {
  startProxy,
  stopProxy,
  getActivePort,
  clearCache
};
