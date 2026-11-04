/* Cool Arcade — original mini-games, shared engine. */
(function () {
  'use strict';

  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var W = canvas.width;
  var H = canvas.height;
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  var GAME = body.dataset.game || 'snake';
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

  var CONFIG = {
    snake: { title: 'Neon Snake', kicker: 'ARCADE CLASSIC', blurb: 'Eat the signal orbs, grow the trail, and never bite your own tail.', controls: 'Arrows / WASD to steer · swipe pad on touch', score: 'Score', best: 'Best', touch: 'dpad' },
    breakout: { title: 'Brick Blitz', kicker: 'ARCADE CLASSIC', blurb: 'Bounce the plasma ball, clear every brick, and keep three lives alive.', controls: 'Move with the mouse or arrows · click / space to launch', score: 'Score', best: 'Best' },
    flappy: { title: 'Sky Hopper', kicker: 'ARCADE CLASSIC', blurb: 'Thread the neon skyline one flap at a time. Gravity is not your friend.', controls: 'Click / tap / space to flap', score: 'Score', best: 'Best' },
    runner: { title: 'Star Runner', kicker: 'ENDLESS RUN', blurb: 'Sprint across a collapsing star road, jump the debris, and chase the horizon.', controls: 'Click / tap / space to jump · double jump allowed', score: 'Distance', best: 'Best' },
    invaders: { title: 'Void Invaders', kicker: 'ARCADE CLASSIC', blurb: 'Hold the last line, clear the swarm, and survive the next wave.', controls: 'Arrows / A-D to move · space to fire', score: 'Score', best: 'Best', touch: 'dpad' },
    pong: { title: 'Pong Duel', kicker: 'ARCADE CLASSIC', blurb: 'Keep the rally alive against a relentless wall of code. One miss ends the run.', controls: 'Move with the mouse or up / down arrows', score: 'Rally', best: 'Best' },
    mines: { title: 'Minefield', kicker: 'LOGIC GRID', blurb: 'Read the numbers, flag the mines, and clear the whole field without a boom.', controls: 'Click to reveal · right-click or flag mode to mark', score: 'Flags', best: 'Time', touch: 'flag' },
    memory: { title: 'Memory Flip', kicker: 'BRAIN TRAINING', blurb: 'Match every pair in as few flips as possible. A clean sweep is pure memory.', controls: 'Click / tap a card to flip it', score: 'Moves', best: 'Best', lower: true },
    connect4: { title: 'Four in a Row', kicker: 'STRATEGY', blurb: 'Drop discs, build a line of four, and out-think the house AI.', controls: 'Click / tap a column to drop your disc', score: 'Wins', best: 'Streak' },
    tictactoe: { title: 'Tic-Tac-Toe', kicker: 'STRATEGY', blurb: 'A tiny board with a very stubborn opponent. Can you break the perfect AI?', controls: 'Click / tap a square', score: 'Wins', best: 'Streak' }
  };

  var cfg = CONFIG[GAME] || CONFIG.snake;
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
    try { localStorage.setItem(key, String(value)); } catch (e) { /* storage may be disabled */ }
  }
  function bestKey() { return 'coolArcadeBest:' + GAME; }
  function readBest() {
    var value = Number(safeGet(bestKey()) || 0);
    return isFinite(value) ? value : 0;
  }
  function setScore(value) {
    state.score = value;
    scoreEl.textContent = String(value);
  }
  function setBest(value) {
    state.best = value;
    if (value) {
      safeSet(bestKey(), value);
    }
    bestEl.textContent = value ? String(value) : '—';
  }
  function maybeBest(value) {
    if (cfg.lower) {
      if (!state.best || value < state.best) setBest(value);
    }
    else if (value > state.best) {
      setBest(value);
    }
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
    ctx.fillStyle = color;
    ctx.font = (weight || 600) + ' ' + size + 'px "Space Grotesk", "Inter", sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function panel() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#081321');
    grad.addColorStop(0.65, '#050b15');
    grad.addColorStop(1, '#03060d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  function starfield(count, color) {
    ctx.save();
    ctx.fillStyle = color || 'rgba(170, 196, 255, 0.55)';
    for (var i = 0; i < count; i++) {
      var x = (i * 97.13) % W;
      var y = (i * 53.71) % H;
      var s = i % 5 === 0 ? 2 : 1;
      ctx.globalAlpha = 0.25 + (i % 4) * 0.16;
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }

  function showOverlay(kicker, title, text, buttonText) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    startBtn.textContent = buttonText || 'Play';
    overlay.classList.remove('is-hidden');
  }
  function hideOverlay() {
    overlay.classList.add('is-hidden');
  }
  function gameOver(title, text) {
    state.over = true;
    showOverlay('RUN ENDED', title, text, 'Play again');
  }

  /* ------------------------------------------------------------------ snake */

  var snake = {
    reset: function () {
      this.snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }, { x: 5, y: 9 }];
      this.dir = { x: 1, y: 0 };
      this.pending = { x: 1, y: 0 };
      this.acc = 0;
      this.step = 0.105;
      this.food = this.spawnFood();
      setScore(0);
    },
    spawnFood: function () {
      while (true) {
        var food = { x: randInt(0, 31), y: randInt(0, 17) };
        if (!this.snake.some(function (s) { return s.x === food.x && s.y === food.y; })) return food;
      }
    },
    onDir: function (dir) {
      var map = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
      var next = map[dir];
      if (!next) return;
      if (next.x === -this.dir.x && next.y === -this.dir.y) return;
      this.pending = next;
    },
    update: function (dt) {
      this.acc += dt;
      if (this.acc < this.step) return;
      this.acc = 0;
      this.dir = this.pending;
      var head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };
      if (head.x < 0 || head.x > 31 || head.y < 0 || head.y > 17) {
        gameOver('Signal lost', 'You scored ' + state.score + ' before the wall got you.');
        return;
      }
      for (var i = 0; i < this.snake.length - 1; i++) {
        if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
          gameOver('Signal lost', 'You scored ' + state.score + ' before the tail got you.');
          return;
        }
      }
      this.snake.unshift(head);
      if (head.x === this.food.x && head.y === this.food.y) {
        setScore(state.score + 10);
        maybeBest(state.score);
        this.food = this.spawnFood();
        this.step = Math.max(0.058, this.step - 0.0018);
      }
      else {
        this.snake.pop();
      }
    },
    draw: function () {
      panel();
      ctx.strokeStyle = 'rgba(120, 156, 255, 0.09)';
      ctx.lineWidth = 1;
      for (var x = 0; x <= W; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (var y = 0; y <= H; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      var fx = this.food.x * 30 + 15;
      var fy = this.food.y * 30 + 15;
      glow('#22d3ee', 16 + pulse * 10);
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(fx, fy, 7 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      noGlow();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath();
      ctx.arc(fx - 2, fy - 2, 2, 0, Math.PI * 2);
      ctx.fill();

      for (var i = this.snake.length - 1; i >= 0; i--) {
        var segment = this.snake[i];
        var hue = 174 + i * 2.2;
        ctx.fillStyle = 'hsl(' + hue + ', 90%, ' + (i === 0 ? 64 : 56) + '%)';
        glow(i === 0 ? 'rgba(34,211,238,.55)' : 'rgba(34,211,238,.16)', i === 0 ? 20 : 7);
        pathRoundRect(segment.x * 30 + 2, segment.y * 30 + 2, 26, 26, i === 0 ? 9 : 7);
        ctx.fill();
      }
      noGlow();
      var head = this.snake[0];
      if (!head) return;
      var hx = head.x * 30 + 15;
      var hy = head.y * 30 + 15;
      ctx.fillStyle = '#04131a';
      var eye = 5;
      var ox = this.dir.x * 4;
      var oy = this.dir.y * 4;
      ctx.beginPath(); ctx.arc(hx + ox - (this.dir.y ? 5 : 0), hy + oy - (this.dir.x ? 5 : 0), eye, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + ox + (this.dir.y ? 5 : 0), hy + oy + (this.dir.x ? 5 : 0), eye, 0, Math.PI * 2); ctx.fill();
      label('LENGTH ' + this.snake.length, 20, H - 22, 11, 'rgba(150,170,215,.65)', 'left', 600);
    }
  };

  /* ---------------------------------------------------------------- breakout */

  var breakout = {
    reset: function () {
      this.paddle = { x: W / 2 - 65, y: H - 44, w: 130, h: 14 };
      this.ball = { x: W / 2, y: H - 62, r: 9, vx: 0, vy: 0 };
      this.attached = true;
      this.lives = 3;
      this.bricks = [];
      this.colors = ['#22d3ee', '#5eead4', '#7c8cff', '#c084fc', '#f6c453'];
      for (var row = 0; row < 5; row++) {
        for (var col = 0; col < 10; col++) {
          this.bricks.push({ x: 44 + col * 88, y: 76 + row * 38, w: 80, h: 29, row: row, alive: true });
        }
      }
      setScore(0);
    },
    launch: function () {
      if (!this.attached) return;
      var angle = rand(-0.55, 0.55);
      var speed = 380;
      this.ball.vx = Math.sin(angle) * speed;
      this.ball.vy = -Math.abs(Math.cos(angle) * speed);
      this.attached = false;
    },
    onAction: function () { this.launch(); },
    onPointer: function (p) {
      this.paddle.x = clamp(p.x - this.paddle.w / 2, 10, W - this.paddle.w - 10);
      if (this.attached) {
        this.ball.x = this.paddle.x + this.paddle.w / 2;
        this.ball.y = this.paddle.y - 14;
      }
      this.launch();
    },
    onMove: function (p) {
      this.paddle.x = clamp(p.x - this.paddle.w / 2, 10, W - this.paddle.w - 10);
      if (this.attached) {
        this.ball.x = this.paddle.x + this.paddle.w / 2;
        this.ball.y = this.paddle.y - 14;
      }
    },
    update: function (dt) {
      var speed = 520;
      if (input.left) this.paddle.x -= speed * dt;
      if (input.right) this.paddle.x += speed * dt;
      this.paddle.x = clamp(this.paddle.x, 10, W - this.paddle.w - 10);
      if (this.attached) {
        this.ball.x = this.paddle.x + this.paddle.w / 2;
        this.ball.y = this.paddle.y - 14;
        return;
      }
      var ball = this.ball;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

      if (ball.vy > 0 && ball.y + ball.r >= this.paddle.y && ball.y - ball.r <= this.paddle.y + this.paddle.h &&
        ball.x >= this.paddle.x - 6 && ball.x <= this.paddle.x + this.paddle.w + 6) {
        var hit = (ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
        ball.y = this.paddle.y - ball.r;
        ball.vy = -Math.abs(ball.vy);
        ball.vx += hit * 130;
        ball.vx = clamp(ball.vx, -480, 480);
      }

      for (var i = 0; i < this.bricks.length; i++) {
        var b = this.bricks[i];
        if (!b.alive) continue;
        var nearX = clamp(ball.x, b.x, b.x + b.w);
        var nearY = clamp(ball.y, b.y, b.y + b.h);
        var dx = ball.x - nearX;
        var dy = ball.y - nearY;
        if (dx * dx + dy * dy > ball.r * ball.r) continue;
        b.alive = false;
        setScore(state.score + 10);
        maybeBest(state.score);
        if (Math.abs(ball.x - (b.x + b.w / 2)) > b.w / 2 - 4) ball.vx *= -1;
        else ball.vy *= -1;
        ball.vx *= 1.008;
        ball.vy *= 1.008;
        break;
      }

      if (ball.y - ball.r > H) {
        this.lives -= 1;
        if (this.lives <= 0) {
          gameOver('Out of lives', 'You scored ' + state.score + ' and left ' + this.bricks.filter(function (b) { return b.alive; }).length + ' bricks standing.');
        }
        else {
          this.attached = true;
          ball.vx = 0;
          ball.vy = 0;
        }
      }
      if (this.bricks.every(function (b) { return !b.alive; })) {
        gameOver('Board cleared', 'Perfect run — ' + state.score + ' points with ' + this.lives + ' lives left.');
      }
    },
    draw: function () {
      panel();
      starfield(35, 'rgba(130, 180, 255, 0.35)');
      for (var i = 0; i < this.bricks.length; i++) {
        var b = this.bricks[i];
        if (!b.alive) continue;
        ctx.fillStyle = this.colors[b.row];
        glow(this.colors[b.row], 6);
        pathRoundRect(b.x, b.y, b.w, b.h, 6);
        ctx.fill();
      }
      noGlow();
      ctx.fillStyle = 'rgba(34,211,238,.95)';
      glow('#22d3ee', 18);
      pathRoundRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 7);
      ctx.fill();
      ctx.fillStyle = '#f7fbff';
      glow('#ffffff', 14);
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
      ctx.fill();
      noGlow();
      for (var life = 0; life < 3; life++) {
        ctx.fillStyle = life < this.lives ? '#22d3ee' : 'rgba(120,140,180,.22)';
        ctx.beginPath();
        ctx.arc(24 + life * 18, H - 20, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      label('SPACE / CLICK TO LAUNCH', W - 20, H - 20, 10, 'rgba(150,170,215,.55)', 'right', 600);
    }
  };

  /* ------------------------------------------------------------------ flappy */

  var flappy = {
    reset: function () {
      this.bird = { x: 210, y: 260, r: 14, vy: 0 };
      this.pipes = [];
      this.timer = 0.5;
      this.ground = H - 46;
      setScore(0);
    },
    flap: function () {
      if (state.over) return;
      this.bird.vy = -440;
    },
    onAction: function () { this.flap(); },
    onPointer: function () { this.flap(); },
    update: function (dt) {
      var bird = this.bird;
      bird.vy += 1480 * dt;
      bird.y += bird.vy * dt;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 1.48;
        this.pipes.push({ x: W + 40, gap: rand(130, this.ground - 150), w: 74, gapH: 158, passed: false });
      }
      for (var i = this.pipes.length - 1; i >= 0; i--) {
        var pipe = this.pipes[i];
        pipe.x -= 210 * dt;
        if (!pipe.passed && pipe.x + pipe.w < bird.x) {
          pipe.passed = true;
          setScore(state.score + 1);
          maybeBest(state.score);
        }
        if (pipe.x + pipe.w < -10) {
          this.pipes.splice(i, 1);
          continue;
        }
        var hitTop = bird.x + bird.r > pipe.x && bird.x - bird.r < pipe.x + pipe.w && bird.y - bird.r < pipe.gap;
        var hitBottom = bird.x + bird.r > pipe.x && bird.x - bird.r < pipe.x + pipe.w && bird.y + bird.r > pipe.gap + pipe.gapH;
        if (hitTop || hitBottom) {
          gameOver('Grounded', 'You cleared ' + state.score + ' gate' + (state.score === 1 ? '' : 's') + '.');
          return;
        }
      }
      if (bird.y + bird.r > this.ground) {
        bird.y = this.ground - bird.r;
        gameOver('Grounded', 'You cleared ' + state.score + ' gate' + (state.score === 1 ? '' : 's') + '.');
      }
      if (bird.y - bird.r < 0) {
        bird.y = bird.r;
        bird.vy = 30;
      }
    },
    draw: function () {
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#07172b');
      sky.addColorStop(0.58, '#122c4c');
      sky.addColorStop(1, '#2b2345');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      starfield(45, 'rgba(220, 235, 255, 0.6)');
      var t = performance.now() / 1000;
      ctx.fillStyle = 'rgba(246, 196, 83, 0.9)';
      glow('#f6c453', 24);
      ctx.beginPath();
      ctx.arc(790, 116, 36, 0, Math.PI * 2);
      ctx.fill();
      noGlow();
      ctx.fillStyle = 'rgba(85, 115, 175, 0.28)';
      for (var cloud = 0; cloud < 5; cloud++) {
        var cx = ((cloud * 240 - t * 22) % (W + 300) + W + 300) % (W + 300) - 150;
        var cy = 110 + (cloud % 3) * 72;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 84, 18, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 38, cy - 9, 48, 15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#091526';
      for (var b = 0; b < 18; b++) {
        var bw = 34 + (b % 4) * 16;
        var bh = 70 + (b % 7) * 24;
        ctx.fillRect(b * 58 - 20, this.ground - bh, bw, bh);
      }
      for (var i = 0; i < this.pipes.length; i++) {
        var pipe = this.pipes[i];
        var pipeGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.w, 0);
        pipeGrad.addColorStop(0, '#0e7490');
        pipeGrad.addColorStop(0.5, '#22d3ee');
        pipeGrad.addColorStop(1, '#0e7490');
        ctx.fillStyle = pipeGrad;
        glow('#22d3ee', 10);
        pathRoundRect(pipe.x, -10, pipe.w, pipe.gap + 10, 8);
        ctx.fill();
        pathRoundRect(pipe.x, pipe.gap + pipe.gapH, pipe.w, H - (pipe.gap + pipe.gapH) - this.ground + 20, 8);
        ctx.fill();
        noGlow();
      }
      ctx.fillStyle = '#050b15';
      ctx.fillRect(0, this.ground, W, 46);
      ctx.strokeStyle = 'rgba(34,211,238,.38)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, this.ground);
      ctx.lineTo(W, this.ground);
      ctx.stroke();
      var bird = this.bird;
      var tilt = clamp(bird.vy / 620, -0.55, 0.75);
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(tilt);
      ctx.fillStyle = '#f6c453';
      glow('#f6c453', 22);
      ctx.beginPath();
      ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff7db';
      ctx.beginPath();
      ctx.ellipse(-5, 2, 8, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#07101c';
      ctx.beginPath();
      ctx.arc(5, -5, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(24, 4);
      ctx.lineTo(13, 8);
      ctx.closePath();
      ctx.fill();
      noGlow();
      ctx.restore();
    }
  };

  /* ------------------------------------------------------------------ runner */

  var runner = {
    reset: function () {
      this.ground = H - 72;
      this.player = { x: 160, y: this.ground, w: 38, h: 56, vy: 0, jumps: 0 };
      this.obstacles = [];
      this.spawn = 1.2;
      this.speed = 280;
      this.dist = 0;
      this.stars = [];
      for (var i = 0; i < 70; i++) {
        this.stars.push({ x: rand(0, W), y: rand(0, this.ground - 30), r: rand(0.7, 2.2), layer: rand(0.3, 1) });
      }
      setScore(0);
    },
    jump: function () {
      if (state.over) return;
      if (this.player.jumps < 2) {
        this.player.vy = -650;
        this.player.jumps += 1;
      }
    },
    onAction: function () { this.jump(); },
    onPointer: function () { this.jump(); },
    update: function (dt) {
      var p = this.player;
      p.vy += 1850 * dt;
      p.y += p.vy * dt;
      if (p.y >= this.ground) {
        p.y = this.ground;
        p.vy = 0;
        p.jumps = 0;
      }
      this.speed += 4.5 * dt;
      this.dist += this.speed * dt;
      setScore(Math.floor(this.dist / 12));
      maybeBest(state.score);
      this.spawn -= dt;
      if (this.spawn <= 0) {
        this.spawn = rand(0.82, 1.35) * (300 / this.speed);
        var h = rand(30, 92);
        this.obstacles.push({ x: W + 40, w: rand(28, 52), h: h, y: this.ground - h });
      }
      for (var i = this.obstacles.length - 1; i >= 0; i--) {
        var o = this.obstacles[i];
        o.x -= this.speed * dt;
        if (o.x + o.w < -20) {
          this.obstacles.splice(i, 1);
          continue;
        }
        if (p.x + p.w - 5 > o.x && p.x + 5 < o.x + o.w && p.y - p.h + 4 < o.y + o.h && p.y > o.y) {
          gameOver('Stardust', 'You ran ' + state.score + ' metres before the debris caught you.');
          return;
        }
      }
      for (var s = 0; s < this.stars.length; s++) {
        var star = this.stars[s];
        star.x -= this.speed * star.layer * 0.05 * dt;
        if (star.x < 0) {
          star.x = W;
          star.y = rand(0, this.ground - 30);
        }
      }
    },
    draw: function () {
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#07101f');
      sky.addColorStop(0.6, '#111a36');
      sky.addColorStop(1, '#1d1533');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      for (var s = 0; s < this.stars.length; s++) {
        var star = this.stars[s];
        ctx.globalAlpha = 0.25 + star.layer * 0.6;
        ctx.fillStyle = star.layer > 0.7 ? '#f6c453' : '#cfe1ff';
        ctx.fillRect(star.x, star.y, star.r, star.r);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(124, 140, 255, 0.18)';
      for (var b = 0; b < 14; b++) {
        var bh = 48 + (b % 5) * 38;
        ctx.fillRect(b * 84 - 20, this.ground - bh, 58, bh);
      }
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, this.ground + 2);
      ctx.lineTo(W, this.ground + 2);
      ctx.stroke();
      for (var i = 0; i < this.obstacles.length; i++) {
        var o = this.obstacles[i];
        ctx.fillStyle = '#f472b6';
        glow('#f472b6', 14);
        pathRoundRect(o.x, o.y, o.w, o.h, 5);
        ctx.fill();
        noGlow();
      }
      var p = this.player;
      ctx.fillStyle = 'rgba(34, 211, 238, 0.18)';
      pathRoundRect(p.x - 20, p.y - p.h + 8, 28, p.h - 8, 8);
      ctx.fill();
      ctx.fillStyle = '#22d3ee';
      glow('#22d3ee', 22);
      pathRoundRect(p.x, p.y - p.h, p.w, p.h, 9);
      ctx.fill();
      ctx.fillStyle = '#04121a';
      ctx.fillRect(p.x + 25, p.y - p.h + 15, 6, 6);
      noGlow();
      label('DISTANCE ' + state.score + ' M', 22, 28, 12, 'rgba(190, 210, 255, 0.7)', 'left', 600);
    }
  };

  /* ---------------------------------------------------------------- invaders */

  var invaders = {
    reset: function () {
      this.playerX = W / 2;
      this.lives = 3;
      this.wave = 1;
      this.dir = 1;
      this.speed = 38;
      this.bullets = [];
      this.enemyBullets = [];
      this.shootCd = 0;
      this.enemyTimer = 0.8;
      this.invuln = 0;
      this.aliens = this.makeWave();
      setScore(0);
    },
    makeWave: function () {
      var list = [];
      for (var row = 0; row < 4; row++) {
        for (var col = 0; col < 8; col++) {
          list.push({ x: 190 + col * 80, y: 78 + row * 58, w: 38, h: 30, alive: true, row: row, col: col });
        }
      }
      return list;
    },
    onAction: function () {
      if (state.over) return;
      this.shoot();
    },
    shoot: function () {
      if (this.shootCd > 0) return;
      this.shootCd = 0.24;
      this.bullets.push({ x: this.playerX, y: H - 92, vy: -650 });
    },
    update: function (dt) {
      this.playerX += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 380 * dt;
      this.playerX = clamp(this.playerX, 30, W - 30);
      this.shootCd -= dt;
      this.invuln -= dt;
      if (input.action) this.shoot();

      for (var i = this.bullets.length - 1; i >= 0; i--) {
        var bullet = this.bullets[i];
        bullet.y += bullet.vy * dt;
        if (bullet.y < -20) {
          this.bullets.splice(i, 1);
          continue;
        }
        for (var a = 0; a < this.aliens.length; a++) {
          var alien = this.aliens[a];
          if (!alien.alive) continue;
          if (bullet.x > alien.x && bullet.x < alien.x + alien.w && bullet.y > alien.y && bullet.y < alien.y + alien.h) {
            alien.alive = false;
            this.bullets.splice(i, 1);
            setScore(state.score + 10);
            maybeBest(state.score);
            break;
          }
        }
      }

      var minX = W;
      var maxX = 0;
      var anyAlive = false;
      for (var n = 0; n < this.aliens.length; n++) {
        var live = this.aliens[n];
        if (!live.alive) continue;
        anyAlive = true;
        minX = Math.min(minX, live.x);
        maxX = Math.max(maxX, live.x + live.w);
      }
      if (!anyAlive) {
        this.wave += 1;
        this.speed += 9;
        this.aliens = this.makeWave();
        this.enemyBullets = [];
        this.bullets = [];
        setScore(state.score + 50);
        maybeBest(state.score);
        return;
      }
      for (var m = 0; m < this.aliens.length; m++) {
        if (this.aliens[m].alive) this.aliens[m].x += this.dir * this.speed * dt;
      }
      if ((maxX > W - 62 && this.dir > 0) || (minX < 62 && this.dir < 0)) {
        this.dir *= -1;
        for (var d = 0; d < this.aliens.length; d++) {
          if (this.aliens[d].alive) this.aliens[d].y += 18;
          if (this.aliens[d].alive && this.aliens[d].y + this.aliens[d].h > H - 105) {
            gameOver('Line broken', 'The swarm reached the last line on wave ' + this.wave + '.');
            return;
          }
        }
      }

      this.enemyTimer -= dt;
      if (this.enemyTimer <= 0) {
        this.enemyTimer = rand(0.55, 1.1);
        var shooters = [];
        for (var c = 0; c < 8; c++) {
          var bottom = null;
          for (var r = 0; r < this.aliens.length; r++) {
            var candidate = this.aliens[r];
            if (candidate.alive && candidate.col === c) {
              if (!bottom || candidate.y > bottom.y) bottom = candidate;
            }
          }
          if (bottom) shooters.push(bottom);
        }
        if (shooters.length) {
          var shooter = shooters[randInt(0, shooters.length - 1)];
          this.enemyBullets.push({ x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h, vy: 240 });
        }
      }

      for (var e = this.enemyBullets.length - 1; e >= 0; e--) {
        var enemy = this.enemyBullets[e];
        enemy.y += enemy.vy * dt;
        if (enemy.y > H + 20) {
          this.enemyBullets.splice(e, 1);
          continue;
        }
        if (this.invuln <= 0 && enemy.y > H - 96 && enemy.y < H - 48 && Math.abs(enemy.x - this.playerX) < 24) {
          this.enemyBullets.splice(e, 1);
          this.lives -= 1;
          this.invuln = 1.5;
          if (this.lives <= 0) {
            gameOver('Ship down', 'You held out until wave ' + this.wave + ' with ' + state.score + ' points.');
          }
        }
      }
    },
    draw: function () {
      panel();
      starfield(55);
      for (var a = 0; a < this.aliens.length; a++) {
        var alien = this.aliens[a];
        if (!alien.alive) continue;
        var colors = ['#22d3ee', '#5eead4', '#c084fc', '#f6c453'];
        ctx.fillStyle = colors[alien.row % colors.length];
        glow(colors[alien.row % colors.length], 5);
        pathRoundRect(alien.x, alien.y, alien.w, alien.h, 8);
        ctx.fill();
        ctx.fillStyle = '#06121c';
        ctx.fillRect(alien.x + 9, alien.y + 9, 6, 6);
        ctx.fillRect(alien.x + 23, alien.y + 9, 6, 6);
        ctx.fillRect(alien.x + 14, alien.y + 20, 10, 3);
        noGlow();
      }
      for (var b = 0; b < this.bullets.length; b++) {
        ctx.fillStyle = '#f7fbff';
        glow('#22d3ee', 12);
        ctx.fillRect(this.bullets[b].x - 2, this.bullets[b].y, 4, 16);
        noGlow();
      }
      for (var e = 0; e < this.enemyBullets.length; e++) {
        ctx.fillStyle = '#f472b6';
        glow('#f472b6', 12);
        ctx.fillRect(this.enemyBullets[e].x - 2, this.enemyBullets[e].y, 4, 14);
        noGlow();
      }
      var blink = this.invuln > 0 && Math.floor(performance.now() / 90) % 2 === 0;
      ctx.save();
      ctx.globalAlpha = blink ? 0.3 : 1;
      ctx.fillStyle = '#22d3ee';
      glow('#22d3ee', 22);
      ctx.beginPath();
      ctx.moveTo(this.playerX, H - 96);
      ctx.lineTo(this.playerX - 22, H - 54);
      ctx.lineTo(this.playerX + 22, H - 54);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f7fbff';
      ctx.fillRect(this.playerX - 4, H - 92, 8, 8);
      noGlow();
      ctx.restore();
      label('LIVES ' + this.lives, 22, H - 22, 11, 'rgba(190,210,255,.72)', 'left', 600);
      label('WAVE ' + this.wave, W - 22, H - 22, 11, 'rgba(190,210,255,.72)', 'right', 600);
    }
  };

  /* -------------------------------------------------------------------- pong */

  var pong = {
    reset: function () {
      this.player = { x: 28, y: H / 2 - 50, w: 14, h: 100, target: H / 2 };
      this.ai = { x: W - 42, y: H / 2 - 50, w: 14, h: 100 };
      this.ball = { x: W / 2, y: H / 2, r: 9, vx: -380, vy: rand(-160, 160) };
      this.rally = 0;
      setScore(0);
    },
    onMove: function (p) {
      this.player.target = p.y;
    },
    onPointer: function (p) {
      this.player.target = p.y;
    },
    update: function (dt) {
      if (input.up) this.player.target -= 460 * dt;
      if (input.down) this.player.target += 460 * dt;
      this.player.target = clamp(this.player.target, 50, H - 50);
      this.player.y += (this.player.target - this.player.y - this.player.h / 2) * Math.min(1, dt * 14);
      this.player.y = clamp(this.player.y, 0, H - this.player.h);
      var aiTarget = this.ball.y;
      var aiSpeed = 310;
      if (this.ball.y > this.ai.y + this.ai.h / 2) this.ai.y += aiSpeed * dt;
      else this.ai.y -= aiSpeed * dt;
      this.ai.y = clamp(this.ai.y, 0, H - this.ai.h);

      var ball = this.ball;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy); }

      if (ball.vx < 0 && ball.x - ball.r < this.player.x + this.player.w && ball.x + ball.r > this.player.x &&
        ball.y > this.player.y && ball.y < this.player.y + this.player.h) {
        ball.x = this.player.x + this.player.w + ball.r;
        ball.vx = Math.abs(ball.vx);
        ball.vy += ((ball.y - (this.player.y + this.player.h / 2)) / this.player.h) * 260;
        this.rally += 1;
        setScore(this.rally);
        maybeBest(this.rally);
        ball.vx = Math.min(620, Math.abs(ball.vx) * 1.028);
      }
      if (ball.vx > 0 && ball.x + ball.r > this.ai.x && ball.x - ball.r < this.ai.x + this.ai.w &&
        ball.y > this.ai.y && ball.y < this.ai.y + this.ai.h) {
        ball.x = this.ai.x - ball.r;
        ball.vx = -Math.abs(ball.vx);
        ball.vy += ((ball.y - (this.ai.y + this.ai.h / 2)) / this.ai.h) * 220;
        this.rally += 1;
        setScore(this.rally);
        maybeBest(this.rally);
        ball.vx = Math.max(-620, -Math.abs(ball.vx) * 1.02);
      }
      if (ball.x < -20) {
        gameOver('Rally over', 'You kept the ball alive for ' + this.rally + ' hit' + (this.rally === 1 ? '' : 's') + '.');
      }
      else if (ball.x > W + 20) {
        ball.x = W / 2;
        ball.y = H / 2;
        ball.vx = -380;
        ball.vy = rand(-160, 160);
      }
    },
    draw: function () {
      panel();
      starfield(30, 'rgba(120, 155, 255, 0.3)');
      ctx.strokeStyle = 'rgba(148, 174, 255, 0.2)';
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#22d3ee';
      glow('#22d3ee', 18);
      pathRoundRect(this.player.x, this.player.y, this.player.w, this.player.h, 7);
      ctx.fill();
      ctx.fillStyle = '#c084fc';
      glow('#c084fc', 18);
      pathRoundRect(this.ai.x, this.ai.y, this.ai.w, this.ai.h, 7);
      ctx.fill();
      ctx.fillStyle = '#f7fbff';
      glow('#ffffff', 18);
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
      ctx.fill();
      noGlow();
      label('RALLY ' + this.rally, 24, 24, 12, 'rgba(190,210,255,.7)', 'left', 600);
      label('AI', W - 24, 24, 11, 'rgba(192,132,252,.75)', 'right', 600);
    }
  };

  /* ------------------------------------------------------------------- mines */

  var mines = {
    reset: function () {
      this.cols = 12;
      this.rows = 8;
      this.cell = 58;
      this.ox = (W - this.cols * this.cell) / 2;
      this.oy = (H - this.rows * this.cell) / 2 + 6;
      this.mineCount = 14;
      this.cells = [];
      for (var r = 0; r < this.rows; r++) {
        var row = [];
        for (var c = 0; c < this.cols; c++) row.push({ mine: false, adj: 0, open: false, flag: false });
        this.cells.push(row);
      }
      this.placed = false;
      this.flags = 0;
      this.opened = 0;
      this.startTime = 0;
      this.elapsed = 0;
      this.flagMode = false;
      this.done = false;
      setScore(0);
      bestEl.textContent = '0.0';
      this.updateFlagButton();
    },
    placeMines: function (safeRow, safeCol) {
      var placed = 0;
      while (placed < this.mineCount) {
        var r = randInt(0, this.rows - 1);
        var c = randInt(0, this.cols - 1);
        if (this.cells[r][c].mine) continue;
        if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) continue;
        this.cells[r][c].mine = true;
        placed += 1;
      }
      for (var row = 0; row < this.rows; row++) {
        for (var col = 0; col < this.cols; col++) {
          var count = 0;
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              var nr = row + dr;
              var nc = col + dc;
              if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.cells[nr][nc].mine) count += 1;
            }
          }
          this.cells[row][col].adj = count;
        }
      }
      this.placed = true;
      this.startTime = performance.now();
    },
    reveal: function (row, col) {
      var stack = [[row, col]];
      while (stack.length) {
        var item = stack.pop();
        var r = item[0];
        var c = item[1];
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
        var cell = this.cells[r][c];
        if (cell.open || cell.flag) continue;
        cell.open = true;
        this.opened += 1;
        if (cell.mine) {
          this.done = true;
          gameOver('Boom', 'The field wins this round. Hit play and try a safer first square.');
          return;
        }
        if (cell.adj === 0) {
          for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
              if (dr || dc) stack.push([r + dr, c + dc]);
            }
          }
        }
      }
    },
    checkWin: function () {
      if (this.done) return;
      if (this.opened === this.rows * this.cols - this.mineCount) {
        this.done = true;
        var seconds = Math.max(0.1, (performance.now() - this.startTime) / 1000);
        var bestTime = Number(safeGet('coolArcadeBest:mines-time') || 0);
        if (!bestTime || seconds < bestTime) safeSet('coolArcadeBest:mines-time', seconds.toFixed(1));
        gameOver('Field cleared', 'Clean sweep in ' + seconds.toFixed(1) + ' seconds with ' + this.flags + ' flags placed.');
      }
    },
    toggleFlag: function (row, col) {
      var cell = this.cells[row][col];
      if (cell.open) return;
      cell.flag = !cell.flag;
      this.flags += cell.flag ? 1 : -1;
      setScore(this.flags);
    },
    onPointer: function (p, event) {
      if (this.done) return;
      var col = Math.floor((p.x - this.ox) / this.cell);
      var row = Math.floor((p.y - this.oy) / this.cell);
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
      if (!this.placed) this.placeMines(row, col);
      if (event.button === 2 || this.flagMode) {
        this.toggleFlag(row, col);
        return;
      }
      var cell = this.cells[row][col];
      if (cell.flag) return;
      this.reveal(row, col);
      this.checkWin();
    },
    toggleFlagMode: function () {
      this.flagMode = !this.flagMode;
      this.updateFlagButton();
    },
    updateFlagButton: function () {
      var button = document.getElementById('flagToggle');
      if (!button) return;
      button.classList.toggle('is-active', this.flagMode);
      button.textContent = this.flagMode ? 'Flag mode: on' : 'Flag mode: off';
    },
    update: function () {
      if (this.placed && !this.done) {
        this.elapsed = (performance.now() - this.startTime) / 1000;
        bestEl.textContent = this.elapsed.toFixed(1);
      }
    },
    draw: function () {
      panel();
      starfield(25, 'rgba(130, 170, 255, 0.2)');
      for (var r = 0; r < this.rows; r++) {
        for (var c = 0; c < this.cols; c++) {
          var cell = this.cells[r][c];
          var x = this.ox + c * this.cell;
          var y = this.oy + r * this.cell;
          if (cell.open) {
            ctx.fillStyle = cell.mine ? 'rgba(244, 114, 182, .3)' : 'rgba(21, 35, 60, .95)';
            ctx.fillRect(x + 2, y + 2, this.cell - 4, this.cell - 4);
            if (cell.mine) {
              ctx.fillStyle = '#f472b6';
              ctx.beginPath();
              ctx.arc(x + this.cell / 2, y + this.cell / 2, 8, 0, Math.PI * 2);
              ctx.fill();
            }
            else if (cell.adj > 0) {
              var colors = ['', '#7dd3fc', '#5eead4', '#c084fc', '#f6c453', '#fb7185', '#f97316', '#facc15', '#fda4af'];
              label(String(cell.adj), x + this.cell / 2, y + this.cell / 2 + 1, 19, colors[cell.adj], 'center', 700);
            }
          }
          else {
            ctx.fillStyle = 'rgba(16, 27, 48, .96)';
            ctx.strokeStyle = 'rgba(148, 174, 255, 0.16)';
            ctx.lineWidth = 1;
            pathRoundRect(x + 3, y + 3, this.cell - 6, this.cell - 6, 7);
            ctx.fill();
            ctx.stroke();
            if (cell.flag) {
              ctx.fillStyle = '#f6c453';
              glow('#f6c453', 10);
              ctx.beginPath();
              ctx.moveTo(x + 24, y + 17);
              ctx.lineTo(x + 40, y + 23);
              ctx.lineTo(x + 24, y + 30);
              ctx.closePath();
              ctx.fill();
              ctx.fillRect(x + 22, y + 16, 3, 24);
              noGlow();
            }
          }
        }
      }
      label('RIGHT-CLICK / FLAG TO MARK', this.ox, this.oy - 18, 10, 'rgba(150,170,215,.5)', 'left', 600);
    }
  };

  /* ------------------------------------------------------------------ memory */

  var memory = {
    reset: function () {
      var symbols = ['★', '●', '▲', '◆', '✦', '☾', '♥', '♣'];
      var deck = symbols.concat(symbols);
      for (var i = deck.length - 1; i > 0; i--) {
        var j = randInt(0, i);
        var tmp = deck[i];
        deck[i] = deck[j];
        deck[j] = tmp;
      }
      this.cards = deck.map(function (symbol, index) {
        return { symbol: symbol, index: index, flipped: false, matched: false };
      });
      this.first = null;
      this.lock = false;
      this.moves = 0;
      this.token = (this.token || 0) + 1;
      setScore(0);
    },
    onPointer: function (p) {
      if (this.lock || state.over) return;
      var game = this;
      var cell = this.hit(p.x, p.y);
      if (cell < 0) return;
      var card = this.cards[cell];
      if (card.flipped || card.matched) return;
      card.flipped = true;
      if (this.first === null) {
        this.first = cell;
        return;
      }
      this.moves += 1;
      setScore(this.moves);
      var firstCard = this.cards[this.first];
      if (firstCard.symbol === card.symbol) {
        firstCard.matched = true;
        card.matched = true;
        this.first = null;
        if (this.cards.every(function (item) { return item.matched; })) {
          if (!state.best || this.moves < state.best) setBest(this.moves);
          gameOver('Perfect memory', 'All eight pairs cleared in ' + this.moves + ' moves.');
        }
      }
      else {
        this.lock = true;
        var token = this.token;
        setTimeout(function () {
          if (token !== game.token) return;
          firstCard.flipped = false;
          card.flipped = false;
          game.first = null;
          game.lock = false;
        }, 680);
      }
    },
    hit: function (x, y) {
      var card = 100;
      var gap = 14;
      var ox = (W - (4 * card + 3 * gap)) / 2;
      var oy = 66;
      for (var r = 0; r < 4; r++) {
        for (var c = 0; c < 4; c++) {
          var cx = ox + c * (card + gap);
          var cy = oy + r * (card + gap);
          if (x >= cx && x <= cx + card && y >= cy && y <= cy + card) return r * 4 + c;
        }
      }
      return -1;
    },
    update: function () {},
    draw: function () {
      panel();
      starfield(28, 'rgba(140, 170, 255, 0.3)');
      var card = 100;
      var gap = 14;
      var ox = (W - (4 * card + 3 * gap)) / 2;
      var oy = 66;
      var colors = ['#22d3ee', '#5eead4', '#c084fc', '#f6c453', '#fb7185', '#7c8cff', '#f472b6', '#a3e635'];
      for (var i = 0; i < this.cards.length; i++) {
        var item = this.cards[i];
        var r = Math.floor(i / 4);
        var c = i % 4;
        var x = ox + c * (card + gap);
        var y = oy + r * (card + gap);
        if (item.flipped || item.matched) {
          ctx.fillStyle = item.matched ? 'rgba(18, 34, 42, .55)' : 'rgba(224, 236, 255, .96)';
          glow(item.matched ? 'transparent' : 'rgba(34,211,238,.24)', 12);
          pathRoundRect(x, y, card, card, 12);
          ctx.fill();
          noGlow();
          label(item.symbol, x + card / 2, y + card / 2 + 3, 42, item.matched ? 'rgba(170,190,210,.35)' : colors[i % colors.length], 'center', 700);
        }
        else {
          var back = ctx.createLinearGradient(x, y, x + card, y + card);
          back.addColorStop(0, '#14213d');
          back.addColorStop(1, '#0a1222');
          ctx.fillStyle = back;
          ctx.strokeStyle = 'rgba(148,174,255,.2)';
          ctx.lineWidth = 1;
          pathRoundRect(x, y, card, card, 12);
          ctx.fill();
          ctx.stroke();
          label('C', x + card / 2, y + card / 2 + 2, 34, 'rgba(124,140,255,.55)', 'center', 700);
        }
      }
      label('MOVES ' + this.moves, 24, 28, 11, 'rgba(190,210,255,.65)', 'left', 600);
    }
  };

  /* ---------------------------------------------------------------- connect 4 */

  function winnerOnGrid(board, player) {
    for (var r = 0; r < 6; r++) {
      for (var c = 0; c < 7; c++) {
        if (board[r][c] !== player) continue;
        if (c + 3 < 7 && board[r][c + 1] === player && board[r][c + 2] === player && board[r][c + 3] === player) return true;
        if (r + 3 < 6 && board[r + 1][c] === player && board[r + 2][c] === player && board[r + 3][c] === player) return true;
        if (r + 3 < 6 && c + 3 < 7 && board[r + 1][c + 1] === player && board[r + 2][c + 2] === player && board[r + 3][c + 3] === player) return true;
        if (r + 3 < 6 && c - 3 >= 0 && board[r + 1][c - 1] === player && board[r + 2][c - 2] === player && board[r + 3][c - 3] === player) return true;
      }
    }
    return false;
  }

  var connect4 = {
    wins: 0,
    streak: 0,
    best: Number(safeGet('coolArcadeBest:connect4') || 0),
    reset: function () {
      this.board = [];
      for (var r = 0; r < 6; r++) {
        var row = [];
        for (var c = 0; c < 7; c++) row.push(0);
        this.board.push(row);
      }
      this.turn = 1;
      this.over = false;
      this.token = (this.token || 0) + 1;
      this.hover = -1;
      setScore(this.wins);
      setBest(this.best);
    },
    cellFor: function (p) {
      var cell = 60;
      var ox = (W - 7 * cell) / 2;
      var oy = (H - 6 * cell) / 2 + 10;
      var col = Math.floor((p.x - ox) / cell);
      var row = Math.floor((p.y - oy) / cell);
      if (col < 0 || col > 6) return { col: -1, row: -1, ox: ox, oy: oy, cell: cell };
      return { col: col, row: row, ox: ox, oy: oy, cell: cell };
    },
    onMove: function (p) {
      this.hover = this.cellFor(p).col;
    },
    onPointer: function (p) {
      if (this.over || this.turn !== 1) return;
      var info = this.cellFor(p);
      if (info.col >= 0) this.drop(info.col, 1);
    },
    rowFor: function (col) {
      for (var r = 5; r >= 0; r--) {
        if (this.board[r][col] === 0) return r;
      }
      return -1;
    },
    drop: function (col, player) {
      if (this.over || col < 0) return false;
      var row = this.rowFor(col);
      if (row < 0) return false;
      this.board[row][col] = player;
      if (winnerOnGrid(this.board, player)) {
        this.endRound(player);
        return true;
      }
      if (this.board[0].every(function (value) { return value !== 0; })) {
        this.over = true;
        gameOver('Board full', 'A draw. Reset the board and go again.');
        return true;
      }
      this.turn = player === 1 ? 2 : 1;
      if (player === 1) {
        var token = ++this.token;
        var game = this;
        setTimeout(function () {
          if (token === game.token && !game.over) game.aiMove();
        }, 340);
      }
      return true;
    },
    endRound: function (player) {
      this.over = true;
      this.token += 1;
      if (player === 1) {
        this.wins += 1;
        this.streak += 1;
        if (this.streak > this.best) this.best = this.streak;
        setScore(this.wins);
        setBest(this.best);
        gameOver('You win', 'Four in a row. Current streak: ' + this.streak + '.');
      }
      else {
        this.streak = 0;
        setBest(this.best);
        gameOver('AI wins', 'The house found the line first. Current streak reset.');
      }
    },
    aiMove: function () {
      if (this.over) return;
      var win = this.findMove(2);
      var block = this.findMove(1);
      var col = win >= 0 ? win : (block >= 0 ? block : this.pickColumn());
      this.drop(col, 2);
    },
    findMove: function (player) {
      for (var c = 0; c < 7; c++) {
        var row = this.rowFor(c);
        if (row < 0) continue;
        this.board[row][c] = player;
        var won = winnerOnGrid(this.board, player);
        this.board[row][c] = 0;
        if (won) return c;
      }
      return -1;
    },
    pickColumn: function () {
      var order = [3, 2, 4, 1, 5, 0, 6];
      for (var i = 0; i < order.length; i++) {
        if (this.rowFor(order[i]) >= 0) return order[i];
      }
      return 3;
    },
    update: function () {},
    draw: function () {
      panel();
      starfield(20, 'rgba(130, 170, 255, 0.22)');
      var info = this.cellFor({ x: W / 2, y: H / 2 });
      var ox = info.ox;
      var oy = info.oy;
      var cell = info.cell;
      ctx.fillStyle = 'rgba(10, 28, 58, .96)';
      glow('rgba(34,211,238,.18)', 20);
      pathRoundRect(ox - 14, oy - 14, 7 * cell + 28, 6 * cell + 28, 18);
      ctx.fill();
      noGlow();
      for (var r = 0; r < 6; r++) {
        for (var c = 0; c < 7; c++) {
          var cx = ox + c * cell + cell / 2;
          var cy = oy + r * cell + cell / 2;
          if (this.hover === c && this.turn === 1 && !this.over) {
            ctx.fillStyle = 'rgba(34,211,238,.08)';
            ctx.fillRect(ox + c * cell, oy, cell, 6 * cell);
          }
          ctx.fillStyle = '#050b15';
          ctx.beginPath();
          ctx.arc(cx, cy, cell * 0.37, 0, Math.PI * 2);
          ctx.fill();
          var value = this.board[r][c];
          if (value) {
            ctx.fillStyle = value === 1 ? '#f472b6' : '#f6c453';
            glow(value === 1 ? '#f472b6' : '#f6c453', 10);
            ctx.beginPath();
            ctx.arc(cx, cy, cell * 0.31, 0, Math.PI * 2);
            ctx.fill();
            noGlow();
          }
        }
      }
      label('YOU', 24, H - 20, 10, 'rgba(244,114,182,.8)', 'left', 700);
      label('AI', W - 24, H - 20, 10, 'rgba(246,196,83,.8)', 'right', 700);
    }
  };

  /* ---------------------------------------------------------------- tic tac toe */

  function tttWinner(board) {
    var lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (var i = 0; i < lines.length; i++) {
      var a = lines[i][0];
      var b = lines[i][1];
      var c = lines[i][2];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return 0;
  }
  function tttMinimax(board, player) {
    var winner = tttWinner(board);
    if (winner === 2) return { score: 10 };
    if (winner === 1) return { score: -10 };
    if (board.every(function (value) { return value !== 0; })) return { score: 0 };
    var bestScore = player === 2 ? -Infinity : Infinity;
    for (var i = 0; i < 9; i++) {
      if (board[i] !== 0) continue;
      board[i] = player;
      var result = tttMinimax(board, player === 2 ? 1 : 2);
      board[i] = 0;
      if (player === 2 ? result.score > bestScore : result.score < bestScore) {
        bestScore = result.score;
      }
    }
    return { score: bestScore };
  }

  var tictactoe = {
    wins: 0,
    streak: 0,
    best: Number(safeGet('coolArcadeBest:tictactoe') || 0),
    reset: function () {
      this.board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      this.turn = 1;
      this.token = (this.token || 0) + 1;
      this.over = false;
      setScore(this.wins);
      setBest(this.best);
    },
    cellFor: function (p) {
      var cell = 120;
      var ox = (W - 3 * cell) / 2;
      var oy = (H - 3 * cell) / 2 + 14;
      var col = Math.floor((p.x - ox) / cell);
      var row = Math.floor((p.y - oy) / cell);
      if (col < 0 || col > 2 || row < 0 || row > 2) return -1;
      return row * 3 + col;
    },
    onPointer: function (p) {
      if (this.over || this.turn !== 1) return;
      var index = this.cellFor(p);
      if (index < 0 || this.board[index] !== 0) return;
      this.board[index] = 1;
      if (this.finish()) return;
      this.turn = 2;
      var game = this;
      var token = ++this.token;
      setTimeout(function () {
        if (token === game.token && !game.over) game.aiMove();
      }, 260);
    },
    aiMove: function () {
      if (this.over) return;
      var bestIndex = -1;
      var bestScore = -Infinity;
      if (this.board[4] === 0) {
        bestIndex = 4;
      }
      else {
        for (var i = 0; i < 9; i++) {
          if (this.board[i] !== 0) continue;
          this.board[i] = 2;
          var score = tttMinimax(this.board, 1).score;
          this.board[i] = 0;
          if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }
      }
      if (bestIndex < 0) return;
      this.board[bestIndex] = 2;
      if (this.finish()) return;
      this.turn = 1;
    },
    finish: function () {
      var winner = tttWinner(this.board);
      if (winner === 1) {
        this.over = true;
        this.wins += 1;
        this.streak += 1;
        if (this.streak > this.best) this.best = this.streak;
        setScore(this.wins);
        setBest(this.best);
        gameOver('You win', 'You found the line. Current streak: ' + this.streak + '.');
        return true;
      }
      if (winner === 2) {
        this.over = true;
        this.streak = 0;
        setBest(this.best);
        gameOver('AI wins', 'The AI closed the line. Streak reset — run it back.');
        return true;
      }
      if (this.board.every(function (value) { return value !== 0; })) {
        this.over = true;
        this.streak = 0;
        setBest(this.best);
        gameOver('Draw', 'A perfect draw. That may be the best result available.');
        return true;
      }
      return false;
    },
    update: function () {},
    draw: function () {
      panel();
      starfield(26, 'rgba(130, 170, 255, 0.26)');
      var cell = 120;
      var ox = (W - 3 * cell) / 2;
      var oy = (H - 3 * cell) / 2 + 14;
      ctx.strokeStyle = 'rgba(148,174,255,.2)';
      ctx.lineWidth = 2;
      for (var i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + i * cell, oy);
        ctx.lineTo(ox + i * cell, oy + 3 * cell);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox, oy + i * cell);
        ctx.lineTo(ox + 3 * cell, oy + i * cell);
        ctx.stroke();
      }
      for (var index = 0; index < 9; index++) {
        var value = this.board[index];
        if (!value) continue;
        var row = Math.floor(index / 3);
        var col = index % 3;
        var cx = ox + col * cell + cell / 2;
        var cy = oy + row * cell + cell / 2;
        if (value === 1) {
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 9;
          ctx.lineCap = 'round';
          glow('#22d3ee', 16);
          ctx.beginPath();
          ctx.moveTo(cx - 30, cy - 30); ctx.lineTo(cx + 30, cy + 30);
          ctx.moveTo(cx + 30, cy - 30); ctx.lineTo(cx - 30, cy + 30);
          ctx.stroke();
          noGlow();
        }
        else {
          ctx.strokeStyle = '#f6c453';
          ctx.lineWidth = 8;
          glow('#f6c453', 14);
          ctx.beginPath();
          ctx.arc(cx, cy, 32, 0, Math.PI * 2);
          ctx.stroke();
          noGlow();
        }
      }
      label('YOU = X · AI = O', W / 2, H - 22, 10, 'rgba(190,210,255,.5)', 'center', 600);
    }
  };

  var games = {
    snake: snake,
    breakout: breakout,
    flappy: flappy,
    runner: runner,
    invaders: invaders,
    pong: pong,
    mines: mines,
    memory: memory,
    connect4: connect4,
    tictactoe: tictactoe
  };
  var game = games[GAME] || games.snake;

  /* ----------------------------------------------------------------- boot/UI */

  scoreEl.parentElement.querySelector('span').textContent = cfg.score;
  bestEl.parentElement.querySelector('span').textContent = cfg.best;
  controlsHint.textContent = cfg.controls;
  state.best = readBest();
  bestEl.textContent = state.best ? String(state.best) : '—';

  function begin() {
    state.started = true;
    state.over = false;
    game.reset();
    hideOverlay();
    state.last = performance.now();
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
        '<button type="button" class="pad-action" aria-label="Action">Fire</button>';
      var buttons = touchPad.querySelectorAll('[data-dir]');
      Array.prototype.forEach.call(buttons, function (button) {
        var dir = button.dataset.dir;
        var press = function (event) {
          event.preventDefault();
          input[dir] = true;
          if (game.onDir) game.onDir(dir);
        };
        var release = function () { input[dir] = false; };
        button.addEventListener('pointerdown', press);
        button.addEventListener('pointerup', release);
        button.addEventListener('pointerleave', release);
        button.addEventListener('pointercancel', release);
      });
      var action = touchPad.querySelector('.pad-action');
      action.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        input.action = true;
        if (game.onAction) game.onAction();
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (type) {
        action.addEventListener(type, function () { input.action = false; });
      });
    }
    if (cfg.touch === 'flag') {
      touchPad.innerHTML = '<button type="button" class="flag-toggle" id="flagToggle">Flag mode: off</button>';
      touchPad.querySelector('button').addEventListener('pointerdown', function (event) {
        event.preventDefault();
        if (game.toggleFlagMode) game.toggleFlagMode();
      });
    }
  }

  window.addEventListener('keydown', function (event) {
    var key = event.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(key) >= 0) event.preventDefault();
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
    var dirs = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
    var dir = dirs[key] || dirs[String(key).toLowerCase()];
    if (!dir) return;
    input[dir] = true;
    if (!event.repeat && game.onDir) game.onDir(dir);
  });
  window.addEventListener('keyup', function (event) {
    var dirs = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
    var dir = dirs[event.key] || dirs[String(event.key).toLowerCase()];
    if (dir) input[dir] = false;
    if (event.key === ' ') input.action = false;
  });
  window.addEventListener('blur', function () {
    input.left = input.right = input.up = input.down = input.action = false;
  });

  function pointerPosition(event) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (W / rect.width),
      y: (event.clientY - rect.top) * (H / rect.height)
    };
  }
  canvas.addEventListener('pointerdown', function (event) {
    if (!state.started || state.over) return;
    var p = pointerPosition(event);
    if (game.onPointer) game.onPointer(p, event);
  });
  canvas.addEventListener('pointermove', function (event) {
    var p = pointerPosition(event);
    if (game.onMove) game.onMove(p, event);
  });
  canvas.addEventListener('contextmenu', function (event) { event.preventDefault(); });

  startBtn.addEventListener('click', begin);
  restartBtn.addEventListener('click', begin);

  buildTouchPad();
  game.reset();
  game.draw(0);
  showOverlay(cfg.kicker, cfg.title, cfg.blurb, 'Play');

  function frame(now) {
    requestAnimationFrame(frame);
    if (!state.last) state.last = now;
    var dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    if (state.started && !state.over) game.update(dt);
    game.draw(dt);
  }
  requestAnimationFrame(frame);
})();
