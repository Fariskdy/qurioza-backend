const mongoose = require("mongoose");

const BatchSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  batchNumber: {
    type: Number,
    required: true,
  },
  teachers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  enrollmentStartDate: {
    type: Date,
    required: true,
  },
  enrollmentEndDate: {
    type: Date,
    required: true,
  },
  batchStartDate: {
    type: Date,
    required: true,
  },
  batchEndDate: {
    type: Date,
    required: true,
  },
  maxStudents: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["upcoming", "enrolling", "ongoing", "completed"],
    default: "upcoming",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add indexes for better query performance
BatchSchema.index({ status: 1, enrollmentEndDate: 1 });
BatchSchema.index({ course: 1, batchStartDate: 1 });

// Validation hook for dates
BatchSchema.pre("save", function (next) {
  // Ensure dates are in correct order
  if (this.enrollmentStartDate >= this.enrollmentEndDate) {
    next(new Error("Enrollment start date must be before end date"));
  }
  if (this.batchStartDate >= this.batchEndDate) {
    next(new Error("Batch start date must be before end date"));
  }
  if (this.enrollmentEndDate > this.batchStartDate) {
    next(new Error("Enrollment must end before batch starts"));
  }
  next();
});

// Existing compound index
BatchSchema.index(
  { course: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["enrolling", "ongoing"] },
    },
  }
);

module.exports = mongoose.model("Batch", BatchSchema);
