/**
 * ========================================================
 * CIVIC CONNECT - COMPLAINT CONTROLLER (complaintController.js)
 * Stage 10: Gemini AI Risk Assessment, Proximity Duplicate Detection,
 *           Dynamic Priority Calculation & Google Maps Integration
 * ========================================================
 */

const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const geminiService = require('../services/geminiService');
const persistentStore = require('../utils/persistentStore');
const { calculatePriority, calculateDistanceMeters } = require('../utils/priorityCalculator');
const notificationService = require('../services/notificationService');

// Seed complaints with realistic geographic coordinates across Indian urban hubs
const INITIAL_SEED_REPORTS = persistentStore.getComplaints();

/**
 * Helper: Find or create default citizen account for initial seed reports in MongoDB Atlas
 */
async function getOrCreateSeedCitizen() {
  try {
    let citizen = await User.findOne({ email: 'citizen@civicconnect.org' });
    if (!citizen) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('CitizenPass2026!', salt);
      citizen = await User.create({
        name: 'Civic Citizen',
        email: 'citizen@civicconnect.org',
        password: hashedPassword,
        role: 'user',
        rewardTokens: 40
      });
      console.log('✓ [Seed]: Created default demo citizen account (citizen@civicconnect.org)');
    }
    return citizen;
  } catch (err) {
    console.error('Error in getOrCreateSeedCitizen:', err.message);
    return null;
  }
}

/**
 * Safe Data Migration & Seeding for MongoDB
 */
async function initializeAndMigrateDatabase() {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const seedCitizen = await getOrCreateSeedCitizen();
    const seedUserId = seedCitizen ? seedCitizen._id : new mongoose.Types.ObjectId();

    const rawCollection = mongoose.connection.db.collection('complaints');

    // 1. Upgrade legacy location string and missing AI fields
    const legacyDocs = await rawCollection.find({
      $or: [
        { location: { $type: "string" } },
        { "location.latitude": { $exists: false } },
        { aiAnalysis: { $exists: false } },
        { priority: { $exists: false } },
        { reportCount: { $exists: false } }
      ]
    }).toArray();

    if (legacyDocs.length > 0) {
      console.log(`ℹ️  [MongoDB Migration]: Upgrading ${legacyDocs.length} complaints to Stage 10 AI & Geolocation schema...`);
      for (const doc of legacyDocs) {
        const updateFields = {};

        // Migrate string location to object
        if (typeof doc.location === 'string') {
          updateFields.location = {
            address: doc.location,
            latitude: 26.7606,
            longitude: 83.3732
          };
        } else if (!doc.location || !doc.location.latitude) {
          updateFields.location = {
            address: (doc.location && doc.location.address) || "Civic Ward Location",
            latitude: 26.7606,
            longitude: 83.3732
          };
        }

        if (!doc.reportCount) updateFields.reportCount = 1;
        if (!doc.reporters) updateFields.reporters = [doc.reportedBy || seedUserId];

        // Seed initial AI and Priority if missing
        if (!doc.aiAnalysis) {
          updateFields.aiAnalysis = {
            dangerLevel: "Medium",
            dangerScore: 50,
            reason: "AI risk assessment queued.",
            keywords: [doc.category ? doc.category.toLowerCase() : 'civic'],
            duplicateConfidence: 0,
            analyzedAt: new Date()
          };
        }

        if (!doc.priority) {
          updateFields.priority = calculatePriority({
            dangerScore: 50,
            reportCount: doc.reportCount || 1,
            voteCount: Array.isArray(doc.supporters) ? doc.supporters.length : 0
          });
        }

        await rawCollection.updateOne({ _id: doc._id }, { $set: updateFields });
      }
      console.log('✓ [MongoDB Migration]: Complaints successfully upgraded with AI & Geolocation structures!');
    }

    // 2. Check if collection is empty, and seed initial records
    const count = await Complaint.countDocuments();
    if (count === 0) {
      console.log('ℹ️  [MongoDB Notice]: Populating database with Stage 10 geolocated hazard reports...');
      const recordsToInsert = INITIAL_SEED_REPORTS.map(item => ({
        ...item,
        reportedBy: seedUserId,
        reporters: [seedUserId],
        supporters: []
      }));
      await Complaint.insertMany(recordsToInsert);
      console.log(`✓ [MongoDB Seed]: Inserted ${recordsToInsert.length} complaints with AI & Google Maps coordinates!`);
    }
  } catch (err) {
    console.error('Database migration/seed error:', err.message);
  }
}

mongoose.connection.on('connected', initializeAndMigrateDatabase);

/**
 * Generate human-friendly sequential ID (e.g. "CC-1009")
 */
