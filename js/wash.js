// "Car Wash": a muddy emergency vehicle rolls into the wash bay. Scrub the mud into foam,
// rinse the foam away, then rub it until it shines. Every touch cleans something.
'use strict';
(() => {
  const Z = 2;                                   // the vehicle is drawn twice as big as elsewhere
  const OW = 72, OH = 48, OX = 3, OYB = 44;      // offscreen sprite canvas; the vehicle sits at (OX, OYB)
  const vc = document.createElement('canvas'); vc.width = OW; vc.height = OH;
  const vg = vc.getContext('2d');
  const Y = {};                                  // this scene's layout, recomputed in layout()
  const F = {
    state: 'off', vi: VI.fire, step: 0, spots: [], x: 0, held: null, px: 0, py: 0, drag: 0, rub: 0,
    spray: 0, aimX: 0, aimY: 0, nt: 0, doneT: 0, honked: false, idle: 0, spin: 0, rollFast: 0,
    puddle: 0, cheer: 0, duckHop: 0, bigDuckHop: 0, wig: [0, 0, 0], notes: 0, lastNote: 0, jump: 0, t: 0,
  };
  let bubbles = [];
  const rubSound = noiseLoop(650, 0.9), spraySound = noiseLoop(1400, 0.7);
  const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
  const TOOL = [
    { bg: '#ff6fb4', dark: '#c73d84', fill: '#ffb3da' },   // sponge
    { bg: '#2a6fe0', dark: '#1a3f9a', fill: '#6fb6ff' },   // hose
    { bg: '#8a4fd9', dark: '#55289a', fill: '#c39bff' },   // towel
  ];
  const DUCK = { fire: [29, 5], police: [7, 14], amb: [22, 6] };   // rubber duck: x from OX, y from the roof line
  const MUD = ['#7a5230', '#5a3a1e', '#9c6d3f'];

  /* ---------- layout ---------- */
  function layout() {
    const uw = W - L.safeL - L.safeR;
    Y.floorD = Math.max(14, Math.min(24, Math.round((L.palY - L.safeT) * 0.05)));
    Y.fy = L.palY - Y.floorD;                    // where the back wall meets the floor
    Y.vyb = Y.fy + Math.min(8, Y.floorD - 5);    // bottom of the wheels
    Y.vy = Y.vyb - OYB * Z;                      // top of the offscreen sprite on screen
    Y.bayW = Math.min(uw - 8, 66 * Z + 60);
    Y.bayX = Math.round(L.cx - Y.bayW / 2);
    Y.bayCx = Y.bayX + Y.bayW / 2;
    Y.bayTop = Y.vyb - 38 * Z - 26;
    const side = uw >= Y.bayW + 96;              // room for the attendant beside the bay
    const bw = Math.min(uw - 4, Y.bayW + (side ? 150 : 40));
    Y.bx0 = Math.round(L.cx - bw / 2); Y.bx1 = Y.bx0 + bw;
    Y.top = Math.max(L.safeT + 4, Math.min(Math.round(H * 0.3), Y.bayTop - 44));
    // keep the sun clear when the roof is up in its corner
    if (Y.top < L.sunY + 32 && Y.bx1 > L.sunX - 30 && L.sunX - 30 >= Y.bayX + Y.bayW + 8) Y.bx1 = L.sunX - 30;
    const areaT = Y.top + 9, areaB = Y.bayTop - 12, area = Math.max(16, areaB - areaT);
    const sh = Math.min(area, 100);
    const sw = Math.min(Y.bayW - 6, Math.max(90, Math.round(sh * 2.6)));
    Y.sign = { x: Math.round(Y.bayCx - sw / 2), y: areaT + Math.floor((area - sh) / 2), w: sw, h: sh };
    Y.att = side ? { x: Y.bayX + Y.bayW + 24, yb: Y.vyb, roof: false } : { x: Y.bx1 - 22, yb: Y.top - 4, roof: true };
    if (Y.att.roof && Math.abs(Y.att.x - L.sunX) < 34 && Y.top - 26 < L.sunY + 30) Y.att.x = Y.bx0 + 54;   // not under the sun
    // the giant duck sits on the roof, or on the floor beside the bay when the roof is too high up
    if (Y.top - 26 >= L.safeT) Y.duck = { x: Y.bx0 + 24, yb: Y.top - 4 };
    else if (Y.bayX - 36 >= L.safeL + 14) Y.duck = { x: Y.bayX - 26, yb: Y.vyb + 2 };
    else Y.duck = null;
    Y.hillY = Y.fy - 40;
    Y.nozX = Y.bayX + 15; Y.nozY = Y.bayTop + 20;
    // portholes on the facade beside the bay, when there's room
    Y.ports = [];
    const lw = Y.bayX - 6 - Y.bx0, rw = Y.bx1 - (Y.bayX + Y.bayW + 6);
    const py = Math.round((Y.bayTop + Y.fy) / 2) - 12;
    if (lw >= 34) Y.ports.push({ x: Y.bx0 + Math.round(lw / 2), y: py });
    if (rw >= 34 && !side) Y.ports.push({ x: Y.bx1 - Math.round(rw / 2), y: py });
    if (side && rw >= 34) Y.ports.push({ x: Y.bx1 - Math.round(rw / 2), y: Y.bayTop + 14 });
    // tool buttons in the bottom strip
    const tb = Math.max(28, Math.min(L.palH - 8, 42));
    const left = L.homeBtn.x + L.homeBtn.s + 8, right = W - L.safeR - 6;
    const span = Math.min((right - left) / 3, tb + 30);
    const g0 = left + ((right - left) - span * 3) / 2;
    Y.tools = [0, 1, 2].map(k => ({ x: Math.round(g0 + span * (k + 0.5) - tb / 2), y: L.palY + Math.floor((L.palH - tb) / 2), s: tb }));
    if (scene === 'wash') setClouds(L.safeT + 10, Math.max(L.safeT + 30, Y.top - 26));
    if (F.state === 'work' || F.state === 'next' || F.state === 'done') F.x = targetX();
  }
  const targetX = () => Math.round(Y.bayCx - (OX + V[F.vi].len / 2) * Z);
  function vbox(pad = 0) {   // the vehicle on screen
    const v = V[F.vi];
    return { x: F.x + OX * Z - pad, y: Y.vy - F.jump + (OYB - v.h) * Z - pad, w: v.len * Z + 2 * pad, h: v.h * Z + 2 * pad };
  }
  function onVehicle(x, y, pad) { const b = vbox(pad); return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h; }
  const spotXY = s => [F.x + (s.lx + 0.5) * Z, Y.vy - F.jump + (s.ly + 0.5) * Z];

  /* ---------- a new muddy vehicle ---------- */
  function makeSpots() {
    const prev = g; g = vg;
    vg.clearRect(0, 0, OW, OH);
    drawV(F.vi, OX, OYB, false, 0, 0);
    g = prev;
    let data = null;
    try { data = vg.getImageData(0, 0, OW, OH).data; } catch (e) { /* fall back to the bounding box */ }
    const v = V[F.vi], solid = (x, y) => !data || data[(y * OW + x) * 4 + 3] > 0;
    const cand = [];
    for (let y = OYB - v.h + 2; y <= OYB - 6; y++) for (let x = OX + 2; x < OX + v.len - 2; x++) {
      if (solid(x, y) && solid(x - 2, y) && solid(x + 2, y) && solid(x, y - 2) && solid(x, y + 2)) cand.push([x, y]);
    }
    const n = 16 + (Math.random() * 7 | 0);
    F.spots = [];
    for (let tries = 0; tries < 900 && F.spots.length < n && cand.length; tries++) {
      const [x, y] = pickOne(cand);
      const minD = tries < 600 ? 7 : 4;
      if (F.spots.some(s => (s.lx - x) ** 2 + (s.ly - y) ** 2 < minD * minD)) continue;
      const r = 2 + (Math.random() < 0.45 ? 1 : 0);
      const blobs = [[0, 0, r]];
      for (let k = 0; k < 2; k++) blobs.push([Math.round(rand(-2.5, 2.5)), Math.round(rand(-1.5, 1.5)), r - 1]);
      F.spots.push({ lx: x, ly: y, r, blobs, st: 0, foam: 1, t: 9, seed: rand(0, 10), drip: Math.random() < 0.5 ? 1 + (Math.random() * 3 | 0) : 0, dripX: Math.round(rand(-1, 1)) });
    }
  }
  function newVehicle() {
    F.state = 'arrive'; F.step = 0; F.t = 0; F.x = -OW * Z - 10; F.jump = 0;
    F.held = null; F.spray = 0; F.idle = 0; F.notes = 0; F.honked = false; F.doneT = 0;
    makeSpots();
    say(pick(V[F.vi].kind), true);
  }
  const want = () => [0, 1, 2][F.step];
  const left = () => F.spots.filter(s => s.st === want()).length;

  /* ---------- cleaning ---------- */
  function note(kind) {
    if (T - F.lastNote < 0.06) return;
    F.lastNote = T;
    const f = NOTES[F.notes++ % NOTES.length];
    if (kind === 0) { tone('sine', f, 0, 0.1, 0.12, f * 1.4); noise(0, 0.06, 0.05, 2600, 2); }
    else if (kind === 1) tone('sine', f, 0, 0.14, 0.12, f * 0.6);
    else { tone('triangle', f * 2, 0, 0.3, 0.07); tone('sine', f * 4, 0.04, 0.22, 0.03); }
  }
  function convert(s) {
    const [sx, sy] = spotXY(s);
    if (F.step === 0) {
      s.st = 1; s.foam = 1; s.t = 0; F.rollFast = 0.7;
      addBubble(sx + rand(-4, 4), sy - 4, rand(2, 4));
      if (Math.random() < 0.6) addBubble(sx + rand(-6, 6), sy - 2, rand(2, 3));
      spawn(4, () => ({ x: sx, y: sy, vx: rand(-30, 30), vy: rand(-40, -10), g: 120, life: 0.5, max: 0.5, s: 2, c: '#ffffff' }));
      note(0);
    } else if (F.step === 2) {
      s.st = 3; s.t = 0;
      sparkle(sx, sy, 7, 6, Math.random() < 0.5 ? '#ffffff' : '#fff27a');
      note(2);
    }
  }
  // Scrub or polish everything near (x, y); with assist, also the nearest spot within reach.
  function rubAt(x, y, assist) {
    let hit = 0;
    for (const s of F.spots) {
      if (s.st !== want()) continue;
      const [sx, sy] = spotXY(s);
      if ((x - sx) ** 2 + (y - sy) ** 2 < (11 + s.r * Z * 0.5) ** 2) { convert(s); hit++; }
    }
    if (!hit && assist) {
      let best = null, bd = assist * assist;
      for (const s of F.spots) {
        if (s.st !== want()) continue;
        const [sx, sy] = spotXY(s), d = (x - sx) ** 2 + (y - sy) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      if (best) { convert(best); hit++; }
    }
    return hit;
  }
  function aimAt(x, y) {   // the hose snaps to the nearest foam within reach
    let best = null, bd = (onVehicle(x, y, 14) ? 70 : 40) ** 2;
    for (const s of F.spots) {
      if (s.st !== 1) continue;
      const [sx, sy] = spotXY(s), d = (x - sx) ** 2 + (y - sy) ** 2;
      if (d < bd) { bd = d; best = [sx, sy]; }
    }
    [F.aimX, F.aimY] = best || [x, Math.min(y, Y.vyb - 2)];
  }
  function addBubble(x, y, r) {
    if (bubbles.length >= 40) bubbles.shift();
    bubbles.push({ x, y, r, vy: rand(-16, -8), seed: rand(0, 6), life: rand(3, 6) });
  }
  function finish() {
    F.state = 'done'; F.doneT = 0; F.held = null; F.honked = false; F.cheer = 3;
    SFX.fanfare(); say(pick('praise'));
    sparkle(F.x + (OX + V[F.vi].len / 2) * Z, Y.vyb - V[F.vi].h, V[F.vi].len, 16);
  }

  /* ---------- update ---------- */
  function update(dt) {
    if (F.state === 'off') return;
    const v = V[F.vi];
    F.t += dt;
    if (F.state === 'arrive') {
      const tx = targetX();
      const sp = Math.max(30, Math.min(170, (tx - F.x) * 2.5));
      F.x = Math.min(tx, F.x + sp * dt); v.rot += sp * dt / 12;
      if (F.x >= tx) {
        F.state = 'work'; F.idle = 0; F.wig[0] = 1; SFX.brake();
        if (v.stopSiren) { v.stopSiren(); v.stopSiren = null; }
      }
    } else if (F.state === 'exit') {
      const sp = Math.min(240, 30 + F.t * 220);
      F.x += sp * dt; v.rot += sp * dt / 12;
      if (F.x > W + 10) { F.vi = (F.vi + 1) % 3; newVehicle(); }
    } else if (F.state === 'work') {
      if (F.held === null) F.idle += dt; else F.idle = 0;
      if (F.step === 1) {
        if (F.held !== null) { F.spray = 0.25; aimAt(F.px, F.py); }
        if (F.spray > 0) {
          F.puddle = Math.min(1, F.puddle + dt * 0.25);
          spawn(3, () => ({ x: F.aimX, y: F.aimY, vx: rand(-40, 40), vy: rand(-60, -10), g: 260, life: 0.45, max: 0.45, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.5 ? '#6fc8ff' : '#ffffff' }));
          for (const s of F.spots) {
            if (s.st !== 1) continue;
            const [sx, sy] = spotXY(s);
            if ((F.aimX - sx) ** 2 + (F.aimY - sy) ** 2 < (15 + s.r * Z) ** 2) {
              s.foam -= dt * 4;
              if (Math.random() < dt * 20) parts.push({ x: sx + rand(-3, 3), y: sy, vx: rand(-8, 8), vy: rand(0, 20), g: 200, life: 0.6, max: 0.6, s: 2, c: '#ffffff' });
              if (s.foam <= 0) {
                s.st = 2; s.t = 0; note(1);
                spawn(5, () => ({ x: sx + rand(-4, 4), y: sy + 2, vx: rand(-6, 6), vy: rand(0, 15), g: 220, life: 0.8, max: 0.8, s: 1, c: '#9fdcff' }));
              }
            }
          }
        }
      }
      if (F.state === 'work' && !left()) {
        if (F.step === 2) finish();
        else { F.state = 'next'; F.nt = 0; F.held = null; F.cheer = 1.4; SFX.chime(); sparkle(F.x + (OX + v.len / 2) * Z, Y.vyb - v.h, v.len * 0.8, 10, '#ffffff'); }
      }
    } else if (F.state === 'next') {
      F.nt += dt;
      if (F.nt > 1.1) { F.step++; F.state = 'work'; F.idle = 0; F.notes = 0; F.wig[F.step] = 1; SFX.boop(1.3); }
    } else if (F.state === 'done') {
      F.doneT += dt;
      if (F.doneT < 1.8) confetti(3);
      if (!F.honked && F.doneT > 0.8) { F.honked = true; SFX.honk(); }
      F.jump = F.doneT < 2.4 ? Math.round(Math.abs(Math.sin(F.doneT * 6)) * 4) : 0;
      if (Math.random() < dt * 3) { const b = vbox(); addBubble(rand(b.x, b.x + b.w), b.y + rand(0, 10), rand(2, 4)); }
    }
    if (F.state !== 'done') F.jump = 0;
    F.spray = Math.max(0, F.spray - dt);
    spraySound(F.spray > 0 && F.state === 'work' && F.step === 1 ? 0.32 : 0);
    F.rub = Math.max(0, F.rub - dt);
    rubSound(F.rub > 0 && F.state === 'work' && F.step !== 1 ? 0.22 : 0);
    F.rollFast = Math.max(0, F.rollFast - dt);
    F.spin += dt * (F.rollFast > 0 ? 28 : F.state === 'work' && F.step === 0 ? 7 : 2.5);
    if (F.spray <= 0) F.puddle = Math.max(0, F.puddle - dt * 0.03);
    F.cheer = Math.max(0, F.cheer - dt);
    F.duckHop = Math.max(0, F.duckHop - dt * 2.5); F.bigDuckHop = Math.max(0, F.bigDuckHop - dt * 2.5);
    for (let k = 0; k < 3; k++) F.wig[k] = Math.max(0, F.wig[k] - dt * 1.5);
    for (const s of F.spots) s.t += dt;
    // foam keeps fizzing out little bubbles
    const foamy = F.spots.filter(s => s.st === 1);
    if (foamy.length && Math.random() < dt * 2.5) { const [sx, sy] = spotXY(pickOne(foamy)); addBubble(sx + rand(-3, 3), sy - 3, rand(1.5, 3.5)); }
    for (const b of bubbles) { b.life -= dt; b.y += b.vy * dt; b.x += Math.sin(T * 2.2 + b.seed) * 7 * dt; }
    bubbles = bubbles.filter(b => {
      if (b.life > 0 && b.y > L.safeT - 10) return true;
      spawn(3, () => ({ x: b.x, y: b.y, vx: rand(-15, 15), vy: rand(-15, 5), g: 0, life: 0.25, max: 0.25, s: 1, c: '#ffffff' }));
      return false;
    });
  }

  /* ---------- input ---------- */
  function tap(x, y, id) {
    if (inBox(L.homeBtn, x, y)) { F.held = null; spraySound(0); rubSound(0); returnHome(F.vi); return true; }
    if (PETS.tap('wash', x, y)) return true;
    if (F.state === 'done') {
      if (F.doneT > 1.2 && inBox(L.againBtn, x, y)) { F.state = 'exit'; F.t = 0; SFX.bell(); return true; }
    } else if (F.state !== 'exit') {
      for (let k = 0; k < 3; k++) if (inBox(Y.tools[k], x, y)) {
        SFX.boop(k === F.step ? 1.3 : 0.8);
        F.wig[F.step] = 1; F.idle = 9;   // show how to use the tool
        return true;
      }
    }
    if (y >= L.palY) return true;
    // pop a bubble
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if ((x - b.x) ** 2 + (y - b.y) ** 2 < (b.r + 8) ** 2) {
        bubbles.splice(i, 1); SFX.pop(); sparkle(b.x, b.y, 4, 5, '#ffffff');
        if (F.state !== 'work') return true;
        break;
      }
    }
    // the rubber duck on the roof of the vehicle, the big duck on the building, the attendant
    if (F.state !== 'off') {
      const [dx, dy] = duckXY();
      if ((x - dx) ** 2 + (y - dy) ** 2 < 14 * 14) { F.duckHop = 1; SFX.quack(); }
    }
    if (Y.duck && Math.abs(x - Y.duck.x) < 18 && y > Y.duck.yb - 30 && y < Y.duck.yb + 4) { F.bigDuckHop = 1; SFX.quack(); return true; }
    if (Math.abs(x - Y.att.x) < 12 && y > Y.att.yb - 26 && y < Y.att.yb + 2) { F.cheer = 1.5; SFX.boop(1.5); return true; }
    if (F.state === 'work') {
      F.held = id; F.px = x; F.py = y; F.drag = 0; F.idle = 0;
      if (F.step === 1) { F.spray = 0.5; aimAt(x, y); }
      else { F.rub = 0.25; rubAt(x, y, onVehicle(x, y, 18) ? 9999 : 50); }
      return true;
    }
    addBubble(x, y, rand(2, 4)); SFX.pop();
    return true;
  }
  function move(x, y, id) {
    if (id !== F.held || F.state !== 'work') return;
    const d = Math.hypot(x - F.px, y - F.py);
    F.px = x; F.py = y;
    if (F.step === 1) return;
    if (d > 0.5) F.rub = 0.15;
    F.drag += d;
    if (rubAt(x, y, 0)) F.drag = 0;
    else if (F.drag > 34 && onVehicle(x, y, 22)) { rubAt(x, y, 9999); F.drag = 0; }
  }
  function release(id) { if (id === F.held) F.held = null; }

  /* ---------- drawing helpers ---------- */
  function scaled(x, y, s, fn) { g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(s, s); fn(); g.restore(); }
  function ring(cx, cy, r, c) {
    const n = Math.max(8, Math.round(r * 6));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; R(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 1, c); }
  }
  function drawBubble(x, y, r) {
    alpha(0.3, () => circle(x, y, r, '#dff4ff'));
    alpha(0.9, () => ring(x, y, r, '#ffffff'));
    R(x - r * 0.5, y - r * 0.6, 2, 1, '#ffffff');
  }
  // Tool pictures: 0 sponge, 1 hose nozzle, 2 towel with a sparkle.
  function drawTool(k, cx, cy, s) {
    const u = Math.max(1, Math.floor(s / 14));
    cx = Math.round(cx); cy = Math.round(cy);
    if (k === 0) {
      R(cx - 6 * u, cy - 2 * u, 12 * u, 7 * u, '#ffd21f'); R(cx - 6 * u, cy + 3 * u, 12 * u, 2 * u, '#e0a810');
      R(cx - 4 * u, cy, u, u, '#e0a810'); R(cx + u, cy + u, u, u, '#e0a810'); R(cx + 3 * u, cy - u, u, u, '#e0a810'); R(cx - u, cy - u, u, u, '#e0a810');
      circle(cx - 3 * u, cy - 3 * u, 2 * u, '#ffffff'); circle(cx + u, cy - 4 * u, 2 * u, '#ffffff'); circle(cx + 4 * u, cy - 3 * u, Math.max(1, 1.5 * u), '#ffffff');
    } else if (k === 1) {
      R(cx - 6 * u, cy - 3 * u, 8 * u, 3 * u, '#cfd6dd'); R(cx - 6 * u, cy - u, 8 * u, u, '#8b96a1');
      R(cx + 2 * u, cy - 3 * u, 2 * u, 3 * u, '#5b6470');
      R(cx - 5 * u, cy, 3 * u, 5 * u, '#3fb43a'); R(cx - 5 * u, cy + 4 * u, 3 * u, u, '#1f7a2a');
      R(cx - u, cy, u, 2 * u, '#5b6470');
      R(cx + 5 * u, cy - 2 * u, 2 * u, u, '#ffffff'); R(cx + 5 * u, cy - 5 * u, u, 2 * u, '#9fdcff'); R(cx + 7 * u, cy - 4 * u, u, 2 * u, '#9fdcff');
      R(cx + 5 * u, cy + u, u, 2 * u, '#9fdcff'); R(cx + 7 * u, cy, u, 2 * u, '#9fdcff'); R(cx + 8 * u, cy - 2 * u, u, u, '#ffffff');
    } else {
      R(cx - 6 * u, cy - u, 9 * u, 7 * u, '#ff6fb4'); R(cx - 6 * u, cy + 3 * u, 9 * u, u, '#ffffff'); R(cx - 6 * u, cy + 5 * u, 9 * u, u, '#c73d84');
      const sx = cx + 3 * u, sy = cy - 3 * u;
      R(sx - 3 * u, sy, 7 * u, u, '#fff27a'); R(sx, sy - 3 * u, u, 7 * u, '#fff27a'); R(sx - u, sy - u, 3 * u, 3 * u, '#fff27a'); R(sx, sy, u, u, '#ffffff');
    }
  }
  function bubbleIcon(cx, cy, s) {
    const u = s / 12;
    const b = (x, y, r) => { circle(x, y, r, '#ffffff'); circle(x, y, r - 1, '#9fdcff'); R(x - r * 0.5, y - r * 0.5, 2, 2, '#ffffff'); };
    b(cx - 1.5 * u, cy + 1 * u, Math.round(3.2 * u)); b(cx + 3 * u, cy - 2.5 * u, Math.round(2 * u)); b(cx + 3 * u, cy + 3 * u, Math.round(1.4 * u));
  }
  function duckXY() {
    const v = V[F.vi], [dx, dy] = DUCK[v.kind];
    return [F.x + (OX + dx) * Z, Y.vy - F.jump + (OYB - v.h + dy - 3) * Z];
  }

  /* ---------- the building ---------- */
  function drawBuilding() {
    const x0 = Y.bx0, x1 = Y.bx1, w = x1 - x0, top = Y.top;
    R(x0, top, w, Y.fy - top, '#8fdcf0');
    R(x0, top, 3, Y.fy - top, '#6cc4dc'); R(x1 - 3, top, 3, Y.fy - top, '#6cc4dc');
    // painted bubbles on the wall
    for (let i = 0; i < 9; i++) {
      const bx = x0 + 8 + ((i * 53) % Math.max(10, w - 16)), by = top + 14 + ((i * 37) % Math.max(10, Y.fy - top - 30));
      alpha(0.45, () => ring(bx, by, 2 + (i % 3), '#ffffff'));
    }
    // roof with a white scalloped trim
    R(x0 - 3, top - 5, w + 6, 6, '#2a6fe0'); R(x0 - 3, top - 5, w + 6, 1, '#6fb6ff'); R(x0 - 3, top + 1, w + 6, 2, '#1a3f9a');
    for (let xx = x0 + 1; xx < x1 - 2; xx += 8) { R(xx, top + 3, 7, 2, '#ffffff'); R(xx + 1, top + 5, 5, 1, '#ffffff'); }
    for (const p of Y.ports) {
      circle(p.x, p.y, 13, '#ffffff'); circle(p.x, p.y, 11, '#3b8bd0'); circle(p.x - 2, p.y + 2, 9, '#5aa8e6');
      ring(p.x - 3, p.y + 2, 3, '#ffffff'); ring(p.x + 4, p.y - 3, 2, '#ffffff'); R(p.x - 6, p.y - 7, 3, 2, '#ffffff');
    }
    drawSign();
  }
  function drawSign() {
    const s = Y.sign;
    R(s.x + 2, s.y, s.w - 4, s.h, '#ffd21f'); R(s.x, s.y + 2, s.w, s.h - 4, '#ffd21f');
    R(s.x + 2, s.y + s.h - 2, s.w - 4, 2, '#c99410');
    R(s.x + 4, s.y + 4, s.w - 8, s.h - 8, '#2a6fe0');
    alpha(0.25, () => R(s.x + 4, s.y + 4, s.w - 8, Math.floor((s.h - 8) / 2), '#6fb6ff'));
    const inner = s.h - 8;
    const big = inner >= 76, sc = inner >= 48 && s.w >= 90 ? 2 : 1;
    const picH = big ? inner - 30 : inner;
    const cyb = s.y + 4 + Math.round(picH / 2 + 9 * sc);
    const cx = s.x + s.w / 2;
    scaled(cx - 17 * sc, cyb - 18 * sc, sc, () => drawCar(0, 18, COLOR.pink.c));
    // foam on the roof, drops and bubbles all around
    for (const [dx, dy, r] of [[-8, -14, 3], [-2, -16, 4], [5, -14, 3]]) circle(cx + dx * sc, cyb + dy * sc, r * sc, '#ffffff');
    for (const [dx, dy, r] of [[-26, -12, 3], [-22, -2, 2], [24, -14, 4], [28, -4, 2], [-30, -20, 2], [20, -22, 2]]) {
      if (Math.abs(dx * sc) + r * sc < s.w / 2 - 6) ring(cx + dx * sc, cyb + dy * sc, r * sc, '#ffffff');
    }
    if (big) {   // picture instructions: sponge, hose, towel
      const ry = s.y + s.h - 20, step = Math.min(34, (s.w - 20) / 3);
      for (let k = 0; k < 3; k++) {
        const ix = cx + (k - 1) * step;
        const now = F.step === k && (F.state === 'work' || F.state === 'next'), done = k < F.step || F.state === 'done' || F.state === 'exit';
        R(ix - 11, ry - 8, 22, 18, now ? '#ffffff' : '#1a3f9a');
        if (now) R(ix - 9, ry - 6, 18, 14, '#6fb6ff');
        drawTool(k, ix, ry + 1, 16);
        if (done) { R(ix + 5, ry + 4, 2, 2, '#3fb43a'); R(ix + 7, ry + 2, 2, 2, '#3fb43a'); R(ix + 9, ry, 2, 2, '#3fb43a'); R(ix + 3, ry + 2, 2, 2, '#3fb43a'); }
        if (k < 2) { const ax = ix + step / 2; R(ax - 1, ry - 1, 2, 3, '#ffd21f'); R(ax + 1, ry, 1, 1, '#ffd21f'); }
      }
    }
  }
  const bulbs = () => {
    const s = Y.sign, out = [];
    for (let x = s.x + 5; x <= s.x + s.w - 7; x += 8) { out.push([x, s.y + 1]); out.push([x, s.y + s.h - 3]); }
    for (let y = s.y + 9; y <= s.y + s.h - 10; y += 8) { out.push([s.x + 1, y]); out.push([s.x + s.w - 3, y]); }
    return out;
  };
  function drawBay() {
    const x = Y.bayX, w = Y.bayW, t = Y.bayTop, h = Y.fy - t;
    R(x, t, w, h, '#d8f0fa');
    for (let xx = x + 7; xx < x + w; xx += 8) R(xx, t, 1, h, '#bfe2f2');
    for (let yy = t + 7; yy < Y.fy; yy += 8) R(x, yy, w, 1, '#bfe2f2');
    R(x, t, w, 4, '#9cc8dc');
    // gantry with spray nozzles
    R(x + 3, t + 6, w - 6, 3, '#8b96a1'); R(x + 3, t + 6, w - 6, 1, '#cfd6dd');
    for (let xx = x + 10; xx < x + w - 8; xx += 14) R(xx, t + 9, 2, 2, '#5b6470');
    // lamps
    for (const lx of [x + Math.round(w * 0.3), x + Math.round(w * 0.7)]) { R(lx - 4, t + 4, 8, 2, '#5b6470'); R(lx - 3, t + 6, 6, 1, '#fff6c8'); }
    // posts and the striped awning
    for (const px of [x - 5, x + w - 1]) {
      R(px, t - 2, 6, h + 2, '#ffd21f'); R(px, t - 2, 1, h + 2, '#fff27a'); R(px + 5, t - 2, 1, h + 2, '#c99410');
    }
    const ax = x - 9, aw = w + 18, ay = t - 12;
    for (let i = 0; i * 8 < aw; i++) {
      const c = i % 2 ? '#ffffff' : '#ff6fb4', ww = Math.min(8, aw - i * 8);
      R(ax + i * 8, ay, ww, 8, c);
      if (ww >= 6) circle(ax + i * 8 + 3, ay + 8, 3, c);
    }
    R(ax, ay, aw, 1, '#c73d84');
  }
  function drawFloor() {
    R(0, Y.fy, W, L.palY - Y.fy, '#b9c2cc'); R(0, Y.fy, W, 1, '#8f99a5');
    R(Y.bayX, Y.fy, Y.bayW, L.palY - Y.fy, '#a3afbd');
    for (let xx = Y.bayX + 4; xx < Y.bayX + Y.bayW - 4; xx += 12) R(xx, L.palY - 4, 6, 2, '#ffd21f');
    if (F.puddle > 0.02) alpha(0.55 * F.puddle, () => {
      R(Y.bayX + 8, Y.vyb - 2, Y.bayW - 16, 5, '#6fc8ff');
      R(Y.bayX + 20, Y.vyb, 12, 1, '#ffffff'); R(Y.bayX + Y.bayW - 40, Y.vyb + 1, 8, 1, '#ffffff');
    });
  }
  function drawRollers() {
    if (F.state === 'off') return;
    const v = V[F.vi], tx = targetX();
    const xs = [Math.max(Y.bayX + 3, tx + OX * Z - 18), Math.min(Y.bayX + Y.bayW - 13, tx + (OX + v.len) * Z + 8)];
    const top = Y.bayTop + 9, bot = Y.vyb - 2;
    const COLS = ['#2a6fe0', '#6fb6ff', '#ffd21f', '#ff6fb4'];
    const fast = F.rollFast > 0;
    for (const x of xs) {
      R(x + 4, Y.bayTop + 6, 2, 4, '#5b6470');
      for (let c = 0; c < 10; c++) R(x + c, top + 2, 1, bot - top - 4, COLS[(Math.floor(F.spin) + (c >> 1)) % 4]);
      alpha(0.25, () => { R(x, top + 2, 2, bot - top - 4, '#1d1a2b'); R(x + 8, top + 2, 2, bot - top - 4, '#1d1a2b'); });
      for (let y = top + 3; y < bot - 3; y += 4) {
        const j = fast ? (Math.floor(F.spin + y) % 2) : 0;
        R(x - 1 - j, y, 1, 2, '#6fb6ff'); R(x + 10 + j, y + 2, 1, 2, '#6fb6ff');
      }
      R(x, top, 10, 3, '#8b96a1'); R(x, bot - 2, 10, 3, '#8b96a1');
    }
  }
  function drawHose() {
    const x = Y.nozX, t = Y.bayTop + 9;
    const sway = F.step === 1 && F.spray > 0 ? 1 : 0;
    R(x, t, 2, Y.nozY - t, '#3fb43a'); R(x + 1, t, 1, Y.nozY - t, '#1f7a2a');
    R(x - 1 + sway, Y.nozY, 4, 4, '#5b6470'); R(x + sway, Y.nozY + 4, 2, 2, '#cfd6dd');
  }

  /* ---------- the vehicle ---------- */
  function drawVehicle() {
    if (F.state === 'off') return;
    const v = V[F.vi];
    const moving = F.state === 'arrive' || F.state === 'exit';
    const bob = moving ? (Math.floor(F.x / 7) % 2 ? 0 : -1) : 0;
    const lit = F.state === 'done' || F.state === 'exit';
    const world = g;
    g = vg; vg.clearRect(0, 0, OW, OH);
    drawV(F.vi, OX, OYB, lit, bob, v.rot);
    const [dx, dy] = DUCK[v.kind];
    drawDuck(OX + dx, OYB - v.h + dy + bob - Math.round(Math.sin(F.duckHop * Math.PI) * 4), false, 1);
    vg.globalCompositeOperation = 'source-atop';
    for (const s of F.spots) {
      const y = s.ly + bob;
      if (s.st === 0) {
        for (const [bx, by, r] of s.blobs) circle(s.lx + bx, y + by, r, MUD[0]);
        R(s.lx, y + 1, 2, 1, MUD[1]); R(s.lx - 1, y - 1, 1, 1, MUD[2]);
        if (s.drip) R(s.lx + s.dripX, y + s.r, 1, s.drip, MUD[0]);
      } else if (s.st === 2) {
        R(s.lx, y, 1, 2, '#9fd2ef'); R(s.lx, y, 1, 1, '#ffffff'); R(s.lx + 2, y + 1, 1, 1, '#9fd2ef'); R(s.lx - 2, y + 2, 1, 1, '#bfe6ff');
      }
    }
    if (F.step === 2 && (F.state === 'work' || F.state === 'next')) {
      const n = F.spots.length || 1, k = F.spots.filter(s => s.st === 2).length / n;
      alpha(0.28 * k, () => R(0, 0, OW, OH, '#a89a84'));
    }
    if (F.state === 'done' || F.state === 'exit') {   // the gleam sweeping across
      const p = ((F.state === 'done' ? F.doneT : 0.5) % 2.4) / 0.9;
      if (p <= 1) {
        const bx = -24 + p * (OW + 30);
        alpha(0.8, () => { for (let y = 0; y < OH; y++) { R(bx + (OH - y) * 0.5, y, 4, 1, '#ffffff'); R(bx + 7 + (OH - y) * 0.5, y, 2, 1, '#ffffff'); } });
      }
    }
    vg.globalCompositeOperation = 'source-over';
    for (const s of F.spots) {
      if (s.st !== 1) continue;
      const grow = Math.min(1, 0.4 + s.t * 5);
      const rr = Math.max(1, Math.round((s.r + 1) * s.foam * grow)), y = s.ly + bob;
      circle(s.lx + 1, y + 1, rr, '#d6e6f2');
      circle(s.lx, y, rr, '#ffffff');
      if (rr >= 2) { circle(s.lx + rr, y - 1, rr - 1, '#ffffff'); circle(s.lx - rr + 1, y + 1, Math.max(1, rr - 2), '#f4f9ff'); }
      R(s.lx - 1, y, 1, 1, '#cfe6f5'); R(s.lx + 1, y - 1, 1, 1, '#cfe6f5');
    }
    g = world;
    alpha(0.25, () => R(F.x + (OX + 3) * Z, Y.vyb - 2, (v.len - 6) * Z, 3, '#1d1a2b'));
    const prevS = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(vc, Math.round(F.x), Y.vy - F.jump, OW * Z, OH * Z);
    g.imageSmoothingEnabled = prevS;
  }
  function drawStream() {
    const nx = Y.nozX + 1, ny = Y.nozY + 6, tx = F.aimX, ty = F.aimY;
    const cx = (nx + tx) / 2, cy = Math.min(ny, ty) - 10 - Math.abs(tx - nx) * 0.12;
    const n = Math.max(14, Math.floor(Math.hypot(tx - nx, ty - ny) / 1.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const px = u * u * nx + 2 * u * t * cx + t * t * tx, py = u * u * ny + 2 * u * t * cy + t * t * ty;
      R(px - 1, py - 1, 4, 4, '#4fb2f0');
      R(px, py, 2, 2, (i + Math.floor(T * 30)) % 3 ? '#9fdcff' : '#ffffff');
    }
    alpha(0.5, () => circle(tx, ty, 5, '#bfe6ff'));
  }

  /* ---------- scene ---------- */
  SCENES.wash = {
    view: [186, 200],   // drawn close up
    state: F,           // read-only peek for tests
    layout,
    groundY: () => Y.hillY,
    enter(arg) {
      const i = arg && typeof arg.v === 'number' ? arg.v : typeof arg === 'number' ? arg : VI.fire;
      F.vi = V[i] ? i : VI.fire;
      bubbles = []; F.puddle = 0; F.spin = 0;
      setClouds(L.safeT + 10, Math.max(L.safeT + 30, Y.top - 26));
      newVehicle();
    },
    leave() {
      F.held = null; F.state = 'off'; spraySound(0); rubSound(0); bubbles = [];
      const v = V[F.vi]; if (v.stopSiren) { v.stopSiren(); v.stopSiren = null; }
    },
    update, tap, move, release,
    drawWorld() {
      drawHills(Y.hillY, Y.fy);
      drawBuilding();
      drawHeli();
      drawBay();
      drawFloor();
      drawHose();
      drawVehicle();
      drawRollers();
      if (Y.duck) scaled(Y.duck.x, Y.duck.yb - Math.round(Math.sin(F.bigDuckHop * Math.PI) * 6), 4, () => drawDuck(0, 0, false, 1));
      const done = F.state === 'done' || F.state === 'next' || F.cheer > 0;
      if (!Y.att.roof) { const x0 = Y.att.x + 10, x1 = Math.min(W - L.safeR - 8, Y.att.x + 46); if (x1 - x0 > 12) PETS.draw('wash', { y: Y.att.yb, x0, x1, who: x1 - x0 > 30 ? ['cat', 'vizsla', 'husky'] : ['cat', 'husky'] }); }
      else { const x0 = Math.max(Y.bx0 + 40, Y.att.x - 70), x1 = Y.att.x - 12; if (x1 - x0 > 12) PETS.draw('wash', { y: Y.top - 4, x0, x1, who: x1 - x0 > 40 ? ['cat', 'vizsla', 'husky'] : ['cat', 'husky'] }); }   // up on the roof with the attendant
      drawPerson({ type: 'dad', x: Y.att.x, yb: Y.att.yb, dir: -1, pose: done ? 'cheer' : 'wave', skin: SKIN[1], seed: 2, hop: F.state === 'done' && F.doneT < 2.4 ? Math.abs(Math.sin(F.doneT * 7)) * 3 : 0 });
    },
    drawLit() {
      const k = nightK();
      // marquee bulbs around the sign, chasing
      bulbs().forEach(([bx, by], i) => {
        const on = (i + Math.floor(T * 5)) % 3 === 0;
        if (on && k > 0.05) alpha(0.35 * k, () => circle(bx + 1, by + 1, 3, '#fff27a'));
        R(bx, by, 2, 2, on ? '#fff27a' : mix('#fff6c8', '#c9a24a', k));
      });
      if (k > 0.05) {
        alpha(0.15 * k, () => R(Y.sign.x + 4, Y.sign.y + 4, Y.sign.w - 8, Y.sign.h - 8, '#fff6c8'));
        for (const lx of [Y.bayX + Math.round(Y.bayW * 0.3), Y.bayX + Math.round(Y.bayW * 0.7)]) {
          R(lx - 3, Y.bayTop + 6, 6, 1, '#fff6c8');
          for (let j = 0; j < 30; j++) alpha(0.12 * k * (1 - j / 30), () => R(lx - 3 - j * 0.6, Y.bayTop + 7 + j * 2, 6 + j * 1.2, 2, '#fff3b0'));
        }
        if (F.state !== 'off' && k > 0.02) {   // headlights, taillights and light bar at the bigger size
          g.save(); g.translate(Math.round(F.x), Y.vy - F.jump); g.scale(Z, Z);
          drawVehicleLights({ i: F.vi, x: OX, yb: OYB, lit: F.state === 'done' || F.state === 'exit', bob: 0 }, k);
          g.restore();
        }
      }
      for (const s of F.spots) {   // a clean, shiny vehicle twinkles
        if (s.st !== 3) continue;
        const ph = (T * 1.3 + s.seed) % 4;
        if (ph < 0.3) { const [x, y] = spotXY(s); R(x - 2, y, 5, 1, '#ffffff'); R(x, y - 2, 1, 5, '#ffffff'); }
      }
      if (F.spray > 0 && F.state === 'work' && F.step === 1) drawStream();
      for (const b of bubbles) drawBubble(b.x, b.y, Math.round(b.r));
      drawParticles();
    },
    drawUI() {
      drawStrip();
      drawHomeButton();
      if (F.state === 'done' || F.state === 'exit') {
        if (F.state === 'done' && F.doneT > 1.2) drawAgainButton(L.againBtn, '#2a6fe0', '#1a3f9a', bubbleIcon);
      } else {
        for (let k = 0; k < 3; k++) {
          const b = Y.tools[k], now = k === F.step && F.state !== 'arrive', done = k < F.step || (k === F.step && F.state === 'next');
          const lift = now ? Math.round(Math.abs(Math.sin(T * 4)) * 2 + Math.sin(F.wig[k] * 20) * F.wig[k] * 3) : 0;
          const bb = { x: b.x, y: b.y - lift, s: b.s };
          if (done) button(bb, '#3fb43a', '#1f7a2a');
          else if (now) {
            button(bb, TOOL[k].bg, TOOL[k].dark);
            const n = F.spots.length || 1, got = F.spots.filter(s => s.st > k).length;
            const fh = Math.round((bb.s - 5) * got / n);
            if (fh > 0) R(bb.x + 2, bb.y + bb.s - 3 - fh, bb.s - 4, fh, TOOL[k].fill);
          } else button(bb, '#b4bec8', '#8b96a1');
          const icon = () => drawTool(k, bb.x + bb.s / 2 - 1, bb.y + bb.s / 2 + 1, bb.s * 0.8);
          if (!now && !done) alpha(0.55, icon); else icon();
          if (done) {   // check badge
            const cx = bb.x + bb.s - 2, cy = bb.y + 2;
            circle(cx, cy, 5, '#ffffff'); circle(cx, cy, 4, '#3fb43a');
            R(cx - 3, cy, 1, 1, '#ffffff'); R(cx - 2, cy + 1, 1, 1, '#ffffff'); R(cx - 1, cy + 2, 1, 1, '#ffffff');
            R(cx, cy + 1, 1, 1, '#ffffff'); R(cx + 1, cy, 1, 1, '#ffffff'); R(cx + 2, cy - 1, 1, 1, '#ffffff'); R(cx + 3, cy - 2, 1, 1, '#ffffff');
          }
        }
      }
      if (F.state !== 'work') return;
      if (F.held !== null && F.step !== 1) {   // the sponge or towel under the finger
        const wob = Math.round(Math.sin(T * 30));
        drawTool(F.step, F.px + wob, F.py - 4, 28);
      } else if (F.held === null && F.idle > 2.5) {   // a ghost tool shows what to do
        const b = vbox();
        const hx = b.x + b.w / 2 + Math.sin(T * 2.4) * b.w * 0.32, hy = b.y + b.h * 0.45 + Math.cos(T * 4.8) * 5;
        alpha(0.5 + 0.3 * Math.sin(T * 6), () => drawTool(F.step, hx, hy, 28));
      }
    },
  };
})();
