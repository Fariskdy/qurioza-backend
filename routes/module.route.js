const express = require("express");
const router = express.Router({ mergeParams: true }); // To access courseId from parent route
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
  reorderModule,
} = require("../controllers/module.controller");

// All routes require authentication
router.use(authenticateToken);

// Public routes (for enrolled students)
router.get("/", getModules);
router.get("/:moduleId", getModule);

// Coordinator only routes
router.use(checkRole("course coordinator"));
router.post("/", createModule);
router.put("/:moduleId", updateModule);
router.delete("/:moduleId", deleteModule);
router.put("/:moduleId/reorder", reorderModule);

module.exports = router;
