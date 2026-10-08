// Cinema: "Ambulance Helps a Friend", a ~33 s watch-only cartoon. A playground bump, a phone
// call, the ambulance races out (low angle, head-on, bird's-eye map), the medics put on a
// colorful bandage, a ride to the hospital and a happy family. Only the home button reacts.
// Optional narration clips audio/movie-amb-01.mp3 … -10.mp3 play at the cues below when present.
'use strict';
(() => {
  const AMB = VI.amb, END = 33.2, BLACK = '#1d1a2b';
  const KID = { type: 'kid', skin: SKIN[1], hair: '#7a3a1a' };
  const MOM = { type: 'mom', skin: SKIN[1] }, DAD = { type: 'dad', skin: SKIN[1], hair: '#2b1d14' };
  const MED = [SKIN[0], SKIN[2]];
  const RED = '#e8222b';
  const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const ph2 = (rate = 7) => Math.floor(T * rate) % 2;

  // camera: world -> screen is (x * z + ox, y * z + oy)
  const cam = { x: 0, y: 0, z: 1, ox: 0, oy: 0, cap: -100 };
  const st = { t: 0, shot: -1, lt: 0, cue: 0, fired: {}, done: false, saved: null, hearts: [], cars: [], puffT: 0, beepT: 0, paused: false, ui: 0, drag: null, ff: false };
  const P = {};   // layout numbers
  const sx = x => cam.ox + x * cam.z, sy = y => cam.oy + y * cam.z;
  const portrait = () => H > W * 1.2;

  /* ---------- narration: optional clips recorded by a parent ---------- */
  const narrBuf = {}, narrSrcs = [];
  let narrEnd = 0;
  function loadNarr(n) {
    if (!narrBuf[n] && ac) {
      const name = 'audio/movie-amb-' + String(n).padStart(2, '0') + '.mp3';
      narrBuf[n] = fetch(name).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
        .then(b => b && new Promise(res => { try { ac.decodeAudioData(b, res, () => res(null)); } catch (e) { res(null); } }));
    }
    return narrBuf[n] || Promise.resolve(null);
  }
  let lastLine = null, resumeLine = null;
  function narr(n, fallback) {
    lastLine = n;
    const run = st.run;
    loadNarr(n).then(buf => {
      if (run !== st.run || scene !== 'movieAmb') return;
      if (!buf) { if (fallback) say(fallback); return; }
      say([]);   // hush any built-in line still talking
      // a line that's still playing finishes first; this one follows right after it
      const when = Math.max(ac.currentTime, narrEnd + 0.12);
      const src = ac.createBufferSource();
      src.buffer = buf; src.connect(voiceOut); src.start(when);
      narrEnd = when + buf.duration;
      duck(narrEnd - ac.currentTime);
      narrSrcs.push(src);
      src.onended = () => { const i = narrSrcs.indexOf(src); if (i >= 0) narrSrcs.splice(i, 1); };
    });
  }
  function stopNarr() { for (const s of narrSrcs.splice(0)) { try { s.stop(); } catch (e) {} } narrEnd = 0; }

  /* ---------- sound track: recorded CC0 clips (the synth plays if a clip is missing) ---------- */
  // (toys.js loads after this file, so the bank is made on first use)
  const SND_FILES = {
    slide: ['rescue-slide', 0.22], thud: ['rescue-thud', 0.4], door: ['rescue-door', 0.3], whoosh: ['mc-swish', 0.3],
    brake: ['trash-air', 0.24], chime: ['mv-chime', 0.5], beep: ['bt-beep', 0.3], applause: ['rescue-applause', 0.4], twinkle: ['mc-twinkle', 0.4],
    click: ['rescue-click', 0.35], start: ['rescue-start', 0.24],
  }, SND_SYNTH = {
    slide() {}, thud() { noise(0, 0.15, 0.18, 300, 1); tone('sine', 200, 0, 0.2, 0.14, 120); }, door() { SFX.door(); }, whoosh() { SFX.whoosh(); },
    brake() { SFX.brake(); }, chime() { SFX.chime(); }, beep() { SFX.beep(); }, applause() { SFX.fanfare(); }, twinkle() { SFX.sunrise(); },
    click() { tone('square', 200, 0, 0.05, 0.06); tone('square', 300, 0.07, 0.05, 0.05); },
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
  // A looping bed (siren, engine) whose level follows the episode clock: set(level) every frame.
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
  const SIREN = bed('rescue-siren-amb', 0.2, (lv, s) => lv > 0 ? s || siren('amb') : (s && s(), null));
  const ENGINE = bed('rescue-engine', 0.14, (lv, s) => { s = s || noiseLoop(110, 0.7); s(lv * 0.12); return s; });
  const sirenAt = t => t >= 9.6 && t < 18.0;
  const rumble = lv => { st.rumbled = true; if (!st.ff) ENGINE.set(lv / 0.12); };   // the shots ask for 0 .. 0.12; a shot that doesn't ask is quiet

  // music: a warm, caring loop in step with the clock (pause and the timeline included)
  const MUSIC = { name: 'rescue-amb-music', vol: 0.16, from: 0.2, buf: null, src: null, gain: null, asked: false };
  function loadSound() {
    if (!ac) return;
    SND.load(); SIREN.load(); ENGINE.load();
    if (!MUSIC.asked) { MUSIC.asked = true; getBuf(MUSIC.name).then(b => { MUSIC.buf = b; }); }
  }
  function stopMusic() { if (MUSIC.src) { try { MUSIC.src.stop(); } catch (e) {} MUSIC.src = null; MUSIC.gain = null; } }
  function musicTick() {
    if (!MUSIC.buf || !ac) return;
    const t = st.t;
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
    const k = seg(t, MUSIC.from, MUSIC.from + 1.2) * clamp01((END - 0.3 - t) / 2.6) * talk * (sirenAt(t) ? 0.8 : 1);
    MUSIC.gain.gain.setTargetAtTime(MUSIC.vol * k, ac.currentTime, 0.08);
  }
  let ranOut = false;   // the episode played to the end: its last chime may ring out
  function hush() {   // every sound off at once (pause, scrub, leaving)
    stopMusic(); if (!ranOut) SND.stop(); SIREN.stop(); ENGINE.stop(); stopNarr();
    if (voiceSrc) say([]);
  }

  /* ---------- cue sheet: sounds and voices by time ---------- */
  function ring(at = 0) { for (let k = 0; k < 8; k++) tone('sine', k % 2 ? 1175 : 1397, at + k * 0.07, 0.07, 0.06); }
  function giggle() { [0, 0.12, 0.24].forEach((s, i) => tone('sine', 880 + i * 120, s, 0.1, 0.08, 1100 + i * 120)); }
  const play = (k, rate, vol) => () => SND.play(k, rate, vol);
  const CUES = [
    [0.3, () => narr(1)],
    [0.55, () => { tone('sine', 1300, 0, 0.8, 0.04, 500); SND.play('slide', 1.2); }],   // wheee down the slide
    [1.45, () => SFX.boop(1.1)],
    [3.5, () => tone('triangle', 520, 0, 0.18, 0.1, 260)],              // whoops
    [3.8, play('thud', 0.9)],
    [3.95, () => narr(2)],
    [5.25, () => SFX.hmm()],
    [6.85, () => ring()], [7.65, () => ring()],
    [6.95, () => narr(3)],
    [9.1, play('door')], [9.35, play('start')],
    [9.8, () => say('ambulance-on-the-way')],
    [11.4, () => narr(4, 'here-comes-the-ambulance')],
    [13.55, play('whoosh')],
    [14.1, () => narr(5)],
    [17.5, play('brake')],
    [18.1, () => narr(6, 'ambulance-here-to-help')],
    [18.25, () => SFX.boop(0.9)], [18.45, () => SFX.boop(1.0)],
    [19.3, () => narr(7)],
    [20.15, () => SFX.boop(1.4)],
    [21.6, () => { SFX.paint(); }],
    [22.0, play('chime')],
    [22.95, () => giggle()], [23.6, () => giggle()],
    [24.9, () => SFX.boop(1.3)], [25.0, () => narr(8)], [25.4, () => SFX.pop()],
    [26.95, play('click')],
    [27.1, play('beep')],
    [27.65, play('chime')],
    [29.05, play('applause')],
    [29.45, () => narr(9, 'you-did-it')],
    [30.55, () => narr(10)],
    [30.95, play('beep')],
    [32.3, play('door')],
    [32.4, play('twinkle')],
  ];

  /* ---------- little drawing kit ---------- */
  // U(cx, cy, u) -> rect painter in units of u screen pixels (seamless at any scale)
  function U(cx, cy, u) {
    return (dx, dy, w, h, c) => {
      const x1 = Math.round(cx + dx * u), y1 = Math.round(cy + dy * u);
      R(x1, y1, Math.round(cx + (dx + w) * u) - x1, Math.round(cy + (dy + h) * u) - y1, c);
    };
  }
  function vis() { return { x0: (0 - cam.ox) / cam.z - 2, x1: (W - cam.ox) / cam.z + 2, y0: (0 - cam.oy) / cam.z - 2, y1: (H - cam.oy) / cam.z + 2 }; }
  function heart(cx, cy, r, c) {
    cx = Math.round(cx); cy = Math.round(cy);
    circle(cx - r, cy, r, c); circle(cx + r, cy, r, c);
    for (let i = 0; i <= 2 * r + 1; i++) R(cx - 2 * r - 1 + i, cy + i, (2 * r + 1 - i) * 2 + 1, 1, c);
  }
  function addHeart(x, y, big) { st.hearts.push({ x, y, vx: rand(-8, 8), vy: rand(-26, -16), life: 1.6, r: big ? 3 : 2, c: pickOne(['#ff6fb4', '#e8222b', '#ff7a6b']) }); }
  function exhaust(dt, x, yb, v, dir = 1) {
    st.puffT -= dt;
    if (v > 3 && st.puffT <= 0) {
      st.puffT = 0.12;
      const ex = dir > 0 ? x - 2 : x + 64;
      parts.push({ x: sx(ex), y: sy(yb - 7) + rand(-1, 1), vx: -dir * (14 + v * 0.3), vy: rand(-10, -4), g: 0, life: 0.6, max: 0.6, s: 2, c: '#d6d9df' });
    }
  }
  function bokeh(seed, cols) {   // soft out-of-focus backdrop for close-ups
    const hz = Math.round(H * 0.56);
    R(0, 0, W, hz, mix('#a4deff', '#2f3b78', nightK())); R(0, hz, W, H - hz, '#7ccd66');
    R(0, hz - 6, W, 6, '#8fd877');
    for (let i = 0; i < 14; i++) {
      const x = (hsh(seed + i) * (W + 80) - 40 + T * (4 + i % 3)) % (W + 80) - 40, y = hsh(seed + i * 3.1) * H;
      alpha(0.35, () => circle(x, y, 10 + hsh(seed + i * 7.7) * 22, cols[i % cols.length]));
    }
  }

  /* ---------- people ---------- */
  function mirror(x, dir) { const bx = Math.floor(x) - 6; return (dx, w) => dir > 0 ? bx + dx : bx + 12 - dx - w; }
  // Kid sitting (on a seat at `seat`) facing dir. mood: sad | happy | wave. knee: bump | band | none
  function sitKid(x, seat, dir, mood, knee, hop = 0) {
    const sob = mood === 'sad' ? ph2(3) : 0, h = Math.round(hop) + sob;
    drawPerson({ type: KID.type, x, yb: seat, pose: 'sit', dir, skin: KID.skin, hair: KID.hair, hop: h, seed: 1 });
    const top = Math.floor(seat - h) - 14, mx = mirror(x, dir), M = (dx, dy, w, hh, c) => R(mx(dx, w), top + dy, w, hh, c);
    if (knee === 'bump') { M(9, 12, 2, 2, '#ff5a6a'); }
    if (knee === 'band') { M(8, 13, 3, 2, '#ff6fb4'); M(9, 13, 1, 1, '#fff27a'); }
    if (mood === 'sad') {
      M(6, 7, 3, 1, KID.skin); M(7, 7, 1, 1, '#a3121d'); M(6, 8, 1, 1, '#a3121d'); M(8, 8, 1, 1, '#a3121d');
      const tf = Math.floor(T * 6) % 4;
      if (tf < 3) M(8, 6 + tf, 1, 1, '#4fc3ff');
    }
    if (mood === 'wave') { const p = ph2(5); M(8, 4 + p, 2, 6, OUTFITS.kid.shirt); M(8, 2 + p, 2, 2, KID.skin); }
  }
  function handOf(x, yb, type, pose, dir, hop) {
    const o = OUTFITS[type], total = 9 + (o.child ? 5 : 7) + (o.child ? 3 : 4) + 2, top = yb - hop - total;
    if (pose === 'cheer' || pose === 'wave') return [x + (dir > 0 ? 2 : -3), top + 2];
    return [x + (dir > 0 ? 0 : -1), top + 9 + (o.child ? 5 : 7) + 1];
  }
  function balloon(hx, hy, by) {
    const c = COLOR.red.c, bx = hx + 4 + Math.round(Math.sin(T * 2) * 2);
    for (let i = 0; i <= 14; i++) { const f = i / 14; R(lerp(hx, bx, f) + Math.round(Math.sin(f * Math.PI) * 2), lerp(hy, by + 7, f), 1, 1, '#5a5f6e'); }
    circle(bx, by, 6, c[1]); R(bx - 3, by - 3, 2, 2, c[0]); R(bx - 1, by + 6, 3, 1, c[2]);
  }
  function standKid(x, yb, dir, pose, walk, hop = 0, extras = true) {
    x = Math.floor(x); yb = Math.floor(yb); hop = Math.round(hop);
    if (extras) { const [hx, hy] = handOf(x, yb, KID.type, pose, dir, hop); balloon(hx, hy, yb - hop - 40); }
    drawPerson({ type: KID.type, x, yb, pose, dir, walk, skin: KID.skin, hair: KID.hair, seed: 0, hop });
    if (extras) {
      const top = yb - hop - 19, cx = dir > 0 ? x + 1 : x - 2;   // gold star sticker on the shirt
      R(cx - 1, top + 11, 3, 1, '#ffd21f'); R(cx, top + 10, 1, 3, '#ffd21f');
      R(dir > 0 ? x : x - 3, yb - hop - 4, 3, 1, '#ff6fb4');      // bandage
    }
  }
  function medic(i, x, yb, dir, pose, walk, hop = 0) { drawPerson({ type: 'medic', x, yb, dir, pose, walk, skin: MED[i], seed: i * 3, hop }); }
  function momPhone(x, yb, dir) {
    drawPerson({ type: MOM.type, x, yb, dir, pose: 'stand', skin: MOM.skin, seed: 4 });
    const top = Math.floor(yb) - 22, mx = mirror(x, dir), M = (dx, dy, w, h, c) => R(mx(dx, w), top + dy, w, h, c);
    M(3, 2, 2, 5, '#2f3240'); M(3, 6, 2, 2, MOM.skin); M(4, 8, 2, 4, OUTFITS.mom.shade);
  }
  function bag(cx, yb, open) {
    cx = Math.floor(cx); yb = Math.floor(yb);
    R(cx - 5, yb - 7, 10, 7, RED); R(cx - 5, yb - 7, 10, 1, '#ff7a6b'); R(cx - 5, yb - 1, 10, 1, '#a3121d');
    R(cx - 1, yb - 6, 2, 5, '#ffffff'); R(cx - 3, yb - 4, 6, 1, '#ffffff');
    if (open) { R(cx - 4, yb - 9, 2, 2, '#ff6fb4'); R(cx - 1, yb - 10, 2, 3, '#fff27a'); R(cx + 2, yb - 9, 2, 2, '#6fb6ff'); }
    else { R(cx - 2, yb - 9, 4, 1, '#3a3d46'); R(cx - 2, yb - 9, 1, 2, '#3a3d46'); R(cx + 1, yb - 9, 1, 2, '#3a3d46'); }
  }
  function stretcher(x, yb) {
    x = Math.floor(x); yb = Math.floor(yb);
    R(x - 10, yb - 10, 1, 7, '#7d8794'); R(x + 9, yb - 10, 1, 7, '#7d8794');
    R(x - 11, yb - 3, 3, 3, TIRE); R(x + 8, yb - 3, 3, 3, TIRE);
    R(x - 15, yb - 11, 31, 2, '#9aa3ad');
    R(x - 13, yb - 14, 27, 3, '#ffffff'); R(x - 13, yb - 12, 27, 1, '#cfd8e2');
    R(x - 13, yb - 15, 6, 1, '#eef3f8');
  }
  function amb(x, yb, lit, moving, doors, rotDir = 1) {
    const bob = moving && ph2(9) ? 1 : 0;
    drawV(AMB, x, yb, lit, bob, rotDir * x / 6);
    if (doors) {
      const c = COLOR[V[AMB].color].c;
      R(x, yb - 29, 3, 22, '#3a3d46');
      R(x - 7, yb - 31, 7, 24, c[2]); R(x - 6, yb - 30, 5, 22, c[1]); R(x - 5, yb - 28, 3, 4, GLASS);
    }
  }
  function clipOut(x, yb, fn) {   // hide whatever is inside the ambulance box
    g.save(); g.beginPath(); g.rect(-9999, -9999, 19998, 19998); g.rect(x + 1, yb - 40, 68, 48); g.clip('evenodd');
    fn(); g.restore();
  }

  /* ---------- scenery ---------- */
  const WALLS = [['#ffe3b0', '#e8c48a'], ['#ffd0d6', '#e8aab4'], ['#cfe8ff', '#a8c8ea'], ['#d8f0c0', '#b4d39a'], ['#fff3a8', '#e0d07a']];
  const ROOFS = ['#c8432f', '#3f66b8', '#7a4a2a', '#8a4fd9', '#2f8a4a'];
  const TOWERS = [['#c9d6e8', '#b3c3da'], ['#d8cfe6', '#c3b8d6'], ['#e6d6c8', '#d3c0ae'], ['#cfe0dc', '#b6ccc6']];
  const HZ = -26;
  function capH() { return Math.min(-P.capWide, -cam.cap); }   // tallest building that keeps the sun clear
  function backdrop() {
    const v = vis(), k = nightK(), top = -capH();
    if (top < HZ - 50) {   // far towers fill a tall portrait sky
      const sp = 30, base = cam.x * 0.6;
      for (let i = Math.floor((v.x0 - base - 40) / sp); i * sp + base < v.x1 + 40; i++) {
        const seed = i * 5.3 + 77; if (hsh(seed) > 0.8) continue;
        const w = 22 + Math.floor(hsh(seed + 1) * 14), x = Math.floor(i * sp + base + hsh(seed + 3) * 8);
        const ty = Math.floor(top + 6 + hsh(seed + 2) * Math.min(70, HZ - top - 40));
        const [c, d] = TOWERS[Math.floor(hsh(seed + 4) * TOWERS.length)];
        R(x, ty, w, HZ + 10 - ty, c); R(x + w - 3, ty, 3, HZ + 10 - ty, d); R(x - 1, ty - 2, w + 2, 2, d);
        for (let wy = ty + 6, r = 0; wy < HZ - 4; wy += 9, r++) for (let wx = x + 4, q = 0; wx + 4 < x + w - 3; wx += 7, q++) {
          R(wx, wy, 4, 4, d);
          if (k > 0.02 && hsh(seed + r * 13.1 + q * 3.7) < 0.45) alpha(k, () => R(wx, wy, 4, 4, '#ffe7a0'));
        }
      }
    }
    const hb = cam.x * 0.35;
    for (let i = Math.floor((v.x0 - hb - 120) / 80); i * 80 + hb < v.x1 + 120; i++) {
      const r = 34 + Math.round(hsh(i * 2.7 + 5) * 20);
      circle(i * 80 + hb, HZ + r * 0.6, r, '#8fd877');
    }
    R(v.x0, HZ + 4, v.x1 - v.x0, -HZ - 3, '#6cbf5a');
  }
  function house(x, base, w, fl, seed, lit) {
    const hg = 12 + fl * 14, top = base - hg;
    const [wall, shade] = WALLS[Math.floor(hsh(seed) * WALLS.length)], roof = ROOFS[Math.floor(hsh(seed + 1) * ROOFS.length)];
    const wins = [[x + 4, base - 11]];
    for (let f = 1; f < fl; f++) { const wy = base - 11 - f * 14; wins.push([x + 4, wy], [x + w - 11, wy]); if (w >= 42) wins.push([x + (w >> 1) - 3, wy]); }
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      wins.forEach(([wx, wy], i) => { if (hsh(seed + i * 3.3) < 0.75) alpha(k, () => { alpha(0.3, () => R(wx - 2, wy - 2, 11, 10, '#ffd98a')); R(wx, wy, 7, 6, '#ffd98a'); }); });
      return;
    }
    R(x, top, w, hg, wall); R(x, top, 2, hg, shade);
    R(x + w - 6, top - 9, 4, 8, '#8a5a3a');
    const rows = Math.ceil((w + 6) / 4);
    for (let i = 0; i < rows; i++) R(x - 3 + i * 2, top - 1 - i, w + 6 - i * 4, 1, i ? roof : '#5a2a1a');
    for (const [wx, wy] of wins) { R(wx - 1, wy - 1, 9, 8, '#ffffff'); R(wx, wy, 7, 6, GLASS); R(wx + 3, wy, 1, 6, '#ffffff'); R(wx + 1, wy + 1, 2, 1, '#ffffff'); }
    const dx = x + w - 13;
    R(dx - 1, base - 16, 10, 16, '#ffffff'); R(dx, base - 15, 8, 15, roof); R(dx + 6, base - 8, 1, 1, '#ffd21f');
  }
  function houseRow(lit, base, skip) {   // a row of houses along the back, hash-placed
    const v = vis(), sp = 66;
    for (let i = Math.floor((v.x0 - 70) / sp); i * sp < v.x1 + 10; i++) {
      const x = i * sp + Math.floor(hsh(i + 0.5) * 8), seed = i * 3.7 + 11;
      if (skip && skip(x)) continue;
      const fl = clamp(Math.floor(((capH() - 22) / 14) * (0.55 + 0.45 * hsh(seed + 2))), 1, 7);
      house(x, base, 50, fl, seed, lit);
    }
  }
  function fence(x0, x1, base) {
    R(x0, base - 7, x1 - x0, 1, '#f4f7fb'); R(x0, base - 3, x1 - x0, 1, '#f4f7fb');
    for (let px = Math.floor(x0 / 4) * 4 + 1; px < x1; px += 4) { R(px, base - 9, 2, 9, '#ffffff'); R(px, base - 9, 2, 1, '#dfe6ee'); }
  }
  function road(y0) {   // road from y0 (42 deep), front sidewalk, then grass with flowers to the bottom
    const v = vis(), vw = v.x1 - v.x0;
    R(v.x0, y0, vw, 42, '#4b4f5c');
    R(v.x0, y0, vw, 3, '#bdb8ac'); R(v.x0, y0 + 3, vw, 1, '#8f8b80'); R(v.x0, y0 + 39, vw, 3, '#bdb8ac');
    for (let xx = Math.floor(v.x0 / 20) * 20; xx < v.x1; xx += 20) R(xx + 4, y0 + 21, 10, 2, '#ffd21f');
    R(v.x0, y0 + 42, vw, 10, '#d9d2c3'); R(v.x0, y0 + 42, vw, 1, '#c2baa8');
    for (let xx = Math.floor(v.x0 / 16) * 16; xx < v.x1; xx += 16) R(xx, y0 + 43, 1, 9, '#c9c1b0');
    R(v.x0, y0 + 52, vw, Math.max(0, v.y1 - y0 - 52), '#5aa84c');
    R(v.x0, y0 + 52, vw, 2, '#4a9440');
    if (v.y1 > y0 + 62) {
      for (let xx = Math.floor(v.x0 / 9) * 9; xx < v.x1; xx += 9) {
        const s = hsh(xx * 0.37), yy = y0 + 58 + Math.floor(s * Math.min(40, v.y1 - y0 - 64));
        if (s < 0.45) { R(xx, yy, 1, 3, '#7cc96a'); R(xx + 2, yy + 1, 1, 2, '#7cc96a'); }
        else if (s < 0.7) { const c = ['#ff6fb4', '#ffd21f', '#ffffff', '#8a4fd9'][Math.floor(s * 40) % 4]; R(xx, yy + 2, 1, 3, '#3f9a45'); R(xx - 1, yy, 3, 3, c); R(xx, yy + 1, 1, 1, '#fff27a'); }
      }
    }
  }
  function lamp(x, base, lit) {
    const hgt = 46;
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(0.2 * k, () => { for (let i = 0; i < hgt - 2; i += 2) { const w = 4 + i * 0.6; R(x + 7 - w / 2, base - hgt + 3 + i, w, 2, '#fff1a8'); } });
      alpha(k, () => { glow(x + 7, base - hgt + 2, '#fff1a8', 5); R(x + 5, base - hgt + 2, 5, 2, '#fff6b0'); });
      return;
    }
    R(x - 1, base - 3, 4, 3, '#3f434e'); R(x, base - hgt, 2, hgt, '#5a5f6e');
    R(x, base - hgt, 8, 2, '#5a5f6e'); R(x + 4, base - hgt + 1, 6, 1, '#3f434e'); R(x + 5, base - hgt + 2, 5, 1, '#e9e2b0');
  }

  /* ---------- the playground set (kid sits at x = 0) ---------- */
  const PG_ROAD = 30, PG_LANE = 16, PG_BACK = 48;
  function playground(lit, kid2 = true) {
    if (lit) { houseRow(true, 0); return; }
    backdrop();
    const v = vis();
    houseRow(false, 0);
    R(v.x0, 0, v.x1 - v.x0, 20, '#7fcf68');
    for (let xx = Math.floor(v.x0 / 7) * 7; xx < v.x1; xx += 7) if (hsh(xx * 0.71) < 0.4) R(xx, 4 + Math.floor(hsh(xx) * 14), 1, 2, '#6cbf5a');
    R(v.x0, 20, v.x1 - v.x0, PG_ROAD - 20, '#d9d2c3'); R(v.x0, 20, v.x1 - v.x0, 1, '#c2baa8');
    road(PG_ROAD);
    drawTree(-118, 2, 14); drawTree(140, 2, 13); drawTree(-200, 2, 12); drawTree(230, 2, 14);
    fence(v.x0, v.x1, 3);
    // swing set with a friend swinging
    R(-86, -28, 2, 32, '#2a6fe0'); R(-60, -28, 2, 32, '#2a6fe0'); R(-86, -29, 28, 2, '#1a3f9a');
    const a = Math.sin(T * 2.4) * 0.55, px = -72, py = -27;
    const swx = px + Math.sin(a) * 20, swy = py + Math.cos(a) * 20;
    for (let i = 0; i <= 10; i++) R(lerp(px, swx, i / 10), lerp(py, swy, i / 10), 1, 1, '#7d8794');
    if (kid2) drawPerson({ type: 'kid2', x: swx, yb: swy, pose: a > 0.2 ? 'cheer' : 'sit', dir: 1, skin: SKIN[2], seed: 3 });
    R(swx - 5, swy, 10, 2, '#a8662f');
    // slide (platform x 70..84 at y -27, chute 82,-26 -> 106,2)
    const sxl = 62, b = 4;
    R(sxl + 8, b - 30, 2, 30, '#f57a12'); R(sxl + 15, b - 30, 2, 30, '#f57a12');
    for (let r = b - 26; r < b; r += 5) R(sxl + 8, r, 9, 1, '#f57a12');
    R(sxl + 8, b - 31, 14, 2, RED);
    for (let i = 0; i < 24; i++) R(sxl + 20 + i, b - 30 + Math.round(i * 1.15), 2, 2, i % 6 < 3 ? '#ffd21f' : '#f5c010');
    // sandbox: back plank, sand, digging friend, front plank (the seat)
    R(-6, 2, 48, 2, '#a8662f'); R(-6, 4, 48, 5, '#f3dc9a'); R(4, 5, 3, 2, '#e8c878'); R(24, 6, 4, 2, '#e8c878');
    R(16, 4, 5, 4, '#2a6fe0'); R(17, 3, 3, 1, '#6fb6ff');                  // bucket
    drawPerson({ type: 'kid3', x: 34, yb: 6, pose: Math.floor(T * 2) % 3 ? 'sit' : 'eat', dir: st.t > 3.7 && st.t < 17 ? -1 : 1, skin: SKIN[0], seed: 2 });
    R(-6, 9, 48, 2, '#c98a4a'); R(-6, 11, 48, 5, '#a8662f'); R(-6, 15, 48, 1, '#7a4a2a');
  }

  /* ---------- the hospital, side view (front door at x = 0, garage bay -150..-74) ---------- */
  const HS_ROAD = 12, HS_BACK = 30, BAY = { x0: -150, x1: -74, top: -44 };
  function hospitalSide(lit, bayOpen) {
    const h = clamp(Math.min(P.hospH, -cam.cap - 30), 64, 220), x0 = -74, w = 214, b = 0, top = b - h, cx = x0 + (w >> 1);
    const cols = Math.max(2, Math.floor((w - 12) / 20)), cw = (w - 12) / cols, rows = Math.max(0, Math.floor((h - 72) / 22));
    const wins = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) wins.push([Math.round(x0 + 6 + c * cw + (cw - 12) / 2), top + 9 + r * 22]);
    for (let wx = x0 + 8; wx + 12 < -22; wx += 18) wins.push([wx, b - 28]);
    for (let wx = 24; wx + 12 < x0 + w - 6; wx += 18) wins.push([wx, b - 28]);
    const tw = textWidth('HOSPITAL', 3), signY = b - 60, open = P.doorOpen;
    if (lit) {
      const k = nightK(); if (k < 0.02) return;
      alpha(k, () => {
        wins.forEach(([wx, wy], i) => { if (hsh(i * 1.7 + 4) < 0.85) { alpha(0.3, () => R(wx - 2, wy - 2, 16, 15, '#ffd98a')); R(wx + 1, wy + 1, 10, 9, '#ffd98a'); } });
        alpha(0.35, () => circle(cx, top - 15, 14, '#ff5a5a'));
        R(cx - 2, top - 23, 5, 16, '#ff3b3b'); R(cx - 8, top - 17, 17, 5, '#ff3b3b');
        text('HOSPITAL', cx - (tw >> 1), signY + 3, 3, '#ff3b3b');
        R(-15, b - 30, 30, 30, open ? '#ffd98a' : '#ffe9a0');
        alpha(0.25, () => R(-21, b - 36, 42, 36, '#ffd98a'));
      });
      return;
    }
    R(x0, top, w, h, '#f4f7fb'); R(x0, top, 3, h, '#d5dde6'); R(x0 + w - 2, top, 2, h, '#e2e8ee');
    R(x0 - 3, top - 4, w + 6, 4, '#cfd8e2'); R(x0 - 3, top - 4, w + 6, 1, '#ffffff'); R(x0, top, w, 3, RED);
    R(cx - 7, top - 6, 2, 3, '#9aa3ad'); R(cx + 6, top - 6, 2, 3, '#9aa3ad');
    R(cx - 11, top - 26, 23, 21, '#cfd8e2'); R(cx - 10, top - 25, 21, 19, '#ffffff');
    R(cx - 2, top - 23, 5, 16, RED); R(cx - 8, top - 17, 17, 5, RED);
    for (const [wx, wy] of wins) { R(wx, wy, 12, 11, '#9aa3ad'); R(wx + 1, wy + 1, 10, 9, GLASS); R(wx + 1, wy + 5, 10, 1, '#cfd8e2'); R(wx + 2, wy + 2, 2, 2, '#ffffff'); }
    R(cx - (tw >> 1) - 5, signY, tw + 10, 20, '#a3121d'); R(cx - (tw >> 1) - 4, signY + 1, tw + 8, 18, '#ffffff');
    text('HOSPITAL', cx - (tw >> 1), signY + 3, 3, RED);
    for (let i = 0; i < 42; i += 4) R(-21 + i, b - 37, 2, 6, RED);
    R(-17, b - 31, 34, 31, '#7d8794'); R(-15, b - 30, 30, 30, '#3a3d46');
    if (open) { R(-15, b - 30, 3, 30, GLASS2); R(12, b - 30, 3, 30, GLASS2); R(-12, b - 30, 24, 30, '#fbe8c8'); }
    else { R(-15, b - 30, 14, 30, GLASS); R(1, b - 30, 14, 30, GLASS); R(-12, b - 27, 2, 8, '#ffffff'); R(4, b - 27, 2, 8, '#ffffff'); }
    // garage annex
    R(BAY.x0 - 2, -62, BAY.x1 - BAY.x0 + 2, 62, '#e9eef2'); R(BAY.x0 - 2, -62, 3, 62, '#d5dde6'); R(BAY.x0 - 4, -65, BAY.x1 - BAY.x0 + 6, 3, '#cfd8e2'); R(BAY.x0 - 2, -62, BAY.x1 - BAY.x0 + 2, 2, RED);
    R(-118, -58, 6, 12, RED); R(-121, -55, 12, 6, RED);
    R(BAY.x0 + 1, BAY.top, BAY.x1 - BAY.x0 - 4, -BAY.top, '#3a3d46');
    R(BAY.x0 + 1, BAY.top - 2, BAY.x1 - BAY.x0 - 4, 2, '#9aa3ad');
    P.bayDoor = () => { const d = Math.round(-BAY.top * (1 - bayOpen)); for (let y = 0; y < d; y += 4) { R(BAY.x0 + 1, BAY.top + y, BAY.x1 - BAY.x0 - 4, Math.min(4, d - y), '#cfd8e2'); R(BAY.x0 + 1, BAY.top + y + 3, BAY.x1 - BAY.x0 - 4, 1, '#9aa3ad'); } };
    circle(x0 + w - 5, b - 4, 5, '#3f9a45'); circle(x0 + w - 6, b - 6, 3, '#5bb85a');
  }
  function hospitalGround() {
    const v = vis();
    backdrop();
    houseRow(false, 0, x => x > -170 && x < 150);
    R(v.x0, 0, v.x1 - v.x0, HS_ROAD, '#d9d2c3'); R(v.x0, 0, v.x1 - v.x0, 1, '#c2baa8');
    road(HS_ROAD);
    drawTree(-178, 1, 13); drawTree(170, 1, 12);
  }

  /* ---------- close-up sprites ---------- */
  function bigFace(cx, cy, u, o) {
    const Pp = U(cx, cy, u), C = (dx, dy, r, c) => circle(cx + dx * u, cy + dy * u, r * u, c);
    Pp(-17, 13, 34, 200, o.shirt); Pp(-17, 13, 34, 2, o.shade); Pp(-17, 13, 3, 200, o.shade);
    if (o.cross) { Pp(6, 18, 2, 6, RED); Pp(4, 20, 6, 2, RED); }
    Pp(-3, 9, 6, 5, o.skin);
    C(0, -2, 15, o.hair);
    C(-13, 1, 3, o.skin); C(13, 1, 3, o.skin);
    C(0, 1, 13, o.skin);
    if (o.cap) { Pp(-13, -15, 26, 7, '#f4f7fb'); Pp(-13, -9, 26, 2, '#cfd8e2'); Pp(-1, -14, 2, 4, RED); Pp(-2, -13, 4, 2, RED); }
    else { Pp(-11, -12, 22, 4, o.hair); Pp(-12, -10, 5, 4, o.hair); Pp(6, -10, 6, 3, o.hair); }
    const sad = o.mood === 'sad', blink = !sad && (T % 3.1) < 0.12;
    if (sad) { Pp(-8, -4, 2, 1, INK); Pp(-6, -5, 2, 1, INK); Pp(4, -5, 2, 1, INK); Pp(6, -4, 2, 1, INK); }
    else { Pp(-8, -6, 4, 1, o.brow || INK); Pp(4, -6, 4, 1, o.brow || INK); }
    if (blink) { Pp(-7, 0, 3, 1, INK); Pp(4, 0, 3, 1, INK); }
    else {
      Pp(-7, -2, 3, 4, INK); Pp(-7, -2, 1, 1, '#ffffff');
      if (o.wink) { Pp(4, 0, 3, 1, INK); Pp(3, -1, 1, 1, INK); } else { Pp(4, -2, 3, 4, INK); Pp(4, -2, 1, 1, '#ffffff'); }
    }
    C(-8, 5, 2, '#ff9c8a'); C(8, 5, 2, '#ff9c8a');
    Pp(-1, 2, 2, 2, mix(o.skin, '#7a3a1a', 0.25));
    if (sad) { Pp(-3, 7, 6, 1, '#a3121d'); Pp(-4, 8, 1, 1, '#a3121d'); Pp(3, 8, 1, 1, '#a3121d'); }
    else { Pp(-4, 6, 8, 2, '#a3121d'); Pp(-3, 8, 6, 1, '#a3121d'); Pp(-2, 7, 4, 1, '#ff7a8a'); Pp(-5, 5, 1, 1, '#a3121d'); Pp(4, 5, 1, 1, '#a3121d'); }
    if (o.tear) {
      const f = (T * 1.2) % 1;
      Pp(-7, 2 + f * 9, 2, 3, '#4fc3ff'); Pp(-7, 2 + f * 9, 1, 1, '#d8f4ff');
      alpha(0.8, () => Pp(-7, 2, 2, f * 9, '#9fe0ff'));
    }
  }
  function phoneCloseUp(cx, cy, u, lt) {
    const shake = lt < 1.8 && ph2(24) ? 0.4 : -0.0, Pp = U(cx + shake * u, cy, u), C = (dx, dy, r, c) => circle(cx + (dx + shake) * u, cy + dy * u, r * u, c);
    // arm and sleeve from below
    const Q = U(cx, cy, u);
    Q(-6, 18, 16, 60, MOM.skin); Q(-9, 30, 22, 80, '#3fb4a8'); Q(-9, 30, 22, 2, '#2f948a');
    // phone
    Pp(-13, -23, 26, 46, '#2f3240'); Pp(-12, -22, 24, 44, '#3f4352');
    Pp(-11, -19, 22, 35, '#eaf6ff'); Pp(-3, -21, 6, 1, BLACK);
    const pulse = 1 + 0.12 * Math.sin(T * 9);
    const cr = (w, h) => [w * pulse, h * pulse];
    const [a, bb] = cr(5, 14), [c2, d2] = cr(14, 5);
    Pp(-a / 2, -8 - bb / 2, a, bb, RED); Pp(-c2 / 2, -8 - d2 / 2, c2, d2, RED);
    C(0, 10, 4, '#3fb43a'); Pp(-2, 9, 4, 1, '#ffffff'); Pp(-2, 9, 1, 2, '#ffffff'); Pp(1, 9, 1, 2, '#ffffff');
    // fingers wrapping the phone, thumb on the right
    for (let i = 0; i < 3; i++) { Pp(-16, 1 + i * 6, 6, 5, MOM.skin); Pp(-16, 5 + i * 6, 6, 1, '#d99a7a'); }
    Pp(11, 4, 5, 9, MOM.skin); Pp(11, 4, 5, 1, '#ffd9bb');
    // ringing lines
    if (lt < 1.8 && Math.floor(T * 4) % 2) {
      for (const s of [-1, 1]) { Pp(s > 0 ? 16 : -17, -16, 1, 6, '#ffffff'); Pp(s > 0 ? 19 : -20, -18, 1, 10, '#ffffff'); }
    }
  }
  function kneeCloseUp(cx, cy, u, lt) {
    const Pp = U(cx, cy, u), C = (dx, dy, r, c) => circle(cx + dx * u, cy + dy * u, r * u, c), skin = KID.skin;
    Pp(-90, 6, 180, 8, '#c98a4a'); Pp(-90, 6, 180, 1, '#f0c27a'); Pp(-90, 14, 180, 6, '#8a5a2a');
    Pp(-90, 20, 180, 60, '#f3dc9a'); for (let i = -88; i < 90; i += 7) Pp(i, 24 + (i * 7 & 7), 2, 1, '#e8c878');
    Pp(-90, -10, 62, 16, OUTFITS.kid.pants); Pp(-90, -10, 62, 2, '#6fb6ff'); Pp(-30, -10, 3, 16, '#1a3f9a');
    const edge = mix(skin, '#7a3a1a', 0.35);
    Pp(-28, -9, 28, 15, edge); C(0, -1, 8, edge); Pp(-7, -1, 14, 32, edge);
    Pp(-28, -8, 28, 13, skin); C(0, -1, 7, skin); Pp(-6, -1, 12, 32, skin); Pp(-6, -1, 2, 32, mix(skin, '#7a3a1a', 0.15));
    Pp(-7, 30, 14, 4, '#ffffff'); Pp(-9, 34, 20, 8, '#e8222b'); Pp(-9, 41, 20, 2, '#a3121d');
    const on = lt >= 0.8;
    if (!on) {
      C(2, -7, 2, '#ff6b7a'); Pp(1, -8, 1, 1, '#ffc2cc');
      if (Math.floor(T * 3) % 2) { Pp(-6, -15, 1, 3, '#ffd21f'); Pp(-7, -14, 3, 1, '#ffd21f'); Pp(9, -14, 1, 3, '#ffd21f'); Pp(8, -13, 3, 1, '#ffd21f'); }
    }
    const by = on ? -11 : lerp(-56, -11, ease(seg(lt, 0.1, 0.8)));
    const band = () => {
      Pp(-8, by, 19, 8, '#ff6fb4'); Pp(-8, by, 19, 1, '#ffb3da'); Pp(-3, by + 1, 9, 6, '#ffd6ea');
      Pp(-6, by + 2, 1, 1, '#fff27a'); Pp(8, by + 5, 1, 1, '#fff27a'); Pp(-6, by + 6, 1, 1, '#6fb6ff'); Pp(8, by + 2, 1, 1, '#6fb6ff');
      Pp(0, by + 3, 3, 1, '#ff6fb4'); Pp(1, by + 2, 1, 3, '#ff6fb4');
    };
    band();
    const hy = on ? lerp(-11, -70, ease(seg(lt, 0.95, 1.6))) : by;
    if (hy > -66) for (const s of [-1, 1]) {
      const hx = s < 0 ? -16 : 10;
      Pp(hx + 1, hy - 50, 7, 46, '#f4f7fb'); Pp(hx + 1, hy - 50, 2, 46, '#cfd8e2');
      Pp(hx, hy - 5, 9, 9, '#8fd3ff'); Pp(hx, hy + 3, 9, 1, '#6fb6e0');
      Pp(s < 0 ? hx + 7 : hx - 1, hy - 1, 3, 3, '#8fd3ff');
    }
  }

  /* ---------- head-on shot: a front-view ambulance growing toward the camera ---------- */
  function frontAmb(cx, yb, u) {
    const c = COLOR[V[AMB].color].c, warm = WARM.has(V[AMB].color), cross = warm ? '#ffffff' : RED, stripe = warm ? '#f4f7fb' : RED;
    const Pp = U(cx, yb, u), on = ph2(7);
    alpha(0.3, () => Pp(-19, -1, 38, 3, '#1d1a2b'));
    Pp(-15, -4, 7, 4, TIRE); Pp(8, -4, 7, 4, TIRE);
    Pp(-16, -36, 32, 28, c[1]); Pp(-16, -36, 32, 2, c[0]); Pp(-16, -36, 2, 28, c[2]); Pp(14, -36, 2, 28, c[2]);
    Pp(-3, -34, 6, 11, cross); Pp(-6, -31, 12, 5, cross);
    Pp(-16, -23, 32, 2, stripe);
    Pp(-13, -21, 26, 9, GLASS); Pp(-13, -21, 26, 1, '#ffffff'); Pp(-1, -21, 2, 9, c[2]);
    Pp(-11, -20, 3, 6, '#ffffff');
    Pp(-9, -17, 6, 5, MED[0]); Pp(-9, -18, 6, 2, '#2b1d14'); Pp(-8, -15, 1, 1, INK); Pp(-5, -15, 1, 1, INK);      // driver
    Pp(-10, -12, 9, 2, '#f4f7fb');
    Pp(4, -15, 6, 1, '#3a3d46'); Pp(6, -14, 2, 2, '#3a3d46');
    Pp(-19, -20, 3, 5, '#3a3d46'); Pp(16, -20, 3, 5, '#3a3d46');
    Pp(-16, -12, 32, 8, c[1]); Pp(-16, -12, 32, 1, c[0]);
    Pp(-7, -11, 14, 5, '#3a3d46'); for (let i = 0; i < 4; i++) Pp(-6 + i * 3.5, -10, 2, 3, '#5a5f6e');
    Pp(-15, -11, 6, 4, '#fff6b0'); Pp(9, -11, 6, 4, '#fff6b0'); Pp(-15, -11, 2, 1, '#ffffff'); Pp(9, -11, 2, 1, '#ffffff');
    Pp(-16, -7, 3, 2, '#ffb15a'); Pp(13, -7, 3, 2, '#ffb15a');
    Pp(-17, -5, 34, 3, CHROME);
    Pp(-12, -39, 24, 3, '#444a55');
    Pp(-12, -40, 8, 3, on ? RED_ON : RED_OFF); Pp(4, -40, 8, 3, on ? RED_OFF : RED_ON); Pp(-3, -40, 6, 3, on ? '#ffffff' : '#bbbbbb');
  }
  function headOnLit(cx, yb, u) {
    const on = ph2(7), k = nightK();
    const G = (dx, dy, r, c, a) => alpha(a, () => circle(cx + dx * u, yb + dy * u, r * u, c));
    G(on ? -8 : 8, -39, 6, RED_ON, 0.1 + 0.25 * k); G(on ? -8 : 8, -39, 3, RED_ON, 0.4);
    if (k > 0.02) { G(-12, -9, 7, '#fff3b0', 0.45 * k); G(12, -9, 7, '#fff3b0', 0.45 * k); G(-12, -9, 3, '#ffffff', k); G(12, -9, 3, '#ffffff', k); }
  }
  function headOn(lt) {
    const hy = P.hy, cx = Math.round(W / 2), K = P.K;
    R(0, hy, W, H - hy, '#6cbf5a');
    for (let i = 0; i < 9; i++) {   // little houses on the horizon
      const x = Math.round(W * (i / 8) - 14 + hsh(i) * 10), w = 12 + Math.floor(hsh(i + 3) * 10), h = 8 + Math.floor(hsh(i + 5) * 10);
      if (Math.abs(x + w / 2 - cx) < 22) continue;
      R(x, hy - h, w, h, WALLS[i % 5][0]); R(x - 1, hy - h - 3, w + 2, 3, ROOFS[i % 5]); R(x + 3, hy - h + 3, 3, 3, GLASS);
    }
    R(0, hy - 1, W, 2, '#8fd877');
    for (let y = hy + 1; y < H; y++) {
      const d = y - hy, half = d * 1.25, side = d * 1.75, Z = K / d;
      R(cx - side, y, side * 2, 1, '#d9d2c3');
      R(cx - half, y, half * 2, 1, '#4b4f5c');
      const e = Math.max(1, d * 0.05);
      R(cx - half, y, e, 1, '#ffffff'); R(cx + half - e, y, e, 1, '#ffffff');
      if (Math.floor(Z / 5) % 2 === 0) R(cx - Math.max(1, d * 0.03), y, Math.max(1, d * 0.06), 1, '#ffd21f');
    }
    for (const Z of [160, 90, 52, 34]) for (const s of [-1, 1]) {   // trees by the road
      const sc = K / Z, x = cx + s * 2.4 * sc, y = hy + sc, r = Math.max(2, Math.round(0.55 * sc));
      R(x - Math.max(1, r / 5), y - r * 1.6, Math.max(2, r / 2.5), r * 1.6, '#7a4a2a');
      circle(x, y - r * 1.9, r, '#3f9a45'); circle(x - r * 0.3, y - r * 2.15, r * 0.55, '#5bb85a');
    }
    const cs = K / 70, carY = hy + cs, carX = cx + 1.75 * cs, cu = 1.0 * cs / 20;   // a car pulled over, hazards on
    const Cq = U(carX, carY, cu), cc = COLOR.yellow.c;
    Cq(-10, -8, 20, 6, cc[1]); Cq(-7, -13, 14, 5, cc[1]); Cq(-6, -12, 12, 4, GLASS); Cq(-9, -6, 3, 2, ph2(3) ? '#ffb15a' : '#fff6b0'); Cq(6, -6, 3, 2, ph2(3) ? '#ffb15a' : '#fff6b0'); Cq(-9, -2, 4, 2, TIRE); Cq(5, -2, 4, 2, TIRE);
    const p = seg(lt, 0, 2.45), Z = lerp(420, P.Zend, p), u = 1.1 * K / Z / 32, yb = hy + K / Z + (ph2(9) ? u * 0.4 : 0);
    P.ho = { cx, yb, u };
    frontAmb(cx, yb, u);
  }

  /* ---------- bird's-eye map ---------- */
  const MAP_PATH = (() => {
    const pts = [];
    for (let x = -20; x <= 176; x += 4) pts.push([x, -1, 0]);
    for (let a = 0; a <= Math.PI / 2 + 1e-6; a += Math.PI / 32) pts.push([176 + Math.sin(a) * 20, -21 + Math.cos(a) * 20, -a]);
    for (let y = -25; y >= -190; y -= 4) pts.push([196, y, -Math.PI / 2]);
    let s = 0; pts[0][3] = 0;
    for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); pts[i][3] = s; }
    return pts;
  })();
  function mapAt(d) {
    const pts = MAP_PATH;
    for (let i = 1; i < pts.length; i++) if (pts[i][3] >= d) {
      const a = pts[i - 1], b = pts[i], f = (d - a[3]) / (b[3] - a[3] || 1);
      return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
    }
    const e = pts[pts.length - 1]; return [e[0], e[1], e[2]];
  }
  function topCar(x, y, horiz, c, hazard) {
    const Q = horiz ? (dx, dy, w, h, col) => R(x + dx, y + dy, w, h, col) : (dx, dy, w, h, col) => R(x + dy, y + dx, h, w, col);
    Q(-9, -5, 18, 10, c[2]); Q(-8, -4, 16, 8, c[1]); Q(2, -4, 3, 8, '#3a4a66'); Q(-6, -4, 2, 8, '#3a4a66'); Q(-4, -3, 6, 6, c[0]);
    if (hazard && ph2(3)) { Q(-9, -5, 2, 2, '#ffb15a'); Q(-9, 3, 2, 2, '#ffb15a'); Q(7, -5, 2, 2, '#ffb15a'); Q(7, 3, 2, 2, '#ffb15a'); }
  }
  function topAmb(x, y, ang) {
    const c = COLOR[V[AMB].color].c, warm = WARM.has(V[AMB].color), cross = warm ? '#ffffff' : RED, on = ph2(7);
    g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(ang);
    alpha(0.25, () => R(-14, -5, 31, 14, '#1d1a2b'));
    R(-15, -7, 30, 14, c[2]); R(-14, -6, 28, 12, c[1]); R(-14, -6, 28, 1, c[0]);
    R(9, -6, 4, 12, '#3a4a66'); R(10, -5, 1, 4, '#9fd2ef');
    R(-9, -2, 12, 4, cross); R(-5, -5, 4, 10, cross);
    R(5, -6, 3, 5, on ? RED_ON : RED_OFF); R(5, 1, 3, 5, on ? RED_OFF : RED_ON);
    R(-15, -6, 1, 3, RED_ON); R(-15, 3, 1, 3, RED_ON);
    R(12, -8, 2, 1, '#3a3d46'); R(12, 7, 2, 1, '#3a3d46');
    g.restore();
  }
  function topPerson(x, y, shirt, hair) { circle(x, y, 3, shirt); circle(x, y - 1, 2, hair); }
  function birdsEye() {
    const v = vis(), vw = v.x1 - v.x0;
    R(v.x0, v.y0, vw, v.y1 - v.y0, '#7ccd66');
    // park (north-east of the corner) with the playground
    R(222, v.y0, Math.max(0, v.x1 - 222), -22 - v.y0, '#8fe36b');
    for (let y = Math.floor(v.y0 / 4) * 4; y < -22; y += 4) R(223, y, 2, 2, '#ffffff');
    R(244, -110, 26, 18, '#a8662f'); R(246, -108, 22, 14, '#f3dc9a');
    R(282, -138, 8, 20, '#f57a12'); for (let k = 0; k < 5; k++) R(282, -136 + k * 4, 8, 1, '#b14c06'); R(283, -118, 6, 22, '#ffd21f'); R(284, -118, 1, 22, '#fff27a');
    R(296, -92, 30, 3, '#1a3f9a'); R(302, -90, 6, 3, '#a8662f'); R(314, -90, 6, 3, '#a8662f');
    topPerson(242, -98, '#ff6fb4', KID.hair); topPerson(236, -106, '#3fb4a8', '#a3471d'); topPerson(256, -101, '#ffd21f', '#5a3a22'); topPerson(305, -86, '#3fb43a', '#f57a12');
    // houses and trees on the blocks
    for (let i = Math.floor(v.x0 / 64) - 1; i * 64 < v.x1 + 64; i++) for (let j = Math.floor(v.y0 / 64) - 1; j * 64 < v.y1 + 64; j++) {
      const x = i * 64 + 14, y = j * 64 + 14, s = hsh(i * 7.1 + j * 3.3);
      if (y + 40 > -30 && y < 30) continue;
      if (x + 40 > 176 && x < 224 && y < 30) continue;
      if (x + 40 > 218 && y < -10) continue;
      const roof = ROOFS[Math.floor(s * ROOFS.length)];
      R(x + 2, y + 2, 30, 24, 'rgba(0,0,0,0.18)');
      R(x, y, 30, 24, roof); R(x, y, 30, 12, mix(roof, '#ffffff', 0.18)); R(x, y + 11, 30, 2, mix(roof, '#000000', 0.25));
      R(x + 22, y + 3, 4, 4, '#8a5a3a');
      const tx = x + 40, ty = y + 34;
      circle(tx, ty, 8, '#3f9a45'); circle(tx - 2, ty - 2, 5, '#5bb85a');
      if (s > 0.5) { circle(x - 4, y + 38, 6, '#3f9a45'); circle(x - 5, y + 37, 3, '#5bb85a'); }
    }
    for (const [tx, ty] of [[240, -40], [262, -52], [330, -44], [350, -120], [236, -150], [300, -170]]) { circle(tx, ty, 9, '#3f9a45'); circle(tx - 2, ty - 2, 5, '#5bb85a'); }
    // streets
    R(v.x0, -22, vw, 6, '#d9d2c3'); R(v.x0, 16, vw, 6, '#d9d2c3');
    R(178, v.y0, 6, -16 - v.y0, '#d9d2c3'); R(216, v.y0, 6, -16 - v.y0, '#d9d2c3');
    R(v.x0, -16, vw, 32, '#4b4f5c'); R(184, v.y0, 32, 16 - v.y0, '#4b4f5c');
    for (let x = Math.floor(v.x0 / 16) * 16; x < v.x1; x += 16) if (x + 8 < 180 || x > 216) R(x, -1, 8, 2, '#ffd21f');
    for (let y = Math.floor(v.y0 / 16) * 16; y < -20; y += 16) R(199, y, 2, 8, '#ffd21f');
    for (let k = 0; k < 6; k++) R(164, -14 + k * 5, 8, 3, '#ffffff');
  }

  /* ---------- low-angle hospital ---------- */
  function lowAngle(lt) {
    const bot = Math.round(H * (portrait() ? 0.84 : 0.86)), Wb = Math.min(W * 0.86, 260), Wt = Wb * 0.6, cx = Math.round(portrait() ? W / 2 : W * 0.42);
    const top = Math.round(cx + Wb / 2 < L.sunX - 34 ? L.safeT + 40 : Math.max(L.sunY + 34, H * 0.1));
    P.la = { bot, cx, Wb };
    const halfAt = y => (Wt + (Wb - Wt) * clamp01((y - top) / (bot - top))) / 2;
    R(0, bot, W, H - bot, '#4b4f5c'); R(0, bot, W, 3, '#bdb8ac');
    for (let y = top; y < bot; y++) {
      const h = halfAt(y);
      R(cx - h, y, h * 2, 1, '#f4f7fb'); R(cx - h, y, 3, 1, '#d5dde6'); R(cx + h - 2, y, 2, 1, '#e2e8ee');
    }
    R(cx - Wt / 2 - 3, top - 4, Wt + 6, 4, '#cfd8e2'); R(cx - Wt / 2, top, Wt, 3, RED);
    const cs = Math.round(Wt * 0.11);   // big rooftop cross
    R(cx - cs * 1.6, top - cs * 3.4, cs * 3.2, cs * 3.1, '#ffffff'); R(cx - cs * 0.45, top - cs * 3.1, cs * 0.9, cs * 2.5, RED); R(cx - cs * 1.25, top - cs * 2.3, cs * 2.5, cs * 0.9, RED);
    R(cx - cs * 1.2, top - cs * 0.3, 2, cs * 0.3, '#9aa3ad'); R(cx + cs * 1.1, top - cs * 0.3, 2, cs * 0.3, '#9aa3ad');
    const floorsBot = bot - 62, nr = Math.max(1, Math.floor((floorsBot - top - 8) / 20));
    for (let r = 0; r < nr; r++) {
      const f0 = top + 8 + r * (floorsBot - top - 8) / nr, f1 = f0 + (floorsBot - top - 8) / nr * 0.62, h = halfAt(f1);
      for (let c = 0; c < 4; c++) {
        const x0 = cx - h + h * 2 * (0.08 + c * 0.235), ww = h * 2 * 0.16;
        R(x0, f0, ww, f1 - f0, '#9aa3ad'); R(x0 + 1, f0 + 1, ww - 2, f1 - f0 - 2, GLASS); R(x0 + 2, f0 + 2, 2, 2, '#ffffff');
      }
    }
    const tw = textWidth('HOSPITAL', 2), sy0 = bot - 58;
    R(cx - tw / 2 - 4, sy0, tw + 8, 16, '#a3121d'); R(cx - tw / 2 - 3, sy0 + 1, tw + 6, 14, '#ffffff'); text('HOSPITAL', Math.round(cx - tw / 2), sy0 + 3, 2, RED);
    // entrance (left) and garage (right)
    const ex = Math.round(cx - Wb * 0.36);
    R(ex, bot - 30, 26, 30, '#7d8794'); R(ex + 2, bot - 28, 22, 28, GLASS); R(ex + 12, bot - 28, 2, 28, '#7d8794');
    const gx = Math.round(cx + Wb / 2 - 80), gw = 76, gt = bot - 40;
    P.la.gx = gx;
    R(gx - 2, gt - 3, gw + 4, 3, RED);
    R(gx, gt, gw, 40, '#3a3d46');
    P.laDoor = () => { const d = Math.round(40 * (1 - seg(lt, 0.3, 0.9))); for (let y = 0; y < d; y += 4) { R(gx, gt + y, gw, Math.min(4, d - y), '#cfd8e2'); R(gx, gt + y + 3, gw, 1, '#9aa3ad'); } };
    for (const bx of [cx - Wb / 2 - 4, cx + Wb / 2 + 4]) { circle(bx, bot - 6, 9, '#3f9a45'); circle(bx - 2, bot - 9, 5, '#5bb85a'); }
  }
  function lowAngleLit() {
    const k = nightK(); if (k < 0.02 || !P.la) return;
    const { bot, cx, Wb } = P.la, ex = Math.round(cx - Wb * 0.36);
    alpha(k, () => { R(ex + 2, bot - 28, 22, 28, '#ffe9a0'); alpha(0.3, () => R(ex - 4, bot - 34, 34, 34, '#ffd98a')); });
  }

  /* ---------- the shots ---------- */
  // Each shot: a..b seconds, irisIn/irisOut, cam(lt) -> sets cam, world(lt), lit(lt), upd(lt, dt), ground(): sky horizon in screen px.
  function setCam(x, z, gyFrac, y) {
    cam.z = z; cam.x = x;
    cam.ox = Math.round(W / 2 - x * z);
    cam.oy = y != null ? Math.round(H / 2 - y * z) : Math.round(H * gyFrac);
    cam.cap = (L.sunY + 34 - cam.oy) / z;
  }
  const screenCam = () => { cam.z = 1; cam.ox = 0; cam.oy = 0; cam.x = 0; cam.cap = -999; };
  // zoom levels: wide shots stay at 1; on a big landscape screen 'mid' and close shots go one step closer
  const bigL = () => !portrait() && W >= 380;
  const zMid = () => portrait() || bigL() ? 2 : 1, narrow = () => W / zMid() < 160, zClose = () => bigL() ? 3 : 2, zHug = () => bigL() ? 4 : 3;
  const wideGy = () => 0.68, midGy = () => bigL() ? 0.46 : portrait() ? 0.62 : 0.68, closeGy = () => portrait() ? 0.62 : 0.72, hugGy = () => portrait() ? 0.62 : 0.75;
  let camS = null;   // smoothed camera target for panning shots
  function follow(target, dt, rate = 4) { if (camS == null) camS = target; else camS += (target - camS) * Math.min(1, dt * rate); return camS; }

  // hero kid in the first two shots
  function heroAt(t) {
    if (t < 0.5) return { x: 76, y: -27, pose: 'stand', dir: 1 };
    if (t < 1.4) { const f = seg(t, 0.5, 1.4) ** 1.4; return { x: 84 + f * 22, y: -25 + f * 27, pose: 'slide', dir: 1 }; }
    if (t < 1.7) { const f = seg(t, 1.4, 1.7); return { x: 106 + f * 6, y: lerp(2, PG_LANE, f) - Math.sin(f * Math.PI) * 6, pose: 'cheer', dir: 1 }; }
    if (t < 3.5) return { x: lerp(112, 12, seg(t, 1.7, 3.5)), y: PG_LANE, pose: 'stand', dir: -1, walk: true };
    if (t < 3.8) { const f = seg(t, 3.5, 3.8); return { x: lerp(12, 0, f), y: lerp(PG_LANE, 9, f) - Math.sin(f * Math.PI) * 5, pose: 'sit', dir: -1, fall: true }; }
    return { x: 0, y: 9, sit: true };
  }
  function drawHero(t) {
    const h = heroAt(t);
    if (h.sit) sitKid(0, 9, -1, 'sad', 'bump');
    else drawPerson({ type: KID.type, x: h.x, yb: h.y, pose: h.pose, dir: h.dir, walk: h.walk, skin: KID.skin, hair: KID.hair, seed: 0 });
  }
  function momEarly(t) {   // mom watching, then hurrying over to make the call
    if (t < 4.0) { const hx = heroAt(t).x; drawPerson({ type: MOM.type, x: 44, yb: 13, pose: t > 0.6 && t < 1.8 ? 'cheer' : 'stand', dir: t < 1.9 ? 1 : hx < 44 ? -1 : 1, skin: MOM.skin, seed: 4 }); return; }
    const f = seg(t, 4.0, 4.7);
    if (f < 1) drawPerson({ type: MOM.type, x: lerp(44, 20, f), yb: lerp(13, 14, f), dir: -1, walk: true, skin: MOM.skin, seed: 4 });
    else momPhone(20, 14, -1);
  }
  function pebble() { R(9, PG_LANE - 2, 3, 2, '#9aa3ad'); R(10, PG_LANE - 2, 1, 1, '#cfd6dd'); }

  const SHOTS = [
    { a: 0, b: 2.6, irisIn: true, // 1. wide: a sunny playground
      cam(lt, dt) { setCam(follow(lt < 1.4 ? 34 : 28, dt, 1.5), 1, wideGy()); },
      world() { playground(false); pebble(); momEarly(st.t); drawHero(st.t); },
      lit() { playground(true); },
    },
    { a: 2.6, b: 5.0, // 2. medium: running, a trip, a bumpy knee
      cam(lt, dt) { const h = heroAt(st.t); setCam(follow(st.t < 3.8 ? h.x - 6 : 8, dt, 3), zClose(), closeGy()); },
      world() { playground(false); pebble(); momEarly(st.t); drawHero(st.t); },
      lit() { playground(true); },
      upd(lt) {
        once('bump', st.t > 3.8, () => { sparkle(sx(-5), sy(6), 6, 5, '#ffffff'); puff(sx(0), sy(PG_LANE), 5, '#e8d8a8'); });
      },
    },
    { a: 5.0, b: 6.8, // 3. close-up: a little tear
      cam() { screenCam(); },
      world(lt) {
        bokeh(3, ['#ffd21f', '#ff6fb4', '#2a6fe0', '#ffffff']);
        const u = P.faceU;
        bigFace(W / 2, Math.round(H * 0.44) + (ph2(3) ? u * 0.3 : 0), u, { skin: KID.skin, hair: KID.hair, shirt: OUTFITS.kid.shirt, shade: OUTFITS.kid.shade, mood: 'sad', tear: true });
      },
    },
    { a: 6.8, b: 8.8, irisOut: true, // 4. close-up: mom calls the ambulance
      cam() { screenCam(); },
      world(lt) {
        bokeh(9, ['#3fb4a8', '#ffffff', '#ffd21f', '#ff6fb4']);
        phoneCloseUp(Math.round(W / 2), Math.round(H * 0.45), P.phoneU, lt);
      },
    },
    { a: 8.8, b: 11.2, irisIn: true, // 5. low angle: the hospital, the garage door rolls up
      ground: () => P.la ? P.la.bot : H,
      cam() { screenCam(); },
      world(lt) {
        lowAngle(lt);
        const gx = P.la.gx, bot = P.la.bot, d = lt < 1.0 ? 0 : 0.5 * 170 * (lt - 1.0) ** 2;
        const x = gx + 7 + d, yb = bot - 1 + Math.min(10, d * 0.12);
        P.laAmb = { x, yb, v: lt < 1 ? 0 : 170 * (lt - 1) };
        amb(x, yb, lt > 0.5, d > 0, false);
        P.laDoor();
      },
      lit() { lowAngleLit(); },
      upd(lt, dt) { if (P.laAmb) exhaust(dt, P.laAmb.x, P.laAmb.yb, P.laAmb.v); if (rumble) rumble(lt > 1 ? 0.1 : 0.03); },
    },
    { a: 11.2, b: 13.8, // 6. head-on: racing toward the camera
      ground: () => P.hy,
      cam() { screenCam(); },
      world(lt) { headOn(lt); },
      lit() { if (P.ho) headOnLit(P.ho.cx, P.ho.yb, P.ho.u); },
      upd() { if (rumble) rumble(0.12); },
    },
    { a: 13.8, b: 16.6, irisOut: true, // 7. bird's-eye: through town, cars move over
      ground: () => H,
      start() {
        st.cars = [
          { x: 70, y: 9, v: 30, horiz: true, c: COLOR.yellow.c, pull: -1, dir: 1, curb: 11 },
          { x: 132, y: 9, v: 26, horiz: true, c: COLOR.green.c, pull: -1, dir: 1, curb: 11 },
          { x: 120, y: -9, v: -24, horiz: true, c: COLOR.purple.c, pull: -1, dir: -1, curb: -11 },
          { x: 205, y: -70, v: -22, horiz: false, c: COLOR.blue.c, pull: -1, dir: 1, curb: 210 },
        ];
      },
      pos(lt) { return mapAt(lt * 118); },
      cam(lt) { const [x, y] = this.pos(lt); setCam(x, 2, 0, y); },
      world(lt) {
        birdsEye();
        for (const c of st.cars) topCar(Math.round(c.x), Math.round(c.y), c.horiz, c.c, c.pull >= 0);
        const [x, y, a] = this.pos(lt);
        topAmb(x, y, a);
      },
      lit(lt) {
        const [x, y, a] = this.pos(lt), on = ph2(7);
        const fx = x + Math.cos(a) * 6.5, fy = y + Math.sin(a) * 6.5, side = (on ? -3.5 : 3.5);
        alpha(0.35, () => circle(fx - Math.sin(a) * side, fy + Math.cos(a) * side, 5, RED_ON));
      },
      upd(lt, dt) {
        const [ax, ay] = this.pos(lt);
        for (const c of st.cars) {
          if (c.pull < 0 && ((c.horiz && Math.abs(ax - c.x) < 70 && (c.dir > 0 ? ax < c.x : true)) || (!c.horiz && ay - c.y < 70 && ax > 180))) c.pull = 0;
          if (c.pull >= 0) {
            c.pull += dt;
            const f = ease(clamp01(c.pull / 0.6)), sp = 1 - clamp01(c.pull / 0.7);
            if (c.horiz) { c.y = lerp(c.y0 ?? (c.y0 = c.y), c.curb, f); c.x += c.v * sp * dt; }
            else { c.x = lerp(c.x0 ?? (c.x0 = c.x), c.curb, f); c.y += c.v * sp * dt; }
          } else if (c.horiz) c.x += c.v * dt; else c.y += c.v * dt;
        }
        if (rumble) rumble(0.08);
      },
    },
    { a: 16.6, b: 19.2, irisIn: true, // 8. wide: the ambulance arrives, helpers hop out
      cam(lt, dt) { setCam(narrow() ? follow(lt < 1.5 ? this.ax(lt) + 40 : -24, dt, lt < 1.5 ? 6 : 2) : -46, zMid(), midGy()); },
      ax(lt) { const k = seg(lt, 0, 1.3); return lerp(-320, -128, 1 - (1 - k) ** 3); },
      world(lt) {
        playground(false);
        sitKid(0, 9, -1, 'sad', 'bump');
        drawPerson({ type: MOM.type, x: 20, yb: 14, dir: -1, pose: lt > 1.4 ? 'wave' : 'stand', skin: MOM.skin, seed: 4 });
        const m1 = seg(lt, 1.65, 2.45), m2 = seg(lt, 1.85, 2.55);
        if (lt > 1.65) medic(0, lerp(-56, -13, m1), lerp(30, PG_LANE + 1, m1), 1, 'stand', m1 < 1, lt < 1.85 ? Math.sin(seg(lt, 1.65, 1.85) * Math.PI) * 5 : 0);
        if (lt > 1.85) { const x = lerp(-58, -36, m2), y = lerp(30, PG_LANE + 1, m2); medic(1, x, y, 1, 'carry', m2 < 1, lt < 2.05 ? Math.sin(seg(lt, 1.85, 2.05) * Math.PI) * 5 : 0); bag(x + 7, y - 8, false); }
        amb(Math.round(this.ax(lt)), PG_BACK, true, lt < 1.3, false);
      },
      lit() { playground(true); },
      upd(lt, dt) { const k = seg(lt, 0, 1.3); exhaust(dt, this.ax(lt), PG_BACK, (1 - k) * 200); if (rumble) rumble(k < 1 ? 0.1 : 0); },
    },
    { a: 19.2, b: 20.8, // 9. close-up: a friendly paramedic
      cam() { screenCam(); },
      world(lt) {
        bokeh(21, ['#ffffff', '#e8222b', '#ffd21f', '#6fb6ff']);
        bigFace(W / 2, Math.round(H * 0.44), P.faceU, { skin: MED[0], hair: '#5a3a22', shirt: '#f4f7fb', shade: '#cfd8e2', mood: 'happy', cross: true, cap: true, wink: lt > 0.9 && lt < 1.3 });
      },
    },
    { a: 20.8, b: 22.8, // 10. close-up: the colorful bandage goes on
      cam() { screenCam(); },
      world(lt) { bokeh(33, ['#ffd21f', '#ff6fb4', '#ffffff']); kneeCloseUp(P.kneeX, Math.round(H * 0.5), P.kneeU, lt); },
      upd(lt) {
        once('band', lt > 0.8, () => {
          const cx = P.kneeX, cy = H * 0.5 - 7 * P.kneeU;
          sparkle(cx, cy, 10 * P.kneeU / 2, 16, '#fff27a'); sparkle(cx, cy, 8 * P.kneeU / 2, 10, '#ffffff'); sparkle(cx, cy, 9 * P.kneeU / 2, 8, '#ff6fb4');
        });
      },
    },
    { a: 22.8, b: 24.8, // 11. push-in: a big happy smile
      cam() { screenCam(); },
      world(lt) {
        bokeh(3, ['#ffd21f', '#ff6fb4', '#2a6fe0', '#ffffff']);
        const u = P.faceU * lerp(0.9, 1.35, ease(seg(lt, 0, 1.9)));
        bigFace(W / 2, Math.round(H * 0.44) - Math.abs(Math.sin(T * 7)) * u * 0.6, u, { skin: KID.skin, hair: KID.hair, shirt: OUTFITS.kid.shirt, shade: OUTFITS.kid.shade, mood: 'happy' });
      },
      upd(lt) {
        if (Math.floor(lt * 3) !== Math.floor((lt - 1 / 60) * 3)) addHeart(W / 2 + rand(-W * 0.3, W * 0.3), H * 0.3 + rand(-10, 10), true);
      },
    },
    { a: 24.8, b: 27.4, irisOut: true, // 12. wide: a ride on the stretcher, off to the hospital
      cam(lt, dt) { setCam(narrow() ? follow(lt < 0.8 ? -24 : lt < 2.3 ? clamp(this.crewAt(lt)[0], -100, -24) : this.ax(lt) + 40, dt, 3) : -46, zMid(), midGy()); },
      path: [[-34, PG_LANE + 1], [-140, 32], [-140, PG_BACK], [-96, PG_BACK]],
      crewAt(lt) {
        const pts = this.path, f = seg(lt, 0.8, 2.0);
        let L0 = 0; const ls = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); ls.push(l); L0 += l; }
        let d = f * L0;
        for (let i = 1; i < pts.length; i++) { if (d <= ls[i - 1] || i === pts.length - 1) { const k = Math.min(1, d / ls[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k), pts[i][0] >= pts[i - 1][0] ? 1 : -1]; } d -= ls[i - 1]; }
        return pts[0];
      },
      ax(lt) { return -128 + (lt > 2.3 ? 0.5 * 320 * (lt - 2.3) ** 2 : 0); },
      world(lt) {
        playground(false);
        const momF = seg(lt, 0.9, 1.9);
        if (lt < 2.1) alpha(1 - seg(lt, 1.9, 2.1), () => drawPerson({ type: MOM.type, x: lerp(20, -60, momF), yb: lerp(14, 32, momF), dir: momF > 0 && momF < 1 ? -1 : -1, pose: lt < 0.8 ? 'cheer' : 'stand', walk: momF > 0 && momF < 1, skin: MOM.skin, seed: 4 }));
        const ax = Math.round(this.ax(lt));
        const [cx, cy, dir] = this.crewAt(lt), moving = lt > 0.8 && lt < 2.0;
        const hop = seg(lt, 0.1, 0.6);
        const crew = () => {
          medic(0, cx - 21, cy, dir, dir > 0 ? 'carry' : 'stand', moving);
          stretcher(cx, cy);
          if (hop >= 1) sitKid(cx - 2, cy - 14, -1, 'wave', 'band');
          medic(1, cx + 21, cy, dir, dir > 0 ? 'stand' : 'carry', moving);
        };
        if (lt < 2.05) clipOut(ax, PG_BACK, crew);
        if (hop < 1) { const f = ease(hop); sitKid(lerp(0, -36, f), lerp(9, PG_LANE + 1 - 14, f) - Math.sin(hop * Math.PI) * 12, -1, hop > 0 ? 'happy' : 'wave', 'band'); }
        amb(ax, PG_BACK, true, lt > 2.3, lt < 2.15);
      },
      lit() { playground(true); },
      upd(lt, dt) {
        once('land', lt > 0.6, () => sparkle(sx(-36), sy(0), 10, 8, '#ffffff'));
        if (lt > 2.3) { exhaust(dt, this.ax(lt), PG_BACK, 320 * (lt - 2.3)); if (rumble) rumble(0.1); }
      },
    },
    { a: 27.4, b: 29.0, irisIn: true, // 13. at the hospital: out the door with a balloon
      cam() { setCam(-14, 2, bigL() ? 0.66 : closeGy()); },
      world(lt) { hospScene(27.4 + lt); },
      lit() { hospitalSide(true, P.bayOpen); },
    },
    { a: 29.0, b: 30.4, // 14. push-in: a big family hug
      cam() { setCam(-30, zHug(), hugGy()); },
      world(lt) { hospScene(29.0 + lt); },
      lit() { hospitalSide(true, P.bayOpen); },
      upd(lt) {
        once('hug', lt > 0.05, () => { for (let i = 0; i < 6; i++) addHeart(sx(-30) + rand(-20, 20), sy(-26), true); sparkle(sx(-30), sy(-20), 24, 14); });
        if (lt < 1.2) confetti(2);
      },
    },
    { a: 30.4, b: END, irisOut: true, // 15. final wide: bye-bye, back into the garage
      cam(lt, dt) { setCam(follow(lt < 0.6 ? -14 : -60, dt, 2), 1, wideGy()); },
      world(lt) { hospScene(30.4 + lt); },
      lit() { hospitalSide(true, P.bayOpen); },
      upd(lt, dt) {
        const a = P.hAmb;
        if (a && a.v) { exhaust(dt, a.x, a.yb, Math.abs(a.v), -1); st.beepT -= dt; if (st.beepT <= 0) { st.beepT = 0.4; if (!st.ff) tone('square', 1046, 0, 0.16, 0.045); } }
        if (rumble) rumble(a && a.v ? 0.08 : 0);
        if (lt > 2.0 && lt < 2.6) confetti(3);
      },
    },
  ];
  // the hospital scene runs on absolute time across shots 13–15
  function hospScene(t) {
    const lt = t - 27.4;
    P.doorOpen = lt > 0.25 && lt < 1.8;
    // ambulance: parked right of the door, later reverses into the garage
    const rv = seg(t, 31.0, 32.3), ax = lerp(40, -143, ease(rv)), ayb = ax > -73 ? HS_BACK : lerp(HS_BACK, -2, (-73 - ax) / 70);
    P.hAmb = { x: ax, yb: ayb, v: rv > 0 && rv < 1 ? -140 : 0 };
    P.bayOpen = 1 - seg(t, 32.3, 32.8);
    hospitalGround();
    hospitalSide(false, P.bayOpen);
    const people = [];
    const hug = t > 29.0, cele = t > 29.0;
    // kid: out the door, then hugs
    const kf = seg(t, 27.8, 28.7);
    if (t > 27.8) people.push([9, () => alpha(seg(t, 27.8, 28.0), () => {
      const hop = cele && t < 30.4 ? Math.abs(Math.sin(T * 7)) * 3 : 0;
      standKid(lerp(0, -24, kf), lerp(3, 9, kf), hug ? -1 : -1, cele ? (Math.floor(T / 1.4) % 2 ? 'cheer' : 'wave') : 'stand', kf > 0 && kf < 1, hop);
    })]);
    const mf = seg(t, 28.0, 28.9);
    if (t > 28.0) people.push([9.5, () => alpha(seg(t, 28.0, 28.2), () => drawPerson({ type: MOM.type, x: lerp(0, -38, mf), yb: lerp(3, 10, mf), dir: hug ? 1 : -1, pose: hug ? 'carry' : 'stand', walk: mf > 0 && mf < 1, skin: MOM.skin, seed: 4 }))]);
    const df = seg(t, 27.6, 28.8);
    people.push([10, () => drawPerson({ type: DAD.type, x: lerp(-160, -54, df), yb: 11, dir: 1, pose: hug ? 'cheer' : 'stand', walk: df < 1, skin: DAD.skin, hair: DAD.hair, seed: 5, hop: hug && t < 30.4 ? Math.abs(Math.sin(T * 6 + 1)) * 2 : 0 })]);
    // medics out after the kid, wave, then hop back in the ambulance
    for (const i of [0, 1]) {
      const of = seg(t, 28.1 + i * 0.2, 28.9 + i * 0.2), back = seg(t, 30.4 + i * 0.1, 30.9 + i * 0.1);
      if (t < 28.1 + i * 0.2 || back >= 1) continue;
      const tx = i ? 26 : 12, x = back > 0 ? lerp(tx, 52 + i * 8, back) : lerp(0, tx, of);
      people.push([8, () => alpha(Math.min(seg(t, 28.1 + i * 0.2, 28.3 + i * 0.2), 1 - seg(back, 0.6, 1)), () =>
        medic(i, x, lerp(3, 8, of), back > 0 ? 1 : of < 1 ? 1 : -1, cele && back <= 0 ? 'wave' : 'stand', (of > 0 && of < 1) || (back > 0 && back < 1)))]);
    }
    const drawAmb = () => amb(Math.round(ax), Math.round(ayb), rv > 0 && rv < 1, rv > 0 && rv < 1, false, 1);
    if (ayb < 8) { drawAmb(); P.bayDoor(); }
    people.sort((a, b) => a[0] - b[0]).forEach(p => p[1]());
    if (ayb >= 8) { drawAmb(); P.bayDoor(); }
  }

  /* ---------- scene plumbing ---------- */
  function once(key, cond, fn) { if (cond && !st.fired[key]) { st.fired[key] = true; fn(); } }
  function shotAt(t) { for (let i = 0; i < SHOTS.length; i++) if (t < SHOTS[i].b) return i; return SHOTS.length - 1; }

  function layout() {
    const pr = portrait();
    P.capWide = L.sunY + 34 - Math.round(H * wideGy());
    P.hospH = clamp(Math.round(H * wideGy()) - L.sunY - 64, 70, 200);
    P.faceU = Math.max(2, Math.floor(Math.min(W * 0.8, H * 0.62) / 34));
    P.phoneU = Math.max(2, Math.floor(Math.min(W * 0.62, H * 0.62) / 48));
    P.kneeU = pr ? Math.max(2, Math.floor(W / 60)) : Math.max(2, Math.floor(H * 0.6 / 60 * 1.6));
    P.kneeX = Math.round(pr ? W * 0.64 : W * 0.56);
    P.hy = Math.round(H * (pr ? 0.4 : 0.42));
    P.K = (H - P.hy) * 20;
    P.Zend = 1.1 * P.K / Math.min(W * 0.9, (H - P.hy) * 0.95 * 32 / 36 * 1.3, (H * 0.62) * 32 / 36);
    if (scene === 'movieAmb') setClouds(L.safeT + 10, L.safeT + (pr ? 90 : 40));
  }
  function enter() {
    ranOut = false; hush();
    Object.assign(st, { t: 0, shot: -1, cue: 0, fired: {}, done: false, hearts: [], cars: [], puffT: 0, beepT: 0, run: (st.run || 0) + 1, paused: false, ui: 0, drag: null, ff: false });
    resumeLine = null;
    camS = null;
    if (!st.saved) st.saved = clouds;
    layout();
    for (let n = 1; n <= 10; n++) loadNarr(n);
    loadSound();
  }
  function leave() {
    st.run = (st.run || 0) + 1;
    hush(); resumeLine = null;
    st.paused = false; st.drag = null; st.ui = 0;
    if (st.saved) { clouds = st.saved; st.saved = null; }
  }
  function finish() {
    if (st.done) return;
    st.done = true; hush();
    goScene(SCENES.movies ? 'movies' : 'station', { watched: 'amb' });
  }
  function update(dt) {
    if (st.done) return;
    loadSound();
    st.ui = Math.max(0, st.ui - dt);
    if (st.paused || st.drag != null) { hush(); if (st.shot >= 0) SHOTS[st.shot].cam(st.lt, 0); return; }
    st.t += dt;
    while (st.cue < CUES.length && CUES[st.cue][0] <= st.t) { const fn = CUES[st.cue++][1]; if (CUES[st.cue - 1][0] > st.t - 0.5) fn(); }
    musicTick();
    SIREN.set(sirenAt(st.t) ? 1 : 0);
    const i = shotAt(st.t), s = SHOTS[i];
    if (i !== st.shot) { st.shot = i; camS = null; if (s.start) s.start(); }
    st.lt = st.t - s.a;
    s.cam(st.lt, dt);
    st.rumbled = false;
    if (s.upd) s.upd(st.lt, dt);
    if (!st.rumbled) ENGINE.set(0);
    for (const h of st.hearts) { h.life -= dt; h.x += h.vx * dt; h.y += h.vy * dt; }
    st.hearts = st.hearts.filter(h => h.life > 0);
    if (st.t >= END) { ranOut = true; finish(); }
  }

  /* ---------- pause button and draggable timeline (tap anywhere to show them) ---------- */
  function ctl() {
    const b = 26, cy = H - L.safeB - 30, cx = Math.round(W / 2), half = Math.round(Math.min(W - L.safeL - L.safeR - 32, 360) / 2);
    return { play: { x: cx - b / 2, y: cy - b / 2, s: b }, track: { x0: cx - half, x1: cx + half, y: cy - b / 2 - 14 } };
  }
  const tAtX = (c, x) => END * clamp01((x - c.track.x0) / (c.track.x1 - c.track.x0));
  function drawControls() {
    const c = ctl(), k = Math.min(1, st.paused ? 1 : st.ui / 0.3);
    if (k <= 0) return;
    alpha(k, () => {
      const { x0, x1, y } = c.track, w = x1 - x0;
      alpha(0.45, () => R(x0 - 6, y - 8, w + 12, 16, BLACK));
      R(x0, y - 1, w, 3, '#6a6478');
      for (const s of SHOTS) R(Math.round(x0 + w * s.a / END), y - 3, 1, 7, '#cfc8dc');
      const kx = Math.round(x0 + w * Math.min(1, st.t / END));
      R(x0, y - 1, kx - x0, 3, '#ffd21f'); circle(kx, y, 5, '#ffffff'); circle(kx, y, 3, '#ffd21f');
      const b = c.play, mx = b.x + b.s / 2, my = b.y + b.s / 2;
      alpha(0.55, () => R(b.x, b.y, b.s, b.s, BLACK));
      if (st.paused) for (let i = 0; i < 6; i++) R(mx - 3 + i, my - 6 + i, 1, 13 - 2 * i, '#ffffff');
      else { R(mx - 5, my - 6, 4, 13, '#ffffff'); R(mx + 1, my - 6, 4, 13, '#ffffff'); }
    });
  }
  function setPaused(p) {
    if (p === st.paused) return;
    st.paused = p;
    if (p) { resumeLine = ac && ac.currentTime < narrEnd - 0.2 ? lastLine : null; hush(); }   // a line cut off by the pause starts over on play
    else if (resumeLine) { const n = resumeLine; resumeLine = null; narr(n); }
  }
  // jump to any moment: past cues stay quiet, the siren, engine and music pick up from the clock
  function seek(t) {
    hush(); resumeLine = null; st.run = (st.run || 0) + 1;
    const target = clamp(t, 0, END - 0.05);
    st.cue = 0; while (st.cue < CUES.length && CUES[st.cue][0] <= target) st.cue++;
    st.fired = {};
    // replay the shot quietly up to now, so whatever moves in it (cars pulling over) is in place
    const i = shotAt(target), s = SHOTS[i], dt = 1 / 30;
    st.shot = i; camS = null; if (s.start) s.start();
    st.ff = true;
    try {
      for (st.t = s.a; st.t < target; st.t = Math.min(target, st.t + dt)) { st.lt = st.t - s.a; s.cam(st.lt, dt); if (s.upd) s.upd(st.lt, dt); }
    } finally { st.ff = false; }
    st.t = target; st.lt = st.t - s.a; s.cam(st.lt, dt);
    parts = []; st.hearts = [];
  }

  function iris(k, cx, cy) {
    if (k >= 1) return;
    const rad = ease(clamp01(k)) * Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - cy;
      if (Math.abs(dy) >= rad) { R(0, y, W, 1, BLACK); continue; }
      const dx = Math.sqrt(rad * rad - dy * dy);
      if (cx - dx > 0) R(0, y, cx - dx, 1, BLACK);
      if (cx + dx < W) R(cx + dx, y, W - cx - dx, 1, BLACK);
    }
  }
  function homeBtn() { const s = 24; return { x: L.safeL + 8, y: H - L.safeB - s - 12, s }; }
  function drawFinale(k) {
    alpha(0.32 * k, () => R(0, 0, W, H, BLACK));
    const pop = k < 1 ? 1 - (1 - k) ** 3 * Math.cos(k * 6) : 1 + 0.06 * Math.sin(T * 6);
    const r = Math.max(4, Math.round(Math.min(W, H) * 0.1 * pop)), cx = Math.round(W / 2), cy = Math.round(H * 0.44 - r);
    heart(cx, cy, r + 2, '#ffffff'); heart(cx, cy, r, RED);
    circle(cx - r - Math.round(r * 0.3), cy - Math.round(r * 0.3), Math.round(r * 0.35), '#ff7a6b');
    const u = Math.max(2, Math.round(r / 5)), my = cy + Math.round(r * 0.55);
    R(cx - u, my - 3 * u, 2 * u, 6 * u, '#ffffff'); R(cx - 3 * u, my - u, 6 * u, 2 * u, '#ffffff');
  }

  SCENES.movieAmb = {
    noWeather: true,   // cutscenes have indoor shots; keep them dry
    view: [186, 200],
    freeTouch: true,
    layout, enter, leave, update,
    groundY() { const s = SHOTS[Math.max(0, st.shot)]; return s.ground ? s.ground() : Math.round(cam.oy + HZ * cam.z); },
    drawWorld() {
      const s = SHOTS[Math.max(0, st.shot)];
      g.setTransform(cam.z, 0, 0, cam.z, cam.ox, cam.oy);
      s.world(st.lt);
      g.setTransform(1, 0, 0, 1, 0, 0);
      for (const d of vDraws) { d.x = cam.ox + d.x * cam.z; d.yb = cam.oy + d.yb * cam.z; }
    },
    drawLit() {
      const s = SHOTS[Math.max(0, st.shot)];
      if (s.lit) { g.setTransform(cam.z, 0, 0, cam.z, cam.ox, cam.oy); s.lit(st.lt); g.setTransform(1, 0, 0, 1, 0, 0); }
      for (const h of st.hearts) alpha(Math.min(1, h.life * 2), () => heart(h.x, h.y, h.r, h.c));
      drawParticles();
    },
    drawUI() {
      const s = SHOTS[Math.max(0, st.shot)], lt = st.lt;
      if (st.t > 32.35) drawFinale(seg(st.t, 32.35, 32.75));
      let k = 1;
      if (s.irisIn) k = Math.min(k, lt / 0.35);
      if (s.irisOut) k = Math.min(k, (s.b - st.t) / 0.35);
      iris(k, W / 2, H * 0.45);
      const bx = L.safeL + 8, bw = W - L.safeL - L.safeR - 16, by = H - L.safeB - 5;
      alpha(0.35, () => R(bx, by, bw, 2, BLACK));
      alpha(0.85, () => R(bx, by, Math.round(bw * clamp01(st.t / END)), 2, '#fff6e0'));
      drawControls();
      drawHomeButton(homeBtn());
    },
    tap(x, y, id) {
      if (inBox(homeBtn(), x, y)) { SFX.boop(); finish(); return true; }
      const c = ctl();
      if (st.paused || st.ui > 0) {
        st.ui = 3.5;
        if (inBox(c.play, x, y, 6)) { setPaused(!st.paused); return true; }
        if (x >= c.track.x0 - 10 && x <= c.track.x1 + 10 && Math.abs(y - c.track.y) <= 14) { st.drag = id; seek(tAtX(c, x)); return true; }
      }
      st.ui = 3.5;
      sparkle(x, y, 4, 3, '#ffffff');
      return true;
    },
    move(x, y, id) { if (st.drag === id) { st.ui = 3.5; seek(tAtX(ctl(), x)); } },
    release(id) { if (st.drag === id) { st.drag = null; st.ui = 3.5; } },
    get clock() { return st.t; },   // seconds into the episode (read-only, for tests)
    _st: st, _jump(t) { seek(t); }, _paused(p) { setPaused(p); },
  };
})();
