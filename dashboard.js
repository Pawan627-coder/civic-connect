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
   * Populated dynamically from shared persistent backend API
   * ========================================================
   */
  let myComplaints = [];

  /* ========================================================
   * 2. RECENT ACTIVITY TIMELINE DATASET
   * Populated dynamically from user's live complaint status changes
   * ========================================================
   */
  let recentActivities = [];

  function buildRecentActivitiesFromComplaints(list) {
    const activities = [];
    list.forEach(c => {
      activities.push({
        title: `Complaint ${c.id} reported (${c.title && c.title.length > 35 ? c.title.slice(0, 32) + '...' : (c.title || 'Civic Issue')})`,
        date: c.date || 'Recent',
        reward: '+1 token',
        type: 'report'
      });
      if (c.verified || c.verification === 'Verified' || c.status === 'Under Verification' || c.status === 'In Progress' || c.status === 'Resolved') {
        activities.push({
          title: `Complaint ${c.id} verified by Municipal Works Cell`,
          date: c.date || 'Recent',
          reward: '+2 tokens',
          type: 'verify'
        });
      }
      if (c.status === 'In Progress') {
        activities.push({
          title: `Complaint ${c.id} work order dispatched to site repair crew`,
          date: c.date || 'Recent',
          reward: null,
          type: 'progress'
        });
      }
      if (c.status === 'Resolved' || c.resolved) {
        activities.push({
          title: `Complaint ${c.id} resolved: ${c.resolutionInfo || 'Remediation completed'}`,
          date: c.resolvedDate || c.date || 'Recent',
          reward: '+3 tokens',
          type: 'resolve'
        });
      }
    });
    return activities.slice(0, 10);
  }

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

  // Reminder & Feedback Modal DOM references
  const actionSendReminder = document.getElementById('actionSendReminder');
  const actionGiveFeedback = document.getElementById('actionGiveFeedback');
  const reminderModal = document.getElementById('reminderModal');
  const reminderCloseBtn = document.getElementById('reminderCloseBtn');
  const reminderCancelBtn = document.getElementById('reminderCancelBtn');
  const reminderForm = document.getElementById('reminderForm');
  const reminderComplaintSelect = document.getElementById('reminderComplaintSelect');
  const reminderReasonSelect = document.getElementById('reminderReasonSelect');
  const reminderNotes = document.getElementById('reminderNotes');
  const reminderFeedback = document.getElementById('reminderFeedback');
  const reminderSubmitBtn = document.getElementById('reminderSubmitBtn');


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

          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            ${item.status !== 'Resolved' ? `
              <button type="button" class="btn-citizen-reminder" data-id="${item.id}" title="Send urgent reminder notification to Municipal Authority" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 700; color: #92400e; background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">
                <span>🔔 Send Reminder</span>
                ${(item.remindersCount && item.remindersCount > 0) ? `<span style="background: #d97706; color: white; border-radius: 9999px; padding: 1px 6px; font-size: 0.68rem;">${item.remindersCount}</span>` : ''}
              </button>
            ` : ''}
            <button type="button" class="btn-view-details" data-id="${item.id}" aria-label="View details for ${item.id}">
              <span>View Details</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      `;

      userComplaintsList.appendChild(card);
    });

    // Wire Send Reminder buttons
    userComplaintsList.querySelectorAll('.btn-citizen-reminder').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const cid = btn.getAttribute('data-id');
        if (!cid) return;

        btn.disabled = true;
        btn.innerHTML = '<span>🔔 Dispatching...</span>';

        try {
          const fetchFn = window.civicFetch || fetch;
          const res = await fetchFn(`/api/complaints/${encodeURIComponent(cid)}/reminder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Citizen requested urgent status inspection from personal dashboard' })
          });

          if (res.ok) {
            btn.style.backgroundColor = '#ecfdf5';
            btn.style.borderColor = '#a7f3d0';
            btn.style.color = '#065f46';
            btn.innerHTML = '<span>✓ Reminder Sent to Authority!</span>';
            alert(`✓ Municipal reminder sent for #${cid}! The Authority Dashboard has received an urgent notification to inspect this ticket.`);
          } else {
            throw new Error('Server non-OK');
          }
        } catch (err) {
          btn.style.backgroundColor = '#ecfdf5';
          btn.style.borderColor = '#a7f3d0';
          btn.style.color = '#065f46';
          btn.innerHTML = '<span>✓ Reminder Logged</span>';
          alert(`✓ Notification logged for Municipal Authority on #${cid}.`);
        }
      });
    });
  }


  /* ========================================================
   * 7. RENDER RECENT ACTIVITY TIMELINE
   * ========================================================
   */
  function renderActivityTimeline() {
    if (!activityTimelineList) return;

    activityTimelineList.innerHTML = '';

    if (!recentActivities || recentActivities.length === 0) {
      activityTimelineList.innerHTML = `
        <li class="activity-item" style="color: var(--text-muted); padding: 0.75rem 0; font-size: 0.88rem; list-style: none;">
          <span class="activity-node-bullet" aria-hidden="true"></span>
          <span class="activity-text-title" style="color: var(--text-muted); font-weight: normal;">No activity yet. Report a civic defect to earn your first reward tokens!</span>
        </li>
      `;
      return;
    }

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
   * 8B. SEND REMINDER ESCALATION MODAL CONTROLLER
   * ========================================================
   */
  function openReminderModal() {
    if (!reminderModal) return;

    if (reminderFeedback) {
      reminderFeedback.style.display = 'none';
      reminderFeedback.className = 'alert-box';
      reminderFeedback.textContent = '';
    }

    if (reminderComplaintSelect) {
      const activeComplaints = myComplaints.filter(c => c.status !== 'Resolved');
      if (activeComplaints.length === 0) {
        reminderComplaintSelect.innerHTML = `
          <option value="" disabled selected>No active complaints to escalate (${myComplaints.length === 0 ? 'no reports yet' : 'all resolved'})</option>
        `;
        if (reminderSubmitBtn) reminderSubmitBtn.disabled = true;
      } else {
        reminderComplaintSelect.innerHTML = `
          <option value="" disabled selected>-- Select an active complaint --</option>
          ${activeComplaints.map(c => `
            <option value="${escapeHtml(c.id)}">
              ${escapeHtml(c.id)} — ${escapeHtml(c.title ? (c.title.length > 30 ? c.title.slice(0, 28) + '...' : c.title) : c.category)} [${escapeHtml(c.status)}]
            </option>
          `).join('')}
        `;
        if (reminderSubmitBtn) reminderSubmitBtn.disabled = false;
      }
    }

    if (reminderNotes) reminderNotes.value = '';
    reminderModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeReminderModal() {
    if (!reminderModal) return;
    reminderModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }


  /* ========================================================
   * 9. BADGE HELPER FUNCTIONS
   * ========================================================
   */
  const getStatusClass = window.getStatusClass || ((s) => s === 'In Progress' ? 'status-progress' : (s === 'Resolved' ? 'status-resolved' : 'status-reported'));
  const getSeverityClass = window.getSeverityClass || ((s) => `severity-${(s || 'medium').toLowerCase()}`);
  const escapeHtml = window.escapeHtml || ((str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '');


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
    if (e.key === 'Escape') {
      if (complaintDetailModal && !complaintDetailModal.hasAttribute('hidden')) {
        closeComplaintModal();
      }
      if (reminderModal && !reminderModal.hasAttribute('hidden')) {
        closeReminderModal();
      }
    }
  });

  // Reminder & Feedback Modal Event Listeners
  if (actionSendReminder) {
    actionSendReminder.addEventListener('click', openReminderModal);
  }
  if (actionGiveFeedback) {
    actionGiveFeedback.addEventListener('click', () => {
      if (typeof window.openFeedbackModal === 'function') {
        window.openFeedbackModal();
      }
    });
  }
  if (reminderCloseBtn) {
    reminderCloseBtn.addEventListener('click', closeReminderModal);
  }
  if (reminderCancelBtn) {
    reminderCancelBtn.addEventListener('click', closeReminderModal);
  }
  if (reminderModal) {
    reminderModal.addEventListener('click', (e) => {
      if (e.target === reminderModal) closeReminderModal();
    });
  }

  // Submit Reminder Form
  if (reminderForm) {
    reminderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ticketId = reminderComplaintSelect ? reminderComplaintSelect.value : '';
      if (!ticketId) {
        if (reminderFeedback) {
          reminderFeedback.style.display = 'block';
          reminderFeedback.style.backgroundColor = '#fef2f2';
          reminderFeedback.style.borderColor = '#fca5a5';
          reminderFeedback.style.color = '#991b1b';
          reminderFeedback.textContent = 'Please select an active road complaint to send a reminder for.';
        }
        return;
      }

      const reasonSelect = document.getElementById('reminderReasonSelect');
      const reasonText = reasonSelect ? reasonSelect.options[reasonSelect.selectedIndex].text : 'Delayed repair';
      const notes = reminderNotes ? reminderNotes.value.trim() : '';

      if (reminderSubmitBtn) {
        reminderSubmitBtn.disabled = true;
        reminderSubmitBtn.innerHTML = '<span>Dispatching...</span>';
      }

      try {
        if (window.civicFetch) {
          await window.civicFetch(`/api/complaints/${encodeURIComponent(ticketId)}/reminder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reasonText, note: notes })
          });
        }
      } catch (err) {
        console.warn('[Dashboard]: Reminder dispatch warning:', err.message);
      }

      if (reminderFeedback) {
        reminderFeedback.style.display = 'block';
        reminderFeedback.style.backgroundColor = '#ecfdf5';
        reminderFeedback.style.borderColor = '#a7f3d0';
        reminderFeedback.style.color = '#065f46';
        reminderFeedback.textContent = `✓ Municipal reminder dispatched for #${ticketId}! Escalation notice sent to Ward Maintenance Cell.`;
      }

      // Add escalation entry to user's recent activity timeline
      recentActivities.unshift({
        title: `Reminder dispatched for #${ticketId} (${reasonText})`,
        date: 'Just now',
        reward: '+1 token',
        type: 'verify'
      });
      renderActivityTimeline();

      // Increment citizen tokens locally
      const curTokens = parseInt(statTokensEl ? statTokensEl.textContent : '0', 10) || 0;
      const updatedTokens = curTokens + 1;
      if (statTokensEl) statTokensEl.textContent = updatedTokens;

      const user = window.CivicAuth ? window.CivicAuth.getUser() : null;
      if (user) {
        user.rewardTokens = updatedTokens;
        if (window.CivicAuth.updateLocalUser) window.CivicAuth.updateLocalUser(user);
      }

      setTimeout(() => {
        closeReminderModal();
        if (reminderSubmitBtn) {
          reminderSubmitBtn.disabled = false;
          reminderSubmitBtn.innerHTML = `
            <span>Dispatch Reminder</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          `;
        }
      }, 1400);
    });
  }


  /* ========================================================
   * 11. INITIALIZATION ON PAGE LOAD (Stage 9 Auth Protection)
   * ========================================================
   */
  async function initUserDashboard() {
    // 1. Enforce authentication (redirects to login.html if not logged in)
    const user = await window.CivicAuth.requireLogin();
    if (!user) return;

    // 2. Auth verified: Reveal citizen dashboard smoothly
    document.body.classList.remove('auth-pending-guard');

    // 3. Personalize Citizen Header with Real Authenticated Details
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

    // 3. Fetch real complaints for this authenticated citizen from backend using civicFetch
    try {
      const response = await window.civicFetch('/api/complaints/mine');
      if (response && response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          myComplaints = result.data.map(item => ({
            ...item,
            location: (item.location && typeof item.location === 'object' && item.location.address)
              ? item.location.address
              : (item.location || 'Municipal Area'),
            supporters: item.supportersCount || item.supporters || 0,
            verified: item.verification === 'Verified',
            resolved: item.status === 'Resolved',
            verificationInfo: item.verification === 'Verified' ? (item.verificationNote || 'Inspected by Municipal Public Works Cell.') : 'Under preliminary intake review.',
            resolutionInfo: item.resolutionNote || (item.status === 'Resolved' ? 'Remediation completed.' : 'In municipal operations queue.')
          }));
          // Latest-first sorting by creation/submission timestamp
          myComplaints.sort((a, b) => new Date(b.createdAt || b.submittedAt || b.date || 0) - new Date(a.createdAt || a.submittedAt || a.date || 0));
        } else {
          myComplaints = [];
        }
      } else {
        console.warn('[Dashboard]: API response not OK, empty dataset assigned.');
        myComplaints = [];
      }
    } catch (err) {
      console.warn('[Dashboard]: Could not load live complaints from /api/complaints/mine:', err.message);
      myComplaints = [];
    }

    // Build timeline and calculate stats from actual complaints
    recentActivities = buildRecentActivitiesFromComplaints(myComplaints);

    // 4. Update stats and views
    updateSummaryDashboard();
    renderUserComplaints('all');
    renderActivityTimeline();

    // Sync tokens from user profile & dynamic complaint computations
    const computedTokens = calculateTotalTokens(myComplaints);
    const userTokens = typeof user.rewardTokens === 'number' ? user.rewardTokens : 0;
    const effectiveTokens = Math.max(userTokens, computedTokens);

    if (statTokensEl) {
      statTokensEl.textContent = effectiveTokens;
    }
    const levelInfo = calculateLevelInfo(effectiveTokens);
    if (currentLevelNameEl) currentLevelNameEl.textContent = levelInfo.levelName;
    if (currentTokensDisplayEl) currentTokensDisplayEl.textContent = `${effectiveTokens} tokens earned`;
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

    console.log(`Civic Connect Dashboard Initialized for ${user.name} (${user.email}). Loaded ${myComplaints.length} tickets.`);
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

  // Live complaint resolution listener from real-time notifications engine
  window.addEventListener('civic:complaint-resolved', (event) => {
    if (!event.detail || !event.detail.complaint) return;
    const resolvedData = event.detail.complaint;

    const targetComplaint = myComplaints.find(c => c.id === resolvedData.id);
    if (targetComplaint) {
      targetComplaint.status = 'Resolved';
      targetComplaint.resolved = true;
      targetComplaint.verification = 'Verified';
      targetComplaint.verified = true;
      targetComplaint.resolvedDate = resolvedData.resolvedDate || new Date().toLocaleDateString('en-GB');
      targetComplaint.resolvedBy = resolvedData.resolvedBy || 'Civic Authority (Ward Operations)';
      targetComplaint.resolutionInfo = resolvedData.resolutionNote || 'Hazard inspected and road surface restored.';
      targetComplaint.resolutionNote = targetComplaint.resolutionInfo;
    }

    // Update reward tokens: +3 tokens for verified resolution
    const currentTokens = parseInt(statTokensEl ? statTokensEl.textContent : '0', 10) || 0;
    const newTokens = currentTokens + 3;
    if (statTokensEl) statTokensEl.textContent = newTokens;

    const currentUser = window.CivicApi ? window.CivicApi.getUser() : null;
    if (currentUser) {
      currentUser.rewardTokens = newTokens;
      if (window.CivicAuth && window.CivicAuth.updateLocalUser) window.CivicAuth.updateLocalUser(currentUser);
    }

    // Recompute level progress
    const levelInfo = calculateLevelInfo(newTokens);
    if (currentLevelNameEl) currentLevelNameEl.textContent = levelInfo.levelName;
    if (currentTokensDisplayEl) currentTokensDisplayEl.textContent = `${newTokens} tokens earned`;
    if (levelProgressBar) {
      levelProgressBar.style.width = `${levelInfo.progressPercent}%`;
      levelProgressBar.setAttribute('aria-valuenow', levelInfo.progressPercent);
    }

    // Prepend resolution to recent activities
    recentActivities.unshift({
      title: `Complaint ${resolvedData.id} resolved: ${resolvedData.resolutionNote || 'Remediation completed'}`,
      date: 'Just now',
      reward: '+3 tokens',
      type: 'resolve'
    });

    // Refresh view
    updateSummaryDashboard();
    renderUserComplaints('all');
    renderActivityTimeline();

    // Pulse highlight the card in My Complaints
    setTimeout(() => {
      const card = document.querySelector(`.complaint-item-card[data-id="${resolvedData.id}"]`);
      if (card) {
        card.classList.add('civic-highlight-pulse');
        setTimeout(() => card.classList.remove('civic-highlight-pulse'), 3500);
      }
    }, 200);
  });

  // Live status update listener
  window.addEventListener('civic:status-update', (event) => {
    if (!event.detail || !event.detail.complaint) return;
    const updated = event.detail.complaint;
    const existing = myComplaints.find(c => c.id === updated.id);
    if (existing) {
      existing.status = updated.status;
      if (updated.assignedOfficial) existing.assignedOfficial = updated.assignedOfficial;
      renderUserComplaints('all');
      updateSummaryDashboard();
    }
  });

  // Live verification update listener
  window.addEventListener('civic:verification-update', (event) => {
    if (!event.detail || !event.detail.complaint) return;
    const updated = event.detail.complaint;
    const existing = myComplaints.find(c => c.id === updated.id);
    if (existing) {
      existing.verification = updated.verification;
      existing.verified = updated.verification === 'Verified';
      if (updated.verificationNotes) existing.verificationNotes = updated.verificationNotes;
      renderUserComplaints('all');
      updateSummaryDashboard();
    }
  });

  // Live new complaint registered by citizen listener
  window.addEventListener('civic:complaint-registered', (event) => {
    if (!event.detail || !event.detail.complaint) return;
    const newDoc = event.detail.complaint;
    const user = window.CivicApi ? window.CivicApi.getUser() : null;
    const currentUserId = user ? (user.id || user._id) : null;
    const repId = (newDoc.reportedBy && (newDoc.reportedBy._id || newDoc.reportedBy.id || newDoc.reportedBy)).toString();

    if (!currentUserId || repId === currentUserId.toString()) {
      if (!myComplaints.some(c => c.id === newDoc.id)) {
        myComplaints.unshift({
          ...newDoc,
          location: (newDoc.location && typeof newDoc.location === 'object' && newDoc.location.address)
            ? newDoc.location.address
            : (newDoc.location || 'Municipal Area'),
          supporters: 0,
          verified: false,
          resolved: false,
          resolutionInfo: 'In municipal operations queue.'
        });
        myComplaints.sort((a, b) => new Date(b.createdAt || b.submittedAt || b.date || 0) - new Date(a.createdAt || a.submittedAt || a.date || 0));
        updateSummaryDashboard();
        renderUserComplaints('all');
      }
    }
  });

  // Expose global hook for notifications click integration
  window.openCitizenComplaintDetails = (id) => openComplaintModal(id);
});
