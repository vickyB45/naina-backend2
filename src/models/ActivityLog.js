import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "client_added",
        "client_plan_updated",
        "conversation_started",
        "chat_active",
        "api_latency",
        "system_warning",
      ],
      required: true,
    },

    category: {
      type: String,
      enum: ["client", "chat", "api", "system"],
      required: true,
    },

    severity: {
      type: String,
      enum: ["success", "warning", "error"],
      default: "success",
    },

    title: {
      type: String,
      required: true,
    },

    meta: {
      type: [String], // UI-ready text lines
      default: [],
    },

    triggeredBy: {
      type: String,
      default: "System",
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// 🔥 OverwriteModelError SAFE EXPORT
export default mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", activityLogSchema);
