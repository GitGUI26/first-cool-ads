/* Lumen Loom — rotate the pipes and connect the light. */
(function () {
  var A = window.CoolOriginals;
  A.register('lumen-loom', {
    kicker: 'LIGHT & LOGIC',
    title: 'Lumen Loom',
    blurb: 'Rotate the tiles, link the source to the receiver, and bring the grid back online.',
    controls: 'Click / tap a tile to rotate it · three grids to restore',
    score: 'Score',
    best: 'Best'
  }, function (api) {
    var W = api.W, H = api.H, ctx = api.ctx;
    var clamp = api.clamp, shuffle = api.shuffle, randInt = api.randInt;
    var setScore = api.setScore, maybeBest = api.maybeBest, gameOver = api.gameOver;
    var panel = api.panel, starfield = api.starfield, label = api.label;
    var glow = api.glow, noGlow = api.noGlow, roundRect = api.pathRoundRect;
    var SIZE = 5, CELL = 72, TILE = 64;
    var OX = (W - SIZE * CELL) / 2, OY = 78;
    var DIRS = [
      { bit: 1, dx: 0, dy: -1 },
      { bit: 2, dx: 1, dy: 0 },
      { bit: 4, dx: 0, dy: 1 },
      { bit: 8, dx: -1, dy: 0 }
    ];
    var PATHS = [
      [[2, 0], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 4], [2, 4]],
      [[2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 4]],
      [[2, 0], [3, 0], [3, 1], [3, 2], [2, 2], [1, 2], [1, 3], [2, 3], [2, 4]],
      [[2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4]],
      [[2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 3], [2, 4]],
      [[2, 0], [1, 0], [1, 1], [0, 1], [0, 2], [0, 3], [1, 3], [1, 4], [2, 4]],
      [[2, 0], [3, 0], [4, 0], [4, 1], [4, 2], [3, 2], [2, 2], [2, 3], [2, 4]]
    ];

    function opposite(bit) {
      return bit === 1 ? 4 : bit === 4 ? 1 : bit === 2 ? 8 : 2;
    }
    function rotateBits(bits, turns) {
      var result = bits;
      for (var i = 0; i < turns; i++) {
        result = ((result << 1) | (result >> 3)) & 15;
      }
      return result;
    }
    function centerOf(cell) {
      return {
        x: OX + cell.c * CELL + CELL / 2,
        y: OY + cell.r * CELL + CELL / 2
      };
    }

    return {
      reset: function () {
        this.level = 1;
        this.score = 0;
        this.moves = 0;
        this.flash = 0;
        this.pending = false;
        this.makeBoard();
        setScore(0);
      },
      makePath: function () {
        return PATHS[randInt(0, PATHS.length - 1)].map(function (pair) {
          return { r: pair[0], c: pair[1] };
        });
      },
      makeBoard: function () {
        var path = this.makePath();
        var pathIndex = {};
        path.forEach(function (cell, index) {
          pathIndex[cell.r + ',' + cell.c] = index;
        });
        this.cells = [];
        var byKey = {};
        for (var r = 0; r < SIZE; r++) {
          for (var c = 0; c < SIZE; c++) {
            var cell = {
              r: r,
              c: c,
              base: 0,
              rot: randInt(0, 3),
              source: r === 2 && c === 0,
              target: r === 2 && c === 4,
              decoy: false
            };
            var key = r + ',' + c;
            byKey[key] = cell;
            this.cells.push(cell);
          }
        }
        path.forEach(function (cell) {
          var bits = 0;
          DIRS.forEach(function (dir) {
            if (pathIndex[(cell.r + dir.dy) + ',' + (cell.c + dir.dx)] !== undefined) {
              bits |= dir.bit;
            }
          });
          if (cell.r === 2 && cell.c === 0) bits |= 8;
          if (cell.r === 2 && cell.c === 4) bits |= 2;
          byKey[cell.r + ',' + cell.c].base = bits;
        });
        var empty = this.cells.filter(function (cell) { return !pathIndex[cell.r + ',' + cell.c]; });
        shuffle(empty).slice(0, 5).forEach(function (cell) {
          var bits = shuffle([1, 2, 4, 8]);
          cell.base = bits[0] | bits[1];
          cell.decoy = true;
        });
        this.byKey = byKey;
        this.moves = 0;
      },
      sidesOf: function (cell) {
        return rotateBits(cell.base, cell.rot);
      },
      cellAt: function (r, c) {
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
        return this.byKey[r + ',' + c];
      },
      computeLink: function () {
        var start = this.cellAt(2, 0);
        var target = this.cellAt(2, 4);
        var visited = {};
        var queue = [start];
        visited['2,0'] = true;
        while (queue.length) {
          var cell = queue.shift();
          var sides = this.sidesOf(cell);
          for (var i = 0; i < DIRS.length; i++) {
            var dir = DIRS[i];
            if (!(sides & dir.bit)) continue;
            var neighbor = this.cellAt(cell.r + dir.dy, cell.c + dir.dx);
            if (!neighbor) continue;
            var key = neighbor.r + ',' + neighbor.c;
            if (visited[key]) continue;
            if (!(this.sidesOf(neighbor) & opposite(dir.bit))) continue;
            visited[key] = true;
            queue.push(neighbor);
          }
        }
        return { visited: visited, linked: !!visited['2,4'], target: target };
      },
      solve: function () {
        var points = Math.max(150, 900 - this.moves * 30) + this.level * 100;
        this.score += points;
        setScore(this.score);
        maybeBest(this.score);
        this.flash = 1.15;
        this.pending = this.level >= 3;
        this.flashText = '+' + points + '  GRID LINKED';
        if (this.pending) {
          this.pending = true;
        }
      },
      update: function (dt) {
        if (this.flash > 0) {
          this.flash -= dt;
          if (this.flash <= 0 && this.pending) {
            this.pending = false;
            gameOver('Grid restored', 'All three grids are glowing again. Final score: ' + this.score + '.');
          } else if (this.flash <= 0 && this.level < 3) {
            this.level += 1;
            this.makeBoard();
            this.flash = 0;
          }
        }
      },
      draw: function () {
        panel();
        starfield(28, 'rgba(80, 220, 210, 0.28)');
        var link = this.computeLink();
        var lit = link.visited;
        label('GRID ' + this.level + ' / 3', 24, 28, 11, 'rgba(180, 230, 230, 0.7)', 'left', 600);
        label('MOVES ' + this.moves, W - 24, 28, 11, 'rgba(180, 230, 230, 0.7)', 'right', 600);
        for (var i = 0; i < this.cells.length; i++) {
          var cell = this.cells[i];
          var x = OX + cell.c * CELL + (CELL - TILE) / 2;
          var y = OY + cell.r * CELL + (CELL - TILE) / 2;
          var isLit = !!lit[cell.r + ',' + cell.c];
          roundRect(x, y, TILE, TILE, 13);
          ctx.fillStyle = cell.source ? 'rgba(246, 196, 83, 0.12)' :
            cell.target ? 'rgba(94, 234, 212, 0.12)' : 'rgba(9, 20, 38, 0.82)';
          ctx.fill();
          ctx.strokeStyle = cell.source ? 'rgba(246, 196, 83, 0.7)' :
            cell.target ? 'rgba(94, 234, 212, 0.65)' : 'rgba(100, 160, 220, 0.18)';
          ctx.lineWidth = 1;
          ctx.stroke();
          if (!cell.base) continue;
          var sides = this.sidesOf(cell);
          var center = centerOf(cell);
          ctx.lineCap = 'round';
          ctx.lineWidth = 9;
          ctx.strokeStyle = cell.source ? '#f6c453' :
            cell.target ? '#5eead4' : (isLit ? '#22d3ee' : 'rgba(124, 140, 255, 0.55)');
          if (isLit) glow(ctx.strokeStyle, 15);
          for (var d = 0; d < DIRS.length; d++) {
            if (!(sides & DIRS[d].bit)) continue;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(center.x + DIRS[d].dx * TILE * 0.48, center.y + DIRS[d].dy * TILE * 0.48);
            ctx.stroke();
          }
          noGlow();
          ctx.fillStyle = isLit ? '#d6ffff' : 'rgba(200, 210, 255, 0.7)';
          ctx.beginPath();
          ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
          ctx.fill();
          if (cell.source) label('IN', center.x, center.y + 28, 9, 'rgba(246,196,83,.8)', 'center', 700);
          if (cell.target) label('OUT', center.x, center.y + 28, 9, 'rgba(94,234,212,.8)', 'center', 700);
        }
        label(link.linked ? 'LIGHT PATH ONLINE' : 'ROTATE THE TILES TO CONNECT THE LIGHT',
          W / 2, H - 22, 11, link.linked ? '#5eead4' : 'rgba(170, 200, 230, 0.65)', 'center', 600);
        if (this.flash > 0) {
          ctx.fillStyle = 'rgba(4, 14, 22, 0.72)';
          ctx.fillRect(0, H / 2 - 46, W, 92);
          label(this.flashText, W / 2, H / 2, 24, '#d6ffff', 'center', 700);
        }
      },
      onPointerDown: function (p) {
        if (this.flash > 0) return;
        var col = Math.floor((p.x - OX) / CELL);
        var row = Math.floor((p.y - OY) / CELL);
        if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return;
        var cell = this.cellAt(row, col);
        if (!cell) return;
        cell.rot = (cell.rot + 1) % 4;
        this.moves += 1;
        if (this.computeLink().linked) this.solve();
      }
    };
  });
})();
