const express = require("express");
const router = express.Router({ mergeParams: true }); // To access courseId from parent route
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const { moduleUpload } = require("../middleware/upload.middleware");
const {
  getModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
  reorderModule,
  getModuleContent,
  getModuleContentItem,
  addModuleContent,
  updateModuleContent,
  deleteModuleContent,
  reorderModuleContent,
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

// New content routes
router.get("/:moduleId/content", getModuleContent);
router.get("/:moduleId/content/:contentId", getModuleContentItem);
router.post("/:moduleId/content", moduleUpload.any(), addModuleContent);
router.put(
  "/:moduleId/content/:contentId",
  moduleUpload.any(),
  updateModuleContent
);
router.delete("/:moduleId/content/:contentId", deleteModuleContent);
router.put("/:moduleId/content/:contentId/reorder", reorderModuleContent);

module.exports = router;
