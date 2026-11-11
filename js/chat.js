(function () {
  'use strict';

  var Store = window.CoolAccountStore;
  if (!Store) return;

  var $ = function (id) { return document.getElementById(id); };
  var PENDING_KEY = 'cuh_chat_pending_v1';
  var DEFAULT_AVATAR = 'images/default-avatar.svg';
  var MAX_AVATAR_LENGTH = 12000;
  var POLL_MS = 12000;
  var messages = [];
  var seen = {};
  var members = {};
  var onlineMembers = [];
  var pending = {};
  var socket = null;
  var reconnectTimer = 0;
  var reconnectAttempt = 0;
  var manuallyClosed = false;
  var initialized = false;
  var pollTimer = 0;
  var pollingBusy = false;
  var accessToken = '';
  var lastProfileKey = null;
  var avatarCache = { source: null, value: '' };
  var noticeTimer = 0;

  function currentUser() {
    return Store.getCurrentUser();
  }

  function isLocal(user) {
    return !!user && (Store.isLocalAccount ? Store.isLocalAccount(user) : String(user.id || '').indexOf('local-') === 0);
  }

  function setStatus(text, state) {
    var node = $('chatConnection');
    if (!node) return;
    node.textContent = text;
    node.dataset.state = state || '';
  }

  function showNotice(message, reset) {
    var node = $('chatNotice');
    if (!node) return;
    clearTimeout(noticeTimer);
    node.textContent = message || '';
    node.hidden = !message;
    if (message && reset !== false) {
      noticeTimer = window.setTimeout(function () {
        node.hidden = true;
        node.textContent = '';
      }, 6000);
    }
  }

  function setComposer(enabled) {
    var input = $('chatInput');
    var button = $('chatSend');
    if (input) input.disabled = !enabled;
    if (button) button.disabled = !enabled;
  }

  function setPending(value) {
    try {
      if (value) sessionStorage.setItem(PENDING_KEY, '1');
      else sessionStorage.removeItem(PENDING_KEY);
    } catch (error) {}
  }

  function hasPending() {
    try { return sessionStorage.getItem(PENDING_KEY) === '1'; } catch (error) { return false; }
  }

  function showAccountPrompt() {
    setPending(true);
    if (typeof window.openAccount === 'function') window.openAccount();
  }

  function openChat() {
    var user = currentUser();
    if (!user) {
      showAccountPrompt();
      return;
    }
    if (isLocal(user)) {
      setPending(true);
      showAccountPrompt();
      window.setTimeout(function () {
        var email = $('upgradeEmail');
        if (email) {
          email.focus();
          email.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 180);
      return;
    }
    if (typeof window.switchTab === 'function') {
      window.switchTab('chat');
    } else {
      var section = $('chat-section');
      if (section) {
        section.hidden = false;
        section.setAttribute('aria-hidden', 'false');
      }
    }
    connect();
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = 0;
    pollingBusy = false;
  }

  function closeSocket(message) {
    manuallyClosed = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
    stopPolling();
    if (socket) {
      try { socket.close(1000, 'Leaving chat.'); } catch (error) {}
      socket = null;
    }
    setComposer(false);
    setStatus(message || 'Disconnected', 'offline');
  }

  function renderEmpty(text) {
    var list = $('chatMessages');
    if (!list) return;
    list.replaceChildren();
    var empty = document.createElement('div');
    empty.className = 'chat-empty';
    var icon = document.createElement('i');
    icon.className = 'fas fa-comments';
    icon.setAttribute('aria-hidden', 'true');
    empty.appendChild(icon);
    var title = document.createElement('strong');
    title.textContent = text || 'No messages yet';
    empty.appendChild(title);
    var copy = document.createElement('span');
    copy.textContent = 'Be the first to say hello to the room.';
    empty.appendChild(copy);
    list.appendChild(empty);
  }

  function displayName(user) {
    return user && user.name ? String(user.name) : 'player';
  }

  function formatTime(timestamp) {
    var date = new Date(Number(timestamp) || Date.now());
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function memberFor(user) {
    if (!user) return null;
    return members[String(user.id)] || user;
  }

  function avatarFor(user) {
    var member = memberFor(user);
    return (member && member.avatar) || (user && user.avatar) || DEFAULT_AVATAR;
  }

  function makeAvatar(user, className) {
    var id = user && user.id ? String(user.id) : '';
    var wrap = document.createElement('div');
    wrap.className = className || 'chat-avatar';
    if (id) wrap.setAttribute('data-avatar-user', id);
    var image = document.createElement('img');
    image.src = avatarFor(user);
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', function () {
      if (image.src.indexOf(DEFAULT_AVATAR) === -1) image.src = DEFAULT_AVATAR;
    });
    wrap.appendChild(image);
    return wrap;
  }

  function renderFaces(container, people) {
    if (!container) return;
    container.replaceChildren();
    var visible = (people || []).slice(0, 5);
    visible.forEach(function (member) {
      var face = makeAvatar(member, 'chat-face');
      face.title = displayName(member);
      container.appendChild(face);
    });
    if ((people || []).length > visible.length) {
      var more = document.createElement('span');
      more.className = 'chat-face chat-face-more';
      more.textContent = '+' + (people.length - visible.length);
      container.appendChild(more);
    }
  }

  function renderPresence() {
    renderFaces($('chatOnlineFaces'), onlineMembers);
    renderFaces($('chatOnlineFacesCompact'), onlineMembers);
  }

  function setOnline(count, list) {
    var online = $('chatOnline');
    var compact = $('chatOnlineCompact');
    var total = Math.max(0, Number(count) || 0);
    if (online) online.textContent = String(total);
    if (compact) compact.textContent = String(total);
    if (Array.isArray(list)) {
      onlineMembers = list.filter(function (member) {
        return member && member.id;
      }).map(function (member) {
        var id = String(member.id);
        if (!members[id] || (member.avatar && member.avatar !== members[id].avatar)) members[id] = member;
        return members[String(member.id)];
      });
    } else if (!total) {
      onlineMembers = [];
    }
    renderPresence();
  }

  function updateMember(member) {
    if (!member || !member.id) return;
    var id = String(member.id);
    members[id] = {
      id: id,
      name: displayName(member),
      avatar: member.avatar || ''
    };
    var index = onlineMembers.findIndex(function (item) { return String(item.id) === id; });
    if (index !== -1) onlineMembers[index] = members[id];
    document.querySelectorAll('[data-avatar-user="' + id + '"] img').forEach(function (image) {
      image.src = avatarFor(members[id]);
    });
    renderPresence();
  }

  function removePending(clientId) {
    if (!clientId || !pending[clientId]) return;
    var entry = pending[clientId];
    if (entry.node && entry.node.parentNode) entry.node.parentNode.removeChild(entry.node);
    delete pending[clientId];
  }

  function addPending(text, clientId) {
    var list = $('chatMessages');
    if (!list) return;
    var empty = list.querySelector('.chat-empty');
    if (empty) empty.remove();
    var user = currentUser();
    var item = document.createElement('article');
    item.className = 'chat-message is-own is-pending';
    item.setAttribute('data-client-id', clientId);
    item.appendChild(makeAvatar(user, 'chat-avatar'));
    var body = document.createElement('div');
    body.className = 'chat-message-body';
    var meta = document.createElement('div');
    meta.className = 'chat-message-meta';
    var name = document.createElement('strong');
    name.textContent = 'You';
    var sending = document.createElement('span');
    sending.className = 'chat-sending';
    sending.textContent = 'Sending…';
    meta.appendChild(name);
    meta.appendChild(sending);
    var copy = document.createElement('p');
    copy.textContent = text;
    body.appendChild(meta);
    body.appendChild(copy);
    item.appendChild(body);
    list.appendChild(item);
    pending[clientId] = { text: text, node: item };
    list.scrollTop = list.scrollHeight;
  }

  function addMessage(message, animate) {
    if (!message || !message.id || seen[message.id]) return;
    if (message.clientId) removePending(message.clientId);
    seen[message.id] = true;
    messages.push(message);
    var list = $('chatMessages');
    if (!list) return;
    var empty = list.querySelector('.chat-empty');
    if (empty) empty.remove();

    var user = currentUser();
    var own = !!user && String(message.user && message.user.id) === String(user.id);
    var item = document.createElement('article');
    item.className = 'chat-message' + (own ? ' is-own' : '');
    item.setAttribute('data-message-id', message.id);
    item.setAttribute('data-author-id', String(message.user && message.user.id || ''));
    item.appendChild(makeAvatar(message.user, 'chat-avatar'));

    var body = document.createElement('div');
    body.className = 'chat-message-body';
    var meta = document.createElement('div');
    meta.className = 'chat-message-meta';
    var name = document.createElement('strong');
    name.textContent = own ? 'You' : displayName(message.user);
    var time = document.createElement('time');
    time.dateTime = new Date(Number(message.at) || Date.now()).toISOString();
    time.textContent = formatTime(message.at);
    meta.appendChild(name);
    meta.appendChild(time);
    var text = document.createElement('p');
    text.textContent = String(message.text || '');
    body.appendChild(meta);
    body.appendChild(text);

    item.appendChild(body);
    list.appendChild(item);
    if (animate) item.classList.add('is-new');
    list.scrollTop = list.scrollHeight;
  }

  function mergeMembers(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (member) {
      if (!member || !member.id) return;
      var id = String(member.id);
      var existing = members[id] || {};
      members[id] = {
        id: id,
        name: displayName(member) || existing.name || 'player',
        avatar: member.avatar || existing.avatar || ''
      };
    });
    renderPresence();
  }

  function mergeHistory(list) {
    if (!Array.isArray(list)) return;
    list.slice(-100).forEach(function (entry) { addMessage(entry, false); });
    if (!messages.length) renderEmpty('No messages yet');
  }

  function makeChatAvatar(source) {
    if (!source) return Promise.resolve('');
    if (avatarCache.source === source) return Promise.resolve(avatarCache.value);
    return new Promise(function (resolve) {
      var image = new Image();
      image.onerror = function () { resolve(''); };
      image.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = 96;
          canvas.height = 96;
          var context = canvas.getContext('2d');
          if (!context) return resolve('');
          context.fillStyle = '#0b1020';
          context.fillRect(0, 0, 96, 96);
          var scale = Math.max(96 / image.naturalWidth, 96 / image.naturalHeight);
          var width = Math.round(image.naturalWidth * scale);
          var height = Math.round(image.naturalHeight * scale);
          context.drawImage(image, Math.round((96 - width) / 2), Math.round((96 - height) / 2), width, height);
          var data = canvas.toDataURL('image/webp', 0.7);
          if (data.indexOf('data:image/webp') !== 0) data = canvas.toDataURL('image/jpeg', 0.7);
          if (data.length > MAX_AVATAR_LENGTH) {
            canvas.width = 72;
            canvas.height = 72;
            context.fillStyle = '#0b1020';
            context.fillRect(0, 0, 72, 72);
            context.drawImage(image, Math.round((72 - width * 0.75) / 2), Math.round((72 - height * 0.75) / 2), Math.round(width * 0.75), Math.round(height * 0.75));
            data = canvas.toDataURL('image/jpeg', 0.62);
          }
          avatarCache = { source: source, value: data.length <= MAX_AVATAR_LENGTH ? data : '' };
          resolve(avatarCache.value);
        } catch (error) {
          resolve('');
        }
      };
      image.src = source;
    });
  }

  function sendProfile(force) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    var user = currentUser();
    if (!user) return;
    var key = String(user.id || '') + '|' + String(user.avatar || '');
    if (!force && lastProfileKey === key) return;
    lastProfileKey = key;
    makeChatAvatar(user.avatar).then(function (avatar) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: 'profile', avatar: avatar }));
    });
  }

  function syncHistory() {
    if (pollingBusy || !accessToken || document.hidden) return;
    pollingBusy = true;
    fetch('/api/chat/history', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(function (response) {
      if (response.status === 401) {
        setStatus('Sign in again to use chat.', 'offline');
        showNotice('Your session expired. Sign in again to keep chatting.');
        closeSocket('Sign in to join the chat');
        return null;
      }
      if (!response.ok) return null;
      return response.json();
    }).then(function (data) {
      if (!data) return;
      mergeMembers(data.members);
      mergeHistory(data.messages);
    }).catch(function () {
      // The live socket remains the primary path; polling is a safety net.
    }).finally(function () {
      pollingBusy = false;
    });
  }

  function startPolling() {
    stopPolling();
    syncHistory();
    pollTimer = window.setInterval(syncHistory, POLL_MS);
  }

  function connect() {
    var user = currentUser();
    if (!user) {
      showAccountPrompt();
      return;
    }
    if (isLocal(user)) {
      showAccountPrompt();
      return;
    }
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

    manuallyClosed = false;
    lastProfileKey = null;
    setPending(false);
    setStatus('Connecting…', 'connecting');
    setComposer(false);
    showNotice('');

    Store.getAccessToken().then(function (token) {
      accessToken = token || '';
      if (!accessToken) {
        setStatus('Sign in again to use chat.', 'offline');
        setPending(true);
        showAccountPrompt();
        return;
      }
      startPolling();
      var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      var ws = new WebSocket(protocol + '//' + location.host + '/api/chat?token=' + encodeURIComponent(accessToken));
      socket = ws;

      ws.addEventListener('open', function () {
        reconnectAttempt = 0;
        setStatus('Live', 'live');
        setComposer(true);
        sendProfile(true);
      });

      ws.addEventListener('message', function (event) {
        var data;
        try { data = JSON.parse(event.data); } catch (error) { return; }
        if (!data || !data.type) return;
        if (data.type === 'history') {
          mergeMembers(data.members);
          mergeHistory(data.messages);
        } else if (data.type === 'message') {
          addMessage(data.message, true);
        } else if (data.type === 'message-error') {
          handleMessageError(data);
        } else if (data.type === 'presence') {
          setOnline(data.online, data.members);
        } else if (data.type === 'member') {
          updateMember(data.member);
        } else if (data.type === 'error') {
          showNotice(data.message || 'Message not sent.');
        }
      });

      ws.addEventListener('close', function (event) {
        if (socket === ws) socket = null;
        stopPolling();
        setComposer(false);
        if (manuallyClosed) return;
        if (event.code === 1008 || event.code === 4401) {
          setStatus('Sign in again to use chat.', 'offline');
          showAccountPrompt();
          return;
        }
        setStatus('Reconnecting…', 'connecting');
        scheduleReconnect();
      });

      ws.addEventListener('error', function () {
        if (!manuallyClosed) setStatus('Connection problem. Retrying…', 'offline');
      });
    }).catch(function () {
      setStatus('Could not sign in to chat. Try again.', 'offline');
      setComposer(false);
    });
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    if (manuallyClosed || !currentUser()) return;
    reconnectAttempt = Math.min(reconnectAttempt + 1, 6);
    var delay = Math.min(15000, 800 * Math.pow(2, reconnectAttempt - 1));
    reconnectTimer = window.setTimeout(connect, delay);
  }

  function updateCharCount() {
    var input = $('chatInput');
    var count = $('chatCharCount');
    if (input && count) count.textContent = String(input.value.length) + ' / 500';
  }

  function sendMessage() {
    var input = $('chatInput');
    if (!input) return;
    var text = String(input.value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!text) return;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      showNotice('Chat is not connected yet. Try again in a moment.');
      return;
    }
    var clientId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    addPending(text, clientId);
    try {
      socket.send(JSON.stringify({ type: 'message', text: text, clientId: clientId }));
    } catch (error) {
      removePending(clientId);
      showNotice('Could not send that message. Try again.');
      return;
    }
    input.value = '';
    input.style.height = '';
    updateCharCount();
    input.focus();
  }

  function handleMessageError(data) {
    var entry = data && data.clientId ? pending[data.clientId] : null;
    var text = entry ? entry.text : '';
    removePending(data && data.clientId);
    var input = $('chatInput');
    if (text && input && !input.value) {
      input.value = text;
      updateCharCount();
      input.focus();
    }
    showNotice(data && data.message || 'That message could not be sent.');
  }

  function bind() {
    var form = $('chatForm');
    var input = $('chatInput');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        sendMessage();
      });
    }
    if (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      });
      input.addEventListener('input', function () {
        input.style.height = 'auto';
        input.style.height = Math.min(140, input.scrollHeight) + 'px';
        updateCharCount();
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && socket && socket.readyState === WebSocket.OPEN) syncHistory();
    });
  }

  function handleSwitch(event) {
    var tab = event.detail && event.detail.tab;
    document.body.classList.toggle('chat-active', tab === 'chat');
    if (tab && tab !== 'chat') closeSocket('Disconnected');
  }

  function handleAccountChange() {
    var user = currentUser();
    if (!user) {
      closeSocket('Sign in to join the chat');
      setOnline(0, []);
      if (hasPending()) setPending(false);
      if (document.body.dataset.activeTab === 'chat' && typeof window.switchTab === 'function') {
        window.switchTab('lessons');
      }
      return;
    }
    if (socket && socket.readyState === WebSocket.OPEN) sendProfile(false);
    if (hasPending() && !isLocal(user)) {
      setPending(false);
      openChat();
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    bind();
    window.openChat = openChat;
    window.addEventListener('app:switch-tab', handleSwitch);
    window.addEventListener('cuh-account-change', handleAccountChange);
    var user = currentUser();
    if (hasPending()) {
      if (user && !isLocal(user)) {
        setPending(false);
        window.setTimeout(openChat, 350);
      } else if (!user) {
        setPending(false);
      }
    }
    if (!messages.length) renderEmpty('No messages yet');
    setComposer(false);
    updateCharCount();
    setOnline(0, []);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
