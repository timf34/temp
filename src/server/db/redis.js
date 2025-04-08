import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

let redis;
let pubClient;
let subClient;

export async function initializeRedis() {
  // Create separate clients for pub/sub to avoid blocking
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  redis = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 5,
  });

  pubClient = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  subClient = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on("error", (err) => {
    console.error("Redis Error:", err);
  });

  pubClient.on("error", (err) => {
    console.error("Redis Pub Error:", err);
  });

  subClient.on("error", (err) => {
    console.error("Redis Sub Error:", err);
  });

  // Test connection
  try {
    await redis.ping();
    console.log("Redis connected successfully");
  } catch (error) {
    console.error("Redis connection failed:", error);
    // Fallback to in-memory storage if Redis is unavailable
    console.log("Using in-memory storage as fallback");
  }

  return { redis, pubClient, subClient };
}

export async function cacheGameState(sector, state) {
  try {
    await redis.set(`sector:${sector}`, JSON.stringify(state), "EX", 3600); // Expire after 1 hour
    return true;
  } catch (error) {
    console.error("Redis cache error:", error);
    return false;
  }
}

export async function getGameState(sector) {
  try {
    const state = await redis.get(`sector:${sector}`);
    return state ? JSON.parse(state) : null;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

export async function publishGameUpdate(channel, update) {
  try {
    await pubClient.publish(channel, JSON.stringify(update));
    return true;
  } catch (error) {
    console.error("Redis publish error:", error);
    return false;
  }
}

export function subscribeToChannel(channel, callback) {
  subClient.subscribe(channel, (err) => {
    if (err) {
      console.error(`Error subscribing to ${channel}:`, err);
      return false;
    }
  });

  subClient.on("message", (receivedChannel, message) => {
    if (receivedChannel === channel) {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    }
  });

  return true;
}

// Add these functions to handle leaderboard in Redis

export async function updateLeaderboard(playerId, username, score) {
  try {
    // Store player score in a sorted set
    await redis.zadd("leaderboard", score, `${playerId}:${username}`);

    // Publish an update event to notify all clients
    await publishGameUpdate("leaderboard_updated", {
      playerId,
      username,
      score,
    });

    return true;
  } catch (error) {
    console.error("Redis leaderboard update error:", error);
    return false;
  }
}

export async function getTopPlayers(limit = 10) {
  try {
    // Get the top players from the sorted set (highest scores first)
    const topScores = await redis.zrevrange(
      "leaderboard",
      0,
      limit - 1,
      "WITHSCORES",
    );

    // Format the results
    const leaderboard = [];
    for (let i = 0; i < topScores.length; i += 2) {
      const [playerId, username] = topScores[i].split(":");
      const score = Number.parseInt(topScores[i + 1]);

      leaderboard.push({
        player_id: playerId,
        username: username,
        score: score,
        updated_at: new Date().toISOString(),
      });
    }

    return leaderboard;
  } catch (error) {
    console.error("Redis get leaderboard error:", error);
    return [];
  }
}
