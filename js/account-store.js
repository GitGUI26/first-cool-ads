/*
 * Cool Tutoring Hub account store.
 *
 * Credentials and sessions are handled by Supabase Auth, so an account keeps
 * working after the site moves to a different domain. The browser only caches
 * the signed-in profile (history, saved apps, preferences); passwords never
 * touch this file.
 *
 * The optional public.profiles table (see supabase/schema.sql) syncs that
 * profile across devices. If the table has not been created, the site still
 * signs in and keeps the profile in this browser.
 */
(function () {
  'use strict';

  var GUEST_PREFS_KEY = 'cuh_guest_prefs_v1';
  var LOCAL_AUTH_KEY = 'cuh_local_auth_v1';
  var LEGACY_ACCOUNTS_KEY = 'cuh_accounts_v1';
  var LEGACY_SESSION_KEY = 'cuh_session_v1';
  var PROFILES_KEY = 'cuh_profiles_v2';
  var SESSION_KEY = 'cuh_session_v2';
  var AUTH_STORAGE_KEY = 'cuh_auth_v2';
  var PROFILE_VERSION = 2;
  // Supabase rejects reserved and non-resolving domains as signup identifiers.
  // Use a hidden plus alias on the site's real contact mailbox; the site never
  // sends account email to it.
  var LOGIN_EMAIL_DOMAIN = 'outlook.com';
  var LOGIN_EMAIL_LOCAL_PREFIX = 'arrestmrmann+u';
  var MAX_HISTORY = 200;
  var MAX_WEBSITES = 40;
  var MAX_BIO_LENGTH = 160;
  var MAX_AVATAR_LENGTH = 500000;
  var MAX_PROGRESS_GAMES = 80;
  var MAX_PROGRESS_KEYS = 120;
  var MAX_PROGRESS_VALUE = 120000;
  var MAX_PROGRESS_GAME_BYTES = 250000;
  var MAX_PROGRESS_TOTAL_BYTES = 1000000;
  var PUSH_DELAY = 900;
  var LOCAL_AUTH_ITERATIONS = 120000;

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
    'sortMethod',
    'carouselAutoplay',
    'reduceMotion',
    'gameGridColumns'
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
    sortMethod: 'default',
    carouselAutoplay: 'true',
    reduceMotion: 'false',
    gameGridColumns: 'auto'
  };

  var APP_IDS = ['discord', 'tiktok', 'youtube'];
  var ACCOUNT_KEYS = [
    LEGACY_ACCOUNTS_KEY,
    LEGACY_SESSION_KEY,
    GUEST_PREFS_KEY,
    LOCAL_AUTH_KEY,
    PROFILES_KEY,
    SESSION_KEY,
    AUTH_STORAGE_KEY
  ];

  var client = null;
  var clientChecked = false;
  var pushTimer = 0;
  var cloudReady = false;

  function readStored(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }

  function writeStored(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (error) { return false; }
  }

  function removeStored(key) {
    try { localStorage.removeItem(key); } catch (error) {}
  }

  function safeParse(value, fallback) {
    try { return JSON.parse(value) || fallback; } catch (error) { return fallback; }
  }

  function cleanText(value, maxLength) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function cleanBio(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_BIO_LENGTH);
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

  // Supabase's email/password endpoint needs an email-shaped identifier even
  // though the site no longer has an email system. Older accounts have a hidden
  // address derived from their original username. New accounts get a random
  // hidden address so a username can be reused after its owner renames without
  // colliding with the old account. Neither form is displayed or mailed.
  function loginEmailForUsername(value) {
    var key = normalizeUsername(value);
    var hex = '';
    for (var i = 0; i < key.length; i++) {
      hex += ('0' + key.charCodeAt(i).toString(16)).slice(-2);
    }
    return LOGIN_EMAIL_LOCAL_PREFIX + hex + '@' + LOGIN_EMAIL_DOMAIN;
  }

  function loginEmailForNewAccount() {
    var hex = '';
    var bytes = new Uint8Array(8);
    try {
      window.crypto.getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
    } catch (error) {
      hex = String(Date.now().toString(16)) + Math.random().toString(16).slice(2, 10);
    }
    return LOGIN_EMAIL_LOCAL_PREFIX + hex.slice(0, 24) + '@' + LOGIN_EMAIL_DOMAIN;
  }

  async function loginResolverAvailable(auth) {
    if (!auth) return false;
    try {
      var result = await auth.rpc('login_email_for_username', { candidate: '__schema_probe__' });
      return !result.error || !missingRpcError(result.error);
    } catch (error) {
      return false;
    }
  }

  function missingRpcError(error) {
    var message = String((error && (error.message || error.error_description)) || '');
    var code = String((error && error.code) || '');
    return code === 'PGRST202' || /could not find the function|function .* does not exist|schema cache/i.test(message);
  }

  async function loginEmailForIdentifier(value) {
    var raw = String(value == null ? '' : value).trim();
    if (raw.indexOf('@') !== -1) {
      var directEmail = cleanEmail(raw);
      return directEmail
        ? { ok: true, email: directEmail }
        : { ok: false, error: 'Enter a valid username.' };
    }
    var check = validateUsername(raw);
    if (!check.ok) return { ok: false, error: 'Enter a valid username.' };
    var auth = authClient();
    if (!auth) return { ok: true, email: loginEmailForUsername(check.key) };

    var result;
    try {
      result = await auth.rpc('login_email_for_username', { candidate: check.username });
    } catch (error) {
      if (missingRpcError(error)) return { ok: true, email: loginEmailForUsername(check.key) };
      return { ok: false, error: 'Could not reach the account server. Check your connection and try again.' };
    }
    if (!result.error) {
      var resolved = cleanEmail(result.data);
      return resolved
        ? { ok: true, email: resolved }
        : { ok: false, error: 'Username or password is incorrect.' };
    }
    if (missingRpcError(result.error)) return { ok: true, email: loginEmailForUsername(check.key) };
    return { ok: false, error: friendlyAuthError(result.error) };
  }

  function normalizeAvatar(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    if (!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(raw)) return '';
    return raw.length <= MAX_AVATAR_LENGTH ? raw : '';
  }

  function cleanProgressKey(value) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 240);
  }

  function normalizeProgressData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    var out = {};
    var total = 0;
    Object.keys(data).slice(0, MAX_PROGRESS_KEYS).forEach(function (rawKey) {
      var key = String(rawKey == null ? '' : rawKey).slice(0, 160);
      if (!key) return;
      var value = data[rawKey];
      if (value === null || value === undefined) return;
      var text = typeof value === 'string' ? value : (typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value));
      if (typeof text !== 'string' || !text.length || text.length > MAX_PROGRESS_VALUE) return;
      if (total + text.length > MAX_PROGRESS_GAME_BYTES) return;
      out[key] = text;
      total += text.length;
    });
    return out;
  }

  function normalizeGameProgress(progress) {
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return {};
    var entries = [];
    Object.keys(progress).forEach(function (rawKey) {
      var key = cleanProgressKey(rawKey);
      if (!key) return;
      var entry = progress[rawKey];
      var data = entry && typeof entry === 'object' && !Array.isArray(entry) && entry.data && typeof entry.data === 'object'
        ? entry.data
        : entry;
      var normalized = normalizeProgressData(data);
      if (!Object.keys(normalized).length) return;
      var updatedAt = entry && entry.updatedAt ? String(entry.updatedAt) : new Date().toISOString();
      if (isNaN(Date.parse(updatedAt))) updatedAt = new Date().toISOString();
      entries.push({ key: key, data: normalized, updatedAt: updatedAt });
    });
    entries.sort(function (a, b) { return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); });
    var out = {};
    var total = 0;
    entries.slice(0, MAX_PROGRESS_GAMES).forEach(function (entry) {
      var size = JSON.stringify(entry.data).length;
      if (total + size > MAX_PROGRESS_TOTAL_BYTES) return;
      out[entry.key] = { data: entry.data, updatedAt: entry.updatedAt };
      total += size;
    });
    return out;
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
    var binary = atob(String(value || ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function constantTimeEqual(a, b) {
    var left = String(a || '');
    var right = String(b || '');
    var diff = left.length ^ right.length;
    var length = Math.min(left.length, right.length);
    for (var i = 0; i < length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
    return diff === 0;
  }

  function readLocalAuth() {
    var data = safeParse(readStored(LOCAL_AUTH_KEY), null);
    if (!data || data.version !== 1 || !data.users || typeof data.users !== 'object') {
      return { version: 1, users: {} };
    }
    return data;
  }

  function writeLocalAuth(registry) {
    try {
      return writeStored(LOCAL_AUTH_KEY, JSON.stringify(registry));
    } catch (error) {
      return false;
    }
  }

  function localAuthFor(identifier) {
    var registry = readLocalAuth();
    var key = normalizeEmail(identifier);
    if (key && registry.users[key]) return registry.users[key];
    var username = normalizeUsername(identifier);
    if (!username) return null;
    var keys = Object.keys(registry.users);
    for (var i = 0; i < keys.length; i++) {
      var record = registry.users[keys[i]];
      if (record && normalizeUsername(record.username) === username) return record;
    }
    return null;
  }

  function localAuthAvailable() {
    return !!(window.crypto && window.crypto.subtle &&
      typeof window.crypto.subtle.deriveBits === 'function' &&
      typeof TextEncoder === 'function' && typeof btoa === 'function' && typeof atob === 'function');
  }

  function isLocalUser(user) {
    return String((user && user.id) || '').indexOf('local-') === 0;
  }

  function localRecordForUser(user) {
    if (!user || !user.id) return null;
    var registry = readLocalAuth();
    var keys = Object.keys(registry.users);
    for (var i = 0; i < keys.length; i++) {
      var record = registry.users[keys[i]];
      if (record && String(record.id) === String(user.id)) return record;
    }
    return null;
  }

  function usernameTakenLocally(username, exceptId) {
    var key = normalizeUsername(username);
    if (!key) return false;
    var profiles = readProfiles();
    var profileIds = Object.keys(profiles.users);
    for (var i = 0; i < profileIds.length; i++) {
      if (exceptId && profileIds[i] === exceptId) continue;
      if (normalizeUsername(profiles.users[profileIds[i]].username) === key) return true;
    }
    var registry = readLocalAuth();
    var keys = Object.keys(registry.users);
    for (var j = 0; j < keys.length; j++) {
      var record = registry.users[keys[j]];
      if (!record || (exceptId && String(record.id) === String(exceptId))) continue;
      if (normalizeUsername(record.username) === key) return true;
    }
    return false;
  }

  async function usernameAvailableOnline(username) {
    var auth = authClient();
    if (!auth) return true;
    var result = await auth.rpc('username_available', { candidate: String(username || '').trim() });
    if (result.error) throw result.error;
    return result.data !== false;
  }

  function newSalt() {
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
  }

  async function hashLocalPassword(password, salt, iterations) {
    var key = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(String(password || '')),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    var bits = await window.crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: base64ToBytes(salt),
      iterations: iterations || LOCAL_AUTH_ITERATIONS,
      hash: 'SHA-256'
    }, key, 256);
    return bytesToBase64(new Uint8Array(bits));
  }

  function blankApps() {
    var apps = {};
    APP_IDS.forEach(function (id) { apps[id] = { handle: '', url: '' }; });
    return apps;
  }

  function normalizeApps(apps) {
    var next = blankApps();
    APP_IDS.forEach(function (id) {
      var item = apps && apps[id];
      if (!item || typeof item !== 'object') return;
      next[id] = {
        handle: cleanText(item.handle, 80),
        url: cleanUrl(item.url)
      };
    });
    return next;
  }

  function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];
    var out = [];
    history.forEach(function (entry) {
      if (!entry || typeof entry !== 'object') return;
      var title = cleanText(entry.title, 160);
      var url = cleanText(entry.url, 2048);
      if (!title && !url) return;
      out.push({
        id: cleanText(entry.id, 80) || randomId(),
        type: ['web', 'app', 'game', 'site'].indexOf(entry.type) !== -1 ? entry.type : 'web',
        title: title || url,
        url: url,
        at: entry.at || new Date().toISOString()
      });
    });
    out.sort(function (a, b) { return new Date(b.at).getTime() - new Date(a.at).getTime(); });
    return out.slice(0, MAX_HISTORY);
  }

  function normalizeWebsites(websites) {
    if (!Array.isArray(websites)) return [];
    return websites.slice(0, MAX_WEBSITES).map(function (entry) {
      if (!entry || typeof entry !== 'object') return null;
      var name = cleanText(entry.name, 60);
      if (!name) return null;
      return {
        id: cleanText(entry.id, 80) || randomId(),
        name: name,
        username: cleanText(entry.username, 80),
        url: cleanUrl(entry.url),
        note: cleanText(entry.note, 200)
      };
    }).filter(Boolean);
  }

  function normalizeUser(user) {
    if (!user || typeof user !== 'object') return user;
    user.history = normalizeHistory(user.history);
    user.websites = normalizeWebsites(user.websites);
    user.apps = normalizeApps(user.apps);
    user.avatar = normalizeAvatar(user.avatar);
    user.bio = cleanBio(user.bio);
    user.gameProgress = normalizeGameProgress(user.gameProgress);
    if (!user.preferences || typeof user.preferences !== 'object') user.preferences = {};
    user.key = normalizeUsername(user.username);
    return user;
  }

  function normalizeProfile(user) {
    return {
      id: String((user && user.id) || ''),
      username: cleanText(user && user.username, 24),
      email: cleanEmail(user && user.email) || normalizeEmail(user && user.email),
      avatar: normalizeAvatar(user && user.avatar),
      bio: cleanBio(user && user.bio),
      gameProgress: normalizeGameProgress(user && user.gameProgress),
      history: normalizeHistory(user && user.history),
      apps: normalizeApps(user && user.apps),
      websites: normalizeWebsites(user && user.websites),
      preferences: user && user.preferences && typeof user.preferences === 'object'
        ? Object.assign({}, user.preferences)
        : {},
      createdAt: (user && user.createdAt) || new Date().toISOString(),
      updatedAt: (user && user.updatedAt) || new Date().toISOString()
    };
  }

  function blankProfile(identity) {
    return {
      id: identity.id,
      username: identity.username,
      email: identity.email,
      avatar: '',
      bio: '',
      gameProgress: {},
      history: [],
      apps: blankApps(),
      websites: [],
      preferences: {},
      createdAt: identity.createdAt,
      updatedAt: new Date().toISOString()
    };
  }

  function emptyProfiles() {
    return { version: PROFILE_VERSION, users: {} };
  }

  function readProfiles() {
    var data = safeParse(readStored(PROFILES_KEY), null);
    if (!data || data.version !== PROFILE_VERSION || !data.users || typeof data.users !== 'object') {
      return emptyProfiles();
    }
    return data;
  }

  function writeProfiles(profiles) {
    try {
      return writeStored(PROFILES_KEY, JSON.stringify(profiles));
    } catch (error) {
      return false;
    }
  }

  function readSession() {
    var data = safeParse(readStored(SESSION_KEY), null);
    if (!data || !data.id) return null;
    return {
      id: String(data.id),
      username: cleanText(data.username, 24),
      email: cleanEmail(data.email) || normalizeEmail(data.email),
      createdAt: data.createdAt || new Date().toISOString()
    };
  }

  function writeSession(identity) {
    return writeStored(SESSION_KEY, JSON.stringify({
      id: identity.id,
      username: identity.username,
      email: identity.email,
      createdAt: identity.createdAt
    }));
  }

  function clearSession() {
    removeStored(SESSION_KEY);
  }

  function getCurrentUser() {
    var identity = readSession();
    if (!identity) return null;
    var profiles = readProfiles();
    var profile = profiles.users[identity.id];
    if (!profile) {
      profile = blankProfile(identity);
      profiles.users[identity.id] = profile;
      writeProfiles(profiles);
    }
    return normalizeUser(Object.assign({}, profile, identity, {
      id: identity.id,
      username: identity.username || profile.username,
      email: identity.email || profile.email,
      createdAt: identity.createdAt || profile.createdAt
    }));
  }

  function emitChange(reason) {
    try {
      window.dispatchEvent(new CustomEvent('cuh-account-change', {
        detail: { reason: reason || 'update', user: getCurrentUser() }
      }));
    } catch (error) {}
  }

  function identityFromAuthUser(authUser) {
    var email = normalizeEmail(authUser && authUser.email);
    var meta = authUser && authUser.user_metadata && typeof authUser.user_metadata === 'object'
      ? authUser.user_metadata
      : {};
    var username = cleanText(meta.username, 24);
    if (!username || !/^[A-Za-z0-9_.-]+$/.test(username)) {
      username = email.split('@')[0].replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 24);
    }
    if (!username) username = 'player';
    return {
      id: String(authUser.id),
      username: username,
      email: email,
      createdAt: authUser.created_at || new Date().toISOString()
    };
  }

  function findLegacyUser(identity) {
    var registry = safeParse(readStored(LEGACY_ACCOUNTS_KEY), null);
    var users = registry && registry.users;
    if (!users || typeof users !== 'object') return null;
    var byName = users[normalizeUsername(identity.username)];
    if (byName) return byName;
    var email = normalizeEmail(identity.email);
    if (!email) return null;
    var keys = Object.keys(users);
    for (var i = 0; i < keys.length; i++) {
      var user = users[keys[i]];
      if (user && normalizeEmail(user.recoveryEmail) === email) return user;
    }
    return null;
  }

  function mergeLegacyProfile(profile, identity) {
    var legacy = findLegacyUser(identity);
    if (!legacy) return false;
    profile.history = normalizeHistory(legacy.history);
    profile.apps = normalizeApps(legacy.apps);
    profile.websites = normalizeWebsites(legacy.websites);
    profile.preferences = legacy.preferences && typeof legacy.preferences === 'object'
      ? Object.assign({}, legacy.preferences)
      : {};
    return true;
  }

  function hasLegacyAccounts() {
    var registry = safeParse(readStored(LEGACY_ACCOUNTS_KEY), null);
    return !!(registry && registry.users && Object.keys(registry.users).length);
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

  function saveGuestPreferences() {
    if (getCurrentUser()) return false;
    try {
      localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(snapshotPreferences()));
      return true;
    } catch (error) {
      return false;
    }
  }

  function applyGuestPreferences() {
    var preferences = safeParse(readStored(GUEST_PREFS_KEY), null);
    applyPreferences(preferences || {});
  }

  function saveUser(user) {
    if (!user || !user.id) return false;
    var profiles = readProfiles();
    var profile = normalizeProfile(user);
    profile.updatedAt = new Date().toISOString();
    profiles.users[user.id] = profile;
    if (!writeProfiles(profiles)) return false;
    var identity = readSession();
    if (identity && identity.id === user.id) {
      identity.username = profile.username;
      identity.email = profile.email;
      identity.createdAt = profile.createdAt;
      writeSession(identity);
    }
    schedulePush();
    emitChange('profile');
    return true;
  }

  function capturePreferences() {
    var user = getCurrentUser();
    if (!user) return false;
    user.preferences = snapshotPreferences();
    return saveUser(user);
  }

  function setApps(apps) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    user.apps = normalizeApps(apps);
    return saveUser(user) ? { ok: true } : { ok: false, error: 'This browser is out of storage.' };
  }

  function setAvatar(dataUrl) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    var raw = String(dataUrl == null ? '' : dataUrl).trim();
    var avatar = normalizeAvatar(raw);
    if (raw && !avatar) {
      return { ok: false, error: 'Choose a JPG, PNG, or WebP image smaller than 500 KB.' };
    }
    user.avatar = avatar;
    return saveUser(user)
      ? { ok: true, avatar: avatar }
      : { ok: false, error: 'This browser is out of storage.' };
  }

  function setBio(value) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    user.bio = cleanBio(value);
    return saveUser(user)
      ? { ok: true, bio: user.bio }
      : { ok: false, error: 'This browser is out of storage.' };
  }

  function isCloudConfigured() {
    return !!authClient();
  }

  async function getAccessToken() {
    var auth = authClient();
    if (!auth) return '';
    try {
      var result = await auth.auth.getSession();
      var session = result && result.data ? result.data.session : null;
      return session && session.access_token ? String(session.access_token) : '';
    } catch (error) {
      return '';
    }
  }

  function usernameChangeError(error) {
    var message = String((error && (error.message || error.error_description)) || '');
    var code = String((error && error.code) || '');
    if (missingRpcError(error)) {
      return 'Username changes are not available yet. The site owner needs to apply the latest database schema.';
    }
    if (code === 'P0001' || /username_change_rate_limited/i.test(message)) {
      return 'You can change your username once every 7 days.';
    }
    if (code === '23505' || /username_taken|duplicate key.*username/i.test(message)) {
      return 'That username is already taken. Pick another one.';
    }
    if (code === '22023' || /invalid_username/i.test(message)) {
      return 'Use 1–24 letters, numbers, periods, dashes, or underscores.';
    }
    if (code === '42501' || /jwt|session|not authenticated|auth required/i.test(message)) {
      return 'Your session expired. Sign in again and retry.';
    }
    return message || 'Could not change your username. Try again.';
  }

  async function setUsername(value) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    var check = validateUsername(value);
    if (!check.ok) return check;
    var local = isLocalUser(user);
    if (usernameTakenLocally(check.username, user.id)) {
      return { ok: false, error: 'That username is already taken. Pick another one.' };
    }

    var serverName = check.username;
    if (!local) {
      var auth = authClient();
      if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };
      if (normalizeUsername(user.username) !== check.key) {
        try {
          var available = await usernameAvailableOnline(check.username);
          if (!available) return { ok: false, error: 'That username is already taken. Pick another one.' };
        } catch (error) {
          return { ok: false, error: 'Could not check whether that username is available. Check your connection and try again.' };
        }
      }
      try {
        var result = await auth.rpc('change_username', { candidate: check.username });
        if (result.error) return { ok: false, error: usernameChangeError(result.error) };
        var returned = String(result.data == null ? '' : result.data).trim();
        if (returned) serverName = cleanText(returned, 24);
      } catch (error) {
        return { ok: false, error: usernameChangeError(error) };
      }
    }

    user.username = serverName;
    if (!saveUser(user)) {
      return { ok: false, error: 'This browser is out of storage.' };
    }
    var registry = readLocalAuth();
    var keys = Object.keys(registry.users);
    for (var i = 0; i < keys.length; i++) {
      var record = registry.users[keys[i]];
      if (record && String(record.id) === String(user.id) && record.username !== serverName) {
        record.username = serverName;
        writeLocalAuth(registry);
        break;
      }
    }

    // Refresh the Supabase session so its stored user metadata matches the
    // database. Without this, reloading could restore the old username from
    // the locally persisted auth session.
    if (!local) {
      try {
        var authClientNow = authClient();
        var refreshed = authClientNow ? await authClientNow.auth.refreshSession() : null;
        var refreshedUser = refreshed && refreshed.data && refreshed.data.session
          ? refreshed.data.session.user
          : null;
        if (refreshedUser) {
          var refreshedName = cleanText(identityFromAuthUser(refreshedUser).username, 24);
          if (refreshedName && normalizeUsername(refreshedName) === normalizeUsername(serverName)) {
            user.username = refreshedName;
            saveUser(user);
          }
        }
      } catch (error) {}
    }
    return { ok: true, username: user.username };
  }

  async function syncNow() {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    if (!authClient()) return { ok: false, error: 'Cloud sync is not configured yet.' };
    var synced = await pushRemoteProfile();
    if (!synced) return { ok: false, error: 'Could not sync your account. Check the connection and try again.' };
    cloudReady = true;
    emitChange('profile');
    return { ok: true };
  }

  function adminError(error) {
    var message = String((error && (error.message || error.error_description)) || '');
    var code = String((error && error.code) || '');
    if (missingRpcError(error)) {
      return 'Owner tools are not available yet. Apply the latest database schema first.';
    }
    if (code === '42501' || /not_authorized|owner access required/i.test(message)) {
      return 'Owner access required.';
    }
    if (code === '23505' || /username_taken|duplicate key.*username/i.test(message)) {
      return 'That username is already taken. Pick another one.';
    }
    if (code === '22023' || /invalid_username|account_not_found|cannot_delete_self|cannot_demote_self/i.test(message)) {
      return /cannot_demote_self/i.test(message)
        ? 'You cannot remove your own owner access.'
        : (/cannot_delete_self/i.test(message)
          ? 'You cannot delete your own owner account here.'
          : 'That account or username is not valid.');
    }
    if (code === 'PGRST301' || /jwt|session expired|not authenticated/i.test(message)) {
      return 'Your session expired. Sign in again and retry.';
    }
    return message || 'The owner action could not be completed.';
  }

  async function adminFetch(path, options) {
    var token = await getAccessToken();
    if (!token) return { ok: false, error: 'Your session expired. Sign in again and retry.' };
    var response;
    try {
      response = await fetch(path, Object.assign({}, options || {}, {
        headers: Object.assign({
          Authorization: 'Bearer ' + token,
          'content-type': 'application/json'
        }, options && options.headers ? options.headers : {}),
        cache: 'no-store',
        credentials: 'same-origin'
      }));
    } catch (error) {
      return { ok: false, error: 'Could not reach the account server. Check your connection and try again.' };
    }
    var data = null;
    try { data = await response.json(); } catch (error) {}
    if (response.status === 401) return { ok: false, error: 'Your session expired. Sign in again and retry.' };
    if (response.status === 403) return { ok: false, error: 'Owner access required.' };
    if (!response.ok) {
      return { ok: false, error: (data && data.error) || 'The owner action could not be completed.' };
    }
    return { ok: true, data: data || {} };
  }

  async function pointsFetch(path, options) {
    var token = await getAccessToken();
    if (!token) return { ok: false, error: 'Sign in with an online account to use points.' };
    var response;
    try {
      response = await fetch(path, Object.assign({}, options || {}, {
        headers: Object.assign({
          Authorization: 'Bearer ' + token,
          'content-type': 'application/json'
        }, options && options.headers ? options.headers : {}),
        cache: 'no-store',
        credentials: 'same-origin'
      }));
    } catch (error) {
      return { ok: false, error: 'Could not reach the points server. Check your connection and try again.' };
    }
    var data = null;
    try { data = await response.json(); } catch (error) {}
    if (response.status === 401) return { ok: false, error: 'Your session expired. Sign in again and try again.' };
    if (!response.ok) return { ok: false, error: (data && data.error) || 'The points action could not be completed.' };
    return { ok: true, data: data || {} };
  }

  async function pointsSummary() {
    return pointsFetch('/api/points', { method: 'GET' });
  }

  async function claimDailyPoints() {
    return pointsFetch('/api/points/claim', { method: 'POST', body: '{}' });
  }

  async function payPoints(to, amount) {
    var target = String(to == null ? '' : to).trim().replace(/^@+/, '');
    var value = Number(amount);
    if (!target) return { ok: false, error: 'Enter the username you want to pay.' };
    if (!Number.isInteger(value) || value < 1) return { ok: false, error: 'Choose a whole number of points to send.' };
    return pointsFetch('/api/points/pay', {
      method: 'POST',
      body: JSON.stringify({ to: target, amount: value })
    });
  }

  async function adminAdjustPoints(targetId, targetUsername, amount) {
    var value = Number(amount);
    if (!Number.isInteger(value) || value === 0) return { ok: false, error: 'Choose a non-zero whole number of points.' };
    return pointsFetch('/api/points/admin', {
      method: 'POST',
      body: JSON.stringify({
        targetId: String(targetId || '').trim(),
        targetUsername: String(targetUsername || '').trim(),
        amount: value
      })
    });
  }

  async function adminStatus() {
    var result = await adminFetch('/api/admin/status', { method: 'GET' });
    if (!result.ok) return { ok: false, owner: false, error: result.error };
    return { ok: true, owner: result.data.owner === true };
  }

  async function adminListAccounts() {
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };
    var result;
    try {
      result = await auth.rpc('site_admin_list_accounts');
    } catch (error) {
      return { ok: false, error: adminError(error) };
    }
    if (result.error) return { ok: false, error: adminError(result.error) };
    var rows = Array.isArray(result.data) ? result.data : [];
    return {
      ok: true,
      accounts: rows.map(function (row) {
        return {
          id: String(row && row.id || ''),
          username: cleanText(row && row.username, 24),
          createdAt: row && row.created_at || '',
          lastSignInAt: row && row.last_sign_in_at || '',
          isAdmin: !!(row && row.is_admin)
        };
      }).filter(function (row) { return !!row.id; })
    };
  }

  function removeCachedAccount(userId) {
    var id = String(userId || '');
    if (!id) return;
    var profiles = readProfiles();
    if (profiles.users && profiles.users[id]) {
      delete profiles.users[id];
      writeProfiles(profiles);
    }
    var registry = readLocalAuth();
    var changed = false;
    Object.keys(registry.users || {}).forEach(function (key) {
      var record = registry.users[key];
      if (record && String(record.id) === id) {
        delete registry.users[key];
        changed = true;
      }
    });
    if (changed) writeLocalAuth(registry);
  }

  async function adminSetAdmin(targetId, makeAdmin) {
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };
    var target = String(targetId || '').trim();
    if (!target) return { ok: false, error: 'Choose an account.' };
    var result;
    try {
      result = await auth.rpc('site_admin_set', { target: target, make_admin: !!makeAdmin });
    } catch (error) {
      return { ok: false, error: adminError(error) };
    }
    if (result.error) return { ok: false, error: adminError(result.error) };
    return { ok: true, isAdmin: !!makeAdmin };
  }

  async function adminChangeUsername(targetId, value) {
    var check = validateUsername(value);
    if (!check.ok) return check;
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };
    var target = String(targetId || '').trim();
    if (!target) return { ok: false, error: 'Choose an account.' };
    var result;
    try {
      result = await auth.rpc('site_admin_change_username', { target: target, candidate: check.username });
    } catch (error) {
      return { ok: false, error: adminError(error) };
    }
    if (result.error) return { ok: false, error: adminError(result.error) };
    var serverName = cleanText(result.data, 24) || check.username;
    var profiles = readProfiles();
    if (profiles.users && profiles.users[target]) {
      profiles.users[target].username = serverName;
      writeProfiles(profiles);
    }
    return { ok: true, username: serverName };
  }

  async function adminDeleteMessage(messageId, peerId) {
    var id = String(messageId || '').trim();
    if (!id) return { ok: false, error: 'Message not found.' };
    var result = await adminFetch('/api/chat/admin/delete-message', {
      method: 'POST',
      body: JSON.stringify({ messageId: id, peer: String(peerId || '') })
    });
    if (!result.ok) return result;
    return { ok: true };
  }

  async function adminDeleteAccount(targetId) {
    var target = String(targetId || '').trim();
    if (!target) return { ok: false, error: 'Choose an account.' };
    var purge = await adminFetch('/api/chat/admin/purge-user', {
      method: 'POST',
      body: JSON.stringify({ userId: target })
    });
    if (!purge.ok) return purge;
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };
    var result;
    try {
      result = await auth.rpc('site_admin_delete_account', { target: target });
    } catch (error) {
      return { ok: false, error: adminError(error) + ' Chat data was already removed.' };
    }
    if (result.error) return { ok: false, error: adminError(result.error) + ' Chat data was already removed.' };
    removeCachedAccount(target);
    return { ok: true };
  }

  function getGameProgress(gameId) {
    var user = getCurrentUser();
    var key = cleanProgressKey(gameId);
    var entry = user && user.gameProgress ? user.gameProgress[key] : null;
    return entry && entry.data ? Object.assign({}, entry.data) : {};
  }

  function setGameProgress(gameId, data) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    var key = cleanProgressKey(gameId);
    if (!key) return { ok: false, error: 'Invalid game.' };
    var progress = normalizeGameProgress(user.gameProgress);
    var normalized = normalizeProgressData(data);
    if (Object.keys(normalized).length) {
      progress[key] = { data: normalized, updatedAt: new Date().toISOString() };
    } else {
      delete progress[key];
    }
    user.gameProgress = normalizeGameProgress(progress);
    if (!saveUser(user)) return { ok: false, error: 'This browser is out of storage.' };
    return { ok: true };
  }

  function clearGameProgress(gameId) {
    var user = getCurrentUser();
    if (!user) return false;
    var key = cleanProgressKey(gameId);
    if (!key) return false;
    var progress = normalizeGameProgress(user.gameProgress);
    delete progress[key];
    user.gameProgress = progress;
    return saveUser(user);
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
    user.websites = user.websites.slice(0, MAX_WEBSITES);
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

  function profilePayload(user) {
    var preferences = Object.assign({}, user.preferences || {});
    // Keep multi-hundred-kilobyte logos local instead of uploading them on
    // every history change.
    if (preferences.customLogo && preferences.customLogo.length > 120000) delete preferences.customLogo;
    return {
      id: user.id,
      username: user.username,
      data: {
        history: user.history || [],
        apps: user.apps || {},
        websites: user.websites || [],
        avatar: user.avatar || '',
        bio: user.bio || '',
        gameProgress: user.gameProgress || {},
        preferences: preferences
      },
      updated_at: new Date().toISOString()
    };
  }

  function pushProfileNow(user) {
    var auth = authClient();
    if (!auth || !user || isLocalUser(user)) return;
    try {
      Promise.resolve(auth.from('profiles').upsert(profilePayload(user), { onConflict: 'id' }))
        .then(function (result) {
          if (!result || !result.error) cloudReady = true;
        })
        .catch(function () {});
    } catch (error) {}
  }

  function schedulePush(delay) {
    var user = getCurrentUser();
    if (!authClient() || !user || isLocalUser(user)) return;
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(function () {
      pushRemoteProfile();
    }, typeof delay === 'number' ? delay : PUSH_DELAY);
  }

  async function pushRemoteProfile() {
    var auth = authClient();
    var user = getCurrentUser();
    if (!auth || !user || isLocalUser(user)) return false;
    try {
      var result = await auth.from('profiles').upsert(profilePayload(user), { onConflict: 'id' });
      if (!result.error) {
        cloudReady = true;
        return true;
      }
    } catch (error) {}
    return false;
  }

  async function pullRemoteProfile(authUser) {
    var auth = authClient();
    if (!auth || !authUser) return null;
    try {
      var result = await auth.from('profiles')
        .select('username,data,updated_at')
        .eq('id', authUser.id)
        .maybeSingle();
      if (result.error || !result.data) return null;
      return result.data;
    } catch (error) {
      return null;
    }
  }

  function mergeRemoteProfile(local, remote, identity) {
    var data = remote && remote.data && typeof remote.data === 'object' ? remote.data : {};
    var remoteUsername = cleanText(remote && remote.username, 24);
    if (!remoteUsername || !/^[A-Za-z0-9_.-]+$/.test(remoteUsername)) {
      remoteUsername = identity.username;
    }
    return normalizeProfile({
      id: identity.id,
      username: remoteUsername,
      email: identity.email,
      createdAt: identity.createdAt,
      updatedAt: remote.updated_at || new Date().toISOString(),
      history: Array.isArray(data.history) ? data.history : local.history,
      apps: data.apps && typeof data.apps === 'object' ? data.apps : local.apps,
      websites: Array.isArray(data.websites) ? data.websites : local.websites,
      avatar: data.avatar !== undefined ? data.avatar : local.avatar,
      bio: data.bio !== undefined ? data.bio : local.bio,
      gameProgress: data.gameProgress !== undefined ? data.gameProgress : local.gameProgress,
      preferences: data.preferences && typeof data.preferences === 'object' ? data.preferences : local.preferences
    });
  }

  async function adoptSession(authUser, reason) {
    if (!authUser || !authUser.id) return getCurrentUser();
    var identity = identityFromAuthUser(authUser);
    var profiles = readProfiles();
    var profile = profiles.users[identity.id];
    var fresh = !profile;
    if (!profile) {
      profile = blankProfile(identity);
      mergeLegacyProfile(profile, identity);
    }
    profile = normalizeProfile(Object.assign({}, profile, identity, {
      id: identity.id,
      username: identity.username,
      email: identity.email,
      createdAt: identity.createdAt
    }));
    profiles.users[identity.id] = profile;
    writeProfiles(profiles);
    writeSession(identity);
    emitChange(reason || 'restore');

    var remote = await pullRemoteProfile(authUser);
    if (remote) {
      var next = readProfiles();
      var local = next.users[identity.id] || profile;
      var merged = mergeRemoteProfile(local, remote, identity);
      next.users[identity.id] = merged;
      writeProfiles(next);
      if (merged.username && merged.username !== identity.username) {
        writeSession({
          id: identity.id,
          username: merged.username,
          email: identity.email,
          createdAt: identity.createdAt
        });
      }
      cloudReady = true;
      emitChange('profile');
    } else if (fresh) {
      schedulePush(0);
    }
    return getCurrentUser();
  }

  function adoptQuietly(authUser, reason) {
    adoptSession(authUser, reason).catch(function () {});
  }

  function localIdentity(record) {
    return {
      id: String(record.id),
      username: cleanText(record.username, 24),
      email: normalizeEmail(record.email),
      createdAt: record.createdAt || new Date().toISOString()
    };
  }

  function ensureLocalProfile(identity) {
    var profiles = readProfiles();
    var profile = profiles.users[identity.id];
    if (!profile) {
      profile = blankProfile(identity);
      if (!mergeLegacyProfile(profile, identity)) {
        profile.preferences = snapshotPreferences();
      }
      profiles.users[identity.id] = normalizeProfile(profile);
      writeProfiles(profiles);
      profile = normalizeProfile(profiles.users[identity.id]);
    }
    return profile;
  }

  function beginLocalSession(identity, reason) {
    var profile = ensureLocalProfile(identity);
    writeSession(identity);
    if (profile && profile.preferences && Object.keys(profile.preferences).length) {
      applyPreferences(profile.preferences);
    }
    emitChange(reason);
    return getCurrentUser();
  }

  function friendlyAuthError(error) {
    var message = String((error && (error.message || error.error_description)) || '');
    var code = String((error && error.code) || '');
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
      return 'Username or password is incorrect.';
    }
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
      return 'This account still needs email confirmation. Email verification has been removed; contact the site owner.';
    }
    if (code === 'username_taken' || /username_taken|duplicate key.*username/i.test(message)) {
      return 'That username is already taken. Pick another one.';
    }
    if (/database error saving new user/i.test(message)) {
      return 'That username is already taken. Try signing in instead.';
    }
    if (/already confirmed/i.test(message)) {
      return 'That email is already verified. Sign in instead.';
    }
    if (code === 'user_already_exists' || code === 'email_exists' || /already registered|already been registered/i.test(message)) {
      return 'That username is already taken. Sign in instead.';
    }
    if (code === 'weak_password' || /password should be at least/i.test(message)) {
      return 'Use a password with at least 6 characters.';
    }
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit|too many/i.test(message)) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    if (code === 'otp_expired' || code === 'invalid_otp' || /token has expired|invalid.*(?:otp|token)|(?:otp|token).*(?:expired|invalid)/i.test(message)) {
      return 'That code is incorrect or has expired. Check the email or request a new code.';
    }
    if (code === 'same_password' || /different from the old password|same password/i.test(message)) {
      return 'Choose a password you have not used before.';
    }
    if (code === 'email_address_not_authorized' || /email address not authorized|email.*not authorized/i.test(message)) {
      return 'This project cannot deliver email to that address yet. Add a custom SMTP provider in Supabase, or ask the site owner to authorize the address.';
    }
    if (/redirect.*not allowed|url.*not allowed/i.test(message)) {
      return 'This site address is not allowed for email links yet. Add it in Supabase Auth URL Configuration.';
    }
    if (/auth session missing|session.*missing/i.test(message)) {
      return 'That reset link has expired. Send yourself a new one.';
    }
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return 'Could not reach the account server. Check your connection and try again.';
    }
    if (code === 'email_address_invalid' || /email.*invalid/i.test(message)) {
      return 'The account service rejected the login identifier. Please contact the site owner.';
    }
    return message || 'The account server returned an error. Try again.';
  }

  function authClient() {
    if (client) return client;
    if (clientChecked) return null;
    clientChecked = true;
    var config = window.CUH_AUTH_CONFIG || {};
    var url = String(config.supabaseUrl || '').trim().replace(/\/+$/, '');
    var key = String(config.supabaseAnonKey || '').trim();
    if (!url || !key || !window.supabase || typeof window.supabase.createClient !== 'function') {
      if (window.CUH_AUTH_CONFIG) {
        console.warn('Online accounts are not configured. Add the Supabase URL and anon key in js/auth-config.js.');
      }
      return null;
    }
    try {
      client = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: AUTH_STORAGE_KEY,
          flowType: 'implicit'
        }
      });
    } catch (error) {
      client = null;
      return null;
    }

    try {
      client.auth.onAuthStateChange(function (event, session) {
        window.setTimeout(function () {
          if (session && session.user) {
            if (event !== 'TOKEN_REFRESHED' || !readSession()) {
              adoptQuietly(session.user, event === 'SIGNED_IN' ? 'signin' : 'restore');
            }
            return;
          }
          if (event === 'SIGNED_OUT' && readSession()) {
            clearSession();
            applyGuestPreferences();
            emitChange('signout');
          }
        }, 0);
      });
    } catch (error) {}

    try {
      Promise.resolve(client.auth.getSession()).then(function (result) {
        var session = result && result.data ? result.data.session : null;
        if (session && session.user) {
          adoptQuietly(session.user, 'restore');
        } else if (readSession()) {
          clearSession();
          applyGuestPreferences();
          emitChange('signout');
        }
      }).catch(function () {});
    } catch (error) {}

    return client;
  }

  async function createAccount(input) {
    var check = validateUsername(input && input.username);
    if (!check.ok) return check;
    var password = String(input && input.password != null ? input.password : '');
    if (password.length < 6) return { ok: false, error: 'Use a password with at least 6 characters.' };
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };

    if (usernameTakenLocally(check.username)) {
      return { ok: false, error: 'That username is already taken. Pick another one.' };
    }
    try {
      var onlineAvailable = await usernameAvailableOnline(check.username);
      if (!onlineAvailable) return { ok: false, error: 'That username is already taken. Pick another one.' };
    } catch (error) {
      return { ok: false, error: 'Could not check whether that username is available. Check your connection and try again.' };
    }

    var signupEmail = loginEmailForUsername(check.key);
    if (await loginResolverAvailable(auth)) signupEmail = loginEmailForNewAccount();
    var result;
    try {
      result = await auth.auth.signUp({
        email: signupEmail,
        password: password,
        options: { data: { username: check.username } }
      });
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
    if (result.error) return { ok: false, error: friendlyAuthError(result.error) };
    var data = result.data || {};
    if (!data.session) {
      return { ok: false, error: 'Account created, but sign-in could not start. Email confirmation must be disabled in Supabase for username accounts.' };
    }
    var authUser = data.user || (data.session && data.session.user);
    if (!authUser) return { ok: false, error: 'Could not start a session. Try again.' };
    var user = await adoptSession(authUser, 'signup');
    return { ok: true, user: user };
  }

  async function signIn(identifier, password) {
    var raw = String(identifier == null ? '' : identifier).trim();
    if (!raw) return { ok: false, error: 'Enter your username.' };
    if (!password) return { ok: false, error: 'Enter your password.' };
    var resolved = await loginEmailForIdentifier(raw);
    if (!resolved.ok) return resolved;
    var email = resolved.email;
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };

    var result;
    try {
      result = await auth.auth.signInWithPassword({ email: email, password: String(password) });
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
    if (result.error) return { ok: false, error: friendlyAuthError(result.error) };
    var data = result.data || {};
    var authUser = data.user || (data.session && data.session.user);
    if (!authUser) return { ok: false, error: 'Could not start a session. Try again.' };
    var user = await adoptSession(authUser, 'signin');
    return { ok: true, user: user };
  }

  function signOut() {
    var user = getCurrentUser();
    if (user) {
      user.preferences = snapshotPreferences();
      saveUser(user);
      pushProfileNow(user);
    }
    clearSession();
    var auth = authClient();
    if (auth) {
      try { Promise.resolve(auth.auth.signOut()).catch(function () {}); } catch (error) {}
    }
    applyGuestPreferences();
    emitChange('signout');
  }

  function purgeLocalAccount(user) {
    var profiles = readProfiles();
    if (profiles.users && profiles.users[user.id]) {
      delete profiles.users[user.id];
      writeProfiles(profiles);
    }
    var registry = readLocalAuth();
    var changed = false;
    Object.keys(registry.users || {}).forEach(function (key) {
      var record = registry.users[key];
      if (record && String(record.id) === String(user.id)) {
        delete registry.users[key];
        changed = true;
      }
    });
    if (changed) writeLocalAuth(registry);
    clearSession();
    removeStored(AUTH_STORAGE_KEY);
    var auth = authClient();
    if (auth) {
      try { Promise.resolve(auth.auth.signOut({ scope: 'local' })).catch(function () {}); } catch (error) {}
    }
    applyGuestPreferences();
    emitChange('delete');
  }

  function deleteAccountError(error) {
    var message = String((error && (error.message || error.error_description)) || '');
    var code = String((error && error.code) || '');
    if (code === 'PGRST202' || /could not find the function|function .* does not exist|schema cache/i.test(message)) {
      return 'Account deletion is not available yet. Contact the site owner.';
    }
    if (code === 'PGRST301' || /jwt|session|not authenticated|auth required/i.test(message)) {
      return 'Your session expired. Sign in again and retry.';
    }
    return 'Could not delete your account. Try again.';
  }

  async function purgeChatMessages() {
    var token = await getAccessToken();
    if (!token) return { ok: false, error: 'Your session expired. Sign in again and retry.' };
    var response;
    try {
      response = await fetch('/api/chat/purge', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
        credentials: 'same-origin'
      });
    } catch (error) {
      return { ok: false, error: 'Could not reach chat to remove your messages. Check your connection and try again.' };
    }
    if (response.status === 401) {
      return { ok: false, error: 'Your session expired. Sign in again and retry.' };
    }
    if (!response.ok) {
      return { ok: false, error: 'Could not remove your chat messages. Try again.' };
    }
    return { ok: true };
  }

  async function deleteAccount() {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    if (isLocalUser(user)) {
      purgeLocalAccount(user);
      return { ok: true };
    }
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };
    var chatPurge = await purgeChatMessages();
    if (!chatPurge.ok) return chatPurge;
    var result;
    try {
      result = await auth.rpc('delete_own_account');
    } catch (error) {
      return { ok: false, error: deleteAccountError(error) };
    }
    if (result.error) {
      return { ok: false, error: deleteAccountError(result.error) + ' Your chat messages were removed.' };
    }
    purgeLocalAccount(user);
    return { ok: true };
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
      var value = readStored(key);
      if (value !== null) snapshot[key] = value;
    });
    return snapshot;
  }

  function restoreAccountKeys(snapshot) {
    Object.keys(snapshot || {}).forEach(function (key) {
      if (!isAccountKey(key)) return;
      writeStored(key, snapshot[key]);
    });
  }

  window.CoolAccountStore = {
    keys: {
      accounts: PROFILES_KEY,
      session: SESSION_KEY,
      guestPreferences: GUEST_PREFS_KEY
    },
    appIds: APP_IDS.slice(),
    preferenceKeys: PREF_KEYS.slice(),
    getCurrentUser: getCurrentUser,
    getUserCount: function () { return Object.keys(readProfiles().users).length; },
    createAccount: createAccount,
    signIn: signIn,
    isLocalAccount: isLocalUser,
    signOut: signOut,
    deleteAccount: deleteAccount,
    saveGuestPreferences: saveGuestPreferences,
    applyPreferences: applyPreferences,
    applyGuestPreferences: applyGuestPreferences,
    capturePreferences: capturePreferences,
    snapshotPreferences: snapshotPreferences,
    setApps: setApps,
    setAvatar: setAvatar,
    setBio: setBio,
    setUsername: setUsername,
    pointsSummary: pointsSummary,
    claimDailyPoints: claimDailyPoints,
    payPoints: payPoints,
    adminAdjustPoints: adminAdjustPoints,
    adminStatus: adminStatus,
    adminListAccounts: adminListAccounts,
    adminChangeUsername: adminChangeUsername,
    adminSetAdmin: adminSetAdmin,
    adminDeleteAccount: adminDeleteAccount,
    adminDeleteMessage: adminDeleteMessage,
    isCloudConfigured: isCloudConfigured,
    getAccessToken: getAccessToken,
    syncNow: syncNow,
    getGameProgress: getGameProgress,
    setGameProgress: setGameProgress,
    clearGameProgress: clearGameProgress,
    addWebsite: addWebsite,
    removeWebsite: removeWebsite,
    addHistory: addHistory,
    clearHistory: clearHistory,
    hasLegacyAccounts: hasLegacyAccounts,
    cloudSyncEnabled: function () { return cloudReady; },
    redactStorageSnapshot: redactStorageSnapshot,
    isAccountKey: isAccountKey,
    snapshotAccountKeys: snapshotAccountKeys,
    restoreAccountKeys: restoreAccountKeys
  };

  // Apply the signed-in account's preferences before main.js initializes settings.
  try {
    var initialUser = getCurrentUser();
    if (initialUser) applyPreferences(initialUser.preferences);
  } catch (error) {}

  try { authClient(); } catch (error) {}
})();
