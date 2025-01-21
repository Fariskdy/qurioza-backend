const Quiz = require("../models/quiz.model");
const Batch = require("../models/batch.model");
const Submission = require("../models/submission.model");

// Get all quizzes for a batch
const getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ batch: req.params.batchId })
      .sort({ dueDate: 1 })
      .populate("createdBy", "username")
      .populate("module", "title")
      .select("-questions.correctAnswer"); // Hide answers for students

    res.json(quizzes);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching quizzes",
      error: error.message,
    });
  }
};

// Get single quiz
const getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.quizId,
      batch: req.params.batchId,
    })
      .populate("createdBy", "username")
      .populate("module", "title");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // If user is a student, remove correct answers
    if (req.user.role === "student") {
      quiz.questions.forEach((question) => {
        question.correctAnswer = undefined;
      });
    }

    res.json(quiz);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching quiz",
      error: error.message,
    });
  }
};

// Create new quiz
const createQuiz = async (req, res) => {
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
        message: "Can only create quizzes for ongoing batches",
      });
    }

    // Calculate total marks
    const totalMarks = req.body.questions.reduce(
      (sum, question) => sum + question.marks,
      0
    );

    const quiz = await Quiz.create({
      ...req.body,
      batch: req.params.batchId,
      createdBy: req.user.userId,
      totalMarks,
    });

    res.status(201).json(quiz);
  } catch (error) {
    res.status(500).json({
      message: "Error creating quiz",
      error: error.message,
    });
  }
};

// Update quiz
const updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.quizId,
      batch: req.params.batchId,
    });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Verify user is creator or coordinator
    if (
      quiz.createdBy.toString() !== req.user.userId &&
      req.user.role !== "course coordinator"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if any submissions exist
    const submissionCount = await Submission.countDocuments({
      quiz: quiz._id,
    });

    // If submissions exist, only allow updating certain fields
    const allowedUpdates =
      submissionCount > 0
        ? ["title", "description"]
        : ["title", "description", "questions", "duration", "dueDate"];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "questions") {
          // Recalculate total marks if questions are updated
          quiz.totalMarks = req.body.questions.reduce(
            (sum, question) => sum + question.marks,
            0
          );
        }
        quiz[field] = req.body[field];
      }
    });

    await quiz.save();
    res.json(quiz);
  } catch (error) {
    res.status(500).json({
      message: "Error updating quiz",
      error: error.message,
    });
  }
};

// Delete quiz
const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.quizId,
      batch: req.params.batchId,
    });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Verify user is creator or coordinator
    if (
      quiz.createdBy.toString() !== req.user.userId &&
      req.user.role !== "course coordinator"
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if any submissions exist
    const submissionCount = await Submission.countDocuments({
      quiz: quiz._id,
    });

    if (submissionCount > 0) {
      return res.status(400).json({
        message: "Cannot delete quiz with existing submissions",
      });
    }

    await quiz.deleteOne();
    res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting quiz",
      error: error.message,
    });
  }
};

// Get quiz submissions (for teachers)
const getQuizSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({
      quiz: req.params.quizId,
      type: "quiz",
    })
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

// Get quiz results (for students)
const getQuizResults = async (req, res) => {
  try {
    const submission = await Submission.findOne({
      quiz: req.params.quizId,
      student: req.user.userId,
      type: "quiz",
    }).select("marks submittedAt status feedback");

    if (!submission) {
      return res.status(404).json({ message: "No submission found" });
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching quiz results",
      error: error.message,
    });
  }
};

module.exports = {
  getQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizSubmissions,
  getQuizResults,
};
