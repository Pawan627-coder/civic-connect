/**
 * ========================================================
 * CIVIC CONNECT - AUTHENTICATION ROUTES (backend/routes/authRoutes.js)
 * Stage 9: Public Registration, Login, Logout, and Identity Endpoints
 * ========================================================
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Rate limiting to mitigate brute-force password guessing attacks
// Configured reasonably so student testing is smooth and uninterrupted
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 30, // Limit each IP to 30 login requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP address. Please wait 15 minutes before trying again.'
  }
});

// Public Authentication Routes
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);

// Protected Authentication Route (Requires valid JWT)
router.get('/me', protect, authController.getMe);

module.exports = router;
