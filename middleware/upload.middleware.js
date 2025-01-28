const multer = require("multer");
const { UPLOAD_CONFIGS } = require("../config/cloudinary");

// File type configurations
const FILE_CONFIGS = {
  image: {
    maxSize: 5 * 1024 * 1024, // 5MB
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  video: {
    maxSize: 50 * 1024 * 1024, // Increased to 50MB
    mimeTypes: ["video/mp4", "video/quicktime"],
  },
  document: {
    maxSize: 10 * 1024 * 1024, // 10MB
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  },
};

// Create multer instance with configuration
const createUploadMiddleware = (allowedTypes = ["image"]) => {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: Math.max(
        ...allowedTypes.map((type) => FILE_CONFIGS[type].maxSize)
      ),
    },
    fileFilter: (req, file, cb) => {
      // Determine file type
      let fileType;
      if (file.mimetype.startsWith("image/")) fileType = "image";
      else if (file.mimetype.startsWith("video/")) fileType = "video";
      else if (
        file.mimetype.startsWith("application/pdf") ||
        file.mimetype.startsWith("application/msword") ||
        file.mimetype.startsWith(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) ||
        file.mimetype.startsWith("application/vnd.ms-powerpoint") ||
        file.mimetype.startsWith(
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
      )
        fileType = "document";
      else {
        return cb(new Error("Unsupported file type"), false);
      }

      // Check if file type is allowed for this upload
      if (!allowedTypes.includes(fileType)) {
        return cb(new Error(`${fileType} files are not allowed`), false);
      }

      // Check file size
      if (file.size > FILE_CONFIGS[fileType].maxSize) {
        const error = new Error(
          `${fileType.toUpperCase()} files must be smaller than ${
            FILE_CONFIGS[fileType].maxSize / 1024 / 1024
          }MB`
        );
        return cb(error, false);
      }

      // Check mime type
      if (!FILE_CONFIGS[fileType].mimeTypes.includes(file.mimetype)) {
        return cb(new Error(`Unsupported ${fileType} format`), false);
      }

      cb(null, true);
    },
  });
};

// Error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      message: "File upload error",
      error: err.message,
    });
  }
  next(err);
};

// Create module-specific upload middleware
const moduleUpload = createUploadMiddleware(["video", "document"]);

module.exports = {
  createUploadMiddleware,
  handleUploadError,
  moduleUpload,
};
