const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const {
  login,
  register,
  refreshToken,
  logout,
  me,
} = require("../controllers/auth.controller");

// Auth routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", authenticateToken, logout);
router.get("/me", authenticateToken, me);

module.exports = router;