async function generateNextComplaintId() {
  if (mongoose.connection.readyState === 1) {
    try {
      const allComplaints = await Complaint.find({}, { id: 1 }).lean();
      let maxNum = 1000;
      allComplaints.forEach(item => {
        const match = item.id && item.id.match(/^CC-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      return `CC-${maxNum + 1}`;
    } catch (e) {
      return `CC-${Date.now().toString().slice(-4)}`;
    }
  } else {
    let maxNum = 1000;
    const complaints = persistentStore.getComplaints();
    complaints.forEach(c => {
      const match = c.id && c.id.match(/^CC-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `CC-${maxNum + 1}`;
  }
}


/**
 * 1. GET /api/complaints
 * Public civic explorer - returns complaints with AI danger, priority, coordinates, and filters
 */
exports.getAllComplaints = async (req, res) => {
  try {
    const { category, status, priority, danger, search, q, sort, unreviewedOnly } = req.query;

    if (mongoose.connection.readyState === 1) {
      const filter = {};
      if (category && category !== 'all') {
        filter.category = new RegExp(`^${category}$`, 'i');
      }
      if (status && status !== 'all') {
        filter.status = new RegExp(`^${status}$`, 'i');
      }
      if (priority && priority !== 'all') {
        filter['priority.level'] = new RegExp(`^${priority}$`, 'i');
      }
      if (danger && danger !== 'all') {
        filter['aiAnalysis.dangerLevel'] = new RegExp(`^${danger}$`, 'i');
      }
      if (unreviewedOnly === 'true' || unreviewedOnly === true) {
        filter.isReviewed = { $ne: true };
      }

      const searchTerm = search || q;
      if (searchTerm && searchTerm.trim() !== '') {
        const regex = new RegExp(searchTerm.trim(), 'i');
        filter.$or = [
          { title: regex },
          { description: regex },
          { id: regex },
          { 'location.address': regex }
        ];
      }

      // Latest-first default database sort (createdAt: -1, _id: -1)
      let sortQuery = { createdAt: -1, _id: -1 };
      if (sort === 'priority') {
        sortQuery = { 'priority.score': -1, createdAt: -1 };
      } else if (sort === 'oldest') {
        sortQuery = { createdAt: 1, _id: 1 };
      } else if (sort === 'votes') {
        sortQuery = { 'supporters.length': -1, createdAt: -1 };
      }

      const complaints = await Complaint.find(filter)
        .populate('reportedBy', 'name email status rewardTokens flaggedReason')
        .sort(sortQuery);

      const sanitized = complaints.map(doc => {
        const item = doc.toObject();
        item.supportersCount = Array.isArray(item.supporters) ? item.supporters.length : 0;
        item.voteCount = item.supportersCount;
        item.supporters = item.supportersCount;
        item.reportCount = item.reportCount || 1;
        const rep = doc.reportedBy;
        item.reporterId = (rep && (rep._id || rep.id)) ? (rep._id || rep.id).toString() : (item.reportedBy ? item.reportedBy.toString() : '');
        item.reporterName = item.reporterName || (rep && rep.name) || 'Civic Citizen';
        item.reporterEmail = (rep && rep.email) || item.reporterEmail || '';
        item.reporterStatus = (rep && rep.status) || 'Active';
        item.reporterTokens = (rep && rep.rewardTokens !== undefined) ? rep.rewardTokens : 0;
        item.reportedBy = item.reporterName;
        return item;
      });

      return res.status(200).json({
        success: true,
        source: "MongoDB Atlas",
        count: sanitized.length,
        data: sanitized
      });
    } else {
      // Persistent File Store Fallback
      let result = [...persistentStore.getComplaints()];

      if (category && category !== 'all') {
        result = result.filter(c => c.category && c.category.toLowerCase() === category.toLowerCase());
      }
      if (status && status !== 'all') {
        result = result.filter(c => c.status && c.status.toLowerCase() === status.toLowerCase());
      }
      if (priority && priority !== 'all') {
        result = result.filter(c => c.priority && c.priority.level && c.priority.level.toLowerCase() === priority.toLowerCase());
      }
      if (danger && danger !== 'all') {
        result = result.filter(c => c.aiAnalysis && c.aiAnalysis.dangerLevel && c.aiAnalysis.dangerLevel.toLowerCase() === danger.toLowerCase());
      }
      if (unreviewedOnly === 'true' || unreviewedOnly === true) {
        result = result.filter(c => c.isReviewed !== true);
      }

      const searchTerm = search || q;
      if (searchTerm && searchTerm.trim() !== '') {
        const term = searchTerm.trim().toLowerCase();
        result = result.filter(c =>
          (c.title && c.title.toLowerCase().includes(term)) ||
          (c.description && c.description.toLowerCase().includes(term)) ||
          (c.id && c.id.toLowerCase().includes(term)) ||
          (c.location && c.location.address && c.location.address.toLowerCase().includes(term))
        );
      }

      // Sort: Latest first by default
      if (sort === 'priority') {
        result.sort((a, b) => ((b.priority && b.priority.score) || 0) - ((a.priority && a.priority.score) || 0));
      } else if (sort === 'oldest') {
        result.sort((a, b) => new Date(a.createdAt || a.submittedAt || 0) - new Date(b.createdAt || b.submittedAt || 0));
      } else {
        result.sort((a, b) => new Date(b.createdAt || b.submittedAt || 0) - new Date(a.createdAt || a.submittedAt || 0));
      }

      const allUsers = persistentStore.getUsers();
      const formatted = result.map(c => {
        const repId = (c.reportedBy && c.reportedBy.toString()) || (c.reporters && c.reporters[0] && c.reporters[0].toString()) || '';
        const rep = allUsers.find(u => (u.id || u._id || '').toString() === repId || (u.name && c.reporterName && u.name.toLowerCase() === c.reporterName.toLowerCase()));
        return {
          ...c,
          supportersCount: Array.isArray(c.supporters) ? c.supporters.length : 0,
          voteCount: Array.isArray(c.supporters) ? c.supporters.length : 0,
          supporters: Array.isArray(c.supporters) ? c.supporters.length : (c.supporters || 0),
          reportCount: c.reportCount || 1,
          reporterId: rep ? (rep.id || rep._id) : (c.reportedBy || ''),
          reporterName: rep ? rep.name : (c.reporterName || 'Civic Citizen'),
          reporterEmail: rep ? rep.email : (c.reporterEmail || ''),
          reporterStatus: rep ? (rep.status || 'Active') : 'Active',
          reporterTokens: rep ? (rep.rewardTokens || 0) : 0,
          reportedBy: rep ? rep.name : (c.reporterName || 'Civic Citizen')
        };
      });

      return res.status(200).json({
        success: true,
        source: "Persistent Store",
        count: formatted.length,
        data: formatted
      });
    }
  } catch (error) {
    console.error('Error in getAllComplaints:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve complaints",
      error: error.message
    });
  }
};


/**
 * 2. GET /api/complaints/mine AND /api/users/me/complaints
 * Private personal feed of reports submitted by the logged-in citizen
 */
exports.getMyComplaints = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    if (mongoose.connection.readyState === 1) {
      const myComplaints = await Complaint.find({
        $or: [
          { reportedBy: userId },
          { reporters: userId }
        ]
      }).sort({ createdAt: -1, _id: -1 });

      const sanitized = myComplaints.map(doc => {
        const item = doc.toObject();
        item.supportersCount = Array.isArray(item.supporters) ? item.supporters.length : 0;
        item.voteCount = item.supportersCount;
        item.supporters = item.supportersCount;
        item.reportCount = item.reportCount || 1;
        item.reportedBy = req.user.name;
        return item;
      });

      return res.status(200).json({
        success: true,
        source: "MongoDB Atlas",
        count: sanitized.length,
        data: sanitized
      });
    } else {
      const all = persistentStore.getComplaints();
      const userComplaints = all.filter(
        c => (c.reportedBy && c.reportedBy.toString() === userId.toString()) ||
             (c.reporters && c.reporters.map(r => r.toString()).includes(userId.toString()))
      );

      // Latest first
      userComplaints.sort((a, b) => new Date(b.createdAt || b.submittedAt || 0) - new Date(a.createdAt || a.submittedAt || 0));

      const formatted = userComplaints.map(c => ({
        ...c,
        supportersCount: Array.isArray(c.supporters) ? c.supporters.length : 0,
        voteCount: Array.isArray(c.supporters) ? c.supporters.length : 0,
        supporters: Array.isArray(c.supporters) ? c.supporters.length : (c.supporters || 0),
        reportCount: c.reportCount || 1,
        reportedBy: req.user.name
      }));

      return res.status(200).json({
        success: true,
        source: "Persistent Store",
        count: formatted.length,
        data: formatted
      });
    }
  } catch (error) {
    console.error('Error in getMyComplaints:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve your complaints",
      error: error.message
    });
  }
};


/**
 * 3. GET /api/complaints/:id
 * Retrieve single complaint by human-friendly ID
 */
exports.getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      const complaint = await Complaint.findOne({
        id: { $regex: new RegExp(`^${id}$`, 'i') }
      }).populate('reportedBy', 'name');

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      const item = complaint.toObject();
      item.supportersCount = Array.isArray(item.supporters) ? item.supporters.length : 0;
      item.voteCount = item.supportersCount;
      item.supporters = item.supportersCount;
      item.reportCount = item.reportCount || 1;
      item.reportedBy = item.reporterName || (complaint.reportedBy && complaint.reportedBy.name) || 'Civic User';

      return res.status(200).json({
        success: true,
        source: "MongoDB Atlas",
        data: item
      });
    } else {
      const complaint = persistentStore.findComplaintById(id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      return res.status(200).json({
        success: true,
        source: "Persistent Store",
        data: {
          ...complaint,
          supportersCount: Array.isArray(complaint.supporters) ? complaint.supporters.length : 0,
          voteCount: Array.isArray(complaint.supporters) ? complaint.supporters.length : 0,
          supporters: Array.isArray(complaint.supporters) ? complaint.supporters.length : (complaint.supporters || 0),
          reportCount: complaint.reportCount || 1,
          reportedBy: complaint.reporterName || 'Civic User'
        }
      });
    }
  } catch (error) {
    console.error('Error in getComplaintById:', error);
    res.status(500).json({
      success: false,
      message: "Database error while fetching complaint record",
      error: error.message
    });
  }
};


