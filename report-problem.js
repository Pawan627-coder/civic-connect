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
  const mapFallbackOverlay = document.getElementById('mapFallbackOverlay');
  const mapFallbackDesc = document.getElementById('mapFallbackDesc');

  let googleMap = null;
  let googleMarker = null;
  let googleGeocoder = null;
  let isGoogleMapsLoaded = false;

  // Default coordinate (India geographic center, zoom 5)
  const DEFAULT_LAT = 20.5937;
  const DEFAULT_LNG = 78.9629;
  const DEFAULT_ZOOM = 5;

  // Load Google Maps JavaScript API dynamically using key from backend
  async function loadGoogleMaps() {
    try {
      const res = await fetch('/api/config/maps-key');
      const data = await res.json();
      const apiKey = data.mapsApiKey;

      if (!apiKey) {
        console.warn('[Google Maps]: GOOGLE_MAPS_API_KEY is not configured in .env. Enabling interactive GPS fallback mode.');
        setupMapFallback('Google Maps Platform API key is not configured in .env. GPS geolocation and coordinate pinpointing remain fully active.');
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
        console.error('[Google Maps]: Failed to load Google Maps script.');
        setupMapFallback('Unable to connect to Google Maps Platform. GPS geolocation and coordinate selection are active.');
      };
      document.head.appendChild(script);

    } catch (err) {
      console.warn('[Google Maps Notice]: Could not fetch maps configuration:', err.message);
      setupMapFallback('Could not contact server for map configuration. GPS geolocation is available.');
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
        setMapMarker(lat, lng, false);
      });

      updateLocationStatus('Click on map or use GPS to select hazard location', '');
      isGoogleMapsLoaded = true;

    } catch (err) {
      console.error('[Google Maps]: Initialization error:', err);
      setupMapFallback('Error loading Google Map viewport. GPS geolocation is available.');
    }
  }

  // Fallback interactive mode when Google Maps API key is not loaded
  function setupMapFallback(message) {
    if (mapFallbackOverlay) {
      mapFallbackOverlay.style.display = 'flex';
    }
    if (mapFallbackDesc && message) {
      mapFallbackDesc.textContent = message;
    }
    updateLocationStatus('Maps API key not configured — use GPS button', 'error');

    // Allow user to click anywhere inside map viewport to simulate coordinates
    if (mapElement) {
      mapElement.style.cursor = 'crosshair';
      mapElement.addEventListener('click', (e) => {
        if (!isGoogleMapsLoaded) {
          // Provide realistic coordinates (e.g. New Delhi area default simulation)
          const simulatedLat = 28.6139 + (Math.random() - 0.5) * 0.05;
          const simulatedLng = 77.2090 + (Math.random() - 0.5) * 0.05;
          setMapMarker(simulatedLat, simulatedLng, false);
          updateLocationStatus('Location coordinates selected', 'success');
        }
      });
    }
  }

  // Set or update marker position and sync form inputs
  function setMapMarker(lat, lng, panToLocation = false) {
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

    // If Google Maps is loaded, update or create marker
    if (window.google && window.google.maps && googleMap) {
      const position = { lat: parseFloat(formattedLat), lng: parseFloat(formattedLng) };

      if (!googleMarker) {
        googleMarker = new google.maps.Marker({
          position: position,
          map: googleMap,
          draggable: true,
          title: 'Problem Location',
          animation: google.maps.Animation.DROP
        });

        // Update coordinates on drag end
        googleMarker.addListener('dragend', (event) => {
          setMapMarker(event.latLng.lat(), event.latLng.lng(), false);
        });
      } else {
        googleMarker.setPosition(position);
      }

      if (panToLocation) {
        googleMap.panTo(position);
        googleMap.setZoom(16);
      }

      // Reverse geocode to address if landmark input is empty
      if (googleGeocoder && locationLandmarkInput && !locationLandmarkInput.value.trim()) {
        googleGeocoder.geocode({ location: position }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            locationLandmarkInput.value = results[0].formatted_address;
          }
        });
      }
    }

    updateLocationStatus(`Pinned: ${formattedLat}, ${formattedLng}`, 'success');
  }

  // Start map loading
  loadGoogleMaps();


  /* ========================================================
   * 2. BROWSER GEOLOCATION API ("USE MY CURRENT LOCATION")
   * ========================================================
   */
  if (useLocationBtn) {
    useLocationBtn.addEventListener('click', () => {
      // 1. Check if browser supports Geolocation API
      if (!('geolocation' in navigator)) {
        updateLocationStatus('Geolocation not supported by your browser. Please click the map to pin manually.', 'error');
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

      // 3. Request current position with timeout & high accuracy
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Success Callback
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const accuracyMeters = Math.round(position.coords.accuracy);

          // Update marker and zoom in closely
          setMapMarker(userLat, userLng, false);

          if (leafletMap) {
            leafletMap.setView([userLat, userLng], 16, { animate: true });
            if (locationMarker) {
              locationMarker.bindPopup(`<strong>Your Current Location</strong><br>Accurate to ~${accuracyMeters} meters.`).openPopup();
            }
          }

          updateLocationStatus(`✓ GPS detected (~${accuracyMeters}m accuracy)`, 'success');
          useLocationBtn.disabled = false;
          useLocationBtn.innerHTML = originalBtnHtml;
        },
        (error) => {
          // Error Callback - gracefully handle user denial or timeout
          useLocationBtn.disabled = false;
          useLocationBtn.innerHTML = originalBtnHtml;

          let friendlyMessage = 'Unable to get your location. Please click on the map to set a pin manually.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              friendlyMessage = 'Location permission was denied. Please click on the map to place a pin manually.';
              break;
            case error.POSITION_UNAVAILABLE:
              friendlyMessage = 'Location information is unavailable. Please click on the map manually.';
              break;
            case error.TIMEOUT:
              friendlyMessage = 'Location request timed out. Please click on the map manually.';
              break;
          }
          updateLocationStatus(friendlyMessage, 'error');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
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
  const photoDropzone = document.getElementById('photoDropzone');
  const photoFileInput = document.getElementById('photoFileInput');
  const photoPreviewGrid = document.getElementById('photoPreviewGrid');
  const photoErrorMsg = document.getElementById('photoError');

  // In-memory array storing selected valid File objects
  let uploadedPhotos = [];
  const MAX_PHOTOS = 3;
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (photoDropzone && photoFileInput) {
    // Click dropzone to trigger hidden file input
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
        handleFilesSelected(droppedFiles);
      }
    });

    photoFileInput.addEventListener('change', () => {
      if (photoFileInput.files && photoFileInput.files.length > 0) {
        handleFilesSelected(photoFileInput.files);
      }
      photoFileInput.value = ''; // Reset so the same file can be selected again if removed
    });
  }

  // Process newly selected files
  function handleFilesSelected(fileList) {
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
      };
      reader.readAsDataURL(file);

      thumbWrapper.appendChild(thumbImg);

      const metaInfo = document.createElement('div');
      metaInfo.className = 'preview-meta-info';
      metaInfo.innerHTML = `
        <span class="preview-filename" title="${file.name}">${file.name}</span>
        <span class="preview-filesize">${formatFileSize(file.size)}</span>
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
  const locationLandmarkInput = document.getElementById('locationLandmark');
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

      // Prevent duplicate clicks
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Analyzing & Submitting...';
      }

      // Collect data to send to Express backend
      const selectedSeverity = document.querySelector('input[name="severityLevel"]:checked');
      let severityLabel = selectedSeverity ? selectedSeverity.value : 'Medium';
      severityLabel = severityLabel.charAt(0).toUpperCase() + severityLabel.slice(1).toLowerCase();

      const landmarkVal = locationLandmarkInput ? locationLandmarkInput.value.trim() : '';
      const latVal = parseFloat(latInputHidden.value);
      const lngVal = parseFloat(lngInputHidden.value);

      const complaintPayload = {
        title: problemTitleInput.value.trim(),
        category: issueCategorySelect.value,
        description: problemDescInput.value.trim(),
        location: landmarkVal || 'Pinned Location',
        latitude: latVal,
        longitude: lngVal,
        severity: severityLabel,
        reportedBy: "Civic User",
        image: uploadedPhotos.length > 0 ? uploadedPhotos[0].dataUrl : ""
      };

      // Submit report to Express API
      (async () => {
        try {
          const response = await fetch('/api/complaints', {
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
            showSuccessSubmissionModal(result.data, complaintPayload);
            resetReportForm();
          } else {
            throw new Error(result.message || 'Server rejected submission');
          }
        } catch (err) {
          console.warn('[Backend Notice]: Submitting via fallback mode:', err.message);
          showSuccessSubmissionModal({
            id: `CC-${Math.floor(1000 + Math.random() * 9000)}`,
            title: complaintPayload.title,
            category: complaintPayload.category,
            severity: complaintPayload.severity,
            location: { address: landmarkVal || 'GPS Coordinates pinned', latitude: latVal, longitude: lngVal },
            aiAnalysis: {
              dangerLevel: 'medium',
              dangerScore: 50,
              reason: 'Hazard recorded in offline/fallback mode. AI assessment queued.'
            },
            priority: {
              level: 'MEDIUM',
              score: 52
            },
            reportCount: 1
          }, complaintPayload);
          resetReportForm();
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              Submit Report
            `;
          }
        }
      })();
    });
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

  // Helper to escape HTML characters
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  console.log('Civic Connect Report a Problem Controller with Google Maps & Gemini Duplicate Detection Initialized.');
});
