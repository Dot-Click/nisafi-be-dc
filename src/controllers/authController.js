const User = require("../models/User/user");
const sendMail = require("../utils/sendMail");
const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const {
  uploadFilesOnAWS,
  deleteImageFromAWS,
} = require("../utils/saveToServer");
const path = require("path");
const fs = require("fs");
const {
  sendNotification,
  sendAdminNotification,
} = require("../utils/sendNotification");
const Job = require("../models/Job/job");
const { default: mongoose } = require("mongoose");
const Review = require("../models/Job/review");
const bcrypt = require("bcryptjs");
const Wallet = require("../models/User/workerWallet");
const { createPayout } = require("../functions/paypal");
//register
const register = async (req, res) => {
  // #swagger.tags = ['auth']
  try {
    const { name, email, phone, password, role } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      return ErrorHandler("User already exists", 400, req, res);
    }
    const newUser = await User.create({
      name,
      email,
      password,
      role,
      phone,
      adminApproval: "pending",
    });
    newUser.save();
    SuccessHandler("User created successfully", 200, res);
    if (req.body.deviceToken) {
      newUser.deviceToken = req.body.deviceToken;
      await newUser.save();
      await sendNotification(
        {
          _id: newUser._id,
          deviceToken: req.body.deviceToken,
        },
        "Welcome to the app",
        "register",
        "/home"
      );
    }

    const allAdmins = await User.find({ role: "admin" });
    Promise.all(
      allAdmins.map(
        async (admin) =>
          await sendAdminNotification(
            admin._id,
            `New ${newUser.role}, ${newUser.name} has registered`,
            "register",
            newUser.email,
            "New Registration"
          )
      )
    );

    // create wallet for user
    await Wallet.create({
      user: newUser._id,
      balance: 0,
      transactions: [],
    });
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

// const requestEmailToken = async (req, res) => {
//   // #swagger.tags = ['auth']

//   try {
//     const { email } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) {
//       return ErrorHandler("User does not exist", 400, req, res);
//     }
//     const emailVerificationToken = Math.floor(100000 + Math.random() * 900000);
//     const emailVerificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
//     user.emailVerificationToken = emailVerificationToken;
//     user.emailVerificationTokenExpires = emailVerificationTokenExpires;
//     await user.save();
//     const message = `Your email verification token is ${emailVerificationToken} and it expires in 10 minutes`;
//     const subject = `Email verification token`;
//     await sendMail(email, subject, message);
//     return SuccessHandler(
//       `Email verification token sent to ${email}`,
//       200,
//       res
//     );
//   } catch (error) {
//     return ErrorHandler(error.message, 500, req, res);
//   }
// };

// //verify email token
// const verifyEmail = async (req, res) => {
//   // #swagger.tags = ['auth']

//   try {
//     const { email, emailVerificationToken } = req.body;
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         message: "User does not exist",
//       });
//     }
//     if (
//       user.emailVerificationToken !== emailVerificationToken ||
//       user.emailVerificationTokenExpires < Date.now()
//     ) {
//       return ErrorHandler("Invalid token", 400, req, res);
//     }
//     user.emailVerified = true;
//     user.emailVerificationToken = null;
//     user.emailVerificationTokenExpires = null;
//     jwtToken = user.getJWTToken();
//     await user.save();
//     return SuccessHandler("Email verified successfully", 200, res);
//   } catch (error) {
//     return ErrorHandler(error.message, 500, req, res);
//   }
// };

//login
const login = async (req, res) => {
  // #swagger.tags = ['auth']

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return ErrorHandler("User does not exist", 400, req, res);
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return ErrorHandler("Invalid credentials", 400, req, res);
    }
    // if (!user.emailVerified) {
    //   return ErrorHandler("Email not verified", 400, req, res);
    // }
    jwtToken = user.getJWTToken();
    delete user.password;

    console.log(jwtToken);

    SuccessHandler(
      {
        message: "Logged in successfully",
        token: jwtToken,
        user: user.role === "worker" ? (user?.address ? user : null) : user,
      },
      200,
      res
    );

    if (req.body.deviceToken) {
      user.deviceToken = req.body.deviceToken;
      await user.save();
    }
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//logout
const logout = async (req, res) => {
  // #swagger.tags = ['auth']

  try {
    req.user = null;
    return SuccessHandler("Logged out successfully", 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//forgot password
const forgotPassword = async (req, res) => {
  // #swagger.tags = ['auth']

  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return ErrorHandler("User does not exist", 400, req, res);
    }
    const passwordResetToken = Math.floor(100000 + Math.random() * 900000);
    const passwordResetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.passwordResetToken = passwordResetToken;
    user.passwordResetTokenExpires = passwordResetTokenExpires;
    await user.save();
    console.log(passwordResetToken);
    const message = `Your password reset token is ${passwordResetToken} and it expires in 10 minutes`;
    const subject = `Password reset token`;
    await sendMail(email, subject, message);
    return SuccessHandler(`Password reset token sent to ${email}`, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//reset password
const resetPassword = async (req, res) => {
  // #swagger.tags = ['auth']

  try {
    const { email, passwordResetToken, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return ErrorHandler("User does not exist", 400, req, res);
    }
    if (
      user.passwordResetToken !== passwordResetToken ||
      user.passwordResetTokenExpires < Date.now()
    ) {
      return ErrorHandler("Invalid token", 400, req, res);
    }
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetTokenExpires = null;
    await user.save();
    return SuccessHandler("Password reset successfully", 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//update password
const updatePassword = async (req, res) => {
  // #swagger.tags = ['auth']

  try {
    const { currentPassword, newPassword } = req.body;
    // if (
    //   !newPassword.match(
    //     /(?=[A-Za-z0-9@#$%^&+!=]+$)^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@#$%^&+!=])(?=.{8,}).*$/
    //   )
    // ) {
    //   return ErrorHandler(
    //     "Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number and 1 special character",
    //     400,
    //     req,
    //     res
    //   );
    // }
    const user = await User.findById(req.user.id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return ErrorHandler("Invalid credentials", 400, req, res);
    }
    const samePasswords = await user.comparePassword(newPassword);
    if (samePasswords) {
      return ErrorHandler(
        "New password cannot be same as old password",
        400,
        req,
        res
      );
    }
    user.password = newPassword;
    await user.save();
    return SuccessHandler("Password updated successfully", 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//get me
const me = async (req, res) => {
  // #swagger.tags = ['auth']
  try {
    let response = req.user;
    if (req.user.role === "worker") {
      // successRate = percentage of jobs completed successfully out of total jobs
      // ratings = average rating of the worker

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

      response = {
        ...req.user._doc,
        successRate: successRate[0]?.successRate || 0,
        rating: avgRating[0]?.avgRating || 0,
      };

      console.log(response);
    }
    return SuccessHandler(response, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//update me
const updateMe = async (req, res) => {
  // #swagger.tags = ['auth']
  try {
    // const {
    //   name,
    //   phone,
    //   address,
    //   address2,
    //   profession,
    //   idNumber,
    //   certificate,
    //   skills,
    //   experience,
    //   qualification,
    //   aboutMe,
    // } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return ErrorHandler("User does not exist", 400, req, res);
    }
    // images array upload to aws or cloudinary
    // const { image, idDocs } = req.files;

    if (req?.files?.image) {
      const image = req.files.image;
      const imageUrl = await uploadFilesOnAWS([image]);
      console.log(imageUrl);
      if (user.profilePic) {
        const filePath = path.join(__dirname, `../../${user.profilePic}`);
        // fs.unlinkSync(filePath);
      }
      user.profilePic = imageUrl[0];
    }
    console.log(req?.files);
    let idDocsUrl = [];
    if (req?.files?.idDocs) {
      const idDocs =
        req.files.idDocs.length > 1 ? req.files.idDocs : [req.files.idDocs];
      idDocsUrl = await uploadFilesOnAWS(idDocs);
      console.log(idDocsUrl);
      user.idDocs = idDocsUrl;
    }

    if (req.body.password) {
      if (!req.body.oldPassword) {
        return ErrorHandler("Please provide old password", 400, req, res);
      }
      console.log(req.body.oldPassword, req.body.password);
      const confirm = await user.comparePassword(req.body.oldPassword);
      if (!confirm) {
        return ErrorHandler("Old password is incorrect", 400, req, res);
      }
      const isMatch = await user.comparePassword(req.body.password);
      if (isMatch) {
        return ErrorHandler(
          "New password cannot be same as old password",
          400,
          req,
          res
        );
      }
      // const salt = await bcrypt.genSalt(10);
      user.password = req.body.password;
    }

    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;
    user.address = req.body.address || user.address;
    user.address2 = req.body.address2 || user.address2;
    user.profession = req.body.profession || user.profession;
    user.idNumber = req.body.idNumber || user.idNumber;
    user.certificate = req.body.certificate || user.certificate;
    user.skills = req.body.skills || user.skills;
    user.experience = req.body.experience || user.experience;
    user.qualification = req.body.qualification || user.qualification;
    user.aboutMe = req.body.aboutMe || user.aboutMe;

    await user.save();

    console.log(user);
    SuccessHandler(
      {
        message: "User updated successfully",
        user,
      },
      200,
      res
    );

    if (idDocsUrl.length) {
      const allAdmins = await User.find({ role: "admin" });
      Promise.all(
        allAdmins.map(
          async (admin) =>
            await sendAdminNotification(
              admin._id,
              `${user.role} ${user.name} has uploaded their documents.`,
              "idDocs",
              user._id,
              "Documents Uploaded"
            )
        )
      );
    }
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getWorkerById = async (req, res) => {
  // #swagger.tags = ['auth']
  try {
    const worker = await User.findById(req.params.id);
    if (!worker) {
      return ErrorHandler("Worker not found", 400, req, res);
    }

    const successRate = await Job.aggregate([
      {
        $match: {
          worker: mongoose.Types.ObjectId(worker.id),
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
                $multiply: [{ $divide: ["$completedJobs", "$totalJobs"] }, 100],
              },
            ],
          },
        },
      },
    ]);

    const avgRating = await Review.aggregate([
      {
        $match: {
          worker: mongoose.Types.ObjectId(worker.id),
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
        },
      },
    ]);
    return SuccessHandler(
      {
        ...worker._doc,
        successRate: successRate[0]?.successRate || 0,
        rating: avgRating[0]?.avgRating || 0,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getWallet = async (req, res) => {
  // #swagger.tags = ['auth']
  try {
    const wallet = await Wallet.findOne({ user: req.user._id }).populate({
      path: "transactions.paidBy transactions.paidTo transactions.job",
    });
    if (!wallet) {
      return ErrorHandler("Wallet not found", 400, req, res);
    }
    return SuccessHandler(wallet, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const withdraw = async (req, res) => {
  // #swagger.tags = ['auth']
  try {
    const { amount, email } = req.body;
    const user = await User.findById(req.user._id);
    if (user?.withdrawal) {
      return ErrorHandler(
        "You have already requested for withdrawal",
        400,
        req,
        res
      );
    }

    user.withdrawal = true;
    await user.save();

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      user.withdrawal = false;
      await user.save();
      return ErrorHandler("Wallet not found", 400, req, res);
    }

    if (wallet.balance < amount) {
      user.withdrawal = false;
      await user.save();
      return ErrorHandler("Insufficient balance", 400, req, res);
    }

    const status = await createPayout({
      email,
      amount,
      id: user._id,
      job: null,
    });

    if (status) {
      const transaction = {
        amount,
        type: "debit",
        paidBy: req.user._id,
        paidTo: req.user._id,
        job: null,
      };
      wallet.transactions.push(transaction);
      wallet.balance -= amount;
      await wallet.save();
      user.withdrawal = false;
      await user.save();
      return SuccessHandler("Withdrawal successful", 200, res);
    } else {
      console.log(status);
      user.withdrawal = false;
      await user.save();
      return ErrorHandler("Failed to withdraw", 400, req, res);
    }
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

module.exports = {
  register,
  // requestEmailToken,
  // verifyEmail,
  login,
  logout,
  forgotPassword,
  resetPassword,
  updatePassword,
  me,
  updateMe,
  getWorkerById,
  getWallet,
  withdraw,
};
