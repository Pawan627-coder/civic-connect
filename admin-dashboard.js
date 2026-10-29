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
   * 1. COMPLAINTS DATASET (Live Database Store)
   * Populated dynamically from GET /api/admin/complaints
   * ========================================================
   */
  let complaints = [];

  /* ========================================================
   * 2. REGISTERED CITIZENS DATASET
   * Populated dynamically from GET /api/admin/dashboard
   * ========================================================
   */
  let sampleUsers = [];

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
  const filterLocality = document.getElementById('filterLocality');
  const filterDate = document.getElementById('filterDate');
  const filterSort = document.getElementById('filterSort');
  const filterUnreviewed = document.getElementById('filterUnreviewed');
  const clearFiltersBtn = document.getElementById('adminClearFiltersBtn');
  const emptyResetFiltersBtn = document.getElementById('emptyResetFiltersBtn');
  const resultsCountBadge = document.getElementById('resultsCountBadge');

  // Pagination elements & state
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  const btnPrevPage = document.getElementById('btnPrevPage');
  const btnNextPage = document.getElementById('btnNextPage');
  const paginationPageIndicator = document.getElementById('paginationPageIndicator');
  const paginationInfoText = document.getElementById('paginationInfoText');
  let currentPage = 1;
  let pageSize = (pageSizeSelect && parseInt(pageSizeSelect.value, 10)) || 10;

  // Heatmap elements & state
  const mapLocalityFilter = document.getElementById('mapLocalityFilter');
  const btnViewHeatmap = document.getElementById('btnViewHeatmap');
  const btnViewPins = document.getElementById('btnViewPins');
  const btnViewBoth = document.getElementById('btnViewBoth');
  const btnResetMapView = document.getElementById('btnResetMapView');
  let mapInstance = null;
  let heatLayerInstance = null;
  let circlesLayerInstance = null;
  let markersLayerInstance = null;
  let currentMapMode = 'heat'; // 'heat', 'pins', 'both'

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
  let modalMapInstance = null;

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

    // Render Urgent Alerts & Citizen Reminders Queue
    renderAlertsQueue(complaints);
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
   * 6B. RENDER URGENT CIVIC ALERTS & ACTION QUEUE (CITIZEN REMINDERS)
   * ========================================================
   */
  const alertsGrid = document.getElementById('alertsGrid');
  const alertCountBadge = document.getElementById('alertCountBadge');

  function renderAlertsQueue(allComplaints) {
    if (!alertsGrid) return;
    alertsGrid.innerHTML = '';

    // Filter complaints that have citizen reminders or are critical unresolved
    const urgentAlerts = (allComplaints || []).filter(c => 
      c.status !== 'Resolved' && ((c.remindersCount && c.remindersCount > 0) || c.severity === 'Critical' || (c.priority && c.priority.level === 'Critical'))
    );

    // Sort: highest reminders first
    urgentAlerts.sort((a, b) => ((b.remindersCount || 0) - (a.remindersCount || 0)));

    if (alertCountBadge) {
      alertCountBadge.textContent = `${urgentAlerts.length} Active Alert${urgentAlerts.length === 1 ? '' : 's'}`;
    }

    if (urgentAlerts.length === 0) {
      alertsGrid.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px; grid-column: 1 / -1; border: 1px dashed #cbd5e1;">
          <span style="font-size: 1.1rem; display: block; margin-bottom: 0.25rem;">✓ No Pending Citizen Reminders</span>
          <span style="font-size: 0.85rem;">All reported hazards are under control. New citizen escalation notifications will appear here in real time.</span>
        </div>
      `;
      return;
    }

    urgentAlerts.forEach(c => {
      const card = document.createElement('div');
      const hasReminders = (c.remindersCount && c.remindersCount > 0);
      card.className = `alert-queue-card ${hasReminders ? 'has-reminders' : ''}`;
      
      const locStr = (c.location && typeof c.location === 'object' && c.location.address)
        ? c.location.address
        : (c.location || 'Municipal Ward Area');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
          <span style="font-weight: 800; font-size: 0.82rem; color: #64748b;">${escapeHtml(c.id)} • ${escapeHtml(c.category)}</span>
          <span style="background: ${hasReminders ? '#fee2e2' : '#fef3c7'}; color: ${hasReminders ? '#991b1b' : '#92400e'}; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 3px;">
            ${hasReminders ? `🔔 ${c.remindersCount} Citizen Reminders` : '⚠️ Critical Hazard'}
          </span>
        </div>
        <h4 style="font-size: 0.95rem; margin: 0; color: #0f172a; line-height: 1.35;">${escapeHtml(c.title)}</h4>
        <div style="font-size: 0.8rem; color: #475569; display: flex; align-items: center; gap: 0.35rem;">
          <span>📍</span>
          <span>${escapeHtml(locStr)}</span>
        </div>
        ${c.lastReminderReason ? `
          <div style="font-size: 0.76rem; background: #fff1f2; border: 1px dashed #fecdd3; padding: 5px 8px; border-radius: 4px; color: #9f1239;">
            <strong>Citizen Escalation Notice:</strong> "${escapeHtml(c.lastReminderReason)}"
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid #f1f5f9;">
          <span class="status-badge ${getStatusBadgeClass(c.status)}" style="font-size: 0.72rem;">${escapeHtml(c.status)}</span>
          <button type="button" class="btn btn-sm btn-primary" data-action="review" data-id="${c.id}" style="font-size: 0.75rem; padding: 5px 12px; font-weight: 700; cursor: pointer;">
            Review &amp; Update Status &rarr;
          </button>
        </div>
      `;

      const reviewBtn = card.querySelector('[data-action="review"]');
      if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
          openReviewModal(c.id);
        });
      }

      alertsGrid.appendChild(card);
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
    const selLoc = filterLocality ? filterLocality.value : 'all';
    const selDate = filterDate ? filterDate.value : 'all';
    const selSort = filterSort ? filterSort.value : 'latest';
    const selUnreviewed = filterUnreviewed ? filterUnreviewed.value : 'all';

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

      // 8. Locality / Area Filter
      if (selLoc !== 'all') {
        const locStr = (item.location && typeof item.location === 'object' && item.location.address)
          ? item.location.address
          : (typeof item.location === 'string' ? item.location : '');
        if (!locStr.toLowerCase().includes(selLoc.toLowerCase())) return false;
      }

      // 9. Date Range Filter
      if (selDate !== 'all') {
        const itemDate = new Date(item.date || item.createdAt);
        if (!isNaN(itemDate.getTime())) {
          const now = new Date();
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
          if (selDate === 'today' && diffDays > 1.5) return false;
          if (selDate === 'week' && diffDays > 7.5) return false;
          if (selDate === 'month' && diffDays > 30.5) return false;
        }
      }

      // 10. Review Status (New/Unreviewed Filter)
      if (selUnreviewed === 'unreviewed' && item.isReviewed === true) return false;
      if (selUnreviewed === 'reviewed' && item.isReviewed !== true) return false;

      return true;
    });

    // Sort complaints (Default: Latest First by submission timestamp)
    filtered.sort((a, b) => {
      if (selSort === 'priority') {
        const scoreA = (a.priority && a.priority.score !== undefined) ? a.priority.score : 0;
        const scoreB = (b.priority && b.priority.score !== undefined) ? b.priority.score : 0;
        return scoreB - scoreA;
      }
      if (selSort === 'reminders') {
        return (b.remindersCount || 0) - (a.remindersCount || 0);
      }
      if (selSort === 'oldest') {
        const dateA = new Date(a.createdAt || a.submittedAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.submittedAt || b.date || 0).getTime();
        return dateA - dateB;
      }
      // Default: Latest First (createdAt: -1)
      const dateA = new Date(a.createdAt || a.submittedAt || a.date || 0).getTime();
      const dateB = new Date(b.createdAt || b.submittedAt || b.date || 0).getTime();
      return dateB - dateA;
    });

    return filtered;
  }

  function renderComplaints() {
    if (!complaintsTableBody) return;
    complaintsTableBody.innerHTML = '';

    const filtered = filterComplaints();
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    // Results Counter
    if (resultsCountBadge) {
      const selSort = filterSort ? filterSort.value : 'latest';
      const sortLabel = selSort === 'priority' ? 'Sorted by Priority' : (selSort === 'oldest' ? 'Sorted Oldest First' : (selSort === 'reminders' ? 'Sorted by Reminders' : 'Sorted Newest First'));
      resultsCountBadge.textContent = `Showing ${filtered.length} of ${complaints.length} complaints (${sortLabel})`;
    }

    // Update Pagination Toolbar
    if (paginationInfoText) {
      paginationInfoText.textContent = totalItems > 0
        ? `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} complaints`
        : `Showing 0 complaints`;
    }

    if (paginationPageIndicator) {
      paginationPageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    if (btnPrevPage) btnPrevPage.disabled = currentPage <= 1;
    if (btnNextPage) btnNextPage.disabled = currentPage >= totalPages;

    // Toggle Empty State
    if (filtered.length === 0) {
      if (emptyTableState) emptyTableState.style.display = 'block';
      return;
    }

    if (emptyTableState) emptyTableState.style.display = 'none';

    // Populate Table Rows for current page slice (Streamlined 7-Column Layout)
    paginatedItems.forEach(item => {
      const row = document.createElement('tr');
      row.setAttribute('data-id', item.id);
      row.className = 'clickable-complaint-row';
      row.title = "Click anywhere on row to review ticket details and citizen profile";

      const statusClass = getStatusBadgeClass(item.status);
      const verifyClass = getVerificationBadgeClass(item.verification);

      // AI Danger values
      const dangerLevel = (item.aiAnalysis && item.aiAnalysis.dangerLevel) ? item.aiAnalysis.dangerLevel.toUpperCase() : 'MEDIUM';
      const dangerScore = (item.aiAnalysis && item.aiAnalysis.dangerScore !== undefined) ? item.aiAnalysis.dangerScore : 50;
      const dangerClass = getDangerBadgeClass(dangerLevel);

      // Community weight values
      const reportCount = item.reportCount || 1;
      const voteCount = item.supporters || (item.voters ? item.voters.length : (item.supportersCount || 0));

      // Priority values
      const priorityLevel = (item.priority && item.priority.level) ? item.priority.level : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
      const priorityScore = (item.priority && item.priority.score !== undefined) ? item.priority.score : 50;
      const priorityClass = getPriorityBadgeClass(priorityLevel);

      let locAddress = 'Municipal Area';
      if (typeof item.location === 'string') {
        locAddress = item.location;
      } else if (item.location && typeof item.location === 'object') {
        locAddress = item.location.address || (item.location.latitude ? `Coords (${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)})` : 'Gorakhpur Ward');
      }

      row.innerHTML = `
        <!-- 1. Complaint ID -->
        <td>
          <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
            <span class="tbl-id-badge">${escapeHtml(item.id)}</span>
            ${!item.isReviewed ? `<span class="badge-new-complaint" title="Newly registered complaint — awaiting review">✨ NEW</span>` : ''}
          </div>
          ${(item.remindersCount && item.remindersCount > 0) ? `<span title="${item.remindersCount} citizen reminder(s)" style="display: block; font-size: 0.68rem; font-weight: 800; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; border-radius: 4px; padding: 1px 5px; margin-top: 3px;">🔔 ${item.remindersCount} Reminders</span>` : ''}
        </td>

        <!-- 2. Problem Title & Location -->
        <td>
          <div class="tbl-title-cell" title="${escapeHtml(item.title)}" style="font-weight: 700; color: var(--navy-blue); line-height: 1.35; margin-bottom: 3px;">
            ${escapeHtml(item.title)}
          </div>
          <div style="font-size: 0.77rem; color: #64748b; display: flex; align-items: center; gap: 4px;" title="${escapeHtml(locAddress)}">
            <span style="font-size: 0.85rem;">📍</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;">${escapeHtml(locAddress)}</span>
          </div>
        </td>

        <!-- 3. Category -->
        <td>
          <span class="card-category-badge" style="margin-bottom: 0;">${escapeHtml(item.category)}</span>
        </td>

        <!-- 4. AI Risk & Priority Score -->
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span class="severity-badge ${dangerClass}" style="font-size: 0.72rem; padding: 2px 6px;" title="Gemini AI assessed risk score">
              AI: ${dangerLevel} (${dangerScore})
            </span>
            <span class="severity-badge ${priorityClass}" style="font-size: 0.72rem; padding: 2px 6px;">
              Priority: ${priorityLevel} (${priorityScore}/100)
            </span>
          </div>
        </td>

        <!-- 5. Community Weight -->
        <td style="text-align: center;">
          <div style="font-size: 0.83rem; font-weight: 700; color: #07546b;">
            ${reportCount} ${reportCount === 1 ? 'Report' : 'Reports'}
          </div>
          <div style="font-size: 0.75rem; color: #0284c7; font-weight: 600;">
            ${voteCount} ${voteCount === 1 ? 'Vote' : 'Votes'}
          </div>
        </td>

        <!-- 6. Current Status & Verification -->
        <td>
          <span class="status-badge ${statusClass}">
            <span class="badge-dot"></span>
            ${escapeHtml(item.status)}
          </span>
          <span class="verify-badge ${verifyClass}" style="margin-top: 3px; display: inline-flex; font-size: 0.69rem; padding: 1px 6px;">
            ${item.verification === 'Verified' ? '✓ Verified' : item.verification === 'Needs Inspection' ? '🔍 Inspection' : item.verification === 'Insufficient Evidence' ? '⚠️ Insufficient' : item.verification === 'Rejected' ? '✕ Rejected' : '● Pending'}
          </span>
        </td>

        <!-- 7. Actions -->
        <td style="text-align: center;">
          <button type="button" class="btn-table-review" data-id="${item.id}" aria-label="Review complaint ${item.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Review</span>
          </button>
        </td>
      `;

      // Allow clicking anywhere on the complaint row to open review
      row.addEventListener('click', (e) => {
        // Only trigger if not already handled by child interactive elements
        openReviewModal(item.id);
      });

      complaintsTableBody.appendChild(row);
    });
  }


  /* ========================================================
   * 8. REVIEW MODAL, CITIZEN PROFILE & ANTI-FRAUD CONTROLLER
   * ========================================================
   */
  function openReviewModal(id) {
    const item = complaints.find(c => c.id === id);
    if (!item || !reviewModal || !reviewModalBody) return;

    // Automatically mark complaint as reviewed when inspected by authority
    if (!item.isReviewed) {
      item.isReviewed = true;
      item.reviewedAt = new Date().toISOString();
      if (window.civicFetch) {
        window.civicFetch(`/api/admin/complaints/${encodeURIComponent(id)}/review`, { method: 'PATCH' }).catch(() => {});
      }
      setTimeout(() => renderComplaints(), 50);
    }

    activeComplaintId = id;
    if (modalComplaintIdDisplay) modalComplaintIdDisplay.textContent = item.id;

    const statusClass = getStatusBadgeClass(item.status);
    const severityClass = getSeverityBadgeClass(item.severity);
    const verifyClass = getVerificationBadgeClass(item.verification);

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

    // AI & Priority values
    const dangerLevel = (item.aiAnalysis && item.aiAnalysis.dangerLevel) ? item.aiAnalysis.dangerLevel.toUpperCase() : 'MEDIUM';
    const dangerScore = (item.aiAnalysis && item.aiAnalysis.dangerScore !== undefined) ? item.aiAnalysis.dangerScore : 50;
    const aiReason = (item.aiAnalysis && item.aiAnalysis.reason) ? item.aiAnalysis.reason : 'Automated hazard risk assessment conducted based on complaint keywords and severity.';
    const reportCount = item.reportCount || 1;
    const voteCount = item.supporters || (item.voters ? item.voters.length : (item.supportersCount || 0));
    const communityScore = (item.priority && item.priority.communityScore !== undefined) ? item.priority.communityScore : 50;
    const priorityLevel = (item.priority && item.priority.level) ? item.priority.level : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');
    const priorityScore = (item.priority && item.priority.score !== undefined) ? item.priority.score : 50;
    const priorityClass = getPriorityBadgeClass(priorityLevel);

    let addressStr = item.location;
    let latCoord = null;
    let lngCoord = null;
    if (item.location && typeof item.location === 'object') {
      addressStr = item.location.address || 'GPS Coordinates';
      if (item.location.latitude && item.location.longitude) {
        latCoord = parseFloat(item.location.latitude);
        lngCoord = parseFloat(item.location.longitude);
        addressStr += ` (Lat: ${latCoord.toFixed(5)}, Lng: ${lngCoord.toFixed(5)})`;
      }
    } else if (item.latitude && item.longitude) {
      latCoord = parseFloat(item.latitude);
      lngCoord = parseFloat(item.longitude);
    }

    // Location & Evidence Verification Metadata
    const locObj = (item.location && typeof item.location === 'object') ? item.location : {};
    const locSource = locObj.source || item.locationSource || (latCoord && lngCoord ? 'manual' : 'text');
    const locAccuracy = (locObj.accuracy !== undefined && locObj.accuracy !== null) ? parseFloat(locObj.accuracy) : (item.locationAccuracy !== undefined ? parseFloat(item.locationAccuracy) : null);
    const locCapturedAt = locObj.capturedAt || item.locationCapturedAt;
    const photoSource = item.photoSource || (item.image ? 'upload' : 'none');
    const photoUploadedAt = item.photoUploadedAt;
    const serverSubmittedAt = item.submittedAt || item.createdAt || item.date;

    const isGps = locSource === 'gps';
    const hasCoords = latCoord !== null && lngCoord !== null && !isNaN(latCoord) && !isNaN(lngCoord);

    // Human-friendly date/time formatter
    const formatTs = (ts) => {
      if (!ts) return 'Not recorded';
      try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return String(ts);
        return d.toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      } catch (e) {
        return String(ts);
      }
    };

    // Verification History Audit Trail HTML
    const vHistory = Array.isArray(item.verificationHistory) ? item.verificationHistory : [];
    let vHistoryHtml = '';
    if (vHistory.length > 0) {
      vHistoryHtml = `
        <div class="vhistory-section">
          <div class="vhistory-title">
            <span>📜</span> Verification Audit History (${vHistory.length} Record${vHistory.length === 1 ? '' : 's'})
          </div>
          <ul class="vhistory-timeline">
            ${vHistory.map(h => {
              const hStatusClass = getVerificationBadgeClass(h.status || 'Pending');
              return `
                <li class="vhistory-item">
                  <div class="vhistory-action-line">
                    <span class="vhistory-action">${escapeHtml(h.action || h.status)}</span>
                    <span class="verify-badge ${hStatusClass}" style="font-size: 0.68rem; padding: 1px 6px;">
                      ${escapeHtml(h.status || 'Pending')}
                    </span>
                    <span class="vhistory-meta">
                      by <strong>${escapeHtml(h.authorityName || 'Authority')}</strong> &bull; ${formatTs(h.timestamp)}
                    </span>
                  </div>
                  ${h.notes ? `<div class="vhistory-notes">"${escapeHtml(h.notes)}"</div>` : ''}
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      `;
    } else {
      vHistoryHtml = `
        <div class="vhistory-section" style="background: #f8fafc; border: 1px dashed #cbd5e1; text-align: center; color: #64748b; font-size: 0.8rem; padding: 0.75rem;">
          Initial verification pending. No prior authority review actions recorded yet.
        </div>
      `;
    }

    // Find citizen in registered sampleUsers list
    let citizen = sampleUsers.find(u => {
      const uId = (u.id || u._id || '').toString();
      const uEmail = (u.email || '').toLowerCase();
      const uName = (u.name || '').toLowerCase();
      return (item.reporterId && uId === item.reporterId.toString()) ||
             (item.reportedBy && uId === item.reportedBy.toString()) ||
             (item.reporterEmail && uEmail === item.reporterEmail.toLowerCase()) ||
             (item.reporterName && uName === item.reporterName.toLowerCase()) ||
             (item.reportedBy && uName === item.reportedBy.toLowerCase());
    });

    if (!citizen) {
      citizen = {
        id: item.reporterId || 'user_anon',
        name: item.reporterName || (typeof item.reportedBy === 'string' ? item.reportedBy : 'Civic Citizen'),
        email: item.reporterEmail || 'citizen@civicconnect.org',
        tokens: item.reporterTokens || 15,
        reported: item.reportCount || 1,
        resolved: 0,
        status: item.reporterStatus || 'Active',
        flaggedReason: ''
      };
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

      ${(item.remindersCount && item.remindersCount > 0) ? `
        <div style="background-color: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; color: #9f1239;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem;">
            <strong style="font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>🔔</span> Citizen Follow-Up Alert (${item.remindersCount} Reminder(s) Dispatched)
            </strong>
            <span style="font-size: 0.72rem; background: #be123c; color: white; padding: 2px 8px; border-radius: 9999px; font-weight: 800;">ACTION REQUIRED</span>
          </div>
          <p style="margin: 0; font-size: 0.85rem; line-height: 1.45;">
            The reporting citizen has sent urgent follow-up notifications requesting immediate resolution update for this location.
            ${item.lastReminderReason ? `<br><strong>Citizen Reason:</strong> "${escapeHtml(item.lastReminderReason)}"` : ''}
          </p>
        </div>
      ` : ''}

      <!-- Reporting Citizen Identity & Anti-Fraud Action Card -->
      <div class="citizen-profile-card ${citizen.status === 'Flagged' ? 'flagged' : ''}" id="modalCitizenCard">
        <div class="citizen-profile-header">
          <strong style="color: var(--navy-blue); font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>👤</span> Reporting Citizen: <u>${escapeHtml(citizen.name)}</u>
          </strong>
          <span class="verify-badge ${citizen.status === 'Flagged' ? 'verify-rejected' : 'verify-verified'}" id="modalCitizenStatusBadge">
            ${citizen.status === 'Flagged' ? '⚠️ Account Flagged' : '✓ Active Citizen'}
          </span>
        </div>

        <div class="citizen-profile-grid">
          <div>
            <span style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Citizen Email</span>
            <div style="font-size: 0.85rem; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(citizen.email || 'N/A')}
            </div>
          </div>
          <div>
            <span style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Citizen ID</span>
            <div style="font-size: 0.82rem; font-family: monospace; color: #475569;">
              ${escapeHtml(citizen.id || 'N/A')}
            </div>
          </div>
          <div>
            <span style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Reported Tickets</span>
            <div style="font-size: 0.85rem; font-weight: 700; color: #07546b;">
              ${citizen.reported || 1} complaints
            </div>
          </div>
          <div>
            <span style="font-size: 0.72rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Reward Token Balance</span>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary-teal);" id="modalCitizenTokensDisplay">
              🪙 ${citizen.tokens || 0} tokens
            </div>
          </div>
        </div>

        ${citizen.status === 'Flagged' && citizen.flaggedReason ? `
          <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 6px; padding: 0.45rem 0.75rem; font-size: 0.8rem; color: #991b1b; margin-bottom: 0.65rem;">
            <strong>Flagged Reason:</strong> "${escapeHtml(citizen.flaggedReason)}"
          </div>
        ` : ''}

        <div class="citizen-profile-actions">
          ${citizen.status === 'Flagged' ? `
            <button type="button" class="btn-unflag-citizen" id="modalUnflagCitizenBtn" data-uid="${escapeHtml(citizen.id)}">
              ✓ Clear Flag &amp; Restore Citizen
            </button>
          ` : `
            <button type="button" class="btn-flag-citizen" id="modalFlagCitizenBtn" data-uid="${escapeHtml(citizen.id)}">
              ⚠️ Flag Citizen for False Complaint (-10 Tokens)
            </button>
          `}
          <button type="button" class="btn btn-outline" id="modalJumpToCitizenListBtn" style="font-size: 0.75rem; padding: 0.35rem 0.7rem;" title="View all registered citizens in directory">
            📋 View in Citizen Directory &rarr;
          </button>
        </div>
      </div>

      <!-- AI Danger Assessment & Priority Calculation -->
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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
            <span class="modal-meta-label">Location / Landmark</span>
            ${(latCoord && lngCoord) ? `
              <button type="button" class="btn-jump-map" id="modalJumpMapBtn">
                🗺️ View on Heat Map
              </button>
            ` : ''}
          </div>
          <span class="modal-meta-value">${escapeHtml(addressStr)}</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-label">Reported Date</span>
          <span class="modal-meta-value">${escapeHtml(item.date)}</span>
        </div>
        <div class="modal-meta-item">
          <span class="modal-meta-label">Reported By</span>
          <span class="modal-meta-value">${escapeHtml(citizen.name)} (${escapeHtml(citizen.email || 'Registered Citizen')})</span>
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
          <span class="modal-meta-label">Photo Evidence</span>
          <span class="evidence-source-tag ${photoSource === 'camera' ? 'source-camera' : 'source-gallery'}" style="font-size: 0.72rem;">
            ${photoSource === 'camera' ? '📷 Live Camera' : photoSource === 'gallery' ? '🖼️ Gallery File' : '📁 Uploaded File'}
          </span>
        </div>
        ${imageHtml}
      </div>

      <!-- Location & Evidence Verification (Stage 10 Part 21) -->
      <div class="evidence-verification-card">
        <div class="evidence-header">
          <h4 class="evidence-title">
            <span>📍</span> Location &amp; Evidence Verification
          </h4>
          <span class="verify-badge ${verifyClass}">
            ${escapeHtml(item.verification)}
          </span>
        </div>

        ${(isGps && locAccuracy && locAccuracy > 50) ? `
          <div class="evidence-warning-banner">
            <span>⚠️</span>
            <div>
              <strong>Coarse GPS Accuracy Warning (&plusmn;${Math.round(locAccuracy)}m):</strong>
              Device reported accuracy radius exceeds 50 metres. Cross-reference nearby street landmarks and photographic evidence before scheduling field crews.
            </div>
          </div>
        ` : ''}

        ${(!isGps && hasCoords) ? `
          <div class="evidence-warning-banner" style="background: #fffbeb; border-color: #fde68a; color: #92400e;">
            <span>ℹ️</span>
            <div>
              <strong>Manually Placed Location:</strong>
              Coordinates were selected manually on the map (no device GPS sensor fix). Review against description and visual photographic clues.
            </div>
          </div>
        ` : ''}

        <div class="evidence-fairness-note">
          <strong>Fairness Advisory:</strong> Missing GPS or manual pin selection does NOT imply a fraudulent complaint. Citizens may have strict privacy controls or submitted the report after leaving the hazard location. Human verification of the photograph and description is required.
        </div>

        <div class="evidence-grid">
          <div class="evidence-item">
            <span class="evidence-label">Location Source</span>
            <div class="evidence-value">
              ${isGps ? `
                <span class="evidence-source-tag source-gps">🛰️ GPS Hardware Verified</span>
              ` : `
                <span class="evidence-source-tag source-manual">📍 Manually Selected Pin</span>
              `}
            </div>
          </div>

          <div class="evidence-item">
            <span class="evidence-label">Reported Coordinates</span>
            <div class="evidence-value" style="font-family: monospace; font-size: 0.82rem;">
              ${hasCoords ? `${Number(latCoord).toFixed(5)}, ${Number(lngCoord).toFixed(5)}` : 'No coordinates'}
            </div>
          </div>

          <div class="evidence-item">
            <span class="evidence-label">GPS Precision / Accuracy</span>
            <div class="evidence-value">
              ${(locAccuracy !== null && locAccuracy !== undefined && !isNaN(locAccuracy)) ? `
                <span class="evidence-accuracy-chip ${locAccuracy <= 50 ? 'acc-good' : 'acc-coarse'}">
                  &plusmn;${Math.round(locAccuracy)} metres (${locAccuracy <= 50 ? 'High Precision' : 'Coarse Precision'})
                </span>
              ` : `
                <span style="font-size: 0.8rem; color: #64748b;">N/A (Manual Pin)</span>
              `}
            </div>
          </div>

          <div class="evidence-item">
            <span class="evidence-label">Photo Source</span>
            <div class="evidence-value">
              ${photoSource === 'camera' ? `
                <span class="evidence-source-tag source-camera">📷 Live Camera Capture</span>
              ` : photoSource === 'gallery' ? `
                <span class="evidence-source-tag source-gallery">🖼️ Gallery / File Upload</span>
              ` : `
                <span class="evidence-source-tag source-gallery">📁 Uploaded File</span>
              `}
            </div>
          </div>
        </div>

        <!-- Timestamps Cross-Verification Table -->
        <div class="evidence-timestamps-comparison">
          <strong style="display: block; font-size: 0.8rem; color: var(--navy-blue); margin-bottom: 0.4rem;">
            🕒 Evidence Timestamps Cross-Check
          </strong>
          <table class="timestamps-table">
            <tbody>
              <tr>
                <td class="ts-label">Location Captured:</td>
                <td class="ts-value">${formatTs(locCapturedAt)}</td>
              </tr>
              <tr>
                <td class="ts-label">Photo Selected / Uploaded:</td>
                <td class="ts-value">${formatTs(photoUploadedAt)}</td>
              </tr>
              <tr>
                <td class="ts-label">Official Server Submission:</td>
                <td class="ts-value">${formatTs(serverSubmittedAt)}</td>
              </tr>
            </tbody>
          </table>
          <span style="display: block; font-size: 0.72rem; color: #64748b; margin-top: 0.35rem; font-style: italic;">
            Note: Client timestamps are recorded for contextual analysis; server submission timestamp represents the immutable official receipt.
          </span>
        </div>

        <!-- Evidence Mini Map -->
        <strong style="display: block; font-size: 0.8rem; color: var(--navy-blue); margin-bottom: 0.4rem;">
          🗺️ Evidence Location Map View
        </strong>
        ${hasCoords ? `
          <div class="modal-evidence-map-wrap">
            <div id="modalEvidenceMap"></div>
          </div>
        ` : `
          <div class="modal-evidence-map-wrap">
            <div class="modal-evidence-map-fallback">
              <span style="font-size: 1.8rem; margin-bottom: 0.35rem;">📍</span>
              <strong style="color: var(--navy-blue); font-size: 0.9rem;">No Geographic Coordinates Recorded</strong>
              <p style="margin: 0.25rem 0 0; font-size: 0.78rem; max-width: 320px;">
                Citizen provided textual landmark address only (${escapeHtml(addressStr)}). Verify location from street description and photograph.
              </p>
            </div>
          </div>
        `}

        <!-- Verification History Audit Trail -->
        ${vHistoryHtml}
      </div>

      <!-- Municipal Action Plan: Assigned Official & Internal Notes -->
      <div style="background-color: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
          <strong style="color: var(--navy-blue); font-size: 0.95rem; display: flex; align-items: center; gap: 0.35rem;">
            <span>👷</span> Municipal Action Plan &amp; Official Assignment
          </strong>
          <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Internal Authority Record</span>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.85rem; margin-bottom: 0.75rem;">
          <div>
            <label for="modalAssignOfficialInput" style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--navy-blue); margin-bottom: 0.25rem;">
              Assigned Field Official:
            </label>
            <input 
              type="text" 
              id="modalAssignOfficialInput" 
              class="admin-search-input" 
              style="padding: 0.45rem 0.65rem; font-size: 0.85rem; width: 100%; border-radius: 6px; border: 1.5px solid #cbd5e1; background: #fff;" 
              placeholder="e.g. Officer R. Sharma (Ward 4)" 
              value="${escapeHtml(item.assignedOfficial || '')}"
            >
          </div>
          <div>
            <label for="modalInternalNotesInput" style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--navy-blue); margin-bottom: 0.25rem;">
              Internal Municipal Notes:
            </label>
            <textarea 
              id="modalInternalNotesInput" 
              rows="2" 
              class="admin-search-input" 
              style="padding: 0.45rem 0.65rem; font-size: 0.85rem; width: 100%; border-radius: 6px; border: 1.5px solid #cbd5e1; background: #fff; resize: vertical;" 
              placeholder="Internal notes, inspection date, contractor details..."
            >${escapeHtml(item.internalNotes || '')}</textarea>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button type="button" class="btn btn-outline" id="modalSaveActionPlanBtn" style="font-size: 0.8rem; padding: 0.35rem 0.85rem; font-weight: 700;">
            💾 Save Official &amp; Notes
          </button>
        </div>
      </div>

      <!-- Resolution Panel if applicable -->
      ${resolutionHtml}
    `;

    // Render Modal Actions
    renderModalFooterActions(item);

    // Setup Jump to Heat Map button
    const jumpMapBtn = reviewModalBody.querySelector('#modalJumpMapBtn');
    if (jumpMapBtn && latCoord && lngCoord) {
      jumpMapBtn.addEventListener('click', () => {
        closeReviewModal();
        const mapSection = document.getElementById('heatmap-section');
        if (mapSection) mapSection.scrollIntoView({ behavior: 'smooth' });
        if (mapInstance) {
          mapInstance.setView([latCoord, lngCoord], 15);
          if (markersLayerInstance) {
            markersLayerInstance.eachLayer(layer => {
              const ll = layer.getLatLng();
              if (Math.abs(ll.lat - latCoord) < 0.0001 && Math.abs(ll.lng - lngCoord) < 0.0001) {
                layer.openPopup();
              }
            });
          }
        }
      });
    }

    // Setup Flag Citizen Action (Anti-Fraud Penalty)
    const flagBtn = reviewModalBody.querySelector('#modalFlagCitizenBtn');
    if (flagBtn) {
      flagBtn.addEventListener('click', async () => {
        const reason = await openActionModal({
          icon: '🚩',
          title: 'Flag Citizen Account (Anti-Fraud Penalty)',
          subtitle: `Citizen: ${citizen.name} (ID: ${citizen.id || citizen._id})`,
          label: 'Enter penalty reason for false / spam reporting:',
          defaultValue: "False or misleading hazard complaint submitted",
          placeholder: 'Specify reason for account violation penalty...',
          chips: [
            "False or fake hazard photograph submitted",
            "Duplicate spam report submissions",
            "Offensive or abusive complaint content"
          ],
          confirmText: 'Flag & Penalize (-10 Tokens)',
          confirmClass: 'btn-danger',
          requireInput: true,
          minLength: 5
        });
        if (reason === null) return;

        flagBtn.disabled = true;
        flagBtn.textContent = 'Flagging...';

        try {
          const flagRes = await window.civicFetch(`/api/admin/users/${citizen.id}/flag`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'Flagged',
              reason: reason.trim() || 'False complaint violation',
              penaltyTokens: 10
            })
          });

          if (flagRes && flagRes.ok) {
            citizen.status = 'Flagged';
            citizen.flaggedReason = reason;
            citizen.tokens = Math.max(0, (citizen.tokens || 10) - 10);
            item.reporterStatus = 'Flagged';

            // Also offer to reject the false complaint
            const rejectConfirm = await openConfirmModal({
              icon: '❌',
              title: 'Reject Complaint as False Report?',
              message: `Do you also want to mark this complaint (${item.id}) as REJECTED due to false reporting?`,
              confirmText: 'Reject Complaint',
              confirmClass: 'btn-danger'
            });
            if (rejectConfirm) {
              await window.civicFetch(`/api/admin/complaints/${item.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({
                  status: 'Rejected',
                  verification: 'Rejected',
                  internalNotes: `Rejected as FALSE COMPLAINT by Admin. Reason: ${reason}`
                })
              });
              item.status = 'Rejected';
              item.verification = 'Rejected';
            }

            addActivity(`Admin penalized citizen ${citizen.name} (-10 tokens) and flagged account for false report ${item.id}`, 'reject');
            refreshAllDashboardViews();
            renderUsers();
            openReviewModal(item.id);
          } else {
            alert('Could not update citizen flag status on server.');
          }
        } catch (err) {
          alert('Error updating citizen: ' + err.message);
        } finally {
          if (flagBtn) flagBtn.disabled = false;
        }
      });
    }

    // Setup Unflag Citizen Action
    const unflagBtn = reviewModalBody.querySelector('#modalUnflagCitizenBtn');
    if (unflagBtn) {
      unflagBtn.addEventListener('click', async () => {
        const confirmed = await openConfirmModal({
          icon: '🔄',
          title: 'Restore Citizen Account',
          message: `Restore citizen "${citizen.name}" account status to Active? Their penalties will be cleared.`,
          confirmText: 'Restore to Active',
          confirmClass: 'btn-success'
        });
        if (!confirmed) return;

        unflagBtn.disabled = true;
        unflagBtn.textContent = 'Restoring...';

        try {
          const res = await window.civicFetch(`/api/admin/users/${citizen.id}/flag`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'Active', reason: '' })
          });

          if (res && res.ok) {
            citizen.status = 'Active';
            citizen.flaggedReason = '';
            item.reporterStatus = 'Active';
            addActivity(`Admin restored citizen ${citizen.name} to Active status`, 'verify');
            refreshAllDashboardViews();
            renderUsers();
            openReviewModal(item.id);
            alert(`Citizen ${citizen.name} has been reinstated to Active status.`);
          } else {
            alert('Could not update citizen status on server.');
          }
        } catch (err) {
          alert('Error updating citizen: ' + err.message);
        } finally {
          if (unflagBtn) unflagBtn.disabled = false;
        }
      });
    }

    // Setup Jump to Citizen Directory button
    const jumpCitizenBtn = reviewModalBody.querySelector('#modalJumpToCitizenListBtn');
    if (jumpCitizenBtn) {
      jumpCitizenBtn.addEventListener('click', () => {
        closeReviewModal();
        const userSec = document.getElementById('users-section');
        if (userSec) userSec.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          const userRow = document.querySelector(`tr[data-uid="${citizen.id}"]`);
          if (userRow) {
            userRow.style.backgroundColor = '#fef08a';
            setTimeout(() => { userRow.style.backgroundColor = ''; }, 3000);
          }
        }, 400);
      });
    }

    // Setup Save Action Plan (Official & Internal Notes)
    const saveActionPlanBtn = reviewModalBody.querySelector('#modalSaveActionPlanBtn');
    if (saveActionPlanBtn) {
      saveActionPlanBtn.addEventListener('click', async () => {
        const offInput = reviewModalBody.querySelector('#modalAssignOfficialInput');
        const notesInput = reviewModalBody.querySelector('#modalInternalNotesInput');
        const assignedOfficial = offInput ? offInput.value.trim() : '';
        const internalNotes = notesInput ? notesInput.value.trim() : '';

        saveActionPlanBtn.disabled = true;
        saveActionPlanBtn.textContent = 'Saving...';
        try {
          const res = await window.civicFetch('/api/admin/complaints/' + item.id + '/status', {
            method: 'PATCH',
            body: JSON.stringify({ assignedOfficial, internalNotes })
          });
          if (res && res.ok) {
            const json = await res.json();
            if (json.data) Object.assign(item, json.data);
            item.assignedOfficial = assignedOfficial;
            item.internalNotes = internalNotes;
            addActivity(`Admin updated action plan for ${item.id} (Official: ${assignedOfficial || 'None'})`, 'verify');
            refreshAllDashboardViews();
            alert('Official assignment and internal notes saved successfully!');
          } else {
            alert('Could not save action plan to server.');
          }
        } catch (err) {
          alert('Error saving action plan: ' + err.message);
        } finally {
          if (saveActionPlanBtn) {
            saveActionPlanBtn.disabled = false;
            saveActionPlanBtn.textContent = '💾 Save Official & Notes';
          }
        }
      });
    }

    // Setup Re-analyze AI button click event
    const reanalyzeBtn = reviewModalBody.querySelector('#reanalyzeAiBtn');
    if (reanalyzeBtn) {
      reanalyzeBtn.addEventListener('click', async () => {
        reanalyzeBtn.disabled = true;
        reanalyzeBtn.textContent = 'Calling Gemini AI...';
        try {
          const res = await window.civicFetch(`/api/complaints/${item.id}/reanalyze`, { method: 'POST' });
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

    // Initialize Modal Evidence Leaflet Map Viewport
    if (hasCoords && window.L) {
      setTimeout(() => {
        const mapContainer = document.getElementById('modalEvidenceMap');
        if (mapContainer) {
          if (modalMapInstance) {
            try { modalMapInstance.remove(); } catch (e) {}
            modalMapInstance = null;
          }
          try {
            const mLat = parseFloat(latCoord);
            const mLng = parseFloat(lngCoord);
            modalMapInstance = L.map(mapContainer, {
              center: [mLat, mLng],
              zoom: 16,
              scrollWheelZoom: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
              maxZoom: 19
            }).addTo(modalMapInstance);

            const pinMarker = L.marker([mLat, mLng]).addTo(modalMapInstance);
            pinMarker.bindPopup(`
              <div style="font-size: 0.8rem; font-family: sans-serif; line-height: 1.4;">
                <strong style="color: #07546b;">${escapeHtml(item.title)}</strong><br>
                <span>${isGps ? '🛰️ Device GPS Fix' : '📍 Manual Map Placement'}</span>
                ${(locAccuracy !== null && locAccuracy !== undefined && !isNaN(locAccuracy)) ? `<br><span>Accuracy: &plusmn;${Math.round(locAccuracy)}m</span>` : ''}
              </div>
            `);

            if (isGps && locAccuracy && locAccuracy > 0) {
              L.circle([mLat, mLng], {
                radius: Math.min(parseFloat(locAccuracy), 1000),
                color: locAccuracy <= 50 ? '#059669' : '#d97706',
                fillColor: locAccuracy <= 50 ? '#10b981' : '#f59e0b',
                fillOpacity: 0.15,
                weight: 1.5
              }).addTo(modalMapInstance);
            }

            modalMapInstance.invalidateSize();
          } catch (mErr) {
            console.warn('[Modal Evidence Map]: Initialization notice:', mErr.message);
          }
        }
      }, 180);
    }
  }

  function renderModalFooterActions(item) {
    if (!modalFooterActions) return;

    const curPriority = (item.priority && item.priority.level) ? item.priority.level.toUpperCase() : (item.severity ? item.severity.toUpperCase() : 'MEDIUM');

    modalFooterActions.innerHTML = `
      <div style="font-size: 0.8rem; color: var(--text-muted);">
        Verification &amp; Lifecycle Actions:
      </div>
      <div class="modal-action-buttons-group">
        ${item.verification !== 'Verified' ? `
          <button type="button" class="btn btn-action-verify" id="modalVerifyBtn" title="Confirm evidence matches reported civic issue">
            ✓ Verify Complaint
          </button>
        ` : ''}

        ${item.verification !== 'Needs Inspection' ? `
          <button type="button" class="btn btn-action-inspect" id="modalInspectBtn" title="Dispatch field supervisor for on-site physical check">
            🔍 Mark for Inspection
          </button>
        ` : ''}

        ${item.verification !== 'Insufficient Evidence' ? `
          <button type="button" class="btn btn-action-insufficient" id="modalInsufficientBtn" title="Flag submission for insufficient photo or location evidence">
            ⚠️ Insufficient Evidence
          </button>
        ` : ''}

        ${item.verification !== 'Rejected' && item.status !== 'Rejected' ? `
          <button type="button" class="btn btn-action-reject" id="modalRejectBtn" title="Reject invalid or false civic complaint (requires mandatory reason)">
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

      <!-- Priority Override Control -->
      <div style="margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; width: 100%;">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--navy-blue);">
          Assign Priority:
        </span>
        <div style="display: flex; gap: 0.4rem; align-items: center;">
          <select id="modalPrioritySelect" style="padding: 0.3rem 0.6rem; border-radius: 4px; border: 1.5px solid #cbd5e1; font-size: 0.82rem; font-weight: 600; background: #fff;">
            <option value="LOW" ${curPriority === 'LOW' ? 'selected' : ''}>Low Priority</option>
            <option value="MEDIUM" ${curPriority === 'MEDIUM' ? 'selected' : ''}>Medium Priority</option>
            <option value="HIGH" ${curPriority === 'HIGH' ? 'selected' : ''}>High Priority</option>
            <option value="CRITICAL" ${curPriority === 'CRITICAL' ? 'selected' : ''}>Critical Priority</option>
          </select>
          <button type="button" class="btn btn-outline" id="modalSavePriorityBtn" style="font-size: 0.8rem; padding: 0.3rem 0.65rem;">
            Update Priority
          </button>
        </div>
      </div>
    `;

    // Bind verification action events
    const verifyBtn = document.getElementById('modalVerifyBtn');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => submitVerificationDecision(item.id, 'Verified', 'Reported location and photo evidence verified.', 'Evidence Verified'));
    }

    const inspectBtn = document.getElementById('modalInspectBtn');
    if (inspectBtn) {
      inspectBtn.addEventListener('click', () => submitVerificationDecision(item.id, 'Needs Inspection', 'Field inspection required to verify ground conditions.', 'Marked for Field Inspection'));
    }

    const insufficientBtn = document.getElementById('modalInsufficientBtn');
    if (insufficientBtn) {
      insufficientBtn.addEventListener('click', () => submitVerificationDecision(item.id, 'Insufficient Evidence', 'Photo or location evidence is insufficient. Further citizen verification needed.', 'Flagged Insufficient Evidence'));
    }

    const rejectBtn = document.getElementById('modalRejectBtn');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => submitVerificationDecision(item.id, 'Rejected', '', 'Complaint Verification Rejected'));
    }

    const progressBtn = document.getElementById('modalProgressBtn');
    if (progressBtn) {
      progressBtn.addEventListener('click', () => updateComplaintStatus(item.id, 'In Progress'));
    }

    const resolveBtn = document.getElementById('modalResolveBtn');
    if (resolveBtn) {
      resolveBtn.addEventListener('click', () => resolveComplaint(item.id));
    }

    const savePriorityBtn = document.getElementById('modalSavePriorityBtn');
    if (savePriorityBtn) {
      savePriorityBtn.addEventListener('click', () => {
        const selectEl = document.getElementById('modalPrioritySelect');
        if (selectEl) {
          updateComplaintPriority(item.id, selectEl.value);
        }
      });
    }

    const closeBtn = document.getElementById('modalCloseActionBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeReviewModal);
    }
  }

  function closeReviewModal() {
    if (modalMapInstance) {
      try { modalMapInstance.remove(); } catch (e) {}
      modalMapInstance = null;
    }
    if (!reviewModal) return;
    reviewModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    activeComplaintId = null;
  }

  /* ========================================================
   * 9. STATUS MANAGEMENT & VERIFICATION LOGIC (PERSISTENT)
   * Syncs verification state via PATCH /api/admin/complaints/:id/verify
   * ========================================================
   */

  /**
   * ========================================================
   * IN-APP CIVIC ACTION & CONFIRMATION MODALS
   * Replaces native browser prompt() & confirm() dialogs with
   * responsive, accessible, themed in-app dialogs with quick chips
   * ========================================================
   */
  function openActionModal({
    icon = '📝',
    title = 'Confirm Action',
    subtitle = '',
    label = 'Notes / Details:',
    defaultValue = '',
    placeholder = 'Type details...',
    chips = [],
    confirmText = 'Confirm & Proceed',
    confirmClass = 'btn-primary',
    requireInput = false,
    minLength = 0,
    hint = ''
  }) {
    return new Promise((resolve) => {
      let modal = document.getElementById('civicActionModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'civicActionModal';
        modal.className = 'civic-action-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
          <div class="civic-action-dialog">
            <div class="modal-header">
              <div class="modal-title-group" style="display: flex; align-items: center; gap: 0.6rem;">
                <span class="modal-icon" id="actionModalIcon" style="font-size: 1.5rem;">⭐</span>
                <div>
                  <h3 class="modal-title" id="actionModalTitle" style="font-size: 1.1rem; font-weight: 700; margin: 0; color: #0f172a;">Action</h3>
                  <span class="modal-subtitle-id" id="actionModalSubtitle" style="font-size: 0.8rem; color: #64748b;">Subtitle</span>
                </div>
              </div>
              <button type="button" class="modal-close" id="actionModalCloseBtn" aria-label="Close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #94a3b8;">&times;</button>
            </div>
            <div class="modal-body">
              <label class="civic-action-label" id="actionModalLabel" for="actionModalInput">Notes</label>
              <div class="civic-action-chips" id="actionModalChips"></div>
              <textarea id="actionModalInput" class="civic-action-textarea" rows="3"></textarea>
              <div class="civic-action-error" id="actionModalError" style="display: none; color: #dc2626; font-size: 0.8rem; font-weight: 700; margin-top: 5px;"></div>
              <div class="civic-action-hint" id="actionModalHint"></div>
            </div>
            <div class="modal-footer civic-action-footer">
              <button type="button" class="btn btn-outline" id="actionModalCancelBtn">Cancel</button>
              <button type="button" class="btn" id="actionModalConfirmBtn">Confirm</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const iconEl = modal.querySelector('#actionModalIcon');
      const titleEl = modal.querySelector('#actionModalTitle');
      const subtitleEl = modal.querySelector('#actionModalSubtitle');
      const labelEl = modal.querySelector('#actionModalLabel');
      const chipsEl = modal.querySelector('#actionModalChips');
      const inputEl = modal.querySelector('#actionModalInput');
      const errorEl = modal.querySelector('#actionModalError');
      const hintEl = modal.querySelector('#actionModalHint');
      const cancelBtn = modal.querySelector('#actionModalCancelBtn');
      const confirmBtn = modal.querySelector('#actionModalConfirmBtn');
      const closeBtn = modal.querySelector('#actionModalCloseBtn');

      iconEl.textContent = icon;
      titleEl.textContent = title;
      subtitleEl.textContent = subtitle;
      labelEl.textContent = label;
      inputEl.style.display = 'block';
      inputEl.placeholder = placeholder;
      inputEl.value = defaultValue;
      hintEl.textContent = hint || (requireInput ? `* Mandatory field (minimum ${minLength} characters)` : '');
      errorEl.style.display = 'none';
      errorEl.textContent = '';

      // Preset quick chips
      chipsEl.innerHTML = '';
      if (Array.isArray(chips) && chips.length > 0) {
        chips.forEach(chipText => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'civic-chip-btn';
          chip.textContent = chipText;
          chip.addEventListener('click', () => {
            inputEl.value = chipText;
            inputEl.focus();
            errorEl.style.display = 'none';
          });
          chipsEl.appendChild(chip);
        });
        chipsEl.style.display = 'flex';
      } else {
        chipsEl.style.display = 'none';
      }

      confirmBtn.className = `btn ${confirmClass}`;
      confirmBtn.textContent = confirmText;

      modal.removeAttribute('hidden');
      modal.style.display = 'flex';
      setTimeout(() => inputEl.focus(), 60);

      function cleanup() {
        modal.style.display = 'none';
        modal.setAttribute('hidden', '');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        closeBtn.onclick = null;
        document.removeEventListener('keydown', onKeyDown);
      }

      function handleConfirm() {
        const val = inputEl.value.trim();
        if (requireInput && val.length < minLength) {
          errorEl.textContent = `Please enter at least ${minLength} characters.`;
          errorEl.style.display = 'block';
          inputEl.focus();
          return;
        }
        cleanup();
        resolve(val);
      }

      function handleCancel() {
        cleanup();
        resolve(null);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') {
          handleCancel();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          handleConfirm();
        }
      }

      confirmBtn.onclick = handleConfirm;
      cancelBtn.onclick = handleCancel;
      closeBtn.onclick = handleCancel;
      document.addEventListener('keydown', onKeyDown);
    });
  }

  function openConfirmModal({
    icon = '❓',
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Yes, Proceed',
    confirmClass = 'btn-primary'
  }) {
    return new Promise((resolve) => {
      openActionModal({
        icon,
        title,
        subtitle: '',
        label: message,
        defaultValue: '',
        chips: [],
        confirmText,
        confirmClass,
        requireInput: false,
        hint: ''
      }).then(val => {
        resolve(val !== null);
      });
      const modal = document.getElementById('civicActionModal');
      if (modal) {
        const inputEl = modal.querySelector('#actionModalInput');
        if (inputEl) inputEl.style.display = 'none';
      }
    });
  }

  // Submit Evidence Verification Decision (Authorized Authority Action)
  async function submitVerificationDecision(id, targetStatus, defaultNotes = '', actionLabel = '') {
    const item = complaints.find(c => c.id === id);
    if (!item) return;

    let notes = '';

    if (targetStatus === 'Rejected') {
      const reason = await openActionModal({
        icon: '❌',
        title: 'Reject Complaint Verification',
        subtitle: `Complaint #${item.id} — ${item.title || item.category}`,
        label: 'Enter mandatory reason for rejecting this complaint:',
        defaultValue: defaultNotes || "Photograph does not match reported location or invalid civic issue.",
        placeholder: 'Specify why this complaint cannot be verified by the municipal authority...',
        chips: [
          "Photograph does not match reported location",
          "Private property outside municipal jurisdiction",
          "Duplicate report of existing active ticket",
          "Insufficient evidence / unable to locate hazard"
        ],
        confirmText: 'Reject Complaint',
        confirmClass: 'btn-danger',
        requireInput: true,
        minLength: 5,
        hint: '* Required. The citizen will receive this explanation on their portal.'
      });
      if (reason === null) return; // User cancelled
      notes = reason;
    } else if (targetStatus === 'Needs Inspection') {
      const input = await openActionModal({
        icon: '🔍',
        title: 'Schedule Field Inspection',
        subtitle: `Complaint #${item.id} — ${item.title || item.category}`,
        label: 'Field inspection instructions or notes for engineers:',
        defaultValue: defaultNotes || "Field inspection scheduled to cross-verify physical hazard location.",
        chips: [
          "Field inspection scheduled with ward engineer",
          "Physical structural measurement required",
          "Inter-departmental road survey pending"
        ],
        confirmText: 'Schedule Inspection',
        confirmClass: 'btn-action-inspect'
      });
      if (input === null) return;
      notes = input;
    } else if (targetStatus === 'Insufficient Evidence') {
      const input = await openActionModal({
        icon: '⚠️',
        title: 'Request Additional Evidence',
        subtitle: `Complaint #${item.id} — ${item.title || item.category}`,
        label: 'Evidence deficiencies or instructions for citizen:',
        defaultValue: defaultNotes || "Photograph angle or location accuracy unclear. Additional evidence needed.",
        chips: [
          "Photograph angle or clarity insufficient",
          "Accurate GPS geotag coordinates required",
          "Please upload clearer close-up photograph"
        ],
        confirmText: 'Request Evidence',
        confirmClass: 'btn-action-insufficient'
      });
      if (input === null) return;
      notes = input;
    } else if (targetStatus === 'Verified') {
      const input = await openActionModal({
        icon: '✅',
        title: 'Confirm Complaint Verification',
        subtitle: `Complaint #${item.id} — ${item.title || item.category}`,
        label: 'Verification note (optional):',
        defaultValue: defaultNotes || "Reported location and photo evidence verified.",
        chips: [
          "Location and photo evidence verified via GIS overlay",
          "Hazard confirmed in municipal transit corridor"
        ],
        confirmText: 'Verify Complaint',
        confirmClass: 'btn-success'
      });
      if (input === null) return;
      notes = input;
    }

    try {
      const res = await window.civicFetch(`/api/admin/complaints/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          verification: targetStatus,
          notes,
          action: actionLabel
        })
      });

      if (res && res.ok) {
        const json = await res.json();
        if (json.data) {
          Object.assign(item, json.data);
        } else {
          item.verification = targetStatus;
          item.verificationNotes = notes;
        }

        // Advance Reported -> Under Verification if verified
        if (targetStatus === 'Verified' && item.status === 'Reported') {
          item.status = 'Under Verification';
        }

        const actType = targetStatus === 'Rejected' ? 'reject' : 'verify';
        addActivity(`Admin updated verification of ${item.id} to "${targetStatus}"`, actType);
        refreshAllDashboardViews();
        if (activeComplaintId === id) {
          openReviewModal(id);
        }
        alert(`Verification updated successfully: ${targetStatus}`);
      } else {
        const errJson = res ? await res.json().catch(() => ({})) : {};
        alert(errJson.message || 'Failed to update verification status on server.');
      }
    } catch (err) {
      console.warn('[Admin Notice]: Error updating verification status:', err.message);
      alert('Error updating verification status: ' + err.message);
    }
  }

  // 1. Verify Complaint (Wrapper)
  async function verifyComplaint(id) {
    await submitVerificationDecision(id, 'Verified', 'Reported location and photo evidence verified.', 'Evidence Verified');
  }

  // 2. Reject Complaint (Wrapper)
  async function rejectComplaint(id) {
    await submitVerificationDecision(id, 'Rejected', '', 'Complaint Verification Rejected');
  }

  // 3. Update Status to In Progress
  async function updateComplaintStatus(id, newStatus, extraData = {}) {
    const item = complaints.find(c => c.id === id);
    if (!item) return;

    item.status = newStatus;
    if (item.verification === "Pending") {
      item.verification = "Verified";
    }

    try {
      const res = await window.civicFetch('/api/admin/complaints/' + id + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, ...extraData })
      });
      if (res && res.ok) {
        const json = await res.json();
        if (json.data) Object.assign(item, json.data);
      }
    } catch (err) {
      console.warn('[Admin Notice]: Network error updating status:', err.message);
    }

    addActivity(`Admin updated ${item.id} status to "${newStatus}"`, 'progress');
    refreshAllDashboardViews();
    if (activeComplaintId === id) openReviewModal(id);
  }

  // 4. Resolve Complaint (In-App Action Dialog)
  async function resolveComplaint(id) {
    const item = complaints.find(c => c.id === id);
    if (!item) return;

    const customNote = await openActionModal({
      icon: '⭐',
      title: 'Mark Complaint as Resolved',
      subtitle: `Complaint #${item.id} — ${item.title || item.category}`,
      label: 'Enter municipal resolution details & actions taken:',
      defaultValue: item.resolutionNote || "Hazard inspected and road surface restored by municipal crew.",
      placeholder: 'Describe remediation works, repair teams, or actions taken...',
      chips: [
        "Hazard inspected and repaired by municipal crew",
        "Bitumen asphalt resurfacing completed",
        "Streetlight controller replaced & functioning",
        "Overflowing waste cleared and sanitized",
        "Drain unclogged and desilted"
      ],
      confirmText: 'Confirm & Resolve',
      confirmClass: 'btn-success',
      hint: 'This message will be visible to the citizen and recorded in official municipal logs.'
    });

    if (customNote === null) return; // User cancelled

    item.status = "Resolved";
    item.verification = "Verified";
    item.resolvedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    item.resolvedBy = "Civic Admin (Ward Operations)";
    item.resolutionNote = customNote.trim() || "Remediation works successfully completed and verified.";

    try {
      const res = await window.civicFetch('/api/admin/complaints/' + id + '/status', {
        method: 'PATCH',
        body: JSON.stringify({
          status: "Resolved",
          resolvedBy: item.resolvedBy,
          resolvedNote: item.resolutionNote
        })
      });
      if (res && res.ok) {
        const json = await res.json();
        if (json.data) Object.assign(item, json.data);
      }
    } catch (err) {
      console.warn('[Admin Notice]: Network error resolving complaint:', err.message);
    }

    addActivity(`Admin marked ${item.id} as Resolved`, 'resolve');
    refreshAllDashboardViews();
    if (activeComplaintId === id) openReviewModal(id);

    // Broadcast real-time resolution notification to Citizen Portal
    if (window.notifyComplaintResolved) {
      window.notifyComplaintResolved(item);
    }
  }

  // 5. Update Priority
  async function updateComplaintPriority(id, newPriority) {
    const item = complaints.find(c => c.id === id);
    if (!item) return;

    try {
      const res = await window.civicFetch('/api/admin/complaints/' + id + '/priority', {
        method: 'PATCH',
        body: JSON.stringify({ priorityLevel: newPriority })
      });
      if (res && res.ok) {
        const json = await res.json();
        if (json.data && json.data.priority) {
          item.priority = json.data.priority;
        } else {
          item.priority = { ...(item.priority || {}), level: newPriority };
        }
        addActivity(`Admin updated priority of ${item.id} to ${newPriority}`, 'progress');
        refreshAllDashboardViews();
        if (activeComplaintId === id) openReviewModal(id);
      } else {
        alert('Failed to update priority on server.');
      }
    } catch (err) {
      console.warn('[Admin Notice]: Network error updating priority:', err.message);
      alert('Network error updating priority: ' + err.message);
    }
  }

  /* ========================================================
   * 9B. AREA-WISE COMPLAINT HEAT MAP & GEO-HAZARD CLUSTERS
   * High-Visibility Municipal Heatmap + Clustered Hazard Auras
   * ========================================================
   */
  const MUNICIPAL_CENTER = [26.7615, 83.3735]; // Civil Lines Core, Gorakhpur
  const MUNICIPAL_DEFAULT_ZOOM = 13;

  function initAuthorityHeatMap() {
    if (mapInstance) return;
    const mapElement = document.getElementById('authorityHeatMap');
    if (!mapElement || !window.L) return;

    try {
      // Initialize Leaflet Map focused on the active municipal core
      mapInstance = L.map('authorityHeatMap', {
        center: MUNICIPAL_CENTER,
        zoom: MUNICIPAL_DEFAULT_ZOOM,
        scrollWheelZoom: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(mapInstance);

      circlesLayerInstance = L.layerGroup().addTo(mapInstance);
      markersLayerInstance = L.layerGroup().addTo(mapInstance);

      // Force recalculation of container dimensions
      setTimeout(() => {
        if (mapInstance) mapInstance.invalidateSize();
      }, 250);

      window.addEventListener('resize', () => {
        if (mapInstance) mapInstance.invalidateSize();
      });

      console.log('[Authority Heat Map]: Leaflet map instance initialized with municipal focus.');
    } catch (err) {
      console.error('[Authority Heat Map]: Initialization failed:', err);
    }
  }

  // Micro-offset generator for overlapping complaints in the same ward
  function getAdjustedCoordinates(item, index) {
    let rawLat = null, rawLng = null;
    if (item.location && typeof item.location === 'object') {
      rawLat = parseFloat(item.location.latitude);
      rawLng = parseFloat(item.location.longitude);
    } else if (item.latitude && item.longitude) {
      rawLat = parseFloat(item.latitude);
      rawLng = parseFloat(item.longitude);
    }

    if (isNaN(rawLat) || isNaN(rawLng)) return null;

    // If identical to base seed coordinates (Metro Pillar 42), disperse along ward streets
    const isBaseCivilLines = Math.abs(rawLat - 26.7606) < 0.0002 && Math.abs(rawLng - 83.3732) < 0.0002;
    if (isBaseCivilLines) {
      const offsets = [
        [0, 0],              // CC-1001 Metro Pillar 42
        [0.0022, 0.0018],    // North-East ward sector
        [-0.0019, -0.0021],  // South-West market sector
        [0.0015, -0.0024],   // North-West residential lane
        [-0.0024, 0.0019],   // South-East transit road
        [0.0031, -0.0008],   // North junction
        [-0.0012, 0.0032],   // East commercial sector
        [0.0008, -0.0030],   // West arterial road
        [0.0026, 0.0028]     // North-East ring road
      ];
      const off = offsets[index % offsets.length];
      return { lat: rawLat + off[0], lng: rawLng + off[1] };
    }

    return { lat: rawLat, lng: rawLng };
  }

  function populateLocalityFilters() {
    const localityMap = {};
    complaints.forEach(item => {
      const addr = (item.location && typeof item.location === 'object' && item.location.address)
        ? item.location.address
        : (typeof item.location === 'string' ? item.location : '');
      if (!addr) return;
      const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
      let locKey = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      if (locKey && locKey.length > 2) {
        localityMap[locKey] = (localityMap[locKey] || 0) + 1;
      }
    });

    const entries = Object.entries(localityMap).sort((a, b) => b[1] - a[1]);

    if (mapLocalityFilter) {
      const currentVal = mapLocalityFilter.value;
      mapLocalityFilter.innerHTML = '<option value="all">All Municipal Areas (Gorakhpur Core)</option>';
      entries.forEach(([loc, count]) => {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.textContent = `${loc} (${count} Hazard${count > 1 ? 's' : ''})`;
        if (loc === currentVal) opt.selected = true;
        mapLocalityFilter.appendChild(opt);
      });
    }

    if (filterLocality) {
      const currentVal = filterLocality.value;
      filterLocality.innerHTML = '<option value="all">All Localities</option>';
      entries.forEach(([loc, count]) => {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.textContent = `${loc} (${count})`;
        if (loc === currentVal) opt.selected = true;
        filterLocality.appendChild(opt);
      });
    }
  }

  function applyMapMode() {
    if (!mapInstance) return;

    if (currentMapMode === 'heat') {
      // Heat Map: Show heat density gradient and radiant hazard auras
      if (markersLayerInstance && mapInstance.hasLayer(markersLayerInstance)) {
        mapInstance.removeLayer(markersLayerInstance);
      }
      if (circlesLayerInstance && !mapInstance.hasLayer(circlesLayerInstance)) {
        circlesLayerInstance.addTo(mapInstance);
      }
      if (heatLayerInstance && !mapInstance.hasLayer(heatLayerInstance)) {
        heatLayerInstance.addTo(mapInstance);
      }
    } else if (currentMapMode === 'pins') {
      // Clustered Pins: Show numbered priority markers only
      if (heatLayerInstance && mapInstance.hasLayer(heatLayerInstance)) {
        mapInstance.removeLayer(heatLayerInstance);
      }
      if (circlesLayerInstance && mapInstance.hasLayer(circlesLayerInstance)) {
        mapInstance.removeLayer(circlesLayerInstance);
      }
      if (markersLayerInstance && !mapInstance.hasLayer(markersLayerInstance)) {
        markersLayerInstance.addTo(mapInstance);
      }
    } else if (currentMapMode === 'both') {
      // Combined: Show heat gradient, hazard auras, and numbered pins together
      if (heatLayerInstance && !mapInstance.hasLayer(heatLayerInstance)) {
        heatLayerInstance.addTo(mapInstance);
      }
      if (circlesLayerInstance && !mapInstance.hasLayer(circlesLayerInstance)) {
        circlesLayerInstance.addTo(mapInstance);
      }
      if (markersLayerInstance && !mapInstance.hasLayer(markersLayerInstance)) {
        markersLayerInstance.addTo(mapInstance);
      }
    }

    // Update active class on toolbar buttons
    const modeBtns = [
      { btn: btnViewHeatmap, mode: 'heat' },
      { btn: btnViewPins, mode: 'pins' },
      { btn: btnViewBoth, mode: 'both' }
    ];
    modeBtns.forEach(({ btn, mode }) => {
      if (btn) {
        if (btn.getAttribute('data-mode') === currentMapMode) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });
  }

  function renderMapLayers() {
    initAuthorityHeatMap();
    if (!mapInstance) return;

    const mapEmptyOverlay = document.getElementById('mapEmptyOverlay');
    const selectedLoc = (mapLocalityFilter ? mapLocalityFilter.value : 'all').toLowerCase();

    // Filter complaints having valid coordinates & matching selected locality
    const geotagged = complaints.filter(item => {
      let lat = null, lng = null;
      if (item.location && typeof item.location === 'object') {
        lat = item.location.latitude;
        lng = item.location.longitude;
      } else if (item.latitude && item.longitude) {
        lat = item.latitude;
        lng = item.longitude;
      }
      if (lat === null || lng === null || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) return false;

      if (selectedLoc !== 'all') {
        const addr = (item.location && typeof item.location === 'object' && item.location.address)
          ? item.location.address
          : (typeof item.location === 'string' ? item.location : '');
        if (!addr.toLowerCase().includes(selectedLoc)) return false;
      }
      return true;
    });

    if (geotagged.length === 0) {
      if (mapEmptyOverlay) mapEmptyOverlay.style.display = 'flex';
      if (markersLayerInstance) markersLayerInstance.clearLayers();
      if (circlesLayerInstance) circlesLayerInstance.clearLayers();
      if (heatLayerInstance && mapInstance.hasLayer(heatLayerInstance)) {
        mapInstance.removeLayer(heatLayerInstance);
      }
      return;
    }

    if (mapEmptyOverlay) mapEmptyOverlay.style.display = 'none';

    // Clear existing layers
    if (markersLayerInstance) markersLayerInstance.clearLayers();
    if (circlesLayerInstance) circlesLayerInstance.clearLayers();
    if (heatLayerInstance && mapInstance.hasLayer(heatLayerInstance)) {
      mapInstance.removeLayer(heatLayerInstance);
      heatLayerInstance = null;
    }

    const heatPoints = [];
    const bounds = [];

    geotagged.forEach((item, index) => {
      const coords = getAdjustedCoordinates(item, index);
      if (!coords) return;

      const numLat = coords.lat;
      const numLng = coords.lng;

      bounds.push([numLat, numLng]);

      // Calculate severity and priority
      const sev = String(item.severity || 'Medium').toLowerCase();
      let pScore = 40;
      if (item.priority && typeof item.priority.score === 'number') {
        pScore = item.priority.score;
      } else if (sev === 'critical') {
        pScore = 85;
      } else if (sev === 'high') {
        pScore = 65;
      } else if (sev === 'medium') {
        pScore = 45;
      } else {
        pScore = 25;
      }

      // High-visibility intensity (0.45 to 1.0)
      const intensity = Math.min(1.0, Math.max(0.45, pScore / 100));
      heatPoints.push([numLat, numLng, intensity]);

      // Color tokens matching project design system
      let pinColor = '#eab308'; // Bright Gold/Yellow (Medium - clearly distinct from orange)
      if (sev === 'critical') pinColor = '#dc2626';     // Red (Critical)
      else if (sev === 'high') pinColor = '#ea580c';    // Orange (High)
      else if (sev === 'low') pinColor = '#0284c7';     // Blue (Low)

      const addrStr = (item.location && typeof item.location === 'object' && item.location.address)
        ? item.location.address
        : (typeof item.location === 'string' ? item.location : 'Municipal Zone');

      // 1. Radiant Hazard Aura Circle (visible in Heat Map & Combined views)
      const auraRadius = (sev === 'critical') ? 340 : ((sev === 'high') ? 280 : 220);
      const hazardCircle = L.circle([numLat, numLng], {
        radius: auraRadius,
        color: pinColor,
        weight: 2,
        opacity: 0.85,
        fillColor: pinColor,
        fillOpacity: 0.38
      });

      hazardCircle.bindTooltip(`
        <div style="font-family: inherit; font-size: 0.8rem; font-weight: 700; color: #0f172a; padding: 2px;">
          🔥 <strong>${escapeHtml(item.id)}</strong> • ${escapeHtml(item.category)}
          <div style="font-size: 0.72rem; color: ${pinColor}; font-weight: 800; margin-top: 2px;">
            ${sev.toUpperCase()} PRIORITY (${pScore}/100)
          </div>
          <div style="font-size: 0.7rem; color: #64748b;">📍 ${escapeHtml(addrStr)}</div>
        </div>
      `, { sticky: true });

      hazardCircle.on('click', () => openReviewModal(item.id));
      circlesLayerInstance.addLayer(hazardCircle);

      // 2. Interactive Numbered Priority Pin Marker
      const pinIcon = L.divIcon({
        className: 'admin-map-pin',
        html: `
          <div style="
            background: ${pinColor};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 2.5px solid #ffffff;
            box-shadow: 0 3px 10px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            cursor: pointer;
            transition: transform 0.15s ease;
          " title="${escapeHtml(item.id)}: ${escapeHtml(item.title)}">
            ${pScore}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([numLat, numLng], { icon: pinIcon });

      const popupHtml = `
        <div style="font-family: inherit; max-width: 260px; padding: 4px;">
          <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; margin-bottom: 2px;">
            ${escapeHtml(item.id)} • ${escapeHtml(item.category)}
          </div>
          <h4 style="font-size: 0.88rem; margin: 0 0 6px 0; color: #0f172a; line-height: 1.3;">
            ${escapeHtml(item.title)}
          </h4>
          <p style="font-size: 0.78rem; color: #475569; margin: 0 0 8px 0; line-height: 1.3;">
            📍 ${escapeHtml(addrStr)}
          </p>
          <div style="display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;">
            <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; background: #f1f5f9; color: #334155;">
              ${escapeHtml(item.status)}
            </span>
            <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; background: ${pinColor}20; color: ${pinColor};">
              Priority: ${pScore}/100
            </span>
          </div>
          <button type="button" class="btn btn-sm btn-primary admin-map-inspect-btn" data-id="${escapeHtml(item.id)}" style="width: 100%; padding: 6px 10px; font-size: 0.8rem; cursor: pointer; border-radius: 6px; background-color: var(--primary-teal, #0f766e); color: #fff; border: none; font-weight: 600;">
            Review Complaint &rarr;
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const btn = document.querySelector(`.admin-map-inspect-btn[data-id="${item.id}"]`);
        if (btn) btn.addEventListener('click', () => openReviewModal(item.id));
      });

      markersLayerInstance.addLayer(marker);
    });

    // 3. High-Visibility Heatmap Density Layer
    if (typeof L.heatLayer === 'function' && heatPoints.length > 0) {
      heatLayerInstance = L.heatLayer(heatPoints, {
        minOpacity: 0.65,
        radius: 45,
        blur: 24,
        max: 0.85,
        gradient: {
          0.2: '#0284c7', // Low density (Sky Blue)
          0.4: '#10b981', // Moderate (Emerald Green)
          0.6: '#f59e0b', // Elevated (Amber Yellow)
          0.75: '#ea580c', // High (Orange)
          1.0: '#dc2626'  // Critical Hotspot (Red)
        }
      });
    }

    applyMapMode();

    // Smart Camera Framing: Center on Municipal Core when viewing All Areas
    if (selectedLoc === 'all') {
      mapInstance.setView(MUNICIPAL_CENTER, MUNICIPAL_DEFAULT_ZOOM);
    } else if (bounds.length > 0) {
      if (bounds.length === 1) {
        mapInstance.setView(bounds[0], 14);
      } else {
        mapInstance.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
      }
    }

    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 200);
  }

  // Helper to refresh all dashboard modules
  function refreshAllDashboardViews() {
    updateStatistics();
    renderComplaints();
    renderActivityTimeline();
    populateLocalityFilters();
    renderMapLayers();
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
      const uid = u.id || u._id;
      tr.setAttribute('data-uid', uid);
      const isFlagged = u.status === 'Flagged';

      tr.innerHTML = `
        <td><span class="tbl-id-badge">${escapeHtml(uid)}</span></td>
        <td style="font-weight: 600; color: var(--navy-blue);">${escapeHtml(u.name)}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(u.email)}</td>
        <td style="text-align: center; font-weight: 700;">${u.reported !== undefined ? u.reported : 0}</td>
        <td style="text-align: center; font-weight: 700; color: #065f46;">${u.resolved !== undefined ? u.resolved : 0}</td>
        <td style="text-align: center;">
          <span style="font-weight: 700; color: var(--primary-teal); background-color: var(--primary-teal-light); padding: 0.2rem 0.6rem; border-radius: var(--radius-pill);">
            ${u.tokens !== undefined ? u.tokens : (u.rewardTokens || 0)} tokens
          </span>
        </td>
        <td style="text-align: center;">
          <span class="verify-badge ${isFlagged ? 'verify-rejected' : 'verify-verified'}">
            ${isFlagged ? '⚠️ Flagged' : '✓ Active'}
          </span>
          ${isFlagged && u.flaggedReason ? `<span style="display: block; font-size: 0.68rem; color: #991b1b; margin-top: 2px;" title="${escapeHtml(u.flaggedReason)}">${escapeHtml(u.flaggedReason.length > 20 ? u.flaggedReason.slice(0, 20) + '...' : u.flaggedReason)}</span>` : ''}
        </td>
        <td style="text-align: center;">
          ${isFlagged ? `
            <button type="button" class="btn btn-sm btn-unflag-citizen-row" data-uid="${escapeHtml(uid)}" style="font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; color: #065f46; border: 1px solid #a7f3d0; background: #ecfdf5; cursor: pointer;">
              ✓ Restore
            </button>
          ` : `
            <button type="button" class="btn btn-sm btn-flag-citizen-row" data-uid="${escapeHtml(uid)}" style="font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; color: #b91c1c; border: 1px solid #fca5a5; background: #fff1f2; cursor: pointer;">
              ⚠️ Flag
            </button>
          `}
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
  const getStatusBadgeClass = window.getStatusClass || ((s) => s === 'In Progress' ? 'status-progress' : (s === 'Resolved' ? 'status-resolved' : 'status-reported'));
  const getSeverityBadgeClass = window.getSeverityClass || ((s) => `severity-${(s || 'medium').toLowerCase()}`);
  const escapeHtml = window.escapeHtml || ((str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '');

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
      case 'Needs Inspection':
        return 'verify-inspection';
      case 'Insufficient Evidence':
        return 'verify-insufficient';
      case 'Pending':
        return 'verify-pending';
      case 'Rejected':
        return 'verify-rejected';
      default:
        return 'verify-pending';
    }
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
      currentPage = 1;
      renderComplaints();
    });
  }

  // Clear search input button
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchClearBtn.classList.remove('visible');
      currentPage = 1;
      renderComplaints();
    });
  }

  // Filter dropdown listeners (Category, Status, Severity, Priority, Danger, Verification, Locality, Date, Sort, Unreviewed)
  [filterCategory, filterStatus, filterSeverity, filterPriority, filterDanger, filterVerification, filterLocality, filterDate, filterSort, filterUnreviewed].forEach(dropdown => {
    if (dropdown) {
      dropdown.addEventListener('change', () => {
        currentPage = 1;
        renderComplaints();
      });
    }
  });

  // Clear all filters function
  function resetAllFilters() {
    currentPage = 1;
    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.classList.remove('visible');
    if (filterCategory) filterCategory.value = 'all';
    if (filterStatus) filterStatus.value = 'all';
    if (filterSeverity) filterSeverity.value = 'all';
    if (filterPriority) filterPriority.value = 'all';
    if (filterDanger) filterDanger.value = 'all';
    if (filterVerification) filterVerification.value = 'all';
    if (filterLocality) filterLocality.value = 'all';
    if (filterDate) filterDate.value = 'all';
    if (filterSort) filterSort.value = 'latest';
    if (filterUnreviewed) filterUnreviewed.value = 'all';
    renderComplaints();
  }

  if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', resetAllFilters);
  if (emptyResetFiltersBtn) emptyResetFiltersBtn.addEventListener('click', resetAllFilters);

  // Pagination Toolbar Listeners (Next, Previous, Page Size)
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      pageSize = parseInt(e.target.value, 10) || 10;
      currentPage = 1;
      renderComplaints();
    });
  }

  if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderComplaints();
      }
    });
  }

  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      const filtered = filterComplaints();
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      if (currentPage < totalPages) {
        currentPage++;
        renderComplaints();
      }
    });
  }

  // Heatmap Toolbar Listeners
  if (btnViewHeatmap) {
    btnViewHeatmap.addEventListener('click', () => {
      currentMapMode = 'heat';
      applyMapMode();
    });
  }
  if (btnViewPins) {
    btnViewPins.addEventListener('click', () => {
      currentMapMode = 'pins';
      applyMapMode();
    });
  }
  if (btnViewBoth) {
    btnViewBoth.addEventListener('click', () => {
      currentMapMode = 'both';
      applyMapMode();
    });
  }
  if (mapLocalityFilter) {
    mapLocalityFilter.addEventListener('change', () => {
      renderMapLayers();
    });
  }
  if (btnResetMapView) {
    btnResetMapView.addEventListener('click', () => {
      if (mapLocalityFilter) mapLocalityFilter.value = 'all';
      renderMapLayers();
    });
  }

  // Globally accessible review modal trigger
  window.adminReviewComplaint = openReviewModal;

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

  // Citizen table Flag / Restore event delegation
  if (usersTableBody) {
    usersTableBody.addEventListener('click', async (e) => {
      const flagBtn = e.target.closest('.btn-flag-citizen-row');
      if (flagBtn) {
        const uid = flagBtn.getAttribute('data-uid');
        const user = sampleUsers.find(u => (u.id || u._id) === uid);
        if (!user) return;
        const reason = await openActionModal({
          icon: '🚩',
          title: 'Flag Citizen Account',
          subtitle: `Citizen: ${user.name} (${user.email || uid})`,
          label: 'Enter penalty reason for false / spam reporting:',
          defaultValue: "False or misleading hazard complaint submitted",
          placeholder: 'Specify reason for account violation penalty...',
          chips: [
            "False or fake hazard photograph submitted",
            "Duplicate spam report submissions",
            "Offensive or abusive complaint content"
          ],
          confirmText: 'Flag & Penalize (-10 Tokens)',
          confirmClass: 'btn-danger',
          requireInput: true,
          minLength: 5
        });
        if (reason === null) return;
        flagBtn.disabled = true;
        try {
          const res = await window.civicFetch(`/api/admin/users/${uid}/flag`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'Flagged', reason: reason.trim() || 'Flagged by Administrator', penaltyTokens: 10 })
          });
          if (res && res.ok) {
            user.status = 'Flagged';
            user.flaggedReason = reason;
            user.tokens = Math.max(0, (user.tokens || 10) - 10);
            addActivity(`Admin penalized citizen ${user.name} (-10 tokens) and flagged account`, 'reject');
            renderUsers();
          } else {
            alert('Could not flag citizen on server.');
          }
        } catch (err) {
          alert('Error flagging user: ' + err.message);
        } finally {
          if (flagBtn) flagBtn.disabled = false;
        }
        return;
      }

      const unflagBtn = e.target.closest('.btn-unflag-citizen-row');
      if (unflagBtn) {
        const uid = unflagBtn.getAttribute('data-uid');
        const user = sampleUsers.find(u => (u.id || u._id) === uid);
        if (!user) return;
        const confirmed = await openConfirmModal({
          icon: '🔄',
          title: 'Restore Citizen Account',
          message: `Restore citizen "${user.name}" to Active status? Their penalties will be cleared.`,
          confirmText: 'Restore to Active',
          confirmClass: 'btn-success'
        });
        if (!confirmed) return;
        unflagBtn.disabled = true;
        try {
          const res = await window.civicFetch(`/api/admin/users/${uid}/flag`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'Active', reason: '' })
          });
          if (res && res.ok) {
            user.status = 'Active';
            user.flaggedReason = '';
            addActivity(`Admin restored citizen ${user.name} to Active status`, 'verify');
            renderUsers();
            alert(`Citizen ${user.name} has been restored to Active status.`);
          } else {
            alert('Could not restore citizen on server.');
          }
        } catch (err) {
          alert('Error restoring user: ' + err.message);
        } finally {
          if (unflagBtn) unflagBtn.disabled = false;
        }
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

    // 2. Auth verified: Reveal admin dashboard smoothly
    document.body.classList.remove('auth-pending-guard');

    // Display admin user name in header/profile if element exists
    const adminNameEl = document.querySelector('.admin-profile-name') || document.querySelector('.admin-user-title');
    if (adminNameEl) {
      adminNameEl.textContent = adminUser.name;
    }

    // Hook up logout button in header
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.CivicAuth.logout();
      });
    }

    try {
      console.log('[Admin Dashboard]: Fetching tickets from Express API /api/admin/complaints ...');
      const response = await window.civicFetch('/api/admin/complaints');
      if (response && response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          complaints = result.data;
          console.log(`[Admin Dashboard]: Loaded ${complaints.length} tickets from ${result.source || 'MongoDB Atlas'}.`);
        } else {
          complaints = [];
        }
      } else {
        console.warn('[Admin Dashboard]: Could not load complaints, status:', response ? response.status : 'No response');
        complaints = [];
      }

      // Also load registered users from persistent backend
      const statsResponse = await window.civicFetch('/api/admin/dashboard');
      if (statsResponse && statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.users && Array.isArray(statsData.users)) {
          sampleUsers = statsData.users;
        }
      }
    } catch (err) {
      console.warn('[Admin Dashboard]: Backend API unreachable:', err.message);
      complaints = [];
    } finally {
      refreshAllDashboardViews();
      renderUsers();
    }
  }

  // Initialize
  loadAdminComplaints();
  renderUsers();

  // Live complaint registration event listener from real-time notifications engine
  window.addEventListener('civic:new-complaint', (event) => {
    if (!event.detail || !event.detail.complaint) return;
    const newComplaint = event.detail.complaint;

    // Check if complaint already exists in memory
    const existingIdx = complaints.findIndex(c => c.id === newComplaint.id);
    if (existingIdx !== -1) {
      complaints[existingIdx] = { ...complaints[existingIdx], ...newComplaint };
    } else {
      complaints.unshift(newComplaint);
    }

    addActivity(`New citizen complaint ${newComplaint.id} registered: "${newComplaint.title}"`, 'progress');
    refreshAllDashboardViews();

    // Pulse highlight row in complaints table
    setTimeout(() => {
      const row = document.querySelector(`tr[data-id="${newComplaint.id}"]`);
      if (row) {
        row.classList.add('civic-highlight-pulse');
        setTimeout(() => row.classList.remove('civic-highlight-pulse'), 3500);
      }
    }, 200);
  });

  // Live reminder alert listener
  window.addEventListener('civic:reminder-alert', (event) => {
    if (!event.detail || !event.detail.complaint) return;
    const alertComplaint = event.detail.complaint;
    const existing = complaints.find(c => c.id === alertComplaint.id);
    if (existing) {
      existing.remindersCount = (existing.remindersCount || 0) + 1;
      existing.lastReminderAt = new Date().toISOString();
      if (event.detail.notification && event.detail.notification.data) {
        existing.lastReminderReason = event.detail.notification.data.reason || existing.lastReminderReason;
      }
    }
    renderAlertsQueue(complaints);
    renderComplaints();
  });

  // Expose global hook for notification click integration
  window.adminReviewComplaint = (id) => openReviewModal(id);

  console.log('Civic Connect Municipal Admin Dashboard Initialized with Role-Based Access Control.');
});
