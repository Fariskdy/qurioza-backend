const express = require("express");
const { authenticateToken } = require("../middleware/auth.middleware");
const { createUploadMiddleware } = require("../middleware/upload.middleware");
const {
  initializeUpload,
  processUpload,
  associateMedia,
  getUnassociatedMedia,
} = require("../controllers/media.controller");

const router = express.Router();

// Configure upload middleware for videos only
const videoUpload = createUploadMiddleware(["video"]);

// All routes require authentication
router.use(authenticateToken);

// Video upload flow - add uploadType as a required query parameter
router.post("/initialize", initializeUpload);
router.post(
  "/:mediaId/upload",
  // Validate uploadType middleware
  (req, res, next) => {
    const { uploadType } = req.query;
    if (!uploadType || !["courseVideo", "moduleVideo"].includes(uploadType)) {
      return res.status(400).json({
        message:
          "Invalid or missing uploadType. Must be 'courseVideo' or 'moduleVideo'",
      });
    }
    next();
  },
  videoUpload.single("file"),
  processUpload
);

// Media management
router.get("/unassociated", getUnassociatedMedia);
router.put("/:mediaId/associate", associateMedia);

module.exports = router;
