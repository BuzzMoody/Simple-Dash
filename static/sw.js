const CACHE_NAME = 'simple-dash-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/style.css',
    '/script.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return; // Don't cache API or SSE stream
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Fetch in background to update cache for next time (Stale-while-revalidate)
                fetch(event.request).then(response => {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, response);
                    });
                }).catch(() => {});
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});
