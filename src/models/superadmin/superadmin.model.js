// models/superAdmin.js
import mongoose from "mongoose";

const superAdminSchema = new mongoose.Schema(
  {
    // -------------------------
    // BASIC IDENTITY
    // -------------------------
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    phone: {
      type: String,
      unique: true,
      sparse: true, // allow null
    },

    role: {
      type: String,
      enum: ["SUPERADMIN"],
      default: "SUPERADMIN",
    },

    // -------------------------
    // MANUAL LOGIN
    // -------------------------
    password: {
      type: String,
      select: false, // security
    },

    // -------------------------
    // AUTH PROVIDERS
    // -------------------------
    authProviders: {
      google: {
        id: String,
        email: String,
      },

      github: {
        id: String,
        username: String,
        email: String,
      },

      manual: {
        enabled: {
          type: Boolean,
          default: false,
        },
      },

      mobile: {
        enabled: {
          type: Boolean,
          default: false,
        },
      },
    },

    // -------------------------
    // OTP (MOBILE LOGIN)
    // -------------------------
    otp: {
      code: String,
      expiresAt: Date,
    },

    // -------------------------
    // ACCOUNT STATUS
    // -------------------------
    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: Date,

    // -------------------------
    // SECURITY & AUDIT
    // -------------------------
    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockedUntil: Date,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("SuperAdmin", superAdminSchema);
