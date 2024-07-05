const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const User = require("../models/User/user");
const Job = require("../models/Job/job");
const Review = require("../models/Job/review");
const mongoose = require("mongoose");
const {uploadFilesOnAWS, deleteImageFromAWS} = require("../utils/saveToServer");
const Banner = require("../models/Banner");
const Wallet = require("../models/User/workerWallet");

const approveUser = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    if (req.params.status == "pending") {
      return ErrorHandler("Invalid status", 400, req, res);
    }
    await User.findByIdAndUpdate(req.params.id, {
      adminApproval: req.params.status,
    });
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
    return SuccessHandler(
      {
        users,
        totalUsers,
      },
      200,
      res
    );
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

    const searchFilter =
      req.query.search && req.query.search !== ""
        ? {
            $or: [
              { type: { $regex: req.query.search, $options: "i" } },
              // { description: { $regex: req.query.search, $options: "i" } },
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

    const jobsCount = await Job.countDocuments({
      ...searchFilter,
      ...statusFilter,
    });

    return SuccessHandler(
      {
        jobs,
        totalJobs: jobsCount,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getSingleJob = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    let job = await Job.findById(req.params.id)
      .populate("worker")
      .populate("user")
      .populate("review")
      .populate({
        path: "proposals",
        populate: {
          path: "user",
        },
      })
      .populate("proofOfWork");

    if (!job) return ErrorHandler("Job not found", 404, req, res);
    if (job.worker) {
      const successRate = await Job.aggregate([
        {
          $match: {
            worker: mongoose.Types.ObjectId(job.worker._id),
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
            worker: mongoose.Types.ObjectId(job.worker._id),
          },
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
          },
        },
      ]);

      job = {
        ...job._doc,
        worker: {
          ...job.worker._doc,
          successRate: successRate[0]?.successRate || 0,
          avgRating: avgRating[0]?.avgRating || 0,
        },
      };
    }

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

const jobStats = async (req, res) => {
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
    if (req.query?.yearRange) {
      if (req.query.yearRange === "thisYear") {
        yearRange = {
          createdAt: {
            $gte: new Date(new Date().getFullYear(), 0, 1),
            $lt: new Date(new Date().getFullYear(), 11, 31),
          },
        };
      } else if (req.query.yearRange === "lastYear") {
        yearRange = {
          createdAt: {
            $gte: new Date(new Date().getFullYear() - 1, 0, 1),
            $lt: new Date(new Date().getFullYear(), 11, 31),
          },
        };
      } else if (req.query.yearRange === "last3Years") {
        yearRange = {
          createdAt: {
            $gte: new Date(new Date().getFullYear() - 3, 0, 1),
            $lt: new Date(new Date().getFullYear(), 11, 31),
          },
        };
      }
    }

    const totalJobs = await Job.countDocuments({
      ...yearRange,
    });
    const totalJobsByMonth = await Job.aggregate([
      {
        $match: {
          ...yearRange,
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
    ]);

    const jobsByMonth = months.map((month) => {
      const monthData = totalJobsByMonth.find(
        (data) => data._id === months.indexOf(month) + 1
      );
      return {
        month,
        count: monthData ? monthData.count : 0,
      };
    });

    const completedJobs = await Job.countDocuments({
      status: "completed",
      ...yearRange,
    });

    const completedJobsByMonth = await Job.aggregate([
      {
        $match: {
          status: "completed",
          ...yearRange,
        },
      },
      {
        $group: {
          _id: { $month: "$updatedAt" },
          count: { $sum: 1 },
        },
      },
    ]);

    const completedJobsByMonthData = months.map((month) => {
      const monthData = completedJobsByMonth.find(
        (data) => data._id === months.indexOf(month) + 1
      );
      return {
        month,
        count: monthData ? monthData.count : 0,
      };
    });

    const disputedJobs = await Job.countDocuments({
      status: "disputed",
      ...yearRange,
    });

    const disputedJobsByMonth = await Job.aggregate([
      {
        $match: {
          status: "disputed",
          ...yearRange,
        },
      },
      {
        $group: {
          _id: { $month: "$updatedAt" },
          count: { $sum: 1 },
        },
      },
    ]);

    const disputedJobsByMonthData = months.map((month) => {
      const monthData = disputedJobsByMonth.find(
        (data) => data._id === months.indexOf(month) + 1
      );
      return {
        month,
        count: monthData ? monthData.count : 0,
      };
    });

    return SuccessHandler(
      {
        totalJobs,
        completedJobs,
        disputedJobs,
        jobsByMonth,
        completedJobsByMonth: completedJobsByMonthData,
        disputedJobsByMonth: disputedJobsByMonthData,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const createBanner = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    const { url } = req.body;
    if (!url) return ErrorHandler("Url is required", 400, req, res);
    let imageUrl = [""];
    if (req.files.image) {
      const image = req.files.image;
      imageUrl = await uploadFilesOnAWS([image]);
    }
    const banner = new Banner({
      image: imageUrl[0],
      url,
    });
    await banner.save();
    return SuccessHandler("Banner created successfully", 201, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getBanners = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    const banners = await Banner.find();
    return SuccessHandler(banners, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const deleteBanner = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    await Banner.findByIdAndDelete(req.params.id);
    return SuccessHandler("Banner deleted successfully", 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getWallets = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    if (!req.query.role) return ErrorHandler("Role is required", 400, req, res);
    const searchFilter = req.query.search
      ? {
          $or: [
            { "user.name": { $regex: req.query.search, $options: "i" } },
            { "user.email": { $regex: req.query.search, $options: "i" } },
          ],
        }
      : {};
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = req.query.page ? (page - 1) * limit : 0;
    console.log("skip", skip, limit);
    const wallets = await Wallet.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $match: {
          "user.role": req.query.role,
          ...searchFilter,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: 10,
      },
      {
        $unwind: "$transactions",
      },
      {
        $lookup: {
          from: "jobs",
          localField: "transactions.job",
          foreignField: "_id",
          as: "transactions.job",
        },
      },
      {
        $unwind: {
          path: "$transactions.job",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "transactions.paidBy",
          foreignField: "_id",
          as: "transactions.paidBy",
        },
      },
      {
        $unwind: {
          path: "$transactions.paidBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "transactions.paidTo",
          foreignField: "_id",
          as: "transactions.paidTo",
        },
      },
      {
        $unwind: {
          path: "$transactions.paidTo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$_id",
          user: { $first: "$user" },
          balance: { $first: "$balance" },
          transactions: { $push: "$transactions" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$updatedAt" },
        },
      },
      {
        $project: {
          user: 1,
          balance: 1,
          transactions: 1,
          createdAt: 1,
          updatedAt: 1,
          key: "$_id",
        },
      },
    ]);
    const totalWalletCount = await Wallet.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $match: {
          "user.role": req.query.role,
          ...searchFilter,
        },
      },
      {
        $count: "total",
      },
    ]);

    return SuccessHandler(
      {
        wallets,
        totalWalletCount: totalWalletCount[0]?.total || 0,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const generalStats = async (req, res) => {
  // #swagger.tags = ['admin']
  try {
    const totalJobs = await Job.countDocuments();
    const totalWorkers = await User.countDocuments({
      role: "worker",
      adminApproval: "approved",
    });
    const totalClients = await User.countDocuments({ role: "client" });
    return SuccessHandler(
      {
        totalJobs,
        totalWorkers,
        totalClients,
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
  jobStats,
  generalStats,
  createBanner,
  getBanners,
  deleteBanner,
  getWallets,
};
