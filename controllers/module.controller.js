const Module = require("../models/module.model");
const Course = require("../models/course.model");
const Media = require("../models/media.model");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
  cloudinary,
} = require("../config/cloudinary");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Enrollment = require("../models/enrollment.model");
const Batch = require("../models/batch.model");

// MODULE FUNCTIONS

// Get all modules for a course
const getModules = async (req, res) => {
  try {
    const modules = await Module.find({ course: req.params.courseId })
      .sort({ order: 1 })
      .populate("coordinator", "username");

    res.json(modules);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching modules",
      error: error.message,
    });
  }
};

// Get single module
const getModule = async (req, res) => {
  try {
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
    }).populate("coordinator", "username");

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    res.json(module);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching module",
      error: error.message,
    });
  }
};

// Simplified module creation without content
const createModule = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Get highest order number
    const lastModule = await Module.findOne({ course: req.params.courseId })
      .sort({ order: -1 })
      .lean();
    const newOrder = lastModule ? lastModule.order + 1 : 0;

    const moduleData = {
      title: req.body.title,
      description: req.body.description,
      duration: parseInt(req.body.duration),
      lectureCount: parseInt(req.body.lectureCount),
      course: req.params.courseId,
      coordinator: req.user.userId,
      order: newOrder,
      status: req.body.status || "draft",
      isOptional: req.body.isOptional || false,
      content: [], // Start with empty content
    };

    const module = await Module.create(moduleData);
    res.status(201).json(module);
  } catch (error) {
    res.status(500).json({
      message: "Error creating module",
      error: error.message,
    });
  }
};

// Simplified module update (basic info only)
const updateModule = async (req, res) => {
  try {
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Update only basic module info
    const updates = {
      title: req.body.title,
      description: req.body.description,
      duration: parseInt(req.body.duration),
      lectureCount: parseInt(req.body.lectureCount),
      status: req.body.status,
      isOptional: req.body.isOptional,
      updatedAt: Date.now(),
    };

    Object.assign(module, updates);
    await module.save();
    res.json(module);
  } catch (error) {
    res.status(500).json({
      message: "Error updating module",
      error: error.message,
    });
  }
};

