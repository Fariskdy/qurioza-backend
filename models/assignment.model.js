const mongoose = require("mongoose");

const AssignmentSchema = new mongoose.Schema({
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true,
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Module",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  totalMarks: {
    type: Number,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add indexes for better query performance
AssignmentSchema.index({ batch: 1, dueDate: 1 });
AssignmentSchema.index({ module: 1, batch: 1 });
AssignmentSchema.index({ createdBy: 1 });

// Validation hook
AssignmentSchema.pre("save", function (next) {
  // Validate total marks
  if (this.totalMarks <= 0) {
    next(new Error("Total marks must be positive"));
  }

  // Validate due date is in future
  if (this.dueDate <= new Date()) {
    next(new Error("Due date must be in the future"));
  }

  next();
});

module.exports = mongoose.model("Assignment", AssignmentSchema);
