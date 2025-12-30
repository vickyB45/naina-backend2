import express from "express";
import { getSystemOverview } from "../controllers/superadmin/systemController.js";

const router = express.Router();

router.get("/overview", getSystemOverview);

export default router;
