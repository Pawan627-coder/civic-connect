/**
 * ========================================================
 * CIVIC CONNECT - COMPLAINT MONGOOSE MODEL (backend/models/Complaint.js)
 * Stage 10: AI Risk Assessment, Geolocation & Duplicate Report Aggregation
 * ========================================================
 */

const mongoose = require('mongoose');

// Allowed enum values
const ALLOWED_CATEGORIES = [
  "Road/Pothole",
  "Sewage",
  "Street Light",
  "Garbage/Waste",
  "Waterlogging",
  "Traffic",
  "Accident",
  "Other"
];

const ALLOWED_SEVERITIES = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

const ALLOWED_STATUSES = [
  "Reported",
  "Under Verification",
  "In Progress",
  "Resolved",
  "Rejected"
];

const ALLOWED_VERIFICATIONS = [
  "Pending",
  "Verified",
  "Needs Inspection",
  "Insufficient Evidence",
  "Rejected",
  "pending",
  "verified",
  "needs_inspection",
  "insufficient_evidence",
  "rejected"
];

const ALLOWED_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Critical",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
];

const complaintSchema = new mongoose.Schema({
  // Human-friendly unique identifier (e.g. CC-1001)
  id: {
    type: String,
    required: [true, "Complaint ID is required"],
    unique: true,
    trim: true,
    index: true
  },

  // Problem title
  title: {
    type: String,
    required: [true, "Problem title is required"],
    trim: true,
    minlength: [5, "Title must be at least 5 characters"],
    maxlength: [150, "Title cannot exceed 150 characters"]
  },

  // Hazard Category
  category: {
    type: String,
    required: [true, "Category is required"],
    enum: {
      values: ALLOWED_CATEGORIES,
      message: "{VALUE} is not a valid category"
    }
  },

  // Detailed description of hazard
  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true,
    minlength: [10, "Description must be at least 10 characters"],
    maxlength: [1000, "Description cannot exceed 1000 characters"]
  },

  // Geolocation & Address Information
  location: {
    address: {
      type: String,
      trim: true,
      default: ""
    },
    latitude: {
      type: Number,
      required: [true, "Latitude coordinate is required"]
    },
    longitude: {
      type: Number,
      required: [true, "Longitude coordinate is required"]
    },
    source: {
      type: String,
      enum: ['gps', 'manual', 'GPS', 'Manual'],
      default: 'manual'
    },
    accuracy: {
      type: Number,
      default: null
    },
    capturedAt: {
      type: Date,
      default: null
    }
  },

  // Citizen severity label
  severity: {
    type: String,
    enum: {
      values: ALLOWED_SEVERITIES,
      message: "{VALUE} is not a valid severity level"
    },
    default: "Medium"
  },

  // Lifecycle Status
  status: {
    type: String,
    required: [true, "Status is required"],
    enum: {
      values: ALLOWED_STATUSES,
      message: "{VALUE} is not a valid complaint status"
    },
    default: "Reported"
  },

  // Verification State
  verification: {
    type: String,
    required: [true, "Verification status is required"],
    enum: {
      values: ALLOWED_VERIFICATIONS,
      message: "{VALUE} is not a valid verification status"
    },
    default: "Pending"
  },

  // Original citizen reporter
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, "Reporter reference is required"]
  },

  reporterName: {
    type: String,
    trim: true,
    default: "Civic User"
  },

  // Number of independent citizens who reported the same underlying issue
  reportCount: {
    type: Number,
    default: 1,
    min: [1, "Report count must be at least 1"]
  },

  // Citizens who submitted duplicate reports (prevents duplicate spam by same user)
  reporters: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],

  // Community supporters / voters who endorsed this complaint
  supporters: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],

  // Google Gemini AI Risk Analysis Assessment
  aiAnalysis: {
    dangerLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'Unavailable', 'unavailable'],
      default: 'Medium'
    },
    dangerScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    reason: {
      type: String,
      default: "AI danger assessment queued."
    },
    keywords: [
      {
        type: String
      }
    ],
    duplicateConfidence: {
      type: Number,
      default: 0
    },
    analyzedAt: {
      type: Date,
      default: Date.now
    }
  },

  // Calculated Civic Connect Priority Object
  priority: {
    level: {
      type: String,
      enum: ALLOWED_PRIORITIES,
      default: "Medium"
    },
    score: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    dangerScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    communityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    calculatedAt: {
      type: Date,
      default: Date.now
    }
  },

  // Photo URL / Thumbnail
  image: {
    type: String,
    trim: true,
    default: ""
  },

  // Human-readable date string (e.g. "03 Oct 2026")
  date: {
    type: String,
    default: () => new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  },

  // Resolution record fields
  resolvedDate: {
    type: String,
    default: ""
  },
  resolvedBy: {
    type: String,
    default: ""
  },
  resolutionNote: {
    type: String,
    default: ""
  },

  // Authority Operations & Assignment Fields
  assignedOfficial: {
    type: String,
    trim: true,
    default: ""
  },
  internalNotes: {
    type: String,
    trim: true,
    default: ""
  },

  // Location & Photo Evidence Verification Fields
  photoSource: {
    type: String,
    enum: ['camera', 'gallery', 'upload', 'Camera', 'Gallery', 'Upload'],
    default: 'upload'
  },
  photoUploadedAt: {
    type: Date,
    default: null
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },

  // Verification Details & Audit History
  verificationNotes: {
    type: String,
    trim: true,
    default: ""
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: String,
    trim: true,
    default: ""
  },
  verificationHistory: [
    {
      action: {
        type: String,
        required: true
      },
      status: {
        type: String,
        required: true
      },
      authorityId: {
        type: String,
        default: ""
      },
      authorityName: {
        type: String,
        default: ""
      },
      notes: {
        type: String,
        default: ""
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  // Authority Review Tracking for "NEW" indicator
  isReviewed: {
    type: Boolean,
    default: false,
    index: true
  },
  reviewedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field for total supporter count
complaintSchema.virtual('supportersCount').get(function () {
  return Array.isArray(this.supporters) ? this.supporters.length : 0;
});

// Virtual field for total vote count
complaintSchema.virtual('voteCount').get(function () {
  return Array.isArray(this.supporters) ? this.supporters.length : 0;
});

const Complaint = mongoose.model('Complaint', complaintSchema);

module.exports = Complaint;
