// "Fireboat Rescue": the red fireboat chugs around a sunny harbor. Tap or drag on the water to
// steer it. Ducklings and kids in swim rings bob in the waves: drive over and they hop aboard
// (YAY!), then bring them to the dock where their family (or mama duck) is waiting for a hug.
// Now and then a fire starts on the warehouse roof or on a little sailboat: the fireboat races
// over and the big water cannon follows your finger until every flame is out. A whale spouts,
// gulls swoop, the dogs and the cat wait on the dock, and every rescue gets a toot and confetti.
'use strict';
(() => {
  const { bar, oval, hsh, hand, arrow } = TOY;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = k => clamp(k, 0, 1);

  /* ---------- sounds ---------- */
  const SND = TOY.bank({
    horn: ['boat-horn', 0.5], toot: ['boat-toot', 0.5], motor: ['boat-motor', 0.3], waves: ['boat-waves', 0.35],
    gull: ['boat-gull', 0.22], gull2: ['boat-gull2', 0.28], steam: ['boat-steam', 0.5],
    splash: ['bath-splash', 0.55], splash2: ['bath-splash2', 0.5], plop: ['splash', 0.6], water: ['bath-water', 0.4],
    pop: ['bath-pop', 0.55], chime: ['mv-chime', 0.45], squeak: ['bath-squeak', 0.4],
  }, {
    horn() { tone('sawtooth', 220, 0, 1.2, 0.07); tone('square', 277, 0, 1.2, 0.04); },
    toot() { tone('sawtooth', 220, 0, 0.4, 0.07); tone('square', 277, 0, 0.4, 0.04); },
    gull() { tone('sawtooth', 1400, 0, 0.18, 0.04, 900); tone('sawtooth', 1500, 0.22, 0.18, 0.04, 1000); },
    gull2() { tone('sawtooth', 1600, 0, 0.15, 0.04, 1000); },
    steam() { noise(0, 0.5, 0.2, 4000, 0.6); },
    splash() { noise(0, 0.5, 0.15, 1400, 0.7); }, splash2() { noise(0, 0.7, 0.15, 1100, 0.7); }, plop() { noise(0, 0.4, 0.2, 900, 0.8); },
    pop() { tone('sine', 900, 0, 0.06, 0.08, 300); }, chime() { SFX.chime(); }, squeak() { tone('sine', 1400, 0, 0.15, 0.08, 1900); },
  }, 'boat-music', 0.2);
  const motor = SND.loop('motor'), waves = SND.loop('waves'), hose = SND.loop('water');
  const toot = long => SND.play(long ? 'horn' : 'toot', long ? 1 : 1 + Math.random() * 0.12);

  /* ---------- layout ---------- */
  // Portrait: the dock runs along the bottom of the screen. Landscape: it's the land on the left.
  const Y = {};
  let rect0 = null;   // the water area of the last layout, to carry everything across a rotation
  function layout() {
    const room = H - L.safeT - L.safeB, uw = W - L.safeL - L.safeR;
    Y.side = H > W * 1.1 ? 'bottom' : 'left';
    Y.home = { x: L.safeL + 4, y: H - L.safeB - L.blob - 4, s: L.blob };
    if (Y.side === 'bottom') {
      Y.hz = L.safeT + clamp(Math.round(room * 0.2), 44, 110);
      Y.qy = H - L.safeB - clamp(Math.round(room * 0.2), 58, 96);
      Y.wL = 0; Y.wB = Y.qy;
      Y.bx = Math.round(L.safeL + uw * 0.4); Y.by = Y.qy + 1; Y.bdir = 1;
      Y.fam = [[Y.bx - 18, Y.qy + 16, 1], [Y.bx, Y.qy + 19, 1], [Y.bx + 18, Y.qy + 16, -1]];
      Y.mama = [Math.max(L.safeL + 22, Y.bx - 46), Y.qy - 10, 1];
      const ww = clamp(Math.round(uw * 0.32), 46, 64);
      Y.shed = { x: W - L.safeR - ww - 3, w: ww, base: Y.qy + 34, h: 28 };
      Y.moor = [W - L.safeR - 30, Math.round(lerp(Y.hz, Y.qy, 0.62))];
      Y.pets = { y: H - L.safeB - 3, x0: L.safeL + L.blob + 12, x1: Y.shed.x - 4 };
      Y.light = [L.safeL + 24, Y.hz + 3];
      Y.lamp = [L.safeL + 8, Y.qy + 12];
      Y.byMax = Y.qy + 1;
    } else {
      Y.hz = L.safeT + clamp(Math.round(room * 0.3), 40, 74);
      Y.qx = L.safeL + clamp(Math.round(uw * 0.27), 64, 110);
      Y.wL = Y.qx; Y.wB = H;
      Y.bx = Y.qx + 34; Y.by = Math.round(Y.hz + (H - L.safeB - Y.hz) * 0.5); Y.bdir = -1;
      Y.fam = [[Y.qx - 10, Y.by + 3, 1], [Y.qx - 25, Y.by - 6, 1], [Y.qx - 26, Y.by + 13, 1]];
      Y.mama = [Y.qx + 14, Math.min(H - L.safeB - 4, Y.by + 22), 1];
      const ww = clamp(Y.qx - L.safeL - 18, 40, 66);
      Y.shed = { x: L.safeL + 4, w: ww, base: Y.hz + 30, h: 26 };
      Y.moor = [W - L.safeR - 44, Math.round(lerp(Y.hz, H - L.safeB, 0.8))];
      Y.pets = { y: H - L.safeB - 3, x0: L.safeL + L.blob + 10, x1: Y.qx - 7 };
      Y.light = [Math.round(lerp(Y.qx, W - L.safeR, 0.3)), Y.hz + 3];
      Y.lamp = [Y.qx - 9, Y.hz + 28];
      Y.byMax = H - L.safeB - 3;
    }
    const s = Y.shed;
    Y.door = [Math.round(s.x + s.w * 0.38), s.base];
    Y.bxMin = Y.wL + 32; Y.bxMax = W - L.safeR - 32; Y.byMin = Y.hz + 30;
    Y.r = { x0: Y.wL + 14, x1: W - L.safeR - 14, y0: Y.hz + 12, y1: Y.byMax - 4 };
    Y.maxV = clamp(Math.round(Math.max(W, H) * 0.2), 50, 85);
    if (scene === 'boat') {
      L.sunY = Math.min(L.sunY, Y.hz - 24);   // keep the sun up in the sky over the sea
      setClouds(L.safeT + 8, Math.max(L.safeT + 20, Y.hz - 16));
      carryOver();
    }
    rect0 = Object.assign({}, Y.r);
  }
  // after a rotation, move everything on the water to the same spot of the new harbor
  function carryOver() {
    if (!rect0 || !st.boat) return;
    const o = rect0, n = Y.r;
    const mx = x => lerp(n.x0, n.x1, (x - o.x0) / Math.max(1, o.x1 - o.x0)), my = y => lerp(n.y0, n.y1, (y - o.y0) / Math.max(1, o.y1 - o.y0));
    const b = st.boat;
    b.x = clamp(mx(b.x), Y.bxMin, Y.bxMax); b.y = clamp(my(b.y), Y.byMin, Y.byMax); b.tx = b.x; b.ty = b.y;
    for (const f of st.floaters) { f.x = clamp(mx(f.x), n.x0, n.x1); f.y = clamp(my(f.y), n.y0, n.y1); }
    if (st.whale) { st.whale.x = mx(st.whale.x); st.whale.y = my(st.whale.y); }
    if (st.mama && st.mama.state === 'swim') st.mama = null;
    st.fams = st.fams.filter(f => f.state !== 'leave');
    for (const f of st.fams) [f.x, f.y, f.dir] = Y.fam[f.slot];
    if (st.mama) [st.mama.x, st.mama.y] = Y.mama;
    if (st.deliver) { b.x = Y.bx; b.y = Y.by; }
    st.wake = []; st.rings = []; st.spray.t = 0;
  }

  /* ---------- state ---------- */
  const SLOTS = [-24, -15, -6];   // where riders stand on the back deck
  const KIDS = ['kid', 'kid2', 'kid3'], PARENTS = ['mom', 'dad', 'gran'];
  const st = {
    clock: 0, idle: 0, hold: null, batches: 0, fires: 0, rescues: 0,
    boat: { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, dir: 1, carry: [], wakeT: 0 },
    floaters: [], hoppers: [], fams: [], mama: null, deliver: null, fire: null, soot: null,
    spray: { t: 0, ax: 0, ay: 0, fountain: false }, whale: null, gulls: [], sails: [], wake: [], rings: [], words: [], hearts: [],
    nextFire: 0, nextWhale: 0, nextBatch: 0, nextGull: 0, sirenOff: null, sirenT: 0, steamT: 0, splashT: 0, smokeT: 0,
  };
  const bob = () => Math.round(Math.sin(T * 2.4) * 1.2);
  const slotPos = i => [st.boat.x + st.boat.dir * SLOTS[i], st.boat.y + bob() - 10];
  const pivot = () => [st.boat.x + st.boat.dir * 21, st.boat.y + bob() - 15];
  const moorPos = () => [Y.moor[0], Y.moor[1] + Math.round(Math.sin(T * 1.8 + 1))];
  function word(s, x, y, c = '#ffd21f') { st.words.push({ s, x, y, c, t: 0 }); }
  function heartsAt(x, y, n = 3) { for (let i = 0; i < n; i++) st.hearts.push({ x: x + rand(-6, 6), y: y + rand(-3, 3), vy: -rand(10, 18), life: 1.6 + Math.random() * 0.4 }); }

  /* ---------- the water ---------- */
  const SEA = ['#a4dcf6', '#86cff2', '#6ac0ec', '#55b1e5', '#45a3dc', '#3896d2', '#2e89c8'];
  function waterC(y) { const k = clamp01((y - Y.hz) / Math.max(1, Y.wB - Y.hz)); return SEA[Math.min(SEA.length - 1, Math.floor(k * SEA.length))]; }
  function sea() {
    const x0 = Y.wL, x1 = W, top = Y.hz, bot = Y.wB, n = SEA.length;
    for (let i = 0; i < n; i++) { const a = Math.round(top + (bot - top) * i / n), b = Math.round(top + (bot - top) * (i + 1) / n); R(x0, a, x1 - x0, b - a + 1, SEA[i]); }
    R(x0, top, x1 - x0, 1, '#d8f2fc');
    // gentle waves: little crests that drift along and bob up and down
    const span = x1 - x0 + 40, cnt = Math.round((x1 - x0) * (bot - top) / 70);
    for (let i = 0; i < cnt; i++) {
      const y = Math.round(top + 3 + hsh(i * 3.1) * (bot - top - 4)), k = (y - top) / (bot - top);
      const len = 2 + Math.round(k * 5 + hsh(i) * 2), x = x0 - 20 + (hsh(i * 7.7) * span + T * (3 + k * 7)) % span;
      const up = Math.sin(T * 1.7 + i * 1.3);
      if (up > -0.6) R(x, y, len, 1, k < 0.35 ? '#c8ecfc' : '#9ed8f6');
      if (up > 0.4) R(x + 1, y - 1, Math.max(1, len - 2), 1, '#eefaff');
    }
  }
  function lip(x, y, hw) {   // the water surface in front of something floating
    x = Math.round(x); y = Math.round(y);
    R(x - hw, y, hw * 2 + 1, 2, waterC(y));
    for (let k = -hw + (Math.floor(T * 4) % 3); k < hw; k += 4) R(x + k, y, 2, 1, '#e6f8ff');
  }
  function hill(cx, r, h, c) { for (let i = -r; i <= r; i++) { const hh = Math.round(h * Math.sqrt(1 - (i / (r + 0.5)) ** 2)); if (hh > 0) R(cx + i, Y.hz - hh, 1, hh, c); } }
  function lighthouse(x, y) {
    oval(x, y, 15, 3, '#7a756c'); oval(x - 2, y - 2, 10, 3, '#9a958d'); oval(x - 4, y - 3, 6, 2, '#6cbf5a');
    for (let r = 0; r < 26; r++) { const w = 9 - Math.round(r / 12) * 2; R(x - (w >> 1), y - 4 - r, w, 1, Math.floor(r / 5) % 2 ? '#ffffff' : '#e8222b'); }
    R(x - 1, y - 8, 3, 4, '#5a3a22');
    R(x - 5, y - 31, 11, 2, '#2f3240'); R(x - 3, y - 35, 7, 4, '#2f3240'); R(x - 2, y - 34, 5, 3, '#fff6b0');
    R(x - 4, y - 36, 9, 1, '#e8222b'); R(x - 3, y - 37, 7, 1, '#e8222b'); R(x - 1, y - 38, 3, 1, '#e8222b'); R(x, y - 40, 1, 2, '#2f3240');
  }
  function sailboat(x, y, c, s = 1) {   // far away on the horizon
    x = Math.round(x); y = Math.round(y);
    R(x - 4 * s, y - 2, 9 * s, 2, c); R(x - 3 * s, y, 7 * s, 1, mix(c, '#000000', 0.3));
    for (let k = 0; k < 7 * s; k++) R(x, y - 3 - k, Math.round((7 * s - k) * 0.55), 1, '#ffffff');
    R(x - 1, y - 3 - 7 * s, 1, 7 * s + 1, '#8a6a4a');
  }
  function farSea() {
    sea();
    if (Y.side === 'bottom') { hill(W - L.safeR - 30, 34, 9, '#8fd877'); hill(W - L.safeR - 6, 22, 6, '#7cc96a'); }
    else { hill(Y.qx + 10, 40, 8, '#8fd877'); }
    for (const s of st.sails) sailboat(s.x, Y.hz + 2, s.c, s.s);
    lighthouse(Y.light[0], Y.light[1]);
  }

  /* ---------- the dock ---------- */
  function planks(x0, y0, x1, y1, joint) {
    R(x0, y0, x1 - x0, y1 - y0, '#c8945a');
    for (let y = y0 + 5, row = 0; y < y1; y += 6, row++) {
      R(x0, y, x1 - x0, 1, '#a8743f');
      for (let x = x0 + (row % 2) * (joint >> 1); x < x1; x += joint) R(x, y - 5, 1, 5, '#b8844a');
    }
    for (let i = 0; i < (x1 - x0) * (y1 - y0) / 160; i++) R(x0 + Math.round(hsh(i * 3.3) * (x1 - x0 - 2)), y0 + 1 + Math.round(hsh(i * 5.1) * (y1 - y0 - 3)), 2, 1, '#d8a46a');
  }
  function bollard(x, y) { R(x - 2, y - 5, 5, 6, '#3a3d46'); R(x - 3, y - 6, 7, 2, '#5a5e6a'); R(x - 1, y - 4, 1, 3, '#6a6e7a'); }
  function dockBottom() {
    const y0 = Y.qy;
    planks(0, y0, W, H, 34);
    R(0, y0, W, 3, '#7a4a24'); R(0, y0, W, 1, '#9a6a3a');
    for (let x = 22; x < W; x += 52) if (Math.abs(x - Y.bx) > 34) bollard(x, y0 + 6);
    // a ladder down to the water and a life ring on a post
    R(Y.bx + 38, y0 - 6, 1, 9, '#7a4a24'); R(Y.bx + 43, y0 - 6, 1, 9, '#7a4a24'); for (let k = 0; k < 3; k++) R(Y.bx + 38, y0 - 5 + k * 3, 6, 1, '#7a4a24');
  }
  function dockLeft() {
    const x1 = Y.qx;
    hill(Math.round(Y.qx * 0.35), 34, 10, '#8fd877'); hill(Math.round(Y.qx * 0.85), 24, 7, '#7cc96a');
    R(0, Y.hz - 1, x1, 4, '#6cbf5a');
    planks(0, Y.hz + 3, x1 - 3, H, 26);
    R(x1 - 4, Y.hz + 3, 4, H - Y.hz, '#7a4a24'); R(x1 - 1, Y.hz + 3, 1, H - Y.hz, '#5a3418');
    for (let y = Y.hz + 10; y < H; y += 16) { R(x1, y, 3, 4, '#5a3418'); R(x1, y + 4, 3, 1, waterC(y + 4)); }
    for (let y = Y.hz + 22; y < H - 6; y += 34) if (Math.abs(y - Y.by) > 12) bollard(x1 - 7, y);
  }
  function crate(x, yb, s) { R(x, yb - s, s, s, '#c08a52'); R(x, yb - s, s, 1, '#dca86a'); R(x, yb - 1, s, 1, '#8a5a32'); for (let i = 1; i < s - 1; i++) { R(x + i, yb - s + i, 1, 1, '#8a5a32'); R(x + s - 1 - i, yb - s + i, 1, 1, '#8a5a32'); } }
  function shedRoofY() { return Y.shed.base - Y.shed.h - 5; }
  function shedDraw() {
    const s = Y.shed, x = s.x, w = s.w, b = s.base, top = b - s.h, rh = 7;
    R(x, top, w, s.h, '#c8553a');
    for (let yy = top + 3, row = 0; yy < b; yy += 3, row++) { R(x, yy, w, 1, '#b04a32'); for (let bx = x + (row % 2) * 3; bx < x + w; bx += 6) R(bx, yy - 2, 1, 2, '#b04a32'); }
    R(x, top, w, 1, '#e07050');
    for (let k = 0; k < rh; k++) R(x - 3 + k, top - 1 - k, w + 6 - 2 * k, 1, k % 2 ? '#5a6a8a' : '#4d5d7d');
    R(x - 3, top - 1, w + 6, 1, '#3a4a6a');
    // the big door, with an anchor over it
    const dx = Y.door[0], dh = Math.min(s.h - 7, 16);
    R(dx - 8, b - dh - 1, 16, dh + 1, '#f4f7fb'); R(dx - 7, b - dh, 14, dh, '#6a4a2a'); R(dx, b - dh, 1, dh, '#5a3a1a');
    for (let i = 0; i < dh; i++) { const k = Math.round(i * 6 / dh); R(dx - 7 + k, b - dh + i, 1, 1, '#8a6a3a'); R(dx + 6 - k, b - dh + i, 1, 1, '#8a6a3a'); }
    const ay = b - dh - 6; R(dx, ay, 1, 5, '#ffffff'); R(dx - 2, ay + 1, 5, 1, '#ffffff'); R(dx - 2, ay + 4, 1, 1, '#ffffff'); R(dx + 2, ay + 4, 1, 1, '#ffffff'); R(dx - 1, ay + 5, 3, 1, '#ffffff');
    // a round window
    const wx = Math.round(x + w * 0.8), wy = top + Math.round(s.h * 0.4);
    circle(wx, wy, 4, '#ffffff'); circle(wx, wy, 3, GLASS); R(wx - 3, wy, 7, 1, '#ffffff'); R(wx, wy - 3, 1, 7, '#ffffff');
    // crates and a barrel
    crate(x + w - 10, b, 9); crate(x + w - 8, b - 9, 7);
    R(x + 1, b - 9, 7, 9, '#2a6fe0'); R(x + 1, b - 7, 7, 1, '#1a3f9a'); R(x + 1, b - 3, 7, 1, '#1a3f9a'); R(x + 2, b - 9, 2, 9, '#6fb6ff');
    if (st.soot && st.soot.where === 'shed') alpha(clamp01(st.soot.life / 2) * 0.8, () => { for (const k of [0.25, 0.5, 0.75]) { const sx = Math.round(x + w * k); R(sx - 4, top - 4, 8, 3, '#2f3240'); R(sx - 2, top - 6, 4, 2, '#2f3240'); } });
  }
  function lampPost() {
    const [x, b] = Y.lamp;
    R(x - 1, b - 2, 4, 2, '#2f3240'); R(x, b - 26, 2, 24, '#2f3240'); R(x - 2, b - 29, 6, 3, '#2f3240'); R(x - 1, b - 28, 4, 2, '#fff6b0'); R(x - 1, b - 31, 4, 2, '#2f3240');
  }

  /* ---------- the fireboat ---------- */
  const HULL = ['#ff7a6b', '#e8222b', '#e8222b', '#e8222b', '#f4f7fb', '#e8222b', '#c81a24', '#c81a24', '#a3121d', '#a3121d'];
  // facing dir, waterline at (x, yb); about 60 long. o: { riders, aim (angle of the cannon) }
  function fireboat(x, yb, dir, o = {}) {
    x = Math.round(x); yb = Math.round(yb);
    const P = (dx, dy, w, h, c) => R(dir > 0 ? x + dx : x - dx - w, yb + dy, w, h, c);
    const ph = Math.floor(T * 6) % 2, fw = Math.floor(T * 5) % 2;
    // a mast with a flag
    P(-5, -39, 1, 15, '#5a5e6a'); P(-4, -39, 6 + fw, 2, '#ffd21f'); P(-4, -37, 5 + (1 - fw), 2, '#e8222b');
    // the cabin, with the captain at the wheel
    P(-7, -24, 18, 14, '#f4f7fb'); P(-7, -24, 18, 1, '#ffffff'); P(-7, -11, 18, 1, '#cfd8e2'); P(10, -22, 1, 12, '#cfd8e2');
    P(-5, -21, 5, 5, GLASS); P(-4, -20, 1, 2, '#ffffff'); P(2, -21, 6, 5, GLASS); P(9, -21, 1, 5, GLASS2);
    P(4, -20, 3, 3, SKIN[0]); P(3, -21, 5, 1, '#e8222b'); P(4, -22, 3, 1, '#e8222b'); P(6, -19, 1, 1, INK); P(3, -17, 5, 1, '#d8b04f');
    P(-9, -26, 22, 2, '#e8222b'); P(-9, -26, 22, 1, '#ff7a6b');
    P(-3, -28, 4, 2, ph ? RED_ON : RED_OFF); P(1, -28, 2, 2, '#ffffff'); P(3, -28, 4, 2, ph ? RED_OFF : RED_ON);
    // the hull, its raised bow and a white stripe
    for (let r = 0; r < 10; r++) { const a = -28 + Math.round(r * 0.3), b = 31 - Math.max(0, r - 2); P(a, -10 + r, b - a, 1, HULL[r]); }
    P(16, -13, 16, 1, '#ff7a6b'); P(16, -12, 16, 2, '#e8222b'); P(31, -13, 1, 3, '#ff7a6b');
    for (const px of [-20, -12, 22]) { P(px, -5, 2, 2, GLASS); P(px, -5, 1, 1, '#ffffff'); }
    for (const fx of [-18, -4, 9]) { P(fx, -9, 3, 4, '#2f3240'); P(fx + 1, -8, 1, 2, '#5a5e6a'); }
    // riders on the back deck, behind the railing
    (o.riders || []).forEach((r, i) => rider(r, x + dir * SLOTS[i], yb - 10, dir));
    P(-27, -14, 43, 1, '#f4f7fb'); for (let px = -27; px < 16; px += 5) P(px, -14, 1, 4, '#f4f7fb');
    // a life ring on the railing
    P(-26, -15, 5, 5, '#ffffff'); P(-25, -14, 3, 3, '#e8222b'); P(-24, -13, 1, 1, '#c81a24'); P(-26, -13, 1, 1, '#e8222b'); P(-22, -13, 1, 1, '#e8222b');
    // the big brass water cannon on the bow
    const cx = x + dir * 21, cy = yb - 15, a = o.aim != null ? o.aim : (dir > 0 ? -0.6 : Math.PI + 0.6);
    P(18, -15, 6, 3, '#c99410'); P(19, -16, 4, 1, '#ffd21f');
    bar(cx, cy, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 4, '#ffd21f', true);
    bar(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 3, '#9aa3ad');
    R(cx - 1, cy - 1, 2, 2, '#c99410');
  }

  /* ---------- the little ones ---------- */
  function duckling(x, yb, dir = 1) {
    x = Math.round(x); yb = Math.round(yb);
    const M = (dx, dy, w, h, c) => R(dir > 0 ? x + dx : x - dx - w, yb + dy, w, h, c);
    const Yl = '#ffd21f', Ys = '#e0b010';
    M(-5, -6, 2, 2, Yl); M(-4, -5, 8, 5, Yl); M(-3, -1, 6, 1, Ys); M(-2, -3, 4, 1, Ys);
    M(0, -10, 5, 5, Yl); M(2, -11, 2, 1, Yl); M(5, -8, 2, 2, '#f57a12'); M(3, -9, 1, 1, INK);
  }
  function ringAt(x, y) {   // a red and white swim ring, side on
    x = Math.round(x); y = Math.round(y);
    R(x - 6, y, 13, 3, '#ffffff'); R(x - 7, y + 1, 15, 1, '#ffffff');
    R(x - 7, y + 1, 3, 1, '#e8222b'); R(x - 6, y, 3, 3, '#e8222b'); R(x + 1, y, 3, 3, '#e8222b'); R(x + 5, y + 1, 3, 1, '#e8222b');
    R(x - 5, y + 2, 11, 1, 'rgba(0,0,0,0.12)');
  }
  function rider(r, x, yb, dir, pose = 'cheer') {
    if (r.kind === 'duck') { duckling(x, yb, dir); return; }
    drawPerson({ type: r.type, x, yb, dir, pose, skin: r.skin, seed: r.seed });
    ringAt(x, yb - 8);
  }
  function floaterDraw(f) {
    const x = Math.round(f.x), wy = Math.round(f.y + Math.sin(T * 2 + f.seed) * 1.2);
    if (f.r.kind === 'duck') { duckling(x, wy + 2, f.dir); lip(x, wy + 1, 6); return; }
    g.save(); g.beginPath(); g.rect(x - 10, wy - 30, 21, 30); g.clip();
    drawPerson({ type: f.r.type, x, yb: wy + 7, dir: f.dir, pose: Math.floor(T * 0.8 + f.seed) % 3 ? 'wave' : 'cheer', skin: f.r.skin, seed: f.r.seed });
    g.restore();
    ringAt(x, wy - 2);
    lip(x, wy + 1, 9);
    if (Math.floor(T * 2 + f.seed) % 2) { R(x - 11, wy + 1, 2, 1, '#ffffff'); R(x + 10, wy + 1, 2, 1, '#ffffff'); }
  }
  function mamaDraw() {
    const m = st.mama, wy = Math.round(m.y + Math.sin(T * 1.8) * 1);
    drawDuck(m.x, wy + 2 - Math.round(m.hop || 0), true, m.dir, 0);
    lip(m.x, wy + 1, 7);
    m.babies.forEach((r, i) => { const bx = m.x - m.dir * (10 + i * 8), by = wy + Math.round(Math.sin(T * 3 + i) * 1); duckling(bx, by + 2, m.dir); lip(bx, by + 1, 5); });
  }
  function moored() {
    const [x, y] = moorPos();
    R(x, y - 27, 1, 23, '#8a6a4a');
    for (let k = 0; k < 19; k++) R(x + 1, y - 26 + k, Math.round(k * 0.55) + 1, 1, '#ffffff');
    for (let k = 0; k < 14; k++) R(x - Math.round(k * 0.4), y - 21 + k, Math.round(k * 0.4), 1, '#ffe9b8');
    R(x - 12, y - 5, 25, 1, '#ffffff'); R(x - 12, y - 4, 25, 2, '#2a6fe0'); R(x - 11, y - 2, 23, 1, '#1f58b8'); R(x - 10, y - 1, 21, 1, '#1a3f9a');
    R(x + 18, y - 2, 3, 3, '#e8222b'); R(x + 18, y - 3, 3, 1, '#ffffff'); R(x + 12, y - 3, 6, 1, '#cfd8e2');   // its buoy
    if (st.soot && st.soot.where === 'moor') alpha(clamp01(st.soot.life / 2) * 0.8, () => { R(x + 2, y - 14, 5, 4, '#3a3d46'); R(x - 6, y - 7, 6, 2, '#3a3d46'); R(x + 4, y - 7, 6, 2, '#3a3d46'); });
    lip(x, y, 13);
  }
  function whaleDraw(w) {
    const x = Math.round(w.x), y = Math.round(w.y), d = w.dir, c = '#3a5a8a', c2 = '#5a7aaa';
    if (w.t < 4) {
      const hh = Math.round(8 * clamp01(w.t / 0.8) * clamp01((4 - w.t) / 0.4 + 0.3));
      if (hh > 0) {
        for (let i = -17; i <= 17; i++) { const top = Math.round(hh * Math.sqrt(1 - (i / 18) ** 2)); if (top > 0) { R(x + i, y - top, 1, top + 1, c); if (Math.abs(i + d * 4) < 9) R(x + i, y - top, 1, 1, c2); } }
        if (hh > 4) { R(x + d * 11, y - 5, 1, 1, '#ffffff'); R(x + d * 11 - (d > 0 ? 0 : 1), y - 5, 2, 1, '#ffffff'); R(x + d * 11, y - 5, 1, 1, INK); R(x + d * 8 - (d > 0 ? 0 : 3), y - 2, 4, 1, '#1a2a4a'); R(x + d * 3, y - hh, 2, 1, '#1a2a4a'); }
      }
    } else {   // diving: the tail flips up and slides away
      const k = clamp01((w.t - 4) / 1.3), up = Math.round(Math.sin(k * Math.PI) * 11), tx = x - d * 8;
      if (up > 0) {
        R(tx - 1, y - up, 3, up, c);
        R(tx - 7, y - up - 2, 6, 2, c); R(tx + 2, y - up - 2, 6, 2, c); R(tx - 8, y - up - 4, 3, 2, c); R(tx + 6, y - up - 4, 3, 2, c);
        R(tx - 6, y - up - 2, 4, 1, c2);
      }
    }
    lip(x, y, 20);
  }
  function gullDraw(gl) {
    const x = Math.round(gl.x), y = Math.round(gl.y), f = Math.floor(T * (gl.flee > 0 ? 12 : 5) + gl.p) % 2, c = '#ffffff', tip = '#9aa3ad';
    R(x - 2, y, 5, 2, c); R(x + (gl.vx > 0 ? 3 : -3), y, 1, 1, '#ffb020');
    if (f) { R(x - 6, y - 2, 3, 1, tip); R(x - 3, y - 1, 2, 1, c); R(x + 2, y - 1, 2, 1, c); R(x + 4, y - 2, 3, 1, tip); }
    else { R(x - 6, y + 1, 3, 1, tip); R(x - 3, y, 2, 1, c); R(x + 2, y, 2, 1, c); R(x + 4, y + 1, 3, 1, tip); }
  }
  function famDraw(f) {
    const hop = Math.round(Math.max(0, f.hop) * 4);
    const waving = f.state === 'wait' ? (st.boat.carry.some(r => r.fam === f) ? 'cheer' : Math.floor(T * 0.7 + f.slot) % 3 ? 'wave' : 'stand') : f.state === 'hug' ? 'cheer' : 'stand';
    const walk = f.state === 'leave';
    drawPerson({ type: f.type, x: f.x, yb: f.y, dir: f.dir, pose: waving, skin: f.skin, seed: f.slot, hop, walk });
    if (f.kid) drawPerson({ type: f.kid.type, x: f.x + f.kdx, yb: f.y + 1, dir: walk ? f.dir : -Math.sign(f.kdx), pose: f.state === 'hug' ? 'cheer' : 'stand', skin: f.kid.skin, seed: f.slot + 3, walk, hop: f.state === 'hug' ? Math.round(Math.abs(Math.sin(T * 6)) * 2) : 0 });
  }

  /* ---------- the water cannon ---------- */
  function arc(ax, ay) {
    const [px, py] = pivot(), d = Math.hypot(ax - px, ay - py), h = 6 + d * 0.16;
    return { px, py, h, f: t => [lerp(px, ax, t), lerp(py, ay, t) - 4 * h * t * (1 - t)], d };
  }
  function cannonAngle() {
    const b = st.boat, s = st.spray;
    if (s.t <= 0) return b.dir > 0 ? -0.6 : Math.PI + 0.6;
    const A = arc(s.ax, s.ay);
    return Math.atan2((s.ay - A.py) - 4 * A.h, s.ax - A.px);
  }
  function streamDraw() {
    const s = st.spray;
    if (s.t <= 0) return;
    const a = cannonAngle(), A = arc(s.ax, s.ay), n = Math.max(14, Math.round(A.d / 3)), on = clamp01(s.t / 0.25);
    const tip = [A.px + Math.cos(a) * 11, A.py + Math.sin(a) * 11];
    const f = t => { const [x, y] = A.f(t); const k = clamp01(t * 3); return [lerp(tip[0], x, k), lerp(tip[1], y, k)]; };
    const reach = on < 1 ? on : 1;
    for (let k = 0; k <= n * reach; k++) { const [x, y] = f(k / n); circle(x, y, k / n > 0.7 ? 4 : 3, '#3a9ee0'); }
    for (let k = 0; k <= n * reach; k++) { const [x, y] = f(k / n); circle(x, y, k / n > 0.7 ? 3 : 2, '#7ccaf4'); }
    for (let k = 0; k <= n * reach; k++) { const [x, y] = f(k / n); R(x - 1, y - 1, 2, 1, '#c8eeff'); }
    for (let j = 0; j < 9; j++) { const t = (j / 9 + T * 2.4) % 1; if (t > reach) continue; const [x, y] = f(t); R(x - 1, y - 1, 2, 2, '#ffffff'); }
    if (reach >= 1) { const r = 3 + Math.floor(T * 14) % 2; alpha(0.8, () => circle(s.ax, s.ay, r, '#e6f8ff')); R(s.ax - 1, s.ay - 1, 2, 2, '#ffffff'); }
  }

  /* ---------- what's going on ---------- */
  function freeSpot(minBoat = 50) {
    const rr = Y.r;
    let best = null;
    for (let i = 0; i < 40; i++) {
      const x = rand(rr.x0 + 6, rr.x1 - 6), y = rand(rr.y0 + 4, rr.y1 - 6), [mx, my] = Y.moor;
      const ok = Math.hypot(x - st.boat.x, (y - st.boat.y) * 1.5) > minBoat && Math.hypot(x - Y.bx, (y - Y.by) * 1.5) > 40 && Math.hypot(x - mx, (y - my) * 1.5) > 28
        && st.floaters.every(f => Math.hypot(x - f.x, (y - f.y) * 1.5) > 26) && !(Y.side === 'bottom' && x > Y.shed.x - 8 && y > Y.qy - 12);
      if (ok) return [x, y];
      if (!best) best = [x, y];
    }
    return best;
  }
  function spawnBatch() {
    const free = [0, 1, 2].filter(s => !st.fams.some(f => f.slot === s && f.state !== 'leave'));
    let kind = st.batches % 2 ? 'duck' : 'kid';
    if (kind === 'duck' && st.mama) kind = 'kid';
    if (kind === 'kid' && !free.length) kind = st.mama ? null : 'duck';
    if (!kind) return false;
    st.batches++;
    if (kind === 'kid') {
      const n = Math.min(free.length, st.batches === 1 || Math.random() < 0.6 ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const slot = free[i], [fx, fy, fd] = Y.fam[slot], skin = SKIN[Math.floor(Math.random() * SKIN.length)];
        const fam = { slot, type: PARENTS[(st.batches + i) % 3], skin, x: fx, y: fy, dir: fd, state: 'wait', t: 0, hop: 0, kid: null, kdx: 0 };
        st.fams.push(fam);
        const [x, y] = freeSpot();
        st.floaters.push({ x, y, seed: Math.random() * 9, dir: Math.random() < 0.5 ? 1 : -1, r: { kind: 'kid', type: KIDS[(st.batches * 2 + i) % 3], skin, seed: i + st.batches, fam } });
      }
    } else {
      const [mx, my, md] = Y.mama;
      st.mama = { x: mx, y: my, dir: md, state: 'wait', t: 0, hop: 0, babies: [], coming: 0 };
      const [x0, y0] = freeSpot(60);
      for (let i = 0; i < 3; i++) {
        const x = clamp(x0 + (i - 1) * 13, Y.r.x0, Y.r.x1), y = clamp(y0 + (i % 2) * 6, Y.r.y0, Y.r.y1);
        st.floaters.push({ x, y, seed: Math.random() * 9, dir: x0 > W / 2 ? -1 : 1, r: { kind: 'duck', seed: i } });
      }
    }
    SND.play('plop', 1.2, 0.6);
    return true;
  }
  function pickUp(f) {
    const b = st.boat, idx = b.carry.length + st.hoppers.filter(h => h.toBoat).length;
    st.floaters.splice(st.floaters.indexOf(f), 1);
    SND.play('splash', 1.15, 0.7);
    st.rings.push({ x: f.x, y: f.y, life: 1 });
    st.hoppers.push({ r: f.r, x0: f.x, y0: f.y + 4, to: () => slotPos(idx), t: 0, dur: 0.5, h: 20, dir: b.dir, toBoat: true, land() {
      b.carry.push(f.r);
      const [x, y] = slotPos(b.carry.length - 1);
      sparkle(x, y - 14, 8, 6, '#ffffff');
      if (f.r.kind === 'duck') { SFX.peep(); setTimeout(() => SFX.peep(), 120); word('PEEP!', x, y - 34, '#ffd21f'); }
      else { SND.play('chime'); word('YAY!', x, y - 36, '#ffd21f'); }
    } });
  }
  function unload() {
    const b = st.boat, r = b.carry.pop(), [x0, y0] = slotPos(b.carry.length);
    if (r.kind === 'kid') {
      const fam = r.fam, side = fam.dir > 0 ? 9 : -9;
      st.hoppers.push({ r, x0, y0, to: () => [fam.x + side, fam.y + 1], t: 0, dur: 0.55, h: 22, dir: -Math.sign(side), land() {
        fam.kid = r; fam.kdx = side; fam.state = 'hug'; fam.t = 0; fam.hop = 1;
        heartsAt(fam.x + side / 2, fam.y - 24, 4); SND.play('pop', 1.2); SFX.boop(1.2);
        delivered();
      } });
    } else {
      const m = st.mama, i = m.babies.length + m.coming++;
      st.hoppers.push({ r, x0, y0, to: () => [m.x - m.dir * (10 + i * 8), m.y + 2], t: 0, dur: 0.5, h: 18, dir: m.dir, land() {
        m.coming--; m.babies.push(r); SND.play('plop', 1.3, 0.7); SFX.quack(); m.hop = 4;
        st.rings.push({ x: m.x - m.dir * (10 + i * 8), y: m.y, life: 1 });
        heartsAt(m.x, m.y - 14, 2);
        delivered();
      } });
    }
  }
  function delivered() {
    if (!st.deliver || st.boat.carry.length || st.hoppers.some(h => !h.toBoat)) return;
    st.deliver = null; st.rescues++;
    const b = st.boat;
    confetti(40); sparkle(b.x, b.y - 24, 24, 14, '#fff27a'); toot(true); SFX.fanfare();
    word('HOORAY!', Y.bx, Y.by - 46, '#ffd21f');
    // the dogs (and the cat) on the dock cheer too
    const tr = PETS._troupes.boat;
    if (tr) {
      const who = ['vizsla', 'husky', 'cat'][st.rescues % 3];
      PETS.poke('boat', who); setTimeout(() => PETS.poke('boat', who === 'cat' ? 'vizsla' : 'cat'), 450);
      const p = tr.pets.find(q => q.who === who);
      if (p && p.sx != null) word(who === 'cat' ? 'MEOW!' : 'WOOF!', p.sx, p.sy - 24, '#ffffff');
    }
    if (st.mama && st.mama.babies.length) { st.mama.state = 'swim'; st.mama.t = 0; }
  }
  function firePts() {
    if (!st.fire) return [];
    if (st.fire.where === 'shed') { const s = Y.shed, y = shedRoofY(); return [0.22, 0.5, 0.78].map(k => [Math.round(s.x + s.w * k), y + 2]); }
    const [x, y] = moorPos(); return [[x - 7, y - 5], [x + 4, y - 9], [x + 9, y - 5]];
  }
  function startFire() {
    const where = st.fires++ % 2 ? 'moor' : 'shed';
    st.fire = { where, s: [1, 1, 1], t: 0 };
    const pts = firePts(), [fx, fy] = pts[1];
    word('UH OH!', fx, fy - 40, '#ff6b5b');
    SFX.bell(); st.sirenOff = siren('fire'); st.sirenT = 2.8;
    // race over to a good spot to spray from
    const b = st.boat, side = fx > (Y.wL + W) / 2 ? -1 : 1;
    b.tx = clamp(fx + side * 58, Y.bxMin, Y.bxMax);
    b.ty = clamp(where === 'shed' ? (Y.side === 'bottom' ? Y.qy - 22 : Y.shed.base + 26) : fy + 20, Y.byMin, Y.byMax);
    st.idle = 0;
  }
  function fireOut() {
    const pts = firePts(), [fx, fy] = pts[1];
    st.soot = { where: st.fire.where, life: 8 };
    st.fire = null; st.nextFire = st.clock + 32 + Math.random() * 16;
    word('HOORAY!', fx, fy - 40, '#ffd21f');
    confetti(36); toot(true); SFX.fanfare(); SND.play('steam', 0.8);
    for (const [x, y] of pts) puff(x, y - 6, 8, '#e6e6ee');
    if (st.sirenOff) { st.sirenOff(); st.sirenOff = null; }
  }
  function spout(w) {
    const x = w.x + w.dir * 3, y = w.y - 8;
    spawn(30, () => ({ x: x + rand(-1, 1), y, vx: rand(-16, 16), vy: -rand(55, 95), g: 120, life: 1.2, max: 1.2, s: Math.random() < 0.5 ? 2 : 1, c: Math.random() < 0.4 ? '#ffffff' : '#bfe6ff' }));
    SFX.whoosh(); SND.play('plop', 0.7, 0.7);
    word('SPLASH!', w.x, w.y - 40, '#bfe6ff');
  }
  function startWhale() {
    const rr = Y.r, b = st.boat;
    let x = 0, y = 0;
    for (let i = 0; i < 20; i++) { x = rand(rr.x0 + 24, rr.x1 - 24); y = rand(rr.y0 + 4, lerp(rr.y0, rr.y1, 0.4)); if (Math.hypot(x - b.x, y - b.y) > 60 && Math.abs(x - Y.light[0]) > 24 && st.floaters.every(f => Math.hypot(x - f.x, (y - f.y) * 2) > 34)) break; }
    st.whale = { x, y, dir: Math.random() < 0.5 ? 1 : -1, t: 0, spouted: false };
  }
  function resetBits() {
    st.gulls = Array.from({ length: 3 }, (_, i) => ({ x: rand(0, W), y0: 0, y: 0, k: 0.2 + i * 0.3, vx: (i % 2 ? -1 : 1) * rand(9, 15), p: i * 2, flee: 0 }));
    st.sails = [{ x: rand(0, W), v: 2.5, c: '#e8222b', s: 1 }, { x: rand(0, W), v: -1.6, c: '#2a6fe0', s: 1 }];
  }

  function update(dt) {
    st.clock += dt; st.idle += dt;
    const b = st.boat;
    // steering
    let speed = 0;
    if (st.deliver) {
      const k = Math.min(1, dt * 5);
      b.x += (Y.bx - b.x) * k; b.y += (Y.by - b.y) * k; b.vx = b.vy = 0; b.dir = Y.bdir;
      st.deliver.t += dt;
      if (b.carry.length && st.deliver.t > 0.5 && st.deliver.t - st.deliver.last > 0.45) { st.deliver.last = st.deliver.t; unload(); }
    } else {
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy), sp = Math.min(Y.maxV, d * 2.4);
      const wx = d > 0.5 ? dx / d * sp : 0, wy = d > 0.5 ? dy / d * sp * 0.8 : 0, k = Math.min(1, dt * 2.6);
      b.vx += (wx - b.vx) * k; b.vy += (wy - b.vy) * k;
      b.x = clamp(b.x + b.vx * dt, Y.bxMin, Y.bxMax); b.y = clamp(b.y + b.vy * dt, Y.byMin, Y.byMax);
      speed = Math.hypot(b.vx, b.vy);
      if (b.vx > 8) b.dir = 1; else if (b.vx < -8) b.dir = -1;
      else if (st.spray.t > 0 && !st.spray.fountain && Math.abs(st.spray.ax - b.x) > 16) b.dir = Math.sign(st.spray.ax - b.x);
    }
    motor(0.35 + 0.65 * clamp01(speed / Y.maxV), 0.85 + 0.35 * clamp01(speed / Y.maxV));
    waves(1);
    // the wake
    b.wakeT -= dt;
    if (speed > 10 && b.wakeT <= 0) { b.wakeT = 0.05; st.wake.push({ x: b.x - b.dir * 28, y: b.y + bob(), life: 1.3, max: 1.3 }); }
    for (const w of st.wake) w.life -= dt;
    st.wake = st.wake.filter(w => w.life > 0);
    for (const r of st.rings) r.life -= dt * 0.9;
    st.rings = st.rings.filter(r => r.life > 0);

    // floaters bob and drift; the boat picks them up as it goes by
    for (const f of st.floaters) {
      f.x = clamp(f.x + Math.sin(T * 0.4 + f.seed) * 2.5 * dt, Y.r.x0, Y.r.x1);
      f.y = clamp(f.y + Math.cos(T * 0.3 + f.seed) * 1.2 * dt, Y.r.y0, Y.r.y1);
      if (Math.abs(f.x - b.x) > 14) f.dir = Math.sign(b.x - f.x);
    }
    if (!st.deliver) {
      for (const f of st.floaters.slice()) {
        const room = 3 - b.carry.length - st.hoppers.filter(h => h.toBoat).length;
        if (room > 0 && Math.abs(f.x - b.x) < 32 && f.y - b.y > -16 && f.y - b.y < 12) pickUp(f);
      }
    }
    // hop on, hop off
    for (const h of st.hoppers) h.t += dt;
    const landed = st.hoppers.filter(h => h.t >= h.dur);
    st.hoppers = st.hoppers.filter(h => h.t < h.dur);
    landed.forEach(h => h.land());
    // back at the dock with passengers: everybody off!
    if (!st.deliver && b.carry.length && !st.hoppers.some(h => h.toBoat) && Math.abs(b.x - Y.bx) < 34 && Math.abs(b.y - Y.by) < 18) {
      st.deliver = { t: 0, last: -1 }; st.idle = 0; st.hold = null; toot(false);
    }
    // families hug, then head home through the warehouse door
    for (const f of st.fams) {
      f.hop = Math.max(0, f.hop - dt * 3);
      if (f.state === 'wait' && b.carry.some(r => r.fam === f) && Math.random() < dt * 1.5) f.hop = 1;
      if (f.state === 'hug') {
        f.t += dt;
        if (Math.random() < dt * 3) heartsAt(f.x + f.kdx / 2, f.y - 24, 1);
        if (f.t > 2.6) { f.state = 'leave'; f.t = 0; }
      } else if (f.state === 'leave') {
        const [dx, dy] = Y.door, ddx = dx - f.x, ddy = dy - f.y, d = Math.hypot(ddx, ddy);
        if (Math.abs(ddx) > 1) f.dir = Math.sign(ddx);
        f.kdx = -f.dir * 9;
        if (d < 2) f.gone = true;
        else { f.x += ddx / d * 22 * dt; f.y += ddy / d * 22 * dt; }
      }
    }
    st.fams = st.fams.filter(f => !f.gone);
    // mama duck paddles off with her babies in a row
    const m = st.mama;
    if (m) {
      m.hop = Math.max(0, m.hop - dt * 16);
      if (m.state === 'wait' && Math.random() < dt * 0.25) { SFX.quack(); m.hop = 3; }
      if (m.state === 'swim') {
        m.t += dt;
        if (m.t > 1.6) { m.dir = Y.side === 'bottom' ? -1 : 1; m.x += m.dir * 20 * dt; }
        if (m.x < -60 || m.x > W + 60) st.mama = null;
      }
    }
    // new friends to rescue
    if (!st.floaters.length && !b.carry.length && !st.hoppers.length && !st.deliver) {
      if (st.nextBatch <= 0) st.nextBatch = st.clock + 1.6;
      else if (st.clock > st.nextBatch && spawnBatch()) st.nextBatch = 0;
    }

    // the fire and the water cannon
    const s = st.spray;
    if (st.hold != null && st.fire) s.t = 0.5;
    if (s.fountain) { s.ax = clamp(b.x + b.dir * 50, 4, W - 4); s.ay = b.y + 2; }
    s.t = Math.max(0, s.t - dt);
    hose(s.t > 0 ? 1 : 0, 1);
    if (s.t > 0.25 || (s.t > 0 && s.fountain)) {
      if (Math.random() < dt * 40) spawn(1, () => ({ x: s.ax + rand(-3, 3), y: s.ay, vx: rand(-30, 30), vy: rand(-55, -15), g: 200, life: 0.5, max: 0.5, s: Math.random() < 0.5 ? 2 : 1, c: Math.random() < 0.4 ? '#ffffff' : '#8ed4ff' }));
      st.splashT -= dt;
      if (st.splashT <= 0) { st.splashT = 0.4; SND.play(Math.random() < 0.5 ? 'splash' : 'splash2', 0.9 + Math.random() * 0.3, 0.45); if (s.ay > Y.hz && (Y.side === 'left' ? s.ax > Y.qx : s.ay < Y.qy)) st.rings.push({ x: s.ax, y: s.ay, life: 1 }); }
    }
    if (st.fire) {
      const f = st.fire, pts = firePts();
      f.t += dt;
      st.smokeT -= dt;
      pts.forEach(([x, y], i) => {
        if (f.s[i] <= 0) return;
        if (st.smokeT <= 0) spawn(1, () => ({ x: x + rand(-3, 3), y: y - 12 - f.s[i] * 8, vx: rand(-3, 6), vy: -rand(12, 20), g: 0, life: 1.6, max: 1.6, s: 3, c: Math.random() < 0.5 ? '#8a8a94' : '#a4a4ae' }));
        if (s.t > 0.25 && Math.abs(s.ax - x) < 12 && s.ay > y - 22 && s.ay < y + 8) {
          f.s[i] -= dt * 1.1;
          if (Math.random() < dt * 14) puff(x, y - 8, 1, '#f0f0f4');
          st.steamT -= dt;
          if (st.steamT <= 0) { st.steamT = 0.35; SND.play('steam', 1 + Math.random() * 0.2, 0.6); }
          if (f.s[i] <= 0) { f.s[i] = 0; puff(x, y - 6, 10, '#e6e6ee'); SND.play('steam', 0.9); sparkle(x, y - 10, 8, 5, '#ffffff'); }
        }
      });
      if (st.smokeT <= 0) st.smokeT = 0.12;
      if (f.s.every(v => v <= 0)) fireOut();
    } else if (st.clock > st.nextFire && !st.deliver && !st.hoppers.length) startFire();
    if (st.sirenOff) { st.sirenT -= dt; if (st.sirenT <= 0) { st.sirenOff(); st.sirenOff = null; } }
    if (st.soot) { st.soot.life -= dt; if (st.soot.life <= 0) st.soot = null; }

    // the whale
    const w = st.whale;
    if (w) {
      w.t += dt; w.x += w.dir * 3 * dt;
      if (!w.spouted && w.t > 1) { w.spouted = true; spout(w); }
      if (w.t > 5.4) { st.whale = null; st.nextWhale = st.clock + 24 + Math.random() * 16; }
    } else if (st.clock > st.nextWhale && !st.fire) startWhale();
    // gulls and far sailboats
    for (const gl of st.gulls) {
      gl.flee = Math.max(0, gl.flee - dt);
      gl.x += gl.vx * dt * (1 + gl.flee * 2.5);
      const top = L.safeT + 6, bot = Math.max(top + 4, Y.hz - 10);
      gl.y = lerp(top, bot, gl.k) + Math.sin(T * 1.3 + gl.p) * 3 - gl.flee * 6;
      if (gl.x > W + 12) gl.x = -12; if (gl.x < -12) gl.x = W + 12;
    }
    if (st.clock > st.nextGull) { st.nextGull = st.clock + 9 + Math.random() * 10; SND.play(Math.random() < 0.5 ? 'gull' : 'gull2', 0.95 + Math.random() * 0.15, 0.7); }
    for (const sb of st.sails) { sb.x += sb.v * dt; if (sb.x > W + 12) sb.x = Y.wL - 12; if (sb.x < Y.wL - 12) sb.x = W + 12; }
    for (const wd of st.words) wd.t += dt;
    st.words = st.words.filter(wd => wd.t < 1.5);
    for (const h of st.hearts) { h.life -= dt; h.y += h.vy * dt; }
    st.hearts = st.hearts.filter(h => h.life > 0);
  }

  /* ---------- drawing ---------- */
  function heart(x, y) { x = Math.round(x); y = Math.round(y); R(x - 2, y, 2, 2, '#e8222b'); R(x + 1, y, 2, 2, '#e8222b'); R(x - 2, y + 1, 5, 2, '#e8222b'); R(x - 1, y + 3, 3, 1, '#e8222b'); R(x, y + 4, 1, 1, '#e8222b'); }
  function landLayer() {
    if (Y.side === 'bottom') dockBottom(); else dockLeft();
    shedDraw();
    lampPost();
    PETS.draw('boat', { y: Y.pets.y, x0: Y.pets.x0, x1: Math.max(Y.pets.x0 + 20, Y.pets.x1) });
    st.fams.slice().sort((a, b) => a.y - b.y).forEach(famDraw);
  }
  function waterThings() {
    for (const r of st.rings) {
      const rad = 3 + (1 - r.life) * 9;
      alpha(r.life, () => { for (let a = 0; a < 20; a++) R(r.x + Math.cos(a / 20 * 6.283) * rad, r.y + Math.sin(a / 20 * 6.283) * rad * 0.35, 1, 1, '#e6f8ff'); });
    }
    for (const w of st.wake) {
      const k = 1 - w.life / w.max, sp = Math.round(k * 7), len = 2 + Math.round(k * 5);
      alpha(w.life / w.max, () => { R(w.x - len / 2, w.y - sp * 0.4, len, 1, '#ffffff'); R(w.x - len / 2, w.y + sp * 0.5, len, 1, '#e6f8ff'); });
    }
    const list = [{ y: moorPos()[1], fn: moored }];
    if (st.whale) list.push({ y: st.whale.y, fn: () => whaleDraw(st.whale) });
    if (st.mama) list.push({ y: st.mama.y, fn: mamaDraw });
    for (const f of st.floaters) list.push({ y: f.y, fn: () => floaterDraw(f) });
    const b = st.boat;
    list.push({ y: b.y, fn: () => {
      const yb = b.y + bob();
      fireboat(b.x, yb, b.dir, { riders: b.carry, aim: cannonAngle() });
      lip(b.x, yb - 1, 29);
      if (Math.hypot(b.vx, b.vy) > 12) { const fx = Math.round(b.x + b.dir * 30); R(fx - 2, yb - 2, 5, 2, '#ffffff'); R(fx + b.dir * 3, yb - 1, 2, 1, '#e6f8ff'); }
    } });
    list.sort((a, c) => a.y - c.y).forEach(o => o.fn());
  }
  function hoppersDraw() {
    for (const h of st.hoppers) {
      const k = clamp01(h.t / h.dur), [x1, y1] = h.to(), x = lerp(h.x0, x1, k), y = lerp(h.y0, y1, k) - Math.sin(k * Math.PI) * h.h;
      rider(h.r, x, y, h.dir);
    }
  }
  function wordDraw(wd) {
    const s = Math.min(W, H) >= 220 ? 3 : 2, z = wd.t < 0.12 ? s + 1 : s, wdt = textWidth(wd.s, z);
    const x = Math.round(clamp(wd.x - wdt / 2, L.safeL + 2, W - L.safeR - wdt - 2)), y = Math.round(Math.max(L.safeT + 2, wd.y - wd.t * 10));
    alpha(clamp01((1.5 - wd.t) / 0.3), () => {
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) text(wd.s, x + ox * Math.max(1, z >> 1), y + oy * Math.max(1, z >> 1), z, INK);
      text(wd.s, x, y, z, wd.c);
    });
  }
  function hintTarget() {
    if (st.fire) { const p = firePts()[st.fire.s.findIndex(v => v > 0)]; return p ? [p[0], p[1] - 6] : null; }
    if (st.deliver) return null;
    const b = st.boat;
    if (b.carry.length && (!st.floaters.length || b.carry.length >= 3 || st.idle > 8)) return [Y.bx, Y.by - 6];
    let best = null, bd = 1e9;
    for (const f of st.floaters) { const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < bd) { bd = d; best = f; } }
    return best ? [best.x, best.y - 2] : (b.carry.length ? [Y.bx, Y.by - 6] : null);
  }

  /* ---------- input ---------- */
  function onLand(x, y) { return Y.side === 'bottom' ? y > Y.qy + 2 : x < Y.qx; }
  function setTarget(x, y) {
    const b = st.boat;
    if (onLand(x, y)) { b.tx = Y.bx; b.ty = Y.by; return; }
    b.tx = clamp(x, Y.bxMin, Y.bxMax); b.ty = clamp(y + 6, Y.byMin, Y.byMax);
  }

  SCENES.boat = {
    view: (w, h) => h > w * 1.1 ? [150, 240] : [250, 140],
    freeTouch: true,
    layout,
    groundY: () => Y.hz,
    enter() {
      layout();
      const b = st.boat;
      Object.assign(b, { x: lerp(Y.bxMin, Y.bxMax, 0.5), y: lerp(Y.byMin, Y.byMax, 0.45), vx: 0, vy: 0, dir: 1, carry: [] });
      b.tx = b.x; b.ty = b.y;
      Object.assign(st, { clock: 0, idle: 0, hold: null, batches: 0, fires: 0, floaters: [], hoppers: [], fams: [], mama: null, deliver: null, fire: null, soot: null,
        whale: null, wake: [], rings: [], words: [], hearts: [], nextFire: 24, nextWhale: 9, nextBatch: 0, nextGull: 2 });
      st.spray.t = 0;
      resetBits();
      spawnBatch();
      rect0 = Object.assign({}, Y.r);
      SND.load(); SND.music(true);
    },
    leave() {
      SND.music(false); motor(0); waves(0); hose(0); st.hold = null;
      if (st.sirenOff) { st.sirenOff(); st.sirenOff = null; }
    },
    update,
    drawWorld() {
      farSea();
      for (const gl of st.gulls) gullDraw(gl);
      if (Y.side === 'left') landLayer();
      waterThings();
      if (Y.side === 'bottom') landLayer();
      hoppersDraw();
    },
    drawLit() {
      const k = nightK(), ph = Math.floor(T * 2) % 2;
      // the lighthouse lamp blinks, and sweeps its beam at night
      const [lx, ly] = Y.light, lyy = ly - 33;
      alpha(0.35 + 0.65 * k, () => R(lx - 2, lyy - 1, 5, 3, ph ? '#fff6b0' : '#ffe873'));
      if (k > 0.05) {
        const c = Math.cos(T * 1.3), dir = Math.sign(c) || 1, len = Math.round(Math.abs(c) * 80);
        alpha(0.3 * k, () => circle(lx, lyy, 5, '#fff3b0'));
        for (let j = 3; j < len; j++) { const half = 1 + j * 0.12; alpha(0.22 * k * (1 - j / (len + 1)), () => R(lx + dir * j, lyy - half, 1, half * 2, '#fff3b0')); }
        // warm windows and the lamp post
        const s = Y.shed, wx = Math.round(s.x + s.w * 0.8), wy = s.base - s.h + Math.round(s.h * 0.4);
        alpha(k, () => { circle(wx, wy, 3, '#ffd27a'); R(wx - 3, wy, 7, 1, '#fff2c8'); });
        const [px, pb] = Y.lamp;
        alpha(0.3 * k, () => circle(px + 1, pb - 27, 7, '#fff3b0')); alpha(k, () => R(px - 1, pb - 28, 4, 2, '#fffbe6'));
        // the fireboat's lights
        const b = st.boat, yb = Math.round(b.y + bob());
        alpha(0.5 * k, () => { circle(b.x - b.dir * 5, yb - 39, 2, '#3fe24a'); circle(b.x + b.dir * (Math.floor(T * 6) % 2 ? 4 : -1), yb - 27, 4, RED_ON); });
        alpha(k, () => { R(Math.round(b.x - b.dir * 5) - (b.dir > 0 ? 0 : 1), yb - 40, 2, 2, '#8fff8a'); });
      }
      // flames
      if (st.fire) {
        firePts().forEach(([x, y], i) => {
          const sz = st.fire.s[i];
          if (sz <= 0) return;
          if (k > 0.05) alpha(0.18 * k, () => circle(x, y - 7, 7, '#ff9a3a'));
          flame(x, y, 0.3 + 0.7 * sz, i * 2.1);
        });
      }
      streamDraw();
      for (const h of st.hearts) alpha(Math.min(1, h.life), () => heart(h.x, h.y));
      drawParticles();
    },
    drawUI() {
      for (const wd of st.words) wordDraw(wd);
      const b = st.boat;
      if (b.carry.length && !st.deliver && !st.fire) arrow(Y.bx, Y.by - 34);
      if (st.fire) { const p = firePts()[1]; if (p && st.idle > 1.5) arrow(p[0], p[1] - 26, '#ff6b5b'); }
      if (st.idle > 4 && st.hold == null) {
        const t = hintTarget();
        if (t) { const z = Math.max(1, Math.round(Math.min(W, H) / 110)); hand(t[0], t[1], z, Math.floor(T * 2) % 2); }
      }
      drawHomeButton(Y.home);
    },
    tap(x, y, id) {
      if (inBox(Y.home, x, y)) { goScene('station'); return true; }
      st.idle = 0;
      if (PETS.tap('boat', x, y)) return true;
      for (const gl of st.gulls) if (Math.hypot(x - gl.x, y - gl.y) < 10 && gl.flee <= 0) { gl.flee = 1.6; SND.play(Math.random() < 0.5 ? 'gull' : 'gull2', 1.05); return true; }
      const w = st.whale;
      if (w && w.t < 3.8 && Math.abs(x - w.x) < 22 && y > w.y - 16 && y < w.y + 4) { w.t = Math.min(w.t, 2.2); spout(w); heartsAt(w.x, w.y - 14, 3); return true; }
      if (st.fire) { st.hold = id; Object.assign(st.spray, { ax: x, ay: y, t: 0.5, fountain: false }); return true; }
      const b = st.boat;
      if (!st.deliver && Math.abs(x - b.x) < 30 && y > b.y - 32 && y < b.y + 4) {
        toot(false); word('TOOT!', b.x, b.y - 46, '#ffffff');
        Object.assign(st.spray, { t: 1.1, fountain: true });
        return true;
      }
      for (const f of st.fams) if (Math.abs(x - f.x) < 8 && y > f.y - 24 && y < f.y + 3) { f.hop = 1; SFX.boop(1 + f.slot * 0.15); return true; }
      const m = st.mama;
      if (m && Math.abs(x - m.x) < 9 && y > m.y - 12 && y < m.y + 4) { SFX.quack(); m.hop = 4; return true; }
      if (st.deliver) return true;
      st.hold = id;
      setTarget(x, y);
      if (!onLand(x, y)) { st.rings.push({ x, y, life: 0.8 }); SND.play('pop', 1.5, 0.35); }
      return true;
    },
    move(x, y, id) {
      if (st.hold !== id) return;
      st.idle = 0;
      if (st.fire) { st.spray.ax = x; st.spray.ay = y; st.spray.fountain = false; }
      else if (!st.deliver) setTarget(x, y);
    },
    release(id) { if (st.hold === id) st.hold = null; },
    _st: st,
    _Y: Y,
    // the picker card: the fireboat on a wave, its cannon shooting a big arc of water
    card(x, yb) {
      fireboat(x, yb, 1, { aim: -1.0 });
      const px = x + 21, py = yb - 15, ex = x + 36, ey = yb - 2, h = 12;
      for (let k = 2; k <= 16; k++) { const t = k / 16, ax = lerp(px, ex, t), ay = lerp(py, ey, t) - 4 * h * t * (1 - t); circle(ax, ay, 1, '#6cc4f4'); }
      for (let j = 0; j < 4; j++) { const t = (j / 4 + T * 1.5) % 1, ax = lerp(px, ex, t), ay = lerp(py, ey, t) - 4 * h * t * (1 - t); R(ax, ay, 1, 1, '#ffffff'); }
      R(x - 30, yb - 1, 62, 2, '#3a94d4'); for (let k = -28; k < 30; k += 5) R(x + k + (Math.floor(T * 4) % 3), yb - 1, 2, 1, '#e6f8ff');
    },
  };
})();
