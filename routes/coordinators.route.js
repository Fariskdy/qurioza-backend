const express = require("express");
const router = express.Router();
const { authenticateToken, checkRole } = require("../middleware/auth.middleware");
const { getCoordinators, getCoordinator, createCoordinator, updateCoordinator, deleteCoordinator} = require("../controllers/coordinator.controller");



router.use(authenticateToken, checkRole("admin"));


// get all coordinators
router.get("/", getCoordinators);

// get a coordinator
router.get("/:id", getCoordinator);

// create a coordinator
router.post("/", createCoordinator);

// update a coordinator
router.put("/:id", updateCoordinator);

// delete a coordinator
router.delete("/:id", deleteCoordinator);









module.exports = router;
