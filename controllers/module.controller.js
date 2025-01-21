const Module = require("../models/module.model");
const Course = require("../models/course.model");

// Get all modules for a course
const getModules = async (req, res) => {
  try {
    const modules = await Module.find({ course: req.params.courseId })
      .sort({ order: 1 })
      .populate("coordinator", "username");

    res.json(modules);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching modules",
      error: error.message,
    });
  }
};

// Get single module
const getModule = async (req, res) => {
  try {
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
    }).populate("coordinator", "username");

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    res.json(module);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching module",
      error: error.message,
    });
  }
};

// Create new module
const createModule = async (req, res) => {
  try {
    // Verify course exists and user is coordinator
    const course = await Course.findOne({
      _id: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Get highest order number
    const lastModule = await Module.findOne({ course: req.params.courseId })
      .sort({ order: -1 })
      .limit(1);

    const newOrder = lastModule ? lastModule.order + 1 : 0;

    const module = await Module.create({
      ...req.body,
      course: req.params.courseId,
      coordinator: req.user.userId,
      order: newOrder,
    });

    res.status(201).json(module);
  } catch (error) {
    res.status(500).json({
      message: "Error creating module",
      error: error.message,
    });
  }
};

// Update module
const updateModule = async (req, res) => {
  try {
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Update allowed fields
    const allowedUpdates = [
      "title",
      "description",
      "duration",
      "lectureCount",
      "content",
      "learningObjectives",
      "requirements",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        module[field] = req.body[field];
      }
    });

    module.updatedAt = Date.now();
    await module.save();

    res.json(module);
  } catch (error) {
    res.status(500).json({
      message: "Error updating module",
      error: error.message,
    });
  }
};

// Delete module
const deleteModule = async (req, res) => {
  try {
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Reorder remaining modules
    await Module.updateMany(
      { course: req.params.courseId, order: { $gt: module.order } },
      { $inc: { order: -1 } }
    );

    await module.deleteOne();
    res.json({ message: "Module deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting module",
      error: error.message,
    });
  }
};

// Reorder module
const reorderModule = async (req, res) => {
  try {
    const { newOrder } = req.body;
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const oldOrder = module.order;

    // Update orders of other modules
    if (newOrder > oldOrder) {
      await Module.updateMany(
        {
          course: req.params.courseId,
          order: { $gt: oldOrder, $lte: newOrder },
        },
        { $inc: { order: -1 } }
      );
    } else {
      await Module.updateMany(
        {
          course: req.params.courseId,
          order: { $gte: newOrder, $lt: oldOrder },
        },
        { $inc: { order: 1 } }
      );
    }

    module.order = newOrder;
    await module.save();

    res.json(module);
  } catch (error) {
    res.status(500).json({
      message: "Error reordering module",
      error: error.message,
    });
  }
};

module.exports = {
  getModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
  reorderModule,
};
