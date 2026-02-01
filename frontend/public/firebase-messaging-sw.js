// Firebase Messaging Service Worker
// This handles background push notifications when the app is not in focus

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

console.log('[SW] Firebase messaging service worker loaded');
