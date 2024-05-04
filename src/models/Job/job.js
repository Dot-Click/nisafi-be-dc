const mongoose = require("mongoose");
const user = require("../User/user");
const { assign } = require("nodemailer/lib/shared");
const Schema = mongoose.Schema;

const jobSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    timeDuration: {
      type: Number,
      required: true,
    },
    location: {
      string: {
        type: String,
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    description: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
    },
    budget: {
      type: Number,
      required: true,
    },
    tags: {
      type: [String],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    status: {
      type: String,
      enum: [
        "open",
        "in-progress",
        "paymentRequested",
        "completed",
        "cancelled",
        "disputed",
      ],
      default: "open",
    },
    worker: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    proposals: [
      {
        type: Schema.Types.ObjectId,
        ref: "proposal",
      },
    ],
    laundryPickupTime: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Job = mongoose.model("job", jobSchema);
module.exports = Job;
