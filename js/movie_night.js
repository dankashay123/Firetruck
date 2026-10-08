// Cinema: "Goodnight, Fire Station", a slow and quiet bedtime cartoon (about 76 s).
// The sun yawns and sets, and the sleepy moon (in her nightcap) rises. Then, one by one, everyone
// says goodnight: the fire truck, the police car and the ambulance yawn and their garage doors roll
// down; the helicopter on the roof, the ice cream truck in the park, the garbage truck and the
// digger close their eyes; the firefighters brush their teeth and climb into their bunks; the
// Vizsla and the husky turn round and round and curl up in their beds; the silver tabby kneads her
// blanket, purrs and curls up too. Stars twinkle, the windows go dark one by one, little "Z"s float
// up from the sleeping station, and the moon gives one last wink.
// Tap for pause and the timeline; only the home button leaves.
'use strict';
(() => {
  const BLACK = '#0c0a1c';
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const seg = (v, a, b) => clamp01((v - a) / (b - a));
  const eout = k => 1 - (1 - k) ** 3;
  const eio = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const bump = (v, a, b) => (v > a && v < b ? Math.sin(Math.PI * (v - a) / (b - a)) : 0);   // 0 → 1 → 0 between a and b
  const hsh = TOY.hsh;
  const END = 76;

  /* ---------- camera (as in the other cartoons) ---------- */
  const cam = { z: 1, ox: 0, oy: 0, cx: 0, cy: 0 };
  const sx = x => cam.ox + x * cam.z, sy = y => cam.oy + y * cam.z;
  const tall = () => H > W * 1.3;
  function setCam(cx, cy, fw, fh, wide) {
    const kw = W / fw, kh = H / fh, crop = wide ? 1.15 : fw >= 140 ? (tall() ? 2.2 : 1.75) : 1.3;
    const z = Math.max(1, Math.min(12, Math.floor(Math.min(kh, kw * crop))));
    cam.z = z; cam.cx = cx; cam.cy = cy;
    cam.ox = Math.round(W / 2 - cx * z);
    cam.oy = Math.round(H * (tall() ? 0.56 : 0.52) - cy * z);
  }
  function vis() { return { x0: Math.floor(-cam.ox / cam.z) - 2, x1: Math.ceil((W - cam.ox) / cam.z) + 2, y0: Math.floor(-cam.oy / cam.z) - 2, y1: Math.ceil((H - cam.oy) / cam.z) + 2 }; }
  function fill(y0, c, y1) { const v = vis(); R(v.x0, y0, v.x1 - v.x0, (y1 == null ? v.y1 : y1) - y0, c); }
  const camT = () => g.setTransform(cam.z, 0, 0, cam.z, cam.ox, cam.oy);
  const scrT = () => g.setTransform(1, 0, 0, 1, 0, 0);

  /* ---------- how dark it is: 0 at sunset, 1 at night ---------- */
  const dusk = t => eio(seg(t, 0.5, 21));
  const SUNSET = ['#e9806a', '#f2987a', '#f8b088', '#fbc896', '#fdd9a6'];
  const DUSK = ['#3e3474', '#56428a', '#764e92', '#a0628e', '#c87e86'];
  const NIGHT = ['#0b0f30', '#111843', '#18205a', '#202a66', '#283472'];
  function skyBand(i, k) { return k < 0.5 ? mix(SUNSET[i], DUSK[i], k * 2) : mix(DUSK[i], NIGHT[i], (k - 0.5) * 2); }
  function drawSkyBands(k) { const n = SUNSET.length, bh = Math.ceil(H / n); for (let i = 0; i < n; i++) R(0, i * bh, W, bh + 1, skyBand(i, k)); }
  // stars live in world coordinates, so the sky moves with the camera
  const STARS = Array.from({ length: 220 }, (_, i) => ({ x: Math.round(hsh(i + 1) * 1000 - 500), y: Math.round(-30 - hsh(i * 7 + 3) * 480), p: hsh(i * 13) * 6, big: hsh(i * 5 + 2) < 0.14 }));
  function drawStars(k, boost = 0) {
    if (k <= 0.01) return;
    const v = vis();
    for (const s of STARS) {
      if (s.x < v.x0 || s.x > v.x1 || s.y < v.y0 || s.y > v.y1) continue;
      const tw = 0.5 + 0.5 * Math.sin(T * 1.6 + s.p * 3);
      alpha(k * (0.45 + 0.55 * tw), () => {
        R(s.x, s.y, 1, 1, '#fffbe6');
        if (s.big && tw > 0.55 - boost * 0.5) { R(s.x - 1, s.y, 3, 1, '#fff6c8'); R(s.x, s.y - 1, 1, 3, '#fff6c8'); }
      });
    }
  }

  /* ---------- faces: sleepy eyes and yawning mouths ---------- */
  // shut: 0 = wide awake, 1 = fast asleep (a little curved line)
  function eyeV(cx, cy, r, shut, lid = '#7d879a') {
    if (shut >= 0.92) { R(cx - r, cy, 1, 1, INK); R(cx - r + 1, cy + 1, 2 * r - 1, 1, INK); R(cx + r, cy, 1, 1, INK); return; }
    circle(cx, cy, r, '#ffffff');
    R(cx - (r > 2 ? 1 : 0), cy - (r > 2 ? 1 : 0), r > 2 ? 2 : 1, r > 2 ? 3 : 2, INK);
    if (r > 2) R(cx, cy - 1, 1, 1, '#ffffff');
    const rows = Math.round(shut * (2 * r + 1));
    if (rows > 0) { R(cx - r, cy - r, 2 * r + 1, rows, lid); R(cx - r, cy - r + rows - 1, 2 * r + 1, 1, INK); }
  }
  function yawnMouth(cx, cy, k, smile = true) {
    if (k > 0.08) {
      TOY.oval(cx, cy + Math.round(k), 1 + k * 1.4, k * 2.6, '#5a1a2a');
      R(cx - 1, cy + Math.round(k * 3), 2, 1, '#e8708a');
    } else if (smile) { R(cx - 2, cy, 5, 1, INK); R(cx - 3, cy - 1, 1, 1, INK); R(cx + 3, cy - 1, 1, 1, INK); }
  }
  // the standard goodnight for a vehicle starting at time a: lights off, droopy eyes, a big yawn, eyes shut
  function sleepy(t, a) {
    const u = t - a;
    const yawn = bump(u, 1.4, 2.7);
    let shut = u < 0.9 ? 0 : u < 1.4 ? 0.5 * seg(u, 0.9, 1.3) : u < 2.7 ? 0.5 - 0.25 * yawn : lerp(0.5, 1, seg(u, 2.7, 3.1));
    return { u, yawn, shut, lights: 1 - seg(u, 0.5, 1.1), asleep: u > 3.1 };
  }

  /* ---------- the fire station (ground at y = 0, centered on x = 0) ---------- */
  const BAYS = [{ v: VI.police, x0: -111, vx: -103 }, { v: VI.fire, x0: -35, vx: -33 }, { v: VI.amb, x0: 41, vx: 45 }];
  const BAY_W = 70, BAY_H = 44;
  const WINS = [-92, -62, -32, 32, 62, 92];
  const FACE = {   // where each vehicle's eye (on the windscreen) and mouth (on the front) go
    [VI.fire]: { e: [56, -24, 3], m: [57, -14] }, [VI.police]: { e: [33, -19, 2], m: [48, -11] }, [VI.amb]: { e: [50, -19, 3], m: [52, -11] },
  };
  function vehicleFace(i, x, f) {
    const s = FACE[i], c = COLOR[V[i].color].c[1];
    eyeV(x + s.e[0], s.e[1], s.e[2], f.shut, c);
    yawnMouth(x + s.m[0], s.m[1], f.yawn, false);
  }
  function door(x0, k) {   // a roll-up garage door, k = 0 open .. 1 closed
    const h = Math.round(BAY_H * k);
    if (h <= 0) return;
    R(x0, -BAY_H, BAY_W, h, '#b8473a');
    for (let y = -BAY_H + 3; y < -BAY_H + h; y += 4) R(x0, y, BAY_W, 1, '#9a3a30');
    R(x0, -BAY_H + h - 2, BAY_W, 2, '#7a2a24');
    if (k > 0.7) for (let i = 0; i < 4; i++) R(x0 + 8 + i * 16, -BAY_H + 10, 10, 6, '#3a3d56');   // little windows in the door
  }
  function station(t, o) {
    const v = vis();
    // the far hills and the sky's last glow are drawn by the shot; here's the building
    R(-118, -104, 236, 104, '#c4574a');
    for (let y = -100; y < 0; y += 4) R(-118, y, 236, 1, '#b04c40');
    R(-122, -108, 244, 5, '#e9dcc4'); R(-122, -108, 244, 1, '#fff6e0');
    R(-118, -52, 236, 5, '#e9dcc4');                        // ledge between the floors
    // the badge in the middle, with a bell
    circle(0, -78, 13, '#e9dcc4'); circle(0, -78, 11, '#e8222b'); circle(0, -78, 7, '#ffd21f');
    R(-1, -84, 3, 12, '#e8222b'); R(-6, -79, 13, 3, '#e8222b');
    // upstairs windows: dark glass (the warm light is drawn on top while someone's awake)
    WINS.forEach(wx => { R(wx - 9, -91, 18, 20, '#e9dcc4'); R(wx - 7, -89, 14, 16, '#2a2f4a'); R(wx - 1, -89, 2, 16, '#e9dcc4'); R(wx - 7, -82, 14, 2, '#e9dcc4'); });
    // garage bays with the vehicles inside
    for (const b of BAYS) {
      R(b.x0, -BAY_H, BAY_W, BAY_H, '#3a3442'); R(b.x0, -BAY_H, BAY_W, 3, '#2a2432');
      R(b.x0 + 4, -BAY_H + 6, 10, 14, '#4a4456');           // a helmet rack on the back wall
      R(b.x0 + 6, -BAY_H + 8, 6, 3, '#e8222b');
      const f = o.face ? o.face(b.v) : { shut: 0, yawn: 0, lights: 1 };
      const dk = o.door ? o.door(b.v) : 1;
      if (dk < 1) {
        drawV(b.v, b.vx, 0, b.v === VI.fire && f.lit, 0, 0, true);
        vehicleFace(b.v, b.vx, f);
      }
      door(b.x0, dk);
      R(b.x0 - 3, -BAY_H - 3, BAY_W + 6, 3, '#e9dcc4');
    }
    // pillars between the bays
    for (const px of [-118, -41, 35, 111]) R(px, -BAY_H, px === -118 || px === 111 ? 7 : 6, BAY_H, '#c4574a');
    // the roof: a flat top with a little helipad
    R(-50, -109, 100, 1, '#9aa3ad');
    // the driveway and the street
    R(v.x0, 0, v.x1 - v.x0, 6, '#c9c3b6'); R(v.x0, 0, v.x1 - v.x0, 1, '#e2dccd');
    for (const b of BAYS) R(b.x0, 0, BAY_W, 6, '#a9a39a');
    R(v.x0, 6, v.x1 - v.x0, 18, '#4b4f5c'); for (let x = Math.floor(v.x0 / 14) * 14; x < v.x1; x += 14) R(x, 14, 7, 1, '#c9b860');
    R(v.x0, 24, v.x1 - v.x0, v.y1 - 24, '#4f9a48');
    for (let x = Math.floor(v.x0 / 11) * 11; x < v.x1; x += 11) { const y = 28 + Math.floor(hsh(x) * 40); R(x, y, 1, 2, hsh(x * 3) > 0.75 ? '#e8d8f0' : '#3f8a3a'); }
    // a fire hydrant
    R(126, -9, 6, 9, '#e8222b'); R(125, -10, 8, 2, '#e8222b'); R(127, -12, 4, 2, '#e8222b'); R(124, -6, 10, 2, '#c01820');
  }
  function hillsFar(base, amp, freq, seed, c) {
    const v = vis();
    for (let x = v.x0 - (v.x0 % 2); x < v.x1; x += 2) {
      const h = Math.round(amp * (0.6 + 0.4 * Math.sin(x * freq + seed) + 0.3 * Math.sin(x * freq * 2.3 + seed * 3)));
      if (h > 0) R(x, base - h, 2, h + 1, c);
    }
  }
  function housesFar() {   // a few far houses on the hill (their windows glow while people are awake)
    for (const [x, h, c] of HOUSES) { R(x, -h - 14, 22, h, c); for (let k = 0; k < 7; k++) R(x - 2 + k, -h - 15 - k, 26 - 2 * k, 1, '#6a4a5a'); R(x + 4, -h - 10, 5, 5, '#2a2f4a'); R(x + 13, -h - 10, 5, 5, '#2a2f4a'); }
  }
  const HOUSES = [[-200, 14, '#8a7aa0'], [-170, 18, '#7a8ab0'], [160, 16, '#9a8a90'], [190, 12, '#7a9aa0']];

  /* ---------- the sun and the moon ---------- */
  function sunFace(x, y, r, o) {
    alpha(0.25, () => circle(x, y, r + 5, '#ffd080'));
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + T * 0.15; R(x + Math.cos(a) * (r + 4) - 1, y + Math.sin(a) * (r + 4) - 1, 2, 2, '#ffc040'); }
    circle(x, y, r, '#ffb030'); circle(x - 2, y - 2, r - 3, '#ffcf5a');
    eyeV(x - 4, y - 2, 2, o.shut, '#ffb030'); eyeV(x + 4, y - 2, 2, o.shut, '#ffb030');
    R(x - 8, y + 2, 2, 1, '#ff8a6a'); R(x + 7, y + 2, 2, 1, '#ff8a6a');
    yawnMouth(x, y + 5, o.yawn * 1.3);
  }
  const MOON = { x: -64, y: -158, r: 12 };
  function moonFace(x, y, r, o = {}) {
    alpha(0.12, () => circle(x, y, r + 9, '#fff6c8'));
    alpha(0.2, () => circle(x, y, r + 4, '#fff6c8'));
    circle(x, y, r, '#f4ecc4'); circle(x + 2, y - 2, r - 3, '#fffbe6');
    circle(x - 6, y + 6, 2, '#e2d8a8'); circle(x + 7, y + 7, 1, '#e2d8a8'); circle(x + 8, y - 4, 1, '#ece2b8');
    // a sleepy face
    const L_ = o.left == null ? 1 : o.left, R_ = o.right == null ? 1 : o.right;
    eyeV(x - 4, y, 2, L_, '#f4ecc4'); eyeV(x + 4, y, 2, R_, '#f4ecc4');
    R(x - 8, y + 3, 2, 1, '#f2a8a0'); R(x + 7, y + 3, 2, 1, '#f2a8a0');
    if (o.yawn > 0.08) yawnMouth(x, y + 5, o.yawn); else { R(x - 2, y + 5, 5, 1, '#a07a5a'); R(x - 3, y + 4, 1, 1, '#a07a5a'); R(x + 3, y + 4, 1, 1, '#a07a5a'); }
    // her blue nightcap, flopping over to one side, with a pom-pom
    TOY.poly([[x - r + 1, y - 5], [x + r - 1, y - 9], [x + r + 3, y - r - 7], [x + 2, y - r - 2]], '#4a5ad0');
    TOY.poly([[x + 2, y - r - 2], [x + r + 3, y - r - 7], [x + r - 1, y - 9], [x + r - 3, y - 9]], '#3a48b0');
    TOY.poly([[x - r + 1, y - 7], [x + r - 1, y - 11], [x + r - 1, y - 8], [x - r + 1, y - 4]], '#ffffff');
    circle(x + r + 3, y - r - 7, Math.max(1, Math.round(r / 6)), '#ffffff');
    for (const [dx, dy] of [[-2, -10], [4, -13], [8, -8]]) R(x + dx, y + dy, 1, 1, '#ffe873');
  }

  /* ---------- the helicopter, the ice cream truck, the garbage truck and the digger ---------- */
  function heli(x, yb, o) {   // 36 long, skids on yb, facing right
    const y = yb - 18, c = COLOR.red.c, DK = '#3a3d46';
    const spin = o.rotor > 0.05 ? Math.floor(T * 18 * o.rotor) % 2 : 0;
    R(x + (spin ? 6 : 2), y, spin ? 34 : 40, 1, DK); R(x + 22, y + 1, 2, 3, DK);
    R(x, y + 3, 3, 6, c[1]); R(x, y + 7, 15, 3, c[1]);
    R(x + 14, y + 4, 18, 10, c[1]); R(x + 12, y + 6, 22, 7, c[1]); R(x + 32, y + 7, 4, 5, c[1]);
    R(x + 14, y + 4, 18, 1, c[0]); R(x + 12, y + 12, 24, 1, c[2]);
    R(x + 26, y + 5, 8, 5, GLASS);
    R(x + 12, y + 10, 24, 1, '#f4f7fb');
    R(x + 16, y + 13, 1, 4, DK); R(x + 29, y + 13, 1, 4, DK); R(x + 12, y + 17, 24, 1, DK);
    eyeV(x + 30, y + 7, 2, o.shut, c[1]);
    yawnMouth(x + 34, y + 11, o.yawn * 0.8, false);
  }
  const SCOOP = [['#ff8fb8', '#e8608f'], ['#fff6e0', '#e8dcc0'], ['#8a5230', '#6a3a1e'], ['#9ef0c8', '#6ad4a4']];
  function iceTruck(x, yb, o) {   // Sprinkles, 74 long, facing right
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy, w, h, c);
    P(0, -10, 72, 3, '#3a3d46');
    P(2, -40, 46, 30, '#fff6ea'); P(4, -42, 42, 2, '#fff6ea'); P(2, -16, 46, 3, '#ff8fb8'); P(2, -13, 46, 1, '#7ad8c0'); P(2, -12, 46, 2, '#ff8fb8');
    for (let i = 0; i < 9; i++) P(4 + i * 5, -19 - (i % 2) * 2, 2, 1, ['#e8222b', '#2a6fe0', '#3fb43a', '#ffd21f', '#ff6fb4'][i % 5]);
    P(5, -36, 12, 15, '#5a3a2a'); P(6, -35, 10, 13, '#fff2d8');
    for (let i = 0; i < 4; i++) { const c = SCOOP[i]; P(7 + (i % 2) * 5, -33 + Math.floor(i / 2) * 6, 3, 3, c[0]); P(8 + (i % 2) * 5, -30 + Math.floor(i / 2) * 6, 1, 2, '#d9a35a'); }
    // the serving window, its shutter rolling down for the night
    P(20, -36, 20, 14, '#6a4a5a'); P(21, -35, 18, 12, '#8a6a7a');
    const sh = Math.round(12 * o.shutter);
    if (sh > 0) { P(21, -35, 18, sh, '#d8d0dc'); for (let yy = 2; yy < sh; yy += 3) P(21, -35 + yy, 18, 1, '#b8b0c4'); }
    P(19, -23, 22, 2, '#cfd6dd');
    for (let i = 0; i < 6; i++) { P(19 + i * 4, -41, 4, 5, i % 2 ? '#ffffff' : '#e8222b'); circle(x + 21 + i * 4, yb - 36, 2, i % 2 ? '#ffffff' : '#e8222b'); }
    // the cab with the big friendly eye on the windscreen
    P(48, -30, 20, 20, '#ff8fb8'); P(49, -33, 14, 3, '#ff8fb8'); P(48, -30, 20, 1, '#ffb0cc');
    P(50, -29, 13, 9, '#4a4f5c'); P(51, -28, 11, 7, GLASS);
    eyeV(x + 57, yb - 25, 4, o.shut, '#ff8fb8');
    P(66, -22, 7, 12, '#ff8fb8'); P(70, -20, 3, 3, '#fff6b0'); P(65, -10, 9, 2, '#cfd6dd');
    yawnMouth(x + 63, yb - 15, o.yawn);
    // the big cone on the roof (its little light goes out)
    for (let k = 0; k < 8; k++) P(26 + (k >> 1), -50 + k, 9 - (k >> 1) * 2, 1, k % 2 ? '#b07a34' : '#d9a35a');
    circle(x + 30, yb - 53, 4, '#ff8fb8'); circle(x + 30, yb - 59, 3, '#fff6e0'); P(29, -64, 2, 2, '#e8222b');
    for (const wx of [14, 58]) { circle(x + wx, yb - 6, 6, '#2f3240'); circle(x + wx, yb - 6, 3, '#cfd6dd'); }
  }
  const G1 = '#3fb43a', G2 = '#5ad04a', G3 = '#2f8a2c';
  function garbageTruck(x, o) {   // origin at the middle of its wheels, facing right, about 94 long
    const P = (dx, dy, w, h, c) => R(x + dx, dy, w, h, c);
    P(-46, -44, 64, 32, G1); P(-46, -44, 64, 2, G2); P(-46, -14, 64, 2, G3);
    for (const rx of [-34, -22, -10]) { P(rx, -42, 2, 28, G3); P(rx + 2, -42, 1, 28, G2); }
    P(-48, -44, 4, 32, G3); for (let k = 0; k < 4; k++) P(-48, -20 + k * 2, 4, 1, k % 2 ? '#e8222b' : '#ffffff');
    P(2, -48, 16, 6, '#1f5a1e'); P(1, -49, 18, 2, G3);
    P(19, -40, 26, 28, '#f4f7fb'); P(19, -40, 26, 2, '#ffffff'); P(19, -14, 26, 2, '#cfd6dd');
    P(29, -37, 14, 11, '#4a4f5c'); P(30, -36, 12, 9, GLASS);
    eyeV(x + 36, -31, 3, o.shut, '#f4f7fb');
    P(19, -24, 26, 2, G1);
    P(44, -22, 3, 8, '#5a5650'); P(43, -13, 6, 3, '#9aa3ad');
    yawnMouth(x + 38, -18, o.yawn);
    P(28, -43, 6, 3, o.beacon ? '#ffb27a' : '#c8702a');
    P(-46, -12, 92, 3, '#3a3d46');
    for (const wx of [-30, -16, 32]) { circle(x + wx, -7, 7, '#1d1a2b'); circle(x + wx, -7, 4, '#9aa3ad'); circle(x + wx, -7, 2, '#5a5e6a'); }
  }
  const Y1 = '#f2b51c', Y2 = '#ffd34d', Y3 = '#c98a10', Y4 = '#8a5a08';
  function digger(x, o) {   // origin at the middle of its tracks, facing right; o.rest: 0 arm up .. 1 bucket resting on the ground
    const P = (dx, dy, w, h, c) => R(x + dx, dy, w, h, c);
    // tracks
    circle(x - 21, -6, 6, '#2a2c33'); circle(x + 21, -6, 6, '#2a2c33'); P(-21, -12, 42, 12, '#2a2c33');
    P(-20, -10, 40, 8, '#4a4e5a'); for (let k = 0; k < 5; k++) circle(x - 14 + k * 7, -5, 2, '#8a939d');
    P(-14, -15, 28, 3, '#5a5e6a');
    // body and cab
    P(-24, -29, 40, 15, Y1); P(-24, -29, 40, 2, Y2); P(-24, -16, 40, 2, Y3);
    P(-14, -35, 2, 6, '#5a5650');
    P(0, -44, 15, 30, Y1); P(-1, -45, 17, 2, Y3);
    P(2, -41, 11, 11, '#4a4f5c'); P(3, -40, 9, 9, GLASS);
    eyeV(x + 8, -36, 3, o.shut, Y1);
    yawnMouth(x + 8, -24, o.yawn);
    P(5, -48, 4, 3, o.beacon ? '#ffb27a' : '#c8702a');
    // the arm: boom up and out, the stick down to the bucket
    const k = eio(o.rest), sh = [14, -30], el = [lerp(36, 34, k), lerp(-52, -30, k)], bk = [lerp(46, 50, k), lerp(-24, -5, k)];
    TOY.bar(sh[0] + x, sh[1], el[0] + x, el[1], 7, Y4, true); TOY.bar(sh[0] + x, sh[1], el[0] + x, el[1], 5, Y1, true);
    TOY.bar(el[0] + x, el[1], bk[0] + x, bk[1], 5, Y4, true); TOY.bar(el[0] + x, el[1], bk[0] + x, bk[1], 3, Y1, true);
    const bx = bk[0] + x, by = bk[1];
    TOY.poly([[bx - 2, by - 3], [bx + 7, by - 4], [bx + 9, by + 3], [bx + 3, by + 5], [bx - 3, by + 2]], '#5a5e6a');
    for (let i = 0; i < 3; i++) R(bx + 3 + i * 2, by + 5, 1, 1, '#cfd6dd');
    circle(el[0] + x, el[1], 2, '#8a939d');
  }

  /* ---------- the bedroom upstairs (floor at y = 0) ---------- */
  OUTFITS.pjBlue = { shirt: '#8fb4f0', shade: '#6f94d8', pants: '#8fb4f0', shoes: '#f4f7fb' };
  OUTFITS.pjGreen = { shirt: '#9ad89a', shade: '#78ba78', pants: '#9ad89a', shoes: '#f4f7fb' };
  const SINKS = [-80, -50], BUNK = 0;
  function room(t, lamp) {
    const v = vis();
    fill(v.y0, '#7a86c8', 0);                                        // the wall
    for (let x = Math.floor(v.x0 / 12) * 12; x < v.x1; x += 12) R(x, v.y0, 1, -v.y0, '#7380c0');
    R(-104, -66, 74, 66, '#cfe0f0');                                 // bathroom tiles
    for (let y = -62; y < 0; y += 6) R(-104, y, 74, 1, '#b8cce0');
    for (let x = -100; x < -30; x += 6) R(x, -66, 1, 66, '#b8cce0');
    R(-30, -70, 5, 70, '#c9a070'); R(-106, -70, 4, 70, '#c9a070');   // door frames
    fill(0, '#a8784a'); for (let x = Math.floor(v.x0 / 16) * 16; x < v.x1; x += 16) R(x, 0, 1, 10, '#946640');
    R(v.x0, 0, v.x1 - v.x0, 1, '#c89a68');
    // sinks with mirrors, and a cup of toothbrushes
    for (const s of SINKS) {
      R(s - 7, -38, 14, 12, '#e9dcc4'); R(s - 6, -37, 12, 10, '#bfe6ff'); R(s - 4, -36, 2, 6, '#ffffff');
      R(s - 2, -14, 4, 14, '#f4f7fb'); R(s - 8, -18, 16, 4, '#f4f7fb'); R(s - 8, -18, 16, 1, '#ffffff'); R(s - 1, -21, 2, 3, '#cfd6dd');
    }
    R(-66, -22, 4, 4, '#ff8fb8');
    // the window, with the night outside
    R(56, -58, 26, 24, '#e9dcc4'); R(58, -56, 22, 20, '#1a2050');
    R(68, -56, 2, 20, '#e9dcc4'); R(58, -47, 22, 2, '#e9dcc4');
    for (const [a, b] of [[61, -53], [75, -52], [64, -40], [77, -39], [72, -43]]) R(a, b, 1, 1, '#fffbe6');
    // bunk bed and ladder
    const bx = BUNK;
    R(bx, -36, 2, 36, '#8a5a3a'); R(bx + 36, -36, 2, 36, '#8a5a3a');
    R(bx + 2, -11, 34, 4, '#f4f7fb'); R(bx + 2, -7, 34, 2, '#8a5a3a');
    R(bx + 2, -29, 34, 4, '#f4f7fb'); R(bx + 2, -25, 34, 2, '#8a5a3a');
    R(bx + 3, -14, 8, 3, '#ffffff'); R(bx + 3, -32, 8, 3, '#ffffff');
    for (let k = 0; k < 5; k++) R(bx + 38, -6 - k * 6, 6, 1, '#a8703f'); R(bx + 38, -32, 1, 32, '#8a5a3a'); R(bx + 43, -32, 1, 32, '#8a5a3a');
    // the little lamp on the nightstand
    R(48, -12, 10, 12, '#a8703f'); R(49, -11, 8, 1, '#c89060');
    R(52, -18, 2, 6, '#cfd6dd'); TOY.poly([[49, -18], [57, -18], [55, -24], [51, -24]], lamp ? '#ffe8a0' : '#c8b890');
    // the pets' corner: two dog beds and a soft blanket for the cat
    TOY.oval(84, -3, 13, 4, '#6a4a9a'); TOY.oval(84, -3, 10, 2, '#a08ad0');
    TOY.oval(112, -3, 13, 4, '#3a7a8a'); TOY.oval(112, -3, 10, 2, '#7ac0c8');
    R(126, -4, 22, 4, '#f2a8c0'); R(126, -4, 22, 1, '#ffc8dc'); for (let k = 0; k < 5; k++) R(128 + k * 4, -2, 2, 1, '#e08aa8');
    R(124, -2, 26, 2, '#e8c0a0');
    // a framed picture of a fire truck
    R(96, -50, 26, 18, '#8a5a3a'); R(98, -48, 22, 14, '#bfe6ff'); R(101, -41, 15, 5, '#e8222b'); R(112, -44, 4, 3, '#e8222b'); R(102, -36, 3, 2, INK); R(111, -36, 3, 2, INK);
  }
  // a firefighter lying in a bunk, blanket pulled up to the chin (k = how far it's pulled)
  function inBunk(yb, skin, hair, blanket, k, seed) {
    const bx = BUNK, br = Math.floor(T * 1.1 + seed) % 2;
    circle(bx + 9, yb - 4, 4, skin); R(bx + 5, yb - 8, 8, 3, hair); R(bx + 5, yb - 6, 2, 3, hair);
    eyeV(bx + 11, yb - 4, 1, 1);
    const w = Math.round(22 * k);
    if (w > 0) { R(bx + 35 - w, yb - 5 + br, w, 5 - br, blanket); R(bx + 35 - w, yb - 5 + br, w, 1, '#ffffff'); }
  }

  /* ---------- word bubbles (soft, bedtime colors) ---------- */
  const WORD_C = { 'YAWN!': '#7a5ac8', 'PURR': '#8a6a4a', 'GOODNIGHT!': '#4a5ad0', 'SHH!': '#4a8ab0', 'ZZZ': '#5a6ab0' };
  function bubble(word, ax, ay, age) {
    if (age < 0 || age > 2.2) return;
    const s = Math.max(1, Math.min(3, Math.round(Math.min(W, H) / 95)));
    const tw = textWidth(word, s), bw = tw + 6 * s, bh = 11 * s;
    const pop = age < 0.35 ? eout(age / 0.35) : 1, fade = age > 1.8 ? 1 - (age - 1.8) / 0.4 : 1;
    let bx = Math.round(ax - bw / 2), by = Math.round(ay - bh - 6 * s - (1 - pop) * 4);
    bx = Math.max(L.safeL + 4, Math.min(W - L.safeR - bw - 4, bx)); by = Math.max(L.safeT + 4, Math.min(H - L.safeB - bh - 40, by));
    alpha(Math.max(0, fade) * pop, () => {
      R(bx - 1, by + 1, bw + 2, bh - 2, '#3a3a6a'); R(bx + 1, by - 1, bw - 2, bh + 2, '#3a3a6a');
      R(bx, by + 1, bw, bh - 2, '#fffbf0'); R(bx + 1, by, bw - 2, bh, '#fffbf0');
      const tx = Math.max(bx + 4, Math.min(bx + bw - 8, Math.round(ax))), ty = by + bh;
      for (let k = 0; k < 4; k++) { R(tx - (3 - k) - 1, ty + k - 1, Math.max(1, 2 * (3 - k)) + 2, 1, '#3a3a6a'); if (k < 3) R(tx - (3 - k), ty + k - 1, 2 * (3 - k), 1, '#fffbf0'); }
      text(word, bx + 3 * s, by + 3 * s, s, WORD_C[word] || INK);
    });
  }
  // little Zs floating up from a sleeper at world (x, y), drawn in world coordinates
  function zs(x, y, k = 1, seed = 0) {
    if (k <= 0) return;
    for (let i = 0; i < 3; i++) {
      const p = (T * 0.32 + i / 3 + seed * 0.37) % 1;
      alpha(k * Math.min(1, p * 4, (1 - p) * 2.5), () => text('Z', Math.round(x + p * 7 + Math.sin(p * 6 + seed) * 2), Math.round(y - p * 16), 1, '#eaf0ff'));
    }
  }

  /* ---------- sounds ---------- */
  const SND = TOY.bank({
    purr: ['cat-purr', 0.5], chime: ['mv-chime', 0.22], harp: ['night-harp', 0.28], crickets: ['night-crickets', 0.14],
  }, {
    purr() { for (let i = 0; i < 12; i++) noise(i * 0.12, 0.1, 0.02, 120, 2); },
    chime(r = 1) { tone('sine', 1319 * r, 0, 0.9, 0.04); tone('sine', 1976 * r, 0.05, 0.6, 0.015); },
    harp() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone('sine', f, i * 0.09, 0.8, 0.03)); },
  });
  const crickets = SND.loop('crickets');
  const SYNTH = {
    'YAWN!'(p = 1) { tone('sine', 392 * p, 0, 0.55, 0.045, 494 * p); tone('sine', 494 * p, 0.5, 1.1, 0.045, 247 * p); tone('triangle', 196 * p, 0.5, 1.1, 0.02, 123 * p); noise(0.15, 1.3, 0.01, 700, 0.7); },
    'GOODNIGHT!'() { [784, 659, 523, 392].forEach((f, i) => tone('sine', f, i * 0.28, 1.1, 0.04)); },
    'SHH!'() { noise(0, 0.9, 0.025, 3500, 0.8); },
    PURR() { SND.play('purr'); },
    ZZZ() { tone('sine', 262, 0, 0.8, 0.025, 220); },
  };
  function playWord(w, p) { if (SYNTH[w]) SYNTH[w](p); }
  const softRattle = () => { for (let i = 0; i < 9; i++) noise(i * 0.13, 0.07, 0.02, 380 + i * 20, 2); };
  const music = { buf: null, src: null, gain: null };
  let loadedMusic = false;
  function loadMusic() {
    if (loadedMusic || !ac) return; loadedMusic = true; SND.load();
    fetch('audio/night-music.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab && ac.decodeAudioData(ab)).then(b => { if (b) music.buf = b; }).catch(() => {});
  }
  function stopMusic() { if (music.src) { try { music.src.stop(); } catch (e) {} music.src = null; } }
  const MUSIC_FROM = 0.4;
  function musicTick() {   // the music-box lullaby, in step with the story
    if (!music.buf || !ac) return;
    if (!music.src && st.t > MUSIC_FROM && st.t < END - 0.5) {
      const src = ac.createBufferSource(), gn = ac.createGain();
      src.buffer = music.buf; src.loop = true; gn.gain.value = 0;
      src.connect(gn); gn.connect(master); src.start(0, (st.t - MUSIC_FROM) % music.buf.duration);
      music.src = src; music.gain = gn;
    }
    if (music.gain) music.gain.gain.value = 0.18 * clamp01((st.t - MUSIC_FROM) / 2) * clamp01((END - 0.3 - st.t) / 3);
  }

  /* ---------- the story ---------- */
  const VA = { [VI.fire]: 9.6, [VI.police]: 14.4, [VI.amb]: 19.2 };            // when each vehicle says goodnight
  const vFace = (i, t) => { const f = sleepy(t, VA[i]); f.lit = i === VI.fire && f.u < 0.8; return f; };
  const vDoor = (i, t) => eio(seg(t - VA[i], 3.3, 4.5));
  const winLit = (i, t) => t > 3.5 + i * 0.4 && t < 60 + i;                   // the upstairs windows go dark one by one
  const exteriorTint = t => { const k = dusk(t); return [0.1 + 0.42 * k, mix('#e07048', '#141c48', Math.min(1, k * 1.6))]; };
  function warmWindows(t, k = 1) {
    WINS.forEach((wx, i) => { if (!winLit(i, t)) return; alpha(k * 0.85, () => { R(wx - 7, -89, 6, 16, '#ffd98a'); R(wx + 1, -89, 6, 16, '#ffd98a'); R(wx - 7, -82, 14, 2, '#e9dcc4'); }); alpha(0.18 * k, () => circle(wx, -81, 12, '#ffd98a')); });
    for (const [x, h] of HOUSES) if (t < 59.5) alpha(0.8, () => { R(x + 4, -h - 10, 5, 5, '#ffd98a'); R(x + 13, -h - 10, 5, 5, '#ffd98a'); });
  }
  function headGlow(i, x, k) {   // a vehicle's headlight, glowing softly at dusk
    if (k <= 0.02) return;
    const s = FACE[i], hx = x + (i === VI.fire ? 64 : i === VI.amb ? 60 : 55), hy = i === VI.fire ? -17 : i === VI.amb ? -16 : -12;
    alpha(0.5 * k, () => circle(hx, hy, 3, '#fff3b0')); alpha(0.9 * k, () => R(hx, hy - 1, 1, 2, '#fffbe6'));
  }
  const DOGX = { vizsla: 84, husky: 112 };
  const SHOTS = [
    { a: 0, b: 9, out: true, // 1. sunset: the sun yawns and goes down; the moon rises
      cam() { setCam(0, tall() ? -112 : -66, 270, 190, true); },
      sky(t) {
        const sk = sleepy(t, 0.8);
        sunFace(92, lerp(-118, 26, eio(seg(t, 1.2, 8))), 13, { shut: sk.shut, yawn: sk.yawn });
        moonFace(lerp(-120, MOON.x, eout(seg(t, 4, 9))), lerp(-10, MOON.y, eout(seg(t, 4, 9))), MOON.r);
      },
      world(t) {
        hillsFar(-6, 26, 0.018, 2, '#7a5a7a'); housesFar(); hillsFar(-4, 14, 0.03, 5, '#5a7a5a');
        station(t, { face: () => ({ shut: 0, yawn: 0, lit: false }), door: () => 0 });
      },
      lit(t) { warmWindows(t); for (const b of BAYS) headGlow(b.v, b.vx, seg(t, 5, 8)); },
      tint: exteriorTint,
      words: [[2.2, 'YAWN!', () => [92, lerp(-118, 26, eio(seg(2.2, 1.2, 8))) - 14]]],
    },
    { a: 9, b: 24, out: true, // 2. goodnight, fire truck; goodnight, police car; goodnight, ambulance
      cam(t) {
        const cx = t < 13.6 ? 0 : t < 18.4 ? lerp(0, -76, eio(seg(t, 13.6, 14.6))) : lerp(-76, 76, eio(seg(t, 18.4, 19.8)));
        setCam(cx, -26, 92, 66);
      },
      sky() { moonFace(MOON.x, MOON.y, MOON.r); },
      world(t) {
        hillsFar(-6, 26, 0.018, 2, '#7a5a7a'); housesFar();
        station(t, { face: i => vFace(i, t), door: i => vDoor(i, t) });
      },
      lit(t) {
        warmWindows(t);
        for (const b of BAYS) {
          const f = vFace(b.v, t), d = vDoor(b.v, t);
          if (d < 0.6) headGlow(b.v, b.vx, f.lights);
          if (f.lit) alpha(0.3, () => circle(b.vx + 53, -33, 8, Math.floor(T * 7) % 2 ? '#ff3b3b' : '#ff7070'));
          if (f.asleep) zs(b.x0 + BAY_W / 2, -BAY_H - 6, seg(t - VA[b.v], 4.3, 5), b.v);
        }
      },
      tint: exteriorTint,
      words: [[VA[VI.fire] + 1.4, 'YAWN!', () => [24, -36]], [VA[VI.police] + 1.4, 'YAWN!', () => [-70, -30]], [VA[VI.amb] + 1.4, 'YAWN!', () => [96, -32]]],
    },
    { a: 24, b: 29.5, out: true, // 3. the helicopter on the roof
      cam() { setCam(0, -116, 80, 58); },
      sky(t) { moonFace(MOON.x, MOON.y, MOON.r); },
      world(t) {
        hillsFar(-6, 26, 0.018, 2, '#5a4a6a');
        station(t, { door: () => 1 });
        R(-18, -109, 36, 1, '#e9dcc4'); R(-2, -109, 4, 1, '#ffd21f');
        const f = sleepy(t, 25.2);
        heli(-18, -109, { rotor: 1 - seg(t, 24, 26.4), shut: f.shut, yawn: f.yawn });
      },
      lit(t) {
        warmWindows(t);
        const f = sleepy(t, 25.2);
        if (!f.asleep && Math.floor(T * 1.5) % 2) alpha(0.8, () => { R(-17, -105, 2, 1, RED_ON); circle(-16, -105, 2, 'rgba(255,59,59,0.35)'); });
        zs(14, -128, seg(t, 28.4, 29), 3);
      },
      tint: exteriorTint,
      words: [[26.6, 'YAWN!', () => [14, -126]]],
    },
    { a: 29.5, b: 35, out: true, // 4. the ice cream truck in the park
      cam() { setCam(258, -30, 112, 72); },
      sky() { moonFace(MOON.x + 250, MOON.y + 40, MOON.r); },
      world(t) {
        hillsFar(-6, 26, 0.018, 2, '#5a4a6a'); hillsFar(-4, 14, 0.03, 5, '#4a6a4a');
        const v = vis();
        R(v.x0, 0, v.x1 - v.x0, v.y1, '#4f9a48');
        for (let x = Math.floor(v.x0 / 11) * 11; x < v.x1; x += 11) { const y = 3 + Math.floor(hsh(x) * 40); R(x, y, 1, 2, hsh(x * 3) > 0.75 ? '#e8d8f0' : '#3f8a3a'); }
        drawTree(198, 0, 16); drawTree(322, 0, 13);
        R(300, -40, 2, 40, '#3a3d46'); R(296, -42, 10, 3, '#3a3d46');                 // lamp post
        R(326, -10, 26, 2, '#a8743f'); R(326, -14, 26, 2, '#a8743f'); R(328, -8, 2, 8, '#5a5e6a'); R(348, -8, 2, 8, '#5a5e6a');
        const f = sleepy(t, 31);
        iceTruck(220, 0, { shut: f.shut, yawn: f.yawn, shutter: eio(seg(t, 30.2, 31.2)) });
      },
      lit(t) {
        alpha(0.9, () => R(298, -39, 6, 2, '#ffe8a0')); alpha(0.16, () => circle(301, -30, 14, '#ffe8a0'));
        const cone = 1 - seg(t, 30, 30.8);
        if (cone > 0) alpha(0.35 * cone, () => circle(250, -57, 9, '#ffb0cc'));
        zs(278, -40, seg(t, 34.1, 34.6), 4);
      },
      tint: exteriorTint,
      words: [[32.4, 'YAWN!', () => [284, -30]]],
    },
    { a: 35, b: 42, out: true, // 5. the garbage truck and the digger
      cam(t) { setCam(tall() ? lerp(-300, -214, eio(seg(t, 37.8, 39))) : -258, -30, 190, 82); },
      sky() { moonFace(MOON.x - 210, MOON.y + 50, MOON.r); },
      world(t) {
        hillsFar(-6, 26, 0.018, 2, '#5a4a6a');
        const v = vis();
        R(v.x0, 0, v.x1 - v.x0, v.y1, '#8a6a4a');
        for (let x = Math.floor(v.x0 / 9) * 9; x < v.x1; x += 9) R(x, 3 + Math.floor(hsh(x) * 30), 2, 1, '#6a4a2e');
        for (let x = -380; x < -150; x += 8) { R(x, -18, 2, 18, '#9aa3ad'); } R(-380, -16, 230, 1, '#9aa3ad'); R(-380, -8, 230, 1, '#9aa3ad');   // a fence
        TOY.poly([[-180, 0], [-160, -14], [-150, -16], [-136, 0]], '#a07a50');      // a heap of dirt
        const gf = sleepy(t, 35.2), df = sleepy(t, 38.4);
        garbageTruck(-300, { shut: gf.shut, yawn: gf.yawn, beacon: gf.u < 0.8 && Math.floor(T * 3) % 2 });
        digger(-214, { shut: df.shut, yawn: df.yawn, rest: seg(t, 38.6, 40.4), beacon: df.u < 0.8 && Math.floor(T * 3) % 2 });
      },
      lit(t) {
        const gf = sleepy(t, 35.2), df = sleepy(t, 38.4);
        if (gf.u < 0.8) alpha(0.3, () => circle(-269, -42, 6, '#ffb27a'));
        if (df.u < 0.8) alpha(0.3, () => circle(-207, -47, 6, '#ffb27a'));
        zs(-262, -50, seg(t, 38.6, 39.2), 5); zs(-206, -52, seg(t, 41.2, 41.6), 6);
      },
      tint: exteriorTint,
      words: [[36.6, 'YAWN!', () => [-262, -40]], [39.8, 'YAWN!', () => [-206, -40]]],
    },
    { a: 42, b: 51, // 6. upstairs: brushing teeth, then into the bunks
      cam(t) { const k = eio(seg(t, 46.4, 48.4)); if (tall()) setCam(lerp(-67, 22, k), -30, 60, 70, true); else setCam(lerp(-40, -20, k), -24, 130, 76); },
      world(t) {
        const lamp = t < 50.2;
        room(t, lamp);
        const crew = [{ type: 'pjBlue', skin: SKIN[1], hair: '#5a3a22', sink: SINKS[0], bed: -11, blanket: '#3a6fd8', seed: 1 }, { type: 'pjGreen', skin: SKIN[3], hair: '#1d1a2b', sink: SINKS[1], bed: -29, blanket: '#d84a6a', seed: 2 }];
        crew.forEach((c, i) => {
          const walkA = 46.4 + i * 0.3, walkB = 47.8 + i * 0.3, inBed = 48.8 + i * 0.25;
          if (t >= inBed) { inBunk(c.bed, c.skin, c.hair, c.blanket, eout(seg(t, inBed, inBed + 0.7)), c.seed); return; }
          let x = c.sink - 6, yb = 0, pose = 'eat', walk = false, dir = 1;
          if (t > walkA) { x = lerp(c.sink - 6, i ? 41 : 20, eio(seg(t, walkA, walkB))); pose = 'stand'; walk = t < walkB; }
          if (i === 1 && t > walkB) { yb = -Math.round(30 * seg(t, walkB, inBed)); pose = 'wave'; dir = -1; }   // up the ladder
          drawPerson({ type: c.type, x, yb, dir, pose, walk, skin: c.skin, hair: c.hair, seed: c.seed });
          if (t < walkA) {   // the toothbrush, scrubbing, and some foam
            const top = yb - 22, wig = Math.floor(T * 9 + i) % 2;
            R(x + 3 + wig, top + 7, 5, 1, ['#3fb4e8', '#ff6fb4'][i]); R(x + 1 + wig, top + 7, 2, 1, '#ffffff');
            if (t > 42.8) for (let k = 0; k < 3; k++) R(x + 2 + ((k * 3 + Math.floor(T * 4)) % 5), top + 8 + (k % 2), 1, 1, '#ffffff');
          }
        });
      },
      lit(t) {
        const lk = 1 - seg(t, 50.1, 50.3);
        if (lk > 0) { alpha(0.22 * lk, () => circle(53, -20, 18, '#ffe8a0')); alpha(0.5 * lk, () => circle(53, -21, 4, '#fff6c8')); }
        moonFace(64, -50, 3);
        zs(14, -24, seg(t, 49.6, 50.2), 7); zs(14, -42, seg(t, 49.9, 50.5), 8);
      },
      tint: t => [t < 50.2 ? 0.2 : 0.38, '#1c1c50'],
      words: [[49.2, 'GOODNIGHT!', () => [20, -44]], [50.2, 'SHH!', () => [53, -30]]],
    },
    { a: 51, b: 59, // 7. the dogs turn round and round and curl up; the cat kneads her blanket and purrs
      cam(t) { const k = eio(seg(t, 54, 55.2)); if (tall()) setCam(lerp(97, 130, k), -18, 60, 52, true); else setCam(lerp(98, 122, k), -16, 92, 52); },
      world(t) {
        room(t, false);
        const D = SCENES.icecream && SCENES.icecream._dogs;
        for (const [who, seed] of [['vizsla', 0], ['husky', 1]]) {
          const x = DOGX[who], lie = 53.4 + seed * 0.3;
          if (t < lie) {
            const turn = Math.floor((t - 51) / 0.42 + seed) % 2 ? 1 : -1;
            if (D) D[who](x + (t < 51.6 ? lerp(-30 + seed * 50, 0, eout(seg(t, 51, 51.6))) : 0), who === 'husky' ? -1 : 0, turn, { run: t < 51.6, wag: true, pant: who === 'husky', hop: t > 51.6 ? Math.abs(Math.sin((t - 51) * 7.5)) * 1.5 : 0 });
          } else (who === 'husky' ? PETS.huskyLie : PETS.vizslaLie)(x, -1, who === 'husky' ? -1 : 1, { sleep: t > lie + 0.8 });
        }
        const cx = 137;
        if (t < 57.2) {
          PETS.catSit(cx, -3, { blink: t > 55, swish: true });
          if (t > 54.4) {   // kneading: one paw down, the other up
            const ph = Math.floor(T * 3.2) % 2;
            R(cx - 2, -5 - ph, 2, 2, '#f6f2ea'); R(cx + 1, -5 - (1 - ph), 2, 2, '#f6f2ea');
            R(cx - 2, -3, 2, 1, '#f2a8c0'); R(cx + 1, -3, 2, 1, '#f2a8c0');
          }
        } else PETS.catSleep(cx - 7, -3, 1);
      },
      lit(t) {
        moonFace(64, -50, 3);
        zs(90, -16, seg(t, 54.4, 55), 9); zs(118, -18, seg(t, 54.8, 55.4), 10); zs(136, -14, seg(t, 57.6, 58.2), 11);
        if (t > 55 && t < 57.2) for (let i = 0; i < 2; i++) { const p = ((t - 55) * 0.8 + i * 0.5) % 1; alpha(1 - p, () => { const hx = 137 + (i ? 6 : -6), hy = -24 - p * 10; R(hx - 2, hy, 2, 2, '#ff8fb8'); R(hx + 1, hy, 2, 2, '#ff8fb8'); R(hx - 2, hy + 1, 5, 2, '#ff8fb8'); R(hx - 1, hy + 3, 3, 1, '#ff8fb8'); R(hx, hy + 4, 1, 1, '#ff8fb8'); }); }
      },
      tint: () => [0.36, '#1c1c50'],
      words: [[55.2, 'PURR', () => [137, -24]]],
    },
    { a: 59, b: 66, out: true, // 8. stars twinkle; the windows go dark one by one
      cam(t) { setCam(0, tall() ? -120 : -78, 250, 200, true); },
      sky(t) { moonFace(MOON.x, MOON.y, MOON.r); },
      starBoost: t => 0.5 + 0.5 * bump(t, 59.2, 61.5) + 0.5 * bump(t, 62.2, 64.5),
      world(t) { hillsFar(-6, 26, 0.018, 2, '#4a3e66'); housesFar(); hillsFar(-4, 14, 0.03, 5, '#3a5a4a'); station(t, { door: () => 1 }); R(-18, -109, 36, 1, '#e9dcc4'); heli(-18, -109, { rotor: 0, shut: 1, yawn: 0 }); },
      lit(t) { warmWindows(t); },
      tint: () => [0.52, '#141c48'],
    },
    { a: 66, b: 70.5, out: true, // 9. the whole station asleep under the moon, little Zs floating up
      cam(t) { setCam(0, lerp(tall() ? -110 : -60, tall() ? -170 : -120, eio(seg(t, 66.5, 70.5))), 230, 120, true); },
      sky() { moonFace(MOON.x, MOON.y, MOON.r); },
      world(t) {
        hillsFar(-6, 26, 0.018, 2, '#4a3e66'); housesFar(); hillsFar(-4, 14, 0.03, 5, '#3a5a4a');
        station(t, { door: () => 1 }); R(-18, -109, 36, 1, '#e9dcc4'); heli(-18, -109, { rotor: 0, shut: 1, yawn: 0 });
      },
      lit(t) {
        for (const b of BAYS) zs(b.x0 + BAY_W / 2 - 4, -BAY_H - 4, 1, b.v);
        WINS.forEach((wx, i) => zs(wx - 2, -92, i % 2 ? 1 : 0.8, 20 + i));
        zs(14, -128, 1, 3);
        alpha(0.5, () => circle(-120, -32, 3, '#ffe8a0'));                        // the porch light stays on
      },
      tint: () => [0.55, '#141c48'],
    },
    { a: 70.5, b: END, out: true, // 10. the night sky, and a wink from the moon
      cam(t) { setCam(MOON.x, MOON.y + 4 - 3 * eio(seg(t, 70.5, 74)), 84, 84); },
      sky(t) {
        const open = 1 - eio(seg(t, 71.6, 72.3)), wink = t > 73 && t < 73.8 ? 1 : 0, close = eio(seg(t, 74.2, 74.8));
        const l = Math.max(open, close), r = Math.max(open, close, wink);
        moonFace(MOON.x, MOON.y, MOON.r, { left: l, right: r });
      },
      starBoost: () => 0.8,
      world() {},
      lit(t) {
        if (t > 73 && t < 74) { const k = 1 - (t - 73); alpha(k, () => { const x = MOON.x + 10, y = MOON.y - 6 - Math.round((t - 73) * 4); R(x - 2, y, 5, 1, '#fffbe6'); R(x, y - 2, 1, 5, '#fffbe6'); }); }
      },
      tint: () => [0, '#000'],
      words: [[73.2, 'GOODNIGHT!', () => [MOON.x, MOON.y - 16]]],
    },
  ];
  // extra sounds along the story: [time, fn]
  const CUES = [
    ...[VI.fire, VI.police, VI.amb].map(i => [VA[i] + 3.3, softRattle]),
    [24.2, () => { for (let i = 0; i < 12; i++) noise(i * 0.09 * (1 + i * 0.12), 0.06, 0.02 * (1 - i / 14), 260, 1.2); }],   // the rotor slowing down
    [30.2, softRattle],
    [38.6, () => tone('sawtooth', 190, 0, 1.6, 0.01, 110)],                       // the digger's arm settling down
    ...[42.4, 43.2, 44, 44.8, 45.6].map(x => [x, () => { for (let i = 0; i < 4; i++) noise(i * 0.16, 0.1, 0.02, 3200, 1); }]),   // brush brush
    [50.1, () => { tone('square', 1800, 0, 0.02, 0.02); }],                       // the lamp clicks off
    [53.6, () => noise(0, 0.6, 0.02, 600, 1)], [53.9, () => noise(0, 0.6, 0.018, 520, 1)],   // two sleepy sighs
    [56.4, () => SND.play('purr', 0.95)],
    [59.4, () => SND.play('harp', 1)], [62.4, () => SND.play('harp', 0.9)], [65.2, () => SND.play('harp', 1.12)],
    ...WINS.map((_, i) => [60 + i, () => SND.play('chime', 0.75 + i * 0.05, 0.9)]),
    [71.8, () => SND.play('harp', 1.06)], [73, () => SND.play('chime', 1.2)],
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
  // a slow dip through dark blue between shots, like closing and opening sleepy eyes
  function dipK(t) { let k = 0; for (let i = 1; i < SHOTS.length; i++) k = Math.max(k, 1 - Math.abs(t - SHOTS[i].a) / 0.55); return clamp01(k); }
  function homeBtn() { const s = 24; return { x: L.safeL + 8, y: H - L.safeB - s - 12, s }; }
  function finish() { if (st.done) return; st.done = true; crickets(0); goScene(SCENES.movies ? 'movies' : 'station', { watched: 'night' }); }

  SCENES.movieNight = {
    noWeather: true,
    view: [250, 250],
    freeTouch: true,
    modal: () => true,   // taps never reach the sky (no turning the sun back on mid-story)
    cover(x, yb) {
      for (const [a, b] of [[4, -40], [16, -30], [28, -42], [56, -38], [62, -24], [10, -22]]) R(x + a - 10, yb + b, 1, 1, '#fffbe6');
      moonFace(x + 34, yb - 29, 9);
      PETS.huskyLie(x + 2, yb - 1, 1, { sleep: true }); PETS.vizslaLie(x + 26, yb - 1, -1, { sleep: true }); PETS.catSleep(x + 46, yb - 1, -1);
      text('Z', x + 12, yb - 18, 1, '#eaf0ff'); text('Z', x + 16, yb - 23, 1, '#eaf0ff');
    },
    layout() {},
    enter() { Object.assign(st, { t: 0, done: false, fired: {}, paused: false, ui: 0, drag: null }); if (!st.saved) st.saved = clouds; clouds = []; loadMusic(); },
    leave() { stopMusic(); crickets(0); if (st.saved) { clouds = st.saved; st.saved = null; } },
    update(dt) {
      if (st.done) return;
      st.ui = Math.max(0, st.ui - dt);
      if (st.paused || st.drag != null) { stopMusic(); crickets(0); camNow(); return; }
      st.t += dt;
      const s = camNow();
      musicTick();
      crickets(s.out ? 0.3 + 0.7 * dusk(st.t) : 0.3);
      for (const sh of SHOTS) (sh.words || []).forEach(([wt, word], i) => { const key = sh.a + ':' + i; if (st.t >= wt && st.t < wt + 0.3 && !st.fired[key]) { st.fired[key] = true; playWord(word, word === 'YAWN!' ? 0.9 + hsh(i + sh.a) * 0.25 : 1); } });
      CUES.forEach(([ct, fn], i) => { const key = 'c' + i; if (st.t >= ct && st.t < ct + 0.3 && !st.fired[key]) { st.fired[key] = true; fn(); } });
      if (st.t >= END - 0.06) finish();
    },
    groundY() { return Math.round(H * 0.6); },
    drawWorld() {
      const s = shotAt(st.t), t = st.t, k = s.out ? dusk(t) : 1;
      // the sky goes straight onto the bottom layer, so the night tint never touches it
      const wg = g; g = loG;
      scrT(); drawSkyBands(s === SHOTS[SHOTS.length - 1] ? 1 : k);
      if (s.out) { camT(); drawStars(seg(k, 0.45, 0.9), s.starBoost ? s.starBoost(t) : 0); if (s.sky) s.sky.call(s, t); scrT(); }
      g = wg;
      camT(); s.world.call(s, t); scrT();
      // our own evening tint (taking any tint the engine adds at night into account)
      let [a, c] = s.tint(t);
      const a2 = 0.42 * nightK();
      if (a2 > 0.01) a = a > a2 ? 1 - (1 - a) / (1 - a2) : 0;
      if (a > 0.01) { g.globalCompositeOperation = 'source-atop'; alpha(a, () => R(0, 0, W, H, c)); g.globalCompositeOperation = 'source-over'; }
    },
    drawLit() {
      const s = shotAt(st.t);
      camT(); if (s.lit) s.lit.call(s, st.t); scrT();
      drawParticles();
    },
    drawUI() {
      const s = shotAt(st.t);
      for (const w of s.words || []) { const [wt, word, at] = w, age = st.t - wt; if (age >= 0 && age <= 2.2) { const [wx, wy] = at(st.t); bubble(word, sx(wx), sy(wy), age); } }
      const dk = dipK(st.t);
      if (dk > 0) alpha(dk, () => R(0, 0, W, H, BLACK));
      iris(Math.min(1, st.t / 0.8, (END - st.t) / 1.6), W / 2, H * 0.45);
      const bx = L.safeL + 8, bw = W - L.safeL - L.safeR - 16, by = H - L.safeB - 5;
      alpha(0.35, () => R(bx, by, bw, 2, BLACK));
      alpha(0.6, () => R(bx, by, Math.round(bw * clamp01(st.t / END)), 2, '#fff6e0'));
      drawControls();
      drawHomeButton(homeBtn());
    },
    tap(x, y, id) {
      if (inBox(homeBtn(), x, y)) { SFX.boop(); window.movieQuit = true; finish(); return true; }
      const c = ctl();
      if (st.paused || st.ui > 0) {
        st.ui = 3.5;
        if (inBox(c.play, x, y, 6)) { st.paused = !st.paused; return true; }
        if (x >= c.track.x0 - 10 && x <= c.track.x1 + 10 && Math.abs(y - c.track.y) <= 14) { st.drag = id; seek(tAtX(c, x)); return true; }
      }
      st.ui = 3.5;
      sparkle(x, y, 4, 3, '#fff6c8');
      return true;
    },
    move(x, y, id) { if (st.drag === id) { st.ui = 3.5; seek(tAtX(ctl(), x)); } },
    release(id) { if (st.drag === id) { st.drag = null; st.ui = 3.5; } },
    _st: st, _jump(t) { seek(t); }, _audio: () => ({ music: !!music.buf, playing: !!music.src, purr: SND.has('purr'), harp: SND.has('harp'), crickets: SND.has('crickets') }),
  };
})();
