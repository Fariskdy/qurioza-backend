const cloudinary = require("cloudinary").v2;

// Make sure these environment variables are set
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  private_cdn: false,
});

// Simplify upload configs
const UPLOAD_CONFIGS = {
  categoryImage: {
    folder: "categories",
    resourceType: "image",
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    fileExtensions: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    },
  },
  courseImage: {
    folder: "courses/images",
    resourceType: "image",
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    fileExtensions: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    },
  },
  courseVideo: {
    folder: "courses/videos",
    resourceType: "video",
    allowedTypes: ["video/mp4", "video/quicktime"],
    fileExtensions: {
      "video/mp4": "mp4",
      "video/quicktime": "mov",
    },
  },
  moduleVideo: {
    folder: "courses/modules/videos",
    resourceType: "video",
    allowedTypes: ["video/mp4", "video/quicktime"],
    fileExtensions: {
      "video/mp4": "mp4",
      "video/quicktime": "mov",
    },
  },
  moduleDocument: {
    folder: "courses/modules/documents",
    resourceType: "raw",
    allowedTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    fileExtensions: {
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "pptx",
    },
  },
  moduleResource: {
    folder: "courses/modules/resources",
    resourceType: "raw",
    allowedTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
    ],
    fileExtensions: {
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "text/plain": "txt",
      "application/zip": "zip",
      "application/x-zip-compressed": "zip",
    },
  },
  assignmentSubmission: {
    folder: "assignments/submissions",
    resourceType: "raw",
    allowedTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    fileExtensions: {
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "text/plain": "txt",
      "application/zip": "zip",
      "application/x-zip-compressed": "zip",
      "application/x-rar-compressed": "rar",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    },
  },
  avatar: {
    folder: "users/avatars",
    resourceType: "image",
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    fileExtensions: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    },
  },
};

const uploadToCloudinary = async (
  fileBuffer,
  uploadType,
  mimetype,
  retries = 3
) => {
  const uploadWithRetry = async (attempt = 1) => {
    try {
      // First validate uploadType exists
      if (!UPLOAD_CONFIGS[uploadType]) {
        throw new Error(`Invalid upload type: ${uploadType}`);
      }

      // Then validate mime type
      if (!UPLOAD_CONFIGS[uploadType].allowedTypes?.includes(mimetype)) {
        throw new Error(
          `Unsupported file type: ${mimetype} for upload type: ${uploadType}`
        );
      }

      // Get file extension
      const fileExtension =
        UPLOAD_CONFIGS[uploadType].fileExtensions?.[mimetype];
      if (!fileExtension) {
        throw new Error(`Unknown file extension for mime type: ${mimetype}`);
      }

      const result = await new Promise((resolve, reject) => {
        const uploadOptions = {
          folder: UPLOAD_CONFIGS[uploadType].folder,
          resource_type: UPLOAD_CONFIGS[uploadType].resourceType,
          timeout: 120000,
          chunk_size: 6000000,
          use_filename: true,
          unique_filename: true,
          format: fileExtension,
        };

        cloudinary.uploader
          .upload_stream(uploadOptions, (error, result) => {
            if (error) {
              reject(error);
            } else {
              result.fileType = {
                extension: fileExtension,
                mimeType: mimetype,
              };
              resolve(result);
            }
          })
          .end(fileBuffer);
      });

      if (!result?.secure_url && attempt < retries) {
        throw new Error("Upload failed - retrying");
      }
      return result;
    } catch (error) {
      if (attempt < retries) {
        console.log(`Retrying upload (attempt ${attempt})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return uploadWithRetry(attempt + 1);
      }
      throw error;
    }
  };

  return uploadWithRetry();
};

const deleteFromCloudinary = async (publicId, resourceType = "raw") => {
  try {
    console.log(`Attempting to delete: ${publicId} (${resourceType})`);

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    console.log("Delete result:", result);

    if (result.result !== "ok") {
      throw new Error(`Cloudinary deletion failed: ${result.result}`);
    }

    return result;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw error;
  }
};

// Add image optimization
const optimizeImage = async (publicId, options) => {
  return cloudinary.url(publicId, {
    transformation: [
      { width: options.width, height: options.height, crop: "fill" },
      { quality: "auto", fetch_format: "auto" },
    ],
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  optimizeImage,
  UPLOAD_CONFIGS,
};