/**
 * 4. POST /api/complaints
 * Create a new complaint with:
 * A. Duplicate Detection (Geographic proximity + Gemini Semantic matching)
 * B. AI Danger Assessment
 * C. Dynamic Priority Score Calculation
 */
exports.createComplaint = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      severity,
      image,
      location,
      latitude,
      longitude,
      address,
      locationSource,
      locationAccuracy,
      locationCapturedAt,
      photoSource,
      photoUploadedAt
    } = req.body;

    // Validate required fields
    if (!title || !category || !description) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, category, description"
      });
    }

    if (title.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "Title must be at least 5 characters"
      });
    }

    if (description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Description must be at least 10 characters"
      });
    }

    // Extract coordinates safely
    let lat = null;
    let lng = null;
    let addr = "";
    let locSource = 'manual';
    let locAccuracy = null;
    let locCapturedAt = null;

    if (location && typeof location === 'object') {
      lat = parseFloat(location.latitude);
      lng = parseFloat(location.longitude);
      addr = location.address || "";
      if (location.source) locSource = location.source;
      if (location.accuracy !== undefined && location.accuracy !== null) locAccuracy = parseFloat(location.accuracy);
      if (location.capturedAt) locCapturedAt = new Date(location.capturedAt);
    } else {
      lat = parseFloat(latitude);
      lng = parseFloat(longitude);
      addr = address || (typeof location === 'string' ? location : "");
    }

    if (locationSource) locSource = locationSource;
    if (locationAccuracy !== undefined && locationAccuracy !== null) locAccuracy = parseFloat(locationAccuracy);
    if (locationCapturedAt) locCapturedAt = new Date(locationCapturedAt);

    // Normalize location source
    locSource = (locSource && locSource.toString().toLowerCase() === 'gps') ? 'gps' : 'manual';
    if (locAccuracy !== null && (isNaN(locAccuracy) || locAccuracy < 0)) {
      locAccuracy = null;
    }

    // Validate coordinates range
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude (-90 to 90) and longitude (-180 to 180) coordinates are required for hazard mapping."
      });
    }

    // Photo metadata & validation
    let pSource = 'upload';
    if (photoSource) {
      const cleanPSource = photoSource.toString().toLowerCase();
      if (cleanPSource === 'camera') pSource = 'camera';
      else if (cleanPSource === 'gallery') pSource = 'gallery';
      else pSource = 'upload';
    }
    let pUploadedAt = photoUploadedAt ? new Date(photoUploadedAt) : (image ? new Date() : null);

    // Validate image format / size if provided
    let cleanImage = image ? image.trim() : "";
    if (cleanImage && cleanImage.length > 8 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "Uploaded image exceeds maximum allowable payload size (5MB)."
      });
    }

    const reporterId = req.user.id || req.user._id;
    const reporterName = req.user.name || "Civic User";
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    const cleanCategory = category.trim();

    const radiusMeters = parseInt(process.env.DUPLICATE_RADIUS_METERS, 10) || 100;
    const confidenceThreshold = parseInt(process.env.DUPLICATE_CONFIDENCE_THRESHOLD, 10) || 80;

    /* --------------------------------------------------------
     * STEP A: FIND NEARBY CANDIDATES FOR DUPLICATE CHECKING
     * -------------------------------------------------------- */
    let candidates = [];

    if (mongoose.connection.readyState === 1) {
      const activeNearby = await Complaint.find({
        status: { $nin: ['Resolved', 'Rejected'] },
        category: cleanCategory
      });

      candidates = activeNearby.map(c => {
        const cLat = c.location ? c.location.latitude : null;
        const cLng = c.location ? c.location.longitude : null;
        const dist = calculateDistanceMeters(lat, lng, cLat, cLng);
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
          distanceMeters: dist,
          doc: c
        };
      }).filter(c => c.distanceMeters <= radiusMeters);
    } else {
      candidates = persistentStore.getComplaints()
        .filter(c => c.status !== 'Resolved' && c.status !== 'Rejected' && c.category === cleanCategory)
        .map(c => {
          const cLat = c.location ? c.location.latitude : null;
          const cLng = c.location ? c.location.longitude : null;
          const dist = calculateDistanceMeters(lat, lng, cLat, cLng);
          return {
            id: c.id,
            title: c.title,
            description: c.description,
            category: c.category,
            distanceMeters: dist,
            doc: c
          };
        })
        .filter(c => c.distanceMeters <= radiusMeters);
    }

    /* --------------------------------------------------------
     * STEP B: GEMINI SEMANTIC DUPLICATE EVALUATION
     * -------------------------------------------------------- */
    if (candidates.length > 0) {
      console.log(`ℹ️  [AI Check]: Found ${candidates.length} nearby candidate(s) within ${radiusMeters}m.`);
      
      const duplicateResult = await geminiService.checkDuplicateWithGemini(
        { title: cleanTitle, description: cleanDesc, category: cleanCategory },
        candidates
      );

      if (duplicateResult.isDuplicate && duplicateResult.confidence >= confidenceThreshold && duplicateResult.matchedComplaintId) {
        const matchedCandidate = candidates.find(c => c.id === duplicateResult.matchedComplaintId) || candidates[0];
        const existing = matchedCandidate.doc;

        const existingReporters = existing.reporters || [];
        const hasUserAlreadyReported = existingReporters.some(id => id && id.toString() === reporterId.toString());

        if (!hasUserAlreadyReported) {
          if (mongoose.connection.readyState === 1) {
            existing.reportCount = (existing.reportCount || 1) + 1;
            existing.reporters.push(reporterId);

            const updatedPriority = calculatePriority({
              dangerScore: existing.aiAnalysis ? existing.aiAnalysis.dangerScore : 50,
              reportCount: existing.reportCount,
              voteCount: existing.supporters ? existing.supporters.length : 0
            });
            existing.priority = updatedPriority;

            await existing.save();
            await User.findByIdAndUpdate(reporterId, { $inc: { rewardTokens: 2 } });
          } else {
            const reportCount = (existing.reportCount || 1) + 1;
            const reporters = [...(existing.reporters || []), reporterId];
            const updatedPriority = calculatePriority({
              dangerScore: existing.aiAnalysis ? existing.aiAnalysis.dangerScore : 50,
              reportCount,
              voteCount: existing.supporters ? existing.supporters.length : 0
            });

            persistentStore.updateComplaint(existing.id, {
              reportCount,
              reporters,
              priority: updatedPriority
            });
            persistentStore.incrementUserTokens(reporterId, 2);
          }
        }

        return res.status(200).json({
          success: true,
          duplicate: true,
          message: "Similar complaint already exists in this immediate area. Your report has been added to this existing issue.",
          complaintId: existing.id,
          reportCount: (existing.reportCount || 1),
          data: {
            id: existing.id,
            title: existing.title,
            category: existing.category,
            location: existing.location,
            reportCount: (existing.reportCount || 1),
            supportersCount: existing.supporters ? existing.supporters.length : 0,
            priority: existing.priority,
            aiAnalysis: existing.aiAnalysis,
            status: existing.status
          }
        });
      }
    }

    /* --------------------------------------------------------
     * STEP C: NEW COMPLAINT CREATION & GEMINI RISK ASSESSMENT
     * -------------------------------------------------------- */
    console.log('ℹ️  [AI Assessment]: Analyzing danger score with Google Gemini...');
    const aiAnalysis = await geminiService.analyzeComplaint({
      title: cleanTitle,
      category: cleanCategory,
      description: cleanDesc,
      image,
      latitude: lat,
      longitude: lng
    });

    const priority = calculatePriority({
      dangerScore: aiAnalysis.dangerScore,
      reportCount: 1,
      voteCount: 0
    });

    const nextId = await generateNextComplaintId();
    const todayStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const complaintData = {
      id: nextId,
      title: cleanTitle,
      category: cleanCategory,
      description: cleanDesc,
      location: {
        address: addr || `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        latitude: lat,
        longitude: lng,
        source: locSource,
        accuracy: locAccuracy,
        capturedAt: locCapturedAt ? locCapturedAt.toISOString() : null
      },
      severity: severity || "Medium",
      status: "Under Verification",
      verification: "Pending",
      photoSource: pSource,
      photoUploadedAt: pUploadedAt ? pUploadedAt.toISOString() : null,
      submittedAt: new Date().toISOString(),
      verificationNotes: "",
      verifiedAt: null,
      verifiedBy: "",
      verificationHistory: [],
      reportedBy: reporterId,
      reporterName: reporterName,
      reportCount: 1,
      reporters: [reporterId],
      supporters: [],
      aiAnalysis,
      priority,
      image: cleanImage,
      date: todayStr,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: "",
      isReviewed: false,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (mongoose.connection.readyState === 1) {
      const newDoc = await Complaint.create(complaintData);
      await User.findByIdAndUpdate(reporterId, { $inc: { rewardTokens: 5 } });

      const responseData = newDoc.toObject();
      responseData.supporters = 0;
      responseData.supportersCount = 0;
      responseData.voteCount = 0;

      // Broadcast real-time confirmation to Citizen who registered it
      notificationService.broadcastComplaintRegistered(responseData);
      // Broadcast real-time notification to Authority Portal
      notificationService.broadcastNewComplaint(responseData);

      return res.status(201).json({
        success: true,
        duplicate: false,
        source: "MongoDB Atlas",
        message: `Complaint ${newDoc.id} registered successfully! (Priority: ${priority.level}, Danger: ${aiAnalysis.dangerLevel})`,
        data: responseData
      });
    } else {
      // Persistent Store
      persistentStore.addComplaint(complaintData);
      persistentStore.incrementUserTokens(reporterId, 5);

      // Broadcast real-time confirmation to Citizen who registered it
      notificationService.broadcastComplaintRegistered(complaintData);
      // Broadcast real-time notification to Authority Portal
      notificationService.broadcastNewComplaint(complaintData);

      return res.status(201).json({
        success: true,
        duplicate: false,
        source: "Persistent Store",
        message: `Complaint ${complaintData.id} registered successfully!`,
        data: {
          ...complaintData,
          supporters: 0,
          supportersCount: 0,
          voteCount: 0
        }
      });
    }
  } catch (error) {
    console.error('Error in createComplaint:', error);
    res.status(500).json({
      success: false,
      message: "Server error while processing complaint",
      error: error.message
    });
  }
};


/**
 * 5. POST /api/complaints/:id/vote (or /support)
 * Community Endorsement Voting - 1 vote per citizen, dynamically recalculates priority
 */
exports.supportComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;

    if (mongoose.connection.readyState === 1) {
      const complaint = await Complaint.findOne({
        id: { $regex: new RegExp(`^${id}$`, 'i') }
      });

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      const alreadyVoted = complaint.supporters.some(
        supporterId => supporterId.toString() === userId.toString()
      );

      if (alreadyVoted) {
        return res.status(400).json({
          success: false,
          message: "You have already endorsed this complaint. Each citizen can vote once.",
          alreadySupported: true,
          voteCount: complaint.supporters.length,
          supportersCount: complaint.supporters.length
        });
      }

      complaint.supporters.push(userId);

      const updatedPriority = calculatePriority({
        dangerScore: complaint.aiAnalysis ? complaint.aiAnalysis.dangerScore : 50,
        reportCount: complaint.reportCount || 1,
        voteCount: complaint.supporters.length
      });
      complaint.priority = updatedPriority;

      await complaint.save();
      await User.findByIdAndUpdate(userId, { $inc: { rewardTokens: 1 } });

      return res.status(200).json({
        success: true,
        source: "MongoDB Atlas",
        message: `Endorsement recorded! Priority updated to ${updatedPriority.level} (${updatedPriority.score}/100)`,
        voteCount: complaint.supporters.length,
        supportersCount: complaint.supporters.length,
        priority: updatedPriority,
        alreadySupported: true,
        data: complaint
      });
    } else {
      const complaint = persistentStore.findComplaintById(id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      if (!Array.isArray(complaint.supporters)) complaint.supporters = [];

      if (complaint.supporters.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: "You have already endorsed this complaint.",
          alreadySupported: true,
          voteCount: complaint.supporters.length,
          supportersCount: complaint.supporters.length
        });
      }

      complaint.supporters.push(userId);

      const updatedPriority = calculatePriority({
        dangerScore: complaint.aiAnalysis ? complaint.aiAnalysis.dangerScore : 50,
        reportCount: complaint.reportCount || 1,
        voteCount: complaint.supporters.length
      });
      complaint.priority = updatedPriority;

      persistentStore.updateComplaint(complaint.id, {
        supporters: complaint.supporters,
        priority: updatedPriority
      });
      persistentStore.incrementUserTokens(userId, 1);

      return res.status(200).json({
        success: true,
        source: "Persistent Store",
        message: `Endorsement recorded! Priority updated to ${updatedPriority.level} (${updatedPriority.score}/100)`,
        voteCount: complaint.supporters.length,
        supportersCount: complaint.supporters.length,
        priority: updatedPriority,
        alreadySupported: true,
        data: complaint
      });
    }
  } catch (error) {
    console.error('Error in supportComplaint:', error);
    res.status(500).json({
      success: false,
      message: "Database error while registering endorsement",
      error: error.message
    });
  }
};

exports.voteComplaint = exports.supportComplaint;


/**
 * 6. POST /api/complaints/:id/reanalyze
 * Admin-Only: Re-runs Google Gemini AI risk assessment and recalculates priority
 */
exports.reanalyzeComplaint = async (req, res) => {
  try {
    const { id } = req.params;

    let complaint = null;
    if (mongoose.connection.readyState === 1) {
      complaint = await Complaint.findOne({ id: { $regex: new RegExp(`^${id}$`, 'i') } });
    } else {
      complaint = persistentStore.findComplaintById(id);
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    const lat = complaint.location ? complaint.location.latitude : 20.5937;
    const lng = complaint.location ? complaint.location.longitude : 78.9629;

    const freshAnalysis = await geminiService.analyzeComplaint({
      title: complaint.title,
      category: complaint.category,
      description: complaint.description,
      image: complaint.image,
      latitude: lat,
      longitude: lng
    });

    complaint.aiAnalysis = freshAnalysis;

    const voteCount = Array.isArray(complaint.supporters) ? complaint.supporters.length : 0;
    complaint.priority = calculatePriority({
      dangerScore: freshAnalysis.dangerScore,
      reportCount: complaint.reportCount || 1,
      voteCount
    });

    if (mongoose.connection.readyState === 1) {
      await complaint.save();
    } else {
      persistentStore.updateComplaint(complaint.id, {
        aiAnalysis: freshAnalysis,
        priority: complaint.priority
      });
    }

    return res.status(200).json({
      success: true,
      message: `Complaint ${complaint.id} re-analyzed by Gemini AI. Danger Score: ${freshAnalysis.dangerScore}/100`,
      data: complaint
    });
  } catch (error) {
    console.error('Error in reanalyzeComplaint:', error);
    res.status(500).json({
      success: false,
      message: "Error running Gemini re-analysis",
      error: error.message
    });
  }
};


/**
 * 7. PATCH /api/complaints/:id/status AND /api/admin/complaints/:id/status
 * Admin-Only: Transition complaint status and record audit log
 */
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolvedBy, resolvedNote, note, assignedOfficial, internalNotes, internalNote, verification } = req.body;

    const ALLOWED_STATUSES = [
      "Reported",
      "Under Verification",
      "In Progress",
      "Resolved",
      "Rejected"
    ];

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}`
      });
    }

    const adminName = req.user.name || "Civic Authority Officer";

    if (mongoose.connection.readyState === 1) {
      const complaint = await Complaint.findOne({
        id: { $regex: new RegExp(`^${id}$`, 'i') }
      });

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      if (status) {
        complaint.status = status;

        if (status === "Resolved") {
          complaint.verification = "Verified";
          complaint.resolvedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          complaint.resolvedBy = resolvedBy || `${adminName} (Ward Operations)`;
          if (resolvedNote && resolvedNote.trim()) {
            complaint.resolutionNote = resolvedNote.trim();
          } else if (note && note.trim()) {
            complaint.resolutionNote = note.trim();
          } else if (!complaint.resolutionNote) {
            complaint.resolutionNote = "Hazard inspected and road surface restored by municipal crew.";
          }
        } else if (status === "Rejected") {
          complaint.verification = "Rejected";
        } else if (status === "In Progress" || status === "Under Verification") {
          complaint.verification = "Verified";
        }
      }

      if (verification && ['Pending', 'Verified', 'Rejected'].includes(verification)) {
        complaint.verification = verification;
      }
      if (assignedOfficial !== undefined) {
        complaint.assignedOfficial = assignedOfficial.trim();
      }
      if (internalNotes !== undefined) {
        complaint.internalNotes = internalNotes.trim();
      } else if (internalNote !== undefined) {
        complaint.internalNotes = internalNote.trim();
      }

      complaint.isReviewed = true;
      complaint.reviewedAt = new Date();

      await complaint.save();

      const item = complaint.toObject();
      item.supportersCount = Array.isArray(item.supporters) ? item.supporters.length : 0;
      item.supporters = item.supportersCount;
      item.voteCount = item.supportersCount;

      // Broadcast real-time notification to Citizen Portal
      if (status === 'Resolved') {
        notificationService.broadcastComplaintResolved(item);
      } else if (status) {
        notificationService.broadcastStatusUpdate(item, status);
      }

      if (assignedOfficial && assignedOfficial.trim()) {
        notificationService.broadcastOfficialAssigned(item, assignedOfficial.trim());
      }

      return res.status(200).json({
        success: true,
        source: "MongoDB Atlas",
        message: `Complaint ${complaint.id} updated successfully by Authority ${adminName}`,
        data: item
      });
    } else {
      // Persistent Store
      const complaint = persistentStore.findComplaintById(id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      const updates = {
        isReviewed: true,
        reviewedAt: new Date().toISOString()
      };
      if (status) {
        updates.status = status;
        if (status === "Resolved") {
          updates.verification = "Verified";
          updates.resolvedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          updates.resolvedBy = resolvedBy || `${adminName} (Ward Operations)`;
          updates.resolutionNote = (resolvedNote && resolvedNote.trim()) || (note && note.trim()) || complaint.resolutionNote || "Hazard inspected and repaired.";
        } else if (status === "Rejected") {
          updates.verification = "Rejected";
        } else if (status === "In Progress" || status === "Under Verification") {
          updates.verification = "Verified";
        }
      }

      if (verification && ['Pending', 'Verified', 'Rejected'].includes(verification)) {
        updates.verification = verification;
      }
      if (assignedOfficial !== undefined) {
        updates.assignedOfficial = assignedOfficial.trim();
      }
      if (internalNotes !== undefined) {
        updates.internalNotes = internalNotes.trim();
      } else if (internalNote !== undefined) {
        updates.internalNotes = internalNote.trim();
      }

      const saved = persistentStore.updateComplaint(id, updates);
      const item = {
        ...saved,
        supportersCount: Array.isArray(saved.supporters) ? saved.supporters.length : 0,
        supporters: Array.isArray(saved.supporters) ? saved.supporters.length : (saved.supporters || 0),
        voteCount: Array.isArray(saved.supporters) ? saved.supporters.length : 0
      };

      // Broadcast real-time notification to Citizen Portal
      if (status === 'Resolved') {
        notificationService.broadcastComplaintResolved(item);
      } else if (status) {
        notificationService.broadcastStatusUpdate(item, status);
      }

      if (assignedOfficial && assignedOfficial.trim()) {
        notificationService.broadcastOfficialAssigned(item, assignedOfficial.trim());
      }

      return res.status(200).json({
        success: true,
        source: "Persistent Store",
        message: `Complaint ${saved.id} updated successfully`,
        data: item
      });
    }
  } catch (error) {
    console.error('Error in updateComplaintStatus:', error);
    res.status(500).json({
      success: false,
      message: "Database error while updating complaint status",
      error: error.message
    });
  }
};


