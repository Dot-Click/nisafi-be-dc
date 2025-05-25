const express = require("express");
const safaricomController = require("../controllers/safaricomController");

const router = express.Router();
router.route("/test").get(safaricomController.testRoutes);

router.route("/stk-push").post(safaricomController.initiateStkPush);

router.route("/stk-callback").post(safaricomController.stkCallback);

router
  .route("/check-payment/:transactionId")
  .get(safaricomController.checkPaymentStatus);

module.exports = router;
