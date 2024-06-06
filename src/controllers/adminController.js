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
    const searchFilter = req.query.search
      ? {
          $or: [
            { name: { $regex: req.query.search, $options: "i" } },
            { email: { $regex: req.query.search, $options: "i" } },
          ],
        }
      : {};
    const sort = req.query.sort
      ? { createdAt: req.query.sort === "asc" ? 1 : -1 }
      : { createdAt: -1 };
    const users = await User.find({
      ...roleFilter,
      ...searchFilter,
      isActive: true,
    }).sort(sort);
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

const getJobs = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

module.exports = {
  approveUser,
  getAllUsers,
  getSingleUser,
  getJobs
};
