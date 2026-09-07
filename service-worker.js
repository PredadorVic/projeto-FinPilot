'use strict';

// Cache "network-first": online, sempre busca a versão mais nova (e atualiza
// o cache); offline, cai pro que já foi salvo. Isso evita o problema clássico
// de PWA de "editei o arquivo e o app continua mostrando a versão antiga".
const CACHE_NAME = 'finpilot-shell-v5-1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/store.js',
  './js/state.js',
  './js/ui.js',
  './js/utils.js',
  './js/ai.js',
  './js/recurrence.js',
  './js/calculations.js',
  './js/simulators.js',
  './js/charts.js',
  './js/views/home.js',
  './js/views/income.js',
  './js/views/finances.js',
  './js/views/goals.js',
  './js/views/cards.js',
  './js/views/simuladores.js',
  './js/views/analysis.js',
  './js/views/assistant.js',
  './js/actions/index.js',
  './js/actions/accounts.js',
  './js/actions/income.js',
  './js/actions/expenses.js',
  './js/actions/goals.js',
  './js/actions/cards.js',
  './js/actions/settings.js',
  './js/actions/data.js',
  './js/actions/assistant.js',
  './js/actions/simuladores.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
  );
});
