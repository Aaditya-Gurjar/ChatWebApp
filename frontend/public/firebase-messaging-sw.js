// Firebase Messaging Service Worker with PWA Support
// This handles background push notifications and PWA caching

// PWA Cache Configuration
const CACHE_VERSION = 'v3';  // Incremented to force update
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

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// ============================================
// FIREBASE BACKGROUND MESSAGE HANDLER
// ============================================
// This is the RELIABLE handler for iOS Safari PWA
// The tag property in webpush.notification (set by backend) prevents duplicates

messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    // Extract data from payload
    const data = payload.data || {};
    const notification = payload.notification || {};

    // Determine notification type
    const notificationType = data.type || 'notification';

    // Create tag for deduplication (matches backend)
    const tag = `${notificationType}-${data.chatId || data.callId || Date.now()}`;

    // Build notification
    let title = notification.title || 'ChatApp';
    let options = {
        body: notification.body || 'You have a new notification',
        icon: '/pwa-icons/icon-192x192.png',
        badge: '/pwa-icons/icon-96x96.png',
        tag: tag,  // CRITICAL: prevents duplicate notifications
        renotify: true,
        data: data,
        vibrate: [200, 100, 200]
    };

    // Customize based on type
    if (notificationType === 'call') {
        title = notification.title || '📞 Incoming Call';
        options.body = notification.body || `${data.callerName || 'Someone'} is calling...`;
        options.requireInteraction = true;
        options.vibrate = [500, 200, 500, 200, 500];
        options.actions = [
            { action: 'answer', title: '✅ Answer' },
            { action: 'decline', title: '❌ Decline' }
        ];
    } else if (notificationType === 'missed_call') {
        title = notification.title || '📵 Missed Call';
    } else if (notificationType === 'message') {
        title = data.senderName || notification.title || 'New Message';
        options.body = data.messageText || notification.body || 'You have a new message';
    }

    console.log('[SW] Showing notification:', title);
    return self.registration.showNotification(title, options);
});

// ============================================
// NOTIFICATION CLICK HANDLER
// ============================================

self.addEventListener('notificationclick', (event) => {
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
            .then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url.includes(self.registration.scope) && 'focus' in client) {
                        client.postMessage({
                            type: 'notification-click',
                            data: data,
                            action: action
                        });
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ============================================
// PWA LIFECYCLE EVENTS
// ============================================

self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker v3...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching essential resources');
                return cache.addAll(ESSENTIAL_RESOURCES);
            })
            .then(() => {
                console.log('[SW] Service worker installed');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache:', error);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker v3...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('chatapp-cache-') && name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch handler for caching
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== location.origin && !url.hostname.includes('gstatic.com')) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cached) => {
                if (cached) {
                    fetch(event.request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
                            }
                        })
                        .catch(() => { });
                    return cached;
                }
                return fetch(event.request)
                    .then((response) => {
                        if (response && response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
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

console.log('[SW] Firebase messaging service worker v3 loaded');
