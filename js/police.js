// Police mission: the officer holds up STOP so ducks, kids and grandmas can cross the street.
'use strict';
(() => {
  const CAR_W = 34, CAR_GAP = 8, CW_W = 46, PC_W = 56, ROAD_H = 58, TS_H = 14, BS_H = 14;
  const KINDS = ['ducks', 'balloon', 'gran', 'stroller', 'dog'];
  const st = {
    phase: 'arrive', stopOn: false, cars: [], groups: [], cop: null, pc: null, walkers: [],
    crossed: 0, spawned: 0, order: [], spawnT: 0, nextGap: 30, lastColor: -1,
    partyT: 0, stopSiren: null, yelpT: 0, far: [], near: [], houses: [], trees: [], bushes: [], lamps: [], litWins: [],
    roadY: 0, sw: 0, park: 0, cwX: 0,
  };

  /* ---------- small helpers ---------- */
  function rng(seed) {   // mulberry32: the town looks the same after every resize
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function line(x0, y0, x1, y1, c) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) R(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1, c);
  }
  function octagon(cx, cy, a, c) {   // a = inradius
    const s = Math.round(a * 0.414);
    for (let dy = -a; dy <= a; dy++) {
      const hw = Math.min(a, a + s - Math.abs(dy));
      R(cx - hw, cy + dy, hw * 2 + 1, 1, c);
    }
  }
  function star(cx, cy, r, c) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      let inside = false;
      for (let i = 0, j = 9; i < 10; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) R(x, y, 1, 1, c);
    }
  }
  const QMARK = '111001010000010';
  function bubble(x, y) {   // little "?" thought bubble, x/y = top-left
    R(x + 1, y, 11, 13, '#ffffff'); R(x, y + 1, 13, 11, '#ffffff');
    R(x + 3, y + 13, 2, 2, '#ffffff'); R(x + 2, y + 15, 1, 1, '#ffffff');
    for (let b = 0; b < 15; b++) if (QMARK[b] === '1') R(x + 3 + (b % 3) * 2, y + 2 + Math.floor(b / 3) * 2, 2, 2, '#2a6fe0');
  }
  const whistle = () => { for (let i = 0; i < 6; i++) tone('sine', i % 2 ? 2300 : 2000, i * 0.06, 0.07, 0.07); };
  const goSound = () => { tone('square', 523, 0, 0.1, 0.07); tone('square', 784, 0.1, 0.16, 0.07); };

  /* ---------- geometry ---------- */
  const yTop = () => st.roadY + 1;                     // feet of walkers waiting on the top curb
  const yBot = () => st.roadY + ROAD_H + 8;            // bottom sidewalk
  const farY = () => st.roadY + 26;                    // wheel baseline of the far lane
  const laneY = () => st.roadY + ROAD_H - 5;           // near lane (police car)
  const backY = () => st.sw + 6;                       // strollers on the back of the top sidewalk
  const parkX = () => W - L.safeR - PC_W - 6;
  const copSpot = () => st.cwX - 13;
  const waitX = () => st.cwX + CW_W / 2;
  const nearSun = (x, w, top) => x + w > L.sunX - 34 && x < L.sunX + 34 && top < L.sunY + 32;
  const hits = (a, x, y, w, h) => x < a.x + a.w && x + w > a.x && y < a.y + a.h && y + h > a.y;

  function buildTown() {
    const r = rng(20240611);
    const sw = st.sw, skyLine = Math.max(L.safeT + 24, Math.round(H * 0.3));
    const room = Math.max(20, sw - skyLine);
    const FAR = ['#a9bfe0', '#b9c6e6', '#c2b6e0', '#a7cfe0'], NEAR = ['#7f9fd1', '#9a88c9', '#6fb0c9', '#c98a88', '#8fb37a'];
    const make = (lo, hi, cols, minH) => {
      const out = [];
      let x = -4 - Math.floor(r() * 12);
      while (x < W + 4) {
        const w = 22 + Math.floor(r() * 22);
        let h = Math.max(minH, Math.round(room * (lo + r() * (hi - lo))));
        if (nearSun(x, w, sw - h)) h = Math.min(h, sw - (L.sunY + 32));
        const b = { x, y: sw - h, w, h, c: cols[Math.floor(r() * cols.length)], wins: [], roof: Math.floor(r() * 3) };
        const nc = Math.floor((w - 4) / 7), nr = Math.floor((h - 8) / 10);
        const ox = x + Math.floor((w - (nc * 7 - 4)) / 2);
        for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) b.wins.push({ x: ox + i * 7, y: b.y + 7 + j * 10, w: 3, h: 4, lit: r() < 0.55 });
        if (h > 0) out.push(b);
        x += w + Math.floor(r() * 6) - 1;
      }
      return out;
    };
    st.far = make(0.75, 1.0, FAR, 30);
    st.near = make(0.5, 0.78, NEAR, 34);
    // a row of houses and trees right behind the top sidewalk
    st.houses = []; st.trees = []; st.bushes = [];
    const HW = ['#f6d6a8', '#cfe3f7', '#f7c6c6', '#d8f0c8', '#fff0b3', '#e6d4f7'], RF = ['#c0504d', '#5a6fb0', '#8a4f9a', '#b06a3a', '#3f8a6a'];
    const AW = [['#e8222b', '#ffffff'], ['#2a6fe0', '#ffffff'], ['#3fb43a', '#fff27a']];
    const hMax = Math.max(30, Math.min(66, Math.round(room * 0.5)));
    let x = L.safeL - 6 - Math.floor(r() * 8), k = 0;
    while (x < W) {
      if (k++ % 2 === 0) {
        const w = 36 + Math.floor(r() * 12), h = Math.round(hMax * (0.75 + r() * 0.25)), rh = 10 + Math.floor(r() * 4);
        if (nearSun(x, w, sw - h - rh - 2)) { st.bushes.push({ x, w }); x += w + 4; continue; }
        const shop = r() < 0.35;
        const floors = Math.max(1, Math.floor((h - 14) / 14));
        const wins = [];
        for (let f = 0; f < floors; f++) for (const wx of [x + 5, x + w - 14]) {
          if (shop && f === floors - 1) continue;
          wins.push({ x: wx, y: sw - h + 5 + f * 14, w: 9, h: 8, lit: r() < 0.7, who: r() < 0.22 ? Math.floor(r() * 4) : -1, seed: r() * 9 });
        }
        st.houses.push({ x, y: sw - h, w, h, rh, c: HW[Math.floor(r() * HW.length)], roof: RF[Math.floor(r() * RF.length)], wins, shop: shop ? AW[Math.floor(r() * AW.length)] : null });
        x += w + 4;
      } else {
        const tr = 9 + Math.floor(r() * 4);
        if (nearSun(x, tr * 2, sw - 2 * tr - 12)) { st.bushes.push({ x, w: tr * 2 }); x += tr * 2 + 4; continue; }
        st.trees.push({ x: x + tr, r: tr });
        x += tr * 2 + 4;
      }
    }
    // make sure at least two windows wave at us
    const all = st.houses.flatMap(h => h.wins);
    if (all.filter(w => w.who >= 0).length < 2) all.filter((w, i) => i % 3 === 1).slice(0, 2).forEach((w, i) => { w.who = i; });
    st.lamps = [st.cwX - 32, st.cwX + CW_W + 26];
    // lit windows (night) that aren't hidden behind something in front of them
    const front = [...st.houses.map(h => ({ x: h.x - 3, y: h.y - h.rh - 2, w: h.w + 6, h: h.h + h.rh + 2 })),
      ...st.trees.map(t => ({ x: t.x - t.r, y: sw - 2 * t.r - 12, w: 2 * t.r + 1, h: 2 * t.r + 12 }))];
    const nearBoxes = st.near.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
    st.litWins = [];
    const ok = (wn, occ) => !occ.some(o => hits(o, wn.x, wn.y, wn.w, wn.h));
    for (const b of st.far) for (const wn of b.wins) if (wn.lit && ok(wn, [...nearBoxes, ...front])) st.litWins.push(wn);
    for (const b of st.near) for (const wn of b.wins) if (wn.lit && ok(wn, front)) st.litWins.push(wn);
    // the park below the street (only when the screen is tall)
    st.parkTrees = [];
    if (st.park >= 30) {
      for (let px = 14 + Math.floor(r() * 10); px < W - 10; px += 46 + Math.floor(r() * 20)) st.parkTrees.push({ x: px, r: 8 + Math.floor(r() * 3) });
    }
    st.flowers = Array.from({ length: Math.round(W / 9) }, () => ({ x: Math.floor(r() * W), y: r(), c: pickOne(['#ff6fb4', '#ffd21f', '#ffffff', '#ff7a6b', '#c39bff']) }));
  }

  /* ---------- entities ---------- */
  function newCar(x) {
    let ci;
    do { ci = Math.floor(Math.random() * 9); } while (ci === st.lastColor);
    st.lastColor = ci;
    const vmax = rand(34, 44);
    return { x, c: PALETTE[ci][2], v: vmax, vmax, rot: 0, hop: 0 };
  }
  function makeGroup(kind) {
    const P = (type, dx, extra) => Object.assign({ t: 'person', type, dx, skin: pickOne(SKIN), seed: Math.random() * 9 }, extra);
    let m, speed = 20;
    if (kind === 'ducks') m = [{ t: 'duck', big: true, dx: 14 }, { t: 'duck', dx: 2 }, { t: 'duck', dx: -8 }, { t: 'duck', dx: -18 }];
    else if (kind === 'balloon') m = [P(pickOne(['kid', 'kid3']), -2, { balloon: pickOne(['#e8222b', '#ff6fb4', '#ffd21f', '#3fb43a']) })];
    else if (kind === 'gran') { m = [P('gran', -2, { cane: true })]; speed = 13; }
    else if (kind === 'stroller') m = [{ t: 'stroller', dx: 10 }, P(pickOne(['dad', 'mom']), -10, { push: true })];
    else m = [{ t: 'dog', dx: 11 }, P('kid2', -10, { leash: true })];
    m.forEach((mm, i) => Object.assign(mm, { delay: kind === 'ducks' ? i * 0.3 : 0, p: 0, hop: 0, cheer: 0, seed: mm.seed || Math.random() * 9 }));
    return { kind, m, speed, x: -30, state: 'enter', t: 0 };
  }
  function newRound() {
    st.crossed = 0; st.spawned = 0; st.spawnT = 0.6;
    const k = KINDS.slice();
    for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [k[i], k[j]] = [k[j], k[i]]; }
    st.order = k.slice(0, 3);
  }

  const crossing = () => st.groups.some(gr => gr.state === 'cross');
  const crosswalkClear = () => !st.cars.some(c => c.x + CAR_W > st.cwX && c.x < st.cwX + CW_W);
  const waiting = () => st.groups.find(gr => gr.state === 'wait');

  function toggle() {
    if (st.phase === 'party') return;
    st.stopOn = !st.stopOn;
    if (st.stopOn) whistle(); else goSound();
    if (st.cop && st.cop.state !== 'hidden') sparkle(st.cop.x, yBot() - 36, 8, 6, st.stopOn ? '#ff7a6b' : '#8fe36b');
  }

  /* ---------- scene ---------- */
  SCENES.police = {
    view: [186, 200],
    groundY: () => st.sw,
    layout() {
      const extra = H - L.safeT - L.safeB - 280;
      st.park = extra >= 40 ? Math.min(90, Math.round(extra * 0.5)) : 0;
      st.roadY = L.palY - st.park - BS_H - ROAD_H;
      st.sw = st.roadY - TS_H;
      // crosswalk in the middle, but leave the police car room on the right in narrow views
      const cx = Math.min(L.cx, Math.round((W - L.safeR - PC_W - 10 + L.safeL) / 2) + 6);
      st.cwX = Math.round(cx - CW_W / 2);
      L.signR = Math.max(20, Math.round(L.blob / 2 + 6));
      L.signX = W - L.safeR - 8 - L.signR;
      L.signY = L.palY + Math.round(L.palH / 2) - 1;
      buildTown();
      if (st.pc && st.pc.state === 'parked') st.pc.x = parkX();
      if (st.cop && st.cop.state === 'stand') st.cop.x = copSpot();
      for (const gr of st.groups) if (gr.state === 'wait' || gr.state === 'cross') gr.x = waitX();
      const skyLine = Math.max(L.safeT + 24, Math.round(H * 0.3));
      if (scene === 'police') setClouds(L.sunY + 26, Math.max(L.sunY + 34, skyLine - 12));
    },
    enter() {
      if (st.stopSiren) st.stopSiren();
      st.phase = 'arrive'; st.stopOn = false; st.groups = []; st.partyT = 0; st.yelpT = 0;
      st.pc = { x: -PC_W - 10, v: 120, rot: 0, hop: 0, state: 'drive' };
      st.cop = { x: 0, state: 'hidden', hop: 0, cheer: 0 };
      st.cars = [];
      for (let x = W - 60; x > -30; x -= rand(62, 100)) st.cars.unshift(newCar(Math.round(x)));
      st.nextGap = rand(10, 60);
      st.walkers = [
        { type: 'mom', side: -1, x: st.cwX - 40, dir: -1, v: 11, hop: 0, wave: 0, seed: 1, skin: SKIN[1] },
        { type: 'chef', side: 1, x: st.cwX + CW_W + 40, dir: 1, v: 9, hop: 0, wave: 0, seed: 3, skin: SKIN[0] },
      ];
      st.stopSiren = siren('police');
      newRound();
      const skyLine = Math.max(L.safeT + 24, Math.round(H * 0.3));
      setClouds(L.sunY + 26, Math.max(L.sunY + 34, skyLine - 12));
    },
    leave() {
      if (st.stopSiren) st.stopSiren();
      st.stopSiren = null;
    },
    update(dt) {
      // police car
      const pc = st.pc;
      if (pc.state === 'drive') {
        const left = parkX() - pc.x;
        pc.v = Math.min(140, Math.max(45, left * 2.6));
        const nx = Math.min(parkX(), pc.x + pc.v * dt);
        pc.rot += (nx - pc.x) / 5; pc.x = nx;
        if (pc.x >= parkX() - 0.5) {
          pc.state = 'parked'; st.phase = 'out';
          if (st.stopSiren) st.stopSiren(); st.stopSiren = null;
          SFX.brake(); say(pick('police'));
          Object.assign(st.cop, { x: Math.min(W - 10, pc.x + 18), state: 'hop', hop: 0 });
        }
      }
      pc.hop = Math.max(0, pc.hop - dt * 2.5);
      if (st.yelpT > 0) { st.yelpT -= dt; if (st.yelpT <= 0 && st.stopSiren) { st.stopSiren(); st.stopSiren = null; } }
      // officer
      const cop = st.cop;
      if (cop.state === 'hop') { cop.hop += dt * 2.5; if (cop.hop >= 1) { cop.hop = 0; cop.state = 'walk'; } }
      else if (cop.state === 'walk') {
        cop.x = Math.max(copSpot(), cop.x - 48 * dt);
        if (cop.x <= copSpot()) { cop.state = 'stand'; if (st.phase === 'out') st.phase = 'play'; }
      }
      cop.cheer = Math.max(0, cop.cheer - dt);
      // strollers on the back of the sidewalk
      for (const w of st.walkers) {
        w.hop = Math.max(0, w.hop - dt); w.wave = Math.max(0, w.wave - dt);
        if (w.wave <= 0) w.x += w.dir * w.v * dt;
        // each one strolls up and down their own side, clear of the crosswalk
        const [lo, hi] = w.side < 0 ? [L.safeL + 8, st.cwX - 30] : [st.cwX + CW_W + 30, W - L.safeR - 8];
        if (w.x < lo) { w.x = lo; w.dir = 1; } else if (w.x > hi) { w.x = Math.max(lo, hi); w.dir = -1; }
      }
      // walkers
      if (pc.state === 'parked' && st.phase !== 'party') {
        st.spawnT -= dt;
        const busy = st.groups.some(gr => gr.state === 'enter' || gr.state === 'wait' || gr.state === 'cross');
        if (!busy && st.spawned < 3 && st.spawnT <= 0) { st.groups.push(makeGroup(st.order[st.spawned])); st.spawned++; }
      }
      for (const gr of st.groups) {
        gr.t += dt;
        for (const m of gr.m) { m.hop = Math.max(0, m.hop - dt); m.cheer = Math.max(0, m.cheer - dt); }
        if (gr.state === 'enter') {
          gr.x = Math.min(waitX(), gr.x + Math.min(80, 34 + Math.max(0, waitX() - gr.x - 80) * 0.4) * dt);
          if (gr.x >= waitX()) { gr.state = 'wait'; gr.t = 0; if (gr.kind === 'ducks') SFX.peep(); }
        } else if (gr.state === 'wait') {
          gr.x = waitX();
          if (st.stopOn && crosswalkClear()) {
            gr.state = 'cross'; gr.t = 0;
            if (gr.kind === 'ducks') SFX.quack(); else if (gr.kind === 'dog') SFX.woof(); else SFX.boop(1.2);
          }
        } else if (gr.state === 'cross') {
          const dist = yBot() - yTop();
          let done = true;
          for (const m of gr.m) {
            m.p = Math.min(dist, Math.max(0, (gr.t - m.delay) * gr.speed));
            if (m.p < dist) done = false;
          }
          if (gr.kind === 'ducks' && Math.random() < dt * 2.5) SFX.peep();
          if (done) {
            gr.state = 'off'; gr.t = 0; st.crossed++;
            for (const m of gr.m) { m.hop = 0.5; m.cheer = 1.4; }
            if (gr.kind === 'ducks') SFX.quack(); else if (gr.kind === 'dog') SFX.woof(); else SFX.chime();
            sparkle(gr.x, yBot() - 18, 18, 10);
            cop.cheer = 1.2;
            st.spawnT = 1.2;
            if (st.crossed >= 3) {
              st.phase = 'party'; st.partyT = 0; st.stopOn = false;
              SFX.fanfare(); say(pick('praise'));
            }
          }
        } else if (gr.state === 'off') {
          gr.x += 26 * dt;
          if (gr.x > W + 36) gr.state = 'gone';
        }
      }
      st.groups = st.groups.filter(gr => gr.state !== 'gone');
      // traffic: brake for STOP (or anyone on the crosswalk), queue up, never overlap
      const hold = st.stopOn || crossing(), stopX = st.cwX - 5;
      st.cars.sort((a, b) => b.x - a.x);
      let ahead = null;
      for (const c of st.cars) {
        let lim = ahead ? ahead.x - CAR_W - CAR_GAP : Infinity;
        if (hold && c.x + CAR_W <= st.cwX + 0.01) lim = Math.min(lim, Math.max(c.x, stopX - CAR_W));
        const room = Math.max(0, lim - c.x);
        c.v = Math.min(c.vmax, c.v + 50 * dt, Math.sqrt(2 * 140 * room));
        const nx = Math.min(c.x + c.v * dt, Math.max(c.x, lim));
        c.rot += (nx - c.x) / 4; c.x = nx;
        c.hop = Math.max(0, c.hop - dt * 2.5);
        ahead = c;
      }
      st.cars = st.cars.filter(c => c.x < W + 12);
      const back = st.cars.length ? st.cars[st.cars.length - 1].x : Infinity;
      if (back > -CAR_W - 4 + CAR_W + CAR_GAP + st.nextGap) { st.cars.push(newCar(-CAR_W - 4)); st.nextGap = rand(10, 70); }
      // party
      if (st.phase === 'party') {
        st.partyT += dt;
        if (st.partyT < 1.5) confetti();
      }
    },

    drawWorld() {
      drawHeli();
      const sw = st.sw;
      for (const b of st.far) drawBuilding(b, '#e9f1fb');
      for (const b of st.near) drawBuilding(b, '#dfeaf7');
      R(0, sw - 6, W, 6, '#6cbf5a');
      for (const h of st.houses) drawHouse(h);
      for (const t of st.trees) drawTree(t.x, sw, t.r);
      for (const b of st.bushes) for (let bx = b.x + 5; bx < b.x + b.w; bx += 9) { circle(bx, sw - 4, 5, '#3f9a45'); circle(bx - 1, sw - 6, 3, '#5bb85a'); }
      // top sidewalk
      R(0, sw, W, TS_H, '#d9d3c4'); R(0, sw, W, 1, '#ece7da');
      for (let x = 6; x < W; x += 16) R(x, sw + 1, 1, TS_H - 1, '#c4bdac');
      for (const lx of st.lamps) {
        R(lx - 1, sw - 40, 2, 46, '#4d5560'); R(lx - 2, sw + 4, 4, 3, '#3a3f48');
        R(lx - 1, sw - 42, 7, 2, '#4d5560'); R(lx + 2, sw - 41, 6, 3, '#3a3f48'); R(lx + 3, sw - 38, 4, 1, '#fff6b0');
      }
      for (const w of st.walkers) drawPerson({ type: w.type, x: w.x, yb: backY(), dir: w.dir, pose: w.wave > 0 ? 'wave' : 'stand', walk: w.wave <= 0, hop: Math.round(Math.sin(Math.min(1, w.hop / 0.5) * Math.PI) * 4), skin: w.skin, seed: w.seed });
      // road
      const ry = st.roadY;
      R(0, ry, W, ROAD_H, '#4b4f5c');
      R(0, ry, W, 3, '#bdb8ac'); R(0, ry + 3, W, 1, '#8f8b80');
      R(0, ry + ROAD_H - 3, W, 3, '#bdb8ac');
      for (let x = 4; x < W; x += 20) R(x, ry + 29, 10, 2, '#ffd21f');
      for (let y = ry + 5; y < ry + ROAD_H - 5; y += 6) R(st.cwX, y, CW_W, 3, '#f4f7fb');   // zebra crossing
      R(st.cwX - 6, ry + 5, 2, 23, '#f4f7fb');                                                // stop line
      // bottom sidewalk and the park
      const by = ry + ROAD_H;
      R(0, by, W, BS_H, '#d9d3c4'); R(0, by + BS_H - 1, W, 1, '#bdb8ac');
      for (let x = 10; x < W; x += 16) R(x, by, 1, BS_H - 1, '#c4bdac');
      if (st.park > 0) drawPark(by + BS_H, st.park);
      // walkers on the top sidewalk are behind the traffic
      for (const gr of st.groups) if (gr.state === 'enter' || gr.state === 'wait') drawGroup(gr);
      for (const c of st.cars) drawCar(c.x, farY() - Math.round(Math.sin(c.hop * Math.PI) * 6), c.c, c.rot);
      const pc = st.pc;
      drawV(VI.police, pc.x, laneY() - Math.round(Math.sin(pc.hop * Math.PI) * 5), true, 0, pc.rot);
      for (const gr of st.groups) if (gr.state === 'cross' || gr.state === 'off') drawGroup(gr);
      drawCop();
    },
    drawLit() {
      const k = nightK();
      if (k > 0.02) alpha(k, () => {
        for (const wn of st.litWins) R(wn.x, wn.y, wn.w, wn.h, '#ffe27a');
        for (const h of st.houses) for (const wn of h.wins) if (wn.lit) { R(wn.x + 1, wn.y + 1, wn.w - 2, wn.h - 2, '#ffe27a'); if (wn.who >= 0) windowFriend(wn); }
        const sw = st.sw;
        for (const lx of st.lamps) {
          alpha(0.3, () => circle(lx + 5, sw - 38, 7, '#ffe27a'));
          alpha(0.14, () => { for (let i = 0; i < 44; i++) R(lx + 5 - 2 - i * 0.4, sw - 37 + i, 4 + i * 0.8, 1, '#ffe27a'); });
          R(lx + 3, sw - 38, 4, 1, '#ffffff');
        }
        for (const c of st.cars) carLights(c.x, farY() - Math.round(Math.sin(c.hop * Math.PI) * 6));
      });
      drawParticles();
    },
    drawUI() {
      drawStrip();
      drawHomeButton();
      if (st.phase === 'party') {
        if (st.partyT > 1.0) drawAgainButton(L.againBtn, '#2a6fe0', '#1a3f9a', (cx, cy, s) => {
          star(cx, cy + 1, s * 0.34, '#a3741a'); star(cx, cy, s * 0.34, '#ffd21f'); star(cx - 1, cy - 1, s * 0.16, '#fff27a');
        });
        return;
      }
      const x = L.signX, y = L.signY, r = L.signR;
      const hint = (!st.stopOn && !!waiting()) || (st.stopOn && !crossing() && !waiting() && st.groups.every(gr => gr.state !== 'enter'));
      roundButton(x, y, r, '#ffffff', hint);
      if (!st.stopOn) {
        octagon(x, y, r - 1, '#ffffff'); octagon(x, y, r - 3, '#e8222b');
        R(x - r + 6, y + 7, 2 * r - 11, 1, '#a3121d');
        text('STOP', x - Math.floor(textWidth('STOP', 2) / 2), y - 5, 2, '#ffffff');
      } else {
        circle(x, y, r - 1, '#1f7a2a'); circle(x, y - 1, r - 2, '#3fb43a'); circle(x - 5, y - 6, 3, '#8fe36b');
        text('GO', x - Math.floor(textWidth('GO', 3) / 2), y - 7, 3, '#ffffff');
      }
    },
    tap(x, y) {
      if (inBox(L.homeBtn, x, y)) { returnHome(VI.police); return true; }
      if (st.phase === 'party') {
        if (st.partyT > 1.0 && inBox(L.againBtn, x, y)) {
          newRound(); st.phase = 'play'; st.stopOn = false; SFX.chime();
          sparkle(L.cx, L.againBtn.y, 20, 12);
          return true;
        }
      } else if ((x - L.signX) ** 2 + (y - L.signY) ** 2 < (L.signR + 6) ** 2) { toggle(); return true; }
      const cop = st.cop;
      if (cop.state !== 'hidden' && st.phase !== 'party' && Math.abs(x - cop.x) < 14 && y > yBot() - 44 && y < yBot() + 5) { toggle(); return true; }
      // walkers waiting or crossing
      for (const gr of st.groups) for (const m of gr.m) {
        const mx = gr.x + m.dx, my = memberY(gr, m), h = m.t === 'person' ? personH(m.type) : m.t === 'duck' && !m.big ? 10 : 18;
        if (Math.abs(x - mx) < 11 && y > my - h - 6 && y < my + 5) {
          for (const mm of gr.m) mm.hop = 0.5;
          if (gr.kind === 'ducks') { m.big ? SFX.quack() : SFX.peep(); }
          else if (gr.kind === 'dog' && m.t === 'dog') SFX.woof();
          else SFX.boop(1 + Math.random() * 0.4);
          sparkle(mx, my - h, 8, 5);
          return true;
        }
      }
      // police car
      const pc = st.pc;
      if (x >= pc.x - 2 && x < pc.x + PC_W + 2 && y > laneY() - 32 && y < laneY() + 3) {
        pc.hop = 1;
        if (pc.state === 'parked' && !st.stopSiren) { st.stopSiren = siren('police'); st.yelpT = 1.2; }
        else SFX.beep();
        return true;
      }
      for (const c of st.cars) if (x >= c.x - 2 && x < c.x + CAR_W + 2 && y > farY() - 22 && y < farY() + 3) {
        c.hop = 1;
        Math.random() < 0.5 ? SFX.beep() : SFX.honk();
        return true;
      }
      for (const w of st.walkers) if (Math.abs(x - w.x) < 10 && y > backY() - 26 && y < backY() + 3) {
        w.hop = 0.5; w.wave = 1.2; SFX.boop(1.3);
        return true;
      }
      return false;
    },
  };

  /* ---------- drawing ---------- */
  function drawBuilding(b, win) {
    R(b.x, b.y, b.w, b.h, b.c);
    R(b.x, b.y, b.w, 2, mix(b.c, '#ffffff', 0.35)); R(b.x + b.w - 2, b.y, 2, b.h, mix(b.c, '#000000', 0.12));
    if (b.roof === 1) { R(b.x + 3, b.y - 3, 6, 3, mix(b.c, '#000000', 0.2)); }
    else if (b.roof === 2) { R(b.x + Math.floor(b.w / 2), b.y - 8, 1, 8, '#6b7480'); R(b.x + Math.floor(b.w / 2), b.y - 9, 1, 1, '#e8222b'); }
    for (const wn of b.wins) R(wn.x, wn.y, wn.w, wn.h, win);
  }
  function drawHouse(h) {
    const cx = h.x + h.w / 2;
    R(h.x + h.w - 11, h.y - h.rh - 2, 5, 9, '#9a5a3a');
    for (let i = 0; i < h.rh; i++) {
      const hw = Math.round((h.w / 2 + 3) * (i + 1) / h.rh);
      R(cx - hw, h.y - h.rh + i, hw * 2, 1, i === h.rh - 1 ? mix(h.roof, '#000000', 0.25) : h.roof);
    }
    R(h.x, h.y, h.w, h.h, h.c); R(h.x, h.y, 1, h.h, mix(h.c, '#000000', 0.12));
    for (const wn of h.wins) {
      R(wn.x - 1, wn.y - 1, wn.w + 2, wn.h + 2, '#ffffff'); R(wn.x, wn.y, wn.w, wn.h, GLASS);
      if (wn.who >= 0) windowFriend(wn);
      if (wn.who < 0) R(wn.x + Math.floor(wn.w / 2), wn.y, 1, wn.h, '#ffffff');
      R(wn.x - 1, wn.y + wn.h + 1, wn.w + 2, 1, mix(h.c, '#000000', 0.2));
    }
    if (h.shop) {   // little shop: striped awning and a big window
      const ay = h.y + h.h - 22;
      for (let i = 0; i < h.w + 4; i += 4) R(h.x - 2 + i, ay, 4, 5, (i / 4) % 2 ? h.shop[1] : h.shop[0]);
      for (let i = 0; i < h.w + 4; i += 4) R(h.x - 1 + i, ay + 5, 2, 1, (i / 4) % 2 ? h.shop[1] : h.shop[0]);
      R(h.x + 3, ay + 8, h.w - 18, 12, '#ffffff'); R(h.x + 4, ay + 9, h.w - 20, 10, GLASS);
      R(h.x + 6, ay + 15, 4, 4, '#ffb15a'); R(h.x + 11, ay + 16, 4, 3, '#ff6fb4');   // cakes in the window
      R(h.x + h.w - 12, h.y + h.h - 13, 8, 13, '#8a5a3a'); R(h.x + h.w - 6, h.y + h.h - 7, 1, 1, '#ffd21f');
    } else {
      R(cx - 4, h.y + h.h - 13, 8, 13, '#8a5a3a'); R(cx - 4, h.y + h.h - 13, 8, 1, '#6b4228'); R(cx + 2, h.y + h.h - 7, 1, 1, '#ffd21f');
    }
  }
  // Someone at a window, waving at the street.
  function windowFriend(wn) {
    const SK = [SKIN[0], SKIN[1], SKIN[2], SKIN[0]], HAIR = ['#5a3a22', '#2f3240', '#a3471d', '#dfe3ea'], SH = ['#ff6fb4', '#3fb43a', '#ffd21f', '#8a4fd9'];
    const x = wn.x + 2, y = wn.y + 2, wave = Math.floor(T * 4 + wn.seed) % 2;
    R(x - 1, y + 4, 6, 2, SH[wn.who]);
    R(x, y, 4, 4, SK[wn.who]); R(x, y - 1, 4, 1, HAIR[wn.who]); R(x + 1, y + 1, 1, 1, INK); R(x + 3, y + 1, 1, 1, INK);
    R(x + 5, y - (wave ? 1 : 0), 1, 3, SK[wn.who]);
  }
  function drawPark(top, h) {
    R(0, top, W, L.palY - top, '#6cbf5a');
    R(0, top, W, 2, '#5aa84c');
    for (const f of st.flowers) { const fy = top + 4 + Math.floor(f.y * (h - 8)); R(f.x, fy, 2, 2, f.c); R(f.x, fy + 2, 1, 2, '#3f9a45'); }
    if (h < 30) return;
    // a winding path, trees and a bench with someone resting
    const py = top + Math.round(h * 0.55);
    R(0, py, W, 6, '#e3d6b4'); R(0, py, W, 1, '#f0e6c8');
    for (const t of st.parkTrees) drawTree(t.x, py - 1, t.r);
    const bx = Math.round(W * 0.36), seat = py - 7;
    R(bx - 12, seat - 9, 26, 2, '#a86b45'); R(bx - 10, seat - 7, 2, 6, '#4d5560'); R(bx + 10, seat - 7, 2, 6, '#4d5560');
    R(bx - 12, seat - 1, 26, 2, '#a86b45'); R(bx - 12, seat + 1, 26, 1, '#7a4a2a');
    R(bx - 10, seat + 2, 2, py - seat - 1, '#4d5560'); R(bx + 10, seat + 2, 2, py - seat - 1, '#4d5560');
    drawPerson({ type: 'gran', x: bx - 4, yb: seat - 1, dir: 1, pose: 'sit', skin: SKIN[0], seed: 2 });
    drawPerson({ type: 'kid3', x: bx + 6, yb: seat - 1, dir: 1, pose: 'eat', skin: SKIN[2], seed: 5 });
  }
  function carLights(x, yb) {   // little cars: headlight beam + taillight
    const y = Math.floor(yb) - 18;
    for (let j = 0; j < 22; j++) { const half = 1 + j * 0.22; alpha(0.28 * (1 - j / 24), () => R(x + CAR_W + j, y + 11 - half, 1, half * 2, '#fff3b0')); }
    R(x + 33, y + 10, 1, 2, '#fffbe6');
    alpha(0.5, () => { circle(x + 34, y + 11, 2, '#fff3b0'); circle(x, y + 11, 2, '#ff3b3b'); });
    R(x, y + 10, 1, 2, '#ff4a3a');
  }
  function memberY(gr, m) {
    if (gr.state === 'enter' || gr.state === 'wait') return yTop();
    if (gr.state === 'cross') return yTop() + m.p;
    return yBot();
  }
  function drawBigDuck(x, yb, big, step) {
    x = Math.floor(x); yb = Math.floor(yb);
    if (big) {
      const bx = x - 8, t = yb - 15, Wh = '#f4f7fb', Sh = '#cfd8e2', O = '#f57a12';
      R(bx, t + 6, 3, 3, Wh); R(bx + 1, t + 7, 12, 5, Wh); R(bx, t + 8, 14, 3, Wh);
      R(bx + 3, t + 8, 6, 3, Sh); R(bx + 2, t + 11, 10, 1, Sh);
      R(bx + 10, t + 1, 5, 8, Wh); R(bx + 11, t, 3, 1, Wh);
      R(bx + 12, t + 2, 1, 2, INK); R(bx + 15, t + 3, 3, 2, O); R(bx + 15, t + 5, 2, 1, '#b14c06');
      R(bx + 5 + step, t + 12, 3, 3, O); R(bx + 9 - step, t + 12, 3, 3, O);
    } else {
      const bx = x - 5, t = yb - 9, Y = '#ffd21f', O = '#f57a12';
      R(bx, t + 4, 7, 4, Y); R(bx + 1, t + 3, 5, 1, Y); R(bx + 5, t, 4, 5, Y);
      R(bx + 1, t + 4, 3, 2, '#e0b010'); R(bx + 7, t + 1, 1, 1, INK); R(bx + 9, t + 2, 2, 1, O);
      R(bx + 2 + step, t + 8, 2, 1, O); R(bx + 5 - step, t + 8, 2, 1, O);
    }
  }
  function drawStroller(x, yb) {
    x = Math.floor(x); yb = Math.floor(yb);
    const P = '#ff6fb4', PD = '#c73d84';
    R(x - 9, yb - 15, 1, 9, '#4d5560');
    R(x - 8, yb - 13, 16, 7, P); R(x - 8, yb - 13, 16, 1, '#ffb3da'); R(x - 8, yb - 7, 16, 1, PD);
    R(x + 1, yb - 19, 7, 6, PD); R(x + 2, yb - 20, 5, 1, PD); R(x + 2, yb - 18, 5, 1, '#e0559a');
    R(x - 5, yb - 16, 4, 3, SKIN[0]); R(x - 5, yb - 17, 4, 1, '#5a3a22'); R(x - 3, yb - 15, 1, 1, INK);
    R(x - 6, yb - 6, 1, 3, '#4d5560'); R(x + 5, yb - 6, 1, 3, '#4d5560');
    for (const wx of [x - 5, x + 5]) { circle(wx, yb - 3, 3, TIRE); R(wx, yb - 3, 1, 1, '#cfd6dd'); }
  }
  function drawDog(x, yb, step) {
    x = Math.floor(x); yb = Math.floor(yb);
    const bx = x - 8, t = yb - 12, c = '#c08a52', d = '#8a5a32', lt = '#e8c39a';
    R(bx + 2, t + 5, 10, 4, c); R(bx + 3, t + 8, 8, 1, lt); R(bx + 5, t + 5, 3, 2, d);
    for (const [lx, s] of [[2, 0], [4, 1], [9, 0], [11, 1]]) R(bx + lx, t + 9, 2, 3 - (step === s ? 1 : 0), d);
    R(bx + 10, t + 1, 5, 5, c); R(bx + 14, t + 3, 2, 3, lt); R(bx + 15, t + 3, 1, 1, INK);
    R(bx + 12, t + 2, 1, 1, INK); R(bx + 10, t + 1, 2, 4, d); R(bx + 14, t + 6, 1, 1, '#ff6fb4');
    R(bx + 10, t + 6, 3, 1, '#e8222b');
    R(bx, t + 2 + (Math.floor(T * 8) % 2), 2, 4, c);
  }
  function drawGroup(gr) {
    const moving = gr.state !== 'wait';
    const step = moving ? Math.floor(T * 8) % 2 : 0;
    for (const m of gr.m) {
      const mx = Math.floor(gr.x + m.dx);
      let yb = memberY(gr, m);
      const walking = gr.state === 'enter' || gr.state === 'off' || (gr.state === 'cross' && m.p > 0 && m.p < yBot() - yTop());
      let lift = 0;
      if (m.hop > 0) lift = Math.round(Math.sin((1 - m.hop / 0.5) * Math.PI) * 6);
      else if (gr.state === 'wait') lift = Math.round(Math.abs(Math.sin(T * 5 + m.seed)) * 1.5);
      yb -= lift;
      if (m.t === 'duck') drawBigDuck(mx, yb, m.big, walking ? step : 0);
      else if (m.t === 'stroller') drawStroller(mx, yb + lift);
      else if (m.t === 'dog') drawDog(mx, yb, walking ? step : -1);
      else {
        const holding = m.balloon || m.cane || m.push || m.leash;
        let pose = holding ? 'carry' : 'stand';
        if (m.cheer > 0 && !m.balloon && !m.push && !m.leash) pose = 'cheer';
        else if (gr.state === 'wait' && !holding) pose = 'wave';
        drawPerson({ type: m.type, x: mx, yb, dir: 1, pose, walk: walking, skin: m.skin, seed: m.seed });
        const top = yb - personH(m.type), hx = mx + 5, hy = top + 11;   // the front hand in the 'carry' pose
        if (m.cane && pose === 'carry') R(hx, hy, 1, yb - hy, '#7a4a2a');
        if (m.push) { const s = gr.m.find(o => o.t === 'stroller'); if (s) line(hx, hy, Math.floor(gr.x + s.dx) - 9, Math.floor(memberY(gr, s)) - 15, '#4d5560'); }
        if (m.leash) { const dog = gr.m.find(o => o.t === 'dog'); if (dog) line(hx, hy, Math.floor(gr.x + dog.dx) + 3, Math.floor(memberY(gr, dog)) - 6, '#e8222b'); }
        if (m.balloon) {
          const sway = Math.round(Math.sin(T * 2 + m.seed) * 1.5), bx = hx + 2 + sway, by = yb - 38;
          line(hx, hy, bx, by + 6, '#ffffff');
          circle(bx, by, 6, m.balloon); R(bx - 3, by - 3, 2, 2, '#ffffff'); R(bx, by + 6, 1, 1, m.balloon);
        }
      }
    }
    if (gr.state === 'wait' && Math.floor(T * 1.5) % 3 !== 2) {
      const lead = gr.m.reduce((a, b) => (a.dx < b.dx ? a : b));
      bubble(Math.floor(gr.x + lead.dx) - 16, yTop() - 44 + Math.round(Math.sin(T * 3) * 1.5));
    }
  }
  function drawCop() {
    const c = st.cop;
    if (!c || c.state === 'hidden') return;
    const yb = yBot();
    let hop = 0;
    if (c.state === 'hop') hop = Math.round(Math.sin(c.hop * Math.PI) * 9);
    const walking = c.state === 'walk' || (c.state === 'hop' && c.hop > 0.5);
    let pose = 'stand';
    if (st.phase === 'party' || c.cheer > 0) pose = 'cheer';
    else if (c.state === 'stand') pose = st.stopOn ? 'carry' : 'wave';
    drawPerson({ type: 'cop', x: c.x, yb, dir: -1, pose, walk: walking, hop, seed: 1 });
    if (pose === 'carry') {   // lollipop STOP sign held up high
      const top = yb - hop - 22, px = Math.floor(c.x) - 6;
      R(px, top - 9, 1, 21, '#6b7480');
      octagon(px, top - 15, 7, '#ffffff'); octagon(px, top - 15, 6, '#e8222b');
      R(px - 4, top - 16, 9, 2, '#ffffff');
    }
  }
})();
