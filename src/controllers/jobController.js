const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const Job = require("../models/Job/job");
const User = require("../models/User/user");
const Proposal = require("../models/Job/proposal");
const { default: mongoose } = require("mongoose");
const sendMail = require("../utils/sendMail");
const ProofOfWork = require("../models/Job/proofOfWork");
const Review = require("../models/Job/review");
const saveToServer = require("../utils/saveToServer");

const createJob = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const {
      type,
      date,
      timeDuration,
      location,
      description,
      budget,
      tags,
      serviceTime,
      laundryPickupTime,
    } = req.body;

    // if (req.user.adminApproval === false) {
    //   return ErrorHandler("User has not been approved by admin", 400, req, res);
    // }

    console.log(req.files);
    const { images } = req.files;

    if (!images) {
      return ErrorHandler("Please upload images", 400, req, res);
    }
    if (images.length > 5) {
      return ErrorHandler(
        "You can only upload a maximum of 5 images",
        400,
        req,
        res
      );
    }

    // images array upload to aws or cloudinary

    const imageUrls = await saveToServer(images);

    const job = await Job.create({
      type,
      date,
      timeDuration,
      location: JSON.parse(location),
      description,
      budget,
      tags,
      images: imageUrls,
      laundryPickupTime,
      user: req.user._id,
      serviceTime,
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
    let jobs;
    if (req.query.status === "completed") {
      jobs = await Job.find({
        user: req.user._id,
        ...statusFilter,
        ...searchFilter,
      })
        .sort({ createdAt: -1 })
        .populate("Review proofOfWork worker proposals");
    } else {
      jobs = await Job.find({
        user: req.user._id,
        ...statusFilter,
        ...searchFilter,
      })
        .sort({ createdAt: -1 })
        .populate("Review proofOfWork worker");
    }
    // .populate({
    //   path: "proposals",
    //   populate: {
    //     path: "user",
    //     select: "firstName lastName email profilePic",
    //   },
    // });
    console.log("jobs", jobs);
    console.log("user", req.user._id);
    console.log("status", req.query.status);
    console.log("search", req.query.search);

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
    } else if (req.query?.status === "proposalSubmitted") {
      // get all jobs where worker has submitted a proposal
      const proposals = await Proposal.find({ user: req.user._id });
      const jobIds = proposals.map((proposal) => proposal.job);
      console.log(jobIds);
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
    } else if (req.query?.status === "completed") {
      jobs = await Job.aggregate([
        {
          $match: {
            worker: mongoose.Types.ObjectId(req.user._id),
            status: "completed",
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
          $unwind: "$proposals",
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

    const exProposal = await Proposal.findOne({
      user: req.user._id,
      job: job._id,
    });

    if (exProposal) {
      return ErrorHandler(
        "You have already submitted a proposal",
        400,
        req,
        res
      );
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
    const { images } = req.files;
    if (!images) {
      return ErrorHandler("Please upload images", 400, req, res);
    }
    if (images.length > 5) {
      return ErrorHandler(
        "You can only upload a maximum of 5 images",
        400,
        req,
        res
      );
    }

    const imageUrls = await saveToServer(images);

    const proofOfWork = await ProofOfWork.create({
      job: job._id,
      worker: job.worker,
      images: imageUrls,
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

const markAsCompleted = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      return ErrorHandler("Job does not exist", 400, req, res);
    }

    if (job.status !== "paymentRequested") {
      return ErrorHandler(
        "Worker has not delivered the work yet",
        400,
        req,
        res
      );
    }

    job.status = "completed";
    await job.save();

    return SuccessHandler(
      {
        message: "Job marked as completed",
        job,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const createDispute = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { description, jobId } = req.body;
    const { proofOfWork } = req.files;

    if (!proofOfWork) {
      return ErrorHandler("Please upload proof of work", 400, req, res);
    }

    const job = await Job.findById(jobId);

    if (!job) {
      return ErrorHandler("Job does not exist", 400, req, res);
    }

    if (job.status !== "paymentRequested") {
      return ErrorHandler(
        "Worker has not delivered the work yet",
        400,
        req,
        res
      );
    }

    const proofOfWorkUrl = await saveToServer(proofOfWork);

    job.disputedDetails = {
      description,
      proofOfWork: proofOfWorkUrl,
    };

    job.status = "disputed";

    await job.save();

    return SuccessHandler(
      {
        message: "Dispute created",
        job,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const submitReview = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { rating, review, jobId } = req.body;
    const job = await Job.findById(jobId);

    if (!job) {
      return ErrorHandler("Job does not exist", 400, req, res);
    }

    if (job.status !== "completed") {
      return ErrorHandler("Job is not completed", 400, req, res);
    }

    console.log(req.files)

    const { images } = req.files;
    const imageUrls = await saveToServer(images);

    const review2 = await Review.create({
      job: job._id,
      user: job.user,
      worker: job.worker,
      rating,
      review,
      images: imageUrls,
    });

    await review2.save();

    job.review = review2._id;
    await job.save();

    return SuccessHandler(
      {
        message: "Review submitted successfully",
        review: review2,
      },
      201,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const cancelJob = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return ErrorHandler("Job does not exist", 400, req, res);
    }
    if (job.status !== "open") {
      return ErrorHandler(
        "This job can not be cancelled as the status is not open",
        400,
        req,
        res
      );
    }

    job.status = "cancelled";
    await job.save();

    return SuccessHandler(
      {
        message: "Job cancelled successfully",
        job,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getProposalsByJobId = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const proposals = await Proposal.aggregate([
      {
        $match: { job: mongoose.Types.ObjectId(req.params.id) },
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
      // populate jobs matching the worker as user id and store in user.jobs
      {
        $lookup: {
          from: "jobs",
          localField: "user._id",
          foreignField: "worker",
          as: "user.jobs",
        },
      },
      {
        $lookup: {
          from: "reviews",
          localField: "user._id",
          foreignField: "worker",
          as: "user.reviews",
        },
      },
      {
        $project: {
          coverLetter: 1,
          budget: 1,
          acknowledged: 1,
          user: {
            _id: "$user._id",
            name: "$user.name",
            email: "$user.email",
            profilePic: "$user.profilePic",
            successRate: {
              $multiply: [
                {
                  $cond: [
                    { $eq: [{ $size: "$user.jobs" }, 0] },
                    0,
                    {
                      $divide: [
                        {
                          $size: {
                            $filter: {
                              input: "$user.jobs",
                              as: "job",
                              cond: { $eq: ["$$job.status", "completed"] },
                            },
                          },
                        },
                        {
                          $size: "$user.jobs",
                        },
                      ],
                    },
                  ],
                },
                100,
              ],
            },
            rating: {
              // $avg: "$user.reviews.rating",
              $cond: [
                { $eq: [{ $size: "$user.reviews" }, 0] },
                0,
                {
                  $divide: [
                    {
                      $sum: "$user.reviews.rating",
                    },
                    {
                      $size: "$user.reviews",
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    return SuccessHandler(proposals, 200, res);
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
  markAsCompleted,
  createDispute,
  submitReview,
  cancelJob,
  getProposalsByJobId,
};
