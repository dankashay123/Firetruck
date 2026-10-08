// "Choo Choo Train": drive a steam train through the countryside. Hold the big green lever to go.
// The train stops at little stations by itself: friends (the crew, kids, gran, the family's dogs
// and cat) hop off and climb aboard and wave from the windows. Along the way: a railroad crossing
// where the fire truck, police car and ambulance wait for the train, a farm full of animals, a
// stone bridge over a river with ducks and boats, a forest, a long tunnel through a snowy
// mountain and a little town. Toot the whistle, ring the bell, and tap the paint pot for a new color.
'use strict';
(() => {
  const { hsh, bar, poly } = TOY;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DK = '#2f3240', IRON = '#1d1a2b', STEEL = '#9aa3ad';

  /* ---------- sounds ---------- */
  const SND = TOY.bank({
    whistle: ['train-whistle', 0.7], whistle2: ['train-whistle2', 0.6], hiss: ['train-hiss', 0.4], chug: ['train-chug', 0.35],
    bell: ['ic-bell', 0.5], moo: ['bt-moo', 0.7], baa: ['bt-baa', 0.7], oink: ['bt-oink', 0.7], maa: ['bt-maa', 0.7], peep: ['bt-peep', 0.6],
    neigh: ['bt-neigh', 0.6], bark: ['dog-bark', 0.7], bark2: ['dog-bark-2', 0.6], meow: ['cat-meow', 0.7], honk: ['bt-honk', 0.6], chime: ['mv-chime', 0.5], pop: ['ic-pop', 0.5],
  }, {
    whistle() { tone('sine', 880, 0, 0.5, 0.08, 860); tone('sine', 1100, 0, 0.5, 0.06, 1080); tone('sine', 880, 0.6, 0.7, 0.08, 840); tone('sine', 1100, 0.6, 0.7, 0.06, 1060); },
    whistle2() { tone('sine', 700, 0, 1.0, 0.08, 680); tone('sine', 880, 0, 1.0, 0.06, 860); },
    hiss() { noise(0, 0.6, 0.08, 4000, 0.5); },
    bell() { tone('triangle', 1300, 0, 0.4, 0.08); tone('triangle', 1300, 0.3, 0.4, 0.08); },
    moo() { tone('sawtooth', 140, 0, 0.7, 0.06, 110); }, baa() { tone('sawtooth', 420, 0, 0.5, 0.05, 380); }, oink() { tone('square', 300, 0, 0.15, 0.05, 200); tone('square', 320, 0.18, 0.15, 0.05, 210); },
    maa() { tone('sawtooth', 500, 0, 0.5, 0.05, 460); }, peep() { tone('sine', 2400, 0, 0.08, 0.05, 2800); tone('sine', 2400, 0.12, 0.08, 0.05, 2800); }, neigh() { tone('sawtooth', 700, 0, 0.6, 0.05, 400); },
    bark() { tone('square', 330, 0, 0.09, 0.08, 220); }, bark2() { tone('square', 290, 0, 0.09, 0.08, 200); }, meow() { tone('sine', 700, 0, 0.4, 0.06, 500); },
    honk() { tone('square', 330, 0, 0.3, 0.06); tone('square', 415, 0, 0.3, 0.05); }, chime() { SFX.chime(); }, pop() { tone('sine', 900, 0, 0.06, 0.08, 300); },
  }, 'train-music', 0.16);
  const chugLoop = SND.loop('chug');
  const chuff = k => noise(0, 0.1 + 0.05 * (1 - k), 0.05 + 0.05 * k, 650, 0.8);
  const crossDing = hi => tone('triangle', hi ? 1250 : 1050, 0, 0.16, 0.035);
  const siren = () => { for (let i = 0; i < 3; i++) { tone('square', 700, i * 0.4, 0.2, 0.03, 950); tone('square', 950, i * 0.4 + 0.2, 0.2, 0.03, 700); } };

  /* ---------- the train ---------- */
  const COLORS = [
    { main: '#e8222b', dark: '#a3121d', light: '#ff6b5e', trim: '#ffd21f' },
    { main: '#2a6fe0', dark: '#1a3f9a', light: '#6aa2ff', trim: '#ffd21f' },
    { main: '#3fb43a', dark: '#1f7a2a', light: '#8fe36b', trim: '#ffd21f' },
    { main: '#ffd21f', dark: '#c99410', light: '#fff3a6', trim: '#e8222b' },
    { main: '#8a4fd9', dark: '#55289a', light: '#b98aff', trim: '#ffd21f' },
    { main: '#ff6fb4', dark: '#c8407e', light: '#ffb0d6', trim: '#ffffff' },
  ];
  const CARS = [{ k: 'engine', w: 52 }, { k: 'tender', w: 24 }, { k: 'coach', w: 44 }, { k: 'coach', w: 44 }, { k: 'caboose', w: 32 }];
  const GAP = 3, LEN = CARS.reduce((s, c) => s + c.w, 0) + GAP * (CARS.length - 1);
  const SEATS = 6;
  const VMAX = 62, ACC = 26, BRAKE = 34;
  function carLeft(i) { let x = st.x; for (let j = 0; j <= i; j++) x -= CARS[j].w + (j ? GAP : 0); return x; }
  const seatX = i => carLeft(2 + Math.floor(i / 3)) + 5 + (i % 3) * 13 + 5;   // window center (world)

  /* ---------- the world: a strip of places along the line ---------- */
  const PLAN = ['station', 'meadow', 'crossing', 'farm', 'bridge', 'station', 'forest', 'tunnel', 'crossing', 'town', 'station', 'meadow', 'bridge', 'farm', 'crossing', 'station', 'town', 'tunnel', 'forest', 'crossing'];
  const WIDTH = { station: 250, meadow: 180, crossing: 110, farm: 230, bridge: 210, forest: 190, tunnel: 280, town: 240 };
  const VEHICLES = ['fire', 'police', 'amb', 'ice', 'car', 'fire', 'amb', 'police'];
  const RIDERS = ['ff', 'kid', 'gran', 'vizsla', 'cop', 'kid2', 'mom', 'cat', 'medic', 'kid3', 'dad', 'husky', 'chef', 'kid', 'ff', 'gran'];
  const PETSET = new Set(['vizsla', 'husky', 'cat']);

  const st = {
    x: 0, v: 0, cam: 0, look: 0, wheelA: 0, chuffA: 0, hold: new Set(), idle: 0, mode: 'board', boardT: 0, ci: 0,
    seats: new Array(SEATS).fill(null), segs: [], planI: 0, nextX: 0, segN: 0, riderI: 0, smoke: [], words: [], walkers: [],
    cars: [], whistleT: 0, bellT: 0, bellSwing: 0, paintT: 0, hits: [], stopSeg: null, steps: [], hiss: 0,
  };

  function newRider() {
    const type = RIDERS[st.riderI++ % RIDERS.length];
    return { type, skin: SKIN[Math.floor(Math.random() * 4)], seed: Math.random() * 9, hop: 0, wave: 0, stops: 1 + (Math.random() < 0.5 ? 1 : 0) };
  }
  function addSeg() {
    const kind = PLAN[st.planI++ % PLAN.length], w = WIDTH[kind], x = st.nextX, n = st.segN++;
    const s = { kind, x, w, n, theme: n % 3 };
    if (kind === 'station') {
      s.stopX = x + w - 22; s.served = false;
      const k = n === 0 ? 3 : 2 + (Math.random() < 0.5 ? 1 : 0);
      s.wait = []; for (let i = 0; i < k; i++) s.wait.push({ p: newRider(), x: x + 40 + i * 30 + Math.random() * 10, state: 'wait', seat: -1 });
    }
    if (kind === 'crossing') { s.cx = x + w / 2; s.veh = VEHICLES[n % VEHICLES.length]; s.gate = 0; s.dingT = 0; s.go = 0; }
    if (kind === 'farm') s.animals = [{ k: 'cow', dx: 52, s: 'moo' }, { k: 'sheep', dx: 104, s: 'baa' }, { k: 'pig', dx: 140, s: 'oink' }, { k: 'hen', dx: 176, s: 'peep' }, { k: 'chick', dx: 192, s: 'peep' }].map(a => ({ ...a, talk: 0 }));
    if (kind === 'bridge') s.boatX = 40 + Math.random() * 60;
    if (kind === 'tunnel') { s.pl = x + 50; s.pr = x + w - 50; s.goat = 0; }
    if (kind === 'town') s.kids = [{ type: 'kid3', dx: 40 }, { type: 'kid', dx: 66 }, { type: 'kid2', dx: 168 }].map(k => ({ ...k, skin: SKIN[Math.floor(Math.random() * 4)], hop: 0 }));
    st.segs.push(s); st.nextX += w;
    return s;
  }
  function reset() {
    Object.assign(st, { x: 0, v: 0, wheelA: 0, chuffA: 0, idle: 0, mode: 'board', boardT: 0, seats: new Array(SEATS).fill(null), segs: [], planI: 0, nextX: 0, segN: 0, riderI: 0, smoke: [], words: [], walkers: [], steps: [], cars: [] });
    st.hold.clear();
    const s0 = addSeg();
    st.x = s0.stopX; st.stopSeg = s0;
    // two friends are already riding
    st.seats[1] = { ...newRider(), type: 'kid2', stops: 1 }; st.seats[4] = { ...newRider(), type: 'cat', stops: 2 };
    st.look = W - L.safeR - 12; st.cam = st.x - st.look;
    startBoarding(s0);
  }

  /* ---------- layout ---------- */
  const Y = {};
  function layout() {
    Y.pr = H > W;
    Y.b = Math.min(L.blob, Y.pr ? 30 : 24);
    Y.dashH = Y.b + 12;
    Y.dashY = H - L.safeB - Y.dashH;
    const fg = Y.pr ? clamp(Math.round((Y.dashY - L.safeT) * 0.33), 36, 170) : clamp(Math.round((Y.dashY - L.safeT) * 0.26), 34, 60);
    Y.tr = Y.dashY - fg;              // the top of the rails
    Y.fg = fg;
    Y.hz = Y.tr - (Y.pr ? 64 : 34);   // where the far fields meet the hills
    Y.road = fg >= 70 ? Math.round(Y.tr + Math.max(48, fg * 0.62)) : 0;   // tall screens: a country road alongside, with the trucks driving by
    const x0 = L.safeL + 6, gp = 6, b = Y.b, by = Y.dashY + 6;
    Y.home = { x: x0, y: by, s: b };
    Y.whistle = { x: x0 + (b + gp), y: by, s: b };
    Y.bell = { x: x0 + 2 * (b + gp), y: by, s: b };
    Y.paint = { x: x0 + 3 * (b + gp), y: by, s: b };
    const px = Y.paint.x + b + gp + 4;
    Y.pedal = { x: px, y: by - 1, w: Math.max(40, Math.min(150, W - L.safeR - 6 - px)), h: b + 2 };
    if (scene === 'train') setClouds(L.safeT + 8, Math.max(L.safeT + 30, Y.hz - 40));
  }

  /* ---------- little helpers ---------- */
  const fgY = v => Y.road ? Math.min(v, Y.road - 15) : v;   // keep foreground friends off the road
  function word(s, wx, y, c = '#ffffff') { st.words.push({ s, x: wx, y, c, life: 1.4 }); }
  function outlined(s, x, y, size, c) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) text(s, x + dx, y + dy, size, IRON);
    text(s, x, y, size, c);
  }
  const sxw = wx => Math.round(wx - st.cam);
  function hit(x, y, w, h, fn) { st.hits.push({ x, y, w, h, fn }); }
  function blow() {
    if (st.whistleT > 0.4) return;
    st.whistleT = 1.6; SND.play(Math.random() < 0.7 ? 'whistle' : 'whistle2');
    const cx = carLeft(0) + 38;
    word('TOOT TOOT!', cx - 10, Y.tr - 62, '#ffffff');
    for (let i = 0; i < 6; i++) st.smoke.push({ x: cx + 2, y: Y.tr - 38, r: 2 + Math.random() * 2, vx: 6 + Math.random() * 10, vy: -26 - Math.random() * 16, life: 1.4, max: 1.4, steam: true });
    for (let i = 0; i < SEATS; i++) if (st.seats[i]) st.seats[i].wave = 1.2 + i * 0.1;
    // the animals and kids nearby look up and answer
    for (const s of st.segs) {
      if (s.animals && Math.abs(s.x + s.w / 2 - st.x) < 220) s.animals.forEach((a, i) => { a.talk = 0.8 + i * 0.25; });
      if (s.kids) s.kids.forEach(k => { k.hop = 1; });
    }
  }
  function ring() { st.bellT = 0.8; st.bellSwing = 1.2; SND.play('bell'); word('DING DING!', carLeft(0) + 6, Y.tr - 56, '#ffd21f'); }
  function repaint() {
    st.ci = (st.ci + 1) % COLORS.length; st.paintT = 0.6; SND.play('chime');
    for (let i = 0; i < CARS.length; i++) { const l = carLeft(i); sparkle(sxw(l + CARS[i].w / 2), Y.tr - 18, CARS[i].w / 2, 6, COLORS[st.ci].light); }
  }

  /* ---------- stations: hop off, climb aboard ---------- */
  function startBoarding(s) {
    st.mode = 'board'; st.boardT = 0; st.stopSeg = s; st.steps = [];
    let t = 0.5;
    // riders whose stop this is get off first
    for (let i = 0; i < SEATS; i++) {
      const p = st.seats[i];
      if (p && --p.stops <= 0) { const at = t; st.steps.push({ t: at, fn: () => alight(i) }); t += 0.5; }
    }
    // then the friends on the platform walk to a free window and climb in
    const free = [];
    for (let i = 0; i < SEATS; i++) if (!st.seats[i] || st.seats[i].stops <= 0) free.push(i);
    free.sort((a, b) => hsh(a + s.n) - hsh(b + s.n));
    for (const w of s.wait) {
      if (!free.length) break;
      const seat = free.shift(), at = t;
      st.steps.push({ t: at, fn: () => { w.state = 'walk'; w.seat = seat; } });
      t += 0.45;
    }
    st.boardEnd = t + 1.6;
    if (s.n > 0) { SND.play('hiss'); for (let i = 0; i < 8; i++) st.smoke.push({ x: carLeft(0) + 40 + Math.random() * 8, y: Y.tr - 4, r: 2, vx: 10 + Math.random() * 20, vy: -4 - Math.random() * 6, life: 1, max: 1, steam: true }); }
  }
  function alight(i) {
    const p = st.seats[i]; if (!p) return;
    st.seats[i] = null;
    const x = seatX(i);
    st.walkers.push({ p, x, dir: hsh(i * 7 + st.segN) < 0.5 ? -1 : 1, t: 0, hop: 1 });
    SND.play('pop'); sparkle(sxw(x), Y.tr - 20, 6, 5);
  }
  function updateBoarding(dt) {
    st.boardT += dt;
    for (const s of st.steps) if (!s.done && st.boardT >= s.t) { s.done = true; s.fn(); }
    const seg = st.stopSeg;
    for (const w of seg.wait) {
      if (w.state !== 'walk') continue;
      const tx = seatX(w.seat), d = tx - w.x;
      if (Math.abs(d) < 2) {
        w.state = 'gone';
        const p = w.p; p.hop = 1; p.wave = 1.5;
        st.seats[w.seat] = p;
        SND.play(p.type === 'cat' ? 'meow' : p.type === 'vizsla' ? 'bark' : p.type === 'husky' ? 'bark2' : 'pop');
        sparkle(sxw(tx), Y.tr - 22, 6, 6);
      } else w.x += Math.sign(d) * Math.min(Math.abs(d), (PETSET.has(w.p.type) ? 46 : 32) * dt);
    }
    const busy = seg.wait.some(w => w.state === 'walk') || st.steps.some(s => !s.done);
    if (!busy && st.boardT > st.boardEnd) {
      seg.served = true; seg.wait = seg.wait.filter(w => w.state === 'wait');
      st.mode = 'run'; st.idle = 0;
      blow();
    }
  }

  /* ---------- update ---------- */
  function ensureWorld() {
    while (st.nextX < st.cam + W + 320) addSeg();
    while (st.segs.length && st.segs[0].x + st.segs[0].w < st.cam - LEN - 200) st.segs.shift();
  }
  function nextStation() { return st.segs.find(s => s.kind === 'station' && !s.served && s.stopX > st.x - 1); }
  function update(dt) {
    SND.load();
    st.whistleT = Math.max(0, st.whistleT - dt); st.bellT = Math.max(0, st.bellT - dt); st.paintT = Math.max(0, st.paintT - dt);
    st.bellSwing = Math.max(0, st.bellSwing - dt);
    if (st.mode === 'board') updateBoarding(dt);
    const going = st.mode === 'run' && st.hold.size > 0;
    if (going) st.v = Math.min(VMAX, st.v + ACC * dt); else st.v = Math.max(0, st.v - BRAKE * dt);
    // stop at the next station on our own, right where the windows meet the platform
    const ns = nextStation();
    if (ns && st.mode === 'run') {
      const d = ns.stopX - st.x;
      st.v = Math.min(st.v, Math.sqrt(2 * BRAKE * Math.max(0, d)) + (d > 1 ? 2 : 0));
      if (d <= 0.6 && (st.v < 6 || d < 0)) { st.x = ns.stopX; st.v = 0; startBoarding(ns); }
    }
    const wasMoving = st.v > 0.5;
    st.x += st.v * dt;
    if (!going && wasMoving && st.v <= 0.5 && st.mode === 'run') { SND.play('hiss'); }
    st.idle = st.hold.size || st.mode !== 'run' ? 0 : st.idle + dt;
    // camera: look further ahead the faster we go
    const k = st.v / VMAX, want = lerp(Math.min(W - L.safeR - 12, Math.max(LEN + 8, W * 0.86)), Math.max(W * 0.58, Math.min(LEN * 0.75, W - 60)), k);
    st.look = st.look ? lerp(st.look, want, Math.min(1, dt * 1.5)) : want;
    st.cam = st.x - st.look;
    ensureWorld();
    updateCars(dt);
    // wheels, chuffs and smoke
    st.wheelA += st.v / 6 * dt;
    st.chuffA += st.v / 6 * dt;
    if (st.chuffA > Math.PI / 2) {
      st.chuffA -= Math.PI / 2;
      chuff(k);
      st.smoke.push({ x: carLeft(0) + 38, y: Y.tr - 38, r: 2 + k * 2, vx: -st.v * 0.6 + Math.random() * 6, vy: -18 - Math.random() * 10, life: 1.6, max: 1.6 });
    }
    if (st.v < 1 && Math.random() < dt * 1.2) st.smoke.push({ x: carLeft(0) + 38, y: Y.tr - 38, r: 1.5, vx: 2, vy: -10, life: 1.6, max: 1.6 });
    chugLoop(0.15 + 0.85 * k, 0.6 + 0.6 * k);
    for (const p of st.smoke) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 - dt * 0.8; p.r += dt * (p.steam ? 3 : 4); }
    st.smoke = st.smoke.filter(p => p.life > 0);
    for (const w of st.words) { w.life -= dt; w.y -= 8 * dt; }
    st.words = st.words.filter(w => w.life > 0);
    for (let i = 0; i < SEATS; i++) { const p = st.seats[i]; if (p) { p.hop = Math.max(0, p.hop - dt * 3); p.wave = Math.max(0, p.wave - dt); } }
    for (const w of st.walkers) { w.t += dt; w.hop = Math.max(0, w.hop - dt * 3); if (w.t > 0.5) w.x += w.dir * 30 * dt; }
    st.walkers = st.walkers.filter(w => w.t < 6 && w.x > st.cam - 40 && w.x < st.cam + W + 40);
    // crossings: lights, bells and the gate
    const tail = st.x - LEN;
    for (const s of st.segs) {
      if (s.kind === 'crossing') {
        const near = st.x > s.cx - 150 && tail < s.cx + 14 && (st.v > 0.5 || st.x > s.cx - 40);
        s.gate = clamp(s.gate + (near ? dt * 1.6 : -dt * 1.0), 0, 1);
        s.on = near || s.gate > 0.05;
        if (s.on && sxw(s.cx) > -20 && sxw(s.cx) < W + 20) { s.dingT -= dt; if (s.dingT <= 0) { s.dingT = 0.42; s.hi = !s.hi; crossDing(s.hi); } }
        if (!near && tail > s.cx + 14) s.go = Math.min(1, s.go + dt * 0.5);
        s.vhop = Math.max(0, (s.vhop || 0) - dt * 3);
      }
      if (s.animals) for (const a of s.animals) a.talk = Math.max(0, a.talk - dt);
      if (s.kids) for (const kd of s.kids) kd.hop = Math.max(0, kd.hop - dt * 2.5);
      if (s.kind === 'tunnel') {
        const inside = st.x > s.pl + 30 && st.x < s.pr;
        if (inside && !s.whooed) { s.whooed = true; SND.play('whistle2', 0.9); word('WOOO!', (s.pl + s.pr) / 2 - 12, Y.tr - 96, '#ffffff'); }
        s.goat = Math.max(0, s.goat - dt);
      }
      if (s.kind === 'meadow') s.spin = Math.max(0, (s.spin || 0) - dt);
    }
    // the kids in town wave as the train goes by
    for (const s of st.segs) if (s.kids) for (const kd of s.kids) { const kx = s.x + kd.dx; if (Math.abs(kx - (st.x - LEN / 2)) < LEN / 2 + 10 && st.v > 5 && Math.random() < dt * 0.8) kd.hop = 1; }
  }

  /* ---------- drawing: the train ---------- */
  function wheel(cx, cy, r, c, a) {
    circle(cx, cy, r, IRON); circle(cx, cy, r - 1, c);
    const sp = r >= 5 ? 4 : 2;
    for (let i = 0; i < sp; i++) { const b = a + i * Math.PI / sp; for (let d = -r + 2; d <= r - 2; d++) R(Math.round(cx + Math.cos(b) * d), Math.round(cy + Math.sin(b) * d), 1, 1, IRON); }
    circle(cx, cy, Math.max(1, r - 4), '#ffd21f');
  }
  function engine(x, yb, C) {
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy, w, h, c), a = st.wheelA;
    // frame, cylinder and cowcatcher
    P(2, -12, 46, 3, DK);
    P(40, -13, 9, 6, '#5a5f6e'); P(40, -13, 9, 1, '#7a8090');
    for (let i = 0; i < 8; i++) P(47 + Math.floor(i * 0.6), -9 + i, 5 - Math.floor(i * 0.6), 1, i % 2 ? C.dark : '#e8222b');
    P(48, -10, 3, 2, DK);
    // cab
    P(0, -34, 17, 23, C.main); P(0, -34, 17, 2, C.light); P(-2, -37, 21, 3, DK); P(-1, -38, 19, 1, '#5a5f6e');
    P(3, -30, 10, 9, IRON); P(4, -29, 8, 7, GLASS);
    // the engineer in a striped cap, waving when we toot
    P(5, -25, 6, 4, SKIN[1]); P(9, -24, 1, 1, INK); P(10, -22, 1, 1, '#a3121d');
    P(4, -28, 8, 3, '#3a5aa8'); P(5, -28, 1, 3, '#ffffff'); P(8, -28, 1, 3, '#ffffff'); P(11, -26, 3, 1, '#3a5aa8');
    if (st.whistleT > 0) { const up = Math.floor(T * 8) % 2; P(12, -30 + up, 2, 5, '#3a5aa8'); P(12, -32 + up, 2, 2, SKIN[1]); }
    P(0, -13, 17, 2, C.trim); P(2, -18, 13, 1, C.dark);
    // boiler, bands, dome, sandbox and the little bell
    P(17, -28, 26, 16, C.main); P(17, -28, 26, 2, C.light); P(17, -14, 26, 2, C.dark);
    P(23, -28, 2, 16, C.trim); P(34, -28, 2, 16, C.trim);
    P(27, -32, 6, 4, C.trim); P(28, -33, 4, 1, C.trim); P(28, -32, 1, 2, '#fff3a6');
    const sw = st.bellSwing > 0 ? Math.round(Math.sin(T * 18) * 1.5) : 0;
    P(19, -30, 1, 2, DK); P(18 + sw, -33, 3, 3, '#ffd21f'); P(17 + sw, -31, 5, 1, '#e0b010');
    // smokebox, headlight and chimney
    P(43, -29, 6, 18, '#3a3d46'); P(43, -29, 6, 1, '#5a5f6e'); P(47, -23, 1, 1, '#cfd6dd');
    P(44, -34, 6, 5, DK); P(45, -33, 4, 3, '#fff3a6'); P(46, -33, 2, 1, '#ffffff');
    P(36, -36, 5, 8, DK); P(34, -39, 9, 3, DK); P(35, -39, 7, 1, '#5a5f6e');
    if (st.whistleT > 0) { P(31, -31, 2, 3, '#ffd21f'); }
    // wheels: a little one under the cab, two big drivers and a pony wheel up front
    wheel(x + 8, yb - 4, 4, C.dark, a * 1.5);
    wheel(x + 20, yb - 6, 6, C.dark, a);
    wheel(x + 33, yb - 6, 6, C.dark, a);
    wheel(x + 45, yb - 3, 3, C.dark, a * 2);
    const cx = Math.cos(a) * 3.5, cy = Math.sin(a) * 3.5;
    R(Math.round(x + 20 + cx), Math.round(yb - 7 + cy), 14, 2, '#cfd6dd');
    bar(x + 33 + cx, yb - 6 + cy, x + 42, yb - 10, 2, '#cfd6dd');
    circle(Math.round(x + 20 + cx), Math.round(yb - 6 + cy), 1, '#ffffff'); circle(Math.round(x + 33 + cx), Math.round(yb - 6 + cy), 1, '#ffffff');
  }
  function tender(x, yb, C) {
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy, w, h, c);
    P(0, -24, 24, 14, C.dark); P(0, -24, 24, 2, C.main); P(0, -13, 24, 2, C.trim);
    P(2, -27, 20, 3, IRON); circle(x + 7, yb - 27, 2, IRON); circle(x + 13, yb - 28, 3, IRON); circle(x + 19, yb - 27, 2, IRON);
    P(8, -21, 8, 5, C.main); P(10, -20, 4, 3, C.trim);
    P(1, -10, 22, 2, DK);
    wheel(x + 6, yb - 4, 4, C.dark, st.wheelA * 1.5); wheel(x + 18, yb - 4, 4, C.dark, st.wheelA * 1.5);
  }
  function windowRider(p, wx, wy, i) {
    // wx, wy: the window's top-left; heads and waving hands show through the glass
    g.save(); g.beginPath(); g.rect(wx, wy, 10, 9); g.clip();
    const hop = Math.round(p.hop * 3), cx = wx + 5;
    if (p.type === 'cat') PETS.catSit(cx, wy + 18 - hop, { blink: Math.floor(T * 0.7 + i) % 5 === 0 });
    else if (p.type === 'vizsla' || p.type === 'husky') {
      const D = SCENES.icecream && SCENES.icecream._dogs;
      if (D) D[p.type](cx - 10, wy + 18 - hop, 1, { pant: true, bark: p.hop > 0.5 });
    } else {
      const ph = personH(p.type);
      drawPerson({ type: p.type, x: cx, yb: wy + 1 + ph - hop, dir: 1, pose: p.wave > 0 ? 'wave' : 'stand', skin: p.skin, seed: p.seed + i });
    }
    g.restore();
  }
  function coach(x, yb, C, ci, bob) {
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy + bob, w, h, c);
    P(0, -30, 44, 22, C.main); P(1, -27, 42, 11, '#fff2d8'); P(0, -14, 44, 2, C.trim);
    P(-1, -33, 46, 3, '#5a5f6e'); P(1, -34, 42, 1, '#5a5f6e'); P(1, -33, 42, 1, '#7a8090');
    for (let w = 0; w < 3; w++) {
      const wx = x + 5 + w * 13, wy = yb - 26 + bob, i = ci * 3 + w;
      R(wx - 1, wy - 1, 12, 11, C.dark); R(wx, wy, 10, 9, GLASS);
      const p = st.seats[i];
      if (p) windowRider(p, wx, wy, i);
      R(wx, wy, 3, 1, '#ffffff');
    }
    P(2, -8, 40, 2, DK);
    for (const wx of [7, 14, 30, 37]) wheel(x + wx, yb - 3, 3, '#3a3d46', st.wheelA * 2);
  }
  function caboose(x, yb, bob) {
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy + bob, w, h, c), C1 = '#c8432f', C2 = '#9a2a1d';
    P(0, -29, 32, 21, C1); P(0, -29, 32, 2, '#e0644a'); P(0, -12, 32, 2, '#ffd21f');
    P(10, -37, 12, 8, C1); P(9, -39, 14, 2, DK); P(13, -35, 6, 4, GLASS);
    P(-1, -31, 34, 2, DK);
    P(5, -25, 7, 7, C2); P(6, -24, 5, 5, GLASS); P(20, -25, 7, 7, C2); P(21, -24, 5, 5, GLASS);
    P(-3, -18, 3, 1, DK); P(-3, -22, 1, 5, DK);
    P(-1, -26, 2, 3, Math.floor(T * 2) % 2 ? '#ff3b3b' : '#8c2a2a');
    P(2, -8, 28, 2, DK);
    for (const wx of [7, 25]) wheel(x + wx, yb - 3, 3, '#3a3d46', st.wheelA * 2);
  }
  function drawTrain() {
    const C = COLORS[st.ci], yb = Y.tr, mv = st.v > 4;
    for (let i = CARS.length - 1; i >= 0; i--) {
      const l = sxw(carLeft(i)), k = CARS[i].k, bob = mv && (Math.floor(T * 9) + i) % 3 === 0 ? -1 : 0;
      if (i < CARS.length - 1) R(l + CARS[i].w - CARS[i].w - GAP, yb - 8, GAP, 2, DK);   // the coupling behind this car
      if (k === 'engine') engine(l, yb + bob, C);
      else if (k === 'tender') tender(l, yb, C);
      else if (k === 'coach') coach(l, yb, C, i - 2, bob);
      else caboose(l, yb, bob);
    }
    if (st.paintT > 0) alpha(st.paintT, () => { for (let i = 0; i < CARS.length; i++) R(sxw(carLeft(i)), yb - 34, CARS[i].w, 26, '#ffffff'); });
    // hits: the windows, then the engine
    for (let i = 0; i < SEATS; i++) {
      const sx = sxw(seatX(i));
      hit(sx - 7, yb - 30, 14, 16, () => {
        const p = st.seats[i];
        if (!p) { SND.play('pop'); return; }
        p.hop = 1; p.wave = 1.2;
        const say = { cat: ['meow', 'MEOW!'], vizsla: ['bark', 'WOOF!'], husky: ['bark2', 'WOOF!'] }[p.type];
        if (say) { SND.play(say[0]); word(say[1], seatX(i) - 10, yb - 44, '#ffffff'); } else { SND.play('pop'); sparkle(sx, yb - 26, 6, 5); }
      });
    }
    const el = sxw(carLeft(0));
    hit(el - 2, yb - 42, 56, 44, blow);
    const cl = sxw(carLeft(4));
    hit(cl - 4, yb - 40, 36, 42, ring);
  }
  function drawSmoke() {
    for (const p of st.smoke) {
      const a = Math.min(1, p.life / p.max * 1.6), x = sxw(p.x), y = Math.round(p.y), r = Math.round(p.r);
      alpha(a * (p.steam ? 0.85 : 0.9), () => { circle(x, y, r, p.steam ? '#ffffff' : '#d8dbe2'); if (r > 2) circle(x - 1, y - 1, r - 1, p.steam ? '#ffffff' : '#eef0f4'); });
    }
  }

  /* ---------- drawing: the land ---------- */
  function hills(base, amp, freq, seed, c, par) {
    const off = st.cam * par;
    for (let x = 0; x < W; x += 2) {
      const u = x + off, h = Math.round(amp * (0.6 + 0.4 * Math.sin(u * freq + seed) + 0.3 * Math.sin(u * freq * 2.3 + seed * 3)));
      if (h > 0) R(x, base - h, 2, h + 1, c);
    }
  }
  function backdrop() {
    const far = Y.pr ? 70 : 40;
    hills(Y.hz, far, 0.011, 1.3, '#b4cfe6', 0.08);
    // snow on the tallest far peaks
    const off = st.cam * 0.08;
    for (let x = 0; x < W; x += 2) {
      const u = x + off, h = Math.round(far * (0.6 + 0.4 * Math.sin(u * 0.011 + 1.3) + 0.3 * Math.sin(u * 0.011 * 2.3 + 3.9)));
      if (h > far * 1.05) R(x, Y.hz - h, 2, Math.min(5, h - far * 1.05 + 2), '#f4f7fb');
    }
    hills(Y.hz + 2, Y.pr ? 26 : 16, 0.023, 4.1, '#9ad27e', 0.25);
    R(0, Y.hz, W, Y.tr - Y.hz + 2, '#8fd877');
    for (let x = -(Math.floor(st.cam * 0.6) % 11); x < W; x += 11) R(x, Y.hz + 6 + (Math.abs(x) * 7) % (Y.tr - Y.hz - 8 || 1), 2, 1, '#7cc96a');
    // the foreground grass under the line
    R(0, Y.tr + 5, W, Y.dashY - Y.tr - 5, '#6cbf5a');
    for (let x = -(Math.floor(st.cam) % 9); x < W; x += 9) { const wx = Math.floor(st.cam) + x; R(x, Y.tr + 9 + Math.floor(hsh(wx) * (Y.fg - 12)), 1, 2, hsh(wx * 3) > 0.8 ? '#ffd21f' : hsh(wx * 5) > 0.75 ? '#ff6fb4' : '#5aa84c'); }
  }
  function track(x0, x1) {
    const a = Math.max(0, x0), b = Math.min(W, x1);
    if (b <= a) return;
    R(a, Y.tr + 1, b - a, 4, '#a89c88'); R(a, Y.tr + 4, b - a, 1, '#8a7e6a');
    for (let x = -(Math.floor(st.cam) % 6); x < W; x += 6) if (x >= a - 3 && x < b) R(Math.max(a, x), Y.tr + 1, Math.min(3, b - x), 2, '#6a4a2a');
    R(a, Y.tr - 1, b - a, 2, STEEL); R(a, Y.tr - 1, b - a, 1, '#cfd6dd');
  }
  function bridgeTrack(x0, x1) {   // rails on the stone bridge deck
    const a = Math.max(0, x0), b = Math.min(W, x1);
    if (b <= a) return;
    for (let x = -(Math.floor(st.cam) % 6); x < W; x += 6) if (x >= a - 3 && x < b) R(Math.max(a, x), Y.tr + 1, Math.min(3, b - x), 1, '#6a4a2a');
    R(a, Y.tr - 1, b - a, 2, STEEL); R(a, Y.tr - 1, b - a, 1, '#cfd6dd');
  }

  // A friendly front-on view of the vehicles waiting at the crossing: 24 wide, wheels on yb.
  function frontV(kind, cx, yb, hop) {
    const P = (dx, dy, w, h, c) => R(cx + dx, yb - hop + dy, w, h, c), ph = Math.floor(T * 6) % 2;
    const lightbar = (y, a, b) => { P(-7, y, 7, 2, ph ? a : '#ffffff'); P(0, y, 7, 2, ph ? '#ffffff' : b); };
    P(-11, -3, 5, 3, INK); P(6, -3, 5, 3, INK);
    if (kind === 'fire') {
      P(-12, -20, 24, 16, '#e8222b'); P(-12, -20, 24, 2, '#ff6b5e'); P(-10, -17, 20, 6, GLASS);
      P(-3, -16, 5, 4, SKIN[2]); P(-4, -18, 7, 2, '#e8222b'); P(-1, -15, 1, 1, INK);
      lightbar(-22, '#ff3b3b', '#ff3b3b'); P(-8, -9, 16, 3, '#cfd6dd'); P(-6, -8, 12, 1, '#9aa3ad');
      P(-11, -9, 3, 2, '#fff6b0'); P(8, -9, 3, 2, '#fff6b0'); P(-13, -6, 26, 2, '#cfd6dd'); P(-12, -11, 24, 1, '#ffd21f');
    } else if (kind === 'police') {
      P(-12, -12, 24, 8, '#2a6fe0'); P(-9, -18, 18, 6, '#f4f7fb'); P(-8, -17, 16, 4, GLASS); lightbar(-20, '#ff3b3b', '#3b8bff');
      P(-2, -16, 4, 3, SKIN[1]); P(-3, -17, 6, 1, '#1a2a5a');
      P(-11, -10, 3, 2, '#fff6b0'); P(8, -10, 3, 2, '#fff6b0'); P(-4, -9, 8, 2, '#1d1a2b'); P(-13, -6, 26, 2, '#cfd6dd');
    } else if (kind === 'amb') {
      P(-12, -22, 24, 18, '#f4f7fb'); P(-12, -13, 24, 2, '#e8222b'); P(-9, -19, 18, 5, GLASS); lightbar(-24, '#ff3b3b', '#ff3b3b');
      P(-2, -18, 4, 3, SKIN[0]); P(-1, -9, 2, 4, '#e8222b'); P(-2, -8, 4, 2, '#e8222b');
      P(-11, -9, 3, 2, '#fff6b0'); P(8, -9, 3, 2, '#fff6b0'); P(-13, -6, 26, 2, '#cfd6dd');
    } else if (kind === 'ice') {
      P(-12, -22, 24, 18, '#ffb0cc'); P(-12, -22, 24, 2, '#ffd0e0'); P(-9, -18, 18, 5, GLASS); P(-12, -10, 24, 2, '#7ad0ff');
      P(-2, -17, 4, 3, SKIN[1]); circle(cx, yb - hop - 26, 3, '#fff6e0'); P(-1, -25, 2, 2, '#e8222b');
      P(-11, -8, 3, 2, '#fff6b0'); P(8, -8, 3, 2, '#fff6b0'); P(-13, -6, 26, 2, '#cfd6dd');
    } else {
      P(-12, -12, 24, 8, '#ffd21f'); P(-9, -18, 18, 6, '#ffd21f'); P(-8, -17, 16, 4, GLASS);
      P(-2, -16, 4, 3, SKIN[3]); P(-11, -10, 3, 2, '#fff6b0'); P(8, -10, 3, 2, '#fff6b0'); P(-4, -9, 8, 2, '#c99410'); P(-13, -6, 26, 2, '#cfd6dd');
    }
  }

  function stationBack(s, x) {
    x = sxw(x);
    const th = s.theme, yb = Y.tr - 4;
    const wall = ['#c8643a', '#4a8ad0', '#f2c14a'][th], roof = ['#5a3a2a', '#2a3a6a', '#c8432f'][th], trim = ['#f2e2c4', '#ffffff', '#ffffff'][th];
    const bx = x + 70, bw = 96, bh = Y.pr ? 40 : 32;
    R(bx, yb - bh, bw, bh, wall); R(bx, yb - bh, bw, 2, trim);
    if (th === 0) for (let yy = yb - bh + 4; yy < yb; yy += 4) for (let xx = bx + ((yy >> 2) % 2) * 3; xx < bx + bw - 2; xx += 7) R(xx, yy, 5, 1, '#b4552f');
    poly([[bx - 8, yb - bh], [bx + bw + 8, yb - bh], [bx + bw - 6, yb - bh - 16], [bx + 6, yb - bh - 16]], roof);
    R(bx - 8, yb - bh, bw + 16, 2, IRON);
    // clock on the gable, with hands that really move
    const ccx = bx + bw / 2, ccy = yb - bh - 8;
    circle(ccx, ccy, 6, '#ffffff'); circle(ccx, ccy, 5, '#fff6e0');
    const ha = T * 0.05, ma = T * 0.6;
    R(ccx, ccy, 1, 1, INK); R(Math.round(ccx + Math.cos(ha) * 3), Math.round(ccy + Math.sin(ha) * 3), 1, 1, INK);
    for (let d = 1; d < 5; d++) R(Math.round(ccx + Math.cos(ma) * d), Math.round(ccy + Math.sin(ma) * d), 1, 1, '#e8222b');
    // windows and a door
    for (const wx of [bx + 8, bx + 26, bx + bw - 34, bx + bw - 16]) { R(wx, yb - bh + 10, 9, 11, trim); R(wx + 1, yb - bh + 11, 7, 9, GLASS); R(wx + 4, yb - bh + 11, 1, 9, trim); }
    R(ccx - 6, yb - 20, 12, 20, '#7a4a2a'); R(ccx - 6, yb - 20, 12, 2, trim); R(ccx + 3, yb - 11, 1, 2, '#ffd21f');
    // the sign: a little engine picture
    R(ccx - 14, yb - bh - 30, 28, 11, IRON); R(ccx - 13, yb - bh - 29, 26, 9, '#ffffff');
    R(ccx - 8, yb - bh - 26, 10, 4, '#e8222b'); R(ccx - 10, yb - bh - 27, 4, 5, '#e8222b'); R(ccx, yb - bh - 28, 2, 2, IRON);
    circle(ccx - 7, yb - bh - 21, 1, IRON); circle(ccx - 2, yb - bh - 21, 1, IRON); circle(ccx + 2, yb - bh - 21, 1, IRON);
    R(ccx - 1, yb - bh - 19, 2, 3, IRON);
    // flower boxes or a fire helmet sign, depending on the town
    if (th === 2) for (const wx of [bx + 8, bx + 26, bx + bw - 34, bx + bw - 16]) for (let k = 0; k < 4; k++) R(wx + k * 2 + 1, yb - bh + 21, 2, 2, k % 2 ? '#ff6fb4' : '#e8222b');
    if (th === 0) { R(bx + bw - 30, yb - 18, 12, 8, '#e8222b'); R(bx + bw - 28, yb - 16, 8, 3, '#ffd21f'); }
    // bench and lamp posts
    R(x + 24, yb - 6, 20, 2, '#7a4a2a'); R(x + 24, yb - 10, 20, 2, '#7a4a2a'); R(x + 26, yb - 4, 2, 4, DK); R(x + 40, yb - 4, 2, 4, DK);
    for (const lx of [x + 14, x + s.w - 30]) { R(lx, yb - 34, 2, 34, DK); R(lx - 3, yb - 38, 8, 4, DK); R(lx - 2, yb - 37, 6, 2, '#fff3a6'); }
  }
  function stationFront(s, x) {
    // the platform, in front of the train so the waiting friends stand on it
    const a = sxw(x) + 6, w = s.w - 12;
    R(a, Y.tr + 3, w, 6, '#d8d0bc'); R(a, Y.tr + 3, w, 1, '#ffd21f'); R(a, Y.tr + 9, w, 3, '#a8a090');
    for (let xx = a + 4; xx < a + w; xx += 12) R(xx, Y.tr + 9, 1, 3, '#8a8270');
    const yb = Y.tr + 8;
    for (const wt of s.wait) {
      if (wt.state === 'gone') continue;
      const px = sxw(wt.x), p = wt.p, walking = wt.state === 'walk';
      const hop = Math.round((p.hop || 0) * 4);
      if (p.type === 'cat') { if (walking) PETS.catWalk(px, yb, wt.seat >= 0 && seatX(wt.seat) < wt.x ? -1 : 1, { walk: true }); else PETS.catSit(px, yb - hop, { swish: true }); }
      else if (p.type === 'vizsla' || p.type === 'husky') { const D = SCENES.icecream && SCENES.icecream._dogs; if (D) D[p.type](px, yb - hop, walking && seatX(wt.seat) < wt.x ? -1 : 1, { run: walking, wag: true, pant: true }); }
      else drawPerson({ type: p.type, x: px, yb, dir: walking && seatX(wt.seat) < wt.x ? -1 : 1, pose: walking ? 'stand' : p.hop > 0 ? 'cheer' : 'wave', walk: walking, skin: p.skin, seed: p.seed, hop });
      if (!walking) hit(px - 9, yb - 24, 18, 26, () => {
        p.hop = 1;
        const say = { cat: ['meow', 'MEOW!'], vizsla: ['bark', 'WOOF!'], husky: ['bark2', 'WOOF!'] }[p.type];
        if (say) { SND.play(say[0]); word(say[1], wt.x - 10, yb - 32); } else { SND.play('pop'); sparkle(px, yb - 20, 6, 5); }
      });
    }
  }
  function drawWalkers() {
    const yb = Y.tr + 8;
    for (const w of st.walkers) {
      const px = sxw(w.x), p = w.p, hop = Math.round(Math.sin(Math.min(1, w.t * 2) * Math.PI) * 6);
      if (p.type === 'cat') PETS.catWalk(px, yb - hop, w.dir, { walk: true });
      else if (p.type === 'vizsla' || p.type === 'husky') { const D = SCENES.icecream && SCENES.icecream._dogs; if (D) D[p.type](px, yb - hop, w.dir, { run: true, wag: true }); }
      else drawPerson({ type: p.type, x: px, yb, dir: w.dir, pose: w.t < 1.2 ? 'wave' : 'stand', walk: w.t > 0.5, skin: p.skin, seed: p.seed, hop });
    }
  }
  function crossingBack(s, x) {
    const cx = sxw(s.cx);
    poly([[cx - 10, Y.tr], [cx + 10, Y.tr], [cx + 3, Y.hz + 2], [cx - 3, Y.hz + 2]], '#7a7f8c');
    for (let y = Y.hz + 6; y < Y.tr - 2; y += 6) R(cx, y, 1, 3, '#ffd21f');
    // the far signal
    signal(cx - 16, Y.tr - 4, s, 0.7);
  }
  function signal(x, yb, s, k) {
    const h = Math.round(30 * k), on = s.on, ph = Math.floor(T * 2.4) % 2;
    R(x, yb - h, 2, h, '#e8e8e8');
    // the white X
    for (let i = 0; i < 9; i++) { R(x - 4 + i, yb - h - 2 + i, 2, 1, '#f4f7fb'); R(x + 4 - i, yb - h - 2 + i, 2, 1, '#f4f7fb'); }
    R(x - 4, yb - h + 8, 10, 4, IRON);
    circle(x - 2, yb - h + 10, 1, on && ph ? '#ff3b3b' : '#5a2a2a'); circle(x + 4, yb - h + 10, 1, on && !ph ? '#ff3b3b' : '#5a2a2a');
    s.lights = s.lights || []; s.lights.push([x - 2, yb - h + 10, on && ph], [x + 4, yb - h + 10, on && !ph]);
  }
  function crossingFront(s, x) {
    const cx = sxw(s.cx), y0 = Y.tr + 5, y1 = Y.dashY;
    poly([[cx - 10, y0], [cx + 10, y0], [cx + 16, y1], [cx - 16, y1]], '#7a7f8c');
    for (let y = y0 + 3; y < y1; y += 7) R(cx, y, 1, 4, '#ffd21f');
    // planks between the rails
    R(cx - 10, Y.tr - 1, 20, 2, '#9a8a6a');
    const vy = Math.round(Y.tr + Math.min(Y.fg - 4, 30 + Y.fg * 0.15)), go = s.go;
    const yb = Math.round(vy - go * (vy - Y.tr - 2) );
    if (go < 0.95) {
      g.save(); g.beginPath(); g.rect(0, Y.tr + 3, W, H); g.clip();
      frontV(s.veh, cx, yb, Math.round((s.vhop || 0) * 3));
      g.restore();
      hit(cx - 13, yb - 26, 26, 28, () => {
        s.vhop = 1;
        if (s.veh === 'car' || s.veh === 'ice') { SND.play(s.veh === 'ice' ? 'bell' : 'honk'); word(s.veh === 'ice' ? 'DING!' : 'BEEP BEEP!', s.cx - 14, yb - 34, '#ffd21f'); }
        else { siren(); word('WEE-OO!', s.cx - 12, yb - 34, '#ff6b5e'); }
      });
    }
    // the near signal and gate arm
    const px = cx + 18, pyb = Math.min(Y.dashY - 2, Y.tr + 22);
    const ang = lerp(-Math.PI / 2, 0, s.gate);
    bar(px, pyb - 12, px - Math.cos(ang) * 30, pyb - 12 + Math.sin(-ang) * -30, 2, '#ffffff');
    for (let i = 4; i < 30; i += 8) { const ex = px - Math.cos(ang) * i, ey = pyb - 12 - Math.sin(-ang) * i; R(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3, '#e8222b'); }
    signal(px, pyb, s, 1);
  }
  function farmBack(s, x) {
    x = sxw(x);
    const yb = Y.tr - 4, bx = x + 30, bw = 46, bh = Y.pr ? 34 : 28;
    R(bx, yb - bh, bw, bh, '#c8432f'); poly([[bx - 4, yb - bh], [bx + bw / 2, yb - bh - 18], [bx + bw + 4, yb - bh]], '#8a2a1d');
    R(bx + 16, yb - 18, 14, 18, '#ffffff'); R(bx + 17, yb - 17, 12, 16, '#9a2a1d'); bar(bx + 17, yb - 17, bx + 28, yb - 2, 1, '#ffffff'); bar(bx + 28, yb - 17, bx + 17, yb - 2, 1, '#ffffff');
    R(bx + 19, yb - bh + 4, 8, 6, '#ffffff'); R(bx + 20, yb - bh + 5, 6, 4, '#3a2a20');
    // silo
    R(bx + bw + 8, yb - bh - 10, 14, bh + 10, '#c4c8d0'); circle(bx + bw + 15, yb - bh - 10, 7, '#9aa3ad'); for (let yy = yb - bh - 6; yy < yb; yy += 5) R(bx + bw + 8, yy, 14, 1, '#aab0ba');
    // a tractor and hay bales
    R(x + 150, yb - 6, 10, 6, '#f2d16b'); R(x + 162, yb - 6, 10, 6, '#f2d16b'); R(x + 150, yb - 4, 22, 1, '#d8b04a');
    R(x + 186, yb - 12, 18, 7, '#3fb43a'); R(x + 196, yb - 18, 7, 7, '#3fb43a'); R(x + 197, yb - 17, 5, 4, GLASS); R(x + 190, yb - 20, 2, 8, DK);
    circle(x + 190, yb - 4, 4, IRON); circle(x + 190, yb - 4, 2, '#ffd21f'); circle(x + 201, yb - 3, 3, IRON); circle(x + 201, yb - 3, 1, '#ffd21f');
  }
  function farmFront(s, x) {
    const big = Y.road && Y.road - Y.tr >= 80 ? 2 : 1, yb = Y.road ? Y.road - 16 : Math.round(Y.tr + Math.min(Y.fg - 3, 28 + Y.fg * 0.3));
    // a fence just below the line
    const fy = Y.tr + 10;
    for (let xx = x + 20; xx < x + s.w - 10; xx += 10) R(sxw(xx), fy, 2, 8, '#f4ead8');
    R(sxw(x + 20), fy + 2, s.w - 30, 1, '#f4ead8'); R(sxw(x + 20), fy + 5, s.w - 30, 1, '#f4ead8');
    for (const a of s.animals) {
      if (big > 1 && a.k === 'chick') continue;
      const adx = big > 1 ? { cow: 40, sheep: 118, pig: 178, hen: 214 }[a.k] : a.dx;
      const ax = sxw(x + adx), talk = a.talk > 0 && a.talk < 0.8, hop = talk ? Math.round(Math.sin(a.talk * 12) > 0 ? 2 : 0) : 0;
      const f = BOOK[a.k]; if (!f) continue;
      f(ax, yb, a.dx % 2 ? 1 : -1, big, { mouth: talk, hop, step: 0, mood: 'open' });
      const h = { cow: 28, sheep: 18, pig: 16, hen: 16, chick: 9 }[a.k] * big, w = { cow: 36, sheep: 26, pig: 22, hen: 16, chick: 10 }[a.k] * big;
      if (talk && a.talk > 0.72) { SND.play(a.s); word({ moo: 'MOO!', baa: 'BAA!', oink: 'OINK!', peep: 'PEEP!' }[a.s], x + adx - 10, yb - h - 10); }
      hit(ax - w / 2, yb - h - 2, w, h + 4, () => { a.talk = 0.8; });
    }
  }
  function bridgeBack(s, x) {
    return;
    poly([[x + 24, Y.tr + 2], [x + s.w - 24, Y.tr + 2], [x + s.w / 2 + 14, Y.hz + 2], [x + s.w / 2 - 14, Y.hz + 2]].map(([a, b]) => [sxw(a), b]), '#6ab8ee');
    for (let y = Y.hz + 6; y < Y.tr; y += 5) { const k = (y - Y.hz) / (Y.tr - Y.hz); R(sxw(x + s.w / 2 - 6 + Math.sin(y + T * 2) * 3 * k), y, 4, 1, '#bfe6ff'); }
  }
  function bridgeFront(s, x) {
    const a = x + 16, b = x + s.w - 16, y0 = Y.tr + 5, y1 = Y.dashY;
    R(sxw(a), y0, b - a, y1 - y0, '#4aa8e8');
    for (let y = y0 + 6; y < y1; y += 6) for (let xx = a + ((y * 7) % 13); xx < b - 6; xx += 22) R(sxw(xx + Math.round(Math.sin(T * 2 + y) * 2)), y, 6, 1, '#8fd0f8');
    // ducks and a little sailboat on the water
    const wy = Math.round(y0 + Math.min(Y.fg - 8, 14 + Y.fg * 0.35));
    const bx = sxw(a + 20 + ((s.boatX + T * 6) % (b - a - 60)));
    R(bx - 9, wy - 4, 18, 4, '#ffffff'); R(bx - 7, wy, 14, 2, '#e8222b'); R(bx, wy - 20, 1, 16, '#7a4a2a');
    poly([[bx + 1, wy - 19], [bx + 1, wy - 6], [bx + 10, wy - 6]], '#ffd21f'); poly([[bx - 1, wy - 16], [bx - 1, wy - 6], [bx - 7, wy - 6]], '#ffffff');
    hit(bx - 10, wy - 22, 22, 26, () => { SND.play('honk', 1.5); word('TOOT!', bx + st.cam - 8, wy - 30); });
    const dx = sxw(b - 50 - ((T * 4) % 40));
    drawDuck(dx, wy + 2, true, -1); drawDuck(dx + 10, wy + 3, false, -1); drawDuck(dx + 17, wy + 3, false, -1);
    hit(dx - 6, wy - 10, 30, 14, () => { SND.play('peep'); word('QUACK!', dx + st.cam - 6, wy - 16); });
    // a fish jumps now and then
    const fk = (T * 0.4 + s.n * 0.37) % 1;
    if (fk < 0.12) { const k = fk / 0.12, fx = sxw(a + 40 + k * 20), fy = Math.round(wy + 6 - Math.sin(k * Math.PI) * 14); R(fx, fy, 5, 3, '#f57a12'); R(fx - 2, fy, 2, 3, '#f57a12'); R(fx + 4, fy, 1, 1, INK); }
    // stone arches under the track
    const deck = 6;
    R(sxw(x + 8), Y.tr + 1, s.w - 16, deck, '#b8ae9a'); R(sxw(x + 8), Y.tr + 1, s.w - 16, 1, '#d8d0bc');
    const piers = 4, span = (b - a) / piers;
    for (let i = 0; i <= piers; i++) { const px = sxw(a + i * span); R(px - 4, Y.tr + 5, 8, y1 - Y.tr - 5, '#a89c88'); R(px - 4, Y.tr + 5, 2, y1 - Y.tr - 5, '#b8ae9a'); }
    const archH = Math.min(Y.fg - 10, 26);
    for (let i = 0; i < piers; i++) {
      const m = a + (i + 0.5) * span, half = span / 2;
      for (let xx = Math.ceil(a + i * span); xx < a + (i + 1) * span; xx++) {
        const u = (xx - m) / half, th = Math.round(3 + archH * u * u);
        R(sxw(xx), Y.tr + deck, 1, th, '#a89c88');
      }
    }
    for (let xx = x + 8; xx < x + s.w - 8; xx += 6) R(sxw(xx), Y.tr - 6, 1, 5, '#7a7060');
    R(sxw(x + 8), Y.tr - 6, s.w - 16, 1, '#7a7060');
  }
  function pine(x, yb, h) {
    R(x - 1, yb - 4, 3, 4, '#6a4a2a');
    for (let i = 0; i < 3; i++) { const w = 12 - i * 3, y = yb - 4 - i * (h / 4) ; poly([[x - w, y], [x + w + 1, y], [x + 0.5, y - h / 2.2]], i % 2 ? '#2f7a3a' : '#3a8a45'); }
  }
  function forestBack(s, x) {
    const yb = Y.tr - 3;
    for (let i = 0; i < 9; i++) { const tx = sxw(x + 12 + i * 20 + hsh(s.n * 9 + i) * 8); i % 3 === 1 ? drawTree(tx, yb, 9 + Math.floor(hsh(i + s.n) * 4)) : pine(tx, yb, 26 + Math.floor(hsh(i * 3 + s.n) * 12)); }
    // an owl in the big tree
    const ox = sxw(x + 92), oy = yb - 30;
    R(ox - 3, oy - 7, 7, 8, '#8a5a3a'); R(ox - 3, oy - 9, 2, 2, '#8a5a3a'); R(ox + 2, oy - 9, 2, 2, '#8a5a3a');
    R(ox - 2, oy - 6, 2, 2, '#fff6c8'); R(ox + 1, oy - 6, 2, 2, '#fff6c8'); R(ox - 1, oy - 5, 1, 1, INK); R(ox + 2, oy - 5, 1, 1, INK); R(ox, oy - 3, 1, 1, '#f57a12');
    hit(ox - 6, oy - 12, 12, 14, () => { tone('sine', 420, 0, 0.25, 0.06, 380); tone('sine', 420, 0.35, 0.35, 0.06, 360); word('HOOT!', x + 86, oy - 18); });
  }
  function forestFront(s, x) {
    const yb = fgY(Math.round(Y.tr + Math.min(Y.fg - 4, 20 + Y.fg * 0.3)));
    // mushrooms and two bunnies
    for (const mx of [30, 120, 150]) { const px = sxw(x + mx); R(px, yb - 3, 2, 3, '#f4ead8'); R(px - 2, yb - 6, 6, 3, '#e8222b'); R(px - 1, yb - 6, 1, 1, '#ffffff'); R(px + 2, yb - 5, 1, 1, '#ffffff'); }
    for (const [bx, ph] of [[60, 0], [90, 1.7]]) {
      const k = (T * 0.9 + ph) % 2, hop = k < 0.5 ? Math.round(Math.sin(k * 2 * Math.PI) * 6) : 0, px = sxw(x + bx + Math.floor(T * 0.9 + ph) % 3 * 4);
      R(px, yb - 6 - hop, 7, 5, '#e8e2d8'); R(px + 5, yb - 9 - hop, 4, 4, '#e8e2d8'); R(px + 6, yb - 13 - hop, 1, 4, '#e8e2d8'); R(px + 8, yb - 12 - hop, 1, 3, '#e8e2d8');
      R(px + 7, yb - 8 - hop, 1, 1, INK); R(px - 1, yb - 6 - hop, 2, 2, '#ffffff'); R(px + 1, yb - 1 - hop, 2, 1, '#e8e2d8'); R(px + 5, yb - 1 - hop, 2, 1, '#e8e2d8');
      hit(px - 3, yb - 16, 14, 18, () => { tone('sine', 500, 0, 0.12, 0.06, 900); word('BOING!', x + bx - 8, yb - 22); sparkle(px + 4, yb - 10, 5, 4); });
    }
  }
  function mountainH(s, wx) {   // height above the rails at world x
    const u = (wx - s.x) / s.w;
    if (u <= 0 || u >= 1) return 0;
    const top = Y.pr ? 120 : 76;
    return Math.round(top * Math.sin(u * Math.PI) ** 0.8 + 6 * Math.sin(u * 17 + s.n));
  }
  function tunnelBack(s, x) {
    for (let wx = Math.max(x, st.cam - 2); wx < Math.min(x + s.w, st.cam + W + 2); wx += 2) {
      const h = mountainH(s, wx); if (h <= 0) continue;
      const px = sxw(wx);
      R(px, Y.tr + 2 - h, 2, h, '#8a9a6a');
      R(px, Y.tr + 2 - h, 2, Math.min(h, 3), '#6a7a4a');
      if (h > (Y.pr ? 96 : 62)) R(px, Y.tr + 2 - h, 2, Math.min(h, 8 + Math.round(4 * Math.sin(wx * 0.3))), '#f4f7fb');
    }
    // a goat on the slope
    const gx = s.x + s.w * 0.22, gh = mountainH(s, gx);
    const gp = sxw(gx), hop = s.goat > 0 ? Math.round(Math.sin(s.goat * 10) > 0 ? 3 : 0) : 0;
    BOOK.goat(gp, Y.tr + 2 - gh, 1, 1, { mouth: s.goat > 0, hop });
    hit(gp - 12, Y.tr - gh - 20, 24, 22, () => { s.goat = 0.8; SND.play('maa'); word('MAA!', gx - 8, Y.tr - gh - 26); });
  }
  function tunnelFront(s, x) {
    // the mountain face between the two portals hides the train inside
    for (let wx = Math.max(s.pl, st.cam - 2); wx < Math.min(s.pr, st.cam + W + 2); wx += 2) {
      const h = mountainH(s, wx), px = sxw(wx);
      R(px, Y.tr + 6 - h, 2, h, '#9aac76');
      R(px, Y.tr + 6 - h, 2, 3, '#7a8a56');
      if (h > (Y.pr ? 96 : 62)) R(px, Y.tr + 6 - h, 2, Math.min(h, 8 + Math.round(4 * Math.sin(wx * 0.3))), '#ffffff');
      if ((wx >> 1) % 7 === 0) R(px, Y.tr + 18 - h + (wx % 13), 2, 2, '#8a9c66');
    }
    // rocky portals with dark mouths
    for (const [p, d] of [[s.pl, 1], [s.pr, -1]]) {
      const px = sxw(p), top = Y.tr - 44;
      R(px - (d > 0 ? 0 : 3), top, 3, Y.tr - top + 6, '#1d1a2b');
      for (let yy = top - 4; yy < Y.tr + 6; yy += 5) R(px + (d > 0 ? 2 : -9), yy, 7, 4, (yy >> 2) % 2 ? '#b8ae9a' : '#a89c88');
      R(px + (d > 0 ? 2 : -9), top - 8, 7, 5, '#c8bea8');
    }
    // puffs pop out of the top while the train is inside
    if (st.x > s.pl && st.x - LEN < s.pr && st.v > 1 && Math.random() < 0.08) {
      const vx = clamp(st.x - 12, s.pl + 10, s.pr - 10);
      st.smoke.push({ x: vx, y: Y.tr + 2 - mountainH(s, vx), r: 2, vx: -6, vy: -20, life: 1.2, max: 1.2 });
    }
  }
  function townBack(s, x) {
    const yb = Y.tr - 4;
    const HOUSE = [['#f2d16b', '#c8432f'], ['#8fc8f0', '#2a4a8a'], ['#f4b8c8', '#8a2a4a'], ['#c8e6a0', '#5a3a2a']];
    for (let i = 0; i < 3; i++) {
      const hx = sxw(x + 8 + i * 30), [wc, rc] = HOUSE[(i + s.n) % 4], hh = 18 + (i % 2) * 6;
      R(hx, yb - hh, 22, hh, wc); poly([[hx - 3, yb - hh], [hx + 11, yb - hh - 12], [hx + 25, yb - hh]], rc);
      R(hx + 3, yb - hh + 4, 6, 6, GLASS); R(hx + 13, yb - 10, 6, 10, '#7a4a2a');
    }
    // the family's fire station, with the fire truck peeking out
    const fx = sxw(x + 108), fh = Y.pr ? 40 : 34;
    R(fx, yb - fh, 56, fh, '#c8432f'); R(fx - 2, yb - fh - 3, 60, 3, '#8a2a1d'); R(fx + 22, yb - fh - 13, 12, 10, '#c8432f'); R(fx + 20, yb - fh - 15, 16, 2, '#8a2a1d');
    circle(fx + 28, yb - fh - 7, 3, '#ffd21f');
    for (const dx of [4, 30]) { R(fx + dx, yb - 22, 22, 22, '#e8e2d8'); R(fx + dx + 1, yb - 21, 20, 20, '#5a5f6e'); }
    R(fx + 5, yb - 16, 20, 16, '#e8222b'); R(fx + 7, yb - 14, 8, 5, GLASS); R(fx + 5, yb - 18, 20, 2, '#cfd6dd'); circle(fx + 10, yb - 2, 2, IRON); circle(fx + 21, yb - 2, 2, IRON);
    R(fx + 31, yb - 21, 20, 6, '#cfd6dd'); for (let k = 0; k < 5; k++) R(fx + 31, yb - 14 + k * 3, 20, 1, '#7a8090');
    // the ice cream truck down the street
    const ix = sxw(x + 186);
    if (SCENES.movieIce && SCENES.movieIce.cover && ix > -90 && ix < W + 10) SCENES.movieIce.cover(ix, yb + 2);
  }
  function townFront(s, x) {
    const yb = fgY(Math.round(Y.tr + Math.min(Y.fg - 2, 24 + Y.fg * 0.35)));
    R(sxw(x + 20), yb - 9, s.w - 40, 1, '#f4ead8');
    for (let xx = x + 20; xx < x + s.w - 20; xx += 8) R(sxw(xx), yb - 11, 2, 11, '#f4ead8');
    for (const kd of s.kids) {
      const px = sxw(x + kd.dx);
      drawPerson({ type: kd.type, x: px, yb, dir: 1, pose: kd.hop > 0 ? 'cheer' : 'wave', skin: kd.skin, seed: kd.dx, hop: Math.round(kd.hop * 4) });
      hit(px - 8, yb - 22, 16, 24, () => { kd.hop = 1; SND.play('pop'); sparkle(px, yb - 20, 6, 5); });
    }
    // the dogs and the cat came out to watch
    const D = SCENES.icecream && SCENES.icecream._dogs;
    const vx = sxw(x + 104), hx = sxw(x + 132), cx = sxw(x + 200);
    if (D) { D.vizsla(vx, yb, 1, { wag: true, pant: true, hop: s.vh || 0 }); D.husky(hx, yb, -1, { wag: true, pant: true, hop: s.hh || 0 }); }
    PETS.catSit(cx, yb, { swish: true, hop: s.ch || 0 });
    hit(vx - 12, yb - 16, 24, 18, () => { SND.play('bark'); word('WOOF!', x + 96, yb - 24); s.vh = 3; setTimeout(() => { s.vh = 0; }, 250); });
    hit(hx - 12, yb - 20, 24, 22, () => { SND.play('bark2'); word('WOOF!', x + 124, yb - 28); s.hh = 3; setTimeout(() => { s.hh = 0; }, 250); });
    hit(cx - 8, yb - 18, 16, 20, () => { SND.play('meow'); word('MEOW!', x + 192, yb - 26); s.ch = 3; setTimeout(() => { s.ch = 0; }, 250); });
  }
  function meadowBack(s, x) {
    const yb = Y.tr - 4, mx = sxw(x + 60), mh = Y.pr ? 40 : 30;
    // a windmill
    poly([[mx - 7, yb], [mx + 7, yb], [mx + 4, yb - mh], [mx - 4, yb - mh]], '#f4ead8');
    poly([[mx - 6, yb - mh], [mx + 6, yb - mh], [mx, yb - mh - 7]], '#c8432f');
    R(mx - 2, yb - 8, 4, 8, '#7a4a2a');
    const a = T * (0.8 + (s.spin || 0) * 6), hy = yb - mh + 2;
    for (let k = 0; k < 4; k++) { const b = a + k * Math.PI / 2; bar(mx, hy, mx + Math.cos(b) * 18, hy + Math.sin(b) * 18, 3, '#ffffff'); }
    circle(mx, hy, 2, '#7a4a2a');
    hit(mx - 18, hy - 18, 36, 36, () => { s.spin = 1.5; SND.play('chime'); sparkle(mx, hy, 14, 8); });
    // a hot air balloon drifting high
    const bx = sxw(x + 130) + Math.round(Math.sin(T * 0.3 + s.n) * 10), by = Math.round(L.safeT + (Y.pr ? 70 : 24) + Math.sin(T * 0.5) * 4);
    circle(bx, by, 9, '#e8222b'); R(bx - 3, by - 9, 6, 18, '#ffd21f'); R(bx - 9, by - 2, 18, 3, '#2a6fe0');
    R(bx - 6, by + 7, 1, 6, IRON); R(bx + 5, by + 7, 1, 6, IRON); R(bx - 4, by + 13, 8, 5, '#a8743f');
  }
  function meadowFront(s, x) {
    const yb = fgY(Math.round(Y.tr + Math.min(Y.fg - 3, 22 + Y.fg * 0.3)));
    for (let i = 0; i < 7; i++) { const fx = sxw(x + 20 + i * 22); R(fx, yb - 10, 1, 10, '#3f9a45'); circle(fx, yb - 12, 3, '#ffd21f'); R(fx, yb - 12, 1, 1, '#7a4a2a'); }
    // a kid with a kite
    const kx = sxw(x + 110);
    drawPerson({ type: 'kid', x: kx, yb, dir: -1, pose: 'wave', skin: SKIN[1], seed: 3 });
    const kkx = kx - 30 + Math.round(Math.sin(T) * 4), kky = yb - 44 + Math.round(Math.cos(T * 1.3) * 3);
    for (let i = 0; i < 10; i++) R(Math.round(lerp(kx - 4, kkx, i / 10)), Math.round(lerp(yb - 16, kky + 6, i / 10)), 1, 1, '#ffffff');
    poly([[kkx, kky - 6], [kkx + 5, kky], [kkx, kky + 6], [kkx - 5, kky]], '#ff6fb4'); R(kkx, kky - 6, 1, 12, '#ffffff');
  }

  /* ---------- the country road alongside (tall screens) ---------- */
  const CARKINDS = [VI.fire, VI.police, VI.amb];
  function newCar(k) {
    const right = Math.random() < 0.6;
    return { i: CARKINDS[(st.carN = (st.carN || 0) + 1) % 3], dir: right ? 1 : -1, x: right ? st.cam - 70 - k * 60 : st.cam + W + 10 + k * 60, v: right ? 46 + Math.random() * 30 : 34 + Math.random() * 20, hop: 0 };
  }
  function updateCars(dt) {
    if (!Y.road) { st.cars = []; return; }
    while (st.cars.length < 2) st.cars.push(newCar(st.cars.length));
    for (const c of st.cars) {
      c.x += c.dir * c.v * dt; c.hop = Math.max(0, c.hop - dt * 3);
      if (c.x < st.cam - 90 || c.x > st.cam + W + 90) {
        Object.assign(c, newCar(0));
        for (const o of st.cars) if (o !== c && Math.abs(o.x - c.x) < 90) c.x += c.dir * -100;
      }
    }
    // a faster truck waits behind a slower one instead of driving through it
    for (const c of st.cars) for (const o of st.cars) if (o !== c && o.dir === c.dir && (o.x - c.x) * c.dir > 0 && (o.x - c.x) * c.dir < 74) c.v = Math.min(c.v, o.v);
  }
  function nearDecor() {   // bushes and flowers along the bottom, between the road and the dashboard
    const y0 = Y.road + 6, y1 = Y.dashY;
    if (y1 - y0 < 14) return;
    const c0 = Math.floor(st.cam / 28) - 1;
    for (let c = c0; c < c0 + Math.ceil(W / 28) + 3; c++) {
      const wx = c * 28 + Math.floor(hsh(c) * 14), seg = st.segs.find(s => wx >= s.x && wx < s.x + s.w);
      if (seg && (seg.kind === 'bridge' || (seg.kind === 'crossing' && Math.abs(wx - seg.cx) < 26))) continue;
      const x = sxw(wx), y = Math.round(lerp(y0 + 8, y1 - 4, hsh(c * 3.1)));
      const r = hsh(c * 5.7);
      if (r < 0.35) { circle(x, y - 5, 6, '#3f9a45'); circle(x - 5, y - 3, 4, '#3f9a45'); circle(x + 5, y - 3, 4, '#3f9a45'); circle(x - 1, y - 7, 3, '#5bb85a'); if (r < 0.15) { R(x - 3, y - 7, 2, 2, '#e8222b'); R(x + 2, y - 4, 2, 2, '#e8222b'); } }
      else if (r < 0.7) for (let k = 0; k < 3; k++) { const fx = x + k * 5 - 5; R(fx, y - 6 + k % 2, 1, 6, '#3f9a45'); R(fx - 1, y - 8 + k % 2, 3, 3, ['#ffd21f', '#ff6fb4', '#ffffff', '#8a4fd9'][(c + k) & 3]); R(fx, y - 7 + k % 2, 1, 1, '#f57a12'); }
      else if (r < 0.8) { R(x - 1, y - 4, 2, 4, '#f4ead8'); R(x - 3, y - 6, 6, 2, '#e8222b'); R(x - 2, y - 6, 1, 1, '#ffffff'); }
      else { R(x - 4, y - 3, 9, 3, '#a8a090'); R(x - 3, y - 4, 7, 1, '#c4bdaf'); }
    }
  }
  function drawRoad() {
    if (!Y.road) return;
    nearDecor();
    const y = Y.road;
    R(0, y - 12, W, 14, '#5b5f6b'); R(0, y - 13, W, 1, '#cfc6b4'); R(0, y + 2, W, 1, '#cfc6b4');
    for (let x = -(Math.floor(st.cam) % 16); x < W; x += 16) R(x, y - 6, 8, 1, '#ffd21f');
    for (const s of st.segs) if (s.kind === 'bridge' && visible(s)) for (const ry of [y - 14, y + 2]) { R(sxw(s.x + 16), ry - 3, s.w - 32, 1, '#a8743f'); for (let xx = s.x + 16; xx < s.x + s.w - 16; xx += 8) R(sxw(xx), ry - 3, 1, 4, '#a8743f'); }
    for (const c of [...st.cars].sort((a, b) => a.dir - b.dir)) {
      const sx = sxw(c.x), hop = Math.round(c.hop * 3) + (c.dir < 0 ? 5 : 0);
      g.save();
      if (c.dir < 0) { g.translate(2 * sx + 64, 0); g.scale(-1, 1); }
      drawV(c.i, sx, y - 2 - hop, true, 0, c.x / 4, true);
      g.restore();
      hit(sx, y - 40, 64, 40, () => { c.hop = 1; siren(); word('WEE-OO!', c.x + 8, y - 48, '#ff6b5e'); });
    }
  }

  const BACK = { station: stationBack, crossing: crossingBack, farm: farmBack, bridge: bridgeBack, forest: forestBack, tunnel: tunnelBack, town: townBack, meadow: meadowBack };
  const FRONT = { station: stationFront, crossing: crossingFront, farm: farmFront, bridge: bridgeFront, forest: forestFront, tunnel: tunnelFront, town: townFront, meadow: meadowFront };
  const visible = s => sxw(s.x + s.w) > -60 && sxw(s.x) < W + 60;

  function drawWorld() {
    st.hits = [];
    for (const s of st.segs) s.lights = [];
    backdrop();
    for (const s of st.segs) if (visible(s)) BACK[s.kind](s, s.x);
    // rails everywhere but the bridges (they have their own deck)
    let x0 = 0;
    for (const s of st.segs) if (s.kind === 'bridge' && visible(s)) { track(x0, sxw(s.x + 8)); bridgeTrack(sxw(s.x + 8), sxw(s.x + s.w - 8)); x0 = sxw(s.x + s.w - 8); }
    track(x0, W);
    for (const s of st.segs) if (s.kind === 'bridge' && visible(s)) FRONT.bridge(s, s.x);
    drawTrain();
    drawSmoke();
    for (const s of st.segs) if (s.kind !== 'bridge' && visible(s)) FRONT[s.kind](s, s.x);
    drawRoad();
    drawWalkers();
  }
  function drawLit() {
    const k = nightK();
    if (k > 0.05) {
      // the headlight, the windows and the crossing lights glow at night
      const hx = sxw(carLeft(0) + 50), hy = Y.tr - 31;
      alpha(0.35 * k, () => { for (let i = 0; i < 40; i++) R(hx + i, hy - 2 - i * 0.25, 1, 5 + i * 0.5, '#fff3a6'); });
      alpha(0.9 * k, () => R(hx - 3, hy - 1, 3, 2, '#fff3a6'));
      for (let i = 0; i < SEATS; i++) { const wx = sxw(seatX(i)) - 5, wy = Y.tr - 26; alpha(0.28 * k, () => R(wx, wy, 10, 9, '#ffd36a')); }
      for (const s of st.segs) for (const [lx, ly, on] of s.lights || []) if (on) alpha(0.5 * k, () => circle(lx, ly, 3, '#ff6b5e'));
    }
    for (const s of st.segs) for (const [lx, ly, on] of s.lights || []) if (on) R(lx, ly, 1, 1, '#ffd0d0');
    drawParticles();
  }

  /* ---------- the dashboard ---------- */
  function whistleIcon(cx, cy, s) {
    const u = Math.max(1, Math.round(s / 14));
    R(cx - 2 * u, cy - 3 * u, 4 * u, 8 * u, '#e0b010'); R(cx - u, cy - 3 * u, u, 8 * u, '#fff3a6');
    R(cx - 3 * u, cy - 4 * u, 6 * u, u, '#c99410'); R(cx - u, cy + 5 * u, 2 * u, 2 * u, '#8a6a20');
    const on = st.whistleT > 0;
    for (let i = 0; i < 3; i++) circle(cx + (i - 1) * 3 * u, cy - (6 + i % 2) * u - (on ? Math.floor(T * 8 % 2) * u : 0), Math.max(1, (on ? 2 : 1) * u), '#ffffff');
  }
  function bellIcon(cx, cy, s) {
    const u = Math.max(1, Math.round(s / 14)), sw = st.bellT > 0 ? Math.round(Math.sin(T * 20) * u) : 0;
    R(cx - u + sw, cy - 6 * u, 2 * u, 2 * u, '#8a6a20');
    for (let i = 0; i < 8; i++) { const w = 4 + Math.round(i * 0.9); R(cx - w * u / 2 + sw, cy - 4 * u + i * u, w * u, u, i < 2 ? '#fff3a6' : '#ffd21f'); }
    R(cx - 6 * u + sw, cy + 4 * u, 12 * u, u, '#c99410'); R(cx - u + sw, cy + 5 * u, 2 * u, 2 * u, '#8a6a20');
  }
  function paintIcon(cx, cy, s) {
    const u = Math.max(1, Math.round(s / 14)), c = COLORS[(st.ci + 1) % COLORS.length];
    R(cx - 5 * u, cy - u, 10 * u, 6 * u, '#cfd6dd'); R(cx - 4 * u, cy - 2 * u, 8 * u, 2 * u, c.main);
    R(cx - 5 * u, cy - u, 10 * u, u, c.main); R(cx + 2 * u, cy - 6 * u, 2 * u, 5 * u, c.main); circle(cx + 3 * u, cy - 6 * u, u, c.light);
  }
  function drawPedal() {
    const p = Y.pedal, down = st.hold.size > 0, idle = st.mode === 'run' && !down && st.idle > 1.5;
    const pulse = idle ? Math.round((Math.sin(T * 5) + 1) * 1.2) : 0, off = st.mode !== 'run';
    const x = p.x - pulse, y = p.y + (down ? 3 : 0) - pulse, w = p.w + 2 * pulse, h = p.h - (down ? 3 : 0) + 2 * pulse;
    if (!down) R(x + 2, y + h, w - 4, 3, '#16171f');
    R(x + 2, y - 2, w - 4, h + 4, '#ffffff'); R(x - 2, y + 2, w + 4, h - 4, '#ffffff'); R(x, y, w, h, '#ffffff');
    const gc = off ? '#8fb08a' : down ? '#2f9a2c' : '#3fb43a';
    R(x + 2, y, w - 4, h, gc); R(x, y + 2, w, h - 4, gc);
    R(x + 2, y + h - 3, w - 4, 3, off ? '#6a8a66' : '#1f7a2a'); R(x + 3, y + 1, w - 6, 2, off ? '#b0ccaa' : '#8fe36b');
    if (w > 70) for (let yy = y + 6; yy < y + h - 6; yy += 5) { R(x + 6, yy, 8, 2, '#1f7a2a'); R(x + w - 14, yy, 8, 2, '#1f7a2a'); }
    drawArrowIcon(x + w / 2, y + h / 2 - 1, Math.min(h, 36));
    if (idle && st.idle > 2) TOY.arrow(Math.round(p.x + p.w / 2), p.y - 4);
  }
  function drawUI() {
    // floating words
    for (const w of st.words) {
      const s = 2, tw = textWidth(w.s, s), x = clamp(Math.round(w.x - st.cam), L.safeL + 2, W - L.safeR - tw - 2);
      alpha(Math.min(1, w.life * 2), () => outlined(w.s, x, Math.round(Math.max(L.safeT + 4, w.y)), s, w.c));
    }
    const y = Y.dashY;
    R(0, y, W, H - y, '#5a3a2a'); R(0, y, W, 3, '#8a5a3a'); R(0, y + 3, W, 1, '#3a2418');
    for (let x = -(Math.floor(st.cam) % 12); x < W; x += 12) R(x, y + 5, 1, H - y - 5, '#4e3222');
    drawHomeButton(Y.home);
    const wb = Y.whistle, wp = st.whistleT > 1.2 ? 2 : 0;
    button({ x: wb.x, y: wb.y + wp, s: wb.s }, '#2a6fe0', '#1a3f9a'); whistleIcon(wb.x + wb.s / 2, wb.y + wb.s / 2 + wp + 1, wb.s);
    const bb = Y.bell, bp = st.bellT > 0.5 ? 2 : 0;
    button({ x: bb.x, y: bb.y + bp, s: bb.s }, '#e8222b', '#a3121d'); bellIcon(bb.x + bb.s / 2, bb.y + bb.s / 2 + bp, bb.s);
    const pb = Y.paint;
    button(pb, '#ffffff', '#cfd6dd'); paintIcon(pb.x + pb.s / 2, pb.y + pb.s / 2 + 1, pb.s);
    drawPedal();
  }

  function tap(x, y, id) {
    if (y >= Y.dashY - 4) {
      if (inBox(Y.home, x, y)) { SFX.boop(); goScene('station'); return true; }
      if (inBox(Y.whistle, x, y)) { blow(); return true; }
      if (inBox(Y.bell, x, y)) { ring(); return true; }
      if (inBox(Y.paint, x, y)) { repaint(); return true; }
      const p = Y.pedal;
      if (x >= p.x - 6 && x < p.x + p.w + 6) { st.hold.add(id); if (st.mode === 'run' && st.v < 1) { SND.play('hiss'); } return true; }
      return true;
    }
    for (let i = st.hits.length - 1; i >= 0; i--) { const h = st.hits[i]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.fn(); return true; } }
    return false;
  }

  SCENES.train = {
    view: (w, h) => h > w ? [196, 250] : [260, 150],
    freeTouch: true,
    layout,
    groundY: () => Y.hz,
    enter() { layout(); reset(); SND.load(); SND.music(true); },
    leave() { SND.music(false); chugLoop(0, 1); st.hold.clear(); },
    update,
    drawWorld, drawLit, drawUI,
    tap,
    release(id) { st.hold.delete(id); },
    // a little picture for the game picker: the engine and its coal tender
    card(x, yb) {
      const keep = { x: st.x, cam: st.cam };
      st.cam = 0; st.x = x + 52 + 24 + GAP;
      const C = COLORS[0];
      tender(x, yb, C); engine(x + 24 + GAP, yb, C);
      Object.assign(st, keep);
    },
    _st: st,
  };
})();
