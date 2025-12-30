import os from "os";
import mongoose from "mongoose";
import Conversation from "../../models/Conversation.js";
import Log from "../../models/Log.js";
import UptimeLog from "../../models/UptimeLog.js";

export const getSystemOverview = async (req, res) => {
  try {
    // --------------------------------------------------
    // 1️⃣ SERVER UPTIME (ALL TIME – Day 1 → Now)
    // --------------------------------------------------
    const uptimeLogs = await UptimeLog.find().select("status");

    const totalChecks = uptimeLogs.length;
    const upChecks = uptimeLogs.filter(
      (log) => log.status === "UP"
    ).length;

    const serverUptime =
      totalChecks === 0
        ? 100
        : Number(((upChecks / totalChecks) * 100).toFixed(2));

    // --------------------------------------------------
    // 2️⃣ ACTIVE AGENTS (ALL TIME)
    // --------------------------------------------------
    const activeAgents = await Conversation.distinct("storeId");

    // --------------------------------------------------
    // 3️⃣ API HEALTH (REAL TIME – Mongo Ping)
    // --------------------------------------------------
    const start = process.hrtime();
    await mongoose.connection.db.admin().ping();
    const diff = process.hrtime(start);

    const latencyMs = Math.round(
      (diff[0] * 1e9 + diff[1]) / 1e6
    );

    const apiHealth =
      latencyMs < 200 ? 99.5 : latencyMs < 400 ? 97 : 92;

    // --------------------------------------------------
    // 4️⃣ TOTAL ERRORS (ALL TIME)
    // --------------------------------------------------
    const errors = await Log.countDocuments({
      level: { $in: ["error", "critical"] },
    });

    // --------------------------------------------------
    // 5️⃣ PERFORMANCE METRICS (Placeholder)
    // --------------------------------------------------
    const performanceMetrics = Array.from({ length: 12 }).map((_, i) => ({
      time: `${10 + Math.floor(i / 2)}:${i % 2 === 0 ? "05" : "15"}`,
      value: Math.floor(80 + Math.random() * 80),
    }));

    // --------------------------------------------------
    // 6️⃣ SYSTEM RESOURCE USAGE (REAL TIME)
    // --------------------------------------------------
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    const memoryUsage = Math.round(
      ((totalMem - freeMem) / totalMem) * 100
    );

    const cpuUsage = Math.round(os.loadavg()[0] * 10);
    const diskUsage = 65; // placeholder

    const totalLoad = Math.min(
      100,
      Math.round((cpuUsage + memoryUsage + diskUsage) / 3)
    );

    // --------------------------------------------------
    // FINAL RESPONSE
    // --------------------------------------------------
    res.json({
      success: true,
      data: {
        summary: {
          serverUptime,          // ✅ ALL TIME %
          activeAgents: activeAgents.length,
          apiHealth,             // ⚡ REAL TIME
          errors,                // ✅ TOTAL ERRORS
        },
        performanceMetrics,
        systemUsage: {
          cpu: cpuUsage,
          memory: memoryUsage,
          disk: diskUsage,
          totalLoad,
        },
        _meta: {
          fetchedAt: new Date().toISOString(),
          latencyMs,
          uptimeChecks: totalChecks,
          mode: "ALL_TIME",
        },
      },
    });
  } catch (error) {
    console.error("❌ System overview error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
