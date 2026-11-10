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
  var RECOVERY_FLAG_KEY = 'cuh_recovery_pending_v1';
  var PROFILE_VERSION = 2;
  var MAX_HISTORY = 200;
  var MAX_WEBSITES = 40;
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
    'popupAdsDisabled',
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
    popupAdsDisabled: 'false',
    lastSearchTerm: '',
    sortMethod: 'default'
  };

  var APP_IDS = ['discord', 'tiktok', 'youtube'];
  var ACCOUNT_KEYS = [
    LEGACY_ACCOUNTS_KEY,
    LEGACY_SESSION_KEY,
    GUEST_PREFS_KEY,
    LOCAL_AUTH_KEY,
    PROFILES_KEY,
    SESSION_KEY,
    AUTH_STORAGE_KEY,
    RECOVERY_FLAG_KEY
  ];

  var client = null;
  var clientChecked = false;
  var pushTimer = 0;
  var cloudReady = false;
  var recoveryPending = false;

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

  async function setUsername(value) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    var check = validateUsername(value);
    if (!check.ok) return check;
    var local = isLocalUser(user);
    if (usernameTakenLocally(check.username, user.id)) {
      return { ok: false, error: 'That username is already taken. Pick another one.' };
    }
    if (normalizeUsername(user.username) !== check.key) {
      try {
        var available = await usernameAvailableOnline(check.username);
        if (!available) return { ok: false, error: 'That username is already taken. Pick another one.' };
      } catch (error) {
        if (!local) {
          return { ok: false, error: 'Could not check whether that username is available. Check your connection and try again.' };
        }
      }
    }
    var auth = authClient();
    if (!local && auth) {
      try {
        var result = await auth.auth.updateUser({ data: { username: check.username } });
        if (result.error) return { ok: false, error: friendlyAuthError(result.error) };
      } catch (error) {
        return { ok: false, error: friendlyAuthError(error) };
      }
    }
    user.username = check.username;
    if (!saveUser(user)) {
      return { ok: false, error: 'This browser is out of storage.' };
    }
    var registry = readLocalAuth();
    var keys = Object.keys(registry.users);
    for (var i = 0; i < keys.length; i++) {
      var record = registry.users[keys[i]];
      if (record && String(record.id) === String(user.id) && record.username !== check.username) {
        record.username = check.username;
        writeLocalAuth(registry);
        break;
      }
    }
    return { ok: true, username: check.username };
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
    return normalizeProfile({
      id: identity.id,
      username: identity.username,
      email: identity.email,
      createdAt: identity.createdAt,
      updatedAt: remote.updated_at || new Date().toISOString(),
      history: Array.isArray(data.history) ? data.history : local.history,
      apps: data.apps && typeof data.apps === 'object' ? data.apps : local.apps,
      websites: Array.isArray(data.websites) ? data.websites : local.websites,
      avatar: data.avatar !== undefined ? data.avatar : local.avatar,
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
      next.users[identity.id] = mergeRemoteProfile(local, remote, identity);
      writeProfiles(next);
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

  async function createLocalAccount(check, email, password) {
    if (!localAuthAvailable()) {
      return { ok: false, error: 'Accounts need a secure connection in this browser.' };
    }
    var registry = readLocalAuth();
    var profiles = readProfiles();
    var name = normalizeUsername(check.username);
    var emailTaken = !!email && Object.keys(registry.users).some(function (key) {
      var record = registry.users[key];
      return record && normalizeEmail(record.email) === email;
    });
    if (emailTaken) {
      return { ok: false, error: 'An account with that email already exists in this browser. Sign in instead.' };
    }
    var taken = Object.keys(profiles.users).some(function (id) {
      return normalizeUsername(profiles.users[id].username) === name;
    }) || Object.keys(registry.users).some(function (key) {
      return normalizeUsername(registry.users[key].username) === name;
    });
    if (taken) {
      return { ok: false, error: 'That username is already taken. Pick another one.' };
    }
    var salt = newSalt();
    var hash;
    try {
      hash = await hashLocalPassword(password, salt, LOCAL_AUTH_ITERATIONS);
    } catch (error) {
      return { ok: false, error: 'Could not secure that password in this browser. Try again.' };
    }
    var identity = {
      id: 'local-' + randomId(),
      username: check.username,
      email: email,
      createdAt: new Date().toISOString()
    };
    var key = email || ('user:' + name);
    registry.users[key] = {
      id: identity.id,
      username: identity.username,
      email: identity.email,
      salt: salt,
      hash: hash,
      iterations: LOCAL_AUTH_ITERATIONS,
      createdAt: identity.createdAt
    };
    if (!writeLocalAuth(registry)) {
      return { ok: false, error: 'This browser is out of storage.' };
    }
    return { ok: true, needsConfirmation: false, localOnly: true, user: beginLocalSession(identity, 'signup') };
  }

  async function signInLocal(email, password) {
    if (!localAuthAvailable()) {
      return { ok: false, error: 'Accounts need a secure connection in this browser.' };
    }
    var record = localAuthFor(email);
    if (!record) {
      return { ok: false, error: 'No account with that email or username is saved in this browser.' };
    }
    var hash;
    try {
      hash = await hashLocalPassword(password, record.salt, record.iterations || LOCAL_AUTH_ITERATIONS);
    } catch (error) {
      return { ok: false, error: 'Could not verify that password in this browser. Try again.' };
    }
    if (!constantTimeEqual(hash, record.hash)) {
      return { ok: false, error: 'Incorrect password.' };
    }
    return { ok: true, user: beginLocalSession(localIdentity(record), 'signin') };
  }

  function setRecoveryFlag() {
    recoveryPending = true;
    try { sessionStorage.setItem(RECOVERY_FLAG_KEY, '1'); } catch (error) {}
  }

  function clearRecoveryFlag() {
    recoveryPending = false;
    try { sessionStorage.removeItem(RECOVERY_FLAG_KEY); } catch (error) {}
  }

  function isRecoveryPending() {
    if (recoveryPending) return true;
    try {
      if (sessionStorage.getItem(RECOVERY_FLAG_KEY) === '1') {
        recoveryPending = true;
      }
    } catch (error) {}
    return recoveryPending;
  }

  function siteUrl() {
    var configured = String((window.CUH_AUTH_CONFIG || {}).siteUrl || '').trim();
    if (configured) return configured.replace(/\/+$/, '') + '/';
    return location.origin + location.pathname.replace(/[^/]*$/, '');
  }

  function friendlyAuthError(error) {
    var message = String((error && (error.message || error.error_description)) || '');
    var code = String((error && error.code) || '');
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
      return 'Email or password is incorrect.';
    }
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
      return 'Confirm your email first. Enter the verification code from your inbox.';
    }
    if (code === 'username_taken' || /username_taken|duplicate key.*username/i.test(message)) {
      return 'That username is already taken. Pick another one.';
    }
    if (/database error saving new user/i.test(message)) {
      return 'That email or username is already in use. Try signing in instead.';
    }
    if (/already confirmed/i.test(message)) {
      return 'That email is already verified. Sign in instead.';
    }
    if (code === 'user_already_exists' || code === 'email_exists' || /already registered|already been registered/i.test(message)) {
      return 'An account with that email already exists. Sign in instead.';
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
    if (/redirect.*not allowed|url.*not allowed/i.test(message)) {
      return 'This site address is not allowed for email links yet. Add it in Supabase Auth URL Configuration.';
    }
    if (/auth session missing|session.*missing/i.test(message)) {
      return 'That reset link has expired. Send yourself a new one.';
    }
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return 'Could not reach the account server. Check your connection and try again.';
    }
    if (/email.*invalid/i.test(message)) {
      return 'Enter a valid email address.';
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
          if (event === 'PASSWORD_RECOVERY') setRecoveryFlag();
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
    var rawEmail = String(input && input.email != null ? input.email : '').trim();
    var email = cleanEmail(rawEmail);
    if (rawEmail && !email) {
      return { ok: false, error: 'Enter a valid email address, or leave it blank to use a browser-only account.' };
    }
    var password = String(input && input.password != null ? input.password : '');
    if (password.length < 6) return { ok: false, error: 'Use a password with at least 6 characters.' };
    var auth = authClient();
    if (!auth) return createLocalAccount(check, email, password);

    if (!email) {
      // No-email accounts stay in this browser until the user verifies an
      // email. Best-effort check so a browser account cannot shadow an online
      // username when the network is available.
      try {
        var localAvailable = await usernameAvailableOnline(check.username);
        if (!localAvailable) return { ok: false, error: 'That username is already taken. Pick another one.' };
      } catch (error) {}
      return createLocalAccount(check, '', password);
    }

    if (usernameTakenLocally(check.username)) {
      return { ok: false, error: 'That username is already taken. Pick another one.' };
    }
    try {
      var onlineAvailable = await usernameAvailableOnline(check.username);
      if (!onlineAvailable) return { ok: false, error: 'That username is already taken. Pick another one.' };
    } catch (error) {
      return { ok: false, error: 'Could not check whether that username is available. Check your connection and try again.' };
    }

    var result;
    try {
      result = await auth.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { username: check.username },
          emailRedirectTo: siteUrl() + '?account=confirmed'
        }
      });
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
    if (result.error) return { ok: false, error: friendlyAuthError(result.error) };
    var data = result.data || {};
    if (!data.session) {
      return { ok: true, needsConfirmation: true, email: email, user: null };
    }
    var authUser = data.user || (data.session && data.session.user);
    var user = await adoptSession(authUser, 'signup');
    return { ok: true, needsConfirmation: false, user: user };
  }

  async function signIn(identifier, password) {
    var raw = String(identifier == null ? '' : identifier).trim();
    if (!raw) return { ok: false, error: 'Enter your email or username.' };
    if (!password) return { ok: false, error: 'Enter your password.' };
    var local = localAuthFor(raw);
    if (local) return signInLocal(raw, String(password));
    var auth = authClient();
    var clean = cleanEmail(raw);
    if (!auth) {
      return {
        ok: false,
        error: clean
          ? 'No browser account with that email is saved in this browser.'
          : 'No browser account with that username is saved in this browser.'
      };
    }
    if (!clean) {
      return { ok: false, error: 'Online accounts sign in with their email address. Browser-only accounts use their username.' };
    }

    var result;
    try {
      result = await auth.auth.signInWithPassword({ email: clean, password: String(password) });
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
    if (result.error) {
      var message = String(result.error.message || '');
      if (result.error.code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
        return {
          ok: false,
          needsConfirmation: true,
          email: clean,
          error: 'This email still needs a verification code. Enter the code from your inbox or resend one below.'
        };
      }
      return { ok: false, error: friendlyAuthError(result.error) };
    }
    var data = result.data || {};
    var authUser = data.user || (data.session && data.session.user);
    if (!authUser) return { ok: false, error: 'Could not start a session. Try again.' };
    var user = await adoptSession(authUser, 'signin');
    return { ok: true, user: user };
  }

  async function finishLocalUpgrade(authUser, localId, username) {
    var localProfile = localId ? (readProfiles().users[localId] || null) : null;
    await adoptSession(authUser, 'signup');
    var newUser = getCurrentUser();
    if (!localProfile || !newUser || isLocalUser(newUser)) return newUser;
    var merged = normalizeProfile(Object.assign({}, newUser, {
      username: cleanText(username, 24) || localProfile.username || newUser.username,
      email: newUser.email,
      avatar: localProfile.avatar,
      gameProgress: localProfile.gameProgress,
      history: localProfile.history,
      apps: localProfile.apps,
      websites: localProfile.websites,
      preferences: localProfile.preferences,
      createdAt: localProfile.createdAt || newUser.createdAt
    }));
    var profiles = readProfiles();
    profiles.users[newUser.id] = merged;
    delete profiles.users[localId];
    writeProfiles(profiles);
    var registry = readLocalAuth();
    var keys = Object.keys(registry.users);
    for (var i = 0; i < keys.length; i++) {
      if (String(registry.users[keys[i]].id) === String(localId)) delete registry.users[keys[i]];
    }
    writeLocalAuth(registry);
    writeSession({
      id: newUser.id,
      username: merged.username,
      email: merged.email,
      createdAt: merged.createdAt
    });
    saveUser(merged);
    await pushRemoteProfile();
    return getCurrentUser();
  }

  async function requestEmailUpgrade(input) {
    var user = getCurrentUser();
    if (!user) return { ok: false, error: 'Sign in first.' };
    if (!isLocalUser(user)) return { ok: false, error: 'This account already has an email attached.' };
    var rawEmail = String(input && input.email != null ? input.email : '').trim();
    var email = cleanEmail(rawEmail);
    if (rawEmail && !email) return { ok: false, error: 'Enter a valid email address.' };
    if (!email) return { ok: false, error: 'Enter an email address to add.' };
    var password = String(input && input.password != null ? input.password : '');
    if (password.length < 6) return { ok: false, error: 'Enter the password for this browser account.' };
    var check = validateUsername(input && input.username ? input.username : user.username);
    if (!check.ok) return check;
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };
    if (usernameTakenLocally(check.username, user.id)) {
      return { ok: false, error: 'That username is already taken. Pick another one.' };
    }
    try {
      var available = await usernameAvailableOnline(check.username);
      if (!available) return { ok: false, error: 'That username is already taken. Pick another one.' };
    } catch (error) {
      return { ok: false, error: 'Could not check whether that username is available. Check your connection and try again.' };
    }
    var registry = readLocalAuth();
    var emailTakenLocal = Object.keys(registry.users).some(function (key) {
      var record = registry.users[key];
      return record && String(record.id) !== String(user.id) && normalizeEmail(record.email) === email;
    });
    if (emailTakenLocal) return { ok: false, error: 'An account with that email already exists in this browser.' };
    var record = localRecordForUser(user);
    if (!record) return { ok: false, error: 'Sign in to this browser account again before adding an email.' };
    var hash;
    try {
      hash = await hashLocalPassword(password, record.salt, record.iterations || LOCAL_AUTH_ITERATIONS);
    } catch (error) {
      return { ok: false, error: 'Could not verify that password in this browser. Try again.' };
    }
    if (!constantTimeEqual(hash, record.hash)) return { ok: false, error: 'Incorrect password.' };

    var result;
    try {
      result = await auth.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { username: check.username },
          emailRedirectTo: siteUrl() + '?account=confirmed'
        }
      });
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
    if (result.error) return { ok: false, error: friendlyAuthError(result.error) };
    var data = result.data || {};
    if (!data.session) {
      return {
        ok: true,
        needsConfirmation: true,
        email: email,
        upgrade: { localId: user.id, username: check.username }
      };
    }
    var authUser = data.user || (data.session && data.session.user);
    var upgraded = await finishLocalUpgrade(authUser, user.id, check.username);
    return { ok: true, needsConfirmation: false, user: upgraded };
  }

  async function verifyEmailCode(email, token, upgrade) {
    var clean = cleanEmail(email);
    var code = String(token == null ? '' : token).replace(/\s+/g, '');
    if (!clean) return { ok: false, error: 'Enter the email address you are verifying.' };
    if (!/^\d{6,10}$/.test(code)) return { ok: false, error: 'Enter the code from your verification email.' };
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };

    var verification;
    try {
      verification = await auth.auth.verifyOtp({ email: clean, token: code, type: 'signup' });
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
    if (verification.error) return { ok: false, error: friendlyAuthError(verification.error) };
    var authUser = verification.data && verification.data.user;
    if (!authUser) return { ok: false, error: 'That code could not be verified. Request a new code.' };

    if (upgrade && upgrade.localId) {
      var upgraded = await finishLocalUpgrade(authUser, upgrade.localId, upgrade.username);
      return { ok: true, user: upgraded, email: clean };
    }
    await adoptSession(authUser, 'signup');
    await pushRemoteProfile();
    return { ok: true, user: getCurrentUser(), email: clean };
  }

  async function resendEmailCode(email) {
    var clean = cleanEmail(email);
    if (!clean) return { ok: false, error: 'Enter the email address you are verifying.' };
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Online accounts are not configured yet.' };
    try {
      var result = await auth.auth.resend({
        type: 'signup',
        email: clean,
        options: { emailRedirectTo: siteUrl() + '?account=confirmed' }
      });
      if (result.error) return { ok: false, error: friendlyAuthError(result.error) };
      return { ok: true, email: clean };
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
  }

  async function sendRecoveryCode(email) {
    var clean = cleanEmail(email);
    if (!clean) return { ok: false, error: 'Enter the email address for your account.' };
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Password recovery is only available for online accounts.' };
    try {
      // No redirect is needed for a code reset. The Reset Password email
      // template must include {{ .Token }} for the six-digit code.
      var result = await auth.auth.resetPasswordForEmail(clean);
      if (result.error) return { ok: false, error: friendlyAuthError(result.error) };
      return { ok: true, email: clean };
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
  }

  async function verifyRecoveryCode(email, token, newPassword) {
    var clean = cleanEmail(email);
    var code = String(token == null ? '' : token).replace(/\s+/g, '');
    var password = String(newPassword == null ? '' : newPassword);
    if (!clean) return { ok: false, error: 'Enter the email address for your account.' };
    if (!/^\d{6,10}$/.test(code)) return { ok: false, error: 'Enter the code from your recovery email.' };
    if (password.length < 6) return { ok: false, error: 'Use a password with at least 6 characters.' };
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Password recovery is only available for online accounts.' };

    var verification;
    try {
      verification = await auth.auth.verifyOtp({ email: clean, token: code, type: 'recovery' });
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
    if (verification.error) return { ok: false, error: friendlyAuthError(verification.error) };
    var verifiedUser = verification.data && verification.data.user;
    if (!verifiedUser) return { ok: false, error: 'That code could not be verified. Request a new code.' };

    var update;
    try {
      update = await auth.auth.updateUser({ password: password });
    } catch (error) {
      return { ok: false, verified: true, error: friendlyAuthError(error) };
    }
    if (update.error) return { ok: false, verified: true, error: friendlyAuthError(update.error) };

    clearRecoveryFlag();
    var authUser = (update.data && update.data.user) || verifiedUser;
    await adoptSession(authUser, 'profile');
    return { ok: true, user: getCurrentUser() };
  }

  async function completeRecovery(newPassword) {
    var password = String(newPassword == null ? '' : newPassword);
    if (password.length < 6) return { ok: false, error: 'Use a password with at least 6 characters.' };
    var auth = authClient();
    if (!auth) return { ok: false, error: 'Password recovery is only available for online accounts.' };
    try {
      var result = await auth.auth.updateUser({ password: password });
      if (result.error) return { ok: false, error: friendlyAuthError(result.error) };
      clearRecoveryFlag();
      var authUser = result.data && result.data.user;
      if (authUser) await adoptSession(authUser, 'profile');
      return { ok: true, user: getCurrentUser() };
    } catch (error) {
      return { ok: false, error: friendlyAuthError(error) };
    }
  }

  function cancelRecovery() {
    clearRecoveryFlag();
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
    verifyEmailCode: verifyEmailCode,
    resendEmailCode: resendEmailCode,
    requestEmailUpgrade: requestEmailUpgrade,
    isLocalAccount: isLocalUser,
    sendRecoveryCode: sendRecoveryCode,
    resetPassword: sendRecoveryCode,
    verifyRecoveryCode: verifyRecoveryCode,
    completeRecovery: completeRecovery,
    isRecoveryPending: isRecoveryPending,
    cancelRecovery: cancelRecovery,
    signOut: signOut,
    saveGuestPreferences: saveGuestPreferences,
    applyPreferences: applyPreferences,
    applyGuestPreferences: applyGuestPreferences,
    capturePreferences: capturePreferences,
    snapshotPreferences: snapshotPreferences,
    setApps: setApps,
    setAvatar: setAvatar,
    setUsername: setUsername,
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

  // If Supabase redirected back with a recovery token, remember it before the
  // client consumes the URL so the account modal can ask for a new password.
  try {
    if (/type=recovery/.test(location.hash) || /[?&]type=recovery(?:[=&]|$)/.test(location.search)) {
      setRecoveryFlag();
    }
  } catch (error) {}

  // Apply the signed-in account's preferences before main.js initializes settings.
  try {
    var initialUser = getCurrentUser();
    if (initialUser) applyPreferences(initialUser.preferences);
  } catch (error) {}

  try { authClient(); } catch (error) {}
})();
