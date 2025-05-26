const express = require("express");
const safaricomController = require("../controllers/safaricomController");

const router = express.Router();
router.route("/test").get(safaricomController.testRoutes);

router.route("/stk-push").post(safaricomController.initiateStkPush);

router.route("/stk-callback").post(safaricomController.stkCallback);

router
  .route("/check-payment/:transactionId")
  .get(safaricomController.checkPaymentStatus);

router.route("/b2c-callback").post(safaricomController.b2cCallback);

router.route("/b2c-disburse").post(safaricomController.initiateB2CDisbursement);
router.route("/b2c-timeout").post(safaricomController.b2cTimeout);

module.exports = router;
