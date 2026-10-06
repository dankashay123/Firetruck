// Ambulance mission: help a hurt kid onto the stretcher, hold "go" to drive to the hospital, celebrate.
'use strict';
(() => {
  const AMB = VI.amb, ALEN = 62, SPD = 85;          // ambulance length, crew walking speed (px/s)
  const P = {};                                      // scene layout, recomputed in layout()
  const st = { phase: 'arrive', t: 0, round: 0, cam: 0, v: 0, hold: new Set(), fired: {}, kid: null, medSkin: [SKIN[0], SKIN[2]],
    stopSiren: null, auto: false, doors: false, idle: 0, puffT: 0, pressed: false, wantHelp: false, kidHop: 0, savedClouds: null, lastType: '' };
  let rumble = null;

  const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const BALLOONS = ['red', 'yellow', 'blue', 'pink', 'purple', 'orange', 'green'];
  const HAIR = ['#5a3a22', '#2b1d14', '#c98a3a', '#e3b85a', '#8a3a1a'];
  const WALLS = [['#ffe3b0', '#e8c48a'], ['#ffd0d6', '#e8aab4'], ['#cfe8ff', '#a8c8ea'], ['#d8f0c0', '#b4d39a'], ['#fff3a8', '#e0d07a']];
  const ROOFS = ['#c8432f', '#3f66b8', '#7a4a2a', '#8a4fd9', '#2f8a4a'];
  const WARM_WIN = '#ffd98a', WARM_IN = '#fff1c4';

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
  const crewPath = tx => [[P.ax + 34, P.ayb], [P.ax - 20, P.ayb], [P.ax + 8, P.walkY], [tx, P.walkY]];

  function helpPlan() { const out = crewPath(P.kx - 30); return { out, d: pathLen(out) / SPD, o: 0.45, pk: 0.9 }; }
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
    P.ayb = L.laneY;
    P.bY = L.roadY - 6;                  // back of the sidewalk: buildings stand here
    P.walkY = L.roadY - 1;               // people walk here
    P.hz = P.bY - (P.portrait ? 56 : 22);
    P.ax = Math.max(L.safeL + 40, Math.round(W * 0.34 - ALEN / 2));
    P.kx = Math.round(P.ax + ALEN + Math.min(110, (W - L.safeR - P.ax - ALEN) * 0.42));
    P.camEnd = Math.round(W * 3);
    P.hx = P.ax + 22;
    P.hw = Math.max(120, Math.min(P.portrait ? 230 : 210, W - L.safeR - 6 - P.hx));
    P.hh = Math.round(Math.min(P.portrait ? 300 : 170, Math.max(96, P.bY - L.safeT - 36)));
    P.doorX = P.hx + Math.round(P.hw * 0.64);
    P.lampH = P.portrait ? 46 : 36;
    st.cam = Math.min(st.cam, P.camEnd);
    if (scene === 'amb') setClouds(L.safeT + 18, Math.max(L.safeT + 40, P.hz - (P.portrait ? 140 : 46)));
  }

  /* ---------- phases ---------- */
  function enter() {
    stopSiren();
    st.round++;
    const types = ['kid', 'kid2', 'kid3'].filter(k => k !== st.lastType);
    const type = pickOne(types); st.lastType = type;
    st.kid = { type, skin: pickOne(SKIN), hair: pickOne(HAIR), balloon: COLOR[pickOne(BALLOONS)].c };
    st.medSkin = [pickOne(SKIN), pickOne(SKIN)];
    Object.assign(st, { phase: 'arrive', t: 0, cam: 0, v: 0, fired: {}, auto: false, doors: false, idle: 0, puffT: 0, pressed: false, wantHelp: false, kidHop: 0 });
    st.hold.clear();
    if (!st.savedClouds) st.savedClouds = clouds;
    layout();
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
    sparkle(P.kx, P.walkY - 16, 12, 8);
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
      once('lay', t > o + d + 0.7, () => { SFX.pop(); sparkle(P.kx - 30, P.walkY - 14, 10, 6, '#ffffff'); });
      once('close', t > o + 2 * d + pk + 0.15, () => { st.doors = false; click(200); });
      if (t > o + 2 * d + pk + 0.6) { st.phase = 'drive'; st.t = 0; SFX.chime(); }
    } else if (ph === 'drive') {
      const rem = P.camEnd - st.cam, vmax = Math.max(130, W * 0.3);
      if (!st.auto && rem < W * 0.55) st.auto = true;
      const want = st.hold.size > 0;
      if (st.auto) {
        const vt = Math.max(14, Math.min(vmax, Math.sqrt(2 * 100 * rem)));
        st.v += Math.sign(vt - st.v) * Math.min(Math.abs(vt - st.v), 200 * dt);
      } else if (want) st.v = Math.min(vmax, st.v + 120 * dt);
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
      if (t > pp.fadeEnd && t < pp.e && Math.floor(t * 2.5) !== Math.floor((t - dt) * 2.5)) sparkle(P.doorX, P.walkY - 34, 14, 3, '#ff6fb4');
      once('exit', t > pp.e, () => { SFX.chime(); });
      once('cele', t > pp.c, () => {
        SFX.fanfare(); say(pick('praise'));
        sparkle(P.doorX + 34, P.walkY - 20, 18, 14);
        sparkle(P.doorX - 36, P.walkY - 16, 16, 8, '#ffffff');
      });
      if (t > pp.c && t < pp.c + 1.5) confetti(2);
      if (ph === 'park' && t > pp.c + 1.0) st.phase = 'done';
    }
  }

  /* ---------- drawing: scenery ---------- */
  function drawBackdrop() {
    const pr = P.portrait, far = st.cam * 0.15, mid = st.cam * 0.4;
    const fs = pr ? 120 : 100;
    for (let k = Math.floor((far - 160) / fs); k * fs - far < W + 160; k++) {
      const r = Math.round((pr ? 70 : 46) + hsh(k * 1.3) * (pr ? 40 : 24));
      circle(k * fs - far, P.hz + r * 0.55, r, '#a6dd8e');
    }
    if (pr) skyline(false);
    const ms = pr ? 90 : 76;
    for (let k = Math.floor((mid - 120) / ms); k * ms - mid < W + 120; k++) {
      const r = Math.round((pr ? 44 : 30) + hsh(k * 2.7 + 5) * (pr ? 26 : 16));
      circle(k * ms - mid + 30, P.hz + r * 0.62, r, '#8fd877');
    }
    R(0, P.hz, W, P.bY - P.hz, '#6cbf5a');
    const go = st.cam % 23;
    for (let xx = -go; xx < W; xx += 23) R(xx, P.hz + 4 + ((xx + st.cam) * 7 % 5 + 5) % 5 * Math.max(1, (P.bY - P.hz - 8) / 5 | 0), 1, 2, '#83d16e');
    // sidewalk
    R(0, P.bY, W, L.roadY - P.bY, '#d9d2c3'); R(0, P.bY, W, 1, '#c2baa8');
    const so = st.cam % 16;
    for (let xx = -so; xx < W; xx += 16) R(xx, P.bY + 1, 1, L.roadY - P.bY - 1, '#c9c1b0');
    // road with scrolling dashes
    const y = L.roadY, h = L.palY - L.roadY;
    R(0, y, W, h, '#4b4f5c');
    R(0, y, W, 3, '#bdb8ac'); R(0, y + 3, W, 1, '#8f8b80'); R(0, y + h - 3, W, 3, '#bdb8ac');
    const off = st.cam % 20;
    for (let xx = 4 - off; xx < W; xx += 20) R(xx, y + 22, 10, 2, '#ffd21f');
  }

  // far-away town towers (portrait has lots of sky): slow parallax, windows glow at night
  const TOWERS = [['#c9d6e8', '#b3c3da'], ['#d8cfe6', '#c3b8d6'], ['#e6d6c8', '#d3c0ae'], ['#cfe0dc', '#b6ccc6']];
  function skyline(lit) {
    const sp = 44, cam = st.cam * 0.3, k = nightK();
    if (lit && k < 0.02) return;
    for (let i = Math.floor((cam - 60) / sp); i * sp - cam < W + 60; i++) {
      const seed = i * 5.3 + 77;
      if (hsh(seed) > 0.72) continue;
      const w = 26 + Math.floor(hsh(seed + 1) * 14), h = 60 + Math.floor(hsh(seed + 2) * 130);
      const x = Math.floor(i * sp - cam + hsh(seed + 3) * 10), top = P.hz + 12 - h;
      const [c, d] = TOWERS[Math.floor(hsh(seed + 4) * TOWERS.length)];
      if (!lit) { R(x, top, w, h, c); R(x + w - 3, top, 3, h, d); R(x - 1, top - 2, w + 2, 2, d); }
      for (let wy = top + 6, r = 0; wy < P.hz - 38; wy += 9, r++) for (let wx = x + 4, q = 0; wx + 4 < x + w - 3; wx += 7, q++) {
        if (!lit) R(wx, wy, 4, 4, d);
        else if (hsh(seed + r * 13.1 + q * 3.7) < 0.45) alpha(k * 0.8, () => R(wx, wy, 4, 4, WARM_WIN));
      }
    }
  }
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
    R(x + w - 6, top - 9, 4, 8, '#8a5a3a');                              // chimney
    const rows = Math.ceil((w + 6) / 4);
    for (let i = 0; i < rows; i++) R(x - 3 + i * 2, top - 1 - i, w + 6 - i * 4, 1, i ? roof : '#5a2a1a');
    for (const [wx, wy] of wins) { R(wx - 1, wy - 1, 9, 8, '#ffffff'); R(wx, wy, 7, 6, GLASS); R(wx + 3, wy, 1, 6, '#ffffff'); R(wx + 1, wy + 1, 2, 1, '#ffffff'); }
    const dx = x + w - 12;
    R(dx - 1, base - 13, 9, 13, '#ffffff'); R(dx, base - 12, 7, 12, roof); R(dx + 5, base - 6, 1, 1, '#ffd21f');
  }
  function lamp(x, lit) {
    const base = L.roadY, hgt = P.lampH;
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(0.22 * k, () => { for (let i = 0; i < hgt - 2; i += 2) { const w = 4 + i * 0.6; R(x + 7 - w / 2, base - hgt + 3 + i, w, 2, '#fff1a8'); } });
      alpha(k, () => { glow(x + 7, base - hgt + 2, '#fff1a8', 5); R(x + 5, base - hgt + 2, 5, 2, '#fff6b0'); });
      return;
    }
    R(x - 1, base - 3, 4, 3, '#3f434e');
    R(x, base - hgt, 2, hgt, '#5a5f6e');
    R(x, base - hgt, 8, 2, '#5a5f6e'); R(x + 4, base - hgt + 1, 6, 1, '#3f434e'); R(x + 5, base - hgt + 2, 5, 1, '#e9e2b0');
  }
  // trees and houses behind the sidewalk, generated per slot so the road never ends
  function scenery(lit) {
    const sp = 70, cam = st.cam, pr = P.portrait;
    const k0 = Math.floor((cam - 90) / sp), k1 = Math.ceil((cam + W + 90) / sp);
    for (let k = k0; k <= k1; k++) {
      const seed = k * 3.1 + st.round * 17.3, h = hsh(seed);
      const wx = k * sp + Math.floor(hsh(seed + 9) * 14);
      if (wx < P.kx + 84 || wx > P.camEnd + P.hx - 64) continue;
      const x = Math.floor(wx - cam);
      if (h < 0.34) { if (!lit) drawTree(x + 16, P.bY, (pr ? 13 : 10) + Math.floor(hsh(seed + 2) * 5)); }
      else if (h < 0.78) house(x, P.bY, 34 + Math.floor(hsh(seed + 3) * 14), 1 + (hsh(seed + 4) > 0.5) + (pr ? 1 : 0), seed, lit);
      else if (!lit) { drawTree(x + 10, P.bY, pr ? 12 : 9); drawTree(x + 30, P.bY, pr ? 15 : 11); }
    }
  }
  function lamps(lit) {
    const sp = 160, cam = st.cam;
    for (let k = Math.floor((cam - 40) / sp); k * sp + 60 - cam < W + 20; k++) {
      const wx = k * sp + 60;
      if (wx < P.kx + 90 || wx > P.camEnd + P.ax - 40) continue;
      lamp(Math.floor(wx - cam), lit);
    }
  }
  // the spot where the kid is waiting: tree, little house, bench
  function startSpot(lit) {
    const o = -st.cam;
    if (P.kx + 90 + o < -10) return;
    if (!lit) drawTree(P.ax - 34 + o, P.bY, P.portrait ? 15 : 11);
    house(P.kx + 8 + o, P.bY, 44, P.portrait ? 2 : 1, 99 + st.round, lit);
    if (!lit) { drawTree(P.kx + 68 + o, P.bY, P.portrait ? 13 : 10); drawBench(P.kx + o, P.walkY - 8); }
  }
  function drawBench(x, seat) {
    const wood = '#a8662f', lite = '#c98a4a', leg = '#5a5f6e';
    R(x + 6, seat - 10, 3, 11, wood); R(x + 6, seat - 10, 1, 11, lite);
    R(x - 11, seat + 1, 22, 2, wood); R(x - 11, seat + 1, 22, 1, lite);
    R(x - 10, seat + 3, 2, P.walkY - seat - 2, leg); R(x + 7, seat + 3, 2, P.walkY - seat - 2, leg);
  }

  function hospital(lit) {
    const off = P.camEnd - st.cam, x0 = Math.floor(P.hx + off), w = P.hw, h = P.hh, b = P.bY, top = b - h;
    if (x0 > W + 40 || x0 + w < -40) return;
    const cx = x0 + (w >> 1), doorX = Math.floor(P.doorX + off), gz = 60;
    const cols = Math.max(2, Math.floor((w - 12) / 20)), cw = (w - 12) / cols;
    const rows = Math.max(1, Math.floor((h - gz - 10) / 22));
    const wins = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) wins.push([Math.round(x0 + 6 + c * cw + (cw - 12) / 2), top + 10 + r * 22]);
    for (let wx = x0 + 8; wx + 12 < doorX - 20; wx += 18) wins.push([wx, b - 26]);
    for (let wx = doorX + 22; wx + 12 < x0 + w - 6; wx += 18) wins.push([wx, b - 26]);
    const ts = w >= 170 ? 3 : 2, tw = textWidth('HOSPITAL', ts);
    const signY = b - 56;
    const doorOpen = hospDoorOpen();
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(k, () => {
        wins.forEach(([wx, wy], i) => { if (hsh(i * 1.7 + 4) < 0.85) { alpha(0.3, () => R(wx - 2, wy - 2, 16, 15, WARM_WIN)); R(wx + 1, wy + 1, 10, 9, WARM_WIN); R(wx + 2, wy + 2, 4, 3, WARM_IN); } });
        alpha(0.35, () => circle(cx, top - 21, 17, '#ff5a5a'));
        R(cx - 3, top - 30, 6, 18, '#ff3b3b'); R(cx - 9, top - 24, 18, 6, '#ff3b3b');
        alpha(0.25, () => R(cx - (tw >> 1) - 7, signY - 2, tw + 14, 24, '#ffffff'));
        text('HOSPITAL', cx - (tw >> 1), signY + 3 + (ts === 2 ? 2 : 0), ts, '#ff3b3b');
        R(doorX - 12, b - 26, 24, 26, doorOpen ? WARM_WIN : '#ffe9a0');
        alpha(0.25, () => R(doorX - 18, b - 30, 36, 30, WARM_WIN));
      });
      return;
    }
    // body
    R(x0, top, w, h, '#f4f7fb'); R(x0, top, 3, h, '#d5dde6'); R(x0 + w - 2, top, 2, h, '#e2e8ee');
    R(x0 - 3, top - 4, w + 6, 4, '#cfd8e2'); R(x0 - 3, top - 4, w + 6, 1, '#ffffff');
    R(x0, top, w, 3, '#e8222b');
    R(x0, b - gz - 4, w, 2, '#e2e8ee');
    // rooftop red cross sign
    R(cx - 9, top - 8, 2, 4, '#9aa3ad'); R(cx + 7, top - 8, 2, 4, '#9aa3ad');
    R(cx - 13, top - 34, 26, 26, '#cfd8e2'); R(cx - 12, top - 33, 24, 24, '#ffffff');
    R(cx - 3, top - 30, 6, 18, '#e8222b'); R(cx - 9, top - 24, 18, 6, '#e8222b');
    // windows
    for (const [wx, wy] of wins) {
      R(wx, wy, 12, 11, '#9aa3ad'); R(wx + 1, wy + 1, 10, 9, GLASS); R(wx + 1, wy + 5, 10, 1, '#cfd8e2');
      R(wx + 2, wy + 2, 2, 2, '#ffffff'); R(wx - 1, wy + 11, 14, 1, '#cfd8e2');
    }
    // sign
    R(cx - (tw >> 1) - 5, signY, tw + 10, 20, '#a3121d'); R(cx - (tw >> 1) - 4, signY + 1, tw + 8, 18, '#ffffff');
    text('HOSPITAL', cx - (tw >> 1), signY + 3 + (ts === 2 ? 2 : 0), ts, '#e8222b');
    // awning and big sliding door
    for (let i = 0; i < 38; i += 4) R(doorX - 19 + i, b - 32, 2, 5, '#e8222b');
    R(doorX - 19, b - 32, 38, 1, '#a3121d');
    R(doorX - 14, b - 27, 28, 27, '#7d8794');
    R(doorX - 12, b - 26, 24, 26, '#3a3d46');
    if (doorOpen) {
      R(doorX - 12, b - 26, 3, 26, GLASS2); R(doorX + 9, b - 26, 3, 26, GLASS2);
      R(doorX - 9, b - 26, 18, 26, '#fbe8c8'); R(doorX - 9, b - 4, 18, 4, '#e6d2ae');
    } else {
      R(doorX - 12, b - 26, 12, 26, GLASS); R(doorX + 1, b - 26, 11, 26, GLASS);
      R(doorX - 10, b - 23, 2, 6, '#ffffff'); R(doorX + 3, b - 23, 2, 6, '#ffffff');
      R(doorX - 2, b - 14, 1, 4, '#5a5f6e'); R(doorX + 2, b - 14, 1, 4, '#5a5f6e');
    }
    // bushes
    circle(x0 + 5, b - 4, 5, '#3f9a45'); circle(x0 + 4, b - 6, 3, '#5bb85a');
    circle(x0 + w - 5, b - 4, 5, '#3f9a45'); circle(x0 + w - 6, b - 6, 3, '#5bb85a');
  }
  function hospDoorOpen() {
    if (st.phase !== 'park' && st.phase !== 'done') return false;
    const pp = parkPlan(), t = st.t;
    return (t > pp.a + pp.d - 0.7 && t < pp.fadeEnd + 0.2) || (t > pp.e - 0.2 && t < pp.e + 1.3);
  }

  /* ---------- drawing: people ---------- */
  function drawStretcher(x, yb, kidOn) {
    x = Math.floor(x); yb = Math.floor(yb);
    R(x - 8, yb - 7, 1, 5, '#7d8794'); R(x + 7, yb - 7, 1, 5, '#7d8794');
    R(x - 9, yb - 2, 3, 2, TIRE); R(x + 6, yb - 2, 3, 2, TIRE);
    R(x - 12, yb - 8, 25, 2, '#9aa3ad');
    R(x - 10, yb - 11, 21, 3, '#ffffff'); R(x - 10, yb - 9, 21, 1, '#cfd8e2');
    if (!kidOn) { R(x + 5, yb - 12, 5, 1, '#eef3f8'); return; }
    const k = st.kid, o = OUTFITS[k.type];
    R(x + 4, yb - 16, 5, 5, k.skin);                                         // head on the pillow
    if (o.hat === 'cap') R(x + 8, yb - 17, 2, 6, o.hatC); else R(x + 8, yb - 16, 2, 5, k.hair);
    R(x + 5, yb - 14, 1, 1, INK);
    R(x - 8, yb - 14, 12, 3, '#6fb6ff'); R(x - 8, yb - 14, 12, 1, '#a8d4ff');   // blanket
    R(x - 10, yb - 14, 2, 3, o.shoes);
  }
  function drawCrew(sx, sy, dir, walking, kidOn, a = 1) {
    alpha(a, () => {
      const rearA = dir > 0;
      drawPerson({ type: 'medic', x: sx - 14, yb: sy, dir, walk: walking, pose: rearA ? 'carry' : 'stand', skin: st.medSkin[0], seed: 0 });
      drawStretcher(sx, sy, kidOn);
      drawPerson({ type: 'medic', x: sx + 14, yb: sy, dir, walk: walking, pose: rearA ? 'stand' : 'carry', skin: st.medSkin[1], seed: 3 });
    });
  }
  function drawSadKid(x, seat) {
    const k = st.kid, sob = Math.floor(T * 3) % 2;
    drawPerson({ type: k.type, x, yb: seat, pose: 'sit', dir: -1, skin: k.skin, hair: k.hair, seed: 1, hop: sob });
    R(x - 4, seat - 1 - sob, 1, 1, '#e8222b');                                 // scraped knee
    R(x - 3, seat - 6 - sob, 2, 1, k.skin); R(x - 3, seat - 6 - sob, 1, 1, '#a3121d');   // little sad mouth
    const tf = Math.floor(T * 6) % 4;
    if (tf < 3) R(x - 2, seat - 7 - sob + tf, 1, 1, '#4fc3ff');
    if ((Math.floor(T * 6) + 2) % 4 < 2) R(x - 1, seat - 6 - sob + (Math.floor(T * 6) % 2), 1, 1, '#4fc3ff');
  }
  function drawHappyKid(x, yb, pose, walking, hop, dir = 1) {
    const k = st.kid, ph = Math.floor(T * 5) % 2;
    x = Math.floor(x); yb = Math.floor(yb); hop = Math.round(hop);
    const hx = x + dir, hy = pose === 'cheer' ? yb - hop - (ph ? 15 : 13) : yb - hop - 4;
    const bx = hx + 5 * dir + Math.round(Math.sin(T * 2) * 2), by = Math.min(hy, yb - 16) - 16;
    for (let i = 0; i <= 14; i++) { const f = i / 14; R(lerp(hx, bx, f) + Math.round(Math.sin(f * Math.PI) * 2), lerp(hy, by + 7, f), 1, 1, '#5a5f6e'); }
    circle(bx, by, 6, k.balloon[1]); R(bx - 3, by - 3, 2, 2, k.balloon[0]); R(bx - 1, by + 6, 3, 1, k.balloon[2]);
    drawPerson({ type: k.type, x, yb, pose, dir, walk: walking, skin: k.skin, hair: k.hair, seed: 0, hop });
    R(dir > 0 ? x + 1 : x - 3, yb - hop - 3, 2, 1, '#f3c27a');               // band-aid
  }

  function clipOutAmb(fn) {   // hide whatever is inside the ambulance's footprint (going in / out the back doors)
    const x = Math.floor(ambX());
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(x + 1, P.ayb - 40, ALEN + 6, 48); g.clip('evenodd');
    fn();
    g.restore();
  }

  function drawPeople() {
    const ph = st.phase, t = st.t, seat = P.walkY - 8;
    if (ph === 'arrive' || ph === 'wait') { drawSadKid(P.kx, seat); return; }
    if (ph === 'help') {
      const s = helpState();
      if (s.kid === 'bench') drawSadKid(P.kx, seat);
      clipOutAmb(() => { if (s.crew) drawCrew(s.crew[0], s.crew[1], s.crew[2], s.crew[3], s.kid === 'stretcher'); });
      if (s.kid === 'hop') {
        const sx = P.kx - 30, k = ease(s.hk);
        drawPerson({ type: st.kid.type, x: lerp(P.kx, sx, k), yb: lerp(seat, P.walkY - 7, k) - Math.sin(s.hk * Math.PI) * 14, pose: 'sit', dir: -1, skin: st.kid.skin, hair: st.kid.hair });
      }
      return;
    }
    if (ph === 'park' || ph === 'done') {
      const pp = parkPlan();
      if (t >= pp.a && t < pp.a + pp.d) {
        const [x, y, dir] = pathAt(pp.path, (t - pp.a) / pp.d);
        clipOutAmb(() => drawCrew(x, y, dir, true, true));
      } else if (t >= pp.a + pp.d && t < pp.fadeEnd) {
        drawCrew(P.doorX + 8 * clamp01((t - pp.a - pp.d) / 0.5), P.walkY, 1, true, true, 1 - clamp01((t - pp.a - pp.d) / 0.5));
      } else if (t >= pp.e) {
        const fk = clamp01((t - pp.e) / 1.2), fm = clamp01((t - pp.e - 0.35) / 1.2), cele = t >= pp.c;
        const fadeK = clamp01((t - pp.e) / 0.3), fadeM = clamp01((t - pp.e - 0.35) / 0.3);
        if (fm > 0) alpha(fadeM, () => {
          const pose = cele ? 'wave' : 'stand', d = fm >= 1 ? 1 : -1;
          drawPerson({ type: 'medic', x: P.doorX - 46 * ease(fm), yb: P.walkY, dir: d, pose, walk: fm > 0 && fm < 1, skin: st.medSkin[0], seed: 2 });
          drawPerson({ type: 'medic', x: P.doorX - 24 * ease(fm), yb: P.walkY, dir: d, pose, walk: fm > 0 && fm < 1, skin: st.medSkin[1], seed: 5 });
        });
        alpha(fadeK, () => {
          const hop = st.kidHop > 0 ? Math.sin(st.kidHop / 0.5 * Math.PI) * 8 : cele && t < pp.c + 2.5 ? Math.abs(Math.sin(T * 7)) * 3 : 0;
          const pose = cele ? (ph === 'done' && Math.floor(T / 1.6) % 2 ? 'wave' : 'cheer') : 'stand';
          drawHappyKid(P.doorX + 34 * ease(fk), P.walkY, pose, fk < 1, hop, fk >= 1 && cele ? -1 : 1);
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
    if ((ph === 'arrive' || ph === 'wait') && !st.wantHelp) hintArrow(P.kx, P.walkY - 26);
    if (ph === 'drive' && !st.auto) {
      const b = L.againBtn;
      if (st.hold.size) { button({ x: b.x, y: b.y + 2, s: b.s }, '#3fb43a', '#1f7a2a'); drawArrowIcon(b.x + b.s / 2, b.y + 2 + b.s / 2, b.s); }
      else { drawAgainButton(b, '#3fb43a', '#1f7a2a'); if (st.v < 5) hintArrow(b.x + b.s / 2, b.y - 6); }
    }
    if (ph === 'done') drawAgainButton(L.againBtn, '#e8222b', '#a3121d', crossIcon);
  }

  /* ---------- input ---------- */
  function hitKidOnBench(x, y) { return Math.abs(x - P.kx) < 30 && y > P.walkY - 54 && y < P.walkY + 14; }
  function tap(x, y, id) {
    const ph = st.phase;
    if (inBox(L.homeBtn, x, y)) { SFX.boop(); returnHome(AMB); return true; }
    if (ph === 'drive') {
      if (!st.auto) {
        if (!st.hold.size) { tone('sawtooth', 70, 0, 0.35, 0.07, 140); if (!st.pressed) say(pick('amb'), true); }
        st.hold.add(id); st.pressed = true;
      } else { SFX.pop(); sparkle(x, y, 5, 4, '#ffffff'); }
      return true;
    }
    if (ph === 'done' && inBox(L.againBtn, x, y, 6)) { SFX.boop(); goScene('amb'); return true; }
    if ((ph === 'arrive' || ph === 'wait') && hitKidOnBench(x, y)) {
      if (ph === 'wait') startHelp();
      else if (!st.wantHelp) { st.wantHelp = true; SFX.pop(); sparkle(P.kx, P.walkY - 16, 12, 6); }
      return true;
    }
    if (ph === 'done' || (ph === 'park' && st.t > parkPlan().e + 1.2)) {
      if (Math.abs(x - (P.doorX + 34)) < 26 && y > P.walkY - 60 && y < P.walkY + 12) {
        st.kidHop = 0.5; SFX.boop(1.3); sparkle(P.doorX + 34, P.walkY - 26, 12, 6, pickOne(BALLOONS.map(b => COLOR[b].c[0])));
        return true;
      }
      if (x > P.doorX - 56 && x < P.doorX - 12 && y > P.walkY - 24 && y < P.walkY + 10) { SFX.boop(0.8); sparkle(x, y - 6, 10, 5, '#ffffff'); return true; }
    }
    const ax = ambX();
    if (x > ax && x < ax + ALEN && y > P.ayb - 38 && y < P.ayb + 2) { SFX.beep(); sparkle(ax + 40, P.ayb - 34, 8, 4, '#ff7a6b'); return true; }
    SFX.pop(); sparkle(x, y, 5, 4, '#ffffff');
    return true;
  }
  function release(id) { st.hold.delete(id); }

  SCENES.amb = {
    layout, enter, leave, update, tap, release,
    groundY: () => P.hz,
    drawWorld() {
      drawBackdrop();
      scenery(false);
      startSpot(false);
      hospital(false);
      drawPeople();
      drawAmbulance();
      lamps(false);
    },
    drawLit() {
      if (P.portrait) skyline(true);
      scenery(true); startSpot(true); hospital(true); lamps(true);
      const k = nightK();
      if (k > 0.02 && st.phase === 'drive') {   // headlight beam
        const x = Math.floor(ambX()) + 61, y = P.ayb - 16;
        alpha(0.2 * k, () => { for (let i = 0; i < 46; i += 2) R(x + i, y - i * 0.12, 2, 3 + i * 0.24, '#fff6b0'); });
      }
      drawParticles();
    },
    drawUI,
  };
})();
