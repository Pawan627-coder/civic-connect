/**
 * ========================================================
 * CIVIC CONNECT - REPORT A PROBLEM CONTROLLER (report-problem.js)
 * Stage 2: Citizen Hazard Reporting & Geolocation
 * ========================================================
 * 
 * As a beginner in vibe coding, this file teaches you:
 * 1. How Leaflet.js and OpenStreetMap integrate into a web page.
 * 2. How the browser Geolocation API requests GPS permission safely.
 * 3. How to build client-side image previewing and file removal using FileReader.
 * 4. How to implement live character counters and thorough form validation.
 * 5. How to present an honest frontend demo confirmation without a fake backend.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ========================================================
   * 1. GOOGLE MAPS JAVASCRIPT API INITIALIZATION & GEOLOCATION
   * ========================================================
   */
  const mapElement = document.getElementById('problemMap');
  const latValueDisplay = document.getElementById('latValueDisplay');
  const lngValueDisplay = document.getElementById('lngValueDisplay');
  const latInputHidden = document.getElementById('latitudeInput');
  const lngInputHidden = document.getElementById('longitudeInput');
  const locationErrorMsg = document.getElementById('locationError');
  const locationStatusBadge = document.getElementById('locationStatusBadge');
  const useLocationBtn = document.getElementById('useLocationBtn');
  const retryLocationBtn = document.getElementById('retryLocationBtn');
  const locationAlertBox = document.getElementById('locationAlertBox');
  const locationSourceDisplay = document.getElementById('locationSourceDisplay');
  const locationAccuracyDisplay = document.getElementById('locationAccuracyDisplay');
  const locationTimeDisplay = document.getElementById('locationTimeDisplay');
  const locationSourceInput = document.getElementById('locationSourceInput');
  const locationAccuracyInput = document.getElementById('locationAccuracyInput');
  const locationCapturedAtInput = document.getElementById('locationCapturedAtInput');
  const locationLandmarkInput = document.getElementById('locationLandmark');
  const locateLandmarkBtn = document.getElementById('locateLandmarkBtn');
  const landmarkStatusText = document.getElementById('landmarkStatusText');
  const landmarkSyncBadge = document.getElementById('landmarkSyncBadge');
  const mapFallbackOverlay = document.getElementById('mapFallbackOverlay');
  const mapFallbackDesc = document.getElementById('mapFallbackDesc');

  // Photo Evidence Elements
  const cameraCaptureBtn = document.getElementById('cameraCaptureBtn');
  const cameraFileInput = document.getElementById('cameraFileInput');
  const galleryUploadBtn = document.getElementById('galleryUploadBtn');
  const photoFileInput = document.getElementById('photoFileInput');
  const photoDropzone = document.getElementById('photoDropzone');
  const photoPreviewGrid = document.getElementById('photoPreviewGrid');
  const photoErrorMsg = document.getElementById('photoError');
  const photoSourceInput = document.getElementById('photoSourceInput');
  const photoUploadedAtInput = document.getElementById('photoUploadedAtInput');

  // Live Camera Viewfinder Modal Elements
  const cameraModal = document.getElementById('cameraModal');
  const cameraVideo = document.getElementById('cameraVideo');
  const cameraCanvas = document.getElementById('cameraCanvas');
  const cameraSnapBtn = document.getElementById('cameraSnapBtn');
  const cameraSwitchBtn = document.getElementById('cameraSwitchBtn');
  const cameraCancelBtn = document.getElementById('cameraCancelBtn');
  const cameraModalCloseBtn = document.getElementById('cameraModalCloseBtn');
  const cameraPermissionPrompt = document.getElementById('cameraPermissionPrompt');
  const cameraStatusMsg = document.getElementById('cameraStatusMsg');
  const cameraFlash = document.getElementById('cameraFlash');

  // Pre-submission Review Modal Elements
  const preSubmitConfirmModal = document.getElementById('preSubmitConfirmModal');
  const preSubmitSummaryContainer = document.getElementById('preSubmitSummaryContainer');
  const preSubmitModalCloseBtn = document.getElementById('preSubmitModalCloseBtn');
  const preSubmitModalEditBtn = document.getElementById('preSubmitModalEditBtn');
  const preSubmitModalConfirmBtn = document.getElementById('preSubmitModalConfirmBtn');

  let googleMap = null;
  let googleMarker = null;
  let googleGeocoder = null;
  let isGoogleMapsLoaded = false;

  let leafletMap = null;
  let leafletMarker = null;
  let leafletAccuracyCircle = null;
  let isLeafletLoaded = false;

  // Active Location Verification State
  let currentLocationSource = 'manual'; // 'gps' | 'manual'
  let currentLocationAccuracy = null;
  let currentLocationCapturedAt = null;

  // Default coordinate (India geographic center, zoom 5)
  const DEFAULT_LAT = 20.5937;
  const DEFAULT_LNG = 78.9629;
  const DEFAULT_ZOOM = 5;

  // Initialize free interactive Leaflet + OpenStreetMap engine
  function initLeafletMap() {
    if (!mapElement || !window.L) return;
    try {
      if (mapFallbackOverlay) mapFallbackOverlay.style.display = 'none';

      // Default center: Gorakhpur hub or India center
      const initialLat = 26.7606;
      const initialLng = 83.3732;

      leafletMap = L.map('problemMap').setView([initialLat, initialLng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(leafletMap);

      leafletMarker = L.marker([initialLat, initialLng], { draggable: true }).addTo(leafletMap);
      setMapMarker(initialLat, initialLng, false, 'manual', null, null, true);

      // When user drags the pin, automatically reverse geocode to landmark
      leafletMarker.on('dragend', function () {
        const pos = leafletMarker.getLatLng();
        setMapMarker(pos.lat, pos.lng, false, 'manual', null, null, false);
      });

      // When user clicks the map, move pin and update landmark address automatically
      leafletMap.on('click', function (e) {
        leafletMarker.setLatLng(e.latlng);
        setMapMarker(e.latlng.lat, e.latlng.lng, false, 'manual', null, null, false);
      });

      isLeafletLoaded = true;
      updateLocationStatus('Interactive Map Active: Tap GPS, click map, or type landmark', 'success');
      console.log('[Leaflet Map]: Interactive OpenStreetMap successfully initialized.');
    } catch (err) {
      console.error('[Leaflet Map Error]:', err);
      setupMapFallback('Unable to initialize interactive map. GPS geolocation remains fully active.');
    }
  }

  // Load Google Maps JavaScript API dynamically using key from backend
  async function loadGoogleMaps() {
    try {
      const fetchFn = window.civicFetch || fetch;
      const res = await fetchFn('/api/config/maps-key');
      const data = await res.json();
      const apiKey = data.mapsApiKey;

      if (!apiKey || apiKey.trim() === '') {
        console.info('[Map Notice]: GOOGLE_MAPS_API_KEY is not configured in .env. Activating Leaflet + OpenStreetMap engine.');
        initLeafletMap();
        return;
      }

      // Check if Google Maps script is already in document
      if (window.google && window.google.maps) {
        initGoogleMap();
        return;
      }

      // Dynamically load Google Maps script
      window.onCivicGoogleMapsLoaded = () => {
        isGoogleMapsLoaded = true;
        initGoogleMap();
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=onCivicGoogleMapsLoaded`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.warn('[Google Maps]: Failed to load script. Switching to Leaflet + OpenStreetMap.');
        initLeafletMap();
      };
      document.head.appendChild(script);

    } catch (err) {
      console.warn('[Map Notice]: Error loading map configuration, falling back to Leaflet:', err.message);
      initLeafletMap();
    }
  }

  // Initialize interactive Google Map instance
  function initGoogleMap() {
    if (!mapElement || !window.google || !window.google.maps) return;

    try {
      if (mapFallbackOverlay) mapFallbackOverlay.style.display = 'none';

      googleMap = new google.maps.Map(mapElement, {
        center: { lat: DEFAULT_LAT, lng: DEFAULT_LNG },
        zoom: DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
        ]
      });

      googleGeocoder = new google.maps.Geocoder();

      // Listen for click on Google Map to place/move marker
      googleMap.addListener('click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setMapMarker(lat, lng, false, 'manual', null, null, false);
      });

      updateLocationStatus('Click on map or use GPS to select hazard location', '');
      isGoogleMapsLoaded = true;

    } catch (err) {
      console.error('[Google Maps]: Initialization error:', err);
      initLeafletMap();
    }
  }

  // Fallback mode if both maps fail
  function setupMapFallback(message) {
    if (mapFallbackOverlay) {
      mapFallbackOverlay.style.display = 'flex';
    }
    if (mapFallbackDesc && message) {
      mapFallbackDesc.textContent = message;
    }
    updateLocationStatus('Map viewport unavailable — use GPS button', 'error');
  }

  let reverseGeocodeAbortCtrl = null;
  let forwardGeocodeAbortCtrl = null;

  // Format Nominatim reverse geocode response into a concise, meaningful landmark string
  function formatNominatimAddress(data) {
    if (!data) return '';
    const addr = data.address || {};
    const parts = [];

    // Prioritize landmark / building / amenity / tourism
    const poi = addr.amenity || addr.building || addr.shop || addr.tourism || addr.historic || addr.leisure || addr.office;
    if (poi) parts.push(poi);

    // Road / Street
    if (addr.road) parts.push(addr.road);

    // Neighborhood / Suburb
    const local = addr.neighbourhood || addr.suburb || addr.residential || addr.subdivision;
    if (local && !parts.includes(local)) parts.push(local);

    // City / Town / District
    const city = addr.city || addr.town || addr.village || addr.county;
    if (city && !parts.includes(city)) parts.push(city);

    if (parts.length > 0) {
      return parts.slice(0, 3).join(', ');
    }

    return (data.display_name || '').split(',').slice(0, 3).join(', ');
  }

  // Reverse Geocode: Map Pin (lat, lng) -> Address in Landmark input
  function reverseGeocodeCoordinates(lat, lng) {
    if (!locationLandmarkInput) return;

    if (landmarkStatusText) {
      landmarkStatusText.textContent = '📍 Finding address for pinned location...';
      landmarkStatusText.style.color = 'var(--primary-teal)';
    }

    // 1. Use Google Maps Geocoder if active
    if (googleGeocoder) {
      googleGeocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          applyReverseGeocodedAddress(results[0].formatted_address);
        }
      });
      return;
    }

    // 2. OpenStreetMap Nominatim reverse geocoder
    if (reverseGeocodeAbortCtrl) {
      try { reverseGeocodeAbortCtrl.abort(); } catch (e) {}
    }
    reverseGeocodeAbortCtrl = new AbortController();

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'Accept': 'application/json' },
      signal: reverseGeocodeAbortCtrl.signal
    })
      .then(res => res.json())
      .then(data => {
        const readableAddress = formatNominatimAddress(data);
        if (readableAddress) {
          applyReverseGeocodedAddress(readableAddress);
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.warn('[Reverse Geocode Notice]:', err.message);
      });
  }

  function applyReverseGeocodedAddress(address) {
    if (!locationLandmarkInput) return;
    locationLandmarkInput.value = address;

    // Subtle green flash animation so user clearly sees the address updated from map
    locationLandmarkInput.classList.remove('landmark-updated-flash');
    void locationLandmarkInput.offsetWidth; // force reflow
    locationLandmarkInput.classList.add('landmark-updated-flash');

    if (landmarkStatusText) {
      landmarkStatusText.textContent = `✓ Landmark updated from map pin: ${address}`;
      landmarkStatusText.style.color = '#15803d';
    }
    if (landmarkSyncBadge) {
      landmarkSyncBadge.textContent = '✓ Pinned location synced';
      landmarkSyncBadge.style.color = '#15803d';
    }
  }

  // Forward Geocode: Landmark input text -> Map view, Pin & Lat/Long
  function geocodeLandmarkToMap(addressQuery) {
    const query = (addressQuery || '').trim();
    if (!query || query.length < 3) return;

    if (landmarkStatusText) {
      landmarkStatusText.textContent = `🔍 Locating "${query}" on map...`;
      landmarkStatusText.style.color = 'var(--primary-teal)';
    }
    if (landmarkSyncBadge) {
      landmarkSyncBadge.textContent = '🔍 Locating...';
      landmarkSyncBadge.style.color = 'var(--primary-teal)';
    }

    // 1. Google Maps Geocoder
    if (googleGeocoder) {
      googleGeocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results && results[0] && results[0].geometry) {
          const loc = results[0].geometry.location;
          applyLandmarkToMapCoordinates(loc.lat(), loc.lng(), results[0].formatted_address || query);
        } else {
          showLandmarkGeocodeNotFound(query);
        }
      });
      return;
    }

    // 2. OpenStreetMap Nominatim Geocoder
    if (forwardGeocodeAbortCtrl) {
      try { forwardGeocodeAbortCtrl.abort(); } catch (e) {}
    }
    forwardGeocodeAbortCtrl = new AbortController();

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
      headers: { 'Accept': 'application/json' },
      signal: forwardGeocodeAbortCtrl.signal
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          applyLandmarkToMapCoordinates(lat, lng, data[0].display_name);
        } else {
          showLandmarkGeocodeNotFound(query);
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.warn('[Forward Geocode Notice]:', err.message);
        showLandmarkGeocodeNotFound(query);
      });
  }

  function applyLandmarkToMapCoordinates(lat, lng, foundLabel) {
    // Pan map & place pin, pass skipReverseGeocode = true so we don't overwrite user's typed input
    setMapMarker(lat, lng, true, 'manual', null, null, true);

    if (landmarkStatusText) {
      landmarkStatusText.textContent = `✓ Map pin & coordinates updated for: ${foundLabel.split(',').slice(0, 2).join(', ')}`;
      landmarkStatusText.style.color = '#15803d';
    }
    if (landmarkSyncBadge) {
      landmarkSyncBadge.textContent = '✓ Map pin synced';
      landmarkSyncBadge.style.color = '#15803d';
    }
  }

  function showLandmarkGeocodeNotFound(query) {
    if (landmarkStatusText) {
      landmarkStatusText.textContent = `⚠️ Could not find exact map coordinates for "${query}". You can drag the pin manually.`;
      landmarkStatusText.style.color = '#b45309';
    }
    if (landmarkSyncBadge) {
      landmarkSyncBadge.textContent = '📍 Drop pin manually';
      landmarkSyncBadge.style.color = '#b45309';
    }
  }

  // Set or update marker position, evidence source, accuracy & sync form inputs
  function setMapMarker(lat, lng, panToLocation = false, source = 'manual', accuracy = null, capturedAt = null, skipReverseGeocode = false) {
    const formattedLat = parseFloat(lat).toFixed(6);
    const formattedLng = parseFloat(lng).toFixed(6);

    // Update hidden inputs for form submission
    if (latInputHidden) latInputHidden.value = formattedLat;
    if (lngInputHidden) lngInputHidden.value = formattedLng;

    // Update visible coordinate badges
    if (latValueDisplay) {
      latValueDisplay.textContent = formattedLat;
      latValueDisplay.classList.remove('empty');
    }
    if (lngValueDisplay) {
      lngValueDisplay.textContent = formattedLng;
      lngValueDisplay.classList.remove('empty');
    }

    // Clear location validation error if active
    if (locationErrorMsg) {
      locationErrorMsg.textContent = '';
      locationErrorMsg.classList.remove('visible');
    }

    // Update location verification state
    currentLocationSource = source;
    currentLocationAccuracy = accuracy !== null && !isNaN(accuracy) ? Math.round(accuracy) : null;
    currentLocationCapturedAt = capturedAt || new Date().toISOString();

    if (locationSourceInput) locationSourceInput.value = source;
    if (locationAccuracyInput) locationAccuracyInput.value = currentLocationAccuracy !== null ? currentLocationAccuracy : '';
    if (locationCapturedAtInput) locationCapturedAtInput.value = currentLocationCapturedAt;

    const timeStr = new Date(currentLocationCapturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (locationTimeDisplay) {
      locationTimeDisplay.textContent = timeStr;
    }

    if (source === 'gps') {
      if (locationSourceDisplay) {
        locationSourceDisplay.innerHTML = `<span class="source-badge gps">🛰️ GPS Verified</span>`;
      }
      if (locationAccuracyDisplay) {
        const precLabel = currentLocationAccuracy <= 25 ? 'High Precision' : (currentLocationAccuracy <= 60 ? 'Moderate' : 'Coarse');
        locationAccuracyDisplay.textContent = `±${currentLocationAccuracy}m (${precLabel})`;
      }
      if (locationAlertBox) {
        if (currentLocationAccuracy > 50) {
          locationAlertBox.className = 'location-alert-box warning';
          locationAlertBox.innerHTML = `⚠️ <strong>Coarse GPS Accuracy (±${currentLocationAccuracy}m):</strong> Device reported approximate positioning. You can drag the map pin to calibrate exact spot.`;
          locationAlertBox.style.display = 'flex';
        } else {
          locationAlertBox.className = 'location-alert-box success';
          locationAlertBox.innerHTML = `✓ <strong>GPS Location Verified:</strong> High precision (±${currentLocationAccuracy}m) captured at ${timeStr}.`;
          locationAlertBox.style.display = 'flex';
        }
      }
      if (retryLocationBtn) retryLocationBtn.style.display = 'none';
    } else {
      // Manual selection
      if (locationSourceDisplay) {
        locationSourceDisplay.innerHTML = `<span class="source-badge manual">📍 Manually Selected Pin</span>`;
      }
      if (locationAccuracyDisplay) {
        locationAccuracyDisplay.textContent = 'N/A (Manual Placement)';
      }
      if (locationAlertBox) {
        locationAlertBox.className = 'location-alert-box info';
        locationAlertBox.innerHTML = `📍 <strong>Manual Pin Placement:</strong> This coordinate was placed manually on the map (not GPS hardware verified). Cross-referenced by municipal review.`;
        locationAlertBox.style.display = 'flex';
      }
      // Remove GPS accuracy circle if manually dragged
      if (leafletAccuracyCircle && leafletMap) {
        leafletMap.removeLayer(leafletAccuracyCircle);
        leafletAccuracyCircle = null;
      }
    }

    const numLat = parseFloat(formattedLat);
    const numLng = parseFloat(formattedLng);

    // Sync with Leaflet Map
    if (leafletMarker && leafletMap) {
      leafletMarker.setLatLng([numLat, numLng]);
      if (panToLocation) {
        leafletMap.setView([numLat, numLng], 16);
      }

      // Draw accuracy radius circle on Leaflet if GPS
      if (source === 'gps' && currentLocationAccuracy) {
        if (leafletAccuracyCircle) leafletMap.removeLayer(leafletAccuracyCircle);
        leafletAccuracyCircle = L.circle([numLat, numLng], {
          radius: currentLocationAccuracy,
          color: currentLocationAccuracy > 50 ? '#f59e0b' : '#059669',
          fillColor: currentLocationAccuracy > 50 ? '#fde68a' : '#10b981',
          fillOpacity: 0.18,
          weight: 1.5
        }).addTo(leafletMap);
      }
    }

    // If Google Maps is loaded, update or create marker
    if (window.google && window.google.maps && googleMap) {
      const position = { lat: numLat, lng: numLng };

      if (!googleMarker) {
        googleMarker = new google.maps.Marker({
          position: position,
          map: googleMap,
          draggable: true,
          title: 'Problem Location',
          animation: google.maps.Animation.DROP
        });

        // Update coordinates on drag end & reverse-geocode to landmark automatically
        googleMarker.addListener('dragend', (event) => {
          setMapMarker(event.latLng.lat(), event.latLng.lng(), false, 'manual', null, null, false);
        });
      } else {
        googleMarker.setPosition(position);
      }

      if (panToLocation) {
        googleMap.panTo(position);
        googleMap.setZoom(16);
      }
    }

    // Automatically update Landmark/Area input from dropped pin (unless skipped because user is typing)
    if (!skipReverseGeocode) {
      reverseGeocodeCoordinates(numLat, numLng);
    }

    updateLocationStatus(`Pinned: ${formattedLat}, ${formattedLng} (${source.toUpperCase()})`, 'success');
  }

  // Start map loading
  loadGoogleMaps();


  /* ========================================================
   * 2. BROWSER GEOLOCATION API ("USE MY CURRENT LOCATION")
   * One-time GPS coordinates capture with accuracy in metres
   * ========================================================
   */
  function captureCurrentLocation() {
    // 1. Check if browser supports Geolocation API
    if (!('geolocation' in navigator)) {
      updateLocationStatus('Geolocation not supported by your browser. Please click the map to pin manually.', 'error');
      if (locationAlertBox) {
        locationAlertBox.className = 'location-alert-box error';
        locationAlertBox.innerHTML = '⚠️ <strong>Geolocation Unavailable:</strong> Your browser does not support the Geolocation API. Please click on the map to set coordinates manually.';
        locationAlertBox.style.display = 'flex';
      }
      return;
    }

    // 2. Set button to loading state
    const originalBtnHtml = useLocationBtn.innerHTML;
    useLocationBtn.disabled = true;
    useLocationBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10"></path>
      </svg>
      Detecting GPS...
    `;
    updateLocationStatus('Requesting GPS coordinates...', '');

    if (locationAlertBox) {
      locationAlertBox.className = 'location-alert-box info';
      locationAlertBox.innerHTML = '🛰️ <strong>Acquiring GPS Signal:</strong> Requesting device position from browser location services...';
      locationAlertBox.style.display = 'flex';
    }

    // 3. Request current position with timeout & high accuracy
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Success Callback
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracyMeters = Math.round(position.coords.accuracy);
        const captureTime = new Date(position.timestamp || Date.now()).toISOString();

        // Update marker, accuracy circle and zoom in closely
        setMapMarker(userLat, userLng, true, 'gps', accuracyMeters, captureTime);

        useLocationBtn.disabled = false;
        useLocationBtn.innerHTML = originalBtnHtml;
        if (retryLocationBtn) retryLocationBtn.style.display = 'none';
      },
      (error) => {
        // Error Callback - gracefully handle user denial, timeout or unavailable
        useLocationBtn.disabled = false;
        useLocationBtn.innerHTML = originalBtnHtml;
        if (retryLocationBtn) retryLocationBtn.style.display = 'inline-flex';

        let friendlyMessage = 'Unable to get your location. Please click on the map to set a pin manually.';
        let alertHtml = '';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            friendlyMessage = 'Location permission was denied. Click map to place manual pin.';
            alertHtml = '⚠️ <strong>Location Access Denied:</strong> Location permission was not granted. Please click on the map to place a pin manually, or allow location access in your browser address bar and click <strong>"Retry GPS"</strong>.';
            break;
          case error.POSITION_UNAVAILABLE:
            friendlyMessage = 'Location information is unavailable. Click map to pin manually.';
            alertHtml = '⚠️ <strong>GPS Signal Unavailable:</strong> Could not acquire satellite/network position. Please click anywhere on the map to place a manual pin.';
            break;
          case error.TIMEOUT:
            friendlyMessage = 'Location request timed out. Click map or retry.';
            alertHtml = '⏱️ <strong>Location Request Timed Out:</strong> GPS hardware took too long to respond. Tap <strong>"Retry GPS"</strong> or select location manually on the map.';
            break;
          default:
            friendlyMessage = 'Location error occurred.';
            alertHtml = '⚠️ <strong>Location Error:</strong> ' + (error.message || 'Unable to retrieve location.');
            break;
        }

        updateLocationStatus(friendlyMessage, 'error');
        if (locationAlertBox) {
          locationAlertBox.className = 'location-alert-box error';
          locationAlertBox.innerHTML = alertHtml;
          locationAlertBox.style.display = 'flex';
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  }

  if (useLocationBtn) {
    useLocationBtn.addEventListener('click', captureCurrentLocation);
  }

  if (retryLocationBtn) {
    retryLocationBtn.addEventListener('click', captureCurrentLocation);
  }

  function updateLocationStatus(message, statusClass) {
    if (!locationStatusBadge) return;
    locationStatusBadge.textContent = message;
    locationStatusBadge.className = 'location-status-badge';
    if (statusClass) {
      locationStatusBadge.classList.add(statusClass);
    }
  }


  /* ========================================================
   * 3. LIVE CHARACTER COUNTERS
   * ========================================================
   */
  const problemTitleInput = document.getElementById('problemTitle');
  const problemDescInput = document.getElementById('problemDescription');
  const descCharCounter = document.getElementById('descCharCounter');

  if (problemDescInput && descCharCounter) {
    problemDescInput.addEventListener('input', () => {
      const length = problemDescInput.value.length;
      const maxLength = 500;
      descCharCounter.textContent = `${length} / ${maxLength} characters`;

      if (length >= maxLength) {
        descCharCounter.className = 'char-counter limit';
      } else if (length >= 450) {
        descCharCounter.className = 'char-counter warning';
      } else {
        descCharCounter.className = 'char-counter';
      }
    });
  }


  /* ========================================================
   * 4. PHOTO UPLOAD, THUMBNAIL PREVIEWS & REMOVAL
   * ========================================================
   */
  // In-memory array storing selected valid File objects
  let uploadedPhotos = [];
  const MAX_PHOTOS = 3;
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  // Camera State
  let activeCameraStream = null;
  let currentCameraFacingMode = 'environment'; // 'environment' (back camera) or 'user' (front camera)

  // Request browser camera permission and show live viewfinder
  async function openLiveCamera() {
    if (!cameraModal) {
      if (cameraFileInput) cameraFileInput.click();
      return;
    }

    cameraModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    if (cameraPermissionPrompt) cameraPermissionPrompt.style.display = 'flex';
    if (cameraStatusMsg) cameraStatusMsg.style.display = 'none';
    if (cameraSnapBtn) cameraSnapBtn.disabled = true;

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError('Camera API is not supported in this browser. Opening file chooser...');
      setTimeout(() => {
        closeLiveCamera();
        if (cameraFileInput) cameraFileInput.click();
      }, 1400);
      return;
    }

    try {
      await startCameraStream(currentCameraFacingMode);
    } catch (err) {
      console.warn('[Camera Initial Access Error]:', err);
      // Fallback try without specific facingMode constraint
      try {
        await startCameraStream(null);
      } catch (fallbackErr) {
        handleCameraPermissionFailure(fallbackErr);
      }
    }
  }

  async function startCameraStream(facingMode) {
    stopCameraTracks();

    const constraints = {
      video: facingMode ? { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } } : true,
      audio: false
    };

    activeCameraStream = await navigator.mediaDevices.getUserMedia(constraints);

    if (cameraVideo) {
      cameraVideo.srcObject = activeCameraStream;
      await cameraVideo.play();
    }

    if (cameraPermissionPrompt) cameraPermissionPrompt.style.display = 'none';
    if (cameraSnapBtn) cameraSnapBtn.disabled = false;
  }

  function handleCameraPermissionFailure(err) {
    let msg = 'Camera permission was denied. Please allow camera access in your browser or select an image file.';
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      msg = 'No camera found on this device. You can choose a photo from your gallery instead.';
    } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = 'Camera permission denied. Please allow camera permissions in your browser address bar.';
    }

    if (cameraPermissionPrompt) cameraPermissionPrompt.style.display = 'none';
    showCameraError(msg);

    // Provide immediate fallback option
    if (cameraFileInput) {
      setTimeout(() => {
        if (!cameraModal.hasAttribute('hidden') && confirm('Camera access unavailable. Would you like to select a photo from your files?')) {
          closeLiveCamera();
          cameraFileInput.click();
        }
      }, 1000);
    }
  }

  function showCameraError(msg) {
    if (cameraStatusMsg) {
      cameraStatusMsg.textContent = msg;
      cameraStatusMsg.style.backgroundColor = '#fee2e2';
      cameraStatusMsg.style.color = '#991b1b';
      cameraStatusMsg.style.display = 'block';
    }
  }

  function stopCameraTracks() {
    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      activeCameraStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
  }

  function closeLiveCamera() {
    stopCameraTracks();
    if (cameraModal) cameraModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function snapPhotoFromCamera() {
    if (!cameraVideo || !cameraCanvas) return;

    const w = cameraVideo.videoWidth || 1280;
    const h = cameraVideo.videoHeight || 720;

    cameraCanvas.width = w;
    cameraCanvas.height = h;
    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0, w, h);

    // Flash animation
    if (cameraFlash) {
      cameraFlash.classList.add('camera-flashing');
      setTimeout(() => cameraFlash.classList.remove('camera-flashing'), 350);
    }

    cameraCanvas.toBlob((blob) => {
      if (!blob) {
        showCameraError('Failed to capture snapshot. Please try again.');
        return;
      }

      const timestamp = Date.now();
      const filename = `camera_hazard_${timestamp}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg', lastModified: timestamp });

      closeLiveCamera();
      handleFilesSelected([file], 'camera');
    }, 'image/jpeg', 0.92);
  }

  // Camera button event bindings
  if (cameraCaptureBtn) {
    cameraCaptureBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openLiveCamera();
    });
  }

  if (cameraSnapBtn) {
    cameraSnapBtn.addEventListener('click', (e) => {
      e.preventDefault();
      snapPhotoFromCamera();
    });
  }

  if (cameraSwitchBtn) {
    cameraSwitchBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      currentCameraFacingMode = currentCameraFacingMode === 'environment' ? 'user' : 'environment';
      if (cameraStatusMsg) cameraStatusMsg.style.display = 'none';
      try {
        await startCameraStream(currentCameraFacingMode);
      } catch (err) {
        console.warn('[Camera Switch Error]:', err);
      }
    });
  }

  if (cameraCancelBtn) cameraCancelBtn.addEventListener('click', closeLiveCamera);
  if (cameraModalCloseBtn) cameraModalCloseBtn.addEventListener('click', closeLiveCamera);
  if (cameraModal) {
    cameraModal.addEventListener('click', (e) => {
      if (e.target === cameraModal) closeLiveCamera();
    });
  }

  // Fallback camera file input handler
  if (cameraFileInput) {
    cameraFileInput.addEventListener('change', () => {
      if (cameraFileInput.files && cameraFileInput.files.length > 0) {
        handleFilesSelected(cameraFileInput.files, 'camera');
      }
      cameraFileInput.value = '';
    });
  }

  // Browse Gallery / Files button: opens file gallery
  if (galleryUploadBtn && photoFileInput) {
    galleryUploadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      photoFileInput.click();
    });
  }

  if (photoDropzone && photoFileInput) {
    // Click dropzone to trigger gallery file input
    photoDropzone.addEventListener('click', (e) => {
      if (e.target.closest('.photo-preview-item')) return;
      photoFileInput.click();
    });

    // Keyboard trigger (Enter / Space)
    photoDropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        photoFileInput.click();
      }
    });

    // Drag and drop events
    ['dragenter', 'dragover'].forEach(eventName => {
      photoDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      photoDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDropzone.classList.remove('dragover');
      });
    });

    photoDropzone.addEventListener('drop', (e) => {
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles && droppedFiles.length > 0) {
        handleFilesSelected(droppedFiles, 'upload');
      }
    });

    photoFileInput.addEventListener('change', () => {
      if (photoFileInput.files && photoFileInput.files.length > 0) {
        handleFilesSelected(photoFileInput.files, 'gallery');
      }
      photoFileInput.value = ''; // Reset so the same file can be selected again if removed
    });
  }

  // Process newly selected files with source tracking
  function handleFilesSelected(fileList, source = 'upload') {
    clearPhotoError();

    const incomingFiles = Array.from(fileList);

    // Check maximum total images
    if (uploadedPhotos.length + incomingFiles.length > MAX_PHOTOS) {
      showPhotoError(`You can upload a maximum of ${MAX_PHOTOS} photos. You have already selected ${uploadedPhotos.length}.`);
      return;
    }

    for (const file of incomingFiles) {
      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
        showPhotoError(`Invalid format "${file.name}". Please upload JPG, PNG, or WEBP images only.`);
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showPhotoError(`File "${file.name}" exceeds the 5MB size limit (${formatFileSize(file.size)}).`);
        return;
      }

      // Attach evidence source and timestamp
      file.photoSource = source;
      file.uploadedAt = new Date().toISOString();

      // Check duplicates by filename & size
      const isDuplicate = uploadedPhotos.some(existing => existing.name === file.name && existing.size === file.size);
      if (!isDuplicate) {
        uploadedPhotos.push(file);
      }
    }

    renderPhotoPreviews();
  }

  // Render thumbnail previews using FileReader
  function renderPhotoPreviews() {
    if (!photoPreviewGrid) return;
    photoPreviewGrid.innerHTML = '';

    if (uploadedPhotos.length > 0) {
      if (photoSourceInput) photoSourceInput.value = uploadedPhotos[0].photoSource || 'upload';
      if (photoUploadedAtInput) photoUploadedAtInput.value = uploadedPhotos[0].uploadedAt || new Date().toISOString();
    } else {
      if (photoSourceInput) photoSourceInput.value = 'upload';
      if (photoUploadedAtInput) photoUploadedAtInput.value = '';
    }

    uploadedPhotos.forEach((file, index) => {
      const previewCard = document.createElement('div');
      previewCard.className = 'photo-preview-item';

      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'preview-thumb-wrapper';

      const thumbImg = document.createElement('img');
      thumbImg.className = 'preview-thumb-img';
      thumbImg.alt = `Preview of ${file.name}`;

      // Asynchronously load thumbnail image via FileReader
      const reader = new FileReader();
      reader.onload = (e) => {
        thumbImg.src = e.target.result;
        file.dataUrl = e.target.result;
      };
      reader.readAsDataURL(file);

      thumbWrapper.appendChild(thumbImg);

      const isCam = file.photoSource === 'camera';
      const sourceTagHtml = `
        <span class="photo-source-tag ${isCam ? 'camera' : 'gallery'}">
          ${isCam ? '📷 Live Camera' : '🖼️ Gallery File'}
        </span>
      `;

      const metaInfo = document.createElement('div');
      metaInfo.className = 'preview-meta-info';
      metaInfo.innerHTML = `
        <span class="preview-filename" title="${file.name}">${file.name}</span>
        <span class="preview-filesize">${formatFileSize(file.size)}</span>
        ${sourceTagHtml}
      `;

      // Remove photo button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-photo';
      removeBtn.setAttribute('aria-label', `Remove photo ${file.name}`);
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Avoid triggering dropzone click
        removePhoto(index);
      });

      previewCard.appendChild(thumbWrapper);
      previewCard.appendChild(metaInfo);
      previewCard.appendChild(removeBtn);

      photoPreviewGrid.appendChild(previewCard);
    });
  }

  function removePhoto(indexToRemove) {
    uploadedPhotos.splice(indexToRemove, 1);
    clearPhotoError();
    renderPhotoPreviews();
  }

  function showPhotoError(msg) {
    if (photoErrorMsg) {
      photoErrorMsg.textContent = msg;
      photoErrorMsg.classList.add('visible');
    }
    if (photoDropzone) photoDropzone.classList.add('is-invalid');
  }

  function clearPhotoError() {
    if (photoErrorMsg) {
      photoErrorMsg.textContent = '';
      photoErrorMsg.classList.remove('visible');
    }
    if (photoDropzone) photoDropzone.classList.remove('is-invalid');
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }


  /* ========================================================
   * 5. FORM VALIDATION & SUBMISSION CONTROLLER
   * ========================================================
   */
  const reportForm = document.getElementById('reportProblemForm');
  const issueCategorySelect = document.getElementById('issueCategory');
  const categoryErrorMsg = document.getElementById('categoryError');
  const titleErrorMsg = document.getElementById('titleError');
  const descErrorMsg = document.getElementById('descError');
  const severityErrorMsg = document.getElementById('severityError');
  const accuracyCheckbox = document.getElementById('accuracyConfirmation');
  const accuracyErrorMsg = document.getElementById('accuracyError');
  const submitBtn = document.getElementById('submitReportBtn');
  const resetBtn = document.getElementById('resetReportBtn');

  // Helper: Display field error
  function setFieldError(element, errorElement, message) {
    if (element) {
      element.classList.add('is-invalid');
      element.setAttribute('aria-invalid', 'true');
    }
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('visible');
    }
  }

  // Helper: Clear field error
  function clearFieldError(element, errorElement) {
    if (element) {
      element.classList.remove('is-invalid');
      element.removeAttribute('aria-invalid');
    }
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.remove('visible');
    }
  }

  // Field validation functions
  function validateCategory() {
    if (!issueCategorySelect || !issueCategorySelect.value) {
      setFieldError(issueCategorySelect, categoryErrorMsg, 'Please select an issue category.');
      return false;
    }
    clearFieldError(issueCategorySelect, categoryErrorMsg);
    return true;
  }

  function validateTitle() {
    if (!problemTitleInput) return true;
    const val = problemTitleInput.value.trim();
    if (!val) {
      setFieldError(problemTitleInput, titleErrorMsg, 'Please provide a brief problem title.');
      return false;
    }
    if (val.length < 5) {
      setFieldError(problemTitleInput, titleErrorMsg, 'Title must be at least 5 characters long.');
      return false;
    }
    if (val.length > 100) {
      setFieldError(problemTitleInput, titleErrorMsg, 'Title cannot exceed 100 characters.');
      return false;
    }
    clearFieldError(problemTitleInput, titleErrorMsg);
    return true;
  }

  function validateDescription() {
    if (!problemDescInput) return true;
    const val = problemDescInput.value.trim();
    if (!val) {
      setFieldError(problemDescInput, descErrorMsg, 'Please describe the problem and exact location context.');
      return false;
    }
    if (val.length < 20) {
      setFieldError(problemDescInput, descErrorMsg, 'Please provide a more detailed description (at least 20 characters).');
      return false;
    }
    if (val.length > 500) {
      setFieldError(problemDescInput, descErrorMsg, 'Description cannot exceed 500 characters.');
      return false;
    }
    clearFieldError(problemDescInput, descErrorMsg);
    return true;
  }

  function validateSeverity() {
    const selectedSeverity = document.querySelector('input[name="severityLevel"]:checked');
    if (!selectedSeverity) {
      if (severityErrorMsg) {
        severityErrorMsg.textContent = 'Please choose a severity level for this problem.';
        severityErrorMsg.classList.add('visible');
      }
      return false;
    }
    if (severityErrorMsg) {
      severityErrorMsg.textContent = '';
      severityErrorMsg.classList.remove('visible');
    }
    return true;
  }

  function validateLocation() {
    const lat = latInputHidden ? latInputHidden.value.trim() : '';
    const lng = lngInputHidden ? lngInputHidden.value.trim() : '';

    if (!lat || !lng) {
      if (locationErrorMsg) {
        locationErrorMsg.textContent = 'Please pin the hazard location by clicking on the map or clicking "Use My Current Location".';
        locationErrorMsg.classList.add('visible');
      }
      return false;
    }
    if (locationErrorMsg) {
      locationErrorMsg.textContent = '';
      locationErrorMsg.classList.remove('visible');
    }
    return true;
  }

  function validateAccuracy() {
    if (!accuracyCheckbox || !accuracyCheckbox.checked) {
      if (accuracyErrorMsg) {
        accuracyErrorMsg.textContent = 'You must confirm that the details provided are accurate.';
        accuracyErrorMsg.classList.add('visible');
      }
      return false;
    }
    if (accuracyErrorMsg) {
      accuracyErrorMsg.textContent = '';
      accuracyErrorMsg.classList.remove('visible');
    }
    return true;
  }

  // Real-time listener bindings
  if (issueCategorySelect) {
    issueCategorySelect.addEventListener('change', validateCategory);
  }
  if (problemTitleInput) {
    problemTitleInput.addEventListener('blur', validateTitle);
    problemTitleInput.addEventListener('input', () => {
      if (problemTitleInput.classList.contains('is-invalid')) validateTitle();
    });
  }
  if (problemDescInput) {
    problemDescInput.addEventListener('blur', validateDescription);
    problemDescInput.addEventListener('input', () => {
      if (problemDescInput.classList.contains('is-invalid')) validateDescription();
    });
  }
  document.querySelectorAll('input[name="severityLevel"]').forEach(radio => {
    radio.addEventListener('change', validateSeverity);
  });
  if (accuracyCheckbox) {
    accuracyCheckbox.addEventListener('change', validateAccuracy);
  }

  // Auto-synchronize landmark/area input with map and coordinates
  if (locationLandmarkInput) {
    let landmarkDebounceTimer = null;

    // Real-time typing updates the map pin & lat/long automatically
    locationLandmarkInput.addEventListener('input', () => {
      clearTimeout(landmarkDebounceTimer);
      const val = locationLandmarkInput.value.trim();
      if (val.length >= 3) {
        if (landmarkSyncBadge) landmarkSyncBadge.textContent = '⏳ Locating on map...';
        landmarkDebounceTimer = setTimeout(() => {
          geocodeLandmarkToMap(val);
        }, 650);
      } else {
        if (landmarkStatusText) landmarkStatusText.textContent = 'Drop a pin on map or type an address — both update automatically.';
        if (landmarkSyncBadge) landmarkSyncBadge.textContent = '🔄 Auto-syncs with map';
      }
    });

    // Pressing Enter immediately positions the pin & coordinates
    locationLandmarkInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(landmarkDebounceTimer);
        geocodeLandmarkToMap(locationLandmarkInput.value.trim());
      }
    });

    // On blur / change
    locationLandmarkInput.addEventListener('change', () => {
      clearTimeout(landmarkDebounceTimer);
      geocodeLandmarkToMap(locationLandmarkInput.value.trim());
    });
  }

  // Search/locate button next to landmark input
  if (locateLandmarkBtn && locationLandmarkInput) {
    locateLandmarkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      geocodeLandmarkToMap(locationLandmarkInput.value.trim());
    });
  }

  // Form Submit Handler
  if (reportForm) {
    reportForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Run all validations
      const isCatValid = validateCategory();
      const isTitleValid = validateTitle();
      const isDescValid = validateDescription();
      const isSevValid = validateSeverity();
      const isLocValid = validateLocation();
      const isAccValid = validateAccuracy();

      const isAllValid = isCatValid && isTitleValid && isDescValid && isSevValid && isLocValid && isAccValid;

      if (!isAllValid) {
        // Focus first invalid element
        const firstInvalid = reportForm.querySelector('.is-invalid, input:invalid');
        if (firstInvalid) {
          firstInvalid.focus();
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (!isLocValid) {
          mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Collect data to send to Express backend
      const selectedSeverity = document.querySelector('input[name="severityLevel"]:checked');
      let severityLabel = selectedSeverity ? selectedSeverity.value : 'Medium';
      severityLabel = severityLabel.charAt(0).toUpperCase() + severityLabel.slice(1).toLowerCase();

      const landmarkVal = locationLandmarkInput ? locationLandmarkInput.value.trim() : '';
      const latVal = parseFloat(latInputHidden.value);
      const lngVal = parseFloat(lngInputHidden.value);

      const locSource = (locationSourceInput && locationSourceInput.value) || currentLocationSource || 'manual';
      const locAccuracy = (locationAccuracyInput && locationAccuracyInput.value) ? parseInt(locationAccuracyInput.value, 10) : currentLocationAccuracy;
      const locCapturedAt = (locationCapturedAtInput && locationCapturedAtInput.value) || currentLocationCapturedAt || new Date().toISOString();

      const pSource = (photoSourceInput && photoSourceInput.value) || (uploadedPhotos[0] && uploadedPhotos[0].photoSource) || 'upload';
      const pUploadedAt = (photoUploadedAtInput && photoUploadedAtInput.value) || (uploadedPhotos[0] && uploadedPhotos[0].uploadedAt) || (uploadedPhotos.length > 0 ? new Date().toISOString() : null);

      const complaintPayload = {
        title: problemTitleInput.value.trim(),
        category: issueCategorySelect.value,
        description: problemDescInput.value.trim(),
        location: landmarkVal || 'Pinned Location',
        latitude: latVal,
        longitude: lngVal,
        locationSource: locSource,
        locationAccuracy: locAccuracy,
        locationCapturedAt: locCapturedAt,
        photoSource: pSource,
        photoUploadedAt: pUploadedAt,
        severity: severityLabel,
        image: (uploadedPhotos.length > 0 && uploadedPhotos[0].dataUrl) ? uploadedPhotos[0].dataUrl : ""
      };

      // Show confirmation summary before final submission
      openPreSubmitModal(complaintPayload);
    });
  }

  // Pre-Submission Review Modal
  function openPreSubmitModal(payload) {
    if (!preSubmitConfirmModal || !preSubmitSummaryContainer) {
      executeComplaintSubmission(payload);
      return;
    }

    const locSource = payload.locationSource === 'gps' ? '🛰️ GPS Hardware Verified' : '📍 Manually Selected Pin';
    const locSourceClass = payload.locationSource === 'gps' ? 'gps' : 'manual';
    const accuracyText = payload.locationAccuracy ? `±${payload.locationAccuracy} meters` : 'N/A (Manual placement)';
    const capturedTime = payload.locationCapturedAt ? new Date(payload.locationCapturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now';
    const photoSourceText = payload.photoSource === 'camera' ? '📷 Live Camera Capture' : '🖼️ Device Gallery / Upload';
    const photoTime = payload.photoUploadedAt ? new Date(payload.photoUploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now';

    preSubmitSummaryContainer.innerHTML = `
      <div class="presubmit-card">
        <div class="presubmit-card-title">
          <span>📋</span> Problem Overview
        </div>
        <div class="presubmit-grid">
          <div class="presubmit-item">
            <span class="presubmit-label">Category:</span>
            <span class="presubmit-val"><strong>${escapeHtml(payload.category)}</strong></span>
          </div>
          <div class="presubmit-item">
            <span class="presubmit-label">Severity:</span>
            <span class="presubmit-val">${escapeHtml(payload.severity)}</span>
          </div>
          <div class="presubmit-item" style="grid-column: 1 / -1;">
            <span class="presubmit-label">Title:</span>
            <span class="presubmit-val">${escapeHtml(payload.title)}</span>
          </div>
          <div class="presubmit-item" style="grid-column: 1 / -1;">
            <span class="presubmit-label">Description:</span>
            <span class="presubmit-val" style="font-size: 0.82rem; color: #475569;">${escapeHtml(payload.description)}</span>
          </div>
        </div>
      </div>

      <div class="presubmit-card">
        <div class="presubmit-card-title">
          <span>📍</span> Location Verification Evidence
        </div>
        <div class="presubmit-grid">
          <div class="presubmit-item">
            <span class="presubmit-label">Reported Source:</span>
            <span class="presubmit-val"><span class="source-badge ${locSourceClass}">${locSource}</span></span>
          </div>
          <div class="presubmit-item">
            <span class="presubmit-label">GPS Precision:</span>
            <span class="presubmit-val">${accuracyText}</span>
          </div>
          <div class="presubmit-item">
            <span class="presubmit-label">Coordinates:</span>
            <span class="presubmit-val" style="font-family: monospace;">${payload.latitude.toFixed(5)}, ${payload.longitude.toFixed(5)}</span>
          </div>
          <div class="presubmit-item">
            <span class="presubmit-label">Capture Timestamp:</span>
            <span class="presubmit-val">${capturedTime}</span>
          </div>
          <div class="presubmit-item" style="grid-column: 1 / -1;">
            <span class="presubmit-label">Address / Landmark:</span>
            <span class="presubmit-val">${escapeHtml(payload.location || 'Pinned on map')}</span>
          </div>
        </div>
      </div>

      <div class="presubmit-card">
        <div class="presubmit-card-title">
          <span>📷</span> Photographic Evidence
        </div>
        <div class="presubmit-grid">
          <div class="presubmit-item">
            <span class="presubmit-label">Photo Source:</span>
            <span class="presubmit-val">${photoSourceText}</span>
          </div>
          <div class="presubmit-item">
            <span class="presubmit-label">Upload Timestamp:</span>
            <span class="presubmit-val">${photoTime}</span>
          </div>
        </div>
        ${payload.image ? `
          <div class="presubmit-photo-preview">
            <img src="${payload.image}" alt="Complaint thumbnail" class="presubmit-thumb">
            <span style="font-size: 0.8rem; color: #64748b;">Photo evidence attached and ready for municipal review.</span>
          </div>
        ` : `
          <p style="font-size: 0.8rem; color: #b45309; margin: 0.4rem 0 0;">⚠️ No photograph attached. Reports with photographic evidence are verified and acted upon much faster.</p>
        `}
      </div>

      <div class="presubmit-disclaimer">
        <strong>Municipal Evidence Notice:</strong> By clicking "Confirm &amp; Submit", your report will be sent to the municipal authority console with these exact coordinates, photo, and timestamps.
      </div>
    `;

    preSubmitConfirmModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    preSubmitModalConfirmBtn.onclick = () => {
      preSubmitConfirmModal.setAttribute('hidden', '');
      document.body.style.overflow = '';
      executeComplaintSubmission(payload);
    };

    preSubmitModalEditBtn.onclick = () => {
      preSubmitConfirmModal.setAttribute('hidden', '');
      document.body.style.overflow = '';
    };

    if (preSubmitModalCloseBtn) {
      preSubmitModalCloseBtn.onclick = () => {
        preSubmitConfirmModal.setAttribute('hidden', '');
        document.body.style.overflow = '';
      };
    }
  }

  // Execute Submission to Express API
  async function executeComplaintSubmission(complaintPayload) {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting & Analyzing...';
    }

    try {
      const currentUser = await window.CivicAuth.getCurrentUser();
      if (!currentUser) {
        alert('Please log in before submitting a complaint. Your report will be securely linked to your citizen dashboard.');
        window.location.href = 'login.html';
        return;
      }

      complaintPayload.reportedBy = currentUser.name || "Civic User";

      const fetchFn = window.civicFetch || fetch;
      const response = await fetchFn('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(complaintPayload)
      });

      const result = await response.json();

      if (response.status === 401) {
        alert('Please log in to submit a complaint. Your report will be securely linked to your citizen dashboard.');
        window.location.href = 'login.html';
        return;
      }

      // Case 1: Duplicate complaint detected nearby by Gemini & geographic radius (Stage 10 Part 21)
      if (result.duplicate) {
        console.log('[Duplicate Detected]:', result);
        showDuplicateNoticeModal(result);
        resetReportForm();
        return;
      }

      // Case 2: New complaint registered successfully
      if (response.ok && result.success && result.data) {
        console.log('[Express API]: Complaint registered successfully:', result.data);

        // Broadcast real-time event to other open tabs (e.g. Authority portal)
        if (window.notifyNewComplaint) {
          window.notifyNewComplaint(result.data);
        }

        showSuccessSubmissionModal(result.data, complaintPayload);
        resetReportForm();
      } else {
        throw new Error(result.message || 'Server rejected submission');
      }
    } catch (err) {
      console.error('[Submission Error]:', err.message);
      alert('Could not submit complaint: ' + err.message + '\n\nPlease verify that the server is reachable and try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          Review &amp; Submit
        `;
      }
    }
  }



  /* ========================================================
   * 6. RESET BUTTON BEHAVIOUR WITH CONFIRMATION
   * ========================================================
   */
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const hasEnteredData = (problemTitleInput && problemTitleInput.value) ||
                             (problemDescInput && problemDescInput.value) ||
                             (issueCategorySelect && issueCategorySelect.value) ||
                             (uploadedPhotos.length > 0) ||
                             (latInputHidden && latInputHidden.value);

      if (hasEnteredData) {
        const confirmClear = window.confirm('Are you sure you want to clear this report? All entered details, map pin, and selected photos will be removed.');
        if (!confirmClear) return;
      }

      resetReportForm();
    });
  }

  function resetReportForm() {
    if (reportForm) reportForm.reset();

    // Clear photos
    uploadedPhotos = [];
    clearPhotoError();
    renderPhotoPreviews();

    // Reset character counter
    if (descCharCounter) {
      descCharCounter.textContent = '0 / 500 characters';
      descCharCounter.className = 'char-counter';
    }

    // Reset Google Map marker and coordinates display
    if (googleMarker) {
      googleMarker.setMap(null);
      googleMarker = null;
    }
    if (googleMap) {
      googleMap.setCenter({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
      googleMap.setZoom(DEFAULT_ZOOM);
    }
    if (latInputHidden) latInputHidden.value = '';
    if (lngInputHidden) lngInputHidden.value = '';
    if (latValueDisplay) {
      latValueDisplay.textContent = 'Not pinned';
      latValueDisplay.classList.add('empty');
    }
    if (lngValueDisplay) {
      lngValueDisplay.textContent = 'Not pinned';
      lngValueDisplay.classList.add('empty');
    }
    updateLocationStatus('Click on Google Map to place a pin', '');

    // Clear all error messages
    document.querySelectorAll('.field-validation-msg').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });
    document.querySelectorAll('.is-invalid').forEach(el => {
      el.classList.remove('is-invalid');
    });
  }


  /* ========================================================
   * 7. SUCCESS SUBMISSION MODAL (AI Analysis + Priority Display)
   * ========================================================
   */
  const demoModal = document.getElementById('demoSubmissionModal');
  const demoModalCloseBtn = document.getElementById('demoModalCloseBtn');
  const demoModalDismissBtn = document.getElementById('demoModalDismissBtn');
  const demoSummaryContainer = document.getElementById('demoSummaryContainer');

  function showSuccessSubmissionModal(data, originalPayload) {
    if (!demoModal || !demoSummaryContainer) return;

    const modalTitleEl = document.getElementById('demoModalTitle');
    if (modalTitleEl && data.id) {
      modalTitleEl.textContent = `Complaint ${data.id} Registered`;
    }

    const dangerLevel = (data.aiAnalysis && data.aiAnalysis.dangerLevel) ? data.aiAnalysis.dangerLevel.toUpperCase() : 'MEDIUM';
    const dangerScore = (data.aiAnalysis && data.aiAnalysis.dangerScore !== undefined) ? data.aiAnalysis.dangerScore : 50;
    const aiReason = (data.aiAnalysis && data.aiAnalysis.reason) ? data.aiAnalysis.reason : 'AI hazard analysis completed.';
    const priorityLevel = (data.priority && data.priority.level) ? data.priority.level : 'MEDIUM';
    const priorityScore = (data.priority && data.priority.score !== undefined) ? data.priority.score : 50;
    const locAddress = (data.location && data.location.address) ? data.location.address : (originalPayload.location || 'GPS Location');

    demoSummaryContainer.innerHTML = `
      <div style="background-color: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: #065f46; font-weight: 800; font-size: 1.05rem;">
          <span>✓</span> Ticket ${data.id} Created
        </div>
        <p style="margin: 0.35rem 0 0; font-size: 0.84rem; color: #047857;">
          Your complaint is now active in the public queue and prioritized according to AI risk assessment and citizen reports.
        </p>
      </div>

      <!-- AI Danger & Priority Highlight Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="font-size: 0.85rem; font-weight: 700; color: #07546b;">🤖 AI Danger Assessment:</span>
          <span style="font-size: 0.85rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 4px; background-color: ${getPriorityColorBg(dangerLevel)}; color: ${getPriorityColorText(dangerLevel)};">
            ${dangerLevel} (${dangerScore}/100)
          </span>
        </div>
        <p style="font-size: 0.82rem; color: #475569; margin: 0 0 0.75rem; font-style: italic;">
          "${escapeHtml(aiReason)}"
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; pt: 0.5rem; margin-top: 0.5rem; padding-top: 0.5rem;">
          <span style="font-size: 0.85rem; font-weight: 700; color: #0f172a;">Calculated Priority:</span>
          <span style="font-size: 0.85rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 4px; background-color: #e0f2fe; color: #0369a1;">
            ${priorityLevel} (${priorityScore}/100)
          </span>
        </div>
      </div>

      <div class="demo-summary-box">
        <div class="demo-summary-row">
          <span class="summary-row-label">Ticket ID:</span>
          <span class="summary-row-val" style="font-family: monospace; font-weight: 800; color: var(--primary-teal);">${data.id}</span>
        </div>
        <div class="demo-summary-row">
          <span class="summary-row-label">Problem Title:</span>
          <span class="summary-row-val">${escapeHtml(data.title)}</span>
        </div>
        <div class="demo-summary-row">
          <span class="summary-row-label">Category:</span>
          <span class="summary-row-val">${escapeHtml(data.category)}</span>
        </div>
        <div class="demo-summary-row">
          <span class="summary-row-label">Location:</span>
          <span class="summary-row-val">${escapeHtml(locAddress)}</span>
        </div>
        <div class="demo-summary-row">
          <span class="summary-row-label">Report Count:</span>
          <span class="summary-row-val"><strong>${data.reportCount || 1} citizen report</strong></span>
        </div>
      </div>
    `;

    demoModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDemoModal() {
    if (!demoModal) return;
    demoModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  if (demoModalCloseBtn) demoModalCloseBtn.addEventListener('click', closeDemoModal);
  if (demoModalDismissBtn) demoModalDismissBtn.addEventListener('click', closeDemoModal);
  if (demoModal) {
    demoModal.addEventListener('click', (e) => {
      if (e.target === demoModal) closeDemoModal();
    });
  }


  /* ========================================================
   * 8. DUPLICATE COMPLAINT DETECTED MODAL (Stage 10 Part 21)
   * ========================================================
   */
  const duplicateModal = document.getElementById('duplicateNoticeModal');
  const duplicateModalCloseBtn = document.getElementById('duplicateModalCloseBtn');
  const duplicateModalDismissBtn = document.getElementById('duplicateModalDismissBtn');
  const duplicateSummaryContainer = document.getElementById('duplicateSummaryContainer');

  function showDuplicateNoticeModal(result) {
    if (!duplicateModal || !duplicateSummaryContainer) return;

    const matchedId = result.matchedComplaintId || (result.data ? result.data.id : 'CC-1001');
    const existing = result.data || {};
    const title = existing.title || 'Nearby Civic Hazard';
    const loc = (existing.location && existing.location.address) ? existing.location.address : (existing.location || 'Nearby Location');
    const reportCount = result.reportCount || existing.reportCount || 2;
    const voteCount = existing.supporters || (existing.voters ? existing.voters.length : 0);
    const priorityLevel = (result.priority && result.priority.level) || (existing.priority && existing.priority.level) || 'HIGH';
    const priorityScore = (result.priority && result.priority.score) || (existing.priority && existing.priority.score) || 68;

    duplicateSummaryContainer.innerHTML = `
      <div style="background-color: #ffffff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <span style="font-family: monospace; font-size: 0.95rem; font-weight: 800; color: #1d4ed8; background-color: #dbeafe; padding: 0.2rem 0.5rem; border-radius: 4px;">
            ${escapeHtml(matchedId)}
          </span>
          <span style="font-size: 0.8rem; font-weight: 800; padding: 0.25rem 0.65rem; border-radius: 12px; background-color: ${getPriorityColorBg(priorityLevel)}; color: ${getPriorityColorText(priorityLevel)};">
            Priority: ${priorityLevel} (${priorityScore}/100)
          </span>
        </div>

        <h4 style="font-size: 1.05rem; color: #0f172a; margin: 0 0 0.4rem;">${escapeHtml(title)}</h4>
        
        <p style="font-size: 0.85rem; color: #475569; margin: 0 0 0.85rem; display: flex; align-items: center; gap: 0.4rem;">
          <span>📍</span> ${escapeHtml(loc)}
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background-color: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div>
            <span style="font-size: 0.75rem; color: #64748b; display: block;">Citizens Reported:</span>
            <strong style="font-size: 1.15rem; color: #07546b;">${reportCount}</strong>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: #64748b; display: block;">Community Votes:</span>
            <strong style="font-size: 1.15rem; color: #0284c7;">${voteCount}</strong>
          </div>
        </div>

        <p style="font-size: 0.82rem; color: #166534; background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 0.6rem 0.75rem; border-radius: 6px; margin: 0.85rem 0 0;">
          ✓ <strong>Your report has been added to this existing issue.</strong> This increases its community weight without cluttering the maintenance queue.
        </p>
      </div>
    `;

    duplicateModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeDuplicateModal() {
    if (!duplicateModal) return;
    duplicateModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  if (duplicateModalCloseBtn) duplicateModalCloseBtn.addEventListener('click', closeDuplicateModal);
  if (duplicateModalDismissBtn) duplicateModalDismissBtn.addEventListener('click', closeDuplicateModal);
  if (duplicateModal) {
    duplicateModal.addEventListener('click', (e) => {
      if (e.target === duplicateModal) closeDuplicateModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (cameraModal && !cameraModal.hasAttribute('hidden')) closeLiveCamera();
      if (demoModal && !demoModal.hasAttribute('hidden')) closeDemoModal();
      if (duplicateModal && !duplicateModal.hasAttribute('hidden')) closeDuplicateModal();
    }
  });

  function getPriorityColorBg(level) {
    switch (String(level).toUpperCase()) {
      case 'CRITICAL': return '#fee2e2';
      case 'HIGH': return '#ffedd5';
      case 'MEDIUM': return '#fef3c7';
      default: return '#e0f2fe';
    }
  }

  function getPriorityColorText(level) {
    switch (String(level).toUpperCase()) {
      case 'CRITICAL': return '#991b1b';
      case 'HIGH': return '#9a3412';
      case 'MEDIUM': return '#92400e';
      default: return '#0369a1';
    }
  }

  // Use shared escapeHtml helper
  const escapeHtml = window.escapeHtml || ((str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '');

  console.log('Civic Connect Report a Problem Controller with Google Maps & Gemini Duplicate Detection Initialized.');
});
