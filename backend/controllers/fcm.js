// FCM Controller - Handle FCM token registration/unregistration
const User = require('../models/user');

/**
 * Register an FCM token for the authenticated user
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

        // Check if this token is already registered
        const tokenExists = user.fcmTokens?.some(t => t.token === fcmToken);
        if (tokenExists) {
            return res.status(200).json({ message: 'Token already registered' });
        }

        // Add the new token
        await User.findByIdAndUpdate(userId, {
            $push: {
                fcmTokens: {
                    token: fcmToken,
                    device: req.headers['user-agent'] || 'unknown',
                    createdAt: new Date()
                }
            }
        });

        console.log(`FCM token registered for user ${userId}`);
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
