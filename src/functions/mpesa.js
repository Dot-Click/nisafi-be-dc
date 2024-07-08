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
dotenv.config({
  path: ".././src/config/config.env",
});

const generate_access_token = async () => {
  try {
    console.log("gen", process.env.MPESA_SHORTCODE);
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
  } catch (error) {
    console.log("error", error);
  }
};

const c2b_register_url = async () => {
  try {
    const access_token = await generate_access_token();
    const url = "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl";
    const result = await axios({
      method: "POST",
      url,
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        ShortCode: process.env.MPESA_SHORTCODE,
        ResponseType: "Completed",
        ConfirmationURL: process.env.C2B_CONFIRMATION,
        ValidationURL: process.env.C2B_VALIDATION,
      },
    });
    console.log("result", result.data);
    return result.data;
  } catch (error) {
    console.log("error", error);
  }
};

const c2b_simulate = async (
  // shortCode = "600992",
  // commandID = "CustomerPayBillOnline",
  amount,
  msisdn,
  billRefNumber
) => {
  try {
    const access_token = await generate_access_token();
    const url = "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/simulate";
    const result = await axios({
      method: "POST",
      url,
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        ShortCode: process.env.MPESA_SHORTCODE,
        CommandID: "CustomerPayBillOnline",
        Amount: amount,
        Msisdn: msisdn,
        BillRefNumber: billRefNumber,
      },
    });
    console.log("result", result.data);
    return result.data;
  } catch (error) {
    console.log("error", error);
  }
};

const confirmationHook = async (req, res) => {
  try {
    if (req.body) {
      const data = JSON.parse(req.body.BillRefNumber);
      const job = await Job.findById(data.jobId).populate("user");
      if (job.status !== "open") {
        return;
      }
      const proposal = await Proposal.findById(data.proposalId).populate(
        "user"
      );

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

      await paymentConfirmation(job.user._id, "c2bPaymentConfirmation", {
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
  } catch (error) {
    // await paymentConfirmation(job.user._id, {
    //   jobId: job._id,
    //   proposalId: proposal._id,
    // });
    console.log("error", error);
  }
};

const b2c_request = async (amount, partyB, timeoutUrl, resultUrl) => {
  try {
    const access_token = await generate_access_token();
    const url = "https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest";
    const originatorConversationID =
      Date.now() + "-" + amount + "-" + partyB + "-" + "Salary-payment";
    const result = await axios({
      method: "POST",
      url,
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        OriginatorConversationID: originatorConversationID,
        InitiatorName: "testapi",
        SecurityCredential:
          "J+d2tVNiZ7EvxnRV0VWfq+USSEpVTWmfLbgh7sgHPa8/w9zGqMq/PL08wlNtss3l+9cVf0FX4RvKSwDuKoAWtrkkVn/s7g4cgi6BFVmOI5TTRgQra8V7Dow+3S6tEBvKlx0w2yM22n+yndcbvXP54aS5ihcmjEzBx6Ds+t0+PgOcYwvd09bNxSVYaZj5BlsjEuA1yHr+mpc24kO6fkXJlqdFrFJIFBb5OzL+mtD1Z9v9J8XlwDFRobvb/Qm8ah4wZokE5D6Cp721YoPcMkapjmzhLp5OqUN6Wra85KMX1A7r4y87QeVNbURC4ebS2SyNjf7JzL1c7Kim+KgN2UKwvA==",
        CommandID: "SalaryPayment",
        Amount: amount,
        PartyA: process.env.MPESA_SHORTCODE,
        PartyB: partyB,
        Remarks: "Salary payment",
        QueueTimeOutURL: `${process.env.BASE_URL}${timeoutUrl}`,
        ResultURL: `${process.env.BASE_URL}${resultUrl}`,
        Occassion: "Salary payment",
      },
    });
    console.log("result", result.data);
    return result.data;
  } catch (error) {
    console.log("error", error);
  }
};

const b2c_timeoutHook = async (req, res) => {
  try {
    const userId = req.params.id;
    if (req.body) {
      const user = await User.findById(userId);
      user.withdrawal = false;
      await user.save();
      await paymentConfirmation(userId, "b2cPaymentTimeout", req.body);
    }
    return res.status(200).json({
      ResultCode: "0",
      ResultDesc: "Accepted",
    });
  } catch (error) {
    console.log("error", error);
  }
};

const b2c_resultHook = async (req, res) => {
  try {
    const userId = req.params.id;
    if (req.body && req.body.ResultCode === 0) {
      const user = await User.findById(userId);
      const wallet = await Wallet.findOne({ user: userId });
      const transactionAmount =
        req.body.ResultParameters.ResultParameter[0].Value;
      const transaction = {
        amount: transactionAmount,
        type: "debit",
        paidTo: userId,
        mpesaDetails: req.body,
      };
      wallet.balance -= transactionAmount;
      wallet.transactions.push(transaction);
      await wallet.save();
      user.withdrawal = false;
      await user.save();

      if (user.deviceToken) {
        await sendNotification(
          {
            _id: userId,
            deviceToken: user.deviceToken,
          },
          `Withdrawal of Ksh ${transactionAmount} was successful`,
          "withdrawal",
          "/wallet"
        );
      }

      const allAdmins = await User.find({ role: "admin" });
      Promise.all(
        allAdmins.map(async (admin) => {
          await sendAdminNotification(
            admin._id,
            `Withdrawal of Ksh ${transactionAmount} was successful`,
            "withdrawal",
            userId,
            "Withdrawal"
          );
        })
      );

      // b2c confirmation
      await paymentConfirmation(userId, "b2cPaymentConfirmation", req.body);
    }
    return res.status(200).json({
      ResultCode: "0",
      ResultDesc: "Accepted",
    });
  } catch (error) {
    console.log("error", error);
  }
};

module.exports = {
  generate_access_token,
  c2b_register_url,
  c2b_simulate,
  confirmationHook,
  b2c_request,
  b2c_timeoutHook,
  b2c_resultHook,
};
