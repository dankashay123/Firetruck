// The family's pets, at the little size they appear in the background of every game:
// the silver tabby cat (green eyes, cream chest, a ringed tail wrapped round her paws),
// the red Vizsla and the white husky. A "troupe" lets them wander about a scene on their own,
// sit, nap, chase each other now and then, and answer a tap with a meow, a purr or a bark.
'use strict';
const PETS = (() => {
  const pen = BOOK.pen;
  const C = { B: '#aaa69e', B2: '#c4c0b6', S: '#55514a', S2: '#7a756c', CR: '#ece2cc', W: '#f6f2ea', EYE: '#a8d048', PINK: '#e8a0a0', EAR: '#e8b4b0' };

  /* ---------- the cat ---------- */
  // sitting, facing you, like her photo: about 11 wide and 16 tall, feet on (x, yb)
  function catSit(x, yb, o = {}) {
    x = Math.round(x); yb = Math.round(yb - (o.hop || 0));
    const P = (dx, dy, w, h, c) => R(x + dx, yb + dy, w, h, c), blink = o.blink;
    // the tail curls round in front of the paws, dark rings and a dark tip
    const sw = o.swish ? Math.floor(T * 3) % 2 : 0;
    P(-6 - sw, -2, 12 + sw, 2, C.B); for (const tx of [-4, -1, 2]) P(tx - sw, -2, 1, 2, C.S); P(-7 - sw, -2, 2, 2, C.S);
    // haunches and body
    P(-5, -7, 3, 5, C.B); P(3, -7, 3, 5, C.B); P(-4, -9, 9, 7, C.B);
    P(-2, -9, 5, 6, C.CR); P(-1, -9, 3, 1, C.W);
    P(-5, -6, 1, 1, C.S); P(5, -5, 1, 1, C.S); P(-4, -4, 1, 2, C.S); P(4, -3, 1, 2, C.S); P(-3, -8, 1, 2, C.S2); P(3, -8, 1, 2, C.S2);
    // front legs with stripes, white paws
    P(-2, -4, 2, 3, C.CR); P(1, -4, 2, 3, C.CR); P(-2, -3, 2, 1, C.S2); P(1, -3, 2, 1, C.S2);
    P(-2, -2, 2, 1, C.W); P(1, -2, 2, 1, C.W);
    // head: ears, striped forehead, green eyes, pink nose
    P(-4, -16, 2, 2, C.B); P(3, -16, 2, 2, C.B); P(-4, -17, 1, 1, C.B); P(4, -17, 1, 1, C.B); P(-3, -15, 1, 1, C.EAR); P(3, -15, 1, 1, C.EAR);
    P(-4, -14, 9, 5, C.B); P(-5, -12, 11, 2, C.B); P(-3, -10, 7, 1, C.B);
    P(-2, -14, 1, 1, C.S); P(0, -14, 1, 2, C.S); P(2, -14, 1, 1, C.S); P(-5, -11, 1, 1, C.S2); P(5, -11, 1, 1, C.S2);
    P(-1, -11, 3, 2, C.CR); P(0, -11, 1, 1, C.PINK);
    if (blink) { P(-3, -12, 2, 1, C.S); P(2, -12, 2, 1, C.S); }
    else { P(-3, -13, 2, 2, C.EYE); P(2, -13, 2, 2, C.EYE); P(-2, -13, 1, 2, '#2a2a22'); P(2, -13, 1, 2, '#2a2a22'); }
    if (o.meow) P(0, -9, 1, 1, '#8a3a3a');
  }
  // walking side-on, about 19 long
  function catWalk(x, yb, dir = 1, o = {}) {
    const P = pen(x, yb - (o.hop || 0), 19, dir), st = o.run ? Math.floor(T * 14) % 2 : o.walk ? Math.floor(T * 7) % 2 : 0;
    // tail held up in a curve
    P(1, -10, 2, 6, C.B); P(0, -12, 2, 3, C.B); P(1, -8, 2, 1, C.S); P(0, -11, 2, 1, C.S); P(0, -13, 2, 1, C.S);
    P(3 + st, -4, 1, 4, C.S2); P(11 - st, -4, 1, 4, C.S2);   // far legs
    P(3, -9, 11, 5, C.B); P(4, -5, 9, 1, C.CR);
    for (const sx of [5, 8, 11]) P(sx, -9, 1, 3, C.S);
    P(4 - st, -4, 1, 4, C.B); P(12 + st, -4, 1, 4, C.CR); P(4 - st, -1, 2, 1, C.W); P(12 + st, -1, 2, 1, C.W);
    P(13, -12, 5, 5, C.B); P(13, -14, 1, 2, C.B); P(16, -14, 1, 2, C.B); P(14, -13, 1, 1, C.EAR);
    P(14, -12, 1, 1, C.S); P(16, -11, 1, 1, C.EYE); P(17, -9, 2, 2, C.CR); P(18, -10, 1, 1, C.PINK);
    if (o.meow) P(17, -8, 2, 1, '#8a3a3a');
  }
  // curled up asleep, about 14 long and 7 tall
  function catSleep(x, yb, dir = 1) {
    const P = pen(x, yb, 14, dir), br = Math.floor(T * 1.2) % 2;
    P(1, -5 - br, 11, 5 + br, C.B); P(0, -4, 1, 3, C.B); P(2, -6 - br, 7, 1, C.B);
    for (const sx of [3, 6, 9]) P(sx, -5 - br, 1, 3, C.S);
    P(9, -6, 5, 4, C.B); P(9, -7, 1, 1, C.B); P(12, -7, 1, 1, C.B); P(10, -4, 2, 1, C.S); P(12, -4, 2, 1, C.CR); P(13, -4, 1, 1, C.PINK);
    P(1, -1, 12, 1, C.B); for (const tx of [3, 6, 9]) P(tx, -1, 1, 1, C.S); P(12, -1, 2, 1, C.S);   // tail wrapped round
  }

  /* ---------- the dogs, lying down (the standing ones come from the ice cream park) ---------- */
  function vizslaLie(x, yb, dir = 1, o = {}) {
    const P = pen(x, yb, 22, dir), V1 = '#b4542a', V3 = '#8a3a1a', EAR = '#94401e';
    P(0, -4 + (o.wag ? Math.floor(T * 8) % 2 : 0), 4, 1, V1);
    P(3, -6, 12, 5, V1); P(3, -2, 12, 1, V3); P(4, -6, 9, 1, '#cf7040');
    P(13, -2, 8, 2, V1); P(19, -1, 3, 1, V3);
    P(14, -8, 5, 4, V1); P(18, -7, 4, 3, V1); P(21, -6, 1, 1, '#b86f62'); P(14, -7, 2, 4, EAR);
    if (o.sleep) P(17, -6, 2, 1, '#5a2a10'); else P(17, -7, 1, 1, '#22222a');
  }
  function huskyLie(x, yb, dir = 1, o = {}) {
    const P = pen(x, yb, 22, dir), H1 = '#f6f6f2', H3 = '#cfd4de', OL = '#9aa2b2';
    P(1, -9, 4, 4, H1); P(0, -8, 2, 3, H1); P(2, -6, 3, 1, H3);   // the curled tail over the back
    P(3, -7, 12, 6, H1); P(3, -7, 12, 1, OL); P(4, -2, 10, 1, H3);
    P(13, -2, 8, 2, H1); P(19, -1, 3, 1, OL);
    P(14, -9, 5, 5, H1); P(18, -7, 4, 3, H1); P(21, -6, 1, 1, '#22222a');
    P(14, -11, 1, 2, H1); P(16, -11, 1, 2, H1); P(14, -12, 1, 1, OL); P(16, -12, 1, 1, OL); P(16, -10, 1, 1, '#f2a8a0');
    if (o.sleep) P(17, -8, 2, 1, OL); else P(17, -8, 1, 1, '#6aaee8');
    if (o.pant && !o.sleep) P(20, -4, 1, 2, '#e8708a');
  }
  const dogStand = (who, x, yb, dir, o) => { const D = SCENES.icecream && SCENES.icecream._dogs; if (D) D[who](x, yb, dir, o); };

  /* ---------- sounds ---------- */
  const SND = TOY.bank({ meow: ['cat-meow', 0.55], meow2: ['cat-meow2', 0.5], purr: ['cat-purr', 0.6], bark: ['dog-bark', 0.6], bark2: ['dog-bark-2', 0.55] }, {
    meow() { SFX.meow(); }, meow2() { SFX.meow(); }, purr() { for (let i = 0; i < 10; i++) noise(i * 0.12, 0.1, 0.03, 120, 2); },
    bark() { SFX.woof(); }, bark2() { SFX.woof(); },
  });

  /* ---------- a troupe: the pets living in one spot of one scene ---------- */
  const troupes = {};
  // opts: { y: ground, x0, x1: where they may wander, who: [names], k: integer size,
  //         spots: { cat: { x, y, pose: 'sleep' | 'sit' } } pets that stay put }
  function troupe(id, opts) {
    let tr = troupes[id];
    if (!tr) {
      tr = troupes[id] = { last: T, pets: (opts.who || ['cat', 'vizsla', 'husky']).map((who, i) => ({ who, x: opts.x0 + (opts.x1 - opts.x0) * (0.2 + 0.3 * i), dir: i % 2 ? -1 : 1, state: 'idle', t: 1 + i, hop: 0, react: 0, tx: 0 })), hearts: [], m: null };
      SND.load();
    }
    return tr;
  }
  function think(p, o) {
    const r = Math.random(), spot = o.spots && o.spots[p.who];
    if (spot) { p.state = spot.pose === 'sleep' ? 'sleep' : 'idle'; p.t = 4; return; }
    if (p.who === 'cat' && r < 0.3) { p.state = 'sleep'; p.t = rand(8, 16); return; }
    if (p.who !== 'cat' && r < 0.12) { p.state = 'sleep'; p.t = rand(6, 12); return; }
    if (r < 0.55) { p.state = 'walk'; p.tx = rand(o.x0, o.x1); p.t = 12; return; }
    if (p.who !== 'cat' && r < 0.68) { p.state = 'run'; p.tx = rand(o.x0, o.x1); p.t = 6; return; }
    p.state = 'idle'; p.t = rand(2.5, 6);
  }
  function step(tr, o, dt) {
    for (const p of tr.pets) {
      p.hop = Math.max(0, p.hop - dt * 24); p.react = Math.max(0, p.react - dt);
      if ((p.t -= dt) <= 0) think(p, o);
      if (p.state === 'walk' || p.state === 'run') {
        const sp = p.state === 'run' ? 40 : p.who === 'cat' ? 12 : 16, d = p.tx - p.x;
        p.dir = d >= 0 ? 1 : -1; p.x += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
        if (Math.abs(d) < 0.5) { p.state = 'idle'; p.t = rand(2, 5); }
      }
      p.x = Math.max(o.x0, Math.min(o.x1, p.x));
    }
    for (const h of tr.hearts) { h.life -= dt; h.y -= 14 * dt; }
    tr.hearts = tr.hearts.filter(h => h.life > 0);
  }
  function drawPet(p, x, y, o) {
    const sleeping = p.state === 'sleep';
    if (p.who === 'cat') {
      if (sleeping) catSleep(x, y, p.dir);
      else if (p.state === 'walk') catWalk(x, y, p.dir, { walk: true, hop: p.hop, meow: p.react > 0 });
      else catSit(x, y, { hop: p.hop, meow: p.react > 0, swish: true, blink: Math.floor(T * 0.7 + p.x) % 5 === 0 });
    } else if (sleeping) (p.who === 'husky' ? huskyLie : vizslaLie)(x, y, p.dir, { sleep: true });
    else if (p.state === 'idle' && p.react <= 0 && (p.who === 'husky' ? Math.floor(T * 0.2 + p.x) % 3 === 0 : Math.floor(T * 0.25 + p.x) % 4 === 0)) (p.who === 'husky' ? huskyLie : vizslaLie)(x, y, p.dir, { pant: true, wag: true });
    else dogStand(p.who, x, y - (p.who === 'husky' ? 1 : 0), p.dir, { run: p.state !== 'idle', hop: p.hop, wag: true, bark: p.react > 0, pant: p.who === 'husky' && p.react <= 0 });
    if (sleeping && Math.floor(T * 1.3 + p.x) % 3 === 0) { const zx = Math.round(x + p.dir * 6), zy = Math.round(y - 12 - (T * 4 % 4)); R(zx, zy, 3, 1, '#ffffff'); R(zx + 1, zy + 1, 1, 1, '#ffffff'); R(zx, zy + 2, 3, 1, '#ffffff'); }
  }
  // Draw (and quietly animate) a scene's pets, using whatever transform the canvas has now.
  function draw(id, o) {
    const tr = troupe(id, o), dt = Math.min(0.1, Math.max(0, T - tr.last));
    tr.last = T; tr.o = o;
    step(tr, o, dt);
    const k = o.k || 1;
    g.save(); if (k !== 1) { g.translate(0, o.y); g.scale(k, k); g.translate(0, -o.y / k); }
    tr.m = g.getTransform();
    const list = tr.pets.slice().sort((a, b) => a.who === 'cat' ? 1 : b.who === 'cat' ? -1 : 0);
    for (const p of list) {
      const spot = o.spots && o.spots[p.who];
      const x = spot ? spot.x : p.x / k, y = spot && spot.y != null ? spot.y : o.y / k;
      if (spot && spot.pose === 'sleep' && p.react <= 0) p.state = 'sleep';
      p.sx = x; p.sy = y;
      drawPet(p, x, y, o);
    }
    for (const h of tr.hearts) alpha(Math.min(1, h.life * 2), () => { const x = Math.round(h.x), y = Math.round(h.y); R(x - 2, y, 2, 2, '#e8222b'); R(x + 1, y, 2, 2, '#e8222b'); R(x - 2, y + 1, 5, 2, '#e8222b'); R(x - 1, y + 3, 3, 1, '#e8222b'); R(x, y + 4, 1, 1, '#e8222b'); });
    g.restore();
  }
  // A tap at screen (x, y): returns true if it landed on one of this scene's pets.
  function tap(id, x, y) {
    const tr = troupes[id];
    if (!tr || !tr.m || T - tr.last > 0.5) return false;
    const m = tr.m, lx = (x - m.e) / m.a, ly = (y - m.f) / m.d;   // back into the pets' own coordinates
    for (const p of tr.pets) {
      if (p.sx == null) continue;
      const w = p.who === 'cat' ? 8 : 12, h = p.who === 'cat' ? 18 : 16;
      if (Math.abs(lx - p.sx - (p.who === 'cat' || p.state === 'sleep' ? 0 : p.dir * 2)) < w && ly > p.sy - h && ly < p.sy + 3) {
        poke(tr, p); return true;
      }
    }
    return false;
  }
  function poke(tr, p) {
    p.hop = 4; p.react = 0.6;
    if (p.who === 'cat') {
      if (p.state === 'sleep') { SND.play('purr'); p.react = 0; p.hop = 0; }
      else SND.play(Math.random() < 0.6 ? 'meow' : 'meow2', 0.95 + Math.random() * 0.15);
    } else {
      if (p.state === 'sleep') { p.state = 'idle'; p.t = 3; }
      SND.play(p.who === 'husky' ? 'bark2' : 'bark', p.who === 'husky' ? 1.1 : 1);
    }
    tr.hearts.push({ x: p.sx, y: p.sy - 18, life: 1.3 });
  }

  return { _troupes: troupes, catSit, catWalk, catSleep, vizslaLie, huskyLie, draw, tap, troupe, SND, poke: (id, who) => { const tr = troupes[id]; const p = tr && tr.pets.find(q => q.who === who); if (p) poke(tr, p); } };
})();
