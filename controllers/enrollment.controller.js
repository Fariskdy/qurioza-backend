const Enrollment = require("../models/enrollment.model");
const Batch = require("../models/batch.model");
const Course = require("../models/course.model");
const Module = require("../models/module.model");

// Get user's enrollments
const getEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user.userId })
      .populate({
        path: "batch",
        populate: {
          path: "course",
          select: "title slug image",
        },
      })
      .sort({ enrollmentDate: -1 });

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching enrollments",
      error: error.message,
    });
  }
};

// Get single enrollment
const getEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({
      _id: req.params.enrollmentId,
      student: req.user.userId,
    }).populate({
      path: "batch",
      populate: {
        path: "course",
        select: "title slug image",
      },
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    res.json(enrollment);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching enrollment",
      error: error.message,
    });
  }
};

// Enroll in a batch
const enrollInBatch = async (req, res) => {
  try {
    // Add role check
    if (req.user.role !== "student") {
      return res.status(403).json({
        message: "Only students can enroll in courses",
      });
    }

    const batch = await Batch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Check if batch is open for enrollment
    if (batch.status !== "enrolling") {
      return res.status(400).json({
        message: "Batch is not open for enrollment",
      });
    }

    // Check enrollment dates
    const currentDate = new Date();
    if (
      currentDate < batch.enrollmentStartDate ||
      currentDate > batch.enrollmentEndDate
    ) {
      return res.status(400).json({
        message: "Enrollment period is not active",
      });
    }

    // Check if student limit reached
    const enrollmentCount = await Enrollment.countDocuments({
      batch: batch._id,
    });
    if (enrollmentCount >= batch.maxStudents) {
      return res.status(400).json({
        message: "Batch is full",
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: req.user.userId,
      batch: batch._id,
    });
    if (existingEnrollment) {
      return res.status(400).json({
        message: "Already enrolled in this batch",
      });
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      student: req.user.userId,
      batch: batch._id,
    });

    // Update course stats
    await Course.findByIdAndUpdate(batch.course, {
      $inc: { "stats.enrolledStudents": 1 },
    });

    // Update batch stats
    await Batch.findByIdAndUpdate(batch._id, {
      $inc: { enrollmentCount: 1 },
    });

    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({
      message: "Error creating enrollment",
      error: error.message,
    });
  }
};

// Update enrollment status (by teacher/coordinator)
const updateEnrollmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const enrollment = await Enrollment.findById(req.params.enrollmentId);

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    // Verify user is batch teacher or course coordinator
    const batch = await Batch.findById(enrollment.batch);
    if (
      !batch.teachers.includes(req.user.userId) &&
      req.user.role !== "course coordinator"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    enrollment.status = status;
    await enrollment.save();

    res.json(enrollment);
  } catch (error) {
    res.status(500).json({
      message: "Error updating enrollment status",
      error: error.message,
    });
  }
};

// Get student's progress
const getStudentProgress = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({
      _id: req.params.enrollmentId,
      student: req.user.userId,
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    // Get all modules for the course
    const batch = await Batch.findById(enrollment.batch);
    const modules = await Module.find({ course: batch.course });

    // Calculate progress
    const progress = {
      completedModules: enrollment.completedModules.length,
      totalModules: modules.length,
      progressPercentage: Math.round(
        (enrollment.completedModules.length / modules.length) * 100
      ),
      modules: modules.map((module) => ({
        moduleId: module._id,
        title: module.title,
        isCompleted: enrollment.completedModules.includes(module._id),
      })),
    };

    res.json(progress);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching progress",
      error: error.message,
    });
  }
};

// Get all enrollments for a batch (teachers/coordinator)
const getBatchEnrollments = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Verify user is batch teacher or course coordinator
    if (
      !batch.teachers.includes(req.user.userId) &&
      req.user.role !== "course coordinator"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const enrollments = await Enrollment.find({ batch: batch._id })
      .populate("student", "username")
      .sort({ enrollmentDate: -1 });

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching batch enrollments",
      error: error.message,
    });
  }
};

module.exports = {
  getEnrollments,
  getEnrollment,
  enrollInBatch,
  updateEnrollmentStatus,
  getStudentProgress,
  getBatchEnrollments,
};
