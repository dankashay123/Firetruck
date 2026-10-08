// The fire station: garage with the three vehicles, crew floors upstairs, paint pots,
// mini-game launchers and bedtime.
'use strict';
(() => {
  const B = {};                       // building layout
  const dog = { jump: 0 }, bell = { swing: 0 }, hydrant = { spray: 0 };
  const doors = [0, 0, 0];            // garage door closed amount, 0 open .. 1 closed
  const bed = { on: false, asleep: false, lullaby: 0, sung: 0 };
  const menu = { open: false, k: 0, x: 0, y: 0, r: 18 };   // the launcher menu and how far it has opened (0..1)
  let selected = VI.fire, paintCount = 0, bCache = null, potCache = null;
  let crew = [], seats = [], btns = [], pots = [];

  /* ---------- layout ---------- */
  function layout() {
    bCache = null; potCache = null;
    B.annexW = 18; B.bayW = 76; B.bayGap = 6; B.bayH = 50;
    B.w = B.annexW + 3 * B.bayW + 2 * B.bayGap + 16;
    B.x = Math.floor(L.cx - B.w / 2);
    B.mainX = B.x + B.annexW;
    B.bays = [0, 1, 2].map(i => B.mainX + 8 + i * (B.bayW + B.bayGap));
    B.bayTop = L.floorY - B.bayH;
    B.signTop = B.bayTop - 22;
    // Upper floors grow to fill the screen up to about the middle when there's room.
    const maxAvail = B.signTop - 34 - L.safeT;
    const desired = W > H ? maxAvail : B.signTop - 30 - H * 0.3;   // sideways, every floor gets shown
    const avail = desired >= 40 ? Math.min(maxAvail, desired) : Math.max(34, Math.min(maxAvail, 56));
    B.nFloors = avail >= 180 ? 3 : avail >= 116 ? 2 : 1;   // tall screens get a games room up top
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
    // wide screens: life on the lawns either side (the slide and the ice cream truck move the dog and trees)
    const yd = typeof YARD !== 'undefined' ? YARD.layout(B) : null;
    B.leftTreeX = yd ? yd.leftTree : null; B.rightTreeX = yd ? yd.rightTree : null;
    if (yd) B.dogX = yd.dogX;
    // mini-game launchers: one big menu button that opens into a grid of the rest
    const kinds = ['fire', 'amb', 'police', 'help', 'wash', 'icecream', 'dig', 'bath', 'trash', 'chopper', 'stickers', 'movies', 'drive', 'bed'];
    const side = B.x - L.safeL >= 100 && B.top - L.safeT < 120;
    const sp = side ? 32 : 38, r = side ? 13 : 16;
    const cols = side ? 3 : Math.max(3, Math.min(6, Math.floor((W - L.safeR - L.safeL - 8) / sp)));
    const ox = L.safeL + (side ? 20 : 24), oy = L.safeT + (side ? 22 : 30);
    menu.x = ox; menu.y = oy; menu.r = r + (side ? 2 : 4);
    btns = kinds.map((k, i) => ({ k, x: ox + ((i + 1) % cols) * sp, y: oy + Math.floor((i + 1) / cols) * sp, r }));
    const twoCol = side;
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
      f.walk = [f.x0 + 14, f.x1 - 12];
      if (f.i === 0) {                          // crew room: table and kitchen
        f.table = Math.round(f.x0 + w * 0.38); f.tw = 46;
        seats.push({ f: 0, x: f.table - 8, dir: 1, kind: 'chair', who: null });
        seats.push({ f: 0, x: f.table + f.tw + 8, dir: -1, kind: 'chair', who: null });
      } else if (f.i === 2) {                   // games room: ping-pong, a hoop, a beanbag
        f.pp = Math.round(f.x0 + w * 0.42); f.ppw = 44;
        seats.push({ f: 2, x: f.pp - 7, dir: 1, kind: 'paddle', who: null });
        seats.push({ f: 2, x: f.pp + f.ppw + 7, dir: -1, kind: 'paddle', who: null });
        f.bean = f.x1 - 30;
        seats.push({ f: 2, x: f.bean, dir: -1, kind: 'couch', who: null });
      } else {                                  // bunk room: bunks, lockers, couch and TV
        f.bunk = f.x0 + 38; f.locker = f.x0 + 84; f.couch = f.x1 - 82;
        seats.push({ f: 1, x: f.couch + 11, dir: 1, kind: 'couch', who: null });
        seats.push({ f: 1, x: f.couch + 29, dir: 1, kind: 'couch', who: null });
      }
    }
  }

  function hireCrew() {
    const roster = [['ff', 0], ['ff', 0], ['cop', 0], ['medic', 0]];
    if (B.nFloors > 1) roster.push(['ff', 1, true], ['medic', 1], ['cop', 1]);
    if (B.nFloors > 2) roster.push(['ff', 2], ['medic', 2], ['cop', 2]);
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
        case 'sleep': if (Math.random() < dt * 0.5) zzz(f.bunk + 12, f.fy - 22); break;
      }
      if (p.appear) p.appear = Math.max(0, p.appear - dt);
    }
  }
  function crewHit(x, y) {
    for (const p of crew) {
      if (p.state === 'gone') continue;
      const f = floorOf(p), lying = p.state === 'sleep' || p.state === 'wake';
      const yb = lying ? f.fy - 8 : p.state === 'sit' ? f.fy - 8 + 10 : p.y;
      const hx = lying ? f.bunk + 18 : p.x, hw = lying ? 18 : 9;
      if (x > hx - hw && x < hx + hw && y > yb - 26 && y < yb + 3) return p;
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
          if (v.mission) { const m = v.mission; v.mission = null; v.state = 'away'; v.x = W + 200; goScene(m, { v: V.indexOf(v) }); continue; }
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
    menu.open = false;
    if (k === 'bed') { bed.on ? wakeUp() : bedtime(); return; }
    if (bed.on) return;
    if (!SCENES[k]) return;   // that mini-game isn't installed
    if (['help', 'chopper', 'stickers', 'movies', 'drive', 'icecream', 'dig', 'bath', 'trash'].includes(k)) { SFX.chime(); goScene(k); return; }
    if (k === 'wash') { if (pendingMission) return; SFX.chime(); say(pick(V[selected].kind)); launchMission(selected, 'wash'); return; }
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
    menu.k += Math.sign((menu.open ? 1 : 0) - menu.k) * Math.min(Math.abs((menu.open ? 1 : 0) - menu.k), dt * 4);
    updateVehicles(dt);
    updateCrew(dt);
    updateBedtime(dt);
    YARD.update(dt, bed.on);
    stationMusic(!bed.on && !pendingMission);
    dog.jump = Math.max(0, dog.jump - dt);
    bell.swing = Math.max(0, bell.swing - dt);
    if (hydrant.spray > 0) {
      hydrant.spray -= dt;
      const nx = B.hydX + 4, ny = L.floorY - 8;
      spawn(3, i => ({ x: nx + (i % 2 ? 6 : -2), y: ny, vx: (i % 2 ? 1 : -1) * rand(25, 55), vy: rand(-100, -60), g: 240, life: 0.7, max: 0.7, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.5 ? '#6fc8ff' : '#d8f2ff' }));
    }
    if (Math.random() < dt * 1.5 && !bed.asleep && B.floors[0]) {   // steam from the cooking pot
      const f = B.floors[0];
      parts.push({ x: f.x1 - 33 + rand(-2, 2), y: f.fy - 24, vx: rand(-3, 3), vy: -10, g: 0, life: 1.2, max: 1.2, s: 2, c: '#ffffff' });
    }
  }

  // soft background music around the station (it rests during bedtime and missions)
  let music = null;
  function stationMusic(on) {
    if (!music && typeof TOY !== 'undefined') music = TOY.bank({}, {}, 'station-music', 0.13);
    if (!music) return;
    music.load(); if (music.playing() !== on || music.wantMusic !== on) music.music(on);
  }

  /* ---------- tap ---------- */
  function tap(x, y) {
    if ((x - menu.x) ** 2 + (y - menu.y) ** 2 <= (menu.r + 6) ** 2) {
      if (bed.on) launch('bed');   // in bedtime the menu button is the sun that wakes everyone up
      else if (!pendingMission) { menu.open = !menu.open; menu.open ? [523, 784].forEach((f, i) => tone('sine', f, i * 0.06, 0.15, 0.12)) : [784, 523].forEach((f, i) => tone('sine', f, i * 0.06, 0.15, 0.1)); }
      return true;
    }
    if (menu.open) {   // the full-screen game picker: a tile starts its game, anything else stays put
      if (menu.k > 0.6) for (const t of pickerTiles()) if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) { SFX.chime(); launch(t.k); return true; }
      return true;
    }
    if (YARD.tap(x, y, bed.on)) return true;
    if (PETS.tap('station0', x, y) || PETS.tap('station0c', x, y) || PETS.tap('station1', x, y)) return true;
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
  // The building doesn't change between frames (only the bell swings), so it's drawn once
  // into an offscreen image after each layout and copied every frame.
  function drawBuilding() {
    if (!bCache || bCache.width !== W || bCache.height !== H) {
      bCache = document.createElement('canvas'); bCache.width = W; bCache.height = H;
      const prev = g; g = bCache.getContext('2d'); drawBuildingStatic(); g = prev;
    }
    g.drawImage(bCache, 0, 0);
    const tx = B.towerX, tt = B.top - 26;
    const sw = bell.swing > 0 ? Math.round(Math.sin(bell.swing * 14) * 2) : 0;
    const bx = tx + sw, by = tt + 5;
    R(bx - 3, by, 6, 2, '#ffd21f'); R(bx - 4, by + 2, 8, 5, '#ffd21f'); R(bx - 5, by + 7, 10, 2, '#e0a81a');
    R(bx - 2, by + 1, 1, 5, '#fff3a6'); R(bx - sw - 1, by + 9, 2, 2, '#8a6a20');
  }
  function drawBuildingStatic() {
    const x = B.x, w = B.w, top = B.top, bot = L.floorY;
    // bell tower (the bell itself is drawn live)
    const tx = B.towerX, tt = top - 26;
    R(tx - 14, tt - 6, 28, 3, TRIM); R(tx - 10, tt - 9, 20, 3, TRIM); R(tx - 5, tt - 12, 10, 3, TRIM);
    R(tx - 12, tt - 3, 24, 30, BRICK);
    R(tx - 8, tt + 2, 16, 18, '#3a3442'); R(tx - 8, tt + 2, 16, 1, '#2a2530');
    R(tx - 1, tt + 2, 2, 3, '#6b5a3a');
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
    R(x + 1, bot - 28, 16, 28, TRIM); R(x + 3, bot - 26, 12, 26, '#6b4a2e'); R(x + 12, bot - 13, 2, 2, '#ffd21f');
    // wall lamps beside the bays (lit at night)
    for (const lx of lampXs()) { R(lx - 2, B.bayTop - 9, 5, 2, '#3a3d46'); R(lx - 1, B.bayTop - 7, 3, 3, '#fff3a6'); }
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
  function drawSnowCaps() {
    const k = weather.kind === 'snow' ? weather.k : 0;
    if (k < 0.05) return;
    alpha(k, () => {
      R(B.x - 4, B.top - 6, B.w + 8, 3, '#ffffff');
      R(B.towerX - 15, B.top - 35, 30, 2, '#ffffff'); R(B.towerX - 11, B.top - 38, 22, 2, '#ffffff');
      R(B.mainX + (B.w - B.annexW - 106) / 2, B.signTop + 2, 106, 2, '#ffffff');
      for (const bx of B.bays) R(bx - 2, B.bayTop - 3, B.bayW + 4, 2, '#ffffff');
      R(B.hydX, L.floorY - 15, 9, 2, '#ffffff');
      R(0, L.floorY - 2, W, 2, '#ffffff');
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
  // the family's pets live at the station too: the dogs in the kitchen, the cat napping on the top bunk
  function stationPets(f) {
    const sleepy = bed.on;
    if (YARD.on && !sleepy) return;   // out playing in the yard
    if (f.i === 0) {
      const one = B.nFloors < 2;
      PETS.draw(one ? 'station0c' : 'station0', { y: f.fy, x0: f.walk[0] + 26, x1: f.walk[1] - 6, who: one ? ['cat', 'vizsla', 'husky'] : ['vizsla', 'husky'],
        spots: sleepy ? { vizsla: { x: f.x1 - 44, pose: 'sleep' }, husky: { x: f.x1 - 70, pose: 'sleep' }, cat: { x: f.x1 - 20, pose: 'sleep' } } : null });
    } else if (f.i === 1) {
      const pose = sleepy || Math.floor(T / 18) % 3 ? 'sleep' : 'sit';
      PETS.draw('station1', { y: f.fy - 29, x0: f.bunk + 14, x1: f.bunk + 22, who: ['cat'], spots: { cat: { x: f.bunk + 17, pose } } });
    }
  }
  function drawRoom(f, lightsOn) {
    const w = f.x1 - f.x0, h = f.fy - f.top;
    const wall = lightsOn ? '#f3e2c3' : '#7d6f60', wain = lightsOn ? '#e2c99e' : '#6e604f';
    R(f.x0, f.top, w, h, wall);
    R(f.x0, f.fy - 10, w, 10, wain); R(f.x0, f.fy - 11, w, 1, '#cdb184');
    R(f.x0, f.fy, w, 2, '#8a5a3a');
    // back-wall window with the real sky
    const wx = f.i === 0 ? f.table + f.tw + 16 : f.i === 2 ? f.x1 - 64 : f.locker + 34, wy = f.top + 8, ww = 22, wh = Math.min(16, h - 26);
    if (wh > 6) {
      R(wx - 1, wy - 1, ww + 2, wh + 2, '#ffffff');
      R(wx, wy, ww, wh, mix('#8fd6ff', '#141a45', nightK()));
      if (nightK() > 0.5) { R(wx + 15, wy + 3, 1, 1, '#ffffff'); R(wx + 5, wy + 6, 1, 1, '#ffffff'); }
      R(wx + ww / 2, wy, 1, wh, '#ffffff');
    }
    // stairwell door
    const dh = Math.min(27, h - 3);
    R(f.door - 7, f.fy - dh, 15, dh, '#d9c4a0'); R(f.door - 6, f.fy - dh + 1, 13, dh - 1, '#8a5a3a'); R(f.door + 4, f.fy - 13, 1, 2, '#ffd21f');
    // fire pole through the floor
    R(B.poleX - 3, f.fy, 6, 4, '#2a2530');
    R(B.poleX - 1, f.top, 2, h + 4, '#e0b010'); R(B.poleX - 1, f.top, 1, h + 4, '#fff3a6');
    // ceiling lamp
    const lx = f.x0 + Math.round(w * 0.55);
    R(lx, f.top, 1, 4, '#5a5f6e'); R(lx - 3, f.top + 4, 7, 2, lightsOn ? '#ffe873' : '#8a8466');
    if (lightsOn) alpha(0.25, () => circle(lx, f.top + 8, 9, '#fff3a6'));
    if (f.i === 0) drawKitchen(f, lightsOn); else if (f.i === 2) drawGamesRoom(f, lightsOn); else drawBunkRoom(f, lightsOn);
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
    for (const sx of seats.filter(q => q.f === 0)) {
      R(sx.x - 5, fy - 9, 11, 2, '#8a5a3a'); R(sx.x - 4, fy - 7, 1, 7, '#6b4a2e'); R(sx.x + 4, fy - 7, 1, 7, '#6b4a2e');
      R(sx.dir > 0 ? sx.x - 7 : sx.x + 6, fy - 24, 2, 24, '#6b4a2e');
    }
    R(tx, fy - 15, tw, 3, '#a8703f'); R(tx, fy - 12, tw, 1, '#8a5a3a'); R(tx + 3, fy - 11, 2, 11, '#8a5a3a'); R(tx + tw - 5, fy - 11, 2, 11, '#8a5a3a');
    R(tx + 3, fy - 18, 9, 3, '#f4f7fb'); R(tx + 4, fy - 19, 7, 1, '#f57a12');
    R(tx + tw - 12, fy - 18, 9, 3, '#f4f7fb'); R(tx + tw - 11, fy - 19, 7, 1, '#3fb43a');
    R(tx + tw / 2 - 3, fy - 24, 6, 9, '#ffffff'); R(tx + tw / 2 - 3, fy - 20, 6, 3, '#2a6fe0');
    // kitchen
    const kx = f.x1 - 66;
    R(kx, fy - 15, 24, 15, '#b07a4a'); R(kx, fy - 16, 24, 2, '#d9b98f'); R(kx + 11, fy - 11, 2, 1, '#e9eef2');
    R(kx + 24, fy - 15, 18, 15, '#c9cdd3'); R(kx + 24, fy - 16, 18, 1, '#5a5f6e'); R(kx + 27, fy - 11, 12, 7, '#3a3d46');
    R(kx + 28, fy - 22, 10, 6, '#5a5f6e'); R(kx + 27, fy - 22, 12, 1, '#7d8290');
    const fh = Math.min(34, h - 4);
    R(f.x1 - 22, fy - fh, 17, fh, '#e9eef2'); R(f.x1 - 22, fy - fh + 12, 17, 1, '#b4bec8'); R(f.x1 - 20, fy - fh + 4, 1, 5, '#7d8290'); R(f.x1 - 20, fy - fh + 15, 1, 6, '#7d8290');
    if (h > 52) { R(kx, f.top + 6, 42, 10, '#b07a4a'); R(kx + 20, f.top + 6, 1, 10, '#8a5a3a'); R(kx + 8, f.top + 13, 3, 1, '#e9eef2'); R(kx + 30, f.top + 13, 3, 1, '#e9eef2'); }
  }
  function drawGamesRoom(f) {
    const fy = f.fy, tx = f.pp, tw = f.ppw;
    // a basketball hoop on the wall, with a ball that drops through now and then
    const hx = f.x0 + 34, hy = f.top + 10;
    R(hx - 6, hy, 13, 9, '#ffffff'); R(hx - 5, hy + 1, 11, 7, '#f4f7fb'); R(hx - 2, hy + 3, 5, 3, '#e8222b'); R(hx - 1, hy + 4, 3, 1, '#f4f7fb');
    R(hx - 4, hy + 9, 9, 1, '#f57a12'); for (let k = 0; k < 4; k++) R(hx - 3 + k * 2, hy + 10, 1, 4, '#ffffff');
    // the ball rests on the floor; every so often it's shot up, swishes through the net and bounces back
    const ph = (T % 11) - 9, rx = hx + 14, ry = fy - 2;
    if (ph < 0) circle(rx, ry, 2, '#f57a12');
    else if (ph < 0.7) { const k = ph / 0.7; circle(Math.round(rx + (hx - rx) * k), Math.round(ry + (hy - 6 - ry) * k - Math.sin(k * Math.PI) * 12), 2, '#f57a12'); }
    else if (ph < 1.2) { const k = (ph - 0.7) / 0.5; circle(hx, Math.round(hy - 6 + k * (fy - 2 - (hy - 6))), 2, '#f57a12'); }
    else { const k = Math.min(1, (ph - 1.2) / 0.8); circle(Math.round(hx + (rx - hx) * k), Math.round(ry - Math.abs(Math.sin(k * Math.PI * 2)) * 5 * (1 - k)), 2, '#f57a12'); }
    // a pennant and a bookshelf
    R(f.x0 + 52, f.top + 8, 1, 10, '#8a5a3a'); for (let k = 0; k < 6; k++) R(f.x0 + 53, f.top + 8 + k, 10 - k * 1.6, 1, '#e8222b');
    const bx = f.x1 - 50;
    R(bx, fy - 26, 14, 26, '#a8743f'); R(bx + 1, fy - 25, 12, 24, '#7a4a2a');
    for (let r = 0; r < 3; r++) { R(bx + 1, fy - 17 + r * 8, 12, 1, '#a8743f'); for (let k = 0; k < 5; k++) R(bx + 2 + k * 2, fy - 24 + r * 8, 2, 6 - (k % 2), ['#e8222b', '#2a6fe0', '#ffd21f', '#3fb43a', '#ff6fb4'][(k + r) % 5]); }
    // a beanbag
    circle(f.bean, fy - 6, 6, '#8a4fd9'); R(f.bean - 7, fy - 5, 15, 5, '#8a4fd9'); R(f.bean - 7, fy - 1, 15, 1, '#6a34b0'); R(f.bean - 3, fy - 10, 3, 2, '#b48ae8');
    // the ping-pong table, and a ball flying back and forth while two people play
    R(tx, fy - 13, tw, 3, '#2a8a4a'); R(tx, fy - 13, tw, 1, '#3fb46a'); R(tx + 1, fy - 12, tw - 2, 1, '#ffffff');
    R(tx + Math.floor(tw / 2) - 1, fy - 17, 2, 4, '#ffffff'); R(tx + 2, fy - 10, 2, 10, '#3a3d46'); R(tx + tw - 4, fy - 10, 2, 10, '#3a3d46');
    const players = seats.filter(s => s.f === 2 && s.kind === 'paddle' && s.who && s.who.state === 'sit').length;
    if (players === 2) {
      const k = (T * 1.4) % 2, dir = k < 1 ? 1 : -1, u = k < 1 ? k : 2 - k;
      const bxp = tx - 2 + u * (tw + 4), byp = fy - 15 - Math.abs(Math.sin(u * Math.PI * 2)) * 9;
      R(Math.round(bxp), Math.round(byp), 2, 2, '#ffffff');
    } else R(tx + 8, fy - 15, 2, 2, '#ffffff');
  }
  function drawBunkRoom(f) {
    const fy = f.fy, bx = f.bunk;
    // bunk bed
    R(bx, fy - 34, 2, 34, '#8a5a3a'); R(bx + 36, fy - 34, 2, 34, '#8a5a3a');
    R(bx + 2, fy - 11, 34, 4, '#f4f7fb'); R(bx + 2, fy - 7, 34, 2, '#8a5a3a');
    R(bx + 2, fy - 29, 34, 4, '#f4f7fb'); R(bx + 2, fy - 25, 34, 2, '#8a5a3a');
    R(bx + 3, fy - 14, 8, 3, '#ffffff'); R(bx + 3, fy - 32, 8, 3, '#ffffff');
    R(bx + 13, fy - 31, 22, 2, '#3fb43a');
    circle(bx + 26, fy - 34, 4, '#a8703f'); circle(bx + 23, fy - 38, 2, '#a8703f'); circle(bx + 29, fy - 38, 2, '#a8703f'); R(bx + 27, fy - 35, 1, 1, INK); R(bx + 25, fy - 35, 1, 1, INK); // teddy
    // lockers with helmets on top
    const lx = f.locker;
    for (let k = 0; k < 3; k++) { R(lx + k * 10, fy - 30, 9, 30, '#7d8aa0'); R(lx + k * 10 + 1, fy - 28, 7, 1, '#5d6a80'); R(lx + k * 10 + 1, fy - 26, 7, 1, '#5d6a80'); R(lx + k * 10 + 7, fy - 16, 1, 4, '#cfd6dd'); }
    R(lx, fy - 34, 8, 4, '#e8222b'); R(lx - 1, fy - 31, 10, 1, '#e8222b'); R(lx + 10, fy - 34, 8, 4, '#e8222b'); R(lx + 9, fy - 31, 10, 1, '#e8222b');
    // couch and TV
    const cx = f.couch;
    R(cx, fy - 22, 5, 22, '#a8403d'); R(cx, fy - 9, 40, 6, '#c0504d'); R(cx, fy - 9, 40, 1, '#d8706d'); R(cx + 36, fy - 13, 5, 10, '#a8403d'); R(cx + 2, fy - 3, 2, 3, '#6b2a28'); R(cx + 36, fy - 3, 2, 3, '#6b2a28');
    const tvx = f.x1 - 28;
    R(tvx, fy - 12, 22, 12, '#8a5a3a');
    R(tvx + 1, fy - 28, 20, 15, '#2f3240');
    const ch = Math.floor(T * 1.5) % 3;
    R(tvx + 2, fy - 27, 18, 13, ['#8fd6ff', '#3fb43a', '#ffd21f'][ch]);
    R(tvx + 5, fy - 21, 11, 4, '#e8222b'); R(tvx + 13, fy - 23, 3, 2, '#e8222b'); R(tvx + 6, fy - 17, 2, 2, INK); R(tvx + 13, fy - 17, 2, 2, INK);
  }
  function drawSleeper(p, f) {
    const bx = f.bunk, fy = f.fy, breathe = Math.floor(T * 1.2 + p.seed) % 2;
    if (p.state === 'wake') {
      drawPerson({ type: p.type, x: bx + 12, yb: fy - 11, dir: 1, pose: 'sit', skin: p.skin, hair: p.hair, seed: p.seed });
      R(bx + 20, fy - 15, 15, 4, '#3a6fd8');
      return;
    }
    circle(bx + 9, fy - 15, 4, p.skin); R(bx + 5, fy - 19, 8, 3, p.hair); R(bx + 5, fy - 17, 2, 3, p.hair);
    R(bx + 10, fy - 16, 2, 1, INK); R(bx + 12, fy - 13, 1, 1, '#ff9c8a');
    R(bx + 13, fy - 16 + breathe, 22, 5 - breathe, '#3a6fd8'); R(bx + 13, fy - 16 + breathe, 22, 1, '#6f9cf0');
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
      if (p.state === 'sit' && p.seat.kind === 'paddle') { pose = 'carry'; yb = p.y; }
      else if (p.state === 'sit') { pose = p.wave > 0 ? 'wave' : (p.seat.kind === 'chair' ? 'eat' : 'sit'); yb = f.fy - 8; }
      if (p.state === 'sit' && pose === 'wave') pose = 'sit';
      if (p.state === 'slide') pose = 'slide';
      const draw = () => drawPerson({ type: p.type, x: p.x, yb, dir: p.dir, pose, walk: p.state === 'walk' || p.state === 'exit', skin: p.skin, hair: p.hair, seed: p.seed, hop });
      if (p.appear) alpha(1 - p.appear / 0.6, draw); else draw();
      if (p.state === 'sit' && p.seat.kind === 'paddle') { const px = Math.round(p.x + p.dir * 7), swing = Math.floor(T * 2.8 + (p.dir > 0 ? 0 : 1)) % 2; circle(px, yb - 11 - swing * 2, 2, '#e8222b'); R(px - p.dir * 2, yb - 9 - swing * 2, 1, 2, '#8a5a3a'); }
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
    if (YARD.on) { if (B.leftTreeX) spots.push(B.leftTreeX); if (B.rightTreeX) spots.push(B.rightTreeX); }
    else { if (B.leftTree) spots.push(B.x - 46); if (B.rightTree) spots.push(B.x + B.w + 34); }
    for (const tx of spots) drawTree(tx, L.floorY, 11);
  }
  function drawVehicle(v, i) {
    const moving = v.state !== 'parked';
    let bob = (v.state === 'drive' || v.state === 'arrive') ? (Math.floor(v.x / 7) % 2 ? 0 : -1) : 0;
    if (v.hop > 0) bob -= Math.round(Math.sin(v.hop / 0.35 * Math.PI) * 4);
    drawV(i, v.x, v.y, moving, bob, v.rot, v.state === 'parked' && doors[i] > 0.5);
  }

  /* ---------- night lights ---------- */
  function lampXs() { return [B.x + 9, ...B.bays.map(b => b - 4), B.bays[2] + B.bayW + 4]; }
  function cone(cx, y, len, spread, a, c) {
    for (let j = 0; j < len; j++) { const half = 1 + j * spread; alpha(a * (1 - j / (len + 2)), () => R(cx - half, y + j, half * 2 + 1, 1, c)); }
  }
  function drawBuildingLights(k) {
    // wall lamps
    for (const lx of lampXs()) {
      alpha(k, () => R(lx - 1, B.bayTop - 7, 3, 3, '#fffbe0'));
      alpha(0.4 * k, () => circle(lx, B.bayTop - 6, 4, '#fff3b0'));
      cone(lx, B.bayTop - 4, 16, 0.55, 0.22 * k, '#ffe9a0');
    }
    // lights inside the open bays
    B.bays.forEach((bx, i) => {
      if (doors[i] > 0.3 || bed.asleep) return;
      const cx = bx + B.bayW / 2;
      alpha(k, () => R(cx - 4, B.bayTop + 8, 9, 2, '#fffbe0'));
      cone(cx, B.bayTop + 10, B.bayH - 13, 0.7, 0.16 * k, '#fff3b0');
    });
    // the sign glows
    const signW = 104, sx = Math.floor(B.mainX + (B.w - B.annexW - signW) / 2);
    alpha(0.25 * k, () => R(sx - 4, B.signTop + 1, signW + 8, 20, '#ff9a3a'));
    alpha(k, () => { R(sx, B.signTop + 4, signW, 14, '#9a2424'); text('FIRE STATION', sx + 5, B.signTop + 6, 2, '#fff6e0'); });
    // bell tower lamp
    alpha(0.35 * k, () => circle(B.towerX, B.top - 16, 10, '#ffe873'));
    alpha(k * 0.8, () => { R(B.towerX - 3, B.top - 21, 6, 2, '#ffd21f'); R(B.towerX - 4, B.top - 19, 8, 5, '#ffd21f'); R(B.towerX - 5, B.top - 14, 10, 2, '#e0a81a'); });
  }

  /* ---------- draw: UI ---------- */
  function drawArrow(cx, ty) {
    R(cx - 3, ty - 1, 7, 6, '#1d1a2b'); R(cx - 6, ty + 4, 13, 2, '#1d1a2b');
    R(cx - 5, ty + 6, 11, 1, '#1d1a2b'); R(cx - 4, ty + 7, 9, 1, '#1d1a2b'); R(cx - 3, ty + 8, 7, 1, '#1d1a2b');
    R(cx - 2, ty + 9, 5, 1, '#1d1a2b'); R(cx - 1, ty + 10, 3, 1, '#1d1a2b');
    R(cx - 2, ty, 5, 5, '#ffd21f'); R(cx - 5, ty + 5, 11, 1, '#ffd21f'); R(cx - 4, ty + 6, 9, 1, '#ffd21f');
    R(cx - 3, ty + 7, 7, 1, '#ffd21f'); R(cx - 2, ty + 8, 5, 1, '#ffd21f'); R(cx - 1, ty + 9, 3, 1, '#ffd21f');
  }
  function drawPot(p, raised) {
    const c = COLOR[p.key].c, r = Math.floor(L.blob / 2), cy = p.cy - (raised ? 2 : 0);
    if (raised) circle(p.cx, cy, r + 3, '#ffffff');
    circle(p.cx, cy + 2, r, '#2f6b29');
    circle(p.cx, cy, r, c[2]);
    circle(p.cx, cy - 1, r - 1, c[1]);
    circle(p.cx - Math.floor(r / 3), cy - Math.floor(r / 3), Math.max(2, Math.floor(r / 4)), c[0]);
  }
  function drawPalette() {
    if (!potCache || potCache.width !== W || potCache.height !== H) {
      potCache = document.createElement('canvas'); potCache.width = W; potCache.height = H;
      const prev = g; g = potCache.getContext('2d'); drawStrip(); for (const p of pots) drawPot(p, false); g = prev;
    }
    g.drawImage(potCache, 0, 0);
    const sel = pots.find(p => p.key === V[selected].color);
    if (sel) { const r = Math.floor(L.blob / 2); R(sel.cx - r - 1, sel.cy - r, 2 * r + 3, 2 * r + 5, '#5aa84c'); drawPot(sel, true); }
  }

  const ICONS = {
    fire: (x, y, r) => { roundButton(x, y, r, '#e8222b', true); flame(x, y + 9, 1.15, 1); },
    amb: (x, y, r) => { roundButton(x, y, r, '#f4f7fb', true); R(x - 2, y - 8, 5, 16, '#e8222b'); R(x - 8, y - 2, 16, 5, '#e8222b'); },
    police: (x, y, r) => {
      roundButton(x, y, r, '#2a6fe0', true);
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; for (let d = 0; d < 9; d++) R(x + Math.cos(a) * d - 1, y + Math.sin(a) * d - 1, 3, 3, '#ffd21f'); }
      circle(x, y, 4, '#ffd21f'); R(x - 1, y - 1, 3, 3, '#c99410');
    },
    help: (x, y, r) => {
      roundButton(x, y, r, '#3fb43a', true);
      circle(x - 4, y - 3, 4, '#ffffff'); circle(x + 4, y - 3, 4, '#ffffff');
      for (let k = 0; k < 7; k++) R(x - 8 + k, y - 1 + k, 17 - 2 * k, 1, '#ffffff');
    },
    wash: (x, y, r) => {
      roundButton(x, y, r, '#3fc6e8', true);
      circle(x - 3, y + 2, 5, '#ffffff'); circle(x + 4, y - 1, 4, '#ffffff'); circle(x + 2, y + 6, 3, '#ffffff'); circle(x - 5, y - 5, 2, '#ffffff');
      R(x - 4, y + 1, 2, 2, '#bfe6ff'); R(x + 3, y - 2, 2, 2, '#bfe6ff');
    },
    chopper: (x, y, r) => {
      roundButton(x, y, r, '#8fd6ff', true);
      const c = COLOR.red.c;
      R(x - 9, y - 6, 18, 1, '#3a3d46'); R(x, y - 5, 1, 2, '#3a3d46');
      R(x - 4, y - 3, 10, 7, c[1]); R(x - 11, y - 1, 8, 2, c[1]); R(x - 12, y - 3, 2, 4, c[1]); R(x + 2, y - 2, 4, 3, GLASS);
      R(x - 4, y + 5, 10, 1, '#3a3d46');
    },
    stickers: (x, y, r) => {
      roundButton(x, y, r, '#ff6fb4', true);
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; for (let d = 0; d < 8; d++) R(x + Math.cos(a) * d - 1, y + Math.sin(a) * d - 1, 3, 3, '#ffffff'); }
      circle(x, y, 3, '#ffffff'); R(x + 3, y + 4, 3, 3, '#ffd21f');
    },
    movies: (x, y, r) => {
      roundButton(x, y, r, '#2a1420', true);
      R(x - 9, y - 7, 18, 13, '#ffd21f'); R(x - 8, y - 6, 16, 11, '#3a2a4a');
      for (let k = 0; k < 7; k++) R(x - 2, y - 4 + k, Math.min(k, 6 - k) + 1, 1, '#ffffff');
      R(x - 4, y + 6, 8, 2, '#ffd21f'); R(x - 9, y - 9, 2, 2, '#e8222b'); R(x + 7, y - 9, 2, 2, '#e8222b');
    },
    icecream: (x, y, r) => {
      roundButton(x, y, r, '#ff8fb8', true);
      for (let k = 0; k < 8; k++) R(x - 4 + (k >> 1), y + 1 + k, 9 - (k >> 1) * 2, 1, k % 2 ? '#b07a34' : '#d9a35a');
      circle(x, y - 3, 5, '#fff6e0'); circle(x - 2, y - 5, 2, '#ffffff'); R(x, y - 10, 2, 2, '#e8222b');
      R(x - 3, y - 4, 1, 1, '#2a6fe0'); R(x + 2, y - 2, 1, 1, '#3fb43a'); R(x + 1, y - 6, 1, 1, '#ffd21f');
    },
    drive: (x, y, r) => {
      roundButton(x, y, r, '#f57a12', true);
      circle(x, y, 9, '#2f3240'); circle(x, y, 7, '#f57a12'); circle(x, y, 2, '#2f3240');
      R(x - 7, y - 1, 14, 2, '#2f3240'); R(x - 1, y, 2, 7, '#2f3240');
    },
    bed: (x, y, r) => {
      roundButton(x, y, r, '#55289a', true);
      circle(x - 1, y, 8, '#fff3a6'); circle(x + 3, y - 3, 7, '#55289a');
      text('Z', x + 3, y + 1, 1, '#ffffff'); text('Z', x + 7, y - 5, 1, '#ffffff');
    },
  };
  function btnShown(b) {
    if (b.k === 'bed') return true;
    if (!SCENES[b.k]) return false;
    return b.k !== 'movies' || ['movieFire', 'moviePolice', 'movieAmb'].some(m => SCENES[m]);
  }
  function drawMenuButton() {
    const { x, y, r } = menu;
    if (bed.on) { roundButton(x, y, r, '#ffd21f', true); drawSun0(x, y); return; }
    if (menu.open) {   // close button
      roundButton(x, y, r, '#ffffff', false);
      const a = Math.round(r * 0.45);
      for (let i = -a; i <= a; i++) { R(x + i - 1, y + i - 1, 3, 3, '#e8222b'); R(x + i - 1, y - i - 1, 3, 3, '#e8222b'); }
      return;
    }
    roundButton(x, y, r, '#ffd21f', true);
    // four toy squares: red, blue, white and green, spreading apart as the menu opens
    const d = Math.round(r * 0.12 + 1 + menu.k * 1.5), s = Math.max(5, Math.round(r * 0.36));
    const sq = [['#e8222b', -1, -1], ['#2a6fe0', 1, -1], ['#3fb43a', -1, 1], ['#f57a12', 1, 1]];
    for (const [c, sx, sy] of sq) {
      const cx = x + sx * d - (sx < 0 ? s : 0), cy = y + sy * d - (sy < 0 ? s : 0);
      R(cx, cy + 1, s, s, '#2f3240'); R(cx, cy, s, s, c); R(cx + 1, cy + 1, 2, 1, '#ffffff');
    }
  }
  /* ---------- the game picker: a full-screen page of big picture tiles ---------- */
  const LABEL = { fire: 'FIRE', amb: 'AMBULANCE', police: 'POLICE', help: 'WHO HELPS?', wash: 'CAR WASH', icecream: 'ICE CREAM', dig: 'DIGGER', bath: 'DOG BATH', trash: 'GARBAGE', chopper: 'HELICOPTER', stickers: 'STICKERS', movies: 'MOVIES', drive: 'DRIVE', bed: 'BEDTIME' };
  const TILE_BG = { fire: '#ffd9d4', amb: '#e8f0fa', police: '#d6e4ff', help: '#d9f2d4', wash: '#d4f1fa', icecream: '#ffe0ec', dig: '#ffe9b8', bath: '#d4ecff', trash: '#dcf4d4', chopper: '#dff1ff', stickers: '#ffdcef', movies: '#e6d9f2', drive: '#ffe6cc', bed: '#e2d6f5' };
  /* little picture cards for the picker, drawn with the game's own sprites at its own pixel size */
  const ART_W = 72, ART_H = 50;
  let artCv = null;
  const sky = (top = '#8fd6ff', bot = '#c4ecff') => { R(0, 0, ART_W, 26, top); R(0, 26, ART_W, 14, bot); };
  const grass = (y = 40) => { R(0, y, ART_W, ART_H - y, '#6cbf5a'); R(0, y, ART_W, 1, '#8fd877'); for (let x = 3; x < ART_W; x += 9) R(x, y + 4 + (x % 3), 2, 1, '#5aa84c'); };
  const roadStrip = (y = 40) => { grass(y); R(0, y + 2, ART_W, 6, '#4b4f5c'); for (let x = 2; x < ART_W; x += 12) R(x, y + 5, 6, 1, '#ffd21f'); };
  const cloud = (x, y) => { circle(x, y, 4, '#ffffff'); circle(x + 5, y - 2, 5, '#ffffff'); circle(x + 10, y, 4, '#ffffff'); R(x, y, 10, 4, '#ffffff'); };
  function heliAt(x, y) { const s0 = { x: heli.x, y: heli.y, hop: heli.hop }; Object.assign(heli, { x, y, hop: 0 }); drawHeli(); Object.assign(heli, s0); }
  const ART = {
    fire: () => { sky(); cloud(6, 10); roadStrip(); drawV(VI.fire, 3, 47, false, 0, T * 3, true); },
    amb: () => { sky(); cloud(48, 9); roadStrip(); drawV(VI.amb, 5, 47, false, 0, T * 3, true); },
    police: () => { sky(); cloud(8, 8); roadStrip(); drawV(VI.police, 8, 47, false, 0, T * 3, true); },
    help: () => {
      sky(); grass(42); drawTree(20, 45, 13);
      drawCat(24, 20, 1, '#f5a24a');
      drawPerson({ type: 'kid', x: 50, yb: 46, dir: -1, pose: 'wave', skin: SKIN[1], seed: 1 });
      R(56, 4, 13, 14, INK); R(57, 5, 11, 12, '#ffffff'); R(58, 17, 3, 2, '#ffffff'); text('?', 60, 7, 2, '#2a6fe0');
    },
    wash: () => {
      R(0, 0, ART_W, 40, '#bfe6ff'); for (let x = 0; x < ART_W; x += 8) R(x, 0, 4, 40, '#aed8f4');
      R(0, 40, ART_W, 10, '#9aa3ad'); R(0, 40, ART_W, 1, '#cfd6dd');
      drawV(VI.police, 8, 46, false, 0, 0, true);
      for (const [bx, by, r] of [[14, 22, 5], [24, 18, 6], [36, 24, 5], [50, 20, 6], [60, 28, 4], [30, 32, 4], [44, 34, 3], [10, 34, 3]]) { circle(bx, by - Math.round(Math.sin(T * 2 + bx) * 1.5), r, '#ffffff'); circle(bx - 1, by - 1 - Math.round(Math.sin(T * 2 + bx) * 1.5), Math.max(1, r - 3), '#e6f6ff'); }
      for (let i = 0; i < 6; i++) R(6 + i * 12, ((T * 40 + i * 9) % 30) | 0, 1, 3, '#4aa8e8');
    },
    icecream: () => {
      R(0, 0, ART_W, ART_H, '#ffe0ec'); for (let i = 0; i < 9; i++) R(i * 8, 0, 4, 6, i % 2 ? '#ffffff' : '#e8222b');
      for (let i = 0; i < 9; i++) circle(i * 8 + 2, 6, 2, i % 2 ? '#ffffff' : '#e8222b');
      const ic = SCENES.icecream && SCENES.icecream._treat;
      if (ic) { const b = Math.round(Math.sin(T * 3)); ic(0, 5, 47 + b, 2); ic(4, 27, 47, 2); ic(5, 49, 47 - b, 2); }
    },
    dig: () => {
      sky(); R(0, 36, ART_W, 14, '#c08a52'); R(0, 36, ART_W, 1, '#a8743f');
      for (let i = 0; i < 26; i++) { const k = 1 - ((i - 12) / 13) ** 2; if (k > 0) R(i - 4, 37 - Math.round(16 * Math.sqrt(k)), 1, Math.round(16 * Math.sqrt(k)), i > 14 ? '#dcb55c' : '#f2d27a'); }
      if (SCENES.dig) SCENES.dig.card(35, 48 - Math.round(Math.abs(Math.sin(T * 3))));
    },
    bath: () => {
      R(0, 0, ART_W, 30, '#bfe6ff'); R(0, 30, ART_W, 20, '#6cbf5a');
      for (let x = 0; x < ART_W; x += 7) { R(x, 18, 6, 12, '#e6b878'); R(x + 6, 18, 1, 12, '#b8884a'); }
      const D = SCENES.icecream && SCENES.icecream._dogs;
      if (D) { g.save(); g.translate(20, 38); g.scale(2, 2); D.vizsla(8, 0, 1, { wag: true }); g.restore(); }
      R(10, 34, 52, 13, '#4a90d0'); R(8, 32, 56, 3, '#a8d4f4'); R(14, 46, 6, 3, '#3a7ab8'); R(52, 46, 6, 3, '#3a7ab8');
      for (const [bx, by, r] of [[16, 31, 4], [24, 29, 5], [33, 31, 4], [46, 30, 4], [55, 31, 3], [40, 14, 3], [52, 8, 2], [28, 10, 2]]) { const b = Math.round(Math.sin(T * 2 + bx) * 1.5); circle(bx, by - b, r, '#f4fbff'); R(bx - r + 1, by - b - r + 1, 1, 1, '#ffffff'); }
      R(12, 28, 7, 4, '#ffd21f'); R(16, 25, 4, 4, '#ffd21f'); R(20, 26, 2, 1, '#f57a12');
    },
    trash: () => {
      sky(); R(0, 30, ART_W, 6, '#6cbf5a'); R(0, 36, ART_W, 8, '#4b4f5c'); R(0, 44, ART_W, 6, '#d8d2c4');
      for (let x = 2; x < ART_W; x += 12) R(x, 40, 6, 1, '#ffd21f');
      if (SCENES.trash) SCENES.trash.card(30 + Math.round(Math.sin(T * 2)), 42);
      R(62, 34, 8, 11, '#2a6fe0'); R(61, 32, 10, 3, '#1f58b8'); circle(63, 46, 1, '#2f3240'); circle(68, 46, 1, '#2f3240');
    },
    chopper: () => {
      sky('#7cc8f8', '#b8e4ff'); cloud(4, 12); cloud(50, 30);
      for (const [bx, bw, bh, c] of [[0, 10, 14, '#7f86ad'], [11, 9, 20, '#6a7090'], [21, 12, 10, '#8a90b4'], [34, 8, 18, '#6a7090'], [43, 12, 12, '#7f86ad'], [56, 9, 22, '#6a7090'], [66, 8, 15, '#8a90b4']]) {
        R(bx, ART_H - bh, bw, bh, c); for (let y = ART_H - bh + 3; y < ART_H - 2; y += 4) for (let x = bx + 2; x < bx + bw - 2; x += 3) R(x, y, 1, 2, '#ffe873');
      }
      heliAt(18, 8 + Math.round(Math.sin(T * 2) * 2));
    },
    stickers: () => {
      R(0, 0, ART_W, ART_H, '#c98a4b'); R(3, 3, ART_W - 6, ART_H - 6, '#fff2d8');
      const star = (cx, cy, c) => { for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; for (let d = 0; d < 7; d++) R(cx + Math.cos(a) * d - 1, cy + Math.sin(a) * d - 1, 3, 3, c); } circle(cx, cy, 3, c); };
      star(16, 17, '#ffd21f');
      const hx = 54, hy = 15; circle(hx - 4, hy - 2, 5, '#ff6fb4'); circle(hx + 4, hy - 2, 5, '#ff6fb4'); for (let k = 0; k < 9; k++) R(hx - 9 + k, hy + k - 1, 19 - 2 * k, 1, '#ff6fb4');
      circle(35, 13, 6, '#e8222b'); R(34, 19, 2, 2, '#a3121d'); R(35, 21, 1, 9, '#5a3a22'); R(33, 10, 2, 2, '#ff8a8a');
      drawDuck(20, 44, true, 1); drawDuck(28, 44, false, 1);
      R(44, 30, 20, 12, '#e8222b'); R(46, 32, 6, 4, GLASS); circle(48, 43, 3, INK); circle(60, 43, 3, INK); R(56, 28, 4, 2, '#ffd21f');
    },
    movies: () => {
      R(0, 0, ART_W, ART_H, '#2a1420'); R(0, 0, 8, ART_H, '#9c1420'); R(ART_W - 8, 0, 8, ART_H, '#9c1420');
      R(9, 3, 54, 34, '#ffffff'); R(10, 4, 52, 32, '#8fd6ff'); R(10, 28, 52, 8, '#4b4f5c');
      g.save(); g.beginPath(); g.rect(10, 4, 52, 32); g.clip(); drawV(VI.amb, 5, 35, false, 0, T * 3, true); g.restore();
      const px = 52, py = 48; for (let k = 0; k < 4; k++) R(px + k * 3, py - 9, 2, 9, k % 2 ? '#ffffff' : '#e8222b');
      circle(px + 2, py - 11, 3, '#fff6c8'); circle(px + 6, py - 12, 3, '#fff3a6'); circle(px + 10, py - 11, 3, '#fff6c8');
      for (let x = 12; x < 44; x += 8) { R(x, 41, 7, 9, '#4a1a2a'); R(x, 40, 7, 2, '#6a2a3a'); }
    },
    drive: () => {
      sky(); R(0, 30, ART_W, 20, '#6cbf5a');
      for (let y = 30; y < ART_H; y++) { const hw = 4 + (y - 30) * 1.7; R(36 - hw, y, hw * 2, 1, '#4b4f5c'); }
      for (let y = 32; y < ART_H; y += 6) R(35, y, 2, 3, '#ffd21f');
      R(8, 12, 2, 30, '#3a3d46'); R(5, 4, 8, 18, '#2f3240'); circle(9, 8, 2, '#e8222b'); circle(9, 13, 2, '#5a4a1a'); circle(9, 18, 2, Math.floor(T * 1.5) % 2 ? '#3fe24a' : '#2a6a2a');
      drawCar(20, 48, COLOR.blue.c, T * 4, 0);
    },
    wake: () => { sky('#ffd27a', '#ffe9b0'); grass(38); circle(36, 22, 12, '#ffd21f'); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + T * 0.5; R(36 + Math.cos(a) * 17 - 1, 22 + Math.sin(a) * 17 - 1, 3, 3, '#ff9a3a'); } },
    bed: () => {
      R(0, 0, ART_W, ART_H, '#1c2350'); R(0, 30, ART_W, 20, '#252c5e');
      for (const [x, y] of [[6, 6], [18, 14], [30, 4], [62, 30], [8, 26], [44, 8]]) if ((x + Math.floor(T * 2)) % 3) R(x, y, 1, 1, '#ffffff');
      drawMoon(52, 18);
      text('Z', 14, 30 - (Math.floor(T * 2) % 2), 2, '#ffffff'); text('Z', 24, 22 - (Math.floor(T * 2 + 1) % 2), 1, '#c6cdf0');
      R(4, 42, 64, 8, '#3a3f78'); R(4, 40, 22, 4, '#ffffff'); R(26, 39, 42, 6, '#6a5acd'); R(26, 39, 42, 1, '#8a7aed');
    },
  };
  function drawArt(k, cx, cy, maxW, maxH) {
    if (!artCv) { artCv = document.createElement('canvas'); artCv.width = ART_W; artCv.height = ART_H; }
    const ag = artCv.getContext('2d'), prev = g;
    ag.clearRect(0, 0, ART_W, ART_H); g = ag;
    try { (ART[k] || (() => ICONS[k](36, 25, 16)))(); } finally { g = prev; }
    const z = Math.max(1, Math.floor(Math.min(maxW / ART_W, maxH / ART_H)));
    const sw = Math.min(ART_W, Math.floor(maxW / z)), sh = Math.min(ART_H, Math.floor(maxH / z));   // crop when the tile is narrow
    g.imageSmoothingEnabled = false;
    g.drawImage(artCv, Math.floor((ART_W - sw) / 2), ART_H - sh, sw, sh, Math.round(cx - sw * z / 2), Math.round(cy - sh * z / 2), sw * z, sh * z);
  }
  function pickerTiles() {
    const kinds = btns.filter(btnShown).map(b => b.k), n = kinds.length;
    const x0 = L.safeL + 10, x1 = W - L.safeR - 10, y0 = Math.max(menu.y + menu.r + 12, L.safeT + 12), y1 = H - L.safeB - 10;
    const aw = x1 - x0, ah = y1 - y0, gap = 8;
    let best = null;
    for (let cols = 1; cols <= n; cols++) {   // the column count that gives the biggest tiles
      const rows = Math.ceil(n / cols);
      const w = Math.floor(Math.min((aw - (cols - 1) * gap) / cols, ((ah - (rows - 1) * gap) / rows) / 1.05));
      if (!best || w > best.w) best = { cols, rows, w };
    }
    const { cols, rows, w } = best, h = Math.round(w * 1.05);
    const gx = x0 + Math.round((aw - (cols * w + (cols - 1) * gap)) / 2), gy = y0 + Math.round((ah - (rows * h + (rows - 1) * gap)) / 2);
    return kinds.map((k, i) => {
      const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), col = i % cols;
      const rx = gx + Math.round((cols - inRow) * (w + gap) / 2);   // center a short last row
      return { k, i, x: rx + col * (w + gap), y: gy + row * (h + gap), w, h };
    });
  }
  function drawPicker() {
    const e = 1 - (1 - menu.k) ** 3;
    alpha(Math.min(1, menu.k * 1.6), () => {
      R(0, 0, W, H, '#3d8fd6');
      for (let y = 0; y < H; y += 16) R(0, y, W, 8, '#4597dc');
      for (let i = 0; i < 18; i++) {   // drifting stars and dots
        const x = (i * 97 + T * (6 + i % 4)) % (W + 10) - 5, y = (i * 61) % H;
        R(x, y, 2, 2, i % 3 ? '#8cc6f2' : '#fff3a6');
      }
    });
    const tiles = pickerTiles(), w0 = tiles.length ? tiles[0].w : 0;
    let ts = 3;   // one label size for every tile: the biggest that fits the longest name
    while (ts > 1 && tiles.some(t => textWidth(LABEL[t.k] || '', ts) > w0 - 10)) ts--;
    for (const t of tiles) {
      const k = Math.max(0, Math.min(1, e * 1.5 - t.i * 0.05));
      if (k <= 0) continue;
      const pop = 1 - (1 - k) ** 3, bob = Math.round(Math.sin(T * 2.2 + t.i) * 1.2);
      const x = t.x, y = t.y + Math.round((1 - pop) * 24) + bob, w = t.w, h = t.h;
      alpha(k, () => {
        R(x + 2, y + 4, w, h, 'rgba(0,0,0,0.22)');
        R(x + 2, y - 2, w - 4, h + 4, '#ffffff'); R(x - 2, y + 2, w + 4, h - 4, '#ffffff'); R(x, y, w, h, '#ffffff');
        R(x + 3, y + 3, w - 6, h - 6, TILE_BG[t.k] || '#eeeeee');
        const label = LABEL[t.k] || '';
        const lh = 5 * ts + 8, aw = w - 10, ah = h - lh - 8;
        const icy = y + 5 + Math.round(ah / 2);   // the picture card sits above its label
        drawArt(t.k === 'bed' && bed.on ? 'wake' : t.k, x + w / 2, icy, aw, ah);
        text(label, Math.round(x + (w - textWidth(label, ts)) / 2), y + h - lh + 2, ts, '#2a2a3a');
      });
    }
  }
  function drawButtons() {
    if (pendingMission) menu.open = false;
    if (menu.k > 0.02 && !bed.on && !pendingMission) drawPicker();
    drawMenuButton();
  }
  function drawSun0(x, y) { circle(x, y, 7, '#ff9a3a'); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; R(x + Math.cos(a) * 10 - 1, y + Math.sin(a) * 10 - 1, 2, 2, '#ff9a3a'); } }

  /* ---------- scene ---------- */
  SCENES.station = {
    view: (w, h) => w > h ? [300, 400] : [300, 250],   // sideways, zoom out a little so all three floors fit
    menu,   // read by the automated tests
    modal: () => menu.open && !bed.on,
    _tiles: () => pickerTiles(),
    layout,
    groundY: () => L.hillY,
    enter(arg) {
      pendingMission = null;
      setClouds(L.safeT + 46, B.top - 50);
      if (arg && arg.returning != null) {
        const v = V[arg.returning];
        if (v.stopSiren) v.stopSiren();
        Object.assign(v, { state: 'drive', lap: true, mission: null, x: -v.len - 8, y: L.laneY, speed: 120, stopSiren: null });
      }
      for (const p of crew) if (p.state === 'gone') p.t = Math.min(p.t, rand(0.5, 3));
    },
    leave() { stationMusic(false); },
    update,
    tap,
    drawWorld() {
      drawHeli();
      drawHills(L.hillY, L.floorY);
      drawTrees();
      drawBuilding();
      YARD.drawBack(bed.on);
      if (bed.asleep) for (const f of B.floors) { drawRoom(f, false); drawCrew(f.i); stationPets(f); alpha(0.35, () => R(f.x0, f.top, f.x1 - f.x0, f.fy - f.top + 2, '#0b1030')); }
      drawRoad();
      drawProps();
      V.forEach((v, i) => { if (v.state === 'parked') drawVehicle(v, i); });
      drawDoors();
      YARD.drawFront(bed.on);
      drawSnowCaps();
      V.forEach((v, i) => { if (v.state !== 'parked') drawVehicle(v, i); });
    },
    drawLit() {
      const k = nightK();
      if (k > 0.02) drawBuildingLights(k);
      if (!bed.asleep) for (const f of B.floors) { drawRoom(f, true); drawCrew(f.i); stationPets(f); }
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
