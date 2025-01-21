const Batch = require("../models/batch.model");
const Course = require("../models/course.model");
const Enrollment = require("../models/enrollment.model");

// Get all batches for a course
const getBatches = async (req, res) => {
  try {
    const batches = await Batch.find({ course: req.params.courseId })
      .sort({ batchNumber: -1 })
      .populate("teachers", "username");

    res.json(batches);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching batches",
      error: error.message,
    });
  }
};

// Get single batch
const getBatch = async (req, res) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      course: req.params.courseId,
    }).populate("teachers", "username");

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    res.json(batch);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching batch",
      error: error.message,
    });
  }
};

// Create new batch
const createBatch = async (req, res) => {
  try {
    // Verify course exists and user is coordinator
    const course = await Course.findOne({
      _id: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if course can have new batch
    const canStartNewBatch = await course.canStartNewBatch();
    if (!canStartNewBatch) {
      return res.status(400).json({
        message: "Cannot create new batch while another is active",
      });
    }

    // Get next batch number
    const lastBatch = await Batch.findOne({ course: req.params.courseId })
      .sort({ batchNumber: -1 })
      .limit(1);

    const batchNumber = lastBatch ? lastBatch.batchNumber + 1 : 1;

    const batch = await Batch.create({
      ...req.body,
      course: req.params.courseId,
      batchNumber,
    });

    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({
      message: "Error creating batch",
      error: error.message,
    });
  }
};

// Update batch
const updateBatch = async (req, res) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      course: req.params.courseId,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Verify user is course coordinator
    const course = await Course.findOne({
      _id: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Update allowed fields
    const allowedUpdates = [
      "enrollmentStartDate",
      "enrollmentEndDate",
      "batchStartDate",
      "batchEndDate",
      "maxStudents",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        batch[field] = req.body[field];
      }
    });

    await batch.save();
    res.json(batch);
  } catch (error) {
    res.status(500).json({
      message: "Error updating batch",
      error: error.message,
    });
  }
};

// Delete batch
const deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      course: req.params.courseId,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Verify user is course coordinator
    const course = await Course.findOne({
      _id: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if batch has enrollments
    const enrollmentCount = await Enrollment.countDocuments({
      batch: batch._id,
    });
    if (enrollmentCount > 0) {
      return res.status(400).json({
        message: "Cannot delete batch with existing enrollments",
      });
    }

    await batch.deleteOne();
    res.json({ message: "Batch deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting batch",
      error: error.message,
    });
  }
};

// Update batch status
const updateBatchStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      course: req.params.courseId,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Verify user is course coordinator
    const course = await Course.findOne({
      _id: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Validate status transition
    const validTransitions = {
      upcoming: ["enrolling"],
      enrolling: ["ongoing"],
      ongoing: ["completed"],
      completed: [],
    };

    if (!validTransitions[batch.status].includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from ${batch.status} to ${status}`,
      });
    }

    batch.status = status;
    await batch.save();

    res.json(batch);
  } catch (error) {
    res.status(500).json({
      message: "Error updating batch status",
      error: error.message,
    });
  }
};

// Get batch students
const getBatchStudents = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({
      batch: req.params.batchId,
    }).populate("student", "username");

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching batch students",
      error: error.message,
    });
  }
};

// Assign teachers to batch
const assignTeachers = async (req, res) => {
  try {
    const { teachers } = req.body;
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      course: req.params.courseId,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Verify user is course coordinator
    const course = await Course.findOne({
      _id: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(403).json({ message: "Not authorized" });
    }

    batch.teachers = teachers;
    await batch.save();

    res.json(batch);
  } catch (error) {
    res.status(500).json({
      message: "Error assigning teachers",
      error: error.message,
    });
  }
};

module.exports = {
  getBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch,
  updateBatchStatus,
  getBatchStudents,
  assignTeachers,
};
