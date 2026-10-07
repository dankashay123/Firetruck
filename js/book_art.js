// Pixel-art cast for the "Little Blue Truck" sing-along cartoon: the blue pickup, the big
// yellow dump truck and the farm animals, plus a few props. Every sprite is drawn with a pen
// in sprite units: (x, yb) is the bottom center, dir 1 faces right, s is an integer scale.
'use strict';
const BOOK = (() => {
  function pen(x, yb, w, dir = 1, s = 1) {
    const bx = Math.round(x - w * s / 2), by = Math.round(yb);
    const P = (dx, dy, ww, hh, c) => R(dir > 0 ? bx + dx * s : bx + (w - dx - ww) * s, by + dy * s, ww * s, hh * s, c);
    P.c = (dx, dy, r, c) => circle(dir > 0 ? bx + dx * s : bx + (w - dx) * s, by + dy * s, r * s, c);
    return P;
  }
  const hsh = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const MUD = ['#7a4a24', '#6a3a1a', '#8a5a2e'];
  function splat(P, x0, y0, w, h, n, seed) {   // mud freckles over a body
    for (let i = 0; i < n; i++) P(x0 + Math.floor(hsh(seed + i) * w), y0 + Math.floor(hsh(seed + i * 7.3) * h), 1 + (i % 3 === 0), 1, MUD[i % 3]);
  }
  // an eye that can look happy, wide, worried or shut; (cx, cy) center, r radius
  function eye(P, cx, cy, r, mood = 'happy', look = 1) {
    if (mood === 'shut') { P(cx - r, cy, 2 * r + 1, 1, INK); return; }
    P.c(cx, cy, r, '#ffffff');
    const pr = Math.max(1, r - 1 - (mood === 'wide' ? 1 : 0));
    P(cx - (pr >> 1) + (look > 0 ? 1 : 0), cy - (pr >> 1), pr, pr, INK);
    if (r >= 3) P(cx + (look > 0 ? 1 : 0), cy - (pr >> 1), 1, 1, '#ffffff');
    if (mood === 'happy') P(cx - r, cy - r - 1, 2 * r + 1, 1, INK);
    if (mood === 'worried') { P(cx - r, cy - r - 1, r, 1, INK); P(cx, cy - r - 2, r + 1, 1, INK); }
    if (mood === 'cross') { P(cx - r, cy - r - 2, r, 1, INK); P(cx, cy - r - 1, r + 1, 1, INK); }
  }

  /* ---------- Little Blue ---------- */
  const B1 = '#4a7fd6', B2 = '#6f9cec', B3 = '#2f5aa8', B4 = '#1f3d78';
  function tire(P, cx, cy, r, spin) {
    P.c(cx, cy, r, '#1d1a2b'); P.c(cx, cy, r - 2, '#d8dde3'); P.c(cx, cy, Math.max(1, r - 4), '#aab3bd');
    const a = spin || 0;
    P(cx + Math.round(Math.cos(a) * (r - 2)), cy + Math.round(Math.sin(a) * (r - 2)), 1, 1, '#1d1a2b');
  }
  // side view, 46 long: { mood, mud, spin, bounce, look }
  function blue(x, yb, dir = 1, s = 1, o = {}) {
    const P = pen(x, yb - (o.bounce || 0) * s, 46, dir, s);
    P(1, -18, 22, 2, B3); P(1, -17, 21, 9, B1); P(1, -16, 21, 2, B2); P(1, -9, 21, 1, B3);   // the bed
    P(22, -26, 12, 18, B1); P(22, -27, 11, 2, B3); P(24, -24, 8, 7, GLASS); P(25, -23, 1, 4, '#ffffff');   // cab and window
    P(22, -16, 1, 8, B3); P(29, -14, 2, 1, B4);
    P(34, -17, 10, 9, B1); P(34, -17, 10, 2, B2); P(43, -16, 2, 8, B3); P(45, -15, 1, 6, '#cfd6dd');   // hood, nose, grille
    P(39, -21, 1, 4, '#aab3bd');
    P.c(9, -8, 6, B3); P.c(37, -8, 6, B3); P(3, -8, 40, 2, B4);   // fenders and running board
    tire(P, 9, -5, 5, o.spin); tire(P, 37, -5, 5, o.spin);
    eye(P, 41, -13, 3, o.mood || 'happy', 1);
    P(43, -8, 4, 2, '#aab3bd');
    if (o.mud) splat(P, 1, -26, 44, 20, Math.round(40 * o.mud), 3);
  }
  // head-on, 34 wide: { mood, mud, look, toad }
  function blueFront(x, yb, s = 1, o = {}) {
    const P = pen(x, yb, 34, 1, s);
    P(8, -31, 18, 2, B3); P(7, -29, 20, 13, B1); P(9, -27, 7, 7, GLASS); P(18, -27, 7, 7, GLASS); P(10, -26, 1, 3, '#ffffff'); P(19, -26, 1, 3, '#ffffff');
    P(0, -16, 9, 9, B3); P(25, -16, 9, 9, B3); P(1, -15, 7, 4, B2); P(26, -15, 7, 4, B2);   // round fenders
    P(8, -17, 18, 10, B1); P(14, -16, 6, 9, '#cfd6dd'); for (let i = 0; i < 3; i++) P(15 + i * 2, -15, 1, 7, '#8a939d');
    eye(P, 8, -12, 3, o.mood || 'happy', o.look || 0); eye(P, 26, -12, 3, o.mood || 'happy', o.look || 0);
    P(4, -7, 26, 2, '#aab3bd'); P(2, -6, 6, 6, '#1d1a2b'); P(26, -6, 6, 6, '#1d1a2b');
    if (o.mud) splat(P, 1, -30, 32, 24, Math.round(30 * o.mud), 9);
  }
  // from behind, 34 wide; riders() draws the passengers between the cab and the tailgate
  function blueRear(x, yb, s = 1, riders, o = {}) {
    const P = pen(x, yb, 34, 1, s);
    P(9, -30, 16, 2, B3); P(8, -28, 18, 9, B1); P(11, -26, 12, 5, GLASS);
    if (riders) riders(P);
    P(0, -15, 8, 8, B3); P(26, -15, 8, 8, B3);
    P(3, -20, 28, 13, B1); P(3, -20, 28, 2, B2); P(5, -17, 24, 8, B3); P(6, -16, 22, 6, B1); P.c(17, -13, 2, B2);
    P(3, -18, 2, 3, '#e8222b'); P(29, -18, 2, 3, '#e8222b');
    P(2, -7, 30, 2, '#aab3bd'); P(4, -6, 6, 6, '#1d1a2b'); P(24, -6, 6, 6, '#1d1a2b');
    if (o.mud) splat(P, 2, -28, 30, 22, Math.round(30 * o.mud), 21);
  }

  /* ---------- the Dump ---------- */
  const Y1 = '#f2b51c', Y2 = '#ffd34d', Y3 = '#c98a10', Y4 = '#8a5a08', GR = ['#8a8680', '#b5b0a8', '#5a5650', '#a39e96'];
  function gravel(P, x0, y0, w, seed) {   // a lumpy heap of gravel sitting on y0
    for (let i = 0; i < w; i += 2) { const h = Math.round(3 + 3 * Math.sin((i / w) * Math.PI) + hsh(seed + i) * 2); P(x0 + i, y0 - h, 2, h, GR[0]); }
    for (let i = 0; i < w * 1.2; i++) P(x0 + Math.floor(hsh(seed + i * 3.1) * w), y0 - 1 - Math.floor(hsh(seed + i * 5.7) * 5 * Math.sin(hsh(seed + i * 3.1) * Math.PI)), 1, 1, GR[1 + i % 3]);
  }
  // side view, 82 long: { mood, mud, spin, shake }
  function dump(x, yb, dir = 1, s = 1, o = {}) {
    const P = pen(x + (o.shake || 0) * s, yb, 82, dir, s);
    gravel(P, 2, -37, 46, 5);
    P(0, -38, 51, 3, Y3); P(1, -35, 49, 21, Y1); P(1, -35, 49, 2, Y2);
    for (const rx of [12, 25, 38]) { P(rx, -33, 2, 19, Y3); P(rx + 2, -33, 1, 19, Y2); }
    P(2, -15, 47, 2, Y3);
    P(50, -48, 2, 34, '#8a8680'); P(49, -49, 4, 2, '#5a5650');   // exhaust stack
    P(53, -36, 15, 3, Y3); P(53, -33, 15, 21, Y1); P(55, -31, 11, 9, GLASS); P(56, -30, 1, 6, '#ffffff'); P(53, -20, 15, 1, Y3);
    for (let i = 0; i < 3; i++) P(55 + i * 4, -38, 2, 2, '#f57a12');
    P(68, -26, 12, 14, Y1); P(68, -26, 12, 2, Y2); P(79, -24, 3, 11, '#5a5650'); P(79, -22, 3, 1, '#8a8680'); P(79, -19, 3, 1, '#8a8680'); P(79, -16, 3, 1, '#8a8680');
    P(0, -14, 82, 3, '#3a3d46');
    for (const wx of [13, 29, 70]) tire(P, wx, -7, 7, o.spin);
    eye(P, 75, -20, 3, o.mood || 'cross', 1);
    P(77, -12, 6, 3, '#9aa3ad');
    if (o.mud) splat(P, 0, -36, 82, 30, Math.round(70 * o.mud), 13);
  }
  // head-on, 66 wide; the split windshield is his eyes
  function dumpFront(x, yb, s = 1, o = {}) {
    const P = pen(x + (o.shake || 0) * s, yb, 66, 1, s), mood = o.mood || 'cross';
    gravel(P, 6, -56, 54, 8);
    P(3, -58, 60, 3, Y3); P(5, -55, 56, 8, Y1);
    P(-3, -46, 3, 14, '#8a8680'); P(66, -46, 3, 14, '#8a8680'); P(-5, -44, 3, 9, '#5a5650'); P(68, -44, 3, 9, '#5a5650');   // mirrors
    P(12, -48, 42, 24, Y1); P(12, -48, 42, 2, Y2);
    for (let i = 0; i < 4; i++) P(20 + i * 7, -51, 3, 2, '#f57a12');
    for (const [wx, look] of [[14, 1], [35, -1]]) {   // windshield eyes
      P(wx, -45, 17, 13, '#4a4f5c'); P(wx + 1, -44, 15, 11, '#e8ecef');
      if (mood === 'shut') P(wx + 2, -38, 13, 1, INK);
      else {
        const lid = mood === 'worried' ? 4 : mood === 'cross' ? 5 : mood === 'sleepy' ? 6 : 0;
        P(wx + 6 + look, -41, 5, 6, INK); P(wx + 7 + look, -40, 1, 1, '#ffffff');
        if (lid) P(wx + 1, -44, 15, lid, Y1);
        if (mood === 'worried') { P(wx + (look > 0 ? 9 : 1), -44 + lid, 6, 1, Y3); }
        if (mood === 'cross') P(wx + (look > 0 ? 1 : 9), -44 + lid, 6, 1, Y3);
      }
    }
    P(2, -30, 14, 16, Y1); P(50, -30, 14, 16, Y1); P(2, -30, 14, 2, Y2); P(50, -30, 14, 2, Y2);
    P(17, -28, 32, 16, '#3a3d46'); for (let i = 0; i < 6; i++) P(18, -27 + i * 2 + 1, 30, 1, '#6a6e78');
    P.c(9, -22, 4, '#e8ecef'); P.c(57, -22, 4, '#e8ecef'); P.c(9, -22, 2, '#fff6c8'); P.c(57, -22, 2, '#fff6c8');
    P(0, -13, 66, 5, '#9aa3ad'); for (let i = 0; i < 8; i++) P(4 + i * 8, -11, 1, 1, '#5a5650');
    P(4, -8, 11, 8, '#1d1a2b'); P(51, -8, 11, 8, '#1d1a2b');
    if (o.mud) splat(P, 0, -50, 66, 44, Math.round(60 * o.mud), 17);
  }
  // seen from behind: the tall tailgate and the twin rear wheels, 60 wide
  function dumpRear(x, yb, s = 1, o = {}) {
    const P = pen(x + (o.shake || 0) * s, yb, 60, 1, s);
    gravel(P, 4, -54, 52, 11);
    P(2, -56, 56, 3, Y3); P(4, -53, 52, 38, Y1); P(4, -53, 52, 2, Y2); P(8, -48, 44, 28, Y3); P(10, -46, 40, 24, Y1);
    P(2, -15, 56, 4, '#3a3d46'); P(4, -12, 4, 3, '#e8222b'); P(52, -12, 4, 3, '#e8222b');
    for (const wx of [2, 12, 40, 50]) { P(wx, -11, 8, 11, '#1d1a2b'); P(wx + 2, -9, 4, 7, '#3a3d46'); }
    if (o.mud) splat(P, 2, -54, 56, 52, Math.round(80 * o.mud), 29);
  }
  // seen from above (pointing right), 32 x 14, cached so it can be turned with crisp pixels
  let topCv = null;
  function dumpTop(x, y, ang, s = 1) {
    if (!topCv) {
      topCv = document.createElement('canvas'); topCv.width = 34; topCv.height = 18;
      const prev = g; g = topCv.getContext('2d');
      const P = (dx, dy, w, h, c) => R(dx + 1, dy + 2, w, h, c);
      for (const wx of [4, 9, 25]) { P(wx, -1, 4, 2, '#1d1a2b'); P(wx, 13, 4, 2, '#1d1a2b'); }
      P(0, 0, 21, 14, Y3); P(1, 1, 19, 12, GR[0]);
      for (let i = 0; i < 60; i++) P(1 + Math.floor(hsh(i) * 19), 1 + Math.floor(hsh(i * 2.7) * 12), 1, 1, GR[1 + i % 3]);
      P(21, 1, 8, 12, Y1); P(22, 2, 6, 10, Y2); P(26, 2, 2, 10, '#4a4f5c'); P(29, 2, 3, 10, Y1); P(31, 3, 1, 8, '#5a5650');
      g = prev;
    }
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(ang); g.imageSmoothingEnabled = false;
    g.drawImage(topCv, -17 * s, -9 * s, 34 * s, 18 * s); g.restore();
  }

  /* ---------- farm animals ---------- */
  // o: { step (0/1 walking), hop, mouth (open), mud, mood, flap, run }
  function legs(P, xs, top, h, c, o, hoof) {
    xs.forEach((lx, i) => {
      let dy = 0, dx = 0;
      if (o.run) { const k = (i + (o.step || 0)) % 2; dx = k ? 1 : -1; dy = k ? -1 : 0; }
      else if (o.step && i % 2) dy = -1;
      P(lx + dx, top, 2 + (h > 8), h + dy, c);
      if (hoof) P(lx + dx, top + h + dy - 1, 2 + (h > 8), 1, hoof);
    });
  }
  function cow(x, yb, dir = 1, s = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0) * s, 34, dir, s), C1 = '#a8622e', C2 = '#c47e44', C3 = '#7a4220', PK = '#f0a8a0';
    legs(P, [5, 9, 20, 24], -10, 10, C3, o, '#3a2a20');
    P(3, -21, 24, 12, C1); P(3, -21, 24, 2, C2); P(5, -10, 20, 1, C3); P(13, -10, 5, 2, PK);
    P(1, -20, 2, 1, C3); P(0, -19, 1, 8, C3); P(-1, -12, 3, 3, '#3a2a20');
    P(25, -24, 7, 9, C1); P(25, -24, 7, 1, C2); P(29, -19, 5, 5, PK); P(32, -18, 1, 1, '#a0605a');
    P(23, -24, 3, 2, C3); P(26, -26, 1, 2, '#f2ead0'); P(30, -26, 1, 2, '#f2ead0');
    eye(P, 28, -21, 1, o.mood || 'open', 1);
    if (o.mouth) P(30, -15, 4, 2, '#7a3a30');
    P(24, -17, 2, 5, '#3a2a20'); P(24, -12, 3, 3, '#ffd21f');
    if (o.mud) splat(P, 3, -24, 30, 14, 14, 41);
  }
  function horse(x, yb, dir = 1, s = 1, o = {}) {
    const rear = o.rear || 0;   // 0..1 rearing up
    const P = pen(x, yb - (o.hop || 0) * s, 36, dir, s), H1 = '#9a3a22', H2 = '#b85a3a', H3 = '#6a2414', MN = '#2a1a14';
    legs(P, [5, 9], -12, 12, H3, o, MN);
    if (rear > 0.3) { P(25, -19, 3, 7, H3); P(28, -20, 3, 7, H3); P(27, -13, 3, 2, MN); P(30, -14, 3, 2, MN); }
    else legs(P, [21, 25], -12, 12, H3, o, MN);
    const ry = Math.round(rear * 4);
    P(3, -23, 25, 12, H1); P(3, -23, 25, 2, H2); P(20, -23 - ry, 8, 12, H1);
    P(23, -31 - ry, 7, 10, H1); P(24, -31 - ry, 4, 2, H2);
    P(26, -35 - ry, 9, 6, H1); P(32, -33 - ry, 4, 4, H2); P(35, -32 - ry, 1, 1, '#4a1a10');
    P(25, -37 - ry, 2, 3, H3); P(28, -37 - ry, 2, 2, H3);
    eye(P, 29, -33 - ry, 1, o.mood || 'open', 1);
    if (o.mouth) P(32, -29 - ry, 4, 2, '#4a1a10');
    P(22, -35 - ry, 3, 14, MN); P(20, -26 - ry, 2, 5, MN);
    P(0, -22, 3, 2, MN); P(-1, -20, 3, 10, MN);
    if (o.mud) splat(P, 3, -36, 32, 26, 16, 47);
  }
  function sheep(x, yb, dir = 1, s = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0) * s, 24, dir, s), W1 = '#f4f1e8', W2 = '#d6cfbd', F = '#e8dcc4';
    legs(P, [5, 8, 14, 17], -6, 6, '#5a5248', o);
    P(2, -14, 17, 8, W1);
    for (const [cx, cy] of [[4, -13], [8, -15], [12, -15], [16, -14], [3, -9], [18, -9], [10, -11]]) P.c(cx, cy, 3, W1);
    P(3, -7, 16, 1, W2); P(5, -12, 1, 1, W2); P(13, -13, 1, 1, W2); P(9, -9, 1, 1, W2);
    P(18, -16, 5, 7, F); P(17, -16, 2, 2, '#c9b89a'); P(22, -12, 2, 2, '#c9a58a'); P(18, -17, 3, 2, W1);
    eye(P, 20, -14, 1, o.mood || 'open', 1);
    if (o.mouth) P(21, -10, 2, 1, '#7a5a4a');
    if (o.mud) splat(P, 2, -17, 20, 11, 10, 53);
  }
  function goat(x, yb, dir = 1, s = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0) * s, 22, dir, s), G1 = '#e8d2a8', G2 = '#f6e8cc', G3 = '#b8956a', SPOT = '#a8784a', HN = '#7a746c';
    if (o.tuck) { P(5, -8, 4, 2, G3); P(13, -8, 4, 2, G3); }
    else legs(P, [4, 7, 13, 16], -8, 8, G3, o, '#5a4a3a');
    P(3, -15, 15, 8, G1); P(3, -15, 15, 1, G2); P(4, -8, 13, 1, G3); P(7, -14, 5, 4, SPOT); P(8, -10, 3, 1, SPOT);
    P(2, -18, 2, 3, G1); P(1, -19, 2, 2, G2);
    P(15, -19, 4, 6, G1); P(16, -23, 6, 5, G1); P(20, -21, 3, 3, G2); P(22, -20, 1, 1, '#8a6a5a'); P(16, -23, 2, 2, SPOT);
    P(16, -25, 2, 2, HN); P(15, -26, 2, 1, HN); P(13, -26, 2, 1, HN); P(12, -25, 1, 2, HN);   // horns curling back
    P(18, -25, 1, 2, '#9a948c'); P(17, -26, 1, 1, '#9a948c');
    P(14, -21, 2, 2, G3); P(12, -20, 3, 1, G3);   // floppy ear
    eye(P, 19, -21, 1, o.mood || 'open', 1);
    if (o.mouth) P(20, -18, 3, 1, '#7a5a4a');
    P(19, -17, 2, 3, '#f6ecd8'); P(20, -14, 1, 2, '#f6ecd8');
    if (o.mud) splat(P, 3, -20, 18, 12, 10, 59);
  }
  function pig(x, yb, dir = 1, s = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0) * s, 20, dir, s), P1 = '#f2a2a8', P2 = '#f8c2c6', P3 = '#d07a84';
    legs(P, [3, 6, 11, 14], -4, 4, P3, o);
    P(2, -11, 14, 7, P1); P(3, -12, 12, 1, P1); P(3, -11, 12, 1, P2);
    P(5, -9, 2, 2, P3); P(10, -8, 2, 2, P3);
    P(14, -13, 5, 7, P1); P(18, -11, 2, 4, P3); P(19, -10, 1, 1, '#a04a54'); P(19, -8, 1, 1, '#a04a54');
    P(14, -15, 2, 2, P3); P(16, -14, 1, 1, P3);
    eye(P, 16, -11, 1, o.mood || 'open', 1);
    if (o.mouth) P(17, -7, 2, 1, '#a04a54');
    P(0, -11, 2, 1, P3); P(0, -13, 1, 2, P3); P(1, -13, 1, 1, P3);
    if (o.mud) splat(P, 2, -14, 17, 9, 8, 61);
  }
  function hen(x, yb, dir = 1, s = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0) * s, 14, dir, s), K = '#2a2a33';
    legs(P, [5, 8], -3, 3, '#f08a20', o);
    P(2, -9, 9, 6, K); P(3, -10, 7, 1, K); P(0, -13, 3, 6, K); P(1, -14, 1, 1, K);
    P(4, -7, 1, 1, '#ffffff'); P(7, -6, 1, 1, '#ffffff'); P(3, -5, 1, 1, '#ffffff'); P(8, -8, 1, 1, '#ffffff');
    if (o.flap) { P(3, -13 + (o.flap > 0 ? 0 : 3), 6, 3, '#45454f'); } else P(4, -8, 5, 2, '#45454f');
    P(9, -14, 4, 5, K); P(10, -16, 3, 2, '#e8222b'); P(12, -10, 1, 2, '#e8222b'); P(13, -13, 2, 1, '#ffb020');
    P(11, -13, 1, 1, '#ffd21f');
    if (o.mouth) P(13, -12, 2, 1, '#ffb020');
  }
  function chick(x, yb, dir = 1, s = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0) * s, 8, dir, s);
    P(1, -5, 5, 4, '#ffd21f'); P(4, -8, 3, 3, '#ffd21f'); P(1, -3, 4, 1, '#e0b010'); P(7, -7, 1, 1, '#f57a12');
    P(5, -7, 1, 1, INK); P(2, -1, 1, 1, '#f08a20'); P(4, -1, 1, 1, '#f08a20');
    if (o.flap) P(1, -6, 2, 2, '#ffe873');
  }
  function duck(x, yb, dir = 1, s = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0) * s, 14, dir, s), Wd = '#f6f6f2', S = '#d8dce0', BK = '#f5a020';
    legs(P, [5, 7], -2, 2, BK, o);
    P(1, -8, 10, 6, Wd); P(0, -9, 2, 2, Wd); P(2, -3, 8, 1, S);
    if (o.flap) { const up = o.flap > 0; P(2, up ? -13 : -6, 6, up ? 5 : 3, up ? Wd : S); P(3, up ? -13 : -4, 4, 1, S); }
    else P(3, -7, 6, 2, S);
    P(8, -12, 3, 5, Wd); P(8, -15, 5, 4, Wd); P(12, -13, 3, 2, BK);
    if (o.mouth) P(12, -11, 3, 1, '#d07010');
    eye(P, 10, -14, 1, o.mood || 'open', 1);
  }
  // the big green toad, facing us: { wink, flex, grin, hop, legsOut }
  function toad(x, yb, s = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0) * s, 18, 1, s), T1 = '#7aa83c', T2 = '#9cc85a', T3 = '#4e7424', SP = '#3e5a1e', BL = '#d8d890';
    if (o.legsOut) { P(1, -4, 4, 5, T3); P(13, -4, 4, 5, T3); P(0, 0, 5, 2, T3); P(13, 0, 5, 2, T3); }
    else { P(0, -7, 5, 7, T3); P(13, -7, 5, 7, T3); P(-1, -1, 6, 1, T3); P(13, -1, 6, 1, T3); }
    P(3, -12, 12, 12, T1); P(6, -9, 6, 8, BL); P(4, -10, 2, 2, SP); P(13, -11, 2, 2, SP); P(4, -5, 1, 2, SP); P(14, -4, 1, 2, SP);
    P(3, -16, 12, 6, T1); P.c(5, -16, 3, T1); P.c(13, -16, 3, T1); P(7, -15, 1, 1, SP); P(10, -14, 2, 1, SP);
    eye(P, 5, -17, 2, 'open', 0);
    if (o.wink) { P(11, -19, 5, 4, T1); P(11, -17, 5, 1, T3); } else eye(P, 13, -17, 2, 'open', 0);
    if (o.grin) { P(5, -12, 9, 2, '#2a3a14'); P(6, -12, 7, 1, '#ffffff'); }
    else { P(5, -12, 9, 1, T3); P(4, -13, 1, 1, T3); P(14, -13, 1, 1, T3); }
    if (o.croak) P.c(9, -9, 3, '#e8e8a8');
    if (o.flex) {   // both arms up, showing his muscles
      P(-2, -14, 5, 3, T1); P(-3, -19, 3, 6, T1); P(-4, -21, 4, 3, T2); P(-1, -15, 3, 2, T2);
      P(15, -14, 5, 3, T1); P(18, -19, 3, 6, T1); P(18, -21, 4, 3, T2); P(16, -15, 3, 2, T2);
    } else { P(5, -6, 2, 6, T2); P(11, -6, 2, 6, T2); P(4, -1, 3, 1, T2); P(11, -1, 3, 1, T2); }
  }
  function bird(x, y, s = 1, t = 0, c = '#3a3d46') {   // a little flying bird
    const P = pen(x, y, 9, 1, s), up = Math.floor(t * 8) % 2;
    P(3, 0, 3, 1, c); P(4, -1, 1, 1, c);
    if (up) { P(0, -2, 3, 1, c); P(6, -2, 3, 1, c); P(2, -1, 1, 1, c); P(6, -1, 1, 1, c); }
    else { P(0, 1, 3, 1, c); P(6, 1, 3, 1, c); P(2, 0, 1, 1, c); P(6, 0, 1, 1, c); }
  }
  function crow(x, yb, dir = 1, s = 1) {
    const P = pen(x, yb, 10, dir, s), K = '#2a2d36';
    P(1, -5, 6, 4, K); P(0, -6, 2, 2, K); P(6, -7, 3, 3, K); P(9, -6, 2, 1, '#5a5650'); P(7, -6, 1, 1, '#ffffff'); P(3, -1, 1, 1, K); P(5, -1, 1, 1, K);
  }

  // card art for the cinema: Blue with the goat and the toad riding in the back
  function cover(x, yb) {
    toad(x + 5, yb - 13, 1, {});
    goat(x + 14, yb - 15, 1, 1, { tuck: true });
    blue(x + 23, yb, 1, 1, { mood: 'happy' });
  }

  return { pen, hsh, splat, eye, blue, blueFront, blueRear, dump, dumpFront, dumpRear, dumpTop, cow, horse, sheep, goat, pig, hen, chick, duck, toad, bird, crow, cover, gravel, MUD, Y: [Y1, Y2, Y3, Y4], B: [B1, B2, B3, B4] };
})();
