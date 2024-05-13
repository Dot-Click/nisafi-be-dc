const jwt = require("jsonwebtoken");
const User = require("../models/User/user");
const dotenv = require("dotenv");

dotenv.config({ path: ".././src/config/config.env" });

const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    console.log(token);
    if (!token) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded._id);
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized as an admin" });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const isWorker = async (req, res, next) => {
  try {
    if (req.user.role !== "worker") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized as a worker" });
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

const isClient = async (req, res, next) => {
  try {
    if (req.user.role !== "client") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized as a client" });
    }
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {isAuthenticated, isAdmin, isWorker, isClient};
