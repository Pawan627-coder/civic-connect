/**
 * ========================================================
 * CIVIC CONNECT - EMERGENCY ACCIDENT RESPONSE TEST SUITE
 * backend/scripts/testEmergencyResponse.js
 * ========================================================
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { findNearestFacilities } = require('../services/emergencyFacilityService');
const { initiatePermittedEmergencyNotification, getEmergencyContactStatus } = require('../services/emergencyTelephonyService');
const { generateEmergencyIncidentSummary } = require('../services/geminiService');
const persistentStore = require('../utils/persistentStore');

async function runEmergencyTests() {
  console.log('===========================================================');
  console.log('🚨 CIVIC CONNECT: EMERGENCY ACCIDENT RESPONSE TEST SUITE');
  console.log('===========================================================');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✓ [PASS]: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL]: ${name} -> ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`✓ [PASS]: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL]: ${name} -> ${err.message}`);
      failed++;
    }
  }

  // TEST 1: Facility Discovery with Coordinates
  await testAsync('Find nearest facilities for Gorakhpur coordinates', async () => {
    const lat = 26.7606;
    const lng = 83.3732;
    const facilities = await findNearestFacilities(lat, lng, 15);
    assert(Array.isArray(facilities), 'Facilities should be an array');
    assert(facilities.length > 0, 'Should find at least 1 facility');
    assert(facilities[0].distanceKm !== undefined, 'Facilities should have distance in km');
    assert(facilities[0].type === 'hospital' || facilities[0].type === 'police', 'Facility type should be hospital or police');
    // Ensure sorted by distance
    for (let i = 1; i < facilities.length; i++) {
      assert(facilities[i].distanceKm >= facilities[i - 1].distanceKm, 'Facilities must be sorted by distance ascending');
    }
  });

  // TEST 2: Invalid Coordinates Rejection
  await testAsync('Reject invalid coordinates gracefully in facility search', async () => {
    try {
      await findNearestFacilities('invalid', null);
      assert.fail('Should have thrown an error for invalid coordinates');
    } catch (err) {
      assert(err.message.includes('Valid latitude'), 'Error message should explain invalid coordinates');
    }
  });

  // TEST 3: Emergency Report Creation Without Photos (Emergency Exception)
  test('Create emergency report without photos (Photos are optional)', () => {
    const mockReport = {
      reportId: `ACC-TEST-${Date.now()}-01`,
      reporterName: 'Test Citizen',
      location: {
        latitude: 26.7606,
        longitude: 83.3732,
        address: 'Gorakhpur Junction Station Road',
        accuracyMeters: 12,
        source: 'gps'
      },
      images: [], // Zero images!
      status: 'RECEIVED',
      createdAt: new Date().toISOString()
    };

    const saved = persistentStore.addEmergencyReport(mockReport);
    assert.strictEqual(saved.reportId, mockReport.reportId);
    assert.strictEqual(saved.images.length, 0, 'Report must be created with 0 photos');
  });

  // TEST 4: Emergency Report Creation With 3+ Photos
  test('Create emergency report with 3 photos', () => {
    const mockReport = {
      reportId: `ACC-TEST-${Date.now()}-02`,
      reporterName: 'Test Citizen',
      location: {
        latitude: 26.7606,
        longitude: 83.3732,
        address: 'Civil Lines Crossing',
        accuracyMeters: 8,
        source: 'gps'
      },
      images: [
        { url: 'data:image/jpeg;base64,sample1', name: 'front_damage.jpg', sizeBytes: 1024 },
        { url: 'data:image/jpeg;base64,sample2', name: 'rear_damage.jpg', sizeBytes: 1024 },
        { url: 'data:image/jpeg;base64,sample3', name: 'road_blockage.jpg', sizeBytes: 1024 }
      ],
      status: 'RECEIVED',
      createdAt: new Date().toISOString()
    };

    const saved = persistentStore.addEmergencyReport(mockReport);
    assert.strictEqual(saved.images.length, 3);
  });

  // TEST 5: Telephony Provider Missing Credentials Fallback
  await testAsync('Telephony gateway returns NOT_CONFIGURED when Twilio keys are empty', async () => {
    // Ensure TWILIO_ACCOUNT_SID is empty for test
    const oldSid = process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_ACCOUNT_SID;

    const mockReport = {
      reportId: 'ACC-TEST-TELEPHONY',
      location: { latitude: 26.7606, longitude: 83.3732, address: 'Test Location' }
    };
    const mockFacility = {
      id: 'fac_test_01',
      name: 'District Trauma Centre',
      phone: '0551-2334545'
    };

    const result = await initiatePermittedEmergencyNotification(mockReport, mockFacility);
    assert.strictEqual(result.status, 'NOT_CONFIGURED', 'Status must be NOT_CONFIGURED, not fake success');
    assert(result.message.includes('Telephony gateway is not configured'), 'Must give honest status message');

    // Restore
    if (oldSid) process.env.TWILIO_ACCOUNT_SID = oldSid;
  });

  // TEST 6: Automated 112 Dialing Prevention (Safety Requirement)
  await testAsync('Prevent automated dialing to public emergency 112/100/108 numbers', async () => {
    const mockReport = {
      reportId: 'ACC-TEST-112',
      location: { latitude: 26.7606, longitude: 83.3732, address: 'Highway Km 42' }
    };
    const publicHelpline = {
      id: 'fac_112',
      name: 'National Emergency Response 112',
      phone: '112'
    };

    const result = await initiatePermittedEmergencyNotification(mockReport, publicHelpline);
    assert.strictEqual(result.status, 'REJECTED', 'Automated dialing to 112 must be REJECTED');
    assert(result.message.includes('Direct Call button'), 'Must advise citizen to use Direct Call button');
  });

  // TEST 7: Duplicate Call Attempt Prevention (Debounce)
  await testAsync('Debounce rapid duplicate call attempts to same facility', async () => {
    const mockReport = {
      reportId: 'ACC-TEST-DEBOUNCE',
      location: { latitude: 26.7606, longitude: 83.3732, address: 'Test Site' }
    };
    const mockFacility = {
      id: 'fac_debounce_test',
      name: 'City Police Post',
      phone: '0551-2336214'
    };

    // First call
    const res1 = await initiatePermittedEmergencyNotification(mockReport, mockFacility);
    // Immediate duplicate call before lock released
    const res2 = await initiatePermittedEmergencyNotification(mockReport, mockFacility);

    assert.strictEqual(res2.status, 'REJECTED', 'Duplicate call within debounce window must be rejected');
    assert(res2.errorSummary.includes('Duplicate call request prevented'));
  });

  // TEST 8: Contact Status Breakdown & Life Safety Disclaimer
  test('Verify getEmergencyContactStatus provides honest status and disclaimer', () => {
    const mockReport = {
      reportId: 'ACC-STATUS-TEST',
      status: 'RECEIVED',
      notificationAttempts: [
        { status: 'NOT_CONFIGURED' }
      ]
    };

    const status = getEmergencyContactStatus(mockReport);
    assert.strictEqual(status.notificationStatus, 'NOT_CONFIGURED');
    assert(status.disclaimer.includes('In immediate life threats, citizens must call 112 directly'));
  });

  // TEST 9: Optional AI Incident Summary Generation
  await testAsync('AI Incident summary generates factual dispatch briefing', async () => {
    const reportData = {
      description: 'Head-on collision between delivery van and auto-rickshaw near flyover.',
      estimatedCasualties: 'Injuries Observed - Immediate Medical Needed',
      location: { address: 'Gorakhpur Flyover Gate 3' },
      images: [{ url: 'photo1.jpg' }]
    };

    const summary = await generateEmergencyIncidentSummary(reportData);
    assert(summary.summary, 'Summary should be generated');
    assert.strictEqual(summary.suggestedUrgency, 'Critical', 'Injuries observed should classify as Critical urgency');
    assert(summary.summary.includes('Gorakhpur Flyover Gate 3'), 'Summary must include factual address');
  });

  // TEST 10: Persistent Store Retrieval & ID lookup
  test('Lookup emergency report by ID in persistent store', () => {
    const targetId = `ACC-LOOKUP-${Date.now()}`;
    persistentStore.addEmergencyReport({
      reportId: targetId,
      status: 'RECEIVED',
      location: { latitude: 26.7, longitude: 83.3 }
    });

    const found = persistentStore.findEmergencyReportById(targetId);
    assert(found !== null, 'Report should be retrievable by ID');
    assert.strictEqual(found.reportId, targetId);
  });

  console.log('===========================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runEmergencyTests();
