const User = require("../models/user.model");
const Profile = require("../models/profile.model");
const mongoose = require("mongoose");

// Get all teachers for the logged-in coordinator
const getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({
      role: "teacher",
      coordinator: req.user.userId,
    }).select("-password");
    res.json(teachers);
  } catch (error) {
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
    }).select("-password");

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json(teacher);
  } catch (error) {
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
