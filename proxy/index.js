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

function safeHeaders(upstream, isHTML, isCSS, cacheControl) {
  const headers = new Headers();
  const passthrough = ['content-type', 'content-disposition', 'accept-ranges', 'content-range', 'last-modified', 'etag'];
  passthrough.forEach(name => {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  });
  if (isHTML) headers.set('content-type', 'text/html; charset=utf-8');
  if (isCSS) headers.set('content-type', 'text/css; charset=utf-8');
  // HTML is never cached; assets carry a real lifetime so the browser itself
  // can reuse them instead of re-fetching every image on every page view.
  headers.set('cache-control', cacheControl || 'no-store');
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

/* ---------------------------------------------------------------- routes */

// A browser-like request profile. Datacenter egress is what most sites object
// to, but a real UA plus fetch metadata removes the trivial bot rejections.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BLOCKED_STATUS = new Set([401, 403, 407, 429, 451, 503]);
const BLOCK_MARKERS = [
  /unusual traffic/i,
  /\/sorry\/index/i,
  /not a robot/i,
  /attention required/i,
  /just a moment\.\.\./i,
  /checking your browser/i,
  /verify you are human/i,
  /access denied/i,
  /request (?:was )?blocked/i,
  /enable javascript and cookies/i,
  /cf-error-details/i
];
const READER_GATEWAY = 'https://r.jina.ai/';

// Static subresources are cached at the edge: a repeat visit to a game page or
// site then costs no upstream fetch at all. HTML stays uncached.
const CACHE_TTL_DEFAULT = 300;
const CACHE_TTL_MAX = 3600;
const CACHEABLE_TYPE = /^(image\/|font\/|application\/font|text\/css|application\/javascript|text\/javascript|application\/wasm|video\/|audio\/)/i;

function cacheTtl(header) {
  const value = String(header || '');
  if (/no-store|private/i.test(value)) return 0;
  const shared = /s-maxage=(\d+)/i.exec(value);
  const maxAge = /max-age=(\d+)/i.exec(value);
  const seconds = Number((shared && shared[1]) || (maxAge && maxAge[1]) || CACHE_TTL_DEFAULT);
  if (!Number.isFinite(seconds) || seconds <= 0) return CACHE_TTL_DEFAULT;
  return Math.max(60, Math.min(CACHE_TTL_MAX, seconds));
}

function relayOrigins(env) {
  const raw = String((env && env.PROXY_RELAYS) || '');
  return raw.split(',')
    .map(value => value.trim().replace(/\/+$/, ''))
    .filter(value => /^https?:\/\/[^\s]+$/i.test(value));
}

function upstreamHeaders(request, body) {
  const clientUA = String(request.headers.get('user-agent') || '');
  const headers = {
    'user-agent': /Mozilla\/5\.0/.test(clientUA) ? clientUA : BROWSER_UA,
    accept: request.headers.get('accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': request.headers.get('accept-language') || 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    pragma: 'no-cache'
  };
  const range = request.headers.get('range');
  if (range) headers.range = range;
  const contentType = request.headers.get('content-type');
  if (contentType && body) headers['content-type'] = contentType;
  return headers;
}

// A captcha or JS challenge is worth passing through: the visitor can still
// solve it. A hard block page cannot be, so it goes down the ladder instead.
const CHALLENGE_MARKERS = [/recaptcha/i, /g-recaptcha/i, /hcaptcha/i, /captcha/i, /challenge-platform/i, /cf-chl/i];

function injectBanner(html, target) {
  const banner = '<div style="position:fixed;left:0;right:0;top:0;z-index:2147483647;display:flex;gap:12px;' +
    'align-items:center;justify-content:center;flex-wrap:wrap;padding:8px 14px;background:#1b2440;color:#e8eaf0;' +
    'font:13px/1.4 system-ui,sans-serif;border-bottom:1px solid #33406b">' +
    '<span>This site answered with a verification page.</span>' +
    '<a style="color:#9db4ff" href="' + esc(ROUTE + 'reader/' + encodeTarget(target)) + '">Open the text-only reader view</a>' +
    '<a style="color:#9db4ff" href="' + esc(ROUTE + encodeTarget(target)) + '">Reload</a></div>';
  if (/<body\b[^>]*>/i.test(html)) return html.replace(/<body\b[^>]*>/i, match => match + banner);
  return banner + html;
}

function blockedPage(target, reason, routes) {
  const list = routes.length
    ? '<ul>' + routes.map(route => `<li>${esc(route)}</li>`).join('') + '</ul>'
    : '<p>No relay is configured for this proxy.</p>';
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
    `<title>Blocked upstream</title>` +
    `<body style="font:15px/1.6 system-ui;background:#0f1115;color:#e8eaf0;padding:40px;max-width:720px;margin:0 auto">` +
    `<h2 style="margin:0 0 8px">That site refused the proxy</h2>` +
    `<p style="color:#9aa4bd;margin:0 0 18px">${esc(target)} answered ${esc(reason)}. The request never reached your device — the site is rejecting the proxy server itself.</p>` +
    `<p style="margin:0 0 6px"><strong>Routes tried</strong></p>${list}` +
    `<p style="margin:18px 0 0"><a style="color:#7c8cff" href="${esc(ROUTE + 'reader/' + encodeTarget(target))}">Open a text-only reader view</a> ` +
    `or <a style="color:#7c8cff" href="${esc(ROUTE + encodeTarget(target))}">try again</a>.</p>` +
    `<p style="color:#9aa4bd;font-size:13px;margin-top:22px">Adding a relay on a different network (the Browser tab's Proxy network panel) usually clears an IP-level block.</p>`, {
      status: 502,
      headers: { ...CORS, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
    }
  );
}

function readerPage(target, markdown, via) {
  const body = markdown
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^######\s?(.*)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s?(.*)$/gm, '<h5>$1</h5>')
    .replace(/^####\s?(.*)$/gm, '<h4>$1</h4>')
    .replace(/^###\s?(.*)$/gm, '<h3>$1</h3>')
    .replace(/^##\s?(.*)$/gm, '<h2>$1</h2>')
    .replace(/^#\s?(.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (match, label, href) =>
      `<a href="${esc(ROUTE + encodeTarget(href))}">${label}</a>`)
    .replace(/\n{2,}/g, '</p><p>');
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
    `<title>Reader view</title>` +
    `<body style="font:16px/1.7 system-ui;background:#0f1115;color:#e8eaf0;margin:0">` +
    `<div style="background:#17203a;padding:12px 20px;font-size:13px;color:#9aa4bd">Text-only reader view via ${esc(via)} — ` +
    `<a style="color:#7c8cff" href="${esc(ROUTE + encodeTarget(target))}">load the real page</a></div>` +
    `<article style="max-width:760px;margin:0 auto;padding:28px 20px 60px"><p>${body}</p></article>`, {
      status: 200,
      headers: { ...CORS, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
    }
  );
}

async function fetchReader(target, method) {
  if (method !== 'GET') return null;
  const response = await fetch(READER_GATEWAY + target, {
    headers: { accept: 'text/plain', 'x-respond-with': 'markdown' },
    redirect: 'follow'
  });
  if (!response.ok) return null;
  const text = await response.text();
  if (!text || text.length < 40) return null;
  return text;
}

/* Fetch a page through the route ladder: direct, then relays, then a reader. */
async function resolveUpstream(target, method, request, body, env) {
  const headers = upstreamHeaders(request, body);
  const routes = [];
  let lastError = '';

  let first;
  let challengeFallback = null;
  try {
    first = await follow(target, method, headers, body);
  } catch (error) {
    lastError = error.message || 'Could not reach that site';
  }

  if (first) {
    const type = String(first.response.headers.get('content-type') || '');
    const html = /text\/html|application\/xhtml\+xml/i.test(type);
    if (!html) return { upstream: first, route: 'direct' };
    // Only a block-ish status is inspected. Cloning and decoding every healthy
    // page doubled the bytes read and the CPU per request, and a real 404 or
    // 500 is the site's own page, not a proxy block.
    if (!BLOCKED_STATUS.has(first.response.status)) return { upstream: first, route: 'direct' };
    const peek = await first.response.clone().text().catch(() => '');
    const snippet = peek.slice(0, 6000);
    if (CHALLENGE_MARKERS.some(rx => rx.test(snippet))) {
      // Keep the challenge in reserve: a relay on another network may still
      // return the real page, which is always better than a captcha.
      challengeFallback = first;
      routes.push('direct → HTTP ' + first.response.status + ' (verification page)');
    } else {
      routes.push(`direct → HTTP ${first.response.status}${BLOCK_MARKERS.some(rx => rx.test(snippet)) ? ' (block page)' : ''}`);
    }
  } else {
    routes.push('direct → ' + lastError);
  }

  for (const relay of relayOrigins(env)) {
    try {
      const relayUrl = relay + '/p/raw?u=' + encodeURIComponent(target);
      const response = await fetch(relayUrl, { method: method === 'HEAD' ? 'GET' : method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : body, redirect: 'follow' });
      const status = Number(response.headers.get('x-upstream-status') || response.status) || 0;
      const type = String(response.headers.get('x-upstream-type') || response.headers.get('content-type') || '');
      if (response.ok && !BLOCKED_STATUS.has(status)) {
        const rebuilt = new Response(response.body, { status: status || 200, headers: { 'content-type': type || 'text/html; charset=utf-8' } });
        routes.push(relay + ' → HTTP ' + (status || 200));
        return { upstream: { response: rebuilt, url: target }, route: relay, routes };
      }
      routes.push(relay + ' → HTTP ' + (status || response.status));
    } catch (error) {
      routes.push(relay + ' → ' + (error.message || 'unreachable'));
    }
  }

  const markdown = await fetchReader(target, method).catch(() => null);
  if (markdown) {
    routes.push('reader gateway → 200');
    return { reader: { target, markdown, via: 'reader gateway' }, routes };
  }
  routes.push('reader gateway → unavailable');

  if (challengeFallback) {
    routes.push('served the site’s verification page so it can still be solved');
    return { upstream: challengeFallback, route: 'challenge', challenge: true, routes };
  }

  return { blocked: true, reason: lastError || 'a block page', routes };
}

async function handleProxy(request, url, env, ctx) {
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) return errorResponse(405, 'Method not allowed');
  const startedAt = Date.now();

  if (url.pathname.startsWith(ROUTE + 'reader/')) {
    const readerTarget = decodeTarget(url.pathname.slice((ROUTE + 'reader/').length));
    if (!readerTarget) return errorResponse(400, 'Missing target address');
    const markdown = await fetchReader(readerTarget, request.method).catch(() => null);
    if (!markdown) return errorResponse(502, 'The reader gateway could not fetch that page');
    return readerPage(readerTarget, markdown, 'reader gateway');
  }

  const target = url.searchParams.get('u') || decodeTarget(url.pathname.slice(ROUTE.length));
  if (!target) return errorResponse(400, 'Missing target address');
  try { parseTarget(target); } catch (error) { return errorResponse(400, error.message); }

  let body = null;
  if (request.method === 'POST') {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY) return errorResponse(413, 'Request body too large');
  }

  const cacheStore = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = cacheStore && ctx && request.method === 'GET' && !request.headers.get('range')
    ? new Request(new URL('/__pxc/' + encodeTarget(target), url.origin).href, { method: 'GET' })
    : null;

  if (cacheKey) {
    const hit = await cacheStore.match(cacheKey).catch(() => null);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set('x-proxy-cache', 'hit');
      headers.set('server-timing', `cache;dur=${Date.now() - startedAt}`);
      return new Response(hit.body, { status: 200, headers });
    }
  }

  const resolved = await resolveUpstream(target, request.method === 'HEAD' ? 'HEAD' : request.method, request, body, env);
  const upstreamAt = Date.now();
  if (resolved.reader) return readerPage(resolved.reader.target, resolved.reader.markdown, resolved.reader.via);
  if (resolved.blocked) return blockedPage(target, resolved.reason, resolved.routes);

  const { response, url: resolvedUrl } = resolved.upstream;
  const upstreamType = String(response.headers.get('content-type') || '');
  const isHTML = /text\/html|application\/xhtml\+xml/i.test(upstreamType);
  const isCSS = /text\/css/i.test(upstreamType);
  const route = resolved.route || 'direct';

  if (request.method === 'HEAD') {
    const headers = safeHeaders(response, isHTML, isCSS);
    headers.set('server-timing', `upstream;dur=${upstreamAt - startedAt}`);
    return new Response(null, { status: response.status, headers });
  }

  if (isHTML || isCSS) {
    let buffer;
    try {
      buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_HTML) return errorResponse(502, 'Page too large');
    } catch (error) {
      return errorResponse(502, 'Could not read that page');
    }
    const fetchedAt = Date.now();
    const text = decodeText(buffer, upstreamType);
    let rewritten = isHTML ? rewriteHTML(text, resolvedUrl) : rewriteCSS(text, resolvedUrl);
    if (isHTML && resolved.challenge) rewritten = injectBanner(rewritten, target);
    const cacheCss = Boolean(cacheKey && isCSS && response.status === 200);
    const ttl = cacheCss ? cacheTtl(response.headers.get('cache-control')) : 0;
    const headers = safeHeaders(response, isHTML, isCSS, ttl ? `public, max-age=${ttl}` : null);
    headers.set('x-proxy-route', route);
    headers.set('server-timing', `upstream;dur=${upstreamAt - startedAt}, body;dur=${fetchedAt - upstreamAt}, rewrite;dur=${Date.now() - fetchedAt}`);
    headers.set('x-proxy-cache', cacheCss ? 'miss' : 'bypass');
    if (ttl > 0) {
      const entryHeaders = new Headers(headers);
      entryHeaders.delete('x-proxy-cache');
      entryHeaders.delete('server-timing');
      entryHeaders.set('cache-control', `public, max-age=${ttl}`);
      ctx.waitUntil(cacheStore.put(cacheKey, new Response(rewritten, { status: 200, headers: entryHeaders })).catch(() => {}));
    }
    return new Response(rewritten, { status: response.status, headers });
  }

  const cacheable = Boolean(cacheKey && response.status === 200 && CACHEABLE_TYPE.test(upstreamType));
  const assetTtl = cacheable ? cacheTtl(response.headers.get('cache-control')) : 0;
  const headersOut = safeHeaders(response, false, false, assetTtl ? `public, max-age=${assetTtl}` : null);
  headersOut.set('x-proxy-route', route);
  headersOut.set('x-proxy-cache', cacheable ? 'miss' : 'bypass');
  headersOut.set('server-timing', `upstream;dur=${upstreamAt - startedAt}`);
  if (response.status === 204 || response.status === 304 || !response.body) {
    return new Response(null, { status: response.status, headers: headersOut });
  }

  const cacheCopy = cacheable ? response.clone() : null;
  const clientResponse = new Response(response.body, { status: response.status, headers: headersOut });

  if (cacheCopy && cacheKey && assetTtl > 0) {
    const entryHeaders = new Headers(headersOut);
    entryHeaders.delete('x-proxy-cache');
    entryHeaders.delete('server-timing');
    entryHeaders.set('cache-control', `public, max-age=${assetTtl}`);
    const entry = new Response(cacheCopy.body, { status: 200, headers: entryHeaders });
    ctx.waitUntil(cacheStore.put(cacheKey, entry).catch(() => {}));
  }

  return clientResponse;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const relays = relayOrigins(env);
    if (url.pathname === '/p/health') {
      return jsonResponse({
        ok: true,
        locked: false,
        authed: true,
        network: 'cloudflare',
        routing: 'opaque',
        relays: relays.length,
        reader: true
      });
    }
    if (url.pathname === '/p/diag') {
      return jsonResponse({
        ok: true,
        network: 'cloudflare',
        routes: ['direct'].concat(relays, ['reader gateway']),
        relays,
        note: 'Direct egress is Cloudflare. Relays come from the PROXY_RELAYS variable.'
      });
    }
    if (url.pathname === '/p/login') return jsonResponse({ ok: true });
    if (url.pathname === '/p' || url.pathname.startsWith(ROUTE)) return handleProxy(request, url, env, ctx);
    return new Response('Proxy backend is running. Use /p/<encoded-url>.', {
      status: 404,
      headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};
