const express = require("express");
const router = express.Router({ mergeParams: true }); // To access batchId from parent route
const {
  authenticateToken,
  checkRole,
  checkRoles,
} = require("../middleware/auth.middleware");
const {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissions,
  getBatchStats,
  getEnrolledBatcheswithAssignments,
  getStudentAssignments,
} = require("../controllers/assignment.controller");

// All routes require authentication
router.use(authenticateToken);

// Student routes
router.get(
  "/enrolled-batches",
  checkRole("student"),
  getEnrolledBatcheswithAssignments
);
router.get(
  "/student-assignments/:batchId",
  checkRole("student"),
  getStudentAssignments
);

// Teacher only routes
router.post("/", checkRole("teacher"), createAssignment);
router.get("/all", checkRoles(["teacher"]), getAssignments);

// The more specific route should come BEFORE the generic route
router.get("/stats", getBatchStats);

// Generic route for getting assignment by ID
router.get("/:assignmentId", checkRoles(["teacher", "student"]), getAssignment);

router.put("/:assignmentId", checkRole("teacher"), updateAssignment);
router.delete("/:assignmentId", checkRole("teacher"), deleteAssignment);
router.get("/:assignmentId/submissions", checkRole("teacher"), getSubmissions);

module.exports = router;
