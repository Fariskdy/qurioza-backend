const User = require("../models/user.model");
const Profile = require("../models/profile.model");
const mongoose = require("mongoose");

// Get all teachers for the logged-in coordinator
const getTeachers = async (req, res) => {
  try {
    // Get teachers from User model
    const teachers = await User.find({
      role: "teacher",
      coordinator: req.user.userId,
    })
      .select("-password")
      .lean();

    // Get profiles for all teachers
    const teacherProfiles = await Profile.find({
      user: { $in: teachers.map((t) => t._id) },
    }).lean();

    // Merge teacher and profile data, ensuring we keep the user _id
    const teachersWithProfiles = teachers.map((teacher) => {
      const profile = teacherProfiles.find(
        (p) => p.user.toString() === teacher._id.toString()
      );

      // Create merged object with explicit _id from User model
      const mergedTeacher = {
        _id: teacher._id,
        username: teacher.username,
        email: teacher.email,
        role: teacher.role,
        coordinator: teacher.coordinator,
        // Add profile fields if they exist
        firstName: profile?.firstName || "",
        lastName: profile?.lastName || "",
        phone: profile?.phone || "",
        address: profile?.address || "",
        // Explicitly exclude profile fields we don't want
        user: undefined,
        __v: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      };

      return mergedTeacher;
    });

    res.json(teachersWithProfiles);
  } catch (error) {
    console.error("Error in getTeachers:", error);
    res.status(500).json({
      message: "Error retrieving teachers",
      error: error.message,
    });
  }
};

// Get a specific teacher
const getTeacher = async (req, res) => {
  try {
    const teacher = await User.findOne({
      _id: req.params.id,
      role: "teacher",
      coordinator: req.user.userId,
    })
      .select("-password")
      .lean();

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Get teacher's profile
    const profile = await Profile.findOne({ user: teacher._id }).lean();

    // Merge teacher and profile data with explicit field selection
    const teacherWithProfile = {
      _id: teacher._id,
      username: teacher.username,
      email: teacher.email,
      role: teacher.role,
      coordinator: teacher.coordinator,
      // Add profile fields if they exist
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      phone: profile?.phone || "",
      address: profile?.address || "",
    };

    res.json(teacherWithProfile);
  } catch (error) {
    console.error("Error in getTeacher:", error);
    res.status(500).json({
      message: "Error retrieving teacher details",
      error: error.message,
    });
  }
};

// Create a new teacher
const createTeacher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phone = "",
      address = "",
    } = req.body;

    // Debug log to check coordinator ID
    console.log("Coordinator ID from token:", req.user.userId);
    console.log("Full user object from token:", req.user);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Ensure coordinator exists
    const coordinatorExists = await User.findOne({
      _id: req.user.userId,
      role: "course coordinator",
    });

    if (!coordinatorExists) {
      return res.status(400).json({
        message: "Invalid coordinator reference",
      });
    }

    // Create new user with explicit coordinator ID
    const user = await User.create(
      [
        {
          username,
          email,
          password,
          role: "teacher",
          coordinator: new mongoose.Types.ObjectId(req.user.userId),
        },
      ],
      { session }
    );

    // Create user profile
    await Profile.create(
      [
        {
          user: user[0]._id,
          firstName,
          lastName,
          phone,
          address,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Include coordinator info in response
    res.status(201).json({
      message: "Teacher created successfully",
      user: {
        id: user[0]._id,
        username: user[0].username,
        email: user[0].email,
        role: user[0].role,
        coordinator: user[0].coordinator,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Teacher creation error:", error);
    res.status(500).json({
      message: "Error creating teacher",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// Update a teacher
const updateTeacher = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Verify the teacher belongs to this coordinator
    const teacher = await User.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
      role: "teacher",
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const updatedTeacher = await User.findByIdAndUpdate(
      req.params.id,
      { username, email, password },
      { new: true }
    ).select("-password");

    res.json(updatedTeacher);
  } catch (error) {
    res.status(500).json({
      message: "Error updating teacher",
      error: error.message,
    });
  }
};

// Delete a teacher
const deleteTeacher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify the teacher belongs to this coordinator
    const teacher = await User.findOne({
      _id: req.params.id,
      coordinator: req.user.userId,
      role: "teacher",
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Delete the user
    await User.findByIdAndDelete(req.params.id).session(session);

    // Delete the profile
    await Profile.findOneAndDelete({ user: req.params.id }).session(session);

    await session.commitTransaction();
    res.json({ message: "Teacher deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      message: "Error deleting teacher",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
};
