import mongoose from "mongoose";
import TenantModel from "../../models/admin/TenantModel.js";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken"


/**
 * =================================================
 * GET LOGGED-IN ADMIN PROFILE
 * =================================================
 * @route   GET /api/admin/me
 * @access  Private (Admin)
 */
export const getAdminMeController = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const admin = await TenantModel.findById(req.user._id).select("-password");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (admin.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked. Contact support.",
      });
    }

    return res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    console.error("GET ADMIN ME ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin profile",
    });
  }
};

/**
 * =================================================
 * ADMIN LOGIN
 * =================================================
 * @route   POST /api/admin/login
 * @access  Public
 */


export const getAdminLoginController = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    /* ======================
       1️⃣ VALIDATION
    ====================== */
    if (!email || !password || role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "Only admin login is allowed",
      });
    }

    /* ======================
       2️⃣ CLEAR OTHER ROLE COOKIE
    ====================== */
    res.clearCookie("superadmin_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    /* ======================
       3️⃣ FIND ADMIN (+password)
    ====================== */
    const admin = await TenantModel.findOne({
      email: email.toLowerCase(),
      role: "admin",
    }).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    /* ======================
       4️⃣ STATUS CHECKS
    ====================== */
    if (admin.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Contact support.",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    /* ======================
       5️⃣ PASSWORD CHECK
    ====================== */
    const isPasswordMatched = await bcryptjs.compare(
      password,
      admin.password
    );

    if (!isPasswordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    /* ======================
       6️⃣ JWT GENERATE
    ====================== */
    const token = jwt.sign(
      {
        id: admin._id,
        role: "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    /* ======================
       7️⃣ SET ADMIN COOKIE
    ====================== */
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });

    /* ======================
       8️⃣ LOGIN META
    ====================== */
    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    admin.lastLoginAt = new Date();
    admin.lastLoginIp = ip;

    admin.loginHistory.push({
      ip,
      userAgent: req.headers["user-agent"],
      device: "web",
      location: "unknown",
    });

    admin.auditLogs.push({
      action: "ADMIN_LOGIN_SUCCESS",
      meta: { ip },
    });

    await admin.save();

    /* ======================
       9️⃣ RESPONSE
    ====================== */
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        onboarded: admin.onboarded,
        twoFactorEnabled: admin.twoFactorEnabled,
      },
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};



/**
 * =================================================
 * ADMIN ONBOARDING / PROFILE UPDATE
 * =================================================
 * @route   PATCH /api/admin/onboarding
 * @access  Private (Admin)
 */
export const updateAdminOnboardingController = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const admin = await TenantModel.findById(req.user._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (admin.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account is blocked",
      });
    }

    const {
      name,
      businessName,
      websiteUrl,
      avatar,
      address,
      notifications,
      termsAccepted,   // optional
      terms,           // frontend object
    } = req.body;

    /* ======================
       BASIC FIELDS UPDATE
    ====================== */
    ["name", "businessName", "websiteUrl", "avatar"].forEach((field) => {
      if (req.body[field] !== undefined) {
        admin[field] = req.body[field];
      }
    });

    /* ======================
       ADDRESS MERGE
    ====================== */
    if (address && typeof address === "object") {
      admin.address = {
        ...admin.address,
        ...address,
      };
    }

    /* ======================
       NOTIFICATIONS MERGE
    ====================== */
    if (notifications && typeof notifications === "object") {
      admin.notifications = {
        ...admin.notifications,
        ...notifications,
      };
    }

    /* ======================
       ✅ TERMS (SUPPORT BOTH)
    ====================== */
    const isTermsAccepted =
      termsAccepted === true ||
      terms?.accepted === true;

    if (isTermsAccepted && !admin.terms.accepted) {
      admin.terms.accepted = true;
      admin.terms.acceptedAt =
        terms?.acceptedAt ? new Date(terms.acceptedAt) : new Date();
      admin.terms.version = admin.terms.version || "v1";

      admin.auditLogs.push({
        action: "TERMS_ACCEPTED",
        meta: { version: admin.terms.version },
      });
    }

    /* ======================
       🚀 FORCE ONBOARDING COMPLETE
    ====================== */
    if (admin.terms.accepted === true && !admin.onboarded) {
      admin.onboarded = true;
      admin.onboardedAt = new Date();

      admin.auditLogs.push({
        action: "ADMIN_ONBOARDING_COMPLETED",
        meta: {
          via: "onboarding_api",
          updatedFields: Object.keys(req.body),
        },
      });
    } else {
      admin.auditLogs.push({
        action: "ADMIN_PROFILE_UPDATED",
        meta: {
          updatedFields: Object.keys(req.body),
        },
      });
    }

    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Onboarding completed successfully",
      data: admin,
    });

  } catch (error) {
    console.error("ADMIN ONBOARDING ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update onboarding",
    });
  }
};


/**
 * =================================================
 * ADMIN LOGOUT
 * =================================================
 * @route   POST /api/admin/logout
 * @access  Private (Admin)
 */


export const adminLogoutController = async (req, res) => {
  try {
    /* ======================
       AUDIT LOG (OPTIONAL)
    ====================== */
    if (req.user?.id) {
      await TenantModel.findByIdAndUpdate(req.user.id, {
        $push: {
          auditLogs: {
            action: "ADMIN_LOGOUT",
            meta: {
              ip:
                req.headers["x-forwarded-for"] ||
                req.socket.remoteAddress,
              userAgent: req.headers["user-agent"],
              at: new Date(),
            },
          },
        },
      });
    }

    /* ======================
       🔥 CLEAR ADMIN COOKIE
       (SAME AS LOGIN SET)
    ====================== */
    res.clearCookie("admin_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("ADMIN LOGOUT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to logout",
    });
  }
};
