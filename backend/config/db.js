/**
 * ========================================================
 * CIVIC CONNECT - DATABASE CONNECTION (backend/config/db.js)
 * Stage 7: MongoDB Atlas & Mongoose Connection Manager
 * ========================================================
 * 
 * As a beginner, this file handles:
 * 1. Reading MONGODB_URI safely from process.env (never hardcoded!).
 * 2. Connecting Mongoose to MongoDB Atlas cluster.
 * 3. Handling success and failure gracefully with clear logs.
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('your_username') || uri.includes('<username>')) {
    console.warn('-----------------------------------------------------------');
    console.warn('⚠️  [MongoDB Warning]: MONGODB_URI is not configured in .env!');
    console.warn('    Please add your MongoDB Atlas connection string in .env:');
    console.warn('    MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/civic_connect');
    console.warn('    (See README.md for the step-by-step Atlas setup guide)');
    console.warn('-----------------------------------------------------------');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: 'civic_connect'
    });

    console.log('===========================================================');
    console.log(`✓ [MongoDB Connected]: MongoDB Atlas connected successfully!`);
    console.log(`  Database Name: ${conn.connection.name}`);
    console.log(`  Cluster Host:  ${conn.connection.host}`);
    console.log('===========================================================');

    return conn;
  } catch (error) {
    console.error('-----------------------------------------------------------');
    console.error(`❌ [MongoDB Connection Error]: ${error.message}`);
    console.warn('   Troubleshooting Checklist:');
    console.warn('   1. Check username and password in .env (no < > brackets).');
    console.warn('   2. Verify Atlas Network Access allows your IP address (0.0.0.0/0 for development).');
    console.warn('   3. Ensure database name "civic_connect" is appended in connection string.');
    console.error('-----------------------------------------------------------');
    return null;
  }
};

module.exports = connectDB;
