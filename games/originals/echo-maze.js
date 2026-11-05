/* Echo Maze — find the keys in a maze lit only by your lantern. */
(function () {
  var A = window.CoolOriginals;
  A.register('echo-maze', {
    kicker: 'DARK MAZE',
    title: 'Echo Maze',
    blurb: 'Read the walls by lantern light, collect three keys, and find the way out.',
    controls: 'Arrows / WASD or the pad to move · Pulse reveals more of the maze',
    score: 'Score',
    best: 'Best',
    touch: 'dpad',
    actionLabel: 'Pulse'
  }, function (api) {
    var W = api.W, H = api.H, ctx = api.ctx;
    var clamp = api.clamp, shuffle = api.shuffle, randInt = api.randInt;
    var setScore = api.setScore, maybeBest = api.maybeBest, gameOver = api.gameOver;
    var panel = api.panel, label = api.label, glow = api.glow, noGlow = api.noGlow;
    var COLS = 17, ROWS = 9, CELL = 50;
    var OX = (W - COLS * CELL) / 2, OY = (H - ROWS * CELL) / 2;
    var DIRS = [
      { name: 'up', bit: 1, dx: 0, dy: -1, opposite: 4 },
      { name: 'right', bit: 2, dx: 1, dy: 0, opposite: 8 },
      { name: 'down', bit: 4, dx: 0, dy: 1, opposite: 1 },
      { name: 'left', bit: 8, dx: -1, dy: 0, opposite: 2 }
    ];

    function indexOf(r, c) { return r * COLS + c; }

    return {
      reset: function () {
        this.maze = [];
        for (var r = 0; r < ROWS; r++) {
          var row = [];
          for (var c = 0; c < COLS; c++) row.push(15);
          this.maze.push(row);
        }
        var visited = {};
        var self = this;
        var carve = function (r, c) {
          visited[indexOf(r, c)] = true;
          shuffle(DIRS).forEach(function (dir) {
            var nr = r + dir.dy;
            var nc = c + dir.dx;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || visited[indexOf(nr, nc)]) return;
            self.maze[r][c] &= ~dir.bit;
            self.maze[nr][nc] &= ~dir.opposite;
            carve(nr, nc);
          });
        };
        carve(0, 0);
        this.start = { r: ROWS - 1, c: 0 };
        this.player = { r: this.start.r, c: this.start.c };
        var distances = this.distancesFrom(this.start);
        var far = [];
        for (var rr = 0; rr < ROWS; rr++) {
          for (var cc = 0; cc < COLS; cc++) {
            if (distances[indexOf(rr, cc)] >= 0 && !(rr === this.start.r && cc === this.start.c)) {
              far.push({ r: rr, c: cc, distance: distances[indexOf(rr, cc)] });
            }
          }
        }
        far.sort(function (a, b) { return b.distance - a.distance; });
        this.exit = far[0] || { r: 0, c: COLS - 1, distance: 0 };
        var keyPool = far.filter(function (cell) {
          return cell.r !== this.exit.r || cell.c !== this.exit.c;
        }, this).slice(0, 18);
        this.keys = [];
        var taken = {};
        taken[this.exit.r + ',' + this.exit.c] = true;
        while (this.keys.length < 3 && keyPool.length) {
          var pick = keyPool[randInt(0, keyPool.length - 1)];
          var key = pick.r + ',' + pick.c;
          if (!taken[key]) {
            taken[key] = true;
            this.keys.push({ r: pick.r, c: pick.c, got: false });
          }
        }
        this.keysGot = 0;
        this.score = 0;
        this.steps = 0;
        this.elapsed = 0;
        this.pulse = 0;
        this.cooldown = 0;
        this.hint = 0;
        this.locked = false;
        setScore(0);
      },
      distancesFrom: function (start) {
        var dist = [];
        for (var i = 0; i < COLS * ROWS; i++) dist.push(-1);
        var queue = [{ r: start.r, c: start.c, d: 0 }];
        dist[indexOf(start.r, start.c)] = 0;
        while (queue.length) {
          var cell = queue.shift();
          for (var i = 0; i < DIRS.length; i++) {
            var dir = DIRS[i];
            if (this.maze[cell.r][cell.c] & dir.bit) continue;
            var nr = cell.r + dir.dy;
            var nc = cell.c + dir.dx;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            var key = indexOf(nr, nc);
            if (dist[key] !== -1) continue;
            dist[key] = cell.d + 1;
            queue.push({ r: nr, c: nc, d: cell.d + 1 });
          }
        }
        return dist;
      },
      update: function (dt) {
        this.elapsed += dt;
        if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt);
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.hint > 0) this.hint = Math.max(0, this.hint - dt);
      },
      onDir: function (dir) {
        if (this.locked) return;
        var move = null;
        for (var i = 0; i < DIRS.length; i++) {
          if (DIRS[i].name === dir) move = DIRS[i];
        }
        if (!move || !(this.maze[this.player.r][this.player.c] & move.bit)) return;
        this.player = { r: this.player.r + move.dy, c: this.player.c + move.dx };
        this.steps += 1;
        for (var k = 0; k < this.keys.length; k++) {
          var key = this.keys[k];
          if (!key.got && key.r === this.player.r && key.c === this.player.c) {
            key.got = true;
            this.keysGot += 1;
            this.score += 250;
            setScore(this.score);
            maybeBest(this.score);
          }
        }
        if (this.player.r === this.exit.r && this.player.c === this.exit.c) {
          if (this.keysGot >= 3) this.finish();
          else this.hint = 1.8;
        }
      },
      onAction: function () {
        if (this.locked || this.cooldown > 0) return;
        this.pulse = 1.05;
        this.cooldown = 3.2;
      },
      finish: function () {
        this.locked = true;
        var bonus = Math.max(0, 2400 - this.steps * 8 - Math.round(this.elapsed * 12));
        this.score += bonus;
        setScore(this.score);
        maybeBest(this.score);
        gameOver('Maze cleared', 'Three keys found in ' + this.steps + ' steps. Escape bonus: ' + bonus + '.');
      },
      draw: function () {
        panel();
        var cell = CELL;
        var px = OX + this.player.c * cell + cell / 2;
        var py = OY + this.player.r * cell + cell / 2;
        for (var r = 0; r < ROWS; r++) {
          for (var c = 0; c < COLS; c++) {
            var x = OX + c * cell;
            var y = OY + r * cell;
            ctx.fillStyle = 'rgba(8, 18, 32, 0.55)';
            ctx.fillRect(x, y, cell, cell);
            ctx.strokeStyle = 'rgba(80, 150, 240, 0.34)';
            ctx.lineWidth = 2;
            var walls = this.maze[r][c];
            if (walls & 1) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cell, y); ctx.stroke(); }
            if (walls & 2) { ctx.beginPath(); ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); ctx.stroke(); }
            if (walls & 4) { ctx.beginPath(); ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); ctx.stroke(); }
            if (walls & 8) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cell); ctx.stroke(); }
          }
        }
        this.drawKey(this.exit.r, this.exit.c, this.keysGot >= 3);
        this.keys.forEach(function (key) {
          if (!key.got) this.drawKey(key.r, key.c, true);
        }, this);
        var radius = this.pulse > 0 ? 330 : 150;
        var fog = ctx.createRadialGradient(px, py, 24, px, py, radius);
        fog.addColorStop(0, 'rgba(2, 6, 14, 0)');
        fog.addColorStop(0.55, 'rgba(2, 6, 14, 0.38)');
        fog.addColorStop(1, 'rgba(2, 6, 14, 0.96)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, 0, W, H);
        glow('#22d3ee', 20);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, Math.PI * 2);
        ctx.fill();
        noGlow();
        ctx.fillStyle = '#d8ffff';
        ctx.beginPath();
        ctx.arc(px - 3, py - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        if (this.pulse > 0) {
          var ring = (1 - this.pulse / 1.05) * 330;
          ctx.strokeStyle = 'rgba(34, 211, 238, ' + (this.pulse / 1.05 * 0.35) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, ring, 0, Math.PI * 2);
          ctx.stroke();
        }
        label('KEYS ' + this.keysGot + ' / 3', 24, 24, 11, 'rgba(190, 225, 245, 0.75)', 'left', 600);
        label('STEPS ' + this.steps, W - 24, 24, 11, 'rgba(190, 225, 245, 0.75)', 'right', 600);
        if (this.hint > 0) {
          label('THE EXIT NEEDS ALL THREE KEYS', W / 2, H - 20, 11, '#f6c453', 'center', 700);
        } else if (this.cooldown > 0) {
          label('PULSE RECHARGING', W / 2, H - 20, 10, 'rgba(170, 200, 230, 0.5)', 'center', 600);
        } else {
          label('THE DARK DOES NOT SHOW EVERYTHING', W / 2, H - 20, 10, 'rgba(170, 200, 230, 0.45)', 'center', 600);
        }
      },
      drawKey: function (r, c, lit) {
        var x = OX + c * CELL + CELL / 2;
        var y = OY + r * CELL + CELL / 2;
        ctx.save();
        if (lit) glow(r === this.exit.r && c === this.exit.c ? '#5eead4' : '#f6c453', 14);
        ctx.strokeStyle = lit ? (r === this.exit.r && c === this.exit.c ? '#5eead4' : '#f6c453') : 'rgba(90,110,140,.28)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.moveTo(x + 7, y);
        ctx.lineTo(x + 16, y);
        ctx.lineTo(x + 16, y + 7);
        ctx.stroke();
        ctx.restore();
      }
    };
  });
})();
