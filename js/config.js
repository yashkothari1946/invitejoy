/**
 * Wedvyb frontend — API endpoints (backend now lives in vybtek-back under /api/wedvyb).
 * Loaded first on every page. Local dev points at localhost:5000; production at api.vybtek.com.
 */
(function () {
  var isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var origin = isLocal ? "http://localhost:5000" : "https://api.vybtek.com";
  window.API_BASE = origin + "/api/wedvyb";
  // Shared Manuplast/Vybtek admin login (JWT) used by the admin panel.
  window.ADMIN_LOGIN_URL = origin + "/api/manuplast/admin/login";
})();
