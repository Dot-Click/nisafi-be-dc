const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const proofOfWorkSchema = new Schema(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: "job",
    },
    worker: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    images: {
      type: [String],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    // status: {
    //     type: String,
    //     enum: ["pending", "approved", "rejected"],
    //     default: "pending",
    // },
  },
  {
    timestamps: true,
  }
);

const ProofOfWork = mongoose.model("proofOfWork", proofOfWorkSchema);
module.exports = ProofOfWork;
