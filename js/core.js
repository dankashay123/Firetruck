// Shared engine: canvas, pixel helpers, sprites, sound, sky (day/night), scenes and input.
// Scene files register themselves in SCENES; see the "scenes" section for the contract.
'use strict';

/* ---------- canvas ---------- */
const stage = document.getElementById('stage');
const cv = document.getElementById('screen');
const ctx = cv.getContext('2d');
const lo = document.createElement('canvas');       // the low-res frame that gets scaled up
const worldCv = document.createElement('canvas');  // world layer, darkened at night
const loG = lo.getContext('2d'), worldG = worldCv.getContext('2d');
let g = loG;                                        // current draw target for every helper
let W = 320, H = 250, S = 1, dpr = 1;
let T = 0;                                          // seconds since load
let started = false;
const L = {};                                       // layout values, in virtual pixels
let parts = [];

/* ---------- colors ---------- */
// [light, mid, dark] ramps for each paint pot
const PALETTE = [
  ['red',    'Red',    ['#ff7a6b', '#e8222b', '#a3121d']],
  ['orange', 'Orange', ['#ffb15a', '#f57a12', '#b14c06']],
  ['yellow', 'Yellow', ['#fff27a', '#ffd21f', '#c99410']],
  ['green',  'Green',  ['#8fe36b', '#3fb43a', '#1f7a2a']],
  ['blue',   'Blue',   ['#6fb6ff', '#2a6fe0', '#1a3f9a']],
  ['purple', 'Purple', ['#c39bff', '#8a4fd9', '#55289a']],
  ['pink',   'Pink',   ['#ffb3da', '#ff6fb4', '#c73d84']],
  ['white',  'White',  ['#ffffff', '#e9eef2', '#b4bec8']],
  ['black',  'Black',  ['#5a5f6e', '#2f3240', '#16171f']],
];
const COLOR = Object.fromEntries(PALETTE.map(([k, n, c]) => [k, { name: n, c }]));
const WARM = new Set(['red', 'orange', 'pink']);
const GLASS = '#bfe6ff', GLASS2 = '#9fd2ef', CHROME = '#cfd6dd', TIRE = '#24262d', WELL = '#1b1c22';
const RED_ON = '#ff3b3b', RED_OFF = '#8c2a2a', BLUE_ON = '#3b8bff', BLUE_OFF = '#26407a';
const INK = '#22222a';
const SKIN = ['#f1c7a0', '#d9a273', '#a86b45', '#7a4a2e'];
const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = list => list[Math.random() * list.length | 0];
const ease = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/* ---------- vehicles (shared by every scene) ---------- */
const V = [
  { kind: 'police', name: 'Police car', len: 56, h: 29, color: 'blue' },
  { kind: 'fire',   name: 'Fire truck', len: 66, h: 38, color: 'red' },
  { kind: 'amb',    name: 'Ambulance',  len: 62, h: 36, color: 'white' },
];
const VI = { police: 0, fire: 1, amb: 2 };
try {
  const saved = JSON.parse(localStorage.getItem('firestation.colors') || 'null');
  if (Array.isArray(saved)) saved.forEach((k, i) => { if (V[i] && COLOR[k]) V[i].color = k; });
} catch (e) { /* storage unavailable */ }
function saveColors() {
  try { localStorage.setItem('firestation.colors', JSON.stringify(V.map(v => v.color))); } catch (e) {}
}
for (const v of V) Object.assign(v, { x: 0, y: 0, homeX: 0, state: 'parked', t: 0, speed: 0, lap: false, rot: 0, hop: 0, puff: 0, stopSiren: null, mission: null });

/* ---------- pixel helpers ---------- */
function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.floor(x), Math.floor(y), Math.round(w), Math.round(h)); }
function circle(cx, cy, r, c) {
  cx = Math.floor(cx); cy = Math.floor(cy); r = Math.round(r);
  g.fillStyle = c;
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy));
    g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}
function alpha(a, fn) { const p = g.globalAlpha; g.globalAlpha = p * a; fn(); g.globalAlpha = p; }
function glow(cx, cy, c, r = 5) { alpha(0.35, () => circle(cx, cy, r, c)); }
function wheel(cx, cy, r, rot) {
  circle(cx, cy, r, TIRE);
  circle(cx, cy, r - 2, '#a7b0ba');
  if (r >= 6) circle(cx, cy, r - 4, '#e3e7eb');
  const sx = Math.round(Math.cos(rot) * (r - 3)), sy = Math.round(Math.sin(rot) * (r - 3));
  R(cx + sx, cy + sy, 1, 1, '#4d5560');
  R(cx - sx, cy - sy, 1, 1, '#4d5560');
}

// 3x5 bitmap font, just the letters the signs need
const FONT = {
  A: '010101111101101', E: '111100110100111', F: '111100110100100', I: '111010010010111',
  N: '110101101101101', O: '010101101101010', R: '110101110101101', S: '011100010001110',
  T: '111010010010010', H: '101101111101101', P: '110101110100100', L: '100100100100111',
  G: '011100101101011', Z: '111001010100111', C: '011100100100011', '!': '010010010000010', ' ': '000000000000000',
};
function text(str, x, y, s, c) {
  [...str].forEach((ch, i) => {
    const bits = FONT[ch] || FONT[' '];
    for (let b = 0; b < 15; b++) if (bits[b] === '1') R(x + i * 4 * s + (b % 3) * s, y + Math.floor(b / 3) * s, s, s, c);
  });
}
const textWidth = (str, s) => str.length * 4 * s - s;

/* ---------- vehicle sprites (side view, facing right) ---------- */
function drawFire(x, yb, key, lit, ph, bob, rot) {
  const c = COLOR[key].c, y = yb - 38 + bob;
  const P = (dx, dy, w, h, col) => R(x + dx, y + dy, w, h, col);
  const stripe = key === 'white' ? '#e8222b' : '#f4f7fb';
  P(2, 29, 62, 3, '#2b2e36');                                   // chassis
  P(0, 12, 46, 18, c[1]); P(0, 12, 46, 1, c[0]); P(0, 28, 46, 2, c[2]); P(0, 17, 1, 4, '#c0302a');
  for (let i = 0; i < 3; i++) {                                  // equipment lockers
    const dx = 3 + i * 14;
    P(dx, 15, 12, 10, c[2]); P(dx + 1, 16, 10, 8, c[1]);
    P(dx + 1, 18, 10, 1, c[0]); P(dx + 1, 21, 10, 1, c[0]);
    P(dx + 8, 23, 2, 1, '#e9eef2');
  }
  P(0, 26, 64, 1, stripe);
  P(46, 8, 17, 22, c[1]); P(63, 11, 2, 19, c[1]);               // cab
  P(46, 8, 17, 1, c[0]); P(46, 28, 19, 2, c[2]);
  P(49, 10, 13, 1, c[2]); P(50, 11, 12, 7, GLASS); P(51, 12, 2, 2, '#ffffff'); P(62, 12, 1, 6, GLASS2);
  P(48, 19, 1, 9, c[2]); P(50, 21, 3, 1, '#e9eef2');
  P(3, 5, 40, 1, '#d5dce3'); P(3, 9, 40, 1, '#8b96a1');         // ladder
  for (let i = 0; i < 10; i++) P(4 + i * 4, 6, 1, 3, '#d5dce3');
  P(7, 10, 3, 2, '#6b7480'); P(36, 10, 3, 2, '#6b7480');
  P(61, 27, 5, 3, CHROME); P(64, 20, 1, 3, '#fff6b0');           // bumper, headlight
  P(47, 7, 14, 1, '#444a55');                                    // light bar
  P(48, 5, 5, 2, lit && ph === 0 ? RED_ON : RED_OFF);
  P(53, 5, 2, 2, lit ? '#ffffff' : '#bbbbbb');
  P(55, 5, 5, 2, lit && ph === 1 ? RED_ON : RED_OFF);
  if (lit) glow(x + (ph ? 57 : 50), y + 6, RED_ON);
  for (const wx of [12, 26, 53]) circle(x + wx, yb - 6 + bob, 7, WELL);
  for (const wx of [12, 26, 53]) wheel(x + wx, yb - 6, 6, rot);
}

