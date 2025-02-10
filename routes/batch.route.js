const express = require("express");
const router = express.Router({ mergeParams: true }); // To access courseId from parent route
const {
  getBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch,
  updateBatchStatus,
  getBatchStudents,
  assignTeachers,
  toggleAutoUpdate,
  rollbackStatus,
  getBatchForEnrollment,
} = require("../controllers/batch.controller");
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");



// Public routes (no authentication required)
router.get("/", getBatches);
router.get("/enrolling-batch", getBatchForEnrollment);
router.get("/:batchId", getBatch);

// Protected routes (require authentication)
router.use(authenticateToken);

// Course coordinator only routes
router.use(checkRole("course coordinator"));

// All routes below this will require coordinator role
router.post("/", createBatch);
router.route("/:batchId").put(updateBatch).delete(deleteBatch);

router.put("/:batchId/status", updateBatchStatus);
router.put("/:batchId/teachers", assignTeachers);
router.get("/:batchId/students", getBatchStudents);
router.put("/:batchId/auto-update", toggleAutoUpdate);
router.post("/:batchId/rollback-status", rollbackStatus);

module.exports = router;
