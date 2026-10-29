/**
 * ========================================================
 * CIVIC CONNECT - EMERGENCY ACCIDENT RESPONSE CONTROLLER
 * emergency-report.js
 * ========================================================
 * 
 * Features:
 * 1. Live WebRTC Camera Viewfinder HUD (strict live capture, no gallery uploads).
 * 2. Mobile Direct Hardware Camera Sensor Fallback (capture="environment").
 * 3. Automatic GPS Geolocation Update upon camera snapshot.
 * 4. Image Watermarking (Date/Time + GPS Coordinates overlay).
 * 5. Mandatory Image Validation (1+ live photo strictly enforced).
 * 6. College Project Viva Demonstration Mode:
 *    - Automated voice calls routed to student's test phone.
 *    - Real-time in-browser speech synthesizer preview for viva presentations.
 * 7. Interactive Leaflet Emergency Map with animated radar accuracy ring.
 * 8. Reverse Geocoded Landmark Address Resolution.
 */

document.addEventListener('DOMContentLoaded', () => {

  // Default coordinate (India geographic center / Gorakhpur regional hub)
  const DEFAULT_LAT = 26.7606;
  const DEFAULT_LNG = 83.3732;

  // DOM Elements - Screen 1 (Form)
  const emergencyFormSection = document.getElementById('emergencyFormSection');
  const emergencyReportForm = document.getElementById('emergencyReportForm');
  const getAccidentLocationBtn = document.getElementById('getAccidentLocationBtn');
  const retryAccidentLocationBtn = document.getElementById('retryAccidentLocationBtn');
  const locationStatusText = document.getElementById('locationStatusText');
  const accidentAddressInput = document.getElementById('accidentAddressInput');
  const genuineConfirmCheck = document.getElementById('genuineConfirmCheck');
  const submitEmergencyBtn = document.getElementById('submitEmergencyBtn');
  const submitSpinner = document.getElementById('submitSpinner');
  const submitBtnText = document.getElementById('submitBtnText');

  // Coordinate Chips & HUD Telemetry
  const displayLatitude = document.getElementById('displayLatitude');
  const displayLongitude = document.getElementById('displayLongitude');
  const displayAccuracy = document.getElementById('displayAccuracy');
  const displayCaptureTime = document.getElementById('displayCaptureTime');
  const hudTimestamp = document.getElementById('hudTimestamp');
  const hudCoordsSnippet = document.getElementById('hudCoordsSnippet');
  const hudGpsTag = document.getElementById('hudGpsTag');
  const cameraStateLabel = document.getElementById('cameraStateLabel');

  // Live Camera DOM Elements
  const liveCameraFeed = document.getElementById('liveCameraFeed');
  const cameraCaptureCanvas = document.getElementById('cameraCaptureCanvas');
  const cameraFlashOverlay = document.getElementById('cameraFlashOverlay');
  const cameraOffPlaceholder = document.getElementById('cameraOffPlaceholder');
  const btnSnapLivePhoto = document.getElementById('btnSnapLivePhoto');
  const btnSwitchCamera = document.getElementById('btnSwitchCamera');
  const btnToggleCameraStream = document.getElementById('btnToggleCameraStream');
  const toggleCamText = document.getElementById('toggleCamText');
  const btnRestartCamera = document.getElementById('btnRestartCamera');
  const mobileDirectCameraInput = document.getElementById('mobileDirectCameraInput');
  const btnTriggerMobileSensor = document.getElementById('btnTriggerMobileSensor');
  const photoReqIndicator = document.getElementById('photoReqIndicator');
  const photoReqText = document.getElementById('photoReqText');
  const capturedLivePhotosReel = document.getElementById('capturedLivePhotosReel');

  // College Viva Demo Bar DOM
  const demoReceiverPhoneInput = document.getElementById('demoReceiverPhoneInput');
  const btnSaveDemoPhone = document.getElementById('btnSaveDemoPhone');

  // Incident Severity Chips
  const severityChipsGrid = document.getElementById('severityChipsGrid');
  const estimatedCasualtiesSelect = document.getElementById('estimatedCasualtiesSelect');

  // DOM Elements - Screen 2 (Response Dashboard)
  const emergencyResponseSection = document.getElementById('emergencyResponseSection');
  const resReportStatus = document.getElementById('resReportStatus');
  const resReportId = document.getElementById('resReportId');
  const copyReportIdBtn = document.getElementById('copyReportIdBtn');
  const resCoordsSnippet = document.getElementById('resCoordsSnippet');
  const resFacilitiesCount = document.getElementById('resFacilitiesCount');
  const facilitiesList = document.getElementById('facilitiesList');
  const resContactState = document.getElementById('resContactState');
  const resLocationAddress = document.getElementById('resLocationAddress');
  const resImagesCount = document.getElementById('resImagesCount');
  const resEvidenceGrid = document.getElementById('resEvidenceGrid');
  const notificationAttemptsList = document.getElementById('notificationAttemptsList');
  const refreshStatusBtn = document.getElementById('refreshStatusBtn');

  // Viva Demo Voice Dispatch Card Elements
  const vivaActiveTargetPhone = document.getElementById('vivaActiveTargetPhone');
  const btnTriggerDemoCall = document.getElementById('btnTriggerDemoCall');
  const demoCallSpinner = document.getElementById('demoCallSpinner');
  const btnPlaySpeechDispatch = document.getElementById('btnPlaySpeechDispatch');
  const speechTranscriptBox = document.getElementById('speechTranscriptBox');
  const speechTranscriptText = document.getElementById('speechTranscriptText');

  // State Variables
  let leafletMap = null;
  let accidentMarker = null;
  let accuracyCircle = null;

  let currentLat = null;
  let currentLng = null;
  let currentAccuracy = null;
  let currentCaptureTime = null;
  let currentLocationSource = 'manual';

  let cameraMediaStream = null;
  let currentFacingMode = 'environment'; // 'environment' (rear lens) or 'user' (front)
  let isCameraActive = false;
  let capturedPhotos = []; // Array of { dataUrl, name, sizeBytes, lat, lng, timestamp }

  let activeReportId = null;
  let activeReportData = null;
  let statusPollInterval = null;
  let latestSpeechTranscript = '';

  // Demo Receiver Phone Initialization
  let demoReceiverPhone = localStorage.getItem('civic_demo_receiver_phone') || '+919876543210';
  if (demoReceiverPhoneInput) {
    demoReceiverPhoneInput.value = demoReceiverPhone;
  }
  if (vivaActiveTargetPhone) {
    vivaActiveTargetPhone.textContent = demoReceiverPhone;
  }

  /* ========================================================
   * 1. LIVE HUD CLOCK
   * ======================================================== */
  function updateHudClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (hudTimestamp) hudTimestamp.textContent = timeStr;
  }
  setInterval(updateHudClock, 1000);
  updateHudClock();

  /* ========================================================
   * 2. WEBRTC LIVE CAMERA STREAM CONTROLLER
   * ======================================================== */
  async function startLiveCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[Live Camera]: getUserMedia not supported in this browser.');
      showCameraFallback();
      return;
    }

    // Stop any existing stream
    stopLiveCameraStream();

    try {
      const constraints = {
        video: {
          facingMode: { ideal: currentFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraMediaStream = stream;

      if (liveCameraFeed) {
        liveCameraFeed.srcObject = stream;
        await liveCameraFeed.play().catch(e => console.log('Autoplay handled:', e));
      }

      isCameraActive = true;
      if (cameraOffPlaceholder) cameraOffPlaceholder.style.display = 'none';
      if (liveCameraFeed) liveCameraFeed.style.display = 'block';
      if (cameraStateLabel) cameraStateLabel.textContent = currentFacingMode === 'environment' ? 'LIVE REAR SENSOR' : 'LIVE FRONT SENSOR';
      if (toggleCamText) toggleCamText.textContent = 'Stop Cam';

    } catch (err) {
      console.warn('[Live Camera]: Camera access error:', err.message);
      showCameraFallback();
    }
  }

  function stopLiveCameraStream() {
    if (cameraMediaStream) {
      cameraMediaStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      cameraMediaStream = null;
    }
    isCameraActive = false;
  }

  function showCameraFallback() {
    stopLiveCameraStream();
    if (liveCameraFeed) liveCameraFeed.style.display = 'none';
    if (cameraOffPlaceholder) cameraOffPlaceholder.style.display = 'flex';
    if (cameraStateLabel) cameraStateLabel.textContent = 'HARDWARE STANDBY';
    if (toggleCamText) toggleCamText.textContent = 'Start Cam';
  }

  function toggleCameraStream() {
    if (isCameraActive) {
      showCameraFallback();
    } else {
      startLiveCamera();
    }
  }

  function switchCameraLens() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    startLiveCamera();
  }

  // Audio Shutter Feedback (Web Audio API synthetic click)
  function playShutterSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);
    } catch (e) {
      // AudioContext fallback
    }
  }

  /* ========================================================
   * 3. SNAP LIVE PHOTO & AUTOMATIC GPS UPDATE
   * ======================================================== */
  function snapLivePhoto() {
    const MAX_ALLOWED = 3;
    if (capturedPhotos.length >= MAX_ALLOWED) {
      alert(`Maximum ${MAX_ALLOWED} live accident photographs allowed.`);
      return;
    }

    if (!isCameraActive || !liveCameraFeed || liveCameraFeed.videoWidth === 0) {
      // If WebRTC is inactive, launch the direct mobile camera sensor
      if (mobileDirectCameraInput) {
        mobileDirectCameraInput.click();
      } else {
        alert('Please activate your camera stream or use the Mobile Direct Snap button.');
      }
      return;
    }

    // 1. Trigger Shutter Flash Animation & Sound
    playShutterSound();
    if (cameraFlashOverlay) {
      cameraFlashOverlay.classList.add('flashing');
      setTimeout(() => cameraFlashOverlay.classList.remove('flashing'), 100);
    }

    // 2. Draw Current Video Frame onto Canvas
    const canvas = cameraCaptureCanvas || document.createElement('canvas');
    const width = liveCameraFeed.videoWidth || 1280;
    const height = liveCameraFeed.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(liveCameraFeed, 0, 0, width, height);

    // 3. Watermark Canvas with Timestamp & Telemetry Stamp
    const captureTimestamp = new Date();
    const timeString = captureTimestamp.toLocaleString('en-IN');
    const coordsStamp = currentLat && currentLng ? `GPS: ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}` : 'GPS: Syncing on Shutter...';

    // Draw dark semi-transparent banner on bottom of photo
    const bannerHeight = Math.max(38, Math.round(height * 0.08));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

    // Draw watermark text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(14, Math.round(bannerHeight * 0.38))}px monospace`;
    ctx.fillText(`🚨 CIVIC CONNECT EVIDENCE • ${timeString}`, 16, height - bannerHeight + (bannerHeight * 0.42));

    ctx.fillStyle = '#38bdf8';
    ctx.font = `${Math.max(12, Math.round(bannerHeight * 0.32))}px monospace`;
    ctx.fillText(`📍 ${coordsStamp} • AUTHENTIC LIVE CAMERA CAPTURE`, 16, height - (bannerHeight * 0.22));

    // Convert to JPEG data URL
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const photoItem = {
      dataUrl: photoDataUrl,
      name: `live_crash_scene_${Date.now()}.jpg`,
      sizeBytes: Math.round((photoDataUrl.length * 3) / 4),
      timestamp: captureTimestamp.toISOString(),
      lat: currentLat,
      lng: currentLng
    };

    capturedPhotos.push(photoItem);
    renderCapturedPhotosReel();
    updatePhotoRequirementStatus();

    // 4. CRITICAL REQUIREMENT: AUTOMATICALLY UPDATE GPS LOCATION AT POINT OF ACCIDENT!
    triggerAutoGpsSyncOnCapture();
  }

  // Automatic GPS acquisition triggered immediately upon taking photo
  function triggerAutoGpsSyncOnCapture() {
    if (hudGpsTag) {
      hudGpsTag.innerHTML = `<span>🛰️ LOCKING ACCIDENT GPS...</span>`;
      hudGpsTag.style.borderColor = '#eab308';
      hudGpsTag.style.color = '#fef08a';
    }

    if (locationStatusText) {
      locationStatusText.innerHTML = `📸 <strong>Live photo captured!</strong> 📍 Synchronizing GPS location at point of accident...`;
      locationStatusText.style.color = '#0284c7';
    }

    captureCurrentLocation({
      isFromPhotoCapture: true,
      onComplete: (lat, lng, accuracy) => {
        if (hudGpsTag) {
          hudGpsTag.innerHTML = `<span>✓ GPS LOCKED (±${accuracy}m)</span>`;
          hudGpsTag.style.borderColor = '#22c55e';
          hudGpsTag.style.color = '#86efac';
        }
        if (hudCoordsSnippet) {
          hudCoordsSnippet.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)} (±${accuracy}m)`;
        }
        showToast('📍 Accident Location Synchronized', `Coordinates locked at crash site: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, 'success');
      }
    });
  }

  // Mobile Hardware Camera Sensor Fallback handler
  if (mobileDirectCameraInput) {
    mobileDirectCameraInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = cameraCaptureCanvas || document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // Add evidence watermark
          const bannerHeight = Math.max(38, Math.round(img.height * 0.08));
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(0, img.height - bannerHeight, img.width, bannerHeight);

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(14, Math.round(bannerHeight * 0.38))}px monospace`;
          ctx.fillText(`🚨 CIVIC CONNECT EVIDENCE • ${new Date().toLocaleString('en-IN')}`, 16, img.height - bannerHeight + (bannerHeight * 0.42));

          const stampedUrl = canvas.toDataURL('image/jpeg', 0.88);
          capturedPhotos.push({
            dataUrl: stampedUrl,
            name: file.name || `mobile_snap_${Date.now()}.jpg`,
            sizeBytes: file.size,
            timestamp: new Date().toISOString(),
            lat: currentLat,
            lng: currentLng
          });

          renderCapturedPhotosReel();
          updatePhotoRequirementStatus();
          triggerAutoGpsSyncOnCapture();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderCapturedPhotosReel() {
    if (!capturedLivePhotosReel) return;
    capturedLivePhotosReel.innerHTML = '';

    capturedPhotos.forEach((item, index) => {
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Recently';
      const gpsLabel = item.lat && item.lng ? `📍 ${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` : '📍 Location Synced';

      const card = document.createElement('div');
      card.className = 'captured-photo-card';
      card.innerHTML = `
        <div class="photo-thumbnail-wrap">
          <img src="${item.dataUrl}" alt="Live Crash Scene ${index + 1}">
          <button type="button" class="btn-remove-photo-card" data-index="${index}" title="Delete & retake photo">✕</button>
          <div class="photo-card-watermark">
            <span>LIVE SNAP #${index + 1}</span>
            <span>${timeStr}</span>
          </div>
        </div>
        <div class="photo-card-meta">
          <div class="photo-meta-title">Verified Scene Photo</div>
          <div class="photo-meta-gps">${gpsLabel}</div>
        </div>
      `;
      capturedLivePhotosReel.appendChild(card);
    });
  }

  // Remove photo handler
  if (capturedLivePhotosReel) {
    capturedLivePhotosReel.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.btn-remove-photo-card');
      if (removeBtn) {
        const idx = parseInt(removeBtn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          capturedPhotos.splice(idx, 1);
          renderCapturedPhotosReel();
          updatePhotoRequirementStatus();
        }
      }
    });
  }

  // Mandatory Requirement Live Badge Update
  function updatePhotoRequirementStatus() {
    const count = capturedPhotos.length;
    if (count >= 1) {
      if (photoReqIndicator) {
        photoReqIndicator.className = 'photo-status-indicator req-met';
        photoReqIndicator.innerHTML = `<span>✓</span> <strong>${count} / 3 Live Photos Captured (Mandatory Requirement Met)</strong>`;
      }
      if (submitEmergencyBtn) {
        submitEmergencyBtn.disabled = false;
        if (submitBtnText) submitBtnText.textContent = '🚨 Submit Emergency Accident Report';
      }
    } else {
      if (photoReqIndicator) {
        photoReqIndicator.className = 'photo-status-indicator req-unmet';
        photoReqIndicator.innerHTML = `<span>⚠️</span> <strong>0 / 3 Live Photos Captured (At least 1 live photo is required to submit)</strong>`;
      }
    }
  }

  /* ========================================================
   * 4. INTERACTIVE LEAFLET MAP & PIN
   * ======================================================== */
  function initAccidentMap() {
    const mapContainer = document.getElementById('accidentLeafletMap');
    if (!mapContainer || !window.L) return;

    try {
      leafletMap = L.map('accidentLeafletMap').setView([DEFAULT_LAT, DEFAULT_LNG], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(leafletMap);

      // Custom Red Emergency Teardrop Icon
      const emergencyIcon = L.divIcon({
        className: 'accident-map-pin',
        html: `
          <div style="
            width: 32px; 
            height: 40px; 
            display: flex; 
            flex-direction: column; 
            align-items: center;
            filter: drop-shadow(0 4px 8px rgba(220, 38, 38, 0.45));
            cursor: grab;
          ">
            <svg width="32" height="40" viewBox="0 0 24 30" fill="none">
              <path d="M12 0C5.37 0 0 5.37 0 12C0 19.5 12 30 12 30C12 30 24 19.5 24 12C24 5.37 18.63 0 12 0Z" fill="#dc2626" stroke="#ffffff" stroke-width="1.4"/>
              <circle cx="12" cy="11" r="5.5" fill="#ffffff"/>
              <text x="12" y="15" font-size="11" font-weight="900" font-family="sans-serif" text-anchor="middle" fill="#dc2626">!</text>
            </svg>
          </div>
        `,
        iconSize: [32, 40],
        iconAnchor: [16, 40]
      });

      accidentMarker = L.marker([DEFAULT_LAT, DEFAULT_LNG], {
        draggable: true,
        icon: emergencyIcon
      }).addTo(leafletMap);

      // Drag listener
      accidentMarker.on('dragend', () => {
        const pos = accidentMarker.getLatLng();
        setPinnedCoordinates(pos.lat, pos.lng, 'manual', null, new Date().toISOString(), true);
      });

      // Map click listener
      leafletMap.on('click', (e) => {
        accidentMarker.setLatLng(e.latlng);
        setPinnedCoordinates(e.latlng.lat, e.latlng.lng, 'manual', null, new Date().toISOString(), true);
      });

      // Initialize default pin
      setPinnedCoordinates(DEFAULT_LAT, DEFAULT_LNG, 'manual', null, new Date().toISOString(), true);
    } catch (err) {
      console.error('[Emergency Map Error]:', err);
    }
  }

  function setPinnedCoordinates(lat, lng, source = 'manual', accuracy = null, timestamp = null, doReverseGeocode = true) {
    currentLat = parseFloat(lat);
    currentLng = parseFloat(lng);
    currentLocationSource = source;
    currentAccuracy = accuracy ? Math.round(accuracy) : null;
    currentCaptureTime = timestamp || new Date().toISOString();

    // Update Chip Displays
    if (displayLatitude) displayLatitude.textContent = currentLat.toFixed(6);
    if (displayLongitude) displayLongitude.textContent = currentLng.toFixed(6);

    if (displayAccuracy) {
      if (currentAccuracy !== null) {
        displayAccuracy.textContent = `±${currentAccuracy}m (${currentAccuracy <= 25 ? 'High' : (currentAccuracy <= 60 ? 'Moderate' : 'Coarse')})`;
        displayAccuracy.style.color = currentAccuracy <= 50 ? '#15803d' : '#b45309';
      } else {
        displayAccuracy.textContent = 'Manual Pin';
        displayAccuracy.style.color = '#64748b';
      }
    }

    const timeObj = new Date(currentCaptureTime);
    if (displayCaptureTime) {
      displayCaptureTime.textContent = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Update Leaflet marker position & accuracy circle
    if (accidentMarker && leafletMap) {
      accidentMarker.setLatLng([currentLat, currentLng]);

      if (accuracyCircle) leafletMap.removeLayer(accuracyCircle);
      if (source === 'gps' && currentAccuracy) {
        accuracyCircle = L.circle([currentLat, currentLng], {
          radius: currentAccuracy,
          color: currentAccuracy <= 50 ? '#15803d' : '#d97706',
          fillColor: currentAccuracy <= 50 ? '#86efac' : '#fed7aa',
          fillOpacity: 0.22,
          weight: 1.5
        }).addTo(leafletMap);
      }
    }

    if (source === 'gps') {
      if (locationStatusText) {
        locationStatusText.innerHTML = `✓ <strong>GPS Location Locked:</strong> ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)} (±${currentAccuracy}m precision)`;
        locationStatusText.style.color = '#15803d';
      }
    } else {
      if (locationStatusText) {
        locationStatusText.textContent = `📍 Map pin set: ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`;
        locationStatusText.style.color = '#0369a1';
      }
    }

    // Reverse Geocode to Landmark
    if (doReverseGeocode) {
      reverseGeocodeAccidentSite(currentLat, currentLng);
    }
  }

  function captureCurrentLocation(options = {}) {
    if (!('geolocation' in navigator)) {
      if (locationStatusText) {
        locationStatusText.textContent = '⚠️ Geolocation sensor is not supported by your browser. Please tap the map to pin crash location.';
        locationStatusText.style.color = '#dc2626';
      }
      return;
    }

    if (getAccidentLocationBtn) {
      getAccidentLocationBtn.disabled = true;
      getAccidentLocationBtn.innerHTML = `<span>⏳ Acquiring GPS...</span>`;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (getAccidentLocationBtn) {
          getAccidentLocationBtn.disabled = false;
          getAccidentLocationBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg><span>Acquire High-Accuracy GPS</span>`;
        }
        if (retryAccidentLocationBtn) retryAccidentLocationBtn.style.display = 'none';

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy);
        const time = new Date(position.timestamp || Date.now()).toISOString();

        setPinnedCoordinates(lat, lng, 'gps', accuracy, time, true);

        if (leafletMap) {
          leafletMap.setView([lat, lng], 17, { animate: true });
        }

        if (typeof options.onComplete === 'function') {
          options.onComplete(lat, lng, accuracy);
        }
      },
      (error) => {
        if (getAccidentLocationBtn) {
          getAccidentLocationBtn.disabled = false;
          getAccidentLocationBtn.innerHTML = `<span>Acquire High-Accuracy GPS</span>`;
        }
        if (retryAccidentLocationBtn) retryAccidentLocationBtn.style.display = 'inline-flex';

        let errReason = 'Unable to get GPS location.';
        if (error.code === error.PERMISSION_DENIED) {
          errReason = 'Location permission was denied. Please tap the map to place manual pin.';
        } else if (error.code === error.TIMEOUT) {
          errReason = 'GPS request timed out. Retrying or manual map pin recommended.';
        }

        if (locationStatusText) {
          locationStatusText.textContent = `⚠️ ${errReason}`;
          locationStatusText.style.color = '#dc2626';
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  }

  // Reverse Geocoding with OpenStreetMap Nominatim
  let reverseGeocodeAbort = null;
  async function reverseGeocodeAccidentSite(lat, lng) {
    if (reverseGeocodeAbort) {
      try { reverseGeocodeAbort.abort(); } catch (e) {}
    }
    reverseGeocodeAbort = new AbortController();

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'CivicConnect-EmergencyAccident/2.0' },
        signal: reverseGeocodeAbort.signal
      });

      if (!response.ok) return;
      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        const parts = [];
        if (addr.amenity || addr.building || addr.shop || addr.tourism) parts.push(addr.amenity || addr.building || addr.shop || addr.tourism);
        if (addr.road) parts.push(addr.road);
        if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
        if (addr.city || addr.town || addr.district) parts.push(addr.city || addr.town || addr.district);

        const formatted = parts.length > 0 ? parts.join(', ') : data.display_name;
        if (accidentAddressInput) {
          accidentAddressInput.value = formatted;
        }
      }
    } catch (err) {
      // Non-blocking fallback
    }
  }

  /* ========================================================
   * 5. SEVERITY CHIPS QUICK SELECTOR
   * ======================================================== */
  if (severityChipsGrid) {
    severityChipsGrid.addEventListener('click', (e) => {
      const chip = e.target.closest('.severity-chip') || e.target.closest('.severity-select-card');
      if (!chip) return;

      severityChipsGrid.querySelectorAll('.severity-chip, .severity-select-card').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const val = chip.getAttribute('data-val');
      if (estimatedCasualtiesSelect) {
        estimatedCasualtiesSelect.value = val;
      }
    });
  }

  /* ========================================================
   * 6. COLLEGE VIVA DEMO PHONE CONTROLLER
   * ======================================================== */
  if (btnSaveDemoPhone) {
    btnSaveDemoPhone.addEventListener('click', () => {
      const phoneVal = (demoReceiverPhoneInput.value || '').trim();
      if (!phoneVal) {
        alert('Please enter a valid student test phone number (e.g. +91 98765 43210)');
        return;
      }
      demoReceiverPhone = phoneVal;
      localStorage.setItem('civic_demo_receiver_phone', phoneVal);
      if (vivaActiveTargetPhone) vivaActiveTargetPhone.textContent = phoneVal;
      showToast('Demo Number Updated', `Outbound voice alerts will target: ${phoneVal}`, 'success');
    });
  }

  /* ========================================================
   * 7. FORM SUBMISSION WORKFLOW WITH MANDATORY PHOTO CHECK
   * ======================================================== */
  if (emergencyReportForm) {
    emergencyReportForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // 1. MANDATORY LIVE PHOTO CHECK (STRICT REQUIREMENT)
      if (capturedPhotos.length === 0) {
        alert('⚠️ MANDATORY REQUIREMENT:\n\nA live photograph of the accident scene is strictly required to verify collision telemetry.\n\nPlease snap at least 1 live photo using the camera viewfinder in Step 1 before submitting.');
        if (cameraHudContainer) {
          cameraHudContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // 2. COORDINATES CHECK
      if (!currentLat || !currentLng) {
        alert('Please lock the accident coordinates by snapping a photo or tapping "Acquire GPS".');
        return;
      }

      const addressVal = (accidentAddressInput.value || '').trim();
      if (!addressVal) {
        alert('Please specify a landmark or street address for incoming emergency responders.');
        accidentAddressInput.focus();
        return;
      }

      if (!genuineConfirmCheck.checked) {
        alert('Please confirm that you are submitting an authentic emergency accident report.');
        return;
      }

      // Pre-submission confirmation dialog
      const confirmed = confirm(
        `🚨 CONFIRM EMERGENCY ACCIDENT SUBMISSION:\n\n` +
        `• Location: ${addressVal}\n` +
        `• GPS Coordinates: ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}\n` +
        `• Live Photos Attached: ${capturedPhotos.length} photo(s)\n` +
        `• Viva Demo Receiver: ${demoReceiverPhone}\n\n` +
        `Transmit this emergency accident report now?`
      );

      if (!confirmed) return;

      submitEmergencyBtn.disabled = true;
      if (submitSpinner) submitSpinner.style.display = 'inline-block';

      try {
        const payload = {
          latitude: currentLat,
          longitude: currentLng,
          address: addressVal,
          accuracyMeters: currentAccuracy,
          locationCapturedAt: currentCaptureTime,
          locationSource: currentLocationSource,
          description: document.getElementById('accidentDescriptionInput').value.trim() || 'Road accident verified with live scene photos.',
          estimatedCasualties: estimatedCasualtiesSelect.value,
          reporterPhone: document.getElementById('reporterPhoneInput').value.trim(),
          demoReceiverNumber: demoReceiverPhone,
          images: capturedPhotos.map(p => ({
            url: p.dataUrl,
            name: p.name,
            sizeBytes: p.sizeBytes
          })),
          isGenuineConfirmed: true
        };

        const fetchFn = window.civicFetch || fetch;
        const res = await fetchFn('/api/emergency-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || `Server returned HTTP ${res.status}`);
        }

        // Switch to Screen 2: Emergency Response Dashboard
        activeReportId = data.reportId;
        activeReportData = data.data;

        // Stop camera stream to free hardware resources
        stopLiveCameraStream();

        renderEmergencyResponseScreen(data);
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } catch (err) {
        console.error('[Emergency Submit Error]:', err);
        alert(
          `⚠️ EMERGENCY NOTICE:\n\n` +
          `Report submission encountered an issue (${err.message}).\n\n` +
          `IF ANYONE IS INJURED OR IN DANGER, PLEASE CALL 112 IMMEDIATELY FROM YOUR PHONE.`
        );
      } finally {
        submitEmergencyBtn.disabled = false;
        if (submitSpinner) submitSpinner.style.display = 'none';
      }
    });
  }

  /* ========================================================
   * 8. SCREEN 2: RESPONSE DASHBOARD RENDERING
   * ======================================================== */
  function renderEmergencyResponseScreen(data) {
    emergencyFormSection.style.display = 'none';
    emergencyResponseSection.style.display = 'block';

    const report = data.data || {};
    resReportStatus.textContent = report.status || 'RECEIVED';
    resReportId.textContent = data.reportId || 'ACC-2026';
    resCoordsSnippet.textContent = `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`;
    resLocationAddress.textContent = report.location ? report.location.address : 'Pinned Coordinates';
    resImagesCount.textContent = `${capturedPhotos.length} Live Photo(s) Attached`;

    if (vivaActiveTargetPhone) {
      vivaActiveTargetPhone.textContent = demoReceiverPhone;
    }

    // Render Evidence Thumbnails in Dashboard
    if (resEvidenceGrid) {
      resEvidenceGrid.innerHTML = '';
      capturedPhotos.forEach(p => {
        const thumb = document.createElement('div');
        thumb.className = 'res-evidence-thumb';
        thumb.innerHTML = `<img src="${p.dataUrl}" alt="Live Evidence">`;
        resEvidenceGrid.appendChild(thumb);
      });
    }

    // Render Suggested Nearby Facilities
    const facilities = report.nearbyFacilities || [];
    resFacilitiesCount.textContent = `${facilities.length} Suggested`;

    if (facilitiesList) {
      facilitiesList.innerHTML = '';
      if (facilities.length === 0) {
        facilitiesList.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.9rem;">
            No nearby facilities found within 15 km radius. Please dial <strong>112</strong> directly.
          </div>
        `;
      } else {
        facilities.forEach(fac => {
          const isHospital = fac.type === 'hospital';
          const typeClass = isHospital ? 'hospital' : 'police';
          const typeLabel = isHospital ? '🏥 Hospital' : '👮 Police';

          const card = document.createElement('div');
          card.className = 'facility-item-card';
          card.innerHTML = `
            <div class="fac-card-top">
              <span class="fac-type-pill ${typeClass}">${typeLabel}</span>
              <span class="fac-distance-badge">📍 ${fac.distanceKm} km away</span>
            </div>
            <h4 class="fac-name">${escapeHtml(fac.name)}</h4>
            <p class="fac-address">${escapeHtml(fac.address)}</p>
            <div class="fac-actions-row">
              ${fac.phone ? `
                <a href="tel:${escapeHtml(fac.phone)}" class="btn-fac-call">
                  📞 Call (${escapeHtml(fac.phone)})
                </a>
              ` : ''}
              <button type="button" class="btn-fac-alert" data-facility-id="${escapeHtml(fac.id)}" data-facility-name="${escapeHtml(fac.name)}">
                🚨 Request Voice Alert
              </button>
              <a href="${fac.mapUrl}" target="_blank" rel="noopener" class="btn-fac-directions">
                🗺️ Directions
              </a>
            </div>
          `;
          facilitiesList.appendChild(card);
        });
      }
    }

    // Render Initial Attempts Audit
    renderNotificationAttempts(report.notificationAttempts || []);

    // Start polling status
    startStatusPolling(data.reportId);
  }

  /* ========================================================
   * 9. COLLEGE VIVA DEMO VOICE CALL & SPEECH SYNTHESIS
   * ======================================================== */
  if (btnTriggerDemoCall) {
    btnTriggerDemoCall.addEventListener('click', async () => {
      if (!activeReportId) return;

      btnTriggerDemoCall.disabled = true;
      if (demoCallSpinner) demoCallSpinner.style.display = 'inline-block';

      try {
        const fetchFn = window.civicFetch || fetch;
        const res = await fetchFn(`/api/emergency-reports/${activeReportId}/demo-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demoReceiverNumber: demoReceiverPhone })
        });

        const data = await res.json();

        if (data.success && data.attempt) {
          latestSpeechTranscript = data.speechText || data.attempt.speechText || '';
          if (latestSpeechTranscript && speechTranscriptBox && speechTranscriptText) {
            speechTranscriptBox.style.display = 'block';
            speechTranscriptText.textContent = latestSpeechTranscript;
          }

          alert(`🎓 COLLEGE DEMO CALL STATUS: ${data.attempt.status}\n\n${data.attempt.message}\n\nTarget Phone: ${demoReceiverPhone}`);
          fetchLatestContactStatus(activeReportId);
        } else {
          alert(`Dispatch Notice: ${data.message || 'Notification recorded.'}`);
        }
      } catch (err) {
        console.error('[Demo Call Error]:', err);
        alert(`Demo call trigger encountered an error: ${err.message}`);
      } finally {
        btnTriggerDemoCall.disabled = false;
        if (demoCallSpinner) demoCallSpinner.style.display = 'none';
      }
    });
  }

  // Play In-Browser Realistic Voice Alert Simulation (Web Speech API)
  if (btnPlaySpeechDispatch) {
    btnPlaySpeechDispatch.addEventListener('click', () => {
      const addr = (accidentAddressInput && accidentAddressInput.value) || 'Pinned GPS Coordinates';
      const lat = currentLat ? currentLat.toFixed(5) : '26.7606';
      const lng = currentLng ? currentLng.toFixed(5) : '83.3732';
      const repId = activeReportId || 'ACC-2026-DEMO';
      const casualties = (estimatedCasualtiesSelect && estimatedCasualtiesSelect.value) || 'Injuries Observed';

      const speechMessage = latestSpeechTranscript || 
        `College Project Emergency Simulation Alert! This is an automated demonstration from the Civic Connect Emergency Response System. A simulated road accident has been registered. Incident Report ID: ${repId}. Accident Location: ${addr}. Coordinates: Latitude ${lat}, Longitude ${lng}. Severity: ${casualties}. This simulated voice alert was delivered to your verified student test phone: ${demoReceiverPhone}. All civic testing parameters verified. End of transmission.`;

      if (speechTranscriptBox && speechTranscriptText) {
        speechTranscriptBox.style.display = 'block';
        speechTranscriptText.textContent = speechMessage;
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Cancel any ongoing speech
        const utterance = new SpeechSynthesisUtterance(speechMessage);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.lang = 'en-IN';

        utterance.onstart = () => {
          btnPlaySpeechDispatch.innerHTML = `<span>🔊 Speaking Alert...</span>`;
        };
        utterance.onend = () => {
          btnPlaySpeechDispatch.innerHTML = `<span>🔊 Play Dispatch Audio</span>`;
        };

        window.speechSynthesis.speak(utterance);
      } else {
        alert('Web Speech API is not supported in this browser. Please review the text transcript below.');
      }
    });
  }

  // Facility alert button click handler
  if (facilitiesList) {
    facilitiesList.addEventListener('click', async (e) => {
      const alertBtn = e.target.closest('.btn-fac-alert');
      if (!alertBtn || !activeReportId) return;

      const facilityId = alertBtn.getAttribute('data-facility-id');
      const facilityName = alertBtn.getAttribute('data-facility-name');

      const confirmed = confirm(
        `🚨 REQUEST FACILITY ALERT (COLLEGE DEMO MODE):\n\n` +
        `Trigger an automated emergency voice alert containing accident coordinates for:\n"${facilityName}"?\n\n` +
        `In Demo Mode, this call will be routed to your test phone: ${demoReceiverPhone}`
      );

      if (!confirmed) return;

      alertBtn.disabled = true;
      const originalText = alertBtn.innerHTML;
      alertBtn.innerHTML = `<span>⏳ Alerting...</span>`;

      try {
        const fetchFn = window.civicFetch || fetch;
        const res = await fetchFn(`/api/emergency-reports/${activeReportId}/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facilityId,
            facilityName,
            demoReceiverNumber: demoReceiverPhone,
            isDemoMode: true
          })
        });

        const data = await res.json();

        if (data.success && data.attempt) {
          latestSpeechTranscript = data.speechText || data.attempt.speechText || '';
          if (latestSpeechTranscript && speechTranscriptBox && speechTranscriptText) {
            speechTranscriptBox.style.display = 'block';
            speechTranscriptText.textContent = latestSpeechTranscript;
          }
          alert(`Dispatch Status: ${data.attempt.status}\n\n${data.attempt.message}\n\nRouted to Demo Tester: ${demoReceiverPhone}`);
          fetchLatestContactStatus(activeReportId);
        } else {
          alert(`Dispatch Notice: ${data.message || 'Notification queued.'}`);
        }
      } catch (err) {
        console.error('[Notification Dispatch Error]:', err);
        alert(`Could not initiate notification (${err.message}). In an emergency, please use direct 112 calling.`);
      } finally {
        alertBtn.disabled = false;
        alertBtn.innerHTML = originalText;
      }
    });
  }

  async function fetchLatestContactStatus(reportId) {
    if (!reportId) return;

    try {
      const fetchFn = window.civicFetch || fetch;
      const res = await fetchFn(`/api/emergency-reports/${reportId}/contact-status`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.success) {
        if (resContactState) {
          resContactState.textContent = data.notificationStatus;
          resContactState.className = `ov-value ${data.notificationStatus === 'CONTACT_CONFIRMED' ? 'state-confirmed' : 'state-pending'}`;
        }
        if (resReportStatus && data.reportStatus) {
          resReportStatus.textContent = data.reportStatus;
        }
        renderNotificationAttempts(data.attempts || []);
      }
    } catch (err) {
      console.warn('[Status Poll Error]:', err);
    }
  }

  function renderNotificationAttempts(attempts) {
    if (!notificationAttemptsList) return;

    if (!attempts || attempts.length === 0) {
      notificationAttemptsList.innerHTML = `
        <div class="empty-attempts">
          No facility voice alert triggered yet. Tap "Call My Phone Now" in the Demo Console or "Request Voice Alert" on any facility on the left.
        </div>
      `;
      return;
    }

    notificationAttemptsList.innerHTML = '';
    attempts.forEach(att => {
      const item = document.createElement('div');
      item.className = `attempt-log-item status-${att.status}`;

      const timeStr = att.initiatedAt ? new Date(att.initiatedAt).toLocaleTimeString() : 'Recently';
      const targetLabel = att.demoNumber ? `Student Demo Line (${att.demoNumber})` : (att.facilityName || 'Facility');

      item.innerHTML = `
        <div class="attempt-time"><strong>${escapeHtml(targetLabel)}</strong> • ${timeStr} • Status: <strong>${escapeHtml(att.status)}</strong></div>
        <div class="attempt-msg">${escapeHtml(att.message || att.errorSummary || 'Notification recorded.')}</div>
      `;
      notificationAttemptsList.appendChild(item);
    });
  }

  function startStatusPolling(reportId) {
    if (statusPollInterval) clearInterval(statusPollInterval);
    statusPollInterval = setInterval(() => {
      fetchLatestContactStatus(reportId);
    }, 10000);
  }

  if (refreshStatusBtn) {
    refreshStatusBtn.addEventListener('click', () => {
      if (activeReportId) fetchLatestContactStatus(activeReportId);
    });
  }

  // Copy Report ID
  if (copyReportIdBtn) {
    copyReportIdBtn.addEventListener('click', () => {
      const idText = resReportId.textContent;
      navigator.clipboard.writeText(idText).then(() => {
        showToast('Copied to Clipboard', `Emergency Report ID: ${idText}`, 'info');
      });
    });
  }

  // Toast Notification helper
  function showToast(title, message, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type, title);
    } else {
      console.log(`[Toast]: ${title} - ${message}`);
    }
  }

  // HTML escaping utility
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Event Listeners for Camera controls
  if (btnSnapLivePhoto) btnSnapLivePhoto.addEventListener('click', snapLivePhoto);
  if (btnSwitchCamera) btnSwitchCamera.addEventListener('click', switchCameraLens);
  if (btnToggleCameraStream) btnToggleCameraStream.addEventListener('click', toggleCameraStream);
  if (btnRestartCamera) btnRestartCamera.addEventListener('click', startLiveCamera);
  if (btnTriggerMobileSensor && mobileDirectCameraInput) {
    btnTriggerMobileSensor.addEventListener('click', () => mobileDirectCameraInput.click());
  }

  // GPS buttons
  if (getAccidentLocationBtn) {
    getAccidentLocationBtn.addEventListener('click', () => captureCurrentLocation());
  }
  if (retryAccidentLocationBtn) {
    retryAccidentLocationBtn.addEventListener('click', () => captureCurrentLocation());
  }

  // Initialize Map & Start Live Camera
  initAccidentMap();
  startLiveCamera();
  updatePhotoRequirementStatus();

  console.log('Civic Connect Emergency Response System v2.0 Initialized.');
});