function drawPolice(x, yb, key, lit, ph, bob, rot) {
  const c = COLOR[key].c, y = yb - 29 + bob;
  const P = (dx, dy, w, h, col) => R(x + dx, y + dy, w, h, col);
  const panel = key === 'white' ? '#2f3240' : '#f4f7fb';
  P(17, 6, 20, 1, c[0]); P(15, 7, 25, 7, c[1]); P(14, 9, 1, 5, c[1]); P(40, 9, 2, 5, c[1]);   // cabin
  P(16, 9, 1, 4, GLASS); P(17, 8, 9, 5, GLASS); P(28, 8, 10, 5, GLASS); P(38, 9, 1, 4, GLASS2);
  P(18, 9, 2, 1, '#ffffff'); P(26, 8, 2, 6, c[2]);
  P(1, 14, 54, 9, c[1]); P(0, 15, 56, 7, c[1]); P(1, 14, 54, 1, c[0]); P(0, 21, 56, 2, c[2]);  // body
  P(15, 15, 25, 6, panel); P(27, 15, 1, 6, c[2]);
  P(32, 17, 3, 1, '#ffd21f'); P(33, 16, 1, 3, '#ffd21f');      // badge
  P(55, 16, 1, 2, '#fff6b0'); P(0, 16, 1, 2, RED_ON);
  P(52, 21, 4, 2, CHROME); P(0, 21, 4, 2, CHROME);
  P(20, 3, 7, 2, lit && ph === 0 ? RED_ON : RED_OFF);             // light bar
  P(27, 3, 2, 2, '#dddddd');
  P(29, 3, 7, 2, lit && ph === 1 ? BLUE_ON : BLUE_OFF);
  P(19, 5, 18, 1, '#444a55');
  if (lit) glow(x + (ph ? 32 : 23), y + 4, ph ? BLUE_ON : RED_ON);
  for (const wx of [12, 44]) circle(x + wx, yb - 5 + bob, 6, WELL);
  for (const wx of [12, 44]) wheel(x + wx, yb - 5, 5, rot);
}

function drawAmb(x, yb, key, lit, ph, bob, rot) {
  const c = COLOR[key].c, y = yb - 36 + bob;
  const P = (dx, dy, w, h, col) => R(x + dx, y + dy, w, h, col);
  const warm = WARM.has(key);
  const stripe = warm ? '#f4f7fb' : '#e8222b', cross = warm ? '#ffffff' : '#e8222b';
  P(0, 6, 42, 24, c[1]); P(0, 6, 42, 1, c[0]); P(0, 28, 42, 2, c[2]); P(0, 15, 1, 5, '#c0302a');   // patient box
  P(42, 12, 16, 18, c[1]); P(58, 15, 3, 15, c[1]); P(42, 12, 16, 1, c[0]); P(42, 28, 19, 2, c[2]);  // cab
  P(45, 14, 11, 7, GLASS); P(46, 15, 2, 2, '#ffffff'); P(56, 15, 2, 6, GLASS2);
  P(44, 22, 1, 6, c[2]); P(47, 24, 3, 1, '#9aa3ad');
  P(3, 9, 1, 12, c[2]); P(5, 9, 5, 4, GLASS);
  P(0, 22, 61, 2, stripe);
  P(19, 9, 5, 12, cross); P(15, 13, 13, 4, cross);
  P(57, 27, 5, 3, CHROME); P(60, 19, 1, 3, '#fff6b0');
  P(1, 3, 6, 3, lit && ph === 0 ? RED_ON : RED_OFF);
  P(35, 3, 6, 3, lit && ph === 1 ? RED_ON : RED_OFF);
  P(46, 10, 8, 2, lit ? (ph ? '#ffffff' : RED_ON) : RED_OFF);
  if (lit) glow(x + (ph ? 38 : 4), y + 4, RED_ON);
  for (const wx of [12, 50]) circle(x + wx, yb - 6 + bob, 7, WELL);
  for (const wx of [12, 50]) wheel(x + wx, yb - 6, 6, rot);
}
const SPRITE = { fire: drawFire, police: drawPolice, amb: drawAmb };
// Draw vehicle i of V anywhere (missions use this so the painted color follows the truck).
// At night the engine adds headlight beams, taillights and light-bar glow on top of every
// vehicle drawn this way; pass dark=true for one that's hidden (e.g. behind a closed door).
let vDraws = [];
function drawV(i, x, yb, lit, bob = 0, rot = V[i].rot, dark = false) {
  SPRITE[V[i].kind](Math.floor(x), Math.floor(yb), V[i].color, lit, Math.floor(T * 7) % 2, bob, rot);
  if (!dark && g === worldG) vDraws.push({ i, x: Math.floor(x), yb: Math.floor(yb), lit, bob });
}
const VLIGHT = {
  fire:   { h: 38, head: [64, 20, 2, 3], tail: [0, 17, 1, 4], bar: [[50, 6, RED_ON, 0], [57, 6, RED_ON, 1], [53, 6, '#ffffff', 2]] },
  police: { h: 29, head: [55, 16, 1, 2], tail: [0, 16, 1, 2], bar: [[23, 4, RED_ON, 0], [32, 4, BLUE_ON, 1]] },
  amb:    { h: 36, head: [60, 19, 1, 3], tail: [0, 15, 1, 5], bar: [[4, 4, RED_ON, 0], [38, 4, RED_ON, 1], [50, 11, '#ffffff', 1]] },
};
function drawVehicleLights(d, k) {
  const spec = VLIGHT[V[d.i].kind], x = d.x, y = d.yb - spec.h + d.bob;
  const [hx, hy, hw, hh] = spec.head, [tx, ty, tw, th] = spec.tail;
  // headlight beam: a soft cone reaching forward
  const by = y + hy + hh / 2;
  for (let j = 0; j < 42; j++) {
    const half = 1 + j * 0.24;
    alpha(0.3 * k * (1 - j / 44), () => R(x + hx + hw + j, by - half, 1, half * 2, '#fff3b0'));
  }
  alpha(k, () => { R(x + hx, y + hy, hw, hh, '#fffbe6'); R(x + tx, y + ty, tw, th, '#ff4a3a'); });
  alpha(0.55 * k, () => { circle(x + hx + 1, by, 3, '#fff3b0'); circle(x + tx, y + ty + th / 2, 3, '#ff3b3b'); });
  if (d.lit) {
    const ph = Math.floor(T * 7) % 2;
    for (const [lx, ly, c, which] of spec.bar) {
      if (which !== 2 && which !== ph) continue;
      alpha(0.22 * k, () => circle(x + lx, y + ly, 8, c));
      alpha(0.5 * k, () => circle(x + lx, y + ly, 3, c));
    }
  }
}

