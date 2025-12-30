import express from "express";
import {
  loginSuperAdmin,
  createSuperAdmin,
  getProfile,
  logout,
  handleCreateAdmin,
  handleAllAdmins,
  blockTenant,
  unblockTenant,
  handleGetTenantById,
} from "../../controllers/superadmin/superadmin.controller.js";
import { SuperadminAccess } from "../../middleware/superadmin/onlySuperadminAccess.js";

const router = express.Router();

// 🔥 TEMP / ONE-TIME USE
router.post("/create", createSuperAdmin);

// Auth
router.post("/login", loginSuperAdmin);
router.get("/me", SuperadminAccess, getProfile);
router.post("/logout", SuperadminAccess, logout);

// Create Tenent

router.post("/create-tenant",SuperadminAccess,handleCreateAdmin)
router.get("/all-tenants",SuperadminAccess,handleAllAdmins)

// 🔒 BLOCK TENANT / ADMIN
router.patch("/tenant/:id/block",SuperadminAccess,blockTenant);
// 🔓 UNBLOCK TENANT / ADMIN
router.patch("/tenant/:id/unblock",SuperadminAccess,unblockTenant);

// Get Tenent by Id 
router.get("/tenant/:tenantId",SuperadminAccess, handleGetTenantById)



export default router;
