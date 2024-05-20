const Notification = require("../models/User/notification");

const sendNotification = async (user, message, type, link) => {
  try {
    const notification = new Notification({
      user,
      message,
      type,
      link,
    });
    await notification.save();
  } catch (error) {
    return error;
  }
};

module.exports = sendNotification;
