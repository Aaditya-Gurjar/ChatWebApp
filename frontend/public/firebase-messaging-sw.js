// Firebase Messaging Service Worker with PWA Support
// This handles background push notifications and PWA caching

// PWA Cache Configuration
const CACHE_VERSION = 'v4';  // Incremented to force update
const CACHE_NAME = `chatapp-cache-${CACHE_VERSION}`;

// Resources to cache for offline access
const ESSENTIAL_RESOURCES = [
    '/',
    '/manifest.json',
    '/logo.jpeg',
    '/pwa-icons/icon-192x192.png',
    '/pwa-icons/icon-512x512.png'
];

// Import Firebase scripts for service worker context
// These are required for token generation but NOT for receiving push messages
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase configuration (must match frontend config)
const firebaseConfig = {
    apiKey: "AIzaSyCaMvYaskytQBLmHMzSyPxiJtGEGgZc4x4",
    authDomain: "chat-web-app-2cd3e.firebaseapp.com",
    projectId: "chat-web-app-2cd3e",
    storageBucket: "chat-web-app-2cd3e.firebasestorage.app",
    messagingSenderId: "377240953089",
    appId: "1:377240953089:web:142040ea34019403fa7b00"
};

// Initialize Firebase (required for token generation)
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ============================================
// STANDARD PUSH EVENT HANDLER
// ============================================
// CRITICAL: Firebase's onBackgroundMessage does NOT work reliably on iOS Safari PWAs!
// We use the standard Web Push API 'push' event instead.
// See: https://github.com/nicemak/react-firebase-web-push-pwa

self.addEventListener('push', function (event) {
    console.log('[SW] Push event received!');

    // Parse the push data
    let data = {};
    let notification = {};

    if (event.data) {
        try {
            const payload = event.data.json();
            console.log('[SW] Payload:', JSON.stringify(payload));

            // FCM sends data in these fields
            data = payload.data || {};
            notification = payload.notification || {};
        } catch (e) {
            console.log('[SW] Could not parse push data as JSON:', e);
            // Try text
            try {
                const text = event.data.text();
                console.log('[SW] Push data as text:', text);
            } catch (e2) {
                console.log('[SW] Could not read push data');
            }
        }
    }

    // Build notification content
    const notificationType = data.type || 'notification';
    const tag = `${notificationType}-${data.chatId || data.callId || Date.now()}`;

    let title = 'ChatApp';
    let body = 'You have a new notification';
    let options = {
        icon: '/pwa-icons/icon-192x192.png',
        badge: '/pwa-icons/icon-96x96.png',
        tag: tag,
        renotify: true,
        data: data,
        vibrate: [200, 100, 200]
    };

    // Use notification payload if available
    if (notification.title) {
        title = notification.title;
    }
    if (notification.body) {
        body = notification.body;
    }

    // Customize based on notification type
    if (notificationType === 'message') {
        title = data.senderName || notification.title || 'New Message';
        body = data.messageText || notification.body || 'You have a new message';
    } else if (notificationType === 'call') {
        title = '📞 Incoming Call';
        body = `${data.callerName || 'Someone'} is calling...`;
        options.requireInteraction = true;
        options.vibrate = [500, 200, 500, 200, 500];
        options.actions = [
            { action: 'answer', title: '✅ Answer' },
            { action: 'decline', title: '❌ Decline' }
        ];
    } else if (notificationType === 'missed_call') {
        title = '📵 Missed Call';
        body = `Missed call from ${data.callerName || 'Unknown'}`;
    }

    options.body = body;

    console.log('[SW] Showing notification:', title, body);

    // IMPORTANT: We MUST show a notification for every push event on iOS Safari
    // Otherwise push permission may be revoked!
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ============================================
// NOTIFICATION CLICK HANDLER
// ============================================

self.addEventListener('notificationclick', function (event) {
    console.log('[SW] Notification clicked');

    const notification = event.notification;
    const action = event.action;
    const data = notification.data || {};

    notification.close();

    let urlToOpen = '/';
    if (data.type === 'message' && data.chatId) {
        urlToOpen = `/?chat=${data.chatId}`;
    } else if (data.type === 'call') {
        if (action === 'answer') {
            urlToOpen = `/?call=${data.callId}&action=answer`;
        } else {
            urlToOpen = `/?call=${data.callId}`;
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (windowClients) {
                // Try to focus existing window
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if ('focus' in client) {
                        client.postMessage({
                            type: 'notification-click',
                            data: data,
                            action: action
                        });
                        return client.focus();
                    }
                }
                // Open new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ============================================
// PWA LIFECYCLE EVENTS
// ============================================

self.addEventListener('install', function (event) {
    console.log('[SW] Installing service worker v4...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                console.log('[SW] Caching essential resources');
                return cache.addAll(ESSENTIAL_RESOURCES);
            })
            .then(function () {
                console.log('[SW] Service worker v4 installed');
                return self.skipWaiting();
            })
            .catch(function (error) {
                console.error('[SW] Failed to cache:', error);
            })
    );
});

self.addEventListener('activate', function (event) {
    console.log('[SW] Activating service worker v4...');

    event.waitUntil(
        caches.keys()
            .then(function (cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function (name) {
                            return name.startsWith('chatapp-cache-') && name !== CACHE_NAME;
                        })
                        .map(function (name) {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(function () {
                console.log('[SW] Service worker v4 activated');
                return self.clients.claim();
            })
    );
});

// Fetch handler for caching
self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== location.origin && !url.hostname.includes('gstatic.com')) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(function () {
                    return caches.match(event.request)
                        .then(function (cached) {
                            return cached || caches.match('/');
                        });
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(function (cached) {
                if (cached) {
                    // Update cache in background
                    fetch(event.request)
                        .then(function (response) {
                            if (response && response.status === 200) {
                                caches.open(CACHE_NAME)
                                    .then(function (cache) {
                                        cache.put(event.request, response);
                                    });
                            }
                        })
                        .catch(function () { });
                    return cached;
                }
                return fetch(event.request)
                    .then(function (response) {
                        if (response && response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(function (cache) {
                                    if (event.request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$/)) {
                                        cache.put(event.request, clone);
                                    }
                                });
                        }
                        return response;
                    });
            })
    );
});

console.log('[SW] Firebase messaging service worker v4 loaded (iOS Safari compatible)');