/**
 * 8. PATCH /api/complaints/:id/priority AND /api/admin/complaints/:id/priority
 * Admin-Only: Updates complaint priority level and/or severity
 */
exports.updateComplaintPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priorityLevel, priorityScore, severity } = req.body;

    if (!priorityLevel && priorityScore === undefined && !severity) {
      return res.status(400).json({
        success: false,
        message: "Please provide priorityLevel, priorityScore, or severity to update"
      });
    }

    if (mongoose.connection.readyState === 1) {
      const complaint = await Complaint.findOne({ id: { $regex: new RegExp(`^${id}$`, 'i') } });
      if (!complaint) {
        return res.status(404).json({ success: false, message: "Complaint not found" });
      }

      if (severity) complaint.severity = severity;
      if (!complaint.priority) complaint.priority = {};
      if (priorityLevel) complaint.priority.level = priorityLevel;
      if (priorityScore !== undefined) complaint.priority.score = parseInt(priorityScore, 10);
      complaint.priority.calculatedAt = new Date();
      complaint.isReviewed = true;
      complaint.reviewedAt = new Date();

      await complaint.save();

      // Broadcast real-time priority update to citizen
      notificationService.broadcastPriorityUpdated(complaint.toObject(), priorityLevel || complaint.priority.level);

      return res.status(200).json({
        success: true,
        source: "MongoDB Atlas",
        message: `Complaint ${complaint.id} priority updated`,
        data: complaint
      });
    } else {
      const complaint = persistentStore.findComplaintById(id);
      if (!complaint) {
        return res.status(404).json({ success: false, message: "Complaint not found" });
      }

      const updates = {
        isReviewed: true,
        reviewedAt: new Date().toISOString()
      };
      if (severity) updates.severity = severity;
      const updatedPriority = { ...(complaint.priority || {}) };
      if (priorityLevel) updatedPriority.level = priorityLevel;
      if (priorityScore !== undefined) updatedPriority.score = parseInt(priorityScore, 10);
      updatedPriority.calculatedAt = new Date();
      updates.priority = updatedPriority;

      const saved = persistentStore.updateComplaint(id, updates);

      // Broadcast real-time priority update to citizen
      notificationService.broadcastPriorityUpdated(saved, priorityLevel || (saved.priority && saved.priority.level));

      return res.status(200).json({
        success: true,
        source: "Persistent Store",
        message: `Complaint ${saved.id} priority updated`,
        data: saved
      });
    }
  } catch (err) {
    console.error('Error in updateComplaintPriority:', err);
    res.status(500).json({ success: false, message: "Failed to update priority", error: err.message });
  }
};


