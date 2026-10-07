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

  /* ---------- the cast, painted with smooth shapes and baked into crisp pixel sprites ---------- */
  // Each sprite is drawn with canvas paths in world units, rasterized at the screen's own pixel
  // size (Q pixels per world unit), snapped to its little palette and given a dark outline.
  const BAKED = new Map();
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  function bake(key, bw, bh, Q, pal, outline, draw) {
    const id = key + '@' + Q;
    let cv = BAKED.get(id);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(bw * Q) + 4; cv.height = Math.ceil(bh * Q) + 4;
    const c = cv.getContext('2d');
    c.setTransform(Q, 0, 0, Q, cv.width / 2, cv.height - 2);
    c.lineCap = 'round'; c.lineJoin = 'round';
    draw(c);
    const img = c.getImageData(0, 0, cv.width, cv.height), d = img.data, n = cv.width * cv.height;
    const P = pal.map(hex), O = hex(outline), solid = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const a = d[i * 4 + 3];
      if (a < 110) { d[i * 4 + 3] = 0; continue; }
      const r = d[i * 4] * 255 / a, gg = d[i * 4 + 1] * 255 / a, b = d[i * 4 + 2] * 255 / a;
      let best = P[0], bd = 1e9;
      for (const p of P) { const dd = (p[0] - r) ** 2 + (p[1] - gg) ** 2 + (p[2] - b) ** 2; if (dd < bd) { bd = dd; best = p; } }
      d[i * 4] = best[0]; d[i * 4 + 1] = best[1]; d[i * 4 + 2] = best[2]; d[i * 4 + 3] = 255; solid[i] = 1;
    }
    const w = cv.width;
    for (let i = 0; i < n; i++) {
      if (solid[i]) continue;
      const x = i % w;
      if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || solid[i - w] || solid[i + w]) { d[i * 4] = O[0]; d[i * 4 + 1] = O[1]; d[i * 4 + 2] = O[2]; d[i * 4 + 3] = 255; }
    }
    c.putImageData(img, 0, 0);
    if (BAKED.size > 600) BAKED.clear();
    BAKED.set(id, cv);
    return cv;
  }
  // Draw a baked sprite with its feet at world (x, yb), using whatever zoom the canvas has right now.
  function stamp(key, bw, bh, pal, outline, draw, x, yb, dir = 1) {
    const m = g.getTransform(), z = Math.max(1, Math.round(m.a));
    const Q = z <= 3 ? z : z % 3 === 0 ? 3 : z % 2 === 0 ? 2 : 3, k = z / Q;
    const cv = bake(key, bw, bh, Q, pal, outline, draw);
    const px = Math.round(m.a * x + m.e), py = Math.round(m.d * yb + m.f);
    const dw = Math.round(cv.width * k), dh = Math.round(cv.height * k);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    if (dir < 0) { g.translate(px, 0); g.scale(-1, 1); g.drawImage(cv, -Math.round(dw / 2), py - dh + Math.round(2 * k), dw, dh); }
    else g.drawImage(cv, px - Math.round(dw / 2), py - dh + Math.round(2 * k), dw, dh);
    g.restore();
  }
  // little path helpers (c = the 2d context, units = world pixels)
  const E = (c, x, y, rx, ry, col, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); };
  const poly = (c, pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); };
  const line = (c, pts, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); };
  const curve = (c, cmds, col, fillIt = true, w = 1) => {   // cmds: ['M',x,y] ['Q',cx,cy,x,y] ['L',x,y]
    c.beginPath();
    for (const [op, ...a] of cmds) op === 'M' ? c.moveTo(...a) : op === 'Q' ? c.quadraticCurveTo(...a) : op === 'Z' ? c.closePath() : c.lineTo(...a);
    if (fillIt) { c.closePath(); c.fillStyle = col; c.fill(); } else { c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
  };
  // a dog's leg from the shoulder/hip to the paw, swinging with the gait
  function gait(o) {
    const run = !!o.run, walk = !run && o.step != null, frames = 8;
    const f = run ? Math.floor(((T * 2.4) % 1) * frames) : walk ? Math.floor(((T * 1.4) % 1) * frames) : 0;
    return { f, amp: run ? 5 : walk ? 2.6 : 0, lift: run ? 3 : walk ? 1.6 : 0, ph: f / frames };
  }
  function legPts(front, sx0, sy0, gp, off, thick) {
    const a = (gp.ph + off) * Math.PI * 2, sw = Math.sin(a) * gp.amp, lf = Math.max(0, Math.cos(a)) * gp.lift;
    if (front) {
      const paw = [sx0 + 1 + sw, -lf], elbow = [sx0 - 0.5 + sw * 0.3, sy0 + 6 - lf * 0.4], past = [paw[0] - 0.4, -2.4 - lf];
      return [[sx0, sy0], elbow, past, paw, [paw[0] + thick * 0.55, -lf]];
    }
    const paw = [sx0 - 1.5 + sw, -lf], knee = [sx0 + 2.6 + sw * 0.3, sy0 + 6.5 - lf * 0.5], hock = [paw[0] - 2.2, -4.6 - lf * 0.8];
    return [[sx0, sy0], knee, hock, paw, [paw[0] + thick * 0.55, -lf]];
  }
  function drawLeg(c, pts, wTop, wLow, col, pawCol) {
    line(c, pts.slice(0, 2), wTop, col);
    line(c, pts.slice(1, 4), wLow, col);
    line(c, pts.slice(3, 5), wLow * 0.95, pawCol || col);
  }

  /* the red Vizsla: lean and leggy, deep chest, long muzzle, big soft ear, amber eyes */
  const VZ = { V1: '#b4542a', V2: '#cf7040', V3: '#8e3c1a', V4: '#6e2c12', EAR: '#9a4420', NOSE: '#b86f62', EYE: '#e0a040', INK: '#22222a', COL: '#3d4a3a', RING: '#cfd6dd', TNG: '#e8708a', MTH: '#5a1a10', W: '#ffffff' };
  const VZ_PAL = Object.values(VZ);
  // o: { pose: stand|point|tilt|chew, run, step, hop, bark, wag, wet }
  function vizsla(x, yb, dir = 1, s = 1, o = {}) {
    const pose = o.pose || 'stand', gp = gait(o), wag = o.wag ? Math.floor(T * 8) % 2 : 0, bark = o.bark ? 1 : 0;
    const key = `vz:${pose}:${gp.f}:${gp.amp}:${wag}:${bark}`;
    stamp(key, 66, 46, VZ_PAL, '#4a1e0a', c => {
      const { V1, V2, V3, V4, EAR } = VZ;
      // far legs, in shadow
      const fl = legPts(true, 9.5, -14.5, gp, 0.5, 2.2), hl = legPts(false, -12, -15.5, gp, 0, 2.2);
      drawLeg(c, fl, 3.2, 2.1, V3, V4); drawLeg(c, hl, 3.6, 2.1, V3, V4);
      // tail, carried level
      const tw = pose === 'point' ? 0 : wag ? -1.6 : 0.6;
      line(c, [[-16.5, -20.8], [-21.5, -22 + tw * 0.5]], 2.4, V1); line(c, [[-21.5, -22 + tw * 0.5], [-26.5, -22.8 + tw]], 1.4, V1);
      // body: deep chest, tucked waist
      curve(c, [['M', -17, -21.2], ['Q', -5, -24.8, 8, -24], ['Q', 15.5, -23.4, 15.2, -16.5], ['Q', 14.6, -10.6, 8, -10.4], ['Q', 0, -10.8, -6.2, -14.6], ['Q', -13, -13.2, -17.2, -16.8], ['Q', -18.6, -19.2, -17, -21.2]], V1);
      curve(c, [['M', 15.2, -15], ['Q', 14.4, -10.6, 8, -10.4], ['Q', 0, -10.8, -6.2, -14.6], ['Q', -1, -12.6, 7, -12.4], ['Q', 12.4, -12.8, 15.2, -15]], V3);
      curve(c, [['M', -14, -21.6], ['Q', -4, -24.2, 8, -23.4]], V2, false, 1.1);
      curve(c, [['M', 8.5, -21], ['Q', 10.5, -17.5, 9, -14]], V3, false, 0.7);
      E(c, -11.6, -16.6, 5.2, 5.6, V1, 0.35);   // haunch
      curve(c, [['M', -15.6, -14], ['Q', -12, -11, -8.2, -13.4]], V3, false, 0.8);
      // near legs
      const nf = pose === 'point' ? [[10.5, -14.5], [14, -10.8], [12.8, -7.4], [12.4, -6.4], [14, -6.2]] : legPts(true, 10.5, -14.5, gp, 0, 2.2);
      const nh = legPts(false, -11, -15.5, gp, 0.5, 2.2);
      drawLeg(c, nh, 3.8, 2.2, V1, V3); drawLeg(c, nf, 3.4, 2.2, V1, V3);
      // neck: thick where it meets the shoulders, sloping forward to the head (or bending down to chew)
      const chew = pose === 'chew';
      const neck = chew
        ? [['M', 1, -23.8], ['Q', 9, -26.4, 15, -22.6], ['L', 19.6, -17.4], ['L', 16.4, -12.4], ['Q', 13.6, -11.6, 9, -11.6], ['Z']]
        : [['M', 1, -23.8], ['Q', 7, -31, 12, -33.6], ['L', 18.6, -30], ['Q', 18, -24, 15.4, -15], ['Z']];
      curve(c, neck, V1);
      if (!chew) { curve(c, [['M', 17.8, -27], ['Q', 17.2, -21, 15.4, -16]], V3, false, 0.9); curve(c, [['M', 3, -24.2], ['Q', 7.4, -30, 11.6, -32.6]], V2, false, 0.8); }
      c.save(); curve(c, neck, V1); c.clip();   // the collar wraps around the neck
      if (chew) poly(c, [[11.4, -27], [13.4, -27], [13.4, -10], [11.4, -10]], VZ.COL);
      else poly(c, [[7.4, -32.4], [19.4, -27.2], [18.8, -25.4], [6.8, -30.6]], VZ.COL);
      c.restore();
      if (chew) E(c, 12.4, -11.6, 0.85, 0.85, VZ.RING); else E(c, 17.6, -25, 0.85, 0.85, VZ.RING);
      // head (tilts, or drops down to chew)
      c.save();
      if (chew) { c.translate(17.6, -18.4); c.rotate(0.75); }
      else { c.translate(15.6, -32.6); if (pose === 'tilt') c.rotate(-0.28); }
      E(c, 1.4, -1.4, 5, 4.3, V1);
      curve(c, [['M', 3, -3.9], ['L', 9.6, -3.3], ['Q', 12.2, -2.9, 12.1, -0.8], ['L', 11.6, 0.7], ['Q', 8, 1.7, 3, 1.5], ['Z']], V1);
      curve(c, [['M', 3.2, -3.7], ['L', 10, -3.1]], V2, false, 0.9);
      E(c, 0.6, -4.2, 3, 1, V2);
      if (bark) { poly(c, [[5, 1], [11.6, 0.4], [10.4, 3.2], [5.2, 2.4]], VZ.MTH); E(c, 8.4, 2.4, 1.4, 0.8, VZ.TNG); curve(c, [['M', 4.8, 2.2], ['L', 10.4, 3.4], ['Q', 8, 4.6, 5, 3.6], ['Z']], V1); }
      E(c, 11.9, -1.9, 1.25, 1.1, VZ.NOSE);
      if (!bark) curve(c, [['M', 11.4, 0.6], ['L', 5.6, 1.1]], V4, false, 0.6);
      E(c, 5.3, -2.5, 1.05, 0.95, VZ.EYE); E(c, 5.6, -2.5, 0.55, 0.62, VZ.INK); E(c, 5.3, -2.9, 0.25, 0.25, VZ.W);
      curve(c, [['M', 4, -3.9], ['L', 6.6, -3.6]], V3, false, 0.6);
      // the big soft ear
      if (pose === 'tilt') curve(c, [['M', -1.6, -4.6], ['Q', 2, -6.2, 3.4, -3], ['Q', 4.4, 1, 1.6, 3.4], ['Q', -1.6, 2.6, -2.6, -0.8], ['Z']], EAR);
      else curve(c, [['M', -1.6, -4.6], ['Q', 3, -4.9, 2.7, 0.4], ['Q', 2.3, 5.6, -0.4, 6.5], ['Q', -2.9, 4.1, -2.7, -0.5], ['Z']], EAR);
      curve(c, [['M', 0.4, -3.4], ['Q', 1.2, 1, 0, 4.6]], V3, false, 0.6);
      c.restore();
    }, x, yb - (o.hop || 0), dir);
    if (o.wet) for (let i = 0; i < 4; i++) R(Math.round(x - 16 + i * 9), Math.round(yb - 8 + ((T * 30 + i * 7) % 10)), 1, 2, '#8ec8f0');
  }

  /* the white husky: thick fluffy coat, curled plume tail, pointy ears, blue eyes */
  const HK = { H1: '#f6f6f2', H2: '#ffffff', H3: '#d8dce6', H4: '#b4bcca', PINK: '#f2a8a0', NOSE: '#2a2a30', EYE: '#6aaee8', INK: '#22222a', TNG: '#e8708a', LIP: '#5a5a66' };
  const HK_PAL = Object.values(HK);
  // o: { pose: stand|howl|chew, run, step, hop, pant, wag, bark }
  function husky(x, yb, dir = 1, s = 1, o = {}) {
    const pose = o.pose || 'stand', gp = gait(o), wag = o.wag ? Math.floor(T * 7) % 2 : 0, pant = o.pant ? 1 : 0, bark = o.bark ? 1 : 0;
    const key = `hk:${pose}:${gp.f}:${gp.amp}:${wag}:${pant}:${bark}`;
    stamp(key, 60, 50, HK_PAL, '#7e8698', c => {
      const { H1, H2, H3, H4 } = HK;
      const fl = legPts(true, 9, -13, gp, 0.5, 3), hl = legPts(false, -11.5, -14, gp, 0, 3);
      drawLeg(c, fl, 4.4, 3.3, H3, H4); drawLeg(c, hl, 4.8, 3.3, H3, H4);
      // the curled plume of a tail, lying over the back
      const tw = wag ? 1 : 0;
      const plume = [[-15.5, -21.5, 3.6], [-18, -26.5, 4.2], [-15.4, -30.6 - tw, 4.2], [-10.6, -31 - tw, 3.6], [-7.4, -28.4 - tw, 2.6]];
      for (const [px, py, r] of plume) E(c, px + 0.8, py + 0.9, r, r, H3);
      for (const [px, py, r] of plume) E(c, px, py, r, r, H1);
      E(c, -15.6, -31.4 - tw, 2, 1.4, H2);
      // body, belly fringe, haunch and chest ruff
      E(c, -1, -19.4, 16.2, 8.6, H1);
      for (let i = 0; i < 9; i++) E(c, -12 + i * 2.6, -11.4 + (i % 2) * 0.4, 1.7, 1.5, i % 2 ? H3 : H1);
      E(c, -2, -25.2, 10, 1.8, H2);
      E(c, -10.8, -15.8, 6.2, 6.6, H1); curve(c, [['M', -16, -12.6], ['Q', -11, -9, -6, -12]], H3, false, 0.9);
      E(c, 10.6, -18.4, 6.6, 7.6, H1); E(c, 11.2, -14.4, 3.4, 2.6, H3);
      // near legs: thick and fluffy
      const nf = legPts(true, 10, -13, gp, 0, 3), nh = legPts(false, -10.5, -14, gp, 0.5, 3);
      drawLeg(c, nh, 5, 3.4, H1, H3); drawLeg(c, nf, 4.6, 3.4, H1, H3);
      // the mane
      E(c, 11.4, -25, 6.4, 7.6, H1, -0.3);
      for (let i = 0; i < 4; i++) E(c, 6.6 + i * 2.2, -19.6 + (i % 2), 1.6, 1.4, H1);
      // head
      c.save();
      if (pose === 'chew') { c.translate(16.5, -18.5); c.rotate(0.7); }
      else if (pose === 'howl') { c.translate(14.4, -31); c.rotate(-0.95); }
      else c.translate(15.2, -29.8);
      const ear = (ex, sh) => { poly(c, [[ex - 2, -5.5], [ex + 0.6 + sh, -12.2], [ex + 3.2, -6]], H1); poly(c, [[ex - 0.6, -6.4], [ex + 0.7 + sh, -10.2], [ex + 2.1, -6.6]], HK.PINK); };
      ear(0.4, -0.4); ear(4.2, 0.6);
      E(c, 1.6, -2, 5.6, 5, H1);
      E(c, 0.2, 1.6, 4.2, 3.2, H1);   // cheek fluff
      curve(c, [['M', 4, -3.2], ['L', 10.6, -1.4], ['Q', 11.4, -0.4, 10.6, 0.9], ['L', 4, 1.8], ['Z']], H1);
      curve(c, [['M', 4.6, 1.6], ['L', 10.4, 0.9]], H3, false, 0.9);
      if (pose === 'howl') { E(c, 9, 1.4, 1.6, 1.2, HK.LIP); E(c, 5.5, -2.8, 1.1, 0.35, HK.INK); }
      else {
        if (bark || pant) { poly(c, [[6, 1.2], [10.4, 0.9], [9.6, 3.2], [6.4, 2.8]], HK.LIP); E(c, 8, 3.2, 1.4, 1.9, HK.TNG); }
        else curve(c, [['M', 10.2, 0.9], ['L', 6, 1.8]], HK.LIP, false, 0.6);
        E(c, 5.6, -2.6, 1.25, 0.95, HK.EYE); E(c, 5.9, -2.6, 0.55, 0.62, HK.INK); E(c, 5.5, -2.95, 0.25, 0.25, H2);
        curve(c, [['M', 4.2, -3.4], ['Q', 5.6, -4, 7, -3.4]], HK.LIP, false, 0.45);
      }
      E(c, 10.7, -0.8, 1.35, 1.15, HK.NOSE);
      E(c, 0.6, -4.6, 3.4, 1.1, H2);
      c.restore();
    }, x, yb - (o.hop || 0), dir);
  }

  /* the owl: round, soft and wide-eyed */
  const OW = { O1: '#8a6a4a', O2: '#a8845a', O3: '#5e4430', BL: '#ecdcb8', BAR: '#a07850', EY: '#ffd21f', INK: '#22222a', BK: '#f5a020', W: '#ffffff' };
  const OW_PAL = Object.values(OW);
  function owl(x, yb, s = 1, o = {}) {
    const fly = o.fly ? (Math.floor(T * 10) % 2 ? 1 : 2) : 0, look = o.look || 0, blink = o.blink ? 1 : 0, hoot = o.hoot ? 1 : 0, sc = o.sc || 1;
    stamp(`ow:${fly}:${look}:${blink}:${hoot}:${sc}`, 44 * sc + 2, 34 * sc + 2, OW_PAL, '#3a2a1a', c => {
      c.scale(sc, sc);
      const { O1, O2, O3 } = OW;
      if (fly) { const up = fly === 1; E(c, -9, up ? -18 : -9, 9, 3.2, O3, up ? -0.5 : 0.4); E(c, 9, up ? -18 : -9, 9, 3.2, O3, up ? 0.5 : -0.4); }
      E(c, 0, -9.6, 7.2, 9.6, O1);
      E(c, 0, -7, 4.6, 6.4, OW.BL);
      for (let i = 0; i < 4; i++) for (const sx2 of [-2, 0.4, 2.6]) curve(c, [['M', sx2 - 0.8, -11 + i * 2.6], ['L', sx2, -10.2 + i * 2.6], ['L', sx2 + 0.8, -11 + i * 2.6]], OW.BAR, false, 0.55);
      if (!fly) { E(c, -6.2, -9, 2.4, 6.8, O3, 0.12); E(c, 6.2, -9, 2.4, 6.8, O3, -0.12); }
      E(c, 0, -19, 7.4, 6.2, O1);
      poly(c, [[-5.6, -22.6], [-6.8, -28.6], [-2.4, -24]], O3); poly(c, [[5.6, -22.6], [6.8, -28.6], [2.4, -24]], O3);
      E(c, -3.1, -19.2, 3.7, 3.7, O2); E(c, 3.1, -19.2, 3.7, 3.7, O2);
      if (blink) { curve(c, [['M', -5.4, -19.2], ['Q', -3.1, -18, -0.8, -19.2]], O3, false, 0.8); curve(c, [['M', 0.8, -19.2], ['Q', 3.1, -18, 5.4, -19.2]], O3, false, 0.8); }
      else {
        E(c, -3.1, -19.2, 2.6, 2.6, OW.EY); E(c, 3.1, -19.2, 2.6, 2.6, OW.EY);
        E(c, -3.1 + look * 0.9, -19.2, 1.35, 1.35, OW.INK); E(c, 3.1 + look * 0.9, -19.2, 1.35, 1.35, OW.INK);
        E(c, -3.6 + look * 0.9, -19.8, 0.45, 0.45, OW.W); E(c, 2.6 + look * 0.9, -19.8, 0.45, 0.45, OW.W);
      }
      poly(c, [[-1.1, -17.2], [1.1, -17.2], [0, hoot ? -15.4 : -14.4]], OW.BK);
      if (hoot) E(c, 0, -14.2, 0.9, 0.8, O3);
      for (const fx of [-2.4, 2.4]) { line(c, [[fx - 1, -0.4], [fx + 1, -0.4]], 0.9, OW.BK); }
    }, x, yb, 1);
  }

  /* the bear: big, brown and (secretly) friendly */
  const BR = { B1: '#7a4a2a', B2: '#94603a', B3: '#5a3418', MZ: '#c8a07a', INK: '#22222a', MTH: '#5a1a1a', TNG: '#e8708a', W: '#ffffff' };
  const BR_PAL = Object.values(BR);
  function bear(x, yb, dir = 1, s = 1, o = {}) {
    if (o.stand) {
      const wave = o.wave ? Math.floor(T * 5) % 2 + 1 : 0, roar = o.roar ? 1 : 0, yawn = o.yawn ? 1 : 0;
      stamp(`brs:${wave}:${roar}:${yawn}`, 48, 66, BR_PAL, '#2a1a0a', c => {
        const { B1, B2, B3 } = BR;
        E(c, -5, -6, 4.6, 6.6, B3); E(c, 5, -6, 4.6, 6.6, B1); E(c, -5.4, -0.8, 4.4, 1.6, B3); E(c, 5.4, -0.8, 4.4, 1.6, B3);
        E(c, 0, -24, 13.4, 16, B1); E(c, 0, -21.6, 8.2, 11, B2);
        E(c, -12.6, -26, 3.6, 9, B3, 0.25);
        if (wave) E(c, 13, -40 - (wave === 2 ? 1.4 : 0), 3.6, 9.4, B1, wave === 2 ? -0.3 : -0.1); else E(c, 12.6, -26, 3.6, 9, B1, -0.25);
        E(c, -7, -51, 3.4, 3.4, B1); E(c, 7, -51, 3.4, 3.4, B1); E(c, -7, -51, 1.8, 1.8, B3); E(c, 7, -51, 1.8, 1.8, B3);
        E(c, 0, -44, 10.4, 9.2, B1); E(c, 0, -47.8, 6, 2.2, B2);
        E(c, 0, -40.6, 5.2, 3.8, BR.MZ);
        if (yawn) { curve(c, [['M', -5.6, -45.4], ['Q', -4, -44.6, -2.4, -45.4]], BR.INK, false, 0.7); curve(c, [['M', 2.4, -45.4], ['Q', 4, -44.6, 5.6, -45.4]], BR.INK, false, 0.7); }
        else { E(c, -4, -46, 1.15, 1.15, BR.INK); E(c, 4, -46, 1.15, 1.15, BR.INK); E(c, -4.3, -46.4, 0.4, 0.4, BR.W); E(c, 3.7, -46.4, 0.4, 0.4, BR.W); }
        E(c, 0, -42.6, 1.9, 1.35, BR.INK);
        if (roar || yawn) { E(c, 0, -38.4, 3.2, 2.6, BR.MTH); E(c, 0, -37.2, 1.8, 1.1, BR.TNG); poly(c, [[-2.4, -40.4], [-1.6, -40.4], [-2, -39.2]], BR.W); poly(c, [[1.6, -40.4], [2.4, -40.4], [2, -39.2]], BR.W); }
        else curve(c, [['M', -1.8, -39.6], ['Q', 0, -38.6, 1.8, -39.6]], BR.INK, false, 0.6);
      }, x, yb, 1);
      return;
    }
    const gp = gait(o);
    stamp(`br:${gp.f}:${gp.amp}`, 72, 40, BR_PAL, '#2a1a0a', c => {
      const { B1, B2, B3 } = BR;
      const leg = (lx, off, col) => { const a = (gp.ph + off) * Math.PI * 2, sw = Math.sin(a) * gp.amp * 0.7, lf = Math.max(0, Math.cos(a)) * gp.lift; line(c, [[lx, -14], [lx + sw, -3 - lf]], 6.4, col); E(c, lx + sw + 1, -1.6 - lf, 3.6, 1.8, B3); };
      leg(14, 0.5, B3); leg(-15, 0, B3);
      E(c, -2, -19, 22, 11.4, B1); E(c, 6, -25, 10, 6.6, B1); E(c, -2, -27.6, 14, 2.2, B2); E(c, -2, -10.6, 16, 2.4, B3);
      E(c, -23.6, -21, 2.6, 2.4, B1);
      leg(17, 0, B1); leg(-12, 0.5, B1);
      E(c, 22, -22, 8.4, 7.4, B1); E(c, 19, -29, 2.7, 2.7, B1); E(c, 19, -29, 1.3, 1.3, B3);
      E(c, 29, -19.6, 5.2, 3.6, BR.MZ); E(c, 33.4, -20.6, 1.6, 1.25, BR.INK); E(c, 24.6, -24, 1.05, 1.05, BR.INK); E(c, 24.3, -24.4, 0.35, 0.35, BR.W);
      curve(c, [['M', 28, -17.2], ['Q', 30, -16.4, 32, -17.6]], B3, false, 0.6);
    }, x, yb, dir);
  }

  /* the snake: green, coiled and grinning */
  const SN = { G1: '#4aa83a', G2: '#3a8a2e', G3: '#6ac85a', BE: '#c8e070', SP: '#2a6a20', INK: '#22222a', W: '#ffffff', TG: '#e8222b' };
  const SN_PAL = Object.values(SN);
  function snake(x, yb, s = 1, o = {}) {
    const G1 = '#4aa83a', G2 = '#3a8a2e';
    if (o.slither) {   // a wiggly line heading right from x
      const n = Math.min(18, Math.floor((o.go || 0) / 3) + 4);   // the tail uncoils as it goes
      for (let i = n; i >= 0; i--) { const sx2 = x - i * 3, sy2 = yb - 3 + Math.round(Math.sin(T * 9 - i * 0.7) * 3); circle(sx2, sy2, 2, i % 3 ? G1 : G2); }
      R(x, yb - 6, 6, 5, G1); R(x + 3, yb - 5, 1, 1, INK_); R(x + 6, yb - 4, 3, 1, '#e8222b');
      return;
    }
    const wink = o.wink ? 1 : 0, tongue = o.hiss || Math.floor(T * 4) % 3 === 0 ? 1 : 0;
    stamp(`sn:${wink}:${tongue}`, 34, 30, SN_PAL, '#1e4a16', c => {
      const { G1: g1, G2: g2, G3, BE, SP } = SN;
      E(c, 0, -2.6, 11.6, 3.2, g1); E(c, 0, -1.2, 10, 1.4, BE);
      E(c, -0.6, -6.2, 9.4, 3.1, g2); E(c, -0.6, -5, 7.6, 1.2, BE);
      E(c, 0, -9.6, 7.2, 2.9, g1); E(c, 0, -8.6, 5.6, 1, BE);
      for (const [sx2, sy2] of [[-7, -3], [-1, -3.4], [5, -3], [-5, -6.8], [2, -7], [-2, -10.2], [3.4, -10]]) E(c, sx2, sy2, 1.2, 0.7, SP);
      line(c, [[3, -11], [4.6, -15], [4.2, -18.6]], 3.8, g1);
      line(c, [[3.8, -11.4], [5.2, -15]], 1.2, BE);
      E(c, 5.6, -21, 4.8, 3.2, g1); E(c, 5.2, -22.6, 3.4, 1.1, G3);
      if (wink) curve(c, [['M', 3.2, -21.8], ['L', 5, -21.8]], SN.INK, false, 0.7);
      else { E(c, 4.2, -22, 1.1, 1.1, SN.W); E(c, 4.5, -21.9, 0.55, 0.6, SN.INK); }
      E(c, 7.4, -22, 1.1, 1.1, SN.W); E(c, 7.7, -21.9, 0.55, 0.6, SN.INK);
      curve(c, [['M', 4.4, -19.4], ['Q', 6.6, -18.4, 9, -19.6]], SP, false, 0.6);
      if (tongue) { line(c, [[10, -20.4], [13, -20.4]], 0.6, SN.TG); line(c, [[13, -20.4], [14.2, -21.4]], 0.5, SN.TG); line(c, [[13, -20.4], [14.2, -19.6]], 0.5, SN.TG); }
    }, x, yb, 1);
  }
  /* a few more friends along the way */
  const CR = { S1: '#b8642a', S2: '#d8884a', S3: '#8a4a1a', BL: '#f2dcb8', INK: '#22222a', W: '#ffffff', R1: '#e8e4dc', R2: '#c8c0b4', PINK: '#f2a8a0', F1: '#f57a12', F2: '#ffb040', F3: '#c84a10' };
  const CR_PAL = Object.values(CR);
  function squirrel(x, yb, dir = 1, o = {}) {
    const f = o.run ? Math.floor(T * 12) % 2 : 0;
    stamp(`sq:${f}`, 22, 18, CR_PAL, '#4a2410', c => {
      const { S1, S2, S3 } = CR;
      curve(c, [['M', -3, -4], ['Q', -10, -6, -8, -12], ['Q', -6, -16, -2, -14], ['Q', -6, -12, -4, -8], ['Z']], S2);   // bushy tail
      E(c, -6.6, -11, 3, 3.6, S2, 0.4); E(c, -7.4, -12, 1.4, 1.8, CR.BL, 0.4);
      E(c, 0.6, -4.4, 4.4, 3, S1); E(c, 1.4, -3.4, 2.6, 1.6, CR.BL);
      E(c, 4.6, -6.4, 2.6, 2.3, S1); poly(c, [[3.4, -8], [4, -10.6], [5, -8.2]], S3);
      E(c, 5.4, -6.8, 0.6, 0.6, CR.INK); E(c, 7, -6, 0.5, 0.4, CR.INK);
      line(c, f ? [[-2, -2.6], [-3.6, -0.4]] : [[-2, -2.6], [-1, -0.4]], 1.4, S3); line(c, f ? [[3, -2.6], [4.6, -0.4]] : [[3, -2.6], [2, -0.4]], 1.3, S3);
    }, x, yb, dir);
  }
  function bunny(x, yb, dir = 1, o = {}) {
    const ears = o.up ? 1 : 0;
    stamp(`bn:${ears}`, 20, 22, CR_PAL, '#6a645a', c => {
      const { R1, R2 } = CR;
      E(c, -4.6, -5, 2, 2, CR.W);
      E(c, -0.6, -4.6, 4.8, 4, R1); E(c, 0, -2.8, 3.4, 1.6, R2);
      E(c, 3.6, -8, 2.8, 2.6, R1);
      E(c, 2.6, -12.6 - ears, 1.1, 3.6, R1, -0.15); E(c, 4.4, -12.4 - ears, 1.1, 3.6, R1, 0.2); E(c, 4.4, -12.2 - ears, 0.5, 2.4, CR.PINK, 0.2);
      E(c, 4.8, -8.4, 0.55, 0.6, CR.INK); E(c, 6.3, -7.4, 0.5, 0.4, CR.PINK);
      E(c, 1.6, -0.8, 1.8, 0.8, R2);
    }, x, yb, dir);
  }
  function fish(x, y, up) {   // a little orange fish leaping out of the creek
    stamp(`fs:${up ? 1 : 0}`, 16, 14, CR_PAL, '#6a2a08', c => {
      c.translate(0, -7); c.rotate(up ? -0.7 : 0.7);
      E(c, 0, 0, 4.4, 2.2, CR.F1); E(c, 0.6, -0.6, 2.6, 0.8, CR.F2);
      poly(c, [[-3.6, 0], [-6.8, -2.6], [-6.4, 2.6]], CR.F3); E(c, 2.6, -0.5, 0.55, 0.55, CR.INK);
    }, x, y, 1);
  }
  function butterflies(x0, x1, ybase, n, seed) {   // fluttering pairs of wings
    for (let i = 0; i < n; i++) {
      const ph = T * (0.4 + hsh(i + seed) * 0.3) + i * 2.1, x = Math.round(x0 + (x1 - x0) * (0.5 + 0.45 * Math.sin(ph))), y = Math.round(ybase - 6 - 10 * hsh(i * 3 + seed) + Math.sin(ph * 3.1) * 5);
      const c = ['#ffd21f', '#ff6fb4', '#8ec8f0', '#ffffff'][(i + seed) % 4], open = Math.floor(T * 9 + i) % 2;
      if (open) { R(x - 2, y - 1, 2, 2, c); R(x + 1, y - 1, 2, 2, c); } else { R(x - 1, y - 2, 1, 2, c); R(x + 1, y - 2, 1, 2, c); }
      R(x, y - 1, 1, 2, '#3a2a1a');
    }
  }
  // the owl, now a friend, flapping along above the dogs
  function owlFly(x, y, o = {}) { owl(x, y + Math.round(Math.sin(T * 3) * 2), 1, Object.assign({ fly: true, sc: 0.6 }, o)); }
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
  // a tree trunk with one branch reaching out (thick at the trunk, thin at the tip), needles at the end
  function owlTree(tx, base, top, bx0, bx1, by) {
    R(tx - 7, top, 14, base - top, '#6a4a2e'); R(tx - 7, top, 3, base - top, '#8a6a44'); R(tx + 4, top, 3, base - top, '#54381f');
    for (let y = top + 6; y < base; y += 11) R(tx - 4 + (y % 5), y, 5, 1, '#54381f');
    const n = Math.abs(bx1 - bx0), dir = Math.sign(bx1 - bx0);
    for (let i = 0; i <= n; i++) {
      const k = i / n, x = bx0 + dir * i, th = Math.max(2, Math.round(5 - k * 3)), y = Math.round(by + k * k * 3);
      R(x, y - th, 1, th, '#6a4a2e'); R(x, y - th, 1, 1, '#8a6a44');
    }
    for (const [k, up] of [[0.45, -1], [0.75, 1]]) { const x = bx0 + dir * n * k, y = by + k * k * 3 - 3; for (let j = 0; j < 7; j++) R(x + dir * j, y + up * j * 0.8 - (up > 0 ? 0 : 0), 1, 1, '#6a4a2e'); }
    const ex = bx1, ey = by + 3;
    for (const [dx, dy, r] of [[0, -3, 5], [dir * 5, -1, 4], [-dir * 3, 1, 4], [dir * 2, 3, 3]]) { circle(ex + dx, ey + dy, r, '#2f6a3a'); circle(ex + dx - 1, ey + dy - 1, Math.max(1, r - 2), '#3f7a44'); }
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
    const tall = H > W * 1.3, crop = fw >= 140 ? (tall ? 2.2 : 1.75) : 1.3;   // upright phones crop wide shots more so the dogs stay big
    const z = Math.max(1, Math.min(12, Math.floor(Math.min(kh, kw * crop))));
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
  const WORD_C = { 'HOO!': '#6a4a30', 'WOOF!': '#8a3a1a', 'RUFF!': '#8a3a1a', 'AWOO!': '#3a6ab8', 'HOO HOO!': '#6a4a30', '?': '#3a6ab8', 'ROAR!': '#7a2a1a', 'HSSS!': '#2a8a2a', 'SPLASH!': '#2a7ab8', 'CRUNCH!': '#a8742a', 'YUM!': '#e8222b', 'WOW!': '#d07010', 'BRRR!': '#3a6ab8' };
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
    'HOO!'() { tone('sine', 392, 0, 0.3, 0.09, 360); },
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
  // Real recordings (CC0, from OpenGameArt) take over from the synth when they've loaded.
  const FILES = { 'WOOF!': ['dog-bark', 0.9], 'RUFF!': ['dog-bark-2', 0.8], 'ROAR!': ['bear-roar', 0.55], 'SPLASH!': ['splash', 0.8], 'CRUNCH!': ['crunch', 0.9] };
  const bufs = {}, music = { buf: null, src: null, gain: null, t0: 0 };
  let loaded = false;
  function loadAudio() {
    if (loaded || !ac) return;
    loaded = true;
    const get = name => fetch('audio/' + name + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab && ac.decodeAudioData(ab)).catch(() => null);
    for (const [word, [name]] of Object.entries(FILES)) get(name).then(b => { if (b) bufs[word] = b; });
    get('dogs-music').then(b => { if (b) music.buf = b; });
  }
  function playWord(word) {
    const b = bufs[word];
    if (!b) { if (SOUND[word]) SOUND[word](); return; }
    const src = ac.createBufferSource(), gn = ac.createGain();
    src.buffer = b; src.playbackRate.value = word === 'RUFF!' ? 1.12 : 1; gn.gain.value = FILES[word][1];
    src.connect(gn); gn.connect(master); src.start();
  }
  function stopMusic() { if (music.src) { try { music.src.stop(); } catch (e) {} music.src = null; } }
  function musicTick() {   // keep the looping tune in step with the story, fading out at the end
    if (!music.buf || !ac) return false;
    if (!music.src && st.t < END - 1) {
      const src = ac.createBufferSource(), gn = ac.createGain();
      src.buffer = music.buf; src.loop = true; gn.gain.value = 0.32;
      src.connect(gn); gn.connect(master);
      src.start(0, st.t % music.buf.duration);
      music.src = src; music.gain = gn;
    }
    if (music.gain) music.gain.gain.value = 0.32 * clamp01((END - 0.4 - st.t) / 2.2);
    return true;
  }
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
        butterflies(10, 70, -4, 3, 1);
        vizsla(4, 8, 1, 1, { pose: t > 0.6 ? 'point' : 'stand' });
        husky(-44, 10, 1, 1, { pose: t > 1.6 && t < 3 ? 'howl' : 'stand', pant: t < 1.6 || t >= 3, wag: true });
      },
      words: [[1.7, 'AWOO!', () => [-30, -52]]],
    },
    { a: 3.6, b: 9, sky: 'woods', // 2. trotting through the tall pines
      cam(t) { setCam(walk(t, 3.6, 9, -40, 190) - 24, -16, 170, 100); },
      world(t) {
        forestSet(); rays();
        for (let i = 0; i < 3; i++) A.bird(((T * 26 + i * 110) % 500) - 100, -66 + i * 10, 1, T + i, '#3a4a3a');
        const x = walk(t, 3.6, 9, -40, 190);
        butterflies(x - 40, x + 60, -8, 2, 2);
        if (t > 5 && t < 7.4) squirrel(x + 30 - (t - 5) * 72, 22 - Math.abs(Math.sin(T * 14)) * 2, -1, { run: true });   // a squirrel scampers the other way
        husky(x - 52, 9, 1, 1, { run: true, step: step(), pant: true, wag: true, hop: Math.abs(Math.sin(T * 10)) });
        vizsla(x, 8, 1, 1, { run: true, step: 1 - step(), wag: true, hop: Math.abs(Math.sin(T * 10 + 1)) });
      },
    },
    { a: 9, b: 11.6, sky: 'woods', // 3. who's that up in the tree? (looking up at the owl)
      cam() { setCam(0, -60, 70, 66); },
      world(t) {
        const v = vis(); fill(v.y0, '#4a7a52'); for (let i = 0; i < 9; i++) pine(-60 + i * 16, -20 + (i % 3) * 6, 50, '#2a5a34', '#3a6a40');
        owlTree(-50, 40, v.y0, -43, 30, -40);
        owl(0, -41, 1, { hoot: t > 9.3 && t < 10.3 && Math.floor(T * 6) % 2, blink: t > 10.6 && t < 10.75, look: t > 10.8 ? 1 : 0 });
      },
      words: [[9.3, 'HOO HOO!', () => [0, -66], true]],
    },
    { a: 11.6, b: 14.3, sky: 'woods', // 4. two puzzled heads tilt
      cam() { setCam(-6, -24, 104, 70); },
      world(t) {
        forestSet();
        owlTree(66, 30, vis().y0, 59, 2, -64);
        owl(26, -65, 1, { look: -1, blink: t > 13.2 && t < 13.35 });
        vizsla(-4, 8, 1, 1, { pose: t > 12 ? 'tilt' : 'stand' });
        husky(-50, 9, 1, 1, { pose: 'stand', pant: true, hop: t > 12.4 && t < 12.7 ? 2 : 0 });
      },
      words: [[12.1, '?', () => [6, -30]], [12.6, '?', () => [-26, -34]]],
    },
    { a: 14.3, b: 16.2, sky: 'woods', // 5. the owl swoops down to come along; the dogs trot on
      cam() { setCam(20, -30, 150, 100); },
      words: [[15.3, 'HOO!', t => [lerp(26, walk(t, 14.8, 16.2, -30, 60) + 6, eout(seg(t, 14.4, 16))), -62]]],
      world(t) {
        forestSet();
        const k = eout(seg(t, 14.4, 16));
        owlTree(66, 30, vis().y0, 59, 2, -64);
        const x = walk(t, 14.8, 16.2, -30, 60);
        if (k <= 0) owl(26, -65, 1, {});
        else owl(lerp(26, x + 6, k), lerp(-65, -46, k) - Math.sin(k * Math.PI) * 10, 1, { fly: true, sc: k < 0.35 ? 1 : k < 0.7 ? 0.8 : 0.6 });
        husky(x - 52, 9, 1, 1, { run: t > 14.8, step: step(), pant: true });
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
        owlFly((hx + vx) / 2 + 12, -50);
        const shaking = t > 20.2 && t < 21.4, jit = shaking ? (Math.floor(T * 30) % 2 ? 1 : -1) : 0;
        vizsla(vx, 6 - vh, 1, 1, { pose: t > 20.4 ? 'tilt' : 'stand', wet: t > 20.4, step: vh > 0 ? 1 : 0 });
        husky(hx + jit, 6 - hh, 1, 1, { pant: !shaking, step: hh > 0 ? 1 : 0, wag: shaking });
        const fk = seg(t, 17.9, 18.8);   // a fish leaps in the open water ahead
        if (fk > 0 && fk < 1) fish(lerp(24, 42, fk), 20 - Math.sin(fk * Math.PI) * 30, fk < 0.5);
      },
      upd(t) {
        for (const ti of [17.9, 18.8]) if (t >= ti && t - 1 / 30 < ti) spawn(10, () => ({ x: sx(ti < 18 ? 24 : 42), y: sy(18), vx: rand(-50, 50), vy: rand(-90, -30), g: 220, life: 0.6, max: 0.6, s: Math.max(1, cam.z), c: Math.random() < 0.5 ? '#bfe6ff' : '#ffffff' }));
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
        owlFly(-30 - back, -48 - j * 1.6);
        vizsla(-10 - back, 8, 1, 1, { hop: j, bark: t > 26.3 && t < 26.8 });
        husky(-58 - back, 9, 1, 1, { hop: j * 0.8, bark: t > 26.6 && t < 27.1 });
        bear(60, 12, -1, 1, {});
      },
      words: [[26.3, 'WOOF!', () => [0, -36]]],
    },
    { a: 27.6, b: 30.6, sky: 'woods', // 9. the bear yawns, waves and goes back to its berries (with the owl on its head); the dogs tiptoe past
      words: [[30, 'HOO!', () => [70, -30]]],
      cam(t) { setCam(t < 29 ? 40 : Math.max(20, Math.min(60, walk(t, 28.8, 30.6, -70, 110) - 26)), -20, 170, 100); },
      world(t) {
        forestSet();
        const sitting = t > 29.1;
        if (!sitting) bear(40, 12, 1, 1, { stand: true, yawn: t < 28.6, wave: t >= 28.6 });
        else { bear(48, 12, 1, 1, {}); for (let i = 0; i < 5; i++) circle(80 + i * 4, 6 - (i % 2) * 3, 1, '#5a3aa8'); }
        for (const [bx, by, r] of [[78, 6, 10], [92, 8, 8]]) circle(bx, by, r, '#3a7a34');
        const ok = seg(t, 29.2, 29.8);
        if (ok < 1) owlFly(lerp(10, 70, ok), lerp(-58, -24, ok));
        else owl(70, -17, 1, { sc: 0.6, blink: Math.floor(T * 1.5) % 4 === 0 });
        const x = walk(t, 28.8, 30.6, -70, 110);
        husky(x - 50, 26, 1, 1, { step: 1, pant: true });
        vizsla(x, 25, 1, 1, { step: 1 });
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
      words: [[34.3, 'HOO!', () => [-50, -66]]],
      cam(t) { setCam(t < 35.4 ? -24 : -24 + walk(t, 35.4, 37.2, 0, 60), -18, 160, 96); },
      world(t) {
        const v = vis();
        cloudRow(0.6, -76); hills(-40, 22, 0.025, 6, '#9a9aa8', 0.4); fill(-20, '#b0aab0', 0); fill(0, '#c4b89a'); strokes(1, v.y1, '#a89a7a', 0.15, 8);
        for (const [rx, ry, r] of [[-90, -4, 12], [80, -2, 14], [110, 4, 9]]) { ellipse(rx, ry, r, r * 0.6, '#8a8a92'); ellipse(rx - 2, ry - 2, r - 3, r * 0.4, '#a8a8b0'); }
        const k = seg(t, 34.2, 36.4);
        if (k <= 0) snake(10, 14, 1, { wink: t > 33.8 && t < 34 });
        else snake(10 + k * 140, 18, 1, { slither: true, go: k * 140 });
        const back = Math.sin(seg(t, 33.2, 33.8) * Math.PI) * 8, go = walk(t, 35.4, 37.2, 0, 60);
        owlFly(-50 + go, -52);
        vizsla(-36 - (t < 33.8 ? back : 0) + go, 12, 1, 1, { hop: t < 33.8 ? back : 0, run: go > 0, step: step() });
        husky(-86 - (t < 33.8 ? back : 0) + go, 13, 1, 1, { hop: t < 33.8 ? back * 0.8 : 0, run: go > 0, step: 1 - step(), pant: true });
      },
    },
    { a: 37.2, b: 44, sky: 'snow', fx: 'snow', // 12. up the mountain, from the trees through the rocks into the snow
      gy: x => 30 - x * 0.5,
      dogX: t => walk(t, 37.3, 43.8, -110, 230),
      cam(t) { const x = this.dogX(t); setCam(x - 24, this.gy(x - 24) - 16, 150, 100); },
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
        const x = this.dogX(t), hx = x - 50;
        owlFly(x - 18, this.gy(x) - 42);
        husky(hx, this.gy(hx) + 2, 1, 1, { run: true, step: step(), pant: true, wag: this.gy(hx) < -50 });
        vizsla(x, this.gy(x) + 2, 1, 1, { run: true, step: 1 - step(), wag: true });
      },
    },
    { a: 44, b: 48.4, sky: 'snow', fx: 'snow', // 13. the snowy top: the husky plays in the snow, the Vizsla shivers, then spots something!
      cam() { setCam(0, -24, 130, 84); },
      world(t) {
        const v = vis(); cloudRow(0.5, -70);
        hills(-30, 24, 0.03, 7, '#c8d4e4'); fill(-10, '#f4f6fa'); for (let i = 0; i < 40; i++) R(v.x0 + hsh(i) * (v.x1 - v.x0), -8 + hsh(i * 3) * 30, 3, 1, '#dce4ee'); fore(14, 'snow', 7);
        const play = t < 46.6, hop = play ? Math.abs(Math.sin(T * 8)) * 8 : 0, hx = play ? Math.sin(T * 3) * 20 - 20 : -24;
        husky(hx, 10, play ? (Math.cos(T * 3) > 0 ? 1 : -1) : 1, 1, { hop, pant: true, wag: true, run: play, step: step() });
        const shiver = t < 46 ? (Math.floor(T * 24) % 2) : 0;
        vizsla(22 + shiver, 9, 1, 1, { pose: t > 46.8 ? 'point' : 'stand' });
        const up = seg(t, 46.9, 47.8);
        if (up <= 0) owl(39 + shiver, -28, 1, { sc: 0.6, blink: Math.floor(T * 1.3) % 5 === 0 });
        else owlFly(39 + up * 20, -28 - up * 26);
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
        butterflies(x - 60, x + 80, -6, 3, 3);
        const hopAway = seg(t, 51.4, 52.6);
        bunny(150 + hopAway * 60, 16 - Math.abs(Math.sin(hopAway * 12)) * 6 * (hopAway > 0 ? 1 : 0), 1, { up: t > 50.6 });
        owlFly(Math.min(x + 44, 112), -46);
        husky(x - 52, 14, 1, 1, { run: true, step: step(), pant: true, hop: Math.abs(Math.sin(T * 12)) * 3 });
        vizsla(x, 12, 1, 1, { run: true, step: 1 - step(), hop: Math.abs(Math.sin(T * 12 + 1)) * 3 });
      },
      upd(t) { if (Math.random() < 0.3) sparkle(sx(110), sy(-8), 40 * cam.z / 2, 1, '#fff6b0'); },
    },
    { a: 52.6, b: 60, sky: 'dusk', fx: 'fireflies', // 15. chomp! both ends of the giant bone, tails wagging, as the sun goes down
      cam(t) { const k = eout(seg(t, 56.6, 59)); setCam(0, -14 - k * 10, lerp(124, 190, k), lerp(64, 110, k)); },
      world(t) {
        const v = vis();
        circle(0, -40, 22, '#ffd27a'); circle(0, -40, 18, '#ffe6a0');
        hills(-30, 16, 0.03, 9, '#c49a7a'); fill(-16, '#8ab85a'); strokes(-14, v.y1, '#6a9a4a', 0.12, 10); fore(14, 'meadow', 10);
        bone(0, 6, 40, false);
        const chomp = Math.floor(T * 5) % 2, land = eout(seg(t, 52.8, 53.8));
        if (land < 1) owlFly(lerp(-40, 0, land), lerp(-60, -6, land));
        else owl(0, -3, 1, { sc: 0.6, hoot: t > 56.2 && t < 57 && Math.floor(T * 6) % 2, blink: Math.floor(T * 1.2) % 5 === 0 });
        vizsla(-36, 10 - chomp, 1, 1, { pose: 'chew', wag: true });
        husky(37, 11 - (1 - chomp), -1, 1, { pose: 'chew', wag: true });
      },
      upd(t) { if (Math.random() < 0.08) st.hearts.push({ x: rand(W * 0.3, W * 0.7), y: sy(-24), vy: -rand(14, 24) * cam.z, life: 1.6, r: Math.max(4, Math.round(cam.z * 3)) }); },
      words: [[53.2, 'CRUNCH!', () => [-18, -26]], [54.8, 'CRUNCH!', () => [18, -26]], [56.2, 'HOO!', () => [0, -22]], [57.4, 'YUM!', () => [0, -34], true]],
    },
  ];

  /* ---------- scene plumbing (with pause and a draggable timeline) ---------- */
  const st = { t: 0, done: false, fired: {}, saved: null, paused: false, ui: 0, drag: null, beat: -1, hearts: [] };
  const shotAt = t => { for (let i = 0; i < SHOTS.length; i++) if (t < SHOTS[i].b) return SHOTS[i]; return SHOTS[SHOTS.length - 1]; };
  function camNow() { const s = shotAt(st.t); s.cam.call(s, st.t); return s; }
  function seek(t) { stopMusic(); st.t = Math.max(0, Math.min(END - 0.05, t)); st.fired = {}; parts = []; st.hearts = []; camNow(); }
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
    enter() { Object.assign(st, { t: 0, done: false, fired: {}, paused: false, ui: 0, drag: null, beat: -1, hearts: [] }); if (!st.saved) st.saved = clouds; clouds = []; loadAudio(); },
    leave() { stopMusic(); if (st.saved) { clouds = st.saved; st.saved = null; } },
    update(dt) {
      if (st.done) return;
      st.ui = Math.max(0, st.ui - dt);
      if (st.paused || st.drag != null) { stopMusic(); camNow(); return; }
      st.t += dt;
      const s = camNow();
      if (!musicTick()) tuneTick();
      for (const sh of SHOTS) (sh.words || []).forEach(([wt, word], i) => { const key = sh.a + ':' + i; if (st.t >= wt && st.t < wt + 0.3 && !st.fired[key]) { st.fired[key] = true; playWord(word); } });
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
      const fx = shotAt(st.t).fx;
      if (fx === 'snow') for (let i = 0; i < 40; i++) { const y = ((i * 53.7 + T * (18 + (i % 4) * 6)) % (H + 10)) - 5, x = ((i * 97.3 + Math.sin(T + i) * 8) % (W + 10)) - 5; R(x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#ffffff'); }
      if (fx === 'fireflies') for (let i = 0; i < 14; i++) {
        const x = W * (0.5 + 0.45 * Math.sin(T * 0.3 + i * 1.7)), y = H * (0.3 + 0.3 * hsh(i) + 0.05 * Math.sin(T * 0.8 + i)), on = 0.5 + 0.5 * Math.sin(T * 3 + i * 2);
        alpha(on * 0.35, () => circle(x, y, 3, '#fff27a')); alpha(on, () => R(x, y, 2, 2, '#fffbd0'));
      }
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
    _st: st, _jump(t) { seek(t); }, _audio: () => ({ sfx: Object.keys(bufs), music: !!music.buf, playing: !!music.src }), _spr: { vizsla, husky, owl, bear, snake },
  };
})();
