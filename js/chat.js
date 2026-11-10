(function () {
  'use strict';

  var Store = window.CoolAccountStore;
  if (!Store) return;

  var $ = function (id) { return document.getElementById(id); };
  var PENDING_KEY = 'cuh_chat_pending_v1';
  var messages = [];
  var seen = {};
  var socket = null;
  var reconnectTimer = 0;
  var reconnectAttempt = 0;
  var manuallyClosed = false;
  var initialized = false;

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

  function setOnline(count) {
    var online = $('chatOnline');
    if (online) online.textContent = String(Math.max(0, Number(count) || 0));
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

  function closeSocket(message) {
    manuallyClosed = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = 0;
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
    copy.textContent = 'Say hello to everyone in the room.';
    empty.appendChild(copy);
    list.appendChild(empty);
  }

  function displayName(user) {
    return user && user.name ? String(user.name) : 'player';
  }

  function initials(name) {
    return String(name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  }

  function formatTime(timestamp) {
    var date = new Date(Number(timestamp) || Date.now());
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function addMessage(message, animate) {
    if (!message || !message.id || seen[message.id]) return;
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

    var avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = initials(displayName(message.user));
    avatar.setAttribute('aria-hidden', 'true');

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

    item.appendChild(avatar);
    item.appendChild(body);
    list.appendChild(item);
    if (animate) item.classList.add('is-new');
    list.scrollTop = list.scrollHeight;
  }

  function renderHistory(list) {
    messages = [];
    seen = {};
    var container = $('chatMessages');
    if (container) container.replaceChildren();
    var entries = Array.isArray(list) ? list.slice(-100) : [];
    if (!entries.length) {
      renderEmpty('No messages yet');
      return;
    }
    entries.forEach(function (entry) { addMessage(entry, false); });
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
    setPending(false);
    setStatus('Connecting…', 'connecting');
    setComposer(false);

    Store.getAccessToken().then(function (token) {
      if (!token) {
        setStatus('Sign in again to use chat.', 'offline');
        setPending(true);
        showAccountPrompt();
        return;
      }
      var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      var ws = new WebSocket(protocol + '//' + location.host + '/api/chat?token=' + encodeURIComponent(token));
      socket = ws;

      ws.addEventListener('open', function () {
        reconnectAttempt = 0;
        setStatus('Live', 'live');
        setComposer(true);
      });

      ws.addEventListener('message', function (event) {
        var data;
        try { data = JSON.parse(event.data); } catch (error) { return; }
        if (!data || !data.type) return;
        if (data.type === 'history') {
          renderHistory(data.messages);
        } else if (data.type === 'message') {
          addMessage(data.message, true);
        } else if (data.type === 'presence') {
          setOnline(data.online);
        } else if (data.type === 'error') {
          setStatus(data.message || 'Message not sent.', 'offline');
        }
      });

      ws.addEventListener('close', function (event) {
        if (socket === ws) socket = null;
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

  function sendMessage() {
    var input = $('chatInput');
    if (!input) return;
    var text = String(input.value || '').replace(/\s+/g, ' ').trim();
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'message', text: text.slice(0, 500) }));
    input.value = '';
    input.style.height = '';
    input.focus();
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
      });
    }
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
      setOnline(0);
      if (hasPending()) setPending(false);
      if (document.body.dataset.activeTab === 'chat' && typeof window.switchTab === 'function') {
        window.switchTab('lessons');
      }
      return;
    }
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
