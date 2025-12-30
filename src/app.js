import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

import chatRoutes from "./routes/chatRoutes.js";
import analyticsRoutes from "./routes/analytics.js";
import authRoutes from "./routes/auth.js";
import systemRoutes from "./routes/systemRoutes.js";
import activityLogRoutes from "./routes/activityLog.js"; // ✅ FIXED
import superadminRoutes from "./routes/superadmin/superadmin.routes.js";
import adminRoute from "./routes/admin/admin.onboarding.routes.js";


import { startAutoSync } from "./services/shopifySync.js";

const app = express();

// ------------------------------------
// MIDDLEWARE
// ------------------------------------
// app.use(cors({ origin: "*", credentials: true }));
app.use(cors({ origin: "https://naina-frontend2.vercel.app", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // 🔥 MUST BEFORE ROUTES


// ------------------------------------
// HEALTH CHECK (Render-safe)
// ------------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "connecting",
    uptime: process.uptime(),
  });
});

// ------------------------------------
// ROOT
// ------------------------------------
app.get("/", (req, res) => {
  res.json({
    message: "Naina Backend Running",
    status: "OK",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      chat: "/api/chat",
      analytics: "/api/analytics",
      system: "/api/system",
      activity: "/api/activity",
    },
  });
});

// ------------------------------------
// ROUTES
// ------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/activity", activityLogRoutes); // ✅ NOW WORKING



// ------------------------------------
// SUPERADMIN
// ------------------------------------
app.use("/api/superadmin", superadminRoutes);


// ------------------------------------
// SUPERADMIN
// ------------------------------------
app.use("/api/admin", adminRoute);


// ------------------------------------
// GLOBAL ERROR HANDLER
// ------------------------------------
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(500).json({
    success: false,
    error: "Something went wrong",
  });
});

// ------------------------------------
// START SERVER FIRST
// ------------------------------------
const PORT = process.env.PORT || 5174;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ Server READY on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(
    `📊 Analytics: http://localhost:${PORT}/api/analytics/overview\n`
  );
});

// ------------------------------------
// MONGODB (Async – Non Blocking)
// ------------------------------------
console.log("🔍 Connecting to MongoDB in background...");

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ MongoDB Connected");

    // Shopify sync after DB connect
    if (
      process.env.SHOPIFY_STORE &&
      process.env.SHOPIFY_ACCESS_TOKEN
    ) {
      console.log("🔄 Starting Shopify auto-sync...");
      startAutoSync(60);
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    console.log("⚠️ Server running WITHOUT database");
  });

// ------------------------------------
// MONGODB PING
// ------------------------------------
mongoose.connection.on("connected", () => {
  setInterval(async () => {
    if (mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.db.admin().ping();
        console.log("🏓 MongoDB ping OK");
      } catch (error) {
        console.error("❌ MongoDB ping failed:", error.message);
      }
    }
  }, 60000);
});

// ------------------------------------
// GRACEFUL SHUTDOWN
// ------------------------------------
process.on("SIGTERM", () => {
  console.log("⚠️ SIGTERM received, closing server...");
  server.close(() => {
    console.log("✅ Server closed");
    mongoose.connection.close(false, () => {
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    });
  });
});

export default app;
