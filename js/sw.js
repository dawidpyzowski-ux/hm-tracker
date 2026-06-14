
var CACHE_VER = 'hm-v17';
var ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/sprint7-styles.css',
  './js/db.js',
  './js/data.js',
  './js/storage.js',
  './js/strava.js',
  './js/weather.js',
  './js/training-load.js',
  './js/predictor.js',
  './js/shoes.js',
  './js/strength.js',
  './js/charts.js',
  './js/activity-detail.js',
  './js/pr.js',
  './js/weekly-summary.js',
  './js/notifications.js',
  './js/race-pacer.js',
  './js/analytics.js',
  './js/training-score.js',
  './js/app.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VER).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_VER; })
             .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});
