const axios = require("axios");
const uuid = require("uuid").v4;
const EscrowDeposit = require("../models/EscrowDeposit");
const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const fs = require("fs");

const formatPhoneNumber = (phone) => phone.replace(/^0/, "254");

const testRoutes = async (req, res) => {
  return res.status(200).json({ message: "Hello, routes work" });
};

const getAccessToken = async () => {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return response.data.access_token;
};

// Initiate STK Push
const initiateStkPush = async (req, res) => {
  // #swagger.tags = ['Safaricom']
  // Expected body: { phonenumber, amount, client, worker, jobId }
  console.log(res);
  try {
    const { phonenumber, amount, client, worker, jobId } = req.body;

    if (!phonenumber || !amount || !client || !worker || !jobId) {
      return ErrorHandler(
        "Phone number, amount, client, worker, and jobId are required",
        400,
        req,
        res
      );
    }

    const formattedPhone = formatPhoneNumber(phonenumber);
    const accessToken = await getAccessToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const transactionId = uuid();

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: `Job-${jobId}`,
      TransactionDesc: "Escrow payment for job",
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseData = response.data;

    if (responseData.ResponseCode === "0") {
      // Create record with PENDING status and transactionId
      const newDeposit = await EscrowDeposit.create({
        transaction_id: transactionId,
        phonenumber: formattedPhone,
        amount,
        status: "PENDING",
        client,
        worker,
        jobId,
        escrowStatus: "HELD",
        checkoutRequestId: responseData.CheckoutRequestID, // <-- Save this here!
      });

      return SuccessHandler(
        {
          message: "STK Push initiated",
          transaction_id: transactionId,
          checkoutRequestId: responseData.CheckoutRequestID,
          response_data: responseData,
        },
        200,
        res
      );
    } else {
      return ErrorHandler(
        responseData.errorMessage || "Failed to initiate STK Push",
        400,
        req,
        res
      );
    }
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

// STK Push Callback
const stkCallback = async (req, res) => {
  // #swagger.tags = ['Safaricom']

  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  try {
    console.log("Writing Safaricom callback data to file...");
    fs.appendFileSync(
      "mpesa_logs.txt",
      JSON.stringify(req.body, null, 2) + "\n\n"
    );
    console.log("Writing Done...");

    const stkCallback = req.body.Body.stkCallback;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    // Use checkoutRequestId for finding record
    const checkoutRequestId = stkCallback.CheckoutRequestID;

    if (resultCode === 0) {
      const metadata = stkCallback.CallbackMetadata.Item;
      const amount = metadata.find((item) => item.Name === "Amount")?.Value;
      const phoneNumber = metadata.find(
        (item) => item.Name === "PhoneNumber"
      )?.Value;

      const updated = await EscrowDeposit.findOneAndUpdate(
        { checkoutRequestId, status: "PENDING" },
        { status: "SUCCESS" },
        { new: true }
      );

      if (!updated) {
        console.warn(
          "No matching EscrowDeposit found for checkoutRequestId:",
          checkoutRequestId
        );
      } else {
        console.log("EscrowDeposit updated successfully:", updated);
      }

      return SuccessHandler(
        { message: "Payment successful", status: "success" },
        200,
        res
      );
    } else {
      // Mark as failed
      await EscrowDeposit.findOneAndUpdate(
        { checkoutRequestId, status: "PENDING" },
        { status: "FAILED" }
      );

      return ErrorHandler(`Payment failed: ${resultDesc}`, 400, req, res);
    }
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

// Check Payment Status
const checkPaymentStatus = async (req, res) => {
  // #swagger.tags = ['Safaricom']
  try {
    const transaction = await EscrowDeposit.findOne({
      transaction_id: req.params.transactionId,
    });

    if (!transaction) {
      return ErrorHandler("Transaction not found", 404, req, res);
    }

    return SuccessHandler(
      {
        transaction_id: transaction.transaction_id,
        status: transaction.status,
        escrowStatus: transaction.escrowStatus,
        amount: transaction.amount,
        phone_number: transaction.phonenumber,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const initiateB2CDisbursement = async (req, res) => {
  // Expected body: { transactionId, recipientPhone }

  try {
    const { transactionId, recipientPhone } = req.body;

    if (!transactionId || !recipientPhone) {
      return ErrorHandler(
        "transactionId and recipientPhone are required",
        400,
        req,
        res
      );
    }

    const escrow = await EscrowDeposit.findOne({
      transaction_id: transactionId,
    });
    if (!escrow) {
      return ErrorHandler("Escrow transaction not found", 404, req, res);
    }

    if (escrow.escrowStatus !== "HELD") {
      return ErrorHandler(
        `Funds are not in HELD status (current status: ${escrow.escrowStatus})`,
        400,
        req,
        res
      );
    }

    const formattedPhone = formatPhoneNumber(recipientPhone); // your phone formatting function

    const accessToken = await getAccessToken();

    const payload = {
      InitiatorName: process.env.MPESA_B2C_INITIATOR_NAME,
      SecurityCredential: process.env.MPESA_PASSKEY,
      CommandID: "BusinessPayment",
      Amount: escrow.amount,
      PartyA: process.env.MPESA_SHORTCODE,
      PartyB: formattedPhone,
      Remarks: `Disbursement for job ${escrow.jobId}`,
      QueueTimeOutURL: process.env.MPESA_B2C_TIMEOUT_URL,
      ResultURL: process.env.MPESA_B2C_CALLBACK_URL,
      Occasion: `Job-${escrow.jobId}`,
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseData = response.data;

    if (responseData.ResponseCode === "0") {
      escrow.disbursementTransactionId = responseData.TransactionID;
      escrow.disbursementStatus = "PENDING";
      await escrow.save();

      return SuccessHandler(
        {
          message: "Disbursement initiated",
          disbursementTransactionId: responseData.TransactionID,
          response_data: responseData,
        },
        200,
        res
      );
    } else {
      return ErrorHandler(
        responseData.ResponseDescription || "Failed to initiate disbursement",
        400,
        req,
        res
      );
    }
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const b2cCallback = async (req, res) => {
  // #swagger.tags = ['Safaricom']

  try {
    console.log("B2C Callback received:", JSON.stringify(req.body, null, 2));

    fs.appendFileSync(
      "mpesa_b2c_logs.txt",
      JSON.stringify(req.body, null, 2) + "\n\n"
    );

    const result = req.body.Result;

    if (!result) {
      return ErrorHandler("Invalid B2C callback format", 400, req, res);
    }

    const transactionId = result.TransactionID;
    const resultCode = result.ResultParameters.ResultParameter.find(
      (param) => param.Key === "ResultCode"
    )?.Value;

    const resultDesc = result.ResultParameters.ResultParameter.find(
      (param) => param.Key === "ResultDesc"
    )?.Value;

    const matchingEscrow = await EscrowDeposit.findOne({
      disbursementTransactionId: transactionId,
    });

    if (!matchingEscrow) {
      console.warn(
        "No matching escrow for disbursement transactionId:",
        transactionId
      );
      return SuccessHandler({ message: "No matching record found" }, 200, res);
    }

    if (resultCode === 0) {
      // Successful disbursement
      matchingEscrow.disbursementStatus = "SUCCESS";
      matchingEscrow.escrowStatus = "RELEASED";
      matchingEscrow.releasedAt = new Date();
      matchingEscrow.disbursementResponse = req.body;
      await matchingEscrow.save();

      return SuccessHandler({ message: "Disbursement successful" }, 200, res);
    } else {
      // Disbursement failed
      matchingEscrow.disbursementStatus = "FAILED";
      matchingEscrow.disbursementResponse = req.body;
      await matchingEscrow.save();

      return ErrorHandler(`Disbursement failed: ${resultDesc}`, 400, req, res);
    }
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const b2cTimeout = async (req, res) => {
  try {
    console.log("B2C Timeout callback received:", req.body);

    const { TransactionID } = req.body;

    if (!TransactionID) {
      return res.status(400).json({ message: "TransactionID is required" });
    }

    // Find the escrow deposit by disbursementTransactionId
    const escrow = await EscrowDeposit.findOne({
      disbursementTransactionId: TransactionID,
    });

    if (!escrow) {
      console.warn("No escrow deposit found for TransactionID:", TransactionID);
      return res.status(404).json({ message: "Escrow transaction not found" });
    }

    // Update disbursement status to TIMEOUT or FAILED
    escrow.disbursementStatus = "TIMEOUT";
    await escrow.save();

    return res
      .status(200)
      .json({ message: "B2C Timeout handled successfully" });
  } catch (error) {
    console.error("Error handling B2C Timeout:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  testRoutes,
  initiateStkPush,
  stkCallback,
  checkPaymentStatus,
  initiateB2CDisbursement,
  b2cCallback,
  b2cTimeout,
};
