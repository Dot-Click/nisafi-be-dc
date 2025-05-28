const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const notification = require("../controllers/notificationController.js");
const router = express.Router();

router.route("/unread-count").get(isAuthenticated, notification.getUnreadCount);
router.route("/").get(isAuthenticated, notification.getAllNotifications);

module.exports = router;
