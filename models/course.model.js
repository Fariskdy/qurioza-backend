const mongoose = require("mongoose");
const slugify = require("slugify");

const CourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
    index: true,
  },
  coordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  duration: {
    type: Number, // in weeks
    required: true,
  },
  totalHours: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  image: {
    type: String,
    required: false, // Optional
  },
  previewVideo: {
    url: {
      type: String,
      required: false,
    },
    thumbnail: {
      type: String,
      required: false,
    },
  },
  level: {
    type: String,
    enum: ["Beginner", "Intermediate", "Advanced"],
    required: true,
  },
  // Course highlights
  features: [
    {
      type: String,
    },
  ],
  learningOutcomes: [
    {
      type: String,
    },
  ],
  requirements: [
    {
      type: String,
    },
  ],
  // Course stats
  stats: {
    enrolledStudents: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    completionRate: {
      type: Number,
      default: 0,
    },
  },
  // Course metadata
  language: {
    type: String,
    default: "English",
  },
  certificates: {
    isEnabled: {
      type: Boolean,
      default: true,
    },
    type: {
      type: String,
      enum: ["completion", "achievement"],
      default: "completion",
    },
  },
  tags: [
    {
      type: String,
    },
  ],
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  featured: {
    type: Boolean,
    default: false,
  },
});

// Virtual for calculating total lectures
CourseSchema.virtual("totalLectures").get(function () {
  return 0;
});

// Virtual for calculating total duration
CourseSchema.virtual("totalDuration").get(function () {
  return 0;
});

// Add indexes for better query performance
CourseSchema.index({ category: 1, status: 1 });
CourseSchema.index({ coordinator: 1, status: 1 });
CourseSchema.index({ slug: 1 });
CourseSchema.index({ "stats.rating": -1, status: 1 }); // For sorting by rating

// Enhanced validation hook
CourseSchema.pre("validate", function (next) {
  if (this.title) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      trim: true,
    });
  }
  next();
});

CourseSchema.pre("save", function (next) {
  // Validate price
  if (this.price < 0) {
    next(new Error("Price cannot be negative"));
  }

  // Validate duration and total hours
  if (this.duration <= 0 || this.totalHours <= 0) {
    next(new Error("Duration and total hours must be positive"));
  }

  // Update timestamps
  this.updatedAt = Date.now();

  next();
});

// Add method to check if course can start new batch
CourseSchema.methods.getActiveBatch = async function () {
  const Batch = mongoose.model("Batch");
  return await Batch.findOne({
    course: this._id,
    status: { $in: ["enrolling", "ongoing"] },
  });
};

CourseSchema.methods.canStartNewBatch = async function () {
  const Batch = mongoose.model("Batch");

  // Find active batches (enrolling or ongoing)
  const activeBatches = await Batch.find({
    course: this._id,
    status: { $in: ["enrolling", "ongoing"] },
  }).sort({ batchStartDate: 1 });

  // If no active batches, we can start a new one
  if (activeBatches.length === 0) return true;

  // Only check if there's already an enrolling batch
  const enrollingBatch = activeBatches.find((b) => b.status === "enrolling");

  // If there's an enrolling batch, don't allow another
  if (enrollingBatch) return false;

  // Allow new batch enrollment regardless of ongoing batch status
  return true;
};

// Add missing virtuals
CourseSchema.virtual("isDiscounted").get(function () {
  return (
    this.pricing.discountedPrice && this.pricing.discountExpiresAt > Date.now()
  );
});

// Add missing methods
CourseSchema.methods.calculateProgress = async function (studentId) {
  // Calculate student's progress in course
};

module.exports = mongoose.model("Course", CourseSchema);
