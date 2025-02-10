const Media = require("../models/media.model");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../config/cloudinary");
const Module = require("../models/module.model");

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

    console.log("Result: ", result);

    // Update media record with results
    media.url = result.url;
    media.publicId = result.public_id;
    media.thumbnail = result.thumbnail;
    media.size = result.bytes;
    media.duration = result.duration;
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

// Update the handleMediaUpload function to remove description
const handleMediaUpload = async (req, res) => {
  try {
    const { moduleId, contentId } = req.params;
    const file = req.file;

    const module = await Module.findById(moduleId);
    const content = module.content.id(contentId);

    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    const result = await uploadToCloudinary(file.path, content.type);

    content.url = result.secure_url;
    content.publicId = result.public_id;
    content.size = result.bytes;
    content.mimeType = file.mimetype;

    if (content.type === "video") {
      content.duration = result.duration;
    }

    await module.save();
    res.json(module);
  } catch (error) {
    res.status(500).json({
      message: "Error uploading media",
      error: error.message,
    });
  }
};

module.exports = {
  initializeUpload,
  processUpload,
  associateMedia,
  getUnassociatedMedia,
  handleMediaUpload,
};
