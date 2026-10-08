// The ice cream truck's kitchen: make your own treat. Soft-serve machines along the top (tap one
// to slide the cone under it, then press and hold anywhere to pour a swirl), a scoop counter with
// six tubs (each tap drops a scoop), a row of toppings, and a bell that serves the finished treat.
'use strict';
(() => {
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const eout = k => 1 - (1 - k) ** 3;
  const audio = () => SCENES.icecream && SCENES.icecream._audio;
  const play = (k, r) => { const a = audio(); if (a) a.play(k, r); };

  /* ---------- flavors and toppings ---------- */
  // [main, shadow, highlight]
  const SWIRLS = [['#ff8fb8', '#e8608f', '#ffc2da'], ['#fff6e0', '#e8d8b8', '#ffffff'], ['#8a5230', '#6a3a1e', '#b07a50'], ['#7ad0ff', '#4aa8e8', '#c4ecff']];
  const SCOOPS = [['#ff8fb8', '#e8608f', '#ffc2da'], ['#8a5230', '#6a3a1e', '#b07a50'], ['#fff6e0', '#e8d8b8', '#ffffff'], ['#9ef0c8', '#6ad4a4', '#d4fff0'], ['#b48ae8', '#8a5ad0', '#dcc8ff'], ['#ffb060', '#f08a30', '#ffd6a8']];
  const TOPS = ['sprinkles', 'sauce', 'whip', 'stars', 'cherry'];
  const SWIRL_H = 28;   // art pixels of soft serve when the swirl is full

  /* ---------- the treat being built ---------- */
  const B = { box: 'cone', scoops: [], segs: [], amount: 0, tops: {}, sprinkles: [], stars: [] };
  function newBuild() {
    Object.assign(B, { box: ['cone', 'waffle', 'cup'][Math.floor(Math.random() * 3)], scoops: [], segs: [], amount: 0, tops: {}, sprinkles: [], stars: [] });
  }
  const built = () => B.scoops.length > 0 || B.amount > 0.15;
  // the container's opening: y of the rim and its width (art pixels, 0 = the counter)
  const boxTop = () => B.box === 'cup' ? { y: -15, w: 20 } : B.box === 'waffle' ? { y: -24, w: 20 } : { y: -22, w: 16 };
  const SR = 8;   // scoop radius
  const scoopX = i => (i % 2 ? 1 : -1) * (i ? 1 : 0);
  const scoopY = i => boxTop().y - 4 - i * 11;   // center of scoop i (the first one sits down in the rim)
  function swirlBase() {   // where the soft serve starts, and how wide
    const t = boxTop();
    return B.scoops.length ? { y: scoopY(B.scoops.length - 1) - 4, w: 18 } : { y: t.y + 3, w: t.w + 6 };   // overhangs the rim a little
  }
  const swirlH = () => Math.min(B.amount, 1) * SWIRL_H;
  const RING = 7, RINGS = [1, 0.8, 0.58, 0.36, 0.2];
  function swirlW(h) {   // full width of the soft serve h pixels above its base: fat ridged rings, each a step narrower
    const s = swirlBase(), i = Math.min(RINGS.length - 1, Math.floor(h / RING)), t = (h % RING) / RING;
    const w0 = RINGS[i], w1 = RINGS[Math.min(RINGS.length - 1, i + 1)];
    const bulge = 0.88 + 0.12 * Math.sin(Math.min(1, t * 1.25) * Math.PI);   // each ring is rounded
    return Math.max(2, Math.round(s.w * lerp(w0, (w0 + w1) / 2, t * t) * bulge));
  }
  // the top of the treat: apex y and half width at any y, for draping toppings over it
  function topShape() {
    if (B.amount > 0.05) { const s = swirlBase(), h = swirlH(); return { apex: s.y - h, hw: y => { const hh = s.y - y; return hh < 0 || hh > h ? 0 : swirlW(hh) / 2; } }; }
    if (B.scoops.length) { const i = B.scoops.length - 1, cy = scoopY(i), cx = scoopX(i); return { apex: cy - SR, cx, hw: y => Math.sqrt(Math.max(0, SR * SR - (y - cy) ** 2)) }; }
    const t = boxTop(); return { apex: t.y, hw: () => t.w / 2 - 1 };
  }
  function topSurface() { const ts = topShape(); return [ts.apex + 3, Math.max(3, ts.hw(ts.apex + 3))]; }

  /* ---------- drawing the treat (art pixels; caller scales) ---------- */
  function boxBack() {   // everything but the front lip
    if (B.box === 'cup') {
      for (let r = 0; r < 15; r++) {
        const w = Math.round(14 + r * 6 / 14), x0 = -Math.floor(w / 2), y = -1 - r;
        R(x0, y, w, 1, '#ffffff');
        for (let sx = x0 + 1; sx < x0 + w - 1; sx += 4) R(sx, y, 2, 1, '#ff8fb8');
        R(x0 + w - 2, y, 2, 1, '#e8b8cc');
      }
      R(-10, -16, 20, 1, '#c84a7a');   // the dark inside of the cup's opening
      return;
    }
    const waffle = B.box === 'waffle', top = waffle ? 22 : 20, w0 = waffle ? 18 : 15;
    for (let r = 0; r < top; r++) {
      const w = Math.max(2, Math.round(w0 - r * (w0 - 2) / top)), x0 = -Math.floor(w / 2), y = -top + r;
      R(x0, y, w, 1, '#dcaa62');
      for (let x = x0; x < x0 + w; x++) if ((x + r) % 4 === 0 || (x - r + 40) % 4 === 0) R(x, y, 1, 1, '#b07a34');   // the waffle diamonds
      R(x0 + w - 1, y, 1, 1, '#a06a2a');
    }
  }
  function boxFront() {   // the rim, drawn over the bottom of the ice cream so it sits inside
    if (B.box === 'cup') { R(-11, -16, 22, 2, '#ffffff'); R(-11, -14, 22, 1, '#e8d8e0'); for (let x = -10; x < 11; x += 4) R(x, -16, 2, 1, '#ffd0e4'); return; }
    if (B.box === 'waffle') { R(-11, -25, 22, 4, '#eec07a'); R(-11, -25, 22, 1, '#f8dca0'); R(-11, -21, 22, 1, '#b07a34'); for (let x = -10; x < 11; x += 3) R(x, -23, 1, 1, '#c88a40'); return; }
    R(-9, -23, 18, 3, '#eec07a'); R(-9, -23, 18, 1, '#f8dca0'); R(-9, -20, 18, 1, '#b07a34');
  }
  function drawScoop(c, cx, cy) {
    circle(cx + 1, cy + 1, SR, c[1]);                  // shade toward the bottom right
    circle(cx, cy, SR - 1, c[0]); R(cx - SR, cy - 1, 2 * SR, 3, c[0]);
    for (let x = -SR; x <= SR; x += 4) { circle(cx + x, cy + 6, 2, c[0]); R(cx + x - 1, cy + 8, 3, 1, c[1]); }   // the drippy lip
    R(cx - 4, cy - 5, 3, 2, c[2]); R(cx - 5, cy - 3, 2, 2, c[2]); R(cx - 2, cy - 6, 2, 1, '#ffffff');
  }
  function drawSwirl() {
    if (B.amount <= 0) return;
    const s = swirlBase(), full = Math.min(B.amount, 1.15) * SWIRL_H;
    let segI = 0;
    for (let h = 0; h < full; h++) {
      const a = h / SWIRL_H;
      while (segI < B.segs.length - 1 && B.segs[segI + 1].a0 <= a) segI++;
      const c = SWIRLS[B.segs[segI] ? B.segs[segI].f : 0], t = h % 7, w = swirlW(h), x0 = -Math.floor(w / 2), y = s.y - h;
      R(x0, y, w, 1, c[0]);
      if (t === 0) { R(x0, y, Math.ceil(w / 2), 1, c[1]); R(x0 + Math.ceil(w / 2), y - 1, Math.floor(w / 2), 1, c[1]); }   // a slanted crease makes it spiral
      if (t === 3 || t === 4) R(x0 + 1, y, Math.max(1, Math.round(w * 0.25)), 1, c[2]);
      R(x0 + w - 1, y, 1, 1, c[1]);
    }
    if (B.amount >= 1) {   // the curl on top
      const c = SWIRLS[B.segs.length ? B.segs[B.segs.length - 1].f : 0], ty = s.y - full;
      R(-1, ty - 1, 3, 2, c[0]); R(0, ty - 3, 3, 2, c[0]); R(2, ty - 4, 2, 1, c[0]); R(3, ty - 5, 1, 1, c[1]); R(0, ty - 2, 1, 1, c[2]);
    }
  }
  function drawToppings() {
    const ts = topShape(), ap = ts.apex, cx = ts.cx || 0;
    if (B.tops.sauce) {   // chocolate draped over the top, dripping down the sides
      for (let y = ap; y < ap + 7; y++) { const hw = Math.max(2, Math.round(ts.hw(y) + 0.5)); R(cx - hw, y, hw * 2, 1, '#6a3a1e'); }
      const hw = Math.max(2, ts.hw(ap + 6));
      for (const [f, d] of [[-0.85, 4], [-0.35, 2], [0.2, 5], [0.7, 3]]) { const x = Math.round(cx + f * hw); R(x, ap + 7, 1, d, '#6a3a1e'); R(x, ap + 7 + d, 1, 1, '#4a2410'); }
      R(cx - 2, ap + 1, 2, 1, '#9a6a40');
    }
    for (const p of B.sprinkles) { const y = Math.round(ap + 2 + p.v * 5), x = Math.round(cx + p.u * ts.hw(y) * 0.85); R(x, y, p.h ? 2 : 1, p.h ? 1 : 2, p.c); }
    for (const p of B.stars) { const y = Math.round(ap + 2 + p.v * 5), x = Math.round(cx + p.u * ts.hw(y) * 0.8); R(x - 1, y, 3, 1, p.c); R(x, y - 1, 1, 3, p.c); }
    let top = ap;
    if (B.tops.whip) {   // a dollop of whipped cream
      R(cx - 4, ap - 2, 9, 3, '#ffffff'); R(cx - 3, ap - 4, 7, 2, '#ffffff'); R(cx - 2, ap - 6, 5, 2, '#ffffff'); R(cx, ap - 8, 2, 2, '#ffffff');
      R(cx - 4, ap, 9, 1, '#dcd4e0'); R(cx + 2, ap - 4, 2, 2, '#ece6f0'); top = ap - 7;
    }
    if (B.tops.cherry) { R(cx - 2, top - 4, 5, 4, '#e8222b'); R(cx - 1, top - 5, 3, 6, '#e8222b'); R(cx - 1, top - 4, 1, 1, '#ff9a9a'); R(cx + 1, top - 8, 1, 3, '#3a8a2e'); R(cx + 2, top - 9, 2, 1, '#3a8a2e'); }
  }
  function drawTreat(x, yb, k, wob = 0) {
    g.save(); g.translate(Math.round(x), Math.round(yb)); g.scale(k, k);
    if (wob) g.rotate(wob);
    boxBack();
    B.scoops.forEach((c, i) => drawScoop(SCOOPS[c], scoopX(i), scoopY(i)));
    drawSwirl();
    boxFront();
    drawToppings();
    g.restore();
  }

  /* ---------- layout ---------- */
  const Y = {};
  function layout() {
    const wide = W > H * 1.2, s = L.blob;
    Y.wide = wide;
    // wide screens: the buttons stack down the left so the machines can sit at the very top and the treat grows
    const col = (i, sz) => ({ x: L.safeL + 4, y: L.safeT + 4 + i * (s + 8), s: sz });
    Y.back = col(0, s);
    Y.tabs = wide
      ? [{ m: 'swirl', ...col(1, s) }, { m: 'scoop', ...col(2, s) }]
      : [{ m: 'swirl', x: W - L.safeR - 4 - 2 * s - 8, y: L.safeT + 4, s }, { m: 'scoop', x: W - L.safeR - 4 - s, y: L.safeT + 4, s }];
    // toppings: a row along the bottom, or a column down the right side on wide screens
    const r = Math.max(11, Math.min(16, Math.floor(s * 0.62)));
    Y.tops = TOPS.map((t, i) => wide
      ? { t, x: W - L.safeR - r - 6, y: Math.round(lerp(L.safeT + r + 6, H - L.safeB - r - 6, i / 4)), r }
      : { t, x: Math.round(lerp(L.safeL + r + 8, W - L.safeR - r - 8, i / 4)), y: H - L.safeB - r - 8, r });
    const rx0 = wide ? L.safeL + s + 14 : L.safeL + 4, rx1 = wide ? W - L.safeR - 2 * r - 16 : W - L.safeR - 4;
    Y.row = { x0: rx0, x1: rx1, y: wide ? L.safeT + 6 : L.safeT + s + 12 };
    // the treat sits on the counter
    Y.yb = wide ? H - L.safeB - 6 : Y.tops[0].y - r - 12;
    // the machines sit on a sliding shelf: the chosen one glides over the treat, which stays in the middle
    let mw = Math.max(40, Math.min(58, Math.floor((rx1 - rx0) / (wide ? 4 : 3.2))));
    if (wide) {   // shrink the machines a little if that lets the treat grow a size
      const kk = Math.min(4, Math.floor((Y.yb - Y.row.y - 48) / 48));
      mw = Math.max(40, Math.min(mw, Y.yb - Y.row.y - 8 - 48 * kk));
    }
    Y.mw = mw;
    Y.mach = SWIRLS.map((_, i) => ({ i, bx: i * mw, x: 0, y: Y.row.y, w: mw - 6, h: Math.min(54, Math.round(mw * 1.0)) }));
    const tw = Math.min(40, Math.floor((rx1 - rx0) / 6));
    Y.tubs = SCOOPS.map((_, i) => ({ i, x: Math.round(lerp(rx0, rx1 - tw, i / 5)), y: Y.row.y + 6, w: tw - 3, h: Math.round(tw * 0.75) }));
    const room = Y.yb - (Y.row.y + Y.mach[0].h + 8);
    Y.k = Math.max(1, Math.min(4, Math.floor(room / 48), Math.floor((Y.wide ? (W - L.safeR - L.safeL) * 0.4 : W * 0.8) / 24)));   // the treat as big as the space allows
    Y.serve = wide ? col(3, s + 4) : { x: Math.round(W / 2 - (s + 4) / 2), y: L.safeT + 2, s: s + 4 };   // the serve bell
    Y.cxScoop = Math.round((rx0 + rx1) / 2);
  }

  /* ---------- state ---------- */
  const st = { shelf: 0, lift: 0, bounce: 0, mode: 'swirl', mach: 1, cx: 0, hold: null, pour: 0, flies: [], serveOut: 0, slideIn: 0, wob: 0, full: 0, made: 0 };
  let whirr = null;
  const nozzleX = i => Y.mach[i].x + Math.round(Y.mach[i].w / 2);
  const shelfTarget = () => Y.cxScoop - (Y.mach[st.mach].bx + Math.round(Y.mach[st.mach].w / 2));
  function placeMachines() { for (const m of Y.mach) { m.x = Math.round(m.bx + st.shelf); m.y = Y.row.y - Math.round(st.lift * (Y.row.y + m.h + 14)); } }
  const topped = () => Object.keys(B.tops).length > 0 || B.sprinkles.length > 0 || B.stars.length > 0;
  const nozzleY = i => Y.mach[i].y + Y.mach[i].h + 4;
  function targetX() { return Y.cxScoop; }
  function treatTopScreen() { const [ty] = topSurface(); return Y.yb + ty * Y.k; }

  function addTopping(t) {
    if (!built() || st.serveOut) { st.wob = 0.5; play('pop', 0.7); return; }
    const cols = ['#e8222b', '#2a6fe0', '#3fb43a', '#ffd21f', '#ff6fb4', '#ffffff'];
    if (t === 'sprinkles') {
      for (let i = 0; i < 14; i++) B.sprinkles.push({ u: Math.random() * 1.8 - 0.9, v: Math.random(), h: Math.random() < 0.5, c: cols[i % cols.length] });
      for (let i = 0; i < 4; i++) noise(i * 0.05, 0.04, 0.05, 4000, 2);
      spawn(16, () => ({ x: st.cx + rand(-14, 14), y: treatTopScreen() - 30, vx: 0, vy: rand(40, 70), g: 80, life: 0.45, max: 0.45, s: 1, c: pickOne(cols) }));
    } else if (t === 'stars') {
      for (let i = 0; i < 5; i++) B.stars.push({ u: Math.random() * 1.6 - 0.8, v: Math.random(), c: pickOne(['#ffd21f', '#ff6fb4', '#7ad0ff']) });
      tone('sine', 1319, 0, 0.12, 0.06); tone('sine', 1760, 0.08, 0.15, 0.05);
    } else if (t === 'sauce') { B.tops.sauce = true; tone('sine', 220, 0, 0.3, 0.07, 140); }
    else if (t === 'whip') { B.tops.whip = true; noise(0, 0.45, 0.08, 1800, 0.8); }
    else if (t === 'cherry') { B.tops.cherry = true; play('pop', 1.2); }
    sparkle(st.cx, treatTopScreen(), 12, 6, '#ffffff');
  }
  function addScoop(i) {
    if (st.serveOut || B.scoops.length + st.flies.length >= 3) { st.wob = 0.5; play('pop', 0.7); return; }
    const t = Y.tubs[i];
    st.flies.push({ f: i, k: 0, x0: t.x + t.w / 2, y0: t.y + t.h / 2 });
    play('pop');
  }
  function serve() {
    if (!built() || st.serveOut) return;
    st.serveOut = 0.001; st.made++;
    play('bell'); play('yum');
    confetti(40);
    sparkle(st.cx, Y.yb - 40, 30, 16);
  }

  function update(dt) {
    if (!whirr) whirr = noiseLoop(260, 0.9);
    st.wob = Math.max(0, st.wob - dt * 2);
    // slide the treat under the right machine
    if (!st.serveOut) st.cx += (targetX() - st.cx) * Math.min(1, dt * 7);
    // once toppings go on, the machines lift up out of the way so a tall treat has room
    const lt = topped() && st.hold == null ? 1 : 0;
    st.lift = lt > st.lift ? Math.min(lt, st.lift + dt * 2.5) : Math.max(lt, st.lift - dt * 4);
    st.shelf += (shelfTarget() - st.shelf) * Math.min(1, dt * 7); placeMachines();
    st.bounce = Math.max(0, st.bounce - dt * 3);
    if (st.slideIn > 0) st.slideIn = Math.max(0, st.slideIn - dt * 1.8);
    // pouring soft serve while a finger is down
    const near = Math.abs(st.shelf - shelfTarget()) < 3 && st.lift < 0.05 && !st.serveOut && st.slideIn === 0;
    const pouring = st.mode === 'swirl' && st.hold != null && near && B.amount < 1.15;
    st.pour += ((pouring ? 1 : 0) - st.pour) * Math.min(1, dt * 12);
    if (pouring) {
      const last = B.segs[B.segs.length - 1];
      if (!last || last.f !== st.mach) B.segs.push({ f: st.mach, a0: B.amount });
      B.amount = Math.min(1.15, B.amount + dt * 0.32);
      if (B.amount >= 1.15) { st.full = 1; st.bounce = 1; play('bell', 1.3); sparkle(st.cx, treatTopScreen(), 14, 10); }
    }
    whirr(pouring ? 0.07 : 0);
    st.full = Math.max(0, st.full - dt);
    // scoops flying from the tubs
    for (const f of st.flies) f.k += dt / 0.5;
    for (const f of st.flies.filter(f => f.k >= 1)) { B.scoops.push(f.f); tone('sine', 300, 0, 0.1, 0.1, 160); puff(st.cx, treatTopScreen(), 4, '#ffffff'); }
    st.flies = st.flies.filter(f => f.k < 1);
    // serving: the treat rises away, and a fresh one slides in
    if (st.serveOut) {
      st.serveOut += dt;
      if (st.serveOut > 1.1) { st.serveOut = 0; newBuild(); st.slideIn = 1; }
    }
  }

  /* ---------- drawing the kitchen ---------- */
  function wall() {
    R(0, 0, W, H, '#ffe8f0');
    for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < W; x += 12) R(x, y, 6, 6, '#ffdce8');
    const cy = Y.yb - 2;   // the counter top
    R(0, cy, W, H - cy, '#7ad8c0'); R(0, cy, W, 3, '#a8ecd8'); R(0, cy + 3, W, 1, '#4ab89a');
    for (let x = 4; x < W; x += 24) R(x, cy + 8, 16, Math.max(0, H - cy - 10), '#6ac8b0');
  }
  function machine(m, sel) {
    const c = SWIRLS[m.i], x = m.x, y = m.y, w = m.w, h = m.h;
    if (sel) alpha(0.5 + 0.3 * Math.sin(T * 6), () => R(x - 3, y - 3, w + 6, h + 10, '#ffd21f'));
    R(x, y, w, h - 10, '#d5dce3'); R(x, y, 3, h - 10, '#eef2f6'); R(x + w - 3, y, 3, h - 10, '#aab3bd');
    R(x + 4, y + 4, w - 8, 10, '#8a939d'); R(x + 5, y + 5, w - 10, 8, '#3a3d46');
    for (let i = 0; i < 3; i++) R(x + 6, y + 18 + i * 4, w - 12, 1, '#aab3bd');
    R(x, y + h - 10, w, 8, c[0]); R(x, y + h - 10, w, 2, c[2]); R(x, y + h - 4, w, 2, c[1]);
    const nx = x + Math.round(w / 2);
    R(nx - 3, y + h - 2, 6, 4, '#9aa3ad'); R(nx - 2, y + h + 2, 4, 2, '#7a838d');
    // the lever, with a knob in the flavor's color (pulled down while pouring)
    const pull = sel && st.pour > 0.5 ? 4 : 0;
    R(nx - 1, y + 6, 2, 8 + pull, '#5a5a66'); circle(nx, y + 6 + pull, 3, c[0]); R(nx - 1, y + 4 + pull, 1, 1, '#ffffff');
    // a little swirl showing the flavor
    R(nx - 4, y + 30, 9, 2, c[0]); R(nx - 3, y + 28, 7, 2, c[0]); R(nx - 2, y + 26, 5, 2, c[0]); R(nx, y + 24, 1, 2, c[0]);
  }
  function tub(t) {
    const c = SCOOPS[t.i], x = t.x, y = t.y, w = t.w, h = t.h;
    for (let i = 0; i < 4; i++) circle(x + 4 + i * (w - 8) / 3, y + 4, 4, c[0]);
    R(x + 1, y + 3, w - 2, 5, c[0]); R(x + 3, y + 1, 3, 2, c[2]);
    R(x, y + 7, w, h - 7, '#d5dce3'); R(x, y + 7, w, 2, '#ffffff'); R(x, y + h - 2, w, 2, '#aab3bd');
    R(x + 2, y + 11, w - 4, Math.max(2, h - 15), c[0]); R(x + 2, y + 11, w - 4, 1, c[2]);
  }
  function scooper(x, y) { R(x, y, 2, 10, '#9aa3ad'); circle(x + 1, y + 11, 3, '#cfd6dd'); R(x - 1, y - 2, 4, 3, '#e8222b'); }
  function topBtn(b) {
    roundButton(b.x, b.y, b.r, '#ffffff', false);
    const z = b.r >= 14 ? 2 : 1;   // icons drawn double size on big buttons
    g.save(); g.translate(b.x, b.y); g.scale(z, z);
    const x = 0, y = 0;
    if (b.t === 'sprinkles') { R(x - 3, y - 6, 7, 11, '#ff8fb8'); R(x - 3, y - 7, 7, 2, '#cfd6dd'); for (const [dx, dy, c] of [[-1, -1, '#e8222b'], [1, 1, '#2a6fe0'], [-1, 3, '#3fb43a'], [2, -3, '#ffd21f']]) R(x + dx, y + dy, 1, 1, c); }
    if (b.t === 'sauce') { R(x - 3, y - 4, 7, 10, '#6a3a1e'); R(x - 1, y - 8, 3, 4, '#6a3a1e'); R(x, y - 10, 1, 2, '#e8222b'); R(x - 2, y - 2, 5, 3, '#ffd21f'); }
    if (b.t === 'whip') { R(x - 3, y - 2, 7, 8, '#cfd6dd'); R(x - 2, y - 2, 1, 8, '#ffffff'); R(x - 1, y - 6, 3, 4, '#e8222b'); R(x, y - 8, 1, 2, '#9aa3ad'); }
    if (b.t === 'stars') { const c = '#ffd21f'; R(x - 4, y - 1, 9, 3, c); R(x - 1, y - 5, 3, 11, c); R(x - 3, y + 2, 2, 3, c); R(x + 2, y + 2, 2, 3, c); }
    if (b.t === 'cherry') { circle(x - 1, y + 2, 4, '#e8222b'); R(x - 3, y, 2, 1, '#ff8a8a'); R(x, y - 6, 1, 5, '#3a8a2e'); R(x + 1, y - 7, 3, 1, '#3a8a2e'); }
    g.restore();
  }
  function tabBtn(b) {
    const on = st.mode === b.m;
    button(b, on ? '#ffd21f' : '#ffffff', on ? '#e0b010' : '#cfd6dd');
    const cx = Math.round(b.x + b.s / 2), cy = Math.round(b.y + b.s / 2);
    if (b.m === 'swirl') { R(cx - 4, cy - 1, 9, 3, '#ff8fb8'); R(cx - 3, cy - 4, 7, 3, '#fff6e0'); R(cx - 1, cy - 6, 3, 2, '#ff8fb8'); for (let k = 0; k < 6; k++) R(cx - 3 + (k >> 1), cy + 2 + k, 7 - (k >> 1) * 2, 1, k % 2 ? '#b07a34' : '#d9a35a'); }
    else { circle(cx - 3, cy + 1, 4, '#9ef0c8'); circle(cx + 3, cy + 1, 4, '#ff8fb8'); R(cx - 7, cy + 4, 14, 4, '#cfd6dd'); scooper(cx + 4, cy - 9); }
  }
  function backBtn(b) {   // a little ice cream truck: back to the truck
    button(b, '#7ad0ff', '#4aa8e8');
    const x = Math.round(b.x + b.s / 2 - 9), y = Math.round(b.y + b.s / 2 - 5);
    R(x, y, 13, 8, '#fff6ea'); R(x + 13, y + 3, 5, 5, '#ff8fb8'); R(x + 14, y + 4, 3, 2, '#bfe6ff'); R(x, y + 6, 18, 2, '#ff8fb8');
    R(x + 3, y + 2, 5, 3, '#8a6a7a'); circle(x + 4, y + 9, 2, '#2f3240'); circle(x + 14, y + 9, 2, '#2f3240'); R(x + 5, y - 4, 3, 4, '#ffd0e4');
  }
  const HAND = ['..oo....', '.owwo...', '.owwo...', '.owwooo.', '.owwwwwo', 'oowwwwwo', 'owwwwwwo', 'owwwwwwo', '.owwwwo.', '..oooo..'];
  function hand(x, y, z) {   // a white pointing hand, finger up top
    HAND.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') R(x + i * z, y + j * z, z, z, c === 'o' ? INK : '#ffffff'); }));
  }
  function bellBtn(b) {
    const pop = 1 + 0.08 * Math.sin(T * 6);
    button(b, '#3fb43a', '#2f8a2c');
    const cx = Math.round(b.x + b.s / 2), cy = Math.round(b.y + b.s / 2 + 1), r = Math.round(7 * pop);
    circle(cx, cy, r, '#ffd21f'); R(cx - r, cy, 2 * r + 1, r + 1, '#3fb43a'); R(cx - r - 1, cy, 2 * r + 3, 2, '#e0b010'); R(cx - 1, cy - r - 2, 3, 2, '#e0b010'); R(cx - 3, cy - r + 2, 2, 2, '#fff3a6');
  }

  SCENES.icekitchen = {
    view: (w, h) => w > h * 1.2 ? [200, 200] : [150, 170],
    freeTouch: true,
    noWeather: true,
    layout,
    groundY: () => 0,
    enter() {
      layout(); newBuild();
      Object.assign(st, { mode: 'swirl', mach: Math.floor(Math.random() * SWIRLS.length), hold: null, pour: 0, flies: [], serveOut: 0, slideIn: 1, wob: 0, lift: 0 });
      st.cx = targetX(); st.shelf = shelfTarget(); placeMachines();
      const a = audio(); if (a) a.startMusic();
      SCENES.icecream._keepMusic = false;
    },
    leave() { st.hold = null; if (whirr) whirr(0); const a = audio(); if (a && !SCENES.icecream._keepMusic) a.stopMusic(); },
    update,
    drawWorld() {},   // the kitchen is indoors: everything is drawn in the UI layer so night doesn't darken it
    drawKitchen() {
      wall();
      if (st.mode === 'swirl') {
        g.save(); g.beginPath(); g.rect(Y.row.x0 - 4, 0, Y.row.x1 - Y.row.x0 + 8, H); g.clip();   // the shelf window
        Y.mach.forEach(m => machine(m, m.i === st.mach));
        g.restore();
        if (st.pour > 0.05) {   // the stream of soft serve
          const c = SWIRLS[st.mach], nx = nozzleX(st.mach), y0 = nozzleY(st.mach), y1 = treatTopScreen(), wv = Math.max(2, Math.round(3 * st.pour * Y.k));
          R(nx - Math.floor(wv / 2), y0, wv, Math.max(0, y1 - y0), c[0]); R(nx - Math.floor(wv / 2), y0, 1, Math.max(0, y1 - y0), c[2]);
        }
      } else {
        Y.tubs.forEach(tub);
        R(Y.row.x0, Y.tubs[0].y + Y.tubs[0].h + 2, Y.row.x1 - Y.row.x0, 2, '#cfd6dd');
      }
      // the treat: slides in fresh, rises away when served
      const out = st.serveOut, rise = out ? eout(clamp01(out / 1.1)) : 0;
      const sx = st.cx - st.slideIn * (W * 0.7), yb = Y.yb - rise * (Y.yb + 40);
      const wob = 0, hop = Math.round(Math.abs(Math.sin(st.bounce * Math.PI * 2)) * 3 * Y.k * st.bounce + Math.abs(Math.sin(T * 30)) * st.wob * 2 * Y.k);
      alpha(0.2, () => R(Math.round(sx - 10 * Y.k), Y.yb - 1, 20 * Y.k, 2, '#2a6a5a'));
      drawTreat(sx, yb - hop, Y.k, wob);
      for (const f of st.flies) {
        const k = eout(f.k), x = lerp(f.x0, st.cx, k), y = lerp(f.y0, treatTopScreen() - 4, k) - Math.sin(k * Math.PI) * 24, c = SCOOPS[f.f];
        g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(Y.k, Y.k); drawScoop(c, 0, 0); g.restore();
      }
    },
    drawLit() {},
    drawUI() {
      this.drawKitchen();
      drawParticles();
      backBtn(Y.back);
      Y.tabs.forEach(tabBtn);
      Y.tops.forEach(topBtn);
      if (built() && !st.serveOut) bellBtn(Y.serve);
      if (!built() && !st.serveOut && st.slideIn === 0 && st.hold == null) {   // a hint: a little hand pressing (or pointing at the tubs)
        const z = Math.max(2, Y.k), press = Math.floor(T * 2) % 2;
        const x = st.mode === 'swirl' ? Math.round(Math.min(W - L.safeR - 9 * z, st.cx + 10 * Y.k)) : Math.round(Y.tubs[0].x + Y.tubs[0].w / 2 - 3 * z);
        const y = st.mode === 'swirl' ? Math.round(Y.yb - 34 * Y.k) : Math.round(Y.tubs[0].y + Y.tubs[0].h + 2);
        hand(x, y + press * z * 2, z);
        if (press && st.mode === 'swirl') { R(x - 2 * z, y - z, z, z, '#ffffff'); R(x + 8 * z, y - z, z, z, '#ffffff'); }
      }
    },
    tap(x, y, id) {
      if (inBox(Y.back, x, y, 3)) { SCENES.icecream._keepMusic = true; play('pop'); goScene('icecream', { back: true }); return true; }
      for (const b of Y.tabs) if (inBox(b, x, y, 3)) { if (st.mode !== b.m) { st.mode = b.m; play('pop', 1.1); } return true; }
      for (const b of Y.tops) if ((x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + 5) ** 2) { addTopping(b.t); return true; }
      if (built() && !st.serveOut && inBox(Y.serve, x, y, 4)) { serve(); return true; }
      if (st.mode === 'scoop') {
        for (const t of Y.tubs) if (x >= t.x - 2 && x < t.x + t.w + 2 && y >= t.y - 6 && y < t.y + t.h + 4) { addScoop(t.i); return true; }
        return true;
      }
      if (x >= Y.row.x0 - 4 && x < Y.row.x1 + 4) for (const m of Y.mach) if (x >= m.x - 2 && x < m.x + m.w + 2 && y >= m.y - 4 && y < m.y + m.h + 6) {
        if (st.mach !== m.i) { st.mach = m.i; play('pop', 1.2); }
        break;
      }
      st.hold = id;   // press and hold anywhere to pour
      return true;
    },
    release(id) { if (st.hold === id) st.hold = null; },
    _st: st, _b: B, _y: Y, _draw: (x, yb, k) => drawTreat(x, yb, k),
  };
})();
