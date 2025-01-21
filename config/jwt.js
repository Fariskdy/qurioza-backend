const jwt = require("jsonwebtoken");

const tokenBlacklist = new Map();
const CLEANUP_INTERVAL = 15 * 60 * 1000;

// Token Generation Functions
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

// Token Verification Functions
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

// Token Blacklist Management Functions
const invalidateToken = (token) => {
  try {
    // Decode token to get expiration time
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return;
    }

    tokenBlacklist.set(token, decoded.exp * 1000);
  } catch (error) {
    console.error("Token invalidation error:", error);
  }
};

const isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

// Cleanup Functions
const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [token, expiry] of tokenBlacklist.entries()) {
    if (expiry < now) {
      tokenBlacklist.delete(token);
    }
  }
  console.log(
    `Cleaned up expired tokens. Current blacklist size: ${tokenBlacklist.size}`
  );
};

const forceCleanup = () => {
  cleanupExpiredTokens();
};

// Set up automatic cleanup interval
setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  invalidateToken,
  isTokenBlacklisted,
  forceCleanup,
};
