const router = require("express").Router();
const auth = require("./auth");
const admin = require("./admin");
const job = require("./job");

router.use("/auth", auth);
router.use("/admin", admin);
router.use("/job", job);

module.exports = router;
