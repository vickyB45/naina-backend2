import ActivityLog from "../../models/ActivityLog.js";

/**
 * GET /api/activity/recent
 * Fetch recent activity logs (overview) + intent summary
 */
export const getRecentActivityLogs = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 6;

    // --------------------------------------------------
    // 1️⃣ RECENT ACTIVITY LOGS (ALL TIME, latest first)
    // --------------------------------------------------
    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const formattedLogs = logs.map((log) => ({
      id: log._id,
      icon:
        log.category === "client"
          ? "user"
          : log.category === "api"
          ? "alert"
          : log.category === "chat"
          ? "chat"
          : "system",
      severity: log.severity,
      title: log.title,
      meta: log.meta || [],
      timestamp: log.createdAt,
    }));

    // --------------------------------------------------
    // 2️⃣ INTENT SUMMARY (ALL TIME)
    // --------------------------------------------------
    const intentAgg = await ActivityLog.aggregate([
      {
        $match: {
          "meta.intent": { $in: ["high", "medium", "low"] },
        },
      },
      {
        $group: {
          _id: "$meta.intent",
          count: { $sum: 1 },
        },
      },
    ]);

    const intentSummary = {
      intentHigh: 0,
      intentMedium: 0,
      intentLow: 0,
    };

    intentAgg.forEach((item) => {
      if (item._id === "high") intentSummary.intentHigh = item.count;
      if (item._id === "medium") intentSummary.intentMedium = item.count;
      if (item._id === "low") intentSummary.intentLow = item.count;
    });

    // --------------------------------------------------
    // FINAL RESPONSE
    // --------------------------------------------------
    res.json({
      success: true,
      data: formattedLogs,
      intentSummary,
      _meta: {
        mode: "ALL_TIME",
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Activity log fetch error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
