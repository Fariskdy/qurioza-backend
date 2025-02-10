const Course = require("../models/course.model");
const {
  uploadToCloudinary,
  cloudinary,
  deleteFromCloudinary,
} = require("../config/cloudinary");
const sharp = require("sharp");
const Media = require("../models/media.model");
const Category = require("../models/category.model");
const mongoose = require("mongoose");
const Enrollment = require("../models/enrollment.model");

// Get all courses (with filters and pagination)
const getCourses = async (req, res) => {
  try {
    const {
      category,
      level,
      search,
      sort = "popular", // Add default sort
      page = 1,
      limit = 9, // Match UI grid of 9 courses
    } = req.query;

    const query = { status: "published" }; // Only show published courses

    // Apply filters
    if (category && category !== "all") {
      // Find category by slug
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      }
    }
    if (level) query.level = level;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    // Determine sort order
    let sortOptions = {};
    switch (sort) {
      case "newest":
        sortOptions = { createdAt: -1 };
        break;
      case "price-low":
        sortOptions = { price: 1 };
        break;
      case "price-high":
        sortOptions = { price: -1 };
        break;
      case "popular":
      default:
        sortOptions = { "stats.enrolledStudents": -1 };
        break;
    }

    const courses = await Course.find(query)
      .populate({
        path: "category",
        select: "name slug image",
      })
      .populate("coordinator", "username")
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "title description image level price stats slug features duration totalHours"
      );

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

    // Transform the response to include full URLs if needed
    const courseData = course.toObject();

    // If your images are stored with relative paths, prepend the base URL
    if (courseData.image && !courseData.image.startsWith("http")) {
      courseData.image = `${process.env.BASE_URL}/${courseData.image}`;
    }

    if (
      courseData.previewVideo?.thumbnail &&
      !courseData.previewVideo.thumbnail.startsWith("http")
    ) {
      courseData.previewVideo.thumbnail = `${process.env.BASE_URL}/${courseData.previewVideo.thumbnail}`;
    }

    res.json(courseData);
  } catch (error) {
    console.error("Error in getCourse:", error);
    res.status(500).json({
      message: "Error fetching course",
      error: error.message,
    });
  }
};

// Remove or modify the validateImageDimensions function
const validateImageDimensions = async (buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    // Remove dimension check - just verify it's a valid image
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
      tags = [],
      certificates,
      status = "draft",
      videoId,
    } = req.body;

    // Parse JSON strings for arrays
    const parseArrayField = (field) => {
      try {
        return typeof field === "string" ? JSON.parse(field) : field;
      } catch (e) {
        return [];
      }
    };

    // Clean and parse arrays
    const cleanFeatures = parseArrayField(features).filter(
      (item) => typeof item === "string" && item.trim() !== ""
    );

    const cleanOutcomes = parseArrayField(learningOutcomes).filter(
      (item) => typeof item === "string" && item.trim() !== ""
    );

    const cleanRequirements = parseArrayField(requirements).filter(
      (item) => typeof item === "string" && item.trim() !== ""
    );

    // Handle image upload if present
    let imageUrl = null;
    if (req.files?.image) {
      await validateImageDimensions(req.files.image[0].buffer);
      console.log("Uploading image:", {
        mimetype: req.files.image[0].mimetype,
        size: req.files.image[0].size,
      });

      const result = await uploadToCloudinary(
        req.files.image[0].buffer,
        "courseImage",
        req.files.image[0].mimetype
      );
      imageUrl = result.secure_url;
    }

    // Find and validate video if videoId is provided
    const video = videoId
      ? await Media.findOne({
          _id: videoId,
          uploadedBy: req.user.userId,
          status: "completed",
        })
      : null;

    // Create course with cleaned data
    const course = await Course.create({
      title,
      description,
      category,
      coordinator: req.user.userId,
      duration: Number(duration),
      totalHours: Number(totalHours),
      price: Number(price),
      level,
      features: cleanFeatures,
      learningOutcomes: cleanOutcomes,
      requirements: cleanRequirements,
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
    console.error("Course creation error:", error);
    res.status(500).json({
      message: "Error creating course",
      error: error.message,
    });
  }
};

