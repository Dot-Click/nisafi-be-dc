const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const Job = require("../models/Job/job");
const User = require("../models/User/user");
const Proposal = require("../models/Job/proposal");
const { default: mongoose } = require("mongoose");
const sendMail = require("../utils/sendMail");
const ProofOfWork = require("../models/Job/proofOfWork");
const Review = require("../models/Job/review");
const {
  uploadFilesOnAWS,
  deleteImageFromAWS,
} = require("../utils/saveToServer");
const Wallet = require("../models/User/workerWallet");
const {
  sendNotification,
  sendAdminNotification,
} = require("../utils/sendNotification");
const { createPayout } = require("../functions/paypal");

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
    console.log("images", images);
    // images array upload to aws or cloudinary

    const imageUrls = await uploadFilesOnAWS(images);

    console.log("imageUrls", imageUrls);

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

    SuccessHandler(
      {
        message: "Job created successfully",
        job,
      },
      201,
      res
    );

    const allWorkers = await User.find({
      role: "worker",
      adminApproval: "approved",
    });
    // const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allWorkers.map(async (worker) => {
        worker.deviceToken &&
          (await sendNotification(
            {
              _id: worker._id,
              deviceToken: worker.deviceToken,
            },
            `New job for ${req.body.type} posted by ${req.user.name}`,
            "job",
            "/job/" + job._id
          ));
      })
    );
    // admin notification
    const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allAdmins.map(async (admin) => {
        await sendAdminNotification(
          admin._id,
          `New job for ${req.body.type} posted by ${req.user.name}`,
          "job",
          job._id,
          "New Job Posted"
        );
      })
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
    const sort = req.query.sort === "old" ? 1 : -1;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    let jobs;
    if (
      req.query.status === "completed" ||
      req.query.status === "in-progress" ||
      req.query.status === "disputed"
    ) {
      jobs = await Job.find({
        user: req.user._id,
        ...statusFilter,
        ...searchFilter,
      })
        .sort({ createdAt: sort })
        .populate("review proofOfWork worker proposals")
        .skip(skip)
        .limit(limit);
    } else {
      jobs = await Job.find({
        user: req.user._id,
        ...statusFilter,
        ...searchFilter,
      })
        .sort({ createdAt: sort })
        .populate("review proofOfWork worker")
        .skip(skip)
        .limit(limit);
    }
    // .populate({
    //   path: "proposals",
    //   populate: {
    //     path: "user",
    //     select: "firstName lastName email profilePic",
    //   },
    // });

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    let jobs;

    if (!req.query?.status || req.query?.status === "recent") {
      jobs = await Job.find({
        status: "open",
        ...searchFilter,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
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
            createdAt: 1,
            updatedAt: 1,
            laundryPickupTime: 1,
            serviceTime: 1,
          },
        },
        {
          $unwind: "$proposals", // Unwind the proposals array to sort based on the createdAt field
        },
        {
          $sort: { "proposals.createdAt": -1 }, // Sort by proposals.createdAt field in descending order
        },
        {
          $group: {
            _id: "$_id",
            type: { $first: "$type" },
            date: { $first: "$date" },
            timeDuration: { $first: "$timeDuration" },
            location: { $first: "$location" },
            description: { $first: "$description" },
            budget: { $first: "$budget" },
            tags: { $first: "$tags" },
            user: { $first: "$user" },
            status: { $first: "$status" },
            worker: { $first: "$worker" },
            proposals: { $push: "$proposals" },
            createdAt: { $first: "$createdAt" },
            updatedAt: { $first: "$updatedAt" },
            laundryPickupTime: { $first: "$laundryPickupTime" },
            serviceTime: { $first: "$serviceTime" },
          },
        },
        // pagination
        {
          $skip: skip,
        },
        {
          $limit: limit,
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
        // {
        //   $unwind: "$proposals",
        // },
        {
          $lookup: {
            from: "reviews",
            localField: "review",
            foreignField: "_id",
            as: "reviews",
          },
        },
        {
          $unwind: "$reviews",
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
            createdAt: 1,
            updatedAt: 1,
            laundryPickupTime: 1,
            serviceTime: 1,
            reviews: 1,
          },
        },
        // pagination
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);
    } else {
      jobs = await Job.find({
        worker: req.user._id,
        status: req.query.status,
        ...searchFilter,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    return SuccessHandler(jobs, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const submitProposal = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    if (req.user?.adminApproval !== "approved") {
      return ErrorHandler("User has not been approved by admin", 400, req, res);
    }
    const job = await Job.findById(req.params.id).populate("user");
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

    SuccessHandler(
      {
        message: "Proposal submitted successfully",
        proposal,
      },
      201,
      res
    );

    if (job?.user?.deviceToken) {
      await sendNotification(
        {
          _id: job.user._id,
          deviceToken: job.user.deviceToken,
        },
        `${req.user.name} submitted a proposal for ${job.type}`,
        "proposal",
        "/job/" + job._id
      );
    }
    const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allAdmins.map(async (admin) => {
        await sendAdminNotification(
          admin._id,
          `New proposal for ${job.type} posted by ${req.user.name}`,
          "job",
          job._id,
          "New Proposal Submitted"
        );
      })
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const acceptProposal = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { proposalId, jobId } = req.body;

    const job = await Job.findById(jobId);

    if (!job) {
      return ErrorHandler("Job does not exist", 400, req, res);
    }

    if (job.status !== "open") {
      return ErrorHandler("Job is not open for proposals", 400, req, res);
    }

    const proposal = await Proposal.findById(proposalId).populate("user");

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

    // charge user for accepting proposal
    const transaction = {
      amount: proposal.budget,
      type: "credit",
      // paidTo: proposal.user,
      paidBy: job.user,
      job: job._id,
      escrow: true,
    };

    const wallet = await Wallet.findOne({ user: job.user });
    wallet.transactions.push(transaction);
    wallet.balance += transaction.amount;
    await wallet.save();
    job.status = "in-progress";
    job.worker = proposal.user;
    // job.laundryPickupTime = laundryPickupTime;

    await job.save();

    SuccessHandler(
      {
        message: "Proposal accepted successfully",
        job,
      },
      200,
      res
    );

    if (proposal.user.deviceToken) {
      await sendNotification(
        {
          _id: proposal.user._id,
          deviceToken: proposal.user.deviceToken,
        },
        `Proposal for ${job.type} accepted by ${job.user.name} and the job is in progress`,
        "job",
        "/job/" + job._id
      );
    }

    const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allAdmins.map(async (admin) => {
        await sendAdminNotification(
          admin._id,
          `Proposal for ${job.type} accepted by ${job.user.name} and the job is in progress`,
          "job",
          job._id,
          "Proposal Accepted"
        );
      })
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const deliverWork = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { description, jobId } = req.body;
    const job = await Job.findById(jobId).populate("user");

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

    const imageUrls = await uploadFilesOnAWS(images);

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

    SuccessHandler(
      {
        message: "Work Delivered",
        job,
      },
      200,
      res
    );
    const worker = await User.findById(job.worker);
    if (job?.user?.deviceToken) {
      await sendNotification(
        {
          _id: job.user._id,
          deviceToken: job.user.deviceToken,
        },
        `Work delivered by ${worker.name} for ${job.type} and payment has been requested`,
        "job",
        "/job/" + job._id
      );
    }

    const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allAdmins.map(async (admin) => {
        await sendAdminNotification(
          admin._id,
          `Work delivered by ${worker.name} for ${job.type} and payment has been requested`,
          "job",
          job._id,
          "Work Delivered"
        );
      })
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const markAsCompleted = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { id } = req.params;
    const job = await Job.findById(id).populate("user");
    const proposal = await Proposal.findOne({
      job: id,
      user: job.worker,
    }).populate("user");

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

    const userWallet = await Wallet.findOne({ user: job.user });
    const workerWallet = await Wallet.findOne({ user: job.worker });

    const userTransaction = {
      amount: proposal.budget,
      type: "debit",
      paidTo: job.worker,
      job: job._id,
      paidBy: job.user,
    };

    const workerTransaction = {
      amount: proposal.budget,
      type: "credit",
      paidBy: job.user,
      job: job._id,
    };

    userWallet.transactions.push(userTransaction);
    userWallet.balance -= userTransaction.amount;

    workerWallet.transactions.push(workerTransaction);
    workerWallet.balance += workerTransaction.amount;

    await userWallet.save();
    await workerWallet.save();

    job.status = "completed";
    await job.save();

    SuccessHandler(
      {
        message: "Job marked as completed",
        job,
      },
      200,
      res
    );

    if (proposal.user.deviceToken) {
      await sendNotification(
        {
          _id: proposal.user._id,
          deviceToken: proposal.user.deviceToken,
        },
        `Payment of ${proposal.budget} released to you for ${job.type}`,
        "job",
        "/job/" + job._id
      );
    }
    if (job?.user?.deviceToken) {
      await sendNotification(
        {
          _id: job.user._id,
          deviceToken: job.user.deviceToken,
        },
        proposal.budget + " released to worker",
        "job",
        "/job/" + job._id
      );
    }

    const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allAdmins.map(async (admin) => {
        await sendAdminNotification(
          admin._id,
          `${proposal.budget} released to ${job.worker.name} for ${job.type}`,
          "job",
          job._id,
          "Job Completed"
        );
      })
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const createDispute = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { description, jobId, paypalEmail } = req.body;
    const { proofOfWork } = req.files;

    if (!proofOfWork) {
      return ErrorHandler("Please upload proof of work", 400, req, res);
    }

    const job = await Job.findById(jobId).populate("worker");

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

    const proofOfWorkUrl = await uploadFilesOnAWS(proofOfWork);

    job.disputedDetails = {
      description,
      proofOfWork: proofOfWorkUrl,
      paypalEmail,
    };

    job.status = "disputed";

    await job.save();

    SuccessHandler(
      {
        message: "Dispute created",
        job,
      },
      200,
      res
    );

    if (job.worker.deviceToken) {
      await sendNotification(
        {
          _id: job.worker._id,
          deviceToken: job.worker.deviceToken,
        },
        `Dispute created by ${job.user.name} for ${job.type}`,
        "job",
        "/job/" + job._id
      );
    }

    const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allAdmins.map(async (admin) => {
        await sendAdminNotification(
          admin._id,
          `Dispute created by ${job.user.name} for ${job.type}`,
          "job",
          job._id,
          "Dispute Created"
        );
      })
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const submitReview = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { rating, review, jobId } = req.body;
    const job = await Job.findById(jobId).populate("worker");

    if (!job) {
      return ErrorHandler("Job does not exist", 400, req, res);
    }

    if (job.status !== "completed") {
      return ErrorHandler("Job is not completed", 400, req, res);
    }

    console.log(req.files);

    const { images } = req.files;
    const imageUrls = await uploadFilesOnAWS(images);

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

    SuccessHandler(
      {
        message: "Review submitted successfully",
        review: review2,
      },
      201,
      res
    );

    if (job.worker.deviceToken) {
      await sendNotification(
        {
          _id: job.worker._id,
          deviceToken: job.worker.deviceToken,
        },
        "New review received for " + job.type + " by " + job.user.name,
        "job",
        "/job/" + job._id
      );
    }

    const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allAdmins.map(async (admin) => {
        await sendAdminNotification(
          admin._id,
          `New review submitted by ${job.user.name} for ${job.type}`,
          "job",
          job._id,
          "Review Submitted"
        );
      })
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
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
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
      },
    ]);

    return SuccessHandler(proposals, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const resolveDispute = async (req, res) => {
  // #swagger.tags = ['job']
  try {
    const { jobId, resolution } = req.body;
    const job = await Job.findById(jobId).populate("user");
    const proposal = await Proposal.findOne({
      job: jobId,
      user: job.worker,
    }).populate("user");
    const userWallet = await Wallet.findOne({ user: job.user });
    const workerWallet = await Wallet.findOne({ user: job.worker });
    if (resolution === "release") {
      const userTransaction = {
        amount: proposal.budget,
        type: "debit",
        paidTo: job.worker,
        job: job._id,
        paidBy: job.user,
      };

      const workerTransaction = {
        amount: proposal.budget,
        type: "credit",
        paidBy: job.user,
        job: job._id,
      };

      userWallet.transactions.push(userTransaction);
      userWallet.balance -= userTransaction.amount;

      workerWallet.transactions.push(workerTransaction);
      workerWallet.balance += workerTransaction.amount;

      await userWallet.save();
      await workerWallet.save();
    } else if (resolution === "refund") {
      // refund the user

      const status = createPayout({
        email: job.disputedDetails.paypalEmail,
        amount: proposal.budget,
        id: job._id,
      });

      if (!status) {
        return ErrorHandler("Payment failed", 400, req, res);
      }
      const userTransaction = {
        amount: proposal.budget,
        type: "debit",
        paidBy: job.user,
        job: job._id,
      };

      userWallet.transactions.push(userTransaction);
      userWallet.balance -= userTransaction.amount;
      await userWallet.save();
    }
    job.status = resolution === "release" ? "completed" : "cancelled";
    await job.save();
    SuccessHandler(
      {
        message: "Dispute resolved by " + resolution,
        job,
      },
      200,
      res
    );
    if (job.user.deviceToken) {
      await sendNotification(
        {
          _id: job.user._id,
          deviceToken: job.user.deviceToken,
        },
        "Dispute resolved by " + resolution + " for " + job.type,
        "job",
        "/job/" + job._id
      );
    }
    if (proposal.user.deviceToken) {
      await sendNotification(
        {
          _id: proposal.user._id,
          deviceToken: proposal.user.deviceToken,
        },
        "Dispute resolved by " + resolution,
        "job",
        "/job/" + job._id
      );
    }
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
  resolveDispute,
};
