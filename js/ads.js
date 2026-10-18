/*
 * Ads (Adsterra). Everything ad-related lives in this file.
 *
 * - Always on (there is no user setting to turn ads off).
 * - Only runs on the hub page (index.html). Not loaded in games or the proxy browser.
 * - Skips localhost so your own testing doesn't count as fake impressions.
 *
 * To turn something off, set it to false below. To remove ads entirely, delete the
 * <script src="js/ads.js"> line and the CoolAds.* lines in index.html.
 */
(function () {
  var CONFIG = {
    banners: true,        // 320x50 / 468x60 / 728x90 banner (one is picked to fit the screen)
    native: true,         // native banner under the games list
    runOnLocalhost: false
  };

  var BANNERS = {
    728: { key: '00dce71c7fc43151d218635d69f4d43c', w: 728, h: 90, src: 'https://bauval.org/22/00dce71c7fc43151d218635d69f4d43c' },
    468: { key: '2c50facdd365b4abd748195fbf8d2337', w: 468, h: 60, src: 'https://bauval.org/22/2c50facdd365b4abd748195fbf8d2337' },
    320: { key: '7600d519ed5e0c93d04c4ac0586be5f0', w: 320, h: 50, src: 'https://bauval.org/22/7600d519ed5e0c93d04c4ac0586be5f0' }
  };
  var NATIVE = {
    id: 'container-6c8c5949028dbc9e17e686b1f8b9d2bf',
    src: 'https://bauval.org/21/6c8c5949028dbc9e17e686b1f8b9d2bf'
  };

  function enabled() {
    if (window.top !== window.self) return false;
    if (!CONFIG.runOnLocalhost && /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)) return false;
    if (location.protocol === 'file:') return false;
    return true;
  }

  // Small label + spacing so ads are clearly marked and don't crowd the page.
  try {
    var st = document.createElement('style');
    st.textContent =
      '.ad-slot{display:flex;flex-direction:column;align-items:center;margin:16px auto;max-width:100%;overflow:hidden;position:relative;z-index:1}' +
      '.ad-slot:before{content:"Advertisement";font:10px/1 sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.5;margin-bottom:4px}';
    document.head.appendChild(st);
  } catch (e) {}

  function pickBanner() {
    var w = document.documentElement.clientWidth || window.innerWidth || 0;
    var room = w - 24;
    if (room >= 728) return BANNERS[728];
    if (room >= 468) return BANNERS[468];
    if (room >= 320) return BANNERS[320];
    return null;
  }

  // Each ad runs inside its own sandboxed iframe. allow-same-origin lets ad code see this site's address and use
  // storage (ad networks need that to serve ads); there is no allow-popups and no allow-top-navigation, so ads
  // can't open tabs/popups or redirect the page. To also let ad clicks open the advertiser, add
  // ' allow-popups allow-popups-to-escape-sandbox' to SANDBOX.
  var SANDBOX = 'allow-scripts allow-same-origin';
  var frameCount = 0;

  function attr(str) { return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

  function adFrame(inner, w, h, autoHeight) {
    var doc = '<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head>' +
      '<body style="margin:0;background:transparent;overflow:hidden">' + inner +
      (autoHeight
        ? '<script>(function(){function s(){try{parent.postMessage({coolAdHeight:document.documentElement.scrollHeight},"*")}catch(e){}}' +
          'addEventListener("load",s);setInterval(s,1000)})()<\/script>'
        : '') +
      '</body></html>';
    return '<iframe class="ad-frame" sandbox="' + SANDBOX + '" scrolling="no" loading="lazy" ' +
      'style="border:0;width:' + (w ? w + 'px' : '100%') + ';max-width:100%;height:' + h + 'px" ' +
      'srcdoc="' + attr(doc) + '"></iframe>';
  }

  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data.coolAdHeight !== 'number') return;
    var frames = document.querySelectorAll('iframe.ad-frame');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) {
        frames[i].style.height = Math.min(Math.max(e.data.coolAdHeight, 50), 600) + 'px';
      }
    }
  });

  window.CoolAds = {
    // Call from an inline <script> exactly where the banner should appear.
    banner: function () {
      if (!CONFIG.banners || !enabled()) return;
      var b = pickBanner(); if (!b) return;
      var opts = JSON.stringify({ key: b.key, format: 'iframe', height: b.h, width: b.w, params: {} });
      var inner = '<script>atOptions = ' + opts + ';<\/script><script src="' + b.src + '"><\/script>';
      document.write('<div class="ad-slot" style="width:' + b.w + 'px;min-height:' + (b.h + 14) + 'px">' +
        adFrame(inner, b.w, b.h, false) + '</div>');
    },
    // Native banner: container + its script, together, where it should appear.
    native: function () {
      if (!CONFIG.native || !enabled()) return;
      var inner = '<script async="async" data-cfasync="false" src="' + NATIVE.src + '"><\/script>' +
        '<div id="' + NATIVE.id + '"></div>';
      document.write('<div class="ad-slot" style="width:100%">' + adFrame(inner, 0, 250, true) + '</div>');
    }
  };

  // Safety net for the hub page: nothing on this page should ever pop a new window.
  try { window.open = function () { return null; }; } catch (e) {}
})();
