// Boot: start button, wake lock, offline cache, main loop.
'use strict';

let wakeLock = null;
async function keepAwake() {
  try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) {}
}
document.getElementById('play').addEventListener('click', () => {
  initAudio();
  started = true;
  watchInsets();
  document.getElementById('start').hidden = true;
  say('lets-go');
  keepAwake();
  // Developer shortcut: index.html#fire (or #help, #amb, #police) jumps straight into a scene.
  const jump = location.hash.slice(1);
  if (jump && SCENES[jump] && jump !== 'station') goScene(jump);
});
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend(); else { ac.resume(); if (started) keepAwake(); }
});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});   // offline play; not available in every viewer
}

fitStage();
new ResizeObserver(resize).observe(stage);
resize();
setInterval(watchInsets, 500);
['orientationchange', 'resize', 'pageshow'].forEach(t => window.addEventListener(t, () => { fitStage(); setTimeout(watchInsets, 60); }));
let last = performance.now();
function frame(now) {
  update(Math.min(0.05, (now - last) / 1000));
  last = now;
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Home-screen icon helper: the fire truck on its road, as an n×n PNG data URL.
window.__renderIcon = n => {
  const c = document.createElement('canvas'); c.width = c.height = 80;
  const prev = g; g = c.getContext('2d');
  R(0, 0, 80, 80, '#8fd6ff'); R(0, 56, 80, 24, '#4b4f5c'); R(0, 56, 80, 3, '#bdb8ac');
  for (let x = 2; x < 80; x += 16) R(x, 70, 8, 2, '#ffd21f');
  drawFire(7, 64, 'red', false, 0, 0, 0.6);
  g = prev;
  const out = document.createElement('canvas'); out.width = out.height = n;
  const o = out.getContext('2d'); o.imageSmoothingEnabled = false; o.drawImage(c, 0, 0, n, n);
  return out.toDataURL('image/png');
};
