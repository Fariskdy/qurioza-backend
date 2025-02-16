const Assignment = require("../models/assignment.model");
const Batch = require("../models/batch.model");
const Submission = require("../models/submission.model");
const Enrollment = require("../models/enrollment.model");
const mongoose = require("mongoose");

// Get all assignments for a batch
const getAssignments = async (req, res) => {
  try {
    if (!req.params.batchId) {
      return res.status(400).json({
        message: "Batch ID is required",
      });
    }

    const assignments = await Assignment.find({
      batch: req.params.batchId,
      createdBy: req.user.userId,
    })
      .sort({ dueDate: 1 })
      .populate("createdBy", "username")
      .populate("module", "title")
      .lean(); // Convert to plain JavaScript object

    // Get enrollment count from enrollments
    const enrollmentCount = await Enrollment.countDocuments({
      batch: req.params.batchId,
    });

    // get the submissions count
    const submissionsCount = await Submission.countDocuments({
      assignment: { $in: assignments.map((a) => a._id) },
    });

    // now add the enrollment count and submissions count to each assignment
    const enrichedAssignments = assignments.map((assignment) => ({
      ...assignment,
      enrollmentCount,
      submissionsCount,
    }));

    // Ensure we always return an array, even if empty
    res.json(enrichedAssignments || []);
  } catch (error) {
    console.error("Assignment fetch error:", error); // Add logging for debugging
    res.status(500).json({
      message: "Error fetching assignments",
      error: error.message,
    });
  }
};

// Get single assignment
const getAssignment = async (req, res) => {
  try {
    // Add validation for required parameters
    if (!req.params.assignmentId || !req.params.batchId) {
      return res.status(400).json({
        message: "Assignment ID and Batch ID are required",
        debug: {
          assignmentId: req.params.assignmentId,
          batchId: req.params.batchId,
        },
      });
    }

    const assignment = await Assignment.findOne({
      _id: req.params.assignmentId,
      batch: req.params.batchId,
    })
      .populate("createdBy", "username")
      .populate("module", "title");

    if (!assignment) {
      return res.status(404).json({
        message: "Assignment not found",
        debug: {
          assignmentId: req.params.assignmentId,
          batchId: req.params.batchId,
        },
      });
    }

    // Get enrollment count
    const enrollmentCount = await Enrollment.countDocuments({
      batch: req.params.batchId,
    });

    // Get submissions count
    const submissionsCount = await Submission.countDocuments({
      assignment: req.params.assignmentId,
    });

    // Return enriched assignment data
    res.json({
      ...assignment.toObject(),
      enrollmentCount,
      submissionsCount,
    });
  } catch (error) {
    console.error("Assignment fetch error:", {
      error,
      params: req.params,
      user: req.user,
    });

    res.status(500).json({
      message: "Error fetching assignment",
      error: error.message,
      debug: {
        assignmentId: req.params.assignmentId,
        batchId: req.params.batchId,
      },
    });
  }
};

// Create new assignment
const createAssignment = async (req, res) => {
  try {
    // Verify batch exists and user is assigned teacher
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      teachers: req.user.userId,
    });

    if (!batch) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Verify batch is ongoing
    if (batch.status !== "ongoing") {
      return res.status(400).json({
        message: "Can only create assignments for ongoing batches",
      });
    }

    const assignment = await Assignment.create({
      ...req.body,
      batch: req.params.batchId,
      createdBy: req.user.userId,
    });

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({
      message: "Error creating assignment",
      error: error.message,
    });
  }
};

// Update assignment
const updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findOne({
      _id: req.params.assignmentId,
      batch: req.params.batchId,
      createdBy: req.user.userId,
    });

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Verify user is creator or coordinator
    if (
      assignment.createdBy.toString() !== req.user.userId &&
      req.user.role !== "course coordinator"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if any submissions exist
    const submissionCount = await Submission.countDocuments({
      assignment: assignment._id,
    });

    // If submissions exist, only allow updating certain fields
    const allowedUpdates =
      submissionCount > 0
        ? ["title", "description"]
        : ["title", "description", "dueDate", "totalMarks"];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        assignment[field] = req.body[field];
      }
    });

    await assignment.save();
    res.json(assignment);
  } catch (error) {
    res.status(500).json({
      message: "Error updating assignment",
      error: error.message,
    });
  }
};

