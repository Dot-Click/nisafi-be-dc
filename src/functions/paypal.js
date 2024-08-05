  const axios = require("axios");
  const dotenv = require("dotenv");
  dotenv.config({
    path: "./src/config/config.env",
  });

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  const getToken = async () => {
    try {
      const token = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString(
        "base64"
      );
      const response = await axios({
        url: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${token}`,
        },
        data: "grant_type=client_credentials",
      });
      return response.data.access_token;
    } catch (error) {
      console.log(error);
    }
  };

  const createPayout = async (data) => {
    try {
      const token = await getToken();
      const response = await axios.post(
        "https://api-m.sandbox.paypal.com/v1/payments/payouts",
        {
          items: [
            {
              receiver: data.email,
              amount: {
                currency: "USD",
                value: data.amount,
              },
              recipient_type: "EMAIL",
              note: "Nisafi Cleaner Payout for " + data.id,
              sender_item_id: `${Date.now()}`,
              purpose: "SERVICES",
            },
          ],
          sender_batch_header: {
            sender_batch_id: `Withdarawal_${Date.now()}`,
            email_subject: "You have a payout!",
            email_message: `You have received a payout of $${data.amount} from Nisafi Cleaner`,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      // recurrsive function to check the status of the payout

      const status = Promise.resolve(checkPayoutStatus(response.data.batch_header.payout_batch_id))
      return status;
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  const checkPayoutStatus = async (batchId) => {
    try {
      const token = await getToken();
      const response2 = await axios.get(
        `https://api-m.sandbox.paypal.com/v1/payments/payouts/${batchId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("Get payout", response2.data.batch_header.batch_status);
      if (
        response2.data.batch_header.batch_status === "PENDING" ||
        response2.data.batch_header.batch_status === "PROCESSING"
      ) {
        console.log("Payout is still pending");
        const status = Promise.resolve(checkPayoutStatus(batchId))
        return status;
      } else if (response2.data.batch_header.batch_status === "SUCCESS") {
        console.log("Payout is successful");
        return true;
      } else if (response2.data.batch_header.batch_status === "DENIED") {
        return false;
      }
    } catch (error) {
      console.log(error);
      return error?.message;
    }
  };

module.exports = {
  createPayout,
};
