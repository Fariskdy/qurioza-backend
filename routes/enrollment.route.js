const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getEnrollments,
  getEnrollment,
  enrollInBatch,
  updateEnrollmentStatus,
  getStudentProgress,
  getBatchEnrollments,
} = require("../controllers/enrollment.controller");

// All routes require authentication
router.use(authenticateToken);

// Student routes
router.get("/", getEnrollments); // Get user's enrollments
router.get("/:enrollmentId", getEnrollment);
router.post("/batches/:batchId", enrollInBatch);
router.get("/:enrollmentId/progress", getStudentProgress);

// Teacher/Coordinator routes
router.use(checkRole(["teacher", "course coordinator"]));
router.get("/batches/:batchId/students", getBatchEnrollments);
router.put("/:enrollmentId/status", updateEnrollmentStatus);

module.exports = router;