/**
 * 9. GET /api/admin/complaints
 * Admin-Only: Retrieve all complaints with full administrative details
 */
exports.getAdminComplaints = async (req, res) => {
  return exports.getAllComplaints(req, res);
};


/**
 * 10. GET /api/admin/dashboard
 * Admin-Only: Retrieve real aggregated dashboard statistics from persistent database
 */
exports.getAdminDashboardStats = async (req, res) => {
  try {
    let complaintsList = [];
    if (mongoose.connection.readyState === 1) {
      complaintsList = await Complaint.find({}).lean();
    } else {
      complaintsList = persistentStore.getComplaints();
    }

    const total = complaintsList.length;
    const underVerification = complaintsList.filter(c => c.status === 'Under Verification' || c.status === 'Reported').length;
    const verified = complaintsList.filter(c => c.verification === 'Verified').length;
    const inProgress = complaintsList.filter(c => c.status === 'In Progress').length;
    const resolved = complaintsList.filter(c => c.status === 'Resolved').length;
    const rejected = complaintsList.filter(c => c.status === 'Rejected').length;
    const critical = complaintsList.filter(c => (c.priority && (c.priority.level === 'Critical' || c.priority.level === 'CRITICAL')) || c.severity === 'Critical').length;
    const high = complaintsList.filter(c => (c.priority && (c.priority.level === 'High' || c.priority.level === 'HIGH')) || c.severity === 'High').length;

    // Registered Users
    let usersList = [];
    if (mongoose.connection.readyState === 1) {
      usersList = await User.find({}, '-password').lean();
    } else {
      usersList = persistentStore.getUsers().map(u => ({
        id: u.id,
        _id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        rewardTokens: u.rewardTokens || 0,
        status: u.status || 'Active',
        flaggedReason: u.flaggedReason || ''
      }));
    }

    const userStats = usersList.map(u => {
      const uId = (u._id || u.id).toString();
      const uAltId = (u.id || u._id).toString();
      const userComplaints = complaintsList.filter(c => {
        const rep = (c.reportedBy && c.reportedBy._id) ? c.reportedBy._id.toString() : (c.reportedBy ? c.reportedBy.toString() : '');
        return rep === uId || rep === uAltId ||
               (c.reporters && c.reporters.map(r => r.toString()).some(r => r === uId || r === uAltId));
      });
      return {
        id: u.id || u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        tokens: u.rewardTokens || 0,
        reported: userComplaints.length,
        resolved: userComplaints.filter(c => c.status === 'Resolved').length,
        status: u.status || 'Active',
        flaggedReason: u.flaggedReason || ''
      };
    });

    // Category breakdown
    const categoryCounts = {};
    complaintsList.forEach(c => {
      const cat = c.category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      stats: {
        total,
        pending: underVerification,
        underVerification,
        verified,
        inProgress,
        resolved,
        rejected,
        critical,
        high,
        categories: categoryCounts
      },
      users: userStats
    });
  } catch (err) {
    console.error('Error in getAdminDashboardStats:', err);
    res.status(500).json({ success: false, message: "Failed to load admin statistics", error: err.message });
  }
};

