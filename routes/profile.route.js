const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const {
  createUploadMiddleware,
  handleUploadError,
} = require("../middleware/upload.middleware");
const {
  getProfile,
  updateProfile,
  getPublicProfile,
  updateAvatar,
  changePassword,
} = require("../controllers/profile.controller");

// Create avatar upload middleware
const avatarUpload = createUploadMiddleware(["image"]);

// All routes require authentication
router.use(authenticateToken);

// Get and update own profile
router.get("/", getProfile);
router.put("/", updateProfile);

// Update avatar
router.put(
  "/avatar",
  avatarUpload.single("avatar"),
  handleUploadError,
  updateAvatar
);

// Get other user's public profile
router.get("/:userId", getPublicProfile);

router.put("/change-password", changePassword);

module.exports = router;
