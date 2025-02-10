const jwt = require("jsonwebtoken");
const { isTokenBlacklisted } = require("../config/jwt");

// Protect routes - authentication check
const authenticateToken = (req, res, next) => {
  // Try to get token from cookie first
  let token = req.cookies?.accessToken;

  // If no cookie, try Authorization header
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.status(401).json({ message: "Authentication required" });
  }

  if (isTokenBlacklisted(token)) {
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.status(401).json({ message: "Token has been invalidated" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

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

// New middleware to check multiple roles
const checkRoles = (roles) => (req, res, next) => {
  try {
    if (!roles.includes(req.user.role)) {
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

module.exports = {
  authenticateToken,
  checkRole,
  checkRoles,
};
