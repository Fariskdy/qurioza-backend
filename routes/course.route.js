const express = require("express");
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
} = require("../controllers/course.controller");

const router = express.Router();

// Public routes
router.get("/", getCourses);
router.get("/:slug", getCourse);

// Coordinator only routes
router.use(authenticateToken, checkRole("course coordinator"));
router.post("/", createCourse);
router.put("/:id", updateCourse);
router.delete("/:id", deleteCourse);

module.exports = router;
