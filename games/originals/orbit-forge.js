/* Orbit Forge — ride the rings and gather starlight. */
(function () {
  var A = window.CoolOriginals;
  A.register('orbit-forge', {
    kicker: 'ORBITAL ARCADE',
    title: 'Orbit Forge',
    blurb: 'Ride a broken orbit, thread the asteroid belts, and forge starlight into a new record.',
    controls: 'Hold Space / Boost to push outward · release to fall back toward the planet',
    score: 'Score',
    best: 'Best',
    touch: 'action',
    actionLabel: 'Boost'
  }, function (api) {
    var W = api.W, H = api.H, ctx = api.ctx;
    var clamp = api.clamp, rand = api.rand;
    var setScore = api.setScore, maybeBest = api.maybeBest, gameOver = api.gameOver;
    var panel = api.panel, starfield = api.starfield, label = api.label, glow = api.glow, noGlow = api.noGlow;
    var input = api.input;
    var CX = W / 2, CY = H / 2;
    var Y_SCALE = 0.8;

    function orbitPoint(angle, radius) {
      return { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius * Y_SCALE };
    }

    return {
      reset: function () {
        this.angle = rand(0, Math.PI * 2);
        this.radius = 180;
        this.targetRadius = 180;
        this.score = 0;
        this.lives = 3;
        this.invuln = 0;
        this.flash = 0;
        this.stars = [];
        this.rocks = [];
        for (var i = 0; i < 11; i++) {
          this.stars.push({ angle: rand(0, Math.PI * 2), radius: rand(140, 238), pulse: rand(0, 6) });
        }
        for (var r = 0; r < 6; r++) {
          this.rocks.push({ angle: rand(0, Math.PI * 2), radius: rand(135, 238), speed: rand(-0.34, -0.16), size: rand(8, 14) });
        }
        setScore(0);
      },
      update: function (dt) {
        this.angle += 1.2 * dt;
        this.targetRadius = input.action ? 230 : 168;
        this.radius += (this.targetRadius - this.radius) * 2.4 * dt;
        this.radius = clamp(this.radius, 90, 240);
        if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
        var player = orbitPoint(this.angle, this.radius);
        for (var s = this.stars.length - 1; s >= 0; s--) {
          var star = this.stars[s];
          var starPoint = orbitPoint(star.angle, star.radius);
          if (Math.hypot(player.x - starPoint.x, player.y - starPoint.y) < 24) {
            this.stars.splice(s, 1);
            this.score += 25;
            setScore(this.score);
            maybeBest(this.score);
            this.stars.push({ angle: rand(0, Math.PI * 2), radius: rand(140, 238), pulse: rand(0, 6) });
          }
        }
        for (var r = 0; r < this.rocks.length; r++) {
          var rock = this.rocks[r];
          rock.angle += rock.speed * dt;
          var rockPoint = orbitPoint(rock.angle, rock.radius);
          if (Math.hypot(player.x - rockPoint.x, player.y - rockPoint.y) < rock.size + 15) {
            if (this.invuln <= 0) {
              this.lives -= 1;
              this.invuln = 1.4;
              this.flash = 0.35;
              if (this.lives <= 0) {
                gameOver('Orbit broken', 'The satellite fell out of the ring. Final score: ' + this.score + '.');
                return;
              }
            }
          }
        }
      },
      draw: function () {
        panel();
        starfield(64, 'rgba(190, 210, 255, 0.55)');
        var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 520);
        ctx.save();
        ctx.strokeStyle = 'rgba(124, 140, 255, 0.13)';
        ctx.lineWidth = 1;
        [122, 168, 210, 238].forEach(function (band) {
          ctx.beginPath();
          ctx.ellipse(CX, CY, band, band * Y_SCALE, 0, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
        var planetGrad = ctx.createRadialGradient(CX - 20, CY - 20, 10, CX, CY, 80);
        planetGrad.addColorStop(0, '#334b7a');
        planetGrad.addColorStop(1, '#0a1224');
        ctx.fillStyle = planetGrad;
        ctx.beginPath();
        ctx.arc(CX, CY, 72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(CX, CY, 104, 28, -0.22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(34, 211, 238, 0.07)';
        ctx.beginPath();
        ctx.arc(CX, CY, 78 + pulse * 6, 0, Math.PI * 2);
        ctx.fill();
        for (var s = 0; s < this.stars.length; s++) {
          var star = this.stars[s];
          var point = orbitPoint(star.angle, star.radius);
          glow('#f6c453', 14 + Math.sin(performance.now() / 300 + star.pulse) * 5);
          ctx.fillStyle = '#f6c453';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          noGlow();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          ctx.arc(point.x - 1, point.y - 1, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        for (var r = 0; r < this.rocks.length; r++) {
          var rock = this.rocks[r];
          var rockPoint = orbitPoint(rock.angle, rock.radius);
          ctx.save();
          ctx.translate(rockPoint.x, rockPoint.y);
          ctx.rotate(rock.angle * 2.1);
          ctx.fillStyle = '#3d3550';
          ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (var side = 0; side < 6; side++) {
            var a = side * Math.PI / 3;
            var rr = rock.size + (side % 2 ? 3 : 0);
            if (side === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
            else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        var player = orbitPoint(this.angle, this.radius);
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(this.angle + Math.PI / 2);
        glow(this.invuln > 0 ? '#ffffff' : '#22d3ee', this.invuln > 0 ? 26 : 18);
        ctx.fillStyle = this.invuln > 0 && Math.floor(this.invuln * 12) % 2 ? '#ffffff' : '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(11, 10);
        ctx.lineTo(0, 5);
        ctx.lineTo(-11, 10);
        ctx.closePath();
        ctx.fill();
        noGlow();
        ctx.fillStyle = '#d8ffff';
        ctx.beginPath();
        ctx.arc(0, -2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (input.action) {
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.18)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(player.x, player.y, 25 + pulse * 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        label('STARLIGHT ' + this.score, 24, 25, 11, 'rgba(210, 230, 255, 0.75)', 'left', 700);
        label('LIVES', W - 96, 25, 10, 'rgba(210, 230, 255, 0.55)', 'left', 600);
        for (var l = 0; l < 3; l++) {
          ctx.fillStyle = l < this.lives ? '#22d3ee' : 'rgba(255, 255, 255, 0.13)';
          ctx.beginPath();
          ctx.arc(W - 48 + l * 16, 25, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        label(input.action ? 'BOOSTING OUTWARD' : 'HOLD BOOST TO RAISE ORBIT', W / 2, H - 23, 10,
          input.action ? '#5eead4' : 'rgba(190, 215, 255, 0.5)', 'center', 600);
        if (this.flash > 0) {
          ctx.fillStyle = 'rgba(255, 70, 100, ' + this.flash * 0.28 + ')';
          ctx.fillRect(0, 0, W, H);
        }
      }
    };
  });
})();
