/**
 * ========================================================
 * CIVIC CONNECT - UNIFIED CLIENT API LAYER (api-config.js)
 * Synchronizes API endpoints, authentication, and base URLs
 * across all pages (Localhost, Netlify, Hosted Backend).
 * ========================================================
 */

(function () {
  const STORAGE_API_KEY = 'civic_api_base_url';
  const STORAGE_TOKEN_KEY = 'civic_token';
  const STORAGE_USER_KEY = 'civic_user';

  // Determine base API URL
  function resolveApiBaseUrl() {
    // 1. Explicit override saved by developer / administrator
    const saved = localStorage.getItem(STORAGE_API_KEY);
    if (saved && saved.trim() !== '') {
      return saved.trim().replace(/\/+$/, '');
    }

    // 2. Local file protocol (double clicked .html file directly) -> Target Express backend port 5000
    if (window.location.protocol === 'file:' || !window.location.hostname) {
      return 'http://localhost:5000';
    }

    // 3. Local development on Live Server (e.g. port 5500, 3000, 8080) -> Target Express backend port 5000
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port && window.location.port !== '5000') {
        return `http://${window.location.hostname}:5000`;
      }
      return ''; // Same-origin when served directly by Express on port 5000
    }

    // 4. Deployed frontend (e.g. Netlify)
    // When deployed on Netlify, _redirects proxies /api/* to the backend server.
    // If not proxied, users can configure their deployed backend URL via the status widget.
    return '';
  }

  const API_BASE_URL = resolveApiBaseUrl();

  /**
   * Unified fetch wrapper for all Civic Connect requests
   */
  async function civicFetch(endpoint, options = {}) {
    const opts = { ...options };
    opts.headers = { ...(opts.headers || {}) };

    // Include credentials for cookies
    opts.credentials = opts.credentials || 'include';

    // Include Bearer token from localStorage (vital for cross-origin deployments)
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (token && !opts.headers['Authorization']) {
      opts.headers['Authorization'] = `Bearer ${token}`;
    }

    // Auto-serialize JSON body
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData) && !(opts.body instanceof Blob)) {
      opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
      opts.body = JSON.stringify(opts.body);
    }

    // Resolve full URL
    let fullUrl = endpoint;
    if (endpoint.startsWith('/api')) {
      const base = window.CivicApi ? window.CivicApi.getBaseUrl() : API_BASE_URL;
      fullUrl = base ? `${base}${endpoint}` : endpoint;
    }

    try {
      const response = await fetch(fullUrl, opts);

      // Handle global 401 unauthenticated
      if (response.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/register')) {
        // If server says token expired or invalid, clear local credentials
        if (endpoint.includes('/api/auth/me')) {
          localStorage.removeItem(STORAGE_TOKEN_KEY);
          localStorage.removeItem(STORAGE_USER_KEY);
        }
      }

      return response;
    } catch (networkError) {
      console.warn(`[CivicAPI Network Notice]: Failed to connect to ${fullUrl} - ${networkError.message}`);
      throw networkError;
    }
  }

  // Global namespace
  window.CivicApi = {
    getBaseUrl: () => {
      const saved = localStorage.getItem(STORAGE_API_KEY);
      if (saved && saved.trim() !== '') return saved.trim().replace(/\/+$/, '');
      if (window.location.protocol === 'file:' || !window.location.hostname) {
        return 'http://localhost:5000';
      }
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (window.location.port && window.location.port !== '5000') {
          return `http://${window.location.hostname}:5000`;
        }
      }
      return '';
    },
    setBaseUrl: (url) => {
      if (!url) {
        localStorage.removeItem(STORAGE_API_KEY);
      } else {
        localStorage.setItem(STORAGE_API_KEY, url.trim().replace(/\/+$/, ''));
      }
      window.location.reload();
    },
    getToken: () => localStorage.getItem(STORAGE_TOKEN_KEY),
    setAuth: (token, user) => {
      if (token) localStorage.setItem(STORAGE_TOKEN_KEY, token);
      if (user) localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    },
    clearAuth: () => {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    },
    getUser: () => {
      try {
        const u = localStorage.getItem(STORAGE_USER_KEY);
        return u ? JSON.parse(u) : null;
      } catch (e) {
        return null;
      }
    },
    fetch: civicFetch
  };

  // Alias for convenient global access
  window.civicFetch = civicFetch;

  // Universal HTML sanitizer
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Universal civic badge styling helpers
  function getStatusClass(status) {
    switch (status) {
      case 'Reported': return 'status-reported';
      case 'Under Verification': return 'status-verification';
      case 'In Progress': return 'status-progress';
      case 'Resolved': return 'status-resolved';
      case 'Rejected': return 'status-rejected';
      default: return 'status-reported';
    }
  }

  function getSeverityClass(severity) {
    switch (severity) {
      case 'Low': return 'severity-low';
      case 'Medium': return 'severity-medium';
      case 'High': return 'severity-high';
      case 'Critical': return 'severity-critical';
      default: return 'severity-medium';
    }
  }

  // Attach shared helpers to window for site-wide DRY code
  window.escapeHtml = escapeHtml;
  window.getStatusClass = getStatusClass;
  window.getSeverityClass = getSeverityClass;

  // Check health and display connection status in console
  (async function checkApiStatus() {
    try {
      const res = await civicFetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        console.log(`[Civic Connect System]: Backend API connected (${data.database ? data.database.mode : 'Online'}).`);
      }
    } catch (e) {
      console.warn('[Civic Connect System]: Backend server currently unreachable. Ensure Express server is running on port 5000 or configure backend URL.');
    }
  })();
})();
