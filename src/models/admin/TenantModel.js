import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/* ======================
   SUB SCHEMAS
====================== */

// 🔐 Login History
const loginHistorySchema = new mongoose.Schema(
  {
    ip: String,
    userAgent: String,
    device: String,
    location: String,
    loggedInAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// 🔑 API Keys
const apiKeySchema = new mongoose.Schema(
  {
    key: String,
    name: String,
    isActive: { type: Boolean, default: true },
    lastUsedAt: Date,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// 💳 Subscription (Future ready)
const subscriptionSchema = new mongoose.Schema(
  {
    planName: { type: String, default: null },
    price: { type: Number, default: null },
    currency: { type: String, default: "INR" },
    billingCycle: { type: String, default: null }, // monthly / yearly
    status: {
      type: String,
      enum: ["active", "inactive", "trial", "expired", "cancelled"],
      default: "inactive",
    },
    startedAt: Date,
    expiresAt: Date,
    isTrial: { type: Boolean, default: false },
    trialEndsAt: Date,
    provider: { type: String, default: null },
    providerSubscriptionId: { type: String, select: false },
  },
  { _id: false }
);

// 🔐 Trusted Devices (2FA skip)
const trustedDeviceSchema = new mongoose.Schema(
  {
    deviceId: String,
    device: String,
    ip: String,
    trustedAt: { type: Date, default: Date.now },
    expiresAt: Date,
  },
  { _id: false }
);

// 📜 Audit Logs
const auditLogSchema = new mongoose.Schema(
  {
    action: String, // e.g. "ONBOARDING_COMPLETED"
    meta: Object,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ======================
   MAIN TENANT / ADMIN SCHEMA
====================== */

const tenantSchema = new mongoose.Schema(
  {
    /* ===== BASIC INFO ===== */
    name: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    websiteUrl: String,

    avatar: {
      type: String,
      default:
        "https://i.pinimg.com/736x/0b/97/6f/0b976f0a7aa1aa43870e1812eee5a55d.jpg",
    },

    /* ===== ROLE ===== */
    role: {
      type: String,
      enum: ["tenant", "admin", "superadmin"],
      default: "tenant",
    },
    /* ===== ADDRESS ===== */
    address: {
      addressLine1: { type: String, trim: true },
      addressLine2: { type: String, trim: true },

      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, default: "India" },

      pincode: { type: String, trim: true },
      phone: { type: String, trim: true },
    },

    /* ===== ONBOARDING ===== */
    onboarded: { type: Boolean, default: false },
    onboardedAt: Date,

    terms: {
      accepted: { type: Boolean, default: false },
      version: { type: String, default: "v1" },
      acceptedAt: Date,
    },

    /* ===== SUBSCRIPTION ===== */
    subscription: {
      type: subscriptionSchema,
      default: {},
    },

    /* ===== SECURITY ===== */
    twoFactorEnabled: { type: Boolean, default: false },

    // 🔐 OTP based 2FA (5 min expiry)
    twoFactorOtp: { type: String, select: false },
    twoFactorOtpExpiresAt: Date,

    trustedDevices: [trustedDeviceSchema],

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpiresAt: Date,
    lastPasswordChangedAt: Date,

    /* ===== ACTIVITY ===== */
    loginHistory: [loginHistorySchema],
    lastLoginAt: Date,
    lastLoginIp: String,

    /* ===== NOTIFICATIONS ===== */
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },

    /* ===== API / INTEGRATION ===== */
    apiKeys: [apiKeySchema],
    integrationToken: { type: String, select: false },

    /* ===== AUDIT ===== */
    auditLogs: [auditLogSchema],

    /* ===== STATUS ===== */
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

/* ======================
   PASSWORD HASHING
====================== */

tenantSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.lastPasswordChangedAt = new Date();

  next();
});

/* ======================
   INSTANCE METHODS
====================== */

tenantSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// 🔁 Reset Password Token
tenantSchema.methods.generateResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpiresAt = Date.now() + 15 * 60 * 1000;
  return resetToken;
};

// 🔐 Generate 2FA OTP (5 min)
tenantSchema.methods.generateTwoFactorOtp = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  this.twoFactorOtp = crypto.createHash("sha256").update(otp).digest("hex");

  this.twoFactorOtpExpiresAt = Date.now() + 5 * 60 * 1000;

  return otp;
};

export default mongoose.model("TenantModel", tenantSchema);
