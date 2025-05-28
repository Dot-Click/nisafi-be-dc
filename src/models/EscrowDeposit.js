const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const escrowDepositSchema = new Schema(
  {
    transaction_id: {
      type: String,
      required: true,
      unique: true,
    },
    checkoutRequestId: {
      type: String,
      unique: true,
      sparse: true,
    },
    phonenumber: {
      type: String,
      required: true,
      validate(value) {
        if (!/^254\d{9}$/.test(value)) {
          throw new Error("Invalid phone number. Must start with 254...");
        }
      },
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be at least 1"],
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    escrowStatus: {
      type: String,
      enum: ["HELD", "RELEASED", "REFUNDED"],
      default: "HELD",
    },
    releasedAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },

    // NEW: Disbursement (B2C) related fields
    disbursementTransactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    disbursementStatus: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    disbursementResponse: {
      type: Schema.Types.Mixed, // store raw B2C callback or response data
    },
    disbursementDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const EscrowDeposit = mongoose.model("EscrowDeposit", escrowDepositSchema);

module.exports = EscrowDeposit;
