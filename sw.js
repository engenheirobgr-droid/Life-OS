const CACHE_NAME = 'sistema-vida-v282';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js?v=20260527-onboarding-mobile-title-v2',
    './js/habitSuggestions.js?v=20260518-exec-flow-v1',
    './js/subjectiveScales.js?v=20260516-wellbeing-prompts-v205',
    './js/notifications.js?v=20260518-exec-flow-v1',
    './js/cadence.js?v=20260523-purpose-legacy-cleanup-v1',
    './js/onboarding.js?v=20260523-sprint2-onboarding-v1',
    './js/identity.js?v=20260526-rollback-align-v1',
    './js/habits.js?v=20260520-habit-card-v1',
    './js/protocols.js?v=20260519-execution-capacity-v9',
    './js/habitFocus.js?v=20260526-rollback-align-v1',
    './js/state.js?v=20260526-rollback-align-v1',
    './js/render.js?v=20260526-rollback-align-v1',
    './js/planning.js?v=20260526-rollback-align-v1',
    './js/gamification.js?v=20260516-wellbeing-prompts-v205',
    './js/social.js?v=20260516-wellbeing-prompts-v205',
    './views/hoje.html?v=20260526-rollback-align-v1',
    './views/planos.html?v=20260526-rollback-align-v1',
    './views/proposito.html?v=20260526-rollback-align-v1',
    './views/perfil.html?v=20260526-rollback-align-v1',
    './views/painel.html?v=20260526-rollback-align-v1',
    './views/foco.html?v=20260526-rollback-align-v1',
    './views/onboarding.html?v=20260527-onboarding-mobile-title-v2',
    './views/social.html?v=20260526-rollback-align-v1'
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
    let data = { title: 'Life OS', body: 'Nova notificação.' };
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
    const url = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';
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




