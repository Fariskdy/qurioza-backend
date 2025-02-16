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
  editSubmission,
  removeAttachment,
} = require("../controllers/submission.controller");
const {
  assignmentUpload,
  handleUploadError,
} = require("../middleware/upload.middleware");

// All routes require authentication
router.use(authenticateToken);

// Student routes
router.get("/:submissionId", checkRole("student"), getSubmission);
router.post(
  "/assignments/:assignmentId",
  checkRole("student"),
  assignmentUpload.array("files", 5),
  handleUploadError,
  submitAssignment
);
router.post("/quizzes/:quizId", checkRole("student"), submitQuiz);
router.put(
  "/assignments/:assignmentId/edit",
  checkRole("student"),
  assignmentUpload.array("files", 5),
  handleUploadError,
  editSubmission
);
router.delete(
  "/assignments/:assignmentId/attachments/:attachmentId",
  checkRole("student"),
  removeAttachment
);

// Teacher/Coordinator routes
router.use(checkRole("teacher"));
router.get("/assignments/:assignmentId/:type", getSubmissions);
router.get("/quizzes/:quizId/:type", getSubmissions);
router.put("/:submissionId/grade", gradeSubmission);

module.exports = router;
