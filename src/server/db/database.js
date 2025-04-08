import { EventEmitter } from "events";
import { initializeRedis, getTopPlayers, updateLeaderboard } from "./redis.js";
import dotenv from "dotenv";

dotenv.config();

const dbSyncEvents = new EventEmitter();
let redis;

const SYNC_CHANNEL = "db_sync";
const NODE_ID = process.env.NODE_ID || Math.random().toString(36).substring(7);

// In-memory database implementation
class InMemoryDatabase {
  constructor() {
    this.leaderboard = new Map();
    this.gameState = new Map();
    console.log("Using in-memory database");
  }

  async getLeaderboard(limit = 10) {
    // If Redis is available, use it for the leaderboard
    if (redis) {
      try {
        const redisLeaderboard = await getTopPlayers(limit);
        if (redisLeaderboard && redisLeaderboard.length > 0) {
          return redisLeaderboard;
        }
      } catch (error) {
        console.error("Error getting leaderboard from Redis:", error);
        // Fall back to in-memory leaderboard
      }
    }

    // Use in-memory leaderboard as fallback
    return Array.from(this.leaderboard.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async updatePlayerScore(playerId, username, score) {
    if (!playerId || !username) {
      console.warn("Invalid player data for score update:", {
        playerId,
        username,
        score,
      });
      return { updated: false };
    }

    const existingPlayer = this.leaderboard.get(playerId);
    if (existingPlayer && existingPlayer.score >= score) {
      return { updated: false };
    }

    this.leaderboard.set(playerId, {
      player_id: playerId,
      username,
      score,
      updated_at: new Date().toISOString(),
    });

    // Update Redis leaderboard if available
    if (redis) {
      try {
        await updateLeaderboard(playerId, username, score);
      } catch (error) {
        console.error("Error updating Redis leaderboard:", error);
        // Continue even if Redis update fails
      }
    }

    return { updated: true };
  }

  async saveGameState(sectorId, state) {
    if (!sectorId || !state) {
      console.warn("Invalid data for game state save:", { sectorId, state });
      return { success: false };
    }

    this.gameState.set(sectorId, {
      state,
      updated_at: new Date().toISOString(),
    });
    return { success: true };
  }

  async getGameState(sectorId) {
    if (!sectorId) {
      console.warn("Invalid sectorId for game state retrieval");
      return null;
    }

    const entry = this.gameState.get(sectorId);
    return entry ? entry.state : null;
  }
}

class DistributedDatabase {
  constructor() {
    this.db = new InMemoryDatabase();
    this.setupSync();
  }

  async initialize() {
    console.log(`Initializing database for node ${NODE_ID}`);

    try {
      // Initialize Redis for cross-node communication
      try {
        const redisClients = await initializeRedis();
        redis = redisClients.redis;

        // Subscribe to sync events from other nodes
        redisClients.subClient.subscribe(SYNC_CHANNEL, (err) => {
          if (err) {
            console.error("Redis subscription error:", err);
            return;
          }
          console.log(`Node ${NODE_ID} subscribed to ${SYNC_CHANNEL}`);
        });

        redisClients.subClient.on("message", async (channel, message) => {
          if (channel === SYNC_CHANNEL) {
            try {
              const { nodeId, action, data } = JSON.parse(message);
              if (nodeId !== NODE_ID) {
                console.log(
                  `Node ${NODE_ID} received sync from ${nodeId}: ${action}`,
                );

                // Handle sync based on action
                if (action === "updateScore") {
                  await this.db.updatePlayerScore(
                    data.playerId,
                    data.username,
                    data.score,
                  );
                } else if (action === "saveGameState") {
                  await this.db.saveGameState(data.sectorId, data.state);
                }
              }
            } catch (err) {
              console.error("Error processing sync message:", err);
            }
          }
        });
      } catch (redisError) {
        console.error("Redis initialization error:", redisError);
        console.log("Continuing without Redis synchronization");
      }

      console.log(`Database initialized for node ${NODE_ID}`);
    } catch (error) {
      console.error("Database initialization error:", error);
    }
  }

  setupSync() {
    dbSyncEvents.on("dbChange", async ({ action, data }) => {
      try {
        if (redis) {
          // Publish change to other nodes
          await redis.publish(
            SYNC_CHANNEL,
            JSON.stringify({
              nodeId: NODE_ID,
              action,
              data,
            }),
          );
        }
      } catch (err) {
        console.error("Error publishing sync:", err);
      }
    });
  }

  async getLeaderboard(limit) {
    try {
      return await this.db.getLeaderboard(limit);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      return [];
    }
  }

  async updatePlayerScore(playerId, username, score) {
    try {
      const result = await this.db.updatePlayerScore(playerId, username, score);
      dbSyncEvents.emit("dbChange", {
        action: "updateScore",
        data: { playerId, username, score },
      });
      return result;
    } catch (error) {
      console.error("Error updating player score:", error);
      return { updated: false };
    }
  }

  async saveGameState(sectorId, state) {
    try {
      // Validate input
      if (!sectorId) {
        console.warn("Invalid sectorId provided to saveGameState");
        return { success: false };
      }

      if (!state || typeof state !== "object") {
        console.warn("Invalid state provided to saveGameState:", state);
        return { success: false };
      }

      // Ensure state is serializable
      try {
        JSON.stringify(state);
      } catch (jsonError) {
        console.error("State is not serializable:", jsonError);
        return { success: false };
      }

      // Cache in Redis for cross-node access
      if (redis) {
        try {
          await redis.set(
            `sector:${sectorId}`,
            JSON.stringify(state),
            "EX",
            3600,
          );
        } catch (redisError) {
          console.error("Redis caching error:", redisError);
          // Continue even if Redis fails
        }
      }

      const result = await this.db.saveGameState(sectorId, state);
      dbSyncEvents.emit("dbChange", {
        action: "saveGameState",
        data: { sectorId, state },
      });
      return result;
    } catch (error) {
      console.error("Error saving game state:", error);
      return { success: false };
    }
  }

  async getGameState(sectorId) {
    try {
      // First check Redis cache
      if (redis) {
        try {
          const redisState = await redis.get(`sector:${sectorId}`);
          if (redisState) {
            return JSON.parse(redisState);
          }
        } catch (redisError) {
          console.error("Redis retrieval error:", redisError);
          // Continue to in-memory if Redis fails
        }
      }

      // Then check in-memory database
      return await this.db.getGameState(sectorId);
    } catch (error) {
      console.error("Error getting game state:", error);
      return null;
    }
  }
}

let database;

export async function initializeDatabase() {
  if (!database) {
    try {
      database = new DistributedDatabase();
      await database.initialize();
    } catch (error) {
      console.error("Failed to initialize database:", error);
      database = new InMemoryDatabase();
    }
  }
  return database;
}

export async function getDatabase() {
  if (!database) {
    await initializeDatabase();
  }
  return database;
}
