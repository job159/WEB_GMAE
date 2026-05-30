/* Service Worker — 離線快取 */
const CACHE = 'survival-outpost-v3';
const FILES = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './js/utils.js', './js/audio.js', './js/particle.js', './js/collision.js',
  './js/input.js', './js/prng.js', './js/stats.js', './js/charClass.js',
  './js/card.js', './js/achievement.js', './js/save.js', './js/weapon.js',
  './js/skill.js', './js/projectile.js', './js/resource.js', './js/building.js',
  './js/enemy.js', './js/boss.js', './js/wave.js', './js/player.js',
  './js/shop.js', './js/touch.js', './js/ui.js', './js/game.js', './js/main.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
