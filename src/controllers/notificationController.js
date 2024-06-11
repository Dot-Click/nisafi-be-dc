const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const Notification = require("../models/User/notification");

const getUnreadCount = async (req, res) => {
  // #swagger.tags = ['Notification']
  try {
    const { _id } = req.user;
    const count = await Notification.countDocuments({ user: _id, read: false });
    SuccessHandler(res, count);
  } catch (error) {
    ErrorHandler(res, error);
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
    SuccessHandler(res, notifications);
  } catch (error) {
    ErrorHandler(res, error);
  }
};

module.exports = {
  getUnreadCount,
  getAllNotifications,
};
