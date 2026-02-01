// Firebase SDK initialization
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig, { vapidKey } from './firebaseConfig';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
// Note: This will only work in browsers that support Push API
let messaging = null;

// Check if browser supports notifications
const isNotificationSupported = () => {
    return (
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window
    );
};

// Initialize messaging only if supported
if (isNotificationSupported()) {
    try {
        messaging = getMessaging(app);
    } catch (error) {
        console.warn('Firebase messaging not supported:', error);
    }
}

/**
 * Request notification permission from the user
 * @returns {Promise<string>} Permission status: 'granted', 'denied', or 'default'
 */
export const requestNotificationPermission = async () => {
    if (!isNotificationSupported()) {
        console.warn('Notifications not supported in this browser');
        return 'unsupported';
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
        return permission;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return 'error';
    }
};

/**
 * Get FCM token for this browser instance
 * @returns {Promise<string|null>} FCM token or null if failed
 */
export const getFCMToken = async () => {
    if (!messaging) {
        console.warn('Firebase messaging not initialized');
        return null;
    }

    try {
        // First, ensure we have permission
        const permission = Notification.permission;
        if (permission !== 'granted') {
            console.warn('Notification permission not granted');
            return null;
        }

        // Register service worker for background messages
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service worker registered:', registration);

        // Get the token
        const token = await getToken(messaging, {
            vapidKey: vapidKey,
            serviceWorkerRegistration: registration
        });

        if (token) {
            console.log('FCM Token obtained:', token.substring(0, 20) + '...');
            return token;
        } else {
            console.warn('No FCM token available');
            return null;
        }
    } catch (error) {
        console.error('Error getting FCM token:', error);
        return null;
    }
};

/**
 * Set up listener for foreground messages
 * @param {Function} callback - Function to call when message received
 * @returns {Function|null} Unsubscribe function or null if not supported
 */
export const onForegroundMessage = (callback) => {
    if (!messaging) {
        console.warn('Firebase messaging not initialized');
        return null;
    }

    return onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        callback(payload);
    });
};

export { messaging, isNotificationSupported };
export default app;
