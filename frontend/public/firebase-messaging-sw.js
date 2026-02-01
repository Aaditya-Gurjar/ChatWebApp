// Firebase Messaging Service Worker with PWA Support
// This handles background push notifications and PWA caching

// PWA Cache Configuration
const CACHE_VERSION = 'v2';  // Incremented to force update
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
// PUSH EVENT HANDLER
// ============================================
// This is the ONLY handler we use. The backend sends notifications with `tag`
// which prevents duplicate notifications at the system level.
// We customize the notification display here.

self.addEventListener('push', (event) => {
    console.log('[SW] Push event received');

    if (!event.data) {
        console.log('[SW] No data in push event');
        return;
    }

    let payload = {};
    try {
        payload = event.data.json();
        console.log('[SW] Push payload received');
    } catch (e) {
        console.error('[SW] Could not parse push data:', e);
        return;
    }

    // FCM sends data in the 'data' field and notification info in 'notification'
    const fcmNotification = payload.notification || {};
    const fcmData = payload.data || {};

    // Determine notification type
    const notificationType = fcmData.type || 'notification';

    // Create tag (same format as backend for consistency)
    const tag = `${notificationType}-${fcmData.chatId || fcmData.callId || Date.now()}`;

    // Build notification options
    let title = fcmNotification.title || 'ChatApp';
    let options = {
        body: fcmNotification.body || 'You have a new notification',
        icon: '/pwa-icons/icon-192x192.png',
        badge: '/pwa-icons/icon-96x96.png',
        tag: tag,  // CRITICAL: prevents duplicate notifications
        renotify: true,  // Vibrate even if replacing existing notification
        data: fcmData,
        vibrate: [200, 100, 200]
    };

    // Customize based on notification type
    if (notificationType === 'call') {
        // Incoming call - make it distinctive
        title = fcmNotification.title || '📞 Incoming Call';
        options.body = fcmNotification.body || `${fcmData.callerName || 'Someone'} is calling...`;
        options.requireInteraction = true;  // Keep visible until user interacts
        options.vibrate = [500, 200, 500, 200, 500];  // Longer vibration
        options.actions = [
            { action: 'answer', title: '✅ Answer' },
            { action: 'decline', title: '❌ Decline' }
        ];
    } else if (notificationType === 'missed_call') {
        title = fcmNotification.title || '📵 Missed Call';
        options.body = fcmNotification.body || `Missed call from ${fcmData.callerName || 'Unknown'}`;
    } else if (notificationType === 'message') {
        // Message notification - use sender name as title
        title = fcmData.senderName || fcmNotification.title || 'New Message';
        options.body = fcmData.messageText || fcmNotification.body || 'You have a new message';
    }

    console.log('[SW] Showing notification:', title);

    // Show the notification
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
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

    // Determine URL to open
    let urlToOpen = '/';

    if (data.type === 'message' && data.chatId) {
        urlToOpen = `/?chat=${data.chatId}`;
    } else if (data.type === 'call') {
        if (action === 'answer') {
            urlToOpen = `/?call=${data.callId}&action=answer`;
        } else if (action === 'decline') {
            urlToOpen = '/';
        } else {
            urlToOpen = `/?call=${data.callId}`;
        }
    }

    // Open or focus the app
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
    console.log('[SW] Installing service worker v2...');

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
    console.log('[SW] Activating service worker v2...');

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

console.log('[SW] Firebase messaging service worker v2 loaded');
