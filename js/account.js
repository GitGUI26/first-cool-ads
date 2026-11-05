(function () {
  'use strict';

  var Store = window.CoolAccountStore;
  if (!Store) return;

  var $ = function (id) { return document.getElementById(id); };
  var modal = $('accountModal');
  var authView = $('accountAuthView');
  var dashboard = $('accountDashboard');
  var accountTab = $('accountTab');
  var accountNavLabel = $('accountNavLabel');
  var toast = $('accountToast');
  var toastTimer = 0;
  var prefTimer = 0;
  var initialized = false;
  var activeAuthMode = 'signin';

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = !!hidden;
    element.style.display = hidden ? 'none' : '';
  }

  function showError(id, message) {
    var element = $(id);
    if (!element) return;
    element.textContent = message || '';
    element.hidden = !message;
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
    }, 2600);
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
    activeAuthMode = mode;
    document.querySelectorAll('[data-auth-mode]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-auth-mode') === mode);
    });
    setHidden($('signinForm'), mode !== 'signin');
    setHidden($('signupForm'), mode !== 'signup');
    setHidden($('recoveryForm'), mode !== 'recovery');
    var lede = $('accountLede');
    if (lede) {
      lede.textContent = mode === 'signup'
        ? 'Create a username and password. An email is optional.'
        : mode === 'recovery'
          ? 'Use the optional recovery email saved on the account.'
          : 'Sign in to keep your games, browsing history, and preferences together.';
    }
    showError('signinError', '');
    showError('signupError', '');
    showError('recoveryError', '');
    showError('recoverySuccess', '');
  }

  function initials(name) {
    var value = String(name || '?').replace(/^@/, '').trim();
    return (value.charAt(0) || '?').toUpperCase();
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

  function renderNav() {
    var user = currentUser();
    if (accountNavLabel) accountNavLabel.textContent = user ? '@' + user.username : 'ACCOUNT';
    if (accountTab) {
      accountTab.classList.toggle('has-account', !!user);
      accountTab.setAttribute('aria-label', user ? 'Open account for ' + user.username : 'Open account');
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

  function renderDashboard(user) {
    if (!user) return;
    $('accountAvatar').textContent = initials(user.username);
    $('accountUsername').textContent = '@' + user.username;
    $('accountJoined').textContent = 'Member since ' + formatDate(user.createdAt) + ' · local account';
    $('accountRecoveryEmail').value = user.recoveryEmail || '';
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
    var user = currentUser();
    renderNav();
    renderAppCards();
    setHidden(authView, !!user);
    setHidden(dashboard, !user);
    if (user) {
      renderDashboard(user);
      $('accountModalTitle').textContent = 'Your account';
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
      var first = currentUser() ? $('accountSignOut') : (activeAuthMode === 'signup' ? $('signupUsername') : $('signinUsername'));
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
    var email = $('signupEmail').value;
    showError('signupError', '');
    if (!password) {
      showError('signupError', 'Enter a password.');
      $('signupPassword').focus();
      return;
    }
    Store.saveGuestPreferences();
    setBusy(form, true, 'Creating…');
    var result = await Store.createAccount({ username: username, password: password, email: email });
    setBusy(form, false);
    if (!result.ok) {
      showError('signupError', result.error);
      return;
    }
    Store.capturePreferences();
    $('signupForm').reset();
    setAuthMode('signin');
    render();
    showToast('Account created. Your history and preferences will be saved to it.');
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

  async function submitRecovery(event) {
    event.preventDefault();
    var form = $('recoveryForm');
    showError('recoveryError', '');
    showError('recoverySuccess', '');
    setBusy(form, true, 'Resetting…');
    var result = await Store.resetPassword(
      $('recoveryUsername').value,
      $('recoveryEmail').value,
      $('recoveryPassword').value
    );
    setBusy(form, false);
    if (!result.ok) {
      showError('recoveryError', result.error);
      return;
    }
    var username = $('recoveryUsername').value;
    $('recoveryForm').reset();
    setAuthMode('signin');
    $('signinUsername').value = username;
    showToast('Password reset. Sign in with the new password.');
  }

  function saveRecoveryEmail() {
    var result = Store.updateRecoveryEmail($('accountRecoveryEmail').value);
    var message = $('accountEmailMessage');
    if (message) {
      message.textContent = result.ok ? 'Recovery email saved.' : result.error;
      message.className = 'account-inline-message ' + (result.ok ? 'is-success' : 'is-error');
    }
    if (result.ok) showToast('Recovery email saved.');
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

  function bindEvents() {
    document.querySelectorAll('[data-account-close]').forEach(function (element) {
      element.addEventListener('click', closeAccount);
    });
    document.querySelectorAll('[data-auth-mode]').forEach(function (button) {
      button.addEventListener('click', function () { setAuthMode(button.getAttribute('data-auth-mode')); });
    });
    $('signupForm').addEventListener('submit', submitSignup);
    $('signinForm').addEventListener('submit', submitSignin);
    $('recoveryForm').addEventListener('submit', submitRecovery);
    $('showRecovery').addEventListener('click', function () { setAuthMode('recovery'); });
    $('cancelRecovery').addEventListener('click', function () { setAuthMode('signin'); });
    $('accountSignOut').addEventListener('click', function () {
      Store.signOut();
      activeAuthMode = 'signin';
      render();
      showToast('Signed out. Guest preferences restored.');
      window.setTimeout(function () { window.location.reload(); }, 350);
    });
    $('saveRecoveryEmail').addEventListener('click', saveRecoveryEmail);
    $('saveAppAccounts').addEventListener('click', saveApps);
    $('websiteForm').addEventListener('submit', addWebsite);
    $('clearHistory').addEventListener('click', clearHistory);
    $('savePreferences').addEventListener('click', savePreferencesNow);
    $('websiteList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-website]');
      if (button) removeWebsite(button.getAttribute('data-remove-website'));
    });
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
