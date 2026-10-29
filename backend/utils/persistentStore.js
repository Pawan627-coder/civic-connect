/**
 * ========================================================
 * CIVIC CONNECT - PERSISTENT FILE-BASED STORE (persistentStore.js)
 * Ensures 100% data durability across restarts when MongoDB Atlas
 * is in development/offline fallback mode.
 * ========================================================
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const STORE_PATH = path.join(__dirname, '..', 'data', 'civic_store.json');

// Default initial seed hazard reports
const DEFAULT_SEED_COMPLAINTS = [
  {
    id: "CC-1001",
    title: "Large pothole cluster near main road",
    category: "Road/Pothole",
    description: "Deep asphalt erosion causing severe traffic congestion and near-misses for two-wheelers during rainy hours near Metro Pillar 42.",
    location: {
      address: "Metro Pillar 42, Civil Lines, Gorakhpur, UP",
      latitude: 26.7606,
      longitude: 83.3732
    },
    date: "28 Sep 2026",
    severity: "High",
    status: "Under Verification",
    verification: "Pending",
    reportedBy: "user_seed_001",
    reporterName: "Civic Citizen",
    reportCount: 3,
    reporters: ["user_seed_001"],
    supporters: [],
    image: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80",
    aiAnalysis: {
      dangerLevel: "High",
      dangerScore: 72,
      reason: "Deep asphalt pothole cluster in high-transit lane causes sudden vehicle swerving.",
      keywords: ["pothole", "asphalt", "traffic", "swerving"],
      duplicateConfidence: 0
    },
    priority: {
      level: "High",
      score: 65,
      dangerScore: 72,
      communityScore: 54
    },
    resolvedDate: "",
    resolvedBy: "",
    resolutionNote: "",
    createdAt: new Date("2026-09-28T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-09-28T10:00:00Z").toISOString()
  },
  {
    id: "CC-1002",
    title: "Four street lights not working along school road",
    category: "Street Light",
    description: "Streetlights have been completely dark for over a week, making evening transit unsafe for pedestrians near the girls secondary school.",
    location: {
      address: "Civil Lines School Corridor, Gorakhpur, UP",
      latitude: 26.7635,
      longitude: 83.3758
    },
    date: "27 Sep 2026",
    severity: "Medium",
    status: "Reported",
    verification: "Pending",
    reportedBy: "user_seed_001",
    reporterName: "Rahul Verma",
    reportCount: 1,
    reporters: ["user_seed_001"],
    supporters: [],
    image: "",
    aiAnalysis: {
      dangerLevel: "Medium",
      dangerScore: 42,
      reason: "Reduced night visibility in pedestrian school corridor.",
      keywords: ["street light", "darkness", "school"],
      duplicateConfidence: 0
    },
    priority: {
      level: "Medium",
      score: 35,
      dangerScore: 42,
      communityScore: 25
    },
    resolvedDate: "",
    resolvedBy: "",
    resolutionNote: "",
    createdAt: new Date("2026-09-27T14:30:00Z").toISOString(),
    updatedAt: new Date("2026-09-27T14:30:00Z").toISOString()
  },
  {
    id: "CC-1003",
    title: "Severe sewage overflow flooding market entrance",
    category: "Sewage",
    description: "Blocked underground sewer main causing foul contaminated wastewater to pool across pedestrian walkway and store entrances.",
    location: {
      address: "Sector 18 Market Gate 2, Noida, UP",
      latitude: 28.5708,
      longitude: 77.3260
    },
    date: "30 Sep 2026",
    severity: "Critical",
    status: "In Progress",
    verification: "Verified",
    reportedBy: "user_seed_001",
    reporterName: "Pooja Sharma",
    reportCount: 5,
    reporters: ["user_seed_001"],
    supporters: [],
    image: "https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=600&auto=format&fit=crop&q=80",
    aiAnalysis: {
      dangerLevel: "High",
      dangerScore: 70,
      reason: "Contaminated wastewater spill poses acute public sanitation hazard.",
      keywords: ["sewage", "flooding", "market"],
      duplicateConfidence: 0
    },
    priority: {
      level: "High",
      score: 72,
      dangerScore: 70,
      communityScore: 75
    },
    resolvedDate: "",
    resolvedBy: "",
    resolutionNote: "",
    createdAt: new Date("2026-09-30T09:15:00Z").toISOString(),
    updatedAt: new Date("2026-09-30T09:15:00Z").toISOString()
  },
  {
    id: "CC-1004",
    title: "Deep trench left open after pipeline excavation",
    category: "Road/Pothole",
    description: "Excavation pit left without warning cones, reflective tape, or barricades. High hazard for night commuters and bicyclists.",
    location: {
      address: "Indira Nagar Main Arterial, Lucknow, UP",
      latitude: 26.8833,
      longitude: 80.9984
    },
    date: "01 Oct 2026",
    severity: "Critical",
    status: "Reported",
    verification: "Pending",
    reportedBy: "user_seed_001",
    reporterName: "Anil Kumar",
    reportCount: 4,
    reporters: ["user_seed_001"],
    supporters: [],
    image: "",
    aiAnalysis: {
      dangerLevel: "Critical",
      dangerScore: 88,
      reason: "Unbarricaded deep excavation pit presents catastrophic fall and collision risk.",
      keywords: ["open pit", "excavation", "barricade"],
      duplicateConfidence: 0
    },
    priority: {
      level: "Critical",
      score: 83,
      dangerScore: 88,
      communityScore: 75
    },
    resolvedDate: "",
    resolvedBy: "",
    resolutionNote: "",
    createdAt: new Date("2026-10-01T11:00:00Z").toISOString(),
    updatedAt: new Date("2026-10-01T11:00:00Z").toISOString()
  },
  {
    id: "CC-1005",
    title: "Uncollected roadside municipal garbage dump",
    category: "Garbage/Waste",
    description: "Community solid waste bin overflowing for 5 consecutive days. Stray animals scattering trash onto active two-lane roadway.",
    location: {
      address: "Banjara Hills Road No. 12, Hyderabad, Telangana",
      latitude: 17.4156,
      longitude: 78.4350
    },
    date: "29 Sep 2026",
    severity: "Medium",
    status: "Reported",
    verification: "Pending",
    reportedBy: "user_seed_001",
    reporterName: "Suresh Reddy",
    reportCount: 2,
    reporters: ["user_seed_001"],
    supporters: [],
    image: "",
    aiAnalysis: {
      dangerLevel: "Medium",
      dangerScore: 48,
      reason: "Solid waste accumulation causing hygiene and obstruction issues.",
      keywords: ["garbage", "waste", "roadside"],
      duplicateConfidence: 0
    },
    priority: {
      level: "Medium",
      score: 42,
      dangerScore: 48,
      communityScore: 35
    },
    resolvedDate: "",
    resolvedBy: "",
    resolutionNote: "",
    createdAt: new Date("2026-09-29T16:20:00Z").toISOString(),
    updatedAt: new Date("2026-09-29T16:20:00Z").toISOString()
  },
  {
    id: "CC-1006",
    title: "Traffic signal completely dead at 4-way intersection",
    category: "Traffic",
    description: "Traffic control lights malfunctioned following power surge, leading to chaotic gridlock and high risk of vehicle collisions.",
    location: {
      address: "MG Road & Brigade Rd Junction, Bengaluru, Karnataka",
      latitude: 12.9740,
      longitude: 77.6080
    },
    date: "25 Sep 2026",
    severity: "Critical",
    status: "Resolved",
    verification: "Verified",
    reportedBy: "user_seed_001",
    reporterName: "Karthik Raja",
    reportCount: 8,
    reporters: ["user_seed_001"],
    supporters: [],
    image: "",
    aiAnalysis: {
      dangerLevel: "High",
      dangerScore: 76,
      reason: "Non-functional signal lights at major intersection cause high-speed cross-traffic gridlock.",
      keywords: ["signal", "intersection", "collision"],
      duplicateConfidence: 0
    },
    priority: {
      level: "High",
      score: 75,
      dangerScore: 76,
      communityScore: 74
    },
    resolvedDate: "26 Sep 2026",
    resolvedBy: "Traffic Cell Admin",
    resolutionNote: "Electronic controller motherboard replaced and signal timer sequence calibrated.",
    createdAt: new Date("2026-09-25T08:45:00Z").toISOString(),
    updatedAt: new Date("2026-09-26T17:00:00Z").toISOString()
  }
];

class PersistentStore {
  constructor() {
    this.ensureStoreFile();
  }

  ensureStoreFile() {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(STORE_PATH)) {
      const initialUsers = [
        {
          _id: "admin_seed_001",
          id: "admin_seed_001",
          name: process.env.ADMIN_NAME || "Civic SuperAdmin",
          email: (process.env.ADMIN_EMAIL || "admin@civicconnect.org").toLowerCase(),
          password: bcrypt.hashSync(process.env.ADMIN_PASSWORD || "AdminSecurePass2026!", 10),
          role: "admin",
          rewardTokens: 100,
          createdAt: new Date().toISOString()
        },
        {
          _id: "user_seed_001",
          id: "user_seed_001",
          name: "Civic Citizen",
          email: "citizen@civicconnect.org",
          password: bcrypt.hashSync("CitizenPass2026!", 10),
          role: "user",
          rewardTokens: 40,
          createdAt: new Date().toISOString()
        }
      ];

      const initialData = {
        users: initialUsers,
        complaints: DEFAULT_SEED_COMPLAINTS
      };

      fs.writeFileSync(STORE_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
      console.log('✓ [PersistentStore]: Initialized civic_store.json with default seed users & complaints.');
    }
  }

  readData() {
    try {
      this.ensureStoreFile();
      const content = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed.notifications)) {
        parsed.notifications = [];
      }
      if (!Array.isArray(parsed.emergencyReports)) {
        parsed.emergencyReports = [];
      }
      if (Array.isArray(parsed.complaints)) {
        parsed.complaints = parsed.complaints.map(c => {
          if (!c.location || typeof c.location !== 'object') {
            c.location = {
              address: typeof c.location === 'string' ? c.location : 'Municipal Ward',
              latitude: c.latitude || 26.7606,
              longitude: c.longitude || 83.3732,
              source: 'manual',
              accuracy: null,
              capturedAt: null
            };
          } else {
            if (!c.location.source) c.location.source = 'manual';
            if (c.location.accuracy === undefined) c.location.accuracy = null;
            if (c.location.capturedAt === undefined) c.location.capturedAt = null;
          }
          if (!c.photoSource) c.photoSource = c.image ? 'upload' : 'none';
          if (c.photoUploadedAt === undefined) c.photoUploadedAt = c.createdAt || null;
          if (c.submittedAt === undefined) c.submittedAt = c.createdAt || new Date().toISOString();
          if (c.verificationNotes === undefined) c.verificationNotes = '';
          if (c.verifiedAt === undefined) c.verifiedAt = (c.verification === 'Verified' ? (c.updatedAt || c.createdAt) : null);
          if (c.verifiedBy === undefined) c.verifiedBy = (c.verification === 'Verified' ? 'Civic Authority' : '');
          if (!Array.isArray(c.verificationHistory)) c.verificationHistory = [];
          if (c.isReviewed === undefined) c.isReviewed = (c.status !== 'Reported' || c.verification !== 'Pending');
          if (c.reviewedAt === undefined) c.reviewedAt = (c.isReviewed ? (c.updatedAt || c.createdAt) : null);
          return c;
        });
      }
      return parsed;
    } catch (err) {
      console.error('[PersistentStore Error]: Could not read data file:', err.message);
      return { users: [], complaints: [], notifications: [] };
    }
  }

  writeData(data) {
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[PersistentStore Error]: Could not write data file:', err.message);
      return false;
    }
  }

  // User methods
  getUsers() {
    return this.readData().users;
  }

  findUserByEmail(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    return this.getUsers().find(u => u.email.toLowerCase() === clean) || null;
  }

  findUserById(id) {
    if (!id) return null;
    return this.getUsers().find(u => (u._id === id || u.id === id)) || null;
  }

  addUser(user) {
    const data = this.readData();
    const generatedId = user._id || user.id || `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newUser = {
      _id: generatedId,
      id: generatedId,
      name: user.name,
      email: user.email.toLowerCase(),
      password: user.password,
      role: user.role || 'user',
      rewardTokens: user.rewardTokens || 0,
      createdAt: user.createdAt || new Date().toISOString()
    };
    data.users.push(newUser);
    this.writeData(data);
    return newUser;
  }

  updateUser(id, updates) {
    const data = this.readData();
    const idx = data.users.findIndex(u => (u._id === id || u.id === id));
    if (idx === -1) return null;
    data.users[idx] = { ...data.users[idx], ...updates };
    this.writeData(data);
    return data.users[idx];
  }

  incrementUserTokens(id, amount) {
    const data = this.readData();
    const idx = data.users.findIndex(u => (u._id === id || u.id === id));
    if (idx === -1) return null;
    data.users[idx].rewardTokens = (data.users[idx].rewardTokens || 0) + amount;
    this.writeData(data);
    return data.users[idx];
  }

  // Complaints methods (Default: Latest First!)
  getComplaints(options = {}) {
    const list = this.readData().complaints || [];
    const cloned = [...list];
    if (options.sort === 'priority') {
      cloned.sort((a, b) => ((b.priority && b.priority.score) || 0) - ((a.priority && a.priority.score) || 0));
    } else {
      // Default: Latest First using real timestamps
      cloned.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.submittedAt || a.date || 0).getTime();
        const timeB = new Date(b.createdAt || b.submittedAt || b.date || 0).getTime();
        return timeB - timeA;
      });
    }
    return cloned;
  }

  findComplaintById(id) {
    if (!id) return null;
    const clean = id.trim().toLowerCase();
    return this.getComplaints().find(c => c.id.toLowerCase() === clean) || null;
  }

  addComplaint(complaint) {
    const data = this.readData();
    data.complaints = data.complaints || [];
    if (complaint.isReviewed === undefined) {
      complaint.isReviewed = false;
    }
    data.complaints.unshift(complaint);
    this.writeData(data);
    return complaint;
  }

  updateComplaint(id, updates) {
    const data = this.readData();
    const idx = data.complaints.findIndex(c => c.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) return null;
    data.complaints[idx] = {
      ...data.complaints[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.writeData(data);
    return data.complaints[idx];
  }

  markComplaintReviewed(id) {
    return this.updateComplaint(id, {
      isReviewed: true,
      reviewedAt: new Date().toISOString()
    });
  }

  // Notification methods with strict role & user isolation
  getNotifications(filter = {}) {
    const notifications = this.readData().notifications || [];
    const filtered = notifications.filter(n => {
      // 1. Role and user authorization boundary
      if (filter.targetRole === 'admin' || filter.targetRole === 'authority') {
        // Authorities see admin/authority notifications + global announcements
        const isAuthTarget = n.targetRole === 'admin' || n.targetRole === 'authority' || n.targetRole === 'all';
        if (!isAuthTarget) return false;
      } else if (filter.targetRole === 'user') {
        // Citizens strictly see: their own notifications (matching targetUserId) OR global notices
        if (filter.targetUserId) {
          const isOwn = (n.targetUserId && n.targetUserId.toString() === filter.targetUserId.toString()) ||
                        (n.targetRole === 'all' && !n.targetUserId);
          if (!isOwn) return false;
        } else {
          if (n.targetRole !== 'all') return false;
        }
      }

      // 2. Read filter
      if (filter.read !== undefined && n.read !== filter.read) {
        return false;
      }
      return true;
    });

    // Latest-First sort
    filtered.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    if (filter.limit) {
      const offset = filter.offset || 0;
      return filtered.slice(offset, offset + filter.limit);
    }
    return filtered;
  }

  getUnreadNotificationCount(filter = {}) {
    return this.getNotifications({ ...filter, read: false }).length;
  }

  findNotificationById(id) {
    if (!id) return null;
    const notifications = this.readData().notifications || [];
    return notifications.find(n => n.id === id) || null;
  }

  addNotification(notification) {
    const data = this.readData();
    data.notifications = data.notifications || [];
    const notifObj = {
      id: notification.id || `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: notification.type || 'GENERAL',
      targetRole: notification.targetRole || 'all',
      targetUserId: notification.targetUserId || null,
      complaintId: notification.complaintId || '',
      title: notification.title || '',
      message: notification.message || '',
      data: notification.data || {},
      read: !!notification.read,
      readAt: notification.readAt || null,
      createdAt: notification.createdAt || new Date().toISOString()
    };
    data.notifications.unshift(notifObj);
    // Keep max 500 notifications to prevent file bloating
    if (data.notifications.length > 500) {
      data.notifications = data.notifications.slice(0, 500);
    }
    this.writeData(data);
    return notifObj;
  }

  markNotificationRead(id, userId, role) {
    const data = this.readData();
    data.notifications = data.notifications || [];
    const idx = data.notifications.findIndex(n => n.id === id);
    if (idx === -1) return null;

    const notif = data.notifications[idx];
    // Security check: Citizens can only mark their own notifications as read
    if (role === 'user' && notif.targetUserId && userId && notif.targetUserId.toString() !== userId.toString()) {
      return null;
    }

    notif.read = true;
    notif.readAt = new Date().toISOString();
    this.writeData(data);
    return notif;
  }

  markAllNotificationsRead(targetRole, targetUserId) {
    const data = this.readData();
    data.notifications = data.notifications || [];
    let count = 0;
    data.notifications.forEach(n => {
      let match = true;
      if (targetRole === 'admin' || targetRole === 'authority') {
        if (n.targetRole !== 'admin' && n.targetRole !== 'authority' && n.targetRole !== 'all') match = false;
      } else if (targetRole === 'user') {
        if (targetUserId) {
          if (n.targetUserId && n.targetUserId.toString() !== targetUserId.toString()) match = false;
        } else {
          if (n.targetRole !== 'all') match = false;
        }
      }

      if (match && !n.read) {
        n.read = true;
        n.readAt = new Date().toISOString();
        count++;
      }
    });
    this.writeData(data);
    return count;
  }

  // Emergency Accident Reports methods
  getEmergencyReports() {
    const list = this.readData().emergencyReports || [];
    return [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  findEmergencyReportById(id) {
    if (!id) return null;
    const clean = id.trim().toLowerCase();
    return this.getEmergencyReports().find(r => r.reportId.toLowerCase() === clean) || null;
  }

  addEmergencyReport(report) {
    const data = this.readData();
    data.emergencyReports = data.emergencyReports || [];
    data.emergencyReports.unshift(report);
    this.writeData(data);
    return report;
  }

  updateEmergencyReport(id, updates) {
    const data = this.readData();
    data.emergencyReports = data.emergencyReports || [];
    const idx = data.emergencyReports.findIndex(r => r.reportId.toLowerCase() === id.trim().toLowerCase());
    if (idx === -1) return null;
    data.emergencyReports[idx] = {
      ...data.emergencyReports[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.writeData(data);
    return data.emergencyReports[idx];
  }
}

module.exports = new PersistentStore();
