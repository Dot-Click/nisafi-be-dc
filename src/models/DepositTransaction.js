const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const depositSchema = new Schema(
  {
    transaction_id: {
      type: String,
      required: true,
      unique: true,
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
  },
  {
    timestamps: true,
  }
);

const DepositTransaction = mongoose.model("DepositTransaction", depositSchema);

module.exports = DepositTransaction;
