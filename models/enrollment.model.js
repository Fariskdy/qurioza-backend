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
});

// Add helper method to check content completion
EnrollmentSchema.methods.isContentCompleted = function (moduleId, contentId) {
  return this.completedContent.some(
    (item) =>
      item.moduleId.toString() === moduleId.toString() &&
      item.contentId.toString() === contentId.toString()
  );
};

module.exports = mongoose.model("Enrollment", EnrollmentSchema);
