/**
 * ========================================================
 * CIVIC CONNECT - AUTHENTICATION CONTROLLER (auth.js)
 * Stage 9: Real Authentication, Reusable Helpers & Page Protection
 * ========================================================
 * 
 * As a beginner in vibe coding, this file provides:
 * 1. window.CivicAuth: Global authentication helper (me, logout, requireLogin, requireAdmin).
 * 2. Signup Form Submission: POST /api/auth/register with error & success handling.
 * 3. Login Form Submission: POST /api/auth/login with role-based dashboard redirects.
 * 4. Password Visibility Toggles & Real-time Field Validation.
 */

// ========================================================
// 1. REUSABLE CIVIC AUTH GLOBAL HELPER
// ========================================================
window.CivicAuth = {
  /**
   * Fetch current authenticated user from backend using HTTP-only cookie
   * @returns {Promise<Object|null>} user profile or null
   */
  async getCurrentUser() {
    try {
      const fetchFn = window.civicFetch || fetch;
      const response = await fetchFn('/api/auth/me', {
        credentials: 'include'
      });
      if (!response.ok) {
        if (window.CivicApi) window.CivicApi.clearAuth();
        return null;
      }
      const data = await response.json();
      if (data.success && data.user) {
        if (window.CivicApi) window.CivicApi.setAuth(null, data.user);
        return data.user;
      }
      return null;
    } catch (err) {
      console.warn('[CivicAuth]: Could not check session state:', err.message);
      return null;
    }
  },

  /**
   * Log out citizen/admin by instructing backend to clear HTTP-only cookie
   */
  async logout() {
    try {
      const fetchFn = window.civicFetch || fetch;
      await fetchFn('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.warn('[CivicAuth]: Logout network error:', err.message);
    } finally {
      if (window.CivicApi) window.CivicApi.clearAuth();
      this.updateNavbarState(null);
      window.location.replace('login.html');
    }
  },

  /**
   * Protect citizen pages: redirects to login if unauthenticated
   */
  async requireLogin() {
    // 1. Instant local check to prevent content flash
    const localUser = window.CivicApi ? window.CivicApi.getUser() : null;
    const localToken = window.CivicApi ? window.CivicApi.getToken() : null;
    if (!localUser && !localToken) {
      window.location.replace('login.html?redirect=dashboard.html');
      return null;
    }

    // 2. Verified backend session check
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.replace('login.html?redirect=dashboard.html');
      return null;
    }
    return user;
  },

  /**
   * Protect municipal admin pages: enforces role === "admin" or "authority"
   */
  async requireAdmin() {
    const localUser = window.CivicApi ? window.CivicApi.getUser() : null;
    if (!localUser || (localUser.role !== 'admin' && localUser.role !== 'authority')) {
      window.location.replace('login.html?redirect=admin-dashboard.html');
      return null;
    }

    const user = await this.getCurrentUser();
    if (!user) {
      window.location.replace('login.html?redirect=admin-dashboard.html');
      return null;
    }
    if (user.role !== 'admin' && user.role !== 'authority') {
      alert('Access Denied: Municipal Administrator privileges are required to view this console.');
      window.location.replace('dashboard.html');
      return null;
    }
    return user;
  },

  /**
   * Core state synchronizer for navbar and footer authentication links
   */
  updateNavbarState(user) {
    const dashboardNavItems = document.querySelectorAll('.nav-item-dashboard, [data-auth="required"]');
    const footerDashboardItems = document.querySelectorAll('.footer-item-dashboard, .footer-dashboard-link');
    const footerAdminItems = document.querySelectorAll('.footer-admin-link, .auth-admin-divider');
    const authDividers = document.querySelectorAll('.auth-only-divider');
    const navActions = document.querySelector('.nav-actions');

    if (user) {
      // 1. User IS logged in: Reveal Dashboard in navigation
      dashboardNavItems.forEach(el => {
        el.style.display = '';
      });

      const isAdmin = user.role === 'admin' || user.role === 'authority';
      const targetDashboard = isAdmin ? 'admin-dashboard.html' : 'dashboard.html';
      const targetLabel = isAdmin ? 'Admin Dashboard' : 'Dashboard';

      const navDashboardLink = document.getElementById('navDashboardLink');
      if (navDashboardLink) {
        navDashboardLink.href = targetDashboard;
        if (isAdmin) navDashboardLink.textContent = targetLabel;
      }

      // Footer links for logged-in users
      footerDashboardItems.forEach(el => el.style.display = '');
      authDividers.forEach(el => el.style.display = '');

      if (isAdmin) {
        footerAdminItems.forEach(el => el.style.display = '');
      } else {
        footerAdminItems.forEach(el => el.style.display = 'none');
      }

      // Update nav actions with user profile avatar and logout button
      if (navActions) {
        const initials = user.name
          ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
          : 'CU';
        const roleBadge = isAdmin
          ? '<span style="background: #dc2626; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700; margin-left: 4px;">ADMIN</span>'
          : '';

        // Preserve any notification bell wrapper if already mounted
        const existingBell = navActions.querySelector('#civicNotifNavWrapper');

        navActions.innerHTML = `
          <a href="${targetDashboard}" class="btn btn-outline-nav" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.85rem;" title="View Dashboard">
            <span style="background: var(--primary-teal); color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 800;">${initials}</span>
            <span style="font-weight: 600;">${escapeHtml(user.name.split(' ')[0])}</span>
            ${roleBadge}
          </a>
          <button type="button" class="btn btn-secondary-nav" id="globalLogoutBtn" style="padding: 0.45rem 0.85rem; font-size: 0.85rem;">
            Logout
          </button>
        `;

        // Restore notification bell wrapper or trigger mount
        if (existingBell) {
          navActions.insertBefore(existingBell, navActions.firstChild);
        } else if (window.CivicNotifications && typeof window.CivicNotifications.mountNavbarBell === 'function') {
          window.CivicNotifications.mountNavbarBell();
        }

        const logoutBtn = document.getElementById('globalLogoutBtn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.CivicAuth.logout();
          });
        }
      }
    } else {
      // 2. User is NOT logged in: STRICTLY HIDE Dashboard everywhere!
      dashboardNavItems.forEach(el => {
        el.style.display = 'none';
      });

      // Also hide any stray nav-link pointing to dashboard.html
      document.querySelectorAll('.nav-links a[href*="dashboard.html"]').forEach(a => {
        const parentLi = a.closest('li');
        if (parentLi) parentLi.style.display = 'none';
      });

      // Hide all dashboard and admin links in footer
      footerDashboardItems.forEach(el => el.style.display = 'none');
      footerAdminItems.forEach(el => el.style.display = 'none');
      authDividers.forEach(el => el.style.display = 'none');

      // Ensure nav actions show Login and Sign Up buttons if not currently showing them
      if (navActions && !navActions.querySelector('a[href="login.html"]')) {
        const existingBell = navActions.querySelector('#civicNotifNavWrapper');
        navActions.innerHTML = `
          <a href="login.html" class="btn btn-outline-nav">Login</a>
          <a href="signup.html" class="btn btn-secondary-nav">Sign Up</a>
        `;
        if (existingBell) {
          navActions.insertBefore(existingBell, navActions.firstChild);
        } else if (window.CivicNotifications && typeof window.CivicNotifications.mountNavbarBell === 'function') {
          window.CivicNotifications.mountNavbarBell();
        }
      }
    }
  },

  /**
   * Updates page navigation actions (Login/Signup vs User Profile & Logout)
   */
  async updateNavbar() {
    // 1. Instant synchronous update using cached credentials (zero-flicker)
    const localUser = window.CivicApi ? window.CivicApi.getUser() : null;
    this.updateNavbarState(localUser);

    // 2. Asynchronous backend validation with HTTP-only cookie / Bearer token
    try {
      const verifiedUser = await this.getCurrentUser();
      this.updateNavbarState(verifiedUser);
    } catch (err) {
      this.updateNavbarState(null);
    }
  }
};

