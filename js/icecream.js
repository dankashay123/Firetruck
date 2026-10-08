// "Ice Cream Truck": a close-up of the ice cream truck at the park. People (and sometimes the
// family's two dogs) line up at the window; each one dreams of an ice cream, and a tap anywhere
// hands it over. Ten different treats, never the same twice in a row. The dogs play in the park,
// and a tap on a dog makes it bark. Music: "Childhood Flavors" (CC0) from OpenGameArt.
'use strict';
(() => {
  const A = BOOK, pen = A.pen;
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const eout = k => 1 - (1 - k) ** 3;

  /* ---------- the ten treats (bottom center at x, yb; about 9 x 16) ---------- */
  const CONE = '#d9a35a', CONE2 = '#b07a34';
  function cone(P) { for (let r = 0; r < 7; r++) P(1 + (r >> 1), -7 + r, 7 - (r >> 1) * 2, 1, r % 2 ? CONE2 : CONE); P(3, -7, 1, 5, CONE2); P(5, -7, 1, 5, CONE2); }
  function scoop(P, y, c, c2, hi) { P(1, y - 4, 7, 4, c); P(2, y - 5, 5, 1, c); P(0, y - 1, 9, 2, c); P(2, y - 4, 2, 1, hi || '#ffffff'); P(1, y, 2, 1, c2); P(4, y + 1, 2, 1, c2); P(7, y, 1, 1, c2); }
  const TREATS = [
    { name: 'strawberry', draw: P => { cone(P); scoop(P, -8, '#ff8fb8', '#e8608f'); } },
    { name: 'chocolate', draw: P => { cone(P); scoop(P, -8, '#8a5230', '#6a3a1e', '#b07a50'); } },
    { name: 'sprinkles', draw: P => { cone(P); scoop(P, -8, '#fff6e0', '#e8dcc0'); for (const [x, y, c] of [[2, -12, '#e8222b'], [5, -11, '#2a6fe0'], [6, -13, '#3fb43a'], [3, -10, '#ffd21f'], [7, -10, '#ff6fb4']]) P(x, y, 1, 1, c); } },
    { name: 'mint', draw: P => { cone(P); scoop(P, -8, '#9ef0c8', '#6ad4a4'); for (const [x, y] of [[2, -11], [5, -12], [6, -10], [3, -9]]) P(x, y, 1, 1, '#4a2a1a'); } },
    { name: 'double', draw: P => { cone(P); scoop(P, -8, '#ff8fb8', '#e8608f'); scoop(P, -13, '#7ad0ff', '#4aa8e8'); P(4, -19, 2, 2, '#e8222b'); P(5, -20, 1, 1, '#3a8a2e'); } },
    { name: 'rainbow pop', draw: P => { P(4, -4, 1, 4, '#d9b98a'); ['#e8222b', '#f57a12', '#ffd21f', '#3fb43a', '#2a6fe0', '#8a4fd9'].forEach((c, i) => P(1, -16 + i * 2, 7, 2, c)); P(2, -17, 5, 1, '#e8222b'); } },
    { name: 'rocket pop', draw: P => { P(4, -4, 1, 4, '#d9b98a'); P(1, -8, 7, 4, '#2a6fe0'); P(1, -12, 7, 4, '#ffffff'); P(2, -15, 5, 3, '#e8222b'); P(3, -17, 3, 2, '#e8222b'); P(4, -18, 1, 1, '#e8222b'); P(2, -11, 1, 2, '#e8ecef'); } },
    { name: 'orange cream', draw: P => { P(4, -4, 1, 4, '#d9b98a'); P(1, -16, 7, 12, '#ff9a3a'); P(2, -17, 5, 1, '#ff9a3a'); P(3, -14, 3, 8, '#fff2d8'); P(1, -16, 1, 12, '#f57a12'); } },
    { name: 'grape swirl', draw: P => { P(1, -5, 7, 5, '#ffffff'); P(1, -5, 7, 1, '#ff6fb4'); P(2, -1, 5, 1, '#e8dcf0'); P(0, -8, 9, 3, '#b48ae8'); P(1, -11, 7, 3, '#c9a4f2'); P(2, -13, 5, 2, '#b48ae8'); P(3, -15, 3, 2, '#c9a4f2'); P(4, -16, 1, 1, '#b48ae8'); P(2, -10, 2, 1, '#e8dcff'); } },
    { name: 'sandwich', draw: P => { P(0, -8, 9, 3, '#5a3418'); P(0, -5, 9, 2, '#fff6e0'); P(0, -3, 9, 3, '#5a3418'); P(1, -7, 1, 1, '#3a2010'); P(4, -7, 1, 1, '#3a2010'); P(7, -7, 1, 1, '#3a2010'); P(2, -2, 1, 1, '#3a2010'); P(6, -2, 1, 1, '#3a2010'); } },
  ];
  const PUP = { name: 'pup cup', draw: P => { P(1, -5, 7, 5, '#ffd21f'); P(1, -5, 7, 1, '#e8b010'); P(0, -8, 9, 3, '#f6ead0'); P(1, -10, 7, 2, '#f6ead0'); P(3, -11, 3, 1, '#f6ead0'); P(1, -8, 2, 1, '#ffffff'); P(2, -10, 2, 1, '#ffffff'); P(2, -13, 5, 2, '#d9a35a'); P(1, -14, 2, 2, '#d9a35a'); P(6, -14, 2, 2, '#d9a35a'); } };
  // small menu-board versions of the ten treats, 6 wide and about 11 tall
  const mcone = P => { P(1, -5, 4, 1, CONE); P(1, -4, 4, 1, CONE2); P(2, -3, 2, 1, CONE); P(2, -2, 2, 1, CONE2); P(2, -1, 2, 1, CONE); };
  const mscoop = (P, y, c, c2) => { P(1, y - 3, 4, 1, c); P(0, y - 2, 6, 2, c); P(1, y - 3, 1, 1, '#ffffff'); P(0, y, 6, 1, c2); };
  const MINI = [
    P => { mcone(P); mscoop(P, -6, '#ff8fb8', '#e8608f'); },
    P => { mcone(P); mscoop(P, -6, '#8a5230', '#6a3a1e'); },
    P => { mcone(P); mscoop(P, -6, '#fff6e0', '#e8dcc0'); P(1, -8, 1, 1, '#e8222b'); P(3, -7, 1, 1, '#2a6fe0'); P(4, -8, 1, 1, '#3fb43a'); },
    P => { mcone(P); mscoop(P, -6, '#9ef0c8', '#6ad4a4'); P(1, -7, 1, 1, '#4a2a1a'); P(4, -8, 1, 1, '#4a2a1a'); },
    P => { mcone(P); mscoop(P, -6, '#ff8fb8', '#e8608f'); mscoop(P, -9, '#7ad0ff', '#4aa8e8'); P(2, -13, 2, 1, '#e8222b'); },
    P => { P(2, -2, 2, 2, '#d9b98a'); ['#e8222b', '#f57a12', '#ffd21f', '#3fb43a', '#2a6fe0'].forEach((c, i) => P(1, -12 + i * 2, 4, 2, c)); },
    P => { P(2, -2, 2, 2, '#d9b98a'); P(1, -5, 4, 3, '#2a6fe0'); P(1, -8, 4, 3, '#ffffff'); P(1, -10, 4, 2, '#e8222b'); P(2, -11, 2, 1, '#e8222b'); },
    P => { P(2, -2, 2, 2, '#d9b98a'); P(1, -11, 4, 9, '#ff9a3a'); P(1, -11, 1, 9, '#f57a12'); P(3, -10, 1, 6, '#fff2d8'); P(2, -10, 1, 1, '#ffffff'); },
    P => { P(1, -3, 4, 3, '#ffffff'); P(1, -3, 4, 1, '#ff6fb4'); P(0, -6, 6, 3, '#b48ae8'); P(1, -8, 4, 2, '#c9a4f2'); P(2, -9, 2, 1, '#b48ae8'); },
    P => { P(0, -6, 6, 2, '#5a3418'); P(0, -4, 6, 2, '#fff6e0'); P(0, -2, 6, 2, '#5a3418'); P(1, -6, 1, 1, '#3a2010'); P(4, -1, 1, 1, '#3a2010'); },
  ];
  function miniTreat(i, x, yb) { MINI[i](pen(Math.round(x), Math.round(yb), 6, 1, 1)); }
  // draw a treat with its bottom center at (x, yb), at an integer scale k
  function treat(t, x, yb, k = 1) {
    g.save(); g.translate(Math.round(x), Math.round(yb)); g.scale(k, k);
    t.draw(pen(0, 0, 9, 1, 1));
    g.restore();
  }

  /* ---------- the two dogs, little park-sized versions (about 20 x 14) ---------- */
  function vizslaS(x, yb, dir = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0), 20, dir), V1 = '#b4542a', V3 = '#8a3a1a', EAR = '#94401e';
    const st = o.run ? Math.floor(T * 12) % 2 : 0, wg = o.wag ? Math.floor(T * 10) % 2 : 0;
    P(5 - st, -5, 1, 5, V3); P(13 + st, -5, 1, 5, V3);
    P(1, -9 - wg, 3, 1, V1);
    P(3, -9, 11, 4, V1); P(11, -9, 4, 5, V1); P(4, -5, 2, 1, V1);
    P(6 + st, -5, 1, 5, V1); P(14 - st, -5, 1, 5, V1); P(6 + st, -1, 2, 1, V3); P(14 - st, -1, 2, 1, V3);
    P(13, -12, 2, 3, V1); P(13, -10, 2, 1, '#3d4a3a');
    P(14, -14, 4, 3, V1); P(17, -13, 3, 2, V1); P(19, -13, 1, 1, '#b86f62');
    P(16, -14, 1, 1, '#22222a'); P(14, -13, 2, 4, EAR);
    if (o.bark) P(18, -11, 2, 1, '#5a1a10');
    if (o.lick) P(19, -11, 1, 2, '#e8708a');
  }
  function huskyS(x, yb, dir = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0), 20, dir), H1 = '#f6f6f2', H3 = '#cfd4de', OL = '#9aa2b2';
    const st = o.run ? Math.floor(T * 12) % 2 : 0, wg = o.wag ? Math.floor(T * 10) % 2 : 0;
    P(4 - st, -5, 2, 5, H3); P(13 + st, -5, 2, 5, H3);
    P(0, -14 - wg, 3, 3, H1); P(-1, -13 - wg, 2, 3, H1); P(1, -11 - wg, 3, 2, H3);   // curled tail
    P(2, -10, 13, 5, H1); P(2, -10, 13, 1, OL); P(3, -5, 11, 1, H3);
    P(12, -12, 4, 7, H1);   // ruff
    P(5 + st, -5, 2, 5, H1); P(14 - st, -5, 2, 5, H1); P(5 + st, -1, 2, 1, OL); P(14 - st, -1, 2, 1, OL);
    P(14, -15, 4, 4, H1); P(17, -13, 3, 2, H1); P(19, -13, 1, 1, '#22222a');
    P(14, -17, 1, 2, H1); P(16, -17, 1, 2, H1); P(14, -18, 1, 1, OL); P(16, -18, 1, 1, OL); P(16, -16, 1, 1, '#f2a8a0');
    P(16, -14, 1, 1, '#6aaee8');
    P(13, -15, 1, 4, OL); P(17, -11, 3, 1, OL);
    if (o.bark) P(18, -11, 2, 1, '#5a3040');
    if (o.pant || o.lick) P(18, -11, 1, 2, '#e8708a');
  }
  const DOGDRAW = { vizsla: vizslaS, husky: huskyS };

  /* ---------- sounds ---------- */
  const FILES = { bell: ['ic-bell', 0.5], pop: ['ic-pop', 0.7], yum: ['ic-yum', 0.6], bark: ['dog-bark', 0.6], bark2: ['dog-bark-2', 0.55] };
  const bufs = {}, music = { buf: null, src: null, gain: null };
  let loaded = false;
  function loadAudio() {
    if (loaded || !ac) return;
    loaded = true;
    const get = n => fetch('audio/' + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab && ac.decodeAudioData(ab)).catch(() => null);
    for (const [k, [n]] of Object.entries(FILES)) get(n).then(b => { if (b) bufs[k] = b; });
    get('ic-music').then(b => { if (b) { music.buf = b; if (scene === 'icecream') startMusic(); } });
  }
  const SYNTH = {
    bell() { tone('sine', 1568, 0, 0.6, 0.08); tone('sine', 2093, 0.02, 0.5, 0.05); },
    pop() { tone('sine', 500, 0, 0.08, 0.1, 900); },
    yum() { [659, 784, 988].forEach((f, i) => tone('sine', f, i * 0.07, 0.15, 0.07)); },
    bark() { tone('square', 330, 0, 0.09, 0.08, 220); }, bark2() { tone('square', 300, 0, 0.09, 0.08, 200); },
  };
  function play(k, rate = 1) {
    const b = bufs[k];
    if (!b) { if (SYNTH[k]) SYNTH[k](); return; }
    const src = ac.createBufferSource(), gn = ac.createGain();
    src.buffer = b; src.playbackRate.value = rate * (0.96 + Math.random() * 0.08); gn.gain.value = FILES[k][1];
    src.connect(gn); gn.connect(master); src.start();
  }
  function startMusic() {
    if (!music.buf || music.src || !ac) return;
    const src = ac.createBufferSource(), gn = ac.createGain();
    src.buffer = music.buf; src.loop = true; gn.gain.value = 0.26;
    src.connect(gn); gn.connect(master); src.start();
    music.src = src; music.gain = gn;
  }
  function stopMusic() { if (music.src) { try { music.src.stop(); } catch (e) {} music.src = null; } }

  /* ---------- layout ---------- */
  const Y = {};
  function layout() {
    const roomy = H - L.safeT - L.safeB >= 150;
    Y.coneK = roomy ? 2 : 1;                               // the cone on the roof shrinks when space is tight
    Y.yG = Math.round(roomy ? Math.min(H - L.safeB - 36, Math.max(L.safeT + 112, H * 0.6)) : H - L.safeB - 9);   // where customers stand
    Y.tyb = Y.yG - 7;                     // the truck's wheels
    Y.TW = 110;
    Y.tx = Math.round(Math.max(L.safeL + 1, Math.min(W * 0.42 - 60, L.cx - Y.TW / 2 - 14)));
    Y.top = Y.tyb - 60;                   // roof of the truck
    Y.wx = Y.tx + 70;                     // middle of the serving window
    Y.hz = Y.top + 24;                    // where the far grass meets the sky
    Y.lawn = Y.yG + 6;
    Y.big = H - L.safeB - Y.lawn > 50;     // room for the dogs to play in front (drawn bigger: they're closer)
    Y.home = { x: L.safeL + 4, y: H - L.safeB - L.blob - 4, s: L.blob };
    Y.kitchen = { x: L.safeL + 4, y: L.safeT + 4, s: L.blob };   // into the kitchen to make your own
  }

  /* ---------- state ---------- */
  const PEOPLE = ['kid', 'kid2', 'kid3', 'mom', 'dad', 'gran', 'kid', 'kid2', 'ff', 'cop', 'medic', 'kid3'];
  const st = { q: [], leaving: [], fly: null, served: 0, spawnT: 0, last: -1, n: 0, vendor: 0, bell: 0, dogTurn: 0, ball: { x: 0, vx: 30, h: 0, vh: 0 } };
  const dogs = { vizsla: { x: 40, dir: 1, hop: 0, bark: 0, away: false }, husky: { x: 70, dir: -1, hop: 0, bark: 0, away: false } };
  const slotX = i => Y.wx + 2 + i * 17;
  function pickTreat() {
    let i; do i = Math.floor(Math.random() * TREATS.length); while (i === st.last);
    st.last = i; return i;
  }
  function spawn() {
    st.n++;
    let c;
    const dogName = st.n % 5 === 0 ? (st.dogTurn++ % 2 ? 'husky' : 'vizsla') : null;
    if (dogName && !dogs[dogName].away) { dogs[dogName].away = true; c = { dog: dogName, want: -1 }; }
    else c = { type: PEOPLE[Math.floor(Math.random() * PEOPLE.length)], skin: SKIN[Math.floor(Math.random() * 4)], seed: Math.random() * 9, want: pickTreat() };
    Object.assign(c, { x: W + 16 + st.q.length * 17, state: 'come', t: 0, hop: 0 });
    st.q.push(c);
  }
  function front() { const c = st.q[0]; return c && c.state === 'wait' && Math.abs(c.x - slotX(0)) < 1 ? c : null; }
  function serve() {
    const c = front();
    if (!c || st.fly) {   // nobody at the window yet: ring the bell and wave them over
      if (!st.fly && st.bell <= 0) { play('bell'); st.bell = 0.9; st.vendor = 1; for (const q of st.q) q.hurry = 1; }
      return;
    }
    c.state = 'getting';
    const t = c.dog ? PUP : TREATS[c.want];
    st.fly = { c, t, k: 0, x0: Y.wx, y0: Y.top + 30, x1: handX(c), y1: handY(c) };
    st.vendor = 0.6;
    play('pop');
  }
  const handX = c => c.dog ? c.x - 10 : c.x - 7;
  const handY = c => c.dog ? Y.yG - 2 : Y.yG + 2 - personH(c.type) + 12;

  function update(dt) {
    st.vendor = Math.max(0, st.vendor - dt); st.bell = Math.max(0, st.bell - dt);
    // the queue shuffles up to the window
    st.q.forEach((c, i) => {
      c.t += dt; c.hop = Math.max(0, c.hop - dt * 20);
      const tx = slotX(i), sp = c.hurry ? 60 : 34;
      if (c.state === 'come' || c.state === 'wait') {
        if (c.x > tx) { c.x = Math.max(tx, c.x - sp * dt); c.state = 'come'; }
        if (c.x <= tx) { if (c.state === 'come') c.t = 0; c.state = 'wait'; c.hurry = 0; }
      }
    });
    if (st.q.length < 3 && (st.spawnT -= dt) <= 0) { spawn(); st.spawnT = 1.4 + Math.random() * 1.6; }
    // a treat flying from the window into a waiting hand
    if (st.fly) {
      const f = st.fly; f.k += dt / 0.55;
      if (f.k >= 1) {
        const c = f.c; c.state = 'happy'; c.t = 0; c.got = f.t; c.hop = 6;
        st.fly = null; st.served++;
        play('bell'); play('yum', c.dog ? 1.2 : 1);
        if (c.dog) play(c.dog === 'husky' ? 'bark2' : 'bark');
        sparkle(handX(c), handY(c) - 8, 10, 10, '#fff6b0');
        for (let i = 0; i < 3; i++) hearts.push({ x: c.x + rand(-6, 6), y: Y.yG - 24, vy: -rand(14, 22), life: 1.4 });
        if (st.served % 5 === 0) { confetti(30); play('bell', 1.25); }
      }
    }
    for (const c of st.q) if (c.state === 'happy' && c.t > 1.1) { c.state = 'leave'; st.leaving.push(c); }
    st.q = st.q.filter(c => c.state !== 'leave');
    for (const c of st.leaving) { c.x -= 30 * dt; c.t += dt; }
    for (const c of st.leaving) if (c.x < -24 && c.dog) dogs[c.dog].away = false;
    st.leaving = st.leaving.filter(c => c.x > -24);
    // the dogs chase a ball around the park
    const b = st.ball, lo = L.safeL + 14, hi = W - L.safeR - 14;
    b.x += b.vx * dt; if (b.x < lo || b.x > hi) { b.vx *= -1; b.x = Math.max(lo, Math.min(hi, b.x)); b.vh = 40; }
    b.vh -= 160 * dt; b.h = Math.max(0, b.h + b.vh * dt); if (b.h === 0 && b.vh < 0) b.vh = Math.random() < 0.02 ? 50 : 0;
    const chase = (d, target, lag) => {
      const want = target + lag, dx = want - d.x;
      if (Math.abs(dx) > 3) { d.x += Math.sign(dx) * Math.min(Math.abs(dx), 44 * dt); d.dir = dx > 0 ? 1 : -1; d.run = true; } else d.run = false;
      d.hop = Math.max(0, d.hop - dt * 30); d.bark = Math.max(0, d.bark - dt);
    };
    chase(dogs.vizsla, b.x, -b.vx > 0 ? 8 : -8);
    chase(dogs.husky, dogs.vizsla.x, (dogs.vizsla.dir > 0 ? -28 : 28) * dogK());
    const gap = 24 * dogK(), dd = dogs.husky.x - dogs.vizsla.x;   // never stand on top of each other
    if (Math.abs(dd) < gap) dogs.husky.x = dogs.vizsla.x + (dd >= 0 ? gap : -gap);
    for (const h of hearts) { h.life -= dt; h.y += h.vy * dt; }
    hearts = hearts.filter(h => h.life > 0);
  }
  let hearts = [];

  /* ---------- drawing ---------- */
  function truck() {
    const x = Y.tx, yb = Y.tyb, top = Y.top, P = (dx, dy, w, h, c) => R(x + dx, top + dy, w, h, c);
    // body: cream with pink and mint stripes, a rounded roof
    P(2, 4, 84, 52, '#fff6ea'); P(4, 2, 80, 2, '#fff6ea'); P(2, 4, 84, 1, '#f2e2cc');
    P(2, 46, 84, 4, '#ff8fb8'); P(2, 50, 84, 2, '#7ad8c0'); P(2, 52, 84, 4, '#ff8fb8');
    // the cab
    P(86, 22, 22, 34, '#ff8fb8'); P(88, 18, 14, 4, '#ff8fb8'); P(102, 22, 4, 4, '#ff8fb8');
    P(89, 24, 14, 11, '#bfe6ff'); P(90, 25, 2, 7, '#ffffff'); P(89, 38, 13, 14, '#ffa8c8'); P(98, 44, 2, 1, '#c84a7a');
    P(105, 44, 3, 4, '#fff6b0'); P(104, 52, 6, 3, '#cfd6dd');
    // the serving window: tubs of ice cream, the vendor, a counter
    P(57, 12, 25, 20, '#6a4a5a'); P(58, 13, 23, 18, '#8a6a7a');
    for (let i = 0; i < 4; i++) { const c = ['#ff8fb8', '#8a5230', '#9ef0c8', '#fff6e0'][i]; P(59 + i * 5, 14, 4, 3, c); P(59 + i * 5, 17, 4, 1, '#cfd6dd'); }
    drawPerson({ type: 'chef', x: x + 70, yb: top + 40, dir: 1, pose: st.vendor > 0 ? 'wave' : 'stand', skin: SKIN[1], seed: 2 });
    P(55, 31, 29, 3, '#cfd6dd'); P(55, 30, 29, 1, '#ffffff'); P(55, 34, 29, 1, '#b5ae9f');
    // a striped awning with a scalloped edge
    for (let i = 0; i < 8; i++) { P(54 + i * 4, 5, 4, 5, i % 2 ? '#ffffff' : '#e8222b'); circle(x + 56 + i * 4, top + 10, 2, i % 2 ? '#ffffff' : '#e8222b'); }
    // the menu board: all ten treats (the one being asked for flashes)
    P(4, 5, 50, 41, '#5a3a2a'); P(5, 6, 48, 39, '#fff2d8');
    const c0 = st.q[0], want = c0 && c0.state === 'wait' && !c0.dog && !st.fly ? c0.want : -1;
    TREATS.forEach((t, i) => {   // two roomy rows of five little treats
      const mx = x + 10 + (i % 5) * 9.5, my = top + 23 + Math.floor(i / 5) * 18;   // miniTreat() centers on mx
      if (i === want && Math.floor(T * 4) % 2) R(Math.round(mx) - 5, my - 15, 10, 17, '#ffd21f');
      miniTreat(i, mx, my);
    });
    // the giant cone on the roof, and a loudspeaker
    const bob = Math.round(Math.sin(T * 2.4));
    treat(TREATS[4], x + 20 - (Y.coneK - 1) * 4, top + 2 + bob, Y.coneK);
    P(78, -4, 2, 6, '#9aa3ad'); P(76, -7, 6, 3, '#cfd6dd'); P(75, -8, 2, 5, '#cfd6dd');
    if (music.src && Math.floor(T * 2) % 2) { R(x + 83, top - 12, 1, 4, '#5a3a8a'); R(x + 81, top - 9, 2, 2, '#5a3a8a'); }
    // wheels
    for (const wx of [20, 94]) { circle(x + wx, yb - 4, 7, '#2f3240'); circle(x + wx, yb - 4, 3, '#cfd6dd'); }
  }
  function park() {
    const v0 = L.safeL - 4, v1 = W;
    // far grass, trees and a little house behind the truck
    R(0, Y.hz, W, Y.yG - Y.hz, '#8fd877');
    for (let i = 0; i < W; i += 7) R(i, Y.hz + (i * 7) % 5 + 2, 2, 1, '#7cc96a');
    for (let x = 6; x < W + 10; x += 34) drawTree(x + (x * 13) % 9, Y.hz + 6, 9 + (x % 3));
    R(Math.round(W * 0.82), Y.hz - 12, 22, 16, '#f2d16b'); for (let k = 0; k < 12; k++) R(Math.round(W * 0.82) - 2 + k, Y.hz - 13 - k, 26 - 2 * k, 1, '#c8432f');
    R(Math.round(W * 0.82) + 8, Y.hz - 4, 6, 8, '#8a5a3a');
    if (!Y.big) { parkLife(); drawDogs(); }   // no lawn in front: they play behind the truck
    // the road the truck parks on, then the sidewalk the customers stand on
    R(0, Y.yG - 18, W, 12, '#5b5f6b'); for (let x = 2; x < W; x += 14) R(x, Y.yG - 13, 7, 1, '#ffd21f');
    R(0, Y.yG - 6, W, 11, '#d8d2c4'); R(0, Y.yG - 6, W, 1, '#b5ae9f'); for (let x = 0; x < W; x += 16) R(x, Y.yG - 6, 1, 11, '#c4bdaf');
    R(0, Y.lawn, W, H - Y.lawn, '#6cbf5a');
    for (let i = 0; i < 40; i++) { const fx = (i * 53) % W, fy = Y.lawn + 4 + (i * 29) % Math.max(4, H - Y.lawn - 6); R(fx, fy, 2, 1, ['#ffd21f', '#ff6fb4', '#ffffff', '#7cc96a', '#7cc96a'][i % 5]); }
  }
  function dogY() { return Y.big ? Math.round(Y.lawn + (H - L.safeB - Y.lawn) * 0.4) : Y.hz + 16; }
  const dogK = () => Y.big ? 2 : 1;
  function drawDogs() {
    const y = dogY(), b = st.ball, k = dogK();
    g.save(); g.translate(0, y); g.scale(k, k);   // the dogs live in the lawn's own coordinates, scaled up when they're close
    const X = v => Math.round(v / k);
    if (!dogs.vizsla.away || !dogs.husky.away) { const bx = X(b.x), bh = Math.round(b.h / k); R(bx - 2, -3 - bh, 4, 3, '#e8222b'); R(bx - 1, -4 - bh, 2, 1, '#e8222b'); R(bx - 1, -3 - bh, 1, 1, '#ff8a8a'); }
    for (const n of ['husky', 'vizsla']) {
      const d = dogs[n]; if (d.away) continue;
      DOGDRAW[n](X(d.x), n === 'husky' ? -2 : 0, d.dir, { run: d.run, hop: d.hop / k, bark: d.bark > 0, wag: true, pant: n === 'husky' });
    }
    g.restore();
  }
  /* a picnic on a blanket, a kite flying high: life in the park */
  const PICNIC = [{ type: 'mom', skin: SKIN[2], treat: 1, dir: 1, dx: 7, seed: 1 }, { type: 'kid3', skin: SKIN[0], treat: 0, dir: -1, dx: 33, seed: 4 }];
  function sitterHand(p, x, yb) {   // where the hand is in the 'eat' pose (alternates mouth / lap)
    const o = OUTFITS[p.type], tY = 9, torsoH = o.child ? 5 : 7, top = yb - (tY + torsoH), ph = Math.floor(T * 5 + p.seed) % 2, bx = x - 6;
    const hx = ph ? 9 : 12, hy = ph ? 9 : tY + 3;
    return [p.dir > 0 ? bx + hx : bx + 12 - hx, top + hy];
  }
  function picnic(x0, yb, k) {   // x0, yb in screen pixels; drawn k times bigger when it's close
    g.save(); g.translate(Math.round(x0), Math.round(yb)); g.scale(k, k);
    // the blanket (red and white checks, seen from the side)
    for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) R(i * 4, -6 + j * 3, 4, 3, (i + j) % 2 ? '#ffffff' : '#e8222b');
    R(0, 0, 40, 1, '#a3121d');
    for (const p of PICNIC) {
      drawPerson({ type: p.type, x: p.dx, yb: -3, dir: p.dir, pose: 'eat', skin: p.skin, seed: p.seed });
      const [hx, hy] = sitterHand(p, p.dx, -3);
      treat(TREATS[p.treat], hx, hy + 6, 1);
    }
    // the basket, with a baguette poking out
    R(16, -9, 9, 6, '#b07a34'); R(16, -9, 9, 1, '#8a5a24'); R(17, -12, 7, 1, '#8a5a24'); R(17, -12, 1, 3, '#8a5a24'); R(23, -12, 1, 3, '#8a5a24');
    R(18, -13, 2, 4, '#e8c07a'); R(21, -11, 2, 2, '#e8222b');
    g.restore();
  }
  function kite(kx, kyb, k) {   // a kid flying a kite; the kite dances in the sky
    g.save(); g.translate(Math.round(kx), Math.round(kyb)); g.scale(k, k);
    drawPerson({ type: 'kid2', x: 0, yb: 0, dir: -1, pose: 'cheer', skin: SKIN[1], seed: 3 });
    g.restore();
    const hx = kx - 3 * k, hy = kyb - 20 * k;
    const tx = Math.round(Math.max(L.safeL + 20, kx - 34 + Math.sin(T * 0.7) * 10)), ty = Math.round(L.safeT + 18 + Math.sin(T * 1.1) * 5);
    for (let i = 0; i <= 24; i++) { const f = i / 24; R(lerp(hx, tx, f), lerp(hy, ty + 8, f) + Math.sin(f * Math.PI) * 8, 1, 1, '#5a5a66'); }
    for (let r = 0; r < 6; r++) { R(tx - r, ty + r, 2 * r + 1, 1, r < 3 ? '#ff6fb4' : '#ffd21f'); R(tx - (5 - r), ty + 6 + r, 2 * (5 - r) + 1, 1, r < 3 ? '#2a6fe0' : '#3fb43a'); }
    for (let i = 0; i < 5; i++) R(tx + Math.round(Math.sin(T * 4 + i) * 1.5), ty + 12 + i * 2, 1, 2, i % 2 ? '#e8222b' : '#ffd21f');   // the tail
  }
  function parkLife() {
    if (Y.big) {
      const yb = H - L.safeB - 4, k = 2;
      picnic(Math.round(Math.max(L.safeL + 30, L.cx - 46)), yb, k);
      kite(W - L.safeR - 10, yb, k);
    } else {
      const free = W - L.safeR - (Y.tx + Y.TW);   // grass to the right of the truck
      if (free >= 58) { picnic(W - L.safeR - 52, Y.hz + 22, 1); kite(W - L.safeR - 6, Y.hz + 20, 1); }
    }
  }
  function customer(c) {
    const leaving = c.state === 'leave', dir = leaving ? -1 : -1, yb = Y.yG + 2;
    if (c.dog) {
      const lick = (c.state === 'happy' || leaving) && Math.floor(T * 4) % 2;
      DOGDRAW[c.dog](c.x, yb - (c.dog === 'husky' ? 1 : 0), -1, { run: c.state === 'come' || leaving, hop: c.hop, wag: true, lick, pant: c.dog === 'husky' && !lick });
      if (c.got) treat(c.got, c.x - 10, yb, 1);
      return;
    }
    const walking = c.state === 'come' || leaving;
    drawPerson({ type: c.type, x: c.x, yb, dir, walk: walking, pose: c.state === 'happy' ? 'cheer' : 'stand', skin: c.skin, seed: c.seed, hop: c.hop });
    if (c.got) treat(c.got, handX(c), handY(c) + (c.state === 'happy' ? -2 : 0) + (leaving && Math.floor(T * 3) % 2 ? -1 : 0), 1);
  }
  function wantBubble(c) {   // what the front customer is dreaming of, drawn big
    if (!c || c.state !== 'wait' || st.fly) return;
    const t = c.dog ? PUP : TREATS[c.want], k = 2, bw = 26, bh = 40;
    const top = (c.dog ? Y.yG - 18 : Y.yG + 2 - personH(c.type)) - bh - 6;
    const side = c.x + 9 + bw <= W - L.safeR - 2 || top < L.safeT + 2;   // beside the head (clear of the window) when it fits
    const bx = Math.round(side ? Math.min(W - L.safeR - bw - 2, c.x + 9) : Math.min(W - L.safeR - bw - 2, c.x - 2));
    const headY = c.dog ? Y.yG - 14 : Y.yG + 2 - personH(c.type);
    const by = Math.round(side ? Math.max(L.safeT + 2, headY - bh + 10) : top), pop = Math.min(1, c.t / 0.25);
    if (pop <= 0) return;
    R(bx, by + 1, bw, bh - 2, INK); R(bx + 1, by, bw - 2, bh, INK);
    R(bx + 1, by + 1, bw - 2, bh - 2, '#ffffff');
    if (side) { R(bx - 3, by + bh - 9, 2, 2, INK); R(bx - 2, by + bh - 8, 1, 1, '#ffffff'); R(bx - 6, by + bh - 6, 2, 2, INK); }
    else { R(c.x - 2, by + bh, 3, 2, INK); R(c.x - 4, by + bh + 3, 2, 2, INK); }
    treat(t, bx + Math.round(bw / 2), by + bh - 4 + Math.round(Math.sin(T * 5)), k);
    if (Math.floor(T * 1.5) % 2 === 0) sparkleDot(bx + bw - 4, by + 4);
  }
  // a pink button showing a soft-serve swirl: opens the kitchen
  function kitchenButton(b) {
    button(b, '#ff6fb4', '#c73d84');
    const cx = Math.round(b.x + b.s / 2), by = Math.round(b.y + b.s - 4), pulse = Math.round(Math.sin(T * 4));
    for (let k = 0; k < 7; k++) R(cx - 3 + (k >> 1), by - 7 + k, 7 - (k >> 1) * 2, 1, k % 2 ? '#b07a34' : '#d9a35a');
    R(cx - 5, by - 10, 11, 3, '#fff6e0'); R(cx - 4, by - 13 + pulse * 0, 9, 3, '#ffd0e4'); R(cx - 3, by - 16, 7, 3, '#fff6e0'); R(cx - 1, by - 18, 3, 2, '#ffd0e4');
    R(cx - 4, by - 10, 2, 1, '#ffffff'); if (Math.floor(T * 2) % 2) { R(b.x + b.s - 4, b.y + 2, 1, 3, '#ffffff'); R(b.x + b.s - 5, b.y + 3, 3, 1, '#ffffff'); }
  }
  function sparkleDot(x, y) { R(x, y - 1, 1, 3, '#ffd21f'); R(x - 1, y, 3, 1, '#ffd21f'); }

  SCENES.icecream = {
    view: [124, 110],   // close up: the truck nearly fills the frame
    freeTouch: true,
    layout,
    groundY: () => Y.hz,
    enter(arg) {
      layout();
      SCENES.icecream._keepMusic = false;
      loadAudio(); startMusic();
      if (arg && arg.back) return;   // back from the kitchen: the line is just as we left it
      Object.assign(st, { q: [], leaving: [], fly: null, served: 0, spawnT: 0.4, n: 0, vendor: 1, bell: 0 });
      hearts = []; st.ball.x = L.cx; dogs.vizsla.away = dogs.husky.away = false;
      for (const d of Object.values(dogs)) d.away = false;
      dogs.vizsla.x = L.cx - 20; dogs.husky.x = L.cx - 44;
      play('bell');
    },
    _audio: { play: (k, r) => play(k, r), startMusic: () => { loadAudio(); startMusic(); }, stopMusic: () => stopMusic() },
    leave() { if (!SCENES.icecream._keepMusic) stopMusic(); },
    update,
    drawWorld() {
      park();
      truck();
      if (Y.big) { parkLife(); drawDogs(); }
      for (const c of st.leaving) customer(c);
      for (let i = st.q.length - 1; i >= 0; i--) customer(st.q[i]);
      if (st.fly) {
        const f = st.fly, k = eout(clamp01(f.k));
        treat(f.t, lerp(f.x0, f.x1, k), lerp(f.y0, f.y1, k) - Math.sin(k * Math.PI) * 18, 1);
      }
    },
    drawLit() {
      const k = nightK();
      if (k > 0.05) alpha(k, () => {   // the window glows and fairy lights twinkle at night
        R(Y.tx + 57, Y.top + 12, 25, 20, 'rgba(255,240,180,0.35)');
        for (let i = 0; i < 10; i++) if ((i + Math.floor(T * 3)) % 2) R(Y.tx + 4 + i * 9, Y.top + 2, 2, 2, ['#ff6fb4', '#ffd21f', '#7ad8c0', '#ffffff'][i % 4]);
      });
      for (const h of hearts) alpha(Math.min(1, h.life * 2), () => { const x = Math.round(h.x), y = Math.round(h.y); R(x - 2, y, 2, 2, '#e8222b'); R(x + 1, y, 2, 2, '#e8222b'); R(x - 2, y + 1, 5, 2, '#e8222b'); R(x - 1, y + 3, 3, 1, '#e8222b'); R(x, y + 4, 1, 1, '#e8222b'); });
      drawParticles();
    },
    drawUI() {
      wantBubble(front());
      drawHomeButton(Y.home);
      if (SCENES.icekitchen) kitchenButton(Y.kitchen);
    },
    tap(x, y) {
      if (inBox(Y.home, x, y)) { goScene('station'); return true; }
      if (SCENES.icekitchen && inBox(Y.kitchen, x, y, 3)) { SCENES.icecream._keepMusic = true; play('pop'); goScene('icekitchen'); return true; }
      const dy = dogY();
      for (const n of ['vizsla', 'husky']) {
        const d = dogs[n];
        if (!d.away && Math.abs(x - d.x) < 13 * dogK() && y > dy - 20 * dogK() && y < dy + 4) { d.hop = 6; d.bark = 0.3; play(n === 'husky' ? 'bark2' : 'bark'); hearts.push({ x: d.x, y: dy - 18, vy: -18, life: 1.2 }); return true; }
      }
      serve();
      return true;
    },
    _st: st,
    _dogs: DOGDRAW,   // the little park-sized dogs, borrowed by other games
    _treat: (i, x, yb, k) => treat(TREATS[i], x, yb, k),   // used by the menu tile
  };
})();
