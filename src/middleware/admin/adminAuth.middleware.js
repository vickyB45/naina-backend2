import jwt from "jsonwebtoken";
import TenantModel from "../../models/admin/TenantModel.js";

export const adminAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.admin_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access only",
      });
    }

    const admin = await TenantModel.findById(decoded.id);

    if (!admin || admin.isBlocked || admin.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Admin account blocked or inactive",
      });
    }

    req.user = admin;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin token",
    });
  }
};
