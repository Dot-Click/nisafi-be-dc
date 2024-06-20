const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const walletSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    transactions: [
      {
        amount: {
          type: Number,
          required: true,
        },
        type: {
          type: String,
          required: true,
          enum: ["credit", "debit"],
        },
        paidBy: {
          type: Schema.Types.ObjectId,
          ref: "user",
        },
        paidTo: {
          type: Schema.Types.ObjectId,
          ref: "user",
        },
        job: {
          type: Schema.Types.ObjectId,
          ref: "job",
        },
        createdAt: {
          type: Date,
          default: Date.now(),
        },
        escrow: {
          type: Boolean,
        //   default: false,
        },
      },
    ],
  },
  { timestamps: true }
);

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;