/* ---------- people & animals ---------- */
const OUTFITS = {
  ff:    { shirt: '#d8b04f', shade: '#b8923a', pants: '#c9a24a', trim: '#e9f56b', shoes: INK, hat: 'helmet', hatC: '#e8222b' },
  cop:   { shirt: '#2a6fe0', shade: '#1f58b8', pants: '#1a2a5a', badge: '#ffd21f', belt: '#1d1a2b', shoes: INK, hat: 'cap', hatC: '#1a2a5a' },
  medic: { shirt: '#f4f7fb', shade: '#cfd8e2', pants: '#1a3f9a', cross: '#e8222b', shoes: INK },
  kid:   { shirt: '#ff6fb4', shade: '#e0559a', pants: '#2a6fe0', shoes: '#e8222b', child: true },
  kid2:  { shirt: '#3fb43a', shade: '#2f9a2c', pants: '#5a3a22', shoes: '#2f3240', hat: 'cap', hatC: '#f57a12', child: true },
  kid3:  { shirt: '#ffd21f', shade: '#e0b010', pants: '#8a4fd9', shoes: '#2f3240', child: true },
  gran:  { shirt: '#8a4fd9', shade: '#6f3cba', pants: '#55289a', shoes: '#5a3a22', hair: '#dfe3ea' },
  dad:   { shirt: '#f57a12', shade: '#d0630a', pants: '#2f3240', shoes: INK },
  mom:   { shirt: '#3fb4a8', shade: '#2f948a', pants: '#2f3240', shoes: '#a3121d', hair: '#a3471d' },
  chef:  { shirt: '#ffffff', shade: '#d5dde6', pants: '#2f3240', shoes: INK, hat: 'chef' },
};
// Height in pixels of a standing person of this type (adults 22, kids 19).
const personH = type => (OUTFITS[type] && OUTFITS[type].child ? 19 : 22);
// A person ~12 wide, standing with feet on yb; x is the center.
// p: { type, x, yb, dir (1 right / -1 left), pose: stand|sit|wave|cheer|slide|eat|carry, walk, skin, hair, seed, hop, mini }
// pose 'sit': yb is the seat surface; legs dangle about 8px below it.
function drawPerson(p) {
  if (p.mini) return drawPersonMini(p);
  const o = OUTFITS[p.type] || OUTFITS.kid;
  const pose = p.pose || 'stand', dir = p.dir || 1;
  const torsoH = o.child ? 5 : 7, legH = o.child ? 3 : 4, tY = 9, lY = tY + torsoH;
  const total = lY + legH + 2;
  const bx = Math.floor(p.x) - 6;
  const top = Math.floor(p.yb - (p.hop || 0)) - (pose === 'sit' ? lY : total);
  const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 12 - dx - w, top + dy, w, h, c);
  const skin = p.skin || SKIN[0], hair = o.hair || p.hair || '#5a3a22';
  const step = p.walk ? Math.floor(T * 8 + (p.seed || 0)) % 2 : 0;
  const ph = Math.floor(T * 5 + (p.seed || 0)) % 2;
  // legs
  if (pose === 'sit') {
    M(4, lY, 7, 2, o.pants); M(9, lY + 2, 2, legH + 1, o.pants); M(9, lY + legH + 3, 3, 2, o.shoes);
  } else if (pose === 'slide') {
    M(4, lY, 4, legH, o.pants); M(4, lY + legH, 4, 2, o.shoes);
  } else if (step) {
    M(2, lY, 3, legH, o.pants); M(7, lY, 3, legH, o.pants); M(1, lY + legH, 4, 2, o.shoes); M(7, lY + legH, 4, 2, o.shoes);
    if (o.trim) { M(2, lY + 1, 3, 1, o.trim); M(7, lY + 1, 3, 1, o.trim); }
  } else {
    M(3, lY, 3, legH, o.pants); M(6, lY, 3, legH, o.pants); M(2, lY + legH, 4, 2, o.shoes); M(6, lY + legH, 4, 2, o.shoes);
    if (o.trim) M(3, lY + 1, 6, 1, o.trim);
  }
  // back arm (behind the body)
  if (pose === 'cheer') { M(2, tY - 5 + (1 - ph), 2, 6, o.shade); M(2, tY - 7 + (1 - ph), 2, 2, skin); }
  else if (pose === 'slide') { M(3, tY - 6, 2, 7, o.shade); M(3, tY - 8, 2, 2, skin); }
  // body
  M(2, tY, 8, torsoH, o.shirt); M(2, tY, 2, torsoH, o.shade); M(5, tY, 3, 1, o.shade);
  if (o.trim) M(2, tY + torsoH - 2, 8, 1, o.trim);
  if (o.belt) M(2, tY + torsoH - 1, 8, 1, o.belt);
  if (o.badge) M(7, tY + 1, 2, 2, o.badge);
  if (o.cross) { M(7, tY + 1, 1, 3, o.cross); M(6, tY + 2, 3, 1, o.cross); }
  // head
  M(4, 1, 5, 1, skin); M(3, 2, 7, 6, skin); M(4, 8, 5, 1, skin);
  M(3, 4, 1, 2, '#d99a7a');
  M(6, 4, 1, 2, INK); M(8, 4, 1, 2, INK);
  M(9, 6, 1, 1, '#ff9c8a');
  M(6, 7, 3, 1, '#a3121d');
  if (o.hat === 'helmet') { M(2, 0, 8, 3, o.hatC); M(1, 3, 11, 1, o.hatC); M(8, 1, 2, 2, '#ffd21f'); M(4, 0, 2, 1, '#ff7a6b'); }
  else if (o.hat === 'cap') { M(3, 0, 7, 3, o.hatC); M(9, 2, 3, 1, o.hatC); M(5, 1, 2, 1, '#ffd21f'); }
  else if (o.hat === 'chef') { M(3, -3, 7, 4, '#ffffff'); M(3, 1, 7, 1, '#d5dde6'); }
  else { M(3, 0, 7, 2, hair); M(2, 1, 2, 5, hair); M(3, 2, 1, 2, hair); M(8, 1, 2, 1, hair); }
  // front arm
  if (pose === 'wave' || pose === 'cheer') { M(8, tY - 5 + ph, 2, 6, o.shirt); M(8, tY - 7 + ph, 2, 2, skin); }
  else if (pose === 'slide') { M(8, tY - 6, 2, 7, o.shirt); M(8, tY - 8, 2, 2, skin); }
  else if (pose === 'carry') { M(7, tY + 2, 4, 2, o.shirt); M(11, tY + 2, 1, 2, skin); }
  else if (pose === 'eat') {
    if (ph) { M(7, tY, 2, 3, o.shirt); M(8, 7, 2, 2, skin); } else { M(7, tY + 2, 4, 2, o.shirt); M(11, tY + 2, 1, 2, skin); }
  } else { M(6, tY + 1, 2, torsoH - 1, o.shade); M(6, tY + torsoH, 2, 2, skin); }
}
// Small distant person: 8 wide x 16 tall standing on (x, yb), x is the center.
// p: { type, x, yb, dir (1 right / -1 left), pose: stand|sit|wave|slide|eat|carry|cheer, walk, skin, hair, seed, hop }
function drawPersonMini(p) {
  const o = OUTFITS[p.type] || OUTFITS.kid;
  const pose = p.pose || 'stand', dir = p.dir || 1;
  const bx = Math.floor(p.x) - 4;
  let top = Math.floor(p.yb - (p.hop || 0)) - 16 + (pose === 'sit' ? 4 : 0);
  const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 8 - dx - w, top + dy, w, h, c);
  const skin = p.skin || SKIN[0], hair = o.hair || p.hair || '#5a3a22';
  const step = p.walk ? Math.floor(T * 8 + (p.seed || 0)) % 2 : 0;
  const ph = Math.floor(T * 5 + (p.seed || 0)) % 2;
  // legs and shoes
  if (pose === 'sit') {
    M(2, 11, 6, 2, o.pants); M(6, 13, 2, 2, o.pants); M(6, 15, 3, 1, o.shoes);
  } else if (pose === 'slide') {
    M(3, 12, 3, 3, o.pants); M(3, 15, 3, 1, o.shoes);
  } else if (step) {
    M(1, 12, 2, 3, o.pants); M(6, 12, 2, 3, o.pants); M(0, 15, 3, 1, o.shoes); M(6, 15, 3, 1, o.shoes);
  } else {
    M(2, 12, 2, 3, o.pants); M(5, 12, 2, 3, o.pants); M(2, 15, 3, 1, o.shoes); M(5, 15, 3, 1, o.shoes);
  }
  // body
  M(1, 7, 6, 5, o.shirt); M(1, 7, 1, 5, o.shade);
  if (o.trim) M(1, 10, 6, 1, o.trim);
  if (o.badge) M(5, 8, 1, 1, o.badge);
  if (o.cross) { M(4, 8, 1, 3, o.cross); M(3, 9, 3, 1, o.cross); }
  // head
  M(2, 2, 5, 5, skin);
  if (pose === 'sleep') { M(5, 4, 1, 1, INK); } else { M(5, 4, 1, 1, INK); }
  M(5, 6, 2, 1, '#a3121d');
  if (o.hat === 'helmet') { M(1, 0, 7, 2, o.hatC); M(0, 2, 9, 1, o.hatC); M(6, 1, 1, 1, '#ffd21f'); }
  else if (o.hat === 'cap') { M(2, 1, 5, 2, o.hatC); M(6, 2, 3, 1, o.hatC); M(4, 1, 1, 1, '#ffd21f'); }
  else { M(2, 1, 5, 2, hair); M(2, 2, 1, 3, hair); }
  // arms
  if (pose === 'wave' || pose === 'cheer') {
    M(5, ph ? 2 : 4, 2, 5, o.shirt); M(5, ph ? 1 : 3, 2, 1, skin);
    if (pose === 'cheer') { M(1, ph ? 4 : 2, 2, 5, o.shade); M(1, ph ? 3 : 1, 2, 1, skin); }
  } else if (pose === 'slide') {
    M(5, 3, 2, 5, o.shirt); M(5, 2, 2, 1, skin);
  } else if (pose === 'eat') {
    if (ph) { M(5, 6, 2, 2, o.shirt); M(6, 5, 1, 2, skin); } else { M(5, 8, 3, 2, o.shirt); M(8, 8, 1, 2, skin); }
  } else if (pose === 'carry') {
    M(5, 8, 3, 2, o.shirt); M(8, 8, 1, 2, skin);
  } else {
    M(4, 8, 2, 4, o.shade); M(4, 12, 2, 1, skin);
  }
}
// Mama duck (big) or duckling: 10x9 / 6x6, standing on (x, yb), facing dir.
function drawDuck(x, yb, big, dir = 1, step = 0) {
  const s = big ? 1 : 0.6, w = Math.round(10 * s), h = Math.round(9 * s);
  const bx = Math.floor(x) - (w >> 1), top = Math.floor(yb) - h;
  const M = (dx, dy, ww, hh, c) => R(dir > 0 ? bx + dx : bx + w - dx - ww, top + dy, ww, hh, c);
  const body = big ? '#f4f7fb' : '#ffd21f', shade = big ? '#cfd8e2' : '#e0b010';
  M(0, Math.round(4 * s), Math.round(8 * s), Math.round(4 * s), body); M(0, Math.round(6 * s), Math.round(3 * s), Math.round(2 * s), shade);
  M(Math.round(5 * s), 0, Math.round(4 * s), Math.round(4 * s), body);
  M(Math.round(7 * s), Math.round(1 * s), 1, 1, INK);
  M(Math.round(9 * s), Math.round(2 * s), Math.max(1, Math.round(2 * s)), 1, '#f57a12');
  M(Math.round(3 * s) + step, h - 1, 2, 1, '#f57a12');
}
function drawCat(x, yb, dir = 1, col = '#9aa3ad') {
  const bx = Math.floor(x) - 5, top = Math.floor(yb) - 8;
  const M = (dx, dy, w, h, c) => R(dir > 0 ? bx + dx : bx + 10 - dx - w, top + dy, w, h, c);
  M(0, 4, 7, 3, col); M(1, 7, 1, 1, col); M(5, 7, 1, 1, col);
  M(5, 1, 5, 4, col); M(5, 0, 1, 1, col); M(9, 0, 1, 1, col);
  M(8, 2, 1, 1, INK); M(9, 3, 1, 1, '#ff6fb4');
  M(0, 1 + (Math.floor(T * 3) % 2), 1, 4, col);
}
// Small family car facing right, 34 wide; body color from a ramp.
function drawCar(x, yb, c, rot = 0, bob = 0) {
  const y = Math.floor(yb) - 18 + bob, P = (dx, dy, w, h, col) => R(Math.floor(x) + dx, y + dy, w, h, col);
  P(8, 2, 16, 1, c[0]); P(6, 3, 20, 6, c[1]); P(8, 4, 7, 4, GLASS); P(17, 4, 7, 4, GLASS); P(15, 4, 2, 5, c[2]);
  P(1, 9, 32, 6, c[1]); P(0, 10, 34, 4, c[1]); P(1, 9, 32, 1, c[0]); P(0, 13, 34, 2, c[2]);
  P(33, 10, 1, 2, '#fff6b0'); P(0, 10, 1, 2, RED_ON);
  for (const wx of [8, 26]) { circle(Math.floor(x) + wx, Math.floor(yb) - 4 + bob, 5, WELL); wheel(Math.floor(x) + wx, Math.floor(yb) - 4, 4, rot); }
}
function drawTree(x, yb, r = 12, burnt = false) {
  const lean = Math.round(r * 0.3);
  R(x - 2, yb - r - 8, 5, r + 8, '#7a4a2a');
  circle(x, yb - r - 12, r, burnt ? '#6b4a2a' : '#3f9a45');
  circle(x - lean, yb - r - 15, Math.round(r * 0.55), burnt ? '#8a5a2a' : '#5bb85a');
}

