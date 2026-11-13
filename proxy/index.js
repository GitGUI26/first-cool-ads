const MAX_HTML = 25 * 1024 * 1024;
const MAX_BODY = 10 * 1024 * 1024;
const MAX_REDIRECTS = 6;
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400'
};

const SKIP = /^\s*(#|data:|javascript:|mailto:|tel:|blob:|about:|sms:)/i;
const TEXT_TYPES = /^(text\/html|application\/xhtml\+xml|text\/css)/i;
const ROUTE = '/p/';

function encodeTarget(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeTarget(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(value || ''))) return '';
  try {
    const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (error) {
    return '';
  }
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function unesc(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function errorResponse(status, message) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font:15px system-ui;background:#0f1115;color:#e8eaf0;padding:40px"><h2>${status}</h2><p>${esc(message)}</p>`,
    {
      status,
      headers: {
        ...CORS,
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      }
    }
  );
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '0.0.0.0') return true;
  if (host === '::' || host === '::1') return true;
  if (/^f[cd]/.test(host) || /^fe[89ab]/.test(host) || /^ff/.test(host)) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || a >= 224;
  }
  return false;
}

function parseTarget(value) {
  let url;
  try { url = new URL(value); } catch (error) { throw new Error('Invalid URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https URLs are supported');
  if (!ALLOWED_PORTS.has(url.port)) throw new Error('Blocked: port not allowed');
  if (isPrivateHost(url.hostname)) throw new Error('Blocked: private or local address');
  if (url.username || url.password) throw new Error('Blocked: credentials in URL');
  return url;
}

function proxied(value, base) {
  const target = unesc(String(value)).trim();
  if (!target || SKIP.test(target)) return null;
  try {
    const url = new URL(target, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return { abs: url.href, url: ROUTE + encodeTarget(url.href) };
  } catch (error) {
    return null;
  }
}

function rewriteCSS(css, base) {
  css = css.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (match, quote, value) => {
    const item = proxied(value, base);
    return item ? `url("${item.url}")` : match;
  });
  return css.replace(/@import\s+(["'])([^"']+)\1/gi, (match, quote, value) => {
    const item = proxied(value, base);
    return item ? `@import "${item.url}"` : match;
  });
}

function rewriteSrcset(value, base) {
  return unesc(value).split(',').map(part => {
    const bits = part.trim().split(/\s+/);
    const item = bits[0] && proxied(bits[0], base);
    return item ? [item.url].concat(bits.slice(1)).join(' ') : part.trim();
  }).join(', ');
}

function clientShim() {
  const BAD = /^\s*(#|data:|javascript:|mailto:|tel:|blob:|about:|sms:)/i;
  const ROUTE = '/p/';
  let base = window.__PXB;
  function encodeTarget(value) {
    const bytes = new TextEncoder().encode(String(value));
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeTarget(value) {
    try {
      const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
      return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
    } catch (error) {
      return '';
    }
  }
  function isProxyUrl(value) {
    return value.indexOf(ROUTE) === 0 || value.indexOf(location.origin + ROUTE) === 0 ||
      value.indexOf('/p?u=') === 0 || value.indexOf(location.origin + '/p?u=') === 0;
  }
  function allowed(value) {
    return typeof value === 'string' && value.trim() !== '' && !BAD.test(value);
  }
  function absolute(value) {
    try { return new URL(value, base).href; } catch (error) { return null; }
  }
  function proxy(value) {
    value = String(value);
    if (!allowed(value)) return value;
    if (isProxyUrl(value)) return value;
    const next = absolute(value);
    if (!next || !/^https?:/i.test(next)) return value;
    return ROUTE + encodeTarget(next);
  }
  const nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = function(input, init) {
      try {
        if (typeof input === 'string' || input instanceof URL) input = proxy(input);
        else if (input && input.url) input = new Request(proxy(input.url), input);
      } catch (error) {}
      return nativeFetch.call(this, input, init);
    };
  }
  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    arguments[1] = proxy(url);
    return nativeOpen.apply(this, arguments);
  };
  window.open = function(url) {
    if (url) location.href = proxy(url);
    return null;
  };
  try {
    ['pushState', 'replaceState'].forEach(method => {
      const original = history[method];
      history[method] = function(state, title, url) {
        if (url) {
          const next = absolute(url);
          if (next) { base = next; post(); }
        }
        return original.call(this, state, title);
      };
    });
  } catch (error) {}
  [
    [HTMLImageElement, 'src'], [HTMLScriptElement, 'src'], [HTMLIFrameElement, 'src'],
    [HTMLSourceElement, 'src'], [HTMLMediaElement, 'src'], [HTMLEmbedElement, 'src'],
    [HTMLLinkElement, 'href']
  ].forEach(([ctor, key]) => {
    const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, key);
    if (descriptor && descriptor.set) {
      Object.defineProperty(ctor.prototype, key, {
        get: descriptor.get,
        set(value) { descriptor.set.call(this, proxy(value)); },
        configurable: true
      });
    }
  });
  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (/^(src|href|action|poster)$/i.test(name) && this.tagName !== 'A') value = proxy(value);
    return nativeSetAttribute.call(this, name, value);
  };
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('Service workers are disabled in the proxy'));
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const anchor = event.target && event.target.closest && event.target.closest('a[href]');
    if (!anchor || anchor.hasAttribute('download')) return;
    const href = anchor.getAttribute('href');
    if (!allowed(href)) return;
    event.preventDefault();
    location.href = proxy(href);
  }, true);
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    if ((form.getAttribute('method') || 'get').toLowerCase() !== 'get') return;
    event.preventDefault();
    const action = form.getAttribute('action') || '';
    const target = form.getAttribute('data-pxa') || (action.indexOf(ROUTE) === 0 ? decodeTarget(action.slice(ROUTE.length)) : (action.indexOf('/p?u=') === 0 ? decodeURIComponent(action.slice(5)) : absolute(action))) || base;
    const next = new URL(target);
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === 'string') params.append(key, value);
    });
    next.search = params.toString();
    location.href = proxy(next.href);
  }, true);
  function post() {
    try { parent.postMessage({ type: 'proxy-nav', url: base, title: document.title || '' }, '*'); } catch (error) {}
  }
  post();
  addEventListener('DOMContentLoaded', post);
  addEventListener('load', post);
}

