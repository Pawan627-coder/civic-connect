/**
 * ========================================================
 * CIVIC CONNECT - REAL-TIME NOTIFICATION SERVICE
 * (backend/services/notificationService.js)
 * Manages Server-Sent Events (SSE) connections, broadcast
 * pipelines, and persistent notification dispatching for:
 * 1. Authority Portal (New complaints, reminders, verification alerts)
 * 2. Citizen Portal (Complaint lifecycle, verifications, work started, resolutions)
 * ========================================================
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const persistentStore = require('../utils/persistentStore');

class NotificationService {
  constructor() {
    // Set of active SSE client subscribers: { id, res, role, userId, name }
    this.clients = new Set();
    this.keepAliveInterval = null;
    this.initHeartbeat();
  }

  initHeartbeat() {
    // Keepalive comment every 25s to prevent socket timeouts
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = setInterval(() => {
      for (const client of this.clients) {
        try {
          client.res.write(': heartbeat\n\n');
        } catch (err) {
          this.removeClient(client);
        }
      }
    }, 25000);
  }

  /**
   * Handle incoming SSE connection request (/api/notifications/stream)
   */
  handleSSEConnection(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    if (res.flushHeaders) res.flushHeaders();

    // Authenticate connecting user role & ID from token or query param
    let token = null;
    if (req.query && req.query.token) {
      token = req.query.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && (req.cookies.token || req.cookies.jwt)) {
      token = req.cookies.token || req.cookies.jwt;
    }

    let role = 'guest';
    let userId = null;
    let userName = 'Anonymous';

    if (token) {
      try {
        const secret = process.env.JWT_SECRET || 'civic_connect_super_secret_jwt_key_2026_dev';
        const decoded = jwt.verify(token, secret);
        userId = decoded.userId || decoded.id || null;
        role = decoded.role || (decoded.isAdmin ? 'admin' : 'user');
        userName = decoded.name || 'User';
      } catch (err) {
        role = 'guest';
      }
    }

    if (req.query && req.query.role && (req.query.role === 'admin' || req.query.role === 'user')) {
      if (role === 'guest') role = req.query.role;
    }

    const clientId = `client_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const client = {
      id: clientId,
      res,
      role,
      userId: userId ? userId.toString() : null,
      userName,
      connectedAt: new Date()
    };

    this.clients.add(client);
    console.log(`📡 [SSE Stream]: Client connected (${clientId}) - Role: "${role}", User: "${userName}" [Active: ${this.clients.size}]`);

    const initPayload = {
      type: 'INIT',
      status: 'connected',
      clientId,
      role,
      userId,
      timestamp: new Date().toISOString()
    };
    res.write(`event: connected\ndata: ${JSON.stringify(initPayload)}\n\n`);

    req.on('close', () => {
      this.removeClient(client);
    });

    req.on('error', (err) => {
      console.warn(`[SSE Warning]: Client ${clientId} connection error:`, err.message);
      this.removeClient(client);
    });
  }

  removeClient(client) {
    if (this.clients.has(client)) {
      this.clients.delete(client);
      console.log(`📡 [SSE Stream]: Client disconnected (${client.id}) [Remaining: ${this.clients.size}]`);
    }
  }

  /**
   * Save notification in database (MongoDB Atlas or Persistent Store)
   */
  async saveNotification(notificationData) {
    try {
      if (mongoose.connection.readyState === 1) {
        const Notification = require('../models/Notification');
        const notifDoc = await Notification.create(notificationData);
        return notifDoc.toObject();
      } else {
        return persistentStore.addNotification(notificationData);
      }
    } catch (err) {
      console.error('[Notification Store Error]:', err.message);
      return persistentStore.addNotification(notificationData);
    }
  }

  /**
   * Send SSE message to authorized subscribers with room/role isolation
   */
  dispatchSSE(eventName, payload, targetRole = 'all', targetUserId = null) {
    const sseMessage = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    let count = 0;

    for (const client of this.clients) {
      let isRecipient = false;

      if (targetRole === 'admin' || targetRole === 'authority') {
        if (client.role === 'admin' || client.role === 'authority' || client.role === 'guest') {
          isRecipient = true;
        }
      } else if (targetRole === 'user') {
        if (targetUserId) {
          // Direct recipient match or guest in test environment
          if (client.userId === targetUserId.toString() || (client.role === 'user' && !client.userId)) {
            isRecipient = true;
          }
        } else if (client.role === 'user' || client.role === 'guest') {
          isRecipient = true;
        }
      } else {
        // Broadcast to all
        isRecipient = true;
      }

      if (isRecipient) {
        try {
          client.res.write(sseMessage);
          count++;
        } catch (err) {
          this.removeClient(client);
        }
      }
    }

    return count;
  }

  /* ========================================================
   * CITIZEN NOTIFICATION TRIGGERS
   * ======================================================== */

  /**
   * 1. Citizen successfully submitted a complaint
   */
  async broadcastComplaintRegistered(complaint) {
    if (!complaint) return;
    const reporterId = (complaint.reportedBy && (complaint.reportedBy._id || complaint.reportedBy.id || complaint.reportedBy)).toString();

    const notifData = {
      id: `NOTIF-REG-${complaint.id}-${Date.now()}`,
      type: 'COMPLAINT_REGISTERED',
      targetRole: 'user',
      targetUserId: reporterId,
      complaintId: complaint.id,
      title: `Complaint Registered — #${complaint.id}`,
      message: `Your complaint #${complaint.id} ("${complaint.title}") has been submitted successfully.`,
      data: {
        id: complaint.id,
        title: complaint.title,
        category: complaint.category,
        status: complaint.status || 'Reported',
        date: complaint.date || new Date().toLocaleDateString('en-GB')
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    const saved = await this.saveNotification(notifData);
    this.dispatchSSE('notification', { type: 'COMPLAINT_REGISTERED', notification: saved, complaint }, 'user', reporterId);
    return saved;
  }

  /**
   * 2. Complaint Evidence Verification Decision (Verified, Needs Inspection, Evidence Requested, Rejected)
   */
  async broadcastVerificationUpdate(complaint, verificationStatus, notes = '') {
    if (!complaint || !verificationStatus) return;
    const reporterId = (complaint.reportedBy && (complaint.reportedBy._id || complaint.reportedBy.id || complaint.reportedBy)).toString();

    let notifType = 'VERIFICATION_UPDATE';
    let titleText = `Complaint Verification: ${verificationStatus}`;
    let msgText = `Municipal Authority has marked your complaint #${complaint.id} as "${verificationStatus}".`;

    if (verificationStatus === 'Verified') {
      notifType = 'COMPLAINT_VERIFIED';
      titleText = `Complaint Verified — #${complaint.id}`;
      msgText = `Your ${complaint.category} complaint has been verified by the authority.`;
    } else if (verificationStatus === 'Needs Inspection') {
      notifType = 'NEEDS_INSPECTION';
      titleText = `Inspection Required — #${complaint.id}`;
      msgText = `Your complaint #${complaint.id} requires on-site physical inspection. ${notes ? `Note: "${notes}"` : ''}`.trim();
    } else if (verificationStatus === 'Insufficient Evidence') {
      notifType = 'EVIDENCE_REQUESTED';
      titleText = `Additional Evidence Requested — #${complaint.id}`;
      msgText = `Additional evidence requested for complaint #${complaint.id}. Reason: ${notes || 'Please provide clearer photo or landmark details.'}`;
    } else if (verificationStatus === 'Rejected') {
      notifType = 'COMPLAINT_REJECTED';
      titleText = `Complaint Rejected — #${complaint.id}`;
      msgText = `Your complaint #${complaint.id} was rejected. Reason: ${notes || 'Does not qualify under municipal jurisdiction.'}`;
    }

    const notifData = {
      id: `NOTIF-VERIFY-${complaint.id}-${Date.now()}`,
      type: notifType,
      targetRole: 'user',
      targetUserId: reporterId,
      complaintId: complaint.id,
      title: titleText,
      message: msgText,
      data: {
        id: complaint.id,
        title: complaint.title,
        category: complaint.category,
        verification: verificationStatus,
        verificationNotes: notes || '',
        status: complaint.status || 'Reported'
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    const saved = await this.saveNotification(notifData);
    this.dispatchSSE('verification_update', { type: notifType, notification: saved, complaint }, 'user', reporterId);
    this.dispatchSSE('notification', { type: notifType, notification: saved, complaint }, 'user', reporterId);
    return saved;
  }

  /**
   * 3. Complaint Status Changed (Work Started / In Progress / Reopened)
   */
  async broadcastStatusUpdate(complaint, status) {
    if (!complaint || !status) return;
    const reporterId = (complaint.reportedBy && (complaint.reportedBy._id || complaint.reportedBy.id || complaint.reportedBy)).toString();

    let titleText = `Status Update — #${complaint.id}`;
    let msgText = `The status of your complaint #${complaint.id} has been updated to "${status}".`;

    if (status === 'In Progress') {
      titleText = `Work Started — #${complaint.id}`;
      msgText = `The authority has started working on your complaint #${complaint.id} ("${complaint.title}").`;
    } else if (status === 'Reported' || status === 'Under Verification') {
      titleText = `Complaint In Review — #${complaint.id}`;
      msgText = `Your complaint #${complaint.id} is now under municipal review.`;
    }

    const notifData = {
      id: `NOTIF-STATUS-${complaint.id}-${Date.now()}`,
      type: 'STATUS_UPDATE',
      targetRole: 'user',
      targetUserId: reporterId,
      complaintId: complaint.id,
      title: titleText,
      message: msgText,
      data: {
        id: complaint.id,
        title: complaint.title,
        category: complaint.category,
        status: status
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    const saved = await this.saveNotification(notifData);
    this.dispatchSSE('status_update', { type: 'STATUS_UPDATE', notification: saved, complaint }, 'user', reporterId);
    this.dispatchSSE('notification', { type: 'STATUS_UPDATE', notification: saved, complaint }, 'user', reporterId);
    return saved;
  }

  /**
   * 4. Complaint Resolved
   */
  async broadcastComplaintResolved(complaint) {
    if (!complaint) return;
    const reporterId = (complaint.reportedBy && (complaint.reportedBy._id || complaint.reportedBy.id || complaint.reportedBy)).toString();
    const resNote = complaint.resolutionNote || 'Remediation completed by municipal crew.';

    const notifData = {
      id: `NOTIF-RES-${complaint.id}-${Date.now()}`,
      type: 'COMPLAINT_RESOLVED',
      targetRole: 'user',
      targetUserId: reporterId,
      complaintId: complaint.id,
      title: `Complaint Resolved — #${complaint.id}`,
      message: `Great news! Your complaint #${complaint.id} has been marked as resolved. Action: "${resNote}" (+3 tokens earned).`,
      data: {
        id: complaint.id,
        title: complaint.title,
        category: complaint.category,
        status: 'Resolved',
        resolutionNote: resNote,
        resolvedDate: complaint.resolvedDate || new Date().toLocaleDateString('en-GB')
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    const saved = await this.saveNotification(notifData);
    this.dispatchSSE('complaint_resolved', { type: 'COMPLAINT_RESOLVED', notification: saved, complaint }, 'user', reporterId);
    this.dispatchSSE('notification', { type: 'COMPLAINT_RESOLVED', notification: saved, complaint }, 'user', reporterId);
    return saved;
  }

  /**
   * 5. Priority Changed
   */
  async broadcastPriorityUpdated(complaint, priorityLevel) {
    if (!complaint || !priorityLevel) return;
    const reporterId = (complaint.reportedBy && (complaint.reportedBy._id || complaint.reportedBy.id || complaint.reportedBy)).toString();

    const notifData = {
      id: `NOTIF-PRIO-${complaint.id}-${Date.now()}`,
      type: 'PRIORITY_UPDATED',
      targetRole: 'user',
      targetUserId: reporterId,
      complaintId: complaint.id,
      title: `Priority Updated — #${complaint.id}`,
      message: `The priority for complaint #${complaint.id} has been set to "${priorityLevel}".`,
      data: {
        id: complaint.id,
        title: complaint.title,
        priority: priorityLevel
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    const saved = await this.saveNotification(notifData);
    this.dispatchSSE('notification', { type: 'PRIORITY_UPDATED', notification: saved, complaint }, 'user', reporterId);
    return saved;
  }

  /**
   * 6. Official / Department Assigned
   */
  async broadcastOfficialAssigned(complaint, officialName) {
    if (!complaint || !officialName) return;
    const reporterId = (complaint.reportedBy && (complaint.reportedBy._id || complaint.reportedBy.id || complaint.reportedBy)).toString();

    const notifData = {
      id: `NOTIF-ASSIGN-${complaint.id}-${Date.now()}`,
      type: 'OFFICIAL_ASSIGNED',
      targetRole: 'user',
      targetUserId: reporterId,
      complaintId: complaint.id,
      title: `Official Assigned — #${complaint.id}`,
      message: `Field official "${officialName}" has been assigned to investigate and handle complaint #${complaint.id}.`,
      data: {
        id: complaint.id,
        title: complaint.title,
        assignedOfficial: officialName
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    const saved = await this.saveNotification(notifData);
    this.dispatchSSE('notification', { type: 'OFFICIAL_ASSIGNED', notification: saved, complaint }, 'user', reporterId);
    return saved;
  }

  /* ========================================================
   * AUTHORITY NOTIFICATION TRIGGERS
   * ======================================================== */

  /**
   * 7. New Complaint Registered in Authority Jurisdiction
   */
  async broadcastNewComplaint(complaint) {
    if (!complaint) return;
    const locAddress = (complaint.location && typeof complaint.location === 'object' && complaint.location.address)
      ? complaint.location.address
      : (typeof complaint.location === 'string' ? complaint.location : 'Municipal Ward');

    const priorityLevel = (complaint.priority && complaint.priority.level)
      ? complaint.priority.level.toUpperCase()
      : (complaint.severity ? complaint.severity.toUpperCase() : 'MEDIUM');

    const notifData = {
      id: `NOTIF-NEW-${complaint.id}-${Date.now()}`,
      type: 'NEW_COMPLAINT',
      targetRole: 'admin',
      targetUserId: null,
      complaintId: complaint.id,
      title: `New Complaint Requires Verification — #${complaint.id}`,
      message: `A new ${complaint.category} complaint was registered at ${locAddress}. Priority: ${priorityLevel}. Waiting for review.`,
      data: {
        id: complaint.id,
        title: complaint.title,
        category: complaint.category,
        location: locAddress,
        severity: complaint.severity || 'Medium',
        priority: priorityLevel,
        status: complaint.status || 'Reported',
        verification: complaint.verification || 'Pending',
        reporterName: complaint.reporterName || 'Civic Citizen'
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    const saved = await this.saveNotification(notifData);
    this.dispatchSSE('new_complaint', { type: 'NEW_COMPLAINT', notification: saved, complaint }, 'admin');
    this.dispatchSSE('notification', { type: 'NEW_COMPLAINT', notification: saved, complaint }, 'admin');
    return saved;
  }

  /**
   * 8. Citizen Dispatched an Urgent Reminder
   */
  async broadcastCitizenReminder(complaint, reason = '', note = '', citizenName = 'Citizen') {
    if (!complaint) return;

    const notifData = {
      id: `NOTIF-REMIND-${complaint.id}-${Date.now()}`,
      type: 'REMINDER_ALERT',
      targetRole: 'admin',
      targetUserId: null,
      complaintId: complaint.id,
      title: `Citizen Reminder — #${complaint.id}`,
      message: `${citizenName} sent an urgent reminder for #${complaint.id} ("${complaint.title}"). Reason: "${reason || 'Pending action follow-up'}"`,
      data: {
        id: complaint.id,
        title: complaint.title,
        category: complaint.category,
        reason: reason,
        note: note,
        remindersCount: complaint.remindersCount || 1
      },
      read: false,
      createdAt: new Date().toISOString()
    };

    const saved = await this.saveNotification(notifData);
    this.dispatchSSE('reminder_alert', { type: 'REMINDER_ALERT', notification: saved, complaint }, 'admin');
    this.dispatchSSE('notification', { type: 'REMINDER_ALERT', notification: saved, complaint }, 'admin');
    return saved;
  }

  /* ========================================================
   * NOTIFICATION QUERY & STATUS MANAGEMENT
   * ======================================================== */

  /**
   * Fetch paginated notifications for authenticated user
   */
  async getNotifications({ role, userId, page = 1, limit = 50, unreadOnly = false }) {
    try {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      if (mongoose.connection.readyState === 1) {
        const Notification = require('../models/Notification');
        const query = {};

        if (role === 'admin' || role === 'authority') {
          query.$or = [{ targetRole: 'admin' }, { targetRole: 'authority' }, { targetRole: 'all' }];
        } else {
          query.$or = [
            { targetUserId: userId },
            { targetRole: 'all', targetUserId: null }
          ];
        }

        if (unreadOnly) {
          query.read = false;
        }

        const [list, total] = await Promise.all([
          Notification.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limitNum).lean(),
          Notification.countDocuments(query)
        ]);

        return {
          notifications: list,
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum)
        };
      } else {
        const targetRole = (role === 'admin' || role === 'authority') ? 'admin' : 'user';
        const filtered = persistentStore.getNotifications({
          targetRole,
          targetUserId: userId,
          read: unreadOnly ? false : undefined
        });

        const total = filtered.length;
        const list = filtered.slice(skip, skip + limitNum);

        return {
          notifications: list,
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum)
        };
      }
    } catch (err) {
      console.error('[Get Notifications Error]:', err.message);
      return { notifications: [], total: 0, page: 1, pages: 1 };
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount({ role, userId }) {
    try {
      if (mongoose.connection.readyState === 1) {
        const Notification = require('../models/Notification');
        const query = { read: false };
        if (role === 'admin' || role === 'authority') {
          query.$or = [{ targetRole: 'admin' }, { targetRole: 'authority' }, { targetRole: 'all' }];
        } else {
          query.$or = [
            { targetUserId: userId },
            { targetRole: 'all', targetUserId: null }
          ];
        }
        return await Notification.countDocuments(query);
      } else {
        const targetRole = (role === 'admin' || role === 'authority') ? 'admin' : 'user';
        return persistentStore.getUnreadNotificationCount({ targetRole, targetUserId: userId });
      }
    } catch (err) {
      return 0;
    }
  }

  /**
   * Mark individual notification as read with ownership validation
   */
  async markAsRead(id, userId, role) {
    if (mongoose.connection.readyState === 1) {
      const Notification = require('../models/Notification');
      const query = { id };
      if (role === 'user' && userId) {
        query.$or = [{ targetUserId: userId }, { targetRole: 'all' }];
      }
      return await Notification.findOneAndUpdate(query, { read: true, readAt: new Date() }, { new: true });
    } else {
      return persistentStore.markNotificationRead(id, userId, role);
    }
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(role, userId) {
    if (mongoose.connection.readyState === 1) {
      const Notification = require('../models/Notification');
      const filter = { read: false };
      if (role === 'admin' || role === 'authority') {
        filter.$or = [{ targetRole: 'admin' }, { targetRole: 'authority' }, { targetRole: 'all' }];
      } else {
        filter.$or = [{ targetUserId: userId }, { targetRole: 'all', targetUserId: null }];
      }
      const res = await Notification.updateMany(filter, { read: true, readAt: new Date() });
      return res.modifiedCount;
    } else {
      const targetRole = (role === 'admin' || role === 'authority') ? 'admin' : 'user';
      return persistentStore.markAllNotificationsRead(targetRole, userId);
    }
  }
}

module.exports = new NotificationService();
