const express = require("express");
const router = express.Router();
const { streamContent } = require("../controllers/stream.controller");
const { authenticateToken } = require("../middleware/auth.middleware");

// Increase payload limits for streaming
router.get(
  "/:token",
  express.json({ limit: "200mb" }),
  express.urlencoded({ extended: true, limit: "200mb" }),
  authenticateToken,
  streamContent
);

module.exports = router;
