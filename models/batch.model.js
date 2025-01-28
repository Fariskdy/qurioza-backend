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
    required: true,
  },
  enrollmentCount: {
    type: Number,
    default: 0,
  },
  lastStatusUpdate: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add indexes for better query performance
BatchSchema.index({ status: 1, enrollmentEndDate: 1 });
BatchSchema.index({ course: 1, batchStartDate: 1 });

// Enhanced validation hook
BatchSchema.pre("save", function (next) {
  const currentDate = new Date();

  // Basic date sequence validation
  if (this.enrollmentStartDate >= this.enrollmentEndDate) {
    return next(new Error("Enrollment start date must be before end date"));
  }
  if (this.enrollmentEndDate >= this.batchStartDate) {
    return next(new Error("Enrollment must end before batch starts"));
  }
  if (this.batchStartDate >= this.batchEndDate) {
    return next(new Error("Batch start date must be before end date"));
  }

  // Status-specific validations
  if (this.isModified("status")) {
    this.lastStatusUpdate = currentDate;

    // Validate status changes based on dates
    switch (this.status) {
      case "enrolling":
        if (currentDate < this.enrollmentStartDate) {
          return next(
            new Error("Cannot start enrollment before scheduled date")
          );
        }
        break;
      case "ongoing":
        if (currentDate < this.batchStartDate) {
          return next(new Error("Cannot start batch before scheduled date"));
        }
        break;
      case "completed":
        if (currentDate < this.batchEndDate) {
          return next(new Error("Cannot complete batch before end date"));
        }
        break;
    }
  }

  // Enrollment limit validation
  if (this.enrollmentCount > this.maxStudents) {
    return next(new Error("Batch has reached maximum student capacity"));
  }

  next();
});

// Status transition validation method
BatchSchema.methods.canTransitionTo = async function (newStatus) {
  const validTransitions = {
    upcoming: ["enrolling"],
    enrolling: ["ongoing"],
    ongoing: ["completed"],
    completed: [],
  };

  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${this.status} to ${newStatus}`
    );
  }

  return true;
};

// Check if batch is near completion
BatchSchema.methods.isNearCompletion = function () {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return this.batchEndDate <= thirtyDaysFromNow;
};

// Separate indexes for enrolling and ongoing
BatchSchema.index(
  { course: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      $or: [{ status: "enrolling" }, { status: "ongoing" }],
    },
  }
);

module.exports = mongoose.model("Batch", BatchSchema);
