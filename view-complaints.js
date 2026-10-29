/**
 * ========================================================
 * CIVIC CONNECT - VIEW COMPLAINTS CONTROLLER (view-complaints.js)
 * Stage 3: Public Complaints Dashboard & Filter Engine
 * ========================================================
 * 
 * As a beginner in vibe coding, this file teaches you how:
 * 1. Sample data is structured in a JavaScript array of objects.
 * 2. DOM elements are generated and rendered dynamically.
 * 3. Search and multi-criteria filters combine smoothly in real time.
 * 4. Interactive supporter upvoting updates state and DOM instantly.
 * 5. Modal dialogs display detailed information without page reloads.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ========================================================
   * 1. COMPLAINTS DATASET (Live API Store)
   * Populated live from GET /api/complaints via Express
   * ======================================================== */
  let complaints = [];

  // Track user-supported complaint IDs in memory (prevents repeated voting)
  const userSupportedIds = new Set();

  /* ========================================================
   * 2. DOM ELEMENT REFERENCES
   * ======================================================== */
  const complaintsGrid = document.getElementById('complaintsGrid');
  const emptyResultsState = document.getElementById('emptyResultsState');
  const resultsCountText = document.getElementById('resultsCountText');

  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');

  const categoryFilter = document.getElementById('categoryFilter');
  const statusFilter = document.getElementById('statusFilter');
  const severityFilter = document.getElementById('severityFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const emptyClearBtn = document.getElementById('emptyClearBtn');

  const complaintDetailModal = document.getElementById('complaintDetailModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const modalDetailBody = document.getElementById('modalDetailBody');

  // Google Maps state variables (Stage 10 Part 10 & 11)
  let googleMap = null;
  let activeInfoWindow = null;
  let mapMarkers = [];
  let markersMap = {};
  let isGoogleMapsLoaded = false;

  const DEFAULT_LAT = 20.5937;
  const DEFAULT_LNG = 78.9629;


  /* ========================================================
   * 3. CSS BADGE CLASS HELPER FUNCTIONS
   * Avoids hard-coding color hex codes directly in JavaScript
   * ========================================================
   */
  const getStatusClass = window.getStatusClass || ((s) => s === 'In Progress' ? 'status-progress' : (s === 'Resolved' ? 'status-resolved' : 'status-reported'));
  const getSeverityClass = window.getSeverityClass || ((s) => `severity-${(s || 'medium').toLowerCase()}`);
  const escapeHtml = window.escapeHtml || ((str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '');

  function getPriorityClass(level) {
    switch (String(level).toUpperCase()) {
      case 'CRITICAL': return 'priority-critical';
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      default: return 'priority-low';
    }
  }

  // Color tokens with high contrast between Critical (Red), High (Orange), Medium (Yellow/Gold), Low (Blue)
  function getPriorityColor(level) {
    switch (String(level).toUpperCase()) {
      case 'CRITICAL': return '#dc2626'; // Vivid Crimson Red (Emergency)
      case 'HIGH': return '#ea580c';     // Vibrant Safety Orange (High Hazard)
      case 'MEDIUM': return '#eab308';   // Bright Golden Yellow (Medium - clearly distinct from orange)
      default: return '#0284c7';         // Sky/Royal Blue (Low Severity)
    }
  }

  // Resolve effective priority level by prioritizing highest urgency:
  // Critical emergencies/high danger are never masked as medium
  function getEffectivePriorityLevel(item) {
    if (!item) return 'MEDIUM';
    const sev = String(item.severity || '').toUpperCase();
    const danger = String(item.aiAnalysis && item.aiAnalysis.dangerLevel || '').toUpperCase();
    const priLevel = String(item.priority && item.priority.level || '').toUpperCase();

    if (sev === 'CRITICAL' || danger === 'CRITICAL' || priLevel === 'CRITICAL') {
      return 'CRITICAL';
    }
    if (sev === 'HIGH' || danger === 'HIGH' || priLevel === 'HIGH') {
      return 'HIGH';
    }
    if (sev === 'LOW' && (danger === 'LOW' || !danger) && (priLevel === 'LOW' || !priLevel)) {
      return 'LOW';
    }
    if (priLevel === 'LOW' && (sev === 'LOW' || !sev)) {
      return 'LOW';
    }
    return 'MEDIUM';
  }


  /* ========================================================
   * 4. MAP INTEGRATION (Google Maps + Leaflet / OSM Fallback)
   * (Stage 10 Part 10 & 11)
   * ========================================================
   */
  let leafletMap = null;
  let leafletMarkersGroup = null;
  let leafletMarkersMap = {};
  let leafletHighlightCircle = null;
  let googleHighlightCircle = null;

  // Build the rich brief popup HTML for any complaint on the map
  function buildComplaintBriefPopupHtml(item) {
    const statusClass = getStatusClass(item.status);
    const priorityLevel = getEffectivePriorityLevel(item);
    const priorityScore = (item.priority && item.priority.score !== undefined) ? item.priority.score : 50;
    const priorityClass = getPriorityClass(priorityLevel);
    const dangerLevel = (item.aiAnalysis && item.aiAnalysis.dangerLevel) ? item.aiAnalysis.dangerLevel.toUpperCase() : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
    const reportCount = item.reportCount || 1;
    const voteCount = item.supporters !== undefined ? item.supporters : (item.voters ? item.voters.length : 0);

    const locationStr = (item.location && typeof item.location === 'object' && item.location.address)
      ? item.location.address
      : (item.location || 'Pinned Coordinates');

    const descSnippet = item.description 
      ? (item.description.length > 95 ? item.description.slice(0, 95) + '...' : item.description)
      : 'No description provided.';

    return `
      <div class="map-brief-popup">
        <div class="popup-top-meta">
          <span class="popup-id">${escapeHtml(item.id)}</span>
          <span class="status-badge ${statusClass}">
            <span class="badge-dot"></span>
            ${escapeHtml(item.status)}
          </span>
        </div>
        <h4 class="popup-title">${escapeHtml(item.title)}</h4>
        <p class="popup-desc">${escapeHtml(descSnippet)}</p>
        <div class="popup-badges-row">
          <span class="priority-badge ${priorityClass}">Priority: ${priorityLevel} (${priorityScore}/100)</span>
          <span class="danger-badge">Danger: ${dangerLevel}</span>
        </div>
        <div class="popup-stats-row">
          <span>📢 ${reportCount} Report(s)</span> • <span>👍 ${voteCount} Vote(s)</span>
        </div>
        <div class="popup-location-row" title="${escapeHtml(locationStr)}">
          <span>📍 ${escapeHtml(locationStr)}</span>
        </div>
        <button type="button" class="btn btn-sm btn-primary popup-details-btn" onclick="window.viewComplaintDetails('${escapeHtml(item.id)}')">
          View Full Details &rarr;
        </button>
      </div>
    `;
  }

  // Generate color-coded custom map pin icon based on priority level with distinct symbols
  function createLeafletMarkerIcon(priorityLevel) {
    const level = String(priorityLevel).toUpperCase();
    const color = getPriorityColor(level);
    
    // Distinctive visual symbol inside pin center for quick recognition and accessibility
    let symbol = '●';
    let symbolFontSize = '10px';
    let symbolY = '14.5px';
    if (level === 'CRITICAL') {
      symbol = '!';
      symbolFontSize = '12px';
      symbolY = '15.5px';
    } else if (level === 'HIGH') {
      symbol = '▲';
      symbolFontSize = '8px';
      symbolY = '13.5px';
    } else if (level === 'MEDIUM') {
      symbol = '■';
      symbolFontSize = '8px';
      symbolY = '13.5px';
    } else {
      symbol = '●';
      symbolFontSize = '8px';
      symbolY = '13.5px';
    }

    return L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div class="pin-marker-wrapper" style="--pin-color: ${color};" title="Priority: ${level}">
          <div class="pin-marker-body">
            <svg width="28" height="34" viewBox="0 0 24 30" fill="none" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
              <!-- Outer Pin Teardrop with White Contrast Border -->
              <path d="M12 0C5.37 0 0 5.37 0 12C0 19.5 12 30 12 30C12 30 24 19.5 24 12C24 5.37 18.63 0 12 0Z" fill="${color}" stroke="#ffffff" stroke-width="1.3"/>
              <!-- Inner White Center Disc -->
              <circle cx="12" cy="11" r="5.5" fill="#ffffff"/>
              <!-- High-Contrast Priority Symbol -->
              <text x="12" y="${symbolY}" font-size="${symbolFontSize}" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="middle" fill="${color}">${symbol}</text>
            </svg>
          </div>
          <div class="pin-marker-shadow"></div>
        </div>
      `,
      iconSize: [28, 34],
      iconAnchor: [14, 34],
      popupAnchor: [0, -32]
    });
  }

  function initLeafletComplaintsMap() {
    const mapElement = document.getElementById('complaintsGoogleMap');
    if (!mapElement || !window.L) return;

    try {
      const offlineBanner = document.getElementById('mapOfflineBanner');
      if (offlineBanner) offlineBanner.style.display = 'none';

      leafletMap = L.map('complaintsGoogleMap').setView([DEFAULT_LAT, DEFAULT_LNG], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(leafletMap);

      leafletMarkersGroup = L.layerGroup().addTo(leafletMap);
      updateLeafletMapMarkers(complaints);
      console.log('[Leaflet Map]: View Complaints map initialized.');
    } catch (err) {
      console.error('[Leaflet Map]: Initialization error:', err);
    }
  }

  function updateLeafletMapMarkers(list) {
    if (!leafletMap || !leafletMarkersGroup) return;

    leafletMarkersGroup.clearLayers();
    leafletMarkersMap = {};
    if (leafletHighlightCircle) {
      try { leafletMap.removeLayer(leafletHighlightCircle); } catch (e) {}
      leafletHighlightCircle = null;
    }

    const bounds = [];

    list.forEach(item => {
      let lat = null;
      let lng = null;

      if (item.location && typeof item.location === 'object') {
        lat = item.location.latitude;
        lng = item.location.longitude;
      } else if (item.latitude && item.longitude) {
        lat = item.latitude;
        lng = item.longitude;
      }

      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return;

      const numLat = parseFloat(lat);
      const numLng = parseFloat(lng);
      bounds.push([numLat, numLng]);

      const priorityLevel = getEffectivePriorityLevel(item);
      const customIcon = createLeafletMarkerIcon(priorityLevel);

      const marker = L.marker([numLat, numLng], { icon: customIcon });
      const popupContent = buildComplaintBriefPopupHtml(item);

      marker.bindPopup(popupContent, { maxWidth: 280, className: 'leaflet-custom-popup' });

      // Clicking any marker highlights its location on the map and highlights its card in the list
      marker.on('click', () => {
        highlightLocationOnMap(numLat, numLng, item);
        highlightComplaintCard(item.id);
      });

      leafletMarkersGroup.addLayer(marker);
      leafletMarkersMap[item.id] = { marker, lat: numLat, lng: numLng, item };
    });

    if (bounds.length > 1) {
      leafletMap.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
    } else if (bounds.length === 1) {
      leafletMap.setView(bounds[0], 14);
    }
  }

  // Draw pulsating highlight radar circle around selected problem location
  function highlightLocationOnMap(lat, lng, item) {
    const priorityLevel = getEffectivePriorityLevel(item);
    const color = getPriorityColor(priorityLevel);

    // 1. Highlight on Leaflet Map
    if (leafletMap) {
      if (leafletHighlightCircle) {
        try { leafletMap.removeLayer(leafletHighlightCircle); } catch (e) {}
      }
      leafletHighlightCircle = L.circle([lat, lng], {
        radius: 80,
        color: color,
        fillColor: color,
        fillOpacity: 0.28,
        weight: 3,
        className: 'pulse-map-circle'
      }).addTo(leafletMap);
    }

    // 2. Highlight on Google Map
    if (googleMap) {
      if (googleHighlightCircle) {
        googleHighlightCircle.setMap(null);
      }
      googleHighlightCircle = new google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.85,
        strokeWeight: 3,
        fillColor: color,
        fillOpacity: 0.28,
        map: googleMap,
        center: { lat, lng },
        radius: 80
      });
    }
  }

  // Highlight and gently scroll to the problem's card in the grid below
  function highlightComplaintCard(id) {
    const card = document.querySelector(`.complaint-item-card[data-id="${id}"]`);
    if (!card) return;

    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    card.classList.remove('card-highlight-flash');
    void card.offsetWidth; // trigger reflow
    card.classList.add('card-highlight-flash');

    setTimeout(() => {
      card.classList.remove('card-highlight-flash');
    }, 2500);
  }

  async function loadComplaintsGoogleMap() {
    try {
      const fetchFn = window.civicFetch || fetch;
      const res = await fetchFn('/api/config/maps-key');
      const data = await res.json();
      const apiKey = data.mapsApiKey;

      if (!apiKey || apiKey.trim() === '') {
        console.info('[View Complaints Map]: Google Maps key not set. Activating Leaflet + OpenStreetMap.');
        initLeafletComplaintsMap();
        return;
      }

      if (window.google && window.google.maps) {
        initComplaintsMap();
        return;
      }

      window.onViewComplaintsMapsLoaded = () => {
        isGoogleMapsLoaded = true;
        initComplaintsMap();
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=onViewComplaintsMapsLoaded`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.warn('[View Complaints Map]: Failed to load Google Maps script. Switching to Leaflet.');
        initLeafletComplaintsMap();
      };
      document.head.appendChild(script);

    } catch (err) {
      console.warn('[View Complaints Map]: Error checking maps configuration:', err.message);
      initLeafletComplaintsMap();
    }
  }

  function initComplaintsMap() {
    const mapElement = document.getElementById('complaintsGoogleMap');
    if (!mapElement || !window.google || !window.google.maps) return;

    try {
      googleMap = new google.maps.Map(mapElement, {
        center: { lat: DEFAULT_LAT, lng: DEFAULT_LNG },
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
        ]
      });

      activeInfoWindow = new google.maps.InfoWindow();
      isGoogleMapsLoaded = true;

      // Plot initial markers
      updateMapMarkers(complaints);
    } catch (err) {
      console.error('[Google Maps]: Failed to initialize View Complaints map:', err);
      initLeafletComplaintsMap();
    }
  }

  // Update map markers when complaints list changes or is filtered
  function updateMapMarkers(list) {
    updateLeafletMapMarkers(list);

    if (!googleMap || !isGoogleMapsLoaded) return;

    // Clear previous markers
    mapMarkers.forEach(m => m.setMap(null));
    mapMarkers = [];
    markersMap = {};
    if (googleHighlightCircle) {
      googleHighlightCircle.setMap(null);
      googleHighlightCircle = null;
    }

    const bounds = new google.maps.LatLngBounds();
    let validCoordsCount = 0;

    list.forEach(item => {
      let lat = null;
      let lng = null;

      // Extract coordinates from location object or top-level fields
      if (item.location && typeof item.location === 'object') {
        lat = item.location.latitude;
        lng = item.location.longitude;
      } else if (item.latitude && item.longitude) {
        lat = item.latitude;
        lng = item.longitude;
      }

      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return;

      validCoordsCount++;
      const pos = { lat: parseFloat(lat), lng: parseFloat(lng) };
      bounds.extend(pos);

      const priorityLevel = getEffectivePriorityLevel(item);
      const color = getPriorityColor(priorityLevel);

      const svgMarker = {
        path: 'M 12 2 C 7.03 2 3 6.03 3 11 C 3 16.55 12 26 12 26 C 12 26 21 16.55 21 11 C 21 6.03 16.97 2 12 2 Z',
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: 1.5,
        strokeColor: '#ffffff',
        scale: 1.3,
        anchor: new google.maps.Point(12, 26)
      };

      const marker = new google.maps.Marker({
        position: pos,
        map: googleMap,
        icon: svgMarker,
        title: `${priorityLevel} — ${item.title}`
      });

      const infoContent = buildComplaintBriefPopupHtml(item);

      marker.addListener('click', () => {
        if (activeInfoWindow) activeInfoWindow.close();
        activeInfoWindow.setContent(infoContent);
        activeInfoWindow.open(googleMap, marker);
        highlightLocationOnMap(pos.lat, pos.lng, item);
        highlightComplaintCard(item.id);
      });

      mapMarkers.push(marker);
      markersMap[item.id] = { marker, pos, infoContent, item };
    });

    if (validCoordsCount > 1) {
      googleMap.fitBounds(bounds);
    } else if (validCoordsCount === 1) {
      const firstKey = Object.keys(markersMap)[0];
      if (firstKey && markersMap[firstKey]) {
        googleMap.setCenter(markersMap[firstKey].pos);
        googleMap.setZoom(15);
      }
    }
  }

  // Scroll to and focus a complaint marker on the map with glowing highlight & brief details
  function focusComplaintOnMap(complaintId) {
    const item = complaints.find(c => c.id === complaintId);
    if (!item) return;

    let lat = null, lng = null;
    if (item.location && typeof item.location === 'object') {
      lat = item.location.latitude;
      lng = item.location.longitude;
    } else if (item.latitude && item.longitude) {
      lat = item.latitude;
      lng = item.longitude;
    }

    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      alert(`Problem ${complaintId} does not have map GPS coordinates pinned.`);
      return;
    }

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);

    // Scroll up smoothly to the map viewport
    const mapSection = document.getElementById('complaintsMapSection');
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 1. Leaflet Map
    if (leafletMap && leafletMarkersMap[complaintId]) {
      const entry = leafletMarkersMap[complaintId];
      setTimeout(() => {
        leafletMap.setView([numLat, numLng], 16, { animate: true });
        entry.marker.openPopup();
        highlightLocationOnMap(numLat, numLng, item);
      }, 300);
      return;
    }

    // 2. Google Map
    if (googleMap && markersMap[complaintId]) {
      const entry = markersMap[complaintId];
      setTimeout(() => {
        googleMap.panTo(entry.pos);
        googleMap.setZoom(16);
        if (activeInfoWindow) {
          activeInfoWindow.setContent(entry.infoContent);
          activeInfoWindow.open(googleMap, entry.marker);
        }
        highlightLocationOnMap(numLat, numLng, item);
      }, 300);
      return;
    }
  }

  // Expose function globally so InfoWindow buttons can invoke detail modal
  window.viewComplaintDetails = (id) => {
    openDetailsModal(id);
  };

  // Start map loading
  loadComplaintsGoogleMap();


  /* ========================================================
   * 5. CARD GENERATION & RENDERING (Stage 10 Part 22)
   * ========================================================
   */
  function renderComplaints(list) {
    if (!complaintsGrid) return;

    complaintsGrid.innerHTML = '';

    if (list.length === 0) {
      if (emptyResultsState) emptyResultsState.style.display = 'block';
      if (resultsCountText) resultsCountText.textContent = 'Showing 0 complaints';
      return;
    }

    if (emptyResultsState) emptyResultsState.style.display = 'none';
    if (resultsCountText) {
      resultsCountText.textContent = `Showing ${list.length} of ${complaints.length} complaints`;
    }

    list.forEach(item => {
      const isSupported = userSupportedIds.has(item.id);
      const statusClass = getStatusClass(item.status);
      const severityClass = getSeverityClass(item.severity);

      // AI & Priority values (Stage 10 Part 18 & 22)
      const priorityLevel = (item.priority && item.priority.level) ? item.priority.level : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
      const priorityScore = (item.priority && item.priority.score !== undefined) ? item.priority.score : 50;
      const priorityClass = getPriorityClass(priorityLevel);

      const dangerLevel = (item.aiAnalysis && item.aiAnalysis.dangerLevel) ? item.aiAnalysis.dangerLevel.toUpperCase() : 'MEDIUM';
      const reportCount = item.reportCount || 1;
      const voteCount = item.supporters || (item.voters ? item.voters.length : 0);

      const locationStr = (item.location && typeof item.location === 'object' && item.location.address)
        ? item.location.address
        : (item.location || 'Pinned Area');

      const card = document.createElement('article');
      card.className = 'complaint-item-card';
      card.setAttribute('data-id', item.id);

      card.innerHTML = `
        <!-- Card Header Meta -->
        <div class="card-header-meta">
          <span class="card-complaint-id">${escapeHtml(item.id)}</span>
          <span class="status-badge ${statusClass}">
            <span class="badge-dot"></span>
            ${escapeHtml(item.status)}
          </span>
        </div>

        <!-- Category Badge -->
        <span class="card-category-badge">${escapeHtml(item.category)}</span>

        <!-- Title & Description -->
        <h3 class="card-problem-title">${escapeHtml(item.title)}</h3>
        <p class="card-problem-desc">${escapeHtml(item.description)}</p>

        <!-- AI Priority, Danger & Severity Row (Stage 10 Part 22) -->
        <div class="card-badges-row">
          <span class="priority-badge ${priorityClass}">
            Priority: ${priorityLevel} (${priorityScore}/100)
          </span>
          <span class="danger-badge">
            Danger: ${dangerLevel}
          </span>
        </div>

        <!-- Community Reports & Votes Counter -->
        <div style="display: flex; gap: 1rem; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.65rem;">
          <span title="Number of independent citizen reports">📢 ${reportCount} Report(s)</span>
          <span title="Community upvotes">👍 ${voteCount} Vote(s)</span>
        </div>

        <!-- Location & Date List -->
        <div class="card-info-list">
          <div class="card-info-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${escapeHtml(locationStr)}</span>
          </div>
          <div class="card-info-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Reported on ${escapeHtml(item.date)}</span>
          </div>
        </div>

        <!-- Card Actions Footer with View on Map (Stage 10 Part 22) -->
        <div class="card-actions-footer">
          <button 
            type="button" 
            class="btn-support-complaint ${isSupported ? 'supported' : ''}" 
            data-id="${item.id}"
            ${isSupported ? 'disabled aria-pressed="true"' : 'aria-pressed="false"'}
            aria-label="${isSupported ? 'You voted for this complaint' : 'Vote for this complaint'}"
            title="Endorse this complaint to increase community urgency"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${isSupported 
                ? '<polyline points="20 6 9 17 4 12"></polyline>' 
                : '<polyline points="18 15 12 9 6 15"></polyline>'}
            </svg>
            <span class="support-text">${isSupported ? 'Voted' : 'Vote'}</span>
            <span class="supporter-badge-count">(${voteCount})</span>
          </button>

          <div style="display: flex; gap: 0.4rem;">
            <button 
              type="button" 
              class="btn-view-on-map" 
              data-id="${item.id}"
              title="Pinpoint this hazard on the Google Map above"
            >
              <span>📍 Map</span>
            </button>

            <button 
              type="button" 
              class="btn-view-details" 
              data-id="${item.id}"
              aria-label="View details for complaint ${item.id}"
            >
              <span>Details</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      `;

      complaintsGrid.appendChild(card);
    });
  }


  /* ========================================================
   * 6. SEARCH & MULTI-FILTER ENGINE (Priority Filter included)
   * ========================================================
   */
  function filterComplaints() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
    const selectedStatus = statusFilter ? statusFilter.value : 'all';
    const selectedSeverity = severityFilter ? severityFilter.value : 'all';
    const selectedPriority = priorityFilter ? priorityFilter.value : 'all';

    if (searchClearBtn) {
      if (query.length > 0) {
        searchClearBtn.classList.add('visible');
      } else {
        searchClearBtn.classList.remove('visible');
      }
    }

    const filtered = complaints.filter(item => {
      // 1. Text Search matching title, ID, location, or category
      const locText = (item.location && typeof item.location === 'object' && item.location.address)
        ? item.location.address
        : (item.location || '');

      const matchesSearch = !query || 
        item.title.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        locText.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      // 2. Category matching
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

      // 3. Status matching
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;

      // 4. Severity matching
      const matchesSeverity = selectedSeverity === 'all' || item.severity === selectedSeverity;

      // 5. Priority matching (Stage 10 Part 18)
      const itemPriorityLevel = getEffectivePriorityLevel(item);
      const matchesPriority = selectedPriority === 'all' || itemPriorityLevel.toUpperCase() === selectedPriority.toUpperCase();

      return matchesSearch && matchesCategory && matchesStatus && matchesSeverity && matchesPriority;
    });

    renderComplaints(filtered);
    updateMapMarkers(filtered);
  }

  // Clear all filters back to default
  function resetAllFilters() {
    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'all';
    if (severityFilter) severityFilter.value = 'all';
    if (priorityFilter) priorityFilter.value = 'all';
    if (searchClearBtn) searchClearBtn.classList.remove('visible');

    filterComplaints();
  }


  /* ========================================================
   * 7. COMMUNITY VOTING & PRIORITY UPDATES (Stage 10 Part 14, 15, 19)
   * ========================================================
   */
  function handleSupportClick(buttonEl) {
    const complaintId = buttonEl.getAttribute('data-id');
    if (!complaintId || userSupportedIds.has(complaintId)) return;

    // Find the complaint in the dataset
    const targetComplaint = complaints.find(c => c.id === complaintId);
    if (!targetComplaint) return;

    // Send vote request to Express backend: POST /api/complaints/:id/vote
    const fetchFn = window.civicFetch || fetch;
    fetchFn(`/api/complaints/${complaintId}/vote`, {
      method: 'POST',
      credentials: 'include'
    })
      .then(async res => {
        const data = await res.json();
        if (res.status === 401) {
          alert('Please log in to vote for this civic complaint and help calculate neighborhood priority.');
          window.location.href = 'login.html';
          return;
        }
        if (!res.ok) {
          alert(data.message || 'Could not register community vote.');
          return;
        }

        // Record that current authenticated user voted
        userSupportedIds.add(complaintId);

        // Update vote count and recalculated priority
        const newVotes = data.supportersCount !== undefined ? data.supportersCount : (targetComplaint.supporters || 0) + 1;
        targetComplaint.supporters = newVotes;

        if (data.priority) {
          targetComplaint.priority = data.priority;
        }

        // Update DOM button immediately
        buttonEl.classList.add('supported');
        buttonEl.disabled = true;
        buttonEl.setAttribute('aria-pressed', 'true');
        buttonEl.setAttribute('aria-label', 'You voted for this complaint');

        buttonEl.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span class="support-text">Voted</span>
          <span class="supporter-badge-count">(${newVotes})</span>
        `;

        // Update priority badge on the card if present
        const card = document.querySelector(`.complaint-item-card[data-id="${complaintId}"]`);
        if (card && targetComplaint.priority) {
          const pLevel = targetComplaint.priority.level || 'MEDIUM';
          const pScore = targetComplaint.priority.score || 50;
          const pBadge = card.querySelector('.priority-badge');
          if (pBadge) {
            pBadge.className = `priority-badge ${getPriorityClass(pLevel)}`;
            pBadge.textContent = `Priority: ${pLevel} (${pScore}/100)`;
          }
        }

        // Refresh map marker with updated priority
        updateMapMarkers(complaints);
      })
      .catch(err => {
        console.warn(`[Local Fallback]: Upvoted ${complaintId} in browser memory:`, err.message);
        userSupportedIds.add(complaintId);
        targetComplaint.supporters = (targetComplaint.supporters || 0) + 1;
        buttonEl.classList.add('supported');
        buttonEl.disabled = true;
        buttonEl.innerHTML = `<span class="support-text">Voted</span> <span class="supporter-badge-count">(${targetComplaint.supporters})</span>`;
      });
  }


  /* ========================================================
   * 8. VIEW DETAILS MODAL (AI Danger Assessment + Priority Breakdown)
   * (Stage 10 Part 22 & 23)
   * ========================================================
   */
  function openDetailsModal(complaintId) {
    const item = complaints.find(c => c.id === complaintId);
    if (!item || !complaintDetailModal || !modalDetailBody) return;

    const statusClass = getStatusClass(item.status);
    const severityClass = getSeverityClass(item.severity);

    // AI Danger & Priority values
    const dangerLevel = (item.aiAnalysis && item.aiAnalysis.dangerLevel) ? item.aiAnalysis.dangerLevel.toUpperCase() : 'MEDIUM';
    const dangerScore = (item.aiAnalysis && item.aiAnalysis.dangerScore !== undefined) ? item.aiAnalysis.dangerScore : 50;
    const aiReason = (item.aiAnalysis && item.aiAnalysis.reason) ? item.aiAnalysis.reason : 'Automated hazard risk assessment conducted based on complaint keywords and severity.';
    
    const priorityLevel = (item.priority && item.priority.level) ? item.priority.level : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
    const priorityScore = (item.priority && item.priority.score !== undefined) ? item.priority.score : 50;
    const priorityClass = getPriorityClass(priorityLevel);

    const reportCount = item.reportCount || 1;
    const voteCount = item.supporters !== undefined ? item.supporters : (item.voters ? item.voters.length : 0);

    let addressStr = 'Pinned Coordinates';
    let coordsStr = 'N/A';
    if (item.location && typeof item.location === 'object') {
      addressStr = item.location.address || 'Pinned Location';
      if (item.location.latitude && item.location.longitude) {
        coordsStr = `${item.location.latitude.toFixed(6)}, ${item.location.longitude.toFixed(6)}`;
      }
    } else if (item.location) {
      addressStr = item.location;
    }
    if (item.latitude && item.longitude) {
      coordsStr = `${item.latitude}, ${item.longitude}`;
    }

    const dateStr = item.date || (item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recently Reported');

    let imageHtml = '';
    if (item.image && typeof item.image === 'string' && item.image.trim() !== '' && item.image !== 'none') {
      imageHtml = `
        <div class="detail-section">
          <span class="detail-label">Attached Photo / Evidence</span>
          <div class="detail-image-box">
            <img src="${escapeHtml(item.image)}" alt="Evidence photo for ${escapeHtml(item.title)}" class="detail-photo" onerror="this.closest('.detail-section').style.display='none';">
          </div>
        </div>
      `;
    } else {
      imageHtml = `
        <div class="detail-section">
          <span class="detail-label">Attached Photo / Evidence</span>
          <div class="detail-no-image-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>No photo attached with this complaint report</span>
          </div>
        </div>
      `;
    }

    let resolutionHtml = '';
    if (item.status === 'Resolved' && (item.resolutionNote || item.resolvedDate)) {
      resolutionHtml = `
        <div style="background-color: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 8px; padding: 1rem; color: #065f46;">
          <strong style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem;">
            <span>✅</span> Resolution Details:
          </strong>
          ${item.resolvedDate ? `<div style="font-size: 0.8rem; margin-bottom: 0.35rem; color: #047857;">Resolved on: <strong>${escapeHtml(item.resolvedDate)}</strong></div>` : ''}
          ${item.resolutionNote ? `<p style="margin: 0; font-size: 0.88rem; line-height: 1.5;">${escapeHtml(item.resolutionNote)}</p>` : ''}
        </div>
      `;
    }

    modalDetailBody.innerHTML = `
      <!-- Header Meta -->
      <div class="detail-header-meta">
        <span class="detail-complaint-id">${escapeHtml(item.id)}</span>
        <div class="detail-badges-group">
          <span class="priority-badge ${priorityClass}">Priority: ${priorityLevel} (${priorityScore}/100)</span>
          <span class="severity-badge ${severityClass}">Severity: ${escapeHtml(item.severity)}</span>
          <span class="status-badge ${statusClass}">
            <span class="badge-dot"></span>
            ${escapeHtml(item.status)}
          </span>
        </div>
      </div>

      <!-- Problem Title -->
      <h2 class="detail-title">${escapeHtml(item.title)}</h2>

      <!-- Attached Image / Evidence -->
      ${imageHtml}

      <!-- Full Description -->
      <div class="detail-section">
        <span class="detail-label">Problem Description</span>
        <div class="detail-text">${escapeHtml(item.description)}</div>
      </div>

      <!-- Resolution Notice if Resolved -->
      ${resolutionHtml}

      <!-- AI Danger Assessment (Stage 10 Part 23) -->
      <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <strong style="color: var(--navy-blue); font-size: 0.9rem; display: flex; align-items: center; gap: 0.35rem;">
            <span>🤖</span> AI Danger Assessment
          </strong>
          <span style="font-size: 0.8rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 4px; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;">
            ${dangerLevel} (${dangerScore}/100)
          </span>
        </div>
        <p style="font-size: 0.84rem; color: #475569; margin: 0 0 0.5rem; line-height: 1.5;">
          "${escapeHtml(aiReason)}"
        </p>
        <span style="font-size: 0.72rem; color: #64748b; font-style: italic;">
          * AI-assisted assessment. Final repair priority is mathematically balanced with citizen reports and community voting.
        </span>
      </div>

      <!-- Priority Calculation Formula Breakdown (Stage 10 Part 17) -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.9rem 1rem; font-size: 0.82rem; color: #166534;">
        <strong>Priority Score Calculation:</strong>
        <div style="margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.2rem;">
          <span>• AI Danger Contribution (60%): <strong>${Math.round(dangerScore * 0.6)} pts</strong></span>
          <span>• Community Weight (40%): <strong>${Math.round(priorityScore - (dangerScore * 0.6))} pts</strong> (based on ${reportCount} report(s) &amp; ${voteCount} vote(s))</span>
          <span>• Total Priority Score: <strong>${priorityScore}/100 (${priorityLevel})</strong></span>
        </div>
      </div>

      <!-- Details Metadata Grid -->
      <div class="detail-info-grid">
        <div class="detail-info-cell">
          <span class="detail-label">Category</span>
          <span class="detail-info-cell-value">${escapeHtml(item.category)}</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">Reported On</span>
          <span class="detail-info-cell-value">${escapeHtml(dateStr)}</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">Location / Landmark</span>
          <span class="detail-info-cell-value">${escapeHtml(addressStr)}</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">GPS Coordinates</span>
          <span class="detail-info-cell-value" style="font-family: monospace;">${escapeHtml(coordsStr)}</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">Community Support</span>
          <span class="detail-info-cell-value">👍 ${voteCount} Vote(s)</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">Citizen Reports</span>
          <span class="detail-info-cell-value">📢 ${reportCount} Report(s)</span>
        </div>

        <div class="detail-info-cell" style="grid-column: 1 / -1;">
          <span class="detail-label">Reported By</span>
          <span class="detail-info-cell-value">${escapeHtml(item.reporterName || item.reportedBy || 'Civic User')} (${escapeHtml(item.verification || 'Verified Citizen')})</span>
        </div>
      </div>
    `;

    complaintDetailModal.removeAttribute('hidden');
    const modalBodyEl = complaintDetailModal.querySelector('.modal-body');
    if (modalBodyEl) {
      modalBodyEl.scrollTop = 0;
    }
    document.body.style.overflow = 'hidden';
  }

  function closeDetailsModal() {
    if (!complaintDetailModal) return;
    complaintDetailModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }


  /* ========================================================
   * 9. EVENT LISTENERS ATTACHMENT
   * ========================================================
   */

  // Live text search on typing
  if (searchInput) {
    searchInput.addEventListener('input', filterComplaints);
  }

  // Clear search input on (X) button
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.classList.remove('visible');
      searchInput.focus();
      filterComplaints();
    });
  }

  // Filter dropdown listeners
  if (categoryFilter) categoryFilter.addEventListener('change', filterComplaints);
  if (statusFilter) statusFilter.addEventListener('change', filterComplaints);
  if (severityFilter) severityFilter.addEventListener('change', filterComplaints);
  if (priorityFilter) priorityFilter.addEventListener('change', filterComplaints);

  // Clear Filters button listeners
  if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', resetAllFilters);
  if (emptyClearBtn) emptyClearBtn.addEventListener('click', resetAllFilters);

  // Event delegation on complaints grid for Support, Map, and View Details
  if (complaintsGrid) {
    complaintsGrid.addEventListener('click', (e) => {
      // Support / Vote Button clicked
      const supportBtn = e.target.closest('.btn-support-complaint');
      if (supportBtn) {
        handleSupportClick(supportBtn);
        return;
      }

      // View on Map Button clicked (Stage 10 Part 22)
      const mapBtn = e.target.closest('.btn-view-on-map');
      if (mapBtn) {
        const id = mapBtn.getAttribute('data-id');
        if (id) focusComplaintOnMap(id);
        return;
      }

      // View Details Button clicked
      const detailsBtn = e.target.closest('.btn-view-details');
      if (detailsBtn) {
        const id = detailsBtn.getAttribute('data-id');
        if (id) openDetailsModal(id);
        return;
      }
    });
  }

  // Modal close buttons
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeDetailsModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeDetailsModal);

  // Close modal when clicking backdrop
  if (complaintDetailModal) {
    complaintDetailModal.addEventListener('click', (e) => {
      if (e.target === complaintDetailModal) closeDetailsModal();
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && complaintDetailModal && !complaintDetailModal.hasAttribute('hidden')) {
      closeDetailsModal();
    }
  });


  /* ========================================================
   * 10. INITIAL PAGE LOAD & BACKEND API INTEGRATION
   * ========================================================
   */
  async function loadComplaintsFromBackend() {
    try {
      console.log('Connecting to Express backend: GET /api/complaints ...');
      const fetchFn = window.civicFetch || fetch;
      const response = await fetchFn('/api/complaints');

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        complaints = result.data;
        console.log(`[Express API Connected]: Successfully loaded ${complaints.length} live complaints from backend.`);

        const badge = document.querySelector('.complaints-hero-badge');
        if (badge) {
          badge.innerHTML = `<span>🟢</span> Live Express API Connected (${complaints.length} tickets)`;
          badge.style.backgroundColor = '#ecfdf5';
          badge.style.color = '#065f46';
          badge.style.border = '1px solid #a7f3d0';
        }
      } else {
        complaints = [];
      }
    } catch (err) {
      console.warn(`[Express Backend Notice]: Could not reach /api/complaints (${err.message}).`);
      complaints = [];
      if (complaintsGrid) {
        complaintsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 2.5rem 1.5rem; text-align: center; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; color: #991b1b; margin-bottom: 1.5rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
            <h3 style="margin: 0 0 0.5rem; font-size: 1.25rem;">Unable to load complaints from database</h3>
            <p style="margin: 0 0 1rem; font-size: 0.9rem; color: #7f1d1d;">Could not reach <code>/api/complaints</code> (${escapeHtml(err.message)}). Please verify backend server is running.</p>
            <button type="button" class="btn btn-primary" onclick="window.location.reload()" style="padding: 0.5rem 1.25rem;">
              Retry Connection
            </button>
          </div>
        `;
      }
      return;
    } finally {
      renderComplaints(complaints);
      updateMapMarkers(complaints);
    }
  }

  // Load complaints from backend
  loadComplaintsFromBackend();

  console.log('Civic Connect View Complaints Dashboard with Google Maps & AI Priority System Initialized.');
});
