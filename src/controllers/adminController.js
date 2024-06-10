const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const User = require("../models/User/user");
const Job = require("../models/Job/job");
const Review = require("../models/Job/review");
const mongoose = require("mongoose");

const approveUser = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    await User.findByIdAndUpdate(req.params.id, { adminApproval: req.params.status });
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

    const totalUsers = await User.countDocuments({
      ...roleFilter,
      ...searchFilter,
      isActive: true,
    });
    return SuccessHandler({
      users,
      totalUsers,
    }, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getSingleUser = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    let user = await User.findById(req.params.id);
    if (!user) return ErrorHandler("User not found", 404, req, res);

    if (user.role === "worker") {
      const successRate = await Job.aggregate([
        {
          $match: {
            worker: mongoose.Types.ObjectId(req.params.id),
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
            worker: mongoose.Types.ObjectId(req.params.id),
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
        successRate: successRate[0]?.successRate || 0,
        avgRating: avgRating[0]?.avgRating || 0,
      };

      console.log("user", user);
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

    const statusFilter = req.query.status ? { status: req.query.status } : {};

    const jobs = await Job.find({
      ...searchFilter,
      ...statusFilter,
    })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("worker")
      .populate("user")
      .populate("review")
      .populate("proofOfWork");

    return SuccessHandler(jobs, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getSingleJob = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    const job = await Job.findById(req.params.id)
      .populate("worker")
      .populate("client")
      .populate("reviews")
      .populate({
        path: "proposals",
        populate: {
          path: "worker",
        },
      })
      .populate("proofOfWork");
    if (!job) return ErrorHandler("Job not found", 404, req, res);
    return SuccessHandler(job, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const recentjobs = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).limit(4);
    return SuccessHandler(jobs, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const dashboardStats = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    let yearRange = {};
    if(req.query?.yearRange){
      if(req.query.yearRange === 'thisYear'){
        yearRange = {
          createdAt: {
            $gte: new Date(new Date().getFullYear(), 0, 1),
            $lt: new Date(new Date().getFullYear(), 11, 31),
          }
        }
      }else if(req.query.yearRange === 'lastYear'){
        yearRange = {
          createdAt: {
            $gte: new Date(new Date().getFullYear()-1, 0, 1),
            $lt: new Date(new Date().getFullYear(), 11, 31),
          }
        }
      } else if(req.query.yearRange === 'last3Years'){
        yearRange = {
          createdAt: {
            $gte: new Date(new Date().getFullYear()-3, 0, 1),
            $lt: new Date(new Date().getFullYear(), 11, 31),
          }
        }
      }
    }

    // jobs data
    const totalJobs = await Job.countDocuments({
      ...yearRange
    });
    let totalJobsGraph = await Job.aggregate([
      {
        $match: {
          ...yearRange
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          totalJobs: { $sum: 1 },
        },
      },
      {
        $project: {
          totalJobs: 1,
          _id: 1,
        },
      },
    ]);
    totalJobsGraph = months.map((month, index) => {
      const monthData = totalJobsGraph.find((data) => data._id === index + 1);
      return {
        month,
        totalJobs: monthData ? monthData.totalJobs : 0,
      };
    });

    const completedJobs = await Job.countDocuments({
      status: "completed",
      ...yearRange
    });
    let completedJobsGraph = await Job.aggregate([
      {
        $match: {
          status: "completed",
          ...yearRange
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          completedJobs: { $sum: 1 },
        },
      },
      {
        $project: {
          completedJobs: 1,
          _id: 1,
        },
      },
    ]);
    completedJobsGraph = months.map((month, index) => {
      const monthData = completedJobsGraph.find(
        (data) => data._id === index + 1
      );
      return {
        month,
        completedJobs: monthData ? monthData.completedJobs : 0,
      };
    });

    const disputedJobs = await Job.countDocuments({
      status: "disputed",
      ...yearRange
    });
    let disputedJobsGraph = await Job.aggregate([
      {
        $match: {
          status: "disputed",
          ...yearRange
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          disputedJobs: { $sum: 1 },
        },
      },
      {
        $project: {
          disputedJobs: 1,
          _id: 1,
        },
      },
    ]);
    disputedJobsGraph = months.map((month, index) => {
      const monthData = disputedJobsGraph.find(
        (data) => data._id === index + 1
      );
      return {
        month,
        disputedJobs: monthData ? monthData.disputedJobs : 0,
      };
    });


    return SuccessHandler(
      {
        totalJobs,
        totalJobsGraph,
        completedJobs,
        completedJobsGraph,
        disputedJobs,
        disputedJobsGraph,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

module.exports = {
  approveUser,
  getAllUsers,
  getSingleUser,
  getJobs,
  getSingleJob,
  recentjobs,
  dashboardStats,
};
