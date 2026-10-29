/**
 * ========================================================
 * CIVIC CONNECT - NOTIFICATION CONTROLLER (notificationController.js)
 * REST API & Server-Sent Events stream controller
 * ========================================================
 */

const notificationService = require('../services/notificationService');

/**
 * GET /api/notifications/stream
 * Connects browser to real-time Server-Sent Events (SSE) notification stream
 */
exports.streamNotifications = (req, res) => {
  notificationService.handleSSEConnection(req, res);
};

/**
 * GET /api/notifications
 * Retrieves past notifications for authenticated citizen or municipal authority (with pagination & unread filter)
 */
exports.getNotifications = async (req, res) => {
  try {
    const role = (req.user && req.user.role) || 'guest';
    const userId = (req.user && (req.user.id || req.user._id)) || null;
    const { page, limit, unreadOnly } = req.query;

    const result = await notificationService.getNotifications({
      role,
      userId,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      unreadOnly: unreadOnly === 'true' || unreadOnly === true
    });

    const unreadCount = await notificationService.getUnreadCount({ role, userId });

    res.status(200).json({
      success: true,
      count: result.notifications.length,
      total: result.total,
      page: result.page,
      pages: result.pages,
      unreadCount,
      data: result.notifications
    });
  } catch (err) {
    console.error('Error in getNotifications:', err);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving notifications'
    });
  }
};

/**
 * GET /api/notifications/unread-count
 * Returns the unread notification badge count for the current user
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const role = (req.user && req.user.role) || 'guest';
    const userId = (req.user && (req.user.id || req.user._id)) || null;

    const count = await notificationService.getUnreadCount({ role, userId });

    res.status(200).json({
      success: true,
      count
    });
  } catch (err) {
    console.error('Error in getUnreadCount:', err);
    res.status(500).json({
      success: false,
      count: 0,
      message: 'Server error retrieving unread count'
    });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read with ownership validation
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const role = (req.user && req.user.role) || 'guest';
    const userId = (req.user && (req.user.id || req.user._id)) || null;

    const updated = await notificationService.markAsRead(id, userId, role);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: updated
    });
  } catch (err) {
    console.error('Error in markAsRead:', err);
    res.status(500).json({
      success: false,
      message: 'Server error marking notification as read'
    });
  }
};

/**
 * PATCH /api/notifications/read-all
 * PATCH /api/notifications/mark-all-read
 * Marks all notifications as read for current user/role
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const role = (req.user && req.user.role) || 'guest';
    const userId = (req.user && (req.user.id || req.user._id)) || null;

    const modified = await notificationService.markAllAsRead(role, userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: modified
    });
  } catch (err) {
    console.error('Error in markAllAsRead:', err);
    res.status(500).json({
      success: false,
      message: 'Server error marking all notifications as read'
    });
  }
};