/* ---------- fire ---------- */
function flame(cx, by, size, seed) {
  const h = Math.round(5 + size * 15), w = Math.round(5 + size * 9);
  for (let i = 0; i < w; i++) {
    const edge = 1 - Math.abs((i - (w - 1) / 2) / (w / 2));
    const fl = 0.7 + 0.3 * Math.sin(T * 14 + i * 1.3 + seed);
    const hh = Math.max(1, Math.round(h * edge * fl));
    const x = cx - (w >> 1) + i;
    R(x, by - hh, 1, hh, '#e8222b');
    const h2 = Math.round(hh * 0.7); if (h2) R(x, by - h2, 1, h2, '#f57a12');
    const h3 = Math.round(hh * 0.4); if (h3) R(x, by - h3, 1, h3, '#ffd21f');
  }
}

/* ---------- sound (all synthesized) ---------- */
let ac = null, master = null, voiceOut = null, noiseBuf = null;
function initAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}  // play even with the silent switch on
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.32;               // gentle on little ears
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    voiceOut = ac.createGain();             // voice skips the quiet master so it sits above the sirens
    voiceOut.gain.value = 0.9;
    voiceOut.connect(comp);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
}
function tone(type, freq, start, dur, vol, freqEnd) {
  if (!ac) return;
  const t = ac.currentTime + start;
  const o = ac.createOscillator(), gn = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn); gn.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(start, dur, vol, freq, q) {
  if (!ac) return;
  const t = ac.currentTime + start;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
  gn.gain.setValueAtTime(vol, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(gn); gn.connect(master);
  s.start(t); s.stop(t + dur + 0.05);
}
// A looping noise bed (spray, engine) whose level can be set each frame: returns set(level).
function noiseLoop(freq, q) {
  let gn = null;
  return level => {
    if (!ac) return;
    if (!gn) {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter();
      gn = ac.createGain(); gn.gain.value = 0;
      s.buffer = noiseBuf; s.loop = true;
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      s.connect(f); f.connect(gn); gn.connect(master); s.start();
    }
    gn.gain.setTargetAtTime(level, ac.currentTime, 0.05);
  };
}
function siren(kind) {
  if (!ac) return () => {};
  const t = ac.currentTime, MAX = 40;
  const o = ac.createOscillator(), f = ac.createBiquadFilter(), gn = ac.createGain();
  const extra = [];
  f.type = 'lowpass'; f.frequency.value = 2400;
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(0.16, t + 0.15);
  if (kind === 'fire') {               // horn blast, then a slow wail
    tone('square', 233, 0, 0.55, 0.12); tone('square', 277, 0, 0.55, 0.12);
    o.type = 'triangle';
    for (let k = 0; k < MAX / 2.4; k++) {
      o.frequency.setValueAtTime(520, t + k * 2.4);
      o.frequency.linearRampToValueAtTime(1150, t + k * 2.4 + 1.2);
      o.frequency.linearRampToValueAtTime(520, t + k * 2.4 + 2.4);
    }
  } else if (kind === 'police') {      // fast yelp
    o.type = 'triangle'; o.frequency.value = 1050;
    const lfo = ac.createOscillator(), depth = ac.createGain();
    lfo.type = 'triangle'; lfo.frequency.value = 4.5; depth.gain.value = 380;
    lfo.connect(depth); depth.connect(o.frequency);
    lfo.start(t); lfo.stop(t + MAX); extra.push(lfo);
  } else {                              // hi-lo
    o.type = 'triangle';
    for (let k = 0; k < MAX / 0.55; k++) o.frequency.setValueAtTime(k % 2 ? 770 : 960, t + k * 0.55);
  }
  o.connect(f); f.connect(gn); gn.connect(master);
  o.start(t); o.stop(t + MAX);
  let stopped = false;
  return () => {
    if (stopped) return; stopped = true;
    const n = ac.currentTime;
    gn.gain.cancelScheduledValues(n);
    gn.gain.setValueAtTime(gn.gain.value, n);
    gn.gain.exponentialRampToValueAtTime(0.0001, n + 0.4);
    o.stop(n + 0.45); extra.forEach(x => { try { x.stop(n + 0.45); } catch (e) {} });
  };
}
const SFX = {
  honk() { tone('square', 349, 0, 0.22, 0.12); tone('square', 440, 0, 0.22, 0.1); tone('square', 349, 0.28, 0.22, 0.12); tone('square', 440, 0.28, 0.22, 0.1); },
  beep() { tone('square', 523, 0, 0.12, 0.1); tone('square', 523, 0.16, 0.12, 0.1); },
  paint() { noise(0, 0.18, 0.25, 900, 0.8); [523, 659, 784, 1047].forEach((f, i) => tone('sine', f, 0.05 + i * 0.07, 0.25, 0.18)); },
  bell() { [0, 0.45, 0.9].forEach(s => { tone('sine', 1320, s, 1.2, 0.2); tone('sine', 2640, s, 0.6, 0.06); tone('sine', 3960, s, 0.3, 0.03); }); },
  chime() { [784, 1047, 1319].forEach((f, i) => tone('sine', f, i * 0.1, 0.6, 0.15)); },
  woof() { [0, 0.25].forEach(s => { tone('sawtooth', 320, s, 0.14, 0.18, 110); noise(s, 0.1, 0.12, 500, 1.5); }); },
  meow() { tone('sawtooth', 700, 0, 0.12, 0.06, 1100); tone('sawtooth', 1100, 0.12, 0.3, 0.06, 600); },
  quack() { [0, 0.18].forEach(s => { tone('sawtooth', 500, s, 0.1, 0.08, 300); noise(s, 0.08, 0.06, 900, 2); }); },
  peep() { tone('sine', 2400, 0, 0.06, 0.06, 2800); },
  boop(p = 1) { tone('sine', 520 * p, 0, 0.12, 0.18, 780 * p); },
  pop() { tone('sine', 900, 0, 0.08, 0.15, 300); },
  whoosh() { noise(0, 0.6, 0.18, 900, 0.5); },
  water() { noise(0, 1.6, 0.18, 1800, 0.6); },
  sizzle() { noise(0, 0.5, 0.25, 3200, 0.6); tone('sine', 1568, 0.05, 0.25, 0.12); },
  brake() { noise(0, 0.45, 0.22, 2600, 0.5); },
  door() { for (let i = 0; i < 10; i++) noise(i * 0.11, 0.08, 0.07, 400 + i * 30, 2); },
  hmm() { tone('sine', 392, 0, 0.25, 0.14); tone('sine', 330, 0.25, 0.4, 0.14); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, i * 0.13, 0.16, 0.09)); [523, 659, 784, 1047].forEach(f => tone('triangle', f, 0.6, 0.9, 0.12)); },
  chop() { for (let i = 0; i < 16; i++) noise(i * 0.08, 0.06, 0.3, 260, 1.2); },
  sunrise() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, i * 0.12, 0.5, 0.1)); },
  sunset() { [1047, 880, 784, 659, 523].forEach((f, i) => tone('triangle', f, i * 0.16, 0.6, 0.09)); },
  lullaby() {  // "Twinkle twinkle" on a soft music box
    const n = [523, 523, 784, 784, 880, 880, 784, 0, 698, 698, 659, 659, 587, 587, 523];
    n.forEach((f, i) => { if (f) { tone('sine', f, i * 0.42, 0.9, 0.12); tone('sine', f * 2, i * 0.42, 0.4, 0.03); } });
  },
};

