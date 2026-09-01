const express = require('express');
const router = express.Router();
const { login, getMe, changePassword, updateProfile } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', verifyToken, getMe);
router.post('/change-password', verifyToken, changePassword);
router.put('/profile', verifyToken, updateProfile);

module.exports = router;

