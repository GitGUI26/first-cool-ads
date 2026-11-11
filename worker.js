import proxy from './proxy/index.js';

const DEFAULT_SUPABASE_URL = 'https://wpefdqygzqoipbsborqk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_IJ6zRJBgC7HLhcFCLpZn9g_rKEl2npg';
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 100;
const MAX_MEMBERS = 60;
const MAX_AVATAR_LENGTH = 12000;
const MESSAGE_COOLDOWN_MS = 2200;

const SLUR_ROOTS = [
  'nigger', 'nigga', 'faggot', 'fagot', 'fag', 'kike', 'spic', 'chink',
  'wetback', 'beaner', 'coon', 'gook', 'paki', 'raghead', 'towelhead',
  'tranny', 'shemale', 'retard', 'redskin', 'darkie', 'dyke', 'jap'
];
const SLUR_EXCEPTIONS = new Set(['niger', 'nigeria', 'nigerian']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function filterKey(value) {
  return String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u0430]/g, 'a').replace(/[\u0435]/g, 'e').replace(/[\u043e]/g, 'o')
    .replace(/[\u0440]/g, 'p').replace(/[\u0441]/g, 'c').replace(/[\u0443]/g, 'y')
    .replace(/[\u0445]/g, 'x').replace(/[\u0456\u0457]/g, 'i').replace(/[\u0455]/g, 's')
    .replace(/[@4]/g, 'a').replace(/[1!|]/g, 'i').replace(/3/g, 'e')
    .replace(/0/g, 'o').replace(/[$5]/g, 's').replace(/7/g, 't')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactWord(word) {
  return String(word || '').replace(/(.)\1+/g, '$1');
}

function isSlurWord(word) {
  if (!word || SLUR_EXCEPTIONS.has(word)) return false;
  const forms = [word, compactWord(word)];
  return forms.some(form => SLUR_ROOTS.some(root => {
    const compactRoot = compactWord(root);
    const variants = [root, compactRoot, root + 's', root + 'ers'];
    if (root === 'retard') variants.push('retarded');
    if (root === 'fag' || root === 'fagot') variants.push('fagot', 'fagots');
    return variants.indexOf(form) !== -1;
  }));
}

export function hasBlockedLanguage(value) {
  const words = filterKey(value).split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const candidates = words.slice();
  for (let i = 0; i < words.length; i++) {
    if (words[i].length !== 1) continue;
    let joined = '';
    for (let j = i; j < words.length && words[j].length === 1; j++) {
      joined += words[j];
      if (joined.length >= 3) candidates.push(joined);
    }
  }
  return candidates.some(isSlurWord);
}

function cleanName(value) {
  const name = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24) || 'player';
  return hasBlockedLanguage(name) ? 'player' : name;
}

function cleanAvatar(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw || raw.length > MAX_AVATAR_LENGTH) return '';
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(raw)) return '';
  return raw;
}

function cleanClientId(value) {
  const id = String(value == null ? '' : value).trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(id) ? id : '';
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

function bearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function verifySupabaseUser(request, env) {
  const token = new URL(request.url).searchParams.get('token') || bearerToken(request) || '';
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
    name: cleanName(meta.username || meta.display_name || fallback),
    avatar: cleanAvatar(meta.avatar_thumb || meta.avatar)
  };
}

function memberList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && item.id).map(item => ({
    id: String(item.id),
    name: cleanName(item.name),
    avatar: cleanAvatar(item.avatar),
    at: Number(item.at) || 0
  })).sort((a, b) => b.at - a.at).slice(0, MAX_MEMBERS);
}

function rememberMember(members, user, at) {
  if (!user || !user.id) return memberList(members);
  const next = memberList(members).filter(item => String(item.id) !== String(user.id));
  next.unshift({
    id: String(user.id),
    name: cleanName(user.name),
    avatar: cleanAvatar(user.avatar),
    at: at || Date.now()
  });
  return next.slice(0, MAX_MEMBERS);
}

