// "Build a Fire Truck": in the fire station workshop, put together your very own fire truck one
// part at a time: pick a paint color, the wheels, what goes on top (a ladder, a water cannon or a
// bucket lift), the flashing lights, and a friend to ride along (the Vizsla, the husky or the cat).
// Each part flies onto the truck with a clunk and the builder bangs it into place. When it's done,
// press the big green arrow to take it for a drive in the town driving game.
'use strict';
(() => {
  const { oval, hsh } = TOY;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eout = k => 1 - (1 - k) ** 3;

  /* ---------- sounds ---------- */
  const SND = TOY.bank({
    hammer: ['bd-hammer', 0.7], clunk: ['bd-clunk', 0.7], tool: ['bd-tool', 0.55], tool2: ['bd-tool2', 0.5], boing: ['bd-boing', 0.6],
    honk: ['bt-honk', 0.6], bark: ['dog-bark', 0.7], bark2: ['dog-bark-2', 0.6], meow: ['cat-meow', 0.7], chime: ['mv-chime', 0.5], splat: ['bt-splat', 0.6],
  }, {
    hammer() { noise(0, 0.08, 0.12, 2500, 2); tone('square', 900, 0, 0.05, 0.04, 600); }, clunk() { tone('square', 160, 0, 0.12, 0.08, 90); noise(0, 0.1, 0.08, 800, 1); },
    tool() { for (let i = 0; i < 5; i++) noise(i * 0.05, 0.03, 0.06, 3000, 3); }, tool2() { tone('sawtooth', 300, 0, 0.4, 0.03, 600); },
    boing() { tone('sine', 300, 0, 0.3, 0.06, 900); }, honk() { tone('square', 330, 0, 0.3, 0.06); tone('square', 415, 0, 0.3, 0.05); },
    bark() { tone('square', 330, 0, 0.09, 0.08, 220); }, bark2() { tone('square', 290, 0, 0.09, 0.08, 200); }, meow() { tone('sine', 700, 0, 0.4, 0.06, 500); },
    chime() { SFX.chime(); }, splat() { noise(0, 0.25, 0.1, 600, 0.8); },
  }, 'bd-music', 0.15);
  const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, i * 0.12, i === 3 ? 0.5 : 0.14, 0.06));

  /* ---------- the parts ---------- */
  const STEPS = [
    { key: 'color', opts: ['red', 'yellow', 'blue', 'green', 'pink', 'purple'] },
    { key: 'wheels', opts: ['small', 'big', 'six'] },
    { key: 'top', opts: ['ladder', 'cannon', 'bucket'] },
    { key: 'lights', opts: ['red', 'redblue', 'rainbow'] },
    { key: 'rider', opts: ['vizsla', 'husky', 'cat'] },
  ];
  const RAINBOW = ['#ff3b3b', '#ff9a1f', '#ffe14a', '#3fe24a', '#3b8bff', '#b45bff'];
  const DEFAULT = { color: 'red', wheels: null, top: null, lights: null, rider: null };

  // The truck: 66 long and about 38 tall (the same footprint as the station's fire truck, so it
  // can drive in the town game), facing right, wheels on yb. Missing parts are simply left off.
  function drawTruck(sp, x, yb, lit, bob = 0, rot = 0, o = {}) {
    const c = COLOR[sp.color || 'red'].c, big = sp.wheels === 'big', lift = big ? 3 : 0;
    const y = yb - 38 + bob - lift, ph = Math.floor(T * 7) % 2;
    const P = (dx, dy, w, h, col) => R(x + dx, y + dy, w, h, col);
    const stripe = sp.color === 'yellow' ? '#e8222b' : '#f4f7fb';
    P(2, 29, 62, 3, '#2b2e36');
    if (big) { P(10, 31, 6, 4, '#3a3d46'); P(48, 31, 6, 4, '#3a3d46'); }
    // body with lockers
    P(0, 12, 46, 18, c[1]); P(0, 12, 46, 1, c[0]); P(0, 28, 46, 2, c[2]);
    for (let i = 0; i < 3; i++) { const dx = 3 + i * 14; P(dx, 15, 12, 10, c[2]); P(dx + 1, 16, 10, 8, c[1]); P(dx + 1, 18, 10, 1, c[0]); P(dx + 1, 21, 10, 1, c[0]); P(dx + 8, 23, 2, 1, '#e9eef2'); }
    P(0, 26, 64, 1, stripe);
    // cab
    P(46, 8, 17, 22, c[1]); P(63, 11, 2, 19, c[1]); P(46, 8, 17, 1, c[0]); P(46, 28, 19, 2, c[2]);
    P(49, 10, 13, 1, c[2]); P(50, 11, 12, 7, GLASS); P(62, 12, 1, 6, GLASS2);
    // who's in the cab: the friend leans out of the window, or a firefighter drives
    const r = sp.rider, wob = o.happy ? Math.floor(T * 6) % 2 : 0;
    if (r === 'vizsla') { P(54, 12 - wob, 7, 5, '#b4542a'); P(60, 14 - wob, 4, 3, '#b4542a'); P(63, 14 - wob, 1, 1, '#5a2a1a'); P(54, 12 - wob, 2, 6, '#94401e'); P(58, 13 - wob, 1, 1, INK); if (o.happy) P(62, 17 - wob, 1, 2, '#e8708a'); }
    else if (r === 'husky') { P(54, 12 - wob, 7, 6, '#f6f6f2'); P(60, 14 - wob, 4, 3, '#f6f6f2'); P(63, 14 - wob, 1, 1, INK); P(54, 10 - wob, 2, 2, '#f6f6f2'); P(58, 10 - wob, 2, 2, '#f6f6f2'); P(55, 12 - wob, 2, 2, '#9aa2b2'); P(58, 13 - wob, 1, 1, '#6aaee8'); if (o.happy) P(62, 17 - wob, 1, 2, '#e8708a'); }
    else if (r === 'cat') { P(55, 12 - wob, 7, 6, '#aaa69e'); P(55, 10 - wob, 2, 2, '#aaa69e'); P(60, 10 - wob, 2, 2, '#aaa69e'); P(56, 13 - wob, 1, 2, '#55514a'); P(57, 14 - wob, 1, 1, '#a8d048'); P(60, 14 - wob, 1, 1, '#a8d048'); P(58, 16 - wob, 1, 1, '#e8a0a0'); }
    else { P(53, 13, 5, 5, SKIN[1]); P(52, 11, 7, 3, '#e8222b'); P(56, 15, 1, 1, INK); }
    P(51, 12, 2, 2, '#ffffff');
    P(48, 19, 1, 9, c[2]); P(50, 21, 3, 1, '#e9eef2');
    P(61, 27, 5, 3, CHROME); P(64, 20, 1, 3, '#fff6b0');
    // what's on top
    if (sp.top === 'ladder') {
      P(3, 5, 40, 1, '#d5dce3'); P(3, 9, 40, 1, '#8b96a1'); for (let i = 0; i < 10; i++) P(4 + i * 4, 6, 1, 3, '#d5dce3');
      P(7, 10, 3, 2, '#6b7480'); P(36, 10, 3, 2, '#6b7480');
    } else if (sp.top === 'cannon') {
      P(10, 7, 14, 5, '#9aa3ad'); P(10, 7, 14, 1, '#cfd6dd'); P(14, 4, 6, 3, '#6b7480');
      for (let i = 0; i < 12; i++) P(19 + i, 4 - Math.floor(i / 3), 2, 2, '#cfd6dd');
      P(30, -1, 3, 3, '#ffd21f');
      if (o.spray) for (let i = 0; i < 10; i++) { const k = (T * 3 + i / 10) % 1; R(Math.round(x + 33 + k * 30), Math.round(y - 1 - Math.sin(k * Math.PI) * 10 + k * 14), 2, 2, i % 2 ? '#bfe6ff' : '#7ac8ff'); }
      P(30, 12, 12, 3, '#e8e2d8'); for (let i = 0; i < 4; i++) P(31 + i * 3, 12, 1, 3, '#b8b0a0');
    } else if (sp.top === 'bucket') {
      P(4, 9, 6, 3, '#6b7480');
      for (let i = 0; i < 34; i++) P(6 + i, 8 - Math.floor(i / 8), 2, 2, '#cfd6dd');
      P(38, -2, 9, 7, '#ffd21f'); P(38, -2, 9, 1, '#fff3a6'); P(39, 1, 7, 1, '#c99410');
    }
    // the light bar
    if (sp.lights) {
      P(47, 7, 14, 1, '#444a55');
      let cols;
      if (sp.lights === 'red') cols = [lit && !ph ? RED_ON : RED_OFF, lit ? '#ffffff' : '#bbbbbb', lit && ph ? RED_ON : RED_OFF];
      else if (sp.lights === 'redblue') cols = [lit && !ph ? RED_ON : RED_OFF, lit ? '#ffffff' : '#bbbbbb', lit && ph ? BLUE_ON : BLUE_OFF];
      else { const k = Math.floor(T * 8); cols = [0, 1, 2].map(i => lit ? RAINBOW[(k + i * 2) % 6] : ['#a86a6a', '#a8a86a', '#6a6aa8'][i]); }
      P(48, 5, 5, 2, cols[0]); P(53, 5, 2, 2, cols[1]); P(55, 5, 5, 2, cols[2]);
      if (lit) glow(x + (ph ? 57 : 50), y + 6, sp.lights === 'rainbow' ? RAINBOW[Math.floor(T * 8) % 6] : sp.lights === 'redblue' && ph ? BLUE_ON : RED_ON);
    }
    // wheels
    const wy = yb - 6 + bob, ws = sp.wheels === 'big' ? [[13, 8], [52, 8]] : sp.wheels === 'six' ? [[10, 6], [23, 6], [36, 6], [53, 6]] : sp.wheels === 'small' ? [[12, 6], [26, 6], [53, 6]] : [];
    for (const [wx, wr] of ws) circle(x + wx, wy - (wr - 6), wr + 1, WELL);
    for (const [wx, wr] of ws) {
      const cy = yb - 6 - (wr - 6);
      wheel(x + wx, cy, wr, rot);
      if (wr > 6) { circle(x + wx, cy, wr, '#24262d'); circle(x + wx, cy, wr - 3, '#a7b0ba'); circle(x + wx, cy, 2, '#e3e7eb'); for (let k = 0; k < 6; k++) { const a = rot + k * Math.PI / 3; R(Math.round(x + wx + Math.cos(a) * (wr - 1)), Math.round(cy + Math.sin(a) * (wr - 1)), 1, 1, '#4d5560'); } }
    }
    if (!ws.length) { P(8, 32, 6, 6, '#c99410'); P(50, 32, 6, 6, '#c99410'); }   // sitting on blocks
  }

  /* ---------- state and layout ---------- */
  const st = { sp: { ...DEFAULT }, step: 0, fly: null, bounce: 0, done: false, doneT: 0, idle: 0, hit: 0, words: [], happy: 0, spray: 0, lit: false, splats: [] };
  const Y = {};
  function layout() {
    Y.pr = H > W * 1.05;
    const top = L.safeT + 4, bot = H - L.safeB - 4, left = L.safeL + 4, right = W - L.safeR - 4;
    Y.home = { x: left + 2, y: top + 2, s: L.blob };
    Y.dots = { y: top + 2 + Math.round(L.blob / 2), x0: left + L.blob + 14, x1: right - 6 };
    // the option tray along the bottom (portrait) or the right side (landscape)
    const n = 6;
    if (Y.pr) {
      Y.trayH = Math.max(52, Math.min(110, Math.round((bot - top) * 0.3)));
      Y.tray = { x: left, y: bot - Y.trayH, w: right - left, h: Y.trayH };
      Y.stage = { x: left, y: top + L.blob + 8, w: right - left, h: Y.tray.y - (top + L.blob + 8) - 6 };
    } else {
      Y.trayW = Math.max(64, Math.min(130, Math.round((right - left) * 0.34)));
      Y.tray = { x: right - Y.trayW, y: top + L.blob + 8, w: Y.trayW, h: bot - (top + L.blob + 8) };
      Y.stage = { x: left, y: top + L.blob + 8, w: Y.tray.x - left - 6, h: bot - (top + L.blob + 8) };
    }
    const s = Y.stage;
    Y.z = Math.max(1, Math.floor(Math.min((s.w - 4) / 68, (s.h - 24) / 46)));
    Y.tx = Math.round(s.x + s.w / 2 - 33 * Y.z);   // truck's left edge (screen)
    Y.ty = Math.round(s.y + s.h - 14);              // the lift top where the wheels sit
    Y.floor = Y.ty + 4;
    Y.n = n;
  }
  function tiles() {
    const opts = st.done ? [] : STEPS[st.step].opts, n = opts.length, t = Y.tray, gap = 6;
    let cols, rows;
    if (Y.pr) { rows = n > 3 ? 2 : 1; cols = Math.ceil(n / rows); } else { cols = n > 3 ? 2 : 1; rows = Math.ceil(n / cols); }
    const s = Math.floor(Math.min((t.w - gap * (cols + 1)) / cols, (t.h - gap * (rows + 1)) / rows, 70));
    const gx = t.x + Math.round((t.w - (cols * s + (cols - 1) * gap)) / 2), gy = t.y + Math.round((t.h - (rows * s + (rows - 1) * gap)) / 2);
    return opts.map((k, i) => ({ k, i, x: gx + (i % cols) * (s + gap), y: gy + Math.floor(i / cols) * (s + gap), s }));
  }
  function doneButtons() {
    const t = Y.tray, s = Math.min(Y.pr ? Math.round(t.h * 0.8) : Math.round(t.w * 0.7), 64), gap = 10;
    if (Y.pr) { const y = t.y + Math.round((t.h - s) / 2), x0 = Math.round(t.x + t.w / 2 - s - gap / 2); return { go: { x: x0 + s + gap, y, s }, again: { x: x0, y, s } }; }
    const x = t.x + Math.round((t.w - s) / 2), y0 = Math.round(t.y + t.h / 2 - s - gap / 2);
    return { go: { x, y: y0, s }, again: { x, y: y0 + s + gap, s } };
  }
  function reset() {
    Object.assign(st, { sp: { ...DEFAULT }, step: 0, fly: null, bounce: 0, done: false, doneT: 0, idle: 0, hit: 0, words: [], happy: 0, spray: 0, lit: false, splats: [] });
  }
  function word(s, x, y, c = '#ffffff') { st.words.push({ s, x, y, c, life: 1.2 }); }
  function truckCenter() { return [Y.tx + 33 * Y.z, Y.ty - 20 * Y.z]; }

  /* ---------- choosing a part ---------- */
  function choose(t) {
    if (st.fly || st.done) return;
    const step = STEPS[st.step];
    const [cx, cy] = truckCenter();
    const target = { color: [cx, cy], wheels: [cx, Y.ty - 6 * Y.z], top: [Y.tx + 24 * Y.z, Y.ty - 34 * Y.z], lights: [Y.tx + 54 * Y.z, Y.ty - 33 * Y.z], rider: [Y.tx + 57 * Y.z, Y.ty - 24 * Y.z] }[step.key];
    st.fly = { key: step.key, val: t.k, x0: t.x + t.s / 2, y0: t.y + t.s / 2, x1: target[0], y1: target[1], k: 0 };
    SND.play('tool', 1.1); st.idle = 0;
  }
  function land(f) {
    st.sp[f.key] = f.val; st.bounce = 1; st.hit = 0.6;
    const [cx, cy] = truckCenter();
    if (f.key === 'color') { SND.play('splat'); const c = COLOR[f.val].c; for (let i = 0; i < 14; i++) st.splats.push({ x: cx + rand(-30, 30) * Y.z, y: cy + rand(-14, 10) * Y.z, r: 2 + Math.random() * 3 * Y.z, c: c[i % 3], life: 0.8 }); word('SPLASH!', cx - 24, cy - 26 * Y.z, c[0]); }
    else if (f.key === 'wheels') { SND.play('boing'); word('BOING!', cx - 20, Y.ty - 30 * Y.z); }
    else if (f.key === 'lights') { SND.play('clunk'); st.lit = true; word('BLINK!', f.x1 - 18, f.y1 - 16); }
    else if (f.key === 'rider') { const s = { vizsla: ['bark', 'WOOF!'], husky: ['bark2', 'WOOF!'], cat: ['meow', 'MEOW!'] }[f.val]; SND.play(s[0]); st.happy = 1.5; word(s[1], f.x1 - 14, f.y1 - 18); }
    else { SND.play('clunk'); word('CLUNK!', f.x1 - 20, f.y1 - 16); }
    setTimeout(() => SND.play('hammer'), 200); setTimeout(() => SND.play('hammer', 1.1), 420);
    sparkle(f.x1, f.y1, 10 * Y.z, 10);
    st.step++;
    if (st.step >= STEPS.length) finish();
  }
  function finish() {
    st.done = true; st.doneT = 0; st.lit = true;
    try { localStorage.setItem('firestation.mytruck', JSON.stringify(st.sp)); } catch (e) {}
    setTimeout(() => { fanfare(); confetti(40); SND.play('honk'); const [cx, cy] = truckCenter(); word('HOORAY!', cx - 28, cy - 34 * Y.z, '#ffd21f'); }, 600);
  }
  function honkTruck() {
    st.bounce = 1; st.happy = 1.2; st.idle = 0;
    const [cx, cy] = truckCenter();
    if (st.sp.top === 'cannon' && st.done) { st.spray = 1.5; SND.play('splat', 1.4); word('SPLASH!', cx + 20, cy - 30 * Y.z, '#7ac8ff'); }
    else if (st.sp.lights) { st.lit = !st.lit || !st.done; SND.play('honk'); word('HONK!', cx - 16, cy - 30 * Y.z); }
    else { SND.play('honk'); word('HONK!', cx - 16, cy - 30 * Y.z); }
    if (st.sp.rider && Math.random() < 0.5) setTimeout(() => SND.play(st.sp.rider === 'cat' ? 'meow' : 'bark'), 300);
  }

  /* ---------- update ---------- */
  function update(dt) {
    SND.load();
    st.idle += dt; st.bounce = Math.max(0, st.bounce - dt * 2.5); st.hit = Math.max(0, st.hit - dt); st.happy = Math.max(0, st.happy - dt); st.spray = Math.max(0, st.spray - dt);
    if (st.done) st.doneT += dt;
    if (st.fly) { st.fly.k += dt / 0.55; if (st.fly.k >= 1) { const f = st.fly; st.fly = null; land(f); } }
    for (const w of st.words) { w.life -= dt; w.y -= 10 * dt; }
    st.words = st.words.filter(w => w.life > 0);
    for (const s of st.splats) s.life -= dt;
    st.splats = st.splats.filter(s => s.life > 0);
  }

  /* ---------- drawing ---------- */
  function workshop() {
    R(0, 0, W, H, '#e8d8b8');
    // pegboard with tools
    const pb = { x: Y.stage.x + 6, y: Y.stage.y + 4, w: Y.stage.w - 12, h: Math.max(20, Math.round(Y.stage.h * 0.36)) };
    R(pb.x, pb.y, pb.w, pb.h, '#c8a26a'); R(pb.x, pb.y, pb.w, 2, '#d8b47a'); R(pb.x, pb.y + pb.h - 2, pb.w, 2, '#a8824a');
    for (let yy = pb.y + 5; yy < pb.y + pb.h - 3; yy += 6) for (let xx = pb.x + 4; xx < pb.x + pb.w - 3; xx += 6) R(xx, yy, 1, 1, '#9a7442');
    const tools = Math.floor(pb.w / 26);
    for (let i = 0; i < tools; i++) {
      const tx = pb.x + 10 + i * 26, ty = pb.y + 6, k = i % 4;
      if (k === 0) { R(tx, ty, 3, 14, '#9aa3ad'); R(tx - 2, ty, 7, 3, '#9aa3ad'); R(tx - 1, ty + 1, 5, 1, '#c8a26a'); }           // wrench
      else if (k === 1) { R(tx + 1, ty + 4, 3, 11, '#a8743f'); R(tx - 2, ty, 9, 5, '#5a5f6e'); }                                  // hammer
      else if (k === 2) { R(tx, ty, 2, 10, '#e8222b'); R(tx, ty + 10, 2, 5, '#ffd21f'); }                                          // screwdriver
      else { R(tx - 3, ty + 2, 12, 5, '#3fb43a'); R(tx - 3, ty + 7, 4, 7, '#3fb43a'); R(tx + 9, ty + 3, 3, 2, '#5a5f6e'); }        // drill
    }
    // the floor and the lift
    R(0, Y.floor, W, H - Y.floor, '#9aa3ad'); R(0, Y.floor, W, 2, '#7a8090');
    for (let x = -((Y.floor * 3) % 20); x < W; x += 20) R(x, Y.floor + 8, 10, 1, '#8a929c');
    const lw = 72 * Y.z, lx = Math.round(Y.stage.x + Y.stage.w / 2 - lw / 2);
    for (let x = 0; x < lw; x += 8) R(lx + x, Y.ty, 4, 4, '#ffd21f'), R(lx + x + 4, Y.ty, 4, 4, '#2f3240');
    R(lx + Math.round(lw * 0.25) - 3, Y.ty + 4, 6, Y.floor - Y.ty, '#5a5f6e'); R(lx + Math.round(lw * 0.75) - 3, Y.ty + 4, 6, Y.floor - Y.ty, '#5a5f6e');
    // a stack of tires and a toolbox
    const sx = Y.stage.x + 8, sy = Y.floor;
    if (lx - sx > 20) for (let i = 0; i < 3; i++) { R(sx, sy - 6 - i * 6, 16, 6, '#24262d'); R(sx + 2, sy - 5 - i * 6, 12, 1, '#3a3d46'); }
    const bx = lx + lw + 6;
    if (Y.stage.x + Y.stage.w - bx > 22) { R(bx, sy - 16, 20, 16, '#e8222b'); R(bx, sy - 16, 20, 2, '#ff6b5e'); for (let k = 0; k < 3; k++) R(bx + 2, sy - 12 + k * 4, 16, 1, '#a3121d'); R(bx + 8, sy - 19, 4, 3, '#2f3240'); }
  }
  function builderGuy() {
    // the builder stands beside the truck and bangs each part in with a hammer
    const x = Math.round(Y.tx - 6 * Y.z), yb = Y.floor - 2;
    if (x < Y.stage.x + 6) return;
    const banging = st.hit > 0, cheer = st.done && st.doneT < 3;
    drawPerson({ type: 'builder', x, yb, dir: 1, pose: cheer ? 'cheer' : banging ? 'wave' : 'stand', skin: SKIN[2], seed: 2, hop: cheer ? Math.abs(Math.sin(T * 9)) * 3 : 0 });
    if (banging) { const up = Math.floor(T * 12) % 2; R(x + 3, yb - 22 + up * 2, 2, 7, '#a8743f'); R(x + 1, yb - 24 + up * 2, 6, 3, '#5a5f6e'); }
  }
  function drawBig(sp, lit) {
    const z = Y.z, bob = st.bounce > 0 ? -Math.round(Math.abs(Math.sin(st.bounce * 8)) * 2) : 0;
    const cvT = TOY.paint('bd-truck', 80, 56, 6, 12, () => drawTruck(sp, 0, 42, lit, bob, st.done ? T * 4 : 0, { happy: st.happy > 0, spray: st.spray > 0 }));
    TOY.blit(cvT, Y.tx, Y.ty - 42 * z, z, z);
  }
  function optionArt(step, k, cx, cy, s) {
    if (step === 'color') {
      const u = Math.max(1, Math.floor(s / 17)), c = COLOR[k].c;
      R(cx - 6 * u, cy - 4 * u, 12 * u, 11 * u, '#cfd6dd'); R(cx - 6 * u, cy - 4 * u, 12 * u, 2 * u, c[1]); R(cx - 5 * u, cy - 3 * u, 10 * u, u, c[0]);
      R(cx - 7 * u, cy - 5 * u, 14 * u, u, '#9aa3ad'); R(cx + 3 * u, cy - 2 * u, 2 * u, 5 * u, c[1]); R(cx - 3 * u, cy + u, 4 * u, 2 * u, '#9aa3ad');
      return;
    }
    if (step === 'rider') {   // a close look at the friend
      const zz = Math.max(1, Math.floor((s - 4) / 20));
      const cvR = TOY.paint('bd-rider-' + k, 24, 22, 0, 0, () => {
        if (k === 'cat') PETS.catSit(12, 20, { swish: true });
        else { const D = SCENES.icecream && SCENES.icecream._dogs; if (D) D[k](11, 19, 1, { wag: true, pant: true }); }
      });
      TOY.blit(cvR, Math.round(cx - 12 * zz), Math.round(cy - 11 * zz), zz, zz);
      return;
    }
    const u = Math.max(1, Math.floor(s / 19)), P = (dx, dy, w, h, c) => R(Math.round(cx + dx * u), Math.round(cy + dy * u), w * u, h * u, c);
    const wheelAt = (dx, dy, r) => { circle(cx + dx * u, cy + dy * u, r * u + 1, WELL); circle(cx + dx * u, cy + dy * u, r * u, '#24262d'); circle(cx + dx * u, cy + dy * u, Math.max(1, (r - 2) * u), '#a7b0ba'); circle(cx + dx * u, cy + dy * u, Math.max(1, Math.round(r * u / 3)), '#e3e7eb'); };
    if (step === 'wheels') {
      if (k === 'small') { wheelAt(-6, 0, 5); wheelAt(6, 0, 5); }
      else if (k === 'big') wheelAt(0, 0, 9);
      else { wheelAt(-8, 0, 4); wheelAt(0, 0, 4); wheelAt(8, 0, 4); }
    } else if (step === 'top') {
      if (k === 'ladder') { P(-11, -3, 22, 1, '#d5dce3'); P(-11, 2, 22, 1, '#8b96a1'); for (let i = 0; i < 6; i++) P(-10 + i * 4, -2, 1, 4, '#d5dce3'); }
      else if (k === 'cannon') { P(-9, 1, 10, 5, '#9aa3ad'); P(-9, 1, 10, 1, '#cfd6dd'); P(-6, -1, 4, 2, '#6b7480'); for (let i = 0; i < 8; i++) P(-2 + i, -1 - Math.floor(i / 2), 2, 2, '#cfd6dd'); P(6, -6, 3, 3, '#ffd21f'); for (let i = 0; i < 4; i++) P(9 + i, -6 + i * 2, 1, 1, '#7ac8ff'); }
      else { P(-10, 4, 4, 3, '#6b7480'); for (let i = 0; i < 14; i++) P(-8 + i, 4 - Math.floor(i / 2), 2, 2, '#cfd6dd'); P(4, -8, 8, 6, '#ffd21f'); P(4, -8, 8, 1, '#fff3a6'); P(5, -5, 6, 1, '#c99410'); }
    } else if (step === 'lights') {
      const ph = Math.floor(T * 7) % 2, kk = Math.floor(T * 8);
      const cols = k === 'red' ? [ph ? RED_OFF : RED_ON, '#ffffff', ph ? RED_ON : RED_OFF] : k === 'redblue' ? [ph ? RED_OFF : RED_ON, '#ffffff', ph ? BLUE_ON : BLUE_OFF] : [0, 1, 2].map(i => RAINBOW[(kk + i * 2) % 6]);
      P(-8, 1, 16, 2, '#444a55'); P(-8, -2, 6, 3, cols[0]); P(-2, -2, 4, 3, cols[1]); P(2, -2, 6, 3, cols[2]);
      alpha(0.3, () => { circle(cx - 5 * u, cy - u, 4 * u, cols[0]); circle(cx + 5 * u, cy - u, 4 * u, cols[2]); });
    }
  }
  function stepIcon(i, cx, cy, on) {
    const c = on ? '#ffffff' : '#7a6a4a';
    if (i === 0) { R(cx - 2, cy - 3, 4, 6, c); R(cx - 1, cy - 4, 2, 1, c); }
    else if (i === 1) { circle(cx, cy, 3, c); R(cx, cy, 1, 1, on ? '#2a6fe0' : '#e8d8b8'); }
    else if (i === 2) { R(cx - 4, cy - 2, 8, 1, c); R(cx - 4, cy + 1, 8, 1, c); for (let k = -3; k <= 3; k += 2) R(cx + k, cy - 1, 1, 2, c); }
    else if (i === 3) { R(cx - 3, cy - 1, 6, 3, c); R(cx - 4, cy + 2, 8, 1, c); }
    else { R(cx - 3, cy - 1, 6, 4, c); R(cx - 3, cy - 3, 2, 2, c); R(cx + 1, cy - 3, 2, 2, c); }
  }
  function drawDots() {
    const n = STEPS.length, d = Y.dots, sp = Math.min(30, Math.floor((d.x1 - d.x0) / n)), x0 = Math.round(d.x0 + (d.x1 - d.x0 - sp * (n - 1)) / 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * sp, cur = i === st.step && !st.done, did = i < st.step || st.done, r = cur ? 10 + Math.round(Math.sin(T * 5)) : 9;
      if (i < n - 1) R(x, d.y - 1, sp, 3, did ? '#3fb43a' : '#c8b48a');
      circle(x, d.y, r + 1, '#ffffff'); circle(x, d.y, r, did ? '#3fb43a' : cur ? '#2a6fe0' : '#d8c8a0');
      stepIcon(i, x, d.y, did || cur);
    }
  }
  function drawTray() {
    const t = Y.tray;
    R(t.x, t.y, t.w, t.h, '#7a5a3a'); R(t.x + 2, t.y + 2, t.w - 4, t.h - 4, '#a8824a'); R(t.x + 2, t.y + 2, t.w - 4, 2, '#c8a26a');
    if (st.done) {
      const b = doneButtons(), p = Math.round(Math.sin(T * 5) * 1.5);
      button({ x: b.go.x - p, y: b.go.y - p, s: b.go.s + 2 * p }, '#3fb43a', '#1f7a2a'); drawArrowIcon(b.go.x + b.go.s / 2, b.go.y + b.go.s / 2, b.go.s);
      button(b.again, '#ffd21f', '#c99410');
      const cx = b.again.x + b.again.s / 2, cy = b.again.y + b.again.s / 2, u = Math.max(1, Math.round(b.again.s / 16));
      for (let i = -3; i <= 3; i++) R(cx + i * u - u, cy - i * u - u, 2 * u, 2 * u, '#5a5f6e');
      R(cx + 2 * u, cy - 6 * u, 4 * u, 4 * u, '#5a5f6e'); R(cx + 3 * u, cy - 5 * u, 2 * u, 2 * u, '#ffd21f');
      R(cx - 6 * u, cy + 2 * u, 4 * u, 4 * u, '#5a5f6e'); R(cx - 5 * u, cy + 3 * u, 2 * u, 2 * u, '#ffd21f');
      if (st.doneT > 3) TOY.arrow(Math.round(b.go.x + b.go.s / 2), b.go.y - 4);
      return;
    }
    const key = STEPS[st.step].key;
    for (const tl of tiles()) {
      if (st.fly && st.fly.val === tl.k) continue;
      const bob = Math.round(Math.sin(T * 3 + tl.i) * 1);
      button({ x: tl.x, y: tl.y + bob, s: tl.s }, key === 'color' ? '#fff6e0' : '#d4ecff', key === 'color' ? '#d8c8a0' : '#9ac4e8');
      optionArt(key, tl.k, tl.x + tl.s / 2, tl.y + bob + tl.s / 2, tl.s);
    }
    if (st.idle > 3 && !st.fly) { const tl = tiles()[0]; if (tl) TOY.hand(tl.x + tl.s / 2, tl.y + tl.s / 2 + 2, Math.max(1, Math.floor(tl.s / 24)), Math.floor(T * 2) % 2); }
  }
  function drawFly() {
    const f = st.fly; if (!f) return;
    const k = eout(f.k), x = lerp(f.x0, f.x1, k), y = lerp(f.y0, f.y1, k) - Math.sin(k * Math.PI) * 30;
    const s = Math.round(lerp(40, 24 * Y.z, k));
    if (f.key === 'color') { const c = COLOR[f.val].c; circle(x, y, Math.round(s / 3), c[1]); circle(x - 2, y - 2, Math.round(s / 6), c[0]); }
    else optionArt(f.key, f.val, x, y, s);
  }

  SCENES.builder = {
    view: (w, h) => h > w * 1.05 ? [150, 230] : [250, 150],
    freeTouch: true,
    noWeather: true,
    layout,
    groundY: () => 0,
    enter() { layout(); reset(); SND.load(); SND.music(true); },
    leave() { SND.music(false); },
    update,
    drawWorld() {
      workshop();
      for (const s of st.splats) alpha(Math.min(1, s.life * 2), () => circle(s.x, s.y, s.r, s.c));
      drawBig(st.sp, st.lit);
      builderGuy();
    },
    drawLit() { drawParticles(); },
    drawUI() {
      drawHomeButton(Y.home);
      drawDots();
      drawTray();
      drawFly();
      for (const w of st.words) {
        const tw = textWidth(w.s, 2), x = clamp(Math.round(w.x), L.safeL + 2, W - L.safeR - tw - 2), y = Math.round(Math.max(L.safeT + 2, w.y));
        alpha(Math.min(1, w.life * 2), () => { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(w.s, x + dx, y + dy, 2, INK); text(w.s, x, y, 2, w.c); });
      }
    },
    tap(x, y) {
      if (inBox(Y.home, x, y)) { SFX.boop(); goScene('station'); return true; }
      if (st.done) {
        const b = doneButtons();
        if (inBox(b.go, x, y)) { SND.play('honk'); goScene('drive', { custom: { ...st.sp } }); return true; }
        if (inBox(b.again, x, y)) { SND.play('tool2'); reset(); return true; }
      } else for (const t of tiles()) if (inBox({ x: t.x, y: t.y, s: t.s }, x, y)) { choose(t); return true; }
      // the truck itself
      if (x >= Y.tx - 4 && x < Y.tx + 70 * Y.z && y >= Y.ty - 46 * Y.z && y < Y.ty + 4) { honkTruck(); return true; }
      return true;
    },
    drawTruck,   // borrowed by the driving game to drive the truck you built
    card(x, yb) { drawTruck({ color: 'yellow', wheels: 'big', top: 'cannon', lights: 'rainbow', rider: 'vizsla' }, x, yb, true, 0, T * 3, { happy: true }); },
    _st: st, _tiles: tiles, _done: doneButtons,
  };
})();
