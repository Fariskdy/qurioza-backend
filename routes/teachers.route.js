const express = require("express");
const router = express.Router();
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} = require("../controllers/teacher.controller");

// All routes require authentication
router.use(authenticateToken);

// Only course coordinators can access these routes
router.use(checkRole("course coordinator"));

// Get all teachers (only returns teachers assigned to the requesting coordinator)
router.get("/", getTeachers);

// Get a specific teacher
router.get("/:id", getTeacher);

// Create a new teacher
router.post("/", createTeacher);

// Update a teacher
router.put("/:id", updateTeacher);

// Delete a teacher
router.delete("/:id", deleteTeacher);

module.exports = router;
