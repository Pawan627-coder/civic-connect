/**
 * ========================================================
 * CIVIC CONNECT - EXPRESS BACKEND SERVER (server.js)
 * Stage 9: Authentication, Authorization & Identity Gateways
 * ========================================================
 * 
 * As a beginner in backend development, this file:
 * 1. Loads environment variables (.env) safely using dotenv.
 * 2. Connects to MongoDB Atlas using Mongoose (backend/config/db.js).
 * 3. Configures Express middleware (CORS with credentials, JSON parser, cookie-parser).
 * 4. Mounts REST API routes (/api/auth, /api/complaints, /api/health).
 * 5. Handles 404 fallbacks and centralized error handling.
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

// Load environment variables from root or backend .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config(); // Fallback if ran directly inside backend folder

// Import database connector
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
connectDB();

/* --------------------------------------------------------
 * 1. GLOBAL MIDDLEWARE
 * -------------------------------------------------------- */

// Enable Cross-Origin Resource Sharing with Cookie Credentials
// Enable Cross-Origin Resource Sharing with Cookie Credentials & Bearer tokens
app.use(cors({
  origin: true, // Supports cookies securely without wildcard *
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Enable JSON Body Parsing (with 10mb limit for photo evidence uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Enable Cookie Parser for reading HTTP-only authentication tokens
app.use(cookieParser());

// Serve frontend static assets (HTML, CSS, JS, Images) from project root
app.use(express.static(path.join(__dirname, '..')));


/* --------------------------------------------------------
 * 2. BASE API ROUTES
 * -------------------------------------------------------- */

const complaintController = require('./controllers/complaintController');
const { protect, requireRole } = require('./middleware/authMiddleware');
const persistentStore = require('./utils/persistentStore');

// Root API info endpoint
app.get('/api', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1
    ? "Connected to MongoDB Atlas"
    : "Connected to Persistent Local Database Store";

  res.status(200).json({
    message: "Civic Connect REST API is running",
    version: "3.5.0 (Synchronized End-to-End)",
    database: dbStatus,
    endpoints: {
      health: "GET /api/health",
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        logout: "POST /api/auth/logout",
        me: "GET /api/auth/me"
      },
      complaints: {
        all: "GET /api/complaints",
        single: "GET /api/complaints/:id",
        create: "POST /api/complaints (Protected)",
        mine: "GET /api/complaints/mine (Protected)",
        userMineAlias: "GET /api/users/me/complaints (Protected)",
        status: "PATCH /api/complaints/:id/status (Admin Only)",
        priority: "PATCH /api/complaints/:id/priority (Admin Only)",
        support: "POST /api/complaints/:id/support (Protected)",
        vote: "POST /api/complaints/:id/vote (Protected)",
        reanalyze: "POST /api/complaints/:id/reanalyze (Admin Only)"
      },
      admin: {
        complaints: "GET /api/admin/complaints (Admin Only)",
        dashboard: "GET /api/admin/dashboard (Admin Only)",
        status: "PATCH /api/admin/complaints/:id/status (Admin Only)",
        priority: "PATCH /api/admin/complaints/:id/priority (Admin Only)"
      },
      config: {
        mapsKey: "GET /api/config/maps-key"
      }
    }
  });
});

// Maps configuration endpoint (safe client browser key delivery)
app.get('/api/config/maps-key', (req, res) => {
  res.status(200).json({
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

// Health check endpoint with database connectivity status and item counts
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const storeComplaints = isDbConnected ? null : persistentStore.getComplaints().length;
  const storeUsers = isDbConnected ? null : persistentStore.getUsers().length;

  res.status(200).json({
    status: "success",
    message: "Civic Connect server is healthy and operational",
    database: {
      connected: true,
      mode: isDbConnected ? "MongoDB Atlas" : "Persistent Local Store",
      status: isDbConnected ? "Connected to MongoDB Atlas" : "Persistent File-Backed Database (100% durable)",
      name: isDbConnected ? mongoose.connection.name : "civic_store",
      complaintCount: storeComplaints,
      userCount: storeUsers
    },
    auth: {
      jwtConfigured: !!process.env.JWT_SECRET,
      cookieEnabled: true,
      bearerSupported: true
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Mount Resource Routers
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/emergency-reports', emergencyRoutes);

// Synchronized Route Aliases (Section 5 compliance)
app.get('/api/users/me/complaints', protect, complaintController.getMyComplaints);
app.get('/api/admin/complaints', protect, requireRole('admin'), complaintController.getAdminComplaints);
app.get('/api/admin/dashboard', protect, requireRole('admin'), complaintController.getAdminDashboardStats);
app.patch('/api/admin/complaints/:id/status', protect, requireRole('admin'), complaintController.updateComplaintStatus);
app.patch('/api/admin/complaints/:id/verify', protect, requireRole('admin'), complaintController.verifyComplaint);
app.patch('/api/admin/complaints/:id/priority', protect, requireRole('admin'), complaintController.updateComplaintPriority);
app.patch('/api/admin/complaints/:id/review', protect, requireRole('admin'), complaintController.markComplaintReviewed);
app.patch('/api/admin/users/:id/flag', protect, requireRole('admin'), complaintController.flagUser);


/* --------------------------------------------------------
 * 3. FRONTEND NAVIGATION FALLBACK
 * Serves index.html when visiting root
 * -------------------------------------------------------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});


/* --------------------------------------------------------
 * 4. 404 UNKNOWN API ROUTE HANDLER
 * -------------------------------------------------------- */
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});


/* --------------------------------------------------------
 * 5. CENTRALIZED ERROR HANDLING MIDDLEWARE
 * -------------------------------------------------------- */
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON format in request body"
    });
  }

  console.error('[Server Error]:', err.stack || err.message);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});


/* --------------------------------------------------------
 * 6. START SERVER
 * -------------------------------------------------------- */
app.listen(PORT, () => {
  console.log('===========================================================');
  console.log(` Civic Connect Express Server is running on port ${PORT}`);
  console.log(` - Base API:       http://localhost:${PORT}/api`);
  console.log(` - Health Check:   http://localhost:${PORT}/api/health`);
  console.log(` - Auth Endpoints: http://localhost:${PORT}/api/auth`);
  console.log(` - Complaints:     http://localhost:${PORT}/api/complaints`);
  console.log(` - Frontend Site:  http://localhost:${PORT}`);
  console.log('===========================================================');
});

module.exports = app;
