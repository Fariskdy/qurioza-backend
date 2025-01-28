const Media = require("../models/media.model");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../config/cloudinary");

// Initialize upload - Simplified
const initializeUpload = async (req, res) => {
  try {
    // We only need to know it's a video at this point
    const media = await Media.create({
      status: "pending",
      uploadedBy: req.user.userId,
      fileType: "video",
    });

    res.status(201).json({
      mediaId: media._id,
      status: "pending",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error initializing upload",
      error: error.message,
    });
  }
};

// Process upload - Now handles file metadata and uploadType
const processUpload = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { uploadType } = req.query; // Get uploadType from query params

    const media = await Media.findById(mediaId);

    if (!media || media.uploadedBy.toString() !== req.user.userId) {
      return res.status(404).json({ message: "Media not found" });
    }

    // Validate file
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    // Log file details
    console.log("File details:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadType: uploadType, // Log the uploadType
    });

    // Update file details
    media.status = "processing";
    media.originalName = req.file.originalname;
    media.mimeType = req.file.mimetype;
    media.size = req.file.size;
    await media.save();

    // Upload to Cloudinary with specified uploadType
    let result;
    try {
      result = await uploadToCloudinary(
        req.file.buffer,
        uploadType, // Use the specified uploadType
        req.file.mimetype
      );
    } catch (uploadError) {
      media.status = "failed";
      media.error = uploadError.message;
      await media.save();
      throw uploadError;
    }

    // Update media record with results
    media.url = result.url;
    media.publicId = result.publicId;
    media.thumbnail = result.thumbnail;
    media.status = "completed";
    await media.save();

    res.json(media);
  } catch (error) {
    console.error("Upload process error:", error);

    // Update media status to failed
    if (req.params.mediaId) {
      await Media.findByIdAndUpdate(req.params.mediaId, {
        status: "failed",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Error processing upload",
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Associate media with course/category
const associateMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { model, id } = req.body;

    const media = await Media.findOneAndUpdate(
      {
        _id: mediaId,
        uploadedBy: req.user.userId,
        status: "completed",
      },
      {
        associatedWith: { model, id },
      },
      { new: true }
    );

    if (!media) {
      return res
        .status(404)
        .json({ message: "Media not found or not available" });
    }

    res.json(media);
  } catch (error) {
    res.status(500).json({
      message: "Error associating media",
      error: error.message,
    });
  }
};

// Get user's unassociated media
const getUnassociatedMedia = async (req, res) => {
  try {
    const media = await Media.find({
      uploadedBy: req.user.userId,
      "associatedWith.id": { $exists: false },
      status: "completed",
    }).sort("-createdAt");

    res.json(media);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching media",
      error: error.message,
    });
  }
};

module.exports = {
  initializeUpload,
  processUpload,
  associateMedia,
  getUnassociatedMedia,
};
