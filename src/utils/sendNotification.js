const Notification = require("../models/User/notification");
const admin = require("firebase-admin");
const serviceAccount = require("../../firebase-admin.json");
const { google } = require("googleapis");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendNotification = async (user, message, type, link) => {
  console.log(user);
  try {
    const notification = new Notification({
      user: user._id,
      message,
      type,
      link,
    });
    await notification.save();

    const auth = new google.auth.GoogleAuth({
      keyFile: "./firebase-admin.json",
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const accessToken = await auth.getAccessToken();

    console.log(accessToken);

    const messageObj = {
      notification: {
        title: "New Notification",
        body: message,
      },
      token: user.deviceToken,
    };

    const response = await fetch(
      "https://fcm.googleapis.com/v1/projects/nisafi-6934e/messages:send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: messageObj }),
      }
    );

    const jsonResponse = await response.json();
    console.log(jsonResponse);
  } catch (error) {
    console.log(error); 
    return error;
  }
};

module.exports = {sendNotification};
