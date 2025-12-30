import mongoose from "mongoose";
import TenantModel from "../../models/admin/TenantModel.js";

import {
  createSuperAdminService,
  superadminLoginService,
} from "../../services/superadmin/superadmin.service.js";

/**
 * ===============================
 * SUPERADMIN LOGIN
 * ===============================
 */
export const loginSuperAdmin = async (req, res) => {
  try {
    const data = await superadminLoginService(req.body, res);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

/**
 * ===============================
 * GET SUPERADMIN PROFILE
 * ===============================
 */
export const getProfile = async (req, res) => {
  try {
    if (!req.user || req.userRole !== "superadmin") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = req.user;

    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

/**
 * ===============================
 * SUPERADMIN LOGOUT
 * ===============================
 */
export const logout = async (req, res) => {
  res.clearCookie("superadmin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

/**
 * ===============================
 * CREATE SUPERADMIN (ONE-TIME)
 * ===============================
 */
export const createSuperAdmin = async (req, res) => {
  try {
    const result = await createSuperAdminService(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

/**
 * ===============================
 * CREATE TENANT / ADMIN
 * ===============================
 */
export const handleCreateAdmin = async (req, res) => {
  try {
    const { name, email, password, businessName, websiteUrl } = req.body;

    if (!name || !email || !password || !businessName || !websiteUrl) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existing = await TenantModel.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Admin already exists with this email",
      });
    }

    const admin = await TenantModel.create({
      name,
      email,
      password, // 🔐 hashed by model
      businessName,
      websiteUrl,
      role: "admin",
      onboarded: false,
      termsAccepted: false,
      isActive: true,
      isBlocked: false,
    });

    return res.status(201).json({
      success: true,
      message: "Tenant created successfully",
      data: {
        id: admin._id,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("CREATE ADMIN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create admin",
    });
  }
};

/**
 * ===============================
 * GET ALL TENANTS / ADMINS
 * ===============================
 */
export const handleAllAdmins = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const query = {
      role: { $in: ["admin", "tenant"] },
    };

    if (req.query.search) {
      const regex = new RegExp(req.query.search.trim(), "i");
      query.$or = [
        { name: regex },
        { email: regex },
        { businessName: regex },
      ];
    }

    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === "true";
    }

    if (req.query.onboarded !== undefined) {
      query.onboarded = req.query.onboarded === "true";
    }

    if (req.query.dateFilter) {
      const now = new Date();
      let startDate = null;

      switch (req.query.dateFilter) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "last7days":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "lastMonth":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }

      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }

    const sortField = ["createdAt", "name", "email", "lastLoginAt"].includes(
      req.query.sort
    )
      ? req.query.sort
      : "createdAt";

    const sortOrder = req.query.order === "asc" ? 1 : -1;

    const [admins, total] = await Promise.all([
      TenantModel.find(query)
        .select("-password")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      TenantModel.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      page,
      limit,
      total,
      hasMore: skip + admins.length < total,
      data: admins,
    });
  } catch (error) {
    console.error("HANDLE ALL ADMINS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admins",
    });
  }
};

/**
 * ===============================
 * BLOCK TENANT
 * ===============================
 */
export const blockTenant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tenant ID",
      });
    }

    const tenant = await TenantModel.findById(id);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (tenant.isBlocked) {
      return res.status(409).json({
        success: false,
        message: "Tenant already blocked",
      });
    }

    tenant.isBlocked = true;
    tenant.isActive = false;
    await tenant.save();

    return res.status(200).json({
      success: true,
      message: "Tenant blocked successfully",
      data: {
        id: tenant._id,
        email: tenant.email,
        isBlocked: tenant.isBlocked,
      },
    });
  } catch (error) {
    console.error("BLOCK TENANT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to block tenant",
    });
  }
};

/**
 * ===============================
 * UNBLOCK TENANT
 * ===============================
 */
export const unblockTenant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tenant ID",
      });
    }

    const tenant = await TenantModel.findById(id);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!tenant.isBlocked) {
      return res.status(409).json({
        success: false,
        message: "Tenant already active",
      });
    }

    tenant.isBlocked = false;
    tenant.isActive = true;
    await tenant.save();

    return res.status(200).json({
      success: true,
      message: "Tenant unblocked successfully",
      data: {
        id: tenant._id,
        email: tenant.email,
        isBlocked: tenant.isBlocked,
      },
    });
  } catch (error) {
    console.error("UNBLOCK TENANT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unblock tenant",
    });
  }
};

/**
 * ===============================
 * GET SINGLE TENANT BY ID
 * ===============================
 */
export const handleGetTenantById = async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tenant ID",
      });
    }

    const tenant = await TenantModel.findById(tenantId).select("-password");

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error("GET TENANT BY ID ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
