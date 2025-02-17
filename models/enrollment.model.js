const mongoose = require("mongoose");

const EnrollmentSchema = new mongoose.Schema({
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
  enrollmentDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["active", "completed", "dropped"],
    default: "active",
  },
  progress: {
    type: Number,
    default: 0,
  },
  completedModules: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Module",
    },
  ],
  completedContent: [
    {
      moduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Module",
      },
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      completedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  payment: {
    status: {
      type: String,
      enum: ["completed", "failed"],
      required: true,
    },
    stripePaymentId: {
      type: String,
      required: true,
    },
    stripeSessionId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
    paidAt: {
      type: Date,
      required: true,
    },
  },
});

// Add helper method to check content completion
EnrollmentSchema.methods.isContentCompleted = function (moduleId, contentId) {
  return this.completedContent.some(
    (item) =>
      item.moduleId.toString() === moduleId.toString() &&
      item.contentId.toString() === contentId.toString()
  );
};

// Add helper methods
EnrollmentSchema.methods.isPaid = function () {
  return this.payment && this.payment.status === "completed";
};

EnrollmentSchema.methods.requiresPayment = function () {
  return false;
};

// Add virtual for payment status
EnrollmentSchema.virtual("paymentStatus").get(function () {
  return this.payment.status;
});

// Add index for stripe session lookup
EnrollmentSchema.index({ "payment.stripeSessionId": 1 });

// Add index for batch lookup
EnrollmentSchema.index({ batch: 1 });

// Add compound index for student and batch
EnrollmentSchema.index({ student: 1, batch: 1 }, { unique: true });

module.exports = mongoose.model("Enrollment", EnrollmentSchema);
