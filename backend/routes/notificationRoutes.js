/**
 * ========================================================
 * CIVIC CONNECT - NOTIFICATION ROUTES (notificationRoutes.js)
 * SSE real-time stream & notification endpoints
 * ========================================================
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

// 1. GET /api/notifications/stream - Server-Sent Events real-time event pipeline
router.get('/stream', notificationController.streamNotifications);

// 2. GET /api/notifications/unread-count - Unread badge count
router.get('/unread-count', optionalAuth, notificationController.getUnreadCount);

// 3. GET /api/notifications - Fetch past notifications (Optional auth or protected, paginated)
router.get('/', optionalAuth, notificationController.getNotifications);

// 4. PATCH /api/notifications/read-all & mark-all-read - Mark all as read
router.patch('/read-all', optionalAuth, notificationController.markAllAsRead);
router.patch('/mark-all-read', optionalAuth, notificationController.markAllAsRead);

// 5. PATCH /api/notifications/:id/read - Mark individual notification as read
router.patch('/:id/read', optionalAuth, notificationController.markAsRead);

module.exports = router;
