const mongoose = require("mongoose");
const schema = mongoose.Schema;

const reviewSchema = new schema(
  {
    job: {
      type: schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    user: {
      type: schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    worker: {
      type: schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
    },
    review: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
    },
  },
  { timestamps: true }
);

const Review = mongoose.model("Review", reviewSchema);
module.exports = Review;
