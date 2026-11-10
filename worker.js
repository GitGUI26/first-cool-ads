import proxy from './proxy/index.js';

const DEFAULT_SUPABASE_URL = 'https://wpefdqygzqoipbsborqk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_IJ6zRJBgC7HLhcFCLpZn9g_rKEl2npg';
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 100;
const MESSAGE_COOLDOWN_MS = 2200;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function cleanName(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24) || 'player';
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch (error) {
    return false;
  }
}

function isWebSocketUpgrade(request) {
  const upgrade = request.headers.get('Upgrade');
  return typeof upgrade === 'string' && upgrade.toLowerCase() === 'websocket';
}

async function verifySupabaseUser(request, env) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!token || token.length < 20 || token.length > 5000) return null;
  const supabaseUrl = String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
  const anonKey = String(env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY);
  let response;
  try {
    response = await fetch(supabaseUrl + '/auth/v1/user', {
      headers: {
        apikey: anonKey,
        authorization: 'Bearer ' + token
      }
    });
  } catch (error) {
    return null;
  }
  if (!response.ok) return null;
  let data;
  try { data = await response.json(); } catch (error) { return null; }
  if (!data || !data.id) return null;
  const meta = data.user_metadata && typeof data.user_metadata === 'object' ? data.user_metadata : {};
  const fallback = String(data.email || '').split('@')[0] || 'player';
  return {
    id: String(data.id),
    name: cleanName(meta.username || meta.display_name || fallback)
  };
}

export class ChatRoom {
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
  }

  async fetch(request) {
    if (!isWebSocketUpgrade(request)) {
      return new Response('Expected a WebSocket upgrade.', { status: 426 });
    }
    let user = null;
    try {
      user = JSON.parse(decodeURIComponent(request.headers.get('x-chat-user') || ''));
    } catch (error) {}
    if (!user || !user.id || !user.name) {
      return new Response('Unauthorized.', { status: 401 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ user: { id: String(user.id), name: cleanName(user.name) }, lastSentAt: 0 });

    let history = [];
    try { history = (await this.ctx.storage.get('history')) || []; } catch (error) {}
    try {
      server.send(JSON.stringify({ type: 'history', messages: Array.isArray(history) ? history.slice(-MAX_HISTORY) : [] }));
    } catch (error) {}
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string') return;
    let data;
    try { data = JSON.parse(message); } catch (error) { return; }
    if (!data || typeof data !== 'object') return;
    if (data.type === 'ping') {
      try { ws.send(JSON.stringify({ type: 'pong', at: Date.now() })); } catch (error) {}
      return;
    }
    if (data.type !== 'message') return;

    const attachment = ws.deserializeAttachment() || {};
    const user = attachment.user;
    if (!user || !user.id) {
      try { ws.close(1008, 'Sign in required.'); } catch (error) {}
      return;
    }
    const now = Date.now();
    if (now - Number(attachment.lastSentAt || 0) < MESSAGE_COOLDOWN_MS) {
      try { ws.send(JSON.stringify({ type: 'error', message: 'Please wait a moment before sending another message.' })); } catch (error) {}
      return;
    }
    const text = String(data.text == null ? '' : data.text)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;

    attachment.lastSentAt = now;
    ws.serializeAttachment(attachment);

    let history = [];
    try { history = (await this.ctx.storage.get('history')) || []; } catch (error) {}
    const entry = {
      id: crypto.randomUUID(),
      user: { id: String(user.id), name: cleanName(user.name) },
      text,
      at: now
    };
    history = Array.isArray(history) ? history.concat(entry).slice(-MAX_HISTORY) : [entry];
    try { await this.ctx.storage.put('history', history); } catch (error) {}
    this.broadcast({ type: 'message', message: entry });
  }

  webSocketClose() {
    this.broadcastPresence();
  }

  webSocketError() {
    this.broadcastPresence();
  }

  broadcastPresence() {
    const seen = new Map();
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = socket.deserializeAttachment() || {};
        if (attachment.user && attachment.user.id) seen.set(String(attachment.user.id), attachment.user);
      } catch (error) {}
    }
    this.broadcast({ type: 'presence', online: seen.size });
  }

  broadcast(payload) {
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(message); } catch (error) {}
    }
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/chat/health') {
      return json({ ok: true, service: 'global-chat' });
    }

    if (pathname === '/api/chat') {
      if (!sameOrigin(request)) return json({ error: 'Origin not allowed.' }, 403);
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      if (!isWebSocketUpgrade(request)) {
        return json({ error: 'WebSocket upgrade required.' }, 426);
      }
      if (!env.CHAT_ROOM) return json({ error: 'Chat is not available.' }, 503);
      const user = await verifySupabaseUser(request, env);
      if (!user) return json({ error: 'Sign in with an online account to use chat.' }, 401);

      const id = env.CHAT_ROOM.idFromName('global');
      const room = env.CHAT_ROOM.get(id);
      const headers = new Headers(request.headers);
      headers.set('x-chat-user', encodeURIComponent(JSON.stringify(user)));
      return room.fetch(new Request(request, { headers }));
    }

    if (pathname === '/p' || pathname.startsWith('/p/')) {
      return proxy.fetch(request, env);
    }
    if (pathname === '/' || pathname.endsWith('/')) {
      const target = new URL(request.url);
      target.pathname = pathname + 'index.html';
      const index = await env.ASSETS.fetch(new Request(target, request));
      if (index.status !== 404) return index;
    }
    return env.ASSETS.fetch(request);
  }
};
