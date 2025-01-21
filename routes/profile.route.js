const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const {
  getProfile,
  updateProfile,
  getPublicProfile,
} = require("../controllers/profile.controller");

// All routes require authentication
router.use(authenticateToken);

// Get and update own profile
router.get("/", getProfile);
router.put("/", updateProfile);

// Get other user's public profile
router.get("/:userId", getPublicProfile);

module.exports = router;
