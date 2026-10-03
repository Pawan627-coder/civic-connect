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
const { calculatePriority, calculateDistanceMeters } = require('../utils/priorityCalculator');

// Seed complaints with realistic geographic coordinates across Indian urban hubs
const INITIAL_SEED_REPORTS = [
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
    reporterName: "Civic Citizen",
    reportCount: 3,
    image: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80",
    supporters: [],
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
    resolutionNote: ""
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
    reporterName: "Rahul Verma",
    reportCount: 1,
    image: "",
    supporters: [],
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
    resolutionNote: ""
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
    reporterName: "Pooja Sharma",
    reportCount: 5,
    image: "https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=600&auto=format&fit=crop&q=80",
    supporters: [],
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
    resolutionNote: ""
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
    reporterName: "Anil Kumar",
    reportCount: 4,
    image: "",
    supporters: [],
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
    resolutionNote: ""
  },
  {
    id: "CC-1005",
    title: "Uncollected roadside municipal garbage dump",
    category: "Garbage/Waste",
    description: "Community solid waste bin overflowing for 5 consecutive days. Stray animals scattering trash onto active two-lane roadway.",
    location: {
      address: "Road No 12, Banjara Hills, Hyderabad, Telangana",
      latitude: 17.4156,
      longitude: 78.4350
    },
    date: "29 Sep 2026",
    severity: "Medium",
    status: "Reported",
    verification: "Pending",
    reporterName: "Sunita Reddy",
    reportCount: 2,
    image: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop&q=80",
    supporters: [],
    aiAnalysis: {
      dangerLevel: "Low",
      dangerScore: 30,
      reason: "Solid waste overflow on sidewalk without active structural blockage.",
      keywords: ["garbage", "waste", "sidewalk"],
      duplicateConfidence: 0
    },
    priority: {
      level: "Low",
      score: 28,
      dangerScore: 30,
      communityScore: 25
    },
    resolvedDate: "",
    resolvedBy: "",
    resolutionNote: ""
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
    reporterName: "Karthik Raja",
    reportCount: 8,
    image: "",
    supporters: [],
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
    resolutionNote: "Electronic controller motherboard replaced and signal timer sequence calibrated."
  },
  {
    id: "CC-1007",
    title: "Caved-in storm drainage slab near bus shelter",
    category: "Road/Pothole",
    description: "Reinforced drain slab fractured under heavy bus weight. Open pit created directly in the boarding queue area.",
    location: {
      address: "Civil Lines Bus Terminal, Kanpur, UP",
      latitude: 26.4725,
      longitude: 80.3456
    },
    date: "27 Sep 2026",
    severity: "High",
    status: "Resolved",
    verification: "Verified",
    reporterName: "Manoj Tiwari",
    reportCount: 6,
    image: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=600&auto=format&fit=crop&q=80",
    supporters: [],
    aiAnalysis: {
      dangerLevel: "High",
      dangerScore: 74,
      reason: "Fractured concrete drainage cover in pedestrian boarding zone presents severe limb hazard.",
      keywords: ["manhole", "slab", "drainage"],
      duplicateConfidence: 0
    },
    priority: {
      level: "High",
      score: 74,
      dangerScore: 74,
      communityScore: 74
    },
    resolvedDate: "30 Sep 2026",
    resolvedBy: "Public Works Admin",
    resolutionNote: "Pre-cast heavy duty RCC slab installed and perimeter grouted flush with pavement."
  },
  {
    id: "CC-1008",
    title: "Severe waterlogging blocking railway subway underpass",
    category: "Waterlogging",
    description: "Stormwater runoff accumulated to 2.5 feet depth due to silted intake grates. Two-wheelers and sedans completely halted.",
    location: {
      address: "Shivaji Nagar Railway Underpass, Pune, Maharashtra",
      latitude: 18.5314,
      longitude: 73.8446
    },
    date: "02 Oct 2026",
    severity: "High",
    status: "In Progress",
    verification: "Verified",
    reporterName: "Meera Deshmukh",
    reportCount: 3,
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
    supporters: [],
    aiAnalysis: {
      dangerLevel: "High",
      dangerScore: 70,
      reason: "2.5ft stagnant floodwaters submerging vehicle intake exhausts under low-visibility subway.",
      keywords: ["waterlogging", "subway", "flooding"],
      duplicateConfidence: 0
    },
    priority: {
      level: "High",
      score: 64,
      dangerScore: 70,
      communityScore: 54
    },
    resolvedDate: "",
    resolvedBy: "",
    resolutionNote: ""
  }
];

