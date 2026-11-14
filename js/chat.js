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
  var roomReply = null;
  var dmReply = null;
  var notifications = [];
  var notificationsOpen = false;
  var notificationBusy = false;
  var notificationTimer = 0;
  var siteOwner = false;
  var ownerStatusBusy = false;
  var profileUserId = '';
  var profileUserName = '';

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

  function notificationLabel(type) {
    if (type === 'mention') return 'Mention';
    if (type === 'reply') return 'Reply';
    if (type === 'friend-request') return 'Friend request';
    if (type === 'dm') return 'Direct message';
    return 'Notification';
  }

  function notificationSummary(notification) {
    var text = String(notification && notification.text || '');
    var invite = parseGameInvite(text);
    if (invite) return 'invited you to play ' + invite.title + '.';
    if (notification.type === 'mention') return 'mentioned you: ' + text;
    if (notification.type === 'reply') return 'replied to you: ' + text;
    if (notification.type === 'friend-request') return text || 'sent you a friend request.';
    return text || 'sent you a message.';
  }

  function unreadNotificationCount() {
    return notifications.filter(function (notification) { return !notification.read; }).length;
  }

  function renderNotifications() {
    var nav = $('notificationNav');
    var user = currentUser();
    var visible = !!user && !isLocal(user);
    if (nav) nav.hidden = !visible;
    if (!visible) {
      if (notificationsOpen) setNotificationsOpen(false);
      return;
    }
    var unread = unreadNotificationCount();
    var badge = $('notificationBadge');
    if (badge) {
      badge.hidden = !unread;
      badge.textContent = unread > 99 ? '99+' : String(unread);
    }
    var mark = $('notificationMarkRead');
    if (mark) mark.hidden = !unread;
    var list = $('notificationList');
    var empty = $('notificationEmpty');
    if (!list) return;
    list.replaceChildren();
    notifications.forEach(function (notification) {
      if (!notification || !notification.actor) return;
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'notification-item' + (notification.read ? '' : ' is-unread');
      item.setAttribute('data-notification-id', notification.id || '');
      item.appendChild(makeAvatar(notification.actor, 'notification-avatar'));
      var copy = document.createElement('div');
      copy.className = 'notification-copy';
      var name = document.createElement('strong');
      name.textContent = displayName(notification.actor);
      var summary = document.createElement('span');
      summary.textContent = notificationSummary(notification) + (Number(notification.count) > 1 ? ' (' + notification.count + ' messages)' : '');
      var time = document.createElement('time');
      time.dateTime = new Date(Number(notification.at) || Date.now()).toISOString();
      time.textContent = notificationLabel(notification.type) + ' · ' + formatTime(notification.at);
      copy.append(name, summary, time);
      item.appendChild(copy);
      item.addEventListener('click', function () { handleNotification(notification); });
      list.appendChild(item);
    });
    if (empty) empty.hidden = notifications.length > 0;
  }

  function setNotificationsOpen(open) {
    notificationsOpen = !!open;
    var panel = $('notificationPanel');
    var button = $('notificationButton');
    if (panel) panel.hidden = !notificationsOpen;
    if (button) button.setAttribute('aria-expanded', notificationsOpen ? 'true' : 'false');
    if (notificationsOpen) renderNotifications();
  }

  function mergeNotifications(list) {
    if (!Array.isArray(list)) return;
    var byId = {};
    notifications.forEach(function (notification) {
      if (notification && notification.id) byId[notification.id] = notification;
    });
    list.forEach(function (notification) {
      if (notification && notification.id) byId[notification.id] = notification;
    });
    notifications = Object.keys(byId).map(function (id) { return byId[id]; })
      .sort(function (a, b) { return (Number(b.at) || 0) - (Number(a.at) || 0); })
      .slice(0, 40);
    renderNotifications();
  }

  function addNotification(notification) {
    if (!notification || !notification.id) return;
    var index = notifications.findIndex(function (item) { return item.id === notification.id; });
    if (index !== -1) notifications.splice(index, 1);
    notifications.unshift(notification);
    notifications = notifications.slice(0, 40);
    renderNotifications();
  }

  function syncNotifications() {
    var user = currentUser();
    if (!user || isLocal(user)) {
      renderNotifications();
      return;
    }
    if (notificationBusy) return;
    notificationBusy = true;
    Store.getAccessToken().then(function (token) {
      if (!token) return null;
      return fetch('/api/chat/notifications', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
        credentials: 'same-origin'
      });
    }).then(function (response) {
      if (!response || response.status === 401 || !response.ok) return null;
      return response.json();
    }).then(function (data) {
      if (data && Array.isArray(data.notifications)) mergeNotifications(data.notifications);
    }).catch(function () {
      // The socket remains the live path; the next poll retries this request.
    }).finally(function () {
      notificationBusy = false;
    });
  }

  function markAllNotificationsRead() {
    if (!unreadNotificationCount()) return;
    notifications = notifications.map(function (notification) {
      return notification.read ? notification : Object.assign({}, notification, { read: true });
    });
    renderNotifications();
    var user = currentUser();
    if (!user || isLocal(user)) return;
    Store.getAccessToken().then(function (token) {
      if (!token) return null;
      return fetch('/api/chat/notifications/read', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
        credentials: 'same-origin'
      });
    }).catch(function () {});
  }

  function focusChatMessage(messageId) {
    var id = String(messageId || '');
    if (!id) return;
    var attempts = 0;
    var timer = window.setInterval(function () {
      var node = Array.prototype.slice.call(document.querySelectorAll('#chatMessages .chat-message')).find(function (item) {
        return item.getAttribute('data-message-id') === id;
      });
      if (!node) {
        if (++attempts > 30) window.clearInterval(timer);
        return;
      }
      window.clearInterval(timer);
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
      node.classList.add('is-highlighted');
      window.setTimeout(function () { node.classList.remove('is-highlighted'); }, 2600);
    }, 200);
  }

  function handleNotification(notification) {
    if (!notification) return;
    setNotificationsOpen(false);
    markAllNotificationsRead();
    if (typeof window.openChat !== 'function') return;
    window.openChat();
    window.setTimeout(function () {
      if (notification.type === 'friend-request') {
        setSocialOpen(true);
      } else if (notification.type === 'dm' && notification.actor && friendById(notification.actor.id)) {
        openDm(notification.actor.id);
      } else if ((notification.type === 'mention' || notification.type === 'reply') && notification.messageId) {
        focusChatMessage(notification.messageId);
      }
    }, 350);
  }

  function registerChatProfile() {
    var user = currentUser();
    if (!user || isLocal(user)) return;
    Store.getAccessToken().then(function (token) {
      if (!token) return null;
      return fetch('/api/chat/register', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
        credentials: 'same-origin'
      });
    }).catch(function () {});
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

  function cacheMember(user) {
    if (!user || !user.id) return;
    var id = String(user.id);
    var existing = members[id] || {};
    members[id] = {
      id: id,
      name: displayName(user) !== 'player' ? displayName(user) : (existing.name || 'player'),
      avatar: user.avatar || existing.avatar || '',
      bio: user.bio ? String(user.bio) : (existing.bio || '')
    };
  }

  function profileForUser(value) {
    var id = typeof value === 'object' && value ? String(value.id || '') : String(value || '');
    if (!id) return null;
    var me = currentUser();
    if (me && String(me.id) === id) {
      return { id: id, name: me.username || 'player', avatar: me.avatar || '', bio: me.bio || '' };
    }
    var member = members[id];
    var friend = friendById(id);
    var request = requestById(id);
    var base = member || friend || request || (typeof value === 'object' && value ? value : {});
    var bio = (member && member.bio) || (friend && friend.bio) || (request && request.bio) ||
      (typeof value === 'object' && value && value.bio) || '';
    return {
      id: id,
      name: displayName(base) !== 'player' ? displayName(base) : 'player',
      avatar: avatarFor(base),
      bio: bio
    };
  }

  function decorateProfileName(node, user) {
    if (!node || !user || !user.id) return node;
    node.setAttribute('data-profile-user', String(user.id));
    node.classList.add('chat-profile-link');
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', 'View ' + displayName(user) + '\u2019s profile');
    return node;
  }

  function openChatProfile(value) {
    var profile = profileForUser(value);
    if (!profile || !profile.id) return;
    var modal = $('chatProfileModal');
    if (!modal) return;
    var me = currentUser();
    var own = !!me && String(me.id) === String(profile.id);
    profileUserId = String(profile.id);
    var name = $('chatProfileName');
    if (name) name.textContent = '@' + (profile.name || 'player');
    var status = $('chatProfileStatus');
    if (status) {
      status.textContent = own
        ? 'This is you'
        : (isOnlineUser(profile.id) ? 'Online now' : (friendById(profile.id) ? 'Friend \u00b7 offline' : 'Site member'));
    }
    var bioNode = $('chatProfileBio');
    if (bioNode) {
      var bio = String(profile.bio || '').trim();
      bioNode.textContent = bio || (own ? 'Add a bio in Account settings so people can get to know you.' : 'No bio yet.');
      bioNode.classList.toggle('is-empty', !bio);
    }
    var image = $('chatProfileAvatarImage');
    if (image) {
      image.src = avatarFor(profile);
      image.onerror = function () {
        if (image.src.indexOf(DEFAULT_AVATAR) === -1) image.src = DEFAULT_AVATAR;
      };
    }
    var edit = $('chatProfileEdit');
    if (edit) edit.hidden = !own;
    profileUserName = profile.name || 'player';
    var pay = $('chatProfilePay');
    if (pay) pay.hidden = own;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('chat-profile-open');
    var close = modal.querySelector('.chat-profile-close');
    if (close) close.focus();
  }

  function closeChatProfile() {
    var modal = $('chatProfileModal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('chat-profile-open');
    profileUserId = '';
  }

  function editOwnProfile() {
    closeChatProfile();
    if (typeof window.openAccount === 'function') window.openAccount();
    window.setTimeout(function () {
      var input = $('accountBio');
      if (!input) return;
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    }, 220);
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
    return (user && user.avatar) || (member && member.avatar) || DEFAULT_AVATAR;
  }

  function makeAvatar(user, className) {
    var id = user && user.id ? String(user.id) : '';
    var wrap = document.createElement('div');
    wrap.className = className || 'chat-avatar';
    if (id) {
      wrap.setAttribute('data-avatar-user', id);
      wrap.setAttribute('data-profile-user', id);
    }
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
        var existing = members[id] || {};
        members[id] = {
          id: id,
          name: displayName(member) !== 'player' ? displayName(member) : (existing.name || 'player'),
          avatar: member.avatar || existing.avatar || '',
          bio: member.bio !== undefined ? String(member.bio || '') : (existing.bio || '')
        };
        return members[id];
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
    var existing = members[id] || {};
    members[id] = {
      id: id,
      name: displayName(member) !== 'player' ? displayName(member) : (existing.name || 'player'),
      avatar: member.avatar || existing.avatar || '',
      bio: member.bio !== undefined ? String(member.bio || '') : (existing.bio || '')
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

  function addAdminDeleteControl(item, messageId, peerId) {
    if (!siteOwner || !item || !messageId) return;
    var actions = item.querySelector('.chat-message-actions');
    if (!actions || actions.querySelector('[data-admin-delete]')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-admin-delete';
    button.textContent = 'Delete';
    button.setAttribute('data-admin-delete', messageId);
    if (peerId) button.setAttribute('data-admin-peer', peerId);
    actions.appendChild(button);
  }

  function applyAdminDeleteControls() {
    document.querySelectorAll('#chatMessages .chat-message, #chatDmMessages .chat-message').forEach(function (item) {
      var id = item.getAttribute('data-message-id');
      var peer = item.getAttribute('data-chat-peer') || '';
      if (siteOwner && id) addAdminDeleteControl(item, id, peer);
      if (!siteOwner) {
        var button = item.querySelector('[data-admin-delete]');
        if (button) button.remove();
      }
    });
  }

  function removeRoomMessage(messageId) {
    var id = String(messageId || '');
    if (!id) return;
    messages = messages.filter(function (message) { return String(message.id) !== id; });
    delete seen[id];
    document.querySelectorAll('#chatMessages .chat-message[data-message-id="' + id + '"]').forEach(function (node) {
      node.remove();
    });
    var list = $('chatMessages');
    if (list && !list.querySelector('.chat-message') && !list.querySelector('.chat-empty')) renderEmpty('No messages yet');
  }

  function removeDmMessage(messageId) {
    var id = String(messageId || '');
    if (!id) return;
    Object.keys(dmMessages).forEach(function (peer) {
      dmMessages[peer] = (dmMessages[peer] || []).filter(function (message) {
        return String(message.id) !== id;
      });
    });
    Object.keys(dmSeen).forEach(function (peer) {
      if (dmSeen[peer]) delete dmSeen[peer][id];
    });
    renderDmMessages();
  }

  async function deleteAdminMessageFromButton(button) {
    if (!siteOwner || !button) return;
    var messageId = button.getAttribute('data-admin-delete');
    var peer = button.getAttribute('data-admin-peer') || '';
    if (!messageId) return;
    var confirmed = window.confirm('Delete this message for everyone?');
    if (!confirmed) return;
    button.disabled = true;
    var result = await Store.adminDeleteMessage(messageId, peer);
    if (!result.ok) {
      button.disabled = false;
      showNotice(result.error);
      if (peer) showDmNotice(result.error);
      return;
    }
    if (peer) removeDmMessage(messageId);
    else removeRoomMessage(messageId);
  }

  function refreshSiteOwner() {
    var user = currentUser();
    if (!user || isLocal(user)) {
      siteOwner = false;
      applyAdminDeleteControls();
      return;
    }
    if (ownerStatusBusy) return;
    ownerStatusBusy = true;
    Store.adminStatus().then(function (result) {
      siteOwner = !!(result && result.ok && result.owner);
      applyAdminDeleteControls();
    }).catch(function () {
      siteOwner = false;
      applyAdminDeleteControls();
    }).finally(function () {
      ownerStatusBusy = false;
    });
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
    cacheMember(message.user);
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
    decorateProfileName(name, message.user);
    var time = document.createElement('time');
    time.dateTime = new Date(Number(message.at) || Date.now()).toISOString();
    time.textContent = formatTime(message.at);
    meta.appendChild(name);
    meta.appendChild(time);
    var quote = makeReplyQuote(message.replyTo);
    var text = document.createElement('p');
    appendMessageText(text, message);
    body.appendChild(meta);
    if (quote) body.appendChild(quote);
    body.appendChild(text);
    var actions = document.createElement('div');
    actions.className = 'chat-message-actions';
    var reply = document.createElement('button');
    reply.type = 'button';
    reply.className = 'chat-reply-button';
    reply.textContent = 'Reply';
    reply.addEventListener('click', function () { setRoomReply(message); });
    actions.appendChild(reply);
    body.appendChild(actions);

    item.appendChild(body);
    list.appendChild(item);
    addAdminDeleteControl(item, message.id, '');
    if (animate) item.classList.add('is-new');
    list.scrollTop = list.scrollHeight;
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function appendMessageText(node, message) {
    var text = String(message && message.text || '');
    var names = (message && message.mentions || []).map(function (mention) {
      return mention && mention.name ? String(mention.name) : '';
    }).filter(Boolean);
    var unique = names.filter(function (name, index) { return names.indexOf(name) === index; });
    if (!unique.length) {
      node.textContent = text;
      return;
    }
    var pattern = new RegExp('@(?:' + unique.map(escapeRegExp).join('|') + ')(?![A-Za-z0-9_.-])', 'gi');
    var last = 0;
    var match;
    while ((match = pattern.exec(text))) {
      if (match.index > last) node.appendChild(document.createTextNode(text.slice(last, match.index)));
      var span = document.createElement('span');
      span.className = 'chat-mention';
      span.textContent = match[0];
      node.appendChild(span);
      last = pattern.lastIndex;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  function makeReplyQuote(reply) {
    if (!reply || !reply.id) return null;
    var quote = document.createElement('blockquote');
    quote.className = 'chat-reply-quote';
    cacheMember(reply.user);
    var name = document.createElement('strong');
    name.textContent = displayName(reply.user || {});
    decorateProfileName(name, reply.user || {});
    var text = document.createElement('span');
    text.textContent = String(reply.text || '');
    quote.append(name, text);
    return quote;
  }

  function setRoomReply(message) {
    if (!message || !message.id) return;
    roomReply = { id: message.id, user: message.user, text: String(message.text || '').slice(0, 160) };
    var preview = $('chatReplyPreview');
    if (preview) preview.hidden = false;
    if ($('chatReplyName')) $('chatReplyName').textContent = 'Replying to ' + displayName(message.user);
    if ($('chatReplyText')) $('chatReplyText').textContent = roomReply.text;
    if ($('chatInput')) $('chatInput').focus();
  }

  function clearRoomReply() {
    roomReply = null;
    if ($('chatReplyPreview')) $('chatReplyPreview').hidden = true;
    if ($('chatReplyText')) $('chatReplyText').textContent = '';
  }

  function setDmReply(message) {
    if (!message || !message.id) return;
    dmReply = { id: message.id, user: message.from || {}, text: String(message.text || '').slice(0, 160) };
    var preview = $('chatDmReplyPreview');
    if (preview) preview.hidden = false;
    if ($('chatDmReplyName')) $('chatDmReplyName').textContent = 'Replying to ' + displayName(message.from);
    if ($('chatDmReplyText')) $('chatDmReplyText').textContent = dmReply.text;
    if ($('chatDmInput')) $('chatDmInput').focus();
  }

  function clearDmReply() {
    dmReply = null;
    if ($('chatDmReplyPreview')) $('chatDmReplyPreview').hidden = true;
    if ($('chatDmReplyText')) $('chatDmReplyText').textContent = '';
  }

  function removeUserContent(userId) {
    var id = String(userId || '');
    if (!id) return;
    messages = messages.filter(function (message) {
      var removed = String(message && message.user && message.user.id) === id;
      if (removed) delete seen[message.id];
      return !removed;
    });
    document.querySelectorAll('#chatMessages .chat-message, #chatDmMessages .chat-message').forEach(function (item) {
      if (String(item.getAttribute('data-author-id') || '') === id) item.remove();
    });
    Object.keys(dmMessages).forEach(function (peer) {
      dmMessages[peer] = dmMessages[peer].filter(function (message) {
        var removed = String(message && message.from && message.from.id) === id;
        if (removed) delete dmSeen[message.id];
        return !removed;
      });
    });
    delete members[id];
    onlineMembers = onlineMembers.filter(function (member) { return String(member && member.id) !== id; });
    friends = friends.filter(function (friend) { return String(friend && friend.id) !== id; });
    friendRequests = friendRequests.filter(function (request) { return String(request && request.id) !== id; });
    delete outgoingRequests[id];
    if (dmPeerId === id) {
      closeDm();
      showNotice('That member deleted their account.');
    }
    renderPresence();
    renderFriends();
    if (!messages.length) renderEmpty('No messages yet');
    if (dmPeerId) {
      if ((dmMessages[dmPeerId] || []).length) renderDmMessages();
      else renderDmEmpty('No messages yet');
    }
  }

  function mergeMembers(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function (member) {
      if (!member || !member.id) return;
      var id = String(member.id);
      var existing = members[id] || {};
      members[id] = {
        id: id,
        name: displayName(member) !== 'player' ? displayName(member) : (existing.name || 'player'),
        avatar: member.avatar || existing.avatar || '',
        bio: member.bio !== undefined ? String(member.bio || '') : (existing.bio || '')
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
    decorateProfileName(name, source);
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
        noFriends.textContent = 'No friends yet. Add someone below.';
        friendList.appendChild(noFriends);
      } else {
        ordered.forEach(function (friend) {
          var online = isOnlineUser(friend.id);
          var row = makePersonRow(memberFor(friend) || friend, online ? 'Online' : 'Offline');
          row.row.classList.toggle('is-offline', !online);
          row.actions.appendChild(personButton('Message', 'is-primary', function () { openDm(friend.id); }));
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
        var row = makePersonRow(request, online ? 'Wants to be friends' : 'Wants to be friends · offline');
        row.row.classList.toggle('is-offline', !online);
        row.actions.appendChild(personButton('Accept', 'is-primary', function () { friendAction('friend-accept', request.id); }));
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
    var display = memberFor(friend) || friend;
    if (holder) {
      holder.setAttribute('data-profile-user', String(friend.id));
      var avatar = makeAvatar(display, 'chat-avatar');
      var image = avatar.querySelector('img');
      holder.replaceChildren(image || avatar);
    }
    var name = $('chatDmName');
    if (name) {
      name.textContent = displayName(display);
      decorateProfileName(name, display);
    }
    var status = $('chatDmStatus');
    if (status) {
      status.textContent = online ? 'Online · messages sync live' : 'Offline · messages delivered when they return';
      status.dataset.state = online ? 'online' : 'offline';
    }
    var input = $('chatDmInput');
    if (input) input.placeholder = 'Message ' + displayName(friend) + (online ? '...' : ' (they are offline)...');
    setDmComposer(!!socket && socket.readyState === WebSocket.OPEN);
  }

  function openDm(friendId) {
    var friend = friendById(friendId);
    if (!friend) return;
    dmPeerId = String(friend.id);
    clearDmReply();
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
    clearDmReply();
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
    var cached = members[String(from.id)] || friendById(from.id) || {};
    var source = {
      id: from.id,
      name: from.name || cached.name || 'player',
      avatar: from.avatar || cached.avatar || '',
      bio: from.bio || cached.bio || ''
    };
    cacheMember(source);
    var item = document.createElement('article');
    item.className = 'chat-message' + (own ? ' is-own' : '');
    if (message.id) item.setAttribute('data-message-id', message.id);
    item.setAttribute('data-chat-peer', dmPeerId);
    item.setAttribute('data-author-id', String(from.id || ''));
    item.appendChild(makeAvatar(own && me ? me : source, 'chat-avatar'));
    var body = document.createElement('div');
    body.className = 'chat-message-body';
    var meta = document.createElement('div');
    meta.className = 'chat-message-meta';
    var name = document.createElement('strong');
    name.textContent = own ? 'You' : displayName(source);
    decorateProfileName(name, source);
    var time = document.createElement('time');
    time.dateTime = new Date(Number(message.at) || Date.now()).toISOString();
    time.textContent = formatTime(message.at);
    meta.appendChild(name);
    meta.appendChild(time);
    var quote = makeReplyQuote(message.replyTo);
    var invite = parseGameInvite(message.text);
    var text;
    if (invite) {
      text = makeInviteCard(invite, own);
    } else {
      text = document.createElement('p');
      appendMessageText(text, message);
    }
    body.appendChild(meta);
    if (quote) body.appendChild(quote);
    body.appendChild(text);
    var actions = document.createElement('div');
    actions.className = 'chat-message-actions';
    var reply = document.createElement('button');
    reply.type = 'button';
    reply.className = 'chat-reply-button';
    reply.textContent = 'Reply';
    reply.addEventListener('click', function () { setDmReply(message); });
    actions.appendChild(reply);
    body.appendChild(actions);
    item.appendChild(body);
    list.appendChild(item);
    addAdminDeleteControl(item, message.id, dmPeerId);
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
    if (!friend) {
      showDmNotice('That friendship is no longer available.');
      updateDmHeader();
      return;
    }
    var text = String(input.value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!text) return;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      showDmNotice('Chat is not connected yet. Try again in a moment.');
      return;
    }
    var replyTo = dmReply ? dmReply.id : '';
    var clientId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'dm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    addDmPending(text, clientId);
    if (!sendSocketPayload({ type: 'dm', to: dmPeerId, text: text, clientId: clientId, replyTo: replyTo }, true)) {
      removeDmPending(clientId);
      return;
    }
    input.value = '';
    input.style.height = '';
    updateDmCharCount();
    clearDmReply();
    input.focus();
  }

  /* ---------- Game invites ---------- */
  var INVITE_PREFIX = '[[game-invite]]';
  var inviteGame = null;
  var inviteOwnSocket = false;

  function parseGameInvite(text) {
    var value = String(text || '');
    var start = value.indexOf(INVITE_PREFIX);
    if (start === -1) return null;
    var parts = value.slice(start + INVITE_PREFIX.length).split('|');
    if (parts.length < 2) return null;
    try {
      return {
        title: decodeURIComponent(parts[0] || ''),
        url: decodeURIComponent(parts[1] || ''),
        slug: decodeURIComponent(parts[2] || '')
      };
    } catch (error) {
      return null;
    }
  }

  function openInvitedGame(invite) {
    if (!invite || !invite.url) return;
    if (typeof window.openLesson === 'function') {
      window.openLesson(invite.title || 'Game', invite.url);
      return;
    }
    if (invite.slug) location.hash = 'game=' + encodeURIComponent(invite.slug);
  }

  function makeInviteCard(invite, own) {
    var card = document.createElement('div');
    card.className = 'chat-invite-card';
    var icon = document.createElement('span');
    icon.className = 'chat-invite-card-icon';
    var glyph = document.createElement('i');
    glyph.className = 'fas fa-gamepad';
    glyph.setAttribute('aria-hidden', 'true');
    icon.appendChild(glyph);
    var copy = document.createElement('div');
    copy.className = 'chat-invite-card-copy';
    var title = document.createElement('strong');
    title.textContent = invite.title || 'Game';
    var hint = document.createElement('span');
    hint.textContent = own ? 'You invited them to play' : 'Invited you to play';
    copy.append(title, hint);
    var join = document.createElement('button');
    join.type = 'button';
    join.className = 'chat-invite-join';
    join.textContent = 'Join game';
    join.addEventListener('click', function () { openInvitedGame(invite); });
    card.append(icon, copy, join);
    return card;
  }

  function ensureInviteSocket() {
    return new Promise(function (resolve) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        inviteOwnSocket = false;
        resolve(true);
        return;
      }
      inviteOwnSocket = true;
      connect();
      var waited = 0;
      var timer = window.setInterval(function () {
        waited += 200;
        if (socket && socket.readyState === WebSocket.OPEN) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (waited >= 8000) {
          window.clearInterval(timer);
          resolve(false);
        }
      }, 200);
    });
  }

  function setInviteStatus(text) {
    var node = $('gameInviteStatus');
    if (node) node.textContent = text || '';
  }

  function buildInviteModal() {
    var existing = $('gameInviteModal');
    if (existing) return existing;
    var modal = document.createElement('div');
    modal.className = 'chat-invite-modal';
    modal.id = 'gameInviteModal';
    modal.hidden = true;
    modal.innerHTML = '<button type="button" class="chat-invite-backdrop" data-invite-close="1" aria-label="Close invites"></button>'
      + '<div class="chat-invite-panel" role="dialog" aria-modal="true" aria-labelledby="gameInviteTitle">'
      + '<div class="chat-invite-head"><strong id="gameInviteTitle">Invite friends</strong>'
      + '<button type="button" class="chat-invite-close" data-invite-close="1" aria-label="Close invites"><i class="fas fa-xmark" aria-hidden="true"></i></button></div>'
      + '<p class="chat-invite-sub" id="gameInviteSub"></p>'
      + '<div class="chat-invite-list" id="gameInviteList"></div>'
      + '<p class="chat-invite-status" id="gameInviteStatus" role="status"></p>'
      + '<div class="chat-invite-actions">'
      + '<button type="button" class="chat-invite-send" id="gameInviteSend">Send invite</button>'
      + '<button type="button" class="chat-invite-cancel" data-invite-close="1">Cancel</button>'
      + '</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) {
      var target = event.target instanceof Element ? event.target.closest('[data-invite-close]') : null;
      if (target) closeInviteModal();
    });
    var send = $('gameInviteSend');
    if (send) send.addEventListener('click', sendGameInvites);
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!modal || modal.hidden) return;
      closeInviteModal();
    });
    return modal;
  }

  function renderInviteFriends() {
    var list = $('gameInviteList');
    if (!list) return;
    list.replaceChildren();
    if (!friends.length) {
      var empty = document.createElement('p');
      empty.className = 'chat-invite-empty';
      empty.textContent = 'No friends yet. Add someone in the CHAT tab, then invite them here.';
      list.appendChild(empty);
      return;
    }
    var ordered = friends.slice().sort(function (a, b) {
      var onlineDiff = (isOnlineUser(b.id) ? 1 : 0) - (isOnlineUser(a.id) ? 1 : 0);
      if (onlineDiff) return onlineDiff;
      return displayName(a).localeCompare(displayName(b));
    });
    ordered.forEach(function (friend) {
      var online = isOnlineUser(friend.id);
      var row = document.createElement('label');
      row.className = 'chat-invite-person';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.value = String(friend.id);
      box.checked = online;
      var who = document.createElement('span');
      who.className = 'chat-invite-person-name';
      who.textContent = displayName(friend);
      var state = document.createElement('span');
      state.className = 'chat-invite-person-state';
      state.dataset.state = online ? 'online' : 'offline';
      state.textContent = online ? 'Online' : 'Offline';
      row.append(box, who, state);
      list.appendChild(row);
    });
  }

  function closeInviteModal() {
    var modal = $('gameInviteModal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('game-invite-open');
    inviteGame = null;
    if (inviteOwnSocket) {
      inviteOwnSocket = false;
      closeSocket('Disconnected');
    }
  }

  function openGameInvite(payload) {
    var user = currentUser();
    if (!user || isLocal(user)) {
      showAccountPrompt();
      return;
    }
    inviteGame = {
      title: String(payload && payload.title || 'Game').slice(0, 80),
      url: String(payload && payload.url || ''),
      slug: String(payload && payload.slug || '')
    };
    if (!inviteGame.url) return;
    var modal = buildInviteModal();
    var sub = $('gameInviteSub');
    if (sub) sub.textContent = 'Send ' + inviteGame.title + ' to your friends. They get a real invite in chat and join with one tap.';
    setInviteStatus('');
    renderInviteFriends();
    modal.hidden = false;
    document.body.classList.add('game-invite-open');
  }

  function sendGameInvites() {
    if (!inviteGame) return;
    var boxes = document.querySelectorAll('#gameInviteList .chat-invite-person input:checked');
    var ids = [];
    Array.prototype.forEach.call(boxes, function (box) { ids.push(String(box.value)); });
    if (!ids.length) {
      setInviteStatus('Pick at least one friend.');
      return;
    }
    var invite = inviteGame;
    var text = INVITE_PREFIX + [invite.title, invite.url, invite.slug].map(encodeURIComponent).join('|');
    setInviteStatus(ids.length === 1 ? 'Sending invite…' : 'Sending ' + ids.length + ' invites…');
    ensureInviteSocket().then(function (ready) {
      if (!ready) {
        setInviteStatus('Chat could not connect. Open the CHAT tab, sign in, then try again.');
        return;
      }
      // The room rate-limits direct messages, so invites go out one at a time.
      var index = 0;
      var sent = 0;
      var step = function () {
        if (index >= ids.length) {
          if (!sent) {
            setInviteStatus('The invite could not be sent. Try again.');
            return;
          }
          setInviteStatus('Invite sent to ' + sent + (sent === 1 ? ' friend.' : ' friends.'));
          window.setTimeout(closeInviteModal, 900);
          return;
        }
        var id = ids[index];
        index += 1;
        var clientId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'invite_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        try {
          socket.send(JSON.stringify({ type: 'dm', to: id, text: text, clientId: clientId, replyTo: '' }));
          sent += 1;
        } catch (error) {}
        setInviteStatus('Sending ' + index + ' of ' + ids.length + '…');
        window.setTimeout(step, 800);
      };
      step();
    });
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
    var key = String(user.id || '') + '|' + String(user.avatar || '') + '|' + String(user.bio || '');
    if (!force && lastProfileKey === key) return;
    lastProfileKey = key;
    makeChatAvatar(user.avatar).then(function (avatar) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: 'profile', avatar: avatar, bio: user.bio || '' }));
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
      mergeNotifications(data.notifications);
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
      refreshSiteOwner();
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
          mergeNotifications(data.notifications);
        } else if (data.type === 'notification') {
          addNotification(data.notification);
        } else if (data.type === 'notifications-read') {
          notifications = notifications.map(function (notification) {
            return Object.assign({}, notification, { read: true });
          });
          renderNotifications();
        } else if (data.type === 'message') {
          addMessage(data.message, true);
        } else if (data.type === 'message-deleted') {
          removeRoomMessage(data.messageId);
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
        } else if (data.type === 'dm-message-deleted') {
          if (String(data.peerId || '') === String(dmPeerId)) removeDmMessage(data.messageId);
        } else if (data.type === 'dm-history') {
          mergeDmHistory(data.friendId, data.messages);
        } else if (data.type === 'dm-error') {
          handleDmError(data);
        } else if (data.type === 'purge-user') {
          removeUserContent(data.userId);
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

  var EMOJIS = [
    '\uD83D\uDE00', '\uD83D\uDE01', '\uD83D\uDE02', '\uD83E\uDD23', '\uD83D\uDE0A', '\uD83D\uDE0D', '\uD83D\uDE18', '\uD83D\uDE0E',
    '\uD83D\uDE1C', '\uD83E\uDD2A', '\uD83E\uDD17', '\uD83E\uDD14', '\uD83D\uDE34', '\uD83D\uDE25', '\uD83D\uDE22', '\uD83D\uDE21',
    '\uD83D\uDE2D', '\uD83D\uDE30', '\uD83D\uDE05', '\uD83D\uDE07', '\uD83D\uDE10', '\uD83D\uDC4D', '\uD83D\uDC4E', '\uD83D\uDC4F',
    '\uD83D\uDE4C', '\uD83D\uDE4F', '\uD83D\uDCAA', '\uD83D\uDD25', '\u2728', '\uD83D\uDCAF', '\u2764\uFE0F', '\uD83D\uDC9A',
    '\uD83D\uDC99', '\uD83D\uDC9C', '\u2B50', '\uD83C\uDF89', '\uD83C\uDFAE', '\uD83C\uDFC6', '\u26A1', '\uD83D\uDC80',
    '\uD83D\uDC40', '\uD83C\uDF55', '\u2615', '\uD83C\uDFB5', '\uD83C\uDFB8', '\uD83C\uDFC0', '\uD83D\uDE80', '\uD83C\uDF08'
  ];

  function insertAtCaret(input, text) {
    if (!input || input.disabled) return;
    var start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
    var next = input.value.slice(0, start) + text + input.value.slice(end);
    if (next.length > 500) next = next.slice(0, 500);
    input.value = next;
    var caret = Math.min(next.length, start + text.length);
    try { input.setSelectionRange(caret, caret); } catch (error) {}
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function setupEmojiPicker(buttonId, panelId, inputId) {
    var button = $(buttonId);
    var panel = $(panelId);
    var input = $(inputId);
    if (!button || !panel || !input) return;

    if (!panel.childElementCount) {
      var grid = document.createElement('div');
      grid.className = 'chat-emoji-grid';
      EMOJIS.forEach(function (emoji) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'chat-emoji-item';
        item.textContent = emoji;
        item.setAttribute('aria-label', 'Insert ' + emoji);
        item.addEventListener('click', function () {
          insertAtCaret(input, emoji);
          close();
          if (!input.disabled) input.focus();
        });
        grid.appendChild(item);
      });
      panel.appendChild(grid);
    }

    function close() {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }

    function open() {
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    }

    button.addEventListener('click', function (event) {
      event.stopPropagation();
      if (panel.hidden) open(); else close();
    });
    panel.addEventListener('click', function (event) { event.stopPropagation(); });
    document.addEventListener('click', function () { if (!panel.hidden) close(); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) {
        close();
        if (!input.disabled) input.focus();
      }
    });
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
    var replyTo = roomReply ? roomReply.id : '';
    var clientId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    addPending(text, clientId);
    try {
      socket.send(JSON.stringify({ type: 'message', text: text, clientId: clientId, replyTo: replyTo }));
    } catch (error) {
      removePending(clientId);
      showNotice('Could not send that message. Try again.');
      return;
    }
    input.value = '';
    input.style.height = '';
    updateCharCount();
    clearRoomReply();
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

    setupEmojiPicker('chatEmoji', 'chatEmojiPanel', 'chatInput');
    setupEmojiPicker('chatDmEmoji', 'chatDmEmojiPanel', 'chatDmInput');

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

    var notificationButton = $('notificationButton');
    if (notificationButton) {
      notificationButton.addEventListener('click', function (event) {
        event.stopPropagation();
        setNotificationsOpen(!notificationsOpen);
      });
    }
    var notificationMarkRead = $('notificationMarkRead');
    if (notificationMarkRead) {
      notificationMarkRead.addEventListener('click', function (event) {
        event.stopPropagation();
        markAllNotificationsRead();
      });
    }
    document.querySelectorAll('[data-chat-profile-close]').forEach(function (element) {
      element.addEventListener('click', closeChatProfile);
    });
    if ($('chatProfileEdit')) $('chatProfileEdit').addEventListener('click', editOwnProfile);
    if ($('chatProfilePay')) {
      $('chatProfilePay').addEventListener('click', function () {
        var name = profileUserName;
        var id = profileUserId;
        closeChatProfile();
        if (name && typeof window.openPayModal === 'function') {
          window.openPayModal({ user: { id: id, name: name } });
        }
      });
    }
    document.addEventListener('click', function (event) {
      var profileLink = event.target && event.target.closest ? event.target.closest('[data-profile-user]') : null;
      if (profileLink && !profileLink.closest('.notification-item') && !profileLink.closest('#chatProfileModal')) {
        var profile = profileForUser(profileLink.getAttribute('data-profile-user'));
        if (profile) {
          event.preventDefault();
          openChatProfile(profile);
          return;
        }
      }
      var adminDelete = event.target && event.target.closest ? event.target.closest('[data-admin-delete]') : null;
      if (adminDelete) {
        event.preventDefault();
        deleteAdminMessageFromButton(adminDelete);
        return;
      }
      if (!notificationsOpen) return;
      if (event.target && event.target.closest && event.target.closest('.notification-nav')) return;
      setNotificationsOpen(false);
    });
    if ($('chatReplyCancel')) $('chatReplyCancel').addEventListener('click', clearRoomReply);
    if ($('chatDmReplyCancel')) $('chatDmReplyCancel').addEventListener('click', clearDmReply);

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
      if ((event.key === 'Enter' || event.key === ' ') && event.target && event.target.classList && event.target.classList.contains('chat-profile-link')) {
        var linkProfile = profileForUser(event.target.getAttribute('data-profile-user'));
        if (linkProfile) {
          event.preventDefault();
          openChatProfile(linkProfile);
          return;
        }
      }
      if (event.key !== 'Escape') return;
      var profileModal = $('chatProfileModal');
      if (profileModal && !profileModal.hidden) {
        closeChatProfile();
      } else if (notificationsOpen) {
        setNotificationsOpen(false);
      } else if (roomReply) {
        clearRoomReply();
      } else if (dmReply) {
        clearDmReply();
      } else if (socialOpen) {
        closeSocial();
      } else if (dmPeerId) {
        closeDm();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      syncNotifications();
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      syncHistory();
      syncDmHistory();
    });
  }

  function positionNotificationNav(tab) {
    var nav = $('notificationNav');
    if (!nav) return;
    if (tab === 'chat') {
      var chatActions = document.querySelector('.chat-page-actions');
      var chatAccount = document.querySelector('.chat-head-account');
      if (chatActions && chatAccount && nav.parentNode !== chatActions) {
        chatActions.insertBefore(nav, chatAccount);
      }
      return;
    }
    var actions = document.querySelector('.top-nav-actions');
    var account = $('accountTab');
    if (actions && account && nav.parentNode !== actions) actions.insertBefore(nav, account);
  }

  function handleSwitch(event) {
    var tab = event.detail && event.detail.tab;
    document.body.classList.toggle('chat-active', tab === 'chat');
    positionNotificationNav(tab);
    if (tab && tab !== 'chat') {
      closeChatProfile();
      closeSocial();
      closeDm();
      closeSocket('Disconnected');
    }
  }

  function handleAccountChange() {
    var user = currentUser();
    if (!user) {
      closeChatProfile();
      notifications = [];
      siteOwner = false;
      applyAdminDeleteControls();
      setNotificationsOpen(false);
      renderNotifications();
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
    renderNotifications();
    refreshSiteOwner();
    registerChatProfile();
    syncNotifications();
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
    window.openGameInvite = openGameInvite;
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
    positionNotificationNav(document.body.classList.contains('chat-active') ? 'chat' : '');
    renderNotifications();
    refreshSiteOwner();
    registerChatProfile();
    syncNotifications();
    notificationTimer = window.setInterval(function () {
      if (!document.hidden) syncNotifications();
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
