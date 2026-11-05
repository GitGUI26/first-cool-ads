/* Hexbound — claim the glowing hexes before the rival does. */
(function () {
  var A = window.CoolOriginals;
  A.register('hexbound', {
    kicker: 'TERRITORY DUEL',
    title: 'Hexbound',
    blurb: 'Expand from your corner, claim the glowing hexes, and leave the rival intelligence nowhere to grow.',
    controls: 'Click / tap a lit hex adjacent to your territory · you are cyan',
    score: 'Territory',
    best: 'Best'
  }, function (api) {
    var W = api.W, H = api.H, ctx = api.ctx;
    var clamp = api.clamp;
    var setScore = api.setScore, maybeBest = api.maybeBest, gameOver = api.gameOver;
    var panel = api.panel, starfield = api.starfield, label = api.label;
    var glow = api.glow, noGlow = api.noGlow;
    var HEX = 34;
    var AXIAL = [0, 1, 2, 3, 4, 5, 6];

    function center(q, r) {
      return {
        x: W / 2 + Math.sqrt(3) * HEX * ((q - 3) + (r - 3) / 2),
        y: H / 2 + 1.5 * HEX * (r - 3) + 20
      };
    }
    function neighbors(q, r) {
      return [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]
        .map(function (pair) { return { q: q + pair[0], r: r + pair[1] }; })
        .filter(function (cell) { return cell.q >= 0 && cell.q <= 6 && cell.r >= 0 && cell.r <= 6; });
    }
    function drawHex(x, y, size) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var angle = Math.PI / 180 * (60 * i - 30);
        var px = x + Math.cos(angle) * size;
        var py = y + Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    return {
      reset: function () {
        this.cells = [];
        this.byKey = {};
        for (var q = 0; q < 7; q++) {
          for (var r = 0; r < 7; r++) {
            var cell = { q: q, r: r, owner: 0, center: center(q, r) };
            this.cells.push(cell);
            this.byKey[q + ',' + r] = cell;
          }
        }
        this.playerStart = this.byKey['0,6'];
        this.aiStart = this.byKey['6,0'];
        this.playerStart.owner = 1;
        this.aiStart.owner = 2;
        this.playerCount = 1;
        this.aiCount = 1;
        this.turn = 1;
        this.over = false;
        this.token = (this.token || 0) + 1;
        this.message = 'Your move';
        this.setScore(this.playerCount);
        setScore(this.playerCount);
      },
      setScore: function (value) {
        this.playerCount = value;
        setScore(value);
      },
      valid: function (owner) {
        var valid = {};
        for (var i = 0; i < this.cells.length; i++) {
          var cell = this.cells[i];
          if (cell.owner) continue;
          var near = neighbors(cell.q, cell.r);
          for (var n = 0; n < near.length; n++) {
            var other = this.byKey[near[n].q + ',' + near[n].r];
            if (other && other.owner === owner) {
              valid[cell.q + ',' + cell.r] = true;
              break;
            }
          }
        }
        return valid;
      },
      claim: function (cell, owner) {
        cell.owner = owner;
        if (owner === 1) {
          this.playerCount += 1;
          setScore(this.playerCount);
          maybeBest(this.playerCount);
        } else {
          this.aiCount += 1;
        }
      },
      finish: function () {
        if (this.over) return;
        this.over = true;
        this.token += 1;
        maybeBest(this.playerCount);
        if (this.playerCount > this.aiCount) {
          gameOver('Territory secured', 'You claimed ' + this.playerCount + ' hexes to the rival’s ' + this.aiCount + '.');
        } else if (this.playerCount < this.aiCount) {
          gameOver('Rival wins', 'The rival closed the board at ' + this.aiCount + '–' + this.playerCount + '.');
        } else {
          gameOver('Stalemate', 'Both sides claimed ' + this.playerCount + ' hexes.');
        }
      },
      checkBoard: function () {
        var playerMoves = this.valid(1);
        var aiMoves = this.valid(2);
        if (!Object.keys(aiMoves).length || !Object.keys(playerMoves).length) {
          this.finish();
          return true;
        }
        return false;
      },
      onPointerDown: function (p) {
        if (this.turn !== 1 || this.over) return;
        var best = null;
        var bestDistance = Infinity;
        for (var i = 0; i < this.cells.length; i++) {
          var cell = this.cells[i];
          var distance = Math.hypot(p.x - cell.center.x, p.y - cell.center.y);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = cell;
          }
        }
        if (!best || bestDistance > HEX * 0.98 || best.owner) return;
        var valid = this.valid(1);
        if (!valid[best.q + ',' + best.r]) return;
        this.claim(best, 1);
        if (this.checkBoard()) return;
        this.turn = 2;
        this.message = 'Rival thinking…';
        var self = this;
        var token = ++this.token;
        setTimeout(function () {
          if (token === self.token && !self.over) self.aiMove();
        }, 320);
      },
      aiMove: function () {
        if (this.over) return;
        var valid = this.valid(2);
        var options = Object.keys(valid).map(function (key) {
          var parts = key.split(',');
          return this.byKey[key];
        }, this);
        if (!options.length) { this.finish(); return; }
        var bestCell = null;
        var bestScore = -Infinity;
        for (var i = 0; i < options.length; i++) {
          var cell = options[i];
          var score = Math.random() * 1.5;
          var near = neighbors(cell.q, cell.r);
          for (var n = 0; n < near.length; n++) {
            var other = this.byKey[near[n].q + ',' + near[n].r];
            if (!other) continue;
            if (other.owner === 2) score += 3.2;
            if (other.owner === 1) score += 2.1;
          }
          if (score > bestScore) {
            bestScore = score;
            bestCell = cell;
          }
        }
        if (!bestCell) { this.finish(); return; }
        this.claim(bestCell, 2);
        if (this.checkBoard()) return;
        this.turn = 1;
        this.message = 'Your move';
      },
      draw: function () {
        panel();
        starfield(24, 'rgba(170, 120, 255, 0.27)');
        var valid = this.turn === 1 && !this.over ? this.valid(1) : {};
        for (var i = 0; i < this.cells.length; i++) {
          var cell = this.cells[i];
          var isPlayer = cell.owner === 1;
          var isAI = cell.owner === 2;
          var isOpen = !cell.owner;
          var highlight = !!valid[cell.q + ',' + cell.r];
          drawHex(cell.center.x, cell.center.y, HEX - 1.5);
          ctx.fillStyle = isPlayer ? 'rgba(34, 211, 238, 0.7)' :
            isAI ? 'rgba(244, 114, 182, 0.68)' :
            highlight ? 'rgba(34, 211, 238, 0.08)' : 'rgba(15, 25, 45, 0.8)';
          ctx.fill();
          ctx.lineWidth = isPlayer || isAI ? 2 : 1;
          ctx.strokeStyle = isPlayer ? 'rgba(120, 255, 250, 0.8)' :
            isAI ? 'rgba(255, 160, 210, 0.8)' :
            highlight ? 'rgba(34, 211, 238, 0.55)' : 'rgba(105, 130, 190, 0.18)';
          if (highlight) glow('#22d3ee', 12);
          ctx.stroke();
          noGlow();
          if (isPlayer) {
            ctx.fillStyle = 'rgba(4, 22, 31, 0.55)';
            ctx.beginPath();
            ctx.arc(cell.center.x, cell.center.y, 5, 0, Math.PI * 2);
            ctx.fill();
          } else if (isAI) {
            ctx.fillStyle = 'rgba(40, 7, 27, 0.5)';
            ctx.beginPath();
            ctx.arc(cell.center.x, cell.center.y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        label('YOU ' + this.playerCount, 24, 25, 12, '#22d3ee', 'left', 700);
        label('RIVAL ' + this.aiCount, W - 24, 25, 12, '#f472b6', 'right', 700);
        label(this.message.toUpperCase(), W / 2, H - 22, 10, 'rgba(190, 210, 245, 0.6)', 'center', 600);
        label('CLAIM THE LIT EDGES', W / 2, 26, 10, 'rgba(190, 210, 245, 0.5)', 'center', 600);
      }
    };
  });
})();
