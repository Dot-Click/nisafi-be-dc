const express = require("express");
const admin = require("../controllers/adminController.js");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const router = express.Router();

// get
router.route("/approveUser/:id/:status").get(isAuthenticated, isAdmin, admin.approveUser);
router.route("/users").get(isAuthenticated, isAdmin, admin.getAllUsers);
router.route("/users/:id").get(isAuthenticated, isAdmin, admin.getSingleUser);
router.route("/jobs").get(isAuthenticated, isAdmin, admin.getJobs);
router.route("/jobs/:id").get(isAuthenticated, isAdmin, admin.getSingleJob);
router.route("/recentjobs").get(isAuthenticated, isAdmin, admin.recentjobs);
router.route("/dashboardStats").get(isAuthenticated, isAdmin, admin.dashboardStats);

router.route("/banner").post(isAuthenticated, isAdmin, admin.createBanner);
router.route("/banner").get(isAuthenticated, admin.getBanners);
router.route("/banner/:id").delete(isAuthenticated, isAdmin, admin.deleteBanner);
router.route("/getWallets").get(isAuthenticated, isAdmin, admin.getWallets);


module.exports = router;