// Delete assignment
const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findOne({
      _id: req.params.assignmentId,
      batch: req.params.batchId,
    });

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Verify user is creator or coordinator
    if (
      assignment.createdBy.toString() !== req.user.userId &&
      req.user.role !== "course coordinator"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if any submissions exist
    const submissionCount = await Submission.countDocuments({
      assignment: assignment._id,
    });

    if (submissionCount > 0) {
      return res.status(400).json({
        message: "Cannot delete assignment with existing submissions",
      });
    }

    await assignment.deleteOne();
    res.json({ message: "Assignment deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting assignment",
      error: error.message,
    });
  }
};

// Get assignment submissions
const getSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({
      assignment: req.params.assignmentId,
    })
      .populate("student", "username")
      .populate("gradedBy", "username");

    res.json(submissions);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching submissions",
      error: error.message,
    });
  }
};

// Add this new controller function
const getBatchStats = async (req, res) => {
  try {
    const batchId = req.params.batchId;

    const stats = await Assignment.aggregate([
      { $match: { batch: new mongoose.Types.ObjectId(batchId) } },
      {
        $lookup: {
          from: "submissions",
          localField: "_id",
          foreignField: "assignment",
          as: "submissions",
        },
      },
      {
        $group: {
          _id: null,
          active: {
            $sum: {
              $cond: [{ $gt: ["$dueDate", new Date()] }, 1, 0],
            },
          },
          total: { $sum: 1 },
          pendingGrading: {
            $sum: {
              $size: {
                $filter: {
                  input: "$submissions",
                  as: "submission",
                  cond: { $eq: ["$$submission.status", "submitted"] },
                },
              },
            },
          },
          completed: {
            $sum: {
              $size: {
                $filter: {
                  input: "$submissions",
                  as: "submission",
                  cond: { $eq: ["$$submission.status", "graded"] },
                },
              },
            },
          },
        },
      },
    ]);

    res.json(
      stats[0] || { active: 0, total: 0, pendingGrading: 0, completed: 0 }
    );
  } catch (error) {
    res.status(500).json({
      message: "Error fetching assignment stats",
      error: error.message,
      debug: {
        batchId: req.params.batchId,
      },
    });
  }
};

// get student assignments

// steps
// get all enrollments in batch for the student
// get all assignments in batch for the student

