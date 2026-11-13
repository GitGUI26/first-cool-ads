(function () {
  'use strict';

  /*
   * Adsterra setup.
   * After the site is approved, paste what Adsterra gives you here:
   *   bannerHtml   the full <div> plus <script> block for a banner / native banner unit
   *   popunderSrc  only the src URL of the popunder or social bar tag
   * Leave both empty and the site stays completely ad free.
   */
  var CONFIG = {
    bannerHtml: '',
    popunderSrc: ''
  };

  var ENABLED_KEY = 'adsEnabled';
  var POPUNDER_KEY = 'adsPopunder';
  var state = { banner: false, popunder: false };

  function readPref(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writePref(key, value) {
    try { localStorage.setItem(key, value); } catch (error) {}
  }

  function adsAllowed() {
    return readPref(ENABLED_KEY, 'true') !== 'false';
  }

  function popunderAllowed() {
    return adsAllowed() && readPref(POPUNDER_KEY, 'false') === 'true';
  }

  function ensureSlot() {
    var existing = document.getElementById('adSlot');
    if (existing) return existing;
    var grid = document.getElementById('allLessonsGrid');
    if (!grid || !grid.parentNode) return null;
    var slot = document.createElement('div');
    slot.className = 'ad-slot';
    slot.id = 'adSlot';
    slot.hidden = true;
    var label = document.createElement('span');
    label.className = 'ad-slot-label';
    label.textContent = 'Advertisement';
    var mount = document.createElement('div');
    mount.className = 'ad-slot-mount';
    mount.id = 'adSlotMount';
    slot.append(label, mount);
    grid.parentNode.insertBefore(slot, grid.nextSibling);
    return slot;
  }

  // innerHTML does not execute scripts, so clone them back into life.
  function runScripts(container) {
    Array.prototype.forEach.call(container.querySelectorAll('script'), function (old) {
      var copy = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function (attribute) {
        copy.setAttribute(attribute.name, attribute.value);
      });
      copy.text = old.text;
      if (old.parentNode) old.parentNode.replaceChild(copy, old);
    });
  }

  function mountBanner() {
    if (state.banner || !CONFIG.bannerHtml || !adsAllowed()) return;
    var slot = ensureSlot();
    if (!slot) return;
    var mount = document.getElementById('adSlotMount');
    if (!mount) return;
    mount.innerHTML = CONFIG.bannerHtml;
    runScripts(mount);
    slot.hidden = false;
    state.banner = true;
  }

  function mountPopunder() {
    if (state.popunder || !CONFIG.popunderSrc || !popunderAllowed()) return;
    var script = document.createElement('script');
    script.src = CONFIG.popunderSrc;
    script.async = true;
    script.dataset.adPopunder = '1';
    document.head.appendChild(script);
    state.popunder = true;
  }

  function unmount() {
    state.banner = false;
    state.popunder = false;
    var slot = document.getElementById('adSlot');
    if (slot) {
      slot.hidden = true;
      var mount = document.getElementById('adSlotMount');
      if (mount) mount.replaceChildren();
    }
    Array.prototype.forEach.call(document.querySelectorAll('script[data-ad-popunder]'), function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
  }

  function syncSettings() {
    var adsToggle = document.getElementById('adsEnabledToggle');
    var popunderToggle = document.getElementById('adsPopunderToggle');
    if (adsToggle) adsToggle.checked = adsAllowed();
    if (popunderToggle) {
      popunderToggle.checked = readPref(POPUNDER_KEY, 'false') === 'true';
      popunderToggle.disabled = !adsAllowed();
    }
  }

  function apply() {
    if (!adsAllowed()) unmount();
    else {
      mountBanner();
      mountPopunder();
    }
    syncSettings();
  }

  window.setAdsEnabledPreference = function (enabled) {
    writePref(ENABLED_KEY, enabled ? 'true' : 'false');
    apply();
  };

  window.setAdsPopunderPreference = function (enabled) {
    writePref(POPUNDER_KEY, enabled ? 'true' : 'false');
    apply();
  };

  function init() {
    syncSettings();
    apply();
    window.SiteAds = { apply: apply, syncSettings: syncSettings, config: CONFIG };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
