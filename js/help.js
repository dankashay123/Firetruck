// "Who Comes to Help?": a little problem appears and the child picks which vehicle should come.
// No fail state: a wrong vehicle just says "hmm?", drives on, and the right card starts to bounce.
'use strict';
(() => {
  const CARD_ORDER = [VI.police, VI.fire, VI.amb];
  const st = { idx: -1, s: null, state: 'wait', t: 0, veh: null, leavers: [], hint: false, cards: [], hops: {}, bub: 0 };
  const Y = {};       // this scene's own layout (road, strip, buttons), recomputed in layout()
  let P = 0;          // x anchor of the problem
  let lastIdx = -1;

  /* ---------- small helpers ---------- */
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const lerp = (a, b, k) => a + (b - a) * k;
  const happy = () => st.state === 'party' || st.state === 'done';
  const tall = () => H > W * 1.3;
  const fy = () => Y.floorY + 2;           // where people on the sidewalk stand
  function once(s, k, cond) { if (cond && !s['_' + k]) { s['_' + k] = 1; return true; } return false; }
  function hop(k) { st.hops[k] = 0.4; }
  // current hop height for a character; everyone bounces while celebrating
  function hv(k, seed = 0) {
    const h = st.hops[k] || 0;
    let v = h > 0 ? Math.sin((1 - h / 0.4) * Math.PI) * 6 : 0;
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
  // geometry of the engine's person sprite (see drawPerson in core.js)
  function body(type, x, yb, dir, sit, hopPx = 0) {
    const child = OUTFITS[type] && OUTFITS[type].child;
    const lY = 9 + (child ? 5 : 7), total = lY + (child ? 3 : 4) + 2;
    const bx = Math.floor(x) - 6, top = Math.floor(yb - hopPx) - (sit ? lY : total);
    const X = (dx, w = 1) => dir > 0 ? bx + dx : bx + 12 - dx - w;
    return { bx, top, lY, X, eye: { x: X(8), y: top + 6 } };
  }
  function tear(b, dir) {
    parts.push({ x: b.eye.x, y: b.eye.y, vx: dir * rand(5, 12), vy: rand(2, 8), g: 80, life: 0.6, max: 0.6, s: 2, c: '#6fb6ff' });
  }
  function hearts(cx, cy) { sparkle(cx, cy, 12, 8, '#ff6fb4'); sparkle(cx, cy, 12, 4, '#fff27a'); }
  function whistle() { tone('sine', 2700, 0, 0.12, 0.08); tone('sine', 2700, 0.18, 0.35, 0.08, 2500); }
  // someone walking from a to b ({x, yb}) as k goes 0..1
  function walker(type, a, b, k, opts) {
    drawPerson(Object.assign({ type, x: lerp(a.x, b.x, k), yb: lerp(a.yb, b.yb, k), dir: b.x >= a.x ? 1 : -1, walk: k > 0 && k < 1, seed: 2 }, opts));
  }
  const personHit = (x, y, px, yb, type) => near(x, y, px, yb - personH(type) / 2, 9, personH(type) / 2 + 3);
  const QM = ['01110', '10001', '00001', '00110', '00100', '00000', '00100'];
  function qmark(x, y, u, c) { QM.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') R(x + i * u, y + j * u, u, u, c); })); }
  const bubbleSize = u => ({ w: 5 * u + 8, h: 7 * u + 8 });
  // speech bubble with a "?" whose tail tip is at (cx, by)
  function bubble(cx, by, u) {
    const { w, h } = bubbleSize(u);
    const x = Math.round(cx - w / 2), y = Math.round(by - h - 3);
    rr(x - 1, y - 1, w + 2, h + 2, '#22222a');
    R(cx - 3, y + h, 7, 1, '#22222a'); R(cx - 2, y + h + 1, 5, 1, '#22222a'); R(cx - 1, y + h + 2, 3, 2, '#22222a');
    rr(x, y, w, h, '#ffffff');
    R(cx - 2, y + h - 1, 5, 1, '#ffffff'); R(cx - 1, y + h, 3, 1, '#ffffff'); R(cx, y + h + 1, 1, 1, '#ffffff');
    qmark(x + 4, y + 4, u, '#2a6fe0');
  }
  const bubU = () => tall() ? 3 : 2;

  /* ---------- animals & props (bigger than the engine's, to match the people) ---------- */
  // cat 13 wide x 10 tall standing on (x, yb)
  function drawBigCat(x, yb, dir, col = '#9aa3ad', dark = '#6b7480') {
    const bx = Math.floor(x) - 6, top = Math.floor(yb) - 10;
    const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 13 - dx - w, top + dy, w, h, c);
    const wag = Math.floor(T * 3) % 2;
    M(0, 1 + wag, 1, 5, col); M(1, 5, 1, 1, col);                    // tail
    M(1, 4, 8, 4, col); M(3, 4, 1, 2, dark); M(5, 4, 1, 2, dark);       // body + stripes
    M(2, 8, 2, 2, col); M(7, 8, 2, 2, col);                             // legs
    M(7, 2, 6, 5, col); M(7, 0, 2, 2, col); M(11, 0, 2, 2, col);        // head + ears
    M(8, 1, 1, 1, '#ff9cc8'); M(11, 1, 1, 1, '#ff9cc8');
    M(9, 3, 1, 2, INK); M(11, 3, 1, 2, INK);
    M(9, 5, 3, 2, '#e9eef2'); M(12, 5, 1, 1, '#ff6fb4');
  }
  // mama duck 15x13 or duckling 10x8
  function drawBigDuck(x, yb, big, dir = 1, step = 0) {
    const w = big ? 16 : 10, h = big ? 13 : 8;
    const bx = Math.floor(x) - (w >> 1), top = Math.floor(yb) - h;
    const M = (dx, dy, ww, hh, c) => R(dir > 0 ? bx + dx : bx + w - dx - ww, top + dy, ww, hh, c);
    if (big) {
      const c = '#f4f7fb', sh = '#cfd8e2';
      M(0, 5, 2, 2, c); M(0, 6, 12, 5, c); M(1, 11, 10, 1, c); M(3, 7, 6, 2, sh);
      M(9, 0, 5, 5, c); M(10, 5, 3, 2, c);
      M(12, 2, 1, 1, INK); M(14, 3, 2, 2, '#f57a12');
      M(4 + step, 12, 3, 1, '#f57a12'); M(8 - step, 12, 3, 1, '#f57a12');
    } else {
      const c = '#ffd21f', sh = '#e0b010';
      M(0, 3, 7, 4, c); M(1, 4, 3, 2, sh); M(5, 0, 4, 4, c);
      M(7, 1, 1, 1, INK); M(9, 2, 1, 1, '#f57a12'); M(8, 2, 1, 1, '#f57a12');
      M(2 + step, 7, 2, 1, '#f57a12'); M(5 - step, 7, 2, 1, '#f57a12');
    }
  }
  // dog 18 wide x 13 tall
  function drawBigDog(x, yb, dir, col, dark, step = 0) {
    const bx = Math.floor(x) - 9, top = Math.floor(yb) - 13;
    const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 18 - dx - w, top + dy, w, h, c);
    const wag = Math.floor(T * 8) % 2;
    M(0, 2 + wag, 2, 4, col);                                            // tail
    M(2, 5, 10, 5, col); M(4, 6, 3, 3, dark);                            // body + spot
    if (step) { M(4, 10, 2, 3, col); M(9, 10, 2, 3, col); } else { M(3, 10, 2, 3, col); M(10, 10, 2, 3, col); }
    M(10, 1, 6, 6, col); M(15, 4, 3, 3, col);                            // head, snout
    M(17, 4, 1, 1, INK); M(13, 3, 1, 2, INK);                            // nose, eye
    M(10, 1, 2, 6, dark);                                                // ear
    M(11, 7, 3, 1, '#e8222b');                                           // collar
    M(15, 7, 1, 2, '#ff6fb4');                                           // tongue
  }
  function drawBigTree(tx, by, fy) {
    const top = by - 20;
    R(tx - 5, top, 11, fy - top, '#7a4a2a'); R(tx - 5, top, 3, fy - top, '#5e3820');
    R(tx - 8, fy - 3, 17, 3, '#7a4a2a');
    R(tx - 38, by, 36, 4, '#7a4a2a'); R(tx - 38, by + 3, 36, 1, '#5e3820');      // the branch
    circle(tx - 40, by + 1, 5, '#3f9a45'); circle(tx - 41, by - 1, 2, '#5bb85a');
    circle(tx + 2, by - 32, 26, '#3f9a45');
    circle(tx - 15, by - 21, 14, '#3f9a45'); circle(tx + 18, by - 18, 14, '#3f9a45');
    circle(tx - 4, by - 40, 14, '#5bb85a'); circle(tx - 16, by - 25, 7, '#5bb85a'); circle(tx + 16, by - 23, 7, '#5bb85a');
    for (const [dx, dy] of [[10, -30], [-8, -16], [20, -13], [-2, -47], [6, -20], [-20, -30]]) R(tx + dx, by + dy, 3, 3, '#e8222b');
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
    line(bx, by - 5, bx + 7, by - 10, c, 2); line(bx + 7, by - 10, bx + 15, by - 12, c, 2);
    line(bx + 1, by - 6, bx + 8, by - 14, c, 2); line(bx + 8, by - 14, bx + 15, by - 12, c, 2);
    R(bx + 7, by - 17, 5, 2, '#2f3240');                                       // seat
    line(bx, by - 5, bx - 3, by - 13, '#2f3240', 2); R(bx - 6, by - 14, 6, 2, '#2f3240');   // handlebar
    wheel(bx, by - 5, 5, 0);
    wheel(bx + 15, by - 12, 5, T * 4);
  }
  function drawDoghouse(x, yb, wet) {
    const body = wet ? '#b98048' : '#d89a58', dark = wet ? '#7a4a24' : '#9a6534', roof = wet ? '#8a2a2a' : '#c23030';
    R(x - 13, yb - 18, 26, 18, body); R(x - 13, yb - 18, 2, 18, dark);
    R(x - 13, yb - 13, 26, 1, dark); R(x - 13, yb - 7, 26, 1, dark);
    R(x - 5, yb - 12, 10, 12, '#3a2516'); R(x - 4, yb - 13, 8, 1, '#3a2516');
    for (let k = 0; k < 12; k++) R(x - 16 + k, yb - 19 - k, 32 - 2 * k, 1, k === 0 ? '#7a1a1a' : roof);
    R(x - 3, yb - 16, 6, 1, '#ffffff'); R(x - 4, yb - 17, 1, 3, '#ffffff'); R(x + 3, yb - 17, 1, 3, '#ffffff');   // bone sign
  }
  function drawBush(x, yb, wob) {
    x = Math.round(x + wob);
    circle(x, yb - 13, 13, '#3f9a45'); circle(x - 12, yb - 8, 8, '#3f9a45'); circle(x + 12, yb - 8, 8, '#3f9a45');
    circle(x - 4, yb - 17, 6, '#5bb85a'); circle(x - 13, yb - 10, 4, '#5bb85a'); circle(x + 9, yb - 12, 4, '#5bb85a');
    R(x - 7, yb - 5, 3, 3, '#ff6fb4'); R(x + 5, yb - 19, 3, 3, '#fff27a'); R(x + 12, yb - 7, 3, 3, '#ff6fb4'); R(x - 14, yb - 13, 3, 3, '#fff27a');
  }
  function drawBench(gx, sy, fy) {
    R(gx - 12, sy - 14, 2, 14, '#7a4a2a'); R(gx + 10, sy - 14, 2, 14, '#7a4a2a');
    R(gx - 14, sy - 14, 28, 3, '#c98a4a'); R(gx - 14, sy - 8, 28, 3, '#c98a4a');
    R(gx - 14, sy, 28, 3, '#c98a4a'); R(gx - 14, sy + 2, 28, 1, '#9a6534');
    R(gx - 12, sy + 3, 2, fy - sy - 3, '#5e3820'); R(gx + 10, sy + 3, 2, fy - sy - 3, '#5e3820');
  }
  // background village on tall screens, so the grass isn't empty
  const HOUSE_C = [['#ffb15a', '#c23030'], ['#8fe3d4', '#2a6fe0'], ['#fff27a', '#8a4fd9'], ['#ffb3da', '#3fb43a']];
  const houseH = h => Math.round(h.w * 0.62);
  const houseWins = h => [[5, 6], [h.w - 11, 6]];
  function drawHouse(h) {
    const { x, y, w } = h, ht = houseH(h);
    R(x, y - ht, w, ht, h.c[0]); R(x, y - ht, 3, ht, mix(h.c[0], '#000000', 0.15));
    for (let k = 0; k < (w >> 1) + 3; k++) R(x - 3 + k, y - ht - 1 - k, w + 6 - 2 * k, 1, k === 0 ? mix(h.c[1], '#000000', 0.3) : h.c[1]);
    R(x + w - 12, y - ht - 18, 5, 8, '#9a6534');                                    // chimney
    R(x + (w >> 1) - 4, y - 12, 8, 12, '#7a4a2a'); R(x + (w >> 1) + 1, y - 6, 1, 1, '#ffd21f');
    for (const [wx, wy] of houseWins(h)) { R(x + wx - 1, y - ht + wy - 1, 8, 8, '#ffffff'); R(x + wx, y - ht + wy, 6, 6, '#bfe6ff'); R(x + wx + 3, y - ht + wy, 1, 6, '#ffffff'); }
    R(x - 2, y, w + 4, 2, '#4a9440');
  }
  function drawHouseLights(h) {
    const ht = houseH(h), k = nightK();
    for (const [wx, wy] of houseWins(h)) alpha(k, () => { R(h.x + wx, h.y - ht + wy, 3, 6, '#ffe873'); R(h.x + wx + 4, h.y - ht + wy, 2, 6, '#ffe873'); });
  }
  function drawDistantTree(x, y) {
    R(x - 1, y - 12, 4, 12, '#7a4a2a'); circle(x + 1, y - 18, 9, '#3f9a45'); circle(x - 2, y - 21, 4, '#5bb85a');
  }

  /* ---------- scenarios ---------- */
  // Each: veh (the right vehicle), front() (where the vehicle's nose stops), init() -> state,
  // ask(s) (where the "?" bubble points), update(s, dt), rescue(s, dt, t) -> done?,
  // back(s) / fore(s) (drawn behind / over the vehicles), lit(s), tap(s, x, y) -> handled?
  const SC = [];

  // 1. Kitty stuck in a tree -> fire truck
  SC.push({
    veh: VI.fire,
    tx() {   // keep the canopy clear of the sun on short screens
      const tx = Math.round(P + 22);
      return this.by() - 60 < L.sunY + 30 ? Math.min(tx, L.sunX - 72) : tx;
    },
    by() { return Y.floorY - Math.max(42, Math.min(100, Y.floorY - L.safeT - 70)); },
    front() { return this.tx() - 5; },
    kid() { return { x: this.tx() + 19, yb: fy() }; },
    ladA() { return { x: this.front() - 56, y: Y.laneY - 33 }; },
    ladB() { return { x: this.tx() - 24, y: this.by() + 1 }; },
    init() { return { meow: 1.2, lad: 0, cat: 'branch', ck: 0 }; },
    ask() { return { x: this.tx() - 26, y: this.by() - 12 }; },
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
        if (once(s, 'h', true)) { SFX.meow(); const k = this.kid(); hearts(k.x, k.yb - 22); }
      }
      return t >= 3.6;
    },
    back(s) {
      const tx = this.tx(), by = this.by(), k = this.kid();
      drawBigTree(tx, by, fy());
      if (s.cat === 'branch') drawBigCat(tx - 26, by - hv('cat'), 1);
      const kh = hv('kid', 1);
      drawPerson({ type: 'kid', x: k.x, yb: k.yb, dir: -1, pose: happy() ? 'cheer' : 'wave', skin: SKIN[1], hop: kh, seed: 1 });
      if (s.cat === 'held') drawBigCat(k.x - 2, k.yb - kh - 3, -1);
    },
    fore(s) {
      const a = this.ladA(), b = this.ladB();
      if (s.lad > 0) drawLadder(a, b, s.lad);
      if (s.cat === 'slide') drawBigCat(lerp(b.x, a.x, s.ck), lerp(b.y, a.y, s.ck) - 2, -1);
      if (s.cat === 'jump') {
        const k = this.kid();
        drawBigCat(lerp(a.x, k.x - 2, s.ck), lerp(a.y - 2, k.yb - 3, s.ck) - Math.sin(s.ck * Math.PI) * 18, 1);
      }
    },
    tap(s, x, y) {
      const tx = this.tx(), by = this.by(), k = this.kid();
      if (s.cat === 'branch' && near(x, y, tx - 26, by - 5, 12)) { SFX.meow(); hop('cat'); return true; }
      if (personHit(x, y, k.x, k.yb, 'kid')) { SFX.boop(1.2); hop('kid'); if (s.cat === 'held') SFX.meow(); return true; }
      if ((x - tx) ** 2 + (y - (by - 30)) ** 2 < 30 * 30) {
        SFX.pop();
        spawn(7, () => ({ x: tx + rand(-20, 20), y: by - 32 + rand(-14, 10), vx: rand(-12, 12), vy: rand(-4, 8), g: 25, life: 1.3, max: 1.3, s: 2, c: Math.random() < 0.5 ? '#5bb85a' : '#3f9a45' }));
        return true;
      }
      return false;
    },
  });

  // 2. Bumped knee -> ambulance
  SC.push({
    veh: VI.amb,
    kx() { return Math.round(P + 8); },
    front() { return this.kx() - 24; },
    medA() { return { x: this.front() + 5, yb: Y.laneY - 2 }; },
    medB() { return { x: this.kx() - 16, yb: Y.floorY + 3 }; },
    init() { return { tear: 0.2, fixed: false, stand: false, mk: -1 }; },
    kidBody(s, kh) { return s.stand || happy() ? body('kid2', this.kx(), fy(), -1, false, kh) : body('kid2', this.kx(), Y.floorY + 1, -1, true, kh); },
    ask(s) { return { x: this.kx(), y: this.kidBody(s, 0).top - 2 }; },
    update(s, dt) {
      if (!s.fixed && (s.tear -= dt) <= 0) { s.tear = 0.4; tear(this.kidBody(s, hv('kid')), -1); }
    },
    rescue(s, dt, t) {
      if (once(s, 'door', true)) SFX.door();
      s.mk = t >= 0.3 ? clamp01((t - 0.3) / 1.2) : -1;
      if (once(s, 'b', t >= 1.8)) { s.fixed = true; SFX.chime(); const b = this.kidBody(s, 0); sparkle(b.X(9, 2), b.top + b.lY + 2, 8, 10); }
      if (once(s, 'st', t >= 2.5)) { s.stand = true; hop('kid'); SFX.boop(1.2); }
      return t >= 2.9;
    },
    back(s) {
      const kx = this.kx(), kh = hv('kid', 1);
      drawBike(kx + 14, fy());
      const standing = s.stand || happy();
      const b = this.kidBody(s, kh);
      drawPerson({ type: 'kid2', x: kx, yb: standing ? fy() : Y.floorY + 1, dir: -1, pose: happy() ? 'cheer' : standing ? 'stand' : 'sit', skin: SKIN[0], hop: kh, seed: 1 });
      if (!standing) {   // knee: sitting, the shin hangs at dx 9..10
        if (s.fixed) R(b.X(9, 2), b.top + b.lY + 2, 2, 2, '#ffffff'); else { R(b.X(9, 2), b.top + b.lY + 2, 2, 1, '#ff3b3b'); R(b.X(9, 2), b.top + b.lY + 3, 1, 1, '#ff3b3b'); }
      } else R(b.X(6, 3), b.top + b.lY + 1, 3, 1, '#ffffff');
    },
    fore(s) {
      if (s.mk < 0) return;
      const pose = happy() ? 'wave' : s.mk >= 1 && !s.fixed ? 'carry' : 'stand';
      walker('medic', this.medA(), this.medB(), s.mk, { pose, hop: hv('medic', 3) });
    },
    tap(s, x, y) {
      const kx = this.kx();
      if (personHit(x, y, kx, fy(), 'kid2')) { SFX.boop(s.fixed ? 1.2 : 0.8); hop('kid'); return true; }
      if (near(x, y, kx + 21, fy() - 8, 12, 9)) { tone('sine', 1800, 0, 0.3, 0.1); tone('sine', 1800, 0.15, 0.4, 0.1); return true; }
      if (s.mk >= 0) { const a = this.medA(), m = this.medB(); if (personHit(x, y, lerp(a.x, m.x, s.mk), lerp(a.yb, m.yb, s.mk), 'medic')) { SFX.boop(1); hop('medic'); return true; } }
      return false;
    },
  });

  // 3. Ducks want to cross the road -> police car
  const CAR_RAMPS = [0, 1, 2, 3, 5, 6].map(i => PALETTE[i][2]);
  const DUCK_DX = [16, 4, -4, -12];
  SC.push({
    veh: VI.police,
    cx() { return Math.round(P + 16); },
    stopX() { return this.cx() - 38; },
    front() { return this.cx() - 36; },
    offA() { return { x: this.front() + 4, yb: Y.laneY - 2 }; },
    offB() { return { x: this.cx() - 29, yb: Y.roadY + 27 }; },
    offC() { return { x: this.cx() - 29, yb: fy() }; },
    init() {
      const s = { cars: [], spawn: 1, stop: false, ok: -1, ob: -1, ct: -1, quack: 1.5, peep: 0.5 };
      for (const x of [W * 0.12, W * 0.62]) s.cars.push({ x, c: pickOne(CAR_RAMPS), rot: 0 });
      return s;
    },
    ask() { return { x: this.cx() + DUCK_DX[0], y: Y.floorY - 13 }; },
    duckPos(s, i) {
      const k = s.ct < 0 ? 0 : clamp01((s.ct - i * 0.2) / 1.6);
      return { x: this.cx() + DUCK_DX[i], y: lerp(Y.roadY + 2, Y.roadY + Y.roadH - 1, k), walk: k > 0 && k < 1 };
    },
    update(s, dt) {
      const stopX = this.stopX();
      s.cars.sort((a, b) => b.x - a.x);
      let limit = Infinity;
      for (const c of s.cars) {         // far-lane traffic, queueing behind the officer when stopped
        let lim = limit;
        const before = c.x + 34 <= stopX + 1;
        if (s.stop && before) lim = Math.min(lim, stopX);
        const room = lim - (c.x + 34);
        // stopped traffic brakes hard; a car already past the officer hurries through
        const sp = s.stop && !before ? 160 : room < 24 ? Math.max(0, room * 4) : 55;
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
      if (s.ct >= 0 && s.ct < 2.2 && (s.peep -= dt) <= 0) { s.peep = rand(0.3, 0.6); SFX.peep(); }
      if (happy() && (s.peep -= dt) <= 0) { s.peep = rand(0.6, 1.2); SFX.peep(); }
    },
    rescue(s, dt, t) {
      const cx = this.cx();
      if (once(s, 'door', true)) SFX.door();
      s.ok = t >= 0.15 ? clamp01((t - 0.15) / 0.75) : -1;
      if (once(s, 'stop', t >= 0.9)) { s.stop = true; whistle(); }
      const clear = !s.cars.some(c => c.x < cx + 26 && c.x + 34 > cx - 22);
      if (s.ct < 0 && t >= 1.0 && (clear || t >= 1.6)) { s.ct = 0; SFX.quack(); }
      if (s.ct >= 0) s.ct += dt;
      if (s.ct >= 2.0) {
        s.ob = clamp01((s.ct - 2.0) / 0.5);
        if (s.ob >= 1) { s.stop = false; return true; }
      }
      return false;
    },
    back(s) {
      for (const c of s.cars) drawCar(c.x, Y.roadY + 22, c.c, c.rot);
      if (s.ct < 0) this.ducks(s);
    },
    ducks(s) {
      for (let i = 0; i < 4; i++) {
        const d = this.duckPos(s, i), step = d.walk ? Math.floor(T * 8 + i) % 2 : 0;
        drawBigDuck(d.x, d.y - step - hv('d' + i, i), i === 0, 1, step);
      }
    },
    fore(s) {
      if (s.ct >= 0) this.ducks(s);
      if (s.ok < 0) return;
      const inRoad = s.ob < 0;
      const a = inRoad ? this.offA() : this.offB(), b = inRoad ? this.offB() : this.offC(), k = inRoad ? s.ok : s.ob;
      const holding = inRoad && k >= 1;
      const oh = hv('cop', 2);
      walker('cop', a, b, k, { pose: happy() ? 'cheer' : holding ? 'wave' : 'stand', dir: holding ? -1 : (b.x >= a.x ? 1 : -1), hop: oh });
      if (s.stop && holding) {    // hand-held stop sign
        const bd = body('cop', b.x, b.yb, -1, false, oh), x = bd.X(8, 2) + 1, y = bd.top + 2;
        R(x, y - 6, 1, 8, '#5a5f6e');
        circle(x, y - 12, 7, '#ffffff'); circle(x, y - 12, 6, '#e8222b'); R(x - 3, y - 13, 7, 2, '#ffffff');
      }
    },
    lit(s) {   // the little cars get lights at night
      const k = nightK();
      if (k < 0.02) return;
      for (const c of s.cars) {
        const y = Y.roadY + 22 - 8, x = Math.floor(c.x);
        for (let j = 0; j < 22; j++) { const half = 1 + j * 0.2; alpha(0.28 * k * (1 - j / 24), () => R(x + 34 + j, y + 1 - half, 1, half * 2, '#fff3b0')); }
        alpha(k, () => { R(x + 33, y, 1, 2, '#fffbe6'); R(x, y, 1, 2, '#ff4a3a'); });
        alpha(0.5 * k, () => { circle(x + 34, y + 1, 2, '#fff3b0'); circle(x, y + 1, 2, '#ff3b3b'); });
      }
    },
    tap(s, x, y) {
      for (let i = 0; i < 4; i++) {
        const d = this.duckPos(s, i);
        if (near(x, y, d.x, d.y - (i ? 4 : 7), i ? 7 : 10, i ? 7 : 9)) { if (i) SFX.peep(); else SFX.quack(); hop('d' + i); return true; }
      }
      for (const c of s.cars) if (x >= c.x && x < c.x + 34 && y > Y.roadY + 4 && y < Y.roadY + 23) { SFX.honk(); return true; }
      if (s.ok >= 0) {
        const a = s.ob < 0 ? this.offA() : this.offB(), b = s.ob < 0 ? this.offB() : this.offC(), k = s.ob < 0 ? s.ok : s.ob;
        if (personHit(x, y, lerp(a.x, b.x, k), lerp(a.yb, b.yb, k), 'cop')) { whistle(); hop('cop'); return true; }
      }
      return false;
    },
  });

  // 4. Doghouse on fire -> fire truck
  SC.push({
    veh: VI.fire,
    hx() { return Math.round(P + 22); },
    front() { return this.hx() - 46; },
    ffA() { return { x: this.front() + 5, yb: Y.laneY - 2 }; },
    ffB() { return { x: this.hx() - 33, yb: Y.floorY + 9 }; },
    init() { return { fire: 1, woof: 1.5, smoke: 0, fk: -1, spray: false, wet: false, steam: 0 }; },
    ask() { return { x: this.hx() + 30, y: Y.floorY - 14 }; },
    roofY() { return Y.floorY + 1 - 19; },
    update(s, dt) {
      const hx = this.hx(), r = this.roofY();
      if (s.fire > 0.05 && (s.smoke -= dt) <= 0) { s.smoke = 0.45; puff(hx + rand(-5, 5), r - 30 - s.fire * 4, 2, '#8a8f99'); }
      if (!happy() && s.fire > 0 && (s.woof -= dt) <= 0) { s.woof = rand(3, 4.5); SFX.woof(); hop('dog'); }
      if (s.spray && (s.steam -= dt) <= 0) { s.steam = 0.15; puff(hx + rand(-8, 8), r - 6, 1, '#ffffff'); }
    },
    rescue(s, dt, t) {
      if (once(s, 'door', true)) SFX.door();
      s.fk = t >= 0.2 ? clamp01((t - 0.2) / 0.9) : -1;
      if (once(s, 'sp', t >= 1.3)) { s.spray = true; SFX.water(); }
      s.fire = 1 - clamp01((t - 1.5) / 1.6);
      if (once(s, 'out', t >= 3.1)) { s.fire = 0; s.wet = true; SFX.sizzle(); puff(this.hx(), this.roofY() - 6, 14); }
      if (t >= 3.4) s.spray = false;
      if (once(s, 'dog', t >= 3.5)) { SFX.woof(); hop('dog'); }
      return t >= 3.8;
    },
    back(s) {
      const hx = this.hx(), yb = Y.floorY + 1;
      drawDoghouse(hx, yb, s.wet);
      drawBigDog(hx + 30, fy() - hv('dog', 2), -1, '#e0b070', '#8a5a2a');
    },
    fore(s) {
      if (s.fk < 0) return;
      const a = this.ffA(), b = this.ffB(), x = lerp(a.x, b.x, s.fk), yb = lerp(a.yb, b.yb, s.fk), fh = hv('ff', 4);
      const bd = body('ff', x, yb, 1, false, fh);
      line(this.front() - 24, Y.laneY - 12, bd.X(11) - 1, bd.top + 11, '#3a3d46', 2);   // hose
      walker('ff', a, b, s.fk, { pose: happy() ? 'cheer' : s.fk >= 1 ? 'carry' : 'stand', dir: 1, hop: fh });
      if (!happy() && s.fk >= 1) R(bd.X(11), bd.top + 10, 3, 3, '#5a5f6e');            // nozzle
      if (s.spray) {
        const nx = bd.X(11) + 3, ny = bd.top + 11, tx = this.hx(), ty = this.roofY() - 4;
        for (let j = 0; j < 18; j++) {
          const u = ((j + T * 9) % 18) / 18;
          const px = lerp(nx, tx, u), py = lerp(ny, ty, u) - Math.sin(u * Math.PI) * 18;
          R(px, py, 2, 2, j % 3 ? '#9fd2ef' : '#ffffff');
        }
        for (let j = 0; j < 5; j++) R(tx + rand(-8, 8), ty + rand(-4, 3), 1, 1, '#ffffff');
      }
    },
    lit(s) {
      if (s.fire <= 0.05) return;
      const hx = this.hx(), roof = this.roofY(), f = s.fire;
      if (nightK() > 0.05) alpha(0.3 * f * nightK(), () => circle(hx, roof - 8, 22, '#ffb15a'));
      flame(hx - 8, roof + 2, 1.2 * f, 1);
      flame(hx + 7, roof + 3, 1.0 * f, 4);
      flame(hx, roof - 4, 0.8 * f, 7);
    },
    tap(s, x, y) {
      const hx = this.hx(), yb = Y.floorY + 1;
      if (near(x, y, hx + 30, yb - 7, 11, 9)) { SFX.woof(); hop('dog'); return true; }
      if (near(x, y, hx, yb - 24, 17, 24)) { if (s.fire > 0.05) { SFX.whoosh(); puff(hx, yb - 48, 4, '#8a8f99'); } else SFX.pop(); return true; }
      if (s.fk >= 0) { const a = this.ffA(), b = this.ffB(); if (personHit(x, y, lerp(a.x, b.x, s.fk), lerp(a.yb, b.yb, s.fk), 'ff')) { SFX.boop(1); hop('ff'); return true; } }
      return false;
    },
  });

  // 5. Grandma feeling dizzy -> ambulance
  SC.push({
    veh: VI.amb,
    gx() { return Math.round(P + 14); },
    sy() { return Y.floorY - 7; },
    front() { return this.gx() - 32; },
    medA() { return { x: this.front() + 5, yb: Y.laneY - 2 }; },
    medB() { return { x: this.gx() - 25, yb: Y.floorY + 3 }; },
    init() { return { sick: true, stand: false, mk: -1, sigh: 1.5 }; },
    granBody(s, gh) { return s.stand ? body('gran', this.gx() - 8, fy(), -1, false, gh) : body('gran', this.gx() + 2, this.sy(), -1, true, gh); },
    ask(s) { return { x: this.gx() + 2, y: this.granBody(s, 0).top - 5 }; },
    update(s, dt) {
      if (s.sick && (s.sigh -= dt) <= 0) { s.sigh = rand(3.5, 5); tone('sine', 340, 0, 0.6, 0.07, 250); }
    },
    rescue(s, dt, t) {
      if (once(s, 'door', true)) SFX.door();
      s.mk = t >= 0.3 ? clamp01((t - 0.3) / 1.2) : -1;
      if (once(s, 'heal', t >= 1.8)) { s.sick = false; SFX.chime(); hearts(this.gx() + 2, this.granBody(s, 0).top + 4); }
      if (once(s, 'st', t >= 2.5)) { s.stand = true; hop('gran'); SFX.boop(1.1); }
      return t >= 2.9;
    },
    back(s) {
      const gx = this.gx(), sy = this.sy();
      drawBench(gx, sy, fy());
      const gh = hv('gran', 1);
      const skin = s.sick ? '#cfe3a6' : SKIN[0];
      if (s.stand) drawPerson({ type: 'gran', x: gx - 8, yb: fy(), dir: -1, pose: happy() ? 'cheer' : 'stand', skin, hop: gh });
      else drawPerson({ type: 'gran', x: gx + 2, yb: sy, dir: -1, pose: 'sit', skin, hop: gh });
      if (s.sick) {
        const b = this.granBody(s, gh);
        for (let k = 0; k < 3; k++) {
          const a = T * 3 + k * 2.094, x = b.bx + 6 + Math.cos(a) * 9, y = b.top - 2 + Math.sin(a) * 2;
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
      if (near(x, y, gx, Y.floorY - 10, 13, 13)) { SFX.boop(s.sick ? 0.7 : 1.1); hop('gran'); return true; }
      if (s.mk >= 0) { const a = this.medA(), m = this.medB(); if (personHit(x, y, lerp(a.x, m.x, s.mk), lerp(a.yb, m.yb, s.mk), 'medic')) { SFX.boop(1); hop('medic'); return true; } }
      return false;
    },
  });

  // 6. Lost puppy hiding in a bush -> police car
  SC.push({
    veh: VI.police,
    kidX() { return Math.round(P - 4); },
    bushX() { return Math.round(P + 44); },
    front() { return this.kidX() - 18; },
    offA() { return { x: this.front() + 4, yb: Y.laneY - 2 }; },
    offB() { return { x: this.bushX() - 28, yb: Y.floorY + 3 }; },
    init() { return { peekT: 2, rustle: 0, ok: -1, pup: 'hide', pk: 0, tear: 0.3, found: false }; },
    ask() { return { x: this.kidX(), y: fy() - 21 }; },
    peek(s) { return s.peekT < 0 ? Math.sin(clamp01(-s.peekT / 1.2) * Math.PI) : 0; },
    pupX(s) { return lerp(this.bushX() - 16, this.kidX() + 15, s.pk); },
    update(s, dt) {
      s.rustle = Math.max(0, s.rustle - dt);
      if (s.pup === 'hide') {
        s.peekT -= dt;
        if (s.peekT <= -1.2) s.peekT = rand(3, 5);
      }
      if (!s.found && (s.tear -= dt) <= 0) { s.tear = 0.4; tear(body('kid3', this.kidX(), fy(), 1, false, hv('kid')), 1); }
    },
    rescue(s, dt, t) {
      if (once(s, 'door', true)) SFX.door();
      s.ok = t >= 0.2 ? clamp01((t - 0.2) / 1.4) : -1;
      if (once(s, 'pop', t >= 1.8)) { s.pup = 'out'; s.pk = 0; s.rustle = 0.5; SFX.woof(); hop('pup'); sparkle(this.bushX() - 14, Y.floorY - 8, 10, 6); }
      if (t >= 2.2) s.pk = clamp01((t - 2.2) / 1.2);
      if (once(s, 'got', t >= 3.4)) { s.found = true; SFX.woof(); hearts(this.kidX(), Y.floorY - 18); hop('kid'); }
      return t >= 3.7;
    },
    back(s) {
      const kx = this.kidX(), bx = this.bushX();
      const wob = s.rustle > 0 ? Math.sin(s.rustle * 40) * 1.5 : 0;
      if (s.pup === 'hide') drawBigDog(bx - 6 - this.peek(s) * 14, fy() - hv('pup'), -1, '#f4f7fb', '#8a5a2a');
      drawBush(bx, fy(), wob);
      drawPerson({ type: 'kid3', x: kx, yb: fy(), dir: 1, pose: happy() ? 'cheer' : 'stand', skin: SKIN[2], hop: hv('kid', 1), seed: 1 });
      if (s.pup === 'out') {
        const step = s.pk > 0 && s.pk < 1 ? Math.floor(T * 10) % 2 : 0;
        drawBigDog(this.pupX(s), fy() - hv('pup', 2) - step, -1, '#f4f7fb', '#8a5a2a', step);
      }
    },
    fore(s) {
      if (s.ok < 0) return;
      const dir = s.pup === 'out' ? -1 : 1;
      walker('cop', this.offA(), this.offB(), s.ok, { pose: happy() ? 'cheer' : 'stand', dir, hop: hv('cop', 2) });
    },
    tap(s, x, y) {
      const kx = this.kidX(), bx = this.bushX();
      if (personHit(x, y, kx, fy(), 'kid3')) { SFX.boop(s.found ? 1.2 : 0.8); hop('kid'); return true; }
      if (s.pup === 'out' && near(x, y, this.pupX(s), fy() - 7, 11, 9)) { SFX.woof(); hop('pup'); return true; }
      if (s.ok >= 0) { const a = this.offA(), b = this.offB(); if (personHit(x, y, lerp(a.x, b.x, s.ok), lerp(a.yb, b.yb, s.ok), 'cop')) { whistle(); hop('cop'); return true; } }
      if (near(x, y, bx, fy() - 12, 22, 14)) {
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
  function drawVeh(v) { drawV(v.i, v.x, Y.laneY - Math.round(v.hop), v.mode === 'in' || v.mode === 'park', 0, v.rot); }

  const cardsVisible = () => st.state === 'wait';
  function drawMyStrip() {
    R(0, Y.palY, W, H - Y.palY, '#5aa84c');
    R(0, Y.palY, W, 2, '#4a9440');
    for (let xx = 7; xx < W; xx += 23) { R(xx, Y.palY + 5 + (xx % 3), 1, 2, '#7cc96a'); R(xx + 11, H - 4 - (xx % 2), 1, 2, '#7cc96a'); }
  }

  function drawCard(cd, vi, bx, by, glow) {
    const x = cd.x + bx, y = cd.y + by;
    rr(cd.x, cd.y + 2, cd.w, cd.h, '#2f6b29');
    if (glow) alpha(0.55 + 0.45 * Math.sin(T * 6), () => rr(x - 2, y - 2, cd.w + 4, cd.h + 4, '#ffd21f'));
    rr(x, y, cd.w, cd.h, '#cfd8e2'); rr(x, y, cd.w, cd.h - 3, '#ffffff');
    const vv = V[vi];
    drawV(vi, x + Math.floor((cd.w - vv.len) / 2), y + Math.min(cd.h - 4, Math.floor((cd.h + vv.h) / 2) + 2), false, 0, 0, true);
  }
  const STAR = ['000010000', '000010000', '000111000', '111111111', '011111110', '001111100', '001101100', '011000110', '010000010'];
  function drawStar(cx, cy, u) {
    const paint = (ox, oy, c) => STAR.forEach((r, j) => [...r].forEach((b, i) => { if (b === '1') R(cx + (i - 4) * u + ox, cy + (j - 4) * u + oy, u, u, c); }));
    paint(0, u, '#c99410'); paint(0, 0, '#ffd21f'); R(cx - u, cy - u, u, u, '#fff6b0');
  }
  // the scene's characters pop up one by one in the strip and cheer
  function drawCast() {
    const cast = sc().cast || [], p = Y.cast;
    if (!cast.length || p.w < 20) return;
    rr(p.x, p.y + 2, p.w, p.h, '#2f6b29'); rr(p.x, p.y, p.w, p.h, '#4a9440'); rr(p.x + 2, p.y + 2, p.w - 4, p.h - 4, '#8fd6ff');
    R(p.x + 2, p.y + p.h - 9, p.w - 4, 6, '#7cc96a'); R(p.x + 2, p.y + p.h - 9, p.w - 4, 1, '#5aa84c');
    const step = Math.min(26, (p.w - 8) / cast.length), x0 = p.x + p.w / 2 - step * (cast.length - 1) / 2;
    cast.forEach((fn, i) => {
      const a = st.pt - 0.3 - i * 0.28;
      if (a < 0) return;
      const h = a < 0.35 ? Math.sin(a / 0.35 * Math.PI) * 8 : Math.abs(Math.sin(T * 6 + i * 1.3)) * 3;
      fn(Math.round(x0 + i * step), p.y + p.h - 5, Math.round(h), i);
    });
  }
  const castPerson = (type, skin) => (x, yb, h, i) => drawPerson({ type, x, yb, dir: 1, pose: 'cheer', skin, hop: h, seed: i });
  const castCat = (x, yb, h) => drawBigCat(x, yb - h, 1);
  const castDuck = big => (x, yb, h) => drawBigDuck(x, yb - h, big, 1);
  const castDog = (col, dark) => (x, yb, h) => drawBigDog(x, yb - h, 1, col, dark);
  SC[0].cast = [castPerson('kid', SKIN[1]), castCat, castPerson('ff')];
  SC[1].cast = [castPerson('kid2', SKIN[0]), castPerson('medic')];
  SC[2].cast = [castPerson('cop'), castDuck(true), castDuck(false), castDuck(false)];
  SC[3].cast = [castPerson('ff'), castDog('#e0b070', '#8a5a2a')];
  SC[4].cast = [castPerson('gran'), castPerson('medic')];
  SC[5].cast = [castPerson('kid3', SKIN[2]), castDog('#f4f7fb', '#8a5a2a'), castPerson('cop')];

  SCENES.help = {
    view: [186, 200],
    groundY: () => Y.hillY,
    layout() {
      const uw = W - L.safeL - L.safeR, gap = 6;
      P = Math.round(L.safeL + uw * 0.58);
      // try one row of cards next to the home button; stack them when the screen is narrow
      const hs = L.blob, leftLim = L.safeL + 8 + hs + 6, m = leftLim - L.safeL;
      let a = leftLim, b = W - L.safeR - m, w = Math.floor((b - a - 2 * gap) / 3);
      if (w < 72) { b = W - L.safeR - 4; w = Math.floor((b - a - 2 * gap) / 3); }
      Y.stack = w < 70;
      if (!Y.stack) {
        w = Math.min(w, 96);
        Y.palH = Math.max(L.palH, 50); Y.palY = H - L.safeB - Y.palH;
        const ch = Y.palH - 9, x0 = Math.round((a + b - (3 * w + 2 * gap)) / 2);
        st.cards = CARD_ORDER.map((vi, k) => ({ vi, x: x0 + k * (w + gap), y: Y.palY + 4, w, h: ch }));
        Y.home = { x: L.safeL + 8, y: Y.palY + Math.floor((Y.palH - hs) / 2), s: hs };
        const big = hs + 10;
        Y.again = { x: Math.floor(L.cx - big / 2), y: Y.palY + Math.floor((Y.palH - big) / 2), s: big };
        Y.hero = st.cards[0];
        const cx0 = Y.again.x + big + 10, room = W - L.safeR - 8 - cx0, cw = Math.min(room, w);
        Y.cast = { x: cx0 + Math.floor((room - cw) / 2), y: Y.palY + 4, w: cw, h: ch };
      } else {
        const ch = Math.max(46, Math.min(60, Math.floor((H - 300) / 2.5))), rg = 6;
        w = Math.min(92, Math.floor((uw - 12 - gap) / 2));
        Y.palH = 8 + ch + rg + ch + 8; Y.palY = H - L.safeB - Y.palH;
        const r1 = Y.palY + 8, r2 = r1 + ch + rg, x0 = Math.round(L.cx - (2 * w + gap) / 2);
        const hb = Math.min(44, ch - 6);
        Y.home = { x: L.safeL + 8, y: r2 + Math.floor((ch - hb) / 2), s: hb };
        const ax = Math.max(Math.round(L.cx - w / 2), Y.home.x + hb + 10);
        st.cards = [
          { vi: VI.police, x: x0, y: r1, w, h: ch },
          { vi: VI.fire, x: x0 + w + gap, y: r1, w, h: ch },
          { vi: VI.amb, x: Math.min(ax, W - L.safeR - 4 - w), y: r2, w, h: ch },
        ];
        const big = ch;   // the next button takes the ambulance card's place
        Y.again = { x: st.cards[2].x + Math.floor((w - big) / 2), y: r2 - 1, s: big };
        Y.hero = st.cards[0];
        Y.cast = { x: st.cards[1].x, y: r1, w, h: ch };
      }
      Y.roadH = 46; Y.roadY = Y.palY - Y.roadH; Y.floorY = Y.roadY; Y.laneY = Y.roadY + Y.roadH - 6;
      Y.hillY = Math.min(Y.floorY - 30, Math.round(H * 0.3) + 30);
      // a street of houses behind the sidewalk when there's room, so the grass isn't empty
      Y.houses = []; Y.trees = []; Y.flowers = [];
      const band = Y.floorY - Y.hillY - 8;
      if (band >= 60) {
        const base = Y.floorY - 22;
        let k = 0;
        for (let x = 4 - (k % 2) * 10; x < W; x += 58) {
          const hw = 38 + (k % 2) * 6;
          Y.houses.push({ x, y: base, w: hw, c: HOUSE_C[k % 4] });
          Y.trees.push({ x: x + hw + 9, y: base });
          k++;
        }
        for (let i = 0; i < Math.round(W * band / 700); i++) {
          const hsh = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
          const fx = Math.floor(hsh(i) * W), fyy = Y.hillY + 12 + Math.floor(hsh(i + 99) * Math.max(1, base - Y.hillY - 52));
          Y.flowers.push({ x: fx, y: fyy, c: ['#ffffff', '#ffd21f', '#ff6fb4'][i % 3] });
        }
      }
      if (scene === 'help') setClouds(L.safeT + 24, Math.max(L.safeT + 60, Y.hillY - 60));
    },
    enter() {
      let i;
      do { i = Math.random() * SC.length | 0; } while (SC.length > 1 && i === lastIdx);
      lastIdx = st.idx = i;
      Object.assign(st, { s: SC[i].init(), state: 'wait', t: 0, veh: null, leavers: [], hint: false, hops: {}, bub: 0 });
      setClouds(L.safeT + 24, Math.max(L.safeT + 60, Y.hillY - 60));
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
        st.state = 'party'; st.t = 0; st.hint = false; st.pt = 0; st.popped = 0;
        SFX.fanfare(); say(pick('praise'), true);
      }
      if (happy()) {
        st.pt += dt;
        const cast = c.cast || [];
        if (st.popped < cast.length && st.pt >= 0.3 + st.popped * 0.28) { SFX.boop(1 + st.popped * 0.2); st.popped++; }
      }
      if (st.state === 'party') {
        confetti();
        if (Y.floorY > 200) spawn(1, () => ({ x: Math.random() * W, y: Y.floorY - 160, vx: rand(-15, 15), vy: rand(30, 60), g: 40, life: 2.5, max: 2.5, s: 2, c: PALETTE[Math.random() * 7 | 0][2][1] }));
        if (st.t >= 1.5) { st.state = 'done'; st.t = 0; }
      }
    },
    drawWorld() {
      drawHeli(); drawHills(Y.hillY, Y.floorY);
      for (const f of Y.flowers) { R(f.x, f.y, 2, 2, f.c); R(f.x, f.y + 2, 1, 1, '#3f9a45'); }
      for (const h of Y.houses) drawHouse(h);
      for (const t of Y.trees) drawDistantTree(t.x, t.y);
      drawRoad(Y.roadY, Y.roadH);
      const c = sc(), s = st.s;
      c.back(s);
      for (const v of st.leavers) drawVeh(v);
      if (st.veh) drawVeh(st.veh);
      c.fore(s);
    },
    drawLit() {
      const c = sc(), s = st.s;
      if (nightK() > 0.05) for (const h of Y.houses) drawHouseLights(h);
      if (c.lit) c.lit(s);
      drawParticles();
      if (st.state === 'wait' || st.state === 'drive' || st.state === 'hmm') {
        const a = c.ask(s), b = st.bub > 0 ? Math.round(Math.sin(st.bub / 0.3 * Math.PI) * 4) : 0;
        bubble(a.x, a.y - Math.round(Math.sin(T * 3) * 1.5) - b, bubU());
      }
      const v = st.veh;
      if (v && v.mode === 'hmm' && v.t > 0.2) bubble(Math.round(v.x + V[v.i].len / 2), Y.laneY - V[v.i].h - 2, 2);
    },
    drawUI() {
      drawMyStrip();
      drawHomeButton(Y.home);
      if (cardsVisible()) {
        const want = sc().veh;
        for (const cd of st.cards) {
          const hint = st.hint && cd.vi === want;
          const by = hint ? -Math.round(Math.abs(Math.sin(T * 5)) * 4) : 0;
          const bx = hint ? Math.round(Math.sin(T * 10) * (Math.sin(T * 2.5) > 0.3 ? 1 : 0)) : 0;
          drawCard(cd, cd.vi, bx, by, hint);
        }
      } else if (st.veh) {
        // the chosen vehicle's card stays up; the right one glows, bounces and wins a star
        const win = st.veh.right && st.state !== 'drive';
        const by = win ? -Math.round(Math.abs(Math.sin(T * 4)) * 3) : 0;
        drawCard(Y.hero, st.veh.i, 0, by, win);
        if (win) drawStar(Y.hero.x + Y.hero.w - 5, Y.hero.y + by + 3 + Math.round(Math.sin(T * 6)), 2);
      }
      if (happy()) drawCast();
      if (st.state === 'done') drawAgainButton(Y.again, '#3fb43a', '#1f7a2a');
    },
    tap(x, y) {
      if (inBox(Y.home, x, y)) { SFX.pop(); goScene('station'); return true; }
      if (st.state === 'done' && inBox(Y.again, x, y, 6)) { SFX.pop(); goScene('help'); return true; }
      if (cardsVisible()) {
        for (const cd of st.cards) if (x >= cd.x - 3 && x < cd.x + cd.w + 3 && y >= cd.y - 6 && y < cd.y + cd.h + 4) { choose(cd.vi); return true; }
      }
      const c = sc();
      if (c.tap(st.s, x, y)) return true;
      if (st.state === 'wait' || st.state === 'drive' || st.state === 'hmm') {
        const a = c.ask(st.s), { w, h } = bubbleSize(bubU());
        if (near(x, y, a.x, a.y - h / 2 - 3, w / 2 + 3, h / 2 + 3)) { st.bub = 0.3; SFX.boop(1.4); return true; }
      }
      return false;
    },
  };
})();