/* ---------- voice (recorded clips in audio/) ---------- */
const LINES = {
  fire:   ['fire-truck', 'here-comes-the-fire-truck', 'fire-truck-to-the-rescue'],
  police: ['police-car', 'here-comes-the-police-car', 'police-car-on-duty'],
  amb:    ['ambulance', 'here-comes-the-ambulance', 'ambulance-on-the-way', 'ambulance-here-to-help'],
  wow:    ['ooh-pretty', 'now-thats-a-cool-color'],
  parked: ['all-parked', 'great-job', 'you-did-it'],
  praise: ['great-job', 'you-did-it'],
};
const CLIP_NAMES = [...new Set([...Object.values(LINES).flat(), ...PALETTE.map(p => p[0]), 'back-to-the-station', 'helicopter', 'lets-go'])];
const clipBytes = {}, clipBuf = {};
for (const n of CLIP_NAMES) {
  clipBytes[n] = fetch('audio/' + n + '.mp3').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
}
function clip(n) {
  if (!ac) return Promise.resolve(null);
  if (!clipBuf[n]) clipBuf[n] = (clipBytes[n] || Promise.resolve(null)).then(b => b && new Promise(res => {
    try { ac.decodeAudioData(b.slice(0), res, () => res(null)); } catch (e) { res(null); }
  }));
  return clipBuf[n];
}
const lastPick = {};
function pick(key) {   // random line, never the same one twice in a row
  const list = LINES[key];
  let n;
  do { n = list[Math.random() * list.length | 0]; } while (list.length > 1 && n === lastPick[key]);
  return (lastPick[key] = n);
}
let voiceSrc = null, voiceToken = 0, voiceUntil = 0;
function duck(dur) {   // dip the sirens while someone is talking
  const n = ac.currentTime, gm = master.gain;
  gm.cancelScheduledValues(n); gm.setValueAtTime(gm.value, n);
  gm.linearRampToValueAtTime(0.12, n + 0.08);
  gm.setValueAtTime(0.12, n + dur);
  gm.linearRampToValueAtTime(0.32, n + dur + 0.35);
}
// say('red') or say(['red', 'ooh-pretty']). A tap interrupts whatever is playing;
// polite lines (e.g. on parking) are skipped if someone is already talking.
function say(names, polite) {
  if (!ac || (polite && ac.currentTime < voiceUntil)) return;
  const token = ++voiceToken;
  if (voiceSrc) { try { voiceSrc.stop(); } catch (e) {} voiceSrc = null; }
  const list = [].concat(names);
  const next = i => {
    if (i >= list.length || token !== voiceToken) return;
    clip(list[i]).then(buf => {
      if (token !== voiceToken) return;
      if (!buf) return next(i + 1);
      const src = ac.createBufferSource();
      src.buffer = buf; src.connect(voiceOut); src.start();
      voiceSrc = src; voiceUntil = ac.currentTime + buf.duration;
      duck(buf.duration);
      src.onended = () => { if (voiceSrc === src) voiceSrc = null; next(i + 1); };
    });
  };
  next(0);
}

