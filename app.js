const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { connectDB } = require("./config/connectDB");

// Import schedulers
require("./schedulers/batchStatusUpdater");
require("./schedulers/mediaCleanup");

// Middleware
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  require("./controllers/payment.controller").handleWebhook
);

// Regular middleware for other routes
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : "http://localhost:5173", // Vite's default port
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Authentication routes
app.use("/api/auth", require("./routes/auth.route.js"));

// Media routes
app.use("/api/media", require("./routes/media.route.js"));

// Stream routes
app.use("/api/stream", require("./routes/stream.route.js"));

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

// Student assignment routes (add this before batch hierarchy)
app.use(
  "/api/student/assignments",
  require("./routes/student.assignment.route.js")
);

// Batch hierarchy
app.use(
  "/api/batches/:batchId/assignments",
  require("./routes/assignment.route.js")
);

app.use(
  "/api/batches/:batchId/submissions",
  require("./routes/submission.route.js")
);

// Enrollment and submission routes
app.use("/api/quizzes", require("./routes/quiz.route.js"));
app.use("/api/enrollments", require("./routes/enrollment.route.js"));
app.use("/api/submissions", require("./routes/submission.route.js"));

// Import and use payment routes
const paymentRoutes = require("./routes/payment.route");
app.use("/api/payments", paymentRoutes);

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
