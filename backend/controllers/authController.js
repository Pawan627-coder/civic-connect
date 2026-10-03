/**
 * ========================================================
 * CIVIC CONNECT - AUTHENTICATION CONTROLLER (authController.js)
 * Stage 9: Registration, Login, Logout, and Identity Verification
 * ========================================================
 * 
 * As a beginner in backend authentication:
 * 1. Passwords are salted & hashed with bcrypt before saving to MongoDB.
 * 2. JWTs are signed with JWT_SECRET and dispatched in secure HTTP-only cookies.
 * 3. Public registration is strictly locked to role: "user".
 * 4. Password hashes are NEVER returned to the client.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// In-Memory User Store (Resilient fallback if MongoDB Atlas is in development offline mode)
const inMemoryUsers = [
  {
    _id: "admin_seed_001",
    name: process.env.ADMIN_NAME || "Civic SuperAdmin",
    email: (process.env.ADMIN_EMAIL || "admin@civicconnect.org").toLowerCase(),
    password: bcrypt.hashSync(process.env.ADMIN_PASSWORD || "AdminSecurePass2026!", 10),
    role: "admin",
    rewardTokens: 100,
    createdAt: new Date()
  }
];
exports.inMemoryUsers = inMemoryUsers;

/**
 * Generate a JWT token with userId and role
 */
const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET || 'civic_connect_super_secret_jwt_key_2026_dev';
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';

  return jwt.sign(
    { userId, role },
    secret,
    { expiresIn }
  );
};

/**
 * Set HTTP-Only Cookie with the JWT token
 */
const sendTokenResponse = (user, statusCode, res, message) => {
  const token = generateToken(user._id || user.id, user.role);

  // Cookie expiration (1 day default)
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true, // Prevents JavaScript document.cookie access (Cross-Site Scripting defense)
    sameSite: 'lax', // Protects against CSRF attacks in cross-site navigations
    secure: isProduction, // Uses HTTPS in production
    maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
  };

  res.cookie('token', token, cookieOptions);

  return res.status(statusCode).json({
    success: true,
    message,
    token, // Also return in body so standard API clients can read if desired
    user: {
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rewardTokens: user.rewardTokens || 0,
      createdAt: user.createdAt
    }
  });
};


/**
 * 1. POST /api/auth/register
 * Registers a new citizen account (strictly role: "user")
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, and password'
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Name format check
    if (cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email format (e.g. name@example.com)'
      });
    }

    // Password strength check
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // 2. Hash Password with salt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (mongoose.connection.readyState === 1) {
      // Check for duplicate email in MongoDB
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists. Please log in.'
        });
      }

      // Create new citizen user (Role is ALWAYS forced to "user" for public signup)
      const user = await User.create({
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: 'user',
        rewardTokens: 10 // Welcome bonus for joining Civic Connect
      });

      return sendTokenResponse(user, 201, res, 'Citizen registration successful! Welcome to Civic Connect.');
    } else {
      // In-Memory Fallback
      const existing = inMemoryUsers.find(u => u.email === cleanEmail);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists. Please log in.'
        });
      }

      const mockUser = {
        _id: `user_${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: 'user',
        rewardTokens: 10,
        createdAt: new Date()
      };
      inMemoryUsers.push(mockUser);

      return sendTokenResponse(mockUser, 201, res, 'Citizen registration successful! (In-memory mode)');
    }
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.',
      error: error.message
    });
  }
};


/**
 * 2. POST /api/auth/login
 * Authenticates citizen or administrator and issues HTTP-only cookie
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate request inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (mongoose.connection.readyState === 1) {
      // Find user in MongoDB (must explicitly select password since it might be excluded by default)
      const user = await User.findOne({ email: cleanEmail });

      // Generic authentication error prevents account enumeration
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Verify password against stored bcrypt hash
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      return sendTokenResponse(user, 200, res, 'Login successful');
    } else {
      // In-Memory Fallback
      const user = inMemoryUsers.find(u => u.email === cleanEmail);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      return sendTokenResponse(user, 200, res, 'Login successful (In-memory mode)');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};


/**
 * 3. POST /api/auth/logout
 * Clears the HTTP-only authentication cookie
 */
exports.logout = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};


/**
 * 4. GET /api/auth/me
 * Retrieves current authenticated user profile
 */
exports.getMe = async (req, res) => {
  try {
    // req.user was securely populated by protect middleware
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Error in getMe:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile',
      error: error.message
    });
  }
};