/**
 * PATCH /api/admin/users/:id/flag
 * Admin / Municipal Authority flags a citizen account for false/spam complaint
 */
exports.flagUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, penaltyTokens } = req.body;
    let updatedUser = null;

    if (mongoose.connection.readyState === 1) {
      const u = await User.findById(id);
      if (!u) {
        return res.status(404).json({ success: false, message: 'Citizen profile not found' });
      }
      u.status = status || (u.status === 'Flagged' ? 'Active' : 'Flagged');
      if (reason) u.flaggedReason = reason;
      if (penaltyTokens && u.rewardTokens) {
        u.rewardTokens = Math.max(0, u.rewardTokens - Number(penaltyTokens));
      }
      await u.save();
      updatedUser = {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        status: u.status,
        tokens: u.rewardTokens,
        flaggedReason: u.flaggedReason
      };
    } else {
      const u = persistentStore.findUserById(id);
      if (!u) {
        return res.status(404).json({ success: false, message: 'Citizen profile not found' });
      }
      const newStatus = status || (u.status === 'Flagged' ? 'Active' : 'Flagged');
      let newTokens = u.rewardTokens || 0;
      if (penaltyTokens) {
        newTokens = Math.max(0, newTokens - Number(penaltyTokens));
      }
      const updated = persistentStore.updateUser(id, {
        status: newStatus,
        flaggedReason: reason || u.flaggedReason || '',
        rewardTokens: newTokens
      });
      updatedUser = {
        id: updated.id || updated._id,
        name: updated.name,
        email: updated.email,
        status: updated.status,
        tokens: updated.rewardTokens,
        flaggedReason: updated.flaggedReason
      };
    }

    return res.status(200).json({
      success: true,
      message: `Citizen account updated to ${updatedUser.status}`,
      user: updatedUser
    });
  } catch (err) {
    console.error('Error in flagUser:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


/**
 * 11. POST /api/complaints/:id/reminder
 * Citizen-Action: Send municipal reminder / escalation for pending complaint
 */
exports.sendReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, note } = req.body || {};

    let complaint = null;
    if (mongoose.connection.readyState === 1) {
      complaint = await Complaint.findOne({ id: { $regex: new RegExp(`^${id}$`, 'i') } });
      if (!complaint) {
        return res.status(404).json({ success: false, message: "Complaint not found" });
      }
      complaint.remindersCount = (complaint.remindersCount || 0) + 1;
      complaint.lastReminderAt = new Date().toISOString();
      await complaint.save();
    } else {
      complaint = persistentStore.findComplaintById(id);
      if (!complaint) {
        return res.status(404).json({ success: false, message: "Complaint not found" });
      }
      complaint = persistentStore.updateComplaint(complaint.id, {
        remindersCount: (complaint.remindersCount || 0) + 1,
        lastReminderAt: new Date().toISOString(),
        lastReminderReason: reason || 'Municipal follow-up requested by citizen',
        lastReminderNote: note || ''
      });
    }

    const citizenName = (req.user && req.user.name) || complaint.reporterName || 'Citizen';
    notificationService.broadcastCitizenReminder(complaint, reason, note, citizenName);

    return res.status(200).json({
      success: true,
      message: `Municipal reminder sent for ${complaint.id}. Escalated to Ward Public Works supervisor.`,
      data: {
        id: complaint.id,
        remindersCount: complaint.remindersCount,
        lastReminderAt: complaint.lastReminderAt
      }
    });
  } catch (error) {
    console.error('Error in sendReminder:', error);
    res.status(500).json({
      success: false,
      message: "Error sending municipal reminder",
      error: error.message
    });
  }
};


