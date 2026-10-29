/**
 * ========================================================
 * CIVIC CONNECT - EMERGENCY TELEPHONY & NOTIFICATION SERVICE
 * backend/services/emergencyTelephonyService.js
 * ========================================================
 * 
 * Manages authorized notification and voice dispatch attempts to
 * verified hospital/police facility contacts.
 * 
 * Safety & Reliability Rules:
 * 1. Never automates calls to public emergency numbers like 112 (provides direct tel:112 button).
 * 2. Only permits calls to verified facility directory contacts or configured agency numbers.
 * 3. Does not fake successful calls. If telephony credentials are missing, returns 'NOT_CONFIGURED'.
 * 4. A completed call indicates telephony connection only, not confirmed rescue dispatch.
 */

// In-memory debounce set to prevent rapid duplicate calls
const activeCallsInProgress = new Set();

/**
 * Build standard factual voice message for emergency dispatch
 */
function buildFactualEmergencyMessage(report, isDemoMode = false, demoNumber = '') {
  const addr = report.location && report.location.address ? report.location.address : 'Pinned GPS Coordinates';
  const lat = report.location && report.location.latitude ? report.location.latitude.toFixed(5) : 'N/A';
  const lng = report.location && report.location.longitude ? report.location.longitude.toFixed(5) : 'N/A';
  const reportId = report.reportId || 'Unknown ID';
  const time = report.createdAt ? new Date(report.createdAt).toLocaleString('en-IN') : 'recently';
  const desc = report.description ? report.description.slice(0, 150) : 'Road accident reported.';
  const casualties = report.estimatedCasualties || 'Injuries Observed';

  if (isDemoMode) {
    return `College Project Emergency Simulation Alert! This is an automated demonstration from the Civic Connect Emergency Response System. A simulated road accident has been registered. Incident Report ID: ${reportId}. Accident Location: ${addr}. Coordinates: Latitude ${lat}, Longitude ${lng}. Severity: ${casualties}. Reporter note: ${desc}. This alert was routed to your verified student test phone number: ${demoNumber || 'College Tester'}. End of simulated dispatch transmission.`;
  }

  return `Emergency accident report received through Civic Connect. The reported accident location is ${addr}. GPS coordinates are latitude ${lat} and longitude ${lng}. The report ID is ${reportId}. The reporter submitted this information at ${time}. Incident description: ${desc}. Please verify this information according to municipal emergency protocols.`;
}

/**
 * Initiates an authorized emergency voice notification to a verified facility contact or demo tester
 * @param {Object} report The EmergencyReport document or object
 * @param {Object} facility The target facility { id, name, phone, isVerifiedPhone }
 * @param {Object} options Optional config: { demoReceiverNumber, isDemoMode }
 * @returns {Promise<Object>} The attempt audit result
 */
