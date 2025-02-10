const Category = require("../models/category.model");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../config/cloudinary");
const mongoose = require("mongoose");

// Get all categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

// Get single category
const getCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching category",
      error: error.message,
    });
  }
};

// Create new category
const createCategory = async (req, res) => {
  // Start a new session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, description } = req.body;

    // Validate required fields
    if (!name || !description) {
      return res
        .status(400)
        .json({ message: "Name and description are required" });
    }

    // Check for existing category
    const existingCategory = await Category.findOne({ name }).session(session);
    if (existingCategory) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Category already exists" });
    }

    let imageUrl = "";
    let imagePublicId = "";

    // Handle image upload using new system
    if (req.file) {
      try {
        const result = await uploadToCloudinary(
          req.file.buffer,
          "categoryImage",
          req.file.mimetype
        );

        imageUrl = result.secure_url;
        imagePublicId = result.public_id;
      } catch (uploadError) {
        await session.abortTransaction();
        return res.status(500).json({
          message: "Image upload failed",
          error: uploadError.message,
        });
      }
    }

    // Create new category
    const category = new Category({
      name,
      description,
      image: imageUrl,
      imagePublicId,
    });

    const savedCategory = await category.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    res.status(201).json(savedCategory);
  } catch (error) {
    // Rollback the transaction on error
    await session.abortTransaction();
    res.status(500).json({
      message: "Error creating category",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Update category
const updateCategory = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, description, status } = req.body;
    const category = await Category.findById(req.params.id).session(session);

    if (!category) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Category not found" });
    }

    // Check name uniqueness if changing name
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name }).session(
        session
      );
      if (existingCategory) {
        await session.abortTransaction();
        return res
          .status(400)
          .json({ message: "Category name already exists" });
      }
    }

    let oldImagePublicId = null;

    // Handle image update using new system
    if (req.file) {
      try {
        // Upload new image
        const result = await uploadToCloudinary(
          req.file.buffer,
          "categoryImage",
          req.file.mimetype
        );

        // Store old image id for deletion after successful transaction
        if (category.imagePublicId) {
          oldImagePublicId = category.imagePublicId;
        }

        category.image = result.secure_url;
        category.imagePublicId = result.public_id;
      } catch (uploadError) {
        await session.abortTransaction();
        return res.status(500).json({
          message: "Image upload failed",
          error: uploadError.message,
        });
      }
    }

    // Update fields
    category.name = name || category.name;
    category.description = description || category.description;
    category.status = status || category.status;

    const updatedCategory = await category.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // Delete old image after successful transaction
    if (oldImagePublicId) {
      await deleteFromCloudinary(oldImagePublicId).catch(console.error);
    }

    res.json(updatedCategory);
  } catch (error) {
    // Rollback the transaction on error
    await session.abortTransaction();
    res.status(500).json({
      message: "Error updating category",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const category = await Category.findById(req.params.id).session(session);

    if (!category) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Category not found" });
    }

    const imagePublicId = category.imagePublicId;

    // Delete from database first
    await category.deleteOne({ session });

    // Commit the transaction
    await session.commitTransaction();

    // Delete associated image after successful transaction
    if (imagePublicId) {
      await deleteFromCloudinary(imagePublicId).catch(console.error);
    }

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    // Rollback the transaction on error
    await session.abortTransaction();
    res.status(500).json({
      message: "Error deleting category",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
