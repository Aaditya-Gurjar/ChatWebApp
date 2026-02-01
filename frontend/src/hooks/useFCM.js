// useFCM Hook - Firebase Cloud Messaging token management
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    requestNotificationPermission,
    getFCMToken,
    onForegroundMessage,
    isNotificationSupported
} from '../firebase/firebase';
import { toast } from 'react-toastify';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Custom hook for managing FCM (Firebase Cloud Messaging)
 * Handles permission requests, token management, and foreground messages
 */
export const useFCM = () => {
    const authUser = useSelector((store) => store.auth);
    const [fcmToken, setFcmToken] = useState(null);
    const [permissionStatus, setPermissionStatus] = useState('default');
    const [isInitialized, setIsInitialized] = useState(false);
    const tokenRegisteredRef = useRef(false);
    const isInitializingRef = useRef(false);  // Guard against multiple init calls
    const unsubscribeRef = useRef(null);

    /**
     * Register FCM token with backend
     */
    const registerToken = useCallback(async (token) => {
        console.log('🔔 FCM: registerToken called');

        // Prevent duplicate registrations
        if (tokenRegisteredRef.current) {
            console.log('🔔 FCM: Token already registered, skipping');
            return true;
        }

        console.log('🔔 FCM: Token exists:', !!token);
        console.log('🔔 FCM: Auth user ID:', authUser?._id);

        // Get JWT token from localStorage (that's where the app stores it)
        const jwtToken = localStorage.getItem('token');
        console.log('🔔 FCM: JWT token exists:', !!jwtToken);

        if (!token || !authUser?._id || !jwtToken) {
            console.log('🔔 FCM: Cannot register token - missing token or auth');
            return false;
        }

        try {
            console.log('🔔 FCM: Sending token to backend...');
            const response = await fetch(`${BACKEND_URL}/api/fcm/register-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwtToken}`
                },
                body: JSON.stringify({ fcmToken: token })
            });

            console.log('🔔 FCM: Backend response status:', response.status);

            if (response.ok) {
                console.log('🔔 FCM: Token registered with backend successfully!');
                tokenRegisteredRef.current = true;
                return true;
            } else {
                const errorData = await response.text();
                console.error('🔔 FCM: Failed to register token:', response.status, errorData);
                return false;
            }
        } catch (error) {
            console.error('🔔 FCM: Error registering token:', error);
            return false;
        }
    }, [authUser]);

    /**
     * Unregister FCM token from backend (on logout)
     */
    const unregisterToken = useCallback(async () => {
        if (!fcmToken || !authUser?.token) {
            return;
        }

        try {
            await fetch(`${BACKEND_URL}/api/fcm/unregister-token`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authUser.token}`
                },
                body: JSON.stringify({ fcmToken })
            });
            console.log('FCM token unregistered from backend');
            tokenRegisteredRef.current = false;
        } catch (error) {
            console.error('Error unregistering FCM token:', error);
        }
    }, [fcmToken, authUser]);

    /**
     * Initialize FCM - request permission and get token
     */
    const initializeFCM = useCallback(async () => {
        console.log('🔔 FCM: Initializing...');

        // Prevent multiple simultaneous initializations
        if (isInitializingRef.current || isInitialized) {
            console.log('🔔 FCM: Already initialized or initializing, skipping');
            return;
        }
        isInitializingRef.current = true;

        if (!isNotificationSupported()) {
            console.warn('🔔 FCM: Push notifications not supported in this browser');
            setPermissionStatus('unsupported');
            return;
        }

        // Check current permission status
        const currentPermission = Notification.permission;
        console.log('🔔 FCM: Current permission status:', currentPermission);
        setPermissionStatus(currentPermission);

        if (currentPermission === 'granted') {
            // Already have permission, get token directly
            console.log('🔔 FCM: Permission already granted, getting token...');
            const token = await getFCMToken();
            if (token) {
                console.log('🔔 FCM: Token obtained successfully');
                setFcmToken(token);
                localStorage.setItem('fcmToken', token); // Save for logout
                await registerToken(token);
            } else {
                console.warn('🔔 FCM: Failed to get token');
            }
        } else if (currentPermission === 'default') {
            // Permission not yet asked - request it automatically
            console.log('🔔 FCM: Requesting permission...');
            try {
                const permission = await Notification.requestPermission();
                console.log('🔔 FCM: Permission response:', permission);
                setPermissionStatus(permission);

                if (permission === 'granted') {
                    const token = await getFCMToken();
                    if (token) {
                        console.log('🔔 FCM: Token obtained after permission grant');
                        setFcmToken(token);
                        localStorage.setItem('fcmToken', token); // Save for logout
                        await registerToken(token);
                        toast.success('Notifications enabled!');
                    }
                } else if (permission === 'denied') {
                    console.warn('🔔 FCM: Permission denied by user');
                    toast.warning('Enable notifications in browser settings for alerts when offline');
                }
            } catch (err) {
                console.error('🔔 FCM: Error requesting permission:', err);
            }
        } else {
            // Permission was denied previously
            console.log('🔔 FCM: Permission was previously denied');
        }

        setIsInitialized(true);
    }, [registerToken]);

    /**
     * Request notification permission from user
     * Call this when user clicks "Enable Notifications" button
     */
    const requestPermission = useCallback(async () => {
        const permission = await requestNotificationPermission();
        setPermissionStatus(permission);

        if (permission === 'granted') {
            const token = await getFCMToken();
            if (token) {
                setFcmToken(token);
                localStorage.setItem('fcmToken', token); // Save for logout
                await registerToken(token);
                toast.success('Notifications enabled!');
            }
        } else if (permission === 'denied') {
            toast.error('Notification permission denied. Enable in browser settings.');
        }

        return permission;
    }, [registerToken]);

    /**
     * Handle foreground message callback
     */
    const handleForegroundMessage = useCallback((payload) => {
        console.log('Foreground message:', payload);
        const data = payload.data || {};
        const notification = payload.notification || {};

        // For foreground messages, we can show a toast instead of browser notification
        // since the user is already in the app
        if (data.type === 'message') {
            // Message notifications are already handled by socket.io in the app
            // Just log for debugging
            console.log('Message notification received (handled by socket)');
        } else if (data.type === 'call') {
            // Call notifications are handled by socket.io
            console.log('Call notification received (handled by socket)');
        } else if (notification.title) {
            // Generic notification
            toast.info(`${notification.title}: ${notification.body || ''}`);
        }
    }, []);

    // Initialize FCM when user is authenticated
    useEffect(() => {
        if (authUser?._id && !isInitialized) {
            initializeFCM();
        }
    }, [authUser?._id, isInitialized, initializeFCM]);

    // Set up foreground message listener
    useEffect(() => {
        if (isInitialized && fcmToken) {
            unsubscribeRef.current = onForegroundMessage(handleForegroundMessage);
        }

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [isInitialized, fcmToken, handleForegroundMessage]);

    // Handle logout - unregister token
    useEffect(() => {
        // If user was logged in and now is logged out
        if (!authUser?._id && tokenRegisteredRef.current) {
            unregisterToken();
            setFcmToken(null);
            setIsInitialized(false);
        }
    }, [authUser?._id, unregisterToken]);

    return {
        fcmToken,
        permissionStatus,
        isInitialized,
        requestPermission,
        unregisterToken,
        isSupported: isNotificationSupported()
    };
};

export default useFCM;
