import express from "express";
import { adminLogoutController, getAdminLoginController, getAdminMeController, updateAdminOnboardingController } from "../../controllers/admin/admin.controller.js";
import { adminAuthMiddleware } from "../../middleware/admin/adminAuth.middleware.js";

const router = express.Router();

router.post("/login",getAdminLoginController)
router.get("/me", adminAuthMiddleware, getAdminMeController);
router.patch("/onboarding", adminAuthMiddleware, updateAdminOnboardingController);
router.post("/logout", adminAuthMiddleware, adminLogoutController);


export default router;