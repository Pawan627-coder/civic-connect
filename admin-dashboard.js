/**
 * ========================================================
 * CIVIC CONNECT - ADMIN DASHBOARD CONTROLLER (admin-dashboard.js)
 * Stage 5: Municipal Administration & Verification Console
 * ========================================================
 * 
 * SECURITY NOTE (Beginner Architectural Guide):
 * Frontend admin controls are for demonstration only. 
 * Real authorization and role-based access control must be 
 * implemented on the backend (Node.js, Express, MongoDB, JWT).
 * 
 * In this stage, you will learn how:
 * 1. An array of complaint objects represents your database collection.
 * 2. Multi-criteria search and filters combine reactively.
 * 3. Administrative status transitions (Verify, Reject, Progress, Resolve) update memory & DOM.
 * 4. Summary cards, category bars, and analytics calculate on the fly.
 * 5. An activity audit log tracks all administrative interventions.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ========================================================
   * 1. COMPLAINTS DATASET (Live Database Store + Fallback)
   * Populated dynamically from GET /api/complaints
   * ========================================================
   */
  let complaints = [
    {
      id: "CC-1001",
      title: "Large pothole cluster near main road",
      category: "Road/Pothole",
      description: "Deep asphalt erosion causing severe traffic congestion and near-misses for two-wheelers during rainy hours near Metro Pillar 42.",
      location: "Gorakhpur, Uttar Pradesh",
      date: "28 Sep 2026",
      severity: "High",
      status: "Under Verification",
      verification: "Pending",
      reportedBy: "Civic User",
      image: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80",
      supporters: 14,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    },
    {
      id: "CC-1002",
      title: "Four street lights not working along school road",
      category: "Street Light",
      description: "Streetlights have been completely dark for over a week, making evening transit unsafe for pedestrians near the girls secondary school.",
      location: "Civil Lines, Gorakhpur, Uttar Pradesh",
      date: "27 Sep 2026",
      severity: "Medium",
      status: "Reported",
      verification: "Pending",
      reportedBy: "Rahul Verma",
      image: "",
      supporters: 8,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    },
    {
      id: "CC-1003",
      title: "Severe sewage overflow flooding market entrance",
      category: "Sewage",
      description: "Blocked underground sewer main causing foul contaminated wastewater to pool across pedestrian walkway and store entrances.",
      location: "Sector 18 Market, Noida, Uttar Pradesh",
      date: "30 Sep 2026",
      severity: "Critical",
      status: "In Progress",
      verification: "Verified",
      reportedBy: "Pooja Sharma",
      image: "https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?w=600&auto=format&fit=crop&q=80",
      supporters: 39,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    },
    {
      id: "CC-1004",
      title: "Deep trench left open after pipeline excavation",
      category: "Road/Pothole",
      description: "Excavation pit left without warning cones, reflective tape, or barricades. High hazard for night commuters and bicyclists.",
      location: "Indira Nagar, Lucknow, Uttar Pradesh",
      date: "01 Oct 2026",
      severity: "Critical",
      status: "Reported",
      verification: "Pending",
      reportedBy: "Anil Kumar",
      image: "",
      supporters: 22,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    },
    {
      id: "CC-1005",
      title: "Uncollected roadside municipal garbage dump",
      category: "Garbage/Waste",
      description: "Community solid waste bin overflowing for 5 consecutive days. Stray animals scattering trash onto active two-lane roadway.",
      location: "Banjara Hills, Hyderabad, Telangana",
      date: "29 Sep 2026",
      severity: "Medium",
      status: "Reported",
      verification: "Pending",
      reportedBy: "Sunita Reddy",
      image: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop&q=80",
      supporters: 17,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    },
    {
      id: "CC-1006",
      title: "Traffic signal completely dead at 4-way intersection",
      category: "Traffic",
      description: "Traffic control lights malfunctioned following power surge, leading to chaotic gridlock and high risk of vehicle collisions.",
      location: "MG Road Junction, Bengaluru, Karnataka",
      date: "25 Sep 2026",
      severity: "Critical",
      status: "Resolved",
      verification: "Verified",
      reportedBy: "Karthik Raja",
      image: "",
      supporters: 64,
      resolvedDate: "26 Sep 2026",
      resolvedBy: "Traffic Cell Admin",
      resolutionNote: "Electronic controller motherboard replaced and signal timer sequence calibrated."
    },
    {
      id: "CC-1007",
      title: "Caved-in storm drainage slab near bus shelter",
      category: "Road/Pothole",
      description: "Reinforced drain slab fractured under heavy bus weight. Open pit created directly in the boarding queue area.",
      location: "Civil Lines, Kanpur, Uttar Pradesh",
      date: "27 Sep 2026",
      severity: "High",
      status: "Resolved",
      verification: "Verified",
      reportedBy: "Manoj Tiwari",
      image: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=600&auto=format&fit=crop&q=80",
      supporters: 48,
      resolvedDate: "30 Sep 2026",
      resolvedBy: "Public Works Admin",
      resolutionNote: "Pre-cast heavy duty RCC slab installed and perimeter grouted flush with pavement."
    },
    {
      id: "CC-1008",
      title: "Severe waterlogging blocking railway subway underpass",
      category: "Waterlogging",
      description: "Stormwater runoff accumulated to 2.5 feet depth due to silted intake grates. Two-wheelers and sedans completely halted.",
      location: "Shivaji Nagar Subway, Pune, Maharashtra",
      date: "02 Oct 2026",
      severity: "High",
      status: "In Progress",
      verification: "Verified",
      reportedBy: "Meera Deshmukh",
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
      supporters: 43,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    },
    {
      id: "CC-1009",
      title: "High-risk blind mountain turn without convex mirror",
      category: "Accident",
      description: "Narrow hair-pin turn has seen multiple sideswipes. Commuters unable to see oncoming passenger buses.",
      location: "Mall Road, Shimla, Himachal Pradesh",
      date: "02 Oct 2026",
      severity: "High",
      status: "Under Verification",
      verification: "Verified",
      reportedBy: "Vikram Negi",
      image: "",
      supporters: 29,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    },
    {
      id: "CC-1010",
      title: "Illegal advertisement hoarding obstructing stop sign",
      category: "Other",
      description: "Large vinyl promotional billboard erected directly in front of the municipal regulatory stop sign.",
      location: "MI Road, Jaipur, Rajasthan",
      date: "03 Oct 2026",
      severity: "Low",
      status: "Reported",
      verification: "Pending",
      reportedBy: "Gaurav Singh",
      image: "",
      supporters: 6,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    },
    {
      id: "CC-1011",
      title: "Faded zebra crossing & missing pedestrian signage",
      category: "Traffic",
      description: "Thermal markings totally erased by monsoon traffic near hospital gate. Patients and staff face difficulty crossing.",
      location: "Cantt Road, Varanasi, Uttar Pradesh",
      date: "01 Oct 2026",
      severity: "Medium",
      status: "In Progress",
      verification: "Verified",
      reportedBy: "Deepak Yadav",
      image: "",
      supporters: 15,
      resolvedDate: "",
      resolvedBy: "",
      resolutionNote: ""
    },
    {
      id: "CC-1012",
      title: "Spam advertisement submission with abusive text",
      category: "Other",
      description: "Non-civic submission advertising commercial services. No municipal road hazard reported.",
      location: "Unknown / Unspecified",
      date: "24 Sep 2026",
      severity: "Low",
      status: "Rejected",
      verification: "Rejected",
      reportedBy: "Anonymous User",
      image: "",
      supporters: 0,
      resolvedDate: "",
      resolvedBy: "Civic Admin",
      resolutionNote: "Ticket rejected: violates community standards and contains no valid road defect."
    }
  ];

  /* ========================================================
   * 2. SAMPLE REGISTERED CITIZENS DATASET
   * ========================================================
   */
  const sampleUsers = [
    {
      id: "U001",
      name: "Civic User",
      email: "user@example.com",
      reported: 8,
      resolved: 5,
      tokens: 24,
      status: "Active"
    },
    {
      id: "U002",
      name: "Rahul Verma",
      email: "rahul.verma@example.com",
      reported: 4,
      resolved: 2,
      tokens: 14,
      status: "Active"
    },
    {
      id: "U003",
      name: "Pooja Sharma",
      email: "pooja.sharma@example.com",
      reported: 6,
      resolved: 4,
      tokens: 21,
      status: "Active"
    },
    {
      id: "U004",
      name: "Meera Deshmukh",
      email: "meera.d@example.com",
      reported: 5,
      resolved: 3,
      tokens: 18,
      status: "Active"
    },
    {
      id: "U005",
      name: "Karthik Raja",
      email: "karthik.raja@example.com",
      reported: 12,
      resolved: 9,
      tokens: 46,
      status: "Active"
    },
    {
      id: "U006",
      name: "Anonymous User",
      email: "spam.test@example.com",
      reported: 2,
      resolved: 0,
      tokens: 0,
      status: "Flagged"
    }
  ];

  /* ========================================================
   * 3. RECENT ADMIN AUDIT ACTIVITY LOG
   * ========================================================
   */
  let adminActivities = [
    {
      action: "Admin verified CC-1009 (Blind mountain turn)",
      time: "10 mins ago",
      type: "verify"
    },
    {
      action: "Admin changed CC-1008 to In Progress",
      time: "25 mins ago",
      type: "progress"
    },
    {
      action: "Admin resolved CC-1007 (Caved-in drainage slab)",
      time: "2 hours ago",
      type: "resolve"
    },
    {
      action: "Admin rejected CC-1012 (Commercial spam submission)",
      time: "Yesterday",
      type: "reject"
    }
  ];

  // Currently opened complaint for modal reviews
  let activeComplaintId = null;

  /* ========================================================
   * 4. DOM ELEMENT REFERENCES
   * ========================================================
   */
  // Stat cards
  const statTotalEl = document.getElementById('statTotalComplaints');
  const statPendingEl = document.getElementById('statPendingVerification');
  const statProgressEl = document.getElementById('statInProgress');
  const statResolvedEl = document.getElementById('statResolved');
  const statHighCriticalEl = document.getElementById('statHighCritical');

  // Search & Filter controls
  const searchInput = document.getElementById('adminSearchInput');
  const searchClearBtn = document.getElementById('adminSearchClearBtn');
  const filterCategory = document.getElementById('filterCategory');
  const filterStatus = document.getElementById('filterStatus');
  const filterSeverity = document.getElementById('filterSeverity');
  const filterPriority = document.getElementById('filterPriority');
  const filterDanger = document.getElementById('filterDanger');
  const filterVerification = document.getElementById('filterVerification');
  const clearFiltersBtn = document.getElementById('adminClearFiltersBtn');
  const emptyResetFiltersBtn = document.getElementById('emptyResetFiltersBtn');
  const resultsCountBadge = document.getElementById('resultsCountBadge');

  // Table elements
  const complaintsTableBody = document.getElementById('complaintsTableBody');
  const emptyTableState = document.getElementById('emptyTableState');

  // Analytics & Category Visuals
  const categoryStatsList = document.getElementById('categoryStatsList');
  const adminActivityList = document.getElementById('adminActivityList');
  const kpiResolutionRate = document.getElementById('kpiResolutionRate');
  const kpiResolvedRatio = document.getElementById('kpiResolvedRatio');
  const kpiResolutionBar = document.getElementById('kpiResolutionBar');
  const kpiActiveWorkload = document.getElementById('kpiActiveWorkload');
  const kpiActiveBar = document.getElementById('kpiActiveBar');
  const kpiCriticalRate = document.getElementById('kpiCriticalRate');
  const kpiCriticalCountText = document.getElementById('kpiCriticalCountText');
  const kpiCriticalBar = document.getElementById('kpiCriticalBar');
  const kpiTopCategory = document.getElementById('kpiTopCategory');
  const kpiTopCategoryCount = document.getElementById('kpiTopCategoryCount');

  // Users section
  const usersTableBody = document.getElementById('usersTableBody');
  const userCountBadge = document.getElementById('userCountBadge');

  // Review Modal
  const reviewModal = document.getElementById('reviewModal');
  const reviewModalTitle = document.getElementById('reviewModalTitle');
  const modalComplaintIdDisplay = document.getElementById('modalComplaintIdDisplay');
  const reviewModalBody = document.getElementById('reviewModalBody');
  const modalFooterActions = document.getElementById('modalFooterActions');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  // Photo Lightbox Modal
  const photoLightboxModal = document.getElementById('photoLightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');


  /* ========================================================
   * 5. DYNAMIC STATS & KPI CALCULATIONS
   * ========================================================
   */
  function updateStatistics() {
    const total = complaints.length;
    const pendingVerification = complaints.filter(c => c.verification === 'Pending').length;
    const inProgress = complaints.filter(c => c.status === 'In Progress').length;
    const resolved = complaints.filter(c => c.status === 'Resolved').length;
    const highCritical = complaints.filter(c => c.severity === 'High' || c.severity === 'Critical').length;
    const activeWorkload = complaints.filter(c => c.status !== 'Resolved' && c.status !== 'Rejected').length;

    // Update 5 top summary cards
    if (statTotalEl) statTotalEl.textContent = total;
    if (statPendingEl) statPendingEl.textContent = pendingVerification;
    if (statProgressEl) statProgressEl.textContent = inProgress;
    if (statResolvedEl) statResolvedEl.textContent = resolved;
    if (statHighCriticalEl) statHighCriticalEl.textContent = highCritical;

    // Calculate Percentages
    const resolutionPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const criticalPct = total > 0 ? Math.round((highCritical / total) * 100) : 0;
    const activePct = total > 0 ? Math.round((activeWorkload / total) * 100) : 0;

    // Update KPI 1: Resolution Rate
    if (kpiResolutionRate) kpiResolutionRate.textContent = `${resolutionPct}%`;
    if (kpiResolvedRatio) kpiResolvedRatio.textContent = `${resolved} / ${total} closed`;
    if (kpiResolutionBar) kpiResolutionBar.style.width = `${resolutionPct}%`;

    // Update KPI 2: Active Workload
    if (kpiActiveWorkload) kpiActiveWorkload.textContent = activeWorkload;
    if (kpiActiveBar) kpiActiveBar.style.width = `${activePct}%`;

    // Update KPI 3: Critical Ratio
    if (kpiCriticalRate) kpiCriticalRate.textContent = `${criticalPct}%`;
    if (kpiCriticalCountText) kpiCriticalCountText.textContent = `${highCritical} high/critical issues`;
    if (kpiCriticalBar) kpiCriticalBar.style.width = `${criticalPct}%`;

    // Calculate Category Breakdown & Top Category
    const categoryCounts = {};
    complaints.forEach(c => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    });

    let topCatName = "None";
    let topCatMax = 0;
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > topCatMax) {
        topCatMax = count;
        topCatName = cat;
      }
    }

    if (kpiTopCategory) kpiTopCategory.textContent = topCatName;
    if (kpiTopCategoryCount) kpiTopCategoryCount.textContent = `${topCatMax} reports logged in this category`;

    // Render Category Horizontal Bars
    renderCategoryStats(categoryCounts, total);
  }


  /* ========================================================
   * 6. RENDER CATEGORY BREAKDOWN VISUALIZATION
   * ========================================================
   */
  function renderCategoryStats(countsMap, total) {
    if (!categoryStatsList) return;
    categoryStatsList.innerHTML = '';

    const categoriesList = [
      "Road/Pothole",
      "Street Light",
      "Sewage",
      "Garbage/Waste",
      "Waterlogging",
      "Traffic",
      "Accident",
      "Other"
    ];

    categoriesList.forEach(cat => {
      const count = countsMap[cat] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;

      const barRow = document.createElement('div');
      barRow.className = 'category-bar-row';
      barRow.innerHTML = `
        <div class="category-bar-meta">
          <span>${escapeHtml(cat)}</span>
          <span class="category-count-badge">${count} (${pct}%)</span>
        </div>
        <div class="category-bar-track">
          <div class="category-bar-fill" style="width: ${pct}%;"></div>
        </div>
      `;
      categoryStatsList.appendChild(barRow);
    });
  }


  /* ========================================================
   * 7. RENDER COMPLAINTS TABLE (SEARCH + MULTI-FILTER)
   * ========================================================
   */
  function filterComplaints() {
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const selCat = filterCategory ? filterCategory.value : 'all';
    const selStatus = filterStatus ? filterStatus.value : 'all';
    const selSev = filterSeverity ? filterSeverity.value : 'all';
    const selPriority = filterPriority ? filterPriority.value : 'all';
    const selDanger = filterDanger ? filterDanger.value : 'all';
    const selVer = filterVerification ? filterVerification.value : 'all';

    const filtered = complaints.filter(item => {
      // 1. Text Search matching ID, Title, Category, Location
      if (query) {
        const matchId = item.id.toLowerCase().includes(query);
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchCat = item.category.toLowerCase().includes(query);
        const locStr = (item.location && typeof item.location === 'object' && item.location.address)
          ? item.location.address
          : (item.location || '');
        const matchLoc = locStr.toLowerCase().includes(query);
        if (!matchId && !matchTitle && !matchCat && !matchLoc) {
          return false;
        }
      }

      // 2. Category Filter
      if (selCat !== 'all' && item.category !== selCat) return false;

      // 3. Status Filter
      if (selStatus !== 'all' && item.status !== selStatus) return false;

      // 4. Severity Filter
      if (selSev !== 'all' && item.severity !== selSev) return false;

      // 5. Priority Filter (Stage 10 Part 20)
      if (selPriority !== 'all') {
        const itemP = (item.priority && item.priority.level) ? item.priority.level : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
        if (itemP.toUpperCase() !== selPriority.toUpperCase()) return false;
      }

      // 6. Danger Filter (Stage 10 Part 20)
      if (selDanger !== 'all') {
        const itemD = (item.aiAnalysis && item.aiAnalysis.dangerLevel) ? item.aiAnalysis.dangerLevel : 'medium';
        if (itemD.toLowerCase() !== selDanger.toLowerCase()) return false;
      }

      // 7. Verification Filter
      if (selVer !== 'all' && item.verification !== selVer) return false;

      return true;
    });

    // Sort complaints by Priority score descending (Stage 10 Part 20)
    // Civic Connect project-defined priority ranking (Danger 60% + Community 40%)
    filtered.sort((a, b) => {
      const scoreA = (a.priority && a.priority.score !== undefined) ? a.priority.score : 0;
      const scoreB = (b.priority && b.priority.score !== undefined) ? b.priority.score : 0;
      return scoreB - scoreA;
    });

    return filtered;
  }

  function renderComplaints() {
    if (!complaintsTableBody) return;
    complaintsTableBody.innerHTML = '';

    const filtered = filterComplaints();

    // Results Counter
    if (resultsCountBadge) {
      resultsCountBadge.textContent = `Showing ${filtered.length} of ${complaints.length} complaints (Sorted by Priority)`;
    }

    // Toggle Empty State
    if (filtered.length === 0) {
      if (emptyTableState) emptyTableState.style.display = 'block';
      return;
    }

    if (emptyTableState) emptyTableState.style.display = 'none';

    // Populate Table Rows (Stage 10 Part 20 Columns)
    filtered.forEach(item => {
      const row = document.createElement('tr');
      row.setAttribute('data-id', item.id);

      const statusClass = getStatusBadgeClass(item.status);
      const verifyClass = getVerificationBadgeClass(item.verification);

      // AI Danger values
      const dangerLevel = (item.aiAnalysis && item.aiAnalysis.dangerLevel) ? item.aiAnalysis.dangerLevel.toUpperCase() : 'MEDIUM';
      const dangerScore = (item.aiAnalysis && item.aiAnalysis.dangerScore !== undefined) ? item.aiAnalysis.dangerScore : 50;
      const dangerClass = getDangerBadgeClass(dangerLevel);

      // Community weight values
      const reportCount = item.reportCount || 1;
      const voteCount = item.supporters || (item.voters ? item.voters.length : 0);
      const communityScore = (item.priority && item.priority.communityScore !== undefined) ? item.priority.communityScore : 50;

      // Priority values
      const priorityLevel = (item.priority && item.priority.level) ? item.priority.level : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
      const priorityScore = (item.priority && item.priority.score !== undefined) ? item.priority.score : 50;
      const priorityClass = getPriorityBadgeClass(priorityLevel);

      row.innerHTML = `
        <!-- Complaint ID -->
        <td>
          <span class="tbl-id-badge">${escapeHtml(item.id)}</span>
        </td>

        <!-- Problem Title -->
        <td>
          <div class="tbl-title-cell" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        </td>

        <!-- Category -->
        <td>
          <span class="card-category-badge" style="margin-bottom: 0;">${escapeHtml(item.category)}</span>
        </td>

        <!-- AI Danger Level & Score (Stage 10 Part 20) -->
        <td>
          <span class="severity-badge ${dangerClass}" title="Gemini AI assessed risk score">
            ${dangerLevel} (${dangerScore})
          </span>
        </td>

        <!-- Report Count (Stage 10 Part 20) -->
        <td style="text-align: center;">
          <strong style="color: #07546b; font-size: 0.95rem;">${reportCount}</strong>
        </td>

        <!-- Vote Count (Stage 10 Part 20) -->
        <td style="text-align: center;">
          <strong style="color: #0284c7; font-size: 0.95rem;">${voteCount}</strong>
        </td>

        <!-- Community Score (Stage 10 Part 20) -->
        <td style="text-align: center; font-size: 0.85rem; font-weight: 700; color: #166534;">
          ${communityScore}
        </td>

        <!-- Priority Score & Level (Stage 10 Part 20) -->
        <td>
          <span class="severity-badge ${priorityClass}">
            ${priorityLevel} (${priorityScore}/100)
          </span>
        </td>

        <!-- Current Status -->
        <td>
          <span class="status-badge ${statusClass}">
            <span class="badge-dot"></span>
            ${escapeHtml(item.status)}
          </span>
        </td>

        <!-- Verification Status -->
        <td>
          <span class="verify-badge ${verifyClass}">
            <span>${item.verification === 'Verified' ? '✓' : item.verification === 'Rejected' ? '✕' : '●'}</span>
            ${escapeHtml(item.verification)}
          </span>
        </td>

        <!-- Actions -->
        <td style="text-align: center;">
          <button type="button" class="btn-table-review" data-id="${item.id}" aria-label="Review complaint ${item.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Review</span>
          </button>
        </td>
      `;

      complaintsTableBody.appendChild(row);
    });
  }


  /* ========================================================
   * 8. REVIEW MODAL & REAL-TIME STATE TRANSITIONS
   * ========================================================
   */
  function openReviewModal(id) {
    const item = complaints.find(c => c.id === id);
    if (!item || !reviewModal || !reviewModalBody) return;

    activeComplaintId = id;
    if (modalComplaintIdDisplay) modalComplaintIdDisplay.textContent = item.id;

    const statusClass = getStatusBadgeClass(item.status);
    const severityClass = getSeverityBadgeClass(item.severity);
    const verifyClass = getVerificationBadgeClass(item.verification);
    const isPriority = item.severity === 'Critical' || item.severity === 'High';

    // Image section
    let imageHtml = '';
    if (item.image && item.image.trim() !== '') {
      imageHtml = `
        <div class="photo-thumbnail-box" id="thumbnailTrigger" data-img="${escapeHtml(item.image)}" data-title="${escapeHtml(item.title)}">
          <img 
            src="${escapeHtml(item.image)}" 
            alt="Hazard photo for ${escapeHtml(item.id)}" 
            class="photo-thumb-img"
            onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'no-photo-box\\'>⚠️ Image failed to load</span>';"
          >
          <div class="photo-enlarge-hint">Click to enlarge 🔍</div>
        </div>
      `;
    } else {
      imageHtml = `
        <div class="no-photo-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span>No image uploaded</span>
        </div>
      `;
    }

    // Resolution info panel
    let resolutionHtml = '';
    if (item.status === 'Resolved' && item.resolvedDate) {
      resolutionHtml = `
        <div class="resolution-info-panel">
          <strong>Resolution Record</strong>
          <p>${escapeHtml(item.resolutionNote || "Issue repaired and restored.")}</p>
          <div class="resolution-meta-date">
            Resolved on: <strong>${escapeHtml(item.resolvedDate)}</strong> &bull; By: <strong>${escapeHtml(item.resolvedBy || "Civic Admin")}</strong>
          </div>
        </div>
      `;
    }

    // AI & Priority values (Stage 10 Part 20 & 23)
    const dangerLevel = (item.aiAnalysis && item.aiAnalysis.dangerLevel) ? item.aiAnalysis.dangerLevel.toUpperCase() : 'MEDIUM';
    const dangerScore = (item.aiAnalysis && item.aiAnalysis.dangerScore !== undefined) ? item.aiAnalysis.dangerScore : 50;
    const aiReason = (item.aiAnalysis && item.aiAnalysis.reason) ? item.aiAnalysis.reason : 'Automated hazard risk assessment conducted based on complaint keywords and severity.';
    const reportCount = item.reportCount || 1;
    const voteCount = item.supporters || (item.voters ? item.voters.length : 0);
    const communityScore = (item.priority && item.priority.communityScore !== undefined) ? item.priority.communityScore : 50;
    const priorityLevel = (item.priority && item.priority.level) ? item.priority.level : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
    const priorityScore = (item.priority && item.priority.score !== undefined) ? item.priority.score : 50;
    const priorityClass = getPriorityBadgeClass(priorityLevel);

    let addressStr = item.location;
    if (item.location && typeof item.location === 'object') {
      addressStr = item.location.address || 'GPS Coordinates';
      if (item.location.latitude && item.location.longitude) {
        addressStr += ` (Lat: ${item.location.latitude.toFixed(5)}, Lng: ${item.location.longitude.toFixed(5)})`;
      }
    }

    reviewModalBody.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <h2 style="font-size: 1.3rem; color: var(--navy-blue); margin: 0;">${escapeHtml(item.title)}</h2>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span class="severity-badge ${priorityClass}">Priority: ${priorityLevel} (${priorityScore}/100)</span>
            <span class="severity-badge ${severityClass}">${escapeHtml(item.severity)}</span>
          </div>
        </div>
      </div>

      <!-- AI Danger Assessment & Priority Calculation (Stage 10 Part 20 & 23) -->
      <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <strong style="color: var(--navy-blue); font-size: 0.95rem; display: flex; align-items: center; gap: 0.35rem;">
            <span>🤖</span> AI Danger Assessment (Google Gemini)
          </strong>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.8rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 4px; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;">
              Danger: ${dangerLevel} (${dangerScore}/100)
            </span>
            <button type="button" class="btn btn-outline" id="reanalyzeAiBtn" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;" title="Re-run Gemini AI analysis on this complaint">
              🔄 Re-analyze AI
            </button>
          </div>
        </div>
        <p style="font-size: 0.85rem; color: #475569; margin: 0 0 0.6rem; line-height: 1.5; font-style: italic;">
          "${escapeHtml(aiReason)}"
        </p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.6rem 0.75rem; font-size: 0.8rem; color: #166534;">
          <strong>Priority Calculation Formula:</strong> Danger Score × 60% (${Math.round(dangerScore * 0.6)} pts) + Community Score × 40% (${Math.round(communityScore * 0.4)} pts) = <strong>${priorityScore}/100 (${priorityLevel})</strong>.
          <br><span style="font-size: 0.74rem; color: #15803d;">Inside Community Weight: ${reportCount} citizen report(s) (60%) + ${voteCount} community vote(s) (40%).</span>
        </div>
      </div>

      <!-- Metadata Grid -->
      <div class="modal-meta-grid">
        <div class="modal-meta-item">
          <span class="modal-meta-label">Category</span>
          <span class="modal-meta-value">${escapeHtml(item.category)}</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-label">Location / Landmark</span>
          <span class="modal-meta-value">${escapeHtml(addressStr)}</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-label">Reported Date</span>
          <span class="modal-meta-value">${escapeHtml(item.date)}</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-label">Reported By</span>
          <span class="modal-meta-value">${escapeHtml(item.reportedBy)}</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-label">Citizen Reports</span>
          <span class="modal-meta-value"><strong>${reportCount}</strong> independent report(s)</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-label">Community Votes</span>
          <span class="modal-meta-value"><strong>${voteCount}</strong> upvote(s)</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-label">Current Status</span>
          <span class="modal-meta-value">
            <span class="status-badge ${statusClass}">
              <span class="badge-dot"></span>
              ${escapeHtml(item.status)}
            </span>
          </span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-label">Verification Status</span>
          <span class="modal-meta-value">
            <span class="verify-badge ${verifyClass}">
              ${escapeHtml(item.verification)}
            </span>
          </span>
        </div>
      </div>

      <!-- Full Description -->
      <div class="modal-desc-box">
        <span class="modal-meta-label" style="display: block; margin-bottom: 0.4rem;">Full Problem Description</span>
        <div class="modal-desc-text">${escapeHtml(item.description)}</div>
      </div>

      <!-- Photo Evidence -->
      <div class="modal-photo-section">
        <span class="modal-meta-label" style="display: block; margin-bottom: 0.4rem;">Photo Evidence</span>
        ${imageHtml}
      </div>

      <!-- Resolution Panel if applicable -->
      ${resolutionHtml}
    `;

    // Render Modal Actions
    renderModalFooterActions(item);

    // Setup Re-analyze AI button click event (Stage 10 Part 24)
    const reanalyzeBtn = reviewModalBody.querySelector('#reanalyzeAiBtn');
    if (reanalyzeBtn) {
      reanalyzeBtn.addEventListener('click', async () => {
        reanalyzeBtn.disabled = true;
        reanalyzeBtn.textContent = 'Calling Gemini AI...';
        try {
          const res = await fetch(`/api/complaints/${item.id}/reanalyze`, {
            method: 'POST',
            credentials: 'include'
          });
          const json = await res.json();
          if (json.success && json.data) {
            Object.assign(item, json.data);
            addActivity(`Admin re-analyzed ${item.id} with Google Gemini AI`, 'verify');
            refreshAllDashboardViews();
            openReviewModal(item.id);
          } else {
            alert(json.message || 'Could not re-analyze complaint with Gemini AI.');
          }
        } catch (err) {
          alert('Network error when contacting Gemini AI endpoint: ' + err.message);
        } finally {
          if (reanalyzeBtn) reanalyzeBtn.disabled = false;
        }
      });
    }

    // Setup thumbnail click event for lightbox
    const thumbTrigger = reviewModalBody.querySelector('#thumbnailTrigger');
    if (thumbTrigger) {
      thumbTrigger.addEventListener('click', () => {
        const src = thumbTrigger.getAttribute('data-img');
        const caption = thumbTrigger.getAttribute('data-title');
        openPhotoLightbox(src, caption);
      });
    }

    reviewModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function renderModalFooterActions(item) {
    if (!modalFooterActions) return;

    modalFooterActions.innerHTML = `
      <div style="font-size: 0.8rem; color: var(--text-muted);">
        Update ticket state:
      </div>
      <div class="modal-action-buttons-group">
        ${item.verification !== 'Verified' ? `
          <button type="button" class="btn btn-action-verify" id="modalVerifyBtn">
            ✓ Verify Complaint
          </button>
        ` : ''}

        ${item.verification !== 'Rejected' && item.status !== 'Rejected' ? `
          <button type="button" class="btn btn-action-reject" id="modalRejectBtn">
            ✕ Reject Complaint
          </button>
        ` : ''}

        ${item.status !== 'In Progress' && item.status !== 'Resolved' && item.status !== 'Rejected' ? `
          <button type="button" class="btn btn-action-progress" id="modalProgressBtn">
            ⚙ Mark In Progress
          </button>
        ` : ''}

        ${item.status !== 'Resolved' && item.status !== 'Rejected' ? `
          <button type="button" class="btn btn-action-resolve" id="modalResolveBtn">
            ★ Mark Resolved
          </button>
        ` : ''}

        <button type="button" class="btn btn-outline" id="modalCloseActionBtn">
          Close
        </button>
      </div>
    `;

    // Bind action events
    const verifyBtn = document.getElementById('modalVerifyBtn');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => verifyComplaint(item.id));
    }

    const rejectBtn = document.getElementById('modalRejectBtn');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => rejectComplaint(item.id));
    }

    const progressBtn = document.getElementById('modalProgressBtn');
    if (progressBtn) {
      progressBtn.addEventListener('click', () => updateComplaintStatus(item.id, 'In Progress'));
    }

    const resolveBtn = document.getElementById('modalResolveBtn');
    if (resolveBtn) {
      resolveBtn.addEventListener('click', () => resolveComplaint(item.id));
    }

    const closeBtn = document.getElementById('modalCloseActionBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeReviewModal);
    }
  }

  function closeReviewModal() {
    if (!reviewModal) return;
    reviewModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    activeComplaintId = null;
  }

  /* ========================================================
   * 9. STATUS MANAGEMENT & VERIFICATION LOGIC (PERSISTENT)
   * Syncs state with MongoDB backend via PATCH /api/complaints/:id/status
   * ========================================================
   */

  // 1. Verify Complaint
  async function verifyComplaint(id) {
    const item = complaints.find(c => c.id === id);
    if (!item) return;

    item.verification = "Verified";
    if (item.status === "Reported") {
      item.status = "Under Verification";
    }

    // Persist verification & status change to MongoDB
    try {
      await fetch(`/api/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: item.status })
      });
    } catch (err) {
      console.warn('[Backend Notice]: Could not reach API, updated in local state:', err.message);
    }

    addActivity(`Admin verified ${item.id} (${item.category})`, 'verify');
    refreshAllDashboardViews();
    if (activeComplaintId === id) openReviewModal(id);
  }

  // 2. Reject Complaint
  async function rejectComplaint(id) {
    const item = complaints.find(c => c.id === id);
    if (!item) return;

    item.verification = "Rejected";
    item.status = "Rejected";

    // Persist rejection to MongoDB
    try {
      await fetch(`/api/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: "Rejected" })
      });
    } catch (err) {
      console.warn('[Backend Notice]: Could not reach API, updated in local state:', err.message);
    }

    addActivity(`Admin rejected ${item.id} (Invalid hazard submission)`, 'reject');
    refreshAllDashboardViews();
    if (activeComplaintId === id) openReviewModal(id);
  }

  // 3. Update Status to In Progress
  async function updateComplaintStatus(id, newStatus, extraData = {}) {
    const item = complaints.find(c => c.id === id);
    if (!item) return;

    item.status = newStatus;
    if (item.verification === "Pending") {
      item.verification = "Verified";
    }

    // Persist status change to MongoDB
    try {
      await fetch(`/api/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, ...extraData })
      });
    } catch (err) {
      console.warn('[Backend Notice]: Could not reach API, updated in local state:', err.message);
    }

    addActivity(`Admin updated ${item.id} status to "${newStatus}"`, 'progress');
    refreshAllDashboardViews();
    if (activeComplaintId === id) openReviewModal(id);
  }

  // 4. Resolve Complaint
  async function resolveComplaint(id) {
    const item = complaints.find(c => c.id === id);
    if (!item) return;

    item.status = "Resolved";
    item.verification = "Verified";
    item.resolvedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    item.resolvedBy = "Civic Admin (Ward Operations)";
    if (!item.resolutionNote || item.resolutionNote.trim() === '') {
      item.resolutionNote = "Hazard inspected by municipal road repair crew; remediation works successfully completed and verified.";
    }

    // Persist resolution to MongoDB
    try {
      await fetch(`/api/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: "Resolved",
          resolvedBy: item.resolvedBy,
          resolvedNote: item.resolutionNote
        })
      });
    } catch (err) {
      console.warn('[Backend Notice]: Could not reach API, updated in local state:', err.message);
    }

    addActivity(`Admin marked ${item.id} as Resolved`, 'resolve');
    refreshAllDashboardViews();
    if (activeComplaintId === id) openReviewModal(id);
  }

  // Helper to refresh all dashboard modules
  function refreshAllDashboardViews() {
    updateStatistics();
    renderComplaints();
    renderActivityTimeline();
  }


  /* ========================================================
   * 10. RECENT ADMIN ACTIVITY LOG
   * ========================================================
   */
  function addActivity(actionText, type = 'info') {
    adminActivities.unshift({
      action: actionText,
      time: "Just now",
      type: type
    });

    if (adminActivities.length > 20) {
      adminActivities.pop();
    }

    renderActivityTimeline();
  }

  function renderActivityTimeline() {
    if (!adminActivityList) return;
    adminActivityList.innerHTML = '';

    adminActivities.forEach(act => {
      const item = document.createElement('li');
      item.className = 'activity-item-box';
      item.innerHTML = `
        <span class="activity-bullet-node" aria-hidden="true"></span>
        <div class="activity-text-line">${escapeHtml(act.action)}</div>
        <div class="activity-time-text">${escapeHtml(act.time)}</div>
      `;
      adminActivityList.appendChild(item);
    });
  }


  /* ========================================================
   * 11. USER MANAGEMENT SECTION RENDERING
   * ========================================================
   */
  function renderUsers() {
    if (!usersTableBody) return;
    usersTableBody.innerHTML = '';

    sampleUsers.forEach(u => {
      const tr = document.createElement('tr');
      const isFlagged = u.status === 'Flagged';

      tr.innerHTML = `
        <td><span class="tbl-id-badge">${escapeHtml(u.id)}</span></td>
        <td style="font-weight: 600; color: var(--navy-blue);">${escapeHtml(u.name)}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(u.email)}</td>
        <td style="text-align: center; font-weight: 700;">${u.reported}</td>
        <td style="text-align: center; font-weight: 700; color: #065f46;">${u.resolved}</td>
        <td style="text-align: center;">
          <span style="font-weight: 700; color: var(--primary-teal); background-color: var(--primary-teal-light); padding: 0.2rem 0.6rem; border-radius: var(--radius-pill);">
            ${u.tokens} tokens
          </span>
        </td>
        <td style="text-align: center;">
          <span class="verify-badge ${isFlagged ? 'verify-rejected' : 'verify-verified'}">
            ${escapeHtml(u.status)}
          </span>
        </td>
      `;

      usersTableBody.appendChild(tr);
    });

    if (userCountBadge) {
      userCountBadge.textContent = `${sampleUsers.length} registered citizens`;
    }
  }


  /* ========================================================
   * 12. PHOTO LIGHTBOX CONTROLLER
   * ========================================================
   */
  function openPhotoLightbox(src, caption) {
    if (!photoLightboxModal || !lightboxImg) return;
    lightboxImg.src = src;
    if (lightboxCaption) lightboxCaption.textContent = caption || "Hazard Photo Evidence";
    photoLightboxModal.removeAttribute('hidden');
  }

  function closePhotoLightbox() {
    if (!photoLightboxModal) return;
    photoLightboxModal.setAttribute('hidden', '');
    if (lightboxImg) lightboxImg.src = '';
  }


  /* ========================================================
   * 13. BADGE HELPER FUNCTIONS
   * ========================================================
   */
  function getStatusBadgeClass(status) {
    switch (status) {
      case 'Reported':
        return 'status-reported';
      case 'Under Verification':
        return 'status-verification';
      case 'In Progress':
        return 'status-progress';
      case 'Resolved':
        return 'status-resolved';
      case 'Rejected':
        return 'status-rejected';
      default:
        return 'status-reported';
    }
  }

  function getSeverityBadgeClass(severity) {
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

  function getDangerBadgeClass(level) {
    switch (String(level).toLowerCase()) {
      case 'critical': return 'severity-critical';
      case 'high': return 'severity-high';
      case 'medium': return 'severity-medium';
      default: return 'severity-low';
    }
  }

  function getPriorityBadgeClass(level) {
    switch (String(level).toUpperCase()) {
      case 'CRITICAL': return 'severity-critical';
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-medium';
      default: return 'severity-low';
    }
  }

  function getVerificationBadgeClass(verification) {
    switch (verification) {
      case 'Verified':
        return 'verify-verified';
      case 'Pending':
        return 'verify-pending';
      case 'Rejected':
        return 'verify-rejected';
      default:
        return 'verify-pending';
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
   * 14. EVENT LISTENERS
   * ========================================================
   */

  // Search input live filtering
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (searchClearBtn) {
        if (searchInput.value.trim().length > 0) {
          searchClearBtn.classList.add('visible');
        } else {
          searchClearBtn.classList.remove('visible');
        }
      }
      renderComplaints();
    });
  }

  // Clear search input button
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchClearBtn.classList.remove('visible');
      renderComplaints();
    });
  }

  // Filter dropdown listeners (Priority & Danger included)
  [filterCategory, filterStatus, filterSeverity, filterPriority, filterDanger, filterVerification].forEach(dropdown => {
    if (dropdown) {
      dropdown.addEventListener('change', renderComplaints);
    }
  });

  // Clear all filters function
  function resetAllFilters() {
    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.classList.remove('visible');
    if (filterCategory) filterCategory.value = 'all';
    if (filterStatus) filterStatus.value = 'all';
    if (filterSeverity) filterSeverity.value = 'all';
    if (filterPriority) filterPriority.value = 'all';
    if (filterDanger) filterDanger.value = 'all';
    if (filterVerification) filterVerification.value = 'all';
    renderComplaints();
  }

  if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', resetAllFilters);
  if (emptyResetFiltersBtn) emptyResetFiltersBtn.addEventListener('click', resetAllFilters);

  // Review button delegation on complaints table
  if (complaintsTableBody) {
    complaintsTableBody.addEventListener('click', (e) => {
      const reviewBtn = e.target.closest('.btn-table-review');
      if (reviewBtn) {
        const id = reviewBtn.getAttribute('data-id');
        if (id) openReviewModal(id);
      }
    });
  }

  // Close modals
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeReviewModal);
  if (reviewModal) {
    reviewModal.addEventListener('click', (e) => {
      if (e.target === reviewModal) closeReviewModal();
    });
  }

  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closePhotoLightbox);
  if (photoLightboxModal) {
    photoLightboxModal.addEventListener('click', (e) => {
      if (e.target === photoLightboxModal) closePhotoLightbox();
    });
  }

  // Keyboard accessibility: Escape key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (photoLightboxModal && !photoLightboxModal.hasAttribute('hidden')) {
        closePhotoLightbox();
      } else if (reviewModal && !reviewModal.hasAttribute('hidden')) {
        closeReviewModal();
      }
    }
  });


  /* ========================================================
   * 15. INITIALIZATION & LIVE BACKEND SYNC (Admin Protected)
   * ========================================================
   */
  async function loadAdminComplaints() {
    // 1. Enforce Municipal Administrator Role (redirects if unauthorized)
    const adminUser = await window.CivicAuth.requireAdmin();
    if (!adminUser) return;

    // Display admin user name in header/profile if element exists
    const adminNameEl = document.querySelector('.admin-profile-name') || document.querySelector('.admin-user-title');
    if (adminNameEl) {
      adminNameEl.textContent = adminUser.name;
    }

    try {
      console.log('[Admin Dashboard]: Fetching tickets from Express API /api/complaints ...');
      const response = await fetch('/api/complaints', { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          complaints = result.data;
          console.log(`[Admin Dashboard]: Loaded ${complaints.length} tickets from ${result.source || 'MongoDB Atlas'}.`);
        }
      }
    } catch (err) {
      console.warn('[Admin Dashboard]: Backend API unreachable, using local fallback:', err.message);
    } finally {
      refreshAllDashboardViews();
    }
  }

  // Initialize
  loadAdminComplaints();
  renderUsers();

  console.log('Civic Connect Municipal Admin Dashboard Initialized with Role-Based Access Control.');
});
