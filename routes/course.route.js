const express = require("express");
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const { createUploadMiddleware } = require("../middleware/upload.middleware");
const {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  getMyCourses,
  publishCourse,
} = require("../controllers/course.controller");

const router = express.Router();

// Create upload middleware for courses (both images and videos allowed)
const courseUpload = createUploadMiddleware(["image", "video"]);

// Public routes
router.get("/", getCourses);
router.get("/:slug", getCourse);

// Coordinator only routes with file upload
router.use(authenticateToken, checkRole("course coordinator"));
router.get("/coordinator/my-courses", getMyCourses);

// Handle multiple file uploads for course creation
router.post(
  "/",
  courseUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "previewVideo", maxCount: 1 },
  ]),
  createCourse
);

// Handle file updates
router.put(
  "/:id",
  courseUpload.fields([
    { name: "image", maxCount: 1 },
    { name: "previewVideo", maxCount: 1 },
  ]),
  updateCourse
);

router.delete("/:id", deleteCourse);
router.patch("/:id/publish", publishCourse);

module.exports = router;