// Use shared escapeHtml helper
const escapeHtml = window.escapeHtml || ((str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '');


// ========================================================
// 2. DOM INITIALIZATION FOR LOGIN & SIGNUP PAGES
// ========================================================
document.addEventListener('DOMContentLoaded', () => {

  // Auto-update navbar on page load
  window.CivicAuth.updateNavbar();

  /* ========================================================
   * SHOW / HIDE PASSWORD TOGGLE BUTTONS
   * ======================================================== */
  const passwordToggles = document.querySelectorAll('.btn-password-toggle');

  const eyeIconSvg = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;

  const eyeOffIconSvg = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  `;

  passwordToggles.forEach(toggleBtn => {
    toggleBtn.addEventListener('click', () => {
      const targetInputId = toggleBtn.getAttribute('aria-controls');
      const targetInput = document.getElementById(targetInputId);
      if (!targetInput) return;

      const isPassword = targetInput.getAttribute('type') === 'password';
      if (isPassword) {
        targetInput.setAttribute('type', 'text');
        toggleBtn.innerHTML = eyeOffIconSvg;
        toggleBtn.setAttribute('aria-label', 'Hide password');
        toggleBtn.setAttribute('aria-pressed', 'true');
      } else {
        targetInput.setAttribute('type', 'password');
        toggleBtn.innerHTML = eyeIconSvg;
        toggleBtn.setAttribute('aria-label', 'Show password');
        toggleBtn.setAttribute('aria-pressed', 'false');
      }
    });
  });


  /* ========================================================
   * VALIDATION HELPER FUNCTIONS
   * ======================================================== */
  function showError(inputEl, errorEl, message) {
    if (inputEl) {
      inputEl.classList.add('is-invalid');
      inputEl.classList.remove('is-valid');
      inputEl.setAttribute('aria-invalid', 'true');
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }

  function clearError(inputEl, errorEl) {
    if (inputEl) {
      inputEl.classList.remove('is-invalid');
      inputEl.classList.add('is-valid');
      inputEl.removeAttribute('aria-invalid');
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
    }
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  function meetsPasswordPolicy(password) {
    return password.length >= 8;
  }


  /* ========================================================
   * SIGNUP FORM SUBMISSION (signup.html -> POST /api/auth/register)
   * ======================================================== */
  const signupForm = document.getElementById('signupForm');

  if (signupForm) {
    const fullNameInput = document.getElementById('fullName');
    const fullNameError = document.getElementById('fullNameError');

    const emailInput = document.getElementById('emailAddress');
    const emailError = document.getElementById('emailError');

    const passwordInput = document.getElementById('password');
    const passwordError = document.getElementById('passwordError');

    const confirmPasswordInput = document.getElementById('confirmPassword');
    const confirmPasswordError = document.getElementById('confirmPasswordError');

    const termsCheckbox = document.getElementById('termsCheckbox');
    const termsError = document.getElementById('termsError');

    const signupStatusBanner = document.getElementById('signupStatusBanner');
    const signupSubmitBtn = document.querySelector('#signupForm button[type="submit"]');

    // Role switcher elements for signup
    const signupRoleCitizen = document.getElementById('signupRoleCitizen');
    const signupRoleAuthority = document.getElementById('signupRoleAuthority');
    const signupAuthBadge = document.getElementById('signupAuthBadge');
    const signupAuthTitle = document.getElementById('signupAuthTitle');
    const signupAuthSubtitle = document.getElementById('signupAuthSubtitle');
    const authorityDeptGroup = document.getElementById('authorityDeptGroup');
    const fullNameLabel = document.getElementById('fullNameLabel');

    function setSignupRole(role) {
      if (!signupForm) return;
      signupForm.setAttribute('data-selected-role', role);

      if (role === 'authority') {
        if (signupRoleCitizen) {
          signupRoleCitizen.classList.remove('active');
          signupRoleCitizen.setAttribute('aria-selected', 'false');
        }
        if (signupRoleAuthority) {
          signupRoleAuthority.classList.add('active');
          signupRoleAuthority.setAttribute('aria-selected', 'true');
        }
        if (signupAuthBadge) signupAuthBadge.innerHTML = '<span>●</span> Municipal Authority Registration';
        if (signupAuthTitle) signupAuthTitle.textContent = 'Authority Registration';
        if (signupAuthSubtitle) {
          signupAuthSubtitle.textContent = 'Create an official Municipal Authority account to review ward hazards, assign road repair teams, and update complaint status.';
        }
        if (authorityDeptGroup) authorityDeptGroup.style.display = 'block';
        if (fullNameLabel) fullNameLabel.innerHTML = 'Officer Full Name <span class="required-star">*</span>';
        if (signupSubmitBtn) signupSubmitBtn.textContent = 'Create Municipal Authority Account';
      } else {
        if (signupRoleAuthority) {
          signupRoleAuthority.classList.remove('active');
          signupRoleAuthority.setAttribute('aria-selected', 'false');
        }
        if (signupRoleCitizen) {
          signupRoleCitizen.classList.add('active');
          signupRoleCitizen.setAttribute('aria-selected', 'true');
        }
        if (signupAuthBadge) signupAuthBadge.innerHTML = '<span>●</span> Citizen Registration';
        if (signupAuthTitle) signupAuthTitle.textContent = 'Create Your Account';
        if (signupAuthSubtitle) {
          signupAuthSubtitle.textContent = 'Join Civic Connect to report road hazards, support neighborhood repairs, and track verified civic solutions in your ward.';
        }
        if (authorityDeptGroup) authorityDeptGroup.style.display = 'none';
        if (fullNameLabel) fullNameLabel.innerHTML = 'Full Name <span class="required-star">*</span>';
        if (signupSubmitBtn) signupSubmitBtn.textContent = 'Create Citizen Account';
      }
    }

    if (signupRoleCitizen) signupRoleCitizen.addEventListener('click', () => setSignupRole('citizen'));
    if (signupRoleAuthority) signupRoleAuthority.addEventListener('click', () => setSignupRole('authority'));

    function validateFullName() {
      const val = fullNameInput.value.trim();
      if (!val) {
        showError(fullNameInput, fullNameError, 'Please enter your full name.');
        return false;
      }
      if (val.length < 2) {
        showError(fullNameInput, fullNameError, 'Name must be at least 2 characters long.');
        return false;
      }
      clearError(fullNameInput, fullNameError);
      return true;
    }

    function validateEmail() {
      const val = emailInput.value.trim();
      if (!val) {
        showError(emailInput, emailError, 'Please enter your email address.');
        return false;
      }
      if (!isValidEmail(val)) {
        showError(emailInput, emailError, 'Please enter a valid email format (e.g., citizen@example.com).');
        return false;
      }
      clearError(emailInput, emailError);
      return true;
    }

    function validatePassword() {
      const val = passwordInput.value;
      if (!val) {
        showError(passwordInput, passwordError, 'Please create a secure password.');
        return false;
      }
      if (!meetsPasswordPolicy(val)) {
        showError(passwordInput, passwordError, 'Password must be at least 8 characters.');
        return false;
      }
      clearError(passwordInput, passwordError);
      if (confirmPasswordInput && confirmPasswordInput.value) {
        validateConfirmPassword();
      }
      return true;
    }

    function validateConfirmPassword() {
      const passwordVal = passwordInput.value;
      const confirmVal = confirmPasswordInput.value;

      if (!confirmVal) {
        showError(confirmPasswordInput, confirmPasswordError, 'Please confirm your password.');
        return false;
      }
      if (passwordVal !== confirmVal) {
        showError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match. Please verify both entries.');
        return false;
      }
      clearError(confirmPasswordInput, confirmPasswordError);
      return true;
    }

    function validateTerms() {
      if (termsCheckbox && !termsCheckbox.checked) {
        if (termsError) {
          termsError.textContent = 'You must agree to the Terms & Conditions to create an account.';
          termsError.classList.add('visible');
        }
        return false;
      }
      if (termsError) {
        termsError.textContent = '';
        termsError.classList.remove('visible');
      }
      return true;
    }

    // Attach real-time input validation
    if (fullNameInput) fullNameInput.addEventListener('blur', validateFullName);
    if (emailInput) emailInput.addEventListener('blur', validateEmail);
    if (passwordInput) passwordInput.addEventListener('blur', validatePassword);
    if (confirmPasswordInput) confirmPasswordInput.addEventListener('blur', validateConfirmPassword);
    if (termsCheckbox) termsCheckbox.addEventListener('change', validateTerms);

    // Form submission handler
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const isNameValid = validateFullName();
      const isEmailValid = validateEmail();
      const isPassValid = validatePassword();
      const isConfirmValid = validateConfirmPassword();
      const isTermsValid = validateTerms();

      if (!isNameValid || !isEmailValid || !isPassValid || !isConfirmValid || !isTermsValid) {
        const firstInvalid = signupForm.querySelector('.is-invalid, input:invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const selectedRole = signupForm.getAttribute('data-selected-role') || 'citizen';
      const isAuthority = selectedRole === 'authority';
      const roleLabel = isAuthority ? 'Municipal Authority' : 'Citizen';

      // UI Loading State
      const originalBtnText = signupSubmitBtn ? signupSubmitBtn.innerHTML : 'Create Account';
      if (signupSubmitBtn) {
        signupSubmitBtn.disabled = true;
        signupSubmitBtn.textContent = `Registering ${roleLabel} Profile...`;
      }

      try {
        const fetchFn = window.civicFetch || fetch;
        const response = await fetchFn('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: fullNameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value,
            role: selectedRole
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          if (result.token && window.CivicApi) {
            window.CivicApi.setAuth(result.token, result.user);
          }
          if (signupStatusBanner) {
            signupStatusBanner.className = 'auth-status-banner visible';
            signupStatusBanner.style.backgroundColor = '#ecfdf5';
            signupStatusBanner.style.borderColor = '#a7f3d0';
            signupStatusBanner.style.color = '#065f46';
            signupStatusBanner.innerHTML = `
              <strong>✓ ${roleLabel} Registration Successful!</strong>
              <p>Welcome to Civic Connect, ${escapeHtml(result.user.name)}. Your ${roleLabel} account is now active.</p>
              <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #047857;">Redirecting to Login portal in 2 seconds...</p>
            `;
            signupStatusBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          signupForm.reset();

          // Redirect to login with appropriate role tab pre-selected
          setTimeout(() => {
            window.location.href = isAuthority ? 'login.html?registered=true&role=authority' : 'login.html?registered=true';
          }, 1800);
        } else {
          throw new Error(result.message || 'Registration failed');
        }
      } catch (err) {
        if (signupStatusBanner) {
          signupStatusBanner.className = 'auth-status-banner visible';
          signupStatusBanner.style.backgroundColor = '#fef2f2';
          signupStatusBanner.style.borderColor = '#fecaca';
          signupStatusBanner.style.color = '#991b1b';
          const isFetchError = err.message === 'Failed to fetch' || err.name === 'TypeError';
          const msg = isFetchError 
            ? 'Backend server is not running! Please start the backend with <code>npm start</code> in your terminal, then open <strong>http://localhost:5000/signup.html</strong>.' 
            : escapeHtml(err.message);
          signupStatusBanner.innerHTML = `
            <strong>❌ Registration Notice</strong>
            <p>${msg}</p>
          `;
          signupStatusBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } finally {
        if (signupSubmitBtn) {
          signupSubmitBtn.disabled = false;
          signupSubmitBtn.innerHTML = originalBtnText;
        }
      }
    });
  }


  /* ========================================================
   * LOGIN FORM SUBMISSION (login.html -> POST /api/auth/login)
   * ======================================================== */
  const loginForm = document.getElementById('loginForm');

  if (loginForm) {
    const loginIdentifierInput = document.getElementById('loginIdentifier');
    const loginIdentifierError = document.getElementById('loginIdentifierError');

    const loginPasswordInput = document.getElementById('loginPassword');
    const loginPasswordError = document.getElementById('loginPasswordError');

    const loginStatusBanner = document.getElementById('loginStatusBanner');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');

    // Check if user just registered or was redirected because login was required
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'true' && loginStatusBanner) {
      loginStatusBanner.className = 'auth-status-banner visible';
      loginStatusBanner.style.backgroundColor = '#ecfdf5';
      loginStatusBanner.style.borderColor = '#a7f3d0';
      loginStatusBanner.style.color = '#065f46';
      loginStatusBanner.innerHTML = `
        <strong>✓ Registration Complete!</strong>
        <p>Please enter your email and password below to log in.</p>
      `;
    } else if (urlParams.get('redirect') && loginStatusBanner) {
      loginStatusBanner.className = 'auth-status-banner visible';
      loginStatusBanner.style.backgroundColor = '#eff6ff';
      loginStatusBanner.style.borderColor = '#bfdbfe';
      loginStatusBanner.style.color = '#1e40af';
      loginStatusBanner.innerHTML = `
        <strong>🔒 Login Required</strong>
        <p>Please log in to your account to view your Civic Dashboard.</p>
      `;
    }

    // --------------------------------------------------------
    // Role Selection Tabs Logic (Citizen vs Authority)
    // --------------------------------------------------------
    const roleTabCitizen = document.getElementById('roleTabCitizen');
    const roleTabAuthority = document.getElementById('roleTabAuthority');
    const authBadge = document.getElementById('authBadge');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const authoritySecurityNotice = document.getElementById('authoritySecurityNotice');
    const loginIdentifierLabel = document.getElementById('loginIdentifierLabel');
    const authFooterText = document.getElementById('authFooterText');
    const authSwitchLink = document.getElementById('authSwitchLink');

    let selectedRole = 'citizen';

    function setLoginRole(role) {
      selectedRole = role;
      if (loginForm) loginForm.setAttribute('data-selected-role', role);

      if (role === 'authority') {
        if (roleTabCitizen) {
          roleTabCitizen.classList.remove('active');
          roleTabCitizen.setAttribute('aria-selected', 'false');
        }
        if (roleTabAuthority) {
          roleTabAuthority.classList.add('active');
          roleTabAuthority.setAttribute('aria-selected', 'true');
        }

        if (authBadge) {
          authBadge.innerHTML = '<span style="color: #dc2626;">🛡️</span> Municipal Authority Portal';
          authBadge.style.backgroundColor = '#fef2f2';
          authBadge.style.color = '#991b1b';
        }
        if (authTitle) authTitle.textContent = 'Authority Console Sign In';
        if (authSubtitle) authSubtitle.textContent = 'Authorized municipal personnel access for works engineers, ward supervisors, and public administrators.';
        if (authoritySecurityNotice) authoritySecurityNotice.style.display = 'flex';
        if (loginIdentifierLabel) loginIdentifierLabel.innerHTML = 'Official Municipal Email <span class="required-star">*</span>';
        if (loginIdentifierInput) loginIdentifierInput.placeholder = 'officer@civicconnect.org (Official Email)';
        if (loginSubmitBtn) loginSubmitBtn.textContent = 'Log In as Authority';

        if (authFooterText) authFooterText.textContent = 'Need citizen reporting portal?';
        if (authSwitchLink) {
          authSwitchLink.textContent = 'Switch to Citizen Login';
          authSwitchLink.href = '#';
          authSwitchLink.onclick = (e) => {
            e.preventDefault();
            setLoginRole('citizen');
          };
        }
      } else {
        if (roleTabCitizen) {
          roleTabCitizen.classList.add('active');
          roleTabCitizen.setAttribute('aria-selected', 'true');
        }
        if (roleTabAuthority) {
          roleTabAuthority.classList.remove('active');
          roleTabAuthority.setAttribute('aria-selected', 'false');
        }

        if (authBadge) {
          authBadge.innerHTML = '<span>●</span> Citizen Portal';
          authBadge.style.backgroundColor = 'var(--primary-teal-light)';
          authBadge.style.color = 'var(--primary-teal)';
        }
        if (authTitle) authTitle.textContent = 'Welcome Back';
        if (authSubtitle) authSubtitle.textContent = 'Sign in to track your reported road complaints, upvote local hazards, and receive municipal updates.';
        if (authoritySecurityNotice) authoritySecurityNotice.style.display = 'none';
        if (loginIdentifierLabel) loginIdentifierLabel.innerHTML = 'Email or Mobile Number <span class="required-star">*</span>';
        if (loginIdentifierInput) loginIdentifierInput.placeholder = 'name@example.com or 10-digit mobile';
        if (loginSubmitBtn) loginSubmitBtn.textContent = 'Log In as Citizen';

        if (authFooterText) authFooterText.textContent = "Don't have an account yet?";
        if (authSwitchLink) {
          authSwitchLink.textContent = 'Create Citizen Account';
          authSwitchLink.href = 'signup.html';
          authSwitchLink.onclick = null;
        }
      }

      // Clear any previous error banner when switching roles
      if (loginStatusBanner) {
        loginStatusBanner.className = 'auth-status-banner';
        loginStatusBanner.innerHTML = '';
      }
    }

    if (roleTabCitizen) roleTabCitizen.addEventListener('click', () => setLoginRole('citizen'));
    if (roleTabAuthority) roleTabAuthority.addEventListener('click', () => setLoginRole('authority'));

    // Check URL parameters: e.g. login.html?role=authority
    const urlRole = urlParams.get('role');
    if (urlRole === 'authority' || urlRole === 'admin') {
      setLoginRole('authority');
    }

    function validateLoginIdentifier() {
      const val = loginIdentifierInput.value.trim();
      if (!val) {
        showError(loginIdentifierInput, loginIdentifierError, selectedRole === 'authority' ? 'Please enter your official municipal email address.' : 'Please enter your registered email address.');
        return false;
      }
      clearError(loginIdentifierInput, loginIdentifierError);
      return true;
    }

    function validateLoginPassword() {
      const val = loginPasswordInput.value;
      if (!val) {
        showError(loginPasswordInput, loginPasswordError, 'Please enter your password.');
        return false;
      }
      clearError(loginPasswordInput, loginPasswordError);
      return true;
    }

    if (loginIdentifierInput) loginIdentifierInput.addEventListener('blur', validateLoginIdentifier);
    if (loginPasswordInput) loginPasswordInput.addEventListener('blur', validateLoginPassword);

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const isIdentifierValid = validateLoginIdentifier();
      const isPasswordValid = validateLoginPassword();

      if (!isIdentifierValid || !isPasswordValid) {
        const firstInvalid = loginForm.querySelector('.is-invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // UI Loading state
      const originalSubmitText = loginSubmitBtn ? loginSubmitBtn.textContent : 'Log In';
      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = 'Verifying Credentials...';
      }

      try {
        const fetchFn = window.civicFetch || fetch;
        const response = await fetchFn('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: loginIdentifierInput.value.trim(),
            password: loginPasswordInput.value
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          if (result.token && window.CivicApi) {
            window.CivicApi.setAuth(result.token, result.user);
          }

          const isAuthorityRole = result.user.role === 'admin' || result.user.role === 'authority';

          // Enforce role separation if logged in via Authority tab
          if (selectedRole === 'authority' && !isAuthorityRole) {
            if (loginStatusBanner) {
              loginStatusBanner.className = 'auth-status-banner visible';
              loginStatusBanner.style.backgroundColor = '#fef2f2';
              loginStatusBanner.style.borderColor = '#fecaca';
              loginStatusBanner.style.color = '#991b1b';
              loginStatusBanner.innerHTML = `
                <strong>❌ Access Denied: Citizen Account</strong>
                <p>The credentials entered belong to a Citizen account. Municipal Authority credentials are required for the Authority Portal.</p>
                <div style="margin-top: 0.6rem;">
                  <button type="button" class="btn btn-outline" id="switchToCitizenBtn" style="padding: 4px 10px; font-size: 0.8rem;">
                    Switch to Citizen Portal &rarr;
                  </button>
                </div>
              `;
              loginStatusBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              const switchBtn = document.getElementById('switchToCitizenBtn');
              if (switchBtn) switchBtn.addEventListener('click', () => setLoginRole('citizen'));
            }
            return;
          }

          if (loginStatusBanner) {
            loginStatusBanner.className = 'auth-status-banner visible';
            loginStatusBanner.style.backgroundColor = '#ecfdf5';
            loginStatusBanner.style.borderColor = '#a7f3d0';
            loginStatusBanner.style.color = '#065f46';
            loginStatusBanner.innerHTML = `
              <strong>✓ ${isAuthorityRole ? 'Authority Access Verified!' : 'Login Successful!'}</strong>
              <p>Welcome back, ${escapeHtml(result.user.name)}. Authenticated successfully as ${isAuthorityRole ? 'Municipal Authority' : 'Citizen'}.</p>
            `;
          }

          // Role-based navigation: Authority/Admin -> admin-dashboard.html, Citizen -> dashboard.html
          const urlParams = new URLSearchParams(window.location.search);
          const redirectTarget = urlParams.get('redirect');

          setTimeout(() => {
            if (isAuthorityRole) {
              window.location.href = (redirectTarget && redirectTarget.includes('admin')) ? redirectTarget : 'admin-dashboard.html';
            } else {
              window.location.href = redirectTarget || 'dashboard.html';
            }
          }, 800);
        } else {
          throw new Error(result.message || 'Invalid email or password');
        }
      } catch (err) {
        if (loginStatusBanner) {
          loginStatusBanner.className = 'auth-status-banner visible';
          loginStatusBanner.style.backgroundColor = '#fef2f2';
          loginStatusBanner.style.borderColor = '#fecaca';
          loginStatusBanner.style.color = '#991b1b';
          const isFetchError = err.message === 'Failed to fetch' || err.name === 'TypeError';
          const msg = isFetchError 
            ? 'Backend server is not running or unreachable! Please run <code>npm start</code> in your terminal and open <strong>http://localhost:5000/login.html</strong>.' 
            : escapeHtml(err.message);
          loginStatusBanner.innerHTML = `
            <strong>❌ Authentication Failed</strong>
            <p>${msg}</p>
          `;
          loginStatusBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } finally {
        if (loginSubmitBtn) {
          loginSubmitBtn.disabled = false;
          loginSubmitBtn.textContent = originalSubmitText;
        }
      }
    });
  }


  /* ========================================================
   * INFORMATIONAL MODAL DIALOG CONTROLLER
   * ======================================================== */
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const infoModal = document.getElementById('infoModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  function openAuthModal(title, htmlContent) {
    if (!infoModal) return;
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = htmlContent;
    infoModal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeAuthModal() {
    if (!infoModal) return;
    infoModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal(
        'Password Recovery Notice',
        `<p>You clicked <strong>Forgot Password</strong>.</p>
         <p>In accordance with the Stage 9 specification, email password reset workflows (magic links/OTPs) are scheduled for a subsequent stage.</p>
         <p style="margin-top: 1rem; font-size: 0.85rem; color: #64748b;">
           For demo testing, please register a new citizen account or use your existing test password.
         </p>`
      );
    });
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeAuthModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeAuthModal);
  if (infoModal) {
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) closeAuthModal();
    });
  }
});
