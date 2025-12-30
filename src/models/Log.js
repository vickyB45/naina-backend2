import mongoose from "mongoose";

const uptimeLogSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["UP", "DOWN"],
      required: true,
    },

    responseTimeMs: {
      type: Number,
    },

    checkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("UptimeLog", uptimeLogSchema);
