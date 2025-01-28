const mongoose = require("mongoose");
const slugify = require("slugify");

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  image: {
    type: String,
  },
  imagePublicId: {
    type: String,
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
CategorySchema.index({ slug: 1 });
CategorySchema.index({ createdAt: -1 });

// Slug generation
CategorySchema.pre("validate", function (next) {
  if (this.name) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      trim: true,
    });
  }
  next();
});

// Validation hooks
CategorySchema.pre("save", async function (next) {
  if (this.name.length < 3) {
    return next(new Error("Category name must be at least 3 characters long"));
  }

  if (this.description.length < 10) {
    return next(
      new Error("Category description must be at least 10 characters long")
    );
  }

  return next();
});

module.exports = mongoose.model("Category", CategorySchema);