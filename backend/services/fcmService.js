// FCM Service - Handles sending push notifications via Firebase Cloud Messaging
const { getMessaging } = require('../config/firebase');
const User = require('../models/user');

/**
 * Send a push notification to a specific user
 * @param {string} userId - The user's MongoDB ID
 * @param {Object} notification - Notification payload
 * @param {Object} data - Additional data payload
 * @returns {Promise<Object>} Result of the send operation
 */
const sendToUser = async (userId, notification, data = {}) => {
    try {
        const messaging = getMessaging();
        if (!messaging) {
            console.warn('FCM: Messaging not available');
            return { success: false, error: 'Messaging not initialized' };
        }

        // Get user's FCM tokens
        const user = await User.findById(userId).select('fcmTokens');
        if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
            console.log(`FCM: No tokens found for user ${userId}`);
            return { success: false, error: 'No FCM tokens' };
        }

        // Extract token strings
        const tokens = user.fcmTokens.map(t => t.token);
        console.log(`FCM: Sending to ${tokens.length} device(s) for user ${userId}`);

        // Send to all user's devices
        const message = {
            notification,
            data: {
                ...data,
                // Ensure all data values are strings (FCM requirement)
                ...(Object.keys(data).reduce((acc, key) => {
                    acc[key] = String(data[key]);
                    return acc;
                }, {}))
            },
            tokens
        };

        const response = await messaging.sendEachForMulticast(message);

        console.log(`FCM: ${response.successCount} successful, ${response.failureCount} failed`);

        // Handle failed tokens (remove invalid ones)
        if (response.failureCount > 0) {
            const tokensToRemove = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    // Remove tokens that are no longer valid
                    if (errorCode === 'messaging/registration-token-not-registered' ||
                        errorCode === 'messaging/invalid-registration-token') {
                        tokensToRemove.push(tokens[idx]);
                    }
                }
            });

            // Remove invalid tokens from user
            if (tokensToRemove.length > 0) {
                await User.findByIdAndUpdate(userId, {
                    $pull: { fcmTokens: { token: { $in: tokensToRemove } } }
                });
                console.log(`FCM: Removed ${tokensToRemove.length} invalid token(s)`);
            }
        }

        return {
            success: response.successCount > 0,
            successCount: response.successCount,
            failureCount: response.failureCount
        };
    } catch (error) {
        console.error('FCM: Error sending notification:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send a message notification
 * @param {string} recipientUserId - Message recipient's user ID
 * @param {Object} messageData - Message data
 */
const sendMessageNotification = async (recipientUserId, messageData) => {
    const { senderName, senderImage, messageText, chatId, chatName, isGroup } = messageData;

    const notification = {
        title: isGroup ? `${chatName}` : senderName,
        body: isGroup ? `${senderName}: ${messageText}` : messageText,
    };

    const data = {
        type: 'message',
        chatId: chatId,
        senderName: senderName,
        messageText: messageText.substring(0, 100), // Limit message length
        isGroup: String(isGroup)
    };

    return sendToUser(recipientUserId, notification, data);
};

/**
 * Send an incoming call notification
 * @param {string} recipientUserId - Call recipient's user ID
 * @param {Object} callData - Call data
 */
const sendCallNotification = async (recipientUserId, callData) => {
    const { callerName, callerImage, callId, callType } = callData;

    const notification = {
        title: 'Incoming Call',
        body: `${callerName} is calling...`,
    };

    const data = {
        type: 'call',
        callId: callId,
        callerName: callerName,
        callerImage: callerImage || '',
        callType: callType
    };

    return sendToUser(recipientUserId, notification, data);
};

/**
 * Send a missed call notification
 * @param {string} recipientUserId - User who missed the call
 * @param {Object} callData - Call data
 */
const sendMissedCallNotification = async (recipientUserId, callData) => {
    const { callerName, callId, callType } = callData;

    const notification = {
        title: 'Missed Call',
        body: `Missed ${callType} call from ${callerName}`,
    };

    const data = {
        type: 'missed_call',
        callId: callId,
        callerName: callerName,
        callType: callType
    };

    return sendToUser(recipientUserId, notification, data);
};

module.exports = {
    sendToUser,
    sendMessageNotification,
    sendCallNotification,
    sendMissedCallNotification
};
