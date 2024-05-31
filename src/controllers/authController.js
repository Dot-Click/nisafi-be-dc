const User = require("../models/User/user");
const sendMail = require("../utils/sendMail");
const SuccessHandler = require("../utils/SuccessHandler");
const ErrorHandler = require("../utils/ErrorHandler");
const saveToServer = require("../utils/saveToServer");
const path = require("path");
const fs = require("fs");
const sendNotification = require("../utils/sendNotification");
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
      // phone,
    });
    newUser.save();
    return SuccessHandler("User created successfully", 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

// request email verification token
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
      await sendNotification(
        {
          _id: user._id,
          deviceToken: req.body.deviceToken,
        },
        "Welcome to the app",
        "login",
        "/home"
      );
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
    return SuccessHandler(req.user, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

//update me
const updateMe = async (req, res) => {
  // #swagger.tags = ['auth']
  try {
    const {
      name,
      phone,
      address,
      address2,
      profession,
      idNumber,
      certificate,
      skills,
      experience,
      qualification,
      aboutMe,
    } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return ErrorHandler("User does not exist", 400, req, res);
    }
    // images array upload to aws or cloudinary
    const { image, idDocs } = req.files;

    if (image) {
      const image = req.files.image;
      const imageUrl = await saveToServer([image]);
      if (user.profilePic) {
        const filePath = path.join(__dirname, `../../${user.profilePic}`);
        fs.unlinkSync(filePath);
      }
      user.profilePic = imageUrl[0];
    }

    if (idDocs && idDocs.length > 0) {
      const idDocs = req.files.idDocs;
      const idDocsUrl = await saveToServer(idDocs);
      user.idDocs = idDocsUrl;
    }

    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.address = address || user.address;
    user.address2 = address2 || user.address2;
    user.profession = profession || user.profession;
    user.idNumber = idNumber || user.idNumber;
    user.certificate = certificate || user.certificate;
    user.skills = skills || user.skills;
    user.experience = experience || user.experience;
    user.qualification = qualification || user.qualification;
    user.aboutMe = aboutMe || user.aboutMe;
    await user.save();
    return SuccessHandler("User updated successfully", 200, res);
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
};
