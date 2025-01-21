const mongoose = require("mongoose");

const ModuleSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
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
  order: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number, // Total duration in minutes
    required: true,
  },
  lectureCount: {
    type: Number,
    required: true,
  },
  // Detailed content structure matching the UI
  content: [
    {
      title: String,
      type: {
        type: String,
        enum: ["video", "document", "link", "quiz"],
        required: true,
      },
      description: String,
      url: String,
      duration: Number, // in minutes
      isPreview: {
        type: Boolean,
        default: false,
      },
      resources: [
        {
          title: String,
          type: String,
          url: String,
          size: Number, // in bytes
        },
      ],
      // For tracking completion in enrollments
      uniqueId: {
        type: String,
        required: true,
      },
      batchSpecificSettings: {
        isEnabled: {
          type: Boolean,
          default: true,
        },
        visibleFromDate: Date,
        // Other batch-specific settings
      },
    },
  ],
  learningObjectives: [
    {
      type: String,
    },
  ],
  requirements: [
    {
      type: String,
    },
  ],
  coordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Add virtual for progress calculation
ModuleSchema.virtual("totalContent").get(function () {
  return this.content.length;
});

// Add indexes for better query performance
ModuleSchema.index({ course: 1, order: 1 });
ModuleSchema.index({ coordinator: 1 });

// Validation hook
ModuleSchema.pre("save", function (next) {
  // Validate order
  if (this.order < 0) {
    next(new Error("Module order must be non-negative"));
  }

  // Validate duration
  if (this.duration <= 0) {
    next(new Error("Module duration must be positive"));
  }

  // Validate lecture count
  if (this.lectureCount <= 0) {
    next(new Error("Module must have at least one lecture"));
  }

  // Ensure content has valid uniqueIds
  const uniqueIds = new Set();
  for (const item of this.content) {
    if (uniqueIds.has(item.uniqueId)) {
      next(new Error("Content items must have unique IDs"));
    }
    uniqueIds.add(item.uniqueId);
  }

  // Update timestamp
  this.updatedAt = Date.now();

  next();
});

// Add method to get next module in course
ModuleSchema.methods.getNextModule = async function () {
  return this.model("Module").findOne({
    course: this.course,
    order: this.order + 1,
  });
};

module.exports = mongoose.model("Module", ModuleSchema);
