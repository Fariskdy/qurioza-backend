const express = require("express");
const {
  authenticateToken,
  checkRole,
} = require("../middleware/auth.middleware");
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

const router = express.Router();

// Public routes
router.get("/", getCategories);
router.get("/:slug", getCategory);

// Admin only routes
router.use(authenticateToken, checkRole("admin"));
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
