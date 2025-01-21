const Assignment = require("../models/assignment.model");
const Batch = require("../models/batch.model");
const Submission = require("../models/submission.model");

// Get all assignments for a batch
const getAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ batch: req.params.batchId })
      .sort({ dueDate: 1 })
      .populate("createdBy", "username")
      .populate("module", "title");

    res.json(assignments);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching assignments",
      error: error.message,
    });
  }
};

// Get single assignment
const getAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findOne({
      _id: req.params.assignmentId,
      batch: req.params.batchId,
    })
      .populate("createdBy", "username")
      .populate("module", "title");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json(assignment);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching assignment",
      error: error.message,
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

module.exports = {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissions,
};
