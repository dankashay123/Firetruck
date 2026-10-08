// Life on the lawns either side of the fire station (when the screen is wide enough):
// a swirly slide out of the top floor that the crew whoosh down, an ice cream truck the
// firefighters, police, paramedics and dogs line up at, kids playing catch, the cat stalking
// birds, the dogs romping about, and neighbors jogging and strolling past.
'use strict';
const YARD = (() => {
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const G = { on: false };
  const st = { people: [], walkers: [], birds: [], spawnT: 2, walkerT: 5, serveT: 0, bell: 0, vendor: 0, kids: { t: 0, high: 0, cheer: 0 }, slideBusy: 0 };
  const cat = { x: 0, dir: 1, state: 'sit', t: 2, hop: 0, react: 0, target: null };
  const dogs = [{ who: 'vizsla', x: 0, dir: 1, state: 'play', t: 3, hop: 0, react: 0, tx: 0 }, { who: 'husky', x: 0, dir: -1, state: 'play', t: 4, hop: 0, react: 0, tx: 0 }];
  const SND = TOY.bank({ bell: ['ic-bell', 0.45], pop: ['ic-pop', 0.5], yum: ['ic-yum', 0.4] }, {
    bell() { tone('sine', 1568, 0, 0.6, 0.06); tone('sine', 2093, 0.02, 0.5, 0.04); }, pop() { tone('sine', 500, 0, 0.08, 0.08, 900); },
    yum() { [659, 784, 988].forEach((f, i) => tone('sine', f, i * 0.07, 0.15, 0.05)); },
  });
  const CREW = ['ff', 'ff', 'cop', 'medic'], TOWN = ['kid', 'kid2', 'kid3', 'mom', 'dad', 'gran'];
  const CONES = [['#ff8fb8', '#e8608f'], ['#8a5230', '#6a3a1e'], ['#9ef0c8', '#6ad4a4'], ['#7ad0ff', '#4aa8e8'], ['#fff6e0', '#e8dcc0']];

  /* ---------- layout ---------- */
  // B: the station's building layout; returns where the station should put its dog and trees
  function layout(B) {
    const left = B.x - L.safeL, right = W - L.safeR - (B.x + B.w);
    G.on = left >= 110 && right >= 110 && W > H;
    if (!G.on) return null;
    G.y = L.floorY; G.door = B.x + 9;
    G.x0 = L.safeL + 8; G.x1 = W - L.safeR - 8;
    // the swirly slide hugs the left wall, coming out of the top floor
    const f = B.floors[B.floors.length - 1];
    G.slide = f ? { cx: B.x - 16, top: f.fy - 2, attach: B.x, bot: L.floorY - 9, end: B.x - 44 } : null;
    if (G.slide) G.slide.turns = Math.max(1.5, Math.round((G.slide.bot - G.slide.top) / 30 * 2) / 2);
    // the left lawn: the cat and her birds near the station, kids playing catch farther out
    const lx1 = B.x - 76;
    G.catZone = [Math.max(G.x0 + 10, lx1 - 110), lx1];
    G.kids = left >= 260 ? [G.x0 + 18, G.x0 + 74] : null;
    if (G.kids) G.catZone[0] = Math.max(G.catZone[0], G.kids[1] + 24);
    // the right lawn: the ice cream truck past the hydrant
    G.truck = { x: B.x + B.w + 30, w: 64 };
    G.win = G.truck.x + 22;
    G.dogZone = [G.x0 + 10, G.x1 - 10];
    st.birds = [0, 1, 2, 3].map(i => ({ x: lerp(G.catZone[0], G.catZone[1], 0.15 + i * 0.25), h: 0, vx: 0, vy: 0, state: 'peck', t: Math.random() * 3, i }));
    cat.x = lerp(G.catZone[0], G.catZone[1], 0.9); cat.state = 'sit'; cat.t = 2;
    dogs[0].x = G.truck.x + G.truck.w + 20; dogs[1].x = dogs[0].x + 22;
    for (const p of st.people) if (p.state === 'slide' && !G.slide) p.state = 'home';
    G.bench = right >= 170 ? G.truck.x + G.truck.w + 34 : null;
    G.scoot = right >= 230 ? [G.truck.x + G.truck.w + 70, G.x1 - 12] : null;
    st.scoot = { x: G.scoot ? G.scoot[0] : 0, dir: 1 };
    st.seats = G.bench ? [null, null] : [];
    G.flowers = [];
    for (let i = 0; i < 16; i++) { const lx = lerp(G.x0 + 4, B.x - 50, (i + 0.5) / 16), rx = lerp(B.x + B.w + 20, G.x1 - 4, (i + 0.5) / 16); G.flowers.push([Math.round(lx + Math.sin(i * 7) * 4), i], [Math.round(rx + Math.sin(i * 5) * 4), i + 3]); }
    return { dogX: B.x - 64, leftTree: B.x - 92, rightTree: right >= 230 ? G.x1 - 30 : right >= 190 ? G.truck.x + G.truck.w + 76 : null };
  }

  /* ---------- people ---------- */
  function person(type, x, extra) { return Object.assign({ type, x, dir: 1, state: 'walk', t: 0, hop: 0, skin: SKIN[Math.floor(Math.random() * 4)], seed: Math.random() * 9, treat: -1, crew: CREW.includes(type) }, extra); }
  function queue() { return st.people.filter(p => p.state === 'queue' || (p.state === 'walk' && p.next === 'queue')).concat(dogs.filter(d => d.state === 'queue' || d.state === 'toTruck')); }
  const slotX = i => G.win - 4 - i * 13;
  function spawnCrew(viaSlide) {
    if (st.people.length >= 6) return;
    const type = CREW[Math.floor(Math.random() * CREW.length)], wantIce = Math.random() < 0.7 && queue().length < 3;
    const p = person(type, G.door, { next: wantIce ? 'queue' : 'stroll' });
    if (viaSlide && G.slide && st.slideBusy <= 0) { p.state = 'slide'; p.k = 0; st.slideBusy = 1.2; tone('sine', 900, 0.1, 1.8, 0.03, 300); }
    else { p.state = 'walk'; p.appear = 0.5; }
    st.people.push(p);
  }
  function spawnWalker() {
    const fromLeft = Math.random() < 0.5, kind = Math.random();
    const w = { x: fromLeft ? -16 : W + 16, dir: fromLeft ? 1 : -1, type: pickOne(['mom', 'dad', 'gran', 'kid2']), skin: SKIN[Math.floor(Math.random() * 4)], seed: Math.random() * 9, wave: 0, hop: 0 };
    w.kind = kind < 0.35 ? 'jog' : kind < 0.6 ? 'stroller' : 'walk';
    if (w.kind === 'stroller') w.type = 'mom';
    if (w.kind === 'jog') w.type = pickOne(['dad', 'mom']);
    w.speed = w.kind === 'jog' ? 34 : 14;
    st.walkers.push(w);
  }

  /* ---------- update ---------- */
  function update(dt, quiet) {
    if (!G.on) return;
    st.bell = Math.max(0, st.bell - dt); st.vendor = Math.max(0, st.vendor - dt); st.slideBusy = Math.max(0, st.slideBusy - dt);
    // new visitors (nobody comes out at bedtime)
    if (!quiet) {
      if ((st.spawnT -= dt) <= 0) { st.spawnT = rand(6, 11); spawnCrew(Math.random() < 0.6); }
      if ((st.walkerT -= dt) <= 0) { st.walkerT = rand(9, 16); if (st.walkers.length < 2) spawnWalker(); }
    }
    // the line at the ice cream truck: serve whoever is at the front
    const q = queue();
    q.sort((a, b) => b.x - a.x);
    const front = q[0];
    if (front && (front.state === 'queue') && Math.abs(front.x - slotX(0)) < 1.5) {
      if ((st.serveT += dt) > 1.4) {
        st.serveT = 0; st.vendor = 0.8; SND.play('pop');
        front.treat = Math.floor(Math.random() * CONES.length); front.hop = 5; front.state = 'eat'; front.t = rand(3, 5);
        if (front.who) { front.tx = rand(G.dogZone[0], G.dogZone[1]); SND.play('yum', 1.2); PETS.SND.play(front.who === 'husky' ? 'bark2' : 'bark'); }
        else {
          const seat = st.seats.findIndex(s => !s);
          if (seat >= 0 && Math.random() < 0.7) { st.seats[seat] = front; front.seat = seat; front.tx = G.bench + 5 + seat * 12; front.t = rand(5, 8); }
          else front.tx = rand(G.x0 + 20, G.x1 - 20);
          SND.play('yum');
        }
      }
    } else st.serveT = 0;
    // everybody in line steps up to their spot
    q.forEach((a, i) => { a.slot = slotX(i); });
    for (const p of st.people) updatePerson(p, dt, quiet);
    st.people = st.people.filter(p => !p.gone);
    for (const w of st.walkers) { w.x += w.dir * w.speed * dt; w.wave = Math.max(0, w.wave - dt); w.hop = Math.max(0, w.hop - dt * 20); }
    st.walkers = st.walkers.filter(w => w.x > -30 && w.x < W + 30);
    if (G.scoot) { const s = st.scoot; s.x += s.dir * 24 * dt; if (s.x > G.scoot[1]) s.dir = -1; if (s.x < G.scoot[0]) s.dir = 1; }
    updateKids(dt); updateCat(dt, quiet); for (const d of dogs) updateDog(d, dt, quiet);
  }
  function walkTo(p, x, sp, dt) {
    const d = x - p.x; p.dir = d >= 0 ? 1 : -1;
    p.x += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
    return Math.abs(x - p.x) < 0.5;
  }
  function updatePerson(p, dt, quiet) {
    p.hop = Math.max(0, p.hop - dt * 20); p.appear = Math.max(0, (p.appear || 0) - dt);
    if (quiet && p.state !== 'slide' && p.state !== 'home') p.state = 'home';
    switch (p.state) {
      case 'slide': {
        p.k += dt / 2.4;
        if (p.k >= 1) { p.state = 'walk'; p.x = G.slide.end; p.hop = 4; }
        break;
      }
      case 'walk': {
        const target = p.next === 'queue' ? (p.slot ?? slotX(3)) : p.tx ?? (p.tx = rand(G.x0 + 30, G.x1 - 30));
        if (walkTo(p, target, 20, dt)) {
          if (p.next === 'queue') { p.state = 'queue'; p.dir = 1; }
          else { p.state = 'idle'; p.t = rand(3, 6); }
        }
        break;
      }
      case 'queue': walkTo(p, p.slot ?? p.x, 20, dt); p.dir = 1; break;
      case 'eat': if (walkTo(p, p.tx, 16, dt) && (p.t -= dt) <= 0) { p.state = 'home'; if (p.seat != null) { st.seats[p.seat] = null; p.seat = null; } } break;
      case 'idle': if ((p.t -= dt) <= 0) p.state = 'home'; break;
      case 'home':
        if (!p.crew) { if (walkTo(p, p.x < W / 2 ? -20 : W + 20, 20, dt)) p.gone = true; }
        else if (walkTo(p, G.door, 22, dt)) p.gone = true;
        break;
    }
  }
  function updateKids(dt) {
    const k = st.kids; k.t += dt * (k.high > 0 ? 0.45 : 0.7); k.high = Math.max(0, k.high - dt); k.cheer = Math.max(0, k.cheer - dt);
  }
  function updateCat(dt, quiet) {
    cat.hop = Math.max(0, cat.hop - dt * 20); cat.react = Math.max(0, cat.react - dt);
    for (const b of st.birds) {
      if (b.state === 'fly') {
        b.t -= dt; b.x += b.vx * dt; b.h += b.vy * dt; b.vy -= 20 * dt;
        if (b.t <= 0) { b.state = 'land'; b.tx = rand(G.catZone[0], G.catZone[1]); }
      } else if (b.state === 'land') {
        b.x += (b.tx - b.x) * Math.min(1, dt * 1.5); b.h = Math.max(0, b.h - 30 * dt);
        if (b.h <= 0 && Math.abs(b.tx - b.x) < 2) { b.state = 'peck'; b.t = rand(1, 3); }
      } else if ((b.t -= dt) <= 0) { b.t = rand(1, 3); b.x = Math.max(G.catZone[0], Math.min(G.catZone[1], b.x + rand(-6, 6))); }
    }
    if (quiet) { cat.state = 'nap'; return; }
    switch (cat.state) {
      case 'sit': case 'nap':
        if ((cat.t -= dt) <= 0) {
          const prey = st.birds.filter(b => b.state === 'peck');
          if (prey.length && Math.random() < 0.75) { cat.target = pickOne(prey); cat.state = 'stalk'; }
          else { cat.state = Math.random() < 0.4 ? 'nap' : 'sit'; cat.t = rand(4, 8); }
        }
        break;
      case 'stalk': {
        const b = cat.target;
        if (!b || b.state !== 'peck') { cat.state = 'sit'; cat.t = 2; break; }
        const d = b.x - cat.x; cat.dir = d >= 0 ? 1 : -1;
        cat.x += Math.sign(d) * Math.min(Math.abs(d), 7 * dt);
        if (Math.abs(d) < 16) { cat.state = 'pounce'; cat.t = 0.45; cat.hop = 8; cat.px = cat.x; }
        break;
      }
      case 'pounce':
        cat.t -= dt; cat.x += cat.dir * 26 * dt;
        if (cat.t <= 0.3 && !cat.scared) { cat.scared = true; scare(cat.x, 34); }
        if (cat.t <= 0) { cat.state = 'sit'; cat.t = rand(3, 6); cat.scared = false; }
        break;
    }
    cat.x = Math.max(G.catZone[0] - 10, Math.min(G.catZone[1] + 10, cat.x));
  }
  function scare(x, r) {
    let any = false;
    for (const b of st.birds) if (b.state === 'peck' && Math.abs(b.x - x) < r) {
      b.state = 'fly'; b.t = rand(1.6, 2.6); b.vx = (b.x >= x ? 1 : -1) * rand(16, 30); b.vy = rand(26, 40); any = true;
    }
    if (any) { tone('sine', 2600, 0, 0.06, 0.05, 3200); tone('sine', 2900, 0.1, 0.06, 0.05, 3400); noise(0, 0.25, 0.05, 3000, 1); }
  }
  function updateDog(d, dt, quiet) {
    d.hop = Math.max(0, d.hop - dt * 24); d.react = Math.max(0, d.react - dt);
    if (quiet) { d.state = 'nap'; return; }
    switch (d.state) {
      case 'play': {
        // romp about together: chase a random spot, then the other dog takes a turn
        if (walkTo(d, d.tx || d.x, 40, dt) || (d.t -= dt) <= 0) {
          const r = Math.random();
          if (r < 0.12 && queue().length < 3) { d.state = 'toTruck'; d.next = 'queue'; break; }
          if (r < 0.3) { d.state = 'nap'; d.t = rand(5, 9); break; }
          const other = dogs.find(o => o !== d);
          d.tx = Math.random() < 0.5 && other ? other.x + rand(-30, 30) : rand(G.dogZone[0], G.dogZone[1]);
          d.tx = Math.max(G.dogZone[0], Math.min(G.dogZone[1], d.tx)); d.t = rand(2, 4);
        }
        break;
      }
      case 'nap': if ((d.t -= dt) <= 0) { d.state = 'play'; d.tx = d.x; } break;
      case 'toTruck': if (walkTo(d, d.slot ?? slotX(3), 30, dt)) { d.state = 'queue'; d.dir = 1; } break;
      case 'queue': walkTo(d, d.slot ?? d.x, 30, dt); d.dir = 1; break;
      case 'eat': if (walkTo(d, d.tx, 26, dt) && (d.t -= dt) <= 0) { d.state = 'play'; d.treat = -1; d.tx = d.x; } break;
    }
  }

  /* ---------- drawing ---------- */
  function slidePath(k) {   // a point along the slide: from the side door, round and round, out the chute
    const s = G.slide, r = 9;
    if (k < 0.08) { const u = k / 0.08; return [lerp(s.attach - 1, s.cx + r, u), s.top - 2 + u * 2, 1]; }
    if (k < 0.88) { const u = (k - 0.08) / 0.8, a = u * s.turns * Math.PI * 2; return [s.cx + Math.cos(a) * r, lerp(s.top, s.bot, u), Math.sin(a)]; }
    const u = (k - 0.88) / 0.12, a = s.turns * Math.PI * 2;
    return [lerp(s.cx + Math.cos(a) * r, s.end, u), lerp(s.bot, G.y - 3, u * u), 1];
  }
  function drawSlide(front) {
    const s = G.slide;
    if (!front) {
      R(s.cx - 2, s.top - 4, 5, G.y - s.top + 4, '#8a939d'); R(s.cx - 2, s.top - 4, 2, G.y - s.top + 4, '#cfd6dd');   // the center pole
      R(s.attach - 7, s.top - 18, 7, 18, '#3a3442'); R(s.attach - 8, s.top - 19, 9, 2, '#f3e2c3');                     // the little side door
      R(s.cx - 5, G.y - 2, 11, 2, '#6a6e78');
    }
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const [x, y, z] = slidePath(i / N);
      if ((z >= 0) !== front) continue;
      const band = Math.floor(i / 9) % 2, c = band ? '#ffd21f' : '#e8222b', dark = band ? '#c99a10' : '#a3121d';
      const xx = Math.round(x), yy = Math.round(y);
      if (z >= 0) { R(xx - 4, yy - 1, 8, 3, c); R(xx - 4, yy + 2, 8, 2, dark); R(xx - 4, yy - 2, 8, 1, '#ffffff'); }   // the slide's lip, toward us
      else { R(xx - 3, yy, 6, 3, mix(c, '#000000', 0.3)); }
    }
  }
  function truck() {
    const x = G.truck.x, yb = G.y - 1, top = yb - 34, P = (dx, dy, w, h, c) => R(x + dx, top + dy, w, h, c);
    P(0, 4, 46, 26, '#fff6ea'); P(2, 2, 42, 2, '#fff6ea'); P(0, 22, 46, 2, '#ff8fb8'); P(0, 24, 46, 1, '#7ad8c0'); P(0, 25, 46, 2, '#ff8fb8');
    P(46, 12, 16, 18, '#ff8fb8'); P(47, 9, 10, 3, '#ff8fb8'); P(48, 14, 9, 6, '#bfe6ff'); P(49, 15, 1, 4, '#ffffff'); P(60, 22, 3, 3, '#fff6b0');
    // the serving window with the vendor
    P(16, 7, 18, 13, '#6a4a5a'); P(17, 8, 16, 11, '#8a6a7a');
    g.save(); g.beginPath(); g.rect(x + 17, top + 8, 16, 11); g.clip();
    drawPerson({ type: 'chef', x: x + 25, yb: top + 27, dir: -1, pose: st.vendor > 0 || st.bell > 0 ? 'wave' : 'stand', skin: SKIN[1], seed: 2 });
    g.restore();
    P(15, 19, 20, 2, '#cfd6dd');
    for (let i = 0; i < 5; i++) P(15 + i * 4, 3, 4, 4, i % 2 ? '#ffffff' : '#e8222b');
    // menu pictures and the big cone on the roof
    for (let i = 0; i < 3; i++) { const c = CONES[i]; P(3 + i * 4, 9, 3, 3, c[0]); P(4 + i * 4, 12, 1, 3, '#d9a35a'); }
    const bob = Math.round(Math.sin(T * 2.4));
    P(8, -6 + bob, 7, 5, '#ff8fb8'); P(9, -8 + bob, 5, 2, '#ff8fb8'); for (let k = 0; k < 5; k++) P(9 + (k >> 1), -1 + bob + k, 5 - (k >> 1) * 2, 1, k % 2 ? '#b07a34' : '#d9a35a');
    for (const wx of [12, 52]) { circle(x + wx, yb - 3, 4, '#2f3240'); circle(x + wx, yb - 3, 2, '#cfd6dd'); }
    if (st.bell > 0 && Math.floor(T * 8) % 2) { R(x + 36, top - 4, 1, 3, '#5a3a8a'); R(x + 38, top - 6, 1, 3, '#5a3a8a'); }
  }
  function cone(c, x, yb) {
    const k = CONES[c];
    R(x - 1, yb - 3, 3, 3, '#d9a35a'); R(x, yb, 1, 1, '#b07a34'); circle(x, yb - 5, 2, k[0]); R(x - 1, yb - 6, 1, 1, '#ffffff');
  }
  function pupCup(x, yb) { R(x - 2, yb - 3, 5, 3, '#ffd21f'); R(x - 2, yb - 5, 5, 2, '#f6ead0'); R(x - 1, yb - 6, 3, 1, '#f6ead0'); }
  function drawPerson2(p) {
    let pose = 'stand';
    const walking = p.state === 'walk' || p.state === 'home' || (p.state === 'eat' && Math.abs(p.tx - p.x) > 1) || (p.state === 'queue' && Math.abs((p.slot ?? p.x) - p.x) > 1);
    if (p.state === 'slide') {
      const [x, y] = slidePath(p.k);
      drawPerson({ type: p.type, x, yb: y + 1, dir: x < G.slide.cx ? -1 : 1, pose: 'slide', skin: p.skin, seed: p.seed });
      return;
    }
    if (p.state === 'eat' && p.seat != null && Math.abs(p.tx - p.x) < 1) {
      drawPerson({ type: p.type, x: p.x, yb: G.y - 8, dir: 1, pose: 'eat', skin: p.skin, seed: p.seed });
      const ph = Math.floor(T * 5 + p.seed) % 2, o = OUTFITS[p.type] || {};
      if (p.treat >= 0) cone(p.treat, p.x + (ph ? 3 : 6), G.y - 8 - (o.child ? 6 : 8) - (ph ? 3 : 0));
      return;
    }
    if (p.state === 'eat') pose = 'eat';
    else if (p.state === 'idle') pose = Math.floor(T * 0.8 + p.seed) % 3 ? 'stand' : 'wave';
    const draw = () => drawPerson({ type: p.type, x: p.x, yb: G.y, dir: p.dir, pose, walk: walking, skin: p.skin, seed: p.seed, hop: p.hop });
    if (p.appear > 0) alpha(1 - p.appear / 0.5, draw); else draw();
    if (typeof FX !== 'undefined') FX.umbrella(p.x, G.y - (p.hop || 0), personH(p.type), p.seed);
    if (p.treat >= 0 && p.state === 'eat') {
      const o = OUTFITS[p.type], child = o && o.child, ph = Math.floor(T * 5 + p.seed) % 2;
      cone(p.treat, p.x + p.dir * (ph ? 2 : 5), G.y - (child ? 8 : 10) - (ph ? 3 : 0));
    }
  }
  function drawWalker(w) {
    const pose = w.wave > 0 ? 'wave' : 'stand', yb = G.y + 3;
    if (w.kind === 'stroller') {   // pushing a baby in a stroller
      const sx = w.x + w.dir * 11;
      R(sx - 5, yb - 9, 10, 5, '#2a6fe0'); R(sx - 5, yb - 12, 5, 3, '#2a6fe0'); R(sx - 3, yb - 11, 2, 2, SKIN[0]);
      R(sx - w.dir * 6, yb - 12, 1, 4, '#3a3d46'); circle(sx - 3, yb - 2, 2, '#2f3240'); circle(sx + 3, yb - 2, 2, '#2f3240');
    }
    if (w.kind === 'jog') drawPerson({ type: w.type, x: w.x, yb, dir: w.dir, pose: w.wave > 0 ? 'wave' : 'cheer', walk: true, skin: w.skin, seed: w.seed, hop: Math.abs(Math.sin(T * 12 + w.seed)) * 2 + w.hop });
    else drawPerson({ type: w.type, x: w.x, yb, dir: w.dir, pose, walk: true, skin: w.skin, seed: w.seed, hop: w.hop });
    if (typeof FX !== 'undefined') FX.umbrella(w.x, yb - (w.hop || 0), personH(w.type), w.seed);
  }
  function kids() {
    if (!G.kids) return;
    const [a, b] = G.kids, k = st.kids, ph = k.t % 2, toB = ph < 1, u = toB ? ph : ph - 1;
    const hi = k.high > 0 ? 46 : 22;
    const bx = toB ? lerp(a + 5, b - 5, u) : lerp(b - 5, a + 5, u), by = G.y - 16 - Math.sin(u * Math.PI) * hi;
    drawPerson({ type: 'kid', x: a, yb: G.y, dir: 1, pose: k.cheer > 0 ? 'cheer' : (!toB && u > 0.8) || (toB && u < 0.15) ? 'carry' : 'wave', skin: SKIN[2], seed: 1 });
    drawPerson({ type: 'kid3', x: b, yb: G.y, dir: -1, pose: k.cheer > 0 ? 'cheer' : (toB && u > 0.8) || (!toB && u < 0.15) ? 'carry' : 'wave', skin: SKIN[0], seed: 2 });
    circle(bx, by, 2, '#e8222b'); R(bx - 1, by - 1, 1, 1, '#ff9a9a');
  }
  function drawBird(b) {
    const x = Math.round(b.x), y = Math.round(G.y - 1 - b.h), flap = b.state !== 'peck' && Math.floor(T * 12 + b.i) % 2, peck = b.state === 'peck' && Math.floor(T * 3 + b.i) % 3 === 0;
    R(x - 2, y - 3, 4, 3, '#8a6a4a'); R(x + 1, y - 4 + (peck ? 2 : 0), 3, 2, '#8a6a4a'); R(x + 4, y - 3 + (peck ? 2 : 0), 1, 1, '#f5a020');
    R(x + 2, y - 4 + (peck ? 2 : 0), 1, 1, INK); R(x - 3, y - 2, 1, 1, '#6a4a30');
    if (flap) R(x - 2, y - 6, 3, 2, '#a8845a'); else R(x - 1, y - 3, 3, 1, '#a8845a');
    if (b.state === 'peck') { R(x - 1, y, 1, 1, '#e8a040'); R(x + 1, y, 1, 1, '#e8a040'); }
  }
  function drawCat() {
    if (typeof FX !== 'undefined' && FX.catHides) return;   // under the fire truck, out of the rain
    const y = G.y;
    if (cat.state === 'nap') PETS.catSleep(cat.x, y, cat.dir);
    else if (cat.state === 'stalk') PETS.catWalk(cat.x, y + 1, cat.dir, { walk: Math.floor(T * 2) % 2 === 0 });
    else if (cat.state === 'pounce') PETS.catWalk(cat.x, y, cat.dir, { run: true, hop: Math.sin(clamp01(1 - cat.t / 0.45) * Math.PI) * 8 });
    else PETS.catSit(cat.x, y, { hop: cat.hop, meow: cat.react > 0, swish: true });
  }
  function drawDog(d) {
    if (typeof FX !== 'undefined' && FX.zoom) return;   // off doing zoomies in front of the station
    const D = SCENES.icecream && SCENES.icecream._dogs;
    if (d.state === 'nap') (d.who === 'husky' ? PETS.huskyLie : PETS.vizslaLie)(d.x, G.y, d.dir, { sleep: true });
    else if (D) {
      const moving = d.state === 'play' ? Math.abs((d.tx || d.x) - d.x) > 1 : d.state === 'toTruck' || (d.state === 'eat' && Math.abs(d.tx - d.x) > 1) || (d.state === 'queue' && Math.abs((d.slot ?? d.x) - d.x) > 1);
      D[d.who](d.x, G.y - (d.who === 'husky' ? 1 : 0), d.dir, { run: moving, wag: true, hop: d.hop, bark: d.react > 0, pant: d.who === 'husky' && d.react <= 0, lick: d.state === 'eat' && Math.floor(T * 4) % 2 });
    }
    if (d.state === 'eat' && d.treat >= 0) pupCup(d.x + d.dir * 11, G.y);
  }
  // behind the people: the slide's back loops and the truck
  function bench() {
    const x = G.bench, y = G.y;
    R(x, y - 8, 30, 2, '#a8743f'); R(x, y - 12, 30, 2, '#a8743f'); R(x + 1, y - 13, 28, 1, '#c8945a');
    R(x + 2, y - 6, 2, 6, '#5a5e6a'); R(x + 26, y - 6, 2, 6, '#5a5e6a'); R(x + 2, y - 12, 2, 4, '#5a5e6a'); R(x + 26, y - 12, 2, 4, '#5a5e6a');
  }
  function scooterKid() {
    const s = st.scoot, x = Math.round(s.x), yb = G.y + 3;
    R(x - 6, yb - 3, 12, 1, '#3fb43a'); circle(x - 5, yb - 1, 1, '#2f3240'); circle(x + 5, yb - 1, 1, '#2f3240');
    R(x + s.dir * 5, yb - 14, 1, 11, '#9aa3ad'); R(x + s.dir * 5 - 2, yb - 14, 5, 1, '#3a3d46');
    drawPerson({ type: 'kid2', x: x - s.dir, yb: yb - 3, dir: s.dir, pose: 'carry', skin: SKIN[3], seed: 7 });
  }
  function flowers() { for (const [x, i] of G.flowers) { R(x, G.y - 3, 1, 3, '#3f9a45'); R(x - 1, G.y - 4, 3, 1, ['#ffd21f', '#ff6fb4', '#ffffff', '#e8222b'][i % 4]); R(x, G.y - 5, 1, 3, ['#ffd21f', '#ff6fb4', '#ffffff', '#e8222b'][i % 4]); R(x, G.y - 4, 1, 1, '#f57a12'); } }
  function drawBack(sleeping) {
    if (!G.on) return;
    flowers();
    if (G.bench) bench();
    if (G.slide) drawSlide(false);
    truck();
  }
  function drawFront(sleeping) {
    if (!G.on) return;
    if (G.slide) drawSlide(true);
    if (!sleeping) {
      kids();
      for (const b of st.birds) drawBird(b);
      for (const p of st.people) drawPerson2(p);
      drawCat();
      for (const d of dogs) drawDog(d);
    } else for (const b of st.birds) if (b.state === 'peck') drawBird(b);
    for (const w of st.walkers) drawWalker(w);
    if (G.scoot && !sleeping) scooterKid();
  }

  /* ---------- taps ---------- */
  function tap(x, y, sleeping) {
    if (!G.on) return false;
    const near = (px, h, w = 8) => Math.abs(x - px) < w && y > G.y - h && y < G.y + 5;
    if (!sleeping) {
      for (const d of dogs) if (near(d.x, 18, 12)) { d.hop = 6; d.react = 0.5; if (d.state === 'nap') d.state = 'play'; PETS.SND.load(); PETS.SND.play(d.who === 'husky' ? 'bark2' : 'bark'); hearts(d.x, G.y - 20); return true; }
      if (near(cat.x, 18) && !(typeof FX !== 'undefined' && FX.catHides)) { cat.hop = 4; cat.react = 0.5; PETS.SND.load(); PETS.SND.play(cat.state === 'nap' ? 'purr' : 'meow'); hearts(cat.x, G.y - 20); return true; }
      for (const b of st.birds) if (Math.abs(x - b.x) < 8 && Math.abs(y - (G.y - 3 - b.h)) < 8) { scare(b.x, 24); return true; }
      if (G.kids && x > G.kids[0] - 10 && x < G.kids[1] + 10 && y > G.y - 70 && y < G.y + 4) { st.kids.high = 2.4; st.kids.cheer = 1.4; [880, 988, 1175].forEach((f, i) => tone('sine', f, i * 0.08, 0.12, 0.07)); return true; }
      for (const p of st.people) if (p.state !== 'slide' && near(p.x, 24)) { p.hop = 6; SFX.boop(1.2); return true; }
    }
    if (G.scoot && !sleeping && Math.abs(x - st.scoot.x) < 10 && y > G.y - 22 && y < G.y + 6) { st.scoot.dir *= -1; tone('sine', 1200, 0, 0.1, 0.06); tone('sine', 1200, 0.15, 0.1, 0.06); return true; }
    for (const w of st.walkers) if (near(w.x, 26, 10)) { w.wave = 1.5; w.hop = 5; SFX.boop(1.3); return true; }
    if (x > G.truck.x - 2 && x < G.truck.x + G.truck.w + 2 && y > G.y - 44 && y < G.y + 2) {
      SND.load(); SND.play('bell'); st.bell = 1.4;
      if (!sleeping && queue().length < 3) spawnCrew(false);   // the bell brings somebody running
      return true;
    }
    if (G.slide && !sleeping && Math.abs(x - G.slide.cx) < 16 && y > G.slide.top - 18 && y < G.y) {
      if (st.slideBusy <= 0) spawnCrew(true);
      return true;
    }
    return false;
  }
  function hearts(x, y) { sparkle(x, y, 4, 4, '#ff6fb4'); }

  return { layout, update, drawBack, drawFront, tap, get on() { return G.on; }, _st: st, _G: G, _cat: cat, _dogs: dogs };
})();
