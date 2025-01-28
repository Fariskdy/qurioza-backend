const Batch = require("../models/batch.model");
const Course = require("../models/course.model");
const Enrollment = require("../models/enrollment.model");
const mongoose = require("mongoose");
const User = require("../models/user.model");

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

    // Get next batch number
    const lastBatch = await Batch.findOne({ course: req.params.courseId })
      .sort({ batchNumber: -1 })
      .limit(1);

    const batchNumber = lastBatch ? lastBatch.batchNumber + 1 : 1;

    // New batch always starts as "upcoming"
    const batch = await Batch.create({
      ...req.body,
      course: req.params.courseId,
      batchNumber,
      status: "upcoming", // Explicitly set status
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

// Update batch status with enhanced validation
const updateBatchStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;
    const currentDate = new Date();

    const batch = await Batch.findOne({
      _id: req.params.batchId,
      course: req.params.courseId,
    }).session(session);

    if (!batch) {
      throw new Error("Batch not found");
    }

    // Verify coordinator
    const course = await Course.findOne({
      _id: req.params.courseId,
      coordinator: req.user.userId,
    }).session(session);

    if (!course) {
      throw new Error("Not authorized");
    }

    // Validate status transition
    await batch.canTransitionTo(status);

    // Status-specific checks
    if (status === "enrolling") {
      // Check if we can start a new batch
      const canStart = await course.canStartNewBatch();
      if (!canStart) {
        throw new Error("Cannot start enrollment for new batch at this time");
      }

      // Validate enrollment dates
      if (currentDate < batch.enrollmentStartDate) {
        throw new Error("Cannot start enrollment before scheduled date");
      }
    }

    if (status === "ongoing") {
      // Check enrollment period
      if (currentDate < batch.batchStartDate) {
        throw new Error("Cannot start batch before scheduled date");
      }

      // Ensure minimum enrollment
      if (batch.enrollmentCount === 0) {
        throw new Error("Cannot start batch with no enrollments");
      }
    }

    if (status === "completed") {
      if (currentDate < batch.batchEndDate) {
        throw new Error("Cannot complete batch before end date");
      }
    }

    batch.status = status;
    await batch.save({ session });
    await session.commitTransaction();

    res.json(batch);
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      message: error.message,
      details: {
        currentStatus: batch?.status,
        requestedStatus: req.body.status,
        currentDate: new Date(),
      },
    });
  } finally {
    session.endSession();
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

    // Validate teachers array
    if (!Array.isArray(teachers)) {
      return res.status(400).json({
        message: "Teachers must be an array of teacher IDs",
      });
    }

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

    // Verify all teachers exist, are teachers, and belong to this coordinator
    const validTeachers = await User.find({
      _id: { $in: teachers },
      role: "teacher",
      coordinator: req.user.userId,
    });

    if (validTeachers.length !== teachers.length) {
      return res.status(400).json({
        message: "One or more teacher IDs are invalid or not authorized",
      });
    }

    batch.teachers = teachers;
    await batch.save();

    // Populate teacher details in response
    const updatedBatch = await Batch.findById(batch._id).populate(
      "teachers",
      "username email"
    );

    res.json(updatedBatch);
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
