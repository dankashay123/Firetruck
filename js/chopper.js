// "Helicopter Rescue": hold a finger anywhere and the big red rescue helicopter flies to it.
// Hover over someone who needs help, the winch lowers the rope, and carry them to the helipad.
// Three rescues a round; there are no timers and nothing can go wrong.
'use strict';
(() => {
  const DK = '#3a3d46', CABLE = '#4a4f5c';
  const HW = 64, HH = 40, OX = 32, OY = 20;   // helicopter sprite canvas and its origin
  const SKID = 11;                            // skid bottom, below the origin
  const DANGLE = 24;                          // hook below the winch while carrying
  const KINDS = ['roof', 'tree', 'balloon', 'pond', 'ledge'];
  const ADULTS = ['mom', 'dad', 'gran'];
  const KIDS = ['kid', 'kid2', 'kid3'];
  const WALKERS = ['mom', 'dad', 'gran', 'kid', 'kid2', 'chef', 'kid3'];
  const CATS = [['#ffc27a', '#f59a3a', '#c96a1a'], ['#e9eef2', '#9aa3ad', '#6b7480'], ['#5a5f6e', '#2f3240', '#16171f']];
  const PUPS = [['#f4dcc0', '#c98a4a', '#6b3f22'], ['#ffffff', '#e9e2d0', '#5a3a22'], ['#e9c39a', '#2f3240', '#16171f']];
  const WALLS = [['#ffe3b0', '#e8c48a'], ['#ffd0d6', '#e8aab4'], ['#cfe8ff', '#a8c8ea'], ['#d8f0c0', '#b4d39a'], ['#fff3a8', '#e0d07a'], ['#e6d6ff', '#c4b0ea']];
  const ROOFS = ['#c8432f', '#3f66b8', '#7a4a2a', '#8a4fd9', '#2f8a4a'];
  const BALLOON = [['#e8222b', '#ffd21f'], ['#2a6fe0', '#ffffff'], ['#8a4fd9', '#ff6fb4'], ['#3fb43a', '#ffd21f'], ['#f57a12', '#fff27a']];
  const WARM_WIN = '#ffd98a';
  const hcv = document.createElement('canvas'); hcv.width = HW; hcv.height = HH;
  const hg = hcv.getContext('2d');
  const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rotor = noiseLoop(240, 0.8);

  const st = {
    phase: 'play', doneT: 0, padLeft: false, padType: 'hosp', helperSkin: SKIN[0], rnd: [], targets: [], pad: {}, fillers: [], skyline: [],
    prof: null, dyn: [], G: 150, minY: 20, rope: 'idle', ropeT: 0, ropeDur: 0.5, cur: null, hook: [0, 0], winch: [0, 0], reelFrom: [0, 0], ext: 0,
    saved: 0, cars: [], carT: 0, peds: [], birds: [], hearts: [], chopT: 0, lastChop: -9, lifeW: 0,
  };
  const heli = { x: 90, y: 60, vx: 0, vy: 0, dir: 1, tilt: 0, intro: false, hy: 60 };
  let hold = null, finger = [0, 0];
  const lifted = t => t.state === 'lift' || t.state === 'carry' || t.state === 'lower';
  const onRoof = t => t.state === 'run' || t.state === 'hug' || t.state === 'walkin';
  const isSaved = t => t.state === 'hug' || t.state === 'walkin' || t.state === 'saved';
  const hangOff = t => (t.who === 'person' ? t.h - 1 : 17);   // hook to feet while hanging

  /* ---------- rounds ---------- */
  function makeTarget(kind) {
    const t = { kind, state: 'wait', tt: 0, seed: Math.random() * 10, call: 1 + Math.random() * 2, free: false, fy: 0, fx: 0, savedAt: -9, slot: 0, px: 0, pyb: 0 };
    if (kind === 'roof') { t.who = 'cat'; t.col = pickOne(CATS); }
    else if (kind === 'pond') { t.who = 'pup'; t.col = pickOne(PUPS); }
    else { t.who = 'person'; t.ptype = pickOne(kind === 'ledge' ? ADULTS : KIDS); t.skin = pickOne(SKIN); }
    if (kind === 'balloon') t.bal = pickOne(BALLOON);
    t.h = t.who === 'person' ? personH(t.ptype) : 14;
    return t;
  }
  function newRound(first) {
    st.targets = KINDS.slice().sort(() => Math.random() - 0.5).slice(0, 3).map(makeTarget);
    st.padLeft = Math.random() < 0.5;
    st.padType = first ? pickOne(['hosp', 'fire']) : (st.padType === 'hosp' ? 'fire' : 'hosp');
    st.helperSkin = pickOne(SKIN);
    st.rnd = Array.from({ length: 24 }, Math.random);
    Object.assign(st, { grace: 1, phase: 'play', doneT: 0, saved: 0, rope: 'idle', ropeT: 0, cur: null, hearts: [] });
    layout();
  }

  /* ---------- layout ---------- */
  function layout() {
    if (!st.targets.length) return newRound(true);
    const G = st.G = L.palY - 36;
    const sp = Math.max(40, G - (L.safeT + 78));          // how tall things may be
    st.minY = L.safeT + 20;
    const x0 = L.safeL + 2, x1 = W - L.safeR - 2, sw = (x1 - x0) / 4;
    const padSlot = st.padLeft ? 0 : 3, slots = [0, 1, 2, 3].filter(s => s !== padSlot);
    const P = st.prof = new Float32Array(W + 1).fill(G - 1);
    const put = (a, b, y) => { for (let c = Math.max(0, Math.floor(a)); c <= Math.min(W, Math.ceil(b)); c++) if (y < P[c]) P[c] = y; };
    const r = i => st.rnd[i % st.rnd.length];
    // keep hint arrows out from under the sun (tapping the sun turns day to night)
    const dodge = (cx, slot, top) => {
      if (top > L.sunY + 30 || Math.abs(cx - L.sunX) > 46) return cx;
      return Math.round(Math.max(x0 + sw * slot + 24, Math.min(cx, L.sunX - 46)));
    };
    const pc = Math.round(x0 + sw * (padSlot + 0.5));
    placePad(pc, sw, sp, () => {});
    placePad(dodge(pc, padSlot, st.pad.dy - 24), sw, sp, put);
    const PLACE = { roof: placeRoof, tree: placeTree, balloon: placeBalloon, pond: placePond, ledge: placeLedge };
    st.targets.forEach((t, i) => {
      const rr = k => r(i * 6 + k), cx = Math.round(x0 + sw * (slots[i] + 0.5));
      t.cx = cx; PLACE[t.kind](t, sw, sp, () => {}, rr);
      t.cx = dodge(cx, slots[i], t.yb - t.h - 32);
      PLACE[t.kind](t, sw, sp, put, rr);
      t.gx = t.x; t.gy = t.yb - t.h;
    });
    // little houses in the gaps
    st.fillers = [];
    const ext = [st.pad.ext, ...st.targets.map(t => t.ext)].sort((a, b) => a[0] - b[0]);
    const gaps = [[-4, ext[0][0]]];
    for (let i = 1; i < ext.length; i++) gaps.push([ext[i - 1][1], ext[i][0]]);
    gaps.push([ext[ext.length - 1][1], W + 4]);
    gaps.forEach(([a, b], i) => {
      const gw = b - a;
      if (gw < 26) return;
      const w = Math.min(gw - 6, 34), h = Math.round(16 + r(18 + i) * 14), x = Math.round((a + b) / 2 - w / 2), rh = Math.round(w / 2.6);
      const f = { x, w, h, rh, top: G - h, wall: WALLS[(r(i) * WALLS.length) | 0], roof: ROOFS[(r(i + 5) * ROOFS.length) | 0], wins: [] };
      for (let wx = x + 4; wx + 6 <= x + w - 3; wx += 10) if (Math.abs(wx + 3 - (x + w / 2)) > 4) f.wins.push({ x: wx, y: f.top + 4, w: 6, h: 6, on: hsh(wx + i) < 0.6 });
      st.fillers.push(f);
      put(x - 1, x + w + 1, f.top - rh);
    });
    // distant skyline (just scenery: the helicopter flies in front of it)
    st.skyline = [];
    for (let x = -6, i = 0; x < W; i++) {
      const w = 12 + Math.round(hsh(i * 3.1) * 12), h = Math.round(14 + hsh(i * 5.7) * Math.min(46, sp * 0.3));
      const dots = [];
      for (let k = 0; k < 4; k++) dots.push([x + 2 + Math.round(hsh(i * 9 + k) * (w - 4)), G - 8 - Math.round(hsh(i * 7 + k * 3) * (h - 4))]);
      st.skyline.push({ x, w, h, dots });
      x += w + 2;
    }
    if (st.lifeW !== W || !st.peds.length) initLife();
    if (scene === 'chopper') setClouds(L.safeT + 22, Math.max(L.safeT + 50, G - 90));
    heli.x = heli.intro ? heli.x : clamp(heli.x, L.safeL + 30, W - L.safeR - 30);
  }
  function placePad(cx, sw, sp, put) {
    const p = st.pad, G = st.G;
    p.cx = cx; p.bw = clamp(Math.round(sw - 2), 44, 66); p.bx = cx - (p.bw >> 1);
    p.roof = G - Math.round(clamp(sp * 0.42, 36, 190));
    p.s = st.padLeft ? -1 : 1;                           // the side facing the screen edge
    p.hutX = p.s > 0 ? p.bx + p.bw - 11 : p.bx + 2;
    p.helperX = p.hutX + 4;
    const d0 = p.s > 0 ? p.bx + 1 : p.bx + 12, d1 = p.s > 0 ? p.bx + p.bw - 13 : p.bx + p.bw - 1;
    p.dcx = Math.round((d0 + d1) / 2); p.dw = Math.floor((d1 - d0) / 2); p.dy = p.roof - 7; p.dh = 4;
    p.meetX = p.helperX - p.s * 9;
    p.wins = [];
    const top = p.roof + 26, bottom = G - 20;
    for (let y = top; y + 8 <= bottom; y += 14) for (let x = p.bx + 5; x + 7 <= p.bx + p.bw - 4; x += 11) p.wins.push({ x, y, w: 7, h: 8, on: hsh(x * 3 + y) < 0.55 });
    p.ext = [p.bx - 1, p.bx + p.bw + 1];
    put(p.bx - 1, p.bx + p.bw + 1, p.roof - 1);
    put(d0, d1, p.dy - p.dh - 1);
    put(p.hutX - 4, p.hutX + 12, p.roof - 24);
  }
  function placeRoof(t, sw, sp, put, r) {
    const G = st.G, bw = clamp(Math.round(sw - 8), 30, 46), hgt = Math.round(clamp(sp * (0.5 + r(0) * 0.16), 34, 240));
    t.bw = bw; t.bx = t.cx - (bw >> 1); t.top = G - hgt;
    t.wall = WALLS[(r(1) * WALLS.length) | 0]; t.roofC = ROOFS[(r(2) * ROOFS.length) | 0];
    t.side = r(3) < 0.5 ? -1 : 1;
    t.x = t.cx + t.side * Math.round(bw * 0.22); t.yb = t.top - 2;
    t.tankX = t.cx - t.side * Math.round(bw * 0.24);
    t.wins = [];
    const cols = Math.max(2, Math.floor((bw - 6) / 10)), wx0 = t.bx + Math.round((bw - cols * 10 + 4) / 2);
    for (let y = t.top + 6; y + 8 <= G - 16; y += 13) for (let c = 0; c < cols; c++) t.wins.push({ x: wx0 + c * 10, y, w: 6, h: 8, on: hsh(c * 17 + y + t.seed) < 0.5 });
    t.ext = [t.bx - 1, t.bx + bw + 1];
    put(t.bx - 1, t.bx + bw + 1, t.top - 2);
    put(t.tankX - 5, t.tankX + 5, t.top - 16);
  }
  function placeTree(t, sw, sp, put, r) {
    const G = st.G, rr = clamp(Math.round(sw * 0.3), 12, 16), hgt = Math.round(clamp(sp * (0.38 + r(0) * 0.12), 50, 170));
    t.r = rr; t.ctop = G - hgt; t.cy = t.ctop + rr;
    t.x = t.cx; t.yb = t.ctop + 5;
    t.tufts = [];
    for (let y = t.cy + rr + 6, s = r(1) < 0.5 ? -1 : 1; y < G - 22; y += 22, s = -s) t.tufts.push({ x: t.cx + s * Math.round(rr * 0.5), y, r: Math.round(rr * 0.55) });
    t.ext = [t.cx - rr - 2, t.cx + rr + 2];
    const circ = (cx, cy, rad) => { for (let dx = -rad; dx <= rad; dx++) put(cx + dx, cx + dx, cy - Math.sqrt(rad * rad - dx * dx)); };
    circ(t.cx, t.cy, rr);
    for (const f of t.tufts) circ(f.x, f.y, f.r);
    put(t.cx - 3, t.cx + 3, t.cy);
  }
  function placeBalloon(t, sw, sp, put, r) {
    const G = st.G, hgt = Math.round(clamp(sp * (0.66 + r(0) * 0.12), 50, 270));
    t.ty = G - hgt; t.side = t.cx + 30 > W - L.safeR ? -1 : t.cx - 30 < L.safeL ? 1 : r(1) < 0.5 ? -1 : 1;
    t.x = t.cx; t.yb = t.ty - 2;
    t.ext = [t.cx - 10, t.cx + 10];
    for (let y = t.ty; y < G; y += 2) { const h = 3 + 6 * (y - t.ty) / hgt; put(t.cx - h, t.cx + h, y); }
  }
  function placePond(t, sw, sp, put) {
    const G = st.G;
    t.pw = clamp(Math.round(sw - 2), 42, 64);
    t.x = t.cx - 3; t.yb = G - 9;
    t.ext = [t.cx - (t.pw >> 1), t.cx + (t.pw >> 1)];
    put(t.ext[0], t.ext[1], G - 12);
    put(t.cx + 2, t.cx + 14, G - 28);
  }
  function placeLedge(t, sw, sp, put, r) {
    const G = st.G, hgt = Math.round(clamp(sp * (0.56 + r(0) * 0.14), 46, 250));
    t.top = G - hgt; t.bh = clamp(Math.round(sw * 0.75), 34, 64); t.th = 9; t.side = r(1) < 0.5 ? -1 : 1;
    t.x = t.cx - 3 * t.side; t.yb = t.top;
    t.ext = [t.cx - t.bh, t.cx + t.bh];
    for (let y = t.top; y < G; y++) { const h = ledgeHalf(t, y); put(t.cx - h, t.cx + h, y); }
    put(t.cx + 4 * t.side - 1, t.cx + 4 * t.side + 7, t.top - 13);
  }
  function ledgeHalf(t, y) {
    const k = (y - t.top) / (st.G - t.top);
    return t.th + (t.bh - t.th) * Math.pow(k, 0.8) + (hsh(Math.floor((y - t.top) / 3) * 7.3 + t.seed) - 0.5) * 3;
  }
  function initLife() {
    st.lifeW = W;
    const n = W >= 300 ? 4 : 2;
    st.peds = Array.from({ length: n }, (_, i) => ({ x: L.safeL + 16 + (i + 0.5) * (W - L.safeL - L.safeR - 32) / n, dir: Math.random() < 0.5 ? -1 : 1, type: WALKERS[(Math.random() * WALKERS.length) | 0], skin: pickOne(SKIN), seed: Math.random() * 5, sp: rand(9, 14) }));
    const nb = H > W ? 4 : 3;
    st.birds = Array.from({ length: nb }, () => newBird(true));
    st.cars = [];
  }
  function newBird(anywhere) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    return { x: anywhere ? rand(10, W - 10) : (dir > 0 ? -12 : W + 12), by: rand(st.minY + 14, Math.max(st.minY + 30, st.G - 70)), y: 0, vx: dir * rand(9, 16), flee: false, ph: Math.random() * 2, seed: Math.random() * 6 };
  }

  /* ---------- helicopter geometry ---------- */
  const dyAt = wx => Math.round((wx - heli.x) * heli.tilt);
  function hp(sx, sy) {   // sprite point -> world point (mirroring, tilt and bob included)
    const wx = Math.round(heli.x) - OX + (heli.dir > 0 ? sx : HW - 1 - sx);
    return [wx, Math.round(heli.hy) - OY + sy + dyAt(wx)];
  }
  function lowest(a, b) {   // highest obstacle (smallest y) between columns a and b
    if (a > b) [a, b] = [b, a];
    a = Math.max(0, Math.floor(a)); b = Math.min(W, Math.ceil(b));
    let m = st.G - 1;
    for (let c = a; c <= b; c++) if (st.prof[c] < m) m = st.prof[c];
    for (const [l, r, y] of st.dyn) if (r >= a && l <= b && y < m) m = y;
    return m;
  }
  function maxY(x) {
    const d = heli.dir;
    let y = lowest(x - 14 * d, x + 19 * d) - 2 - SKID;
    y = Math.min(y, lowest(x - 32 * d, x - 14 * d) - 2 + 3);          // tail boom
    if (st.ext > 1) { const hx = x - 12 * d; y = Math.min(y, lowest(hx - 8, hx + 8) - 2 - st.ext); }   // whoever is dangling
    return y;
  }

  /* ---------- sounds ---------- */
  function call(t) {
    if (t.who === 'cat') SFX.meow();
    else if (t.who === 'pup') SFX.woof();
    else { tone('sine', 880, 0, 0.12, 0.07, 1180); tone('sine', 1180, 0.16, 0.18, 0.07, 880); }
  }
  function cheer() { [784, 988, 1319].forEach((f, i) => tone('square', f, i * 0.1, 0.14, 0.08)); tone('triangle', 1568, 0.32, 0.5, 0.1); }

  /* ---------- update ---------- */
  function update(dt) {
    const G = st.G, p = st.pad;
    // flying: ease toward the finger, hover when let go
    let tx = null, ty = null;
    if (heli.intro) { tx = W / 2; ty = st.minY + 40; if (Math.abs(heli.x - tx) < 14) heli.intro = false; }
    else if (hold !== null) { tx = finger[0]; ty = finger[1] - 4; }
    const dvx = tx === null ? 0 : clamp((tx - heli.x) * 3, -150, 150);
    const dvy = ty === null ? 0 : clamp((ty - heli.y) * 3, -120, 120);
    heli.vx += (dvx - heli.vx) * Math.min(1, dt * 4);
    heli.vy += (dvy - heli.vy) * Math.min(1, dt * 4);
    heli.x += heli.vx * dt; heli.y += heli.vy * dt;
    if (!heli.intro) heli.x = clamp(heli.x, L.safeL + 30, W - L.safeR - 30);
    if (heli.vx > 18) heli.dir = 1; else if (heli.vx < -18) heli.dir = -1;
    heli.tilt += (clamp(heli.vx * 0.0015, -0.2, 0.2) - heli.tilt) * Math.min(1, dt * 6);
    // gentle clamp: never into rooftops, trees or the ground, never off the top
    st.dyn = [];
    for (const t of st.targets) {
      if (t.state === 'wait' || t.state === 'grab') st.dyn.push([t.gx - 8, t.gx + 8, t.gy - 1]);
      if (t.kind === 'balloon' && !t.free) st.dyn.push([t.cx - 7, t.cx + 7, t.ty - 8]);
    }
    const hanging = st.cur && lifted(st.cur);
    st.ext += ((hanging ? 16 + hangOff(st.cur) : 0) - st.ext) * Math.min(1, dt * 3);
    const my = maxY(heli.x);
    if (heli.y > my) { heli.y += (my - heli.y) * Math.min(1, dt * 10); heli.vy = Math.min(heli.vy, 0); }
    if (heli.y < st.minY) { heli.y = st.minY; heli.vy = Math.max(0, heli.vy); }
    heli.hy = heli.y + Math.sin(T * 2.2) * 1.5;
    // rotor sound
    const held = hold !== null;
    rotor(held ? 0.16 : 0.07);
    if ((st.chopT -= dt) <= 0) { st.chopT = 0.11; noise(0, 0.05, held ? 0.12 : 0.05, 190, 1.4); }
    // rope and winch
    st.winch = hp(19, 12);
    const rest = [st.winch[0], st.winch[1] + 3];
    const sway = Math.sin(T * 2.6) * 2 - clamp(heli.vx * 0.05, -6, 6);
    const dang = [Math.round(st.winch[0] + sway), st.winch[1] + DANGLE];
    const t = st.cur, k = ease(Math.min(1, (st.ropeT += dt) / st.ropeDur)), done = st.ropeT >= st.ropeDur;
    if (st.rope === 'idle') {
      st.hook = rest;
      if (st.phase === 'play' && !heli.intro && (st.grace -= dt) <= 0) {   // anyone close below? lower the rope
        let best = null, bd = 1e9;
        for (const c of st.targets) if (c.state === 'wait') {
          const dx = Math.abs(rest[0] - c.gx), dy = c.gy - rest[1];
          if (dx < 30 && dy > -10 && dy < 290 && dx + dy * 0.3 < bd) { bd = dx + dy * 0.3; best = c; }
        }
        if (best) { st.cur = best; best.state = 'grab'; rope('down', 0.3 + (best.gy - rest[1]) / 400); tone('triangle', 660, 0, 0.3, 0.06, 330); }
      }
    } else if (st.rope === 'down') {
      st.hook = [lerp(rest[0], t.gx, k), lerp(rest[1], t.gy, k)];
      if (done) {
        t.state = 'lift'; rope('up', 0.8);
        SFX.chime(); call(t); sparkle(t.gx, t.gy + 4, 8, 6);
        if (t.kind === 'balloon') t.free = true;
      }
    } else if (st.rope === 'up') {
      st.hook = [lerp(t.gx, dang[0], k), lerp(t.gy, dang[1], k)];
      if (done) { t.state = 'carry'; rope('carry', 1); }
    } else if (st.rope === 'carry') {
      st.hook = dang;
      const dy = p.dy - dang[1];
      if (Math.abs(dang[0] - p.dcx) < p.dw + 8 && dy > -8 && dy < 290) { t.state = 'lower'; rope('drop', 0.5 + dy / 300); SFX.boop(0.8); }
    } else if (st.rope === 'drop') {
      const land = [p.dcx, p.dy + 1 - hangOff(t)];
      st.hook = [lerp(dang[0], land[0], k), lerp(dang[1], land[1], k)];
      if (done) { t.state = 'run'; t.tt = 0; t.px = p.dcx; t.pyb = p.dy + 1; st.reelFrom = land; rope('reel', 0.5); SFX.pop(); }
    } else if (st.rope === 'reel') {
      st.hook = [lerp(st.reelFrom[0], rest[0], k), lerp(st.reelFrom[1], rest[1], k)];
      if (done) { rope('idle', 1); st.cur = null; }
    }
    // the rescued: run to the helper, a big hug, then inside and down to the street
    for (const c of st.targets) {
      if (c.free) { c.fy += dt * (12 + c.fy * 0.25); c.fx += dt * 6 * c.side; }
      if (c.state === 'wait' && (c.call -= dt) <= 0) {
        c.call = rand(3.5, 5.5);
        if (Math.abs(heli.x - c.gx) < 90 && st.rope === 'idle') call(c);
      }
      if (c.state === 'run') {
        c.tt += dt; const kk = Math.min(1, c.tt / 0.7);
        c.px = lerp(p.dcx, p.meetX, kk); c.pyb = Math.round(lerp(p.dy + 1, p.roof, kk));
        if (kk >= 1) {
          c.state = 'hug'; c.tt = 0; c.slot = st.saved++; c.savedAt = T;
          cheer(); call(c);
          for (let i = 0; i < 6; i++) st.hearts.push({ x: p.meetX + p.s * 4 + rand(-10, 10), y: p.roof - 22 + rand(-6, 4), t: 0, d: i * 0.12 });
          sparkle(p.meetX + p.s * 4, p.roof - 14, 12, 10);
        }
      } else if (c.state === 'hug') {
        if ((c.tt += dt) > 1.4) { c.state = 'walkin'; c.tt = 0; }
      } else if (c.state === 'walkin') {
        c.tt += dt; c.px = lerp(p.meetX, p.helperX, Math.min(1, c.tt / 0.5));
        if (c.tt >= 0.5) { c.state = 'saved'; const [gx] = groundSpot(c); sparkle(gx, G - 8, 8, 6, '#ffffff'); SFX.boop(1.2); }
      }
    }
    for (const h of st.hearts) h.t += dt;
    st.hearts = st.hearts.filter(h => h.t < h.d + 1.4);
    if (st.phase === 'play' && st.targets.every(c => c.state === 'saved')) {
      st.phase = 'done'; st.doneT = 0;
      SFX.fanfare(); say(pick('praise'));
    }
    if (st.phase === 'done') { st.doneT += dt; if (st.doneT < 2) confetti(3); }
    updateLife(dt);
  }
  function rope(state, dur) { st.rope = state; st.ropeT = 0; st.ropeDur = dur; }
  function groundSpot(c) { return [clamp(st.pad.cx + (c.slot - 1) * 15, L.safeL + 8, W - L.safeR - 8), st.G + 4]; }

  function updateLife(dt) {
    const G = st.G;
    // birds: fly across; scared by a tap or the helicopter
    st.birds.forEach((b, i) => {
      b.ph += dt * (b.flee ? 16 : 6);
      if (b.flee) { b.x += b.vx * 3.5 * dt; b.by -= 55 * dt; b.y = b.by; }
      else { b.x += b.vx * dt; b.y = b.by + Math.sin(T * 1.5 + b.seed) * 3; }
      if (!b.flee && Math.abs(b.x - heli.x) < 30 && Math.abs(b.y - heli.hy) < 22) scare(b);
      if (b.x < -20 || b.x > W + 20 || b.y < -20) st.birds[i] = newBird(false);
    });
    // clouds: flying through one makes a puff
    for (const c of clouds) {
      const r = Math.round(7 * c.s), cx = c.x + r + 1, cy = c.y - 1;
      const inside = Math.abs(heli.x - cx) < 2 * r + 6 && Math.abs(heli.hy - cy) < r + 6;
      if (inside && !c.inHeli) { SFX.whoosh(); puff(heli.x, heli.hy, 10, '#ffffff'); }
      if (inside && (c.puffT = (c.puffT || 0) - dt) <= 0) { c.puffT = 0.09; puff(heli.x + rand(-16, 16), heli.hy + rand(-4, 6), 2, '#ffffff'); }
      c.inHeli = inside;
    }
    // traffic
    if ((st.carT -= dt) <= 0) {
      st.carT = rand(1.4, 3.2);
      const lane = Math.random() < 0.5 ? 0 : 1, same = st.cars.filter(c => c.lane === lane);
      if (lane === 1 && same.every(c => c.x > 24)) {
        const v = Math.random() < 0.4 ? (Math.random() * 3) | 0 : -1, len = v < 0 ? 34 : V[v].len;
        st.cars.push({ lane, v, x: -len - 4, len, sp: rand(26, 40), rot: 0, lit: Math.random() < 0.6, col: PALETTE[(Math.random() * 7) | 0][2] });
      } else if (lane === 0 && same.every(c => c.x < W - 50)) {
        st.cars.push({ lane, v: -1, x: W + 4, len: 34, sp: rand(22, 34), rot: 0, col: PALETTE[(Math.random() * 7) | 0][2] });
      }
    }
    for (const c of st.cars) { c.x += (c.lane ? 1 : -1) * c.sp * dt; c.rot += c.sp * dt / 5; }
    st.cars = st.cars.filter(c => c.x < W + 10 && c.x > -c.len - 50);
    // people on the sidewalk stop and wave when the helicopter is overhead
    for (const p of st.peds) {
      p.near = Math.abs(p.x - heli.x) < 40 && heli.y < G - 30;
      if (!p.near) {
        p.x += p.dir * p.sp * dt;
        if (p.x < L.safeL + 8) { p.x = L.safeL + 8; p.dir = 1; }
        if (p.x > W - L.safeR - 8) { p.x = W - L.safeR - 8; p.dir = -1; }
      }
    }
  }
  function scare(b) { if (b.flee) return; b.flee = true; b.vx = (b.x < heli.x ? -1 : 1) * Math.max(14, Math.abs(b.vx)); SFX.peep(); setTimeout(SFX.peep, 90); }

  /* ---------- input ---------- */
  function tap(x, y, id) {
    if (inBox(L.homeBtn, x, y)) { hold = null; goScene('station'); return true; }
    if (st.phase === 'done' && st.doneT > 1.2 && inBox(L.againBtn, x, y, 6)) { hold = null; SFX.bell(); newRound(false); return true; }
    for (const b of st.birds) if (Math.abs(b.x - x) < 14 && Math.abs(b.y - y) < 12) scare(b);
    for (const t of st.targets) if (t.state === 'wait' && Math.abs(t.gx - x) < 14 && y > t.gy - 8 && y < t.yb + 4) { call(t); sparkle(t.gx, t.gy + 4, 8, 4, '#ffffff'); }
    const p = st.pad;
    if (Math.abs(x - p.helperX) < 8 && y > p.roof - 24 && y < p.roof + 2) { SFX.boop(1.1); sparkle(p.helperX, p.roof - 20, 8, 4); }
    hold = id; finger = [x, y]; heli.intro = false;
    if (T - st.lastChop > 1.5) { SFX.chop(); st.lastChop = T; }
    return true;
  }

  /* ---------- drawing: helicopter ---------- */
  function heliSprite() {
    const c = COLOR.red.c, f = Math.floor(T * 22) % 3, f2 = Math.floor(T * 30) % 2;
    hg.clearRect(0, 0, HW, HH);
    // tail boom, fin, stabilizer
    R(4, 13, 16, 4, c[1]); R(4, 13, 16, 1, c[0]); R(4, 16, 16, 1, c[2]); R(6, 15, 13, 1, '#f4f7fb');
    R(1, 5, 5, 10, c[1]); R(1, 5, 5, 1, c[0]); R(0, 8, 1, 7, c[2]);
    R(8, 17, 7, 2, c[2]);
    // tail rotor
    alpha(0.3, () => circle(3, 9, 5, '#cfd6dd'));
    if (f2) R(3, 4, 1, 11, '#5a5f6e'); else R(-2, 9, 11, 1, '#5a5f6e');
    R(2, 8, 3, 3, DK);
    // engine housing
    R(24, 6, 16, 1, c[0]); R(23, 7, 18, 3, c[1]); R(21, 8, 2, 2, DK); R(36, 8, 3, 1, c[2]);
    // cabin
    R(19, 10, 27, 14, c[1]); R(19, 10, 27, 1, c[0]); R(18, 12, 1, 10, c[1]);
    R(46, 11, 3, 11, c[1]); R(49, 13, 2, 8, c[1]); R(51, 15, 1, 5, c[1]);
    R(19, 24, 26, 2, c[2]); R(45, 22, 5, 2, c[2]); R(50, 20, 1, 2, c[2]);
    // windshield with the pilot
    R(39, 11, 7, 9, GLASS); R(46, 12, 3, 8, GLASS); R(49, 14, 2, 5, GLASS2);
    R(40, 18, 6, 2, '#f57a12');
    R(40, 12, 5, 4, '#ffffff'); R(41, 11, 3, 1, '#ffffff'); R(40, 13, 1, 2, '#e8222b');
    R(42, 15, 4, 3, SKIN[1]); R(44, 14, 2, 1, '#2f3240'); R(45, 16, 1, 1, INK); R(44, 17, 2, 1, '#a3121d');
    R(47, 13, 1, 3, '#ffffff'); R(38, 11, 1, 13, c[2]);
    // white stripe and the side door
    R(19, 20, 32, 2, '#f4f7fb');
    R(24, 11, 13, 12, c[2]); R(25, 12, 11, 10, c[1]); R(26, 13, 9, 5, GLASS); R(27, 14, 2, 1, '#ffffff');
    R(25, 20, 11, 2, '#f4f7fb'); R(33, 18, 2, 1, '#e9eef2');
    // rescue cross on the tail fin
    R(2, 8, 1, 3, '#ffffff'); R(1, 9, 3, 1, '#ffffff');
    // winch over the door
    R(17, 8, 9, 2, '#6b7480'); R(17, 10, 3, 2, '#cfd6dd');
    // searchlight, skids
    R(42, 26, 3, 2, '#cfd6dd');
    R(24, 26, 1, 4, DK); R(41, 26, 1, 4, DK); R(20, 30, 30, 1, DK); R(50, 29, 1, 1, DK); R(51, 28, 1, 1, DK);
    // main rotor
    R(31, 3, 2, 4, DK);
    alpha(0.22, () => R(2, 1, 60, 3, '#9aa3ad'));
    if (f === 0) R(2, 2, 60, 1, DK); else if (f === 1) R(10, 2, 44, 1, DK); else R(20, 2, 24, 1, DK);
    R(29, 1, 6, 3, '#5a5f6e');
  }
  function drawHelicopter() {
    const prev = g; g = hg; heliSprite(); g = prev;
    const hx0 = Math.round(heli.x) - OX, hy0 = Math.round(heli.hy) - OY;
    for (let i = 0; i < HW; i++) {
      const wx = hx0 + i;
      g.drawImage(hcv, heli.dir > 0 ? i : HW - 1 - i, 0, 1, HH, wx, hy0 + dyAt(wx), 1, HH);
    }
  }
  function line(x0, y0, x1, y1, c) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) R(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), 1, 1, c);
  }
  function drawRope() {
    const [ax, ay] = st.winch, [bx, by] = st.hook;
    line(ax, ay, bx, by, CABLE);
    const t = st.cur;
    if (t && lifted(t)) {
      const yb = by + hangOff(t);
      if (t.who !== 'person') { R(bx, by + 1, 1, 4, '#e8222b'); drawWho(t, bx, yb, 'hang', heli.dir); R(bx - 4, yb - 8, 9, 1, '#e8222b'); }
      else drawWho(t, bx, yb, 'hang', heli.dir);
    }
    R(bx - 1, by - 1, 3, 2, '#9aa3ad'); R(bx - 1, by + 1, 1, 1, '#6b7480');
  }

  /* ---------- drawing: rescuees ---------- */
  function drawKitty(x, yb, dir, col, hop) {
    const bx = Math.floor(x) - 7, top = Math.floor(yb - hop) - 13;
    const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 14 - dx - w, top + dy, w, h, c);
    const [lt, md, dk] = col, wag = Math.floor(T * 3) % 2;
    M(0, 3 + wag, 2, 7 - wag, md); M(1, 2 + wag, 2, 1, md);              // tail
    M(2, 7, 8, 6, md); M(3, 6, 6, 1, md); M(2, 12, 9, 1, dk);             // body
    M(4, 8, 1, 3, dk); M(6, 8, 1, 3, dk);                                 // stripes
    M(8, 8, 3, 5, md); M(8, 12, 3, 1, lt);                                // front paws
    M(7, 1, 7, 6, md); M(8, 0, 5, 1, md);                                 // head
    M(7, -1, 2, 2, md); M(12, -1, 2, 2, md); M(7, 0, 1, 1, '#ff9cc0'); M(13, 0, 1, 1, '#ff9cc0');
    M(9, 3, 1, 2, INK); M(12, 3, 1, 2, INK); M(10, 5, 2, 1, '#ff6fb4');
    M(9, 6, 4, 1, lt); M(14, 4, 1, 1, lt); M(6, 4, 1, 1, lt);
  }
  function drawPup(x, yb, dir, col, hop) {
    const bx = Math.floor(x) - 8, top = Math.floor(yb - hop) - 13;
    const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 16 - dx - w, top + dy, w, h, c);
    const [lt, md, ear] = col, wag = Math.floor(T * 6) % 2;
    M(0, 2 + wag, 2, 4, md); M(1, 5, 2, 1, md);                           // wagging tail
    M(2, 5, 10, 5, md); M(4, 8, 6, 2, lt);                                // body
    M(2, 10, 2, 3, md); M(5, 10, 2, 3, md); M(9, 10, 2, 3, md);
    M(2, 12, 2, 1, lt); M(5, 12, 2, 1, lt); M(9, 12, 2, 1, lt);
    M(9, 0, 6, 6, md); M(14, 3, 2, 3, lt); M(15, 3, 1, 1, INK);           // head and snout
    M(9, 1, 2, 5, ear); M(10, 0, 2, 1, ear);                              // floppy ear
    M(12, 2, 1, 2, INK); M(9, 6, 4, 1, '#e8222b');                        // eye, collar
    if (Math.floor(T * 2 + x) % 3 === 0) M(14, 6, 1, 2, '#ff6f8f');       // tongue
  }
  function drawWho(t, x, yb, pose, dir = 1) {
    if (t.who === 'cat') return drawKitty(x, yb, dir, t.col, pose === 'run' || pose === 'cheer' ? Math.abs(Math.sin(T * 10)) * 2 : 0);
    if (t.who === 'pup') return drawPup(x, yb, dir, t.col, pose === 'run' || pose === 'cheer' ? Math.abs(Math.sin(T * 10)) * 2 : 0);
    drawPerson({ type: t.ptype, x, yb, dir, pose: { wait: 'wave', hang: 'slide', run: 'stand', cheer: 'cheer', stand: 'wave' }[pose], walk: pose === 'run', skin: t.skin, seed: t.seed });
  }

  /* ---------- drawing: the town ---------- */
  function drawBackdrop() {
    const G = st.G;
    circle(W * 0.12, G + 46, 74, '#a8dd94'); circle(W * 0.62, G + 64, 100, '#a8dd94'); circle(W * 1.02, G + 44, 70, '#a8dd94');
    for (const t of st.targets) if (t.kind === 'ledge') {   // a far snowy peak behind the cliff
      const px = t.cx + t.side * Math.round(t.bh * 0.7), top = Math.max(st.minY + 10, t.top - 26), hgt = G - top;
      for (let y = top; y < G; y++) {
        const half = 3 + (t.bh + 8) * (y - top) / hgt;
        R(px - half, y, half * 2, 1, y - top < 9 ? '#eef3f8' : '#b8c8dc');
        R(px - half, y, half * 0.6, 1, y - top < 9 ? '#d6e0ea' : '#a6b8cf');
      }
    }
    for (const b of st.skyline) { R(b.x, G - 6 - b.h, b.w, b.h + 6, '#b9d7ea'); R(b.x, G - 6 - b.h, b.w, 1, '#cde3f1'); }
    R(0, G - 8, W, 8, '#6cbf5a');
  }
  function drawFiller(f) {
    const G = st.G;
    for (let k = 0; k < f.rh; k++) { const ww = Math.round((f.w + 4) * (k + 1) / f.rh); R(f.x + f.w / 2 - ww / 2, f.top - f.rh + k, ww, 1, f.roof); }
    R(f.x, f.top, f.w, f.h, f.wall[0]); R(f.x, f.top, 2, f.h, f.wall[1]);
    for (const w of f.wins) { R(w.x - 1, w.y - 1, w.w + 2, w.h + 2, '#ffffff'); R(w.x, w.y, w.w, w.h, GLASS); }
    R(f.x + Math.round(f.w / 2) - 3, G - 10, 6, 10, '#8a5a3a'); R(f.x + Math.round(f.w / 2) + 1, G - 5, 1, 1, '#ffd21f');
  }
  function winBox(w) { R(w.x - 1, w.y - 1, w.w + 2, w.h + 2, '#ffffff'); R(w.x, w.y, w.w, w.h, GLASS); R(w.x + 1, w.y + 1, 2, 1, '#ffffff'); }
  const waiting = t => t.state === 'wait' || t.state === 'grab';
  function drawRoofTarget(t) {
    const G = st.G;
    R(t.bx, t.top, t.bw, G - t.top, t.wall[0]); R(t.bx, t.top, 3, G - t.top, t.wall[1]);
    for (const w of t.wins) winBox(w);
    R(t.cx - 5, G - 13, 10, 13, '#ffffff'); R(t.cx - 4, G - 12, 8, 12, '#8a5a3a'); R(t.cx + 1, G - 6, 1, 1, '#ffd21f');
    R(t.cx - 7, G - 15, 14, 2, t.roofC);
    R(t.bx - 1, t.top - 2, t.bw + 2, 3, t.roofC); R(t.bx - 1, t.top + 1, t.bw + 2, 1, '#00000033');
    const x = t.tankX;   // water tank
    R(x - 3, t.top - 6, 1, 4, DK); R(x + 2, t.top - 6, 1, 4, DK);
    R(x - 4, t.top - 14, 8, 8, '#a8743a'); R(x - 4, t.top - 11, 8, 1, '#7a4a2a'); R(x - 4, t.top - 8, 8, 1, '#7a4a2a'); R(x - 3, t.top - 16, 6, 2, '#7a4a2a');
    if (waiting(t)) drawWho(t, t.x, t.yb, 'wait', t.side);
  }
  function drawTreeTarget(t) {
    const G = st.G, { cx, r, cy } = t;
    R(cx - 3, cy, 6, G - cy, '#7a4a2a'); R(cx - 3, cy, 2, G - cy, '#5e3a20');
    for (const f of t.tufts) {
      R(Math.min(cx, f.x), f.y + 2, Math.abs(f.x - cx) + 1, 2, '#7a4a2a');
      circle(f.x, f.y, f.r, '#3f9a45'); circle(f.x - 1, f.y - 2, Math.round(f.r * 0.6), '#5bb85a');
    }
    circle(cx - r * 0.5, cy + r * 0.35, Math.round(r * 0.7), '#3f9a45'); circle(cx + r * 0.5, cy + r * 0.35, Math.round(r * 0.7), '#3f9a45');
    circle(cx, cy, r, '#3f9a45'); circle(cx - 3, cy - 4, Math.round(r * 0.55), '#5bb85a');
    R(cx + 5, cy + 3, 2, 2, '#e8222b'); R(cx - 7, cy + 6, 2, 2, '#e8222b'); R(cx + 1, cy + 9, 2, 2, '#e8222b');
    if (waiting(t)) drawWho(t, t.x, t.yb, 'wait', 1);
    circle(cx - 5, t.ctop + 5, 4, '#5bb85a'); circle(cx + 5, t.ctop + 6, 4, '#3f9a45');
  }
  function drawBalloonTarget(t) {
    const G = st.G, cx = t.cx, ty = t.ty, hgt = G - ty;
    const half = y => 3 + 6 * (y - ty) / hgt;
    for (let y = ty; y < G; y++) {
      const h = half(y), c = Math.floor((y - ty) / 10) % 2 ? '#f4f7fb' : '#e8222b';
      R(cx - h - 1, y, 2, 1, c); R(cx + h - 1, y, 2, 1, c);
    }
    for (let y = ty + 4; y + 10 < G; y += 10) { line(cx - half(y), y, cx + half(y + 10) - 1, y + 10, '#9aa3ad'); line(cx + half(y) - 1, y, cx - half(y + 10), y + 10, '#9aa3ad'); }
    R(cx - 7, ty, 14, 2, DK);
    R(cx - t.side * 6, ty - 6, 1, 6, DK);   // little antenna for the warning light
    // the balloon (floats away once the kid is safe)
    const ox = Math.round(t.free ? t.fx : 0), oy = Math.round(t.free ? -t.fy : 0);
    if (ty + oy < -80) return;
    const bx = cx + ox, by = ty + oy, ex = bx + t.side * 14, ey = by - 30, [c0, c1] = t.bal;
    line(bx - 5, by - 7, ex - 5, ey + 10, '#7a4a2a'); line(bx + 5, by - 7, ex + 5, ey + 10, '#7a4a2a');
    circle(ex, ey, 12, c0);
    for (let dy = -12; dy <= 12; dy++) { const w = Math.sqrt(156 - dy * dy); R(ex - w * 0.4, ey + dy, w * 0.8, 1, c1); R(ex - w * 0.08, ey + dy, Math.max(1, w * 0.16), 1, c0); }
    R(ex - 5, ey + 10, 10, 3, c0); R(ex - 5, ey + 12, 10, 1, '#00000033');
    R(ex - 8, ey - 6, 2, 5, '#ffffff');
    if (waiting(t)) drawWho(t, cx, t.yb, 'wait', -t.side);
    R(bx - 7, by - 8, 14, 1, '#7a4a2a'); R(bx - 6, by - 7, 12, 7, '#a8743a'); R(bx - 6, by - 5, 12, 1, '#7a4a2a'); R(bx - 6, by - 2, 12, 1, '#7a4a2a');
  }
  function drawPondTarget(t) {
    const G = st.G, cx = t.cx, hw = t.pw >> 1;
    for (let dy = 0; dy <= 12; dy++) { const w = hw * Math.sqrt(1 - ((12 - dy) / 13) ** 2); R(cx - w, G - 12 + dy, 2 * w, 1, '#4f9a45'); }
    for (let dy = -5; dy <= 5; dy++) { const w = (hw - 3) * Math.sqrt(1 - (dy / 5.5) ** 2); R(cx - w, G - 6 + dy, 2 * w, 1, dy < -2 ? '#6fb6ff' : '#3f8fd6'); }
    const sh = Math.floor(T * 2) % 3;
    R(cx - hw + 8 + sh * 2, G - 4, 4, 1, '#bfe6ff'); R(cx + hw - 14 - sh, G - 2, 3, 1, '#bfe6ff');
    // a duck paddling on the left half
    const dk = Math.sin(T * 0.6), dxp = cx - hw + 9 + (dk + 1) / 2 * Math.max(4, hw - 20);
    drawDuck(dxp, G - 2, true, Math.cos(T * 0.6) > 0 ? 1 : -1);
    // island with a palm tree
    for (let dy = -3; dy <= 3; dy++) { const w = 9 * Math.sqrt(1 - (dy / 3.5) ** 2); R(cx - w, G - 7 + dy, 2 * w, 1, dy < -1 ? '#5bb85a' : '#e8d08a'); }
    for (let j = 0; j < 17; j++) R(cx + 6 + Math.round(Math.sin(j / 16 * 1.3) * 3), G - 9 - j, 2, 1, j % 3 ? '#8a5a3a' : '#6b4226');
    const px = cx + 9, py = G - 26;
    for (const [dx, dy] of [[-6, 2], [6, 2], [-4, -2], [4, -2], [0, -3]]) line(px, py, px + dx, py + dy + 2, '#3f9a45');
    R(px - 1, py - 1, 3, 2, '#3f9a45'); R(px - 2, py + 1, 2, 2, '#7a4a2a');
    if (waiting(t)) drawWho(t, t.x, t.yb, 'wait', -1);
  }
  function drawLedgeTarget(t) {
    const G = st.G;
    for (let y = t.top; y < G; y++) {
      const half = ledgeHalf(t, y), xl = Math.round(t.cx - half), w = Math.round(2 * half), d = y - t.top;
      const snow = d < 5 + Math.round(hsh(Math.floor(d) * 3 + t.seed) * 2);
      R(xl, y, w, 1, snow ? '#ffffff' : G - y < 7 ? '#5aa84c' : '#9a8a78');
      R(xl, y, Math.round(w * 0.32), 1, snow ? '#dfe8f0' : G - y < 7 ? '#4f9a45' : '#7d6e60');
      if (!snow && G - y >= 7 && d % 9 === 4) R(xl + Math.round(w * 0.4), y, Math.round(w * 0.35), 1, '#b3a490');
    }
    const fx = t.cx + 4 * t.side, wave = Math.floor(T * 4) % 2;   // a little flag on the summit
    R(fx, t.top - 13, 1, 13, DK);
    R(t.side > 0 ? fx + 1 : fx - 6, t.top - 13 + wave, 6, 4, '#ffd21f');
    if (waiting(t)) drawWho(t, t.x, t.yb, 'wait', -t.side);
  }
  function drawPadBuilding() {
    const p = st.pad, G = st.G, hosp = st.padType === 'hosp';
    const wall = hosp ? ['#f4f7fb', '#d5dde6'] : ['#c8432f', '#a3352a'];
    R(p.bx, p.roof, p.bw, G - p.roof, wall[0]); R(p.bx, p.roof, 3, G - p.roof, wall[1]);
    if (!hosp) for (let y = p.roof + 3; y < G; y += 4) for (let x = p.bx + ((y >> 2) % 2) * 4; x < p.bx + p.bw; x += 8) R(x, y, 1, 3, '#b53b2a');
    for (const w of p.wins) winBox(w);
    R(p.bx - 1, p.roof - 1, p.bw + 2, 2, '#6b7480');
    if (hosp) {
      R(p.cx - 7, p.roof + 4, 15, 19, '#ffffff'); R(p.cx - 6, p.roof + 5, 13, 17, '#2a6fe0');
      text('H', p.cx - 4, p.roof + 6, 3, '#ffffff');
      R(p.cx - 7, G - 14, 14, 14, '#9aa3ad'); R(p.cx - 6, G - 13, 12, 13, GLASS); R(p.cx, G - 13, 1, 13, '#9aa3ad');
      R(p.cx - 1, G - 21, 3, 6, '#e8222b'); R(p.cx - 3, G - 19, 7, 2, '#e8222b');
    } else {
      R(p.cx - 10, p.roof + 4, 21, 9, '#ffffff'); text('FIRE', p.cx - 7, p.roof + 6, 1, '#e8222b');
      R(p.cx - 13, G - 19, 26, 19, '#f4f7fb'); R(p.cx - 12, G - 18, 24, 18, '#cfd6dd');
      for (let y = G - 16; y < G; y += 3) R(p.cx - 12, y, 24, 1, '#b4bec8');
      R(p.cx - 9, G - 13, 18, 4, GLASS);
    }
    // stair hut, deck on little legs
    R(p.hutX, p.roof - 11, 9, 11, wall[1]); R(p.hutX - 1, p.roof - 12, 11, 2, '#6b7480'); R(p.hutX + 2, p.roof - 8, 5, 8, '#5a5f6e');
    R(p.dcx - p.dw + 4, p.dy + 3, 2, p.roof - p.dy - 3, DK); R(p.dcx + p.dw - 6, p.dy + 3, 2, p.roof - p.dy - 3, DK);
    const ell = (oy, sc, c) => { for (let dy = -p.dh; dy <= p.dh; dy++) { const w = p.dw * sc * Math.sqrt(1 - (dy / (p.dh + 0.5)) ** 2); R(p.dcx - w, p.dy + oy + Math.round(dy * sc), 2 * w, 1, c); } };
    ell(2, 1, '#2a2e38'); ell(0, 1, '#4b505e'); ell(0, 0.82, '#ffd21f'); ell(0, 0.68, '#4b505e');
    R(p.dcx - 4, p.dy - 2, 2, 5, '#ffffff'); R(p.dcx + 3, p.dy - 2, 2, 5, '#ffffff'); R(p.dcx - 2, p.dy, 5, 1, '#ffffff');
    // the helper and whoever was just rescued
    for (const t of st.targets) if (t.state === 'walkin') drawWho(t, t.px, p.roof, 'run', p.s);
    const party = st.phase === 'done' || st.targets.some(t => t.state === 'hug');
    drawPerson({ type: hosp ? 'medic' : 'ff', x: p.helperX, yb: p.roof, dir: -p.s, pose: party ? 'cheer' : 'wave', skin: st.helperSkin, seed: 3 });
    for (const t of st.targets) {
      if (t.state === 'run') drawWho(t, t.px, t.pyb, 'run', p.s);
      else if (t.state === 'hug') drawWho(t, p.meetX, p.roof, 'cheer', p.s);
    }
  }
  function drawStreet() {
    const G = st.G, ry = G + 5;
    R(0, G, W, 5, '#d8d2c2'); R(0, G, W, 1, '#b9b2a0');
    R(0, ry, W, L.palY - ry, '#4b4f5c'); R(0, ry, W, 2, '#8f8b80');
    for (let x = 4; x < W; x += 18) R(x, G + 20, 9, 1, '#ffd21f');
    for (const p of st.peds) drawPerson({ type: p.type, x: p.x, yb: G + 4, dir: p.near ? (heli.x > p.x ? 1 : -1) : p.dir, pose: p.near ? 'wave' : 'stand', walk: !p.near, skin: p.skin, seed: p.seed });
    for (const t of st.targets) if (t.state === 'saved') {
      const [x, yb] = groundSpot(t);
      drawWho(t, x, yb, st.phase === 'done' ? 'cheer' : 'stand', heli.x > x ? 1 : -1);
    }
    for (const c of st.cars) if (c.lane === 0) {
      const x = Math.floor(c.x);
      g.save(); g.translate(2 * x + 34, 0); g.scale(-1, 1); drawCar(x, G + 19, c.col, -c.rot); g.restore();
    }
    for (const c of st.cars) if (c.lane === 1) {
      if (c.v < 0) drawCar(c.x, G + 34, c.col, c.rot);
      else drawV(c.v, c.x, G + 34, c.lit, 0, c.rot);
    }
  }
  function drawBird(b) {
    const x = Math.round(b.x), y = Math.round(b.y), up = Math.floor(b.ph) % 2, c = '#2f3240';
    R(x - 1, y, 4, 2, c); R(b.vx > 0 ? x + 3 : x - 2, y, 1, 1, '#f57a12');
    if (up) { R(x - 4, y - 3, 2, 1, c); R(x - 2, y - 2, 2, 1, c); R(x + 2, y - 2, 2, 1, c); R(x + 4, y - 3, 2, 1, c); }
    else { R(x - 4, y + 2, 2, 1, c); R(x - 2, y + 1, 2, 1, c); R(x + 2, y + 1, 2, 1, c); R(x + 4, y + 2, 2, 1, c); }
  }

  /* ---------- drawing: lights and hints ---------- */
  function arrow(x, tipY, c, dk) {
    const y = Math.round(tipY - Math.abs(Math.sin(T * 4.5)) * 5);
    x = Math.round(x);
    R(x - 3, y - 13, 7, 8, dk); R(x - 7, y - 6, 15, 1, dk);
    for (let k = 0; k <= 6; k++) R(x - k - 1, y - k + 1, 2 * k + 3, 1, dk);
    R(x - 2, y - 12, 5, 7, c);
    for (let k = 0; k <= 5; k++) R(x - k, y - k, 2 * k + 1, 1, c);
    R(x - 1, y - 11, 1, 4, '#ffffff');
  }
  function bubble(x, y) {
    const w = 25, h = 11, bx = clamp(Math.round(x) - 12, 1, W - w - 1), by = Math.round(y) - h - 3;
    R(bx, by, w, h, '#3a3d46'); R(bx + 1, by + 1, w - 2, h - 2, '#ffffff');
    R(Math.round(x) - 1, by + h - 1, 3, 2, '#ffffff'); R(Math.round(x), by + h + 1, 1, 1, '#ffffff');
    text('HELP!', bx + 3, by + 3, 1, '#e8222b');
  }
  function heart(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    R(x - 3, y, 2, 1, c); R(x + 1, y, 2, 1, c); R(x - 3, y + 1, 6, 2, c); R(x - 2, y + 3, 4, 1, c); R(x - 1, y + 4, 2, 1, c);
    R(x - 2, y + 1, 1, 1, '#ffffff');
  }
  function lit(k, x, y, c, r = 3) { if (k > 0.02) alpha(0.4 * k, () => circle(x, y, r, c)); }
  function drawLights(k) {
    const G = st.G, p = st.pad;
    if (k > 0.02) {
      const wins = [...p.wins, ...st.fillers.flatMap(f => f.wins), ...st.targets.flatMap(t => t.wins || [])];
      alpha(k, () => { for (const w of wins) if (w.on) { R(w.x, w.y, w.w, w.h, WARM_WIN); R(w.x + 1, w.y + 1, 2, 1, '#fff1c4'); } });
      alpha(k * 0.8, () => { for (const b of st.skyline) for (const [x, y] of b.dots) R(x, y, 1, 1, '#ffe9a8'); });
      for (const c of st.cars) if (c.v < 0) {
        const x = Math.floor(c.x), hx = c.lane ? x + 34 : x - 1, yb = c.lane ? G + 34 : G + 19;
        alpha(0.6 * k, () => { R(hx, yb - 8, 1, 2, '#fffbe6'); circle(hx, yb - 7, 3, '#fff3b0'); });
      }
      // searchlight from the helicopter's belly
      const [sx, sy] = hp(43, 28), floor = st.prof[clamp(sx, 0, W)] || G, len = Math.max(8, floor - sy), lean = heli.dir * 0.22;
      for (let j = 0; j < len; j += 2) { const half = 1.5 + j * 0.22; alpha(0.13 * k * (1 - j / (len * 1.3)), () => R(sx - half + j * lean, sy + j, half * 2, 2, '#fff3b0')); }
      const ex = sx + len * lean, eh = 1.5 + len * 0.22;
      alpha(0.25 * k, () => { for (let dy = -2; dy <= 2; dy++) { const w = eh * Math.sqrt(1 - (dy / 2.5) ** 2); R(ex - w, floor + dy, 2 * w, 1, '#fff3b0'); } });
    }
    // tower warning light
    for (const t of st.targets) if (t.kind === 'balloon' && Math.floor(T * 1.5 + t.seed) % 2) {
      const bx = t.cx - t.side * 6;
      R(bx - 1, t.ty - 8, 3, 2, RED_ON); lit(k, bx, t.ty - 7, RED_ON, 4);
    }
    // helipad lights chase around the deck (faster when someone is coming)
    const fast = st.rope === 'carry' || st.rope === 'drop', step = Math.floor(T * (fast ? 10 : 3));
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * i / 6, x = Math.round(p.dcx + Math.cos(a) * (p.dw - 1)), y = Math.round(p.dy + Math.sin(a) * p.dh);
      const on = step % 7 === i || step % 7 === (i + 3) % 7;
      R(x, y, 1, 1, on ? '#7dff8a' : '#2f8a4a');
      if (on) lit(k, x, y, '#7dff8a', 2);
    }
    // helicopter nav lights
    const blink = Math.floor(T * 2.5) % 2;
    const [tx, ty] = hp(2, 4), [nx, ny] = hp(50, 17), [bx, by] = hp(32, 25);
    if (blink) { R(tx, ty, 2, 1, RED_ON); lit(k, tx, ty, RED_ON, 4); }
    R(nx, ny, 1, 2, '#5cff7a'); lit(k, nx, ny, '#5cff7a', 2);
    if ((T * 1.3) % 1 < 0.08) { R(bx, by, 2, 1, '#ffffff'); lit(k, bx, by, '#ffffff', 5); }
  }
  function drawHints() {
    if (st.phase !== 'play') return;
    const p = st.pad;
    if (st.rope === 'carry' || st.rope === 'up') arrow(p.dcx, p.dy - 10, '#5cff7a', '#1f7a2a');
    else if (st.rope === 'idle') for (const t of st.targets) if (t.state === 'wait') {
      arrow(t.gx, t.gy - 17, '#ffd21f', '#b14c06');
      if ((T + t.seed) % 4 < 2.2) bubble(t.gx, t.gy - 1);
    }
  }

  /* ---------- drawing: UI ---------- */
  function drawProgress() {
    const n = st.targets.length, cy = L.palY + Math.floor(L.palH / 2), r = Math.max(8, Math.min(11, Math.floor(L.palH / 4)));
    st.targets.forEach((t, i) => {
      const cx = W - L.safeR - r - 6 - (n - 1 - i) * (2 * r + 6), ok = isSaved(t), pop = ok && T - t.savedAt < 0.5 ? 2 : 0;
      circle(cx, cy + 2, r + 1, '#2f6b29'); circle(cx, cy, r + 1 + pop, '#ffffff'); circle(cx, cy, r + pop, ok ? '#ffd21f' : '#4a9440');
      alpha(ok ? 1 : 0.35, () => face(t, cx, cy));
    });
  }
  function face(t, cx, cy) {
    if (t.who === 'cat') {
      const c = t.col;
      R(cx - 5, cy - 5, 2, 3, c[1]); R(cx + 3, cy - 5, 2, 3, c[1]); circle(cx, cy + 1, 5, c[1]);
      R(cx - 2, cy, 1, 2, INK); R(cx + 2, cy, 1, 2, INK); R(cx, cy + 2, 1, 1, '#ff6fb4');
    } else if (t.who === 'pup') {
      const c = t.col;
      circle(cx, cy + 1, 5, c[1]); R(cx - 6, cy - 3, 2, 6, c[2]); R(cx + 5, cy - 3, 2, 6, c[2]);
      R(cx - 2, cy, 1, 2, INK); R(cx + 2, cy, 1, 2, INK); R(cx - 1, cy + 2, 3, 1, INK);
    } else {
      circle(cx, cy + 1, 5, t.skin); R(cx - 5, cy - 4, 11, 3, '#5a3a22');
      R(cx - 2, cy, 1, 2, INK); R(cx + 2, cy, 1, 2, INK); R(cx - 1, cy + 3, 3, 1, '#a3121d');
    }
  }
  function heliIcon(cx, cy, s) {
    const u = Math.max(1, Math.floor(s * 0.7 / 16)), spin = Math.floor(T * 14) % 2, wh = '#ffffff';
    R(cx - (spin ? 7 : 4) * u, cy - 6 * u, (spin ? 14 : 8) * u, u, wh); R(cx, cy - 5 * u, u, 2 * u, wh);
    circle(cx + u, cy, 4 * u, wh);
    R(cx - 8 * u, cy - u, 6 * u, 2 * u, wh); R(cx - 8 * u, cy - 4 * u, 2 * u, 4 * u, wh);
    R(cx - 3 * u, cy + 5 * u, 9 * u, u, wh); R(cx - u, cy + 4 * u, u, u, wh); R(cx + 3 * u, cy + 4 * u, u, u, wh);
    R(cx + 2 * u, cy - 2 * u, 2 * u, 2 * u, GLASS2);
  }

  SCENES.chopper = {
    view: [186, 200],
    freeTouch: true,   // touch anywhere flies the helicopter
    state: { st, heli },   // read by the automated tests
    layout,
    groundY: () => st.G,
    enter() {
      hold = null;
      newRound(true);
      initLife();
      Object.assign(heli, { x: -40, y: st.minY + 40, vx: 60, vy: 0, dir: 1, tilt: 0, intro: true });
      setClouds(L.safeT + 22, Math.max(L.safeT + 50, st.G - 90));
      SFX.chop(); st.lastChop = T;
      say('helicopter');
    },
    leave() { hold = null; rotor(0); },
    update,
    tap,
    move(x, y, id) { if (id === hold) finger = [x, y]; },
    release(id) { if (id === hold) hold = null; },
    drawWorld() {
      drawBackdrop();
      for (const t of st.targets) if (t.kind === 'ledge') drawLedgeTarget(t);
      for (const f of st.fillers) drawFiller(f);
      for (const t of st.targets) if (t.kind !== 'ledge') ({ roof: drawRoofTarget, tree: drawTreeTarget, balloon: drawBalloonTarget, pond: drawPondTarget })[t.kind](t);
      drawPadBuilding();
      drawStreet();
      for (const b of st.birds) drawBird(b);
      drawHelicopter();
      drawRope();
    },
    drawLit() {
      drawLights(nightK());
      for (const h of st.hearts) if (h.t > h.d) { const a = h.t - h.d; alpha(Math.min(1, (1.4 - a) * 2), () => heart(h.x + Math.sin(a * 5 + h.d * 9) * 2, h.y - a * 16, '#ff4f8a')); }
      drawHints();
      drawParticles();
    },
    drawUI() {
      drawStrip();
      drawHomeButton();
      drawProgress();
      if (st.phase === 'done' && st.doneT > 1.2) drawAgainButton(L.againBtn, '#e8222b', '#a3121d', heliIcon);
    },
  };
})();
