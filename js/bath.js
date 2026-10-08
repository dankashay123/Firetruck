// "Bath Time": the family's two dogs come back from playing all muddy (or covered in paint,
// berry juice or leaves) and hop into the tub in the backyard. Rub them with a sponge to make
// bubbles and wipe the dirt away, then spray them clean with the hose. They shake water
// everywhere (even onto the screen!), get a crunchy treat, and the other dog comes along.
'use strict';
(() => {
  const { oval, hsh, paint, blit, hand } = TOY;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const eout = k => 1 - (1 - k) ** 3;

  /* ---------- sounds ---------- */
  const SND = TOY.bank({
    bark: ['dog-bark', 0.8], bark2: ['dog-bark-2', 0.7], splash: ['bath-splash', 0.7], splash2: ['bath-splash2', 0.7],
    squeak: ['bath-squeak', 0.55], bubble: ['bath-bubble', 0.45], pop: ['bath-pop', 0.6], water: ['bath-water', 0.6], crunch: ['crunch', 0.8],
  }, {
    bark() { tone('square', 330, 0, 0.09, 0.08, 220); }, bark2() { tone('square', 290, 0, 0.09, 0.08, 200); },
    splash() { noise(0, 0.5, 0.15, 1400, 0.7); }, splash2() { noise(0, 0.7, 0.15, 1100, 0.7); },
    squeak() { tone('sine', 1400, 0, 0.15, 0.08, 1900); }, bubble(r) { tone('sine', 600 * (r || 1), 0, 0.08, 0.06, 1200 * (r || 1)); },
    pop() { tone('sine', 900, 0, 0.06, 0.08, 300); }, crunch() { for (let i = 0; i < 4; i++) noise(i * 0.09, 0.06, 0.1, 2200, 1.5); },
  }, 'bath-music', 0.2);
  const water = SND.loop('water');

  /* ---------- the mess ---------- */
  // where the dirt can sit on a dog (its own frame, facing right, feet at 0)
  const SPOTS = [[-8, -20, 6], [1, -19, 6], [9, -18, 5], [-14, -16, 4], [4, -13, 4], [-3, -24, 4], [11, -25, 4], [-17, -22, 4], [9, -9, 3], [-9, -9, 3], [13, -30, 4], [17, -34, 3], [-12, -12, 3]];
  const MESS = [
    { name: 'mud', cols: ['#7a4a24', '#6a3a1a', '#8a5a2e'] },
    { name: 'paint', cols: ['#e8222b', '#2a6fe0', '#ffd21f', '#3fb43a', '#ff6fb4', '#8a4fd9'] },
    { name: 'leaves', cols: ['#6a3a1a', '#7a4a24'], leaves: true },
    { name: 'berries', cols: ['#7a2a8a', '#9a3aa8', '#5a1a6a'] },
  ];

  /* ---------- layout ---------- */
  const Y = {};
  function layout() {
    const room = H - L.safeT - L.safeB;
    Y.yG = H - L.safeB - Math.max(18, Math.min(70, Math.round(room * 0.2)));
    Y.tx = Math.round(L.cx);
    Y.reel = Math.min(W - L.safeR - 12, Y.tx + 56);
    Y.house = Math.max(L.safeL + 14, Y.tx - 80);
    Y.home = { x: L.safeL + 4, y: H - L.safeB - L.blob - 4, s: L.blob };
    Y.nozzle = [Y.reel - 6, Y.yG - 30];
  }

  /* ---------- state ---------- */
  const st = { stage: 'arrive', who: 'vizsla', visit: 0, x: -40, hop: 0, t: 0, spots: [], foam: [], mess: 0, total: 1,
    hold: null, fx: 0, fy: 0, spray: 0, scrubT: 0, shake: 0, idle: 0, prints: [], drops: [], floaters: [], duck: { hop: 0 }, treat: null, hearts: [], bark: 0, done: 0 };
  const spr = () => SCENES.movieDogs && SCENES.movieDogs._spr;
  function newDog() {
    st.who = st.visit % 2 ? 'husky' : 'vizsla';
    st.mess = st.visit % MESS.length;
    st.visit++;
    const m = MESS[st.mess], pick = SPOTS.filter((s, i) => hsh(st.visit * 7 + i) < 0.85 || i < 4);
    st.spots = pick.map((s, i) => ({ x: s[0] + Math.round(hsh(st.visit + i) * 2 - 1), y: s[1] + Math.round(hsh(st.visit * 3 + i) * 2 - 1), r: s[2], a: 1, c: m.cols[i % m.cols.length], leaf: m.leaves && i % 3 === 0 }));
    st.total = st.spots.length;
    st.foam = []; st.stage = 'arrive'; st.x = -40; st.t = 0; st.hop = 0; st.treat = null; st.shake = 0; st.idle = 0;
  }
  const dirt = () => st.spots.reduce((a, s) => a + s.a, 0) / st.total;
  const inTub = () => ['scrub', 'rinse', 'shake', 'treat'].includes(st.stage) || (st.stage === 'jumpin' && st.t > 0.5) || (st.stage === 'jumpout' && st.t < 0.35);
  const dogYB = () => inTub() ? Y.yG - 3 : Y.yG + 6;

  /* ---------- the dog, its mess and its bubbles ---------- */
  function dogPose() {
    const s = st.stage, o = { wag: s === 'scrub' || s === 'treat' || s === 'rinse', hop: st.hop };
    if (s === 'arrive' || s === 'leave') o.run = true;
    if (st.bark > 0) o.bark = true;
    if (st.who === 'husky') o.pant = !o.bark;
    if (s === 'treat' && st.treat && st.treat.k >= 1) o.pose = 'chew';
    else if (s === 'scrub' && st.who === 'vizsla' && Math.floor(T * 0.5) % 3 === 0) o.pose = 'tilt';
    return o;
  }
  function drawDog() {
    const S_ = spr();
    if (!S_) return;
    const dir = st.stage === 'leave' || st.stage === 'jumpout' ? 1 : 1, o = dogPose();
    const cv = paint('bathDog', 76, 64, 38, 58, () => {
      S_[st.who](0, 0, 1, 1, Object.assign({}, o, { hop: 0 }));
      // the mess, only where there is fur
      g.globalCompositeOperation = 'source-atop';
      for (const s of st.spots) {
        if (s.a <= 0.02) continue;
        const r = Math.max(1, Math.round(s.r * Math.sqrt(s.a)));
        circle(s.x, s.y, r, s.c);
        if (st.mess === 0 || st.mess === 2) { R(s.x - 1, s.y - 1, 1, 1, '#4e2c12'); R(s.x + 1, s.y + 1, 1, 1, '#9a6a3e'); }
        if (st.mess === 1) R(s.x - 1, s.y - 1, 1, 1, '#ffffff');
      }
      if (st.stage === 'rinse' || st.stage === 'shake') { g.globalAlpha = 0.25; R(-30, -50, 60, 50, '#7ad0ff'); g.globalAlpha = 1; }   // wet fur looks darker
      g.globalCompositeOperation = 'source-over';
      for (const s of st.spots) if (s.leaf && s.a > 0.3) { R(s.x - 2, s.y - 1, 4, 2, '#4a9a3a'); R(s.x - 1, s.y - 2, 2, 4, '#3a8a2e'); R(s.x + 2, s.y, 1, 1, '#6a3a1a'); }
    });
    const shake = st.stage === 'shake' ? Math.round(Math.sin(T * 60) * 2) : 0;
    blit(cv, Math.round(st.x) + shake, dogYB() - Math.round(st.hop), dir, 1);
  }
  function drawFoam() {
    const x0 = Math.round(st.x), y0 = dogYB() - Math.round(st.hop);
    for (const f of st.foam) {
      const r = Math.max(1, Math.round(f.r * f.a));
      circle(x0 + f.x, y0 + f.y, r, '#f4fbff');
      if (r > 1) { R(x0 + f.x - r + 1, y0 + f.y - r + 1, 1, 1, '#ffffff'); R(x0 + f.x + r - 1, y0 + f.y, 1, 1, '#cfe8f8'); }
    }
  }

  /* ---------- the backyard ---------- */
  function yard() {
    const yG = Y.yG, fy = yG - 30;
    // the fence
    R(0, fy - 18, W, 18, '#d8a86a');
    for (let x = 0; x < W; x += 9) { R(x, fy - 20, 8, 20, '#e6b878'); R(x, fy - 20, 8, 1, '#f2cc94'); R(x + 3, fy - 22, 2, 2, '#e6b878'); R(x + 8, fy - 20, 1, 20, '#b8884a'); }
    R(0, fy - 14, W, 2, '#b8884a'); R(0, fy - 6, W, 2, '#b8884a');
    // grass
    R(0, fy, W, H - fy, '#6cbf5a');
    for (let i = 0; i < W * (H - fy) / 60; i++) { const x = Math.round(hsh(i) * W), y = fy + 2 + Math.round(hsh(i * 2.3) * (H - fy - 3)); R(x, y, 1, 2, i % 3 ? '#5aa84c' : '#8fd877'); }
    for (let i = 0; i < 14; i++) { const x = Math.round(hsh(i * 9.1) * W), y = fy + 4 + Math.round(hsh(i * 4.7) * (H - fy - 8)); R(x - 1, y, 3, 1, ['#ffd21f', '#ff6fb4', '#ffffff'][i % 3]); R(x, y - 1, 1, 3, ['#ffd21f', '#ff6fb4', '#ffffff'][i % 3]); R(x, y, 1, 1, '#f57a12'); }
    // the family's house behind the fence, when there's room for it
    const hasHouse = fy - 20 - L.safeT > 110;
    if (hasHouse) house(fy - 20);
    // a clothesline with colourful towels
    if (!hasHouse) {
    const c0 = Math.max(4, Y.tx - 70), c1 = Math.min(W - 4, Y.tx + 70);
    R(c0, fy - 46, 2, 46, '#8a6a4a'); R(c1, fy - 46, 2, 46, '#8a6a4a');
    for (let x = c0; x < c1; x++) R(x, fy - 44 + Math.round(Math.sin((x - c0) / (c1 - c0) * Math.PI) * 4), 1, 1, '#ffffff');
    [['#ff6fb4', 0.2], ['#7ad0ff', 0.45], ['#ffd21f', 0.7]].forEach(([c, k], i) => {
      const x = Math.round(lerp(c0, c1, k)), y = fy - 44 + Math.round(Math.sin(k * Math.PI) * 4), sw = Math.round(Math.sin(T * 1.5 + i));
      R(x - 6 + sw, y + 1, 12, 14, c); R(x - 6 + sw, y + 11, 12, 1, '#ffffff'); R(x - 6 + sw, y + 13, 12, 1, '#ffffff');
    });
    }
    // the doghouse
    const hx = Y.house, hb = fy + 6;
    R(hx - 12, hb - 18, 24, 18, '#e8222b'); R(hx - 12, hb - 18, 24, 1, '#ff5a5a');
    for (let k = 0; k < 9; k++) R(hx - 14 + k, hb - 19 - k, 28 - 2 * k, 1, '#2a6fe0');
    oval(hx, hb - 6, 5, 6, '#3a1a1a'); R(hx - 5, hb - 6, 11, 6, '#3a1a1a');
    R(hx - 4, hb - 25, 8, 3, '#ffffff'); R(hx - 3, hb - 24, 6, 1, '#e8a040');
    PETS.draw('bath', { y: hb - 26, x0: hx, x1: hx + 1, who: ['cat'], spots: { cat: { x: hx, pose: Math.floor(T / 14) % 3 === 2 ? 'sleep' : 'sit' } } });
    // a mud puddle where the dogs have been playing
    oval(Math.max(14, Y.tx - 58), yG + 8, 14, 3, '#6a3a1a'); oval(Math.max(14, Y.tx - 58), yG + 7, 11, 2, '#8a5a2e');
    for (const p of st.prints) alpha(clamp01(p.life), () => { R(p.x, p.y, 2, 2, '#7a4a24'); R(p.x - 1, p.y - 2, 1, 1, '#7a4a24'); R(p.x + 2, p.y - 2, 1, 1, '#7a4a24'); });
  }
  function house(base) {
    const top = Math.max(L.safeT + 74, base - 76), x0 = Math.round(Y.tx - 52), x1 = Math.round(Y.tx + 52);
    R(x0, top, x1 - x0, base - top, '#f2e2c4'); for (let y = top + 4; y < base; y += 5) R(x0, y, x1 - x0, 1, '#e6d2ae');
    for (let k = 0; k < 16; k++) R(x0 - 6 + k * 3, top - 1 - k, x1 - x0 + 12 - k * 6, 1, k % 3 ? '#c8432f' : '#a83a2a');   // roof
    R(x1 - 26, top - 22, 8, 12, '#a8743f'); R(x1 - 27, top - 23, 10, 2, '#8a5a32');
    const win = (wx, wy, who) => {
      R(wx - 1, wy - 1, 22, 18, '#ffffff'); R(wx, wy, 20, 16, '#bfe6ff');
      if (who) { g.save(); g.beginPath(); g.rect(wx, wy, 20, 16); g.clip(); drawPerson({ type: who, x: wx + 10, yb: wy + 19, dir: 1, pose: Math.floor(T * 0.6) % 3 ? 'wave' : 'stand', skin: SKIN[who === 'mom' ? 1 : 0], seed: 1 }); g.restore(); }
      else { R(wx + 9, wy, 2, 16, '#ffffff'); R(wx, wy + 7, 20, 2, '#ffffff'); }
      R(wx - 3, wy - 2, 4, 20, '#ff8fb8'); R(wx + 19, wy - 2, 4, 20, '#ff8fb8'); R(wx - 2, wy + 17, 24, 2, '#e8d0b0');
    };
    win(x0 + 12, top + 12, 'mom'); win(x1 - 32, top + 12, null);
    if (base - top > 50) { win(x0 + 12, top + 40, null); win(x1 - 32, top + 40, 'kid2'); }
  }
  const TUB_W = 34;
  function tubBack() {
    const x = Y.tx, y = Y.yG;
    oval(x, y + 1, TUB_W + 4, 4, 'rgba(0,0,0,0.15)');
    oval(x, y - 18, TUB_W, 5, '#8ab4d8');                  // the rim, far side
    oval(x, y - 17, TUB_W - 2, 4, '#5aa8e8');              // the water
    oval(x - 6, y - 18, 12, 1, '#a8dcff');
  }
  function tubFront() {
    const x = Y.tx, y = Y.yG;
    TOY.poly([[x - TUB_W, y - 18], [x + TUB_W, y - 18], [x + TUB_W - 3, y - 2], [x - TUB_W + 3, y - 2]], '#4a90d0');
    oval(x, y - 2, TUB_W - 3, 3, '#4a90d0');
    TOY.poly([[x - TUB_W, y - 18], [x - TUB_W + 6, y - 18], [x - TUB_W + 8, y - 3], [x - TUB_W + 4, y - 3]], '#7ab8ec');
    TOY.poly([[x + TUB_W - 6, y - 18], [x + TUB_W, y - 18], [x + TUB_W - 4, y - 3], [x + TUB_W - 8, y - 3]], '#3a7ab8');
    oval(x, y - 18, TUB_W, 2, '#a8d4f4'); R(x - TUB_W, y - 18, TUB_W * 2 + 1, 1, '#d8eefc');
    for (const k of [-0.5, 0, 0.5]) R(x + Math.round(k * TUB_W * 1.4) - 1, y - 12, 3, 3, '#ffffff');   // polka dots
    // feet
    R(x - TUB_W + 6, y - 2, 6, 3, '#3a7ab8'); R(x + TUB_W - 12, y - 2, 6, 3, '#3a7ab8');
  }
  function duck() {
    const x = Y.tx - TUB_W + 10, y = Y.yG - 17 - Math.round(Math.abs(Math.sin(T * 2)) + st.duck.hop);
    R(x - 4, y - 3, 9, 4, '#ffd21f'); R(x - 5, y - 2, 1, 2, '#ffd21f'); R(x + 1, y - 7, 5, 5, '#ffd21f'); R(x + 6, y - 5, 3, 2, '#f57a12');
    R(x + 3, y - 6, 1, 1, INK); R(x - 2, y - 2, 4, 1, '#f2b51c');
  }
  function reel() {
    const x = Y.reel, y = Y.yG;
    R(x - 1, y - 24, 3, 24, '#3a7a2e'); circle(x, y - 14, 8, '#3fb43a'); circle(x, y - 14, 5, '#2f9a2c'); circle(x, y - 14, 2, '#8fd877');
    for (let k = 0; k < 3; k++) R(x - 6 + k, y - 18 + k * 4, 12 - 2 * k, 1, '#5ad04a');
    R(x - 6, y - 1, 13, 2, '#3a7a2e');
    if (st.stage !== 'rinse') { R(x + 6, y - 14, 2, 8, '#3fb43a'); R(x + 5, y - 7, 4, 4, '#e8222b'); R(x + 6, y - 4, 2, 2, '#9aa3ad'); }
  }
  function nozzleAim() { return st.hold != null ? [st.fx, st.fy] : [st.x + 4, dogYB() - 20]; }
  function hose() {   // during the rinse: the hose reaches up, its nozzle points at the finger
    if (st.stage !== 'rinse') return;
    const [nx, ny] = Y.nozzle, [ax, ay] = nozzleAim();
    for (let k = 0; k <= 12; k++) { const t = k / 12, x = lerp(Y.reel + 4, nx, t), y = lerp(Y.yG - 14, ny, t) + Math.sin(t * Math.PI) * 6; R(Math.round(x) - 1, Math.round(y) - 1, 3, 3, '#3fb43a'); }
    const a = Math.atan2(ay - ny, ax - nx), c = Math.cos(a), s = Math.sin(a);
    TOY.bar(nx, ny, nx + c * 7, ny + s * 7, 4, '#e8222b'); TOY.bar(nx + c * 6, ny + s * 6, nx + c * 9, ny + s * 9, 3, '#9aa3ad');
    if (st.spray > 0) {   // the water arcs out to the aim point
      const sx = nx + c * 9, sy = ny + s * 9, dx = ax - sx, dy = ay - sy;
      for (let k = 0; k < 26; k++) {
        const t = ((k / 26) + T * 2.2) % 1, x = sx + dx * t, y = sy + dy * t - Math.sin(t * Math.PI) * 6;
        R(Math.round(x), Math.round(y), 2, 2, k % 3 ? '#8ed4ff' : '#ffffff');
      }
      for (let k = 0; k < 4; k++) R(Math.round(ax + Math.sin(T * 30 + k * 2) * 4), Math.round(ay + Math.cos(T * 23 + k) * 3), 1, 1, '#ffffff');
    }
  }
  function sponge(x, y) {
    x = Math.round(x); y = Math.round(y);
    R(x - 6, y - 4, 12, 8, '#ffd21f'); R(x - 6, y - 4, 12, 1, '#fff27a'); R(x - 6, y + 2, 12, 2, '#e0a810');
    R(x - 3, y - 2, 1, 1, '#e0a810'); R(x + 2, y - 1, 1, 1, '#e0a810'); R(x - 1, y + 1, 1, 1, '#e0a810');
  }
  function bone(x, y, rot) {
    x = Math.round(x); y = Math.round(y);
    const c = '#e8b878', d = '#c8945a';
    if (Math.abs(Math.sin(rot)) > 0.7) { R(x - 1, y - 4, 3, 9, c); circle(x - 1, y - 5, 2, c); circle(x + 2, y - 5, 2, c); circle(x - 1, y + 5, 2, c); circle(x + 2, y + 5, 2, c); }
    else { R(x - 4, y - 1, 9, 3, c); circle(x - 5, y - 1, 2, c); circle(x - 5, y + 2, 2, c); circle(x + 5, y - 1, 2, c); circle(x + 5, y + 2, 2, c); R(x - 3, y + 1, 7, 1, d); }
  }

  /* ---------- play ---------- */
  function toLocal(x, y) { return [x - Math.round(st.x), y - (dogYB() - Math.round(st.hop))]; }
  function onDog(x, y) { const [lx, ly] = toLocal(x, y); return lx > -24 && lx < 28 && ly > -44 && ly < 2; }
  function scrubAt(x, y, amt) {
    const [lx, ly] = toLocal(x, y);
    let hit = false;
    for (const s of st.spots) if (s.a > 0 && (lx - s.x) ** 2 + (ly - s.y) ** 2 < (s.r + 5) ** 2) { s.a = Math.max(0, s.a - amt); hit = true; }
    if (st.foam.length < 90 && Math.random() < 0.9) st.foam.push({ x: Math.round(lx + rand(-3, 3)), y: Math.round(Math.min(-12, ly + rand(-3, 3))), r: 2 + Math.floor(Math.random() * 3), a: 1 });
    if (Math.random() < 0.25 && st.floaters.length < 14) st.floaters.push({ x: x + rand(-4, 4), y: y - 4, vx: rand(-6, 6), r: 2 + Math.floor(Math.random() * 3), life: 4 });
    if (st.scrubT <= 0) { SND.play('bubble', 0.8 + Math.random() * 0.6); noise(0, 0.07, 0.04, 2600, 2); st.scrubT = 0.14; }
    st.idle = 0;
    return hit;
  }
  function bark() { st.bark = 0.35; SND.play(st.who === 'husky' ? 'bark2' : 'bark'); }
  function update(dt) {
    st.t += dt; st.idle += dt;
    st.scrubT = Math.max(0, st.scrubT - dt); st.bark = Math.max(0, st.bark - dt);
    st.duck.hop = Math.max(0, st.duck.hop - dt * 20);
    const s = st.stage;
    if (s === 'arrive') {   // trotting in through the mud, leaving paw prints
      st.x += 46 * dt;
      if (Math.floor(st.t * 6) !== Math.floor((st.t - dt) * 6)) st.prints.push({ x: Math.round(st.x - 4), y: Y.yG + 5 + (st.prints.length % 2) * 2, life: 6 });
      const edge = Y.tx - TUB_W - 14;
      if (st.x >= edge) { st.x = edge; st.stage = 'jumpin'; st.t = 0; st.jx = edge; bark(); }
    } else if (s === 'jumpin') {
      const k = clamp01(st.t / 0.65);
      st.x = lerp(st.jx, Y.tx, k); st.hop = Math.sin(k * Math.PI) * 22 + (k < 0.5 ? (Y.yG + 6 - (Y.yG - 3)) * 0 : 0);
      if (k >= 1) {
        st.hop = 0; st.stage = 'scrub'; st.t = 0; SND.play('splash');
        spawn(16, () => ({ x: Y.tx + rand(-20, 20), y: Y.yG - 18, vx: rand(-40, 40), vy: rand(-80, -30), g: 200, life: 0.8, max: 0.8, s: 2, c: '#8ed4ff' }));
      }
    } else if (s === 'scrub') {
      if (dirt() < 0.12) {
        for (const p of st.spots) p.a = 0;
        st.stage = 'rinse'; st.t = 0; st.hold = null; SFX.chime(); bark();
        sparkle(st.x, dogYB() - 22, 20, 10, '#ffffff');
      }
    } else if (s === 'rinse') {
      if (st.hold != null) st.spray = 0.6;
      if (st.spray > 0) {
        st.spray = Math.max(0, st.spray - dt);
        const [ax, ay] = nozzleAim(), [lx, ly] = toLocal(ax, ay);
        for (const f of st.foam) {   // the spray washes the bubbles off, and a little of everything nearby
          const d = Math.hypot(f.x - lx, f.y - ly);
          f.a -= dt * (d < 12 ? 2.2 : onDog(ax, ay) ? 0.5 : 0.25);
        }
        st.foam = st.foam.filter(f => f.a > 0.15);
        if (Math.random() < dt * 30) spawn(1, () => ({ x: ax, y: ay, vx: rand(-30, 30), vy: rand(-50, -10), g: 220, life: 0.5, max: 0.5, s: 1, c: '#bfe6ff' }));
      }
      water(st.spray > 0 ? 1 : 0, 1);
      if (st.foam.length <= 2 && st.t > 0.6) { st.foam = []; st.stage = 'shake'; st.t = 0; water(0); st.hold = null; st.spray = 0; }
    } else if (s === 'shake') {
      if (st.t < 1.4 && Math.random() < dt * 60) spawn(2, () => { const a = rand(-Math.PI, 0.2); return { x: st.x + rand(-12, 12), y: dogYB() - 20 + rand(-6, 6), vx: Math.cos(a) * rand(50, 110), vy: Math.sin(a) * rand(50, 110), g: 200, life: 0.9, max: 0.9, s: 2, c: Math.random() < 0.3 ? '#ffffff' : '#8ed4ff' }; });
      if (st.t > 0.05 && !st.shook) { st.shook = true; SND.play('splash2'); setTimeout(() => SND.play('splash', 1.2), 450); for (let i = 0; i < 9; i++) st.drops.push({ x: rand(L.safeL + 10, W - L.safeR - 10), y: rand(L.safeT + 10, H * 0.7), r: 3 + Math.floor(Math.random() * 4), life: 2.6 + Math.random(), delay: Math.random() * 0.6 }); }
      if (st.t > 1.6) { st.stage = 'treat'; st.t = 0; st.shook = false; bark(); st.treat = { k: 0, x0: W - L.safeR + 8, y0: L.safeT + 20 }; }
    } else if (s === 'treat') {
      const tr = st.treat;
      if (tr.k < 1) {
        tr.k = Math.min(1, tr.k + dt / 0.8);
        if (tr.k >= 1) { st.hop = 0; SND.play('crunch'); for (let i = 0; i < 4; i++) st.hearts.push({ x: st.x + rand(-8, 12), y: dogYB() - 40, vy: -rand(10, 18), life: 1.6 }); }
      } else if (st.t > 2.4) { st.stage = 'jumpout'; st.t = 0; st.jx = st.x; st.done++; SFX.fanfare(); confetti(24); }
      else if (Math.random() < dt * 4) sparkle(st.x + rand(-14, 16), dogYB() - rand(14, 34), 2, 1, '#ffffff');
    } else if (s === 'jumpout') {
      const k = clamp01(st.t / 0.6);
      st.x = lerp(st.jx, Y.tx + TUB_W + 16, k); st.hop = Math.sin(k * Math.PI) * 20;
      if (k >= 1) { st.hop = 0; st.stage = 'leave'; st.t = 0; }
    } else if (s === 'leave') {
      st.x += 60 * dt;
      if (st.x > W + 50) newDog();
    }
    for (const p of st.prints) p.life -= dt;
    st.prints = st.prints.filter(p => p.life > 0);
    for (const d of st.drops) { if (d.delay > 0) { d.delay -= dt; continue; } d.life -= dt; d.y += 6 * dt; }
    st.drops = st.drops.filter(d => d.life > 0);
    for (const f of st.floaters) { f.life -= dt; f.y -= 14 * dt; f.x += Math.sin(T * 2 + f.r) * 6 * dt + f.vx * dt; }
    st.floaters = st.floaters.filter(f => f.life > 0 && f.y > -10);
    for (const h of st.hearts) { h.life -= dt; h.y += h.vy * dt; }
    st.hearts = st.hearts.filter(h => h.life > 0);
  }
  function heart(x, y) { x = Math.round(x); y = Math.round(y); R(x - 2, y, 2, 2, '#e8222b'); R(x + 1, y, 2, 2, '#e8222b'); R(x - 2, y + 1, 5, 2, '#e8222b'); R(x - 1, y + 3, 3, 1, '#e8222b'); R(x, y + 4, 1, 1, '#e8222b'); }

  SCENES.bath = {
    view: (w, h) => h > w * 1.2 ? [112, 150] : [150, 110],
    freeTouch: true,
    layout,
    groundY: () => Y.yG - 50,
    enter() { layout(); st.visit = 0; st.prints = []; st.drops = []; st.floaters = []; st.hearts = []; st.hold = null; newDog(); SND.load(); SND.music(true); },
    leave() { SND.music(false); water(0); st.hold = null; },
    update,
    drawWorld() {
      yard();
      reel();
      tubBack();
      if (!inTub()) { tubFront(); duck(); }
      drawDog();
      drawFoam();
      if (inTub()) { tubFront(); duck(); }
      hose();
      // the treat flying in
      const tr = st.treat;
      if (tr && tr.k < 1) { const k = eout(tr.k), x = lerp(tr.x0, st.x + 20, k), y = lerp(tr.y0, dogYB() - 32, k) - Math.sin(k * Math.PI) * 20; bone(x, y, T * 12); }
    },
    drawLit() {
      for (const f of st.floaters) { const x = Math.round(f.x), y = Math.round(f.y); alpha(0.7, () => { circle(x, y, f.r, '#e6f6ff'); circle(x, y, Math.max(0, f.r - 1), '#bfe6ff'); }); R(x - 1, y - f.r + 1, 1, 1, '#ffffff'); }
      for (const h of st.hearts) alpha(Math.min(1, h.life), () => heart(h.x, h.y));
      drawParticles();
    },
    drawUI() {
      // drops of water on the screen after the big shake
      for (const d of st.drops) if (d.delay <= 0) alpha(Math.min(1, d.life) * 0.55, () => { circle(d.x, d.y, d.r, '#bfe6ff'); circle(d.x - 1, d.y - 1, Math.max(1, d.r - 2), '#e6f6ff'); R(d.x - Math.round(d.r / 2), d.y - Math.round(d.r / 2), 1, 1, '#ffffff'); });
      if (st.stage === 'scrub' && st.hold != null) sponge(st.fx, st.fy);
      if (st.stage === 'scrub' && st.hold == null && st.idle > 2.5) {   // show how: rub the dog
        const z = Math.max(1, Math.round(Math.min(W, H) / 110)), k = Math.sin(T * 5);
        hand(st.x + k * 10, dogYB() - 20, z, 0);
      }
      if (st.stage === 'rinse' && st.hold == null && st.spray <= 0 && st.t > 1) { const z = Math.max(1, Math.round(Math.min(W, H) / 110)); hand(st.x + 2, dogYB() - 22, z, Math.floor(T * 2) % 2); }
      drawHomeButton(Y.home);
    },
    tap(x, y, id) {
      if (inBox(Y.home, x, y)) { goScene('station'); return true; }
      st.idle = 0;
      if (PETS.tap('bath', x, y)) return true;
      // pop a floating bubble
      for (const f of st.floaters) if ((x - f.x) ** 2 + (y - f.y) ** 2 < (f.r + 4) ** 2) { f.life = 0; SND.play('pop', 0.9 + Math.random() * 0.4); sparkle(f.x, f.y, 3, 3, '#ffffff'); return true; }
      // squeak the rubber duck
      const dx = Y.tx - TUB_W + 12, dy = Y.yG - 20;
      if (Math.abs(x - dx) < 8 && Math.abs(y - dy) < 8) { st.duck.hop = 7; SND.play('squeak'); return true; }
      if (st.stage === 'scrub') { st.hold = id; st.fx = x; st.fy = y; if (onDog(x, y)) scrubAt(x, y, 0.35); else if (Math.random() < 0.5) bark(); return true; }
      if (st.stage === 'rinse') { st.hold = id; st.fx = x; st.fy = y; st.spray = 0.6; return true; }
      if (onDog(x, y)) bark();
      return true;
    },
    move(x, y, id) {
      if (st.hold !== id) return;
      const d = Math.hypot(x - st.fx, y - st.fy);
      st.fx = x; st.fy = y;
      if (st.stage === 'scrub' && onDog(x, y) && d > 0.3) scrubAt(x, y, Math.min(0.3, d * 0.035));
      if (st.stage === 'rinse') st.spray = 0.6;
    },
    release(id) { if (st.hold === id) st.hold = null; },
    _st: st,
  };
})();
