const express = require("express");
const router = express.Router({ mergeParams: true }); // To access batchId from parent route
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissions,
} = require("../controllers/assignment.controller");

// All routes require authentication
router.use(authenticateToken);

// Student routes
router.get("/", getAssignments);
router.get("/:assignmentId", getAssignment);

// Teacher only routes
router.use(checkRole("teacher"));
router.post("/", createAssignment);
router.put("/:assignmentId", updateAssignment);
router.delete("/:assignmentId", deleteAssignment);
router.get("/:assignmentId/submissions", getSubmissions);

module.exports = router;
