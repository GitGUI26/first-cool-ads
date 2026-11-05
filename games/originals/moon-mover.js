/* Moon Mover — a small lunar lander with three pads to reach. */
(function () {
  var A = window.CoolOriginals;
  A.register('moon-mover', {
    kicker: 'LUNAR LANDER',
    title: 'Moon Mover',
    blurb: 'Feather the thrusters and set all three moon pads down gently before the fuel runs dry.',
    controls: 'Left / right to steer · hold thrust · land slowly on the glowing pad',
    score: 'Score',
    best: 'Best',
    touch: 'dpad',
    actionLabel: 'Thrust'
  }, function (api) {
    var W = api.W, H = api.H, ctx = api.ctx;
    var clamp = api.clamp, rand = api.rand;
    var setScore = api.setScore, maybeBest = api.maybeBest, gameOver = api.gameOver;
    var panel = api.panel, starfield = api.starfield, label = api.label, glow = api.glow, noGlow = api.noGlow;
    var input = api.input;
    var GROUND = H - 80;

    return {
      reset: function () {
        this.level = 1;
        this.score = 0;
        this.setup();
        setScore(0);
      },
      setup: function () {
        this.padW = 140;
        this.padX = rand(130, W - 130 - this.padW);
        this.x = rand(160, W - 160);
        this.y = 72;
        this.vx = rand(-22, 22);
        this.vy = 0;
        this.fuel = 100;
        this.landed = false;
        this.transition = 0;
        this.flame = 0;
        this.message = '';
      },
      update: function (dt) {
        if (this.landed) {
          this.transition -= dt;
          if (this.transition <= 0) {
            if (this.level >= 3) {
              gameOver('All pads reached', 'Three soft landings and one very relieved pilot. Final score: ' + this.score + '.');
            } else {
              this.level += 1;
              this.setup();
            }
          }
          return;
        }
        var thrust = input.up || input.action;
        if (thrust && this.fuel > 0) {
          this.vy -= 165 * dt;
          this.fuel = Math.max(0, this.fuel - 23 * dt);
          this.flame = 0.12;
        } else {
          this.flame = 0;
        }
        var steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        this.vx += steer * 145 * dt;
        this.vx *= 0.996;
        this.vy += 58 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.x < 24) { this.x = 24; this.vx = 0; }
        if (this.x > W - 24) { this.x = W - 24; this.vx = 0; }
        if (this.y < 28) { this.y = 28; this.vy = Math.max(0, this.vy); }
        if (this.y >= GROUND - 18) {
          this.y = GROUND - 18;
          var overPad = this.x >= this.padX && this.x <= this.padX + this.padW;
          if (overPad && Math.abs(this.vy) < 155 && Math.abs(this.vx) < 82) {
            var points = 500 + Math.round(this.fuel) * 4 + this.level * 100;
            this.score += points;
            setScore(this.score);
            maybeBest(this.score);
            this.landed = true;
            this.transition = 1.4;
            this.message = 'TOUCHDOWN +' + points;
          } else {
            gameOver('Crashed on the moon', 'The pad needs a slow, centered landing. Watch your horizontal speed.');
          }
        }
      },
      draw: function () {
        panel();
        starfield(48, 'rgba(210, 225, 255, 0.62)');
        ctx.fillStyle = 'rgba(225, 238, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(W - 135, 86, 31, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(170, 195, 230, 0.25)';
        ctx.beginPath();
        ctx.arc(W - 146, 77, 8, 0, Math.PI * 2);
        ctx.arc(W - 124, 99, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#202a42';
        ctx.beginPath();
        ctx.moveTo(0, GROUND);
        ctx.lineTo(170, GROUND - 12);
        ctx.lineTo(340, GROUND - 2);
        ctx.lineTo(520, GROUND - 22);
        ctx.lineTo(720, GROUND - 4);
        ctx.lineTo(W, GROUND - 16);
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#0e1729';
        ctx.fillRect(this.padX, GROUND - 4, this.padW, 8);
        glow('#5eead4', 20);
        ctx.fillStyle = '#5eead4';
        ctx.fillRect(this.padX + 8, GROUND - 2, this.padW - 16, 4);
        noGlow();
        label('LANDING PAD ' + this.level + ' / 3', this.padX + this.padW / 2, GROUND + 28, 10, 'rgba(94, 234, 212, 0.8)', 'center', 600);

        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.landed) {
          ctx.rotate(-0.04);
        } else {
          ctx.rotate(clamp(this.vx / 1800, -0.18, 0.18));
        }
        if (this.flame > 0) {
          glow('#f6c453', 18);
          ctx.fillStyle = '#f6c453';
          ctx.beginPath();
          ctx.moveTo(-8, 17);
          ctx.lineTo(8, 17);
          ctx.lineTo(0, 40 + Math.random() * 10);
          ctx.closePath();
          ctx.fill();
          noGlow();
        }
        ctx.fillStyle = '#dfe8ff';
        ctx.beginPath();
        ctx.moveTo(0, -19);
        ctx.lineTo(17, 13);
        ctx.lineTo(-17, 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(0, -2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7c8cff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-10, 14); ctx.lineTo(-17, 26);
        ctx.moveTo(10, 14); ctx.lineTo(17, 26);
        ctx.stroke();
        ctx.restore();

        var fuelW = 220;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(24, H - 42, fuelW, 10);
        ctx.fillStyle = this.fuel < 25 ? '#ff5d6c' : '#22d3ee';
        ctx.fillRect(24, H - 42, fuelW * (this.fuel / 100), 10);
        label('FUEL', 24, H - 56, 10, 'rgba(200, 220, 255, 0.6)', 'left', 600);
        label(this.fuel.toFixed(0) + '%', 24 + fuelW, H - 56, 10, this.fuel < 25 ? '#ff5d6c' : 'rgba(200, 220, 255, 0.75)', 'right', 600);
        label('HORIZONTAL ' + Math.round(Math.abs(this.vx)) + ' · DESCENT ' + Math.round(Math.abs(this.vy)), W - 24, H - 26, 10, 'rgba(190, 210, 245, 0.55)', 'right', 600);
        if (this.landed) {
          ctx.fillStyle = 'rgba(4, 15, 18, 0.7)';
          ctx.fillRect(0, H / 2 - 40, W, 80);
          label(this.message, W / 2, H / 2, 24, '#5eead4', 'center', 700);
        } else {
          label('SOFT LANDING: SLOW + CENTERED', W / 2, 26, 10, 'rgba(190, 210, 245, 0.5)', 'center', 600);
        }
      }
    };
  });
})();
