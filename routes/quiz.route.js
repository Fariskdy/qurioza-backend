const express = require("express");
const router = express.Router({ mergeParams: true }); // To access batchId from parent route
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizSubmissions,
  getQuizResults,
} = require("../controllers/quiz.controller");

// All routes require authentication
router.use(authenticateToken);

// Student routes
router.get("/", getQuizzes);
router.get("/:quizId", getQuiz);
router.get("/:quizId/results", getQuizResults); // Get student's own results

// Teacher only routes
router.use(checkRole(["teacher", "course coordinator"]));
router.post("/", createQuiz);
router.put("/:quizId", updateQuiz);
router.delete("/:quizId", deleteQuiz);
router.get("/:quizId/submissions", getQuizSubmissions);

module.exports = router;