function rewriteHTML(html, base) {
  let pageBase = base;
  html = html.replace(/<base\b[^>]*>/gi, tag => {
    const href = /href\s*=\s*["']?([^"'\s>]+)/i.exec(tag);
    if (href) {
      try { pageBase = new URL(unesc(href[1]), base).href; } catch (error) {}
    }
    return '';
  });
  html = html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy[^>]*>/gi, '');
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, tag => rewriteCSS(tag, pageBase));
  html = html.replace(/<([a-z][a-z0-9-]*)(\s[^>]*)?>/gi, (match, tag, attrs) => {
    if (!attrs) return match;
    const lowerTag = tag.toLowerCase();
    let formAction = '';
    attrs = attrs
      .replace(/\s(?:integrity|nonce)\s*=\s*("[^"]*"|'[^']*')/gi, '')
      .replace(/\scrossorigin(?:\s*=\s*("[^"]*"|'[^']*'))?/gi, '')
      .replace(/\s(href|src|action|poster|formaction|srcset|style)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi, (all, name, doubleQuoted, singleQuoted, unquoted) => {
        const value = doubleQuoted !== undefined ? doubleQuoted : (singleQuoted !== undefined ? singleQuoted : unquoted);
        name = name.toLowerCase();
        if (name === 'srcset') return ' srcset="' + esc(rewriteSrcset(value, pageBase)) + '"';
        if (name === 'style') return ' style="' + esc(rewriteCSS(unesc(value), pageBase)) + '"';
        const item = proxied(value, pageBase);
        if (!item) return all;
        if (lowerTag === 'form' && name === 'action') formAction = ' data-pxa="' + esc(item.abs) + '"';
        return ' ' + name + '="' + item.url + '"';
      });
    return '<' + tag + attrs + formAction + '>';
  });
  // Wrangler's bundler adds a keep-names helper named __name. The shim is
  // serialized with toString(), so that helper must exist in the page too.
  const inject = '<script>window.__PXB=' + JSON.stringify(pageBase).replace(/</g, '\\u003c') + ';function __name(fn){return fn};(' + clientShim.toString() + ')();<\/script>';
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, match => match + inject);
  return inject + html;
}

function decodeText(buffer, contentType) {
  const charset = (/charset\s*=\s*["']?([\w-]+)/i.exec(contentType || '') || [])[1] || 'utf-8';
  try { return new TextDecoder(charset).decode(buffer); } catch (error) { return new TextDecoder('utf-8').decode(buffer); }
}

function safeHeaders(upstream, isHTML, isCSS) {
  const headers = new Headers();
  const passthrough = ['content-type', 'content-disposition', 'accept-ranges', 'content-range', 'last-modified', 'etag'];
  passthrough.forEach(name => {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  });
  if (isHTML) headers.set('content-type', 'text/html; charset=utf-8');
  if (isCSS) headers.set('content-type', 'text/css; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET, HEAD, POST, OPTIONS');
  headers.set('access-control-allow-headers', '*');
  headers.delete('set-cookie');
  headers.delete('content-security-policy');
  headers.delete('content-security-policy-report-only');
  headers.delete('x-frame-options');
  headers.delete('strict-transport-security');
  headers.delete('content-length');
  headers.delete('content-encoding');
  return headers;
}

async function follow(target, method, headers, body) {
  let current = target;
  let currentMethod = method;
  let currentBody = body;
  let currentHeaders = headers;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    const url = parseTarget(current);
    const response = await fetch(url.href, {
      method: currentMethod,
      headers: currentHeaders,
      body: currentMethod === 'GET' || currentMethod === 'HEAD' ? undefined : currentBody,
      redirect: 'manual'
    });
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.get('location')) {
      if (redirects === MAX_REDIRECTS) throw new Error('Too many redirects');
      const next = new URL(response.headers.get('location'), url).href;
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && currentMethod === 'POST')) {
        currentMethod = 'GET';
        currentBody = null;
        currentHeaders = { ...currentHeaders };
        delete currentHeaders['content-type'];
        delete currentHeaders['content-length'];
      }
      current = next;
      continue;
    }
    return { response, url: url.href };
  }
  throw new Error('Too many redirects');
}

