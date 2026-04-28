const CACHE_NAME = 'sistema-vida-v55';
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

// Allow pages to tell the waiting SW to skip waiting and take control immediately
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Push Notifications ────────────────────────────────────────────────────────
// Recebe mensagens push do servidor (requer backend + VAPID keys para funcionar).
// Para notificações locais sem backend, o app usa registration.showNotification()
// diretamente a partir do contexto da página.
self.addEventListener('push', (event) => {
    let data = { title: 'Life OS', body: 'Nova notificação.' };
    try {
        if (event.data) data = event.data.json();
    } catch (_) {
        if (event.data) data.body = event.data.text();
    }
    const options = {
        body: data.body || '',
        icon: './icons/icon-192.png',
        badge: './icons/icon-96.png',
        tag: data.tag || 'lifeos-push',
        data: { url: data.url || './' },
        requireInteraction: false
    };
    event.waitUntil(
        self.registration.showNotification(data.title || 'Life OS', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
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
                return caches.match(event.request);
            })
    );
});
