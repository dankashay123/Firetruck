// "Fire Truck to the Rescue!": a ~33 s watch-only cartoon for the cinema.
// Thirteen short shots (wide, close-up, head-on, bird's-eye, low angle), each drawn into an
// offscreen buffer at its own zoom and scaled up with crisp pixels. Everything on screen is a
// pure function of the episode clock t, so the film plays the same way every time.
// Optional parent-recorded narration: audio/movie-fire-01.mp3 … -10.mp3 (skipped if missing).
'use strict';
(() => {
  const BRICK = '#b5523b', MORTAR = '#934130', TRIM = '#efe3c6', DARK = '#3a3442', ROAD = '#4b4f5c', GRASS = '#6cbf5a';
  const FF1 = SKIN[0], FF2 = SKIN[2];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const k01 = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ---------- the script ---------- */
  // Narration cues: [time, clip, line a parent records, fallback clip from the game's own voice].
  const NARR = [
    [0.3,  'movie-fire-01', 'Here is the fire station!'],
    [2.7,  'movie-fire-02', 'Ding ding! The alarm is ringing!'],
    [4.5,  'movie-fire-03', 'Slide down the pole! Wheee!'],
    [8.6,  'movie-fire-04', 'Here comes the fire truck!', 'here-comes-the-fire-truck'],
    [12.7, 'movie-fire-05', 'Beep beep! Cars move over!'],
    [17.5, 'movie-fire-06', 'Oh no! A little fire!'],
    [20.6, 'movie-fire-07', 'Spray the water! Whoosh!'],
    [23.5, 'movie-fire-08', 'Up, up, up the ladder!'],
    [26.8, 'movie-fire-09', 'The kitty is safe! Hooray!', 'praise'],
    [29.6, 'movie-fire-10', 'Back home. Bye bye, fire truck!', 'back-to-the-station'],
  ];
  const END = 33.2;
  const SHOTS = [
    { t0: 0.0,  t1: 2.6,  need: [92, 150], cap: 2 },   // 1 station cutaway: crew relaxing
    { t0: 2.6,  t1: 4.4,  need: [50, 60],  cap: 3 },   // 2 close-up: the alarm bell rings
    { t0: 4.4,  t1: 6.4,  need: [92, 150], cap: 2 },   // 3 cutaway: down the pole
    { t0: 6.4,  t1: 7.6,  need: [56, 70],  cap: 3 },   // 4 close-up: the crew lands at the bottom of the pole
    { t0: 7.6,  t1: 10.6, need: [92, 140], cap: 2 },   // 5 station front: door up, truck out
    { t0: 10.6, t1: 12.4, need: [62, 60],  cap: 3 },   // 6 close-up: light bar and wheels
    { t0: 12.4, t1: 15.4, need: [90, 100], cap: 2 },   // 7 bird's-eye: through the streets
    { t0: 15.4, t1: 17.4, need: [90, 100], cap: 2 },   // 8 head-on: racing at the camera
    { t0: 17.4, t1: 20.4, need: [999, 999], cap: 1 },  // 9 wide: the house, the truck arrives
    { t0: 20.4, t1: 23.4, need: [96, 90],  cap: 2 },   // 10 medium: spray the fire out
    { t0: 23.4, t1: 26.6, need: [70, 100], cap: 2 },   // 11 low angle: up the ladder to kitty
    { t0: 26.6, t1: 29.4, need: [56, 50],  cap: 3 },   // 12 reaction close-up: family + kitty
    { t0: 29.4, t1: END,  need: [92, 140], cap: 2 },   // 13 final wide: home, door, heart
  ];

  /* ---------- state ---------- */
  let t = 0, ev = 0, shotI = -1, exiting = false;
  let Z = 1, WW = 100, HH = 100, SL = 0, SR = 0, ST = 0, SB = 0;
  let shakeX = 0, shakeY = 0, push = 1, focus = [0, 0];
  let narrSrc = null, narrEnd = 0, lastLine = null, resumeLine = null;
  const narrSrcs = [];
  const ctlS = { paused: false, ui: 0, drag: null };   // pause button and the draggable timeline
  let hearts = [], taps = [], lights = [], car = null;
  const onceSet = new Set();
  const once = key => !onceSet.has(key) && !!onceSet.add(key);
  const buf = document.createElement('canvas'), bufG = buf.getContext('2d');
  const sp = document.createElement('canvas'), spG = sp.getContext('2d');   // small sprite canvas
  sp.width = 28; sp.height = 40;

  function setZoom(sh) {
    Z = clamp(Math.floor(Math.min(W / sh.need[0], H / sh.need[1])), 1, sh.cap);
    WW = Math.ceil(W / Z); HH = Math.ceil(H / Z);
    SL = Math.ceil(L.safeL / Z); SR = Math.ceil(L.safeR / Z); ST = Math.ceil(L.safeT / Z); SB = Math.ceil(L.safeB / Z);
  }
  function shotAt(tt) { let i = 0; while (i < SHOTS.length - 1 && tt >= SHOTS[i].t1) i++; return i; }

  /* ---------- narration (optional recordings) ---------- */
  const narrBytes = {}, narrBuf = {};
  function loadNarration() {
    for (const [, n] of NARR) {
      if (!narrBytes[n]) narrBytes[n] = fetch('audio/' + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
      if (ac && !narrBuf[n]) narrBuf[n] = narrBytes[n].then(b => b && new Promise(res => {
        try { ac.decodeAudioData(b.slice(0), res, () => res(null)); } catch (e) { res(null); }
      }));
    }
  }
  function narrate(n, fallback) {
    if (!ac) return;
    lastLine = n;
    const p = narrBuf[n];
    const go = b => {
      if (!b) { if (fallback) say(fallback === 'praise' ? pick('praise') : fallback); return; }
      voiceToken++;
      if (voiceSrc) { try { voiceSrc.stop(); } catch (e) {} voiceSrc = null; }
      // a line that's still playing finishes first; this one follows right after it
      const when = Math.max(ac.currentTime, narrEnd + 0.12);
      const src = ac.createBufferSource();
      src.buffer = b; src.connect(voiceOut); src.start(when);
      narrEnd = when + b.duration; narrSrc = src; narrSrcs.push(src);
      voiceUntil = narrEnd; duck(narrEnd - ac.currentTime);
      src.onended = () => { const i = narrSrcs.indexOf(src); if (i >= 0) narrSrcs.splice(i, 1); if (narrSrc === src) narrSrc = null; };
    };
    // a recording that is still decoding gets 0.25 s, then the line is skipped (or the fallback plays)
    if (!p) return go(null);
    let settled = false;
    p.then(b => { if (!settled && scene === 'movieFire') { settled = true; go(b); } });
    setTimeout(() => { if (!settled) { settled = true; go(null); } }, 250);
  }
  function stopNarr() { for (const s of narrSrcs.splice(0)) { try { s.stop(); } catch (e) {} } narrSrc = null; narrEnd = 0; }

  /* ---------- sound track: recorded CC0 clips (the synth plays if a clip is missing) ---------- */
  // (toys.js loads after this file, so the bank is made on first use)
  const SND_FILES = {
    bell: ['rescue-bell', 0.42], slide: ['rescue-slide', 0.32], thud: ['rescue-thud', 0.45], door: ['rescue-door', 0.3],
    start: ['rescue-start', 0.28], horn: ['rescue-horn', 0.34], brake: ['trash-air', 0.26], meow: ['cat-meow', 0.42], meow2: ['cat-meow2', 0.42],
    steam: ['boat-steam', 0.42], chime: ['mv-chime', 0.5], ratchet: ['mc-ratchet', 0.3], applause: ['rescue-applause', 0.4], twinkle: ['mc-twinkle', 0.4],
  }, SND_SYNTH = {
    bell() { SFX.bell(); }, slide() { SFX.whoosh(); }, thud() { tone('sine', 120, 0, 0.25, 0.25, 45); noise(0, 0.12, 0.12, 300, 1); },
    door() { SFX.door(); }, horn() { SFX.honk(); }, brake() { SFX.brake(); }, meow() { SFX.meow(); }, meow2() { SFX.meow(); },
    steam() { SFX.sizzle(); }, chime() { SFX.chime(); }, applause() { SFX.fanfare(); }, twinkle() { SFX.sunrise(); },
  };
  let bank = null;
  const live = new Set();   // clips still sounding, so a pause or the home button can cut them off
  const SND = {
    bank: () => bank || (bank = TOY.bank(SND_FILES, SND_SYNTH)),
    load() { SND.bank().load(); },
    play(k, rate, vol) {
      const src = SND.bank().play(k, rate, vol);
      if (src) { live.add(src); src.onended = () => live.delete(src); }
      return src;
    },
    stop() { for (const s of live) { try { s.stop(); } catch (e) {} } live.clear(); },
  };
  function getBuf(n) {
    return fetch('audio/' + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null)
      .then(ab => ab && new Promise(res => { try { ac.decodeAudioData(ab, res, () => res(null)); } catch (e) { res(null); } })).catch(() => null);
  }
  // A looping bed (siren, hose, engine) whose level follows the episode clock: set(level) every frame.
  // synth(level, state) -> state is the stand-in while the recording is missing.
  function bed(name, vol, synth) {
    let buf = null, asked = false, src = null, gn = null, fb = null;
    const B = {
      load() { if (!asked && ac) { asked = true; getBuf(name).then(b => { buf = b; }); } },
      set(level) {
        if (!ac) return;
        if (level <= 0.001) { B.stop(); return; }
        if (buf) {
          if (!src) {
            src = ac.createBufferSource(); gn = ac.createGain();
            src.buffer = buf; src.loop = true; gn.gain.value = 0;
            src.connect(gn); gn.connect(master); src.start();
          }
          gn.gain.setTargetAtTime(level * vol, ac.currentTime, 0.06);
        } else if (synth) fb = synth(level, fb);
      },
      stop() {
        if (src) { const n = ac.currentTime; gn.gain.cancelScheduledValues(n); gn.gain.setTargetAtTime(0, n, 0.05); try { src.stop(n + 0.3); } catch (e) {} src = null; gn = null; }
        if (fb) fb = synth(0, fb);
      },
    };
    return B;
  }
  const noiseBed = (f, q, k) => (lv, s) => { s = s || noiseLoop(f, q); s(lv * k); return s; };
  const SIREN = bed('rescue-siren-fire', 0.2, (lv, s) => lv > 0 ? s || siren('fire') : (s && s(), null));
  const HOSE = bed('rescue-hose', 0.3, noiseBed(1400, 0.7, 0.3));
  const CRACKLE = bed('rescue-crackle', 0.28, noiseBed(3000, 0.4, 0.05));
  const ENGINE = bed('rescue-engine', 0.12, noiseBed(110, 0.7, 0.08));
  const BEDS = [SIREN, HOSE, CRACKLE, ENGINE];
  const sirenAt = tt => tt >= 8.5 && tt < 18.6;

  // music: a cheerful adventure loop, in step with the clock (pause and the timeline included)
  const MUSIC = { name: 'rescue-fire-music', vol: 0.17, from: 0.1, buf: null, src: null, gain: null, asked: false };
  function loadSound() {
    if (!ac) return;
    SND.load(); BEDS.forEach(b => b.load());
    if (!MUSIC.asked) { MUSIC.asked = true; getBuf(MUSIC.name).then(b => { MUSIC.buf = b; }); }
  }
  function stopMusic() { if (MUSIC.src) { try { MUSIC.src.stop(); } catch (e) {} MUSIC.src = null; MUSIC.gain = null; } }
  function musicTick() {
    if (!MUSIC.buf || !ac) return;
    if (!MUSIC.src && t >= MUSIC.from && t < END - 0.3) {
      const src = ac.createBufferSource(), gn = ac.createGain();
      src.buffer = MUSIC.buf; src.loop = true; gn.gain.value = 0;
      const off = (t - MUSIC.from) % MUSIC.buf.duration;
      src.connect(gn); gn.connect(master); src.start(0, off);
      Object.assign(MUSIC, { src, gain: gn, at: ac.currentTime, off });
    }
    if (!MUSIC.gain) return;
    // a slow frame holds the picture back while the music runs on: start over in step if they drift apart
    const dur = MUSIC.buf.duration, want = (t - MUSIC.from) % dur, have = (MUSIC.off + ac.currentTime - MUSIC.at) % dur;
    if (Math.min(Math.abs(want - have), dur - Math.abs(want - have)) > 0.35) { stopMusic(); return; }
    // softer under a narration line (the master dips too) and under the siren; fades in, and out at the end
    const talk = ac.currentTime < Math.max(narrEnd, voiceUntil) ? 0.7 : 1;
    const k = clamp((t - MUSIC.from) / 1.2, 0, 1) * clamp((END - 0.3 - t) / 2.6, 0, 1) * talk * (sirenAt(t) ? 0.8 : 1);
    MUSIC.gain.gain.setTargetAtTime(MUSIC.vol * k, ac.currentTime, 0.08);
  }
  let ranOut = false;   // the episode played to the end: its last chime may ring out
  function hush() {   // every sound off at once (pause, scrub, leaving)
    stopMusic(); if (!ranOut) SND.stop(); BEDS.forEach(b => b.stop()); stopNarr();
    if (voiceSrc) say([]);
  }

  /* ---------- sound cues ---------- */
  const play = (k, rate, vol) => () => SND.play(k, rate, vol);
  const EVENTS = [
    [2.65, play('bell')],
    [4.6, play('slide')], [5.2, play('slide', 1.1, 0.8)],
    [6.65, play('thud')], [7.05, play('thud', 1.1)],
    [7.75, play('door')], [8.0, play('start')],
    [13.3, play('horn')], [13.65, play('horn')],
    [15.7, () => say('fire-truck-to-the-rescue', true)],
    [16.6, play('horn', 0.95)],
    [18.6, play('brake')],
    [19.1, play('meow')],
    [19.3, () => SFX.boop(1)], [19.6, () => SFX.boop(1.2)],
    [22.35, play('steam')], [22.7, play('chime')],
    [24.0, () => { tone('triangle', 330, 0, 1.2, 0.04, 660); SND.play('ratchet'); }], [24.4, play('ratchet', 1.1)], [24.8, play('ratchet', 1.2)],
    [25.1, play('meow2')], [25.3, play('chime')],
    [26.7, play('applause')], [27.9, play('meow', 1.1)],
    [29.9, play('horn')],
    [31.1, play('door')],
    [31.8, () => { SND.play('chime'); SND.play('twinkle'); }],
  ];
  for (const [tt, n, , fb] of NARR) EVENTS.push([tt, () => narrate(n, fb)]);
  EVENTS.sort((a, b) => a[0] - b[0]);

  /* ---------- small drawing helpers ---------- */
  function heart(cx, cy, s, c) {
    cx = Math.round(cx); cy = Math.round(cy);
    circle(cx - s, cy, s, c); circle(cx + s, cy, s, c);
    for (let k = 0; k <= 2 * s + 1; k++) R(cx - 2 * s + k, cy + k, Math.max(1, 4 * s + 1 - 2 * k), 1, c);
  }
  function addHeart(x, y, big) { hearts.push({ x: x + rand(-4, 4), y, vx: rand(-6, 6), vy: rand(-22, -14), life: 1.6, max: 1.6, s: big ? 2 : 1 }); }
  function drawHearts() {
    for (const h of hearts) alpha(Math.min(1, h.life / h.max * 2), () => heart(h.x, h.y, h.s, '#ff4f9a'));
  }
  function person(type, x, yb, o) { drawPerson(Object.assign({ type, x, yb, dir: 1, pose: 'stand', skin: FF1, seed: 0 }, o || {})); }
  function truck(x, yb, lit, bob = 0, rot = 0, hidden = false) {
    drawV(VI.fire, x, yb, lit, bob, rot);
    if (!hidden) lights.push({ i: VI.fire, x: Math.floor(x), yb: Math.floor(yb), lit, bob });
  }
  // two helmets peeking out of the cab window
  function crewInCab(x, yb, n = 2) {
    const y = Math.floor(yb) - 38;
    if (n > 0) { R(x + 55, y + 14, 4, 4, FF1); R(x + 54, y + 12, 6, 3, '#e8222b'); R(x + 58, y + 15, 1, 1, INK); }
    if (n > 1) { R(x + 50, y + 15, 4, 3, FF2); R(x + 49, y + 13, 6, 3, '#e8222b'); }
  }
  function mortar(x, y, w, h) {
    for (let yy = y + 3; yy < y + h; yy += 4) {
      R(x, yy, w, 1, MORTAR);
      const off = ((yy - y) / 4) % 2 ? 0 : 4;
      for (let xx = x + off; xx < x + w; xx += 8) R(xx, yy - 3, 1, 3, MORTAR);
    }
  }
  function land(baseY) {
    circle(WW * 0.12, baseY + 14, 56, '#8fd877');
    circle(WW * 0.88, baseY + 20, 60, '#8fd877');
    circle(WW * 0.5, baseY + 44, 90, '#7ccd66');
    R(0, baseY - 12, WW, HH - baseY + 12, GRASS);
  }
  function road(top, bottom, dashY, off = 0) {
    R(0, top, WW, bottom - top, ROAD);
    R(0, top, WW, 3, '#bdb8ac'); R(0, top + 3, WW, 1, '#8f8b80');
    for (let x = -((off % 20) + 20) % 20 - 20; x < WW; x += 20) R(x, dashY, 10, 2, '#ffd21f');
  }
  // Lay out a house's windows: [{x, y, w, h, f, c}], door column on the ground floor.
  function houseWins(hx, base, hw, nF) {
    const cols = Math.max(2, Math.floor((hw - 4) / 28)), gap = Math.floor((hw - cols * 18) / (cols + 1));
    const wins = [];
    for (let f = 0; f < nF; f++) for (let c = 0; c < cols; c++) {
      if (f === 0 && c === 0) continue;   // the door
      wins.push({ x: hx + gap + c * (18 + gap), y: base - (f + 1) * 30 + 8, w: 18, h: 14, f, c });
    }
    return { wins, door: { x: hx + gap - 1, w: 20 }, cols };
  }
  function drawHouse(hx, base, hw, nF, wall, fireWin, burnt) {
    const top = base - nF * 30;
    R(hx + hw - 24, top - 24, 8, 20, '#8e3b2a');
    for (let k = 0; k * 8 < hw + 8; k++) R(hx - 5 + k * 4, top - 2 - k * 2, hw + 10 - k * 8, 2, k % 2 ? '#a3473a' : '#b5523b');
    R(hx - 6, top - 2, hw + 12, 2, '#7a2f24');
    R(hx, top, hw, base - top, wall);
    alpha(0.15, () => { R(hx, top, 3, base - top, '#000000'); R(hx + hw - 3, top, 3, base - top, '#000000'); });
    const { wins, door } = houseWins(hx, base, hw, nF);
    R(door.x - 1, base - 25, door.w + 2, 25, '#ffffff'); R(door.x, base - 24, door.w, 24, '#8a5a3a');
    R(door.x + 3, base - 21, door.w - 6, 7, '#9c6a48'); R(door.x + door.w - 4, base - 12, 2, 2, '#ffd21f');
    for (const w of wins) {
      R(w.x - 2, w.y - 2, w.w + 4, w.h + 4, '#ffffff');
      if (w === fireWin) { R(w.x, w.y, w.w, w.h, burnt ? '#6b5a5a' : '#ffb347'); if (burnt) alpha(0.4, () => R(w.x - 2, w.y - 8, w.w + 4, 6, '#3a3d46')); continue; }
      R(w.x, w.y, w.w, w.h, GLASS); R(w.x + 2, w.y + 2, 3, 2, '#ffffff'); R(w.x + 8, w.y, 2, w.h, '#ffffff');
    }
    R(hx - 2, base - 2, hw + 4, 2, '#8a8f99');
    return top;
  }
  function fireIn(w, size, seed) {
    if (size <= 0) return;
    alpha(0.3 * size, () => circle(w.x + w.w / 2, w.y + w.h / 2, 14, '#ff9a3a'));
    R(w.x, w.y, w.w, w.h, Math.floor(T * 8 + seed) % 2 ? '#ffb347' : '#ff9a3a');
    flame(w.x + w.w / 2, w.y + w.h, 0.2 + size, seed);
  }
  function smoke(x, y, n = 1) {
    for (let i = 0; i < n; i++) parts.push({ x: x + rand(-4, 4), y, vx: rand(2, 8), vy: rand(-16, -10), g: 0, life: 1.4, max: 1.4, s: 3, c: Math.random() < 0.5 ? '#8d9099' : '#a9acb4' });
  }
  function exhaust(x, y) { parts.push({ x, y, vx: -14, vy: -12, g: 0, life: 0.6, max: 0.6, s: 2, c: '#c9ccd3' }); }
  function dust(x, y, n) { spawn(n, i => ({ x: x + rand(-3, 3), y, vx: (i % 2 ? 1 : -1) * rand(10, 30), vy: rand(-12, -3), g: 10, life: 0.7, max: 0.7, s: 2, c: '#cdbfa8' })); }
  function stream(nx, ny, tx, ty) {
    const cx = (nx + tx) / 2, cy = Math.min(ny, ty) - 14 - Math.abs(tx - nx) * 0.15;
    const n = Math.max(14, Math.floor(Math.hypot(tx - nx, ty - ny) / 1.5));
    for (let i = 0; i <= n; i++) {
      const s = i / n, q = 1 - s;
      const px = q * q * nx + 2 * q * s * cx + s * s * tx, py = q * q * ny + 2 * q * s * cy + s * s * ty;
      R(px - 1, py - 1, 3, 3, '#4fb2f0');
      R(px, py, 1, 1, (i + Math.floor(T * 30)) % 3 ? '#9fdcff' : '#ffffff');
    }
  }
  function beacon(x, y, on, r = 3) {
    R(x - r, y - r, r * 2 + 1, r * 2 + 1, on ? RED_ON : RED_OFF);
    if (on) { alpha(0.3, () => circle(x, y, r * 4, RED_ON)); alpha(0.5, () => circle(x, y, r * 2, '#ff7a6b')); }
  }
  // Person drawn into a little sprite and scaled (for the low-angle ladder shot).
  function personScaled(o, cx, yb, s, cat) {
    spG.clearRect(0, 0, sp.width, sp.height);
    const prev = g; g = spG;
    drawPerson(Object.assign({ x: 12, yb: 38 }, o));
    if (cat) drawCat(18, 30, 1);
    g = prev;
    g.imageSmoothingEnabled = false;
    g.drawImage(sp, Math.round(cx - 12 * s), Math.round(yb - 38 * s), Math.round(28 * s), Math.round(40 * s));
  }

  /* ---------- 1 + 3: the station cut open ---------- */
  function geoA() {
    const gy = HH - Math.max(4, SB + 3);
    const bw = WW <= 140 ? WW + 2 : Math.min(WW - 40, 240), bx = Math.floor((WW - bw) / 2);
    const gTop = gy - 54, fy = gTop - 5;
    const rh = clamp(fy - ST - 40, 46, 80), rTop = fy - rh;
    const poleX = bx + 11, inL = poleX + 8, inR = bx + bw - 5;
    return { gy, bw, bx, gTop, fy, rh, rTop, poleX, tx: Math.floor((inL + inR) / 2 - 33), couchX: poleX + 9, tableX: bx + bw - 34, towerX: Math.floor(bx + bw * 0.6) };
  }
  function drawCutaway(G, alarm) {
    const { gy, bw, bx, gTop, fy, rh, rTop, poleX } = G;
    land(gy);
    if (bw < WW) { drawTree(bx - 26, gy, 13); drawTree(bx + bw + 26, gy, 12); }
    // bell tower on the roof
    const tx = G.towerX, tt = rTop - 30;
    R(tx - 14, tt - 6, 28, 3, TRIM); R(tx - 10, tt - 9, 20, 3, TRIM); R(tx - 5, tt - 12, 10, 3, TRIM);
    R(tx - 12, tt - 3, 24, 28, BRICK); R(tx - 8, tt + 2, 16, 16, DARK);
    const sw = alarm ? Math.round(Math.sin(T * 20) * 2) : 0;
    R(tx - 4 + sw, tt + 4, 8, 2, '#ffd21f'); R(tx - 5 + sw, tt + 6, 10, 6, '#ffd21f'); R(tx - 6 + sw, tt + 12, 12, 2, '#e0a81a');
    // walls
    R(bx, rTop - 5, bw, gy - rTop + 5, BRICK); mortar(bx, rTop - 5, bw, gy - rTop + 5);
    R(bx - 3, rTop - 8, bw + 6, 4, TRIM);
    // crew room
    const x0 = bx + 4, x1 = bx + bw - 4;
    R(x0, rTop, x1 - x0, rh, '#f3e2c3'); R(x0, fy - 10, x1 - x0, 10, '#e2c99e'); R(x0, fy - 11, x1 - x0, 1, '#cdb184');
    const wx = Math.floor((G.couchX + 34 + G.tableX) / 2) - 9;
    if (G.tableX - G.couchX > 56) { R(wx - 1, rTop + 7, 20, 16, '#ffffff'); R(wx, rTop + 8, 18, 14, mix('#8fd6ff', '#141a45', nightK())); R(wx + 9, rTop + 8, 1, 14, '#ffffff'); }
    for (let k = 0; k < 2; k++) { const hx = G.tableX + 4 + k * 10; R(hx + 2, rTop + 6, 1, 2, '#5a5f6e'); R(hx, rTop + 8, 6, 3, '#e8222b'); R(hx - 1, rTop + 10, 8, 1, '#e8222b'); }
    const lx = Math.floor((x0 + x1) / 2); R(lx, rTop, 1, 4, '#5a5f6e'); R(lx - 3, rTop + 4, 7, 2, '#ffe873');
    // couch, TV-free: a cosy couch and a little table with soup
    const cx = G.couchX;
    R(cx, fy - 20, 5, 20, '#a8403d'); R(cx, fy - 9, 34, 6, '#c0504d'); R(cx, fy - 9, 34, 1, '#d8706d'); R(cx + 30, fy - 13, 5, 10, '#a8403d'); R(cx + 2, fy - 3, 2, 3, '#6b2a28'); R(cx + 31, fy - 3, 2, 3, '#6b2a28');
    const tb = G.tableX;
    R(tb, fy - 15, 26, 3, '#a8703f'); R(tb + 2, fy - 12, 2, 12, '#8a5a3a'); R(tb + 22, fy - 12, 2, 12, '#8a5a3a');
    R(tb + 3, fy - 18, 8, 3, '#f4f7fb'); R(tb + 4, fy - 19, 6, 1, '#f57a12'); R(tb + 16, fy - 21, 5, 6, '#ffffff'); R(tb + 16, fy - 18, 5, 2, '#2a6fe0');
    R(tb - 9, fy - 9, 9, 2, '#8a5a3a'); R(tb - 8, fy - 7, 1, 7, '#6b4a2e'); R(tb - 2, fy - 7, 1, 7, '#6b4a2e');
    // floor between, with the pole hole
    R(bx, fy, bw, 5, '#8a5a3a'); R(poleX - 4, fy, 8, 5, '#2a2530');
    // garage
    R(x0, gTop, x1 - x0, gy - gTop, DARK); R(x0, gTop + 8, x1 - x0, 1, '#463f50'); R(x0, gTop + 22, x1 - x0, 1, '#463f50');
    R(bx, gy - 3, bw, 3, '#57505f');
    const gl = Math.floor((G.tx + 33)); R(gl - 4, gTop, 9, 2, '#fffbe0');
    // pole
    R(poleX - 1, rTop, 2, gy - rTop - 3, '#e0b010'); R(poleX - 1, rTop, 1, gy - rTop - 3, '#fff3a6');
    // alarm beacons are drawn lit; their housings here
    R(x1 - 7, rTop + 3, 5, 3, '#5a5f6e'); R(x1 - 7, gTop + 3, 5, 3, '#5a5f6e');
  }
  function litCutaway(G, alarm) {
    const on = alarm && Math.floor(T * 6) % 2 === 0;
    const x1 = G.bx + G.bw - 4;
    alpha(nightK() > 0.3 ? 0.25 : 0.12, () => circle(Math.floor(G.bx + G.bw / 2), G.rTop + 10, 14, '#fff3a6'));
    if (alarm) { beacon(x1 - 5, G.rTop + 8, on, 2); beacon(x1 - 5, G.gTop + 8, !on, 2); }
  }
  // a firefighter's path in the cutaway: sit → run to pole → slide → run to the cab → hop in
  function crewPath(G, who, u, s) {
    const seatX = who ? G.tableX - 4 : G.couchX + 12, poleX = G.poleX + 4, cabX = G.tx + (who ? 44 : 54);
    const run = (a, b, k) => lerp(a, b, k);
    if (u < s.go) return who ? { x: seatX, yb: G.fy - 8, pose: 'eat', dir: 1 } : { x: seatX, yb: G.fy - 8, pose: 'sit', dir: 1 };
    if (u < s.pole) return { x: run(seatX, poleX, k01(u, s.go, s.pole)), yb: G.fy, pose: 'stand', dir: -1, walk: true };
    if (u < s.land) { const k = k01(u, s.pole, s.land); return { x: poleX, yb: lerp(G.fy, G.gy - 2, k * k), pose: 'slide', dir: -1 }; }
    if (u < s.land + 0.15) return { x: poleX, yb: G.gy - 2, pose: 'stand', dir: 1 };
    if (u < s.cab) return { x: run(poleX, cabX, k01(u, s.land + 0.15, s.cab)), yb: G.gy - 2, pose: 'stand', dir: 1, walk: true };
    if (u < s.cab + 0.3) { const k = k01(u, s.cab, s.cab + 0.3); return { x: cabX, yb: G.gy - 2, hop: Math.sin(k * Math.PI) * 9, pose: 'wave', dir: 1, fade: 1 - k }; }
    return null;
  }
  const PATH1 = [{ go: 0, pole: 0.15, land: 0.75, cab: 1.35 }, { go: 0, pole: 0.55, land: 1.2, cab: 1.85 }];
  function worldA(u, G, action) {
    drawCutaway(G, action);
    let inCab = 0;
    const crew = [0, 1].map(who => {
      const p = action ? crewPath(G, who, u, PATH1[who]) : (who ? { x: G.tableX - 4, yb: G.fy - 8, pose: 'eat', dir: 1 } : { x: G.couchX + 12, yb: G.fy - 8, pose: 'sit', dir: 1 });
      if (!p) inCab++;
      return p;
    });
    truck(G.tx, G.gy - 2, action && u > 1.9);
    crewInCab(G.tx, G.gy - 2, inCab);
    crew.forEach((p, who) => {
      if (!p) return;
      const d = () => person('ff', p.x, p.yb, { pose: p.pose, dir: p.dir, walk: p.walk, hop: p.hop || 0, skin: who ? FF2 : FF1, seed: who * 2 });
      p.fade != null ? alpha(p.fade, d) : d();
    });
    if (!action && Math.random() < 0.05) parts.push({ x: G.tableX + 18, y: G.fy - 22, vx: rand(-2, 2), vy: -8, g: 0, life: 1, max: 1, s: 2, c: '#ffffff' });
  }

  /* ---------- 2: the bell ---------- */
  function worldBell(u) {
    R(0, 0, WW, HH, BRICK); mortar(0, 0, WW, HH);
    const cx = Math.floor(WW / 2), top = Math.floor(HH / 2) - 18;
    // arch with sky behind the bell
    R(cx - 24, top - 10, 48, 50, TRIM); R(cx - 22, top - 8, 44, 48, mix('#8fd6ff', '#141a45', nightK()));
    circle(cx, top - 8, 22, TRIM); circle(cx, top - 8, 20, mix('#8fd6ff', '#141a45', nightK()));
    R(cx - 22, top + 36, 44, 4, TRIM);
    R(cx - 26, top - 4, 52, 4, '#6b4a2e'); R(cx - 2, top, 4, 3, '#6b4a2e');
    const ring = u < 1.6;
    const th = ring ? Math.sin(u * 16) * 0.35 * (1 - u / 2) : 0;
    for (let y = 0; y < 24; y++) {
      const hw = 5 + y * 0.32 + (y > 16 ? (y - 16) * 1.0 : 0), dx = Math.round(y * th);
      R(cx - hw + dx, top + 3 + y, hw * 2, 1, '#ffd21f');
      R(cx + hw - 3 + dx, top + 3 + y, 3, 1, '#e0a81a');
      R(cx - hw + 2 + dx, top + 3 + y, 2, 1, '#fff3a6');
    }
    const dx = Math.round(26 * th);
    R(cx - 15 + dx, top + 26, 30, 2, '#c99410');
    circle(cx - Math.round(26 * th * 1.6) + dx, top + 30, 3, '#8a6a20');
    if (ring) {   // ding lines
      const ph = Math.floor(u * 8) % 2;
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const x = cx + s * (22 + k * 4 + ph), y = top + 8 + k * 5;
        R(x, y, 2, 3, '#fff6e0'); R(x + s * 2, y + 3, 2, 3, '#fff6e0');
      }
    }
    R(4, 4, 7, 4, '#5a5f6e'); R(WW - 11, 4, 7, 4, '#5a5f6e');
  }
  function litBell(u) {
    const on = Math.floor(T * 6) % 2 === 0;
    beacon(7, 11, on, 2); beacon(WW - 8, 11, !on, 2);
  }

  /* ---------- 4: boots ---------- */
  function boot(x, y, side) {
    R(x - 4, y - 46, 11, 36, side ? '#b8923a' : '#c9a24a');
    R(x - 4, y - 24, 11, 2, '#e9f56b'); R(x - 4, y - 19, 11, 2, '#cfd6dd');
    R(x - 5, y - 11, 13, 9, INK); R(x + 7, y - 7, 6, 5, INK);
    R(x - 5, y - 11, 13, 1, '#e9f56b'); R(x - 4, y - 9, 2, 5, '#4a4d5a');
    R(x - 5, y - 2, 19, 2, '#5a3a22');
  }
  function geoBoot() {
    const gy = HH - Math.max(6, SB + 4) - Math.floor(Math.max(0, HH - 80) * 0.3);
    return { gy, poleX: Math.floor(WW * 0.32), bx: Math.floor(WW * 0.32) + 10 };
  }
  function worldBoot(u, G) {
    R(0, 0, WW, G.gy, DARK); R(0, G.gy - 30, WW, 1, '#463f50'); R(0, G.gy - 60, WW, 1, '#463f50');
    R(0, G.gy, WW, HH - G.gy, '#57505f'); R(0, G.gy, WW, 2, '#6b6475');
    for (let x = 6; x < WW; x += 22) R(x, G.gy + 6, 8, 1, '#4a4452');
    // the truck's big front wheel at the right
    const wx = WW - 10;
    R(wx - 30, G.gy - 46, 40, 30, COLOR[V[VI.fire].color].c[1]); R(wx - 30, G.gy - 20, 40, 2, '#f4f7fb');
    circle(wx, G.gy - 13, 15, WELL); wheel(wx, G.gy - 13, 13, 0);
    R(G.poleX - 2, 0, 4, G.gy, '#e0b010'); R(G.poleX - 2, 0, 1, G.gy, '#fff3a6');
    // two firefighters whoosh down the pole, land with a puff of dust, cheer and run for the truck
    for (const [i, a, b] of [[0, 0, 0.32], [1, 0.3, 0.62]]) {
      const k = k01(u, a, b), landed = u >= b;
      if (u < a) continue;
      const run = landed ? Math.min(1, (u - b) / 0.3) : 0;
      const yb = landed ? G.gy : lerp(G.gy - 60, G.gy, k * k);
      const x = G.poleX + 5 + run * 24;
      drawPerson({ type: 'ff', x, yb, dir: landed ? 1 : -1, pose: landed ? (run < 0.25 ? 'cheer' : 'stand') : 'slide',
        walk: landed && run >= 0.25, skin: SKIN[i ? 2 : 0], seed: i * 3 });
      if (landed && u - b < 0.18) {
        const d = (u - b) / 0.18;
        alpha(1 - d, () => { R(x - 9 - d * 6, G.gy - 3, 4, 3, '#cfc8bd'); R(x + 6 + d * 6, G.gy - 3, 4, 3, '#cfc8bd'); R(x - 4, G.gy - 5 - d * 4, 3, 2, '#e6e0d6'); });
      }
    }
  }

  /* ---------- 5 + 13: the station from the street ---------- */
  function geoS() {
    const botY = HH - Math.max(3, SB + 2), laneY = botY - 7, roadTop = laneY - 22;
    const cx = Math.floor(WW / 2), bayW = 78, bayH = 50, bx = cx - 39, floorY = roadTop, bayTop = floorY - bayH;
    const signTop = bayTop - 16, upH = clamp(signTop - ST - 46, 34, 56), top = signTop - upH;
    return { botY, laneY, roadTop, floorY, cx, bayW, bayH, bx, bayTop, signTop, upH, top, x0: bx - 24, x1: bx + bayW + 14, tx: cx - 33 };
  }
  function stationFront(G, ffWave) {
    land(G.floorY);
    const { cx, x0, x1, top, floorY } = G;
    if (x0 > 30) { drawTree(x0 - 22, floorY, 12); if (x0 > 110) drawTree(x0 - 80, floorY, 14); }
    if (WW - x1 > 30) { drawTree(x1 + 24, floorY, 13); if (WW - x1 > 110) drawTree(x1 + 84, floorY, 11); }
    // hydrant
    if (WW - x1 > 16) { const hx = x1 + 5; R(hx + 1, floorY - 11, 7, 11, '#e8222b'); R(hx, floorY - 13, 9, 2, '#a3121d'); R(hx - 2, floorY - 8, 13, 3, '#a3121d'); }
    // tower
    const tt = top - 26;
    R(cx - 14, tt - 6, 28, 3, TRIM); R(cx - 10, tt - 9, 20, 3, TRIM); R(cx - 5, tt - 12, 10, 3, TRIM);
    R(cx - 12, tt - 3, 24, 30, BRICK); R(cx - 8, tt + 2, 16, 16, DARK);
    R(cx - 3, tt + 5, 6, 2, '#ffd21f'); R(cx - 4, tt + 7, 8, 5, '#ffd21f'); R(cx - 5, tt + 12, 10, 2, '#e0a81a');
    R(x0, top, x1 - x0, floorY - top, BRICK); mortar(x0, top, x1 - x0, floorY - top);
    R(x0 - 3, top - 4, x1 - x0 + 6, 4, TRIM);
    // upstairs windows (the crew waves from them at the end)
    const wh = Math.min(20, G.upH - 16);
    for (const [i, wx] of [[0, cx - 31], [1, cx + 9]]) {
      const wy = top + 8;
      R(wx - 2, wy - 2, 26, wh + 4, TRIM);
      R(wx, wy, 22, wh, '#f3e2c3');
      if (ffWave) {
        g.save(); g.beginPath(); g.rect(wx, wy, 22, wh); g.clip();
        person('ff', wx + 11, wy + wh + 8, { pose: 'wave', dir: i ? -1 : 1, skin: i ? FF2 : FF1, seed: i * 3 });
        g.restore();
      }
      R(wx + 10, wy, 2, wh, TRIM);
    }
    R(cx - 29, G.signTop + 2, 58, 11, TRIM); R(cx - 28, G.signTop + 3, 56, 9, '#7a1f1f');
    text('FIRE STATION', cx - 23, G.signTop + 5, 1, '#fff6e0');
    R(x0 + 4, floorY - 26, 14, 26, TRIM); R(x0 + 6, floorY - 24, 10, 24, '#6b4a2e'); R(x0 + 14, floorY - 12, 1, 2, '#ffd21f');
    R(G.bx - 2, G.bayTop - 2, G.bayW + 4, G.bayH + 2, TRIM);
    R(G.bx, G.bayTop, G.bayW, G.bayH, DARK); R(G.bx, G.bayTop + 10, G.bayW, 1, '#463f50'); R(G.bx, G.bayTop + 24, G.bayW, 1, '#463f50');
    R(G.bx + G.bayW + 6, G.bayTop - 6, 4, 3, '#3a3d46'); R(G.bx - 10, G.bayTop - 6, 4, 3, '#3a3d46');
  }
  function stationDoor(G, k) {
    const h = Math.round(6 + (G.bayH - 6) * k);
    R(G.bx, G.bayTop, G.bayW, h, '#cdd2d8');
    for (let y = 1; y < h; y += 3) R(G.bx, G.bayTop + y, G.bayW, 1, '#a9b0b8');
    R(G.bx, G.bayTop + h - 2, G.bayW, 2, '#8b939c');
  }
  function streetFront(G) { road(G.roadTop, HH, G.roadTop + 11); }
  function litStation(G) {
    const k = nightK();
    if (k < 0.05) return;
    for (const lx of [G.bx + G.bayW + 8, G.bx - 8]) { alpha(0.5 * k, () => circle(lx, G.bayTop - 3, 4, '#fff3b0')); }
    alpha(0.3 * k, () => R(G.cx - 31, G.top + 8, 62, Math.min(20, G.upH - 16), '#ffe9a0'));
  }
  // shot 5: door rolls up, truck pulls out, siren on, away to the right
  function truck5(u, G) {
    const y0 = G.floorY - 1;
    if (u < 0.95) return { x: G.tx, yb: y0, lit: false };
    if (u < 1.4) return { x: G.tx + (u - 0.95) * 10, yb: lerp(y0, G.laneY, ease(k01(u, 0.95, 1.4))), lit: true };
    const s = u - 1.4;
    return { x: G.tx + 4.5 + 85 * s * s + 10 * s, yb: G.laneY, lit: true };
  }
  // shot 13: home, into the bay, door down
  function truck13(u, G) {
    if (u < 1.2) { const k = k01(u, 0, 1.2); return { x: lerp(-80, G.tx, 1 - (1 - k) * (1 - k)), yb: G.laneY, lit: false }; }
    return { x: G.tx, yb: lerp(G.laneY, G.floorY - 1, ease(k01(u, 1.2, 1.6))), lit: false };
  }

  /* ---------- 6: light bar + wheels close-up, racing ---------- */
  function geoBar() {
    const laneY = HH - Math.max(3, SB + 2) - 3;
    return { laneY, tx: WW >= 80 ? Math.floor((WW - 66) / 2) : WW - 68 };
  }
  function worldBar(u, G) {
    const off = T * 260;
    const baseY = G.laneY - 26;
    // houses flashing past
    const cols = ['#f2d16b', '#9ad0f5', '#f5a3c7', '#b6e3a1', '#f0b27a', '#c9b6f2'];
    R(0, baseY - 6, WW, 8, GRASS);
    for (let i = -1; i < WW / 34 + 2; i++) {
      const n = Math.floor(off / 34) + i, x = Math.floor(i * 34 - (off % 34));
      const hgt = 26 + (n * 7 % 3) * 8 + Math.max(0, Math.floor((baseY - ST - 60) * 0.6));
      R(x, baseY - hgt, 26, hgt, cols[((n % 6) + 6) % 6]);
      R(x + 6, baseY - hgt + 6, 6, 6, GLASS); R(x + 15, baseY - hgt + 6, 6, 6, GLASS);
      if (n % 3 === 0) { circle(x + 31, baseY - 14, 6, '#3f9a45'); R(x + 30, baseY - 8, 2, 6, '#7a4a2a'); }
    }
    road(baseY, HH, baseY + 6, off);
    const bob = Math.floor(T * 12) % 2 ? 0 : -1;
    truck(G.tx, G.laneY, true, bob, T * 22);
    crewInCab(G.tx, G.laneY + bob, 2);
    // speed lines
    for (let k = 0; k < 4; k++) { const y = G.laneY - 30 + k * 8, x = (G.tx - 8 - ((T * 300 + k * 37) % 50)); R(x, y, 12, 1, '#ffffff'); }
  }

  /* ---------- 7: bird's-eye view of the town ---------- */
  function geoTop() {
    const vert = HH > WW * 1.2;
    const along = vert ? HH : WW, across = vert ? WW : HH;
    return { vert, along, across, mid: Math.floor(across / 2), lead: Math.floor(along * 0.28) };
  }
  function truckA7(u) { return 20 + 115 * u; }
  function topRect(G, cam, a, b, la, lb, c) {
    if (G.vert) R(G.mid + b, G.along - (a - cam) - la, lb, la, c);
    else R(a - cam, G.mid + b, la, lb, c);
  }
  function topCircle(G, cam, a, b, r, c) {
    if (G.vert) circle(G.mid + b, G.along - (a - cam), r, c); else circle(a - cam, G.mid + b, r, c);
  }
  const ROOFS = [['#c0504d', '#a8403d'], ['#5a7fc0', '#46669e'], ['#8a5a3a', '#6b4a2e'], ['#3fb4a8', '#2f948a'], ['#d08a3a', '#b0702a']];
  function worldTop(u, G) {
    const ta = truckA7(u), cam = ta - G.lead;
    R(0, 0, WW, HH, '#7cc96a');
    const P = (a, b, la, lb, c) => topRect(G, cam, a, b, la, lb, c);
    const aMin = Math.floor((cam - 120) / 120) * 120, aMax = cam + G.along + 120;
    // cross streets
    for (let a = aMin; a < aMax; a += 120) { P(a + 80, -400, 24, 800, ROAD); P(a + 80, -400, 1, 800, '#bdb8ac'); P(a + 103, -400, 1, 800, '#bdb8ac'); }
    // main street with sidewalks
    P(cam - 50, -19, G.along + 100, 38, '#cfc8b8');
    P(cam - 50, -15, G.along + 100, 30, ROAD);
    for (let a = Math.floor(cam / 16) * 16 - 16; a < cam + G.along + 16; a += 16) P(a, -1, 8, 2, '#ffd21f');
    // houses and trees on the blocks
    for (let a = aMin; a < aMax; a += 120) for (const side of [-1, 1]) for (let row = 0; row * 50 + 22 < G.across / 2 + 30; row++) {
      for (let j = 0; j < 2; j++) {
        const n = Math.abs(Math.round(a / 120)) * 7 + j * 3 + row * 5 + (side > 0 ? 1 : 0);
        const ha = a + 6 + j * 38, hb = side > 0 ? 24 + row * 50 : -24 - row * 50 - 28;
        const [rc, rd] = ROOFS[n % ROOFS.length];
        if (n % 4 === 3) { topCircle(G, cam, ha + 16, hb + 14, 11, '#3f9a45'); topCircle(G, cam, ha + 13, hb + 11, 6, '#5bb85a'); continue; }
        P(ha, hb, 32, 28, rc); P(ha, hb + 13, 32, 2, rd); P(ha, hb, 32, 1, rd);
        P(ha + 22, hb + 4, 5, 5, '#8e3b2a');
      }
      topCircle(G, cam, a + 82 + 30, side * (34 + row * 50), 6, '#3f9a45');
    }
    // car pulling over to the curb ahead
    if (car) { const c = COLOR.blue.c; P(car.a, car.b - 5, 18, 10, c[1]); P(car.a + 12, car.b - 4, 3, 8, GLASS); P(car.a + 3, car.b - 4, 3, 8, GLASS); P(car.a, car.b - 5, 18, 1, c[0]); }
    // the truck from above
    const c = COLOR[V[VI.fire].color].c, b = -4, ph = Math.floor(T * 7) % 2;
    alpha(0.25, () => P(ta + 2, b - 9, 66, 21, '#000000'));
    P(ta, b - 10, 66, 20, c[1]); P(ta, b - 10, 66, 1, c[0]); P(ta, b + 9, 66, 1, c[2]);
    P(ta + 48, b - 10, 18, 20, c[0]); P(ta + 61, b - 8, 3, 16, GLASS);
    for (let i = 0; i < 11; i++) P(ta + 4 + i * 4, b - 5, 1, 10, '#d5dce3');
    P(ta + 4, b - 5, 42, 1, '#d5dce3'); P(ta + 4, b + 4, 42, 1, '#d5dce3');
    P(ta + 52, b - 8, 3, 7, ph ? RED_OFF : RED_ON); P(ta + 52, b + 1, 3, 7, ph ? RED_ON : RED_OFF);
    P(ta + 1, b - 7, 2, 14, '#e9eef2');
    return { ta, cam, b };
  }
  function litTop(u, G) {
    const ta = truckA7(u), cam = ta - G.lead, ph = Math.floor(T * 7) % 2;
    const a = ta + 53, b = -4 + (ph ? 4 : -4);
    const [x, y] = G.vert ? [G.mid + b, G.along - (a - cam)] : [a - cam, G.mid + b];
    alpha(0.35, () => circle(x, y, 7, RED_ON));
  }

  /* ---------- 8: head-on ---------- */
  // A fire truck seen from the front, s pixels per unit, centered on cx with its wheels on by.
  function truckFront(cx, by, s, lit) {
    const c = COLOR[V[VI.fire].color].c, ph = Math.floor(T * 7) % 2;
    const F = (dx, dy, w, h, col) => {
      const x0 = Math.floor(cx + dx * s), y0 = Math.floor(by + dy * s);
      g.fillStyle = col; g.fillRect(x0, y0, Math.max(1, Math.floor(cx + (dx + w) * s) - x0), Math.max(1, Math.floor(by + (dy + h) * s) - y0));
    };
    F(-21, -9, 8, 9, TIRE); F(13, -9, 8, 9, TIRE);
    F(-22, -32, 44, 22, c[1]); F(-22, -32, 44, 2, c[0]); F(-22, -12, 44, 2, c[2]);
    F(-20, -52, 40, 21, c[1]); F(-20, -52, 40, 2, c[0]);
    F(-17, -48, 34, 13, GLASS); F(-16, -47, 6, 2, '#ffffff'); F(-1, -48, 2, 13, c[2]);
    // two firefighters in the cab
    F(-11, -43, 7, 8, FF1); F(-12, -46, 9, 4, '#e8222b'); F(-10, -41, 1, 1, INK); F(-6, -41, 1, 1, INK); F(-9, -38, 3, 1, '#a3121d');
    F(5, -43, 7, 8, FF2); F(4, -46, 9, 4, '#e8222b'); F(6, -41, 1, 1, INK); F(10, -41, 1, 1, INK); F(7, -38, 3, 1, '#a3121d');
    F(-17, -56, 34, 4, '#444a55');
    F(-16, -56, 12, 3, lit && !ph ? RED_ON : RED_OFF); F(4, -56, 12, 3, lit && ph ? RED_ON : RED_OFF); F(-3, -56, 6, 3, '#ffffff');
    F(-10, -29, 20, 14, CHROME); for (let k = 0; k < 5; k++) F(-9, -27 + k * 3, 18, 1, '#8b96a1');
    F(-20, -28, 8, 7, '#fff6b0'); F(12, -28, 8, 7, '#fff6b0'); F(-19, -27, 3, 3, '#ffffff'); F(13, -27, 3, 3, '#ffffff');
    F(-23, -14, 46, 5, CHROME); F(-5, -13, 10, 3, '#ffd21f');
    F(-24, -46, 3, 6, '#2f3240'); F(21, -46, 3, 6, '#2f3240');
  }
  function geoHead() { const hy = Math.floor(HH * 0.42); return { hy, vx: Math.floor(WW / 2) }; }
  function headScale(u) { const k = k01(u, 0, 1.9); return 0.2 + 3.6 * Math.pow(k, 2.4); }
  function worldHead(u, G) {
    const { hy, vx } = G, depth = HH - hy;
    R(0, hy - 10, WW, 12, '#8fd877'); circle(vx - WW * 0.3, hy + 4, 18, '#8fd877'); circle(vx + WW * 0.35, hy + 6, 22, '#8fd877');
    R(0, hy, WW, HH - hy, GRASS);
    for (let y = hy; y < HH; y++) {
      const d = (y - hy + 1) / depth, hw = 3 + d * WW * 0.6, z = 1 / d;
      R(vx - hw, y, hw * 2, 1, ROAD);
      R(vx - hw, y, Math.max(1, d * 4), 1, '#e9eef2'); R(vx + hw - Math.max(1, d * 4), y, Math.max(1, d * 4), 1, '#e9eef2');
      if (Math.floor(z * 1.2 + u * 14) % 2 === 0) R(vx - d * 3, y, Math.max(1, d * 6), 1, '#ffd21f');
    }
    // trees rushing past on both sides
    for (let i = 0; i < 6; i++) {
      const D = ((6 - i) * 1.1 - u * 2.6) % 6.6 + 0.6;
      if (D <= 0.35) continue;
      const d = 1 / (D * 1.6), y = hy + depth * Math.min(1.3, d);
      for (const side of [-1, 1]) {
        const x = vx + side * (6 + d * WW * 0.9), r = Math.max(2, d * 22);
        R(x - r * 0.15, y - r * 1.6, Math.max(1, r * 0.3), r * 1.6, '#7a4a2a');
        circle(x, y - r * 1.8, r, '#3f9a45'); circle(x - r * 0.3, y - r * 2.0, r * 0.55, '#5bb85a');
      }
    }
    const s = headScale(u), by = hy + 4 + s * depth / 3.2;
    truckFront(vx, by, s, true);
  }
  function litHead(u, G) {
    const s = headScale(u), by = G.hy + 4 + s * (HH - G.hy) / 3.2, ph = Math.floor(T * 7) % 2;
    alpha(0.35, () => { circle(G.vx - 16 * s, by - 25 * s, Math.max(2, 6 * s), '#fff3b0'); circle(G.vx + 16 * s, by - 25 * s, Math.max(2, 6 * s), '#fff3b0'); });
    alpha(0.3, () => circle(G.vx + (ph ? 10 : -10) * s, by - 55 * s, Math.max(3, 8 * s), RED_ON));
  }

  /* ---------- 9: the house, wide ---------- */
  function geoH() {
    const botY = HH - Math.max(3, SB + 2);
    const fgH = clamp(Math.floor((HH - 220) * 0.35), 0, 70);
    const roadBot = botY - fgH, laneY = roadBot - 5, roadTop = laneY - 24, base = roadTop - 4;
    const nF = clamp(Math.floor((base - ST - 110) / 30), 2, 4);
    const hw = clamp(WW - 112, 72, 100);
    const famSide = WW - (66 + 28 + hw) >= 70;
    const group = 66 + 28 + hw + (famSide ? 56 : 0);
    const x0 = Math.floor(Math.max(SL + 4, (WW - group) / 2));
    const hx = x0 + 94, top = base - nF * 30;
    const { wins } = houseWins(hx, base, hw, nF);
    const fire = wins.filter(w => w.f === nF - 1).pop();
    return { botY, fgH, roadBot, laneY, roadTop, base, nF, hw, famSide, x0, hx, top, fire, tx: x0,
      famX: famSide ? hx + hw + 30 : Math.floor(hx + hw / 2) - 4, famY: famSide ? base + 2 : Math.min(botY - 1, roadBot + Math.max(24, Math.floor(fgH * 0.6))),
      kitty: { x: hx + 10, y: top - 6 } };
  }
  function family(G, mood, kitty) {
    const ph = Math.floor(T * 4) % 2, cheer = mood === 'cheer';
    const hop = s => cheer ? Math.abs(Math.sin(T * 7 + s)) * 4 : 0;
    person('mom', G.famX - 16, G.famY, { pose: cheer ? 'cheer' : 'stand', dir: -1, skin: SKIN[1], seed: 1, hop: hop(0) });
    person('dad', G.famX + 16, G.famY, { pose: cheer ? 'cheer' : (mood === 'wave' ? 'wave' : 'stand'), dir: -1, skin: SKIN[3], seed: 2, hop: hop(1) });
    person('kid', G.famX, G.famY + 1, { pose: kitty ? 'carry' : (mood === 'stand' ? 'stand' : 'wave'), dir: -1, skin: SKIN[1], seed: 3, hop: hop(2) });
    if (kitty) drawCat(G.famX - 6, G.famY - 6 - hop(2), -1);
    return ph;
  }
  function worldHouse(u, G) {
    // a pale row of town behind, taller when the screen is tall
    const extra = Math.max(0, Math.floor((G.top - ST - 90) * 0.6));
    const town = ['#f2d16b', '#f5a3c7', '#b6e3a1', '#c9b6f2', '#f0b27a'];
    for (let x = -10, n = 0; x < WW; x += 34, n++) {
      const h = 34 + (n * 5 % 4) * 10 + extra;
      R(x, G.base - h, 28, h, mix(town[n % town.length], '#d6eefc', 0.45));
      for (let y = G.base - h + 6; y < G.base - 20; y += 14) { R(x + 5, y, 6, 6, '#e3f3fc'); R(x + 17, y, 6, 6, '#e3f3fc'); }
    }
    land(G.base);
    if (G.hx - 30 > 10) drawTree(G.hx - 16, G.base, 14);
    if (G.famSide) drawTree(G.hx + G.hw + 70, G.base, 13);
    drawHouse(G.hx, G.base, G.hw, G.nF, '#9ad0f5', G.fire, false);
    drawCat(G.kitty.x, G.kitty.y, 1);
    road(G.roadTop, G.roadBot, G.roadTop + 10);
    if (G.fgH > 0) {
      R(0, G.roadBot, WW, HH - G.roadBot, GRASS); R(0, G.roadBot, WW, 2, '#bdb8ac');
      for (let x = 6; x < WW; x += 17) { R(x, G.roadBot + 8 + (x % 5) * 3, 2, 2, x % 2 ? '#ff6fb4' : '#ffd21f'); R(x + 1, G.roadBot + 10 + (x % 5) * 3, 1, 2, '#3f9a45'); }
      if (G.fgH > 60) { circle(10, G.botY - 6, 12, '#3f9a45'); circle(WW - 8, G.botY - 4, 14, '#3f9a45'); circle(WW - 14, G.botY - 12, 7, '#5bb85a'); }
    }
    // truck arrives and brakes
    const k = k01(u, 0, 1.2), tx = lerp(-90, G.tx, 1 - (1 - k) * (1 - k) * (1 - k));
    const bob = k < 1 ? (Math.floor(tx / 7) % 2 ? 0 : -1) : 0;
    truck(tx, G.laneY, true, bob, tx / 5);
    crewInCab(tx, G.laneY + bob, u < 1.5 ? 2 : u < 1.8 ? 1 : 0);
    // the crew hops out
    if (u >= 1.5) {
      const k1 = k01(u, 1.5, 2.3);
      person('ff', lerp(G.tx + 58, G.tx + 80, k1), G.laneY + 2, { pose: k1 < 1 ? 'stand' : 'carry', walk: k1 > 0 && k1 < 1, skin: FF1, hop: u < 1.8 ? Math.sin(k01(u, 1.5, 1.8) * Math.PI) * 6 : 0 });
    }
    if (u >= 1.8) person('ff', G.tx - 6 + 8 * k01(u, 1.8, 2.2), G.laneY + 2, { pose: u > 2.4 ? 'wave' : 'stand', skin: FF2, seed: 2, hop: u < 2.1 ? Math.sin(k01(u, 1.8, 2.1) * Math.PI) * 6 : 0 });
    family(G, u > 1.2 ? 'wave' : 'stand', false);
  }
  function litHouse(u, G) {
    fireIn(G.fire, 0.9, 1);
    if (nightK() > 0.3) alpha(0.4 * nightK(), () => R(G.hx + 4, G.base - 26, 12, 4, '#ffe9a0'));
  }

  /* ---------- 10: spraying the fire out ---------- */
  function geoW() {
    const gy = HH - Math.max(3, SB + 2) - Math.floor(Math.max(0, HH - 120) * 0.25);
    const hx = Math.floor(WW * 0.5);
    const nfl = clamp(Math.floor((gy - ST - 40) / 32), 2, 4), roofY = gy - nfl * 32;
    return { gy, hx, nfl, roofY, win: { x: hx + 12, y: roofY + 8, w: 22, h: 18 }, ffx: Math.max(12, hx - 32) };
  }
  const fireSize = u => 1 - k01(u, 0.6, 1.95);
  function worldSpray(u, G) {
    land(G.gy);
    const { hx, roofY, gy, win } = G;
    for (let k = 0; k * 2 < 30; k++) R(hx - 6 + k * 4, roofY - 2 - k * 2, WW - hx + 20, 2, k % 2 ? '#a3473a' : '#b5523b');
    R(hx - 6, roofY - 2, WW, 2, '#7a2f24');
    R(hx, roofY, WW - hx, gy - roofY, '#9ad0f5'); alpha(0.15, () => R(hx, roofY, 3, gy - roofY, '#000000'));
    drawCat(hx + 12, roofY - 8, 1);
    for (let f = 1; f < G.nfl; f++) { const y = roofY + f * 32 + 8; R(win.x - 2, y - 2, 26, 22, '#ffffff'); R(win.x, y, 22, 18, GLASS); R(win.x + 10, y, 2, 18, '#ffffff'); }
    R(win.x - 2, win.y - 2, 26, 22, '#ffffff');
    const out = fireSize(u) <= 0;
    R(win.x, win.y, 22, 18, out ? '#6b5a5a' : '#ffb347');
    if (out) alpha(0.4, () => R(win.x - 2, win.y - 8, 26, 6, '#3a3d46'));
    // firefighter with the hose
    const fx = G.ffx, cheer = u > 2.3;
    R(0, gy - 2, fx - 1, 2, '#3a3d46');
    person('ff', fx + 4, gy, { pose: cheer ? 'cheer' : 'carry', skin: FF1, hop: cheer ? Math.abs(Math.sin(T * 7)) * 4 : 0 });
    if (!cheer) R(fx + 10, gy - 12, 6, 3, '#9aa3ad');
  }
  function litSpray(u, G) {
    const w = G.win, s = fireSize(u);
    fireIn(w, s, 2);
    if (u > 0.3 && u < 2.3) stream(G.ffx + 16, G.gy - 11, w.x + 11, w.y + 10);
  }

  /* ---------- 11: low angle, up the ladder ---------- */
  function geoL() {
    const topY = ST + Math.floor(HH * 0.16) + 8, cx = Math.floor(WW / 2), hb = Math.min(Math.floor(WW * 0.3), 34);
    return { topY, cx, hb, ht: 5 };
  }
  function ladderAt(G, v) {   // v: 0 bottom .. 1 top → [y, halfWidth, scale]
    const sc = q => 1 / (1 + 3 * q), n = (sc(v) - sc(1)) / (sc(0) - sc(1));
    return [G.topY + (HH + 6 - G.topY) * n, G.ht + (G.hb - G.ht) * n, n];
  }
  const climbV = u => 0.04 + 0.82 * ease(k01(u, 0, 1.7));
  function worldLadder(u, G) {
    const { topY, cx } = G;
    // the house wall rushes up to the roof edge on the left, sky everywhere else
    g.fillStyle = '#9ad0f5';
    g.beginPath(); g.moveTo(0, HH); g.lineTo(cx - G.hb - 10, HH); g.lineTo(cx - G.ht - 8, topY); g.lineTo(0, topY - 6); g.closePath(); g.fill();
    g.fillStyle = '#7fb5dc';
    g.beginPath(); g.moveTo(cx - G.hb - 10, HH); g.lineTo(cx - G.hb - 4, HH); g.lineTo(cx - G.ht - 6, topY); g.lineTo(cx - G.ht - 8, topY); g.closePath(); g.fill();
    for (let k = 0; k < 3; k++) {   // windows in perspective
      const [y, hw] = ladderAt(G, 0.12 + k * 0.3), w = Math.max(4, hw * 0.7);
      R(cx - hw - 12 - w * 1.4, y - w, w, w * 0.9, '#ffffff'); R(cx - hw - 11 - w * 1.4, y - w + 1, w - 2, w * 0.9 - 2, GLASS);
    }
    R(0, topY - 8, cx + 14, 4, '#7a2f24'); R(0, topY - 12, cx + 10, 4, '#b5523b');
    // kitty peeking over the roof edge until she jumps
    if (u < 1.85) {
      const kx = cx + 2, ky = topY - 12;
      circle(kx, ky, 5, '#9aa3ad'); R(kx - 5, ky - 7, 2, 4, '#9aa3ad'); R(kx + 4, ky - 7, 2, 4, '#9aa3ad');
      R(kx - 2, ky - 1, 1, 2, INK); R(kx + 2, ky - 1, 1, 2, INK); R(kx, ky + 2, 1, 1, '#ff6fb4');
    }
    // the ladder in perspective
    for (const s of [-1, 1]) {
      g.fillStyle = '#cfd6dd';
      g.beginPath(); g.moveTo(cx + s * G.hb - 3, HH + 6); g.lineTo(cx + s * G.hb + 3, HH + 6); g.lineTo(cx + s * G.ht + 1, topY); g.lineTo(cx + s * G.ht - 1, topY); g.closePath(); g.fill();
    }
    for (let i = 0; i <= 16; i++) { const [y, hw, n] = ladderAt(G, i / 16); R(cx - hw, y, hw * 2, Math.max(1, 3 * n), '#e9eef2'); R(cx - hw, y + Math.max(1, 3 * n), hw * 2, 1, '#8b96a1'); }
    // the firefighter climbing (getting smaller as he goes up)
    const v = climbV(u), [y, , n] = ladderAt(G, v), s = 0.7 + 1.6 * n;
    const got = u > 1.9;
    personScaled({ type: 'ff', pose: got ? 'carry' : 'slide', dir: 1, skin: FF2, seed: 2, walk: !got && u < 1.7 }, cx, y + 4 * s, s, got);
  }

  /* ---------- 12: family reaction close-up ---------- */
  function geoR() {
    const gy = HH > 110 ? Math.round(HH * 0.66) : HH - Math.max(4, SB + 3) - Math.floor(Math.max(0, HH - 90) * 0.3);
    const cx = Math.floor(WW / 2), sp = clamp(Math.floor(WW / 6), 11, 26);
    return { gy, cx, sp };
  }
  function worldReact(u, G) {
    const { gy, cx, sp } = G;
    R(0, 0, WW, gy - 6, '#9ad0f5');
    for (let row = 0; gy - 54 - row * 34 > -20; row++) for (let x = -4; x < WW; x += 30) {
      const y = gy - 54 - row * 34;
      R(x, y, 22, 18, '#ffffff'); R(x + 2, y + 2, 18, 14, GLASS); R(x + 10, y + 2, 2, 14, '#ffffff');
    }
    R(0, gy - 30, WW, 24, '#8fd877'); for (let x = 0; x < WW; x += 14) circle(x + 6, gy - 22, 9, '#3f9a45');
    R(0, gy - 6, WW, HH - gy + 6, GRASS);
    for (let y = gy + 4, r = 0; y < HH; y += 10, r++) for (let x = 4 + (r % 2) * 5; x < WW; x += 11) R(x, y + (x % 3) * 2, 2, 2, (x + r) % 2 ? '#ff6fb4' : '#ffd21f');
    const hop = s => Math.abs(Math.sin(T * 7 + s)) * 3;
    const wide = WW >= 120;
    if (wide) { person('ff', cx - sp * 2.4, gy, { pose: 'wave', skin: FF1, seed: 4 }); person('ff', cx + sp * 2.4, gy, { pose: 'wave', dir: -1, skin: FF2, seed: 5 }); }
    person('mom', cx - sp, gy, { pose: 'cheer', skin: SKIN[1], seed: 1, hop: hop(0) });
    person('dad', cx + sp, gy, { pose: 'cheer', dir: -1, skin: SKIN[3], seed: 2, hop: hop(1) });
    if (!wide) person('ff', cx + 3, gy - 2, { pose: 'wave', dir: -1, skin: FF2, seed: 5 });
    const kh = hop(2) * 0.6;
    person('kid', cx - 2, gy + 2, { pose: 'carry', skin: SKIN[1], seed: 3, hop: kh });
    drawCat(cx + 4, gy - 5 - kh, -1);
  }

  /* ---------- the shots ---------- */
  const GEO = [geoA, () => null, geoA, geoBoot, geoS, geoBar, geoTop, geoHead, geoH, geoW, geoL, geoR, geoS];
  function world(i, u, G) {
    switch (i) {
      case 0: return worldA(u, G, false);
      case 1: return worldBell(u);
      case 2: return worldA(u, G, true);
      case 3: return worldBoot(u, G);
      case 4: { stationFront(G, false); streetFront(G); const p = truck5(u, G); truck(p.x, p.yb, p.lit, 0, p.x / 5, u < 0.6); crewInCab(p.x, p.yb, 2); stationDoor(G, 1 - k01(u, 0.1, 0.9)); return; }
      case 5: return worldBar(u, G);
      case 6: return worldTop(u, G);
      case 7: return worldHead(u, G);
      case 8: return worldHouse(u, G);
      case 9: return worldSpray(u, G);
      case 10: return worldLadder(u, G);
      case 11: return worldReact(u, G);
      case 12: {
        stationFront(G, u > 2.0); streetFront(G);
        const p = truck13(u, G);
        truck(p.x, p.yb, p.lit, 0, p.x / 5, u > 2.0); if (u < 1.7) crewInCab(p.x, p.yb, 2);
        stationDoor(G, k01(u, 1.7, 2.5));
        return;
      }
    }
  }
  function lit(i, u, G) {
    switch (i) {
      case 0: return litCutaway(G, false);
      case 1: return litBell(u);
      case 2: return litCutaway(G, true);
      case 4: return litStation(G);
      case 5: { const ph = Math.floor(T * 7) % 2, y = G.laneY - 32; alpha(0.35, () => circle(G.tx + (ph ? 57 : 50), y, 9, RED_ON)); return; }
      case 6: return litTop(u, G);
      case 7: return litHead(u, G);
      case 8: return litHouse(u, G);
      case 9: return litSpray(u, G);
      case 12: {
        litStation(G);
        if (u > 2.4) {   // the big heart over the door
          const k = k01(u, 2.4, 2.75), s = Math.round((k < 1 ? k * 1.2 : 1 + Math.sin(T * 6) * 0.08) * 7);
          if (s > 0) { heart(G.cx, G.bayTop - 40 + 6, s + 1, '#ffffff'); heart(G.cx, G.bayTop - 40 + 6, s, '#ff4f9a'); R(G.cx - s - 2, G.bayTop - 40 + 2, 2, 2, '#ffd0e4'); }
        }
      }
    }
  }
  function carStep(u, dt) {   // the car ahead pulls over for the fire truck
    const ta = truckA7(u);
    if (!car.over && ta + 66 > car.a - 50) car.over = true;
    car.a += car.v * dt;
    if (car.over) { car.b = Math.min(car.b + dt * 30, 9); car.v = Math.max(0, car.v - dt * 45); }
  }
  function tickShot(i, u, dt, G) {
    if (i === 2 && u > 1.9 && Math.random() < dt * 10) exhaust(G.tx - 1, G.gy - 8);
    if (i === 3) { if (u > 0.25 && once('d1')) dust(G.bx + 4, G.gy - 1, 10); if (u > 0.65 && once('d2')) dust(G.bx + 22, G.gy - 1, 10); }
    if (i === 4 || i === 12) {
      const p = i === 4 ? truck5(u, G) : truck13(u, G);
      if ((i === 4 ? u > 0.95 : u < 1.6) && Math.random() < dt * 12) exhaust(p.x - 1, p.yb - 7);
      if (i === 12 && u > 2.4 && u < 3.4) for (let k = 0; k < 2; k++) parts.push({ x: rand(0, WW), y: -2, vx: rand(-15, 15), vy: rand(30, 60), g: 40, life: 3, max: 3, s: 2, c: PALETTE[Math.random() * 7 | 0][2][1] });
    }
    if (i === 6 && car) carStep(u, dt);
    if (i === 8 && Math.random() < dt * 5) smoke(G.fire.x + G.fire.w / 2, G.fire.y - 4);
    if (i === 9) {
      const s = fireSize(u), w = G.win;
      if (s > 0 && Math.random() < dt * 5 * s + dt) smoke(w.x + 11, w.y - 6);
      if (u > 0.4 && s > 0) spawn(2, () => ({ x: w.x + 11 + rand(-4, 4), y: w.y + 10, vx: rand(-30, 30), vy: rand(-40, -10), g: 200, life: 0.4, max: 0.4, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.5 ? '#6fc8ff' : '#ffffff' }));
      if (u > 1.95 && once('out')) { puff(w.x + 11, w.y + 4, 14); sparkle(w.x + 11, w.y + 8, 16, 12); }
      if (u > 2.0 && Math.random() < dt * 2) parts.push({ x: w.x + 11 + rand(-6, 6), y: w.y, vx: 3, vy: -10, g: 0, life: 1.2, max: 1.2, s: 2, c: '#eef0f4' });
    }
    if (i === 10 && u > 1.9 && Math.random() < dt * 6) { const [y, , n] = ladderAt(G, climbV(u)); addHeart(G.cx + 10, y - 30 * (0.7 + 1.6 * n), false); }
    if (i === 11 && Math.random() < dt * 3) addHeart(G.cx + 6, G.gy - 30, Math.random() < 0.5);
    for (const h of hearts) { h.life -= dt; h.x += h.vx * dt; h.y += h.vy * dt; }
    hearts = hearts.filter(h => h.life > 0);
  }

  /* ---------- render through the zoom buffer ---------- */
  function paint(fn) {
    if (buf.width !== WW || buf.height !== HH) { buf.width = WW; buf.height = HH; } else bufG.clearRect(0, 0, WW, HH);
    const prev = g;
    g = bufG;
    try { fn(); } finally { g = prev; }
    prev.imageSmoothingEnabled = false;
    const s = Z * push, ox = focus[0] * Z - focus[0] * s + shakeX * Z, oy = focus[1] * Z - focus[1] * s + shakeY * Z;
    prev.drawImage(buf, Math.round(ox), Math.round(oy), Math.round(WW * s), Math.round(HH * s));
  }
  function frameState() {
    const i = shotAt(t), sh = SHOTS[i], u = t - sh.t0;
    setZoom(sh);
    const G = GEO[i]();
    // camera moves: shake on the alarm, the siren start and the boots; push-ins on the last two moments
    let sx = 0, sy = 0;
    const jig = () => (Math.floor(T * 30) % 2 ? 1 : -1);
    if (i === 1 && u < 1.2) sx = jig();
    if (i === 3 && ((u > 0.25 && u < 0.4) || (u > 0.65 && u < 0.8))) sy = jig();
    if (i === 4 && u > 0.9 && u < 1.4) sx = jig();
    if (i === 7 && u > 1.4) sx = jig();
    shakeX = sx; shakeY = sy;
    push = 1; focus = [0, 0];
    if (i === 11) { push = 1 + 0.25 * ease(k01(u, 0.2, 2.6)); focus = [G.cx, G.gy - 14]; }
    if (i === 12 && u > 2.4) { push = 1 + 0.35 * ease(k01(u, 2.4, 3.6)); focus = [G.cx, G.bayTop - 34]; }
    return { i, u, G };
  }

  /* ---------- iris between some shots ---------- */
  function irisR() {
    const big = Math.hypot(W, H) / 2 + 6, open = [0, 12.4], close = [12.4];
    let k = 1;
    for (const c of open) if (t >= c && t < c + 0.45) k = Math.min(k, ease((t - c) / 0.45));
    for (const c of close) if (t < c && t > c - 0.4) k = Math.min(k, ease((c - t) / 0.4));
    let r = k * big;
    const ft = SHOTS[12].t0;   // the finale closes onto the heart, holds, then shuts
    if (t > ft + 3.0) r = Math.min(r, t < ft + 3.4 ? lerp(big, 30 * (W / 190), ease(k01(t, ft + 3.0, ft + 3.4))) : lerp(30 * (W / 190), 0, k01(t, ft + 3.55, END)));
    return r;
  }
  function drawIris(r, cx, cy) {
    if (r >= Math.hypot(W, H)) return;
    for (let y = 0; y < H; y++) {
      const dy = y - cy;
      if (Math.abs(dy) >= r) { R(0, y, W, 1, '#1d1a2b'); continue; }
      const hw = Math.sqrt(r * r - dy * dy);
      R(0, y, cx - hw, 1, '#1d1a2b'); R(cx + hw, y, W - cx - hw + 1, 1, '#1d1a2b');
    }
  }

  /* ---------- pause button and draggable timeline (tap anywhere to show them) ---------- */
  function ctl() {
    const b = 26, cy = H - L.safeB - 30, cx = Math.round(W / 2), half = Math.round(Math.min(W - L.safeL - L.safeR - 32, 360) / 2);
    return { play: { x: cx - b / 2, y: cy - b / 2, s: b }, track: { x0: cx - half, x1: cx + half, y: cy - b / 2 - 14 } };
  }
  const tAtX = (c, x) => END * clamp((x - c.track.x0) / (c.track.x1 - c.track.x0), 0, 1);
  function drawControls() {
    const c = ctl(), k = Math.min(1, ctlS.paused ? 1 : ctlS.ui / 0.3);
    if (k <= 0) return;
    alpha(k, () => {
      const { x0, x1, y } = c.track, w = x1 - x0;
      alpha(0.45, () => R(x0 - 6, y - 8, w + 12, 16, '#1d1a2b'));
      R(x0, y - 1, w, 3, '#6a6478');
      for (const s of SHOTS) R(Math.round(x0 + w * s.t0 / END), y - 3, 1, 7, '#cfc8dc');
      const kx = Math.round(x0 + w * Math.min(1, t / END));
      R(x0, y - 1, kx - x0, 3, '#ffd21f'); circle(kx, y, 5, '#ffffff'); circle(kx, y, 3, '#ffd21f');
      const b = c.play, mx = b.x + b.s / 2, my = b.y + b.s / 2;
      alpha(0.55, () => R(b.x, b.y, b.s, b.s, '#1d1a2b'));
      if (ctlS.paused) for (let i = 0; i < 6; i++) R(mx - 3 + i, my - 6 + i, 1, 13 - 2 * i, '#ffffff');
      else { R(mx - 5, my - 6, 4, 13, '#ffffff'); R(mx + 1, my - 6, 4, 13, '#ffffff'); }
    });
  }
  function setPaused(p) {
    if (p === ctlS.paused) return;
    ctlS.paused = p;
    if (p) { resumeLine = ac && ac.currentTime < narrEnd - 0.2 ? lastLine : null; hush(); }   // a line cut off by the pause starts over on play
    else if (resumeLine) { const n = resumeLine; resumeLine = null; narrate(n); }
  }
  // jump to any moment: past cues stay quiet, the siren, hose and music pick up from the clock
  function seek(tt) {
    hush(); resumeLine = null;
    t = clamp(tt, 0, END - 0.05);
    ev = 0; while (ev < EVENTS.length && EVENTS[ev][0] <= t) ev++;
    parts = []; hearts = []; onceSet.clear(); car = null;
    shotI = shotAt(t);
    if (shotI === 6) { car = { a: truckA7(0) + 130, b: -4, v: 50, over: false }; for (let u = 0; u < t - SHOTS[6].t0; u += 1 / 60) carStep(u, 1 / 60); }
  }

  /* ---------- scene ---------- */
  const homeBtn = () => ({ x: L.safeL + 6, y: L.safeT + 6, s: 22 });
  function leave() {
    hush(); resumeLine = null;
    ctlS.paused = false; ctlS.drag = null; ctlS.ui = 0;
  }
  function exit() {
    if (exiting) return;
    exiting = true; leave();
    goScene(SCENES.movies ? 'movies' : 'station', { watched: 'fire' });
  }
  SCENES.movieFire = {
    noWeather: true,   // cutscenes have indoor shots; keep them dry
    view: [186, 200],
    freeTouch: true,
    groundY: () => H,
    get clock() { return t; },   // seconds into the episode (read-only, for tests)
    enter() {
      t = 0; ev = 0; shotI = -1; exiting = false; ranOut = false; hearts = []; taps = []; car = null;
      Object.assign(ctlS, { paused: false, ui: 0, drag: null }); resumeLine = null;
      setClouds(L.safeT + 16, Math.floor(H * 0.3));
      loadNarration(); loadSound();
    },
    leave,
    update(dt) {
      if (exiting) return;
      if (!narrBuf[NARR[0][1]] && ac) loadNarration();   // audio woke up after enter
      loadSound();
      ctlS.ui = Math.max(0, ctlS.ui - dt);
      for (const p of taps) p.life -= dt;
      taps = taps.filter(p => p.life > 0);
      if (ctlS.paused || ctlS.drag != null) { hush(); return; }
      t += dt;
      while (ev < EVENTS.length && EVENTS[ev][0] <= t) EVENTS[ev++][1]();
      const { i, u, G } = frameState();
      if (i !== shotI) {
        shotI = i; parts = []; hearts = []; onceSet.clear();
        if (i === 6) car = { a: truckA7(0) + 130, b: -4, v: 50, over: false };
      }
      musicTick();
      SIREN.set(sirenAt(t) ? 1 : 0);
      HOSE.set(i === 9 && u > 0.3 && u < 2.0 ? 1 : 0);
      CRACKLE.set(i === 8 ? 0.7 : i === 9 ? fireSize(u) : 0);
      ENGINE.set(t > 8.1 && t < 18.8 ? 1 : i === 12 && u < 1.8 ? 0.8 : 0);
      tickShot(i, u, dt, G);
      if (t >= END) { ranOut = true; exit(); }
    },
    tap(x, y, id) {
      if (inBox(homeBtn(), x, y, 6)) { SFX.pop(); window.movieQuit = true; exit(); return true; }
      const c = ctl();
      if (ctlS.paused || ctlS.ui > 0) {
        ctlS.ui = 3.5;
        if (inBox(c.play, x, y, 6)) { setPaused(!ctlS.paused); return true; }
        if (x >= c.track.x0 - 10 && x <= c.track.x1 + 10 && Math.abs(y - c.track.y) <= 14) { ctlS.drag = id; seek(tAtX(c, x)); return true; }
      }
      ctlS.ui = 3.5;
      taps.push({ x, y, life: 0.6 });
      return true;
    },
    move(x, y, id) { if (ctlS.drag === id) { ctlS.ui = 3.5; seek(tAtX(ctl(), x)); } },
    release(id) { if (ctlS.drag === id) { ctlS.drag = null; ctlS.ui = 3.5; } },
    drawWorld() {
      const { i, u, G } = frameState();
      lights = [];
      paint(() => world(i, u, G));
    },
    drawLit() {
      const { i, u, G } = frameState();
      const k = nightK();
      paint(() => {
        if (k > 0.02) for (const d of lights) drawVehicleLights(d, k);
        lit(i, u, G);
        drawParticles();
        drawHearts();
      });
    },
    drawUI() {
      const { i, G } = frameState();
      for (const p of taps) { const a = p.life / 0.6, r = Math.round(3 + (1 - a) * 4); alpha(a, () => { R(p.x - r, p.y, r * 2 + 1, 1, '#fff27a'); R(p.x, p.y - r, 1, r * 2 + 1, '#fff27a'); }); }
      let cx = W / 2, cy = H / 2;
      if (i === 12) { cx = G.cx * Z; cy = (G.bayTop - 34) * Z; }
      drawIris(irisR(), cx, cy);
      // progress bar, thin, along the bottom
      const x0 = L.safeL + 10, x1 = W - L.safeR - 10, y = H - L.safeB - 4;
      alpha(0.35, () => R(x0, y, x1 - x0, 2, '#1d1a2b'));
      alpha(0.8, () => R(x0, y, Math.round((x1 - x0) * clamp(t / END, 0, 1)), 2, '#fff6e0'));
      drawControls();
      drawHomeButton(homeBtn());
    },
    _st: ctlS, _jump(tt) { seek(tt); }, _paused(p) { setPaused(p); },
  };
})();
