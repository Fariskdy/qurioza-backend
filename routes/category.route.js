const express = require("express");
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const { createUploadMiddleware } = require("../middleware/upload.middleware");
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

const router = express.Router();

// Create upload middleware for categories (only images allowed)
const categoryUpload = createUploadMiddleware(["image"]);

// Public routes
router.get("/", getCategories);
router.get("/:slug", getCategory);

// Admin only routes
router.use(authenticateToken, checkRole("admin"));
router.post("/", categoryUpload.single("image"), createCategory);
router.put("/:id", categoryUpload.single("image"), updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