// Update course (basic info only - no media)
const updateCourse = async (req, res) => {
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
    } = req.body;

    const course = await Course.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Parse JSON strings for arrays
    const parseArrayField = (field) => {
      try {
        return typeof field === "string" ? JSON.parse(field) : field;
      } catch (e) {
        return [];
      }
    };

    // Clean and parse arrays
    const cleanFeatures = parseArrayField(features).filter(
      (item) => typeof item === "string" && item.trim() !== ""
    );
    const cleanOutcomes = parseArrayField(learningOutcomes).filter(
      (item) => typeof item === "string" && item.trim() !== ""
    );
    const cleanRequirements = parseArrayField(requirements).filter(
      (item) => typeof item === "string" && item.trim() !== ""
    );

    // Update only non-media fields
    course.title = title;
    course.description = description;
    course.category = category;
    course.duration = Number(duration);
    course.totalHours = Number(totalHours);
    course.price = Number(price);
    course.level = level;
    course.features = cleanFeatures;
    course.learningOutcomes = cleanOutcomes;
    course.requirements = cleanRequirements;
    course.language = language;
    course.tags = tags;

    await course.save();

    // Populate category before sending response
    await course.populate("category", "name slug");

    res.json(course);
  } catch (error) {
    console.error("Course update error:", error);
    res.status(500).json({
      message: "Error updating course",
      error: error.message,
    });
  }
};

// Update course image
const updateCourseImage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.files?.image) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const course = await Course.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
    }).session(session);

    if (!course) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Course not found" });
    }

    // Validate image
    await validateImageDimensions(req.files.image[0].buffer);

    // Store old image public ID for cleanup
    let oldImagePublicId = null;
    if (course.image) {
      // Extract public ID from Cloudinary URL
      // URL format: https://res.cloudinary.com/[cloud_name]/image/upload/v[version]/[folder]/[public_id].[extension]
      const urlParts = course.image.split("/");
      const fileNameWithExtension = urlParts[urlParts.length - 1]; // Get "file_pgxgga.jpg"
      const fileName = fileNameWithExtension.split(".")[0]; // Get "file_pgxgga"
      oldImagePublicId = `courses/images/${fileName}`; // Add folder path
    }

    // Upload new image
    const result = await uploadToCloudinary(
      req.files.image[0].buffer,
      "courseImage",
      req.files.image[0].mimetype
    );

    // Update course with new image
    course.image = result.secure_url;
    await course.save({ session });

    // If everything is successful, delete the old image
    if (oldImagePublicId) {
      try {
        await deleteFromCloudinary(oldImagePublicId, "image");
      } catch (error) {
        console.error("Error deleting old image:", error);
        // Don't fail the transaction if cleanup fails
      }
    }

    await session.commitTransaction();
    res.status(200).json({
      image: course.image,
      message: "Course image updated successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      message: "Error updating course image",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Update course preview video
const updateCourseVideo = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { videoId } = req.body;

    if (!videoId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Video ID is required" });
    }

    // Find course and video in parallel with session
    const [course, video] = await Promise.all([
      Course.findOne({
        _id: req.params.id,
        coordinator: req.user.userId,
      }).session(session),
      Media.findOne({
        _id: videoId,
        uploadedBy: req.user.userId,
        status: "completed",
      }).session(session),
    ]);

    if (!course) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Course not found" });
    }

    if (!video) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Video not found or not ready" });
    }

    // Update video association first
    video.associatedWith = {
      model: "Course",
      id: course._id,
    };

    // Save video first to trigger the pre-save hook
    await video.save({ session });

    // If the pre-save hook found old associations, clean them up
    if (video._oldAssociationsQuery) {
      await Media.updateMany(
        video._oldAssociationsQuery,
        { $set: { associatedWith: null } },
        { session }
      );
    }

    // Update course preview video
    course.previewVideo = {
      url: video.url,
      thumbnail: video.thumbnail,
    };

    // Save course
    await course.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      previewVideo: course.previewVideo,
      message: "Course preview video updated successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Video update error:", error);
    res.status(500).json({
      message: "Error updating course video",
      error: error.message,
    });
  }
};