/* ---------- particles ---------- */
function spawn(n, fn) { for (let i = 0; i < n; i++) parts.push(fn(i)); }
function sparkle(cx, cy, spread = 16, n = 8, c = '#fff27a') {
  spawn(n, () => ({ x: cx + rand(-spread, spread), y: cy + rand(-spread, spread) * 0.7, vx: 0, vy: -12, g: 0, life: 0.7, max: 0.7, s: 1, c, star: true }));
}
function puff(cx, cy, n = 10, c = '#c9ccd3') {
  spawn(n, () => ({ x: cx + rand(-6, 6), y: cy + rand(-3, 3), vx: rand(-12, 12), vy: rand(-30, -12), g: 0, life: 1, max: 1, s: 3, c: Math.random() < 0.5 ? c : '#eef0f4' }));
}
function confetti(n = 3) {
  spawn(n, () => ({ x: Math.random() * W, y: -2, vx: rand(-15, 15), vy: rand(30, 70), g: 40, life: 2.5, max: 2.5, s: 2, c: PALETTE[Math.random() * 7 | 0][2][1] }));
}
function updateParticles(dt) {
  for (const p of parts) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  parts = parts.filter(p => p.life > 0);
}
function drawParticles() {
  for (const p of parts) {
    if (p.star) { if (p.life / p.max > 0.3) { R(p.x - 1, p.y, 3, 1, p.c); R(p.x, p.y - 1, 1, 3, p.c); } continue; }
    if (p.zzz) { alpha(Math.min(1, p.life / p.max * 2), () => text('Z', p.x, p.y, 1, p.c)); continue; }
    alpha(Math.min(1, p.life / p.max * 1.5), () => R(p.x, p.y, p.s, p.s, p.c));
  }
}
function zzz(x, y) { parts.push({ x, y, vx: 6, vy: -9, g: 0, life: 2.2, max: 2.2, c: '#ffffff', zzz: true }); }

