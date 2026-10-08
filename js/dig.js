// "Dig & Dump": a construction site. A tap and the digger scoops sand, dirt or rocks into the
// big yellow dump truck. When the bed is full the truck drives off to the building spot, turns
// around, backs up (beep, beep, beep!), tips its bed and pours the load out. Three loads build
// something wonderful: a sandcastle, a grassy hill with a slide, or a mountain with a train
// tunnel, and then a fresh pile arrives for the next one.
'use strict';
(() => {
  const { poly, bar, turn, oval, hsh, paint, blit, eye, arrow, hand } = TOY;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const eio = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const eout = k => 1 - (1 - k) ** 3;
  const Y1 = '#f2b51c', Y2 = '#ffd34d', Y3 = '#c98a10', Y4 = '#8a5a08', STEEL = '#5a5e6a', DARK = '#2f3240', CHROME = '#cfd6dd';

  /* ---------- what gets dug, and what it builds ---------- */
  const MAT = [
    { key: 'sand', c: ['#f2d27a', '#dcb55c', '#fff0b8', '#c8963e'], rate: 1.25 },
    { key: 'dirt', c: ['#8a5a32', '#6e4424', '#a8764a', '#4e3018'], rate: 1 },
    { key: 'rocks', c: ['#9a958d', '#77736c', '#c4bfb6', '#55514b'], rate: 0.85 },
  ];
  // a heap of material sitting on yb, r wide each way and h tall
  function heapTop(x, r, h, seed) { const k = 1 - (x / r) ** 2; return k <= 0 ? 0 : h * Math.sqrt(k) * (0.9 + 0.1 * Math.sin(x * 0.7 + seed)); }
  function heap(cx, yb, r, h, m, seed = 1) {
    if (h < 0.6) return;
    const c = MAT[m].c;
    cx = Math.round(cx);
    for (let x = -r; x <= r; x++) {
      const hh = Math.round(heapTop(x, r, h, seed));
      if (hh <= 0) continue;
      R(cx + x, yb - hh, 1, hh, x > r * 0.3 ? c[1] : c[0]);
      if (x < r * 0.2) R(cx + x, yb - hh, 1, 1, c[2]);
    }
    const n = Math.round(r * h / (m === 2 ? 9 : 14));
    for (let i = 0; i < n; i++) {
      const fx = (hsh(seed + i * 1.7) * 2 - 1) * r * 0.92, top = heapTop(fx, r, h, seed);
      if (top < 2) continue;
      const fy = yb - 1 - hsh(seed + i * 3.3) * (top - 1);
      if (m === 2) { const rr = 1 + (i % 3 === 0); circle(cx + fx, fy, rr, c[i % 2 ? 3 : 1]); R(cx + fx - rr + 1, fy - rr + 1, 1, 1, c[2]); }
      else R(cx + fx, fy, 1 + (i % 4 === 0), 1, c[i % 3 === 0 ? 2 : 3]);
    }
  }

  /* ---------- world layout (world units: x along the site, y up from the ground = 0) ---------- */
  const PX = 30, PR = 28;           // the pile
  const DX = 86;                    // the digger
  const TPARK = 162;                // where the truck waits to be loaded (its middle)
  const MX = 470, WW = 548;         // the building spot, and the whole site's width
  const TURN_GO = 330, TURN_BACK = 236, DUMP_AT = MX - 55;
  const LOAD_CX = 106;              // the middle of the loading area
  const CONES = [{ x: 8, y: 12 }, { x: 214, y: 14 }, { x: 286, y: 9 }, { x: 532, y: 12 }];

  const Y = {};
  function layout() {
    const room = H - L.safeT - L.safeB;
    const fore = Math.max(24, Math.min(210, Math.round(room * (room > 250 ? 0.42 : 0.24))));   // tall screens show what's underground
    Y.yG = H - L.safeB - fore;      // where the wheels touch the ground
    Y.hz = Y.yG - 40;               // the back fence / horizon
    Y.home = { x: L.safeL + 4, y: H - L.safeB - L.blob - 4, s: L.blob };
  }

  /* ---------- state ---------- */
  const st = {
    cam: 0, m: 0, pile: 1, idle: 0, made: 0,
    truck: { x: TPARK, dir: 1, state: 'park', v: 0, spin: 0, tilt: 0, fill: 0, fm: 0, t: 0, turnFrom: 1, wait: 0, hop: 0, honk: 0 },
    dig: { state: 'rest', t: 0, q: 0, face: -1, tx: 32, ty: -38, rot: -0.2, carry: 0, cm: 0, wig: 0, tread: 0 },
    site: { m: 0, loads: 0, done: false, t: 0, clear: 0, om: 0 },
    bits: [], cones: CONES.map(c => ({ ...c, hop: 0 })), builder: { wave: 0, cheer: 0 }, mixer: { spin: 0, fast: 0 },
  };

  /* ---------- sounds ---------- */
  const SND = TOY.bank({
    scoop: ['dig-scoop', 0.7], rocks: ['dig-rocks', 0.7], rocks2: ['dig-rocks2', 0.7], dump: ['dig-dump', 0.8], boing: ['dig-boing', 0.6],
    engine: ['dig-engine', 0.55], honk: ['bt-honk', 0.6], beep: ['bt-beep', 0.5], squeak: ['bath-squeak', 0.5],
  }, {
    scoop() { noise(0, 0.3, 0.12, 700, 0.8); },
    rocks() { for (let i = 0; i < 5; i++) noise(i * 0.05, 0.05, 0.1, 1600, 1.2); },
    rocks2() { for (let i = 0; i < 5; i++) noise(i * 0.06, 0.05, 0.1, 1300, 1.2); },
    dump() { noise(0, 0.9, 0.18, 500, 0.6); },
    boing() { tone('sine', 300, 0, 0.3, 0.12, 700); },
    honk() { SFX.honk(); }, beep() { SFX.beep(); }, squeak() { tone('sine', 1400, 0, 0.15, 0.08, 1900); },
  }, 'dig-music', 0.16);
  const engine = SND.loop('engine');
  const beeper = { t: 0 };
  function hydraulic(up) { tone('sawtooth', up ? 110 : 200, 0, 1.1, 0.025, up ? 230 : 100); noise(0, 1, 0.03, 2400, 1); }
  function armWhirr() { tone('sawtooth', 150, 0, 0.35, 0.018, 210); }

  /* ---------- the digger ---------- */
  const P0 = [15, -24], L1 = 32, L2 = 27;
  // bucket hinge positions for a pose, in the digger's own frame (+x = the way it faces)
  const REST = [32, -38], HIGH = [25, -46], OVER = [55, -51];
  function pileTop() { return Math.max(4, 6 + 24 * st.pile); }
  // the scoop: [name, seconds]
  const STEPS = [['reach', 0.42], ['dig', 0.5], ['lift', 0.4], ['swing', 0.5], ['over', 0.38], ['tip', 0.45], ['back', 0.3], ['swing2', 0.5]];
  const STEP_END = []; { let t = 0; for (const [, d] of STEPS) STEP_END.push(t += d); }
  const SCOOP_T = STEP_END[STEP_END.length - 1];
  function ik(tx, ty) {
    const dx = tx - P0[0], dy = ty - P0[1];
    const d = Math.max(Math.abs(L1 - L2) + 1, Math.min(L1 + L2 - 0.3, Math.hypot(dx, dy)));
    const a = Math.atan2(dy, dx), b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const a1 = a - b, e1 = [P0[0] + Math.cos(a1) * L1, P0[1] + Math.sin(a1) * L1];
    const a2 = Math.atan2(ty - e1[1], tx - e1[0]);
    return { e1, e2: [e1[0] + Math.cos(a2) * L2, e1[1] + Math.sin(a2) * L2], a1, a2 };
  }
  function digPose() {   // where the bucket is at this moment of the scoop
    const d = st.dig, t = d.t, pt = pileTop();
    const approach = [50, -pt - 4], inPile = [35, -Math.max(4, pt * 0.45)];
    const seg = i => clamp01((t - (i ? STEP_END[i - 1] : 0)) / STEPS[i][1]);
    let p = REST, rot = -0.2, face = -1;
    if (d.state !== 'scoop') return { p: [d.tx, d.ty], rot: d.rot, face: d.face };
    if (t < STEP_END[0]) { const k = eio(seg(0)); p = [lerp(REST[0], approach[0], k), lerp(REST[1], approach[1], k)]; rot = lerp(-0.2, -1.4, k); }
    else if (t < STEP_END[1]) { const k = eio(seg(1)); p = [lerp(approach[0], inPile[0], k), lerp(approach[1], inPile[1], k) + Math.sin(k * Math.PI) * 6]; rot = lerp(-1.4, 0.1, k); }
    else if (t < STEP_END[2]) { const k = eio(seg(2)); p = [lerp(inPile[0], HIGH[0], k), lerp(inPile[1], HIGH[1], k)]; rot = 0.1; }
    else if (t < STEP_END[3]) { const k = seg(3); p = HIGH; rot = 0.1; face = Math.cos(Math.PI * eio(k)) * -1; }
    else if (t < STEP_END[4]) { const k = eio(seg(4)); p = [lerp(HIGH[0], OVER[0], k), lerp(HIGH[1], OVER[1], k)]; rot = 0.1; face = 1; }
    else if (t < STEP_END[5]) { const k = eio(seg(5)); p = OVER; rot = lerp(0.1, -2.3, k); face = 1; }
    else if (t < STEP_END[6]) { const k = eio(seg(6)); p = [lerp(OVER[0], HIGH[0], k), lerp(OVER[1], HIGH[1], k)]; rot = lerp(-2.3, -0.5, k); face = 1; }
    else { const k = seg(7); p = [lerp(HIGH[0], REST[0], eio(k)), lerp(HIGH[1], REST[1], eio(k))]; rot = lerp(-0.5, -0.2, k); face = Math.cos(Math.PI * eio(k)); }
    return { p, rot, face };
  }
  // the bucket: hinge at (0, 0); opening faces up when rot = 0, tips out as rot grows
  // (the bucket hangs back toward the cab: rot 0 holds a load, about -1.4 digs, about -2.3 pours)
  const MIR = pts => pts.map(([a, b]) => [-a, b]);
  const CUP = MIR([[0, -1], [13, 1], [15, 3], [13, 7], [8, 10], [2, 9], [-1, 5]]);
  const CUP_IN = MIR([[2, 0], [12, 2], [11, 6], [7, 8], [3, 7], [1, 4]]);
  function bucket(x, y, rot, carry, m) {
    const T_ = pts => turn(pts, rot, 0, 0, x, y);
    poly(T_(CUP.map(([a, b]) => [a - 0.6, b + 0.6])), '#3a3d46');
    poly(T_(CUP), STEEL);
    if (carry > 0 && rot > -0.8) {
      const c = MAT[m].c, hgt = 7 * carry;
      poly(T_(MIR([[0, -1], [3, -1 - hgt], [8, -2 - hgt], [12, -hgt * 0.6], [14, 1.5]])), c[0]);
      for (const [a, b, cc] of [[-4, -1 - hgt * 0.7, 2], [-8, -1.5 - hgt * 0.5, 3], [-11, -0.5 - hgt * 0.3, 1]]) { const [q] = T_([[a, b]]); R(q[0], q[1], 1, 1, c[cc]); }
    } else poly(T_(CUP_IN), DARK);
    for (const k of [0, 1, 2]) { const tip = T_(MIR([[14.5 + k * 0.2, 1.5 + k * 2], [17, 2.5 + k * 2], [14.5, 3 + k * 2]])); poly(tip, CHROME); }
  }
  // the turning part of the digger (cab, arm, bucket), painted facing right
  function diggerUpper(pose, carry, m) {
    // counterweight, house and cab
    poly([[-24, -27], [-14, -29], [-14, -14], [-24, -15], [-26, -21]], Y3);
    R(-18, -29, 34, 15, Y1); R(-18, -29, 34, 2, Y2); R(-18, -16, 34, 2, Y3); R(-12, -26, 1, 9, Y3);
    R(-14, -35, 2, 6, '#5a5650'); R(-15, -36, 4, 2, '#3a3d46');                     // exhaust
    R(0, -42, 15, 28, Y1); R(-1, -43, 17, 2, Y3); R(0, -42, 15, 1, Y2);            // cab
    R(2, -39, 11, 11, '#4a4f5c'); R(3, -38, 9, 9, GLASS); R(4, -37, 1, 5, '#ffffff');
    eye(9, -34, 3, 1, 'happy');
    R(5, -46, 4, 3, '#f57a12'); R(6, -47, 2, 1, '#ffb27a');                         // beacon
    R(2, -24, 11, 1, Y3); R(0, -19, 15, 1, Y3);
    // the arm: boom, cylinders, stick, bucket
    const k = ik(pose.p[0], pose.p[1]), [e1x, e1y] = k.e1, [e2x, e2y] = k.e2;
    const bm = [lerp(P0[0], e1x, 0.45), lerp(P0[1], e1y, 0.45)];
    bar(6, -30, bm[0], bm[1], 3, '#8a939d'); bar(6, -30, lerp(6, bm[0], 0.55), lerp(-30, bm[1], 0.55), 3, CHROME);
    bar(P0[0], P0[1], e1x, e1y, 8, Y4, true); bar(P0[0], P0[1], e1x, e1y, 6, Y1, true);
    bar(P0[0], P0[1] - 2, e1x, e1y - 2, 1, Y2);
    const sm = [lerp(e1x, e2x, 0.15), lerp(e1y, e2y, 0.15)];
    bar(bm[0] + 2, bm[1] - 3, sm[0], sm[1] - 3, 2, CHROME);
    bucket(e2x, e2y, pose.rot, carry, m);
    bar(e1x, e1y, e2x, e2y, 6, Y4, true); bar(e1x, e1y, e2x, e2y, 4, Y1, true);
    circle(e1x, e1y, 2, '#8a939d'); circle(e2x, e2y, 2, '#8a939d'); circle(P0[0], P0[1], 2, '#8a939d');
    return k;
  }
  function tracks(x, tread) {
    const P = (dx, dy, w, h, c) => R(x + dx, dy, w, h, c);
    circle(x - 21, -6, 6, '#2a2c33'); circle(x + 21, -6, 6, '#2a2c33'); P(-21, -12, 42, 12, '#2a2c33');
    P(-20, -10, 40, 8, '#4a4e5a'); circle(x - 21, -6, 3, '#8a939d'); circle(x + 21, -6, 3, '#8a939d');
    for (let k = 0; k < 4; k++) circle(x - 11 + k * 7, -4, 2, '#8a939d');
    const off = Math.floor(tread) % 4;
    for (let i = 0; i < 11; i++) { P(-20 + ((i * 4 + off) % 42), -12, 2, 1, '#55596a'); P(-20 + ((i * 4 + 42 - off) % 42), -1, 2, 1, '#1d1e24'); }
    P(-14, -15, 28, 3, STEEL); P(-14, -15, 28, 1, '#8a939d');
  }

  /* ---------- the dump truck (82 long, painted facing right, origin at the middle of its wheels) ---------- */
  const BED = [[-41, -38], [8, -38], [10, -40], [12, -40], [12, -14], [-41, -14]];
  function truckArt(o) {
    const tilt = o.tilt || 0, hinge = [-40, -14], TB = pts => turn(pts, -tilt, hinge[0], hinge[1], hinge[0], hinge[1]);
    R(-41, -14, 82, 3, '#3a3d46');                                                 // chassis
    R(9, -50, 2, 36, '#8a8680'); R(8, -51, 4, 2, '#5a5650');                       // exhaust stack
    // cab and hood
    R(13, -37, 15, 3, Y3); R(13, -34, 15, 22, Y1); R(13, -34, 15, 1, Y2);
    R(15, -32, 11, 9, '#4a4f5c'); R(16, -31, 9, 7, GLASS); R(17, -30, 1, 5, '#ffffff');
    R(13, -21, 15, 1, Y3); R(25, -19, 2, 1, Y4);
    for (let i = 0; i < 3; i++) R(15 + i * 4, -39, 2, 2, '#f57a12');
    R(28, -27, 12, 15, Y1); R(28, -27, 12, 2, Y2); R(28, -14, 12, 2, Y3);
    R(39, -25, 3, 11, '#5a5650'); for (let i = 0; i < 3; i++) R(39, -23 + i * 3, 3, 1, '#8a8680');
    R(37, -12, 6, 3, '#9aa3ad'); R(39, -26, 2, 2, '#fff6c8');
    eye(34, -21, 3, 1, o.mood || 'happy');
    R(31, -16, 5, 1, Y4);                                                           // smile
    // the bed, its ram, and the load
    if (tilt > 0.02) { const [rb] = TB([[-6, -16]]); bar(-6, -13, rb[0], rb[1], 3, CHROME); bar(-6, -13, lerp(-6, rb[0], 0.45), lerp(-13, rb[1], 0.45), 4, '#8a939d'); }
    if (o.fill > 0.01) {
      const c = MAT[o.m].c, h = 4 + 9 * Math.min(1, o.fill), pts = [];
      for (let x = -39; x <= 7; x += 2) pts.push([x, -38 - h * Math.sin(Math.PI * (x + 39) / 46) - (o.fill > 0.4 ? hsh(x + o.m) * 1.5 : 0)]);
      pts.push([7, -37], [-39, -37]);
      poly(TB(pts), c[0]);
      for (let i = 0; i < 16 * o.fill; i++) {
        const fx = -37 + hsh(i * 2.3 + o.m) * 42, top = h * Math.sin(Math.PI * (fx + 39) / 46);
        const [q] = TB([[fx, -38 - hsh(i * 5.1) * top]]);
        if (o.m === 2) { circle(q[0], q[1], 1, c[i % 2 ? 3 : 1]); } else R(q[0], q[1], 1, 1, c[i % 3 ? 3 : 2]);
      }
    }
    poly(TB(BED), Y4);
    poly(TB([[-40, -37], [8, -37], [11, -39], [11, -15], [-40, -15]]), Y1);
    poly(TB([[-40, -37], [8, -37], [9, -36], [-40, -36]]), Y2);
    for (const rx of [-30, -17, -4]) poly(TB([[rx, -36], [rx + 2, -36], [rx + 2, -16], [rx, -16]]), Y3);
    poly(TB([[-40, -17], [11, -17], [11, -15], [-40, -15]]), Y3);
    poly(TB([[-42, -37], [-40, -37], [-40, -14], [-42, -14]]), Y3);            // tailgate edge
    // wheels
    for (const wx of [-28, -13, 29]) {
      circle(wx, -7, 7, '#1d1a2b'); circle(wx, -7, 4, '#9aa3ad'); circle(wx, -7, 2, '#5a5e6a');
      const a = o.spin || 0; R(wx + Math.round(Math.cos(a) * 4), -7 + Math.round(Math.sin(a) * 4), 1, 1, '#1d1a2b');
    }
    R(-41, -15, 3, 3, '#e8222b');                                                  // tail light
  }
  // where the bed's back lip is (truck frame) for the current tilt
  const lipPt = tilt => turn([[-41, -36]], -tilt, -40, -14, -40, -14)[0];

  /* ---------- background ---------- */
  function skyline() {
    const par = 0.22, off = st.cam * par, base = Y.hz + 2;
    for (let i = Math.floor((off - 60) / 23); i < Math.ceil((off + W + 60) / 23); i++) {
      const tall = Math.max(10, Math.min(56, (base - L.safeT) * 0.42, base - L.sunY - 24)), bw = 14 + Math.floor(hsh(i) * 10), bh = Math.round(tall * (0.4 + 0.6 * hsh(i * 3.7))), x = Math.round(i * 23 - off);
      R(x, base - bh, bw, bh, i % 2 ? '#b9c6dc' : '#aebcd4');
      for (let wy = base - bh + 4; wy < base - 4; wy += 5) for (let wx = x + 3; wx < x + bw - 3; wx += 4) R(wx, wy, 2, 2, '#d8e2f0');
    }
  }
  function crane() {
    const par = 0.45, x = Math.round(64 - st.cam * par), base = Y.hz + 2;
    const top = Math.max(L.safeT + 26, base - Math.min(170, Math.max(80, (base - L.safeT) * 0.75)));
    const C1 = '#f2a51c', C2 = '#c97a10';
    // the mast: a lattice tower
    R(x - 4, top, 2, base - top, C1); R(x + 3, top, 2, base - top, C1);
    for (let y = top + 2; y < base; y += 8) { for (let k = 0; k < 8; k++) R(x - 3 + Math.round(k * 7 / 8), y + k, 1, 1, C2); R(x - 4, y, 9, 1, C2); }
    // jib and counter-jib
    R(x - 24, top - 2, 92, 3, C1); R(x - 24, top + 1, 92, 1, C2);
    for (let k = 0; k < 18; k++) R(x - 22 + k * 5, top - 1, 1, 2, C2);
    R(x - 24, top + 2, 10, 6, '#8a8680'); R(x - 4, top - 10, 9, 8, C1); R(x - 2, top - 8, 5, 4, GLASS);
    R(x, top - 18, 1, 8, C2);
    // a trolley that rolls along, with a hook and a swinging steel beam
    const tx = Math.round(x + 22 + (Math.sin(T * 0.25) * 0.5 + 0.5) * 38), len = Math.round((base - top) * 0.45 + Math.sin(T * 0.4) * 8);
    R(tx - 3, top + 2, 7, 3, '#5a5650');
    const sway = Math.sin(T * 1.1) * 3, hx = Math.round(tx + sway), hy = top + 5 + len;
    for (let k = 0; k < len; k += 2) R(Math.round(tx + sway * k / len), top + 5 + k, 1, 2, '#3a3d46');
    R(hx - 1, hy, 3, 3, '#3a3d46');
    R(hx - 14, hy + 3, 29, 3, '#d8452a'); R(hx - 14, hy + 3, 29, 1, '#f26a4a');
  }
  function fence() {
    R(-60, -30, WW + 120, 30, '#d2a46a');
    for (let x = 0; x < WW; x += 9) R(x + (x * 7) % 5, -26 + (x * 13) % 22, 3, 1, '#c3935a');
    // an orange safety fence along the back
    for (let x = -60; x < WW + 60; x += 2) R(x, -38 + (x % 4 === 0 ? 0 : 1), 1, 1, '#f57a12');
    R(-60, -37, WW + 120, 1, '#f57a12'); R(-60, -31, WW + 120, 1, '#f57a12');
    for (let x = -60; x < WW + 60; x += 6) for (let y = -36; y < -31; y += 2) R(x + (y & 2), y, 1, 1, '#ff9a3a');
    for (let x = -60; x < WW + 60; x += 32) R(x, -40, 2, 11, '#8a6a4a');
  }
  function ground() {
    // the top of the ground, where the vehicles drive
    R(-60, 0, WW + 120, 15, '#c08a52');
    R(-60, 0, WW + 120, 1, '#a8743f');
    for (let i = 0; i < WW / 4; i++) R(Math.round(hsh(i) * WW), 2 + Math.round(hsh(i * 2.1) * 10), 2 + (i % 3), 1, i % 2 ? '#a8743f' : '#d09a62');
    for (let x = 140; x < MX - 30; x += 4) { R(x, 3, 2, 1, '#a06a38'); R(x + 1, 7, 2, 1, '#a06a38'); }   // tyre tracks
    // underneath: layers of soil, clay and rock, and the things buried in them
    const deep = H - Y.yG;
    if (deep <= 15) return;
    const x0 = Math.floor(st.cam) - 4, x1 = Math.ceil(st.cam + W) + 4;
    R(x0, 15, x1 - x0, deep, '#9a6538');
    for (let x = x0 - (x0 & 1); x < x1; x += 2) {
      const a = Math.round(62 + 4 * Math.sin(x * 0.06)), b = Math.round(112 + 5 * Math.sin(x * 0.045 + 1));
      R(x, a, 2, deep, '#b8804a'); R(x, b, 2, deep, '#8f8a84'); R(x, a, 2, 1, '#8a5a32'); R(x, b, 2, 1, '#6e6a64');
    }
    R(x0, 15, x1 - x0, 1, '#8a5a32');
    for (let i = 0; i < 160; i++) {
      const x = Math.round(hsh(i * 3.3) * (WW + 80) - 40), y = 17 + Math.round(hsh(i * 7.7) * 220);
      if (x < x0 || x > x1 || y > deep) continue;
      if (y < 62) R(x, y, 2, 1, i % 2 ? '#8a5a32' : '#b07a44');
      else if (y < 112) { R(x, y, 3, 2, '#8a8680'); R(x, y, 2, 1, '#b5b0a8'); }
      else R(x, y, 2 + (i % 3), 1, '#6e6a64');
    }
    for (const u of st.under) if (u.y - 14 < deep) UNDER_DRAW[u.k](u);
  }
  // the buried things: tap them and they wiggle, pop or sparkle
  const UNDER = [
    ['worm', 40, 26], ['worm', 150, 46], ['worm', 330, 30], ['worm', 505, 52], ['worm', 255, 88],
    ['mole', 198, 36], ['fossil', 82, 84], ['fossil', 430, 92], ['chest', 160, 132], ['chest', 372, 150],
    ['gem', 26, 150], ['gem', 120, 176], ['gem', 236, 140], ['gem', 300, 190], ['gem', 470, 160], ['gem', 540, 140],
    ['gem', 70, 200], ['gem', 196, 186], ['gem', 150, 220], ['gem', 40, 236], ['gem', 410, 210], ['chest', 96, 226],
    ['pipe', 330, 22],
  ];
  st.under = UNDER.map(([k, x, y], i) => ({ k, x, y, t: 0, i }));
  const UNDER_DRAW = {
    worm(u) {
      const sp = u.t > 0 ? 9 : 2.5, n = 7;
      for (let i = n - 1; i >= 0; i--) {
        const x = u.x - i * 2.6 + Math.sin(T * sp - i * 0.8 + u.i) * 0.8, y = u.y + Math.sin(T * sp * 0.9 - i * 1.1 + u.i) * 2;
        circle(x, y, 2, i % 2 ? '#ff8fb8' : '#ffa0c4'); R(x - 1, y + 1, 2, 1, '#e8608f');
      }
      const hx = u.x + Math.sin(T * sp + u.i) * 0.8, hy = u.y + Math.sin(T * sp * 0.9 + u.i) * 2;
      R(hx, hy - 1, 1, 1, INK); if (u.t > 0) R(hx + 1, hy + 1, 1, 1, '#a3121d');
    },
    mole(u) {
      const up = u.t > 0 ? Math.sin(Math.min(1, (1.2 - u.t) / 1.2) * Math.PI) * 18 : 0;
      oval(u.x, u.y, 12, 7, '#5a3418'); R(u.x - 3, 15, 7, u.y - 16, '#5a3418');   // its burrow and tunnel
      const y = Math.round(u.y + 2 - up);
      oval(u.x, y - 2, 7, 5, '#5e504a'); oval(u.x - 1, y - 3, 5, 3, '#7a6a62');
      R(u.x + 5, y - 3, 3, 2, '#ff8fb8'); R(u.x + 1, y - 4, 2, 1, INK);
      R(u.x - 6, y + 1, 3, 2, '#ffb0c8'); R(u.x + 3, y + 1, 3, 2, '#ffb0c8');
      if (u.t > 0) { R(u.x + 2, y - 7, 1, 2, '#ffd21f'); R(u.x - 2, y - 8, 1, 2, '#ffd21f'); }
    },
    fossil(u) {
      const j = u.t > 0 ? Math.round(Math.sin(T * 30) * 1.5) : 0, x = u.x + j, y = u.y, B = '#f4ecd8', D = '#cfc2a4';
      oval(x, y, 26, 10, '#8a5a32'); oval(x, y, 24, 8, '#a8743f');
      R(x + 10, y - 7, 10, 6, B); R(x + 18, y - 5, 4, 3, B); R(x + 12, y - 1, 9, 2, B); R(x + 13, y - 6, 2, 2, '#8a5a32');
      for (let k = 0; k < 4; k++) R(x + 13 + k * 2, y - 2, 1, 1, '#8a5a32');
      for (let k = 0; k < 9; k++) R(x + 8 - k * 3, y - 4 + Math.round(Math.abs(k - 3) * 0.4), 2, 2, B);
      for (let k = 0; k < 4; k++) R(x + 2 - k * 3, y - 2, 1, 4 - (k % 2), D);
      R(x - 2, y + 1, 2, 5, B); R(x + 3, y + 1, 2, 5, B); R(x - 3, y + 5, 3, 1, B); R(x + 3, y + 5, 3, 1, B);
      R(x + 7, y - 1, 3, 1, B); R(x + 9, y, 1, 2, B);
    },
    chest(u) {
      const x = u.x, y = u.y, open = u.t > 0;
      R(x - 8, y - 6, 16, 9, '#8a5a32'); R(x - 8, y - 6, 16, 1, '#a8743f'); R(x - 8, y - 2, 16, 1, '#ffd21f'); R(x - 1, y - 3, 2, 3, '#ffd21f');
      if (open) {
        R(x - 8, y - 15, 16, 3, '#8a5a32'); R(x - 8, y - 12, 16, 1, '#ffd21f');
        R(x - 7, y - 8, 14, 2, '#ffd21f'); for (let k = 0; k < 5; k++) R(x - 6 + k * 3, y - 9, 2, 1, '#fff27a');
        if (Math.floor(T * 6) % 2) { R(x - 4, y - 18, 1, 3, '#fff6b0'); R(x - 5, y - 17, 3, 1, '#fff6b0'); R(x + 4, y - 20, 1, 3, '#fff6b0'); R(x + 3, y - 19, 3, 1, '#fff6b0'); }
      } else { R(x - 8, y - 9, 16, 3, '#a8743f'); R(x - 8, y - 9, 16, 1, '#c8945a'); R(x - 8, y - 7, 16, 1, '#ffd21f'); }
    },
    gem(u) {
      const c = ['#7ad0ff', '#ff6fb4', '#3fe28a', '#b48ae8'][u.i % 4], x = u.x, y = u.y, big = u.t > 0 ? 2 : 0, n = 6 + big;
      for (let k = 0; k < n; k++) R(x - k, y - n + k, 2 * k + 1, 1, c);
      for (let k = 0; k < n; k++) R(x - (n - 1 - k), y + k, 2 * (n - 1 - k) + 1, 1, k % 3 ? c : mix(c, '#000000', 0.15));
      R(x - 2, y - 3, 2, 3, '#ffffff');
      if ((Math.floor(T * 2 + u.i) % 4 === 0) || u.t > 0) { R(x + 3, y - 5, 1, 3, '#ffffff'); R(x + 2, y - 4, 3, 1, '#ffffff'); }
    },
    pipe(u) {
      R(230, u.y - 3, 200, 6, '#3a7ad8'); R(230, u.y - 3, 200, 1, '#7ab0f2'); R(230, u.y + 2, 200, 1, '#2a5aa8');
      for (const jx of [260, 330, 400]) { R(jx - 3, u.y - 4, 6, 8, '#2a5aa8'); R(jx - 3, u.y - 4, 6, 1, '#5a90e0'); }
      R(328, u.y - 10, 4, 6, '#9aa3ad'); R(325, u.y - 12, 10, 2, '#e8222b');
      if (u.t > 0) for (let k = 0; k < 3; k++) { const p = ((1.5 - u.t) * 2 + k / 3) % 1; R(332 + k * 2, u.y + 3 + p * 10, 1, 2, '#7ad0ff'); }
    },
  };
  function cone(c) {
    const x = Math.round(c.x), y = Math.round(c.y - c.hop);
    R(x - 5, y - 1, 11, 2, '#e8622b'); R(x - 3, y - 9, 7, 8, '#f57a12'); R(x - 2, y - 12, 5, 3, '#f57a12'); R(x - 1, y - 14, 3, 2, '#f57a12');
    R(x - 3, y - 7, 7, 2, '#ffffff'); R(x - 2, y - 12, 5, 1, '#ffffff'); R(x - 3, y - 9, 1, 8, '#ff9a5a');
  }
  function mixer() {   // a cement mixer parked by the haul road, its drum always turning
    const x = 268, y = -14, mx = st.mixer;
    R(x - 26, y - 12, 50, 3, '#3a3d46');
    R(x + 10, y - 30, 15, 18, '#e8ecef'); R(x + 12, y - 28, 9, 8, GLASS); R(x + 13, y - 27, 1, 5, '#ffffff'); R(x + 10, y - 30, 15, 2, '#c7ccd3');
    oval(x - 8, y - 22, 16, 9, '#c7ccd3'); oval(x - 8, y - 23, 15, 8, '#e8ecef');
    for (let k = 0; k < 4; k++) {   // spiral stripes sliding along the drum
      const sx = ((k * 9 + mx.spin * 9) % 36) - 18 + x - 8;
      if (sx > x - 22 && sx < x + 6) { R(sx, y - 30, 3, 15, '#e8222b'); R(sx + 1, y - 31, 2, 1, '#e8222b'); }
    }
    R(x - 26, y - 26, 4, 8, '#9aa3ad');
    for (const wx of [x - 16, x - 4, x + 18]) { circle(wx, y - 6, 5, '#1d1a2b'); circle(wx, y - 6, 2, '#9aa3ad'); }
  }
  function builder() {
    const b = st.builder, x = MX + 54, pose = b.cheer > 0 ? 'cheer' : b.wave > 0 || st.truck.state === 'back' ? 'wave' : 'stand';
    drawPerson({ type: 'builder', x, yb: 14, dir: -1, pose, skin: SKIN[2], seed: 3, hop: b.cheer > 0 ? Math.abs(Math.sin(T * 9)) * 3 : 0 });
  }
  OUTFITS.builder = { shirt: '#f57a12', shade: '#d0630a', pants: '#2a4a8a', trim: '#e9f56b', shoes: '#5a3a22', hat: 'helmet', hatC: '#ffd21f' };

  /* ---------- what gets built ---------- */
  function siteDraw() {
    const s = st.site;
    if (s.clear > 0) alpha(s.clear, () => creation(s.om, 1));
    if (!s.done) {
      if (s.loads > 0) heap(MX, 0, 30 + s.loads * 4, 8 + s.loads * 9, s.m, 4);
      else if (s.clear <= 0) {   // a stake with orange flags marks the spot
        R(MX - 1, -16, 2, 16, '#a8743f'); R(MX + 1, -16, 7, 4, '#f57a12'); R(MX + 1, -12, 5, 2, '#f57a12');
        R(MX - 20, -3, 40, 1, '#f2d27a');
      }
      return;
    }
    creation(s.m, eout(clamp01(s.t / 1.4)));
  }
  function creation(m, k) {
    g.save(); g.beginPath(); g.rect(-50, -80 * k + 1, WW + 100, 200); g.clip();
    if (m === 0) castle(); else if (m === 1) slideHill(); else mountain();
    g.restore();
  }
  function castle() {
    const c = MAT[0].c, x = MX;
    heap(x, 0, 42, 9, 0, 2);
    const block = (bx, by, w, h) => { R(bx, by, w, h, c[0]); R(bx + w - 2, by, 2, h, c[1]); R(bx, by, w, 1, c[2]); for (let i = 0; i < w; i += 4) R(bx + i, by - 2, 2, 2, c[0]); };
    block(x - 14, -32, 28, 26);
    block(x - 30, -42, 12, 36); block(x + 18, -42, 12, 36);
    block(x - 5, -50, 10, 18);
    R(x - 4, -16, 8, 10, '#a8743f'); circle(x, -16, 4, '#a8743f'); R(x - 3, -14, 6, 8, '#7a5028');
    for (const [wx, wy] of [[x - 26, -34], [x + 22, -34], [x - 2, -44], [x - 10, -26], [x + 7, -26]]) { R(wx, wy, 3, 4, '#7a5028'); R(wx, wy, 3, 1, '#5a3818'); }
    // a flag on the top tower, rippling
    R(x - 1, -63, 1, 13, '#8a5a32');
    for (let i = 0; i < 9; i++) R(x + i, -63 + Math.round(Math.sin(T * 6 - i * 0.7)), 1, 6 - Math.floor(i / 3), i % 3 ? '#e8222b' : '#ff6a6a');
    // shells and a starfish pressed into the sand
    R(x - 36, -4, 3, 2, '#ffb0c8'); R(x + 34, -5, 3, 2, '#ffffff'); R(x - 18, -3, 2, 2, '#ff8fb8');
    const sx = x + 26, sy = -8; R(sx - 1, sy - 2, 3, 5, '#ff8a3a'); R(sx - 3, sy, 7, 1, '#ff8a3a');
  }
  function slideHill() {
    const x = MX;
    oval(x, 0, 44, 36, '#5aa84c'); oval(x - 4, 0, 40, 34, '#6cbf5a');
    R(x - 46, -1, 92, 2, '#8a5a32');
    for (let i = 0; i < 22; i++) { const fx = x - 36 + hsh(i) * 72, top = 34 * Math.sqrt(Math.max(0, 1 - ((fx - x) / 44) ** 2)); const fy = -2 - hsh(i * 3.1) * (top - 4); R(fx, fy, 2, 2, ['#ffd21f', '#ff6fb4', '#ffffff', '#e8222b'][i % 4]); }
    drawTree(x + 6, -32, 9);
    // a slide down the left side, a ladder up the right of the platform
    const tx = x - 10, ty = -36;
    R(tx - 6, ty - 2, 14, 3, '#2a6fe0'); R(tx - 6, ty - 10, 1, 8, '#2a6fe0'); R(tx + 7, ty - 10, 1, 8, '#2a6fe0'); R(tx - 6, ty - 10, 14, 1, '#2a6fe0');
    bar(tx - 6, ty, x - 46, -2, 4, '#e8222b'); bar(tx - 6, ty - 3, x - 46, -5, 1, '#ff7a7a');
    R(tx + 7, ty, 1, 10, '#9aa3ad'); R(tx + 11, ty, 1, 10, '#9aa3ad'); for (let k = 0; k < 4; k++) R(tx + 7, ty + 2 + k * 2, 5, 1, '#9aa3ad');
    // a kid climbs up, waves, and slides down, again and again
    const ph = (T * 0.4) % 1;
    let kx, ky, pose = 'stand', dir = -1;
    if (ph < 0.35) { const k = ph / 0.35; kx = tx + 9; ky = ty + 10 - k * 10; pose = 'slide'; }
    else if (ph < 0.5) { kx = tx; ky = ty - 1; pose = 'cheer'; }
    else if (ph < 0.75) { const k = eio((ph - 0.5) / 0.25); kx = lerp(tx - 6, x - 44, k); ky = lerp(ty - 1, -3, k); pose = 'sit'; }
    else { kx = x - 46 + (ph - 0.75) * 40; ky = 0; pose = 'cheer'; dir = 1; }
    if (ph < 0.75 || ph > 0.8) drawPerson({ type: 'kid3', x: kx, yb: ky + (pose === 'sit' ? -6 : 0), dir, pose, skin: SKIN[1], seed: 2 });
  }
  function mountain() {
    const x = MX, c = MAT[2].c;
    poly([[x - 50, 0], [x - 22, -44], [x - 10, -52], [x + 4, -60], [x + 18, -46], [x + 30, -34], [x + 50, 0]], c[1]);
    poly([[x - 46, 0], [x - 22, -42], [x - 10, -50], [x + 4, -58], [x + 8, -40], [x - 4, 0]], c[0]);
    poly([[x - 10, -50], [x + 4, -58], [x + 18, -46], [x + 12, -42], [x + 6, -46], [x, -42], [x - 6, -46]], '#ffffff');
    for (let i = 0; i < 30; i++) { const fx = x - 40 + hsh(i * 1.3) * 80, top = 58 * (1 - Math.abs(fx - x - 2) / 50); if (top < 6) continue; const fy = -2 - hsh(i * 2.9) * (top - 10); circle(fx, fy, 1 + (i % 3 === 0), c[i % 2 ? 3 : 2]); }
    // the railway, the tunnel, and a little train going round and round
    R(x - 90, -3, 180, 1, '#5a3a22'); for (let k = -88; k < 90; k += 4) R(x + k, -2, 2, 2, '#7a5028'); R(x - 90, -1, 180, 1, '#5a3a22');
    const portal = px => { circle(px, -12, 8, '#55514b'); R(px - 8, -12, 17, 12, '#55514b'); circle(px, -12, 6, '#1d1a2b'); R(px - 6, -12, 13, 12, '#1d1a2b'); };
    portal(x - 26); portal(x + 26);
    const tx = ((T * 30) % 220) - 110 + x;
    g.save(); g.beginPath(); g.rect(-200, -80, x - 26 + 200, 90); g.rect(x + 26, -80, 400, 90); g.clip();
    train(tx);
    g.restore();
  }
  function train(x) {
    x = Math.round(x);
    const car = (cx, c) => { R(cx - 9, -12, 18, 8, c); R(cx - 9, -12, 18, 1, '#ffffff'); circle(cx - 5, -3, 2, '#1d1a2b'); circle(cx + 5, -3, 2, '#1d1a2b'); };
    car(x - 44, '#3fb43a'); car(x - 24, '#2a6fe0');
    R(x - 12, -18, 10, 14, '#e8222b'); R(x - 10, -16, 6, 5, GLASS); R(x - 2, -12, 12, 8, '#e8222b'); R(x + 4, -17, 3, 5, '#3a3d46'); R(x + 9, -6, 3, 2, '#ffd21f');
    circle(x - 7, -3, 3, '#1d1a2b'); circle(x + 4, -3, 3, '#1d1a2b');
    for (let k = 0; k < 3; k++) { const p = (T * 1.5 + k / 3) % 1; alpha(1 - p, () => circle(x + 5 - p * 10, -20 - p * 12, 2 + p * 2, '#e8ecef')); }
  }

  /* ---------- updates ---------- */
  function poke(u) {
    if (u.t > 0 && u.k !== 'worm' && u.k !== 'gem') return;
    u.t = { worm: 1.2, mole: 1.2, fossil: 0.8, chest: 3, gem: 1, pipe: 1.5 }[u.k];
    if (u.k === 'worm') { tone('sine', 900, 0, 0.08, 0.06, 1300); tone('sine', 1100, 0.1, 0.08, 0.06, 1500); }
    else if (u.k === 'mole') SND.play('squeak');
    else if (u.k === 'fossil') { tone('sawtooth', 180, 0, 0.5, 0.06, 90); noise(0, 0.45, 0.05, 400, 0.8); }
    else if (u.k === 'chest') { [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, i * 0.08, 0.25, 0.08)); }
    else if (u.k === 'gem') { tone('sine', 1568, 0, 0.3, 0.07); tone('sine', 2093, 0.06, 0.3, 0.05); }
    else if (u.k === 'pipe') { for (let i = 0; i < 4; i++) tone('sine', 1200 - i * 150, i * 0.18, 0.08, 0.06, 600); }
    const sx = u.x - st.cam, sy = Y.yG + u.y;
    if (u.k === 'chest' || u.k === 'gem') sparkle(sx, sy - 8, 10, 8, '#fff27a');
  }
  function startScoop() {
    const d = st.dig;
    if (d.state === 'scoop') { d.q = Math.min(2, d.q + 1); return; }
    d.state = 'scoop'; d.t = 0; d.fired = {}; armWhirr();
  }
  function go() {
    const tr = st.truck;
    if (tr.state !== 'park' || tr.fill < 0.99) return;
    tr.state = 'go'; tr.wait = 0; SND.play('honk'); st.builder.cheer = 1;
  }
  function updateDigger(dt) {
    const d = st.dig, tr = st.truck;
    d.wig = Math.max(0, d.wig - dt);
    if (d.state !== 'scoop') {
      d.face = -1; d.tx = REST[0] + Math.sin(T * 2) * 0.5; d.ty = REST[1] - (d.wig > 0 ? Math.abs(Math.sin(d.wig * 12)) * 8 : 0); d.rot = -0.2 + (d.wig > 0 ? Math.sin(d.wig * 14) * 0.6 : 0);
      return;
    }
    const before = d.t;
    d.t += dt;
    const at = x => before < x && d.t >= x;
    if (at(STEP_END[0] + 0.15)) { SND.play('scoop', MAT[st.m].rate); for (let i = 0; i < 10; i++) bit(DX - 30 + Math.random() * 8, -pileTop() * 0.5, rand(-30, 10), rand(-60, -20), st.m, 0); }
    if (at(STEP_END[0] + 0.3)) { st.pile = Math.max(0, st.pile - 1 / 9); d.carry = 1; d.cm = st.m; }
    if (at(STEP_END[2]) || at(STEP_END[3]) || at(STEP_END[5]) || at(STEP_END[6])) armWhirr();
    if (at(STEP_END[4] + 0.12)) {   // tip the bucket: the load drops into the truck bed
      const pose = digPose(), k = ik(pose.p[0], pose.p[1]);
      for (let i = 0; i < 18; i++) bit(DX + k.e2[0] + rand(-3, 6), k.e2[1] + 6, rand(-14, 14), rand(-10, 20), d.cm, -40, 0.25 + i * 0.012);
      d.carry = 0;
      setTimeout(() => SND.play(d.cm === 0 ? 'rocks2' : 'rocks', MAT[d.cm].rate), 120);
      tr.fill = Math.min(1, tr.fill + 1 / 3); tr.fm = d.cm; tr.hop = 1;
    }
    if (d.t >= SCOOP_T) {
      d.state = 'rest';
      if (d.q > 0 && tr.state === 'park' && tr.fill < 0.99 && st.pile > 0.01) { d.q--; startScoop(); }
      else d.q = 0;
    }
    d.tread = 0;
  }
  function bit(x, y, vx, vy, m, floor, delay = 0) { st.bits.push({ x, y, vx, vy, m, floor, delay, c: MAT[m].c[Math.random() * 4 | 0], life: 2 }); }
  function updateTruck(dt) {
    const tr = st.truck;
    tr.hop = Math.max(0, tr.hop - dt * 4); tr.honk = Math.max(0, tr.honk - dt);
    const drive = (target, speed, reverse) => {
      const d = target - tr.x, dirMove = Math.sign(d);
      tr.v = lerp(tr.v, Math.min(speed, Math.abs(d) * 2 + 6), Math.min(1, dt * 2.5));
      const step = Math.min(Math.abs(d), tr.v * dt);
      tr.x += dirMove * step; tr.spin += step / 7 * (reverse ? -1 : 1) * tr.dir * dirMove;
      return Math.abs(target - tr.x) < 0.5;
    };
    switch (tr.state) {
      case 'park':
        tr.v = 0;
        if (tr.fill >= 0.99 && st.dig.state === 'rest') { if ((tr.wait += dt) > 5) go(); }
        break;
      case 'go': if (drive(TURN_GO, 48)) { tr.state = 'turn'; tr.t = 0; tr.turnFrom = 1; tr.next = 'back'; } break;
      case 'turn':
        tr.t += dt / 0.8;
        if (tr.t >= 0.5 && tr.dir === tr.turnFrom) tr.dir = -tr.turnFrom;
        if (tr.t >= 1) { tr.t = 0; tr.state = tr.next; if (tr.next === 'back' || tr.next === 'parkback') beeper.t = 0; }
        break;
      case 'back': if (drive(DUMP_AT, 26, true)) { tr.state = 'tip'; tr.t = 0; hydraulic(true); } break;
      case 'tip': {
        tr.t += dt;
        const up = clamp01(tr.t / 1.3), down = clamp01((tr.t - 3.1) / 1.1);
        tr.tilt = 0.95 * eio(up) * (1 - eio(down));
        if (tr.t > 0.8 && tr.t < 2.9 && tr.fill > 0) {   // the load slides out of the back
          const before = tr.fill; tr.fill = Math.max(0, tr.fill - dt / 1.6);
          const lip = lipPt(tr.tilt), wx = tr.x + lip[0] * tr.dir, wy = lip[1];
          for (let i = 0; i < 3; i++) bit(wx + rand(-2, 2), wy + rand(-1, 2), tr.dir * rand(-24, -8), rand(-10, 10), tr.fm, -2);
          if (before >= 0.98 && tr.fill < 0.98) { SND.play('dump', MAT[tr.fm].rate); puffAt(wx, -6); }
          if (before > 0.5 && tr.fill <= 0.5) SND.play('rocks2', MAT[tr.fm].rate * 0.9);
          if (tr.fill === 0) landLoad();
        }
        if (tr.t > 3.1 && !tr.lowered) { tr.lowered = true; hydraulic(false); }
        if (tr.t >= 4.3) { tr.tilt = 0; tr.lowered = false; tr.state = 'pause'; tr.t = 0.5; }
        break;
      }
      case 'pause': if ((tr.t -= dt) <= 0) { tr.state = 'return'; SND.play('honk', 1.05); } break;
      case 'return': if (drive(TURN_BACK, 50)) { tr.state = 'turn'; tr.t = 0; tr.turnFrom = -1; tr.next = 'parkback'; } break;
      case 'parkback': if (drive(TPARK, 26, true)) { tr.state = 'park'; tr.wait = 0; } break;
    }
    // reversing: beep, beep, beep
    if (tr.state === 'back' || tr.state === 'parkback') {
      const was = beeper.t % 0.62 < 0.31; beeper.t += dt; const now = beeper.t % 0.62 < 0.31;
      if (now && !was || beeper.t === dt) tone('square', 1046, 0, 0.26, 0.045);
    }
  }
  function puffAt(wx, wy) { const c = MAT[st.truck.fm].c[2]; spawn(10, () => ({ x: wx - st.cam + rand(-6, 6), y: Y.yG + wy + rand(-3, 3), vx: rand(-14, 14), vy: rand(-26, -8), g: 0, life: 1, max: 1, s: 3, c })); }
  function landLoad() {
    const s = st.site, m = st.truck.fm;
    if (s.done) { s.done = false; s.clear = 1; s.om = s.m; s.loads = 0; }
    if (s.loads === 0) s.m = m;
    s.loads++;
    st.builder.cheer = 1.2;
    if (s.loads >= 3) {   // it's finished!
      s.done = true; s.t = 0; st.made++;
      setTimeout(() => { if (scene !== 'dig') return; SFX.fanfare(); confetti(40); sparkle(MX - st.cam, Y.yG - 40, 40, 16, '#fff6b0'); }, 600);
      st.builder.cheer = 4; st.admire = 5;   // the camera stays to admire it while the truck heads home
      st.m = (st.m + 1) % 3; st.pile = 1; st.pileIn = 1;   // a fresh pile of the next kind waits back at the digger
    }
  }
  function update(dt) {
    const tr = st.truck, d = st.dig;
    updateDigger(dt);
    updateTruck(dt);
    st.idle += dt;
    if (st.site.done) st.site.t += dt;
    st.site.clear = Math.max(0, st.site.clear - dt * 1.5);
    st.pileIn = Math.max(0, (st.pileIn || 0) - dt * 2);
    st.builder.cheer = Math.max(0, st.builder.cheer - dt); st.builder.wave = Math.max(0, st.builder.wave - dt);
    st.mixer.fast = Math.max(0, st.mixer.fast - dt); st.mixer.spin += dt * (0.6 + st.mixer.fast * 3);
    for (const c of st.cones) c.hop = Math.max(0, c.hop - dt * 30);
    for (const u of st.under) u.t = Math.max(0, u.t - dt);
    for (const b of st.bits) {
      if (b.delay > 0) { b.delay -= dt; continue; }
      b.vy += 260 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.y >= b.floor) { b.life = 0; }
    }
    st.bits = st.bits.filter(b => b.life > 0);
    // the camera follows the truck on its trips, and comes home to the digger
    const away = tr.state !== 'park' && tr.state !== 'parkback' || Math.abs(tr.x - TPARK) > 20;
    st.admire = Math.max(0, (st.admire || 0) - dt);
    const want = st.admire > 0 ? MX - W / 2 : away ? tr.x + tr.dir * 10 - W / 2 : LOAD_CX - W / 2;
    const target = W >= WW ? (WW - W) / 2 : Math.max(-6, Math.min(WW - W + 6, want));
    st.cam += (target - st.cam) * Math.min(1, dt * 2.6);
    // engine: rumbles louder while driving and tipping
    const busy = tr.state === 'park' ? (d.state === 'scoop' ? 0.75 : 0.45) : tr.state === 'tip' ? 0.8 : 1;
    engine(busy, tr.state === 'park' || tr.state === 'pause' ? 1 : 1.3);
  }

  /* ---------- drawing ---------- */
  function drawPile() {
    const k = st.pileIn ? 1 - eout(1 - st.pileIn) : 0;
    heap(PX, 0, PR, pileTop() * (1 - k), st.m, 7 + st.m * 5);
  }
  function drawDigger() {
    const d = st.dig, pose = digPose(), face = pose.face;
    tracks(DX, d.tread);
    const cv = paint('digUpper', 150, 110, 70, 100, () => diggerUpper(pose, d.carry, d.cm));
    blit(cv, DX, 0, face >= 0 ? Math.max(0.25, face) : Math.min(-0.25, face), 1);
  }
  function drawTruck() {
    const tr = st.truck;
    let sx = tr.dir;
    if (tr.state === 'turn') { sx = Math.cos(Math.PI * tr.t) * tr.turnFrom; if (Math.abs(sx) < 0.15) sx = 0.15 * Math.sign(sx || tr.turnFrom); }
    const hop = Math.round(tr.hop * 2 + (tr.state === 'turn' ? Math.sin(Math.PI * tr.t) * 3 : 0));
    const cv = paint('truck', 140, 100, 70, 94, () => truckArt({ tilt: tr.tilt, fill: tr.fill, m: tr.fm, spin: tr.spin, mood: 'happy' }));
    blit(cv, tr.x, -hop, sx, 1);
  }
  function drawBits() { for (const b of st.bits) if (b.delay <= 0) R(Math.round(b.x), Math.round(b.y), b.m === 2 ? 2 : 1, b.m === 2 ? 2 : 1, b.c); }

  SCENES.dig = {
    view: [200, 130],
    freeTouch: true,
    layout,
    groundY: () => Y.hz,
    enter() {
      layout();
      const tr = st.truck, d = st.dig;
      Object.assign(tr, { x: TPARK, dir: 1, state: 'park', v: 0, tilt: 0, fill: 0, t: 0, wait: 0, hop: 0, lowered: false });
      Object.assign(d, { state: 'rest', t: 0, q: 0, carry: 0, wig: 0 });
      st.bits = []; st.idle = 0; st.cam = LOAD_CX - W / 2;
      if (W >= WW) st.cam = (WW - W) / 2;
      SND.load(); SND.music(true);
    },
    leave() { SND.music(false); engine(0); },
    update,
    drawWorld() {
      skyline();
      // far grass behind the fence
      R(0, Y.hz - 2, W, Y.yG - Y.hz, '#8fd877'); for (let x = 0; x < W; x += 7) R(x, Y.hz + (x * 7) % 5, 2, 1, '#7cc96a');
      crane();
      g.save(); g.translate(-Math.round(st.cam), Y.yG);
      fence();
      PETS.draw('dig', { y: -31, x0: 10, x1: 300 });
      mixer();
      siteDraw();
      drawPile();
      drawDigger();
      drawTruck();
      drawBits();
      ground();
      for (const c of st.cones) cone(c);
      builder();
      g.restore();
    },
    drawLit() {
      const k = nightK(), tr = st.truck, cx = -Math.round(st.cam);
      if (k > 0.05) {
        g.save(); g.translate(cx, Y.yG);
        alpha(k * 0.25, () => { for (let i = 0; i < 26; i++) R(tr.x + tr.dir * (42 + i), -24 + i * 0.25, 1, Math.max(1, i * 0.5), '#fff6c8'); });
        alpha(k, () => R(tr.x + tr.dir * 39 - (tr.dir < 0 ? 1 : 0), -26, 2, 2, '#fff6c8'));
        g.restore();
      }
      // beacons on the cab roofs flash orange
      if (Math.floor(T * 3) % 2) {
        g.save(); g.translate(cx, Y.yG);
        alpha(0.35 + 0.5 * k, () => { circle(tr.x + tr.dir * 20, -40 - Math.round(tr.hop * 2), 3, '#ffb040'); });
        const pose = digPose(); if (Math.abs(pose.face) > 0.5) alpha(0.35 + 0.5 * k, () => circle(DX + 7 * Math.sign(pose.face), -46, 3, '#ffb040'));
        g.restore();
      }
      drawParticles();
    },
    drawUI() {
      const tr = st.truck, cx = -Math.round(st.cam);
      if (tr.state === 'park' && tr.fill >= 0.99 && st.dig.state === 'rest') TOY.arrow(tr.x + cx, Y.yG - 46);
      else if (tr.state === 'park' && st.dig.state === 'rest' && st.idle > 3 && st.pile > 0.01) {
        const z = Math.max(1, Math.round(Math.min(W, H) / 120)), press = Math.floor(T * 2) % 2;
        hand(PX + cx + 4, Y.yG - pileTop() - 2 - 6 * z, z, press);
      }
      drawHomeButton(Y.home);
    },
    tap(x, y) {
      if (inBox(Y.home, x, y)) { goScene('station'); return true; }
      st.idle = 0;
      const wx = x + st.cam, wy = y - Y.yG, tr = st.truck;
      if (PETS.tap('dig', x, y)) return true;
      for (const c of st.cones) if (Math.abs(wx - c.x) < 8 && wy > c.y - 18 && wy < c.y + 4) { c.hop = 8; SND.play('boing', 0.9 + Math.random() * 0.3); return true; }
      if (wy > 15) {   // something buried?
        let best = null, bd = 1e9;
        for (const u of st.under) {
          const d = u.k === 'pipe' ? (wx > 228 && wx < 432 ? Math.abs(wy - u.y) : 1e9) : Math.hypot(wx - u.x, (wy - u.y) * 1.3);
          if (d < bd) { bd = d; best = u; }
        }
        if (best && bd < (best.k === 'fossil' ? 26 : 16)) { poke(best); return true; }
      }
      if (Math.abs(wx - (MX + 54)) < 9 && wy > -10 && wy < 16) { st.builder.wave = 1.5; tone('sine', 660, 0, 0.12, 0.08); tone('sine', 880, 0.12, 0.15, 0.08); return true; }
      if (Math.abs(wx - 260) < 30 && wy > -46 && wy < -8 && tr.state === 'park') { st.mixer.fast = 2; SND.play('beep'); return true; }
      const onTruck = Math.abs(wx - tr.x) < 44 && wy > -52 && wy < 4;
      if (tr.state === 'park') {
        if (tr.fill >= 0.99) { if (st.dig.state === 'rest') go(); return true; }
        if (st.pile > 0.01 && tr.fill + (st.dig.state === 'scoop' ? 1 / 3 + st.dig.q / 3 : 0) < 0.99) startScoop();
        return true;
      }
      if (onTruck) { if (tr.honk <= 0) { SND.play('honk'); tr.honk = 0.6; } return true; }
      if (Math.abs(wx - DX) < 40 && wy > -60 && wy < 4 && st.dig.wig <= 0) { st.dig.wig = 1; SND.play('beep', 1.1); }
      return true;
    },
    _st: st,
    // the menu card: the dump truck full of dirt with the digger's arm above it
    card(x, yb) {
      const cv = paint('truckCard', 140, 100, 70, 94, () => truckArt({ tilt: 0, fill: 1, m: 0, spin: T * 3, mood: 'happy' }));
      blit(cv, x, yb, 1, 1);
    },
  };
})();