// In-Memory store for offline fallback mode
let inMemoryComplaints = INITIAL_SEED_REPORTS.map((r, i) => ({
  ...r,
  reportedBy: `user_seed_${i}`,
  reporters: [`user_seed_${i}`],
  supporters: []
}));

/**
 * Helper: Find or create default citizen account for initial seed reports
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
    inMemoryComplaints.forEach(c => {
      const match = c.id.match(/^CC-(\d+)$/);
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
    const { category, status, priority, danger } = req.query;

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

      // Sort by priority score descending by default
      const complaints = await Complaint.find(filter)
        .populate('reportedBy', 'name')
        .sort({ 'priority.score': -1, createdAt: -1 });

      const sanitized = complaints.map(doc => {
        const item = doc.toObject();
        item.supportersCount = Array.isArray(item.supporters) ? item.supporters.length : 0;
        item.voteCount = item.supportersCount;
        item.supporters = item.supportersCount;
        item.reportCount = item.reportCount || 1;
        item.reportedBy = item.reporterName || (doc.reportedBy && doc.reportedBy.name) || 'Civic User';
        return item;
      });

      return res.status(200).json({
        success: true,
        source: "MongoDB Atlas",
        count: sanitized.length,
        data: sanitized
      });
    } else {
      // In-Memory Fallback
      let result = [...inMemoryComplaints];

      if (category && category !== 'all') {
        result = result.filter(c => c.category.toLowerCase() === category.toLowerCase());
      }
      if (status && status !== 'all') {
        result = result.filter(c => c.status.toLowerCase() === status.toLowerCase());
      }
      if (priority && priority !== 'all') {
        result = result.filter(c => c.priority && c.priority.level.toLowerCase() === priority.toLowerCase());
      }
      if (danger && danger !== 'all') {
        result = result.filter(c => c.aiAnalysis && c.aiAnalysis.dangerLevel.toLowerCase() === danger.toLowerCase());
      }

      result.sort((a, b) => ((b.priority && b.priority.score) || 0) - ((a.priority && a.priority.score) || 0));

      const formatted = result.map(c => ({
        ...c,
        supportersCount: Array.isArray(c.supporters) ? c.supporters.length : 0,
        voteCount: Array.isArray(c.supporters) ? c.supporters.length : 0,
        supporters: Array.isArray(c.supporters) ? c.supporters.length : (c.supporters || 0),
        reportCount: c.reportCount || 1,
        reportedBy: c.reporterName || 'Civic User'
      }));

      return res.status(200).json({
        success: true,
        source: "In-Memory Fallback",
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
 * 2. GET /api/complaints/mine
 * Private personal feed of reports submitted by the logged-in citizen
 */
