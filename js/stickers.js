// "Sticker Board": free play. Drag stickers from the tray onto a big picture, tap them to make
// them do their thing, drag them back to the tray to take them off. Everything is unlocked.
// Boards are saved per picture so his work is still there next time.
'use strict';
(() => {
  const STORE = 'firestation.stickers';
  const PAD = 3;            // room around each sprite for the white outline and little wiggles
  const FLY = 0.35;         // seconds a tapped tray sticker flies to the picture
  const MAX_ON_BOARD = 80;
  const G = { x0: 0, y0: 0, x1: 100, y1: 100, pw: 100, ph: 100, hy: 50 };   // picture area
  const Y = {};             // tray / button layout
  let bg = 0, page = 0, trayOff = 0;
  let boards = [];   // one list of stickers per picture (filled once BG is known)
  let ptr = null;           // the one finger we follow
  let hold = null;          // clean-up button being held
  let sirenStop = null, sirenT = 0;
  let flash = 0;            // white flash when the picture changes
  let geo = [];             // per-background scenery, rebuilt in layout()

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

  /* ---------- little drawing helpers ---------- */
  // Rows of characters → pixels; '.' is transparent, other characters look up pal.
  function bmp(x, y, rows, pal) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length;) {
        const ch = row[c];
        if (ch === '.') { c++; continue; }
        let e = c; while (e < row.length && row[e] === ch) e++;
        R(x + c, y + r, e - c, 1, pal[ch]);
        c = e;
      }
    }
  }
  function ellipse(cx, cy, rx, ry, c) {
    for (let dy = -ry; dy <= ry; dy++) {
      const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
      R(cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }

  /* ---------- sticker sprites ---------- */
  const STAR = ['.....a.....', '....aca....', '....aca....', 'aaaaaaaaaab', '.aaeaaaeab.', '..aaaaaaa..', '..aaeeeab..', '.aaaab.aab.', '.aab...aab.', 'aab.....abb'];
  const HEART = ['.aa...aa.', 'acaa.aaaa', 'acaaaaaaa', 'aaaaaaaaa', '.aaaaaaab', '..aaaaab.', '...aaab..', '....ab...'];
  const BALLOON = ['..aaaaa..', '.aaaaaaa.', 'acwaaaaaa', 'acaaaaaaa', 'aaaaaaaaa', 'aaaaaaaab', '.aaaaaab.', '..aaaab..', '...abb...', '...bbb...'];
  const BELL = ['.....bb.....', '....aaaa....', '...acaaaa...', '...acaaaa...', '..acaaaaab..', '..acaaaaab..', '..aaaaaaab..', '.aaaaaaaaab.', 'bbbbbbbbbbbb'];
  const FLOWER = ['...aaa...', '.aaaaaaa.', '.aacccaa.', 'aaacccaaa', '.aacccaa.', '.aaaaaaa.', '...aaa...', '....g....', '....g....', '.gg.g....', '..ggg....', '....g.gg.', '....ggg..', '....g....', '....g....', '...ddd...'];
  const CONE = ['....aa....', '....aa....', '...aaaa...', '...wwww...', '...wwww...', '..aaaaaa..', '..aaaaaa..', '..wwwwww..', '.aaaaaaaa.', '.aaaaaaaa.', '.aaaaaaaa.', 'bbbbbbbbbb', 'bbbbbbbbbb'];
  const HYDRANT = ['....dd....', '...aaaa...', '..aaaaab..', '.dddddddd.', '..acaaab..', 'ddacaaabdd', 'ddacyyabdd', 'ddacyyabdd', '..acaaab..', '..acaaab..', '..acaaab..', '..acaaab..', '.dddddddd.', 'dddddddddd'];
  const DOG = ['.........bb.....', '........bbaaa...', '........baaeaa..', '........baaaaccc', '.........aaaacce', '..aaaaaarraaa...', '..abbaaaaaaaa...', '..aaaaaaaaaaa...', '..aa.aa...aa.aa.', '..bb.bb...bb.bb.'];
  const DOG_PAL = { a: '#c98a4b', b: '#8a5a2a', c: '#ecd0a4', e: INK, r: '#e8222b' };

  function heliSprite(x, y, a) {
    const c = COLOR.red.c, DK = '#3a3d46', spin = Math.floor(T * (a.on ? 30 : 18)) % 2;
    y += a.on ? -Math.round(Math.abs(Math.sin(a.t * 5)) * 3) : 0;
    R(x + (spin ? 6 : 13), y, spin ? 34 : 20, 1, DK); R(x + 22, y + 1, 2, 3, DK);
    R(x, y + 3, 3, 6, c[1]); R(x, y + 7, 15, 3, c[1]); R(x + (spin ? -1 : 1) + 1, y + 4 + (spin ? 0 : 2), 1, 3, DK);
    R(x + 14, y + 4, 18, 10, c[1]); R(x + 12, y + 6, 22, 7, c[1]); R(x + 32, y + 7, 4, 5, c[1]);
    R(x + 14, y + 4, 18, 1, c[0]); R(x + 12, y + 12, 24, 1, c[2]);
    R(x + 26, y + 5, 8, 5, GLASS); R(x + 27, y + 6, 2, 1, '#ffffff');
    R(x + 12, y + 10, 24, 1, '#f4f7fb');
    R(x + 16, y + 13, 1, 4, DK); R(x + 29, y + 13, 1, 4, DK); R(x + 12, y + 17, 24, 1, DK);
    if (a.on && Math.floor(T * 6) % 2) R(x + 1, y + 2, 2, 1, RED_ON);
  }
  function rainbow(x, y) {
    const cx = x + 20, cy = y + 21, cols = ['#e8222b', '#f57a12', '#ffd21f', '#3fb43a', '#2a6fe0', '#8a4fd9'];
    for (let dy = 0; dy <= 20; dy++) {
      cols.forEach((c, i) => {
        const ro = 20 - 2 * i, ri = ro - 2;
        if (dy >= ro) return;
        const xo = Math.round(Math.sqrt(ro * ro - dy * dy)), xi = dy < ri ? Math.round(Math.sqrt(ri * ri - dy * dy)) : 0;
        if (xo > xi) { R(cx - xo, cy - dy, xo - xi, 1, c); R(cx + xi + 1, cy - dy, xo - xi, 1, c); }
        if (!xi) R(cx, cy - dy, 1, 1, c);
      });
    }
    for (const [dx, sgn] of [[4, 1], [36, -1]]) {
      circle(x + dx, y + 20, 4, '#dcebf5'); circle(x + dx + 4 * sgn, y + 21, 3, '#dcebf5');
      circle(x + dx, y + 19, 4, '#ffffff'); circle(x + dx + 4 * sgn, y + 20, 3, '#ffffff');
    }
  }
  function cloudSprite(x, y, a) {
    const dy = a.on ? Math.round(Math.sin(a.t * 9)) : 0;
    y += dy;
    const sh = a.on ? '#b9c4d6' : '#dcebf5', top = a.on ? '#e3e9f2' : '#ffffff';
    circle(x + 7, y + 10, 6, sh); circle(x + 15, y + 7, 7, sh); circle(x + 23, y + 10, 6, sh); R(x + 4, y + 10, 23, 6, sh);
    circle(x + 7, y + 9, 5, top); circle(x + 15, y + 6, 6, top); circle(x + 22, y + 9, 5, top); R(x + 5, y + 9, 20, 5, top);
    R(x + 11, y + 9, 1, 1, INK); R(x + 18, y + 9, 1, 1, INK); R(x + 13, y + 11, 4, 1, '#c78a9a');
  }
  function sunSprite(x, y, a) {
    const cx = x + 13, cy = y + 13, spin = T * (a.on ? 4 : 0.6);
    for (let k = 0; k < 8; k++) {
      const an = k * Math.PI / 4 + spin;
      for (let d = 9; d < 12; d++) R(cx + Math.round(Math.cos(an) * d) - 1, cy + Math.round(Math.sin(an) * d) - 1, 2, 2, '#ffb21f');
    }
    circle(cx, cy, 8, '#ffd21f'); circle(cx - 2, cy - 2, 5, '#ffe873');
    R(cx - 3, cy - 2, 1, 2, '#7a4a10'); R(cx + 2, cy - 2, 1, 2, '#7a4a10');
    R(cx - 2, cy + 3, 4, 1, '#7a4a10'); R(cx - 3, cy + 2, 1, 1, '#7a4a10'); R(cx + 2, cy + 2, 1, 1, '#7a4a10');
    R(cx - 6, cy + 1, 2, 1, '#ff9c6b'); R(cx + 4, cy + 1, 2, 1, '#ff9c6b');
  }
  function houseSprite(x, y, a) {
    R(x + 21, y + 2, 4, 7, '#8e3b2a');
    for (let k = 0; k <= 10; k++) { const l = 14 - Math.round(k * 1.4); R(x + l, y + k, 30 - 2 * l, 1, k % 2 ? '#a3473a' : '#b5523b'); }
    R(x + 2, y + 11, 26, 19, '#f2d16b'); R(x + 2, y + 11, 26, 1, '#d9b24f'); R(x + 2, y + 11, 2, 19, '#e0bd57');
    const win = a.on || nightK() > 0.5 ? '#ffe873' : GLASS;
    for (const wx of [4, 21]) { R(x + wx, y + 15, 6, 6, '#ffffff'); R(x + wx + 1, y + 16, 4, 4, win); R(x + wx + 2, y + 16, 1, 4, '#ffffff'); }
    if (a.on) {   // door swings open and someone waves hello
      R(x + 12, y + 18, 7, 12, '#3a2a22'); R(x + 12, y + 18, 2, 12, '#9c6a48');
      R(x + 14, y + 20, 4, 4, SKIN[1]); R(x + 15, y + 21, 1, 1, INK); R(x + 14, y + 24, 5, 6, '#3fb4a8');
      R(x + 18, y + (Math.floor(T * 6) % 2 ? 19 : 21), 1, 3, SKIN[1]);
    } else {
      R(x + 12, y + 18, 7, 12, '#8a5a3a'); R(x + 13, y + 19, 5, 4, '#9c6a48'); R(x + 17, y + 24, 1, 1, '#ffd21f');
    }
    R(x + 11, y + 29, 9, 1, '#b5ae9f');
  }
  function ladderSprite(x, y, a) {
    for (const rx of [1, 9]) { R(x + rx, y, 2, 34, '#cfd6dd'); R(x + rx + 1, y, 1, 34, '#8b96a1'); }
    for (let k = 0; k < 7; k++) { const lit = a.on && Math.floor(a.t * 8) >= 6 - k; R(x + 3, y + 2 + k * 5, 6, 2, lit ? '#ffd21f' : '#d5dce3'); }
    R(x, y + 33, 4, 1, '#6b7480'); R(x + 8, y + 33, 4, 1, '#6b7480');
  }

  /* ---------- trains (after the Choo Choo Train game) ---------- */
  const IRON = '#1d1a2b', DKT = '#2f3240';
  const bar = (...a) => TOY.bar(...a);
  const eio = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  // a value that eases through keyframes [[t, v0, v1, ...], ...] at time t
  function keys(K, t) {
    if (t <= K[0][0]) return K[0].slice(1);
    for (let i = 1; i < K.length; i++) if (t < K[i][0]) {
      const k = eio((t - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
      return K[i].slice(1).map((v, j) => K[i - 1][j + 1] + (v - K[i - 1][j + 1]) * k);
    }
    return K[K.length - 1].slice(1);
  }
  function trainWheel(cx, cy, r, c, a) {
    circle(cx, cy, r, IRON); circle(cx, cy, r - 1, c);
    const sp = r >= 5 ? 4 : 2;
    for (let i = 0; i < sp; i++) { const b = a + i * Math.PI / sp; for (let d = -r + 2; d <= r - 2; d++) R(Math.round(cx + Math.cos(b) * d), Math.round(cy + Math.sin(b) * d), 1, 1, IRON); }
    circle(cx, cy, Math.max(1, r - 4), '#ffd21f');
  }
  const ENGINE_C = { main: '#e8222b', dark: '#a3121d', light: '#ff6b5e', trim: '#ffd21f' };
  function engineSprite(x, y, a) {   // 54 x 40, the steam engine from the train game
    const C = ENGINE_C, on = a.on, toot = on && a.t < 1.4, wa = on ? a.t * 9 : 0;
    x += 2; const yb = y + 40 + (on && Math.floor(T * 9) % 2 ? -1 : 0);
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy, w, h, c);
    P(2, -12, 46, 3, DKT);
    P(40, -13, 9, 6, '#5a5f6e'); P(40, -13, 9, 1, '#7a8090');
    for (let i = 0; i < 8; i++) P(47 + Math.floor(i * 0.6), -9 + i, 5 - Math.floor(i * 0.6), 1, i % 2 ? C.dark : '#e8222b');
    P(48, -10, 3, 2, DKT);
    P(0, -34, 17, 23, C.main); P(0, -34, 17, 2, C.light); P(-2, -37, 21, 3, DKT); P(-1, -38, 19, 1, '#5a5f6e');
    P(3, -30, 10, 9, IRON); P(4, -29, 8, 7, GLASS);
    P(5, -25, 6, 4, SKIN[1]); P(9, -24, 1, 1, INK); P(10, -22, 1, 1, '#a3121d');
    P(4, -28, 8, 3, '#3a5aa8'); P(5, -28, 1, 3, '#ffffff'); P(8, -28, 1, 3, '#ffffff'); P(11, -26, 3, 1, '#3a5aa8');
    if (toot) { const up = Math.floor(T * 8) % 2; P(12, -30 + up, 2, 5, '#3a5aa8'); P(12, -32 + up, 2, 2, SKIN[1]); }
    P(0, -13, 17, 2, C.trim); P(2, -18, 13, 1, C.dark);
    P(17, -28, 26, 16, C.main); P(17, -28, 26, 2, C.light); P(17, -14, 26, 2, C.dark);
    P(23, -28, 2, 16, C.trim); P(34, -28, 2, 16, C.trim);
    P(27, -32, 6, 4, C.trim); P(28, -33, 4, 1, C.trim); P(28, -32, 1, 2, '#fff3a6');
    const sw = on ? Math.round(Math.sin(T * 18) * 1.5) : 0;
    P(19, -30, 1, 2, DKT); P(18 + sw, -33, 3, 3, '#ffd21f'); P(17 + sw, -31, 5, 1, '#e0b010');
    P(43, -29, 6, 18, '#3a3d46'); P(43, -29, 6, 1, '#5a5f6e'); P(47, -23, 1, 1, '#cfd6dd');
    P(44, -34, 6, 5, DKT); P(45, -33, 4, 3, '#fff3a6'); P(46, -33, 2, 1, '#ffffff');
    P(36, -36, 5, 8, DKT); P(34, -39, 9, 3, DKT); P(35, -39, 7, 1, '#5a5f6e');
    if (toot) P(31, -31, 2, 3, '#ffd21f');
    trainWheel(x + 8, yb - 4, 4, C.dark, wa * 1.5);
    trainWheel(x + 20, yb - 6, 6, C.dark, wa);
    trainWheel(x + 33, yb - 6, 6, C.dark, wa);
    trainWheel(x + 45, yb - 3, 3, C.dark, wa * 2);
    const cx = Math.cos(wa) * 3.5, cy = Math.sin(wa) * 3.5;
    R(Math.round(x + 20 + cx), Math.round(yb - 7 + cy), 14, 2, '#cfd6dd');
    bar(x + 33 + cx, yb - 6 + cy, x + 42, yb - 10, 2, '#cfd6dd');
  }
  const RIDERS = [{ type: 'kid', skin: SKIN[1] }, { type: 'cat' }, { type: 'gran', skin: SKIN[0] }];
  function coachSprite(x, y, a) {   // 47 x 35, a blue passenger coach with friends at the windows
    const on = a.on, C = { main: '#2a6fe0', dark: '#1a3f9a', trim: '#ffd21f' };
    x += 1; const yb = y + 35;
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy, w, h, c);
    P(0, -30, 44, 22, C.main); P(1, -27, 42, 11, '#fff2d8'); P(0, -14, 44, 2, C.trim);
    P(-1, -33, 46, 3, '#5a5f6e'); P(1, -34, 42, 1, '#5a5f6e'); P(1, -33, 42, 1, '#7a8090');
    for (let w = 0; w < 3; w++) {
      const wx = x + 5 + w * 13, wy = yb - 26, p = RIDERS[w];
      const hop = on && (Math.floor(a.t * 6) + w) % 2 ? 2 : 0;
      R(wx - 1, wy - 1, 12, 11, C.dark); R(wx, wy, 10, 9, GLASS);
      g.save(); g.beginPath(); g.rect(wx, wy, 10, 9); g.clip();
      if (p.type === 'cat') PETS.catSit(wx + 5, wy + 18 - hop, { meow: on });
      else drawPerson({ type: p.type, x: wx + 5, yb: wy + 1 + personH(p.type) - hop, dir: 1, pose: on ? 'wave' : 'stand', skin: p.skin, seed: 3 + w });
      g.restore();
      R(wx, wy, 3, 1, '#ffffff');
    }
    P(2, -8, 40, 2, DKT);
    for (const wx of [7, 14, 30, 37]) trainWheel(x + wx, yb - 3, 3, '#3a3d46', 0);
  }
  function cabooseSprite(x, y, a) {   // 36 x 40, the little red caboose with its lantern
    const on = a.on, C1 = '#c8432f', C2 = '#9a2a1d';
    x += 3; const yb = y + 40;
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy, w, h, c);
    P(0, -29, 32, 21, C1); P(0, -29, 32, 2, '#e0644a'); P(0, -12, 32, 2, '#ffd21f');
    P(10, -37, 12, 8, C1); P(9, -39, 14, 2, DKT); P(13, -35, 6, 4, GLASS);
    if (on) { P(15, -34, 3, 3, SKIN[2]); P(14, -35, 5, 1, '#3a5aa8'); P(19, -36 + (Math.floor(T * 8) % 2), 1, 2, SKIN[2]); }
    P(-1, -31, 34, 2, DKT);
    P(5, -25, 7, 7, C2); P(6, -24, 5, 5, GLASS); P(20, -25, 7, 7, C2); P(21, -24, 5, 5, GLASS);
    P(-3, -18, 3, 1, DKT); P(-3, -22, 1, 5, DKT);
    const sw = on ? Math.round(Math.sin(a.t * 10)) : 0;
    P(-2 + sw, -27, 3, 4, Math.floor(T * (on ? 8 : 2)) % 2 ? '#ff3b3b' : '#8c2a2a'); P(-1 + sw, -28, 1, 1, DKT);
    P(2, -8, 28, 2, DKT);
    for (const wx of [7, 25]) trainWheel(x + wx, yb - 3, 3, '#3a3d46', 0);
  }

  /* ---------- boats (after Fireboat Rescue) ---------- */
  function water(x, y, w, h) {   // a strip of sea with little moving wave tops
    R(x, y, w, h, '#3f95d4'); R(x, y, w, 1, '#7ac0f0');
    const o = Math.floor(T * 4) % 6;
    for (let k = -6; k < w; k += 6) if (k + o >= 0 && k + o + 2 <= w) R(x + k + o, y + 1 + ((k / 6) & 1), 2, 1, '#bfe6ff');
  }
  const HULL = ['#ff7a6b', '#e8222b', '#e8222b', '#e8222b', '#f4f7fb', '#e8222b', '#c81a24', '#c81a24', '#a3121d', '#a3121d'];
  function fireboatSprite(x, y, a) {   // 61 x 43, the red fireboat on a strip of sea
    const on = a.on, bob = Math.round(Math.sin(T * (on ? 6 : 2) + a.seed));
    const x0 = x + 29, yb = y + 40 + bob, ph = Math.floor(T * 6) % 2, fw = Math.floor(T * 5) % 2;
    const P = (dx, dy, w, h, c) => R(x0 + dx, yb + dy, w, h, c);
    P(-5, -39, 1, 15, '#5a5e6a'); P(-4, -39, 6 + fw, 2, '#ffd21f'); P(-4, -37, 5 + (1 - fw), 2, '#e8222b');
    P(-7, -24, 18, 14, '#f4f7fb'); P(-7, -24, 18, 1, '#ffffff'); P(-7, -11, 18, 1, '#cfd8e2'); P(10, -22, 1, 12, '#cfd8e2');
    P(-5, -21, 5, 5, GLASS); P(-4, -20, 1, 2, '#ffffff'); P(2, -21, 6, 5, GLASS); P(9, -21, 1, 5, GLASS2);
    P(4, -20, 3, 3, SKIN[0]); P(3, -21, 5, 1, '#e8222b'); P(4, -22, 3, 1, '#e8222b'); P(6, -19, 1, 1, INK); P(3, -17, 5, 1, '#d8b04f');
    P(-9, -26, 22, 2, '#e8222b'); P(-9, -26, 22, 1, '#ff7a6b');
    P(-3, -28, 4, 2, on && ph ? RED_ON : RED_OFF); P(1, -28, 2, 2, '#ffffff'); P(3, -28, 4, 2, on && !ph ? RED_ON : RED_OFF);
    for (let r = 0; r < 10; r++) { const l = -28 + Math.round(r * 0.3), rr = 31 - Math.max(0, r - 2); P(l, -10 + r, rr - l, 1, HULL[r]); }
    P(16, -13, 16, 1, '#ff7a6b'); P(16, -12, 16, 2, '#e8222b'); P(31, -13, 1, 3, '#ff7a6b');
    for (const px of [-20, -12, 22]) { P(px, -5, 2, 2, GLASS); P(px, -5, 1, 1, '#ffffff'); }
    P(-27, -14, 43, 1, '#f4f7fb'); for (let px = -27; px < 16; px += 5) P(px, -14, 1, 4, '#f4f7fb');
    P(-26, -15, 5, 5, '#ffffff'); P(-25, -14, 3, 3, '#e8222b'); P(-24, -13, 1, 1, '#c81a24');
    const cx = x0 + 21, cy = yb - 15, an = on ? -0.75 + Math.sin(a.t * 5) * 0.2 : -0.6;
    P(18, -15, 6, 3, '#c99410'); P(19, -16, 4, 1, '#ffd21f');
    bar(cx, cy, cx + Math.cos(an) * 8, cy + Math.sin(an) * 8, 4, '#ffd21f', true);
    bar(cx + Math.cos(an) * 7, cy + Math.sin(an) * 7, cx + Math.cos(an) * 11, cy + Math.sin(an) * 11, 3, '#9aa3ad');
    water(x, y + 39, 61, 4);
  }
  function sailboatSprite(x, y, a) {   // 22 x 25
    const on = a.on, bob = Math.round(Math.sin(T * (on ? 7 : 2) + a.seed));
    const sway = on ? Math.round(Math.sin(a.t * 9) * 1.4) : 0, yb = y + 21 + bob, fw = Math.floor(T * 5) % 2;
    R(x + 10 + sway, yb - 21, 1, 18, '#8a6a4a');
    R(x + 11 + sway, yb - 21, 4 + fw, 2, '#2a6fe0');
    for (let k = 0; k < 14; k++) { const w = Math.round((k + 1) * 0.62); R(x + 11 + sway, yb - 18 + k, w, 1, '#ffffff'); if (w > 2) R(x + 10 + w + sway, yb - 18 + k, 1, 1, '#dfe6ee'); }
    R(x + 11 + sway, yb - 11, 5, 1, '#e8222b');
    for (let k = 0; k < 11; k++) { const w = Math.round((k + 1) * 0.5); R(x + 10 - w + sway, yb - 15 + k, w, 1, '#ffd21f'); }
    R(x + 1, yb - 4, 20, 2, '#2a6fe0'); R(x + 1, yb - 4, 20, 1, '#6aa2ff'); R(x + 2, yb - 2, 18, 1, '#1a3f9a'); R(x + 3, yb - 1, 16, 1, '#1a3f9a');
    R(x + 6, yb - 3, 1, 1, '#ffffff'); R(x + 14, yb - 3, 1, 1, '#ffffff');
    water(x, y + 21, 22, 4);
  }
  function duckRingSprite(x, y, a) {   // 16 x 14, a duckling paddling in a swim ring
    const on = a.on, bob = on ? Math.round(Math.abs(Math.sin(a.t * 9)) * -2) : Math.round(Math.sin(T * 2 + a.seed));
    const yy = y + bob, Yl = '#ffd21f', Ys = '#e0b010';
    ellipse(x + 8, yy + 9, 7, 2, '#ffffff'); R(x + 1, yy + 8, 3, 2, '#e8222b'); R(x + 12, yy + 8, 3, 2, '#e8222b');
    ellipse(x + 8, yy + 9, 4, 1, '#2f7ab8');
    R(x + 4, yy + 4, 7, 5, Yl); R(x + 3, yy + 5, 2, 2, Yl); R(x + 5, yy + 6, 3, 2, Ys);
    R(x + 8, yy + 0, 4, 4, Yl); R(x + 9, yy - 1, 2, 1, Yl); R(x + 12, yy + 2, 2, 1, '#f57a12'); R(x + 10, yy + 1, 1, 1, INK);
    if (on) R(x + 12, yy + 3, 2, 1, '#d07010');
    for (let dx = -7; dx <= 7; dx++) { const dy = Math.round(Math.sqrt(Math.max(0, 1 - (dx / 7.5) ** 2)) * 2); R(x + 8 + dx, yy + 9, 1, dy + 1, Math.abs(dx) > 4 || Math.abs(dx) < 2 ? '#e8222b' : '#ffffff'); }
    R(x + 3, yy + 11, 10, 1, 'rgba(0,0,0,0.12)');
    water(x, y + 11, 16, 3);
  }

  /* ---------- work trucks (after Dig & Dump and Garbage Day) ---------- */
  const Y1 = '#f2b51c', Y2 = '#ffd34d', Y3 = '#c98a10', Y4 = '#8a5a08';
  const DIG_K = [[0, 52, 33, 0], [0.45, 56, 42, 0], [0.8, 45, 41, 0], [1.3, 47, 10, 0], [1.55, 47, 10, 1], [2.0, 47, 10, 1], [2.4, 52, 33, 0]];
  function diggerSprite(x, y, a) {   // 62 x 46
    const on = a.on, yb = y + 46, t = on ? a.t : 9;
    const [tx, ty, tip] = on ? keys(DIG_K, t) : [52, 33, 0];
    const carry = on && t > 0.75 && t < 1.6;
    // tracks
    circle(x + 6, yb - 5, 5, '#2a2c33'); circle(x + 34, yb - 5, 5, '#2a2c33'); R(x + 6, yb - 10, 28, 10, '#2a2c33');
    R(x + 6, yb - 8, 28, 6, '#4a4e5a'); circle(x + 6, yb - 5, 2, '#8a939d'); circle(x + 34, yb - 5, 2, '#8a939d');
    for (const rx of [13, 20, 27]) circle(x + rx, yb - 4, 1, '#8a939d');
    const off = on ? Math.floor(T * 12) % 4 : 0;
    for (let k = 0; k < 7; k++) R(x + 6 + ((k * 4 + off) % 28), yb - 10, 2, 1, '#55596a');
    R(x + 9, yb - 13, 24, 3, '#5a5e6a'); R(x + 9, yb - 13, 24, 1, '#8a939d');
    // house, counterweight and cab
    R(x + 1, yb - 23, 3, 9, Y3);
    R(x + 3, yb - 25, 30, 12, Y1); R(x + 3, yb - 25, 30, 1, Y2); R(x + 3, yb - 14, 30, 1, Y3); R(x + 9, yb - 23, 1, 8, Y3);
    R(x + 6, yb - 31, 2, 6, '#5a5650'); R(x + 5, yb - 32, 4, 1, '#3a3d46');
    if (on) for (let k = 0; k < 2; k++) R(x + 6 + ((Math.floor(T * 6) + k) % 2), yb - 35 - k * 2, 2, 2, '#c9ccd3');
    R(x + 17, yb - 41, 16, 2, Y3); R(x + 18, yb - 39, 14, 26, Y1); R(x + 18, yb - 39, 14, 1, Y2);
    R(x + 20, yb - 37, 10, 10, '#4a4f5c'); R(x + 21, yb - 36, 8, 8, GLASS); R(x + 22, yb - 35, 1, 4, '#ffffff');
    TOY.eye(x + 26, yb - 32, 2, 1, 'happy');
    R(x + 23, yb - 44, 4, 3, on && Math.floor(T * 8) % 2 ? '#ffb27a' : '#f57a12');
    // the arm: boom and stick (two-link reach toward the bucket), then the bucket
    const S0 = [x + 32, yb - 22], P1 = [x + tx, y + ty], L1 = 18, L2 = 15;
    const dx = P1[0] - S0[0], dy = P1[1] - S0[1], dd = clamp(Math.hypot(dx, dy), 4, L1 + L2 - 0.5);
    const base = Math.atan2(dy, dx), e = base - Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
    const E = [S0[0] + Math.cos(e) * L1, S0[1] + Math.sin(e) * L1];
    bar(S0[0], S0[1], E[0], E[1], 6, Y4, true); bar(S0[0], S0[1], E[0], E[1], 4, Y1, true);
    bar(E[0], E[1], P1[0], P1[1], 4, Y4, true); bar(E[0], E[1], P1[0], P1[1], 2, Y1, true);
    circle(Math.round(E[0]), Math.round(E[1]), 1, '#8a939d'); circle(S0[0], S0[1], 1, '#8a939d');
    const bx = Math.round(P1[0]), by = Math.round(P1[1]);
    if (tip > 0.5) {   // tipped over: the opening faces down
      R(bx - 2, by, 7, 6, '#3a3d46'); R(bx - 1, by, 5, 5, '#5a5e6a'); for (let k = 0; k < 3; k++) R(bx - 1 + k * 2, by + 6, 1, 1, '#cfd6dd');
    } else {
      R(bx - 2, by - 1, 7, 6, '#3a3d46'); R(bx - 1, by, 5, 5, '#5a5e6a'); R(bx - 1, by, 5, 1, carry ? '#a8764a' : '#2f3240');
      if (carry) { R(bx - 1, by - 2, 5, 2, '#8a5a32'); R(bx, by - 3, 3, 1, '#8a5a32'); }
      for (let k = 0; k < 3; k++) R(bx + 5, by + k * 2, 1, 1, '#cfd6dd');
    }
  }
  const BED = [[0, -26], [34, -26], [36, -28], [37, -28], [37, -2], [0, -2]];
  function dumpSprite(x, y, a) {   // 62 x 40, the big yellow dump truck
    const on = a.on, yb = y + 40, t = on ? a.t : 9;
    const tilt = on ? keys([[0, 0], [0.3, 0], [0.9, 0.72], [1.7, 0.72], [2.3, 0]], t)[0] : 0;
    const fill = on ? (t < 0.9 ? 1 : t < 1.7 ? 1 - (t - 0.9) / 0.8 : 0) : 1;
    const hx = x + 2, hy = yb - 10, TB = pts => TOY.turn(pts, -tilt, 0, 0, hx, hy);
    R(x + 1, yb - 11, 58, 3, '#3a3d46');
    R(x + 39, yb - 32, 2, 22, '#8a8680'); R(x + 38, yb - 33, 4, 1, '#5a5650');
    R(x + 42, yb - 30, 13, 2, Y3); R(x + 42, yb - 28, 13, 17, Y1); R(x + 42, yb - 28, 13, 1, Y2);
    R(x + 44, yb - 26, 9, 7, '#4a4f5c'); R(x + 45, yb - 25, 7, 5, GLASS); R(x + 46, yb - 24, 1, 3, '#ffffff');
    for (let i = 0; i < 3; i++) R(x + 43 + i * 4, yb - 32, 2, 2, on && (Math.floor(T * 8) + i) % 2 ? '#ffb27a' : '#f57a12');
    R(x + 55, yb - 21, 6, 10, Y1); R(x + 55, yb - 21, 6, 1, Y2); R(x + 60, yb - 19, 2, 8, '#5a5650'); R(x + 60, yb - 20, 2, 1, '#fff6c8');
    R(x + 57, yb - 10, 5, 2, '#9aa3ad');
    TOY.eye(x + 48, yb - 16, 2, 1, 'happy'); R(x + 46, yb - 12, 4, 1, Y4);
    if (tilt > 0.02) { const [rb] = TB([[24, -3]]); bar(x + 24, yb - 10, rb[0], rb[1], 2, '#cfd6dd'); }
    if (fill > 0.02) {
      const pts = [];
      for (let k = 1; k <= 35; k += 2) pts.push([k, -26 - (2 + 7 * fill) * Math.sin(Math.PI * k / 36)]);
      pts.push([35, -25], [1, -25]);
      TOY.poly(TB(pts), '#f2d27a');
      for (let i = 0; i < 9 * fill; i++) { const [q] = TB([[4 + (i * 7) % 30, -27 - (i % 3)]]); R(Math.round(q[0]), Math.round(q[1]), 1, 1, i % 2 ? '#c8963e' : '#fff0b8'); }
    }
    TOY.poly(TB(BED), Y4);
    TOY.poly(TB([[1, -25], [35, -25], [36, -27], [36, -3], [1, -3]]), Y1);
    TOY.poly(TB([[1, -25], [35, -25], [35, -24], [1, -24]]), Y2);
    for (const rx of [9, 18, 27]) TOY.poly(TB([[rx, -24], [rx + 2, -24], [rx + 2, -3], [rx, -3]]), Y3);
    for (const wx of [12, 25, 51]) {
      circle(x + wx, yb - 5, 5, '#1d1a2b'); circle(x + wx, yb - 5, 3, '#9aa3ad'); circle(x + wx, yb - 5, 1, '#5a5e6a');
    }
    R(x, yb - 12, 2, 2, '#e8222b');
  }
  const GT1 = '#3fb43a', GT2 = '#5ad04a', GT3 = '#2f8a2c', GT4 = '#1f5a1e';
  function trashBin(x, yb, flip) {   // a green wheelie bin, 11 x 13, bottom center (x, yb); flip: upside down
    const P = (dx, dy, w, h, c) => R(x + dx, flip ? yb - 13 - dy - h : yb + dy, w, h, c);
    P(-5, -11, 11, 11, '#3a8a3a'); P(-5, -11, 11, 1, '#5aaa5a'); P(-4, -7, 9, 1, '#2f6a2e'); P(-4, -4, 9, 1, '#2f6a2e');
    P(-6, -13, 13, 2, '#2f6a2e'); P(-6, -13, 13, 1, '#4a8a48');
    P(-4, -2, 2, 2, '#2f3240'); P(3, -2, 2, 2, '#2f3240');
  }
  function garbageSprite(x, y, a) {   // 66 x 52 (room above for the lifted bin)
    const on = a.on, yb = y + 52, t = on ? a.t : 9;
    R(x + 2, yb - 34, 42, 24, GT1); R(x + 2, yb - 34, 42, 2, GT2); R(x + 2, yb - 12, 42, 2, GT3);
    for (const rx of [12, 22]) { R(x + rx, yb - 32, 2, 20, GT3); R(x + rx + 2, yb - 32, 1, 20, GT2); }
    R(x, yb - 34, 3, 24, GT3); for (let k = 0; k < 4; k++) R(x, yb - 20 + k * 2, 3, 1, k % 2 ? '#e8222b' : '#ffffff');
    R(x + 30, yb - 38, 14, 4, GT4); R(x + 29, yb - 39, 16, 1, GT3);
    if (on && t > 0.6) for (let k = 0; k < 4; k++) R(x + 31 + k * 3, yb - 38 + (k % 2), 2, 1, ['#ffd21f', '#c8945a', '#ffffff', '#2a2a30'][k]);
    R(x + 45, yb - 30, 18, 20, '#f4f7fb'); R(x + 45, yb - 30, 18, 1, '#ffffff'); R(x + 45, yb - 12, 18, 2, '#cfd6dd');
    R(x + 51, yb - 28, 10, 8, '#4a4f5c'); R(x + 52, yb - 27, 8, 6, GLASS);
    R(x + 55, yb - 25, 4, 4, SKIN[1]); R(x + 55, yb - 26, 4, 1, '#f57a12'); R(x + 58, yb - 24, 1, 1, INK);
    if (on) R(x + 59, yb - 27 + (Math.floor(T * 10) % 2), 1, 3, SKIN[1]);
    R(x + 52, yb - 27, 1, 4, '#ffffff');
    R(x + 45, yb - 19, 18, 2, GT1); R(x + 62, yb - 22, 2, 3, '#fff6c8'); R(x + 60, yb - 10, 5, 2, '#9aa3ad');
    R(x + 51, yb - 32, 5, 2, on && Math.floor(T * 8) % 2 ? '#ffb27a' : '#f57a12');
    R(x + 1, yb - 10, 62, 3, '#3a3d46');
    for (const wx of [12, 25, 54]) { circle(x + wx, yb - 5, 5, '#1d1a2b'); circle(x + wx, yb - 5, 3, '#9aa3ad'); circle(x + wx, yb - 5, 1, '#5a5e6a'); }
    // the robot arm and the bin it lifts over the top and tips into the hopper
    const [lx, ly, fl] = on ? keys([[0, 0, 0], [0.55, 1, 0], [0.6, 1, 1], [1.15, 1, 1], [1.2, 1, 0], [1.7, 0, 0]], t) : [0, 0, 0];
    const shake = on && fl > 0.5 ? Math.round(Math.sin(T * 40)) : 0;
    const bx = Math.round(x + 40 - lx * 3 + shake), byb = Math.round(yb - lx * 39);
    const sx = x + 46, sy = yb - 18;
    trashBin(bx, byb, fl > 0.5);
    bar(sx, sy, bx + 6, byb - 7, 3, '#5a5e6a'); R(bx + 5, byb - 10, 3, 6, '#f2b51c');
    circle(sx, sy, 2, '#3a3d46');
  }

  /* ---------- ice cream ---------- */
  function iceTruckSprite(x, y, a) {   // 64 x 50
    const on = a.on, yb = y + 50, bob = on ? Math.round(Math.abs(Math.sin(a.t * 8))) : 0;
    const top = yb - 37;
    R(x + 1, top, 44, 29, '#fff6ea'); R(x + 2, top - 1, 42, 1, '#fff6ea'); R(x + 1, top, 44, 1, '#f2e2cc');
    R(x + 1, yb - 14, 44, 2, '#ff8fb8'); R(x + 1, yb - 12, 44, 1, '#7ad8c0'); R(x + 1, yb - 11, 44, 2, '#ff8fb8');
    R(x + 45, yb - 27, 15, 18, '#ff8fb8'); R(x + 46, yb - 29, 9, 2, '#ff8fb8');
    R(x + 47, yb - 25, 9, 7, GLASS); R(x + 48, yb - 24, 1, 4, '#ffffff'); R(x + 47, yb - 16, 9, 6, '#ffa8c8');
    R(x + 58, yb - 15, 3, 3, '#fff6b0'); R(x + 57, yb - 9, 5, 2, '#cfd6dd');
    // the menu board
    R(x + 3, top + 3, 14, 16, '#5a3a2a'); R(x + 4, top + 4, 12, 14, '#fff2d8');
    for (const [mx, c] of [[5, '#ff8fb8'], [10, '#7ad0ff']]) { R(x + mx + 1, top + 13, 3, 1, '#d9a35a'); R(x + mx + 2, top + 14, 1, 2, '#b07a34'); R(x + mx, top + 9, 5, 4, c); R(x + mx + 1, top + 8, 3, 1, c); }
    // the serving window with the ice cream man
    R(x + 21, top + 6, 20, 13, '#6a4a5a'); R(x + 22, top + 7, 18, 11, '#8a6a7a');
    for (let i = 0; i < 3; i++) R(x + 23 + i * 5, top + 8, 4, 2, ['#ff8fb8', '#8a5230', '#9ef0c8'][i]);
    R(x + 29, top + 10, 6, 5, SKIN[1]); R(x + 29, top + 7, 6, 3, '#ffffff'); R(x + 30, top + 6, 4, 1, '#ffffff');
    R(x + 30, top + 12, 1, 1, INK); R(x + 33, top + 12, 1, 1, INK); R(x + 31, top + 14, 2, 1, '#c84a7a');
    if (on) R(x + 36, top + 9 + (Math.floor(T * 10) % 2), 2, 4, SKIN[1]);
    R(x + 20, top + 18, 22, 2, '#cfd6dd'); R(x + 20, top + 18, 22, 1, '#ffffff');
    for (let i = 0; i < 6; i++) { R(x + 19 + i * 4, top + 2, 4, 3, i % 2 ? '#ffffff' : '#e8222b'); R(x + 20 + i * 4, top + 5, 2, 1, i % 2 ? '#ffffff' : '#e8222b'); }
    // the giant cone on the roof
    const cy = top - 1 - bob;
    for (let r = 0; r < 6; r++) R(x + 30 - (5 - r >> 1) - 1, cy - r, (5 - r >> 1) * 2 + 3, 1, r % 2 ? '#b07a34' : '#d9a35a');
    circle(x + 30, cy - 8, 3, '#ff8fb8'); R(x + 28, cy - 9, 1, 1, '#ffffff');
    R(x + 29, cy - 12, 2, 2, '#e8222b');
    R(x + 8, top - 4, 1, 3, '#9aa3ad'); R(x + 6, top - 6, 5, 2, '#cfd6dd');
    if (on) for (let k = 0; k < 2; k++) R(x + 3 - k * 2, top - 8 - k * 2 + (Math.floor(T * 6) % 2), 2, 2, '#8a4fd9');
    for (const wx of [12, 51]) { circle(x + wx, yb - 5, 5, '#2f3240'); circle(x + wx, yb - 5, 2, '#cfd6dd'); }
  }
  const treatSprite = i => (x, y, a) => {
    const D = SCENES.icecream && SCENES.icecream._treat;
    if (!D) return;
    const wig = a.on ? Math.round(Math.sin(a.t * 18) * Math.max(0, 1 - a.t)) : 0;
    D(i, x + 4 + wig, y + DEFS_H[i], 1);
  };
  const DEFS_H = { 4: 21, 6: 19, 8: 17 };

  /* ---------- animals ---------- */
  const animal = (fn, w, h, ox) => ({ w, h, k: 2, mirror: true,
    draw: (x, y, a) => BOOK[fn](x + ox, y + h, a.dir, 1, { hop: a.on ? Math.round(Math.abs(Math.sin(a.t * 9)) * 2) : 0, mouth: a.on && Math.floor(a.t * 4) % 2 === 0, step: a.on ? Math.floor(T * 8) % 2 : 0 }) });
  function bunnySprite(x, y, a) {   // 16 x 23 (room above for hopping)
    const on = a.on, hop = on ? Math.round(Math.abs(Math.sin(Math.min(a.t, 1.6) * Math.PI * 2.5)) * 6) : 0;
    const yb = y + 23 - hop, B1 = '#f2eee6', B2 = '#d6cfc2', PK = '#f2a8b8';
    const P = (dx, dy, w, h, c) => R(a.dir < 0 ? x + 16 - dx - w : x + dx, yb + dy, w, h, c);
    if (hop > 1) { P(0, -4, 5, 2, B2); P(11, -3, 3, 2, B1); }
    else { P(2, -2, 6, 2, B2); P(10, -2, 2, 2, B1); }
    P(2, -9, 9, 7, B1); P(1, -7, 11, 4, B1); P(3, -3, 8, 1, B2); P(1, -8, 3, 3, '#ffffff');
    P(9, -11, 6, 6, B1); P(10, -12, 4, 1, B1); P(14, -8, 1, 1, '#e87a90'); P(12, -10, 1, 1, INK);
    const ear = on && hop > 2 ? 1 : 0;
    P(9, -17 + ear, 2, 6, B1); P(12, -17, 2, 6, B1); P(12, -16, 1, 4, PK); P(9, -16 + ear, 1, 4, PK);
    P(4, -8, 4, 1, B2);
  }
  function owlSprite(x, y, a) {   // 16 x 22, sitting on a branch
    const on = a.on, flap = on && Math.floor(a.t * 10) % 2, blink = on ? a.t > 0.3 && a.t < 0.45 : Math.floor(T * 0.5 + a.seed) % 7 === 0;
    const look = on ? Math.round(Math.sin(a.t * 6)) : 0, O1 = '#9a6a3a', O2 = '#7a4a20', BL = '#e8d2a8';
    R(x, y + 19, 16, 2, '#8a5a2a'); R(x, y + 19, 16, 1, '#a8743f'); R(x + 13, y + 17, 1, 2, '#8a5a2a'); R(x + 13, y + 16, 3, 1, '#3fb43a');
    if (flap) { R(x, y + 8, 3, 7, O2); R(x + 13, y + 8, 3, 7, O2); }
    ellipse(x + 8, y + 12, 6, 7, O1);
    if (!flap) { R(x + 2, y + 10, 2, 7, O2); R(x + 12, y + 10, 2, 7, O2); }
    ellipse(x + 8, y + 14, 3, 4, BL);
    for (const [vx, vy] of [[6, 13], [9, 13], [7, 16], [10, 16]]) R(x + vx, y + vy, 1, 1, O1);
    R(x + 3, y + 3, 2, 3, O2); R(x + 11, y + 3, 2, 3, O2);
    circle(x + 5, y + 8, 3, '#f2e2c4'); circle(x + 11, y + 8, 3, '#f2e2c4');
    if (blink) { R(x + 3, y + 8, 4, 1, O2); R(x + 9, y + 8, 4, 1, O2); }
    else {
      circle(x + 5, y + 8, 2, '#ffd21f'); circle(x + 11, y + 8, 2, '#ffd21f');
      R(x + 4 + look, y + 7, 2, 2, INK); R(x + 10 + look, y + 7, 2, 2, INK); R(x + 4 + look, y + 7, 1, 1, '#ffffff'); R(x + 10 + look, y + 7, 1, 1, '#ffffff');
    }
    R(x + 7, y + 10, 2, on && Math.floor(a.t * 4) % 2 ? 3 : 2, '#f5a020');
    R(x + 5, y + 18, 2, 1, '#f5a020'); R(x + 9, y + 18, 2, 1, '#f5a020');
  }

  /* ---------- the family pets in new poses ---------- */
  function catNapSprite(x, y, a) {   // 22 x 13, curled up asleep on a cushion
    const on = a.on;
    ellipse(x + 11, y + 10, 10, 2, '#4a6fc0'); ellipse(x + 11, y + 9, 10, 2, '#6a8fd8'); R(x + 4, y + 8, 6, 1, '#9ab8f0');
    PETS.catSleep(x + 11, y + 9, a.dir);
    if (on && a.t < 1.2) { const ex = a.dir < 0 ? x + 6 : x + 15; R(ex, y + 4, 1, 1, '#a8d048'); }
  }
  function boneSprite(x, y, a) {   // 44 x 19, the two dogs having a tug-of-war with a bone
    const D = SCENES.icecream && SCENES.icecream._dogs;
    if (!D) return;
    const on = a.on, tug = on ? Math.round(Math.sin(a.t * 10) * 2) : 0, yb = y + 19;
    D.vizsla(x + 10 + tug, yb, 1, { wag: true, bark: on && Math.floor(a.t * 4) % 2 === 0, hop: on && tug > 0 ? 1 : 0 });
    D.husky(x + 34 + tug, yb, -1, { wag: true, bark: on && Math.floor(a.t * 4) % 2 === 1, hop: on && tug < 0 ? 1 : 0 });
    const bx = x + 19 + tug, by = yb - 12;
    R(bx + 1, by + 1, 5, 2, '#f4ecd8'); R(bx + 1, by + 2, 5, 1, '#d8ccb0');
    for (const ex of [bx - 1, bx + 6]) { R(ex, by, 2, 2, '#f4ecd8'); R(ex, by + 2, 2, 2, '#e2d6bc'); }
  }

  /* ---------- weather and fun ---------- */
  function stormSprite(x, y, a) {   // 22 x 23, a grey cloud with a lightning bolt
    const on = a.on, fl = on && Math.floor(a.t * 12) % 2 && a.t < 0.8;
    const sh = '#6a7288', top = fl ? '#e3e9f2' : '#8a93a8';
    circle(x + 6, y + 8, 5, sh); circle(x + 12, y + 6, 6, sh); circle(x + 17, y + 9, 4, sh); R(x + 2, y + 9, 19, 5, sh);
    circle(x + 6, y + 7, 4, top); circle(x + 12, y + 5, 5, top); circle(x + 17, y + 8, 3, top); R(x + 3, y + 8, 16, 4, top);
    R(x + 8, y + 7, 1, 1, INK); R(x + 14, y + 7, 1, 1, INK); R(x + 10, y + 9, 3, 1, on ? INK : '#5a5e70');
    if (on) R(x + 11, y + 10, 1, 1, INK);
    const Yb = fl ? '#ffffff' : '#ffd21f', Ob = '#f57a12';
    for (const [dx, dy, w, h] of [[10, 13, 4, 2], [9, 15, 4, 2], [8, 17, 6, 1], [10, 18, 3, 2], [9, 20, 2, 2], [8, 22, 1, 1]]) { R(x + dx - 1, y + dy, w + 2, h, Ob); }
    for (const [dx, dy, w, h] of [[10, 13, 4, 2], [9, 15, 4, 2], [8, 17, 6, 1], [10, 18, 3, 2], [9, 20, 2, 2], [8, 22, 1, 1]]) R(x + dx, y + dy, w, h, Yb);
  }
  function umbrellaSprite(x, y, a) {   // 19 x 21
    const on = a.on, rot = on ? Math.floor(a.t * 10) : 0, hw = [1, 3, 5, 6, 7, 8, 8, 9, 9], PAN = ['#e8222b', '#ffd21f', '#2a6fe0', '#3fb43a'];
    const tw = on ? Math.round(Math.sin(a.t * 12)) : 0;
    R(x + 9, y, 1, 2, '#3a3d46');
    for (let r = 0; r < hw.length; r++) {
      const w = hw[r];
      for (let dx = -w; dx <= w; dx++) {
        const band = (Math.min(3, Math.floor((dx + w + 0.5) / (2 * w + 1) * 4)) + rot) % 4;
        if (r === hw.length - 1 && (dx + 9) % 4 === 3) continue;   // the scalloped rim
        R(x + 9 + dx + tw, y + 2 + r, 1, 1, PAN[band]);
      }
    }
    R(x + 7 + tw, y + 3, 2, 2, '#ffffff');
    R(x + 9, y + 11, 1, 8, '#3a3d46'); R(x + 10, y + 18, 1, 2, '#3a3d46'); R(x + 7, y + 19, 1, 1, '#3a3d46'); R(x + 8, y + 20, 2, 1, '#3a3d46');
  }
  function snowmanSprite(x, y, a) {   // 17 x 30
    const on = a.on, hat = on ? Math.round(Math.abs(Math.sin(a.t * 7)) * 3) : 0, wave = on ? Math.floor(a.t * 6) % 2 : 0;
    const W1 = '#ffffff', WS = '#d8e4f0';
    const RIM = '#9fb4cc';
    circle(x + 8, y + 24, 6, RIM); circle(x + 8, y + 17, 5, RIM); circle(x + 8, y + 10, 4, RIM);
    circle(x + 8, y + 24, 5, WS); circle(x + 8, y + 23, 5, W1);
    circle(x + 8, y + 17, 4, WS); circle(x + 8, y + 16, 4, W1);
    circle(x + 8, y + 10, 3, W1); R(x + 10, y + 11, 1, 1, WS);
    for (let k = 0; k < 4; k++) { R(x + 3 - k, y + 16 - k, 1, 1, '#7a4a2a'); R(x + 13 + k, y + 16 - k - (wave ? k : 0), 1, 1, '#7a4a2a'); }
    R(x + 5, y + 13, 7, 2, '#e8222b'); R(x + 10, y + 14, 2, 3, '#e8222b'); R(x + 10, y + 17, 2, 1, '#ffd21f');
    R(x + 7, y + 9, 1, 1, INK); R(x + 9, y + 9, 1, 1, INK); R(x + 8, y + 10, 3, 1, '#f57a12');
    R(x + 7, y + 12, 1, 1, INK); R(x + 9, y + 12, 1, 1, INK);
    for (const by of [17, 19, 23, 25]) R(x + 8, y + by, 1, 1, INK);
    R(x + 4, y + 6 - hat, 9, 1, '#2a2a33'); R(x + 5, y + 2 - hat, 7, 4, '#2a2a33'); R(x + 5, y + 5 - hat, 7, 1, '#e8222b');
  }
  function kiteSprite(x, y, a) {   // 18 x 28
    const on = a.on, sway = on ? Math.round(Math.sin(a.t * 9) * 2) : Math.round(Math.sin(T * 1.5 + a.seed));
    const cx = x + 9 + sway;
    for (let r = 0; r < 7; r++) { R(cx - r, y + r, r, 1, '#ff6fb4'); R(cx, y + r, r + 1, 1, '#ffd21f'); }
    for (let r = 0; r < 7; r++) { const w = 6 - r; R(cx - w, y + 7 + r, w, 1, '#2a6fe0'); R(cx, y + 7 + r, w + 1, 1, '#3fb43a'); }
    R(cx, y, 1, 14, '#8a5a2a'); R(cx - 6, y + 6, 13, 1, '#8a5a2a');
    for (let i = 0; i < 7; i++) {
      const px = cx + Math.round(Math.sin(T * 4 + i * 0.9) * (1 + i * 0.3)) - Math.round(sway * i / 7), py = y + 14 + i * 2;
      R(px, py, 1, 2, '#5a5a66');
      if (i % 2) R(px - 1, py + 1, 3, 1, i % 4 === 1 ? '#e8222b' : '#ffd21f');
    }
  }
  const BALL = ['#e8222b', '#ffd21f', '#3fb43a', '#2a6fe0', '#ff6fb4'];
  function hotAirSprite(x, y, a) {   // 21 x 31
    const on = a.on, sway = Math.round(Math.sin(T * 1.2 + a.seed) * 0.6), cx = x + 10 + sway;
    for (let dy = -10; dy <= 10; dy++) {
      const half = Math.floor(9.5 * Math.sqrt(Math.max(0, 1 - (dy / 10.6) ** 2)) + (dy > 4 ? -(dy - 4) * 0.3 : 0));
      for (let dx = -half; dx <= half;) {
        const band = Math.min(4, Math.floor((dx + half) / (2 * half + 1) * 5));
        let e = dx; while (e <= half && Math.min(4, Math.floor((e + half) / (2 * half + 1) * 5)) === band) e++;
        R(cx + dx, y + 10 + dy, e - dx, 1, BALL[band]);
        dx = e;
      }
    }
    R(cx - 4, y + 3, 2, 3, '#ffffff');
    R(cx - 4, y + 21, 9, 1, '#e8222b'); R(cx - 3, y + 22, 7, 1, '#c81a24');
    R(cx - 3, y + 23, 1, 4, '#5a4a3a'); R(cx + 3, y + 23, 1, 4, '#5a4a3a');
    if (on && Math.floor(T * 12) % 2) { R(cx - 1, y + 22, 3, 3, '#ffd21f'); R(cx, y + 21, 1, 1, '#fff3a6'); } else if (on) R(cx - 1, y + 23, 3, 2, '#f57a12');
    R(cx - 2, y + 25, 3, 2, SKIN[1]); R(cx - 2, y + 24, 3, 1, '#8a4fd9');
    if (on) R(cx + 1, y + 23 + (Math.floor(T * 8) % 2), 1, 2, SKIN[1]);
    R(cx - 4, y + 27, 9, 4, '#a8743f'); R(cx - 4, y + 27, 9, 1, '#c98a4b'); R(cx - 2, y + 28, 1, 3, '#8a5a2a'); R(cx + 2, y + 28, 1, 3, '#8a5a2a');
  }
  function rocketSprite(x, y, a) {   // 12 x 30
    const on = a.on, shake = on && a.t < 0.6 ? (Math.floor(T * 30) % 2 ? 1 : -1) : 0;
    x += shake;
    R(x + 5, y, 2, 1, '#e8222b'); R(x + 4, y + 1, 4, 1, '#e8222b'); R(x + 3, y + 2, 6, 2, '#e8222b'); R(x + 2, y + 4, 8, 2, '#e8222b'); R(x + 4, y + 2, 1, 2, '#ff7a6b');
    R(x + 2, y + 6, 8, 14, '#f4f7fb'); R(x + 8, y + 6, 2, 14, '#cfd6dd'); R(x + 3, y + 6, 1, 12, '#ffffff');
    circle(x + 6, y + 10, 2, '#2a6fe0'); R(x + 5, y + 9, 2, 2, GLASS); R(x + 5, y + 9, 1, 1, '#ffffff');
    R(x + 2, y + 15, 8, 1, '#e8222b');
    R(x, y + 16, 2, 6, '#e8222b'); R(x + 1, y + 14, 1, 2, '#e8222b'); R(x + 10, y + 16, 2, 6, '#e8222b'); R(x + 10, y + 14, 1, 2, '#e8222b');
    R(x + 5, y + 17, 2, 5, '#c81a24');
    R(x + 3, y + 20, 6, 2, '#5a5e6a');
    if (on) {
      const f = Math.floor(T * 16) % 2;
      R(x + 3, y + 22, 6, 3 + f, '#ffd21f'); R(x + 4, y + 25 + f, 4, 2, '#f57a12'); R(x + 5, y + 27 + f, 2, 2, '#e8222b');
    }
  }

  /* ---------- props ---------- */
  function alarmSprite(x, y, a) {   // 22 x 26, the big red alarm bell from the station
    const on = a.on && a.t < 2, sh = on ? (Math.floor(T * 30) % 2 ? 1 : -1) : 0, cx = x + 11 + sh, cy = y + 12, r = 9;
    R(x + 9, y, 4, 3, '#5a5f6e');
    circle(cx, cy + 1, r + 1, '#7a1018'); circle(cx, cy, r, '#e8222b'); circle(cx - 2, cy - 2, r - 3, '#ff5a4a'); R(cx - 4, cy - 5, 2, 2, '#ffd0c8');
    circle(cx, cy, 2, '#ffd21f');
    const hx = cx + (on ? (Math.floor(T * 30) % 2 ? 3 : 5) : 5);
    R(cx + 1, cy + r - 1, 1, 4, '#5a5f6e'); R(hx - 1, cy + r + 2, 3, 3, '#ffd21f');
  }
  function trafficSprite(x, y, a) {   // 10 x 30; a.lt: 0 green, 1 yellow, 2 red
    const lt = a.lt || 0;
    R(x + 4, y + 18, 2, 11, '#3a3d46'); R(x + 2, y + 29, 6, 1, '#3a3d46');
    R(x + 1, y, 8, 19, '#2f3240'); R(x + 1, y, 8, 1, '#4a4e5a'); R(x, y + 2, 1, 15, '#2f3240'); R(x + 9, y + 2, 1, 15, '#2f3240');
    const L3 = [[2, '#ff3b3b', '#5a2a2a'], [1, '#ffd21f', '#5a4a1a'], [0, '#3fe060', '#1f4a2a']];
    L3.forEach(([k, on, off], i) => { circle(x + 5, y + 4 + i * 5, 2, lt === k ? on : off); if (lt === k) R(x + 4, y + 3 + i * 5, 1, 1, '#ffffff'); });
  }
  function crossingSprite(x, y, a) {   // 18 x 32, the railroad crossing sign with flashing lights
    const on = a.on, ph = Math.floor(a.t * 3.4) % 2;
    R(x + 8, y + 5, 2, 26, '#e8e8e8'); R(x + 9, y + 5, 1, 26, '#c8ccd2'); R(x + 5, y + 31, 8, 1, '#5a5e6a');
    for (let i = 0; i < 12; i++) { R(x + 1 + i, y + i, 5, 1, IRON); R(x + 12 - i, y + i, 5, 1, IRON); }
    for (let i = 1; i < 11; i++) { R(x + 2 + i, y + i, 3, 1, '#f4f7fb'); R(x + 13 - i, y + i, 3, 1, '#f4f7fb'); }
    R(x + 2, y + 15, 14, 2, IRON);
    for (const [lx, lit] of [[4, on && ph], [14, on && !ph]]) {
      circle(x + lx, y + 20, 3, IRON); circle(x + lx, y + 20, 2, lit ? '#ff3b3b' : '#5a2a2a');
      if (lit) R(x + lx - 1, y + 19, 1, 1, '#ffd0c8');
      R(x + lx - 3, y + 16, 7, 1, IRON);
    }
  }

  const veh = i => ({ w: V[i].len, h: V[i].h + 1, k: 1, veh: i,
    draw: (x, y, a) => drawV(i, x, y + V[i].h, a.on, a.on && Math.floor(T * 10) % 2 ? -1 : 0, 0) });
  const person = (type, skin, cheer) => ({ w: 12, h: personH(type), k: 2,
    draw: (x, y, a) => drawPerson({ type, x: x + 6, yb: y + personH(type), dir: a.dir, pose: a.on ? (cheer ? 'cheer' : 'wave') : 'stand', skin, seed: 3,
      hop: a.on ? Math.round(Math.abs(Math.sin(a.t * 7)) * 2) : 0 }) });

  // Sticker catalogue. w/h: sprite box in sprite pixels; k: drawn this many times bigger.
  const DEFS = {
    fire: veh(VI.fire), police: veh(VI.police), amb: veh(VI.amb),
    heli: { w: 41, h: 18, k: 1, draw: heliSprite },
    ff: person('ff', SKIN[0]), cop: person('cop', SKIN[2]), medic: person('medic', SKIN[1]),
    kid: person('kid', SKIN[3], true), kid2: person('kid2', SKIN[0], true),
    dog: { w: 16, h: 10, k: 2, draw(x, y, a) {
      y -= a.on ? Math.round(Math.abs(Math.sin(a.t * 8)) * 2) : 0;
      const ph = Math.floor(T * (a.on ? 16 : 3)) % 2, c = DOG_PAL.a;
      if (a.dir < 0) { g.save(); g.translate(2 * x + 16, 0); g.scale(-1, 1); }
      bmp(x, y, DOG, DOG_PAL);
      if (ph) { R(x, y + 2, 1, 3, c); R(x + 1, y + 4, 1, 2, c); } else { R(x, y + 5, 2, 1, c); R(x + 1, y + 4, 1, 1, c); R(x - 1, y + 4, 1, 1, c); }
      if (a.dir < 0) g.restore();
    } },
    cat: { w: 13, h: 18, k: 2, draw: (x, y, a) => PETS.catSit(x + 6, y + 18, { hop: a.on ? Math.round(Math.abs(Math.sin(a.t * 8)) * 2) : 0, meow: a.on, swish: true }) },
    vizsla: { w: 21, h: 15, k: 2, draw: (x, y, a) => SCENES.icecream && SCENES.icecream._dogs.vizsla(x + 10, y + 15, a.dir, { run: a.on, wag: true, bark: a.on, hop: a.on ? Math.round(Math.abs(Math.sin(a.t * 8)) * 2) : 0 }) },
    husky: { w: 21, h: 19, k: 2, draw: (x, y, a) => SCENES.icecream && SCENES.icecream._dogs.husky(x + 10, y + 18, a.dir, { run: a.on, wag: true, bark: a.on, pant: !a.on, hop: a.on ? Math.round(Math.abs(Math.sin(a.t * 8)) * 2) : 0 }) },
    ducks: { w: 25, h: 10, k: 2, walk: true, draw(x, y, a) {
      const step = a.on ? Math.floor(T * 8) % 2 : 0, d = a.dir;
      const spots = d > 0 ? [[3, 0], [10, 1], [19, 2]] : [[6, 2], [15, 1], [22, 0]];
      for (const [dx, i] of spots) {
        const bob = a.on && (Math.floor(T * 8) + i) % 2 ? 1 : 0;
        drawDuck(x + dx, y + 10 - bob, i === 2, d, step);
      }
    } },
    tree: { w: 26, h: 36, k: 1, draw: (x, y, a) => drawTree(x + 13 + (a.on ? Math.round(Math.sin(a.t * 30) * 1.2) : 0), y + 36, 12) },
    house: { w: 30, h: 30, k: 1, draw: houseSprite },
    hydrant: { w: 10, h: 14, k: 2, draw: (x, y) => bmp(x, y, HYDRANT, { a: '#e8222b', b: '#a3121d', c: '#ff7a6b', d: '#7a1018', y: '#ffd21f' }) },
    cone: { w: 10, h: 13, k: 2, draw: (x, y, a) => bmp(x + (a.on ? Math.round(Math.sin(a.t * 24)) : 0), y, CONE, { a: '#f57a12', w: '#ffffff', b: '#3a3d46' }) },
    ladder: { w: 12, h: 34, k: 1, draw: ladderSprite },
    bell: { w: 12, h: 11, k: 2, draw(x, y, a) {
      const sw = a.on ? Math.round(Math.sin(a.t * 14) * 1.4 * Math.max(0, 1 - a.t / 2)) : 0;
      bmp(x + sw, y, BELL, { a: '#ffd21f', b: '#c99410', c: '#fff27a' });
      R(x + 5 - sw, y + 9, 2, 2, '#7a4a10');
    } },
    flame: { w: 22, h: 34, k: 1, glow: '#ff9a3a', draw: (x, y, a) => flame(x + 11, y + 34, a.on ? 1.9 : 1.5, 2) },
    star: { w: 11, h: 10, k: 2, glow: '#fff27a', draw: (x, y, a) => {
      const tw = a.on && Math.floor(T * 10) % 2;
      bmp(x, y, STAR, { a: tw ? '#fff27a' : '#ffd21f', b: '#e0a010', c: '#ffffff', e: '#7a4a10' });
    } },
    heart: { w: 9, h: 8, k: 2, draw: (x, y) => bmp(x, y, HEART, { a: '#ff4f8a', b: '#c73d64', c: '#ffb3da' }) },
    balloon: { w: 9, h: 21, k: 2, draw(x, y, a) {
      const sway = Math.round(Math.sin(T * 2 + a.seed));
      bmp(x + sway, y, BALLOON, { a: '#e8222b', b: '#a3121d', c: '#ff7a6b', w: '#ffffff' });
      for (let i = 0; i < 11; i++) R(x + 4 + (Math.floor((i + T * 4) / 3) % 2 ? 1 : 0) + (i < 3 ? sway : 0), y + 10 + i, 1, 1, '#6b7480');
    } },
    sun: { w: 26, h: 26, k: 1, glow: '#ffd21f', draw: sunSprite },
    rainbow: { w: 40, h: 24, k: 1, draw: rainbow },
    cloud: { w: 30, h: 17, k: 1, draw: cloudSprite },
    flower: { w: 9, h: 16, k: 2, draw: (x, y, a) => bmp(x, y, FLOWER, { a: a.on && Math.floor(T * 6) % 2 ? '#ffb3da' : '#ff6fb4', c: '#ffd21f', g: '#3fb43a', d: '#7a4a2a' }) },

    // Newer stickers carry their own tap action (tap) and per-frame effects (tick).
    engine: { w: 54, h: 40, k: 1, draw: engineSprite,
      tap(s) { s.act = 2.6; snd('whistle'); setTimeout(() => snd('hiss'), 900); word(s, 'CHOO CHOO!', '#ffffff'); },
      tick(s, dt) { if (s.act > 0 && Math.random() < dt * 9) { const [x, y] = spot(s, 40, 1); smoke(x, y, s.at < 0.9 ? '#ffffff' : '#d8dbe2'); } } },
    coach: { w: 47, h: 35, k: 1, draw: coachSprite,
      tap(s) { s.act = 1.8; snd('chime'); setTimeout(() => snd('meow', 1.1), 450); word(s, 'ALL ABOARD!', '#ffd21f'); } },
    caboose: { w: 36, h: 40, k: 1, draw: cabooseSprite,
      tap(s) { s.act = 1.8; snd('bell'); setTimeout(() => snd('bell', 1.06), 380); word(s, 'DING DING!', '#ffd21f'); } },
    fireboat: { w: 61, h: 43, k: 1, draw: fireboatSprite,
      tap(s) { s.act = 2.4; snd('toot'); setTimeout(() => snd('splash'), 500); word(s, 'TOOT TOOT!', '#ffffff'); },
      tick(s, dt) {
        if (s.act <= 0 || s.at < 0.4 || s.act < 0.3) return;
        const k = DEFS.fireboat.k, an = -0.75 + Math.sin(s.at * 5) * 0.2, [x, y] = spot(s, 50 + Math.cos(an) * 11, 25 + Math.sin(an) * 11);
        spawn(3, () => ({ x, y, vx: Math.cos(an) * rand(55, 85) * k, vy: Math.sin(an) * rand(55, 85) * k, g: 140, life: 0.8, max: 0.8, s: 2, c: Math.random() < 0.5 ? '#6fc8ff' : '#ffffff' }));
      } },
    sailboat: { w: 22, h: 25, k: 2, draw: sailboatSprite,
      tap(s) { s.act = 1.6; snd('toot', 1.5, 0.7); word(s, 'AHOY!', '#ffffff'); } },
    duckring: { w: 16, h: 14, k: 2, draw: duckRingSprite,
      tap(s, cx, cy) { s.act = 1.4; SFX.quack(); setTimeout(() => snd('splash2', 1.3, 0.7), 200); word(s, 'QUACK!', '#ffd21f'); splash(cx, cy + 10, 8); } },
    digger: { w: 62, h: 46, k: 1, draw: diggerSprite,
      tap(s) { s.act = 2.4; tone('sawtooth', 110, 0, 0.9, 0.025, 230); noise(0, 0.8, 0.03, 2400, 1); setTimeout(() => snd('scoop'), 450); setTimeout(() => snd('dump', 1.1), 1500); word(s, 'SCOOP!', '#ffd21f'); },
      tick(s, dt) {
        if (s.act <= 0) return;
        const [tx, ty, tip] = keys(DIG_K, s.at);
        if ((s.at > 0.45 && s.at < 0.8) || (tip > 0.5 && s.at < 2)) if (Math.random() < dt * 25) {
          const [x, y] = spot(s, tx + 1, ty + (tip > 0.5 ? 6 : 2));
          spawn(1, () => ({ x: x + rand(-2, 2), y, vx: rand(-10, 10), vy: tip > 0.5 ? 10 : -20, g: 160, life: 0.6, max: 0.6, s: 2, c: Math.random() < 0.5 ? '#8a5a32' : '#a8764a' }));
        }
      } },
    dump: { w: 62, h: 40, k: 1, draw: dumpSprite,
      tap(s) { s.act = 2.4; [0, 0.18].forEach(t => tone('square', 1040, t, 0.1, 0.05)); setTimeout(() => snd('dump'), 800); word(s, 'DUMP!', '#ffd21f'); },
      tick(s, dt) {
        if (s.act <= 0 || s.at < 0.8 || s.at > 1.8 || Math.random() > dt * 30) return;
        const [x, y] = spot(s, 1, 14);
        spawn(1, () => ({ x: x + rand(-2, 1), y: y + rand(-3, 3), vx: rand(-14, -2), vy: rand(0, 20), g: 160, life: 0.7, max: 0.7, s: 2, c: Math.random() < 0.5 ? '#f2d27a' : '#dcb55c' }));
      } },
    garbage: { w: 66, h: 52, k: 1, draw: garbageSprite,
      tap(s) { s.act = 1.9; tone('sawtooth', 150, 0, 0.55, 0.02, 260); setTimeout(() => snd('bang'), 620); setTimeout(() => snd('crunch'), 1150); word(s, 'CRASH BANG!', '#ffd21f'); } },
    icetruck: { w: 64, h: 50, k: 1, draw: iceTruckSprite,
      tap(s, cx, cy) { s.act = 1.8; snd('bell'); setTimeout(() => snd('bell', 1.12), 350); word(s, 'DING DING!', '#ff8fb8'); sparkle(cx, cy - 20, 10, 6, '#ffb3da'); } },
    icecone: { w: 9, h: 21, k: 2, draw: treatSprite(4),
      tap(s, cx, cy) { s.act = 1; snd('yum'); word(s, 'YUM!', '#ff8fb8'); sparkle(cx, cy - 8, 10, 6, '#ffffff'); } },
    popsicle: { w: 9, h: 19, k: 2, draw: treatSprite(6),
      tap(s, cx, cy) { s.act = 1; snd('pop', 1.2); word(s, 'YUM!', '#7ad0ff'); sparkle(cx, cy - 8, 10, 6, '#ffffff'); } },
    softserve: { w: 9, h: 17, k: 2, draw: treatSprite(8),
      tap(s, cx, cy) { s.act = 1; snd('pop', 0.9); setTimeout(() => snd('yum', 1.15), 250); word(s, 'YUM!', '#c9a4f2'); sparkle(cx, cy - 8, 10, 6, '#ffffff'); } },
    cow: Object.assign(animal('cow', 36, 27, 18), { tap(s) { s.act = 1.6; snd('moo'); word(s, 'MOO!', '#ffffff'); } }),
    sheep: Object.assign(animal('sheep', 24, 19, 12), { tap(s) { s.act = 1.4; snd('baa'); word(s, 'BAA!', '#ffffff'); } }),
    pig: Object.assign(animal('pig', 20, 16, 10), { tap(s) { s.act = 1.4; snd('oink'); word(s, 'OINK!', '#ffb3da'); } }),
    bunny: { w: 16, h: 23, k: 2, mirror: true, draw: bunnySprite,
      tap(s) { s.act = 1.6; [0, 0.4, 0.8, 1.2].forEach(t => setTimeout(() => snd('boing', 1.3 + Math.random() * 0.2, 0.6), t * 1000)); word(s, 'HOP HOP!', '#ffffff'); } },
    owl: { w: 16, h: 22, k: 2, draw: owlSprite,
      tap(s) { s.act = 1.6; snd('hoot'); word(s, 'HOOT HOOT!', '#fff3a6'); } },
    catnap: { w: 22, h: 13, k: 2, mirror: true, draw: catNapSprite,
      tap(s) { s.act = 1.8; snd('purr'); word(s, 'PURR', '#ffffff'); },
      tick(s, dt) {
        if (Math.random() < dt * (s.act > 0 ? 0 : 0.7)) {
          const [x, y] = spot(s, s.d < 0 ? 6 : 16, 1);
          parts.push({ zzz: true, x, y, vx: 5, vy: -9, g: 0, life: 1.6, max: 1.6, c: '#ffffff' });
        }
      } },
    bone: { w: 44, h: 19, k: 2, draw: boneSprite,
      tap(s) { s.act = 1.6; snd('bark'); setTimeout(() => snd('bark2', 1.1), 420); word(s, 'WOOF WOOF!', '#ffffff'); } },
    storm: { w: 22, h: 23, k: 2, draw: stormSprite,
      tap(s) { s.act = 1.6; setTimeout(() => snd('thunder', rand(0.9, 1.1)), 150); word(s, 'BOOM!', '#fff3a6'); },
      tick(s, dt) {
        if (s.act <= 0 || Math.random() > dt * 30) return;
        const [x, y] = spot(s, rand(3, 19), 13);
        parts.push({ x, y, vx: 0, vy: 80, g: 60, life: 0.6, max: 0.6, s: 1, c: '#6fc8ff' });
      } },
    umbrella: { w: 19, h: 21, k: 2, draw: umbrellaSprite,
      tap(s) { s.act = 1.6; for (let i = 0; i < 8; i++) tone('sine', rand(1400, 2200), i * 0.15, 0.05, 0.05); word(s, 'DRIP DROP!', '#bfe6ff'); },
      tick(s, dt) {
        if (s.act <= 0 || Math.random() > dt * 22) return;
        const [x, y] = spot(s, rand(1, 18), -6);
        parts.push({ x, y, vx: 0, vy: 70, g: 40, life: 0.3, max: 0.3, s: 1, c: '#6fc8ff' });
        const [x2, y2] = spot(s, rand(0, 1) < 0.5 ? 0 : 19, 9);
        parts.push({ x: x2, y: y2, vx: rand(-15, 15), vy: -20, g: 200, life: 0.4, max: 0.4, s: 1, c: '#bfe6ff' });
      } },
    snowman: { w: 17, h: 30, k: 2, draw: snowmanSprite,
      tap(s, cx, cy) { s.act = 1.6; [1568, 1319, 1568, 2093].forEach((f, i) => tone('triangle', f, i * 0.12, 0.18, 0.08)); word(s, 'BRRR!', '#bfe6ff');
        spawn(14, () => ({ x: cx + rand(-30, 30), y: cy - rand(30, 50), vx: rand(-6, 6), vy: rand(14, 26), g: 0, life: 1.8, max: 1.8, s: 2, c: '#ffffff' })); } },
    kite: { w: 18, h: 28, k: 2, draw: kiteSprite,
      tap(s) { s.act = 1.4; s.rise = 0.7; s.rv = 50; SFX.whoosh(); tone('sine', 600, 0, 0.5, 0.08, 1200); word(s, 'WHEE!', '#ffd21f'); } },
    hotair: { w: 21, h: 31, k: 2, draw: hotAirSprite,
      tap(s) { s.act = 1.6; s.rise = 1.2; s.rv = 32; noise(0, 1.1, 0.16, 700, 0.7); word(s, 'WHOOSH!', '#ffffff'); } },
    rocket: { w: 12, h: 30, k: 2, draw: rocketSprite,
      tap(s) { s.act = 2.4; s.launch = 1; s.ret = null; snd('rocket'); word(s, 'BLAST OFF!', '#ffd21f'); },
      tick(s, dt) {
        if (s.launch === 1 && s.at > 0.6) { s.launch = 2; s.ret = s.fy; s.rise = 1.4; s.rv = 140; }
        if (s.launch === 2 && s.rise <= 0) { s.launch = 0; const [x, y] = pos(s); sparkle(x, y - 20, 24, 14); sparkle(x, y - 20, 18, 8, '#ff8fb8'); SFX.chime(); }
        if (s.act > 0 && s.at > 0.2 && Math.random() < dt * 14) { const [x, y] = spot(s, 6, 27); smoke(x, y, '#e8ebf0'); }
      } },
    alarm: { w: 22, h: 26, k: 2, draw: alarmSprite,
      tap(s) { s.act = 2.2; bellRing(2); word(s, 'RING RING!', '#ffd21f'); } },
    traffic: { w: 10, h: 30, k: 2, draw: trafficSprite,
      tap(s, cx, cy) {
        s.act = 0.8; s.lt = ((s.lt || 0) + 1) % 3;
        const [wd, c, f] = [['GO!', '#3fe060', 880], ['SLOW!', '#ffd21f', 660], ['STOP!', '#ff3b3b', 440]][s.lt];
        tone('square', f, 0, 0.12, 0.05); tone('square', f, 0.16, 0.12, 0.05); word(s, wd, c);
      } },
    crossing: { w: 18, h: 32, k: 2, draw: crossingSprite,
      tap(s) { s.act = 3; for (let i = 0; i < 10; i++) tone('triangle', i % 2 ? 1050 : 1250, i * 0.3, 0.16, 0.05); word(s, 'DING DING!', '#ff6b5e'); } },
  };
  // The tray: one colored tab per group; each group starts on a fresh page.
  const CATS = [
    { icon: 'fire', c: '#e8222b', d: '#a3121d', ids: ['fire', 'police', 'amb', 'heli', 'ff', 'cop', 'medic', 'kid', 'kid2', 'hydrant', 'cone', 'ladder', 'flame', 'alarm', 'bell'] },
    { icon: 'engine', c: '#2a6fe0', d: '#1a3f9a', ids: ['engine', 'coach', 'caboose', 'crossing', 'traffic', 'fireboat', 'sailboat', 'digger', 'dump', 'garbage', 'icetruck'] },
    { icon: 'cow', c: '#3fb43a', d: '#1f7a2a', ids: ['vizsla', 'husky', 'cat', 'bone', 'catnap', 'ducks', 'duckring', 'cow', 'sheep', 'pig', 'bunny', 'owl'] },
    { icon: 'icecone', c: '#ff6fb4', d: '#c8407e', ids: ['icecone', 'popsicle', 'softserve', 'balloon', 'hotair', 'kite', 'rocket', 'star', 'heart', 'flower', 'tree', 'house'] },
    { icon: 'sun', c: '#ffb21f', d: '#c97a10', ids: ['sun', 'cloud', 'rainbow', 'storm', 'umbrella', 'snowman'] },
  ];
  const ORDER = CATS.flatMap(c => c.ids);
  let PAGES = [];   // [{ cat, ids }], rebuilt in layout()

  /* ---------- sounds for the newer stickers (recorded clips, synth until they load) ---------- */
  let BANK = null;
  function snd(k, rate = 1, vol = 1) {
    if (!BANK) {
      if (typeof TOY === 'undefined') return;
      BANK = TOY.bank({
        whistle: ['train-whistle', 0.6], hiss: ['train-hiss', 0.35], toot: ['boat-toot', 0.5], splash: ['bath-splash', 0.45], splash2: ['bath-splash2', 0.45],
        moo: ['bt-moo', 0.7], baa: ['bt-baa', 0.7], oink: ['bt-oink', 0.7], bell: ['ic-bell', 0.5], pop: ['ic-pop', 0.6], yum: ['ic-yum', 0.55],
        meow: ['cat-meow', 0.55], purr: ['cat-purr', 0.6], bark: ['dog-bark', 0.6], bark2: ['dog-bark-2', 0.55], thunder: ['wx-thunder', 0.3],
        chime: ['mv-chime', 0.45], scoop: ['dig-scoop', 0.6], dump: ['dig-dump', 0.55], bang: ['trash-bang', 0.5],
        crunch: ['trash-crunch', 0.5], boing: ['dig-boing', 0.5], rocket: ['st-rocket', 0.5],
      }, {
        whistle() { tone('sine', 880, 0, 0.5, 0.08, 860); tone('sine', 1100, 0, 0.5, 0.06, 1080); tone('sine', 880, 0.6, 0.7, 0.08, 840); tone('sine', 1100, 0.6, 0.7, 0.06, 1060); },
        hiss() { noise(0, 0.6, 0.08, 4000, 0.5); }, toot(r = 1) { tone('sawtooth', 220 * r, 0, 0.4, 0.07); tone('square', 277 * r, 0, 0.4, 0.04); },
        splash() { noise(0, 0.5, 0.15, 1400, 0.7); }, splash2() { noise(0, 0.4, 0.12, 1100, 0.7); },
        moo() { tone('sawtooth', 140, 0, 0.7, 0.06, 110); }, baa() { tone('sawtooth', 420, 0, 0.5, 0.05, 380); },
        oink() { tone('square', 300, 0, 0.15, 0.05, 200); tone('square', 320, 0.18, 0.15, 0.05, 210); },
        bell() { tone('triangle', 1300, 0, 0.4, 0.08); }, pop() { SFX.pop(); }, yum() { tone('sine', 500, 0, 0.15, 0.1, 700); tone('sine', 700, 0.18, 0.2, 0.1, 500); },
        meow() { SFX.meow(); }, purr() { for (let i = 0; i < 10; i++) noise(i * 0.12, 0.1, 0.03, 120, 2); }, bark() { SFX.woof(); }, bark2() { SFX.woof(); },
        thunder() { noise(0, 1.6, 0.06, 90, 0.6); }, chime() { SFX.chime(); }, scoop() { noise(0, 0.4, 0.1, 900, 1); }, dump() { noise(0, 0.9, 0.12, 700, 0.8); },
        bang() { noise(0, 0.2, 0.12, 800, 1); }, crunch() { for (let i = 0; i < 5; i++) noise(i * 0.08, 0.07, 0.1, 1800, 1.4); },
        boing() { tone('sine', 300, 0, 0.3, 0.12, 700); }, rocket() { noise(0, 2.2, 0.14, 500, 0.6); },
      });
    }
    BANK.load();
    if (k === 'hoot') {   // a soft owl "hoo-hoo", made right here
      for (const [t, f] of [[0, 430], [0.42, 400], [0.62, 400]]) { tone('sine', f, t, 0.3, 0.16, f - 40); tone('triangle', f / 2, t, 0.3, 0.05, f / 2 - 20); }
      return;
    }
    BANK.play(k, rate, vol);
  }
  // a proper old-fashioned fire bell: a little hammer drumming on a brass gong (as on the station)
  function bellRing(dur) { if (!ac) return; for (let t = 0; t < dur; t += 0.055) { tone('triangle', 1180, t, 0.05, 0.05); tone('sine', 2360, t, 0.04, 0.025); } }
  // where a sprite pixel of sticker s is on the picture right now
  function spot(s, sx, sy) {
    const d = DEFS[s.id], [cx, cy] = pos(s), fx = d.mirror && (s.d || 1) < 0 ? d.w - sx : sx;
    return [cx - d.w * d.k / 2 + fx * d.k, cy - d.h * d.k / 2 + sy * d.k];
  }
  function smoke(x, y, c) { parts.push({ x: x + rand(-1, 1), y, vx: rand(-6, 6), vy: rand(-22, -14), g: -4, life: 1.1, max: 1.1, s: 3, c }); }
  function splash(x, y, n) { spawn(n, () => ({ x: x + rand(-8, 8), y, vx: rand(-30, 30), vy: rand(-60, -30), g: 200, life: 0.6, max: 0.6, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.5 ? '#9fd2ef' : '#e6f6ff' })); }
  // comic-book words that pop up over a tapped sticker
  let words = [];
  function word(s, str, c) {
    const d = DEFS[s.id], [cx, cy] = pos(s);
    words = words.filter(w => w.s !== s);
    words.push({ s, str, c, x: cx, y: cy - d.h * d.k / 2 - 14, t: 0 });
  }

  /* ---------- what each sticker does when tapped ---------- */
  function playSiren(kind, dur) { stopSiren(); sirenStop = siren(kind); sirenT = dur; }
  function stopSiren() { if (sirenStop) { sirenStop(); sirenStop = null; } }
  function act(s, cx, cy) {
    const d = DEFS[s.id], bh = d.h * d.k;
    s.at = 0; s.act = 1.4;
    if (d.tap) { d.tap(s, cx, cy, bh); return; }
    switch (s.id) {
      case 'fire': SFX.honk(); s.act = 2.6; say('fire-truck'); break;
      case 'police': playSiren('police', 1.6); s.act = 2; say('police-car'); break;
      case 'amb': playSiren('amb', 2.2); s.act = 2.4; say('ambulance'); break;
      case 'heli': SFX.chop(); say('helicopter'); s.act = 1.4; break;
      case 'ff': case 'cop': case 'medic':
        s.act = 1.8; [659, 784].forEach((f, i) => tone('triangle', f, i * 0.16, 0.2, 0.12));
        if (s.id === 'cop') { tone('sine', 1900, 0.4, 0.12, 0.08); tone('sine', 1900, 0.56, 0.3, 0.08); }
        break;
      case 'kid': case 'kid2': s.act = 1.6; [880, 784, 988, 880, 1047].forEach((f, i) => tone('sine', f, i * 0.09, 0.1, 0.12)); break;
      case 'dog': SFX.woof(); s.act = 1.4; break;
      case 'cat': PETS.SND.load(); PETS.SND.play('meow'); s.act = 1; break;
      case 'vizsla': PETS.SND.load(); PETS.SND.play('bark'); s.act = 1.4; break;
      case 'husky': PETS.SND.load(); PETS.SND.play('bark2', 1.1); s.act = 1.4; break;
      case 'ducks': SFX.quack(); setTimeout(SFX.peep, 450); s.act = 1.6; s.walk = 1.6; break;
      case 'tree': noise(0, 0.6, 0.12, 2500, 0.6); s.act = 0.6;
        spawn(8, () => ({ x: cx + rand(-11, 11), y: cy - bh * 0.25 + rand(-8, 8), vx: rand(-14, 14), vy: rand(-6, 6), g: 30, life: 1.3, max: 1.3, s: 2, c: Math.random() < 0.5 ? '#5bb85a' : '#3f9a45' }));
        break;
      case 'house': tone('sine', 659, 0, 0.5, 0.18); tone('sine', 523, 0.4, 0.8, 0.18); s.act = 2; break;
      case 'hydrant': SFX.water(); s.act = 1.6; break;
      case 'cone': SFX.boop(0.8); s.act = 0.6; break;
      case 'ladder': [523, 587, 659, 698, 784, 880, 988].forEach((f, i) => tone('triangle', f, i * 0.09, 0.14, 0.1)); s.act = 1; break;
      case 'bell': SFX.bell(); s.act = 2; break;
      case 'flame': noise(0, 0.5, 0.12, 2400, 2); for (let i = 0; i < 6; i++) noise(i * 0.08, 0.03, 0.08, rand(1500, 4000), 3); s.act = 1.4;
        spawn(6, () => ({ x: cx + rand(-4, 4), y: cy - bh * 0.3, vx: rand(-12, 12), vy: rand(-50, -25), g: 0, life: 0.6, max: 0.6, s: 1, c: Math.random() < 0.5 ? '#ffd21f' : '#f57a12' }));
        break;
      case 'star': SFX.chime(); sparkle(cx, cy, 16, 10); s.act = 1.2; break;
      case 'heart': SFX.boop(1.3); setTimeout(() => SFX.boop(1.6), 160); s.act = 0.8;
        spawn(4, i => ({ x: cx + (i - 1.5) * 4, y: cy - 6, vx: (i - 1.5) * 6, vy: -24, g: 0, life: 0.9, max: 0.9, s: 2, c: '#ff6fb4' }));
        break;
      case 'balloon': tone('sine', 400, 0, 0.7, 0.12, 900); s.act = 1; s.rise = 0.9; break;
      case 'sun': SFX.sunrise(); s.act = 1.6; sparkle(cx, cy, 14, 8); break;
      case 'rainbow': [523, 587, 659, 784, 880, 1047].forEach((f, i) => tone('sine', f, i * 0.08, 0.3, 0.12)); sparkle(cx, cy - 4, 20, 12, '#ffffff'); s.act = 1; break;
      case 'cloud': noise(0, 1.3, 0.14, 4000, 0.4); s.act = 1.5; break;
      case 'flower': SFX.peep(); setTimeout(SFX.peep, 120); sparkle(cx, cy - bh * 0.3, 8, 6, '#ffb3da'); s.act = 1; break;
    }
  }

  /* ---------- rendering a sticker: sprite → white outline → scaled onto the target ---------- */
  const sprC = document.createElement('canvas'), outC = document.createElement('canvas');
  sprC.width = outC.width = 96; sprC.height = outC.height = 64;
  const sprG = sprC.getContext('2d'), outG = outC.getContext('2d');
  const OFFS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const IDLE = { on: false, t: 9, dir: 1, seed: 0 };
  function bake(d, a) {
    sprG.clearRect(0, 0, 96, 64);
    const prev = g; g = sprG;
    try { d.draw(PAD, PAD, a); } finally { g = prev; }
    outG.clearRect(0, 0, 96, 64);
    for (const [ox, oy] of OFFS) outG.drawImage(sprC, ox, oy);
    outG.globalCompositeOperation = 'source-in'; outG.fillStyle = '#ffffff'; outG.fillRect(0, 0, 96, 64);
    outG.globalCompositeOperation = 'source-over';
    outG.drawImage(sprC, 0, 0);
  }
  const anim = s => ({ on: s.act > 0, t: s.at, dir: s.d || 1, seed: s.seed || 0, lt: s.lt || 0 });
  // Draw sticker d centered on (cx, cy), sc times sprite size, onto the current g.
  function stamp(d, a, cx, cy, sc) {
    bake(d, a);
    const cw = d.w + 2 * PAD, ch = d.h + 2 * PAD;
    const dx = Math.round(cx - d.w * sc / 2 - PAD * sc), dy = Math.round(cy - d.h * sc / 2 - PAD * sc);
    g.imageSmoothingEnabled = false;
    g.drawImage(outC, 0, 0, cw, ch, dx, dy, Math.round(cw * sc), Math.round(ch * sc));
    return [dx, dy];
  }
  // Fit sticker d into a w×h box centered at (cx, cy).
  function preview(d, cx, cy, w, h, grow = 1) {
    const sc = Math.min(d.k, (w - 2) / (d.w + 2), (h - 2) / (d.h + 2)) * grow;
    stamp(d, IDLE, cx, cy, sc);
  }

  /* ---------- board state & storage ---------- */
  const board = () => boards[bg];
  function load() {
    boards = BG.map(() => []);
    try {
      const o = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (o && Array.isArray(o.b)) {
        boards = BG.map((_, i) => (Array.isArray(o.b[i]) ? o.b[i] : [])
          .filter(e => Array.isArray(e) && DEFS[e[0]] && isFinite(e[1]) && isFinite(e[2]))
          .map(e => mk(e[0], e[1], e[2], e[3] === -1 ? -1 : 1)));
        if (o.bg >= 0 && o.bg < BG.length) bg = o.bg | 0;
      }
    } catch (e) { /* storage unavailable */ }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ bg, b: boards.map(list => list.map(s => [s.id, +s.fx.toFixed(4), +(s.ret != null ? s.ret : s.fy).toFixed(4), s.d || 1])) })); } catch (e) {}
  }
  function mk(id, fx, fy, d = 1) { return { id, fx: clamp(fx, 0, 1), fy: clamp(fy, 0, 1), d, act: 0, at: 9, bn: 0, walk: 0, rise: 0, rv: 0, ret: null, launch: 0, seed: Math.random() * 6, fly: null }; }
  // Where a sticker sits on screen right now (kept fully inside the picture).
  function pos(s) {
    const d = DEFS[s.id], bw = d.w * d.k, bh = d.h * d.k;
    const cx = clamp(G.x0 + s.fx * G.pw, G.x0 + bw / 2 + 2, G.x1 - bw / 2 - 2);
    const cy = clamp(G.y0 + s.fy * G.ph, G.y0 + bh / 2 + 2, G.y1 - bh / 2 - 2);
    return [Math.round(cx), Math.round(cy)];
  }
  function setPos(s, cx, cy) {
    // don't let a sticker hide under the picture-switching buttons, where it couldn't be grabbed
    const zx = Y.bgNext.x + Y.bgNext.s + 4, zy = Y.bgPrev.y + Y.bgPrev.s + 4, d = DEFS[s.id];
    if (cx < zx && cy < zy) cy = zy + d.h * d.k * 0.25; s.fx = clamp((cx - G.x0) / G.pw, 0, 1); s.fy = clamp((cy - G.y0) / G.ph, 0, 1); [cx, cy] = pos(s); s.fx = (cx - G.x0) / G.pw; s.fy = (cy - G.y0) / G.ph; }
  function hitSticker(x, y) {
    const list = board();
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]; if (s.fly) continue;
      const d = DEFS[s.id], [cx, cy] = pos(s), hw = d.w * d.k / 2 + 4, hh = d.h * d.k / 2 + 4;
      if (Math.abs(x - cx) <= hw && Math.abs(y - cy) <= hh) return s;
    }
    return null;
  }
  function land(s) {
    const [cx, cy] = pos(s), d = DEFS[s.id];
    SFX.pop(); s.bn = 0.45;
    sparkle(cx, cy, d.w * d.k / 2 + 2, 8);
    save();
  }
  function addSticker(s) {
    const list = board();
    list.push(s);
    while (list.length > MAX_ON_BOARD) list.shift();
  }

  /* ---------- layout ---------- */
  function layout() {
    const uw = W - L.safeL - L.safeR, uh = H - L.safeT - L.safeB;
    const rows = uh > uw * 1.9 ? 3 : uh > uw * 1.25 ? 2 : 1;
    const b = clamp(L.blob + 2, 24, 32), gap = 3, aw = 18, slotH = 34, tabH = 18;
    Y.rows = rows; Y.b = b;
    Y.palH = tabH + gap + rows * slotH + (rows - 1) * gap + 8;
    Y.stripY = H - L.safeB - Y.palH;
    const top = Y.stripY + 4 + tabH + gap, inner = rows * slotH + (rows - 1) * gap;
    const left = L.safeL + 4, right = W - L.safeR - 4;
    let sx0, sx1;
    if (rows >= 2) {
      Y.home = { x: left, y: top + Math.floor((slotH - b) / 2), s: b };
      Y.clean = { x: left, y: top + (rows - 1) * (slotH + gap) + Math.floor((slotH - b) / 2), s: b };
      Y.prev = { x: left + b + 4, y: top, w: aw, h: inner };
      Y.next = { x: right - aw, y: top, w: aw, h: inner };
    } else {
      Y.home = { x: left, y: top + Math.floor((slotH - b) / 2), s: b };
      Y.clean = { x: right - b, y: Y.home.y, s: b };
      Y.prev = { x: left + b + 6, y: top, w: aw, h: inner };
      Y.next = { x: right - b - 6 - aw, y: top, w: aw, h: inner };
    }
    sx0 = Y.prev.x + aw + gap; sx1 = Y.next.x - gap;
    const avail = sx1 - sx0;
    Y.cols = Math.max(1, Math.floor((avail + gap) / (36 + gap)), Math.min(4, Math.floor((avail + gap) / (32 + gap))));
    Y.slotW = Math.min(48, Math.floor((avail - (Y.cols - 1) * gap) / Y.cols));
    Y.slotH = slotH; Y.gap = gap;
    const used = Y.cols * Y.slotW + (Y.cols - 1) * gap;
    Y.tx = sx0 + Math.floor((avail - used) / 2); Y.ty = top; Y.tw = used; Y.th = inner;
    Y.per = Y.cols * rows;
    // pages: each group of stickers starts on a page of its own
    const was = PAGES[page] && PAGES[page].ids[0];
    PAGES = [];
    CATS.forEach((c, ci) => {
      const n = Math.ceil(c.ids.length / Y.per), each = Math.ceil(c.ids.length / n);
      for (let i = 0; i < c.ids.length; i += each) PAGES.push({ cat: ci, ids: c.ids.slice(i, i + each) });
    });
    Y.pages = PAGES.length;
    page = Math.max(0, PAGES.findIndex(p => p.ids.includes(was)));
    // the group tabs along the top of the tray
    const tl = rows >= 2 ? left : Y.prev.x, tr = rows >= 2 ? right : Y.next.x + aw, n = CATS.length;
    const tw = Math.min(46, Math.floor((tr - tl - (n - 1) * 4) / n)), tx0 = Math.round((tl + tr) / 2 - (n * tw + (n - 1) * 4) / 2);
    Y.tabs = CATS.map((c, i) => ({ x: tx0 + i * (tw + 4), y: Y.stripY + 4, w: tw, h: tabH, cat: i }));
    // the two picture-switching arrows, top left
    Y.bgPrev = { x: L.safeL + 6, y: L.safeT + 6, s: b };
    Y.bgNext = { x: L.safeL + 6 + b + 8, y: L.safeT + 6, s: b };
    Object.assign(G, { x0: L.safeL, y0: L.safeT, x1: W - L.safeR, y1: Y.stripY });
    G.pw = G.x1 - G.x0; G.ph = G.y1 - G.y0;
    G.hy = Math.round(G.y0 + G.ph * 0.45);
    geo = BUILD.map(f => f());
    if (scene === 'stickers') setClouds(L.sunY + 30, Math.max(L.sunY + 40, G.hy - 24));
  }

  /* ---------- backgrounds ---------- */
  // Keep tall scenery out of the sun/moon's corner so they stay visible and tappable.
  const sunCap = (x, w) => (x + w > L.sunX - 30 && x < L.sunX + 30 ? L.sunY + 30 : G.y0 + 20);
  function shops(r, base, minH, maxH, colors) {
    const out = [];
    for (let x = -4; x < W;) {
      const w = 30 + (r() * 18 | 0);
      const top = Math.max(base - minH - (r() * (maxH - minH) | 0), sunCap(x, w));
      out.push({ x, w, top: Math.min(top, base - 14), c: colors[r() * colors.length | 0], awn: r() < 0.5, lit: r() });
      x += w + (r() * 5 | 0);
    }
    return out;
  }
  function buildStreet() {
    const r = rng(11 + W), bY = G.hy + Math.round((G.y1 - G.hy) * 0.16);
    const roadY = bY + 7, roadH = clamp(Math.round((G.y1 - bY) * 0.42), 28, 64);
    const lamps = []; for (let x = 30; x < W; x += 70) lamps.push(x);
    const g0 = roadY + roadH + 10, flowers = [];
    for (let i = 0; i < Math.round(W * Math.max(0, G.y1 - g0) / 700); i++) flowers.push({ x: r() * W | 0, y: g0 + (r() * (G.y1 - g0 - 4) | 0), c: ['#ff6fb4', '#ffffff', '#ffd21f'][r() * 3 | 0] });
    const low = buildLowPark(g0 - 4, G.y1, 5);
    return { bY, roadY, roadH, lamps, low, flowers: low ? [] : flowers, shops: shops(r, bY, 26, 64, ['#f2d16b', '#9ad0f5', '#f5a3c7', '#b6e3a1', '#f0b27a', '#c9b6f2', '#e8e1d0']) };
  }
  function buildStation() {
    const sb = G.hy + Math.round((G.y1 - G.hy) * 0.32);
    const sw = Math.min(Math.round(G.pw * 0.8), 210), sx = Math.round(G.x0 + (G.pw - sw) / 2);
    let sh = clamp(Math.round((sb - G.y0) * 0.55), 44, 84);
    sh = Math.min(sh, sb - sunCap(sx, sw) - 4);
    const n = sw >= 160 ? 3 : 2, dh = Math.round(sh * 0.6), dw = Math.floor((sw - 12 - (n - 1) * 6) / n);
    const tower = sb - sh - 22 >= sunCap(sx + 6, 18);
    // on tall screens the driveway meets a street, with a little park on the other side
    let road = null, low = null;
    if (G.y1 - sb >= 110) {
      road = { y: sb + Math.round((G.y1 - sb) * 0.24), h: clamp(Math.round((G.y1 - sb) * 0.18), 24, 34) };
      low = buildLowPark(road.y + road.h + 6, G.y1, 9);
    }
    return { sb, sw, sx, sh, n, dh, dw, tower, road, low };
  }
  function buildPark() {
    const r = rng(23 + W), gh = G.y1 - G.hy;
    const trees = [];
    for (let x = G.x0 + 10 + (r() * 12 | 0); x < G.x1 - 6; x += 30 + (r() * 16 | 0)) {
      const rr = 8 + (r() * 5 | 0), top = G.hy + 4 - 2 * rr - 12;
      if (top >= sunCap(x - rr, 2 * rr)) trees.push({ x, r: rr });
    }
    const pond = { cx: Math.round(G.x0 + G.pw * 0.56), cy: Math.round(G.hy + gh * 0.56), rx: Math.round(clamp(G.pw * 0.3, 30, 110)), ry: Math.round(clamp(gh * 0.2, 12, 40)) };
    const flowers = [];
    const n = Math.round(G.pw * gh / 500);
    for (let i = 0; i < n; i++) {
      const x = G.x0 + r() * G.pw | 0, y = G.hy + 10 + r() * (gh - 14) | 0;
      if (((x - pond.cx) / (pond.rx + 8)) ** 2 + ((y - pond.cy) / (pond.ry + 8)) ** 2 < 1) continue;
      flowers.push({ x, y, c: ['#ff6fb4', '#ffffff', '#ffd21f', '#c39bff'][r() * 4 | 0] });
    }
    // a playground below the pond when the grass is tall
    const playY = pond.cy + pond.ry + 34;
    const play = G.y1 - playY >= 4 && gh >= 150 ? { y: Math.min(G.y1 - 4, playY + Math.round((G.y1 - playY) * 0.5)), x: Math.round(G.x0 + G.pw * 0.38) } : null;
    if (play) for (let i = flowers.length - 1; i >= 0; i--) if (flowers[i].y > playY - 30 && flowers[i].y < play.y + 2 && flowers[i].x > play.x - 6) flowers.splice(i, 1);
    const pads = [[-0.45, -0.1], [0.3, 0.3], [0.5, -0.3]].map(([a, bb]) => ({ x: pond.cx + Math.round(a * pond.rx), y: pond.cy + Math.round(bb * pond.ry) }));
    return { trees, pond, flowers, pads, play };
  }
  function buildCity() {
    const r = rng(37 + W), bY = G.hy + Math.round((G.y1 - G.hy) * 0.22);
    const far = [];
    for (let x = -6; x < W;) {
      const w = 18 + (r() * 14 | 0);
      far.push({ x, w, top: Math.max(bY - 40 - (r() * 60 | 0), sunCap(x, w)) });
      x += w;
    }
    const near = [];
    for (let x = -4; x < W;) {
      const w = 26 + (r() * 18 | 0), top = Math.min(bY - 20, Math.max(bY - 26 - (r() * 56 | 0), sunCap(x, w)));
      const wins = [];
      for (let wy = top + 5; wy < bY - 8; wy += 7) for (let wx = x + 4; wx < x + w - 5; wx += 6) wins.push({ x: wx, y: wy, on: r() < 0.55 });
      near.push({ x, w, top, c: ['#4a4f6e', '#5a5375', '#3f5468', '#6a5a7a'][r() * 4 | 0], wins, ant: r() < 0.35 && top - 8 > sunCap(x, w) });
      x += w + 2 + (r() * 4 | 0);
    }
    const roadY = bY + 6, roadH = clamp(Math.round((G.y1 - bY) * 0.4), 26, 60);
    const lamps = []; for (let x = 24; x < W; x += 60) lamps.push(x);
    return { bY, far, near, roadY, roadH, lamps };
  }

  /* ---------- extra scenery for the tall grass on portrait screens ---------- */
  function slide(x, yb) {   // ladder on the left, slide down to the right (about 34 x 24)
    R(x, yb - 22, 2, 22, '#e8222b'); R(x + 7, yb - 22, 2, 22, '#e8222b');
    for (let y = yb - 19; y < yb; y += 4) R(x + 2, y, 5, 1, '#ffd21f');
    R(x - 1, yb - 24, 11, 3, '#2a6fe0'); R(x - 1, yb - 30, 1, 6, '#2a6fe0'); R(x + 9, yb - 30, 1, 6, '#2a6fe0');
    for (let k = 0; k < 20; k++) { R(x + 10 + k, yb - 22 + k, 3, 2, '#ffd21f'); R(x + 10 + k, yb - 20 + k, 3, 1, '#e0b010'); }
    R(x + 29, yb - 3, 5, 2, '#ffd21f'); R(x + 18, yb - 13, 1, 13, '#e8222b');
  }
  function swings(x, yb) {   // a frame with two swinging seats (about 30 x 24)
    R(x, yb - 24, 30, 2, '#2a6fe0');
    for (const lx of [x, x + 28]) { R(lx, yb - 22, 2, 22, '#2a6fe0'); R(lx - 2, yb - 1, 6, 1, '#1d4fa8'); }
    [['#e8222b', 8], ['#3fb43a', 20]].forEach(([c, sx], i) => {
      const dx = Math.round(Math.sin(T * 2 + i * 2.2) * 3);
      for (let k = 0; k < 15; k++) { const ox = Math.round(dx * k / 15); R(x + sx - 2 + ox, yb - 22 + k, 1, 1, '#3a3d46'); R(x + sx + 2 + ox, yb - 22 + k, 1, 1, '#3a3d46'); }
      R(x + sx - 3 + dx, yb - 7, 7, 2, c);
    });
  }
  function sandbox(x, yb, w = 26) {
    R(x, yb - 9, w, 9, '#a8743f'); R(x + 2, yb - 7, w - 4, 6, '#f2d98a'); R(x + 3, yb - 6, 4, 1, '#fff0b8');
    R(x + 6, yb - 6, 5, 4, '#e8222b'); R(x + 5, yb - 7, 7, 1, '#b31a22');   // a bucket
    R(x + w - 9, yb - 5, 4, 2, '#2a6fe0'); R(x + w - 6, yb - 7, 1, 3, '#2a6fe0');   // and a spade
  }
  function bench(x, yb) {
    R(x, yb - 8, 16, 2, '#a8743f'); R(x, yb - 5, 16, 2, '#8a5a2a');
    R(x + 1, yb - 3, 2, 3, '#3a3d46'); R(x + 13, yb - 3, 2, 3, '#3a3d46');
  }
  function smallPond(cx, cy, rx, ry, duck = true) {
    ellipse(cx, cy + 1, rx + 3, ry + 3, '#5aa84c');
    ellipse(cx, cy, rx + 2, ry + 2, '#d9c48a');
    ellipse(cx, cy, rx, ry, '#3f95d4');
    ellipse(cx, cy + 1, Math.max(2, rx - 4), Math.max(1, ry - 3), '#5aaee6');
    R(cx - (rx >> 1), cy - (ry >> 2), 6, 1, '#bfe6ff'); R(cx + 2, cy + (ry >> 2), 5, 1, '#bfe6ff');
    if (duck) {
      const dx = Math.round(Math.sin(T * 0.5) * rx * 0.45), dir = Math.cos(T * 0.5) >= 0 ? 1 : -1;
      drawDuck(cx + dx, cy + 2, true, dir); drawDuck(cx + dx - dir * 9, cy + 3, false, dir);
    }
  }
  function fountain(cx, yb) {
    ellipse(cx, yb - 4, 22, 6, '#c9c4b8'); ellipse(cx, yb - 5, 19, 4, '#3f95d4'); ellipse(cx, yb - 5, 15, 2, '#5aaee6');
    R(cx - 2, yb - 16, 4, 12, '#c9c4b8'); ellipse(cx, yb - 16, 7, 2, '#c9c4b8'); ellipse(cx, yb - 17, 5, 1, '#5aaee6');
    for (let k = 0; k < 6; k++) {   // water arcs, sparkling as they fall
      const side = k % 2 ? 1 : -1, ph = (T * 1.6 + k * 0.33) % 1, d = 4 + ph * 12;
      R(cx + side * Math.round(d) - 1, yb - 18 - Math.round(Math.sin(ph * Math.PI) * 6) + Math.round(ph * 10), 2, 2, k % 3 ? '#bfe6ff' : '#ffffff');
    }
    R(cx - 1, yb - 23 + (Math.floor(T * 8) % 2), 2, 5, '#bfe6ff');
  }
  function planter(x, yb, r) { R(x - 6, yb - 6, 12, 6, '#a8743f'); R(x - 5, yb - 5, 10, 1, '#c98a4b'); drawTree(x, yb - 5, r); }
  function flowerBits(list) { for (const f of list) { R(f.x, f.y, 3, 1, f.c); R(f.x + 1, f.y - 1, 1, 3, f.c); R(f.x + 1, f.y, 1, 1, '#ffd21f'); } }

  // A little park for an empty strip of grass: a footpath, a playground, a pond and a bench.
  function buildLowPark(y0, y1, seed) {
    const h = y1 - y0;
    if (h < 46) return null;
    const r = rng(seed + W), x0 = G.x0, x1 = G.x1, pw = x1 - x0;
    const pathX = Math.round(x0 + pw * 0.5);
    const big = h >= 84;
    const play = { slideX: Math.round(x0 + pw * 0.06), slideY: Math.round(y0 + (big ? h * 0.42 : h * 0.62)), swingX: Math.round(pathX - 40), swingY: Math.round(y0 + h * 0.9), sandX: Math.round(x0 + pw * 0.05) };
    const pond = { cx: Math.round(x0 + pw * 0.76), cy: Math.round(y0 + h * (big ? 0.38 : 0.5)), rx: Math.round(clamp(pw * 0.17, 18, 60)), ry: Math.round(clamp(h * 0.14, 7, 18)) };
    const flowers = [];
    for (let i = 0; i < Math.round(pw * h / 450); i++) {
      const x = x0 + (r() * pw | 0), y = y0 + 4 + (r() * (h - 6) | 0);
      if (Math.abs(x - pathX) < 12) continue;
      if (((x - pond.cx) / (pond.rx + 7)) ** 2 + ((y - pond.cy) / (pond.ry + 7)) ** 2 < 1) continue;
      flowers.push({ x, y, c: ['#ff6fb4', '#ffffff', '#ffd21f', '#c39bff'][r() * 4 | 0] });
    }
    return { y0, y1, h, big, pathX, play, pond, flowers, benchX: pathX + 10, benchY: Math.round(y0 + h * (big ? 0.82 : 0.9)), treeX: Math.round(x1 - pw * 0.08) };
  }
  function drawLowPark(p) {
    if (!p) return;
    // footpath winding down from the top, with a loop out to the pond
    for (let y = p.y0; y < p.y1; y++) {
      const k = (y - p.y0) / p.h, w = 8 + Math.round(k * 6), x = p.pathX + Math.round(Math.sin(k * 3.2) * 6);
      R(x - (w >> 1), y, w, 1, '#e4cf96');
    }
    const py = p.pond.cy + p.pond.ry + 6;
    if (py < p.y1 - 3) R(p.pathX, py, p.pond.cx - p.pathX, 5, '#e4cf96');
    flowerBits(p.flowers);
    smallPond(p.pond.cx, p.pond.cy, p.pond.rx, p.pond.ry);
    slide(p.play.slideX, p.play.slideY);
    if (p.big) { swings(p.play.swingX, p.play.swingY); sandbox(p.play.sandX, Math.min(p.y1 - 2, p.play.swingY)); }
    else sandbox(p.play.slideX + 40, p.play.slideY);
    bench(p.benchX, p.benchY);
    if (p.big) drawTree(p.treeX, Math.min(p.y1 - 1, p.benchY + 4), 10);
  }

  function backHills(y, c = '#8fd877') {
    // a hill that would hide the sun/moon sinks a little lower
    const hill = (x, cy, r, col) => {
      if (x + r > L.sunX - 26 && x - r < L.sunX + 26) cy = Math.max(cy, L.sunY + 28 + r);
      circle(x, cy, r, col);
    };
    hill(W * 0.15, y + 30, 46, c); hill(W * 0.85, y + 34, 50, c); hill(W * 0.5, y + 52, 70, '#7ccd66');
  }
  function road(y, h) {
    R(0, y, W, h, '#4b4f5c'); R(0, y, W, 2, '#3a3d46');
    for (let x = 4; x < W; x += 20) R(x, y + Math.floor(h / 2) - 1, 10, 2, '#ffd21f');
  }
  function lamp(x, base) { R(x, base - 26, 2, 26, '#3a3d46'); R(x - 2, base - 29, 6, 3, '#3a3d46'); R(x - 1, base - 26, 4, 1, '#fff6b0'); }
  function drawStreet(q) {
    backHills(G.hy - 30);
    R(0, G.hy, W, q.bY - G.hy, '#8fd877');
    for (const s of q.shops) {
      const h = q.bY - s.top;
      R(s.x - 1, s.top - 2, s.w + 2, 2, '#6b5a4a'); R(s.x, s.top, s.w, h, s.c);
      alpha(0.12, () => R(s.x, s.top, 2, h, '#000000'));
      for (let wy = s.top + 5; wy < q.bY - 16; wy += 10) for (let wx = s.x + 4; wx < s.x + s.w - 7; wx += 9) {
        R(wx - 1, wy - 1, 7, 8, '#ffffff'); R(wx, wy, 5, 6, GLASS); R(wx + 1, wy + 1, 1, 2, '#ffffff');
      }
      const dx = s.x + (s.w >> 1) - 3;
      R(dx - 1, q.bY - 11, 8, 11, '#ffffff'); R(dx, q.bY - 10, 6, 10, '#8a5a3a'); R(dx + 4, q.bY - 5, 1, 1, '#ffd21f');
      if (s.awn && h > 30) for (let k = 0; k < s.w - 4; k += 4) R(s.x + 2 + k, q.bY - 15, 4, 3, (k / 4) % 2 ? '#ffffff' : '#e8222b');
    }
    R(0, q.bY, W, 7, '#d8d2c4'); R(0, q.bY + 6, W, 1, '#b5ae9f');
    for (const x of q.lamps) lamp(x, q.bY + 3);
    road(q.roadY, q.roadH);
    const w2 = q.roadY + q.roadH;
    R(0, w2, W, 6, '#d8d2c4'); R(0, w2 + 5, W, 1, '#b5ae9f');
    R(0, w2 + 6, W, H - w2 - 6, '#6cbf5a');
    for (let x = 8; x < W; x += 26) R(x, w2 + 12 + (x % 7), 2, 2, '#7cc96a');
    flowerBits(q.flowers);
    drawLowPark(q.low);
  }
  function drawStation(q) {
    backHills(G.hy - 20);
    R(0, G.hy, W, H - G.hy, '#6cbf5a');
    const { sb, sw, sx, sh, n, dh, dw } = q, top = sb - sh, cx = sx + (sw >> 1);
    // driveway
    const dEnd = q.road ? q.road.y : G.y1;
    for (let y = sb; y < dEnd; y++) { const e = Math.round((y - sb) * 0.35); R(sx - e, y, sw + 2 * e, 1, '#c9c4b8'); }
    for (let i = 0; i < n; i++) { const dx = sx + 6 + i * (dw + 6) + (dw >> 1); R(dx, sb + 4, 1, dEnd - sb - 4, '#b3ad9f'); }
    if (q.road) {
      road(q.road.y, q.road.h);
      const w2 = q.road.y + q.road.h;
      R(0, w2, W, 6, '#d8d2c4'); R(0, w2 + 5, W, 1, '#b5ae9f');
      bmp(sx + sw + 8, w2 - 10, HYDRANT, { a: '#e8222b', b: '#a3121d', c: '#ff7a6b', d: '#7a1018', y: '#ffd21f' });
      drawLowPark(q.low);
    }
    for (const tx of [sx - 26, sx + sw + 26]) if (tx > -10 && tx < W + 10) drawTree(tx, sb, 11);
    if (q.tower) {
      R(sx + 6, top - 22, 20, 22, '#c0503a'); R(sx + 4, top - 26, 24, 4, '#7a2f24');
      R(sx + 11, top - 18, 10, 12, '#2c2433'); bmp(sx + 10, top - 16, BELL.slice(1), { a: '#ffd21f', b: '#c99410', c: '#fff27a' });
    }
    R(sx - 4, top - 4, sw + 8, 4, '#7a2f24');
    R(sx, top, sw, sh, '#c0503a');
    for (let y = 3; y < sh; y += 4) { R(sx, top + y, sw, 1, '#a8432f'); for (let x = (y % 8 ? 4 : 0); x < sw; x += 8) R(sx + x, top + y + 1, 1, 3, '#a8432f'); }
    // sign
    const big = sh - dh >= 24, ts = big ? 2 : 1, tw = textWidth('FIRE', ts);
    R(cx - (tw >> 1) - 4, top + 3, tw + 8, 5 * ts + 6, '#fff6e0');
    text('FIRE', cx - (tw >> 1), top + 6, ts, '#e8222b');
    for (let i = 0; i < n; i++) {
      const dx = sx + 6 + i * (dw + 6);
      R(dx - 2, sb - dh - 2, dw + 4, dh + 2, '#f4f7fb');
      R(dx, sb - dh, dw, dh, '#2c2433');
      R(dx, sb - dh, dw, 7, '#d5dce3'); R(dx, sb - dh + 3, dw, 1, '#aab3bd'); R(dx, sb - dh + 6, dw, 1, '#aab3bd');
      R(dx + (dw >> 1) - 3, sb - dh + 8, 6, 1, '#fff6b0');
    }
    if (sx + sw + 14 < W) { R(sx + sw + 6, top - 26, 1, 26 + sh, '#8b96a1'); R(sx + sw + 7, top - 26 + (Math.floor(T * 3) % 2), 10, 6, '#e8222b'); R(sx + sw + 7, top - 23 + (Math.floor(T * 3) % 2), 10, 1, '#ffffff'); }
  }
  function drawPark(q) {
    backHills(G.hy - 24);
    R(0, G.hy, W, H - G.hy, '#6cbf5a');
    for (const t of q.trees) drawTree(t.x, G.hy + 4, t.r);
    // winding path
    for (let y = G.hy + 2; y < G.y1; y++) {
      const k = (y - G.hy) / (G.y1 - G.hy), w = 6 + Math.round(k * 16);
      const x = G.x0 + G.pw * 0.18 + Math.sin(k * 4) * G.pw * 0.08;
      R(x - w / 2, y, w, 1, '#e4cf96');
    }
    for (const f of q.flowers) { R(f.x, f.y, 3, 1, f.c); R(f.x + 1, f.y - 1, 1, 3, f.c); R(f.x + 1, f.y, 1, 1, '#ffd21f'); }
    const p = q.pond;
    ellipse(p.cx, p.cy + 1, p.rx + 3, p.ry + 3, '#5aa84c');
    ellipse(p.cx, p.cy, p.rx + 2, p.ry + 2, '#d9c48a');
    ellipse(p.cx, p.cy, p.rx, p.ry, '#3f95d4');
    ellipse(p.cx, p.cy + 1, p.rx - 4, Math.max(2, p.ry - 3), '#5aaee6');
    for (let i = 0; i < 5; i++) {
      const sx = p.cx + Math.round(Math.sin(i * 2.3 + T * 0.6) * p.rx * 0.6), sy = p.cy - Math.round(p.ry * 0.5) + i * Math.round(p.ry / 3);
      if (Math.abs(sy - p.cy) < p.ry - 1) R(sx - 3, sy, 6, 1, '#bfe6ff');
    }
    for (const lp of q.pads) { ellipse(lp.x, lp.y, 4, 2, '#3fb43a'); R(lp.x, lp.y - 2, 2, 2, '#1f7a2a'); }
    R(q.pads[1].x - 1, q.pads[1].y - 2, 2, 2, '#ffb3da');
    for (let i = 0; i < 4; i++) { const rx = p.cx - p.rx - 2 + i * 3; R(rx, p.cy - 10 + (i % 2) * 2, 1, 10, '#3f7a2a'); R(rx, p.cy - 12 + (i % 2) * 2, 1, 3, '#8a5a2a'); }
    if (q.play) {
      const { x, y } = q.play;
      R(x - 4, y - 30, Math.min(W - x, 112), 32, '#d9b97a'); R(x - 3, y - 29, Math.min(W - x, 112) - 2, 30, '#ecd49a');   // soft sand under the playground
      slide(x, y - 1); swings(x + 42, y - 1); sandbox(x + 78, y - 1, 24);
      bench(Math.round(G.x0 + G.pw * 0.04), Math.round(p.cy + p.ry + 18));
      drawDuck(p.cx + p.rx * 0.2 + Math.sin(T * 0.4) * p.rx * 0.4, p.cy + 1, true, Math.cos(T * 0.4) >= 0 ? 1 : -1);
    }
  }
  function drawCity(q) {
    R(0, G.hy, W, H - G.hy, '#6a7090');
    for (const b of q.far) R(b.x, b.top, b.w, q.bY - b.top, '#7f86ad');
    for (const b of q.near) {
      R(b.x, b.top, b.w, q.bY - b.top, b.c); R(b.x, b.top, b.w, 2, '#2f3350');
      if (b.ant) { R(b.x + (b.w >> 1), b.top - 8, 1, 8, '#2f3350'); }
      for (const w of b.wins) R(w.x, w.y, 3, 4, w.on ? '#ffe873' : '#2a2f45');
    }
    R(0, q.bY, W, 6, '#9a96a8'); R(0, q.bY + 5, W, 1, '#7a7690');
    for (const x of q.lamps) lamp(x, q.bY + 3);
    road(q.roadY, q.roadH);
    const w2 = q.roadY + q.roadH;
    R(0, w2, W, H - w2, '#9a96a8');
    for (let y = w2 + 6; y < G.y1; y += 8) R(0, y, W, 1, '#8a8698');
    for (let x = 6; x < W; x += 14) R(x, w2 + 1, 1, G.y1 - w2, '#8a8698');
    const ph = G.y1 - w2;
    if (ph >= 50) {   // a plaza with a fountain, benches and planters
      const fy = w2 + Math.round(ph * (ph >= 90 ? 0.55 : 0.75)), cx = Math.round(W / 2);
      ellipse(cx, fy - 4, 30, 10, '#b5b0c4');
      fountain(cx, fy);
      bench(cx - 50, fy - 2); bench(cx + 34, fy - 2);
      for (const px of [cx - 70, cx + 70]) if (px > 8 && px < W - 8) planter(px, fy + (ph >= 90 ? 24 : 2), 8);
      if (ph >= 90) for (const px of [cx - 36, cx + 36]) planter(px, w2 + 26, 7);
    }
  }
  // the train station out in the countryside: a platform, the tracks, a farm and its fields
  function buildRail() {
    const r = rng(41 + W), tY = G.hy + Math.round((G.y1 - G.hy) * 0.3);
    const stW = clamp(Math.round(G.pw * 0.32), 60, 96), stX = Math.round(G.x0 + G.pw * 0.07);
    const stH = clamp(tY - 6 - Math.max(G.y0 + 26, sunCap(stX - 4, stW + 8)) - 10, 18, 34);
    let barnX = Math.round(G.x0 + G.pw * 0.74);
    if (G.hy - 28 < sunCap(barnX, 34)) barnX = Math.round(G.x0 + G.pw * 0.5);
    const fY = tY + 22, bales = [], crops = [];
    for (let i = 0; i < Math.round(G.pw * Math.max(0, G.y1 - fY) / 2600); i++) bales.push({ x: G.x0 + 8 + (r() * (G.pw - 16) | 0), y: fY + 10 + (r() * Math.max(1, G.y1 - fY - 14) | 0) });
    bales.sort((a, b) => a.y - b.y);
    for (let i = 0; i < Math.round(G.pw * Math.max(0, G.y1 - fY) / 160); i++) crops.push({ x: r() * W | 0, y: fY + 2 + (r() * Math.max(1, G.y1 - fY - 3) | 0) });
    const pond = G.y1 - fY >= 90 ? { cx: Math.round(G.x0 + G.pw * 0.7), cy: Math.round(fY + (G.y1 - fY) * 0.62), rx: Math.round(clamp(G.pw * 0.18, 20, 50)), ry: 10 } : null;
    if (pond) for (let i = bales.length - 1; i >= 0; i--) if (Math.abs(bales[i].x - pond.cx) < pond.rx + 10 && Math.abs(bales[i].y - pond.cy) < pond.ry + 12) bales.splice(i, 1);
    return { tY, stW, stX, stH, barnX, fY, bales, crops, pond, sigX: Math.min(G.x1 - 10, stX + stW + 34) };
  }
  function drawRail(q) {
    backHills(G.hy - 26);
    R(0, G.hy, W, H - G.hy, '#8fd877');
    // the farm far away: a red barn and a silo, and a row of little trees
    const bx = q.barnX, by = G.hy + 6;
    R(bx, by - 14, 22, 14, '#c8432f'); for (let k = 0; k < 6; k++) R(bx - 1 + k, by - 15 - k, 24 - 2 * k, 1, '#8a2a1d');
    R(bx + 7, by - 9, 8, 9, '#f4f0e6'); R(bx + 8, by - 8, 6, 8, '#8a2a1d'); for (let k = 0; k < 6; k++) { R(bx + 8 + k, by - 8 + k, 1, 1, '#f4f0e6'); R(bx + 13 - k, by - 8 + k, 1, 1, '#f4f0e6'); }
    R(bx + 24, by - 22, 7, 22, '#cfd6dd'); R(bx + 24, by - 22, 2, 22, '#e8ecf0'); circle(bx + 27, by - 22, 3, '#9aa3ad');
    for (const tx of [0.42, 0.56, 0.92]) { const x = Math.round(G.x0 + G.pw * tx); if (Math.abs(x - bx - 14) > 24) drawTree(x, G.hy + 5, 6); }
    // the platform and the little station
    const base = q.tY - 6, sx = q.stX, sw = q.stW, top = base - q.stH, pw = Math.min(G.x1 - sx + 6, sw + 70);
    R(sx - 8, base, pw, 6, '#c9c4b8'); R(sx - 8, base, pw, 1, '#e8e2d6'); R(sx - 8, base + 5, pw, 1, '#a8a294'); R(sx - 8, base + 1, pw, 1, '#ffd21f');
    R(sx, top, sw, q.stH, '#f2d6a8'); R(sx, top, 2, q.stH, '#e0c08e');
    for (let k = 0; k < 7; k++) R(sx - 4 + k, top - 1 - k, sw + 8 - 2 * k, 1, k % 2 ? '#a83a2a' : '#c8432f');
    for (let x = sx - 4; x < sx + sw + 4; x += 4) R(x, top, 3, 2, '#c8432f');
    const cx = sx + (sw >> 1);
    circle(cx, top - 4, 3, '#ffffff'); R(cx, top - 6, 1, 3, INK); R(cx, top - 4, 2, 1, INK);
    R(cx - 5, base - 15, 10, 15, '#8a5a3a'); R(cx - 4, base - 14, 8, 6, '#9c6a48'); R(cx + 2, base - 7, 1, 1, '#ffd21f');
    for (const wx of [sx + 5, sx + sw - 15]) if (q.stH >= 20) { R(wx - 1, base - 16, 12, 10, '#ffffff'); R(wx, base - 15, 10, 8, GLASS); R(wx + 4, base - 15, 1, 8, '#ffffff'); }
    bench(sx + sw + 8, base);
    lamp(sx + sw + 28, base + 1);
    // the signal at the end of the platform
    const gx = q.sigX, green = Math.floor(T / 4) % 2 === 0;
    R(gx, q.tY - 30, 2, 28, '#3a3d46'); R(gx - 2, q.tY - 36, 6, 10, IRON);
    circle(gx + 1, q.tY - 33, 1, green ? '#5a2a2a' : '#ff3b3b'); circle(gx + 1, q.tY - 29, 1, green ? '#3fe060' : '#1f4a2a');
    // the tracks
    R(0, q.tY, W, 8, '#9a958d'); R(0, q.tY + 7, W, 1, '#7a766e');
    for (let x = 1; x < W; x += 7) R(x, q.tY + 1, 4, 5, '#7a5a3a');
    R(0, q.tY - 1, W, 2, '#5a5e6a'); R(0, q.tY - 1, W, 1, '#cfd6dd');
    // a white fence, then the fields
    R(0, q.tY + 8, W, q.fY - q.tY - 8, '#8fd877');
    for (let x = 3; x < W; x += 12) R(x, q.tY + 10, 2, 9, '#f4f0e6');
    R(0, q.tY + 12, W, 1, '#ffffff'); R(0, q.tY + 16, W, 1, '#ffffff');
    for (let y = q.fY, i = 0; y < H; y += 5, i++) R(0, y, W, 5, i % 2 ? '#7cc96a' : '#6cbf5a');
    for (const c of q.crops) { R(c.x, c.y, 2, 1, '#3f9a45'); R(c.x, c.y - 1, 1, 1, '#5bb85a'); }
    if (q.pond) smallPond(q.pond.cx, q.pond.cy, q.pond.rx, q.pond.ry);
    for (const b of q.bales) { circle(b.x, b.y - 4, 5, '#c9a040'); circle(b.x, b.y - 5, 4, '#e8c45a'); R(b.x - 1, b.y - 6, 3, 1, '#c9a040'); R(b.x - 2, b.y - 4, 1, 2, '#c9a040'); }
  }
  // the harbor: a sparkling sea with a lighthouse and sailboats, and a wooden dock in front
  function buildHarbor() {
    const dockH = clamp(Math.round(G.ph * 0.22), 24, 76), dY = G.y1 - dockH;
    let lx = null;
    for (const f of [0.84, 0.62, 0.16]) { const x = Math.round(G.x0 + G.pw * f); if (G.hy - 42 >= sunCap(x - 8, 16)) { lx = x; break; } }
    const crates = dockH >= 30 ? [{ x: G.x1 - 30, s: 10 }, { x: G.x1 - 19, s: 10 }, { x: G.x1 - 25, s: 9, up: true }] : [];
    return { dY, dockH, lx, crates, shed: dockH >= 50 };
  }
  function drawHarbor(q) {
    // far hills on the left, then the sea
    circle(G.x0 + 10, G.hy + 20, 34, '#7cc96a'); circle(G.x0 + 52, G.hy + 26, 30, '#8fd877');
    const bands = ['#6cc0ee', '#55b0e6', '#4aa2dc', '#3f95d4', '#3786c8'], sh = q.dY - G.hy;
    bands.forEach((c, i) => R(0, G.hy + Math.round(sh * i / bands.length), W, Math.ceil(sh / bands.length) + 1, c));
    R(0, G.hy, W, 1, '#bfe6ff');
    for (let i = 0; i < Math.round(W * sh / 260); i++) {
      const y = G.hy + 4 + ((i * 37) % Math.max(1, sh - 8)), x = ((i * 97 + T * (6 + (i % 3) * 3)) % (W + 20)) - 10, w = 2 + Math.round((y - G.hy) / sh * 4);
      R(Math.round(x), y, w, 1, '#d8f0ff');
    }
    // the lighthouse on its rock
    if (q.lx !== null) {
      const x = q.lx, b = G.hy + 6;
      ellipse(x, b, 14, 4, '#7a766e'); ellipse(x - 2, b - 1, 10, 3, '#9a958d');
      for (let k = 0; k < 4; k++) R(x - 5 + (k >> 1), b - 8 - k * 7, 10 - (k >> 1) * 2, 7, k % 2 ? '#ffffff' : '#e8222b');
      R(x - 5, b - 37, 10, 2, '#3a3d46'); R(x - 3, b - 43, 6, 6, '#ffe873'); R(x - 3, b - 43, 1, 6, '#3a3d46'); R(x + 2, b - 43, 1, 6, '#3a3d46');
      for (let k = 0; k < 3; k++) R(x - 4 + k, b - 44 - k, 8 - 2 * k, 1, '#e8222b');
    }
    // two little sailboats out at sea
    for (let i = 0; i < 2; i++) {
      const x = Math.round(((i * 0.45 + 0.2) * W + T * (3 + i * 2)) % (W + 30) - 15), y = G.hy + 6 + i * Math.round(sh * 0.25);
      R(x - 4, y - 2, 9, 2, i ? '#2a6fe0' : '#e8222b'); R(x - 3, y, 7, 1, '#1a3f9a');
      for (let k = 0; k < 7; k++) R(x, y - 3 - k, Math.round((7 - k) * 0.55), 1, '#ffffff');
      R(x - 1, y - 10, 1, 8, '#8a6a4a');
    }
    // the dock: planks, posts in the water, bollards, a life ring and crates
    R(0, q.dY, W, H - q.dY, '#c08a52');
    for (let y = q.dY + 3, i = 0; y < H; y += 5, i++) { R(0, y, W, 1, '#9a6a3a'); for (let x = (i % 2) * 18; x < W; x += 36) R(x, y + 1, 1, 4, '#9a6a3a'); }
    R(0, q.dY, W, 3, '#8a5a32'); R(0, q.dY, W, 1, '#dca86a');
    for (let x = 10; x < W; x += 34) { R(x, q.dY - 5, 4, 6, '#7a4a24'); R(x, q.dY - 5, 4, 1, '#9a6a3a'); }
    for (let x = 27; x < W; x += 68) { R(x - 2, q.dY + 4, 5, 5, '#3a3d46'); R(x - 3, q.dY + 3, 7, 2, '#5a5e6a'); }
    if (q.dockH >= 30) { const rx = G.x0 + 14, ry = q.dY + 8; circle(rx, ry + 5, 5, '#ffffff'); circle(rx, ry + 5, 2, '#c08a52'); R(rx - 5, ry + 4, 3, 2, '#e8222b'); R(rx + 3, ry + 4, 3, 2, '#e8222b'); R(rx - 1, ry, 2, 2, '#e8222b'); R(rx - 1, ry + 8, 2, 2, '#e8222b'); }
    for (const c of q.crates) {
      const yb = q.dY + 16 - (c.up ? 10 : 0), x = c.x, s = c.s;
      R(x, yb - s, s, s, '#c08a52'); R(x, yb - s, s, 1, '#dca86a'); R(x, yb - 1, s, 1, '#8a5a32'); R(x, yb - s, 1, s, '#8a5a32'); R(x + s - 1, yb - s, 1, s, '#8a5a32');
      for (let i = 1; i < s - 1; i++) R(x + i, yb - s + i, 1, 1, '#8a5a32');
    }
    if (q.shed) {   // a little red harbor shed
      const x = G.x0 + Math.round(G.pw * 0.3), yb = q.dY + 30;
      R(x, yb - 20, 34, 20, '#c8432f'); for (let k = 0; k < 5; k++) R(x - 2 + k, yb - 21 - k, 38 - 2 * k, 1, '#7a2f24');
      R(x + 13, yb - 13, 8, 13, '#8a2a1d'); R(x + 3, yb - 15, 7, 6, GLASS); R(x + 24, yb - 15, 7, 6, GLASS);
    }
  }
  const BG = [drawStreet, drawStation, drawPark, drawCity, drawRail, drawHarbor];
  const BUILD = [buildStreet, buildStation, buildPark, buildCity, buildRail, buildHarbor];

  // Lights that glow at night (not darkened).
  function drawBgLights(k) {
    const q = geo[bg];
    const lampGlow = (x, base) => { alpha(0.18 * k, () => circle(x + 1, base - 24, 6, '#ffe08a')); alpha(k, () => R(x - 1, base - 26, 4, 2, '#fffbe6')); };
    if (bg === 0) {
      for (const x of q.lamps) lampGlow(x, q.bY + 3);
      for (const s of q.shops) if (s.lit < 0.6) {
        alpha(0.85 * k, () => { for (let wy = s.top + 5; wy < q.bY - 16; wy += 10) for (let wx = s.x + 4; wx < s.x + s.w - 7; wx += 9) R(wx, wy, 5, 6, '#ffe873'); });
      }
    } else if (bg === 1) {
      for (let i = 0; i < q.n; i++) {   // a warm light falling from each garage lamp
        const dx = q.sx + 6 + i * (q.dw + 6) + (q.dw >> 1), ly = q.sb - q.dh + 8;
        alpha(k, () => R(dx - 3, ly, 6, 1, '#fffbe6'));
        alpha(0.14 * k, () => { for (let y = ly + 1; y < q.sb; y++) { const e = Math.min(q.dw >> 1, 3 + ((y - ly) >> 1)); R(dx - e, y, 2 * e, 1, '#fff3b0'); } });
      }
    } else if (bg === 4) {
      lampGlow(q.stX + q.stW + 28, q.tY - 5);
      if (q.stH >= 20) alpha(0.8 * k, () => { for (const wx of [q.stX + 5, q.stX + q.stW - 15]) R(wx, q.tY - 21, 10, 8, '#ffe873'); });
    } else if (bg === 5) {
      if (q.lx !== null) {
        const x = q.lx, y = G.hy - 34, sw = Math.sin(T * 1.2);
        alpha(0.3 * k, () => circle(x, y, 9, '#fff3b0'));
        alpha(0.18 * k, () => { for (let i = 1; i < 40; i++) R(Math.round(x + sw * i * 2.2), y - 2 + Math.round(i * 0.05), 2, 3 + (i >> 3), '#fff3b0'); });
        alpha(k, () => R(x - 2, y - 2, 4, 4, '#fffbe6'));
      }
    } else if (bg === 3) {
      alpha(k, () => { for (const b of q.near) for (const w of b.wins) if (w.on) R(w.x, w.y, 3, 4, '#ffe873'); });
      for (const b of q.near) if (b.ant && Math.floor(T * 1.5 + b.x) % 2) alpha(Math.max(0.4, k), () => R(b.x + (b.w >> 1) - 1, b.top - 9, 3, 2, RED_ON));
      for (const x of q.lamps) lampGlow(x, q.bY + 3);
    }
  }

  /* ---------- update ---------- */
  function update(dt) {
    for (const s of board()) {
      s.at += dt;
      if (s.act > 0) s.act -= dt;
      if (s.bn > 0) s.bn = Math.max(0, s.bn - dt);
      if (s.fly) { s.fly.t += dt; if (s.fly.t >= FLY) { s.fly = null; land(s); } }
      const d = DEFS[s.id];
      if (s.walk > 0) {
        s.walk -= dt;
        const [cx, cy] = pos(s), bw = d.w * d.k;
        let nx = cx + (s.d || 1) * 16 * dt;
        if (nx > G.x1 - bw / 2 - 3) { s.d = -1; nx = G.x1 - bw / 2 - 3; }
        if (nx < G.x0 + bw / 2 + 3) { s.d = 1; nx = G.x0 + bw / 2 + 3; }
        s.fx = (nx - G.x0) / G.pw; s.fy = (cy - G.y0) / G.ph;
        if (s.walk <= 0) save();
      }
      if (s.rise > 0) {
        s.rise -= dt;
        const [cx, cy] = pos(s);
        s.fx = (cx - G.x0) / G.pw; s.fy = (cy - (s.rv || 40) * dt - G.y0) / G.ph;
        if (s.rise <= 0) { setPos(s, ...pos(s)); s.rv = 0; if (s.ret == null) save(); }
      } else if (s.ret != null && s.launch !== 1) {   // the rocket floats back down to where it was
        const [cx, cy] = pos(s), ty = G.y0 + s.ret * G.ph, ny = Math.min(ty, cy + 34 * dt);
        s.fy = (ny - G.y0) / G.ph;
        if (ny >= ty - 0.5 || pos(s)[1] >= ty - 0.5) { s.fy = s.ret; s.ret = null; save(); }
      }
      if (d.tick) d.tick(s, dt);
      if (s.act > 0 && s.id === 'hydrant') {
        const [cx, cy] = pos(s);
        spawn(2, () => ({ x: cx + (Math.random() < 0.5 ? -11 : 11), y: cy, vx: rand(-40, 40), vy: rand(-60, -30), g: 200, life: 0.6, max: 0.6, s: 2, c: Math.random() < 0.5 ? '#6fc8ff' : '#ffffff' }));
      }
      if (s.act > 0 && s.id === 'cloud' && Math.random() < dt * 30) {
        const [cx, cy] = pos(s);
        parts.push({ x: cx + rand(-12, 12), y: cy + 6, vx: 0, vy: 70, g: 60, life: 0.7, max: 0.7, s: 1, c: '#6fc8ff' });
      }
      if (s.act > 0 && s.id === 'heli' && Math.random() < dt * 4) SFX.peep();
    }
    for (const w of words) w.t += dt;
    words = words.filter(w => w.t < 1.4);
    if (sirenT > 0 && (sirenT -= dt) <= 0) stopSiren();
    if (hold) {
      const before = hold.t;
      hold.t += dt;
      if (Math.floor(hold.t * 5) !== Math.floor(before * 5)) tone('sine', 400 + hold.t * 500, 0, 0.08, 0.1);
      if (hold.t >= 1 && !hold.done) { hold.done = true; cleanUp(); }
    }
    if (!(ptr && ptr.mode === 'swipe')) trayOff = Math.abs(trayOff) < 1 ? 0 : trayOff * Math.pow(0.0005, dt);
    flash = Math.max(0, flash - dt * 3);
  }
  function cleanUp() {
    const list = board();
    if (list.length) {
      for (const s of list) { const [cx, cy] = pos(s); puff(cx, cy, 5, '#ffffff'); sparkle(cx, cy, 8, 3); }
      SFX.whoosh(); setTimeout(SFX.chime, 350);
    } else SFX.boop(0.8);
    boards[bg] = [];
    words = [];
    stopSiren();
    save();
  }

  /* ---------- input ---------- */
  const inRect = (b, x, y, pad = 2) => x >= b.x - pad && x < b.x + b.w + pad && y >= b.y - pad && y < b.y + b.h + pad;
  function slotAt(x, y) {
    if (x < Y.tx || x >= Y.tx + Y.tw || y < Y.ty || y >= Y.ty + Y.th) return -1;
    const c = Math.floor((x - Y.tx) / (Y.slotW + Y.gap)), r = Math.floor((y - Y.ty) / (Y.slotH + Y.gap));
    if (c >= Y.cols || r >= Y.rows) return -1;
    const j = r * Y.cols + c;
    return j < PAGES[page].ids.length ? j : -1;
  }
  function slotCenter(j) {
    const r = Math.floor(j / Y.cols), c = j % Y.cols;
    return [Y.tx + c * (Y.slotW + Y.gap) + Y.slotW / 2, Y.ty + r * (Y.slotH + Y.gap) + Y.slotH / 2];
  }
  function turnPage(dir) {
    page = (page + dir + Y.pages) % Y.pages;
    trayOff += dir * (Y.tw + Y.gap);
    tone('triangle', dir > 0 ? 660 : 520, 0, 0.1, 0.1, dir > 0 ? 880 : 400);
  }
  // a group tab: jump to that group's first page (or on to its next page if it's already showing)
  function openCat(ci) {
    const first = PAGES.findIndex(p => p.cat === ci);
    let to = first;
    if (PAGES[page].cat === ci) { to = page + 1; if (to >= Y.pages || PAGES[to].cat !== ci) to = first; }
    if (to === page) { SFX.boop(1.1); return; }
    const dir = to > page ? 1 : -1;
    page = to; trayOff += dir * (Y.tw + Y.gap);
    tone('triangle', 520 + ci * 70, 0, 0.1, 0.1, 780 + ci * 70);
  }
  function switchBg(dir) {
    stopSiren();
    bg = (bg + dir + BG.length) % BG.length;
    flash = 1;
    SFX.whoosh(); tone('triangle', 523, 0.1, 0.12, 0.1); tone('triangle', 784, 0.2, 0.18, 0.1);
    for (const s of board()) { s.bn = 0.45; s.act = 0; s.walk = 0; s.rise = 0; s.fly = null; s.launch = 0; if (s.ret != null) { s.fy = s.ret; s.ret = null; } }
    words = [];
    if (bg === 3 && !isNight()) setNight(true);
    save();
  }
  function startDrag(id, x, y, ox, oy, s) {
    ptr = { id, mode: 'drag', x, y, ox, oy, s };
    tone('sine', 600, 0, 0.08, 0.12, 900);
  }

  function pickUp(id, x, y) {
    const sid = PAGES[page].ids[ptr.slot], d = DEFS[sid];
    startDrag(id, x, y, 0, -d.h * d.k * 0.45, mk(sid, 0.5, 0.5));
  }
  function tap(x, y, id) {
    if (ptr || hold) return true;                  // one finger at a time
    if (inBox(Y.home, x, y)) { SFX.pop(); goScene('station'); return true; }
    if (inBox(Y.clean, x, y)) { hold = { id, t: 0 }; return true; }
    if (inBox(Y.bgPrev, x, y, 3)) { switchBg(-1); return true; }
    if (inBox(Y.bgNext, x, y, 3)) { switchBg(1); return true; }
    if (y >= Y.stripY) {
      const tab = Y.tabs.find(t => inRect(t, x, y, 1));
      if (tab) { openCat(tab.cat); return true; }
      if (inRect(Y.prev, x, y)) { turnPage(-1); return true; }
      if (inRect(Y.next, x, y)) { turnPage(1); return true; }
      ptr = { id, mode: 'tray', slot: slotAt(x, y), x0: x, y0: y, x, y, dx: 0 };
      if (ptr.slot >= 0) SFX.boop(1.2);
      return true;
    }
    const s = hitSticker(x, y);
    if (s) {
      const [cx, cy] = pos(s);
      ptr = { id, mode: 'board', s, x0: x, y0: y, ox: cx - x, oy: cy - y };
      return true;
    }
    sparkle(x, y, 4, 3, '#ffffff'); SFX.peep();
    return true;
  }
  function move(x, y, id) {
    if (hold && id === hold.id && !inBox(Y.clean, x, y, 12)) hold = null;
    if (!ptr || id !== ptr.id) return;
    ptr.x = x; ptr.y = y;
    const dx = x - ptr.x0, dy = y - ptr.y0;
    if (ptr.mode === 'tray') {
      if (ptr.slot >= 0 && (y < Y.stripY - 2 || (dy < -6 && -dy >= Math.abs(dx) * 0.5))) pickUp(id, x, y);
      else if (Math.abs(dx) > 12) { ptr.mode = 'swipe'; ptr.base = trayOff; }
    } else if (ptr.mode === 'swipe') {
      // a swipe that wanders up onto the picture was really a drag after all
      if (ptr.slot >= 0 && y < Y.stripY - 4) { trayOff = ptr.base; pickUp(id, x, y); }
      else trayOff = ptr.base + dx;
    } else if (ptr.mode === 'board') {
      if (dx * dx + dy * dy > 25) {
        const list = board(), s = ptr.s;
        list.splice(list.indexOf(s), 1);
        s.act = 0; s.walk = 0; s.rise = 0; s.launch = 0; if (s.ret != null) { s.fy = s.ret; s.ret = null; }
        words = words.filter(w => w.s !== s);
        if (s.id === 'police' || s.id === 'amb') stopSiren();
        startDrag(id, x, y, ptr.ox, ptr.oy, s);
      }
    }
  }
  function release(id) {
    if (hold && id === hold.id) hold = null;
    if (!ptr || id !== ptr.id) return;
    const p = ptr; ptr = null;
    if (p.mode === 'tray' && p.slot >= 0) {
      // a plain tap on a tray sticker: it flies onto the picture by itself
      const sid = PAGES[page].ids[p.slot], s = mk(sid, rand(0.15, 0.85), rand(0.3, 0.85));
      const [cx, cy] = slotCenter(p.slot);
      s.fly = { x: cx, y: cy, t: 0 };
      addSticker(s);
      setPos(s, ...pos(s));
      tone('sine', 500, 0, 0.25, 0.1, 1000);
    } else if (p.mode === 'swipe') {
      const dx = p.x - p.x0;
      const span = Y.tw + Y.gap;
      if (dx < -20) { page = (page + 1) % Y.pages; trayOff += span; }
      else if (dx > 20) { page = (page - 1 + Y.pages) % Y.pages; trayOff -= span; }
      if (Math.abs(dx) > 20) tone('triangle', 660, 0, 0.1, 0.1, 880);
    } else if (p.mode === 'board') {
      const [cx, cy] = pos(p.s);
      act(p.s, cx, cy);
    } else if (p.mode === 'drag') {
      const s = p.s;
      if (p.y >= Y.stripY - 2) {        // back into the tray: off it goes
        SFX.whoosh();
        puff(p.x, Math.min(p.y, Y.stripY - 4), 8, '#ffffff');
        save();
        return;
      }
      setPos(s, p.x + p.ox, p.y + p.oy);
      addSticker(s);
      land(s);
    }
  }

  /* ---------- drawing ---------- */
  function drawBoard() {
    for (const s of board()) {
      const d = DEFS[s.id];
      let [cx, cy] = pos(s);
      if (s.fly) {   // flying in from the tray: drawn in the UI layer instead
        continue;
      }
      const hop = s.bn > 0 ? Math.round(Math.abs(Math.sin((0.45 - s.bn) / 0.45 * Math.PI * 2)) * 5 * s.bn / 0.45) : 0;
      let sc = d.k;
      if (s.id === 'heart' && s.act > 0) sc = d.k * (1 + 0.25 * Math.abs(Math.sin(s.at * 8)));
      if (s.id === 'star' && s.act > 0) sc = d.k * (1 + 0.15 * Math.abs(Math.sin(s.at * 10)));
      const [dx, dy] = stamp(d, anim(s), cx, cy - hop, sc);
      if (d.veh !== undefined && g === worldG) vDraws.push({ i: d.veh, x: dx + PAD, yb: dy + PAD + V[d.veh].h, lit: s.act > 0, bob: s.act > 0 && Math.floor(T * 10) % 2 ? -1 : 0 });
    }
  }
  function drawGlows(k) {
    for (const s of board()) {
      const d = DEFS[s.id];
      if (!d.glow || s.fly) continue;
      const [cx, cy] = pos(s), r = Math.round(Math.max(d.w, d.h) * d.k * 0.6);
      alpha((0.2 + 0.05 * Math.sin(T * 6 + s.seed)) * k + (s.act > 0 ? 0.15 : 0), () => circle(cx, cy, r, d.glow));
    }
  }
  function drawWords() {
    for (const w of words) {
      const z = w.t < 0.1 ? 3 : 2, tw = textWidth(w.str, z), o = z > 2 ? 2 : 1;
      const y = Math.round(clamp(w.y - w.t * 10, G.y0 + 3, G.y1 - 5 * z - 3));
      const x0 = y < Y.bgNext.y + Y.bgNext.s + 2 ? Y.bgNext.x + Y.bgNext.s + 3 : G.x0 + 3;
      const x = Math.round(clamp(w.x - tw / 2, x0, G.x1 - tw - 3));
      alpha(clamp((1.4 - w.t) / 0.35, 0, 1), () => {
        for (const [dx, dy] of OFFS) text(w.str, x + dx * o, y + dy * o, z, INK);
        text(w.str, x, y, z, w.c);
      });
    }
  }
  function drawBgButton(b, dir) {
    button(b, '#f57a12', '#b14c06');
    const u = Math.max(2, Math.round(b.s / 12)), cx = Math.floor(b.x + b.s / 2), cy = Math.floor(b.y + b.s / 2) - 1;
    if (dir > 0) { R(cx - 4 * u, cy - u, 5 * u, 2 * u, '#ffffff'); for (let k = 0; k < 4; k++) R(cx + u + k * u, cy - 4 * u + k * u, u, 8 * u - 2 * k * u, '#ffffff'); }
    else { R(cx - u, cy - u, 5 * u, 2 * u, '#ffffff'); for (let k = 0; k < 4; k++) R(cx - 2 * u - k * u, cy - 4 * u + k * u, u, 8 * u - 2 * k * u, '#ffffff'); }
  }
  function drawCleanButton() {
    const b = Y.clean, pressed = hold && !hold.done;
    button(pressed ? { x: b.x, y: b.y + 1, s: b.s } : b, '#3fb4a8', '#2f7a72');
    const x = b.x, y = b.y + (pressed ? 1 : 0), s = b.s;
    // broom: stick + bristles
    for (let k = 0; k < Math.round(s * 0.45); k++) R(x + s * 0.68 - k * 0.6, y + s * 0.14 + k, 2, 1, '#8a5a3a');
    const bx = Math.round(x + s * 0.24), by = Math.round(y + s * 0.56), bw = Math.round(s * 0.42);
    R(bx + 2, by - 2, bw - 4, 3, '#e8222b');
    R(bx, by + 1, bw, Math.round(s * 0.24), '#ffd21f');
    for (let k = 1; k < bw; k += 2) R(bx + k, by + 2, 1, Math.round(s * 0.24) - 1, '#c99410');
    if (hold) {   // the filling ring
      const k = Math.min(1, hold.t), cx = x + s / 2, cy = b.y + s / 2, rr = s / 2 + 3, n = 28;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i / n * Math.PI * 2, on = i / n < k;
        R(Math.round(cx + Math.cos(a) * rr) - 1, Math.round(cy + Math.sin(a) * rr) - 1, 3, 3, on ? '#ffd21f' : 'rgba(255,255,255,0.55)');
      }
    }
  }
  function drawTray() {
    R(0, Y.stripY, W, H - Y.stripY, '#e9d3a8');
    const over = ptr && ptr.mode === 'drag' && ptr.y >= Y.stripY - 2;
    R(0, Y.stripY, W, 2, over ? '#f57a12' : '#b98f55');
    if (over) alpha(0.25 + 0.1 * Math.sin(T * 12), () => R(0, Y.stripY + 2, W, H - Y.stripY - 2, '#f57a12'));
    const pressed = ptr && ptr.mode === 'tray' ? ptr.slot : -1;
    g.save();
    g.beginPath(); g.rect(Y.tx - 2, Y.ty - 2, Y.tw + 4, Y.th + 4); g.clip();
    const span = Y.tw + Y.gap, off = Math.round(trayOff);
    const pages = [[page, off]];
    if (off) pages.push([((page - Math.sign(off)) % Y.pages + Y.pages) % Y.pages, off - Math.sign(off) * span]);
    for (const [pg, ox] of pages) {
      const ids = PAGES[pg].ids;
      for (let j = 0; j < ids.length; j++) {
        const r = Math.floor(j / Y.cols), c = j % Y.cols;
        const sx = Y.tx + ox + c * (Y.slotW + Y.gap), sy = Y.ty + r * (Y.slotH + Y.gap);
        R(sx + 1, sy, Y.slotW - 2, Y.slotH, '#fffdf5'); R(sx, sy + 1, Y.slotW, Y.slotH - 2, '#fffdf5');
        R(sx + 1, sy + Y.slotH - 1, Y.slotW - 2, 1, '#d9bf8f');
        const grow = pg === page && j === pressed ? 1.15 : 1;
        preview(DEFS[ids[j]], sx + Y.slotW / 2, sy + Y.slotH / 2, Y.slotW - 2, Y.slotH - 2, grow);
      }
    }
    g.restore();
    // page arrows and dots
    for (const [b, dir] of [[Y.prev, -1], [Y.next, 1]]) {
      R(b.x + 1, b.y, b.w - 2, b.h, '#2a6fe0'); R(b.x, b.y + 1, b.w, b.h - 2, '#2a6fe0'); R(b.x + 1, b.y + b.h - 3, b.w - 2, 2, '#1a3f9a');
      const cx = b.x + (b.w >> 1), cy = b.y + (b.h >> 1) - 1;
      for (let k = 0; k < 5; k++) R(dir > 0 ? cx - 2 + k : cx + 2 - k, cy - 5 + k, 1, 11 - 2 * k, '#ffffff');
    }
    // the group tabs; dots under the slots when a group has more than one page
    for (const t of Y.tabs) {
      const C = CATS[t.cat], on = PAGES[page].cat === t.cat, y = t.y + (on ? 0 : 1);
      if (on) { R(t.x, y - 1, t.w, t.h + 2, '#ffffff'); }
      R(t.x + 1, y, t.w - 2, t.h, on ? C.c : mix(C.c, '#e9d3a8', 0.45)); R(t.x, y + 1, t.w, t.h - 2, on ? C.c : mix(C.c, '#e9d3a8', 0.45));
      R(t.x + 1, y + t.h - 2, t.w - 2, 2, on ? C.d : mix(C.d, '#e9d3a8', 0.45));
      preview(DEFS[C.icon], t.x + t.w / 2, y + t.h / 2 - 1, Math.min(t.w - 4, 34), t.h - 3);
    }
    const mine = PAGES.map((p, i) => i).filter(i => PAGES[i].cat === PAGES[page].cat);
    if (mine.length > 1) {
      const dw = mine.length * 6, dx0 = Math.round(Y.tx + Y.tw / 2 - dw / 2);
      mine.forEach((pi, k) => R(dx0 + k * 6, H - L.safeB - 3, 3, 2, pi === page ? CATS[PAGES[page].cat].c : '#c9ad7d'));
    }
    drawHomeButton(Y.home);
    drawCleanButton();
  }

  SCENES.stickers = {
    view: [186, 200],
    freeTouch: true,   // drags shouldn't change the weather
    groundY: () => G.hy,
    layout,
    enter() { load(); ptr = null; hold = null; trayOff = 0; flash = 0; for (const s of board()) s.bn = 0.45; layout(); },
    leave() { stopSiren(); words = []; if (ptr && ptr.mode === 'drag') { addSticker(ptr.s); } ptr = null; hold = null; save(); },
    update,
    tap,
    move,
    release,
    _Y: Y, _G: G, _DEFS: DEFS, _CATS: CATS, _st: () => ({ bg, page, pages: PAGES, board: board(), words }), _pos: s => pos(s),
    drawWorld() {
      BG[bg](geo[bg]);
      drawBoard();
    },
    drawLit() {
      const k = nightK();
      if (k > 0.02) { drawBgLights(k); drawGlows(k); }
      drawParticles();
    },
    drawUI() {
      // tray stickers flying onto the picture
      for (const s of board()) {
        if (!s.fly) continue;
        const d = DEFS[s.id], [tx, ty] = pos(s), k = ease(Math.min(1, s.fly.t / FLY));
        const x = s.fly.x + (tx - s.fly.x) * k, y = s.fly.y + (ty - s.fly.y) * k - Math.sin(k * Math.PI) * 24;
        const sc0 = Math.min(d.k, (Y.slotW - 2) / (d.w + 2), (Y.slotH - 2) / (d.h + 2));
        stamp(d, anim(s), x, y, sc0 + (d.k - sc0) * k);
      }
      drawWords();
      if (flash > 0) alpha(flash * 0.7, () => R(0, 0, W, Y.stripY, '#ffffff'));
      drawBgButton(Y.bgPrev, -1);
      drawBgButton(Y.bgNext, 1);
      drawTray();
      if (ptr && ptr.mode === 'drag') {
        const d = DEFS[ptr.s.id], cx = ptr.x + ptr.ox, cy = ptr.y + ptr.oy;
        alpha(0.22, () => ellipse(Math.round(cx), Math.round(cy + d.h * d.k / 2 + 5), Math.round(d.w * d.k * 0.4), 2, '#1d1a2b'));
        stamp(d, anim(ptr.s), cx, cy - 2, d.k * 1.15);
      }
    },
  };
  load();
})();
