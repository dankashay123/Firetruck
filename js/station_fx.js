// Station extras: the big red alarm bell and the fire drill it starts, and weather you can feel.
// - Tap the alarm bell on the front of the station: it rings, everyone (even the sleepy one)
//   races to the pole and slides down, the dogs run round and round in circles, and the fire
//   truck, police car and ambulance all roll out with their sirens, then come home: HOORAY!
// - Rain: puddles grow on the road (tap them, or watch the trucks splash through them), people
//   outside pop open umbrellas, the cat hides under the fire truck, and when it really pours
//   there's a thunderstorm with lightning and rumbles (everyone jumps, the dogs bark).
'use strict';
const FX = (() => {
  const st = { ring: 0, drill: null, wet: 0, puddles: [], words: [], flash: 0, bolt: null, nextBolt: 6, zoom: 0, cheer: 0 };
  const P = {};   // layout
  let api = null;  // hooks into the station: rush, trips, allHome, hop, pending, bed

  const SND = TOY.bank({ thunder: ['wx-thunder', 0.8], rain: ['wx-rain', 0.5], splash: ['bath-splash', 0.55], splash2: ['bath-splash2', 0.5], bark: ['dog-bark', 0.6], bark2: ['dog-bark-2', 0.55], meow: ['cat-meow', 0.5] }, {
    thunder() { noise(0, 2.2, 0.12, 90, 0.6); noise(0.1, 1.4, 0.08, 160, 0.8); }, splash() { noise(0, 0.4, 0.12, 1400, 0.7); }, splash2() { noise(0, 0.5, 0.1, 1100, 0.7); },
    bark() { tone('square', 330, 0, 0.09, 0.08, 220); }, bark2() { tone('square', 290, 0, 0.09, 0.08, 200); }, meow() { tone('sine', 700, 0, 0.4, 0.06, 500); },
  });
  const rainLoop = SND.loop('rain');
  // a proper old-fashioned fire bell: a little hammer drumming on a brass gong
  function bellRing(dur) {
    if (!ac) return;
    for (let t = 0; t < dur; t += 0.055) { tone('triangle', 1180, t, 0.05, 0.05); tone('sine', 2360, t, 0.04, 0.025); }
  }

  /* ---------- layout ---------- */
  function layout(B) {
    const signW = 104, sx = Math.floor(B.mainX + (B.w - B.annexW - signW) / 2), right = B.x + B.w;
    P.bx = Math.round(sx + signW + (right - (sx + signW)) / 2); P.by = B.signTop + 11; P.br = 8;
    P.floorY = L.floorY; P.roadY = L.roadY; P.laneY = L.laneY; P.B = B;
    P.zx = B.x + B.w / 2; P.zy = L.floorY + 7; P.zr = Math.min(70, B.w / 2 - 10);
    // puddles on the road, in front of the bays and beyond
    const xs = [B.x - 60, B.x + 30, B.x + B.w * 0.45, B.x + B.w - 30, B.x + B.w + 50, B.x + B.w + 120, B.x - 130].filter(x => x > L.safeL + 14 && x < W - L.safeR - 14);
    st.puddles = xs.map((x, i) => ({ x: Math.round(x), y: L.roadY + 9 + (i % 3) * 9, rx: 10 + (i % 3) * 3, splash: 0, i }));
  }

  /* ---------- the alarm and the drill ---------- */
  // Police car first, then the fire truck, then the ambulance: each one leaves only when the one
  // before it has driven off the screen. They wait out of sight for 3 seconds, then come home one
  // at a time in the same order, each setting off once the one before it has parked.
  const ORDER = [VI.police, VI.fire, VI.amb];
  function startDrill() {
    if (st.drill || !api || api.bed() || api.pending()) return;
    st.ring = 2.8; bellRing(2.8);
    st.drill = { t: 0, phase: 'out', i: 0, wait: 1.0, sent: [], done: false, doneT: 0 };
    word('RING RING!', P.bx - 26, P.by - 22, '#ffd21f');
    api.rush();
    st.zoom = 7;
  }
  function updateDrill(dt) {
    const d = st.drill; if (!d) return;
    d.t += dt;
    if (st.zoom > 0 && Math.random() < dt * 1.5) SND.play(Math.random() < 0.5 ? 'bark' : 'bark2');
    if (d.phase === 'out') {
      if ((d.wait -= dt) <= 0) {
        const vi = ORDER[d.i];
        if (d.i >= ORDER.length) { d.phase = 'away'; d.wait = 3; }
        else if (!d.sent.includes(vi)) { if (api.trip(vi)) d.sent.push(vi); else { d.i++; d.wait = 0; } }   // already out? skip it
        else if (api.held(vi)) { d.i++; d.wait = 0.2; }
      }
    } else if (d.phase === 'away') {
      if ((d.wait -= dt) <= 0) { d.phase = 'home'; d.i = 0; d.wait = 0; }
    } else if (d.phase === 'home') {
      const list = ORDER.filter(vi => d.sent.includes(vi));
      if (d.i >= list.length) d.phase = 'end';
      else {
        const vi = list[d.i];
        if (api.held(vi)) { if ((d.wait -= dt) <= 0) api.release(vi); }
        else if (api.parked(vi)) { d.i++; d.wait = 0.4; }
      }
    } else if (d.phase === 'end' && !d.done) {
      d.done = true; st.cheer = 2;
      confetti(50); [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, i * 0.12, i === 3 ? 0.5 : 0.14, 0.06));
      word('HOORAY!', P.zx - 24, P.B.signTop - 4, '#ffd21f');
    }
    if (d.done && (d.doneT += dt) > 3) st.drill = null;
    if (d.t > 90) { for (const vi of ORDER) api.release(vi); st.drill = null; }   // never get stuck
  }
  function drawBell() {
    const shake = st.ring > 0 ? (Math.floor(T * 30) % 2 ? 1 : -1) : 0, x = P.bx + shake, y = P.by, r = P.br;
    R(P.bx - 2, y - r - 3, 4, 3, '#5a5f6e');                     // the bracket on the wall
    circle(x, y + 1, r + 1, '#7a1018');
    circle(x, y, r, '#e8222b'); circle(x - 2, y - 2, r - 3, '#ff5a4a'); R(x - 4, y - 5, 2, 2, '#ffd0c8');
    circle(x, y, 2, '#ffd21f');
    // the striker: hammering away while it rings
    const hx = x + (st.ring > 0 ? (Math.floor(T * 30) % 2 ? 3 : 5) : 5);
    R(x + 1, y + r - 1, 1, 4, '#5a5f6e'); R(hx - 1, y + r + 2, 3, 3, '#ffd21f');
    if (st.ring > 0) { const k = Math.floor(T * 10) % 2; R(x - r - 4 - k, y - 3, 2, 1, '#ffd21f'); R(x - r - 5 - k, y + 1, 2, 1, '#ffd21f'); R(x + r + 3 + k, y - 3, 2, 1, '#ffd21f'); R(x + r + 4 + k, y + 1, 2, 1, '#ffd21f'); }
    else if (!st.drill && Math.floor(T * 1.2) % 4 === 0) R(x - 1, y - r - 6, 3, 1, '#ffffff');   // a little twinkle: tap me!
  }
  // the dogs run round and round in circles during the drill
  function drawZoomies() {
    if (st.zoom <= 0) return;
    const D = SCENES.icecream && SCENES.icecream._dogs; if (!D) return;
    const k = Math.min(1, st.zoom / 1);
    ['vizsla', 'husky'].forEach((who, i) => {
      const a = T * 3.4 + i * Math.PI, x = P.zx + Math.cos(a) * P.zr * k, y = P.zy + Math.sin(a) * 3;
      D[who](Math.round(x), Math.round(y), Math.sin(a) > 0 ? -1 : 1, { run: true, wag: true, bark: Math.floor(T * 4 + i) % 3 === 0, hop: Math.abs(Math.sin(T * 12 + i)) * 2 });
    });
  }

  /* ---------- weather ---------- */
  const rainy = () => weather.kind === 'rain' && weather.k > 0.35;
  const stormy = () => weather.kind === 'rain' && weather.k > 0.9;
  function updateWeather(dt) {
    const raining = weather.kind === 'rain' && weather.now === 'rain';
    st.wet = Math.max(0, Math.min(1, st.wet + (raining ? dt / 6 : -dt / 25)));
    rainLoop(weather.kind === 'rain' ? weather.k * 0.6 : 0);
    for (const p of st.puddles) p.splash = Math.max(0, p.splash - dt);
    // trucks splash through the puddles
    if (st.wet > 0.2) for (const v of V) {
      if (v.state !== 'drive' && v.state !== 'arrive') continue;
      for (const p of st.puddles) {
        const front = v.x + v.len * 0.8;
        if (Math.abs(front - p.x) < 4 && Math.abs(v.y - (p.y + 4)) < 26 && p.splash <= 0) { p.splash = 0.8; splashAt(p, true); }
      }
    }
    // thunderstorms when it really pours
    if (stormy() && !(api && api.bed())) {
      st.nextBolt -= dt;
      if (st.nextBolt <= 0) { st.nextBolt = rand(7, 13); lightning(); }
    } else st.nextBolt = Math.min(st.nextBolt, 3);
    st.flash = Math.max(0, st.flash - dt * 2.4);
    if (st.bolt) { st.bolt.t -= dt; if (st.bolt.t <= 0) st.bolt = null; }
  }
  function lightning() {
    const x0 = rand(W * 0.15, W * 0.85), pts = [[x0, L.safeT + 10]];
    let x = x0, y = L.safeT + 10; const bottom = Math.max(L.safeT + 60, P.B.top - 50);
    while (y < bottom) { x += rand(-10, 10); y += rand(6, 12); pts.push([x, Math.min(y, bottom)]); }
    st.bolt = { pts, t: 0.3 }; st.flash = 1;
    setTimeout(() => { SND.play('thunder', rand(0.85, 1.1)); if (api) api.jump(); }, 350);
    setTimeout(() => SND.play(Math.random() < 0.5 ? 'bark' : 'bark2'), 900);
    word('BOOM!', x0 - 14, L.safeT + 30, '#fff3a6');
  }
  function splashAt(p, big) {
    SND.play(big ? 'splash' : 'splash2', rand(0.9, 1.2));
    spawn(big ? 22 : 14, () => ({ x: p.x + rand(-p.rx, p.rx), y: p.y, vx: rand(-40, 40), vy: rand(-90, -40), g: 220, life: 0.7, max: 0.7, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.5 ? '#9fd2ef' : '#e6f6ff' }));
    word('SPLASH!', p.x - 18, p.y - 22, '#bfe6ff');
  }
  function drawPuddles() {
    if (st.wet <= 0.02) return;
    for (const p of st.puddles) {
      const rx = Math.round(p.rx * (0.4 + 0.6 * st.wet)), ry = Math.max(1, Math.round(rx / 5));
      alpha(Math.min(1, st.wet * 1.6), () => {
        TOY.oval(p.x, p.y + 4, rx, ry + 1, '#3d5a86');
        TOY.oval(p.x, p.y + 4, rx - 1, ry, '#5a86c0');
        R(p.x - Math.round(rx / 2), p.y + 3, Math.round(rx / 3), 1, '#a8d4f4');
        // raindrop rings
        if (weather.kind === 'rain' && weather.k > 0.2) { const k = (T * 1.7 + p.i * 0.37) % 1, rr = Math.round(1 + k * rx * 0.5), cx = p.x + Math.round(Math.sin(p.i * 3 + Math.floor(T * 1.7)) * rx * 0.5); alpha(1 - k, () => { R(cx - rr, p.y + 4, 1, 1, '#d8f0ff'); R(cx + rr, p.y + 4, 1, 1, '#d8f0ff'); R(cx, p.y + 3, 1, 1, '#d8f0ff'); }); }
      });
    }
  }
  // a little umbrella over someone outside in the rain (h: how tall they are)
  const UMB = ['#e8222b', '#ffd21f', '#2a6fe0', '#ff6fb4', '#3fb43a', '#8a4fd9'];
  function umbrella(x, yb, h = 22, seed = 0) {
    if (!rainy()) return;
    const c = UMB[Math.abs(Math.round(seed * 7)) % UMB.length], top = Math.round(yb - h - 3), cx = Math.round(x);
    R(cx, top + 1, 1, h - 6, '#3a3d46');
    for (let i = 0; i < 4; i++) R(cx - 7 + i, top - 3 + i, 15 - 2 * i, 1, i === 0 ? '#ffffff' : c);
    R(cx - 8, top + 1, 17, 2, c); R(cx - 8, top + 2, 3, 1, '#ffffff'); R(cx + 6, top + 2, 3, 1, '#ffffff'); R(cx - 1, top + 2, 3, 1, '#ffffff');
    R(cx, top - 5, 1, 2, '#3a3d46');
  }
  // the cat hides under the parked fire truck while it rains
  const catHides = () => rainy() || st.flash > 0;
  function drawCatUnderTruck() {
    if (!catHides()) return;
    const v = V[VI.fire];
    if (v.state !== 'parked') return;
    const x = Math.round(v.x + 39), y = L.floorY;
    PETS.catSleep(x, y, -1);
    // peeking: eyes open between naps
    if (Math.floor(T * 0.6) % 3) { R(x - 5, y - 5, 1, 1, '#a8d048'); R(x - 3, y - 5, 1, 1, '#a8d048'); }
  }
  function word(s, x, y, c = '#ffffff') { st.words.push({ s, x, y, c, life: 1.3 }); }

  /* ---------- per-frame ---------- */
  function update(dt) {
    st.ring = Math.max(0, st.ring - dt); st.zoom = Math.max(0, st.zoom - dt); st.cheer = Math.max(0, st.cheer - dt);
    updateDrill(dt);
    updateWeather(dt);
    for (const w of st.words) { w.life -= dt; w.y -= 9 * dt; }
    st.words = st.words.filter(w => w.life > 0);
  }
  function drawLit() {
    if (st.bolt) {
      const pts = st.bolt.pts;
      for (let i = 0; i + 1 < pts.length; i++) { TOY.bar(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 3, '#fff3a6'); TOY.bar(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1, '#ffffff'); }
    }
    if (st.ring > 0 && Math.floor(T * 6) % 2) alpha(0.12, () => R(0, 0, W, H, '#ff3b3b'));
    for (const w of st.words) {
      const tw = textWidth(w.s, 2), x = Math.max(L.safeL + 2, Math.min(W - L.safeR - tw - 2, Math.round(w.x))), y = Math.round(Math.max(L.safeT + 2, w.y));
      alpha(Math.min(1, w.life * 2), () => { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(w.s, x + dx, y + dy, 2, INK); text(w.s, x, y, 2, w.c); });
    }
  }
  function drawFlash() { if (st.flash > 0) alpha(st.flash * 0.55, () => R(0, 0, W, H, '#ffffff')); }
  function tap(x, y) {
    if ((x - P.bx) ** 2 + (y - P.by) ** 2 <= (P.br + 6) ** 2) {
      if (st.drill) { bellRing(0.6); st.ring = Math.max(st.ring, 0.6); } else startDrill();
      return true;
    }
    if (st.wet > 0.25) for (const p of st.puddles) if (Math.abs(x - p.x) < p.rx + 3 && Math.abs(y - (p.y + 4)) < 7) { splashAt(p, false); return true; }
    return false;
  }

  return {
    init(hooks) { api = hooks; }, layout, update, drawBell, drawZoomies, drawPuddles, drawCatUnderTruck, drawLit, drawFlash, tap, umbrella, startDrill,
    get rainy() { return rainy(); }, get catHides() { return catHides(); }, get zoom() { return st.zoom > 0; }, get drill() { return !!st.drill; }, get cheer() { return st.cheer > 0; },
    leave() { rainLoop(0); }, _st: st, _P: P,
  };
})();
