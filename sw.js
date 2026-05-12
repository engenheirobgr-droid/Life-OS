const CACHE_NAME = 'sistema-vida-v193';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.jsv=20260512-guided-routine-v193',
    './js/habitSuggestions.jsv=20260512-guided-routine-v193',
    './js/subjectiveScales.jsv=20260512-guided-routine-v193',
    './js/notifications.jsv=20260512-guided-routine-v193',
    './js/cadence.jsv=20260512-guided-routine-v193',
    './js/onboarding.jsv=20260512-guided-routine-v193',
    './js/identity.jsv=20260512-guided-routine-v193',
    './js/habits.jsv=20260512-guided-routine-v193',
    './js/state.jsv=20260512-guided-routine-v193',
    './js/render.jsv=20260512-guided-routine-v193',
    './js/planning.jsv=20260512-guided-routine-v193',
    './js/gamification.jsv=20260512-guided-routine-v193',
    './js/social.jsv=20260512-guided-routine-v193',
    './views/hoje.htmlv=20260512-guided-routine-v193',
    './views/planos.htmlv=20260512-guided-routine-v193',
    './views/proposito.htmlv=20260512-guided-routine-v193',
    './views/perfil.htmlv=20260512-guided-routine-v193',
    './views/painel.htmlv=20260512-guided-routine-v193',
    './views/foco.htmlv=20260512-guided-routine-v193',
    './views/onboarding.htmlv=20260512-guided-routine-v193',
    './views/social.htmlv=20260512-guided-routine-v193'
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

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('push', (event) => {
    let data = { title: 'Life OS', body: 'Nova notificacao.' };
    try {
        if (event.data) data = event.data.json();
    } catch (_) {
        if (event.data) data.body = event.data.text();
    }
    const options = {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag || 'lifeos-push',
        data: { url: data.url || '/' },
        requireInteraction: false
    };
    event.waitUntil(
        self.registration.showNotification(data.title || 'Life OS', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url)  event.notification.data.url : '/';
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
    if (!event.request.url.startsWith(self.location.origin)) return;

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
            .catch(() => caches.match(event.request))
    );
});


