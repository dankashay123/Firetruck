// The cinema: pick the fire truck, police car or ambulance to watch its little cartoon.
'use strict';
(() => {
  const EPISODES = [
    { kind: 'fire', scene: 'movieFire', i: VI.fire, bg: '#e8222b' },
    { kind: 'police', scene: 'moviePolice', i: VI.police, bg: '#2a6fe0' },
    { kind: 'amb', scene: 'movieAmb', i: VI.amb, bg: '#f4f7fb' },
    { kind: 'book', scene: 'movieBook', cover: true, bg: '#e2b440', sky: '#f4c8b2' },
    { kind: 'dogs', scene: 'movieDogs', cover: true, bg: '#5a9a42', sky: '#a2d2ee' },
  ];
  const st = { cards: [], watched: null, t: 0, scale: 1 };
  let tmp = null;

  // Draw a vehicle scaled up by an integer factor, keeping the pixels crisp.
  function drawVBig(i, cx, yb, scale, lit, art) {
    if (!tmp) { tmp = document.createElement('canvas'); tmp.width = 72; tmp.height = 46; }
    const tg = tmp.getContext('2d'), prev = g;
    tg.clearRect(0, 0, 72, 46);
    g = tg; if (art) art(3, 44); else drawV(i, 3, 44, lit, 0, T * 6, true); g = prev;
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, Math.round(cx - 36 * scale), Math.round(yb - 44 * scale), 72 * scale, 46 * scale);
  }

  function layout() {
    const x0 = L.safeL + 8, x1 = W - L.safeR - 8, y0 = L.safeT + 6, y1 = H - L.safeB - 6;
    const uw = x1 - x0, uh = y1 - y0;
    st.header = { y: y0, h: Math.min(46, Math.round(uh * 0.14)) };
    const avail = EPISODES.filter(e => SCENES[e.scene]);
    const n = Math.max(1, avail.length), top = y0 + st.header.h + 8, bottomPad = L.blob + 12;
    // try every column count; keep the one with the biggest cards that still hold their picture
    const availH = y1 - bottomPad - top;
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cw = Math.floor((uw - (cols - 1) * 10) / cols), ch = Math.floor((availH - (rows - 1) * 8) / rows);
      const scale = cw >= 160 && ch >= 116 ? 2 : 1, fit = Math.min(cw / (80 * scale), ch / (62 * scale)) * scale;
      if (!best || fit > best.fit) best = { cols, rows, scale, fit, cw: Math.min(cw, scale === 2 ? 160 : 100), h: Math.min(ch, scale === 2 ? 116 : 64), ch };
    }
    const { cols, rows, cw, h } = best;
    st.scale = best.scale;
    const gapY = Math.max(8, Math.min(24, (availH - rows * h) / (rows + 1))), gridH = rows * h + (rows - 1) * gapY;
    const gy = Math.round(top + (availH - gridH) / 2);
    st.cards = avail.map((e, k) => {
      const row = Math.floor(k / cols), inRow = Math.min(cols, n - row * cols), col = k % cols;
      const rowW = inRow * cw + (inRow - 1) * 10;
      return { e, x: Math.round(x0 + (uw - rowW) / 2 + col * (cw + 10)), y: Math.round(gy + row * (h + gapY)), w: cw, h };
    });
    st.home = { x: L.safeL + 8, y: y1 - L.blob, s: L.blob };
  }

  function drawCurtains() {
    R(0, 0, W, H, '#2a1420');
    const cw = Math.max(18, Math.round(W * 0.09));
    for (const side of [0, 1]) {
      const x = side ? W - cw : 0;
      R(x, 0, cw, H, '#9c1420');
      for (let f = 0; f < cw; f += 6) { R(x + f, 0, 2, H, '#c4202e'); R(x + f + 4, 0, 1, H, '#6e0e18'); }
    }
    R(0, 0, W, L.safeT + 6, '#9c1420');
    for (let x = 0; x < W; x += 8) circle(x + 4, L.safeT + 6, 4, '#9c1420');
    R(0, L.safeT + 9, W, 2, '#ffd21f');
    // rows of seats at the bottom
    for (let x = -4; x < W; x += 14) { R(x, H - 14, 12, 14, '#4a1a2a'); R(x, H - 16, 12, 3, '#6a2a3a'); }
  }
  function drawHeader() {
    const y = st.header.y + 6, h = st.header.h - 6, x0 = L.safeL + 20, x1 = W - L.safeR - 20;
    R(x0, y, x1 - x0, h, '#1d1a2b'); R(x0 + 2, y + 2, x1 - x0 - 4, h - 4, '#3a2a4a');
    // chasing marquee lights
    for (let x = x0 + 3, k = 0; x < x1 - 3; x += 7, k++) {
      const on = (k + Math.floor(T * 6)) % 3 === 0;
      R(x, y + 1, 2, 2, on ? '#fff3a6' : '#8a6a20'); R(x, y + h - 3, 2, 2, on ? '#fff3a6' : '#8a6a20');
    }
    // popcorn bucket and film reel
    const cx = (x0 + x1) / 2, cy = y + h / 2;
    const px = cx - 18, by = cy + 8;
    for (let k = 0; k < 4; k++) R(px - 6 + k * 3, by - 12, 2, 13, k % 2 ? '#ffffff' : '#e8222b');
    circle(px - 4, by - 14, 3, '#fff6c8'); circle(px, by - 16, 3, '#fff3a6'); circle(px + 4, by - 14, 3, '#fff6c8');
    circle(cx + 14, cy, 9, '#9aa3ad'); circle(cx + 14, cy, 3, '#3a3d46');
    for (let k = 0; k < 5; k++) { const a = k * 2 * Math.PI / 5 + T; circle(cx + 14 + Math.cos(a) * 6, cy + Math.sin(a) * 6, 2, '#3a3d46'); }
  }
  function drawCard(c, k) {
    const watched = st.watched === c.e.kind;
    const bob = Math.round(Math.sin(T * 2.5 + k) * 1.5);
    const x = c.x, y = c.y + bob;
    if (watched) alpha(0.5 + 0.3 * Math.sin(T * 5), () => { R(x - 4, y - 2, c.w + 8, c.h + 4, '#ffd21f'); R(x - 2, y - 4, c.w + 4, c.h + 8, '#ffd21f'); });
    R(x, y + 3, c.w, c.h, '#140a10');
    R(x + 2, y, c.w - 4, c.h, '#ffffff'); R(x, y + 2, c.w, c.h - 4, '#ffffff');
    R(x + 4, y + 4, c.w - 8, c.h - 16, mix(c.e.sky || '#8fd6ff', '#141a45', nightK() * 0.6));
    R(x + 4, y + c.h - 18, c.w - 8, 6, '#4b4f5c'); R(x + 4, y + c.h - 12, c.w - 8, 8, c.e.bg);
    drawVBig(c.e.i, x + c.w / 2, y + c.h - 16, st.scale, true, c.e.cover && ((x0, yb) => SCENES[c.e.scene].cover(x0 + 10, yb)));
    // play badge
    const bx = x + c.w - 13, byy = y + 12;
    circle(bx, byy, 8, '#ffd21f'); circle(bx, byy, 6, '#e8222b');
    for (let r = 0; r < 7; r++) R(bx - 2, byy - 3 + r, Math.min(r, 6 - r) + 1, 1, '#ffffff');
  }

  SCENES.movies = {
    noWeather: true,
    view: [186, 200],
    freeTouch: true,
    layout,
    enter(arg) { st.watched = arg && arg.watched || null; st.t = 0; layout(); },
    update(dt) { st.t += dt; },
    drawWorld() {},
    drawUI() {
      drawCurtains();
      drawHeader();
      st.cards.forEach(drawCard);
      drawHomeButton(st.home);
      drawParticles();
    },
    tap(x, y) {
      if (inBox(st.home, x, y)) { goScene('station'); return true; }
      for (const c of st.cards) {
        if (x >= c.x - 4 && x < c.x + c.w + 4 && y >= c.y - 4 && y < c.y + c.h + 4) {
          SFX.chime(); sparkle(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, 12);
          goScene(c.e.scene);
          return true;
        }
      }
      return true;
    },
  };
})();
