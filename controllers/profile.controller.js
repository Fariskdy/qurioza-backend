const Profile = require("../models/profile.model");
const User = require("../models/user.model");

// Get logged-in user's profile
const getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.userId })
      .populate("user", "username email role")
      .exec();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

// Update logged-in user's profile
const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      "firstName",
      "lastName",
      "phone",
      "address",
      "bio",
      "avatar",
      "socialLinks",
    ];

    const profile = await Profile.findOne({ user: req.user.userId });
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Update only allowed fields
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        profile[field] = req.body[field];
      }
    });

    await profile.save();
    res.json(profile);
  } catch (error) {
    res.status(500).json({
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// Get public profile of any user
const getPublicProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.params.userId })
      .populate("user", "username role")
      .select("-address -phone") // Exclude private fields
      .exec();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getPublicProfile,
};
