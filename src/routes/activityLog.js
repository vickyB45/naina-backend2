import express from "express";
import {
  // createActivityLog,
  getRecentActivityLogs,
} from "../controllers/superadmin/activityLog.js";

const router = express.Router();

/**
 * GET /api/activity/recent
 * Overview recent activity feed
 */
router.get("/recent", getRecentActivityLogs);

/**
 * POST /api/activity
 * Create new activity log
 */
// router.post("/", createActivityLog);

export default router;
