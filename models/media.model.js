const mongoose = require("mongoose");
const { deleteFromCloudinary } = require("../config/cloudinary");

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
  duration: Number,
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
      enum: ["Course", "Module"],
    },
    id: mongoose.Schema.Types.ObjectId,
    field: {
      type: String,
      enum: ["previewVideo", "video"],
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Regular index for queries
MediaSchema.index({ uploadedBy: 1, status: 1, createdAt: 1 });

// Cleanup hook - delete from Cloudinary when document is deleted
MediaSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function () {
    if (this.publicId) {
      try {
        const fullPublicId = this.publicId;
        const result = await deleteFromCloudinary(fullPublicId, "video");
      } catch (error) {
        console.error("Error deleting from Cloudinary:", error, {
          publicId: this.publicId,
          fileType: this.fileType,
          associatedWith: this.associatedWith,
        });
      }
    }
  }
);

// Replace the video association middleware with this improved version
MediaSchema.pre("save", async function (next) {
  // Only run if associatedWith is being modified
  if (this.isModified("associatedWith") && this.associatedWith) {
    try {
      // Get the current session if one exists
      const session = this.$session();
      this._oldAssociationsQuery = {
        _id: { $ne: this._id },
        "associatedWith.model": this.associatedWith.model,
        "associatedWith.id": this.associatedWith.id,
      };
    } catch (error) {
      console.error("Error in pre-save middleware:", error);
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Media", MediaSchema);
