const User = require("../models/user.model");
const Profile = require("../models/profile.model");
const mongoose = require("mongoose");

// get all coordinators

const getCoordinators = async (req, res) => {
  try {
    const coordinators = await User.find({ role: "course coordinator" });
    res.json(coordinators);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving coordinators", error: error.message });
  }
};

// get a coordinator

const getCoordinator = async (req, res) => {
  try {
    const coordinator = await User.findById(req.params.id);
    res.json(coordinator);
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving coordinator Details",
      error: error.message,
    });
  }
};

// create a coordinator

const createCoordinator = async (req, res) => {
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

    // check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password, // Will be hashed by pre-save middleware
      role: "course coordinator",
    });

    // Create user profile
    await Profile.create({
      user: user._id,
      firstName,
      lastName,
      phone,
      address,
    });

    // return success response without password
    res.status(201).json({
      message: "Coordinator created successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error creating coordinator:", error);
    res
      .status(500)
      .json({ message: "Error creating coordinator", error: error.message });
  }
};

// update a coordinator
// only update the user details not profile details

const updateCoordinator = async (req, res) => {
  const { id } = req.params;
  const { username, email, password } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      id,
      { username, email, password },
      { new: true }
    ).select("-password"); // Exclude password from the response
    res.json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating coordinator", error: error.message });
  }
};

// delete a coordinator
// will delete the user and the profile
// use transaction to ensure both are deleted

const deleteCoordinator = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;

    // Delete the user
    const user = await User.findByIdAndDelete(id).session(session);
    if (!user) {
      throw new Error("User not found");
    }

    // Delete the profile
    await Profile.findOneAndDelete({ user: id }).session(session);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "Coordinator deleted successfully" });
  } catch (error) {
    // Rollback the transaction
    await session.abortTransaction();
    session.endSession();

    res
      .status(500)
      .json({ message: "Error deleting coordinator", error: error.message });
  }
};

module.exports = {
  getCoordinators,
  getCoordinator,
  createCoordinator,
  updateCoordinator,
  deleteCoordinator,
};
