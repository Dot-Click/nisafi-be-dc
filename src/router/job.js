const express = require("express");
const job = require("../controllers/jobController.js");
const { isAuthenticated, isAdmin, isWorker, isClient } = require("../middleware/auth");
const router = express.Router();

// get
router.route("/client").get(isAuthenticated, job.getAllJobsClient);
router.route("/worker").get(isAuthenticated, job.getAllJobsWorker);
// post
router.route("/").post(isAuthenticated, isClient, job.createJob);
router.route("/submitProposal/:id").post(isAuthenticated, isWorker, job.submitProposal);
// put
// delete

module.exports = router;