// Delete module with enhanced cleanup
const deleteModule = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
      coordinator: req.user.userId,
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Find and delete all associated media
    const mediaToDelete = await Media.find({
      "associatedWith.model": "Module",
      "associatedWith.id": module._id,
    }).session(session);

    // Delete each media document (which will trigger the pre-deleteOne hook)
    for (const media of mediaToDelete) {
      await media.deleteOne({ session });
    }

    // Delete the module
    await module.deleteOne({ session });

    await session.commitTransaction();
    res.json({ message: "Module deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      message: "Error deleting module",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Reorder module with transaction (IMPROVED)
const reorderModule = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { newOrder } = req.body;
      const module = await Module.findOne({
        _id: req.params.moduleId,
        course: req.params.courseId,
        coordinator: req.user.userId,
      }).session(session);

      if (!module) {
        throw new Error("Module not found");
      }

      const oldOrder = module.order;

      // If moving down the list
      if (newOrder > oldOrder) {
        await Module.updateMany(
          {
            course: req.params.courseId,
            order: { $gt: oldOrder, $lte: newOrder },
          },
          { $inc: { order: -1 } },
          { session }
        );
      }
      // If moving up the list
      else if (newOrder < oldOrder) {
        await Module.updateMany(
          {
            course: req.params.courseId,
            order: { $gte: newOrder, $lt: oldOrder },
          },
          { $inc: { order: 1 } },
          { session }
        );
      }

      // Update the dragged module's order
      module.order = newOrder;
      await module.save({ session });
    });

    // Fetch updated modules list
    const updatedModules = await Module.find({
      course: req.params.courseId,
    }).sort({ order: 1 });

    res.json(updatedModules);
  } catch (error) {
    res.status(500).json({
      message: "Error reordering module",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// CONTENT FUNCTIONS

// Add new content item with order
const addModuleContent = async (req, res) => {
  const session = await mongoose.startSession();
  const uploadedFiles = [];

  try {
    await session.withTransaction(async () => {
      const module = await Module.findOne({
        _id: req.params.moduleId,
        course: req.params.courseId,
        coordinator: req.user.userId,
      }).session(session);

      if (!module) {
        throw new Error("Module not found");
      }

      // Parse content data from request body
      const contentData = JSON.parse(req.body.content);

      // Add moduleId to contentData
      contentData.moduleId = module._id;

      // Get highest order number for content
      const lastContent =
        module.content.length > 0
          ? Math.max(...module.content.map((item) => item.order))
          : -1;
      contentData.order = lastContent + 1;

      const contentItem = await processContentItem(
        contentData,
        req.files,
        req.user.userId,
        uploadedFiles
      );

      module.content.push(contentItem);
      await module.save({ session });

      res.status(201).json(contentItem);
    });
  } catch (error) {
    console.error("Add content error:", error);
    await cleanupOnFailure(uploadedFiles);
    res.status(500).json({
      message: "Error adding content",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Update content item
const updateModuleContent = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const module = await Module.findOne({
        _id: req.params.moduleId,
        course: req.params.courseId,
        coordinator: req.user.userId,
      }).session(session);

      if (!module) {
        throw new Error("Module not found");
      }

      const contentIndex = module.content.findIndex(
        (item) => item._id.toString() === req.params.contentId
      );

      if (contentIndex === -1) {
        throw new Error("Content item not found");
      }

      const contentItem = module.content[contentIndex];
      const updateData = req.body;

      // Only allow updating title for all types
      if (updateData.title) {
        contentItem.title = updateData.title;
      }

      // Allow URL update only for link type
      if (contentItem.type === "link" && updateData.url) {
        contentItem.url = updateData.url;
      }

      await module.save({ session });

      res.json(contentItem);
    });
  } catch (error) {
    console.error("Update content error:", error);
    res.status(500).json({
      message: "Error updating content",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Reorder content within module
const reorderModuleContent = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { newOrder } = req.body;

      const module = await Module.findOne({
        _id: req.params.moduleId,
        course: req.params.courseId,
        coordinator: req.user.userId,
      }).session(session);

      if (!module) {
        throw new Error("Module not found");
      }

      // Find the content item to move
      const contentIndex = module.content.findIndex(
        (item) => item._id.toString() === req.params.contentId
      );

      if (contentIndex === -1) {
        throw new Error("Content item not found");
      }

      const content = module.content[contentIndex];
      const oldOrder = content.order;

      // Skip if order hasn't changed
      if (oldOrder === newOrder) {
        return res.json(content);
      }

      // Update orders of other content items
      module.content.forEach((item) => {
        if (newOrder > oldOrder) {
          // Moving down: decrease order of items between old and new position
          if (item.order > oldOrder && item.order <= newOrder) {
            item.order--;
          }
        } else {
          // Moving up: increase order of items between new and old position
          if (item.order >= newOrder && item.order < oldOrder) {
            item.order++;
          }
        }
      });

      // Set new order for the moved item
      content.order = newOrder;

      // Sort content array by order
      module.content.sort((a, b) => a.order - b.order);

      await module.save({ session });
      res.json(module);
    });
  } catch (error) {
    console.error("Reorder content error:", error);
    res.status(500).json({
      message: "Error reordering content",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Delete content item
const deleteModuleContent = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const module = await Module.findOne({
        _id: req.params.moduleId,
        course: req.params.courseId,
        coordinator: req.user.userId,
      }).session(session);

      if (!module) {
        throw new Error("Module not found");
      }

      const contentIndex = module.content.findIndex(
        (item) => item._id.toString() === req.params.contentId
      );

      if (contentIndex === -1) {
        throw new Error("Content item not found");
      }

      const deletedContent = module.content[contentIndex];
      const deletedOrder = deletedContent.order;

      // Enhanced cleanup for video content
      if (deletedContent.type === "video" && deletedContent.publicId) {
        try {
          // Delete from Cloudinary
          console.log(`Attempting to delete video: ${deletedContent.publicId}`);
          const deleteResult = await deleteFromCloudinary(
            deletedContent.publicId,
            "video"
          );
          console.log("Video deletion result:", deleteResult);

          // Delete the Media record
          await Media.findOneAndDelete({
            publicId: deletedContent.publicId,
          }).session(session);
        } catch (error) {
          console.error("Error deleting video:", error);
          throw new Error(`Failed to delete video: ${error.message}`);
        }
      }
      // Handle document deletion as before
      else if (deletedContent.type === "document" && deletedContent.publicId) {
        await deleteFromCloudinary(deletedContent.publicId, "raw");
      }

      // Remove content and update orders
      module.content = module.content.filter(
        (item, index) => index !== contentIndex
      );
      module.content.forEach((item) => {
        if (item.order > deletedOrder) {
          item.order--;
        }
      });

      await module.save({ session });
      res.json({
        message: "Content deleted successfully",
        contentId: req.params.contentId,
        moduleId: module._id,
      });
    });
  } catch (error) {
    console.error("Delete content error:", error);
    res.status(500).json({
      message: "Error deleting content",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// HELPER FUNCTIONS

// Add cleanup for partial failures
const cleanupOnFailure = async (uploadedFiles) => {
  for (const file of uploadedFiles) {
    try {
      await deleteFromCloudinary(file.publicId, "raw");
      console.log(`Cleanup: Successfully deleted file: ${file.publicId}`);
    } catch (error) {
      console.error(`Cleanup: Error deleting file: ${file.publicId}`, error);
    }
  }
};

// Add this helper function
const processContentItem = async (
  contentData,
  files,
  userId,
  uploadedFiles
) => {
  const processedItem = { ...contentData };

  if (contentData.type === "video" && contentData.mediaId) {
    const media = await Media.findOne({
      _id: contentData.mediaId,
      uploadedBy: userId,
      status: "completed",
    });

    if (!media) {
      throw new Error("Video media not found or not ready");
    }

    // Associate media with module
    await Media.findByIdAndUpdate(media._id, {
      associatedWith: {
        model: "Module",
        id: contentData.moduleId, // We need to pass moduleId in contentData
      },
    });

    processedItem.url = media.url;
    processedItem.publicId = media.publicId;
    processedItem.thumbnail = media.thumbnail;
    processedItem.size = media.size;
    processedItem.mimeType = media.mimeType;
  } else if (contentData.type === "document") {
    // Log the files to debug
    console.log("Files received:", files);
    console.log("Looking for file with uniqueId:", contentData.uniqueId);

    const file = files?.find((f) => f.fieldname === contentData.uniqueId);
    if (!file) {
      throw new Error("Document file not found");
    }

    try {
      const result = await uploadToCloudinary(
        file.buffer,
        "moduleDocument",
        file.mimetype
      );

      processedItem.url = result.secure_url;
      processedItem.publicId = result.public_id;
      processedItem.size = file.size;
      processedItem.mimeType = file.mimetype;
      processedItem.fileExtension = result.format;
      processedItem.originalName = file.originalname;
      uploadedFiles.push({ publicId: result.public_id });
    } catch (error) {
      console.error("Document upload error:", error);
      throw new Error(`Failed to upload document: ${error.message}`);
    }
  } else if (contentData.type === "link") {
    if (!contentData.url) {
      throw new Error("URL is required for link content");
    }
    processedItem.url = contentData.url;
  }

  return processedItem;
};

/// LOW PRIORITY

// Get all content items for a module
const getModuleContent = async (req, res) => {
  try {
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Return content sorted by order
    const sortedContent = module.content.sort((a, b) => a.order - b.order);
    res.json(sortedContent);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching module content",
      error: error.message,
    });
  }
};

// Get single content item
const getModuleContentItem = async (req, res) => {
  try {
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const contentItem = module.content.find(
      (item) => item._id.toString() === req.params.contentId
    );

    if (!contentItem) {
      return res.status(404).json({ message: "Content item not found" });
    }

    res.json(contentItem);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching content item",
      error: error.message,
    });
  }
};

// Add video duration calculation helper function
const getVideoDuration = async (filePath) => {
  // TODO: Implement video duration calculation
  // For now, return a default value
  return 0;
};

// Add uniqueId generator function
const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Add this function
const getSecureContentUrl = async (req, res) => {
  try {
    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    const contentItem = module.content.find(
      (item) => item._id.toString() === req.params.contentId
    );

    if (!contentItem) {
      return res.status(404).json({ message: "Content not found" });
    }

    // Generate a short-lived token for this specific content
    const streamToken = jwt.sign(
      {
        contentId: contentItem._id,
        moduleId: module._id,
        courseId: req.params.courseId,
        timestamp: Date.now(),
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Instead of direct Cloudinary URL, return our proxy endpoint
    const baseUrl = process.env.API_URL || "http://localhost:3000";
    const proxyUrl = `${baseUrl}/api/stream/${streamToken}`;

    res.json({
      url: proxyUrl,
      thumbnail: contentItem.thumbnail,
      type: contentItem.type,
      duration: contentItem.duration,
      mimeType: contentItem.mimeType,
    });
  } catch (error) {
    console.error("Error generating secure URL:", error);
    res.status(500).json({
      message: "Error generating secure URL",
      error: error.message,
    });
  }
};

// Public access - limited data
const getPublicModules = async (req, res) => {
  try {
    const modules = await Module.find({
      course: req.params.courseId,
      status: "published",
    })
      .sort({ order: 1 })
      .select(
        "title description order status isOptional duration lectureCount content"
      )
      .lean();

    // Transform content to only show preview items and basic info
    const publicModules = modules.map((module) => ({
      ...module,
      content: (module.content || [])
        .map((item) => ({
          _id: item._id,
          title: item.title,
          type: item.type,
          duration: item.duration,
          isPreview: item.isPreview,
          order: item.order,
          // Exclude sensitive data like url, publicId, etc.
        }))
        .sort((a, b) => a.order - b.order),
    }));

    res.json(publicModules);
  } catch (error) {
    console.error("Error in getPublicModules:", error);
    res.status(500).json({
      message: "Error fetching public modules",
      error: error.message,
    });
  }
};

// Enrolled student access - secure URLs
const getEnrolledModules = async (req, res) => {
  try {
    // First verify enrollment through Batch and Enrollment models
    const activeEnrollment = await Enrollment.findOne({
      student: req.user.userId,
      status: "active",
      batch: {
        $in: await Batch.find({
          course: req.params.courseId,
          status: { $in: ["enrolling", "ongoing", "completed"] },
        }).select("_id"),
      },
    }).populate("batch");

    if (!activeEnrollment) {
      return res.status(403).json({
        message:
          "You must be enrolled in an active batch to access this course's modules",
      });
    }

    // Get modules based on batch status and dates
    const modules = await Module.find({
      course: req.params.courseId,
      status: "published",
    })
      .sort({ order: 1 })
      .lean();

    // Transform content to include secure URLs and respect batch-specific settings
    const enrolledModules = modules.map((module) => ({
      ...module,
      content: module.content
        .filter((item) => {
          // Check batch-specific settings
          if (item.batchSpecificSettings?.isEnabled === false) {
            return false;
          }

          // Check if content is available based on batch dates
          if (item.batchSpecificSettings?.visibleFromDate) {
            return (
              new Date(item.batchSpecificSettings.visibleFromDate) <= new Date()
            );
          }

          return true;
        })
        .map((item) => ({
          _id: item._id,
          title: item.title,
          type: item.type,
          duration: item.duration,
          isPreview: item.isPreview,
          order: item.order,
          thumbnail: item.thumbnail,
          completedInBatch: activeEnrollment.completedModules.includes(
            module._id
          ),
          // Instead of direct URL, provide endpoint for secure access
          secureUrlEndpoint: `/api/courses/${req.params.courseId}/modules/${module._id}/content/${item._id}/secure-view`,
        })),
    }));

    // Add progress information
    const response = {
      modules: enrolledModules,
      progress: {
        overall: activeEnrollment.progress,
        completedModules: activeEnrollment.completedModules,
        batchStatus: activeEnrollment.batch.status,
        batchEndDate: activeEnrollment.batch.batchEndDate,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error in getEnrolledModules:", error);
    res.status(500).json({
      message: "Error fetching enrolled modules",
      error: error.message,
    });
  }
};

module.exports = {
  getModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
  reorderModule,
  addModuleContent,
  getModuleContent,
  getModuleContentItem,
  reorderModuleContent,
  deleteModuleContent,
  updateModuleContent,
  getSecureContentUrl,
  getPublicModules,
  getEnrolledModules,
};
