const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const Job = require("../models/Job/job");
const User = require("../models/User/user");

const createJob = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { type, date, timeDuration, location, description, budget, tags } =
      req.body;

    if (req.user.adminApproval === false) {
      return ErrorHandler("User has not been approved by admin", 400, req, res);
    }

    const { images } = req.files;

    if (!images) {
      return ErrorHandler("Please upload images", 400, req, res);
    }

    // images array upload to aws or cloudinary

    const job = await Job.create({
      type,
      date,
      timeDuration,
      location,
      description,
      budget,
      tags,
      user: req.user._id,
    });

    await job.save();

    return SuccessHandler(
      {
        message: "Job created successfully",
        job,
      },
      201,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getAllJobsClient = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const statusFilter = req.query.status ? { status: req.query.status } : {};
    const searchFilter = req.query.search
      ? {
          $or: [
            { type: { $regex: req.query.search, $options: "i" } },
            { description: { $regex: req.query.search, $options: "i" } },
            { tags: { $regex: req.query.search, $options: "i" } },
          ],
        }
      : {};

    const jobs = await Job.find({
      user: req.user._id,
      ...statusFilter,
      ...searchFilter,
    }).sort({ createdAt: -1 });

    return SuccessHandler(jobs, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getAllJobsWorker = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const searchFilter = req.query.search
      ? {
          $or: [
            { type: { $regex: req.query.search, $options: "i" } },
            { description: { $regex: req.query.search, $options: "i" } },
            { tags: { $regex: req.query.search, $options: "i" } },
          ],
        }
      : {};

    let jobs;

    if (!req.query?.status || req.query?.status === "recent") {
      jobs = await Job.find({
        status: "open",
        ...searchFilter,
      }).sort({ createdAt: -1 });
    }

    if (req.query?.status === "propsalSubmitted") {
      // get all jobs where worker has submitted a proposal
    }

    if (req.query?.status === "completed") {
      // get all jobs where worker has been hired
    }

    if (req.query?.status === "cancelled") {
      // get all jobs where worker has been cancelled
    }
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

module.exports = {
  createJob,
  getAllJobsClient,
  getAllJobsWorker,
};
