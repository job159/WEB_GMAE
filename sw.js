/* Service Worker — 離線快取(network-first,確保新版自動上線) */
const CACHE = 'survival-outpost-v8';
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
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// network-first:每次先抓網路最新版,失敗才用快取;成功則更新快取
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req))
  );
});
