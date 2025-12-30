import mongoose from "mongoose";

const uptimeLogSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["UP", "DOWN"],
      required: true,
    },
    checkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ✅ SAFE MODEL EXPORT (no overwrite error)
const UptimeLog =
  mongoose.models.UptimeLog ||
  mongoose.model("UptimeLog", uptimeLogSchema);

export default UptimeLog;
