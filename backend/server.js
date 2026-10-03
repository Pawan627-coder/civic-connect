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

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
connectDB();

/* --------------------------------------------------------
 * 1. GLOBAL MIDDLEWARE
 * -------------------------------------------------------- */

// Enable Cross-Origin Resource Sharing with Cookie Credentials
app.use(cors({
  origin: true, // Reflects the incoming request origin (supports cookies securely without wildcard *)
  credentials: true
}));

// Enable JSON Body Parsing
app.use(express.json());

// Enable Cookie Parser for reading HTTP-only authentication tokens
app.use(cookieParser());

// Serve frontend static assets (HTML, CSS, JS, Images) from project root
app.use(express.static(path.join(__dirname, '..')));


/* --------------------------------------------------------
 * 2. BASE API ROUTES
 * -------------------------------------------------------- */

// Root API info endpoint
app.get('/api', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1
    ? "Connected to MongoDB Atlas"
    : "Disconnected (Check .env MONGODB_URI)";

  res.status(200).json({
    message: "Civic Connect REST API is running",
    version: "3.0.0 (Stage 9 Auth & RBAC)",
    database: dbStatus,
    endpoints: {
      health: "/api/health",
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
        status: "PATCH /api/complaints/:id/status (Admin Only)",
        support: "POST /api/complaints/:id/support (Protected)",
        vote: "POST /api/complaints/:id/vote (Protected)",
        reanalyze: "POST /api/complaints/:id/reanalyze (Admin Only)"
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

// Health check endpoint with database connectivity status
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    status: "success",
    message: "Civic Connect server is healthy",
    database: {
      connected: isDbConnected,
      status: isDbConnected ? "Connected to MongoDB Atlas" : "In-Memory Fallback Mode",
      name: isDbConnected ? mongoose.connection.name : "N/A"
    },
    auth: {
      jwtConfigured: !!process.env.JWT_SECRET,
      cookieEnabled: true
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Mount Resource Routers
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);


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
