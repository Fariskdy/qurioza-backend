const mongoose = require("mongoose");

const BatchSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    batchNumber: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, "Batch name must be at least 3 characters"],
      maxlength: [50, "Batch name cannot exceed 50 characters"],
      validate: {
        validator: function (name) {
          return mongoose
            .model("Batch")
            .findOne({
              course: this.course,
              name: name,
              _id: { $ne: this._id },
            })
            .then((batch) => !batch);
        },
        message: "Batch name must be unique within the course",
      },
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
      validate: {
        validator: function (date) {
          // Skip validation for manual updates
          if (this.isAutoUpdated === false) return true;
          return date > new Date() && date < this.batchStartDate;
        },
        message:
          "Enrollment start date must be in future and before batch start",
      },
    },
    enrollmentEndDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (date) {
          // Skip date validation for manual updates
          if (this.isAutoUpdated === false) {
            return true;
          }
          return date > this.enrollmentStartDate && date < this.batchStartDate;
        },
        message: "Enrollment must end before batch starts",
      },
    },
    batchStartDate: {
      type: Date,
      required: true,
    },
    batchEndDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (date) {
          // Skip date validation for manual updates
          if (this.isAutoUpdated === false) {
            return true;
          }
          return date > this.batchStartDate;
        },
        message: "Batch end date must be after start date",
      },
    },
    maxStudents: {
      type: Number,
      required: true,
      min: [5, "Minimum 5 students required"],
      max: [50, "Maximum 50 students allowed"],
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
    isAutoUpdated: {
      type: Boolean,
      default: false,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["upcoming", "enrolling", "ongoing", "completed"],
          required: true,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        isAutomatic: {
          type: Boolean,
          default: false,
        },
        dates: {
          enrollmentStartDate: Date,
          enrollmentEndDate: Date,
          batchStartDate: Date,
          batchEndDate: Date,
        },
      },
    ],
    originalDates: {
      enrollmentStartDate: Date,
      enrollmentEndDate: Date,
      batchStartDate: Date,
      batchEndDate: Date,
    },
  },
  {
    timestamps: true,
    // Update middleware to enforce new rules
    pre: [
      "save",
      async function (next) {
        if (this.isNew || this.isModified("status")) {
          // Check for existing enrolling batch
          if (this.status === "enrolling") {
            const existingEnrollingBatch = await this.constructor.findOne({
              course: this.course,
              status: "enrolling",
              _id: { $ne: this._id },
            });

            if (existingEnrollingBatch) {
              throw new Error(
                "Another batch is currently enrolling for this course"
              );
            }
          }

          // Check for existing ongoing batch
          if (this.status === "ongoing") {
            const existingOngoingBatch = await this.constructor.findOne({
              course: this.course,
              status: "ongoing",
              _id: { $ne: this._id },
            });

            if (existingOngoingBatch) {
              throw new Error(
                "Another batch is currently ongoing for this course"
              );
            }
          }
        }
        next();
      },
    ],
  }
);

// Add indexes for better query performance
BatchSchema.index({ status: 1, enrollmentEndDate: 1 });
BatchSchema.index({ course: 1, batchStartDate: 1 });

// Add index for course lookup
BatchSchema.index({ course: 1 });

