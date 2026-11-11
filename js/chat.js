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
  var friends = [];
  var friendRequests = [];
  var outgoingRequests = {};
  var socialOpen = false;
  var dmPeerId = '';
  var dmMessages = {};
  var dmSeen = {};
  var dmPending = {};
  var dmPollingBusy = false;
  var dmNoticeTimer = 0;

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

  function showDmNotice(message, reset) {
    var node = $('chatDmNotice');
    if (!node) return;
    clearTimeout(dmNoticeTimer);
    node.textContent = message || '';
    node.hidden = !message;
    if (message && reset !== false) {
      dmNoticeTimer = window.setTimeout(function () {
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

  function setDmComposer(enabled) {
    var input = $('chatDmInput');
    var button = $('chatDmSend');
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
    setDmComposer(false);
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
    renderFriends();
    updateDmHeader();
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
    renderFriends();
    updateDmHeader();
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
    renderFriends();
  }

  function mergeHistory(list) {
    if (!Array.isArray(list)) return;
    list.slice(-100).forEach(function (entry) { addMessage(entry, false); });
    if (!messages.length) renderEmpty('No messages yet');
  }

  function isOnlineUser(id) {
    var key = String(id || '');
    return onlineMembers.some(function (member) { return String(member.id) === key; });
  }

  function friendById(id) {
    var key = String(id || '');
    return friends.find(function (friend) { return String(friend.id) === key; }) || null;
  }

  function requestById(id) {
    var key = String(id || '');
    return friendRequests.find(function (request) { return String(request.id) === key; }) || null;
  }

  function makePersonRow(person, statusText) {
    var source = members[String(person && person.id)] || person || {};
    var row = document.createElement('div');
    row.className = 'chat-person';
    row.appendChild(makeAvatar(source, 'chat-person-avatar'));
    var copy = document.createElement('div');
    copy.className = 'chat-person-copy';
    var name = document.createElement('strong');
    name.textContent = displayName(source);
    var status = document.createElement('span');
    status.textContent = statusText || '';
    copy.appendChild(name);
    copy.appendChild(status);
    var actions = document.createElement('div');
    actions.className = 'chat-person-actions';
    row.appendChild(copy);
    row.appendChild(actions);
    return { row: row, actions: actions };
  }

  function personButton(label, className, handler, disabled) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-person-button' + (className ? ' ' + className : '');
    button.textContent = label;
    button.disabled = !!disabled;
    if (!disabled && handler) button.addEventListener('click', handler);
    return button;
  }

  function renderFriends() {
    var me = currentUser();
    var myId = me ? String(me.id) : '';
    var onlinePeople = onlineMembers.filter(function (member) {
      return member && member.id && String(member.id) !== myId;
    });
    var onlineList = $('chatOnlineList');
    var onlineLabel = $('chatOnlineCountLabel');
    if (onlineLabel) onlineLabel.textContent = String(onlinePeople.length);
    if (onlineList) {
      onlineList.replaceChildren();
      if (!onlinePeople.length) {
        var noPeople = document.createElement('div');
        noPeople.className = 'chat-social-empty';
        noPeople.textContent = 'No one else is online right now.';
        onlineList.appendChild(noPeople);
      } else {
        onlinePeople.forEach(function (member) {
          var id = String(member.id);
          var isFriend = !!friendById(id);
          var incoming = requestById(id);
          var row = makePersonRow(member, isFriend ? 'Friend' : incoming ? 'Wants to be friends' : 'Online');
          if (isFriend) {
            row.actions.appendChild(personButton('Message', 'is-primary', function () { openDm(id); }));
          } else if (incoming) {
            row.actions.appendChild(personButton('Accept', 'is-primary', function () { friendAction('friend-accept', id); }));
          } else if (outgoingRequests[id]) {
            row.actions.appendChild(personButton('Sent', '', null, true));
          } else {
            row.actions.appendChild(personButton('Add', '', function () { requestFriend(id, ''); }));
          }
          onlineList.appendChild(row.row);
        });
      }
    }

    var friendList = $('chatFriends');
    var friendCount = $('chatFriendCount');
    if (friendCount) friendCount.textContent = String(friends.length);
    if (friendList) {
      friendList.replaceChildren();
      var ordered = friends.slice().sort(function (a, b) {
        return Number(isOnlineUser(b.id)) - Number(isOnlineUser(a.id)) || displayName(a).localeCompare(displayName(b));
      });
      if (!ordered.length) {
        var noFriends = document.createElement('div');
        noFriends.className = 'chat-social-empty';
        noFriends.textContent = 'No friends yet. Add an online member below.';
        friendList.appendChild(noFriends);
      } else {
        ordered.forEach(function (friend) {
          var online = isOnlineUser(friend.id);
          var row = makePersonRow(memberFor(friend) || friend, online ? 'Online' : 'Offline');
          row.row.classList.toggle('is-offline', !online);
          row.actions.appendChild(personButton(online ? 'Message' : 'Offline', online ? 'is-primary' : '', function () { openDm(friend.id); }, !online));
          friendList.appendChild(row.row);
        });
      }
    }

    var requests = $('chatRequests');
    var requestBlock = $('chatRequestBlock');
    var badge = $('chatRequestBadge');
    if (badge) {
      badge.textContent = String(friendRequests.length);
      badge.hidden = !friendRequests.length;
    }
    if (requests) {
      requests.replaceChildren();
      if (requestBlock) requestBlock.hidden = !friendRequests.length;
      friendRequests.forEach(function (request) {
        var online = isOnlineUser(request.id);
        var row = makePersonRow(request, online ? 'Wants to be friends' : 'Offline · unavailable');
        row.row.classList.toggle('is-offline', !online);
        row.actions.appendChild(personButton('Accept', 'is-primary', function () { friendAction('friend-accept', request.id); }, !online));
        row.actions.appendChild(personButton('Decline', 'is-danger', function () { friendAction('friend-decline', request.id); }));
        requests.appendChild(row.row);
      });
    }
    updateDmHeader();
  }

  function setSocial(friendList, requestList) {
    if (Array.isArray(friendList)) {
      var friendMap = {};
      friendList.forEach(function (friend) {
        if (friend && friend.id) friendMap[String(friend.id)] = friend;
      });
      friends = Object.keys(friendMap).map(function (key) { return friendMap[key]; });
    }
    if (Array.isArray(requestList)) {
      var requestMap = {};
      requestList.forEach(function (request) {
        if (request && request.id) requestMap[String(request.id)] = request;
      });
      friendRequests = Object.keys(requestMap).map(function (key) { return requestMap[key]; });
    }
    friends.forEach(function (friend) { delete outgoingRequests[String(friend.id)]; });
    renderFriends();
  }

  function mergeSocial(data) {
    if (!data) return;
    if (Array.isArray(data.friends) || Array.isArray(data.requests)) {
      setSocial(data.friends, data.requests);
    }
  }

  function sendSocketPayload(payload, dm) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      if (dm) showDmNotice('Chat is not connected yet. Try again in a moment.');
      else showNotice('Chat is not connected yet. Try again in a moment.');
      return false;
    }
    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      if (dm) showDmNotice('Could not send that message. Try again.');
      else showNotice('Could not send that message. Try again.');
      return false;
    }
  }

  function requestFriend(targetId, targetName) {
    var me = currentUser();
    if (targetId && me && String(targetId) === String(me.id)) return;
    sendSocketPayload({ type: 'friend-request', targetId: targetId || '', targetName: targetName || '' });
  }

  function friendAction(type, personId) {
    var id = String(personId || '');
    if (!id) return;
    sendSocketPayload({ type: type, requesterId: id });
  }

  function setSocialOpen(open) {
    socialOpen = !!open;
    document.body.classList.toggle('chat-social-open', socialOpen);
    var toggle = $('chatPeopleToggle');
    if (toggle) toggle.setAttribute('aria-expanded', socialOpen ? 'true' : 'false');
    var backdrop = $('chatSocialBackdrop');
    if (backdrop) backdrop.hidden = !socialOpen;
    if (socialOpen) renderFriends();
  }

  function closeSocial() {
    setSocialOpen(false);
  }

  function updateDmHeader() {
    var friend = friendById(dmPeerId);
    if (!friend) return;
    var online = isOnlineUser(friend.id);
    var holder = $('chatDmAvatar');
    if (holder) {
      var avatar = makeAvatar(memberFor(friend) || friend, 'chat-avatar');
      var image = avatar.querySelector('img');
      holder.replaceChildren(image || avatar);
    }
    var name = $('chatDmName');
    if (name) name.textContent = displayName(memberFor(friend) || friend);
    var status = $('chatDmStatus');
    if (status) {
      status.textContent = online ? 'Online · messages sync live' : 'Offline · messaging unavailable';
      status.dataset.state = online ? 'online' : 'offline';
    }
    var input = $('chatDmInput');
    if (input) input.placeholder = online ? 'Message ' + displayName(friend) + '...' : displayName(friend) + ' is offline';
    setDmComposer(online && !!socket && socket.readyState === WebSocket.OPEN);
  }

  function openDm(friendId) {
    var friend = friendById(friendId);
    if (!friend) return;
    if (!isOnlineUser(friend.id)) {
      showNotice(displayName(friend) + ' is offline. Messages can be sent only to online friends.');
      return;
    }
    dmPeerId = String(friend.id);
    var room = $('chatRoomView');
    var view = $('chatDmView');
    if (room) room.hidden = true;
    if (view) view.hidden = false;
    closeSocial();
    showDmNotice('');
    if ((dmMessages[dmPeerId] || []).length) renderDmMessages();
    else renderDmEmpty('No messages yet');
    updateDmHeader();
    requestDmHistory(dmPeerId);
    syncDmHistory();
    var input = $('chatDmInput');
    if (input) window.setTimeout(function () { input.focus(); }, 80);
  }

  function closeDm() {
    dmPeerId = '';
    var room = $('chatRoomView');
    var view = $('chatDmView');
    if (room) room.hidden = false;
    if (view) view.hidden = true;
    setDmComposer(false);
  }

  function renderDmEmpty(text) {
    var list = $('chatDmMessages');
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
    copy.textContent = 'Only friends can see this conversation.';
    empty.appendChild(copy);
    list.appendChild(empty);
  }

  function appendDmNode(message, animate) {
    var list = $('chatDmMessages');
    if (!list || !message) return;
    var me = currentUser();
    var from = message.from || {};
    var own = !!me && String(from.id) === String(me.id);
    var source = members[String(from.id)] || friendById(from.id) || from;
    var item = document.createElement('article');
    item.className = 'chat-message' + (own ? ' is-own' : '');
    if (message.id) item.setAttribute('data-message-id', message.id);
    item.setAttribute('data-author-id', String(from.id || ''));
    item.appendChild(makeAvatar(own && me ? me : source, 'chat-avatar'));
    var body = document.createElement('div');
    body.className = 'chat-message-body';
    var meta = document.createElement('div');
    meta.className = 'chat-message-meta';
    var name = document.createElement('strong');
    name.textContent = own ? 'You' : displayName(source);
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

  function renderDmMessages() {
    var list = $('chatDmMessages');
    if (!list || !dmPeerId) return;
    list.replaceChildren();
    var entries = dmMessages[dmPeerId] || [];
    if (!entries.length) renderDmEmpty('No messages yet');
    else entries.forEach(function (message) { appendDmNode(message, false); });
    Object.keys(dmPending).forEach(function (key) {
      var entry = dmPending[key];
      if (entry && entry.peer === dmPeerId && entry.node) list.appendChild(entry.node);
    });
    list.scrollTop = list.scrollHeight;
  }

  function addDmPending(text, clientId) {
    var peer = dmPeerId;
    var list = $('chatDmMessages');
    if (!peer || !clientId || !list) return;
    var empty = list.querySelector('.chat-empty');
    if (empty) empty.remove();
    var item = document.createElement('article');
    item.className = 'chat-message is-own is-pending';
    item.setAttribute('data-client-id', clientId);
    item.appendChild(makeAvatar(currentUser(), 'chat-avatar'));
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
    dmPending[clientId] = { peer: peer, text: text, node: item };
    list.scrollTop = list.scrollHeight;
  }

  function removeDmPending(clientId) {
    var entry = clientId ? dmPending[clientId] : null;
    if (!entry) return;
    if (entry.node && entry.node.parentNode) entry.node.parentNode.removeChild(entry.node);
    delete dmPending[clientId];
  }

  function addDmMessage(message, animate) {
    if (!message || !message.id || dmSeen[message.id]) return;
    var me = currentUser();
    var from = message.from || {};
    var otherId = me && String(from.id) === String(me.id) ? String(message.to || '') : String(from.id || '');
    if (!otherId) return;
    dmSeen[message.id] = true;
    if (message.clientId) removeDmPending(message.clientId);
    var entries = dmMessages[otherId] || [];
    entries.push(message);
    dmMessages[otherId] = entries.slice(-100);
    if (dmPeerId === otherId) {
      var list = $('chatDmMessages');
      if (list) {
        var empty = list.querySelector('.chat-empty');
        if (empty) empty.remove();
      }
      appendDmNode(message, animate);
    }
  }

  function mergeDmHistory(friendId, list) {
    var peer = String(friendId || '');
    if (!peer || !Array.isArray(list)) return;
    var current = dmMessages[peer] || [];
    var known = {};
    current.forEach(function (message) { known[message.id] = true; });
    var merged = current.slice();
    list.forEach(function (message) {
      if (!message || !message.id || known[message.id]) return;
      known[message.id] = true;
      dmSeen[message.id] = true;
      merged.push(message);
    });
    merged.sort(function (a, b) { return (Number(a.at) || 0) - (Number(b.at) || 0); });
    dmMessages[peer] = merged.slice(-100);
    if (dmPeerId === peer) renderDmMessages();
  }

  function requestDmHistory(friendId) {
    if (!friendId || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'dm-history', friendId: String(friendId) }));
  }

  function syncDmHistory() {
    var peer = dmPeerId;
    if (!peer || dmPollingBusy || !accessToken || document.hidden) return;
    dmPollingBusy = true;
    fetch('/api/chat/dm-history?friend=' + encodeURIComponent(peer), {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + accessToken },
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(function (response) {
      if (response.status === 401) {
        showDmNotice('Your session expired. Sign in again to keep chatting.');
        closeSocket('Sign in to join the chat');
        return null;
      }
      if (!response.ok) return null;
      return response.json();
    }).then(function (data) {
      if (data && data.messages && String(data.friendId) === String(peer)) mergeDmHistory(peer, data.messages);
    }).catch(function () {
      // The socket remains the primary delivery path for direct messages.
    }).finally(function () {
      dmPollingBusy = false;
    });
  }

  function updateDmCharCount() {
    var input = $('chatDmInput');
    var count = $('chatDmCharCount');
    if (input && count) count.textContent = String(input.value.length) + ' / 500';
  }

  function sendDmMessage() {
    var input = $('chatDmInput');
    if (!input || !dmPeerId) return;
    var friend = friendById(dmPeerId);
    if (!friend || !isOnlineUser(dmPeerId)) {
      showDmNotice(displayName(friend) + ' is offline. Messages can be sent only to online friends.');
      updateDmHeader();
      return;
    }
    var text = String(input.value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!text) return;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      showDmNotice('Chat is not connected yet. Try again in a moment.');
      return;
    }
    var clientId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'dm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    addDmPending(text, clientId);
    if (!sendSocketPayload({ type: 'dm', to: dmPeerId, text: text, clientId: clientId }, true)) {
      removeDmPending(clientId);
      return;
    }
    input.value = '';
    input.style.height = '';
    updateDmCharCount();
    input.focus();
  }

  function handleDmError(data) {
    var entry = data && data.clientId ? dmPending[data.clientId] : null;
    var text = entry ? entry.text : '';
    removeDmPending(data && data.clientId);
    var input = $('chatDmInput');
    if (text && input && !input.value) {
      input.value = text;
      updateDmCharCount();
      input.focus();
    }
    showDmNotice(data && data.message || 'That message could not be sent.');
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
      mergeSocial(data);
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
    syncDmHistory();
    pollTimer = window.setInterval(function () {
      syncHistory();
      syncDmHistory();
    }, POLL_MS);
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
          mergeSocial(data);
          mergeHistory(data.messages);
        } else if (data.type === 'message') {
          addMessage(data.message, true);
        } else if (data.type === 'message-error') {
          handleMessageError(data);
        } else if (data.type === 'presence') {
          setOnline(data.online, data.members);
        } else if (data.type === 'member') {
          updateMember(data.member);
        } else if (data.type === 'social') {
          mergeSocial(data);
        } else if (data.type === 'friend-request') {
          mergeSocial(data);
          var requestName = data.request ? displayName(data.request) : 'Someone';
          showNotice(requestName + ' sent you a friend request.');
          if (dmPeerId) showDmNotice(requestName + ' sent you a friend request.');
        } else if (data.type === 'friend-request-sent') {
          if (data.target && data.target.id) outgoingRequests[String(data.target.id)] = true;
          renderFriends();
          var sentName = displayName(data.target);
          showNotice('Friend request sent to ' + sentName + '.');
          if (dmPeerId) showDmNotice('Friend request sent to ' + sentName + '.');
        } else if (data.type === 'friend-accepted') {
          var acceptedName = data.friend ? displayName(data.friend) : 'Your friend';
          showNotice(acceptedName + ' accepted your friend request.');
          if (dmPeerId) showDmNotice(acceptedName + ' accepted your friend request.');
        } else if (data.type === 'friend-declined') {
          if (data.friend && data.friend.id) {
            delete outgoingRequests[String(data.friend.id)];
            renderFriends();
          }
          showNotice(displayName(data.friend) + ' declined your friend request.');
        } else if (data.type === 'friend-error') {
          showNotice(data.message || 'Could not send that friend request.');
          if (dmPeerId) showDmNotice(data.message || 'Could not send that friend request.');
        } else if (data.type === 'dm') {
          addDmMessage(data.message, true);
        } else if (data.type === 'dm-history') {
          mergeDmHistory(data.friendId, data.messages);
        } else if (data.type === 'dm-error') {
          handleDmError(data);
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

    var friendForm = $('chatFriendForm');
    var friendName = $('chatFriendName');
    if (friendForm) {
      friendForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var name = String(friendName && friendName.value || '').trim();
        if (!name) return;
        requestFriend('', name);
        if (friendName) friendName.value = '';
      });
    }

    var peopleToggle = $('chatPeopleToggle');
    if (peopleToggle) {
      peopleToggle.addEventListener('click', function () { setSocialOpen(!socialOpen); });
    }
    var socialClose = $('chatSocialClose');
    if (socialClose) socialClose.addEventListener('click', closeSocial);
    var socialBackdrop = $('chatSocialBackdrop');
    if (socialBackdrop) socialBackdrop.addEventListener('click', closeSocial);

    var dmBack = $('chatDmBack');
    if (dmBack) dmBack.addEventListener('click', closeDm);
    var dmForm = $('chatDmForm');
    var dmInput = $('chatDmInput');
    if (dmForm) {
      dmForm.addEventListener('submit', function (event) {
        event.preventDefault();
        sendDmMessage();
      });
    }
    if (dmInput) {
      dmInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendDmMessage();
        }
      });
      dmInput.addEventListener('input', function () {
        dmInput.style.height = 'auto';
        dmInput.style.height = Math.min(140, dmInput.scrollHeight) + 'px';
        updateDmCharCount();
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (socialOpen) {
        closeSocial();
      } else if (dmPeerId) {
        closeDm();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden || !socket || socket.readyState !== WebSocket.OPEN) return;
      syncHistory();
      syncDmHistory();
    });
  }

  function handleSwitch(event) {
    var tab = event.detail && event.detail.tab;
    document.body.classList.toggle('chat-active', tab === 'chat');
    if (tab && tab !== 'chat') {
      closeSocial();
      closeDm();
      closeSocket('Disconnected');
    }
  }

  function handleAccountChange() {
    var user = currentUser();
    if (!user) {
      closeDm();
      closeSocial();
      setSocial([], []);
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
    setDmComposer(false);
    updateCharCount();
    updateDmCharCount();
    setSocialOpen(false);
    setOnline(0, []);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