/* ---------- sky: day/night on one invisible circle ---------- */
// The sun and moon sit 180° apart on a circle whose center is off-screen to the right.
// A tap turns the circle half a turn clockwise: the resting body exits through the top
// of the screen while the other one rises in from the right edge into the same spot.
const sky = { rot: 0, from: 0, to: 0, t: 1, dur: 2.2 };
const nightK = () => (1 - Math.cos(sky.rot)) / 2;
const isNight = () => Math.round(sky.to / Math.PI) % 2 === 1;
const skyBusy = () => sky.t < 1;
const onDayNight = [];   // scene hooks: fn(night)
function setNight(night) {
  if (night === isNight() || skyBusy()) return false;
  sky.from = sky.rot; sky.to = sky.rot + Math.PI; sky.t = 0;
  night ? SFX.sunset() : SFX.sunrise();
  onDayNight.forEach(fn => fn(night));
  return true;
}
function orbit(theta) { return [L.sunX + L.orbit + Math.cos(theta) * L.orbit, L.sunY + Math.sin(theta) * L.orbit]; }
function hitSky(x, y) { return !skyBusy() && (x - L.sunX) ** 2 + (y - L.sunY) ** 2 < 26 * 26; }
const DAY_SKY = ['#7ccdff', '#8fd6ff', '#a4deff', '#b9e7ff', '#cdeffd'];
const NIGHT_SKY = ['#0b0f30', '#111843', '#192254', '#232d66', '#2f3b78'];
let stars = [], clouds = [];
const heli = { x: -60, y: 20, hop: 0, boost: 0 };
function updateSky(dt) {
  if (sky.t < 1) { sky.t = Math.min(1, sky.t + dt / sky.dur); sky.rot = sky.from + (sky.to - sky.from) * ease(sky.t); }
  for (const c of clouds) { c.x += 4 * c.s * dt; if (c.x > W + 30) c.x = -40; }
  heli.hop = Math.max(0, heli.hop - dt); heli.boost = Math.max(0, heli.boost - dt);
  heli.x += (22 + heli.boost * 60) * dt;
  if (heli.x > W + 80) heli.x = -140;
}
function drawSky(groundY) {
  const k = nightK(), n = DAY_SKY.length, bh = Math.ceil((groundY + 12) / n);
  for (let i = 0; i < n; i++) R(0, i * bh, W, bh + 1, mix(DAY_SKY[i], NIGHT_SKY[i], k));
  if (k > 0.02) for (const s of stars) {
    alpha(k * (0.55 + 0.45 * Math.sin(T * 2 + s.p)), () => { R(s.x, s.y, 1, 1, '#ffffff'); if (s.big) { R(s.x - 1, s.y, 3, 1, '#ffffff'); R(s.x, s.y - 1, 1, 3, '#ffffff'); } });
  }
  drawSun(...orbit(Math.PI + sky.rot));
  drawMoon(...orbit(sky.rot));
  const cc = mix('#ffffff', '#5d6694', k), cs = mix('#dcebf5', '#454d7a', k);
  for (const c of clouds) {
    const r = Math.round(7 * c.s);
    circle(c.x, c.y + 2, r, cs); circle(c.x + r, c.y - 2, r + 2, cs); circle(c.x + 2 * r + 2, c.y + 2, r, cs);
    circle(c.x, c.y, r, cc); circle(c.x + r, c.y - 4, r + 2, cc); circle(c.x + 2 * r + 2, c.y, r, cc);
  }
}
function drawSun(sx, sy) {
  if (sy < -40 || sx > W + 40) return;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + T * 0.3;
    for (let d = 20; d < 25; d++) R(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 2, 2, '#ffd21f');
  }
  circle(sx, sy, 16, '#ffd21f'); circle(sx - 3, sy - 3, 11, '#ffe873');
  R(sx - 6, sy - 4, 2, 3, '#7a4a10'); R(sx + 4, sy - 4, 2, 3, '#7a4a10');
  R(sx - 6, sy + 5, 2, 1, '#7a4a10'); R(sx - 4, sy + 6, 8, 1, '#7a4a10'); R(sx + 4, sy + 5, 2, 1, '#7a4a10');
  R(sx - 10, sy + 2, 3, 2, '#ff9c6b'); R(sx + 7, sy + 2, 3, 2, '#ff9c6b');
}
function drawMoon(mx, my) {
  if (my < -40 || mx > W + 40) return;
  alpha(0.18, () => circle(mx, my, 21, '#fff6c8'));
  circle(mx, my, 15, '#f4efcf'); circle(mx + 3, my - 3, 11, '#fffbe6');
  circle(mx - 7, my + 5, 2, '#e2dcb4'); circle(mx + 6, my + 8, 1, '#e2dcb4'); circle(mx + 8, my - 6, 2, '#ece6c4');
  R(mx - 6, my - 2, 3, 1, '#8a7a4a'); R(mx + 3, my - 2, 3, 1, '#8a7a4a');                 // sleepy eyes
  R(mx - 2, my + 4, 4, 1, '#8a7a4a'); R(mx - 3, my + 3, 1, 1, '#8a7a4a'); R(mx + 2, my + 3, 1, 1, '#8a7a4a');
  R(mx - 9, my + 1, 3, 2, '#ffc2b0'); R(mx + 6, my + 1, 3, 2, '#ffc2b0');
}
function drawHeli() {
  const x = Math.floor(heli.x), y = Math.floor(heli.y - Math.sin(heli.hop * Math.PI) * 10 + Math.sin(T * 2) * 1.5);
  const c = COLOR.red.c, DK = '#3a3d46';
  const spin = Math.floor(T * 18) % 2;
  R(x + (spin ? 6 : 13), y, spin ? 34 : 20, 1, DK); R(x + 22, y + 1, 2, 3, DK);
  R(x, y + 3, 3, 6, c[1]); R(x, y + 7, 15, 3, c[1]); R(x + (spin ? -1 : 1), y + 4 + (spin ? 0 : 2), 1, 3, DK);
  R(x + 14, y + 4, 18, 10, c[1]); R(x + 12, y + 6, 22, 7, c[1]); R(x + 32, y + 7, 4, 5, c[1]);
  R(x + 14, y + 4, 18, 1, c[0]); R(x + 12, y + 12, 24, 1, c[2]);
  R(x + 26, y + 5, 8, 5, GLASS); R(x + 27, y + 6, 2, 1, '#ffffff');
  R(x + 12, y + 10, 24, 1, '#f4f7fb');
  R(x + 16, y + 13, 1, 4, DK); R(x + 29, y + 13, 1, 4, DK); R(x + 12, y + 17, 24, 1, DK);
  if (nightK() > 0.5 && Math.floor(T * 2) % 2) R(x + 1, y + 2, 2, 1, RED_ON);
}
function hitHeli(x, y) { return x >= heli.x - 4 && x < heli.x + 44 && y >= heli.y - 6 && y < heli.y + 24; }
function drawHills(hy, floorY) {
  circle(W * 0.12, hy + 34, 56, '#8fd877');
  circle(W * 0.88, hy + 40, 60, '#8fd877');
  circle(W * 0.5, hy + 60, 90, '#7ccd66');
  R(0, hy + 8, W, floorY - hy - 8, '#6cbf5a');
}
function drawRoad(roadY = L.roadY, roadH = L.roadH) {
  R(0, roadY, W, roadH, '#4b4f5c');
  R(0, roadY, W, 3, '#bdb8ac'); R(0, roadY + 3, W, 1, '#8f8b80');
  R(0, roadY + roadH - 3, W, 3, '#bdb8ac');
  for (let xx = 4; xx < W; xx += 20) R(xx, roadY + 22, 10, 2, '#ffd21f');
}
function drawStrip() {
  R(0, L.palY, W, H - L.palY, '#5aa84c');
  R(0, L.palY, W, 2, '#4a9440');
  for (let xx = 7; xx < W; xx += 23) { R(xx, L.palY + 5 + (xx % 3), 1, 2, '#7cc96a'); R(xx + 11, H - 4 - (xx % 2), 1, 2, '#7cc96a'); }
}

/* ---------- buttons ---------- */
function inBox(b, x, y, pad = 4) { return x >= b.x - pad && x < b.x + b.s + pad && y >= b.y - pad && y < b.y + b.s + pad; }
function button(b, bg, dark) {
  const { x, y, s } = b;
  R(x, y + 2, s, s, '#2f6b29');
  R(x + 2, y - 2, s - 4, s + 4, '#ffffff'); R(x - 2, y + 2, s + 4, s - 4, '#ffffff'); R(x, y, s, s, '#ffffff');
  R(x + 2, y, s - 4, s, bg); R(x, y + 2, s, s - 4, bg);
  R(x + 2, y + s - 3, s - 4, 3, dark);
}
function drawHomeButton(b = L.homeBtn) {
  button(b, '#2a6fe0', '#1a3f9a');
  const cx = b.x + b.s / 2, s = b.s;
  for (let k = 0; k < 6; k++) R(cx - 1 - k * 1.6, b.y + s * 0.22 + k * 1.6, 2 + k * 3.2, 2, '#e8222b');
  R(cx - s * 0.28, b.y + s * 0.5, s * 0.56, s * 0.3, '#fff6e0');
  R(cx - 2, b.y + s * 0.6, 4, s * 0.2, '#8a5a3a');
}
// Big pulsing "play again" button; icon(cx, cy, size) draws what's on it.
function drawAgainButton(b = L.againBtn, bg = '#e8222b', dark = '#a3121d', icon) {
  const p = Math.round(Math.sin(T * 5) * 1.5);
  const bb = { x: b.x - p, y: b.y - p, s: b.s + 2 * p };
  button(bb, bg, dark);
  if (icon) icon(bb.x + bb.s / 2, bb.y + bb.s / 2, bb.s);
  else drawArrowIcon(bb.x + bb.s / 2, bb.y + bb.s / 2, bb.s);
}
function drawArrowIcon(cx, cy, s) {
  const u = Math.max(2, Math.round(s / 12));
  R(cx - 4 * u, cy - u, 5 * u, 2 * u, '#ffffff');
  for (let k = 0; k < 4; k++) R(cx + u + k * u, cy - 4 * u + k * u, u, 8 * u - 2 * k * u, '#ffffff');
}
// Round icon button used for the mini-game launchers.
function roundButton(x, y, r, bg, pulse) {
  const p = pulse ? Math.round((Math.sin(T * 4) + 1) * 1.2) : 0;
  circle(x, y + 2, r + 2, '#2f6b29');
  circle(x, y, r + 2 + p, '#ffffff');
  circle(x, y, r, bg);
}