// Modified validation hook
BatchSchema.pre("save", function (next) {
  const currentDate = new Date();

  // Only track status changes, not initial status and not rollbacks
  if (this.isModified("status") && !this.isNew && !this._isRollback) {
    // Get the previous status from the document's previous state
    const previousStatus = this.getChanges().$set?.status
      ? this._previousStatus
      : this.status;

    // Important: Get original dates BEFORE any modifications
    const originalDates = {
      enrollmentStartDate:
        this._original?.enrollmentStartDate || this.enrollmentStartDate,
      enrollmentEndDate:
        this._original?.enrollmentEndDate || this.enrollmentEndDate,
      batchStartDate: this._original?.batchStartDate || this.batchStartDate,
      batchEndDate: this._original?.batchEndDate || this.batchEndDate,
    };

    // If manual update, update relevant date to current
    if (!this.isAutoUpdated) {
      switch (this.status) {
        case "enrolling":
          this.enrollmentStartDate = currentDate;
          break;
        case "ongoing":
          this.batchStartDate = currentDate;
          break;
        case "completed":
          this.batchEndDate = currentDate;
          break;
      }
    }

    // Add to history with original dates snapshot
    this.statusHistory.push({
      status: previousStatus,
      updatedAt: currentDate,
      isAutomatic: this.isAutoUpdated,
      dates: originalDates, // Store original dates before any changes
    });
  }

  // Basic date sequence validation only for auto-updates
  if (this.isAutoUpdated) {
    if (this.enrollmentStartDate >= this.enrollmentEndDate) {
      return next(new Error("Enrollment start date must be before end date"));
    }
    if (this.enrollmentEndDate >= this.batchStartDate) {
      return next(new Error("Enrollment must end before batch starts"));
    }
    if (this.batchStartDate >= this.batchEndDate) {
      return next(new Error("Batch start date must be before end date"));
    }
  }

  // Status-specific validations only for auto-updates
  if (this.isModified("status") && this.isAutoUpdated) {
    this.lastStatusUpdate = currentDate;

    // Validate status changes based on dates only for auto-updates
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

  // Enrollment limit validation always applies
  if (this.enrollmentCount > this.maxStudents) {
    return next(new Error("Batch has reached maximum student capacity"));
  }

  next();
});

// Add this to capture original values when document is loaded
BatchSchema.pre("init", function (data) {
  // Store the initial status and dates
  this._previousStatus = data.status;
  this._original = {
    enrollmentStartDate: data.enrollmentStartDate,
    enrollmentEndDate: data.enrollmentEndDate,
    batchStartDate: data.batchStartDate,
    batchEndDate: data.batchEndDate,
  };
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

// Add this method to BatchSchema
BatchSchema.statics.updateBatchStatuses = async function () {
  const currentDate = new Date();

  // Update to enrolling - only for batches without manual intervention
  const enrollingBatches = await this.find({
    status: "upcoming",
    enrollmentStartDate: { $lte: currentDate },
    isAutoUpdated: true, // Only update auto-managed batches
  });

  for (const batch of enrollingBatches) {
    // Check if another batch is enrolling
    const existingEnrollingBatch = await this.findOne({
      course: batch.course,
      status: "enrolling",
      _id: { $ne: batch._id },
    });

    if (!existingEnrollingBatch) {
      batch.status = "enrolling";
      batch.lastStatusUpdate = currentDate;
      await batch.save();
    }
  }

  // Update to ongoing - only for batches without manual intervention
  const ongoingBatches = await this.find({
    status: "enrolling",
    batchStartDate: { $lte: currentDate },
    isAutoUpdated: true,
  });

  for (const batch of ongoingBatches) {
    // Check if another batch is ongoing
    const existingOngoingBatch = await this.findOne({
      course: batch.course,
      status: "ongoing",
      _id: { $ne: batch._id },
    });

    if (
      !existingOngoingBatch &&
      batch.teachers.length > 0 &&
      batch.enrollmentCount > 0
    ) {
      batch.status = "ongoing";
      batch.lastStatusUpdate = currentDate;
      await batch.save();
    }
  }

  // Update to completed - can be automatic for all batches
  await this.updateMany(
    {
      status: "ongoing",
      batchEndDate: { $lte: currentDate },
    },
    {
      status: "completed",
      lastStatusUpdate: currentDate,
    }
  );
};

// Add method to toggle auto-update
BatchSchema.methods.toggleAutoUpdate = async function (enabled) {
  this.isAutoUpdated = enabled;
  await this.save();
};

module.exports = mongoose.model("Batch", BatchSchema);
