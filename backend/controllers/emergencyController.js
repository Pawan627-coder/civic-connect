/**
 * ========================================================
 * CIVIC CONNECT - EMERGENCY ACCIDENT RESPONSE CONTROLLER
 * backend/controllers/emergencyController.js
 * ========================================================
 */

const mongoose = require('mongoose');
const EmergencyReport = require('../models/EmergencyReport');
const persistentStore = require('../utils/persistentStore');
const { findNearestFacilities } = require('../services/emergencyFacilityService');
const { initiatePermittedEmergencyNotification, getEmergencyContactStatus } = require('../services/emergencyTelephonyService');
const { generateEmergencyIncidentSummary } = require('../services/geminiService');
const notificationService = require('../services/notificationService');

/**
 * Helper to generate unique Emergency Report ID
 */
function generateEmergencyReportId() {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `ACC-${year}-${randomSuffix}`;
}

/**
 * Validates base64 data URLs or HTTP URLs for image upload
 */
function validateEmergencyImages(images) {
  if (!images || !Array.isArray(images)) return [];

  const validImages = [];
  const MAX_IMAGES = 6;
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image

  for (let i = 0; i < Math.min(images.length, MAX_IMAGES); i++) {
    const img = images[i];
    let url = typeof img === 'string' ? img : (img && img.url ? img.url : '');
    if (!url) continue;

    // Check size if base64 data url
    if (url.startsWith('data:image/')) {
      const headerIndex = url.indexOf(';base64,');
      if (headerIndex !== -1) {
        const mimeType = url.substring(5, headerIndex).toLowerCase();
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType)) {
          continue; // Skip invalid mime types
        }
        const base64Data = url.substring(headerIndex + 8);
        const approxSize = Math.round((base64Data.length * 3) / 4);
        if (approxSize > MAX_SIZE_BYTES) {
          continue; // Skip oversized image
        }
      }
    }

    validImages.push({
      url,
      name: (img && img.name) || `accident_evidence_${i + 1}.jpg`,
      sizeBytes: (img && img.sizeBytes) || 0,
      uploadedAt: new Date()
    });
  }

  return validImages;
}

/**
 * POST /api/emergency-reports
 * Creates a new emergency accident report with instant coordinates & optional evidence
 */
exports.createEmergencyReport = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      address,
      accuracyMeters,
      locationCapturedAt,
      locationSource,
      description,
      estimatedCasualties,
      images,
      isGenuineConfirmed
    } = req.body;

    // 1. Strict Coordinate Validation
    const numLat = parseFloat(latitude);
    const numLng = parseFloat(longitude);

    if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates. Please provide valid latitude (-90 to 90) and longitude (-180 to 180).'
      });
    }

    // 2. Validate images (Strictly Mandatory: Live camera capture required)
    const validatedImages = validateEmergencyImages(images);
    if (!validatedImages || validatedImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A live photograph of the accident scene is mandatory. Please capture a live photo before submitting.'
      });
    }

    // 3. Generate Unique Report ID
    const reportId = generateEmergencyReportId();

    // 4. Capture Reporter Details if authenticated
    const reporterId = req.user ? (req.user._id || req.user.id) : null;
    const reporterName = req.user ? req.user.name : (req.body.reporterName || 'Anonymous Citizen');
    const reporterPhone = req.body.reporterPhone || '';

    // 5. Discover Nearest Facilities
    let nearbyFacilities = [];
    try {
      nearbyFacilities = await findNearestFacilities(numLat, numLng, 15);
    } catch (facErr) {
      console.warn('[Emergency Controller]: Could not retrieve nearby facilities:', facErr.message);
    }

    const initialStatus = nearbyFacilities.length > 0 ? 'FACILITIES_IDENTIFIED' : 'RECEIVED';

    const reportData = {
      reportId,
      reporterId,
      reporterName,
      reporterPhone,
      description: (description && description.trim()) || 'Road accident reported via Civic Connect Emergency Response.',
      estimatedCasualties: estimatedCasualties || 'Unspecified / Emergency Response Dispatched',
      location: {
        latitude: numLat,
        longitude: numLng,
        address: (address && address.trim()) || 'Accident Coordinates Pinned',
        accuracyMeters: accuracyMeters ? Math.round(Number(accuracyMeters)) : null,
        capturedAt: locationCapturedAt ? new Date(locationCapturedAt) : new Date(),
        source: locationSource === 'manual' ? 'manual' : 'gps'
      },
      images: validatedImages,
      nearbyFacilities,
      notificationAttempts: [],
      status: initialStatus,
      isGenuineConfirmed: isGenuineConfirmed === false ? false : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 6. Save in MongoDB or PersistentStore
    let savedReport = null;
    if (mongoose.connection.readyState === 1) {
      savedReport = await EmergencyReport.create(reportData);
    } else {
      savedReport = persistentStore.addEmergencyReport(reportData);
    }

    // 7. Dispatch High-Priority In-App Alert to Authorities
    try {
      if (typeof notificationService.broadcastToAuthorities === 'function') {
        notificationService.broadcastToAuthorities({
          type: 'EMERGENCY_ACCIDENT_ALERT',
          title: `🚨 CRITICAL: Road Accident Reported (${reportId})`,
          message: `Accident reported near ${reportData.location.address}. GPS: ${numLat.toFixed(5)}, ${numLng.toFixed(5)}. Suggested nearest facilities: ${nearbyFacilities.length}.`,
          priority: 'CRITICAL',
          relatedId: reportId
        });
      }
    } catch (notifErr) {
      console.warn('[Emergency Notification]: In-app alert dispatch notice:', notifErr.message);
    }

    // 8. Optional Asynchronous AI Incident Summary (Strictly non-blocking)
    generateEmergencyIncidentSummary(reportData)
      .then(async (aiSummary) => {
        if (!aiSummary) return;
        if (mongoose.connection.readyState === 1) {
          await EmergencyReport.updateOne({ reportId }, { aiIncidentSummary: aiSummary });
        } else {
          persistentStore.updateEmergencyReport(reportId, { aiIncidentSummary: aiSummary });
        }
      })
      .catch((e) => console.warn('[AI Incident Summary Notice]:', e.message));

    console.log(`✓ [Emergency Response]: Created Accident Report ${reportId} at [${numLat}, ${numLng}] with ${validatedImages.length} photo(s).`);

    return res.status(201).json({
      success: true,
      message: 'Emergency accident report received successfully. Emergency options and nearby facility directory are active.',
      reportId,
      status: initialStatus,
      data: savedReport,
      directEmergencyNumber: '112',
      nextSteps: [
        '1. If anyone is injured, immediately tap the "Call 112" emergency button.',
        '2. Suggested nearby police stations and hospitals are listed below.',
        '3. An emergency broadcast has been logged in the municipal dispatch centre.'
      ]
    });
  } catch (error) {
    console.error('[Emergency Controller Error]: Failed to create accident report:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not record emergency report due to server error. In an emergency, please call 112 immediately.',
      directEmergencyNumber: '112'
    });
  }
};

