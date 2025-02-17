const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const {
  createPaymentSessionHandler,
  handleWebhook,
} = require("../controllers/payment.controller");

// Create payment session
router.post(
  "/sessions/batches/:batchId",
  authenticateToken,
  createPaymentSessionHandler
);

// Remove webhook route from here since it's handled in app.js
// router.post("/webhook", express.raw({ type: "application/json" }), handleWebhook);

module.exports = router;
