// Cinema: "The Big Bone Adventure", a one-minute watch-only cartoon starring the family's two dogs:
// a sleek red Vizsla and a fluffy white husky. Off through the forest past an owl, across a creek,
// past a bear and a snake, up into the snowy mountains, and down to a giant bone.
// Tap for pause and the timeline; only the home button leaves.
'use strict';
(() => {
  const A = BOOK, INK_ = INK, BLACK = '#1d1a2b';
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const seg = (v, a, b) => clamp01((v - a) / (b - a));
  const eout = k => 1 - (1 - k) ** 3;
  const hsh = A.hsh;
  const END = 60;

  /* ---------- the cast ---------- */
  function dlegs(P, xs, top, h, w, c, o, paw) {
    xs.forEach((lx, i) => {
      let dx = 0, dy = 0;
      if (o.run) { const k = (i + (o.step || 0)) % 2; dx = k ? 1 : -1; dy = k ? -1 : 0; }
      else if (o.step && i % 2) dy = -1;
      P(lx + dx, top, w, h + dy, c);
      if (paw) P(lx + dx, top + h + dy - 1, w + 1, 1, paw);
    });
  }
  // the red Vizsla, 44 long. o: { pose: stand|point|tilt|chew, run, step, hop, bark, wag, wet }
  function vizsla(x, yb, dir = 1, s = 1, o = {}) {
    const P = A.pen(x, yb - (o.hop || 0) * s, 44, dir, s), V1 = '#b4542a', V2 = '#cc6c3a', V3 = '#8a3a1a', EAR = '#94401e', NOSE = '#b87a70', pose = o.pose || 'stand';
    // tail: carried level, wagging
    if (pose === 'point') P(-4, -21, 10, 2, V1);
    else { const w = o.wag ? Math.floor(T * 12) % 2 : 0; P(2, -21, 4, 2, V1); P(-1, -22 - w, 4, 1, V1); P(-3, -23 - 2 * w, 3, 1, V1); }
    dlegs(P, [7, 11], -10, 10, 2, V3, o, V3);
    P(6, -15, 7, 4, V1);   // haunch
    P(5, -21, 22, 7, V1); P(6, -21, 20, 1, V2); P(16, -14, 12, 4, V1); P(13, -14, 4, 1, V1); P(17, -11, 10, 1, V3);
    if (pose === 'point') { P(22, -10, 2, 10, V3); P(22, -1, 3, 1, V3); P(25, -10, 2, 4, V1); P(26, -7, 3, 2, V1); P(27, -6, 2, 1, V3); }
    else dlegs(P, [22, 25], -10, 10, 2, V1, o, V3);
    if (pose === 'chew') {   // head down at the bone
      P(24, -21, 5, 7, V1); P(26, -17, 5, 5, V1);
      P(28, -16, 8, 6, V1); P(35, -14, 6, 4, V1); P(40, -14, 2, 2, NOSE); P(35, -11, 6, 1, V3);
      P(28, -15, 4, 9, EAR); P(29, -6, 2, 1, EAR);
      P(32, -14, 2, 1, INK_);
    } else {
      const up = pose === 'tilt' ? 1 : 0;
      P(24, -25, 5, 6, V1); P(26, -28, 5, 4, V1); P(25, -25, 2, 1, V2);
      P(28, -32 - up, 8, 6, V1); P(29, -32 - up, 6, 1, V2);
      P(35, -30 - up, 6, 4, V1); P(36, -30 - up, 4, 1, V2); P(40, -30 - up, 2, 2, NOSE);
      P(35, -27 - up, 6, 1, V3); P(36, -26 - up, 4, 1, V1);
      if (o.bark) { P(36, -26 - up, 5, 2, '#5a1a10'); P(36, -24 - up, 4, 1, V1); }
      if (pose === 'tilt') { P(27, -34, 5, 3, EAR); P(26, -32, 3, 3, EAR); }
      else { P(28, -31, 4, 9, EAR); P(29, -22, 2, 1, EAR); P(31, -30, 1, 7, V3); }
      P(33, -30 - up, 2, 2, '#e0a040'); P(34, -30 - up, 1, 1, INK_); P(32, -31 - up, 3, 1, V3);
    }
    P(24, -23, 5, 3, '#3d4a3a'); P(27, -20, 1, 2, '#cfd6dd');
    if (o.wet) for (let i = 0; i < 4; i++) R(Math.round(x - 16 * s + i * 9 * s), Math.round(yb - 8 * s + ((T * 30 + i * 7) % 10) * s), s, 2 * s, '#8ec8f0');
  }
  // the fluffy white husky, 44 long. o: { pose: stand|howl|chew, run, step, hop, pant, wag, bark }
  function husky(x, yb, dir = 1, s = 1, o = {}) {
    const P = A.pen(x, yb - (o.hop || 0) * s, 44, dir, s), H1 = '#f4f4f0', H2 = '#ffffff', H3 = '#d6dae2', H4 = '#9aa2b0', PINK = '#f2a8a0', pose = o.pose || 'stand';
    const w = o.wag ? Math.floor(T * 10) % 2 : 0;
    // curled plume of a tail over the back
    P.c(5, -23, 4, H3); P.c(6, -27 - w, 4, H1); P.c(10, -29 - w, 3, H1); P.c(4, -29 - w, 2, H2);
    dlegs(P, [7, 11], -9, 9, 3, H3, o, H4);
    P(6, -14, 8, 5, H1);   // fluffy haunch
    P(5, -22, 22, 12, H1); P(6, -23, 19, 1, H1); P(7, -22, 16, 1, H2);
    for (let i = 0; i < 6; i++) P(7 + i * 3, -10, 2, 1, H3);
    dlegs(P, [21, 25], -9, 9, 3, H1, o, H3);
    P.c(26, -17, 6, H1); P.c(27, -14, 3, H2);   // chest ruff
    const ears = (ex, ey) => {   // two pointy ears, pink inside
      for (const d of [0, 4]) { P(ex + d, ey, 4, 2, H1); P(ex + d, ey - 1, 4, 1, H1); P(ex + d, ey - 2, 3, 1, H1); P(ex + d, ey - 3, 2, 1, H1); P(ex + d, ey - 4, 1, 1, H3); P(ex + d + 1, ey - 2, 1, 2, PINK); }
    };
    if (pose === 'howl') {
      P(23, -27, 7, 8, H1); P(25, -35, 8, 9, H1); P(29, -40, 5, 6, H1); P(30, -43, 4, 3, H1); P(31, -44, 2, 2, INK_); P(33, -39, 2, 3, '#5a3040');
      ears(24, -36); P(28, -33, 2, 1, INK_); P(26, -27, 4, 3, H1);
    } else if (pose === 'chew') {
      P(24, -22, 6, 7, H1); P(27, -18, 9, 7, H1); P(35, -15, 5, 4, H1); P(39, -15, 2, 2, INK_); P(35, -12, 4, 1, H4);
      ears(28, -19); P(31, -16, 2, 2, '#6aaee8'); P(32, -16, 1, 1, INK_);
    } else {
      P(23, -27, 7, 8, H1); P(26, -26, 4, 3, H1);
      P(27, -33, 9, 8, H1); P(28, -33, 7, 1, H2);
      P(35, -29, 5, 4, H1); P(35, -30, 3, 1, H1); P(39, -29, 2, 2, INK_); P(35, -26, 4, 1, H4);
      if (o.pant) { P(36, -25, 2, 3, '#e8708a'); P(36, -25, 3, 1, '#5a3040'); }
      if (o.bark) P(35, -26, 5, 2, '#5a3040');
      ears(28, -34);
      P(31, -31, 3, 2, '#6aaee8'); P(32, -31, 1, 1, INK_); P(30, -31, 1, 1, H4);
      P(27, -27, 3, 1, H3);
    }
  }
  function owl(x, yb, s = 1, o = {}) {
    const P = A.pen(x, yb, 18, 1, s), O1 = '#8a6a4a', O2 = '#a8845a', O3 = '#6a4a30', BL = '#ecdcb8';
    if (o.fly) { const up = Math.floor(T * 10) % 2; P(-7, up ? -22 : -14, 10, 4, O2); P(15, up ? -22 : -14, 10, 4, O2); }
    P(3, -24, 2, 3, O3); P(13, -24, 2, 3, O3);
    P(3, -21, 12, 18, O1); P(2, -17, 14, 12, O1);
    P(5, -13, 8, 9, BL); for (const [dx, dy] of [[6, -12], [9, -10], [11, -12], [7, -8], [10, -7]]) P(dx, dy, 1, 1, O3);
    if (!o.fly) { P(1, -15, 2, 9, O3); P(15, -15, 2, 9, O3); }
    P.c(6, -18, 4, O2); P.c(12, -18, 4, O2);
    if (o.blink) { P(3, -18, 6, 1, O3); P(10, -18, 6, 1, O3); }
    else {
      const lk = o.look || 0;
      P.c(6, -18, 3, '#ffd21f'); P.c(12, -18, 3, '#ffd21f');
      P(5 + lk, -19, 2, 2, INK_); P(11 + lk, -19, 2, 2, INK_);
    }
    P(8, -16, 2, 3, '#f5a020');
    if (o.hoot) P(8, -13, 2, 2, '#5a3a20');
    P(5, -3, 3, 1, '#f5a020'); P(10, -3, 3, 1, '#f5a020');
  }
  // the big brown bear: on all fours (side) or standing up. o: { stand, roar, yawn, wave, step, run }
  function bear(x, yb, dir = 1, s = 1, o = {}) {
    const B1 = '#7a4a2a', B2 = '#94603a', B3 = '#5a3418', MZ = '#c8a07a';
    if (o.stand) {
      const P = A.pen(x, yb, 52, 1, s);
      P(16, -14, 8, 14, B3); P(28, -14, 8, 14, B1); P(15, -1, 10, 1, B3); P(27, -1, 10, 1, B3);
      P(12, -42, 28, 30, B1); P(14, -42, 24, 2, B2); P(18, -36, 16, 20, B2);
      if (o.wave) { const a = Math.floor(T * 6) % 2; P(38, -54 - a, 7, 16, B1); P(38, -56 - a, 8, 4, B3); } else P(38, -40, 6, 16, B1);
      P(8, -40, 6, 16, B3);
      P(15, -58, 22, 17, B1); P.c(17, -57, 4, B1); P.c(35, -57, 4, B1); P.c(17, -57, 2, B3); P.c(35, -57, 2, B3);
      P(20, -49, 12, 7, MZ); P(24, -49, 4, 2, INK_);
      if (o.yawn) { P(21, -51, 3, 1, INK_); P(29, -51, 3, 1, INK_); } else { P(20, -53, 2, 2, INK_); P(30, -53, 2, 2, INK_); P(20, -53, 1, 1, '#ffffff'); P(30, -53, 1, 1, '#ffffff'); }
      if (o.roar || o.yawn) { P(22, -46, 8, 5, '#5a1a1a'); P(23, -46, 1, 2, '#ffffff'); P(28, -46, 1, 2, '#ffffff'); P(24, -43, 4, 2, '#e8708a'); }
      else { P(24, -45, 4, 1, B3); P(23, -46, 1, 1, B3); P(28, -46, 1, 1, B3); }
      return;
    }
    const P = A.pen(x, yb, 60, dir, s);
    dlegs(P, [8, 14, 38, 44], -12, 12, 5, B3, o, B3);
    P(4, -31, 44, 20, B1); P.c(30, -31, 7, B1); P(6, -31, 40, 2, B2); P(8, -13, 36, 2, B3);
    P(44, -32, 12, 12, B1); P.c(46, -33, 3, B1); P.c(46, -33, 1, B3);
    P(54, -26, 5, 5, MZ); P(58, -26, 2, 2, INK_); P(50, -29, 2, 2, INK_); P(55, -22, 3, 1, B3);
    P(1, -27, 4, 4, B1);
  }
  function snake(x, yb, s = 1, o = {}) {
    const G1 = '#4aa83a', G2 = '#3a8a2e', BE = '#c8e070';
    if (o.slither) {   // a wiggly line heading right from x
      for (let i = 18; i >= 0; i--) { const sx2 = x - i * 3 * s, sy2 = yb - 3 * s + Math.round(Math.sin(T * 9 - i * 0.7) * 3 * s); circle(sx2, sy2, 2 * s, i % 3 ? G1 : G2); }
      R(x, yb - 6 * s, 6 * s, 5 * s, G1); R(x + 3 * s, yb - 5 * s, s, s, INK_); R(x + 6 * s, yb - 4 * s, 3 * s, s, '#e8222b');
      return;
    }
    const P = A.pen(x, yb, 24, 1, s);
    P(2, -4, 20, 4, G1); P(2, -1, 20, 1, BE); P(4, -8, 16, 4, G2); P(6, -12, 12, 4, G1); P(7, -9, 10, 1, BE);
    for (const [dx, dy] of [[5, -3], [11, -3], [17, -3], [8, -7], [14, -7], [10, -11]]) P(dx, dy, 2, 1, '#2a6a20');
    P(14, -20, 4, 9, G1); P(15, -20, 2, 9, BE);
    P(12, -25, 9, 6, G1); P(13, -25, 7, 1, '#6ac85a');
    if (o.wink) P(14, -23, 3, 1, INK_); else { P(14, -24, 2, 2, '#ffffff'); P(15, -23, 1, 1, INK_); }
    P(18, -24, 2, 2, '#ffffff'); P(19, -23, 1, 1, INK_);
    P(16, -20, 4, 1, '#2a6a20');
    if (o.hiss || Math.floor(T * 4) % 3 === 0) { P(21, -21, 3, 1, '#e8222b'); P(24, -22, 1, 1, '#e8222b'); P(24, -20, 1, 1, '#e8222b'); }
  }
  function bone(cx, yb, w, glow) {
    const h = Math.max(4, Math.round(w * 0.2)), r = Math.round(h * 0.75), y = yb - r * 2 + 1;
    if (glow) alpha(0.25 + 0.15 * Math.sin(T * 4), () => { circle(cx, y + h / 2, w * 0.6, '#fff6b0'); });
    R(cx - w / 2 + r, y + r - h / 2, w - 2 * r, h, '#f4ecd8');
    R(cx - w / 2 + r, y + r + h / 2 - 2, w - 2 * r, 2, '#d8ccb0');
    for (const ex of [cx - w / 2 + r, cx + w / 2 - r]) {
      circle(ex, y + r - Math.round(r * 0.55), r, '#f4ecd8'); circle(ex, y + r + Math.round(r * 0.55), r, '#f4ecd8');
      circle(ex, y + r + Math.round(r * 0.55) + 1, Math.max(1, r - 2), '#e2d6bc');
    }
    R(cx - w / 2 + r, y + r - h / 2 + 1, w - 2 * r, 1, '#ffffff');
  }
  function pine(x, base, h, c1 = '#2f6a3a', c2 = '#3f7a44') {
    R(x - 1, base - 4, 3, 4, '#5a3a22');
    for (let k = 0; k < h; k++) { const w = 1 + Math.floor(((k % Math.ceil(h / 3)) + k / 3) * 0.55); R(x - w, base - h - 3 + k, 2 * w + 1, 1, k % 3 ? c1 : c2); }
  }

  /* ---------- camera and scenery kit ---------- */
  const cam = { z: 1, ox: 0, oy: 0, cx: 0 };
  const sx = x => cam.ox + x * cam.z, sy = y => cam.oy + y * cam.z;
  function setCam(cx, cy, fw, fh) {
    const kw = W / fw, kh = H / fh;
    const z = Math.max(1, Math.min(12, Math.floor(Math.min(kh, kw * (fw >= 140 ? 1.75 : 1.3)))));
    cam.z = z; cam.cx = cx;
    cam.ox = Math.round(W / 2 - cx * z);
    cam.oy = Math.round(H * (H > W * 1.3 ? 0.54 : 0.5) - cy * z);
  }
  function vis() { return { x0: Math.floor(-cam.ox / cam.z) - 2, x1: Math.ceil((W - cam.ox) / cam.z) + 2, y0: Math.floor(-cam.oy / cam.z) - 2, y1: Math.ceil((H - cam.oy) / cam.z) + 2 }; }
  function fill(y0, c, y1) { const v = vis(); R(v.x0, y0, v.x1 - v.x0, (y1 == null ? v.y1 : y1) - y0, c); }
  function hills(base, amp, freq, seed, c, par = 0) {
    const v = vis(), off = cam.cx * par;
    for (let x = v.x0 - (v.x0 % 2); x < v.x1; x += 2) {
      const u = x - off, h = Math.round(amp * (0.6 + 0.4 * Math.sin(u * freq + seed) + 0.3 * Math.sin(u * freq * 2.3 + seed * 3)));
      if (h > 0) R(x, base - h, 2, h + 1, c);
    }
  }
  function strokes(y0, y1, c, dens = 0.05, seed = 1) {
    const v = vis();
    for (let x = v.x0 - (v.x0 % 3); x < v.x1; x += 3) {
      const n = hsh(x * 0.37 + seed);
      if (n < dens * 6) R(x, Math.round(y0 + hsh(x * 1.7 + seed) * (y1 - y0)), 1, 2 + Math.round(n * 20) % 3, c);
    }
  }
  function pineRow(base, step, hmin, hmax, c1, c2, par, seed) {   // a band of pines; par > 0 drifts slower than the camera
    const v = vis(), off = cam.cx * par;
    const i0 = Math.floor((v.x0 - off - 20) / step), i1 = Math.ceil((v.x1 - off + 20) / step);
    for (let i = i0; i <= i1; i++) {
      const x = Math.round(i * step + off + (hsh(i + seed) - 0.5) * step * 0.6);
      pine(x, base + Math.round(hsh(i * 3 + seed) * 4), Math.round(hmin + hsh(i * 7 + seed) * (hmax - hmin)), c1, c2);
    }
  }
  function ellipse(cx, cy, rx, ry, c) {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -ry; dy <= ry; dy++) { const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2))); R(cx - dx, cy + dy, dx * 2 + 1, 1, c); }
  }
  const SKY = {
    day: ['#8ec8ec', '#a2d2ee', '#b8dcee', '#cce6ea', '#dcece2'],
    woods: ['#9ccab8', '#aed4c0', '#c0dcc4', '#d0e4c8'],
    snow: ['#7ab4e8', '#94c4ee', '#b2d4f0', '#d0e4f2', '#e8f0f2'],
    dusk: ['#f2a07a', '#f4b486', '#f6c890', '#f8da9c', '#fae6aa'],
  };
  function drawSky(key) { const c = SKY[key] || SKY.day, n = c.length, bh = Math.ceil(H / n); for (let i = 0; i < n; i++) R(0, i * bh, W, bh + 1, c[i]); }
  function cloudRow(par, y) { const v = vis(), off = cam.cx * par; for (let i = -2; i < 8; i++) { const x = ((i * 120 + off + T * 3) % 900) - 300; if (x > v.x0 - 40 && x < v.x1 + 40) { ellipse(x, y + (i % 3) * 8, 16, 5, '#ffffff'); ellipse(x + 10, y - 3 + (i % 3) * 8, 10, 5, '#ffffff'); } } }
  function trail(y0, h, c = '#c9a878') {
    const v = vis(); R(v.x0, y0, v.x1 - v.x0, h, c); R(v.x0, y0, v.x1 - v.x0, 1, '#a88a5a');
    for (let x = Math.floor(v.x0 / 7) * 7; x < v.x1; x += 7) { const n = hsh(x * 0.21); R(x, y0 + 2 + Math.floor(n * (h - 3)), 2 + Math.floor(n * 4), 1, n < 0.5 ? '#b8946a' : '#dcc092'); }
  }
  function forestSet(parX = 0) {
    hills(-40, 14, 0.02, 1, '#9cc4a8', 0.7); pineRow(-34, 14, 18, 30, '#5a8a6a', '#6a9a76', 0.6, 1);
    fill(-30, '#5a9a4a', 0); pineRow(-24, 18, 26, 40, '#2f6a3a', '#3f7a44', 0.3, 2);
    fill(-6, '#6aa84a', 0); trail(0, 14); fill(14, '#5a9a42'); strokes(15, vis().y1, '#4a8a3a', 0.12, 3); fore(16, 'forest', 3);
  }
  // ferns, mushrooms, flowers or pebbles scattered over the near ground (fills tall screens)
  function fore(y0, kind, seed = 1) {
    const v = vis();
    for (let x = Math.floor(v.x0 / 11) * 11; x < v.x1; x += 11) {
      for (let r = 0; r < 4; r++) {
        const n = hsh(x * 0.31 + r * 7.7 + seed), y = Math.round(y0 + 6 + r * 22 + hsh(x * 1.3 + r + seed) * 16);
        if (y > v.y1 + 4 || n > 0.55) continue;
        const px = x + Math.round(hsh(x + r * 3 + seed) * 8);
        if (kind === 'forest') {
          if (n < 0.18) { for (let k = 0; k < 4; k++) { R(px - 4 + k, y - 4 + Math.abs(k - 2), 1, 4 - Math.abs(k - 2), '#3f8a3a'); R(px + k, y - 5 + k, 1, 5 - k, '#4a9a40'); } }
          else if (n < 0.3) { R(px, y - 4, 2, 4, '#f4ecd8'); R(px - 2, y - 6, 6, 2, '#e8222b'); R(px - 1, y - 7, 4, 1, '#e8222b'); R(px, y - 6, 1, 1, '#ffffff'); R(px + 2, y - 5, 1, 1, '#ffffff'); }
          else if (n < 0.45) { R(px, y - 3, 1, 3, '#3f8a3a'); R(px - 1, y - 4, 3, 1, ['#ffd21f', '#ff6fb4', '#ffffff'][Math.floor(n * 20) % 3]); }
          else R(px, y - 2, 3, 2, '#3f7a34');
        } else if (kind === 'rock') { if (n < 0.3) { R(px, y - 2, 4, 2, '#8a8a92'); R(px + 1, y - 3, 2, 1, '#a8a8b0'); } else R(px, y - 1, 2, 1, '#9a8a6a'); }
        else if (kind === 'snow') R(px, y - 2, 5, 2, n < 0.25 ? '#ffffff' : '#dce4ee');
        else if (kind === 'meadow') { R(px, y - 3, 1, 3, '#4a8a3a'); R(px - 1, y - 4, 3, 1, ['#ffd21f', '#ff6fb4', '#ffffff', '#c39bff'][Math.floor(n * 40) % 4]); }
      }
    }
  }
  function rays() { for (let i = 0; i < 4; i++) alpha(0.08 + 0.04 * Math.sin(T + i), () => { const x = 40 + i * 70 - cam.cx * 0.2; for (let k = 0; k < 120; k++) R(x + k * 0.5 - 60, -90 + k, 10, 1, '#fff8c8'); }); }

  /* ---------- bubbles ---------- */
  const WORD_C = { 'WOOF!': '#8a3a1a', 'RUFF!': '#8a3a1a', 'AWOO!': '#3a6ab8', 'HOO HOO!': '#6a4a30', '?': '#3a6ab8', 'ROAR!': '#7a2a1a', 'HSSS!': '#2a8a2a', 'SPLASH!': '#2a7ab8', 'CRUNCH!': '#a8742a', 'YUM!': '#e8222b', 'WOW!': '#d07010', 'BRRR!': '#3a6ab8' };
  function bubble(word, ax, ay, age, big = false) {
    if (age < 0 || age > 1.6) return;
    const s = Math.max(1, Math.min(4, Math.round(Math.min(W, H) / (big ? 70 : 95))));
    const tw = textWidth(word, s), bw = tw + 6 * s, bh = 11 * s;
    const pop = age < 0.18 ? eout(age / 0.18) : 1, fade = age > 1.35 ? 1 - (age - 1.35) / 0.25 : 1;
    let bx = Math.round(ax - bw / 2), by = Math.round(ay - bh - 6 * s - (1 - pop) * 6);
    bx = Math.max(L.safeL + 4, Math.min(W - L.safeR - bw - 4, bx));
    by = Math.max(L.safeT + 4, Math.min(H - L.safeB - bh - 36, by));
    alpha(fade, () => {
      R(bx + 2, by + 2, bw, bh, 'rgba(0,0,0,0.18)');
      R(bx - 1, by + 1, bw + 2, bh - 2, INK_); R(bx + 1, by - 1, bw - 2, bh + 2, INK_);
      R(bx, by + 1, bw, bh - 2, '#ffffff'); R(bx + 1, by, bw - 2, bh, '#ffffff');
      const tx = Math.max(bx + 4, Math.min(bx + bw - 8, Math.round(ax))), ty = by + bh;
      for (let k = 0; k < 4; k++) { R(tx - (3 - k) - 1, ty + k - 1, Math.max(1, 2 * (3 - k)) + 2, 1, INK_); if (k < 3) R(tx - (3 - k), ty + k - 1, 2 * (3 - k), 1, '#ffffff'); }
      text(word, bx + 3 * s, by + 3 * s, s, WORD_C[word] || INK_);
    });
  }
  function heart(cx, cy, r, c) { circle(cx - r / 2, cy - r / 3, r / 2 + 0.5, c); circle(cx + r / 2, cy - r / 3, r / 2 + 0.5, c); for (let k = 0; k <= r; k++) R(cx - r + k, cy - r / 3 + k, 2 * (r - k) + 1, 1, c); }

  /* ---------- sounds and a little tune ---------- */
  const SOUND = {
    'WOOF!'() { tone('square', 330, 0, 0.09, 0.08, 220); noise(0, 0.08, 0.05, 900, 1); },
    'RUFF!'() { tone('square', 280, 0, 0.08, 0.07, 200); tone('square', 300, 0.14, 0.08, 0.07, 210); },
    'AWOO!'() { tone('sine', 440, 0, 0.35, 0.08, 660); tone('sine', 660, 0.35, 0.9, 0.08, 520); },
    'HOO HOO!'() { tone('sine', 392, 0, 0.25, 0.09, 370); tone('sine', 392, 0.4, 0.35, 0.09, 350); },
    '?'() { tone('sine', 600, 0, 0.18, 0.06, 900); },
    'ROAR!'() { tone('sawtooth', 110, 0, 0.9, 0.08, 80); noise(0, 0.9, 0.06, 300, 0.8); },
    'HSSS!'() { noise(0, 0.8, 0.07, 5000, 1.2); },
    'SPLASH!'() { noise(0, 0.5, 0.12, 1400, 0.7); },
    'CRUNCH!'() { for (let i = 0; i < 4; i++) noise(i * 0.09, 0.06, 0.1, 2200, 1.5); },
    'YUM!'() { [523, 659, 784].forEach((f, i) => tone('sine', f, i * 0.09, 0.2, 0.07)); },
    'WOW!'() { [659, 784, 988, 1319].forEach((f, i) => tone('sine', f, i * 0.07, 0.25, 0.06)); },
    'BRRR!'() { for (let i = 0; i < 6; i++) tone('square', 180 + (i % 2) * 20, i * 0.05, 0.05, 0.04); },
  };
  const NOTE = { C: 523, D: 587, E: 659, F: 698, G: 784, A: 880, c: 1047, g: 392, a: 440 };
  const TUNE = 'C.E.G.E.F.A.G...E.G.c.G.A.F.E...'.split('');   // a bouncy hiking tune, one beat per character
  const BEAT = 0.2;
  function tuneTick() {
    const i = Math.floor(st.t / BEAT);
    if (i === st.beat || st.t > END - 2.5) return;
    st.beat = i;
    const ch = TUNE[i % TUNE.length];
    if (NOTE[ch]) tone('triangle', NOTE[ch] / 2, 0, BEAT * 0.9, 0.035);
    if (i % 4 === 0) tone('triangle', (i % 32 < 16 ? 131 : 175), 0, BEAT * 1.6, 0.03);
  }

  /* ---------- the shots (seconds) ---------- */
  // dogs' paths during the walking shots: x along the trail
  const walk = (t, a, b, x0, x1) => lerp(x0, x1, seg(t, a, b));
  const step = () => Math.floor(T * 10) % 2;
  const SHOTS = [
    { a: 0, b: 3.6, sky: 'day', // 1. the trailhead: the Vizsla points at the forest, the husky howls
      cam() { setCam(4, -18, 120, 90); },
      world(t) {
        cloudRow(0.8, -80); hills(-34, 16, 0.02, 4, '#8ab89a', 0.7); pineRow(-26, 16, 20, 34, '#2f6a3a', '#3f7a44', 0.3, 3);
        fill(-8, '#6aa84a', 0); trail(0, 14); fill(14, '#5a9a42'); strokes(15, vis().y1, '#4a8a3a', 0.12, 4); fore(16, 'forest', 4);
        R(46, -26, 2, 26, '#7a5a3a'); R(36, -32, 22, 10, '#a87a4a'); R(37, -31, 20, 8, '#c99a5a');
        for (let k = 0; k < 6; k++) R(40 + k, -25 - k, 12 - 2 * k, 1, '#5a8a5a'); R(54, -28, 3, 3, '#5a3a22');
        vizsla(4, 8, 1, 1, { pose: t > 0.6 ? 'point' : 'stand' });
        husky(-34, 10, 1, 1, { pose: t > 1.6 && t < 3 ? 'howl' : 'stand', pant: t < 1.6 || t >= 3, wag: true });
      },
      words: [[1.7, 'AWOO!', () => [-22, -50]]],
    },
    { a: 3.6, b: 9, sky: 'woods', // 2. trotting through the tall pines
      cam(t) { setCam(walk(t, 3.6, 9, -40, 190) - 10, -16, 170, 100); },
      world(t) {
        forestSet(); rays();
        for (let i = 0; i < 3; i++) A.bird(((T * 26 + i * 110) % 500) - 100, -66 + i * 10, 1, T + i, '#3a4a3a');
        const x = walk(t, 3.6, 9, -40, 190);
        husky(x - 44, 9, 1, 1, { run: true, step: step(), pant: true, wag: true, hop: Math.abs(Math.sin(T * 10)) });
        vizsla(x, 8, 1, 1, { run: true, step: 1 - step(), wag: true, hop: Math.abs(Math.sin(T * 10 + 1)) });
      },
    },
    { a: 9, b: 11.6, sky: 'woods', // 3. who's that up in the tree? (looking up at the owl)
      cam() { setCam(0, -60, 70, 66); },
      world(t) {
        const v = vis(); fill(v.y0, '#4a7a52'); for (let i = 0; i < 9; i++) pine(-60 + i * 16, -20 + (i % 3) * 6, 50, '#2a5a34', '#3a6a40');
        R(-70, -40, 140, 4, '#6a4a2e'); R(-70, -40, 140, 1, '#8a6a44'); R(30, -48, 2, 8, '#6a4a2e');
        owl(0, -40, 1, { hoot: t > 9.3 && t < 10.3 && Math.floor(T * 6) % 2, blink: t > 10.6 && t < 10.75, look: t > 10.8 ? 1 : 0 });
      },
      words: [[9.3, 'HOO HOO!', () => [0, -66], true]],
    },
    { a: 11.6, b: 14.3, sky: 'woods', // 4. two puzzled heads tilt
      cam() { setCam(-6, -24, 104, 70); },
      world(t) {
        forestSet();
        R(-80, -64, 160, 4, '#6a4a2e'); owl(26, -64, 1, { look: -1, blink: t > 13.2 && t < 13.35 });
        vizsla(-4, 8, 1, 1, { pose: t > 12 ? 'tilt' : 'stand' });
        husky(-40, 9, 1, 1, { pose: 'stand', pant: true, hop: t > 12.4 && t < 12.7 ? 2 : 0 });
      },
      words: [[12.1, '?', () => [6, -30]], [12.6, '?', () => [-26, -34]]],
    },
    { a: 14.3, b: 16.2, sky: 'woods', // 5. the owl flaps away; the dogs trot on
      cam() { setCam(20, -30, 150, 100); },
      world(t) {
        forestSet();
        const k = seg(t, 14.4, 16.2);
        R(-90, -64, 120, 4, '#6a4a2e');
        owl(26 + k * 160, -64 - k * 50 - Math.sin(k * 9) * 4, 1, { fly: k > 0 });
        const x = walk(t, 14.8, 16.2, -30, 60);
        husky(x - 40, 9, 1, 1, { run: t > 14.8, step: step(), pant: true });
        vizsla(x, 8, 1, 1, { run: t > 14.8, step: 1 - step() });
      },
    },
    { a: 16.2, b: 22.4, sky: 'day', // 6. hopping across the creek; the husky shakes water all over the Vizsla
      stones: [-34, -12, 10, 32],
      hopX(t, t0) {   // hop from stone to stone between t0 and t0 + 2.4
        const st0 = this.stones, k = seg(t, t0, t0 + 2.4) * (st0.length + 1), i = Math.floor(k), f = k - i;
        const from = i === 0 ? -72 : st0[Math.min(i - 1, st0.length - 1)], to = i >= st0.length ? 72 : st0[i];
        return [lerp(from, to, f), i <= st0.length ? Math.sin(f * Math.PI) * 10 : 0];
      },
      cam() { setCam(0, -14, 150, 92); },
      world(t) {
        const v = vis();
        cloudRow(0.6, -70); hills(-40, 14, 0.02, 5, '#8ab89a', 0.5); pineRow(-30, 16, 22, 34, '#2f6a3a', '#3f7a44', 0.3, 5);
        fill(-12, '#6aa84a', 0);
        trail(-2, 12); fill(10, '#6aa84a'); strokes(11, v.y1, '#4a8a3a', 0.12, 6); fore(12, 'forest', 6);
        for (let y = -2; y < v.y1; y++) { const hw = 50 + (y + 2) * 0.12; R(-hw, y, hw * 2, 1, '#4a9ad8'); if (y === -2) R(-hw, y, hw * 2, 2, '#7ab8e8'); }
        R(-52, -3, 3, 4, '#a88a5a'); R(49, -3, 3, 4, '#a88a5a');
        for (let i = 0; i < 26; i++) { const yy = 1 + (i * 7) % 40, hw = 48 + yy * 0.12, x = -hw + ((i * 37 + T * 30) % (hw * 2 - 6)); R(x, yy, 6, 1, '#9ad0f0'); }
        for (const sx0 of this.stones) { ellipse(sx0, 9, 8, 3, '#8a8a92'); ellipse(sx0 - 1, 8, 6, 2, '#aaaab2'); }
        const [hx, hh] = this.hopX(t, 16.4), [vx, vh] = this.hopX(t, 17.3);
        const shaking = t > 20.2 && t < 21.4, jit = shaking ? (Math.floor(T * 30) % 2 ? 1 : -1) : 0;
        vizsla(vx, 6 - vh, 1, 1, { pose: t > 20.4 ? 'tilt' : 'stand', wet: t > 20.4, step: vh > 0 ? 1 : 0 });
        husky(hx + jit, 6 - hh, 1, 1, { pant: !shaking, step: hh > 0 ? 1 : 0, wag: shaking });
      },
      upd(t) {
        if (t > 20.2 && t < 21.4) { const [hx] = this.hopX(t, 16.4); spawn(3, () => ({ x: sx(hx + rand(-12, 12)), y: sy(-14 + rand(-6, 6)), vx: rand(-90, 90), vy: rand(-80, -20), g: 200, life: 0.6, max: 0.6, s: Math.max(1, cam.z), c: Math.random() < 0.5 ? '#8ec8f0' : '#ffffff' })); }
        for (const t0 of [16.4, 17.3]) for (let i = 0; i < 4; i++) { const ti = t0 + 2.4 * (i + 1) / 5; if (t >= ti && t - 1 / 60 < ti) spawn(6, () => ({ x: sx(this.stones[i]), y: sy(6), vx: rand(-40, 40), vy: rand(-60, -20), g: 200, life: 0.5, max: 0.5, s: Math.max(1, cam.z), c: '#bfe6ff' })); }
      },
      words: [[19.2, 'SPLASH!', () => [0, -22]], [20.5, 'RUFF!', () => [40, -36]]],
    },
    { a: 22.4, b: 25.4, sky: 'woods', // 7. the berry bush rustles and up stands a bear: ROAR!
      cam() { setCam(0, -40, 84, 80); },
      world(t) {
        const v = vis(); fill(v.y0, '#4a7a52'); for (let i = 0; i < 8; i++) pine(-70 + i * 20, 0, 60, '#2a5a34', '#3a6a40'); fill(0, '#5a9a42');
        const rise = eout(seg(t, 22.7, 23.3));
        bear(0, lerp(40, 4, rise), 1, 1, { stand: true, roar: t > 23.2 && t < 24.6 });
        const sh = t < 22.8 ? Math.round(Math.sin(T * 40)) : 0;
        for (const [bx, by, r] of [[-26, 2, 12], [-6, 4, 14], [16, 2, 13], [32, 6, 10]]) { circle(bx + sh, by, r, '#3a7a34'); circle(bx - 3 + sh, by - 3, r - 4, '#4a8a3a'); }
        for (let i = 0; i < 12; i++) circle(-30 + hsh(i) * 66 + sh, -4 + hsh(i * 3) * 12, 1, '#5a3aa8');
      },
      words: [[23.2, 'ROAR!', () => [0, -62], true]],
    },
    { a: 25.4, b: 27.6, sky: 'woods', // 8. the dogs leap back, ears up
      cam() { setCam(-10, -16, 110, 72); },
      world(t) {
        forestSet();
        const j = Math.sin(seg(t, 25.5, 26.2) * Math.PI) * 10, back = eout(seg(t, 25.5, 26.2)) * 12;
        vizsla(-10 - back, 8, 1, 1, { hop: j, bark: t > 26.3 && t < 26.8 });
        husky(-44 - back, 9, 1, 1, { hop: j * 0.8, bark: t > 26.6 && t < 27.1 });
        bear(60, 12, -1, 1, {});
      },
      words: [[26.3, 'WOOF!', () => [0, -36]]],
    },
    { a: 27.6, b: 30.6, sky: 'woods', // 9. the bear yawns, waves, and goes back to its berries; the dogs tiptoe past
      cam() { setCam(10, -20, 170, 100); },
      world(t) {
        forestSet();
        const sitting = t > 29.1;
        if (!sitting) bear(40, 12, 1, 1, { stand: true, yawn: t < 28.6, wave: t >= 28.6 });
        else { bear(48, 12, 1, 1, {}); for (let i = 0; i < 5; i++) circle(80 + i * 4, 6 - (i % 2) * 3, 1, '#5a3aa8'); }
        for (const [bx, by, r] of [[78, 6, 10], [92, 8, 8]]) circle(bx, by, r, '#3a7a34');
        const x = walk(t, 28.8, 30.6, -70, 30);
        husky(x - 36, 26, 1, 1, { step: Math.floor(T * 5) % 2, pant: true });
        vizsla(x, 25, 1, 1, { step: Math.floor(T * 5 + 1) % 2 });
      },
    },
    { a: 30.6, b: 33.2, sky: 'day', // 10. up on the rocks: a snake! HSSS!
      cam() { setCam(0, -14, 60, 50); },
      world(t) {
        const v = vis(); hills(-40, 20, 0.03, 6, '#9a9aa8'); fill(-24, '#b0aab0', 0); fill(0, '#c4b89a'); strokes(1, v.y1, '#a89a7a', 0.15, 7);
        for (const [rx, ry, r] of [[-30, 0, 10], [34, 2, 12]]) { ellipse(rx, ry, r, r * 0.6, '#8a8a92'); ellipse(rx - 2, ry - 2, r - 3, r * 0.4, '#a8a8b0'); }
        snake(0, 4, 1, { hiss: t > 31 && t < 32.2, wink: t > 32.6 && t < 32.8 });
      },
      words: [[31, 'HSSS!', () => [6, -28], true]],
    },
    { a: 33.2, b: 37.2, sky: 'day', // 11. the dogs hop back; the snake winks and wiggles away
      cam() { setCam(0, -18, 160, 96); },
      world(t) {
        const v = vis();
        cloudRow(0.6, -76); hills(-40, 22, 0.025, 6, '#9a9aa8', 0.4); fill(-20, '#b0aab0', 0); fill(0, '#c4b89a'); strokes(1, v.y1, '#a89a7a', 0.15, 8);
        for (const [rx, ry, r] of [[-90, -4, 12], [80, -2, 14], [110, 4, 9]]) { ellipse(rx, ry, r, r * 0.6, '#8a8a92'); ellipse(rx - 2, ry - 2, r - 3, r * 0.4, '#a8a8b0'); }
        const k = seg(t, 34.2, 36.4);
        if (k <= 0) snake(10, 14, 1, { wink: t > 33.8 && t < 34 });
        else snake(10 + k * 140, 16, 1, { slither: true });
        const back = Math.sin(seg(t, 33.2, 33.8) * Math.PI) * 8, go = walk(t, 35.4, 37.2, 0, 60);
        vizsla(-36 - (t < 33.8 ? back : 0) + go, 12, 1, 1, { hop: t < 33.8 ? back : 0, run: go > 0, step: step() });
        husky(-74 - (t < 33.8 ? back : 0) + go, 13, 1, 1, { hop: t < 33.8 ? back * 0.8 : 0, run: go > 0, step: 1 - step(), pant: true });
      },
    },
    { a: 37.2, b: 44, sky: 'snow', // 12. up the mountain, from the trees through the rocks into the snow
      gy: x => 30 - x * 0.5,
      dogX: t => walk(t, 37.3, 43.8, -110, 230),
      cam(t) { const x = this.dogX(t); setCam(x - 14, this.gy(x) - 18, 150, 100); },
      world(t) {
        const v = vis();
        cloudRow(0.7, -150);
        for (const [px, h, c] of [[-60, 120, '#a8b4c8'], [80, 150, '#9aa8bc'], [230, 130, '#a8b4c8']]) {   // far peaks
          const ox = px + cam.cx * 0.6, base = -20 + cam.cx * 0.1;
          for (let k = 0; k < h; k++) { R(ox - k * 0.9, base - h + k, k * 1.8 + 1, 1, k < h * 0.25 ? '#f4f6fa' : c); }
        }
        for (let x = v.x0 - (v.x0 % 2); x < v.x1; x += 2) {
          const top = Math.round(this.gy(x));
          // grass low down, rock above it, snow up top: layered by height under the slope
          if (top < -50) R(x, top, 2, -50 - top, '#f4f6fa');
          if (top < 10) R(x, Math.max(top, -50), 2, 10 - Math.max(top, -50), '#8a8a96');
          R(x, Math.max(top, 10), 2, v.y1 - Math.max(top, 10), '#5a9a42');
          R(x, top, 2, 2, top > 10 ? '#6aa84a' : top > -50 ? '#a8a8b2' : '#ffffff');
          if (hsh(x) < 0.12) R(x, top + 4 + Math.floor(hsh(x * 3) * 20), 3, 2, top > 10 ? '#4a8a3a' : top > -50 ? '#6a6a76' : '#dce4ee');
        }
        for (let x = -150; x < 80; x += 26) { const top = this.gy(x); if (top > 0) pine(x + 8, top + 3, 20 + (x % 3) * 3, '#2f6a3a', '#3f7a44'); }
        for (let x = 60; x < 200; x += 34) { const top = this.gy(x); ellipse(x, top - 1, 6, 3, '#7a7a86'); ellipse(x - 1, top - 2, 4, 2, '#9a9aa6'); }
        const x = this.dogX(t), hx = x - 38;
        husky(hx, this.gy(hx) + 2, 1, 1, { run: true, step: step(), pant: true, wag: this.gy(hx) < -50 });
        vizsla(x, this.gy(x) + 2, 1, 1, { run: true, step: 1 - step(), wag: true });
      },
    },
    { a: 44, b: 48.4, sky: 'snow', // 13. the snowy top: the husky plays in the snow, the Vizsla shivers, then spots something!
      cam() { setCam(0, -24, 130, 84); },
      world(t) {
        const v = vis(); cloudRow(0.5, -70);
        hills(-30, 24, 0.03, 7, '#c8d4e4'); fill(-10, '#f4f6fa'); for (let i = 0; i < 40; i++) R(v.x0 + hsh(i) * (v.x1 - v.x0), -8 + hsh(i * 3) * 30, 3, 1, '#dce4ee'); fore(14, 'snow', 7);
        const play = t < 46.6, hop = play ? Math.abs(Math.sin(T * 8)) * 8 : 0, hx = play ? Math.sin(T * 3) * 20 - 20 : -24;
        husky(hx, 10, play ? (Math.cos(T * 3) > 0 ? 1 : -1) : 1, 1, { hop, pant: true, wag: true, run: play, step: step() });
        const shiver = t < 46 ? (Math.floor(T * 24) % 2) : 0;
        vizsla(22 + shiver, 9, 1, 1, { pose: t > 46.8 ? 'point' : 'stand' });
      },
      upd(t) { if (t < 46.6 && Math.random() < 0.5) spawn(2, () => ({ x: sx(Math.sin(T * 3) * 20 - 20 + rand(-8, 8)), y: sy(10), vx: rand(-40, 40), vy: rand(-60, -20), g: 120, life: 0.6, max: 0.6, s: Math.max(1, cam.z), c: '#ffffff' })); },
      words: [[45.2, 'BRRR!', () => [24, -38]], [47.2, 'WOW!', () => [30, -40], true]],
    },
    { a: 48.4, b: 52.6, sky: 'dusk', // 14. far below in the meadow: a GIANT bone! Down they race
      cam(t) { const x = walk(t, 49.4, 52.6, -150, 60); setCam(t < 49.6 ? 110 : Math.min(90, x - 12), -16, 150, 100); },
      world(t) {
        const v = vis();
        hills(-44, 26, 0.02, 8, '#c49a7a', 0.5); hills(-30, 14, 0.03, 9, '#8aa86a', 0.3);
        fill(-20, '#8ab85a'); strokes(-18, v.y1, '#6a9a4a', 0.12, 9); fore(18, 'meadow', 9);
        for (let i = 0; i < 16; i++) { const fx = -150 + i * 22, fy = -10 + (i % 4) * 9; R(fx, fy, 2, 2, ['#ffd21f', '#ff6fb4', '#ffffff'][i % 3]); }
        bone(110, 6, 70, true);
        const x = walk(t, 49.4, 52.6, -150, 60);
        husky(x - 40, 14, 1, 1, { run: true, step: step(), pant: true, hop: Math.abs(Math.sin(T * 12)) * 3 });
        vizsla(x, 12, 1, 1, { run: true, step: 1 - step(), hop: Math.abs(Math.sin(T * 12 + 1)) * 3 });
      },
      upd(t) { if (Math.random() < 0.3) sparkle(sx(110), sy(-8), 40 * cam.z / 2, 1, '#fff6b0'); },
    },
    { a: 52.6, b: 60, sky: 'dusk', // 15. chomp! both ends of the giant bone, tails wagging, as the sun goes down
      cam(t) { const k = eout(seg(t, 56.6, 59)); setCam(0, -14 - k * 10, lerp(110, 190, k), lerp(64, 110, k)); },
      world(t) {
        const v = vis();
        circle(0, -40, 22, '#ffd27a'); circle(0, -40, 18, '#ffe6a0');
        hills(-30, 16, 0.03, 9, '#c49a7a'); fill(-16, '#8ab85a'); strokes(-14, v.y1, '#6a9a4a', 0.12, 10); fore(14, 'meadow', 10);
        bone(0, 6, 40, false);
        const chomp = Math.floor(T * 5) % 2;
        vizsla(-32, 10 - chomp, 1, 1, { pose: 'chew', wag: true });
        husky(32, 11 - (1 - chomp), -1, 1, { pose: 'chew', wag: true });
      },
      upd(t) { if (Math.random() < 0.08) st.hearts.push({ x: rand(W * 0.3, W * 0.7), y: sy(-24), vy: -rand(14, 24) * cam.z, life: 1.6, r: Math.max(4, Math.round(cam.z * 3)) }); },
      words: [[53.2, 'CRUNCH!', () => [-18, -26]], [54.8, 'CRUNCH!', () => [18, -26]], [57, 'YUM!', () => [0, -34], true]],
    },
  ];

  /* ---------- scene plumbing (with pause and a draggable timeline) ---------- */
  const st = { t: 0, done: false, fired: {}, saved: null, paused: false, ui: 0, drag: null, beat: -1, hearts: [] };
  const shotAt = t => { for (let i = 0; i < SHOTS.length; i++) if (t < SHOTS[i].b) return SHOTS[i]; return SHOTS[SHOTS.length - 1]; };
  function camNow() { const s = shotAt(st.t); s.cam.call(s, st.t); return s; }
  function seek(t) { st.t = Math.max(0, Math.min(END - 0.05, t)); st.fired = {}; parts = []; st.hearts = []; camNow(); }
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
      for (const s of SHOTS) { const tx = Math.round(x0 + w * s.a / END); R(tx, y - 3, 1, 7, '#cfc8dc'); }
      const kx = Math.round(x0 + w * Math.min(1, st.t / END));
      R(x0, y - 1, kx - x0, 3, '#ffd21f'); circle(kx, y, 5, '#ffffff'); circle(kx, y, 3, '#ffd21f');
      const b = c.play, mx = b.x + b.s / 2, my = b.y + b.s / 2;
      alpha(0.55, () => R(b.x, b.y, b.s, b.s, BLACK)); R(b.x + 1, b.y + 1, b.s - 2, 1, 'rgba(255,255,255,0.25)');
      if (st.paused) for (let i = 0; i < 6; i++) R(mx - 3 + i, my - 6 + i, 1, 13 - 2 * i, '#ffffff');
      else { R(mx - 5, my - 6, 4, 13, '#ffffff'); R(mx + 1, my - 6, 4, 13, '#ffffff'); }
    });
  }
  function iris(k, cx, cy) {
    if (k >= 1) return;
    const rad = ease(clamp01(k)) * Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - cy;
      if (Math.abs(dy) >= rad) { R(0, y, W, 1, BLACK); continue; }
      const dx = Math.sqrt(rad * rad - dy * dy);
      if (cx - dx > 0) R(0, y, cx - dx, 1, BLACK);
      if (cx + dx < W) R(cx + dx, y, W - cx - dx, 1, BLACK);
    }
  }
  function homeBtn() { const s = 24; return { x: L.safeL + 8, y: H - L.safeB - s - 12, s }; }
  function finish() { if (st.done) return; st.done = true; goScene(SCENES.movies ? 'movies' : 'station', { watched: 'dogs' }); }

  SCENES.movieDogs = {
    noWeather: true,
    view: [186, 200],
    freeTouch: true,
    cover(x, yb) { husky(x + 8, yb - 1, 1, 1, { pant: true }); vizsla(x + 38, yb - 1, 1, 1, {}); },
    layout() {},
    enter() { Object.assign(st, { t: 0, done: false, fired: {}, paused: false, ui: 0, drag: null, beat: -1, hearts: [] }); if (!st.saved) st.saved = clouds; clouds = []; },
    leave() { if (st.saved) { clouds = st.saved; st.saved = null; } },
    update(dt) {
      if (st.done) return;
      st.ui = Math.max(0, st.ui - dt);
      if (st.paused || st.drag != null) { camNow(); return; }
      st.t += dt;
      const s = camNow();
      tuneTick();
      for (const sh of SHOTS) (sh.words || []).forEach(([wt, word], i) => { const key = sh.a + ':' + i; if (st.t >= wt && st.t < wt + 0.3 && !st.fired[key]) { st.fired[key] = true; if (SOUND[word]) SOUND[word](); } });
      if (s.upd) s.upd.call(s, st.t);
      for (const h of st.hearts) { h.life -= dt; h.y += h.vy * dt; }
      st.hearts = st.hearts.filter(h => h.life > 0);
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
      for (const h of st.hearts) alpha(Math.min(1, h.life), () => heart(Math.round(h.x), Math.round(h.y), h.r, '#e8222b'));
      drawParticles();
    },
    drawUI() {
      for (const s of SHOTS) (s.words || []).forEach(([wt, word, at, big]) => {
        const age = st.t - wt;
        if (age < 0 || age > 1.6 || shotAt(st.t) !== s) return;
        const [wx, wy] = at(st.t); bubble(word, sx(wx), sy(wy), age, big);
      });
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
    _st: st, _jump(t) { seek(t); }, _spr: { vizsla, husky, owl, bear, snake },
  };
})();