/**
 * GET /api/emergency-reports/:id
 * Retrieve emergency report details
 */
exports.getEmergencyReportById = async (req, res) => {
  try {
    const { id } = req.params;
    let report = null;

    if (mongoose.connection.readyState === 1) {
      report = await EmergencyReport.findOne({ reportId: id });
    } else {
      report = persistentStore.findEmergencyReportById(id);
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        message: `Emergency report ${id} was not found.`
      });
    }

    // Authorization & Privacy check: Mask reporter personal details for non-admin public requests
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'authority');
    const isOwner = req.user && report.reporterId && req.user._id && (report.reporterId.toString() === req.user._id.toString());

    const sanitizedReport = typeof report.toObject === 'function' ? report.toObject() : { ...report };

    if (!isAdmin && !isOwner) {
      delete sanitizedReport.reporterPhone;
      sanitizedReport.reporterName = 'Citizen Reporter';
    }

    return res.status(200).json({
      success: true,
      data: sanitizedReport
    });
  } catch (error) {
    console.error('[Emergency Controller Error]: Fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve emergency report.'
    });
  }
};

/**
 * GET /api/emergency-reports/:id/facilities
 * Discover or refresh nearest facilities for an accident report
 */
exports.getNearbyFacilitiesForReport = async (req, res) => {
  try {
    const { id } = req.params;
    let report = null;

    if (mongoose.connection.readyState === 1) {
      report = await EmergencyReport.findOne({ reportId: id });
    } else {
      report = persistentStore.findEmergencyReportById(id);
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        message: `Emergency report ${id} was not found.`
      });
    }

    const lat = report.location.latitude;
    const lng = report.location.longitude;

    const facilities = await findNearestFacilities(lat, lng, 20);

    return res.status(200).json({
      success: true,
      reportId: id,
      coordinates: { latitude: lat, longitude: lng },
      facilitiesCount: facilities.length,
      facilities
    });
  } catch (error) {
    console.error('[Emergency Controller Error]: Facilities error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to locate nearby emergency facilities.'
    });
  }
};

/**
 * POST /api/emergency-reports/:id/notify
 * Request an authorized notification attempt to a verified facility contact
 */
