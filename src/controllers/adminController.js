const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const User = require("../models/User/user");
const Job = require("../models/Job/job");
const Review = require("../models/Job/review");

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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find({
      ...roleFilter,
      ...searchFilter,
      isActive: true,
    })
      .sort(sort)
      .skip(skip)
      .limit(limit);
    return SuccessHandler(users, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getSingleUser = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    let user = await User.findById(req.params.id);
    if(!user) return ErrorHandler("User not found", 404, req, res);

    if(user.role === "worker") {
      const successRate = await Job.aggregate([
        {
          $match: {
            worker: mongoose.Types.ObjectId(req.user.id),
          },
        },
        {
          $group: {
            _id: null,
            totalJobs: { $sum: 1 },
            completedJobs: {
              $sum: {
                $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            successRate: {
              $cond: [
                { $eq: ["$totalJobs", 0] },
                0,
                {
                  $multiply: [
                    { $divide: ["$completedJobs", "$totalJobs"] },
                    100,
                  ],
                },
              ],
            },
          },
        },
      ]);

      const avgRating = await Review.aggregate([
        {
          $match: {
            worker: mongoose.Types.ObjectId(req.user.id),
          },
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
          },
        },
      ]);

      user = {
        ...user._doc,
        successRate: successRate[0].successRate,
        avgRating: avgRating[0].avgRating,
      };
      
    }
    return SuccessHandler(user, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getJobs = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    const sort = req.query.sort
      ? { createdAt: req.query.sort === "asc" ? 1 : -1 }
      : { createdAt: -1 };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const searchFilter = req.query.search
      ? {
          $or: [
            { title: { $regex: req.query.search, $options: "i" } },
            { description: { $regex: req.query.search, $options: "i" } },
          ],
        }
      : {};

    const statusFilter = req.query.status
      ? { status: req.query.status }
      : {};

    const jobs = await Job.find({
      ...searchFilter,
      ...statusFilter,
    })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("worker")
      .populate("client");
    return SuccessHandler(jobs, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

module.exports = {
  approveUser,
  getAllUsers,
  getSingleUser,
  getJobs,
};
