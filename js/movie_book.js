// Cinema: "Little Blue Truck", a pixel-art sing-along made from a parent's own copy of the book.
// The parent sings the story in one recording (audio/movie-book.mp3); each page of the book is
// one beat of the timeline below, so the pictures follow the song. Without the recording the
// cartoon still plays, with little honks, beeps and animal noises in place of the singing.
// Only the home button reacts.
'use strict';
(() => {
  const A = BOOK;
  const BLACK = '#1d1a2b';
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const seg = (v, a, b) => clamp01((v - a) / (b - a));
  const eout = k => 1 - (1 - k) ** 3;
  const hsh = A.hsh;

  /* ---------- timeline: one beat per sung page ---------- */
  // pages with words, spread by spread (the first spread's words are all on its right page)
  const SCENE_PAGES = [1, 2, 1, 2, 2, 1, 1, 2, 1, 2, 2, 1, 1, 1];
  const NPAGES = SCENE_PAGES.reduce((a, b) => a + b, 0);
  const SCENE_AT = SCENE_PAGES.map((_, i) => SCENE_PAGES.slice(0, i).reduce((a, b) => a + b, 0));
  const PAGE = 5.5, INTRO = 2.6, OUTRO = 3.4;
  // When the recording arrives: the second each page starts in it, plus where the last page ends.
  let SONG_PAGES = null;
  const pageT = k => INTRO + (SONG_PAGES ? SONG_PAGES[k] : k * PAGE);
  const endT = () => pageT(NPAGES) + OUTRO;
  function uAt(t) {   // story position in pages (negative during the intro)
    if (t < pageT(0)) return (t - pageT(0)) / PAGE;
    for (let k = 0; k < NPAGES; k++) if (t < pageT(k + 1)) return k + (t - pageT(k)) / (pageT(k + 1) - pageT(k));
    return NPAGES + (t - pageT(NPAGES)) / PAGE;
  }
  function tAtU(u) {
    if (u < 0) return pageT(0) + u * PAGE;
    if (u >= NPAGES) return pageT(NPAGES) + (u - NPAGES) * PAGE;
    const k = Math.floor(u); return pageT(k) + (u - k) * (pageT(k + 1) - pageT(k));
  }

  /* ---------- the sung recording (optional) ---------- */
  const song = { buf: null, tried: false, src: null, t0: 0 };
  function loadSong() {
    if (song.tried || !ac) return;
    song.tried = true;
    fetch('audio/movie-book.mp3').then(r => r.ok ? r.arrayBuffer() : null)
      .then(ab => ab && ac.decodeAudioData(ab)).then(b => { if (b) song.buf = b; }).catch(() => {});
  }
  const singing = () => !!song.src;

  /* ---------- camera: world -> screen is (x * z + ox, y * z + oy) ---------- */
  const cam = { z: 1, ox: 0, oy: 0, shake: 0 };
  const sx = x => cam.ox + x * cam.z, sy = y => cam.oy + y * cam.z;
  const portrait = () => H > W * 1.3;
  function setCam(cx, cy, fw, fh, shake = 0) {
    // fit the frame's height; its sides may be cropped a little so things stay big on a narrow screen
    const kw = W / fw, kh = H / fh;
    const z = Math.max(1, Math.min(12, Math.floor(Math.min(kh, kw * (fw >= 140 ? 1.75 : 1.3)))));
    cam.z = z;
    cam.ox = Math.round(W / 2 - cx * z + shake * z);
    cam.oy = Math.round(H / 2 - cy * z);
  }
  function vis() { return { x0: Math.floor(-cam.ox / cam.z) - 2, x1: Math.ceil((W - cam.ox) / cam.z) + 2, y0: Math.floor(-cam.oy / cam.z) - 2, y1: Math.ceil((H - cam.oy) / cam.z) + 2 }; }

  /* ---------- scenery kit ---------- */
  const SKY = {
    dusk: ['#eeb0b6', '#f1bcb6', '#f4c8b2', '#f6d4ae', '#f7e0aa', '#f8eaae'],
    rain: ['#cbd5cf', '#d4dcd2', '#dde3d6', '#e5e8d8', '#ece9d2'],
    clear: ['#78ace4', '#92bde8', '#b0cfe8', '#cfdfe0', '#e8e6cc', '#f6e6b4'],
    paper: ['#f6f1e4'],
    gold: ['#e8a838'],
    barn: ['#f2b51c'],
  };
  function drawSky(key) {
    const c = SKY[key] || SKY.dusk, n = c.length, bh = Math.ceil(H / n);
    for (let i = 0; i < n; i++) R(0, i * bh, W, bh + 1, c[i]);
  }
  function fill(y0, c, y1) { const v = vis(); R(v.x0, y0, v.x1 - v.x0, (y1 == null ? v.y1 : y1) - y0, c); }
  function hills(base, amp, freq, seed, c) {
    const v = vis();
    for (let x = v.x0 - (v.x0 % 2); x < v.x1; x += 2) {
      const h = Math.round(amp * (0.6 + 0.4 * Math.sin(x * freq + seed) + 0.3 * Math.sin(x * freq * 2.3 + seed * 3)));
      if (h > 0) R(x, base - h, 2, h + 1, c);
    }
  }
  function strokes(y0, y1, c, dens = 0.05, seed = 1) {   // painterly grass strokes
    const v = vis();
    for (let x = v.x0 - (v.x0 % 3); x < v.x1; x += 3) {
      const n = hsh(x * 0.37 + seed);
      if (n < dens * 6) { const y = Math.round(y0 + hsh(x * 1.7 + seed) * (y1 - y0)); R(x, y, 1, 2 + Math.round(n * 20) % 3, c); }
    }
  }
  function road(y0, h, c = '#b8b2a4') {
    const v = vis();
    R(v.x0, y0, v.x1 - v.x0, h, c); R(v.x0, y0, v.x1 - v.x0, 1, '#948e80');
    for (let x = Math.floor(v.x0 / 6) * 6; x < v.x1; x += 6) {
      const n = hsh(x * 0.13);
      R(x, y0 + 2 + Math.floor(n * (h - 3)), 3 + Math.floor(n * 7), 1, n < 0.5 ? '#a29c8e' : '#cdc7ba');
    }
  }
  function fence(x0, x1, base, c = '#f4efe2') {
    R(x0, base - 9, x1 - x0, 2, c); R(x0, base - 5, x1 - x0, 2, c);
    for (let x = x0; x <= x1; x += 14) { R(x, base - 11, 2, 11, c); R(x + 1, base - 11, 1, 11, '#d8d2c4'); }
  }
  function autumnTree(x, base, r, cols = ['#e8902a', '#d0642a', '#f2b23c']) {
    R(x - 2, base - r - 10, 4, r + 10, '#6a4028'); R(x - 1, base - r - 10, 1, r + 10, '#8a5a38');
    circle(x, base - r * 2 - 4, r, cols[0]); circle(x - r * 0.5, base - r * 2, r * 0.7, cols[1]); circle(x + r * 0.4, base - r * 2.3, r * 0.6, cols[2]);
    for (let i = 0; i < 8; i++) R(x - r + Math.floor(hsh(x + i) * r * 2), base - r * 3 + Math.floor(hsh(x * 2 + i) * r * 2), 1, 1, cols[i % 3]);
  }
  function bareTree(x, base, h, leaf = '#c8302a') {
    R(x - 2, base - h, 5, h, '#7a4a2e'); R(x - 1, base - h, 1, h, '#9a6a44');
    const br = [[-1, 0.55, -10], [1, 0.62, 9], [-1, 0.8, -7], [1, 0.85, 6], [0, 1, 0]];
    for (const [d, f, len] of br) for (let k = 0; k < Math.abs(len) + 4; k++) R(x + (d ? d * k : 0), base - h * f - k * (d ? 0.8 : 1), 1, 1, '#6a4028');
    for (let i = 0; i < 12; i++) R(x - 10 + Math.floor(hsh(x + i * 3) * 20), base - h * 0.6 - Math.floor(hsh(x + i * 5) * h * 0.5), 2, 1, leaf);
  }
  function cattails(x0, x1, base, seed = 1) {
    for (let x = x0; x < x1; x += 4 + Math.floor(hsh(x + seed) * 4)) {
      const h = 14 + Math.floor(hsh(x * 3 + seed) * 12);
      R(x, base - h, 1, h, '#7a6a30'); R(x - 1, base - h + 1, 3, 6, '#6a2a1a'); R(x, base - h - 2, 1, 2, '#7a6a30');
    }
  }
  function reeds(x0, x1, top, base) {
    for (let x = x0; x < x1; x += 2) {
      const h = Math.round((base - top) * (0.6 + 0.4 * hsh(x * 0.7)));
      R(x, base - h, 1, h, hsh(x) < 0.5 ? '#b84a2a' : '#d0703a'); R(x + 1, base - h + 3, 1, h - 3, '#e09040');
    }
  }
  function rock(x, y, rx, ry) {
    ellipse(x, y, rx, ry, '#8a8680'); ellipse(x - 1, y - 1, rx - 2, ry - 1, '#a8a49c'); R(x - rx / 2, y - ry + 1, 3, 1, '#c8c4bc');
  }
  function ellipse(cx, cy, rx, ry, c) {
    cx = Math.round(cx); cy = Math.round(cy);
    for (let dy = -ry; dy <= ry; dy++) {
      const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
      R(cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }
  function mudPool(cx, cy, rx, ry, seed = 1) {
    ellipse(cx, cy, rx + 3, ry + 1, '#4a2610');
    ellipse(cx, cy, rx, ry, '#6a3a1a');
    for (let i = 0; i < rx; i++) {
      const y = cy - ry + 1 + Math.floor(hsh(seed + i) * ry * 2 - 1), w = 4 + Math.floor(hsh(seed + i * 2) * 10);
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / (ry + 0.5)) ** 2)));
      const x = cx - half + Math.floor(hsh(seed + i * 3) * Math.max(1, half * 2 - w));
      R(x, y, Math.min(w, half * 2), 1, i % 3 ? '#8a5028' : '#5a3014');
    }
  }
  function mudFront(cx, top, w, h) {   // the mud that hides sinking wheels
    R(cx - w / 2, top, w, h, '#6a3a1a');
    for (let i = 0; i < w; i += 3) R(cx - w / 2 + i, top - (hsh(i + cx) < 0.5 ? 1 : 0), 3, 1, '#6a3a1a');
    for (let i = 0; i < w / 2; i++) R(cx - w / 2 + Math.floor(hsh(i * 3.3 + cx) * (w - 6)), top + 1 + Math.floor(hsh(i * 1.7 + cx) * (h - 2)), 5, 1, i % 2 ? '#8a5028' : '#4a2610');
  }
  function stopSign(x, base) {
    R(x, base - 34, 2, 34, '#5a5650');
    circle(x + 1, base - 40, 8, '#f4efe2'); circle(x + 1, base - 40, 7, '#c8242c'); R(x - 4, base - 41, 11, 2, '#f4efe2');
  }
  function toadSign(x, base) {
    R(x, base - 30, 2, 30, '#5a5650');
    for (let r = 0; r < 9; r++) { R(x + 1 - r, base - 46 + r, 2 * r + 1, 1, '#2a2a22'); R(x + 1 - r, base - 28 - r, 2 * r + 1, 1, '#2a2a22'); }
    for (let r = 0; r < 8; r++) { R(x + 1 - r, base - 45 + r, 2 * r + 1, 1, '#ffd21f'); R(x + 1 - r, base - 29 - r, 2 * r + 1, 1, '#ffd21f'); }
    R(x - 2, base - 38, 7, 3, '#4e7424'); R(x - 3, base - 40, 2, 2, '#4e7424'); R(x + 4, base - 40, 2, 2, '#4e7424'); R(x - 3, base - 35, 2, 1, '#4e7424'); R(x + 4, base - 35, 2, 1, '#4e7424');
  }
  function barn(x, base) {   // a gray shed with an open door and a red barn, 76 wide from x
    R(x, base - 26, 36, 26, '#a86a3a'); for (let i = 0; i < 36; i += 4) R(x + i, base - 26, 1, 26, '#8a5028');
    R(x - 3, base - 32, 42, 7, '#9aa59a'); for (let i = 0; i < 42; i += 3) R(x - 3 + i, base - 32, 1, 7, '#7e8a7e');
    R(x + 8, base - 20, 20, 20, '#2a2024');
    R(x + 36, base - 38, 40, 38, '#9c2a22'); for (let i = 0; i < 40; i += 4) R(x + 36 + i, base - 38, 1, 38, '#84201a');
    for (let k = 0; k < 16; k++) R(x + 36 + k, base - 38 - k, 40 - 2 * k, 1, '#6a3a2a');
    R(x + 50, base - 66, 12, 4, '#6a3a2a'); R(x + 52, base - 62, 8, 8, '#9c2a22');
    R(x + 46, base - 22, 14, 22, '#f4efe2'); R(x + 48, base - 20, 10, 20, '#84201a');
    R(x + 62, base - 30, 7, 7, '#f4efe2'); R(x + 63, base - 29, 5, 5, '#2a2024');
  }
  function featherTree(x, base, h) {
    R(x - 3, base - h, 7, h, '#6a4028'); R(x - 2, base - h, 2, h, '#8a5a38');
    for (const [dx, dy] of [[-14, -h - 8], [0, -h - 16], [14, -h - 8], [-20, -h + 2], [20, -h + 2]]) {
      for (let k = 0; k < 10; k++) { R(x + dx - 6 + k, base + dy + Math.abs(k - 5), 1, 1, '#8a7a2a'); R(x + dx - 5 + k, base + dy + 2 + Math.abs(k - 5), 1, 1, '#b0a040'); }
      R(x + dx, base + dy, 1, 10, '#6a5a20');
    }
    for (const [dx, dy] of [[-14, -h - 8], [0, -h - 16], [14, -h - 8], [-20, -h + 2], [20, -h + 2]]) { const k = Math.abs(dx) * 0.6; for (let i = 0; i < k; i++) R(x + Math.sign(dx) * i, base - h + 4 + dy * 0 - i * (dy + h) / Math.max(1, k) * -0.1, 1, 1, '#6a4028'); }
  }
  function pine(x, base, h) { for (let k = 0; k < h; k++) R(x - Math.floor(k / 2.5), base - h + k, 1 + 2 * Math.floor(k / 2.5), 1, k % 3 ? '#4a6a3a' : '#3a5a2e'); }

  // draw a sprite at any (non-integer) scale with crisp pixels: fn draws into a w x h box (bottom center at w/2, h)
  let tmpCv = null;
  function scaled(fn, w, h, x, yb, k) {
    if (!tmpCv) tmpCv = document.createElement('canvas');
    if (tmpCv.width < w || tmpCv.height < h) { tmpCv.width = Math.max(tmpCv.width, w); tmpCv.height = Math.max(tmpCv.height, h); }
    const tg = tmpCv.getContext('2d'), prev = g;
    tg.clearRect(0, 0, w, h); g = tg; fn(w / 2, h); g = prev;
    g.imageSmoothingEnabled = false;
    const dw = Math.max(1, Math.round(w * k)), dh = Math.max(1, Math.round(h * k));
    g.drawImage(tmpCv, 0, 0, w, h, Math.round(x - dw / 2), Math.round(yb - dh), dw, dh);
  }
  // a road running straight away from us to the horizon hz, as wide as halfW at the bottom
  function perspectiveRoad(hz, halfW, c = '#b8b2a4', tracks = false) {
    const v = vis();
    for (let y = hz; y < v.y1; y++) {
      const k = (y - hz) / Math.max(1, v.y1 - hz), hw = Math.round(2 + k * halfW);
      R(-hw, y, hw * 2, 1, c);
      if (tracks) { const tx = Math.round(hw * 0.45), tw = Math.max(1, Math.round(k * 5)); R(-tx - tw, y, tw, 1, '#8a5a3a'); R(tx, y, tw, 1, '#8a5a3a'); }
      const n = hsh(y * 0.71);
      if (n < 0.35) R(-hw + Math.floor(hsh(y * 1.3) * hw * 1.6), y, 2 + Math.floor(k * 8), 1, '#a29c8e');
      else if (n > 0.85) R(-hw + Math.floor(hsh(y * 2.1) * hw * 1.6), y, 2 + Math.floor(k * 6), 1, '#cdc7ba');
    }
  }
  function roadY(k, hz, bottom) { return lerp(hz, bottom, k); }

  /* ---------- speech bubbles and big numbers (screen space) ---------- */
  const GLYPH = Object.assign({}, FONT, {
    B: '110101110101110', M: '101111111101101', K: '101101110101101', U: '101101101101111', Q: '010101101110011',
    V: '101101101101010', W: '101101111111101', D: '110101101101110', Y: '101101010010010',
    1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  });
  function txt(str, x, y, s, c) {
    [...str].forEach((ch, i) => {
      const bits = GLYPH[ch] || GLYPH[' '];
      for (let b = 0; b < 15; b++) if (bits[b] === '1') R(x + i * 4 * s + (b % 3) * s, y + Math.floor(b / 3) * s, s, s, c);
    });
  }
  const WORD_C = { BEEP: '#2a5ab8', HONK: '#d07010', MOO: '#6a3a1a', BAA: '#4a5a2a', OINK: '#c8343a', CLUCK: '#a8221c', PEEP: '#c99410', MAA: '#7a4a2a', NEIGH: '#8a2a1a', QUACK: '#c8343a', CROAK: '#4e7424', BUMP: '#2a5ab8', VROOM: '#d07010', STUCK: '#6a3a1a' };
  function bubble(word, ax, ay, age, big = false, life = 1.7) {
    if (age < 0 || age > life) return;
    const s = Math.max(1, Math.min(4, Math.round(Math.min(W, H) / (big ? 70 : 95))));
    const label = word + '!', tw = label.length * 4 * s - s, bw = tw + 6 * s, bh = 5 * s + 6 * s;
    const pop = age < 0.18 ? eout(age / 0.18) : 1, fade = age > life - 0.25 ? 1 - (age - life + 0.25) / 0.25 : 1;
    let bx = Math.round(ax - bw / 2), by = Math.round(ay - bh - 6 * s - (1 - pop) * 6);
    bx = Math.max(L.safeL + 4, Math.min(W - L.safeR - bw - 4, bx));
    by = Math.max(L.safeT + 4, Math.min(H - L.safeB - bh - 36, by));
    alpha(fade, () => {
      const c = WORD_C[word] || INK;
      R(bx + 2, by + 2, bw, bh, 'rgba(0,0,0,0.18)');
      R(bx - 1, by + 1, bw + 2, bh - 2, INK); R(bx + 1, by - 1, bw - 2, bh + 2, INK);
      R(bx, by + 1, bw, bh - 2, '#ffffff'); R(bx + 1, by, bw - 2, bh, '#ffffff');
      const tx = Math.max(bx + 4, Math.min(bx + bw - 8, Math.round(ax))), ty = by + bh;
      for (let k = 0; k < 4 * s / 2 + 2; k++) { R(tx - Math.max(0, 3 - k) - 1, ty + k - 1, Math.max(1, 2 * (3 - k)) + 2, 1, k ? INK : '#ffffff'); if (k < 3) R(tx - (3 - k) + 0, ty + k - 1, 2 * (3 - k), 1, '#ffffff'); }
      txt(label, bx + 3 * s, by + 3 * s + Math.round(Math.sin(age * 18) * (age < 0.4 ? 1 : 0)), s, c);
    });
  }
  function bigNumber(n, age) {
    if (age < 0 || age > 0.9) return;
    const s = Math.max(4, Math.round(Math.min(W, H) / 22)), pop = age < 0.15 ? eout(age / 0.15) : 1, fade = age > 0.7 ? 1 - (age - 0.7) / 0.2 : 1;
    const ss = Math.max(2, Math.round(s * (0.5 + 0.5 * pop)));
    const x = Math.round(W / 2 - (3 * ss) / 2), y = Math.round(L.safeT + H * 0.12);
    alpha(fade, () => { txt(String(n), x + Math.max(1, ss >> 2), y + Math.max(1, ss >> 2), ss, 'rgba(0,0,0,0.25)'); txt(String(n), x, y, ss, '#ffd21f'); });
  }

  /* ---------- little sounds when nobody is singing ---------- */
  const SOUND = {
    BEEP() { tone('square', 587, 0, 0.11, 0.07); tone('square', 740, 0, 0.11, 0.05); tone('square', 587, 0.15, 0.14, 0.07); tone('square', 740, 0.15, 0.14, 0.05); },
    HONK() { tone('sawtooth', 147, 0, 0.5, 0.11); tone('sawtooth', 175, 0, 0.5, 0.08); },
    MOO() { tone('sawtooth', 150, 0, 0.75, 0.07, 110); },
    BAA() { for (let i = 0; i < 4; i++) tone('sawtooth', 430 - i * 6, i * 0.1, 0.1, 0.05); },
    OINK() { tone('square', 320, 0, 0.12, 0.06, 210); tone('square', 300, 0.16, 0.12, 0.06, 200); },
    CLUCK() { for (let i = 0; i < 3; i++) tone('square', 720 + i * 40, i * 0.11, 0.06, 0.05); },
    PEEP() { tone('sine', 1800, 0, 0.08, 0.06, 2300); tone('sine', 1800, 0.12, 0.08, 0.06, 2300); },
    MAA() { for (let i = 0; i < 5; i++) tone('sawtooth', 540 - i * 10, i * 0.09, 0.09, 0.05); },
    NEIGH() { tone('sawtooth', 950, 0, 0.6, 0.05, 480); },
    QUACK() { tone('square', 340, 0, 0.12, 0.07, 250); tone('square', 340, 0.17, 0.12, 0.07, 250); },
    CROAK() { tone('square', 120, 0, 0.18, 0.09, 95); tone('square', 110, 0.24, 0.22, 0.09, 85); },
    BUMP() { tone('sine', 140, 0, 0.12, 0.12, 80); },
    VROOM() { tone('sawtooth', 70, 0, 0.7, 0.08, 160); noise(0, 0.6, 0.05, 300, 0.8); },
    STUCK() { tone('sawtooth', 90, 0, 0.5, 0.07, 70); noise(0, 0.5, 0.06, 400, 0.7); },
    SPLAT() { noise(0, 0.35, 0.12, 500, 0.6); tone('sine', 180, 0, 0.2, 0.08, 70); },
    YAY() { [523, 659, 784, 1047].forEach((f, i) => tone('sine', f, i * 0.08, 0.25, 0.07)); },
  };
  const sound = w => { if (!singing() && SOUND[w]) SOUND[w](); };

  /* ---------- weather on top of the picture (screen space) ---------- */
  function drawRain(k = 1, c = '#aebac2') {
    const n = Math.round((W * H) / 900 * k);
    for (let i = 0; i < n; i++) {
      const sp = 140 + (i % 5) * 20, y = ((i * 53.7 + T * sp) % (H + 20)) - 10, x = ((i * 97.3 + y * 0.25) % (W + 30)) - 15;
      R(x, y, 1, 3, c); R(x, y + 3, 1, 1, '#ffffff');
    }
  }
  function drawLeaves(n = 14) {
    const cols = ['#e8902a', '#d0642a', '#c8302a', '#f2b23c'];
    for (let i = 0; i < n; i++) {
      const sp = 18 + (i % 4) * 6, y = ((i * 71.3 + T * sp) % (H + 10)) - 5, x = ((i * 113.7 + T * 10 + Math.sin(T * 2 + i) * 8) % (W + 20)) - 10;
      R(x, y, 2, 1, cols[i % 4]); if (Math.floor(T * 3 + i) % 2) R(x + 1, y + 1, 1, 1, cols[(i + 1) % 4]);
    }
  }
  function mudFling(wx, wy, n = 2) {   // world point -> screen particles
    spawn(n, () => ({ x: sx(wx) + rand(-3, 3), y: sy(wy), vx: rand(-60, 20) * cam.z / 2, vy: rand(-90, -40) * cam.z / 2, g: 240 * cam.z / 2, life: 0.6, max: 0.6, s: Math.max(1, cam.z), c: pickOne(A.MUD) }));
  }

  /* ================= the story, spread by spread ================= */
  // Each scene: sky, rain, leaves, world(su) in world units, shots [{u, cam(su), world?, ui?}],
  // words [[u, WORD, (su) => [wx, wy], big]] (bubbles + noises). su is pages into the scene.

  // 1. Blue rolls up to the stop sign and beeps hello; the engine purrs.
  const s1 = {
    sky: 'dusk', leaves: true,
    blueX: su => su < 0.45 ? lerp(-150, -6, eout(clamp01(su / 0.45))) : -6,
    world(su) {
      const bx = this.blueX(su), v = vis();
      hills(-28, 5, 0.04, 1, '#ecc888');
      fill(-26, '#e8902a', 0); for (let x = v.x0 - (v.x0 % 5); x < v.x1; x += 5) circle(x, -26, 3 + Math.round(hsh(x) * 2), hsh(x * 3) < 0.5 ? '#f2a83a' : '#e07a20');
      fill(-18, '#c9822a', 0); strokes(-18, 0, '#a8661a', 0.12, 2);
      autumnTree(-150, -16, 12, ['#f2b23c', '#e8a020', '#ffd060']);
      bareTree(-96, -14, 40);
      fence(v.x0, v.x1, -6);
      road(0, 20);
      fill(20, '#d8a040'); strokes(22, v.y1, '#b88028', 0.1, 4);
      stopSign(44, 2);
      if (su < 0.62) A.crow(45, -47, -1);
      else A.bird(45 + (su - 0.62) * 260, -50 - (su - 0.62) * 140, 1, T, '#2a2d36');
      const idle = su > 0.47 ? (Math.floor(T * 14) % 2) * 0.5 : 0;
      A.blue(bx, 13, 1, 1, { spin: bx * 0.25, bounce: idle, mood: su > 0.86 && su < 0.9 ? 'shut' : 'happy' });
    },
    upd(su) { if (su > 0.47 && Math.random() < 0.12) puff(sx(this.blueX(su) - 24), sy(10), 1, '#d8d4cc'); },
    shots: [
      { u: -99, cam: () => setCam(0, -16, 176, 96) },
      { u: 0.64, cam(su) { setCam(s1.blueX(su) + 14, -8, 52, 40); } },
    ],
    words: [[0.47, 'BEEP', su => [s1.blueX(su) + 18, -18]]],
  };

  // 2. Down the road past the marsh: a beep for the big green toad; he croaks and winks.
  const s2 = {
    sky: 'dusk',
    blueX: su => lerp(-150, 170, clamp01(su / 1.0)),
    world(su) {
      const v = vis(), bx = this.blueX(su);
      hills(-30, 4, 0.05, 2, '#e6c070');
      fill(-28, '#e2b45a', 0);
      ellipse(-70, -16, 46, 6, '#f2d878'); ellipse(-70, -16, 40, 4, '#f8e6a0');
      reeds(v.x0, -20, -30, -2); reeds(60, v.x1, -24, -2);
      cattails(-130, -40, -4, 1); cattails(80, 150, -4, 2);
      for (let i = 0; i < 5; i++) { const hx = -105 + i * 22, hp = Math.abs(hx - bx) < 40 ? 0 : Math.max(0, Math.sin(T * 3 + i * 1.7)) * 5; A.toad(hx, -6 - hp, 1, { legsOut: hp > 2 }); }
      for (let i = 0; i < 3; i++) A.bird(((T * 22 + i * 90) % 360) - 180, -70 + i * 9, 1, T + i);
      road(0, 18);
      fill(18, '#d8a040'); strokes(20, v.y1, '#b88028', 0.12, 5);
      A.blue(bx, 12, 1, 1, { spin: bx * 0.25 });
      cattails(-60, -20, 30, 3);
      rock(32, 34, 13, 6);
      A.toad(32, 31, 2, { wink: su > 0.8 && su < 0.86, croak: su > 0.56 && su < 0.62 && Math.floor(T * 8) % 2 });
    },
    // the second page: Blue rolls toward us under the TOAD CROSSING sign, the toad riding on top
    head(su) {
      const v = vis(), d = clamp01((su - 1) / 0.95);
      fill(-40, '#d8b060'); hills(-40, 6, 0.06, 4, '#c89a40');
      for (const side of [-1, 1]) for (let i = 0; i < 6; i++) { const x = side * (40 + i * 18), y = -30 + i * 14; for (let k = 0; k < 4; k++) R(x + k * 3 - 4, y - 8 + Math.abs(k - 2), 1, 8, '#8a6a2a'); circle(x, y - 9, 2, '#c99a3a'); }
      perspectiveRoad(-40, 70);
      toadSign(-46, -10);
      autumnTree(110, -10, 18, ['#f2b23c', '#e8902a', '#ffd060']);
      A.toad(70, 30, 1, { legsOut: true, hop: Math.max(0, Math.sin(T * 5)) * 4 });
      const k = lerp(0.35, 2.1, eout(d)), yb = lerp(-34, 36, eout(d));
      scaled((x, yb2) => { A.blueFront(x, yb2, 1, { look: 0 }); A.toad(x, yb2 - 31, 1, { croak: su > 1.32 && su < 1.42 && Math.floor(T * 8) % 2 }); }, 44, 60, 0, yb, k);
    },
    close(su) {
      const v = vis();
      fill(v.y0, '#f7e0aa', 0); fill(0, '#d8a040');
      A.blueFront(0, 40, 2, {});
      A.toad(0, -22, 2, { wink: su > 1.72 && su < 1.86, grin: su > 1.7 });
    },
    shots: [
      { u: 0, cam(su) { setCam(Math.max(-70, Math.min(30, s2.blueX(su))), -10, 176, 100); } },
      { u: 0.6, cam() { setCam(32, 10, 54, 46); } },
      { u: 1.0, world: su => s2.head(su), cam() { setCam(0, -6, 150, 100); } },
      { u: 1.6, world: su => s2.close(su), cam() { setCam(0, -38, 60, 64); } },
    ],
    words: [[0.42, 'BEEP', su => [s2.blueX(su) + 18, -16]], [1.32, 'CROAK', () => [0, -44]]],
  };

  // 3. Past the farm: the sheep says baa, the cow moo, the piggy oink, and Blue beep.
  const s3 = {
    sky: 'dusk', leaves: true,
    blueX: su => lerp(240, 92, eout(seg(su, 0.62, 0.95))),
    world(su) {
      const v = vis();
      fill(-24, '#d8a848', 0);
      hills(-20, 18, 0.03, 1, '#a8a040'); for (let x = 30; x < v.x1; x += 9) R(x, -30 + Math.round(Math.sin(x * 0.05) * 6), 6, 1, '#8a8a30');
      fill(-6, '#e2b440', 0);
      for (let x = v.x0; x < v.x1; x += 12) circle(x, -26 - Math.round(hsh(x) * 4), 3, '#a85a2a');
      barn(-130, 0);
      A.sheep(-104, 0, 1, 1, { mouth: su < 0.2 && Math.floor(T * 6) % 2 });
      fence(-54, -20, 2);
      featherTree(10, 0, 38);
      A.pig(54, -2, 1, 1, { mouth: su > 0.5 && su < 0.7 && Math.floor(T * 6) % 2, step: Math.floor(T * 3) % 2 });
      road(4, 16);
      fill(20, '#d8a040'); strokes(22, v.y1, '#b88028', 0.12, 6);
      A.blue(this.blueX(su), 14, -1, 1, { spin: -this.blueX(su) * 0.25 });
      A.cow(-40, 46, 1, 2, { mouth: su > 0.26 && su < 0.46 && Math.floor(T * 5) % 2 });
    },
    shots: [
      { u: 0, cam() { setCam(-104, -12, 58, 42); } },
      { u: 0.25, cam() { setCam(-38, 22, 72, 54); } },
      { u: 0.5, cam() { setCam(54, -8, 46, 34); } },
      { u: 0.75, cam() { setCam(10, -4, 230, 110); } },
    ],
    words: [[0.05, 'BAA', () => [-98, -16]], [0.28, 'MOO', () => [-6, 2]], [0.53, 'OINK', () => [62, -16]], [0.8, 'BEEP', su => [s3.blueX(su) - 18, -10]]],
  };

  // 4. Rain on the hills; the hen and her chick, the goat, the horse and the duck all say hello.
  const ry = x => -6 + 10 * Math.sin(x * 0.018);
  const s4 = {
    sky: 'rain', rain: 0.8,
    blueX: su => su < 0.9 ? lerp(-90, 60, su / 0.9) : su < 1.5 ? lerp(60, 120, (su - 0.9) / 0.6) : lerp(120, 300, (su - 1.5) / 0.5),
    world(su) {
      const v = vis();
      hills(-34, 10, 0.02, 3, '#c8c070');
      fill(-30, '#a8a040', 0); for (let x = v.x0 - (v.x0 % 6); x < v.x1; x += 6) R(x, -28 + Math.round(Math.sin(x * 0.04) * 3), 4, 1, '#8a8a30');
      for (let i = -3; i < 12; i++) pine(i * 9 + 120, -24, 9);
      autumnTree(30, ry(30) - 4, 14, ['#c8401a', '#a83010', '#e06a20']);
      autumnTree(140, ry(140) - 6, 16, ['#a8442a', '#8a3020', '#c8603a']);
      // the road rolling over the hills, golden grass below
      for (let x = v.x0 - (v.x0 % 2); x < v.x1; x += 2) {
        const y = Math.round(ry(x));
        R(x, y - 6, 2, 3, '#a8601a'); R(x, y - 3, 2, 10, '#b8b2a4'); R(x, y - 3, 2, 1, '#948e80');
        if (hsh(x) < 0.3) R(x, y + Math.floor(hsh(x * 3) * 8) - 2, 2, 1, '#cdc7ba');
        R(x, y + 7, 2, v.y1 - y - 7, '#f0c040');
      }
      strokes(10, v.y1, '#d8a020', 0.14, 7);
      const goatHop = su > 0.63 && su < 0.82 ? Math.abs(Math.sin(su * 60)) * 5 : 0;
      A.hen(58, ry(58) - 5, 1, 1, { mouth: su > 0.32 && su < 0.44 && Math.floor(T * 6) % 2, flap: su > 0.32 && su < 0.44 ? (Math.floor(T * 8) % 2 ? 1 : -1) : 0 });
      A.chick(68, ry(68) - 5, 1, 1, { hop: su > 0.44 && su < 0.56 ? Math.abs(Math.sin(T * 12)) * 2 : 0 });
      A.goat(118, ry(118) - 5, 1, 1, { hop: goatHop, mouth: su > 0.63 && su < 0.82 && Math.floor(T * 6) % 2 });
      const rear = su > 1.02 && su < 1.3 ? Math.sin(seg(su, 1.02, 1.3) * Math.PI) : 0;
      A.horse(192, ry(192) - 5, -1, 1, { rear, mouth: rear > 0.2 });
      A.duck(194 + Math.round(rear * 2), ry(192) - 26 - Math.round(rear * 4), -1, 1, { mouth: su > 1.36 && su < 1.5 && Math.floor(T * 6) % 2, flap: su > 1.36 && su < 1.5 ? (Math.floor(T * 8) % 2 ? 1 : -1) : 0 });
      const bx = this.blueX(su);
      A.blue(bx, ry(bx) + 4, 1, 1, { spin: bx * 0.25 });
    },
    shots: [
      { u: 0, cam(su) { const bx = s4.blueX(su); setCam(bx + 20, ry(bx) - 12, 160, 104); } },
      { u: 0.3, cam() { setCam(64, ry(64) - 10, 46, 36); } },
      { u: 0.6, cam() { setCam(118, ry(118) - 14, 50, 38); } },
      { u: 0.85, cam(su) { const bx = s4.blueX(su); setCam(bx, ry(bx) - 12, 84, 62); } },
      { u: 1.0, cam() { setCam(190, ry(190) - 22, 74, 58); } },
      { u: 1.33, cam() { setCam(194, ry(192) - 36, 42, 32); } },
      { u: 1.6, cam(su) { const bx = s4.blueX(su); setCam(bx - 30, ry(bx) - 14, 200, 120); } },
    ],
    words: [[0.33, 'CLUCK', () => [62, ry(58) - 20]], [0.45, 'PEEP', () => [70, ry(68) - 12]], [0.65, 'MAA', () => [124, ry(118) - 30]], [0.9, 'BEEP', su => [s4.blueX(su) + 18, ry(s4.blueX(su)) - 14]],
      [1.05, 'NEIGH', () => [180, ry(192) - 42]], [1.38, 'QUACK', () => [190, ry(192) - 44]], [1.72, 'BEEP', su => [s4.blueX(su) + 18, ry(s4.blueX(su)) - 14]]],
  };

  // 5. "Honk!" The big dump truck thunders through and splashes past everyone.
  const s5 = {
    sky: 'rain', rain: 1,
    dumpX: su => su < 1 ? lerp(-260, 90, seg(su, 0.1, 0.5)) : lerp(-110, 420, seg(su, 1.0, 1.9)),
    blueY: su => lerp(9, 24, eout(seg(su, 0.2, 0.4))),
    world(su) {
      const v = vis(), dx = this.dumpX(su);
      hills(-30, 6, 0.03, 5, '#c8c070'); fill(-28, '#c89a3a', 0); strokes(-26, 0, '#a8781a', 0.12, 8);
      A.cow(-160, -3, 1, 1, {}); A.horse(-122, -3, 1, 1, {}); A.goat(-92, -3, 1, 1, {});
      road(0, 20);
      fill(20, '#d8a040'); strokes(22, v.y1, '#b88028', 0.12, 9);
      // nearest last: the dump keeps to the middle of the road, Blue pulls over toward us
      const bx = lerp(-10, 20, seg(su, 0, 0.45)), by = this.blueY(su), close = Math.abs(dx - bx) < 90;
      const duckFly = clamp01((dx - 210) / 120);
      const actors = [
        [12, () => A.dump(dx, 12, 1, 1, { spin: dx * 0.2, mood: 'cross', shake: Math.floor(T * 20) % 2 })],
        [by, () => A.blue(bx, by, 1, 1, { spin: bx * 0.3, mood: close ? 'wide' : 'happy', bounce: close ? Math.floor(T * 16) % 2 : 0 })],
        [22, () => A.duck(262 + duckFly * 90, 22 - duckFly * 40, 1, 1, { flap: duckFly > 0 ? (Math.floor(T * 10) % 2 ? 1 : -1) : 0, mouth: duckFly > 0 && duckFly < 0.6 })],
      ];
      actors.sort((a, b) => a[0] - b[0]).forEach(a => a[1]());
    },
    upd(su) { const dx = this.dumpX(su); if (Math.random() < 0.5) spawn(2, () => ({ x: sx(dx - 30), y: sy(10), vx: rand(-60, -20), vy: rand(-50, -20), g: 150, life: 0.5, max: 0.5, s: 1, c: '#c8d4dc' })); },
    front(su) {
      const v = vis(), k = seg(su, 0.5, 1.0);
      fill(-40, '#c89a3a'); hills(-40, 6, 0.05, 6, '#b88a30');
      perspectiveRoad(-40, 90);
      const shake = Math.floor(T * 22) % 2;
      A.dumpFront(0, lerp(4, 18, k), 1, { mood: 'cross', shake });
      for (let i = 0; i < 6; i++) { const ph = (T * 3 + i / 6) % 1; R(-36 - ph * 30, 14 - ph * 10 + i, 3, 1, '#c8d4dc'); R(36 + ph * 30, 14 - ph * 10 + i, 3, 1, '#c8d4dc'); }
    },
    shots: [
      { u: 0, cam(su) { setCam(lerp(-40, 30, seg(su, 0, 0.5)), -16, 186, 104); } },
      { u: 0.5, world: su => s5.front(su), cam() { setCam(0, -26, 84, 70); } },
      { u: 1.0, cam(su) { setCam(s5.dumpX(su) + 30, -18, 170, 104); } },
      { u: 1.55, cam(su) { setCam(s5.dumpX(su) + 52, -24, 84, 58); } },
    ],
    words: [[0.18, 'HONK', su => [s5.dumpX(su) + 34, -40], true], [0.56, 'HONK', () => [0, -50], true], [1.62, 'HONK', su => [s5.dumpX(su) + 34, -40], true]],
  };

  // 6. Around the curve (seen from high above), into the puddle, and stuck in the mud.
  const curve = p => [-120 + 240 * p, 46 * Math.sin(p * Math.PI * 1.25 - 0.5)];
  const PUD = [52, 18];
  const s6 = {
    sky: 'gold',
    pos(su) {
      if (su < 0.5) { const p = su / 0.5 * 0.68, [x, y] = curve(p), [x2, y2] = curve(p + 0.01); return [x, y, Math.atan2(y2 - y, x2 - x)]; }
      const [x0, y0] = curve(0.68), k = eout(seg(su, 0.5, 0.6)), [x1, y1] = curve(0.69);
      return [lerp(x0, PUD[0], k), lerp(y0, PUD[1], k), lerp(Math.atan2(y1 - y0, x1 - x0), 0.9, k)];
    },
    top(su) {
      const v = vis();
      fill(v.y0, '#e8a838');
      for (let i = 0; i < 120; i++) { const x = v.x0 + hsh(i) * (v.x1 - v.x0), y = v.y0 + hsh(i * 3.1) * (v.y1 - v.y0); R(x, y, 3, 1, i % 2 ? '#d89028' : '#f2b848'); }
      for (let p = 0; p < 1; p += 0.004) { const [x, y] = curve(p); circle(x, y, 9, '#a8a294'); }
      for (let p = 0; p < 1; p += 0.004) { const [x, y] = curve(p); circle(x, y, 7, '#c2bcae'); if (hsh(p * 900) < 0.2) R(x - 4, y - 2, 6, 1, '#a8a294'); }
      mudPool(PUD[0], PUD[1] + 4, 26, 13, 4);
      for (let i = 0; i < 13; i++) { const x = -20 + i * 9, y = -70 + i * 2; R(x, y, 2, 2, '#f4efe2'); if (i < 12) R(x + 1, y + 1, 9, 2, '#f4efe2'); }
      for (const [tx, ty, r, c] of [[-60, -46, 12, '#c8601a'], [128, -62, 15, '#d8902a'], [-25, 70, 11, '#a85a2a']]) { circle(tx + 3, ty + 3, r, '#b87018'); circle(tx, ty, r, c); circle(tx - 3, ty - 3, r * 0.5, '#f2b23c'); }
      A.horse(-128, -52, 1, 1, {}); A.hen(-104, -50, 1, 1, {}); A.duck(-150, -34, 1, 1, {}); A.sheep(-122, 72, 1, 1, {}); A.pig(-100, 74, 1, 1, {}); A.cow(-68, 78, 1, 1, {}); A.goat(70, -20, 1, 1, {});
      const [x, y, a] = this.pos(su);
      A.dumpTop(x, y, a, 1);
      for (let i = 0; i < 26; i++) { const ph = (T * 0.9 + i * 0.137) % 1, rx = v.x0 + hsh(i * 7.7) * (v.x1 - v.x0), ryy = v.y0 + ph * (v.y1 - v.y0); R(rx, ryy, 1, 3, '#ffffff'); R(rx - 1, ryy + 2, 3, 1, '#ffffff'); }
    },
    stuck(su) {
      const v = vis();
      fill(-30, '#e8a838'); hills(-30, 5, 0.05, 7, '#d89028'); strokes(-28, v.y1, '#c88020', 0.1, 10);
      mudPool(10, 14, 70, 9, 2);
      A.dump(10, 18, 1, 1, { spin: T * 30, mood: 'worried', mud: 0.5, shake: Math.floor(T * 18) % 2 });
      mudFront(10, 10, 110, 14);
    },
    upd(su) { if (su > 0.66 && Math.random() < 0.7) for (const wx of [-28, -12, 29]) mudFling(wx, 10, 1); if (su > 0.58 && su < 0.66 && Math.random() < 0.6) { const [x, y] = this.pos(su); mudFling(x, y, 2); } },
    shots: [
      { u: 0, world: su => s6.top(su), cam(su) { setCam(0, 4, 200, 156); } },
      { u: 0.66, world: su => s6.stuck(su), cam() { setCam(10, -14, 104, 72); } },
    ],
    words: [[0.04, 'VROOM', su => s6.pos(su)], [0.72, 'STUCK', () => [40, -38], true]],
  };

  // 7. The Dump honks for help, but nobody heard (or nobody cared).
  const s7 = {
    sky: 'rain', rain: 0.7,
    front(su) {
      const v = vis(), sink = Math.round(lerp(0, 8, seg(su, 0, 0.5)));
      fill(-20, '#c89a3a'); hills(-20, 8, 0.05, 8, '#b88a30');
      for (let i = 0; i < 2; i++) A.bird(((T * 30 + i * 140) % 280) - 140, -70 + i * 12, 1, T + i);
      A.dumpFront(0, 16 + sink, 1, { mood: 'worried', mud: 0.4 });
      mudFront(0, 10, 120, v.y1 - 10);
    },
    backs(su) {
      const v = vis();
      fill(-30, '#ece9d2'); ellipse(0, 4, 74, 9, '#d8a040'); ellipse(0, 6, 70, 7, '#e2b44a'); strokes(0, 12, '#b88028', 0.2, 11);
      const flick = Math.floor(T * 2) % 3 === 0;
      A.sheep(-52, 4, 1, 1, {}); A.duck(-36, 4, 1, 1, {});
      A.horse(26, 4, 1, 1, {}); A.cow(2, 6, 1, 1, { step: flick ? 1 : 0 }); A.hen(10, -17, 1, 1, {});
      A.pig(54, 6, 1, 1, {});
    },
    shots: [
      { u: 0, world: su => s7.front(su), cam() { setCam(0, -24, 84, 70); } },
      { u: 0.55, world: su => s7.backs(su), cam() { setCam(0, -12, 140, 74); } },
    ],
    words: [[0.12, 'HONK', () => [0, -52]]],
  };

  // the Dump stuck in the mud, Blue rolling up behind him (shared by the next spreads)
  const DUMP_X = 120, BLUE_STOP = 57;
  function stuckSet(su, blueX, blueSink, o = {}) {
    const v = vis();
    hills(-30, 6, 0.03, 9, '#d8b060'); fill(-28, '#e2a838', 0); strokes(-26, 0, '#c88020', 0.1, 12);
    for (let i = 0; i < 9; i++) pine(-200 + i * 11, -26, 8);
    autumnTree(-150, -24, 12, ['#e8902a', '#d0642a', '#f2b23c']);
    if (o.fence) fence(v.x0, v.x1, -10);
    road(0, 20); fill(20, '#d8a040'); strokes(22, v.y1, '#b88028', 0.12, 13);
    mudPool(96, 14, 90, 9, 3);
    if (o.behind) o.behind();
    if (o.out) mudFront(96, 16, 190, 10);   // once the trucks are out, the mud stays behind them
    A.dump(o.dumpX != null ? o.dumpX : DUMP_X, 18 + (o.dumpSink != null ? o.dumpSink : 6), 1, 1, { spin: o.spin ? T * 30 : 0, mood: o.dumpMood || 'worried', mud: 0.5, shake: o.shake || 0 });
    if (blueX != null) A.blue(blueX, 15 + blueSink, 1, 1, { spin: o.spin ? T * 30 : blueX * 0.3, mood: o.blueMood || 'happy', mud: o.blueMud || 0, bounce: o.bounce || 0, shake: o.shake || 0 });
    if (o.front) o.front();
    if (!o.out) mudFront(96, 16, 190, 10);
  }

  // 8. Then into the mud — bump, bump, bump — came Little Blue to help, and now both are stuck.
  const s8 = {
    sky: 'rain', rain: 0.7,
    blueX: su => su < 1 ? lerp(-140, BLUE_STOP, eout(seg(su, 0.55, 1.0))) : BLUE_STOP,
    mirror(su) {
      const v = vis();
      fill(v.y0, '#e0a020'); for (let i = 0; i < 160; i++) R(v.x0 + hsh(i) * (v.x1 - v.x0), v.y0 + hsh(i * 2.3) * (v.y1 - v.y0), 2, 1, i % 2 ? '#c88a10' : '#a86a10');
      R(-34, -58, 4, 70, '#6a4a3a'); R(-34, -58, 50, 4, '#6a4a3a'); R(30, -40, 4, 52, '#6a4a3a');
      R(-24, -50, 44, 56, '#4a3a30'); R(-22, -48, 40, 52, '#e8ecef');
      g.save(); g.beginPath(); g.rect(-20, -46, 36, 48); g.clip();
      R(-20, -46, 36, 20, '#cbd5cf'); R(-20, -26, 36, 28, '#c89a3a');
      for (let y = -26; y < 2; y++) { const hw = 2 + (y + 26) * 0.8; R(-2 - hw, y, hw * 2, 1, '#b8b2a4'); }
      for (let i = 0; i < 14; i++) R(-20 + hsh(i) * 36, -46 + ((i * 7 + T * 40) % 48), 1, 2, '#ffffff');
      const k = seg(su, 0, 0.55), bump = Math.abs(Math.sin(su * 34)) * 2;
      scaled((x, yb) => A.blueFront(x, yb, 1, {}), 36, 34, -2, lerp(-18, 4, k) - bump, lerp(0.3, 1.1, k));
      R(-20, -10, 36, 12, '#6a3a1a'); for (let i = 0; i < 8; i++) R(-20 + i * 5, -10 + (i % 2), 4, 1, '#8a5028');
      g.restore();
      R(-22, -48, 40, 1, '#ffffff'); R(-22, -48, 1, 52, '#ffffff');
    },
    side(su) {
      const bx = this.blueX(su), sink = Math.round(lerp(0, 6, seg(su, 1.5, 1.85)));
      stuckSet(su, bx, sink, { spin: su > 1.0, blueMood: su > 1.55 ? 'worried' : 'happy', blueMud: lerp(0, 0.7, seg(su, 0.95, 1.6)), bounce: su < 1 ? Math.abs(Math.sin(su * 40)) * 2 : 0, shake: su > 1 ? Math.floor(T * 16) % 2 : 0 });
    },
    rear(su) {
      const v = vis(), sh = Math.floor(T * 14) % 2;
      fill(-40, '#e2a838'); hills(-40, 6, 0.04, 10, '#d8b060');
      A.dumpRear(0, 12, 1, { mud: 0.5, shake: sh });
      A.blueRear(0, 30, 1, null, { mud: 0.4 });
      mudFront(0, 24, 120, v.y1 - 24);
      for (let i = 0; i < 4; i++) { const a = T * 6 + i; R(-30 - i * 3, 0 - Math.abs(Math.sin(a)) * 6, 2, 2, '#ffffff'); R(28 + i * 3, 0 - Math.abs(Math.cos(a)) * 6, 2, 2, '#ffffff'); }
    },
    upd(su) {
      if (su > 1.0 && Math.random() < 0.6) { mudFling(BLUE_STOP - 14, 14, 1); mudFling(BLUE_STOP + 14, 14, 1); }
      if (su > 1.0 && Math.random() < 0.4) mudFling(DUMP_X - 28, 14, 1);
    },
    shots: [
      { u: 0, world: su => s8.mirror(su), cam() { setCam(-2, -22, 74, 72); } },
      { u: 0.55, world: su => s8.side(su), cam(su) { setCam(Math.max(-60, s8.blueX(su) + 30), -16, 176, 100); } },
      { u: 1.0, world: su => s8.rear(su), cam() { setCam(0, -18, 96, 76); } },
      { u: 1.5, world: su => s8.side(su), cam() { setCam(92, -18, 156, 90); } },
    ],
    words: [[0.12, 'BUMP', () => [24, -50]], [0.26, 'BUMP', () => [30, -36]], [0.4, 'BUMP', () => [36, -22]], [1.55, 'STUCK', () => [80, -46], true]],
  };

  // 9. "Help! Help! Help! Beep! Beep! Beep!" The cow comes running with the pig and the sheep.
  const s9 = {
    sky: 'rain', rain: 0.5,
    runX: su => lerp(-190, 70, seg(su, 0.45, 1.0)),
    run(su) {
      const v = vis(), x = this.runX(su), st = Math.floor(T * 10) % 2;
      hills(-34, 8, 0.03, 11, '#d8b060'); fill(-30, '#e8b040'); strokes(-28, v.y1, '#c88a20', 0.14, 14);
      for (let i = 0; i < 9; i++) pine(-60 + i * 11, -30, 8);
      fence(-120, 60, -18);
      A.sheep(x - 70, 6, 1, 1, { run: true, step: st, hop: Math.abs(Math.sin(T * 12)) * 2 });
      A.cow(x, 8, 1, 1, { run: true, step: st, hop: Math.abs(Math.sin(T * 10)) * 2, mouth: true });
      A.pig(x - 36, 12, 1, 1, { run: true, step: 1 - st, hop: Math.abs(Math.sin(T * 14)) * 2 });
    },
    shots: [
      { u: 0, world: su => stuckSet(su, BLUE_STOP, 6, { spin: true, blueMood: 'worried', blueMud: 0.8, shake: Math.floor(T * 16) % 2 }), cam() { setCam(BLUE_STOP + 4, -12, 66, 50); } },
      { u: 0.45, world: su => s9.run(su), cam(su) { setCam(s9.runX(su) - 20, -10, 170, 104); } },
    ],
    words: [[0.04, 'BEEP', () => [BLUE_STOP - 14, -14]], [0.15, 'BEEP', () => [BLUE_STOP + 4, -30]], [0.26, 'BEEP', () => [BLUE_STOP + 22, -46]]],
  };

  // the push line: everybody head to rump behind Blue (front first)
  const LINE = [['cow', 34], ['horse', 36], ['pig', 20], ['sheep', 24], ['goat', 22], ['hen', 14], ['chick', 8], ['duck', 14], ['toad', 18]];
  const DRAW = { cow: A.cow, horse: A.horse, pig: A.pig, sheep: A.sheep, goat: A.goat, hen: A.hen, chick: A.chick, duck: A.duck };
  function lineSlots() {
    const out = []; let right = BLUE_STOP - 22;
    for (const [k, w] of LINE) { out.push({ k, x: right - w / 2, w }); right -= w - 3; }
    return out;
  }
  // arrive: 0..1 how far everyone has walked in; push: lean; toadIn: is the toad in line; free: 0..1 trucks pulling out
  function pushLine(su, o) {
    const slots = lineSlots(), lean = Math.round(Math.sin(T * 9) * 0.8 + (o.lean || 0));
    const fr = o.free || 0, cheer = o.cheer || 0;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.k === 'toad' && !o.toadIn) continue;
      const arrive = clamp01((o.arrive == null ? 1 : o.arrive) * 1.6 - i * 0.07);
      const x = lerp(s.x - 200 - i * 10, s.x, eout(arrive)) + lean + fr * 14, walking = arrive < 1;
      const hop = cheer > 0 ? Math.abs(Math.sin(T * 9 + i)) * 5 * cheer : 0;
      const yb = 16 + (['hen', 'chick', 'duck', 'toad'].includes(s.k) ? 2 : 0);
      if (s.k === 'toad') A.toad(x, yb, 1, { hop, grin: true });
      else DRAW[s.k](x, yb, 1, 1, { step: walking ? Math.floor(T * 10) % 2 : 0, run: walking, hop, mud: 0.3 + 0.5 * fr, mouth: cheer > 0 && Math.floor(T * 5 + i) % 2 });
    }
  }
  function lineSet(su, o) {
    const fr = o.free || 0;
    stuckSet(su, BLUE_STOP + fr * 90, 6 * (1 - fr), {
      spin: true, dumpX: DUMP_X + fr * 98, dumpSink: 6 * (1 - fr), dumpMood: fr > 0.6 ? 'happy' : 'worried', blueMood: fr > 0.6 ? 'happy' : 'worried', blueMud: 0.8,
      shake: fr > 0 && fr < 1 ? 0 : Math.floor(T * 16) % 2, out: fr > 0.35,
      behind: () => pushLine(su, o),
    });
  }

  // 10. Up gallops the horse (with the duck), the goat leaps the fence, the hen comes flapping.
  const s10 = {
    sky: 'rain', rain: 0.35,
    gallop(su) {
      const v = vis(), x = lerp(-170, 90, seg(su, 0, 0.45)), st = Math.floor(T * 12) % 2;
      hills(-32, 8, 0.03, 12, '#d8b060'); fill(-30, '#e8b040'); strokes(-28, v.y1, '#c88a20', 0.14, 15);
      autumnTree(-60, -26, 14, ['#e8902a', '#d0642a', '#f2b23c']); for (let i = 0; i < 9; i++) pine(-20 + i * 10, -28, 8);
      const bob = Math.abs(Math.sin(T * 12)) * 3;
      A.horse(x, 10, 1, 1, { run: true, step: st, hop: bob });
      A.duck(x - 4, 10 - 23 - bob, 1, 1, { flap: Math.floor(T * 10) % 2 ? 1 : -1 });
    },
    goatJump(su) {
      const v = vis(), k = seg(su, 0.45, 0.95);
      hills(-34, 8, 0.03, 13, '#d8b060'); fill(-30, '#e8b040'); strokes(-28, v.y1, '#c88a20', 0.14, 16);
      for (let i = 0; i < 9; i++) pine(-80 + i * 13, -30, 8);
      let x, h = 0, tuck = false;
      if (k < 0.3) x = lerp(-80, -22, k / 0.3);
      else if (k < 0.75) { const j = (k - 0.3) / 0.45; x = lerp(-22, 34, j); h = Math.sin(j * Math.PI) * 24; tuck = j > 0.15 && j < 0.85; }
      else x = lerp(34, 80, (k - 0.75) / 0.25);
      alpha(0.25, () => ellipse(x, 15, Math.max(4, 9 - h / 5), 1, '#6a4a10'));
      R(-9, -4, 3, 18, '#f4efe2'); R(8, -4, 3, 18, '#f4efe2'); R(-9, -1, 20, 2, '#f4efe2'); R(-9, 4, 20, 2, '#f4efe2'); R(-9, 9, 20, 2, '#f4efe2');
      R(-7, -4, 1, 18, '#d8d2c4'); R(10, -4, 1, 18, '#d8d2c4'); R(-9, 14, 20, 1, '#c8902a');
      A.goat(x, 14 - h, 1, 1, { run: !tuck, tuck, step: Math.floor(T * 10) % 2, mouth: h > 16 });
      if (h > 18 && Math.random() < 0.3) sparkle(sx(x), sy(-h - 6), 10 * cam.z, 2);
    },
    hens(su) {
      const v = vis(), x = lerp(-110, 70, seg(su, 1.0, 1.5)), st = Math.floor(T * 12) % 2;
      hills(-28, 6, 0.04, 14, '#d8b060'); fill(-26, '#e8b040'); strokes(-24, v.y1, '#c88a20', 0.14, 17);
      A.hen(x, 10 - Math.abs(Math.sin(T * 10)) * 3, 1, 1, { run: true, step: st, flap: st ? 1 : -1 });
      A.chick(x - 16, 10 - Math.abs(Math.sin(T * 14)) * 2, 1, 1, { run: true, step: 1 - st });
      A.duck(x - 32, 10, 1, 1, { run: true, step: st, flap: Math.floor(T * 8) % 2 ? 1 : -1 });
    },
    shots: [
      { u: 0, world: su => s10.gallop(su), cam(su) { setCam(lerp(-170, 90, seg(su, 0, 0.45)), -16, 124, 86); } },
      { u: 0.45, world: su => s10.goatJump(su), cam() { setCam(0, -12, 100, 74); } },
      { u: 1.0, world: su => s10.hens(su), cam(su) { setCam(lerp(-110, 70, seg(su, 1.0, 1.5)) - 14, -6, 80, 56); } },
      { u: 1.5, world: su => lineSet(su, { arrive: seg(su, 1.5, 2.0) }), cam() { setCam(portrait() ? 40 : 30, -14, portrait() ? 160 : 250, 110); } },
    ],
    words: [[0.08, 'NEIGH', su => [lerp(-170, 90, seg(su, 0, 0.45)) + 12, -36]], [0.68, 'MAA', () => [10, -36]], [1.08, 'CLUCK', su => [lerp(-110, 70, seg(su, 1.0, 1.5)) + 4, -10]], [1.24, 'PEEP', su => [lerp(-110, 70, seg(su, 1.0, 1.5)) - 14, -4]]],
  };

  // 11. Head to head and rump to rump, everyone pushes; then up hops the big green toad.
  const s11 = {
    sky: 'rain', rain: 0.2,
    toadX: su => lerp(-260, lineSlots()[LINE.length - 1].x, seg(su, 1.0, 1.4)),
    hop(su) {
      const x = this.toadX(su);
      lineSet(su, {});
      const h = su < 1.4 ? Math.abs(Math.sin(su * 26)) * 14 : 0;
      A.toad(x, 18 - h, 1, { legsOut: h > 3 });
    },
    flex(su) {
      const v = vis();
      fill(v.y0, '#f6f1e4');
      ellipse(4, 6, 40, 9, '#4a2610'); ellipse(0, 4, 36, 8, '#6a3a1a'); for (let i = 0; i < 9; i++) R(-28 + i * 7, 2 + (i % 3) * 2, 6, 1, '#8a5028');
      R(-34, -16, 20, 2, '#d8d2c4'); R(-38, -12, 24, 3, '#b8b2a4'); R(-40, -8, 26, 3, '#a8a294');
      A.toad(0, 6, 2, { flex: su > 1.5, grin: true, wink: su > 1.8 && su < 1.88 });
    },
    shots: [
      { u: 0, world: su => lineSet(su, {}), cam(su) { setCam(lerp(-110, 90, seg(su, 0, 0.55)), -14, 150, 92); } },
      { u: 0.55, world: su => lineSet(su, {}), cam() { setCam(DUMP_X - 20, -18, 104, 66); } },
      { u: 1.0, world: su => s11.hop(su), cam(su) { setCam(Math.max(-190, s11.toadX(su)) + 10, -10, 90, 60); } },
      { u: 1.45, world: su => s11.flex(su), cam() { setCam(0, -18, 70, 50); } },
    ],
    words: [[1.62, 'CROAK', () => [0, -42]]],
  };

  // 12. All together — one, two, three! — one last push and the trucks are FREE!
  const s12 = {
    sky: 'rain', rain: 0,
    pushes: [0.08, 0.24, 0.4],
    world(su) {
      const lean = this.pushes.reduce((m, p) => m + Math.max(0, 1 - Math.abs(su - p - 0.05) * 14) * 3, 0);
      lineSet(su, { toadIn: true, lean, free: eout(seg(su, 0.55, 0.72)), cheer: seg(su, 0.7, 0.78) });
    },
    upd(su) {
      if (su > 0.55 && su < 0.66) for (let i = 0; i < 3; i++) mudFling(lerp(DUMP_X, DUMP_X + 90, seg(su, 0.55, 0.72)) - 30 + Math.random() * 60, 12, 2);
      if (su > 0.7 && su < 0.9 && Math.random() < 0.3) confetti(2);
    },
    shots: [
      { u: 0, cam(su) { setCam(portrait() ? 40 : 26, -16, portrait() ? 160 : 250, 112); } },
      { u: 0.62, cam(su) { setCam(lerp(DUMP_X, DUMP_X + 90, eout(seg(su, 0.55, 0.72))) - 30, -22, 124, 78); } },
    ],
    words: [[0.66, 'BEEP', su => [BLUE_STOP + 90 + 18, -22]], [0.74, 'HONK', () => [DUMP_X + 98 + 30, -46], true]],
    numbers: [[0.08, 1], [0.24, 2], [0.4, 3]],
    noises: [[0.56, 'SPLAT'], [0.7, 'YAY']],
  };

  // 13. "Beep! Who wants a ride?" Everybody scrambles in: oink, quack, baa, moo, cluck, peep, neigh, croak, maa!
  const RIDE = [['pig', 'OINK', -14, -1], ['duck', 'QUACK', -20, -3], ['sheep', 'BAA', -8, 0], ['cow', 'MOO', -12, 2], ['hen', 'CLUCK', -4, -32], ['chick', 'PEEP', -2, -42], ['horse', 'NEIGH', -6, -2], ['toad', 'CROAK', 0, 0], ['goat', 'MAA', -16, -18]];
  const RIDE_ORDER = ['horse', 'cow', 'goat', 'sheep', 'pig', 'duck', 'hen', 'chick'];
  const s13 = {
    sky: 'clear', life: 0.75,
    when: i => 0.24 + i * 0.08,
    world(su) {
      const v = vis();
      hills(-26, 6, 0.04, 15, '#e8c070'); fill(-24, '#e8b848', 0); strokes(-22, 0, '#c89a28', 0.1, 18);
      road(0, 20); fill(20, '#d8a848'); strokes(22, v.y1, '#b88a28', 0.1, 19);
      for (let i = 0; i < 18; i++) R(-120 + i * 7, 22 + (i % 3), 4, 1, '#6a3a1a');
      A.dump(110, 14, 1, 1, { mood: 'happy', mud: 0.4 });
      const bed = {}, ground = {};
      RIDE.forEach(([k, , bx, by], i) => {
        const t = seg(su, this.when(i), this.when(i) + 0.07);
        const startX = -150 + i * 14, startY = 30;
        const x = lerp(startX, bx, t), y = lerp(startY, 2 + by, t) - Math.sin(t * Math.PI) * 18;
        (t > 0.85 ? bed : ground)[k] = [x, y, t];
      });
      const one = (k, x, y, t) => {
        if (k === 'toad') return;
        DRAW[k](x, y, 1, 1, { mud: 0.4, step: t > 0 && t < 1 ? Math.floor(T * 10) % 2 : 0, mouth: t > 0.2 && t < 1 });
      };
      for (const k of RIDE_ORDER) if (bed[k]) one(k, ...bed[k]);
      A.blue(0, 12, 1, 1, { mud: 0.6, mood: 'happy' });
      for (const k of RIDE_ORDER) if (ground[k]) one(k, ...ground[k]);
      const toad = bed.toad || ground.toad;
      if (bed.toad) { R(1, -12, 7, 5, '#7aa83c'); R(2, -13, 2, 2, '#ffffff'); R(5, -13, 2, 2, '#ffffff'); R(3, -12, 1, 1, INK); R(6, -12, 1, 1, INK); R(2, -9, 5, 1, '#4e7424'); }
      else if (toad) A.toad(toad[0], toad[1], 1, { legsOut: toad[2] > 0 });
    },
    shots: [{ u: 0, cam(su) { if (portrait()) setCam(lerp(-60, -10, seg(su, 0.2, 0.9)), -12, 150, 100); else setCam(-28, -12, 210, 110); } }],
    words: [[0.03, 'BEEP', () => [18, -18]], ...RIDE.map(([k, w, bx, by], i) => [0.24 + i * 0.08 + 0.05, w, () => [bx, by - 14]])],
  };

  // 14. Beep! Beep! Beep! Off they go together down the road.
  const s14 = {
    sky: 'clear',
    world(su) {
      const v = vis();
      fill(-30, '#e8c060'); hills(-30, 5, 0.05, 16, '#d8a848');
      strokes(-26, v.y1, '#c8902a', 0.12, 20);
      perspectiveRoad(-30, 70, '#c2b8a4', true);
      const d = clamp01(su / 1.35), k = lerp(2.4, 0.18, eout(d)), yb = lerp(54, -28, eout(d));
      scaled((x, yb2) => A.blueRear(x, yb2, 1, P => {
        A.horse(x + 2, yb2 - 15, -1, 1, {}); A.cow(x + 10, yb2 - 15, 1, 1, {}); A.goat(x - 10, yb2 - 15, -1, 1, {});
        A.hen(x + 14, yb2 - 39, 1, 1, {}); A.duck(x - 12, yb2 - 26, -1, 1, {}); A.sheep(x - 6, yb2 - 15, -1, 1, {});
        A.pig(x + 2, yb2 - 15, 1, 1, {}); A.bird(x - 2, yb2 - 52, 1, T);
      }, { mud: 0.5 }), 60, 70, 0, yb, k);
    },
    upd(su) { if (su > 0.05 && su < 1 && Math.random() < 0.15) puff(W / 2 + rand(-6, 6), sy(lerp(54, -28, eout(clamp01(su / 1.35)))), 1, '#e8dcc4'); },
    shots: [{ u: 0, cam() { setCam(0, -6, 150, 120); } }],
    words: [[0.1, 'BEEP', () => [-50, -54], true], [0.26, 'BEEP', () => [0, -66], true], [0.42, 'BEEP', () => [50, -54], true]],
  };

  const STORY = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14];

  /* ---------- scene plumbing ---------- */
  const st = { t: 0, done: false, s: -1, shot: -1, fired: {}, saved: null, rain: null, paused: false, ui: 0, drag: null, wasPaused: false };
  function where(U) {
    let s = 0; for (let i = 0; i < STORY.length; i++) if (U >= SCENE_AT[i]) s = i;
    const sc = STORY[s], su = U - SCENE_AT[s];
    let shot = 0; for (let i = 0; i < sc.shots.length; i++) if (su >= sc.shots[i].u) shot = i;
    return { s, sc, su, shot: sc.shots[shot], shotI: shot };
  }
  function enter() {
    Object.assign(st, { t: 0, done: false, s: -1, shot: -1, fired: {}, paused: false, ui: 0, drag: null });
    if (!st.saved) st.saved = clouds;
    clouds = [];
    loadSong();
  }
  function stopSong() { if (song.src) { const src = song.src; song.src = null; try { src.stop(); } catch (e) {} } }
  function startSong() {   // play the recording from wherever the story is now
    if (!song.buf || !ac || song.src || st.paused || st.drag != null) return;
    const off = st.t - INTRO;
    if (off < 0 || off >= song.buf.duration - 0.05) return;
    const src = ac.createBufferSource(); src.buffer = song.buf; src.connect(master);
    song.t0 = ac.currentTime - off; src.start(0, off);
    song.src = src; src.onended = () => { if (song.src === src) song.src = null; };
    if (!SONG_PAGES) SONG_PAGES = Array.from({ length: NPAGES + 1 }, (_, k) => Math.min(k * PAGE, song.buf.duration * k / NPAGES));
  }
  /* ---------- player controls: pause, rewind, fast forward, drag the timeline ---------- */
  function seek(t) {
    stopSong();
    st.t = Math.max(0, Math.min(endT() - 0.05, t));
    st.fired = {}; parts = [];
    setCamNow();
  }
  function pageStarts() { const a = [0]; for (let k = 0; k <= NPAGES; k++) a.push(pageT(k)); return a; }
  function rewind() {
    const a = pageStarts(); let i = a.length - 1;
    while (i > 0 && a[i] > st.t - 1.2) i--;   // back to the start of this page, or the one before
    seek(a[i]);
  }
  function forward() { const a = pageStarts(); const n = a.find(v => v > st.t + 0.05); seek(n != null ? n : endT() - 0.05); }
  function togglePause() { st.paused = !st.paused; if (st.paused) stopSong(); }
  function ctl() {   // layout of the controls (screen pixels)
    const b = 26, gap = 10, cy = H - L.safeB - 30, cx = Math.round(W / 2);
    const x0 = L.safeL + 44, x1 = W - L.safeR - 14;
    return {
      rew: { x: cx - b - gap - b / 2, y: cy - b / 2, s: b }, play: { x: cx - b / 2, y: cy - b / 2, s: b }, ff: { x: cx + b / 2 + gap, y: cy - b / 2, s: b },
      track: { x0, x1, y: cy - b / 2 - 14 },
    };
  }
  const tAtX = (c, x) => endT() * Math.max(0, Math.min(1, (x - c.track.x0) / (c.track.x1 - c.track.x0)));
  function drawControls() {
    const c = ctl(), k = Math.min(1, st.paused ? 1 : st.ui / 0.3);
    if (k <= 0) return;
    alpha(k, () => {
      const { x0, x1, y } = c.track, w = x1 - x0;
      alpha(0.45, () => R(x0 - 6, y - 8, w + 12, 16, BLACK));
      R(x0, y - 1, w, 3, '#6a6478');
      for (let p = 0; p <= NPAGES; p++) { const tx = Math.round(x0 + w * pageT(p) / endT()); R(tx, y - 3, 1, 7, '#cfc8dc'); }
      const kx = Math.round(x0 + w * Math.min(1, st.t / endT()));
      R(x0, y - 1, kx - x0, 3, '#ffd21f');
      circle(kx, y, 5, '#ffffff'); circle(kx, y, 3, '#ffd21f');
      for (const [key, b] of [['rew', c.rew], ['play', c.play], ['ff', c.ff]]) {
        alpha(0.55, () => R(b.x, b.y, b.s, b.s, BLACK)); R(b.x + 1, b.y + 1, b.s - 2, 1, 'rgba(255,255,255,0.25)');
        const mx = b.x + b.s / 2, my = b.y + b.s / 2, cw = '#ffffff';
        const tri = (x, dir) => { for (let i = 0; i < 6; i++) R(dir > 0 ? x + i : x - i - 1, my - 6 + i, 1, 13 - 2 * i, cw); };
        if (key === 'play') { if (st.paused) tri(mx - 3, 1); else { R(mx - 5, my - 6, 4, 13, cw); R(mx + 1, my - 6, 4, 13, cw); } }
        else if (key === 'rew') { tri(mx, -1); tri(mx + 6, -1); }
        else { tri(mx - 6, 1); tri(mx, 1); }
      }
    });
  }
  function setCamNow() { const w = where(uAt(st.t)); w.shot.cam.call(w.shot, w.su); }
  function leave() {
    stopSong();
    if (st.rain) st.rain(0);
    if (st.saved) { clouds = st.saved; st.saved = null; }
  }
  function finish() {
    if (st.done) return;
    st.done = true;
    goScene(SCENES.movies ? 'movies' : 'station', { watched: 'book' });
  }
  function update(dt) {
    if (st.done) return;
    st.ui = Math.max(0, st.ui - dt);
    if (st.paused || st.drag != null) {   // hold the picture still (it keeps breathing) and stay quiet
      if (st.rain) st.rain(0);
      setCamNow();
      return;
    }
    if (song.src) st.t = INTRO + (ac.currentTime - song.t0);
    else st.t += dt;
    startSong();
    const U = uAt(st.t), w = where(U);
    if (w.s !== st.s || w.shotI !== st.shot) { st.s = w.s; st.shot = w.shotI; }
    // bubbles' noises, numbers and extra sounds
    (w.sc.words || []).forEach(([u, word], i) => { const key = w.s + 'w' + i; if (w.su >= u && w.su < u + 0.3 && !st.fired[key]) { st.fired[key] = true; sound(word); } });
    (w.sc.numbers || []).forEach(([u], i) => { const key = w.s + 'n' + i; if (w.su >= u && w.su < u + 0.3 && !st.fired[key]) { st.fired[key] = true; if (!singing()) tone('sine', 523 + i * 131, 0, 0.25, 0.08); } });
    (w.sc.noises || []).forEach(([u, n], i) => { const key = w.s + 'x' + i; if (w.su >= u && w.su < u + 0.3 && !st.fired[key]) { st.fired[key] = true; if (SOUND[n]) SOUND[n](); } });
    if (!st.rain) st.rain = noiseLoop(2600, 0.4);
    st.rain(w.sc.rain ? w.sc.rain * 0.05 : 0);
    w.shot.cam.call(w.shot, w.su);
    if (w.sc.upd) w.sc.upd(w.su);
    if (st.t >= endT() - 0.06) finish();
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

  SCENES.movieBook = {
    noWeather: true,
    view: [186, 200],
    freeTouch: true,
    cover: A.cover,
    layout() {}, enter, leave, update,
    groundY() { return Math.round(H * 0.6); },
    drawWorld() {
      const w = where(uAt(st.t));
      drawSky(w.sc.sky);
      g.setTransform(cam.z, 0, 0, cam.z, cam.ox, cam.oy);
      (w.shot.world || (su => w.sc.world(su))).call(w.sc, w.su);
      g.setTransform(1, 0, 0, 1, 0, 0);
    },
    drawLit() {
      const w = where(uAt(st.t));
      if (w.sc.rain) drawRain(w.sc.rain);
      if (w.sc.leaves) drawLeaves();
      drawParticles();
    },
    drawUI() {
      const w = where(uAt(st.t));
      (w.sc.words || []).forEach(([u, word, at, big]) => {
        const age = st.t - tAtU(SCENE_AT[w.s] + u), life = w.sc.life || 1.7;
        if (age < 0 || age > life) return;
        const [wx, wy] = at(w.su);
        bubble(word, sx(wx), sy(wy), age, big, life);
      });
      (w.sc.numbers || []).forEach(([u, n]) => bigNumber(n, st.t - tAtU(SCENE_AT[w.s] + u)));
      // iris in at the start, out at the very end; a soft blink between spreads
      let k = Math.min(1, st.t / 0.5, (endT() - st.t) / 1.2);
      iris(k, W / 2, H * 0.45);
      const bx = L.safeL + 8, bw = W - L.safeL - L.safeR - 16, by = H - L.safeB - 5;
      alpha(0.35, () => R(bx, by, bw, 2, BLACK));
      alpha(0.85, () => R(bx, by, Math.round(bw * clamp01(st.t / endT())), 2, '#fff6e0'));
      drawControls();
      drawHomeButton(homeBtn());
    },
    tap(x, y, id) {
      if (inBox(homeBtn(), x, y)) { SFX.boop(); finish(); return true; }
      const c = ctl(), shown = st.paused || st.ui > 0;
      if (shown) {
        st.ui = 3.5;
        if (inBox(c.play, x, y, 6)) { togglePause(); return true; }
        if (inBox(c.rew, x, y, 6)) { rewind(); return true; }
        if (inBox(c.ff, x, y, 6)) { forward(); return true; }
        if (x >= c.track.x0 - 10 && x <= c.track.x1 + 10 && Math.abs(y - c.track.y) <= 14) { st.drag = id; seek(tAtX(c, x)); return true; }
      }
      st.ui = 3.5;   // any other tap brings up the controls for a moment
      sparkle(x, y, 4, 3, '#ffffff');
      return true;
    },
    move(x, y, id) { if (st.drag === id) { st.ui = 3.5; seek(tAtX(ctl(), x)); } },
    release(id) { if (st.drag === id) { st.drag = null; st.ui = 3.5; } },
    // test hooks
    _st: st, _jump(U) { st.t = tAtU(U); }, _ctl: () => ctl(), _song: () => ({ loaded: !!song.buf, playing: !!song.src, at: song.src ? +(ac.currentTime - song.t0).toFixed(2) : null }),
  };
})();
