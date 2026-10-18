'use strict';
/*
 * Static site server + simple web proxy. Node 18+, no npm install needed.
 *
 *   node server.js                         -> http://localhost:8080
 *   PROXY_KEY=secret node server.js        -> proxy asks for a key (recommended when public)
 *   PORT=3000 node server.js               -> different port
 *
 * Routes used by /browser/index.html:
 *   GET  /p/health        -> { ok, locked, authed }
 *   GET  /p/login?k=KEY   -> sets the auth cookie
 *   GET|POST /p?u=URL     -> fetches URL and rewrites the page so links/forms/requests stay in the proxy
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const net = require('net');
const dns = require('dns');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8080;
const KEY = process.env.PROXY_KEY || '';
const ROOT = __dirname;
const ALLOW_PRIVATE = process.env.ALLOW_PRIVATE === '1'; // only for local testing
const MAX_HTML = 25 * 1024 * 1024;
const MAX_POST = 10 * 1024 * 1024;
const MAX_REDIRECTS = 6;
const TIMEOUT_MS = 20000;
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);
const TOKEN = KEY ? crypto.createHmac('sha256', KEY).update('proxy-auth-v1').digest('hex') : '';

/* ---------- helpers ---------- */
function isPrivateIP(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::' || l === '::1') return true;
    const m = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isPrivateIP(m[1]);
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff');
  }
  return true;
}

