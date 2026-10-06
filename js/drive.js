// "Drive Through the City": pick the fire truck, police car or ambulance, then hold the big green
// pedal to cruise an endless town built from recycled pieces (shops, parks, a bridge, a tunnel,
// a farm, a train crossing...). No crashes, no timer: the vehicle waits by itself at red lights
// and for trains; with the siren on, traffic pulls over and red lights don't matter.
'use strict';
(() => {
  const P = {};                                     // layout, recomputed in layout()
  const ORDER = [VI.fire, VI.police, VI.amb];       // card order on the pick screen
  const CW = 68;                                    // traffic car length on screen (drawn 2x)
  const ACC = 120, COAST = 75, BRAKE = 260, ENTER = 1.4;
  const st = {
    phase: 'pick', t: 0, vi: VI.fire, cam: 0, v: 0, lane: 1, ly: 1, rot: 0, enterT: 0,
    hold: new Set(), swipes: {}, siren: false, stopSiren: null, idle: 0, hornT: 0, laneT: 0, wheelA: 0, puffT: 0, splashT: 0,
    segs: [], nextX: 0, deck: [], sdeck: [], since: 0, every: 2, lastKind: '', lastCity: false, lastLight: 0, force: [],
    cars: [], peds: [], lights: [], rails: [], spawnT: 0, pedT: 0, braked: null,
  };
  const rumbleLo = noiseLoop(90, 0.8), rumbleHi = noiseLoop(190, 0.9);
  const rc = document.createElement('canvas'), rcG = rc.getContext('2d');   // the road layer, drawn small then scaled 2x
  const rl = document.createElement('canvas'), rlG = rl.getContext('2d');   // headlights for the road layer
  const cardCv = document.createElement('canvas'), cardG = cardCv.getContext('2d');
  cardCv.width = 72; cardCv.height = 46;

  const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pickBy = (list, seed) => list[Math.floor(hsh(seed) * list.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const HAIR = ['#5a3a22', '#2b1d14', '#c98a3a', '#e3b85a', '#8a3a1a'];
  const ADULTS = ['mom', 'dad', 'gran', 'mom', 'dad'];
  const KIDS = ['kid', 'kid2', 'kid3'];
  const WALLS = [['#ffe3b0', '#e8c48a'], ['#ffd0d6', '#e8aab4'], ['#cfe8ff', '#a8c8ea'], ['#d8f0c0', '#b4d39a'], ['#fff3a8', '#e0d07a']];
  const ROOFS = ['#c8432f', '#3f66b8', '#7a4a2a', '#8a4fd9', '#2f8a4a'];
  const CATS = ['#9aa3ad', '#f57a12', '#2f3240', '#e9e2d0'];
  const CAR_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'white', 'black'];
  const WARM_WIN = '#ffd98a', WARM_IN = '#fff1c4';

  const vlen = () => V[st.vi].len * 2;
  function pxNow() {   // player's left edge on screen
    if (st.phase === 'enter') return lerp(-vlen() - 12, P.px, ease(Math.min(1, st.enterT / (ENTER - 0.1))));
    return P.px;
  }
  const rearW = () => st.cam + pxNow();
  const frontW = () => rearW() + vlen();
  const playerYS = () => lerp(P.laneS[0], P.laneS[1], st.ly);          // small-canvas baseline
  const playerLanes = () => (Math.abs(st.ly - st.lane) < 0.05 ? [st.lane] : [0, 1]);
  const carY = c => P.laneS[c.lane] + (c.lane ? P.pullS : -4) * c.pull;
  function person(dx, row, type, pose, seed, dir) {
    return { dx, row, type, pose, seed, dir, skin: pickBy(SKIN, seed + 0.3), hair: pickBy(HAIR, seed + 0.7), wave: 0, hop: 0, cheer: false, greeted: false };
  }
  function line(x0, y0, x1, y1, w, c) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))), o = w >> 1;
    for (let i = 0; i <= n; i++) R(x0 + (x1 - x0) * i / n - o, y0 + (y1 - y0) * i / n - o, w, w, c);
  }

  /* ---------- sounds ---------- */
  const SND = {
    moo() { tone('sawtooth', 150, 0, 0.9, 0.08, 105); tone('sine', 150, 0, 0.9, 0.1, 110); },
    rooster() { tone('sawtooth', 500, 0, 0.12, 0.06, 800); tone('sawtooth', 800, 0.14, 0.12, 0.06, 950); tone('sawtooth', 950, 0.28, 0.45, 0.06, 600); },
    cluck() { for (let i = 0; i < 3; i++) tone('square', 700 + i * 60, i * 0.11, 0.05, 0.05, 480); },
    toot() { [0, 0.6].forEach(s => { tone('square', 196, s, 0.45, 0.08); tone('square', 247, s, 0.45, 0.06); }); },
    whistle() { tone('sine', 660, 0, 0.7, 0.12); tone('sine', 880, 0, 0.7, 0.09); tone('sine', 660, 0.8, 0.5, 0.1); tone('sine', 880, 0.8, 0.5, 0.08); },
    ding() { tone('sine', 1568, 0, 0.3, 0.12); tone('sine', 1319, 0.25, 0.45, 0.12); },
    bell() { tone('triangle', 1250, 0, 0.3, 0.07); tone('sine', 2500, 0, 0.1, 0.02); },
    schoolBell() { for (let i = 0; i < 12; i++) tone('square', 1100, i * 0.055, 0.04, 0.045); },
    clank() { [0, 0.16, 0.32].forEach(s => { noise(s, 0.08, 0.2, 900, 4); tone('square', 180, s, 0.06, 0.05); }); },
    yelp() { tone('triangle', 700, 0, 0.3, 0.1, 1400); tone('triangle', 1400, 0.3, 0.3, 0.1, 700); },
    squeak() { tone('sine', 1200, 0, 0.1, 0.1, 1800); tone('sine', 1200, 0.14, 0.1, 0.1, 1800); },
    bubbles() { for (let i = 0; i < 6; i++) tone('sine', rand(600, 1100), i * 0.07, 0.07, 0.06, rand(1300, 2000)); },
    vroom() { tone('sawtooth', 70, 0, 0.35, 0.07, 140); },
    swish() { tone('sine', 300, 0, 0.18, 0.08, 560); },
    beepBeep(p = 1) { tone('square', 620 * p, 0, 0.1, 0.07); tone('square', 620 * p, 0.15, 0.1, 0.07); },
  };

  /* ---------- layout ---------- */
  function layout() {
    const pr = H > W * 1.25;
    P.pr = pr;
    P.uw = W - L.safeL - L.safeR;
    const x0 = L.safeL + 8, x1 = W - L.safeR - 8, span = x1 - x0;
    if (pr) {   // two rows: home, siren, horn, lane / steering wheel, speedometer, big pedal
      const b = 36;
      P.dashH = 104; P.dashY = H - L.safeB - P.dashH;
      const y1 = P.dashY + 10, y2 = y1 + b + 10, gap = (span - 4 * b) / 3;
      [P.homeB, P.sirenB, P.hornB, P.laneB] = [0, 1, 2, 3].map(i => ({ x: Math.round(x0 + i * (b + gap)), y: y1, s: b }));
      const pw = Math.round(clamp(span * 0.5, 84, 150));
      P.pedal = { x: x1 - pw, y: y2, w: pw, h: 42 };
      P.wheel = { x: x0 + 19, y: y2 + 21, r: 19 };
      const room = P.pedal.x - (x0 + 40) - 6;
      P.speedo = room >= 30 ? { x: Math.round(x0 + 40 + room / 2), y: y2 + 25, r: Math.floor(Math.min(16, room / 2 - 1)) } : null;
    } else {    // one compact row
      const b = 32;
      P.dashH = 46; P.dashY = H - L.safeB - P.dashH;
      const y = P.dashY + 8;
      P.homeB = { x: x0, y, s: b };
      P.sirenB = { x: x0 + b + 18, y, s: b }; P.hornB = { x: x0 + 2 * b + 28, y, s: b }; P.laneB = { x: x0 + 3 * b + 38, y, s: b };
      const pw = Math.round(clamp(span * 0.28, 96, 150));
      P.pedal = { x: x1 - pw, y: P.dashY + 6, w: pw, h: 36 };
      const m0 = P.laneB.x + b + 12, m1 = P.pedal.x - 12;
      P.wheel = m1 - m0 > 40 ? { x: m0 + 18, y: P.dashY + 24, r: 17 } : null;
      P.speedo = m1 - m0 > 84 ? { x: m0 + 58, y: P.dashY + 28, r: 15 } : null;
    }
    P.vergeH = pr ? 12 : 4;
    P.roadBot = P.dashY - P.vergeH; P.roadBot -= P.roadBot & 1;
    P.roadTop = P.roadBot - 60;
    P.rS = P.roadTop / 2;                       // road top in the small (2x) layer
    P.laneS = [P.rS + 14, P.rS + 26];           // far / near lane baselines (small px)
    P.pullS = pr ? 5 : 3;                       // how far near-lane cars pull onto the verge
    P.side = pr ? 16 : 8;                       // sidewalk depth
    P.bY = P.roadTop - P.side;                  // buildings stand here
    P.rowY = [P.roadTop - 2, P.bY + (pr ? 5 : 3)];
    P.skyTop = L.safeT + (pr ? 50 : 30);
    P.maxBH = clamp(P.bY - P.skyTop, 46, 210);
    P.hz = P.bY - (pr ? 40 : 18);
    P.treeR = pr ? 14 : 10;
    P.lampH = pr ? 64 : 50;
    P.tlR = pr ? 4 : 3;
    P.ceil = P.roadTop - (pr ? 96 : 62);       // tunnel ceiling
    P.px = Math.max(L.safeL + 4, Math.round(W * 0.34 - 66)); P.px -= P.px & 1;
    P.vmax = clamp(W * 0.42, 95, 165);
    P.carN = pr ? 2 : 3;
    rc.width = rl.width = Math.ceil(W / 2) + 2; rc.height = rl.height = Math.ceil(H / 2) + 2;
    // pick screen: three cards
    const top = L.safeT + 8, bot = H - L.safeB - 50;
    P.pickHome = { x: L.safeL + 8, y: H - L.safeB - 42, s: 34 };
    if (pr) {
      const cw = Math.min(P.uw - 24, 210), ch = Math.min(112, Math.floor((bot - top - 16) / 3));
      const y0 = top + Math.floor((bot - top - 3 * ch - 16) / 2);
      P.cards = [0, 1, 2].map(i => ({ x: Math.round(L.cx - cw / 2), y: y0 + i * (ch + 8), w: cw, h: ch }));
    } else {
      const gap = 10, cw = Math.min(176, Math.floor((P.uw - 16 - 2 * gap) / 3)), ch = Math.min(112, bot - top);
      const xa = Math.round(L.cx - (3 * cw + 2 * gap) / 2), y0 = top + Math.floor((bot - top - ch) / 2);
      P.cards = [0, 1, 2].map(i => ({ x: xa + i * (cw + gap), y: y0, w: cw, h: ch }));
    }
    if (scene === 'drive') setClouds(L.safeT + 10, Math.max(L.safeT + 30, P.skyTop - 12));
  }

  /* ---------- the endless town ---------- */
  const CITY = ['houses', 'bakery', 'icecream', 'toy', 'park', 'firest', 'hospital', 'police', 'school', 'build', 'gas', 'wash', 'houses', 'park'];
  const CITYSET = new Set(CITY);
  const SPECIAL = ['bridge', 'tunnel', 'rail', 'farm'];
  function nextKind() {
    if (st.force.length) return st.force.shift();
    if (++st.since > st.every) {
      st.since = 0; st.every = 2 + (Math.random() * 2 | 0);
      if (!st.sdeck.length) { st.sdeck = shuffle(SPECIAL); if (st.sdeck[st.sdeck.length - 1] === st.lastSpecial) st.sdeck.reverse(); }
      return (st.lastSpecial = st.sdeck.pop());
    }
    if (!st.deck.length) st.deck = shuffle(CITY);
    let k = st.deck.pop();
    if (k === st.lastKind && st.deck.length) { st.deck.unshift(k); k = st.deck.pop(); }
    return k;
  }
  function addSeg() {
    const kind = nextKind(), K = KIND[kind], city = CITYSET.has(kind);
    if (!city) st.nextX += 16;
    const s = { kind, x: st.nextX, w: K.w, seed: Math.random() * 900 + 1, react: 0, people: [] };
    if (K.init) K.init(s);
    st.segs.push(s);
    st.nextX = s.x + s.w;
    if (city && st.lastCity && st.nextX - st.lastLight > 420 && Math.random() < 0.55) {
      st.lights.push({ x: st.nextX + 12, stopX: st.nextX + 2, state: 'green', t: 0, wait: 0, armed: Math.random() < 0.8, done: false, crossers: [] });
      st.nextX += 50; st.lastLight = st.nextX;
    } else {
      const gap = city ? 6 + (Math.random() * 16 | 0) : 16;
      if (city && gap >= 14) s.tree = s.x + s.w + (gap >> 1);
      st.nextX += gap;
    }
    st.lastCity = city; st.lastKind = kind;
  }
  function gen() {
    while (st.nextX < st.cam + W + 500) addSeg();
    while (st.segs.length && st.segs[0].x + st.segs[0].w + 150 < st.cam) st.segs.shift();
    if (st.lights.length && st.lights[0].x + 80 < st.cam) st.lights.shift();
    if (st.rails.length && st.rails[0].x + 80 < st.cam && st.rails[0].state !== 'train') st.rails.shift();
  }
  function segAt(wx) { for (const s of st.segs) if (wx >= s.x && wx < s.x + s.w) return s; return null; }
  function visSegs() {
    const out = [];
    for (const s of st.segs) { const x = s.x - st.cam; if (x < W + 70 && x + s.w > -70) out.push(s); }
    return out;
  }
  function tunnelAt(wx) {
    for (const s of st.segs) if (s.kind === 'tunnel') {
      const a = s.x + 50, z = s.x + s.w - 50;
      if (wx > a && wx < z) return Math.min(1, (wx - a) / 50, (z - wx) / 50);
    }
    return 0;
  }

  /* ---------- building bits ---------- */
  function glowWin(x, y, w, h) { alpha(0.3, () => R(x - 2, y - 2, w + 4, h + 4, WARM_WIN)); R(x, y, w, h, WARM_WIN); R(x + 1, y + 1, 2, 2, WARM_IN); }
  function litWins(list, seed, extra = 0) {   // night: most windows glow; extra forces them on (a tap)
    const k = Math.max(nightK(), extra); if (k < 0.02) return;
    alpha(k, () => list.forEach(([x, y, w, h], i) => { if (extra || hsh(seed + i * 3.3) < 0.7) glowWin(x, y, w, h); }));
  }
  function win(x, y, w, h) { R(x - 1, y - 1, w + 2, h + 2, '#ffffff'); R(x, y, w, h, GLASS); R(x + (w >> 1), y, 1, h, '#ffffff'); R(x + 1, y + 1, 2, 1, '#ffffff'); }
  function house(x, base, w, fl, seed, lit, flash) {
    const hg = 12 + fl * 14, top = base - hg;
    const [wall, shade] = WALLS[Math.floor(hsh(seed) * WALLS.length)], roof = ROOFS[Math.floor(hsh(seed + 1) * ROOFS.length)];
    const wins = [[x + 4, base - 11, 7, 6]];
    for (let f = 1; f < fl; f++) {
      const wy = base - 11 - f * 14;
      wins.push([x + 4, wy, 7, 6], [x + w - 11, wy, 7, 6]);
      if (w >= 42) wins.push([x + (w >> 1) - 3, wy, 7, 6]);
    }
    if (lit) { litWins(wins, seed, flash > 0 && Math.floor(flash * 6) % 2 ? 1 : 0); return; }
    R(x, top, w, hg, wall); R(x, top, 2, hg, shade);
    R(x + w - 10, top - 9, 4, 8, '#8a5a3a');
    const rows = Math.ceil((w + 6) / 4);
    for (let i = 0; i < rows; i++) R(x - 3 + i * 2, top - 1 - i, w + 6 - i * 4, 1, i ? roof : '#5a2a1a');
    for (const [wx, wy] of wins) { R(wx - 1, wy - 1, 9, 8, '#ffffff'); R(wx, wy, 7, 6, GLASS); R(wx + 3, wy, 1, 6, '#ffffff'); R(wx + 1, wy + 1, 2, 1, '#ffffff'); }
    const dx = x + w - 13;
    R(dx - 1, base - 16, 10, 16, '#ffffff'); R(dx, base - 15, 8, 15, roof); R(dx + 6, base - 8, 1, 1, '#ffd21f');
  }
  function fence(x, w, base, c = '#ffffff') {
    R(x, base - 7, w, 1, c); R(x, base - 3, w, 1, c);
    for (let px = x + 1; px < x + w - 1; px += 4) R(px, base - 9, 2, 9, c);
  }
  function fenceCat(x, w, base, seed) {
    const tri = (T * 0.12 + seed) % 2, f = tri < 1 ? tri : 2 - tri;
    drawCat(x + 8 + f * (w - 16), base - 9, tri < 1 ? 1 : -1, CATS[Math.floor(hsh(seed) * CATS.length)]);
  }
  function bench(x, seat, base, back) {
    R(x + back * 8 - 1, seat - 10, 3, 11, '#a8662f');
    R(x - 11, seat + 1, 22, 2, '#a8662f'); R(x - 11, seat + 1, 22, 1, '#c98a4a');
    R(x - 10, seat + 3, 2, base - seat - 3, '#5a5f6e'); R(x + 8, seat + 3, 2, base - seat - 3, '#5a5f6e');
  }
  function cone(x, y, c) { for (let i = 0; i < 5; i++) R(x - 2 + (i >> 1), y + i, 5 - i, 1, '#e0a55a'); circle(x, y - 1, 2, c); }
  function trafficCone(x, base) { for (let i = 0; i < 7; i++) R(x - (i >> 1), base - 7 + i, 1 + (i >> 1) * 2, 1, i === 3 || i === 4 ? '#ffffff' : '#f57a12'); R(x - 4, base, 9, 1, '#b14c06'); }
  function loaf(x, y) { R(x, y - 3, 7, 3, '#c8873a'); R(x + 1, y - 4, 5, 1, '#e0a55a'); R(x + 2, y - 3, 1, 1, '#f3d29a'); R(x + 4, y - 3, 1, 1, '#f3d29a'); }
  function teddy(x, y, r) {
    circle(x, y + r, r, '#a86b3a'); circle(x, y - r + 1, r, '#a86b3a');
    circle(x - r, y - 2 * r + 2, Math.max(1, r >> 1), '#a86b3a'); circle(x + r, y - 2 * r + 2, Math.max(1, r >> 1), '#a86b3a');
    R(x - 1, y - r + 2, 3, 2, '#e8c49a'); R(x - 2, y - r, 1, 1, INK); R(x + 2, y - r, 1, 1, INK); R(x, y - r + 2, 1, 1, INK);
  }
  function signIcon(kind, cx, cy) {
    if (kind === 'bakery') { R(cx - 6, cy - 1, 12, 5, '#c8873a'); R(cx - 5, cy - 3, 10, 2, '#d99a4a'); R(cx - 4, cy - 4, 8, 1, '#e0a55a'); for (const d of [-3, 0, 3]) R(cx + d, cy - 2, 1, 2, '#f3d29a'); }
    else if (kind === 'icecream') { cone(cx, cy, '#ff9cc8'); circle(cx, cy - 4, 2, '#8fe3c0'); }
    else teddy(cx, cy - 1, 2);
  }
  function dalmatian(x, yb, dir, hop) {
    const top = yb - 9 - hop, M = (dx, dy, w, h, c) => R(dir > 0 ? x + dx : x + 12 - dx - w, top + dy, w, h, c);
    M(0, 3, 1, 2, '#ffffff'); M(1, 4, 7, 3, '#ffffff'); M(1, 7, 1, 2, '#ffffff'); M(6, 7, 1, 2, '#ffffff');
    M(7, 1, 4, 4, '#ffffff'); M(7, 1, 1, 3, INK); M(9, 2, 1, 1, INK); M(11, 3, 1, 1, INK);
    M(2, 4, 1, 1, INK); M(5, 5, 1, 1, INK); M(3, 6, 1, 1, INK); M(7, 5, 2, 1, '#e8222b');
  }
  function cow(x, yb, dir, graze, hop) {
    const top = yb - 12 - hop, M = (dx, dy, w, h, c) => R(dir > 0 ? x + dx : x + 19 - dx - w, top + dy, w, h, c);
    M(3, 9, 2, 3, '#f4f7fb'); M(6, 9, 2, 3, '#f4f7fb'); M(11, 9, 2, 3, '#f4f7fb'); M(13, 9, 2, 3, '#f4f7fb');
    M(3, 11, 2, 1, INK); M(6, 11, 2, 1, INK); M(11, 11, 2, 1, INK); M(13, 11, 2, 1, INK);
    M(2, 3, 14, 7, '#ffffff'); M(2, 8, 14, 2, '#dfe6ee');
    M(4, 3, 4, 3, INK); M(10, 6, 3, 3, INK); M(13, 3, 2, 2, INK);
    M(8, 10, 3, 1, '#ffb3da');
    M(0, 3, 2, 1, '#ffffff'); M(0, 4, 1, 4, '#ffffff'); M(0, 8, 1, 1, INK);
    const hy = graze ? 6 : 0;
    M(15, hy, 4, 5, '#ffffff'); M(17, hy + 3, 3, 3, '#ffb3da'); M(18, hy + 4, 1, 1, '#c73d84');
    M(15, hy - 1, 1, 1, '#e9e2d0'); M(18, hy - 1, 1, 1, '#e9e2d0'); M(14, hy + 1, 1, 1, INK); M(17, hy + 1, 1, 1, INK);
  }
  function chicken(x, yb, dir, peck) {
    const top = yb - 6, M = (dx, dy, w, h, c) => R(dir > 0 ? x + dx : x + 7 - dx - w, top + dy, w, h, c);
    M(0, 2, 5, 3, '#ffffff'); M(4, peck ? 2 : 0, 3, 3, '#ffffff'); M(5, peck ? 1 : -1, 1, 1, '#e8222b');
    M(7, peck ? 4 : 2, 1, 1, '#ffb15a'); M(5, peck ? 3 : 1, 1, 1, INK); M(2, 5, 1, 1, '#ffb15a'); M(0, 1, 1, 2, '#e9eef2');
  }
  function sailboat(x, yb, dir) {
    R(x - 9, yb - 4, 18, 3, '#e8222b'); R(x - 7, yb - 1, 14, 1, '#a3121d'); R(x - 9, yb - 4, 18, 1, '#ff7a6b');
    R(x, yb - 20, 1, 16, '#5a3a22');
    for (let i = 0; i < 13; i++) { const w = 1 + Math.floor(i * 0.6); R(dir > 0 ? x + 1 : x - w, yb - 19 + i, w, 1, '#ffffff'); }
    R(x + 1, yb - 22, 3, 2, '#ffd21f');
  }
  function tugboat(x, yb, dir) {
    R(x - 11, yb - 5, 22, 4, '#2a6fe0'); R(x - 9, yb - 1, 18, 1, '#1a3f9a'); R(x - 11, yb - 5, 22, 1, '#6fb6ff');
    R(x - 11, yb - 3, 22, 1, '#ffffff');
    const cx = x - 4 * dir;
    R(cx - 4, yb - 11, 9, 6, '#ffffff'); R(cx - 3, yb - 10, 3, 3, GLASS); R(cx + 1, yb - 10, 3, 3, GLASS);
    R(cx - 1 - 3 * dir, yb - 16, 3, 5, '#e8222b'); R(cx - 1 - 3 * dir, yb - 16, 3, 1, INK);
  }
  function truckFront(x, base, on) {
    const c = COLOR[V[VI.fire].color].c, ph = Math.floor(T * 7) % 2;
    R(x, base - 26, 28, 22, c[1]); R(x, base - 26, 28, 1, c[0]);
    R(x + 3, base - 23, 22, 8, GLASS); R(x + 4, base - 22, 3, 2, '#ffffff');
    R(x + 7, base - 12, 14, 6, CHROME); for (let yy = base - 11; yy < base - 6; yy += 2) R(x + 7, yy, 14, 1, '#9aa3ad');
    circle(x + 4, base - 9, 2, '#fff6b0'); circle(x + 23, base - 9, 2, '#fff6b0');
    R(x + 1, base - 5, 26, 2, CHROME);
    R(x + 2, base - 4, 5, 4, TIRE); R(x + 21, base - 4, 5, 4, TIRE);
    R(x + 6, base - 28, 16, 2, '#444a55'); R(x + 7, base - 30, 6, 2, on && ph ? RED_ON : RED_OFF); R(x + 15, base - 30, 6, 2, on && !ph ? RED_ON : RED_OFF);
  }

  /* ---------- the pieces of town ---------- */
  const KIND = {};
  const inRect = (tx, ty, x, y, w, h) => tx >= x && tx < x + w && ty >= y && ty < y + h;
  const fx = (n, f) => { const n0 = parts.length; f(); for (let i = n0; i < parts.length; i++) parts[i].world = true; };

  KIND.houses = {
    w: 150,
    init(s) {
      s.hs = []; let dx = 2;
      for (let i = 0; i < 3; i++) { const w = 36 + (hsh(s.seed + i) * 12 | 0); s.hs.push({ dx, w, fl: 1 + (hsh(s.seed + i * 3.1) * 3 | 0), seed: s.seed + i * 11, flash: 0 }); dx += w + 12; }
      s.w = dx - 4;
      s.people.push(person(s.hs[0].dx + s.hs[0].w + 6, 1, pickBy(ADULTS, s.seed + 5), 'stand', s.seed + 5, 1));
      if (hsh(s.seed + 8) < 0.7) s.people.push(person(s.hs[2].dx + 8, 0, pickBy(KIDS, s.seed + 9), 'stand', s.seed + 9, -1));
      s.dog = hsh(s.seed + 12) < 0.5;
    },
    draw(s, x, lit) {
      const b = P.bY, maxFl = Math.max(1, Math.floor((P.maxBH - 26) / 14));
      for (const h of s.hs) house(x + h.dx, b, h.w, Math.min(h.fl, maxFl), h.seed, lit, h.flash);
      if (lit) return;
      for (const h of s.hs) fence(x + h.dx - 2, h.w + 4, b + 2);
      drawTree(x + s.hs[1].dx - 6, b, Math.max(6, P.treeR - 6));
      fenceCat(x + s.hs[2].dx - 2, s.hs[2].w + 4, b + 2, s.seed);
    },
    tap(s, x, tx, ty) {
      const maxFl = Math.max(1, Math.floor((P.maxBH - 26) / 14));
      for (const h of s.hs) {
        const hg = 12 + Math.min(h.fl, maxFl) * 14;
        if (inRect(tx, ty, x + h.dx - 3, P.bY - hg - 12, h.w + 6, hg + 12)) {
          h.flash = 1.6; (s.dog ? SFX.woof : SFX.meow)();
          fx(0, () => sparkle(x + h.dx + h.w / 2, P.bY - hg / 2, h.w / 2, 8, '#fff27a'));
          return true;
        }
      }
      return false;
    },
  };

  const SHOP = {
    bakery:   { wall: '#ffe3b0', shade: '#e8c48a', trim: '#b14c06', aw: ['#f57a12', '#fff6e0'], door: '#b14c06', who: 'chef' },
    icecream: { wall: '#ffe0ef', shade: '#f0bfd6', trim: '#c73d84', aw: ['#ff6fb4', '#ffffff'], door: '#c73d84', who: 'kid' },
    toy:      { wall: '#d4e8ff', shade: '#aecbec', trim: '#1a3f9a', aw: ['#2a6fe0', '#ffd21f'], door: '#2a6fe0', who: 'kid2' },
  };
  const shopH = s => Math.max(56, Math.round(Math.min(P.maxBH, 150) * s.hk));
  function shop(s, x, lit, kind) {
    const b = P.bY, w = 66, gH = 50, h = shopH(s), top = b - h, C = SHOP[kind];
    const upper = Math.floor((h - gH - 4) / 20), wins = [];
    for (let f = 0; f < upper; f++) { const wy = b - gH - 17 - f * 20; wins.push([x + 8, wy, 12, 11], [x + 27, wy, 12, 11], [x + w - 20, wy, 12, 11]); }
    const hop = s.react > 0 ? Math.round(Math.abs(Math.sin(s.react * 9)) * 4) : 0;
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(k, () => {
        wins.forEach(([wx, wy, ww, wh], i) => { if (hsh(s.seed + i * 2.9) < 0.7) glowWin(wx + 1, wy + 1, ww - 2, wh - 2); });
        alpha(0.35, () => R(x + 2, b - 30, 38, 28, WARM_WIN)); alpha(0.45, () => R(x + 5, b - 27, 32, 22, WARM_IN));
        R(x + 7, b - 49, w - 14, 12, '#fff6e0'); signIcon(kind, x + (w >> 1), b - 43 - hop);
      });
      return;
    }
    R(x, top, w, h, C.wall); R(x, top, 2, h, C.shade);
    R(x - 2, top - 3, w + 4, 3, C.trim); R(x - 2, top - 3, w + 4, 1, '#ffffff');
    for (const [wx, wy] of wins) {
      R(wx, wy, 12, 11, '#ffffff'); R(wx + 1, wy + 1, 10, 9, GLASS); R(wx + 6, wy + 1, 1, 9, '#ffffff'); R(wx + 2, wy + 2, 2, 2, '#ffffff');
      if (hsh(wx * 0.37 + wy + s.seed) < 0.4) { R(wx - 1, wy + 11, 14, 2, '#5aa84c'); R(wx + 1, wy + 10, 1, 1, '#ff6fb4'); R(wx + 6, wy + 10, 1, 1, '#ffd21f'); R(wx + 10, wy + 10, 1, 1, '#ff6fb4'); }
    }
    R(x + 6, b - 50, w - 12, 14, C.trim); R(x + 7, b - 49, w - 14, 12, '#fff6e0');
    signIcon(kind, x + (w >> 1), b - 43 - hop);
    for (let i = 0; i < w + 4; i += 4) { const c = C.aw[(i >> 2) % 2]; R(x - 2 + i, b - 35, 4, 6, c); R(x - 1 + i, b - 29, 2, 1, c); }
    R(x - 2, b - 35, w + 4, 1, C.trim);
    R(x + 4, b - 28, 34, 24, '#ffffff'); R(x + 5, b - 27, 32, 22, GLASS);
    R(x + 5, b - 15, 32, 1, '#c9a27a'); R(x + 5, b - 6, 32, 1, '#c9a27a');
    const gx = x + 7;
    if (kind === 'bakery') { loaf(gx, b - 15); loaf(gx + 10, b - 15); loaf(gx + 20, b - 15); R(gx + 1, b - 9, 6, 2, '#e8a84a'); R(gx + 11, b - 11, 8, 5, '#ff9cc8'); R(gx + 11, b - 11, 8, 1, '#ffffff'); R(gx + 14, b - 12, 2, 1, '#e8222b'); loaf(gx + 21, b - 6); }
    else if (kind === 'icecream') { ['#ff9cc8', '#8fe3c0', '#fff27a', '#a86b45', '#c39bff'].forEach((c, i) => { R(gx + i * 6, b - 9, 5, 3, c); R(gx + i * 6, b - 9, 5, 1, '#ffffff'); }); cone(gx + 4, b - 22, '#ff9cc8'); cone(gx + 14, b - 22, '#8fe3c0'); cone(gx + 24, b - 22, '#fff27a'); }
    else { teddy(gx + 5, b - 21 - hop, 3); circle(gx + 17, b - 18, 3, '#e8222b'); R(gx + 14, b - 18, 7, 1, '#ffffff'); R(gx + 23, b - 21, 4, 4, '#ffd21f'); R(gx + 25, b - 25, 4, 4, '#3fb43a'); R(gx + 2, b - 10, 4, 4, '#2a6fe0'); R(gx + 7, b - 10, 4, 4, '#ff6fb4'); R(gx + 15, b - 10, 10, 3, '#e8222b'); circle(gx + 17, b - 7, 1, INK); circle(gx + 23, b - 7, 1, INK); }
    R(x + 43, b - 30, 16, 30, '#ffffff'); R(x + 44, b - 29, 14, 29, C.door); R(x + 46, b - 27, 10, 11, GLASS); R(x + 55, b - 14, 1, 2, '#ffd21f');
    if (kind === 'icecream') {   // giant cone on the roof
      const cx = x + (w >> 1), ty = top - hop;
      R(cx - 1, ty - 8, 2, 6, '#7d8794');
      for (let i = 0; i < 16; i++) { const ww = Math.max(1, Math.round(13 - i * 0.75)); R(cx - (ww >> 1), ty - 24 + i, ww, 1, i % 4 === 1 ? '#c8873a' : '#e0a55a'); }
      circle(cx, ty - 27, 6, '#ff9cc8'); circle(cx - 2, ty - 29, 2, '#ffc6e0');
      circle(cx, ty - 35, 5, '#8fe3c0'); circle(cx - 1, ty - 37, 2, '#c8f5e2');
      R(cx - 1, ty - 43, 3, 3, '#e8222b'); R(cx, ty - 45, 1, 2, '#3f9a45');
    }
  }
  for (const kind of ['bakery', 'icecream', 'toy']) {
    KIND[kind] = {
      w: 66,
      init(s) {
        s.hk = 0.5 + hsh(s.seed + 1) * 0.45;
        s.people.push(person(kind === 'bakery' ? 51 : 22, 1, SHOP[kind].who, kind === 'icecream' ? 'eat' : 'stand', s.seed + 2, kind === 'bakery' ? -1 : 1));
      },
      draw(s, x, lit) { shop(s, x, lit, kind); },
      tap(s, x, tx, ty) {
        const h = shopH(s);
        if (!inRect(tx, ty, x - 2, P.bY - h - (kind === 'icecream' ? 46 : 4), 70, h + 50)) return false;
        s.react = 1;
        if (kind === 'bakery') { SFX.pop(); fx(0, () => puff(x + 22, P.bY - 34, 8, '#fff1d6')); }
        else if (kind === 'icecream') { SFX.boop(1.3); fx(0, () => sparkle(x + 33, P.bY - h - 20, 14, 10, '#ff9cc8')); }
        else { SND.squeak(); fx(0, () => sparkle(x + 14, P.bY - 24, 10, 6, '#fff27a')); }
        return true;
      },
    };
  }

  KIND.park = {
    w: 150,
    init(s) { s.sit = person(128, 1, hsh(s.seed + 4) < 0.6 ? 'gran' : 'dad', 'sit', s.seed + 4, -1); },
    draw(s, x, lit) {
      if (lit) return;
      const b = P.bY, px = x + 30, pw = 86, py = b - 10;
      drawTree(x + 10, b, P.treeR);
      R(px + 4, py - 1, pw - 8, 1, '#4f9a45');
      R(px + 2, py, pw - 4, 9, '#3f8fd0'); R(px, py + 2, pw, 6, '#3f8fd0');
      R(px + 6, py + 1, pw - 30, 1, '#6fb6ff');
      for (let i = 0; i < 4; i++) { const wx = px + 8 + ((i * 23 + T * 6) % (pw - 20)); R(wx, py + 4 + (i % 2) * 2, 5, 1, '#8cc8f0'); }
      for (const rx of [px + 1, px + 4, px + pw - 3]) { R(rx, py - 6, 1, 7, '#3f9a45'); R(rx, py - 7, 1, 2, '#8a5a3a'); }
      const f = (T * 0.05 + hsh(s.seed)) % 2, u = f < 1 ? f : 2 - f, dir = f < 1 ? 1 : -1;
      const mx = px + 30 + u * (pw - 46), hop = s.react > 0 ? Math.round(Math.abs(Math.sin(s.react * 10)) * 4) : 0;
      for (let j = 3; j >= 1; j--) drawDuck(mx - dir * (4 + j * 7), py + 6 - (j % 2 ? hop : 0), false, dir, 0);
      drawDuck(mx, py + 7 - hop, true, dir, 0);
      R(px + 2, py + 6, pw - 4, 3, '#3f8fd0'); R(px + 8, py + 6, 6, 1, '#8cc8f0'); R(px + pw - 22, py + 7, 6, 1, '#8cc8f0');
      bench(x + 128, b - 9, b, 1);
      const p = s.sit, ph = p.hop > 0 ? Math.round(Math.sin(p.hop / 0.5 * Math.PI) * 3) : 0;
      drawPerson({ type: p.type, x: x + 128, yb: b - 9, pose: p.wave > 0 ? 'wave' : Math.floor(T / 2 + s.seed) % 3 ? 'sit' : 'eat', dir: -1, skin: p.skin, hair: p.hair, seed: 2, hop: ph });
      if (p.wave > 0) { const sx = x + 128 - 6; R(sx + 1, b - 9 - 10 - ph, 1, 1, p.skin); }
      drawTree(x + 146, b, P.treeR - 2);
      for (let i = 0; i < 5; i++) { const fxp = x + 112 + i * 4 - 90 * (i % 2); R(fxp, b - 3, 1, 3, '#3f9a45'); R(fxp - 1, b - 4, 3, 1, ['#ff6fb4', '#ffd21f', '#e8222b', '#ffffff', '#8a4fd9'][i]); }
    },
    tap(s, x, tx, ty) {
      const b = P.bY;
      if (inRect(tx, ty, x + 26, b - 30, 94, 32)) { s.react = 0.8; SFX.quack(); fx(0, () => sparkle(tx, b - 14, 8, 5, '#ffffff')); return true; }
      if (inRect(tx, ty, x + 114, b - 34, 26, 36)) { s.sit.hop = 0.5; s.sit.wave = 2; SFX.boop(1.1); return true; }
      for (const [cx, r] of [[x + 10, P.treeR], [x + 146, P.treeR - 2]]) {
        if (Math.abs(tx - cx) < r + 2 && ty > b - 2 * r - 30 && ty < b) { tone('sine', 2400, 0, 0.06, 0.06, 2800); tone('sine', 2600, 0.12, 0.06, 0.06, 3000); fx(0, () => sparkle(cx, b - r - 14, r, 6, '#8fe36b')); return true; }
      }
      return false;
    },
  };

  KIND.firest = {
    w: 124,
    init(s) { s.people.push(person(68, 0, 'ff', 'stand', s.seed + 3, -1)); s.dogHop = 0; },
    geo() { const h = clamp(Math.round(P.maxBH * 0.6), 60, 120); return { h, top: P.bY - h }; },
    draw(s, x, lit) {
      const b = P.bY, bw = 98, { h, top } = this.geo(), ring = s.react > 0;
      const wins = []; for (let wy = b - 68; wy > top + 4; wy -= 18) for (const wx of [x + 10, x + 42, x + 74]) wins.push([wx, wy, 14, 10]);
      if (lit) {
        litWins(wins, s.seed);
        const k = nightK(); if (k > 0.02) alpha(k, () => alpha(0.35, () => R(x + 7, b - 31, 36, 31, WARM_WIN)));
        return;
      }
      const tx = x + bw, tt = top - 24;
      R(tx, tt, 22, b - tt, '#b5392b'); R(tx, tt, 2, b - tt, '#8e2c22'); R(tx - 2, tt - 3, 26, 3, '#f4f7fb');
      R(tx + 5, tt + 4, 12, 13, '#5a2a1a');
      const sw = ring ? Math.round(Math.sin(T * 18) * 2) : 0;
      R(tx + 10, tt + 4, 2, 3, '#3a2a1a'); circle(tx + 11 + sw, tt + 10, 4, '#ffd21f'); R(tx + 8 + sw, tt + 13, 7, 1, '#c99410'); R(tx + 10 + sw, tt + 14, 2, 2, '#c99410');
      for (let yy = tt + 24; yy < b - 12; yy += 16) { R(tx + 7, yy, 8, 8, '#ffffff'); R(tx + 8, yy + 1, 6, 6, GLASS); }
      R(x, top, bw, h, '#d0453a'); R(x, top, 2, h, '#a3362a');
      for (let yy = top + 5; yy < b; yy += 5) R(x + 2, yy, bw - 2, 1, '#bf3b30');
      R(x - 2, top - 3, bw + 4, 3, '#f4f7fb');
      for (const [wx, wy, ww, wh] of wins) win(wx, wy, ww, wh);
      R(x + 17, b - 51, 64, 15, '#f4f7fb'); text('FIRE', x + 34, b - 48, 2, '#e8222b');
      const d1 = x + 6, d2 = x + 52;
      R(d1 - 1, b - 33, 40, 33, '#f4f7fb'); R(d1, b - 32, 38, 32, '#3a3d46'); truckFront(d1 + 5, b, ring);
      R(d2 - 1, b - 33, 40, 33, '#f4f7fb'); R(d2, b - 32, 38, 32, '#d5dce3');
      for (let yy = b - 29; yy < b; yy += 4) R(d2, yy, 38, 1, '#b4bec8');
      R(d2 + 3, b - 22, 32, 5, GLASS);
      dalmatian(x + 46, b + 3, 1, s.dogHop > 0 ? Math.round(Math.sin(s.dogHop / 0.5 * Math.PI) * 4) : 0);
    },
    tap(s, x, tx, ty) {
      const { h, top } = this.geo();
      if (inRect(tx, ty, x + 40, P.bY - 12, 18, 16)) { s.dogHop = 0.5; SFX.woof(); return true; }
      if (!inRect(tx, ty, x - 2, top - 30, 126, h + 32)) return false;
      s.react = 2.4; SFX.bell();
      for (const p of s.people) { p.wave = 2.4; p.cheer = true; p.hop = 0.5; }
      fx(0, () => sparkle(x + 109, top - 14, 10, 8, '#ffd21f'));
      return true;
    },
  };

  KIND.police = {
    w: 124,
    init(s) { s.people.push(person(14, 0, 'cop', 'stand', s.seed + 3, 1)); },
    geo() { const h = clamp(Math.round(P.maxBH * 0.55), 58, 110); return { h, top: P.bY - h }; },
    draw(s, x, lit) {
      const b = P.bY, bw = 106, { h, top } = this.geo();
      const wins = []; for (let wy = b - 68; wy > top + 4; wy -= 18) for (const wx of [x + 8, x + 30, x + 62, x + 84]) wins.push([wx, wy, 14, 10]);
      wins.push([x + 8, b - 28, 14, 11], [x + 84, b - 28, 14, 11]);
      if (lit) {
        litWins(wins, s.seed);
        const k = nightK();
        if (k > 0.02) alpha(k, () => { for (const lx of [x + 36, x + 70]) { glow(lx, b - 36, '#3b8bff', 6); circle(lx, b - 36, 3, '#8fc4ff'); } });
        return;
      }
      R(x, top, bw, h, '#cfd9ec'); R(x, top, 2, h, '#a9b8d6');
      R(x - 2, top - 4, bw + 4, 4, '#1a3f9a'); R(x - 2, top - 4, bw + 4, 1, '#3b6fd0');
      circle(x + bw / 2, top - 8, 4, '#ffd21f'); R(x + bw / 2 - 1, top - 10, 2, 4, '#c99410');
      for (const [wx, wy, ww, wh] of wins) win(wx, wy, ww, wh);
      R(x + 27, b - 52, 52, 14, '#1a3f9a'); text('POLICE', x + 30, b - 50, 2, '#ffffff');
      R(x + 41, b - 33, 24, 33, '#ffffff'); R(x + 43, b - 31, 20, 31, '#1a3f9a'); R(x + 52, b - 31, 2, 31, '#0f2a6a');
      R(x + 45, b - 27, 6, 8, GLASS); R(x + 55, b - 27, 6, 8, GLASS);
      for (const lx of [x + 36, x + 70]) { R(lx, b - 33, 1, 33, '#3f434e'); circle(lx, b - 36, 3, '#3b8bff'); R(lx - 1, b - 38, 1, 1, '#ffffff'); }
      drawV(VI.police, x + 62, P.rowY[1] + 1, s.react > 0, 0, 0);
    },
    tap(s, x, tx, ty) {
      const { h, top } = this.geo();
      if (!inRect(tx, ty, x - 2, top - 14, 128, h + 18)) return false;
      s.react = 3; SND.yelp();
      for (const p of s.people) { p.wave = 2.4; p.hop = 0.5; }
      return true;
    },
  };

  KIND.hospital = {
    w: 140,
    init(s) { s.people.push(person(10, 0, 'medic', 'stand', s.seed + 3, 1)); },
    geo() { const h = clamp(Math.round(P.maxBH * 0.95), 70, 200); return { h, top: P.bY - h }; },
    draw(s, x, lit) {
      const b = P.bY, bw = 128, { h, top } = this.geo();
      const wins = []; for (let wy = b - 64; wy > top + 8; wy -= 16) for (let wx = x + 8; wx < x + bw - 12; wx += 20) wins.push([wx, wy, 12, 9]);
      const cx = x + bw / 2, cy = top - 14;
      if (lit) {
        litWins(wins, s.seed);
        const k = Math.max(nightK(), s.react > 0 ? 1 : 0);
        if (k > 0.02) alpha(k, () => { alpha(0.3, () => circle(cx, cy, 16, '#ff7a6b')); R(cx - 3, cy - 8, 6, 16, '#ff4a4a'); R(cx - 8, cy - 3, 16, 6, '#ff4a4a'); alpha(0.4, () => R(x + 14, b - 28, 26, 28, WARM_WIN)); });
        return;
      }
      R(x, top, bw, h, '#f4f7fb'); R(x, top, 3, h, '#d5dde6'); R(x + bw - 3, top, 3, h, '#d5dde6');
      R(x - 2, top - 3, bw + 4, 3, '#b4bec8');
      for (const [wx, wy, ww, wh] of wins) { R(wx - 1, wy - 1, ww + 2, wh + 2, '#9fc4e0'); R(wx, wy, ww, wh, GLASS); R(wx + 1, wy + 1, 2, 2, '#ffffff'); }
      R(cx - 1, top - 4, 2, 4, '#9aa3ad');
      R(cx - 11, cy - 10, 22, 20, '#ffffff'); R(cx - 10, cy - 11, 20, 22, '#ffffff');
      R(cx - 3, cy - 8, 6, 16, '#e8222b'); R(cx - 8, cy - 3, 16, 6, '#e8222b');
      R(x + 6, b - 48, 39, 9, '#ffffff'); text('HOSPITAL', x + 10, b - 46, 1, '#e8222b');
      R(x + 4, b - 37, 46, 4, '#e8222b'); R(x + 4, b - 33, 46, 1, '#a3121d');
      R(x + 8, b - 32, 2, 32, '#9aa3ad'); R(x + 44, b - 32, 2, 32, '#9aa3ad');
      R(x + 14, b - 28, 26, 28, '#9fc4e0'); R(x + 15, b - 27, 11, 27, GLASS); R(x + 28, b - 27, 11, 27, GLASS); R(x + 16, b - 25, 2, 6, '#ffffff');
      drawV(VI.amb, x + 66, P.rowY[1] + 1, s.react > 0, 0, 0);
    },
    tap(s, x, tx, ty) {
      const { h, top } = this.geo();
      if (!inRect(tx, ty, x - 2, top - 28, 144, h + 32)) return false;
      s.react = 3; SFX.chime();
      for (const p of s.people) { p.wave = 2.4; p.hop = 0.5; }
      fx(0, () => sparkle(x + 64, top - 14, 12, 8, '#ff7a6b'));
      return true;
    },
  };

  KIND.school = {
    w: 154,
    init(s) { for (let i = 0; i < 3; i++) s.people.push(person(110 + i * 15, 1, KIDS[i], i === 1 ? 'wave' : 'stand', s.seed + i * 3, i === 2 ? -1 : 1)); },
    geo() { const h = clamp(Math.round(P.maxBH * 0.5), 54, 84); return { h, top: P.bY - h }; },
    draw(s, x, lit) {
      const b = P.bY, bw = 98, { h, top } = this.geo();
      const wins = []; for (let wy = b - 50; wy > top + 6; wy -= 18) for (const wx of [x + 8, x + 26, x + 60, x + 78]) wins.push([wx, wy, 12, 10]);
      wins.push([x + 8, b - 24, 12, 10], [x + 78, b - 24, 12, 10]);
      if (lit) { litWins(wins, s.seed); return; }
      const gx = x + 31, gw = 36;
      for (let i = 0; i < 16; i++) R(gx + i, top - i, gw - 2 * i, 1, '#f2c14e');
      for (let i = 0; i < 17; i++) { R(gx - 1 + i, top - i, 2, 1, '#c8432f'); R(gx + gw - 1 - i, top - i, 2, 1, '#c8432f'); }
      R(gx + 16, top - 22, 4, 6, '#c8432f'); R(gx + 15, top - 23, 6, 1, '#a3362a');
      const swing = s.react > 0 ? Math.round(Math.sin(T * 16) * 1) : 0;
      R(gx + 17 + swing, top - 20, 2, 3, '#ffd21f');
      R(x, top, bw, h, '#f2c14e'); R(x, top, 2, h, '#d9a63a');
      for (let yy = top + 6; yy < b; yy += 6) for (let xx = x + 4 + (yy % 12 ? 0 : 6); xx < x + bw - 4; xx += 12) R(xx, yy, 4, 1, '#e0ad3f');
      R(x - 2, top - 2, bw + 4, 3, '#c8432f');
      circle(gx + 18, top - 6, 5, '#ffffff'); circle(gx + 18, top - 6, 4, '#fff6e0');
      R(gx + 18, top - 9, 1, 4, INK); R(gx + 18, top - 6, 3, 1, INK);
      const craft = ['#ff6fb4', '#3fb43a', '#2a6fe0', '#f57a12', '#e8222b'];
      wins.forEach(([wx, wy, ww, wh], i) => { win(wx, wy, ww, wh); R(wx + 2, wy + 6, 3, 3, craft[i % 5]); R(wx + 8, wy + 5, 2, 2, craft[(i + 2) % 5]); });
      R(x + 35, b - 46, 28, 9, '#ffffff'); text('SCHOOL', x + 38, b - 44, 1, '#2a6fe0');
      R(x + 38, b - 33, 22, 33, '#ffffff'); R(x + 40, b - 31, 8, 31, '#e8222b'); R(x + 50, b - 31, 8, 31, '#e8222b');
      R(x + 42, b - 27, 4, 6, GLASS); R(x + 52, b - 27, 4, 6, GLASS);
      R(x + 101, b - 46, 1, 46, '#9aa3ad'); const wv = Math.floor(T * 4) % 2;
      R(x + 102, b - 46, 10, 6, '#e8222b'); R(x + 102, b - 44 + wv, 10, 2, '#ffffff');
      const bx = x + 124 + Math.round(Math.sin(T * 1.3) * 8), by = b - 3 - Math.round(Math.abs(Math.sin(T * 4)) * 10);
      circle(bx, by, 2, '#e8222b'); R(bx - 1, by - 1, 1, 1, '#ffffff');
      for (let xx = x + 104; xx < x + s.w - 2; xx += 5) R(xx, b - 7, 2, 7, '#3fb43a');
      R(x + 104, b - 6, s.w - 106, 1, '#3fb43a'); R(x + 104, b - 3, s.w - 106, 1, '#3fb43a');
    },
    tap(s, x, tx, ty) {
      const { h, top } = this.geo();
      if (!inRect(tx, ty, x - 2, top - 24, 156, h + 26)) return false;
      s.react = 2; SND.schoolBell();
      for (const p of s.people) { p.wave = 2.5; p.cheer = true; p.hop = 0.5; }
      return true;
    },
  };

  function digger(x, b, t) {   // excavator facing left; x = left edge of its tracks
    const a1 = -2.25 + Math.sin(t) * 0.35, a2 = a1 + 2.0 + Math.sin(t + 1) * 0.45;
    const sx = x + 9, sy = b - 15;
    const ex = sx + Math.cos(a1) * 18, ey = sy + Math.sin(a1) * 18;
    const bx = ex + Math.cos(a2) * 14, by = ey + Math.sin(a2) * 14;
    R(x, b - 6, 32, 6, '#2f3240'); R(x + 1, b - 5, 30, 4, '#4b4f5c');
    for (let i = 0; i < 4; i++) circle(x + 4 + i * 8, b - 3, 1, '#7d8794');
    R(x + 2, b - 16, 28, 10, '#ffc21f'); R(x + 2, b - 16, 28, 1, '#fff27a'); R(x + 2, b - 8, 28, 2, '#c99410');
    R(x + 16, b - 28, 13, 12, '#ffc21f'); R(x + 18, b - 26, 9, 7, GLASS); R(x + 19, b - 25, 2, 2, '#ffffff');
    R(x + 26, b - 21, 2, 5, INK);
    line(sx, sy, ex, ey, 3, '#f5a800'); line(ex, ey, bx, by, 3, '#f5a800'); circle(ex, ey, 1, '#3a3d46');
    R(bx - 4, by - 2, 7, 5, '#5a5f6e'); R(bx - 5, by + 2, 3, 2, '#3a3d46');
  }
  KIND.build = {
    w: 164,
    init(s) { const p = person(60, 0, 'dad', 'stand', s.seed + 3, 1); p.hard = true; s.people.push(p); s.dig = 0; s.hook = 0; },
    draw(s, x, lit) {
      if (lit) return;
      const b = P.bY, ct = Math.max(P.skyTop + 4, b - Math.min(P.maxBH, 170)), tx = x + 26;
      R(tx, ct, 2, b - ct, '#ffc21f'); R(tx + 7, ct, 2, b - ct, '#ffc21f');
      for (let yy = ct + 2, i = 0; yy < b - 6; yy += 6, i++) for (let j = 0; j < 6; j++) R(tx + 2 + (i % 2 ? j : 5 - j), yy + j, 1, 1, '#e0a010');
      R(tx + 3, ct - 14, 3, 14, '#ffc21f');
      line(tx + 4, ct - 14, x + 132, ct - 5, 1, '#7d8794'); line(tx + 4, ct - 14, x - 4, ct - 5, 1, '#7d8794');
      R(x - 6, ct - 6, 140, 2, '#ffc21f'); R(x - 6, ct, 140, 2, '#ffc21f');
      for (let xx = x - 6, i = 0; xx < x + 130; xx += 6, i++) for (let j = 0; j < 4; j++) R(xx + (i % 2 ? j : 3 - j) + 1, ct - 4 + j, 1, 1, '#e0a010');
      R(x - 6, ct + 2, 14, 9, '#7d8794'); R(x - 6, ct + 2, 14, 1, '#9aa3ad');
      R(tx - 4, ct + 2, 13, 9, '#ffc21f'); R(tx - 2, ct + 4, 6, 5, GLASS);
      const trol = x + 76 + Math.round(Math.sin(T * 0.5 + s.seed) * 26);
      const cl = Math.round((b - ct) * 0.4 + Math.sin(T * 0.7) * 6 - (s.hook > 0 ? Math.sin(s.hook * 8) * 6 : 0));
      R(trol - 3, ct + 2, 7, 3, '#5a5f6e'); R(trol, ct + 5, 1, cl, '#3a3d46');
      R(trol - 1, ct + 5 + cl, 3, 2, INK); R(trol - 14, ct + 7 + cl, 28, 3, '#e8622b'); R(trol - 14, ct + 7 + cl, 28, 1, '#ff9a5a');
      const floors = clamp(Math.floor(P.maxBH * 0.7 / 18), 1, 4);
      for (const cx of [x + 80, x + 100, x + 120, x + 140]) R(cx, b - floors * 18, 3, floors * 18, '#7d8794');
      for (let f = 1; f <= floors; f++) R(x + 80, b - f * 18, 63, 3, '#e8622b');
      circle(x + 66, b + 2, 11, '#a86b3a'); circle(x + 63, b - 1, 6, '#c8873a');
      digger(x + 102, b, T * 1.2 + s.dig);
      for (let xx = x; xx < x + s.w; xx += 12) { R(xx, b - 7, 2, 7, '#5a5f6e'); R(xx, b - 6, 12, 3, Math.floor((xx - x) / 12) % 2 ? '#ffffff' : '#e8222b'); }
      trafficCone(x + 10, P.rowY[0]); trafficCone(x + 150, P.rowY[0]);
    },
    tap(s, x, tx, ty) {
      const b = P.bY, ct = Math.max(P.skyTop + 4, b - Math.min(P.maxBH, 170));
      if (inRect(tx, ty, x + 70, b - 50, 80, 52)) { s.react = 1.5; SND.clank(); fx(0, () => puff(x + 96, b - 6, 8, '#c8873a')); return true; }
      if (inRect(tx, ty, x - 8, ct - 16, 150, b - ct + 16)) { s.hook = 1; SND.clank(); return true; }
      return false;
    },
  };

  KIND.gas = {
    w: 134,
    init(s) { s.car = pickOne(['red', 'yellow', 'green', 'purple', 'orange']); s.people.push(person(116, 0, pickBy(ADULTS, s.seed + 2), 'stand', s.seed + 2, -1)); },
    draw(s, x, lit) {
      const b = P.bY, ct = b - 46, sx = x + 96;
      if (lit) {
        const k = nightK(); if (k < 0.02) return;
        alpha(k, () => { R(x + 6, ct + 12, 82, 2, '#fff6d0'); alpha(0.16, () => R(x + 4, ct + 14, 86, b - ct - 14, '#fff6d0')); glowWin(sx + 5, b - 26, 14, 12); });
        return;
      }
      R(sx, b - 36, 36, 36, '#f4f7fb'); R(sx, b - 36, 2, 36, '#d5dde6');
      for (let i = 0; i < 40; i += 4) R(sx - 2 + i, b - 40, 4, 5, (i >> 2) % 2 ? '#ffffff' : '#3fb43a');
      R(sx + 4, b - 27, 16, 14, '#ffffff'); R(sx + 5, b - 26, 14, 12, GLASS); R(sx + 7, b - 24, 2, 3, '#ffffff');
      R(sx + 23, b - 26, 10, 26, '#3fb43a'); R(sx + 25, b - 24, 6, 8, GLASS);
      R(x + 10, ct + 12, 4, b - ct - 12, '#d5dde6'); R(x + 80, ct + 12, 4, b - ct - 12, '#d5dde6');
      R(x + 2, ct, 90, 12, '#e8222b'); R(x + 2, ct, 90, 2, '#ff7a6b'); R(x + 2, ct + 10, 90, 2, '#a3121d');
      text('GAS', x + 36, ct + 1, 2, '#ffffff');
      for (const px of [x + 20, x + 66]) {
        R(px - 1, b - 22, 12, 2, '#a3121d'); R(px, b - 20, 10, 20, '#e8222b'); R(px + 1, b - 18, 8, 6, '#ffffff');
        R(px + 2, b - 17, 6, 3, '#2f3240'); R(px + 3, b - 16, 3, 1, '#8fe36b'); R(px + 10, b - 14, 2, 1, INK); R(px + 11, b - 14, 1, 9, INK);
      }
      const hop = s.react > 0 ? Math.round(Math.abs(Math.sin(s.react * 10)) * 3) : 0;
      drawCar(x + 32, P.rowY[1] + 1 - hop, COLOR[s.car].c, 0);
    },
    tap(s, x, tx, ty) {
      if (!inRect(tx, ty, x, P.bY - 48, 134, 52)) return false;
      s.react = 1; SND.ding(); fx(0, () => sparkle(x + 48, P.bY - 20, 20, 8, '#fff27a'));
      return true;
    },
  };

  KIND.wash = {
    w: 114,
    init(s) { s.car = pickOne(['blue', 'pink', 'yellow', 'green', 'orange']); },
    draw(s, x, lit) {
      const b = P.bY, bw = 106, h = Math.min(P.maxBH, 58), top = b - h, ox = x + 19, ow = 68, oh = Math.min(36, h - 10);
      if (lit) { const k = nightK(); if (k > 0.02) alpha(k, () => alpha(0.25, () => R(ox, b - oh, ow, oh, '#bfe6ff'))); return; }
      R(x, top, bw, h, '#8fd0ff'); R(x, top, 2, h, '#5aaee8'); R(x - 2, top - 3, bw + 4, 3, '#2a6fe0');
      for (let xx = x; xx < x + bw; xx += 2) R(xx, top + 6 + Math.round(Math.sin(xx * 0.4) * 1.5), 2, 2, '#ffffff');
      const cx = x + bw / 2;
      R(cx - 17, top - 19, 34, 16, '#ffffff'); R(cx - 16, top - 18, 32, 14, '#2a6fe0');
      circle(cx - 8, top - 11, 4, '#bfe6ff'); circle(cx + 2, top - 13, 3, '#ffffff'); circle(cx + 9, top - 9, 2, '#bfe6ff'); circle(cx - 9, top - 13, 1, '#ffffff');
      R(ox - 2, b - oh - 2, ow + 4, oh + 2, '#2a6fe0'); R(ox, b - oh, ow, oh, '#3a4a66');
      drawCar(ox + 17, b, COLOR[s.car].c, 0);
      const fast = s.react > 0 ? 3 : 1;
      for (const bx of [ox + 3, ox + ow - 13]) {
        for (let yy = 0; yy < oh - 2; yy += 3) R(bx + (yy % 6 ? 0 : 1), b - oh + 1 + yy, 10, 2, (Math.floor(yy / 3 + T * 10 * fast)) % 2 ? '#ff6fb4' : '#6fb6ff');
        R(bx + 4, b - oh, 2, oh, '#d5dce3');
      }
      for (let i = 0; i < 6; i++) R(ox + 6 + i * 11, b - oh + ((T * 30 + i * 9) % (oh - 4)), 1, 2, '#bfe6ff');
    },
    tap(s, x, tx, ty) {
      const h = Math.min(P.maxBH, 58);
      if (!inRect(tx, ty, x - 2, P.bY - h - 20, 110, h + 22)) return false;
      s.react = 1.5; SFX.whoosh(); SND.bubbles();
      for (let i = 0; i < 16; i++) bubble(x + 19 + rand(0, 68), P.bY - rand(4, 34));
      return true;
    },
  };
  function bubble(x, y) {
    parts.push({ x, y, vx: rand(-8, 8), vy: rand(-22, -8), g: 0, life: 1.6, max: 1.6, s: 2, c: pickOne(['#ffffff', '#bfe6ff', '#ffb3da']), world: true });
  }

  KIND.bridge = {
    w: 330,
    init(s) { s.boats = [{ k: 0, off: hsh(s.seed) * 2, toot: 0 }, { k: 1, off: hsh(s.seed + 1) * 2, toot: 0 }]; },
    geo(s, x) { return { wl: x + 14, wr: x + s.w - 14, wy: P.hz + 2, tt: Math.max(P.skyTop - 6, P.roadTop - (P.pr ? 190 : 110)), t1: x + 64, t2: x + s.w - 72 }; },
    boatPos(s, bt, g0) {
      const span = g0.wr - g0.wl - 50, f = (T * 0.03 + bt.off) % 2, u = f < 1 ? f : 2 - f;
      return { x: g0.wl + 25 + u * span, y: P.bY - (bt.k ? 3 : 1) - (P.pr ? (bt.k ? 14 : 0) : 0), dir: f < 1 ? 1 : -1 };
    },
    draw(s, x, lit) {
      const g0 = this.geo(s, x), b = P.bY;
      if (lit) {
        const k = nightK(); if (k < 0.02) return;
        const on = Math.floor(T * 1.5) % 2;
        alpha(k, () => { for (const tx of [g0.t1, g0.t2]) { if (on) glow(tx + 3, g0.tt - 4, '#ff3b3b', 4); R(tx + 2, g0.tt - 5, 3, 2, on ? '#ff4a3a' : '#8c2a2a'); } });
        return;
      }
      R(g0.wl, g0.wy, g0.wr - g0.wl, b - g0.wy, '#3f8fd0');
      R(g0.wl, g0.wy, g0.wr - g0.wl, 2, '#6fb6ff');
      for (let i = 0; i < 10; i++) { const xx = g0.wl + 4 + ((i * 47 + T * 8 + hsh(i) * 40) % (g0.wr - g0.wl - 14)); R(xx, g0.wy + 4 + ((i * 7) % Math.max(4, b - g0.wy - 6)), 6, 1, '#8cc8f0'); }
      R(g0.wl - 8, g0.wy - 2, 10, b - g0.wy + 2, '#b4a58a'); R(g0.wr - 2, g0.wy - 2, 10, b - g0.wy + 2, '#b4a58a');
      for (const bt of s.boats) { const p = this.boatPos(s, bt, g0); bt.k ? tugboat(p.x, p.y, p.dir) : sailboat(p.x, p.y, p.dir); }
      // towers, main cable, hangers
      const top = g0.tt + 2, deck = b - 6, sag = (deck - 8 - top) * 0.8, mid = (g0.t1 + g0.t2) / 2 + 3, half = (g0.t2 - g0.t1) / 2;
      const cab = xx => {
        if (xx < g0.t1 + 3) { const u = (g0.t1 + 3 - xx) / (g0.t1 + 3 - x); return top + (deck - top) * Math.pow(u, 1.4); }
        if (xx > g0.t2 + 3) { const u = (xx - g0.t2 - 3) / (x + s.w - g0.t2 - 3); return top + (deck - top) * Math.pow(u, 1.4); }
        const u = (xx - mid) / half; return top + sag * (1 - u * u);
      };
      for (let xx = x; xx < x + s.w; xx += 8) R(xx, cab(xx), 1, deck - cab(xx), '#b5392b');
      for (const tx of [g0.t1, g0.t2]) {
        R(tx, g0.tt, 7, P.roadTop - g0.tt, '#d0453a'); R(tx, g0.tt, 2, P.roadTop - g0.tt, '#a3362a');
        R(tx - 1, g0.tt - 3, 9, 3, '#a3362a');
        for (let yy = g0.tt + 10; yy < b - 16; yy += 28) R(tx - 2, yy, 11, 3, '#a3362a');
      }
      for (let xx = x; xx < x + s.w; xx += 1) R(xx, cab(xx), 1, 2, '#d0453a');
      R(x, deck, s.w, 2, '#d0453a'); R(x, b - 1, s.w, 1, '#a3362a');
      for (let xx = x; xx < x + s.w; xx += 6) R(xx, deck, 1, 6, '#a3362a');
    },
    verge(s, x) {
      const g0 = this.geo(s, x);
      R(g0.wl, P.roadBot, g0.wr - g0.wl, P.vergeH, '#3f8fd0');
      R(x, P.roadBot, s.w, Math.min(3, P.vergeH), '#a3362a');
      for (const tx of [g0.t1, g0.t2]) R(tx - 3, P.roadBot, 13, P.vergeH, '#9aa3ad');
      if (P.vergeH > 6) for (let i = 0; i < 6; i++) R(g0.wl + 6 + ((i * 53 + T * 8) % (g0.wr - g0.wl - 12)), P.roadBot + 6 + (i % 3) * 2, 5, 1, '#8cc8f0');
    },
    tap(s, x, tx, ty) {
      const g0 = this.geo(s, x);
      for (const bt of s.boats) {
        const p = this.boatPos(s, bt, g0);
        if (Math.abs(tx - p.x) < 14 && ty > p.y - 24 && ty < p.y + 4) { SND.toot(); fx(0, () => puff(p.x - 4 * p.dir, p.y - 18, 6)); return true; }
      }
      if (inRect(tx, ty, g0.wl, g0.wy, g0.wr - g0.wl, P.bY - g0.wy)) { tone('sine', 300, 0, 0.15, 0.12, 700); fx(0, () => sparkle(tx, ty, 6, 6, '#bfe6ff')); return true; }
      return false;
    },
  };

  KIND.tunnel = {
    w: 560,
    draw(s, x, lit) {
      const a = x + 50, z = x + s.w - 50, c0 = P.ceil;
      if (lit) {
        for (let lx = a + 22; lx < z - 10; lx += 44) {
          if (lx < -20 || lx > W + 20) continue;
          alpha(0.12, () => { for (let i = 0; i < 40; i += 2) R(lx + 4 - (3 + i * 0.5), c0 + 2 + i, 6 + i, 2, '#ffe9a8'); });
          R(lx, c0, 8, 2, '#ffe9a8'); glow(lx + 4, c0 + 1, '#ffe9a8', 4);
        }
        return;
      }
      const top = Math.max(P.skyTop - 6, c0 - (P.pr ? 80 : 46));
      for (let c = 0; c < s.w; c += 4) {
        const xx = x + c; if (xx < -4 || xx > W) continue;
        const u = (c + 2) / s.w, yt = Math.round(lerp(P.bY + 4, top, Math.pow(Math.sin(u * Math.PI), 0.45)));
        const bottom = xx >= a && xx < z ? c0 - 4 : P.roadTop;
        if (bottom <= yt) continue;
        R(xx, yt, 4, bottom - yt, '#9a8462'); R(xx, yt, 4, 3, '#5bb85a'); R(xx, yt + 3, 4, 1, '#3f9a45');
        const sd = s.seed + c * 0.37;
        if (hsh(sd) < 0.45) R(xx + 1, yt + 6 + Math.floor(hsh(sd + 1) * Math.max(1, bottom - yt - 8)), 2, 2, '#7a6a4a');
        if (hsh(sd + 2) < 0.25) R(xx, yt + 10 + Math.floor(hsh(sd + 3) * Math.max(1, bottom - yt - 12)), 3, 1, '#b4a07a');
        for (let yy = yt + 14 + (c % 8 ? 0 : 2); yy < bottom - 4; yy += 16) R(xx, yy, 4, 2, '#8a7656');
      }
      for (const f of [0.22, 0.38, 0.62, 0.8]) {   // trees on the mountain
        const tx = x + Math.round(s.w * f); if (tx < -20 || tx > W + 20) continue;
        const yt = Math.round(lerp(P.bY + 4, top, Math.pow(Math.sin(f * Math.PI), 0.45)));
        drawTree(tx, yt + 2, P.treeR - 4 + (f > 0.5 ? 2 : 0));
      }
      const ia = Math.max(a, -4), iz = Math.min(z, W + 4);
      if (iz > ia) {
        R(ia, c0, iz - ia, P.roadTop - c0, '#4a4e5c');
        for (let yy = c0 + 8; yy < P.bY; yy += 8) R(ia, yy, iz - ia, 1, '#555a68');
        R(ia, c0 + 22, iz - ia, 2, '#c9a227');
        R(ia, c0 - 4, iz - ia, 4, '#6b7080');
        R(ia, P.bY, iz - ia, P.roadTop - P.bY, '#5a5f6e'); R(ia, P.bY, iz - ia, 1, '#7d8794');
      }
    },
    front(s, x) {
      const a = x + 50, z = x + s.w - 50, c0 = P.ceil, bot = P.roadBot + P.vergeH;
      const ia = Math.max(a, -4), iz = Math.min(z, W + 4);
      if (iz > ia) alpha(0.5, () => R(ia, c0, iz - ia, bot - c0, '#0a0c1a'));
      for (const px of [a - 6, z - 2]) {
        if (px < -10 || px > W + 2) continue;
        R(px, c0 - 12, 8, bot - c0 + 12, '#b4bec8'); R(px, c0 - 12, 8, 2, '#dfe6ee'); R(px + 6, c0 - 10, 2, bot - c0 + 10, '#8b96a1');
        for (let yy = bot - 12; yy < bot; yy += 4) R(px, yy, 8, 2, '#ffd21f');
      }
      for (const px of [a - 14, z - 6]) if (px > -24 && px < W + 4) { R(px, c0 - 16, 24, 6, '#b4bec8'); R(px, c0 - 16, 24, 1, '#dfe6ee'); }
    },
    verge(s, x) { R(x + 50, P.roadBot, s.w - 100, P.vergeH, '#2a2d38'); },
    tap(s, x, tx, ty) {
      if (!inRect(tx, ty, x, P.skyTop - 10, s.w, P.roadTop - P.skyTop + 10)) return false;
      tone('sine', 220, 0, 0.3, 0.1, 160); tone('sine', 220, 0.35, 0.3, 0.05, 160); tone('sine', 220, 0.7, 0.3, 0.025, 160);
      fx(0, () => sparkle(tx, ty, 8, 5, '#ffe9a8'));
      return true;
    },
  };

  const TRAIN = [{ len: 34, loco: true }, { len: 26, c: ['#ffd21f', '#c99410'] }, { len: 26, c: ['#3fb43a', '#1f7a2a'] }, { len: 26, c: ['#2a6fe0', '#1a3f9a'] }, { len: 26, c: ['#f57a12', '#b14c06'] }, { len: 26, c: ['#8a4fd9', '#55289a'] }];
  const TRAIN_LEN = TRAIN.reduce((a, p) => a + p.len + 2, 0);
  function crossbuck(px, base) {
    R(px, base - 50, 2, 50, '#d5dce3'); R(px - 1, base - 2, 4, 2, '#7d8794');
    for (let i = 0; i < 13; i++) { R(px - 6 + i, base - 56 + i, 3, 2, '#e8222b'); R(px + 6 - i, base - 56 + i, 3, 2, '#e8222b'); }
    for (let i = 1; i < 12; i++) { R(px - 5 + i, base - 55 + i, 1, 1, '#ffffff'); R(px + 7 - i, base - 55 + i, 1, 1, '#ffffff'); }
    R(px - 7, base - 38, 16, 7, INK); circle(px - 3, base - 35, 2, '#5a1f1f'); circle(px + 5, base - 35, 2, '#5a1f1f');
  }
  KIND.rail = {
    w: 156,
    init(s) { st.rails.push(s.rail = { x: s.x + 74, stopX: s.x + 74 - 38, state: 'idle', arm: 0, t: 0, ty: 0, bell: 0, chug: 0, puffT: 0 }); },
    draw(s, x, lit) {
      const cx = x + 74, b = P.bY;
      if (lit) return;
      circle(cx, P.hz + 14, 48, '#7ccd66'); circle(cx - 30, P.hz + 16, 30, '#8fd877');
      circle(cx, P.hz + 4, 28, '#9aa3ad'); circle(cx, P.hz + 4, 25, '#1d1a2b');
      for (let i = -3; i <= 3; i++) R(cx + i * 7 - 2, P.hz + 4 - Math.round(Math.sqrt(Math.max(0, 27 * 27 - (i * 7) ** 2))), 3, 2, '#7d8794');
      R(cx - 22, P.hz, 44, P.roadTop - P.hz, '#a39a86');
      for (let yy = P.hz + 2; yy < P.roadTop; yy += 5) R(cx - 18, yy, 36, 2, '#7a5a3a');
      for (const rx of [cx - 13, cx + 10]) { R(rx, P.hz - 2, 3, P.roadTop - P.hz + 2, '#8b96a1'); R(rx, P.hz - 2, 1, P.roadTop - P.hz + 2, '#dfe6ee'); }
      const hx = x + 118;
      R(hx, b - 26, 28, 26, '#c8873a'); R(hx, b - 26, 2, 26, '#a86b3a');
      for (let i = 0; i < 8; i++) R(hx - 3 + i, b - 27 - i, 34 - 2 * i, 1, '#8a3a1a');
      R(hx + 5, b - 20, 9, 8, '#ffffff'); R(hx + 6, b - 19, 7, 6, GLASS); R(hx + 18, b - 18, 7, 18, '#5a3a22');
      drawTree(x + 8, b, P.treeR - 2);
      crossbuck(cx - 30, P.roadTop - 1);
    },
    road(s, x) {
      const cx = x + 74, y = P.roadTop;
      R(cx - 22, y + 3, 44, 57, '#5f5a50');
      for (const rx of [cx - 13, cx + 10]) { R(rx, y + 3, 3, 57, '#8b96a1'); R(rx, y + 3, 1, 57, '#dfe6ee'); }
      R(Math.floor(s.rail.stopX - st.cam), y + 4, 2, 54, '#f4f7fb');
    },
    verge(s, x) {
      const cx = x + 74;
      R(cx - 22, P.roadBot, 44, P.vergeH, '#a39a86');
      for (const rx of [cx - 13, cx + 10]) R(rx, P.roadBot, 3, P.vergeH, '#8b96a1');
    },
    front(s, x) {
      const r = s.rail, px = Math.floor(r.stopX - st.cam) + 4, base = P.roadBot + P.vergeH - 1;
      R(px, base - 40, 3, 40, '#d5dce3'); R(px - 1, base - 2, 5, 2, '#5a5f6e');
      R(px - 6, base - 30, 15, 6, INK); circle(px - 2, base - 27, 2, '#5a1f1f'); circle(px + 5, base - 27, 2, '#5a1f1f');
      const ang = -Math.PI / 2 - r.arm * Math.PI / 2, ox = px + 1, oy = base - 36;
      R(ox - 3 - Math.round(Math.cos(ang) * 5), oy - 2 - Math.round(Math.sin(ang) * 5), 5, 5, '#5a5f6e');
      for (let i = 0; i < 58; i++) R(ox + Math.cos(ang) * i - 1, oy + Math.sin(ang) * i - 1, 3, 3, Math.floor(i / 7) % 2 ? '#e8222b' : '#ffffff');
      circle(ox, oy, 2, '#3a3d46');
    },
    lit(s, x) {
      const r = s.rail; if (r.state === 'idle' || r.state === 'done') return;
      const ph = Math.floor(T * 3) % 2, k = nightK();
      const lamp = (lx, ly) => { circle(lx, ly, 2, '#ff3b3b'); alpha(0.3 + 0.3 * k, () => circle(lx, ly, 5, '#ff3b3b')); };
      const cx = x + 74 - 30, base = P.roadTop - 1;
      lamp(ph ? cx - 3 : cx + 5, base - 35);
      const px = Math.floor(r.stopX - st.cam) + 4, pb = P.roadBot + P.vergeH - 1;
      lamp(ph ? px - 2 : px + 5, pb - 27);
    },
    tap(s, x, tx, ty) {
      const r = s.rail, cx = x + 74;
      if (r.state === 'train' && Math.abs(tx - cx) < 28) { SND.whistle(); return true; }
      if (inRect(tx, ty, x + 114, P.bY - 36, 36, 38)) { SFX.beep(); return true; }
      if (Math.abs(tx - (cx - 30)) < 10 && ty > P.roadTop - 60 && ty < P.roadTop) { SND.bell(); return true; }
      return false;
    },
  };

  KIND.farm = {
    w: 344,
    init(s) {
      s.cows = [0, 1, 2].map(i => ({ dx: 182 + i * 50, dir: i === 1 ? -1 : 1, hop: 0, seed: s.seed + i * 7 }));
      s.hens = 0;
      const p = person(150, 0, 'dad', 'stand', s.seed + 7, 1); p.straw = true; s.people.push(p);
    },
    geo() { const bh = clamp(Math.round(P.maxBH * 0.5), 42, 76); return { bh }; },
    draw(s, x, lit) {
      const b = P.bY, { bh } = this.geo(), bx = x + 46, bw = 62, wallH = Math.round(bh * 0.62), roofB = b - wallH;
      if (lit) { const k = nightK(); if (k > 0.02) alpha(k, () => glowWin(bx + 26, roofB - 12, 10, 8)); return; }
      R(x, P.hz, s.w, b - P.hz, '#8fd06a'); for (let yy = P.hz + 3; yy < b; yy += 4) R(x, yy, s.w, 1, '#7cbf55');
      drawTree(x + 8, b, P.treeR); drawTree(x + s.w - 8, b, P.treeR - 1);
      const roofH = bh - wallH;
      for (let i = 0; i < roofH; i++) { const k = i / roofH, inset = k < 0.5 ? k * 2 * 5 : 5 + (k - 0.5) * 2 * 22; R(bx - 3 + inset, roofB - i, bw + 6 - 2 * inset, 1, i % 3 ? '#8a2a20' : '#6a1f18'); }
      R(bx, roofB, bw, wallH, '#c8432f'); R(bx, roofB, 2, wallH, '#a3362a');
      for (let xx = bx + 4; xx < bx + bw; xx += 5) R(xx, roofB, 1, wallH, '#b5392b');
      R(bx + 25, roofB - 13, 12, 10, '#ffffff'); R(bx + 26, roofB - 12, 10, 8, '#5a2a1a');
      const dw = 26, dh = Math.min(wallH - 2, 28), dx = bx + 18;
      R(dx - 1, b - dh - 1, dw + 2, dh + 1, '#ffffff'); R(dx, b - dh, dw, dh, '#a3362a');
      line(dx, b - dh, dx + dw - 1, b - 1, 1, '#ffffff'); line(dx + dw - 1, b - dh, dx, b - 1, 1, '#ffffff'); R(dx + 12, b - dh, 2, dh, '#ffffff');
      const sx = x + 122, sh = bh + 18;
      circle(sx + 9, b - sh, 9, '#9aa3ad'); circle(sx + 7, b - sh - 3, 3, '#cfd6dd');
      R(sx, b - sh, 18, sh, '#d5dce3'); R(sx, b - sh, 3, sh, '#b4bec8');
      for (let yy = b - sh + 8; yy < b; yy += 10) R(sx, yy, 18, 1, '#9aa3ad');
      for (let i = 0; i < 3; i++) { const hx = x + 300 + i * 13; R(hx, b - 9, 12, 9, '#e8c04a'); R(hx, b - 9, 12, 1, '#f5da7a'); R(hx + 3, b - 8, 1, 8, '#c99a2a'); R(hx + 8, b - 8, 1, 8, '#c99a2a'); }
      for (let j = 0; j < 3; j++) {
        const t0 = T * 0.7 + j * 1.7 + s.seed, peck = s.hens > 0 ? Math.floor(T * 10 + j) % 2 : Math.floor(t0 * 2) % 3 === 0;
        chicken(x + 18 + j * 9 + Math.round(Math.sin(t0) * 3), b - 1, Math.cos(t0) > 0 ? 1 : -1, peck);
      }
      for (const c of s.cows) {
        const graze = Math.floor(T / 2.5 + c.seed) % 3 !== 0, hop = c.hop > 0 ? Math.round(Math.sin(c.hop / 0.6 * Math.PI) * 5) : 0;
        cow(x + c.dx + Math.round(Math.sin(T * 0.2 + c.seed) * 6), b - 1, c.dir, graze && hop === 0, hop);
      }
      for (let xx = 0; xx < s.w; xx += 10) R(x + xx, b - 9, 2, 9, '#8a5a3a');
      R(x, b - 7, s.w, 1, '#a8703a'); R(x, b - 3, s.w, 1, '#a8703a');
    },
    tap(s, x, tx, ty) {
      const b = P.bY, { bh } = this.geo();
      for (const c of s.cows) {
        const cx = x + c.dx + Math.round(Math.sin(T * 0.2 + c.seed) * 6);
        if (inRect(tx, ty, cx - 3, b - 20, 26, 22)) { c.hop = 0.6; SND.moo(); fx(0, () => sparkle(cx + 10, b - 18, 10, 6, '#ffb3da')); return true; }
      }
      if (inRect(tx, ty, x + 10, b - 16, 36, 18)) { s.hens = 1; SND.cluck(); return true; }
      if (inRect(tx, ty, x + 40, b - bh - 4, 104, bh + 6)) { SND.rooster(); fx(0, () => sparkle(x + 77, b - bh, 12, 6)); return true; }
      return false;
    },
  };

  /* ---------- people ---------- */
  function drawP(p, sx, yb) {
    const hop = p.hop > 0 ? Math.round(Math.sin(p.hop / 0.5 * Math.PI) * 5) : 0;
    const pose = p.wave > 0 ? (p.cheer ? 'cheer' : 'wave') : p.pose;
    drawPerson({ type: p.type, x: sx, yb, dir: p.dir, pose, walk: p.walk && p.wave <= 0, skin: p.skin, hair: p.hair, seed: p.seed, hop });
    const hx = Math.floor(sx) - 6, ty = Math.floor(yb - hop) - 22;
    if (p.hard) { R(hx + 2, ty - 1, 8, 3, '#ffc21f'); R(hx + 1, ty + 2, 10, 1, '#ffc21f'); R(hx + 4, ty - 1, 2, 1, '#fff27a'); }
    if (p.straw) { R(hx + 3, ty - 2, 7, 3, '#e8c04a'); R(hx, ty + 1, 13, 1, '#e8c04a'); R(hx + 3, ty, 7, 1, '#e8222b'); }
  }
  function drawPeople(vis) {
    for (const row of [1, 0]) {
      for (const s of vis) for (const p of s.people) if (p.row === row) drawP(p, s.x + p.dx - st.cam, P.rowY[row]);
      for (const p of st.peds) if (p.row === row) { const sx = p.x - st.cam; if (sx > -20 && sx < W + 20) drawP(p, sx, P.rowY[row]); }
    }
  }
  function tick(p, dt) { p.hop = Math.max(0, p.hop - dt); if (p.wave > 0) { p.wave -= dt; if (p.wave <= 0) p.cheer = false; } }
  const NO_PEDS = new Set(['tunnel', 'farm']);
  function updatePeople(dt) {
    const front = frontW();
    const greet = (p, wx) => {
      if (p.greeted || st.phase !== 'drive' || wx < front - 6 || wx > front + 70) return;
      p.greeted = true;
      if (st.siren || Math.random() < 0.45) { p.wave = 2.4; if (st.siren) { p.cheer = true; p.hop = 0.5; } }
    };
    for (const s of st.segs) {
      for (const p of s.people) { tick(p, dt); greet(p, s.x + p.dx); }
      if (s.sit) tick(s.sit, dt);
      s.react = Math.max(0, s.react - dt);
      if (s.hs) for (const h of s.hs) h.flash = Math.max(0, h.flash - dt);
      if (s.cows) { for (const c of s.cows) c.hop = Math.max(0, c.hop - dt); s.hens = Math.max(0, s.hens - dt); }
      if (s.dogHop) s.dogHop = Math.max(0, s.dogHop - dt);
      if (s.hook) s.hook = Math.max(0, s.hook - dt);
      if (s.kind === 'build') s.dig += dt * (s.react > 0 ? 4 : 0);
      if (s.kind === 'wash') { const sx = s.x - st.cam; if (sx > -110 && sx < W && Math.random() < dt * 3) bubble(sx + 19 + rand(0, 68), P.bY - rand(6, 30)); }
    }
    for (const p of st.peds) {
      tick(p, dt);
      if (p.wave <= 0) {
        const s = segAt(p.x + p.vx * 0.6);
        if (s && NO_PEDS.has(s.kind)) { p.vx = -p.vx; p.dir = -p.dir; }
        p.x += p.vx * dt;
      }
      greet(p, p.x);
    }
    st.pedT -= dt;
    const want = Math.max(2, Math.round(W / 120));
    if (st.peds.length < want && st.pedT <= 0) {
      st.pedT = rand(0.4, 1.4);
      const x = st.cam + W + rand(10, 60), s = segAt(x);
      if (!s || !NO_PEDS.has(s.kind)) st.peds.push(newPed(x));
    }
    st.peds = st.peds.filter(p => p.x > st.cam - 40 && p.x < st.cam + W + 220);
  }
  function newPed(x) {
    const dir = Math.random() < 0.5 ? 1 : -1, seed = Math.random() * 99;
    const p = person(0, Math.random() < 0.5 ? 0 : 1, pickOne([...ADULTS, ...KIDS, 'chef']), 'stand', seed, dir);
    p.x = x; p.vx = dir * rand(9, 15); p.walk = true;
    return p;
  }

  /* ---------- traffic ---------- */
  function stopFor(front, lanes, self) {   // distance to the nearest thing to stop behind
    let m = Infinity;
    for (const c of st.cars) {
      if (c === self || c.pull >= 0.5 || !lanes.includes(c.lane) || c.x < front - 12) continue;
      m = Math.min(m, c.x - front - 10);
    }
    if (self && st.phase !== 'pick' && playerLanes().some(l => lanes.includes(l))) {
      const r = rearW(); if (r >= front - 12) m = Math.min(m, r - front - 10);
    }
    for (const l of st.lights) {
      if (l.state === 'green') continue;
      if (!self && st.siren && !crossing(l)) continue;
      const d = l.stopX - front; if (d < -2 || (l.state === 'yellow' && d < 26)) continue;
      m = Math.min(m, d - 2);
    }
    for (const r of st.rails) {
      if (r.state === 'idle' || r.state === 'done' || (r.state === 'opening' && r.arm < 0.4)) continue;
      const d = r.stopX - front; if (d < -2) continue;
      m = Math.min(m, d - 2);
    }
    return m;
  }
  const crossing = l => l.crossers.some(p => p.y < P.rS + 34);
  function addCar(x, lane, v) {
    const vmax = v || rand(0.36, 0.6) * P.vmax;
    st.cars.push({ x, lane, v: vmax, vmax, c: COLOR[pickOne(CAR_COLORS)].c, pull: 0, rot: 0, hop: 0 });
  }
  function laneClear(x, lane, gap) { return !st.cars.some(c => c.lane === lane && Math.abs(c.x - x) < CW + gap); }
  function updateCars(dt) {
    const pr = rearW(), pf = frontW(), live = st.phase !== 'pick';
    for (const c of st.cars) {
      const front = c.x + CW;
      let want = 0;
      if (st.siren && st.phase === 'drive' && front > pr - 10 && c.x < pf + 380 && !st.rails.some(r => front > r.stopX - 40 && c.x < r.x + 40)) want = 1;
      if (c.pull > 0.3 && live && c.x < pf + 6 && front > pr - 6) want = 1;
      c.pull += clamp(want - c.pull, -dt * 1.6, dt * 1.6);
      const target = want ? 0 : c.vmax;
      const m = c.pull < 0.5 ? stopFor(front, [c.lane], c) : Infinity;
      c.v = c.v < target ? Math.min(target, c.v + 70 * dt) : Math.max(target, c.v - 220 * dt);
      c.v = Math.min(c.v, Math.sqrt(2 * BRAKE * Math.max(0, m)));
      c.x += c.v * dt; c.rot += c.v * dt / 8; c.hop = Math.max(0, c.hop - dt);
      if (live && c.pull < 0.5 && c.lane === st.lane && c.x < pf + 4 && front > pr - 4) {   // make room after a lane change
        if (c.x + CW / 2 < (pr + pf) / 2) { c.x += (pr - CW - 8 - c.x) * Math.min(1, dt * 5); c.v = Math.min(c.v, st.v * 0.5); }
        else c.x += (pf + 8 - c.x) * Math.min(1, dt * 5);
      }
    }
    st.spawnT -= dt;
    const ahead = st.cars.filter(c => c.x > st.cam - 60 && c.x < st.cam + W + 500).length;
    if (ahead < P.carN && st.spawnT <= 0) {
      st.spawnT = rand(0.7, 1.8);
      const lane = Math.random() < 0.5 ? 0 : 1, x = st.cam + W + rand(30, 260);
      const railAhead = st.rails.some(r => r.state === 'idle' && x < r.x + 40);
      if (laneClear(x, lane, 50) && tunnelAt(x) === 0 && !railAhead) addCar(x, lane);
    }
    if (st.phase !== 'enter' && st.v < 25 && Math.random() < dt * 0.35) {
      const lane = st.phase === 'pick' ? (Math.random() < 0.5 ? 0 : 1) : 1 - st.lane, x = st.cam - CW - 30;
      if (laneClear(x, lane, 80)) addCar(x, lane, rand(0.45, 0.65) * P.vmax);
    }
    st.cars = st.cars.filter(c => c.x > st.cam - 400 && c.x < st.cam + W + 1000);
  }

  /* ---------- traffic lights and the train crossing ---------- */
  function updateLights(dt) {
    const front = frontW();
    for (const l of st.lights) {
      l.t += dt;
      const d = l.stopX - front;
      if (l.state === 'green') {
        if (l.armed && !l.done && st.phase === 'drive' && d < 230 && d > 70) { l.state = 'yellow'; l.t = 0; }
      } else if (l.state === 'yellow') {
        if (l.t > 0.9) { l.state = 'red'; l.t = 0; l.wait = 0; if (!st.siren) spawnCrossers(l); }
      } else {
        if (st.v < 2 && d > -4 && d < 60) l.wait += dt;
        if (!crossing(l) && ((l.t > 3 && l.wait > 1.4) || l.t > 6.5)) { l.state = 'green'; l.done = true; l.t = 0; if (d > -4 && d < 200) SND.ding(); }
      }
      for (const p of l.crossers) { p.y += p.v * dt; if (p.hop) p.hop = Math.max(0, p.hop - dt); }
      if (l.crossers.length) l.crossers = l.crossers.filter(p => p.y < P.dashY / 2 + 30);
    }
  }
  function spawnCrossers(l) {
    const y0 = P.rS - 1;
    if (Math.random() < 0.4) {
      l.crossers.push({ x: l.x + 14, y: y0, duck: true, big: true, v: 9, hop: 0 });
      for (let j = 1; j <= 3; j++) l.crossers.push({ x: l.x + 14 + (j % 2) * 4, y: y0 - j * 5, duck: true, big: false, v: 9, hop: 0 });
    } else {
      const n = Math.random() < 0.6 ? 2 : 1;
      for (let j = 0; j < n; j++) {
        const seed = Math.random() * 99;
        l.crossers.push({ x: l.x + 8 + j * 14, y: y0 - j * 6, type: pickOne([...ADULTS, ...KIDS]), skin: pickOne(SKIN), hair: pickOne(HAIR), seed, v: 12, hop: 0 });
      }
    }
  }
  function updateRails(dt) {
    const front = frontW();
    for (const r of st.rails) {
      r.t += dt;
      if (r.state === 'idle') {
        const d = r.stopX - front;
        if (d < -2) r.state = 'done';
        else if (st.phase === 'drive' && d < 280 && d > 20 && !st.cars.some(c => c.x + CW > front - 10 && c.x < r.x + 30)) { r.state = 'closing'; r.t = 0; }
      } else if (r.state === 'closing') {
        r.arm = Math.min(1, r.arm + dt / 1.2);
        if (r.arm >= 1 && r.t > 1.6 && !st.cars.some(c => c.x < r.x + 28 && c.x + CW > r.x - 28)) { r.state = 'train'; r.ty = (P.hz - 30) / 2; SND.whistle(); }
      } else if (r.state === 'train') {
        r.ty += 58 * dt;
        if ((r.chug -= dt) <= 0) { r.chug = 0.2; noise(0, 0.1, 0.1, 260, 1.2); }
        if ((r.puffT -= dt) <= 0) {
          r.puffT = 0.16;
          const cx = (r.x - st.cam), cy = (r.ty - 22) * 2;
          if (cy > P.hz - 20) fx(0, () => parts.push({ x: cx + rand(-3, 3), y: cy, vx: rand(-10, 10), vy: rand(-40, -24), g: 0, life: 0.9, max: 0.9, s: 3, c: Math.random() < 0.5 ? '#eef0f4' : '#c9ccd3' }));
        }
        if (r.ty - TRAIN_LEN > P.dashY / 2 + 4) { r.state = 'opening'; r.t = 0; }
      } else if (r.state === 'opening') {
        r.arm = Math.max(0, r.arm - dt / 1.2);
        if (r.arm <= 0) r.state = 'done';
      }
      if (r.state === 'closing' || r.state === 'train' || r.state === 'opening') { if ((r.bell -= dt) <= 0) { r.bell = 0.55; SND.bell(); } }
    }
  }
  function drawTrain(r) {
    const cx = Math.floor((r.x - st.cam) / 2), clipY = Math.floor((P.hz - 20) / 2);
    if (cx < -20 || cx > rc.width + 20) return;
    rcG.save(); rcG.beginPath(); rcG.rect(0, clipY, rc.width, rc.height - clipY); rcG.clip();
    const fronts = []; let f = r.ty;
    for (const pc of TRAIN) { fronts.push(Math.floor(f)); f -= pc.len + 2; }
    for (let i = TRAIN.length - 1; i >= 0; i--) {
      const pc = TRAIN[i], fr = fronts[i], x = cx - 12, top = fr - pc.len;
      if (fr < clipY - 2) continue;
      if (pc.loco) {
        R(x, top, 24, pc.len - 12, '#2f3240'); R(x + 3, top + 8, 18, pc.len - 20, '#e8222b'); R(x + 5, top + 8, 2, pc.len - 20, '#ff7a6b');
        R(x, top, 24, 8, '#a3121d'); R(x, top, 24, 1, '#ff7a6b');
        circle(cx, top + 14, 2, '#ffd21f'); circle(cx, fr - 19, 3, INK); R(cx - 3, fr - 19, 7, 1, '#3a3d46');
        R(x, fr - 12, 24, 12, '#e8222b'); R(x, fr - 12, 24, 1, '#ff7a6b');
        R(x + 3, fr - 10, 7, 5, '#ffffff'); R(x + 14, fr - 10, 7, 5, '#ffffff'); R(x + 6, fr - 9, 2, 3, INK); R(x + 17, fr - 9, 2, 3, INK);
        R(x + 9, fr - 4, 6, 1, INK); R(x + 8, fr - 5, 1, 1, INK); R(x + 15, fr - 5, 1, 1, INK);
        circle(cx, fr - 13, 2, '#fff6b0');
        R(x - 1, fr - 2, 26, 2, INK); for (let i2 = 0; i2 < 3; i2++) R(x + 3 + i2 * 3, fr + i2, 18 - i2 * 6, 1, '#5a5f6e');
      } else {
        R(x, top, 24, pc.len, pc.c[1]); R(x + 1, top, 22, pc.len - 8, pc.c[0]);
        for (let yy = top + 3; yy < fr - 10; yy += 4) R(x + 1, yy, 22, 1, pc.c[1]);
        R(x + 3, fr - 7, 18, 5, '#2f3240'); R(x + 4, fr - 6, 7, 3, GLASS); R(x + 13, fr - 6, 7, 3, GLASS);
        R(x + 11, fr, 2, 2, INK);
      }
    }
    rcG.restore();
  }
  function drawSignal(l, lit) {
    const x = Math.floor(l.stopX + 4 - st.cam); if (x < -20 || x > W + 20) return;
    const r = P.tlR, hw = 2 * r + 6, hh = 3 * (2 * r + 3) + 3, base = P.roadTop - 1, top = base - P.lampH - 6 - hh;
    const hx = x + 1 - (hw >> 1), ys = [0, 1, 2].map(i => top + 3 + r + i * (2 * r + 3));
    if (!lit) {
      R(x, top + hh, 2, base - top - hh, '#3f434e'); R(x - 1, base - 2, 4, 2, '#3f434e');
      R(hx - 1, top - 1, hw + 2, hh + 2, '#16171f'); R(hx, top, hw, hh, '#2f3240');
      ['#5a1f1f', '#5a4a14', '#1f4a26'].forEach((c, i) => { circle(x + 1, ys[i], r, c); R(hx - 1, ys[i] - r - 1, hw + 2, 1, '#16171f'); });
      return;
    }
    const i = l.state === 'red' ? 0 : l.state === 'yellow' ? 1 : 2, c = ['#ff3b3b', '#ffd21f', '#4cff6a'][i];
    alpha(0.2 + 0.35 * nightK(), () => circle(x + 1, ys[i], r + 4, c));
    circle(x + 1, ys[i], r, c); R(x, ys[i] - r + 1, 2, 1, '#ffffff');
  }
  function drawSideStreet(l) {
    const x = Math.floor(l.x - 8 - st.cam), w = 40;
    if (x > W || x + w < 0) return;
    R(x, P.hz, w, P.roadTop - P.hz, '#4b4f5c'); R(x, P.hz, 2, P.roadTop - P.hz, '#bdb8ac'); R(x + w - 2, P.hz, 2, P.roadTop - P.hz, '#bdb8ac');
    for (let yy = P.hz + 2; yy < P.bY; yy += 9) R(x + w / 2 - 1, yy, 2, 5, '#f4f7fb');
  }

  /* ---------- lamps ---------- */
  function lampOK(wx) {
    const s = segAt(wx);
    if (s && (NO_PEDS.has(s.kind) || (s.kind === 'rail' && Math.abs(wx - s.rail.x) < 44))) return false;
    for (const l of st.lights) if (wx > l.x - 16 && wx < l.x + 40) return false;
    return true;
  }
  function lamp(x, lit) {
    const base = P.roadTop - 1, hgt = P.lampH;
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(0.18 * k, () => { for (let i = 0; i < hgt - 2; i += 2) { const w = 4 + i * 0.6; R(x + 7 - w / 2, base - hgt + 3 + i, w, 2, '#fff1a8'); } });
      alpha(k, () => { glow(x + 7, base - hgt + 2, '#fff1a8', 5); R(x + 5, base - hgt + 2, 5, 2, '#fff6b0'); });
      return;
    }
    R(x - 1, base - 3, 4, 3, '#3f434e');
    R(x, base - hgt, 2, hgt, '#5a5f6e');
    R(x, base - hgt, 8, 2, '#5a5f6e'); R(x + 4, base - hgt + 1, 6, 1, '#3f434e'); R(x + 5, base - hgt + 2, 5, 1, '#e9e2b0');
  }
  function lamps(lit) {
    const sp = 150, o = 70;
    for (let k = Math.floor((st.cam - o - 20) / sp); k * sp + o - st.cam < W + 20; k++) {
      const wx = k * sp + o;
      if (lampOK(wx)) lamp(Math.floor(wx - st.cam), lit);
    }
  }

  /* ---------- player ---------- */
  function drivePlayer(dt) {
    const going = st.hold.size > 0;
    if (going) st.v = Math.min(P.vmax, st.v + ACC * dt); else st.v = Math.max(0, st.v - COAST * dt);
    const m = stopFor(frontW(), playerLanes(), null), lim = Math.sqrt(2 * BRAKE * Math.max(0, m));
    if (st.v > lim) {
      if (st.v > 55 && m < 40 && st.braked !== Math.round(frontW() + m)) { st.braked = Math.round(frontW() + m); SFX.brake(); }
      st.v = lim;
    }
    if (going && st.v < 20 && (st.puffT -= dt) <= 0) { st.puffT = 0.12; fx(0, () => puff(pxNow() - 2, P.roadTop + 44 + (st.ly * 24), 1, '#9aa3ad')); }
    st.idle = !going && st.v < 3 ? st.idle + dt : 0;
  }
  function changeLane(l) {
    if (st.phase === 'pick') return;
    if (l === st.lane) { SFX.boop(0.7); st.laneT = 0.3; return; }
    st.lane = l; SND.swish();
  }
  function honk() {
    SFX.honk(); st.hornT = 0.3;
    if (tunnelAt(st.cam + pxNow() + vlen() / 2) > 0.5) [0.6, 1.2].forEach((s, i) => { tone('square', 349, s, 0.22, 0.05 / (i + 1)); tone('square', 440, s, 0.22, 0.04 / (i + 1)); });
    let best = null;
    for (const c of st.cars) { const sx = c.x - st.cam; if (sx > pxNow() + vlen() && sx < W && (!best || c.x < best.x)) best = c; }
    if (best) { best.hop = 0.35; [0.5, 0.65].forEach(s => tone('square', 660, s, 0.1, 0.06)); }
    for (const s of visSegs()) for (const p of s.people) if (Math.random() < 0.7) p.wave = Math.max(p.wave, 1.8);
    for (const p of st.peds) p.wave = Math.max(p.wave, 1.8);
  }
  function stopSirenNow() { if (st.stopSiren) { st.stopSiren(); st.stopSiren = null; } }
  function toggleSiren() {
    st.siren = !st.siren;
    if (st.siren) {
      st.stopSiren = siren(V[st.vi].kind);
      for (const s of visSegs()) for (const p of s.people) { p.wave = 2.4; p.cheer = true; p.hop = 0.5; }
      for (const p of st.peds) { p.wave = 2.4; p.cheer = true; p.hop = 0.5; }
    } else { stopSirenNow(); SFX.pop(); }
  }
  function choose(vi) {
    st.vi = vi; st.phase = 'enter'; st.enterT = 0; st.v = 0; st.lane = 1; st.ly = 1;
    st.cars = st.cars.filter(c => !(c.lane === 1 && c.x < st.cam + P.px + 170));
    say(pick(V[vi].kind)); SND.vroom();
  }

  /* ---------- scene hooks ---------- */
  function enter() {
    stopSirenNow();
    Object.assign(st, { phase: 'pick', t: 0, cam: 0, v: 0, lane: 1, ly: 1, rot: 0, enterT: 0, siren: false, idle: 0, hornT: 0, laneT: 0, wheelA: 0,
      segs: [], nextX: -40, deck: [], sdeck: [], since: 0, every: 2, lastKind: '', lastCity: false, lastLight: 120, lastSpecial: '',
      cars: [], peds: [], lights: [], rails: [], spawnT: 0, pedT: 0, braked: null, swipes: {} });
    st.hold.clear();
    st.force = ['houses', 'bakery'];
    gen();
    for (let i = 0; i < 3; i++) st.peds.push(newPed(rand(20, W - 20)));
    setClouds(L.safeT + 10, Math.max(L.safeT + 30, P.skyTop - 12));
  }
  function leave() {
    stopSirenNow(); st.siren = false; st.hold.clear(); st.swipes = {};
    rumbleLo(0); rumbleHi(0);
  }
  function update(dt) {
    st.t += dt;
    if (st.phase === 'enter') { st.enterT += dt; st.rot += dt * 14; if (st.enterT >= ENTER) st.phase = 'drive'; }
    const cam0 = st.cam;
    if (st.phase === 'drive') drivePlayer(dt);
    st.cam += st.v * dt; st.rot += st.v * dt / 12;
    const dc = st.cam - cam0;
    if (dc) for (const p of parts) if (p.world) p.x -= dc;
    gen();
    const dl = st.lane - st.ly;
    st.ly += clamp(dl, -dt * 2.6, dt * 2.6);
    const wa = dl * 1.6 + (st.laneT > 0 ? Math.sin(st.laneT * 30) * 0.3 : 0);
    st.wheelA += (wa - st.wheelA) * Math.min(1, dt * 10);
    st.laneT = Math.max(0, st.laneT - dt); st.hornT = Math.max(0, st.hornT - dt);
    updateLights(dt); updateRails(dt); updateCars(dt); updatePeople(dt);
    // rain spray off the tires
    if (weather.kind === 'rain' && weather.k > 0.4 && st.v > 30 && st.phase === 'drive' && (st.splashT -= dt) <= 0) {
      st.splashT = 0.05;
      const yb = playerYS() * 2;
      fx(0, () => spawn(2, () => ({ x: pxNow() + 22 + rand(-4, 4), y: yb - 2, vx: rand(-70, -30), vy: rand(-50, -15), g: 220, life: 0.4, max: 0.4, s: 2, c: '#cfe6ff' })));
    }
    if (st.phase === 'pick') { rumbleLo(0); rumbleHi(0); }
    else { const k = st.v / P.vmax; rumbleLo(0.03 + 0.06 * k); rumbleHi(0.08 * k); }
  }

  /* ---------- drawing ---------- */
  const TOWERS = [['#c9d6e8', '#b3c3da'], ['#d8cfe6', '#c3b8d6'], ['#e6d6c8', '#d3c0ae'], ['#cfe0dc', '#b6ccc6']];
  function skyline() {
    const sp = 34, cam = st.cam * 0.25, k = nightK();
    for (let i = Math.floor((cam - 60) / sp); i * sp - cam < W + 60; i++) {
      const seed = i * 5.3 + 77;
      if (hsh(seed) > 0.85) continue;
      const w = 24 + Math.floor(hsh(seed + 1) * 14);
      const x = Math.floor(i * sp - cam + hsh(seed + 3) * 8), top = Math.floor(P.skyTop + 24 + hsh(seed + 2) * 40);
      if (top > P.hz - 20) continue;
      const [c, d] = TOWERS[Math.floor(hsh(seed + 4) * TOWERS.length)];
      R(x, top, w, P.hz + 12 - top, c); R(x + w - 3, top, 3, P.hz + 12 - top, d); R(x - 1, top - 2, w + 2, 2, d);
      for (let wy = top + 6, r = 0; wy < P.hz - 10; wy += 9, r++) for (let wx = x + 4, q = 0; wx + 4 < x + w - 3; wx += 7, q++) {
        R(wx, wy, 4, 4, d);
        if (k > 0.02 && hsh(seed + r * 13.1 + q * 3.7) < 0.45) alpha(k, () => R(wx, wy, 4, 4, '#ffe7a0'));
      }
    }
  }
  function drawBackdrop() {
    const pr = P.pr, far = st.cam * 0.12, mid = st.cam * 0.3, fs = pr ? 110 : 100, ms = pr ? 84 : 76;
    for (let k = Math.floor((far - 160) / fs); k * fs - far < W + 160; k++) {
      const r = Math.round((pr ? 60 : 40) + hsh(k * 1.3) * (pr ? 30 : 20));
      circle(k * fs - far, P.hz + r * 0.55, r, '#a6dd8e');
    }
    if (pr) skyline();
    for (let k = Math.floor((mid - 120) / ms); k * ms - mid < W + 120; k++) {
      const r = Math.round((pr ? 40 : 26) + hsh(k * 2.7 + 5) * (pr ? 22 : 14));
      circle(k * ms - mid + 30, P.hz + r * 0.62, r, '#8fd877');
    }
    R(0, P.hz, W, P.bY - P.hz, '#6cbf5a');
    R(0, P.bY, W, P.roadTop - P.bY, '#d9d2c3'); R(0, P.bY, W, 1, '#c2baa8');
    const so = Math.floor(st.cam) % 16;
    for (let xx = -so; xx < W; xx += 16) R(xx, P.bY + 1, 1, P.roadTop - P.bY - 1, '#c9c1b0');
  }
  function drawRoadSurface(vis) {
    const y = P.roadTop, h = 60;
    R(0, y, W, h, '#4b4f5c');
    R(0, y, W, 3, '#bdb8ac'); R(0, y + 3, W, 1, '#8f8b80');
    R(0, y + h - 2, W, 2, '#bdb8ac');
    const off = Math.floor(st.cam) % 30;
    for (let xx = -off; xx < W; xx += 30) R(xx, y + 39, 14, 2, '#f4f7fb');
    R(0, P.roadBot, W, P.vergeH, '#5aa84c');
    if (P.vergeH > 6) { const o2 = Math.floor(st.cam) % 23; for (let xx = -o2; xx < W; xx += 23) R(xx + 5, P.roadBot + 4 + (xx & 3), 1, 2, '#7cc96a'); }
    for (const l of st.lights) {
      const cx = Math.floor(l.x - st.cam); if (cx < -40 || cx > W + 10) continue;
      for (let yy = y + 5; yy < y + h - 4; yy += 6) R(cx, yy, 28, 3, '#f4f7fb');
      R(Math.floor(l.stopX - st.cam), y + 4, 2, h - 6, '#f4f7fb');
    }
    for (const s of vis) { const K = KIND[s.kind], x = Math.floor(s.x - st.cam); if (K.road) K.road(s, x); if (K.verge) K.verge(s, x); }
  }
  const WIPE = { fire: [56, 18, 7], police: [33, 13, 5], amb: [50, 21, 7] };
  function drawPlayer(yb) {
    const x = Math.floor(pxNow() / 2), moving = st.phase === 'enter' || st.v > 15;
    const bob = moving && Math.floor(T * 9) % 2 ? -1 : 0;
    drawV(st.vi, x, Math.round(yb), st.siren, bob, st.rot);
    if (weather.kind === 'rain' && weather.k > 0.3) {
      const v = V[st.vi], [wx, wy, len] = WIPE[v.kind], top = Math.round(yb) - v.h + bob;
      const a = -Math.PI / 2 + Math.sin(T * 6) * 1.1;
      line(x + wx, top + wy, x + wx + Math.cos(a) * len, top + wy + Math.sin(a) * len, 1, INK);
    }
  }
  function drawCrosser(p) {
    const x = Math.floor((p.x - st.cam) / 2), y = Math.floor(p.y - (p.hop > 0 ? Math.sin(p.hop / 0.4 * Math.PI) * 3 : 0));
    if (p.duck) drawDuck(x, y, p.big, 1, Math.floor(T * 6) % 2);
    else drawPerson({ type: p.type, x, yb: y, dir: 1, pose: 'stand', walk: true, skin: p.skin, hair: p.hair, seed: p.seed });
  }
  function drawRoadLayer() {
    g = rcG;
    rcG.clearRect(0, 0, rc.width, rc.height);
    for (const r of st.rails) if (r.state === 'train') drawTrain(r);
    const items = [];
    for (const c of st.cars) { const sx = (c.x - st.cam) / 2; if (sx > -40 && sx < rc.width + 4) items.push([carY(c), 0, c]); }
    if (st.phase !== 'pick') items.push([playerYS(), 1, null]);
    for (const l of st.lights) for (const p of l.crossers) items.push([p.y, 2, p]);
    items.sort((a, b) => a[0] - b[0]);
    for (const [y, t, o] of items) {
      if (t === 0) drawCar(Math.floor((o.x - st.cam) / 2), Math.round(y) - (o.hop > 0 ? Math.round(Math.sin(o.hop / 0.35 * Math.PI) * 3) : 0), o.c, o.rot, o.v > 15 && Math.floor(T * 8 + o.x) % 2 ? -1 : 0);
      else if (t === 1) drawPlayer(y);
      else drawCrosser(o);
    }
    g = worldG;
    worldG.imageSmoothingEnabled = false;
    worldG.drawImage(rc, 0, 0, rc.width * 2, rc.height * 2);
  }
  function carLights(x, yb, k) {
    for (let j = 0; j < 26; j++) { const half = 1 + j * 0.22; alpha(0.28 * k * (1 - j / 28), () => R(x + 34 + j, yb - 7 - half, 1, half * 2, '#fff3b0')); }
    alpha(k, () => { R(x + 33, yb - 8, 1, 2, '#fffbe6'); R(x, yb - 8, 1, 2, '#ff4a3a'); });
    alpha(0.5 * k, () => { circle(x + 34, yb - 7, 2, '#fff3b0'); circle(x, yb - 7, 2, '#ff3b3b'); });
  }
  function drawRoadLights() {
    g = rlG; rlG.clearRect(0, 0, rl.width, rl.height);
    const nk = nightK(); let any = false;
    if (st.phase !== 'pick') {
      const k = Math.max(nk, tunnelAt(st.cam + pxNow() + vlen() / 2));
      if (k > 0.02) { any = true; drawVehicleLights({ i: st.vi, x: Math.floor(pxNow() / 2), yb: Math.round(playerYS()), lit: st.siren, bob: 0 }, k); }
    }
    for (const c of st.cars) {
      const sx = Math.floor((c.x - st.cam) / 2); if (sx < -60 || sx > rl.width) continue;
      const k = Math.max(nk, tunnelAt(c.x + CW / 2));
      if (k > 0.02) { any = true; carLights(sx, Math.round(carY(c)), k); }
    }
    g = loG;
    if (any) { loG.imageSmoothingEnabled = false; loG.drawImage(rl, 0, 0, rl.width * 2, rl.height * 2); }
  }
  function drawWorld() {
    const vis = visSegs();
    drawHeli();
    drawBackdrop();
    for (const l of st.lights) drawSideStreet(l);
    for (const s of vis) {
      const x = Math.floor(s.x - st.cam);
      KIND[s.kind].draw(s, x, false);
      if (s.tree) drawTree(Math.floor(s.tree - st.cam), P.bY, P.treeR - 3 + Math.floor(hsh(s.seed + 4) * 4));
    }
    drawPeople(vis);
    lamps(false);
    for (const l of st.lights) drawSignal(l, false);
    drawRoadSurface(vis);
    drawRoadLayer();
    for (const s of vis) if (KIND[s.kind].front) KIND[s.kind].front(s, Math.floor(s.x - st.cam));
  }
  function drawLit() {
    if (!P.pr) { drawSun(...orbit(Math.PI + sky.rot)); drawMoon(...orbit(sky.rot)); }
    const vis = visSegs();
    // glowing windows and lamps sit behind the road, so keep them off the vehicles
    loG.save(); loG.beginPath(); loG.rect(0, 0, W, H);
    if (st.phase !== 'pick') { const vh = V[st.vi].h * 2; loG.rect(pxNow(), playerYS() * 2 - vh, vlen(), vh); }
    for (const c of st.cars) loG.rect(c.x - st.cam, carY(c) * 2 - 36, CW, 36);
    loG.clip('evenodd');
    for (const s of vis) KIND[s.kind].draw(s, Math.floor(s.x - st.cam), true);
    lamps(true);
    for (const l of st.lights) drawSignal(l, true);
    loG.restore();
    for (const s of vis) { const K = KIND[s.kind]; if (K.lit) K.lit(s, Math.floor(s.x - st.cam)); }
    drawRoadLights();
    drawParticles();
  }

  /* ---------- dashboard ---------- */
  function hintArrow(x, y) {
    y = Math.floor(y - Math.abs(Math.sin(T * 4)) * 5); x = Math.floor(x);
    const shape = (dx, dy, c) => { R(x - 2 + dx, y - 11 + dy, 5, 6, c); for (let i = 0; i < 5; i++) R(x - 5 + i + dx, y - 5 + i + dy, 11 - 2 * i, 1, c); };
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) shape(dx, dy, '#1d1a2b');
    shape(0, 0, '#ffd21f');
  }
  function drawPedal() {
    const p = P.pedal, down = st.hold.size > 0, pulse = !down && st.idle > 1.5 && st.phase === 'drive' ? Math.round((Math.sin(T * 5) + 1) * 1.2) : 0;
    const x = p.x - pulse, y = p.y + (down ? 3 : 0) - pulse, w = p.w + 2 * pulse, h = p.h - (down ? 3 : 0) + 2 * pulse;
    if (!down) R(x + 2, y + h, w - 4, 3, '#16171f');
    R(x + 2, y - 2, w - 4, h + 4, '#ffffff'); R(x - 2, y + 2, w + 4, h - 4, '#ffffff'); R(x, y, w, h, '#ffffff');
    const gc = down ? '#2f9a2c' : '#3fb43a';
    R(x + 2, y, w - 4, h, gc); R(x, y + 2, w, h - 4, gc);
    R(x + 2, y + h - 3, w - 4, 3, '#1f7a2a'); R(x + 3, y + 1, w - 6, 2, '#8fe36b');
    for (let yy = y + 6; yy < y + h - 6; yy += 5) { R(x + 6, yy, 10, 2, '#1f7a2a'); R(x + w - 16, yy, 10, 2, '#1f7a2a'); }
    drawArrowIcon(x + w / 2, y + h / 2 - 1, Math.min(h, 40));
  }
  function sirenIcon(cx, cy, s, on) {
    const u = Math.max(2, Math.round(s / 12)), ph = Math.floor(T * 7) % 2, kind = V[st.vi].kind;
    const c = on ? (ph ? RED_ON : kind === 'police' ? BLUE_ON : '#ffffff') : '#ffb3b3';
    R(cx - 4 * u, cy + 2 * u, 8 * u, 2 * u, '#3a3d46');
    R(cx - 3 * u, cy - 2 * u, 6 * u, 4 * u, c); R(cx - 2 * u, cy - 3 * u, 4 * u, u, c);
    R(cx - 2 * u, cy - u, u, 2 * u, '#ffffff');
    if (on) { R(cx - 6 * u, cy - 3 * u, u, u, '#ffffff'); R(cx + 5 * u, cy - 3 * u, u, u, '#ffffff'); R(cx - 6 * u, cy, 2 * u, u, '#ffffff'); R(cx + 4 * u, cy, 2 * u, u, '#ffffff'); R(cx - u / 2, cy - 6 * u, u, 2 * u, '#ffffff'); }
  }
  function hornIcon(cx, cy, s) {
    const u = Math.max(2, Math.round(s / 13));
    R(cx - 5 * u, cy - u, 3 * u, 2 * u, INK);
    for (let k = 0; k < 4; k++) R(cx - 2 * u + k * u, cy - (1 + k) * u, u, (2 + 2 * k) * u, INK);
    if (st.hornT > 0 || Math.floor(T * 2) % 2) { R(cx + 3 * u, cy - 4 * u, u, u, INK); R(cx + 4 * u, cy - u, u, 2 * u, INK); R(cx + 3 * u, cy + 3 * u, u, u, INK); }
  }
  function laneIcon(cx, cy, s) {   // an up arrow and a down arrow: swap lanes
    const u = Math.max(2, Math.round(s / 14)), ax = cx - 3 * u, bx = cx + 3 * u;
    const up = st.lane === 1 ? '#ffffff' : '#bcd6ff', dn = st.lane === 0 ? '#ffffff' : '#bcd6ff';
    for (let i = 0; i < 3; i++) R(ax - i * u - u / 2, cy - 5 * u + i * u, (2 * i + 1) * u, u, up);
    R(ax - u / 2, cy - 2 * u, u, 6 * u, up);
    for (let i = 0; i < 3; i++) R(bx - i * u - u / 2, cy + 4 * u - i * u, (2 * i + 1) * u, u, dn);
    R(bx - u / 2, cy - 4 * u, u, 6 * u, dn);
  }
  function drawWheel(wh) {
    const { x, y, r } = wh, a = st.wheelA;
    circle(x, y + 2, r, '#16171f'); circle(x, y, r, '#1d1a2b'); circle(x, y, r - 3, '#3a3d46');
    for (const off of [-Math.PI / 2 + Math.PI, Math.PI / 6 - Math.PI, -Math.PI * 7 / 6 + Math.PI]) {
      const b = a + off + Math.PI / 2;
      line(x, y, x + Math.cos(b) * (r - 2), y + Math.sin(b) * (r - 2), 3, '#1d1a2b');
    }
    circle(x, y, 5, '#5a5f6e'); circle(x, y, 3, V[st.vi].kind === 'police' ? '#2a6fe0' : '#e8222b');
    const mx = x + Math.cos(a - Math.PI / 2) * (r - 1.5), my = y + Math.sin(a - Math.PI / 2) * (r - 1.5);
    R(mx - 1, my - 1, 3, 3, '#ffd21f');
  }
  function drawSpeedo(sp) {
    const { x, y, r } = sp;
    circle(x, y, r + 1, '#16171f'); circle(x, y, r, '#f4f7fb');
    R(x - r - 1, y + 4, 2 * r + 3, r, '#2f3240');
    const a0 = Math.PI * 1.05, a1 = Math.PI * 1.95;
    for (let i = 0; i <= 8; i++) { const a = lerp(a0, a1, i / 8), c = i < 4 ? '#3fb43a' : i < 7 ? '#ffd21f' : '#e8222b'; R(x + Math.cos(a) * (r - 3) - 1, y + Math.sin(a) * (r - 3) - 1, 2, 2, c); }
    const a = lerp(a0, a1, clamp(st.v / P.vmax, 0, 1));
    line(x, y, x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4), 1, '#e8222b');
    circle(x, y, 2, INK);
  }
  function drawDash() {
    const y = P.dashY;
    R(0, y, W, H - y, '#2f3240'); R(0, y, W, 3, '#5a5f6e'); R(0, y + 3, W, 1, '#16171f');
    drawHomeButton(P.homeB);
    const sb = P.sirenB, sOn = st.siren && Math.floor(T * 7) % 2;
    button(sb, st.siren ? (sOn ? '#e8222b' : V[st.vi].kind === 'police' ? '#2a6fe0' : '#ff7a6b') : '#e8222b', st.siren ? '#7a1018' : '#a3121d');
    sirenIcon(sb.x + sb.s / 2, sb.y + sb.s / 2, sb.s, st.siren);
    const hb = P.hornB, hp = st.hornT > 0 ? 2 : 0;
    button({ x: hb.x, y: hb.y + hp, s: hb.s }, '#ffd21f', '#c99410'); hornIcon(hb.x + hb.s / 2, hb.y + hb.s / 2 + hp, hb.s);
    const lb = P.laneB;
    button(lb, '#2a6fe0', '#1a3f9a'); laneIcon(lb.x + lb.s / 2, lb.y + lb.s / 2, lb.s);
    if (P.wheel) drawWheel(P.wheel);
    if (P.speedo) drawSpeedo(P.speedo);
    drawPedal();
    if (st.phase === 'drive' && st.idle > 2) hintArrow(P.pedal.x + P.pedal.w / 2, P.pedal.y - 4);
  }
  function drawCard(c, i, k) {
    const vi = ORDER[i], kind = V[vi].kind, border = { fire: '#e8222b', police: '#2a6fe0', amb: '#ff6fb4' }[kind];
    const bob = Math.round(Math.sin(T * 3 + i * 2) * 1.5);
    alpha(k, () => {
      R(c.x + 3, c.y + 4, c.w, c.h, '#1d1a2b');
      R(c.x + 2, c.y, c.w - 4, c.h, border); R(c.x, c.y + 2, c.w, c.h - 4, border);
      R(c.x + 5, c.y + 3, c.w - 10, c.h - 6, '#fff6e0'); R(c.x + 3, c.y + 5, c.w - 6, c.h - 10, '#fff6e0');
      R(c.x + 5, c.y + 5, c.w - 10, Math.round(c.h * 0.55), '#cdeffd');
      const ry = c.y + c.h - 16;
      R(c.x + 4, ry, c.w - 8, 11, '#4b4f5c'); R(c.x + 4, ry, c.w - 8, 1, '#bdb8ac');
      for (let xx = c.x + 8; xx < c.x + c.w - 12; xx += 14) R(xx, ry + 6, 7, 1, '#ffd21f');
      g = cardG; cardG.clearRect(0, 0, 72, 46);
      drawV(vi, 3, 44, true, 0, T * 2);
      g = loG;
      const sc = Math.min(3, (c.w - 16) / 70, (c.h - 14) / 46), w = 72 * sc, h = 46 * sc;
      loG.imageSmoothingEnabled = false;
      loG.drawImage(cardCv, 0, 0, 72, 46, Math.round(c.x + (c.w - w) / 2), Math.round(ry + 7 - h + bob), Math.round(w), Math.round(h));
    });
  }
  function drawUI() {
    if (st.phase === 'pick' || (st.phase === 'enter' && st.enterT < 0.4)) {
      const k = st.phase === 'pick' ? 1 : 1 - st.enterT / 0.4;
      alpha(0.35 * k, () => R(0, 0, W, H, '#1d1a2b'));
      P.cards.forEach((c, i) => drawCard(c, i, k));
      if (st.phase === 'pick') { drawHomeButton(P.pickHome); if (st.t > 3) hintArrow(P.cards[0].x + P.cards[0].w / 2, P.cards[0].y + 4); }
      if (st.phase === 'pick') return;
    }
    drawDash();
  }

  /* ---------- input ---------- */
  function tapPeople(x, y, vis) {
    let best = null, bd = 1e9, bx = 0, by = 0;
    const test = (p, sx, yb) => { if (Math.abs(x - sx) < 9 && y > yb - 26 && y < yb + 3 && Math.abs(x - sx) < bd) { bd = Math.abs(x - sx); best = p; bx = sx; by = yb; } };
    for (const s of vis) for (const p of s.people) test(p, s.x + p.dx - st.cam, P.rowY[p.row]);
    for (const p of st.peds) test(p, p.x - st.cam, P.rowY[p.row]);
    if (!best) return false;
    best.hop = 0.5; best.wave = 2; best.cheer = Math.random() < 0.5;
    SFX.boop(rand(0.9, 1.4)); fx(0, () => sparkle(bx, by - 26, 8, 5, pickOne(['#fff27a', '#ffffff', '#ffb3da'])));
    return true;
  }
  function tapRoadThings(x, y) {
    for (const c of st.cars) {
      const sx = c.x - st.cam, yb = carY(c) * 2;
      if (x > sx && x < sx + CW && y > yb - 36 && y < yb + 2) { c.hop = 0.35; SND.beepBeep(rand(0.9, 1.2)); return; }
    }
    for (const l of st.lights) for (const p of l.crossers) {
      const sx = (p.x - st.cam), yb = p.y * 2;
      if (Math.abs(x - sx) < 14 && y > yb - 44 && y < yb + 4) { p.hop = 0.4; p.duck ? SFX.quack() : SFX.boop(1.2); return; }
    }
  }
  function tap(x, y, id) {
    if (st.phase === 'pick') {
      if (inBox(P.pickHome, x, y)) { SFX.boop(); goScene('station'); return true; }
      for (let i = 0; i < 3; i++) { const c = P.cards[i]; if (inRect(x, y, c.x, c.y, c.w, c.h)) { choose(ORDER[i]); return true; } }
      if (hitCloud(x, y)) { cycleWeather(); return true; }
      if (hitHeli(x, y)) return false;
      SFX.pop(); return true;
    }
    if (y >= P.dashY) {
      if (inBox(P.homeB, x, y)) { SFX.boop(); goScene('station'); return true; }
      if (inBox(P.sirenB, x, y)) { toggleSiren(); return true; }
      if (inBox(P.hornB, x, y)) { honk(); return true; }
      if (inBox(P.laneB, x, y) || (P.wheel && (x - P.wheel.x) ** 2 + (y - P.wheel.y) ** 2 < (P.wheel.r + 4) ** 2)) { changeLane(1 - st.lane); return true; }
      if (P.speedo && (x - P.speedo.x) ** 2 + (y - P.speedo.y) ** 2 < (P.speedo.r + 4) ** 2) { SFX.beep(); return true; }
      if (inRect(x, y, P.pedal.x - 8, P.pedal.y - 8, P.pedal.w + 16, P.pedal.h + 16)) { startHold(id); return true; }
      SFX.pop(); return true;
    }
    if (y < P.skyTop && hitCloud(x, y)) { cycleWeather(); return true; }
    const px = pxNow(), yb = playerYS() * 2, onPlayer = x >= px && x < px + vlen() && y > yb - V[st.vi].h * 2 && y < yb + 2;
    if (y >= P.roadTop - 4 || onPlayer) {
      startHold(id); st.swipes[id] = { y0: y, done: false };
      if (onPlayer) honk(); else tapRoadThings(x, y);
      return true;
    }
    const vis = visSegs();
    if (tapPeople(x, y, vis)) return true;
    for (const l of st.lights) {
      const lx = l.stopX + 4 - st.cam, top = P.roadTop - 1 - P.lampH - 6 - (3 * (2 * P.tlR + 3) + 3);
      if (Math.abs(x - lx) < 9 && y > top - 4 && y < P.roadTop) { SFX.beep(); return true; }
    }
    for (let i = vis.length - 1; i >= 0; i--) { const s = vis[i], K = KIND[s.kind]; if (K.tap && K.tap(s, Math.floor(s.x - st.cam), x, y)) return true; }
    if (hitHeli(x, y)) return false;
    SFX.pop(); fx(0, () => sparkle(x, y, 5, 4, '#ffffff'));
    return true;
  }
  function startHold(id) {
    if (!st.hold.size && st.phase !== 'pick') { SND.vroom(); }
    st.hold.add(id);
  }
  function move(x, y, id) {
    const sw = st.swipes[id];
    if (!sw || sw.done || Math.abs(y - sw.y0) < 14) return;
    sw.done = true; changeLane(y < sw.y0 ? 0 : 1);
  }
  function release(id) { st.hold.delete(id); delete st.swipes[id]; }

  SCENES.drive = {
    view: [186, 200],   // close-up camera
    freeTouch: true,    // holding anywhere on the road drives; clouds are handled here
    layout, enter, leave, update, tap, move, release,
    groundY: () => P.hz,
    drawWorld, drawLit, drawUI,
    _st: st, _P: P,     // for tests
  };
})();
