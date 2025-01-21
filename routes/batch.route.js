const express = require("express");
const router = express.Router({ mergeParams: true }); // To access courseId from parent route
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch,
  updateBatchStatus,
  getBatchStudents,
  assignTeachers,
} = require("../controllers/batch.controller");

// All routes require authentication
router.use(authenticateToken);

// Public routes (for viewing batches)
router.get("/", getBatches);
router.get("/:batchId", getBatch);

// Coordinator only routes
router.use(checkRole("course coordinator"));
router.post("/", createBatch);
router.put("/:batchId", updateBatch);
router.delete("/:batchId", deleteBatch);
router.put("/:batchId/status", updateBatchStatus);
router.get("/:batchId/students", getBatchStudents);
router.put("/:batchId/teachers", assignTeachers);

module.exports = router;
