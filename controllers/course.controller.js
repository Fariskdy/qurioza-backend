const Course = require("../models/course.model");

// Get all courses (with filters and pagination)
const getCourses = async (req, res) => {
  try {
    const { category, level, search, page = 1, limit = 10 } = req.query;
    const query = {};

    // Apply filters
    if (category) query.category = category;
    if (level) query.level = level;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const courses = await Course.find(query)
      .populate("category", "name slug")
      .populate("coordinator", "username")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Course.countDocuments(query);

    res.json({
      courses,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching courses",
      error: error.message,
    });
  }
};

// Get single course by slug
const getCourse = async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug })
      .populate("category", "name slug")
      .populate("coordinator", "username");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json(course);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching course",
      error: error.message,
    });
  }
};

// Create new course (coordinator only)
const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      duration,
      totalHours,
      price,
      level,
      features,
      learningOutcomes,
      requirements,
      language,
      image,
      previewVideo,
    } = req.body;

    const course = await Course.create({
      title,
      description,
      category,
      coordinator: req.user.userId,
      duration,
      totalHours,
      price,
      level,
      features,
      learningOutcomes,
      requirements,
      language,
      image,
      previewVideo,
    });

    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({
      message: "Error creating course",
      error: error.message,
    });
  }
};

// Update course (coordinator only)
const updateCourse = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Update allowed fields
    const allowedUpdates = [
      "title",
      "description",
      "duration",
      "totalHours",
      "price",
      "level",
      "features",
      "learningOutcomes",
      "requirements",
      "language",
      "image",
      "previewVideo",
      "status",
    ];

    allowedUpdates.forEach((update) => {
      if (req.body[update] !== undefined) {
        course[update] = req.body[update];
      }
    });

    course.updatedAt = Date.now();
    await course.save();

    res.json(course);
  } catch (error) {
    res.status(500).json({
      message: "Error updating course",
      error: error.message,
    });
  }
};

// Delete course (coordinator only)
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // TODO: Check if course has any active batches
    // If needed, add check here

    await course.deleteOne();
    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting course",
      error: error.message,
    });
  }
};

module.exports = {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
};
