/**
 * ========================================================
 * CIVIC CONNECT - EMERGENCY ACCIDENT RESPONSE ROUTER
 * backend/routes/emergencyRoutes.js
 * ========================================================
 */

const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergencyController');
const { optionalAuth, protect, requireRole } = require('../middleware/authMiddleware');

// Public/Optional-Auth route to create an emergency report without delay
router.post('/', optionalAuth, emergencyController.createEmergencyReport);

// Retrieve emergency report details
router.get('/:id', optionalAuth, emergencyController.getEmergencyReportById);

// Discover suggested nearby facilities
router.get('/:id/facilities', optionalAuth, emergencyController.getNearbyFacilitiesForReport);

// Request a permitted notification attempt to an approved facility contact
router.post('/:id/notify', optionalAuth, emergencyController.notifyFacilityForReport);

// College Project Viva Demo Call route (routes test call directly to student phone)
router.post('/:id/demo-call', optionalAuth, emergencyController.triggerDemoCall);

// Retrieve notification and call status
router.get('/:id/contact-status', optionalAuth, emergencyController.getReportContactStatus);

module.exports = router;
