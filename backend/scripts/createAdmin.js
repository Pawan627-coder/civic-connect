/**
 * ========================================================
 * CIVIC CONNECT - UNIFIED ADMIN PROVISIONING TOOL
 * backend/scripts/createAdmin.js
 * ========================================================
 * 
 * Works in both modes:
 * 1. CLI Arguments:
 *    node backend/scripts/createAdmin.js "Officer Sharma" "admin@gorakhpur.gov.in" "SecureGovPass2026!"
 * 
 * 2. Environment Variables (.env):
 *    node backend/scripts/createAdmin.js
 *    (Reads ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD from .env)
 * 
 * Automatically synchronizes with:
 * - Persistent Local File Database (backend/data/civic_store.json)
 * - MongoDB Atlas Cluster (if configured and reachable)
 */

const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const persistentStore = require('../utils/persistentStore');
const User = require('../models/User');

async function provisionAdministrator() {
  console.log('===========================================================');
  console.log('🏛️  Civic Connect - Unified Administrator Provisioning Tool');
  console.log('===========================================================');

  const args = process.argv.slice(2);
  let name, email, password;

  if (args.length >= 3) {
    [name, email, password] = args;
  } else {
    name = process.env.ADMIN_NAME || 'Civic SuperAdmin';
    email = process.env.ADMIN_EMAIL || 'admin@civicconnect.org';
    password = process.env.ADMIN_PASSWORD;
  }

  if (!password || password.length < 8) {
    console.error('\n❌ Error: Password must be at least 8 characters long.');
    console.log('\nUsage Options:');
    console.log('  1. CLI Arguments: node backend/scripts/createAdmin.js <fullName> <email> <password>');
    console.log('  2. Environment:   Set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD in your .env file.\n');
    process.exit(1);
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  console.log(`\n🔐 Provisioning Administrator Account: ${cleanName} (${cleanEmail}) ...`);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 1. Update Persistent Local File Store (100% durable local store)
  const existingPersistent = persistentStore.findUserByEmail(cleanEmail);
  if (existingPersistent) {
    persistentStore.updateUser(existingPersistent._id || existingPersistent.id, {
      name: cleanName,
      role: 'admin',
      password: hashedPassword
    });
    console.log(`✓ [Local Store]: User updated to Municipal Authority successfully.`);
  } else {
    persistentStore.addUser({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      role: 'admin',
      rewardTokens: 100
    });
    console.log(`✓ [Local Store]: Created new Municipal Authority record.`);
  }

  // 2. Update MongoDB Atlas (if connection succeeds)
  try {
    const conn = await connectDB();
    if (conn && mongoose.connection.readyState === 1) {
      let mongoUser = await User.findOne({ email: cleanEmail });
      if (mongoUser) {
        mongoUser.name = cleanName;
        mongoUser.password = hashedPassword;
        mongoUser.role = 'admin';
        await mongoUser.save();
        console.log(`✓ [MongoDB Atlas]: Existing user updated to Administrator.`);
      } else {
        await User.create({
          name: cleanName,
          email: cleanEmail,
          password: hashedPassword,
          role: 'admin',
          rewardTokens: 100
        });
        console.log(`✓ [MongoDB Atlas]: Created new Administrator document.`);
      }
      await mongoose.connection.close();
    }
  } catch (mongoErr) {
    console.warn(`ℹ️ [MongoDB Notice]: Skipped remote sync (${mongoErr.message}). Local store is active.`);
  }

  console.log('\n===========================================================');
  console.log(`✅ Administrator account ready for login:`);
  console.log(`   Email: ${cleanEmail}`);
  console.log(`   Role:  admin (Municipal Authority)`);
  console.log(`   Login: http://localhost:5000/login.html (Authority Portal Tab)`);
  console.log('===========================================================\n');
  process.exit(0);
}

provisionAdministrator().catch(err => {
  console.error('❌ Provisioning failed:', err.message);
  process.exit(1);
});
