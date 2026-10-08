// Cinema: "Sprinkles and the Ice Cream Mountain", a one-minute watch-only cartoon.
// Sprinkles the ice cream truck wakes up with the sun and drives through town handing out
// ice cream: to kids at the park (one drops a scoop and gets a giant new one!), and to the
// firefighters and the family's dogs and cat at the fire station. Then the freezer is empty...
// until a rainbow points the way to the Giant Ice Cream Mountain, through candy hills and over a
// chocolate river. Sprinkles fills right up, everyone comes along, and there's a big party.
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
  const SCOOP = { pink: ['#ff8fb8', '#e8608f'], van: ['#fff6e0', '#e8dcc0'], choc: ['#8a5230', '#6a3a1e'], mint: ['#9ef0c8', '#6ad4a4'], blue: ['#7ad0ff', '#4aa8e8'], lem: ['#fff27a', '#e8d040'] };

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
    dawn: ['#f6a88a', '#f8bc94', '#fad0a0', '#fce0ae', '#fdeac0'],
    day: ['#8ec8ec', '#a2d2ee', '#b8dcee', '#cce6ea', '#dcece2'],
    candy: ['#f2b8e0', '#f4c6e6', '#f6d4ec', '#f0e0f2', '#e8ecf6'],
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

  /* ---------- the cast ---------- */
  // Sprinkles, the ice cream truck: 74 long, facing right, wheels on (x .. x + 74, yb)
  function truck(x, yb, o = {}) {
    x = Math.round(x); yb = Math.round(yb - (o.bounce || 0));
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy, w, h, c);
    P(0, -10, 72, 3, '#3a3d46');
    P(2, -40, 46, 30, '#fff6ea'); P(4, -42, 42, 2, '#fff6ea'); P(2, -16, 46, 3, '#ff8fb8'); P(2, -13, 46, 1, '#7ad8c0'); P(2, -12, 46, 2, '#ff8fb8');
    for (let i = 0; i < 9; i++) P(4 + i * 5, -19 - (i % 2) * 2, 2, 1, ['#e8222b', '#2a6fe0', '#3fb43a', '#ffd21f', '#ff6fb4'][i % 5]);
    // the menu board
    P(5, -36, 12, 15, '#5a3a2a'); P(6, -35, 10, 13, '#fff2d8');
    for (let i = 0; i < 4; i++) { const c = Object.values(SCOOP)[i]; P(7 + (i % 2) * 5, -33 + Math.floor(i / 2) * 6, 3, 3, c[0]); P(8 + (i % 2) * 5, -30 + Math.floor(i / 2) * 6, 1, 2, '#d9a35a'); }
    // the serving window, the vendor and the awning
    P(20, -36, 20, 14, '#6a4a5a'); P(21, -35, 18, 12, '#8a6a7a');
    g.save(); g.beginPath(); g.rect(x + 21, yb - 35, 18, 12); g.clip();
    if (o.empty) { P(23, -27, 14, 4, '#cfd6dd'); for (let i = 0; i < 3; i++) P(24 + i * 5, -29, 3, 2, '#ffffff'); }
    drawPerson({ type: 'chef', x: x + 30, yb: yb - 17, dir: 1, pose: o.wave ? 'wave' : 'stand', skin: SKIN[1], seed: 2 });
    g.restore();
    P(19, -23, 22, 2, '#cfd6dd'); P(19, -22, 22, 1, '#ffffff');
    for (let i = 0; i < 6; i++) { P(19 + i * 4, -41, 4, 5, i % 2 ? '#ffffff' : '#e8222b'); circle(x + 21 + i * 4, yb - 36, 2, i % 2 ? '#ffffff' : '#e8222b'); }
    // the cab, with Sprinkles' big friendly eye on the windscreen
    P(48, -30, 20, 20, '#ff8fb8'); P(49, -33, 14, 3, '#ff8fb8'); P(48, -30, 20, 1, '#ffb0cc');
    P(50, -29, 13, 9, '#4a4f5c'); P(51, -28, 11, 7, GLASS);
    eye(x + 57, yb - 25, o.mood || 'happy');
    P(66, -22, 7, 12, '#ff8fb8'); P(70, -20, 3, 3, '#fff6b0'); P(65, -10, 9, 2, '#cfd6dd');
    P(61, -15, 6, 1, '#c84a7a'); P(60, -16, 1, 1, '#c84a7a'); P(67, -16, 1, 1, '#c84a7a');   // a smile
    // the big cone on the roof, bobbing, and the loudspeaker
    const bob = Math.round(Math.sin(T * 3));
    for (let k = 0; k < 8; k++) P(26 + (k >> 1), -50 + k + bob, 9 - (k >> 1) * 2, 1, k % 2 ? '#b07a34' : '#d9a35a');
    circle(x + 30, yb - 53 + bob, 4, '#ff8fb8'); circle(x + 30, yb - 59 + bob, 3, '#fff6e0'); P(29, -64 + bob, 2, 2, '#e8222b');
    P(40, -46, 2, 4, '#9aa3ad'); P(39, -48, 5, 2, '#cfd6dd');
    for (const wx of [14, 58]) { circle(x + wx, yb - 6, 6, '#2f3240'); circle(x + wx, yb - 6, 3, '#cfd6dd'); const a = o.spin || 0; R(x + wx + Math.round(Math.cos(a) * 3), yb - 6 + Math.round(Math.sin(a) * 3), 1, 1, '#2f3240'); }
  }
  function eye(cx, cy, mood) {
    if (mood === 'sleep') { R(cx - 4, cy, 9, 1, INK); R(cx - 3, cy + 1, 7, 1, INK); return; }
    if (mood === 'wink') { R(cx - 4, cy, 9, 1, INK); R(cx - 4, cy - 1, 1, 1, INK); R(cx + 4, cy - 1, 1, 1, INK); return; }
    const r = mood === 'wow' ? 5 : 4;
    circle(cx, cy, r, '#ffffff');
    const look = mood === 'up' ? -2 : 0;
    R(cx, cy - 1 + look, 2, 3, INK); R(cx + 1, cy - 1 + look, 1, 1, '#ffffff');
    if (mood === 'happy') R(cx - 4, cy - 5, 9, 1, INK);
    if (mood === 'worry') { R(cx - 4, cy - 5, 4, 1, INK); R(cx, cy - 6, 5, 1, INK); }
  }
  // an ice cream cone with a stack of scoops (bottom first), bottom tip at (x, yb), k times bigger
  function cone(x, yb, scoops, k = 1) {
    g.save(); g.translate(Math.round(x), Math.round(yb)); g.scale(k, k);
    for (let r = 0; r < 7; r++) R(-3 + (r >> 1) - 0 + 0, -7 + r, 7 - (r >> 1) * 2, 1, r % 2 ? '#b07a34' : '#d9a35a');
    scoops.forEach((s, i) => { const c = SCOOP[s]; circle(0, -10 - i * 5, 3, c[0]); R(-3, -9 - i * 5, 7, 2, c[0]); R(-2, -7 - i * 5, 1, 1, c[1]); R(1, -7 - i * 5, 1, 1, c[1]); R(-1, -12 - i * 5, 1, 1, '#ffffff'); });
    if (scoops.length > 2) { R(0, -13 - scoops.length * 5, 2, 2, '#e8222b'); R(1, -14 - scoops.length * 5, 1, 1, '#3a8a2e'); }
    g.restore();
  }
  function pupCup(x, yb) { R(x - 3, yb - 4, 7, 4, '#ffd21f'); R(x - 3, yb - 6, 7, 2, '#f6ead0'); R(x - 2, yb - 7, 5, 1, '#f6ead0'); R(x - 3, yb - 4, 7, 1, '#e8b010'); }
  function kid(type, x, yb, dir, pose, skin, seed, extra = {}) {
    drawPerson({ type, x, yb, dir, pose, skin, seed, walk: extra.walk, hop: extra.hop || 0 });
    if (extra.cone) { const o = OUTFITS[type], ph = Math.floor(T * 5 + seed) % 2; cone(x + dir * (ph ? 2 : 5), yb - (o && o.child ? 7 : 9) - (ph ? 3 : 0), extra.cone, 1); }
    if (extra.tear) { const ty = yb - 15 + ((T * 20) % 6); R(x + dir * 3, ty, 1, 2, '#7ad0ff'); }
  }
  const D = () => SCENES.icecream && SCENES.icecream._dogs;
  function dogs(x, yb, dir, o = {}) { const d = D(); if (!d) return; d.husky(x - dir * 22, yb - 1, dir, { run: o.run, wag: true, pant: !o.bark, bark: o.bark && Math.floor(T * 6) % 2 === 0, hop: o.hop || 0, lick: o.lick }); d.vizsla(x, yb, dir, { run: o.run, wag: true, bark: o.bark && Math.floor(T * 6) % 2 === 1, hop: o.hop || 0, lick: o.lick }); }
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
  function lolly(x, base, h, c) { R(x, base - h, 1, h, '#ffffff'); circle(x, base - h - 4, 5, c); circle(x, base - h - 4, 3, '#ffffff'); circle(x, base - h - 4, 1, c); }
  function gumdrop(x, base, c) { ellipse(x, base - 3, 5, 4, c); R(x - 5, base - 1, 11, 1, c); R(x - 2, base - 5, 2, 1, '#ffffff'); }
  function rainbow(cx, cy, r, k = 1) {
    const cols = ['#e8222b', '#f57a12', '#ffd21f', '#3fb43a', '#2a6fe0', '#8a4fd9'];
    for (let a = 0; a <= Math.PI * k; a += 0.012) for (let i = 0; i < cols.length; i++) { const rr = r - i * 3; R(cx - Math.cos(a) * rr, cy - Math.sin(a) * rr, 3, 3, cols[i]); }
  }
  function sprinkleSnow(n = 40) {   // rainbow sprinkles falling like snow
    const v = vis();
    for (let i = 0; i < n; i++) {
      const x = v.x0 + ((i * 53.7 + Math.sin(T + i) * 8) % (v.x1 - v.x0)), y = v.y0 + ((i * 31.3 + T * (14 + (i % 4) * 5)) % (v.y1 - v.y0));
      R(x, y, i % 2 ? 2 : 1, i % 2 ? 1 : 2, ['#e8222b', '#2a6fe0', '#3fb43a', '#ffd21f', '#ff6fb4', '#ffffff'][i % 6]);
    }
  }
  function heart(cx, cy, r, c) { circle(cx - r / 2, cy - r / 3, r / 2 + 0.5, c); circle(cx + r / 2, cy - r / 3, r / 2 + 0.5, c); for (let k = 0; k <= r; k++) R(cx - r + k, cy - r / 3 + k, 2 * (r - k) + 1, 1, c); }

  /* ---------- the Giant Ice Cream Mountain (base at y = 0, centered on x = 0) ---------- */
  function mountain(k = 1) {   // k < 1 draws it smaller, as if seen from far away (still whole pixels)
    const q = v => Math.round(v * k);
    // the waffle cone, its tip buried in the ground
    for (let y = -q(150); y < 0; y++) {
      const hw = Math.round(q(30) + (-y) * 0.62);
      R(-hw, y, hw * 2, 1, '#dcaa62');
      const cell = Math.max(4, q(12));
      for (let x = -hw; x < hw; x++) if ((x + y + 400 * cell) % cell === 0 || (x - y + 400 * cell) % cell === 0) R(x, y, 1, 1, '#b07a34');
      R(hw - q(6), y, q(6), 1, '#c4904a');
    }
    R(-q(126), -q(152), q(252), Math.max(2, q(6)), '#eec07a'); R(-q(126), -q(152), q(252), 1, '#f8dca0');
    // three giant scoops, dripping down
    const scoops = [[-151, 92, SCOOP.pink], [-260, 76, SCOOP.van], [-352, 58, SCOOP.choc]];
    for (const [cy0, r0, c] of scoops) {
      const cy = q(cy0), r = q(r0);
      ellipse(Math.max(1, q(4)), cy + Math.max(1, q(4)), r, r * 0.72, c[1]); ellipse(0, cy, r, r * 0.72, c[0]);
      const step = Math.max(5, q(14));
      for (let i = -r + q(8); i < r - q(8); i += step) { const d = q(10 + hsh(i + cy0) * 16) + Math.round(Math.sin(T * 1.5 + i) * 2 * k); R(i, cy + r * 0.6, Math.max(2, q(7)), d, c[0]); circle(i + q(3), cy + r * 0.6 + d, Math.max(1, q(3)), c[0]); }
      ellipse(-r * 0.4, cy - r * 0.35, r * 0.25, r * 0.12, '#ffffff');
      for (let i = 0; i < r * 0.7; i++) { const a = hsh(i + cy0) * Math.PI * 2, rr = hsh(i * 3 + cy0) * r * 0.85; R(Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.65, k < 0.6 ? 1 : 3, 1, ['#e8222b', '#2a6fe0', '#3fb43a', '#ffd21f', '#ffffff'][i % 5]); }
    }
    // a cherry the size of a house, with a sparkle
    circle(0, -q(420), q(22), '#e8222b'); circle(-q(7), -q(428), q(7), '#ff6a6a'); R(-q(1), -q(470), Math.max(1, q(3)), q(28), '#3a8a2e'); R(q(2), -q(472), q(12), Math.max(1, q(3)), '#3a8a2e');
    if (Math.floor(T * 3) % 2) { R(q(16), -q(440), 1, 7, '#ffffff'); R(q(16) - 3, -q(440) + 3, 7, 1, '#ffffff'); }
    // a soft-serve waterfall pouring down one side
    for (let y = -q(200); y < -q(4); y += 2) { const w = Math.max(3, q(10)) + Math.round(Math.sin(y * 0.1 + T * 8) * 2 * k); R(-q(110) - w / 2 + Math.sin(y * 0.05) * 6 * k, y, w, 2, y % 6 ? '#fff6e0' : '#f2e8d0'); }
    ellipse(-q(110), -2, q(20), Math.max(2, q(5)), '#fff6e0');
  }

  /* ---------- word bubbles ---------- */
  const WORD_C = { 'DING DING!': '#c99a10', 'TOOT TOOT!': '#e8222b', 'YAY!': '#ff6fb4', 'PLOP!': '#8a5230', 'UH OH!': '#2a6fe0', 'WOOF!': '#8a3a1a', 'MEOW!': '#55514a', 'YUM!': '#e8222b', 'WOW!': '#d07010', 'HOORAY!': '#3fb43a', '?': '#2a6fe0', 'Zzz': '#5a5a8a' };
  function bubble(word, ax, ay, age, big = false) {
    if (age < 0 || age > 1.7) return;
    const s = Math.max(1, Math.min(4, Math.round(Math.min(W, H) / (big ? 70 : 95))));
    const tw = textWidth(word, s), bw = tw + 6 * s, bh = 11 * s;
    const pop = age < 0.18 ? eout(age / 0.18) : 1, fade = age > 1.45 ? 1 - (age - 1.45) / 0.25 : 1;
    let bx = Math.round(ax - bw / 2), by = Math.round(ay - bh - 6 * s - (1 - pop) * 6);
    bx = Math.max(L.safeL + 4, Math.min(W - L.safeR - bw - 4, bx)); by = Math.max(L.safeT + 4, Math.min(H - L.safeB - bh - 40, by));
    alpha(Math.max(0, fade), () => {
      R(bx + 2, by + 2, bw, bh, 'rgba(0,0,0,0.18)');
      R(bx - 1, by + 1, bw + 2, bh - 2, INK); R(bx + 1, by - 1, bw - 2, bh + 2, INK);
      R(bx, by + 1, bw, bh - 2, '#ffffff'); R(bx + 1, by, bw - 2, bh, '#ffffff');
      const tx = Math.max(bx + 4, Math.min(bx + bw - 8, Math.round(ax))), ty = by + bh;
      for (let k = 0; k < 4; k++) { R(tx - (3 - k) - 1, ty + k - 1, Math.max(1, 2 * (3 - k)) + 2, 1, INK); if (k < 3) R(tx - (3 - k), ty + k - 1, 2 * (3 - k), 1, '#ffffff'); }
      text(word, bx + 3 * s, by + 3 * s, s, WORD_C[word] || INK);
    });
  }

  /* ---------- sounds ---------- */
  const SND = TOY.bank({
    'DING DING!': ['ic-bell', 0.55], 'TOOT TOOT!': ['bt-honk', 0.6], 'PLOP!': ['mv-plop', 0.7], 'YUM!': ['ic-yum', 0.6], 'WOOF!': ['dog-bark', 0.7],
    'MEOW!': ['cat-meow', 0.6], 'WOW!': ['mv-chime', 0.5], pop: ['ic-pop', 0.55],
  }, {
    'DING DING!'() { tone('sine', 1568, 0, 0.5, 0.08); tone('sine', 1568, 0.25, 0.5, 0.08); }, 'TOOT TOOT!'() { SFX.honk(); },
    'PLOP!'() { noise(0, 0.2, 0.15, 400, 1); }, 'YUM!'() { [523, 659, 784].forEach((f, i) => tone('sine', f, i * 0.09, 0.2, 0.07)); },
    'WOOF!'() { SFX.woof(); }, 'MEOW!'() { SFX.meow(); }, 'WOW!'() { [659, 784, 988, 1319].forEach((f, i) => tone('sine', f, i * 0.07, 0.25, 0.06)); },
    pop() { tone('sine', 500, 0, 0.08, 0.1, 900); },
  });
  const SYNTH_ONLY = {
    'YAY!'() { [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, i * 0.07, 0.2, 0.07)); },
    'HOORAY!'() { SFX.fanfare(); }, 'UH OH!'() { tone('sine', 523, 0, 0.25, 0.1); tone('sine', 392, 0.28, 0.4, 0.1); },
    '?'() { tone('sine', 600, 0, 0.18, 0.06, 900); }, 'Zzz'() { tone('sine', 220, 0, 0.6, 0.04, 180); },
  };
  function playWord(w) { if (SYNTH_ONLY[w]) SYNTH_ONLY[w](); else SND.play(w); }
  const music = { buf: null, src: null, gain: null };
  let loadedMusic = false;
  function loadMusic() {
    if (loadedMusic || !ac) return; loadedMusic = true; SND.load();
    fetch('audio/ic-music.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab && ac.decodeAudioData(ab)).then(b => { if (b) music.buf = b; }).catch(() => {});
  }
  function stopMusic() { if (music.src) { try { music.src.stop(); } catch (e) {} music.src = null; } }
  function musicTick() {   // the ice cream truck tune, in step with the story; quiet while Sprinkles sleeps
    if (!music.buf || !ac) return;
    const from = 2.6;
    if (!music.src && st.t > from && st.t < END - 1) {
      const src = ac.createBufferSource(), gn = ac.createGain();
      src.buffer = music.buf; src.loop = true; gn.gain.value = 0;
      src.connect(gn); gn.connect(master); src.start(0, (st.t - from) % music.buf.duration);
      music.src = src; music.gain = gn;
    }
    if (music.gain) music.gain.gain.value = 0.26 * clamp01((st.t - from) / 1.5) * clamp01((END - 0.4 - st.t) / 2.5) * (st.t > 29 && st.t < 32.5 ? 0.35 : 1);
  }

  /* ---------- the shots ---------- */
  const drive = (t, a, b, x0, x1) => lerp(x0, x1, eio(seg(t, a, b)));
  const spinAt = x => x / 6;
  const PARK_X = 0, KIDS = [['kid', SKIN[2], 'pink'], ['kid3', SKIN[0], 'choc'], ['kid2', SKIN[3], 'mint']];
  const SHOTS = [
    { a: 0, b: 5.5, sky: 'dawn', // 1. good morning, Sprinkles!
      cam() { setCam(36, -26, 110, 80); },
      world(t) {
        sun(70, -78 + Math.round(30 * (1 - eout(seg(t, 0, 3.5)))), 11);
        cloudRow(0.5, -70, '#ffe6f0'); hills(-4, 22, 0.03, 2, '#f0b8a0', 0.4);
        road();
        // Sprinkles' little garage
        R(-34, -48, 52, 44, '#f2d0e0'); for (let k = 0; k < 10; k++) R(-38 + k * 2, -49 - k, 60 - k * 4, 1, '#c84a7a');
        R(-30, -40, 44, 36, '#7a5a6a'); text('ICE', -20, -45, 1, '#ffffff');
        const awake = t > 2.6;
        truck(0, 0, { mood: awake ? (t < 3.4 ? 'wow' : 'happy') : 'sleep', bounce: awake && t < 3.6 ? Math.abs(Math.sin((t - 2.6) * 9)) * 4 : 0, wave: t > 3.4 });
        if (!awake && Math.floor(T * 1.3) % 2) text('z', 66, -42 - (T * 4 % 6), 1, '#5a5a8a');
      },
      words: [[0.6, 'Zzz', () => [60, -44]], [3.2, 'DING DING!', () => [30, -66], true]],
    },
    { a: 5.5, b: 12, sky: 'day', // 2. off through town, music playing
      cam(t) { setCam(drive(t, 5.5, 12, 0, 300) + 36, -24, 160, 100); },
      world(t) {
        sun(cam.cx + 70, -90, 10); cloudRow(0.7, -80); hills(-10, 26, 0.02, 4, '#9ad88a', 0.6); town(0.35); birds(3, -70);
        road();
        const x = drive(t, 5.5, 12, 0, 300);
        truck(x, 0, { mood: 'happy', spin: spinAt(x), bounce: Math.abs(Math.sin(T * 10)) });
        for (let i = 0; i < 4; i++) { const p = (T * 1.2 + i * 0.25) % 1; alpha(1 - p, () => R(x + 42 + i * 3, -48 - p * 18, 3, 3, ['#ff6fb4', '#ffd21f', '#7ad0ff', '#3fb43a'][i])); }   // musical notes
      },
      words: [[8.2, 'TOOT TOOT!', () => [cam.cx + 30, -60], true]],
    },
    { a: 12, b: 21, sky: 'day', // 3. the park: three kids; one drops a scoop and gets a giant new one
      cam() { setCam(64, -26, 170, 90, true); },
      world(t) {
        cloudRow(0.6, -76); hills(-8, 18, 0.03, 7, '#9ad88a', 0.3);
        for (const tx of [-40, 150]) drawTree(tx, -4, 12);
        R(110, -10, 26, 2, '#a8743f'); R(110, -14, 26, 2, '#a8743f'); R(112, -8, 2, 6, '#5a5e6a'); R(132, -8, 2, 6, '#5a5e6a');
        road();
        const tx = drive(t, 12, 13.3, -60, 0);
        truck(tx, 0, { mood: t > 16.6 && t < 17.8 ? 'worry' : 'happy', spin: spinAt(tx), wave: t > 13.5 });
        KIDS.forEach(([type, skin, flavor], i) => {
          const arrive = 13.6 + i * 0.3, x = lerp(170 + i * 20, 84 + i * 18, eout(seg(t, arrive, arrive + 1.2))), got = 14.4 + i * 0.9;
          let pose = t > arrive + 1.2 ? 'wave' : 'stand', extra = { walk: t > arrive && t < arrive + 1.2 };
          if (t > got + 0.5) { extra.cone = [flavor]; pose = 'eat'; }
          if (i === 1) {
            if (t > 16.5 && t < 18.3) { extra.cone = null; pose = 'stand'; extra.tear = t > 16.9; }
            if (t > 18.3) { extra.cone = ['choc', 'pink', 'blue']; pose = 'cheer'; extra.hop = Math.abs(Math.sin(T * 9)) * 3; }
          }
          if (t > 19.5) { pose = 'cheer'; extra.hop = Math.abs(Math.sin(T * 9 + i)) * 3; }
          kid(type, x, 0, -1, pose, skin, i, extra);
          // a cone flying from the window into each hand
          if (t > got && t < got + 0.5) { const k = (t - got) / 0.5; cone(lerp(30, x - 3, k), lerp(-26, -12, k) - Math.sin(k * Math.PI) * 14, [flavor]); }
        });
        // the dropped scoop
        if (t > 16.5) { const k = seg(t, 16.5, 16.8), x = 84 + 18 - 3; if (k < 1) circle(x, lerp(-14, -2, k), 3, SCOOP.choc[0]); else { ellipse(x, -1, 5, 2, SCOOP.choc[0]); R(x - 2, -2, 1, 1, '#ffffff'); } }
        // the giant replacement flies out
        if (t > 17.8 && t < 18.3) { const k = (t - 17.8) / 0.5; cone(lerp(30, 99, k), lerp(-26, -12, k) - Math.sin(k * Math.PI) * 18, ['choc', 'pink', 'blue']); }
        if (t > 18.3 && t < 19.6) for (let i = 0; i < 3; i++) heart(99 + i * 6 - 6, -34 - ((t - 18.3) * 14 + i * 4) % 14, 2, '#e8222b');
      },
      words: [[14.4, 'YUM!', () => [84, -36]], [16.5, 'PLOP!', () => [100, -18], true], [17.1, 'UH OH!', () => [60, -46]], [18.4, 'YAY!', () => [100, -42], true]],
    },
    { a: 21, b: 29, sky: 'day', // 4. the fire station: firefighters, and the family's dogs and cat
      cam() { setCam(56, -30, 210, 96, true); },
      world(t) {
        cloudRow(0.6, -84); hills(-10, 22, 0.02, 1, '#9ad88a', 0.3);
        // the fire station
        R(-80, -70, 70, 66, '#b8473a'); for (let y = -66; y < -4; y += 4) R(-80, y, 70, 1, '#a33d32');
        R(-84, -74, 78, 4, '#e9dcc4'); R(-74, -60, 58, 12, '#7a1f1f'); text('FIRE', -62, -57, 1, '#fff6e0');
        R(-72, -42, 54, 38, '#3a3442'); drawV(VI.fire, -70, -4, false, 0, 0, true);
        road();
        const tx = drive(t, 21, 22.3, -10, 20);
        truck(tx, 0, { mood: 'happy', spin: spinAt(tx), wave: t > 22.6 });
        drawPerson({ type: 'ff', x: 120, yb: 0, dir: -1, pose: t > 24 ? 'eat' : 'wave', skin: SKIN[1], seed: 3 });
        drawPerson({ type: 'ff', x: 134, yb: 0, dir: -1, pose: t > 24.4 ? 'eat' : 'wave', skin: SKIN[3], seed: 5 });
        if (t > 24) cone(116, -9, ['van']); if (t > 24.4) cone(130, -9, ['lem']);
        // here come the dogs and the cat
        const dx = lerp(200, 104, eout(seg(t, 23, 24.8)));
        dogs(dx, 0, -1, { run: t < 24.8, bark: t > 24.8 && t < 26, lick: t > 26.4 && Math.floor(T * 4) % 2, hop: t > 25.6 && t < 26.4 ? Math.abs(Math.sin(T * 10)) * 4 : 0 });
        const cx = lerp(230, 150, eout(seg(t, 23.6, 25.4)));
        if (t < 25.4) PETS.catWalk(cx, 0, -1, { walk: true }); else PETS.catSit(cx, 0, { meow: t > 25.6 && t < 26.4, swish: true });
        if (t > 26.2) { pupCup(dx - 8, 0); pupCup(dx - 30, 0); R(cx - 9, -3, 6, 3, '#ff8fb8'); R(cx - 8, -4, 4, 1, '#fff6e0'); }
        if (t > 26.4 && t < 28) for (let i = 0; i < 4; i++) heart(dx - 20 + i * 18, -30 - ((t - 26.4) * 12 + i * 3) % 12, 2, '#e8222b');
      },
      words: [[25, 'WOOF!', () => [110, -30]], [25.7, 'MEOW!', () => [150, -26]], [26.6, 'YUM!', () => [80, -40], true]],
    },
    { a: 29, b: 33.5, sky: 'day', // 5. uh oh, the freezer is empty... but look, a rainbow!
      cam(t) { setCam(36, lerp(-26, -40, eio(seg(t, 31, 33))), 96, 76); },
      world(t) {
        cloudRow(0.6, -80);
        const rk = eout(seg(t, 30.8, 32.4));
        if (rk > 0) rainbow(150, 10, 120, rk);
        // far, far away: a mountain shaped like an ice cream cone
        if (t > 31.6) { const x = 200, b = -10; for (let y = 0; y < 20; y++) R(x - y * 0.4, b - 20 + y, y * 0.8 + 1, 1, '#dcaa62'); circle(x, b - 26, 6, '#ff8fb8'); circle(x, b - 33, 5, '#fff6e0'); circle(x, b - 39, 4, '#8a5230'); R(x, b - 45, 2, 2, '#e8222b'); }
        hills(-4, 14, 0.04, 3, '#9ad88a', 0.2);
        road();
        truck(0, 0, { mood: t < 30.6 ? 'worry' : t < 31.6 ? 'up' : 'wow', empty: true, bounce: t > 32 ? Math.abs(Math.sin(T * 9)) * 3 : 0 });
      },
      words: [[29.4, '?', () => [30, -50]], [29.9, 'UH OH!', () => [56, -42], true], [32, 'WOW!', () => [50, -60], true]],
    },
    { a: 33.5, b: 43, sky: 'candy', // 6. through candy hills, over the chocolate river, sprinkles falling like snow
      cam(t) { setCam(drive(t, 33.5, 43, 0, 420) + 36, -26, 160, 100); },
      world(t) {
        cloudRow(0.7, -84, '#fff0fa');
        hills(-14, 30, 0.02, 2, '#f8b8d8', 0.6); hills(-6, 20, 0.03, 5, '#b8f0d8', 0.4);
        const v = vis();
        for (let i = Math.floor(v.x0 / 30); i < v.x1 / 30; i++) { const x = i * 30 + 6; if (hsh(i) < 0.5) lolly(x, -4, 14 + Math.floor(hsh(i * 3) * 8), ['#ff6fb4', '#7ad0ff', '#ffd21f', '#3fe28a'][i & 3]); else gumdrop(x, -4, ['#e8222b', '#8a4fd9', '#3fb43a', '#f57a12'][i & 3]); }
        road('#d9a35a');   // a waffle-cone road
        // the chocolate river under a candy-cane bridge
        const rx = 210;
        R(rx - 30, 0, 60, vis().y1, '#6a3a1e'); for (let k = 0; k < 6; k++) R(rx - 26 + ((k * 13 + T * 20) % 52), 6 + k * 5, 8, 1, '#8a5230');
        R(rx - 34, -2, 68, 4, '#ffffff'); for (let k = 0; k < 17; k++) R(rx - 34 + k * 4, -2, 2, 4, '#e8222b');
        for (const px of [rx - 30, rx + 28]) { R(px, -2, 3, 18, '#ffffff'); for (let k = 0; k < 4; k++) R(px, k * 4, 3, 2, '#e8222b'); }
        const x = drive(t, 33.5, 43, 0, 420);
        truck(x, 0, { mood: 'happy', spin: spinAt(x), bounce: Math.abs(Math.sin(T * 10)), empty: true });
        sprinkleSnow(50);
      },
      words: [[38.5, 'YUM!', () => [cam.cx + 20, -60]]],
    },
    { a: 43, b: 49.6, sky: 'candy', // 7. the Giant Ice Cream Mountain! (looking all the way up)
      cam(t) { setCam(lerp(-110, 0, eio(seg(t, 44, 46))), lerp(-36, -420, eio(seg(t, 45.6, 49.2))), 170, 120); },
      world(t) {
        cloudRow(0.4, -300, '#fff0fa'); cloudRow(0.6, -150, '#fff0fa');
        hills(-10, 40, 0.01, 2, '#f8b8d8', 0.3);
        mountain();
        fill(0, '#b8f0d8'); for (let x = -200; x < 200; x += 9) R(x, 4 + Math.floor(hsh(x) * 20), 2, 1, '#ff6fb4');
        const tx = drive(t, 43, 45, -220, -60);
        truck(tx, 0, { mood: t > 44.6 ? 'up' : 'happy', spin: spinAt(tx), empty: true });
        if (t > 48.5) for (let i = 0; i < 6; i++) { const a = T * 2 + i; R(Math.cos(a) * 40, -420 + Math.sin(a) * 30, 2, 2, '#fff6b0'); }
      },
      words: [[45.2, 'WOW!', () => [-80, -70], true]],
    },
    { a: 49.6, b: 51.6, sky: 'candy', // 7b. the whole mountain, seen from far away
      cam() { setCam(0, -90, 200, 210); },
      world(t) {
        cloudRow(0.3, -180, '#fff0fa'); hills(-6, 30, 0.015, 3, '#f8b8d8', 0.2);
        rainbow(0, 20, 150, 1);
        mountain(0.4);
        fill(0, '#b8f0d8'); for (let x = -200; x < 200; x += 9) R(x, 3 + Math.floor(hsh(x) * 12), 2, 1, '#ff6fb4');
        for (let i = 0; i < 8; i++) { const a = T * 1.5 + i * 0.8; R(Math.cos(a) * 70, -100 + Math.sin(a) * 60, 2, 2, '#fff6b0'); }
      },
      words: [[49.9, 'WOW!', () => [0, -200], true]],
    },
    { a: 51, b: END, sky: 'dusk', // 8. filling up, and a party with everyone
      cam(t) { setCam(lerp(-30, 20, eio(seg(t, 53, 57.5))), -34, 220, 100, true); },
      world(t) {
        cloudRow(0.4, -150, '#ffe6d0');
        g.save(); g.translate(-200, 0); mountain(); g.restore();
        fill(0, '#b8f0d8');
        // soft serve pours from the waterfall into Sprinkles' window
        truck(-90, 0, { mood: t > 59.5 ? 'wink' : 'happy', wave: t > 54, bounce: t > 54 ? Math.abs(Math.sin(T * 6)) * 2 : 0, empty: t < 53 });
        if (t < 53.5) for (let y = -60; y < -26; y += 2) R(-62 + Math.sin(y * 0.2 + T * 9), y, 6, 2, y % 6 ? '#fff6e0' : '#f2e8d0');
        if (t > 53 && t < 54) sparkle(sx(-60), sy(-30), 12, 2, '#ffffff');
        // everybody came along!
        const come = k => eout(seg(t, 53.5 + k * 0.25, 55.5 + k * 0.25));
        KIDS.forEach(([type, skin, flavor], i) => kid(type, lerp(160 + i * 13, -2 + i * 13, come(i)), 0, -1, t > 56 ? 'cheer' : 'eat', skin, i, { cone: t > 55.5 && t < 56 ? [flavor] : null, walk: come(i) < 1, hop: t > 56 ? Math.abs(Math.sin(T * 8 + i)) * 3 : 0 }));
        drawPerson({ type: 'ff', x: lerp(220, 42, come(3)), yb: 0, dir: -1, pose: t > 56 ? 'cheer' : 'eat', walk: come(3) < 1, skin: SKIN[1], seed: 3, hop: t > 56 ? Math.abs(Math.sin(T * 8)) * 3 : 0 });
        dogs(lerp(260, 80, come(4)), 0, -1, { run: come(4) < 1, wag: true, hop: t > 56 ? Math.abs(Math.sin(T * 10)) * 4 : 0 });
        const cx = lerp(280, 98, come(5));
        if (come(5) < 1) PETS.catWalk(cx, 0, -1, { walk: true }); else PETS.catSit(cx, 0, { swish: true, hop: t > 56 ? Math.abs(Math.sin(T * 7)) * 2 : 0 });
        if (t > 56) sprinkleSnow(70);
      },
      words: [[52.2, 'YUM!', () => [-60, -60], true], [56.2, 'HOORAY!', () => [40, -50], true]],
    },
  ];

  /* ---------- scene plumbing (with pause and a draggable timeline) ---------- */
  const st = { t: 0, done: false, fired: {}, paused: false, ui: 0, drag: null, saved: null };
  const shotAt = t => { for (let i = 0; i < SHOTS.length; i++) if (t < SHOTS[i].b) return SHOTS[i]; return SHOTS[SHOTS.length - 1]; };
  function camNow() { const s = shotAt(st.t); s.cam.call(s, st.t); return s; }
  function seek(t) { stopMusic(); st.t = Math.max(0, Math.min(END - 0.05, t)); st.fired = {}; parts = []; camNow(); }
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
  function finish() { if (st.done) return; st.done = true; goScene(SCENES.movies ? 'movies' : 'station', { watched: 'ice' }); }

  SCENES.movieIce = {
    noWeather: true,
    view: [186, 200],
    freeTouch: true,
    cover(x, yb) { truck(x - 12, yb, { mood: 'happy' }); },
    layout() {},
    enter() { Object.assign(st, { t: 0, done: false, fired: {}, paused: false, ui: 0, drag: null }); if (!st.saved) st.saved = clouds; clouds = []; loadMusic(); },
    leave() { stopMusic(); if (st.saved) { clouds = st.saved; st.saved = null; } },
    update(dt) {
      if (st.done) return;
      st.ui = Math.max(0, st.ui - dt);
      if (st.paused || st.drag != null) { stopMusic(); camNow(); return; }
      st.t += dt;
      camNow();
      musicTick();
      for (const sh of SHOTS) (sh.words || []).forEach(([wt, word], i) => { const key = sh.a + ':' + i; if (st.t >= wt && st.t < wt + 0.3 && !st.fired[key]) { st.fired[key] = true; playWord(word); } });
      // a few extra sounds: cones popping out of the window
      for (const [pt, k] of [[14.4, 'p1'], [15.3, 'p2'], [16.2, 'p3'], [17.8, 'p4'], [24, 'p5'], [26.2, 'p6'], [53, 'p7']]) if (st.t >= pt && st.t < pt + 0.3 && !st.fired[k]) { st.fired[k] = true; SND.play('pop', 1 + Math.random() * 0.2); }
      if (st.t > 56 && Math.random() < dt * 3) confetti(4);
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
    drawLit() { drawParticles(); },
    drawUI() {
      const s = shotAt(st.t);
      for (const w of s.words || []) { const [wt, word, at, big] = w, age = st.t - wt; if (age >= 0 && age <= 1.7) { const [wx, wy] = at(st.t); bubble(word, sx(wx), sy(wy), age, big); } }
      iris(Math.min(1, st.t / 0.5, (END - st.t) / 1.4), W / 2, H * 0.45);
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
