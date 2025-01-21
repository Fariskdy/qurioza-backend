const mongoose = require("mongoose");

const SubmissionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true,
  },
  type: {
    type: String,
    enum: ["assignment", "quiz"],
    required: true,
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Assignment",
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
  },
  answers: [
    {
      questionIndex: Number,
      answer: mongoose.Schema.Types.Mixed,
    },
  ],
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  content: String,
  attachments: [
    {
      filename: String,
      url: String,
      mimetype: String,
    },
  ],
  marks: {
    type: Number,
    default: 0,
  },
  feedback: String,
  status: {
    type: String,
    enum: ["submitted", "graded", "late"],
    default: "submitted",
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  gradedAt: Date,
});

// Validate that either assignment or quiz is provided based on type
SubmissionSchema.pre("save", function (next) {
  if (this.type === "assignment" && !this.assignment) {
    next(new Error("Assignment ID is required for assignment submissions"));
  }
  if (this.type === "quiz" && !this.quiz) {
    next(new Error("Quiz ID is required for quiz submissions"));
  }
  next();
});

module.exports = mongoose.model("Submission", SubmissionSchema);
