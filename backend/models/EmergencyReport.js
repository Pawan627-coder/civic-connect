/**
 * ========================================================
 * CIVIC CONNECT - EMERGENCY ACCIDENT REPORT MODEL (EmergencyReport.js)
 * High-priority emergency road accident lifecycle model
 * ========================================================
 */

const mongoose = require('mongoose');

const ALLOWED_EMERGENCY_STATUSES = [
  'RECEIVED',
  'FACILITIES_IDENTIFIED',
  'NOTIFICATION_PENDING',
  'CONTACT_ATTEMPTED',
  'CONTACT_CONFIRMED',
  'CLOSED'
];

const ALLOWED_NOTIFICATION_STATUSES = [
  'NOT_CONFIGURED',
  'PENDING',
  'INITIATED',
  'RINGING',
  'COMPLETED',
  'FAILED',
  'REJECTED'
];

const emergencyReportSchema = new mongoose.Schema({
  // Unique human-readable Emergency Report ID (e.g. ACC-2026-8941)
  reportId: {
    type: String,
    required: [true, 'Emergency Report ID is required'],
    unique: true,
    trim: true,
    index: true
  },

  // Optional authenticated reporter reference
  reporterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  reporterName: {
    type: String,
    default: 'Anonymous Citizen'
  },

  reporterPhone: {
    type: String,
    default: ''
  },

  // Factual description of the accident
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: 'Road accident reported via Civic Connect Emergency Response.'
  },

  // Number of victims / vehicles if observed
  estimatedCasualties: {
    type: String,
    default: 'Unknown / Unspecified'
  },

  // Precise Location & Geolocation Evidence
  location: {
    latitude: {
      type: Number,
      required: [true, 'Accident latitude coordinate is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      required: [true, 'Accident longitude coordinate is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    },
    address: {
      type: String,
      trim: true,
      default: 'Pinned GPS Coordinates'
    },
    accuracyMeters: {
      type: Number,
      default: null
    },
    capturedAt: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      enum: ['gps', 'manual', 'network'],
      default: 'gps'
    }
  },

  // Evidence Photos (optional in emergencies to prevent delay)
  images: [
    {
      url: { type: String, required: true },
      name: { type: String, default: 'accident_photo.jpg' },
      sizeBytes: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: Date.now }
    }
  ],

  // Suggested Nearby Police Stations & Hospitals
  nearbyFacilities: [
    {
      id: { type: String },
      name: { type: String, required: true },
      type: { type: String, enum: ['police', 'hospital', 'fire_station', 'other'], default: 'hospital' },
      address: { type: String, default: '' },
      distanceKm: { type: Number, default: 0 },
      phone: { type: String, default: '' },
      isVerifiedPhone: { type: Boolean, default: false },
      mapUrl: { type: String, default: '' }
    }
  ],

  // Notification and Telephony Attempt Audit Trail
  notificationAttempts: [
    {
      attemptId: { type: String, required: true },
      facilityId: { type: String, default: '' },
      facilityName: { type: String, default: '' },
      facilityPhone: { type: String, default: '' },
      recipientType: { type: String, default: 'facility' }, // 'facility', 'police', 'ambulance', 'admin'
      provider: { type: String, default: 'telephony-dispatch' },
      status: {
        type: String,
        enum: ALLOWED_NOTIFICATION_STATUSES,
        default: 'PENDING'
      },
      message: { type: String, default: '' },
      callSid: { type: String, default: '' },
      initiatedAt: { type: Date, default: Date.now },
      completedAt: { type: Date, default: null },
      errorSummary: { type: String, default: '' }
    }
  ],

  // Lifecycle Status
  status: {
    type: String,
    enum: ALLOWED_EMERGENCY_STATUSES,
    default: 'RECEIVED',
    index: true
  },

  // Reporter genuine submission confirmation flag
  isGenuineConfirmed: {
    type: Boolean,
    default: true
  },

  // Optional AI Incident Summary
  aiIncidentSummary: {
    summary: { type: String, default: '' },
    suggestedUrgency: { type: String, default: 'High' },
    extractedKeyDetails: [{ type: String }],
    generatedAt: { type: Date }
  }
}, {
  timestamps: true
});

// Compound geospatial-like index on latitude/longitude
emergencyReportSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

module.exports = mongoose.model('EmergencyReport', emergencyReportSchema);
