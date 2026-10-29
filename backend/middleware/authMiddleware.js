/**
 * ========================================================
 * CIVIC CONNECT - AUTHENTICATION & AUTHORIZATION MIDDLEWARE
 * backend/middleware/authMiddleware.js
 * ========================================================
 * 
 * As a beginner in backend security, this file provides two gatekeepers:
 * 1. protect: Verifies who the user is (Authentication via JWT cookie).
 * 2. requireRole: Checks what the user is allowed to do (Role-based Authorization).
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Middleware: protect
 * Verifies JWT from HTTP-only cookie (or Bearer header fallback for API clients).
 * If valid, loads user from database and attaches to req.user (excluding password).
 */
const protect = async (req, res, next) => {
  let token = null;

  // 1. Read token from HTTP-only cookie (primary secure method)
  if (req.cookies && (req.cookies.token || req.cookies.jwt)) {
    token = req.cookies.token || req.cookies.jwt;
  }
  // 2. Fallback to Bearer token in Authorization header (useful for API testing)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // If no token is provided, reject request immediately
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: Please log in to access this resource'
    });
  }

  try {
    const secret = process.env.JWT_SECRET || 'civic_connect_super_secret_jwt_key_2026_dev';

    // Verify token validity and expiration
    const decoded = jwt.verify(token, secret);

    // Look up user by ID (exclude password field)
    const userId = decoded.userId || decoded.id;
    let user = null;

    if (mongoose.connection.readyState === 1) {
      user = await User.findById(userId).select('-password');
    } else {
      const persistentStore = require('../utils/persistentStore');
      const found = persistentStore.findUserById(userId);
      if (found) {
        user = {
          _id: found._id || found.id,
          id: found._id || found.id,
          name: found.name,
          email: found.email,
          role: found.role,
          rewardTokens: found.rewardTokens || 0
        };
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists'
      });
    }

    // Attach user record to request object
    req.user = {
      id: (user._id || user.id).toString(),
      _id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rewardTokens: user.rewardTokens || 0
    };

    next();
  } catch (error) {
    console.warn(`[Auth Error]: JWT verification failed - ${error.message}`);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please log in again.'
    });
  }
};

/**
 * Middleware: requireRole(...allowedRoles)
 * Restricts access to specified roles (e.g. 'admin').
 * Throws 403 Forbidden if user does not have permission.
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Treat 'admin' and 'authority' as equivalent municipal authority roles
    const effectiveRoles = [...allowedRoles];
    if (effectiveRoles.includes('admin') && !effectiveRoles.includes('authority')) {
      effectiveRoles.push('authority');
    }
    if (effectiveRoles.includes('authority') && !effectiveRoles.includes('admin')) {
      effectiveRoles.push('admin');
    }

    if (!effectiveRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to perform this action'
      });
    }

    next();
  };
};

/**
 * Middleware: optionalAuth
 * Attaches user if token is present, but allows request if not logged in.
 */
const optionalAuth = async (req, res, next) => {
  let token = null;
  if (req.cookies && (req.cookies.token || req.cookies.jwt)) {
    token = req.cookies.token || req.cookies.jwt;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return next();

  try {
    const secret = process.env.JWT_SECRET || 'civic_connect_super_secret_jwt_key_2026_dev';
    const decoded = jwt.verify(token, secret);
    const userId = decoded.userId || decoded.id;

    if (mongoose.connection.readyState === 1) {
      req.user = await User.findById(userId).select('-password');
    } else {
      const persistentStore = require('../utils/persistentStore');
      const found = persistentStore.findUserById(userId);
      if (found) {
        req.user = {
          _id: found._id || found.id,
          id: found._id || found.id,
          name: found.name,
          email: found.email,
          role: found.role
        };
      }
    }
  } catch (err) {
    // Ignore invalid tokens for optional auth
  }
  next();
};

module.exports = {
  protect,
  optionalAuth,
  requireRole
};