/* ---------- scenes ---------- */
// A scene is { layout(), enter(arg), leave(), update(dt), drawWorld(), drawLit(), drawUI(),
//   tap(x, y, id) -> handled?, move(x, y, id), release(id) }, all optional except drawWorld.
// drawWorld is darkened at night; drawLit (lights, flames, lit windows) and drawUI are not.
const SCENES = {};
let scene = 'station';
let wipe = null;          // pixel-blind transition between scenes
function goScene(name, arg) {
  if (wipe || !SCENES[name]) return;
  wipe = { t: 0, switched: false, fn: () => {
    if (SCENES[scene].leave) SCENES[scene].leave();
    parts = []; scene = name;
    resize();   // each scene can use its own zoom
    if (SCENES[name].enter) SCENES[name].enter(arg);
  } };
}
function drawWipe() {
  if (!wipe) return;
  const k = wipe.t < 0.35 ? wipe.t / 0.35 : 1 - (wipe.t - 0.35) / 0.35;
  for (let y = 0, i = 0; y < H; y += 8, i++) {
    const w = Math.ceil(W * Math.min(1, k * 1.15));
    R(i % 2 ? W - w : 0, y, w, 8, '#1d1a2b');
  }
}
// Send vehicle i out of the station; when it leaves the screen the mission scene starts.
let pendingMission = null;
function launchMission(i, sceneName) {
  const v = V[i];
  if (pendingMission || scene !== 'station' || wipe) return;
  pendingMission = sceneName; v.mission = sceneName;
  if (v.state === 'parked') { v.state = 'exit'; v.t = 0; v.speed = 0; v.lap = false; v.stopSiren = siren(v.kind); }
  else if (v.lap || v.state === 'enter') {   // already heading home: turn around and go
    if (!v.stopSiren) v.stopSiren = siren(v.kind);
    Object.assign(v, { state: 'drive', lap: false, y: L.laneY });
  }
}
// Missions call this to drive vehicle i back into the station.
function returnHome(i) { goScene('station', { returning: i }); }

/* ---------- layout ---------- */
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
  'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
document.body.appendChild(probe);
function resize() {
  dpr = window.devicePixelRatio || 1;
  const dw = Math.round(stage.clientWidth * dpr), dh = Math.round(stage.clientHeight * dpr);
  const cs = getComputedStyle(probe);
  const inset = k => (parseFloat(cs['padding' + k]) || 0) * dpr;
  const it = inset('Top'), ir = inset('Right'), ib = inset('Bottom'), il = inset('Left');
  const [vw, vh] = (SCENES[scene] && SCENES[scene].view) || [300, 250];   // smallest view the scene needs
  S = Math.max(1, Math.floor(Math.min((dw - il - ir) / vw, (dh - it - ib) / vh)));
  W = Math.ceil(dw / S); H = Math.ceil(dh / S);
  L.safeT = Math.ceil(it / S); L.safeR = Math.ceil(ir / S); L.safeB = Math.ceil(ib / S); L.safeL = Math.ceil(il / S);
  lo.width = worldCv.width = W; lo.height = worldCv.height = H;
  cv.width = W * S; cv.height = H * S;
  cv.style.width = (W * S / dpr) + 'px'; cv.style.height = (H * S / dpr) + 'px';
  layout();
}
function layout() {
  const uw = W - L.safeL - L.safeR;
  L.cx = L.safeL + uw / 2;
  L.blob = Math.max(22, Math.min(36, Math.floor((uw - 24) / 9) - 4));
  L.gap = Math.max(3, Math.min(8, Math.floor((uw - 9 * L.blob) / 12)));
  L.palH = L.blob + 14; L.palY = H - L.safeB - L.palH;
  L.roadH = 46; L.roadY = L.palY - L.roadH;
  L.floorY = L.roadY; L.laneY = L.roadY + L.roadH - 6;
  L.hillY = L.floorY - 30;
  L.homeBtn = { x: L.safeL + 8, y: L.palY + Math.floor((L.palH - L.blob) / 2), s: L.blob };
  const big = L.blob + 10;
  L.againBtn = { x: Math.floor(L.cx - big / 2), y: L.palY + Math.floor((L.palH - big) / 2), s: big };
  L.sunX = W - L.safeR - 40; L.sunY = L.safeT + 52; L.orbit = 150;
  const skyH = Math.max(60, L.floorY - 40);
  stars = Array.from({ length: Math.round(W * skyH / 900) }, () => ({ x: Math.random() * W | 0, y: Math.random() * skyH | 0, p: Math.random() * 6, big: Math.random() < 0.12 }));
  heli.y = L.safeT + 12;
  for (const s of Object.values(SCENES)) if (s.layout) s.layout();
}
function setClouds(top, bottom) {
  const span = Math.max(30, bottom - top), n = Math.max(3, Math.round(span / 60) + 2);
  clouds = Array.from({ length: n }, (_, i) => ({ x: Math.random() * W, y: top + (i / n) * span + Math.random() * 10, s: 0.7 + Math.random() * 0.6 }));
}

/* ---------- frame ---------- */
function update(dt) {
  T += dt;
  if (wipe) { wipe.t += dt; if (!wipe.switched && wipe.t >= 0.35) { wipe.switched = true; wipe.fn(); } if (wipe.t >= 0.7) wipe = null; }
  updateSky(dt);
  updateParticles(dt);
  const sc = SCENES[scene];
  if (sc.update) sc.update(dt);
}
function draw() {
  const sc = SCENES[scene];
  g = loG;
  drawSky(sc.groundY ? sc.groundY() : L.hillY);
  g = worldG;
  vDraws = [];
  worldG.clearRect(0, 0, W, H);
  sc.drawWorld();
  const k = nightK();
  if (k > 0.01) {   // darken only the pixels the world drew, leaving the night sky alone
    worldG.globalCompositeOperation = 'source-atop';
    worldG.globalAlpha = 0.42 * k; worldG.fillStyle = '#141c48'; worldG.fillRect(0, 0, W, H);
    worldG.globalAlpha = 1; worldG.globalCompositeOperation = 'source-over';
  }
  g = loG;
  loG.drawImage(worldCv, 0, 0);
  if (k > 0.02) for (const d of vDraws) drawVehicleLights(d, k);
  if (sc.drawLit) sc.drawLit();
  if (sc.drawUI) sc.drawUI();
  drawWipe();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lo, 0, 0, W * S, H * S);
}

/* ---------- input ---------- */
function toVirtual(e) {
  const rect = cv.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * dpr / S, y: (e.clientY - rect.top) * dpr / S };
}
cv.addEventListener('pointerdown', e => {
  if (!started) return;
  e.preventDefault();
  initAudio();
  if (wipe) return;
  const p = toVirtual(e), sc = SCENES[scene];
  if (hitSky(p.x, p.y)) { setNight(!isNight()); return; }
  if (sc.tap && sc.tap(p.x, p.y, e.pointerId)) return;
  if (hitHeli(p.x, p.y)) { heli.hop = 1; heli.boost = 1.2; SFX.chop(); say('helicopter'); }
});
cv.addEventListener('pointermove', e => {
  const sc = SCENES[scene];
  if (started && sc.move) { const p = toVirtual(e); sc.move(p.x, p.y, e.pointerId); }
});
['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, e => {
  const sc = SCENES[scene];
  if (sc.release) sc.release(e.pointerId);
}));
['gesturestart', 'dblclick', 'contextmenu'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
