/**
 * ========================================================
 * CIVIC CONNECT - USER MONGOOSE MODEL (backend/models/User.js)
 * Stage 9: Citizen & Admin Identity, Roles, and Authentication
 * ========================================================
 * 
 * As a beginner in authentication, this file defines:
 * 1. User Schema: Name, unique lowercase email, hashed password, role, rewards.
 * 2. Role-Based Access Control (RBAC): "user" (default citizen) and "admin".
 * 3. Helper Method: matchPassword() to safely verify passwords using bcrypt.
 * 4. toJSON Transform: Automatically strips password hash from JSON responses.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your full name'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [60, 'Name cannot exceed 60 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email address'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: {
    type: String,
    enum: {
      values: ['user', 'admin', 'authority'],
      message: '{VALUE} is not an authorized role'
    },
    default: 'user'
  },
  rewardTokens: {
    type: Number,
    default: 0,
    min: [0, 'Reward tokens cannot be negative']
  },
  status: {
    type: String,
    enum: ['Active', 'Flagged', 'Suspended'],
    default: 'Active'
  },
  flaggedReason: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

/**
 * Compare candidate password with the hashed password stored in MongoDB
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Ensure the password hash is NEVER accidentally leaked in JSON responses
 */
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
