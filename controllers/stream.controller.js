const jwt = require("jsonwebtoken");
const { cloudinary } = require("../config/cloudinary");
const Module = require("../models/module.model");
const axios = require("axios");

exports.streamContent = async (req, res) => {
  try {
    // Verify the stream token
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);

    // Check if token is expired
    if (Date.now() - decoded.timestamp > 3600000) {
      // 1 hour
      return res.status(401).json({ message: "Stream token expired" });
    }

    // Find the content
    const module = await Module.findOne({
      _id: decoded.moduleId,
      course: decoded.courseId,
    });

    if (!module) {
      return res.status(404).json({ message: "Content not found" });
    }

    const contentItem = module.content.find(
      (item) => item._id.toString() === decoded.contentId
    );

    if (!contentItem) {
      return res.status(404).json({ message: "Content not found" });
    }

    // Get Cloudinary streaming URL
    const cloudinaryUrl = cloudinary.url(contentItem.publicId, {
      resource_type: "video",
      secure: true,
      sign_url: true,
      type: "upload",
    });

    // Set security headers
    res.setHeader("Content-Security-Policy", "default-src 'self'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    res.setHeader("Pragma", "no-cache");

    // Stream the content through our server
    const response = await axios({
      method: "get",
      url: cloudinaryUrl,
      responseType: "stream",
      headers: {
        Range: req.headers.range || "bytes=0-",
      },
    });

    // Set content type and length headers
    res.setHeader("Content-Type", response.headers["content-type"]);
    res.setHeader("Content-Length", response.headers["content-length"]);
    res.setHeader("Accept-Ranges", "bytes");

    if (response.headers["content-range"]) {
      res.setHeader("Content-Range", response.headers["content-range"]);
    }

    // Pipe the stream through our server
    response.data.pipe(res);
  } catch (error) {
    console.error("Streaming error:", error);
    res.status(500).json({ message: "Error streaming content" });
  }
};
