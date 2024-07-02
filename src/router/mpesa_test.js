const express = require("express");
const { c2b_register_url, c2b_simulate } = require("../functions/mpesa");
const router = express.Router();

router.route("/register").get(async (req, res) => {
  // #swagger.tags = ['Mpesa']
  try {
    const resp = await c2b_register_url();
    console.log("resp", resp);
    return res.status(200).json({
      message: "URL registered successfully",
      data: resp,
    });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({
      message: error.message,
    });
  }
});
router.route("/simulate").get(async (req, res) => {
  // #swagger.tags = ['Mpesa']
  try {
    const resp = await c2b_simulate("100", "254708374149", "testapi");
    return res.status(200).json({
      message: "Simulation successful",
      data: resp,
    });
  } catch (error) {
    console.log("error", error.response.data.Envelope.Body.Fault);
    return res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
