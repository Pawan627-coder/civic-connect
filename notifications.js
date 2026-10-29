/**
 * ========================================================
 * CIVIC CONNECT - UNIFIED REAL-TIME NOTIFICATIONS ENGINE
 * (notifications.js)
 * 
 * Provides instantaneous pop-up notifications & event bus:
 * 1. Authority Portal: Pop up alert when a citizen registers a complaint
 * 2. Citizen Portal: Celebratory pop up when the authority resolves a problem
 * 
 * Features:
 * - Server-Sent Events (SSE) live stream with auto-reconnection
 * - Cross-Tab BroadcastChannel & LocalStorage Event Bus (0ms latency fallback)
 * - Synthesized Web Audio API sound chimes (alert & celebration)
 * - Confetti particle shower on issue resolution
 * - Floating interactive glassmorphic toasts with action buttons
 * - Navbar Notification Bell with unread counter badge & dropdown history
 * ========================================================
 */

(function () {
  'use strict';

  const STORAGE_NOTIF_SOUND = 'civic_notif_sound';
  const STORAGE_BROADCAST_KEY = 'civic_broadcast_event';

  class CivicNotificationManager {
    constructor() {
      this.container = null;
      this.eventSource = null;
      this.broadcastChannel = null;
      this.reconnectTimeout = null;
      this.reconnectAttempts = 0;
      this.soundEnabled = localStorage.getItem(STORAGE_NOTIF_SOUND) !== 'false';
      this.notifications = [];
      this.unreadCount = 0;
      this.currentTab = 'all';
      this.desktopPermission = ('Notification' in window) ? Notification.permission : 'unsupported';
      this.audioCtx = null;
      this.isAuthorityPortal = window.location.pathname.includes('admin-dashboard');
      this.isCitizenPortal = window.location.pathname.includes('dashboard.html') && !this.isAuthorityPortal;
      
      this.init();
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    }

    setup() {
      this.ensureContainer();
      this.initCrossTabBus();
      this.connectSSE();
      this.mountNavbarBell();
      this.mountSideWidget();
      this.fetchInitialNotifications();

      console.log(`[CivicNotifications]: Engine active. Context: ${this.isAuthorityPortal ? 'Authority Portal' : (this.isCitizenPortal ? 'Citizen Portal' : 'Public Explorer')}.`);
    }

    /**
     * Optional Desktop / Browser Notification Permission
     */
    requestDesktopPermission() {
      if (!('Notification' in window)) {
        alert('Desktop notifications are not supported in this browser.');
        return;
      }
      if (Notification.permission === 'granted') {
        this.desktopPermission = 'granted';
        this.updateDesktopNotificationButton();
        return;
      }
      Notification.requestPermission().then(permission => {
        this.desktopPermission = permission;
        this.updateDesktopNotificationButton();
        if (permission === 'granted') {
          this.showDesktopNotification('Civic Connect Notifications Enabled', 'You will receive real-time civic alerts while Civic Connect is open.', null);
        }
      });
    }

    showDesktopNotification(title, body, complaintId) {
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const notif = new Notification(title || 'Civic Connect Update', {
            body: body || 'New update received on your civic complaint.',
            icon: '/assets/logo.png',
            tag: `civic-${complaintId || Date.now()}`
          });
          notif.onclick = () => {
            window.focus();
            if (complaintId) {
              if (this.isAuthorityPortal && typeof window.adminReviewComplaint === 'function') {
                window.adminReviewComplaint(complaintId);
              } else {
                const target = document.querySelector(`[data-id="${complaintId}"]`);
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  target.classList.add('civic-highlight-pulse');
                  setTimeout(() => target.classList.remove('civic-highlight-pulse'), 3000);
                }
              }
            }
          };
        } catch (e) {
          // Ignore
        }
      }
    }

    updateDesktopNotificationButton() {
      const btn = document.getElementById('btnToggleDesktopNotif');
      if (!btn) return;
      if (this.desktopPermission === 'granted') {
        btn.textContent = '🔔 Desktop Active';
        btn.classList.add('active');
        btn.title = 'Browser notifications are enabled';
      } else if (this.desktopPermission === 'denied') {
        btn.textContent = '🔕 Blocked';
        btn.classList.remove('active');
        btn.title = 'Notifications are blocked in browser settings';
      } else {
        btn.textContent = '🔔 Enable Desktop';
        btn.classList.remove('active');
        btn.title = 'Click to enable desktop notifications';
      }
    }

    /**
     * Ensure floating toast container is mounted
     */
    ensureContainer() {
      let container = document.getElementById('civicNotificationContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'civicNotificationContainer';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'Real-time Notifications');
        document.body.appendChild(container);
      }
      this.container = container;
    }

    /**
     * Cross-Tab Realtime Bus: BroadcastChannel + localStorage
     * Guarantees 0ms immediate synchronization across open tabs on the same computer!
     */
    initCrossTabBus() {
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('civic_realtime_notifications');
          this.broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type) {
              this.handleIncomingEvent(event.data.type, event.data.payload);
            }
          };
        } catch (e) {
          console.warn('[Notifications]: BroadcastChannel unavailable, using storage event fallback.');
        }
      }

      // Storage event listener fallback
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_BROADCAST_KEY && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data && data.type) {
              this.handleIncomingEvent(data.type, data.payload);
            }
          } catch (err) {
            // Ignore parse errors
          }
        }
      });
    }

    /**
     * Broadcast an event to other tabs on the same browser
     */
    broadcastCrossTab(type, payload) {
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
        } catch (e) {
          // Ignore
        }
      }
      try {
        localStorage.setItem(STORAGE_BROADCAST_KEY, JSON.stringify({ type, payload, timestamp: Date.now() }));
      } catch (e) {
        // Ignore
      }
    }

    /**
     * Establish Server-Sent Events (SSE) stream to Express backend
     */
    connectSSE() {
      if (typeof window.EventSource === 'undefined') {
        console.warn('[Notifications]: EventSource not supported by browser.');
        return;
      }

      // Close previous connection if active
      if (this.eventSource) {
        try { this.eventSource.close(); } catch (e) {}
      }

      const token = (window.CivicApi && window.CivicApi.getToken()) || localStorage.getItem('civic_token') || '';
      const user = (window.CivicApi && window.CivicApi.getUser()) || null;
      const roleParam = this.isAuthorityPortal ? 'admin' : (user && user.role ? user.role : 'user');

      const base = window.CivicApi ? window.CivicApi.getBaseUrl() : '';
      const url = `${base}/api/notifications/stream?role=${roleParam}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

      try {
        this.eventSource = new EventSource(url, { withCredentials: true });

        this.eventSource.addEventListener('connected', (e) => {
          this.reconnectAttempts = 0;
          console.log('[Notifications]: Real-time SSE stream connected.');
        });

        // Generic notification event listener
        this.eventSource.addEventListener('notification', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent(data.type || 'NOTIFICATION', data);
          } catch (err) {}
        });

        // 1. Citizen Registered New Complaint Event (Authority Alert)
        this.eventSource.addEventListener('new_complaint', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent('NEW_COMPLAINT', data);
          } catch (err) {}
        });

        // 2. Complaint Successfully Registered (Citizen Confirmation)
        this.eventSource.addEventListener('complaint_registered', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent('COMPLAINT_REGISTERED', data);
          } catch (err) {}
        });

        // 3. Municipal Authority Resolved Complaint Event
        this.eventSource.addEventListener('complaint_resolved', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent('COMPLAINT_RESOLVED', data);
          } catch (err) {}
        });

        // 4. Status Update Event
        this.eventSource.addEventListener('status_update', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent('STATUS_UPDATE', data);
          } catch (err) {}
        });

        // 5. Verification Update Event
        this.eventSource.addEventListener('verification_update', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent('VERIFICATION_UPDATE', data);
          } catch (err) {}
        });

        // 6. Citizen Reminder Alert Event
        this.eventSource.addEventListener('reminder_alert', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent('REMINDER_ALERT', data);
          } catch (err) {}
        });

        // 7. Official Assigned Event
        this.eventSource.addEventListener('official_assigned', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent('OFFICIAL_ASSIGNED', data);
          } catch (err) {}
        });

        // 8. Priority Update Event
        this.eventSource.addEventListener('priority_update', (e) => {
          try {
            const data = JSON.parse(e.data);
            this.handleIncomingEvent('PRIORITY_UPDATED', data);
          } catch (err) {}
        });

        this.eventSource.onerror = () => {
          if (this.eventSource) this.eventSource.close();
          this.eventSource = null;
          this.scheduleReconnect();
        };

      } catch (err) {
        console.warn('[Notifications]: SSE connection error:', err.message);
        this.scheduleReconnect();
      }
    }

    scheduleReconnect() {
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      const delay = Math.min(30000, 3000 * Math.pow(1.5, this.reconnectAttempts++));
      this.reconnectTimeout = setTimeout(() => {
        this.connectSSE();
      }, delay);
    }

    /**
     * Dispatch incoming notification event to appropriate portal handler
     */
    handleIncomingEvent(type, payload) {
      if (!payload) return;

      const complaint = payload.complaint || (payload.notification && payload.notification.data) || payload;
      const notif = payload.notification || {
        id: `notif_${Date.now()}`,
        type,
        title: type === 'NEW_COMPLAINT' ? `New Complaint #${complaint.id}` : (type === 'REMINDER_ALERT' ? `Citizen Reminder: #${complaint.id}` : `Complaint #${complaint.id} Update`),
        message: type === 'NEW_COMPLAINT' ? `New hazard reported: ${complaint.title}` : `Status update on complaint #${complaint.id}`,
        complaintId: complaint ? complaint.id : null,
        data: complaint,
        read: false,
        createdAt: new Date().toISOString()
      };

      // Add to internal list and update badge
      this.addNotificationToList(notif);

      // Trigger optional desktop browser notification
      this.showDesktopNotification(notif.title, notif.message, notif.complaintId || (complaint && complaint.id));

      // Trigger portal-specific popup notifications:
      if (type === 'NEW_COMPLAINT') {
        if (this.isAuthorityPortal) {
          this.showAuthorityToast(complaint, notif);
        }
        window.dispatchEvent(new CustomEvent('civic:new-complaint', { detail: { complaint, notification: notif } }));
      }
      else if (type === 'REMINDER_ALERT') {
        if (this.isAuthorityPortal) {
          this.showAuthorityToast(complaint, notif);
        }
        window.dispatchEvent(new CustomEvent('civic:reminder-alert', { detail: { complaint, notification: notif } }));
      }
      else if (type === 'COMPLAINT_RESOLVED') {
        const user = window.CivicApi ? window.CivicApi.getUser() : null;
        const currentUserId = user ? (user.id || user._id) : null;
        const userEmail = user ? user.email : null;

        const isReporter = !user || !currentUserId ||
          complaint.reportedBy === currentUserId ||
          complaint.reportedBy === userEmail ||
          (Array.isArray(complaint.reporters) && (complaint.reporters.includes(currentUserId) || complaint.reporters.includes(userEmail)));

        if (this.isCitizenPortal || isReporter) {
          this.showCitizenToast(complaint, notif);
        }
        window.dispatchEvent(new CustomEvent('civic:complaint-resolved', { detail: { complaint, notification: notif } }));
      }
      else if (type === 'COMPLAINT_REGISTERED' || type === 'STATUS_UPDATE' || type === 'VERIFICATION_UPDATE' || type === 'PRIORITY_UPDATED' || type === 'OFFICIAL_ASSIGNED') {
        if (this.isCitizenPortal) {
          this.showInformativeToast(notif, complaint);
        }
        window.dispatchEvent(new CustomEvent('civic:' + type.toLowerCase().replace(/_/g, '-'), { detail: { complaint, notification: notif } }));
      }
    }

    /**
     * Show non-blocking informative toast for citizen status/verification/assignment updates
     */
    showInformativeToast(notif, complaint) {
      this.ensureContainer();

      const toast = document.createElement('div');
      toast.className = 'civic-toast citizen-toast';
      const cid = notif.complaintId || (complaint && complaint.id) || 'CC';

      toast.innerHTML = `
        <div class="civic-toast-header">
          <div class="civic-toast-badge-group">
            <span class="civic-live-pill">
              <span class="civic-live-dot"></span>
              Update
            </span>
            <span class="civic-ticket-id-tag">${this.escape(cid)}</span>
          </div>
          <button type="button" class="civic-toast-close" aria-label="Dismiss notification">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="civic-toast-title">
          📢 ${this.escape(notif.title)}
        </div>
        <div class="civic-meta-list" style="margin-bottom: 0.6rem;">
          <div class="civic-meta-item">
            <span class="civic-meta-val" style="color: #334155; line-height: 1.4;">${this.escape(notif.message)}</span>
          </div>
        </div>
        <div class="civic-toast-actions">
          <button type="button" class="civic-toast-btn civic-toast-btn-primary btn-inspect-toast" data-id="${this.escape(cid)}">
            View Details
          </button>
          <button type="button" class="civic-toast-btn civic-toast-btn-ghost btn-dismiss-toast">
            Dismiss
          </button>
        </div>
        <div class="civic-toast-timer-track">
          <div class="civic-toast-timer-bar"></div>
        </div>
      `;

      this.playChime('alert');
      this.mountToastInteractions(toast, cid, () => {
        const card = document.querySelector(`.complaint-item-card[data-id="${cid}"]`) || document.querySelector(`[data-id="${cid}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('civic-highlight-pulse');
          setTimeout(() => card.classList.remove('civic-highlight-pulse'), 3000);
        }
      });
    }

    /* ========================================================
     * 1. AUTHORITY POPUP NOTIFICATION (New Complaint Registered)
     * ======================================================== */
    showAuthorityToast(complaint, notif) {
      this.ensureContainer();

      const toast = document.createElement('div');
      const priority = (complaint.priority && (complaint.priority.level || complaint.priority)) || complaint.severity || 'Medium';
      const prioClass = `priority-${String(priority).toLowerCase()}`;
      toast.className = `civic-toast authority-toast ${prioClass}`;

      const title = complaint.title || 'Civic Hazard Issue';
      const cid = complaint.id || 'CC-NEW';
      const cat = complaint.category || 'Road/Pothole';
      const reporter = complaint.reporterName || 'Citizen';
      const loc = (complaint.location && typeof complaint.location === 'object' && complaint.location.address)
        ? complaint.location.address
        : (complaint.location || 'Municipal Area');

      toast.innerHTML = `
        <div class="civic-toast-header">
          <div class="civic-toast-badge-group">
            <span class="civic-live-pill">
              <span class="civic-live-dot"></span>
              Live Report
            </span>
            <span class="civic-ticket-id-tag">${this.escape(cid)}</span>
            <span style="font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px; background: rgba(255,255,255,0.15); color: #fff;">
              ${this.escape(priority.toUpperCase())}
            </span>
          </div>
          <button type="button" class="civic-toast-close" aria-label="Dismiss notification">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="civic-toast-title">
          🚨 ${this.escape(title)}
        </div>

        <div class="civic-meta-list">
          <div class="civic-meta-item">
            <span class="civic-meta-icon">🏷️</span>
            <span class="civic-meta-label">Category:</span>
            <span class="civic-meta-val">${this.escape(cat)}</span>
          </div>
          <div class="civic-meta-item">
            <span class="civic-meta-icon">👤</span>
            <span class="civic-meta-label">Reported by:</span>
            <span class="civic-meta-val">${this.escape(reporter)}</span>
          </div>
          <div class="civic-meta-item">
            <span class="civic-meta-icon">📍</span>
            <span class="civic-meta-label">Location:</span>
            <span class="civic-meta-val">${this.escape(loc)}</span>
          </div>
        </div>

        <div class="civic-toast-actions">
          <button type="button" class="civic-toast-btn civic-toast-btn-primary btn-inspect-toast" data-id="${this.escape(cid)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Inspect Ticket
          </button>
          <button type="button" class="civic-toast-btn civic-toast-btn-ghost btn-dismiss-toast">
            Dismiss
          </button>
        </div>

        <div class="civic-toast-timer-track">
          <div class="civic-toast-timer-bar"></div>
        </div>
      `;

      // Play subtle chime sound
      this.playChime('alert');

      // Wire close & action handlers
      this.mountToastInteractions(toast, cid, () => {
        if (typeof window.adminReviewComplaint === 'function') {
          window.adminReviewComplaint(cid);
        } else {
          // Scroll to row or open review
          const row = document.querySelector(`tr[data-id="${cid}"]`);
          if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('civic-highlight-pulse');
            setTimeout(() => row.classList.remove('civic-highlight-pulse'), 3000);
          }
        }
      });
    }

    /* ========================================================
     * 2. CITIZEN POPUP NOTIFICATION (Complaint Solved / Resolved)
     * ======================================================== */
    showCitizenToast(complaint, notif) {
      this.ensureContainer();

      const toast = document.createElement('div');
      toast.className = 'civic-toast citizen-toast';

      const cid = complaint.id || 'CC-1001';
      const title = complaint.title || 'Civic Problem';
      const resNote = complaint.resolutionNote || 'Hazard inspected and surface repaired by Municipal Public Works Cell.';
      const resBy = complaint.resolvedBy || 'Civic Authority (Ward Operations)';
      const resDate = complaint.resolvedDate || 'Today';

      toast.innerHTML = `
        <div class="civic-toast-header">
          <div class="civic-toast-badge-group">
            <span class="civic-resolved-pill">
              <span>✓</span> Resolved by Authority
            </span>
            <span class="civic-ticket-id-tag">${this.escape(cid)}</span>
          </div>
          <button type="button" class="civic-toast-close" aria-label="Dismiss notification">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="civic-toast-title">
          🎉 Issue Resolved: ${this.escape(title)}
        </div>

        <div class="civic-resolution-quote">
          "${this.escape(resNote)}"
          <span class="civic-resolution-by">🏛️ Verified by ${this.escape(resBy)} • ${this.escape(resDate)}</span>
        </div>

        <div class="civic-reward-earned-box">
          <span>🏆 Civic Contribution Reward:</span>
          <strong>+3 Reward Tokens Earned!</strong>
        </div>

        <div class="civic-toast-actions">
          <button type="button" class="civic-toast-btn civic-toast-btn-primary btn-inspect-toast" data-id="${this.escape(cid)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            View in My Complaints
          </button>
          <button type="button" class="civic-toast-btn civic-toast-btn-ghost btn-dismiss-toast">
            Dismiss
          </button>
        </div>

        <div class="civic-toast-timer-track">
          <div class="civic-toast-timer-bar"></div>
        </div>
      `;

      // Play triumphant celebration chime
      this.playChime('celebrate');

      // Trigger celebratory confetti shower across screen!
      this.triggerConfetti();

      // Wire interactions
      this.mountToastInteractions(toast, cid, () => {
        // Highlight complaint in user dashboard
        const card = document.querySelector(`.complaint-item-card[data-id="${cid}"]`) ||
                     document.querySelector(`[data-id="${cid}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('civic-highlight-pulse');
          setTimeout(() => card.classList.remove('civic-highlight-pulse'), 3000);
        } else {
          // If not directly visible, click on "All" filter tab
          const allTab = document.querySelector('.filter-tab-btn[data-filter="all"]');
          if (allTab) allTab.click();
          setTimeout(() => {
            const target = document.querySelector(`.complaint-item-card[data-id="${cid}"]`);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              target.classList.add('civic-highlight-pulse');
              setTimeout(() => target.classList.remove('civic-highlight-pulse'), 3000);
            }
          }, 300);
        }
      });
    }

    /**
     * Mount animation, timer, and click interactions on toast
     */
    mountToastInteractions(toast, cid, onInspect) {
      this.container.appendChild(toast);

      // Force reflow for smooth CSS entry slide
      void toast.offsetWidth;
      toast.classList.add('show');

      let timer = null;
      let isPaused = false;
      let remaining = 10000;
      let startTime = Date.now();

      const startTimer = () => {
        startTime = Date.now();
        timer = setTimeout(() => {
          dismiss();
        }, remaining);
      };

      const pauseTimer = () => {
        if (!isPaused && timer) {
          clearTimeout(timer);
          remaining -= (Date.now() - startTime);
          isPaused = true;
        }
      };

      const resumeTimer = () => {
        if (isPaused) {
          isPaused = false;
          startTimer();
        }
      };

      const dismiss = () => {
        if (timer) clearTimeout(timer);
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400);
      };

      toast.addEventListener('mouseenter', pauseTimer);
      toast.addEventListener('mouseleave', resumeTimer);

      const closeBtn = toast.querySelector('.civic-toast-close');
      if (closeBtn) closeBtn.addEventListener('click', dismiss);

      const dismissBtn = toast.querySelector('.btn-dismiss-toast');
      if (dismissBtn) dismissBtn.addEventListener('click', dismiss);

      const inspectBtn = toast.querySelector('.btn-inspect-toast');
      if (inspectBtn) {
        inspectBtn.addEventListener('click', () => {
          dismiss();
          if (onInspect) onInspect();
        });
      }

      startTimer();
    }

    /* ========================================================
     * 3. CELEBRATION CONFETTI SHOWER
     * ======================================================== */
    triggerConfetti() {
      const existing = document.getElementById('civicConfettiContainer');
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.id = 'civicConfettiContainer';
      container.className = 'civic-confetti-container';
      document.body.appendChild(container);

      const colors = ['#10b981', '#34d399', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#facc15'];

      for (let i = 0; i < 45; i++) {
        const piece = document.createElement('div');
        piece.className = 'civic-confetti-piece';
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = `${Math.random() * 0.8}s`;
        piece.style.animationDuration = `${2.4 + Math.random() * 1.6}s`;
        piece.style.width = `${8 + Math.random() * 6}px`;
        piece.style.height = `${10 + Math.random() * 8}px`;
        container.appendChild(piece);
      }

      setTimeout(() => {
        if (container.parentNode) container.parentNode.removeChild(container);
      }, 4500);
    }

    /* ========================================================
     * 4. SYNTHESIZED WEB AUDIO API SOUND CHIMES
     * ======================================================== */
    playChime(type = 'alert') {
      if (!this.soundEnabled) return;

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!this.audioCtx) {
          this.audioCtx = new AudioCtx();
        }

        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;

        if (type === 'alert') {
          // Soft attention chime: 880Hz -> 1175Hz (A5 -> D6)
          const osc1 = this.audioCtx.createOscillator();
          const gain1 = this.audioCtx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(880, now);
          gain1.gain.setValueAtTime(0.12, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc1.connect(gain1);
          gain1.connect(this.audioCtx.destination);
          osc1.start(now);
          osc1.stop(now + 0.35);

          const osc2 = this.audioCtx.createOscillator();
          const gain2 = this.audioCtx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1175, now + 0.12);
          gain2.gain.setValueAtTime(0.14, now + 0.12);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
          osc2.connect(gain2);
          gain2.connect(this.audioCtx.destination);
          osc2.start(now + 0.12);
          osc2.stop(now + 0.55);
        } else if (type === 'celebrate') {
          // Cheerful resolution arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
          const notes = [523.25, 659.25, 783.99, 1046.50];
          notes.forEach((freq, idx) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            const noteStart = now + (idx * 0.09);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, noteStart);
            gain.gain.setValueAtTime(0.14, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.45);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(noteStart);
            osc.stop(noteStart + 0.45);
          });
        }
      } catch (err) {
        // Audio playback error (e.g. user hasn't interacted with page yet)
      }
    }

    /* ========================================================
     * 5. NAVBAR NOTIFICATION BELL & DROPDOWN PANEL
     * ======================================================== */
    mountNavbarBell() {
      // Find suitable insertion target in header
      const navActions = document.querySelector('.nav-actions') || document.querySelector('.nav-menu');
      if (!navActions) return;

      // If already mounted, ensure it is still attached to DOM and positioned properly
      let wrapper = document.getElementById('civicNotifNavWrapper');
      if (wrapper) {
        if (!navActions.contains(wrapper)) {
          navActions.insertBefore(wrapper, navActions.firstChild);
        }
        return;
      }

      wrapper = document.createElement('div');
      wrapper.id = 'civicNotifNavWrapper';
      wrapper.className = 'civic-notif-nav-wrapper';

      wrapper.innerHTML = `
        <button type="button" class="civic-notif-bell-btn" id="civicNotifBellBtn" title="View Notifications" aria-label="Notifications" aria-expanded="false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span class="civic-notif-badge hidden" id="civicNotifBadge">0</span>
        </button>

        <div class="civic-notif-panel" id="civicNotifPanel" role="dialog" aria-labelledby="civicNotifPanelTitle">
          <div class="civic-notif-panel-header">
            <div class="civic-notif-panel-title" id="civicNotifPanelTitle">
              <span>🔔 Notifications</span>
            </div>
            <div class="civic-notif-panel-actions">
              <button type="button" class="civic-desktop-notif-btn" id="btnToggleDesktopNotif" title="Enable browser notifications">
                🔔 Desktop
              </button>
              <button type="button" class="civic-notif-text-btn" id="btnToggleSound" title="Toggle sound chimes">
                ${this.soundEnabled ? '🔊 Sound' : '🔇 Muted'}
              </button>
              <button type="button" class="civic-notif-text-btn" id="btnMarkAllRead" title="Mark all notifications as read">
                Mark all read
              </button>
            </div>
          </div>

          <div class="civic-notif-tabs" id="civicNotifTabs">
            <button type="button" class="civic-notif-tab active" data-tab="all" id="tabNotifAll">All</button>
            <button type="button" class="civic-notif-tab" data-tab="unread" id="tabNotifUnread">Unread</button>
          </div>

          <ul class="civic-notif-list" id="civicNotifList">
            <li class="civic-notif-empty">
              <div class="civic-notif-empty-icon">🔕</div>
              <div class="civic-notif-empty-text">No new notifications</div>
            </li>
          </ul>

          <div class="civic-notif-panel-footer">
            <button type="button" class="civic-notif-view-all-btn" id="btnViewAllNotifs">
              View All Notifications &rarr;
            </button>
          </div>
        </div>
      `;

      // Prepend to navActions before user avatar / logout button
      navActions.insertBefore(wrapper, navActions.firstChild);

      // Wire bell toggle
      const bellBtn = wrapper.querySelector('#civicNotifBellBtn');
      const panel = wrapper.querySelector('#civicNotifPanel');
      const markAllBtn = wrapper.querySelector('#btnMarkAllRead');
      const soundBtn = wrapper.querySelector('#btnToggleSound');
      const desktopBtn = wrapper.querySelector('#btnToggleDesktopNotif');
      const tabAll = wrapper.querySelector('#tabNotifAll');
      const tabUnread = wrapper.querySelector('#tabNotifUnread');
      const viewAllBtn = wrapper.querySelector('#btnViewAllNotifs');

      this.updateDesktopNotificationButton();

      if (bellBtn && panel) {
        bellBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Close side panel if open
          const sidePanel = document.getElementById('civicNotifSidePanel');
          if (sidePanel) sidePanel.classList.remove('open');

          const isOpen = panel.classList.contains('open');
          if (isOpen) {
            panel.classList.remove('open');
            bellBtn.setAttribute('aria-expanded', 'false');
          } else {
            panel.classList.add('open');
            bellBtn.setAttribute('aria-expanded', 'true');
            this.renderNotificationsList();
          }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
          if (!wrapper.contains(e.target)) {
            panel.classList.remove('open');
            bellBtn.setAttribute('aria-expanded', 'false');
          }
        });
      }

      if (tabAll && tabUnread) {
        tabAll.addEventListener('click', () => {
          this.currentTab = 'all';
          tabAll.classList.add('active');
          tabUnread.classList.remove('active');
          const sideTabAll = document.getElementById('tabSideNotifAll');
          const sideTabUnread = document.getElementById('tabSideNotifUnread');
          if (sideTabAll) sideTabAll.classList.add('active');
          if (sideTabUnread) sideTabUnread.classList.remove('active');
          this.renderNotificationsList();
        });
        tabUnread.addEventListener('click', () => {
          this.currentTab = 'unread';
          tabUnread.classList.add('active');
          tabAll.classList.remove('active');
          const sideTabAll = document.getElementById('tabSideNotifAll');
          const sideTabUnread = document.getElementById('tabSideNotifUnread');
          if (sideTabUnread) sideTabUnread.classList.add('active');
          if (sideTabAll) sideTabAll.classList.remove('active');
          this.renderNotificationsList();
        });
      }

      if (desktopBtn) {
        desktopBtn.addEventListener('click', () => {
          this.requestDesktopPermission();
        });
      }

      if (markAllBtn) {
        markAllBtn.addEventListener('click', () => {
          this.markAllAsRead();
        });
      }

      if (soundBtn) {
        soundBtn.addEventListener('click', () => {
          this.soundEnabled = !this.soundEnabled;
          localStorage.setItem(STORAGE_NOTIF_SOUND, String(this.soundEnabled));
          const text = this.soundEnabled ? '🔊 Sound' : '🔇 Muted';
          soundBtn.textContent = text;
          const sideSoundBtn = document.getElementById('btnToggleSideSound');
          if (sideSoundBtn) sideSoundBtn.textContent = text;
        });
      }

      if (viewAllBtn) {
        viewAllBtn.addEventListener('click', () => {
          panel.classList.remove('open');
          bellBtn.setAttribute('aria-expanded', 'false');
          this.openAllNotificationsModal();
        });
      }

      this.updateBadge();
    }

    /* ========================================================
     * 6. PERMANENT FLOATING SIDE QUICK-ACCESS BELL WIDGET
     * Always visible on the side of the display (Citizen & Authority)
     * ======================================================== */
    mountSideWidget() {
      if (document.getElementById('civicNotifSideWidget')) return;

      const widget = document.createElement('div');
      widget.id = 'civicNotifSideWidget';
      widget.className = 'civic-notif-side-widget';

      widget.innerHTML = `
        <div class="civic-notif-side-panel" id="civicNotifSidePanel" role="dialog" aria-label="Quick Notifications Panel">
          <div class="civic-notif-panel-header">
            <div class="civic-notif-panel-title">
              <span>🔔 Notifications</span>
            </div>
            <div class="civic-notif-panel-actions">
              <button type="button" class="civic-desktop-notif-btn" id="btnToggleSideDesktopNotif" title="Enable browser notifications">
                🔔 Desktop
              </button>
              <button type="button" class="civic-notif-text-btn" id="btnToggleSideSound" title="Toggle sound chimes">
                ${this.soundEnabled ? '🔊 Sound' : '🔇 Muted'}
              </button>
              <button type="button" class="civic-notif-text-btn" id="btnSideMarkAllRead" title="Mark all notifications as read">
                Mark all read
              </button>
            </div>
          </div>

          <div class="civic-notif-tabs" id="civicNotifSideTabs">
            <button type="button" class="civic-notif-tab active" data-tab="all" id="tabSideNotifAll">All</button>
            <button type="button" class="civic-notif-tab" data-tab="unread" id="tabSideNotifUnread">Unread</button>
          </div>

          <ul class="civic-notif-list" id="civicNotifSideList">
            <li class="civic-notif-empty">
              <div class="civic-notif-empty-icon">🔕</div>
              <div class="civic-notif-empty-text">No new notifications</div>
            </li>
          </ul>

          <div class="civic-notif-panel-footer">
            <button type="button" class="civic-notif-view-all-btn" id="btnSideViewAllNotifs">
              View All Notifications &rarr;
            </button>
          </div>
        </div>

        <button type="button" class="civic-notif-side-btn" id="civicNotifSideBtn" title="Notifications" aria-label="Quick Access Notifications" aria-expanded="false">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span class="civic-notif-side-badge hidden" id="civicNotifSideBadge">0</span>
          <span class="civic-notif-side-tooltip" id="civicNotifSideTooltip">Notifications</span>
        </button>
      `;

      document.body.appendChild(widget);

      const sideBtn = widget.querySelector('#civicNotifSideBtn');
      const sidePanel = widget.querySelector('#civicNotifSidePanel');
      const sideMarkAll = widget.querySelector('#btnSideMarkAllRead');
      const sideSoundBtn = widget.querySelector('#btnToggleSideSound');
      const sideDesktopBtn = widget.querySelector('#btnToggleSideDesktopNotif');
      const sideTabAll = widget.querySelector('#tabSideNotifAll');
      const sideTabUnread = widget.querySelector('#tabSideNotifUnread');
      const sideViewAll = widget.querySelector('#btnSideViewAllNotifs');

      if (sideBtn && sidePanel) {
        sideBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Close top navbar panel if open
          const navPanel = document.getElementById('civicNotifPanel');
          if (navPanel) navPanel.classList.remove('open');

          const isOpen = sidePanel.classList.contains('open');
          if (isOpen) {
            sidePanel.classList.remove('open');
            sideBtn.setAttribute('aria-expanded', 'false');
          } else {
            sidePanel.classList.add('open');
            sideBtn.setAttribute('aria-expanded', 'true');
            this.renderNotificationsList();
          }
        });

        document.addEventListener('click', (e) => {
          if (!widget.contains(e.target)) {
            sidePanel.classList.remove('open');
            sideBtn.setAttribute('aria-expanded', 'false');
          }
        });
      }

      if (sideTabAll && sideTabUnread) {
        sideTabAll.addEventListener('click', () => {
          this.currentTab = 'all';
          sideTabAll.classList.add('active');
          sideTabUnread.classList.remove('active');
          const navTabAll = document.getElementById('tabNotifAll');
          const navTabUnread = document.getElementById('tabNotifUnread');
          if (navTabAll) navTabAll.classList.add('active');
          if (navTabUnread) navTabUnread.classList.remove('active');
          this.renderNotificationsList();
        });
        sideTabUnread.addEventListener('click', () => {
          this.currentTab = 'unread';
          sideTabUnread.classList.add('active');
          sideTabAll.classList.remove('active');
          const navTabAll = document.getElementById('tabNotifAll');
          const navTabUnread = document.getElementById('tabNotifUnread');
          if (navTabUnread) navTabUnread.classList.add('active');
          if (navTabAll) navTabAll.classList.remove('active');
          this.renderNotificationsList();
        });
      }

      if (sideDesktopBtn) {
        sideDesktopBtn.addEventListener('click', () => this.requestDesktopPermission());
      }
      if (sideMarkAll) {
        sideMarkAll.addEventListener('click', () => this.markAllAsRead());
      }
      if (sideSoundBtn) {
        sideSoundBtn.addEventListener('click', () => {
          this.soundEnabled = !this.soundEnabled;
          localStorage.setItem(STORAGE_NOTIF_SOUND, String(this.soundEnabled));
          const text = this.soundEnabled ? '🔊 Sound' : '🔇 Muted';
          sideSoundBtn.textContent = text;
          const navSoundBtn = document.getElementById('btnToggleSound');
          if (navSoundBtn) navSoundBtn.textContent = text;
        });
      }
      if (sideViewAll) {
        sideViewAll.addEventListener('click', () => {
          sidePanel.classList.remove('open');
          sideBtn.setAttribute('aria-expanded', 'false');
          this.openAllNotificationsModal();
        });
      }

      this.updateBadge();
    }

    addNotificationToList(notif) {
      // Check if already in list
      const existing = this.notifications.find(n => n.id === notif.id);
      if (!existing) {
        this.notifications.unshift(notif);
        if (!notif.read) {
          this.unreadCount++;
        }
        this.updateBadge();
        this.ringBell();
        this.renderNotificationsList();
      }
    }

    updateBadge() {
      const badge = document.getElementById('civicNotifBadge');
      const sideBadge = document.getElementById('civicNotifSideBadge');
      const sideTooltip = document.getElementById('civicNotifSideTooltip');
      const label = this.unreadCount > 99 ? '99+' : String(this.unreadCount);

      if (badge) {
        if (this.unreadCount > 0) {
          badge.textContent = label;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      if (sideBadge) {
        if (this.unreadCount > 0) {
          sideBadge.textContent = label;
          sideBadge.classList.remove('hidden');
        } else {
          sideBadge.classList.add('hidden');
        }
      }

      if (sideTooltip) {
        sideTooltip.textContent = this.unreadCount > 0 ? `Notifications (${this.unreadCount} unread)` : 'Notifications';
      }

      const footerBtn = document.getElementById('btnViewAllNotifs');
      if (footerBtn) {
        footerBtn.textContent = `View All Notifications (${this.notifications.length}) →`;
      }
      const sideFooterBtn = document.getElementById('btnSideViewAllNotifs');
      if (sideFooterBtn) {
        sideFooterBtn.textContent = `View All Notifications (${this.notifications.length}) →`;
      }
    }

    ringBell() {
      const bell = document.getElementById('civicNotifBellBtn');
      const sideBell = document.getElementById('civicNotifSideBtn');
      [bell, sideBell].forEach(b => {
        if (!b) return;
        b.classList.remove('ring');
        void b.offsetWidth;
        b.classList.add('ring');
        setTimeout(() => b.classList.remove('ring'), 850);
      });
    }

    getNotificationIcon(type) {
      const iconMap = {
        COMPLAINT_REGISTERED: '📝',
        NEW_COMPLAINT: '🚨',
        COMPLAINT_VERIFIED: '✅',
        NEEDS_INSPECTION: '🔍',
        EVIDENCE_REQUESTED: '⚠️',
        COMPLAINT_REJECTED: '❌',
        PRIORITY_UPDATED: '⚡',
        OFFICIAL_ASSIGNED: '👷',
        STATUS_UPDATE: '🔨',
        COMPLAINT_RESOLVED: '🎉',
        REMINDER_ALERT: '🔔',
        REMINDER_RESPONSE: '💬'
      };
      return iconMap[type] || 'ℹ️';
    }

    renderNotificationsList() {
      const listElements = [
        document.getElementById('civicNotifList'),
        document.getElementById('civicNotifSideList')
      ].filter(Boolean);

      if (listElements.length === 0) return;

      const itemsToShow = this.currentTab === 'unread'
        ? this.notifications.filter(n => !n.read)
        : this.notifications;

      listElements.forEach(list => {
        if (itemsToShow.length === 0) {
          const emptyLabel = this.currentTab === 'unread' ? 'No unread notifications' : 'No notifications yet';
          list.innerHTML = `
            <li class="civic-notif-empty">
              <div class="civic-notif-empty-icon">🔕</div>
              <div class="civic-notif-empty-text">${emptyLabel}</div>
              <span style="font-size: 0.78rem; color: #94a3b8; display: block; margin-top: 0.25rem;">
                New complaint reports & resolution milestones will appear here.
              </span>
            </li>
          `;
          return;
        }

        list.innerHTML = '';
        itemsToShow.slice(0, 30).forEach(notif => {
          const li = document.createElement('li');
          const isResolved = notif.type === 'COMPLAINT_RESOLVED';
          const isNew = notif.type === 'NEW_COMPLAINT';
          li.className = `civic-notif-item ${notif.read ? 'read' : 'unread'} ${isResolved ? 'type-resolved' : (isNew ? 'type-new' : '')}`;

          const icon = this.getNotificationIcon(notif.type);
          const timeStr = this.formatTimeAgo(notif.createdAt);
          const cid = notif.complaintId || (notif.data && notif.data.id);

          li.innerHTML = `
            <div class="civic-notif-item-icon">${icon}</div>
            <div class="civic-notif-item-content">
              <div class="civic-notif-item-title">
                ${cid ? `<span class="civic-notif-cid-pill">#${this.escape(cid)}</span>` : ''}
                ${this.escape(notif.title)}
              </div>
              <div class="civic-notif-item-desc">${this.escape(notif.message)}</div>
              <div class="civic-notif-item-time">${timeStr}</div>
            </div>
          `;

          li.addEventListener('click', async () => {
            if (!notif.read) {
              notif.read = true;
              this.unreadCount = Math.max(0, this.unreadCount - 1);
              this.updateBadge();
              document.querySelectorAll(`.civic-notif-item`).forEach(el => {
                if (el.textContent.includes(cid || notif.title)) {
                  el.classList.remove('unread');
                  el.classList.add('read');
                }
              });

              if (window.civicFetch && notif.id) {
                window.civicFetch(`/api/notifications/${encodeURIComponent(notif.id)}/read`, { method: 'PATCH' }).catch(() => {});
              }
            }

            if (cid) {
              if (this.isAuthorityPortal) {
                if (typeof window.adminReviewComplaint === 'function') {
                  window.adminReviewComplaint(cid);
                } else {
                  const target = document.querySelector(`tr[data-id="${cid}"]`);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    target.classList.add('civic-highlight-pulse');
                    setTimeout(() => target.classList.remove('civic-highlight-pulse'), 3000);
                    target.click();
                  }
                }
              } else {
                const target = document.querySelector(`.complaint-item-card[data-id="${cid}"]`) || document.querySelector(`[data-id="${cid}"]`);
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  target.classList.add('civic-highlight-pulse');
                  setTimeout(() => target.classList.remove('civic-highlight-pulse'), 3000);
                }
              }
            }
          });

          list.appendChild(li);
        });
      });
    }

    markAllAsRead() {
      this.notifications.forEach(n => { n.read = true; });
      this.unreadCount = 0;
      this.updateBadge();
      this.renderNotificationsList();

      // Sync with backend API
      if (window.civicFetch) {
        window.civicFetch('/api/notifications/mark-all-read', { method: 'PATCH' })
          .catch(() => window.civicFetch('/api/notifications/read-all', { method: 'PATCH' }))
          .catch(() => {});
      }
    }

    async fetchInitialNotifications() {
      try {
        const fetchFn = window.civicFetch || fetch;
        const res = await fetchFn('/api/notifications?page=1&limit=50');
        if (res && res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            this.notifications = json.data;
            this.unreadCount = (typeof json.unreadCount === 'number')
              ? json.unreadCount
              : this.notifications.filter(n => !n.read).length;
            this.updateBadge();
            this.renderNotificationsList();
          }
        }
      } catch (e) {
        // Fallback to local
      }
    }

    /**
     * "All Notifications" Modal Viewer with pagination & filter tabs
     */
    openAllNotificationsModal() {
      let modal = document.getElementById('civicAllNotifsModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'civicAllNotifsModal';
        modal.className = 'civic-notif-modal-backdrop';
        modal.innerHTML = `
          <div class="civic-notif-modal-content">
            <div class="civic-notif-modal-header">
              <div class="civic-notif-modal-title">
                <span>🔔 Notification History</span>
              </div>
              <button type="button" class="civic-notif-modal-close" id="civicModalCloseBtn" aria-label="Close dialog">&times;</button>
            </div>
            <div class="civic-notif-tabs" style="padding: 8px 12px; background: #f8fafc;">
              <button type="button" class="civic-notif-tab active" id="modalTabAll">All Notifications</button>
              <button type="button" class="civic-notif-tab" id="modalTabUnread">Unread Only</button>
            </div>
            <div class="civic-notif-modal-body" id="civicModalNotifBody">
              <ul class="civic-notif-list" id="civicModalNotifList"></ul>
            </div>
            <div class="civic-notif-modal-footer">
              <span id="civicModalNotifCount" style="font-size: 0.8rem; color: #64748b; font-weight: 600;"></span>
              <button type="button" class="btn btn-sm btn-outline" id="civicModalMarkAllRead">Mark All as Read</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#civicModalCloseBtn');
        closeBtn.addEventListener('click', () => modal.classList.remove('open'));
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.remove('open');
        });

        const mTabAll = modal.querySelector('#modalTabAll');
        const mTabUnread = modal.querySelector('#modalTabUnread');
        let modalFilter = 'all';

        const renderModalList = () => {
          const listEl = modal.querySelector('#civicModalNotifList');
          const countEl = modal.querySelector('#civicModalNotifCount');
          if (!listEl) return;

          const items = modalFilter === 'unread' ? this.notifications.filter(n => !n.read) : this.notifications;
          if (countEl) countEl.textContent = `Showing ${items.length} notification${items.length === 1 ? '' : 's'}`;

          if (items.length === 0) {
            listEl.innerHTML = `
              <li class="civic-notif-empty">
                <div class="civic-notif-empty-icon">🔕</div>
                <div class="civic-notif-empty-text">No notifications found</div>
              </li>
            `;
            return;
          }

          listEl.innerHTML = '';
          items.forEach(notif => {
            const li = document.createElement('li');
            li.className = `civic-notif-item ${notif.read ? 'read' : 'unread'}`;
            const icon = this.getNotificationIcon(notif.type);
            const timeStr = this.formatTimeAgo(notif.createdAt);
            const cid = notif.complaintId || (notif.data && notif.data.id);

            li.innerHTML = `
              <div class="civic-notif-item-icon">${icon}</div>
              <div class="civic-notif-item-content">
                <div class="civic-notif-item-title">
                  ${cid ? `<span class="civic-notif-cid-pill">#${this.escape(cid)}</span>` : ''}
                  ${this.escape(notif.title)}
                </div>
                <div class="civic-notif-item-desc" style="display: block;">${this.escape(notif.message)}</div>
                <div class="civic-notif-item-time">${timeStr} • ${new Date(notif.createdAt).toLocaleString('en-GB')}</div>
              </div>
            `;

            li.addEventListener('click', () => {
              if (!notif.read) {
                notif.read = true;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateBadge();
                li.classList.remove('unread');
                li.classList.add('read');
                if (window.civicFetch && notif.id) {
                  window.civicFetch(`/api/notifications/${encodeURIComponent(notif.id)}/read`, { method: 'PATCH' }).catch(() => {});
                }
              }
              modal.classList.remove('open');
              if (cid) {
                if (this.isAuthorityPortal && typeof window.adminReviewComplaint === 'function') {
                  window.adminReviewComplaint(cid);
                } else {
                  const target = document.querySelector(`[data-id="${cid}"]`);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    target.classList.add('civic-highlight-pulse');
                    setTimeout(() => target.classList.remove('civic-highlight-pulse'), 3000);
                  }
                }
              }
            });

            listEl.appendChild(li);
          });
        };

        mTabAll.addEventListener('click', () => {
          modalFilter = 'all';
          mTabAll.classList.add('active');
          mTabUnread.classList.remove('active');
          renderModalList();
        });

        mTabUnread.addEventListener('click', () => {
          modalFilter = 'unread';
          mTabUnread.classList.add('active');
          mTabAll.classList.remove('active');
          renderModalList();
        });

        const modalMarkAll = modal.querySelector('#civicModalMarkAllRead');
        if (modalMarkAll) {
          modalMarkAll.addEventListener('click', () => {
            this.markAllAsRead();
            renderModalList();
          });
        }

        renderModalList();
      }

      modal.classList.add('open');
    }

    formatTimeAgo(dateInput) {
      if (!dateInput) return 'Recently';
      const d = new Date(dateInput);
      const secs = Math.floor((Date.now() - d.getTime()) / 1000);
      if (secs < 60) return 'Just now';
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    escape(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  // Instantiate and expose globally
  const manager = new CivicNotificationManager();
  window.CivicNotifications = manager;

  // Global helper shortcuts
  window.notifyNewComplaint = (complaint) => {
    manager.broadcastCrossTab('NEW_COMPLAINT', { complaint });
  };

  window.notifyComplaintResolved = (complaint) => {
    manager.broadcastCrossTab('COMPLAINT_RESOLVED', { complaint });
  };
})();
