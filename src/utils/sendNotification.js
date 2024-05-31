const Notification = require("../models/User/notification");
const admin = require("firebase-admin");
const serviceAccount = require("../../firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendNotification = async (user, message, type, link) => {
  try {
    const notification = new Notification({
      user: user._id,
      message,
      type,
      link,
    });
    await notification.save();

    admin
      .messaging()
      .sendToDevice(user.deviceToken, {
        notification: {
          title: "New Notification",
          body: message,
        },
        data: {
          type,
          link,
        },
      })
      .then((response) => {
        console.log("Notification sent successfully", response);
      })
      .catch((error) => {
        console.log("Error sending notification", error);
      });
  } catch (error) {
    return error;
  }
};

module.exports = sendNotification;
