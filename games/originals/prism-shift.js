/* Prism Shift — match the prism to the falling crystals. */
(function () {
  var A = window.CoolOriginals;
  A.register('prism-shift', {
    kicker: 'COLOR ARCADE',
    title: 'Prism Shift',
    blurb: 'Slide between lanes, shift your prism color, and absorb every crystal that comes your way.',
    controls: 'Left / right or tap a lane · Space / Shift cycles color',
    score: 'Score',
    best: 'Best',
    touch: 'dpad',
    actionLabel: 'Shift'
  }, function (api) {
    var W = api.W, H = api.H, ctx = api.ctx;
    var clamp = api.clamp, randInt = api.randInt;
    var setScore = api.setScore, maybeBest = api.maybeBest, gameOver = api.gameOver;
    var panel = api.panel, label = api.label, glow = api.glow, noGlow = api.noGlow;
    var input = api.input;
    var COLORS = [
      { name: 'ROSE', color: '#ff5d8f' },
      { name: 'CYAN', color: '#22d3ee' },
      { name: 'GOLD', color: '#f6c453' }
    ];
    var LANE_X = [W / 2 - 190, W / 2, W / 2 + 190];

    return {
      reset: function () {
        this.lane = 1;
        this.color = 0;
        this.lives = 3;
        this.crystals = [];
        this.elapsed = 0;
        this.spawn = 0.8;
        this.score = 0;
        this.hit = 0;
        this.flash = 0;
        setScore(0);
      },
      onDir: function (dir) {
        if (dir === 'left') this.lane = clamp(this.lane - 1, 0, 2);
        if (dir === 'right') this.lane = clamp(this.lane + 1, 0, 2);
      },
      onAction: function () {
        this.color = (this.color + 1) % COLORS.length;
        this.flash = 0.16;
      },
      onPointerDown: function (p) {
        if (p.y > H - 170) {
          this.onAction();
        } else {
          this.lane = clamp(Math.floor(p.x / (W / 3)), 0, 2);
        }
      },
      update: function (dt) {
        this.elapsed += dt;
        this.spawn -= dt;
        if (this.hit > 0) this.hit = Math.max(0, this.hit - dt);
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
        if (this.spawn <= 0) {
          this.spawn = Math.max(0.42, 1.05 - this.elapsed * 0.012);
          this.crystals.push({
            lane: randInt(0, 2),
            color: randInt(0, 2),
            y: -24,
            speed: 150 + this.elapsed * 4.5
          });
        }
        for (var i = this.crystals.length - 1; i >= 0; i--) {
          var crystal = this.crystals[i];
          crystal.y += crystal.speed * dt;
          if (crystal.y < H - 88) continue;
          if (crystal.lane === this.lane) {
            if (crystal.color === this.color) {
              this.score += 25;
              setScore(this.score);
              maybeBest(this.score);
            } else {
              this.lives -= 1;
              this.hit = 0.45;
              if (this.lives <= 0) {
                gameOver('Prism overload', 'The wrong color shattered the core. Final score: ' + this.score + '.');
                return;
              }
            }
          }
          this.crystals.splice(i, 1);
        }
      },
      draw: function () {
        panel();
        for (var i = 0; i < 3; i++) {
          var x = LANE_X[i];
          ctx.fillStyle = i === this.lane ? 'rgba(34, 211, 238, 0.055)' : 'rgba(255, 255, 255, 0.018)';
          ctx.fillRect(x - 78, 36, 156, H - 96);
          ctx.strokeStyle = 'rgba(120, 160, 220, 0.13)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - 78, 36);
          ctx.lineTo(x - 78, H - 60);
          ctx.moveTo(x + 78, 36);
          ctx.lineTo(x + 78, H - 60);
          ctx.stroke();
        }
        for (var c = 0; c < this.crystals.length; c++) {
          var crystal = this.crystals[c];
          var cx = LANE_X[crystal.lane];
          var color = COLORS[crystal.color].color;
          ctx.save();
          ctx.translate(cx, crystal.y);
          ctx.rotate(Math.PI / 4);
          glow(color, 14);
          ctx.fillStyle = color;
          ctx.fillRect(-10, -10, 20, 20);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(-4, -4, 6, 6);
          noGlow();
          ctx.restore();
        }
        var shipX = LANE_X[this.lane];
        var shipColor = COLORS[this.color].color;
        ctx.save();
        ctx.translate(shipX, H - 62);
        glow(shipColor, 24);
        ctx.fillStyle = shipColor;
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(26, 24);
        ctx.lineTo(0, 12);
        ctx.lineTo(-26, 24);
        ctx.closePath();
        ctx.fill();
        noGlow();
        ctx.fillStyle = 'rgba(5, 12, 20, 0.8)';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        label('SHIELD ' + COLORS[this.color].name, shipX, H - 24, 11, shipColor, 'center', 700);
        label('SCORE ' + this.score, 24, 25, 11, 'rgba(210, 225, 255, 0.7)', 'left', 600);
        label('LIVES', W - 114, 25, 10, 'rgba(210, 225, 255, 0.55)', 'left', 600);
        for (var l = 0; l < 3; l++) {
          ctx.fillStyle = l < this.lives ? '#ff5d8f' : 'rgba(255, 255, 255, 0.12)';
          ctx.beginPath();
          ctx.arc(W - 58 + l * 17, 25, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (this.hit > 0) {
          ctx.fillStyle = 'rgba(255, 60, 100, ' + (this.hit * 0.22) + ')';
          ctx.fillRect(0, 0, W, H);
        }
        if (this.flash > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, ' + (this.flash * 0.15) + ')';
          ctx.fillRect(0, 0, W, H);
        }
        label('MOVE LANES · MATCH THE COLOR', W / 2, 28, 10, 'rgba(190, 215, 255, 0.52)', 'center', 600);
      }
    };
  });
})();
