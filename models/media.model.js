const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema({
  fileType: {
    type: String,
    enum: ["video"],
    default: "video",
    required: true,
  },
  originalName: String,
  mimeType: String,
  size: Number,
  url: String,
  publicId: String,
  thumbnail: String,
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  error: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  associatedWith: {
    model: {
      type: String,
      enum: ["Course", "Module"], // Added Module support
    },
    id: mongoose.Schema.Types.ObjectId,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: "24h",
  },
});

MediaSchema.index({ uploadedBy: 1, status: 1, createdAt: 1 });

// Add verification methods
// Add cleanup hooks

module.exports = mongoose.model("Media", MediaSchema);
