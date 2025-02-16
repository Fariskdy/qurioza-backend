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
  getRelatedCourses,
  getFeaturedCourses,
  getStats,
  updateCourseImage,
  updateCourseVideo,
  getStudentCourses,
  getTeacherCourses,
} = require("../controllers/course.controller");

const router = express.Router();

// Create upload middleware for courses (both images and videos allowed)
const courseUpload = createUploadMiddleware(["image", "video"]);

// Public routes - Order matters! Put specific routes before parameterized routes
router.get("/stats", getStats);
router.get("/featured", getFeaturedCourses);
router.get("/", getCourses);
router.get("/:slug/related", getRelatedCourses);
router.get("/:slug", getCourse);

// Handle batch routes before applying coordinator middleware
router.use("/:courseId/batches", require("./batch.route.js"));
router.use("/:courseId/modules", require("./module.route.js"));

router.get(
  "/student/my-courses",
  authenticateToken,
  checkRole("student"),
  getStudentCourses
);

router.get(
  "/teacher/my-courses",
  authenticateToken,
  checkRole("teacher"),
  getTeacherCourses
);

// Coordinator only routes
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

router.put(
  "/:id/image",
  courseUpload.fields([{ name: "image", maxCount: 1 }]),
  updateCourseImage
);

router.put("/:id/video", updateCourseVideo);

router.delete("/:id", deleteCourse);
router.patch("/:id/publish", publishCourse);

module.exports = router;
