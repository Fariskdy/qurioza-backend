const Quiz = require("../models/quiz.model");
const Batch = require("../models/batch.model");
const Submission = require("../models/submission.model");
const Enrollment = require("../models/enrollment.model");

// Get quiz statistics for teacher
exports.getTeacherQuizStats = async (req, res) => {
  try {
    // Get all batches assigned to teacher
    const batches = await Batch.find({
      teachers: req.user.userId,
    });

    // Get all quizzes created by teacher
    const quizzes = await Quiz.find({
      createdBy: req.user.userId,
    });

    const batchStats = await Promise.all(
      batches.map(async (batch) => {
        // Get quizzes for this batch
        const batchQuizzes = await Quiz.find({ batch: batch._id });

        // Get submissions for all quizzes in this batch
        const submissions = await Submission.find({
          batch: batch._id,
          type: "quiz",
        });

        const completedQuizzes = batchQuizzes.filter(
          (quiz) => new Date(quiz.dueDate) < new Date()
        ).length;

        const activeQuizzes = batchQuizzes.filter(
          (quiz) => new Date(quiz.dueDate) >= new Date()
        ).length;

        // Calculate average score
        const averageScore =
          submissions.length > 0
            ? submissions.reduce((acc, sub) => acc + sub.marks, 0) /
              submissions.length
            : 0;

        return {
          batchId: batch._id,
          batchName: batch.name,
          totalQuizzes: batchQuizzes.length,
          completedQuizzes,
          activeQuizzes,
          averageScore,
        };
      })
    );

    res.json({
      totalQuizzes: quizzes.length,
      batchStats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new quiz
exports.createQuiz = async (req, res) => {
  try {
    const {
      batch,
      title,
      description,
      questions,
      duration,
      totalMarks,
      dueDate,
    } = req.body;

    // Basic validation
    if (!batch || !title || !questions || !duration || !dueDate) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // Validate questions structure
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: "Questions must be a non-empty array",
      });
    }

    // Create quiz with validated data
    const quiz = new Quiz({
      batch,
      title,
      description,
      questions,
      duration,
      totalMarks,
      dueDate,
      createdBy: req.user.userId,
    });

    await quiz.save();
    res.status(201).json(quiz);
  } catch (error) {
    // More specific error handling
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation Error",
        details: error.message,
      });
    }
    res.status(500).json({
      message: "Error creating quiz",
      error: error.message,
    });
  }
};

