/* Cool Originals — shared shell for hand-built games. */
(function () {
  'use strict';

  var canvas = document.getElementById('stage');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width;
  var H = canvas.height;
  var $ = function (id) { return document.getElementById(id); };
  var scoreEl = $('scoreValue');
  var bestEl = $('bestValue');
  var overlay = $('overlay');
  var overlayKicker = $('overlayKicker');
  var overlayTitle = $('overlayTitle');
  var overlayText = $('overlayText');
  var startBtn = $('startBtn');
  var restartBtn = $('restartBtn');
  var touchPad = $('touchPad');
  var controlsHint = $('controlsHint');

  var configs = {};
  var factories = {};
  var game = null;
  var cfg = null;
  var booted = false;

  var state = {
    score: 0,
    best: 0,
    started: false,
    over: false,
    last: 0
  };
  var input = { left: false, right: false, up: false, down: false, action: false };

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) { /* storage can be disabled */ }
  }
  function bestKey() { return 'coolOriginalsBest:' + document.body.dataset.game; }
  function readBest() {
    var value = Number(safeGet(bestKey()) || 0);
    return isFinite(value) ? value : 0;
  }
  function setScore(value) {
    state.score = value;
    if (scoreEl) scoreEl.textContent = String(value);
  }
  function setBest(value) {
    state.best = value;
    if (value) safeSet(bestKey(), value);
    if (bestEl) bestEl.textContent = value ? String(value) : '—';
  }
  function maybeBest(value) {
    if (value > state.best) setBest(value);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }
  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }
  function shuffle(values) {
    var copy = values.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = randInt(0, i);
      var temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }
  function pathRoundRect(x, y, w, h, r) {
    var radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow() {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
  function label(text, x, y, size, color, align, weight) {
    ctx.save();
    ctx.fillStyle = color || '#eef3ff';
    ctx.font = (weight || 600) + ' ' + size + 'px "Space Grotesk", "Inter", sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function panel() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#081321');
    grad.addColorStop(0.62, '#050b15');
    grad.addColorStop(1, '#03060d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  function starfield(count, color) {
    ctx.save();
    ctx.fillStyle = color || 'rgba(170, 196, 255, 0.55)';
    for (var i = 0; i < count; i++) {
      var x = (i * 97.13 + 31) % W;
      var y = (i * 53.71 + 17) % H;
      var size = i % 6 === 0 ? 2 : 1;
      ctx.globalAlpha = 0.22 + (i % 4) * 0.15;
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  function showOverlay(kicker, title, text, buttonText) {
    if (!overlay) return;
    overlayKicker.textContent = kicker || 'COOL ORIGINALS';
    overlayTitle.textContent = title || 'Cool Original';
    overlayText.textContent = text || '';
    startBtn.textContent = buttonText || 'Play';
    overlay.classList.remove('is-hidden');
  }
  function hideOverlay() {
    if (overlay) overlay.classList.add('is-hidden');
  }
  function gameOver(title, text) {
    if (state.over) return;
    state.over = true;
    maybeBest(state.score);
    showOverlay('RUN COMPLETE', title || 'Run complete', text || '', 'Play again');
  }

  function pointerPosition(event) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (W / rect.width),
      y: (event.clientY - rect.top) * (H / rect.height)
    };
  }

  function bindPress(button, down, up) {
    button.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      if (button.setPointerCapture) {
        try { button.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
      }
      down();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (type) {
      button.addEventListener(type, function () { up(); });
    });
  }

  function buildTouchPad() {
    if (!touchPad) return;
    if (cfg.touch === 'dpad') {
      touchPad.innerHTML =
        '<div class="pad-grid">' +
        '<button type="button" data-dir="up" aria-label="Up">▲</button>' +
        '<button type="button" data-dir="left" aria-label="Left">◀</button>' +
        '<button type="button" data-dir="right" aria-label="Right">▶</button>' +
        '<button type="button" data-dir="down" aria-label="Down">▼</button>' +
        '</div>' +
        '<button type="button" class="pad-action" aria-label="' + (cfg.actionLabel || 'Action') + '">' +
        (cfg.actionLabel || 'Action') + '</button>';
      var buttons = touchPad.querySelectorAll('[data-dir]');
      Array.prototype.forEach.call(buttons, function (button) {
        var dir = button.dataset.dir;
        bindPress(button, function () {
          input[dir] = true;
          if (game && game.onDir) game.onDir(dir);
        }, function () {
          input[dir] = false;
        });
      });
      var action = touchPad.querySelector('.pad-action');
      if (action) {
        bindPress(action, function () {
          input.action = true;
          if (game && game.onAction) game.onAction();
        }, function () {
          input.action = false;
        });
      }
    } else if (cfg.touch === 'action') {
      touchPad.innerHTML = '<button type="button" class="pad-action" aria-label="' +
        (cfg.actionLabel || 'Action') + '">' + (cfg.actionLabel || 'Action') + '</button>';
      var actionOnly = touchPad.querySelector('.pad-action');
      if (actionOnly) {
        bindPress(actionOnly, function () {
          input.action = true;
          if (game && game.onAction) game.onAction();
        }, function () {
          input.action = false;
        });
      }
    }
  }

  function begin() {
    if (!game) return;
    state.started = true;
    state.over = false;
    input.left = input.right = input.up = input.down = input.action = false;
    game.reset();
    hideOverlay();
    state.last = performance.now();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!state.last) state.last = now;
    var dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    if (game) {
      if (state.started && !state.over && game.update) game.update(dt);
      if (game.draw) game.draw(dt);
    }
  }

  window.CoolOriginals = {
    register: function (slug, config, factory) {
      if (!slug || !config || typeof factory !== 'function') return;
      configs[slug] = config;
      factories[slug] = factory;
    }
  };

  var api = {
    W: W,
    H: H,
    ctx: ctx,
    input: input,
    state: state,
    clamp: clamp,
    rand: rand,
    randInt: randInt,
    shuffle: shuffle,
    pathRoundRect: pathRoundRect,
    glow: glow,
    noGlow: noGlow,
    label: label,
    panel: panel,
    starfield: starfield,
    setScore: setScore,
    setBest: setBest,
    maybeBest: maybeBest,
    gameOver: gameOver,
    showOverlay: showOverlay,
    hideOverlay: hideOverlay,
    safeGet: safeGet,
    safeSet: safeSet
  };
  window.CoolOriginals.api = api;

  function boot() {
    if (booted) return;
    booted = true;
    var slug = document.body.dataset.game;
    cfg = configs[slug];
    if (!cfg || !factories[slug]) {
      if (overlayTitle) overlayTitle.textContent = 'Game unavailable';
      if (overlayText) overlayText.textContent = 'This original could not be loaded.';
      if (startBtn) startBtn.disabled = true;
      return;
    }
    game = factories[slug](api);
    if (scoreEl && scoreEl.parentElement) {
      scoreEl.parentElement.querySelector('span').textContent = cfg.score || 'Score';
    }
    if (bestEl && bestEl.parentElement) {
      bestEl.parentElement.querySelector('span').textContent = cfg.best || 'Best';
    }
    if (controlsHint) controlsHint.textContent = cfg.controls || '';
    setBest(readBest());
    setScore(0);
    buildTouchPad();
    game.reset();
    game.draw(0);
    showOverlay(cfg.kicker, cfg.title, cfg.blurb, 'Play');

    startBtn.addEventListener('click', begin);
    restartBtn.addEventListener('click', begin);

    window.addEventListener('keydown', function (event) {
      var key = event.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(key) >= 0) {
        event.preventDefault();
      }
      if (key === ' ' || key === 'Enter') {
        if (!state.started || state.over) {
          begin();
          return;
        }
        if (!event.repeat) {
          input.action = true;
          if (game.onAction) game.onAction();
        }
        return;
      }
      var dirs = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down'
      };
      var dir = dirs[key] || dirs[String(key).toLowerCase()];
      if (!dir) return;
      input[dir] = true;
      if (!event.repeat && game.onDir) game.onDir(dir);
    });
    window.addEventListener('keyup', function (event) {
      var dirs = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down'
      };
      var dir = dirs[event.key] || dirs[String(event.key).toLowerCase()];
      if (dir) input[dir] = false;
      if (event.key === ' ') input.action = false;
    });
    window.addEventListener('blur', function () {
      input.left = input.right = input.up = input.down = input.action = false;
    });

    canvas.addEventListener('pointerdown', function (event) {
      if (!state.started || state.over) return;
      var p = pointerPosition(event);
      if (game.onPointerDown) game.onPointerDown(p, event);
      if (game.onPointer) game.onPointer(p, event);
    });
    canvas.addEventListener('pointermove', function (event) {
      if (!state.started || state.over) return;
      var p = pointerPosition(event);
      if (game.onPointerMove) game.onPointerMove(p, event);
    });
    canvas.addEventListener('pointerup', function (event) {
      if (!state.started) return;
      var p = pointerPosition(event);
      if (game.onPointerUp) game.onPointerUp(p, event);
    });
    canvas.addEventListener('pointercancel', function () {
      if (game.onPointerUp) game.onPointerUp({ x: 0, y: 0 }, null);
    });
    canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 0);
  }
})();