export class ChatRoom {
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
  }

  async readState() {
    let history = [];
    let members = [];
    try { history = (await this.ctx.storage.get('history')) || []; } catch (error) {}
    try { members = (await this.ctx.storage.get('members')) || []; } catch (error) {}
    history = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
    members = memberList(members);
    return { history, members };
  }

  async fetch(request) {
    let user = null;
    try {
      user = JSON.parse(decodeURIComponent(request.headers.get('x-chat-user') || ''));
    } catch (error) {}
    if (!user || !user.id || !user.name) {
      return new Response('Unauthorized.', { status: 401 });
    }
    user = { id: String(user.id), name: cleanName(user.name), avatar: cleanAvatar(user.avatar) };

    if (!isWebSocketUpgrade(request)) {
      if (request.method !== 'GET' || request.headers.get('x-chat-read') !== '1') {
        return new Response('Expected a WebSocket upgrade.', { status: 426 });
      }
      const state = await this.readState();
      return json({
        messages: state.history,
        members: state.members
      });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ user, lastSentAt: 0 });

    const state = await this.readState();
    let members = rememberMember(state.members, user, Date.now());
    try { await this.ctx.storage.put('members', members); } catch (error) {}
    try {
      server.send(JSON.stringify({
        type: 'history',
        messages: state.history,
        members: members
      }));
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

    const attachment = ws.deserializeAttachment() || {};
    const user = attachment.user;
    if (!user || !user.id) {
      try { ws.close(1008, 'Sign in required.'); } catch (error) {}
      return;
    }

    if (data.type === 'profile') {
      const now = Date.now();
      if (now - Number(attachment.lastProfileAt || 0) < 1000) return;
      attachment.user = {
        id: String(user.id),
        name: cleanName(user.name),
        avatar: cleanAvatar(data.avatar)
      };
      attachment.lastProfileAt = now;
      ws.serializeAttachment(attachment);
      const state = await this.readState();
      const members = rememberMember(state.members, attachment.user, now);
      try { await this.ctx.storage.put('members', members); } catch (error) {}
      this.broadcast({ type: 'member', member: attachment.user });
      this.broadcastPresence();
      return;
    }

    if (data.type !== 'message') return;
    const now = Date.now();
    const clientId = cleanClientId(data.clientId);
    if (now - Number(attachment.lastSentAt || 0) < MESSAGE_COOLDOWN_MS) {
      try { ws.send(JSON.stringify({ type: 'message-error', clientId: clientId, message: 'Please wait a moment before sending another message.' })); } catch (error) {}
      return;
    }
    const text = String(data.text == null ? '' : data.text)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;
    if (hasBlockedLanguage(text)) {
      try {
        ws.send(JSON.stringify({
          type: 'message-error',
          clientId: clientId,
          message: 'That message contains language that is not allowed here.'
        }));
      } catch (error) {}
      return;
    }

    attachment.lastSentAt = now;
    ws.serializeAttachment(attachment);

    const state = await this.readState();
    const entry = {
      id: crypto.randomUUID(),
      user: {
        id: String(attachment.user.id),
        name: cleanName(attachment.user.name)
      },
      text,
      at: now
    };
    if (clientId) entry.clientId = clientId;
    const history = state.history.concat(entry).slice(-MAX_HISTORY);
    const members = rememberMember(state.members, {
      id: entry.user.id,
      name: entry.user.name,
      avatar: attachment.user.avatar
    }, now);
    try { await this.ctx.storage.put('history', history); } catch (error) {}
    try { await this.ctx.storage.put('members', members); } catch (error) {}
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
        if (attachment.user && attachment.user.id) {
          seen.set(String(attachment.user.id), {
            id: String(attachment.user.id),
            name: cleanName(attachment.user.name),
            avatar: cleanAvatar(attachment.user.avatar)
          });
        }
      } catch (error) {}
    }
    this.broadcast({
      type: 'presence',
      online: seen.size,
      members: Array.from(seen.values())
    });
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

    if (pathname === '/api/chat/history') {
      if (!sameOrigin(request)) return json({ error: 'Origin not allowed.' }, 403);
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      if (!env.CHAT_ROOM) return json({ error: 'Chat is not available.' }, 503);
      const user = await verifySupabaseUser(request, env);
      if (!user) return json({ error: 'Sign in with an online account to use chat.' }, 401);
      const id = env.CHAT_ROOM.idFromName('global');
      const room = env.CHAT_ROOM.get(id);
      const headers = new Headers(request.headers);
      headers.set('x-chat-user', encodeURIComponent(JSON.stringify(user)));
      headers.set('x-chat-read', '1');
      return room.fetch(new Request(request, { headers }));
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
