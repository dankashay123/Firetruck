// Cinema: "The Cat Who Got Stuck in a Tree", a one-minute watch-only cartoon.
// The family's silver tabby naps in the sunny garden until a butterfly lands on her nose. She
// chases it right up the tall tree... and then she's stuck on a high branch. The dogs bark, and
// the kid runs to the fire station for help. The alarm rings, the firefighters slide down the
// pole, and the red fire truck races through town with its lights and siren. At the tree the big
// ladder swings up, a firefighter climbs to the top and carries the cat gently down. Everyone
// cheers; the cat gives the firefighter a lick, curls up for a nap on the fire truck, and winks.
// Tap for pause and the timeline; only the home button leaves.
'use strict';
(() => {
  const BLACK = '#1d1a2b';
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const seg = (v, a, b) => clamp01((v - a) / (b - a));
  const eout = k => 1 - (1 - k) ** 3;
  const eio = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const hsh = TOY.hsh;
  const END = 62;
  const CAT = { B: '#aaa69e', S: '#55514a', EYE: '#a8d048', PUPIL: '#2a2a22', MOUTH: '#8a3a3a', TONGUE: '#e8708a' };
  // the garden: the big tree, and the branch the cat gets stuck on
  const TX = 150, BR_Y = -112, CAT_X = 112, CAT_Y = BR_Y - 2;
  const NAP_X = 40;
  const KID = 'kid2', KID_SKIN = SKIN[0], FF1 = SKIN[1], FF2 = SKIN[2];

  /* ---------- camera ---------- */
  const cam = { z: 1, ox: 0, oy: 0, cx: 0 };
  const sx = x => cam.ox + x * cam.z, sy = y => cam.oy + y * cam.z;
  // wide: true keeps the whole width in view even on an upright phone (busy scenes with lots of characters)
  function setCam(cx, cy, fw, fh, wide) {
    const kw = W / fw, kh = H / fh, tall = H > W * 1.3, crop = wide ? 1.15 : fw >= 140 ? (tall ? 2.2 : 1.75) : 1.3;
    const z = Math.max(1, Math.min(12, Math.floor(Math.min(kh, kw * crop))));
    cam.z = z; cam.cx = cx;
    cam.ox = Math.round(W / 2 - cx * z);
    cam.oy = Math.round(H * (tall ? 0.56 : 0.52) - cy * z);
  }
  function vis() { return { x0: Math.floor(-cam.ox / cam.z) - 2, x1: Math.ceil((W - cam.ox) / cam.z) + 2, y0: Math.floor(-cam.oy / cam.z) - 2, y1: Math.ceil((H - cam.oy) / cam.z) + 2 }; }
  function fill(y0, c, y1) { const v = vis(); R(v.x0, y0, v.x1 - v.x0, (y1 == null ? v.y1 : y1) - y0, c); }
  function ellipse(cx, cy, rx, ry, c) { TOY.oval(cx, cy, rx, ry, c); }
  function hills(base, amp, freq, seed, c, par = 0) {
    const v = vis(), off = cam.cx * par;
    for (let x = v.x0 - (v.x0 % 2); x < v.x1; x += 2) {
      const u = x - off, h = Math.round(amp * (0.6 + 0.4 * Math.sin(u * freq + seed) + 0.3 * Math.sin(u * freq * 2.3 + seed * 3)));
      if (h > 0) R(x, base - h, 2, h + 1, c);
    }
  }
  const SKY = {
    morning: ['#9ad4f0', '#ace0f4', '#c0e8f4', '#d4f0f0', '#e6f6e8'],
    day: ['#8ec8ec', '#a2d2ee', '#b8dcee', '#cce6ea', '#dcece2'],
    indoor: ['#8ec8ec', '#a2d2ee', '#b8dcee', '#cce6ea', '#dcece2'],
    dusk: ['#f2a07a', '#f4b486', '#f6c890', '#f8da9c', '#fae6aa'],
  };
  function drawSky(key) { const c = SKY[key] || SKY.day, n = c.length, bh = Math.ceil(H / n); for (let i = 0; i < n; i++) R(0, i * bh, W, bh + 1, c[i]); }
  function cloudRow(par, y, col = '#ffffff') { const v = vis(), off = cam.cx * par; for (let i = -2; i < 9; i++) { const x = ((i * 110 + off + T * 3) % 990) - 330; if (x > v.x0 - 40 && x < v.x1 + 40) { ellipse(x, y + (i % 3) * 7, 15, 5, col); ellipse(x + 9, y - 3 + (i % 3) * 7, 9, 5, col); } } }
  function sun(x, y, r = 10) { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + T * 0.4; R(x + Math.cos(a) * (r + 4) - 1, y + Math.sin(a) * (r + 4) - 1, 2, 2, '#ffd21f'); } circle(x, y, r, '#ffd21f'); circle(x - 2, y - 2, r - 3, '#ffe873'); R(x - 4, y - 2, 1, 2, '#7a4a10'); R(x + 3, y - 2, 1, 2, '#7a4a10'); R(x - 3, y + 3, 6, 1, '#7a4a10'); }
  function road(c = '#5b5f6b') {
    const v = vis();
    R(v.x0, -4, v.x1 - v.x0, 4, '#d8d2c4'); R(v.x0, -4, v.x1 - v.x0, 1, '#ece7da');
    R(v.x0, 0, v.x1 - v.x0, 14, c); for (let x = Math.floor(v.x0 / 14) * 14; x < v.x1; x += 14) R(x, 7, 7, 1, '#ffd21f');
    R(v.x0, 14, v.x1 - v.x0, v.y1 - 14, '#6cbf5a');
    for (let x = Math.floor(v.x0 / 9) * 9; x < v.x1; x += 9) R(x, 18 + Math.floor(hsh(x) * 20), 1, 2, hsh(x * 3) > 0.7 ? '#ffd21f' : '#5aa84c');
  }
  function house(x, base, w, h, wall, roof) {
    R(x, base - h, w, h, wall); for (let k = 0; k < 9; k++) R(x - 3 + k, base - h - 1 - k, w + 6 - 2 * k, 1, roof);
    R(x + w / 2 - 3, base - 11, 6, 11, '#8a5a32'); R(x + 4, base - h + 5, 7, 6, '#bfe6ff'); R(x + w - 11, base - h + 5, 7, 6, '#bfe6ff');
    R(x + 7, base - h + 5, 1, 6, '#ffffff'); R(x + w - 8, base - h + 5, 1, 6, '#ffffff');
  }
  function town(par = 0.5) {   // a row of houses and trees behind the road
    const v = vis(), off = cam.cx * par;
    for (let i = Math.floor((v.x0 - off - 60) / 52); i < (v.x1 - off + 60) / 52; i++) {
      const x = Math.round(i * 52 + off), h = hsh(i), cols = [['#ffb0c8', '#c8432f'], ['#bfe6ff', '#2a6fe0'], ['#fff2a8', '#8a4fd9'], ['#c8f0c0', '#a83a2a']][Math.floor(h * 4)];
      house(x, -4, 30, 22 + Math.floor(hsh(i * 3) * 10), cols[0], cols[1]);
      drawTree(x + 42, -4, 8 + Math.floor(hsh(i * 5) * 3));
    }
  }
  function birds(n, y, sp = 20) { for (let i = 0; i < n; i++) { const x = ((T * sp + i * 70) % 400) - 200 + cam.cx, yy = y + Math.sin(T * 2 + i) * 4 + i * 6, f = Math.floor(T * 8 + i) % 2; R(x - 3, yy - f, 3, 1, '#3a3d46'); R(x, yy, 1, 1, '#3a3d46'); R(x + 1, yy - f, 3, 1, '#3a3d46'); } }
  function heart(cx, cy, r, c) { circle(cx - r / 2, cy - r / 3, r / 2 + 0.5, c); circle(cx + r / 2, cy - r / 3, r / 2 + 0.5, c); for (let k = 0; k <= r; k++) R(cx - r + k, cy - r / 3 + k, 2 * (r - k) + 1, 1, c); }
  function hearts(x, y, t0, t, n = 3) { if (t < t0 || t > t0 + 1.6) return; for (let i = 0; i < n; i++) { const k = ((t - t0) * 0.8 + i * 0.3) % 1; alpha(1 - k, () => heart(Math.round(x + (i - (n - 1) / 2) * 7 + Math.sin(T * 4 + i) * 2), Math.round(y - k * 16), 2, '#e8222b')); } }
  function zs(x, y) { for (let i = 0; i < 3; i++) { const k = (T * 0.6 + i / 3) % 1; alpha(1 - k, () => text('Z', Math.round(x + k * 8 + i), Math.round(y - k * 14), 1, '#5a5a8a')); } }

  /* ---------- the garden ---------- */
  function flower(x, base, c) { R(x, base - 5, 1, 5, '#3a8a2e'); R(x - 1, base - 7, 3, 1, c); R(x - 1, base - 9, 3, 1, c); R(x - 2, base - 8, 5, 1, c); R(x, base - 8, 1, 1, '#ffd21f'); }
  function fence(base) {
    const v = vis();
    for (let x = Math.floor(v.x0 / 7) * 7; x < v.x1; x += 7) { R(x, base - 14, 5, 14, '#fbf8f0'); R(x + 1, base - 15, 3, 1, '#fbf8f0'); R(x + 4, base - 14, 1, 14, '#d8d2c4'); }
    R(v.x0, base - 11, v.x1 - v.x0, 2, '#ece7da'); R(v.x0, base - 5, v.x1 - v.x0, 2, '#ece7da');
  }
  function bush(x, base, r) { circle(x, base - r, r, '#3f9a45'); circle(x - r * 0.6, base - r * 0.7, r * 0.7, '#3f9a45'); circle(x + r * 0.7, base - r * 0.6, r * 0.65, '#3f9a45'); circle(x - 1, base - r - 2, r * 0.5, '#5bb85a'); }
  // the tall tree; its long left branch is where the cat gets stuck
  function bigTree(x, wob = 0) {
    // trunk
    R(x - 5, -150, 11, 150, '#7a4a2a'); R(x - 5, -150, 2, 150, '#8e5a34'); R(x + 3, -150, 3, 150, '#64381e');
    for (let y = -140; y < -4; y += 13) { R(x - 2 + (y % 3), y, 3, 1, '#5a3218'); R(x + 1, y + 6, 2, 1, '#5a3218'); }
    R(x - 8, -3, 5, 3, '#7a4a2a'); R(x + 5, -3, 5, 3, '#64381e');   // roots
    circle(x, -66, 2, '#4a2a14');   // a knot hole
    // the right branch
    TOY.bar(x + 4, -92, x + 34, -104, 4, '#7a4a2a');
    // canopy (behind the long branch)
    const lc = '#3f9a45', lh = '#5bb85a';
    circle(x + 30, -112, 18, lc); circle(x, -160, 32, lc); circle(x - 26, -142, 20, lc); circle(x + 26, -146, 22, lc); circle(x + 4, -192, 22, lc); circle(x - 22, -178, 18, lc); circle(x + 28, -180, 18, lc);
    circle(x - 8, -174, 14, lh); circle(x + 16, -160, 12, lh); circle(x - 26, -150, 9, lh); circle(x + 10, -200, 10, lh); circle(x + 34, -118, 8, lh);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 8 + hsh(i) * 26; R(x + Math.cos(a) * r, -164 + Math.sin(a) * r, 2, 2, '#e8222b'); }   // apples
    // the long left branch, bending a little under the cat
    const y = BR_Y, tip = CAT_X - 10;
    for (let bx = tip; bx < x; bx++) { const k = (x - bx) / (x - tip), dy = Math.round(wob * k * k); R(bx, y - 1 + dy - Math.round((1 - k) * 2), 1, Math.max(2, Math.round(5 - k * 3)), bx % 5 ? '#7a4a2a' : '#64381e'); }
    // a little leafy twig on the end
    circle(tip - 1, y - 3 + Math.round(wob), 3, lc); R(tip - 3, y - 6 + Math.round(wob), 2, 2, lh);
  }
  function garden(t, o = {}) {
    cloudRow(0.6, -230); cloudRow(0.5, -120);
    hills(-16, 20, 0.025, 3, '#a8dc94', 0.4);
    // the family's house over on the left, behind the fence
    house(-120, -8, 54, 46, '#ffe6b8', '#c8432f');
    fence(-4);
    bush(-20, -4, 7); bush(196, -4, 8);
    bigTree(TX, o.wob || 0);
    fill(-4, '#7ccc66', 0); fill(0, '#6cbf5a');
    const v = vis();
    for (let x = Math.floor(v.x0 / 7) * 7; x < v.x1; x += 7) { const h = hsh(x); if (h > 0.55) R(x, 2 + Math.floor(h * 30), 1, 2, '#5aa84c'); }
    for (const [fx, c] of [[-6, '#ff6fb4'], [0, '#ffd21f'], [6, '#ffffff'], [70, '#8a4fd9'], [78, '#ff6fb4'], [176, '#ffd21f'], [184, '#ff6fb4'], [-40, '#ffffff']]) flower(fx, 0, c);
    for (let x = Math.floor(v.x0 / 23) * 23; x < v.x1; x += 23) if (hsh(x * 7) > 0.5) flower(x + 11, 14 + Math.floor(hsh(x) * 18), ['#ff6fb4', '#ffd21f', '#ffffff', '#8a4fd9'][Math.floor(hsh(x * 3) * 4)]);
  }

  /* ---------- the cast ---------- */
  // the cat, sitting and facing you, plus a face on top: 'down' (scared, looking down), 'up', 'wink', 'happy', 'lick'
  function catSit(x, yb, o = {}) {
    PETS.catSit(x, yb, o);
    x = Math.round(x); const y = Math.round(yb - (o.hop || 0));
    const P = (dx, dy, w, h, c) => R(x + dx, y + dy, w, h, c);
    const f = o.face;
    if (f === 'down' || f === 'up') { const py = f === 'down' ? -12 : -13; P(-3, -13, 2, 2, CAT.EYE); P(2, -13, 2, 2, CAT.EYE); P(-3, py, 2, 1, CAT.PUPIL); P(2, py, 2, 1, CAT.PUPIL); }
    if (f === 'down') P(0, -9, 1, 1, CAT.MOUTH);
    if (f === 'wink' || f === 'happy' || f === 'lick') {
      P(2, -13, 2, 2, CAT.B); P(2, -12, 2, 1, CAT.S); P(4, -13, 1, 1, CAT.S);
      if (f !== 'wink') { P(-3, -13, 2, 2, CAT.B); P(-3, -12, 2, 1, CAT.S); P(-4, -13, 1, 1, CAT.S); }
      P(-1, -9, 1, 1, CAT.MOUTH); P(1, -9, 1, 1, CAT.MOUTH);
    }
    if (f === 'lick') P(0, -9, 1, 2, CAT.TONGUE);
  }
  // climbing straight up a trunk: feet against the bark at x = fx, body hanging to the left, center at y
  function catClimb(fx, y, run) {
    g.save(); g.translate(Math.round(fx), Math.round(y)); g.rotate(-Math.PI / 2);
    PETS.catWalk(0, 0, 1, { run });
    g.restore();
  }
  function butterfly(x, y, o = {}) {
    x = Math.round(x); y = Math.round(y);
    const flap = o.rest ? Math.floor(T * 2) % 3 === 0 : Math.floor(T * 12) % 2 === 0;
    const W1 = '#f57a12', W2 = '#ffd21f', D = '#3a2a1a';
    if (flap) { R(x - 4, y - 4, 4, 4, W1); R(x + 1, y - 4, 4, 4, W1); R(x - 3, y, 3, 2, W2); R(x + 1, y, 3, 2, W2); R(x - 4, y - 4, 1, 1, D); R(x + 4, y - 4, 1, 1, D); R(x - 2, y - 3, 1, 1, '#ffffff'); R(x + 2, y - 3, 1, 1, '#ffffff'); }
    else { R(x - 2, y - 5, 2, 5, W1); R(x + 1, y - 5, 2, 5, W1); R(x - 1, y - 1, 1, 2, W2); R(x + 1, y - 1, 1, 2, W2); }
    R(x, y - 4, 1, 6, D); R(x - 1, y - 6, 1, 2, D); R(x + 1, y - 6, 1, 2, D);
  }
  const D = () => SCENES.icecream && SCENES.icecream._dogs;
  function vizsla(x, yb, dir, o = {}) { const d = D(); if (d) d.vizsla(x, yb, dir, Object.assign({ wag: true }, o)); }
  function husky(x, yb, dir, o = {}) { const d = D(); if (d) d.husky(x, yb - 1, dir, Object.assign({ wag: true }, o)); }
  const person = (type, x, yb, o = {}) => drawPerson(Object.assign({ type, x, yb, dir: 1, pose: 'stand', skin: FF1, seed: 0 }, o));
  const kid = (x, yb, o = {}) => drawPerson(Object.assign({ type: KID, x, yb, dir: 1, pose: 'stand', skin: KID_SKIN, seed: 4 }, o));

  // the red fire truck (facing right, 65 long), optionally with its ladder raised instead of stowed
  function fireTruck(x, yb, lit, o = {}) {
    x = Math.round(x); yb = Math.round(yb);
    const rot = o.rot || 0;
    if (o.ladder) {   // hide the stowed ladder: draw everything below the ladder rack, plus the cab
      g.save(); g.beginPath(); g.rect(x - 2, yb - 26, 72, 30); g.rect(x + 46, yb - 45, 24, 22); g.clip();
      drawV(VI.fire, x, yb, lit, 0, rot);
      g.restore();
      const { ang, len } = o.ladder, px = x + 6, py = yb - 30;
      R(px - 4, py - 1, 12, 5, '#6b7480'); R(px - 3, py - 2, 10, 1, '#8b96a1'); circle(px, py, 3, '#4d5560');
      ladder(px, py, ang, len);
    } else drawV(VI.fire, x, yb, lit, 0, rot);
    if (o.crew) for (let i = 0; i < o.crew; i++) { const hx = x + 52 + i * 5; R(hx, yb - 25, 4, 4, i ? FF2 : FF1); R(hx - 1, yb - 27, 6, 2, '#e8222b'); R(hx + 3, yb - 23, 1, 1, INK); }
  }
  // the turntable ladder: from (px, py) at angle ang (up from horizontal, toward the right), len long
  function ladder(px, py, ang, len) {
    const dx = Math.cos(ang), dy = -Math.sin(ang), nx = Math.sin(ang), ny = Math.cos(ang);
    const base = Math.min(len, 44);
    const plot = (s, off, c) => R(Math.round(px + dx * s + nx * off), Math.round(py + dy * s + ny * off), 1, 1, c);
    // the base section (wider), then the fly section sliding out of it
    for (let s = 0; s <= base; s += 0.5) { plot(s, -3, '#e9eef2'); plot(s, 3, '#8b96a1'); }
    for (let s = 2; s <= base; s += 5) for (let o = -3; o <= 3; o += 0.5) plot(s, o, '#cfd6dd');
    for (let s = Math.max(0, base - 40); s <= len; s += 0.5) { plot(s, -2, '#ffffff'); plot(s, 2, '#b4bec8'); }
    for (let s = Math.max(0, base - 40) + 1; s <= len; s += 4) for (let o = -2; o <= 2; o += 0.5) plot(s, o, '#e9eef2');
    for (let o = -2; o <= 2; o += 0.5) plot(len, o, '#e8222b');
  }

  /* ---------- the fire station (ground at y = 0, centered on x = 0) ---------- */
  const ST = { x0: -90, x1: 90, floor: -44, roof: -82, pole: -74, door: 84 };
  const BRICK = '#b5523b', MORTAR = '#934130', TRIM = '#efe3c6', DARKIN = '#3a3442';
  function bricks(x, y, w, h) { for (let yy = y + 3; yy < y + h; yy += 4) R(x, yy, w, 1, MORTAR); for (let yy = y, r = 0; yy < y + h; yy += 4, r++) for (let xx = x + (r % 2 ? 3 : 0); xx < x + w; xx += 8) R(xx, yy, 1, 3, MORTAR); }
  function bellTower(bx, top, ring) {
    R(bx - 12, top - 3, 24, 3, TRIM); R(bx - 9, top - 6, 18, 3, TRIM); R(bx - 4, top - 9, 8, 3, TRIM);
    R(bx - 10, top, 20, 18, BRICK); R(bx - 6, top + 3, 12, 11, DARKIN);
    const sw = ring ? Math.round(Math.sin(T * 22) * 2) : 0;
    R(bx - 3 + sw, top + 4, 6, 2, '#ffd21f'); R(bx - 4 + sw, top + 6, 8, 5, '#ffd21f'); R(bx - 5 + sw, top + 11, 10, 2, '#e0a81a'); R(bx - 1 - sw, top + 13, 2, 2, '#c99410');
    if (ring && Math.floor(T * 8) % 2) { R(bx - 15, top + 4, 2, 1, '#ffffff'); R(bx - 16, top + 8, 3, 1, '#ffffff'); R(bx + 14, top + 4, 2, 1, '#ffffff'); R(bx + 14, top + 8, 3, 1, '#ffffff'); }
  }
  // outside, from the street: a red garage door on the right, windows upstairs
  function stationFront(doorK = 0) {
    const { x0, x1, roof } = ST;
    bellTower(40, roof - 18, doorK > 0);
    R(x0, roof, x1 - x0, -roof, BRICK); bricks(x0, roof, x1 - x0, -roof);
    R(x0 - 3, roof - 4, x1 - x0 + 6, 4, TRIM);
    R(-40, roof + 8, 80, 12, '#7a1f1f'); text('FIRE', -27, roof + 10, 2, '#fff6e0');
    for (const wx of [-80, 56]) { R(wx, roof + 8, 18, 14, '#ffffff'); R(wx + 1, roof + 9, 16, 12, '#bfe6ff'); R(wx + 8, roof + 9, 1, 12, '#ffffff'); }
    // the big garage door with the truck peeking through its windows
    R(4, -46, 78, 46, TRIM); R(8, -42, 70, 42, DARKIN);
    for (let y = -42; y < 0; y += 6) { R(8, y, 70, 5, '#e8222b'); R(8, y + 5, 70, 1, '#a3121d'); }
    for (let i = 0; i < 4; i++) { R(12 + i * 17, -36, 12, 5, '#bfe6ff'); R(13 + i * 17, -35, 3, 3, '#e8222b'); }
    // the people door
    R(-62, -30, 18, 30, TRIM); R(-59, -27, 12, 27, '#8a5a32'); R(-56, -24, 6, 7, '#bfe6ff'); R(-50, -14, 2, 2, '#ffd21f');
    R(-30, -24, 16, 12, '#ffffff'); R(-29, -23, 14, 10, '#bfe6ff');
    R(x0, -2, x1 - x0, 2, '#57505f');
  }
  // the cutaway: crew room upstairs, the pole, the truck in the garage, the roll-up door on the right
  function stationCut(alarm, doorUp) {
    const { x0, x1, floor, roof, pole, door } = ST;
    bellTower(40, roof - 18, alarm);
    R(x0, roof - 2, x1 - x0, -roof + 2, BRICK); bricks(x0, roof - 2, x1 - x0, -roof + 2);
    R(x0 - 3, roof - 6, x1 - x0 + 6, 4, TRIM);
    // crew room
    const ix0 = x0 + 4, ix1 = x1 - 6;
    R(ix0, roof + 2, ix1 - ix0, floor - roof - 2, '#f3e2c3'); R(ix0, floor - 9, ix1 - ix0, 9, '#e2c99e'); R(ix0, floor - 10, ix1 - ix0, 1, '#cdb184');
    R(-14, roof + 9, 24, 16, '#ffffff'); R(-13, roof + 10, 22, 14, '#bfe6ff'); R(-2, roof + 10, 1, 14, '#ffffff');
    const lx = -2; R(lx, roof + 2, 1, 4, '#5a5f6e'); R(lx - 3, roof + 6, 7, 2, '#ffe873');
    for (let k = 0; k < 2; k++) { const hx = 64 + k * 9; R(hx + 2, roof + 6, 1, 2, '#5a5f6e'); R(hx, roof + 8, 6, 3, '#e8222b'); R(hx - 1, roof + 10, 8, 1, '#e8222b'); }   // helmets on hooks
    // couch and table with soup
    const cx = -62; R(cx, floor - 19, 5, 19, '#a8403d'); R(cx, floor - 8, 34, 5, '#c0504d'); R(cx, floor - 8, 34, 1, '#d8706d'); R(cx + 30, floor - 12, 5, 9, '#a8403d'); R(cx + 2, floor - 3, 2, 3, '#6b2a28'); R(cx + 31, floor - 3, 2, 3, '#6b2a28');
    const tb = 26; R(tb, floor - 14, 28, 3, '#a8703f'); R(tb + 2, floor - 11, 2, 11, '#8a5a3a'); R(tb + 24, floor - 11, 2, 11, '#8a5a3a');
    R(tb + 4, floor - 17, 8, 3, '#f4f7fb'); R(tb + 5, floor - 18, 6, 1, '#f57a12'); R(tb + 18, floor - 20, 5, 6, '#ffffff'); R(tb + 18, floor - 17, 5, 2, '#2a6fe0');
    // floor with the pole hole, garage below
    R(x0, floor, x1 - x0, 4, '#8a5a3a'); R(pole - 4, floor, 8, 4, '#2a2530');
    R(ix0, floor + 4, door - ix0, -floor - 4, DARKIN); R(ix0, floor + 12, door - ix0, 1, '#463f50'); R(ix0, floor + 26, door - ix0, 1, '#463f50');
    R(-20, floor + 4, 9, 2, '#fffbe0');
    R(x0, -3, x1 - x0, 3, '#57505f');
    // the pole
    R(pole - 1, roof + 2, 2, -roof - 5, '#e0b010'); R(pole - 1, roof + 2, 1, -roof - 5, '#fff3a6');
    // alarm light housings (they flash in drawLit)
    R(ix1 - 8, roof + 4, 5, 3, '#5a5f6e'); R(door - 10, floor + 7, 5, 3, '#5a5f6e');
    // the roll-up door (in the right wall)
    const h = Math.round((-floor - 4) * (1 - doorUp));
    R(door, floor + 4, x1 - door, -floor - 4, '#2a2530');
    for (let y = floor + 4; y < floor + 4 + h; y += 4) { R(door, y, x1 - door, 3, '#e8222b'); R(door, y + 3, x1 - door, 1, '#a3121d'); }
  }
  function alarmLights(on) {
    const { roof, floor, door, x1 } = ST, ph = Math.floor(T * 6) % 2;
    if (!on) return;
    for (const [x, y, p] of [[x1 - 14, roof + 5, 0], [door - 8, floor + 8, 1]]) {
      const c = ph === p ? '#ff3b3b' : '#8c2a2a';
      R(x - 2, y - 1, 5, 3, c);
      if (ph === p) { alpha(0.25, () => circle(x, y, 10, '#ff3b3b')); alpha(0.5, () => circle(x, y, 4, '#ff6a5a')); }
    }
  }
  // a firefighter's run: sit/eat → run to the pole → slide down → run to the cab → hop in
  function crewPath(who, t, s) {
    const { floor, pole } = ST, seatX = who ? 34 : -46, cabX = -45 + (who ? 50 : 56);
    if (t < s.go) return who ? { x: seatX, yb: floor, pose: 'eat', dir: 1 } : { x: seatX, yb: floor - 7, pose: 'sit', dir: 1 };
    if (t < s.pole) return { x: lerp(seatX, pole + 4, seg(t, s.go, s.pole)), yb: floor, pose: 'stand', dir: -1, walk: true };
    if (t < s.land) { const k = seg(t, s.pole, s.land); return { x: pole + 4, yb: lerp(floor, -2, k * k), pose: 'slide', dir: -1 }; }
    if (t < s.land + 0.15) return { x: pole + 4, yb: -2, pose: 'stand', dir: 1 };
    if (t < s.cab) return { x: lerp(pole + 4, cabX, seg(t, s.land + 0.15, s.cab)), yb: -2, pose: 'stand', dir: 1, walk: true };
    if (t < s.cab + 0.3) { const k = seg(t, s.cab, s.cab + 0.3); return { x: cabX, yb: -2, hop: Math.sin(k * Math.PI) * 9, pose: 'wave', dir: 1, fade: 1 - k }; }
    return null;
  }
  const CREW = [{ go: 25.7, pole: 26.2, land: 26.9, cab: 27.6 }, { go: 26.0, pole: 26.9, land: 27.6, cab: 28.3 }];

  /* ---------- the rescue: where the ladder and the firefighter are at time t ---------- */
  const TRUCK_X = 0;
  const PIV = { x: TRUCK_X + 6, y: -30 };
  const TIP = { x: CAT_X - 9, y: BR_Y + 4 };
  const ANG = Math.atan2(PIV.y - TIP.y, TIP.x - PIV.x), LEN = Math.hypot(TIP.x - PIV.x, TIP.y - PIV.y);
  function ladderAt(t) {
    if (t < 40.6) return { ang: 0, len: 40 };
    const up = eio(seg(t, 40.6, 42.2)), out = eio(seg(t, 42.2, 43.8));
    return { ang: ANG * up, len: lerp(40, LEN, out) };
  }
  const onLadder = s => ({ x: PIV.x + Math.cos(ANG) * s, y: PIV.y - Math.sin(ANG) * s });
  // the climbing firefighter: { x, yb, pose, dir, walk, cat (carrying her) }
  function climber(t) {
    if (t < 44.6) return { x: PIV.x + 2, yb: PIV.y, pose: 'wave', dir: 1 };
    if (t < 47.2) { const p = onLadder(lerp(4, LEN - 6, eio(seg(t, 44.6, 47.2)))); return { x: p.x, yb: p.y, pose: 'slide', dir: 1, walk: true }; }
    const top = onLadder(LEN - 6);
    if (t < 48.4) return { x: top.x, yb: top.y, pose: t > 47.6 ? 'carry' : 'slide', dir: 1, cat: t > 48.0 };
    if (t < 51.0) { const p = onLadder(lerp(LEN - 6, 4, eio(seg(t, 48.4, 51.0)))); return { x: p.x, yb: p.y, pose: 'carry', dir: -1, walk: true, cat: true }; }
    if (t < 51.8) { const k = seg(t, 51.0, 51.8); return { x: lerp(PIV.x, 82, k), yb: lerp(PIV.y, 0, k) - Math.sin(k * Math.PI) * 16, pose: 'carry', dir: 1, cat: true }; }
    return { x: 82, yb: 0, pose: 'carry', dir: 1, cat: true, hop: t > 52.2 && t < 53 ? Math.abs(Math.sin((t - 52.2) * 8)) * 3 : 0 };
  }
  // the cat in a firefighter's arms
  function heldCat(p, face) {
    const x = p.x + p.dir * 3, yb = p.yb - (p.hop || 0) - 5;
    catSit(x, yb, { face, blink: false });
  }

  /* ---------- word bubbles ---------- */
  const WORD_C = { 'ZZZ': '#5a5a8a', 'MEOW?': '#55514a', 'MEOW!': '#55514a', 'POUNCE!': '#f57a12', 'UP UP!': '#3fb43a', 'UH OH!': '#2a6fe0', 'WOOF!': '#8a3a1a', 'OH NO!': '#2a6fe0', 'HELP!': '#e8222b', 'DING DING!': '#c99a10', 'WHEE!': '#ff6fb4', 'WEE-OO!': '#e8222b', 'HONK HONK!': '#e8222b', 'UP UP UP!': '#3fb43a', 'HOORAY!': '#3fb43a', 'LICK!': '#ff6fb4', 'PURR': '#8a4fd9' };
  function word(str, x, y, s, c) {   // the font has no dash, so draw it by hand
    text(str.replace(/-/g, ' '), x, y, s, c);
    [...str].forEach((ch, i) => { if (ch === '-') R(x + i * 4 * s, y + 2 * s, 3 * s, s, c); });
  }
  function bubble(str, ax, ay, age, big = false) {
    if (age < 0 || age > 1.7) return;
    const s = Math.max(1, Math.min(4, Math.round(Math.min(W, H) / (big ? 70 : 95))));
    const tw = textWidth(str, s), bw = tw + 6 * s, bh = 11 * s;
    const pop = age < 0.18 ? eout(age / 0.18) : 1, fade = age > 1.45 ? 1 - (age - 1.45) / 0.25 : 1;
    let bx = Math.round(ax - bw / 2), by = Math.round(ay - bh - 6 * s - (1 - pop) * 6);
    bx = Math.max(L.safeL + 4, Math.min(W - L.safeR - bw - 4, bx)); by = Math.max(L.safeT + 4, Math.min(H - L.safeB - bh - 40, by));
    alpha(Math.max(0, fade), () => {
      R(bx + 2, by + 2, bw, bh, 'rgba(0,0,0,0.18)');
      R(bx - 1, by + 1, bw + 2, bh - 2, INK); R(bx + 1, by - 1, bw - 2, bh + 2, INK);
      R(bx, by + 1, bw, bh - 2, '#ffffff'); R(bx + 1, by, bw - 2, bh, '#ffffff');
      const tx = Math.max(bx + 4, Math.min(bx + bw - 8, Math.round(ax))), ty = by + bh;
      for (let k = 0; k < 4; k++) { R(tx - (3 - k) - 1, ty + k - 1, Math.max(1, 2 * (3 - k)) + 2, 1, INK); if (k < 3) R(tx - (3 - k), ty + k - 1, 2 * (3 - k), 1, '#ffffff'); }
      word(str, bx + 3 * s, by + 3 * s, s, WORD_C[str] || INK);
    });
  }

  /* ---------- sounds ---------- */
  const SND = TOY.bank({
    meow: ['cat-meow', 0.6], meow2: ['cat-meow2', 0.55], purr: ['cat-purr', 0.7], woof: ['dog-bark', 0.65], woof2: ['dog-bark-2', 0.6],
    bell: ['ic-bell', 0.55], honk: ['bt-honk', 0.6], chime: ['mv-chime', 0.5],
    twinkle: ['mc-twinkle', 0.5], swish: ['mc-swish', 0.35], creak: ['mc-creak', 0.6], ratchet: ['mc-ratchet', 0.45], siren: ['mc-siren', 0.32],
  }, {
    meow() { SFX.meow(); }, meow2() { SFX.meow(); }, purr() { for (let i = 0; i < 10; i++) noise(i * 0.12, 0.1, 0.03, 120, 2); },
    woof() { SFX.woof(); }, woof2() { SFX.woof(); }, bell() { SFX.bell(); }, honk() { SFX.honk(); }, chime() { SFX.chime(); },
    twinkle() { [1319, 1568, 1976, 2637].forEach((f, i) => tone('sine', f, i * 0.08, 0.3, 0.04)); }, swish() { SFX.whoosh(); },
    creak() { tone('sawtooth', 180, 0, 0.6, 0.03, 140); }, ratchet() { for (let i = 0; i < 4; i++) noise(i * 0.05, 0.03, 0.08, 2000, 3); },
  });
  const SYNTH = {
    'ZZZ'() { tone('sine', 220, 0, 0.6, 0.04, 180); },
    'POUNCE!'() { SND.play('swish', 1.1); tone('sine', 500, 0, 0.15, 0.06, 900); },
    'UP UP!'() { [523, 659, 784].forEach((f, i) => tone('triangle', f, i * 0.12, 0.12, 0.06)); },
    'UP UP UP!'() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, i * 0.14, 0.12, 0.06)); },
    'UH OH!'() { tone('sine', 523, 0, 0.25, 0.1); tone('sine', 392, 0.28, 0.4, 0.1); },
    'OH NO!'() { tone('sine', 466, 0, 0.25, 0.09); tone('sine', 349, 0.28, 0.45, 0.09); },
    'HELP!'() { [784, 988].forEach((f, i) => tone('triangle', f, i * 0.18, 0.18, 0.08)); },
    'WHEE!'() { tone('sine', 1200, 0, 0.6, 0.07, 500); },
    'WEE-OO!'() {}, 'HOORAY!'() { SFX.fanfare(); },
    'LICK!'() { tone('sine', 900, 0, 0.06, 0.06, 1400); tone('sine', 900, 0.1, 0.06, 0.06, 1400); },
  };
  function playWord(w, snd, rate) { if (snd) SND.play(snd, rate || 1); else if (SYNTH[w]) SYNTH[w](); }
  const siren = SND.loop('siren');
  const music = { buf: null, src: null, gain: null };
  let loadedMusic = false;
  function loadMusic() {
    if (loadedMusic || !ac) return; loadedMusic = true; SND.load();
    fetch('audio/mc-music.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab && ac.decodeAudioData(ab)).then(b => { if (b) music.buf = b; }).catch(() => {});
  }
  function stopMusic() { if (music.src) { try { music.src.stop(); } catch (e) {} music.src = null; } }
  function musicTick() {   // the cat's tune, in step with the story; softer while she's stuck and while the siren wails
    if (!music.buf || !ac) return;
    const from = 0.4;
    if (!music.src && st.t > from && st.t < END - 1) {
      const src = ac.createBufferSource(), gn = ac.createGain();
      src.buffer = music.buf; src.loop = true; gn.gain.value = 0;
      src.connect(gn); gn.connect(master); src.start(0, (st.t - from) % music.buf.duration);
      music.src = src; music.gain = gn;
    }
    const t = st.t, duck = t > 12.6 && t < 20.4 ? 0.4 : t > 29.6 && t < 40 ? 0.45 : t > 55.5 ? 0.6 : 1;
    if (music.gain) music.gain.gain.setTargetAtTime(0.17 * clamp01((t - from) / 1.5) * clamp01((END - 0.4 - t) / 2.5) * duck, ac.currentTime, 0.15);
  }
  const sirenOn = t => t > 29.8 && t < 39.8;

  /* ---------- the shots ---------- */
  const flyPath = t => {   // the butterfly: in to the cat's nose, off toward the tree, up into the branches, away
    if (t < 3.6) { const k = seg(t, 1.6, 3.6); return { x: lerp(110, NAP_X + 7, eout(k)) + Math.sin(t * 5) * 4 * (1 - k), y: lerp(-40, -9, eout(k)) + Math.sin(t * 7) * 5 * (1 - k), rest: false }; }
    if (t < 5.0) return { x: NAP_X + 7, y: t < 4.2 ? -9 : -19, rest: true };
    if (t < 9.6) { const k = seg(t, 5.0, 9.6); return { x: lerp(NAP_X + 7, TX - 16, k) + Math.sin(t * 4) * 6, y: -22 - Math.abs(Math.sin(t * 3)) * 14, rest: false }; }
    if (t < 11.8) { const k = seg(t, 9.6, 11.8); return { x: TX - 22 + Math.sin(t * 4) * 6, y: lerp(-30, BR_Y - 14, k), rest: false }; }
    const k = seg(t, 11.8, 14); return { x: lerp(TX - 22, CAT_X - 60, k) + Math.sin(t * 4) * 5, y: lerp(BR_Y - 14, BR_Y - 70, k), rest: false };
  };
  // the cat's chase: run, pounce, run up the trunk, out along the branch
  function chaseCat(t) {
    if (t < 9.4) {
      const x = lerp(NAP_X, TX - 14, seg(t, 6.6, 9.4));
      const hop = t > 7.1 && t < 7.7 ? Math.sin(seg(t, 7.1, 7.7) * Math.PI) * 12 : t > 8.3 && t < 8.9 ? Math.sin(seg(t, 8.3, 8.9) * Math.PI) * 10 : 0;
      return { mode: t < 6.6 ? 'crouch' : 'run', x, y: 0, hop };
    }
    if (t < 11.2) return { mode: 'climb', x: TX - 5, y: lerp(-9, BR_Y - 6, eio(seg(t, 9.4, 11.2))) };
    return { mode: 'walk', x: lerp(TX - 14, CAT_X, eout(seg(t, 11.2, 12.4))), y: CAT_Y };
  }
  const SHOTS = [
    { a: 0, b: 6.4, sky: 'morning', // 1. a sunny nap in the garden; a butterfly lands on her nose
      cam(t) { setCam(lerp(56, 48, eio(seg(t, 0, 4))), -14, 76, 52); },
      world(t) {
        sun(130, -86, 11);
        garden(t);
        // a warm patch of sunshine on the grass
        alpha(0.25, () => ellipse(NAP_X, 0, 16, 3, '#fff6b0'));
        if (t < 4.2) PETS.catSleep(NAP_X, 0, 1);
        else catSit(NAP_X, 0, { face: t < 4.5 ? undefined : 'up', blink: t < 4.5, swish: t > 4.8, hop: t > 5.6 ? Math.abs(Math.sin((t - 5.6) * 10)) * 1.5 : 0 });
        if (t < 4.2 && Math.floor(T * 1.3) % 2) zs(NAP_X + 6, -12);
        const b = flyPath(t); butterfly(b.x, b.y, b);
        if (t > 3.6 && t < 3.9) sparkle(sx(NAP_X + 7), sy(-10), 6, 1, '#fff6b0');
      },
      words: [[0.6, 'ZZZ', () => [NAP_X + 8, -14]], [4.4, 'MEOW?', () => [NAP_X, -22], false, 'meow2']],
    },
    { a: 6.4, b: 12.6, sky: 'morning', // 2. chase! all the way up the tree
      cam(t) { const c = chaseCat(t), cx = c.mode === 'climb' ? TX - 14 : c.x; setCam(lerp(60, cx, seg(t, 6.4, 8)), Math.min(-22, c.y + 6), 90, 70); },
      world(t) {
        sun(cam.cx + 60, -120, 10);
        garden(t, { wob: t > 11.4 ? Math.sin(T * 9) * 0.6 : 0 });
        const c = chaseCat(t);
        if (c.mode === 'crouch') catSit(c.x, 0, { face: 'up', swish: true });
        else if (c.mode === 'run') PETS.catWalk(c.x, -c.hop, 1, { run: true });
        else if (c.mode === 'climb') catClimb(c.x, c.y, true);
        else PETS.catWalk(c.x, c.y, -1, { walk: t < 12.4 });
        const b = flyPath(t); butterfly(b.x, b.y, b);
      },
      words: [[7.1, 'POUNCE!', () => [chaseCat(7.4).x, -26]], [9.8, 'UP UP!', t => [TX - 22, chaseCat(t).y - 12]]],
    },
    { a: 12.6, b: 20.6, sky: 'day', // 3. stuck! the dogs bark below, and the kid sees her
      cam(t) { const k = eio(seg(t, 15.4, 16.8)); setCam(lerp(CAT_X + 4, 104, k), lerp(CAT_Y - 10, -34, k), lerp(80, 120, k), lerp(64, 84, k)); },
      world(t) {
        sun(cam.cx + 60, -150, 10);
        garden(t, { wob: Math.sin(T * 6) * 1.2 });
        const wob = Math.round(Math.sin(T * 6) * 1.2 * 0.6);
        catSit(CAT_X, CAT_Y + wob, { face: t < 13.8 ? 'up' : 'down', swish: true, meow: t > 12.9 && t < 13.5 || t > 19 && t < 19.6 });
        if (t > 13.9 && t < 15.4) { R(CAT_X - 9, CAT_Y - 15, 1, 2, '#7ad0ff'); R(CAT_X + 9, CAT_Y - 14, 1, 2, '#7ad0ff'); }   // wobbly little sweat drops
        const b = flyPath(t); if (t < 14) butterfly(b.x, b.y, b);
        // the dogs come running and bark up at her
        const dx = lerp(-40, 92, eout(seg(t, 15.6, 16.8)));
        const bark = t > 16.9 && t < 18.4;
        husky(dx - 24, 0, 1, { run: t < 16.8, bark: bark && Math.floor(T * 6) % 2 === 0, hop: bark ? Math.abs(Math.sin(T * 9)) * 3 : 0 });
        vizsla(dx, 0, 1, { run: t < 16.8, bark: bark && Math.floor(T * 6) % 2 === 1, hop: bark ? Math.abs(Math.sin(T * 9 + 1)) * 3 : 0 });
        // the kid runs in, sees the cat, and runs off for help
        let kx = lerp(30, 126, eout(seg(t, 17.2, 18.2))), kdir = 1, kpose = 'wave', walk = t > 17.2 && t < 18.2;
        if (t > 19.4) { kx = lerp(126, -10, seg(t, 19.4, 20.6)); kdir = -1; kpose = 'stand'; walk = true; }
        if (t > 17.2) kid(kx, 0, { dir: kdir, pose: kpose, walk });
      },
      words: [[12.9, 'MEOW!', () => [CAT_X, CAT_Y - 18], true, 'meow'], [14.0, 'UH OH!', () => [CAT_X + 22, CAT_Y - 2], true],
        [16.9, 'WOOF!', () => [92, -18], false, 'woof'], [17.5, 'WOOF!', () => [68, -18], false, 'woof2'], [18.4, 'OH NO!', () => [126, -24], true]],
    },
    { a: 20.6, b: 24.6, sky: 'day', // 4. the kid runs to the fire station: help!
      cam(t) { const tall = H > W * 1.3; setCam(lerp(tall ? 110 : 60, tall ? -10 : 6, eio(seg(t, 20.6, 22.4))), -53, tall ? 110 : 196, 108, true); },
      world(t) {
        cloudRow(0.6, -110); hills(-14, 22, 0.02, 1, '#9ad88a', 0.3);
        stationFront(t > 23.6 ? 1 : 0);
        road();
        // a firefighter by the door turns, listens, and runs in
        const ffx = lerp(-34, -53, seg(t, 23.4, 24.0));
        alpha(t > 24.0 ? Math.max(0, 1 - (t - 24.0) / 0.3) : 1, () => person('ff', ffx, 0, { dir: t > 22.4 && t < 23.4 ? 1 : -1, pose: t > 22.9 && t < 23.4 ? 'wave' : 'stand', walk: t > 23.4, skin: FF1, seed: 1 }));
        const kx = lerp(200, -4, seg(t, 20.6, 22.4)), jump = t > 22.4 && t < 23.6 ? Math.abs(Math.sin((t - 22.4) * 8)) * 4 : 0;
        kid(kx, 0, { dir: -1, pose: t > 22.4 ? 'cheer' : 'stand', walk: t < 22.4, hop: jump });
      },
      words: [[22.5, 'HELP!', () => [-4, -24], true], [23.6, 'DING DING!', () => [40, -110], true, 'bell']],
    },
    { a: 24.6, b: 32.6, sky: 'indoor', // 5. the alarm rings: slide down the pole, hop in, roll out!
      cam(t) {
        if (H > W * 1.3) {   // an upright phone: follow the action up close
          const tx = cutTruck(t), cx = t < 26.8 ? lerp(-34, -48, seg(t, 25.4, 26.6)) : t < 29.4 ? lerp(-48, -10, eio(seg(t, 26.8, 28.4))) : lerp(-10, tx + 40, eio(seg(t, 29.4, 31)));
          setCam(cx, -53, 110, 108, true);
        } else setCam(lerp(0, 40, eio(seg(t, 30.0, 32.6))), -53, 196, 108, true);
      },
      world(t) {
        hills(-10, 20, 0.02, 4, '#9ad88a', 0.3);
        fill(0, '#6cbf5a'); R(ST.x1, -3, vis().x1 - ST.x1, 3, '#57505f');
        const alarm = t > 24.8 && t < 30.4;
        stationCut(alarm, eio(seg(t, 28.6, 29.6)));
        let inCab = 0;
        const crew = [0, 1].map(who => { const p = crewPath(who, t, CREW[who]); if (!p) inCab++; return p; });
        const tx = cutTruck(t);
        fireTruck(tx, -2, t > 28.4, { crew: inCab, rot: tx / 6 });
        // the wall above the door, so the truck rolls out through it
        R(ST.door, ST.roof - 2, ST.x1 - ST.door, ST.floor + 4 - ST.roof + 2, BRICK);
        crew.forEach((p, who) => {
          if (!p) return;
          const d = () => person('ff', p.x, p.yb, { pose: p.pose, dir: p.dir, walk: p.walk, hop: p.hop || 0, skin: who ? FF2 : FF1, seed: who * 2 });
          p.fade != null ? alpha(p.fade, d) : d();
        });
        if (t > 29.8 && Math.random() < 0.4) parts.push({ x: sx(tx), y: sy(-6), vx: -14, vy: -12, g: 0, life: 0.6, max: 0.6, s: 2, c: '#c9ccd3' });
      },
      lit(t) { alarmLights(t > 24.8 && t < 30.4); },
      words: [[25.0, 'DING DING!', () => [40, -112], true, 'bell'], [26.4, 'WHEE!', () => [ST.pole + 12, -30], true], [30.0, 'WEE-OO!', () => [60, -50], true]],
    },
    { a: 32.6, b: 38.6, sky: 'day', // 6. lights and siren, through town
      cam(t) { setCam(drive(t) + 40, -24, 160, 100); },
      world(t) {
        sun(cam.cx + 70, -90, 10); cloudRow(0.7, -80); hills(-10, 26, 0.02, 4, '#9ad88a', 0.6); town(0.35); birds(3, -70);
        road();
        // cars pull over to let the fire truck by
        for (const [cx0, col] of [[150, COLOR.blue.c], [330, COLOR.yellow.c]]) drawCar(cx0, 3, col);
        const x = drive(t);
        fireTruck(x, 0, true, { crew: 2, rot: x / 6 });
        if (Math.random() < 0.4) parts.push({ x: sx(x), y: sy(-4), vx: -20, vy: -10, g: 0, life: 0.5, max: 0.5, s: 2, c: '#c9ccd3' });
      },
      words: [[33.2, 'WEE-OO!', () => [drive(33.2) + 50, -40], true], [36.0, 'HONK HONK!', () => [drive(36) + 50, -40], true, 'honk']],
    },
    { a: 38.6, b: 44.6, sky: 'day', // 7. at the tree: up goes the big ladder
      cam(t) {
        const tx = truckIn(t), k = eio(seg(t, 40.4, 44.0)), l = ladderAt(t), tipY = PIV.y - Math.sin(l.ang) * l.len;
        setCam(lerp(tx + 50, 70, k), lerp(-30, Math.min(-30, tipY + 34), k), lerp(130, 170, k), lerp(80, 104, k));
      },
      world(t) {
        sun(cam.cx + 60, -170, 10);
        garden(t, { wob: Math.sin(T * 6) * 1.2 });
        const wob = Math.round(Math.sin(T * 6) * 0.7);
        catSit(CAT_X, CAT_Y + wob, { face: t > 41 ? 'down' : 'down', swish: true, meow: t > 39.9 && t < 40.5 });
        vizsla(112, 0, -1, { hop: t > 42.4 && t < 43.4 ? Math.abs(Math.sin(T * 9)) * 3 : 0 }); husky(136, 0, -1, { pant: true });
        kid(92, 0, { dir: -1, pose: t > 40 ? 'cheer' : 'stand', hop: t > 40 && t < 41 ? Math.abs(Math.sin(T * 8)) * 3 : 0 });
        const tx = truckIn(t);
        fireTruck(tx, 0, t < 41.5, { ladder: ladderAt(t), crew: t < 40.4 ? 2 : 1, rot: tx / 6 });
        // the climber hops out and onto the back of the truck
        if (t > 40.4) { const k = seg(t, 40.4, 41.0); person('ff', lerp(tx + 54, PIV.x + 2, k), lerp(0, PIV.y, k) - Math.sin(k * Math.PI) * 10, { dir: -1 + 2 * (k >= 1), pose: 'wave', skin: FF2, seed: 2 }); }
        if (t > 40.6) person('ff', -14, 0, { dir: 1, pose: 'stand', skin: FF1, seed: 1 });
      },
      words: [[39.9, 'MEOW!', () => [CAT_X, CAT_Y - 18], false, 'meow'], [41.2, 'UP UP UP!', () => [PIV.x + 40, -60], true]],
    },
    { a: 44.6, b: 55, sky: 'day', // 8. the climb, the cuddle, the careful trip down... hooray!
      cam(t) {
        const p = climber(t), k = eio(seg(t, 51.0, 52.2));
        setCam(lerp(p.x + 4, 84, k), lerp(p.yb - 12, -24, k), lerp(96, 120, k), lerp(80, 90, k));
      },
      world(t) {
        sun(cam.cx + 60, -170, 10);
        garden(t, { wob: t < 48.2 ? Math.sin(T * 6) * 1.2 : 0 });
        const cheer = t > 52.2;
        if (t < 48.0) catSit(CAT_X, CAT_Y + Math.round(Math.sin(T * 6) * 0.7), { face: t > 47.2 ? 'up' : 'down', swish: true, hop: t > 47.6 ? Math.sin(seg(t, 47.6, 48.0) * Math.PI) * 6 : 0 });
        vizsla(112, 0, -1, { hop: cheer ? Math.abs(Math.sin(T * 9)) * 4 : 0, bark: cheer && Math.floor(T * 5) % 2 === 0 }); husky(136, 0, -1, { pant: !cheer, hop: cheer ? Math.abs(Math.sin(T * 9 + 1)) * 4 : 0 });
        kid(98, 0, { dir: -1, pose: cheer ? 'cheer' : 'wave', hop: cheer ? Math.abs(Math.sin(T * 8)) * 3 : 0 });
        fireTruck(TRUCK_X, 0, false, { ladder: { ang: ANG, len: LEN } });
        person('ff', -14, 0, { dir: 1, pose: cheer ? 'cheer' : 'stand', skin: FF1, seed: 1, hop: cheer ? Math.abs(Math.sin(T * 8 + 2)) * 3 : 0 });
        const p = climber(t);
        person('ff', p.x, p.yb, { dir: p.dir, pose: p.pose, walk: p.walk, hop: p.hop || 0, skin: FF2, seed: 2 });
        if (p.cat) heldCat(p, t > 53.2 && t < 54.0 ? 'lick' : t > 52.2 ? 'happy' : undefined);
        hearts(p.x, p.yb - 26, 48.0, t); hearts(p.x + 4, p.yb - 26, 53.2, t, 4);
      },
      words: [[47.7, 'MEOW!', () => [climber(47.7).x + 8, climber(47.7).yb - 24], true, 'meow'], [52.3, 'HOORAY!', () => [56, -36], true],
        [53.3, 'LICK!', () => [96, -26], false], [54.1, 'PURR', () => [70, -28], false, 'purr']],
    },
    { a: 55, b: END, sky: 'dusk', // 9. a nap on the fire truck... and a wink
      cam(t) { const k = eio(seg(t, 55.4, 59.4)); setCam(lerp(50, NAP2.x, k), lerp(-28, NAP2.y - 12, k), lerp(120, 70, k), lerp(90, 44, k)); },
      world(t) {
        sun(cam.cx + 50, -46 + (t - 55) * 2, 11);
        garden(t);
        vizslaLie(112); PETS.huskyLie(138, 0, -1, { sleep: true });
        kid(94, 0, { dir: -1, pose: 'wave' });
        person('ff', -14, 0, { dir: 1, pose: 'wave', skin: FF1, seed: 1 });
        person('ff', 76, 0, { dir: -1, pose: 'stand', skin: FF2, seed: 2 });
        fireTruck(TRUCK_X, 0, false);
        if (t < 59.0) { PETS.catSleep(NAP2.x, NAP2.y, 1); if (Math.floor(T * 1.3) % 2) zs(NAP2.x + 6, NAP2.y - 9); }
        else catSit(NAP2.x, NAP2.y, { face: t > 59.9 && t < 61.2 ? 'wink' : t < 59.3 ? undefined : 'happy', blink: t < 59.3, swish: true });
        if (t > 59.9 && t < 60.2) sparkle(sx(NAP2.x + 3), sy(NAP2.y - 13), 4, 2, '#ffffff');
      },
      words: [[56.2, 'ZZZ', () => [NAP2.x + 6, NAP2.y - 10]]],
      iris: () => [sx(NAP2.x), sy(NAP2.y - 8)],
    },
  ];
  const NAP2 = { x: TRUCK_X + 24, y: -34 };
  function vizslaLie(x) { PETS.vizslaLie(x, 0, -1, { sleep: true }); }
  function cutTruck(t) { return -45 + Math.max(0, t - 29.8) ** 2 * 30; }
  function drive(t) { return lerp(0, 380, seg(t, 32.6, 38.6)); }
  function truckIn(t) { return lerp(-150, TRUCK_X, eout(seg(t, 38.6, 40.0))); }
  // extra sounds not tied to a word: [time, key, rate, vol]
  const CUES = [[2.0, 'twinkle'], [19.0, 'meow2', 1, 0.7], [7.1, 'swish'], [8.3, 'swish', 1.2], [9.5, 'swish', 0.9], [24.9, 'bell', 0.9], [26.4, 'pop'], [27.2, 'pop'], [28.6, 'door'],
    [39.6, 'brake'], [40.6, 'creak', 0.9], [40.8, 'ratchet'], [41.3, 'ratchet', 1.1], [41.8, 'ratchet'], [42.3, 'creak', 1.1], [42.6, 'ratchet', 1.1], [43.0, 'ratchet'], [43.4, 'ratchet', 1.2],
    [45.0, 'ratchet', 1.3, 0.5], [45.8, 'ratchet', 1.4, 0.5], [46.6, 'ratchet', 1.5, 0.5], [48.0, 'twinkle'], [49.4, 'ratchet', 1.3, 0.5], [50.4, 'ratchet', 1.2, 0.5], [51.8, 'pop'], [60.0, 'chime']];
  function cue(k, rate = 1, vol = 1) {
    if (k === 'pop') SFX.pop(); else if (k === 'door') SFX.door(); else if (k === 'brake') SFX.brake(); else SND.play(k, rate, vol);
  }

  /* ---------- scene plumbing (with pause and a draggable timeline) ---------- */
  const st = { t: 0, done: false, fired: {}, paused: false, ui: 0, drag: null, saved: null };
  const shotAt = t => { for (let i = 0; i < SHOTS.length; i++) if (t < SHOTS[i].b) return SHOTS[i]; return SHOTS[SHOTS.length - 1]; };
  function camNow() { const s = shotAt(st.t); s.cam.call(s, st.t); return s; }
  function seek(t) { stopMusic(); siren(0); st.t = Math.max(0, Math.min(END - 0.05, t)); st.fired = {}; parts = []; camNow(); }
  function ctl() {
    const b = 26, cy = H - L.safeB - 30, cx = Math.round(W / 2), half = Math.round(Math.min(W - L.safeL - L.safeR - 32, 360) / 2);
    return { play: { x: cx - b / 2, y: cy - b / 2, s: b }, track: { x0: cx - half, x1: cx + half, y: cy - b / 2 - 14 } };
  }
  const tAtX = (c, x) => END * clamp01((x - c.track.x0) / (c.track.x1 - c.track.x0));
  function drawControls() {
    const c = ctl(), k = Math.min(1, st.paused ? 1 : st.ui / 0.3);
    if (k <= 0) return;
    alpha(k, () => {
      const { x0, x1, y } = c.track, w = x1 - x0;
      alpha(0.45, () => R(x0 - 6, y - 8, w + 12, 16, BLACK));
      R(x0, y - 1, w, 3, '#6a6478');
      for (const s of SHOTS) R(Math.round(x0 + w * s.a / END), y - 3, 1, 7, '#cfc8dc');
      const kx = Math.round(x0 + w * Math.min(1, st.t / END));
      R(x0, y - 1, kx - x0, 3, '#ffd21f'); circle(kx, y, 5, '#ffffff'); circle(kx, y, 3, '#ffd21f');
      const b = c.play, mx = b.x + b.s / 2, my = b.y + b.s / 2;
      alpha(0.55, () => R(b.x, b.y, b.s, b.s, BLACK));
      if (st.paused) for (let i = 0; i < 6; i++) R(mx - 3 + i, my - 6 + i, 1, 13 - 2 * i, '#ffffff');
      else { R(mx - 5, my - 6, 4, 13, '#ffffff'); R(mx + 1, my - 6, 4, 13, '#ffffff'); }
    });
  }
  function iris(k, cx, cy) {
    if (k >= 1) return;
    const rad = eio(clamp01(k)) * Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - cy;
      if (Math.abs(dy) >= rad) { R(0, y, W, 1, BLACK); continue; }
      const dx = Math.sqrt(rad * rad - dy * dy);
      if (cx - dx > 0) R(0, y, cx - dx, 1, BLACK);
      if (cx + dx < W) R(cx + dx, y, W - cx - dx, 1, BLACK);
    }
  }
  function homeBtn() { const s = 24; return { x: L.safeL + 8, y: H - L.safeB - s - 12, s }; }
  function finish() { if (st.done) return; st.done = true; siren(0); goScene(SCENES.movies ? 'movies' : 'station', { watched: 'cat' }); }

  SCENES.movieCat = {
    noWeather: true,
    view: [186, 200],
    freeTouch: true,
    modal: () => true,   // taps go to the film (no day/night toggling from the sky)
    // the cinema card: the cat on her branch, the ladder reaching up
    cover(x, yb) {
      const ox = x - 13, y0 = yb - 44, P = (dx, dy, w, h, c) => R(ox + dx, y0 + dy, w, h, c);
      circle(ox + 62, y0 + 14, 10, '#3f9a45'); circle(ox + 53, y0 + 17, 6, '#3f9a45'); circle(ox + 68, y0 + 20, 6, '#3f9a45'); circle(ox + 60, y0 + 10, 5, '#5bb85a');
      P(58, 14, 7, 32, '#7a4a2a'); P(58, 14, 2, 32, '#8e5a34');
      P(34, 25, 25, 3, '#7a4a2a'); circle(ox + 34, y0 + 24, 2, '#3f9a45');
      PETS.catSit(ox + 43, y0 + 25, { swish: true });
      // the ladder reaching up to her
      g.save(); g.translate(ox, y0);
      for (let k = 0; k < 6; k++) { const u = (k + 0.5) / 6; TOY.bar(3 + 27 * u, 42 - 16 * u, 6 + 27 * u, 46 - 16 * u, 1, '#cfd6dd'); }
      TOY.bar(3, 42, 30, 26, 2, '#f4f7fb'); TOY.bar(6, 46, 33, 30, 2, '#9aa3ad'); P(29, 25, 3, 2, '#e8222b');
      g.restore();
      butterfly(ox + 22, y0 + 10, {});
    },
    layout() {},
    enter() { Object.assign(st, { t: 0, done: false, fired: {}, paused: false, ui: 0, drag: null }); if (!st.saved) st.saved = clouds; clouds = []; loadMusic(); },
    leave() { stopMusic(); siren(0); if (st.saved) { clouds = st.saved; st.saved = null; } },
    update(dt) {
      if (st.done) return;
      st.ui = Math.max(0, st.ui - dt);
      if (st.paused || st.drag != null) { stopMusic(); siren(0); camNow(); return; }
      st.t += dt;
      camNow();
      musicTick();
      siren(sirenOn(st.t) ? clamp01((st.t - 29.8) / 0.4) * clamp01((39.8 - st.t) / 0.6) * (st.t < 32.6 ? 0.7 : 1) : 0);
      for (const sh of SHOTS) (sh.words || []).forEach(([wt, w, , , snd], i) => { const key = sh.a + ':' + i; if (st.t >= wt && st.t < wt + 0.3 && !st.fired[key]) { st.fired[key] = true; playWord(w, snd); } });
      CUES.forEach(([ct, k, rate, vol], i) => { if (st.t >= ct && st.t < ct + 0.3 && !st.fired['c' + i]) { st.fired['c' + i] = true; cue(k, rate, vol); } });
      if (st.t > 52.2 && st.t < 55 && Math.random() < dt * 4) confetti(4);
      if (st.t >= END - 0.06) finish();
    },
    groundY() { return Math.round(H * 0.6); },
    drawWorld() {
      const s = shotAt(st.t);
      drawSky(s.sky);
      g.setTransform(cam.z, 0, 0, cam.z, cam.ox, cam.oy);
      s.world.call(s, st.t);
      g.setTransform(1, 0, 0, 1, 0, 0);
    },
    drawLit() {
      const s = shotAt(st.t);
      if (s.lit) { g.setTransform(cam.z, 0, 0, cam.z, cam.ox, cam.oy); s.lit.call(s, st.t); g.setTransform(1, 0, 0, 1, 0, 0); }
      drawParticles();
    },
    drawUI() {
      const s = shotAt(st.t);
      for (const w of s.words || []) { const [wt, str, at, big] = w, age = st.t - wt; if (age >= 0 && age <= 1.7) { const [wx, wy] = at(st.t); bubble(str, sx(wx), sy(wy), age, big); } }
      const [ix, iy] = s.iris && st.t > END - 2 ? s.iris() : [W / 2, H * 0.45];
      iris(Math.min(1, st.t / 0.5, (END - st.t) / 1.4), ix, iy);
      const bx = L.safeL + 8, bw = W - L.safeL - L.safeR - 16, by = H - L.safeB - 5;
      alpha(0.35, () => R(bx, by, bw, 2, BLACK));
      alpha(0.85, () => R(bx, by, Math.round(bw * clamp01(st.t / END)), 2, '#fff6e0'));
      drawControls();
      drawHomeButton(homeBtn());
    },
    tap(x, y, id) {
      if (inBox(homeBtn(), x, y)) { SFX.boop(); finish(); return true; }
      const c = ctl();
      if (st.paused || st.ui > 0) {
        st.ui = 3.5;
        if (inBox(c.play, x, y, 6)) { st.paused = !st.paused; return true; }
        if (x >= c.track.x0 - 10 && x <= c.track.x1 + 10 && Math.abs(y - c.track.y) <= 14) { st.drag = id; seek(tAtX(c, x)); return true; }
      }
      st.ui = 3.5;
      sparkle(x, y, 4, 3, '#ffffff');
      return true;
    },
    move(x, y, id) { if (st.drag === id) { st.ui = 3.5; seek(tAtX(ctl(), x)); } },
    release(id) { if (st.drag === id) { st.drag = null; st.ui = 3.5; } },
    _st: st, _jump(t) { seek(t); },
  };
})();