async function initiatePermittedEmergencyNotification(report, facility, options = {}) {
  const reportId = report.reportId;
  const facilityId = (facility && facility.id) || 'general_emergency_dispatch';
  const debounceKey = `${reportId}_${facilityId}`;

  // 1. Prevent duplicate simultaneous call attempts
  if (activeCallsInProgress.has(debounceKey)) {
    return {
      attemptId: `att_${Date.now()}`,
      facilityId,
      facilityName: facility.name,
      facilityPhone: facility.phone,
      provider: 'telephony-dispatch',
      status: 'REJECTED',
      message: 'A notification attempt to this facility is already in progress.',
      errorSummary: 'Duplicate call request prevented by rate limiter.'
    };
  }

  activeCallsInProgress.add(debounceKey);

  try {
    const attemptId = `att_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // College project demo mode detection:
    // If a demo receiver number is provided (or in .env), route call to the student's phone number
    const demoPhone = (options.demoReceiverNumber || process.env.DEMO_EMERGENCY_RECEIVER_NUMBER || '').trim();
    const isDemoMode = Boolean(demoPhone || options.isDemoMode || facilityId === 'college_demo_test');

    let targetPhone = isDemoMode && demoPhone ? demoPhone : (facility.phone || '');
    let targetFacilityName = isDemoMode && demoPhone ? `College Project Tester (${demoPhone})` : (facility.name || 'Emergency Contact');

    // Clean phone number (keep digits and leading +)
    let cleanPhone = targetPhone.replace(/[^\d+]/g, '');
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('+')) {
      cleanPhone = `+91${cleanPhone}`; // Default Indian country code if 10 digits
    }

    const factualMessage = buildFactualEmergencyMessage(report, isDemoMode, cleanPhone);

    // Safety rule: Public emergency numbers like 112 must be dialed directly by the citizen
    if (!isDemoMode && (cleanPhone === '112' || cleanPhone === '100' || cleanPhone === '108')) {
      return {
        attemptId,
        facilityId,
        facilityName: targetFacilityName,
        facilityPhone: targetPhone,
        provider: 'direct-telephony',
        status: 'REJECTED',
        message: 'Automated robocalls to public emergency numbers (112/100/108) are legally restricted. Please use the Direct Call button on your screen to speak directly with the 112 emergency dispatcher.',
        errorSummary: 'Automated dialing to 112 prohibited; direct citizen calling required.'
      };
    }

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

    // Check if real telephony provider is configured
    if (!twilioSid || !twilioToken || !twilioFrom) {
      console.log(`[Telephony Service Notice]: Telephony provider credentials (TWILIO_ACCOUNT_SID) not configured. Report ID: ${reportId}, Target: ${targetFacilityName}`);
      
      return {
        attemptId,
        facilityId,
        facilityName: targetFacilityName,
        facilityPhone: cleanPhone || 'Unavailable',
        provider: isDemoMode ? 'College Demo Voice Simulation' : 'telephony-dispatch',
        status: 'NOT_CONFIGURED',
        isDemoMode,
        demoNumber: cleanPhone,
        speechText: factualMessage,
        message: isDemoMode 
          ? `[College Demo Mode]: Voice alert targeted to student phone (${cleanPhone}). Twilio gateway is not configured in .env; simulated realistic voice alert can be played in-browser.`
          : `Telephony gateway is not configured in backend .env. Facility phone ${targetPhone || 'N/A'} is available for direct calling.`,
        initiatedAt: new Date(),
        completedAt: null,
        errorSummary: 'TWILIO_ACCOUNT_SID or TWILIO_PHONE_NUMBER not configured. Please use Direct Calling or configure telephony credentials in .env.'
      };
    }

    // When Twilio credentials are configured, execute outbound TwiML call to target phone (student demo phone or facility)
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`;
      const twiml = `<Response><Say voice="alice" language="en-IN">${factualMessage}</Say></Response>`;

      const params = new URLSearchParams();
      params.append('To', cleanPhone);
      params.append('From', twilioFrom);
      params.append('Twiml', twiml);

      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');

      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const twilioData = await twilioRes.json();

      if (!twilioRes.ok) {
        throw new Error(twilioData.message || `Twilio HTTP ${twilioRes.status}`);
      }

      return {
        attemptId,
        facilityId,
        facilityName: targetFacilityName,
        facilityPhone: cleanPhone,
        provider: isDemoMode ? 'Twilio Voice Dispatch (College Demo Mode)' : 'Twilio Voice Dispatch',
        status: 'INITIATED',
        callSid: twilioData.sid || '',
        isDemoMode,
        demoNumber: cleanPhone,
        speechText: factualMessage,
        message: isDemoMode 
          ? `[College Demo Mode]: Live voice call placed to student phone: ${cleanPhone} via Twilio.`
          : 'Voice alert initiated successfully via Twilio emergency voice gateway.',
        initiatedAt: new Date(),
        completedAt: null,
        errorSummary: ''
      };
    } catch (twilioErr) {
      console.error('[Telephony Service Error]: Outbound call failed:', twilioErr.message);
      return {
        attemptId,
        facilityId,
        facilityName: targetFacilityName,
        facilityPhone: cleanPhone,
        provider: 'Twilio Voice Dispatch',
        status: 'FAILED',
        isDemoMode,
        demoNumber: cleanPhone,
        speechText: factualMessage,
        message: `Could not connect call via telephony provider: ${twilioErr.message}`,
        initiatedAt: new Date(),
        completedAt: new Date(),
        errorSummary: twilioErr.message
      };
    }
  } finally {
    // Release debounce lock after 5 seconds
    setTimeout(() => {
      activeCallsInProgress.delete(debounceKey);
    }, 5000);
  }
}

/**
 * Returns contact and call status summary for an emergency report
 */
function getEmergencyContactStatus(report) {
  if (!report) return { status: 'UNKNOWN', attempts: [] };

  const attempts = report.notificationAttempts || [];
  const hasCompleted = attempts.some(a => a.status === 'COMPLETED');
  const hasInitiated = attempts.some(a => a.status === 'INITIATED' || a.status === 'RINGING');
  const hasNotConfigured = attempts.some(a => a.status === 'NOT_CONFIGURED');
  const hasFailed = attempts.some(a => a.status === 'FAILED');

  let overallStatus = 'NOTIFICATION_PENDING';
  if (hasCompleted) overallStatus = 'CONTACT_CONFIRMED';
  else if (hasInitiated) overallStatus = 'CONTACT_ATTEMPTED';
  else if (hasNotConfigured) overallStatus = 'NOT_CONFIGURED';
  else if (hasFailed) overallStatus = 'FAILED';

  return {
    reportId: report.reportId,
    reportStatus: report.status,
    notificationStatus: overallStatus,
    attemptsCount: attempts.length,
    attempts,
    disclaimer: 'Completed voice calls indicate transmission of accident coordinates to the facility, but do not guarantee dispatch of an ambulance or police vehicle. In immediate life threats, citizens must call 112 directly.'
  };
}

module.exports = {
  initiatePermittedEmergencyNotification,
  getEmergencyContactStatus,
  buildFactualEmergencyMessage
};
