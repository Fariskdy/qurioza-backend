const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { connectDB } = require("./config/connectDB");

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Authentication routes
app.use("/api/auth", require("./routes/auth.route.js"));

// Media routes
app.use("/api/media", require("./routes/media.route.js"));

// Category routes
app.use("/api/categories", require("./routes/category.route.js"));

// Coordinator routes
app.use("/api/coordinators", require("./routes/coordinators.route.js"));

// Teacher routes
app.use("/api/teachers", require("./routes/teachers.route.js"));

// Profile routes
app.use("/api/profile", require("./routes/profile.route.js"));

// Course hierarchy
app.use("/api/courses", require("./routes/course.route.js"));
app.use("/api/courses/:courseId/modules", require("./routes/module.route.js"));
app.use("/api/courses/:courseId/batches", require("./routes/batch.route.js"));

// Batch hierarchy
app.use(
  "/api/batches/:batchId/assignments",
  require("./routes/assignment.route.js")
);
app.use("/api/batches/:batchId/quizzes", require("./routes/quiz.route.js"));
app.use(
  "/api/batches/:batchId/submissions",
  require("./routes/submission.route.js")
);

// Enrollment and submission routes
app.use("/api/enrollments", require("./routes/enrollment.route.js"));
app.use("/api/submissions", require("./routes/submission.route.js"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong!", error: err.message });
});

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
  });
