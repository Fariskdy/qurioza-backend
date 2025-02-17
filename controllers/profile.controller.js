const Profile = require("../models/profile.model");
const User = require("../models/user.model");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../config/cloudinary");

// Get logged-in user's profile
const getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.userId })
      .populate("user", "username email role createdAt")
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
      "avatar",
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

    // Populate user data before sending response
    await profile.populate("user", "username email role");
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
      .populate("user", "username role createdAt")
      .select("firstName lastName avatar joinDate")
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

// Update user's avatar
const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const profile = await Profile.findOne({ user: req.user.userId });
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Delete old avatar if exists
    if (profile.avatar) {
      try {
        // Extract public ID from Cloudinary URL
        // URL format: https://res.cloudinary.com/[cloud_name]/image/upload/v[version]/[folder]/[public_id].[extension]
        const urlParts = profile.avatar.split("/");
        const fileNameWithExtension = urlParts[urlParts.length - 1]; // Get "file_pgxgga.jpg"
        const fileName = fileNameWithExtension.split(".")[0]; // Get "file_pgxgga"
        const imagePublicId = `users/avatars/${fileName}`; // Add folder path

        await deleteFromCloudinary(imagePublicId, "image");
      } catch (error) {
        console.error("Error deleting old avatar:", error);
        // Continue with upload even if delete fails
      }
    }

    // Upload new avatar
    const result = await uploadToCloudinary(
      req.file.buffer,
      "avatar",
      req.file.mimetype
    );

    // Update profile with new avatar URL
    profile.avatar = result.secure_url;
    await profile.save();

    // Populate user data before sending response
    await profile.populate("user", "username email role");
    res.json(profile);
  } catch (error) {
    res.status(500).json({
      message: "Error updating avatar",
      error: error.message,
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password
    user.password = newPassword;
    await user.save(); // This will trigger the pre-save hook to hash the password

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error changing password",
      error: error.message,
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getPublicProfile,
  updateAvatar,
  changePassword,
};
