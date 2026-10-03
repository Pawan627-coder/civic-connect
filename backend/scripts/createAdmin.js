/**
 * ========================================================
 * CIVIC CONNECT - ADMIN SEED SCRIPT (backend/scripts/createAdmin.js)
 * Stage 9: Safe Seed Script for Creating/Updating Municipal Admin
 * ========================================================
 * 
 * Usage:
 *   node backend/scripts/createAdmin.js
 * 
 * Environment Variables (read from .env):
 *   ADMIN_NAME=Your Admin Name
 *   ADMIN_EMAIL=admin@civicconnect.org
 *   ADMIN_PASSWORD=YourSecurePasswordHere
 */

const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const User = require('../models/User');

const createAdmin = async () => {
  console.log('===========================================================');
  console.log('🏛️  Civic Connect - Municipal Administrator Seed Utility');
  console.log('===========================================================');

  const adminName = process.env.ADMIN_NAME || 'Civic SuperAdmin';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@civicconnect.org').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || adminPassword.length < 8) {
    console.error('❌ Error: ADMIN_PASSWORD must be at least 8 characters long in .env');
    console.warn('   Add ADMIN_PASSWORD=YourSecurePassword123 to your .env file.');
    process.exit(1);
  }

  // Connect to MongoDB Atlas
  const conn = await connectDB();
  if (!conn) {
    console.error('❌ Could not connect to MongoDB Atlas. Please verify your MONGODB_URI in .env.');
    process.exit(1);
  }

  try {
    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Check if user already exists
    let adminUser = await User.findOne({ email: adminEmail });

    if (adminUser) {
      adminUser.name = adminName;
      adminUser.password = hashedPassword;
      adminUser.role = 'admin';
      await adminUser.save();

      console.log(`✓ Existing user [${adminEmail}] successfully promoted to Administrator!`);
    } else {
      adminUser = await User.create({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        rewardTokens: 100
      });

      console.log(`✓ New Administrator [${adminEmail}] created successfully!`);
    }

    console.log(`  Name:  ${adminUser.name}`);
    console.log(`  Role:  ${adminUser.role}`);
    console.log(`  ID:    ${adminUser._id}`);
    console.log('===========================================================');
    console.log('You can now log in at /login.html with your admin credentials.');
    console.log('===========================================================');
  } catch (error) {
    console.error('❌ Failed to create administrator account:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

createAdmin();
