const axios = require("axios");
const uuid = require("uuid").v4;
const DepositTransaction = require("../models/DepositTransaction");
const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");

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
  try {
    const { phonenumber, amount } = req.body;
    if (!phonenumber || !amount) {
      return ErrorHandler(
        "Phone number and amount are required",
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
      AccountReference: "Account Reference",
      TransactionDesc: "Payment for deposit",
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
      await DepositTransaction.create({
        transaction_id: transactionId,
        phonenumber: formattedPhone,
        amount,
        status: "PENDING",
      });

      return SuccessHandler(
        {
          message: "STK Push initiated",
          transaction_id: transactionId,
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
  try {
    const stkCallback = req.body.Body.stkCallback;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    if (resultCode === 0) {
      const metadata = stkCallback.CallbackMetadata.Item;
      const amount = metadata.find((item) => item.Name === "Amount")?.Value;
      const phoneNumber = metadata.find(
        (item) => item.Name === "PhoneNumber"
      )?.Value;

      await DepositTransaction.findOneAndUpdate(
        { phonenumber: phoneNumber, status: "PENDING" },
        { status: "SUCCESS" }
      );

      return SuccessHandler(
        { message: "Payment successful", status: "success" },
        200,
        res
      );
    } else {
      await DepositTransaction.findOneAndUpdate(
        { status: "PENDING" },
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
    const transaction = await DepositTransaction.findOne({
      transaction_id: req.params.transactionId,
    });

    if (!transaction) {
      return ErrorHandler("Transaction not found", 404, req, res);
    }

    return SuccessHandler(
      {
        transaction_id: transaction.transaction_id,
        status: transaction.status,
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

module.exports = {
  testRoutes,
  initiateStkPush,
  stkCallback,
  checkPaymentStatus,
};
