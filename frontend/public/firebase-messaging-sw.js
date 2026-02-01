// Firebase Messaging Service Worker with PWA Support
// This handles background push notifications and PWA caching

// PWA Cache Configuration
const CACHE_VERSION = 'v1';
const CACHE_NAME = `chatapp-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const notificationData = payload.data || {};
    const notificationType = notificationData.type || 'message';

    let notificationTitle = 'New Notification';
    let notificationOptions = {
        icon: '/logo.jpeg',
        badge: '/logo.jpeg',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: notificationData
    };

    // Handle different notification types
    if (notificationType === 'message') {
        notificationTitle = notificationData.senderName || 'New Message';
        notificationOptions.body = notificationData.messageText || 'You have a new message';
        notificationOptions.tag = `message-${notificationData.chatId}`;
        notificationOptions.renotify = true;
    } else if (notificationType === 'call') {
        notificationTitle = 'Incoming Call';
        notificationOptions.body = `${notificationData.callerName || 'Someone'} is calling...`;
        notificationOptions.tag = `call-${notificationData.callId}`;
        notificationOptions.requireInteraction = true; // Keep call notification visible
        notificationOptions.vibrate = [300, 100, 300, 100, 300]; // Longer vibration for calls
        notificationOptions.actions = [
            { action: 'answer', title: '📞 Answer' },
            { action: 'decline', title: '❌ Decline' }
        ];
    } else if (notificationType === 'missed_call') {
        notificationTitle = 'Missed Call';
        notificationOptions.body = `Missed call from ${notificationData.callerName || 'Unknown'}`;
        notificationOptions.tag = `missed-call-${notificationData.callId}`;
    }

    // Show the notification
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);

    const notification = event.notification;
    const action = event.action;
    const data = notification.data || {};

    notification.close();

    // Determine URL to open based on notification type and action
    let urlToOpen = '/';

    if (data.type === 'message' && data.chatId) {
        urlToOpen = `/?chat=${data.chatId}`;
    } else if (data.type === 'call') {
        if (action === 'decline') {
            // For decline, we could post message to client, but for now just open app
            urlToOpen = '/';
        } else {
            // Answer or click - open app to handle call
            urlToOpen = `/?call=${data.callId}&action=answer`;
        }
    }

    // Open or focus the app window
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there's already an open window
                for (const client of windowClients) {
                    if (client.url.includes(self.registration.scope) && 'focus' in client) {
                        // Post message to existing window about the notification action
                        client.postMessage({
                            type: 'notification-click',
                            data: data,
                            action: action
                        });
                        return client.focus();
                    }
                }
                // No open window, open a new one
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event.notification.tag);
});

// ============================================
// PWA LIFECYCLE EVENTS
// ============================================

// Install event - cache essential resources
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching essential resources');
                return cache.addAll(ESSENTIAL_RESOURCES);
            })
            .then(() => {
                console.log('[SW] Essential resources cached');
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache resources:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

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
                // Take control of all clients immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip cross-origin requests (except for CDN assets)
    const url = new URL(event.request.url);
    if (url.origin !== location.origin && !url.hostname.includes('gstatic.com')) {
        return;
    }

    // For navigation requests (HTML pages), use network-first strategy
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // If offline, try to return cached version or offline page
                    return caches.match(event.request)
                        .then((cached) => cached || caches.match('/'));
                })
        );
        return;
    }

    // For other requests, use cache-first strategy for performance
    event.respondWith(
        caches.match(event.request)
            .then((cached) => {
                if (cached) {
                    // Return cached version and update cache in background
                    fetch(event.request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                caches.open(CACHE_NAME)
                                    .then((cache) => cache.put(event.request, response));
                            }
                        })
                        .catch(() => { });
                    return cached;
                }

                // Not cached, fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Cache successful responses for static assets
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    // Only cache static assets
                                    if (event.request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$/)) {
                                        cache.put(event.request, responseClone);
                                    }
                                });
                        }
                        return response;
                    });
            })
    );
});

console.log('[SW] Firebase messaging service worker with PWA support loaded');

