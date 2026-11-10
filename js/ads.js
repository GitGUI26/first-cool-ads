(function () {
  'use strict';

  var POPUP_STORAGE_KEY = 'popupAdsDisabled';
  var ADULT_HOSTS = [
    'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com',
    'youporn.com', 'brazzers.com', 'chaturbate.com', 'stripchat.com',
    'livejasmin.com', 'bongacams.com', 'cam4.com', 'spankbang.com',
    'motherless.com', 'onlyfans.com', 'fansly.com', 'adultfriendfinder.com',
    'ashleymadison.com', 'jerkmate.com'
  ];
  var UNITS = {
    leaderboard: { key: '42fa59411bc00ca9a1727a0e169fe495', width: 728, height: 90 },
    billboard: { key: '6927ea7cefe0226cb3e4947f0b94b48d', width: 468, height: 60 },
    medium: { key: '1249ecfbc029121c85fe493f1510d691', width: 300, height: 250 },
    halfpage: { key: 'fd6a707ccc3b03cb734b677d8ce1af01', width: 160, height: 300 },
    rail: { key: 'fdbc239c16bd1a3eb08372dbafd600fb', width: 160, height: 600 },
    mobile: { key: '54968ec20ac7060f07c68c0a7fc465cd', width: 320, height: 50 },
    native: { key: 'ff0e9cf7171c74d63b82ad0ca3625917', width: 728, height: 250 }
  };
  var POPUP_URL = 'https://araplhn.org/4/692a941bbc55f2c6ad94e07d6053328d';

  function popupAllowed() {
    try { return localStorage.getItem(POPUP_STORAGE_KEY) !== 'true'; }
    catch (error) { return true; }
  }

  function isAdultUrl(value) {
    var url;
    try { url = new URL(value, location.href); } catch (error) { return true; }
    var host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (ADULT_HOSTS.some(function (blocked) { return host === blocked || host.endsWith('.' + blocked); })) {
      return true;
    }
    if (/(^|\.)(porn|xxx|sex|adult|nude|nudes|escort|hentai|onlyfans|fansly|camgirl|camsite)\./.test(host)) {
      return true;
    }
    return /(porn|xxx|hentai|nude|escort|camgirl|onlyfans|fansly|chaturbate|livejasmin|brazzers)/i.test(host + url.pathname);
  }

  function makeFrame(width, height) {
    var frame = document.createElement('iframe');
    frame.className = 'ad-frame';
    frame.title = 'Advertisement';
    frame.width = String(width);
    frame.height = String(height);
    frame.loading = 'lazy';
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    // Deliberately no allow-popups, allow-top-navigation, or allow-same-origin.
    // A creative can render, but it cannot take over the site or open a tab.
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.style.width = width + 'px';
    frame.style.height = height + 'px';
    return frame;
  }

  function unitDocument(unit) {
    var options = JSON.stringify({ key: unit.key, format: 'iframe', height: unit.height, width: unit.width, params: {} });
    return '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body>' +
      '<script>atOptions = ' + options + ';<\/script>' +
      '<script src="https://bauval.org/22/' + unit.key + '"><\/script>' +
      '</body></html>';
  }

  function nativeDocument(unit) {
    return '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;font-family:sans-serif}</style></head><body>' +
      '<div id="container-' + unit.key + '"></div>' +
      '<script async="async" data-cfasync="false" src="https://bauval.org/21/' + unit.key + '"><\/script>' +
      '</body></html>';
  }

  function mount(id, unit, native) {
    var host = document.getElementById(id);
    if (!host || !unit) return;
    host.replaceChildren();
    var label = document.createElement('span');
    label.className = 'ad-unit-label';
    label.textContent = 'Advertisement';
    var frame = makeFrame(unit.width, unit.height);
    frame.srcdoc = native ? nativeDocument(unit) : unitDocument(unit);
    host.appendChild(label);
    host.appendChild(frame);
  }

  function renderSponsor() {
    var sponsor = document.getElementById('adPopupSponsor');
    if (!sponsor) return;
    var allowed = popupAllowed() && !isAdultUrl(POPUP_URL);
    sponsor.hidden = !allowed;
    if (!allowed) {
      sponsor.setAttribute('aria-hidden', 'true');
      sponsor.removeAttribute('href');
      return;
    }
    sponsor.removeAttribute('aria-hidden');
    sponsor.href = POPUP_URL;
    sponsor.onclick = function (event) {
      event.preventDefault();
      if (!popupAllowed()) {
        renderSponsor();
        return;
      }
      if (isAdultUrl(POPUP_URL)) {
        renderSponsor();
        return;
      }
      // The popup is opt-in through Settings and is the only ad allowed to
      // open a new tab. Display units are sandboxed above.
      window.open(POPUP_URL, '_blank', 'noopener,noreferrer');
    };
  }

  function refreshPopupAd() {
    renderSponsor();
  }

  function setPopupAdsEnabled(enabled) {
    try { localStorage.setItem(POPUP_STORAGE_KEY, enabled ? 'false' : 'true'); } catch (error) {}
    renderSponsor();
  }

  function renderAll() {
    // The previous site had an all-ads kill switch. Display ads now stay on;
    // only the popup offer can be switched off from Settings.
    try { localStorage.removeItem('adsDisabled'); } catch (error) {}
    mount('adTop', UNITS.leaderboard, false);
    mount('adHero', UNITS.billboard, false);
    mount('adLeadRect', UNITS.medium, false);
    mount('adLeadRect160', UNITS.halfpage, false);
    mount('adRail', UNITS.rail, false);
    mount('adNative', UNITS.native, true);
    mount('adMobile', UNITS.mobile, false);
    renderSponsor();
    setTimeout(function () {
      if (typeof window.placeInFeedAd === 'function') window.placeInFeedAd();
    }, 0);
  }

  window.CUHAds = {
    renderAll: renderAll,
    refreshPopupAd: refreshPopupAd,
    setPopupAdsEnabled: setPopupAdsEnabled,
    popupAllowed: popupAllowed,
    isAdultUrl: isAdultUrl
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }
})();
