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
  var recoveryEmail = '';
  var resendTimer = 0;
  var resendUntil = 0;
  var pendingVerification = null;
  var verifyResendTimer = 0;
  var verifyResendUntil = 0;
  var VERIFY_STORAGE_KEY = 'cuh_pending_verification_v1';

  function isLocalUser(user) {
    return !!user && String(user.id || '').indexOf('local-') === 0;
  }

  function readPendingVerification() {
    try {
      var data = JSON.parse(sessionStorage.getItem(VERIFY_STORAGE_KEY) || 'null');
      if (!data || !data.email || !data.mode) return null;
      if (data.at && Date.now() - data.at > 3600000) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  function writePendingVerification(value) {
    pendingVerification = Object.assign({}, value, { at: Date.now() });
    try { sessionStorage.setItem(VERIFY_STORAGE_KEY, JSON.stringify(pendingVerification)); } catch (error) {}
  }

  function clearPendingVerification() {
    pendingVerification = null;
    if (verifyResendTimer) {
      clearInterval(verifyResendTimer);
      verifyResendTimer = 0;
    }
    verifyResendUntil = 0;
    try { sessionStorage.removeItem(VERIFY_STORAGE_KEY); } catch (error) {}
  }

  function verificationStillApplies() {
    if (!pendingVerification) return false;
    var user = currentUser();
    if (pendingVerification.mode === 'upgrade') {
      if (!user || !isLocalUser(user) || !pendingVerification.upgrade ||
        String(user.id) !== String(pendingVerification.upgrade.localId)) {
        clearPendingVerification();
        return false;
      }
    } else if (user) {
      clearPendingVerification();
      return false;
    }
    return true;
  }

  pendingVerification = readPendingVerification();

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

  function updateResendButton() {
    var button = $('resendRecovery');
    if (!button) return;
    var remaining = Math.ceil((resendUntil - Date.now()) / 1000);
    if (remaining > 0) {
      button.disabled = true;
      button.textContent = 'Resend code in ' + remaining + 's';
    } else {
      button.disabled = false;
      button.textContent = 'Resend code';
      if (resendTimer) {
        clearInterval(resendTimer);
        resendTimer = 0;
      }
    }
  }

  function startResendCooldown() {
    resendUntil = Date.now() + 60000;
    updateResendButton();
    clearInterval(resendTimer);
    resendTimer = window.setInterval(updateResendButton, 1000);
  }

  function setAuthMode(mode) {
    activeAuthMode = mode;
    var verifying = mode === 'verify';
    var codeStep = mode === 'code';
    var resetting = mode === 'password';
    var onRecovery = mode === 'recovery' || codeStep || resetting;
    document.querySelectorAll('[data-auth-mode]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-auth-mode') === mode);
    });
    setHidden($('accountAuthTabs'), verifying);
    setHidden($('signinForm'), mode !== 'signin');
    setHidden($('signupForm'), mode !== 'signup');
    setHidden($('recoveryForm'), !onRecovery);
    setHidden($('verifyForm'), !verifying);

    var configured = Store.isCloudConfigured ? Store.isCloudConfigured() : false;
    var lede = $('accountLede');
    if (lede) {
      lede.hidden = onRecovery || verifying;
      lede.textContent = configured
        ? (mode === 'signup'
          ? 'Add an email for online sync, or leave it blank to keep this account in this browser.'
          : 'Sign in with your email for an online account, or your username for a browser-only account.')
        : (mode === 'signup'
          ? 'Create an account saved in this browser. Add Supabase settings later to turn on online sync.'
          : 'Sign in to keep your games, browsing history, and preferences together on this device.');
    }
    var recoveryLink = $('showRecovery');
    if (recoveryLink) recoveryLink.hidden = !configured || verifying;
    document.querySelectorAll('.account-local-note').forEach(function (note) {
      var copy = note.getAttribute(configured ? 'data-online-copy' : 'data-local-copy');
      if (copy) note.textContent = copy;
    });
    if ($('recoveryLede')) {
      $('recoveryLede').textContent = codeStep
        ? 'Enter the code from your email and choose a new password.'
        : resetting
          ? 'Choose a new password for your account.'
          : 'Enter the email on your account and we will send you a recovery code.';
    }
    setHidden($('recoveryEmailLabel'), mode !== 'recovery');
    setHidden($('recoveryCodeLabel'), !codeStep);
    setHidden($('recoveryPasswordLabel'), !codeStep && !resetting);
    setHidden($('resendRecovery'), !codeStep);
    if ($('recoverySubmit')) {
      $('recoverySubmit').textContent = codeStep
        ? 'Reset password'
        : resetting
          ? 'Save new password'
          : 'Send code';
      delete $('recoverySubmit').dataset.label;
    }
    if ($('cancelRecovery')) {
      $('cancelRecovery').textContent = codeStep
        ? 'Use a different email'
        : resetting
          ? 'Back to sign in'
          : 'Back';
    }
    if (mode === 'recovery') {
      if ($('recoveryCode')) $('recoveryCode').value = '';
      if ($('recoveryNewPassword')) $('recoveryNewPassword').value = '';
    }
    updateResendButton();
    updateVerifyResendButton();
    var title = $('accountModalTitle');
    if (title) {
      if (verifying) title.textContent = 'Verify your email';
      else if (mode === 'recovery' || mode === 'code') title.textContent = 'Reset your password';
      else if (mode === 'signin' || mode === 'signup') title.textContent = 'Sign in or create an account';
    }

    showError('signinError', '');
    showError('signupError', '');
    showSuccess('signupSuccess', '');
    showError('recoveryError', '');
    showSuccess('recoverySuccess', '');
    if (!verifying) {
      showError('verifyError', '');
      showSuccess('verifySuccess', '');
    }
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
    var passwordButton = $('accountChangePassword');
    if (pill) {
      pill.className = 'account-sync-pill ' + (local || !configured ? 'is-local' : synced ? 'is-synced' : 'is-online');
      pill.textContent = local ? 'Local only' : configured ? (synced ? 'Synced' : 'Online account') : 'Local only';
    }
    if (message) {
      message.className = 'account-sync-message';
      if (local) {
        message.textContent = configured
          ? 'This account is saved in this browser. Add a verified email to use it on other devices.'
          : 'This account is saved in this browser only. Cloud sync has not been turned on yet.';
      } else {
        message.textContent = configured
          ? (synced
            ? 'Your profile is stored online and follows your account to a new domain.'
            : 'Your online account is ready. Sync now to upload the latest profile.')
          : 'This account is saved in this browser only. Cloud sync has not been turned on yet.';
      }
    }
    if (syncButton) syncButton.disabled = local || !configured;
    if (passwordButton) passwordButton.disabled = local || !configured;
  }

  function renderDashboard(user) {
    if (!user) return;
    var configured = Store.isCloudConfigured ? Store.isCloudConfigured() : false;
    var local = isLocalUser(user);
    setAvatarImages(user);
    $('accountUsername').textContent = '@' + user.username;
    $('accountJoined').textContent = 'Member since ' + formatDate(user.createdAt) +
      (local || !configured ? ' · saved in this browser' : ' · online account');
    var displayName = $('accountDisplayName');
    if (displayName && document.activeElement !== displayName) displayName.value = user.username || '';
    var emailField = $('accountRecoveryEmail');
    if (emailField) {
      emailField.value = user.email || '';
      emailField.placeholder = local ? 'Not added' : '';
    }
    setHidden($('accountEmailUpgrade'), !local || !configured);
    if (local && configured) {
      if ($('upgradeUsername') && document.activeElement !== $('upgradeUsername')) {
        $('upgradeUsername').value = user.username || '';
      }
      if ($('upgradeEmail') && document.activeElement !== $('upgradeEmail')) {
        $('upgradeEmail').value = user.email || '';
      }
    }
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
  }

  function render() {
    verificationStillApplies();
    var user = currentUser();
    var recovery = Store.isRecoveryPending();
    var verifying = !!pendingVerification;
    renderNav();
    renderAppCards();
    setHidden(authView, !!user && !recovery && !verifying);
    setHidden(dashboard, !user || recovery || verifying);
    if (recovery) {
      setAuthMode('password');
      $('accountModalTitle').textContent = 'Choose a new password';
    } else if (verifying) {
      setAuthMode('verify');
      if ($('verifyEmail')) $('verifyEmail').value = pendingVerification.email || '';
      if ($('verifyLede')) {
        $('verifyLede').textContent = pendingVerification.mode === 'upgrade'
          ? 'Enter the code sent to ' + pendingVerification.email + ' to attach this email and sync your account.'
          : 'Enter the code sent to ' + pendingVerification.email + ' to finish creating your account.';
      }
      $('accountModalTitle').textContent = 'Verify your email';
    } else if (user) {
      renderDashboard(user);
      $('accountModalTitle').textContent = 'Account settings';
    } else {
      if (activeAuthMode === 'password' || activeAuthMode === 'verify') activeAuthMode = 'signin';
      setAuthMode(activeAuthMode || 'signin');
      $('accountModalTitle').textContent = (activeAuthMode === 'recovery' || activeAuthMode === 'code')
        ? 'Reset your password'
        : 'Sign in or create an account';
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
      if (Store.isRecoveryPending()) first = $('recoveryNewPassword');
      else if (pendingVerification) first = $('verifyCode');
      else if (activeAuthMode === 'code') first = $('recoveryCode');
      else if (currentUser()) first = $('accountDisplayName');
      else if (activeAuthMode === 'signup') first = $('signupUsername');
      else if (activeAuthMode === 'recovery') first = $('recoveryEmail');
      else first = $('signinEmail');
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

  function updateVerifyResendButton() {
    var button = $('resendVerification');
    if (!button) return;
    var remaining = Math.ceil((verifyResendUntil - Date.now()) / 1000);
    if (remaining > 0) {
      button.disabled = true;
      button.textContent = 'Resend code in ' + remaining + 's';
    } else {
      button.disabled = false;
      button.textContent = 'Resend code';
      if (verifyResendTimer) {
        clearInterval(verifyResendTimer);
        verifyResendTimer = 0;
      }
    }
  }

  function startVerifyResendCooldown() {
    verifyResendUntil = Date.now() + 60000;
    updateVerifyResendButton();
    clearInterval(verifyResendTimer);
    verifyResendTimer = window.setInterval(updateVerifyResendButton, 1000);
  }

  function beginVerification(value) {
    writePendingVerification(value);
    activeAuthMode = 'verify';
    setHidden(authView, false);
    setHidden(dashboard, true);
    if ($('verifyEmail')) $('verifyEmail').value = value.email || '';
    if ($('verifyCode')) $('verifyCode').value = '';
    if ($('verifyLede')) {
      $('verifyLede').textContent = value.mode === 'upgrade'
        ? 'Enter the code sent to ' + value.email + ' to attach this email and sync your account.'
        : 'Enter the code sent to ' + value.email + ' to finish creating your account.';
    }
    verifyResendUntil = 0;
    setAuthMode('verify');
    updateVerifyResendButton();
    if ($('accountModalTitle')) $('accountModalTitle').textContent = 'Verify your email';
    window.setTimeout(function () { if ($('verifyCode')) $('verifyCode').focus(); }, 30);
  }

  async function submitVerification(event) {
    event.preventDefault();
    if (!pendingVerification) {
      render();
      return;
    }
    var form = $('verifyForm');
    var pending = pendingVerification;
    var token = String($('verifyCode').value || '').replace(/\D/g, '');
    showError('verifyError', '');
    if (token.length < 6) {
      showError('verifyError', 'Enter the code from your verification email.');
      $('verifyCode').focus();
      return;
    }
    setBusy(form, true, 'Verifying…');
    var result = await Store.verifyEmailCode(pending.email, token, pending.upgrade || null);
    setBusy(form, false);
    if (!result.ok) {
      showError('verifyError', result.error);
      return;
    }
    if (result.user && result.user.preferences) Store.applyPreferences(result.user.preferences);
    clearPendingVerification();
    $('verifyForm').reset();
    activeAuthMode = 'signin';
    render();
    showToast(pending.mode === 'upgrade'
      ? 'Email verified. This account now syncs across devices.'
      : 'Email verified. You are signed in.');
    window.setTimeout(function () { window.location.reload(); }, 500);
  }

  async function resendVerificationCode() {
    if (!pendingVerification) {
      render();
      return;
    }
    var button = $('resendVerification');
    if (!button || button.disabled) return;
    showError('verifyError', '');
    showSuccess('verifySuccess', '');
    button.disabled = true;
    button.textContent = 'Sending…';
    var result = await Store.resendEmailCode(pendingVerification.email);
    if (!result.ok) {
      showError('verifyError', result.error);
      updateVerifyResendButton();
      return;
    }
    showSuccess('verifySuccess', 'A new verification code was sent to ' + pendingVerification.email + '.');
    startVerifyResendCooldown();
  }

  function cancelVerification() {
    var wasUpgrade = !!pendingVerification && pendingVerification.mode === 'upgrade';
    clearPendingVerification();
    if ($('verifyForm')) $('verifyForm').reset();
    activeAuthMode = 'signin';
    render();
    showToast(wasUpgrade
      ? 'Email not added. Your browser account is still here.'
      : 'Verification skipped. You can verify later by signing in with that email.');
  }

  async function requestEmailUpgrade(event) {
    event.preventDefault();
    var form = $('upgradeEmailForm');
    var user = currentUser();
    if (!user || !isLocalUser(user)) return;
    showError('upgradeError', '');
    var email = $('upgradeEmail').value;
    var username = $('upgradeUsername').value;
    var password = $('upgradePassword').value;
    if (password.length < 6) {
      showError('upgradeError', 'Enter the password for this browser account.');
      $('upgradePassword').focus();
      return;
    }
    Store.capturePreferences();
    setBusy(form, true, 'Sending…');
    var result = await Store.requestEmailUpgrade({
      email: email,
      username: username,
      password: password,
      localId: user.id
    });
    setBusy(form, false);
    if (!result.ok) {
      showError('upgradeError', result.error);
      return;
    }
    if (!result.needsConfirmation) {
      $('upgradeEmailForm').reset();
      render();
      showToast('Email added. This account now syncs across devices.');
      return;
    }
    $('upgradeEmailForm').reset();
    beginVerification({
      email: result.email,
      mode: 'upgrade',
      upgrade: result.upgrade || { localId: user.id, username: username }
    });
    showSuccess('verifySuccess', 'We sent a verification code to ' + result.email + '. Enter it below to finish syncing.');
    showToast('Check your email for the verification code.');
  }

  async function submitSignup(event) {
    event.preventDefault();
    var form = $('signupForm');
    var username = $('signupUsername').value;
    var email = $('signupEmail').value;
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
    var result = await Store.createAccount({ username: username, email: email, password: password });
    setBusy(form, false);
    if (!result.ok) {
      showError('signupError', result.error);
      return;
    }
    if (result.needsConfirmation) {
      $('signupForm').reset();
      beginVerification({ email: result.email, mode: 'signup' });
      showSuccess('verifySuccess', 'We sent a verification code to ' + result.email + '. Enter it below.');
      showToast('Check your email for the verification code.');
      return;
    }
    Store.capturePreferences();
    $('signupForm').reset();
    activeAuthMode = 'signin';
    render();
    var configured = Store.isCloudConfigured ? Store.isCloudConfigured() : false;
    showToast(result.localOnly
      ? 'Account created in this browser. Add an email in settings to sync it.'
      : configured
        ? 'Account created. It will work on every future domain.'
        : 'Account created and saved in this browser.');
  }

  async function submitSignin(event) {
    event.preventDefault();
    var form = $('signinForm');
    showError('signinError', '');
    Store.saveGuestPreferences();
    setBusy(form, true, 'Signing in…');
    var result = await Store.signIn($('signinEmail').value, $('signinPassword').value);
    setBusy(form, false);
    if (!result.ok) {
      if (result.needsConfirmation && result.email) {
        $('signinForm').reset();
        beginVerification({ email: result.email, mode: 'signup' });
        showSuccess('verifySuccess', result.error);
        return;
      }
      showError('signinError', result.error);
      return;
    }
    Store.applyPreferences(result.user.preferences);
    $('signinForm').reset();
    render();
    showToast('Signed in. Your history and preferences are loaded.');
    window.setTimeout(function () { window.location.reload(); }, 350);
  }

  async function submitRecovery(event) {
    event.preventDefault();
    if (activeAuthMode === 'password') return submitNewPassword(event);
    if (activeAuthMode === 'code') return submitRecoveryCode(event);
    var form = $('recoveryForm');
    showError('recoveryError', '');
    showSuccess('recoverySuccess', '');
    var email = $('recoveryEmail').value;
    setBusy(form, true, 'Sending…');
    var result = await Store.sendRecoveryCode(email);
    setBusy(form, false);
    if (!result.ok) {
      showError('recoveryError', result.error);
      return;
    }
    recoveryEmail = result.email || email;
    setAuthMode('code');
    showSuccess('recoverySuccess', 'We sent a recovery code to ' + recoveryEmail + '. Check your inbox and spam folder.');
    startResendCooldown();
    if ($('recoveryCode')) $('recoveryCode').focus();
  }

  async function submitRecoveryCode(event) {
    event.preventDefault();
    var form = $('recoveryForm');
    var token = String($('recoveryCode').value || '').replace(/\D/g, '');
    var password = $('recoveryNewPassword').value;
    showError('recoveryError', '');
    if (token.length < 6) {
      showError('recoveryError', 'Enter the code from your recovery email.');
      $('recoveryCode').focus();
      return;
    }
    if (password.length < 6) {
      showError('recoveryError', 'Use a password with at least 6 characters.');
      $('recoveryNewPassword').focus();
      return;
    }
    setBusy(form, true, 'Resetting…');
    var result = await Store.verifyRecoveryCode(recoveryEmail, token, password);
    setBusy(form, false);
    if (!result.ok) {
      showError('recoveryError', result.error);
      if (result.verified) {
        // The code was accepted but saving the password failed. The recovery
        // session is still valid, so ask for the password without the code.
        setHidden(authView, false);
        setHidden(dashboard, true);
        setAuthMode('password');
        showError('recoveryError', result.error);
      }
      return;
    }
    $('recoveryForm').reset();
    recoveryEmail = '';
    Store.cancelRecovery();
    if (result.user && result.user.preferences) Store.applyPreferences(result.user.preferences);
    activeAuthMode = 'signin';
    render();
    showToast('Password updated. You are signed in.');
    window.setTimeout(function () {
      Store.cancelRecovery();
      window.location.reload();
    }, 350);
  }

  async function resendRecoveryCode() {
    if (!recoveryEmail) {
      setAuthMode('recovery');
      return;
    }
    var button = $('resendRecovery');
    if (!button || button.disabled) return;
    showError('recoveryError', '');
    showSuccess('recoverySuccess', '');
    button.disabled = true;
    button.textContent = 'Sending…';
    var result = await Store.sendRecoveryCode(recoveryEmail);
    if (!result.ok) {
      showError('recoveryError', result.error);
      updateResendButton();
      return;
    }
    showSuccess('recoverySuccess', 'A new recovery code was sent to ' + recoveryEmail + '.');
    startResendCooldown();
  }

  async function submitNewPassword(event) {
    event.preventDefault();
    var form = $('recoveryForm');
    showError('recoveryError', '');
    var password = $('recoveryNewPassword').value;
    if (password.length < 6) {
      showError('recoveryError', 'Use a password with at least 6 characters.');
      $('recoveryNewPassword').focus();
      return;
    }
    setBusy(form, true, 'Saving…');
    var result = await Store.completeRecovery(password);
    setBusy(form, false);
    if (!result.ok) {
      showError('recoveryError', result.error);
      return;
    }
    $('recoveryForm').reset();
    activeAuthMode = 'signin';
    render();
    showToast('Password updated. You are signed in.');
  }

  function cancelRecovery() {
    if (activeAuthMode === 'code') {
      setAuthMode('recovery');
      if ($('recoveryEmail')) $('recoveryEmail').focus();
      return;
    }
    if (Store.isRecoveryPending()) Store.cancelRecovery();
    activeAuthMode = 'signin';
    setAuthMode('signin');
    render();
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

  async function saveDisplayName() {
    var input = $('accountDisplayName');
    var button = $('saveDisplayName');
    if (!input || !button) return;
    button.disabled = true;
    var result = await Store.setUsername(input.value);
    button.disabled = false;
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    renderDashboard(currentUser());
    showToast('Display name updated.');
  }

  function beginPasswordReset() {
    var user = currentUser();
    if (!user) return;
    if (isLocalUser(user)) {
      showToast('Add a verified email first to manage an online password.');
      return;
    }
    if (!Store.isCloudConfigured || !Store.isCloudConfigured()) {
      showToast('Cloud sync is not turned on yet, so passwords cannot be changed here.');
      return;
    }
    recoveryEmail = user.email;
    if ($('recoveryEmail')) $('recoveryEmail').value = user.email;
    setHidden(authView, false);
    setHidden(dashboard, true);
    setAuthMode('recovery');
    if ($('accountModalTitle')) $('accountModalTitle').textContent = 'Reset your password';
    showSuccess('recoverySuccess', 'We will send a reset code to ' + user.email + '.');
    if ($('recoveryEmail')) $('recoveryEmail').focus();
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

  function bindEvents() {
    document.querySelectorAll('[data-account-close]').forEach(function (element) {
      element.addEventListener('click', closeAccount);
    });
    document.querySelectorAll('[data-auth-mode]').forEach(function (button) {
      button.addEventListener('click', function () { setAuthMode(button.getAttribute('data-auth-mode')); });
    });
    if ($('signupForm')) $('signupForm').addEventListener('submit', submitSignup);
    if ($('signinForm')) $('signinForm').addEventListener('submit', submitSignin);
    if ($('recoveryForm')) $('recoveryForm').addEventListener('submit', submitRecovery);
    if ($('verifyForm')) $('verifyForm').addEventListener('submit', submitVerification);
    if ($('resendVerification')) $('resendVerification').addEventListener('click', resendVerificationCode);
    if ($('cancelVerification')) $('cancelVerification').addEventListener('click', cancelVerification);
    if ($('upgradeEmailForm')) $('upgradeEmailForm').addEventListener('submit', requestEmailUpgrade);
    if ($('verifyCode')) {
      $('verifyCode').addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 10);
      });
    }
    if ($('resendRecovery')) $('resendRecovery').addEventListener('click', resendRecoveryCode);
    if ($('recoveryCode')) {
      $('recoveryCode').addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 10);
      });
    }
    if ($('showRecovery')) $('showRecovery').addEventListener('click', function () { setAuthMode('recovery'); });
    if ($('cancelRecovery')) $('cancelRecovery').addEventListener('click', cancelRecovery);
    if ($('accountSignOut')) {
      $('accountSignOut').addEventListener('click', function () {
        Store.signOut();
        activeAuthMode = 'signin';
        render();
        showToast('Signed out. Guest preferences restored.');
        window.setTimeout(function () { window.location.reload(); }, 350);
      });
    }
    if ($('saveAppAccounts')) $('saveAppAccounts').addEventListener('click', saveApps);
    if ($('websiteForm')) $('websiteForm').addEventListener('submit', addWebsite);
    if ($('clearHistory')) $('clearHistory').addEventListener('click', clearHistory);
    if ($('savePreferences')) $('savePreferences').addEventListener('click', savePreferencesNow);
    if ($('avatarUpload')) $('avatarUpload').addEventListener('change', handleAvatarUpload);
    if ($('avatarReset')) $('avatarReset').addEventListener('click', resetAvatar);
    if ($('saveDisplayName')) $('saveDisplayName').addEventListener('click', saveDisplayName);
    if ($('accountChangePassword')) $('accountChangePassword').addEventListener('click', beginPasswordReset);
    if ($('accountSyncNow')) $('accountSyncNow').addEventListener('click', syncAccount);
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
    if (Store.isRecoveryPending()) {
      window.setTimeout(openAccount, 0);
      // Supabase finishes parsing the recovery URL just after this script runs.
      // Render again once it has had a moment to establish the recovery session.
      window.setTimeout(function () {
        if (Store.isRecoveryPending()) {
          render();
          openAccount();
        }
      }, 700);
    }
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
