const router = require("express").Router();
const auth = require("./auth");
const admin = require("./admin");
const job = require("./job");
const notification = require("./notification");

router.use("/auth", auth);
router.use("/admin", admin);
router.use("/job", job);
router.use("/notification", notification);

module.exports = router;