// Update a quiz
exports.updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.quizId, createdBy: req.user.userId },
      req.body,
      { new: true }
    );
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    res.json(quiz);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a quiz
exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndDelete({
      _id: req.params.quizId,
      createdBy: req.user.userId,
    });
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all quizzes in a batch with submission stats
exports.getBatchQuizzes = async (req, res) => {
  try {
    // First verify teacher has access to this batch
    const batch = await Batch.findOne({
      _id: req.params.batchId,
      teachers: req.user.userId,
    });

    if (!batch) {
      return res
        .status(403)
        .json({ message: "Not authorized to access this batch" });
    }

    const quizzes = await Quiz.find({ batch: req.params.batchId });

    const quizzesWithStats = await Promise.all(
      quizzes.map(async (quiz) => {
        const submissions = await Submission.find({
          quiz: quiz._id,
          type: "quiz",
        });
        const gradedSubmissions = submissions.filter(
          (sub) => sub.status === "graded"
        );

        // Calculate submission percentage based on batch enrollment
        const submissionPercentage =
          batch.enrollmentCount > 0
            ? (submissions.length / batch.enrollmentCount) * 100
            : 0;

        return {
          ...quiz.toObject(),
          submissionStats: {
            total: submissions.length,
            graded: gradedSubmissions.length,
            pending: submissions.length - gradedSubmissions.length,
            averageScore:
              gradedSubmissions.length > 0
                ? gradedSubmissions.reduce((acc, sub) => acc + sub.marks, 0) /
                  gradedSubmissions.length
                : 0,
            submissionPercentage: Math.round(submissionPercentage),
            enrollmentCount: batch.enrollmentCount,
          },
        };
      })
    );

    res.json(quizzesWithStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a quiz by ID
exports.getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId)
      .populate("batch", "name")
      .populate("createdBy", "name");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Verify teacher has access
    const batch = await Batch.findOne({
      _id: quiz.batch,
      teachers: req.user.userId,
    });

    if (!batch) {
      return res
        .status(403)
        .json({ message: "Not authorized to access this quiz" });
    }

    // Include submission stats if requested
    if (req.query.includeStats) {
      const submissions = await Submission.find({
        quiz: quiz._id,
        type: "quiz",
      });
      const gradedSubmissions = submissions.filter(
        (sub) => sub.status === "graded"
      );

      const submissionStats = {
        total: submissions.length,
        graded: gradedSubmissions.length,
        pending: submissions.length - gradedSubmissions.length,
        averageScore:
          gradedSubmissions.length > 0
            ? gradedSubmissions.reduce((acc, sub) => acc + sub.marks, 0) /
              gradedSubmissions.length
            : 0,
      };

      return res.json({
        ...quiz.toObject(),
        submissionStats,
      });
    }

    res.json(quiz);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all submissions for a quiz
exports.getQuizSubmissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || "-submittedAt";

    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Verify teacher has access
    const batch = await Batch.findOne({
      _id: quiz.batch,
      teachers: req.user.userId,
    });

    if (!batch) {
      return res
        .status(403)
        .json({ message: "Not authorized to access these submissions" });
    }

    const submissions = await Submission.find({
      quiz: req.params.quizId,
      type: "quiz",
    })
      .populate("student", "name email")
      .populate("gradedBy", "name")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Submission.countDocuments({
      quiz: req.params.quizId,
      type: "quiz",
    });

    res.json({
      submissions,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get quiz statistics for student
exports.getStudentQuizStats = async (req, res) => {
  try {
    // Get all active enrollments for the student with populated batch and course
    const enrollments = await Enrollment.find({
      student: req.user.userId,
      status: "active",
    }).populate({
      path: "batch",
      select: "name status",
      populate: {
        path: "course",
        select: "title slug image category",
      },
    });

    const batchStats = await Promise.all(
      enrollments.map(async (enrollment) => {
        const batchQuizzes = await Quiz.find({ batch: enrollment.batch._id });
        const submissions = await Submission.find({
          student: req.user.userId,
          batch: enrollment.batch._id,
          type: "quiz",
        });

        const completedQuizzes = submissions.length;
        const pendingQuizzes = batchQuizzes.length - completedQuizzes;

        const gradedSubmissions = submissions.filter(
          (sub) => sub.status === "graded"
        );
        const averageScore =
          gradedSubmissions.length > 0
            ? (gradedSubmissions.reduce((acc, sub) => acc + sub.marks, 0) /
                gradedSubmissions.length) *
              100
            : 0;

        return {
          batchId: enrollment.batch._id,
          batchName: enrollment.batch.name,
          batchStatus: enrollment.batch.status,
          course: {
            id: enrollment.batch.course._id,
            title: enrollment.batch.course.title,
            slug: enrollment.batch.course.slug,
            image: enrollment.batch.course.image,
          },
          totalQuizzes: batchQuizzes.length,
          completedQuizzes,
          pendingQuizzes,
          averageScore,
          upcomingQuizzes: batchQuizzes.filter(
            (quiz) => new Date(quiz.dueDate) > new Date()
          ).length,
          overdueQuizzes: batchQuizzes.filter(
            (quiz) =>
              new Date(quiz.dueDate) < new Date() &&
              !submissions.find(
                (sub) => sub.quiz.toString() === quiz._id.toString()
              )
          ).length,
        };
      })
    );

    res.json({ batchStats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get quizzes in a batch for student
exports.getStudentBatchQuizzes = async (req, res) => {
  try {
    // Verify student is enrolled in the batch and get batch details
    const enrollment = await Enrollment.findOne({
      student: req.user.userId,
      batch: req.params.batchId,
      status: "active",
    }).populate({
      path: "batch",
      select: "name status",
      populate: {
        path: "course",
        select: "title",
      },
    });

    if (!enrollment) {
      return res.status(403).json({ message: "Not enrolled in this batch" });
    }

    // Get all quizzes for the batch, excluding answers
    const quizzes = await Quiz.find({ batch: req.params.batchId })
      .select("-questions.correctAnswer") // Exclude correct answers
      .populate("createdBy", "name")
      .lean();

    // Transform questions to only include necessary fields
    const sanitizedQuizzes = quizzes.map((quiz) => ({
      ...quiz,
      questions: quiz.questions.map((q) => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        marks: q.marks,
      })),
    }));

    // Get student's submissions for these quizzes
    const submissions = await Submission.find({
      student: req.user.userId,
      quiz: { $in: quizzes.map((q) => q._id) },
      type: "quiz",
    });

    // Enhance quiz data with submission info
    const enhancedQuizzes = sanitizedQuizzes.map((quiz) => {
      const submission = submissions.find(
        (s) => s.quiz.toString() === quiz._id.toString()
      );

      return {
        ...quiz,
        submission: submission
          ? {
              status: submission.status,
              submittedAt: submission.submittedAt,
              marks: submission.marks,
              totalMarks: quiz.totalMarks,
              score: ((submission.marks / quiz.totalMarks) * 100).toFixed(1),
            }
          : null,
        status: getQuizStatus(quiz, submission),
      };
    });

    res.json({
      batchName: enrollment.batch.name,
      courseName: enrollment.batch.course.title,
      quizzes: enhancedQuizzes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to determine quiz status
const getQuizStatus = (quiz, submission) => {
  const now = new Date();
  const dueDate = new Date(quiz.dueDate);

  if (submission) {
    return submission.status === "graded" ? "completed" : "submitted";
  }

  if (dueDate < now) {
    return "overdue";
  }

  return "pending";
};

// Get a quiz by ID for student
exports.getStudentQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId)
      .populate("batch", "name")
      .populate("createdBy", "name");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Verify student is enrolled
    const batch = await Batch.findOne({
      _id: quiz.batch,
      students: req.user.userId,
    });

    if (!batch) {
      return res.status(403).json({ message: "Not enrolled in this batch" });
    }

    // Get student's submission if exists
    const submission = await Submission.findOne({
      quiz: quiz._id,
      student: req.user.userId,
      type: "quiz",
    });

    res.json({
      ...quiz.toObject(),
      submission: submission
        ? {
            status: submission.status,
            submittedAt: submission.submittedAt,
            marks: submission.marks,
            answers: submission.answers,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get quiz for student attempt
exports.getQuizForAttempt = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId)
      .select(
        "title description duration totalMarks dueDate questions.question questions.options questions.marks"
      )
      .populate("batch", "name")
      .lean();

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Verify student is enrolled
    const enrollment = await Enrollment.findOne({
      student: req.user.userId,
      batch: quiz.batch._id,
      status: "active",
    });

    if (!enrollment) {
      return res.status(403).json({ message: "Not enrolled in this batch" });
    }

    // Check if quiz is past due date
    if (new Date(quiz.dueDate) < new Date()) {
      return res.status(403).json({ message: "Quiz has expired" });
    }

    // Check for existing submission
    const submission = await Submission.findOne({
      quiz: quiz._id,
      student: req.user.userId,
      type: "quiz",
    });

    if (submission && submission.status === "graded") {
      return res.status(403).json({ message: "Quiz already completed" });
    }

    res.json({
      ...quiz,
      submission: submission || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit quiz attempt
exports.submitQuizAttempt = async (req, res) => {
  try {
    const { answers } = req.body;
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Verify student is enrolled
    const enrollment = await Enrollment.findOne({
      student: req.user.userId,
      batch: quiz.batch,
      status: "active",
    });

    if (!enrollment) {
      return res.status(403).json({ message: "Not enrolled in this batch" });
    }

    // Check if quiz is past due date
    if (new Date(quiz.dueDate) < new Date()) {
      return res.status(403).json({ message: "Quiz has expired" });
    }

    // Check for existing submission
    const existingSubmission = await Submission.findOne({
      quiz: quiz._id,
      student: req.user.userId,
      type: "quiz",
    });

    if (existingSubmission && existingSubmission.status === "graded") {
      return res.status(403).json({ message: "Quiz already completed" });
    }

    // Calculate marks
    let totalMarks = 0;
    answers.forEach((answer, index) => {
      if (answer === quiz.questions[index].correctAnswer) {
        totalMarks += quiz.questions[index].marks;
      }
    });

    // Create or update submission
    const submission =
      existingSubmission ||
      new Submission({
        student: req.user.userId,
        batch: quiz.batch,
        quiz: quiz._id,
        type: "quiz",
      });

    submission.answers = answers.map((answer, index) => ({
      questionIndex: index,
      answer,
    }));
    submission.marks = totalMarks;
    submission.status = "graded";
    submission.submittedAt = new Date();

    await submission.save();

    res.json({ message: "Quiz submitted successfully", marks: totalMarks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get quiz review
exports.getQuizReview = async (req, res) => {
  try {
    const { quizId } = req.params;
    const studentId = req.user.userId;

    // Find the quiz with questions
    const quiz = await Quiz.findOne({ _id: quizId })
      .select("title description totalMarks questions")
      .lean();

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Get student's submission
    const submission = await Submission.findOne({
      quiz: quizId,
      student: studentId,
      type: "quiz", // Add this to ensure we get quiz submission
    }).lean();

    if (!submission) {
      return res.status(404).json({ message: "No submission found" });
    }

    // Format response with detailed review data
    const reviewData = {
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        totalMarks: quiz.totalMarks,
      },
      submission: {
        submittedAt: submission.submittedAt,
        marks: submission.marks,
        totalMarks: quiz.totalMarks,
        score: ((submission.marks / quiz.totalMarks) * 100).toFixed(1),
      },
      questions: quiz.questions.map((question, index) => {
        const submittedAnswer = submission.answers.find(
          (a) => a.questionIndex === index
        );
        return {
          question: question.question,
          options: question.options,
          marks: question.marks,
          correctAnswer: question.correctAnswer,
          userAnswer: submittedAnswer ? submittedAnswer.answer : null,
          isCorrect: submittedAnswer
            ? submittedAnswer.answer === question.correctAnswer
            : false,
        };
      }),
    };

    res.json(reviewData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
