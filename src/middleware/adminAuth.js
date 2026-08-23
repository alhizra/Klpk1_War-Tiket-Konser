const config = require("../config");

/**
 * Auth admin lab: header x-admin-token: <ADMIN_TOKEN>
 * Default token: admin-wtk (ganti di .env untuk demo serius)
 */
function adminAuth(req, res, next) {
  const token =
    req.headers["x-admin-token"] ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const expected = config.adminToken || "admin-wtk";
  if (!token || token !== expected) {
    return res.status(401).json({
      error: "unauthorized — sertakan header x-admin-token",
    });
  }
  return next();
}

module.exports = { adminAuth };
