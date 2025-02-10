const Batch = require("../models/batch.model");
const Course = require("../models/course.model");
const Enrollment = require("../models/enrollment.model");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Profile = require("../models/profile.model");

// Get all batches for a course
const getBatches = async (req, res) => {
  try {
    const batches = await Batch.find({ course: req.params.courseId })
      .sort({ batchNumber: -1 })
      .populate("teachers", "username")
      .select(
        "name batchNumber status enrollmentStartDate enrollmentEndDate batchStartDate batchEndDate maxStudents enrollmentCount teachers"
      );

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
    // First get the batch with populated teachers
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      course: req.params.courseId,
    }).populate("teachers", "username email");

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Get profiles for all teachers in one query
    const teacherProfiles = await Profile.find({
      user: { $in: batch.teachers.map((t) => t._id) },
    }).lean();

    // Format the response to merge user and profile data
    const formattedBatch = {
      ...batch.toObject(),
      teachers: batch.teachers.map((teacher) => {
        const profile =
          teacherProfiles.find(
            (p) => p.user.toString() === teacher._id.toString()
          ) || {};
        return {
          _id: teacher._id,
          username: teacher.username,
          email: teacher.email,
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          phone: profile.phone || "",
        };
      }),
    };

    res.json(formattedBatch);
  } catch (error) {
    console.error("Error in getBatch:", error);
    res.status(500).json({
      message: "Error fetching batch",
      error: error.message,
    });
  }
};