// Delete course with file cleanup
const deleteCourse = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const course = await Course.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Find and delete all associated media
    const mediaToDelete = await Media.find({
      "associatedWith.model": "Course",
      "associatedWith.id": course._id,
    }).session(session);

    // Delete each media document (which will trigger the pre-deleteOne hook)
    for (const media of mediaToDelete) {
      await media.deleteOne({ session });
    }

    // Delete the course image from cloudinary if exists
    if (course.image) {
      try {
        // Extract public ID from Cloudinary URL
        // URL format: https://res.cloudinary.com/[cloud_name]/image/upload/v[version]/[folder]/[public_id].[extension]
        const urlParts = course.image.split("/");
        const fileNameWithExtension = urlParts[urlParts.length - 1]; // Get "file_pgxgga.jpg"
        const fileName = fileNameWithExtension.split(".")[0]; // Get "file_pgxgga"
        const imagePublicId = `courses/images/${fileName}`; // Add folder path

        await deleteFromCloudinary(imagePublicId, "image");
      } catch (error) {
        console.error("Error deleting course image from Cloudinary:", error);
        // Don't throw error - continue with course deletion even if image cleanup fails
      }
    }

    // Delete the course
    await course.deleteOne({ session });

    await session.commitTransaction();
    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      message: "Error deleting course",
      error: error.message,
    });
  } finally {
    session.endSession();
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

// Add this controller function
const getRelatedCourses = async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Find courses in the same category, excluding the current course
    const relatedCourses = await Course.find({
      category: course.category,
      _id: { $ne: course._id },
      status: "published",
    })
      .populate("category", "name slug")
      .populate("coordinator", "username")
      .limit(3)
      .select(
        "title description image level price stats slug features duration totalHours"
      );

    res.json(relatedCourses);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching related courses",
      error: error.message,
    });
  }
};

// Add these controller functions
const getFeaturedCourses = async (req, res) => {
  try {
    // Find courses that are both published and marked as featured
    const courses = await Course.find({
      status: "published",
      featured: true,
      // You might want to add additional criteria like:
      // 'stats.rating': { $gte: 4.5 }, // High rated courses
      // 'stats.enrolledStudents': { $gte: 1000 }, // Popular courses
    })
      .populate("category", "name slug")
      .populate("coordinator", "username")
      .limit(3)
      .sort({ "stats.enrolledStudents": -1 }) // Sort by most enrolled
      .select(
        "title description image level price stats slug features duration"
      );

    res.json(courses);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching featured courses",
      error: error.message,
    });
  }
};

const getStats = async (req, res) => {
  try {
    const stats = await Course.aggregate([
      {
        $group: {
          _id: null,
          totalStudents: { $sum: "$stats.enrolledStudents" },
          averageRating: { $avg: "$stats.rating" },
          totalCourses: { $sum: 1 },
        },
      },
    ]);

    res.json({
      totalStudents: stats[0]?.totalStudents || 0,
      averageRating: Number(stats[0]?.averageRating?.toFixed(1)) || 0,
      totalCourses: stats[0]?.totalCourses || 0,
      successRate: 95, // This could be calculated based on completion data
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching stats",
      error: error.message,
    });
  }
};

// Get enrolled courses for student
const getStudentCourses = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    // Find all enrollments for the student
    const enrollmentQuery = {
      student: req.user.userId,
    };

    // Add status filter if provided
    if (status) {
      enrollmentQuery.status = status;
    }

    // Get enrollments with populated batch and course data
    const enrollments = await Enrollment.find(enrollmentQuery)
      .populate({
        path: "batch",
        populate: {
          path: "course",
          select:
            "title description image level price stats slug features duration totalHours",
          populate: {
            path: "category",
            select: "name slug",
          },
        },
      })
      .sort({ enrollmentDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Get total count for pagination
    const total = await Enrollment.countDocuments(enrollmentQuery);

    // Transform the data to return course info with enrollment/batch details
    const courses = enrollments.map((enrollment) => ({
      course: enrollment.batch.course,
      enrollmentStatus: enrollment.status,
      progress: enrollment.progress,
      batch: {
        name: enrollment.batch.name,
        status: enrollment.batch.status,
        startDate: enrollment.batch.batchStartDate,
        endDate: enrollment.batch.batchEndDate,
      },
      enrollmentDate: enrollment.enrollmentDate,
    }));

    res.json({
      courses,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getStudentCourses:", error);
    res.status(500).json({
      message: "Error fetching enrolled courses",
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
  getRelatedCourses,
  getFeaturedCourses,
  getStats,
  updateCourseImage,
  updateCourseVideo,
  getStudentCourses,
};
