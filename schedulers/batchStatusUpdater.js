const cron = require("node-cron");
const Batch = require("../models/batch.model");

// Run every hour
cron.schedule("0 * * * *", async () => {
  try {
    await Batch.updateBatchStatuses();
    console.log("Batch statuses updated successfully");
  } catch (error) {
    console.error("Error updating batch statuses:", error);
  }
});