// Create new batch
const createBatch = async (req, res) => {
  try {
    const { courseId } = req.params;
    const batchData = req.body;

    // Get the latest batch number for this course
    const latestBatch = await Batch.findOne({ course: courseId })
      .sort({ batchNumber: -1 })
      .select("batchNumber");

    // Set batch number
    batchData.batchNumber = latestBatch ? latestBatch.batchNumber + 1 : 1;
    batchData.course = courseId;

    // Check for overlapping periods with existing batches
    const overlappingBatch = await Batch.findOne({
      course: courseId,
      $or: [
        // Check if new batch's enrollment period overlaps with existing batch
        {
          enrollmentStartDate: { $lte: batchData.enrollmentEndDate },
          enrollmentEndDate: { $gte: batchData.enrollmentStartDate },
        },
        // Check if new batch's duration overlaps with existing batch
        {
          batchStartDate: { $lte: batchData.batchEndDate },
          batchEndDate: { $gte: batchData.batchStartDate },
        },
      ],
      // Exclude completed batches from overlap check
      status: { $ne: "completed" },
    });

    if (overlappingBatch) {
      return res.status(400).json({
        message: "Cannot create batch: Dates overlap with an existing batch",
        conflictingBatch: {
          name: overlappingBatch.name,
          enrollmentPeriod: {
            start: overlappingBatch.enrollmentStartDate,
            end: overlappingBatch.enrollmentEndDate,
          },
          batchPeriod: {
            start: overlappingBatch.batchStartDate,
            end: overlappingBatch.batchEndDate,
          },
        },
      });
    }

    const batch = new Batch(batchData);
    await batch.save();

    res.status(201).json(batch);
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to create batch",
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

    // Check for overlapping periods with other batches
    const overlappingBatch = await Batch.findOne({
      course: req.params.courseId,
      _id: { $ne: req.params.batchId }, // Exclude current batch
      $or: [
        // Check if updated batch's enrollment period overlaps
        {
          enrollmentStartDate: { $lte: req.body.enrollmentEndDate },
          enrollmentEndDate: { $gte: req.body.enrollmentStartDate },
        },
        // Check if updated batch's duration overlaps
        {
          batchStartDate: { $lte: req.body.batchEndDate },
          batchEndDate: { $gte: req.body.batchStartDate },
        },
      ],
      status: { $ne: "completed" }, // Exclude completed batches
    });

    if (overlappingBatch) {
      return res.status(400).json({
        message: "Cannot update batch: Dates overlap with an existing batch",
        conflictingBatch: {
          name: overlappingBatch.name,
          enrollmentPeriod: {
            start: overlappingBatch.enrollmentStartDate,
            end: overlappingBatch.enrollmentEndDate,
          },
          batchPeriod: {
            start: overlappingBatch.batchStartDate,
            end: overlappingBatch.batchEndDate,
          },
        },
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      "name",
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
    res.status(400).json({
      message: error.message || "Error updating batch",
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

    // Don't allow deletion of batches with enrollments
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
    res.status(400).json({
      message: error.message || "Error deleting batch",
    });
  }
};

// Update batch status with enhanced validation
const updateBatchStatus = async (req, res) => {
  try {
    const { courseId, batchId } = req.params;
    const { status } = req.body;

    const batch = await Batch.findOne({ _id: batchId, course: courseId });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
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

    // Check for existing enrolling/ongoing batches
    if (status === "enrolling") {
      const existingEnrollingBatch = await Batch.findOne({
        course: courseId,
        status: "enrolling",
        _id: { $ne: batchId },
      });

      if (existingEnrollingBatch) {
        return res.status(400).json({
          message: "Another batch is currently in enrollment phase",
          existingBatch: {
            batchNumber: existingEnrollingBatch.batchNumber,
            enrollmentEndDate: existingEnrollingBatch.enrollmentEndDate,
          },
        });
      }

      // If manually starting enrollment early, update the enrollment start date
      const currentDate = new Date();
      if (batch.enrollmentStartDate > currentDate) {
        batch.enrollmentStartDate = currentDate;
      }
    }

    if (status === "ongoing") {
      const existingOngoingBatch = await Batch.findOne({
        course: courseId,
        status: "ongoing",
        _id: { $ne: batchId },
      });

      if (existingOngoingBatch) {
        return res.status(400).json({
          message: "Another batch is currently ongoing",
          existingBatch: {
            batchNumber: existingOngoingBatch.batchNumber,
            batchEndDate: existingOngoingBatch.batchEndDate,
          },
        });
      }

      // Check minimum requirements
      if (batch.teachers.length === 0) {
        return res.status(400).json({
          message: "Cannot start batch without assigned teachers",
        });
      }

      if (batch.enrollmentCount === 0) {
        return res.status(400).json({
          message: "Cannot start batch with no enrollments",
        });
      }

      // If manually starting batch early, update the batch start date
      const currentDate = new Date();
      if (batch.batchStartDate > currentDate) {
        batch.batchStartDate = currentDate;
      }
    }

    if (status === "completed") {
      // If manually completing batch early, update the batch end date
      const currentDate = new Date();
      if (batch.batchEndDate > currentDate) {
        batch.batchEndDate = currentDate;
      }
    }

    batch.status = status;
    batch.lastStatusUpdate = new Date();
    batch.isAutoUpdated = false; // Flag to indicate manual update
    await batch.save();

    res.json(batch);
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to update batch status",
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

    console.log("Received teacher IDs:", teachers);

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

    // Debug: Log the query parameters
    console.log("Looking for teachers with query:", {
      _id: { $in: teachers },
      role: "teacher",
      coordinator: req.user.userId,
    });

    // Verify all teachers exist, are teachers, and belong to this coordinator
    const validTeachers = await User.find({
      _id: { $in: teachers },
      role: "teacher",
      coordinator: req.user.userId,
    });

    console.log(
      "Found valid teachers:",
      validTeachers.map((t) => t._id)
    );

    if (validTeachers.length !== teachers.length) {
      return res.status(400).json({
        message: "One or more teacher IDs are invalid or not authorized",
        receivedIds: teachers,
        validIds: validTeachers.map((t) => t._id),
      });
    }

    batch.teachers = teachers;
    await batch.save();

    // Get the updated batch with populated teachers
    const updatedBatch = await Batch.findById(batch._id).populate(
      "teachers",
      "username email"
    );

    // Get profiles for all teachers in one query
    const teacherProfiles = await Profile.find({
      user: { $in: updatedBatch.teachers.map((t) => t._id) },
    }).lean();

    // Format the response to merge user and profile data
    const formattedBatch = {
      ...updatedBatch.toObject(),
      teachers: updatedBatch.teachers.map((teacher) => {
        const profile =
          teacherProfiles.find(
            (p) => p.user.toString() === teacher._id.toString()
          ) || {};
        return {
          _id: teacher._id,
          username: teacher.username,
          email: teacher.email,
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          phone: profile.phone || "",
        };
      }),
    };

    res.json(formattedBatch);
  } catch (error) {
    console.error("Error in assignTeachers:", error);
    res.status(500).json({
      message: "Error assigning teachers",
      error: error.message,
    });
  }
};

const toggleAutoUpdate = async (req, res) => {
  try {
    const { courseId, batchId } = req.params;
    const { enabled } = req.body;

    const batch = await Batch.findOne({ _id: batchId, course: courseId });
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    await batch.toggleAutoUpdate(enabled);
    res.json(batch);
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to toggle auto-update",
    });
  }
};

// Add new controller method
const rollbackStatus = async (req, res) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      course: req.params.courseId,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const history = batch.statusHistory;
    if (!history?.length) {
      return res.status(400).json({
        message: "No previous status to rollback to",
      });
    }

    // Get the last history entry which contains the previous status
    const lastEntry = history[history.length - 1];

    // Only allow rollback of manual changes
    if (lastEntry.isAutomatic) {
      return res.status(400).json({
        message: "Cannot rollback automatic status updates",
      });
    }

    // Set rollback flag to prevent new history entry
    batch._isRollback = true;

    // Find the appropriate dates to restore
    let datesToRestore;
    if (history.length > 1) {
      // If there are multiple entries, use the dates from the previous entry
      const previousEntry = history[history.length - 2];
      datesToRestore = previousEntry.dates;
    } else {
      // If this is the first entry, use its dates
      datesToRestore = lastEntry.dates;
    }

    // Restore previous status and dates
    batch.status = lastEntry.status;
    batch.enrollmentStartDate = datesToRestore.enrollmentStartDate;
    batch.enrollmentEndDate = datesToRestore.enrollmentEndDate;
    batch.batchStartDate = datesToRestore.batchStartDate;
    batch.batchEndDate = datesToRestore.batchEndDate;

    // Remove the last entry from history
    batch.statusHistory.pop();

    await batch.save();

    res.json(batch);
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to rollback status",
    });
  }
};

// Add this new controller function
const getBatchForEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params; // From mergeParams: true

    const enrollingBatch = await Batch.findOne({
      course: courseId,
      status: "enrolling",
      enrollmentStartDate: { $lte: new Date() },
      enrollmentEndDate: { $gte: new Date() },
    }).select(
      "_id name batchNumber enrollmentEndDate maxStudents enrollmentCount"
    );

    if (!enrollingBatch) {
      return res.json(null);
    }

    // Check if batch is full
    const isFull = enrollingBatch.enrollmentCount >= enrollingBatch.maxStudents;

    res.json({
      ...enrollingBatch.toJSON(),
      isFull,
      enrollmentEndsIn: enrollingBatch.enrollmentEndDate,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching enrolling batch",
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
  toggleAutoUpdate,
  rollbackStatus,
  getBatchForEnrollment,
};
