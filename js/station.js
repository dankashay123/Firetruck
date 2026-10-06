// The fire station (temporary minimal version: vehicles + mission launchers).
'use strict';
(() => {
  const st = {};
  SCENES.station = {
    layout() {
      st.bays = [0, 1, 2].map(i => Math.floor(L.cx - 128) + i * 86);
      V.forEach((v, i) => { v.homeX = st.bays[i] + Math.floor((80 - v.len) / 2); if (v.stopSiren) v.stopSiren(); Object.assign(v, { x: v.homeX, y: L.floorY - 1, state: 'parked', stopSiren: null, mission: null }); });
      pendingMission = null;
      st.btns = [['fire', '#e8222b'], ['amb', '#f4f7fb'], ['police', '#2a6fe0'], ['help', '#3fb43a']].map(([n, c], i) => ({ n, c, x: L.safeL + 22 + i * 34, y: L.safeT + 26, r: 14 }));
    },
    enter(arg) {
      if (arg && arg.returning != null) { const v = V[arg.returning]; if (v.stopSiren) v.stopSiren(); Object.assign(v, { state: 'drive', lap: true, mission: null, x: -v.len - 8, y: L.laneY, speed: 120, stopSiren: null }); }
      pendingMission = null;
    },
    update(dt) {
      for (const v of V) {
        const x0 = v.x;
        if (v.state === 'exit') { v.t += dt; const k = Math.min(1, v.t / 0.6); v.y = L.floorY - 1 + (L.laneY - L.floorY + 1) * ease(k); if (k >= 1) v.state = 'drive'; }
        else if (v.state === 'drive') {
          v.speed = Math.min(150, v.speed + 260 * dt); v.x += v.speed * dt;
          if (!v.lap && v.x > W + 8) { if (v.mission) { const m = v.mission; v.mission = null; v.state = 'away'; v.x = W + 200; goScene(m); continue; } v.x = -v.len - 8; v.lap = true; }
          if (v.lap && v.x >= v.homeX - 45) v.state = 'arrive';
        } else if (v.state === 'arrive') { v.x = Math.min(v.homeX, v.x + Math.max(18, (v.homeX - v.x) * 3) * dt); if (v.x >= v.homeX) { v.state = 'enter'; v.t = 0; } }
        else if (v.state === 'enter') { v.t += dt; const k = Math.min(1, v.t / 0.6); v.y = L.laneY + (L.floorY - 1 - L.laneY) * ease(k); if (k >= 1) { v.state = 'parked'; if (v.stopSiren) v.stopSiren(); v.stopSiren = null; } }
        v.rot += (v.x - x0) / 5;
      }
    },
    drawWorld() {
      drawHeli(); drawHills(L.hillY, L.floorY); drawRoad();
      for (const v of V) drawV(VI[v.kind], v.x, v.y, v.state !== 'parked');
    },
    drawUI() {
      drawStrip();
      for (const b of st.btns) { roundButton(b.x, b.y, b.r, b.c); text(b.n[0].toUpperCase(), b.x - 1, b.y - 2, 1, '#1d1a2b'); }
    },
    tap(x, y) {
      for (const b of st.btns) if ((x - b.x) ** 2 + (y - b.y) ** 2 < (b.r + 5) ** 2) {
        if (b.n === 'help') goScene('help'); else launchMission(VI[b.n], b.n);
        return true;
      }
      return false;
    },
  };
})();
