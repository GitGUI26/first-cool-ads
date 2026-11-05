/* Signal Lost — tune the dial and lock onto hidden broadcasts. */
(function () {
  var A = window.CoolOriginals;
  A.register('signal-lost', {
    kicker: 'RADIO PUZZLE',
    title: 'Signal Lost',
    blurb: 'Sweep the dial through the static, find the hidden frequency, and lock five broadcasts before time runs out.',
    controls: 'Left / right to tune · Space / Lock when the signal is strong',
    score: 'Score',
    best: 'Best',
    touch: 'dpad',
    actionLabel: 'Lock'
  }, function (api) {
    var W = api.W, H = api.H, ctx = api.ctx;
    var clamp = api.clamp, rand = api.rand;
    var setScore = api.setScore, maybeBest = api.maybeBest, gameOver = api.gameOver;
    var panel = api.panel, label = api.label, glow = api.glow, noGlow = api.noGlow;
    var input = api.input;

    return {
      reset: function () {
        this.score = 0;
        this.stations = 0;
        this.time = 55;
        this.target = rand(18, 82);
        this.tune = rand(0, 100);
        this.hold = 0;
        this.flash = 0;
        this.message = 'SWEEP FOR A CARRIER';
        setScore(0);
      },
      nextTarget: function () {
        var old = this.target;
        for (var i = 0; i < 20; i++) {
          this.target = rand(15, 85);
          if (Math.abs(this.target - old) > 18) break;
        }
        this.tune = rand(0, 100);
        this.hold = 0;
        this.message = 'SIGNAL LOCKED';
      },
      update: function (dt) {
        this.time -= dt;
        if (this.time <= 0) {
          gameOver('Dead air', 'The band closed before you found all five stations. Score: ' + this.score + '.');
          return;
        }
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
        var direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        this.tune = clamp(this.tune + direction * 31 * dt, 0, 100);
        var diff = Math.abs(this.tune - this.target);
        if (diff < 1.2) {
          this.hold += dt;
          if (this.hold > 0.7) this.lock();
        } else {
          this.hold = 0;
        }
      },
      onAction: function () {
        if (Math.abs(this.tune - this.target) < 5) this.lock();
      },
      lock: function () {
        var diff = Math.abs(this.tune - this.target);
        if (diff > 2.5) return;
        var points = 100 + Math.round((1 - diff / 2.5) * 150) + Math.round(this.time * 2);
        this.score += points;
        this.stations += 1;
        this.flash = 0.75;
        setScore(this.score);
        maybeBest(this.score);
        if (this.stations >= 5) {
          gameOver('Band recovered', 'Five stations locked. Final score: ' + this.score + '.');
          return;
        }
        this.nextTarget();
      },
      draw: function () {
        panel();
        var cx = W / 2;
        var cy = 292;
        var dial = 152;
        ctx.fillStyle = 'rgba(7, 19, 29, 0.88)';
        ctx.beginPath();
        ctx.arc(cx, cy, dial, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, dial, 0, Math.PI * 2);
        ctx.stroke();
        for (var i = 0; i <= 20; i++) {
          var angle = (-135 + i * 13.5) * Math.PI / 180;
          var inner = i % 5 === 0 ? dial - 20 : dial - 10;
          ctx.strokeStyle = i % 5 === 0 ? 'rgba(180, 240, 230, 0.48)' : 'rgba(150, 195, 210, 0.2)';
          ctx.lineWidth = i % 5 === 0 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
          ctx.lineTo(cx + Math.cos(angle) * (dial - 2), cy + Math.sin(angle) * (dial - 2));
          ctx.stroke();
        }
        var needleAngle = (-135 + this.tune * 2.7) * Math.PI / 180;
        glow('#5eead4', 18);
        ctx.strokeStyle = '#5eead4';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(needleAngle) * (dial - 30), cy + Math.sin(needleAngle) * (dial - 30));
        ctx.stroke();
        noGlow();
        ctx.fillStyle = '#d8fff9';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        label('FREQUENCY ' + this.tune.toFixed(1), cx, cy + 62, 14, '#d8fff9', 'center', 700);
        label('MHz', cx, cy + 82, 9, 'rgba(160, 220, 210, 0.45)', 'center', 600);

        var diff = Math.abs(this.tune - this.target);
        var strength = clamp(1 - diff / 35, 0, 1);
        var display = Math.round(strength * 100);
        label('SIGNAL ' + display + '%', 24, 42, 12, strength > 0.82 ? '#5eead4' : 'rgba(190, 225, 220, 0.65)', 'left', 700);
        for (var b = 0; b < 12; b++) {
          var height = 6 + b * 2;
          var on = strength * 12 > b;
          ctx.fillStyle = on ? (strength > 0.82 ? '#5eead4' : 'rgba(94, 234, 212, 0.55)') : 'rgba(94, 234, 212, 0.1)';
          ctx.fillRect(24 + b * 11, 62 - height, 7, height);
        }
        ctx.save();
        ctx.globalAlpha = 0.34 + strength * 0.5;
        ctx.strokeStyle = '#5eead4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        var points = 90;
        for (var p = 0; p < points; p++) {
          var px = 24 + p * 5;
          var wave = Math.sin(p * 0.42 + performance.now() / 95) * (2 + strength * 16);
          var noise = (1 - strength) * (Math.random() * 10 - 5);
          var py = 122 + wave + noise;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
        for (var n = 0; n < 16; n++) {
          ctx.fillStyle = 'rgba(170, 255, 240, ' + (0.05 + Math.random() * 0.18 * (1 - strength)) + ')';
          ctx.fillRect(24 + Math.random() * 430, 102 + Math.random() * 42, 2, 2);
        }
        label('STATIONS ' + this.stations + ' / 5', W - 24, 42, 10, 'rgba(190, 225, 220, 0.65)', 'right', 600);
        label('TIME ' + this.time.toFixed(1), W - 24, 62, 11, this.time < 10 ? '#ff5d6c' : 'rgba(190, 225, 220, 0.65)', 'right', 600);
        label(this.flash > 0 ? 'CARRIER LOCKED' : (strength > 0.9 ? 'LOCK READY' : 'MOVE THE DIAL UNTIL THE STATIC CLEARS'),
          W / 2, H - 23, 10, this.flash > 0 ? '#5eead4' : (strength > 0.9 ? '#f6c453' : 'rgba(170, 210, 220, 0.55)'), 'center', 600);
        if (this.flash > 0) {
          ctx.strokeStyle = 'rgba(94, 234, 212, ' + this.flash * 0.4 + ')';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, dial + 12 + (0.75 - this.flash) * 25, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };
  });
})();