exports.notifyFacilityForReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { facilityId } = req.body;

    let report = null;
    if (mongoose.connection.readyState === 1) {
      report = await EmergencyReport.findOne({ reportId: id });
    } else {
      report = persistentStore.findEmergencyReportById(id);
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        message: `Emergency report ${id} was not found.`
      });
    }

    // Locate target facility from report's suggested facilities or verified directory
    const facilities = report.nearbyFacilities || [];
    let targetFacility = facilities.find(f => f.id === facilityId);

    if (!targetFacility) {
      const { VERIFIED_FACILITY_DIRECTORY } = require('../services/emergencyFacilityService');
      targetFacility = VERIFIED_FACILITY_DIRECTORY.find(f => f.id === facilityId);
    }

    if (!targetFacility) {
      targetFacility = {
        id: facilityId || 'general_emergency_hub',
        name: req.body.facilityName || 'Municipal Emergency Center',
        phone: req.body.facilityPhone || ''
      };
    }

    // Initiate permitted telephony notification attempt (support student demo number if provided)
    const demoReceiverNumber = (req.body.demoReceiverNumber || req.body.demoPhone || '').trim();
    const attemptResult = await initiatePermittedEmergencyNotification(report, targetFacility, {
      demoReceiverNumber,
      isDemoMode: Boolean(demoReceiverNumber || req.body.isDemoMode)
    });

    // Persist attempt into report audit log
    if (mongoose.connection.readyState === 1) {
      report.notificationAttempts.push(attemptResult);
      if (attemptResult.status === 'COMPLETED') {
        report.status = 'CONTACT_CONFIRMED';
      } else if (attemptResult.status === 'INITIATED') {
        report.status = 'CONTACT_ATTEMPTED';
      }
      await report.save();
    } else {
      const existingAttempts = report.notificationAttempts || [];
      existingAttempts.push(attemptResult);
      let newStatus = report.status;
      if (attemptResult.status === 'COMPLETED') newStatus = 'CONTACT_CONFIRMED';
      else if (attemptResult.status === 'INITIATED') newStatus = 'CONTACT_ATTEMPTED';

      persistentStore.updateEmergencyReport(id, {
        notificationAttempts: existingAttempts,
        status: newStatus
      });
    }

    return res.status(200).json({
      success: true,
      reportId: id,
      attempt: attemptResult,
      reportStatus: report.status,
      message: attemptResult.message,
      speechText: attemptResult.speechText || ''
    });
  } catch (error) {
    console.error('[Emergency Controller Error]: Notification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate facility notification.'
    });
  }
};

/**
 * POST /api/emergency-reports/:id/demo-call
 * College Project Viva Demonstration Call Endpoint:
 * Immediately triggers emergency dispatch call simulation directly to the student's test phone number
 */
exports.triggerDemoCall = async (req, res) => {
  try {
    const { id } = req.params;
    const { demoReceiverNumber } = req.body;

    let report = null;
    if (mongoose.connection.readyState === 1) {
      report = await EmergencyReport.findOne({ reportId: id });
    } else {
      report = persistentStore.findEmergencyReportById(id);
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        message: `Emergency report ${id} was not found.`
      });
    }

    const testFacility = {
      id: 'college_demo_test',
      name: `College Project Tester (${demoReceiverNumber || 'Student Phone'})`,
      phone: demoReceiverNumber || process.env.DEMO_EMERGENCY_RECEIVER_NUMBER || '+919876543210'
    };

    const attemptResult = await initiatePermittedEmergencyNotification(report, testFacility, {
      demoReceiverNumber: testFacility.phone,
      isDemoMode: true
    });

    // Record demo attempt
    if (mongoose.connection.readyState === 1) {
      report.notificationAttempts.push(attemptResult);
      await report.save();
    } else {
      const existingAttempts = report.notificationAttempts || [];
      existingAttempts.push(attemptResult);
      persistentStore.updateEmergencyReport(id, { notificationAttempts: existingAttempts });
    }

    return res.status(200).json({
      success: true,
      reportId: id,
      attempt: attemptResult,
      reportStatus: report.status,
      message: attemptResult.message,
      speechText: attemptResult.speechText || ''
    });
  } catch (error) {
    console.error('[Emergency Controller Error]: Demo call error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger college demo call.'
    });
  }
};

/**
 * GET /api/emergency-reports/:id/contact-status
 * Retrieve real-time contact and call status
 */
exports.getReportContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let report = null;

    if (mongoose.connection.readyState === 1) {
      report = await EmergencyReport.findOne({ reportId: id });
    } else {
      report = persistentStore.findEmergencyReportById(id);
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        message: `Emergency report ${id} was not found.`
      });
    }

    const contactStatus = getEmergencyContactStatus(report);

    return res.status(200).json({
      success: true,
      ...contactStatus
    });
  } catch (error) {
    console.error('[Emergency Controller Error]: Contact status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve emergency contact status.'
    });
  }
};
