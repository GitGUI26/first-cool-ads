import proxy from './proxy/index.js';

const DEFAULT_SUPABASE_URL = 'https://wpefdqygzqoipbsborqk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_IJ6zRJBgC7HLhcFCLpZn9g_rKEl2npg';
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 100;
const MAX_MEMBERS = 60;
const MAX_AVATAR_LENGTH = 12000;
const MAX_FRIENDS = 50;
const MAX_FRIEND_REQUESTS = 30;
const MAX_DM_HISTORY = 100;
const MESSAGE_COOLDOWN_MS = 2200;
const DM_COOLDOWN_MS = 700;
const FRIEND_REQUEST_COOLDOWN_MS = 1400;

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

function cleanId(value) {
  const id = String(value == null ? '' : value).trim();
  return id.length <= 80 && /^[A-Za-z0-9_-]+$/.test(id) ? id : '';
}

function nameKey(value) {
  return String(value == null ? '' : value).trim().normalize('NFKC').toLowerCase();
}

function profileOf(user) {
  return {
    id: String((user && user.id) || ''),
    name: cleanName(user && user.name),
    avatar: cleanAvatar(user && user.avatar)
  };
}

function friendEntry(value) {
  const id = cleanId(value && value.id);
  if (!id) return null;
  return {
    id,
    name: cleanName(value && value.name),
    avatar: cleanAvatar(value && value.avatar),
    at: Number(value && value.at) || 0
  };
}

function socialState(value) {
  const social = { friendships: {}, requests: {} };
  if (!value || typeof value !== 'object') return social;
  const friendships = value.friendships && typeof value.friendships === 'object' ? value.friendships : {};
  Object.keys(friendships).forEach(rawOwnerId => {
    const ownerId = cleanId(rawOwnerId);
    if (!ownerId) return;
    const list = Array.isArray(friendships[rawOwnerId]) ? friendships[rawOwnerId] : [];
    social.friendships[ownerId] = list.map(friendEntry).filter(Boolean).slice(0, MAX_FRIENDS);
  });
  const requests = value.requests && typeof value.requests === 'object' ? value.requests : {};
  Object.keys(requests).forEach(rawOwnerId => {
    const ownerId = cleanId(rawOwnerId);
    if (!ownerId) return;
    const list = Array.isArray(requests[rawOwnerId]) ? requests[rawOwnerId] : [];
    social.requests[ownerId] = list.map(item => {
      const from = friendEntry(item && item.from);
      return from ? { from, at: Number(item && item.at) || from.at || 0 } : null;
    }).filter(Boolean).slice(0, MAX_FRIEND_REQUESTS);
  });
  return social;
}

function addFriend(social, ownerId, person) {
  const owner = cleanId(ownerId);
  const friend = friendEntry(person);
  if (!owner || !friend) return;
  const list = Array.isArray(social.friendships[owner]) ? social.friendships[owner] : [];
  if (list.some(item => item.id === friend.id)) return;
  social.friendships[owner] = [friend, ...list].slice(0, MAX_FRIENDS);
}

function isFriend(social, userId, friendId) {
  const list = social.friendships[userId];
  return Array.isArray(list) && list.some(item => item.id === friendId);
}

