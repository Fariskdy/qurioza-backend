const express = require("express");
const router = express.Router({ mergeParams: true }); // To access batchId from parent route
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getTeacherQuizStats,
  getStudentQuizStats,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getBatchQuizzes,
  getStudentBatchQuizzes,
  getQuizById,
  getStudentQuizById,
  getQuizSubmissions,
  getQuizForAttempt,
  submitQuizAttempt,
  getQuizReview,
} = require("../controllers/quiz.controller");

router.use(authenticateToken);

// Teacher Routes
router.get("/teacher/stats", checkRole("teacher"), getTeacherQuizStats);
router.post("/", checkRole("teacher"), createQuiz);
router.put("/:quizId", checkRole("teacher"), updateQuiz);
router.delete("/:quizId", checkRole("teacher"), deleteQuiz);
router.get("/batch/:batchId", checkRole("teacher"), getBatchQuizzes);
router.get("/:quizId", checkRole("teacher"), getQuizById);
router.get("/:quizId/submissions", checkRole("teacher"), getQuizSubmissions);

// Student Routes
router.get("/student/stats", checkRole("student"), getStudentQuizStats);
router.get(
  "/student/batch/:batchId",
  checkRole("student"),
  getStudentBatchQuizzes
);
router.get("/student/:quizId", checkRole("student"), getStudentQuizById);
router.get("/student/:quizId/attempt", checkRole("student"), getQuizForAttempt);
router.post("/student/:quizId/submit", checkRole("student"), submitQuizAttempt);
router.get("/student/:quizId/review", checkRole("student"), getQuizReview);

module.exports = router;
