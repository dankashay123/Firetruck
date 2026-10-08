// Shared helpers for the play-set mini-games (digger, dog bath, garbage truck):
// crisp pixel polygons and thick lines, little offscreen sprites that can be mirrored or
// squashed, and a sound bank that plays recorded clips (falling back to the synth).
'use strict';
const TOY = (() => {
  // Fill a polygon with whole pixels (no soft edges), one scanline at a time.
  function poly(pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    y0 = Math.floor(y0); y1 = Math.ceil(y1);
    g.fillStyle = c;
    const xs = [];
    for (let y = y0; y < y1; y++) {
      const yc = y + 0.5;
      xs.length = 0;
      for (let i = 0, n = pts.length; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) { const xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]); if (xb > xa) g.fillRect(xa, y, xb - xa, 1); }
    }
  }
  // A thick straight bar from (x0, y0) to (x1, y1), w pixels wide, with optional round ends.
  function bar(x0, y0, x1, y1, w, c, round) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
    poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], c);
    if (round) { circle(x0, y0, Math.max(1, w / 2 - 0.5), c); circle(x1, y1, Math.max(1, w / 2 - 0.5), c); }
  }
  // Points turned by angle a around (ox, oy), then moved to (tx, ty).
  function turn(pts, a, ox = 0, oy = 0, tx = 0, ty = 0) {
    const c = Math.cos(a), s = Math.sin(a);
    return pts.map(([x, y]) => [tx + (x - ox) * c - (y - oy) * s, ty + (x - ox) * s + (y - oy) * c]);
  }
  // An ellipse of whole pixels.
  function oval(cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      const k = 1 - (dy / (ry + 0.5)) ** 2;
      if (k <= 0) continue;
      const dx = Math.round(rx * Math.sqrt(k));
      g.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
    }
  }
  // Stable pseudo-random numbers in [0, 1).
  const hsh = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  /* ---------- offscreen sprites ---------- */
  const CVS = {};
  // Draw fn into a cleared offscreen canvas of w x h, with (ox, oy) as its origin.
  function paint(name, w, h, ox, oy, fn) {
    let cv = CVS[name];
    if (!cv) cv = CVS[name] = document.createElement('canvas');
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext('2d'), prev = g;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.translate(ox, oy);
    g = c;
    try { fn(); } finally { g = prev; }
    cv.ox = ox; cv.oy = oy;
    return cv;
  }
  // Draw a painted sprite so its origin lands on (x, y); sx < 0 mirrors it, |sx| < 1 squashes it.
  function blit(cv, x, y, sx = 1, sy = 1) {
    if (Math.abs(sx) < 0.02) return;
    g.save(); g.imageSmoothingEnabled = false;
    g.translate(Math.round(x), Math.round(y)); g.scale(sx, sy);
    g.drawImage(cv, -cv.ox, -cv.oy);
    g.restore();
  }

  /* ---------- sounds ---------- */
  // files: { key: [name, volume] }; synth: { key: fn } used until (or if) a clip loads.
  function bank(files, synth, musicName, musicVol = 0.22) {
    const bufs = {}, music = { buf: null, src: null, gain: null };
    let loaded = false;
    const get = n => fetch('audio/' + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab && ac.decodeAudioData(ab)).catch(() => null);
    const B = {
      load() {
        if (loaded || !ac) return;
        loaded = true;
        for (const [k, [n]] of Object.entries(files)) get(n).then(b => { if (b) bufs[k] = b; });
        if (musicName) get(musicName).then(b => { if (b) { music.buf = b; if (B.wantMusic) B.music(true); } });
      },
      // play a clip; rate changes the pitch; returns the source (or null)
      play(k, rate = 1, vol = 1) {
        if (!ac) return null;
        const b = bufs[k];
        if (!b) { if (synth[k]) synth[k](rate); return null; }
        const src = ac.createBufferSource(), gn = ac.createGain();
        src.buffer = b; src.playbackRate.value = rate * (0.96 + Math.random() * 0.08); gn.gain.value = files[k][1] * vol;
        src.connect(gn); gn.connect(master); src.start();
        return src;
      },
      // a looping clip whose volume and speed can be set every frame: returns set(vol, rate)
      loop(k) {
        let src = null, gn = null;
        return (vol, rate = 1) => {
          if (!ac) return;
          if (!src) {
            const b = bufs[k];
            if (!b) return;
            src = ac.createBufferSource(); gn = ac.createGain();
            src.buffer = b; src.loop = true; src.loopStart = 0.03; src.loopEnd = b.duration - 0.03;
            gn.gain.value = 0; src.connect(gn); gn.connect(master); src.start();
          }
          gn.gain.setTargetAtTime(vol * files[k][1], ac.currentTime, 0.08);
          src.playbackRate.setTargetAtTime(rate, ac.currentTime, 0.15);
        };
      },
      wantMusic: false,
      music(on) {
        B.wantMusic = on;
        if (on && music.buf && !music.src && ac) {
          const src = ac.createBufferSource(), gn = ac.createGain();
          src.buffer = music.buf; src.loop = true; gn.gain.value = musicVol;
          src.connect(gn); gn.connect(master); src.start();
          music.src = src; music.gain = gn;
        }
        if (!on && music.src) { try { music.src.stop(); } catch (e) {} music.src = null; }
      },
      has: k => !!bufs[k],
      playing: () => !!music.src,
    };
    return B;
  }

  // A friendly cartoon eye (white, pupil, happy lid) at (cx, cy).
  function eye(cx, cy, r, look = 1, mood = 'happy') {
    if (mood === 'shut') { R(cx - r, cy, 2 * r + 1, 1, INK); return; }
    circle(cx, cy, r, '#ffffff');
    const pr = Math.max(1, r - 1);
    R(cx - (pr >> 1) + (look > 0 ? 1 : 0), cy - (pr >> 1), pr, pr, INK);
    if (r >= 3) R(cx + (look > 0 ? 1 : 0), cy - (pr >> 1), 1, 1, '#ffffff');
    if (mood === 'happy') R(cx - r, cy - r - 1, 2 * r + 1, 1, INK);
  }
  // A small bouncing arrow pointing down at (x, y).
  function arrow(x, y, c = '#ffd21f') {
    const b = Math.round(Math.abs(Math.sin(T * 5)) * 3);
    R(x - 2, y - 12 - b, 5, 6, INK); R(x - 1, y - 12 - b, 3, 6, c);
    for (let k = 0; k < 5; k++) { R(x - 5 + k, y - 6 - b + k, 11 - 2 * k, 1, k === 0 ? INK : c); R(x - 5 + k - 1, y - 6 - b + k, 1, 1, INK); R(x + 5 - k + 1, y - 6 - b + k, 1, 1, INK); }
  }
  // A white pointing hand (finger up, pressing down when press is 1) with its fingertip at (x, y).
  function hand(x, y, z = 1, press = 0) {
    const P = (dx, dy, w, h, c) => R(x + dx * z, y + (dy + press) * z, w * z, h * z, c);
    P(-1, 0, 3, 7, INK); P(0, 1, 1, 6, '#ffffff');
    P(-1, 5, 9, 7, INK); P(0, 6, 7, 5, '#ffffff'); P(2, 5, 1, 2, INK); P(4, 5, 1, 2, INK);
    P(-3, 7, 3, 3, INK); P(-2, 8, 2, 1, '#ffffff');
  }

  return { poly, bar, turn, oval, hsh, paint, blit, bank, eye, arrow, hand };
})();
