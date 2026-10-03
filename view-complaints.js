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
   * 1. COMPLAINTS DATASET (Fallback Mock + Live API Store)
   * Populated live from GET /api/complaints via Express
   * ========================================================
   */
  let complaints = [
    {
      id: "CC-1001",
      title: "Large pothole cluster near main road",
      category: "Road/Pothole",
      description: "Deep asphalt erosion causing severe traffic congestion and near-misses for two-wheelers during rainy hours near Metro Pillar 42.",
      location: "Gorakhpur, Uttar Pradesh",
      date: "28 September 2026",
      severity: "High",
      status: "Under Verification",
      supporters: 14,
      reportedBy: "Civic User"
    },
    {
      id: "CC-1002",
      title: "Overflowing sewage drain near market entrance",
      category: "Sewage",
      description: "Blocked underground sewer line causing foul wastewater to spill onto the pedestrian walkway and retail market entrance.",
      location: "Sector 18 Market, Noida, Uttar Pradesh",
      date: "30 September 2026",
      severity: "Critical",
      status: "In Progress",
      supporters: 32,
      reportedBy: "Civic User"
    },
    {
      id: "CC-1003",
      title: "Four non-functional streetlights along school zone",
      category: "Street Light",
      description: "Streetlights have been completely dark for over a week, making evening pedestrian transit unsafe near the girls secondary school.",
      location: "Indira Nagar, Lucknow, Uttar Pradesh",
      date: "01 October 2026",
      severity: "Medium",
      status: "Reported",
      supporters: 9,
      reportedBy: "Civic User"
    },
    {
      id: "CC-1004",
      title: "Severe waterlogging at railway underpass during rains",
      category: "Waterlogging",
      description: "Subway drainage pumps failed during recent monsoon rains, leaving 2 feet of stagnant rainwater blocking cars and two-wheelers.",
      location: "Shivaji Nagar Underpass, Pune, Maharashtra",
      date: "02 October 2026",
      severity: "High",
      status: "In Progress",
      supporters: 45,
      reportedBy: "Civic User"
    },
    {
      id: "CC-1005",
      title: "Uncollected municipal garbage dump on roadside",
      category: "Garbage/Waste",
      description: "Solid waste has not been collected for five days. Stray animals are scattering plastic waste onto the active roadway.",
      location: "Banjara Hills Road No. 12, Hyderabad, Telangana",
      date: "29 September 2026",
      severity: "Medium",
      status: "Reported",
      supporters: 18,
      reportedBy: "Civic User"
    },
    {
      id: "CC-1006",
      title: "Damaged traffic signal causing chaotic intersection",
      category: "Traffic",
      description: "Red and amber lights blinking erratically on the 4-way intersection, leading to heavy vehicular gridlock and near-accidents.",
      location: "MG Road Junction, Bengaluru, Karnataka",
      date: "25 September 2026",
      severity: "Critical",
      status: "Resolved",
      supporters: 68,
      reportedBy: "Civic User"
    },
    {
      id: "CC-1007",
      title: "Caved-in drainage manhole slab near bus shelter",
      category: "Road/Pothole",
      description: "Heavy concrete manhole lid collapsed into the sewer pit. Dangerously open hole with no safety barricades or warning cones.",
      location: "Civil Lines, Kanpur, Uttar Pradesh",
      date: "27 September 2026",
      severity: "High",
      status: "Resolved",
      supporters: 51,
      reportedBy: "Civic User"
    },
    {
      id: "CC-1008",
      title: "Blind corner without convex mirror at frequent accident turn",
      category: "Accident",
      description: "Sharp blind turn on narrow arterial road has witnessed 3 two-wheeler collisions this month. Requires warning rumble strips and convex mirror.",
      location: "Mall Road, Shimla, Himachal Pradesh",
      date: "02 October 2026",
      severity: "High",
      status: "Under Verification",
      supporters: 27,
      reportedBy: "Civic User"
    }
  ];

  // Track user-supported complaint IDs in memory (prevents repeated voting)
  const userSupportedIds = new Set();


  /* ========================================================
   * 2. DOM ELEMENT REFERENCES
   * ========================================================
   */
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
  function getStatusClass(status) {
    switch (status) {
      case 'Reported':
        return 'status-reported';
      case 'Under Verification':
        return 'status-verification';
      case 'In Progress':
        return 'status-progress';
      case 'Resolved':
        return 'status-resolved';
      default:
        return 'status-reported';
    }
  }

  function getSeverityClass(severity) {
    switch (severity) {
      case 'Low':
        return 'severity-low';
      case 'Medium':
        return 'severity-medium';
      case 'High':
        return 'severity-high';
      case 'Critical':
        return 'severity-critical';
      default:
        return 'severity-medium';
    }
  }

  function getPriorityClass(level) {
    switch (String(level).toUpperCase()) {
      case 'CRITICAL': return 'priority-critical';
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      default: return 'priority-low';
    }
  }

  function getPriorityColor(level) {
    switch (String(level).toUpperCase()) {
      case 'CRITICAL': return '#dc2626';
      case 'HIGH': return '#ea580c';
      case 'MEDIUM': return '#d97706';
      default: return '#0284c7';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }


  /* ========================================================
   * 4. GOOGLE MAPS API INTEGRATION & PRIORITY MARKERS
   * (Stage 10 Part 10 & 11)
   * ========================================================
   */
  async function loadComplaintsGoogleMap() {
    try {
      const res = await fetch('/api/config/maps-key');
      const data = await res.json();
      const apiKey = data.mapsApiKey;

      if (!apiKey) {
        console.warn('[View Complaints Map]: GOOGLE_MAPS_API_KEY is not configured in .env. Map offline banner shown.');
        const offlineBanner = document.getElementById('mapOfflineBanner');
        if (offlineBanner) offlineBanner.style.display = 'flex';
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
        console.error('[View Complaints Map]: Failed to load Google Maps script.');
        const offlineBanner = document.getElementById('mapOfflineBanner');
        if (offlineBanner) offlineBanner.style.display = 'flex';
      };
      document.head.appendChild(script);

    } catch (err) {
      console.warn('[View Complaints Map]: Error checking maps configuration:', err.message);
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
    }
  }

  // Update map markers when complaints list changes or is filtered
  function updateMapMarkers(list) {
    if (!googleMap || !isGoogleMapsLoaded) return;

    // Clear previous markers
    mapMarkers.forEach(m => m.setMap(null));
    mapMarkers = [];
    markersMap = {};

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

      // Check if coordinates are valid numbers
      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return;

      validCoordsCount++;
      const pos = { lat: parseFloat(lat), lng: parseFloat(lng) };
      bounds.extend(pos);

      const priorityLevel = (item.priority && item.priority.level) ? item.priority.level : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
      const priorityScore = (item.priority && item.priority.score !== undefined) ? item.priority.score : 50;
      const dangerLevel = (item.aiAnalysis && item.aiAnalysis.dangerLevel) ? item.aiAnalysis.dangerLevel.toUpperCase() : 'MEDIUM';
      const reportCount = item.reportCount || 1;
      const voteCount = item.supporters || (item.voters ? item.voters.length : 0);
      const color = getPriorityColor(priorityLevel);

      // Create distinctive SVG pin marker with priority level color and symbol
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

      // InfoWindow HTML with accessible priority and danger details (Part 10 & 11)
      const infoContent = `
        <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding: 4px; max-width: 260px; line-height: 1.4;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-family: monospace; font-size: 0.78rem; font-weight: 800; color: #1e40af; background-color: #dbeafe; padding: 1px 5px; border-radius: 3px;">
              ${escapeHtml(item.id)}
            </span>
            <span style="font-size: 0.72rem; font-weight: 800; color: ${color}; text-transform: uppercase;">
              ${priorityLevel} (${priorityScore}/100)
            </span>
          </div>
          <h4 style="margin: 0 0 4px; font-size: 0.95rem; color: #0f172a; font-weight: 700;">
            ${escapeHtml(item.title)}
          </h4>
          <div style="font-size: 0.75rem; color: #475569; margin-bottom: 6px;">
            <span>Category: <strong>${escapeHtml(item.category)}</strong></span><br>
            <span>Danger: <strong style="color: ${color};">${dangerLevel}</strong></span> • 
            <span>Status: <strong>${escapeHtml(item.status)}</strong></span>
          </div>
          <div style="font-size: 0.75rem; color: #07546b; font-weight: 700; background-color: #f0fdf4; padding: 3px 6px; border-radius: 4px; margin-bottom: 8px;">
            📢 ${reportCount} Report(s) • 👍 ${voteCount} Vote(s)
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="window.viewComplaintDetails('${escapeHtml(item.id)}')" style="width: 100%; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
            View Full Details
          </button>
        </div>
      `;

      marker.addListener('click', () => {
        if (activeInfoWindow) activeInfoWindow.close();
        activeInfoWindow.setContent(infoContent);
        activeInfoWindow.open(googleMap, marker);
      });

      mapMarkers.push(marker);
      markersMap[item.id] = { marker, pos, infoContent };
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

  // Scroll to and focus a complaint marker on the Google Map
  function focusComplaintOnMap(complaintId) {
    const entry = markersMap[complaintId];
    const mapSection = document.getElementById('complaintsMapSection');

    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (entry && googleMap) {
      googleMap.panTo(entry.pos);
      googleMap.setZoom(16);
      if (activeInfoWindow) {
        activeInfoWindow.setContent(entry.infoContent);
        activeInfoWindow.open(googleMap, entry.marker);
      }
    } else {
      console.warn(`[Map Notice]: Coordinates for ticket ${complaintId} are not plotted or map is offline.`);
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
      const itemPriorityLevel = (item.priority && item.priority.level) ? item.priority.level : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
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
    fetch(`/api/complaints/${complaintId}/vote`, {
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
    const voteCount = item.supporters || (item.voters ? item.voters.length : 0);

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

      <!-- Full Description -->
      <div class="detail-section">
        <span class="detail-label">Problem Description</span>
        <div class="detail-text">${escapeHtml(item.description)}</div>
      </div>

      <!-- AI Danger Assessment (Stage 10 Part 23) -->
      <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
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
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.9rem 1rem; margin-bottom: 1.25rem; font-size: 0.82rem; color: #166534;">
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
          <span class="detail-label">Location / Landmark</span>
          <span class="detail-info-cell-value">${escapeHtml(addressStr)}</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">GPS Coordinates</span>
          <span class="detail-info-cell-value" style="font-family: monospace;">${escapeHtml(coordsStr)}</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">Community Weight</span>
          <span class="detail-info-cell-value">${reportCount} Report(s) • ${voteCount} Vote(s)</span>
        </div>

        <div class="detail-info-cell" style="grid-column: 1 / -1;">
          <span class="detail-label">Reported By</span>
          <span class="detail-info-cell-value">${escapeHtml(item.reportedBy || 'Civic User')} (Verified Citizen)</span>
        </div>
      </div>
    `;

    complaintDetailModal.removeAttribute('hidden');
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
      const response = await fetch('/api/complaints');

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
      }
    } catch (err) {
      console.warn(`[Express Backend Notice]: Could not reach /api/complaints (${err.message}). Using local sample data fallback.`);
    } finally {
      renderComplaints(complaints);
      updateMapMarkers(complaints);
    }
  }

  // Load complaints from backend
  loadComplaintsFromBackend();

  console.log('Civic Connect View Complaints Dashboard with Google Maps & AI Priority System Initialized.');
});
