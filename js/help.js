// "Who Comes to Help?": a little problem appears and the child picks which vehicle should come.
// No fail state: a wrong vehicle just says "hmm?", drives on, and the right card starts to bounce.
'use strict';
(() => {
  const CARD_ORDER = [VI.police, VI.fire, VI.amb];
  const st = { idx: -1, s: null, state: 'wait', t: 0, veh: null, leavers: [], hint: false, cards: [], hops: {}, bub: 0 };
  let P = 0;          // x anchor of the problem, recomputed in layout()
  let lastIdx = -1;

  /* ---------- small helpers ---------- */
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const lerp = (a, b, k) => a + (b - a) * k;
  const happy = () => st.state === 'party' || st.state === 'done';
  const tall = () => H > W * 1.3;
  function once(s, k, cond) { if (cond && !s['_' + k]) { s['_' + k] = 1; return true; } return false; }
  function hop(k) { st.hops[k] = 0.4; }
  // current hop height for a character; everyone bounces while celebrating
  function hv(k, seed = 0) {
    const h = st.hops[k] || 0;
    let v = h > 0 ? Math.sin((1 - h / 0.4) * Math.PI) * 5 : 0;
    if (happy()) v = Math.max(v, Math.abs(Math.sin(T * 6 + seed)) * 3);
    return Math.round(v);
  }
  const near = (x, y, cx, cy, rx, ry = rx) => Math.abs(x - cx) <= rx && Math.abs(y - cy) <= ry;
  function line(x0, y0, x1, y1, c, w = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k++) R(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, w, w, c);
  }
  function rr(x, y, w, h, c) {   // rounded rectangle
    R(x + 2, y, w - 4, h, c); R(x + 1, y + 1, w - 2, h - 2, c); R(x, y + 2, w, h - 4, c);
  }
  function tear(px, yb, dir, sit) {
    const bx = Math.floor(px) - 4, top = Math.floor(yb) - 16 + (sit ? 4 : 0);
    const ex = dir > 0 ? bx + 6 : bx + 1;
    parts.push({ x: ex, y: top + 5, vx: dir * rand(4, 10), vy: rand(2, 8), g: 70, life: 0.55, max: 0.55, s: 1, c: '#6fb6ff' });
  }
  function hearts(cx, cy) { sparkle(cx, cy, 10, 8, '#ff6fb4'); sparkle(cx, cy, 10, 4, '#fff27a'); }
  function whistle() { tone('sine', 2700, 0, 0.12, 0.08); tone('sine', 2700, 0.18, 0.35, 0.08, 2500); }
  // someone walking from a to b ({x, yb}) as k goes 0..1
  function walker(type, a, b, k, opts) {
    drawPerson(Object.assign({ type, x: lerp(a.x, b.x, k), yb: lerp(a.yb, b.yb, k), dir: b.x >= a.x ? 1 : -1, walk: k > 0 && k < 1, seed: 2 }, opts));
  }
  const QM = ['01110', '10001', '00001', '00110', '00100', '00000', '00100'];
  function qmark(x, y, u, c) { QM.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') R(x + i * u, y + j * u, u, u, c); })); }
  // speech bubble with a "?" whose tail tip is at (cx, by)
  function bubble(cx, by, u) {
    const w = 5 * u + 8, h = 7 * u + 8;
    const x = Math.round(cx - w / 2), y = Math.round(by - h - 3);
    rr(x - 1, y - 1, w + 2, h + 2, '#22222a');
    R(cx - 3, y + h, 7, 1, '#22222a'); R(cx - 2, y + h + 1, 5, 1, '#22222a'); R(cx - 1, y + h + 2, 3, 2, '#22222a');
    rr(x, y, w, h, '#ffffff');
    R(cx - 2, y + h - 1, 5, 1, '#ffffff'); R(cx - 1, y + h, 3, 1, '#ffffff'); R(cx, y + h + 1, 1, 1, '#ffffff');
    qmark(x + 4, y + 4, u, '#2a6fe0');
    return { x, y, w, h };
  }

  /* ---------- extra props ---------- */
  function drawDog(x, yb, dir, col, dark, step = 0) {
    const bx = Math.floor(x) - 6, top = Math.floor(yb) - 9;
    const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 12 - dx - w, top + dy, w, h, c);
    const wag = Math.floor(T * 8) % 2;
    M(0, wag ? 1 : 2, 1, 3, col);                       // tail
    M(1, 3, 7, 4, col); M(2, 4, 3, 2, dark);            // body + spot
    if (step) { M(2, 7, 2, 2, col); M(5, 7, 2, 2, col); } else { M(1, 7, 2, 2, col); M(6, 7, 2, 2, col); }
    M(7, 0, 4, 4, col); M(10, 2, 2, 2, col);            // head, snout
    M(11, 2, 1, 1, INK); M(9, 1, 1, 1, INK);            // nose, eye
    M(7, 0, 2, 3, dark);                                // floppy ear
    M(10, 4, 1, 1, '#ff6fb4');                          // tongue
  }
  function drawBigTree(tx, by, fy) {
    const top = by - 20;
    R(tx - 4, top, 9, fy - top, '#7a4a2a'); R(tx - 4, top, 2, fy - top, '#5e3820');
    R(tx - 6, fy - 2, 13, 2, '#7a4a2a');
    R(tx - 36, by, 34, 3, '#7a4a2a'); R(tx - 36, by + 2, 34, 1, '#5e3820');      // the branch
    circle(tx - 38, by, 4, '#3f9a45'); circle(tx - 39, by - 1, 2, '#5bb85a');
    circle(tx + 2, by - 30, 24, '#3f9a45');
    circle(tx - 14, by - 20, 13, '#3f9a45'); circle(tx + 17, by - 17, 13, '#3f9a45');
    circle(tx - 4, by - 37, 13, '#5bb85a'); circle(tx - 15, by - 23, 7, '#5bb85a'); circle(tx + 15, by - 22, 6, '#5bb85a');
    for (const [dx, dy] of [[10, -28], [-8, -14], [19, -12], [-2, -44], [6, -18]]) R(tx + dx, by + dy, 2, 2, '#e8222b');
  }
  function drawLadder(a, b, k) {
    const cx = lerp(a.x, b.x, k), cy = lerp(a.y, b.y, k);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len, nx = -uy * 3, ny = ux * 3;
    const cur = len * k;
    for (let s = 3; s < cur; s += 4) {
      const px = a.x + ux * s, py = a.y + uy * s;
      line(px + nx, py + ny, px - nx, py - ny, '#8b96a1');
    }
    line(a.x + nx, a.y + ny + 1, cx + nx, cy + ny + 1, '#8b96a1');
    line(a.x - nx, a.y - ny + 1, cx - nx, cy - ny + 1, '#8b96a1');
    line(a.x + nx, a.y + ny, cx + nx, cy + ny, '#e9eef2');
    line(a.x - nx, a.y - ny, cx - nx, cy - ny, '#e9eef2');
  }
  function drawBike(bx, by) {   // a little bike tipped over
    const c = '#ff6fb4';
    line(bx, by - 4, bx + 5, by - 8, c); line(bx + 5, by - 8, bx + 11, by - 9, c);
    line(bx + 1, by - 5, bx + 6, by - 11, c); line(bx + 6, by - 11, bx + 11, by - 9, c);
    R(bx + 5, by - 13, 4, 1, '#2f3240');                    // seat
    line(bx, by - 4, bx - 2, by - 10, '#2f3240'); R(bx - 4, by - 10, 4, 1, '#2f3240');   // handlebar
    wheel(bx, by - 4, 4, 0);
    wheel(bx + 11, by - 9, 4, T * 4);
  }
  function drawDoghouse(x, yb, wet) {
    const body = wet ? '#b98048' : '#d89a58', dark = wet ? '#7a4a24' : '#9a6534', roof = wet ? '#8a2a2a' : '#c23030';
    R(x - 10, yb - 14, 20, 14, body); R(x - 10, yb - 14, 2, 14, dark);
    R(x - 10, yb - 10, 20, 1, dark); R(x - 10, yb - 5, 20, 1, dark);
    R(x - 4, yb - 9, 8, 9, '#3a2516'); R(x - 3, yb - 10, 6, 1, '#3a2516');
    for (let k = 0; k < 9; k++) R(x - 13 + k, yb - 15 - k, 26 - 2 * k, 1, k === 0 ? '#7a1a1a' : roof);
    R(x - 2, yb - 13, 4, 1, '#ffffff'); R(x - 3, yb - 14, 1, 3, '#ffffff'); R(x + 2, yb - 14, 1, 3, '#ffffff');   // bone sign
  }
  function drawBush(x, yb, wob) {
    x = Math.round(x + wob);
    circle(x, yb - 10, 10, '#3f9a45'); circle(x - 9, yb - 6, 6, '#3f9a45'); circle(x + 9, yb - 6, 6, '#3f9a45');
    circle(x - 3, yb - 13, 5, '#5bb85a'); circle(x - 10, yb - 8, 3, '#5bb85a'); circle(x + 7, yb - 9, 3, '#5bb85a');
    R(x - 5, yb - 4, 2, 2, '#ff6fb4'); R(x + 4, yb - 14, 2, 2, '#fff27a'); R(x + 9, yb - 5, 2, 2, '#ff6fb4');
  }
  function drawBench(gx, sy, fy) {
    R(gx - 10, sy - 10, 2, 10, '#7a4a2a'); R(gx + 8, sy - 10, 2, 10, '#7a4a2a');
    R(gx - 12, sy - 10, 24, 2, '#c98a4a'); R(gx - 12, sy - 6, 24, 2, '#c98a4a');
    R(gx - 12, sy, 24, 2, '#c98a4a'); R(gx - 12, sy + 1, 24, 1, '#9a6534');
    R(gx - 10, sy + 2, 2, fy - sy - 2, '#5e3820'); R(gx + 8, sy + 2, 2, fy - sy - 2, '#5e3820');
  }

  /* ---------- scenarios ---------- */
  // Each: veh (the right vehicle), front() (where the vehicle's nose stops), init() -> state,
  // ask(s) (where the "?" bubble points), update(s, dt), rescue(s, dt, t) -> done?,
  // back(s) / fore(s) (drawn behind / over the vehicles), lit(s), tap(s, x, y) -> handled?
  const SC = [];

  // 1. Kitty stuck in a tree -> fire truck
  SC.push({
    veh: VI.fire,
    tx() { return Math.round(P + 18); },
    by() { return L.floorY - (tall() ? 84 : 58); },
    front() { return this.tx() - 4; },
    kid() { return { x: this.tx() + 16, yb: L.floorY + 2 }; },
    ladA() { return { x: this.front() - 56, y: L.laneY - 33 }; },
    ladB() { return { x: this.tx() - 22, y: this.by() + 1 }; },
    init() { return { meow: 1.2, lad: 0, cat: 'branch', ck: 0 }; },
    ask() { return { x: this.tx() - 26, y: this.by() - 11 }; },
    update(s, dt) {
      if (s.cat === 'branch' && (s.meow -= dt) <= 0) { s.meow = rand(3, 4.5); SFX.meow(); hop('cat'); }
    },
    rescue(s, dt, t) {
      s.lad = ease(clamp01(t / 1.1));
      if (once(s, 'door', true)) SFX.door();
      if (once(s, 'm', t >= 1.1)) { SFX.meow(); hop('cat'); }
      if (t >= 1.5 && t < 2.7) { s.cat = 'slide'; s.ck = ease((t - 1.5) / 1.2); if (once(s, 'w', true)) SFX.whoosh(); }
      else if (t >= 2.7 && t < 3.3) { s.cat = 'jump'; s.ck = (t - 2.7) / 0.6; if (once(s, 'j', true)) SFX.boop(1.3); }
      else if (t >= 3.3) {
        s.cat = 'held';
        if (once(s, 'h', true)) { SFX.meow(); const k = this.kid(); hearts(k.x, k.yb - 14); }
      }
      return t >= 3.6;
    },
    back(s) {
      const tx = this.tx(), by = this.by(), k = this.kid();
      drawBigTree(tx, by, L.floorY + 2);
      if (s.cat === 'branch') drawCat(tx - 26, by - hv('cat'), 1);
      const kh = hv('kid', 1);
      drawPerson({ type: 'kid', x: k.x, yb: k.yb, dir: -1, pose: happy() ? 'cheer' : 'wave', skin: SKIN[1], hop: kh, seed: 1 });
      if (s.cat === 'held') drawCat(k.x - 4, k.yb - 5 - kh, -1);
    },
    fore(s) {
      const a = this.ladA(), b = this.ladB();
      if (s.lad > 0) drawLadder(a, b, s.lad);
      if (s.cat === 'slide') drawCat(lerp(b.x, a.x, s.ck), lerp(b.y, a.y, s.ck) - 2, -1);
      if (s.cat === 'jump') {
        const k = this.kid();
        drawCat(lerp(a.x, k.x - 4, s.ck), lerp(a.y - 2, k.yb - 5, s.ck) - Math.sin(s.ck * Math.PI) * 16, 1);
      }
    },
    tap(s, x, y) {
      const tx = this.tx(), by = this.by(), k = this.kid();
      if (s.cat === 'branch' && near(x, y, tx - 26, by - 4, 10)) { SFX.meow(); hop('cat'); return true; }
      if (near(x, y, k.x, k.yb - 9, 8, 11)) { SFX.boop(1.2); hop('kid'); if (s.cat === 'held') SFX.meow(); return true; }
      if ((x - tx) ** 2 + (y - (by - 28)) ** 2 < 28 * 28) {
        SFX.pop();
        spawn(6, () => ({ x: tx + rand(-18, 18), y: by - 30 + rand(-14, 10), vx: rand(-12, 12), vy: rand(-4, 8), g: 25, life: 1.3, max: 1.3, s: 2, c: Math.random() < 0.5 ? '#5bb85a' : '#3f9a45' }));
        return true;
      }
      return false;
    },
  });

  // 2. Bumped knee -> ambulance
  SC.push({
    veh: VI.amb,
    kx() { return Math.round(P + 10); },
    front() { return this.kx() - 18; },
    medA() { return { x: this.front() + 3, yb: L.laneY - 2 }; },
    medB() { return { x: this.kx() - 11, yb: L.floorY + 3 }; },
    init() { return { tear: 0.2, fixed: false, stand: false, mk: -1 }; },
    ask() { return { x: this.kx(), y: L.floorY - 16 }; },
    kidPos(s) { return s.stand ? { x: this.kx(), yb: L.floorY + 2 } : { x: this.kx(), yb: L.floorY + 2 }; },
    update(s, dt) {
      if (!s.fixed && (s.tear -= dt) <= 0) { s.tear = 0.4; tear(this.kx(), L.floorY + 2 - hv('kid'), -1, true); }
    },
    rescue(s, dt, t) {
      if (once(s, 'door', true)) SFX.door();
      s.mk = t >= 0.3 ? clamp01((t - 0.3) / 1.2) : -1;
      if (once(s, 'b', t >= 1.8)) { s.fixed = true; SFX.chime(); sparkle(this.kx() - 4, L.floorY - 3, 8, 10); }
      if (once(s, 'st', t >= 2.5)) { s.stand = true; hop('kid'); SFX.boop(1.2); }
      return t >= 2.9;
    },
    back(s) {
      const kx = this.kx(), yb = L.floorY + 2, kh = hv('kid', 1);
      drawBike(kx + 13, yb);
      const pose = happy() ? 'cheer' : s.stand ? 'stand' : 'sit';
      drawPerson({ type: 'kid2', x: kx, yb, dir: -1, pose, skin: SKIN[0], hop: kh, seed: 1 });
      const bx = kx - 4, top = yb - kh - 16 + (pose === 'sit' ? 4 : 0);
      if (pose === 'sit') { if (s.fixed) R(bx, top + 10, 2, 2, '#ffffff'); else R(bx, top + 11, 2, 1, '#ff3b3b'); }
      else R(bx + 1, top + 13, 2, 1, '#ffffff');
    },
    fore(s) {
      if (s.mk < 0) return;
      const pose = happy() ? 'wave' : s.mk >= 1 && !s.fixed ? 'carry' : 'stand';
      walker('medic', this.medA(), this.medB(), s.mk, { pose, hop: hv('medic', 3) });
    },
    tap(s, x, y) {
      const kx = this.kx();
      if (near(x, y, kx, L.floorY - 6, 8, 10)) { SFX.boop(s.fixed ? 1.2 : 0.8); hop('kid'); return true; }
      if (near(x, y, kx + 17, L.floorY - 5, 9, 8)) { tone('sine', 1800, 0, 0.3, 0.1); tone('sine', 1800, 0.15, 0.4, 0.1); return true; }
      if (s.mk >= 0) { const m = this.medB(); if (near(x, y, lerp(this.medA().x, m.x, s.mk), m.yb - 8, 7, 10)) { SFX.boop(1); hop('medic'); return true; } }
      return false;
    },
  });

  // 3. Ducks want to cross the road -> police car
  const CAR_RAMPS = [0, 1, 2, 3, 5, 6].map(i => PALETTE[i][2]);
  const DUCK_DX = [7, -3, -9, -15];
  SC.push({
    veh: VI.police,
    cx() { return Math.round(P + 18); },
    front() { return this.cx() - 28; },
    offA() { return { x: this.front() + 3, yb: L.laneY - 2 }; },
    offB() { return { x: this.cx() - 18, yb: L.roadY + 27 }; },
    offC() { return { x: this.cx() - 18, yb: L.floorY + 2 }; },
    init() {
      const s = { cars: [], spawn: 1, stop: false, ok: -1, ob: -1, ct: -1, quack: 1.5, peep: 0.5 };
      for (const x of [W * 0.15, W * 0.6]) s.cars.push({ x, c: pickOne(CAR_RAMPS), rot: 0 });
      return s;
    },
    ask() { return { x: this.cx() + DUCK_DX[0], y: L.floorY - 10 }; },
    duckPos(s, i) {
      const k = s.ct < 0 ? 0 : clamp01((s.ct - i * 0.3) / 2.4);
      return { x: this.cx() + DUCK_DX[i], y: lerp(L.roadY + 2, L.roadY + L.roadH - 1, k), walk: k > 0 && k < 1 };
    },
    update(s, dt) {
      const cx = this.cx(), stopX = cx - 26;
      // far-lane traffic, queueing behind the officer when stopped
      s.cars.sort((a, b) => b.x - a.x);
      let limit = Infinity;
      for (const c of s.cars) {
        let lim = limit;
        if (s.stop && c.x + 34 <= stopX + 1) lim = Math.min(lim, stopX);
        const room = lim - (c.x + 34);
        const sp = room < 30 ? Math.max(0, room * 2) : 55;
        const x0 = c.x;
        c.x = Math.min(c.x + sp * dt, lim === Infinity ? Infinity : Math.max(c.x, lim - 34));
        c.rot += (c.x - x0) / 4;
        limit = c.x - 6;
      }
      s.cars = s.cars.filter(c => c.x < W + 40);
      if ((s.spawn -= dt) <= 0) {
        s.spawn = rand(1.3, 2.4);
        const last = Math.min(...s.cars.map(c => c.x), Infinity);
        if (s.cars.length < 5 && last > 8) s.cars.push({ x: -40, c: pickOne(CAR_RAMPS), rot: 0 });
      }
      if (s.ct < 0 && (s.quack -= dt) <= 0) { s.quack = rand(2.8, 4); SFX.quack(); hop('d0'); }
      if (s.ct >= 0 && s.ct < 3.4 && (s.peep -= dt) <= 0) { s.peep = rand(0.3, 0.6); SFX.peep(); }
      if (happy() && (s.peep -= dt) <= 0) { s.peep = rand(0.6, 1.2); SFX.peep(); }
    },
    rescue(s, dt, t) {
      const cx = this.cx();
      if (once(s, 'door', true)) SFX.door();
      s.ok = t >= 0.2 ? clamp01((t - 0.2) / 1.1) : -1;
      if (once(s, 'stop', t >= 1.3)) { s.stop = true; whistle(); }
      const clear = !s.cars.some(c => c.x < cx + 18 && c.x + 34 > cx - 22);
      if (s.ct < 0 && t >= 1.7 && clear) { s.ct = 0; SFX.quack(); }
      if (s.ct >= 0) s.ct += dt;
      if (s.ct >= 3.6) {
        s.ob = clamp01((s.ct - 3.6) / 0.7);
        if (s.ob >= 1) { s.stop = false; return true; }
      }
      return false;
    },
    back(s) {
      for (const c of s.cars) drawCar(c.x, L.roadY + 22, c.c, c.rot);
      if (s.ct < 0) this.ducks(s);
    },
    ducks(s) {
      for (let i = 0; i < 4; i++) {
        const d = this.duckPos(s, i), step = d.walk ? Math.floor(T * 8 + i) % 2 : 0;
        drawDuck(d.x, d.y - step - hv('d' + i, i), i === 0, 1, step);
      }
    },
    fore(s) {
      if (s.ct >= 0) this.ducks(s);
      if (s.ok < 0) return;
      const inRoad = s.ob < 0;
      const a = inRoad ? this.offA() : this.offB(), b = inRoad ? this.offB() : this.offC(), k = inRoad ? s.ok : s.ob;
      const arrived = inRoad ? k >= 1 : k >= 1;
      const pose = happy() ? 'cheer' : arrived && inRoad ? 'wave' : 'stand';
      const oh = hv('cop', 2);
      walker('cop', a, b, k, { pose, dir: arrived && inRoad ? -1 : (b.x >= a.x ? 1 : -1), hop: oh });
      if (s.stop && inRoad && arrived) {    // hand-held stop sign
        const x = b.x - 7, y = b.yb - 16 - oh;
        R(x, y - 3, 1, 9, '#5a5f6e');
        circle(x, y - 8, 5, '#ffffff'); circle(x, y - 8, 4, '#e8222b'); R(x - 2, y - 8, 5, 1, '#ffffff');
      }
    },
    tap(s, x, y) {
      for (let i = 0; i < 4; i++) {
        const d = this.duckPos(s, i);
        if (near(x, y, d.x, d.y - 4, i ? 6 : 8, 7)) { if (i) SFX.peep(); else SFX.quack(); hop('d' + i); return true; }
      }
      for (const c of s.cars) if (x >= c.x && x < c.x + 34 && y > L.roadY + 4 && y < L.roadY + 23) { SFX.honk(); return true; }
      return false;
    },
  });

  // 4. Doghouse on fire -> fire truck
  SC.push({
    veh: VI.fire,
    hx() { return Math.round(P + 22); },
    front() { return this.hx() - 38; },
    ffA() { return { x: this.front() + 3, yb: L.laneY - 2 }; },
    ffB() { return { x: this.hx() - 25, yb: L.floorY + 9 }; },
    init() { return { fire: 1, woof: 1.5, smoke: 0, fk: -1, spray: false, wet: false, steam: 0 }; },
    ask() { return { x: this.hx() + 22, y: L.floorY - 10 }; },
    update(s, dt) {
      const hx = this.hx(), yb = L.floorY + 1;
      if (s.fire > 0.05 && (s.smoke -= dt) <= 0) { s.smoke = 0.45; puff(hx + rand(-4, 4), yb - 40 - s.fire * 4, 2, '#8a8f99'); }
      if (!happy() && s.fire > 0 && (s.woof -= dt) <= 0) { s.woof = rand(3, 4.5); SFX.woof(); hop('dog'); }
      if (s.spray && (s.steam -= dt) <= 0) { s.steam = 0.15; puff(hx + rand(-6, 6), yb - 24, 1, '#ffffff'); }
    },
    rescue(s, dt, t) {
      if (once(s, 'door', true)) SFX.door();
      s.fk = t >= 0.2 ? clamp01((t - 0.2) / 0.9) : -1;
      if (once(s, 'sp', t >= 1.3)) { s.spray = true; SFX.water(); }
      s.fire = 1 - clamp01((t - 1.5) / 1.6);
      if (once(s, 'out', t >= 3.1)) { s.fire = 0; s.wet = true; SFX.sizzle(); puff(this.hx(), L.floorY - 24, 12); }
      if (t >= 3.4) s.spray = false;
      if (once(s, 'dog', t >= 3.5)) { SFX.woof(); hop('dog'); }
      return t >= 3.8;
    },
    back(s) {
      const hx = this.hx(), yb = L.floorY + 1;
      drawDoghouse(hx, yb, s.wet);
      drawDog(hx + 22, yb + 1 - hv('dog', 2), -1, '#e0b070', '#8a5a2a');
    },
    fore(s) {
      if (s.fk < 0) return;
      const a = this.ffA(), b = this.ffB(), x = lerp(a.x, b.x, s.fk), yb = lerp(a.yb, b.yb, s.fk);
      line(this.front() - 22, L.laneY - 12, x - 1, yb - 7, '#3a3d46');      // hose
      walker('ff', a, b, s.fk, { pose: happy() ? 'cheer' : s.fk >= 1 ? 'carry' : 'stand', dir: 1, hop: hv('ff', 4) });
      if (s.spray) {
        const nx = x + 5, ny = yb - 8, tx = this.hx(), ty = L.floorY - 18;
        for (let j = 0; j < 16; j++) {
          const u = ((j + T * 9) % 16) / 16;
          const px = lerp(nx, tx, u), py = lerp(ny, ty, u) - Math.sin(u * Math.PI) * 16;
          R(px, py, 2, 2, j % 3 ? '#9fd2ef' : '#ffffff');
        }
        for (let j = 0; j < 4; j++) R(tx + rand(-6, 6), ty + rand(-4, 2), 1, 1, '#ffffff');
      }
    },
    lit(s) {
      if (s.fire <= 0.05) return;
      const hx = this.hx(), roof = L.floorY + 1 - 17, f = s.fire;
      if (nightK() > 0.05) alpha(0.3 * f * nightK(), () => circle(hx, roof - 6, 18, '#ffb15a'));
      flame(hx - 6, roof + 2, 1.0 * f, 1);
      flame(hx + 5, roof + 3, 0.8 * f, 4);
      flame(hx, roof - 2, 0.6 * f, 7);
    },
    tap(s, x, y) {
      const hx = this.hx(), yb = L.floorY + 1;
      if (near(x, y, hx + 22, yb - 5, 9, 7)) { SFX.woof(); hop('dog'); return true; }
      if (near(x, y, hx, yb - 20, 14, 20)) { if (s.fire > 0.05) { SFX.whoosh(); puff(hx, yb - 40, 4, '#8a8f99'); } else SFX.pop(); return true; }
      return false;
    },
  });

  // 5. Grandma feeling dizzy -> ambulance
  SC.push({
    veh: VI.amb,
    gx() { return Math.round(P + 12); },
    front() { return this.gx() - 26; },
    medA() { return { x: this.front() + 3, yb: L.laneY - 2 }; },
    medB() { return { x: this.gx() - 17, yb: L.floorY + 3 }; },
    init() { return { sick: true, stand: false, mk: -1, sigh: 1.5 }; },
    ask() { return { x: this.gx() + 2, y: L.floorY - 25 }; },
    update(s, dt) {
      if (s.sick && (s.sigh -= dt) <= 0) { s.sigh = rand(3.5, 5); tone('sine', 340, 0, 0.6, 0.07, 250); }
    },
    rescue(s, dt, t) {
      if (once(s, 'door', true)) SFX.door();
      s.mk = t >= 0.3 ? clamp01((t - 0.3) / 1.2) : -1;
      if (once(s, 'heal', t >= 1.8)) { s.sick = false; SFX.chime(); hearts(this.gx() + 2, L.floorY - 20); }
      if (once(s, 'st', t >= 2.5)) { s.stand = true; hop('gran'); SFX.boop(1.1); }
      return t >= 2.9;
    },
    back(s) {
      const gx = this.gx(), sy = L.floorY - 4, fy = L.floorY + 2;
      drawBench(gx, sy, fy);
      const gh = hv('gran', 1);
      const skin = s.sick ? '#cfe3a6' : SKIN[0];
      if (s.stand) drawPerson({ type: 'gran', x: gx - 4, yb: fy, dir: -1, pose: happy() ? 'cheer' : 'stand', skin, hop: gh });
      else drawPerson({ type: 'gran', x: gx + 2, yb: sy - 1, dir: -1, pose: 'sit', skin, hop: gh });
      if (s.sick) {
        const hy = sy - 1 - 12 - gh - 3;
        for (let k = 0; k < 3; k++) {
          const a = T * 3 + k * 2.094, x = gx + 2 + Math.cos(a) * 7, y = hy + Math.sin(a) * 2;
          R(x - 1, y, 3, 1, '#ffd21f'); R(x, y - 1, 1, 3, '#ffd21f');
        }
      }
    },
    fore(s) {
      if (s.mk < 0) return;
      const pose = happy() ? 'wave' : s.mk >= 1 && s.sick ? 'carry' : 'stand';
      walker('medic', this.medA(), this.medB(), s.mk, { pose, hop: hv('medic', 3) });
    },
    tap(s, x, y) {
      const gx = this.gx();
      if (near(x, y, gx, L.floorY - 8, 9, 10)) { SFX.boop(s.sick ? 0.7 : 1.1); hop('gran'); return true; }
      if (s.mk >= 0) { const m = this.medB(); if (near(x, y, lerp(this.medA().x, m.x, s.mk), m.yb - 8, 7, 10)) { SFX.boop(1); hop('medic'); return true; } }
      return false;
    },
  });

  // 6. Lost puppy hiding in a bush -> police car
  SC.push({
    veh: VI.police,
    kidX() { return Math.round(P - 2); },
    bushX() { return Math.round(P + 38); },
    front() { return this.kidX() - 14; },
    offA() { return { x: this.front() + 3, yb: L.laneY - 2 }; },
    offB() { return { x: this.bushX() - 19, yb: L.floorY + 3 }; },
    init() { return { peekT: 2, rustle: 0, ok: -1, pup: 'hide', pk: 0, tear: 0.3, found: false }; },
    ask() { return { x: this.kidX(), y: L.floorY - 16 }; },
    peek(s) { return s.peekT < 0 ? Math.sin(clamp01(-s.peekT / 1.2) * Math.PI) : 0; },
    update(s, dt) {
      s.rustle = Math.max(0, s.rustle - dt);
      if (s.pup === 'hide') {
        s.peekT -= dt;
        if (s.peekT <= -1.2) s.peekT = rand(3, 5);
      }
      if (!s.found && (s.tear -= dt) <= 0) { s.tear = 0.4; tear(this.kidX(), L.floorY + 2 - hv('kid'), 1, false); }
    },
    rescue(s, dt, t) {
      if (once(s, 'door', true)) SFX.door();
      s.ok = t >= 0.2 ? clamp01((t - 0.2) / 1.4) : -1;
      if (once(s, 'pop', t >= 1.8)) { s.pup = 'out'; s.pk = 0; s.rustle = 0.5; SFX.woof(); hop('pup'); sparkle(this.bushX() - 10, L.floorY - 6, 8, 6); }
      if (t >= 2.2) s.pk = clamp01((t - 2.2) / 1.2);
      if (once(s, 'got', t >= 3.4)) { s.found = true; SFX.woof(); hearts(this.kidX(), L.floorY - 14); hop('kid'); }
      return t >= 3.7;
    },
    back(s) {
      const kx = this.kidX(), bx = this.bushX(), yb = L.floorY + 2;
      const wob = s.rustle > 0 ? Math.sin(s.rustle * 40) * 1.5 : 0;
      if (s.pup === 'hide') drawDog(bx - 5 - this.peek(s) * 9, yb - hv('pup'), -1, '#f4f7fb', '#8a5a2a');
      drawBush(bx, yb, wob);
      drawPerson({ type: 'kid3', x: kx, yb, dir: 1, pose: happy() ? 'cheer' : 'stand', skin: SKIN[2], hop: hv('kid', 1), seed: 1 });
      if (s.pup === 'out') {
        const x = lerp(bx - 12, kx + 10, s.pk), step = s.pk > 0 && s.pk < 1 ? Math.floor(T * 10) % 2 : 0;
        drawDog(x, yb - hv('pup', 2) - step, -1, '#f4f7fb', '#8a5a2a', step);
      }
    },
    fore(s) {
      if (s.ok < 0) return;
      const dir = s.pup === 'out' ? -1 : 1;
      walker('cop', this.offA(), this.offB(), s.ok, { pose: happy() ? 'cheer' : 'stand', dir, hop: hv('cop', 2) });
    },
    tap(s, x, y) {
      const kx = this.kidX(), bx = this.bushX(), yb = L.floorY + 2;
      if (near(x, y, kx, yb - 9, 8, 10)) { SFX.boop(s.found ? 1.2 : 0.8); hop('kid'); return true; }
      if (s.pup === 'out') {
        const px = lerp(bx - 12, kx + 10, s.pk);
        if (near(x, y, px, yb - 5, 9, 7)) { SFX.woof(); hop('pup'); return true; }
      }
      if (near(x, y, bx, yb - 9, 17, 11)) {
        s.rustle = 0.5; SFX.woof();
        if (s.pup === 'hide' && s.peekT > 0) s.peekT = 0;
        return true;
      }
      return false;
    },
  });

  /* ---------- vehicles ---------- */
  const sc = () => SC[st.idx];
  const parkX = i => sc().front() - V[i].len;
  function choose(i) {
    const right = i === sc().veh;
    st.veh = { i, x: -V[i].len - 8, rot: 0, mode: 'in', t: 0, hop: 0, sp: 0, right, stop: siren(V[i].kind) };
    say(pick(V[i].kind));
    st.state = 'drive'; st.t = 0;
  }
  function arrived(v) {
    if (v.stop) { v.stop(); v.stop = null; }
    if (v.right) { v.mode = 'park'; st.state = 'rescue'; st.t = 0; }
    else { v.mode = 'hmm'; v.t = 0; SFX.hmm(); st.state = 'hmm'; }
  }
  function updVeh(v, dt) {
    const x0 = v.x;
    if (v.mode === 'in') {
      const tx = parkX(v.i), d = tx - v.x;
      v.x = Math.min(tx, v.x + Math.min(170, Math.max(28, d * 2.4)) * dt);
      if (v.x >= tx - 0.5) { v.x = tx; arrived(v); }
    } else if (v.mode === 'hmm') {
      v.x = parkX(v.i); v.t += dt;
      const t = v.t;
      v.hop = t < 0.3 ? Math.sin(t / 0.3 * Math.PI) * 4 : t > 0.4 && t < 0.65 ? Math.sin((t - 0.4) / 0.25 * Math.PI) * 2 : 0;
      if (t >= 1.4) { v.mode = 'out'; v.hop = 0; v.sp = 20; SFX.beep(); st.leavers.push(v); st.veh = null; st.state = 'wait'; st.hint = true; }
    } else if (v.mode === 'out') {
      v.sp = Math.min(170, v.sp + 220 * dt); v.x += v.sp * dt;
    } else v.x = parkX(v.i);
    v.rot += (v.x - x0) / 5;
  }
  function drawVeh(v) { drawV(v.i, v.x, L.laneY - Math.round(v.hop), v.mode === 'in' || v.mode === 'park', 0, v.rot); }

  function cardsVisible() { return st.state === 'wait'; }

  SCENES.help = {
    layout() {
      const uw = W - L.safeL - L.safeR;
      P = Math.round(L.safeL + uw * 0.6);
      const hb = L.homeBtn, gap = 6;
      const leftLim = hb.x + hb.s + 6, m = leftLim - L.safeL;
      let a = leftLim, b = W - L.safeR - m;
      let w = Math.floor((b - a - 2 * gap) / 3);
      if (w < 72) { b = W - L.safeR - 4; w = Math.floor((b - a - 2 * gap) / 3); }
      w = Math.min(w, 96);
      const x0 = Math.round((a + b - (3 * w + 2 * gap)) / 2);
      const h = L.palH - 9, y = L.palY + 4;
      st.cards = CARD_ORDER.map((vi, k) => ({ vi, x: x0 + k * (w + gap), y, w, h }));
      if (scene === 'help') setClouds(L.safeT + 24, Math.max(L.safeT + 60, L.hillY - 70));
    },
    enter() {
      let i;
      do { i = Math.random() * SC.length | 0; } while (SC.length > 1 && i === lastIdx);
      lastIdx = st.idx = i;
      Object.assign(st, { s: SC[i].init(), state: 'wait', t: 0, veh: null, leavers: [], hint: false, hops: {}, bub: 0 });
      setClouds(L.safeT + 24, Math.max(L.safeT + 60, L.hillY - 70));
    },
    leave() {
      for (const v of [st.veh, ...st.leavers]) if (v && v.stop) { v.stop(); v.stop = null; }
    },
    update(dt) {
      if (!st.s) this.enter();
      for (const k in st.hops) st.hops[k] = Math.max(0, st.hops[k] - dt);
      st.bub = Math.max(0, st.bub - dt);
      const c = sc(), s = st.s;
      st.t += dt;
      c.update(s, dt);
      if (st.veh) updVeh(st.veh, dt);
      for (const v of st.leavers) updVeh(v, dt);
      st.leavers = st.leavers.filter(v => v.x < W + 10);
      if (st.state === 'rescue' && c.rescue(s, dt, st.t)) {
        st.state = 'party'; st.t = 0; st.hint = false;
        SFX.fanfare(); say(pick('praise'), true);
      }
      if (st.state === 'party') {
        confetti();
        if (L.floorY > 220) spawn(1, () => ({ x: Math.random() * W, y: L.floorY - 200, vx: rand(-15, 15), vy: rand(30, 60), g: 40, life: 2.5, max: 2.5, s: 2, c: PALETTE[Math.random() * 7 | 0][2][1] }));
        if (st.t >= 1.5) { st.state = 'done'; st.t = 0; }
      }
    },
    drawWorld() {
      drawHeli(); drawHills(L.hillY, L.floorY); drawRoad();
      const c = sc(), s = st.s;
      c.back(s);
      for (const v of st.leavers) drawVeh(v);
      if (st.veh) drawVeh(st.veh);
      c.fore(s);
    },
    drawLit() {
      const c = sc(), s = st.s;
      if (c.lit) c.lit(s);
      drawParticles();
      if (st.state === 'wait' || st.state === 'drive' || st.state === 'hmm') {
        const a = c.ask(s), b = st.bub > 0 ? Math.round(Math.sin(st.bub / 0.3 * Math.PI) * 4) : 0;
        bubble(a.x, a.y - Math.round(Math.sin(T * 3) * 1.5) - b, tall() ? 3 : 2);
      }
      const v = st.veh;
      if (v && v.mode === 'hmm' && v.t > 0.2) bubble(Math.round(v.x + V[v.i].len / 2), L.laneY - V[v.i].h - 2, 2);
    },
    drawUI() {
      drawStrip();
      drawHomeButton();
      if (cardsVisible()) {
        const want = sc().veh;
        for (const cd of st.cards) {
          const hint = st.hint && cd.vi === want;
          const by = hint ? -Math.round(Math.abs(Math.sin(T * 5)) * 4) : 0;
          const bx = hint ? Math.round(Math.sin(T * 10) * (Math.sin(T * 2.5) > 0.3 ? 1 : 0)) : 0;
          const x = cd.x + bx, y = cd.y + by;
          rr(cd.x, cd.y + 2, cd.w, cd.h, '#2f6b29');
          if (hint) alpha(0.55 + 0.45 * Math.sin(T * 6), () => rr(x - 2, y - 2, cd.w + 4, cd.h + 4, '#ffd21f'));
          rr(x, y, cd.w, cd.h, '#cfd8e2'); rr(x, y, cd.w, cd.h - 3, '#ffffff');
          const vv = V[cd.vi];
          drawV(cd.vi, x + Math.floor((cd.w - vv.len) / 2), y + cd.h - 4, hint, 0, 0);
        }
      }
      if (st.state === 'done') drawAgainButton(L.againBtn, '#3fb43a', '#1f7a2a');
    },
    tap(x, y) {
      if (inBox(L.homeBtn, x, y)) { SFX.pop(); goScene('station'); return true; }
      if (st.state === 'done' && inBox(L.againBtn, x, y, 6)) { SFX.pop(); goScene('help'); return true; }
      if (cardsVisible()) {
        for (const cd of st.cards) if (x >= cd.x - 3 && x < cd.x + cd.w + 3 && y >= cd.y - 8 && y < cd.y + cd.h + 4) { choose(cd.vi); return true; }
      }
      const c = sc();
      if (c.tap(st.s, x, y)) return true;
      if (st.state === 'wait' || st.state === 'drive' || st.state === 'hmm') {
        const a = c.ask(st.s), u = tall() ? 3 : 2;
        if (near(x, y, a.x, a.y - (7 * u + 8) / 2 - 3, (5 * u + 8) / 2 + 2, (7 * u + 8) / 2 + 2)) { st.bub = 0.3; SFX.boop(1.4); return true; }
      }
      return false;
    },
  };
})();
