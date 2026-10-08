// "Car Wash": a muddy vehicle rolls into the wash bay. Scrub the mud into foam (the big
// spinning brushes slide over it as you drag), rinse the foam away with the hose, then hold to
// run the rainbow dryer (or rub with the towel) until it's SQUEAKY CLEAN. Then the next one
// rolls in: the fire truck, police car, ambulance, steam train, dump truck, garbage truck,
// fireboat, ice cream truck and the truck you built. Every touch cleans something.
'use strict';
(() => {
  let Z = 2;                                     // the vehicle is drawn at 2x (1x if it won't fit)
  const OW = 116, OH = 86, OX = 6, OYB = 80;     // offscreen sprite canvas; the vehicle's left edge is OX, wheels on OYB
  const vc = document.createElement('canvas'); vc.width = OW; vc.height = OH;
  const vg = vc.getContext('2d');
  const mc = document.createElement('canvas'); mc.width = 220; mc.height = 130;   // for measuring a vehicle
  const mg = mc.getContext('2d');
  const Y = {};                                  // this scene's layout, recomputed in layout()
  const F = {
    state: 'off', vi: VI.fire, kind: 'fire', step: 0, spots: [], x: 0, held: null, px: 0, py: 0, drag: 0, rub: 0,
    spray: 0, aimX: 0, aimY: 0, nt: 0, doneT: 0, honked: false, idle: 0, spin: 0, rollFast: 0, rot: 0,
    puddle: 0, cheer: 0, duckHop: 0, bigDuckHop: 0, wig: [0, 0, 0], notes: 0, lastNote: 0, jump: 0, t: 0,
    arch: 0, blow: 0, said: false, wordT: 0,
  };
  let cur = null;                                // the vehicle in the bay: { kind, len, h, ax, draw, duck }
  let bubbles = [], words = [];
  const brushes = [{ x: 0, tx: 0, home: 0, spin: 0, busy: 0, cool: 0 }, { x: 0, tx: 0, home: 0, spin: 1.5, busy: 0, cool: 0 }];
  const BW = 16;                                 // brush width
  const rubSound = noiseLoop(650, 0.9), spraySynth = noiseLoop(1400, 0.7), blowSynth = noiseLoop(500, 0.4);
  const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
  const RAINBOW = ['#ff3b3b', '#ff9a1f', '#ffe14a', '#3fd24a', '#3b8bff', '#a35bff'];
  const TOOL = [
    { bg: '#ff6fb4', dark: '#c73d84', fill: '#ffb3da' },   // sponge and brushes
    { bg: '#2a6fe0', dark: '#1a3f9a', fill: '#6fb6ff' },   // hose
    { bg: '#8a4fd9', dark: '#55289a', fill: '#c39bff' },   // rainbow dryer (and towel)
  ];
  const DUCK = { fire: [29, 5], police: [7, 14], amb: [22, 6] };   // rubber duck: x from OX, y from the roof line
  const MUD = ['#7a5230', '#5a3a1e', '#9c6d3f'];

  /* ---------- sounds (made on first entry: toys.js loads after this file) ---------- */
  let SND = null, brushLoop = () => {}, blowLoop = () => {}, sprayLoop = () => {};
  function sounds() {
    if (SND || typeof TOY === 'undefined') return;
    SND = TOY.bank({
      brush: ['wash-brush', 0.5], blower: ['wash-blower', 0.42], spray: ['wash-spray', 0.42],
      whoosh: ['wash-whoosh', 0.55], squeak: ['wash-squeak', 0.8], squeak2: ['bath-squeak', 0.6],
      splash: ['bath-splash', 0.5], bubble: ['bath-bubble', 0.45], pop: ['bath-pop', 0.55], chime: ['mv-chime', 0.55],
      whistle: ['train-whistle', 0.5], toot: ['boat-toot', 0.5], bell: ['ic-bell', 0.5], honk: ['bt-honk', 0.55],
    }, {
      whoosh() { noise(0, 0.5, 0.16, 900, 0.5); }, squeak() { tone('sine', 1800, 0, 0.12, 0.08, 2600); tone('sine', 1900, 0.16, 0.14, 0.08, 2800); },
      squeak2() { tone('sine', 1500, 0, 0.15, 0.08, 2200); }, splash() { noise(0, 0.4, 0.14, 1400, 0.7); },
      bubble() { tone('sine', 600, 0, 0.1, 0.08, 1200); }, pop() { SFX.pop(); }, chime() { SFX.chime(); },
      whistle() { tone('triangle', 880, 0, 0.6, 0.08); tone('triangle', 1108, 0, 0.6, 0.06); }, toot() { tone('square', 220, 0, 0.5, 0.08); },
      bell() { SFX.bell(); }, honk() { SFX.honk(); },
    }, 'wash-music', 0.2);
    brushLoop = SND.loop('brush'); blowLoop = SND.loop('blower'); sprayLoop = SND.loop('spray');
  }
  const play = (k, rate, vol) => { if (SND) SND.play(k, rate, vol); };
  function spraySound(v) { if (SND && SND.has('spray')) { sprayLoop(v ? 1 : 0); spraySynth(0); } else spraySynth(v); }
  function blowSound(v) { if (SND && SND.has('blower')) { blowLoop(v ? 1 : 0, 0.95 + v * 0.1); blowSynth(0); } else blowSynth(v * 0.25); }

  /* ---------- the vehicles that take turns ---------- */
  const myTruck = () => {
    try {
      const sp = JSON.parse(localStorage.getItem('firestation.mytruck') || 'null');
      if (sp && typeof sp === 'object') return Object.assign({}, sp, { color: COLOR[sp.color] ? sp.color : 'red' });
    } catch (e) { /* storage unavailable */ }
    return null;
  };
  const vDraw = vi => (x, yb, lit, bob, rot) => drawV(vi, x, yb, lit, bob, rot);
  const KINDS = {
    fire: { vi: VI.fire, ok: () => true, draw: vDraw(VI.fire) },
    police: { vi: VI.police, ok: () => true, draw: vDraw(VI.police) },
    amb: { vi: VI.amb, ok: () => true, draw: vDraw(VI.amb) },
    train: { ok: () => SCENES.train && SCENES.train.card, draw: (x, yb) => SCENES.train.card(x, yb), hello: 'whistle' },
    dig: { ok: () => SCENES.dig && SCENES.dig.card, draw: (x, yb) => SCENES.dig.card(x, yb), hello: 'honk' },
    trash: { ok: () => SCENES.trash && SCENES.trash.card, draw: (x, yb) => SCENES.trash.card(x, yb), hello: 'honk' },
    boat: {   // the fireboat rides in on a little trailer
      ok: () => SCENES.boat && SCENES.boat.card, hello: 'toot',
      draw(x, yb) {
        SCENES.boat.card(x, yb - 6);
        R(x - 26, yb - 6, 56, 2, '#5b6470'); R(x - 26, yb - 6, 56, 1, '#8b96a1'); R(x + 30, yb - 5, 8, 1, '#5b6470');
        for (const wx of [-14, 10]) { circle(x + wx, yb - 3, 3, TIRE); circle(x + wx, yb - 3, 1, '#a7b0ba'); }
      },
    },
    ice: { ok: () => SCENES.movieIce && SCENES.movieIce.cover, draw: (x, yb) => SCENES.movieIce.cover(x, yb), hello: 'bell' },
    mine: {
      ok: () => SCENES.builder && SCENES.builder.drawTruck && myTruck(), hello: 'honk',
      draw: (x, yb, lit, bob, rot) => SCENES.builder.drawTruck(cur.spec, x, yb, lit, bob, rot),
    },
  };
  const ORDER = ['fire', 'police', 'amb', 'train', 'dig', 'trash', 'boat', 'ice', 'mine'];
  // Draw a vehicle once into the measuring canvas to find how big it is and where it starts.
  function measure(kind) {
    const k = KINDS[kind];
    const c = { kind, vi: k.vi, draw: k.draw, hello: k.hello, spec: kind === 'mine' ? myTruck() : null };
    const prevCur = cur; cur = c;
    const prev = g; g = mg;
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, mc.width, mc.height);
    const ax = 80, ab = 110;
    try { c.draw(ax, ab, false, 0, 0); } catch (e) { g = prev; cur = prevCur; return null; }
    g = prev; cur = prevCur;
    let x0 = 1e9, y0 = 1e9, x1 = -1;
    try {
      const d = mg.getImageData(0, 0, mc.width, mc.height).data;
      for (let y = 0; y < mc.height; y++) for (let x = 0; x < mc.width; x++) if (d[(y * mc.width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
    } catch (e) { x0 = ax; x1 = ax + 66; y0 = ab - 38; }
    if (x1 < 0) return null;
    c.len = Math.min(OW - OX - 2, x1 - x0 + 1);
    c.h = Math.min(OYB - 10, ab - y0);
    c.ax = ax - x0;                                // draw at OX + ax so the left edge lands on OX
    if (c.vi != null) c.h = Math.max(c.h, V[c.vi].h);
    return c;
  }
  function nextKind(kind, step = 1) {
    let i = ORDER.indexOf(kind);
    for (let n = 0; n < ORDER.length; n++) { i = (i + step + ORDER.length) % ORDER.length; if (KINDS[ORDER[i]].ok()) return ORDER[i]; }
    return 'fire';
  }
  // the arrows beside the bay: pick another vehicle (the one in the wash drives out first)
  function pickVehicle(step) {
    if (F.state === 'exit') { F.pick = nextKind(F.pick || F.kind, step); return; }
    stopLoops(); F.pick = nextKind(F.kind, step); F.state = 'exit'; F.t = 0; SFX.boop(step > 0 ? 1.3 : 1.1);
  }

  /* ---------- layout ---------- */
  function layout() {
    const uw = W - L.safeL - L.safeR;
    Y.floorD = Math.max(14, Math.min(24, Math.round((L.palY - L.safeT) * 0.05)));
    Y.fy = L.palY - Y.floorD;                    // where the back wall meets the floor
    Y.vyb = Y.fy + Math.min(8, Y.floorD - 5);    // bottom of the wheels
    Y.bayW = Math.min(uw - 8, 66 * 2 + 60);
    Y.bayX = Math.round(L.cx - Y.bayW / 2);
    Y.bayCx = Y.bayX + Y.bayW / 2;
    Y.bayTop = Y.vyb - 38 * 2 - 26;
    const side = uw >= Y.bayW + 96;              // room for the attendant beside the bay
    const bw = Math.min(uw - 4, Y.bayW + (side ? 150 : 40));
    Y.bx0 = Math.round(L.cx - bw / 2); Y.bx1 = Y.bx0 + bw;
    Y.top = Math.max(L.safeT + 4, Math.min(Math.round(H * 0.3), Y.bayTop - 44));
    // keep the sun clear when the roof is up in its corner
    if (Y.top < L.sunY + 32 && Y.bx1 > L.sunX - 30 && L.sunX - 30 >= Y.bayX + Y.bayW + 8) Y.bx1 = L.sunX - 30;
    const areaT = Y.top + 9, areaB = Y.bayTop - 12, area = Math.max(16, areaB - areaT);
    const sh = Math.min(area, 100);
    const sw = Math.min(Y.bayW - 6, Math.max(90, Math.round(sh * 2.6)));
    Y.sign = { x: Math.round(Y.bayCx - sw / 2), y: areaT + Math.floor((area - sh) / 2), w: sw, h: sh };
    Y.att = side ? { x: Y.bayX + Y.bayW + 24, yb: Y.vyb, roof: false } : { x: Y.bx1 - 22, yb: Y.top - 4, roof: true };
    if (Y.att.roof && Math.abs(Y.att.x - L.sunX) < 34 && Y.top - 26 < L.sunY + 30) Y.att.x = Y.bx0 + 54;   // not under the sun
    // the giant duck sits on the roof, or on the floor beside the bay when the roof is too high up
    if (Y.top - 26 >= L.safeT) Y.duck = { x: Y.bx0 + 24, yb: Y.top - 4 };
    else if (Y.bayX - 36 >= L.safeL + 14) Y.duck = { x: Y.bayX - 26, yb: Y.vyb + 2 };
    else Y.duck = null;
    Y.hillY = Y.fy - 40;
    Y.nozX = Y.bayX + 15; Y.nozY = Y.bayTop + 20;
    // the rainbow dryer arch fills the bay
    Y.arch = { cx: Math.round(Y.bayCx), by: Y.fy + 2, rx: Math.round(Y.bayW / 2) - 3, ry: Y.fy + 2 - (Y.bayTop + 12) };
    // portholes on the facade beside the bay, when there's room
    Y.ports = [];
    const lw = Y.bayX - 6 - Y.bx0, rw = Y.bx1 - (Y.bayX + Y.bayW + 6);
    const py = Math.round((Y.bayTop + Y.fy) / 2) - 12;
    if (lw >= 34) Y.ports.push({ x: Y.bx0 + Math.round(lw / 2), y: py });
    if (rw >= 34 && !side) Y.ports.push({ x: Y.bx1 - Math.round(rw / 2), y: py });
    if (side && rw >= 34) Y.ports.push({ x: Y.bx1 - Math.round(rw / 2), y: Y.bayTop + 14 });
    // tool buttons in the bottom strip
    const tb = Math.max(28, Math.min(L.palH - 8, 42));
    const left = L.homeBtn.x + L.homeBtn.s + 8, right = W - L.safeR - 6;
    const span = Math.min((right - left) / 3, tb + 30);
    const g0 = left + ((right - left) - span * 3) / 2;
    Y.tools = [0, 1, 2].map(k => ({ x: Math.round(g0 + span * (k + 0.5) - tb / 2), y: L.palY + Math.floor((L.palH - tb) / 2), s: tb }));
    const as = Math.max(26, Math.min(36, L.blob)), ay = Math.round(Y.vyb - 40 - as / 2);
    Y.prev = { x: L.safeL + 4, y: ay, s: as }; Y.next = { x: W - L.safeR - 4 - as, y: ay, s: as };
    if (scene === 'wash') setClouds(L.safeT + 10, Math.max(L.safeT + 30, Y.top - 26));
    if (cur) fitVehicle();
    if (F.state === 'work' || F.state === 'next' || F.state === 'done') F.x = targetX();
  }
  // The vehicle's zoom (2x unless it won't fit) and where the brushes park beside it.
  function fitVehicle() {
    const uw = W - L.safeL - L.safeR;
    Z = cur.len * 2 <= uw - 2 && cur.h * 2 + 10 <= Y.vyb - L.safeT ? 2 : 1;
    Y.vy = Y.vyb - OYB * Z;                      // top of the offscreen sprite on screen
    const vx0 = targetX() + OX * Z, vx1 = vx0 + cur.len * Z;
    const lo = Y.bayX + BW / 2 + 1, hi = Y.bayX + Y.bayW - BW / 2 - 1;
    brushes[0].home = Math.round(Math.max(lo, Math.min(vx0 - BW / 2 - 4, Y.bayX + Y.bayW * 0.3)));
    brushes[1].home = Math.round(Math.min(hi, Math.max(vx1 + BW / 2 + 4, Y.bayX + Y.bayW * 0.7)));
  }
  const targetX = () => Math.round(Y.bayCx - (OX + cur.len / 2) * Z);
  function vbox(pad = 0) {   // the vehicle on screen
    return { x: F.x + OX * Z - pad, y: Y.vy - F.jump + (OYB - cur.h) * Z - pad, w: cur.len * Z + 2 * pad, h: cur.h * Z + 2 * pad };
  }
  function onVehicle(x, y, pad) { const b = vbox(pad); return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h; }
  const spotXY = s => [F.x + (s.lx + 0.5) * Z, Y.vy - F.jump + (s.ly + 0.5) * Z];

  /* ---------- a new muddy vehicle ---------- */
  // Draw the vehicle (and nothing else) into the offscreen canvas.
  function paintVehicle(lit, bob, rot) {
    const prev = g; g = vg;
    vg.setTransform(1, 0, 0, 1, 0, 0); vg.clearRect(0, 0, OW, OH);
    try { cur.draw(OX + cur.ax, OYB + (cur.vi == null ? bob : 0), lit, cur.vi == null ? 0 : bob, rot); } finally { g = prev; }
  }
  function makeSpots() {
    paintVehicle(false, 0, 0);
    let data = null;
    try { data = vg.getImageData(0, 0, OW, OH).data; } catch (e) { /* fall back to the bounding box */ }
    const solid = (x, y) => x >= 0 && y >= 0 && x < OW && y < OH && (!data || data[(y * OW + x) * 4 + 3] > 0);
    const cand = [];
    for (let y = OYB - cur.h + 2; y <= OYB - 6; y++) for (let x = OX + 2; x < OX + cur.len - 2; x++) {
      if (solid(x, y) && solid(x - 2, y) && solid(x + 2, y) && solid(x, y - 2) && solid(x, y + 2)) cand.push([x, y]);
    }
    const n = Math.max(14, Math.min(24, Math.round(cand.length / 80))) + (Math.random() * 5 | 0);
    F.spots = [];
    for (let tries = 0; tries < 1200 && F.spots.length < n && cand.length; tries++) {
      const [x, y] = pickOne(cand);
      const minD = tries < 800 ? 7 : 4;
      if (F.spots.some(s => (s.lx - x) ** 2 + (s.ly - y) ** 2 < minD * minD)) continue;
      const r = 2 + (Math.random() < 0.45 ? 1 : 0);
      const blobs = [[0, 0, r]];
      for (let k = 0; k < 2; k++) blobs.push([Math.round(rand(-2.5, 2.5)), Math.round(rand(-1.5, 1.5)), r - 1]);
      F.spots.push({ lx: x, ly: y, r, blobs, st: 0, foam: 1, t: 9, dry: rand(-0.7, 0), seed: rand(0, 10), drip: Math.random() < 0.5 ? 1 + (Math.random() * 3 | 0) : 0, dripX: Math.round(rand(-1, 1)) });
    }
    // where the rubber duck rides: a spot on the roof
    if (cur.vi != null) { const [dx, dy] = DUCK[V[cur.vi].kind]; cur.duck = [OX + dx, OYB - V[cur.vi].h + dy]; }
    else {
      const dx = OX + Math.round(cur.len * 0.38);
      let top = OYB - cur.h;
      for (let y = OYB - cur.h; y < OYB; y++) if (solid(dx, y) && solid(dx + 2, y)) { top = y; break; }
      cur.duck = [dx, top + 1];
    }
  }
  function newVehicle(kind) {
    let c = measure(kind);
    if (!c) { kind = 'fire'; c = measure('fire'); }
    cur = c; F.kind = kind;
    if (c.vi != null) F.vi = c.vi;
    fitVehicle();
    F.state = 'arrive'; F.step = 0; F.t = 0; F.x = -OW * Z - 10; F.jump = 0; F.arch = 0; F.blow = 0;
    F.held = null; F.spray = 0; F.idle = 0; F.notes = 0; F.honked = false; F.doneT = 0; F.said = false;
    words = [];
    for (const b of brushes) { b.x = b.tx = b.home; b.busy = 0; }
    makeSpots();
    if (c.vi != null) say(pick(V[c.vi].kind), true); else if (c.hello) setTimeout(() => { if (scene === 'wash') play(c.hello); }, 300);
  }
  const want = () => [0, 1, 2][F.step];
  const left = () => F.spots.filter(s => s.st === want()).length;

  /* ---------- comic words ---------- */
  function word(s, x, y, c) {
    if (T - F.wordT < 1.2 && s !== 'SQUEAKY CLEAN!') return;
    F.wordT = T;
    words = words.filter(w => w.s !== s);
    words.push({ s, x, y, c, t: 0, life: s === 'SQUEAKY CLEAN!' ? 99 : 1.4 });
  }
  function drawWord(w) {
    const uw = W - L.safeL - L.safeR - 6;
    let z = 3;
    while (z > 1 && textWidth(w.s, z) > uw) z--;
    const zz = w.t < 0.12 ? z + 1 : z, tw = textWidth(w.s, zz);
    const x = Math.round(Math.max(L.safeL + 3, Math.min(W - L.safeR - tw - 3, w.x - tw / 2)));
    const y = Math.round(Math.max(L.safeT + 3, w.y - Math.min(w.t, 0.6) * 10));
    const o = Math.max(1, zz >> 1);
    alpha(Math.max(0, Math.min(1, (w.life - w.t) / 0.3)), () => {
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [0, 2], [1, 2], [-1, 2]]) text(w.s, x + ox * o, y + oy * o, zz, INK);
      if (w.rainbow) [...w.s].forEach((ch, i) => text(ch, x + i * 4 * zz, y, zz, RAINBOW[(i + Math.floor(T * 8)) % 6]));
      else text(w.s, x, y, zz, w.c);
    });
  }

  /* ---------- cleaning ---------- */
  function note(kind) {
    if (T - F.lastNote < 0.06) return;
    F.lastNote = T;
    const f = NOTES[F.notes++ % NOTES.length];
    if (kind === 0) { tone('sine', f, 0, 0.1, 0.12, f * 1.4); noise(0, 0.06, 0.05, 2600, 2); }
    else if (kind === 1) tone('sine', f, 0, 0.14, 0.12, f * 0.6);
    else { tone('triangle', f * 2, 0, 0.3, 0.07); tone('sine', f * 4, 0.04, 0.22, 0.03); }
  }
  function convert(s) {
    const [sx, sy] = spotXY(s);
    if (F.step === 0) {
      s.st = 1; s.foam = 1; s.t = 0; F.rollFast = 0.7;
      addBubble(sx + rand(-4, 4), sy - 4, rand(2, 4));
      if (Math.random() < 0.6) addBubble(sx + rand(-6, 6), sy - 2, rand(2, 3));
      spawn(4, () => ({ x: sx, y: sy, vx: rand(-30, 30), vy: rand(-40, -10), g: 120, life: 0.5, max: 0.5, s: 2, c: '#ffffff' }));
      note(0);
      if (Math.random() < 0.25) play('bubble', rand(0.9, 1.3), 0.7);
    } else if (F.step === 2) {
      s.st = 3; s.t = 0;
      sparkle(sx, sy, 7, 6, Math.random() < 0.5 ? '#ffffff' : '#fff27a');
      // the last drops fly off in the wind
      spawn(4, () => ({ x: sx, y: sy, vx: (sx < Y.arch.cx ? -1 : 1) * rand(40, 90), vy: rand(-50, -10), g: 160, life: 0.6, max: 0.6, s: 2, c: Math.random() < 0.5 ? '#6fc8ff' : '#bfe6ff' }));
      note(2);
    }
  }
  // Scrub or polish everything near (x, y); with assist, also the nearest spot within reach.
  function rubAt(x, y, assist) {
    let hit = 0;
    for (const s of F.spots) {
      if (s.st !== want()) continue;
      const [sx, sy] = spotXY(s);
      if ((x - sx) ** 2 + (y - sy) ** 2 < (11 + s.r * Z * 0.5) ** 2) { convert(s); hit++; }
    }
    if (!hit && assist) {
      let best = null, bd = assist * assist;
      for (const s of F.spots) {
        if (s.st !== want()) continue;
        const [sx, sy] = spotXY(s), d = (x - sx) ** 2 + (y - sy) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      if (best) { convert(best); hit++; }
    }
    return hit;
  }
  function aimAt(x, y) {   // the hose snaps to the nearest foam within reach
    let best = null, bd = (onVehicle(x, y, 14) ? 70 : 40) ** 2;
    for (const s of F.spots) {
      if (s.st !== 1) continue;
      const [sx, sy] = spotXY(s), d = (x - sx) ** 2 + (y - sy) ** 2;
      if (d < bd) { bd = d; best = [sx, sy]; }
    }
    [F.aimX, F.aimY] = best || [x, Math.min(y, Y.vyb - 2)];
  }
  function addBubble(x, y, r) {
    if (bubbles.length >= 40) bubbles.shift();
    bubbles.push({ x, y, r, vy: rand(-16, -8), seed: rand(0, 6), life: rand(3, 6) });
  }
  function finish() {
    F.state = 'done'; F.doneT = 0; F.held = null; F.honked = false; F.cheer = 3; F.said = false;
    SFX.fanfare();
    const b = vbox();
    sparkle(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 16);
  }

  /* ---------- the big brushes ---------- */
  function updateBrushes(dt) {
    const scrub = F.state === 'work' && F.step === 0;
    const b0 = vbox(), engaged = scrub && F.held !== null;
    // the brush nearer the finger slides over to it; the other one goes home
    let mover = -1;
    if (engaged) mover = Math.abs(brushes[0].x - F.px) <= Math.abs(brushes[1].x - F.px) ? 0 : 1;
    let whirr = 0;
    brushes.forEach((b, i) => {
      if (i === mover) { b.tx = Math.max(Y.bayX + BW / 2 - 4, Math.min(Y.bayX + Y.bayW - BW / 2 + 4, F.px)); b.cool = 1; }
      else { b.cool -= dt; if (b.cool <= 0) b.tx = b.home; }
      const d = b.tx - b.x, sp = Math.min(Math.abs(d), (i === mover ? 300 : 120) * dt);
      b.x += Math.sign(d) * sp;
      const over = b.x > b0.x - BW / 2 && b.x < b0.x + b0.w + BW / 2;
      b.busy = Math.max(0, b.busy - dt);
      if (i === mover || (scrub && Math.abs(d) > 2 && over)) b.busy = 0.25;
      b.spin += dt * (b.busy > 0 ? 26 : scrub ? 6 : 2.5);
      if (b.busy > 0) whirr = 1;
      if (b.busy > 0 && scrub && over) {
        // scrub the spots under the brush, one at a time so the notes go up the scale
        let hit = null;
        for (const s of F.spots) { if (s.st !== 0) continue; const [sx] = spotXY(s); if (Math.abs(sx - b.x) < BW / 2 + 4) { hit = s; break; } }
        if (hit && T - F.lastNote > 0.07) convert(hit);
        // foam flies off the bristles
        if (Math.random() < dt * 30) {
          const y = rand(b0.y + 4, Math.min(Y.vyb - 4, b0.y + b0.h)), dir = Math.random() < 0.5 ? -1 : 1;
          parts.push({ x: b.x + dir * BW / 2, y, vx: dir * rand(30, 90), vy: rand(-50, -10), g: 160, life: 0.5, max: 0.5, s: 2, c: Math.random() < 0.8 ? '#ffffff' : '#bfe6ff' });
        }
        if (Math.random() < dt * 3) addBubble(b.x + rand(-6, 6), rand(b0.y, b0.y + b0.h), rand(2, 4));
      }
    });
    if (SND && SND.has('brush')) brushLoop(whirr && F.state === 'work' ? 1 : 0, 1 + whirr * 0.1);
    return whirr;
  }

  /* ---------- update ---------- */
  function update(dt) {
    if (F.state === 'off') return;
    F.t += dt;
    const moving = F.state === 'arrive' || F.state === 'exit';
    if (F.state === 'arrive') {
      const tx = targetX();
      const sp = Math.max(30, Math.min(170, (tx - F.x) * 2.5));
      F.x = Math.min(tx, F.x + sp * dt); F.rot += sp * dt / 12; if (cur.vi != null) V[cur.vi].rot += sp * dt / 12;
      if (F.x >= tx) {
        F.state = 'work'; F.idle = 0; F.wig[0] = 1; SFX.brake();
        if (cur.vi != null) { const v = V[cur.vi]; if (v.stopSiren) { v.stopSiren(); v.stopSiren = null; } }
      }
    } else if (F.state === 'exit') {
      const sp = Math.min(240, 30 + F.t * 220);
      F.x += sp * dt; F.rot += sp * dt / 12; if (cur.vi != null) V[cur.vi].rot += sp * dt / 12;
      if (F.x > W + 10) { const k = F.pick || nextKind(F.kind); F.pick = null; newVehicle(k); }
    } else if (F.state === 'work') {
      if (F.held === null) F.idle += dt; else F.idle = 0;
      if (F.step === 1) {
        if (F.held !== null) { F.spray = 0.25; aimAt(F.px, F.py); }
        if (F.spray > 0) {
          F.puddle = Math.min(1, F.puddle + dt * 0.25);
          spawn(3, () => ({ x: F.aimX, y: F.aimY, vx: rand(-40, 40), vy: rand(-60, -10), g: 260, life: 0.45, max: 0.45, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.5 ? '#6fc8ff' : '#ffffff' }));
          for (const s of F.spots) {
            if (s.st !== 1) continue;
            const [sx, sy] = spotXY(s);
            if ((F.aimX - sx) ** 2 + (F.aimY - sy) ** 2 < (15 + s.r * Z) ** 2) {
              s.foam -= dt * 4;
              if (Math.random() < dt * 20) parts.push({ x: sx + rand(-3, 3), y: sy, vx: rand(-8, 8), vy: rand(0, 20), g: 200, life: 0.6, max: 0.6, s: 2, c: '#ffffff' });
              if (s.foam <= 0) {
                s.st = 2; s.t = 0; note(1);
                spawn(5, () => ({ x: sx + rand(-4, 4), y: sy + 2, vx: rand(-6, 6), vy: rand(0, 15), g: 220, life: 0.8, max: 0.8, s: 1, c: '#9fdcff' }));
              }
            }
          }
        }
      } else if (F.step === 2 && F.held !== null) {
        // the rainbow dryer blows: every drop dries a little, the ones near the finger fast
        if (F.blow <= 0) { play('whoosh'); word('WHOOSH!', Y.arch.cx, Y.arch.by - Y.arch.ry - 14, '#9fdcff'); }
        F.blow = 0.3;
        for (const s of F.spots) {
          if (s.st !== 2) continue;
          const [sx, sy] = spotXY(s);
          const near = (F.px - sx) ** 2 + (F.py - sy) ** 2 < 48 * 48;
          s.dry += dt * (near ? 2.6 : 0.5);
          if (Math.random() < dt * 6) parts.push({ x: sx, y: sy, vx: (sx < Y.arch.cx ? -1 : 1) * rand(30, 80), vy: rand(-30, 10), g: 120, life: 0.5, max: 0.5, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.6 ? '#6fc8ff' : '#ffffff' });
          if (s.dry >= 1) convert(s);
        }
      }
      if (F.state === 'work' && !left()) {
        if (F.step === 2) finish();
        else {
          F.state = 'next'; F.nt = 0; F.held = null; F.cheer = 1.4; SFX.chime();
          const b = vbox(); sparkle(b.x + b.w / 2, b.y + b.h / 2, b.w * 0.4, 10, '#ffffff');
          if (F.step === 0) play('splash', 1.1);
        }
      }
    } else if (F.state === 'next') {
      F.nt += dt;
      if (F.nt > 1.1) {
        F.step++; F.state = 'work'; F.idle = 0; F.notes = 0; F.wig[F.step] = 1; SFX.boop(1.3);
        if (F.step === 2) play('whoosh', 0.8, 0.6);
      }
    } else if (F.state === 'done') {
      F.doneT += dt;
      const b = vbox();
      if (!F.said && F.doneT > 0.9) {
        F.said = true; play('squeak'); play('chime', 1, 0.8); setTimeout(() => play('squeak2', 1.2), 380);
        words = []; words.push({ s: 'SQUEAKY CLEAN!', x: b.x + b.w / 2, y: Math.max(L.safeT + 4, b.y - 30), c: '#ffffff', t: 0, life: 99, rainbow: true });
        sparkle(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 18, '#ffffff');
        setTimeout(() => { if (scene === 'wash') say(pick('praise')); }, 1100);
      }
      if (F.doneT > 0.9 && F.doneT < 2.8) confetti(3);
      if (!F.honked && F.doneT > 2) { F.honked = true; if (cur.hello) play(cur.hello); else SFX.honk(); }
      F.jump = F.doneT > 0.9 && F.doneT < 3.3 ? Math.round(Math.abs(Math.sin((F.doneT - 0.9) * 6)) * 4) : 0;
      if (Math.random() < dt * 3) addBubble(rand(b.x, b.x + b.w), b.y + rand(0, 10), rand(2, 4));
      if (F.doneT > 0.9 && Math.random() < dt * 8) sparkle(rand(b.x, b.x + b.w), rand(b.y, b.y + b.h), 2, 2, pickOne(['#ffffff', '#fff27a', '#bfe6ff']));
    }
    if (F.state !== 'done') F.jump = 0;
    F.spray = Math.max(0, F.spray - dt);
    spraySound(F.spray > 0 && F.state === 'work' && F.step === 1 ? 0.32 : 0);
    F.blow = Math.max(0, F.blow - dt);
    blowSound(F.blow > 0 && F.state === 'work' && F.step === 2 ? 1 : 0);
    F.rub = Math.max(0, F.rub - dt);
    rubSound(F.rub > 0 && F.state === 'work' && F.step === 2 && F.held !== null && onVehicle(F.px, F.py, 4) ? 0.18 : F.rub > 0 && F.state === 'work' && F.step === 0 ? 0.12 : 0);
    F.rollFast = Math.max(0, F.rollFast - dt);
    F.spin += dt * (F.rollFast > 0 ? 28 : F.state === 'work' && F.step === 0 ? 7 : 2.5);
    updateBrushes(dt);
    // the dryer arch rises for the last step and stays lit for the happy ending
    const archOn = (F.step === 2 && (F.state === 'work' || F.state === 'next')) || F.state === 'done';
    F.arch = archOn ? Math.min(1, F.arch + dt * 1.4) : Math.max(0, F.arch - dt * 2);
    if (F.spray <= 0) F.puddle = Math.max(0, F.puddle - dt * 0.03);
    F.cheer = Math.max(0, F.cheer - dt);
    F.duckHop = Math.max(0, F.duckHop - dt * 2.5); F.bigDuckHop = Math.max(0, F.bigDuckHop - dt * 2.5);
    for (let k = 0; k < 3; k++) F.wig[k] = Math.max(0, F.wig[k] - dt * 1.5);
    for (const s of F.spots) s.t += dt;
    for (const w of words) w.t += dt;
    words = words.filter(w => w.t < w.life && !(w.life > 50 && F.state !== 'done'));
    if (moving) words = [];
    // foam keeps fizzing out little bubbles
    const foamy = F.spots.filter(s => s.st === 1);
    if (foamy.length && Math.random() < dt * 2.5) { const [sx, sy] = spotXY(pickOne(foamy)); addBubble(sx + rand(-3, 3), sy - 3, rand(1.5, 3.5)); }
    for (const b of bubbles) { b.life -= dt; b.y += b.vy * dt; b.x += Math.sin(T * 2.2 + b.seed) * 7 * dt; }
    bubbles = bubbles.filter(b => {
      if (b.life > 0 && b.y > L.safeT - 10) return true;
      spawn(3, () => ({ x: b.x, y: b.y, vx: rand(-15, 15), vy: rand(-15, 5), g: 0, life: 0.25, max: 0.25, s: 1, c: '#ffffff' }));
      return false;
    });
  }

  /* ---------- input ---------- */
  function stopLoops() { F.held = null; spraySound(0); rubSound(0); blowSound(0); brushLoop(0); }
  function tap(x, y, id) {
    if (inBox(L.homeBtn, x, y)) { stopLoops(); returnHome(F.vi); return true; }
    if (inBox(Y.prev, x, y)) { pickVehicle(-1); return true; }
    if (inBox(Y.next, x, y)) { pickVehicle(1); return true; }
    if (PETS.tap('wash', x, y)) return true;
    if (F.state === 'done') {
      if (F.doneT > 1.8 && inBox(L.againBtn, x, y)) { F.state = 'exit'; F.t = 0; SFX.bell(); return true; }
    } else if (F.state !== 'exit') {
      for (let k = 0; k < 3; k++) if (inBox(Y.tools[k], x, y)) {
        SFX.boop(k === F.step ? 1.3 : 0.8);
        F.wig[F.step] = 1; F.idle = 9;   // show how to use the tool
        return true;
      }
    }
    if (y >= L.palY) return true;
    // pop a bubble
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if ((x - b.x) ** 2 + (y - b.y) ** 2 < (b.r + 8) ** 2) {
        bubbles.splice(i, 1); if (SND && SND.has('pop')) play('pop', rand(0.9, 1.3)); else SFX.pop(); sparkle(b.x, b.y, 4, 5, '#ffffff');
        if (F.state !== 'work') return true;
        break;
      }
    }
    // the rubber duck on the roof of the vehicle, the big duck on the building, the attendant
    if (F.state !== 'off') {
      const [dx, dy] = duckXY();
      if ((x - dx) ** 2 + (y - dy) ** 2 < 14 * 14) { F.duckHop = 1; SFX.quack(); }
    }
    if (Y.duck && Math.abs(x - Y.duck.x) < 18 && y > Y.duck.yb - 30 && y < Y.duck.yb + 4) { F.bigDuckHop = 1; SFX.quack(); return true; }
    if (Math.abs(x - Y.att.x) < 12 && y > Y.att.yb - 26 && y < Y.att.yb + 2) { F.cheer = 1.5; SFX.boop(1.5); return true; }
    if (F.state === 'work') {
      F.held = id; F.px = x; F.py = y; F.drag = 0; F.idle = 0;
      if (F.step === 1) { F.spray = 0.5; aimAt(x, y); if (Math.random() < 0.5) word('SPLASH!', x, y - 30, '#9fdcff'); }
      else if (F.step === 0) { F.rub = 0.25; rubAt(x, y, onVehicle(x, y, 18) ? 9999 : 50); if (onVehicle(x, y, 18)) word(pickOne(['SCRUB!', 'SWISH!']), x, y - 34, '#ffb3da'); }
      else if (onVehicle(x, y, 10)) { F.rub = 0.25; rubAt(x, y, 0); }
      return true;
    }
    addBubble(x, y, rand(2, 4)); SFX.pop();
    return true;
  }
  function move(x, y, id) {
    if (id !== F.held || F.state !== 'work') return;
    const d = Math.hypot(x - F.px, y - F.py);
    F.px = x; F.py = y;
    if (F.step === 1) return;
    if (F.step === 2) {   // the towel polishes the spots it rubs; the dryer does the rest
      if (d > 0.5 && onVehicle(x, y, 4)) { F.rub = 0.15; rubAt(x, y, 0); }
      return;
    }
    if (d > 0.5) F.rub = 0.15;
    F.drag += d;
    if (rubAt(x, y, 0)) F.drag = 0;
    else if (F.drag > 34 && onVehicle(x, y, 22)) { rubAt(x, y, 9999); F.drag = 0; }
  }
  function release(id) { if (id === F.held) F.held = null; }

  /* ---------- drawing helpers ---------- */
  function scaled(x, y, s, fn) { g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(s, s); fn(); g.restore(); }
  function ring(cx, cy, r, c) {
    const n = Math.max(8, Math.round(r * 6));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; R(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 1, c); }
  }
  function drawBubble(x, y, r) {
    alpha(0.3, () => circle(x, y, r, '#dff4ff'));
    alpha(0.9, () => ring(x, y, r, '#ffffff'));
    R(x - r * 0.5, y - r * 0.6, 2, 1, '#ffffff');
  }
  // Tool pictures: 0 sponge, 1 hose nozzle, 2 rainbow dryer, 3 towel with a sparkle.
  function drawTool(k, cx, cy, s) {
    const u = Math.max(1, Math.floor(s / 14));
    cx = Math.round(cx); cy = Math.round(cy);
    if (k === 0) {
      R(cx - 6 * u, cy - 2 * u, 12 * u, 7 * u, '#ffd21f'); R(cx - 6 * u, cy + 3 * u, 12 * u, 2 * u, '#e0a810');
      R(cx - 4 * u, cy, u, u, '#e0a810'); R(cx + u, cy + u, u, u, '#e0a810'); R(cx + 3 * u, cy - u, u, u, '#e0a810'); R(cx - u, cy - u, u, u, '#e0a810');
      circle(cx - 3 * u, cy - 3 * u, 2 * u, '#ffffff'); circle(cx + u, cy - 4 * u, 2 * u, '#ffffff'); circle(cx + 4 * u, cy - 3 * u, Math.max(1, 1.5 * u), '#ffffff');
    } else if (k === 1) {
      R(cx - 6 * u, cy - 3 * u, 8 * u, 3 * u, '#cfd6dd'); R(cx - 6 * u, cy - u, 8 * u, u, '#8b96a1');
      R(cx + 2 * u, cy - 3 * u, 2 * u, 3 * u, '#5b6470');
      R(cx - 5 * u, cy, 3 * u, 5 * u, '#3fb43a'); R(cx - 5 * u, cy + 4 * u, 3 * u, u, '#1f7a2a');
      R(cx - u, cy, u, 2 * u, '#5b6470');
      R(cx + 5 * u, cy - 2 * u, 2 * u, u, '#ffffff'); R(cx + 5 * u, cy - 5 * u, u, 2 * u, '#9fdcff'); R(cx + 7 * u, cy - 4 * u, u, 2 * u, '#9fdcff');
      R(cx + 5 * u, cy + u, u, 2 * u, '#9fdcff'); R(cx + 7 * u, cy, u, 2 * u, '#9fdcff'); R(cx + 8 * u, cy - 2 * u, u, u, '#ffffff');
    } else if (k === 2) {   // a little rainbow arch with a gust of air under it
      const r0 = Math.max(5, Math.round(s * 0.34)), by = cy + Math.round(r0 * 0.45), t = Math.max(1, Math.round(r0 / 5));
      for (let i = 0; i < 4; i++) {
        const r = r0 - i * t, n = Math.max(10, r * 4);
        for (let j = 0; j <= n; j++) { const a = Math.PI * j / n; R(cx + Math.cos(a) * r - t / 2, by - Math.sin(a) * r - t / 2, t, t, RAINBOW[[0, 2, 3, 4][i]]); }
      }
      const ph = Math.floor(T * 6) % 3;
      for (let i = 0; i < 3; i++) R(cx - Math.round(r0 * 0.4) + i * Math.round(r0 * 0.3), by - Math.round(r0 * 0.25) + ((i + ph) % 3) * t, Math.max(2, t * 2), t, '#ffffff');
    } else {
      R(cx - 6 * u, cy - u, 9 * u, 7 * u, '#ff6fb4'); R(cx - 6 * u, cy + 3 * u, 9 * u, u, '#ffffff'); R(cx - 6 * u, cy + 5 * u, 9 * u, u, '#c73d84');
      const sx = cx + 3 * u, sy = cy - 3 * u;
      R(sx - 3 * u, sy, 7 * u, u, '#fff27a'); R(sx, sy - 3 * u, u, 7 * u, '#fff27a'); R(sx - u, sy - u, 3 * u, 3 * u, '#fff27a'); R(sx, sy, u, u, '#ffffff');
    }
  }
  function bubbleIcon(cx, cy, s) {
    const u = s / 12;
    const b = (x, y, r) => { circle(x, y, r, '#ffffff'); circle(x, y, r - 1, '#9fdcff'); R(x - r * 0.5, y - r * 0.5, 2, 2, '#ffffff'); };
    b(cx - 1.5 * u, cy + 1 * u, Math.round(3.2 * u)); b(cx + 3 * u, cy - 2.5 * u, Math.round(2 * u)); b(cx + 3 * u, cy + 3 * u, Math.round(1.4 * u));
  }
  function duckXY() {
    const [dx, dy] = cur.duck;
    return [F.x + dx * Z, Y.vy - F.jump + (dy - 3) * Z];
  }

  /* ---------- the building ---------- */
  function drawBuilding() {
    const x0 = Y.bx0, x1 = Y.bx1, w = x1 - x0, top = Y.top;
    R(x0, top, w, Y.fy - top, '#8fdcf0');
    R(x0, top, 3, Y.fy - top, '#6cc4dc'); R(x1 - 3, top, 3, Y.fy - top, '#6cc4dc');
    // painted bubbles on the wall
    for (let i = 0; i < 9; i++) {
      const bx = x0 + 8 + ((i * 53) % Math.max(10, w - 16)), by = top + 14 + ((i * 37) % Math.max(10, Y.fy - top - 30));
      alpha(0.45, () => ring(bx, by, 2 + (i % 3), '#ffffff'));
    }
    // roof with a white scalloped trim
    R(x0 - 3, top - 5, w + 6, 6, '#2a6fe0'); R(x0 - 3, top - 5, w + 6, 1, '#6fb6ff'); R(x0 - 3, top + 1, w + 6, 2, '#1a3f9a');
    for (let xx = x0 + 1; xx < x1 - 2; xx += 8) { R(xx, top + 3, 7, 2, '#ffffff'); R(xx + 1, top + 5, 5, 1, '#ffffff'); }
    for (const p of Y.ports) {
      circle(p.x, p.y, 13, '#ffffff'); circle(p.x, p.y, 11, '#3b8bd0'); circle(p.x - 2, p.y + 2, 9, '#5aa8e6');
      ring(p.x - 3, p.y + 2, 3, '#ffffff'); ring(p.x + 4, p.y - 3, 2, '#ffffff'); R(p.x - 6, p.y - 7, 3, 2, '#ffffff');
    }
    drawSign();
  }
  function drawSign() {
    const s = Y.sign;
    R(s.x + 2, s.y, s.w - 4, s.h, '#ffd21f'); R(s.x, s.y + 2, s.w, s.h - 4, '#ffd21f');
    R(s.x + 2, s.y + s.h - 2, s.w - 4, 2, '#c99410');
    R(s.x + 4, s.y + 4, s.w - 8, s.h - 8, '#2a6fe0');
    alpha(0.25, () => R(s.x + 4, s.y + 4, s.w - 8, Math.floor((s.h - 8) / 2), '#6fb6ff'));
    const inner = s.h - 8;
    const big = inner >= 76, sc = inner >= 48 && s.w >= 90 ? 2 : 1;
    const picH = big ? inner - 30 : inner;
    const cyb = s.y + 4 + Math.round(picH / 2 + 9 * sc);
    const cx = s.x + s.w / 2;
    scaled(cx - 17 * sc, cyb - 18 * sc, sc, () => drawCar(0, 18, COLOR.pink.c));
    // foam on the roof, drops and bubbles all around
    for (const [dx, dy, r] of [[-8, -14, 3], [-2, -16, 4], [5, -14, 3]]) circle(cx + dx * sc, cyb + dy * sc, r * sc, '#ffffff');
    for (const [dx, dy, r] of [[-26, -12, 3], [-22, -2, 2], [24, -14, 4], [28, -4, 2], [-30, -20, 2], [20, -22, 2]]) {
      if (Math.abs(dx * sc) + r * sc < s.w / 2 - 6) ring(cx + dx * sc, cyb + dy * sc, r * sc, '#ffffff');
    }
    if (big) {   // picture instructions: sponge, hose, rainbow dryer
      const ry = s.y + s.h - 20, step = Math.min(34, (s.w - 20) / 3);
      for (let k = 0; k < 3; k++) {
        const ix = cx + (k - 1) * step;
        const now = F.step === k && (F.state === 'work' || F.state === 'next'), done = k < F.step || F.state === 'done' || F.state === 'exit';
        R(ix - 11, ry - 8, 22, 18, now ? '#ffffff' : '#1a3f9a');
        if (now) R(ix - 9, ry - 6, 18, 14, '#6fb6ff');
        drawTool(k, ix, ry + 1, 16);
        if (done) { R(ix + 5, ry + 4, 2, 2, '#3fb43a'); R(ix + 7, ry + 2, 2, 2, '#3fb43a'); R(ix + 9, ry, 2, 2, '#3fb43a'); R(ix + 3, ry + 2, 2, 2, '#3fb43a'); }
        if (k < 2) { const ax = ix + step / 2; R(ax - 1, ry - 1, 2, 3, '#ffd21f'); R(ax + 1, ry, 1, 1, '#ffd21f'); }
      }
    }
  }
  const bulbs = () => {
    const s = Y.sign, out = [];
    for (let x = s.x + 5; x <= s.x + s.w - 7; x += 8) { out.push([x, s.y + 1]); out.push([x, s.y + s.h - 3]); }
    for (let y = s.y + 9; y <= s.y + s.h - 10; y += 8) { out.push([s.x + 1, y]); out.push([s.x + s.w - 3, y]); }
    return out;
  };
  function drawBay() {
    const x = Y.bayX, w = Y.bayW, t = Y.bayTop, h = Y.fy - t;
    R(x, t, w, h, '#d8f0fa');
    for (let xx = x + 7; xx < x + w; xx += 8) R(xx, t, 1, h, '#bfe2f2');
    for (let yy = t + 7; yy < Y.fy; yy += 8) R(x, yy, w, 1, '#bfe2f2');
    R(x, t, w, 4, '#9cc8dc');
    // gantry with spray nozzles
    R(x + 3, t + 6, w - 6, 3, '#8b96a1'); R(x + 3, t + 6, w - 6, 1, '#cfd6dd');
    for (let xx = x + 10; xx < x + w - 8; xx += 14) R(xx, t + 9, 2, 2, '#5b6470');
    // lamps
    for (const lx of [x + Math.round(w * 0.3), x + Math.round(w * 0.7)]) { R(lx - 4, t + 4, 8, 2, '#5b6470'); R(lx - 3, t + 6, 6, 1, '#fff6c8'); }
    // posts and the striped awning
    for (const px of [x - 5, x + w - 1]) {
      R(px, t - 2, 6, h + 2, '#ffd21f'); R(px, t - 2, 1, h + 2, '#fff27a'); R(px + 5, t - 2, 1, h + 2, '#c99410');
    }
    const ax = x - 9, aw = w + 18, ay = t - 12;
    for (let i = 0; i * 8 < aw; i++) {
      const c = i % 2 ? '#ffffff' : '#ff6fb4', ww = Math.min(8, aw - i * 8);
      R(ax + i * 8, ay, ww, 8, c);
      if (ww >= 6) circle(ax + i * 8 + 3, ay + 8, 3, c);
    }
    R(ax, ay, aw, 1, '#c73d84');
  }
  function drawFloor() {
    R(0, Y.fy, W, L.palY - Y.fy, '#b9c2cc'); R(0, Y.fy, W, 1, '#8f99a5');
    R(Y.bayX, Y.fy, Y.bayW, L.palY - Y.fy, '#a3afbd');
    for (let xx = Y.bayX + 4; xx < Y.bayX + Y.bayW - 4; xx += 12) R(xx, L.palY - 4, 6, 2, '#ffd21f');
    if (F.puddle > 0.02) alpha(0.55 * F.puddle, () => {
      R(Y.bayX + 8, Y.vyb - 2, Y.bayW - 16, 5, '#6fc8ff');
      R(Y.bayX + 20, Y.vyb, 12, 1, '#ffffff'); R(Y.bayX + Y.bayW - 40, Y.vyb + 1, 8, 1, '#ffffff');
    });
  }
  // A tall spinning brush: a fuzzy cylinder of blue and red bristle strips hanging from the gantry.
  const BLUE = ['#1a3f9a', '#2a6fe0', '#6fb6ff'], RED = ['#a3121d', '#e8222b', '#ff8a8a'];
  function drawBrush(b) {
    const top = Y.bayTop + 10, bot = Y.vyb - 1, cx = Math.round(b.x), x = cx - BW / 2;
    const fast = b.busy > 0;
    // trolley on the gantry rail and the axle
    R(cx - 5, Y.bayTop + 4, 10, 6, '#5b6470'); R(cx - 5, Y.bayTop + 4, 10, 1, '#8b96a1');
    circle(cx - 3, Y.bayTop + 5, 1, '#cfd6dd'); circle(cx + 3, Y.bayTop + 5, 1, '#cfd6dd');
    R(cx - 1, top - 1, 2, 4, '#8b96a1');
    // the bristle cylinder: strips wrap round, so they bunch up toward the edges
    for (let c = 0; c < BW; c++) {
      const u = Math.asin(Math.max(-1, Math.min(1, (c + 0.5 - BW / 2) / (BW / 2))));
      const strip = Math.floor((u + b.spin) / (Math.PI / 4)) & 1;
      const shade = c < 2 || c >= BW - 2 ? 0 : c >= 3 && c <= 5 ? 2 : 1;
      R(x + c, top + 3, 1, bot - top - 6, (strip ? RED : BLUE)[shade]);
    }
    // layered tufts and the fuzzy edge
    for (let y = top + 6; y < bot - 4; y += 6) alpha(0.18, () => R(x + 1, y, BW - 2, 1, '#1d1a2b'));
    for (let y = top + 4; y < bot - 4; y += 3) {
      const j = fast ? (Math.floor(b.spin * 2 + y) % 3) : (y % 2);
      const cl = (Math.floor(y / 3 + b.spin) & 1) ? RED[1] : BLUE[1];
      R(x - 1 - j, y, 1 + j, 2, cl); R(x + BW, y + 1, 1 + ((j + 1) % 3), 2, cl);
    }
    R(x, top, BW, 3, '#8b96a1'); R(x, top, BW, 1, '#cfd6dd'); R(x, bot - 3, BW, 3, '#8b96a1');
    if (fast) alpha(0.45, () => { for (let y = top + 8; y < bot - 6; y += 9) R(x + 2 + ((Math.floor(b.spin * 3) + y) % (BW - 6)), y, 3, 1, '#ffffff'); });
  }
  function drawBrushes() { if (F.state !== 'off') brushes.forEach(drawBrush); }
  function drawHose() {
    const x = Y.nozX, t = Y.bayTop + 9;
    const sway = F.step === 1 && F.spray > 0 ? 1 : 0;
    R(x, t, 2, Y.nozY - t, '#3fb43a'); R(x + 1, t, 1, Y.nozY - t, '#1f7a2a');
    R(x - 1 + sway, Y.nozY, 4, 4, '#5b6470'); R(x + sway, Y.nozY + 4, 2, 2, '#cfd6dd');
  }
  // The rainbow dryer: an arch of color bands with blower nozzles, rising out of the floor.
  const archAngles = [0.12, 0.3, 0.5, 0.7, 0.88];
  function archPt(a, inset = 0) { const A = Y.arch; return [A.cx - Math.cos(a * Math.PI) * (A.rx - inset), A.by - Math.sin(a * Math.PI) * (A.ry - inset)]; }
  function drawArch() {
    if (F.arch <= 0.01) return;
    const A = Y.arch, k = ease(Math.min(1, F.arch)), t = 3;
    const rise = Math.round((1 - k) * (A.ry + 10));   // slides up out of the floor
    g.save(); g.beginPath(); g.rect(Y.bayX - 10, 0, Y.bayW + 20, Y.fy + 1); g.clip();
    for (let i = 0; i < 6; i++) {
      const rx = A.rx - i * t, ry = A.ry - i * t, n = Math.round((rx + ry) * 1.8);
      for (let j = 0; j <= n; j++) {
        const a = Math.PI * j / n;
        R(A.cx - Math.cos(a) * rx - 1, A.by + rise - Math.sin(a) * ry - 1, t, t, RAINBOW[i]);
      }
    }
    // little lights chasing round the outside
    const blowing = F.blow > 0;
    for (let j = 0; j < 20; j++) {
      const a = (j + 0.5) / 20, [px, py] = archPt(a, -2), on = (j + Math.floor(T * (blowing ? 14 : 5))) % 4 === 0;
      R(px - 1, py + rise - 1, 2, 2, on ? '#ffffff' : '#fff27a');
    }
    // blower nozzles pointing in at the vehicle
    for (const a of archAngles) {
      const [px, py] = archPt(a, 9), jig = blowing ? Math.floor(T * 30) % 2 : 0;
      R(px - 4, py + rise - 3 + jig, 8, 7, '#5b6470'); R(px - 4, py + rise - 3 + jig, 8, 1, '#cfd6dd');
      R(px - 2, py + rise - 1 + jig, 4, 3, '#1d1a2b');
      if (blowing) R(px - 1, py + rise + jig, 2, 1, '#9fdcff');
    }
    g.restore();
  }
  function drawAir() {   // gusts of air from the nozzles toward the vehicle
    if (F.blow <= 0 || F.arch < 0.9) return;
    const b = vbox(), tx = b.x + b.w / 2, ty = b.y + b.h * 0.45;
    for (const a of archAngles) {
      const [px, py] = archPt(a, 9);
      for (let i = 0; i < 3; i++) {
        const k = (T * 2.2 + i / 3 + a) % 1, x = px + (tx - px) * k * 0.7, y = py + (ty - py) * k * 0.7;
        alpha(0.8 * (1 - k), () => { R(x - 3, y, 6, 1, '#ffffff'); R(x - 1, y + 2, 4, 1, '#dff4ff'); });
      }
    }
  }

  /* ---------- the vehicle ---------- */
  function drawVehicle() {
    if (F.state === 'off') return;
    const moving = F.state === 'arrive' || F.state === 'exit';
    const bob = moving ? (Math.floor(F.x / 7) % 2 ? 0 : -1) : 0;
    const lit = F.state === 'done' || F.state === 'exit';
    paintVehicle(lit, bob, cur.vi != null ? V[cur.vi].rot : F.rot);
    const world = g;
    g = vg;
    const [dx, dy] = cur.duck;
    drawDuck(dx, dy + bob - Math.round(Math.sin(F.duckHop * Math.PI) * 4), false, 1);
    vg.globalCompositeOperation = 'source-atop';
    for (const s of F.spots) {
      const y = s.ly + bob;
      if (s.st === 0) {
        for (const [bx, by, r] of s.blobs) circle(s.lx + bx, y + by, r, MUD[0]);
        R(s.lx, y + 1, 2, 1, MUD[1]); R(s.lx - 1, y - 1, 1, 1, MUD[2]);
        if (s.drip) R(s.lx + s.dripX, y + s.r, 1, s.drip, MUD[0]);
      } else if (s.st === 2) {
        const k = Math.max(0, s.dry);   // drops shrink as they dry
        R(s.lx, y, 1, k > 0.5 ? 1 : 2, '#9fd2ef'); R(s.lx, y, 1, 1, '#ffffff');
        if (k < 0.6) { R(s.lx + 2, y + 1, 1, 1, '#9fd2ef'); R(s.lx - 2, y + 2, 1, 1, '#bfe6ff'); }
      }
    }
    if (F.step === 2 && (F.state === 'work' || F.state === 'next')) {
      const n = F.spots.length || 1, k = F.spots.filter(s => s.st === 2).length / n;
      alpha(0.28 * k, () => R(0, 0, OW, OH, '#a89a84'));
    }
    if (F.state === 'done' && F.doneT < 1.6) {   // a rainbow shimmer sweeps across
      const p = F.doneT / 1.4, bx = -40 + p * (OW + 70);
      alpha(0.55, () => { for (let y = 0; y < OH; y++) for (let i = 0; i < 6; i++) R(bx + (OH - y) * 0.5 + i * 4, y, 4, 1, RAINBOW[i]); });
    } else if (F.state === 'done' || F.state === 'exit') {   // then the white gleam
      const p = ((F.state === 'done' ? F.doneT - 1.6 : 0.5) % 2.4) / 0.9;
      if (p <= 1) {
        const bx = -24 + p * (OW + 30);
        alpha(0.8, () => { for (let y = 0; y < OH; y++) { R(bx + (OH - y) * 0.5, y, 4, 1, '#ffffff'); R(bx + 7 + (OH - y) * 0.5, y, 2, 1, '#ffffff'); } });
      }
    }
    vg.globalCompositeOperation = 'source-over';
    for (const s of F.spots) {
      if (s.st !== 1) continue;
      const grow = Math.min(1, 0.4 + s.t * 5);
      const rr = Math.max(1, Math.round((s.r + 1) * s.foam * grow)), y = s.ly + bob;
      circle(s.lx + 1, y + 1, rr, '#d6e6f2');
      circle(s.lx, y, rr, '#ffffff');
      if (rr >= 2) { circle(s.lx + rr, y - 1, rr - 1, '#ffffff'); circle(s.lx - rr + 1, y + 1, Math.max(1, rr - 2), '#f4f9ff'); }
      R(s.lx - 1, y, 1, 1, '#cfe6f5'); R(s.lx + 1, y - 1, 1, 1, '#cfe6f5');
    }
    g = world;
    alpha(0.25, () => R(F.x + (OX + 3) * Z, Y.vyb - 2, (cur.len - 6) * Z, 3, '#1d1a2b'));
    const prevS = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(vc, Math.round(F.x), Y.vy - F.jump, OW * Z, OH * Z);
    g.imageSmoothingEnabled = prevS;
  }
  function drawStream() {
    const nx = Y.nozX + 1, ny = Y.nozY + 6, tx = F.aimX, ty = F.aimY;
    const cx = (nx + tx) / 2, cy = Math.min(ny, ty) - 10 - Math.abs(tx - nx) * 0.12;
    const n = Math.max(14, Math.floor(Math.hypot(tx - nx, ty - ny) / 1.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const px = u * u * nx + 2 * u * t * cx + t * t * tx, py = u * u * ny + 2 * u * t * cy + t * t * ty;
      R(px - 1, py - 1, 4, 4, '#4fb2f0');
      R(px, py, 2, 2, (i + Math.floor(T * 30)) % 3 ? '#9fdcff' : '#ffffff');
    }
    alpha(0.5, () => circle(tx, ty, 5, '#bfe6ff'));
  }

  /* ---------- scene ---------- */
  SCENES.wash = {
    view: [186, 200],   // drawn close up
    state: F,           // read-only peek for tests
    layout,
    groundY: () => Y.hillY,
    enter(arg) {
      const i = arg && typeof arg.v === 'number' ? arg.v : typeof arg === 'number' ? arg : VI.fire;
      F.vi = V[i] ? i : VI.fire;
      bubbles = []; words = []; F.puddle = 0; F.spin = 0;
      sounds();
      if (SND) { SND.load(); SND.music(true); }
      setClouds(L.safeT + 10, Math.max(L.safeT + 30, Y.top - 26));
      const kind = arg && typeof arg.kind === 'string' && KINDS[arg.kind] && KINDS[arg.kind].ok() ? arg.kind : V[F.vi].kind;
      newVehicle(kind);
    },
    leave() {
      stopLoops(); F.state = 'off'; bubbles = []; words = [];
      if (SND) SND.music(false);
      const v = V[F.vi]; if (v.stopSiren) { v.stopSiren(); v.stopSiren = null; }
    },
    update, tap, move, release,
    drawWorld() {
      drawHills(Y.hillY, Y.fy);
      drawBuilding();
      drawHeli();
      drawBay();
      drawArch();
      drawFloor();
      drawHose();
      drawVehicle();
      drawBrushes();
      if (Y.duck) scaled(Y.duck.x, Y.duck.yb - Math.round(Math.sin(F.bigDuckHop * Math.PI) * 6), 4, () => drawDuck(0, 0, false, 1));
      const done = F.state === 'done' || F.state === 'next' || F.cheer > 0;
      if (!Y.att.roof) { const x0 = Y.att.x + 10, x1 = Math.min(W - L.safeR - 8, Y.att.x + 46); if (x1 - x0 > 12) PETS.draw('wash', { y: Y.att.yb, x0, x1, who: x1 - x0 > 30 ? ['cat', 'vizsla', 'husky'] : ['cat', 'husky'] }); }
      else { const x0 = Math.max(Y.bx0 + 40, Y.att.x - 70), x1 = Y.att.x - 12; if (x1 - x0 > 12) PETS.draw('wash', { y: Y.top - 4, x0, x1, who: x1 - x0 > 40 ? ['cat', 'vizsla', 'husky'] : ['cat', 'husky'] }); }   // up on the roof with the attendant
      drawPerson({ type: 'dad', x: Y.att.x, yb: Y.att.yb, dir: -1, pose: done ? 'cheer' : 'wave', skin: SKIN[1], seed: 2, hop: F.state === 'done' && F.doneT > 0.9 && F.doneT < 3.3 ? Math.abs(Math.sin(F.doneT * 7)) * 3 : 0 });
    },
    drawLit() {
      const k = nightK();
      // marquee bulbs around the sign, chasing
      bulbs().forEach(([bx, by], i) => {
        const on = (i + Math.floor(T * 5)) % 3 === 0;
        if (on && k > 0.05) alpha(0.35 * k, () => circle(bx + 1, by + 1, 3, '#fff27a'));
        R(bx, by, 2, 2, on ? '#fff27a' : mix('#fff6c8', '#c9a24a', k));
      });
      if (k > 0.05) {
        alpha(0.15 * k, () => R(Y.sign.x + 4, Y.sign.y + 4, Y.sign.w - 8, Y.sign.h - 8, '#fff6c8'));
        for (const lx of [Y.bayX + Math.round(Y.bayW * 0.3), Y.bayX + Math.round(Y.bayW * 0.7)]) {
          R(lx - 3, Y.bayTop + 6, 6, 1, '#fff6c8');
          for (let j = 0; j < 30; j++) alpha(0.12 * k * (1 - j / 30), () => R(lx - 3 - j * 0.6, Y.bayTop + 7 + j * 2, 6 + j * 1.2, 2, '#fff3b0'));
        }
        if (F.state !== 'off' && cur.vi != null && k > 0.02) {   // headlights, taillights and light bar at the bigger size
          g.save(); g.translate(Math.round(F.x), Y.vy - F.jump); g.scale(Z, Z);
          drawVehicleLights({ i: cur.vi, x: OX, yb: OYB, lit: F.state === 'done' || F.state === 'exit', bob: 0 }, k);
          g.restore();
        }
        if (F.arch > 0.5) alpha(0.25 * k, () => { for (let i = 0; i < 6; i++) { const [px, py] = archPt(0.5, i * 3); R(px - 2, py - 1, 4, 3, RAINBOW[i]); } });
      }
      for (const s of F.spots) {   // a clean, shiny vehicle twinkles
        if (s.st !== 3) continue;
        const ph = (T * 1.3 + s.seed) % 4;
        if (ph < 0.3) { const [x, y] = spotXY(s); R(x - 2, y, 5, 1, '#ffffff'); R(x, y - 2, 1, 5, '#ffffff'); }
      }
      if (F.spray > 0 && F.state === 'work' && F.step === 1) drawStream();
      drawAir();
      for (const b of bubbles) drawBubble(b.x, b.y, Math.round(b.r));
      drawParticles();
    },
    drawUI() {
      drawStrip();
      drawHomeButton();
      for (const [b, d] of [[Y.prev, -1], [Y.next, 1]]) {   // choose another vehicle
        const p = Math.round(Math.sin(T * 3 + d) * 1);
        button({ x: b.x, y: b.y + p, s: b.s }, '#ffd21f', '#c99410');
        const cx = b.x + b.s / 2, cy = b.y + p + b.s / 2, u = Math.max(1, Math.floor(b.s / 12));
        for (let i = 0; i < 4; i++) R(cx + d * (i - 1) * u - (d < 0 ? u : 0), cy - (4 - i) * u, u, (8 - 2 * i) * u, '#ffffff');
        R(d > 0 ? cx - 4 * u : cx, cy - u, 4 * u, 2 * u, '#ffffff');
      }
      if (F.state === 'done' || F.state === 'exit') {
        if (F.state === 'done' && F.doneT > 1.8) drawAgainButton(L.againBtn, '#2a6fe0', '#1a3f9a', bubbleIcon);
      } else {
        for (let k = 0; k < 3; k++) {
          const b = Y.tools[k], now = k === F.step && F.state !== 'arrive', done = k < F.step || (k === F.step && F.state === 'next');
          const lift = now ? Math.round(Math.abs(Math.sin(T * 4)) * 2 + Math.sin(F.wig[k] * 20) * F.wig[k] * 3) : 0;
          const bb = { x: b.x, y: b.y - lift, s: b.s };
          if (done) button(bb, '#3fb43a', '#1f7a2a');
          else if (now) {
            button(bb, TOOL[k].bg, TOOL[k].dark);
            const n = F.spots.length || 1, got = F.spots.filter(s => s.st > k).length;
            const fh = Math.round((bb.s - 5) * got / n);
            if (fh > 0) R(bb.x + 2, bb.y + bb.s - 3 - fh, bb.s - 4, fh, TOOL[k].fill);
          } else button(bb, '#b4bec8', '#8b96a1');
          const icon = () => drawTool(k, bb.x + bb.s / 2 - 1, bb.y + bb.s / 2 + 1, bb.s * 0.8);
          if (!now && !done) alpha(0.55, icon); else icon();
          if (done) {   // check badge
            const cx = bb.x + bb.s - 2, cy = bb.y + 2;
            circle(cx, cy, 5, '#ffffff'); circle(cx, cy, 4, '#3fb43a');
            R(cx - 3, cy, 1, 1, '#ffffff'); R(cx - 2, cy + 1, 1, 1, '#ffffff'); R(cx - 1, cy + 2, 1, 1, '#ffffff');
            R(cx, cy + 1, 1, 1, '#ffffff'); R(cx + 1, cy, 1, 1, '#ffffff'); R(cx + 2, cy - 1, 1, 1, '#ffffff'); R(cx + 3, cy - 2, 1, 1, '#ffffff');
          }
        }
      }
      for (const w of words) drawWord(w);
      if (F.state !== 'work') return;
      if (F.held !== null && F.step === 0) {   // the sponge under the finger
        const wob = Math.round(Math.sin(T * 30));
        drawTool(0, F.px + wob, F.py - 4, 28);
      } else if (F.held !== null && F.step === 2 && onVehicle(F.px, F.py, 4)) {   // the towel under the finger
        const wob = Math.round(Math.sin(T * 30));
        drawTool(3, F.px + wob, F.py - 4, 28);
      } else if (F.held === null && F.idle > 2.5) {   // a ghost shows what to do
        const b = vbox();
        if (F.step === 2) {   // press and hold
          const press = Math.floor(T * 2) % 2;
          alpha(0.75, () => TOY.hand(b.x + b.w / 2, b.y + b.h * 0.45, 2, press));
        } else {
          const hx = b.x + b.w / 2 + Math.sin(T * 2.4) * b.w * 0.32, hy = b.y + b.h * 0.45 + Math.cos(T * 4.8) * 5;
          alpha(0.5 + 0.3 * Math.sin(T * 6), () => drawTool(F.step, hx, hy, 28));
        }
      }
    },
    // test hooks: screen positions of the spots that still need the current step, and a way to
    // start any vehicle in the rotation
    _spots: () => F.spots.filter(s => s.st === want()).map(spotXY),
    _go: kind => { if (KINDS[kind] && KINDS[kind].ok()) newVehicle(kind); },
    _cur: () => cur && { kind: cur.kind, len: cur.len, h: cur.h, Z },
    _brushes: brushes,
    _arrowY: () => Y.next.y + Y.next.s / 2,
  };
})();
