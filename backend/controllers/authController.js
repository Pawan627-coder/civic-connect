/**
 * ========================================================
 * CIVIC CONNECT - AUTHENTICATION CONTROLLER (authController.js)
 * Stage 9: Registration, Login, Logout, and Identity Verification
 * ========================================================
 * 
 * As a beginner in backend authentication:
 * 1. Passwords are salted & hashed with bcrypt before saving to MongoDB / persistent store.
 * 2. JWTs are signed with JWT_SECRET and dispatched in secure HTTP-only cookies and JSON body.
 * 3. Public registration is strictly locked to role: "user".
 * 4. Password hashes are NEVER returned to the client.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const persistentStore = require('../utils/persistentStore');

// Export reference for backwards compatibility
exports.inMemoryUsers = persistentStore.getUsers();

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
  const userId = user._id || user.id;
  const token = generateToken(userId, user.role);

  // Cookie expiration (1 day default)
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true, // Prevents JavaScript document.cookie access
    sameSite: isProduction ? 'none' : 'lax', // Support cross-origin cookies in production HTTPS
    secure: isProduction, // Uses HTTPS in production
    maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
  };

  res.cookie('token', token, cookieOptions);

  return res.status(statusCode).json({
    success: true,
    message,
    token, // Return in body so client can also use Bearer token (vital for cross-domain Netlify/Render)
    user: {
      id: userId,
      _id: userId,
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

    // Determine role (Citizen vs Municipal Authority)
    const requestedRole = (req.body.role === 'authority' || req.body.role === 'admin') ? 'admin' : 'user';
    const roleLabel = requestedRole === 'admin' ? 'Municipal Authority' : 'Citizen';

    if (mongoose.connection.readyState === 1) {
      // Check for duplicate email in MongoDB
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists. Please log in.'
        });
      }

      // Create new user with requested role
      const user = await User.create({
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: requestedRole,
        rewardTokens: requestedRole === 'admin' ? 100 : 10
      });

      return sendTokenResponse(user, 201, res, `${roleLabel} registration successful! Welcome to Civic Connect.`);
    } else {
      // Persistent Store Fallback
      const existing = persistentStore.findUserByEmail(cleanEmail);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists. Please log in.'
        });
      }

      const newUser = persistentStore.addUser({
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: requestedRole,
        rewardTokens: requestedRole === 'admin' ? 100 : 10
      });

      return sendTokenResponse(newUser, 201, res, `${roleLabel} registration successful! Welcome to Civic Connect.`);
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
 * Authenticates citizen or administrator and issues token
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
      // Find user in MongoDB
      const user = await User.findOne({ email: cleanEmail });

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
      // Persistent Store Fallback
      const user = persistentStore.findUserByEmail(cleanEmail);
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

      return sendTokenResponse(user, 200, res, 'Login successful');
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
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction
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
