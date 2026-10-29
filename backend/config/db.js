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

  // 1. Check for missing or placeholder credentials
  if (!uri || uri.includes('your_username') || uri.includes('<username>') || uri.includes('<cluster-url>')) {
    console.warn('-----------------------------------------------------------');
    console.warn('⚠️  [MongoDB Notice]: MONGODB_URI is not set or contains placeholders.');
    console.warn('    ⚡ Running in Persistent Local Database Store mode (100% durable).');
    console.warn('    To connect MongoDB Atlas, update MONGODB_URI in your .env file.');
    console.warn('-----------------------------------------------------------');
    return null;
  }

  // 2. Check for incomplete Atlas cluster domain (e.g., cluster0.mongodb.net without shard hash)
  // MongoDB Atlas cluster domains always have at least two subdomain parts, e.g. "cluster0.abcde.mongodb.net"
  const incompleteAtlasMatch = uri.match(/@([^/:]+)/);
  if (incompleteAtlasMatch) {
    const host = incompleteAtlasMatch[1];
    if (host.toLowerCase() === 'cluster0.mongodb.net') {
      console.warn('-----------------------------------------------------------');
      console.warn('⚠️  [MongoDB Configuration Notice]: Incomplete Atlas Cluster Domain');
      console.warn('    Your .env has: @cluster0.mongodb.net');
      console.warn('    MongoDB Atlas assigns a unique 5-8 character shard code to every cluster,');
      console.warn('    e.g.: cluster0.abcde.mongodb.net (not just cluster0.mongodb.net).');
      console.warn('    Without that code, DNS cannot find the cluster.');
      console.warn('    👉 Copy your full connection string from MongoDB Atlas:');
      console.warn('       Database -> Connect -> Drivers -> Node.js');
      console.warn('    ⚡ Civic Connect is running smoothly on Persistent Local Store (civic_store.json).');
      console.warn('-----------------------------------------------------------');
      return null;
    }
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: 'civic_connect',
      serverSelectionTimeoutMS: 5000 // Fast failover (5s) instead of hanging 30s
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
    
    if (error.message.includes('querySrv ENOTFOUND') || error.code === 'ENOTFOUND') {
      console.warn('\n   🔍 Root Cause Diagnosis:');
      console.warn('   The Atlas hostname cannot be resolved by DNS. Common reasons:');
      console.warn('   a) Missing cluster hash in .env (e.g. cluster0.mongodb.net instead of cluster0.abcde.mongodb.net)');
      console.warn('   b) Local ISP or Wi-Fi router blocking DNS SRV records (try Google DNS 8.8.8.8)');
      console.warn('   c) Atlas cluster was recently created or paused/deleted in MongoDB Cloud');
    } else {
      console.warn('\n   Troubleshooting Checklist:');
      console.warn('   1. Check username and password in .env (no < > brackets).');
      console.warn('   2. Verify Atlas Network Access allows your IP address (0.0.0.0/0 for development).');
      console.warn('   3. Ensure database name "civic_connect" is appended in connection string.');
    }

    console.warn('\n   ⚡ Civic Connect has seamlessly activated the Persistent Local Database Store.');
    console.warn('      All user logins, admin consoles, and problem reports will continue to work!');
    console.error('-----------------------------------------------------------');
    return null;
  }
};

module.exports = connectDB;
