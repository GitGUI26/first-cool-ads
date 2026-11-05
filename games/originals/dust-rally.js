/* Dust Rally — collect desert checkpoints before the timer runs dry. */
(function () {
  var A = window.CoolOriginals;
  A.register('dust-rally', {
    kicker: 'DESERT CIRCUIT',
    title: 'Dust Rally',
    blurb: 'Throw a rally car into the dust, sweep the checkpoint ring, and beat the clock.',
    controls: 'Arrows / WASD or the pad to drive · hold Boost for extra speed',
    score: 'Score',
    best: 'Best',
    touch: 'dpad',
    actionLabel: 'Boost'
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
        this.angle = -Math.PI / 2;
        this.speed = 0;
        this.time = 34;
        this.score = 0;
        this.index = 0;
        this.rocks = [];
        this.dust = [];
        this.invuln = 0;
        this.shake = 0;
        this.makeCourse();
        setScore(0);
      },
      makeCourse: function () {
        this.checkpoints = [];
        for (var i = 0; i < 8; i++) {
          var angle = -Math.PI / 2 + i * (Math.PI * 2 / 8);
          this.checkpoints.push({
            x: W / 2 + Math.cos(angle) * 300,
            y: H / 2 + Math.sin(angle) * 190
          });
        }
        var start = { x: W / 2, y: H / 2 };
        while (this.rocks.length < 17) {
          var rock = { x: rand(55, W - 55), y: rand(90, H - 55), size: rand(10, 21) };
          if (Math.hypot(rock.x - start.x, rock.y - start.y) < 100) continue;
          var blocked = false;
          for (var c = 0; c < this.checkpoints.length; c++) {
            if (Math.hypot(rock.x - this.checkpoints[c].x, rock.y - this.checkpoints[c].y) < 75) blocked = true;
          }
          if (!blocked) this.rocks.push(rock);
        }
      },
      update: function (dt) {
        this.time -= dt;
        if (this.time <= 0) {
          this.time = 0;
          gameOver('Out of time', 'The desert claimed another rally. Checkpoints: ' + this.index + '.');
          return;
        }
        if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
        if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
        var throttle = input.up ? 1 : input.down ? -0.55 : 0;
        this.speed += throttle * 215 * dt;
        if (input.action && this.speed > 0) this.speed += 280 * dt;
        this.speed *= 0.995;
        this.speed = clamp(this.speed, -95, 430);
        var steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (steer) {
          var turn = 1.9 + Math.min(1.4, Math.abs(this.speed) / 260);
          this.angle += steer * turn * dt * (this.speed >= 0 ? 1 : -1);
        }
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
        if (this.x < 32) { this.x = 32; this.speed *= 0.68; }
        if (this.x > W - 32) { this.x = W - 32; this.speed *= 0.68; }
        if (this.y < 76) { this.y = 76; this.speed *= 0.68; }
        if (this.y > H - 32) { this.y = H - 32; this.speed *= 0.68; }
        if (Math.abs(this.speed) > 85) {
          this.dust.push({
            x: this.x - Math.cos(this.angle) * 22,
            y: this.y - Math.sin(this.angle) * 22,
            life: 0.55,
            size: rand(4, 9)
          });
        }
        for (var d = this.dust.length - 1; d >= 0; d--) {
          this.dust[d].life -= dt;
          this.dust[d].size += dt * 12;
          if (this.dust[d].life <= 0) this.dust.splice(d, 1);
        }
        var next = this.checkpoints[this.index];
        if (next && Math.hypot(this.x - next.x, this.y - next.y) < 49) {
          this.index += 1;
          this.score += 100;
          this.time += 4.5;
          setScore(this.score);
          maybeBest(this.score);
          if (this.index >= this.checkpoints.length) {
            var bonus = Math.round(this.time * 12);
            this.score += bonus;
            setScore(this.score);
            maybeBest(this.score);
            gameOver('Stage cleared', 'All eight checkpoints in one run. Time bonus: ' + bonus + '.');
            return;
          }
        }
        for (var r = 0; r < this.rocks.length; r++) {
          var rock = this.rocks[r];
          if (Math.hypot(this.x - rock.x, this.y - rock.y) < rock.size + 19) {
            if (this.invuln <= 0) {
              this.time = Math.max(0, this.time - 2);
              this.speed *= -0.35;
              this.invuln = 1.2;
              this.shake = 0.35;
              this.x -= Math.cos(this.angle) * 12;
              this.y -= Math.sin(this.angle) * 12;
            }
            break;
          }
        }
      },
      draw: function () {
        panel();
        var sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#21162a');
        sky.addColorStop(0.48, '#4c2d39');
        sky.addColorStop(1, '#9b5d3a');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255, 186, 108, 0.55)';
        ctx.beginPath();
        ctx.arc(W - 150, 95, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(35, 25, 42, 0.7)';
        ctx.beginPath();
        ctx.moveTo(0, 230);
        ctx.lineTo(145, 180); ctx.lineTo(260, 230); ctx.lineTo(380, 165);
        ctx.lineTo(510, 220); ctx.lineTo(690, 172); ctx.lineTo(820, 218);
        ctx.lineTo(W, 175); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fill();
        var path = ctx.createLinearGradient(0, 0, 0, H);
        path.addColorStop(0, 'rgba(122, 67, 40, 0.8)');
        path.addColorStop(1, '#4a261d');
        ctx.fillStyle = path;
        ctx.beginPath();
        ctx.moveTo(0, H * 0.45);
        ctx.quadraticCurveTo(W * 0.28, H * 0.28, W * 0.52, H * 0.48);
        ctx.quadraticCurveTo(W * 0.78, H * 0.7, W, H * 0.46);
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fill();
        ctx.save();
        if (this.shake > 0) ctx.translate(rand(-4, 4), rand(-4, 4));
        ctx.strokeStyle = 'rgba(255, 211, 150, 0.2)';
        ctx.setLineDash([8, 16]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (var p = 0; p < this.checkpoints.length; p++) {
          var cp = this.checkpoints[p];
          if (p === 0) ctx.moveTo(cp.x, cp.y);
          else ctx.lineTo(cp.x, cp.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        for (var i = 0; i < this.checkpoints.length; i++) {
          var check = this.checkpoints[i];
          var active = i === this.index;
          ctx.strokeStyle = i < this.index ? 'rgba(94, 234, 212, 0.28)' :
            active ? '#f6c453' : 'rgba(255, 220, 170, 0.27)';
          ctx.lineWidth = active ? 4 : 2;
          if (active) glow('#f6c453', 18);
          ctx.beginPath();
          ctx.arc(check.x, check.y, active ? 31 : 24, 0, Math.PI * 2);
          ctx.stroke();
          noGlow();
          label(String(i + 1), check.x, check.y, active ? 14 : 10, active ? '#f6c453' : 'rgba(255, 225, 180, 0.5)', 'center', 700);
        }
        for (var d = 0; d < this.dust.length; d++) {
          var particle = this.dust[d];
          ctx.fillStyle = 'rgba(228, 174, 116, ' + (particle.life * 0.45) + ')';
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        }
        for (var r = 0; r < this.rocks.length; r++) {
          var rock = this.rocks[r];
          ctx.fillStyle = '#36251f';
          ctx.beginPath();
          ctx.arc(rock.x, rock.y, rock.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 208, 160, 0.18)';
          ctx.beginPath();
          ctx.arc(rock.x - rock.size * 0.28, rock.y - rock.size * 0.28, rock.size * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 4, 28, 17, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.invuln > 0 && Math.floor(this.invuln * 10) % 2 ? '#5eead4' : '#f6c453';
        ctx.fillRect(-23, -14, 46, 28);
        ctx.fillStyle = '#182330';
        ctx.fillRect(-11, -9, 22, 18);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(13, -11, 6, 7);
        ctx.fillRect(13, 4, 6, 7);
        ctx.fillStyle = '#0e151f';
        ctx.fillRect(-24, -17, 12, 6);
        ctx.fillRect(14, -17, 12, 6);
        ctx.fillRect(-24, 11, 12, 6);
        ctx.fillRect(14, 11, 12, 6);
        ctx.restore();
        ctx.restore();
        label('TIME ' + this.time.toFixed(1) + 's', 24, 26, 13, this.time < 7 ? '#ff5d6c' : '#f6c453', 'left', 700);
        label('CHECKPOINT ' + Math.min(this.index, 8) + ' / 8', W - 24, 26, 11, 'rgba(255, 230, 190, 0.7)', 'right', 600);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fillRect(24, 38, 180, 4);
        ctx.fillStyle = this.time < 7 ? '#ff5d6c' : '#f6c453';
        ctx.fillRect(24, 38, 180 * clamp(this.time / 34, 0, 1), 4);
      }
    };
  });
})();
