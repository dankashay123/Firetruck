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
  let boards = [[], [], [], []];
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
    cat: { w: 10, h: 8, k: 2, draw: (x, y, a) => drawCat(x + 5, y + 8 - (a.on ? Math.round(Math.abs(Math.sin(a.t * 8)) * 2) : 0), a.dir, '#f0a050') },
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
  };
  const ORDER = ['fire', 'police', 'amb', 'heli', 'ff', 'cop', 'medic', 'kid', 'kid2', 'dog', 'cat', 'ducks',
    'tree', 'house', 'hydrant', 'cone', 'ladder', 'bell', 'flame', 'star', 'heart', 'balloon', 'sun', 'rainbow', 'cloud', 'flower'];

  /* ---------- what each sticker does when tapped ---------- */
  function playSiren(kind, dur) { stopSiren(); sirenStop = siren(kind); sirenT = dur; }
  function stopSiren() { if (sirenStop) { sirenStop(); sirenStop = null; } }
  function act(s, cx, cy) {
    const d = DEFS[s.id], bh = d.h * d.k;
    s.at = 0; s.act = 1.4;
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
      case 'cat': SFX.meow(); s.act = 1; break;
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
  const anim = s => ({ on: s.act > 0, t: s.at, dir: s.d || 1, seed: s.seed || 0 });
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
    try {
      const o = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (o && Array.isArray(o.b)) {
        boards = [0, 1, 2, 3].map(i => (Array.isArray(o.b[i]) ? o.b[i] : [])
          .filter(e => Array.isArray(e) && DEFS[e[0]] && isFinite(e[1]) && isFinite(e[2]))
          .map(e => mk(e[0], e[1], e[2], e[3] === -1 ? -1 : 1)));
        if (o.bg >= 0 && o.bg < 4) bg = o.bg | 0;
      }
    } catch (e) { /* storage unavailable */ }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ bg, b: boards.map(list => list.map(s => [s.id, +s.fx.toFixed(4), +s.fy.toFixed(4), s.d || 1])) })); } catch (e) {}
  }
  function mk(id, fx, fy, d = 1) { return { id, fx: clamp(fx, 0, 1), fy: clamp(fy, 0, 1), d, act: 0, at: 9, bn: 0, walk: 0, rise: 0, seed: Math.random() * 6, fly: null }; }
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
    const rows = uh > uw * 1.25 ? 2 : 1;
    const b = clamp(L.blob + 2, 24, 32), gap = 3, aw = 18, slotH = 34;
    Y.rows = rows; Y.b = b;
    Y.palH = rows * slotH + (rows - 1) * gap + 8;
    Y.stripY = H - L.safeB - Y.palH;
    const top = Y.stripY + 4, inner = rows * slotH + (rows - 1) * gap;
    const left = L.safeL + 4, right = W - L.safeR - 4;
    let sx0, sx1;
    if (rows === 2) {
      Y.home = { x: left, y: top + Math.floor((slotH - b) / 2), s: b };
      Y.clean = { x: left, y: top + slotH + gap + Math.floor((slotH - b) / 2), s: b };
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
    Y.cols = Math.max(1, Math.floor((avail + gap) / (36 + gap)));
    Y.slotW = Math.min(48, Math.floor((avail - (Y.cols - 1) * gap) / Y.cols));
    Y.slotH = slotH; Y.gap = gap;
    const used = Y.cols * Y.slotW + (Y.cols - 1) * gap;
    Y.tx = sx0 + Math.floor((avail - used) / 2); Y.ty = top; Y.tw = used; Y.th = inner;
    Y.per = Y.cols * rows; Y.pages = Math.ceil(ORDER.length / Y.per);
    page = Math.min(page, Y.pages - 1);
    // the two picture-switching arrows, top left
    Y.bgPrev = { x: L.safeL + 6, y: L.safeT + 6, s: b };
    Y.bgNext = { x: L.safeL + 6 + b + 8, y: L.safeT + 6, s: b };
    Object.assign(G, { x0: L.safeL, y0: L.safeT, x1: W - L.safeR, y1: Y.stripY });
    G.pw = G.x1 - G.x0; G.ph = G.y1 - G.y0;
    G.hy = Math.round(G.y0 + G.ph * 0.45);
    geo = [buildStreet(), buildStation(), buildPark(), buildCity()];
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
    return { bY, roadY, roadH, lamps, flowers, shops: shops(r, bY, 26, 64, ['#f2d16b', '#9ad0f5', '#f5a3c7', '#b6e3a1', '#f0b27a', '#c9b6f2', '#e8e1d0']) };
  }
  function buildStation() {
    const sb = G.hy + Math.round((G.y1 - G.hy) * 0.32);
    const sw = Math.min(Math.round(G.pw * 0.8), 210), sx = Math.round(G.x0 + (G.pw - sw) / 2);
    let sh = clamp(Math.round((sb - G.y0) * 0.55), 44, 84);
    sh = Math.min(sh, sb - sunCap(sx, sw) - 4);
    const n = sw >= 160 ? 3 : 2, dh = Math.round(sh * 0.6), dw = Math.floor((sw - 12 - (n - 1) * 6) / n);
    const tower = sb - sh - 22 >= sunCap(sx + 6, 18);
    return { sb, sw, sx, sh, n, dh, dw, tower };
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
    const pads = [[-0.45, -0.1], [0.3, 0.3], [0.5, -0.3]].map(([a, bb]) => ({ x: pond.cx + Math.round(a * pond.rx), y: pond.cy + Math.round(bb * pond.ry) }));
    return { trees, pond, flowers, pads };
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
    for (const f of q.flowers) { R(f.x, f.y, 3, 1, f.c); R(f.x + 1, f.y - 1, 1, 3, f.c); R(f.x + 1, f.y, 1, 1, '#ffd21f'); }
  }
  function drawStation(q) {
    backHills(G.hy - 20);
    R(0, G.hy, W, H - G.hy, '#6cbf5a');
    const { sb, sw, sx, sh, n, dh, dw } = q, top = sb - sh, cx = sx + (sw >> 1);
    // driveway
    for (let y = sb; y < G.y1; y++) { const e = Math.round((y - sb) * 0.35); R(sx - e, y, sw + 2 * e, 1, '#c9c4b8'); }
    for (let i = 0; i < n; i++) { const dx = sx + 6 + i * (dw + 6) + (dw >> 1); R(dx, sb + 4, 1, G.y1 - sb - 4, '#b3ad9f'); }
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
  }
  const BG = [drawStreet, drawStation, drawPark, drawCity];

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
        s.fx = (cx - G.x0) / G.pw; s.fy = (cy - 40 * dt - G.y0) / G.ph;
        if (s.rise <= 0) { setPos(s, ...pos(s)); save(); }
      }
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
    stopSiren();
    save();
  }

  /* ---------- input ---------- */
  const inRect = (b, x, y, pad = 2) => x >= b.x - pad && x < b.x + b.w + pad && y >= b.y - pad && y < b.y + b.h + pad;
  function slotAt(x, y) {
    if (x < Y.tx || x >= Y.tx + Y.tw || y < Y.ty || y >= Y.ty + Y.th) return -1;
    const c = Math.floor((x - Y.tx) / (Y.slotW + Y.gap)), r = Math.floor((y - Y.ty) / (Y.slotH + Y.gap));
    if (c >= Y.cols || r >= Y.rows) return -1;
    const i = page * Y.per + r * Y.cols + c;
    return i < ORDER.length ? i : -1;
  }
  function slotCenter(i) {
    const j = i - page * Y.per, r = Math.floor(j / Y.cols), c = j % Y.cols;
    return [Y.tx + c * (Y.slotW + Y.gap) + Y.slotW / 2, Y.ty + r * (Y.slotH + Y.gap) + Y.slotH / 2];
  }
  function turnPage(dir) {
    page = (page + dir + Y.pages) % Y.pages;
    trayOff += dir * (Y.tw + Y.gap);
    tone('triangle', dir > 0 ? 660 : 520, 0, 0.1, 0.1, dir > 0 ? 880 : 400);
  }
  function switchBg(dir) {
    stopSiren();
    bg = (bg + dir + 4) % 4;
    flash = 1;
    SFX.whoosh(); tone('triangle', 523, 0.1, 0.12, 0.1); tone('triangle', 784, 0.2, 0.18, 0.1);
    for (const s of board()) { s.bn = 0.45; s.act = 0; s.walk = 0; s.rise = 0; s.fly = null; }
    if (bg === 3 && !isNight()) setNight(true);
    save();
  }
  function startDrag(id, x, y, ox, oy, s) {
    ptr = { id, mode: 'drag', x, y, ox, oy, s };
    tone('sine', 600, 0, 0.08, 0.12, 900);
  }

  function pickUp(id, x, y) {
    const d = DEFS[ORDER[ptr.slot]];
    startDrag(id, x, y, 0, -d.h * d.k * 0.45, mk(ORDER[ptr.slot], 0.5, 0.5));
  }
  function tap(x, y, id) {
    if (ptr || hold) return true;                  // one finger at a time
    if (inBox(Y.home, x, y)) { SFX.pop(); goScene('station'); return true; }
    if (inBox(Y.clean, x, y)) { hold = { id, t: 0 }; return true; }
    if (inBox(Y.bgPrev, x, y, 3)) { switchBg(-1); return true; }
    if (inBox(Y.bgNext, x, y, 3)) { switchBg(1); return true; }
    if (y >= Y.stripY) {
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
        s.act = 0; s.walk = 0; s.rise = 0;
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
      const sid = ORDER[p.slot], s = mk(sid, rand(0.15, 0.85), rand(0.3, 0.85));
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
      for (let j = 0; j < Y.per; j++) {
        const i = pg * Y.per + j;
        if (i >= ORDER.length) break;
        const r = Math.floor(j / Y.cols), c = j % Y.cols;
        const sx = Y.tx + ox + c * (Y.slotW + Y.gap), sy = Y.ty + r * (Y.slotH + Y.gap);
        R(sx + 1, sy, Y.slotW - 2, Y.slotH, '#fffdf5'); R(sx, sy + 1, Y.slotW, Y.slotH - 2, '#fffdf5');
        R(sx + 1, sy + Y.slotH - 1, Y.slotW - 2, 1, '#d9bf8f');
        const grow = pg === page && i === pressed ? 1.15 : 1;
        preview(DEFS[ORDER[i]], sx + Y.slotW / 2, sy + Y.slotH / 2, Y.slotW - 2, Y.slotH - 2, grow);
      }
    }
    g.restore();
    // page arrows and dots
    for (const [b, dir] of [[Y.prev, -1], [Y.next, 1]]) {
      R(b.x + 1, b.y, b.w - 2, b.h, '#2a6fe0'); R(b.x, b.y + 1, b.w, b.h - 2, '#2a6fe0'); R(b.x + 1, b.y + b.h - 3, b.w - 2, 2, '#1a3f9a');
      const cx = b.x + (b.w >> 1), cy = b.y + (b.h >> 1) - 1;
      for (let k = 0; k < 5; k++) R(dir > 0 ? cx - 2 + k : cx + 2 - k, cy - 5 + k, 1, 11 - 2 * k, '#ffffff');
    }
    const dw = Y.pages * 6, dx0 = Math.round(Y.tx + Y.tw / 2 - dw / 2);
    for (let i = 0; i < Y.pages; i++) R(dx0 + i * 6, H - L.safeB - 3, 3, 2, i === page ? '#e8222b' : '#c9ad7d');
    drawHomeButton(Y.home);
    drawCleanButton();
  }

  SCENES.stickers = {
    view: [186, 200],
    freeTouch: true,   // drags shouldn't change the weather
    groundY: () => G.hy,
    layout,
    enter() { load(); ptr = null; hold = null; trayOff = 0; flash = 0; for (const s of board()) s.bn = 0.45; layout(); },
    leave() { stopSiren(); if (ptr && ptr.mode === 'drag') { addSticker(ptr.s); } ptr = null; hold = null; save(); },
    update,
    tap,
    move,
    release,
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
