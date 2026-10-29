const http = require('http');

async function testApi() {
  console.log('--- Testing Emergency Accident System & College Demo Mode ---');

  // Test 1: Submission without photo (MUST FAIL with 400 Bad Request)
  const noPhotoPayload = JSON.stringify({
    latitude: 26.7606,
    longitude: 83.3732,
    address: 'Near Transport Nagar, Gorakhpur',
    description: 'Test accident without photo',
    images: [] // empty!
  });

  console.log('\n[Test 1]: Attempting submission WITHOUT mandatory photo...');
  const res1 = await makePostRequest('/api/emergency-reports', noPhotoPayload);
  console.log(`Status: ${res1.statusCode}`);
  console.log(`Response:`, res1.data);
  if (res1.statusCode === 400 && res1.data.message.includes('mandatory')) {
    console.log('✓ PASS: Photo mandatory validation blocked empty submission as required.');
  } else {
    console.error('✗ FAIL: Mandatory photo validation did not trigger 400');
  }

  // Test 2: Submission WITH live photo
  const dummyBase64 = 'data:image/jpeg;base64,' + Buffer.from('mock_live_crash_scene_jpeg_data').toString('base64');
  const validPayload = JSON.stringify({
    latitude: 26.7606,
    longitude: 83.3732,
    address: 'NH-28 Medical Road Junction, Gorakhpur',
    accuracyMeters: 8,
    locationSource: 'gps',
    estimatedCasualties: 'Injuries Observed - Immediate Medical Needed',
    description: 'Collision between two motorbikes at intersection.',
    demoReceiverNumber: '+919876543210',
    images: [{ url: dummyBase64, name: 'live_crash_scene_1.jpg', sizeBytes: 1024 }],
    isGenuineConfirmed: true
  });

  console.log('\n[Test 2]: Submitting WITH mandatory live photo & demo receiver number...');
  const res2 = await makePostRequest('/api/emergency-reports', validPayload);
  console.log(`Status: ${res2.statusCode}`);
  console.log(`Report ID:`, res2.data.reportId);
  console.log(`Status:`, res2.data.status);

  if (res2.statusCode === 201 && res2.data.reportId) {
    console.log('✓ PASS: Emergency report created successfully with live photo evidence!');
    const reportId = res2.data.reportId;

    // Test 3: College Viva Demo Call Trigger
    console.log(`\n[Test 3]: Triggering College Viva Demo Call for ${reportId} to student number +919876543210...`);
    const demoPayload = JSON.stringify({ demoReceiverNumber: '+919876543210' });
    const res3 = await makePostRequest(`/api/emergency-reports/${reportId}/demo-call`, demoPayload);
    console.log(`Demo Call Status: ${res3.statusCode}`);
    console.log(`Attempt Provider:`, res3.data.attempt && res3.data.attempt.provider);
    console.log(`Demo Phone:`, res3.data.attempt && res3.data.attempt.demoNumber);
    console.log(`Simulated Speech Text:`, res3.data.speechText || (res3.data.attempt && res3.data.attempt.speechText));
    if (res3.statusCode === 200 && (res3.data.speechText || (res3.data.attempt && res3.data.attempt.speechText))) {
      console.log('✓ PASS: College viva demo call & speech simulation generated successfully!');
    }
  } else {
    console.error('✗ FAIL: Could not create valid report');
  }

  console.log('\n--- Test Suite Complete ---');
}

function makePostRequest(path, dataString) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
}

testApi().catch(console.error);
