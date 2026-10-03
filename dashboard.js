/**
 * ========================================================
 * CIVIC CONNECT - USER DASHBOARD CONTROLLER (dashboard.js)
 * Stage 4: Personal Citizen Dashboard & Rewards Engine
 * ========================================================
 * 
 * As a beginner in vibe coding, this file teaches you how:
 * 1. User complaint data is maintained in an array of objects.
 * 2. Summary stats (Total, Active, Resolved, Tokens) are dynamically calculated.
 * 3. A 4-stage visual progress tracker reflects real ticket milestones.
 * 4. Civic reward levels and progress bars are computed mathematically.
 * 5. Complaint filtering and modal details render on-the-fly.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ========================================================
   * 1. CITIZEN COMPLAINTS DATASET (Live /api/complaints/mine)
   * ========================================================
   */
  let myComplaints = [
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
      reportedBy: "Civic User",
      verified: true,
      resolved: false,
      verificationInfo: "Inspection assigned to Ward 28 Road Works Cell on 29 Sep 2026.",
      resolutionInfo: "Pending contractor dispatch following site verification."
    },
    {
      id: "CC-0998",
      title: "Caved-in stormwater drain manhole lid",
      category: "Road/Pothole",
      description: "Reinforced concrete cover cracked and collapsed inward into the sewer main. Hazard barricaded and replaced with heavy-duty cast iron slab.",
      location: "Market Road, Gorakhpur, Uttar Pradesh",
      date: "18 September 2026",
      severity: "Critical",
      status: "Resolved",
      supporters: 42,
      reportedBy: "Civic User",
      verified: true,
      resolved: true,
      verificationInfo: "Verified by Junior Engineer on 19 Sep 2026.",
      resolutionInfo: "Resolved on 22 Sep 2026: Heavy-duty cast iron slab installed and road surface leveled."
    },
    {
      id: "CC-0995",
      title: "Broken streetlights along school corridor",
      category: "Street Light",
      description: "Four consecutive streetlights out along the school zone corridor. Night-time visibility severely reduced for pedestrians.",
      location: "Civil Lines, Gorakhpur, Uttar Pradesh",
      date: "12 September 2026",
      severity: "Medium",
      status: "Resolved",
      supporters: 29,
      reportedBy: "Civic User",
      verified: true,
      resolved: true,
      verificationInfo: "Inspected by Electrical Maintenance Division on 13 Sep 2026.",
      resolutionInfo: "Resolved on 15 Sep 2026: LED fixtures replaced and wiring repaired."
    },
    {
      id: "CC-1004",
      title: "Severe waterlogging at railway subway entrance",
      category: "Waterlogging",
      description: "Subway drainage sump pump motor burned out, leading to 1.5 feet of stagnant rainwater blocking two-wheelers and pedestrians.",
      location: "Station Link Road, Gorakhpur, Uttar Pradesh",
      date: "01 October 2026",
      severity: "High",
      status: "In Progress",
      supporters: 38,
      reportedBy: "Civic User",
      verified: true,
      resolved: false,
      verificationInfo: "Verified by Municipal Drainage Cell on 02 Oct 2026.",
      resolutionInfo: "Pump replacement work order issued. Repair crew actively working on-site."
    },
    {
      id: "CC-0989",
      title: "Overflowing garbage bin blocking pedestrian walkway",
      category: "Garbage/Waste",
      description: "Community waste bin overflowing for four consecutive days, causing foul smell and health hazard near the neighborhood park.",
      location: "Shastri Nagar, Gorakhpur, Uttar Pradesh",
      date: "05 September 2026",
      severity: "Low",
      status: "Resolved",
      supporters: 19,
      reportedBy: "Civic User",
      verified: true,
      resolved: true,
      verificationInfo: "Sanitation Inspector conducted site check on 06 Sep 2026.",
      resolutionInfo: "Resolved on 07 Sep 2026: Solid waste cleared and daily pickup schedule restored."
    },
    {
      id: "CC-1007",
      title: "Damaged pedestrian crosswalk & missing speed breaker sign",
      category: "Traffic",
      description: "Zebra crossing paint completely worn away and speed breaker signs missing near the primary health center entrance.",
      location: "Medical College Road, Gorakhpur, Uttar Pradesh",
      date: "03 October 2026",
      severity: "Medium",
      status: "Reported",
      supporters: 7,
      reportedBy: "Civic User",
      verified: false,
      resolved: false,
      verificationInfo: "Queued for preliminary ward intake review.",
      resolutionInfo: "Awaiting municipal inspection visit."
    }
  ];

  /* ========================================================
   * 2. RECENT ACTIVITY TIMELINE DATASET
   * ========================================================
   */
  const recentActivities = [
    {
      title: "Complaint CC-1007 reported (Zebra crossing & signage)",
      date: "03 Oct 2026",
      reward: "+1 token",
      type: "report"
    },
    {
      title: "Complaint CC-1004 work order dispatched to site team",
      date: "02 Oct 2026",
      reward: null,
      type: "progress"
    },
    {
      title: "Complaint CC-1001 verified by Ward 28 Engineering Cell",
      date: "29 Sep 2026",
      reward: "+2 tokens",
      type: "verify"
    },
    {
      title: "Complaint CC-0998 resolved: Drainage slab replaced",
      date: "22 Sep 2026",
      reward: "+3 tokens",
      type: "resolve"
    },
    {
      title: "Complaint CC-0995 resolved: Streetlights operational",
      date: "15 Sep 2026",
      reward: "+3 tokens",
      type: "resolve"
    },
    {
      title: "Complaint CC-0989 resolved: Municipal garbage cleared",
      date: "07 Sep 2026",
      reward: "+3 tokens",
      type: "resolve"
    }
  ];

  // Stage sequence for status tracking
  const STATUS_STAGES = [
    "Reported",
    "Under Verification",
    "In Progress",
    "Resolved"
  ];


  /* ========================================================
   * 3. DOM ELEMENT REFERENCES
   * ========================================================
   */
  const statTotalEl = document.getElementById('statTotalComplaints');
  const statActiveEl = document.getElementById('statActiveComplaints');
  const statResolvedEl = document.getElementById('statResolvedComplaints');
  const statTokensEl = document.getElementById('statRewardTokens');

  const userComplaintsList = document.getElementById('userComplaintsList');
  const emptyComplaintsState = document.getElementById('emptyComplaintsState');
  const filterTabs = document.querySelectorAll('.filter-tab-btn');

  const currentLevelNameEl = document.getElementById('currentLevelName');
  const currentTokensDisplayEl = document.getElementById('currentTokensDisplay');
  const levelProgressBar = document.getElementById('levelProgressBar');
  const nextLevelGoalText = document.getElementById('nextLevelGoalText');
  const activityTimelineList = document.getElementById('activityTimelineList');

  const complaintDetailModal = document.getElementById('complaintDetailModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const modalDetailBody = document.getElementById('modalDetailBody');


  /* ========================================================
   * 4. DYNAMIC CALCULATIONS (SUMMARY STATS & REWARDS)
   * Calculates Total, Active, Resolved, and Tokens from data
   * ========================================================
   */

  // 1. Calculate Reward Tokens: +1 Reported, +2 Verified, +3 Resolved
  function calculateTotalTokens(list) {
    return list.reduce((total, c) => {
      let tokens = 1; // Base token for reporting valid issue
      if (c.verified) tokens += 2; // +2 upon verification
      if (c.status === 'Resolved' || c.resolved) tokens += 3; // +3 upon resolution
      return total + tokens;
    }, 0);
  }

  // 2. Calculate Tier / Level Information
  function calculateLevelInfo(tokenCount) {
    // Level 1: 0 - 10
    // Level 2: 11 - 25
    // Level 3: 26 - 50
    // Level 4: 51+
    if (tokenCount <= 10) {
      const min = 0;
      const max = 10;
      const percent = Math.min(100, Math.round(((tokenCount - min) / (max - min)) * 100));
      return {
        levelNumber: 1,
        levelName: "Level 1 — Civic Starter",
        currentTokens: tokenCount,
        nextLevel: "Level 2 — Community Helper",
        nextThreshold: 11,
        tokensNeeded: 11 - tokenCount,
        progressPercent: percent
      };
    } else if (tokenCount <= 25) {
      const min = 11;
      const max = 25;
      const percent = Math.min(100, Math.round(((tokenCount - min) / (max - min)) * 100));
      return {
        levelNumber: 2,
        levelName: "Level 2 — Community Helper",
        currentTokens: tokenCount,
        nextLevel: "Level 3 — Civic Champion",
        nextThreshold: 26,
        tokensNeeded: 26 - tokenCount,
        progressPercent: Math.max(15, percent)
      };
    } else if (tokenCount <= 50) {
      const min = 26;
      const max = 50;
      const percent = Math.min(100, Math.round(((tokenCount - min) / (max - min)) * 100));
      return {
        levelNumber: 3,
        levelName: "Level 3 — Civic Champion",
        currentTokens: tokenCount,
        nextLevel: "Level 4 — Community Leader",
        nextThreshold: 51,
        tokensNeeded: 51 - tokenCount,
        progressPercent: percent
      };
    } else {
      return {
        levelNumber: 4,
        levelName: "Level 4 — Community Leader",
        currentTokens: tokenCount,
        nextLevel: "Maximum Tier Reached!",
        nextThreshold: 51,
        tokensNeeded: 0,
        progressPercent: 100
      };
    }
  }

  // Update Summary Statistics in DOM
  function updateSummaryDashboard() {
    const totalCount = myComplaints.length;
    const activeCount = myComplaints.filter(c => c.status !== 'Resolved').length;
    const resolvedCount = myComplaints.filter(c => c.status === 'Resolved').length;
    const totalTokens = calculateTotalTokens(myComplaints);

    if (statTotalEl) statTotalEl.textContent = totalCount;
    if (statActiveEl) statActiveEl.textContent = activeCount;
    if (statResolvedEl) statResolvedEl.textContent = resolvedCount;
    if (statTokensEl) statTokensEl.textContent = totalTokens;

    // Update Level Progress Section
    const levelInfo = calculateLevelInfo(totalTokens);
    if (currentLevelNameEl) currentLevelNameEl.textContent = levelInfo.levelName;
    if (currentTokensDisplayEl) currentTokensDisplayEl.textContent = `${totalTokens} tokens earned`;
    if (levelProgressBar) {
      levelProgressBar.style.width = `${levelInfo.progressPercent}%`;
      levelProgressBar.setAttribute('aria-valuenow', levelInfo.progressPercent);
    }
    if (nextLevelGoalText) {
      if (levelInfo.tokensNeeded > 0) {
        nextLevelGoalText.textContent = `${levelInfo.tokensNeeded} more token(s) needed to unlock ${levelInfo.nextLevel} (${levelInfo.nextThreshold} tokens)`;
      } else {
        nextLevelGoalText.textContent = `Honored Civic Community Leader status achieved!`;
      }
    }

    // Highlight active tier in all tiers list
    document.querySelectorAll('.tier-item-row').forEach(row => {
      const tierLevel = parseInt(row.getAttribute('data-level'), 10);
      if (tierLevel === levelInfo.levelNumber) {
        row.classList.add('current-tier');
      } else {
        row.classList.remove('current-tier');
      }
    });
  }


  /* ========================================================
   * 5. STATUS TRACKER GENERATOR (HTML Stepper)
   * Builds the 4-stage visual progress tracker
   * ========================================================
   */
  function generateStatusTrackerHtml(currentStatus) {
    const currentIndex = STATUS_STAGES.indexOf(currentStatus);

    return `
      <div class="status-tracker-box">
        <span class="tracker-label-caption">Resolution Milestones</span>
        <div class="tracker-stepper-row">
          ${STATUS_STAGES.map((stageName, index) => {
            const isCompleted = index < currentIndex || (index === currentIndex && currentStatus === 'Resolved');
            const isActive = index === currentIndex && currentStatus !== 'Resolved';
            const isPending = index > currentIndex;

            let stepClass = 'tracker-step-item';
            let iconContent = index + 1;

            if (isCompleted) {
              stepClass += ' completed';
              iconContent = '✓';
            } else if (isActive) {
              stepClass += ' active';
              iconContent = '●';
            } else {
              stepClass += ' pending';
              iconContent = '○';
            }

            const connectorHtml = index < STATUS_STAGES.length - 1
              ? `<div class="tracker-line-segment ${index < currentIndex ? 'completed' : ''}"></div>`
              : '';

            return `
              <div class="${stepClass}">
                <div class="step-node-bubble">${iconContent}</div>
                <span class="step-title-text">${stageName}</span>
              </div>
              ${connectorHtml}
            `;
          }).join('')}
        </div>
      </div>
    `;
  }


  /* ========================================================
   * 6. RENDER USER COMPLAINT CARDS & FILTERING
   * ========================================================
   */
  function renderUserComplaints(filterType = 'all') {
    if (!userComplaintsList) return;

    userComplaintsList.innerHTML = '';

    const filtered = myComplaints.filter(c => {
      if (filterType === 'active') return c.status !== 'Resolved';
      if (filterType === 'resolved') return c.status === 'Resolved';
      return true; // 'all'
    });

    if (filtered.length === 0) {
      if (emptyComplaintsState) emptyComplaintsState.style.display = 'block';
      return;
    }

    if (emptyComplaintsState) emptyComplaintsState.style.display = 'none';

    filtered.forEach(item => {
      const card = document.createElement('article');
      card.className = 'my-complaint-card';
      card.setAttribute('data-id', item.id);

      // Status & Severity CSS classes
      const statusCssClass = getStatusClass(item.status);
      const severityCssClass = getSeverityClass(item.severity);

      card.innerHTML = `
        <!-- Card Top Row -->
        <div class="card-top-row">
          <span class="card-id-tag">${escapeHtml(item.id)}</span>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="card-category-badge" style="margin-bottom: 0;">${escapeHtml(item.category)}</span>
            <span class="severity-badge ${severityCssClass}">
              ${escapeHtml(item.severity)}
            </span>
            <span class="status-badge ${statusCssClass}">
              <span class="badge-dot"></span>
              ${escapeHtml(item.status)}
            </span>
          </div>
        </div>

        <!-- Problem Title -->
        <h3 class="card-title-heading">${escapeHtml(item.title)}</h3>

        <!-- Meta Line: Location & Date -->
        <div class="card-meta-line">
          <div class="meta-line-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${escapeHtml(item.location)}</span>
          </div>
          <div class="meta-line-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Reported on ${escapeHtml(item.date)}</span>
          </div>
        </div>

        <!-- Visual Progress Tracker -->
        ${generateStatusTrackerHtml(item.status)}

        <!-- Bottom Actions -->
        <div class="card-bottom-actions">
          <span class="card-supporters-badge">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <strong>${item.supporters}</strong> citizen supporters
          </span>

          <button type="button" class="btn-view-details" data-id="${item.id}" aria-label="View details for ${item.id}">
            <span>View Details</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      `;

      userComplaintsList.appendChild(card);
    });
  }


  /* ========================================================
   * 7. RENDER RECENT ACTIVITY TIMELINE
   * ========================================================
   */
  function renderActivityTimeline() {
    if (!activityTimelineList) return;

    activityTimelineList.innerHTML = '';

    recentActivities.forEach(act => {
      const item = document.createElement('li');
      item.className = 'activity-item';

      item.innerHTML = `
        <span class="activity-node-bullet" aria-hidden="true"></span>
        <span class="activity-text-title">${escapeHtml(act.title)}</span>
        <div class="activity-meta-row">
          <span>${escapeHtml(act.date)}</span>
          ${act.reward ? `<span class="activity-reward-pill">${escapeHtml(act.reward)}</span>` : ''}
        </div>
      `;

      activityTimelineList.appendChild(item);
    });
  }


  /* ========================================================
   * 8. COMPLAINT DETAILS MODAL CONTROLLER
   * ========================================================
   */
  function openComplaintModal(id) {
    const item = myComplaints.find(c => c.id === id);
    if (!item || !complaintDetailModal || !modalDetailBody) return;

    const statusCssClass = getStatusClass(item.status);
    const severityCssClass = getSeverityClass(item.severity);

    modalDetailBody.innerHTML = `
      <!-- Header Meta -->
      <div class="detail-header-meta">
        <span class="detail-complaint-id">${escapeHtml(item.id)}</span>
        <div class="detail-badges-group">
          <span class="severity-badge ${severityCssClass}">Severity: ${escapeHtml(item.severity)}</span>
          <span class="status-badge ${statusCssClass}">
            <span class="badge-dot"></span>
            ${escapeHtml(item.status)}
          </span>
        </div>
      </div>

      <!-- Problem Title -->
      <h2 class="detail-title">${escapeHtml(item.title)}</h2>

      <!-- Description -->
      <div class="detail-section">
        <span class="detail-label">Full Problem Description</span>
        <div class="detail-text">${escapeHtml(item.description)}</div>
      </div>

      <!-- Visual Progress Tracker in Modal -->
      ${generateStatusTrackerHtml(item.status)}

      <!-- Details Metadata Grid -->
      <div class="detail-info-grid">
        <div class="detail-info-cell">
          <span class="detail-label">Category</span>
          <span class="detail-info-cell-value">${escapeHtml(item.category)}</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">Location / Ward</span>
          <span class="detail-info-cell-value">${escapeHtml(item.location)}</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">Date Reported</span>
          <span class="detail-info-cell-value">${escapeHtml(item.date)}</span>
        </div>

        <div class="detail-info-cell">
          <span class="detail-label">Community Support</span>
          <span class="detail-info-cell-value">${item.supporters} citizen supporters</span>
        </div>
      </div>

      <!-- Verification Information -->
      <div class="modal-verification-box">
        <strong>Municipal Verification Record</strong>
        <p style="color: var(--text-body); margin: 0;">${escapeHtml(item.verificationInfo)}</p>
      </div>

      <!-- Resolution Information (if resolved or pending) -->
      <div class="modal-verification-box" style="${item.resolved ? 'background-color: #ecfdf5; border-color: #a7f3d0;' : ''}">
        <strong style="${item.resolved ? 'color: #065f46;' : ''}">Work Resolution Status</strong>
        <p style="color: var(--text-body); margin: 0;">${escapeHtml(item.resolutionInfo)}</p>
      </div>
    `;

    complaintDetailModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeComplaintModal() {
    if (!complaintDetailModal) return;
    complaintDetailModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }


  /* ========================================================
   * 9. BADGE HELPER FUNCTIONS
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
   * 10. EVENT LISTENERS
   * ========================================================
   */

  // Filter Tabs click handler (All, Active, Resolved)
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filterValue = tab.getAttribute('data-filter');
      renderUserComplaints(filterValue);
    });
  });

  // Event delegation on complaints list for View Details buttons
  if (userComplaintsList) {
    userComplaintsList.addEventListener('click', (e) => {
      const detailsBtn = e.target.closest('.btn-view-details');
      if (detailsBtn) {
        const id = detailsBtn.getAttribute('data-id');
        if (id) openComplaintModal(id);
      }
    });
  }

  // Modal close buttons
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeComplaintModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeComplaintModal);

  // Close modal when clicking backdrop
  if (complaintDetailModal) {
    complaintDetailModal.addEventListener('click', (e) => {
      if (e.target === complaintDetailModal) closeComplaintModal();
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && complaintDetailModal && !complaintDetailModal.hasAttribute('hidden')) {
      closeComplaintModal();
    }
  });


  /* ========================================================
   * 11. INITIALIZATION ON PAGE LOAD (Stage 9 Auth Protection)
   * ========================================================
   */
  async function initUserDashboard() {
    // 1. Enforce authentication (redirects to login.html if not logged in)
    const user = await window.CivicAuth.requireLogin();
    if (!user) return;

    // 2. Personalize Citizen Header with Real Authenticated Details
    const avatarEl = document.querySelector('.user-avatar-circle');
    if (avatarEl) {
      const initials = user.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : 'CU';
      avatarEl.textContent = initials;
    }

    const titleEl = document.querySelector('.welcome-title');
    if (titleEl) {
      titleEl.textContent = `Welcome back, ${escapeHtml(user.name)}!`;
    }

    const subtitleEl = document.querySelector('.welcome-subtitle');
    if (subtitleEl) {
      subtitleEl.innerHTML = `Registered Citizen: <strong>${escapeHtml(user.email)}</strong> • Reward Tokens: <strong>${user.rewardTokens || 0}</strong>`;
    }

    // 3. Fetch real complaints for this authenticated citizen from backend
    try {
      const response = await fetch('/api/complaints/mine', { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          if (result.data.length > 0) {
            myComplaints = result.data.map(item => ({
              ...item,
              verified: item.verification === 'Verified',
              resolved: item.status === 'Resolved',
              verificationInfo: item.verification === 'Verified' ? 'Inspected by Municipal Public Works Cell.' : 'Under preliminary intake review.',
              resolutionInfo: item.resolutionNote || (item.status === 'Resolved' ? 'Remediation completed.' : 'In municipal operations queue.')
            }));
          } else {
            myComplaints = [];
          }
        }
      }
    } catch (err) {
      console.warn('[Dashboard]: Could not load live complaints from /api/complaints/mine:', err.message);
    }

    // 4. Update stats and views
    updateSummaryDashboard();
    renderUserComplaints('all');
    renderActivityTimeline();

    // Sync tokens from user profile
    if (statTokensEl && typeof user.rewardTokens === 'number') {
      statTokensEl.textContent = user.rewardTokens;
      const levelInfo = calculateLevelInfo(user.rewardTokens);
      if (currentLevelNameEl) currentLevelNameEl.textContent = levelInfo.levelName;
      if (currentTokensDisplayEl) currentTokensDisplayEl.textContent = `${user.rewardTokens} tokens earned`;
      if (levelProgressBar) {
        levelProgressBar.style.width = `${levelInfo.progressPercent}%`;
        levelProgressBar.setAttribute('aria-valuenow', levelInfo.progressPercent);
      }
    }

    console.log(`Civic Connect Dashboard Initialized for ${user.name} (${user.email}).`);
  }

  // Hook up logout button in dashboard header
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.CivicAuth.logout();
    });
  }

  initUserDashboard();
});