const getEnrolledBatcheswithAssignments = async (req, res) => {
  try {
    // Get enrolled batches with populated course info
    const enrolledBatches = await Enrollment.find({
      student: req.user.userId,
    }).populate({
      path: "batch",
      match: { status: { $in: ["ongoing", "completed"] } }, // Only ongoing or completed batches
      populate: { path: "course", select: "title" },
    });

    // Filter out null batches (those that didn't match the status criteria)
    const validBatches = enrolledBatches.filter((e) => e.batch !== null);
    const batchIds = validBatches.map((e) => e.batch._id);

    // Get assignments with module info
    const assignments = await Assignment.find({
      batch: { $in: batchIds },
    })
      .populate("module", "title")
      .sort({ dueDate: 1 });

    // Get submissions for these assignments
    const submissions = await Submission.find({
      student: req.user.userId,
      assignment: { $in: assignments.map((a) => a._id) },
    });

    // Get comprehensive stats for each batch
    const stats = await Assignment.aggregate([
      {
        $match: {
          batch: { $in: batchIds },
        },
      },
      {
        $lookup: {
          from: "submissions",
          localField: "_id",
          foreignField: "assignment",
          as: "submissions",
        },
      },
      {
        $group: {
          _id: "$batch",
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $gt: ["$dueDate", new Date()] }, 1, 0],
            },
          },
          completed: {
            $sum: {
              $size: {
                $filter: {
                  input: "$submissions",
                  as: "sub",
                  cond: {
                    $and: [
                      { $eq: ["$$sub.student", req.user.userId] },
                      { $in: ["$$sub.status", ["submitted", "graded"]] },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    ]);

    // Combine all data
    const enrichedBatches = validBatches.map((enrollment) => {
      const batchStats = stats.find((s) =>
        s._id.equals(enrollment.batch._id)
      ) || { total: 0, active: 0, completed: 0 };

      return {
        ...enrollment.batch.toObject(),
        stats: batchStats,
        enrollmentDate: enrollment.createdAt,
      };
    });

    res.json({
      batches: enrichedBatches,
      assignments: assignments.map((assignment) => {
        const submission = submissions.find((s) =>
          s.assignment.equals(assignment._id)
        );
        return {
          ...assignment.toObject(),
          submission: submission
            ? {
                status: submission.status,
                submittedAt: submission.submittedAt,
                marks: submission.marks,
                feedback: submission.feedback,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("Error in getEnrolledBatcheswithAssignments:", error);
    res.status(500).json({
      message: "Error fetching batches with assignments",
      error: error.message,
    });
  }
};

const getStudentAssignments = async (req, res) => {
  try {
    // Verify enrollment first
    const enrollment = await Enrollment.findOne({
      student: req.user.userId,
      batch: req.params.batchId,
    });

    if (!enrollment) {
      return res.status(403).json({
        message: "You are not enrolled in this batch",
      });
    }

    // Get assignments with module info
    const assignments = await Assignment.find({
      batch: req.params.batchId,
    })
      .populate("module", "title")
      .populate("createdBy", "username")
      .sort({ dueDate: 1 });

    // Get submissions for these assignments
    const submissions = await Submission.find({
      student: req.user.userId,
      assignment: { $in: assignments.map((a) => a._id) },
    });

    // Combine assignments with their submission status
    const enrichedAssignments = assignments.map((assignment) => {
      const submission = submissions.find((s) =>
        s.assignment.equals(assignment._id)
      );

      return {
        ...assignment.toObject(),
        submission: submission
          ? {
              status: submission.status,
              submittedAt: submission.submittedAt,
              marks: submission.marks,
              feedback: submission.feedback,
              isLate: submission.submittedAt > assignment.dueDate,
            }
          : null,
        isOverdue: !submission && new Date() > assignment.dueDate,
      };
    });

    res.json({
      assignments: enrichedAssignments,
      stats: {
        total: assignments.length,
        submitted: submissions.length,
        pending: assignments.length - submissions.length,
        graded: submissions.filter((s) => s.status === "graded").length,
      },
    });
  } catch (error) {
    console.error("Error in getStudentAssignments:", error);
    res.status(500).json({
      message: "Error fetching student assignments",
      error: error.message,
    });
  }
};

// Add this new controller function
const getStudentAssignment = async (req, res) => {
  try {
    // First verify enrollment
    const enrollment = await Enrollment.findOne({
      student: req.user.userId,
      batch: req.params.batchId,
    });

    if (!enrollment) {
      return res.status(403).json({
        message: "You are not enrolled in this batch",
      });
    }

    // Get assignment with module info
    const assignment = await Assignment.findOne({
      _id: req.params.assignmentId,
      batch: req.params.batchId,
    })
      .populate("module", "title")
      .populate("createdBy", "username");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Get student's submission if exists
    const submission = await Submission.findOne({
      student: req.user.userId,
      assignment: assignment._id,
    });

    // Return assignment with submission data
    res.json({
      ...assignment.toObject(),
      submission: submission
        ? {
            status: submission.status,
            submittedAt: submission.submittedAt,
            marks: submission.marks,
            feedback: submission.feedback,
            content: submission.content,
            attachments: submission.attachments,
          }
        : null,
    });
  } catch (error) {
    console.error("Error in getStudentAssignment:", error);
    res.status(500).json({
      message: "Error fetching assignment",
      error: error.message,
    });
  }
};

module.exports = {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissions,
  getBatchStats,
  getEnrolledBatcheswithAssignments,
  getStudentAssignments,
  getStudentAssignment,
};
