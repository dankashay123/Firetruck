// Ambulance mission: help a hurt kid onto the stretcher, hold "go" to drive down a busy street
// to the hospital, celebrate.
'use strict';
(() => {
  const AMB = VI.amb, ALEN = 62, SPD = 85;          // ambulance length, crew walking speed (px/s)
  const P = {};                                      // scene layout, recomputed in layout()
  const st = { phase: 'arrive', t: 0, round: 0, cam: 0, v: 0, hold: new Set(), fired: {}, kid: null, medSkin: [SKIN[0], SKIN[2]],
    stopSiren: null, auto: false, doors: false, idle: 0, puffT: 0, pressed: false, wantHelp: false, kidHop: 0, savedClouds: null, lastType: '',
    peds: [], birds: [], lots: [], statics: [] };
  let rumble = null;

  const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const BALLOONS = ['red', 'yellow', 'blue', 'pink', 'purple', 'orange', 'green'];
  const HAIR = ['#5a3a22', '#2b1d14', '#c98a3a', '#e3b85a', '#8a3a1a'];
  const ADULTS = ['mom', 'dad', 'gran', 'chef', 'mom', 'dad'];
  const KIDS = ['kid', 'kid2', 'kid3'];
  const WALLS = [['#ffe3b0', '#e8c48a'], ['#ffd0d6', '#e8aab4'], ['#cfe8ff', '#a8c8ea'], ['#d8f0c0', '#b4d39a'], ['#fff3a8', '#e0d07a']];
  const ROOFS = ['#c8432f', '#3f66b8', '#7a4a2a', '#8a4fd9', '#2f8a4a'];
  const CATS = ['#9aa3ad', '#f57a12', '#2f3240', '#e9e2d0'];
  const WARM_WIN = '#ffd98a', WARM_IN = '#fff1c4';
  const isChild = t => KIDS.includes(t);

  function once(key, cond, fn) { if (cond && !st.fired[key]) { st.fired[key] = true; fn(); } }
  function stopSiren() { if (st.stopSiren) { st.stopSiren(); st.stopSiren = null; } }
  function click(f = 220) { tone('square', f, 0, 0.05, 0.06); tone('square', f * 1.5, 0.07, 0.05, 0.05); }

  /* ---------- paths the crew walks along ---------- */
  function pathLen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }
  function pathAt(pts, k) {   // -> [x, y, dir]
    let d = clamp01(k) * pathLen(pts);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], l = Math.hypot(x1 - x0, y1 - y0);
      if (d <= l || i === pts.length - 1) { const f = l ? Math.min(1, d / l) : 1; return [lerp(x0, x1, f), lerp(y0, y1, f), x1 >= x0 ? 1 : -1]; }
      d -= l;
    }
    return [pts[0][0], pts[0][1], 1];
  }
  // stretcher center: starts inside the ambulance, out the back doors, up onto the sidewalk, along to the target
  const crewPath = tx => [[P.ax + 44, P.ayb], [P.ax - 8, P.ayb], [P.ax + 24, P.walkY], [tx, P.walkY]];

  function helpPlan() { const out = crewPath(P.kx - 40); return { out, d: pathLen(out) / SPD, o: 0.45, pk: 0.9 }; }
  function helpState() {
    const { out, d, o, pk } = helpPlan(), t = st.t;
    if (t < o) return { crew: null, kid: 'bench' };
    if (t < o + d) { const [x, y, dir] = pathAt(out, (t - o) / d); return { crew: [x, y, dir, true], kid: 'bench' }; }
    if (t < o + d + pk) {
      const e = out[out.length - 1], hk = clamp01((t - o - d - 0.15) / 0.55);
      return { crew: [e[0], e[1], 1, false], kid: hk >= 1 ? 'stretcher' : hk > 0 ? 'hop' : 'bench', hk };
    }
    if (t < o + 2 * d + pk) { const [x, y, dir] = pathAt(out.slice().reverse(), (t - o - d - pk) / d); return { crew: [x, y, dir, true], kid: 'stretcher' }; }
    return { crew: null, kid: 'gone' };
  }
  function parkPlan() {
    const path = crewPath(P.doorX), d = pathLen(path) / SPD, a = 0.8;
    const fadeEnd = a + d + 0.5, e = fadeEnd + 2.0, c = e + 1.6;
    return { path, d, a, fadeEnd, e, c, closeAt: a + pathLen(path.slice(0, 3)) / SPD + 0.1 };
  }

  /* ---------- layout ---------- */
  function layout() {
    P.portrait = H > W * 1.2;
    const pr = P.portrait;
    P.ayb = L.laneY;
    P.side = pr ? 16 : 10;                      // sidewalk depth
    P.bY = L.roadY - P.side;                    // buildings stand here
    P.walkY = L.roadY - 2;                      // front walking lane (crew, pedestrians)
    P.backY = P.bY + (pr ? 5 : 3);              // back of the sidewalk (bench, bus stop)
    P.lanes = [P.walkY, P.walkY - (pr ? 6 : 3)];
    P.skyTop = pr ? Math.max(L.sunY + 36, L.safeT + Math.round((H - L.safeT) * 0.3)) : L.safeT + 34;   // where the town's rooftops reach
    P.maxBH = Math.max(50, P.bY - P.skyTop);
    P.hz = P.bY - (pr ? 40 : 22);
    P.treeR = pr ? 15 : 11;
    P.ax = Math.max(L.safeL + 36, Math.round(W * 0.3 - ALEN / 2));
    P.kx = Math.round(P.ax + ALEN + Math.min(110, (W - L.safeR - P.ax - ALEN) * 0.5));
    P.camEnd = Math.round(Math.max(W * 3, 1000));
    P.hx = P.ax + 22;
    P.hw = Math.max(120, Math.min(pr ? 230 : 210, W - L.safeR - 6 - P.hx));
    P.hh = pr ? clamp(P.bY - P.skyTop - 4, 100, 280) : Math.max(70, P.bY - L.safeT - 30);
    P.doorX = P.hx + Math.round(P.hw * 0.62);
    P.lampH = pr ? 50 : 38;
    P.zoneA = Math.max(P.kx + 96, L.sunX + 34);   // busy street starts clear of the sun
    P.zoneB = P.camEnd + P.hx - 56;
    st.cam = Math.min(st.cam, P.camEnd);
    buildStreet();
    if (scene === 'amb') setClouds(L.safeT + 12, Math.max(L.safeT + 40, P.skyTop - (pr ? 30 : 4)));
  }

  /* ---------- the street: shops, parks, bus stop (fixed per round) ---------- */
  const LOTW = { bakery: 66, icecream: 66, toy: 66, flower: 66, apt: 50, fountain: 96, playground: 96, bus: 62, garden: 70 };
  function shuffled(list, seed) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(hsh(seed + i * 1.37) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function person(x, y, type, pose, seed, dir) {
    return { x, y, type, pose, seed, dir, skin: SKIN[Math.floor(hsh(seed + 0.3) * SKIN.length)], hair: HAIR[Math.floor(hsh(seed + 0.7) * HAIR.length)], wave: 0, hop: 0, cheered: false };
  }
  function buildStreet() {
    const r0 = st.round * 31.7 + 3;
    const shops = shuffled(['bakery', 'icecream', 'toy', 'flower'], r0);
    const extras = shuffled(['fountain', 'bus', 'apt', 'playground', 'garden', 'bus', 'apt'], r0 + 50);
    const lots = [], statics = [];
    let x = P.zoneA, i = 0;
    while (true) {
      const kind = i % 2 === 0 ? shops[(i / 2) % 4] : extras[((i - 1) / 2) % extras.length];
      const w = LOTW[kind], seed = r0 + i * 7.13;
      if (x + w > P.zoneB) break;
      const lot = { kind, x, w, seed, h: Math.round(P.maxBH * (0.72 + hsh(seed + 1) * 0.28)) };
      lots.push(lot);
      const by = P.backY;
      if (kind === 'bus') {
        statics.push(person(x + 25, by - 8, pickBy(ADULTS, seed + 2), 'sit', seed + 2, hsh(seed + 3) < 0.5 ? 1 : -1));
        statics.push(person(x + 46, by, pickBy(ADULTS, seed + 4), 'stand', seed + 4, -1));
        if (hsh(seed + 5) < 0.7) statics.push(person(x + 6, by, pickBy(KIDS, seed + 6), 'stand', seed + 6, 1));
      } else if (kind === 'bakery') statics.push(person(x + 51, by, 'chef', 'stand', seed + 2, -1));
      else if (kind === 'icecream') statics.push(person(x + 20, by, pickBy(KIDS, seed + 2), 'eat', seed + 2, 1));
      else if (kind === 'flower') statics.push(person(x + 51, by, 'mom', 'stand', seed + 2, -1));
      const gap = 6 + Math.floor(hsh(seed + 9) * 16);
      if (gap >= 14 && x + w + gap < P.zoneB) lots.push({ kind: 'tree', x: x + w + (gap >> 1), w: 0, seed });
      x += w + gap; i++;
    }
    st.lots = lots; st.statics = statics;
  }
  const pickBy = (list, seed) => list[Math.floor(hsh(seed) * list.length)];

  /* ---------- pedestrians (a small recycled pool) ---------- */
  function spawnPed(p, x) {
    const r = Math.random();
    p.kind = r < 0.45 ? 'single' : r < 0.62 ? 'dog' : r < 0.8 ? 'balloon' : 'pair';
    p.type = p.kind === 'balloon' ? pickOne(KIDS) : p.kind === 'single' && Math.random() < 0.3 ? pickOne(KIDS) : pickOne(ADULTS);
    p.type2 = pickOne(KIDS);
    p.skin = pickOne(SKIN); p.skin2 = pickOne(SKIN); p.hair = pickOne(HAIR);
    p.balloon = COLOR[pickOne(BALLOONS)].c; p.dogC = pickOne(['#a86b3a', '#e9e2d0', '#5a3a22', '#2f3240']);
    p.vx = (Math.random() < 0.5 ? -1 : 1) * rand(9, 15);
    p.lane = Math.random() < 0.5 ? 0 : 1;
    p.x = x; p.on = true; p.wave = 0; p.hop = 0; p.cheered = false; p.seed = Math.random() * 10;
  }
  function initPeds() {
    const n = P.portrait ? 6 : 9, span = Math.max(W * 1.4, 300);
    st.peds = Array.from({ length: n }, (_, i) => { const p = {}; spawnPed(p, P.zoneA + 20 + i * span / n + rand(0, 20)); return p; });
    st.birds = Array.from({ length: 4 }, () => ({ x: rand(0, W), y: rand(L.safeT + 16, Math.max(L.safeT + 30, P.skyTop)), vx: rand(8, 16), s: Math.random() * 6 }));
  }
  function updatePeds(dt) {
    const camR = st.cam + W;
    for (const p of st.peds) {
      p.wave = Math.max(0, p.wave - dt); p.hop = Math.max(0, p.hop - dt);
      if (!p.on) { if (camR + 60 < P.zoneB && camR + 20 > P.zoneA) spawnPed(p, camR + rand(15, 60)); continue; }
      if (p.wave <= 0 && p.hop <= 0) p.x += p.vx * dt;
      const sx = p.x - st.cam;
      if (sx < -40 || p.x < P.zoneA) {
        if (camR + 60 < P.zoneB) spawnPed(p, camR + rand(15, 60)); else p.on = false;
      } else if (sx > W + 70 || p.x > P.zoneB) {
        if (st.cam - 30 > P.zoneA) { spawnPed(p, st.cam - rand(20, 40)); p.vx = Math.abs(p.vx); } else if (p.x > P.zoneB) p.on = false;
      }
    }
    for (const p of st.statics) { p.wave = Math.max(0, p.wave - dt); p.hop = Math.max(0, p.hop - dt); }
    for (const b of st.birds) {
      b.x += (b.vx - st.v * 0.35) * dt;
      if (b.x < -12) { b.x = W + 10; b.y = rand(L.safeT + 16, Math.max(L.safeT + 30, P.skyTop)); }
      if (b.x > W + 12) b.x = -10;
    }
    // everyone waves when the ambulance goes by with its siren on
    const siren = st.phase === 'drive' && st.v > 8, ac = P.ax + ALEN / 2;
    const check = (p, sx) => {
      const d = Math.abs(sx - ac);
      if (siren && d < 64 && !p.cheered) { p.cheered = true; p.wave = 1.5 + Math.random() * 0.5; }
      if (d > 110) p.cheered = false;
    };
    for (const p of st.peds) if (p.on) check(p, p.x - st.cam);
    for (const p of st.statics) check(p, p.x - st.cam);
  }

  /* ---------- phases ---------- */
  function enter() {
    stopSiren();
    st.round++;
    const type = pickOne(KIDS.filter(k => k !== st.lastType)); st.lastType = type;
    st.kid = { type, skin: pickOne(SKIN), hair: pickOne(HAIR), balloon: COLOR[pickOne(BALLOONS)].c };
    st.medSkin = [pickOne(SKIN), pickOne(SKIN)];
    Object.assign(st, { phase: 'arrive', t: 0, cam: 0, v: 0, fired: {}, auto: false, doors: false, idle: 0, puffT: 0, pressed: false, wantHelp: false, kidHop: 0 });
    st.hold.clear();
    if (!st.savedClouds) st.savedClouds = clouds;
    layout();
    initPeds();
    st.stopSiren = siren('amb');
    say(pick('amb'), true);
  }
  function leave() {
    stopSiren();
    if (rumble) rumble(0);
    st.hold.clear();
    if (st.savedClouds) { clouds = st.savedClouds; st.savedClouds = null; }
  }
  function startHelp() {
    st.phase = 'help'; st.t = 0; st.fired = {};
    SFX.pop(); say(pick('amb'));
    sparkle(P.kx, P.backY - 20, 12, 8);
  }

  function ambX() {
    if (st.phase !== 'arrive') return P.ax;
    const k = clamp01(st.t / 2.2);
    return lerp(-ALEN - 10, P.ax, 1 - (1 - k) ** 3);
  }
  function exhaust(dt, v) {
    st.puffT -= dt;
    if (v > 3 && st.puffT <= 0) {
      st.puffT = 0.13;
      parts.push({ x: ambX() - 2, y: P.ayb - 7 + rand(-1, 1), vx: -14 - v * 0.35, vy: rand(-10, -4), g: 0, life: 0.7, max: 0.7, s: 2, c: '#d6d9df' });
    }
  }

  function update(dt) {
    st.t += dt;
    st.kidHop = Math.max(0, st.kidHop - dt);
    const t = st.t, ph = st.phase;
    if (!rumble) rumble = noiseLoop(110, 0.7);
    if (ph !== 'drive') rumble(0);
    updatePeds(dt);

    if (ph === 'arrive') {
      const k = clamp01(t / 2.2);
      exhaust(dt, (1 - k) * 120);
      once('brake', k > 0.7, () => SFX.brake());
      if (k >= 1) {
        stopSiren();
        st.phase = 'wait'; st.t = 0;
        if (st.wantHelp) startHelp();
      }
    } else if (ph === 'help') {
      const { d, o, pk } = helpPlan();
      once('open', t > 0.1, () => { st.doors = true; click(260); });
      once('out', t > o, () => SFX.boop(0.9));
      once('hop', t > o + d + 0.15, () => SFX.boop(1.3));
      once('lay', t > o + d + 0.7, () => { SFX.pop(); sparkle(P.kx - 40, P.walkY - 18, 12, 6, '#ffffff'); });
      once('close', t > o + 2 * d + pk + 0.15, () => { st.doors = false; click(200); });
      if (t > o + 2 * d + pk + 0.6) { st.phase = 'drive'; st.t = 0; SFX.chime(); }
    } else if (ph === 'drive') {
      const rem = P.camEnd - st.cam, vmax = clamp(W * 0.35, 90, 150);
      if (!st.auto && rem < W * 0.55) st.auto = true;
      const want = st.hold.size > 0;
      if (st.auto) {
        const vt = Math.max(14, Math.min(vmax, Math.sqrt(2 * 100 * rem)));
        st.v += Math.sign(vt - st.v) * Math.min(Math.abs(vt - st.v), 200 * dt);
      } else if (want) st.v = Math.min(vmax, st.v + 110 * dt);
      else st.v = Math.max(0, st.v - 170 * dt);
      st.cam = Math.min(P.camEnd, st.cam + st.v * dt);
      for (const c of clouds) { c.x -= st.v * 0.08 * dt; if (c.x < -50) c.x = W + 30; }
      if ((st.v > 2 || want) && !st.stopSiren) st.stopSiren = siren('amb');
      st.idle = st.v > 2 || want || st.auto ? 0 : st.idle + dt;
      if (st.idle > 0.5) stopSiren();
      exhaust(dt, st.v);
      rumble(0.03 + 0.15 * st.v / vmax);
      once('brake', st.auto && rem < 45, () => SFX.brake());
      if (st.cam >= P.camEnd) { st.v = 0; stopSiren(); st.phase = 'park'; st.t = 0; st.fired = {}; st.hold.clear(); }
    } else if (ph === 'park' || ph === 'done') {
      const pp = parkPlan();
      once('open', t > 0.4, () => { st.doors = true; click(260); });
      once('out', t > pp.a, () => SFX.boop(0.9));
      once('close', t > pp.closeAt, () => { st.doors = false; click(200); });
      once('in', t > pp.a + pp.d, () => SFX.boop(1.2));
      if (t > pp.fadeEnd && t < pp.e && Math.floor(t * 2.5) !== Math.floor((t - dt) * 2.5)) sparkle(P.doorX, P.walkY - 40, 14, 3, '#ff6fb4');
      once('exit', t > pp.e, () => SFX.chime());
      once('cele', t > pp.c, () => {
        SFX.fanfare(); say(pick('praise'));
        sparkle(P.doorX + 30, P.walkY - 24, 18, 14);
        sparkle(P.doorX - 40, P.walkY - 20, 16, 8, '#ffffff');
      });
      if (t > pp.c && t < pp.c + 1.5) confetti(2);
      if (ph === 'park' && t > pp.c + 1.0) st.phase = 'done';
    }
  }

  /* ---------- drawing: backdrop ---------- */
  const TOWERS = [['#c9d6e8', '#b3c3da'], ['#d8cfe6', '#c3b8d6'], ['#e6d6c8', '#d3c0ae'], ['#cfe0dc', '#b6ccc6']];
  function skyline() {   // far-away towers fill the portrait sky band; slow parallax
    const sp = 34, cam = st.cam * 0.25, k = nightK();
    for (let i = Math.floor((cam - 60) / sp); i * sp - cam < W + 60; i++) {
      const seed = i * 5.3 + 77;
      if (hsh(seed) > 0.85) continue;
      const w = 24 + Math.floor(hsh(seed + 1) * 14);
      const x = Math.floor(i * sp - cam + hsh(seed + 3) * 8), top = Math.floor(P.skyTop + 16 - hsh(seed + 2) * 22);
      const [c, d] = TOWERS[Math.floor(hsh(seed + 4) * TOWERS.length)];
      { R(x, top, w, P.hz + 12 - top, c); R(x + w - 3, top, 3, P.hz + 12 - top, d); R(x - 1, top - 2, w + 2, 2, d); }
      for (let wy = top + 6, r = 0; wy < P.hz - 30; wy += 9, r++) for (let wx = x + 4, q = 0; wx + 4 < x + w - 3; wx += 7, q++) {
        R(wx, wy, 4, 4, d);   // drawn in the world layer so nearer buildings hide them
        if (k > 0.02 && hsh(seed + r * 13.1 + q * 3.7) < 0.45) alpha(k, () => R(wx, wy, 4, 4, '#ffe7a0'));
      }
    }
  }
  function drawBackdrop() {
    const pr = P.portrait, far = st.cam * 0.15, mid = st.cam * 0.4;
    const fs = pr ? 110 : 100;
    for (let k = Math.floor((far - 160) / fs); k * fs - far < W + 160; k++) {
      const r = Math.round((pr ? 60 : 46) + hsh(k * 1.3) * (pr ? 30 : 24));
      circle(k * fs - far, P.hz + r * 0.55, r, '#a6dd8e');
    }
    if (pr) skyline();
    const ms = pr ? 84 : 76;
    for (let k = Math.floor((mid - 120) / ms); k * ms - mid < W + 120; k++) {
      const r = Math.round((pr ? 40 : 30) + hsh(k * 2.7 + 5) * (pr ? 22 : 16));
      circle(k * ms - mid + 30, P.hz + r * 0.62, r, '#8fd877');
    }
    R(0, P.hz, W, P.bY - P.hz, '#6cbf5a');
    // sidewalk
    R(0, P.bY, W, L.roadY - P.bY, '#d9d2c3'); R(0, P.bY, W, 1, '#c2baa8');
    const so = st.cam % 16;
    for (let xx = -so; xx < W; xx += 16) R(xx, P.bY + 1, 1, L.roadY - P.bY - 1, '#c9c1b0');
    if (P.side > 12) R(0, P.bY + 8, W, 1, '#cfc8b8');
    // road with scrolling dashes
    const y = L.roadY, h = L.palY - L.roadY;
    R(0, y, W, h, '#4b4f5c');
    R(0, y, W, 3, '#bdb8ac'); R(0, y + 3, W, 1, '#8f8b80'); R(0, y + h - 3, W, 3, '#bdb8ac');
    const off = st.cam % 20;
    for (let xx = 4 - off; xx < W; xx += 20) R(xx, y + 22, 10, 2, '#ffd21f');
  }
  function drawBirds() {
    for (const b of st.birds) {
      const x = Math.floor(b.x), y = Math.floor(b.y + Math.sin(T * 2 + b.s) * 2), up = Math.floor(T * 6 + b.s) % 2;
      R(x - 1, y, 3, 1, '#3a3d46');
      R(x - 3, y + (up ? -1 : 1), 2, 1, '#3a3d46'); R(x + 2, y + (up ? -1 : 1), 2, 1, '#3a3d46');
    }
  }

  /* ---------- drawing: buildings and props ---------- */
  function house(x, base, w, fl, seed, lit) {
    const hg = 12 + fl * 14, top = base - hg;
    const [wall, shade] = WALLS[Math.floor(hsh(seed) * WALLS.length)], roof = ROOFS[Math.floor(hsh(seed + 1) * ROOFS.length)];
    const wins = [[x + 4, base - 11]];
    for (let f = 1; f < fl; f++) {
      const wy = base - 11 - f * 14;
      wins.push([x + 4, wy], [x + w - 11, wy]);
      if (w >= 42) wins.push([x + (w >> 1) - 3, wy]);
    }
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      wins.forEach(([wx, wy], i) => { if (hsh(seed + i * 3.3) < 0.75) alpha(k, () => { alpha(0.3, () => R(wx - 2, wy - 2, 11, 10, WARM_WIN)); R(wx, wy, 7, 6, WARM_WIN); R(wx + 1, wy + 1, 3, 2, WARM_IN); }); });
      return;
    }
    R(x, top, w, hg, wall); R(x, top, 2, hg, shade);
    R(x + w - 6, top - 9, 4, 8, '#8a5a3a');
    const rows = Math.ceil((w + 6) / 4);
    for (let i = 0; i < rows; i++) R(x - 3 + i * 2, top - 1 - i, w + 6 - i * 4, 1, i ? roof : '#5a2a1a');
    for (const [wx, wy] of wins) { R(wx - 1, wy - 1, 9, 8, '#ffffff'); R(wx, wy, 7, 6, GLASS); R(wx + 3, wy, 1, 6, '#ffffff'); R(wx + 1, wy + 1, 2, 1, '#ffffff'); }
    const dx = x + w - 13;
    R(dx - 1, base - 16, 10, 16, '#ffffff'); R(dx, base - 15, 8, 15, roof); R(dx + 6, base - 8, 1, 1, '#ffd21f');
  }
  function lamp(x, lit) {
    const base = L.roadY, hgt = P.lampH;
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(0.2 * k, () => { for (let i = 0; i < hgt - 2; i += 2) { const w = 4 + i * 0.6; R(x + 7 - w / 2, base - hgt + 3 + i, w, 2, '#fff1a8'); } });
      alpha(k, () => { glow(x + 7, base - hgt + 2, '#fff1a8', 5); R(x + 5, base - hgt + 2, 5, 2, '#fff6b0'); });
      return;
    }
    R(x - 1, base - 3, 4, 3, '#3f434e');
    R(x, base - hgt, 2, hgt, '#5a5f6e');
    R(x, base - hgt, 8, 2, '#5a5f6e'); R(x + 4, base - hgt + 1, 6, 1, '#3f434e'); R(x + 5, base - hgt + 2, 5, 1, '#e9e2b0');
  }
  function lamps(lit) {
    const sp = 170, cam = st.cam;
    for (let k = Math.floor((cam - 40) / sp); k * sp + 60 - cam < W + 20; k++) {
      const wx = k * sp + 60;
      if (wx < P.kx + 90 || wx > P.camEnd + P.ax - 40) continue;
      lamp(Math.floor(wx - cam), lit);
    }
  }
  function fence(x, w, base) {
    R(x, base - 7, w, 1, '#f4f7fb'); R(x, base - 3, w, 1, '#f4f7fb');
    for (let px = x + 1; px < x + w - 1; px += 4) { R(px, base - 9, 2, 9, '#ffffff'); R(px, base - 9, 2, 1, '#dfe6ee'); }
  }
  function fenceCat(x, w, base, seed) {   // a cat strolling back and forth along the fence top
    const tri = ((T * 0.12 + seed) % 2), f = tri < 1 ? tri : 2 - tri;
    drawCat(x + 8 + f * (w - 16), base - 9, tri < 1 ? 1 : -1, CATS[Math.floor(hsh(seed) * CATS.length)]);
  }
  function bench(x, seat, base, back) {   // side-view bench, backrest on side `back`
    const wood = '#a8662f', lite = '#c98a4a', leg = '#5a5f6e';
    R(x + back * 8 - 1, seat - 10, 3, 11, wood);
    R(x - 11, seat + 1, 22, 2, wood); R(x - 11, seat + 1, 22, 1, lite);
    R(x - 10, seat + 3, 2, base - seat - 3, leg); R(x + 8, seat + 3, 2, base - seat - 3, leg);
  }
  const SHOPSTYLE = {
    bakery:   { wall: '#ffe3b0', shade: '#e8c48a', trim: '#b14c06', aw: ['#f57a12', '#fff6e0'], door: '#b14c06' },
    icecream: { wall: '#ffe0ef', shade: '#f0bfd6', trim: '#c73d84', aw: ['#ff6fb4', '#ffffff'], door: '#c73d84' },
    toy:      { wall: '#d4e8ff', shade: '#aecbec', trim: '#1a3f9a', aw: ['#2a6fe0', '#ffd21f'], door: '#2a6fe0' },
    flower:   { wall: '#e4f5d4', shade: '#c4e0ac', trim: '#1f7a2a', aw: ['#3fb43a', '#ffffff'], door: '#1f7a2a' },
  };
  function loaf(x, y) { R(x, y - 3, 7, 3, '#c8873a'); R(x + 1, y - 4, 5, 1, '#e0a55a'); R(x + 2, y - 3, 1, 1, '#f3d29a'); R(x + 4, y - 3, 1, 1, '#f3d29a'); }
  function cone(x, y, c) { for (let i = 0; i < 5; i++) R(x - 2 + (i >> 1), y + i, 5 - i, 1, '#e0a55a'); circle(x, y - 1, 2, c); }
  function teddy(x, y, r) {
    circle(x, y + r, r, '#a86b3a'); circle(x, y - r + 1, r, '#a86b3a');
    circle(x - r, y - 2 * r + 2, Math.max(1, r >> 1), '#a86b3a'); circle(x + r, y - 2 * r + 2, Math.max(1, r >> 1), '#a86b3a');
    R(x - 1, y - r + 2, 3, 2, '#e8c49a'); R(x - 2, y - r, 1, 1, INK); R(x + 2, y - r, 1, 1, INK); R(x, y - r + 2, 1, 1, INK);
  }
  function flowerPot(x, base, seed) {
    R(x - 3, base - 5, 7, 5, '#c8632f'); R(x - 4, base - 6, 9, 1, '#e07a3f');
    const cols = ['#ff6fb4', '#ffd21f', '#e8222b', '#8a4fd9', '#ffffff'];
    for (let j = -1; j <= 1; j++) {
      const c = cols[Math.floor(hsh(seed + j * 2.1) * cols.length)], fx = x + j * 3, fy = base - 10 - (j === 0 ? 2 : 0);
      R(fx, fy + 1, 1, base - 6 - fy - 1, '#3f9a45');
      R(fx - 1, fy, 3, 1, c); R(fx, fy - 1, 1, 3, c); R(fx, fy, 1, 1, '#ffd21f');
    }
  }
  function signIcon(kind, cx, cy) {
    if (kind === 'bakery') { R(cx - 6, cy - 1, 12, 5, '#c8873a'); R(cx - 5, cy - 3, 10, 2, '#d99a4a'); R(cx - 4, cy - 4, 8, 1, '#e0a55a'); for (const d of [-3, 0, 3]) R(cx + d, cy - 2, 1, 2, '#f3d29a'); }
    else if (kind === 'icecream') { cone(cx, cy, '#ff9cc8'); circle(cx, cy - 4, 2, '#8fe3c0'); }
    else if (kind === 'toy') teddy(cx, cy - 1, 2);
    else { for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) circle(cx + dx, cy - 1 + dy, 2, '#ff6fb4'); circle(cx, cy - 1, 1, '#ffd21f'); }
  }
  function shop(l, x, lit) {
    const b = P.bY, w = l.w, gH = 50, h = Math.max(gH + 4, l.h), top = b - h, S = SHOPSTYLE[l.kind];
    const upper = Math.floor((h - gH - 4) / 20), wins = [];
    for (let f = 0; f < upper; f++) { const wy = b - gH - 17 - f * 20; wins.push([x + 8, wy], [x + w - 20, wy], [x + (w >> 1) - 6, wy]); }
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(k, () => {
        wins.forEach(([wx, wy], i) => { if (hsh(l.seed + i * 2.9) < 0.7) { alpha(0.3, () => R(wx - 2, wy - 2, 16, 15, WARM_WIN)); R(wx + 1, wy + 1, 10, 9, WARM_WIN); } });
        alpha(0.35, () => R(x + 2, b - 30, 38, 28, WARM_WIN));
        alpha(0.45, () => R(x + 5, b - 27, 32, 22, WARM_IN));
        R(x + 7, b - 48, w - 14, 10, '#fff6e0'); signIcon(l.kind, x + (w >> 1), b - 43);
      });
      return;
    }
    R(x, top, w, h, S.wall); R(x, top, 2, h, S.shade);
    R(x - 2, top - 3, w + 4, 3, S.trim); R(x - 2, top - 3, w + 4, 1, '#ffffff');
    for (const [wx, wy] of wins) {
      R(wx, wy, 12, 11, '#ffffff'); R(wx + 1, wy + 1, 10, 9, GLASS); R(wx + 6, wy + 1, 1, 9, '#ffffff'); R(wx + 2, wy + 2, 2, 2, '#ffffff');
      if (hsh(wx * 0.37 + wy) < 0.4) { R(wx - 1, wy + 11, 14, 2, '#5aa84c'); R(wx + 1, wy + 10, 1, 1, '#ff6fb4'); R(wx + 6, wy + 10, 1, 1, '#ffd21f'); R(wx + 10, wy + 10, 1, 1, '#ff6fb4'); }
    }
    // picture sign
    R(x + 6, b - 50, w - 12, 14, S.trim); R(x + 7, b - 49, w - 14, 12, '#fff6e0');
    signIcon(l.kind, x + (w >> 1), b - 43);
    // striped awning with scallops
    for (let i = 0; i < w + 4; i += 4) { const c = S.aw[(i >> 2) % 2]; R(x - 2 + i, b - 35, 4, 6, c); R(x - 1 + i, b - 29, 2, 1, c); }
    R(x - 2, b - 35, w + 4, 1, S.trim);
    // shop window with goods
    R(x + 4, b - 28, 34, 24, '#ffffff'); R(x + 5, b - 27, 32, 22, GLASS);
    R(x + 5, b - 15, 32, 1, '#c9a27a'); R(x + 5, b - 6, 32, 1, '#c9a27a');
    const gx = x + 7;
    if (l.kind === 'bakery') { loaf(gx, b - 15); loaf(gx + 10, b - 15); loaf(gx + 20, b - 15); R(gx + 1, b - 9, 6, 2, '#e8a84a'); R(gx + 2, b - 10, 4, 1, '#f3c27a'); R(gx + 11, b - 11, 8, 5, '#ff9cc8'); R(gx + 11, b - 11, 8, 1, '#ffffff'); R(gx + 14, b - 12, 2, 1, '#e8222b'); loaf(gx + 21, b - 6); }
    else if (l.kind === 'icecream') { ['#ff9cc8', '#8fe3c0', '#fff27a', '#a86b45', '#c39bff'].forEach((c, i) => { R(gx + i * 6, b - 9, 5, 3, c); R(gx + i * 6, b - 9, 5, 1, '#ffffff'); }); cone(gx + 4, b - 22, '#ff9cc8'); cone(gx + 14, b - 22, '#8fe3c0'); cone(gx + 24, b - 22, '#fff27a'); }
    else if (l.kind === 'toy') { teddy(gx + 5, b - 21, 3); circle(gx + 17, b - 18, 3, '#e8222b'); R(gx + 14, b - 18, 7, 1, '#ffffff'); R(gx + 23, b - 21, 4, 4, '#ffd21f'); R(gx + 25, b - 25, 4, 4, '#3fb43a'); R(gx + 2, b - 10, 4, 4, '#2a6fe0'); R(gx + 7, b - 10, 4, 4, '#ff6fb4'); R(gx + 15, b - 10, 10, 3, '#e8222b'); circle(gx + 17, b - 7, 1, INK); circle(gx + 23, b - 7, 1, INK); }
    else { for (let i = 0; i < 4; i++) flowerPot(gx + 3 + i * 8, b - 15, l.seed + i); for (let i = 0; i < 3; i++) flowerPot(gx + 6 + i * 9, b - 6, l.seed + 9 + i); }
    R(x + 7, b - 25, 2, 6, '#ffffff');
    // door
    R(x + 43, b - 30, 16, 30, '#ffffff'); R(x + 44, b - 29, 14, 29, S.door); R(x + 46, b - 27, 10, 11, GLASS); R(x + 55, b - 14, 1, 2, '#ffd21f');
    if (l.kind === 'icecream') {   // giant cone on the roof
      const cx = x + (w >> 1);
      R(cx - 1, top - 8, 2, 6, '#7d8794');
      for (let i = 0; i < 16; i++) { const ww = Math.max(1, Math.round(13 - i * 0.75)); R(cx - (ww >> 1), top - 24 + i, ww, 1, i % 4 === 1 ? '#c8873a' : '#e0a55a'); }
      circle(cx, top - 27, 6, '#ff9cc8'); circle(cx - 2, top - 29, 2, '#ffc6e0');
      circle(cx, top - 35, 5, '#8fe3c0'); circle(cx - 1, top - 37, 2, '#c8f5e2');
      R(cx - 1, top - 43, 3, 3, '#e8222b'); R(cx, top - 45, 1, 2, '#3f9a45');
    }
    if (l.kind === 'flower') for (let i = 0; i < 3; i++) flowerPot(x + 10 + i * 11, P.backY, l.seed + 20 + i);
  }
  function apt(l, x, lit) {
    const b = P.bY, w = l.w, h = Math.max(40, Math.round(l.h * 1.05)), top = b - h;
    const [wall, shade] = WALLS[Math.floor(hsh(l.seed + 2) * WALLS.length)];
    const rows = Math.floor((h - 30) / 18), wins = [];
    for (let r = 0; r < rows; r++) { const wy = b - 44 - r * 18; wins.push([x + 7, wy], [x + w - 19, wy]); }
    wins.push([x + 5, b - 22]);
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(k, () => wins.forEach(([wx, wy], i) => { if (hsh(l.seed + i * 4.1) < 0.65) { alpha(0.3, () => R(wx - 2, wy - 2, 16, 15, WARM_WIN)); R(wx + 1, wy + 1, 10, 9, WARM_WIN); R(wx + 2, wy + 2, 3, 3, WARM_IN); } }));
      return;
    }
    R(x, top, w, h, wall); R(x, top, 2, h, shade); R(x - 2, top - 3, w + 4, 3, shade);
    R(x + w - 12, top - 10, 2, 7, '#7d8794'); R(x + w - 16, top - 11, 10, 2, '#7d8794');   // antenna
    const catAt = Math.floor(hsh(l.seed + 6) * (wins.length - 1));
    wins.forEach(([wx, wy], i) => {
      R(wx, wy, 12, 11, '#ffffff'); R(wx + 1, wy + 1, 10, 9, GLASS); R(wx + 1, wy + 5, 10, 1, '#ffffff'); R(wx + 2, wy + 2, 2, 2, '#ffffff');
      if (i < wins.length - 1 && hsh(l.seed + i * 1.9) < 0.35) {   // little balcony with plants
        R(wx - 2, wy + 8, 16, 1, '#5a5f6e'); for (let j = 0; j < 16; j += 3) R(wx - 2 + j, wy + 8, 1, 4, '#5a5f6e'); R(wx - 2, wy + 12, 16, 1, '#5a5f6e');
        R(wx + 9, wy + 5, 3, 3, '#3fb43a'); R(wx + 10, wy + 4, 1, 1, '#ff6fb4');
      } else R(wx - 1, wy + 11, 14, 1, '#ffffff');
      if (i === catAt) drawCat(wx + 6, wy + 11, hsh(l.seed + 7) < 0.5 ? 1 : -1, CATS[Math.floor(hsh(l.seed + 8) * CATS.length)]);
    });
    R(x + w - 20, b - 30, 14, 30, '#ffffff'); R(x + w - 19, b - 29, 12, 29, '#8a5a3a'); R(x + w - 17, b - 27, 8, 8, GLASS); R(x + w - 10, b - 14, 1, 2, '#ffd21f');
  }
  function busStop(l, x) {
    const base = P.backY;
    drawTree(x + 30, P.bY, P.treeR);
    R(x + 6, base - 33, 2, 33, '#5a5f6e'); R(x + 40, base - 33, 2, 33, '#5a5f6e');
    alpha(0.55, () => R(x + 8, base - 31, 32, 20, GLASS));
    R(x + 4, base - 35, 40, 3, '#2a6fe0'); R(x + 4, base - 35, 40, 1, '#6fb6ff');
    R(x + 13, base - 7, 24, 2, '#a8662f'); R(x + 14, base - 5, 2, 5, '#5a5f6e'); R(x + 34, base - 5, 2, 5, '#5a5f6e');
    // bus stop sign: a little bus picture
    R(x + 55, base - 36, 2, 36, '#7d8794');
    circle(x + 56, base - 41, 7, '#2a6fe0'); circle(x + 56, base - 41, 6, '#ffffff');
    R(x + 52, base - 44, 9, 5, '#ffd21f'); R(x + 53, base - 43, 2, 2, GLASS); R(x + 56, base - 43, 2, 2, GLASS); R(x + 59, base - 42, 1, 2, GLASS);
    R(x + 53, base - 39, 2, 1, INK); R(x + 58, base - 39, 2, 1, INK);
  }
  function fountainPark(l, x) {
    const b = P.bY, cx = x + 48;
    drawTree(x + 12, b, P.treeR + 2); drawTree(x + 86, b, P.treeR);
    R(cx - 2, b - 22, 4, 14, '#b4bec8'); R(cx - 8, b - 23, 16, 2, '#cfd6dd'); R(cx - 6, b - 21, 12, 1, '#9aa3ad');
    R(cx - 18, b - 10, 36, 9, '#9aa3ad'); R(cx - 19, b - 11, 38, 2, '#dfe6ee'); R(cx - 16, b - 8, 32, 3, '#6fb6ff');
    R(cx - 1, b - 30 + (Math.floor(T * 6) % 2), 2, 8, '#bfe6ff');
    for (let j = 0; j < 10; j++) {
      const p = (T * 1.2 + j / 10) % 1, side = j % 2 ? 1 : -1;
      R(cx + side * p * 15, b - 27 - Math.sin(p * Math.PI) * 6 + p * 16, 1, 2, '#bfe6ff');
    }
    drawDuck(cx + 26 + Math.round(Math.sin(T * 0.7 + l.seed) * 3), b - 1, false, Math.cos(T * 0.7 + l.seed) > 0 ? 1 : -1);
    const seat = b - 9;
    bench(x + 24, seat, b, -1);
    drawPerson({ type: hsh(l.seed + 4) < 0.6 ? 'gran' : 'dad', x: x + 24, yb: seat, pose: Math.floor(T / 2.2 + l.seed) % 3 === 0 ? 'eat' : 'sit', dir: 1, skin: SKIN[Math.floor(hsh(l.seed + 5) * 4)], seed: 2 });
    fence(x, l.w, b + 2); fenceCat(x, l.w, b + 2, l.seed);
  }
  function playground(l, x) {
    const b = P.bY, cyc = (T * 0.4 + hsh(l.seed)) % 1, sk = SKIN[Math.floor(hsh(l.seed + 2) * 4)];
    drawTree(x + 90, b, P.treeR);
    // slide
    R(x + 8, b - 30, 2, 30, '#f57a12'); R(x + 15, b - 30, 2, 30, '#f57a12');
    for (let r = b - 26; r < b; r += 5) R(x + 8, r, 9, 1, '#f57a12');
    R(x + 8, b - 31, 14, 2, '#e8222b');
    for (let i = 0; i < 24; i++) R(x + 20 + i, b - 30 + Math.round(i * 1.15), 2, 2, i % 6 < 3 ? '#ffd21f' : '#f5c010');
    let kx, ky, pose = 'stand', dir = 1, walk = false;
    if (cyc < 0.35) { kx = x + 12; ky = b - (cyc / 0.35) * 29; walk = true; }
    else if (cyc < 0.45) { kx = x + 12 + (cyc - 0.35) / 0.1 * 8; ky = b - 31; }
    else if (cyc < 0.7) { const f = (cyc - 0.45) / 0.25; kx = x + 22 + f * 22; ky = b - 29 + f * 27; pose = 'slide'; }
    else { const f = (cyc - 0.7) / 0.3; kx = x + 44 - f * 32; ky = b; dir = -1; walk = true; }
    drawPerson({ type: pickBy(KIDS, l.seed + 3), x: kx, yb: ky, pose, dir, walk, skin: sk, seed: 1 });
    // swing
    R(x + 54, b - 32, 2, 32, '#2a6fe0'); R(x + 80, b - 32, 2, 32, '#2a6fe0'); R(x + 54, b - 33, 28, 2, '#1a3f9a');
    const a = Math.sin(T * 2.4 + l.seed) * 0.55, px = x + 68, py = b - 31;
    const sx = px + Math.sin(a) * 20, sy = py + Math.cos(a) * 20;
    for (let i = 0; i <= 10; i++) R(lerp(px, sx, i / 10), lerp(py, sy, i / 10), 1, 1, '#7d8794');
    drawPerson({ type: pickBy(KIDS, l.seed + 4), x: sx, yb: sy, pose: a > 0.2 ? 'cheer' : 'sit', dir: 1, skin: SKIN[Math.floor(hsh(l.seed + 5) * 4)], seed: 3 });
    R(sx - 5, sy, 10, 2, '#a8662f');
  }
  function lots(lit) {
    const cam = st.cam;
    for (const l of st.lots) {
      const x = Math.floor(l.x - cam);
      if (x > W + 60 || x + l.w < -60) continue;
      if (l.kind in SHOPSTYLE) shop(l, x, lit);
      else if (l.kind === 'apt') apt(l, x, lit);
      else if (lit) continue;
      else if (l.kind === 'tree') drawTree(x, P.bY, P.treeR - 2 + Math.floor(hsh(l.seed + 4) * 4));
      else if (l.kind === 'bus') busStop(l, x);
      else if (l.kind === 'fountain') fountainPark(l, x);
      else if (l.kind === 'playground') playground(l, x);
      else if (l.kind === 'garden') {
        drawTree(x + 62, P.bY, P.treeR);
        house(x + 4, P.bY, 52, clamp(Math.round((l.h * 0.7 - 12) / 14), 1, 7), l.seed, false);
        fence(x, l.w, P.bY + 2); fenceCat(x, l.w, P.bY + 2, l.seed + 1);
      }
    }
    if (lit) return;
  }
  function gardenLit() {
    for (const l of st.lots) if (l.kind === 'garden') {
      const x = Math.floor(l.x - st.cam);
      if (x > W + 60 || x + l.w < -60) continue;
      house(x + 4, P.bY, 52, clamp(Math.round((l.h * 0.7 - 12) / 14), 1, 7), l.seed, true);
    }
  }
  // the spot where the kid is waiting: tree, house, bench
  function startSpot(lit) {
    const o = -st.cam;
    if (P.kx + 90 + o < -10) return;
    const fl = P.portrait ? clamp(Math.min(Math.round((P.maxBH * 0.6 - 12) / 14), Math.floor((P.bY - L.sunY - 60) / 14)), 2, 8) : 1;   // stays below the sun
    if (!lit) drawTree(P.ax - 16 + o, P.bY, P.treeR + 3);
    house(P.kx - 24 + o, P.bY, 56, fl, 99 + st.round, lit);
    if (!lit) { drawTree(P.kx + 50 + o, P.bY, P.treeR); bench(P.kx + o, P.backY - 8, P.backY, 1); }
  }

  function hospital(lit) {
    const off = P.camEnd - st.cam, x0 = Math.floor(P.hx + off), w = P.hw, h = P.hh, b = P.bY, top = b - h;
    if (x0 > W + 40 || x0 + w < -40) return;
    const cx = x0 + (w >> 1), doorX = Math.floor(P.doorX + off), gz = 64;
    const cols = Math.max(2, Math.floor((w - 12) / 20)), cw = (w - 12) / cols;
    const rows = Math.max(0, Math.floor((h - gz - 8) / 22));
    const wins = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) wins.push([Math.round(x0 + 6 + c * cw + (cw - 12) / 2), top + 9 + r * 22]);
    for (let wx = x0 + 8; wx + 12 < doorX - 22; wx += 18) wins.push([wx, b - 28]);
    for (let wx = doorX + 24; wx + 12 < x0 + w - 6; wx += 18) wins.push([wx, b - 28]);
    const ts = w >= 140 ? 3 : 2, tw = textWidth('HOSPITAL', ts), signY = b - 60;
    const doorOpen = hospDoorOpen();
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(k, () => {
        wins.forEach(([wx, wy], i) => { if (hsh(i * 1.7 + 4) < 0.85) { alpha(0.3, () => R(wx - 2, wy - 2, 16, 15, WARM_WIN)); R(wx + 1, wy + 1, 10, 9, WARM_WIN); R(wx + 2, wy + 2, 4, 3, WARM_IN); } });
        alpha(0.35, () => circle(cx, top - 15, 14, '#ff5a5a'));
        R(cx - 2, top - 23, 5, 16, '#ff3b3b'); R(cx - 8, top - 17, 17, 5, '#ff3b3b');
        alpha(0.25, () => R(cx - (tw >> 1) - 7, signY - 2, tw + 14, 24, '#ffffff'));
        text('HOSPITAL', cx - (tw >> 1), signY + 3 + (ts === 2 ? 2 : 0), ts, '#ff3b3b');
        R(doorX - 15, b - 30, 30, 30, doorOpen ? WARM_WIN : '#ffe9a0');
        alpha(0.25, () => R(doorX - 21, b - 36, 42, 36, WARM_WIN));
      });
      return;
    }
    R(x0, top, w, h, '#f4f7fb'); R(x0, top, 3, h, '#d5dde6'); R(x0 + w - 2, top, 2, h, '#e2e8ee');
    R(x0 - 3, top - 4, w + 6, 4, '#cfd8e2'); R(x0 - 3, top - 4, w + 6, 1, '#ffffff');
    R(x0, top, w, 3, '#e8222b');
    if (rows) R(x0, b - gz - 2, w, 2, '#e2e8ee');
    // rooftop red cross sign
    R(cx - 7, top - 6, 2, 3, '#9aa3ad'); R(cx + 6, top - 6, 2, 3, '#9aa3ad');
    R(cx - 11, top - 26, 23, 21, '#cfd8e2'); R(cx - 10, top - 25, 21, 19, '#ffffff');
    R(cx - 2, top - 23, 5, 16, '#e8222b'); R(cx - 8, top - 17, 17, 5, '#e8222b');
    for (const [wx, wy] of wins) {
      R(wx, wy, 12, 11, '#9aa3ad'); R(wx + 1, wy + 1, 10, 9, GLASS); R(wx + 1, wy + 5, 10, 1, '#cfd8e2');
      R(wx + 2, wy + 2, 2, 2, '#ffffff'); R(wx - 1, wy + 11, 14, 1, '#cfd8e2');
    }
    R(cx - (tw >> 1) - 5, signY, tw + 10, 20, '#a3121d'); R(cx - (tw >> 1) - 4, signY + 1, tw + 8, 18, '#ffffff');
    text('HOSPITAL', cx - (tw >> 1), signY + 3 + (ts === 2 ? 2 : 0), ts, '#e8222b');
    for (let i = 0; i < 42; i += 4) R(doorX - 21 + i, b - 37, 2, 6, '#e8222b');
    R(doorX - 21, b - 37, 42, 1, '#a3121d');
    R(doorX - 17, b - 31, 34, 31, '#7d8794');
    R(doorX - 15, b - 30, 30, 30, '#3a3d46');
    if (doorOpen) {
      R(doorX - 15, b - 30, 3, 30, GLASS2); R(doorX + 12, b - 30, 3, 30, GLASS2);
      R(doorX - 12, b - 30, 24, 30, '#fbe8c8'); R(doorX - 12, b - 5, 24, 5, '#e6d2ae');
    } else {
      R(doorX - 15, b - 30, 14, 30, GLASS); R(doorX + 1, b - 30, 14, 30, GLASS);
      R(doorX - 12, b - 27, 2, 8, '#ffffff'); R(doorX + 4, b - 27, 2, 8, '#ffffff');
      R(doorX - 3, b - 16, 1, 5, '#5a5f6e'); R(doorX + 2, b - 16, 1, 5, '#5a5f6e');
    }
    circle(x0 + 5, b - 4, 5, '#3f9a45'); circle(x0 + 4, b - 6, 3, '#5bb85a');
    circle(x0 + w - 5, b - 4, 5, '#3f9a45'); circle(x0 + w - 6, b - 6, 3, '#5bb85a');
  }
  function hospDoorOpen() {
    if (st.phase !== 'park' && st.phase !== 'done') return false;
    const pp = parkPlan(), t = st.t;
    return (t > pp.a + pp.d - 0.7 && t < pp.fadeEnd + 0.2) || (t > pp.e - 0.2 && t < pp.e + 1.3);
  }

  /* ---------- drawing: people ---------- */
  function balloon(hx, hy, c, by0) {
    const bx = hx + 4 + Math.round(Math.sin(T * 2 + hx * 0.1) * 2), by = by0;
    for (let i = 0; i <= 14; i++) { const f = i / 14; R(lerp(hx, bx, f) + Math.round(Math.sin(f * Math.PI) * 2), lerp(hy, by + 7, f), 1, 1, '#5a5f6e'); }
    circle(bx, by, 6, c[1]); R(bx - 3, by - 3, 2, 2, c[0]); R(bx - 1, by + 6, 3, 1, c[2]);
  }
  // hand position of the new person sprite
  function handOf(x, yb, type, pose, dir, hop) {
    const o = OUTFITS[type], total = 9 + (o.child ? 5 : 7) + (o.child ? 3 : 4) + 2, top = yb - hop - total;
    if (pose === 'cheer' || pose === 'wave') return [x + (dir > 0 ? 2 : -3), top + 2];
    return [x + (dir > 0 ? 0 : -1), top + 9 + (o.child ? 5 : 7) + 1];
  }
  function drawDog(x, yb, dir, walking, c) {
    const bx = Math.floor(x) - 6, top = Math.floor(yb) - 9, step = walking ? Math.floor(T * 8) % 2 : 0;
    const M = (dx, dy, w, h, col) => R(dir > 0 ? bx + dx : bx + 12 - dx - w, top + dy, w, h, col);
    const dk = mix(c, '#000000', 0.3);
    M(1, 3, 8, 4, c); M(8, 0, 4, 4, c); M(8, 0, 2, 3, dk); M(11, 2, 1, 1, INK); M(10, 1, 1, 1, INK);
    M(0, 1 + (Math.floor(T * 6) % 2), 1, 3, c); M(8, 4, 1, 1, '#e8222b');
    if (step) { M(1, 7, 2, 2, dk); M(6, 7, 2, 2, dk); } else { M(2, 7, 2, 2, dk); M(7, 7, 2, 2, dk); }
  }
  function drawPed(p, sx) {
    const y = P.lanes[p.lane], busy = p.wave > 0 || p.hop > 0;
    const hop = p.hop > 0 ? Math.sin(p.hop / 0.5 * Math.PI) * 7 : 0;
    const dir = p.wave > 0 ? (P.ax + ALEN / 2 > sx ? 1 : -1) : Math.sign(p.vx) || 1;
    const pose = t => busy ? (isChild(t) ? 'cheer' : 'wave') : 'stand';
    if (p.kind === 'pair') {
      const kx = sx - dir * 13;
      drawPerson({ type: p.type2, x: kx, yb: y, dir, pose: pose(p.type2), walk: !busy, skin: p.skin2, hair: p.hair, seed: p.seed + 1, hop });
      if (!busy) R(Math.min(kx, sx) + 4, y - 9, 6, 1, p.skin);
    }
    if (p.kind === 'dog') {
      const dx = sx + dir * 16;
      drawDog(dx, y, dir, !busy, p.dogC);
      const [hx, hy] = handOf(sx, y, p.type, pose(p.type), dir, hop);
      for (let i = 0; i <= 8; i++) R(lerp(hx, dx + dir * 2, i / 8), lerp(hy + 1, y - 5, i / 8) + Math.sin(i / 8 * Math.PI) * 2, 1, 1, '#e8222b');
    }
    if (p.kind === 'balloon') {
      const [hx, hy] = handOf(sx, y, p.type, pose(p.type), dir, hop);
      balloon(hx, hy, p.balloon, y - hop - 38);
    }
    drawPerson({ type: p.type, x: sx, yb: y, dir, pose: pose(p.type), walk: !busy, skin: p.skin, hair: p.hair, seed: p.seed, hop });
  }
  function drawStatic(p, sx) {
    const hop = p.hop > 0 ? Math.sin(p.hop / 0.5 * Math.PI) * 7 : 0;
    const waving = p.wave > 0 && p.pose !== 'sit';
    const dir = waving ? (P.ax + ALEN / 2 > sx ? 1 : -1) : p.dir;
    drawPerson({ type: p.type, x: sx, yb: p.y, dir, pose: waving ? (isChild(p.type) ? 'cheer' : 'wave') : p.pose, skin: p.skin, hair: p.hair, seed: p.seed, hop });
  }
  function drawSidewalkPeople() {
    g.save(); g.translate(-Math.round(st.cam), 0); PETS.draw('amb', { y: P.backY, x0: P.kx + 58, x1: P.kx + 110 }); g.restore();
    const list = [];
    for (const p of st.statics) { const sx = p.x - st.cam; if (sx > -30 && sx < W + 30) list.push([p.y - (p.pose === 'sit' ? -8 : 0) - 20, () => drawStatic(p, sx)]); }
    for (const p of st.peds) { if (!p.on) continue; const sx = p.x - st.cam; if (sx > -40 && sx < W + 40) list.push([P.lanes[p.lane], () => drawPed(p, sx)]); }
    list.sort((a, b) => a[0] - b[0]);
    for (const [, fn] of list) fn();
  }

  function drawStretcher(x, yb, kidOn) {
    x = Math.floor(x); yb = Math.floor(yb);
    R(x - 10, yb - 10, 1, 7, '#7d8794'); R(x + 9, yb - 10, 1, 7, '#7d8794');
    R(x - 11, yb - 3, 3, 3, TIRE); R(x + 8, yb - 3, 3, 3, TIRE);
    R(x - 15, yb - 11, 31, 2, '#9aa3ad');
    R(x - 13, yb - 14, 27, 3, '#ffffff'); R(x - 13, yb - 12, 27, 1, '#cfd8e2');
    if (!kidOn) { R(x + 7, yb - 15, 6, 1, '#eef3f8'); return; }
    const k = st.kid, o = OUTFITS[k.type];
    R(x + 6, yb - 20, 7, 6, k.skin);                                           // head on the pillow
    if (o.hat === 'cap') R(x + 11, yb - 21, 3, 7, o.hatC); else R(x + 11, yb - 21, 3, 7, k.hair);
    R(x + 7, yb - 20, 2, 1, INK); R(x + 9, yb - 17, 2, 1, '#ff9c8a');
    R(x + 2, yb - 19, 4, 5, o.shirt);
    R(x - 11, yb - 19, 14, 5, '#6fb6ff'); R(x - 11, yb - 19, 14, 1, '#a8d4ff');   // blanket
    R(x - 13, yb - 18, 2, 4, o.shoes);
  }
  function drawCrew(sx, sy, dir, walking, kidOn, a = 1) {
    alpha(a, () => {
      const rearA = dir > 0;
      drawPerson({ type: 'medic', x: sx - 21, yb: sy, dir, walk: walking, pose: rearA ? 'carry' : 'stand', skin: st.medSkin[0], seed: 0 });
      drawStretcher(sx, sy, kidOn);
      drawPerson({ type: 'medic', x: sx + 21, yb: sy, dir, walk: walking, pose: rearA ? 'stand' : 'carry', skin: st.medSkin[1], seed: 3 });
    });
  }
  function drawSadKid(x, seat) {
    const k = st.kid, sob = Math.floor(T * 3) % 2, top = seat - 14 - sob;
    drawPerson({ type: k.type, x, yb: seat, pose: 'sit', dir: -1, skin: k.skin, hair: k.hair, seed: 1, hop: sob });
    R(x - 5, seat - sob, 1, 1, '#e8222b');                                      // scraped knee
    R(x - 3, top + 7, 3, 1, k.skin); R(x - 2, top + 7, 1, 1, '#a3121d'); R(x - 3, top + 8, 1, 1, '#a3121d'); R(x - 1, top + 8, 1, 1, '#a3121d');   // frown
    const tf = Math.floor(T * 6) % 4;
    if (tf < 3) R(x - 3, top + 6 + tf, 1, 1, '#4fc3ff');
    if ((Math.floor(T * 6) + 2) % 4 < 3) R(x - 1, top + 6 + (Math.floor(T * 6 + 2) % 4), 1, 1, '#4fc3ff');
  }
  function drawHappyKid(x, yb, pose, walking, hop, dir = 1) {
    const k = st.kid;
    x = Math.floor(x); yb = Math.floor(yb); hop = Math.round(hop);
    const [hx, hy] = handOf(x, yb, k.type, pose, dir, hop);
    balloon(hx, hy, k.balloon, yb - hop - 40);
    drawPerson({ type: k.type, x, yb, pose, dir, walk: walking, skin: k.skin, hair: k.hair, seed: 0, hop });
    R(dir > 0 ? x : x - 3, yb - hop - 4, 3, 1, '#f3c27a');                   // band-aid
  }

  function clipOutAmb(fn) {   // hide whatever is inside the ambulance (going in / out the back doors)
    const x = Math.floor(ambX());
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(x + 1, P.ayb - 40, ALEN + 6, 48); g.clip('evenodd');
    fn();
    g.restore();
  }

  function drawPeople() {
    const ph = st.phase, t = st.t, seat = P.backY - 8;
    if (ph === 'arrive' || ph === 'wait') { drawSadKid(P.kx, seat); return; }
    if (ph === 'help') {
      const s = helpState();
      if (s.kid === 'bench') drawSadKid(P.kx, seat);
      clipOutAmb(() => { if (s.crew) drawCrew(s.crew[0], s.crew[1], s.crew[2], s.crew[3], s.kid === 'stretcher'); });
      if (s.kid === 'hop') {
        const sx = P.kx - 40, k = ease(s.hk);
        drawPerson({ type: st.kid.type, x: lerp(P.kx, sx, k), yb: lerp(seat, P.walkY - 14, k) - Math.sin(s.hk * Math.PI) * 16, pose: 'sit', dir: -1, skin: st.kid.skin, hair: st.kid.hair });
      }
      return;
    }
    if (ph === 'park' || ph === 'done') {
      const pp = parkPlan();
      if (t >= pp.a && t < pp.a + pp.d) {
        const [x, y, dir] = pathAt(pp.path, (t - pp.a) / pp.d);
        clipOutAmb(() => drawCrew(x, y, dir, true, true));
      } else if (t >= pp.a + pp.d && t < pp.fadeEnd) {
        const f = clamp01((t - pp.a - pp.d) / 0.5);
        drawCrew(P.doorX + 8 * f, P.walkY, 1, true, true, 1 - f);
      } else if (t >= pp.e) {
        const fk = clamp01((t - pp.e) / 1.1), fm = clamp01((t - pp.e - 0.35) / 1.2), cele = t >= pp.c;
        const fadeK = clamp01((t - pp.e) / 0.3), fadeM = clamp01((t - pp.e - 0.35) / 0.3);
        if (fm > 0) alpha(fadeM, () => {
          const pose = cele ? 'wave' : 'stand', d = fm >= 1 ? 1 : -1;
          drawPerson({ type: 'medic', x: P.doorX - 50 * ease(fm), yb: P.walkY, dir: d, pose, walk: fm < 1, skin: st.medSkin[0], seed: 2 });
          drawPerson({ type: 'medic', x: P.doorX - 30 * ease(fm), yb: P.walkY, dir: d, pose, walk: fm < 1, skin: st.medSkin[1], seed: 5 });
        });
        alpha(fadeK, () => {
          const hop = st.kidHop > 0 ? Math.sin(st.kidHop / 0.5 * Math.PI) * 9 : cele && t < pp.c + 2.5 ? Math.abs(Math.sin(T * 7)) * 3 : 0;
          const pose = cele ? (ph === 'done' && Math.floor(T / 1.6) % 2 ? 'wave' : 'cheer') : 'stand';
          drawHappyKid(P.doorX + 30 * ease(fk), P.walkY, pose, fk < 1, hop, fk >= 1 && cele ? -1 : 1);
        });
      }
    }
  }

  function drawAmbulance() {
    const x = Math.floor(ambX()), yb = P.ayb, c = COLOR[V[AMB].color].c;
    const moving = st.phase === 'arrive' ? st.t < 2.1 : st.phase === 'drive' && st.v > 20;
    const lit = st.phase === 'drive' ? st.v > 1 || st.hold.size > 0 : st.phase !== 'done';
    const bob = moving && Math.floor(T * 9) % 2 ? 1 : 0;
    drawV(AMB, x, yb, lit, bob, (x + st.cam) / 6);
    if (st.doors) {
      R(x, yb - 29, 3, 22, '#3a3d46');
      R(x - 7, yb - 31, 7, 24, c[2]); R(x - 6, yb - 30, 5, 22, c[1]); R(x - 5, yb - 28, 3, 4, GLASS);
    }
  }

  /* ---------- UI ---------- */
  function hintArrow(x, y) {
    y = Math.floor(y - Math.abs(Math.sin(T * 4)) * 5); x = Math.floor(x);
    const shape = (dx, dy, c) => {
      R(x - 2 + dx, y - 11 + dy, 5, 6, c);
      for (let i = 0; i < 5; i++) R(x - 5 + i + dx, y - 5 + i + dy, 11 - 2 * i, 1, c);
    };
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) shape(dx, dy, '#1d1a2b');
    shape(0, 0, '#ffd21f');
    R(x - 1, y - 10, 1, 4, '#fff6b0');
  }
  function crossIcon(cx, cy, s) {
    const u = Math.max(2, Math.round(s / 11));
    R(cx - u, cy - 3 * u, 2 * u, 6 * u, '#ffffff'); R(cx - 3 * u, cy - u, 6 * u, 2 * u, '#ffffff');
  }
  function drawUI() {
    drawStrip();
    drawHomeButton();
    const ph = st.phase;
    if ((ph === 'arrive' || ph === 'wait') && !st.wantHelp) hintArrow(P.kx - 1, P.backY - 30);
    if (ph === 'drive' && !st.auto) {
      const b = L.againBtn;
      if (st.hold.size) { button({ x: b.x, y: b.y + 2, s: b.s }, '#3fb43a', '#1f7a2a'); drawArrowIcon(b.x + b.s / 2, b.y + 2 + b.s / 2, b.s); }
      else { drawAgainButton(b, '#3fb43a', '#1f7a2a'); if (st.v < 5) hintArrow(b.x + b.s / 2, b.y - 6); }
    }
    if (ph === 'done') drawAgainButton(L.againBtn, '#e8222b', '#a3121d', crossIcon);
  }

  /* ---------- input ---------- */
  function hitKidOnBench(x, y) { return Math.abs(x - P.kx) < 26 && y > P.backY - 50 && y < P.walkY + 10; }
  function tapPerson(x, y) {   // pedestrians and people waiting: hop, wave, boop
    let best = null, bd = 1e9;
    const test = (p, sx, py, half) => {
      if (Math.abs(x - sx) < half && y > py - 34 && y < py + 6) { const d = Math.abs(x - sx); if (d < bd) { bd = d; best = [p, sx, py]; } }
    };
    for (const p of st.statics) test(p, p.x - st.cam, p.y + (p.pose === 'sit' ? 8 : 0), 12);
    for (const p of st.peds) if (p.on) test(p, p.x - st.cam, P.lanes[p.lane], p.kind === 'single' ? 12 : 20);
    if (!best) return false;
    const [p, sx, py] = best;
    p.hop = 0.5; p.wave = Math.max(p.wave, 1.2);
    SFX.boop(rand(0.9, 1.4)); sparkle(sx, py - 28, 9, 6, pickOne(['#fff27a', '#ffffff', '#ffb3da']));
    return true;
  }
  function tap(x, y, id) {
    const ph = st.phase;
    if (inBox(L.homeBtn, x, y)) { SFX.boop(); returnHome(AMB); return true; }
    if (PETS.tap('amb', x, y)) return true;
    if (ph === 'drive') {
      if (!inBox(L.againBtn, x, y, 6) && tapPerson(x, y)) return true;
      if (!st.auto) {
        if (!st.hold.size) { tone('sawtooth', 70, 0, 0.35, 0.07, 140); if (!st.pressed) say(pick('amb'), true); }
        st.hold.add(id); st.pressed = true;
      } else { SFX.pop(); sparkle(x, y, 5, 4, '#ffffff'); }
      return true;
    }
    if (ph === 'done' && inBox(L.againBtn, x, y, 6)) { SFX.boop(); goScene('amb'); return true; }
    if ((ph === 'arrive' || ph === 'wait') && hitKidOnBench(x, y)) {
      if (ph === 'wait') startHelp();
      else if (!st.wantHelp) { st.wantHelp = true; SFX.pop(); sparkle(P.kx, P.backY - 20, 12, 6); }
      return true;
    }
    if (ph === 'done' || (ph === 'park' && st.t > parkPlan().e + 1.2)) {
      if (Math.abs(x - (P.doorX + 30)) < 22 && y > P.walkY - 66 && y < P.walkY + 10) {
        st.kidHop = 0.5; SFX.boop(1.3); sparkle(P.doorX + 30, P.walkY - 30, 12, 6, pickOne(BALLOONS.map(b => COLOR[b].c[0])));
        return true;
      }
      if (x > P.doorX - 60 && x < P.doorX - 20 && y > P.walkY - 28 && y < P.walkY + 8) { SFX.boop(0.8); sparkle(x, y - 8, 10, 5, '#ffffff'); return true; }
    }
    const ax = ambX();
    if (x > ax && x < ax + ALEN && y > P.ayb - 38 && y < P.ayb + 2) { SFX.beep(); sparkle(ax + 40, P.ayb - 34, 8, 4, '#ff7a6b'); return true; }
    SFX.pop(); sparkle(x, y, 5, 4, '#ffffff');
    return true;
  }
  function release(id) { st.hold.delete(id); }

  SCENES.amb = {
    view: [186, 200],
    layout, enter, leave, update, tap, release,
    groundY: () => P.hz,
    drawWorld() {
      drawBackdrop();
      lots(false);
      startSpot(false);
      hospital(false);
      drawBirds();
      drawSidewalkPeople();
      drawPeople();
      drawAmbulance();
      lamps(false);
    },
    drawLit() {
      lots(true); gardenLit(); startSpot(true); hospital(true); lamps(true);
      drawParticles();
    },
    drawUI,
  };
})();
