const router = require("express").Router();
const auth = require("./auth");
const admin = require("./admin");
const job = require("./job");
const notification = require("./notification");
const safaricom = require("./safaricom");

router.use("/auth", auth);
router.use("/admin", admin);
router.use("/job", job);
router.use("/notification", notification);
router.use("/safaricom", safaricom);

module.exports = router;
