const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const User = require("../models/User/user");
const Job = require("../models/Job/job");

const approveUser = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    await User.findByIdAndUpdate(req.params.id, { adminApproval: true });
    return SuccessHandler("User approved successfully", 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getAllUsers = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    const roleFilter = req.query.role ? { role: req.query.role } : {};
    const users = await User.find({
      ...roleFilter,
      isActive: true,
    });
    return SuccessHandler(users, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getSingleUser = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    const user = await User.findById(req.params.id);
    return SuccessHandler(user, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

module.exports = {
  approveUser,
  getAllUsers,
  getSingleUser,
};
