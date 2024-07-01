const dotenv = require("dotenv");
const axios = require("axios");

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
  shortCode = "600992",
  commandID = "CustomerPayBillOnline",
  amount = "100",
  msisdn = "254708374149",
  billRefNumber = "TestAPI"
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
      ShortCode: shortCode,
      CommandID: commandID,
      Amount: amount,
      Msisdn: msisdn,
      BillRefNumber: billRefNumber,
    },
  });
  console.log("result", result.data);
  return result.data;
};

module.exports = {
  generate_access_token,
  c2b_register_url,
  c2b_simulate,
};
