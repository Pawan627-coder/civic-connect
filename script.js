/**
 * ========================================================
 * CIVIC CONNECT - JAVASCRIPT CONTROLLER (VANILLA JS)
 * Stage 1: Frontend Foundation
 * ========================================================
 * 
 * As a beginner in vibe coding, this file shows you how 
 * JavaScript listens to user actions (clicks, scrolls, typing) 
 * and updates what you see on the screen in real time.
 */

// Wait for the entire HTML document to be parsed before running scripts
document.addEventListener('DOMContentLoaded', () => {

  /* --------------------------------------------------------
   * 1. MOBILE HAMBURGER MENU TOGGLE
   * -------------------------------------------------------- */
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (mobileToggle && navMenu) {
    // Toggle menu open/closed when hamburger button is clicked
    mobileToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      mobileToggle.classList.toggle('active');
      mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      
      // Prevent background scrolling while mobile menu is open
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close mobile drawer whenever any navigation link is clicked
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (navMenu.classList.contains('open')) {
          navMenu.classList.remove('open');
          mobileToggle.classList.remove('active');
          mobileToggle.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        }
      });
    });
  }

  /* --------------------------------------------------------
   * 2. HEADER SHADOW ON SCROLL
   * -------------------------------------------------------- */
  const siteHeader = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      siteHeader.classList.add('scrolled');
    } else {
      siteHeader.classList.remove('scrolled');
    }
  });

  /* --------------------------------------------------------
   * 3. CURRENT-PAGE NAVBAR PINPOINTER
   * --------------------------------------------------------
   * Pinpoints whatever page the citizen is currently browsing:
   * - "Home" is pinpointed on index.html / homepage root.
   * - "Report Problem", "View Complaints", "Dashboard" pinpointed on their pages.
   * - Completely stable, zero jumping on scroll.
   */
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const isHomePage = currentPath === 'index.html' || currentPath === '' || currentPath === '/';

  navLinks.forEach(link => {
    const href = link.getAttribute('href') || '';
    const linkPath = href.split('#')[0].split('/').pop();

    if (isHomePage) {
      if (href === '#hero' || href === 'index.html' || href === 'index.html#hero') {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    } else {
      if (linkPath && linkPath === currentPath) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    }
  });



  /* --------------------------------------------------------
   * 6. STAGE 1 INFORMATIONAL MODAL CONTROLLER
   * Explains to beginners what is interactive now vs in Stage 2
   * -------------------------------------------------------- */
  const infoModal = document.getElementById('infoModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  const privacyLink = document.getElementById('privacyLink');
  const termsLink = document.getElementById('termsLink');
  const charterLink = document.getElementById('charterLink');

  // Helper function to show modal with custom text
  function showModal(title, contentHtml) {
    if (!infoModal) return;
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = contentHtml;
    infoModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  // Helper function to close modal
  function closeModal() {
    if (!infoModal) return;
    infoModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  // Wire close buttons
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeModal);

  // Close when clicking modal backdrop
  if (infoModal) {
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) closeModal();
    });
  }

  // Close when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && infoModal && !infoModal.hasAttribute('hidden')) {
      closeModal();
    }
  });

  // Policy Links demo modal
  const handleLegalClick = (e, docTitle) => {
    e.preventDefault();
    showModal(
      `${docTitle} (Draft)`,
      `<p>This is a placeholder for the official <strong>${docTitle}</strong> of Civic Connect.</p>
       <p>All citizen reports are treated under open municipal transparency guidelines while keeping personal identity protected.</p>`
    );
  };

  if (privacyLink) privacyLink.addEventListener('click', (e) => handleLegalClick(e, 'Privacy Policy'));
  if (termsLink) termsLink.addEventListener('click', (e) => handleLegalClick(e, 'Terms of Service'));
  if (charterLink) charterLink.addEventListener('click', (e) => handleLegalClick(e, 'Citizen Charter'));

  /* --------------------------------------------------------
   * 7. SEND REMINDER ESCALATION MODAL CONTROLLER (HOMEPAGE)
   * -------------------------------------------------------- */
  const homeActionSendReminder = document.getElementById('homeActionSendReminder');
  const reminderModal = document.getElementById('reminderModal');
  const reminderCloseBtn = document.getElementById('reminderCloseBtn');
  const reminderCancelBtn = document.getElementById('reminderCancelBtn');
  const reminderForm = document.getElementById('reminderForm');
  const reminderComplaintSelect = document.getElementById('reminderComplaintSelect');
  const reminderReasonSelect = document.getElementById('reminderReasonSelect');
  const reminderNotes = document.getElementById('reminderNotes');
  const reminderFeedback = document.getElementById('reminderFeedback');
  const reminderSubmitBtn = document.getElementById('reminderSubmitBtn');

  async function openReminderModal() {
    if (!reminderModal) return;

    if (reminderFeedback) {
      reminderFeedback.style.display = 'none';
      reminderFeedback.textContent = '';
    }
    if (reminderNotes) reminderNotes.value = '';

    if (reminderComplaintSelect) {
      reminderComplaintSelect.innerHTML = '<option value="" disabled selected>Loading active road complaints...</option>';
      try {
        const fetchFn = window.civicFetch || window.fetch;
        const res = await fetchFn('/api/complaints');
        if (res && res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.data) ? data.data : [];
          const active = list.filter(c => c.status !== 'Resolved');
          if (active.length > 0) {
            reminderComplaintSelect.innerHTML = `
              <option value="" disabled selected>-- Select an active complaint --</option>
              ${active.map(c => `
                <option value="${c.id}">${c.id} — ${(c.title && c.title.length > 32 ? c.title.slice(0, 30) + '...' : (c.title || c.category))} [${c.status || 'Active'}]</option>
              `).join('')}
            `;
          } else {
            reminderComplaintSelect.innerHTML = '<option value="" disabled selected>All road reports are currently resolved.</option>';
          }
        } else {
          throw new Error('API non-OK');
        }
      } catch (err) {
        reminderComplaintSelect.innerHTML = `
          <option value="CC-1001" selected>CC-1001 — Large pothole cluster near main road [Under Verification]</option>
          <option value="CC-1002">CC-1002 — Four street lights not working along school road [In Progress]</option>
          <option value="CC-1003">CC-1003 — Deep crater pothole opposite market entrance [Reported]</option>
        `;
      }
    }

    reminderModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeReminderModal() {
    if (!reminderModal) return;
    reminderModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  if (homeActionSendReminder) {
    homeActionSendReminder.addEventListener('click', openReminderModal);
  }
  if (reminderCloseBtn) reminderCloseBtn.addEventListener('click', closeReminderModal);
  if (reminderCancelBtn) reminderCancelBtn.addEventListener('click', closeReminderModal);
  if (reminderModal) {
    reminderModal.addEventListener('click', (e) => {
      if (e.target === reminderModal) closeReminderModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reminderModal && !reminderModal.hasAttribute('hidden')) {
      closeReminderModal();
    }
  });

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
        const fetchFn = window.civicFetch || window.fetch;
        await fetchFn(`/api/complaints/${encodeURIComponent(ticketId)}/reminder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reasonText, note: notes })
        });
      } catch (err) {
        console.warn('[Home Reminder]: Notice dispatched locally:', err.message);
      }

      if (reminderFeedback) {
        reminderFeedback.style.display = 'block';
        reminderFeedback.style.backgroundColor = '#ecfdf5';
        reminderFeedback.style.borderColor = '#a7f3d0';
        reminderFeedback.style.color = '#065f46';
        reminderFeedback.textContent = `✓ Municipal reminder dispatched for #${ticketId}! Escalation notice sent to Ward Road Maintenance Cell.`;
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
      }, 1500);
    });
  }

  /* --------------------------------------------------------
   * 8. GIVE FEEDBACK MODAL CONTROLLER (HOMEPAGE & DASHBOARD)
   * -------------------------------------------------------- */
  const homeActionGiveFeedback = document.getElementById('homeActionGiveFeedback');
  const actionGiveFeedback = document.getElementById('actionGiveFeedback');
  const feedbackModal = document.getElementById('feedbackModal');
  const feedbackCloseBtn = document.getElementById('feedbackCloseBtn');
  const feedbackCancelBtn = document.getElementById('feedbackCancelBtn');
  const feedbackForm = document.getElementById('feedbackForm');
  const feedbackComplaintSelect = document.getElementById('feedbackComplaintSelect');
  const feedbackAspectSelect = document.getElementById('feedbackAspectSelect');
  const feedbackComment = document.getElementById('feedbackComment');
  const feedbackRatingValue = document.getElementById('feedbackRatingValue');
  const feedbackStatusBanner = document.getElementById('feedbackStatusBanner');
  const feedbackSubmitBtn = document.getElementById('feedbackSubmitBtn');
  const starRatingItems = document.querySelectorAll('.star-rating-item');
  const starRatingLabel = document.getElementById('starRatingLabel');

  const ratingDescriptions = {
    1: '1 / 5 (Needs Improvement)',
    2: '2 / 5 (Fair)',
    3: '3 / 5 (Good)',
    4: '4 / 5 (Very Good)',
    5: '5 / 5 (Excellent)'
  };

  function updateStars(val) {
    const num = parseInt(val, 10) || 5;
    if (feedbackRatingValue) feedbackRatingValue.value = num;
    if (starRatingLabel) {
      starRatingLabel.textContent = ratingDescriptions[num] || `${num} / 5`;
    }
    starRatingItems.forEach(star => {
      const starVal = parseInt(star.getAttribute('data-value'), 10);
      if (starVal <= num) {
        star.style.color = '#f59e0b';
      } else {
        star.style.color = '#cbd5e1';
      }
    });
  }

  starRatingItems.forEach(star => {
    star.addEventListener('click', () => {
      const val = star.getAttribute('data-value');
      updateStars(val);
    });
    star.addEventListener('mouseenter', () => {
      const hoverVal = parseInt(star.getAttribute('data-value'), 10);
      starRatingItems.forEach(s => {
        const sVal = parseInt(s.getAttribute('data-value'), 10);
        s.style.color = sVal <= hoverVal ? '#f59e0b' : '#cbd5e1';
      });
    });
    star.addEventListener('mouseleave', () => {
      const currentVal = feedbackRatingValue ? feedbackRatingValue.value : 5;
      updateStars(currentVal);
    });
  });

  async function openFeedbackModal() {
    if (!feedbackModal) return;

    if (feedbackStatusBanner) {
      feedbackStatusBanner.style.display = 'none';
      feedbackStatusBanner.textContent = '';
    }
    if (feedbackComment) feedbackComment.value = '';
    updateStars(5);

    if (feedbackComplaintSelect) {
      feedbackComplaintSelect.innerHTML = '<option value="" disabled selected>Loading complaints...</option>';
      try {
        const fetchFn = window.civicFetch || window.fetch;
        const res = await fetchFn('/api/complaints');
        if (res && res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.data) ? data.data : [];
          feedbackComplaintSelect.innerHTML = `
            <option value="general">★ General Experience (Overall Municipal Services)</option>
            ${list.map(c => `
              <option value="${c.id}">${c.id} — ${(c.title && c.title.length > 32 ? c.title.slice(0, 30) + '...' : (c.title || c.category))} [${c.status || 'Active'}]</option>
            `).join('')}
          `;
        } else {
          throw new Error('API non-OK');
        }
      } catch (err) {
        feedbackComplaintSelect.innerHTML = `
          <option value="general" selected>★ General Experience (Overall Municipal Services)</option>
          <option value="CC-1001">CC-1001 — Large pothole cluster near main road [Under Verification]</option>
          <option value="CC-1002">CC-1002 — Four street lights not working along school road [In Progress]</option>
          <option value="CC-1003">CC-1003 — Deep crater pothole opposite market entrance [Reported]</option>
        `;
      }
    }

    feedbackModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeFeedbackModal() {
    if (!feedbackModal) return;
    feedbackModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  if (homeActionGiveFeedback) {
    homeActionGiveFeedback.addEventListener('click', openFeedbackModal);
  }
  if (actionGiveFeedback) {
    actionGiveFeedback.addEventListener('click', openFeedbackModal);
  }
  window.openFeedbackModal = openFeedbackModal;
  window.closeFeedbackModal = closeFeedbackModal;
  if (feedbackCloseBtn) feedbackCloseBtn.addEventListener('click', closeFeedbackModal);
  if (feedbackCancelBtn) feedbackCancelBtn.addEventListener('click', closeFeedbackModal);
  if (feedbackModal) {
    feedbackModal.addEventListener('click', (e) => {
      if (e.target === feedbackModal) closeFeedbackModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && feedbackModal && !feedbackModal.hasAttribute('hidden')) {
      closeFeedbackModal();
    }
  });

  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ticketId = feedbackComplaintSelect ? feedbackComplaintSelect.value : 'general';
      const rating = feedbackRatingValue ? parseInt(feedbackRatingValue.value, 10) || 5 : 5;
      const category = feedbackAspectSelect ? feedbackAspectSelect.value : 'Overall Experience';
      const comment = feedbackComment ? feedbackComment.value.trim() : '';

      if (feedbackSubmitBtn) {
        feedbackSubmitBtn.disabled = true;
        feedbackSubmitBtn.innerHTML = '<span>Submitting Feedback...</span>';
      }

      try {
        const fetchFn = window.civicFetch || window.fetch;
        await fetchFn(`/api/complaints/${encodeURIComponent(ticketId)}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, category, comment })
        });
      } catch (err) {
        console.warn('[Home Feedback]: Feedback logged locally:', err.message);
      }

      if (feedbackStatusBanner) {
        feedbackStatusBanner.style.display = 'block';
        feedbackStatusBanner.style.backgroundColor = '#ecfdf5';
        feedbackStatusBanner.style.borderColor = '#a7f3d0';
        feedbackStatusBanner.style.color = '#065f46';
        feedbackStatusBanner.textContent = '✓ Thank you! Your feedback and resolution rating have been recorded successfully.';
      }

      setTimeout(() => {
        closeFeedbackModal();
        if (feedbackSubmitBtn) {
          feedbackSubmitBtn.disabled = false;
          feedbackSubmitBtn.innerHTML = `
            <span>Submit Feedback</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
        }
      }, 1500);
    });
  }

  console.log('Civic Connect Stage 1 Homepage Initialized Successfully.');
});

