const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const Job = require("../models/Job/job");
const User = require("../models/User/user");
const Proposal = require("../models/Job/proposal");
const { default: mongoose } = require("mongoose");
const sendMail = require("../utils/sendMail");
const ProofOfWork = require("../models/Job/proofOfWork");

const createJob = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { type, date, timeDuration, location, description, budget, tags } =
      req.body;

    // if (req.user.adminApproval === false) {
    //   return ErrorHandler("User has not been approved by admin", 400, req, res);
    // }

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
    } else if (req.query?.status === "propsalSubmitted") {
      // get all jobs where worker has submitted a proposal
      const proposals = await Proposal.find({ user: req.user._id });
      const jobIds = proposals.map((proposal) => proposal.job);
      jobs = await Job.aggregate([
        {
          $match: {
            _id: { $in: jobIds },
            ...searchFilter,
          },
        },
        {
          $lookup: {
            from: "proposals",
            localField: "_id",
            foreignField: "job",
            as: "proposals",
          },
        },
        {
          $project: {
            type: 1,
            date: 1,
            timeDuration: 1,
            location: 1,
            description: 1,
            budget: 1,
            tags: 1,
            user: 1,
            status: 1,
            worker: 1,
            proposals: {
              $filter: {
                input: "$proposals",
                as: "proposal",
                cond: {
                  $eq: [
                    "$$proposal.user",
                    mongoose.Types.ObjectId(req.user._id),
                  ],
                },
              },
            },
          },
        },
      ]);
    } else {
      jobs = await Job.find({
        worker: req.user._id,
        status: req.query.status,
        ...searchFilter,
      }).sort({ createdAt: -1 });
    }

    return SuccessHandler(jobs, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const submitProposal = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    if (!req.user?.adminApproval) {
      return ErrorHandler("User has not been approved by admin", 400, req, res);
    }
    const job = await Job.findById(req.params.id);
    if (!job) {
      return ErrorHandler("Job does not exist", 400, req, res);
    }

    if (job.status !== "open") {
      return ErrorHandler("Job is not open for proposals", 400, req, res);
    }

    const { coverLetter, budget, acknowledged } = req.body;

    const proposal = await Proposal.create({
      user: req.user._id,
      job: job._id,
      coverLetter,
      budget,
      acknowledged,
    });
    await proposal.save();

    job?.proposals
      ? job.proposals.push(proposal._id)
      : (job.proposals = [proposal._id]);

    await job.save();

    return SuccessHandler(
      {
        message: "Proposal submitted successfully",
        proposal,
      },
      201,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const acceptProposal = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { laundryPickupTime, proposalId, jobId } = req.body;

    const job = await Job.findById(jobId);

    if (!job) {
      return ErrorHandler("Job does not exist", 400, req, res);
    }

    if (job.status !== "open") {
      return ErrorHandler("Job is not open for proposals", 400, req, res);
    }

    const proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      return ErrorHandler("Proposal does not exist", 400, req, res);
    }

    if (proposal.job.toString() !== job._id.toString()) {
      return ErrorHandler(
        "Proposal does not belong to this job",
        400,
        req,
        res
      );
    }

    job.status = "in-progress";
    job.worker = proposal.user;
    job.laundryPickupTime = laundryPickupTime;

    await job.save();

    return SuccessHandler(
      {
        message: "Proposal accepted successfully",
        job,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const deliverWork = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { description, jobId } = req.body;
    const job = await Job.findById(jobId);

    if (!job) {
      return ErrorHandler("Job does not exist", 400, req, res);
    }

    if (job.status !== "in-progress") {
      return ErrorHandler("Job is not in progress", 400, req, res);
    }

    // upload images to aws or cloudinary

    const proofOfWork = await ProofOfWork.create({
      job: job._id,
      worker: job.worker,
      images: [],
      description,
    });
    await proofOfWork.save();

    job.status = "paymentRequested";
    job.proofOfWork = proofOfWork._id;
    await job.save();

    return SuccessHandler(
      {
        message: "Work Delivered",
        job,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};



module.exports = {
  createJob,
  getAllJobsClient,
  getAllJobsWorker,
  submitProposal,
  acceptProposal,
  deliverWork,
};
