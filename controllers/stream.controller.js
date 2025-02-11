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

    // Handle range requests
    const range = req.headers.range;
    if (!range) {
      // If no range, fetch video info first
      const headResponse = await axios.head(cloudinaryUrl);
      const contentLength = headResponse.headers["content-length"];

      res.writeHead(200, {
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
      });

      // Stream the full video
      const videoStream = await axios({
        method: "get",
        url: cloudinaryUrl,
        responseType: "stream",
      });

      return videoStream.data.pipe(res);
    }

    // Parse range header
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const headResponse = await axios.head(cloudinaryUrl);
    const contentLength = parseInt(headResponse.headers["content-length"], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
    const chunksize = end - start + 1;

    // Set response headers for partial content
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${contentLength}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
    });

    // Stream the requested chunk
    const videoStream = await axios({
      method: "get",
      url: cloudinaryUrl,
      headers: {
        Range: `bytes=${start}-${end}`,
      },
      responseType: "stream",
    });

    // Pipe the video stream to response
    videoStream.data.pipe(res);
  } catch (error) {
    console.error("Streaming error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error streaming content" });
    }
  }
};
