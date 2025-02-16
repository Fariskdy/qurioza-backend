const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getEnrolledBatcheswithAssignments,
  getStudentAssignments,
  getStudentAssignment,
} = require("../controllers/assignment.controller");

// All routes require authentication and student role
router.use(authenticateToken);
router.use(checkRole("student"));

// Get all enrolled batches with assignments
router.get("/enrolled-batches", getEnrolledBatcheswithAssignments);

// Get assignments for a specific batch
router.get("/batch/:batchId", getStudentAssignments);

// Get single assignment details
router.get("/batch/:batchId/assignment/:assignmentId", getStudentAssignment);

module.exports = router;