function dmKey(a, b) {
  return 'dm:' + [String(a), String(b)].sort().join(':');
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

  async readSocial() {
    let social = null;
    try { social = await this.ctx.storage.get('social'); } catch (error) {}
    return socialState(social);
  }

  async readDm(a, b) {
    let messages = [];
    try { messages = (await this.ctx.storage.get(dmKey(a, b))) || []; } catch (error) {}
    if (!Array.isArray(messages)) return [];
    return messages.filter(item => item && item.id && item.from && item.from.id && item.to).slice(-MAX_DM_HISTORY);
  }

  async purgeUser(userId) {
    const id = String(userId || '');
    if (!id) throw new Error('Missing user.');

    const state = await this.readState();
    const history = state.history.filter(item => String(item && item.user && item.user.id) !== id);
    const members = state.members.filter(item => String(item && item.id) !== id);
    await this.ctx.storage.put('history', history);
    await this.ctx.storage.put('members', members);

    const social = await this.readSocial();
    let friendshipsRemoved = 0;
    let requestsRemoved = 0;
    Object.keys(social.friendships).forEach(ownerId => {
      if (ownerId === id) {
        friendshipsRemoved += social.friendships[ownerId].length;
        delete social.friendships[ownerId];
        return;
      }
      const before = social.friendships[ownerId].length;
      social.friendships[ownerId] = social.friendships[ownerId].filter(item => item.id !== id);
      friendshipsRemoved += before - social.friendships[ownerId].length;
    });
    Object.keys(social.requests).forEach(ownerId => {
      if (ownerId === id) {
        requestsRemoved += social.requests[ownerId].length;
        delete social.requests[ownerId];
        return;
      }
      const before = social.requests[ownerId].length;
      social.requests[ownerId] = social.requests[ownerId].filter(item => item.from.id !== id);
      requestsRemoved += before - social.requests[ownerId].length;
    });
    await this.ctx.storage.put('social', social);

    let directMessagesRemoved = 0;
    const conversations = await this.ctx.storage.list({ prefix: 'dm:' });
    for (const [key, value] of conversations) {
      const pair = String(key).slice(3).split(':');
      if (pair.indexOf(id) === -1) continue;
      const entries = Array.isArray(value) ? value : [];
      const next = entries.filter(item => String(item && item.from && item.from.id) !== id);
      if (next.length === entries.length) continue;
      directMessagesRemoved += entries.length - next.length;
      if (next.length) await this.ctx.storage.put(key, next);
      else await this.ctx.storage.delete(key);
    }

    const removed = {
      roomMessages: state.history.length - history.length,
      directMessages: directMessagesRemoved,
      friendships: friendshipsRemoved,
      requests: requestsRemoved
    };
    this.broadcast({ type: 'purge-user', userId: id, removed });
    return { ok: true, removed };
  }

  onlineUsers() {
    const online = new Map();
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = socket.deserializeAttachment() || {};
        const user = attachment.user;
        if (user && user.id) online.set(String(user.id), profileOf(user));
      } catch (error) {}
    }
    return online;
  }

  socialFor(userId, social, online) {
    const id = String(userId || '');
    const friends = (social.friendships[id] || []).map(item => ({
      id: item.id,
      name: item.name,
      avatar: item.avatar,
      at: item.at,
      online: online.has(item.id)
    })).sort((a, b) => (Number(b.online) - Number(a.online)) || a.name.localeCompare(b.name));
    const requests = (social.requests[id] || []).map(item => ({
      id: item.from.id,
      name: item.from.name,
      avatar: item.from.avatar,
      at: item.at,
      online: online.has(item.from.id)
    })).sort((a, b) => (Number(b.online) - Number(a.online)) || (b.at - a.at));
    return { friends, requests };
  }

  sendSocket(ws, payload) {
    try { ws.send(JSON.stringify(payload)); } catch (error) {}
  }

  sendToUser(userId, payload) {
    const id = String(userId || '');
    if (!id) return;
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = socket.deserializeAttachment() || {};
        if (attachment.user && String(attachment.user.id) === id) socket.send(message);
      } catch (error) {}
    }
  }

  sendToUsers(userIds, payload) {
    const ids = new Set((userIds || []).map(id => String(id)));
    if (!ids.size) return;
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = socket.deserializeAttachment() || {};
        if (attachment.user && ids.has(String(attachment.user.id))) socket.send(message);
      } catch (error) {}
    }
  }

  refreshFriendProfiles(social, user) {
    const profile = profileOf(user);
    Object.keys(social.friendships).forEach(ownerId => {
      social.friendships[ownerId] = social.friendships[ownerId].map(item => {
        if (item.id !== profile.id) return item;
        if (item.name === profile.name && item.avatar === profile.avatar) return item;
        return { ...item, name: profile.name, avatar: profile.avatar };
      });
    });
    Object.keys(social.requests).forEach(ownerId => {
      social.requests[ownerId] = social.requests[ownerId].map(item => {
        if (item.from.id !== profile.id) return item;
        if (item.from.name === profile.name && item.from.avatar === profile.avatar) return item;
        return {
          ...item,
          from: { ...item.from, name: profile.name, avatar: profile.avatar }
        };
      });
    });
    return social;
  }

  async friendRequest(ws, user, attachment, data) {
    const now = Date.now();
    if (now - Number(attachment.lastFriendAt || 0) < FRIEND_REQUEST_COOLDOWN_MS) {
      this.sendSocket(ws, { type: 'friend-error', message: 'Please wait a moment before sending another friend request.' });
      return;
    }
    const online = this.onlineUsers();
    const requestedId = cleanId(data.targetId);
    let target = requestedId ? online.get(requestedId) || null : null;
    if (!target && data.targetName) {
      const key = nameKey(String(data.targetName).replace(/^@+/, ''));
      if (key) {
        const matches = Array.from(online.values()).filter(item => item.id !== user.id && nameKey(item.name) === key);
        if (matches.length > 1) {
          this.sendSocket(ws, { type: 'friend-error', message: 'That username is not unique. Ask them to use a unique name before adding them.' });
          return;
        }
        target = matches[0] || null;
      }
    }
    if (!target) {
      this.sendSocket(ws, { type: 'friend-error', message: 'That member is offline. Only online members can be added.' });
      return;
    }
    if (target.id === user.id) {
      this.sendSocket(ws, { type: 'friend-error', message: 'You cannot add yourself as a friend.' });
      return;
    }
    if (nameKey(target.name) === nameKey(user.name)) {
      this.sendSocket(ws, { type: 'friend-error', message: 'Usernames must be unique. One of you needs to choose a different name first.' });
      return;
    }
    if (Array.from(online.values()).some(item => item.id !== target.id && nameKey(item.name) === nameKey(target.name))) {
      this.sendSocket(ws, { type: 'friend-error', message: 'That username is not unique. Ask them to choose a unique name before adding them.' });
      return;
    }
    const social = await this.readSocial();
    if (isFriend(social, user.id, target.id)) {
      this.sendSocket(ws, { type: 'friend-error', message: 'You are already friends with ' + target.name + '.' });
      return;
    }
    if ((social.requests[user.id] || []).some(item => item.from.id === target.id)) {
      this.sendSocket(ws, { type: 'friend-error', message: target.name + ' already sent you a friend request. Accept it from your requests.' });
      return;
    }
    if ((social.requests[target.id] || []).some(item => item.from.id === user.id)) {
      this.sendSocket(ws, { type: 'friend-error', message: 'You already sent ' + target.name + ' a friend request.' });
      return;
    }
    if ((social.friendships[user.id] || []).length >= MAX_FRIENDS || (social.friendships[target.id] || []).length >= MAX_FRIENDS) {
      this.sendSocket(ws, { type: 'friend-error', message: 'That friend list is full. Remove someone before adding another friend.' });
      return;
    }
    const incoming = social.requests[target.id] || [];
    if (incoming.length >= MAX_FRIEND_REQUESTS) {
      this.sendSocket(ws, { type: 'friend-error', message: 'That member has too many pending requests right now.' });
      return;
    }
    social.requests[target.id] = [{ from: profileOf(user), at: now }, ...incoming];
    try { await this.ctx.storage.put('social', social); } catch (error) {}
    attachment.lastFriendAt = now;
    ws.serializeAttachment(attachment);
    const targetSocial = this.socialFor(target.id, social, online);
    this.sendToUser(target.id, {
      type: 'friend-request',
      request: profileOf(user),
      friends: targetSocial.friends,
      requests: targetSocial.requests
    });
    this.sendSocket(ws, { type: 'friend-request-sent', target: profileOf(target) });
  }

  async acceptFriend(ws, user, data) {
    const requesterId = cleanId(data.requesterId);
    if (!requesterId || requesterId === user.id) {
      this.sendSocket(ws, { type: 'friend-error', message: 'That friend request is not available.' });
      return;
    }
    const social = await this.readSocial();
    const incoming = social.requests[user.id] || [];
    const request = incoming.find(item => item.from.id === requesterId);
    if (!request) {
      this.sendSocket(ws, { type: 'friend-error', message: 'That friend request is no longer available.' });
      return;
    }
    if ((social.friendships[user.id] || []).length >= MAX_FRIENDS || (social.friendships[requesterId] || []).length >= MAX_FRIENDS) {
      this.sendSocket(ws, { type: 'friend-error', message: 'One of these friend lists is full. Remove someone before accepting.' });
      return;
    }
    const online = this.onlineUsers();
    if (!online.has(requesterId)) {
      this.sendSocket(ws, { type: 'friend-error', message: 'That member is offline. Friend requests can be accepted only while both of you are online.' });
      return;
    }
    const requester = online.get(requesterId);
    social.requests[user.id] = incoming.filter(item => item.from.id !== requesterId);
    addFriend(social, user.id, requester);
    addFriend(social, requesterId, profileOf(user));
    try { await this.ctx.storage.put('social', social); } catch (error) {}
    const mine = this.socialFor(user.id, social, online);
    const theirs = this.socialFor(requesterId, social, online);
    this.sendToUser(user.id, { type: 'social', friends: mine.friends, requests: mine.requests });
    this.sendToUser(requesterId, { type: 'social', friends: theirs.friends, requests: theirs.requests });
    this.sendToUser(requesterId, { type: 'friend-accepted', friend: profileOf(user) });
  }

  async declineFriend(ws, user, data) {
    const requesterId = cleanId(data.requesterId);
    const social = await this.readSocial();
    const incoming = social.requests[user.id] || [];
    if (!requesterId || !incoming.some(item => item.from.id === requesterId)) {
      this.sendSocket(ws, { type: 'friend-error', message: 'That friend request is no longer available.' });
      return;
    }
    social.requests[user.id] = incoming.filter(item => item.from.id !== requesterId);
    try { await this.ctx.storage.put('social', social); } catch (error) {}
    const mine = this.socialFor(user.id, social, this.onlineUsers());
    this.sendSocket(ws, { type: 'social', friends: mine.friends, requests: mine.requests });
    this.sendToUser(requesterId, { type: 'friend-declined', friend: profileOf(user) });
  }

  async directMessage(ws, user, attachment, data) {
    const to = cleanId(data.to);
    if (!to || to === user.id) {
      this.sendSocket(ws, { type: 'dm-error', clientId: cleanClientId(data.clientId), message: 'Choose a friend to message.' });
      return;
    }
    const social = await this.readSocial();
    if (!isFriend(social, user.id, to)) {
      this.sendSocket(ws, { type: 'dm-error', clientId: cleanClientId(data.clientId), message: 'You can only message friends.' });
      return;
    }
    const online = this.onlineUsers();
    if (!online.has(to)) {
      this.sendSocket(ws, { type: 'dm-error', clientId: cleanClientId(data.clientId), message: 'That friend is offline. You can message friends only while they are online.' });
      return;
    }
    const now = Date.now();
    if (now - Number(attachment.lastDmAt || 0) < DM_COOLDOWN_MS) {
      this.sendSocket(ws, { type: 'dm-error', clientId: cleanClientId(data.clientId), message: 'Please wait a moment before sending another message.' });
      return;
    }
    const text = String(data.text == null ? '' : data.text)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;
    const clientId = cleanClientId(data.clientId);
    if (hasBlockedLanguage(text)) {
      this.sendSocket(ws, { type: 'dm-error', clientId, message: 'That message contains language that is not allowed here.' });
      return;
    }
    attachment.lastDmAt = now;
    ws.serializeAttachment(attachment);
    const messages = await this.readDm(user.id, to);
    const entry = {
      id: crypto.randomUUID(),
      from: { id: String(user.id), name: cleanName(user.name) },
      to,
      text,
      at: now
    };
    if (clientId) entry.clientId = clientId;
    messages.push(entry);
    try { await this.ctx.storage.put(dmKey(user.id, to), messages.slice(-MAX_DM_HISTORY)); } catch (error) {}
    this.sendToUsers([user.id, to], { type: 'dm', message: entry });
  }

  async directHistory(ws, user, data) {
    const friendId = cleanId(data.friendId);
    const social = await this.readSocial();
    if (!friendId || !isFriend(social, user.id, friendId)) {
      this.sendSocket(ws, { type: 'dm-error', message: 'You can only read conversations with friends.' });
      return;
    }
    const messages = await this.readDm(user.id, friendId);
    this.sendSocket(ws, { type: 'dm-history', friendId, messages });
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

    if (request.headers.get('x-chat-purge') === '1') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      try {
        return json(await this.purgeUser(user.id));
      } catch (error) {
        return json({ error: 'Could not remove chat messages.' }, 500);
      }
    }

    if (!isWebSocketUpgrade(request)) {
      if (request.method !== 'GET' || request.headers.get('x-chat-read') !== '1') {
        return new Response('Expected a WebSocket upgrade.', { status: 426 });
      }
      const state = await this.readState();
      const social = await this.readSocial();
      const dmFriend = cleanId(request.headers.get('x-chat-dm') || '');
      if (dmFriend) {
        if (!isFriend(social, user.id, dmFriend)) return json({ error: 'You can only read conversations with friends.' }, 403);
        return json({ friendId: dmFriend, messages: await this.readDm(user.id, dmFriend) });
      }
      const online = this.onlineUsers();
      return json({
        messages: state.history,
        members: state.members,
        ...this.socialFor(user.id, social, online)
      });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ user, lastSentAt: 0 });

    const state = await this.readState();
    let social = await this.readSocial();
    social = this.refreshFriendProfiles(social, user);
    let members = rememberMember(state.members, user, Date.now());
    try { await this.ctx.storage.put('members', members); } catch (error) {}
    try { await this.ctx.storage.put('social', social); } catch (error) {}
    const online = this.onlineUsers();
    try {
      server.send(JSON.stringify({
        type: 'history',
        messages: state.history,
        members: members,
        ...this.socialFor(user.id, social, online)
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
      let social = await this.readSocial();
      social = this.refreshFriendProfiles(social, attachment.user);
      try { await this.ctx.storage.put('social', social); } catch (error) {}
      this.broadcast({ type: 'member', member: attachment.user });
      this.broadcastPresence();
      return;
    }

    if (data.type === 'friend-request') {
      await this.friendRequest(ws, user, attachment, data);
      return;
    }

    if (data.type === 'friend-accept') {
      await this.acceptFriend(ws, user, data);
      return;
    }

    if (data.type === 'friend-decline') {
      await this.declineFriend(ws, user, data);
      return;
    }

    if (data.type === 'dm') {
      await this.directMessage(ws, user, attachment, data);
      return;
    }

    if (data.type === 'dm-history') {
      await this.directHistory(ws, user, data);
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

    if (pathname === '/api/chat/dm-history') {
      if (!sameOrigin(request)) return json({ error: 'Origin not allowed.' }, 403);
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      if (!env.CHAT_ROOM) return json({ error: 'Chat is not available.' }, 503);
      const user = await verifySupabaseUser(request, env);
      if (!user) return json({ error: 'Sign in with an online account to use chat.' }, 401);
      const friend = cleanId(new URL(request.url).searchParams.get('friend'));
      if (!friend) return json({ error: 'Choose a friend.' }, 400);
      const id = env.CHAT_ROOM.idFromName('global');
      const room = env.CHAT_ROOM.get(id);
      const headers = new Headers(request.headers);
      headers.set('x-chat-user', encodeURIComponent(JSON.stringify(user)));
      headers.set('x-chat-read', '1');
      headers.set('x-chat-dm', friend);
      return room.fetch(new Request(request, { headers }));
    }

    if (pathname === '/api/chat/purge') {
      if (!sameOrigin(request)) return json({ error: 'Origin not allowed.' }, 403);
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      if (!env.CHAT_ROOM) return json({ error: 'Chat is not available.' }, 503);
      const user = await verifySupabaseUser(request, env);
      if (!user) return json({ error: 'Sign in with an online account to use chat.' }, 401);
      const id = env.CHAT_ROOM.idFromName('global');
      const room = env.CHAT_ROOM.get(id);
      const headers = new Headers(request.headers);
      headers.set('x-chat-user', encodeURIComponent(JSON.stringify(user)));
      headers.set('x-chat-purge', '1');
      try {
        return await room.fetch(new Request(request, { headers }));
      } catch (error) {
        return json({ error: 'Could not remove chat messages.' }, 500);
      }
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
