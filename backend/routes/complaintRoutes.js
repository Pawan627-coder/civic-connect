/**
 * ========================================================
 * CIVIC CONNECT - COMPLAINT ROUTES (complaintRoutes.js)
 * Stage 9: Protected Citizen Reporting, Private Feed & Admin Controls
 * ========================================================
 */

const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { protect, optionalAuth, requireRole } = require('../middleware/authMiddleware');

// 1. GET /api/complaints - Retrieve all complaints (Public civic explorer)
// 2. POST /api/complaints - Create a new complaint (Protected: requires citizen login)
router.route('/')
  .get(complaintController.getAllComplaints)
  .post(protect, complaintController.createComplaint);

// 3. GET /api/complaints/mine - Retrieve logged-in citizen's personal complaints (Protected)
// NOTE: Defined BEFORE /:id route so '/mine' is not interpreted as an ID parameter!
router.route('/mine')
  .get(protect, complaintController.getMyComplaints);

// 4. GET /api/complaints/:id - Retrieve a single complaint by ID (Public)
router.route('/:id')
  .get(complaintController.getComplaintById);

// 5. PATCH /api/complaints/:id/status - Update status (Protected: Admin Only)
router.route('/:id/status')
  .patch(protect, requireRole('admin'), complaintController.updateComplaintStatus);

// 5B. PATCH /api/complaints/:id/verify - Location & Evidence Verification (Protected: Authority/Admin Only)
router.route('/:id/verify')
  .patch(protect, requireRole('admin'), complaintController.verifyComplaint);

// 5C. PATCH /api/complaints/:id/review - Mark complaint as reviewed (Protected: Authority/Admin Only)
router.route('/:id/review')
  .patch(protect, requireRole('admin'), complaintController.markComplaintReviewed);

// 6. POST /api/complaints/:id/support or /vote - Endorse complaint (Protected: Citizen Login)
router.route('/:id/support')
  .post(protect, complaintController.supportComplaint);

router.route('/:id/vote')
  .post(protect, complaintController.supportComplaint);

// 7. PATCH /api/complaints/:id/priority - Update priority (Protected: Admin Only)
router.route('/:id/priority')
  .patch(protect, requireRole('admin'), complaintController.updateComplaintPriority);

// 8. POST /api/complaints/:id/reanalyze - Re-run AI analysis (Protected: Admin Only)
router.route('/:id/reanalyze')
  .post(protect, requireRole('admin'), complaintController.reanalyzeComplaint);

// 9. POST /api/complaints/:id/reminder - Escalate / Send reminder to municipal team (Citizen Action)
router.route('/:id/reminder')
  .post(optionalAuth, complaintController.sendReminder);

// 10. POST /api/complaints/:id/feedback - Citizen ratings & feedback
router.route('/:id/feedback')
  .post(complaintController.submitFeedback);

module.exports = router;