function safeLookup(hostname, opts, cb) {
  dns.lookup(hostname, { all: true }, (err, list) => {
    if (err) return cb(err);
    if (!list.length || list.some(a => isPrivateIP(a.address))) return cb(new Error('Blocked: private or local address'));
    if (opts && opts.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const unesc = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function parseCookies(h) {
  const out = {};
  String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
function safeEq(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
const authed = req => !KEY || safeEq(parseCookies(req.headers.cookie).pk || '', TOKEN);

const attempts = new Map(); // ip -> [timestamps]
function tooManyAttempts(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  attempts.set(ip, list);
  return list.length >= 10;
}
const clientIP = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

function sendJSON(res, code, obj, extra) {
  res.writeHead(code, Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, extra || {}));
  res.end(JSON.stringify(obj));
}
function sendError(res, code, msg) {
  if (res.headersSent) return res.destroy();
  res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end('<!doctype html><meta charset="utf-8"><body style="font:15px system-ui;background:#0f1115;color:#e8eaf0;padding:40px"><h2>' +
    code + '</h2><p>' + esc(msg) + '</p>');
}

/* ---------- upstream fetch (with redirect handling + SSRF checks) ---------- */
function upstream(target, method, headers, body, ownHost, n) {
  n = n || 0;
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(target); } catch (e) { return reject(new Error('Invalid URL')); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return reject(new Error('Only http and https URLs are supported'));
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (!ALLOW_PRIVATE) {
      if (net.isIP(host) && isPrivateIP(host)) return reject(new Error('Blocked: private or local address'));
      if (!ALLOWED_PORTS.has(url.port)) return reject(new Error('Blocked: port not allowed'));
    }
    if (ownHost && url.host.toLowerCase() === String(ownHost).toLowerCase()) return reject(new Error('Blocked: cannot proxy this server'));

    const h = Object.assign({}, headers);
    if (body) h['content-length'] = Buffer.byteLength(body); else delete h['content-length'];
    const lib = url.protocol === 'https:' ? https : http;
    const opts = { method, headers: h, timeout: TIMEOUT_MS };
    if (!ALLOW_PRIVATE) opts.lookup = safeLookup;
    const r = lib.request(url, opts, res => {
      const code = res.statusCode;
      if ([301, 302, 303, 307, 308].includes(code) && res.headers.location) {
        res.resume();
        if (n >= MAX_REDIRECTS) return reject(new Error('Too many redirects'));
        let next;
        try { next = new URL(res.headers.location, url).href; } catch (e) { return reject(new Error('Bad redirect')); }
        const toGet = code === 303 || ((code === 301 || code === 302) && method === 'POST');
        const m = toGet ? 'GET' : method;
        const hh = Object.assign({}, headers);
        if (toGet) { delete hh['content-type']; delete hh['content-length']; }
        return resolve(upstream(next, m, hh, toGet ? null : body, ownHost, n + 1));
      }
      resolve({ res, url });
    });
    r.on('timeout', () => r.destroy(new Error('Upstream timed out')));
    r.on('error', reject);
    r.end(body || undefined);
  });
}

function decoder(res) {
  const enc = String(res.headers['content-encoding'] || '').toLowerCase();
  if (enc === 'gzip' || enc === 'x-gzip') return res.pipe(zlib.createGunzip());
  if (enc === 'deflate') return res.pipe(zlib.createInflate());
  if (enc === 'br') return res.pipe(zlib.createBrotliDecompress());
  return res;
}
function collect(stream, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    stream.on('data', c => { size += c.length; if (size > max) { stream.destroy(); return reject(new Error('Page too large')); } chunks.push(c); });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
function decodeText(buf, contentType, sniffHtml) {
  let cs = (/charset\s*=\s*["']?([\w-]+)/i.exec(contentType || '') || [])[1];
  if (!cs && sniffHtml) cs = (/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(buf.slice(0, 3000).toString('latin1')) || [])[1];
  try { return new TextDecoder(cs || 'utf-8').decode(buf); } catch (e) { return new TextDecoder('utf-8').decode(buf); }
}

/* ---------- rewriting ---------- */
const SKIP = /^\s*(#|data:|javascript:|mailto:|tel:|blob:|about:|sms:)/i;
function proxied(u, base) {
  u = unesc(String(u)).trim();
  if (!u || SKIP.test(u)) return null;
  try {
    const a = new URL(u, base);
    if (a.protocol !== 'http:' && a.protocol !== 'https:') return null;
    return { abs: a.href, url: '/p?u=' + encodeURIComponent(a.href) };
  } catch (e) { return null; }
}
function rewriteCSS(css, base) {
  css = css.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (m, q, u) => {
    const p = proxied(u, base); return p ? 'url("' + p.url + '")' : m;
  });
  return css.replace(/@import\s+(["'])([^"']+)\1/gi, (m, q, u) => {
    const p = proxied(u, base); return p ? '@import "' + p.url + '"' : m;
  });
}
function rewriteSrcset(v, base) {
  return unesc(v).split(',').map(part => {
    const bits = part.trim().split(/\s+/);
    const p = bits[0] && proxied(bits[0], base);
    return p ? [p.url].concat(bits.slice(1)).join(' ') : part.trim();
  }).join(', ');
}

// Runs inside proxied pages (stringified and injected). Keeps requests, links, forms and history in the proxy.
function shim() {
  var B = window.__PXB;
  var BAD = /^\s*(#|data:|javascript:|mailto:|tel:|blob:|about:|sms:)/i;
  function ok(u) { return typeof u === 'string' && u.trim() !== '' && !BAD.test(u); }
  function abs(u) { try { return new URL(u, B).href; } catch (e) { return null; } }
  function prox(u) {
    u = String(u);
    if (!ok(u)) return u;
    if (u.indexOf('/p?u=') === 0 || u.indexOf(location.origin + '/p?u=') === 0) return u;
    var a = abs(u);
    if (!a || !/^https?:/i.test(a)) return u;
    return '/p?u=' + encodeURIComponent(a);
  }
  var f = window.fetch;
  if (f) window.fetch = function (i, init) {
    try {
      if (typeof i === 'string' || i instanceof URL) i = prox(i);
      else if (i && i.url) i = new Request(prox(i.url), i);
    } catch (e) {}
    return f.call(this, i, init);
  };
  var xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { arguments[1] = prox(u); return xo.apply(this, arguments); };
  window.open = function (u) { if (u) location.href = prox(u); return null; };
  try {
    ['pushState', 'replaceState'].forEach(function (k) {
      var o = history[k];
      history[k] = function (s, t, u) {
        if (u) { var a = abs(u); if (a) { B = a; post(); } }
        return o.call(this, s, t);
      };
    });
  } catch (e) {}
  [[HTMLImageElement, 'src'], [HTMLScriptElement, 'src'], [HTMLIFrameElement, 'src'], [HTMLSourceElement, 'src'],
   [HTMLMediaElement, 'src'], [HTMLEmbedElement, 'src'], [HTMLLinkElement, 'href']].forEach(function (p) {
    var d = Object.getOwnPropertyDescriptor(p[0].prototype, p[1]);
    if (d && d.set) Object.defineProperty(p[0].prototype, p[1], {
      get: d.get, set: function (v) { d.set.call(this, prox(v)); }, configurable: true
    });
  });
  var sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    if (/^(src|href|action|poster)$/i.test(n) && this.tagName !== 'A') v = prox(v);
    return sa.call(this, n, v);
  };
  if (navigator.serviceWorker) navigator.serviceWorker.register = function () { return Promise.reject(new Error('blocked')); };
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || a.hasAttribute('download')) return;
    var h = a.getAttribute('href');
    if (!ok(h)) return;
    e.preventDefault();
    location.href = prox(h);
  }, true);
  document.addEventListener('submit', function (e) {
    var fm = e.target;
    if (!fm || fm.tagName !== 'FORM') return;
    if ((fm.getAttribute('method') || 'get').toLowerCase() !== 'get') return;
    e.preventDefault();
    var ac = fm.getAttribute('action') || '';
    var a = fm.getAttribute('data-pxa') || (ac.indexOf('/p?u=') === 0 ? decodeURIComponent(ac.slice(5)) : abs(ac)) || B;
    var u = new URL(a), s = new URLSearchParams();
    new FormData(fm).forEach(function (v, k) { if (typeof v === 'string') s.append(k, v); });
    u.search = s.toString();
    location.href = prox(u.href);
  }, true);
  function post() { try { parent.postMessage({ type: 'proxy-nav', url: B, title: document.title || '' }, '*'); } catch (e) {} }
  post();
  addEventListener('DOMContentLoaded', post);
  addEventListener('load', post);
}

function rewriteHTML(html, base) {
  let b = base;
  html = html.replace(/<base\b[^>]*>/gi, m => {
    const h = /href\s*=\s*["']?([^"'\s>]+)/i.exec(m);
    if (h) { try { b = new URL(unesc(h[1]), base).href; } catch (e) {} }
    return '';
  });
  html = html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy[^>]*>/gi, '');
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, m => rewriteCSS(m, b));
  html = html.replace(/<([a-z][a-z0-9-]*)(\s[^>]*)?>/gi, (m, tag, attrs) => {
    if (!attrs) return m;
    const t = tag.toLowerCase();
    let extra = '';
    attrs = attrs
      .replace(/\s(?:integrity|nonce)\s*=\s*("[^"]*"|'[^']*')/gi, '')
      .replace(/\scrossorigin(?:\s*=\s*("[^"]*"|'[^']*'))?/gi, '')
      .replace(/\s(href|src|action|poster|formaction|srcset|style)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (all, name, d, s) => {
        const v = d !== undefined ? d : s;
        name = name.toLowerCase();
        if (name === 'srcset') return ' srcset="' + esc(rewriteSrcset(v, b)) + '"';
        if (name === 'style') return ' style="' + esc(rewriteCSS(unesc(v), b)) + '"';
        const p = proxied(v, b);
        if (!p) return all;
        if (t === 'form' && name === 'action') extra = ' data-pxa="' + esc(p.abs) + '"';
        return ' ' + name + '="' + p.url + '"';
      });
    return '<' + tag + attrs + extra + '>';
  });
  const inject = '<script>window.__PXB=' + JSON.stringify(b).replace(/</g, '\\u003c') + ';(' + shim.toString() + ')();</script>';
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, m => m + inject);
  return inject + html;
}

/* ---------- /p handler ---------- */
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > max) { req.destroy(); return reject(new Error('Request too large')); } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleProxy(req, res, qs) {
  if (!authed(req)) return sendError(res, 401, 'Access key required. Open the Browser tab to enter it.');
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'HEAD') return sendError(res, 405, 'Method not allowed');
  const target = qs.get('u');
  if (!target) return sendError(res, 400, 'Missing ?u= address');

  let body = null;
  if (req.method === 'POST') body = await readBody(req, MAX_POST);
  const headers = {
    'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
    'accept': req.headers['accept'] || '*/*',
    'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate, br'
  };
  if (req.headers.range) headers.range = req.headers.range;
  if (body && req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

  let up;
  try { up = await upstream(target, req.method === 'HEAD' ? 'GET' : req.method, headers, body, req.headers.host); }
  catch (e) { return sendError(res, 502, e.message || 'Could not reach that site'); }
  const { res: ur, url } = up;
  req.on('close', () => ur.destroy());

  const ct = String(ur.headers['content-type'] || '');
  const out = { 'cache-control': 'no-store' };
  const isHTML = /text\/html|application\/xhtml/i.test(ct);
  const isCSS = /text\/css/i.test(ct);

  if (isHTML || isCSS) {
    let buf;
    try { buf = await collect(decoder(ur), MAX_HTML); } catch (e) { return sendError(res, 502, e.message); }
    const text = decodeText(buf, ct, isHTML);
    const result = isHTML ? rewriteHTML(text, url.href) : rewriteCSS(text, url.href);
    out['content-type'] = (isHTML ? 'text/html' : 'text/css') + '; charset=utf-8';
    res.writeHead(ur.statusCode, out);
    return res.end(req.method === 'HEAD' ? undefined : result);
  }

  // everything else (images, scripts, fonts, video...) streams straight through
  if (ct) out['content-type'] = ct;
  ['content-length', 'content-encoding', 'content-range', 'accept-ranges', 'content-disposition', 'last-modified', 'etag']
    .forEach(k => { if (ur.headers[k]) out[k] = ur.headers[k]; });
  res.writeHead(ur.statusCode, out);
  if (req.method === 'HEAD') { ur.destroy(); return res.end(); }
  ur.pipe(res);
  ur.on('error', () => res.destroy());
}

/* ---------- static files ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.swf': 'application/x-shockwave-flash', '.data': 'application/octet-stream', '.unityweb': 'application/octet-stream'
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml|javascript)|image\/svg)/;
const BLOCKED = /(^|\/)(\.|node_modules|server\.js$|package(-lock)?\.json$|render\.yaml$|tools\/)/i;

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return sendError(res, 400, 'Bad request'); }
  if (rel.includes('\0')) return sendError(res, 400, 'Bad request');
  let file = path.join(ROOT, path.normalize('/' + rel));
  if (!file.startsWith(ROOT)) return sendError(res, 403, 'Forbidden');
  if (BLOCKED.test(path.relative(ROOT, file).replace(/\\/g, '/'))) return sendError(res, 404, 'Not found');

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { location: pathname + '/' }); return res.end(); }
      file = path.join(file, 'index.html');
      return fs.stat(file, (e2, s2) => (e2 ? sendError(res, 404, 'Not found') : send(file, s2)));
    }
    if (err) return sendError(res, 404, 'Not found');
    send(file, st);
  });

  function send(f, st) {
    const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
    const h = { 'content-type': type, 'accept-ranges': 'bytes', 'last-modified': st.mtime.toUTCString() };
    h['cache-control'] = /^(text\/html)/.test(type) ? 'no-cache' : 'public, max-age=3600';
    const ims = req.headers['if-modified-since'];
    if (ims && new Date(ims) >= new Date(st.mtime.toUTCString())) { res.writeHead(304, h); return res.end(); }

    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? parseInt(range[1], 10) : st.size - parseInt(range[2], 10);
      let end = range[1] && range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (start < 0) start = 0;
      if (start >= st.size || end >= st.size) end = st.size - 1;
      if (start > end) { res.writeHead(416, { 'content-range': 'bytes */' + st.size }); return res.end(); }
      h['content-range'] = 'bytes ' + start + '-' + end + '/' + st.size;
      h['content-length'] = end - start + 1;
      res.writeHead(206, h);
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(f, { start, end }).pipe(res);
    }
    const gz = COMPRESSIBLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && st.size > 1024;
    if (gz) { h['content-encoding'] = 'gzip'; h.vary = 'Accept-Encoding'; } else h['content-length'] = st.size;
    res.writeHead(200, h);
    if (req.method === 'HEAD') return res.end();
    const rs = fs.createReadStream(f);
    rs.on('error', () => res.destroy());
    (gz ? rs.pipe(zlib.createGzip({ level: 6 })) : rs).pipe(res);
  }
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/p/health') {
      return sendJSON(res, 200, { ok: true, locked: !!KEY, authed: authed(req) });
    }
    if (u.pathname === '/p/login') {
      const ip = clientIP(req);
      if (!KEY) return sendJSON(res, 200, { ok: true });
      if (tooManyAttempts(ip)) return sendJSON(res, 429, { ok: false, error: 'Too many attempts, try again later' });
      if (safeEq(u.searchParams.get('k') || '', KEY)) {
        const secure = String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https' ? '; Secure' : '';
        return sendJSON(res, 200, { ok: true }, { 'set-cookie': 'pk=' + TOKEN + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000' + secure });
      }
      attempts.get(ip).push(Date.now());
      return sendJSON(res, 401, { ok: false });
    }
    if (u.pathname === '/p') return await handleProxy(req, res, u.searchParams);
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, 405, 'Method not allowed');
    serveStatic(req, res, u.pathname);
  } catch (e) {
    sendError(res, 500, 'Server error: ' + (e && e.message ? e.message : e));
  }
});
server.headersTimeout = 30000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Site + proxy running on http://localhost:' + PORT + (KEY ? '  (proxy key required)' : '  (no PROXY_KEY set - proxy is open!)'));
});
