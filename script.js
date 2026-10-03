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
   * 3. ACTIVE NAVIGATION LINK ON SCROLL (Intersection Observer)
   * -------------------------------------------------------- */
  const sections = document.querySelectorAll('section[id]');
  
  if ('IntersectionObserver' in window && sections.length > 0) {
    const observerOptions = {
      root: null,
      rootMargin: '-30% 0px -60% 0px',
      threshold: 0
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const activeId = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            if (link.getAttribute('href') === `#${activeId}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach(sec => sectionObserver.observe(sec));
  }

  /* --------------------------------------------------------
   * 4. COMPLAINT CATEGORY FILTER (Vanilla JS Filtering)
   * -------------------------------------------------------- */
  const filterButtons = document.querySelectorAll('.filter-btn');
  const complaintCards = document.querySelectorAll('.complaint-card');

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 1. Update active button style
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // 2. Get chosen filter value ('all', 'under-review', 'in-progress', 'resolved')
      const chosenFilter = button.getAttribute('data-filter');

      // 3. Show or hide cards based on category
      complaintCards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        
        if (chosenFilter === 'all' || chosenFilter === cardCategory) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  /* --------------------------------------------------------
   * 5. INTERACTIVE UPVOTE TOGGLE (Demonstration Feature)
   * -------------------------------------------------------- */
  const upvoteButtons = document.querySelectorAll('.upvote-btn');

  upvoteButtons.forEach(button => {
    button.addEventListener('click', () => {
      const countSpan = button.querySelector('.vote-count');
      const textSpan = button.querySelector('.upvote-text');
      let currentVotes = parseInt(button.getAttribute('data-votes'), 10) || 0;
      const isUpvoted = button.classList.contains('upvoted');

      if (isUpvoted) {
        // Decrement (un-upvote)
        currentVotes -= 1;
        button.classList.remove('upvoted');
        if (textSpan) textSpan.textContent = 'Upvote';
      } else {
        // Increment (upvote)
        currentVotes += 1;
        button.classList.add('upvoted');
        if (textSpan) textSpan.textContent = 'Upvoted';
      }

      button.setAttribute('data-votes', currentVotes);
      if (countSpan) countSpan.textContent = currentVotes;
    });
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

  const openReportModalBtn = document.getElementById('openReportModalBtn');
  const heroReportBtn = document.getElementById('heroReportBtn');
  const loginSignupBtn = document.getElementById('loginSignupBtn');
  const privacyLink = document.getElementById('privacyLink');
  const termsLink = document.getElementById('termsLink');
  const charterLink = document.getElementById('charterLink');

  // Helper function to show modal with custom text
  function showModal(title, contentHtml) {
    if (!infoModal) return;
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHtml;
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

  // Trigger modal when clicking "Report a Problem" demo triggers
  if (openReportModalBtn) {
    openReportModalBtn.addEventListener('click', () => {
      showModal(
        'Reporting Flow Preview (Stage 1)',
        `<p>You are viewing the <strong>Stage 1 Frontend Prototype</strong> of Civic Connect.</p>
         <p>In <strong>Stage 2</strong>, this button will open our step-by-step reporting wizard with:</p>
         <div class="modal-callout">
           <strong>Upcoming Features:</strong>
           <ul>
             <li>Live GPS Geolocation Pinning</li>
             <li>Camera & Photo Upload with Preview</li>
             <li>Road Hazard Severity Rating</li>
             <li>Automatic Ward & Department Routing</li>
           </ul>
         </div>`
      );
    });
  }

  // Trigger modal when clicking Login/Signup
  if (loginSignupBtn) {
    loginSignupBtn.addEventListener('click', () => {
      showModal(
        'Authentication & User Profiles (Stage 3)',
        `<p>Welcome to <strong>Civic Connect</strong>!</p>
         <p>User authentication (Citizen login, Municipal Officer portals, and OTP verification) will be added in <strong>Stage 3</strong> when we introduce the backend and database.</p>
         <div class="modal-callout">
           <strong>Planned Auth Roles:</strong>
           <ul>
             <li><strong>Citizens:</strong> Report hazards, track personal complaints, and upvote neighborhood issues.</li>
             <li><strong>Ward Officers:</strong> Review submissions, assign repair contractors, and verify fixes.</li>
           </ul>
         </div>`
      );
    });
  }

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

  console.log('Civic Connect Stage 1 Homepage Initialized Successfully.');
});
