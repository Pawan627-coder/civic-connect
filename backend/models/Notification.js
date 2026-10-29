/**
 * ========================================================
 * CIVIC CONNECT - NOTIFICATION MONGOOSE MODEL (backend/models/Notification.js)
 * Real-time event notifications for Authority and Citizen Portals
 * ========================================================
 */

const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'COMPLAINT_REGISTERED',
  'NEW_COMPLAINT',
  'NEW_COMPLAINT_VERIFY',
  'COMPLAINT_VERIFIED',
  'NEEDS_INSPECTION',
  'EVIDENCE_REQUESTED',
  'COMPLAINT_REJECTED',
  'PRIORITY_UPDATED',
  'OFFICIAL_ASSIGNED',
  'STATUS_UPDATE',
  'COMPLAINT_RESOLVED',
  'REMINDER_ALERT',
  'REMINDER_RESPONSE',
  'VERIFICATION_UPDATE',
  'GENERAL'
];

const notificationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: NOTIFICATION_TYPES,
    default: 'GENERAL'
  },
  targetRole: {
    type: String,
    enum: ['admin', 'authority', 'user', 'all'],
    default: 'all',
    index: true
  },
  targetUserId: {
    type: String,
    default: null,
    index: true
  },
  complaintId: {
    type: String,
    default: '',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Aliases for consistent naming across conventions
notificationSchema.virtual('recipientUserId').get(function () {
  return this.targetUserId;
}).set(function (v) {
  this.targetUserId = v;
});

notificationSchema.virtual('recipientRole').get(function () {
  return this.targetRole;
}).set(function (v) {
  this.targetRole = v;
});

notificationSchema.virtual('isRead').get(function () {
  return this.read;
}).set(function (v) {
  this.read = v;
});

notificationSchema.virtual('relatedComplaintId').get(function () {
  return this.complaintId;
}).set(function (v) {
  this.complaintId = v;
});

// Optimized query compound indexes
notificationSchema.index({ targetUserId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ targetRole: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
