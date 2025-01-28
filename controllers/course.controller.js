const Course = require("../models/course.model");
const {
  uploadToCloudinary,
  cloudinary,
  deleteFromCloudinary,
} = require("../config/cloudinary");
const sharp = require("sharp");
const Media = require("../models/media.model");

// Get all courses (with filters and pagination)
const getCourses = async (req, res) => {
  try {
    const { category, level, search, page = 1, limit = 10 } = req.query;
    const query = {};

    // Apply filters
    if (category) query.category = category;
    if (level) query.level = level;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const courses = await Course.find(query)
      .populate("category", "name slug")
      .populate("coordinator", "username")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Course.countDocuments(query);

    res.json({
      courses,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching courses",
      error: error.message,
    });
  }
};

// Get single course by slug
const getCourse = async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug })
      .populate("category", "name slug")
      .populate("coordinator", "username");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json(course);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching course",
      error: error.message,
    });
  }
};

// Add this helper function
const validateImageDimensions = async (buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width > 2000 || metadata.height > 2000) {
      throw new Error("Image dimensions must be 2000x2000 pixels or smaller");
    }
    return true;
  } catch (error) {
    throw new Error("Invalid image file: " + error.message);
  }
};

// Create new course
const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      duration,
      totalHours,
      price,
      level,
      features,
      learningOutcomes,
      requirements,
      language,
      tags,
      certificates,
      status = "draft",
      imageId,
      videoId,
    } = req.body;

    let imageUrl = null;
    if (req.files?.image) {
      // Direct image upload
      await validateImageDimensions(req.files.image[0].buffer);
      const result = await uploadToCloudinary(
        req.files.image[0].buffer,
        "courseImage",
        req.files.image[0].mimetype
      );
      imageUrl = result.secure_url;
    }

    // Find and validate video
    const video = videoId
      ? await Media.findOne({
          _id: videoId,
          uploadedBy: req.user.userId,
          status: "completed",
        })
      : null;

    const course = await Course.create({
      title,
      description,
      category,
      coordinator: req.user.userId,
      duration,
      totalHours,
      price,
      level,
      features,
      learningOutcomes,
      requirements,
      language,
      image: imageUrl,
      previewVideo: video
        ? {
            url: video.url,
            thumbnail: video.thumbnail,
          }
        : null,
      tags,
      certificates,
      status,
    });

    // Associate video with course if exists
    if (video) {
      await Media.findByIdAndUpdate(videoId, {
        associatedWith: { model: "Course", id: course._id },
      });
    }

    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({
      message: "Error creating course",
      error: error.message,
    });
  }
};

// Update course with file handling
const updateCourse = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Handle image update
    if (req.files?.image) {
      try {
        // Validate image dimensions
        await validateImageDimensions(req.files.image[0].buffer);

        // Delete old image if exists
        if (course.image) {
          const publicId = course.image.split("/").pop().split(".")[0];
          await deleteFromCloudinary(publicId, "image");
        }

        const result = await uploadToCloudinary(
          req.files.image[0].buffer,
          "courseImage",
          req.files.image[0].mimetype
        );
        course.image = result.url;
      } catch (error) {
        console.error("Image upload error:", error);
        return res.status(400).json({
          message: "Error uploading image",
          error: error.message,
        });
      }
    }

    // Handle video update
    if (req.files?.previewVideo) {
      try {
        // Delete old video if exists
        if (course.previewVideo?.url) {
          const publicId = course.previewVideo.url
            .split("/")
            .pop()
            .split(".")[0];
          await deleteFromCloudinary(publicId, "video");
        }

        const result = await uploadToCloudinary(
          req.files.previewVideo[0].buffer,
          "courseVideo",
          req.files.previewVideo[0].mimetype
        );
        course.previewVideo = {
          url: result.url,
          thumbnail: result.thumbnail,
        };
      } catch (error) {
        console.error("Video upload error:", error);
        return res.status(400).json({
          message: "Error uploading video",
          error: error.message,
        });
      }
    }

    // Update other fields
    const allowedUpdates = [
      "title",
      "description",
      "category",
      "duration",
      "totalHours",
      "price",
      "level",
      "features",
      "learningOutcomes",
      "requirements",
      "language",
      "status",
      "tags",
      "certificates",
    ];

    allowedUpdates.forEach((update) => {
      if (req.body[update] !== undefined) {
        course[update] = req.body[update];
      }
    });

    course.updatedAt = Date.now();
    await course.save();

    res.json(course);
  } catch (error) {
    console.error("Course update error:", error);
    res.status(500).json({
      message: "Error updating course",
      error: error.message,
    });
  }
};

// Delete course with file cleanup
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Delete associated files from Cloudinary
    if (course.image) {
      try {
        // Extract public ID from the full URL
        const imagePublicId = course.image
          .split("/")
          .slice(-2)
          .join("/")
          .split(".")[0];
        await cloudinary.uploader.destroy(`courses/${imagePublicId}`);
      } catch (error) {
        console.error("Error deleting course image:", error);
      }
    }

    if (course.previewVideo?.url) {
      try {
        // Extract public ID from the full URL
        const videoPublicId = course.previewVideo.url
          .split("/")
          .slice(-2)
          .join("/")
          .split(".")[0];
        await cloudinary.uploader.destroy(`courses/${videoPublicId}`, {
          resource_type: "video",
          invalidate: true,
        });

        // Delete associated media record
        await Media.deleteOne({
          "associatedWith.model": "Course",
          "associatedWith.id": course._id,
          url: course.previewVideo.url,
        });
      } catch (error) {
        console.error("Error deleting course video:", error);
      }
    }

    await course.deleteOne();
    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting course",
      error: error.message,
    });
  }
};

// Get coordinator's courses
const getMyCourses = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { coordinator: req.user.userId };


    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const courses = await Course.find(query)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Course.countDocuments(query);

    res.json({
      courses,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching your courses",
      error: error.message,
    });
  }
};

// Publish a course
const publishCourse = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Validate required fields before publishing
    const requiredFields = [
      "title",
      "description",
      "category",
      "duration",
      "totalHours",
      "price",
      "level",
      "learningOutcomes",
      "requirements",
    ];

    const missingFields = requiredFields.filter((field) => !course[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: "Cannot publish course. Missing required fields",
        missingFields,
      });
    }

    course.status = "published";
    course.updatedAt = Date.now();
    await course.save();

    res.json({
      message: "Course published successfully",
      course,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error publishing course",
      error: error.message,
    });
  }
};

module.exports = {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  getMyCourses,
  publishCourse,
};
