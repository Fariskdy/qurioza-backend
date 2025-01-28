const Module = require("../models/module.model");
const Course = require("../models/course.model");
const Media = require("../models/media.model");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../config/cloudinary");
const mongoose = require("mongoose");

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
      learningObjectives: req.body.learningObjectives,
      requirements: req.body.requirements,
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
      learningObjectives: JSON.parse(req.body.learningObjectives),
      requirements: JSON.parse(req.body.requirements),
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

      // Enhanced cleanup for each content item
      const cleanupPromises = module.content.map(async (item) => {
        if (!item.publicId) return;

        try {
          if (item.type === "video") {
            // Get the media document first
            const mediaDoc = await Media.findOne({
              publicId: item.publicId,
            }).session(session);

            if (mediaDoc) {
              // Delete from Cloudinary first
              try {
                console.log(`Attempting to delete video: ${item.publicId}`);
                const deleteResult = await cloudinary.uploader.destroy(
                  item.publicId,
                  {
                    resource_type: "video",
                    invalidate: true,
                  }
                );
                console.log("Video deletion result:", deleteResult);
              } catch (cloudinaryError) {
                console.error(
                  "Cloudinary video deletion error:",
                  cloudinaryError
                );
                throw cloudinaryError;
              }

              // Then delete the Media document
              await Media.findOneAndDelete({
                publicId: item.publicId,
              }).session(session);
            }
          } else if (item.type === "document") {
            // Delete document from Cloudinary
            await deleteFromCloudinary(item.publicId, "raw");
          }

          // Clean up any associated resources
          if (item.resources && item.resources.length > 0) {
            const resourceCleanup = item.resources.map((resource) =>
              resource.publicId
                ? deleteFromCloudinary(resource.publicId, "raw")
                : Promise.resolve()
            );
            await Promise.all(resourceCleanup);
          }
        } catch (error) {
          console.error(`Cleanup error for content ${item._id}:`, error);
          throw error; // Propagate error to trigger transaction rollback
        }
      });

      await Promise.all(cleanupPromises);

      // Delete the module
      await Module.deleteOne({ _id: module._id }).session(session);

      // Reorder remaining modules
      await Module.updateMany(
        { course: req.params.courseId, order: { $gt: module.order } },
        { $inc: { order: -1 } }
      ).session(session);
    });

    res.json({
      message: "Module and all associated content deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
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
    session.startTransaction();

    const { newOrder } = req.body;

    // Validate newOrder
    if (typeof newOrder !== "number" || newOrder < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Invalid order value",
        code: "INVALID_ORDER",
      });
    }

    const module = await Module.findOne({
      _id: req.params.moduleId,
      course: req.params.courseId,
      coordinator: req.user.userId,
    }).session(session);

    if (!module) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Module not found" });
    }

    const oldOrder = module.order;

    // Check if order is actually changing
    if (oldOrder === newOrder) {
      await session.abortTransaction();
      return res.json(module);
    }

    // Get max order to validate newOrder
    const maxOrder = await Module.countDocuments({
      course: req.params.courseId,
    }).session(session);

    if (newOrder >= maxOrder) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Order exceeds module count",
        code: "INVALID_ORDER",
      });
    }

    if (newOrder > oldOrder) {
      await Module.updateMany(
        {
          course: req.params.courseId,
          order: { $gt: oldOrder, $lte: newOrder },
        },
        { $inc: { order: -1 } },
        { session }
      );
    } else {
      await Module.updateMany(
        {
          course: req.params.courseId,
          order: { $gte: newOrder, $lt: oldOrder },
        },
        { $inc: { order: 1 } },
        { session }
      );
    }

    module.order = newOrder;
    await module.save({ session });

    await session.commitTransaction();
    res.json(module);
  } catch (error) {
    await session.abortTransaction();
    console.error("Reorder error:", error);
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

      // Get highest order number for content
      const lastContent =
        module.content.length > 0
          ? Math.max(...module.content.map((item) => item.order))
          : -1;

      const contentData = JSON.parse(req.body.content);
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

      const contentIndex = module.content.findIndex(
        (item) => item._id.toString() === req.params.contentId
      );

      if (contentIndex === -1) {
        throw new Error("Content item not found");
      }

      // Clean up old files if necessary
      const oldContent = module.content[contentIndex];
      if (oldContent.publicId) {
        if (oldContent.type === "video") {
          await Media.findOneAndUpdate(
            { publicId: oldContent.publicId },
            { $unset: { associatedWith: "" } }
          );
        } else if (oldContent.type === "document") {
          try {
            const publicId = oldContent.publicId;
            console.log("Attempting to delete document:", publicId);
            const deleteResult = await deleteFromCloudinary(publicId, "raw");
            console.log("Document deletion result:", deleteResult);
          } catch (error) {
            console.error("Document deletion error:", error);
            throw new Error(`Failed to delete old document: ${error.message}`);
          }
        }
      }

      const contentData = JSON.parse(req.body.content);
      contentData.order = oldContent.order; // Maintain same order

      const processedContent = await processContentItem(
        contentData,
        req.files,
        req.user.userId,
        uploadedFiles
      );

      // Preserve the _id and update other fields
      const updatedContent = {
        ...processedContent,
        _id: oldContent._id, // Preserve the original _id
      };

      // Update the content item while preserving _id
      module.content.set(contentIndex, updatedContent);
      await module.save({ session });

      res.json(updatedContent);
    });
  } catch (error) {
    await cleanupOnFailure(uploadedFiles);
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
      // Parse newOrder as a number
      const newOrder = parseInt(req.body.newOrder);

      // Validate newOrder is a number and non-negative
      if (isNaN(newOrder) || newOrder < 0) {
        return res.status(400).json({
          message: "Invalid order value - must be a non-negative number",
          code: "INVALID_ORDER",
        });
      }

      const module = await Module.findOne({
        _id: req.params.moduleId,
        course: req.params.courseId,
        coordinator: req.user.userId,
      }).session(session);

      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }

      // Add debug log
      console.log("Current content:", module.content);

      const contentIndex = module.content.findIndex(
        (item) => item._id.toString() === req.params.contentId
      );

      if (contentIndex === -1) {
        return res.status(404).json({ message: "Content item not found" });
      }

      const oldOrder = module.content[contentIndex].order;
      const totalContent = module.content.length;

      // Validate new order is within bounds
      if (newOrder >= totalContent) {
        return res.status(400).json({
          message: `Order must be between 0 and ${totalContent - 1}`,
          code: "INVALID_ORDER",
        });
      }

      // Check if order is actually changing
      if (oldOrder === newOrder) {
        return res.json(module.content[contentIndex]);
      }

      // Update orders
      module.content.forEach((item) => {
        if (newOrder > oldOrder) {
          // Moving item to a later position
          if (item.order > oldOrder && item.order <= newOrder) {
            item.order--;
          }
        } else {
          // Moving item to an earlier position
          if (item.order >= newOrder && item.order < oldOrder) {
            item.order++;
          }
        }
      });

      // Set new order for the target item
      module.content[contentIndex].order = newOrder;

      // Save changes
      await module.save({ session });

      // Return reordered content
      res.json(module.content[contentIndex]);
    });
  } catch (error) {
    console.error("Reorder error:", error);
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

      // Cleanup content files
      if (deletedContent.publicId) {
        if (deletedContent.type === "video") {
          await Media.findOneAndUpdate(
            { publicId: deletedContent.publicId },
            { $unset: { associatedWith: "" } }
          );
        } else {
          await deleteFromCloudinary(deletedContent.publicId, "raw");
        }
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
      res.json({ message: "Content deleted successfully" });
    });
  } catch (error) {
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

    processedItem.url = media.url;
    processedItem.publicId = media.publicId;
    processedItem.thumbnail = media.thumbnail;
    processedItem.size = media.size;
    processedItem.mimeType = media.mimeType;
  } else if (contentData.type === "document") {
    const file = files.find((f) => f.fieldname === contentData.uniqueId);
    if (!file) {
      throw new Error("Document file not found");
    }

    const result = await uploadToCloudinary(
      file.buffer,
      "moduleDocument",
      file.mimetype
    );

    processedItem.url = result.secure_url;
    processedItem.publicId = result.public_id;
    processedItem.size = file.size;
    processedItem.mimeType = file.mimetype;
    processedItem.fileExtension = result.fileType.extension;
    processedItem.originalName = file.originalname;
    uploadedFiles.push({ publicId: result.public_id });
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
};