exports.getMyComplaints = async (req, res) => {
  try {
    const userId = req.user.id;

    if (mongoose.connection.readyState === 1) {
      const myComplaints = await Complaint.find({
        $or: [
          { reportedBy: userId },
          { reporters: userId }
        ]
      }).sort({ createdAt: -1 });

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
      const userComplaints = inMemoryComplaints.filter(
        c => c.reportedBy === userId || (c.reporters && c.reporters.includes(userId)) || c.reporterName === req.user.name
      );

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
        source: "In-Memory Fallback",
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
      const complaint = inMemoryComplaints.find(c => c.id.toLowerCase() === id.toLowerCase());
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      return res.status(200).json({
        success: true,
        source: "In-Memory Fallback",
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
    const { title, category, description, severity, image, location, latitude, longitude, address } = req.body;

    // Validate required fields
    if (!title || !category || !description) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, category, description"
      });
    }

    // Extract coordinates safely
    let lat = null;
    let lng = null;
    let addr = "";

    if (location && typeof location === 'object') {
      lat = parseFloat(location.latitude);
      lng = parseFloat(location.longitude);
      addr = location.address || "";
    } else {
      lat = parseFloat(latitude);
      lng = parseFloat(longitude);
      addr = address || (typeof location === 'string' ? location : "");
    }

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude coordinates are required for hazard mapping and duplicate checking."
      });
    }

    const reporterId = req.user.id;
    const reporterName = req.user.name;
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
      // Find unresolved complaints in similar category
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
      // In-Memory candidates filter
      candidates = inMemoryComplaints
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
      console.log(`ℹ️  [AI Check]: Found ${candidates.length} nearby complaint candidate(s) within ${radiusMeters}m. Analyzing with Gemini...`);
      
      const duplicateResult = await geminiService.checkDuplicateWithGemini(
        { title: cleanTitle, description: cleanDesc, category: cleanCategory },
        candidates
      );

      console.log(`[AI Result]: Duplicate=${duplicateResult.isDuplicate}, Confidence=${duplicateResult.confidence}%, Matched=${duplicateResult.matchedComplaintId}`);

      if (duplicateResult.isDuplicate && duplicateResult.confidence >= confidenceThreshold && duplicateResult.matchedComplaintId) {
        const matchedCandidate = candidates.find(c => c.id === duplicateResult.matchedComplaintId) || candidates[0];
        const existing = matchedCandidate.doc;

        // Check if user already reported this problem
        const existingReporters = existing.reporters || [];
        const hasUserAlreadyReported = existingReporters.some(id => id && id.toString() === reporterId.toString());

        if (!hasUserAlreadyReported) {
          if (mongoose.connection.readyState === 1) {
            existing.reportCount = (existing.reportCount || 1) + 1;
            existing.reporters.push(reporterId);

            // Recalculate priority with increased reportCount
            const updatedPriority = calculatePriority({
              dangerScore: existing.aiAnalysis ? existing.aiAnalysis.dangerScore : 50,
              reportCount: existing.reportCount,
              voteCount: existing.supporters ? existing.supporters.length : 0
            });
            existing.priority = updatedPriority;

            await existing.save();

            // Reward citizen 2 tokens for corroborating an existing civic problem
            await User.findByIdAndUpdate(reporterId, { $inc: { rewardTokens: 2 } });
          } else {
            existing.reportCount = (existing.reportCount || 1) + 1;
            if (!existing.reporters) existing.reporters = [];
            existing.reporters.push(reporterId);

            existing.priority = calculatePriority({
              dangerScore: existing.aiAnalysis ? existing.aiAnalysis.dangerScore : 50,
              reportCount: existing.reportCount,
              voteCount: existing.supporters ? existing.supporters.length : 0
            });
          }
        }

        return res.status(200).json({
          success: true,
          duplicate: true,
          message: "Similar complaint already exists in this immediate area. Your report has been added to this existing issue.",
          complaintId: existing.id,
          reportCount: existing.reportCount,
          data: {
            id: existing.id,
            title: existing.title,
            category: existing.category,
            location: existing.location,
            reportCount: existing.reportCount,
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

    // Calculate transparent priority formula
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
        longitude: lng
      },
      severity: severity || "Medium",
      status: "Reported",
      verification: "Pending",
      reportedBy: reporterId,
      reporterName: reporterName,
      reportCount: 1,
      reporters: [reporterId],
      supporters: [],
      aiAnalysis,
      priority,
      image: image ? image.trim() : "",
      date: todayStr,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    };

    if (mongoose.connection.readyState === 1) {
      const newDoc = await Complaint.create(complaintData);

      // Reward citizen with 5 Civic Tokens for filing a new report
      await User.findByIdAndUpdate(reporterId, { $inc: { rewardTokens: 5 } });

      const responseData = newDoc.toObject();
      responseData.supporters = 0;
      responseData.supportersCount = 0;
      responseData.voteCount = 0;

      return res.status(201).json({
        success: true,
        duplicate: false,
        source: "MongoDB Atlas",
        message: `Complaint ${newDoc.id} registered successfully! (Priority: ${priority.level}, Danger: ${aiAnalysis.dangerLevel})`,
        data: responseData
      });
    } else {
      // In-Memory Fallback
      inMemoryComplaints.unshift(complaintData);
      return res.status(201).json({
        success: true,
        duplicate: false,
        source: "In-Memory Fallback",
        message: `Complaint ${complaintData.id} registered successfully (in-memory mode)`,
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
    const userId = req.user.id;

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

      // Check if citizen already voted
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

      // Add vote
      complaint.supporters.push(userId);

      // Dynamically recalculate community score & final priority
      const updatedPriority = calculatePriority({
        dangerScore: complaint.aiAnalysis ? complaint.aiAnalysis.dangerScore : 50,
        reportCount: complaint.reportCount || 1,
        voteCount: complaint.supporters.length
      });
      complaint.priority = updatedPriority;

      await complaint.save();

      // Award 1 token to citizen for participating in community civic voting
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
      // In-Memory Fallback
      const complaint = inMemoryComplaints.find(c => c.id.toLowerCase() === id.toLowerCase());
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

      return res.status(200).json({
        success: true,
        source: "In-Memory Fallback",
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
      complaint = inMemoryComplaints.find(c => c.id.toLowerCase() === id.toLowerCase());
    }

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    const lat = complaint.location ? complaint.location.latitude : 20.5937;
    const lng = complaint.location ? complaint.location.longitude : 78.9629;

    // Call Gemini
    const freshAnalysis = await geminiService.analyzeComplaint({
      title: complaint.title,
      category: complaint.category,
      description: complaint.description,
      image: complaint.image,
      latitude: lat,
      longitude: lng
    });

    complaint.aiAnalysis = freshAnalysis;

    // Recalculate priority
    const voteCount = Array.isArray(complaint.supporters) ? complaint.supporters.length : 0;
    complaint.priority = calculatePriority({
      dangerScore: freshAnalysis.dangerScore,
      reportCount: complaint.reportCount || 1,
      voteCount
    });

    if (mongoose.connection.readyState === 1) {
      await complaint.save();
    }

    return res.status(200).json({
      success: true,
      message: `Gemini AI assessment refreshed: Danger ${freshAnalysis.dangerLevel} (${freshAnalysis.dangerScore}/100), Priority ${complaint.priority.level}`,
      data: complaint
    });
  } catch (error) {
    console.error('Error in reanalyzeComplaint:', error);
    res.status(500).json({
      success: false,
      message: "Error reanalyzing complaint with Gemini AI",
      error: error.message
    });
  }
};


/**
 * 7. PATCH /api/complaints/:id/status
 * Administrative status update (Protected: Admin Role Only)
 */
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolvedNote, resolvedBy } = req.body;

    const ALLOWED_STATUSES = [
      "Reported",
      "Under Verification",
      "In Progress",
      "Resolved",
      "Rejected"
    ];

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}`
      });
    }

    const adminName = req.user.name || "Civic Admin";

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

      complaint.status = status;

      if (status === "Resolved") {
        complaint.verification = "Verified";
        complaint.resolvedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        complaint.resolvedBy = resolvedBy || `${adminName} (Ward Operations)`;
        if (resolvedNote && resolvedNote.trim()) {
          complaint.resolutionNote = resolvedNote.trim();
        } else if (!complaint.resolutionNote) {
          complaint.resolutionNote = "Hazard inspected and road surface restored by municipal crew.";
        }
      } else if (status === "Rejected") {
        complaint.verification = "Rejected";
      } else if (status === "In Progress" && complaint.verification === "Pending") {
        complaint.verification = "Verified";
      } else if (status === "Under Verification" && complaint.verification === "Pending") {
        complaint.verification = "Verified";
      }

      await complaint.save();

      const item = complaint.toObject();
      item.supportersCount = Array.isArray(item.supporters) ? item.supporters.length : 0;
      item.supporters = item.supportersCount;
      item.voteCount = item.supportersCount;

      return res.status(200).json({
        success: true,
        source: "MongoDB Atlas",
        message: `Complaint ${complaint.id} status updated to ${status} by Administrator ${adminName}`,
        data: item
      });
    } else {
      // In-Memory Fallback
      const complaint = inMemoryComplaints.find(c => c.id.toLowerCase() === id.toLowerCase());
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      complaint.status = status;
      if (status === "Resolved") {
        complaint.verification = "Verified";
        complaint.resolvedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        complaint.resolvedBy = resolvedBy || `${adminName} (Ward Operations)`;
        complaint.resolutionNote = resolvedNote || "Hazard inspected and repaired.";
      } else if (status === "Rejected") {
        complaint.verification = "Rejected";
      }

      return res.status(200).json({
        success: true,
        source: "In-Memory Fallback",
        message: `Complaint ${complaint.id} status updated to ${status}`,
        data: {
          ...complaint,
          supportersCount: Array.isArray(complaint.supporters) ? complaint.supporters.length : 0,
          supporters: Array.isArray(complaint.supporters) ? complaint.supporters.length : (complaint.supporters || 0),
          voteCount: Array.isArray(complaint.supporters) ? complaint.supporters.length : 0
        }
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
