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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Add indexes for better query performance
CategorySchema.index({ slug: 1 });
CategorySchema.index({ createdAt: -1 });

CategorySchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      trim: true,
    });
  }

  // Validate name length
  if (this.name.length < 3) {
    next(new Error("Category name must be at least 3 characters long"));
  }

  // Validate description length
  if (this.description.length < 10) {
    next(new Error("Category description must be at least 10 characters long"));
  }

  next();
});

module.exports = mongoose.model("Category", CategorySchema);