async function handleProxy(request, url) {
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) return errorResponse(405, 'Method not allowed');
  const target = url.searchParams.get('u') || decodeTarget(url.pathname.slice(ROUTE.length));
  if (!target) return errorResponse(400, 'Missing target address');

  let body = null;
  if (request.method === 'POST') {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY) return errorResponse(413, 'Request body too large');
  }

  const headers = {
    'user-agent': request.headers.get('user-agent') || 'Mozilla/5.0',
    accept: request.headers.get('accept') || '*/*',
    'accept-language': request.headers.get('accept-language') || 'en-US,en;q=0.9'
  };
  const range = request.headers.get('range');
  if (range) headers.range = range;
  const contentType = request.headers.get('content-type');
  if (contentType && body) headers['content-type'] = contentType;

  let upstream;
  try {
    upstream = await follow(target, request.method === 'HEAD' ? 'HEAD' : request.method, headers, body);
  } catch (error) {
    return errorResponse(502, error.message || 'Could not reach that site');
  }

  const response = upstream.response;
  const upstreamType = String(response.headers.get('content-type') || '');
  const isHTML = /text\/html|application\/xhtml\+xml/i.test(upstreamType);
  const isCSS = /text\/css/i.test(upstreamType);

  if (request.method === 'HEAD') {
    return new Response(null, { status: response.status, headers: safeHeaders(response, isHTML, isCSS) });
  }

  if (isHTML || isCSS) {
    let buffer;
    try {
      buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_HTML) return errorResponse(502, 'Page too large');
    } catch (error) {
      return errorResponse(502, 'Could not read that page');
    }
    const text = decodeText(buffer, upstreamType);
    const rewritten = isHTML ? rewriteHTML(text, upstream.url) : rewriteCSS(text, upstream.url);
    return new Response(rewritten, {
      status: response.status,
      headers: safeHeaders(response, isHTML, isCSS)
    });
  }

  const headersOut = safeHeaders(response, false, false);
  if (response.status === 204 || response.status === 304 || !response.body) {
    return new Response(null, { status: response.status, headers: headersOut });
  }
  return new Response(response.body, { status: response.status, headers: headersOut });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/p/health') return jsonResponse({ ok: true, locked: false, authed: true, network: 'cloudflare', routing: 'opaque' });
    if (url.pathname === '/p/login') return jsonResponse({ ok: true });
    if (url.pathname === '/p' || url.pathname.startsWith(ROUTE)) return handleProxy(request, url);
    return new Response('Proxy backend is running. Use /p/<encoded-url>.', {
      status: 404,
      headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};
