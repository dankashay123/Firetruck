// "Garbage Day": the green garbage truck rolls down a street of houses. At each bin a tap sends
// its robot arm out to grab the bin, lift it over the top and tip it in (crash, bang!), then the
// compactor goes crunch and the truck rolls on to the next one. After six bins it backs into the
// recycling center (beep, beep, beep!) and empties out. Watch for the raccoon in the old metal
// cans, the two dogs barking from their yard, and a kid who waves at the truck.
'use strict';
(() => {
  const { poly, bar, turn, oval, hsh, paint, blit, hand } = TOY;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const eio = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const G1 = '#3fb43a', G2 = '#5ad04a', G3 = '#2f8a2c', G4 = '#1f5a1e';

  /* ---------- sounds ---------- */
  const SND = TOY.bank({
    clang: ['trash-clang', 0.6], bang: ['trash-bang', 0.6], crunch: ['trash-crunch', 0.6], air: ['trash-air', 0.35], rustle: ['trash-rustle', 0.6],
    engine: ['dig-engine', 0.5], honk: ['bt-honk', 0.6], bark: ['dog-bark', 0.7], bark2: ['dog-bark-2', 0.6], squeak: ['bath-squeak', 0.5], boing: ['dig-boing', 0.5],
  }, {
    clang() { tone('square', 300, 0, 0.12, 0.06, 180); noise(0, 0.15, 0.08, 2500, 2); }, bang() { noise(0, 0.2, 0.12, 800, 1); },
    crunch() { for (let i = 0; i < 5; i++) noise(i * 0.08, 0.07, 0.1, 1800, 1.4); }, air() { noise(0, 0.6, 0.1, 5000, 0.7); },
    rustle() { noise(0, 0.3, 0.06, 3000, 0.8); }, honk() { SFX.honk(); }, bark() { SFX.woof(); }, bark2() { SFX.woof(); },
    squeak() { tone('sine', 1400, 0, 0.15, 0.08, 1900); }, boing() { tone('sine', 300, 0, 0.3, 0.12, 700); },
  }, 'trash-music', 0.18);
  const engine = SND.loop('engine');
  function whine(up) { tone('sawtooth', up ? 150 : 230, 0, 0.55, 0.02, up ? 260 : 140); }

  /* ---------- the street ---------- */
  const HW = 64, PER = 6, CW = 150, SEG = PER * HW + CW;
  const houseX = (seg, i) => seg * SEG + i * HW + 32;
  const binX = (seg, i) => houseX(seg, i) + 8;
  const centerX = seg => seg * SEG + PER * HW + CW / 2;
  const GRIP = 6;   // the arm grabs a bin this far ahead of the truck's middle
  // bins: green garbage, blue recycling, brown yard waste, an old metal can
  const BINS = [
    { body: '#3a8a3a', lid: '#2f6a2e', items: [['#2a2a30', 4, 4], ['#3a3a44', 4, 3], ['#ffd21f', 3, 1], ['#c8945a', 4, 3]] },
    { body: '#2a6fe0', lid: '#1f58b8', items: [['#7ad0ff', 2, 4], ['#3fb43a', 2, 4], ['#cfd6dd', 2, 3], ['#c8945a', 4, 3], ['#ffffff', 4, 3]] },
    { body: '#8a5a32', lid: '#6a4424', items: [['#4a9a3a', 3, 2], ['#3a8a2e', 3, 2], ['#f57a12', 3, 2], ['#7a4a24', 4, 1]] },
    { body: '#9aa3ad', lid: '#7a838d', items: [['#2a2a30', 4, 4], ['#e8222b', 3, 2], ['#ffffff', 3, 3], ['#c8945a', 4, 3]] },
  ];
  const binKind = (seg, i) => Math.floor(hsh(seg * 13 + i * 3.7) * 4);
  const raccoonIn = (seg, i) => binKind(seg, i) === 3 && i !== 2;
  const HOUSE_C = [['#ffb0c8', '#c8432f'], ['#bfe6ff', '#2a6fe0'], ['#fff2a8', '#8a4fd9'], ['#c8f0c0', '#a83a2a'], ['#f2d2a8', '#3a5a8a'], ['#e6d2ff', '#d0630a']];

  const Y = {};
  function layout() {
    const room = H - L.safeT - L.safeB;
    Y.yR = H - L.safeB - Math.max(30, Math.min(110, Math.round(room * (room > 250 ? 0.27 : 0.26))));   // where the truck's wheels touch
    Y.home = { x: L.safeL + 4, y: H - L.safeB - L.blob - 4, s: L.blob };
  }

  /* ---------- state ---------- */
  const st = {
    cam: 0, seg: 0, i: 0, done: {}, fill: 0, items: [], pile: 0, idle: 0,
    truck: { x: 0, v: 0, spin: 0, state: 'wait', t: 0, shake: 0, honk: 0, gate: 0, arm: null, dir: 1 },
    birds: [], dogs: { bark: 0, hop: 0, t: 0 }, kid: { cheer: 0 }, coon: null,
  };
  const key = (seg, i) => seg + ':' + i;
  function nextStop() {   // where the truck should go next: the next full bin, or the recycling center
    if (st.fill >= PER) return { center: true, x: centerX(st.seg) + 70 };
    return { x: binX(st.seg, st.i) - GRIP };
  }
  function resetBirds() { st.birds = []; for (let k = 0; k < 5; k++) st.birds.push({ x: k * 37 + 20, fly: 0, vx: 0, vy: 0, y: 0, seed: k }); }

  /* ---------- drawing the street ---------- */
  function house(seg, i) {
    const x = houseX(seg, i), base = Y.yR - 18, h = hsh(seg * 7 + i * 1.3), [wall, roof] = HOUSE_C[Math.floor(h * 6)];
    const tall = h > 0.5, hw = 26, top = base - (tall ? 46 : 32);
    // yard and fence
    R(x - 32, base - 4, HW, 6, '#6cbf5a');
    R(x - hw, top, hw * 2, base - top, wall); R(x - hw, top, 2, base - top, 'rgba(255,255,255,0.35)');
    for (let k = 0; k < 13; k++) R(x - hw - 4 + k * 2, top - 1 - k, hw * 2 + 8 - k * 4, 1, k % 4 ? roof : mix(roof, '#000000', 0.15));
    if (h > 0.3) { R(x + 10, top - 16, 6, 10, '#a8743f'); R(x + 9, top - 17, 8, 2, '#8a5a32'); }
    R(x - 5, base - 14, 10, 14, '#8a5a32'); R(x - 4, base - 13, 8, 13, '#a8743f'); R(x + 2, base - 7, 1, 1, '#ffd21f');
    const win = (wx, wy) => { R(wx, wy, 10, 9, '#ffffff'); R(wx + 1, wy + 1, 8, 7, '#bfe6ff'); R(wx + 5, wy + 1, 1, 7, '#ffffff'); R(wx + 1, wy + 4, 8, 1, '#ffffff'); };
    win(x - 21, base - 16); win(x + 11, base - 16);
    if (tall) { win(x - 21, top + 6); win(x + 11, top + 6); win(x - 5, top + 6); }
    for (let k = 0; k < HW; k += 4) { if (Math.abs(k - 32) < 8) continue; R(x - 32 + k, base - 7, 2, 7, '#ffffff'); R(x - 32 + k, base - 8, 2, 1, '#e8ecef'); }
    R(x - 32, base - 5, HW, 1, '#ffffff');
    if (h < 0.4) drawTree(x - 30, base - 2, 9);
    // a mailbox by the walk
    R(x - 12, base - 2, 1, 6, '#5a3a22'); R(x - 15, base - 5, 7, 4, ['#e8222b', '#2a6fe0', '#3a3d46'][i % 3]);
  }
  function center(seg) {
    const x = centerX(seg), base = Y.yR - 18, w = 120, top = base - 52;
    R(x - w / 2, base - 4, w, 6, '#9aa3ad');
    R(x - w / 2, top, w, base - top, '#c7ccd3'); for (let y = top + 4; y < base; y += 5) R(x - w / 2, y, w, 1, '#b5bcc6');
    for (let k = 0; k < 6; k++) R(x - w / 2 - 3 + k, top - 1 - k, w + 6 - 2 * k, 1, '#7a838d');
    // the big open door, with the pile of everything that's been brought here
    R(x - 26, base - 34, 52, 34, '#3a3d46'); R(x - 26, base - 36, 52, 2, '#f2b51c');
    for (let k = 0; k < 5; k++) R(x - 26 + k * 11, base - 36, 6, 2, '#2a2a30');
    const ph = Math.min(28, 6 + (st.pileSeg === seg ? st.pile : 0) * 2.5);
    oval(x, base, 22, ph, '#5a5a62');
    for (let k = 0; k < Math.min(40, ph * 2); k++) { const it = BINS[k % 4].items[k % 3]; const px = x + (hsh(k * 2.7) * 2 - 1) * 18, py = base - 1 - hsh(k * 4.1) * ph * 0.8; R(px, py, it[1], it[2], it[0]); }
    // a sign: a green circle of three arrows
    const sx = x, sy = top + 9;
    circle(sx, sy, 8, '#ffffff'); circle(sx, sy, 7, G1);
    for (const a of [0, 2.1, 4.2]) { const ax = sx + Math.cos(a + T * 0.5) * 4, ay = sy + Math.sin(a + T * 0.5) * 4; R(ax - 1, ay - 1, 3, 3, '#ffffff'); }
    R(x - w / 2 + 6, top + 6, 14, 10, '#bfe6ff'); R(x + w / 2 - 20, top + 6, 14, 10, '#bfe6ff');
  }
  function hills() {   // rolling hills and trees far behind the houses, drifting slowly
    const base = Y.yR - 20, room = base - L.safeT;
    if (room < 90) return;
    const par = 0.3, off = st.cam * (1 - par);
    for (let x = Math.floor(st.cam) - 2; x < st.cam + W + 2; x += 2) {
      const wx = x - off, h1 = 30 + 18 * Math.sin(wx * 0.013) + 8 * Math.sin(wx * 0.031 + 1), h2 = 16 + 10 * Math.sin(wx * 0.021 + 2);
      R(x, base - h1 - 20, 2, h1 + 20, '#9ad88a'); R(x, base - h2 - 8, 2, h2 + 8, '#86cc74');
    }
    for (let i = Math.floor((st.cam - off - 20) / 26); i < (st.cam + W - off + 20) / 26; i++) {
      const x = Math.round(i * 26 + off + hsh(i) * 10), wx = x - off, hy = base - 16 - 10 * Math.sin(wx * 0.021 + 2) - 4;
      if (hsh(i * 3.1) < 0.5) drawTree(x, hy + 6, 6 + Math.floor(hsh(i * 7) * 4));
    }
  }
  function street() {
    const v0 = st.cam - 40, v1 = st.cam + W + 40;
    // houses (and the recycling center) along the far side
    R(Math.floor(v0), Y.yR - 24, Math.ceil(v1 - v0), 10, '#6cbf5a');
    for (let seg = Math.floor(v0 / SEG) - 1; seg <= Math.floor(v1 / SEG) + 1; seg++) {
      for (let i = 0; i < PER; i++) { const x = houseX(seg, i); if (x > v0 - 40 && x < v1 + 40) house(seg, i); }
      if (seg >= 0 && centerX(seg) > v0 - 80 && centerX(seg) < v1 + 80) center(seg);
    }
    const x0 = Math.floor(v0), ww = Math.ceil(v1 - v0);
    // the road, the curb and the sidewalk
    R(x0, Y.yR - 16, ww, 20, '#4b4f5c'); R(x0, Y.yR - 16, ww, 2, '#bdb8ac');
    for (let x = Math.floor(v0 / 20) * 20; x < v1; x += 20) R(x, Y.yR - 7, 10, 2, '#ffd21f');
    R(x0, Y.yR + 4, ww, 2, '#bdb8ac'); R(x0, Y.yR + 6, ww, 12, '#d8d2c4');
    for (let x = Math.floor(v0 / 16) * 16; x < v1; x += 16) R(x, Y.yR + 6, 1, 12, '#c4bdaf');
    R(x0, Y.yR + 18, ww, H, '#6cbf5a');
    for (let x = Math.floor(v0 / 9) * 9; x < v1; x += 9) { const n = Math.floor(x / 9); R(x, Y.yR + 21 + Math.floor(hsh(n) * Math.max(4, H - Y.yR - 26)), 1, 2, hsh(n * 3) > 0.7 ? '#ffd21f' : '#5aa84c'); }
  }
  function yardFriends() {
    // the two dogs, watching from their yard (house 2 of every street)
    const S_ = SCENES.icecream && SCENES.icecream._dogs, d = st.dogs;
    for (let seg = Math.floor((st.cam - 60) / SEG); seg <= Math.floor((st.cam + W + 60) / SEG); seg++) {
      if (seg < 0) continue;
      const x = houseX(seg, 2), base = Y.yR - 17;
      if (S_ && x > st.cam - 60 && x < st.cam + W + 60) {
        S_.husky(x - 14, base, 1, { pant: d.bark <= 0, bark: d.bark > 0 && Math.floor(T * 8) % 2 === 0, wag: true, hop: d.hop });
        S_.vizsla(x + 16, base, -1, { bark: d.bark > 0 && Math.floor(T * 8) % 2 === 1, wag: true, hop: d.hop * 0.7 });
        for (let k = 0; k < HW; k += 4) if (Math.abs(k - 32) >= 8) R(x - 32 + k, base - 6, 2, 6, '#ffffff');
        R(x - 32, base - 4, HW, 1, '#ffffff');
        if (Math.abs(x - st.truck.x) < W) PETS.draw('trash', { y: base - 6, x0: x + 26, x1: x + 27, who: ['cat'], spots: { cat: { x: x + 26, pose: 'sit' } } });
      }
      // a kid in the yard of house 4 who loves the garbage truck
      const kx = houseX(seg, 4) - 18;
      if (kx > st.cam - 20 && kx < st.cam + W + 20) {
        const near = Math.abs(st.truck.x - kx) < 70;
        drawPerson({ type: 'kid', x: kx, yb: Y.yR - 17, dir: st.truck.x > kx ? 1 : -1, pose: st.kid.cheer > 0 ? 'cheer' : near ? 'wave' : 'stand', skin: SKIN[2], seed: 4, hop: st.kid.cheer > 0 ? Math.abs(Math.sin(T * 10)) * 3 : 0 });
      }
    }
  }
  function bin(x, kind, lift, open) {   // a wheelie bin standing on (x, yb); lift: {x, y, rot} when the arm has it
    const b = BINS[kind];
    const draw = () => {
      if (kind === 3) {
        R(-6, -14, 12, 14, b.body); for (let k = -4; k <= 4; k += 3) R(k, -13, 1, 12, '#7a838d'); R(-6, -14, 12, 1, '#c7ccd3');
        R(-7, -16 - (open || 0), 14, 3, b.lid); R(-2, -18 - (open || 0), 4, 2, b.lid);
        R(-8, -11, 2, 3, '#7a838d'); R(6, -11, 2, 3, '#7a838d');
      } else {
        poly([[-7, -16], [7, -16], [6, 0], [-6, 0]], b.body); R(-7, -16, 14, 1, mix(b.body, '#ffffff', 0.3));
        R(-8, -18 - (open || 0), 16, 3, b.lid); R(-8, -18 - (open || 0), 16, 1, mix(b.lid, '#ffffff', 0.3));
        R(-5, -11, 10, 1, b.lid); R(-5, -6, 10, 1, b.lid);
        circle(-5, -1, 2, '#2f3240'); circle(5, -1, 2, '#2f3240');
        if (kind === 1) { R(-2, -10, 4, 3, '#ffffff'); R(-1, -9, 2, 1, b.body); }
        if (kind === 2) { R(-2, -10, 4, 3, '#4a9a3a'); }
      }
    };
    g.save();
    if (lift) { g.translate(Math.round(lift.x), Math.round(lift.y)); g.rotate(lift.rot); g.translate(0, 8); }   // rotate around the middle
    else g.translate(Math.round(x), Y.yR + 16);
    draw();
    g.restore();
  }
  function bins() {
    for (let seg = Math.max(0, Math.floor((st.cam - 40) / SEG)); seg <= Math.floor((st.cam + W + 40) / SEG); seg++)
      for (let i = 0; i < PER; i++) {
        const x = binX(seg, i);
        if (x < st.cam - 20 || x > st.cam + W + 20) continue;
        const arm = st.truck.arm;
        if (arm && arm.seg === seg && arm.i === i && armPose(arm).has) continue;   // the arm is holding this one
        const empty = st.done[key(seg, i)], kind = binKind(seg, i);
        // a raccoon peeks out of some of the old metal cans
        const peek = !empty && raccoonIn(seg, i) && (Math.sin(T * 1.3 + i) > 0.55);
        if (peek) raccoonHead(x, Y.yR + 16 - 17 - 3, 0);
        bin(x, kind, null, peek ? 3 : 0);
        if (empty) R(x - 4, Y.yR + 2, 1, 1, '#ffffff');
      }
  }
  function raccoonHead(x, y, look) {
    x = Math.round(x); y = Math.round(y);
    R(x - 4, y - 4, 9, 6, '#8a8680'); R(x - 4, y - 6, 2, 2, '#8a8680'); R(x + 3, y - 6, 2, 2, '#8a8680');
    R(x - 4, y - 2, 9, 2, '#2a2a30'); R(x - 3, y - 2, 1, 1, '#ffffff'); R(x + 2, y - 2, 1, 1, '#ffffff');
    R(x - 1, y, 3, 2, '#e8ecef'); R(x, y, 1, 1, INK);
  }
  function raccoon(c) {   // jumped out of a can, scampering away with its striped tail up
    const x = Math.round(c.x), y = Math.round(c.y), d = c.vx < 0 ? -1 : 1, st_ = Math.floor(T * 14) % 2;
    const P = (dx, dy, w, h, col) => R(d > 0 ? x + dx : x - dx - w, y + dy, w, h, col);
    P(-6, -6, 11, 5, '#8a8680'); P(-6, -6, 11, 1, '#a8a49c');
    for (let k = 0; k < 4; k++) P(-11 + (k % 2), -9 - k * 2 + 2, 4, 2, k % 2 ? '#2a2a30' : '#a8a49c');
    P(4, -9, 6, 5, '#8a8680'); P(5, -7, 5, 1, '#2a2a30'); P(9, -6, 2, 1, INK); P(4, -10, 2, 1, '#8a8680');
    P(-4 + st_, -1, 2, 2, '#55514b'); P(2 - st_, -1, 2, 2, '#55514b');
  }

  /* ---------- the garbage truck (painted facing right, origin at the middle of the wheels) ---------- */
  function truckArt(o) {
    // the body: a big green box with ribs, the hopper on top just behind the cab
    R(-46, -44, 64, 32, G1); R(-46, -44, 64, 2, G2); R(-46, -14, 64, 2, G3);
    for (const rx of [-34, -22, -10]) { R(rx, -42, 2, 28, G3); R(rx + 2, -42, 1, 28, G2); }
    R(-46, -44, 3, 32, G3);
    // the hopper opening, showing what's inside
    R(2, -48, 16, 6, G4); R(1, -49, 18, 2, G3);
    for (let k = 0; k < Math.min(12, o.fill * 2); k++) { const it = BINS[k % 4].items[k % 3]; R(3 + (k * 5) % 13, -48 + Math.floor(k / 3) % 2, it[1], 2, it[0]); }
    // the tailgate at the back lifts up from its top hinge
    if (o.gate > 0.02) {
      const a = o.gate * 1.4, pts = turn([[-47, -44], [-41, -44], [-41, -12], [-47, -12]], a, -44, -44, -44, -44);
      poly(pts, G3); poly(turn([[-46, -42], [-42, -42], [-42, -14], [-46, -14]], a, -44, -44, -44, -44), G1);
    } else { R(-48, -44, 4, 32, G3); R(-47, -42, 2, 28, G1); for (let k = 0; k < 4; k++) R(-48, -20 + k * 2, 4, 1, k % 2 ? '#e8222b' : '#ffffff'); }
    // the cab
    R(19, -40, 26, 28, '#f4f7fb'); R(19, -40, 26, 2, '#ffffff'); R(19, -14, 26, 2, '#cfd6dd');
    R(29, -37, 14, 11, '#4a4f5c'); R(30, -36, 12, 9, GLASS); R(31, -35, 1, 6, '#ffffff');
    // the driver, who waves when the horn goes
    const wave = o.honk > 0;
    R(34, -33, 5, 5, SKIN[1]); R(34, -35, 5, 2, '#f57a12'); R(38, -34, 2, 1, '#f57a12'); R(37, -31, 1, 1, INK);
    if (wave) { R(39, -36 + (Math.floor(T * 10) % 2), 2, 4, SKIN[1]); }
    R(19, -24, 26, 2, G1); R(21, -20, 6, 1, '#cfd6dd');
    R(44, -22, 3, 8, '#5a5650'); R(45, -26, 2, 3, '#fff6c8'); R(43, -13, 6, 3, '#9aa3ad');
    R(28, -43, 6, 3, '#f57a12'); R(29, -44, 4, 1, '#ffb27a');   // beacon
    R(-46, -12, 92, 3, '#3a3d46');
    for (const wx of [-30, -16, 32]) {
      circle(wx, -7, 7, '#1d1a2b'); circle(wx, -7, 4, '#9aa3ad'); circle(wx, -7, 2, '#5a5e6a');
      const a = o.spin || 0; R(wx + Math.round(Math.cos(a) * 4), -7 + Math.round(Math.sin(a) * 4), 1, 1, '#1d1a2b');
    }
  }
  // the robot arm: from its shoulder on the body side out to the grip, in world coordinates
  function drawArm(tx, ty, gx, gy, grip) {
    const sx = tx + 6, sy = Y.yR - 24;
    bar(sx, sy, gx, gy, 6, '#2f3240', true); bar(sx, sy, lerp(sx, gx, 0.55), lerp(sy, gy, 0.55), 6, '#5a5e6a', true);
    bar(sx, sy - 1, lerp(sx, gx, 0.55), lerp(sy, gy, 0.55) - 1, 1, '#8a939d');
    circle(sx, sy, 4, '#3a3d46'); circle(sx, sy, 2, '#8a939d');
    // the gripper hugs the bin's sides
    const open = grip ? 0 : 3;
    R(gx - 10 - open, gy - 4, 3, 9, '#f2b51c'); R(gx + 8 + open, gy - 4, 3, 9, '#f2b51c'); R(gx - 9 - open, gy - 1, 18 + open * 2, 2, '#c98a10');
  }

  /* ---------- the arm's routine ---------- */
  const ARM = [['reach', 0.45], ['grab', 0.2], ['lift', 0.75], ['shake', 0.7], ['lower', 0.7], ['let go', 0.2], ['back', 0.4]];
  const ARM_END = []; { let t = 0; for (const [, d] of ARM) ARM_END.push(t += d); }
  function armPose(a) {   // grip point and bin pose for time a.t
    const tx = st.truck.x, rest = [tx + 6, Y.yR - 18], down = [tx + GRIP, Y.yR + 8], top = [tx + 9, Y.yR - 62];
    const seg = i => clamp01((a.t - (i ? ARM_END[i - 1] : 0)) / ARM[i][1]);
    let g_ = rest, rot = 0, has = false, grip = false;
    if (a.t < ARM_END[0]) { const k = eio(seg(0)); g_ = [lerp(rest[0], down[0], k), lerp(rest[1], down[1], k)]; }
    else if (a.t < ARM_END[1]) { g_ = down; grip = seg(1) > 0.5; has = grip; }
    else if (a.t < ARM_END[2]) { const k = eio(seg(2)); g_ = [lerp(down[0], top[0], k) + Math.sin(k * Math.PI) * 14, lerp(down[1], top[1], k)]; rot = k * Math.PI * 0.95; has = grip = true; }
    else if (a.t < ARM_END[3]) { const k = seg(3); g_ = [top[0], top[1] + Math.round(Math.sin(k * Math.PI * 6) * 2)]; rot = Math.PI * 0.95 + Math.sin(k * Math.PI * 6) * 0.08; has = grip = true; }
    else if (a.t < ARM_END[4]) { const k = eio(seg(4)); g_ = [lerp(top[0], down[0], k) + Math.sin(k * Math.PI) * 14, lerp(top[1], down[1], k)]; rot = (1 - k) * Math.PI * 0.95; has = grip = true; }
    else if (a.t < ARM_END[5]) { g_ = down; grip = seg(5) < 0.5; has = grip; }
    else { const k = eio(seg(6)); g_ = [lerp(down[0], rest[0], k), lerp(down[1], rest[1], k)]; }
    return { g: g_, rot, has, grip };
  }
  function startArm() {
    const tr = st.truck, k = key(st.seg, st.i);
    if (tr.state !== 'wait' || st.done[k] || st.fill >= PER) return false;
    tr.state = 'arm'; tr.arm = { t: 0, seg: st.seg, i: st.i, kind: binKind(st.seg, st.i), fired: {} };
    whine(true);
    return true;
  }
  function updateArm(dt) {
    const tr = st.truck, a = tr.arm, before = a.t;
    a.t += dt;
    const at = x => before < x && a.t >= x;
    if (at(ARM_END[1] - 0.05)) { SND.play('bang', 1.1); if (raccoonIn(a.seg, a.i)) { st.coon = { x: binX(a.seg, a.i), y: Y.yR + 2, vx: -50, vy: -90, ground: false }; SND.play('squeak', 1.2); } }
    if (at(ARM_END[2] - 0.15)) whine(true);
    if (at(ARM_END[2])) {   // upside down over the hopper: everything tumbles in
      SND.play('clang'); setTimeout(() => SND.play('rustle'), 120); setTimeout(() => SND.play('bang', 0.8), 380);
      const pose = armPose(a), its = BINS[a.kind].items;
      for (let k = 0; k < 14; k++) { const it = its[k % its.length]; st.items.push({ x: pose.g[0] + rand(-4, 4), y: pose.g[1] - 6 + rand(-3, 3), vx: rand(-14, 6), vy: rand(-30, 0), c: it[0], w: it[1], h: it[2], floor: Y.yR - 44, delay: k * 0.03 }); }
    }
    if (at(ARM_END[3] - 0.3)) SND.play('clang', 1.15);
    if (at(ARM_END[3])) whine(false);
    if (at(ARM_END[5])) { SND.play('bang', 0.9); st.done[key(a.seg, a.i)] = true; }
    if (a.t >= ARM_END[6]) {
      tr.arm = null; st.fill++; st.i++;
      tr.state = 'crunch'; tr.t = 0; SND.play('crunch');
      if (st.fill % 3 === 0) sparkle(tr.x - st.cam - 10, Y.yR - 50, 10, 6, '#fff6b0');
    }
  }
  function updateTruck(dt) {
    const tr = st.truck;
    tr.honk = Math.max(0, tr.honk - dt); tr.shake = Math.max(0, tr.shake - dt);
    const drive = (target, speed) => {
      const d = target - tr.x;
      tr.v = lerp(tr.v, Math.min(speed, Math.abs(d) * 1.6 + 5), Math.min(1, dt * 2.2));
      const step = Math.min(Math.abs(d), tr.v * dt);
      tr.x += Math.sign(d) * step; tr.spin += Math.sign(d) * step / 7;
      return Math.abs(target - tr.x) < 0.4;
    };
    switch (tr.state) {
      case 'wait': tr.v = 0; break;
      case 'drive': {
        const s = nextStop();
        if (drive(s.x, 44)) {
          SND.play('air');
          if (s.center) { tr.state = 'reverse'; tr.t = 0; }
          else { tr.state = 'wait'; st.idle = 0; }
        }
        break;
      }
      case 'arm': updateArm(dt); break;
      case 'crunch':
        tr.t += dt; tr.shake = 0.1;
        if (tr.t > 0.9) { tr.state = 'pause'; tr.t = 0; }
        break;
      case 'pause': if ((tr.t += dt) > 0.6) { tr.state = 'drive'; tr.v = 0; } break;
      case 'reverse': {   // back up to the recycling center's door: beep, beep, beep
        const door = centerX(st.seg) + 46;
        const was = tr.t % 0.62 < 0.31; tr.t += dt; const now = tr.t % 0.62 < 0.31;
        if (now && !was || tr.t === dt) tone('square', 1046, 0, 0.26, 0.045);
        if (drive(door, 22)) { tr.state = 'unload'; tr.t = 0; SND.play('air'); whine(true); st.pileSeg = st.seg; }
        break;
      }
      case 'unload': {
        tr.t += dt;
        tr.gate = clamp01(tr.t / 0.8) * (1 - clamp01((tr.t - 3) / 0.8));
        if (tr.t > 0.8 && tr.t < 2.8 && Math.random() < dt * 40) {
          const it = BINS[Math.floor(Math.random() * 4)].items[Math.floor(Math.random() * 3)];
          st.items.push({ x: tr.x - 47, y: Y.yR - 30 + rand(-8, 8), vx: rand(-40, -15), vy: rand(-20, 10), c: it[0], w: it[1], h: it[2], floor: Y.yR - 18, delay: 0 });
        }
        if (tr.t > 0.8 && tr.t < 2.8) { const before = st.pile; st.pile = Math.min(9, st.pile + dt * 3.5); if (Math.floor(before) !== Math.floor(st.pile)) SND.play(Math.random() < 0.5 ? 'rustle' : 'bang', 0.9 + Math.random() * 0.3); }
        if (tr.t > 3 && !tr.closing) { tr.closing = true; whine(false); }
        if (tr.t > 3.9) {
          tr.gate = 0; tr.closing = false; st.fill = 0; st.seg++; st.i = 0;
          SFX.fanfare(); confetti(30); tr.state = 'pause'; tr.t = -1.2;
          SND.play('honk'); tr.honk = 1;
        }
        break;
      }
    }
  }
  function update(dt) {
    const tr = st.truck;
    updateTruck(dt);
    st.idle += dt;
    // falling trash
    for (const it of st.items) {
      if (it.delay > 0) { it.delay -= dt; continue; }
      it.vy += 240 * dt; it.x += it.vx * dt; it.y += it.vy * dt;
      if (it.y >= it.floor) it.dead = true;
    }
    st.items = st.items.filter(it => !it.dead);
    // the dogs bark when the truck comes by
    const d = st.dogs, dx = houseX(Math.floor((tr.x + 40) / SEG), 2);
    d.hop = Math.max(0, d.hop - dt * 25); d.bark = Math.max(0, d.bark - dt);
    if (Math.abs(tr.x - dx) < 60 && tr.v > 5 && (d.t -= dt) <= 0) { d.t = 1.3; d.bark = 0.5; d.hop = 5; SND.play(Math.random() < 0.5 ? 'bark' : 'bark2'); }
    st.kid.cheer = Math.max(0, st.kid.cheer - dt);
    // a raccoon scampers off
    if (st.coon) {
      const c = st.coon; c.vy += 300 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.y > Y.yR + 15) { c.y = Y.yR + 15; c.vy = 0; c.vx = -60; }
      if (c.x < st.cam - 30) st.coon = null;
    }
    // birds on the wire fly off when the horn sounds, and come back
    for (const b of st.birds) {
      if (b.fly > 0) { b.fly -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy -= 10 * dt; }
      else { b.x = lerp(b.x, b.home || b.x, 0.05); b.y = lerp(b.y, 0, Math.min(1, dt * 3)); }
    }
    const want = tr.x - W * 0.42;
    st.cam += (want - st.cam) * Math.min(1, dt * 3);
    const moving = tr.state === 'drive' || tr.state === 'reverse';
    engine(moving ? 1 : tr.state === 'arm' || tr.state === 'crunch' || tr.state === 'unload' ? 0.75 : 0.45, moving ? 1.3 : 1);
  }
  function wires() {
    const y0 = Y.yR - 18 - 78;
    if (y0 < L.safeT + 30) return null;
    const p0 = Math.floor((st.cam - 40) / 120) * 120;
    for (let x = p0; x < st.cam + W + 120; x += 120) { R(x, y0 - 6, 3, Y.yR - 18 - y0 + 6, '#8a6a4a'); R(x - 6, y0 - 4, 15, 2, '#8a6a4a'); }
    for (let x = Math.floor(st.cam) - 2; x < st.cam + W + 2; x++) { const k = ((x % 120) + 120) % 120 / 120; R(x, y0 - 3 + Math.round(Math.sin(k * Math.PI) * 5), 1, 1, '#3a3d46'); }
    return y0;
  }
  function birds(y0) {
    if (y0 == null) return;
    for (const b of st.birds) {
      const wx = Math.floor(st.cam / 120) * 120 + b.seed * 23 + 10, k = (((wx) % 120) + 120) % 120 / 120;
      if (b.home == null || b.fly <= 0 && b.away) { b.away = false; }
      const x = Math.round(b.fly > 0 || b.away ? b.x : wx), y = Math.round(y0 - 3 + Math.sin(k * Math.PI) * 5 - 3 + (b.fly > 0 ? b.y : 0));
      if (b.fly <= 0) b.x = wx;
      const flap = b.fly > 0 && Math.floor(T * 10) % 2;
      R(x - 2, y - 2, 4, 3, '#3a6ab8'); R(x + 1, y - 3, 3, 2, '#3a6ab8'); R(x + 4, y - 2, 1, 1, '#f57a12'); R(x + 2, y - 3, 1, 1, '#ffffff');
      R(x - 2, y - 2 - (flap ? 2 : 0), 3, 1, '#2a4a8a');
    }
  }

  SCENES.trash = {
    view: (w, h) => h > w * 1.2 ? [124, 200] : [180, 120],
    freeTouch: true,
    layout,
    groundY: () => Y.yR - 22,
    enter() {
      layout();
      Object.assign(st, { seg: 0, i: 0, done: {}, fill: 0, items: [], pile: 0, coon: null, idle: 0 });
      Object.assign(st.truck, { x: binX(0, 0) - GRIP - 70, v: 0, state: 'drive', t: 0, gate: 0, arm: null, shake: 0 });
      st.cam = st.truck.x - W * 0.42;
      resetBirds();
      SND.load(); SND.music(true);
    },
    leave() { SND.music(false); engine(0); },
    update,
    drawWorld() {
      g.save(); g.translate(-Math.round(st.cam), 0);
      hills();
      const y0 = wires();
      birds(y0);
      street();
      yardFriends();
      const tr = st.truck;
      const cv = paint('garbage', 120, 80, 60, 74, () => truckArt({ fill: st.fill, gate: tr.gate, spin: tr.spin, honk: tr.honk }));
      blit(cv, tr.x + (tr.shake > 0 ? Math.round(Math.sin(T * 50)) : 0), Y.yR, 1, 1);
      for (const it of st.items) if (it.delay <= 0) R(Math.round(it.x), Math.round(it.y), it.w, it.h, it.c);
      // the arm and the bin it's holding
      if (tr.arm) {
        const pose = armPose(tr.arm);
        if (pose.has) bin(0, tr.arm.kind, { x: pose.g[0], y: pose.g[1], rot: pose.rot });
        drawArm(tr.x, 0, pose.g[0], pose.g[1], pose.grip);
      } else drawArm(tr.x, 0, tr.x + 6, Y.yR - 18, false);
      bins();
      if (st.coon) raccoon(st.coon);
      g.restore();
    },
    drawLit() {
      const k = nightK();
      if (k > 0.05) {
        g.save(); g.translate(-Math.round(st.cam), 0);
        const tr = st.truck;
        alpha(k * 0.25, () => { for (let i = 0; i < 26; i++) R(tr.x + 47 + i, Y.yR - 25 + i * 0.25, 1, Math.max(1, i * 0.5), '#fff6c8'); });
        // lit windows up and down the street
        for (let seg = Math.max(0, Math.floor((st.cam - 40) / SEG)); seg <= Math.floor((st.cam + W + 40) / SEG); seg++)
          for (let i = 0; i < PER; i++) { const x = houseX(seg, i); if (hsh(seg * 5 + i) > 0.35) alpha(k * 0.8, () => { R(x - 20, Y.yR - 33, 8, 7, '#ffe27a'); R(x + 12, Y.yR - 33, 8, 7, '#ffe27a'); }); }
        g.restore();
      }
      if (Math.floor(T * 3) % 2) alpha(0.4 + 0.5 * k, () => circle(st.truck.x - st.cam + 31, Y.yR - 43, 3, '#ffb040'));
      drawParticles();
    },
    drawUI() {
      const tr = st.truck;
      if (tr.state === 'wait' && st.idle > 2) {
        const z = Math.max(1, Math.round(Math.min(W, H) / 110));
        hand(binX(st.seg, st.i) - st.cam + 2, Y.yR - 6, z, Math.floor(T * 2) % 2);
      }
      drawHomeButton(Y.home);
    },
    tap(x, y) {
      if (inBox(Y.home, x, y)) { goScene('station'); return true; }
      st.idle = 0;
      const wx = x + st.cam, tr = st.truck;
      // birds on the wire
      for (const b of st.birds) if (b.fly <= 0 && Math.abs(wx - b.x) < 8 && Math.abs(y - (Y.yR - 96)) < 14) { scatterBirds(); return true; }
      if (PETS.tap('trash', x, y)) return true;
      // the dogs and the kid
      const seg = Math.floor(wx / SEG), dx = houseX(seg, 2);
      if (Math.abs(wx - dx) < 30 && y > Y.yR - 60 && y < Y.yR - 14) { st.dogs.bark = 0.5; st.dogs.hop = 6; SND.play('bark'); setTimeout(() => SND.play('bark2'), 250); return true; }
      if (Math.abs(wx - (houseX(seg, 4) - 18)) < 8 && y > Y.yR - 42 && y < Y.yR - 14) { st.kid.cheer = 1.5; tone('sine', 880, 0, 0.12, 0.07); tone('sine', 1175, 0.12, 0.2, 0.07); return true; }
      // the truck itself: honk!
      if (Math.abs(wx - tr.x) < 46 && y > Y.yR - 50 && y < Y.yR && tr.state !== 'wait') { honk(); return true; }
      if (tr.state === 'wait') { if (!startArm()) honk(); return true; }
      if (tr.state === 'drive' || tr.state === 'pause' || tr.state === 'crunch') honk();
      return true;
    },
    _st: st,
    card(x, yb) {
      const cv = paint('garbageCard', 120, 80, 60, 74, () => truckArt({ fill: 3, gate: 0, spin: 0, honk: 0 }));
      blit(cv, x, yb, 1, 1);
    },
  };
  function honk() {
    const tr = st.truck;
    if (tr.honk > 0.4) return;
    tr.honk = 1.2; SND.play('honk'); st.kid.cheer = 1.5; scatterBirds();
  }
  function scatterBirds() { for (const b of st.birds) if (b.fly <= 0) { b.fly = 2.5; b.away = true; b.vx = rand(20, 40); b.vy = -rand(20, 35); b.y = 0; } SND.play('boing', 1.4); }
})();
