const cron = require("node-cron");
const Media = require("../models/media.model");
const mongoose = require("mongoose");

// Run every 2 minutes
cron.schedule("*/2 * * * *", async () => {
  const now = new Date();
  console.log(`\n[${now.toISOString()}] Running media cleanup scheduler...`);

  try {
    // Find unassociated media that are older than 24 hours
    const oldMedia = await Media.find({
      "associatedWith.id": { $exists: false },
      createdAt: {
        $lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    if (oldMedia.length === 0) {
      console.log("No media files found for cleanup");
      return;
    }

    console.log(`Found ${oldMedia.length} old media files to clean up:`);

    // Delete each media document properly (this will trigger the pre-deleteOne hook)
    for (const media of oldMedia) {
      console.log(`\nCleaning up media:`, {
        id: media._id,
        originalName: media.originalName,
        createdAt: media.createdAt,
        publicId: media.publicId,
      });
      await media.deleteOne();
    }

    console.log("\nMedia cleanup completed successfully");
  } catch (error) {
    console.error("\nError in media cleanup scheduler:", error);
  }
});
