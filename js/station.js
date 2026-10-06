// The fire station: garage with the three vehicles, crew floors upstairs, paint pots,
// mini-game launchers and bedtime.
'use strict';
(() => {
  const B = {};                       // building layout
  const dog = { jump: 0 }, bell = { swing: 0 }, hydrant = { spray: 0 };
  const doors = [0, 0, 0];            // garage door closed amount, 0 open .. 1 closed
  const bed = { on: false, asleep: false, lullaby: 0, sung: 0 };
  let selected = VI.fire, paintCount = 0;
  let crew = [], seats = [], btns = [], pots = [];

  /* ---------- layout ---------- */
  function layout() {
    B.annexW = 18; B.bayW = 76; B.bayGap = 6; B.bayH = 50;
    B.w = B.annexW + 3 * B.bayW + 2 * B.bayGap + 16;
    B.x = Math.floor(L.cx - B.w / 2);
    B.mainX = B.x + B.annexW;
    B.bays = [0, 1, 2].map(i => B.mainX + 8 + i * (B.bayW + B.bayGap));
    B.bayTop = L.floorY - B.bayH;
    B.signTop = B.bayTop - 22;
    // Upper floors grow to fill the screen up to about the middle when there's room.
    const maxAvail = B.signTop - 34 - L.safeT;
    const desired = B.signTop - 30 - H * 0.38;
    const avail = desired >= 40 ? Math.min(maxAvail, desired) : Math.max(34, Math.min(maxAvail, 56));
    B.nFloors = avail >= 116 ? 2 : 1;
    B.floorH = Math.min(78, Math.floor(avail / B.nFloors));
    B.top = B.signTop - B.nFloors * B.floorH;
    B.floors = [];
    for (let i = 0; i < B.nFloors; i++) {
      const bottom = B.signTop - i * B.floorH, top = bottom - B.floorH;
      B.floors.push({ i, top: top + 4, fy: bottom - 4, x0: B.x + 4, x1: B.x + B.w - 4 });
    }
    B.poleX = B.x + 9;
    B.towerX = Math.floor(B.x + B.w / 2);
    B.dogX = B.x - 19;
    B.hydX = B.x + B.w + 6;
    furnish();
    // mini-game launchers: two short columns beside the station when it fits, else a row on top
    const kinds = ['fire', 'amb', 'police', 'help', 'bed'];
    const twoCol = B.x - L.safeL >= 74 && B.top - L.safeT < 120;
    btns = kinds.map((k, i) => twoCol
      ? { k, x: L.safeL + 22 + (i >= 3 ? 34 : 0), y: L.safeT + 24 + (i % 3) * 34, r: 14 }
      : { k, x: L.safeL + 24 + i * 34, y: L.safeT + 30, r: 14 });
    B.leftTree = !twoCol && B.x - L.safeL >= 64;
    B.rightTree = W - L.safeR - (B.x + B.w) >= 64;
    const total = 9 * L.blob + 8 * L.gap;
    pots = PALETTE.map((p, i) => ({ key: p[0], cx: Math.floor(L.cx - total / 2) + i * (L.blob + L.gap) + L.blob / 2, cy: L.palY + Math.floor(L.palH / 2) }));
    pendingMission = null;
    V.forEach((v, i) => {
      v.homeX = B.bays[i] + Math.floor((B.bayW - v.len) / 2);
      if (v.stopSiren) v.stopSiren();
      Object.assign(v, { x: v.homeX, y: L.floorY - 1, state: 'parked', stopSiren: null, mission: null });
    });
    heli.y = Math.max(L.safeT + 6, Math.floor((L.safeT + B.top - 30) / 2) - 12);
    setClouds(L.safeT + 46, B.top - 50);
    hireCrew();
  }

  // Furniture positions and seats for each floor.
  function furnish() {
    seats = [];
    for (const f of B.floors) {
      const w = f.x1 - f.x0;
      f.door = f.x0 + 18;                       // stairwell door on the back wall
      f.walk = [f.x0 + 12, f.x1 - 10];
      if (f.i === 0) {                          // crew room: table and kitchen
        f.table = Math.round(f.x0 + w * 0.40); f.tw = 40;
        seats.push({ f: 0, x: f.table - 6, dir: 1, kind: 'chair', who: null });
        seats.push({ f: 0, x: f.table + f.tw + 6, dir: -1, kind: 'chair', who: null });
      } else {                                  // bunk room: bunks, lockers, couch and TV
        f.bunk = f.x0 + 40; f.locker = f.x0 + 82; f.couch = f.x1 - 76;
        seats.push({ f: 1, x: f.couch + 12, dir: 1, kind: 'couch', who: null });
        seats.push({ f: 1, x: f.couch + 27, dir: 1, kind: 'couch', who: null });
      }
    }
  }

  function hireCrew() {
    const roster = [['ff', 0], ['ff', 0], ['cop', 0], ['medic', 0]];
    if (B.nFloors > 1) roster.push(['ff', 1, true], ['medic', 1], ['cop', 1]);
    crew = roster.map(([type, f, sleeper], i) => {
      const fl = B.floors[f];
      const p = { type, f, home: f, sleeper: !!sleeper, x: rand(fl.walk[0] + 10, fl.walk[1] - 10), y: fl.fy, dir: Math.random() < 0.5 ? 1 : -1,
        state: 'idle', t: rand(0.5, 3), seat: null, skin: SKIN[(i * 3 + 1) % SKIN.length], hair: pickOne(['#5a3a22', '#2f2a26', '#e8b03a', '#a3471d']),
        seed: i * 1.7, hop: 0, wave: 0, speed: 16 };
      if (p.sleeper) { p.state = 'sleep'; p.x = fl.bunk + 10; }
      return p;
    });
  }

  /* ---------- crew behaviour ---------- */
  const floorOf = p => B.floors[p.f];
  function walkTo(p, x, then) { p.state = 'walk'; p.target = x; p.then = then; }
  function freeSeat(p) { if (p.seat) { p.seat.who = null; p.seat = null; } }
  function goPole(p, rush) {
    freeSeat(p);
    if (p.state === 'gone' || p.state === 'slide' || p.state === 'exit' || p.state === 'land') return;
    if (p.state === 'sleep' || p.state === 'wake') p.y = floorOf(p).fy;
    p.speed = rush ? 40 : 16;
    walkTo(p, B.poleX + 4, 'pole');
  }
  function think(p) {
    const f = floorOf(p), r = Math.random();
    p.speed = 16;
    if (p.sleeper) { walkTo(p, f.bunk + 10, 'sleep'); return; }
    if (p.type === 'ff' && r < 0.15) { goPole(p, false); return; }
    const seat = r < 0.55 && seats.find(s => s.f === p.f && !s.who);
    if (seat) { seat.who = p; p.seat = seat; walkTo(p, seat.x, 'sit'); return; }
    walkTo(p, rand(f.walk[0], f.walk[1]), 'idle');
  }
  function updateCrew(dt) {
    for (const p of crew) {
      p.hop = Math.max(0, p.hop - dt); p.wave = Math.max(0, p.wave - dt);
      const f = floorOf(p);
      switch (p.state) {
        case 'idle': if ((p.t -= dt) <= 0 && !bed.asleep) think(p); break;
        case 'walk': {
          const d = p.target - p.x;
          p.dir = d >= 0 ? 1 : -1;
          p.x += p.dir * Math.min(Math.abs(d), p.speed * dt);
          if (Math.abs(d) < 0.5) {
            p.x = p.target;
            if (p.then === 'sit') { p.state = 'sit'; p.t = rand(6, 12); p.dir = p.seat.dir; }
            else if (p.then === 'pole') { p.state = 'slide'; p.y = f.fy; p.vy = 25; SFX.whoosh(); }
            else if (p.then === 'sleep') { p.state = 'sleep'; }
            else { p.state = 'idle'; p.t = rand(1.5, 4); }
          }
          break;
        }
        case 'sit': if ((p.t -= dt) <= 0) { freeSeat(p); p.state = 'idle'; p.t = 0.3; } break;
        case 'slide':
          p.vy = Math.min(120, p.vy + 220 * dt); p.y += p.vy * dt; p.x = B.poleX + 4; p.dir = -1;
          if (p.y >= L.floorY) { p.y = L.floorY; p.state = 'land'; p.t = 0.35; }
          break;
        case 'land': if ((p.t -= dt) <= 0) { p.state = 'exit'; p.dir = -1; } break;
        case 'exit': p.x -= 22 * dt; if (p.x < B.x - 8) { p.state = 'gone'; p.t = rand(4, 8); } break;
        case 'gone':
          if ((p.t -= dt) <= 0 && !bed.asleep) {   // back up the stairs on their home floor
            p.f = p.home; const hf = floorOf(p);
            p.x = hf.door; p.y = hf.fy; p.dir = 1; p.speed = 16;
            p.state = 'idle'; p.t = 0.6; p.appear = 0.6;
          }
          break;
        case 'wake': if ((p.t -= dt) <= 0) p.state = 'sleep'; break;
        case 'sleep': if (Math.random() < dt * 0.5) zzz(p.x - 4, f.fy - 16); break;
      }
      if (p.appear) p.appear = Math.max(0, p.appear - dt);
    }
  }
  function crewHit(x, y) {
    for (const p of crew) {
      if (p.state === 'gone') continue;
      const yb = p.state === 'sleep' || p.state === 'wake' ? floorOf(p).fy - 6 : p.y;
      if (x > p.x - 7 && x < p.x + 7 && y > yb - 19 && y < yb + 2) return p;
    }
    return null;
  }
  function pokeCrew(p) {
    if (p.state === 'sleep') { p.state = 'wake'; p.t = 2.5; SFX.boop(0.7); return; }
    p.hop = 0.5; p.wave = 1.4;
    SFX.boop({ ff: 1, cop: 1.25, medic: 1.5 }[p.type]);
  }

  /* ---------- vehicles ---------- */
  function startTrip(v) { v.state = 'exit'; v.t = 0; v.speed = 0; v.lap = false; v.stopSiren = siren(v.kind); }
  function vehicleHit(v, i, x, y) {
    if (v.state === 'parked') return x >= B.bays[i] - 3 && x < B.bays[i] + B.bayW + 3 && y >= B.bayTop - 4 && y < L.floorY + 4;
    return x >= v.x - 6 && x < v.x + v.len + 6 && y >= v.y - v.h - 6 && y < v.y + 6;
  }
  function updateVehicles(dt) {
    for (const v of V) {
      const x0 = v.x;
      v.hop = Math.max(0, v.hop - dt);
      if (v.state === 'exit') {
        v.t += dt; const k = Math.min(1, v.t / 0.6);
        v.y = (L.floorY - 1) + (L.laneY - L.floorY + 1) * ease(k);
        if (k >= 1) v.state = 'drive';
      } else if (v.state === 'drive') {
        v.speed = Math.min(150, v.speed + 260 * dt);
        v.x += v.speed * dt;
        if (!v.lap && v.x > W + 8) {
          if (v.mission) { const m = v.mission; v.mission = null; v.state = 'away'; v.x = W + 200; goScene(m); continue; }
          v.x = -v.len - 8; v.lap = true; say('back-to-the-station', true);
        }
        if (v.lap && v.x >= v.homeX - 45) v.state = 'arrive';
      } else if (v.state === 'arrive') {
        v.x = Math.min(v.homeX, v.x + Math.max(18, (v.homeX - v.x) * 3) * dt);
        if (v.x >= v.homeX) { v.state = 'enter'; v.t = 0; }
      } else if (v.state === 'enter') {
        v.t += dt; const k = Math.min(1, v.t / 0.6);
        v.y = L.laneY + (L.floorY - 1 - L.laneY) * ease(k);
        if (k >= 1) { v.state = 'parked'; if (v.stopSiren) v.stopSiren(); v.stopSiren = null; if (!bed.on) say(pick('parked'), true); }
      }
      v.rot += (v.x - x0) / 5;
      if (v.state === 'drive' || v.state === 'arrive') {
        v.puff -= dt;
        if (v.puff <= 0) { v.puff = 0.09; parts.push({ x: v.x - 1, y: v.y - 7, vx: -12, vy: -14, g: 0, life: 0.6, max: 0.6, s: 2, c: '#c9ccd3' }); }
      }
    }
  }
  function paintSplash(v, key) {
    const cx = v.x + v.len / 2, cy = v.y - v.h / 2, c = COLOR[key].c;
    spawn(36, () => ({ x: cx, y: cy, vx: rand(-70, 70), vy: rand(-130, -40), g: 220, life: 0.9, max: 0.9, s: 2 + (Math.random() * 2 | 0), c: c[Math.random() * 3 | 0] }));
    sparkle(cx, cy, v.len / 2, 10, '#ffffff');
  }

  /* ---------- missions & bedtime ---------- */
  function launch(k) {
    if (k === 'bed') { bed.on ? wakeUp() : bedtime(); return; }
    if (bed.on) return;
    if (!SCENES[k]) return;   // that mini-game isn't installed
    if (k === 'help') { SFX.chime(); goScene('help'); return; }
    if (pendingMission) return;
    SFX.bell(); bell.swing = 1.4;
    selected = VI[k];
    say(pick(k));
    launchMission(VI[k], k);
    const who = { fire: 'ff', amb: 'medic', police: 'cop' }[k];
    crew.filter(p => p.type === who).forEach(p => goPole(p, true));   // the crew rushes to the pole
  }
  function bedtime() {
    bed.on = true; bed.asleep = false; bed.sung = 0;
    setNight(true);
    SFX.chime();
  }
  function wakeUp() {
    bed.on = false; bed.asleep = false;
    setNight(false);
    for (const p of crew) if (p.state === 'gone') p.t = Math.min(p.t, rand(0.3, 2));
  }
  onDayNight.push(night => { if (!night && bed.on) { bed.on = false; bed.asleep = false; } });
  function updateBedtime(dt) {
    for (let i = 0; i < 3; i++) {
      const target = bed.on && V[i].state === 'parked' && V[i].tucked ? 1 : 0;
      doors[i] += Math.sign(target - doors[i]) * Math.min(Math.abs(target - doors[i]), dt / 1.4);
      if (!bed.on) V[i].tucked = false;
    }
    if (bed.on && !bed.asleep && doors.every(d => d >= 1)) {
      bed.asleep = true; bed.lullaby = 0.5;
      for (const p of crew) if (!p.sleeper) { freeSeat(p); p.state = 'gone'; p.t = 1e9; }
      for (const p of crew) if (p.sleeper && p.state !== 'sleep') { p.state = 'sleep'; p.f = p.home; p.x = floorOf(p).bunk + 10; }
    }
    if (!bed.asleep) for (const p of crew) if (p.state === 'gone' && p.t > 1e8) p.t = rand(0.3, 2.5);
    if (bed.asleep && bed.sung < 3 && (bed.lullaby -= dt) <= 0) { SFX.lullaby(); bed.sung++; bed.lullaby = 8; }
    if (bed.asleep && Math.random() < dt * 0.8) zzz(B.dogX + 12, L.floorY - 10);
  }

  /* ---------- update ---------- */
  function update(dt) {
    updateVehicles(dt);
    updateCrew(dt);
    updateBedtime(dt);
    dog.jump = Math.max(0, dog.jump - dt);
    bell.swing = Math.max(0, bell.swing - dt);
    if (hydrant.spray > 0) {
      hydrant.spray -= dt;
      const nx = B.hydX + 4, ny = L.floorY - 8;
      spawn(3, i => ({ x: nx + (i % 2 ? 6 : -2), y: ny, vx: (i % 2 ? 1 : -1) * rand(25, 55), vy: rand(-100, -60), g: 240, life: 0.7, max: 0.7, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.5 ? '#6fc8ff' : '#d8f2ff' }));
    }
    if (Math.random() < dt * 1.5 && !bed.asleep && B.floors[0]) {   // steam from the cooking pot
      const f = B.floors[0];
      parts.push({ x: f.x1 - 32 + rand(-2, 2), y: f.fy - 18, vx: rand(-3, 3), vy: -10, g: 0, life: 1.2, max: 1.2, s: 2, c: '#ffffff' });
    }
  }

  /* ---------- tap ---------- */
  function tap(x, y) {
    for (const b of btns) {
      if ((bed.on && b.k !== 'bed') || (pendingMission && b.k !== 'bed')) continue;
      if ((x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + 6) ** 2) { launch(b.k); return true; }
    }
    const r = L.blob / 2 + 4;
    for (const p of pots) {
      if ((x - p.cx) ** 2 + (y - p.cy) ** 2 <= r * r) {
        const v = V[selected];
        v.color = p.key; v.hop = 0.35;
        paintSplash(v, p.key); SFX.paint(); say(++paintCount % 3 === 0 ? [p.key, pick('wow')] : p.key); saveColors();
        return true;
      }
    }
    const order = [0, 1, 2].sort((a, b) => (V[a].state === 'parked') - (V[b].state === 'parked'));
    for (const i of order) {
      const v = V[i];
      if (!vehicleHit(v, i, x, y)) continue;
      selected = i;
      if (bed.on && v.state === 'parked') {
        if (!v.tucked) { v.tucked = true; SFX.door(); tone('sine', [523, 659, 784][i], 0.2, 0.8, 0.1); }
        else tone('sine', 392, 0, 0.5, 0.08);
      } else if (v.state === 'parked') { say(pick(v.kind)); startTrip(v); }
      else if (v.state !== 'away') { SFX.honk(); v.hop = 0.3; }
      return true;
    }
    const p = crewHit(x, y);
    if (p) { pokeCrew(p); return true; }
    if (Math.abs(x - B.towerX) < 14 && y > B.top - 30 && y < B.top + 2) { bell.swing = 1.4; SFX.bell(); return true; }
    if (x >= B.dogX - 4 && x < B.dogX + 20 && y > L.floorY - 22 && y < L.floorY + 4) { dog.jump = 0.6; SFX.woof(); return true; }
    if (x >= B.hydX - 5 && x < B.hydX + 14 && y > L.floorY - 20 && y < L.floorY + 4) { hydrant.spray = 1.6; SFX.water(); return true; }
    return false;
  }

  /* ---------- draw: building ---------- */
  const BRICK = '#b5523b', MORTAR = '#934130', TRIM = '#efe3c6', TRIM2 = '#c9b893';
  function drawBuilding() {
    const x = B.x, w = B.w, top = B.top, bot = L.floorY;
    // bell tower
    const tx = B.towerX, tt = top - 26;
    R(tx - 14, tt - 6, 28, 3, TRIM); R(tx - 10, tt - 9, 20, 3, TRIM); R(tx - 5, tt - 12, 10, 3, TRIM);
    R(tx - 12, tt - 3, 24, 30, BRICK);
    R(tx - 8, tt + 2, 16, 18, '#3a3442'); R(tx - 8, tt + 2, 16, 1, '#2a2530');
    const sw = bell.swing > 0 ? Math.round(Math.sin(bell.swing * 14) * 2) : 0;
    const bx = tx + sw, by = tt + 5;
    R(tx - 1, tt + 2, 2, 3, '#6b5a3a');
    R(bx - 3, by, 6, 2, '#ffd21f'); R(bx - 4, by + 2, 8, 5, '#ffd21f'); R(bx - 5, by + 7, 10, 2, '#e0a81a');
    R(bx - 2, by + 1, 1, 5, '#fff3a6'); R(bx - sw - 1, by + 9, 2, 2, '#8a6a20');
    // brick walls
    R(x, top, w, bot - top, BRICK);
    for (let yy = top + 3; yy < bot; yy += 4) {
      R(x, yy, w, 1, MORTAR);
      const off = ((yy - top) / 4) % 2 ? 0 : 4;
      for (let xx = x + off; xx < x + w; xx += 8) R(xx, yy - 3, 1, 3, MORTAR);
    }
    R(x - 3, top - 4, w + 6, 4, TRIM); R(x - 3, top, w + 6, 1, TRIM2);
    // window frames of the upper floors (the rooms themselves are drawn lit)
    for (const f of B.floors) {
      R(f.x0 - 2, f.top - 2, f.x1 - f.x0 + 4, f.fy - f.top + 4, TRIM);
      R(f.x0, f.top, f.x1 - f.x0, f.fy - f.top + 2, '#3a3442');
    }
    // sign over the garage
    const signW = 104, sx = Math.floor(B.mainX + (w - B.annexW - signW) / 2);
    R(sx - 1, B.signTop + 3, signW + 2, 16, TRIM); R(sx, B.signTop + 4, signW, 14, '#7a1f1f');
    text('FIRE STATION', sx + 5, B.signTop + 6, 2, '#fff6e0');
    // pole shaft and side door
    R(x + 3, B.signTop, 13, bot - B.signTop, '#cdb48a'); R(x + 3, B.signTop, 1, bot - B.signTop, '#b39a70');
    R(B.poleX - 1, B.signTop, 2, bot - B.signTop - 2, '#e0b010'); R(B.poleX - 1, B.signTop, 1, bot - B.signTop - 2, '#fff3a6');
    R(x + 1, bot - 21, 16, 21, TRIM); R(x + 3, bot - 19, 12, 19, '#6b4a2e'); R(x + 12, bot - 10, 2, 2, '#ffd21f');
    // garage bays
    B.bays.forEach(bx2 => {
      R(bx2 - 2, B.bayTop - 2, B.bayW + 4, B.bayH + 2, TRIM);
      R(bx2, B.bayTop, B.bayW, B.bayH, '#3a3442');
      R(bx2, B.bayTop + 8, B.bayW, 1, '#463f50'); R(bx2, B.bayTop + 20, B.bayW, 1, '#463f50');
      R(bx2, bot - 3, B.bayW, 3, '#57505f');
      R(bx2, B.bayTop, B.bayW, 7, '#cdd2d8');
      for (let k = 1; k < 7; k += 2) R(bx2, B.bayTop + k, B.bayW, 1, '#a9b0b8');
    });
  }
  function drawDoors() {
    B.bays.forEach((bx, i) => {
      const d = doors[i];
      if (d <= 0) return;
      const h = Math.round(7 + (B.bayH - 7) * d);
      R(bx, B.bayTop, B.bayW, h, '#cdd2d8');
      for (let k = 1; k < h; k += 3) R(bx, B.bayTop + k, B.bayW, 1, '#a9b0b8');
      R(bx, B.bayTop + h - 2, B.bayW, 2, '#8b939c');
      if (d >= 1) R(bx + B.bayW / 2 - 4, B.bayTop + h - 6, 8, 2, '#6b7480');
    });
  }

  /* ---------- draw: rooms upstairs ---------- */
  function drawRoom(f, lightsOn) {
    const w = f.x1 - f.x0, h = f.fy - f.top;
    const wall = lightsOn ? '#f3e2c3' : '#7d6f60', wain = lightsOn ? '#e2c99e' : '#6e604f';
    R(f.x0, f.top, w, h, wall);
    R(f.x0, f.fy - 10, w, 10, wain); R(f.x0, f.fy - 11, w, 1, '#cdb184');
    R(f.x0, f.fy, w, 2, '#8a5a3a');
    // back-wall window with the real sky
    const wx = f.i === 0 ? f.table + f.tw + 16 : f.locker + 34, wy = f.top + 8, ww = 22, wh = Math.min(16, h - 26);
    if (wh > 6) {
      R(wx - 1, wy - 1, ww + 2, wh + 2, '#ffffff');
      R(wx, wy, ww, wh, mix('#8fd6ff', '#141a45', nightK()));
      if (nightK() > 0.5) { R(wx + 15, wy + 3, 1, 1, '#ffffff'); R(wx + 5, wy + 6, 1, 1, '#ffffff'); }
      R(wx + ww / 2, wy, 1, wh, '#ffffff');
    }
    // stairwell door
    R(f.door - 6, f.fy - 22, 13, 22, '#d9c4a0'); R(f.door - 5, f.fy - 21, 11, 21, '#8a5a3a'); R(f.door + 3, f.fy - 11, 1, 2, '#ffd21f');
    // fire pole through the floor
    R(B.poleX - 3, f.fy, 6, 4, '#2a2530');
    R(B.poleX - 1, f.top, 2, h + 4, '#e0b010'); R(B.poleX - 1, f.top, 1, h + 4, '#fff3a6');
    // ceiling lamp
    const lx = f.x0 + Math.round(w * 0.55);
    R(lx, f.top, 1, 4, '#5a5f6e'); R(lx - 3, f.top + 4, 7, 2, lightsOn ? '#ffe873' : '#8a8466');
    if (lightsOn) alpha(0.25, () => circle(lx, f.top + 8, 9, '#fff3a6'));
    if (f.i === 0) drawKitchen(f, lightsOn); else drawBunkRoom(f, lightsOn);
  }
  function drawKitchen(f) {
    const tx = f.table, tw = f.tw, fy = f.fy, h = f.fy - f.top;
    // helmets on hooks
    for (let k = 0; k < 3; k++) { const hx = f.x0 + 30 + k * 9; R(hx + 2, f.top + 8, 1, 2, '#5a5f6e'); R(hx, f.top + 10, 6, 3, '#e8222b'); R(hx - 1, f.top + 12, 8, 1, '#e8222b'); }
    // picture of a fire truck above the table
    if (h > 34) { const px = tx + 12, py = f.top + 8; R(px, py, 16, 11, '#7a4a2a'); R(px + 1, py + 1, 14, 9, '#bfe6ff'); R(px + 3, py + 5, 9, 3, '#e8222b'); R(px + 9, py + 4, 3, 2, '#e8222b'); R(px + 4, py + 8, 2, 1, INK); R(px + 9, py + 8, 2, 1, INK); }
    // clock
    if (h > 30) { const cx = f.x1 - 76, cy = f.top + 12; circle(cx, cy, 4, '#ffffff'); R(cx, cy - 3, 1, 3, INK); R(cx, cy, 2, 1, INK); }
    // table, chairs, bowls
    for (const s of seats.filter(s => s.f === 0)) {
      R(s.x - 4, fy - 7, 8, 2, '#8a5a3a'); R(s.x - 3, fy - 5, 1, 5, '#6b4a2e'); R(s.x + 2, fy - 5, 1, 5, '#6b4a2e');
      R(s.dir > 0 ? s.x - 5 : s.x + 4, fy - 16, 2, 16, '#6b4a2e');
    }
    R(tx, fy - 10, tw, 3, '#a8703f'); R(tx, fy - 8, tw, 1, '#8a5a3a'); R(tx + 2, fy - 7, 2, 7, '#8a5a3a'); R(tx + tw - 4, fy - 7, 2, 7, '#8a5a3a');
    R(tx + 3, fy - 12, 7, 2, '#f4f7fb'); R(tx + 4, fy - 13, 5, 1, '#f57a12');
    R(tx + tw - 10, fy - 12, 7, 2, '#f4f7fb'); R(tx + tw - 9, fy - 13, 5, 1, '#3fb43a');
    R(tx + tw / 2 - 2, fy - 16, 4, 6, '#ffffff'); R(tx + tw / 2 - 2, fy - 13, 4, 2, '#2a6fe0');
    // kitchen
    const kx = f.x1 - 62;
    R(kx, fy - 12, 22, 12, '#b07a4a'); R(kx, fy - 13, 22, 2, '#d9b98f'); R(kx + 10, fy - 9, 2, 1, '#e9eef2');
    R(kx + 22, fy - 12, 18, 12, '#c9cdd3'); R(kx + 22, fy - 13, 18, 1, '#5a5f6e'); R(kx + 25, fy - 9, 12, 6, '#3a3d46');
    R(kx + 26, fy - 18, 10, 5, '#5a5f6e'); R(kx + 25, fy - 18, 12, 1, '#7d8290');
    const fh = Math.min(30, h - 6);
    R(f.x1 - 20, fy - fh, 15, fh, '#e9eef2'); R(f.x1 - 20, fy - fh + 10, 15, 1, '#b4bec8'); R(f.x1 - 18, fy - fh + 4, 1, 4, '#7d8290'); R(f.x1 - 18, fy - fh + 13, 1, 5, '#7d8290');
    if (h > 48) { R(kx, f.top + 6, 40, 9, '#b07a4a'); R(kx + 19, f.top + 6, 1, 9, '#8a5a3a'); R(kx + 8, f.top + 12, 3, 1, '#e9eef2'); R(kx + 28, f.top + 12, 3, 1, '#e9eef2'); }
  }
  function drawBunkRoom(f) {
    const fy = f.fy, bx = f.bunk;
    // bunk bed
    R(bx, fy - 28, 2, 28, '#8a5a3a'); R(bx + 34, fy - 28, 2, 28, '#8a5a3a');
    R(bx + 2, fy - 9, 32, 3, '#f4f7fb'); R(bx + 2, fy - 6, 32, 2, '#8a5a3a');
    R(bx + 2, fy - 24, 32, 3, '#f4f7fb'); R(bx + 2, fy - 21, 32, 2, '#8a5a3a');
    R(bx + 3, fy - 12, 7, 3, '#ffffff'); R(bx + 3, fy - 27, 7, 3, '#ffffff');
    R(bx + 12, fy - 26, 21, 2, '#3fb43a');
    circle(bx + 24, fy - 28, 3, '#a8703f'); circle(bx + 22, fy - 31, 1, '#a8703f'); circle(bx + 26, fy - 31, 1, '#a8703f'); R(bx + 23, fy - 28, 1, 1, INK); // teddy
    // lockers with jackets
    const lx = f.locker;
    for (let k = 0; k < 3; k++) { R(lx + k * 9, fy - 26, 8, 26, '#7d8aa0'); R(lx + k * 9 + 1, fy - 24, 6, 1, '#5d6a80'); R(lx + k * 9 + 1, fy - 22, 6, 1, '#5d6a80'); R(lx + k * 9 + 6, fy - 14, 1, 3, '#cfd6dd'); }
    R(lx, fy - 30, 7, 3, '#e8222b'); R(lx + 9, fy - 30, 7, 3, '#e8222b');
    // couch and TV
    const cx = f.couch;
    R(cx, fy - 18, 4, 18, '#a8403d'); R(cx, fy - 9, 38, 6, '#c0504d'); R(cx + 34, fy - 12, 4, 9, '#a8403d'); R(cx + 2, fy - 3, 2, 3, '#6b2a28'); R(cx + 33, fy - 3, 2, 3, '#6b2a28');
    const tvx = f.x1 - 26;
    R(tvx, fy - 10, 20, 10, '#8a5a3a');
    R(tvx + 1, fy - 24, 18, 13, '#2f3240');
    const ch = Math.floor(T * 1.5) % 3;
    R(tvx + 2, fy - 23, 16, 11, ['#8fd6ff', '#3fb43a', '#ffd21f'][ch]);
    R(tvx + 5, fy - 17, 9, 3, '#e8222b'); R(tvx + 6, fy - 14, 2, 1, INK); R(tvx + 11, fy - 14, 2, 1, INK);
  }
  function drawSleeper(p, f) {
    const bx = f.bunk, fy = f.fy, breathe = Math.floor(T * 1.2 + p.seed) % 2;
    if (p.state === 'wake') {
      drawPerson({ type: p.type, x: bx + 10, yb: fy - 7, dir: 1, pose: 'wave', skin: p.skin, hair: p.hair, seed: p.seed });
      R(bx + 14, fy - 12, 19, 3, '#3a6fd8');
      return;
    }
    circle(bx + 7, fy - 12, 3, p.skin); R(bx + 4, fy - 15, 6, 2, p.hair);
    R(bx + 8, fy - 12, 1, 1, INK);
    R(bx + 10, fy - 13 + breathe, 23, 4 - breathe, '#3a6fd8'); R(bx + 10, fy - 13 + breathe, 23, 1, '#6f9cf0');
  }
  function drawCrew(onFloor) {
    for (const p of crew) {
      if (p.state === 'gone') continue;
      const f = floorOf(p);
      if (p.sleeper && (p.state === 'sleep' || p.state === 'wake')) { if (onFloor === f.i) drawSleeper(p, f); continue; }
      const sliding = p.state === 'slide' || p.state === 'land' || p.state === 'exit';
      if ((onFloor === 'down') !== sliding) continue;
      if (!sliding && onFloor !== f.i) continue;
      const hop = p.hop > 0 ? Math.sin(p.hop / 0.5 * Math.PI) * 5 : 0;
      let pose = p.wave > 0 ? 'wave' : 'stand', yb = p.y;
      if (p.state === 'sit') { pose = p.wave > 0 ? 'wave' : (p.seat.kind === 'chair' ? 'eat' : 'sit'); yb = f.fy - (p.seat.kind === 'chair' ? 6 : 5); }
      if (p.state === 'slide') pose = 'slide';
      const draw = () => drawPerson({ type: p.type, x: p.x, yb, dir: p.dir, pose, walk: p.state === 'walk' || p.state === 'exit', skin: p.skin, hair: p.hair, seed: p.seed, hop });
      if (p.appear) alpha(1 - p.appear / 0.6, draw); else draw();
    }
  }

  /* ---------- draw: props ---------- */
  function drawProps() {
    const dx = B.dogX, WH = '#fbfbf7', BK = INK;
    if (bed.asleep) {   // curled up asleep
      R(dx + 2, L.floorY - 6, 12, 6, WH); R(dx + 11, L.floorY - 8, 5, 5, WH); R(dx + 11, L.floorY - 8, 2, 4, BK);
      R(dx + 14, L.floorY - 6, 1, 1, BK); R(dx + 5, L.floorY - 5, 2, 1, BK); R(dx + 8, L.floorY - 3, 1, 1, BK); R(dx + 1, L.floorY - 3, 3, 1, WH);
    } else {
      const dy = L.floorY - (dog.jump > 0 ? Math.round(Math.sin(dog.jump / 0.6 * Math.PI) * 8) : 0);
      const wag = Math.floor(T * (dog.jump > 0 ? 12 : 4)) % 2;
      R(dx + 1, dy - 8 - wag, 2, 1, WH); R(dx, dy - 9 - wag, 1, 1, WH);
      R(dx + 2, dy - 6, 5, 6, WH); R(dx + 3, dy - 9, 7, 6, WH);
      R(dx + 9, dy - 5, 2, 5, WH); R(dx + 7, dy - 1, 4, 1, WH);
      R(dx + 8, dy - 15, 6, 6, WH); R(dx + 13, dy - 12, 3, 3, WH);
      R(dx + 8, dy - 15, 2, 5, BK); R(dx + 12, dy - 13, 1, 1, BK); R(dx + 15, dy - 12, 1, 1, BK);
      R(dx + 8, dy - 9, 4, 1, '#e8222b');
      R(dx + 4, dy - 7, 2, 1, BK); R(dx + 6, dy - 4, 1, 2, BK); R(dx + 3, dy - 3, 1, 1, BK); R(dx + 9, dy - 3, 1, 1, BK);
    }
    const hx = B.hydX, hy = L.floorY;
    R(hx + 1, hy - 11, 7, 11, '#e8222b'); R(hx + 1, hy - 11, 2, 11, '#ff7a6b');
    R(hx, hy - 13, 9, 2, '#a3121d'); R(hx + 3, hy - 15, 3, 2, '#a3121d');
    R(hx - 2, hy - 8, 13, 3, '#a3121d'); R(hx, hy - 2, 9, 2, '#a3121d');
  }
  function drawTrees() {
    const spots = [];
    if (B.leftTree) spots.push(B.x - 46);
    if (B.rightTree) spots.push(B.x + B.w + 34);
    for (const tx of spots) drawTree(tx, L.floorY, 11);
  }
  function drawVehicle(v, i) {
    const moving = v.state !== 'parked';
    let bob = (v.state === 'drive' || v.state === 'arrive') ? (Math.floor(v.x / 7) % 2 ? 0 : -1) : 0;
    if (v.hop > 0) bob -= Math.round(Math.sin(v.hop / 0.35 * Math.PI) * 4);
    drawV(i, v.x, v.y, moving, bob);
  }

  /* ---------- draw: UI ---------- */
  function drawArrow(cx, ty) {
    R(cx - 3, ty - 1, 7, 6, '#1d1a2b'); R(cx - 6, ty + 4, 13, 2, '#1d1a2b');
    R(cx - 5, ty + 6, 11, 1, '#1d1a2b'); R(cx - 4, ty + 7, 9, 1, '#1d1a2b'); R(cx - 3, ty + 8, 7, 1, '#1d1a2b');
    R(cx - 2, ty + 9, 5, 1, '#1d1a2b'); R(cx - 1, ty + 10, 3, 1, '#1d1a2b');
    R(cx - 2, ty, 5, 5, '#ffd21f'); R(cx - 5, ty + 5, 11, 1, '#ffd21f'); R(cx - 4, ty + 6, 9, 1, '#ffd21f');
    R(cx - 3, ty + 7, 7, 1, '#ffd21f'); R(cx - 2, ty + 8, 5, 1, '#ffd21f'); R(cx - 1, ty + 9, 3, 1, '#ffd21f');
  }
  function drawPalette() {
    drawStrip();
    const cur = V[selected].color, r = Math.floor(L.blob / 2);
    for (const p of pots) {
      const c = COLOR[p.key].c, on = p.key === cur;
      const cy = p.cy - (on ? 2 : 0);
      if (on) circle(p.cx, cy, r + 3, '#ffffff');
      circle(p.cx, cy + 2, r, '#2f6b29');
      circle(p.cx, cy, r, c[2]);
      circle(p.cx, cy - 1, r - 1, c[1]);
      circle(p.cx - Math.floor(r / 3), cy - Math.floor(r / 3), Math.max(2, Math.floor(r / 4)), c[0]);
    }
  }
  const ICONS = {
    fire: (x, y) => { roundButton(x, y, 14, '#e8222b', true); flame(x, y + 9, 1.15, 1); },
    amb: (x, y) => { roundButton(x, y, 14, '#f4f7fb', true); R(x - 2, y - 8, 5, 16, '#e8222b'); R(x - 8, y - 2, 16, 5, '#e8222b'); },
    police: (x, y) => {
      roundButton(x, y, 14, '#2a6fe0', true);
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; for (let d = 0; d < 9; d++) R(x + Math.cos(a) * d - 1, y + Math.sin(a) * d - 1, 3, 3, '#ffd21f'); }
      circle(x, y, 4, '#ffd21f'); R(x - 1, y - 1, 3, 3, '#c99410');
    },
    help: (x, y) => {
      roundButton(x, y, 14, '#3fb43a', true);
      circle(x - 4, y - 3, 4, '#ffffff'); circle(x + 4, y - 3, 4, '#ffffff');
      for (let k = 0; k < 7; k++) R(x - 8 + k, y - 1 + k, 17 - 2 * k, 1, '#ffffff');
    },
    bed: (x, y) => {
      roundButton(x, y, 14, '#55289a', true);
      circle(x - 1, y, 8, '#fff3a6'); circle(x + 3, y - 3, 7, '#55289a');
      text('Z', x + 3, y + 1, 1, '#ffffff'); text('Z', x + 7, y - 5, 1, '#ffffff');
    },
  };
  function drawButtons() {
    for (const b of btns) {
      const hidden = (bed.on && b.k !== 'bed') || (pendingMission && b.k !== 'bed');
      if (hidden) continue;
      if (b.k === 'bed' && bed.on) { roundButton(b.x, b.y, 14, '#ffd21f', true); drawSun0(b.x, b.y); continue; }
      ICONS[b.k](b.x, b.y);
    }
  }
  function drawSun0(x, y) { circle(x, y, 7, '#ff9a3a'); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; R(x + Math.cos(a) * 10 - 1, y + Math.sin(a) * 10 - 1, 2, 2, '#ff9a3a'); } }

  /* ---------- scene ---------- */
  SCENES.station = {
    layout,
    groundY: () => L.hillY,
    enter(arg) {
      pendingMission = null;
      if (arg && arg.returning != null) {
        const v = V[arg.returning];
        if (v.stopSiren) v.stopSiren();
        Object.assign(v, { state: 'drive', lap: true, mission: null, x: -v.len - 8, y: L.laneY, speed: 120, stopSiren: null });
      }
      for (const p of crew) if (p.state === 'gone') p.t = Math.min(p.t, rand(0.5, 3));
    },
    update,
    tap,
    drawWorld() {
      drawHeli();
      drawHills(L.hillY, L.floorY);
      drawTrees();
      drawBuilding();
      if (bed.asleep) for (const f of B.floors) { drawRoom(f, false); drawCrew(f.i); alpha(0.35, () => R(f.x0, f.top, f.x1 - f.x0, f.fy - f.top + 2, '#0b1030')); }
      drawRoad();
      drawProps();
      V.forEach((v, i) => { if (v.state === 'parked') drawVehicle(v, i); });
      drawDoors();
      V.forEach((v, i) => { if (v.state !== 'parked') drawVehicle(v, i); });
    },
    drawLit() {
      if (!bed.asleep) for (const f of B.floors) { drawRoom(f, true); drawCrew(f.i); }
      drawCrew('down');
      drawParticles();
    },
    drawUI() {
      drawPalette();
      if (!bed.on) { const v = V[selected]; drawArrow(Math.floor(v.x + v.len / 2), Math.floor(v.y - v.h - 13 + Math.sin(T * 6) * 2)); }
      else if (!bed.asleep) V.forEach((v, i) => {   // sleepy hints over the bays that still need tucking in
        if (v.state === 'parked' && !v.tucked) text('Z', B.bays[i] + B.bayW / 2 - 3 + Math.sin(T * 3 + i) * 2, B.bayTop - 14 + Math.sin(T * 4 + i) * 2, 2, '#ffffff');
      });
      drawButtons();
    },
  };
})();
