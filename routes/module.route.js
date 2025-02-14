const express = require("express");
const router = express.Router({ mergeParams: true }); // To access courseId from parent route
const {
  authenticateToken,
  checkRole,
  checkRoles,
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
  getSecureContentUrl,
  getPublicModules,
  getEnrolledModules,
  markContentComplete,
  markContentUncomplete,
} = require("../controllers/module.controller");

// Public routes (website visitors)
// Only basic info - no content URLs or secure data
router.get("/public", getPublicModules);

// Authentication required for all routes below
router.use(authenticateToken);

// Secure content view route - accessible by both coordinator and student
router.get(
  "/:moduleId/content/:contentId/secure-view",
  checkRoles(["course coordinator", "student"]),
  getSecureContentUrl
);

// Enrolled student routes
// Can access content but through secure URLs
router.get("/enrolled", checkRole("student"), getEnrolledModules);

// Move this route BEFORE the coordinator routes
router.post(
  "/:moduleId/content/:contentId/complete",
  checkRole("student"),
  markContentComplete
);

// Add the uncomplete route
router.post(
  "/:moduleId/content/:contentId/uncomplete",
  checkRole("student"),
  markContentUncomplete
);

// Course coordinator routes
// Full access to all module data and management
router.use(checkRole("course coordinator"));

router.get("/", getModules); // Full module data
router.get("/:moduleId", getModule);
router.post("/", createModule);
router.put("/:moduleId", updateModule);
router.delete("/:moduleId", deleteModule);
router.put("/:moduleId/reorder", reorderModule);

// Module content management routes
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
