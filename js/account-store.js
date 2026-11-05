/*
 * Cool Tutoring Hub account store.
 *
 * This build is static, so accounts live in this browser's localStorage. Passwords
 * are never stored directly: each account gets a random salt and a PBKDF2-SHA-256
 * hash. Usernames are unique within this browser's account registry.
 */
(function () {
  'use strict';

  var ACCOUNTS_KEY = 'cuh_accounts_v1';
  var SESSION_KEY = 'cuh_session_v1';
  var GUEST_PREFS_KEY = 'cuh_guest_prefs_v1';
  var VERSION = 1;
  var ITERATIONS = 150000;
  var MAX_HISTORY = 200;

  var PREF_KEYS = [
    'selectedTheme',
    'selectedBackground',
    'customThemeColor',
    'cursorStyle',
    'cursorEnabled',
    'inactiveTabTitle',
    'inactiveTabFavicon',
    'customLogo',
    'gameFavorites',
    'flashEnabled',
    'lastSearchTerm',
    'sortMethod'
  ];

  var DEFAULT_PREFS = {
    selectedTheme: 'default',
    selectedBackground: 'matrix',
    cursorStyle: 'ring',
    cursorEnabled: 'true',
    inactiveTabTitle: 'Home | Rowan County Schools',
    inactiveTabFavicon: 'cuh.png',
    gameFavorites: '[]',
    flashEnabled: 'true',
    lastSearchTerm: '',
    sortMethod: 'default'
  };

  var APP_IDS = ['discord', 'tiktok', 'youtube'];
  var ACCOUNT_KEYS = [ACCOUNTS_KEY, SESSION_KEY, GUEST_PREFS_KEY];

  function safeParse(value, fallback) {
    try { return JSON.parse(value) || fallback; } catch (error) { return fallback; }
  }

  function cleanText(value, maxLength) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function cleanEmail(value) {
    var email = String(value == null ? '' : value).trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
    return email;
  }

  function normalizeEmail(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function normalizeUsername(value) {
    return String(value == null ? '' : value).trim().normalize('NFKC').toLowerCase();
  }

  function validateUsername(value) {
    var display = String(value == null ? '' : value).trim();
    if (!display) return { ok: false, error: 'Choose a username.' };
    if (display.length > 24) return { ok: false, error: 'Usernames can be up to 24 characters.' };
    if (!/^[A-Za-z0-9_.-]+$/.test(display)) {
      return { ok: false, error: 'Use letters, numbers, periods, dashes, or underscores for the username.' };
    }
    return { ok: true, username: display, key: normalizeUsername(display) };
  }

  function cleanUrl(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = 'https://' + raw;
    try {
      var parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href.slice(0, 2048);
    } catch (error) {
      return '';
    }
  }

  function randomId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (error) {}
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function bytesToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function randomSalt() {
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
  }

  function cryptoAvailable() {
    return !!(window.crypto && window.crypto.subtle && window.TextEncoder);
  }

  async function derivePassword(password, salt, iterations) {
    if (!cryptoAvailable()) throw new Error('This browser cannot create accounts securely.');
    var keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    var bits = await window.crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: base64ToBytes(salt),
      iterations: iterations || ITERATIONS,
      hash: 'SHA-256'
    }, keyMaterial, 256);
    return bytesToBase64(new Uint8Array(bits));
  }

  function emptyRegistry() {
    return { version: VERSION, users: {} };
  }

  function readRegistry() {
    var registry = safeParse(localStorage.getItem(ACCOUNTS_KEY), emptyRegistry());
    if (!registry || registry.version !== VERSION || !registry.users || typeof registry.users !== 'object') {
      return emptyRegistry();
    }
    return registry;
  }

  function writeRegistry(registry) {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(registry));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getSessionKey() {
    try { return localStorage.getItem(SESSION_KEY) || ''; } catch (error) { return ''; }
  }

  function getCurrentUser() {
    var key = getSessionKey();
    if (!key) return null;
    var registry = readRegistry();
    var user = registry.users[key];
    if (!user) {
      try { localStorage.removeItem(SESSION_KEY); } catch (error) {}
      return null;
    }
    return user;
  }

  function findUser(username) {
    var key = normalizeUsername(username);
    if (!key) return null;
    return readRegistry().users[key] || null;
  }

  function saveUser(user) {
    var registry = readRegistry();
    user.updatedAt = new Date().toISOString();
    registry.users[user.key] = user;
    var saved = writeRegistry(registry);
    if (saved) emitChange('profile');
    return saved;
  }

  function snakeApp(value) {
    return APP_IDS.indexOf(value) !== -1 ? value : '';
  }

  function blankApps() {
    var apps = {};
    APP_IDS.forEach(function (id) { apps[id] = { handle: '', url: '' }; });
    return apps;
  }

  function normalizeUser(user) {
    if (!user || typeof user !== 'object') return user;
    if (!Array.isArray(user.history)) user.history = [];
    if (!Array.isArray(user.websites)) user.websites = [];
    if (!user.apps || typeof user.apps !== 'object') user.apps = blankApps();
    APP_IDS.forEach(function (id) {
      if (!user.apps[id] || typeof user.apps[id] !== 'object') user.apps[id] = { handle: '', url: '' };
      user.apps[id].handle = cleanText(user.apps[id].handle, 80);
      user.apps[id].url = cleanUrl(user.apps[id].url);
    });
    if (!user.preferences || typeof user.preferences !== 'object') user.preferences = {};
    return user;
  }

  function emitChange(reason) {
    try {
      window.dispatchEvent(new CustomEvent('cuh-account-change', {
        detail: { reason: reason || 'update', user: getCurrentUser() }
      }));
    } catch (error) {}
  }

  function snapshotPreferences() {
    var data = {};
    PREF_KEYS.forEach(function (key) {
      try {
        var value = localStorage.getItem(key);
        if (value !== null) data[key] = value;
      } catch (error) {}
    });
    // Avoid duplicating a multi-megabyte uploaded logo into every account.
    if (data.customLogo && data.customLogo.length > 450000) delete data.customLogo;
    return data;
  }

  function saveGuestPreferences() {
    if (getCurrentUser()) return false;
    try {
      localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(snapshotPreferences()));
      return true;
    } catch (error) {
      return false;
    }
  }

  function applyPreferences(preferences) {
    var source = preferences && typeof preferences === 'object' ? preferences : {};
    PREF_KEYS.forEach(function (key) {
      try {
        if (Object.prototype.hasOwnProperty.call(source, key) && typeof source[key] === 'string') {
          localStorage.setItem(key, source[key]);
        } else if (Object.prototype.hasOwnProperty.call(DEFAULT_PREFS, key)) {
          localStorage.setItem(key, DEFAULT_PREFS[key]);
        } else {
          localStorage.removeItem(key);
        }
      } catch (error) {}
    });
  }

  function applyGuestPreferences() {
    var preferences = safeParse(localStorage.getItem(GUEST_PREFS_KEY), null);
    applyPreferences(preferences || {});
  }

  function capturePreferences() {
    var user = getCurrentUser();
    if (!user) return false;
    user.preferences = snapshotPreferences();
    return saveUser(user);
  }

  function setSession(key) {
    try { localStorage.setItem(SESSION_KEY, key); return true; } catch (error) { return false; }
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (error) {}
  }

  async function createAccount(input) {
    var check = validateUsername(input && input.username);
    if (!check.ok) return check;
    var password = String(input && input.password != null ? input.password : '');
    if (!password) return { ok: false, error: 'Enter a password.' };
    var registry = readRegistry();
    if (registry.users[check.key]) return { ok: false, error: 'That username is already taken.' };
    if (!cryptoAvailable()) return { ok: false, error: 'This browser does not support secure accounts.' };
    var salt;
    var hash;
    try {
      salt = randomSalt();
      hash = await derivePassword(password, salt, ITERATIONS);
    } catch (error) {
      return { ok: false, error: error.message || 'Could not secure the password.' };
    }
    var now = new Date().toISOString();
    var user = {
      key: check.key,
      username: check.username,
      salt: salt,
      passwordHash: hash,
      iterations: ITERATIONS,
      recoveryEmail: cleanEmail(input && input.email),
      history: [],
      apps: blankApps(),
      websites: [],
      preferences: {},
      createdAt: now,
      updatedAt: now
    };
    registry.users[check.key] = user;
    if (!writeRegistry(registry)) return { ok: false, error: 'This browser is out of storage.' };
    if (!setSession(check.key)) {
      delete registry.users[check.key];
      writeRegistry(registry);
      return { ok: false, error: 'Could not start a session in this browser.' };
    }
    emitChange('signup');
    return { ok: true, user: user };
  }

  async function signIn(username, password) {
    var user = findUser(username);
    if (!user || !cryptoAvailable()) return { ok: false, error: 'Username or password is incorrect.' };
    var hash;
    try {
      hash = await derivePassword(String(password == null ? '' : password), user.salt, user.iterations || ITERATIONS);
    } catch (error) {
      return { ok: false, error: error.message || 'Could not verify the password.' };
    }
    if (hash !== user.passwordHash) return { ok: false, error: 'Username or password is incorrect.' };
    if (!setSession(user.key)) return { ok: false, error: 'Could not start a session in this browser.' };
    emitChange('signin');
    return { ok: true, user: normalizeUser(user) };
  }

  async function resetPassword(username, email, newPassword) {
    var user = findUser(username);
    if (!user) return { ok: false, error: 'No account with that username was found.' };
    if (!user.recoveryEmail) return { ok: false, error: 'That account does not have a recovery email.' };
    if (normalizeEmail(email) !== normalizeEmail(user.recoveryEmail)) {
      return { ok: false, error: 'The recovery email does not match this account.' };
    }
    var password = String(newPassword == null ? '' : newPassword);
    if (!password) return { ok: false, error: 'Enter a new password.' };
    try {
      user.salt = randomSalt();
      user.passwordHash = await derivePassword(password, user.salt, ITERATIONS);
      user.iterations = ITERATIONS;
    } catch (error) {
      return { ok: false, error: error.message || 'Could not update the password.' };
    }
    return saveUser(user) ? { ok: true } : { ok: false, error: 'This browser is out of storage.' };
  }

  function updateRecoveryEmail(email) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    var cleaned = cleanEmail(email);
    if (String(email || '').trim() && !cleaned) return { ok: false, error: 'Enter a valid email or leave it blank.' };
    user.recoveryEmail = cleaned;
    return saveUser(user) ? { ok: true } : { ok: false, error: 'This browser is out of storage.' };
  }

  function setApps(apps) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    var next = blankApps();
    APP_IDS.forEach(function (id) {
      var item = apps && apps[id];
      if (!item) return;
      next[id] = {
        handle: cleanText(item.handle, 80),
        url: cleanUrl(item.url)
      };
    });
    user.apps = next;
    return saveUser(user) ? { ok: true } : { ok: false, error: 'This browser is out of storage.' };
  }

  function addWebsite(input) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    var name = cleanText(input && input.name, 60);
    if (!name) return { ok: false, error: 'Give the website a name.' };
    var item = {
      id: randomId(),
      name: name,
      username: cleanText(input && input.username, 80),
      url: cleanUrl(input && input.url),
      note: cleanText(input && input.note, 200)
    };
    user.websites = Array.isArray(user.websites) ? user.websites : [];
    user.websites.unshift(item);
    user.websites = user.websites.slice(0, 40);
    return saveUser(user) ? { ok: true, item: item } : { ok: false, error: 'This browser is out of storage.' };
  }

  function removeWebsite(id) {
    var user = getCurrentUser();
    if (!user) return false;
    user.websites = (user.websites || []).filter(function (item) { return item.id !== id; });
    return saveUser(user);
  }

  function addHistory(entry) {
    var user = getCurrentUser();
    if (!user) return false;
    var title = cleanText(entry && entry.title, 160);
    var url = cleanText(entry && entry.url, 2048);
    if (!title && !url) return false;
    var type = ['web', 'app', 'game', 'site'].indexOf(entry && entry.type) !== -1 ? entry.type : 'web';
    user.history = Array.isArray(user.history) ? user.history : [];
    var previous = user.history[0];
    if (previous && previous.url === url && Date.now() - new Date(previous.at).getTime() < 5000) {
      previous.at = new Date().toISOString();
      saveUser(user);
      return true;
    }
    user.history.unshift({
      id: randomId(),
      type: type,
      title: title || url,
      url: url,
      at: new Date().toISOString()
    });
    user.history = user.history.slice(0, MAX_HISTORY);
    return saveUser(user);
  }

  function clearHistory() {
    var user = getCurrentUser();
    if (!user) return false;
    user.history = [];
    return saveUser(user);
  }

  function isAccountKey(key) {
    return ACCOUNT_KEYS.indexOf(String(key || '')) !== -1;
  }

  function redactStorageSnapshot(data) {
    var copy = Object.assign({}, data || {});
    ACCOUNT_KEYS.forEach(function (key) { delete copy[key]; });
    return copy;
  }

  function snapshotAccountKeys() {
    var snapshot = {};
    ACCOUNT_KEYS.forEach(function (key) {
      try {
        var value = localStorage.getItem(key);
        if (value !== null) snapshot[key] = value;
      } catch (error) {}
    });
    return snapshot;
  }

  function restoreAccountKeys(snapshot) {
    Object.keys(snapshot || {}).forEach(function (key) {
      if (!isAccountKey(key)) return;
      try { localStorage.setItem(key, snapshot[key]); } catch (error) {}
    });
  }

  // Apply the signed-in account's preferences before main.js initializes settings.
  try {
    var initialUser = getCurrentUser();
    if (initialUser) applyPreferences(initialUser.preferences);
  } catch (error) {}

  window.CoolAccountStore = {
    keys: {
      accounts: ACCOUNTS_KEY,
      session: SESSION_KEY,
      guestPreferences: GUEST_PREFS_KEY
    },
    appIds: APP_IDS.slice(),
    preferenceKeys: PREF_KEYS.slice(),
    getCurrentUser: getCurrentUser,
    getUserCount: function () { return Object.keys(readRegistry().users).length; },
    createAccount: createAccount,
    signIn: signIn,
    resetPassword: resetPassword,
    signOut: function () {
      capturePreferences();
      clearSession();
      applyGuestPreferences();
      emitChange('signout');
    },
    saveGuestPreferences: saveGuestPreferences,
    applyPreferences: applyPreferences,
    applyGuestPreferences: applyGuestPreferences,
    capturePreferences: capturePreferences,
    snapshotPreferences: snapshotPreferences,
    updateRecoveryEmail: updateRecoveryEmail,
    setApps: setApps,
    addWebsite: addWebsite,
    removeWebsite: removeWebsite,
    addHistory: addHistory,
    clearHistory: clearHistory,
    redactStorageSnapshot: redactStorageSnapshot,
    isAccountKey: isAccountKey,
    snapshotAccountKeys: snapshotAccountKeys,
    restoreAccountKeys: restoreAccountKeys
  };
})();
