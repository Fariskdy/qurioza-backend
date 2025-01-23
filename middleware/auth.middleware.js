const jwt = require("jsonwebtoken");
const { isTokenBlacklisted } = require("../config/jwt");

const authenticateToken = (req, res, next) => {
  // Try to get token from cookie first
  let token = req.cookies?.accessToken;

  // If no cookie, try Authorization header
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (isTokenBlacklisted(token)) {
    return res.status(401).json({ message: "Token has been invalidated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Simple role check middleware
const checkRole = (role) => (req, res, next) => {
  try {
    if (req.user.role !== role) {
      return res.status(403).json({
        message: "You are not authorized to access this resource",
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      message: "Authorization check failed",
      error: error.message,
    });
  }
};

module.exports = { authenticateToken, checkRole };
