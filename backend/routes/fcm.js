// FCM Routes
const express = require('express');
const router = express.Router();
const { registerToken, unregisterToken } = require('../controllers/fcm');
const { authorization } = require('../middlewares/authorization');

// Register FCM token (requires authentication)
router.post('/register-token', authorization, registerToken);

// Unregister FCM token (requires authentication)
router.delete('/unregister-token', authorization, unregisterToken);

module.exports = router;
