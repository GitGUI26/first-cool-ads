/*
 * Import the non-duplicate games from the Offline HTML Games Pack.
 *
 * The pack is 5.3 GB. Copying every game into this repo would make the site
 * undeployable, so new games use the pack's public raw GitHub URLs. The site's
 * game loader fetches the HTML and injects the account progress bridge.
 *
 * Usage:
 *   node tools/import_offline_pack.js "/path/to/offline"
 *
 * The importer is idempotent: games already in js/games.js are skipped by
 * title, URL, punctuation-insensitive title, and known aliases. It also
 * generates a 640x360 cover for every new game.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = process.argv[2] || 'C:/Users/Logan/Downloads/Offline-HTML-Games-Pack-master/Offline-HTML-Games-Pack-master/offline';
const RAW_BASE = 'https://raw.githubusercontent.com/CoolDude2349/Offline-HTML-Games-Pack/master/offline/';

if (!fs.existsSync(SOURCE)) {
  console.error('Pack folder not found:', SOURCE);
  process.exit(1);
}

const gamesSource = fs.readFileSync(path.join(ROOT, 'js/games.js'), 'utf8');
const games = new Function(gamesSource + '\nreturn games;')();

function compact(value) {
  let text = String(value == null ? '' : value).toLowerCase().replace(/['’]/g, '').replace(/&/g, ' and ');
  text = text.replace(/^(the|a|an)[\s._-]+/, '');
  return text.replace(/[^a-z0-9]/g, '');
}

const titleKeys = new Map();
const urlKeys = new Map();
for (const game of games) {
  titleKeys.set(compact(game.title), game);
  const basename = String(game.url || '').split('/').pop();
  urlKeys.set(compact(basename), game);
}

// Renamed ports/versions that are the same game under a shorter filename.
const aliases = {
  sm63: 'supermario63',
  '112': 'minecraft1122',
  amongus: 'amongusreal',
  fireboyandwatergirl: 'fireboyandwatergirlforesttemple',
  theimpossiblequiz: 'impossiblequiz',
  theimpossiblequiz2: 'impossiblequiz2',
  madnessprojectnexus: 'madnesscombatprojectnexus',
  timeshooter3: 'timeshooter3swat',
  bloonstd5: 'bloonstowerdefense5',
  thereisnog: 'thereisnogame',
  snowrider: 'snowrider3d',
  drivemad: 'drivemads',
  geometrydash: 'geometrydashwebport',
  mineseeker: 'minesweeperclassic',
  minesweeper: 'minesweeperclassic',
  triviacrack: 'trivacrack'
};

const files = fs.readdirSync(SOURCE).filter(file => /\.html?$/i.test(file)).sort((a, b) => a.localeCompare(b));
const wasmBases = new Set(
  files.filter(file => /_WASM\.html$/i.test(file)).map(file => file.replace(/_WASM\.html$/i, '.html'))
);
const candidates = [];
const skipped = [];
const seenPack = new Map();

for (const file of files) {
  if (/_WASM\.html$/i.test(file) && wasmBases.has(file.replace(/_WASM\.html$/i, '.html'))) {
    skipped.push({ file, reason: 'WASM duplicate' });
    continue;
  }
  const stem = file.replace(/\.html?$/i, '');
  const key = compact(stem);
  if (seenPack.has(key)) {
    skipped.push({ file, reason: 'pack duplicate of ' + seenPack.get(key) });
    continue;
  }
  const match = titleKeys.get(aliases[key] || key) || urlKeys.get(key) || titleKeys.get(key);
  if (match) {
    skipped.push({ file, reason: 'existing: ' + match.title, url: match.url });
    continue;
  }
  seenPack.set(key, file);
  candidates.push(file);
}

const TITLE_OVERRIDES = {
  '1.5': 'Minecraft 1.5',
  '1.8': 'Minecraft 1.8',
  '3D-flight-simulator': '3D Flight Simulator',
  openTTD: 'OpenTTD',
  'papas-bakeria': "Papa's Bakeria",
  'eugenes-life': "Eugene's Life",
  'picos-school': "Pico's School",
  'moto-x3m': 'Moto X3M',
  'moto-x3m-2': 'Moto X3M 2',
  'moto-x3m-3': 'Moto X3M 3',
  'vex-x3m': 'Vex X3M',
  'vex-x3m-2': 'Vex X3M 2',
  'bloons-TD-5': 'Bloons TD 5',
  'subway-surfers-beijing': 'Subway Surfers: Beijing',
  'subway-surfers-havana': 'Subway Surfers: Havana',
  'subway-surfers-san-francisco': 'Subway Surfers: San Francisco',
  'super-bike-the-champion': 'Super Bike: The Champion',
  'this-is-the-only-level-too': 'This Is the Only Level Too',
  ovo: 'OvO',
  'ovo-3-dimensions': 'OvO 3 Dimensions',
  'fleeing-the-complex': 'Fleeing the Complex',
  'infiltrating-the-airship': 'Infiltrating the Airship',
  'madalin-stunt-cars-2': 'Madalin Stunt Cars 2',
  'drift-hunters-pro': 'Drift Hunters Pro',
  'funny-mad-racing': 'Funny Mad Racing',
  'escape-road-2': 'Escape Road 2',
  '10-minutes-till-dawn': '10 Minutes Till Dawn',
  'cut-the-rope-time-travel': 'Cut the Rope: Time Travel',
  'cut-the-rope-holiday-gift': 'Cut the Rope: Holiday Gift',
  'red-ball-4-vol-1': 'Red Ball 4: Vol. 1',
  'red-ball-4-vol-2': 'Red Ball 4: Vol. 2',
  'red-ball-4-vol-3': 'Red Ball 4: Vol. 3',
  'snowball-io': 'Snowball.io',
  'cleanup-io': 'Cleanup.io',
  'ducklings-io': 'Ducklings.io',
  'house-of-hazards': 'House of Hazards',
  'tunnel-rush': 'Tunnel Rush',
  'there-is-no-g': 'There Is No G',
  'big-neon-tower-tiny-square': 'Big Neon Tower Tiny Square',
  'big-ice-tower-tiny-square': 'Big Ice Tower Tiny Square',
  'drive-mad': 'Drive Mad',
  'fancy-pants-adventure-2': 'Fancy Pants Adventure 2',
  'angry-birds-showdown': 'Angry Birds Showdown',
  'angry-birds-space': 'Angry Birds Space',
  'fireboy-and-watergirl-2': 'Fireboy and Watergirl 2',
  'fireboy-and-watergirl-3': 'Fireboy and Watergirl 3',
  'fireboy-and-watergirl-4': 'Fireboy and Watergirl 4',
  'bad-ice-cream': 'Bad Ice Cream',
  'papa-bakeria': "Papa's Bakeria",
  'ragdoll-soccer': 'Ragdoll Soccer',
  'hover-racer-drive': 'Hover Racer Drive',
  'geometry-vibes': 'Geometry Vibes',
  'chaos-faction-2': 'Chaos Faction 2',
  'snow-road': 'Snow Road',
  'melon-playground': 'Melon Playground',
  'fancy-pants-adventure': 'Fancy Pants Adventure',
  'dreadhead-parkour': 'Dreadhead Parkour',
  'slow-roads': 'Slow Roads',
  'crazy-motorcycle': 'Crazy Motorcycle',
  'car-king-arena': 'Car King Arena',
  'cluster-rush': 'Cluster Rush',
  'space-waves': 'Space Waves',
  'guess-their-answer': 'Guess Their Answer',
  'eagle-ride': 'Eagle Ride',
  'flood-runner-2': 'Flood Runner 2',
  'flood-runner-3': 'Flood Runner 3',
  'flood-runner-4': 'Flood Runner 4',
  'learn-to-fly-2': 'Learn to Fly 2',
  'learn-to-fly-idle': 'Learn to Fly Idle',
  'space-is-key-2': 'Space Is Key 2',
  'slope-2-player': 'Slope 2 Player',
  'ping-pong-chaos': 'Ping Pong Chaos',
  'breaking-the-bank': 'Breaking the Bank',
  'tube-jumpers': 'Tube Jumpers',
  'basket-bros': 'Basket Bros',
  'soccer-bros': 'Soccer Bros',
  'wrestle-bros': 'Wrestle Bros',
  'karate-bros': 'Karate Bros',
  'bob-the-robber': 'Bob the Robber',
  'bob-the-robber-2': 'Bob the Robber 2',
  'bob-the-robber-5': 'Bob the Robber 5',
  'snail-bob': 'Snail Bob',
  'snail-bob-2': 'Snail Bob 2',
  'snail-bob-3': 'Snail Bob 3',
  'snail-bob-4': 'Snail Bob 4',
  'snail-bob-5': 'Snail Bob 5',
  'snail-bob-6': 'Snail Bob 6',
  'snail-bob-7': 'Snail Bob 7',
  'snail-bob-8': 'Snail Bob 8',
  'wheely-2': 'Wheely 2',
  'wheely-3': 'Wheely 3',
  'wheely-4': 'Wheely 4',
  'wheely-5': 'Wheely 5',
  'wheely-6': 'Wheely 6',
  'wheely-7': 'Wheely 7',
  'wheely-8': 'Wheely 8',
  'duck-life-2': 'Duck Life 2',
  'duck-life-3': 'Duck Life 3',
  'duck-life-4': 'Duck Life 4',
  'duck-life-5': 'Duck Life 5',
  'riddle-school-3': 'Riddle School 3',
  'riddle-school-4': 'Riddle School 4',
  'riddle-school-5': 'Riddle School 5',
  'riddle-transfer': 'Riddle Transfer',
  'riddle-transfer-2': 'Riddle Transfer 2',
  'vex-4': 'Vex 4',
  'vex-5': 'Vex 5',
  'vex-6': 'Vex 6',
  'vex-7': 'Vex 7',
  'bloons-td-5': 'Bloons TD 5',
  'time-shooter-3': 'Time Shooter 3',
  '12-mini-battles': '12 Mini Battles',
  'this-is-the-only-level': 'This Is the Only Level',
  'elastic-face': 'Elastic Face',
  'papas-bakeria': "Papa's Bakeria"
};

function titleCase(value) {
  const small = new Set(['and', 'the', 'of', 'in', 'to', 'a', 'an', 'on', 'for', 'vs', 'vol']);
  return String(value)
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function titleFor(file) {
  const stem = file.replace(/\.html?$/i, '');
  return TITLE_OVERRIDES[stem] || titleCase(stem);
}

function categoryFor(title, file) {
  const text = (title + ' ' + file).toLowerCase();
  if (/bad ice cream|fancy pants|vex |vex-|geometry|fireboy|watergirl|cut the rope|snail bob|riddle|impossible|this is the only level|there is no g|helix jump|2048|puzzle|block|word|quiz|trivia|minesweeper/.test(text)) return 'puzzle';
  if (/papa|bakeria|cook|chef|restaurant|pizza|sushi|burger|taco|donut|cupcake|pancake|wing|hot dog|freezeria|cheeseria|pastaria|scooperia/.test(text)) return 'cooking';
  if (/fnaf|horror|granny|backrooms|murder|deadly|they are coming|death chase|zombie|ghost/.test(text)) return 'horror';
  if (/soccer|football|basketball|tennis|golf|baseball|boxing|wrestle|karate|volley|ping pong|sports|bros/.test(text)) return 'sports';
  if (/race|racing|drift|car|motor|bike|traffic|highway|stunt|wheely|truck|road|derby|parking|slope|subway surfers/.test(text)) return 'racing';
  if (/shoot|sniper|war|battle|tank|gun|strike|fps|combat|brawl|clash|madness/.test(text)) return 'action';
  if (/minecraft|sandbox|craft|1\.5|1\.8|melon|openTTD/.test(text)) return 'sandbox';
  if (/idle|clicker|tycoon|sim|manager|city|farm|life|school|hospital|slow roads/.test(text)) return 'simulation';
  if (/io$|\.io|multiplayer|snowball|cleanup|ducklings/.test(text)) return 'multiplayer';
  if (/run|jump|climb|parkour|platform|dash|tunnel|rooftop|eagle|cluster/.test(text)) return 'platformer';
  if (/adventure|quest|rpg|dungeon|mystery|fleeing|airship|complex|stealing|escaping|prison|six cats|house of hazards/.test(text)) return 'adventure';
  if (/bloons|age of war|strategy|clash/.test(text)) return 'strategy';
  return 'arcade';
}

const BLURBS = {
  racing: 'A full-screen racing challenge built for quick runs, tight corners, and new personal bests.',
  sports: 'A fast, full-screen sports game with simple controls and instant rematches.',
  horror: 'A tense full-screen horror game where every sound and every step matters.',
  puzzle: 'A full-screen puzzle game packed with bite-sized levels, clever tricks, and a saved run.',
  action: 'A full-screen action game with quick fights, tight controls, and nonstop momentum.',
  simulation: 'A full-screen simulation where you build, manage, and experiment at your own pace.',
  multiplayer: 'A fast full-screen arena game with simple controls and endless replayability.',
  platformer: 'A full-screen platformer with sharp jumps, quick retries, and a run worth saving.',
  adventure: 'A full-screen adventure full of secrets, close calls, and a journey that saves as you go.',
  cooking: 'A full-screen cooking challenge with orders, upgrades, and a shift worth saving.',
  sandbox: 'A full-screen sandbox where you can build, experiment, and make your own fun.',
  strategy: 'A full-screen strategy game about smart choices, tight defenses, and the long game.',
  arcade: 'A full-screen arcade game with quick rounds, simple controls, and a high score worth chasing.'
};

const PALETTES = {
  racing: [['#ff9f43', '#ff5d6c'], ['#f6c453', '#ff7d5c'], ['#38bdf8', '#a78bfa']],
  sports: [['#5eead4', '#3b82f6'], ['#f6c453', '#5eead4'], ['#a3e635', '#22d3ee']],
  horror: [['#ff5d6c', '#7c3aed'], ['#f472b6', '#ef4444'], ['#a78bfa', '#fb7185']],
  puzzle: [['#7c8cff', '#22d3ee'], ['#c084fc', '#38bdf8'], ['#f6c453', '#a78bfa']],
  action: [['#ff7d5c', '#f6c453'], ['#fb7185', '#f97316'], ['#f43f5e', '#facc15']],
  simulation: [['#44d7b6', '#7c8cff'], ['#60a5fa', '#5eead4'], ['#a3e635', '#38bdf8']],
  multiplayer: [['#f472b6', '#8b5cf6'], ['#22d3ee', '#a78bfa'], ['#fb7185', '#22d3ee']],
  platformer: [['#22d3ee', '#f472b6'], ['#5eead4', '#f6c453'], ['#38bdf8', '#a3e635']],
  adventure: [['#f6c453', '#ff7d5c'], ['#fb923c', '#facc15'], ['#5eead4', '#f6c453']],
  cooking: [['#fda4af', '#fbbf24'], ['#fb923c', '#f472b6'], ['#f6c453', '#fb7185']],
  sandbox: [['#4ade80', '#22d3ee'], ['#a3e635', '#38bdf8'], ['#5eead4', '#a78bfa']],
  strategy: [['#60a5fa', '#a78bfa'], ['#38bdf8', '#f6c453'], ['#7c8cff', '#5eead4']],
  arcade: [['#7c8cff', '#22d3ee'], ['#f472b6', '#7c8cff'], ['#5eead4', '#f6c453']]
};

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
}

function wrapTitle(title) {
  const words = title.toUpperCase().split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? current + ' ' + word : word;
    if (next.length > 17 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length > 3) {
    const merged = [];
    const chunk = Math.ceil(lines.length / 3);
    for (let i = 0; i < lines.length; i += chunk) merged.push(lines.slice(i, i + chunk).join(' '));
    return merged.slice(0, 3);
  }
  return lines;
}

function categoryIcon(category) {
  const common = 'fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    racing: `<g ${common}><circle cx="0" cy="4" r="45"/><circle cx="0" cy="4" r="16"/><path d="M0 -41V-13M0 21V49M-45 4H-17M17 4H45M-32 -28L-12 -8M12 16L32 36M32 -28L12 -8M-12 16L-32 36"/><path d="M-72 34H-52M-82 52H-58" opacity=".55"/></g>`,
    sports: `<g ${common}><circle cx="0" cy="0" r="46"/><path d="M0 -46V46M-46 0H46M-31 -31L31 31M31 -31L-31 31"/><path d="M-18 -43C-5 -28 5 -28 18 -43M-18 43C-5 28 5 28 18 43" opacity=".6"/></g>`,
    horror: `<g ${common}><path d="M-38 -8C-38 -39 -20 -56 0 -56S38 -39 38 -8V34L24 22 10 36-4 22-20 36-38 24Z"/><circle cx="-13" cy="-12" r="5" fill="currentColor" stroke="none"/><circle cx="13" cy="-12" r="5" fill="currentColor" stroke="none"/><path d="M-10 10Q0 18 10 10" opacity=".7"/></g>`,
    puzzle: `<g ${common}><path d="M-46 -46H-12V-32C-12 -25-6 -20 0 -20S12 -25 12 -32V-46H46V-12H32C25 -12 20 -6 20 0S25 12 32 12H46V46H12V32C12 25 6 20 0 20S-12 25-12 32V46H-46V12H-32C-25 12-20 6-20 0S-25 -12-32 -12H-46Z"/></g>`,
    action: `<g ${common}><circle cx="0" cy="0" r="34"/><circle cx="0" cy="0" r="55" opacity=".45"/><path d="M0 -64V-42M0 42V64M-64 0H-42M42 0H64M-13 0H13M0 -13V13"/></g>`,
    simulation: `<g ${common}><circle cx="0" cy="0" r="30"/><circle cx="0" cy="0" r="10"/><path d="M0 -54V-36M0 36V54M-54 0H-36M36 0H54M-38 -38L-26 -26M26 26L38 38M38 -38L26 -26M-26 26L-38 38"/></g>`,
    multiplayer: `<g ${common}><circle cx="0" cy="0" r="48"/><path d="M-16 -47C-42 -22-42 22-16 47M16 -47C42 -22 42 22 16 47M-48 0H48M-42 -22H42M-42 22H42"/><circle cx="0" cy="0" r="6" fill="currentColor" stroke="none"/></g>`,
    platformer: `<g ${common}><path d="M-52 40H-16V16H20V-8H54"/><path d="M-38 22V-2H-2V-26H32" opacity=".5"/><circle cx="-26" cy="-12" r="8"/><path d="M-26 -4V16M-26 4L-38 12M-26 4L-14 12M-26 16L-36 30M-26 16L-16 30"/></g>`,
    adventure: `<g ${common}><circle cx="0" cy="0" r="47"/><path d="M30 -30L8 -8-30 30-8 8Z"/><circle cx="0" cy="0" r="5"/><path d="M-35 -35L-25 -25M35 -35L25 -25M-35 35L-25 25M35 35L25 25" opacity=".5"/></g>`,
    cooking: `<g ${common}><path d="M-46 4H20C20 34 4 48-13 48S-46 32-46 4Z"/><path d="M20 10H34C46 10 46 30 34 30H14M-58 4H24" /><path d="M-27 -14C-37 -28-17 -34-27 -50M-5 -14C-15 -28 5 -34-5 -50M17 -14C7 -28 27 -34 17 -50" opacity=".55"/></g>`,
    sandbox: `<g ${common}><path d="M0 -48L48 -22 0 4-48 -22Z"/><path d="M-48 -22V28L0 54V4M48 -22V28L0 54"/><path d="M0 4V54M-48 28L0 4M48 28L0 4" opacity=".55"/></g>`,
    strategy: `<g ${common}><path d="M0 -52L44 -32V8C44 32 24 46 0 55-24 46-44 32-44 8V-32Z"/><path d="M-16 -10L0 6 20 -20" /></g>`,
    arcade: `<g ${common}><path d="M-46 32C-58 32-60 10-48-6L-35-31C-30-42-17-48-6-44L6-40C17-44 30-42 35-31L48-6C60 10 58 32 46 32 34 32 28 22 20 12H-20C-28 22-34 32-46 32Z"/><circle cx="-25" cy="3" r="8"/><path d="M20-2V12M14 5H26"/><path d="M0 -50V-62" opacity=".6"/></g>`
  };
  return icons[category] || icons.arcade;
}

function makeCover(title, category, seed) {
  const palettes = PALETTES[category] || PALETTES.arcade;
  const [accent, accent2] = palettes[seed % palettes.length];
  const lines = wrapTitle(title);
  const maxLen = Math.max(...lines.map(line => line.length), 1);
  const fontSize = Math.max(27, Math.min(48, Math.floor(350 / (maxLen * 0.59))));
  const lineHeight = Math.round(fontSize * 1.06);
  const totalHeight = lines.length * lineHeight;
  const startY = 177 - totalHeight / 2 + fontSize * 0.82;
  const pattern = seed % 3;
  const patternSvg = pattern === 0
    ? `<g stroke="${accent}" stroke-opacity=".11" stroke-width="1"><path d="M0 60H640M0 120H640M0 180H640M0 240H640M0 300H640M80 0V360M160 0V360M240 0V360M320 0V360M400 0V360M480 0V360M560 0V360"/></g>`
    : pattern === 1
      ? `<g stroke="${accent}" stroke-opacity=".12" stroke-width="2"><path d="M-80 360L240 0M0 360L320 0M80 360L400 0M160 360L480 0M240 360L560 0M320 360L640 0"/></g>`
      : `<g fill="${accent}" opacity=".14"><circle cx="70" cy="70" r="2"/><circle cx="120" cy="90" r="1.5"/><circle cx="590" cy="50" r="2"/><circle cx="540" cy="300" r="1.5"/><circle cx="30" cy="250" r="1.5"/><circle cx="350" cy="40" r="1"/><circle cx="370" cy="320" r="1"/></g>`;
  const textSvg = lines.map((line, index) =>
    `<text x="42" y="${startY + index * lineHeight}" fill="#f8fbff" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-1">${escapeXml(line)}</text>`
  ).join('');
  const kicker = category.toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="${escapeXml(title)} cover art">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1426"/><stop offset=".52" stop-color="#09111f"/><stop offset="1" stop-color="#050910"/></linearGradient>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${accent2}"/></linearGradient>
  <radialGradient id="glow" cx=".78" cy=".34" r=".62"><stop offset="0" stop-color="${accent}" stop-opacity=".22"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
</defs>
<rect width="640" height="360" fill="url(#bg)"/>
<rect width="640" height="360" fill="url(#glow)"/>
${patternSvg}
<circle cx="550" cy="56" r="110" fill="${accent}" opacity=".08" filter="url(#soft)"/>
<path d="M0 0H640V4H0Z" fill="url(#accent)" opacity=".6"/>
<g transform="translate(42 38)">
  <path d="M0 0H28V5H5V28H0Z" fill="${accent}" opacity=".8"/>
  <text x="0" y="52" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" letter-spacing="3">${escapeXml(kicker)}</text>
</g>
<g transform="translate(482 174)">
  <rect x="-92" y="-92" width="184" height="184" rx="34" fill="#07101d" fill-opacity=".72" stroke="${accent}" stroke-opacity=".28"/>
  <g color="${accent}" transform="translate(0 2)">${categoryIcon(category)}</g>
  <path d="M-58 68H58" stroke="url(#accent)" stroke-width="2" opacity=".55"/>
</g>
${textSvg}
<g transform="translate(42 326)">
  <text fill="#9aa8c7" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="2">COOL TUTORING HUB</text>
</g>
<g transform="translate(598 326)" text-anchor="end">
  <text fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="700" letter-spacing="2">PROGRESS SAVES</text>
</g>
</svg>`;
}

const usedImages = new Set(games.map(game => game.image).filter(Boolean));
const newEntries = [];
const report = { added: [], skipped, source: SOURCE, rawBase: RAW_BASE };

for (const file of candidates) {
  const title = titleFor(file);
  const category = categoryFor(title, file);
  const stem = file.replace(/\.html?$/i, '');
  let slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) slug = 'game';
  let image = `images/g_pack_${slug}.svg`;
  if (usedImages.has(image)) image = `images/g_pack_${slug}-${compact(stem).slice(-6) || 'game'}.svg`;
  usedImages.add(image);
  fs.writeFileSync(path.join(ROOT, image), makeCover(title, category, newEntries.length + 1), 'utf8');
  const url = RAW_BASE + encodeURIComponent(file);
  newEntries.push({
    title,
    desc: BLURBS[category] + ' Progress saves to your account.',
    url,
    image,
    category
  });
  report.added.push({ file, title, category, image, url });
}

if (newEntries.length) {
  const eol = gamesSource.includes('\r\n') ? '\r\n' : '\n';
  const marker = gamesSource.lastIndexOf('];');
  if (marker < 0) throw new Error('Could not find the end of the games array.');
  let prefix = gamesSource.slice(0, marker).replace(/\s*$/, '');
  if (!/,$/.test(prefix)) prefix += ',';
  const suffix = gamesSource.slice(marker);
  const entries = newEntries.map(entry => {
    const object = { title: entry.title, desc: entry.desc, url: entry.url, image: entry.image };
    return '  ' + JSON.stringify(object).replace(/":/g, '": ').replace(/,"/g, ', "');
  });
  fs.writeFileSync(path.join(ROOT, 'js/games.js'), prefix + eol + entries.join(',' + eol) + eol + suffix, 'utf8');
}

report.totalGames = games.length + newEntries.length;
report.newCount = newEntries.length;
report.duplicateCount = skipped.length;
fs.mkdirSync(path.join(ROOT, '.wrangler'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.wrangler/import-report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ totalGames: report.totalGames, newCount: report.newCount, duplicateCount: report.duplicateCount, added: newEntries.map(entry => entry.title) }, null, 2));
