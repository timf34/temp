import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { configureGameServer } from "./game/GameServer.js";
import { initializeDatabase, getDatabase } from "./db/database.js";
import { initializeRedis } from "./db/redis.js";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  path: "/socket.io",
});

app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);
app.use(express.json());

// Initialize database and Redis
await initializeDatabase();
await initializeRedis();

// Configure game server with Socket.IO
configureGameServer(io);

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Add leaderboard endpoint
app.get("/leaderboard", async (req, res) => {
  try {
    const db = await getDatabase();
    const limit = Number.parseInt(req.query.limit) || 10; // Default to 10 players
    const leaderboard = await db.getLeaderboard(limit);
    res.json(leaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Add node status endpoint
app.get("/status", (req, res) => {
  res.json({
    nodeId: process.env.NODE_ID || "unknown",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
