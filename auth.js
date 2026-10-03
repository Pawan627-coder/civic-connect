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
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (!response.ok) return null;
      const data = await response.json();
      return (data.success && data.user) ? data.user : null;
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
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.warn('[CivicAuth]: Logout network error:', err.message);
    } finally {
      window.location.href = 'login.html';
    }
  },

  /**
   * Protect citizen pages: redirects to login if unauthenticated
   */
  async requireLogin() {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    return user;
  },

  /**
   * Protect municipal admin pages: enforces role === "admin"
   */
  async requireAdmin() {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    if (user.role !== 'admin') {
      alert('Access Denied: Municipal Administrator privileges are required to view this console.');
      window.location.href = 'dashboard.html';
      return null;
    }
    return user;
  },

  /**
   * Updates page navigation actions (Login/Signup vs User Profile & Logout)
   */
  async updateNavbar() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    const user = await this.getCurrentUser();
    if (user) {
      const initials = user.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : 'CU';

      const dashboardLink = user.role === 'admin' ? 'admin-dashboard.html' : 'dashboard.html';
      const roleBadge = user.role === 'admin'
        ? '<span style="background: #dc2626; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 9999px; font-weight: 700; margin-left: 4px;">ADMIN</span>'
        : '';

      navActions.innerHTML = `
        <a href="${dashboardLink}" class="btn btn-outline-nav" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.85rem;" title="View Dashboard">
          <span style="background: var(--primary-teal); color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 800;">${initials}</span>
          <span style="font-weight: 600;">${escapeHtml(user.name.split(' ')[0])}</span>
          ${roleBadge}
        </a>
        <button type="button" class="btn btn-secondary-nav" id="globalLogoutBtn" style="padding: 0.45rem 0.85rem; font-size: 0.85rem;">
          Logout
        </button>
      `;

      const logoutBtn = document.getElementById('globalLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => window.CivicAuth.logout());
      }
    }
  }
};

// Helper to escape HTML characters
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


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

      // UI Loading State
      const originalBtnText = signupSubmitBtn ? signupSubmitBtn.innerHTML : 'Create Account';
      if (signupSubmitBtn) {
        signupSubmitBtn.disabled = true;
        signupSubmitBtn.textContent = 'Registering Citizen Profile...';
      }

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: fullNameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          if (signupStatusBanner) {
            signupStatusBanner.className = 'auth-status-banner visible';
            signupStatusBanner.style.backgroundColor = '#ecfdf5';
            signupStatusBanner.style.borderColor = '#a7f3d0';
            signupStatusBanner.style.color = '#065f46';
            signupStatusBanner.innerHTML = `
              <strong>✓ Registration Successful!</strong>
              <p>Welcome to Civic Connect, ${escapeHtml(result.user.name)}. Your citizen account has been created securely in MongoDB.</p>
              <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #047857;">Redirecting to Login portal in 2 seconds...</p>
            `;
            signupStatusBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          signupForm.reset();

          // Redirect to login after brief confirmation
          setTimeout(() => {
            window.location.href = 'login.html?registered=true';
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
          signupStatusBanner.innerHTML = `
            <strong>❌ Registration Notice</strong>
            <p>${escapeHtml(err.message)}</p>
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

    // Check if user just registered
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
    }

    function validateLoginIdentifier() {
      const val = loginIdentifierInput.value.trim();
      if (!val) {
        showError(loginIdentifierInput, loginIdentifierError, 'Please enter your registered email address.');
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
      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = 'Verifying Credentials...';
      }

      try {
        const response = await fetch('/api/auth/login', {
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
          if (loginStatusBanner) {
            loginStatusBanner.className = 'auth-status-banner visible';
            loginStatusBanner.style.backgroundColor = '#ecfdf5';
            loginStatusBanner.style.borderColor = '#a7f3d0';
            loginStatusBanner.style.color = '#065f46';
            loginStatusBanner.innerHTML = `
              <strong>✓ Login Successful!</strong>
              <p>Welcome back, ${escapeHtml(result.user.name)}. Authenticated via secure HTTP-only cookie.</p>
            `;
          }

          // Role-based navigation: Admin -> admin-dashboard.html, Citizen -> dashboard.html
          setTimeout(() => {
            if (result.user.role === 'admin') {
              window.location.href = 'admin-dashboard.html';
            } else {
              window.location.href = 'dashboard.html';
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
          loginStatusBanner.innerHTML = `
            <strong>❌ Authentication Failed</strong>
            <p>${escapeHtml(err.message)}</p>
          `;
          loginStatusBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } finally {
        if (loginSubmitBtn) {
          loginSubmitBtn.disabled = false;
          loginSubmitBtn.textContent = 'Log In';
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
