const express = require("express");
const job = require("../controllers/jobController.js");
const {
  isAuthenticated,
  isAdmin,
  isWorker,
  isClient,
} = require("../middleware/auth");
const router = express.Router();

// get
router.route("/client").get(isAuthenticated, isClient, job.getAllJobsClient);
router.route("/worker").get(isAuthenticated, isWorker, job.getAllJobsWorker);
router.route("/proposals/:id").get(isAuthenticated, job.getProposalsByJobId);

// post
router.route("/create").post(isAuthenticated, isClient, job.createJob);
router
  .route("/submitProposal/:id")
  .post(isAuthenticated, isWorker, job.submitProposal);

// put
router
  .route("/acceptProposal")
  .put(isAuthenticated, isClient, job.acceptProposal);
router.route("/deliverWork").put(isAuthenticated, isWorker, job.deliverWork);
router.route("/cancelJob/:id").put(isAuthenticated, isClient, job.cancelJob);
router
  .route("/markAsCompleted/:id")
  .put(isAuthenticated, isClient, job.markAsCompleted);
router.route("/submitReview").put(isAuthenticated, isClient, job.submitReview);
router
  .route("/createDispute")
  .put(isAuthenticated, isClient, job.createDispute);

module.exports = router;
