const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const Notification = require("../models/User/notification");

const getUnreadCount = async (req, res) => {
  // #swagger.tags = ['Notification']
  try {
    const { _id } = req.user;
    const count = await Notification.countDocuments({ user: _id, read: false });
    SuccessHandler(count, 200, res);
  } catch (error) {
    ErrorHandler(error.message, 500, req, res);
  }
};

const getAllNotifications = async (req, res) => {
  // #swagger.tags = ['Notification']
  try {
    const { _id } = req.user;
    const notifications = await Notification.find({ user: _id }).sort({
      createdAt: -1,
    });

    await Notification.updateMany({ user: _id, read: false }, { read: true });
    SuccessHandler(notifications, 200, res);
  } catch (error) {
    ErrorHandler(error.message, 500, req, res);
  }
};

module.exports = {
  getUnreadCount,
  getAllNotifications,
};
