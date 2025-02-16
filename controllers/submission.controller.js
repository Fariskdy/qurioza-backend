const Submission = require("../models/submission.model");
const Assignment = require("../models/assignment.model");
const Quiz = require("../models/quiz.model");
const Batch = require("../models/batch.model");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../config/cloudinary");

// Get all submissions for an assignment/quiz
const getSubmissions = async (req, res) => {
  try {
    const { assignmentId, quizId } = req.params;
    const query = assignmentId
      ? { assignment: assignmentId, type: "assignment" }
      : { quiz: quizId, type: "quiz" };

    const submissions = await Submission.find(query)
      .populate("student", "username")
      .populate("gradedBy", "username")
      .sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching submissions",
      error: error.message,
    });
  }
};

// Get single submission
const getSubmission = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId)
      .populate("student", "username")
      .populate("gradedBy", "username");

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Check if user is authorized to view submission
    if (
      submission.student.toString() !== req.user.userId &&
      !["teacher", "course coordinator"].includes(req.user.role)
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching submission",
      error: error.message,
    });
  }
};

// Submit assignment
const submitAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Check if assignment is past due date
    if (new Date() > assignment.dueDate) {
      return res.status(400).json({ message: "Assignment submission closed" });
    }

    // Check if already submitted
    const existingSubmission = await Submission.findOne({
      assignment: assignment._id,
      student: req.user.userId,
    });

    if (existingSubmission) {
      return res.status(400).json({ message: "Already submitted" });
    }

    // Handle file uploads
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(
            file.buffer,
            "assignmentSubmission",
            file.mimetype
          );

          attachments.push({
            filename: file.originalname,
            url: result.secure_url,
            mimetype: file.mimetype,
          });
        } catch (error) {
          console.error("File upload error:", error);
          return res.status(500).json({
            message: "Error uploading file",
            error: error.message,
          });
        }
      }
    }

    const submission = await Submission.create({
      type: "assignment",
      assignment: assignment._id,
      student: req.user.userId,
      batch: assignment.batch,
      content: req.body.content || "",
      attachments,
      status: new Date() > assignment.dueDate ? "late" : "submitted",
    });

    res.status(201).json(submission);
  } catch (error) {
    res.status(500).json({
      message: "Error submitting assignment",
      error: error.message,
    });
  }
};

// Submit quiz
const submitQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check if quiz is past due date
    if (new Date() > quiz.dueDate) {
      return res.status(400).json({ message: "Quiz submission closed" });
    }

    // Check if already submitted
    const existingSubmission = await Submission.findOne({
      quiz: quiz._id,
      student: req.user.userId,
    });

    if (existingSubmission) {
      return res.status(400).json({ message: "Already submitted" });
    }

    // Auto-grade quiz
    let marks = 0;
    const answers = req.body.answers;
    quiz.questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        marks += question.marks;
      }
    });

    const submission = await Submission.create({
      type: "quiz",
      quiz: quiz._id,
      student: req.user.userId,
      batch: quiz.batch,
      answers: req.body.answers,
      marks,
      status: "graded",
      gradedAt: new Date(),
    });

    res.status(201).json(submission);
  } catch (error) {
    res.status(500).json({
      message: "Error submitting quiz",
      error: error.message,
    });
  }
};

// Grade submission (for assignments)
const gradeSubmission = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Verify user is batch teacher or coordinator
    const batch = await Batch.findById(submission.batch);
    if (
      !batch.teachers.includes(req.user.userId) &&
      req.user.role !== "course coordinator"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    submission.marks = req.body.marks;
    submission.feedback = req.body.feedback;
    submission.status = "graded";
    submission.gradedBy = req.user.userId;
    submission.gradedAt = new Date();

    await submission.save();
    res.json(submission);
  } catch (error) {
    res.status(500).json({
      message: "Error grading submission",
      error: error.message,
    });
  }
};

// Get all submissions for a batch
const getBatchSubmissions = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Verify user is batch teacher or coordinator
    if (
      !batch.teachers.includes(req.user.userId) &&
      req.user.role !== "course coordinator"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const submissions = await Submission.find({ batch: batch._id })
      .populate("student", "username")
      .populate("gradedBy", "username")
      .populate({
        path: "assignment",
        select: "title",
      })
      .populate({
        path: "quiz",
        select: "title",
      })
      .sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching batch submissions",
      error: error.message,
    });
  }
};

// Get student's submissions
const getStudentSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({
      student: req.user.userId,
      batch: req.params.batchId,
    })
      .populate({
        path: "assignment",
        select: "title dueDate totalMarks",
      })
      .populate({
        path: "quiz",
        select: "title dueDate totalMarks",
      })
      .sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching submissions",
      error: error.message,
    });
  }
};

// Edit submission
const editSubmission = async (req, res) => {
  try {
    const submission = await Submission.findOne({
      assignment: req.params.assignmentId,
      student: req.user.userId,
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Check if submission is already graded
    if (submission.status === "graded") {
      return res.status(400).json({ message: "Cannot edit graded submission" });
    }

    // Check if assignment is past due date
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (new Date() > assignment.dueDate) {
      return res.status(400).json({ message: "Cannot edit past due date" });
    }

    // Handle file uploads
    const attachments = [...submission.attachments]; // Keep existing attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(
          file.buffer,
          "assignmentSubmission",
          file.mimetype
        );
        attachments.push({
          filename: file.originalname,
          url: result.secure_url,
          mimetype: file.mimetype,
        });
      }
    }

    submission.content = req.body.content || submission.content;
    submission.attachments = attachments;
    submission.updatedAt = new Date();

    await submission.save();
    res.json(submission);
  } catch (error) {
    res.status(500).json({
      message: "Error updating submission",
      error: error.message,
    });
  }
};

// Add this new function to handle attachment deletion
const removeAttachment = async (req, res) => {
  try {
    const submission = await Submission.findOne({
      assignment: req.params.assignmentId,
      student: req.user.userId,
    });

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Check if submission is already graded
    if (submission.status === "graded") {
      return res.status(400).json({ message: "Cannot edit graded submission" });
    }

    // Check if assignment is past due date
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (new Date() > assignment.dueDate) {
      return res.status(400).json({ message: "Cannot edit past due date" });
    }

    // Find the attachment
    const attachmentIndex = submission.attachments.findIndex(
      (att) => att._id.toString() === req.params.attachmentId
    );

    if (attachmentIndex === -1) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const attachment = submission.attachments[attachmentIndex];

    // Delete from Cloudinary
    // Keep the full path including extension for raw files
    // URL format: https://res.cloudinary.com/[cloud_name]/raw/upload/v[version]/assignments/submissions/[filename].[ext]
    const urlParts = attachment.url.split("/");
    const publicId = `assignments/submissions/${urlParts[urlParts.length - 1]}`; // Include filename with extension

    try {
      await deleteFromCloudinary(publicId, "raw");
    } catch (error) {
      console.error("Error deleting from Cloudinary:", error);
      // Continue with database removal even if Cloudinary deletion fails
    }

    // Remove from submission
    submission.attachments.splice(attachmentIndex, 1);
    await submission.save();

    res.json(submission);
  } catch (error) {
    res.status(500).json({
      message: "Error removing attachment",
      error: error.message,
    });
  }
};

module.exports = {
  getSubmissions,
  getSubmission,
  submitAssignment,
  submitQuiz,
  gradeSubmission,
  getBatchSubmissions,
  getStudentSubmissions,
  editSubmission,
  removeAttachment,
};
