const mongoose = require("mongoose");
const User = require("../models/user.model");
const Profile = require("../models/profile.model");
require("dotenv").config();

const users = [
  {
    username: "admin1",
    email: "admin@example.com",
    password: "admin123",
    role: "admin",
    profile: {
      firstName: "Admin",
      lastName: "User",
      phone: "1234567890",
      address: "Admin Address",
    },
  },
  {
    username: "coordinator1",
    email: "coordinator@example.com",
    password: "coordinator123",
    role: "course coordinator",
    profile: {
      firstName: "Course",
      lastName: "Coordinator",
      phone: "1234567891",
      address: "Coordinator Address",
    },
  },
  {
    username: "teacher1",
    email: "teacher@example.com",
    password: "teacher123",
    role: "teacher",
    profile: {
      firstName: "Teacher",
      lastName: "User",
      phone: "1234567892",
      address: "Teacher Address",
    },
  },
  {
    username: "student1",
    email: "student@example.com",
    password: "student123",
    role: "student",
    profile: {
      firstName: "Student",
      lastName: "User",
      phone: "1234567893",
      address: "Student Address",
    },
  },
];

const createUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing users and profiles
    await User.deleteMany({});
    await Profile.deleteMany({});
    console.log("Cleared existing users and profiles");

    // Create users and their profiles
    for (const userData of users) {
      const { profile: profileData, ...userInfo } = userData;

      // Create user
      const user = await User.create(userInfo);
      console.log(`Created ${user.role}: ${user.email}`);

      // Create profile
      await Profile.create({
        user: user._id,
        ...profileData,
      });
      console.log(`Created profile for ${user.email}`);
    }

    console.log("\nAll users created successfully!");
    console.log("\nLogin Credentials:");
    users.forEach((user) => {
      console.log(`\n${user.role}:`);
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${user.password}`);
    });
  } catch (error) {
    console.error("Error creating users:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
};

// Run the script
createUsers();
