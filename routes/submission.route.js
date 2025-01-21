const express = require("express");
const router = express.Router({ mergeParams: true }); // To access batchId from parent route
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getSubmissions,
  getSubmission,
  submitAssignment,
  submitQuiz,
  gradeSubmission,
  getBatchSubmissions,
  getStudentSubmissions,
} = require("../controllers/submission.controller");

// All routes require authentication
router.use(authenticateToken);

// Student routes
router.get("/my-submissions", getStudentSubmissions);
router.get("/:submissionId", getSubmission);
router.post("/assignments/:assignmentId", submitAssignment);
router.post("/quizzes/:quizId", submitQuiz);

// Teacher/Coordinator routes
router.use(checkRole(["teacher", "course coordinator"]));
router.get("/", getBatchSubmissions); // Get all submissions for batch
router.get("/assignments/:assignmentId", getSubmissions);
router.get("/quizzes/:quizId", getSubmissions);
router.put("/:submissionId/grade", gradeSubmission);

module.exports = router;