/**
 * 12. POST /api/complaints/:id/feedback
 * Citizen Rating & Resolution Feedback
 */
exports.submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment, category } = req.body || {};
    const feedbackRecord = {
      id: id || 'general',
      rating: Number(rating) || 5,
      comment: (comment || '').trim(),
      category: category || 'Overall Service',
      submittedAt: new Date().toISOString()
    };

    if (id && id !== 'general') {
      if (mongoose.connection.readyState === 1) {
        await Complaint.findOneAndUpdate(
          { id: { $regex: new RegExp(`^${id}$`, 'i') } },
          { $push: { feedback: feedbackRecord } }
        );
      } else {
        const c = persistentStore.findComplaintById(id);
        if (c) {
          if (!Array.isArray(c.feedback)) c.feedback = [];
          c.feedback.push(feedbackRecord);
          if (typeof persistentStore.save === 'function') persistentStore.save();
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Citizen feedback and resolution rating recorded successfully.',
      data: feedbackRecord
    });
  } catch (error) {
    console.error('Error in submitFeedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving feedback',
      error: error.message
    });
  }
};


/**
 * 13. PATCH /api/complaints/:id/verify AND /api/admin/complaints/:id/verify
 * Municipal Authority Location & Evidence Verification Action
 */
exports.verifyComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { verification, notes, reason, action } = req.body;

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: "Verification status is required (Verified, Needs Inspection, Insufficient Evidence, Rejected)"
      });
    }

    // Normalize verification status
    const normMap = {
      'verified': 'Verified',
      'needs inspection': 'Needs Inspection',
      'needs_inspection': 'Needs Inspection',
      'insufficient evidence': 'Insufficient Evidence',
      'insufficient_evidence': 'Insufficient Evidence',
      'rejected': 'Rejected',
      'pending': 'Pending'
    };

    const normalizedVerification = normMap[verification.toString().trim().toLowerCase()] || verification.toString().trim();
    const VALID_VERIFICATIONS = ['Verified', 'Needs Inspection', 'Insufficient Evidence', 'Rejected', 'Pending'];

    if (!VALID_VERIFICATIONS.includes(normalizedVerification)) {
      return res.status(400).json({
        success: false,
        message: `Invalid verification status "${verification}". Allowed: Verified, Needs Inspection, Insufficient Evidence, Rejected, Pending`
      });
    }

    const reviewNotes = (notes || reason || '').trim();

    // Rejection requires a mandatory reason
    if (normalizedVerification === 'Rejected' && (!reviewNotes || reviewNotes.length < 5)) {
      return res.status(400).json({
        success: false,
        message: "A mandatory rejection reason (at least 5 characters) is required when rejecting a complaint."
      });
    }

    const authorityUser = req.user || {};
    const authorityName = authorityUser.name || "Municipal Authority";
    const authorityId = (authorityUser.id || authorityUser._id || '').toString();
    const authorityRole = authorityUser.role || 'authority';

    let actionLabel = action || '';
    if (!actionLabel) {
      if (normalizedVerification === 'Verified') actionLabel = 'Evidence Verified';
      else if (normalizedVerification === 'Needs Inspection') actionLabel = 'Marked for Field Inspection';
      else if (normalizedVerification === 'Insufficient Evidence') actionLabel = 'Flagged Insufficient Evidence';
      else if (normalizedVerification === 'Rejected') actionLabel = 'Complaint Verification Rejected';
      else actionLabel = `Verification updated to ${normalizedVerification}`;
    }

    const historyEntry = {
      action: actionLabel,
      status: normalizedVerification,
      authorityId,
      authorityName,
      notes: reviewNotes,
      timestamp: new Date().toISOString()
    };

    let updatedComplaint = null;

    if (mongoose.connection.readyState === 1) {
      const complaint = await Complaint.findOne({
        id: { $regex: new RegExp(`^${id}$`, 'i') }
      });

      if (!complaint) {
        return res.status(404).json({ success: false, message: "Complaint not found" });
      }

      complaint.verification = normalizedVerification;
      complaint.verificationNotes = reviewNotes;
      complaint.verifiedAt = new Date();
      complaint.verifiedBy = `${authorityName} (${authorityRole})`;
      complaint.isReviewed = true;
      complaint.reviewedAt = new Date();
      if (!Array.isArray(complaint.verificationHistory)) {
        complaint.verificationHistory = [];
      }
      complaint.verificationHistory.push(historyEntry);

      await complaint.save();
      updatedComplaint = complaint.toObject();
    } else {
      // Persistent Store
      const complaint = persistentStore.findComplaintById(id);
      if (!complaint) {
        return res.status(404).json({ success: false, message: "Complaint not found" });
      }

      const existingHistory = Array.isArray(complaint.verificationHistory) ? [...complaint.verificationHistory] : [];
      existingHistory.push(historyEntry);

      const updates = {
        verification: normalizedVerification,
        verificationNotes: reviewNotes,
        verifiedAt: new Date().toISOString(),
        verifiedBy: `${authorityName} (${authorityRole})`,
        isReviewed: true,
        reviewedAt: new Date().toISOString(),
        verificationHistory: existingHistory
      };

      updatedComplaint = persistentStore.updateComplaint(id, updates);
    }

    // Broadcast real-time verification notification to citizen
    notificationService.broadcastVerificationUpdate(updatedComplaint, normalizedVerification, reviewNotes);

    return res.status(200).json({
      success: true,
      message: `Complaint ${updatedComplaint.id} verification set to ${normalizedVerification}`,
      data: updatedComplaint
    });
  } catch (error) {
    console.error('Error in verifyComplaint:', error);
    res.status(500).json({
      success: false,
      message: "Server error during complaint verification",
      error: error.message
    });
  }
};


/**
 * 14. PATCH /api/complaints/:id/review AND /api/admin/complaints/:id/review
 * Admin-Only: Mark a complaint as reviewed, removing the "NEW" badge
 */
exports.markComplaintReviewed = async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState === 1) {
      const complaint = await Complaint.findOneAndUpdate(
        { id: { $regex: new RegExp(`^${id}$`, 'i') } },
        { isReviewed: true, reviewedAt: new Date() },
        { new: true }
      );
      if (!complaint) {
        return res.status(404).json({ success: false, message: "Complaint not found" });
      }
      return res.status(200).json({
        success: true,
        message: `Complaint ${complaint.id} marked as reviewed`,
        data: complaint
      });
    } else {
      const updated = persistentStore.markComplaintReviewed(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: "Complaint not found" });
      }
      return res.status(200).json({
        success: true,
        message: `Complaint ${updated.id} marked as reviewed`,
        data: updated
      });
    }
  } catch (err) {
    console.error('Error in markComplaintReviewed:', err);
    res.status(500).json({
      success: false,
      message: "Server error marking complaint reviewed",
      error: err.message
    });
  }
};



