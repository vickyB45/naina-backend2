import jwt from "jsonwebtoken";
import SuperAdmin from "../../models/superadmin/superadmin.model.js";

export const SuperadminAccess = async (req, res, next) => {
  try {
    // ✅ SUPERADMIN TOKEN ONLY
    const token = req.cookies?.superadmin_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Superadmin authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ HARD CHECK
    if (decoded.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const superAdmin = await SuperAdmin.findById(decoded.id);

    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        message: "Session expired",
      });
    }

    if (superAdmin.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Account inactive",
      });
    }

    // 🔑 ATTACH
    req.user = superAdmin;
    req.userRole = "superadmin";

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
