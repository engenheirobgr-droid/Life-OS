const CACHE_NAME = 'sistema-vida-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './views/hoje.html',
    './views/planos.html',
    './views/proposito.html',
    './views/perfil.html',
    './views/painel.html',
    './views/foco.html',
    './views/onboarding.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => {
            console.log('[Service Worker] Caching App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
        .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
        .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    // Optional: Only cache requests for our own origin to avoid external API mismatches
    if (!event.request.url.startsWith(self.location.origin)) return;

    // Network First Strategy
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed, fallback to cache
                return caches.match(event.request);
            })
    );
});
