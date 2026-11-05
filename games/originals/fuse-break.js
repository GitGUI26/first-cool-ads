/* Fuse Break — cut the wires in the order shown on the manual. */
(function () {
  var A = window.CoolOriginals;
  A.register('fuse-break', {
    kicker: 'BOMB SQUAD',
    title: 'Fuse Break',
    blurb: 'Read the manual, keep your hands steady, and cut the right wire before the clock expires.',
    controls: 'Click / tap the next wire in the manual · three devices to disarm',
    score: 'Score',
    best: 'Best'
  }, function (api) {
    var W = api.W, H = api.H, ctx = api.ctx;
    var setScore = api.setScore, maybeBest = api.maybeBest, gameOver = api.gameOver;
    var panel = api.panel, label = api.label, glow = api.glow, noGlow = api.noGlow;
    var roundRect = api.pathRoundRect, shuffle = api.shuffle;
    var COLORS = [
      { name: 'RED', color: '#ff5d6c' },
      { name: 'CYAN', color: '#22d3ee' },
      { name: 'GOLD', color: '#f6c453' },
      { name: 'GREEN', color: '#5eead4' },
      { name: 'PINK', color: '#f472b6' }
    ];
    var WIRE_X1 = 400, WIRE_X2 = 890, WIRE_Y = 156, WIRE_GAP = 58;

    return {
      reset: function () {
        this.round = 1;
        this.score = 0;
        this.flash = 0;
        this.newBomb();
        setScore(0);
      },
      newBomb: function () {
        var length = 2 + this.round;
        this.sequence = shuffle(COLORS).slice(0, length).map(function (wire) { return wire.name; });
        this.cut = [];
        this.time = Math.max(18, 34 - this.round * 4);
        this.delay = 0;
        this.defused = false;
        this.flash = 0;
      },
      update: function (dt) {
        if (this.delay > 0) {
          this.delay -= dt;
          if (this.delay <= 0) {
            if (this.round >= 3) {
              gameOver('All devices disarmed', 'The last fuse is cold. Final score: ' + this.score + '.');
            } else {
              this.round += 1;
              this.newBomb();
            }
          }
          return;
        }
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
        this.time = Math.max(0, this.time - dt);
        if (this.time <= 0) {
          gameOver('Time expired', 'The timer beat you to the last wire.');
        }
      },
      onPointerDown: function (p) {
        if (this.delay > 0 || this.time <= 0) return;
        if (p.x < WIRE_X1 - 20 || p.x > WIRE_X2 + 20) return;
        var index = Math.round((p.y - WIRE_Y) / WIRE_GAP);
        if (index < 0 || index >= COLORS.length) return;
        if (Math.abs(p.y - (WIRE_Y + index * WIRE_GAP)) > 23) return;
        if (this.cut.indexOf(index) >= 0) return;
        var expected = this.sequence[this.cut.length];
        if (COLORS[index].name !== expected) {
          gameOver('Wrong wire', 'That cut armed the device. The next wire was ' + expected + '.');
          return;
        }
        this.cut.push(index);
        this.score += 120;
        this.flash = 0.18;
        setScore(this.score);
        maybeBest(this.score);
        if (this.cut.length >= this.sequence.length) {
          this.score += Math.round(this.time * 8);
          setScore(this.score);
          maybeBest(this.score);
          this.delay = 1.15;
          this.defused = true;
        }
      },
      draw: function () {
        panel();
        var manualX = 24, manualY = 64, manualW = 290, manualH = 408;
        var bombX = 338, bombY = 64, bombW = 598, bombH = 408;
        roundRect(manualX, manualY, manualW, manualH, 16);
        ctx.fillStyle = 'rgba(9, 17, 30, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 174, 255, 0.2)';
        ctx.stroke();
        roundRect(bombX, bombY, bombW, bombH, 16);
        ctx.fillStyle = 'rgba(23, 12, 19, 0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 93, 108, 0.24)';
        ctx.stroke();

        label('DEVICE ' + this.round + ' / 3', manualX + 20, manualY + 28, 10, 'rgba(200, 220, 255, 0.6)', 'left', 600);
        label('CUT ORDER', manualX + 20, manualY + 64, 20, '#eef3ff', 'left', 700);
        for (var s = 0; s < this.sequence.length; s++) {
          var wire = COLORS.filter(function (item) { return item.name === this.sequence[s]; }, this)[0];
          var y = manualY + 104 + s * 50;
          var isDone = s < this.cut.length;
          var isNext = s === this.cut.length && !isDone;
          if (isNext) {
            roundRect(manualX + 12, y - 17, manualW - 24, 34, 8);
            ctx.fillStyle = 'rgba(246, 196, 83, 0.09)';
            ctx.fill();
          }
          ctx.fillStyle = isDone ? 'rgba(94, 234, 212, 0.7)' : wire.color;
          glow(wire.color, isDone ? 0 : 10);
          ctx.beginPath();
          ctx.arc(manualX + 28, y, 6, 0, Math.PI * 2);
          ctx.fill();
          noGlow();
          label((s + 1) + '. ' + wire.name, manualX + 44, y, 13, isDone ? 'rgba(140, 190, 180, 0.55)' : '#dfe8ff', 'left', 600);
          if (isDone) label('CUT', manualX + manualW - 22, y, 9, '#5eead4', 'right', 700);
        }
        label('TIMER', bombX + 22, bombY + 30, 9, 'rgba(255, 180, 180, 0.6)', 'left', 600);
        label(this.time.toFixed(1), bombX + bombW - 22, bombY + 30, 18, this.time < 8 ? '#ff5d6c' : '#f6c453', 'right', 700);
        ctx.fillStyle = 'rgba(255, 93, 108, 0.15)';
        ctx.fillRect(bombX + 22, bombY + 42, bombW - 44, 5);
        ctx.fillStyle = this.time < 8 ? '#ff5d6c' : '#f6c453';
        ctx.fillRect(bombX + 22, bombY + 42, (bombW - 44) * (this.time / Math.max(1, 34 - this.round * 4)), 5);

        for (var i = 0; i < COLORS.length; i++) {
          var wy = WIRE_Y + i * WIRE_GAP;
          var cut = this.cut.indexOf(i) >= 0;
          ctx.strokeStyle = cut ? 'rgba(100, 110, 130, 0.28)' : COLORS[i].color;
          ctx.lineWidth = 6;
          if (!cut) glow(COLORS[i].color, 7);
          ctx.beginPath();
          ctx.moveTo(WIRE_X1, wy);
          if (cut) {
            ctx.lineTo(WIRE_X1 + 95, wy);
            ctx.moveTo(WIRE_X2 - 95, wy);
            ctx.lineTo(WIRE_X2, wy);
          } else {
            ctx.bezierCurveTo(WIRE_X1 + 120, wy - 18, WIRE_X2 - 150, wy + 18, WIRE_X2, wy);
          }
          ctx.stroke();
          noGlow();
          ctx.fillStyle = cut ? '#303a4c' : '#0b101b';
          ctx.strokeStyle = cut ? 'rgba(100, 110, 130, 0.4)' : COLORS[i].color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(WIRE_X1, wy, 11, 0, Math.PI * 2);
          ctx.arc(WIRE_X2, wy, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        if (this.defused) {
          ctx.fillStyle = 'rgba(4, 16, 20, 0.72)';
          ctx.fillRect(bombX + 80, bombY + 150, bombW - 160, 84);
          label('DEVICE DISARMED', bombX + bombW / 2, bombY + 192, 21, '#5eead4', 'center', 700);
        } else if (this.time < 8) {
          label('CUT THE NEXT WIRE', bombX + bombW / 2, bombY + 390, 10, '#ff5d6c', 'center', 700);
        } else {
          label('MATCH THE MANUAL · DO NOT GUESS', bombX + bombW / 2, bombY + 390, 10, 'rgba(255, 200, 200, 0.5)', 'center', 600);
        }
      }
    };
  });
})();
