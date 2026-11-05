/* Generate pages and 640x360 key art for the Cool Originals collection. */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORIGINALS = path.join(ROOT, 'games', 'originals');
const IMAGES = path.join(ROOT, 'images');
fs.mkdirSync(ORIGINALS, { recursive: true });
fs.mkdirSync(IMAGES, { recursive: true });

const games = [
  {
    slug: 'lumen-loom',
    title: 'Lumen Loom',
    kicker: 'LIGHT & LOGIC',
    blurb: 'Rotate the tiles, link the source to the receiver, and bring the grid back online.',
    accent: '#22d3ee',
    accent2: '#f6c453',
    art: `
      <g transform="translate(333 62)">
        <rect x="0" y="0" width="244" height="210" rx="20" fill="#071522" stroke="#22d3ee" stroke-opacity=".22"/>
        <g fill="#0b2234" stroke="#2c6f83" stroke-width="1.5">
          <rect x="22" y="23" width="58" height="58" rx="11"/><rect x="93" y="23" width="58" height="58" rx="11"/><rect x="164" y="23" width="58" height="58" rx="11"/>
          <rect x="22" y="94" width="58" height="58" rx="11"/><rect x="93" y="94" width="58" height="58" rx="11"/><rect x="164" y="94" width="58" height="58" rx="11"/>
          <rect x="22" y="165" width="58" height="58" rx="11"/><rect x="93" y="165" width="58" height="58" rx="11"/><rect x="164" y="165" width="58" height="58" rx="11"/>
        </g>
        <path d="M51 52H122V123H193V194" fill="none" stroke="#22d3ee" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M51 52H122V123H193V194" fill="none" stroke="#d8ffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
        <circle cx="51" cy="52" r="12" fill="#f6c453"/><circle cx="193" cy="194" r="12" fill="#5eead4"/>
        <circle cx="51" cy="52" r="30" fill="#f6c453" opacity=".16"/><circle cx="193" cy="194" r="30" fill="#5eead4" opacity=".14"/>
      </g>`
  },
  {
    slug: 'echo-maze',
    title: 'Echo Maze',
    kicker: 'DARK MAZE',
    blurb: 'Read the walls by lantern light, collect three keys, and find the way out.',
    accent: '#5eead4',
    accent2: '#f6c453',
    art: `
      <g transform="translate(326 52)">
        <rect x="0" y="0" width="270" height="222" rx="20" fill="#06131c" stroke="#5eead4" stroke-opacity=".18"/>
        <g fill="none" stroke="#2f7190" stroke-width="3" stroke-linecap="square">
          <path d="M20 20V202M20 20H250M250 20V202M20 202H250M55 20V76H117V20M117 76H186V20M186 76V132H250M250 132H194M194 132V202M194 202H117V158M117 158H55V202M55 202V110H20M55 110H88V76M117 158V110H145V158"/>
        </g>
        <circle cx="88" cy="76" r="48" fill="url(#torch)"/>
        <circle cx="88" cy="76" r="8" fill="#d8ffff"/>
        <g fill="#f6c453">
          <circle cx="218" cy="190" r="5"/><circle cx="218" cy="190" r="12" fill="none" stroke="#f6c453" stroke-width="2"/>
          <circle cx="34" cy="40" r="5"/><circle cx="34" cy="40" r="12" fill="none" stroke="#f6c453" stroke-width="2"/>
          <circle cx="238" cy="50" r="5"/><circle cx="238" cy="50" r="12" fill="none" stroke="#f6c453" stroke-width="2"/>
        </g>
        <path d="M194 202H250V154" fill="none" stroke="#5eead4" stroke-width="3" stroke-dasharray="4 7"/>
      </g>`
  },
  {
    slug: 'fuse-break',
    title: 'Fuse Break',
    kicker: 'BOMB SQUAD',
    blurb: 'Read the manual, keep your hands steady, and cut the right wire before the clock expires.',
    accent: '#ff5d6c',
    accent2: '#f6c453',
    art: `
      <g transform="translate(330 62)">
        <rect x="0" y="0" width="252" height="206" rx="24" fill="#210d17" stroke="#ff5d6c" stroke-opacity=".35"/>
        <rect x="32" y="28" width="188" height="58" rx="10" fill="#0b111a" stroke="#ff5d6c" stroke-opacity=".28"/>
        <text x="126" y="67" text-anchor="middle" fill="#f6c453" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="700" letter-spacing="3">00:08</text>
        <path d="M30 120C72 96 174 146 222 112" fill="none" stroke="#ff5d6c" stroke-width="7" stroke-linecap="round"/>
        <path d="M30 150C82 126 166 174 222 140" fill="none" stroke="#22d3ee" stroke-width="7" stroke-linecap="round"/>
        <path d="M30 180C70 158 176 206 222 166" fill="none" stroke="#f6c453" stroke-width="7" stroke-linecap="round"/>
        <g fill="#0b111a" stroke="#ff5d6c" stroke-width="2"><circle cx="30" cy="120" r="9"/><circle cx="222" cy="112" r="9"/></g>
        <g fill="#0b111a" stroke="#22d3ee" stroke-width="2"><circle cx="30" cy="150" r="9"/><circle cx="222" cy="140" r="9"/></g>
        <g fill="#0b111a" stroke="#f6c453" stroke-width="2"><circle cx="30" cy="180" r="9"/><circle cx="222" cy="166" r="9"/></g>
        <path d="M174 112l16 -10M190 112l-9 15M222 112l-17 -12" stroke="#ff5d6c" stroke-width="2" opacity=".8"/>
      </g>`
  },
  {
    slug: 'moon-mover',
    title: 'Moon Mover',
    kicker: 'LUNAR LANDER',
    blurb: 'Feather the thrusters and set all three moon pads down gently before the fuel runs dry.',
    accent: '#f6c453',
    accent2: '#5eead4',
    art: `
      <g transform="translate(322 42)">
        <circle cx="190" cy="94" r="72" fill="#d9e4f8" opacity=".93"/>
        <circle cx="163" cy="74" r="12" fill="#adc0dc" opacity=".55"/><circle cx="212" cy="113" r="18" fill="#adc0dc" opacity=".42"/><circle cx="220" cy="68" r="7" fill="#adc0dc" opacity=".5"/>
        <g fill="#fff"><circle cx="34" cy="48" r="2"/><circle cx="286" cy="30" r="2.5"/><circle cx="300" cy="142" r="1.5"/><circle cx="58" cy="178" r="1.5"/></g>
        <path d="M0 220H294L278 207H20Z" fill="#1b2740"/>
        <rect x="102" y="204" width="92" height="8" rx="4" fill="#5eead4"/>
        <g transform="translate(148 124)">
          <path d="M0 -34L33 22H-33Z" fill="#dfe8ff"/>
          <circle cx="0" cy="-3" r="9" fill="#22d3ee"/>
          <path d="M-16 20L-28 40M16 20L28 40" stroke="#7c8cff" stroke-width="4" stroke-linecap="round"/>
          <path d="M-7 36L0 60L7 36Z" fill="#f6c453" opacity=".9"/>
        </g>
      </g>`
  },
  {
    slug: 'prism-shift',
    title: 'Prism Shift',
    kicker: 'COLOR ARCADE',
    blurb: 'Slide between lanes, shift your prism color, and absorb every crystal that comes your way.',
    accent: '#ff5d8f',
    accent2: '#22d3ee',
    art: `
      <g transform="translate(328 46)">
        <rect x="0" y="0" width="260" height="226" rx="20" fill="#100e24" stroke="#ff5d8f" stroke-opacity=".2"/>
        <g stroke="#5b6d99" stroke-opacity=".35" stroke-width="1"><path d="M86 14V212M174 14V212"/></g>
        <g>
          <path d="M43 56l17 17-17 17-17-17Z" fill="#ff5d8f"/><path d="M130 88l17 17-17 17-17-17Z" fill="#22d3ee"/><path d="M217 48l17 17-17 17-17-17Z" fill="#f6c453"/>
          <path d="M43 124l14 14-14 14-14-14Z" fill="#22d3ee" opacity=".55"/><path d="M130 156l14 14-14 14-14-14Z" fill="#ff5d8f" opacity=".45"/>
        </g>
        <g transform="translate(130 198)">
          <path d="M0 -27L30 23H-30Z" fill="#22d3ee"/>
          <path d="M0 -10L12 15H-12Z" fill="#0b1424"/>
          <path d="M-25 25L-38 32M25 25L38 32" stroke="#22d3ee" stroke-width="3" opacity=".6"/>
        </g>
        <path d="M0 218H260" stroke="#ff5d8f" stroke-opacity=".18"/>
      </g>`
  },
  {
    slug: 'dust-rally',
    title: 'Dust Rally',
    kicker: 'DESERT CIRCUIT',
    blurb: 'Throw a rally car into the dust, sweep the checkpoint ring, and beat the clock.',
    accent: '#f6a94a',
    accent2: '#5eead4',
    art: `
      <g transform="translate(318 42)">
        <circle cx="228" cy="64" r="42" fill="#ffbd67" opacity=".9"/>
        <path d="M0 164L42 142L98 160L151 126L208 155L260 138L322 160V224H0Z" fill="#3b2030" opacity=".8"/>
        <path d="M0 197C55 171 98 210 152 186C208 161 250 194 322 174V224H0Z" fill="#603528"/>
        <path d="M12 205C65 188 94 218 151 196C209 173 254 205 312 186" fill="none" stroke="#f6c453" stroke-width="2" stroke-dasharray="7 12" opacity=".8"/>
        <circle cx="217" cy="198" r="25" fill="none" stroke="#f6c453" stroke-width="3"/>
        <circle cx="217" cy="198" r="10" fill="none" stroke="#f6c453" stroke-width="2" opacity=".5"/>
        <g transform="translate(116 190) rotate(-28)">
          <rect x="-31" y="-18" width="62" height="36" rx="7" fill="#f6a94a"/>
          <rect x="-15" y="-11" width="28" height="22" rx="4" fill="#14202c"/>
          <rect x="-32" y="-22" width="13" height="8" rx="2" fill="#0d141e"/><rect x="19" y="-22" width="13" height="8" rx="2" fill="#0d141e"/>
          <rect x="-32" y="14" width="13" height="8" rx="2" fill="#0d141e"/><rect x="19" y="14" width="13" height="8" rx="2" fill="#0d141e"/>
        </g>
        <g fill="#d99b63" opacity=".42"><circle cx="76" cy="205" r="10"/><circle cx="58" cy="216" r="7"/><circle cx="96" cy="215" r="6"/></g>
      </g>`
  },
  {
    slug: 'hexbound',
    title: 'Hexbound',
    kicker: 'TERRITORY DUEL',
    blurb: 'Expand from your corner, claim the glowing hexes, and leave the rival intelligence nowhere to grow.',
    accent: '#22d3ee',
    accent2: '#f472b6',
    art: `
      <g transform="translate(326 54)">
        <g stroke="#5d6d9f" stroke-opacity=".35" stroke-width="1.5" fill="#101c35">
          <polygon points="52,6 92,29 92,75 52,98 12,75 12,29"/>
          <polygon points="132,6 172,29 172,75 132,98 92,75 92,29"/>
          <polygon points="92,98 132,121 132,167 92,190 52,167 52,121" fill="#0d2841" stroke="#22d3ee"/>
          <polygon points="172,98 212,121 212,167 172,190 132,167 132,121" fill="#2d1633" stroke="#f472b6"/>
          <polygon points="212,6 252,29 252,75 212,98 172,75 172,29" fill="#2d1633" stroke="#f472b6"/>
          <polygon points="132,98 172,121 172,167 132,190 92,167 92,121" fill="#0d2841" stroke="#22d3ee"/>
        </g>
        <g fill="#22d3ee"><circle cx="92" cy="144" r="6"/><circle cx="52" cy="52" r="4" opacity=".6"/><circle cx="132" cy="52" r="4" opacity=".6"/></g>
        <g fill="#f472b6"><circle cx="172" cy="144" r="6"/><circle cx="212" cy="52" r="4" opacity=".6"/><circle cx="252" cy="52" r="4" opacity=".6"/></g>
        <path d="M92 144L132 121M172 144L212 121" stroke="#eef3ff" stroke-opacity=".2" stroke-dasharray="4 5"/>
      </g>`
  },
  {
    slug: 'signal-lost',
    title: 'Signal Lost',
    kicker: 'RADIO PUZZLE',
    blurb: 'Sweep the dial through the static, find the hidden frequency, and lock five broadcasts before time runs out.',
    accent: '#5eead4',
    accent2: '#f6c453',
    art: `
      <g transform="translate(332 50)">
        <rect x="0" y="0" width="254" height="222" rx="24" fill="#071820" stroke="#5eead4" stroke-opacity=".2"/>
        <circle cx="127" cy="106" r="78" fill="#041018" stroke="#5eead4" stroke-opacity=".28" stroke-width="2"/>
        <g stroke="#5eead4" stroke-opacity=".4" stroke-width="2">
          <path d="M127 28V42M127 170V184M49 106H63M191 106H205M72 51L82 61M182 151L192 161M182 51L172 61M72 151L82 141"/>
        </g>
        <path d="M127 106L180 67" stroke="#5eead4" stroke-width="5" stroke-linecap="round"/>
        <circle cx="127" cy="106" r="9" fill="#d8fff9"/>
        <g fill="#5eead4"><rect x="30" y="194" width="6" height="10"/><rect x="42" y="188" width="6" height="16"/><rect x="54" y="180" width="6" height="24"/><rect x="66" y="188" width="6" height="16"/><rect x="78" y="194" width="6" height="10"/><rect x="90" y="184" width="6" height="20" opacity=".55"/><rect x="102" y="190" width="6" height="14" opacity=".45"/></g>
        <circle cx="127" cy="106" r="94" fill="none" stroke="#5eead4" stroke-opacity=".12"/>
      </g>`
  },
  {
    slug: 'tidepool',
    title: 'Tidepool',
    kicker: 'SHALLOW WATER',
    blurb: 'Skitter through the shallows, scoop up lost shells, and keep one eye on the sky.',
    accent: '#5eead4',
    accent2: '#f6c453',
    art: `
      <g transform="translate(318 46)">
        <path d="M0 68C48 54 83 80 130 65C178 50 211 80 258 63C287 53 306 60 322 67V224H0Z" fill="#0a3342"/>
        <path d="M0 100C47 85 87 111 134 96C178 82 219 110 264 94C287 86 307 91 322 98" fill="none" stroke="#5eead4" stroke-opacity=".22" stroke-width="2"/>
        <path d="M0 153C49 137 88 162 133 147C181 132 220 160 265 144C289 136 306 140 322 146" fill="none" stroke="#5eead4" stroke-opacity=".16" stroke-width="2"/>
        <g transform="translate(155 146)">
          <ellipse cx="0" cy="0" rx="37" ry="23" fill="#f47b50"/>
          <circle cx="-28" cy="-12" r="4" fill="#07141d"/><circle cx="28" cy="-12" r="4" fill="#07141d"/>
          <path d="M-26 20L-44 34M0 24V40M26 20L44 34M-22 -18L-38 -31M22 -18L38 -31" stroke="#f47b50" stroke-width="6" stroke-linecap="round"/>
          <path d="M-39 -1L-56 -7M39 -1L56 -7" stroke="#ffb08a" stroke-width="5" stroke-linecap="round"/>
        </g>
        <g transform="translate(240 176)">
          <path d="M0 0C-15 -4 -20 -20 -7 -28C0 -32 0 -20 0 -20C0 -20 0 -32 7 -28C20 -20 15 -4 0 0Z" fill="#f6c453"/>
          <path d="M0 0V14" stroke="#f6c453" stroke-width="2"/>
        </g>
        <path d="M35 54C47 37 63 44 71 54C63 44 79 37 91 54" fill="none" stroke="#dceeff" stroke-width="3" stroke-linecap="round" opacity=".75"/>
        <g fill="#f6c453" opacity=".8"><circle cx="74" cy="198" r="3"/><circle cx="103" cy="186" r="2"/><circle cx="276" cy="206" r="2"/></g>
      </g>`
  },
  {
    slug: 'orbit-forge',
    title: 'Orbit Forge',
    kicker: 'ORBITAL ARCADE',
    blurb: 'Ride a broken orbit, thread the asteroid belts, and forge starlight into a new record.',
    accent: '#7c8cff',
    accent2: '#f6c453',
    art: `
      <g transform="translate(322 42)">
        <circle cx="162" cy="108" r="57" fill="url(#planet)"/>
        <ellipse cx="162" cy="108" rx="91" ry="26" fill="none" stroke="#5eead4" stroke-opacity=".5" stroke-width="2" transform="rotate(-18 162 108)"/>
        <ellipse cx="162" cy="108" rx="132" ry="88" fill="none" stroke="#7c8cff" stroke-opacity=".2" stroke-dasharray="3 7"/>
        <g fill="#f6c453"><circle cx="52" cy="58" r="4"/><circle cx="290" cy="82" r="3"/><circle cx="250" cy="186" r="3.5"/></g>
        <g transform="translate(244 58) rotate(22)">
          <path d="M0 -18L16 12L0 6L-16 12Z" fill="#22d3ee"/>
          <circle cx="0" cy="-5" r="3" fill="#d8ffff"/>
        </g>
        <g fill="#3d3550" stroke="#f472b6" stroke-opacity=".45" stroke-width="1.5">
          <circle cx="68" cy="164" r="12"/><circle cx="278" cy="148" r="9"/>
        </g>
        <path d="M162 108L244 58" stroke="#22d3ee" stroke-opacity=".18" stroke-dasharray="4 8"/>
      </g>`
  }
];

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function coverSvg(game) {
  const titleSize = game.title.length > 14 ? 32 : 38;
  const unique = game.slug.replace(/[^a-z0-9]/g, '-');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360" role="img" aria-label="${esc(game.title)} cover art">
  <defs>
    <linearGradient id="bg-${unique}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d1426"/>
      <stop offset=".58" stop-color="#07101e"/>
      <stop offset="1" stop-color="#03070f"/>
    </linearGradient>
    <radialGradient id="glow-${unique}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${game.accent}" stop-opacity=".34"/>
      <stop offset=".55" stop-color="${game.accent}" stop-opacity=".1"/>
      <stop offset="1" stop-color="${game.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fade-${unique}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#03070f" stop-opacity="0"/>
      <stop offset="1" stop-color="#03070f" stop-opacity=".95"/>
    </linearGradient>
    <radialGradient id="torch" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#d8ffff" stop-opacity=".8"/>
      <stop offset=".4" stop-color="#5eead4" stop-opacity=".25"/>
      <stop offset="1" stop-color="#5eead4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="planet" cx="35%" cy="28%" r="72%">
      <stop offset="0" stop-color="#5778aa"/>
      <stop offset=".5" stop-color="#243b65"/>
      <stop offset="1" stop-color="#0a1224"/>
    </radialGradient>
    <pattern id="grid-${unique}" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M30 0H0V30" fill="none" stroke="${game.accent}" stroke-opacity=".12" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="640" height="360" fill="url(#bg-${unique})"/>
  <rect width="640" height="360" fill="url(#grid-${unique})" opacity=".5"/>
  <circle cx="488" cy="170" r="190" fill="url(#glow-${unique})"/>
  <path d="M0 342H640V360H0Z" fill="url(#fade-${unique})"/>
  <text x="36" y="35" fill="${game.accent}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="3">COOL ORIGINALS</text>
  <rect x="542" y="18" width="62" height="24" rx="12" fill="${game.accent}" fill-opacity=".13" stroke="${game.accent}" stroke-opacity=".7"/>
  <text x="573" y="34" fill="${game.accent}" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="700" text-anchor="middle" letter-spacing="2">NEW</text>
  ${game.art}
  <text x="36" y="270" fill="${game.accent}" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="2.5">${esc(game.kicker)}</text>
  <text x="34" y="317" fill="#f4f7ff" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="900" letter-spacing="-1.5">${esc(game.title)}</text>
  <text x="36" y="340" fill="#9ba9c9" font-family="Arial, Helvetica, sans-serif" font-size="9" letter-spacing="2">A HAND-BUILT GAME FOR COOL</text>
</svg>
`;
}

function pageHtml(game) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>${esc(game.title)} — Cool Originals</title>
  <meta name="description" content="${esc(game.blurb)}">
  <meta name="theme-color" content="#05080f">
  <link rel="stylesheet" href="../arcade/arcade.css">
</head>
<body data-game="${game.slug}">
  <div class="arcade-shell">
    <header class="arcade-bar">
      <a class="arcade-brand" href="../../index.html" target="_top"><span class="mark">O</span><span>Cool Originals</span></a>
      <div class="arcade-hud">
        <div class="hud-chip"><span id="scoreLabel">Score</span><b id="scoreValue">0</b></div>
        <div class="hud-chip"><span id="bestLabel">Best</span><b id="bestValue">—</b></div>
        <button class="arcade-btn" id="restartBtn" type="button">Restart</button>
      </div>
    </header>
    <main class="arcade-stage">
      <canvas id="stage" width="960" height="540" aria-label="${esc(game.title)} game"></canvas>
      <div class="arcade-overlay" id="overlay">
        <div class="overlay-card">
          <span class="overlay-kicker" id="overlayKicker">Cool Originals</span>
          <h1 id="overlayTitle">${esc(game.title)}</h1>
          <p id="overlayText">${esc(game.blurb)}</p>
          <button class="arcade-btn primary" id="startBtn" type="button">Play</button>
        </div>
      </div>
    </main>
    <footer class="arcade-foot">
      <span id="controlsHint">Loading controls…</span>
      <span class="arcade-tag">Original · Cool Originals</span>
    </footer>
    <div class="touch-pad" id="touchPad"></div>
  </div>
  <script src="originals.js?v=3"></script>
  <script src="${game.slug}.js?v=3"></script>
</body>
</html>
`;
}

games.forEach((game) => {
  const svg = coverSvg(game);
  fs.writeFileSync(path.join(IMAGES, 'g_' + game.slug + '.svg'), svg, 'utf8');
  fs.writeFileSync(path.join(ORIGINALS, game.slug + '.html'), pageHtml(game), 'utf8');
});

console.log('Generated', games.length, 'originals pages and covers.');
