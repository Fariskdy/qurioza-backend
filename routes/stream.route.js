const express = require("express");
const router = express.Router();
const { streamContent } = require("../controllers/stream.controller");
const { authenticateToken } = require("../middleware/auth.middleware");

router.get("/:token", authenticateToken, streamContent);

module.exports = router;
