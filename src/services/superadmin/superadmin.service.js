import bcrypt from "bcryptjs";

import SuperAdmin from "../../models/superadmin/superadmin.model.js";

import { comparePassword } from "../../utils/superadmin/password.util.js";
import { generateToken } from "../../utils/superadmin/jwt.util.js";
import { setSuperadminCookie } from "../../utils/superadmin/cookie.util.js";

/**
 * ===============================
 * LOGIN (SUPERADMIN / ADMIN)
 * ===============================
 */

/**
 * ===============================
 * LOGIN (SUPERADMIN / ADMIN)
 * ===============================
 */
export const superadminLoginService = async ({ email, password,role }, res) => {
  // 1️⃣ Validation
  if (!email || !password || !role) {
    throw { status: 400, message: "Email and password are required" };
  }

  // 2️⃣ Fetch superadmin
  const superAdmin = await SuperAdmin.findOne({ email }).select("+password");

  if (!superAdmin) {
    throw { status: 401, message: "Invalid credentials" };
  }

  // 3️⃣ Active check
  if (superAdmin.isActive === false) {
    throw { status: 403, message: "Account disabled" };
  }

  // 4️⃣ Password verify
  const isValid = await comparePassword(password, superAdmin.password);
  if (!isValid) {
    throw { status: 401, message: "Invalid credentials" };
  }

  // 5️⃣ JWT (ROLE MUST MATCH MIDDLEWARE)
  const token = generateToken({
    id: superAdmin._id,
    role: "superadmin",
  });

  // 6️⃣ SET SUPERADMIN COOKIE ✅
  setSuperadminCookie(res, token);

  // 7️⃣ Update last login
  superAdmin.lastLoginAt = new Date();
  await superAdmin.save();

  // 8️⃣ Response
  return {
    success: true,
    message: "Superadmin login successful",
    role: "superadmin",
  };
};

/**
 * ===============================
 * CREATE SUPERADMIN (ONE-TIME)
 * ===============================
 */
export const createSuperAdminService = async ({
  name,
  email,
  password,
  phone,
}) => {
  // -----------------------------
  // 1️⃣ Validation
  // -----------------------------
  if (!name || !email || !password) {
    throw { status: 400, message: "Required fields missing" };
  }

  // -----------------------------
  // 2️⃣ Only ONE superadmin rule
  // -----------------------------
  const superAdminExists = await SuperAdmin.exists({
    role: "SUPERADMIN",
  });

  if (superAdminExists) {
    throw {
      status: 403,
      message: "SuperAdmin already exists. Creation not allowed.",
    };
  }

  // -----------------------------
  // 3️⃣ Email uniqueness check
  // -----------------------------
  const emailExists = await SuperAdmin.findOne({ email });
  if (emailExists) {
    throw { status: 409, message: "Email already registered" };
  }

  // -----------------------------
  // 4️⃣ Hash password
  // -----------------------------
  const hashedPassword = await bcrypt.hash(password, 10);

  // -----------------------------
  // 5️⃣ Create superadmin
  // -----------------------------
const superAdmin = await SuperAdmin.create({
  name,
  email,
  phone,
  password: hashedPassword,
  role: "superadmin", // 🔥 FIXED
  authProviders: {
    manual: { enabled: true },
  },
  isActive: true,
  lastLoginAt: null,
});

  // -----------------------------
  // 6️⃣ Response
  // -----------------------------
  return {
    success: true,
    message: "SuperAdmin created successfully",
    data: {
      id: superAdmin._id,
      email: superAdmin.email,
    },
  };
};
