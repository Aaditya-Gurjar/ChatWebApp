// FCM Controller - Handle FCM token registration/unregistration
const User = require('../models/user');

/**
 * Register an FCM token for the authenticated user
 * SINGLE DEVICE MODE: Replaces all existing tokens with the new one
 * This ensures only the latest logged-in device receives notifications
 * POST /api/fcm/register-token
 */
const registerToken = async (req, res) => {
    try {
        const { fcmToken } = req.body;
        const userId = req.user._id;

        if (!fcmToken) {
            return res.status(400).json({ message: 'FCM token is required' });
        }

        // Check if token already exists for this user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if this exact token is already the only registered token
        const existingTokens = user.fcmTokens || [];
        const tokenExists = existingTokens.length === 1 && existingTokens[0].token === fcmToken;

        if (tokenExists) {
            return res.status(200).json({ message: 'Token already registered' });
        }

        // SINGLE DEVICE MODE: Replace ALL existing tokens with the new one
        // This ensures only the latest logged-in device receives notifications
        await User.findByIdAndUpdate(userId, {
            $set: {
                fcmTokens: [{
                    token: fcmToken,
                    device: req.headers['user-agent'] || 'unknown',
                    createdAt: new Date()
                }]
            }
        });

        const removedCount = existingTokens.length;
        console.log(`FCM: Token registered for user ${userId} (replaced ${removedCount} old token(s))`);
        return res.status(200).json({ message: 'Token registered successfully' });
    } catch (error) {
        console.error('Error registering FCM token:', error);
        return res.status(500).json({ message: 'Failed to register token' });
    }
};

/**
 * Unregister an FCM token for the authenticated user
 * DELETE /api/fcm/unregister-token
 */
const unregisterToken = async (req, res) => {
    try {
        const { fcmToken } = req.body;
        const userId = req.user._id;

        if (!fcmToken) {
            return res.status(400).json({ message: 'FCM token is required' });
        }

        // Remove the token
        await User.findByIdAndUpdate(userId, {
            $pull: { fcmTokens: { token: fcmToken } }
        });

        console.log(`FCM token unregistered for user ${userId}`);
        return res.status(200).json({ message: 'Token unregistered successfully' });
    } catch (error) {
        console.error('Error unregistering FCM token:', error);
        return res.status(500).json({ message: 'Failed to unregister token' });
    }
};

module.exports = { registerToken, unregisterToken };
