/*
 * Ads (Adsterra). Everything ad-related lives in this file.
 * To remove every ad, delete this file and the CoolAds.* lines in index.html.
 */
(function () {
  'use strict';

  var CONFIG = {
    banner: true,      // 728x90 (wide) or 320x50 (narrow), under the header
    wide: true,        // 468x60 between the hero and the lessons list
    rectangle: true,   // 300x250 above the lessons grid
    native: true,      // native banner under the grid
    sidebars: true,    // 160x300 left and 160x600 right on very wide screens
    runOnLocalhost: false
  };

  var HOST = 'https://bauval.org/';
  var BANNERS = {
    728: { key: '7fb73c81f7569adaad81ae6121e57fda', w: 728, h: 90 },
    320: { key: '4ca43d9a9bdaae5fa2a4d476bcbccbdc', w: 320, h: 50 }
  };
  var WIDE = { key: 'c561dbc28879e43aeeca505690efa8cb', w: 468, h: 60 };
  var RECT = { key: '9a0876df5b922db866370cb182397610', w: 300, h: 250 };
  var SIDE_A = { key: '070b1ed7e27013d694d928664de569c3', w: 160, h: 300 };
  var SIDE_B = { key: 'a84cc202fb23ef7c264918fb5099e484', w: 160, h: 600 };
  var NATIVE = {
    id: 'container-754d99c659b2ff20a471e708e287abbd',
    src: HOST + '21/754d99c659b2ff20a471e708e287abbd'
  };

  var STYLE = '<style>' +
    '.ad-slot{display:flex;flex-direction:column;align-items:center;margin:18px auto;max-width:100%;overflow:hidden;position:relative;z-index:1}' +
    '.ad-slot:before{content:"Advertisement";font:10px/1 sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.45;margin-bottom:5px}' +
    '.ad-side{position:fixed;top:50%;transform:translateY(-50%);margin:0;z-index:50}' +
    '.ad-side-left{left:10px}.ad-side-right{right:10px}' +
    '@media (max-width:1499px){.ad-side{display:none}}' +
    '</style>';

  function enabled() {
    if (!CONFIG.runOnLocalhost && /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)) return false;
    if (location.protocol === 'file:') return false;
    if (window.top !== window.self) return false; // never inside the game frame
    return true;
  }

  function attr(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Adsterra expects atOptions immediately before the invoke script.
  function invoke(ad) {
    var options = { key: ad.key, format: 'iframe', height: ad.h, width: ad.w, params: {} };
    return '<scr' + 'ipt>atOptions = ' + JSON.stringify(options) + ';</scr' + 'ipt>' +
      '<scr' + 'ipt src="' + HOST + '22/' + ad.key + '"></scr' + 'ipt>';
  }

  // Every unit runs inside its own sandboxed frame, so ad code cannot rewrite
  // the page, hook clicks or open tabs on its own.
  function frame(html, w, h) {
    var width = typeof w === 'number' ? w + 'px' : w;
    return '<iframe class="ad-frame" sandbox="allow-scripts allow-same-origin" ' +
      'style="border:0;overflow:hidden;display:block;width:' + width + ';height:' + h + 'px" ' +
      'srcdoc="' + attr(html) + '"></iframe>';
  }

  function emit(html) {
    document.write(html);
  }

  function slot(ad) {
    emit('<div class="ad-slot" style="width:' + ad.w + 'px">' + frame(invoke(ad), ad.w, ad.h) + '</div>');
  }

  window.CoolAds = {
    banner: function () {
      if (!CONFIG.banner || !enabled()) return;
      slot(window.innerWidth < 768 ? BANNERS[320] : BANNERS[728]);
    },

    wide: function () {
      if (!CONFIG.wide || !enabled()) return;
      if (window.innerWidth < 500) return; // no room for 468px on phones
      slot(WIDE);
    },

    rectangle: function () {
      if (!CONFIG.rectangle || !enabled()) return;
      slot(RECT);
    },

    native: function () {
      if (!CONFIG.native || !enabled()) return;
      var html = '<div id="' + NATIVE.id + '"></div>' +
        '<scr' + 'ipt async="async" data-cfasync="false" src="' + NATIVE.src + '"></scr' + 'ipt>';
      emit('<div class="ad-slot" style="width:100%">' + frame(html, '100%', 280) + '</div>');
    },

    sidebars: function () {
      if (!CONFIG.sidebars || !enabled()) return;
      if (window.innerWidth < 1500) return;
      emit(STYLE);
      emit('<div class="ad-slot ad-side" style="position:fixed;left:10px;top:50%;transform:translateY(-50%);margin:0;z-index:50">' + frame(invoke(SIDE_A), SIDE_A.w, SIDE_A.h) + '</div>');
      emit('<div class="ad-slot ad-side" style="position:fixed;right:10px;top:50%;transform:translateY(-50%);margin:0;z-index:50">' + frame(invoke(SIDE_B), SIDE_B.w, SIDE_B.h) + '</div>');
    }
  };
})();
