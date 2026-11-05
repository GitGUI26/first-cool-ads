/* Tidepool — gather shells, dodge gulls, and keep the little crab moving. */
(function () {
  var A = window.CoolOriginals;
  A.register('tidepool', {
    kicker: 'SHALLOW WATER',
    title: 'Tidepool',
    blurb: 'Skitter through the shallows, scoop up lost shells, and keep one eye on the sky.',
    controls: 'Arrows / WASD or the pad to scuttle · Dash when a gull gets close',
    score: 'Score',
    best: 'Best',
    touch: 'dpad',
    actionLabel: 'Dash'
  }, function (api) {
    var W = api.W, H = api.H, ctx = api.ctx;
    var clamp = api.clamp, rand = api.rand;
    var setScore = api.setScore, maybeBest = api.maybeBest, gameOver = api.gameOver;
    var panel = api.panel, label = api.label, glow = api.glow, noGlow = api.noGlow;
    var input = api.input;

    return {
      reset: function () {
        this.x = W / 2;
        this.y = H / 2;
        this.vx = 0;
        this.vy = 0;
        this.faceX = 1;
        this.faceY = 0;
        this.time = 50;
        this.score = 0;
        this.shells = [];
        this.gulls = [];
        this.particles = [];
        this.shellTimer = 0.7;
        this.gullTimer = 1.4;
        this.dash = 0;
        this.cooldown = 0;
        this.invuln = 0;
        this.hit = 0;
        setScore(0);
      },
      update: function (dt) {
        this.time -= dt;
        if (this.time <= 0) {
          this.time = 0;
          gameOver('The tide went out', 'The crab made it home with ' + this.score + ' points of shells.');
          return;
        }
        if (this.dash > 0) this.dash = Math.max(0, this.dash - dt);
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
        if (this.hit > 0) this.hit = Math.max(0, this.hit - dt);
        var ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        var ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
        if (ax || ay) {
          this.faceX = ax || this.faceX;
          this.faceY = ay || this.faceY;
        }
        this.vx += ax * 560 * dt;
        this.vy += ay * 560 * dt;
        this.vx -= this.vx * 3.2 * dt;
        this.vy -= this.vy * 3.2 * dt;
        this.x = clamp(this.x + this.vx * dt, 52, W - 52);
        this.y = clamp(this.y + this.vy * dt, 105, H - 62);
        this.shellTimer -= dt;
        if (this.shellTimer <= 0) {
          this.shellTimer = rand(0.9, 1.6);
          if (this.shells.length < 7) {
            this.shells.push({ x: rand(75, W - 75), y: rand(130, H - 90), phase: rand(0, 6) });
          }
        }
        this.gullTimer -= dt;
        if (this.gullTimer <= 0) {
          this.gullTimer = rand(1.9, 3.1);
          var fromLeft = Math.random() > 0.5;
          this.gulls.push({
            x: fromLeft ? -40 : W + 40,
            y: rand(135, H - 115),
            vx: fromLeft ? rand(95, 150) : -rand(95, 150),
            phase: rand(0, 6)
          });
        }
        for (var s = this.shells.length - 1; s >= 0; s--) {
          var shell = this.shells[s];
          if (Math.hypot(this.x - shell.x, this.y - shell.y) < 28) {
            this.score += 15;
            setScore(this.score);
            maybeBest(this.score);
            this.shells.splice(s, 1);
            this.burst(shell.x, shell.y, '#f6c453');
          }
        }
        for (var g = this.gulls.length - 1; g >= 0; g--) {
          var gull = this.gulls[g];
          gull.x += gull.vx * dt;
          gull.y += Math.sin(performance.now() / 430 + gull.phase) * 16 * dt;
          if (Math.hypot(this.x - gull.x, this.y - gull.y) < 29 && this.invuln <= 0) {
            this.time = Math.max(0, this.time - 5);
            this.invuln = 1.5;
            this.hit = 0.35;
            this.burst(this.x, this.y, '#ff5d6c');
          }
          if (gull.x < -80 || gull.x > W + 80) this.gulls.splice(g, 1);
        }
        for (var p = this.particles.length - 1; p >= 0; p--) {
          var particle = this.particles[p];
          particle.life -= dt;
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          if (particle.life <= 0) this.particles.splice(p, 1);
        }
      },
      burst: function (x, y, color) {
        for (var i = 0; i < 10; i++) {
          this.particles.push({
            x: x,
            y: y,
            vx: rand(-90, 90),
            vy: rand(-90, 90),
            life: rand(0.22, 0.55),
            color: color
          });
        }
      },
      onAction: function () {
        if (this.cooldown > 0) return;
        var length = Math.hypot(this.faceX, this.faceY) || 1;
        this.vx += (this.faceX / length) * 290;
        this.vy += (this.faceY / length) * 290;
        this.dash = 0.2;
        this.cooldown = 1.8;
        this.burst(this.x, this.y, '#5eead4');
      },
      draw: function () {
        panel();
        var water = ctx.createLinearGradient(0, 70, 0, H);
        water.addColorStop(0, '#0d3b4b');
        water.addColorStop(0.55, '#0a2f40');
        water.addColorStop(1, '#061f2f');
        ctx.fillStyle = water;
        ctx.fillRect(0, 70, W, H - 70);
        for (var w = 0; w < 7; w++) {
          ctx.strokeStyle = 'rgba(120, 230, 230, ' + (0.035 + w * 0.008) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (var x = 0; x <= W; x += 20) {
            var y = 120 + w * 55 + Math.sin(x * 0.018 + performance.now() / 1200 + w) * 8;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (var r = 0; r < 6; r++) {
          var rx = 35 + r * 178;
          ctx.fillStyle = 'rgba(10, 25, 32, 0.7)';
          ctx.beginPath();
          ctx.ellipse(rx, H - 18, 50, 24, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(94, 234, 212, 0.18)';
          ctx.beginPath();
          ctx.ellipse(rx, H - 30, 24, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        for (var s = 0; s < this.shells.length; s++) {
          var shell = this.shells[s];
          ctx.save();
          ctx.translate(shell.x, shell.y + Math.sin(performance.now() / 500 + shell.phase) * 3);
          glow('#f6c453', 14);
          ctx.fillStyle = '#f6c453';
          ctx.beginPath();
          ctx.arc(0, 0, 11, Math.PI, 0);
          ctx.lineTo(0, 8);
          ctx.closePath();
          ctx.fill();
          noGlow();
          ctx.strokeStyle = 'rgba(95, 65, 25, 0.6)';
          ctx.lineWidth = 1;
          for (var line = -6; line <= 6; line += 4) {
            ctx.beginPath();
            ctx.moveTo(0, 7);
            ctx.lineTo(line, -8);
            ctx.stroke();
          }
          ctx.restore();
        }
        for (var g = 0; g < this.gulls.length; g++) {
          var gull = this.gulls[g];
          var flap = Math.sin(performance.now() / 160 + gull.phase) * 7;
          ctx.strokeStyle = 'rgba(225, 240, 255, 0.78)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(gull.x - 18, gull.y + flap);
          ctx.quadraticCurveTo(gull.x - 7, gull.y - 8, gull.x, gull.y);
          ctx.quadraticCurveTo(gull.x + 7, gull.y - 8, gull.x + 18, gull.y + flap);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.beginPath();
          ctx.ellipse(gull.x, gull.y + 36, 13, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        for (var p = 0; p < this.particles.length; p++) {
          var particle = this.particles[p];
          ctx.globalAlpha = Math.max(0, particle.life * 1.7);
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.dash > 0) {
          glow('#5eead4', 24);
        }
        ctx.fillStyle = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 ? '#d8fff9' : '#f47b50';
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        noGlow();
        ctx.fillStyle = '#ffb08a';
        ctx.beginPath();
        ctx.arc(-7, 3, 8, 0, Math.PI * 2);
        ctx.arc(7, 3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f47b50';
        ctx.lineWidth = 3;
        for (var leg = -1; leg <= 1; leg++) {
          ctx.beginPath();
          ctx.moveTo(leg * 11, 8);
          ctx.lineTo(leg * 17 + 3, 18);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(leg * 11, -8);
          ctx.lineTo(leg * 17 + 3, -17);
          ctx.stroke();
        }
        ctx.fillStyle = '#07141d';
        ctx.beginPath();
        ctx.arc(-6, -6, 2.5, 0, Math.PI * 2);
        ctx.arc(6, -6, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        label('SHELLS ' + this.score, 24, 24, 11, 'rgba(190, 235, 235, 0.8)', 'left', 700);
        label('TIME ' + this.time.toFixed(1), W - 24, 24, 11, this.time < 10 ? '#ff5d6c' : 'rgba(190, 235, 235, 0.7)', 'right', 700);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(24, 38, 160, 4);
        ctx.fillStyle = this.time < 10 ? '#ff5d6c' : '#5eead4';
        ctx.fillRect(24, 38, 160 * (this.time / 50), 4);
        if (this.hit > 0) {
          ctx.fillStyle = 'rgba(255, 70, 90, ' + this.hit * 0.25 + ')';
          ctx.fillRect(0, 0, W, H);
        }
        label(this.cooldown > 0 ? 'DASH RECHARGING' : 'DASH READY', W / 2, H - 24, 9, this.cooldown > 0 ? 'rgba(160, 200, 210, 0.35)' : 'rgba(94, 234, 212, 0.7)', 'center', 600);
      }
    };
  });
})();
