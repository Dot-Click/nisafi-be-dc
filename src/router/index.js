const router = require("express").Router();
const auth = require("./auth");
const admin = require("./admin");
const job = require("./job");
const notification = require("./notification");
const mpesa = require("./mpesa_test");

router.use("/auth", auth);
router.use("/admin", admin);
router.use("/job", job);
router.use("/notification", notification);
router.use("/mpesa", mpesa);

module.exports = router;
