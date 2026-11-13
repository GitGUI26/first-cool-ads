(function () {
  'use strict';

  var Store = window.CoolAccountStore;
  if (!Store) return;

  var $ = function (id) { return document.getElementById(id); };
  var modal = $('accountModal');
  var authView = $('accountAuthView');
  var dashboard = $('accountDashboard');
  var accountTab = $('accountTab');
  var toast = $('accountToast');
  var DEFAULT_AVATAR = 'images/default-avatar.svg';
  var toastTimer = 0;
  var prefTimer = 0;
  var initialized = false;
  var activeAuthMode = 'signin';
  var ownerState = { userId: '', status: 'idle', isOwner: false, loading: false, accounts: [] };

  function isLocalUser(user) {
    return !!user && String(user.id || '').indexOf('local-') === 0;
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = !!hidden;
    element.style.display = hidden ? 'none' : '';
  }

  function showMessage(id, message, success) {
    var element = $(id);
    if (!element) return;
    element.textContent = message || '';
    element.hidden = !message;
    element.classList.toggle('is-success', !!success);
  }

  function showError(id, message) {
    showMessage(id, message, false);
  }

  function showSuccess(id, message) {
    showMessage(id, message, true);
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
      window.setTimeout(function () { toast.hidden = true; }, 220);
    }, 3200);
  }

  function setBusy(form, busy, busyLabel) {
    if (!form) return;
    var button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (!button.dataset.label) button.dataset.label = button.innerHTML;
    button.disabled = busy;
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    button.innerHTML = busy ? (busyLabel || 'Working…') : button.dataset.label;
  }

  function currentUser() {
    return Store.getCurrentUser();
  }

  function setAuthMode(mode) {
    activeAuthMode = mode === 'signup' ? 'signup' : 'signin';
    document.querySelectorAll('[data-auth-mode]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-auth-mode') === activeAuthMode);
    });
    setHidden($('accountAuthTabs'), false);
    setHidden($('signinForm'), activeAuthMode !== 'signin');
    setHidden($('signupForm'), activeAuthMode !== 'signup');

    var configured = Store.isCloudConfigured ? Store.isCloudConfigured() : false;
    var lede = $('accountLede');
    if (lede) {
      lede.hidden = false;
      lede.textContent = configured
        ? (activeAuthMode === 'signup'
          ? 'Choose a unique username and password. Your username is also your login.'
          : 'Sign in with your username and password.')
        : 'Online accounts are not configured yet.';
    }
    var title = $('accountModalTitle');
    if (title) title.textContent = 'Sign in or create an account';

    showError('signinError', '');
    showError('signupError', '');
    showSuccess('signupSuccess', '');
  }

  function safeHistoryLink(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    try {
      var parsed = new URL(raw, window.location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (error) {
      return '';
    }
  }

  function typeLabel(type) {
    return ({
      web: 'Browser',
      app: 'App',
      game: 'Game',
      site: 'Website'
    })[type] || 'History';
  }

  function formatDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function item(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function avatarSource(user) {
    return user && user.avatar ? user.avatar : DEFAULT_AVATAR;
  }

  function setAvatarImages(user) {
    var src = avatarSource(user);
    ['accountNavAvatar', 'accountHeadAvatar', 'accountAvatarImage', 'accountAvatarPreviewImage'].forEach(function (id) {
      var image = $(id);
      if (image && image.getAttribute('src') !== src) image.src = src;
    });
    var reset = $('avatarReset');
    if (reset) reset.disabled = !(user && user.avatar);
  }

  function renderNav() {
    var user = currentUser();
    setAvatarImages(user);
    if (accountTab) {
      accountTab.classList.toggle('has-account', !!user);
      accountTab.setAttribute('aria-label', user ? 'Open account settings for ' + user.username : 'Open account settings');
      accountTab.title = user ? '@' + user.username + ' · account settings' : 'Account settings';
    }
  }

  function renderAppCards() {
    var user = currentUser();
    document.querySelectorAll('[data-app-card]').forEach(function (card) {
      var id = card.getAttribute('data-app-card');
      var app = user && user.apps ? user.apps[id] : null;
      var status = card.querySelector('[data-app-status]');
      var handle = card.querySelector('[data-app-handle]');
      var linked = !!(app && app.handle);
      card.classList.toggle('is-linked', linked);
      if (status) status.textContent = linked ? 'Linked' : 'Not linked';
      if (handle) {
        handle.textContent = linked ? app.handle : '';
        handle.hidden = !linked;
      }
    });
  }

  function renderHistory(user) {
    var list = $('historyList');
    if (!list) return;
    list.replaceChildren();
    var history = user && Array.isArray(user.history) ? user.history : [];
    if (!history.length) {
      list.appendChild(item('p', 'account-empty', 'No history yet. Games, websites, and apps you open will appear here.'));
      return;
    }
    history.slice(0, 40).forEach(function (entry) {
      var row = item('div', 'account-history-row');
      var meta = item('div', 'account-history-meta');
      meta.appendChild(item('span', 'account-history-type', typeLabel(entry.type)));
      meta.appendChild(item('span', 'account-history-date', formatDate(entry.at)));
      row.appendChild(meta);
      var href = safeHistoryLink(entry.url);
      var title = href ? document.createElement('a') : item('strong');
      title.className = 'account-history-title';
      title.textContent = entry.title || entry.url || 'Untitled';
      if (href) {
        title.href = href;
        title.target = '_blank';
        title.rel = 'noopener noreferrer';
      }
      row.appendChild(title);
      if (entry.url && entry.url !== entry.title) {
        row.appendChild(item('span', 'account-history-url', entry.url));
      }
      list.appendChild(row);
    });
    if (history.length > 40) {
      list.appendChild(item('p', 'account-empty', 'Showing the 40 most recent items.'));
    }
  }

  function renderWebsites(user) {
    var list = $('websiteList');
    if (!list) return;
    list.replaceChildren();
    var websites = user && Array.isArray(user.websites) ? user.websites : [];
    if (!websites.length) {
      list.appendChild(item('p', 'account-empty', 'No website accounts saved yet. Add a site above.'));
      return;
    }
    websites.forEach(function (entry) {
      var row = item('div', 'account-site-row');
      var copy = item('div', 'account-site-copy');
      copy.appendChild(item('strong', '', entry.name));
      if (entry.username) copy.appendChild(item('span', '', entry.username));
      if (entry.note) copy.appendChild(item('small', '', entry.note));
      row.appendChild(copy);
      var actions = item('div', 'account-site-actions');
      var href = safeHistoryLink(entry.url);
      if (href) {
        var link = item('a', 'account-mini-link', 'Open');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        actions.appendChild(link);
      }
      var remove = item('button', 'account-mini-link account-remove', 'Remove');
      remove.type = 'button';
      remove.setAttribute('data-remove-website', entry.id);
      actions.appendChild(remove);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function preferenceSummary(user) {
    var prefs = user && user.preferences ? user.preferences : {};
    var theme = prefs.selectedTheme || 'default';
    var background = prefs.selectedBackground || 'matrix';
    var cursor = prefs.cursorStyle || 'ring';
    return 'Theme: ' + theme + ' · Background: ' + background + ' · Cursor: ' + cursor +
      ' · Tab title, favicon, logo, and favorites are included.';
  }

  function renderSyncStatus() {
    var user = currentUser();
    var local = isLocalUser(user);
    var configured = Store.isCloudConfigured ? Store.isCloudConfigured() : false;
    var synced = Store.cloudSyncEnabled ? Store.cloudSyncEnabled() : false;
    var pill = $('accountSyncPill');
    var message = $('accountSyncMessage');
    var syncButton = $('accountSyncNow');
    if (pill) {
      pill.className = 'account-sync-pill ' + (local || !configured ? 'is-local' : synced ? 'is-synced' : 'is-online');
      pill.textContent = local ? 'Local only' : configured ? (synced ? 'Synced' : 'Online account') : 'Local only';
    }
    if (message) {
      message.className = 'account-sync-message';
      if (local) {
        message.textContent = 'This browser-only account is no longer supported. Sign out and create a username account to sync and use chat.';
      } else {
        message.textContent = configured
          ? (synced
            ? 'Your profile is stored online and follows your account to a new domain.'
            : 'Your online account is ready. Sync now to upload the latest profile.')
          : 'This account is saved in this browser only. Cloud sync has not been turned on yet.';
      }
    }
    if (syncButton) syncButton.disabled = local || !configured;
  }

  function renderDashboard(user) {
    if (!user) return;
    var configured = Store.isCloudConfigured ? Store.isCloudConfigured() : false;
    var local = isLocalUser(user);
    setAvatarImages(user);
    var bioInput = $('accountBio');
    if (bioInput && document.activeElement !== bioInput) bioInput.value = user.bio || '';
    updateBioCount();
    var usernameInput = $('accountUsernameInput');
    if (usernameInput && document.activeElement !== usernameInput) {
      usernameInput.value = user.username;
    }
    $('accountUsername').textContent = '@' + user.username;
    $('accountJoined').textContent = 'Member since ' + formatDate(user.createdAt) +
      (local || !configured ? ' · saved in this browser' : ' · online account');
    renderSyncStatus();
    $('accountHistoryCount').textContent = String((user.history || []).length);
    $('accountAccountCount').textContent = String((user.websites || []).length +
      Object.keys(user.apps || {}).filter(function (id) { return user.apps[id] && user.apps[id].handle; }).length);
    $('preferencesSummary').textContent = preferenceSummary(user);
    Store.appIds.forEach(function (id) {
      var app = (user.apps && user.apps[id]) || {};
      var handleField = document.querySelector('[data-app-field="' + id + '"]');
      var urlField = document.querySelector('[data-app-url="' + id + '"]');
      if (handleField) handleField.value = app.handle || '';
      if (urlField) urlField.value = app.url || '';
    });
    renderHistory(user);
    renderWebsites(user);
    renderAppCards();
    renderNav();
    refreshOwnerTools(false);
  }

  function renderOwnerTools() {
    var card = $('accountOwnerCard');
    var user = currentUser();
    var canShow = !!user && !isLocalUser(user) && ownerState.isOwner;
    setHidden(card, !canShow);
    var help = $('accountUsernameHelp');
    if (help) {
      help.textContent = ownerState.isOwner
        ? 'Owner account: you can change your username as often as you like.'
        : 'Regular accounts can change their username once every 7 days.';
    }
    if (!canShow) return;
    var list = $('accountOwnerList');
    if (!list) return;
    list.textContent = '';
    if (ownerState.loading) {
      list.appendChild(item('p', 'account-owner-empty', 'Loading accounts…'));
      return;
    }
    if (!ownerState.accounts.length) {
      list.appendChild(item('p', 'account-owner-empty', 'No accounts found.'));
      return;
    }
    ownerState.accounts.forEach(function (account) {
      var row = item('div', 'account-owner-row');
      var details = item('div', 'account-owner-details');
      details.appendChild(item('b', '', '@' + account.username));
      var meta = account.isAdmin ? 'Owner' : (account.lastSignInAt ? 'Last seen ' + formatDate(account.lastSignInAt) : 'Has not signed in yet');
      details.appendChild(item('span', '', meta));
      row.appendChild(details);
      if (String(account.id) === String(user.id)) {
        row.appendChild(item('span', 'account-owner-you', 'You'));
      } else {
        var admin = item('button', 'account-secondary account-owner-button', account.isAdmin ? 'Remove admin' : 'Make admin');
        admin.type = 'button';
        admin.setAttribute('data-owner-admin', account.id);
        admin.setAttribute('data-owner-admin-value', account.isAdmin ? '0' : '1');
        admin.setAttribute('data-owner-name', account.username);
        var rename = item('button', 'account-secondary account-owner-button', 'Rename');
        rename.type = 'button';
        rename.setAttribute('data-owner-rename', account.id);
        rename.setAttribute('data-owner-name', account.username);
        var remove = item('button', 'account-danger account-owner-button', 'Delete');
        remove.type = 'button';
        remove.setAttribute('data-owner-delete', account.id);
        remove.setAttribute('data-owner-name', account.username);
        row.appendChild(admin);
        row.appendChild(rename);
        row.appendChild(remove);
      }
      list.appendChild(row);
    });
  }

  async function refreshOwnerAccounts() {
    var user = currentUser();
    if (!user || isLocalUser(user) || !ownerState.isOwner) return;
    ownerState.loading = true;
    renderOwnerTools();
    var result = await Store.adminListAccounts();
    ownerState.loading = false;
    if (!result.ok) {
      ownerState.accounts = [];
      showError('accountOwnerMessage', result.error);
      renderOwnerTools();
      return;
    }
    ownerState.accounts = result.accounts;
    showSuccess('accountOwnerMessage', result.accounts.length + ' account' + (result.accounts.length === 1 ? '' : 's') + ' loaded.');
    renderOwnerTools();
  }

  async function refreshOwnerTools(force) {
    var user = currentUser();
    if (!user || isLocalUser(user)) {
      ownerState = { userId: '', status: 'idle', isOwner: false, loading: false, accounts: [] };
      renderOwnerTools();
      return;
    }
    if (!force && ownerState.userId === user.id && ownerState.status !== 'idle' && ownerState.status !== 'error') {
      renderOwnerTools();
      return;
    }
    ownerState.userId = user.id;
    ownerState.status = 'loading';
    ownerState.isOwner = false;
    ownerState.accounts = [];
    renderOwnerTools();
    var status = await Store.adminStatus();
    if (!currentUser() || currentUser().id !== user.id) return;
    ownerState.status = status.ok ? 'ready' : 'error';
    ownerState.isOwner = !!(status.ok && status.owner);
    renderOwnerTools();
    if (ownerState.isOwner) refreshOwnerAccounts();
  }

  async function renameOwnerAccount(id, currentName) {
    var next = window.prompt('New username for @' + currentName + ':', currentName);
    if (next === null) return;
    var result = await Store.adminChangeUsername(id, next);
    if (!result.ok) {
      showError('accountOwnerMessage', result.error);
      return;
    }
    showSuccess('accountOwnerMessage', 'Renamed to @' + result.username + '.');
    refreshOwnerAccounts();
    render();
  }

  async function setOwnerAdmin(id, username, makeAdmin) {
    if (!makeAdmin) {
      var confirmed = window.confirm('Remove owner access from @' + username + '?');
      if (!confirmed) return;
    }
    var result = await Store.adminSetAdmin(id, makeAdmin);
    if (!result.ok) {
      showError('accountOwnerMessage', result.error);
      return;
    }
    showSuccess('accountOwnerMessage', makeAdmin
      ? '@' + username + ' can now use Owner tools.'
      : '@' + username + ' no longer has owner access.');
    refreshOwnerAccounts();
  }

  async function deleteOwnerAccount(id, username) {
    var confirmed = window.confirm('Permanently delete @' + username + ' and remove their chat data? This cannot be undone.');
    if (!confirmed) return;
    var result = await Store.adminDeleteAccount(id);
    if (!result.ok) {
      showError('accountOwnerMessage', result.error);
      return;
    }
    showSuccess('accountOwnerMessage', 'Account @' + username + ' deleted.');
    refreshOwnerAccounts();
  }

  async function submitUsernameChange() {
    var form = $('accountUsernameForm');
    var input = $('accountUsernameInput');
    if (!form || !input) return;
    showError('accountUsernameError', '');
    setBusy(form, true, 'Changing…');
    var result = await Store.setUsername(input.value);
    setBusy(form, false);
    if (!result.ok) {
      showError('accountUsernameError', result.error);
      return;
    }
    input.value = result.username;
    showSuccess('accountUsernameError', 'Username changed to @' + result.username + '.');
    renderDashboard(currentUser());
    refreshOwnerTools(true);
    showToast('Username changed to @' + result.username + '.');
  }

  function render() {
    var user = currentUser();
    renderNav();
    renderAppCards();
    setHidden(authView, !!user);
    setHidden(dashboard, !user);
    if (user) {
      renderDashboard(user);
      $('accountModalTitle').textContent = 'Account settings';
    } else {
      setAuthMode(activeAuthMode || 'signin');
      $('accountModalTitle').textContent = 'Sign in or create an account';
    }
  }

  function openAccount() {
    if (!modal) return;
    ensureInitialized();
    render();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.classList.add('account-open');
    document.body.style.overflow = 'hidden';
    window.setTimeout(function () {
      var first;
      if (currentUser()) first = $('accountSyncNow');
      else if (activeAuthMode === 'signup') first = $('signupUsername');
      else first = $('signinUsername');
      if (first) first.focus();
    }, 30);
  }

  function closeAccount() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('account-open');
    document.body.style.overflow = '';
    window.setTimeout(function () { modal.hidden = true; }, 180);
    if (accountTab) accountTab.focus();
  }

  async function submitSignup(event) {
    event.preventDefault();
    var form = $('signupForm');
    var username = $('signupUsername').value;
    var password = $('signupPassword').value;
    showError('signupError', '');
    showSuccess('signupSuccess', '');
    if (password.length < 6) {
      showError('signupError', 'Use a password with at least 6 characters.');
      $('signupPassword').focus();
      return;
    }
    Store.saveGuestPreferences();
    setBusy(form, true, 'Creating…');
    var result = await Store.createAccount({ username: username, password: password });
    setBusy(form, false);
    if (!result.ok) {
      showError('signupError', result.error);
      return;
    }
    Store.capturePreferences();
    $('signupForm').reset();
    activeAuthMode = 'signin';
    render();
    showToast('Account created. Your username is your login.');
  }

  async function submitSignin(event) {
    event.preventDefault();
    var form = $('signinForm');
    showError('signinError', '');
    Store.saveGuestPreferences();
    setBusy(form, true, 'Signing in…');
    var result = await Store.signIn($('signinUsername').value, $('signinPassword').value);
    setBusy(form, false);
    if (!result.ok) {
      showError('signinError', result.error);
      return;
    }
    Store.applyPreferences(result.user.preferences);
    $('signinForm').reset();
    render();
    showToast('Signed in. Your history and preferences are loaded.');
    window.setTimeout(function () { window.location.reload(); }, 350);
  }

  function saveApps() {
    var apps = {};
    Store.appIds.forEach(function (id) {
      apps[id] = {
        handle: (document.querySelector('[data-app-field="' + id + '"]') || {}).value || '',
        url: (document.querySelector('[data-app-url="' + id + '"]') || {}).value || ''
      };
    });
    var result = Store.setApps(apps);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    renderAppCards();
    showToast('App accounts saved.');
  }

  function addWebsite(event) {
    event.preventDefault();
    showError('websiteError', '');
    var result = Store.addWebsite({
      name: $('websiteName').value,
      username: $('websiteUsername').value,
      url: $('websiteUrl').value,
      note: $('websiteNote').value
    });
    if (!result.ok) {
      showError('websiteError', result.error);
      return;
    }
    $('websiteForm').reset();
    var user = currentUser();
    if (user) {
      renderWebsites(user);
      renderDashboard(user);
    }
    showToast('Website account saved.');
  }

  function removeWebsite(id) {
    if (!id) return;
    if (!Store.removeWebsite(id)) {
      showToast('Could not remove that website record.');
      return;
    }
    var user = currentUser();
    if (user) renderDashboard(user);
    showToast('Website account removed.');
  }

  function clearHistory() {
    var user = currentUser();
    if (!user || !(user.history || []).length) return;
    if (!window.confirm('Clear the history saved to this account?')) return;
    Store.clearHistory();
    renderDashboard(currentUser());
    showToast('History cleared.');
  }

  function savePreferencesNow() {
    if (!currentUser()) return;
    var saved = Store.capturePreferences();
    if (saved) {
      var user = currentUser();
      if (user) {
        var summary = $('preferencesSummary');
        if (summary) summary.textContent = preferenceSummary(user);
      }
      showToast('Current preferences saved to your account.');
    } else {
      showToast('Could not save preferences. Browser storage may be full.');
    }
  }

  function queuePreferenceSave() {
    if (!currentUser()) return;
    clearTimeout(prefTimer);
    prefTimer = window.setTimeout(function () {
      Store.capturePreferences();
    }, 300);
  }

  function hookLessonHistory() {
    if (window.__cuhLessonHistoryHooked || typeof window.openLesson !== 'function') return;
    var original = window.openLesson;
    window.openLesson = function (title, url) {
      Store.addHistory({ type: 'game', title: title, url: url });
      return original.apply(this, arguments);
    };
    window.__cuhLessonHistoryHooked = true;
  }

  function loadAvatarImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that image.')); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error('Could not open that image.')); };
        image.onload = function () { resolve(image); };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function makeSquareAvatar(file) {
    return loadAvatarImage(file).then(function (image) {
      var size = 256;
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare that image.');
      context.fillStyle = '#0b1020';
      context.fillRect(0, 0, size, size);
      var scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
      var width = Math.round(image.naturalWidth * scale);
      var height = Math.round(image.naturalHeight * scale);
      context.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
      var data = canvas.toDataURL('image/webp', 0.86);
      if (data.indexOf('data:image/webp') !== 0) data = canvas.toDataURL('image/jpeg', 0.86);
      return data;
    });
  }

  async function handleAvatarUpload(event) {
    var input = event.target;
    var file = input.files && input.files[0];
    input.value = '';
    showError('avatarError', '');
    if (!file) return;
    if (!/^image\/(?:png|jpe?g|webp)$/i.test(file.type)) {
      showError('avatarError', 'Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showError('avatarError', 'That image is too large. Choose one under 8 MB.');
      return;
    }
    if (!currentUser()) {
      showError('avatarError', 'Sign in first.');
      return;
    }
    var reset = $('avatarReset');
    if (reset) reset.disabled = true;
    showToast('Updating profile picture…');
    try {
      var data = await makeSquareAvatar(file);
      var result = Store.setAvatar(data);
      if (!result.ok) {
        showError('avatarError', result.error);
        return;
      }
      renderDashboard(currentUser());
      showToast('Profile picture updated.');
    } catch (error) {
      showError('avatarError', 'Could not read that image. Try a different file.');
    } finally {
      var user = currentUser();
      if (reset) reset.disabled = !(user && user.avatar);
    }
  }

  function resetAvatar() {
    showError('avatarError', '');
    var result = Store.setAvatar('');
    if (!result.ok) {
      showError('avatarError', result.error);
      return;
    }
    renderDashboard(currentUser());
    showToast('Default profile picture restored.');
  }

  function updateBioCount() {
    var input = $('accountBio');
    var count = $('accountBioCount');
    if (input && count) count.textContent = String(input.value.length) + ' / 160';
  }

  function saveBio(event) {
    event.preventDefault();
    var input = $('accountBio');
    var button = event.submitter || (event.target && event.target.querySelector('button[type="submit"]'));
    if (!input) return;
    showError('accountBioError', '');
    if (button) button.disabled = true;
    var result = Store.setBio(input.value);
    if (button) button.disabled = false;
    if (!result.ok) {
      showError('accountBioError', result.error);
      return;
    }
    input.value = result.bio;
    updateBioCount();
    renderDashboard(currentUser());
    showToast('Bio updated.');
  }

  async function syncAccount() {
    var button = $('accountSyncNow');
    if (!button) return;
    var label = button.textContent;
    button.disabled = true;
    button.textContent = 'Syncing…';
    var result = await Store.syncNow();
    button.textContent = label;
    renderSyncStatus();
    showToast(result.ok ? 'Account synced.' : result.error);
  }

  async function deleteCurrentAccount() {
    var user = currentUser();
    if (!user) return;
    var confirmed = window.confirm('Permanently delete @' + user.username + '? This removes your login, profile, chat messages, history, saved sites, app handles, preferences, and game progress. This cannot be undone.');
    if (!confirmed) return;
    var button = $('accountDelete');
    var label = button ? button.textContent : '';
    showError('accountDeleteError', '');
    if (button) {
      button.disabled = true;
      button.textContent = 'Deleting…';
    }
    var result = await Store.deleteAccount();
    if (!result.ok) {
      if (button) {
        button.disabled = false;
        button.textContent = label;
      }
      showError('accountDeleteError', result.error);
      return;
    }
    showToast('Account deleted. Signed out.');
    window.setTimeout(function () { window.location.reload(); }, 500);
  }

  function bindEvents() {
    document.querySelectorAll('[data-account-close]').forEach(function (element) {
      element.addEventListener('click', closeAccount);
    });
    document.querySelectorAll('[data-auth-mode]').forEach(function (button) {
      button.addEventListener('click', function () { setAuthMode(button.getAttribute('data-auth-mode')); });
    });
    if ($('signupForm')) $('signupForm').addEventListener('submit', submitSignup);
    if ($('signinForm')) $('signinForm').addEventListener('submit', submitSignin);
    if ($('accountSignOut')) {
      $('accountSignOut').addEventListener('click', function () {
        Store.signOut();
        activeAuthMode = 'signin';
        render();
        showToast('Signed out. Guest preferences restored.');
        window.setTimeout(function () { window.location.reload(); }, 350);
      });
    }
    if ($('accountDelete')) $('accountDelete').addEventListener('click', deleteCurrentAccount);
    if ($('saveAppAccounts')) $('saveAppAccounts').addEventListener('click', saveApps);
    if ($('websiteForm')) $('websiteForm').addEventListener('submit', addWebsite);
    if ($('clearHistory')) $('clearHistory').addEventListener('click', clearHistory);
    if ($('savePreferences')) $('savePreferences').addEventListener('click', savePreferencesNow);
    if ($('avatarUpload')) $('avatarUpload').addEventListener('change', handleAvatarUpload);
    if ($('avatarReset')) $('avatarReset').addEventListener('click', resetAvatar);
    if ($('accountBioForm')) $('accountBioForm').addEventListener('submit', saveBio);
    if ($('accountBio')) $('accountBio').addEventListener('input', updateBioCount);
    if ($('accountSyncNow')) $('accountSyncNow').addEventListener('click', syncAccount);
    if ($('accountUsernameForm')) {
      $('accountUsernameForm').addEventListener('submit', function (event) {
        event.preventDefault();
        submitUsernameChange();
      });
    }
    if ($('accountOwnerRefresh')) $('accountOwnerRefresh').addEventListener('click', refreshOwnerAccounts);
    if ($('accountOwnerList')) {
      $('accountOwnerList').addEventListener('click', function (event) {
        var rename = event.target.closest('[data-owner-rename]');
        if (rename) {
          renameOwnerAccount(rename.getAttribute('data-owner-rename'), rename.getAttribute('data-owner-name'));
          return;
        }
        var admin = event.target.closest('[data-owner-admin]');
        if (admin) {
          setOwnerAdmin(admin.getAttribute('data-owner-admin'), admin.getAttribute('data-owner-name'), admin.getAttribute('data-owner-admin-value') === '1');
          return;
        }
        var remove = event.target.closest('[data-owner-delete]');
        if (remove) deleteOwnerAccount(remove.getAttribute('data-owner-delete'), remove.getAttribute('data-owner-name'));
      });
    }
    if ($('websiteList')) {
      $('websiteList').addEventListener('click', function (event) {
        var button = event.target.closest('[data-remove-website]');
        if (button) removeWebsite(button.getAttribute('data-remove-website'));
      });
    }
    document.addEventListener('click', function (event) {
      var appOpen = event.target.closest('[data-app-open]');
      if (appOpen) {
        var appCard = appOpen.closest('[data-app-card]');
        Store.addHistory({
          type: 'app',
          title: appCard ? appCard.querySelector('h3').textContent : 'App',
          url: appOpen.href
        });
      }
      var linkApp = event.target.closest('[data-link-app]');
      if (linkApp) {
        event.preventDefault();
        openAccount();
        var id = linkApp.getAttribute('data-link-app');
        window.setTimeout(function () {
          var field = document.querySelector('[data-app-field="' + id + '"]');
          if (field) {
            field.focus();
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal && !modal.hidden) closeAccount();
    });
    document.addEventListener('change', queuePreferenceSave, true);
    document.addEventListener('click', queuePreferenceSave, true);
    window.addEventListener('beforeunload', function () {
      if (currentUser()) Store.capturePreferences();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && currentUser()) Store.capturePreferences();
    });
    window.addEventListener('cuh-account-change', function (event) {
      renderNav();
      renderAppCards();
      if (modal && !modal.hidden) renderSyncStatus();
      if (event.detail && ['signin', 'signup', 'signout', 'restore'].indexOf(event.detail.reason) !== -1) {
        if (modal && !modal.hidden) render();
        return;
      }
      var user = currentUser();
      if (user && dashboard && !dashboard.hidden) {
        var count = $('accountHistoryCount');
        if (count) count.textContent = String((user.history || []).length);
        if (event.detail && event.detail.reason === 'profile' && document.activeElement &&
          $('accountModal') && $('accountModal').contains(document.activeElement) &&
          document.activeElement.tagName === 'INPUT') {
          return;
        }
        if (event.detail && event.detail.reason === 'profile' && $('historyList')) {
          setAvatarImages(user);
          var bioInput = $('accountBio');
          if (bioInput && document.activeElement !== bioInput) {
            bioInput.value = user.bio || '';
            updateBioCount();
          }
          renderHistory(user);
          renderWebsites(user);
          renderAppCards();
        }
      }
    });
    hookLessonHistory();
  }

  function ensureInitialized() {
    if (initialized) return;
    initialized = true;
    bindEvents();
    render();
  }

  window.openAccount = function () {
    openAccount();
  };
  window.closeAccount = closeAccount;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      ensureInitialized();
      window.setTimeout(hookLessonHistory, 0);
    });
  } else {
    ensureInitialized();
    window.setTimeout(hookLessonHistory, 0);
  }
})();
