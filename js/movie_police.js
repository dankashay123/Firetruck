// Cinema: "Police Car Finds the Puppy", a ~34 s watch-only cartoon.
// Every shot is drawn into a small offscreen "set" and blown up 1-4x with crisp pixels, so close-ups
// get big chunky pixels and wide shots show the whole street. Everything is a pure function of the
// episode clock, so a frame can be drawn for any time t.
'use strict';
(() => {
  /* ---------- the edit ---------- */
  // need = the smallest set (in pixels) the shot must show; the zoom is the biggest that still fits it.
  const SHOTS = [
    { id: 'patrol', t0: 0,    need: [160, 100], tin: 'iris', wide: true },   // wide: cruising through town
    { id: 'face',   t0: 3.2,  need: [64, 60],   tin: 'cut' },    // close-up: officer waves, badge shines
    { id: 'sad',    t0: 5.2,  need: [70, 66],   tin: 'cut' },    // close-up: sad kid, tear, puppy bubble
    { id: 'stop',   t0: 7.6,  need: [100, 96],  tin: 'cut' },    // medium: car stops, officer listens
    { id: 'wheel',  t0: 11.0, need: [70, 60],   tin: 'cut' },    // inside: hands on the wheel, lights button
    { id: 'bar',    t0: 12.4, need: [64, 48],   tin: 'cut' },    // extreme close-up: flashing light bar
    { id: 'headon', t0: 14.0, need: [100, 96],  tin: 'cut' },    // head-on: car races at the camera
    { id: 'map',    t0: 16.2, need: [100, 96],  tin: 'wipe' },   // bird's-eye: searching town and park
    { id: 'ots',    t0: 19.0, need: [100, 96],  tin: 'cut' },    // over the shoulder: a tail in a bush!
    { id: 'tail',   t0: 20.8, need: [60, 56],   tin: 'cut' },    // close-up: tail... it's a duck!
    { id: 'puppy',  t0: 22.4, need: [100, 96],  tin: 'cut' },    // park: puppy chases a butterfly, jumps
    { id: 'hug',    t0: 25.4, need: [100, 96],  tin: 'iris' },   // push-in: reunion hug
    { id: 'bye',    t0: 28.2, need: [160, 100], tin: 'cut', wide: true },    // wide: ducks cross, drive off at sunset
    { id: 'end',    t0: 31.6, need: [100, 96],  tin: 'iris' },   // badge + heart + confetti
  ];
  const END = 33.6;
  SHOTS.forEach((s, i) => { s.t1 = i + 1 < SHOTS.length ? SHOTS[i + 1].t0 : END; s.next = SHOTS[i + 1]; });

  // Narration a parent can record: audio/movie-police-01.mp3 ... -10.mp3 (missing files are skipped;
  // a few fall back to the game's own voice clips).
  const NARRATION = [
    [0.3,  '01', 'The police car is on patrol!', () => say('police-car-on-duty')],
    [5.4,  '02', 'Oh no, the puppy is lost!'],
    [8.6,  '03', 'The officer will help!', () => say(pick('police'))],
    [11.1, '04', "Let's find the puppy!", () => say('lets-go')],
    [16.4, '05', 'Where is the puppy?'],
    [19.1, '06', 'Is it in the bush?'],
    [21.4, '07', "It's a duck! Quack!"],
    [23.1, '08', "There's the puppy!"],
    [25.7, '09', 'Hooray! Puppy is home!', () => say(pick('praise'))],
    [29.4, '10', 'Bye bye, police car!'],
  ];

  const st = { on: false, t: 0, ci: 0, done: false, stopSiren: null, vd: [], wins: [], lamps: [], view: null, tune: { i: 0, at: 0 } };
  const offA = document.createElement('canvas'), gA = offA.getContext('2d');
  const offB = document.createElement('canvas'), gB = offB.getContext('2d');
  let VW = 100, VH = 100;   // size of the set being drawn

  /* ---------- small helpers ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const k01 = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = k => 1 - (1 - k) * (1 - k);
  const backOut = k => { const c = 1.9; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function rng(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function line(x0, y0, x1, y1, c, w = 1) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) R(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w, c);
  }
  function star(cx, cy, r, c) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      const xs = [];
      for (let i = 0, j = 9; i < 10; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y + 0.5) !== (yj > y + 0.5)) xs.push((xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi);
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) { const a = Math.round(xs[i]), b = Math.round(xs[i + 1]); if (b > a) R(a, y, b - a, 1, c); }
    }
  }
  function ring(cx, cy, r1, r0, c) {   // pixel ring between radius r0 and r1
    for (let dy = -r1; dy <= r1; dy++) {
      const o = Math.floor(Math.sqrt((r1 + 0.5) ** 2 - dy * dy)), i = Math.abs(dy) <= r0 ? Math.floor(Math.sqrt((r0 + 0.5) ** 2 - dy * dy)) : -1;
      if (i < 0) R(cx - o, cy + dy, o * 2 + 1, 1, c);
      else { R(cx - o, cy + dy, o - i, 1, c); R(cx + i + 1, cy + dy, o - i, 1, c); }
    }
  }
  const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  function heart(cx, cy, s, c) {
    const x0 = Math.round(cx - 3.5 * s), y0 = Math.round(cy - 3 * s);
    HEART.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === '1') R(x0 + i * s, y0 + j * s, s, s, c); });
    R(x0 + s, y0 + s, s, s, '#ffc2d6');
  }
  // A little fountain of hearts that started `el` seconds ago.
  function hearts(cx, cy, el, n = 5, s = 1) {
    for (let i = 0; i < n; i++) {
      const p = el - i * 0.14;
      if (p < 0 || p > 1.5) continue;
      alpha(Math.min(1, (1.5 - p) * 2), () => heart(cx + Math.sin(i * 2.4) * 11 * s + Math.sin(p * 6 + i) * 2, cy - p * 22 * s, s, i % 2 ? '#ff4f8a' : '#e8222b'));
    }
  }
  const QMARK = '111001010000010';
  function qmark(x, y, s, c) { for (let b = 0; b < 15; b++) if (QMARK[b] === '1') R(x + (b % 3) * s, y + Math.floor(b / 3) * s, s, s, c); }
  function bang(x, y, s, c) { text('!', x, y, s, c); }
  const PC = () => COLOR[V[VI.police].color].c;   // the police car's painted color ramp
  const COPC = OUTFITS.cop;

  /* ---------- sound ---------- */
  const narrBytes = {}, narrBuf = {};
  let narrSrc = null, narrTok = 0, narrEnd = 0;
  const narrSrcs = [];
  function loadNarr(n) {
    return narrBytes[n] || (narrBytes[n] = fetch('audio/movie-police-' + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null));
  }
  function decodeNarr(n) {
    if (!ac) return Promise.resolve(null);
    return narrBuf[n] || (narrBuf[n] = loadNarr(n).then(b => b && new Promise(res => {
      try { ac.decodeAudioData(b.slice(0), res, () => res(null)); } catch (e) { res(null); }
    })));
  }
  function stopNarr() { for (const s of narrSrcs.splice(0)) { try { s.stop(); } catch (e) {} } narrSrc = null; narrEnd = 0; }
  function narrate(n, fallback) {
    const run = ++narrTok;
    decodeNarr(n).then(buf => {
      if (!st.on || run < narrTok - 3) return;
      if (!buf) { if (fallback) fallback(); return; }
      // a line that's still playing finishes first; this one follows right after it
      const when = Math.max(ac.currentTime, narrEnd + 0.12);
      const s = ac.createBufferSource();
      s.buffer = buf; s.connect(voiceOut); s.start(when);
      narrEnd = when + buf.duration; narrSrc = s; narrSrcs.push(s);
      duck(narrEnd - ac.currentTime);
      s.onended = () => { const i = narrSrcs.indexOf(s); if (i >= 0) narrSrcs.splice(i, 1); if (narrSrc === s) narrSrc = null; };
    });
  }
  const sirenOn = () => { if (!st.stopSiren) st.stopSiren = siren('police'); };
  const sirenOff = () => { if (st.stopSiren) st.stopSiren(); st.stopSiren = null; };
  const whistle = () => { for (let i = 0; i < 6; i++) tone('sine', i % 2 ? 2300 : 2000, i * 0.06, 0.07, 0.06); };
  const rustle = () => noise(0, 0.25, 0.14, 1700, 0.8);
  const lick = () => { tone('sine', 900, 0, 0.08, 0.08, 1400); tone('sine', 900, 0.14, 0.08, 0.08, 1400); };
  const click = () => { tone('square', 1200, 0, 0.03, 0.08); tone('sine', 600, 0.05, 0.12, 0.12, 900); };
  const sniff = () => { tone('sine', 520, 0, 0.18, 0.07, 440); tone('sine', 470, 0.3, 0.3, 0.07, 360); };

  // Background tune: a happy little loop on a music box and a soft bass, scheduled note by note.
  const MEL = [64, 67, 67, 69, 67, 64, 60, 0, 62, 64, 65, 64, 62, 60, 62, 0, 64, 67, 67, 69, 72, 69, 67, 0, 65, 64, 62, 64, 60, 0, 60, 0];
  const BASS = [48, 55, 53, 55, 48, 55, 43, 55, 48, 55, 53, 57, 53, 55, 48, 48];
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  function tune() {
    if (!ac || st.t >= END - 0.4) return;
    const now = ac.currentTime, tu = st.tune, step = 0.25;
    if (tu.at < now) tu.at = now + 0.05;
    const soft = st.stopSiren ? 0.55 : 1;
    while (tu.at < now + 0.15) {
      const m = MEL[tu.i % MEL.length], start = tu.at - now;
      if (m) { tone('triangle', hz(m), start, 0.22, 0.04 * soft); tone('sine', hz(m + 12), start, 0.12, 0.012 * soft); }
      if (tu.i % 2 === 0) tone('sine', hz(BASS[(tu.i / 2) % BASS.length]), start, 0.42, 0.05 * soft);
      tu.i++; tu.at += step;
    }
  }

  // Cues on the episode clock.
  const CUES = [
    [1.7, () => SFX.honk()],
    [4.1, () => SFX.chime()],
    [6.5, sniff],
    [8.1, () => SFX.brake()],
    [8.9, () => SFX.boop(1.2)],
    [10.3, () => SFX.chime()],
    [11.55, click],
    [11.7, sirenOn],
    [15.7, () => SFX.whoosh()],
    [18.5, () => { sirenOff(); SFX.brake(); }],
    [19.3, rustle], [19.8, rustle], [20.3, rustle], [21.0, rustle],
    [21.3, () => { SFX.quack(); SFX.pop(); }],
    [21.65, () => SFX.peep()], [21.85, () => SFX.peep()], [22.05, () => SFX.peep()],
    [23.0, () => SFX.peep()],
    [23.9, () => SFX.woof()],
    [24.25, () => SFX.boop(1.4)],
    [24.65, () => { SFX.woof(); SFX.chime(); }],
    [25.95, () => SFX.boop(1.5)],
    [26.2, () => { SFX.woof(); }],
    [26.5, () => SFX.fanfare()],
    [26.9, lick], [27.4, lick],
    [28.4, whistle],
    [28.7, () => SFX.peep()], [29.0, () => SFX.peep()], [29.3, () => SFX.peep()],
    [30.2, () => SFX.quack()],
    [30.5, () => SFX.honk()],
    [31.7, () => SFX.chime()],
    [32.3, () => SFX.sunrise()],
    ...NARRATION.map(([t, n, , fb]) => [t, () => narrate(n, fb)]),
  ].sort((a, b) => a[0] - b[0]);

  /* ---------- the world (side-view street) ---------- */
  const FARC = ['#a9bfe0', '#b9c6e6', '#c2b6e0', '#a7cfe0', '#bcd6ea'];
  const HOUSEC = ['#f6d6a8', '#cfe3f7', '#f7c6c6', '#d8f0c8', '#fff0b3', '#e6d4f7'], ROOFC = ['#c0504d', '#5a6fb0', '#8a4f9a', '#b06a3a', '#3f8a6a'];
  const FAR = [], TOWN = [];
  {
    const r = rng(4242);
    for (let x = -160; x < 1500;) { const w = 16 + Math.floor(r() * 20); FAR.push({ x, w, hf: 0.35 + r() * 0.65, c: FARC[Math.floor(r() * FARC.length)], ant: r() < 0.3 }); x += w + Math.floor(r() * 5) - 1; }
    let x = -220, k = 0;
    while (x < 1200) {
      if (k++ % 3 !== 2) {
        const w = 34 + Math.floor(r() * 10);
        TOWN.push({ kind: 'house', x, w, hf: 0.72 + r() * 0.28, rh: 9 + Math.floor(r() * 4), c: HOUSEC[Math.floor(r() * HOUSEC.length)], roof: ROOFC[Math.floor(r() * ROOFC.length)], seed: r() });
        x += w + 5;
      } else {
        const tr = 8 + Math.floor(r() * 4);
        TOWN.push({ kind: 'tree', x: x + tr, r: tr });
        x += tr * 2 + 5;
      }
    }
  }
  const KX = 334;            // where the kid lives
  const CW = 520;            // crosswalk (world x)
  function geo() {
    const laneY = Math.round(VH - clamp(VH * 0.2, 16, 64));
    const rTop = laneY - 24, swTop = rTop - 10;
    return { laneY, rTop, swTop, feet: rTop - 3, rBot: laneY + 4, front: laneY + 14 };
  }
  function street(camX, o = {}) {
    const G = geo(), { swTop, rTop, rBot } = G;
    // far skyline (half speed)
    const farMax = clamp(swTop - 26, 14, 150);
    for (const b of FAR) {
      const x = Math.round(b.x - camX * 0.5);
      if (x > VW || x + b.w < 0) continue;
      const h = Math.round(farMax * b.hf), y = swTop - 3 - h;
      R(x, y, b.w, h + 3, b.c); R(x, y, b.w, 1, mix(b.c, '#ffffff', 0.4)); R(x + b.w - 2, y, 2, h + 3, mix(b.c, '#000000', 0.1));
      if (b.ant) { R(x + (b.w >> 1), y - 6, 1, 6, '#6b7480'); R(x + (b.w >> 1), y - 7, 1, 1, '#e8222b'); }
      for (let wy = y + 4; wy < swTop - 8; wy += 8) for (let wx = x + 3; wx < x + b.w - 4; wx += 6) { R(wx, wy, 3, 4, '#e9f1fb'); st.wins.push([wx, wy, 3, 4]); }
    }
    R(0, swTop - 6, VW, 6, '#6cbf5a');
    // houses and trees right behind the sidewalk
    const hMax = clamp(Math.round(swTop * 0.42), 24, 64);
    for (const t of TOWN) {
      if (t.kind === 'tree') { const x = Math.round(t.x - camX); if (x > -20 && x < VW + 20) drawTree(x, swTop, t.r); continue; }
      const x = Math.round(t.x - camX);
      if (x > VW + 20 || x + t.w < -20) continue;
      drawHouse(x, swTop, t.w, Math.round(hMax * t.hf), t);
    }
    // back sidewalk with lamps
    R(0, swTop, VW, rTop - swTop, '#d9d3c4'); R(0, swTop, VW, 1, '#ece7da');
    for (let wx = Math.floor(camX / 16) * 16; wx < camX + VW; wx += 16) R(Math.round(wx - camX), swTop + 1, 1, rTop - swTop - 1, '#c4bdac');
    for (let lx = Math.floor(camX / 130) * 130 + 60; lx < camX + VW + 10; lx += 130) {
      const x = Math.round(lx - camX);
      R(x - 1, swTop - 34, 2, 40, '#4d5560'); R(x - 2, swTop + 4, 4, 2, '#3a3f48');
      R(x - 1, swTop - 36, 7, 2, '#4d5560'); R(x + 2, swTop - 35, 5, 3, '#3a3f48'); R(x + 3, swTop - 32, 3, 1, '#fff6b0');
      st.lamps.push([x + 4, swTop - 32]);
    }
    // road
    R(0, rTop, VW, rBot - rTop, '#4b4f5c'); R(0, rTop, VW, 2, '#bdb8ac'); R(0, rTop + 2, VW, 1, '#8f8b80');
    for (let dx = Math.floor(camX / 20) * 20; dx < camX + VW; dx += 20) R(Math.round(dx - camX), rTop + 7, 10, 1, '#d9d3c4');
    const cwx = Math.round(CW - camX);
    if (cwx > -30 && cwx < VW) {
      for (let y = rTop + 3; y < rBot - 1; y += 4) R(cwx, y, 26, 2, '#f4f7fb');
      R(cwx - 5, rTop + 3, 2, rBot - rTop - 4, '#f4f7fb');
    }
    R(0, rBot, VW, 2, '#bdb8ac');
    // front grass, flowers, and (when there's room) big tulips right in front of the camera
    R(0, rBot + 2, VW, VH - rBot - 2, '#6cbf5a'); R(0, rBot + 2, VW, 1, '#5aa84c');
    const fh = VH - rBot - 6;
    for (let fx = Math.floor(camX / 7) * 7; fx < camX + VW; fx += 7) {
      const h = hash(fx), x = Math.round(fx - camX + h * 5), y = rBot + 5 + Math.floor(hash(fx + 0.5) * Math.max(1, fh - 3));
      if (h < 0.55) { R(x, y, 2, 2, ['#ff6fb4', '#ffd21f', '#ffffff', '#ff7a6b', '#c39bff'][Math.floor(h * 9) % 5]); R(x, y + 2, 1, 2, '#3f9a45'); }
      else R(x, y, 1, 2, '#5aa84c');
    }
    if (fh > 30) {
      const base = VH, fc = camX * 1.25;
      for (let tx = Math.floor(fc / 23) * 23; tx < fc + VW + 10; tx += 23) {
        const x = Math.round(tx - fc), h = 10 + Math.floor(hash(tx + 3) * 12), c = ['#e8222b', '#ff6fb4', '#ffd21f', '#8a4fd9'][Math.floor(hash(tx + 7) * 4)];
        R(x, base - h, 2, h, '#2f8a3a'); R(x - 3, base - h - 6, 8, 6, c); R(x - 3, base - h - 8, 2, 2, c); R(x + 3, base - h - 8, 2, 2, c); R(x, base - h - 7, 2, 1, c);
        R(x + 2, base - h + 4, 3, 2, '#3fb43a');
      }
    }
    if (o.sunset) sunsetWash(o.sunset);
    return G;
  }
  function drawHouse(x, base, w, h, t) {
    const cx = x + w / 2, y = base - h;
    R(x + w - 10, y - t.rh - 2, 5, 9, '#9a5a3a');
    for (let i = 0; i < t.rh; i++) {
      const hw = Math.round((w / 2 + 3) * (i + 1) / t.rh);
      R(cx - hw, y - t.rh + i, hw * 2, 1, i === t.rh - 1 ? mix(t.roof, '#000000', 0.25) : t.roof);
    }
    R(x, y, w, h, t.c); R(x, y, 1, h, mix(t.c, '#000000', 0.12));
    const floors = Math.max(1, Math.floor((h - 14) / 13));
    for (let f = 0; f < floors; f++) for (const wx of [x + 4, x + w - 12]) {
      const wy = y + 4 + f * 13;
      R(wx - 1, wy - 1, 10, 9, '#ffffff'); R(wx, wy, 8, 7, GLASS); R(wx + 4, wy, 1, 7, '#ffffff');
      st.wins.push([wx, wy, 8, 7]);
    }
    R(cx - 4, base - 13, 8, 13, '#8a5a3a'); R(cx - 4, base - 13, 8, 1, '#6b4228'); R(cx + 2, base - 7, 1, 1, '#ffd21f');
    R(cx - 6, base - 1, 12, 1, mix(t.c, '#000000', 0.25));
  }
  function sunsetWash(s) {   // warm the whole set (only drawn pixels)
    const ga = g.globalCompositeOperation;
    g.globalCompositeOperation = 'source-atop';
    alpha(0.16 * s, () => R(0, 0, VW, VH, '#ff7a2a'));
    g.globalCompositeOperation = ga;
  }

  /* ---------- characters ---------- */
  function dv(x, yb, lit, bob = 0) {
    drawV(VI.police, x, yb, lit, bob, x / 5);
    st.vd.push({ i: VI.police, x: Math.floor(x), yb: Math.floor(yb), lit, bob });
  }
  // Officer's head and waving hand in the police car's front window (side view).
  function driver(x, yb, wave) {
    x = Math.floor(x); yb = Math.floor(yb);
    R(x + 31, yb - 20, 4, 4, SKIN[0]); R(x + 30, yb - 22, 6, 2, COPC.hatC); R(x + 35, yb - 21, 2, 1, COPC.hatC);
    R(x + 34, yb - 19, 1, 1, INK); R(x + 31, yb - 16, 4, 1, COPC.shirt);
    if (wave) { const up = Math.floor(T * 6) % 2; R(x + 37, yb - 21 - up, 2, 3, SKIN[0]); }
  }
  function copCar(x, yb, lit, wave, bob = 0) { dv(x, yb, lit, bob); driver(x, yb + bob, wave); }
  // Kneeling officer: body lowered, legs folded under.
  function kneelCop(x, yb, dir, nod, pose = 'stand') {
    g.save(); g.beginPath(); g.rect(0, 0, VW, yb - 4); g.clip();
    drawPerson({ type: 'cop', x, yb: yb + 3 + nod, dir, pose, seed: 1 });
    g.restore();
    const P = (dx, dy, w, h, c) => R(dir > 0 ? x + dx : x - dx - w, yb + dy, w, h, c);
    P(-4, -4, 9, 3, COPC.pants); P(-7, -2, 4, 2, INK);
  }
  function sadFace(x, yb, dir, tear) {   // frown (and a tear) on a standing kid
    const bx = Math.floor(x) - 6, top = Math.floor(yb) - 19;
    const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 12 - dx - w, top + dy, w, h, c);
    M(6, 7, 3, 1, SKIN[1]); M(6, 8, 1, 1, '#a3121d'); M(7, 7, 1, 1, '#a3121d'); M(8, 8, 1, 1, '#a3121d');
    if (tear >= 0) M(6, 5 + Math.floor(tear * 4), 1, 2, '#6fd0ff');
  }
  function happyKid(x, yb, dir, pose, hop) { drawPerson({ type: 'kid', x, yb, dir, pose, skin: SKIN[1], hair: '#3a2416', seed: 4, hop }); }
  // Puppy, 17x11, facing dir. pose: stand | run | jump | held | sit
  function puppy(x, yb, dir = 1, pose = 'stand', happy = false) {
    const bx = Math.floor(x) - 8, top = Math.floor(yb) - 11;
    const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 17 - dx - w, top + dy, w, h, c);
    const tan = '#d9a066', dk = '#8a5a32', lt = '#fff3e0';
    const wag = Math.floor(T * 14) % 2, step = Math.floor(T * 10) % 2;
    M(1, 1 + wag, 2, 3, tan); M(0, wag, 2, 1, lt);
    M(3, 4, 9, 4, tan); M(4, 3, 7, 1, tan); M(4, 7, 7, 1, lt); M(5, 4, 3, 2, '#c58a52');
    if (pose === 'run') { M(3, 8, 2, 3 - step, dk); M(5, 8, 2, 2 + step, tan); M(9, 8, 2, 2 + step, tan); M(11, 8, 2, 3 - step, dk); }
    else if (pose === 'jump') { M(2, 7, 3, 2, tan); M(11, 7, 3, 2, tan); }
    else if (pose === 'held') { M(4, 8, 2, 2, tan); M(10, 8, 2, 2, tan); }
    else { M(3, 8, 2, 3, tan); M(5, 8, 2, 3, dk); M(9, 8, 2, 3, dk); M(11, 8, 2, 3, tan); }
    M(10, 0, 6, 5, tan); M(11, -1, 4, 1, tan); M(14, 2, 3, 3, lt); M(16, 2, 1, 1, INK);
    M(13, 1, 1, 1, INK); M(10, 0, 2, 5, dk); M(9, 1, 1, 3, dk);
    M(10, 5, 3, 1, '#e8222b'); M(11, 6, 1, 1, '#ffd21f');
    if (happy) M(15, 5, 1, 2, '#ff6fb4');
  }
  function drawDuckBig(x, yb, big, step = 0, dir = 1) {
    x = Math.floor(x); yb = Math.floor(yb);
    const F = (bx, w) => (dx, dy, ww, hh, c) => R(dir > 0 ? bx + dx : bx + w - dx - ww, dy, ww, hh, c);
    if (big) {
      const M = F(x - 8, 18), t = yb - 15, Wh = '#f4f7fb', Sh = '#cfd8e2', O = '#f57a12';
      M(0, t + 6, 3, 3, Wh); M(1, t + 7, 12, 5, Wh); M(0, t + 8, 14, 3, Wh);
      M(3, t + 8, 6, 3, Sh); M(2, t + 11, 10, 1, Sh);
      M(10, t + 1, 5, 8, Wh); M(11, t, 3, 1, Wh);
      M(12, t + 2, 1, 2, INK); M(15, t + 3, 3, 2, O); M(15, t + 5, 2, 1, '#b14c06');
      M(5 + step, t + 12, 3, 3, O); M(9 - step, t + 12, 3, 3, O);
    } else {
      const M = F(x - 5, 11), t = yb - 9, Y = '#ffd21f', O = '#f57a12';
      M(0, t + 4, 7, 4, Y); M(1, t + 3, 5, 1, Y); M(5, t, 4, 5, Y);
      M(1, t + 4, 3, 2, '#e0b010'); M(7, t + 1, 1, 1, INK); M(9, t + 2, 2, 1, O);
      M(2 + step, t + 8, 2, 1, O); M(5 - step, t + 8, 2, 1, O);
    }
  }
  function butterfly(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    const f = Math.floor(T * 12) % 2;
    R(x, y - 1, 1, 4, INK);
    if (f) { R(x - 3, y - 2, 3, 3, '#ff6fb4'); R(x + 1, y - 2, 3, 3, '#ff6fb4'); R(x - 2, y + 1, 2, 2, '#ffd21f'); R(x + 1, y + 1, 2, 2, '#ffd21f'); }
    else { R(x - 1, y - 3, 1, 4, '#ff6fb4'); R(x + 1, y - 3, 1, 4, '#ff6fb4'); }
  }
  // Rounded speech/thought bubble, x/y = top-left.
  function bubble(x, y, w, h, tailX, tailDir = 1) {
    R(x + 1, y, w - 2, h, '#ffffff'); R(x, y + 1, w, h - 2, '#ffffff');
    R(tailX, y + h, 2, 2, '#ffffff'); R(tailX + tailDir * 2, y + h + 2, 1, 1, '#ffffff');
  }
  function puppyIcon(cx, cy) {   // tiny puppy face for the kid's bubble
    R(cx - 3, cy - 2, 6, 5, '#d9a066'); R(cx - 4, cy - 2, 2, 4, '#8a5a32'); R(cx + 2, cy - 2, 2, 4, '#8a5a32');
    R(cx - 2, cy, 1, 1, INK); R(cx + 1, cy, 1, 1, INK); R(cx - 1, cy + 1, 2, 2, '#fff3e0'); R(cx - 1, cy + 1, 2, 1, INK);
  }

  /* ---------- shots ---------- */
  const DRAW = {};
  const LIT = {};

  // 1. Wide: the police car cruises through town; neighbors wave.
  const WAVERS = [[50, 'mom', 1], [140, 'chef', 0], [215, 'gran', 0], [300, 'dad', 2], [390, 'kid2', 1], [470, 'mom', 3]];
  DRAW.patrol = lt => {
    const camX = -20 + 22 * lt;
    const G = street(camX);
    const carX = camX + lerp(-40, VW * 0.5 - 28, lt / 3.2);
    WAVERS.forEach(([wx, type, sk], i) => {
      const d = carX + 28 - wx, near = Math.abs(d) < 50;
      drawPerson({ type, x: wx - camX, yb: G.feet, dir: d < 0 ? -1 : 1, pose: near ? 'wave' : 'stand', skin: SKIN[sk], seed: i, hop: near ? Math.round(Math.abs(Math.sin(T * 6 + i)) * 2) : 0 });
    });
    copCar(carX - camX, G.laneY, false, true, Math.floor(lt * 5) % 2);
  };

  // 2. Close-up: the officer in the car window waves; badge shines.
  DRAW.face = lt => {
    const c = PC(), cx = Math.round(VW / 2), hy = Math.round(VH * 0.47);
    const wl = cx - 34, wr = cx + 34, wt = hy - 24, wb = hy + 19;
    // the street rushing past behind the window
    R(wl, wt, wr - wl, wb - wt, '#bfe6ff');
    for (let i = 0; i < 8; i++) {
      const bw = 14 + Math.floor(hash(i) * 10), x = Math.round(((i * 26 - lt * 70) % 208 + 208) % 208) + wl - 30;
      R(x, wt + 8 + Math.floor(hash(i + 9) * 10), bw, wb - wt, HOUSEC[i % HOUSEC.length]);
    }
    R(wl, wb - 8, wr - wl, 8, '#6cbf5a');
    // officer: shoulders, badge, head, cap, waving hand
    const skin = SKIN[0], o = COPC;
    R(cx - 17, hy + 9, 34, 14, o.shirt); R(cx - 17, hy + 9, 5, 14, o.shade); R(cx - 4, hy + 8, 8, 3, o.shade);
    R(cx - 2, hy + 9, 4, 2, skin);
    const sh = Math.floor(lt * 3) % 2;
    star(cx - 9, hy + 15, 4, '#a3741a'); star(cx - 9, hy + 14, 4, '#ffd21f'); if (sh) R(cx - 10, hy + 12, 1, 1, '#ffffff');
    R(cx + 6, hy + 13, 6, 1, '#1d1a2b');
    circle(cx - 12, hy, 3, skin); circle(cx + 12, hy, 3, skin);
    circle(cx, hy, 11, skin);
    R(cx - 11, hy - 8, 22, 4, '#5a3a22');
    R(cx - 12, hy - 15, 24, 7, o.hatC); R(cx - 10, hy - 18, 20, 3, o.hatC); R(cx - 9, hy - 17, 6, 1, '#3a4a8a');
    R(cx - 13, hy - 8, 26, 2, '#10183a'); star(cx, hy - 13, 3, '#ffd21f');
    const blink = (lt % 1.6) > 1.48;
    if (blink) { R(cx - 6, hy - 1, 3, 1, INK); R(cx + 3, hy - 1, 3, 1, INK); }
    else { R(cx - 6, hy - 2, 3, 3, INK); R(cx + 3, hy - 2, 3, 3, INK); R(cx - 6, hy - 2, 1, 1, '#ffffff'); R(cx + 3, hy - 2, 1, 1, '#ffffff'); }
    R(cx - 1, hy + 1, 2, 2, '#d99a7a');
    R(cx - 4, hy + 5, 8, 1, '#a3121d'); R(cx - 5, hy + 4, 1, 1, '#a3121d'); R(cx + 4, hy + 4, 1, 1, '#a3121d'); R(cx - 3, hy + 6, 6, 1, '#ff9c8a');
    R(cx - 9, hy + 2, 3, 2, '#ff9c8a'); R(cx + 6, hy + 2, 3, 2, '#ff9c8a');
    const sway = Math.round(Math.sin(T * 9) * 4);
    line(cx + 15, hy + 12, cx + 21 + sway, hy - 4, o.shirt, 4);
    circle(cx + 23 + sway, hy - 7, 4, skin); R(cx + 21 + sway, hy - 13, 2, 3, skin); R(cx + 24 + sway, hy - 13, 2, 3, skin);
    // car body around the window
    R(0, wt - 7, VW, 7, c[1]); R(0, wt - 7, VW, 1, c[0]); R(0, wt - 2, VW, 2, c[2]);
    R(0, wt, wl, wb - wt, c[1]); R(wr, wt, VW - wr, wb - wt, c[1]); R(wl - 2, wt, 2, wb - wt, c[2]); R(wr, wt, 2, wb - wt, c[2]);
    R(0, wb, VW, VH - wb, c[1]); R(0, wb, VW, 2, c[2]); R(0, wb + 2, VW, 1, c[0]);
    const panel = V[VI.police].color === 'white' ? '#2f3240' : '#f4f7fb';
    R(0, wb + 7, VW, Math.min(14, VH - wb - 7), panel);
    star(cx, wb + 14, 6, '#a3741a'); star(cx, wb + 13, 6, '#ffd21f');
    R(wr - 12, wb + 4, 8, 2, CHROME);
    if (VH - wb > 30) R(0, wb + 24, VW, VH - wb - 24, c[2]);
  };

  // 3. Close-up: a sad kid, a tear, and a bubble with the missing puppy.
  DRAW.sad = lt => {
    const wide = VW >= VH * 1.25;
    const cx = Math.round(wide ? VW * 0.36 : VW / 2), hy = Math.round(wide ? VH * 0.5 : VH * 0.6);
    // house wall behind
    R(0, 0, VW, VH, '#f7c6c6');
    for (let y = 3; y < VH; y += 6) R(0, y, VW, 1, '#ebb2b2');
    const wx = wide ? Math.round(VW * 0.72) : cx + 22, wy = hy - 34;
    R(wx - 11, wy - 1, 24, 20, '#ffffff'); R(wx - 10, wy, 22, 18, GLASS); R(wx, wy, 1, 18, '#ffffff'); R(wx - 10, wy + 8, 22, 1, '#ffffff');
    R(0, hy + 22, VW, VH - hy - 22, '#d9d3c4'); R(0, hy + 22, VW, 1, '#ece7da');
    // kid
    const sk = SKIN[1], hair = '#3a2416', bob = Math.floor(lt * 2.5) % 3 === 0 ? 1 : 0, y = hy + bob;
    R(cx - 15, y + 10, 30, VH - y - 10, '#ff6fb4'); R(cx - 15, y + 10, 5, VH - y - 10, '#e0559a'); R(cx - 4, y + 9, 8, 3, sk);
    circle(cx - 14, y - 2, 5, hair); circle(cx + 14, y - 2, 5, hair); R(cx - 17, y - 8, 4, 3, '#ff6fb4'); R(cx + 13, y - 8, 4, 3, '#ff6fb4');
    circle(cx, y, 11, sk);
    R(cx - 10, y - 11, 20, 5, hair); R(cx - 11, y - 8, 4, 6, hair); R(cx + 7, y - 8, 4, 6, hair); R(cx - 6, y - 7, 5, 2, hair);
    R(cx - 7, y - 4, 4, 1, hair); R(cx - 6, y - 5, 2, 1, hair); R(cx + 3, y - 4, 4, 1, hair); R(cx + 4, y - 5, 2, 1, hair);   // sad brows
    R(cx - 6, y - 1, 3, 3, INK); R(cx + 3, y - 1, 3, 3, INK); R(cx - 6, y - 1, 1, 1, '#ffffff'); R(cx + 3, y - 1, 1, 1, '#ffffff');
    R(cx - 3, y + 6, 6, 1, '#a3121d'); R(cx - 4, y + 7, 1, 1, '#a3121d'); R(cx + 3, y + 7, 1, 1, '#a3121d');   // frown
    R(cx - 9, y + 3, 3, 2, '#ff9c8a'); R(cx + 6, y + 3, 3, 2, '#ff9c8a');
    const tp = (lt % 1.3) / 1.3;   // a tear rolling down the cheek, again and again
    R(cx - 6, y + 2 + Math.floor(tp * 10), 2, 3, '#6fd0ff'); R(cx - 6, y + 2 + Math.floor(tp * 10), 1, 1, '#ffffff');
    // thought bubble: the puppy and a question mark
    const show = lt > 0.25, bw = 34, bh = 22;
    if (show) {
      const bx = wide ? cx + 18 : cx - bw / 2, by = wide ? y - 32 : y - 46 + Math.round(Math.sin(T * 3));
      circle(wide ? cx + 13 : cx + 4, wide ? y - 12 : y - 17, 2, '#ffffff'); circle(wide ? cx + 16 : cx + 2, wide ? y - 16 : y - 21, 3, '#ffffff');
      R(bx + 2, by, bw - 4, bh, '#ffffff'); R(bx, by + 2, bw, bh - 4, '#ffffff');
      const pcx = bx + 12, pcy = by + 11;
      R(pcx - 6, pcy - 5, 12, 10, '#d9a066'); R(pcx - 8, pcy - 5, 3, 9, '#8a5a32'); R(pcx + 5, pcy - 5, 3, 9, '#8a5a32');
      R(pcx - 3, pcy - 2, 2, 2, INK); R(pcx + 2, pcy - 2, 2, 2, INK); R(pcx - 2, pcy + 1, 5, 4, '#fff3e0'); R(pcx - 1, pcy + 1, 3, 2, INK);
      qmark(bx + 23, by + 5, 2, '#2a6fe0');
    }
  };

  // 4. Medium: the car pulls over, the officer hops out, kneels and listens.
  DRAW.stop = lt => {
    const camX = Math.round(300 - VW / 2), G = street(camX);
    const carX = lt < 0.9 ? lerp(186, 252, easeOut(lt / 0.9)) : 252;
    const lit = lt > 0.15;
    // the kid, sad at first, hopeful after the officer nods
    const kx = KX - camX, cheer = lt > 2.7;
    happyKid(kx, G.feet, -1, cheer ? 'wave' : 'stand', cheer ? Math.round(Math.abs(Math.sin((lt - 2.7) * 7)) * 3) : 0);
    if (!cheer) sadFace(kx, G.feet, -1, (lt % 1.2) / 1.2);
    if (lt > 0.2 && lt < 2.5) {
      const bx = kx - 10, by = G.feet - 37 + Math.round(Math.sin(T * 3));
      bubble(bx, by, 22, 13, kx - 2, 1); puppyIcon(bx + 7, by + 6); qmark(bx + 15, by + 4, 1, '#2a6fe0');
    }
    copCar(carX - camX, G.laneY, lit, false);
    if (lt < 1.2) driver(carX - camX, G.laneY, false);
    // officer
    let ox, oy, hop = 0, pose = 'stand';
    if (lt < 1.2) ox = null;
    else if (lt < 1.7) { const k = (lt - 1.2) / 0.5; ox = lerp(276, 318, k); oy = lerp(G.laneY - 2, G.feet, k); hop = Math.round(Math.sin(k * Math.PI) * 10); }
    else ox = 318, oy = G.feet;
    if (ox !== null) {
      if (lt > 1.8 && lt < 3.0) kneelCop(ox - camX, oy, 1, Math.floor(lt * 3) % 2);
      else { if (lt >= 3.0) pose = 'wave'; drawPerson({ type: 'cop', x: ox - camX, yb: oy, dir: 1, pose, hop, walk: lt < 1.7, seed: 1 }); }
      if (lt > 2.6) { const bx = ox - camX - 8, by = oy - (lt < 3.0 ? 34 : 38); bubble(bx, by, 12, 12, bx + 6, 1); heart(bx + 6, by + 6, 1, '#e8222b'); }
    }
  };
  LIT.stop = lt => { if (lt > 2.7) { const G = geo(); hearts(KX - Math.round(300 - VW / 2), G.feet - 22, lt - 2.7, 3); } };

  // 5. Inside the car: hands on the steering wheel, a finger presses the lights button.
  DRAW.wheel = lt => {
    const c = PC(), cx = Math.round(VW * 0.42), cy = Math.round(VH * 0.74), r = Math.round(Math.min(VW, VH) * 0.3);
    // windshield view: the road ahead
    const hz = Math.round(VH * 0.3);
    R(0, 0, VW, hz, '#bfe6ff'); R(0, hz, VW, Math.round(VH * 0.2), '#6cbf5a');
    for (let i = 0; i < 6; i++) R(Math.round(i * VW / 5 - 6), hz - 10 - (i % 3) * 4, 14, 10 + (i % 3) * 4, HOUSEC[i]);
    const rw = VW * 0.6;
    for (let y = hz; y < VH * 0.5; y++) { const k = (y - hz) / (VH * 0.5 - hz), hw = 3 + k * rw / 2; R(VW / 2 - hw, y, hw * 2, 1, '#4b4f5c'); }
    // dashboard
    const dy = Math.round(VH * 0.5);
    R(0, 0, VW, 4, c[2]); R(0, 0, 4, dy, c[2]); R(VW - 4, 0, 4, dy, c[2]);
    R(0, dy, VW, VH - dy, '#2f3240'); R(0, dy, VW, 2, '#5a5f6e'); R(0, dy + 2, VW, 1, '#1d1a2b');
    R(cx - 12, dy + 4, 9, 6, '#1d1a2b'); R(cx + 3, dy + 4, 9, 6, '#1d1a2b'); R(cx - 9, dy + 7, 4, 1, '#3fb43a'); R(cx + 6, dy + 6, 1, 3, '#ffd21f');
    // the big lights button
    const bx = Math.round(VW * 0.82), by = dy + 12, pressed = lt > 0.55, ph = Math.floor(T * 7) % 2;
    circle(bx, by + 1, 7, '#16171f'); circle(bx, by, 7, '#e9eef2'); circle(bx, by + (pressed ? 1 : 0), 5, pressed ? (ph ? RED_ON : BLUE_ON) : '#8c2a2a');
    R(bx - 3, by - 1 + (pressed ? 1 : 0), 3, 2, pressed ? '#ffffff' : '#bbbbbb'); R(bx, by - 1 + (pressed ? 1 : 0), 3, 2, pressed ? '#ffffff' : '#bbbbbb');
    // steering wheel with hands
    ring(cx, cy, r, r - 4, '#1d1a2b'); ring(cx, cy, r - 1, r - 2, '#3a3d46');
    R(cx - r + 3, cy - 2, r * 2 - 6, 4, '#2f3240'); R(cx - 2, cy, 4, r - 2, '#2f3240');
    circle(cx, cy, 6, '#3a3d46'); star(cx, cy, 4, '#ffd21f');
    const reach = k01(lt, 0.25, 0.55) * (1 - k01(lt, 0.85, 1.15));
    const hand = (x, y, sleeve) => { circle(x, y, 4, SKIN[0]); R(x - 4, y + 3, 8, 8, sleeve); R(x - 4, y + 3, 8, 2, COPC.shade); };
    hand(cx - r + 2, cy - 4, COPC.shirt);
    hand(Math.round(lerp(cx + r - 2, bx - 2, reach)), Math.round(lerp(cy - 4, by - 2, reach)), COPC.shirt);
    if (pressed) {   // red/blue light washing over everything
      alpha(0.12, () => R(0, 0, VW, VH, ph ? RED_ON : BLUE_ON));
      if (lt < 0.9) for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; R(bx + Math.cos(a) * 10, by + Math.sin(a) * 10, 2, 2, '#fff27a'); }
    }
  };

  // 6. Extreme close-up: the light bar flashing red and blue.
  DRAW.bar = lt => {
    const c = PC(), cx = Math.round(VW / 2), cy = Math.round(VH * 0.5), ph = Math.floor(T * 7) % 2;
    R(0, cy + 10, VW, VH - cy - 10, c[1]); R(0, cy + 10, VW, 2, c[0]); R(0, cy + 22, VW, VH - cy - 22, c[2]);
    if (VH - cy > 30) {   // windshield, with the officer looking up at the lights
      const gy = cy + 24;
      R(0, gy, VW, VH - gy, GLASS); R(0, gy, VW, 2, '#9fd2ef'); R(4, gy + 5, 8, 2, '#ffffff');
      const hx = cx + 6, hy = gy + 22;
      R(hx - 16, hy + 9, 32, VH - hy, COPC.shirt); R(hx - 16, hy + 9, 5, VH - hy, COPC.shade);
      circle(hx, hy, 10, SKIN[0]); R(hx - 11, hy - 13, 22, 6, COPC.hatC); R(hx - 9, hy - 15, 18, 2, COPC.hatC); R(hx - 12, hy - 7, 24, 2, '#10183a');
      star(hx, hy - 10, 2, '#ffd21f');
      R(hx - 5, hy - 3, 3, 3, INK); R(hx + 3, hy - 3, 3, 3, INK); R(hx - 5, hy - 3, 1, 1, '#ffffff'); R(hx + 3, hy - 3, 1, 1, '#ffffff');
      circle(hx, hy + 5, 2, '#a3121d');
      alpha(0.1, () => R(0, gy, VW, VH - gy, Math.floor(T * 7) % 2 ? BLUE_ON : RED_ON));
    }
    R(cx - 30, cy + 5, 60, 6, '#444a55'); R(cx - 30, cy + 5, 60, 1, '#6b7480');
    const dome = (x, on, onC, offC) => {
      R(x + 2, cy - 9, 22, 2, on ? '#ffffff' : offC); R(x, cy - 7, 26, 12, on ? onC : offC);
      R(x + 3, cy - 6, 8, 3, on ? '#ffffff' : mix(offC, '#ffffff', 0.25));
      if (on) for (let i = 0; i < 7; i++) {
        const a = -Math.PI * (0.08 + i * 0.14), d = 18 + (Math.floor(T * 14) % 3) * 2;
        R(x + 13 + Math.cos(a) * d, cy - 1 + Math.sin(a) * d, 3, 3, onC);
      }
    };
    dome(cx - 29, ph === 0, RED_ON, RED_OFF); dome(cx + 3, ph === 1, BLUE_ON, BLUE_OFF);
    R(cx - 3, cy - 6, 6, 11, '#dddddd'); R(cx - 2, cy - 5, 4, 3, '#ffffff');
  };
  LIT.bar = () => {
    const cx = Math.round(VW / 2), cy = Math.round(VH * 0.5), ph = Math.floor(T * 7) % 2, x = ph ? cx + 16 : cx - 16, col = ph ? BLUE_ON : RED_ON;
    alpha(0.18, () => circle(x, cy - 1, 26, col)); alpha(0.3, () => circle(x, cy - 1, 16, col));
  };

  // 7. Head-on: the police car races straight at the camera.
  const FRONT = (x0, y0, u, lit, ph, c) => {
    const P = (dx, dy, w, h, col) => R(x0 + dx * u, y0 + dy * u, Math.ceil(w * u), Math.ceil(h * u), col);
    const panel = V[VI.police].color === 'white' ? '#2f3240' : '#f4f7fb';
    P(-2, 10, 3, 3, c[2]); P(39, 10, 3, 3, c[2]);
    P(1, 23, 7, 7, TIRE); P(32, 23, 7, 7, TIRE);
    P(5, 4, 30, 10, c[1]); P(5, 4, 30, 1, c[0]);
    P(7, 5, 26, 8, GLASS); P(9, 6, 4, 1, '#ffffff');
    P(16, 8, 7, 5, SKIN[0]); P(15, 6, 9, 3, COPC.hatC); P(18, 10, 1, 1, INK); P(21, 10, 1, 1, INK); P(14, 12, 12, 1, '#3a3d46');
    P(7, 1, 26, 3, '#444a55');
    P(8, 0, 11, 3, lit && ph === 0 ? RED_ON : RED_OFF); P(21, 0, 11, 3, lit && ph === 1 ? BLUE_ON : BLUE_OFF); P(19, 0, 2, 3, '#dddddd');
    P(0, 14, 40, 11, c[1]); P(0, 14, 40, 1, c[0]); P(0, 23, 40, 2, c[2]);
    P(0, 20, 40, 2, panel);
    P(13, 16, 14, 6, '#2f3240'); for (let i = 0; i < 6; i++) P(14 + i * 2, 17, 1, 4, '#5a5f6e');
    P(19, 14, 2, 2, '#ffd21f');
    P(1, 15, 9, 5, CHROME); P(2, 16, 7, 3, '#fff6b0'); P(30, 15, 9, 5, CHROME); P(31, 16, 7, 3, '#fff6b0');
    P(1, 24, 38, 3, CHROME);
  };
  function headOnCar() {
    const lt = st.t - 14.0, q = clamp(lt / 2.2, 0, 1), hz = Math.round(VH * 0.42);
    const cw = lerp(VW * 0.16, VW * 1.25, q ** 2.2), u = cw / 40;
    const yb = lerp(hz + 8, VH + cw * 0.12, q ** 1.8);
    return { x: VW / 2 - cw / 2, y: yb - 30 * u, u, cw, yb, hz };
  }
  DRAW.headon = lt => {
    const hz = Math.round(VH * 0.42), cx = VW / 2;
    // skyline on the horizon, grass, and a road rushing toward us
    for (let i = 0; i < 9; i++) { const w = 10 + Math.floor(hash(i + 40) * 12), h = 8 + Math.floor(hash(i + 50) * 18), x = Math.round(i * VW / 8 - 6); R(x, hz - h, w, h, FARC[i % 5]); for (let wy = hz - h + 3; wy < hz - 3; wy += 5) R(x + 3, wy, 2, 2, '#e9f1fb'); }
    R(0, hz, VW, VH - hz, '#6cbf5a');
    const half = y => 3 + (y - hz) / (VH - hz) * VW * 0.7;
    for (let y = hz; y < VH; y++) { const hw = half(y); R(cx - hw - 3 - (y - hz) * 0.15, y, (hw + 3 + (y - hz) * 0.15) * 2, 1, '#d9d3c4'); R(cx - hw, y, hw * 2, 1, '#4b4f5c'); }
    for (let k = 0; k < 7; k++) {
      const p = ((lt * 1.4 + k / 7) % 1), y = hz + (VH - hz) * p * p, h = 1 + p * 6, w = 1 + p * 3;
      R(cx - w / 2, y, w, h, '#ffd21f');
    }
    const trees = [];
    for (let k = 0; k < 8; k++) trees.push({ p: (lt * 0.7 + k / 8) % 1, side: k % 2 ? 1 : -1 });
    trees.sort((a, b) => a.p - b.p);
    for (const t of trees) {
      const y = hz + (VH - hz) * t.p * t.p, r = 2 + t.p * t.p * 18, x = cx + t.side * (half(y) + 6 + r);
      R(x - r * 0.15, y - r * 0.8, Math.max(1, r * 0.3), r * 0.8, '#7a4a2a');
      circle(x, y - r * 1.4, r, '#3f9a45'); circle(x - r * 0.3, y - r * 1.7, r * 0.5, '#5bb85a');
    }
    const car = headOnCar(), ph = Math.floor(T * 7) % 2;
    alpha(0.25, () => R(car.x + car.u * 2, car.yb - car.u * 1.5, car.cw - car.u * 4, car.u * 2, '#1d1a2b'));
    FRONT(car.x, car.y, car.u, true, ph, PC());
  };
  LIT.headon = () => {
    const car = headOnCar(), u = car.u, ph = Math.floor(T * 7) % 2, k = nightK();
    const bx = car.x + (ph ? 26 : 13) * u, by = car.y + 1.5 * u;
    alpha(0.25, () => circle(bx, by, 6 * u, ph ? BLUE_ON : RED_ON));
    if (k > 0.02) alpha(0.5 * k, () => { circle(car.x + 5.5 * u, car.y + 17.5 * u, 5 * u, '#fff3b0'); circle(car.x + 34.5 * u, car.y + 17.5 * u, 5 * u, '#fff3b0'); });
  };

  // 8. Bird's-eye: the car searches the town and drives to the park; we spot the puppy first.
  function mapXf() {   // map coords: u along the main road, v across it
    const port = VH > VW, Lu = port ? VH : VW, Lv = port ? VW : VH;
    const RR = (u, v, lu, lv, c) => port ? R(v, VH - u - lu, lv, lu, c) : R(u, v, lu, lv, c);
    const CC = (u, v, r, c) => port ? circle(v, VH - u, r, c) : circle(u, v, r, c);
    const P = (u, v) => port ? [v, VH - u] : [u, v];
    return { port, Lu, Lv, RR, CC, P };
  }
  function mapCarU(lt) { const m = mapXf(); return lerp(-30, m.Lu * 0.6 - 12, ease(k01(lt, 0, 2.3))); }
  DRAW.map = lt => {
    const { Lu, Lv, RR, CC } = mapXf();
    const rv = Math.round(Lv / 2), park = Math.round(Lu * 0.62);
    RR(0, 0, Lu, Lv, '#7ccd66');
    // town blocks: cross streets, sidewalks and roofs
    RR(0, rv - 13, park, 26, '#d9d3c4');
    for (const cu of [Math.round(Lu * 0.2), Math.round(Lu * 0.44)]) { RR(cu - 10, 0, 20, Lv, '#d9d3c4'); RR(cu - 7, 0, 14, Lv, '#4b4f5c'); for (let v = 2; v < Lv; v += 8) RR(cu - 1, v, 2, 4, '#ffd21f'); }
    RR(0, rv - 10, Lu * 0.94, 20, '#4b4f5c');
    for (let u = 2; u < Lu * 0.94; u += 10) RR(u, rv - 1, 5, 2, '#ffd21f');
    let n = 0;
    for (let u = 3; u < park - 14; u += 17) {
      if (Math.abs(u + 6 - Lu * 0.2) < 16 || Math.abs(u + 6 - Lu * 0.44) < 16) continue;
      for (const side of [-1, 1]) {
        for (let d = 16; d < Lv / 2 - 6; d += 18) {
          const v = side < 0 ? rv - d - 12 : rv + d, h = hash(n++);
          if (h < 0.22) { CC(u + 6, v + 6, 6, '#3f9a45'); CC(u + 5, v + 4, 3, '#5bb85a'); continue; }
          const rc = ROOFC[Math.floor(h * 50) % ROOFC.length];
          RR(u, v, 13, 12, rc); RR(u, v + 5, 13, 2, mix(rc, '#000000', 0.25)); RR(u, v, 13, 1, mix(rc, '#ffffff', 0.3));
        }
      }
    }
    // the park: trees, pond with ducks, a bush, the puppy chasing a butterfly
    RR(park, 0, Lu - park, Lv, '#6cbf5a');
    for (let i = 0; i < 9; i++) { const u = park + 6 + hash(i + 70) * (Lu - park - 12), v = 4 + hash(i + 80) * (Lv - 8); if (Math.abs(v - rv) < 14) continue; CC(u, v, 6, '#2f8a3a'); CC(u - 1, v - 1, 4, '#3f9a45'); CC(u - 2, v - 2, 2, '#5bb85a'); }
    const pu = Math.round(lerp(park, Lu, 0.55)), pv = Math.round(Lv * 0.2);
    CC(pu, pv, 9, '#2a6fe0'); CC(pu + 5, pv, 8, '#2a6fe0'); CC(pu + 2, pv - 1, 6, '#6fb6ff');
    const dd = Math.sin(T * 1.5) * 2;
    CC(pu - 2 + dd, pv + 2, 2, '#f4f7fb'); CC(pu + 4 + dd, pv + 3, 1, '#ffd21f'); CC(pu + 7 + dd, pv + 3, 1, '#ffd21f');
    const bu = park + 14, bvv = rv + 20;
    CC(bu, bvv, 7, '#2f8a3a'); CC(bu + 4, bvv + 3, 5, '#3f9a45'); CC(bu - 2, bvv - 2, 4, '#5bb85a');
    const a = T * 2.2, qu = Math.round(lerp(park, Lu, 0.62) + Math.cos(a) * 8), qv = Math.round(Lv * 0.78 + Math.sin(a) * 5);
    const fu = qu + Math.cos(a + 0.7) * 6, fv = qv + Math.sin(a + 0.7) * 6;
    RR(fu - 1, fv - 1, 3, 3, Math.floor(T * 10) % 2 ? '#ff6fb4' : '#ffd21f');
    CC(qu, qv, 3, '#d9a066'); CC(qu + Math.cos(a + 1.5) * 3, qv + Math.sin(a + 1.5) * 3, 2, '#d9a066');
    CC(qu + Math.cos(a + 1.5) * 4, qv + Math.sin(a + 1.5) * 4, 1, '#8a5a32');
    if (Math.floor(T * 3) % 2) { const [x, y] = mapXf().P(qu, qv - 7); heartMini(x, y); }
    // police car from above
    const cu = Math.round(mapCarU(lt)), cv = rv + 1, c = PC(), ph = Math.floor(T * 7) % 2, lit = true;
    RR(cu + 2, cv - 1, 5, 2, TIRE); RR(cu + 16, cv - 1, 5, 2, TIRE); RR(cu + 2, cv + 10, 5, 2, TIRE); RR(cu + 16, cv + 10, 5, 2, TIRE);
    RR(cu, cv, 24, 11, c[1]); RR(cu + 1, cv + 1, 22, 9, c[0]); RR(cu + 6, cv + 1, 12, 9, c[1]);
    RR(cu + 16, cv + 1, 3, 9, GLASS); RR(cu + 4, cv + 1, 2, 9, GLASS2);
    RR(cu + 10, cv + 1, 3, 4, lit && ph === 0 ? RED_ON : RED_OFF); RR(cu + 10, cv + 6, 3, 4, lit && ph === 1 ? BLUE_ON : BLUE_OFF); RR(cu + 10, cv + 5, 3, 1, '#ffffff');
    RR(cu + 23, cv + 1, 1, 2, '#fff6b0'); RR(cu + 23, cv + 8, 1, 2, '#fff6b0');
  };
  function heartMini(x, y) { R(x - 2, y, 2, 1, '#e8222b'); R(x + 1, y, 2, 1, '#e8222b'); R(x - 2, y + 1, 5, 1, '#e8222b'); R(x - 1, y + 2, 3, 1, '#e8222b'); R(x, y + 3, 1, 1, '#e8222b'); }
  LIT.map = lt => {
    const { RR } = mapXf(), cu = Math.round(mapCarU(lt)), cv = Math.round(mapXf().Lv / 2) + 1, ph = Math.floor(T * 7) % 2;
    alpha(0.25, () => RR(cu + 6, ph ? cv + 4 : cv - 2, 11, 8, ph ? BLUE_ON : RED_ON));
  };

  // 9. Over the officer's shoulder: something wags in the bush.
  DRAW.ots = lt => {
    const tall = VH > VW * 1.3, hz = Math.round(VH * (tall ? 0.4 : 0.5)), bs = tall ? 1.5 : 1.15;
    for (let x = -6; x < VW + 10; x += 14) { const h = tall ? 26 + Math.floor(hash(x + 8) * 20) : 0; if (h) { R(x - 1, hz - h, 3, h, '#7a4a2a'); circle(x, hz - h, 8, '#3f9a45'); circle(x - 2, hz - h - 3, 4, '#5bb85a'); } }
    for (let x = -6; x < VW + 10; x += 14) { circle(x, hz - 4 - Math.floor(hash(x + 5) * 6), 9, '#3f9a45'); }
    R(0, hz, VW, VH - hz, '#6cbf5a');
    for (let i = 0; i < VW * VH / 140; i++) { const x = Math.floor(hash(i + 1) * VW), y = hz + 3 + Math.floor(hash(i + 2) * (VH - hz - 3)); R(x, y, 1, 2, '#5aa84c'); if (i % 4 === 0) R(x, y, 2, 2, ['#ff6fb4', '#ffd21f', '#ffffff'][i % 3]); }
    const bx = Math.round(VW * (tall ? 0.5 : 0.6)), by = Math.round(hz + (VH - hz) * 0.42), shake = Math.floor(T * 16) % 2 && (lt % 0.5) < 0.3 ? 1 : 0;
    drawBush(bx + shake, by, bs);
    drawTail(Math.round(bx + 17 * bs) + shake, Math.round(by - 8 * bs), bs, 0.9);
    // the officer from behind, big in the foreground, leaning in
    const lean = Math.round(ease(k01(lt, 0, 1.2)) * 4), hx = Math.round(VW * 0.2) + lean, hy = VH - 24;
    R(hx - 30, hy + 10, 62, 40, COPC.shirt); circle(hx - 22, hy + 16, 10, COPC.shirt); circle(hx + 24, hy + 16, 10, COPC.shirt);
    R(hx - 4, hy + 6, 9, 8, SKIN[0]);
    circle(hx, hy - 2, 13, '#5a3a22');
    circle(hx + 12, hy - 1, 3, SKIN[0]);
    R(hx - 14, hy - 13, 28, 9, COPC.hatC); R(hx - 12, hy - 16, 24, 3, COPC.hatC); R(hx - 14, hy - 6, 28, 2, '#10183a');
    R(hx - 30, hy + 10, 62, 1, COPC.shade);
  };
  function drawBush(x, y, s) {
    circle(x - 12 * s, y, 11 * s, '#2f8a3a'); circle(x + 12 * s, y, 11 * s, '#2f8a3a'); circle(x, y - 6 * s, 14 * s, '#2f8a3a');
    circle(x - 10 * s, y - 2 * s, 8 * s, '#3f9a45'); circle(x + 8 * s, y - 4 * s, 9 * s, '#3f9a45'); circle(x - 2 * s, y - 10 * s, 8 * s, '#5bb85a');
    R(x - 22 * s, y + 6 * s, 44 * s, 5 * s, '#2f8a3a');
  }
  function drawTail(x, y, s, len) {   // a white fluffy tail wagging out of the bush
    const a = -0.7 + Math.sin(T * 14) * 0.55;
    for (let i = 0; i <= 10 * s * len * 1.3; i++) {
      const px = x + Math.cos(a) * i, py = y + Math.sin(a) * i, w = Math.max(2, Math.round((3 + i * 0.25) * s));
      R(px - w / 2, py - w / 2, w, w, i > 7 * s ? '#ffffff' : '#e9eef2');
    }
  }

  // 10. Close-up: the tail wags... and a duck pops out! Then three ducklings.
  DRAW.tail = lt => {
    const top = Math.round(VH * 0.45);
    R(0, 0, VW, VH, '#7ccd66');
    for (let x = -4; x < VW + 8; x += 10) circle(x, top - 8 + Math.floor(hash(x) * 4), 8, '#5bb85a');
    const pop = k01(lt, 0.5, 0.68), dx = Math.round(VW * 0.42);
    if (lt > 0.45) {   // the duck rises out of the bush
      const y = Math.round(lerp(top + 16, top - 12, backOut(pop)));
      circle(dx, y + 12, 7, '#f4f7fb'); R(dx - 7, y + 12, 14, 12, '#f4f7fb');
      circle(dx, y, 9, '#f4f7fb'); R(dx - 2, y - 11, 3, 3, '#f4f7fb');
      R(dx + 7, y - 1, 10, 4, '#f57a12'); R(dx + 7, y + 3, 9, 2, '#b14c06');
      R(dx + 1, y - 4, 3, 3, INK); R(dx + 1, y - 4, 1, 1, '#ffffff');
      R(dx - 6, y + 2, 3, 2, '#ffc2b0');
      if (lt > 0.6 && lt < 1.3) { const s = 1 + Math.floor(T * 8) % 2; bang(dx - 22, y - 16, 3, '#e8222b'); R(dx - 24 - s, y - 18 - s, 2, 2, '#ffd21f'); }
    }
    const ducklings = [[0.85, -18], [1.05, 16], [1.25, 30]];
    for (const [t0, ox] of ducklings) {
      if (lt < t0) continue;
      const k = backOut(k01(lt, t0, t0 + 0.15)), x = dx + ox, y = Math.round(lerp(top + 8, top - 4, k));
      circle(x, y, 5, '#ffd21f'); R(x + 4, y - 1, 5, 2, '#f57a12'); R(x + 1, y - 2, 2, 2, INK);
    }
    // big bush in front
    const s = 1;
    for (let x = -10; x < VW + 14; x += 16) { circle(x, top + 10, 14 * s, '#2f8a3a'); circle(x + 4, top + 6, 9, '#3f9a45'); }
    R(0, top + 14, VW, VH - top - 14, '#2f8a3a');
    for (let i = 0; i < 26; i++) { const x = Math.floor(hash(i + 20) * VW), y = top + 6 + Math.floor(hash(i + 30) * (VH - top - 6)); R(x, y, 3, 2, i % 2 ? '#3f9a45' : '#5bb85a'); }
    if (lt < 0.55) drawTail(Math.round(VW * 0.7), top + 8, 2, 1);
  };

  // 11. The park: the puppy chases a butterfly, sees the officer and leaps into his arms.
  function parkSet() {
    const G = geo(), hz = G.swTop;
    for (let i = 0; i < 9; i++) { const w = 12 + Math.floor(hash(i + 90) * 16), h = clamp(hz - 30, 12, 120) * (0.4 + hash(i + 91) * 0.6), x = Math.round(i * VW / 7 - 8); R(x, hz - 6 - h, w, h + 6, FARC[i % 5]); for (let wy = hz - h; wy < hz - 10; wy += 8) R(x + 3, wy, 2, 3, '#e9f1fb'); }
    R(0, hz - 8, VW, VH - hz + 8, '#6cbf5a');
    for (let x = 6; x < VW; x += 34) drawTree(x + Math.floor(hash(x) * 10), hz - 2, 9 + Math.floor(hash(x + 1) * 3));
    R(0, G.feet - 3, VW, 6, '#e3d6b4'); R(0, G.feet - 3, VW, 1, '#f0e6c8');
    for (let i = 0; i < VW / 6; i++) { const x = Math.floor(hash(i + 3) * VW), y = G.feet + 6 + Math.floor(hash(i + 4) * Math.max(1, VH - G.feet - 10)); R(x, y, 2, 2, ['#ff6fb4', '#ffd21f', '#ffffff', '#c39bff'][i % 4]); R(x, y + 2, 1, 2, '#3f9a45'); }
    return G;
  }
  DRAW.puppy = lt => {
    const G = parkSet(), ox = Math.round(VW * 0.3), feet = G.feet;
    drawBush(Math.round(VW * 0.08), feet - 6, 0.7);
    // ducks waddling off to the left
    for (let i = 0; i < 4; i++) drawDuckBig(Math.round(VW * 0.12) - lt * 16 - i * 11, feet + 4, i === 0, Math.floor(T * 8) % 2, -1);
    const catchT = 2.25, jump0 = 1.85;
    const px0 = VW + 16, px1 = Math.round(VW * 0.64);
    let px, py = feet, pose = 'run', pdir = -1;
    if (lt < 1.4) px = lerp(px0, px1, lt / 1.4);
    else if (lt < jump0) { px = px1; pose = 'stand'; py = feet - Math.round(Math.abs(Math.sin(lt * 14)) * 2); }
    else if (lt < catchT) { const k = (lt - jump0) / (catchT - jump0); px = lerp(px1, ox + 6, k); py = lerp(feet, feet - 9, k) - Math.sin(k * Math.PI) * 14; pose = 'jump'; }
    else { px = ox + 6; py = feet - 9; pose = 'held'; }
    // butterfly leads the puppy, then flutters up and away
    const bfx = lt < 1.4 ? lerp(px0 - 18, px1 - 16, lt / 1.4) : px1 - 16 + (lt - 1.4) * 10, bfy = feet - 18 - Math.sin(T * 5) * 4 - Math.max(0, lt - 1.3) * 26;
    const held = lt >= catchT;
    drawPerson({ type: 'cop', x: ox, yb: feet, dir: 1, pose: held ? 'carry' : (lt > 1.4 ? 'wave' : 'stand'), seed: 1, hop: held && lt < catchT + 0.4 ? 2 : 0 });
    puppy(px, py, pdir, pose, held || pose === 'stand');
    if (lt > 1.4 && lt < 1.85) { bubble(px - 5, feet - 30, 10, 11, px - 1, -1); bang(px - 2, feet - 27, 1, '#e8222b'); heartMini(px + 1, feet - 28); }
    butterfly(bfx, bfy);
  };
  LIT.puppy = lt => { if (lt > 2.25) { const G = geo(); hearts(Math.round(VW * 0.3) + 4, G.feet - 22, lt - 2.25, 5); } };

  // 12. Push-in on the reunion hug.
  DRAW.hug = lt => {
    const camX = Math.round(300 - VW / 2), G = street(camX);
    const kx = KX - camX, ox = 314 - camX, leap0 = 0.45, leap1 = 0.85;
    drawPerson({ type: 'mom', x: 282 - camX, yb: G.feet, dir: 1, pose: lt > 0.9 ? 'cheer' : 'stand', skin: SKIN[3], seed: 2 });
    drawPerson({ type: 'chef', x: 356 - camX, yb: G.feet, dir: -1, pose: lt > 0.9 ? 'cheer' : 'stand', skin: SKIN[0], seed: 5 });
    copCar(252 - camX, G.laneY, true, false);
    const held = lt >= leap1;
    drawPerson({ type: 'cop', x: ox, yb: G.feet, dir: 1, pose: lt < leap0 ? 'carry' : (lt > 1.0 ? 'cheer' : 'stand'), seed: 1 });
    const hop = held ? Math.round(Math.abs(Math.sin((lt - leap1) * 6)) * 3) : 0;
    happyKid(kx, G.feet, -1, held ? 'carry' : 'wave', hop);
    let px, py, pose = 'held';
    if (lt < leap0) { px = ox + 6; py = G.feet - 9; }
    else if (lt < leap1) { const k = (lt - leap0) / (leap1 - leap0); px = lerp(ox + 6, kx - 6, k); py = lerp(G.feet - 9, G.feet - 7 - hop, k) - Math.sin(k * Math.PI) * 10; pose = 'jump'; }
    else { px = kx - 6; py = G.feet - 7 - hop; }
    puppy(px, py, held ? 1 : 1, pose, true);
    if (held && Math.floor(T * 4) % 2) R(kx - 2, G.feet - 15 - hop, 2, 2, '#ff6fb4');   // lick!
  };
  LIT.hug = lt => { if (lt > 0.85) { const G = geo(); hearts(KX - Math.round(300 - VW / 2) - 3, G.feet - 22, (lt - 0.85) % 1.6, 6); } };
  function hugPush(lt) { const G = geo(); return { k: lerp(1, 1.55, ease(k01(lt, 0.2, 2.4))), ax: KX - Math.round(300 - VW / 2) - 6, ay: G.feet - 14 }; }

  // 13. Wide at sunset: the car waits while a duck family crosses, honks and drives away.
  function byeCarX(lt) { return 458 + (lt > 2.3 ? 120 * (lt - 2.3) ** 2 : 0); }
  DRAW.bye = lt => {
    const camX = Math.round(533 - VW * 0.55), sunset = k01(lt, 0.2, 2.6);
    const G = street(camX);
    copCar(byeCarX(lt) - camX, G.laneY, true, lt < 2.4);
    const fams = [[0, true], [0.4, false], [0.75, false], [1.1, false]];
    fams.forEach(([d, big], i) => {
      const k = k01(lt, 0.15 + d, 1.35 + d), x0 = CW + 13 - camX + (i % 2 ? 4 : 0);
      let y = lerp(G.feet, G.front, k), x = x0;
      if (k >= 1) x = x0 + (lt - 1.35 - d) * 14;
      const walking = k > 0 && (k < 1 || true);
      drawDuckBig(x, y, big, walking ? Math.floor(T * 8 + i) % 2 : 0, 1);
    });
    sunsetWash(sunset);
  };

  // 14. End card: a big gold badge with a heart, the police car, confetti.
  DRAW.end = lt => {
    R(0, 0, VW, VH, '#1d2a5a');
    const cx = Math.round(VW / 2), side = VW > VH * 1.35, cy = Math.round(side ? VH * 0.48 : VH * 0.4);
    for (let r = Math.max(VW, VH); r > 0; r -= 12) circle(cx, cy, r + (Math.floor(T * 8) % 12), (r / 12) % 2 ? '#22306a' : '#1d2a5a');
    const rr = Math.round(Math.min(VW, VH) * 0.3 * backOut(k01(lt, 0, 0.5)));
    if (rr > 2) {
      const bx = side ? Math.round(VW * 0.36) : cx;
      star(bx, cy + 2, rr, '#a3741a'); star(bx, cy, rr, '#ffd21f'); star(bx - 1, cy - 1, rr * 0.7, '#fff27a'); star(bx, cy, rr * 0.62, '#ffd21f');
      circle(bx, cy, Math.round(rr * 0.4), '#1a3f9a'); circle(bx, cy, Math.round(rr * 0.36), '#2a6fe0');
      heart(bx, cy + 1, Math.max(1, Math.round(rr / 14)), '#e8222b');
    }
    const carX = side ? Math.round(VW * 0.62) : cx - 28, carY = side ? cy + 16 : Math.min(VH - 8, cy + Math.round(Math.min(VW, VH) * 0.3) + 40);
    const drive = side ? 0 : 0;
    R(carX - 6, carY - 1, 68, 3, '#141c48');
    dv(carX + drive, carY, true, Math.floor(T * 4) % 2);
  };

  /* ---------- view: zoom per shot, push-in, screen mapping ---------- */
  function shotAt(t) { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x.t0) s = x; return s; }
  function viewFor(shot, lt) {
    // wide shots stay wide in landscape; a tall portrait screen already shows the whole street top to bottom
    const need = shot.wide && H > W * 1.3 ? [100, 96] : shot.need;
    const Z = clamp(Math.floor(Math.min(W / need[0], H / need[1])), 1, 6);
    const vw = Math.ceil(W / Z), vh = Math.ceil(H / Z);
    let k = 1, sx = 0, sy = 0;
    if (shot.id === 'hug') {
      VW = vw; VH = vh;
      const p = hugPush(lt);
      k = p.k;
      const sw = vw / k, sh = vh / k;
      sx = clamp(p.ax - sw / 2, 0, vw - sw); sy = clamp(p.ay - sh * 0.55, 0, vh - sh);
    }
    return { Z, vw, vh, k, sx, sy };
  }
  const toScreen = (x, y) => { const v = st.view; return [(x - v.sx) * v.Z * v.k, (y - v.sy) * v.Z * v.k]; };
  function renderSet(cvs, ctx2, fn) {
    const v = st.view;
    if (cvs.width !== v.vw || cvs.height !== v.vh) { cvs.width = v.vw; cvs.height = v.vh; } else ctx2.clearRect(0, 0, v.vw, v.vh);
    const prev = g;
    g = ctx2; VW = v.vw; VH = v.vh;
    try { fn(); } finally { g = prev; }
    prev.imageSmoothingEnabled = false;
    prev.drawImage(cvs, v.sx, v.sy, v.vw / v.k, v.vh / v.k, 0, 0, v.vw * v.Z, v.vh * v.Z);
  }
  function exit() {
    if (st.done) return;
    st.done = true;
    goScene(SCENES.movies ? 'movies' : 'station', { watched: 'police' });
  }
  // Iris (black outside a circle) in screen coordinates.
  function iris(cx, cy, r) {
    if (r >= Math.hypot(W, H)) return;
    for (let y = 0; y < H; y++) {
      const dy = y - cy;
      if (Math.abs(dy) >= r) { R(0, y, W, 1, '#1d1a2b'); continue; }
      const hw = Math.sqrt(r * r - dy * dy);
      R(0, y, Math.max(0, cx - hw), 1, '#1d1a2b'); R(cx + hw, y, Math.max(0, W - cx - hw), 1, '#1d1a2b');
    }
  }

  /* ---------- scene ---------- */
  SCENES.moviePolice = {
    view: [186, 200],
    freeTouch: true,
    groundY: () => Math.round(H * 0.75),
    get clock() { return st.t; },   // seconds into the episode (read-only, for the cinema and tests)
    enter() {
      sirenOff(); stopNarr();
      Object.assign(st, { on: true, t: 0, ci: 0, done: false, vd: [], wins: [], lamps: [] });
      st.tune.i = 0; st.tune.at = 0;
      NARRATION.forEach(([, n]) => loadNarr(n));
      setClouds(L.safeT + 30, Math.max(L.safeT + 50, Math.round(H * 0.3)));
    },
    leave() {
      st.on = false; narrTok++;
      sirenOff(); stopNarr();
      if (typeof voiceSrc !== 'undefined' && voiceSrc) { voiceToken++; try { voiceSrc.stop(); } catch (e) {} voiceSrc = null; }
    },
    update(dt) {
      if (st.done) return;
      st.t += dt;
      while (st.ci < CUES.length && CUES[st.ci][0] <= st.t) { const fn = CUES[st.ci++][1]; try { fn(); } catch (e) {} }
      tune();
      const lt = st.t - 31.6;
      if (lt > 0.2 && lt < 1.6) confetti(2);
      // little bursts the camera can see
      const sh = shotAt(st.t), slt = st.t - sh.t0;
      st.view = viewFor(sh, slt); VW = st.view.vw; VH = st.view.vh;
      if (sh.id === 'tail' && slt > 0.5 && slt - dt <= 0.5) { const [x, y] = toScreen(VW * 0.42, VH * 0.45); puff(x, y, 14, '#5bb85a'); }
      if (sh.id === 'hug' && slt > 0.85 && slt - dt <= 0.85) { const [x, y] = toScreen(KX - Math.round(300 - st.view.vw / 2), geo().feet - 12); sparkle(x, y, 30, 14); }
      if (sh.id === 'face' && Math.floor(slt * 3) !== Math.floor((slt - dt) * 3)) { const [x, y] = toScreen(VW / 2 - 9, VH * 0.47 + 14); sparkle(x, y, 8, 3); }
      if (st.t >= END) exit();
    },
    drawWorld() {
      const sh = shotAt(st.t), lt = st.t - sh.t0;
      st.view = viewFor(sh, lt);
      st.vd = []; st.wins = []; st.lamps = [];
      if (sh.id === 'bye') {   // a warm sunset sky behind the street
        const s = k01(lt, 0.2, 2.6) * (1 - nightK());
        if (s > 0.01) {
          const cols = ['#ff7a8a', '#ff8f6b', '#ffa95a', '#ffc46b', '#ffdd8a'];
          alpha(0.8 * s, () => cols.forEach((c, i) => R(0, Math.round(i * H * 0.6 / cols.length), W, Math.ceil(H * 0.6 / cols.length) + 1, c)));
        }
      }
      renderSet(offA, gA, () => DRAW[sh.id](lt));
    },
    drawLit() {
      const sh = shotAt(st.t), lt = st.t - sh.t0, k = nightK();
      renderSet(offB, gB, () => {
        if (k > 0.02) {
          alpha(k, () => {
            for (const [x, y, w, h] of st.wins) R(x + 1, y + 1, w - 2, h - 2, '#ffe27a');
            for (const [x, y] of st.lamps) { alpha(0.3, () => circle(x, y, 6, '#ffe27a')); R(x - 1, y, 3, 1, '#ffffff'); }
          });
          for (const d of st.vd) drawVehicleLights(d, k);
        }
        if (LIT[sh.id]) LIT[sh.id](lt);
      });
      drawParticles();
    },
    drawUI() {
      const sh = shotAt(st.t), lt = st.t - sh.t0, Rmax = Math.hypot(W, H);
      if (sh.tin === 'iris' && lt < 0.45) iris(W / 2, H / 2, Rmax * ease(lt / 0.45));
      if (sh.tin === 'wipe' && lt < 0.3) { const k = ease(lt / 0.3); R(W * k, 0, W * (1 - k) + 1, H, '#1d1a2b'); }
      const left = sh.t1 - st.t;
      if (sh.next && sh.next.tin === 'iris' && left < 0.35) iris(W / 2, H / 2, Rmax * (left / 0.35));
      if (!sh.next && left < 0.3) alpha(1 - left / 0.3, () => R(0, 0, W, H, '#1d1a2b'));
      // thin progress bar so a grown-up can see how long is left
      const x0 = L.safeL + 6, x1 = W - L.safeR - 6, y = H - L.safeB - 3;
      alpha(0.35, () => R(x0, y, x1 - x0, 2, '#1d1a2b'));
      alpha(0.85, () => R(x0, y, Math.round((x1 - x0) * clamp(st.t / END, 0, 1)), 2, '#ffd21f'));
      drawHomeButton();
    },
    tap(x, y) {
      if (inBox(L.homeBtn, x, y)) { exit(); return true; }
      sparkle(x, y, 5, 4);
      return true;
    },
  };
})();
