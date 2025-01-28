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
  // Updated content structure
  content: [
    {
      title: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: ["video", "document", "link", "quiz"],
        required: true,
      },
      description: String,
      order: {
        type: Number,
        required: true,
      },
      url: String,
      publicId: String,
      mediaId: mongoose.Schema.Types.ObjectId, // Reference to Media model for videos
      mimeType: String,
      size: Number,
      duration: Number,
      isPreview: {
        type: Boolean,
        default: false,
      },
      uniqueId: {
        type: String,
        required: true,
      },
      resources: [
        {
          title: String,
          type: String,
          url: String,
          publicId: String,
          size: Number,
          mimeType: String,
        },
      ],
      batchSpecificSettings: {
        isEnabled: {
          type: Boolean,
          default: true,
        },
        visibleFromDate: Date,
      },
    },
  ],
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

  // Validate content items
  for (const item of this.content) {
    // Validate required URLs for video and document types
    if ((item.type === "video" || item.type === "document") && !item.url) {
      next(new Error(`URL required for ${item.type} content`));
    }

    // Validate resources
    if (item.resources) {
      for (const resource of item.resources) {
        if (!resource.url) {
          next(new Error("Resource URL is required"));
        }
      }
    }
  }

  // Add to existing validation
  const videoCount = this.content.filter(
    (item) => item.type === "video"
  ).length;
  if (videoCount > 10) {
    next(new Error("Maximum 10 videos per module"));
  }

  let totalSize = 0;
  for (const item of this.content) {
    if (item.size) totalSize += item.size;
  }
  if (totalSize > 1024 * 1024 * 500) {
    // 500MB
    next(new Error("Total content size exceeds limit"));
  }

  // Validate content order
  if (this.content.length > 0) {
    const orders = this.content.map((item) => item.order);
    const uniqueOrders = new Set(orders);

    // Check for duplicate orders
    if (orders.length !== uniqueOrders.size) {
      next(new Error("Duplicate content order values found"));
    }

    // Check for sequential ordering
    const maxOrder = Math.max(...orders);
    if (maxOrder >= this.content.length) {
      next(new Error("Content order must be sequential starting from 0"));
    }
  }

  // Update timestamp
  this.updatedAt = Date.now();

  next();
});

ModuleSchema.methods.getNextModule = async function () {
  return this.model("Module").findOne({
    course: this.course,
    order: this.order + 1,
  });
};

module.exports = mongoose.model("Module", ModuleSchema);
