/*
 * Bare endpoint for the COOL browser's Ultraviolet proxy.
 *
 * Ultraviolet's service worker cannot open sockets itself; it asks a "bare"
 * server to fetch pages for it. This module speaks the Bare v1 protocol the
 * Ultraviolet build in /browser/uv uses, so the worker can serve that role
 * without a separate Node relay.
 *
 *   GET   /bare/            -> version banner (used as a health check)
 *   POST  /bare/v1/         -> fetch the URL described by the x-bare-* headers
 *   WS    /bare/v1/         -> tunnel a WebSocket to the target site
 *
 * Every request is described by headers, never by the path, so target hostnames
 * stay out of the site's URLs.
 */

const VERSION = 'v1';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'x-bare-headers, x-bare-status, x-bare-status-text, x-bare-version',
  'access-control-max-age': '86400',
};

// Headers the worker's runtime owns, or that only make sense on a single hop.
const STRIP_REQUEST = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'expect',
  'host',
  'keep-alive',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-bare-forward-headers',
  'x-bare-headers',
  'x-bare-host',
  'x-bare-path',
  'x-bare-port',
  'x-bare-protocol',
]);

const STRIP_RESPONSE = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'transfer-encoding',
  'upgrade',
]);

const EMPTY_BODY_STATUS = new Set([101, 204, 205, 304]);

function base64UrlToText(value) {
  try {
    const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (error) {
    return '';
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function blockedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host) || /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(host)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host)) return true;
  return false;
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function targetUrl(headers) {
  const protocol = headers.get('x-bare-protocol') === 'http:' ? 'http:' : 'https:';
  const host = headers.get('x-bare-host') || '';
  const port = headers.get('x-bare-port') || '';
  const path = headers.get('x-bare-path') || '/';
  if (!host || blockedHost(host)) return null;
  const defaultPort = protocol === 'http:' ? '80' : '443';
  const authority = port && port !== defaultPort ? host + ':' + port : host;
  try {
    const url = new URL(protocol + '//' + authority + (path.startsWith('/') ? path : '/' + path));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (blockedHost(url.hostname)) return null;
    return url;
  } catch (error) {
    return null;
  }
}

function upstreamHeaders(value) {
  const source = parseJson(value, {});
  const headers = new Headers();
  for (const [key, raw] of Object.entries(source || {})) {
    const name = String(key).toLowerCase();
    if (STRIP_REQUEST.has(name)) continue;
    if (raw === undefined || raw === null) continue;
    const text = Array.isArray(raw) ? raw.join(', ') : String(raw);
    try {
      headers.set(name, text);
    } catch (error) {}
  }
  return headers;
}

function responseHeaders(response) {
  const collected = {};
  response.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (STRIP_RESPONSE.has(name) || name.startsWith('x-bare-')) return;
    collected[name] = value;
  });
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (cookies.length) collected['set-cookie'] = cookies;
  return collected;
}

async function handleHttp(request) {
  const url = targetUrl(request.headers);
  if (!url) return jsonResponse({ error: 'That host cannot be proxied.' }, 403);

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const init = {
    method,
    headers: upstreamHeaders(request.headers.get('x-bare-headers')),
    redirect: 'manual',
  };
  if (hasBody && request.body) {
    init.body = request.body;
    init.duplex = 'half';
  }

  let response;
  try {
    response = await globalThis.fetch(url.toString(), init);
  } catch (error) {
    return jsonResponse({ error: 'The site could not be reached.', detail: String(error && error.message || error) }, 502);
  }

  const headers = new Headers(CORS);
  headers.set('x-bare-headers', JSON.stringify(responseHeaders(response)));
  headers.set('x-bare-status', String(response.status));
  headers.set('x-bare-status-text', response.statusText || '');
  headers.set('x-bare-version', VERSION);

  const body = EMPTY_BODY_STATUS.has(response.status) ? null : response.body;
  return new Response(body, { status: response.status, headers });
}

function websocketTarget(headers) {
  const protocol = headers.get('sec-websocket-protocol') || '';
  const encoded = protocol.split(',').map(part => part.trim()).filter(part => part && part !== 'bare')[0];
  const meta = parseJson(base64UrlToText(encoded), null);
  if (!meta || !meta.remote) return null;
  const remote = meta.remote;
  const tls = remote.protocol === 'wss:';
  const port = remote.port || (tls ? '443' : '80');
  if (blockedHost(remote.host)) return null;
  const url = new URL((tls ? 'wss:' : 'ws:') + '//' + remote.host + ':' + port + (remote.path || '/'));
  const outgoing = new Headers();
  for (const [key, raw] of Object.entries(meta.headers || {})) {
    const name = String(key).toLowerCase();
    if (STRIP_REQUEST.has(name) || name === 'origin' || name === 'sec-websocket-protocol' || name === 'sec-websocket-key' || name === 'sec-websocket-version' || name === 'sec-websocket-extensions') continue;
    try {
      outgoing.set(name, Array.isArray(raw) ? raw.join(', ') : String(raw));
    } catch (error) {}
  }
  return { url, headers: outgoing };
}

async function handleWebSocket(request) {
  const target = websocketTarget(request.headers);
  if (!target) return new Response('Unsupported WebSocket target.', { status: 400 });

  let upstreamResponse;
  try {
    upstreamResponse = await globalThis.fetch(target.url.toString(), {
      headers: target.headers,
      redirect: 'manual',
    });
  } catch (error) {
    return new Response('The WebSocket could not be reached.', { status: 502 });
  }

  const upstream = upstreamResponse.webSocket;
  if (!upstream) return new Response('The site did not accept a WebSocket.', { status: 502 });

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  upstream.accept();

  server.addEventListener('message', event => {
    try {
      upstream.send(event.data);
    } catch (error) {}
  });
  upstream.addEventListener('message', event => {
    try {
      server.send(event.data);
    } catch (error) {}
  });
  const close = socket => {
    try {
      socket.close();
    } catch (error) {}
  };
  server.addEventListener('close', () => close(upstream));
  server.addEventListener('error', () => close(upstream));
  upstream.addEventListener('close', () => close(server));
  upstream.addEventListener('error', () => close(server));

  return new Response(null, {
    status: 101,
    webSocket: client,
    headers: { 'sec-websocket-protocol': 'bare' },
  });
}

export async function fetch(request) {
  if (!request || !request.url) return jsonResponse({ error: 'Bad request.' }, 400);
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/bare';

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (path === '/bare' || path === '/bare/v1') {
    // Ultraviolet describes every proxied request with headers and keeps the
    // target's own method, so a GET with x-bare-host is a page fetch, not a
    // version check. Only a plain GET without those headers asks for the banner.
    if (targetUrl(request.headers)) {
      const upgrade = (request.headers.get('upgrade') || '').toLowerCase();
      if (upgrade === 'websocket') return handleWebSocket(request);
      return handleHttp(request);
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      return jsonResponse({ versions: [VERSION], language: 'en-US', project: 'cool-browser' });
    }
    return jsonResponse({ error: 'That host cannot be proxied.' }, 403);
  }

  return jsonResponse({ error: 'Unknown bare route.' }, 404);
}

export default { fetch };
