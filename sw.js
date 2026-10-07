// Offline support: everything the game needs is cached on first visit.
// Bump VERSION whenever any file changes so devices pick up the update.
const VERSION = 'fire-station-v31';
const FILES = [
  './',
  './index.html',
  './js/core.js',
  './js/station.js',
  './js/fire.js',
  './js/help.js',
  './js/amb.js',
  './js/police.js',
  './js/wash.js',
  './js/stickers.js',
  './js/chopper.js',
  './js/movie_fire.js',
  './js/movie_police.js',
  './js/movie_amb.js',
  './js/book_art.js',
  './js/movie_book.js',
  './js/movie_dogs.js',
  './js/movies.js',
  './js/flyer.js',
  './js/drive.js',
  './js/main.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-512.png',
  './audio/dog-bark.mp3',
  './audio/dog-bark-2.mp3',
  './audio/bear-roar.mp3',
  './audio/splash.mp3',
  './audio/crunch.mp3',
  './audio/dogs-music.mp3',
  './audio/all-parked.mp3',
  './audio/ambulance-here-to-help.mp3',
  './audio/ambulance-on-the-way.mp3',
  './audio/ambulance.mp3',
  './audio/back-to-the-station.mp3',
  './audio/black.mp3',
  './audio/blue.mp3',
  './audio/fire-truck-to-the-rescue.mp3',
  './audio/fire-truck.mp3',
  './audio/great-job.mp3',
  './audio/green.mp3',
  './audio/helicopter.mp3',
  './audio/here-comes-the-ambulance.mp3',
  './audio/here-comes-the-fire-truck.mp3',
  './audio/here-comes-the-police-car.mp3',
  './audio/lets-go.mp3',
  './audio/now-thats-a-cool-color.mp3',
  './audio/ooh-pretty.mp3',
  './audio/orange.mp3',
  './audio/pink.mp3',
  './audio/police-car-on-duty.mp3',
  './audio/police-car.mp3',
  './audio/purple.mp3',
  './audio/red.mp3',
  './audio/white.mp3',
  './audio/yellow.mp3',
  './audio/you-did-it.mp3',
  './audio/movie-amb-01.mp3',
  './audio/movie-amb-02.mp3',
  './audio/movie-amb-03.mp3',
  './audio/movie-amb-04.mp3',
  './audio/movie-amb-05.mp3',
  './audio/movie-amb-06.mp3',
  './audio/movie-amb-07.mp3',
  './audio/movie-amb-08.mp3',
  './audio/movie-amb-09.mp3',
  './audio/movie-amb-10.mp3',
  './audio/movie-fire-01.mp3',
  './audio/movie-fire-02.mp3',
  './audio/movie-fire-03.mp3',
  './audio/movie-fire-04.mp3',
  './audio/movie-fire-05.mp3',
  './audio/movie-fire-06.mp3',
  './audio/movie-fire-07.mp3',
  './audio/movie-fire-08.mp3',
  './audio/movie-fire-09.mp3',
  './audio/movie-fire-10.mp3',
  './audio/movie-police-01.mp3',
  './audio/movie-police-02.mp3',
  './audio/movie-police-03.mp3',
  './audio/movie-police-04.mp3',
  './audio/movie-police-05.mp3',
  './audio/movie-police-06.mp3',
  './audio/movie-police-07.mp3',
  './audio/movie-police-08.mp3',
  './audio/movie-police-09.mp3',
  './audio/movie-police-10.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first so it works in airplane mode; refresh the cache in the background when online.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
