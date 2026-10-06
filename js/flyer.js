// "Fly Over the City": free flight, no goals. Hold a finger anywhere and the big rescue
// helicopter flies toward it while the camera follows it through a long side-view city:
// airport, harbor and bridge, downtown towers, fire and police stations, park, hospital,
// construction site, stadium and a train viaduct. Lots of things react to taps and fly-bys.
'use strict';
(() => {
  /* ---------- world ---------- */
  const WW = 5400, GY = 600, WH = 646;                  // world width, building base, world bottom
  const LANE_B = GY + 21, LANE_A = GY + 38, WALK = GY + 4, DECK = GY - 110;
  const DK = '#3a3d46', W_ON = '#ffd98a', W_ON2 = '#fff1c4';
  const HW = 76, HH = 40, OX = 40, OY = 20, SKID = 14;   // helicopter sprite, its origin, skids below origin
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  let sd = 20240611;
  const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const rr = (a, b) => a + rnd() * (b - a);
  const rpick = a => a[(rnd() * a.length) | 0];

  const cam = { x: 1900, y: 300 };
  const heli = { x: 2090, y: 400, vx: 0, vy: 0, dir: 1, tilt: 0, hy: 400, intro: 0, tx: 0, ty: 0 };
  let hold = null, finger = [0, 0], built = false, chopT = 0, lastChop = -9, savedClouds = null, lastWhoosh = -9, starNote = 0;
  let sirenStop = null, sirenT = 0, chugT = 0, CX = 0, CY = 0;
  const rotor = noiseLoop(240, 0.8);
  const hcv = document.createElement('canvas'); hcv.width = HW; hcv.height = HH;
  const hg = hcv.getContext('2d');
  const prof = new Float32Array(WW + 1).fill(GY);     // top of solid things, per column
  const sprof = new Float32Array(WW + 1);              // widened and ramped: how low the helicopter may go
  const statics = [], blinks = [], pads = [], pools = [], lamps = [];
  const FRAME_Y = 0.36;   // the helicopter rides a bit above the middle so the street stays in view
  const camMaxY = () => Math.max(0, WH - H);
  const onScreen = (x, pad = 30) => x > cam.x - pad && x < cam.x + W + pad;

  /* ---------- baked scenery ---------- */
  function bake(w, h, fn) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    const prev = g; g = c.getContext('2d');
    try { fn(); } finally { g = prev; }
    return c;
  }
  function addStatic(x, y, w, h, day, lit, front) {
    statics.push({ x, y, w, h, img: bake(w, h, day), lit: lit ? bake(w, h, lit) : null, front: !!front });
  }
  function solid(x0, x1, y) { for (let c = Math.max(0, Math.floor(x0)); c <= Math.min(WW, Math.ceil(x1)); c++) if (y < prof[c]) prof[c] = y; }
  function line(x0, y0, x1, y1, c) {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) R(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), 1, 1, c);
  }

  const TOWERS = [
    { wall: '#7fa7c9', shade: '#5f87a9', top: '#a9c9e3', glass: '#cfe9ff', frame: '#4f7393' },
    { wall: '#e8d9b8', shade: '#cdbb94', top: '#f6ecd4', glass: '#9fd2ef', frame: '#b8a57c' },
    { wall: '#9aa7b4', shade: '#7b8896', top: '#c3ccd5', glass: '#bfe6ff', frame: '#5f6b78' },
    { wall: '#5f8f8a', shade: '#47736f', top: '#86b5ae', glass: '#bff0e6', frame: '#3a5f5b' },
    { wall: '#d98f6b', shade: '#b8704f', top: '#f0b394', glass: '#ffe0c4', frame: '#9a5a3e' },
    { wall: '#b9a0d9', shade: '#9a80bd', top: '#d6c4ef', glass: '#e6dcff', frame: '#7a62a0' },
  ];
  const AWN = ['#e8222b', '#2a6fe0', '#3fb43a', '#f57a12', '#8a4fd9'];
  const ROOF_EX = { antenna: 44, crown: 30, tank: 26, garden: 20, flat: 7, helipad: 10, pool: 22 };
  const ROOF_SOLID = { antenna: 6, crown: 24, tank: 22, garden: 8, flat: 6, helipad: 2, pool: 3 };

  function roofDay(roof, w, y0, pal) {
    const cx = w >> 1;
    if (roof === 'antenna') {
      R(cx - 7, y0 - 6, 14, 6, pal.shade); R(cx - 7, y0 - 6, 14, 1, pal.top);
      R(cx - 1, 4, 2, y0 - 10, DK); R(cx - 4, 16, 8, 1, DK); R(cx - 3, 26, 6, 1, DK); R(cx - 2, 2, 4, 2, '#e8222b');
    } else if (roof === 'crown') {
      R(3, y0 - 9, w - 6, 9, pal.top); R(3, y0 - 9, w - 6, 1, '#ffffff');
      R(9, y0 - 18, w - 18, 9, pal.wall); R(9, y0 - 18, 2, 9, pal.shade);
      R(15, y0 - 25, w - 30, 7, pal.top);
      R(cx - 1, 2, 2, y0 - 27, pal.frame); R(cx - 2, 0, 4, 3, '#ffd21f');
    } else if (roof === 'tank') {
      const tx = Math.round(w * 0.3);
      R(tx - 6, y0 - 8, 1, 8, DK); R(tx + 5, y0 - 8, 1, 8, DK); R(tx - 6, y0 - 5, 12, 1, DK);
      R(tx - 7, y0 - 20, 14, 12, '#a8743a'); R(tx - 7, y0 - 16, 14, 1, '#7a4a2a'); R(tx - 7, y0 - 12, 14, 1, '#7a4a2a');
      R(tx - 5, y0 - 23, 10, 3, '#7a4a2a'); R(tx - 2, y0 - 25, 4, 2, '#7a4a2a');
      R(w - 14, y0 - 5, 9, 5, '#9aa3ad'); R(w - 12, y0 - 4, 3, 3, DK);
    } else if (roof === 'garden') {
      R(2, y0 - 3, w - 4, 3, '#8a5a3a');
      for (let x = 6; x < w - 14; x += 9) { circle(x, y0 - 5, 4, '#3f9a45'); circle(x - 1, y0 - 6, 2, '#5bb85a'); R(x + 1, y0 - 7, 1, 1, '#ff6fb4'); }
      R(w - 11, y0 - 14, 2, 11, '#7a4a2a'); circle(w - 10, y0 - 15, 5, '#3f9a45'); circle(w - 11, y0 - 16, 3, '#5bb85a');
    } else if (roof === 'flat') {
      R(5, y0 - 5, 10, 5, '#9aa3ad'); R(7, y0 - 4, 6, 3, '#6b7480'); R(w - 16, y0 - 6, 11, 6, '#b4bec8'); R(w - 14, y0 - 5, 3, 3, DK);
    } else if (roof === 'helipad') {
      R(1, y0 - 2, w - 2, 2, '#5a5f6e');
      for (let dy = -3; dy <= 3; dy++) { const hw = Math.round((cx - 3) * Math.sqrt(1 - (dy / 3.6) ** 2)); R(cx - hw, y0 - 6 + dy, hw * 2, 1, dy < -1 ? '#6b7180' : '#4b4f5c'); }
      for (let dy = -2; dy <= 2; dy++) { const hw = Math.round((cx - 3) * 0.66 * Math.sqrt(1 - (dy / 2.6) ** 2)); R(cx - hw, y0 - 6 + dy, 2, 1, '#ffd21f'); R(cx + hw - 2, y0 - 6 + dy, 2, 1, '#ffd21f'); }
      R(cx - 3, y0 - 9, 1, 5, '#ffffff'); R(cx + 2, y0 - 9, 1, 5, '#ffffff'); R(cx - 3, y0 - 7, 6, 1, '#ffffff');
    } else if (roof === 'pool') {
      R(2, y0 - 7, w - 4, 7, '#e9eef2'); R(2, y0 - 7, w - 4, 1, '#ffffff');
      R(5, y0 - 6, w - 20, 5, '#3a9ad9'); R(5, y0 - 6, w - 20, 1, '#7cc8f5');
      R(6, y0 - 11, 1, 5, CHROME); R(9, y0 - 11, 1, 5, CHROME); R(6, y0 - 10, 4, 1, CHROME); R(6, y0 - 8, 4, 1, CHROME);
      const ux = w - 9;
      R(ux, y0 - 17, 1, 10, DK);
      R(ux - 6, y0 - 18, 13, 2, '#e8222b'); R(ux - 4, y0 - 20, 9, 2, '#ffffff'); R(ux - 2, y0 - 21, 5, 1, '#e8222b');
      R(ux - 5, y0 - 10, 8, 2, '#ffd21f'); R(ux - 5, y0 - 8, 1, 1, DK); R(ux + 2, y0 - 8, 1, 1, DK);
    }
  }

  function buildTower(x, w, h, pal, roof, id) {
    const ex = ROOF_EX[roof], top = GY - h, style = id % 3, awn = AWN[id % AWN.length];
    const cols = Math.max(2, Math.floor((w - 8) / 8)), wx0 = Math.floor((w - (cols * 8 - 3)) / 2);
    const rows = Math.floor((h - 30) / 10), wins = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) wins.push([wx0 + c * 8, ex + 8 + r * 10, 5, 6, hsh(id * 91.7 + r * 13.1 + c * 5.3) < 0.5]);
    const ly = ex + h - 14, dx = (w >> 1) - 6;
    addStatic(x, top - ex, w, h + ex, () => {
      roofDay(roof, w, ex, pal);
      R(0, ex, w, h, pal.wall); R(0, ex, 3, h, pal.shade); R(w - 1, ex, 1, h, pal.shade);
      if (style === 1) for (let r = 0; r < rows; r++) R(3, ex + 7 + r * 10, w - 4, 8, pal.frame);
      if (style === 2) for (let c = 0; c <= cols; c++) R(wx0 - 2 + c * 8, ex + 5, 1, h - 22, pal.shade);
      for (const [wx, wy, ww, wh] of wins) { R(wx, wy, ww, wh, pal.glass); R(wx, wy, 2, 1, '#ffffff'); R(wx + ww - 1, wy + 1, 1, wh - 1, pal.frame); }
      R(0, ex, w, 3, pal.top); R(0, ex + 3, w, 1, pal.frame);
      R(0, ly, w, 14, pal.frame); R(0, ly, w, 2, pal.top);
      R(dx, ly + 4, 12, 10, GLASS2); R(dx + 6, ly + 4, 1, 10, pal.frame); R(dx - 2, ly + 2, 16, 2, awn);
      for (let k = 4; k + 6 < dx - 2; k += 9) R(k, ly + 5, 6, 6, GLASS);
      for (let k = dx + 16; k + 6 < w - 2; k += 9) R(k, ly + 5, 6, 6, GLASS);
    }, () => {
      for (const [wx, wy, ww, wh, on] of wins) if (on) { R(wx, wy, ww, wh, W_ON); R(wx, wy, 2, 1, W_ON2); }
      R(dx, ly + 4, 12, 10, W_ON2);
      for (let k = 4; k + 6 < dx - 2; k += 9) R(k, ly + 5, 6, 6, W_ON);
      for (let k = dx + 16; k + 6 < w - 2; k += 9) R(k, ly + 5, 6, 6, W_ON);
    });
    solid(x, x + w, top - ROOF_SOLID[roof]);
    if (roof === 'antenna') blinks.push({ x: x + (w >> 1), y: top - ex + 3, c: RED_ON, ph: id });
    if (roof === 'crown') blinks.push({ x: x + (w >> 1), y: top - ex + 1, c: RED_ON, ph: id });
    if (roof === 'helipad') pads.push({ x: x + (w >> 1), y: top - 6, hw: (w >> 1) - 3, landed: false });
    if (roof === 'pool') pools.push({ x0: x + 5, x1: x + w - 15, y: top - 6, splash: 0, seed: id });
  }

  function buildAirport() {
    // control tower
    addStatic(60, GY - 160, 40, 160, () => {
      R(13, 40, 14, 120, '#e9eef2'); R(13, 40, 3, 120, '#c4ccd6');
      for (let y = 50; y < 146; y += 14) R(18, y, 4, 6, GLASS2);
      R(15, 148, 10, 12, '#9aa3ad'); R(17, 150, 6, 10, '#5a5f6e');
      R(4, 34, 32, 6, '#c4ccd6'); R(4, 34, 32, 1, '#ffffff');
      R(2, 16, 36, 18, '#4a6a8a'); R(4, 18, 32, 14, '#8fd0f0'); for (let x = 10; x < 36; x += 8) R(x, 18, 1, 14, '#4a6a8a'); R(6, 19, 4, 2, '#ffffff');
      R(0, 12, 40, 4, '#e8222b'); R(4, 9, 32, 3, '#c0302a');
      R(19, 0, 2, 9, DK); R(15, 4, 10, 1, DK);
    }, () => { R(4, 18, 32, 14, '#d8f8ff'); for (let y = 50; y < 146; y += 14) R(18, y, 4, 6, W_ON); });
    blinks.push({ x: 80, y: GY - 160, c: RED_ON, ph: 1 });
    solid(60, 100, GY - 152);
    // hangar with a little yellow plane inside
    addStatic(130, GY - 66, 160, 66, () => {
      for (let y = 0; y < 22; y++) { const half = 80 * Math.sqrt(1 - ((22 - y) / 22) ** 2); R(80 - half, y, half * 2, 1, y < 3 ? '#d5dce3' : '#9aa3ad'); }
      for (let k = 1; k < 8; k++) { const xx = k * 20; const yy = 22 - Math.round(22 * Math.sqrt(1 - ((xx - 80) / 80) ** 2)); R(xx, yy, 1, 22 - yy, '#8a95a1'); }
      R(0, 22, 160, 44, '#b4bec8'); R(0, 22, 4, 44, '#9aa3ad');
      for (let x = 8; x < 160; x += 6) R(x, 24, 1, 42, '#a8b2bd');
      R(28, 30, 104, 36, '#e9b23a'); R(30, 32, 100, 34, '#3a3f4a');
      for (let x = 30; x < 130; x += 8) R(x, 32, 4, 2, '#2f3240');
      R(60, 48, 40, 7, '#ffd21f'); R(96, 49, 6, 5, '#ffd21f'); R(56, 44, 6, 8, '#f57a12'); R(70, 52, 18, 2, '#e0b010'); R(92, 50, 3, 2, GLASS);
      R(66, 55, 1, 5, DK); R(64, 60, 4, 2, TIRE); R(94, 55, 1, 5, DK); R(92, 60, 4, 2, TIRE);
      text('AIR', 68, 25, 1, '#ffffff');
    }, () => { R(30, 32, 100, 34, '#5a5040'); R(60, 48, 40, 7, '#ffe27a'); R(70, 33, 20, 2, W_ON2); });
    solid(130, 290, GY - 60);
    // terminal
    addStatic(305, GY - 50, 150, 50, () => {
      R(0, 8, 150, 42, '#e9eef2'); R(0, 8, 3, 42, '#c4ccd6');
      R(0, 4, 150, 4, '#2a6fe0'); R(0, 4, 150, 1, '#6fb6ff');
      R(4, 14, 142, 14, '#7ab6dc'); for (let x = 4; x < 146; x += 10) R(x, 14, 1, 14, '#4a6a8a'); R(8, 16, 6, 2, '#ffffff'); R(50, 16, 6, 2, '#ffffff');
      R(4, 34, 142, 16, '#c4ccd6'); R(60, 36, 30, 14, GLASS2); R(75, 36, 1, 14, '#9aa3ad');
      for (let x = 10; x < 56; x += 12) R(x, 37, 8, 8, GLASS); for (let x = 96; x < 144; x += 12) R(x, 37, 8, 8, GLASS);
      R(55, 0, 40, 6, '#2a6fe0'); text('AIRPORT', 61, 1, 1, '#ffffff');
      R(140, 20, 10, 6, '#b4bec8'); R(146, 26, 2, 24, '#9aa3ad');
    }, () => {
      R(4, 14, 142, 14, '#ffe6a0'); for (let x = 4; x < 146; x += 10) R(x, 14, 1, 14, '#c9a860');
      R(60, 36, 30, 14, W_ON2); for (let x = 10; x < 56; x += 12) R(x, 37, 8, 8, W_ON); for (let x = 96; x < 144; x += 12) R(x, 37, 8, 8, W_ON);
    });
    solid(305, 455, GY - 52);
  }

  function buildHarbor() {
    // lighthouse on its rock
    addStatic(626, GY - 112, 46, 112, () => {
      for (let y = 0; y < 18; y++) { const hw = 22 * Math.sqrt(1 - ((18 - y) / 19) ** 2); R(23 - hw, 94 + y, hw * 2, 1, y < 4 ? '#a7b0ba' : '#7d8794'); }
      for (let y = 26; y < 96; y++) { const hw = 7 + (y - 26) * 0.07; R(23 - hw, y, hw * 2, 1, Math.floor((y - 26) / 12) % 2 ? '#ffffff' : '#e8222b'); R(23 - hw, y, 2, 1, '#00000022'); }
      R(20, 80, 6, 14, '#8a5a3a');
      R(13, 22, 20, 4, '#2f3240'); R(12, 21, 22, 1, '#5a5f6e');
      R(16, 12, 14, 10, '#2f3240'); R(17, 13, 12, 8, '#fff6b0');
      for (let k = 0; k < 5; k++) R(16 + k, 12 - k - 1, 14 - 2 * k, 1, '#e8222b');
      R(22, 4, 2, 4, DK);
    }, () => { R(17, 13, 12, 8, '#ffffff'); });
    solid(626, 672, GY - 100);
    // suspension bridge: in front of the boats, carries the street over the river
    const bx = 690, bw = 500, by = GY - 170, tow = [70, 410];
    const cableY = lx => {
      if (lx < tow[0]) return lerp(166, 8, (lx / tow[0]) ** 0.8);
      if (lx > tow[1]) return lerp(8, 166, ((lx - tow[1]) / (bw - tow[1])) ** 1.25);
      const k = (lx - tow[0]) / (tow[1] - tow[0]) * 2 - 1;
      return 8 + (1 - k * k) * 130;
    };
    addStatic(bx, by, bw, 176, () => {
      for (let lx = 2; lx < bw - 2; lx += 6) { const cy = Math.round(cableY(lx)); if (cy < 164) R(lx, cy, 1, 166 - cy, '#9aa3ad'); }
      for (let lx = 0; lx < bw; lx++) { const cy = Math.round(cableY(lx)); R(lx, cy, 1, 2, '#c0502a'); }
      for (const tx of tow) {
        R(tx - 6, 0, 12, 176, '#d8582f'); R(tx - 6, 0, 3, 176, '#b0441f'); R(tx + 4, 0, 2, 176, '#a33d1b');
        for (const yy of [30, 80, 130]) { R(tx - 6, yy, 12, 4, '#a33d1b'); }
        R(tx - 8, 0, 16, 3, '#a33d1b');
      }
      R(0, 164, bw, 4, '#c0502a'); R(0, 164, bw, 1, '#e07a4a');
      R(0, 169, bw, 1, '#a33d1b');
      for (let lx = 0; lx < bw; lx += 5) R(lx, 168, 1, 8, '#a33d1b');
    }, () => {
      for (let lx = 4; lx < bw; lx += 12) { const cy = Math.round(cableY(lx)); R(lx, cy - 1, 2, 2, '#fff3b0'); }
      for (const tx of tow) R(tx - 1, 0, 2, 2, RED_ON);
    }, true);
    blinks.push({ x: bx + tow[0], y: by - 1, c: RED_ON, ph: 3 }, { x: bx + tow[1], y: by - 1, c: RED_ON, ph: 4 });
  }

  function buildDowntown() {
    let x = 1252, id = 0;
    const roofs = ['antenna', 'tank', 'garden', 'flat', 'crown', 'tank', 'garden', 'antenna', 'flat'];
    while (x < 1940) {
      const w = Math.round(rr(48, 70));
      if (x + w > 1995) break;
      const hmax = 330 - Math.abs(x + w / 2 - 1600) * 0.28;
      const h = Math.round(rr(hmax * 0.62, hmax));
      const roof = id === 2 || id === 7 ? 'helipad' : id === 4 ? 'pool' : roofs[(id * 5 + 3) % roofs.length];
      buildTower(x, w, Math.max(110, h), TOWERS[(id * 7 + 2) % TOWERS.length], roof, id + 1);
      x += w + Math.round(rr(5, 12)); id++;
    }
  }

  const fireHome = { i: 1, x: 2052, yb: GY, state: 'parked', t: 6, car: null, want: false };
  const policeHome = { i: 0, x: 2282, yb: GY, state: 'parked', t: 3, car: null, want: false };
  const ambHome = { i: 2, x: 3304, yb: GY, state: 'parked', t: 0, car: null, want: false };
  const homes = [fireHome, policeHome, ambHome];

  function buildStations() {
    // fire station: bell tower and one big bay
    const fx = 2010;
    addStatic(fx, GY - 116, 152, 116, () => {
      const B = '#c8432f', B2 = '#a3362a';
      R(2, 20, 24, 96, B2); R(2, 20, 3, 96, '#8e2f24');
      for (let y = 24; y < 116; y += 5) for (let x = 4 + (y % 10 ? 0 : 3); x < 26; x += 7) R(x, y, 4, 1, '#b5473a');
      for (let k = 0; k < 9; k++) R(Math.round(14 - (k + 1) * 1.5), k + 1, Math.round((k + 1) * 3), 1, '#7a2f24');
      R(3, 10, 22, 12, B2); R(7, 12, 14, 10, '#2a2c33');
      R(11, 13, 6, 6, '#ffd21f'); R(10, 18, 8, 1, '#c99410'); R(13, 19, 2, 2, '#c99410');
      R(0, 22, 28, 3, '#7a2f24');
      for (const y of [32, 54, 76]) { R(8, y, 12, 14, '#ffffff'); R(9, y + 1, 10, 12, GLASS); R(13, y + 1, 1, 12, '#ffffff'); }
      R(8, 96, 12, 20, '#8a5a3a'); R(17, 106, 1, 1, '#ffd21f');
      R(28, 44, 124, 72, B); R(28, 44, 3, 72, B2);
      for (let y = 48; y < 116; y += 5) for (let x = 31 + (y % 10 ? 0 : 4); x < 152; x += 9) R(x, y, 5, 1, '#d4553d');
      R(26, 40, 128, 5, '#7a2f24');
      R(42, 48, 96, 14, '#f4f7fb'); R(42, 61, 96, 1, '#cfd8e2'); text('FIRE', 75, 50, 2, '#e8222b');
      R(46, 51, 6, 6, '#ffd21f'); R(48, 49, 2, 10, '#ffd21f'); R(128, 51, 6, 6, '#ffd21f'); R(130, 49, 2, 10, '#ffd21f');
      R(36, 66, 80, 50, '#f4f7fb'); R(38, 68, 76, 48, '#2a2c33');
      R(38, 68, 76, 7, '#b4bec8'); for (let y = 69; y < 75; y += 2) R(38, y, 76, 1, '#9aa3ad');
      R(104, 80, 3, 22, '#ffd21f'); R(102, 78, 7, 3, '#e8b03a');
      R(120, 70, 28, 20, '#ffffff'); R(122, 72, 24, 16, GLASS); R(133, 72, 1, 16, '#ffffff'); R(124, 74, 4, 2, '#ffffff');
      R(126, 96, 16, 20, '#ffffff'); R(127, 97, 14, 19, '#8a5a3a'); R(138, 106, 1, 1, '#ffd21f');
    }, () => {
      for (const y of [32, 54, 76]) R(9, y + 1, 10, 12, W_ON);
      R(122, 72, 24, 16, W_ON); R(38, 75, 76, 41, '#5a4a30'); R(64, 76, 24, 2, W_ON2);
    });
    solid(fx, fx + 152, GY - 76); solid(fx, fx + 28, GY - 118);
    // police station with a garage
    const px = 2180;
    addStatic(px, GY - 80, 160, 80, () => {
      R(0, 14, 160, 66, '#9fb4cf'); R(0, 14, 3, 66, '#7f94b0');
      R(0, 10, 160, 4, '#1a3f9a'); R(0, 10, 160, 1, '#3b6fd0');
      R(12, 17, 76, 14, '#1a3f9a'); text('POLICE', 27, 19, 2, '#ffffff');
      for (const y of [36, 52]) for (let x = 6; x < 96; x += 15) if (x < 34 || x > 58) { R(x, y, 11, 11, '#ffffff'); R(x + 1, y + 1, 9, 9, GLASS); R(x + 5, y + 1, 1, 9, '#ffffff'); }
      R(36, 58, 22, 22, '#ffffff'); R(38, 60, 18, 20, '#1a2a5a'); R(39, 61, 7, 8, GLASS2); R(48, 61, 7, 8, GLASS2);
      R(32, 76, 30, 4, '#d5dce3');
      R(31, 52, 2, 24, DK); R(29, 47, 6, 5, '#3b8bff'); R(61, 52, 2, 24, DK); R(59, 47, 6, 5, '#3b8bff');
      R(98, 30, 62, 50, '#8a9fbd'); R(98, 30, 62, 3, '#1a3f9a');
      R(100, 38, 58, 42, '#2a2c33'); R(100, 38, 58, 6, '#b4bec8'); for (let y = 39; y < 44; y += 2) R(100, y, 58, 1, '#9aa3ad');
      R(150, 0, 1, 14, DK); R(151, 1, 8, 5, '#2a6fe0'); R(151, 3, 8, 1, '#ffffff');
    }, () => {
      for (const y of [36, 52]) for (let x = 6; x < 96; x += 15) if ((x < 34 || x > 58) && hsh(x + y) < 0.7) R(x + 1, y + 1, 9, 9, W_ON);
      R(39, 61, 7, 8, W_ON); R(48, 61, 7, 8, W_ON); R(100, 44, 58, 36, '#4a4a50'); R(118, 45, 22, 2, W_ON2);
      R(29, 47, 6, 5, '#8fc0ff'); R(59, 47, 6, 5, '#8fc0ff');
    });
    blinks.push({ x: px + 32, y: GY - 31, c: BLUE_ON, ph: 0, glow: true, steady: true }, { x: px + 62, y: GY - 31, c: BLUE_ON, ph: 0, glow: true, steady: true });
    solid(px, px + 160, GY - 70);
    // shops
    const shops = [
      { name: 'PIZZA', wall: '#ffe3b0', sh: '#e8c48a', awn: '#e8222b', h: 58 },
      { name: 'CAFE', wall: '#cfe8ff', sh: '#a8c8ea', awn: '#3fb43a', h: 66 },
      { name: 'GELATO', wall: '#ffd0e4', sh: '#e8aac8', awn: '#8a4fd9', h: 54 },
    ];
    shops.forEach((s, i) => {
      const sx = 2350 + i * 70, w = 68, h = s.h;
      addStatic(sx, GY - h - 4, w, h + 4, () => {
        R(0, 4, w, h, s.wall); R(0, 4, 2, h, s.sh); R(0, 2, w, 3, s.sh); R(-1, 0, w + 2, 2, '#6b7480');
        for (let x = 8; x < w - 8; x += 20) { R(x, 12, 12, 12, '#ffffff'); R(x + 1, 13, 10, 10, GLASS); R(x + 1, 18, 10, 1, '#ffffff'); }
        const tw = textWidth(s.name, 1); R((w - tw) / 2 - 3, h - 30, tw + 6, 9, '#ffffff'); text(s.name, Math.round((w - tw) / 2), h - 28, 1, s.awn);
        for (let k = 0; k < w; k += 6) { R(k, h - 20, 6, 5, (k / 6) % 2 ? '#ffffff' : s.awn); R(k + 1, h - 15, 4, 1, (k / 6) % 2 ? '#ffffff' : s.awn); }
        R(4, h - 13, 34, 17, '#ffffff'); R(5, h - 12, 32, 15, GLASS);
        R(44, h - 13, 16, 17, '#ffffff'); R(45, h - 12, 14, 16, '#8a5a3a'); R(56, h - 4, 1, 1, '#ffd21f');
        if (i === 0) { circle(14, h - 3, 5, '#f5b342'); R(11, h - 5, 2, 2, '#e8222b'); R(16, h - 3, 2, 2, '#e8222b'); circle(28, h - 3, 4, '#f5b342'); }
        if (i === 1) { R(10, h - 4, 7, 6, '#ffffff'); R(17, h - 3, 2, 3, '#ffffff'); R(11, h - 8, 1, 3, '#cfd8e2'); R(14, h - 9, 1, 3, '#cfd8e2'); R(24, h - 2, 10, 4, '#c98a4a'); }
        if (i === 2) for (let k = 0; k < 3; k++) { const cx = 11 + k * 9; for (let j = 0; j < 5; j++) R(cx - 2 + (j >> 1), h - 2 + j, 5 - 2 * (j >> 1), 1, '#e8b03a'); circle(cx, h - 4, 3, ['#ff9cc0', '#fff6e0', '#8a5a3a'][k]); }
      }, () => {
        for (let x = 8; x < w - 8; x += 20) R(x + 1, 13, 10, 10, hsh(sx + x) < 0.7 ? W_ON : '#3a3f55');
        R(5, h - 12, 32, 15, W_ON2);
      });
      solid(sx, sx + w, GY - h - 4);
    });
  }

  function buildPark() {
    const px = 2560, pw = 520, ph = 92;
    addStatic(px, GY - ph, pw, ph, () => {
      const T0 = [[14, 13], [62, 15], [252, 12], [460, 14], [505, 12]];
      for (const [x, r] of T0) drawTree(x, ph - 6, r);
      for (const x of [40, 266]) { circle(x, ph - 10, 6, '#3f9a45'); circle(x - 2, ph - 12, 3, '#5bb85a'); R(x - 3, ph - 14, 2, 2, '#ff6fb4'); R(x + 2, ph - 11, 2, 2, '#ffd21f'); }
      // slide
      R(280, 50, 2, 42, '#e8222b'); R(287, 50, 2, 42, '#e8222b'); for (let y = 54; y < 90; y += 6) R(282, y, 5, 1, '#e8222b');
      R(279, 48, 22, 3, '#2a6fe0'); R(298, 40, 2, 10, '#2a6fe0'); R(279, 40, 2, 10, '#2a6fe0'); R(279, 39, 21, 2, '#2a6fe0');
      for (let i = 0; i <= 36; i++) { const x = 300 + i, y = 50 + Math.round(i * 0.95); R(x, y - 1, 1, 3, '#ffd21f'); R(x, y + 2, 1, 1, '#e0b010'); }
      R(336, 86, 6, 2, '#ffd21f');
      // swing frame
      R(348, 44, 2, 48, '#3fb43a'); R(402, 44, 2, 48, '#3fb43a'); R(346, 42, 60, 3, '#2f8a3a');
      R(345, 88, 6, 4, '#2f8a3a'); R(399, 88, 6, 4, '#2f8a3a');
      // seesaw stand
      R(442, 80, 6, 12, '#f57a12'); R(440, 90, 10, 2, '#b14c06');
      // benches
      for (const bx of [224, 485]) { R(bx, ph - 12, 16, 2, '#a8743a'); R(bx, ph - 17, 16, 2, '#a8743a'); R(bx + 1, ph - 10, 1, 4, DK); R(bx + 14, ph - 10, 1, 4, DK); }
      // sandbox
      R(412, ph - 5, 26, 5, '#e8d08a'); R(410, ph - 6, 30, 1, '#c99a5a'); R(418, ph - 8, 4, 3, '#e8222b'); R(426, ph - 7, 5, 2, '#2a6fe0');
    });
    for (const [x, r] of [[14, 13], [62, 15], [252, 12], [460, 14], [505, 12]]) solid(px + x - r, px + x + r, GY - 6 - 2 * r - 14);
    solid(2838, 2862, GY - 52); solid(2906, 2966, GY - 48);
  }

  function buildHospital() {
    const hx = 3090;
    addStatic(hx, GY - 150, 290, 150, () => {
      R(0, 10, 200, 140, '#f4f7fb'); R(0, 10, 4, 140, '#d5dde6'); R(196, 10, 4, 140, '#e1e7ee');
      R(0, 10, 200, 3, '#cfd8e2');
      for (let dy = -3; dy <= 3; dy++) { const hw = Math.round(36 * Math.sqrt(1 - (dy / 3.6) ** 2)); R(100 - hw, 5 + dy, hw * 2, 1, dy < -1 ? '#6b7180' : '#4b4f5c'); }
      for (let dy = -2; dy <= 2; dy++) { const hw = Math.round(24 * Math.sqrt(1 - (dy / 2.6) ** 2)); R(100 - hw, 5 + dy, 2, 1, '#ffd21f'); R(100 + hw - 2, 5 + dy, 2, 1, '#ffd21f'); }
      R(97, 2, 1, 5, '#ffffff'); R(102, 2, 1, 5, '#ffffff'); R(97, 4, 6, 1, '#ffffff');
      R(84, 16, 32, 32, '#ffffff'); R(95, 18, 10, 28, '#e8222b'); R(86, 27, 28, 10, '#e8222b');
      R(66, 51, 68, 14, '#e8222b'); text('HOSPITAL', 69, 53, 2, '#ffffff');
      for (let y = 72; y < 118; y += 15) for (let x = 8; x < 196; x += 14) if (x < 76 || x > 118) { R(x, y, 10, 10, '#b4d8f0'); R(x, y, 10, 1, '#8ab0cc'); R(x + 1, y + 1, 3, 2, '#ffffff'); }
      R(72, 118, 56, 4, '#2a6fe0'); R(78, 122, 44, 28, '#cfd8e2'); R(84, 126, 32, 24, GLASS); R(100, 126, 1, 24, '#9aa3ad');
      R(200, 80, 90, 70, '#e9eef2'); R(200, 80, 90, 3, '#cfd8e2');
      for (let x = 206; x < 286; x += 14) R(x, 86, 10, 8, '#b4d8f0');
      R(204, 96, 82, 5, '#e8222b'); R(204, 96, 82, 1, '#ff7a6b'); R(206, 101, 2, 49, '#9aa3ad'); R(282, 101, 2, 49, '#9aa3ad');
      R(208, 101, 74, 49, '#cfd8e2'); R(208, 118, 74, 2, '#e8222b');
      R(268, 104, 10, 10, '#2a6fe0'); text('H', 272, 107, 1, '#ffffff');
    }, () => {
      for (let y = 72; y < 118; y += 15) for (let x = 8; x < 196; x += 14) if ((x < 76 || x > 118) && hsh(x * 3 + y) < 0.75) R(x, y, 10, 10, W_ON);
      R(84, 126, 32, 24, W_ON2); R(95, 18, 10, 28, '#ff5050'); R(86, 27, 28, 10, '#ff5050');
      for (let x = 206; x < 286; x += 14) R(x, 86, 10, 8, W_ON); R(208, 101, 74, 17, '#fff6d8');
    });
    pads.push({ x: hx + 100, y: GY - 145, hw: 36, landed: false });
    solid(hx, hx + 200, GY - 142); solid(hx + 200, hx + 290, GY - 72);
  }

  const crane = { tx: 3650, d: 40, state: 'up2', beam: false, t: 0 };
  const frame = { x0: 3590, x1: 3710, floors: 4, placed: 0 };
  const JY = GY - 300, PILE = 3796;
  function buildConstruction() {
    addStatic(3436, GY - 336, 372, 336, () => {
      const mx = 64;   // mast left edge (local)
      R(mx, 36, 10, 300, '#ffd21f'); R(mx, 36, 1, 300, '#e0b010'); R(mx + 9, 36, 1, 300, '#e0b010');
      for (let y = 40; y < 336; y += 10) { line(mx + 1, y, mx + 8, y + 10, '#c99410'); R(mx + 1, y, 8, 1, '#c99410'); }
      R(mx - 4, 330, 18, 6, '#9aa3ad');
      R(mx - 2, 38, 14, 10, '#ffd21f'); R(mx + 4, 40, 7, 6, GLASS); R(mx + 5, 41, 2, 1, '#ffffff');
      line(mx + 5, 2, 4, 36, '#5a5f6e'); line(mx + 5, 2, 360, 36, '#5a5f6e');
      R(mx + 3, 2, 4, 34, '#ffd21f');
      R(0, 30, 372, 6, '#ffd21f'); R(0, 30, 372, 1, '#fff27a'); R(0, 35, 372, 1, '#c99410');
      for (let x = 0; x < 372; x += 8) line(x, 31, x + 4, 34, '#c99410');
      R(2, 36, 22, 14, '#9aa3ad'); R(2, 36, 22, 2, '#b4bec8'); R(8, 38, 1, 12, '#7d8794'); R(15, 38, 1, 12, '#7d8794');
    }, () => { R(68, 40, 7, 6, W_ON); });
    blinks.push({ x: 3436 + 69, y: GY - 336, c: RED_ON, ph: 2 }, { x: 3436 + 370, y: GY - 306, c: RED_ON, ph: 5 });
    // digger
    addStatic(3836, GY - 40, 64, 40, () => {
      R(4, 30, 40, 8, TIRE); for (let x = 6; x < 44; x += 5) R(x, 31, 2, 6, '#5a5f6e');
      R(8, 18, 30, 12, '#ffd21f'); R(8, 18, 30, 2, '#fff27a'); R(22, 6, 14, 14, '#ffd21f'); R(24, 8, 10, 8, GLASS); R(25, 9, 2, 1, '#ffffff');
      R(4, 20, 6, 8, '#2f3240');
      line(36, 16, 50, 4, '#e0b010'); line(36, 17, 50, 5, '#e0b010'); line(50, 4, 58, 22, '#e0b010'); line(51, 4, 59, 22, '#e0b010');
      R(54, 22, 9, 6, '#5a5f6e'); R(55, 28, 2, 2, '#5a5f6e'); R(59, 28, 2, 2, '#5a5f6e');
    });
    // fence in front of the site (front layer)
    addStatic(3420, GY - 12, 490, 12, () => {
      for (let x = 0; x < 490; x += 34) {
        if (x > 400 && x < 460) continue;
        R(x + 2, 0, 2, 12, '#9aa3ad'); R(x + 28, 0, 2, 12, '#9aa3ad');
        for (let k = 0; k < 28; k += 4) R(x + 2 + k, 2, 2, 3, (k / 4) % 2 ? '#ffffff' : '#f57a12');
        R(x + 2, 7, 28, 1, '#ffffff');
      }
    }, null, true);
    solid(3836, 3900, GY - 36);
  }

  function buildStadium() {
    const sx = 3920, sw = 520, sh = 186;
    const crowd = ['#e8222b', '#2a6fe0', '#ffd21f', '#3fb43a', '#ff6fb4', '#ffffff', '#f57a12', '#8a4fd9'];
    addStatic(sx, GY - sh, sw, sh, () => {
      for (const lx of [12, 504]) {
        R(lx, 20, 4, 166, '#9aa3ad'); R(lx, 20, 1, 166, '#c4ccd6');
        R(lx - 8, 4, 20, 16, '#5a5f6e'); for (let y = 6; y < 18; y += 4) for (let x = lx - 6; x < lx + 10; x += 4) R(x, y, 3, 3, '#e9eef2');
      }
      const top = 74;
      R(30, top, 460, 8, '#e9eef2'); R(30, top, 460, 2, '#ffffff');
      for (let x = 40; x < 480; x += 60) R(x, top + 8, 2, 14, '#b4bec8');
      // stands with the crowd
      for (let y = top + 10; y < top + 60; y += 4) {
        R(36, y, 448, 4, (y / 4) % 2 ? '#5a6a8a' : '#6b7b9b');
        for (let x = 38; x < 482; x += 3) {
          const hsv = hsh(x * 7.1 + y * 3.3);
          if (hsv < 0.12) continue;
          R(x, y + 1, 2, 2, crowd[(hsv * 97 | 0) % crowd.length]); R(x, y, 2, 1, SKIN[(hsv * 13 | 0) % 4]);
        }
      }
      // scoreboard with a smile
      R(230, top - 26, 60, 26, '#2f3240'); R(232, top - 24, 56, 22, '#1d1a2b');
      R(250, top - 20, 3, 4, '#ffd21f'); R(266, top - 20, 3, 4, '#ffd21f'); R(248, top - 11, 22, 2, '#ffd21f'); R(246, top - 13, 2, 2, '#ffd21f'); R(270, top - 13, 2, 2, '#ffd21f');
      R(258, top - 2, 4, 4, '#9aa3ad');
      // outer wall with arches and flags
      R(26, top + 56, 468, 56, '#e9eef2'); R(26, top + 56, 468, 4, '#2a6fe0'); R(26, top + 60, 468, 1, '#1a3f9a');
      for (let x = 40; x < 486; x += 26) { R(x, top + 74, 14, 38, '#5a6a8a'); circle(x + 7, top + 74, 7, '#5a6a8a'); R(x, top + 81, 14, 31, '#5a6a8a'); }
      R(26, top + 108, 468, 4, '#cfd8e2');
      for (let x = 30; x < 494; x += 46) { R(x, top + 36, 1, 20, DK); R(x + 1, top + 36, 8, 5, crowd[(x / 46 | 0) % crowd.length]); }
    }, () => {
      for (const lx of [12, 504]) { R(lx - 8, 4, 20, 16, '#fffbe6'); }
      R(250, 74 - 20, 3, 4, '#fff27a'); R(266, 74 - 20, 3, 4, '#fff27a'); R(248, 74 - 11, 22, 2, '#fff27a');
      for (let x = 40; x < 486; x += 26) R(x + 2, 74 + 84, 10, 26, '#ffcc66');
    });
    solid(sx + 26, sx + 494, GY - 112); solid(sx + 230, sx + 290, GY - 140);
  }

  const hillL = { c: 4620, r: 170, h: 170 }, hillR = { c: 5200, r: 200, h: 185 };
  const hillH = (hl, x) => { const d = (x - hl.c) / hl.r; return Math.abs(d) >= 1 ? 0 : hl.h * Math.sqrt(1 - d * d); };
  function buildViaduct() {
    const vx = 4720, vw = 340;
    addStatic(vx, DECK - 2, vw, GY - DECK + 2, () => {
      const hgt = GY - DECK + 2;
      R(0, 0, vw, 10, '#c9a27a'); R(0, 0, vw, 2, '#e0c098'); R(0, 9, vw, 1, '#a8835c');
      for (let px = 20; px < vw; px += 56) {
        R(px - 6, 10, 12, hgt - 10, '#c9a27a'); R(px - 6, 10, 3, hgt - 10, '#a8835c');
        for (let y = 16; y < hgt; y += 8) R(px - 5, y, 10, 1, '#b8916a');
      }
      for (let px = 20; px < vw - 56; px += 56) {   // arch tops
        const ax = px + 28;
        for (let dx = -22; dx <= 22; dx++) { const yy = Math.round(10 + 18 * (1 - Math.sqrt(1 - (dx / 23) ** 2))); R(ax + dx, 10, 1, yy - 8, '#c9a27a'); R(ax + dx, yy + 2, 1, 1, '#a8835c'); }
      }
      for (let x = 0; x < vw; x += 4) R(x, -1 + 2, 1, 1, '#a8835c');
      R(0, 0, vw, 1, '#8a6a4a');
    });
    solid(4740, 5050, DECK - 26);
    for (const hl of [hillL, hillR]) {
      const x0 = Math.max(4400, hl.c - hl.r), x1 = Math.min(WW, hl.c + hl.r), hh = Math.ceil(hl.h) + 36;   // headroom for the hilltop house and tree
      addStatic(x0, GY - hh, x1 - x0, hh, () => {
        for (let lx = 0; lx < x1 - x0; lx++) {
          const h = Math.round(hillH(hl, x0 + lx));
          if (h <= 0) continue;
          R(lx, hh - h, 1, h, '#5aa84c'); R(lx, hh - h, 1, 3, '#7cc96a');
          if (hsh(lx * 3.7 + hl.c) < 0.08) R(lx, hh - h + 6 + (lx % 7) * 4, 2, 2, '#4a9440');
          if (hsh(lx * 1.3 + hl.c) < 0.05 && h > 20) R(lx, hh - h + 3 + (lx % 5) * 3, 1, 1, '#ffd21f');
        }
        // tunnel portal at deck height, on the side facing the viaduct
        const side = hl === hillL ? 1 : -1, ex = hl.c + side * hl.r * Math.sqrt(1 - (118 / hl.h) ** 2) - x0;
        const pcx = Math.round(ex - side * 12), py = hh - (GY - DECK);
        R(pcx - 12, py - 30, 24, 30, '#8a7a6a');
        R(pcx - 9, py - 24, 18, 24, '#1d1a2b'); circle(pcx, py - 24, 9, '#1d1a2b');
        R(pcx - 9, py - 1, 18, 1, '#4b4f5c');
        // little houses on the hilltop
        const hx = Math.round(hl.c - x0 - side * 40), hy = hh - Math.round(hillH(hl, hl.c - side * 40));
        R(hx - 13, hy - 16, 26, 19, '#fff3a8'); R(hx - 13, hy - 16, 2, 19, '#e0d07a');
        for (let k = 0; k < 11; k++) R(hx - 15 + k, hy - 17 - k, 30 - 2 * k, 1, k % 3 ? '#c8432f' : '#a3352a');
        R(hx + 5, hy - 26, 4, 7, '#8a5a3a');
        R(hx - 3, hy - 8, 6, 11, '#8a5a3a'); R(hx + 1, hy - 3, 1, 1, '#ffd21f');
        R(hx - 11, hy - 12, 6, 6, '#ffffff'); R(hx - 10, hy - 11, 4, 4, GLASS); R(hx + 6, hy - 12, 6, 6, '#ffffff'); R(hx + 7, hy - 11, 4, 4, GLASS);
        drawTree(Math.round(hl.c - x0 + side * 26), hh - Math.round(hillH(hl, hl.c + side * 26)) + 3, 11);
      }, null, true);
      for (let x = x0; x <= x1; x++) solid(x, x, GY - hillH(hl, x) - (Math.abs(x - hl.c) < 60 ? 30 : 2));
    }
  }

  function build() {
    built = true;
    buildAirport(); buildHarbor(); buildDowntown(); buildStations(); buildPark(); buildHospital(); buildConstruction(); buildStadium(); buildViaduct();
    statics.sort((a, b) => a.x - b.x);
    // how low the helicopter may fly: widen by its half-length, then ramp so it climbs smoothly
    const HALF = 22;
    for (let c = 0; c <= WW; c++) { let m = GY; for (let k = Math.max(0, c - HALF); k <= Math.min(WW, c + HALF); k++) if (prof[k] < m) m = prof[k]; sprof[c] = m; }
    for (let c = 1; c <= WW; c++) sprof[c] = Math.min(sprof[c], sprof[c - 1] + 1.6);
    for (let c = WW - 1; c >= 0; c--) sprof[c] = Math.min(sprof[c], sprof[c + 1] + 1.6);
    for (let x = 36; x < WW; x += 74) {
      if ((x > 2040 && x < 2140) || (x > 2270 && x < 2350) || (x > 3290 && x < 3390)) continue;
      lamps.push(x);
    }
    initLife();
  }

  /* ---------- living things ---------- */
  const cloudsW = [], flocks = [], hot = [], party = [], stars = [], boats = [], ducks = [], people = [], laneA = [], laneB = [], rockets = [];
  const plane = { x: 600, y: GY - 13, dir: -1, state: 'wait', t: 0, vx: 0, vy: 0, wave: 0 };
  const train = { x: 4600, t: 0, wait: 0, whistle: 0 };
  const stadium = { cheer: 0, fw: 2, balloonT: 0 };
  const kids = { slide: 0, seesaw: 0 };
  const WALKERS = ['mom', 'dad', 'gran', 'kid', 'kid2', 'kid3', 'chef', 'dad', 'mom', 'kid'];
  const HOT_COLS = [['#e8222b', '#ffd21f'], ['#2a6fe0', '#ffffff'], ['#8a4fd9', '#ff6fb4'], ['#3fb43a', '#ffd21f'], ['#f57a12', '#fff27a']];
  const BAL_COLS = ['#e8222b', '#2a6fe0', '#ffd21f', '#3fb43a', '#ff6fb4', '#8a4fd9', '#f57a12'];

  function skySpot(minX = 60, maxX = WW - 60) {
    let x = 0, y = 0;
    for (let k = 0; k < 10; k++) {
      x = rand(minX, maxX);
      y = rand(70, Math.max(90, sprof[Math.round(x)] - 46));
      if (!(onScreen(x, 40) && y > cam.y - 40 && y < cam.y + H + 40)) break;
    }
    return [x, y];
  }
  function offX(lo, hi) {
    let x = 0;
    for (let k = 0; k < 10; k++) { x = rand(lo, hi); if (!onScreen(x, 60)) break; }
    return x;
  }
  function newFlock(x) {
    const n = 3 + (Math.random() * 3 | 0), y = rand(110, 430);
    return { x: x !== undefined ? x : offX(0, WW), y, vx: (Math.random() < 0.5 ? -1 : 1) * rand(10, 18), flee: 0, birds: Array.from({ length: n }, (_, i) => ({ dx: i * 9 - n * 4 + rand(-3, 3), dy: (i % 2) * 6 + rand(-3, 3), ph: Math.random() * 2, fx: 0, fy: 0, fvx: 0, fvy: 0 })) };
  }
  function partySpot(b) {
    const r = Math.random();
    b.x = r < 0.35 ? rand(3960, 4400) : r < 0.6 ? rand(2600, 3060) : offX(200, WW - 200);
    b.y = GY - 12 - rand(0, 30); b.vy = -rand(10, 16); b.c = pickOne(BAL_COLS); b.seed = Math.random() * 6; b.hide = 0;
  }
  function initLife() {
    for (let i = 0; i < 24; i++) cloudsW.push({ x: (i + Math.random()) * (WW / 24), y: rand(60, 380), s: rand(0.9, 1.7), front: i % 2 === 0, inHeli: false, pt: 0 });
    for (let i = 0; i < 8; i++) flocks.push(newFlock(rand(0, WW)));
    for (let i = 0; i < 5; i++) hot.push({ x: (i + 0.5) * WW / 5 + rand(-200, 200), by: rand(140, 330), y: 240, vx: rand(4, 9) * (i % 2 ? 1 : -1), cols: HOT_COLS[i], seed: Math.random() * 6, burn: 0, lift: 0 });
    for (let i = 0; i < 12; i++) { const b = {}; partySpot(b); b.y = rand(120, GY - 40); party.push(b); }
    for (let i = 0; i < 28; i++) { const [x, y] = skySpot((i + 0.1) * WW / 28, (i + 0.9) * WW / 28); stars.push({ x, y, hide: 0, ph: Math.random() * 6 }); }
    boats.push({ kind: 'tug', x: 720, w: 40, dir: 1, sp: 14, seed: 1, toot: 0 }, { kind: 'sail', x: 940, w: 36, dir: -1, sp: 9, seed: 2, toot: 0, sail: '#ff6fb4' }, { kind: 'ferry', x: 1040, w: 74, dir: 1, sp: 11, seed: 3, toot: 0 });
    for (let i = 0; i < 4; i++) ducks.push({ i, big: i === 0, x: 2700, dir: 1, hop: 0 });
    for (let i = 0; i < 46; i++) {
      const x = (i + 0.5) * WW / 46 + rand(-30, 30);
      people.push({ x, x0: Math.max(20, x - 90), x1: Math.min(WW - 20, x + 90), dir: Math.random() < 0.5 ? -1 : 1, type: WALKERS[i % WALKERS.length], skin: pickOne(SKIN), seed: Math.random() * 5, sp: rand(8, 14), cheer: 0, hat: false });
    }
    for (const x of [3470, 3760, 3880]) people.push({ x, x0: x - 40, x1: x + 30, dir: 1, type: 'dad', skin: pickOne(SKIN), seed: Math.random() * 5, sp: 7, cheer: 0, hat: true });
    people.push({ x: 2792, x0: 2792, x1: 2792, dir: -1, type: 'gran', skin: SKIN[0], seed: 1, sp: 0, cheer: 0, sit: GY - 12 });
    people.push({ x: 3053, x0: 3053, x1: 3053, dir: -1, type: 'dad', skin: SKIN[2], seed: 2, sp: 0, cheer: 0, sit: GY - 12 });
    const span = WW + 200;
    for (let i = 0; i < 11; i++) {
      const cop = i === 5;
      laneA.push({ kind: cop ? 'v' : 'car', i: 0, x: -100 + i * span / 11 + rand(0, 40), len: cop ? 56 : 34, v: 30, cruise: cop ? 40 : rand(30, 38), rot: 0, col: PALETTE[(Math.random() * 8) | 0][2], yb: LANE_A });
      laneB.push({ kind: 'car', x: -100 + i * span / 11 + rand(0, 40), len: 34, v: 30, cruise: rand(28, 36), rot: 0, col: PALETTE[(Math.random() * 8) | 0][2] });
    }
  }

  /* ---------- sounds ---------- */
  function cheer() { [784, 988, 1319].forEach((f, i) => tone('square', f, i * 0.1, 0.14, 0.07)); tone('triangle', 1568, 0.32, 0.5, 0.09); }
  function toot() { tone('sawtooth', 147, 0, 0.55, 0.09); tone('sine', 220, 0, 0.55, 0.1); tone('sawtooth', 147, 0.7, 0.35, 0.08); tone('sine', 220, 0.7, 0.35, 0.09); }
  function whistle() { [0, 0.45].forEach(s => { tone('triangle', 784, s, 0.35, 0.09); tone('triangle', 988, s, 0.35, 0.07); tone('triangle', 1175, s, 0.35, 0.05); }); }
  function sirenBurst(kind, dur) { if (sirenStop) sirenStop(); sirenStop = siren(kind); sirenT = dur; }
  function burstConfetti(x, y, n = 18) {
    spawn(n, () => ({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-50, 50), vy: rand(-70, -10), g: 70, life: 1.6, max: 1.6, s: 2, c: PALETTE[Math.random() * 7 | 0][2][1] }));
  }
  function splash(x, y, n = 14) {
    spawn(n, () => ({ x: x + rand(-6, 6), y, vx: rand(-30, 30), vy: rand(-80, -30), g: 220, life: 0.8, max: 0.8, s: 1 + (Math.random() * 2 | 0), c: Math.random() < 0.5 ? '#6fc8ff' : '#ffffff' }));
  }

  /* ---------- events ---------- */
  function popBalloon(b) {
    SFX.pop(); tone('square', 1200, 0.03, 0.08, 0.05, 600);
    burstConfetti(b.x, b.y); sparkle(b.x, b.y, 8, 5);
    b.hide = rand(3, 6); b.y = -999;
  }
  function getStar(s) {
    const notes = [784, 880, 988, 1047, 1175, 1319, 1568];
    const f = notes[starNote++ % notes.length];
    tone('sine', f, 0, 0.5, 0.15); tone('sine', f * 2, 0.06, 0.35, 0.05); tone('sine', f * 1.5, 0.12, 0.4, 0.06);
    sparkle(s.x, s.y, 14, 12); sparkle(s.x, s.y, 6, 6, '#ffffff');
    s.hide = rand(8, 14);
  }
  function scareFlock(f) {
    if (f.flee) return;
    f.flee = 5;
    for (const b of f.birds) { const a = rand(-2.6, -0.5); b.fx = f.x + b.dx; b.fy = f.y + b.dy; b.fvx = Math.cos(a) * rand(40, 70) * (b.dx < 0 ? -1 : 1) + f.vx; b.fvy = Math.sin(a) * rand(30, 60); }
    SFX.peep(); setTimeout(SFX.peep, 90); setTimeout(SFX.peep, 200);
  }
  function launchRocket(x) {
    rockets.push({ x: x !== undefined ? x : rand(3990, 4370), y: GY - 100, vy: -rand(150, 190), ty: GY - rand(250, 360), c: pickOne(BAL_COLS) });
    tone('sine', 300, 0, 0.5, 0.04, 1100);
  }
  function burst(r) {
    const n = 28, c2 = pickOne(BAL_COLS);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, sp = rand(45, 65); parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 22, life: 1.4, max: 1.4, s: 2, c: i % 2 ? r.c : c2 }); }
    spawn(8, () => ({ x: r.x + rand(-14, 14), y: r.y + rand(-14, 14), vx: 0, vy: 6, g: 0, life: 1, max: 1, s: 1, c: '#ffffff', star: true }));
    if (onScreen(r.x, 80)) { noise(0, 0.5, 0.28, 220, 0.8); noise(0.08, 0.7, 0.1, 2600, 0.5); }
  }
  function depart(h, loud) {
    if (h.state !== 'parked') return false;
    if (laneA.some(c => c.x + c.len > h.x - 70 && c.x < h.x + 100)) { h.want = true; return true; }
    h.want = false; h.state = 'out';
    const car = { kind: 'v', i: h.i, x: h.x, len: V[h.i].len, v: 0, cruise: 46, rot: 0, yb: h.yb, home: h, merge: 0, traveled: 0 };
    laneA.push(car); h.car = car;
    if (loud || onScreen(h.x)) { sirenBurst(V[h.i].kind, 3.5); if (h.i === 1) SFX.bell(); }
    return true;
  }

  /* ---------- update ---------- */
  function maxY(x) {
    const c = clamp(Math.round(x), 0, WW);
    let m = sprof[c];
    if (Math.abs(x - 3650) < 82) m = Math.min(m, GY - frame.floors * 24 - 4);
    return m - SKID - 1;
  }
  function update(dt) {
    if (!built) return;
    // flying
    let tx = null, ty = null;
    if (heli.intro > 0) {
      heli.intro -= dt; tx = heli.tx; ty = heli.ty;
      if (Math.abs(heli.x - tx) < 8 || hold !== null) heli.intro = 0;
    }
    if (hold !== null) { tx = cam.x + finger[0]; ty = cam.y + finger[1] - 6; }
    const dvx = tx === null ? 0 : clamp((tx - heli.x) * 2.6, -175, 175);
    const dvy = ty === null ? 0 : clamp((ty - heli.y) * 2.6, -135, 135);
    const acc = Math.min(1, dt * (tx === null ? 2 : 3.2));
    heli.vx += (dvx - heli.vx) * acc; heli.vy += (dvy - heli.vy) * acc;
    heli.x += heli.vx * dt; heli.y += heli.vy * dt;
    if (heli.x < 60) { heli.x += (60 - heli.x) * Math.min(1, dt * 6); if (heli.vx < 0) heli.vx *= 0.85; }
    if (heli.x > WW - 60) { heli.x += (WW - 60 - heli.x) * Math.min(1, dt * 6); if (heli.vx > 0) heli.vx *= 0.85; }
    heli.x = clamp(heli.x, 30, WW - 30);
    if (heli.y < 40) { heli.y += (40 - heli.y) * Math.min(1, dt * 6); if (heli.vy < 0) heli.vy *= 0.85; }
    heli.y = Math.max(heli.y, 24);
    const my = maxY(heli.x);
    if (heli.y > my) { heli.y += (my - heli.y) * Math.min(1, dt * 9); if (heli.vy > 0) heli.vy = 0; heli.y = Math.min(heli.y, my + 10); }
    if (heli.vx > 14) heli.dir = 1; else if (heli.vx < -14) heli.dir = -1;
    heli.tilt += (clamp(heli.vx * 0.0012, -0.17, 0.17) - heli.tilt) * Math.min(1, dt * 5);
    const calm = 1 - Math.min(1, Math.hypot(heli.vx, heli.vy) / 80);
    heli.hy = heli.y + Math.sin(T * 2.2) * 1.8 * calm;
    // camera: dead zone plus a little look-ahead
    if (heli.intro <= 0) {
      const lead = clamp(heli.vx * 0.4, -W * 0.22, W * 0.22);
      const wantX = heli.x + lead - W / 2, dz = W * 0.1;
      let tcx = cam.x;
      if (wantX - cam.x > dz) tcx = wantX - dz; else if (wantX - cam.x < -dz) tcx = wantX + dz;
      const wantY = heli.y + clamp(heli.vy * 0.3, -H * 0.12, H * 0.12) - H * FRAME_Y, dzy = H * 0.08;
      let tcy = cam.y;
      if (wantY - cam.y > dzy) tcy = wantY - dzy; else if (wantY - cam.y < -dzy) tcy = wantY + dzy;
      cam.x += (tcx - cam.x) * Math.min(1, dt * 4);
      cam.y += (tcy - cam.y) * Math.min(1, dt * 4);
    }
    cam.x = clamp(cam.x, 0, WW - W); cam.y = clamp(cam.y, Math.min(0, WH - H), camMaxY());
    // rotor sound
    const held = hold !== null;
    rotor(held ? 0.15 : 0.07);
    if ((chopT -= dt) <= 0) { chopT = 0.11; noise(0, 0.05, held ? 0.1 : 0.045, 190, 1.4); }
    if (sirenT > 0 && (sirenT -= dt) <= 0 && sirenStop) { sirenStop(); sirenStop = null; }
    // landing on a helipad
    for (const p of pads) {
      const dx = Math.abs(heli.x - p.x), near = dx < 14 && heli.y > my - 3 && Math.abs(my + SKID + 1 - p.y) < 8 && Math.abs(heli.vx) < 40;
      if (near && !p.landed) { p.landed = true; SFX.chime(); sparkle(p.x, p.y - 4, p.hw, 14); sparkle(p.x, p.y - 10, 10, 6, '#ffffff'); }
      if (p.landed && (dx > 40 || heli.y < my - 30)) p.landed = false;
    }
    updateSky(dt);
    updateGround(dt);
  }

  function updateSky(dt) {
    const hx = heli.x, hy = heli.hy;
    for (const c of cloudsW) {
      c.x += 3 * c.s * dt; if (c.x > WW + 80) c.x = -80;
      const r = Math.round(9 * c.s), cx = c.x + r + 1;
      const inside = Math.abs(hx - cx) < 2 * r + 8 && Math.abs(hy - c.y) < r + 6;
      if (inside && !c.inHeli && T - lastWhoosh > 0.5) { lastWhoosh = T; SFX.whoosh(); puff(hx, hy, 10, '#ffffff'); }
      if (inside && (c.pt -= dt) <= 0) { c.pt = 0.08; puff(hx + rand(-18, 18), hy + rand(-4, 8), 2, '#ffffff'); }
      c.inHeli = inside;
    }
    for (let i = 0; i < flocks.length; i++) {
      const f = flocks[i];
      if (f.flee) {
        f.flee -= dt;
        for (const b of f.birds) { b.fx += b.fvx * dt; b.fy += b.fvy * dt; b.fvy -= 10 * dt; b.ph += dt * 16; }
        if (f.flee <= 0 && !f.birds.some(b => onScreen(b.fx, 20))) flocks[i] = newFlock();
        continue;
      }
      f.x += f.vx * dt; if (f.x < -40) f.x = WW + 40; if (f.x > WW + 40) f.x = -40;
      for (const b of f.birds) b.ph += dt * 6;
      if (Math.abs(f.x - hx) < 46 && Math.abs(f.y - hy) < 30) scareFlock(f);
    }
    for (const b of hot) {
      b.x += b.vx * dt; if (b.x > WW + 60) b.x = -60; if (b.x < -60) b.x = WW + 60;
      if (b.burn > 0) { b.burn -= dt; b.lift = Math.min(70, b.lift + 26 * dt); } else b.lift = Math.max(0, b.lift - 5 * dt);
      b.y = b.by - b.lift + Math.sin(T * 0.8 + b.seed) * 4;
    }
    for (const b of party) {
      if (b.hide > 0) { if ((b.hide -= dt) <= 0) partySpot(b); continue; }
      b.y += b.vy * dt; b.x += Math.sin(T * 1.3 + b.seed) * 6 * dt;
      if (b.y < -20) partySpot(b);
      if (Math.abs(b.x - hx) < 24 && Math.abs(b.y - hy) < 20) popBalloon(b);
    }
    for (const s of stars) {
      if (s.hide > 0) { if ((s.hide -= dt) <= 0) { const [x, y] = skySpot(); s.x = x; s.y = y; sparkle(x, y, 6, 4); } continue; }
      if (Math.abs(s.x - hx) < 26 && Math.abs(s.y - hy) < 22) getStar(s);
    }
    // the plane: waits, takes off to the left, crosses the whole sky, comes back
    const p = plane;
    p.wave = Math.max(0, p.wave - dt);
    if (p.state === 'wait') { p.t += dt; if (p.t > 7) { p.state = 'roll'; p.vx = 0; if (onScreen(p.x)) noise(0, 2.5, 0.12, 700, 0.4); } }
    else if (p.state === 'roll') { p.vx = Math.max(-110, p.vx - 40 * dt); p.x += p.vx * dt; if (p.x < 420) { p.state = 'climb'; p.vy = -10; } }
    else if (p.state === 'climb') { p.x += p.vx * dt; p.vy = Math.max(-40, p.vy - 20 * dt); p.y += p.vy * dt; if (p.y < 120 || p.x < -150) { p.y = Math.max(p.y, 100); if (p.x < -150) { p.state = 'cruise'; p.dir = 1; p.y = 110; } } }
    else if (p.state === 'cruise') { p.x += 70 * dt; if (p.x > WW + 150 && !onScreen(600, 100)) Object.assign(p, { state: 'wait', x: 600, y: GY - 13, dir: -1, t: 0, vx: 0 }); }
    // fireworks
    for (const r of rockets) {
      r.y += r.vy * dt;
      if (Math.random() < 0.6) parts.push({ x: r.x + rand(-1, 1), y: r.y + 3, vx: 0, vy: 10, g: 0, life: 0.4, max: 0.4, s: 1, c: '#ffd21f' });
      if (r.y <= r.ty) { burst(r); r.done = true; }
    }
    for (let i = rockets.length - 1; i >= 0; i--) if (rockets[i].done) rockets.splice(i, 1);
    if (onScreen(4180, 260)) {
      if ((stadium.fw -= dt) <= 0) { stadium.fw = nightK() > 0.5 ? rand(1.4, 2.6) : rand(4, 7); launchRocket(); }
    }
    stadium.cheer = Math.max(0, stadium.cheer - dt);
  }

  function updLane(list, dir, dt) {
    list.sort((a, b) => a.x - b.x);
    const n = list.length, span = WW + 200;
    for (let i = 0; i < n; i++) {
      const c = list[i];
      let gap = 1e9;
      if (n > 1) {
        if (dir > 0) { const a = list[(i + 1) % n]; gap = (i + 1 < n ? a.x : a.x + span) - (c.x + c.len); }
        else { const a = list[(i - 1 + n) % n]; gap = c.x - ((i > 0 ? a.x : a.x - span) + a.len); }
      }
      const want = gap < 8 ? 0 : gap < 34 ? c.cruise * (gap - 8) / 26 : c.cruise;
      c.v += (want - c.v) * Math.min(1, dt * 3);
      c.x += dir * c.v * dt; c.rot += c.v * dt / 5;
      if (c.home) {
        c.traveled += c.v * dt;
        if (c.merge < 1) { c.merge = Math.min(1, c.merge + dt / 1.4); c.yb = Math.round(lerp(c.home.yb, LANE_A, ease(c.merge))); }
      }
      if (dir > 0 && c.x > WW + 100) c.x -= span;
      if (dir < 0 && c.x + c.len < -100) c.x += span;
    }
  }
  function updateGround(dt) {
    const hx = heli.x;
    updLane(laneA, 1, dt); updLane(laneB, -1, dt);
    for (const h of homes) {
      if (h.state === 'parked') {
        h.t += dt;
        if (h.want || (h.t > 12 && onScreen(h.x, -20))) depart(h);
      } else if (h.car && h.car.traveled > 700 && !onScreen(h.car.x, 80) && !onScreen(h.x, 80)) {
        laneA.splice(laneA.indexOf(h.car), 1); h.car = null; h.state = 'parked'; h.t = rand(0, 5);
      }
    }
    for (const p of people) {
      p.cheer = Math.max(0, p.cheer - dt);
      p.near = Math.abs(p.x - hx) < 60 && heli.y < GY - 8 && heli.y > GY - 280;
      if (!p.near && !p.cheer && p.sp) {
        p.x += p.dir * p.sp * dt;
        if (p.x < p.x0) { p.x = p.x0; p.dir = 1; }
        if (p.x > p.x1) { p.x = p.x1; p.dir = -1; }
      }
    }
    // boats
    for (const b of boats) {
      b.x += b.dir * b.sp * dt;
      if (b.x < 690) { b.x = 690; b.dir = 1; }
      if (b.x + b.w > 1220) { b.x = 1220 - b.w; b.dir = -1; }
      b.toot = Math.max(0, b.toot - dt);
      if (b.toot > 0 && Math.random() < dt * 8) puff(b.x + (b.dir > 0 ? 10 : b.w - 11), GY - 32, 1, '#e9eef2');
    }
    // ducks on the pond
    const dk = T * 0.35, mx = 2710 + Math.sin(dk) * 50, ddir = Math.cos(dk) > 0 ? 1 : -1;
    ducks.forEach((d, i) => { d.x = mx - ddir * i * 9; d.dir = ddir; d.hop = Math.max(0, d.hop - dt * 20); });
    // train
    const t = train;
    if (t.wait > 0) { t.wait -= dt; if (t.wait <= 0) t.x = 4600; }
    else {
      t.x += 42 * dt;
      if (t.x - 150 > 5060) t.wait = rand(2, 4);
      if (onScreen(t.x - 75, 120)) {
        if ((chugT -= dt) <= 0) { chugT = 0.28; noise(0, 0.07, 0.045, 320, 1.5); if (t.x > 4740 && t.x < 5050) puff(t.x - 7, DECK - 28, 2, '#e9eef2'); }
      }
    }
    // crane: pick a beam from the pile and set it on the frame
    const c = crane, CS = 30, DS = 60, top = GY - frame.floors * 24;
    const pileD = GY - 23 - (JY + 1), frameD = top - 15 - (JY + 1);
    if (c.state === 'goPile') { c.tx = Math.min(PILE, c.tx + CS * dt); if (c.tx >= PILE) c.state = 'downPile'; }
    else if (c.state === 'downPile') { c.d = Math.min(pileD, c.d + DS * dt); if (c.d >= pileD) { c.state = 'up'; c.beam = true; SFX.boop(0.7); } }
    else if (c.state === 'up') { c.d = Math.max(30, c.d - DS * dt); if (c.d <= 30) c.state = 'goFrame'; }
    else if (c.state === 'goFrame') { c.tx = Math.max(3650, c.tx - CS * dt); if (c.tx <= 3650) c.state = 'downFrame'; }
    else if (c.state === 'downFrame') { c.d = Math.min(frameD, c.d + DS * dt); if (c.d >= frameD) {
      c.beam = false; c.state = 'up2';
      if (frame.floors < 9) frame.floors++;
      if (onScreen(3650)) { SFX.boop(1.2); sparkle(3650, top - 24, 20, 8); }
    } }
    else if (c.state === 'up2') { c.d = Math.max(30, c.d - DS * dt); if (c.d <= 30) c.state = 'goPile'; }
    if (frame.floors >= 9 && !onScreen(3650, 200) && c.state === 'goPile') frame.floors = 3;
    kids.slide = (kids.slide + dt) % 7;
    stadium.balloonT -= dt;
  }

  /* ---------- input ---------- */
  function tap(x, y, id) {
    if (inBox(L.flyHome, x, y)) { hold = null; goScene('station'); return true; }
    const wx = x + cam.x, wy = y + cam.y;
    surprise(wx, wy);
    if (hold === null) {
      hold = id; finger = [x, y]; heli.intro = 0;
      if (T - lastChop > 1.5) { SFX.chop(); lastChop = T; }
    }
    return true;
  }
  const inR = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  function surprise(x, y) {
    for (const s of stars) if (!s.hide && Math.abs(s.x - x) < 14 && Math.abs(s.y - y) < 14) return getStar(s);
    for (const b of party) if (!b.hide && Math.abs(b.x - x) < 10 && y > b.y - 10 && y < b.y + 14) return popBalloon(b);
    for (const f of flocks) if (!f.flee && f.birds.some(b => Math.abs(f.x + b.dx - x) < 16 && Math.abs(f.y + b.dy - y) < 14)) return scareFlock(f);
    for (const b of hot) if (Math.abs(b.x - x) < 22 && y > b.y - 22 && y < b.y + 42) {
      b.burn = 1.6; noise(0, 1, 0.22, 600, 0.5); noise(0, 0.6, 0.08, 2400, 0.6); return;
    }
    const p = plane;
    if (Math.abs(p.x - x) < 38 && Math.abs(p.y - y) < 16) {
      p.wave = 2; tone('sine', 600, 0, 0.5, 0.1, 1200); tone('sine', 1200, 0.5, 0.5, 0.08, 700); sparkle(p.x, p.y, 20, 8); return;
    }
    for (const h of homes) if (h.state === 'parked' && inR(x, y, h.x - 6, h.yb - 42, h.x + V[h.i].len + 6, h.yb + 4)) { depart(h, true); return; }
    for (const c of laneA) if (inR(x, y, c.x - 4, (c.kind === 'v' ? c.yb : LANE_A) - (c.kind === 'v' ? V[c.i].h : 18) - 4, c.x + c.len + 4, (c.kind === 'v' ? c.yb : LANE_A) + 2)) {
      if (c.kind === 'v') { sirenBurst(V[c.i].kind, 2.5); sparkle(c.x + c.len / 2, (c.yb || LANE_A) - 30, 16, 6); } else SFX.honk();
      return;
    }
    for (const c of laneB) if (inR(x, y, c.x - 4, LANE_B - 20, c.x + c.len + 4, LANE_B + 2)) { SFX.beep(); return; }
    for (const b of boats) if (inR(x, y, b.x - 4, GY - 50, b.x + b.w + 4, GY - 4)) { b.toot = 1.2; toot(); return; }
    if (train.wait <= 0 && inR(x, y, train.x - 152, DECK - 34, train.x + 4, DECK + 4)) { whistle(); puff(train.x - 7, DECK - 28, 10, '#ffffff'); return; }
    for (const pp of people) if (inR(x, y, pp.x - 8, (pp.sit || WALK) - 26, pp.x + 8, (pp.sit || WALK) + 4)) { pp.cheer = 1.6; cheer(); sparkle(pp.x, (pp.sit || WALK) - 26, 8, 5); return; }
    if (inR(x, y, 2620, GY - 22, 2800, GY + 2)) { SFX.quack(); ducks.forEach(d => { d.hop = 4; }); splash(ducks[0].x, GY - 4, 8); return; }
    if (inR(x, y, 2830, GY - 60, 3020, GY)) { cheer(); sparkle(2900, GY - 40, 30, 10); return; }
    for (const pl of pools) if (inR(x, y, pl.x0 - 4, pl.y - 18, pl.x1 + 16, pl.y + 10)) {
      pl.splash = 1; noise(0, 0.5, 0.22, 1800, 0.6); SFX.boop(1.3); splash((pl.x0 + pl.x1) / 2, pl.y, 22); return;
    }
    if (inR(x, y, 3946, GY - 190, 4414, GY)) {
      stadium.cheer = 2.5; noise(0, 1.6, 0.13, 900, 0.4); cheer();
      launchRocket(x); setTimeout(() => launchRocket(), 250); setTimeout(() => launchRocket(), 520);
      return;
    }
    if (inR(x, y, 2010, GY - 118, 2162, GY)) { if (!depart(fireHome, true)) SFX.bell(); return; }
    if (inR(x, y, 2180, GY - 80, 2340, GY)) { if (!depart(policeHome, true)) SFX.beep(); return; }
    if (inR(x, y, 3090, GY - 150, 3380, GY)) { if (!depart(ambHome, true)) SFX.chime(); return; }
    if (inR(x, y, 3436, GY - 340, 3910, GY)) { SFX.beep(); sparkle(crane.tx, JY + crane.d + 10, 10, 6); return; }
    if (inR(x, y, 620, GY - 112, 676, GY)) { tone('sawtooth', 110, 0, 0.9, 0.09); tone('sine', 165, 0, 0.9, 0.08); return; }
    for (const c of cloudsW) { const r = Math.round(9 * c.s); if (inR(x, y, c.x - r, c.y - r - 4, c.x + 3 * r + 4, c.y + r)) { SFX.whoosh(); puff(x, y, 8, '#ffffff'); return; } }
  }

  /* ---------- drawing: helicopter ---------- */
  const BODY = [[11, 32, 52], [12, 29, 55], [13, 27, 58], [14, 26, 60], [15, 25, 61], [16, 25, 62], [17, 24, 63], [18, 24, 64], [19, 24, 64], [20, 24, 64], [21, 24, 64], [22, 24, 64], [23, 24, 63], [24, 25, 63], [25, 25, 62], [26, 26, 61], [27, 27, 59], [28, 29, 56], [29, 32, 52]];
  function heliSprite() {
    const c = COLOR.red.c, f = Math.floor(T * 22) % 3, f2 = Math.floor(T * 28) % 2;
    hg.clearRect(0, 0, HW, HH);
    // tail boom, fin with the fan, stabilizer
    R(9, 15, 19, 5, c[1]); R(4, 16, 6, 3, c[1]); R(9, 15, 19, 1, c[0]); R(4, 18, 24, 1, c[2]); R(9, 17, 17, 1, '#f4f7fb');
    R(4, 3, 4, 4, c[1]); R(3, 7, 5, 6, c[1]); R(2, 13, 8, 8, c[1]); R(4, 3, 4, 1, c[0]); R(2, 20, 8, 1, c[2]);
    R(4, 7, 1, 3, '#ffffff'); R(3, 8, 3, 1, '#ffffff');
    circle(6, 16, 4, '#2f3240'); circle(6, 16, 3, '#5a5f6e');
    if (f2) { R(6, 13, 1, 7, '#cfd6dd'); R(3, 16, 7, 1, '#8a929c'); } else { R(3, 16, 7, 1, '#cfd6dd'); R(6, 13, 1, 7, '#8a929c'); }
    R(5, 15, 3, 3, '#2f3240');
    R(13, 20, 9, 2, c[2]); R(13, 19, 1, 4, c[2]); R(21, 19, 1, 4, c[2]);
    // body
    for (const [y, x0, x1] of BODY) R(x0, y, x1 - x0, 1, y < 13 ? c[0] : y > 26 ? c[2] : c[1]);
    R(25, 14, 1, 11, c[0]);
    // engine cowling on top
    R(32, 7, 18, 4, '#f4f7fb'); R(31, 8, 20, 3, '#f4f7fb'); R(32, 7, 18, 1, '#ffffff'); R(31, 10, 20, 1, '#cfd8e2');
    R(33, 8, 4, 2, '#5a5f6e'); R(46, 8, 3, 2, '#9aa3ad');
    // white stripe
    for (const [y, x0, x1] of BODY) if (y === 23 || y === 24) R(x0, y, x1 - x0, 1, '#f4f7fb');
    // windshield with the pilot
    for (const [y, x0, x1] of BODY) if (y >= 13 && y <= 21) { const gx = 50 + Math.max(0, 15 - y); R(gx, y, x1 - gx - 1, 1, GLASS); }
    R(49, 13, 1, 10, c[2]);
    R(52, 14, 5, 3, '#ffffff'); R(52, 15, 1, 1, '#e8222b'); R(53, 17, 4, 3, SKIN[1]); R(56, 17, 1, 1, '#2f3240'); R(55, 18, 1, 1, INK); R(54, 19, 2, 1, '#a3121d');
    R(51, 20, 7, 2, '#f57a12');
    R(59, 14, 2, 1, '#ffffff'); R(61, 16, 1, 3, '#ffffff');
    // sliding door with a firefighter waving
    R(33, 13, 15, 14, c[2]); R(34, 14, 13, 12, c[1]); R(35, 15, 11, 7, GLASS); R(36, 16, 2, 1, '#ffffff');
    const wave = Math.floor(T * 5) % 2;
    R(39, 16, 5, 2, '#ffd21f'); R(38, 17, 7, 1, '#ffd21f'); R(39, 18, 5, 3, SKIN[0]); R(40, 19, 1, 1, INK); R(42, 19, 1, 1, INK); R(40, 21, 3, 1, '#d8b04f');
    R(44, 15 + wave, 1, 3, SKIN[0]);
    R(45, 23, 2, 1, '#e9eef2');
    // winch arm, searchlight, skids, mast
    R(28, 10, 7, 2, '#6b7480'); R(29, 12, 1, 3, '#4a4f5c');
    R(55, 29, 4, 2, '#cfd6dd'); R(58, 29, 1, 2, '#fff6b0');
    R(34, 29, 1, 5, DK); R(51, 29, 1, 5, DK); R(28, 34, 31, 1, DK); R(59, 33, 1, 1, DK); R(60, 32, 1, 1, DK); R(27, 33, 1, 1, DK);
    R(40, 4, 3, 3, DK);
    // main rotor
    alpha(0.22, () => R(3, 2, 72, 2, '#9aa3ad'));
    if (f === 0) R(3, 2, 72, 1, DK); else if (f === 1) R(14, 2, 50, 1, DK); else R(27, 2, 24, 1, DK);
    R(37, 1, 9, 3, '#5a5f6e'); R(38, 1, 7, 1, '#7a808e');
  }
  const dyAt = wx => Math.round((wx - heli.x) * heli.tilt);
  function hp(sx, sy) {
    const wx = Math.round(heli.x) - OX + (heli.dir > 0 ? sx : HW - 1 - sx);
    return [wx, Math.round(heli.hy) - OY + sy + dyAt(wx)];
  }
  function drawHelicopter() {
    const prev = g; g = hg; heliSprite(); g = prev;
    const hx0 = Math.round(heli.x) - OX, hy0 = Math.round(heli.hy) - OY;
    // soft shadow on whatever is below
    const sy = Math.round(sprof[clamp(Math.round(heli.x), 0, WW)]), dist = sy - heli.y;
    if (dist < 160) alpha(0.18 * (1 - dist / 160), () => R(heli.x - 22, sy - 2, 44, 2, '#1d1a2b'));
    for (let i = 0; i < HW; i++) {
      const wx = hx0 + i;
      g.drawImage(hcv, heli.dir > 0 ? i : HW - 1 - i, 0, 1, HH, wx, hy0 + dyAt(wx), 1, HH);
    }
  }

  /* ---------- drawing: things ---------- */
  function drawCloud(c) {
    const r = Math.round(9 * c.s), x = Math.round(c.x), y = Math.round(c.y);
    circle(x, y + 2, r, '#dcebf5'); circle(x + r, y - 3, r + 3, '#dcebf5'); circle(x + 2 * r + 3, y + 2, r, '#dcebf5');
    circle(x, y, r, '#ffffff'); circle(x + r, y - 5, r + 3, '#ffffff'); circle(x + 2 * r + 3, y, r, '#ffffff');
  }
  function drawBird(x, y, ph, dir) {
    x = Math.round(x); y = Math.round(y);
    const up = Math.floor(ph) % 2, c = '#2f3240';
    R(x - 1, y, 4, 2, c); R(dir > 0 ? x + 3 : x - 2, y, 1, 1, '#f57a12');
    if (up) { R(x - 4, y - 3, 2, 1, c); R(x - 2, y - 2, 2, 1, c); R(x + 2, y - 2, 2, 1, c); R(x + 4, y - 3, 2, 1, c); }
    else { R(x - 4, y + 2, 2, 1, c); R(x - 2, y + 1, 2, 1, c); R(x + 2, y + 1, 2, 1, c); R(x + 4, y + 2, 2, 1, c); }
  }
  function drawHot(b) {
    const x = Math.round(b.x), y = Math.round(b.y), [c1, c2] = b.cols, r = 17;
    circle(x, y, r, c1);
    for (let dx = -r; dx <= r; dx++) if (Math.floor((dx + r + 3) / 6) % 2) { const hh = Math.floor(Math.sqrt((r + 0.5) ** 2 - dx * dx)); R(x + dx, y - hh, 1, hh * 2 + 1, c2); }
    for (let k = 0; k < 9; k++) { const half = Math.round(r * 0.8 * (1 - k / 11)); R(x - half, y + r - 3 + k, half * 2 + 1, 1, k % 2 ? c1 : c2); }
    alpha(0.35, () => circle(x - 7, y - 7, 4, '#ffffff'));
    R(x - 6, y + r + 6, 1, 8, DK); R(x + 6, y + r + 6, 1, 8, DK);
    R(x - 5, y + r + 9, 3, 3, SKIN[(b.seed * 3 | 0) % 4]); R(x - 5, y + r + 8, 3, 1, '#5a3a22');
    R(x - 2, y + r + 7 + (Math.floor(T * 4 + b.seed) % 2), 1, 3, SKIN[(b.seed * 3 | 0) % 4]);
    R(x - 7, y + r + 13, 14, 8, '#a8743a'); R(x - 7, y + r + 13, 14, 2, '#7a4a2a'); R(x - 7, y + r + 17, 14, 1, '#8a5a3a');
  }
  function drawParty(b) {
    const x = Math.round(b.x), y = Math.round(b.y);
    for (let k = 0; k < 12; k++) R(x + Math.round(Math.sin(T * 3 + b.seed + k * 0.5)), y + 7 + k, 1, 1, '#6b7480');
    circle(x, y, 5, b.c); R(x - 3, y + 5, 7, 1, b.c); R(x - 1, y + 6, 3, 1, b.c);
    R(x - 2, y - 3, 2, 2, '#ffffff');
  }
  function drawPlane() {
    const p = plane, d = p.dir, x = Math.round(p.x) - 32, wob = p.wave > 0 ? Math.sin(p.wave * 12) : 0, y = Math.round(p.y) - 11 + Math.round(wob * 2);
    const M = (dx, dy, w, h, c) => R(d > 0 ? x + dx : x + 64 - dx - w, y + dy, w, h, c);
    M(2, 0, 3, 8, '#2a6fe0'); M(5, 2, 3, 6, '#2a6fe0'); M(8, 5, 2, 3, '#2a6fe0'); M(2, 0, 3, 1, '#6fb6ff');
    M(6, 8, 52, 9, '#f4f7fb'); M(3, 8, 3, 6, '#f4f7fb'); M(58, 9, 3, 7, '#f4f7fb'); M(61, 10, 2, 5, '#f4f7fb'); M(63, 12, 1, 2, '#f4f7fb');
    M(6, 8, 52, 1, '#ffffff'); M(4, 13, 58, 2, '#2a6fe0'); M(6, 16, 52, 1, '#cfd8e2');
    M(0, 9, 9, 2, '#1a3f9a');
    for (let k = 14; k < 52; k += 3) M(k, 10, 2, 2, '#4a6a8a');
    M(57, 10, 4, 2, '#2f3240');
    const wy = Math.round(wob * 4);
    M(24, 14 + wy, 20, 2, '#9aa3ad'); M(22, 15 + wy, 4, 1, '#9aa3ad');
    if (p.wave > 0) M(30, 9 - wy, 12, 2, '#b4bec8');
    M(30, 16, 10, 4, '#cfd6dd'); M(39, 16, 1, 4, DK);
    if (p.state !== 'cruise' && p.y > GY - 120) { M(20, 17, 1, 3, DK); M(19, 20, 3, 2, TIRE); M(52, 17, 1, 3, DK); M(51, 20, 3, 2, TIRE); }
  }
  function drawBoat(b) {
    const x = Math.round(b.x), wl = GY - 12 + Math.round(Math.sin(T * 2 + b.seed)), d = b.dir, w = b.w;
    const M = (dx, dy, ww, hh, c) => R(d > 0 ? x + dx : x + w - dx - ww, wl + dy, ww, hh, c);
    if (b.kind === 'tug') {
      M(0, -6, 36, 6, '#e8222b'); M(36, -6, 3, 4, '#e8222b'); M(0, -6, 37, 1, '#ff7a6b'); M(0, 0, 37, 3, '#2f3240');
      M(8, -4, 3, 3, TIRE); M(22, -4, 3, 3, TIRE);
      M(14, -14, 16, 8, '#f4f7fb'); M(16, -12, 4, 3, GLASS); M(22, -12, 4, 3, GLASS); M(13, -15, 18, 1, '#2f3240');
      M(8, -20, 5, 14, '#2f3240'); M(8, -17, 5, 2, '#ffd21f');
    } else if (b.kind === 'sail') {
      M(2, -5, 30, 4, '#f4f7fb'); M(32, -5, 3, 2, '#f4f7fb'); M(4, -1, 27, 3, '#2a6fe0');
      M(16, -36, 1, 31, '#7a4a2a');
      for (let k = 0; k < 27; k++) M(17, -34 + k, Math.round(k * 0.55) + 1, 1, b.sail);
      for (let k = 0; k < 19; k++) M(15 - Math.round(k * 0.45), -27 + k, Math.round(k * 0.45) + 1, 1, '#ffffff');
      M(17, -38, 5, 3, '#ffd21f');
    } else {
      M(0, -7, 72, 7, '#1a3f9a'); M(72, -7, 2, 4, '#1a3f9a'); M(0, -7, 72, 1, '#2a6fe0'); M(0, -2, 72, 2, '#e8222b');
      M(6, -15, 60, 8, '#f4f7fb'); for (let k = 0; k < 9; k++) M(9 + k * 6, -13, 4, 3, GLASS);
      M(14, -21, 40, 6, '#e9eef2'); for (let k = 0; k < 6; k++) M(16 + k * 6, -19, 4, 2, GLASS);
      M(54, -21, 8, 6, '#f4f7fb'); M(56, -20, 5, 3, GLASS2);
      M(28, -29, 7, 8, '#ffd21f'); M(28, -29, 7, 2, '#2f3240');
      for (let k = 0; k < 4; k++) { M(18 + k * 8, -24, 2, 3, ['#e8222b', '#3fb43a', '#ff6fb4', '#2a6fe0'][k]); M(18 + k * 8, -26, 2, 2, SKIN[k]); }
    }
  }
  function drawTrain() {
    const t = train;
    if (t.wait > 0) return;
    const fx = Math.round(t.x), yb = DECK, rot = t.x / 4;
    R(fx - 40, yb - 7, 40, 3, DK);
    R(fx - 26, yb - 18, 24, 11, '#2f3240'); R(fx - 26, yb - 18, 24, 2, '#5a5f6e');
    R(fx - 20, yb - 18, 1, 11, '#ffd21f'); R(fx - 11, yb - 18, 1, 11, '#ffd21f');
    R(fx - 3, yb - 16, 3, 9, '#5a5f6e'); R(fx - 2, yb - 13, 2, 2, '#fff6b0');
    for (let k = 0; k < 4; k++) R(fx - 2 + k, yb - 7 + k, 2, 1, '#e8222b');
    R(fx - 9, yb - 26, 5, 8, '#2f3240'); R(fx - 10, yb - 27, 7, 2, '#5a5f6e');
    R(fx - 18, yb - 21, 5, 3, '#ffd21f');
    R(fx - 40, yb - 27, 15, 20, '#e8222b'); R(fx - 41, yb - 29, 17, 3, '#2f3240'); R(fx - 37, yb - 24, 9, 7, GLASS);
    R(fx - 34, yb - 22, 4, 4, SKIN[0]); R(fx - 35, yb - 23, 6, 2, '#2a6fe0');
    for (const [wx, r] of [[-33, 4], [-21, 4], [-9, 3]]) { circle(fx + wx, yb - r, r, TIRE); wheel(fx + wx, yb - r, r, rot); }
    R(fx - 33, yb - 5, 24, 1, '#cfd6dd');
    const cols = [['#2a6fe0', '#1a3f9a'], ['#3fb43a', '#1f7a2a'], ['#ffd21f', '#c99410']];
    for (let k = 0; k < 3; k++) {
      const cx = fx - 42 - 36 * k - 34, [c1, c2] = cols[k];
      R(cx + 34, yb - 9, 4, 2, DK);
      R(cx, yb - 23, 34, 16, c1); R(cx - 1, yb - 25, 36, 3, c2); R(cx, yb - 9, 34, 2, c2);
      for (let j = 0; j < 4; j++) { R(cx + 3 + j * 8, yb - 20, 5, 5, GLASS); if ((j + k) % 2) { R(cx + 4 + j * 8, yb - 18, 3, 3, SKIN[(j + k) % 4]); R(cx + 4 + j * 8, yb - 19, 3, 1, '#5a3a22'); } }
      for (const wx of [7, 27]) { circle(cx + wx, yb - 3, 3, TIRE); wheel(cx + wx, yb - 3, 3, rot); }
    }
  }
  function drawCraneLive() {
    const c = crane, ty = JY + 1, hy = ty + Math.round(c.d);
    R(Math.round(c.tx) - 5, ty - 1, 10, 4, '#5a5f6e');
    R(Math.round(c.tx) - 1, ty + 3, 1, hy - ty - 3, '#4a4f5c'); R(Math.round(c.tx) + 1, ty + 3, 1, hy - ty - 3, '#4a4f5c');
    R(Math.round(c.tx) - 3, hy, 7, 4, '#ffd21f'); R(Math.round(c.tx) - 1, hy + 4, 3, 3, '#5a5f6e');
    const beam = (bx, by) => { R(bx - 18, by, 36, 5, '#d8582f'); R(bx - 18, by, 36, 1, '#ff8a5a'); R(bx - 18, by + 4, 36, 1, '#9a3a1a'); };
    if (c.beam) { line(Math.round(c.tx), hy + 6, Math.round(c.tx) - 14, hy + 12, '#4a4f5c'); line(Math.round(c.tx), hy + 6, Math.round(c.tx) + 14, hy + 12, '#4a4f5c'); beam(Math.round(c.tx), hy + 12); }
    for (let k = 0; k < 3; k++) beam(PILE + (k % 2) * 3, GY - 6 - k * 5);
    R(PILE - 22, GY - 2, 4, 2, '#7a4a2a'); R(PILE + 18, GY - 2, 4, 2, '#7a4a2a');
    // the steel frame
    const f = frame, topY = GY - f.floors * 24;
    for (let x = f.x0; x <= f.x1; x += 30) { R(x - 2, topY, 4, GY - topY, '#d8582f'); R(x - 2, topY, 1, GY - topY, '#ff8a5a'); }
    for (let j = 1; j <= f.floors; j++) {
      const y = GY - j * 24;
      R(f.x0 - 2, y, f.x1 - f.x0 + 4, 4, '#d8582f'); R(f.x0 - 2, y, f.x1 - f.x0 + 4, 1, '#ff8a5a');
      if (j % 2) for (let x = f.x0; x < f.x1; x += 60) line(x + 2, y + 4, x + 28, y + 24, '#b0441f');
    }
    R(f.x0 + 30, topY - 2, 60, 2, '#cfd6dd');
  }
  function drawPark() {
    // pond
    const px0 = 2640, px1 = 2780, pc = (px0 + px1) / 2, pw = (px1 - px0) / 2;
    for (let dy = -5; dy <= 5; dy++) { const w = pw * Math.sqrt(1 - (dy / 5.5) ** 2); R(pc - w, GY - 6 + dy, 2 * w, 1, dy < -2 ? '#6fb6ff' : '#3f8fd6'); }
    const sh = Math.floor(T * 2) % 3;
    R(pc - 40 + sh * 3, GY - 4, 5, 1, '#bfe6ff'); R(pc + 20 - sh * 2, GY - 2, 4, 1, '#bfe6ff'); R(pc - 4 + sh, GY - 7, 3, 1, '#bfe6ff');
    for (const d of ducks) drawDuck(d.x, GY - 3 - Math.round(d.hop), d.big, d.dir, Math.floor(T * 4 + d.i) % 2);
    // swings
    for (const [sx, ph] of [[2922, 0], [2946, 1.7]]) {
      const a = Math.sin(T * 2.2 + ph) * 0.45, ex = sx + Math.sin(a) * 32, ey = GY - 47 + Math.cos(a) * 32;
      line(sx, GY - 47, ex - 3, ey, '#6b7480'); line(sx + 1, GY - 47, ex + 4, ey, '#6b7480');
      R(ex - 4, ey, 9, 2, '#a8743a');
      drawPerson({ type: ph ? 'kid2' : 'kid', x: ex, yb: ey, dir: Math.cos(T * 2.2 + ph) > 0 ? 1 : -1, pose: 'sit', skin: SKIN[ph ? 2 : 0], seed: ph });
    }
    // slide: climb, slide, run back
    const s = kids.slide;
    let kx, ky, pose = 'stand', dir = 1, walk = false;
    if (s < 2) { kx = 2844; ky = GY - s / 2 * 44; walk = true; }
    else if (s < 2.6) { kx = 2846 + (s - 2) * 20; ky = GY - 44; }
    else if (s < 3.6) { const k = (s - 2.6); kx = 2860 + k * 36; ky = GY - 44 + k * 36; pose = 'slide'; }
    else { const k = (s - 3.6) / 3.4; kx = lerp(2898, 2843, k); ky = GY; dir = -1; walk = true; }
    drawPerson({ type: 'kid3', x: kx, yb: ky, dir, pose, walk, skin: SKIN[1], seed: 3 });
    // seesaw
    const a = Math.sin(T * 1.7) * 0.28, c = Math.cos(a), sn = Math.sin(a), pvx = 3005, pvy = GY - 13;
    for (let k = -26; k <= 26; k++) R(Math.round(pvx + k * c), Math.round(pvy + k * sn), 1, 2, '#e8222b');
    drawPerson({ type: 'kid', x: pvx - 22 * c, yb: pvy - 22 * sn, dir: 1, pose: 'sit', skin: SKIN[3], seed: 4 });
    drawPerson({ type: 'kid2', x: pvx + 22 * c, yb: pvy + 22 * sn, dir: -1, pose: 'sit', skin: SKIN[0], seed: 5 });
  }
  function drawPools() {
    for (const p of pools) {
      const w = p.x1 - p.x0, sh = Math.floor(T * 3 + p.seed) % 4;
      R(p.x0 + 3 + sh * 3, p.y + 2, 3, 1, '#bfe6ff'); R(p.x0 + w - 10 - sh * 2, p.y + 3, 3, 1, '#bfe6ff');
      const bx = p.x0 + Math.round((Math.sin(T * 0.9 + p.seed) + 1) / 2 * (w - 10)) + 4;
      R(bx - 3, p.y, 7, 3, '#ffd21f'); R(bx + 3, p.y - 2, 2, 2, '#ffd21f'); R(bx + 5, p.y - 1, 1, 1, '#f57a12');
      const kx = p.x0 + Math.round(w * 0.35), bob = Math.floor(T * 2 + p.seed) % 2;
      R(kx - 2, p.y - 2 + bob, 5, 4, SKIN[1]); R(kx - 2, p.y - 3 + bob, 5, 1, '#5a3a22'); R(kx + 1, p.y - 1 + bob, 1, 1, INK);
      if (p.splash > 0) { p.splash -= 1 / 60; R(kx + 4, p.y - 6 + bob, 1, 4, SKIN[1]); }
    }
  }
  function drawWindsock() {
    R(490, GY - 34, 1, 34, DK);
    const fl = Math.floor(T * 6) % 2;
    for (let k = 0; k < 4; k++) R(491 + k * 4, GY - 34 + (k > 1 ? fl : 0), 4, 4 - (k >> 1), k % 2 ? '#ffffff' : '#f57a12');
  }
  function drawLamps() {
    for (const x of lamps) {
      if (x < CX - 10 || x > CX + W + 10) continue;
      R(x, GY - 28, 1, 30, '#4a4f5c'); R(x - 1, GY, 3, 2, '#4a4f5c'); R(x, GY - 28, 5, 1, '#4a4f5c');
      R(x + 3, GY - 27, 5, 2, '#2f3240'); R(x + 4, GY - 25, 3, 1, '#fff6c8');
    }
  }
  function drawPeople() {
    for (const p of people) {
      if (p.x < CX - 12 || p.x > CX + W + 12) continue;
      const hop = p.cheer > 0 ? Math.abs(Math.sin(p.cheer * 9)) * 4 : 0;
      const look = heli.x > p.x ? 1 : -1, yb = p.sit || WALK;
      if (p.sit) { drawPerson({ type: p.type, x: p.x, yb, dir: p.near ? look : p.dir, pose: p.cheer ? 'cheer' : p.near ? 'wave' : 'sit', skin: p.skin, seed: p.seed, hop }); continue; }
      drawPerson({ type: p.type, x: p.x, yb, dir: p.near || p.cheer ? look : p.dir, pose: p.cheer ? 'cheer' : p.near ? 'wave' : 'stand', walk: !p.near && !p.cheer, skin: p.skin, seed: p.seed, hop });
      if (p.hat) { const top = Math.floor(yb - hop) - 22; R(p.x - 4, top - 1, 9, 3, '#ffd21f'); R(p.x - 5, top + 1, 11, 1, '#e0b010'); }
    }
  }
  function drawRoad() {
    const x0 = CX - 2, w = W + 4;
    R(x0, GY, w, 6, '#d8d2c2'); R(x0, GY, w, 1, '#b9b2a0');
    R(x0, GY + 6, w, WH - GY - 6, '#4b4f5c'); R(x0, GY + 6, w, 2, '#8f8b80');
    for (let x = Math.floor(CX / 20) * 20; x < CX + W + 20; x += 20) R(x, GY + 23, 10, 1, '#ffd21f');
    R(x0, WH - 4, w, 4, '#bdb8ac');
    if (CY + H > WH) R(x0, WH, w, CY + H - WH + 2, '#3e4250');
    for (const x of [1210, 2470, 3420, 4500]) if (onScreen(x, 20)) for (let k = 0; k < 6; k++) R(x + k * 5, GY + 9, 3, 30, '#f4f7fb');   // crosswalks
  }
  function drawGroundBack() {
    const seg = (a, b, fn) => { const l = Math.max(a, CX - 2), r = Math.min(b, CX + W + 2); if (r > l) fn(l, r - l); };
    seg(0, 620, (x, w) => { R(x, GY - 14, w, 10, '#7cc96a'); R(x, GY - 4, w, 4, '#5a5f6e'); for (let k = Math.floor(x / 24) * 24; k < x + w; k += 24) R(k, GY - 3, 12, 1, '#ffffff'); });
    seg(620, 1240, (x, w) => {
      R(x, GY - 28, w, 28, '#3a8fd0'); R(x, GY - 28, w, 2, '#7cc8f5');
      const sh = Math.floor(T * 2) % 2;
      for (let k = Math.floor(x / 16) * 16; k < x + w; k += 16) R(k + sh * 4 + ((k / 16) % 3) * 3, GY - 20 + ((k / 16) % 3) * 5, 5, 1, '#8fd0f5');
    });
    seg(1240, 2560, (x, w) => R(x, GY - 3, w, 3, '#c9c2b2'));
    seg(2560, 3080, (x, w) => { R(x, GY - 10, w, 10, '#6cbf5a'); R(x, GY - 10, w, 1, '#8fd877'); });
    seg(3080, 3420, (x, w) => R(x, GY - 3, w, 3, '#c9c2b2'));
    seg(3420, 3920, (x, w) => { R(x, GY - 6, w, 6, '#b08a5a'); R(x, GY - 6, w, 1, '#c9a27a'); });
    seg(3920, 4450, (x, w) => R(x, GY - 3, w, 3, '#c9c2b2'));
    seg(4450, WW, (x, w) => { R(x, GY - 10, w, 10, '#6cbf5a'); R(x, GY - 10, w, 1, '#8fd877'); });
  }
  function drawParallax() {
    const mY = camMaxY(), base = f => Math.round(GY - mY + (mY - CY) * f);   // screen y of each layer's foot
    // far mountains
    let b = base(0.1);
    for (let sx = 0; sx < W; sx += 4) {
      const lx = sx + CX * 0.1, h = 70 + 30 * Math.sin(lx * 0.011) + 18 * Math.sin(lx * 0.027 + 1.3);
      R(sx + CX, b - h + CY, 4, H + 4, '#b4d0e8'); R(sx + CX, b - h + CY, 4, 2, '#d4e6f4');
    }
    // distant skyline
    b = base(0.3);
    const f = 0.3, off = CX * f, i0 = Math.floor(off / 22) - 1;
    for (let i = i0; i < i0 + W / 22 + 3; i++) {
      const bx = Math.round(i * 22 - off) + CX, w = 14 + Math.round(hsh(i) * 8), h = 22 + Math.round(hsh(i * 1.7) * 62);
      R(bx, b - h + CY, w, H, '#a3c1da'); R(bx, b - h + CY, w, 1, '#c2d8ea');
      if (hsh(i * 3.1) < 0.18) R(bx + (w >> 1), b - h - 10 + CY, 1, 10, '#a3c1da');
    }
    // near hills
    b = base(0.55);
    for (let sx = 0; sx < W; sx += 3) {
      const lx = sx + CX * 0.55, h = 26 + 14 * Math.sin(lx * 0.018) + 8 * Math.sin(lx * 0.047 + 2);
      R(sx + CX, b - h + CY, 3, H + 4, '#9fd88a');
    }
  }
  function drawSkyline_lit(k) {
    const mY = camMaxY(), b = Math.round(GY - mY + (mY - CY) * 0.3), off = CX * 0.3, i0 = Math.floor(off / 22) - 1;
    alpha(k * 0.8, () => {
      for (let i = i0; i < i0 + W / 22 + 3; i++) {
        const bx = Math.round(i * 22 - off) + CX, w = 14 + Math.round(hsh(i) * 8), h = 22 + Math.round(hsh(i * 1.7) * 62);
        for (let j = 0; j < 4; j++) R(bx + 2 + Math.round(hsh(i * 9 + j) * (w - 4)), b + CY - 6 - Math.round(hsh(i * 7 + j * 3) * (h - 10)), 1, 1, '#ffe9a8');
      }
    });
  }
  const visS = s => s.x + s.w >= CX && s.x <= CX + W && s.y <= CY + H && s.y + s.h >= CY;

  function drawWorld() {
    if (!built) return;
    CX = Math.round(cam.x); CY = Math.round(cam.y);
    g.save(); g.translate(-CX, -CY);
    drawParallax();
    drawGroundBack();
    for (const c of cloudsW) if (!c.front && c.x + 60 > CX && c.x - 20 < CX + W) drawCloud(c);
    for (const s of statics) if (!s.front && visS(s)) g.drawImage(s.img, s.x, s.y);
    if (onScreen(3650, 200)) drawCraneLive();
    if (onScreen(2800, 260)) drawPark();
    drawPools();
    if (onScreen(500, 40)) drawWindsock();
    if (onScreen(950, 330)) for (const b of boats) drawBoat(b);
    if (onScreen(4900, 400)) drawTrain();
    if (plane.x > CX - 40 && plane.x < CX + W + 40) drawPlane();
    for (const s of statics) if (s.front && visS(s)) g.drawImage(s.img, s.x, s.y);
    const wl = Math.max(620, CX - 2), wr = Math.min(1240, CX + W + 2);
    if (wr > wl) alpha(0.85, () => R(wl, GY - 9, wr - wl, 9, '#3a8fd0'));
    drawRoad();
    drawLamps();
    for (const h of homes) if (h.state === 'parked' && onScreen(h.x, 70)) drawV(h.i, h.x, h.yb, h.want, 0, 0);
    drawPeople();
    for (const c of laneB) if (c.x + c.len > CX - 4 && c.x < CX + W + 4) {
      const x = Math.floor(c.x);
      g.save(); g.translate(2 * x + 34, 0); g.scale(-1, 1); drawCar(x, LANE_B, c.col, -c.rot); g.restore();
    }
    for (const c of laneA) if (c.x + c.len > CX - 4 && c.x < CX + W + 4) {
      if (c.kind === 'v') drawV(c.i, c.x, c.yb, true, 0, c.rot); else drawCar(c.x, LANE_A, c.col, c.rot);
    }
    for (const b of hot) if (b.x > CX - 30 && b.x < CX + W + 30) drawHot(b);
    for (const b of party) if (!b.hide && b.x > CX - 10 && b.x < CX + W + 10) drawParty(b);
    for (const f of flocks) for (const b of f.birds) {
      const x = f.flee ? b.fx : f.x + b.dx, y = f.flee ? b.fy : f.y + b.dy + Math.sin(T * 1.5 + b.ph) * 2;
      if (x > CX - 8 && x < CX + W + 8) drawBird(x, y, b.ph, f.flee ? Math.sign(b.fvx) : f.vx);
    }
    drawHelicopter();
    alpha(0.82, () => { for (const c of cloudsW) if (c.front && c.x + 60 > CX && c.x - 20 < CX + W) drawCloud(c); });
    g.restore();
    for (const d of vDraws) { d.x -= CX; d.yb -= CY; }   // the engine adds vehicle lights in screen space
  }

  function glowAt(k, x, y, c, r = 3) { if (k > 0.02) alpha(0.4 * k, () => circle(x, y, r, c)); }
  function drawLit() {
    if (!built) return;
    const k = nightK();
    g.save(); g.translate(-CX, -CY);
    if (k > 0.02) {
      drawSkyline_lit(k);
      alpha(k, () => { for (const s of statics) if (s.lit && visS(s)) g.drawImage(s.lit, s.x, s.y); });
      for (const x of lamps) if (x > CX - 20 && x < CX + W + 20) {
        alpha(0.5 * k, () => R(x + 4, GY - 25, 3, 1, '#fffbe6'));
        alpha(0.14 * k, () => { for (let j = 0; j < 24; j += 2) R(x + 5 - j * 0.3, GY - 24 + j, 1 + j * 0.6, 2, '#fff3b0'); });
        glowAt(k, x + 5, GY - 25, '#fff3b0', 5);
      }
      // lighthouse beam sweeping
      if (onScreen(650, 200)) {
        const lx = 649, ly = GY - 106, s = Math.cos(T * 1.1), len = Math.round(150 * Math.abs(s)), d = s > 0 ? 1 : -1;
        alpha(0.22 * k, () => { for (let j = 0; j < len; j += 2) { const half = 1 + j * 0.07; R(lx + d * j, ly - half, 2, half * 2, '#fff6c8'); } });
        glowAt(k, lx, ly, '#fff6c8', 7);
      }
      // stadium floodlights
      if (onScreen(4180, 280)) for (const lx of [3932, 4424]) {
        alpha(0.1 * k, () => { for (let j = 0; j < 90; j += 3) R(lx + (lx < 4180 ? j * 1.5 : -j * 1.5) - j * 0.4, GY - 172 + j, j * 0.8 + 4, 3, '#fffbe6'); });
        glowAt(k, lx + 2, GY - 174, '#fffbe6', 12);
      }
      // train windows and headlamp
      if (train.wait <= 0 && onScreen(train.x - 75, 120)) {
        const fx = Math.round(train.x);
        alpha(k, () => { for (let j = 0; j < 3; j++) { const cx = fx - 42 - 36 * j - 34; for (let q = 0; q < 4; q++) R(cx + 3 + q * 8, DECK - 20, 5, 5, W_ON); } R(fx - 37, DECK - 24, 9, 7, W_ON); });
        alpha(0.25 * k, () => { for (let j = 0; j < 40; j += 2) R(fx + j, DECK - 14 - j * 0.15, 2, 2 + j * 0.3, '#fff3b0'); });
      }
      // car lights for the little cars
      for (const c of laneA) if (c.kind === 'car' && c.x + 40 > CX && c.x < CX + W + 40) {
        const x = Math.floor(c.x);
        alpha(0.6 * k, () => { R(x + 33, LANE_A - 8, 1, 2, '#fffbe6'); circle(x + 34, LANE_A - 7, 3, '#fff3b0'); R(x, LANE_A - 8, 1, 2, '#ff4a3a'); });
        alpha(0.12 * k, () => { for (let j = 0; j < 28; j += 2) R(x + 34 + j, LANE_A - 8 - j * 0.12, 2, 2 + j * 0.24, '#fff3b0'); });
      }
      for (const c of laneB) if (c.x + 40 > CX && c.x < CX + W + 40) {
        const x = Math.floor(c.x);
        alpha(0.6 * k, () => { R(x, LANE_B - 8, 1, 2, '#fffbe6'); circle(x - 1, LANE_B - 7, 3, '#fff3b0'); R(x + 33, LANE_B - 8, 1, 2, '#ff4a3a'); });
      }
      if (onScreen(950, 330)) for (const b of boats) if (b.kind === 'ferry') {
        const x = Math.round(b.x), wl = GY - 12 + Math.round(Math.sin(T * 2 + b.seed));
        alpha(k, () => { for (let q = 0; q < 9; q++) R(b.dir > 0 ? x + 9 + q * 6 : x + b.w - 13 - q * 6, wl - 13, 4, 3, W_ON); });
      }
    }
    // blinking lights on towers and antennas
    for (const b of blinks) {
      if (b.x < CX - 10 || b.x > CX + W + 10) continue;
      const on = b.steady || Math.floor(T * 1.6 + b.ph * 0.37) % 2 === 0;
      if (on) { R(b.x - 1, b.y, 2, 2, b.c); glowAt(Math.max(k, 0.3), b.x, b.y + 1, b.c, b.glow ? 6 : 4); }
    }
    // helipad edge lights chase around
    for (const p of pads) {
      if (p.x < CX - 60 || p.x > CX + W + 60) continue;
      const step = Math.floor(T * (p.landed ? 10 : 4));
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 2 * i / 8, x = Math.round(p.x + Math.cos(a) * p.hw), y = Math.round(p.y + Math.sin(a) * 3);
        const on = step % 8 === i || step % 8 === (i + 4) % 8;
        R(x, y, 1, 1, on ? '#7dff8a' : '#2f8a4a'); if (on) glowAt(Math.max(k, 0.25), x, y, '#7dff8a', 2);
      }
    }
    // hot-air balloon burners
    for (const b of hot) if (b.burn > 0 && b.x > CX - 30 && b.x < CX + W + 30) flame(Math.round(b.x), Math.round(b.y) + 27, 0.5, b.seed);
    // plane nav lights
    if (plane.x > CX - 40 && plane.x < CX + W + 40 && Math.floor(T * 2) % 2) { const x = Math.round(plane.x), y = Math.round(plane.y); R(x - plane.dir * 30, y - 11, 2, 2, RED_ON); glowAt(Math.max(k, 0.3), x - plane.dir * 30, y - 10, RED_ON, 4); }
    // gold stars
    for (const s of stars) if (!s.hide && s.x > CX - 12 && s.x < CX + W + 12 && s.y > CY - 12 && s.y < CY + H + 12) drawStar(s);
    // fireworks rockets and all the sparkles
    for (const r of rockets) R(r.x, r.y, 2, 3, '#fff6b0');
    drawParticles();
    // helicopter: searchlight at night, nav lights always
    if (k > 0.02) {
      const [sx, sy] = hp(58, 31), floor = sprof[clamp(sx, 0, WW)], len = Math.max(8, floor - sy), lean = heli.dir * 0.25;
      for (let j = 0; j < len; j += 2) { const half = 1.5 + j * 0.2; alpha(0.12 * k * (1 - j / (len * 1.3)), () => R(sx - half + j * lean, sy + j, half * 2, 2, '#fff3b0')); }
      alpha(0.25 * k, () => { const ex = sx + len * lean; R(ex - 12, floor - 2, 24, 2, '#fff3b0'); });
    }
    const blink = Math.floor(T * 2.5) % 2, [tx, ty] = hp(5, 3), [nx, ny] = hp(63, 19), [bx, by] = hp(42, 30);
    if (blink) { R(tx, ty, 2, 1, RED_ON); glowAt(Math.max(k, 0.3), tx, ty, RED_ON, 4); }
    R(nx, ny, 1, 2, '#5cff7a'); glowAt(k, nx, ny, '#5cff7a', 2);
    if ((T * 1.3) % 1 < 0.1) { R(bx, by, 2, 1, '#ff5a5a'); glowAt(Math.max(k, 0.3), bx, by, '#ff5a5a', 5); }
    g.restore();
  }
  function drawStar(s) {
    const x = Math.round(s.x), y = Math.round(s.y + Math.sin(T * 2 + s.ph) * 2), tw = Math.floor(T * 3 + s.ph) % 3;
    alpha(0.25, () => circle(x, y, 8, '#fff27a'));
    R(x - 1, y - 7, 3, 15, '#c98a10'); R(x - 7, y - 1, 15, 3, '#c98a10'); R(x - 3, y - 3, 7, 7, '#c98a10');
    R(x, y - 6, 1, 13, '#ffd21f'); R(x - 6, y, 13, 1, '#ffd21f'); R(x - 2, y - 2, 5, 5, '#ffd21f'); R(x - 1, y - 1, 2, 2, '#fff6b0');
    if (tw === 0) { R(x + 5, y - 6, 1, 3, '#ffffff'); R(x + 4, y - 5, 3, 1, '#ffffff'); }
  }

  function layout() {
    const s = L.blob;
    L.flyHome = { x: L.safeL + 8, y: H - L.safeB - s - 8, s };
    if (built) { cam.x = clamp(cam.x, 0, Math.max(0, WW - W)); cam.y = clamp(cam.y, Math.min(0, WH - H), camMaxY()); }
  }

  SCENES.flyer = {
    view: [186, 200],
    freeTouch: true,   // touch anywhere flies the helicopter; clouds don't change the weather
    state: { cam, heli, people, laneA, homes, stars },   // read by the automated tests
    layout,
    groundY: () => clamp(GY - cam.y - 60, 40, 2000),
    enter() {
      if (!built) build();
      if (!savedClouds) savedClouds = clouds;
      clouds = [];
      hold = null;
      const sx = 2090, sy = GY - 150;
      Object.assign(heli, { x: sx - W * 0.5 - 40, y: sy, vx: 120, vy: 0, dir: 1, tilt: 0, intro: 4, tx: sx, ty: sy });
      cam.x = clamp(sx - W / 2, 0, WW - W); cam.y = clamp(sy - H * FRAME_Y, Math.min(0, WH - H), camMaxY());
      for (const h of homes) h.t = h === fireHome ? 6 : rand(0, 6);
      SFX.chop(); lastChop = T;
      say('helicopter');
    },
    leave() {
      hold = null; rotor(0);
      if (sirenStop) { sirenStop(); sirenStop = null; }
      if (savedClouds) { clouds = savedClouds; savedClouds = null; }
    },
    update,
    tap,
    move(x, y, id) { if (id === hold) finger = [x, y]; },
    release(id) { if (id === hold) hold = null; },
    drawWorld,
    drawLit,
    drawUI() { drawHomeButton(L.flyHome); },
  };
})();
