const dotenv = require("dotenv");
const axios = require("axios");
const Job = require("../models/Job/job");
const Proposal = require("../models/Job/proposal");
const Wallet = require("../models/User/workerWallet");
const User = require("../models/User/user");
const {
  sendNotification,
  sendAdminNotification,
} = require("../utils/sendNotification");
const { paymentConfirmation } = require("./socketFunctions");

const generate_access_token = async () => {
  const result = await axios({
    url: "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    method: "GET",
    headers: {
      Authorization:
        "Basic N0JZWUFKU0dhMXBZd29WRUNRWEtleVpna3pPdnNKTXRnYzV3dDVpWFVGa3ZqbEM5OnNOV0REbGRBU0FidXlmRklNY3huRXp5SjB0bHBwMkNFNXFLSUJ2MjVTbEdnODN2UmRpN3VkSVFsWXg0cktpSFQ=",
    },
  });

  console.log("acc", result.data);
  return result.data.access_token;
};

const c2b_register_url = async (
  shortCode = "600992",
  responseType = "Completed",
  confirmationUrl = "https://nisafi-staging.up.railway.app/confirmation",
  validationUrl = "https://nisafi-staging.up.railway.app/validation"
  // confirmationUrl = "http://192.168.100.16:8002/confirmation",
  // validationUrl = "http://192.168.100.16:8002/validation"
) => {
  const access_token = await generate_access_token();
  const url = "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl";
  const result = await axios({
    method: "POST",
    url,
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
    data: {
      ShortCode: shortCode,
      ResponseType: responseType,
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl,
    },
  });
  console.log("result", result.data);
  return result.data;
};

const c2b_simulate = async (
  // shortCode = "600992",
  // commandID = "CustomerPayBillOnline",
  amount,
  msisdn,
  billRefNumber
) => {
  const access_token = await generate_access_token();
  const url = "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/simulate";
  const result = await axios({
    method: "POST",
    url,
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
    data: {
      ShortCode: "600992",
      CommandID: "CustomerPayBillOnline",
      Amount: amount,
      Msisdn: msisdn,
      BillRefNumber: billRefNumber,
    },
  });
  console.log("result", result.data);
  return result.data;
};

const confirmationHook = async (req, res) => {
  if (req.body) {
    const data = JSON.parse(req.body.BillRefNumber);
    const job = await Job.findById(data.jobId).populate("user");
    if (job.status !== "open") {
      return;
    }
    const proposal = await Proposal.findById(data.proposalId).populate("user");

    const transaction = {
      amount: proposal.budget,
      type: "credit",
      paidBy: job.user._id,
      // paidTo: proposal.user._id,
      job: job._id,
      escrow: true,
      mpesaDetails: req.body,
    };

    const wallet = await Wallet.findOne({ user: job.user._id });
    wallet.balance += transaction.amount;
    wallet.transactions.push(transaction);
    await wallet.save();

    job.status = "in_progress";
    job.worker = proposal.user._id;
    job.laundryPickupTime = data.laundryPickupTime;
    await job.save();

    await paymentConfirmation(job.user._id, {
      jobId: job._id,
      proposalId: proposal._id,
    });

    if (proposal.user.deviceToken) {
      await sendNotification(
        {
          _id: proposal.user._id,
          deviceToken: proposal.user.deviceToken,
        },
        `Proposal for ${job.type} accepted by ${job.user.name} and the job is in progress`,
        "job",
        "/job/" + job._id
      );
    }

    const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allAdmins.map(async (admin) => {
        await sendAdminNotification(
          admin._id,
          `Proposal for ${job.type} accepted by ${job.user.name} and the job is in progress`,
          "job",
          job._id,
          "Proposal Accepted"
        );
      })
    );
  }

  return res.status(200).json({
    ResultCode: "0",
    ResultDesc: "Accepted",
  });
};

module.exports = {
  generate_access_token,
  c2b_register_url,
  c2b_simulate,
  confirmationHook,
};
