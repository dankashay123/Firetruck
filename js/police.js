// Police mission: the officer holds up STOP so ducks, kids and grandmas can cross the street.
'use strict';
(() => {
  const CAR_W = 34, CAR_GAP = 8, CW_W = 40, PC_W = 56;
  const KINDS = ['ducks', 'balloon', 'gran', 'stroller', 'dog'];
  const st = {
    phase: 'arrive', stopOn: false, cars: [], groups: [], cop: null, pc: null,
    crossed: 0, spawned: 0, order: [], spawnT: 0, nextGap: 30, lastColor: -1,
    partyT: 0, stopSiren: null, yelpT: 0, far: [], near: [], houses: [], trees: [], lamps: [], litWins: [],
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
    R(x + 1, y, 9, 11, '#ffffff'); R(x, y + 1, 11, 9, '#ffffff');
    R(x + 2, y + 11, 2, 2, '#ffffff'); R(x + 1, y + 13, 1, 1, '#ffffff');
    for (let b = 0; b < 15; b++) if (QMARK[b] === '1') R(x + 4 + (b % 3), y + 3 + Math.floor(b / 3), 1, 1, '#2a6fe0');
  }
  const whistle = () => { for (let i = 0; i < 6; i++) tone('sine', i % 2 ? 2300 : 2000, i * 0.06, 0.07, 0.07); };
  const goSound = () => { tone('square', 523, 0, 0.1, 0.07); tone('square', 784, 0.1, 0.16, 0.07); };

  /* ---------- geometry ---------- */
  const yTop = () => L.roadY;                      // feet of walkers waiting on the top curb
  const yBot = () => L.roadY + L.roadH - 1;        // bottom curb
  const farY = () => L.roadY + 22;                 // wheel baseline of the far lane
  const parkX = () => W - L.safeR - PC_W - 8;
  const copSpot = () => st.cwX - 12;
  const waitX = () => st.cwX + CW_W / 2;

  function hillTop(x) {   // matches drawHills
    const hy = L.hillY;
    let y = hy + 8;
    for (const [cx, cy, r] of [[W * 0.12, hy + 34, 56], [W * 0.88, hy + 40, 60], [W * 0.5, hy + 60, 90]]) {
      const dx = x - cx;
      if (Math.abs(dx) <= r) y = Math.min(y, cy - Math.sqrt(r * r - dx * dx));
    }
    return y;
  }
  const hits = (a, x, y, w, h) => x < a.x + a.w && x + w > a.x && y < a.y + a.h && y + h > a.y;

  function buildTown() {
    const r = rng(20240611), avail = L.hillY - L.safeT;
    const tall = (x, w, h) => (x + w > L.sunX - 40 && x < L.sunX + 40) ? Math.min(h, L.hillY - (L.sunY + 34)) : h;
    const FAR = ['#a9bfe0', '#b9c6e6', '#c2b6e0', '#a7cfe0'], NEAR = ['#7f9fd1', '#9a88c9', '#6fb0c9', '#c98a88', '#8fb37a'];
    const make = (lo, hi, cols, base, minH) => {
      const out = [];
      let x = -4 - Math.floor(r() * 12);
      while (x < W + 4) {
        const w = 22 + Math.floor(r() * 22);
        const h = Math.max(minH, Math.round(tall(x, w, avail * (lo + r() * (hi - lo)))));
        const b = { x, y: base - h, w, h, c: cols[Math.floor(r() * cols.length)], wins: [], roof: Math.floor(r() * 3) };
        const nc = Math.floor((w - 4) / 7), nr = Math.floor((h - 8) / 10);
        const ox = x + Math.floor((w - (nc * 7 - 4)) / 2);
        for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) b.wins.push({ x: ox + i * 7, y: b.y + 7 + j * 10, w: 3, h: 4, lit: r() < 0.55 });
        out.push(b);
        x += w + Math.floor(r() * 6) - 1;
      }
      return out;
    };
    const base = L.hillY + 12;
    st.far = make(0.34, 0.66, FAR, base, 30);
    st.near = make(0.16, 0.36, NEAR, base, 34);
    // houses and trees on the top sidewalk
    const sw = L.roadY - 8;
    st.houses = []; st.trees = [];
    const HW = ['#f6d6a8', '#cfe3f7', '#f7c6c6', '#d8f0c8', '#fff0b3', '#e6d4f7'], RF = ['#c0504d', '#5a6fb0', '#8a4f9a', '#b06a3a', '#3f8a6a'];
    let x = L.safeL - 6 - Math.floor(r() * 8), k = 0;
    while (x < W) {
      if (k++ % 2 === 0) {
        const w = 34 + Math.floor(r() * 12), h = 24 + Math.floor(r() * 8);
        st.houses.push({ x, y: sw - h, w, h, rh: 10 + Math.floor(r() * 4), c: HW[Math.floor(r() * HW.length)], roof: RF[Math.floor(r() * RF.length)], lit: [r() < 0.7, r() < 0.7] });
        x += w + 4;
      } else {
        const tr = 8 + Math.floor(r() * 4);
        st.trees.push({ x: x + tr, r: tr });
        x += tr * 2 + 4;
      }
    }
    st.lamps = [st.cwX - 30, st.cwX + CW_W + 30];
    // lit windows (night) that aren't hidden behind something in front of them
    const front = [...st.houses.map(h => ({ x: h.x - 2, y: h.y - h.rh, w: h.w + 4, h: h.h + h.rh })),
      ...st.trees.map(t => ({ x: t.x - t.r, y: sw - 2 * t.r - 12, w: 2 * t.r + 1, h: 2 * t.r + 12 }))];
    const nearBoxes = st.near.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
    st.litWins = [];
    const ok = (wn, occ) => wn.y + wn.h <= hillTop(wn.x) && wn.y + wn.h <= hillTop(wn.x + wn.w) && !occ.some(o => hits(o, wn.x, wn.y, wn.w, wn.h));
    for (const b of st.far) for (const wn of b.wins) if (wn.lit && ok(wn, [...nearBoxes, ...front])) st.litWins.push(wn);
    for (const b of st.near) for (const wn of b.wins) if (wn.lit && ok(wn, front)) st.litWins.push(wn);
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
    if (kind === 'ducks') m = [{ t: 'duck', big: true, dx: 12 }, { t: 'duck', dx: 3 }, { t: 'duck', dx: -5 }, { t: 'duck', dx: -13 }];
    else if (kind === 'balloon') m = [P(pickOne(['kid', 'kid3']), 0, { balloon: pickOne(['#e8222b', '#ff6fb4', '#ffd21f', '#3fb43a']) })];
    else if (kind === 'gran') { m = [P('gran', 0, { cane: true })]; speed = 13; }
    else if (kind === 'stroller') m = [{ t: 'stroller', dx: 8 }, P('dad', -7, { push: true })];
    else m = [{ t: 'dog', dx: 10 }, P('kid2', -6, { leash: true })];
    m.forEach((mm, i) => Object.assign(mm, { delay: kind === 'ducks' ? i * 0.3 : 0, p: 0, hop: 0, cheer: 0, seed: mm.seed || Math.random() * 9 }));
    return { kind, m, speed, x: -26, state: 'enter', t: 0 };
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
    if (st.stopOn) { whistle(); } else { goSound(); }
    if (st.cop && st.cop.state !== 'hidden') sparkle(st.cop.x, yBot() - 30, 8, 6, st.stopOn ? '#ff7a6b' : '#8fe36b');
  }

  /* ---------- scene ---------- */
  SCENES.police = {
    groundY: () => L.hillY,
    layout() {
      st.cwX = Math.round(L.cx - CW_W / 2);
      L.signR = Math.round(L.blob / 2 + 6);
      L.signX = W - L.safeR - 10 - L.signR;
      L.signY = L.palY + Math.round(L.palH / 2);
      buildTown();
      if (st.pc && st.pc.state === 'parked') st.pc.x = parkX();
      if (st.cop && st.cop.state === 'stand') st.cop.x = copSpot();
      for (const gr of st.groups) if (gr.state === 'wait' || gr.state === 'cross') gr.x = waitX();
      if (scene === 'police') setClouds(L.safeT + 70, Math.max(L.safeT + 90, L.hillY - (L.hillY - L.safeT) * 0.7));
    },
    enter() {
      if (st.stopSiren) st.stopSiren();
      st.phase = 'arrive'; st.stopOn = false; st.groups = []; st.partyT = 0; st.yelpT = 0;
      st.pc = { x: -PC_W - 10, v: 120, rot: 0, hop: 0, state: 'drive' };
      st.cop = { x: 0, state: 'hidden', hop: 0, cheer: 0 };
      st.cars = [];
      for (let x = W - 60; x > -30; x -= rand(62, 100)) st.cars.unshift(newCar(Math.round(x)));
      st.nextGap = rand(10, 60);
      st.stopSiren = siren('police');
      newRound();
      setClouds(L.safeT + 70, Math.max(L.safeT + 90, L.hillY - (L.hillY - L.safeT) * 0.7));
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
          Object.assign(st.cop, { x: pc.x + 18, state: 'hop', hop: 0 });
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
            sparkle(gr.x, yBot() - 14, 16, 10);
            cop.cheer = 1.2;
            st.spawnT = 1.2;
            if (st.crossed >= 3) {
              st.phase = 'party'; st.partyT = 0; st.stopOn = false;
              SFX.fanfare(); say(pick('praise'));
            }
          }
        } else if (gr.state === 'off') {
          gr.x += 26 * dt;
          if (gr.x > W + 30) gr.state = 'gone';
        }
      }
      st.groups = st.groups.filter(gr => gr.state !== 'gone');
      // traffic
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
      for (const b of st.far) drawBuilding(b, '#e9f1fb');
      for (const b of st.near) drawBuilding(b, '#dfeaf7');
      drawHills(L.hillY, L.floorY);
      const sw = L.roadY - 8;
      R(0, sw, W, 8, '#d9d3c4'); R(0, sw, W, 1, '#ece7da');
      for (let x = 6; x < W; x += 14) R(x, sw + 1, 1, 7, '#c4bdac');
      for (const h of st.houses) drawHouse(h);
      for (const t of st.trees) drawTree(t.x, sw, t.r);
      for (const lx of st.lamps) {
        R(lx - 1, sw - 34, 2, 36, '#4d5560'); R(lx - 2, sw - 2, 4, 3, '#3a3f48');
        R(lx - 1, sw - 36, 6, 2, '#4d5560'); R(lx + 2, sw - 35, 5, 3, '#3a3f48'); R(lx + 3, sw - 32, 3, 1, '#fff6b0');
      }
      drawRoad();
      // zebra crosswalk
      for (let y = L.roadY + 5; y < L.roadY + L.roadH - 5; y += 6) R(st.cwX, y, CW_W, 3, '#f4f7fb');
      R(st.cwX - 6, L.roadY + 4, 2, 19, '#f4f7fb');   // stop line in the far lane
      // walkers still on the top sidewalk sit behind the traffic
      for (const gr of st.groups) if (gr.state === 'enter' || gr.state === 'wait') drawGroup(gr);
      for (const c of st.cars) drawCar(c.x, farY() - Math.round(Math.sin(c.hop * Math.PI) * 6), c.c, c.rot);
      const pc = st.pc;
      drawV(VI.police, pc.x, L.laneY - Math.round(Math.sin(pc.hop * Math.PI) * 5), true, 0, pc.rot);
      for (const gr of st.groups) if (gr.state === 'cross' || gr.state === 'off') drawGroup(gr);
      drawCop();
    },
    drawLit() {
      const k = nightK();
      if (k > 0.02) alpha(k, () => {
        for (const wn of st.litWins) R(wn.x, wn.y, wn.w, wn.h, '#ffe27a');
        for (const h of st.houses) h.lit.forEach((on, i) => { if (on) { const wx = i ? h.x + h.w - 12 : h.x + 5; R(wx + 1, h.y + 5, 6, 5, '#ffe27a'); } });
        const sw = L.roadY - 8;
        for (const lx of st.lamps) {
          alpha(0.3, () => circle(lx + 4, sw - 32, 7, '#ffe27a'));
          alpha(0.14, () => { for (let i = 0; i < 30; i++) R(lx + 4 - 2 - i * 0.4, sw - 30 + i, 4 + i * 0.8, 1, '#ffe27a'); });
          R(lx + 3, sw - 32, 3, 1, '#ffffff'); R(lx + 4, sw - 31, 1, 1, '#fff6b0');
        }
        for (const c of st.cars) headlight(c.x + CAR_W, farY() - 7 - Math.round(Math.sin(c.hop * Math.PI) * 6));
        headlight(st.pc.x + PC_W, L.laneY - 12);
        const ph = Math.floor(T * 7) % 2, y = L.laneY - 29 - Math.round(Math.sin(st.pc.hop * Math.PI) * 5) + 4;
        alpha(0.5, () => circle(st.pc.x + (ph ? 32 : 23), y, 8, ph ? BLUE_ON : RED_ON));
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
        R(x - r + 5, y + 7, 2 * r - 9, 1, '#a3121d');
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
      if (cop.state !== 'hidden' && st.phase !== 'party' && Math.abs(x - cop.x) < 13 && y > yBot() - 36 && y < yBot() + 4) { toggle(); return true; }
      // walkers
      for (const gr of st.groups) for (const m of gr.m) {
        const mx = gr.x + m.dx, my = memberY(gr, m);
        if (Math.abs(x - mx) < 9 && y > my - 22 && y < my + 4) {
          for (const mm of gr.m) mm.hop = 0.5;
          if (gr.kind === 'ducks') { m.big ? SFX.quack() : SFX.peep(); }
          else if (gr.kind === 'dog' && m.t === 'dog') SFX.woof();
          else SFX.boop(1 + Math.random() * 0.4);
          sparkle(mx, my - 14, 8, 5);
          return true;
        }
      }
      // police car
      const pc = st.pc;
      if (x >= pc.x - 2 && x < pc.x + PC_W + 2 && y > L.laneY - 32 && y < L.laneY + 3) {
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
    for (let i = 0; i < h.rh; i++) {
      const hw = Math.round((h.w / 2 + 3) * (i + 1) / h.rh);
      R(cx - hw, h.y - h.rh + i, hw * 2, 1, i === h.rh - 1 ? mix(h.roof, '#000000', 0.25) : h.roof);
    }
    R(h.x + h.w - 10, h.y - h.rh - 2, 5, 8, '#9a5a3a');
    R(h.x, h.y, h.w, h.h, h.c); R(h.x, h.y, 1, h.h, mix(h.c, '#000000', 0.12));
    R(cx - 3, h.y + h.h - 11, 7, 11, '#8a5a3a'); R(cx + 2, h.y + h.h - 6, 1, 1, '#ffd21f');
    for (const wx of [h.x + 5, h.x + h.w - 12]) { R(wx, h.y + 4, 8, 7, '#ffffff'); R(wx + 1, h.y + 5, 6, 5, GLASS); R(wx + 4, h.y + 5, 1, 5, '#ffffff'); }
  }
  function headlight(x, y) {
    alpha(0.22, () => { for (let i = 0; i < 14; i++) R(x + i, y - Math.floor(i / 3), 1, 2 + Math.floor(i / 1.5), '#fff27a'); });
    alpha(0.5, () => circle(x, y + 1, 2, '#fff6b0'));
    R(x - 1, y, 1, 2, '#ffffff');
  }
  function memberY(gr, m) {
    if (gr.state === 'enter' || gr.state === 'wait') return yTop();
    if (gr.state === 'cross') return yTop() + m.p;
    return yBot();
  }
  function drawStroller(x, yb) {
    x = Math.floor(x); yb = Math.floor(yb);
    R(x - 6, yb - 11, 12, 6, '#ff6fb4'); R(x - 6, yb - 11, 12, 1, '#ffb3da'); R(x - 6, yb - 6, 12, 1, '#c73d84');
    R(x + 1, yb - 15, 5, 4, '#c73d84'); R(x + 2, yb - 16, 3, 1, '#c73d84');
    R(x - 2, yb - 13, 3, 2, SKIN[0]); R(x - 1, yb - 14, 2, 1, '#5a3a22');
    R(x - 7, yb - 12, 1, 4, '#4d5560');
    for (const wx of [x - 4, x + 4]) { circle(wx, yb - 2, 2, TIRE); R(wx, yb - 2, 1, 1, '#cfd6dd'); }
  }
  function drawDog(x, yb, step) {
    x = Math.floor(x); yb = Math.floor(yb);
    const c = '#b07a4a', d = '#7a4a2a';
    R(x - 5, yb - 7, 9, 4, c); R(x - 5, yb - 4, 9, 1, d);
    for (const [lx, s] of [[-5, 0], [-3, 1], [1, 0], [3, 1]]) R(x + lx, yb - 3, 1, 3 - (step === s ? 1 : 0), d);
    R(x + 3, yb - 10, 5, 4, c); R(x + 3, yb - 10, 1, 4, d); R(x + 8, yb - 8, 1, 2, c);
    R(x + 6, yb - 9, 1, 1, INK); R(x + 8, yb - 8, 1, 1, INK); R(x + 3, yb - 6, 2, 1, '#e8222b');
    R(x - 6, yb - 9 + (Math.floor(T * 8) % 2), 1, 3, c);
  }
  function drawGroup(gr) {
    const moving = gr.state !== 'wait';
    const step = moving ? Math.floor(T * 8) % 2 : 0;
    for (const m of gr.m) {
      const mx = Math.floor(gr.x + m.dx);
      let yb = memberY(gr, m);
      const walking = gr.state === 'enter' || gr.state === 'off' || (gr.state === 'cross' && m.p > 0 && m.p < yBot() - yTop());
      let lift = 0;
      if (m.hop > 0) lift = Math.round(Math.sin((1 - m.hop / 0.5) * Math.PI) * 5);
      else if (gr.state === 'wait') lift = Math.round(Math.abs(Math.sin(T * 5 + m.seed)) * 1.5);
      yb -= lift;
      if (m.t === 'duck') drawDuck(mx, yb, m.big, 1, walking ? step : 0);
      else if (m.t === 'stroller') drawStroller(mx, yb + lift);
      else if (m.t === 'dog') drawDog(mx, yb, walking ? step : -1);
      else {
        const holding = m.balloon || m.cane || m.push || m.leash;
        let pose = holding ? 'carry' : 'stand';
        if (m.cheer > 0 && !m.balloon && !m.push && !m.leash) pose = 'cheer';
        else if (gr.state === 'wait' && !holding) pose = 'wave';
        drawPerson({ type: m.type, x: mx, yb, dir: 1, pose, walk: walking, skin: m.skin, seed: m.seed });
        const hx = mx + 4, hy = yb - 8;
        if (m.cane && pose === 'carry') R(hx, hy, 1, 8, '#7a4a2a');
        if (m.push) R(hx - 1, hy - 1, 6, 1, '#4d5560');
        if (m.leash) { const dog = gr.m.find(o => o.t === 'dog'); if (dog) line(hx, hy, Math.floor(gr.x + dog.dx) + 3, Math.floor(memberY(gr, dog)) - 5, '#e8222b'); }
        if (m.balloon) {
          const sway = Math.round(Math.sin(T * 2 + m.seed) * 1.5), bx = hx + 2 + sway, by = yb - 30;
          line(hx, hy, bx, by + 5, '#ffffff');
          circle(bx, by, 5, m.balloon); R(bx - 2, by - 3, 2, 2, '#ffffff'); R(bx, by + 5, 1, 1, m.balloon);
        }
      }
    }
    if (gr.state === 'wait' && Math.floor(T * 1.5) % 3 !== 2) {
      const lead = gr.m.reduce((a, b) => (a.dx < b.dx ? a : b));
      bubble(Math.floor(gr.x + lead.dx) - 14, yTop() - 34 + Math.round(Math.sin(T * 3) * 1.5));
    }
  }
  function drawCop() {
    const c = st.cop;
    if (!c || c.state === 'hidden') return;
    const yb = yBot();
    let hop = 0;
    if (c.state === 'hop') hop = Math.round(Math.sin(c.hop * Math.PI) * 8);
    const walking = c.state === 'walk' || (c.state === 'hop' && c.hop > 0.5);
    let pose = 'stand';
    if (st.phase === 'party' || c.cheer > 0) pose = 'cheer';
    else if (c.state === 'stand') pose = st.stopOn ? 'carry' : 'wave';
    drawPerson({ type: 'cop', x: c.x, yb, dir: -1, pose, walk: walking, hop, seed: 1 });
    if (pose === 'carry') {   // lollipop STOP sign held up high
      const top = yb - hop - 16, px = Math.floor(c.x) - 5;
      R(px, top - 8, 1, 17, '#6b7480');
      octagon(px, top - 13, 6, '#ffffff'); octagon(px, top - 13, 5, '#e8222b');
      R(px - 3, top - 14, 7, 2, '#ffffff');
    }
  }
})();
