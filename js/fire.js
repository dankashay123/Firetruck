// "Spray the Fire": the fire truck parks at a burning house; drag or tap to spray.
// Water puts a fire out the moment it touches it, so every tap is a win.
'use strict';
(() => {
  const F = { state: 'off', targets: [], tx: 0, spray: 0, aimX: 0, aimY: 0, doneT: 0, crackle: 0, smoke: 0, wall: '#f2d16b', jump: 0 };
  const HOUSE_COLORS = ['#f2d16b', '#9ad0f5', '#f5a3c7', '#b6e3a1', '#f0b27a', '#c9b6f2'];
  let held = null;
  const spraySound = noiseLoop(1400, 0.7);

  function layout() {
    const uw = W - L.safeL - L.safeR;
    F.rowH = 32; F.colW = 40;
    F.cols = uw >= 260 ? 3 : 2;
    F.doorCol = F.cols === 3 ? 1 : 0;
    F.rows = Math.max(2, Math.min(6, Math.floor((L.floorY - L.safeT - 60) / F.rowH)));
    F.hw = F.cols * F.colW + 14; F.hh = F.rows * F.rowH + 4;
    const group = 66 + 8 + 12 + 22 + F.hw;            // truck, firefighter, house
    const spare = uw - group;
    if (spare >= 0) F.x0 = Math.floor(L.safeL + Math.max(4, Math.min(spare / 2, spare - 52)));
    else F.x0 = W - L.safeR - 6 - F.hw - (66 + 8 + 12 + 22);   // narrow screen: the truck pokes in from the left edge
    F.truckX = F.x0; F.ffX = F.x0 + 74; F.hx = F.x0 + 74 + 12 + 22; F.hy = L.floorY - F.hh;
    F.nozX = F.ffX + 18; F.nozY = L.laneY - 11;
    // spots for trees and bushes around the house
    F.trees = [];
    const right = F.hx + F.hw + 22, rightEdge = W - L.safeR - 12;
    if (right <= rightEdge) F.trees.push({ x: right, r: 13 });
    if (right + 44 <= rightEdge) F.trees.push({ x: right + 44, r: 11 });
    F.trees.push({ x: F.x0 - 30 >= L.safeL + 10 ? F.x0 - 24 : Math.max(L.safeL + 16, F.truckX + 32), r: 12 });
    F.bushes = [{ x: F.hx - 9 }];
    if (right - 13 <= rightEdge) F.bushes.push({ x: F.hx + F.hw + 6 });
    if (F.state !== 'arrive') F.tx = F.truckX;
    if (F.state !== 'off') placeTargets();
  }
  function windowBox(r, c) { return { x: F.hx + 9 + c * F.colW, y: L.floorY - (r + 1) * F.rowH + 7, w: 22, h: 18 }; }
  function placeTargets() {
    for (const t of F.targets) {
      if (t.kind === 'window') Object.assign(t, windowBox(t.r, t.c));
      else if (t.kind === 'tree') { const tr = F.trees[t.i]; t.x = tr.x - tr.r; t.y = L.floorY - 2 * tr.r - 14; t.w = 2 * tr.r; t.h = 2 * tr.r; t.r = tr.r; }
      else if (t.kind === 'bush') { const b = F.bushes[t.i]; t.x = b.x - 8; t.y = L.floorY - 14; t.w = 16; t.h = 14; }
    }
  }
  function newFire() {
    const wins = [];
    for (let r = 0; r < F.rows; r++) for (let c = 0; c < F.cols; c++) if (!(r === 0 && c === F.doorCol)) wins.push({ r, c });
    wins.sort(() => Math.random() - 0.5);
    const n = Math.min(wins.length, 3 + (Math.random() * (F.rows > 2 ? 4 : 2) | 0));
    const mk = o => Object.assign({ out: false, seed: Math.random() * 10, who: Math.random() * 3 | 0, skin: pickOne(SKIN), outT: 0 }, o);
    F.targets = wins.slice(0, n).map(w => mk({ kind: 'window', r: w.r, c: w.c }));
    F.trees.forEach((t, i) => F.targets.push(mk({ kind: 'tree', i })));
    F.bushes.forEach((b, i) => { if (i === 0 || Math.random() < 0.6) F.targets.push(mk({ kind: 'bush', i })); });
    placeTargets();
    F.wall = pickOne(HOUSE_COLORS);
    F.doneT = 0; F.spray = 0; F.jump = 0;
    parts = [];
  }
  const center = t => [t.x + t.w / 2, t.y + t.h / 2];
  function aimAt(x, y) {
    // toddler aim assist: snap to the nearest fire within reach
    let best = null, bd = 40 * 40;
    for (const t of F.targets) {
      if (t.out) continue;
      const [cx, cy] = center(t), d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bd) { bd = d; best = [cx, cy]; }
    }
    [F.aimX, F.aimY] = best || [x, Math.min(y, L.laneY - 4)];
  }
  function douse(t) {
    t.out = true; t.outT = 0;
    SFX.sizzle();
    const [cx, cy] = center(t);
    puff(cx, t.y + 4, 12);
    sparkle(cx, cy, t.w / 2 + 4, 10);
  }

  function update(dt) {
    if (F.state === 'arrive') {
      F.tx = Math.min(F.truckX, F.tx + Math.max(22, Math.min(150, (F.truckX - F.tx) * 2.5)) * dt);
      V[VI.fire].rot += dt * 20;
      if ((F.smoke -= dt) <= 0) { F.smoke = 0.09; parts.push({ x: F.tx - 1, y: L.laneY - 7, vx: -12, vy: -14, g: 0, life: 0.6, max: 0.6, s: 2, c: '#c9ccd3' }); }
      if (F.tx >= F.truckX) {
        F.state = 'spray';
        const v = V[VI.fire]; if (v.stopSiren) { v.stopSiren(); v.stopSiren = null; }
        SFX.brake();
      }
    }
    if (held !== null && F.state === 'spray') F.spray = 0.3;
    F.spray = Math.max(0, F.spray - dt);
    const spraying = F.spray > 0 && F.state === 'spray';
    spraySound(spraying ? 0.35 : 0);
    if (spraying) {
      spawn(3, () => ({ x: F.aimX, y: F.aimY, vx: rand(-40, 40), vy: rand(-70, -20), g: 260, life: 0.45, max: 0.45, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.5 ? '#6fc8ff' : '#ffffff' }));
      for (const t of F.targets) {   // the moment water touches a fire, it's out
        if (!t.out && F.aimX >= t.x - 4 && F.aimX <= t.x + t.w + 4 && F.aimY >= t.y - 6 && F.aimY <= t.y + t.h + 4) douse(t);
      }
    }
    let burning = 0;
    for (const t of F.targets) {
      if (t.out) { t.outT += dt; continue; }
      burning++;
      if (Math.random() < dt * 4) { const [cx] = center(t); parts.push({ x: cx + rand(-4, 4), y: t.y - 10, vx: 4, vy: -14, g: 0, life: 1.2, max: 1.2, s: 3, c: '#7d7f88' }); }
    }
    if (burning && F.state === 'spray' && (F.crackle -= dt) <= 0) { F.crackle = rand(0.05, 0.23); noise(0, 0.03, 0.06, rand(1500, 4000), 3); }
    if (!burning && F.state === 'spray' && F.targets.length) { F.state = 'done'; F.doneT = 0; held = null; SFX.fanfare(); say(pick('praise'), true); }
    if (F.state === 'done') {
      F.doneT += dt;
      F.jump = F.doneT < 2.5 ? Math.abs(Math.sin(F.doneT * 6)) * 5 : 0;
      if (F.doneT < 1.8) confetti(3);
    }
  }

  function tap(x, y, id) {
    if (inBox(L.homeBtn, x, y)) { held = null; spraySound(0); returnHome(VI.fire); return true; }
    if (F.state === 'done' && F.doneT > 1.2 && inBox(L.againBtn, x, y)) { SFX.bell(); newFire(); F.state = 'spray'; return true; }
    if (PETS.tap('fire', x, y)) return true;
    if (F.state === 'spray') { held = id; aimAt(x, y); F.spray = 0.4; return true; }
    return false;
  }

  /* ---------- drawing ---------- */
  function drawHouse() {
    const hx = F.hx, hy = F.hy, hw = F.hw;
    R(hx + hw - 30, hy - 30, 9, 20, '#8e3b2a');
    for (let k = 0; k * 8 < hw + 8; k++) R(hx - 5 + k * 4, hy - 2 - k * 2, hw + 10 - k * 8, 2, k % 2 ? '#a3473a' : '#b5523b');
    R(hx - 6, hy - 2, hw + 12, 2, '#7a2f24');
    R(hx, hy, hw, F.hh, F.wall);
    alpha(0.15, () => { R(hx, hy, 3, F.hh, '#000000'); R(hx + hw - 3, hy, 3, F.hh, '#000000'); });
    for (let r = 1; r < F.rows; r++) R(hx, L.floorY - r * F.rowH, hw, 1, '#ffffff');
    const dx = hx + 9 + F.doorCol * F.colW;
    R(dx - 1, L.floorY - 25, 24, 25, '#ffffff'); R(dx, L.floorY - 24, 22, 24, '#8a5a3a');
    R(dx + 3, L.floorY - 21, 16, 8, '#9c6a48'); R(dx + 17, L.floorY - 12, 2, 2, '#ffd21f');
    // windows that were never on fire
    for (let r = 0; r < F.rows; r++) for (let c = 0; c < F.cols; c++) {
      if (r === 0 && c === F.doorCol) continue;
      if (F.targets.some(t => t.kind === 'window' && t.r === r && t.c === c)) continue;
      const w = windowBox(r, c);
      R(w.x - 2, w.y - 2, w.w + 4, w.h + 4, '#ffffff'); R(w.x, w.y, w.w, w.h, GLASS); R(w.x + 2, w.y + 2, 4, 2, '#ffffff'); R(w.x + 10, w.y, 2, w.h, '#ffffff');
    }
  }
  function drawWindowTarget(t, lit) {
    if (!lit) { R(t.x - 2, t.y - 2, t.w + 4, t.h + 4, '#ffffff'); return; }
    if (!t.out) {
      R(t.x, t.y, t.w, t.h, Math.floor(T * 8 + t.seed) % 2 ? '#ffb347' : '#ff9a3a');
      alpha(0.25, () => circle(t.x + t.w / 2, t.y + t.h / 2, 15, '#ff9a3a'));
      flame(t.x + t.w / 2, t.y + t.h, 1.2, t.seed);
      return;
    }
    R(t.x, t.y, t.w, t.h, '#fff3c4');
    const cx = t.x + t.w / 2, top = t.y + 2, wave = Math.floor(T * 6 + t.seed) % 2;
    if (t.who === 2) {   // a kitty
      circle(cx, top + 9, 5, '#9aa3ad'); R(cx - 5, top + 2, 2, 4, '#9aa3ad'); R(cx + 4, top + 2, 2, 4, '#9aa3ad');
      R(cx - 2, top + 8, 1, 1, INK); R(cx + 2, top + 8, 1, 1, INK); R(cx, top + 10, 1, 1, '#ff6fb4');
    } else {             // a neighbor, waving
      const px = cx - 2;
      R(px - 6, top + 12, 13, 4, t.who ? '#2a6fe0' : '#3fb43a');
      circle(px, top + 6, 4, t.skin);
      R(px - 4, top + 1, 9, 3, t.who ? '#5a3a22' : '#e8b03a');
      R(px - 2, top + 5, 1, 2, INK); R(px + 2, top + 5, 1, 2, INK);
      R(px - 2, top + 8, 1, 1, '#a3121d'); R(px - 1, top + 9, 3, 1, '#a3121d'); R(px + 2, top + 8, 1, 1, '#a3121d');
      R(px + 7, top + (wave ? 2 : 4), 2, 8, t.skin);
    }
    alpha(0.3, () => R(t.x + 3, t.y - 6, t.w - 6, 3, '#3a3d46'));
  }
  function drawTreeTarget(t, lit) {
    const tr = F.trees[t.i], x = tr.x;
    if (!lit) {
      drawTree(x, L.floorY, tr.r, !t.out);
      if (t.out && t.outT < 3) { const bob = Math.floor(T * 4) % 2; R(x + 2, L.floorY - 2 * tr.r - 14 - bob, 4, 3, '#2a6fe0'); R(x + 5, L.floorY - 2 * tr.r - 13 - bob, 2, 1, '#ffd21f'); }
      return;
    }
    if (!t.out) for (let k = -1; k <= 1; k++) flame(x + k * tr.r * 0.6, L.floorY - tr.r - 14 - (k ? 0 : 6), 0.9 + (k ? 0 : 0.4), t.seed + k);
  }
  function drawBushTarget(t, lit) {
    const b = F.bushes[t.i];
    if (!lit) {
      circle(b.x, L.floorY - 6, 7, t.out ? '#3f9a45' : '#6b4a2a'); circle(b.x - 3, L.floorY - 8, 4, t.out ? '#5bb85a' : '#8a5a2a');
      if (t.out) { R(b.x + 2, L.floorY - 10, 2, 2, '#ff6fb4'); R(b.x - 4, L.floorY - 5, 2, 2, '#ffd21f'); }
      return;
    }
    if (!t.out) flame(b.x, L.floorY - 6, 0.9, t.seed);
  }
  function drawTargets(lit) {
    for (const t of F.targets) ({ window: drawWindowTarget, tree: drawTreeTarget, bush: drawBushTarget })[t.kind](t, lit);
  }
  function drawFirefighter(x, yb) {
    R(x - 1, yb - 14, 2, 12, '#3a3d46');
    drawPerson({ type: 'ff', x: x + 6, yb, dir: 1, pose: F.state === 'done' ? 'cheer' : 'carry', skin: SKIN[0], seed: 1 });
    if (F.state !== 'done') R(x + 12, yb - 12, 5, 3, '#9aa3ad');
  }
  function drawStream() {
    const nx = F.nozX, ny = F.nozY, tx = F.aimX, ty = F.aimY;
    const cx = (nx + tx) / 2, cy = Math.min(ny, ty) - 18 - Math.abs(tx - nx) * 0.15;
    const n = Math.max(14, Math.floor(Math.hypot(tx - nx, ty - ny) / 1.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const px = u * u * nx + 2 * u * t * cx + t * t * tx, py = u * u * ny + 2 * u * t * cy + t * t * ty;
      R(px - 1, py - 1, 4, 4, '#4fb2f0');
      R(px, py, 2, 2, (i + Math.floor(T * 30)) % 3 ? '#9fdcff' : '#ffffff');
    }
  }

  SCENES.fire = {
    view: [186, 200],   // drawn close up
    freeTouch: true,    // every touch sprays; clouds don't change the weather here
    layout,
    enter() { F.state = 'arrive'; F.tx = -72; held = null; newFire(); },
    leave() { held = null; spraySound(0); F.state = 'off'; const v = V[VI.fire]; if (v.stopSiren) { v.stopSiren(); v.stopSiren = null; } },
    update,
    tap,
    move(x, y, id) { if (id === held && F.state === 'spray') aimAt(x, y); },
    release(id) { if (id === held) held = null; },
    drawWorld() {
      drawHeli();
      drawHills(L.hillY, L.floorY);
      drawHouse();
      drawTargets(false);
      { // the family's pets watch from the lawn beside the house (the bigger side)
        const a = [L.safeL + 12, F.hx - 14], b = [F.hx + F.hw + 30, W - L.safeR - 10];
        for (const t of F.trees) {   // and never right next to a tree that might be burning
          if (t.x < F.hx) { if (t.x + t.r + 10 > a[0] && t.x - t.r - 10 < a[1]) { if (t.x - a[0] > a[1] - t.x) a[1] = t.x - t.r - 10; else a[0] = t.x + t.r + 10; } }
          else if (t.x + t.r + 10 > b[0] && t.x - t.r - 10 < b[1]) { if (t.x - b[0] > b[1] - t.x) b[1] = t.x - t.r - 10; else b[0] = t.x + t.r + 10; }
        }
        const [x0, x1] = a[1] - a[0] >= b[1] - b[0] ? a : b, room = x1 - x0;
        if (room >= 4) PETS.draw('fire', { y: L.floorY, x0, x1, who: room > 60 ? ['cat', 'vizsla', 'husky'] : room > 24 ? ['cat', 'vizsla'] : ['cat'] });
      }
      drawRoad();
      if (F.state !== 'arrive') R(F.truckX + 30, L.laneY - 2, F.ffX - F.truckX - 28, 2, '#3a3d46');
      const bob = F.state === 'arrive' ? (Math.floor(F.tx / 7) % 2 ? 0 : -1) : 0;
      drawV(VI.fire, F.tx, L.laneY, true, bob);
      if (F.state !== 'arrive') drawFirefighter(F.ffX, L.laneY - Math.round(F.jump));
    },
    drawLit() {
      drawTargets(true);
      if (F.spray > 0 && F.state === 'spray') drawStream();
      drawParticles();
    },
    drawUI() {
      drawStrip();
      drawHomeButton();
      if (F.state === 'done' && F.doneT > 1.2) drawAgainButton(L.againBtn, '#e8222b', '#a3121d', (cx, cy, s) => flame(cx, cy + s * 0.32, 1.6, 0));
    },
  };
})();
