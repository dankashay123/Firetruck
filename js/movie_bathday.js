// Cinema: "The Dogs' Big Bath Day", a one-minute watch-only cartoon starring the family's
// red Vizsla and white husky (the silver tabby cat watches from the fence).
// The dogs splash in a mud puddle, see the bubble bath... UH OH! and run away through town:
// past the fire station (a firefighter gets splashed), under the police officer's STOP hand,
// through the ice cream line, into a fire hydrant's rainbow spray. Bubbles float by, the dogs
// chase them home, jump in the tub and discover bubbles are fun. Shake shake, towels, treats,
// hearts, and a wink. Tap for pause and the timeline; only the home button leaves.
'use strict';
(() => {
  const BLACK = '#1d1a2b';
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const seg = (v, a, b) => clamp01((v - a) / (b - a));
  const eout = k => 1 - (1 - k) ** 3;
  const eio = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const { hsh, oval, paint, blit } = TOY;
  const END = 62;
  const MUD = ['#7a4a24', '#6a3a1a', '#8a5a2e'];
  const SCOOP = { pink: ['#ff8fb8', '#e8608f'], van: ['#fff6e0', '#e8dcc0'], choc: ['#8a5230', '#6a3a1e'], mint: ['#9ef0c8', '#6ad4a4'], blue: ['#7ad0ff', '#4aa8e8'] };

  /* ---------- camera ---------- */
  const cam = { z: 1, ox: 0, oy: 0, cx: 0 };
  const sx = x => cam.ox + x * cam.z, sy = y => cam.oy + y * cam.z;
  // need: how much of the width must stay in view (an upright phone sees about that much), fh: the height
  function setCam(cx, cy, need, fh) {
    const tall = H > W * 1.3;
    const z = Math.max(1, Math.min(12, Math.floor(Math.min(H / fh, W / need))));
    cam.z = z; cam.cx = cx;
    cam.ox = Math.round(W / 2 - cx * z);
    cam.oy = Math.round(H * (tall ? 0.56 : 0.52) - cy * z);
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
  const SKY = { day: ['#8ec8ec', '#a2d2ee', '#b8dcee', '#cce6ea', '#dcece2'], warm: ['#f2b08a', '#f4c094', '#f6d0a0', '#f8dcae', '#fae8c0'] };
  function drawSky(key) { const c = SKY[key] || SKY.day, n = c.length, bh = Math.ceil(H / n); for (let i = 0; i < n; i++) R(0, i * bh, W, bh + 1, c[i]); }
  function cloudRow(par, y, col = '#ffffff') { const v = vis(), off = cam.cx * par; for (let i = -2; i < 9; i++) { const x = ((i * 110 + off + T * 3) % 990) - 330; if (x > v.x0 - 40 && x < v.x1 + 40) { oval(x, y + (i % 3) * 7, 15, 5, col); oval(x + 9, y - 3 + (i % 3) * 7, 9, 5, col); } } }
  function sun(x, y, r = 10) { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + T * 0.4; R(x + Math.cos(a) * (r + 4) - 1, y + Math.sin(a) * (r + 4) - 1, 2, 2, '#ffd21f'); } circle(x, y, r, '#ffd21f'); circle(x - 2, y - 2, r - 3, '#ffe873'); R(x - 4, y - 2, 1, 2, '#7a4a10'); R(x + 3, y - 2, 1, 2, '#7a4a10'); R(x - 3, y + 3, 6, 1, '#7a4a10'); }
  function road() {
    const v = vis();
    R(v.x0, -4, v.x1 - v.x0, 4, '#d8d2c4'); R(v.x0, -4, v.x1 - v.x0, 1, '#ece7da');
    R(v.x0, 0, v.x1 - v.x0, 14, '#5b5f6b'); for (let x = Math.floor(v.x0 / 14) * 14; x < v.x1; x += 14) R(x, 7, 7, 1, '#ffd21f');
    R(v.x0, 14, v.x1 - v.x0, v.y1 - 14, '#6cbf5a');
    for (let x = Math.floor(v.x0 / 9) * 9; x < v.x1; x += 9) R(x, 18 + Math.floor(hsh(x) * 20), 1, 2, hsh(x * 3) > 0.7 ? '#ffd21f' : '#5aa84c');
  }
  function house(x, base, w, h, wall, roof) {
    R(x, base - h, w, h, wall); for (let k = 0; k < 9; k++) R(x - 3 + k, base - h - 1 - k, w + 6 - 2 * k, 1, roof);
    R(x + w / 2 - 3, base - 11, 6, 11, '#8a5a32'); R(x + 4, base - h + 5, 7, 6, '#bfe6ff'); R(x + w - 11, base - h + 5, 7, 6, '#bfe6ff');
    R(x + 7, base - h + 5, 1, 6, '#ffffff'); R(x + w - 8, base - h + 5, 1, 6, '#ffffff');
  }
  function town(par = 0.5) {
    const v = vis(), off = cam.cx * par;
    for (let i = Math.floor((v.x0 - off - 60) / 52); i < (v.x1 - off + 60) / 52; i++) {
      const x = Math.round(i * 52 + off), h = hsh(i), cols = [['#ffb0c8', '#c8432f'], ['#bfe6ff', '#2a6fe0'], ['#fff2a8', '#8a4fd9'], ['#c8f0c0', '#a83a2a']][Math.floor(h * 4)];
      house(x, -4, 30, 22 + Math.floor(hsh(i * 3) * 10), cols[0], cols[1]);
      drawTree(x + 42, -4, 8 + Math.floor(hsh(i * 5) * 3));
    }
  }
  function rainbow(cx, cy, r, k = 1) {
    const cols = ['#e8222b', '#f57a12', '#ffd21f', '#3fb43a', '#2a6fe0', '#8a4fd9'];
    for (let a = 0; a <= Math.PI * k; a += 0.012) for (let i = 0; i < cols.length; i++) { const rr = r - i * 3; R(cx - Math.cos(a) * rr, cy - Math.sin(a) * rr, 3, 3, cols[i]); }
  }
  function heart(cx, cy, r, c) { circle(cx - r / 2, cy - r / 3, r / 2 + 0.5, c); circle(cx + r / 2, cy - r / 3, r / 2 + 0.5, c); for (let k = 0; k <= r; k++) R(cx - r + k, cy - r / 3 + k, 2 * (r - k) + 1, 1, c); }
  function hearts(x, y, t0, t, n = 4, spread = 18) { if (t < t0 || t > t0 + 2.4) return; for (let i = 0; i < n; i++) alpha(clamp01(t0 + 2.4 - t), () => heart(x - spread * (n - 1) / 2 + i * spread + Math.round(Math.sin(T * 3 + i) * 2), y - ((t - t0) * 12 + i * 3) % 14, 2, '#e8222b')); }
  // a soap bubble: see-through with a white glint
  function soap(x, y, r) {
    x = Math.round(x); y = Math.round(y);
    alpha(0.55, () => circle(x, y, r, '#d8f2ff'));
    alpha(0.9, () => { R(x - r, y, 1, 1, '#a8dcf8'); R(x + r, y, 1, 1, '#f2c8f8'); R(x, y + r, 1, 1, '#a8dcf8'); R(x, y - r, 1, 1, '#ffffff'); });
    R(x - Math.ceil(r / 2), y - Math.ceil(r / 2), 1, 1, '#ffffff');
  }
  function foam(cx, cy, w, h, seed = 1) {   // a heap of suds
    for (let i = 0; i < w * h / 10; i++) {
      const fx = cx + (hsh(i * 3.1 + seed) - 0.5) * w, k = 1 - Math.abs(fx - cx) / (w / 2), fy = cy - hsh(i * 7.7 + seed) * h * Math.max(0.2, k);
      const r = 2 + Math.floor(hsh(i * 1.7 + seed) * 3) + Math.round(Math.sin(T * 2 + i) * 0.5);
      circle(fx, fy, r, i % 4 ? '#ffffff' : '#e6f4fc');
    }
  }

  /* ---------- the dogs (big close-up versions from The Big Bone Adventure, little ones from the park) ---------- */
  const SPR = () => SCENES.movieDogs && SCENES.movieDogs._spr;
  const SMALL = () => SCENES.icecream && SCENES.icecream._dogs;
  // where mud can sit on the big dogs (their own frame, facing right, feet at 0) and on the little ones
  const BIG_SPOTS = [[-8, -20, 6], [1, -19, 6], [9, -18, 5], [-14, -16, 4], [4, -13, 4], [-3, -24, 4], [11, -25, 4], [-17, -22, 4], [9, -9, 3], [-9, -9, 3], [13, -30, 4], [17, -34, 3], [-12, -12, 3], [-1, -4, 3], [10, -2, 3], [-11, -3, 3]];
  const SMALL_SPOTS = [[-5, -8, 2], [-1, -7, 2], [3, -8, 2], [0, -6, 1], [-6, -5, 1], [6, -12, 1], [7, -14, 1], [-4, -2, 1], [4, -2, 1], [-2, -9, 1], [5, -4, 1]];
  // mud 0..1 (spots grow in one at a time), wet: darker fur, sq: squash (ducking)
  function dog(who, x, yb, dir, o = {}) {
    const big = !o.small, S_ = big ? SPR() : SMALL();
    if (!S_) return;
    const spots = big ? BIG_SPOTS : SMALL_SPOTS, mud = o.mud || 0, hop = o.hop || 0;
    const so = Object.assign({}, o, { hop: 0 });
    const cv = paint('bd' + (big ? 'B' : 'S') + who, big ? 76 : 32, big ? 64 : 26, big ? 38 : 16, big ? 58 : 22, () => {
      if (big) S_[who](0, 0, 1, 1, so); else S_[who](0, who === 'husky' ? -1 : 0, 1, so);
      g.globalCompositeOperation = 'source-atop';
      spots.forEach(([px, py, r], i) => {
        const a = clamp01(mud * spots.length * 1.4 - i * 1.2 * (1 - mud * 0.3));
        if (a <= 0.05) return;
        const rr = Math.max(1, Math.round(r * Math.sqrt(a) * (big ? 0.75 : 1)));
        circle(px, py, rr, MUD[i % 3]);
        if (big && rr > 2) { R(px - 1, py - 1, 1, 1, '#4e2c12'); R(px + 1, py + 1, 1, 1, '#9a6a3e'); }
      });
      if (o.wet) { g.globalAlpha = 0.22; R(-40, -60, 80, 60, '#3a7ab8'); g.globalAlpha = 1; }
      g.globalCompositeOperation = 'source-over';
    });
    const shake = o.shake ? Math.round(Math.sin(T * 60) * 2) : 0;
    blit(cv, Math.round(x) + shake, Math.round(yb - hop), dir, o.sq || 1);
    if (o.wet && !o.shake) for (let i = 0; i < 3; i++) R(Math.round(x - (big ? 12 : 6) + i * (big ? 11 : 6)), Math.round(yb - (big ? 10 : 5) + ((T * 26 + i * 7) % (big ? 10 : 5))), 1, 2, '#8ec8f0');
  }
  // the two dogs running side by side (vizsla in front), x = the vizsla
  function pair(x, yb, dir, o = {}, gap = 22) {
    dog('husky', x - dir * gap, yb - (o.small ? 0 : 1), dir, Object.assign({}, o, { pant: !o.bark, hop: (o.hop || 0) * (o.hop2 == null ? 1 : o.hop2), bark: o.bark && Math.floor(T * 6) % 2 === 0 }));
    dog('vizsla', x, yb, dir, Object.assign({}, o, { bark: o.bark && Math.floor(T * 6) % 2 === 1 }));
  }
  // a trail of muddy paw prints from x0 to x1 along y
  function prints(x0, x1, y, col = '#7a4a24', step = 7) {
    const a = Math.min(x0, x1), b = Math.max(x0, x1);
    for (let x = Math.ceil(a / step) * step; x < b; x += step) {
      const k = Math.round(x / step), py = y + (k % 2 ? 2 : 0);
      R(x, py, 2, 2, col); R(x - 1, py - 2, 1, 1, col); R(x + 1, py - 2, 1, 1, col); R(x + 2, py - 1, 1, 1, col);
    }
  }
  // the bathtub (white, on little gold feet), centered on x, standing on y = 0
  const TW = 46;
  function tubBack(x) {
    oval(x, 1, TW + 6, 3, 'rgba(0,0,0,0.15)');
    oval(x, -24, TW, 6, '#cfd8e2'); oval(x, -23, TW - 3, 4, '#7ac8f0'); oval(x - 10, -24, 14, 1, '#b8e6ff');
  }
  function tubFront(x) {
    TOY.poly([[x - TW, -24], [x + TW, -24], [x + TW - 4, -4], [x - TW + 4, -4]], '#f4f7fb');
    oval(x, -5, TW - 5, 3, '#f4f7fb');
    TOY.poly([[x + TW - 10, -24], [x + TW, -24], [x + TW - 4, -4], [x + TW - 12, -4]], '#d8e0ea');
    R(x - TW + 6, -8, (TW - 6) * 2, 2, '#d8e0ea');
    oval(x, -24, TW, 2, '#ffffff'); R(x - TW, -24, TW * 2 + 1, 1, '#ffffff'); R(x - TW, -23, TW * 2 + 1, 1, '#cfd8e2');
    for (const fx of [x - TW + 8, x + TW - 12]) { R(fx, -4, 5, 4, '#d9a320'); R(fx - 1, -1, 7, 1, '#b8860b'); }
    for (const k of [-0.55, 0, 0.55]) { circle(x + Math.round(k * TW), -14, 2, '#7ad0ff'); R(x + Math.round(k * TW) - 1, -15, 1, 1, '#ffffff'); }
  }
  function faucet(x, run) {   // the tap on the far rim, and the water pouring from it
    R(x - 1, -36, 3, 12, '#b8c2cc'); R(x - 1, -38, 10, 3, '#cfd6dd'); R(x + 7, -36, 3, 3, '#b8c2cc'); R(x - 3, -40, 7, 2, '#e8222b');
    if (run) for (let y = -33; y < -24; y += 2) R(x + 7 + Math.round(Math.sin(y + T * 20) * 0.6), y, 3, 2, y % 4 ? '#7ad0ff' : '#bfe6ff');
  }
  function duck(x, y, dir = 1, sq = 0) {
    const P = (dx, dy, w, h, c) => R(dir > 0 ? x + dx : x - dx - w, y + dy, w, h, c);
    P(-5, -4 + sq, 11, 5 - sq, '#ffd21f'); P(-6, -3 + sq, 1, 2, '#ffd21f'); P(1, -9 + sq, 6, 6, '#ffd21f'); P(7, -6 + sq, 3, 2, '#f57a12');
    P(4, -8 + sq, 1, 1, INK); P(-3, -3 + sq, 5, 1, '#f2b51c'); P(-4, 0, 9, 1, '#e0a810');
  }
  function bone(x, y, c = '#f2d8b0') {
    x = Math.round(x); y = Math.round(y);
    R(x - 4, y - 1, 9, 3, c); circle(x - 5, y - 1, 2, c); circle(x - 5, y + 2, 2, c); circle(x + 5, y - 1, 2, c); circle(x + 5, y + 2, 2, c); R(x - 3, y + 1, 7, 1, '#d4b080');
  }
  function towel(x, yb, c1, c2, w = 22, h = 18) {   // draped over a dog's back
    x = Math.round(x); yb = Math.round(yb);
    TOY.poly([[x - w, yb - 14], [x - w + 4, yb - h - 12], [x + w - 4, yb - h - 14], [x + w, yb - 12], [x + w - 2, yb - 8], [x - w + 2, yb - 8]], c1);
    for (const k of [-0.5, 0, 0.5]) R(x + Math.round(k * w * 1.4) - 1, yb - h - 10, 2, h, c2);
    R(x - w + 2, yb - 9, w * 2 - 4, 1, c2);
  }

  /* ---------- the backyard (ground at y = 0) ---------- */
  const PUD = 0, TUB = 120, LINE = [56, 210];
  function yard(o = {}) {
    hills(-30, 18, 0.03, 2, '#9ad88a', 0.3);
    // the family's house on the far left, the fence behind everything
    const v = vis();
    for (let x = Math.floor(v.x0 / 9) * 9; x < v.x1; x += 9) { R(x, -40, 8, 30, '#e6b878'); R(x, -40, 8, 1, '#f2cc94'); R(x + 3, -42, 2, 2, '#e6b878'); R(x + 8, -40, 1, 30, '#b8884a'); }
    R(v.x0, -34, v.x1 - v.x0, 2, '#b8884a'); R(v.x0, -22, v.x1 - v.x0, 2, '#b8884a');
    R(-150, -86, 90, 76, '#f2e2c4'); for (let y = -82; y < -10; y += 5) R(-150, y, 90, 1, '#e6d2ae');
    for (let k = 0; k < 18; k++) R(-156 + k * 3, -87 - k, 102 - k * 6, 1, k % 3 ? '#c8432f' : '#a83a2a');
    R(-112, -36, 16, 26, '#8a5a32'); R(-99, -24, 2, 2, '#ffd21f');
    for (const wx of [-142, -88]) { R(wx - 1, -73, 22, 18, '#ffffff'); R(wx, -72, 20, 16, '#bfe6ff'); R(wx + 9, -72, 2, 16, '#ffffff'); R(wx, -65, 20, 2, '#ffffff'); }
    // the clothesline with the towels
    R(LINE[0], -70, 2, 60, '#8a6a4a'); R(LINE[1], -70, 2, 60, '#8a6a4a');
    for (let x = LINE[0]; x < LINE[1]; x++) R(x, -68 + Math.round(Math.sin((x - LINE[0]) / (LINE[1] - LINE[0]) * Math.PI) * 4), 1, 1, '#ffffff');
    if (!o.noTowels) [['#ff6fb4', 0.25], ['#7ad0ff', 0.5], ['#ffd21f', 0.75]].forEach(([c, k], i) => {
      const x = Math.round(lerp(LINE[0], LINE[1], k)), y = -68 + Math.round(Math.sin(k * Math.PI) * 4), sw = Math.round(Math.sin(T * 1.5 + i));
      R(x - 8 + sw, y + 1, 16, 18, c); R(x - 8 + sw, y + 14, 16, 1, '#ffffff'); R(x - 8 + sw, y + 16, 16, 1, '#ffffff');
    });
    // grass
    fill(-10, '#6cbf5a');
    R(v.x0, -10, v.x1 - v.x0, 1, '#8fd877');
    for (let x = Math.floor(v.x0 / 7) * 7; x < v.x1; x += 7) { const y = -6 + Math.floor(hsh(x) * 30); R(x, y, 1, 2, hsh(x * 3) > 0.8 ? '#ffd21f' : '#5aa84c'); }
    for (let i = 0; i < 10; i++) { const x = -140 + i * 37, y = 6 + Math.floor(hsh(i * 9) * 14); R(x - 1, y, 3, 1, ['#ffd21f', '#ff6fb4', '#ffffff'][i % 3]); R(x, y - 1, 1, 3, ['#ffd21f', '#ff6fb4', '#ffffff'][i % 3]); R(x, y, 1, 1, '#f57a12'); }
    // the mud puddle
    if (!o.noPuddle) { oval(PUD, 2, 46, 6, '#6a3a1a'); oval(PUD - 2, 1, 40, 4, '#7a4a24'); oval(PUD - 10, 0, 8, 1, '#9a6a3e'); }
  }
  // the cat, watching from the top of the fence
  function fenceCat(x, o = {}) {
    if (o.walk) PETS.catWalk(x, -42, o.dir || -1, { walk: true });
    else PETS.catSit(x, -42, { swish: true, meow: o.meow, blink: o.blink || Math.floor(T * 0.8) % 5 === 0, hop: o.hop || 0 });
  }
  function splats(x, y, t0, t, n = 10, spread = 26, col = MUD) {   // mud (or water) flying up and falling back
    const k = (t - t0) / 0.9;
    if (k < 0 || k > 1) return;
    for (let i = 0; i < n; i++) {
      const vx = (hsh(i * 3.3 + t0) - 0.5) * 2 * spread, vy = 20 + hsh(i * 5.1 + t0) * 26;
      R(Math.round(x + vx * k), Math.round(y - vy * k + 60 * k * k), 2 + (i % 2), 2, col[i % col.length]);
    }
  }

  /* ---------- the town ---------- */
  function fireStation(x) {
    R(x, -70, 70, 66, '#b8473a'); for (let y = -66; y < -4; y += 4) R(x, y, 70, 1, '#a33d32');
    R(x - 4, -74, 78, 4, '#e9dcc4'); R(x + 6, -62, 58, 12, '#7a1f1f'); text('FIRE', x + 18, -59, 1, '#fff6e0');
    R(x + 8, -46, 54, 42, '#3a3442'); drawV(VI.fire, x + 2, -4, false, 0, 0, true);
  }
  function hydrant(x, burst) {
    R(x - 4, -14, 9, 12, '#e8222b'); R(x - 6, -10, 13, 3, '#e8222b'); R(x - 5, -2, 11, 2, '#a3121d'); R(x - 3, -13, 2, 10, '#ff5a5a');
    if (!burst) { R(x - 3, -17, 7, 3, '#e8222b'); R(x - 1, -19, 3, 2, '#a3121d'); }
    R(x - 7, -9, 1, 1, '#ffd21f'); R(x + 7, -9, 1, 1, '#ffd21f');
  }
  // Sprinkles, the ice cream truck from the other cartoon (74 long, facing right)
  function truck(x, yb, o = {}) {
    x = Math.round(x); yb = Math.round(yb);
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy, w, h, c);
    P(0, -10, 72, 3, '#3a3d46');
    P(2, -40, 46, 30, '#fff6ea'); P(4, -42, 42, 2, '#fff6ea'); P(2, -16, 46, 3, '#ff8fb8'); P(2, -13, 46, 1, '#7ad8c0'); P(2, -12, 46, 2, '#ff8fb8');
    P(5, -36, 12, 15, '#5a3a2a'); P(6, -35, 10, 13, '#fff2d8');
    for (let i = 0; i < 4; i++) { const c = Object.values(SCOOP)[i]; P(7 + (i % 2) * 5, -33 + Math.floor(i / 2) * 6, 3, 3, c[0]); P(8 + (i % 2) * 5, -30 + Math.floor(i / 2) * 6, 1, 2, '#d9a35a'); }
    P(20, -36, 20, 14, '#6a4a5a'); P(21, -35, 18, 12, '#8a6a7a');
    g.save(); g.beginPath(); g.rect(x + 21, yb - 35, 18, 12); g.clip();
    drawPerson({ type: 'chef', x: x + 30, yb: yb - 17, dir: 1, pose: o.wave ? 'wave' : 'stand', skin: SKIN[1], seed: 2 });
    g.restore();
    P(19, -23, 22, 2, '#cfd6dd'); P(19, -22, 22, 1, '#ffffff');
    for (let i = 0; i < 6; i++) { P(19 + i * 4, -41, 4, 5, i % 2 ? '#ffffff' : '#e8222b'); circle(x + 21 + i * 4, yb - 36, 2, i % 2 ? '#ffffff' : '#e8222b'); }
    P(48, -30, 20, 20, '#ff8fb8'); P(49, -33, 14, 3, '#ff8fb8'); P(48, -30, 20, 1, '#ffb0cc');
    P(50, -29, 13, 9, '#4a4f5c'); P(51, -28, 11, 7, GLASS);
    const ex = x + 57, ey = yb - 25, r = o.wow ? 5 : 4;
    circle(ex, ey, r, '#ffffff'); R(ex, ey - 1, 2, 3, INK); R(ex + 1, ey - 1, 1, 1, '#ffffff'); if (!o.wow) R(ex - 4, ey - 5, 9, 1, INK);
    P(66, -22, 7, 12, '#ff8fb8'); P(70, -20, 3, 3, '#fff6b0'); P(65, -10, 9, 2, '#cfd6dd');
    P(61, -15, 6, 1, '#c84a7a'); P(60, -16, 1, 1, '#c84a7a'); P(67, -16, 1, 1, '#c84a7a');
    const bob = Math.round(Math.sin(T * 3));
    for (let k = 0; k < 8; k++) P(26 + (k >> 1), -50 + k + bob, 9 - (k >> 1) * 2, 1, k % 2 ? '#b07a34' : '#d9a35a');
    circle(x + 30, yb - 53 + bob, 4, '#ff8fb8'); circle(x + 30, yb - 59 + bob, 3, '#fff6e0'); P(29, -64 + bob, 2, 2, '#e8222b');
    for (const wx of [14, 58]) { circle(x + wx, yb - 6, 6, '#2f3240'); circle(x + wx, yb - 6, 3, '#cfd6dd'); }
  }
  function cone(x, yb, flavor) {
    x = Math.round(x); yb = Math.round(yb);
    for (let r = 0; r < 7; r++) R(x - 3 + (r >> 1), yb - 7 + r, 7 - (r >> 1) * 2, 1, r % 2 ? '#b07a34' : '#d9a35a');
    const c = SCOOP[flavor]; circle(x, yb - 10, 3, c[0]); R(x - 3, yb - 9, 7, 2, c[0]); R(x - 1, yb - 12, 1, 1, '#ffffff');
  }
  function mudDots(x, yb, n, seed) { for (let i = 0; i < n; i++) R(Math.round(x - 4 + hsh(i * 3 + seed) * 8), Math.round(yb - 3 - hsh(i * 7 + seed) * 17), 2, 2, MUD[i % 3]); }
  function stopHand(x, y, dir) {   // a big white glove held up flat: STOP!
    x = Math.round(x); y = Math.round(y);
    R(x - 3, y - 4, 7, 7, INK); R(x - 2, y - 3, 5, 5, '#ffffff');
    for (let i = 0; i < 4; i++) { R(x - 3 + i * 2, y - 9 + (i === 0 || i === 3 ? 1 : 0), 2, 6, INK); R(x - 3 + i * 2, y - 8 + (i === 0 || i === 3 ? 1 : 0), 1, 5, '#ffffff'); }
    R(x + dir * 4 - (dir > 0 ? 0 : 1), y - 2, 2, 3, INK); R(x + dir * 4 - (dir > 0 ? 0 : 1), y - 1, 1, 1, '#ffffff');
  }

  /* ---------- word bubbles ---------- */
  const WORD_C = { 'SPLAT!': '#7a4a24', 'WOOF!': '#8a3a1a', 'UH OH!': '#2a6fe0', 'SPLASH!': '#2a7ab8', 'STOP!': '#e8222b', 'WHEE!': '#ff6fb4', 'WHOOSH!': '#2a7ab8', 'POP!': '#8a4fd9', 'SQUEAK!': '#d09a10', 'SHAKE SHAKE!': '#2a7ab8', 'RUB RUB!': '#e0559a', 'YUM!': '#e8222b', 'HOORAY!': '#3fb43a', 'MEOW!': '#55514a', 'WOW!': '#d07010', 'BUBBLES!': '#2a7ab8', 'HMPH!': '#55514a' };
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
    'SPLAT!': ['bathday-splat', 0.9], squish: ['bathday-squish', 0.75], 'WOOF!': ['dog-bark', 0.75], ruff: ['dog-bark-2', 0.7],
    'SPLASH!': ['bath-splash', 0.75], splash2: ['bath-splash2', 0.7], 'POP!': ['bath-pop', 0.7], 'SQUEAK!': ['bath-squeak', 0.7],
    bubble: ['bath-bubble', 0.45], water: ['bath-water', 0.6], 'RUB RUB!': ['bathday-rub', 0.8], 'YUM!': ['crunch', 0.85],
    'MEOW!': ['cat-meow', 0.6], purr: ['cat-purr', 0.6], 'WOW!': ['mv-chime', 0.5],
  }, {
    'SPLAT!'() { noise(0, 0.25, 0.18, 500, 1); }, squish() { noise(0, 0.3, 0.12, 400, 1); }, 'WOOF!'() { SFX.woof(); }, ruff() { SFX.woof(); },
    'SPLASH!'() { noise(0, 0.5, 0.15, 1400, 0.7); }, splash2() { noise(0, 0.7, 0.15, 1100, 0.7); }, 'POP!'() { SFX.pop(); },
    'SQUEAK!'() { tone('sine', 1400, 0, 0.15, 0.08, 1900); }, bubble(r) { tone('sine', 600 * (r || 1), 0, 0.08, 0.06, 1200 * (r || 1)); },
    water() { SFX.water(); }, 'RUB RUB!'() { for (let i = 0; i < 6; i++) noise(i * 0.18, 0.15, 0.06, 2500, 1); },
    'YUM!'() { for (let i = 0; i < 4; i++) noise(i * 0.09, 0.06, 0.1, 2200, 1.5); }, 'MEOW!'() { SFX.meow(); },
    purr() { for (let i = 0; i < 10; i++) noise(i * 0.12, 0.1, 0.03, 120, 2); }, 'WOW!'() { [659, 784, 988, 1319].forEach((f, i) => tone('sine', f, i * 0.07, 0.25, 0.06)); },
  });
  const SYNTH_ONLY = {
    'UH OH!'() { tone('sine', 523, 0, 0.25, 0.1); tone('sine', 392, 0.28, 0.4, 0.1); },
    'STOP!'() { tone('sine', 2200, 0, 0.18, 0.07); tone('sine', 2200, 0.24, 0.35, 0.07); },   // the officer's whistle
    'WHEE!'() { tone('triangle', 500, 0, 0.45, 0.08, 1300); },
    'WHOOSH!'() { SND.play('water', 1.1); SFX.whoosh(); },
    'SHAKE SHAKE!'() { SND.play('splash2', 1.2); setTimeout(() => SND.play('SPLASH!', 1.3), 350); },
    'BUBBLES!'() { [0, 0.12, 0.24].forEach((d, i) => tone('sine', 700 + i * 200, d, 0.08, 0.06, 1400 + i * 300)); },
    'HOORAY!'() { SFX.fanfare(); }, 'HMPH!'() { tone('sine', 330, 0, 0.2, 0.06, 300); },
  };
  function playWord(w) {
    if (SYNTH_ONLY[w]) SYNTH_ONLY[w]();
    else if (w === 'SPLAT!') { SND.play('SPLAT!'); SND.play('squish', 1.1, 0.7); }
    else SND.play(w);
  }
  const music = { buf: null, src: null, gain: null };
  let loadedMusic = false;
  function loadMusic() {
    if (loadedMusic || !ac) return; loadedMusic = true; SND.load();
    fetch('audio/bathday-music.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab && ac.decodeAudioData(ab)).then(b => { if (b) music.buf = b; }).catch(() => {});
  }
  function stopMusic() { if (music.src) { try { music.src.stop(); } catch (e) {} music.src = null; } }
  function musicTick() {   // the bouncy march, in step with the story; it ducks for the big "UH OH!"
    if (!music.buf || !ac) return;
    const from = 0.4;
    if (!music.src && st.t > from && st.t < END - 1) {
      const src = ac.createBufferSource(), gn = ac.createGain();
      src.buffer = music.buf; src.loop = true; gn.gain.value = 0;
      src.connect(gn); gn.connect(master); src.start(0, (st.t - from) % music.buf.duration);
      music.src = src; music.gain = gn;
    }
    if (music.gain) music.gain.gain.value = 0.26 * clamp01((st.t - from) / 1.2) * clamp01((END - 0.4 - st.t) / 2.5) * (st.t > 10.2 && st.t < 11.6 ? 0.35 : 1);
  }

  /* ---------- the shots ---------- */
  const run = (t, a, b, x0, x1) => lerp(x0, x1, seg(t, a, b));
  const bounce = (sp = 10, h = 4, ph = 0) => Math.abs(Math.sin(T * sp + ph)) * h;
  const SHOTS = [
    { a: 0, b: 7, sky: 'day', // 1. a big mud puddle: SPLAT! SPLAT!
      cam() { setCam(PUD + 4, -26, 104, 84); },
      world(t) {
        sun(80, -110, 10); cloudRow(0.5, -100);
        yard();
        fenceCat(36, { meow: t > 5.4 && t < 6.2, hop: t > 5.4 && t < 5.8 ? 2 : 0 });
        // the vizsla leaps in first, then the husky; then they roll and stomp about
        const jv = seg(t, 1.3, 2.1), jh = seg(t, 2.5, 3.3);
        const vx = t < 1.3 ? run(t, 0, 1.3, -120, -50) : t < 2.1 ? lerp(-50, -20, jv) : -20 + Math.sin((t - 2.1) * 3) * 5;
        const hx = t < 2.5 ? run(t, 0.3, 2.5, -160, -60) : t < 3.3 ? lerp(-60, 26, jh) : 26 - Math.sin((t - 3.3) * 3) * 5;
        const vMud = seg(t, 2.1, 4.2), hMud = seg(t, 3.3, 5.2);
        const vHop = t < 2.1 && t > 1.3 ? Math.sin(jv * Math.PI) * 16 : t > 2.1 ? bounce(9, 4) : 0;
        const hHop = t < 3.3 && t > 2.5 ? Math.sin(jh * Math.PI) * 16 : t > 3.3 ? bounce(9, 4, 1) : 0;
        dog('husky', hx, 2, t < 3.3 ? 1 : (Math.floor(t * 1.5) % 2 ? -1 : 1), { run: t < 2.5 || (t > 3.3 && t < 5), wag: true, pant: true, hop: hHop, mud: hMud });
        dog('vizsla', vx, 3, t < 2.1 ? 1 : (Math.floor(t * 1.5 + 1) % 2 ? -1 : 1), { run: t < 1.3 || (t > 2.1 && t < 5), wag: true, hop: vHop, mud: vMud, bark: t > 5 && t < 5.6 });
        splats(-20, -2, 2.1, t, 14); splats(26, -2, 3.3, t, 14); splats(10, -2, 4.4, t, 10, 30);
        if (t > 5.6) prints(-30, 36, 6);
      },
      words: [[2.1, 'SPLAT!', () => [-20, -44], true], [3.3, 'SPLAT!', () => [26, -48], true], [5.0, 'WOOF!', () => [-14, -52]], [5.5, 'HMPH!', () => [36, -62]]],
    },
    { a: 7, b: 13, sky: 'day', // 2. the bubble bath fills... UH OH! Run!
      cam(t) { setCam(lerp(TUB - 4, TUB - 60, eio(seg(t, 9.2, 10))), -30, 104, 90); },
      world(t) {
        sun(cam.cx + 80, -110, 10); cloudRow(0.5, -100);
        yard({ noPuddle: true });
        const fk = seg(t, 7, 9.6);
        tubBack(TUB); faucet(TUB + 28, t < 9.6);
        // the bubble bottle squeezes out pink soap
        if (t < 9.4) { const bx = TUB - 20, sq = Math.floor(T * 4) % 2; R(bx - 4, -46 + sq, 9, 14 - sq, '#ff6fb4'); R(bx - 2, -50 + sq, 5, 4, '#ff6fb4'); R(bx - 1, -52 + sq, 3, 2, '#ffffff'); R(bx - 3, -42, 7, 4, '#ffffff'); for (let y = -36; y < -24; y += 3) R(bx, y + ((T * 30) % 3), 2, 2, '#ffb0d8'); }
        tubFront(TUB);
        foam(TUB, -24, 84 * Math.max(0.25, fk), 22 * fk);
        duck(TUB + 6, -24 - Math.round(20 * fk) - Math.round(bounce(3, 1)), -1);
        for (let i = 0; i < 7; i++) { const p = (T * 0.4 + i / 7) % 1; soap(TUB - 40 + i * 13 + Math.sin(T * 2 + i) * 4, -40 - p * 70 * fk, 2 + (i % 3)); }
        // the dogs come trotting along, see it... UH OH! and run away
        const see = t > 9.8, flee = t > 11.3;
        const x = flee ? run(t, 11.3, 12.6, 58, -150) : run(t, 7.8, 9.8, -100, 58);
        pair(x, 0, flee ? -1 : 1, { run: !see || flee, wag: !see, mud: 1, hop: see && !flee ? bounce(14, 3) : 0, pose: see && !flee ? 'tilt' : undefined }, 27);
        if (see && !flee) { R(Math.round(x + 14), -52 - Math.round(bounce(10, 2)), 2, 6, '#e8222b'); R(Math.round(x + 14), -44 - Math.round(bounce(10, 2)), 2, 2, '#e8222b'); }
        if (flee) for (let i = 0; i < 4; i++) R(Math.round(x + 28 + i * 8), -10 - i * 5, 6, 1, '#ffffff');   // speed lines
        if (t > 10.6) prints(x + 10, 70, 4);
      },
      words: [[8, 'BUBBLES!', () => [TUB, -60]], [10, 'UH OH!', () => [cam.cx - 20, -56], true]],
    },
    { a: 13, b: 19.4, sky: 'day', // 3. past the fire station: the firefighter gets splashed
      cam(t) { setCam(Math.max(10, Math.min(104, run(t, 13, 18.8, -60, 250) - 8)), -28, 72, 90); },
      world(t) {
        sun(cam.cx + 70, -96, 9); cloudRow(0.6, -88); hills(-10, 22, 0.02, 1, '#9ad88a', 0.3);
        fireStation(-30); town(0.3);
        R(80, -4, 120, 4, '#d8d2c4');
        road();
        oval(92, 4, 12, 2, '#6a3a1a'); oval(92, 3, 9, 1, '#8a5a2e');   // a muddy puddle in the road
        const x = run(t, 13, 18.8, -60, 250), hit = t > 15.9;
        prints(-80, x - 6, 6); prints(-102, x - 28, 9);
        // the firefighter steps out to catch them... SPLASH!
        const fx = 100, fpose = t < 14.8 ? 'stand' : !hit ? 'wave' : t < 17.2 ? 'stand' : 'cheer';
        drawPerson({ type: 'ff', x: fx, yb: 0, dir: -1, pose: fpose, skin: SKIN[2], seed: 4, hop: t > 17.2 ? bounce(8, 2) : 0 });
        if (hit) mudDots(fx, 0, Math.min(9, Math.floor((t - 15.9) * 20)), 3);
        splats(92, 2, 15.9, t, 14, 18);
        pair(x, 2, 1, { small: true, run: true, mud: 1, hop: bounce(12, 2) }, 16);
      },
      words: [[14.2, 'WOOF!', () => [cam.cx - 10, -36]], [15.9, 'SPLASH!', () => [96, -34], true], [17.3, 'WOW!', () => [100, -36]]],
    },
    { a: 19.4, b: 25.4, sky: 'day', // 4. the police officer: STOP! ... they slip right under
      cam(t) { setCam(Math.max(60, Math.min(134, run(t, 19.4, 25.2, -20, 260) - 8)), -26, 72, 90); },
      world(t) {
        sun(cam.cx + 70, -96, 9); cloudRow(0.6, -88); hills(-10, 22, 0.02, 4, '#9ad88a', 0.3); town(0.4);
        road();
        drawV(VI.police, 40, 0, true, 0, 0, true);
        const cx = 130, x = run(t, 19.4, 25.2, -20, 260);
        prints(-40, x - 6, 6); prints(-60, x - 22, 9);
        const under = Math.abs(x - cx) < 18 || Math.abs(x - 16 - cx) < 18, past = x - 16 > cx + 18;
        const cdir = past && t > 22.6 ? 1 : -1;
        drawPerson({ type: 'cop', x: cx, yb: 2, dir: cdir, pose: past ? 'stand' : 'wave', skin: SKIN[1], seed: 2, hop: past && t < 23.4 ? bounce(10, 2) : 0 });
        if (!past) stopHand(cx - 5 - Math.round(bounce(6, 1)), -24, -1);
        if (past && t > 23.6) mudDots(cx, 2, 4, 9);
        pair(x, 2, 1, { small: true, run: true, mud: 1, sq: under ? 0.7 : 1, hop: under ? 0 : bounce(12, 2) }, 16);
      },
      words: [[20.8, 'STOP!', () => [126, -34], true], [22.1, 'WHOOSH!', () => [132, -24]], [23.6, 'UH OH!', () => [cam.cx + 20, -40]]],
    },
    { a: 25.4, b: 31, sky: 'day', // 5. right through the ice cream line: WHEE!
      cam(t) { setCam(Math.max(10, Math.min(84, run(t, 25.6, 30.6, -80, 260) - 8)), -28, 72, 90); },
      world(t) {
        sun(cam.cx + 70, -96, 9); cloudRow(0.6, -88); hills(-10, 22, 0.02, 6, '#9ad88a', 0.3);
        road();
        truck(-30, 0, { wave: t > 26.5, wow: t > 27.6 && t < 29 });
        const x = run(t, 25.6, 30.6, -80, 260);
        prints(-90, x - 6, 6); prints(-110, x - 22, 9);
        const KIDS = [['kid', SKIN[2], 'pink'], ['kid3', SKIN[0], 'mint'], ['kid2', SKIN[3], 'choc'], ['gran', SKIN[1], 'van']];
        KIDS.forEach(([type, skin, flav], i) => {
          const kx = 56 + i * 18, near = Math.abs(x - kx) < 16 || Math.abs(x - 16 - kx) < 16, after = x - 16 > kx + 16;
          const hop = near ? 7 : after && t < 30 ? bounce(8, 2, i) : 0;
          drawPerson({ type, x: kx, yb: 2, dir: -1, pose: near || after ? 'cheer' : 'stand', skin, seed: i, hop });
          const ch = OUTFITS[type] && OUTFITS[type].child ? 19 : 22;
          if (near || after) cone(kx + (i % 2 ? 4 : -4), 2 - hop - ch - 2, flav); else cone(kx - 5, 2 - (ch === 19 ? 8 : 10), flav);
        });
        pair(x, 2, 1, { small: true, run: true, mud: 1, hop: bounce(12, 3) }, 16);
      },
      words: [[27.2, 'WHEE!', () => [80, -40], true], [28.6, 'YUM!', () => [cam.cx + 40, -36]]],
    },
    { a: 31, b: 37.6, sky: 'day', // 6. BONK, the fire hydrant: a rainbow shower... and bubbles!
      cam() { setCam(30, -30, 104, 92); },
      world(t) {
        cloudRow(0.6, -88); hills(-10, 22, 0.02, 2, '#9ad88a', 0.3); town(0.2);
        const burst = t > 32.4, rk = eout(seg(t, 33, 34.4));
        if (rk > 0) rainbow(30, 4, 70, rk);
        road();
        const hx = 30;
        // the dogs bump the hydrant, then play in the spray
        const x = t < 32.4 ? run(t, 31, 32.4, -110, 18) : t < 36 ? 18 + Math.sin((t - 32.4) * 2) * 6 : run(t, 36.4, 37.6, 18, 200);
        const wash = seg(t, 33, 35.6), mud = 1 - wash * 0.6;
        prints(-120, Math.min(x, 10) - 6, 6);
        hydrant(hx, burst);
        if (burst) {   // the fountain
          const h = 40 * eout(seg(t, 32.4, 32.9));
          for (let y = 0; y < h; y += 2) R(hx - 2 + Math.round(Math.sin(y * 0.4 + T * 20)), -18 - y, 5, 2, y % 6 ? '#7ad0ff' : '#bfe6ff');
          for (let i = 0; i < 26; i++) { const p = (T * 1.1 + i / 26) % 1, side = i % 2 ? 1 : -1, d = 18 + (i % 5) * 7; R(Math.round(hx + side * p * d), Math.round(-18 - h + p * p * (h + 18) - Math.sin(p * Math.PI) * 8), 2, 2, i % 3 ? '#7ad0ff' : '#ffffff'); }
          if (t < 33.4) { const k = seg(t, 32.4, 33.4); R(hx - 3 + Math.round(k * 30), Math.round(-18 - Math.sin(k * Math.PI) * 50 + k * 18), 7, 3, '#e8222b'); }   // the cap flies off
        }
        const play = t > 32.6 && t < 36.4;
        pair(x, 2, play && Math.floor(t * 1.2) % 2 ? -1 : 1, { small: true, run: !play || t > 36.4, mud, wet: burst, wag: true, hop: play ? bounce(9, 4) : bounce(12, 2) }, play ? 26 : 16);
        // here come the bubbles from the backyard
        if (t > 35.2) for (let i = 0; i < 9; i++) { const p = seg(t, 35.2 + i * 0.1, 37.6); soap(lerp(220, -40, p) + i * 9, -40 + Math.sin(T * 2 + i) * 6 - i * 3, 2 + (i % 3)); }
      },
      words: [[32.4, 'WHOOSH!', () => [30, -60], true], [34.2, 'WOW!', () => [30, -76]], [35.6, 'BUBBLES!', () => [cam.cx + 40, -60]], [36.6, 'POP!', () => [60, -40]]],
    },
    { a: 37.6, b: 46.6, sky: 'day', // 7. back home: bubbles are FUN! bubble beards, the rubber duck: SQUEAK!
      cam(t) { setCam(lerp(TUB - 50, TUB, eio(seg(t, 37.6, 39))), -32, 110, 84); },
      world(t) {
        sun(cam.cx + 70, -110, 10); cloudRow(0.5, -100);
        yard({ noPuddle: true });
                tubBack(TUB);
        const jump = seg(t, 38.2, 39.4), inn = t > 39.4;
        const mud = 0.4 * (1 - seg(t, 40, 43.5));
        if (!inn) {   // the leap
          const vx = lerp(TUB - 110, TUB - 20, jump), hx = lerp(TUB - 140, TUB + 20, seg(t, 38.5, 39.4));
          dog('husky', hx, -6, 1, { run: true, pant: true, wet: true, mud: 0.4, hop: Math.sin(seg(t, 38.5, 39.4) * Math.PI) * 26 - 6 * seg(t, 38.5, 39.4) + 6 });
          dog('vizsla', vx, -6, 1, { run: true, wet: true, mud: 0.4, hop: Math.sin(jump * Math.PI) * 26 - 6 * jump + 6 });
        } else {
          const bob = k => Math.round(Math.sin(T * 3 + k) * 1);
          dog('husky', TUB + 20, -12 + bob(1), 1, { wag: true, wet: true, mud, pant: true });
          dog('vizsla', TUB - 20, -12 + bob(0), -1, { wag: true, wet: true, mud, bark: t > 41.4 && t < 41.9 });
        }
        tubFront(TUB);
        if (inn) {
          foam(TUB, -24, 90, 6, 3);
          // bubble beards
          const bk = seg(t, 40.4, 41.2);
          if (bk > 0) { foam(TUB - 20 - 21, -35 + Math.round(Math.sin(T * 3)), 9 * bk, 5 * bk, 7); foam(TUB + 20 + 23, -32 + Math.round(Math.sin(T * 3 + 1)), 9 * bk, 5 * bk, 9); }
          const dk = seg(t, 42.4, 43.2), sq = t > 43.2 && t < 43.6 ? 2 : 0;
          duck(Math.round(lerp(TUB + 30, TUB, eout(dk))), -26 - Math.round(bounce(3, 1)), -1, sq);
          for (let i = 0; i < 10; i++) { const p = (T * 0.35 + i / 10) % 1; soap(TUB - 50 + i * 11 + Math.sin(T * 2 + i) * 5, -30 - p * 70, 2 + (i % 3)); }
        }
        splats(TUB - 18, -26, 39.4, t, 16, 30, ['#7ad0ff', '#ffffff']);
        hearts(TUB, -58, 44.2, t, 3);
        PETS.catSit(TUB + 44, 8, { swish: true, meow: t > 44.4 && t < 45, blink: Math.floor(T * 0.8) % 5 === 0 });
      },
      words: [[39.4, 'SPLASH!', () => [TUB, -50], true], [41.4, 'WOOF!', () => [TUB - 30, -60]], [43.2, 'SQUEAK!', () => [TUB + 10, -48], true], [44.4, 'MEOW!', () => [TUB + 44, -12]]],
    },
    { a: 46.6, b: 51.4, sky: 'day', // 8. SHAKE SHAKE! water everywhere
      cam() { setCam(TUB - 22, -30, 110, 84); },
      world(t) {
        sun(cam.cx + 70, -110, 10); cloudRow(0.5, -100);
        yard({ noPuddle: true });
        // the cat hops down off the fence, out of the way
        tubBack(TUB); tubFront(TUB); foam(TUB, -24, 90, 8, 3);
        const out = seg(t, 46.6, 47.4), shaking = t > 47.8 && t < 50.2;
        const vx = lerp(TUB - 20, TUB - 52, out), hx = lerp(TUB + 20, TUB - 4, out), hop = Math.sin(out * Math.PI) * 22;
        dog('husky', hx, lerp(-5, 7, out), shaking ? -1 : 1, { wet: true, shake: shaking, hop, pant: true, wag: !shaking });
        dog('vizsla', vx, lerp(-5, 6, out), shaking ? 1 : -1, { wet: true, shake: shaking, hop, wag: !shaking });
        // the cat scoots off, out of the way of the splashes
        const ck = seg(t, 48.2, 49.4);
        if (ck <= 0) PETS.catSit(TUB + 44, 8, { swish: true }); else if (ck < 1) PETS.catWalk(TUB + 44 + ck * 60, 8, 1, { run: true, hop: bounce(12, 2) });
        if (shaking) for (let i = 0; i < 40; i++) { const p = (T * 1.6 + i / 40) % 1, a = hsh(i * 3.7) * Math.PI * 2, d = 10 + p * 46, ox = i % 2 ? vx : hx; R(Math.round(ox + Math.cos(a) * d), Math.round(-22 + Math.sin(a) * d * 0.7 + p * p * 20), 2, 2, i % 3 ? '#7ad0ff' : '#ffffff'); }
      },
      words: [[47.9, 'SHAKE SHAKE!', () => [TUB - 28, -56], true], [48.4, 'MEOW!', () => [TUB + 50, -20]]],
    },
    { a: 51.4, b: END, sky: 'warm', // 9. warm towels, fluffy clean dogs, treats, hearts and a wink
      cam() { setCam(TUB - 38, -32, 108, 84); },
      world(t) {
        cloudRow(0.5, -100, '#ffe6d0');
        yard({ noPuddle: true, noTowels: true });
        tubBack(TUB); tubFront(TUB);
        const vx = TUB - 68, hx = TUB - 8, clean = t > 55.4, held = t > 57.2 && t < 59.4;
        const vh = t > 59.8 ? bounce(6, 2) : 0, hh = t > 59.8 ? bounce(6, 2, 1) : 0;
        dog('vizsla', vx, 0, 1, { wag: true, wet: !clean, hop: vh });
        dog('husky', hx, -1, -1, { wag: true, wet: !clean, pant: !held, hop: hh });
        // the towels float down off the line, rub rub rub, then whisk away
        const down = eout(seg(t, 51.6, 52.6)), up = seg(t, 55, 55.8), rub = t > 52.6 && t < 55 ? (Math.floor(T * 8) % 2 ? 1 : -1) : 0;
        if (up < 1) {
          const ty = lerp(-60, 0, down) - up * 80;
          towel(vx + 2 + rub, ty, '#ff6fb4', '#ffffff');
          towel(hx - 2 - rub, ty - 1, '#7ad0ff', '#ffffff');
        }
        if (clean && t < 57) for (let i = 0; i < 8; i++) { const a = T * 3 + i * 0.8, ox = i % 2 ? vx : hx; if (Math.floor(T * 6 + i) % 2) { const px = Math.round(ox + Math.cos(a) * 22), py = Math.round(-20 + Math.sin(a) * 16); R(px, py - 2, 1, 5, '#ffffff'); R(px - 2, py, 5, 1, '#ffffff'); } }
        // treats fly in, right into their mouths
        if (t > 56.6 && t < 59.4) {
          const k = eout(seg(t, 56.6, 57.2));
          bone(vx + 25, lerp(-80, -31, k) - vh); bone(hx - 25, lerp(-80, -28, k) - hh);
        }
        // the cat sits between them, nice and clean (she never needs a bath), very proud of herself
        PETS.catSit(TUB - 38, 8, { swish: true, blink: Math.floor(T * 0.8) % 4 === 0 || (t > 58.4 && t < 59.4), hop: t > 58 && t < 58.4 ? 2 : 0 });
        if (Math.floor(T * 3) % 3 === 0) { R(TUB - 44, -14, 1, 3, '#ffffff'); R(TUB - 45, -13, 3, 1, '#ffffff'); }
        if (t > 59.4) hearts(TUB - 38, -60, 59.4, t, 5, 16);
        // a wink from the Vizsla to finish
        if (t > 60.2 && t < 61.6) { const wy = -Math.round(vh); R(vx + 18, wy - 37, 3, 2, '#b4542a'); R(vx + 18, wy - 36, 3, 1, '#6e2c12'); }
      },
      words: [[52.8, 'RUB RUB!', () => [TUB - 38, -54], true], [55.5, 'WOW!', () => [TUB - 38, -56]], [57.3, 'YUM!', () => [TUB - 38, -48], true], [58.4, 'HOORAY!', () => [TUB - 38, -60], true]],
    },
  ];

  /* ---------- scene plumbing (with pause and a draggable timeline) ---------- */
  const st = { t: 0, done: false, fired: {}, paused: false, ui: 0, drag: null, saved: null };
  const shotAt = t => { for (let i = 0; i < SHOTS.length; i++) if (t < SHOTS[i].b) return SHOTS[i]; return SHOTS[SHOTS.length - 1]; };
  function camNow() { const s = shotAt(st.t); s.cam.call(s, st.t); return s; }
  function seek(t) { stopMusic(); st.t = Math.max(0, Math.min(END - 0.05, t)); st.fired = {}; camNow(); }
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
  // water drops splashed onto the screen during the big shake
  function screenDrops() {
    const t = st.t;
    if (t < 48.2 || t > 51.4) return;
    const fade = clamp01((51.4 - t) / 0.8), s = Math.max(2, Math.round(Math.min(W, H) / 60));
    for (let i = 0; i < 12; i++) {
      const t0 = 48.2 + hsh(i * 2.1) * 1.8;
      if (t < t0) continue;
      const x = Math.round(L.safeL + hsh(i * 5.3) * (W - L.safeL - L.safeR)), y = Math.round(L.safeT + hsh(i * 7.9) * H * 0.7 + (t - t0) * 10 * s), r = s * (2 + (i % 3));
      alpha(0.5 * fade, () => circle(x, y, r, '#9ed8f8'));
      alpha(0.9 * fade, () => { R(x - Math.round(r / 2), y - Math.round(r / 2), s, s, '#ffffff'); R(x + Math.round(r / 3), y + Math.round(r / 3), s, s, '#d8f2ff'); });
    }
  }
  function homeBtn() { const s = 24; return { x: L.safeL + 8, y: H - L.safeB - s - 12, s }; }
  function finish() { if (st.done) return; st.done = true; goScene(SCENES.movies ? 'movies' : 'station', { watched: 'bathday' }); }

  SCENES.movieBath = {
    noWeather: true,
    view: [186, 200],
    freeTouch: true,
    // the cinema card: both dogs in a bubble bath with the rubber duck
    cover(x, yb) {
      const cx = x + 26;
      const tub = 30;
      oval(cx, yb - 15, tub, 4, '#cfd8e2'); oval(cx, yb - 14, tub - 2, 3, '#7ac8f0');
      dog('vizsla', cx - 7, yb - 2, -1, { wag: true });
      dog('husky', cx + 3, yb - 1, 1, { wag: true, pant: true });
      TOY.poly([[cx - tub, yb - 15], [cx + tub, yb - 15], [cx + tub - 3, yb - 2], [cx - tub + 3, yb - 2]], '#f4f7fb');
      R(cx - tub, yb - 15, tub * 2 + 1, 1, '#ffffff'); R(cx - tub + 4, yb - 5, (tub - 4) * 2, 2, '#d8e0ea');
      R(cx - tub + 5, yb - 2, 4, 2, '#d9a320'); R(cx + tub - 9, yb - 2, 4, 2, '#d9a320');
      for (let i = 0; i < 22; i++) circle(cx - tub + 3 + hsh(i * 3.1) * (tub * 2 - 6), yb - 16 - hsh(i * 7.7) * 4, 2 + (i % 2), i % 4 ? '#ffffff' : '#e6f4fc');
      duck(cx - 2, yb - 17, -1);
      soap(cx - 4, yb - 36, 3); soap(cx + 6, yb - 30, 2); soap(cx - 26, yb - 20, 2);
    },
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
      // extra little sounds: barks, squishy paws, bubbles, the cat's purr, the treats
      const EXTRA = [[1.1, 'WOOF!', 1], [4.4, 'squish', 0.9], [5.2, 'ruff', 1.1], [8.4, 'bubble', 1], [8.9, 'bubble', 1.3], [9.3, 'bubble', 0.9], [11.4, 'ruff', 1.2], [13.6, 'ruff', 1.1],
        [18, 'WOOF!', 1], [22.4, 'ruff', 1.1], [25.8, 'WOOF!', 1], [29.6, 'ruff', 1.1], [32.4, 'splash2', 1], [33.6, 'ruff', 1.1], [36.2, 'bubble', 1.1], [37, 'POP!', 1.2],
        [40.4, 'bubble', 1], [40.8, 'bubble', 1.3], [42, 'POP!', 1], [45.2, 'bubble', 1.2], [46.8, 'splash2', 1.1], [52, 'purr', 1], [53.8, 'RUB RUB!', 1.1], [56.8, 'POP!', 1.3], [58.8, 'YUM!', 1.1], [59.8, 'ruff', 1.1], [60.4, 'WOOF!', 1], [60.6, 'purr', 1]];
      EXTRA.forEach(([pt, k, rate], i) => { const key = 'x' + i; if (st.t >= pt && st.t < pt + 0.3 && !st.fired[key]) { st.fired[key] = true; SND.play(k, rate); } });
      if (st.t > 58.4 && st.t < 61 && Math.random() < dt * 3) confetti(4);
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
      screenDrops();
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
