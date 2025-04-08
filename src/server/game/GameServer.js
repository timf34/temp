import { createMaze } from "./MazeGenerator.js";
import { handlePlayerMovement } from "./PlayerMovement.js";
import { spawnGhosts, updateGhosts } from "./GhostManager.js";
import { handlePellets } from "./PelletManager.js";
import { getDatabase } from "../db/database.js";

const VISIBILITY_RADIUS = 10;
// Reduce ghost spawn interval from 60 seconds to 20 seconds for more frequent spawning
const GHOST_SPAWN_INTERVAL = 20000; // 20 seconds (was 60000)
const DROPPER_SPAWN_INTERVAL = 45000; // 45 seconds
const MAZE_WIDTH = 19; // Width of a single maze sector
const MAZE_HEIGHT = 22; // Height of a single maze sector
const PLAYER_COLORS = ["#FFFF00", "#00FFFF", "#FF00FF", "#00FF00", "#FF8800"]; // Colors for different players
const UPDATE_INTERVAL = 100; // Send updates to clients every 100ms
const MAX_PLAYERS_PER_SECTOR = 4; // Maximum players per sector
const SECTOR_CLEANUP_INTERVAL = 300000; // Clean up empty sectors every 5 minutes

// Global error handler to prevent crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

export function configureGameServer(io) {
  const maze = createMaze();
  const mazeDimensions = maze.getMazeDimensions();

  const gameState = {
    players: new Map(),
    ghosts: new Map(),
    droppers: new Map(),
    pellets: new Map(),
    maze: maze,
    sectorContent: new Map(), // Track which sectors have been generated
    activeSectors: new Set(), // Track which sectors have active players
  };

  io.on("connection", async (socket) => {
    console.log("Player connected:", socket.id);
    let db;

    try {
      db = await getDatabase();
    } catch (error) {
      console.error("Failed to get database connection:", error);
      // Continue without database
    }

    // Update the updatePlayerSector function to schedule ghost spawning for new sectors
    function updatePlayerSector(player, gameState) {
      if (!player.sector) {
        player.sector = { x: 0, y: 0 };
      }

      // Check if player has moved to a new sector
      if (player.sectorChange) {
        const oldSector = { ...player.sector };

        if (player.sectorChange.direction === "left") {
          player.sector.x -= 1;
        } else if (player.sectorChange.direction === "right") {
          player.sector.x += 1;
        } else if (player.sectorChange.direction === "up") {
          player.sector.y -= 1;
        } else if (player.sectorChange.direction === "down") {
          player.sector.y += 1;
        }

        console.log(
          `Player ${player.id} moved from sector ${oldSector.x},${oldSector.y} to sector ${player.sector.x},${player.sector.y}`,
        );

        // Add the new sector to active sectors
        const sectorKey = `${player.sector.x},${player.sector.y}`;
        gameState.activeSectors.add(sectorKey);

        // Generate new content for the new sector if it doesn't exist yet
        if (!gameState.sectorContent.has(sectorKey)) {
          generateSectorContent(gameState, player.sector, false);

          // Schedule ghost spawning for this new sector after a shorter delay (10 seconds instead of 30)
          const { scheduleGhostSpawning } = require("./GhostManager.js");
          scheduleGhostSpawning(gameState, player.sector, 10000); // 10 seconds delay (was 30000)
        }

        // Clear the sector change flag
        player.sectorChange = null;
      }

      return player.sector;
    }

    // Add this function to count players in a sector
    function countPlayersInSector(players, sectorX, sectorY) {
      let count = 0;
      for (const [_, player] of players.entries()) {
        if (
          player.sector &&
          player.sector.x === sectorX &&
          player.sector.y === sectorY
        ) {
          count++;
        }
      }
      return count;
    }

    // Add this function to find the least crowded sector
    function findLeastCrowdedSector(players) {
      const sectorCounts = new Map();

      // Count players in each sector
      for (const [_, player] of players.entries()) {
        if (player.sector) {
          const key = `${player.sector.x},${player.sector.y}`;
          sectorCounts.set(key, (sectorCounts.get(key) || 0) + 1);
        }
      }

      // If no sectors yet, return origin
      if (sectorCounts.size === 0) {
        return { x: 0, y: 0 };
      }

      // Find the sector with the fewest players
      let minCount = Number.POSITIVE_INFINITY;
      let leastCrowdedSector = { x: 0, y: 0 };

      for (const [key, count] of sectorCounts.entries()) {
        if (count < minCount) {
          minCount = count;
          const [x, y] = key.split(",").map(Number);
          leastCrowdedSector = { x, y };
        }
      }

      return leastCrowdedSector;
    }

    // Update the generateSectorContent function to ensure pellets are created
    function generateSectorContent(gameState, sector, includeGhosts = true) {
      const { maze, pellets, ghosts } = gameState;
      const sectorKey = `${sector.x},${sector.y}`;

      // Check if this sector already has content
      if (gameState.sectorContent.has(sectorKey)) {
        console.log(`Sector ${sectorKey} already has content`);
        return;
      }

      console.log(`Generating new content for sector ${sectorKey}`);

      // Generate pellets for this sector
      const mazeLayout = maze.getStandardMaze();
      let pelletCount = 0;

      mazeLayout.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell === 0) {
            // Regular path - add a regular pellet
            const pelletId = `pellet-${sectorKey}-${x}-${y}`;
            pellets.set(pelletId, {
              id: pelletId,
              position: { x, y },
              value: 10,
              isPowerPellet: false,
              sector: { ...sector },
              createdAt: Date.now(),
            });
            pelletCount++;
          } else if (cell === 2) {
            // Power pellet location - add a power pellet
            const pelletId = `power-${sectorKey}-${x}-${y}`;
            pellets.set(pelletId, {
              id: pelletId,
              position: { x, y },
              value: 50,
              isPowerPellet: true,
              sector: { ...sector },
              createdAt: Date.now(),
            });
            pelletCount++;
          }
        });
      });

      // Generate ghosts for this sector only if includeGhosts is true
      let ghostsAdded = 0;
      if (includeGhosts) {
        const ghostCount = 4; // Standard number of ghosts per sector
        const ghostColors = ["#FF0000", "#00FFFF", "#FFB8FF", "#FFB852"];

        for (let i = 0; i < ghostCount; i++) {
          // Find a valid position for the ghost
          let ghostPosition = null;
          let attempts = 0;

          while (!ghostPosition && attempts < 20) {
            attempts++;

            // Generate random position
            const randomX = Math.floor(Math.random() * mazeLayout[0].length);
            const randomY = Math.floor(Math.random() * mazeLayout.length);

            // Check if it's a valid position (not a wall)
            if (maze.isValidPosition(randomX, randomY)) {
              ghostPosition = { x: randomX, y: randomY };
            }
          }

          if (ghostPosition) {
            const ghostId = `ghost-${sectorKey}-${i}`;
            ghosts.set(ghostId, {
              id: ghostId,
              position: ghostPosition,
              color: ghostColors[i % ghostColors.length],
              createdAt: Date.now(),
              target: null,
              speed: 0.15,
              sector: { ...sector },
            });
            ghostsAdded++;
          }
        }
      }

      // Mark this sector as having content
      gameState.sectorContent.set(sectorKey, {
        generated: Date.now(),
        pelletCount: pelletCount,
        lastActive: Date.now(),
        ghostsGenerated: includeGhosts,
      });

      // Add to active sectors
      gameState.activeSectors.add(sectorKey);

      console.log(
        `Generated ${pelletCount} pellets and ${ghostsAdded} ghosts for sector ${sectorKey}`,
      );
    }

    // Update the socket.on("join-game") handler to distribute players
    socket.on("join-game", async (playerData) => {
      try {
        // Get the center of the maze as the starting position
        const startingPosition = maze.findStartingPosition();

        // Assign a color based on the number of players
        const playerColor =
          PLAYER_COLORS[gameState.players.size % PLAYER_COLORS.length];

        // Find the best sector for new players
        let assignedSector = { x: 0, y: 0 }; // Default to origin sector

        // If there are already players, check if we need to distribute to a new sector
        if (gameState.players.size > 0) {
          // Count players in each sector
          const sectorPlayerCounts = new Map();

          for (const [_, player] of gameState.players.entries()) {
            if (player.sector) {
              const key = `${player.sector.x},${player.sector.y}`;
              sectorPlayerCounts.set(
                key,
                (sectorPlayerCounts.get(key) || 0) + 1,
              );
            }
          }

          // Get all sectors sorted by x coordinate (page number)
          const sortedSectors = Array.from(sectorPlayerCounts.entries())
            .map(([key, count]) => {
              const [x, y] = key.split(",").map(Number);
              return { x, y, count };
            })
            .sort((a, b) => a.x - b.x); // Sort by x coordinate (page number)

          // Find the first sector with fewer than MAX_PLAYERS_PER_SECTOR players
          const availableSector = sortedSectors.find(
            (s) => s.count < MAX_PLAYERS_PER_SECTOR,
          );

          if (availableSector) {
            // Use the first available sector with space
            assignedSector = { x: availableSector.x, y: availableSector.y };
          } else {
            // If all sectors are full, create a new one
            // Find the highest sector X and add 1
            let maxSectorX = 0;
            for (const { x } of sortedSectors) {
              maxSectorX = Math.max(maxSectorX, x);
            }
            assignedSector = { x: maxSectorX + 1, y: 0 };
          }

          console.log(
            `Assigning new player to sector ${assignedSector.x},${assignedSector.y}`,
          );
        }

        const player = {
          id: socket.id,
          position: startingPosition,
          score: 0,
          lives: 3,
          username: playerData.username || "Anonymous",
          color: playerColor,
          direction: "right", // Default direction
          tunnelTransition: null, // No tunnel transition initially
          sector: assignedSector, // Assign the player to a sector
          ...playerData,
        };

        gameState.players.set(socket.id, player);

        // Add this sector to active sectors
        const sectorKey = `${assignedSector.x},${assignedSector.y}`;
        gameState.activeSectors.add(sectorKey);

        // Make sure there are no ghosts near the starting position in this sector
        clearGhostsNearPosition(gameState, startingPosition, 5, assignedSector);

        // Load sector state from database or generate new content without ghosts initially
        if (db) {
          const sectorId = getSectorId(startingPosition, player.sector);
          try {
            const sectorState = await db.getGameState(sectorId);
            if (sectorState) {
              updateSectorState(gameState, sectorId, sectorState);
            } else if (!gameState.sectorContent.has(sectorKey)) {
              // Generate new content if not loaded from DB, but without ghosts initially
              generateSectorContent(gameState, player.sector, false);
            }
          } catch (error) {
            console.error("Error loading sector state:", error);
            // Generate new content if DB load fails, but without ghosts initially
            if (!gameState.sectorContent.has(sectorKey)) {
              generateSectorContent(gameState, player.sector, false);
            }
          }
        } else if (!gameState.sectorContent.has(sectorKey)) {
          // Generate new content if no DB, but without ghosts initially
          generateSectorContent(gameState, player.sector, false);
        }

        // Calculate absolute position
        const absolutePosition = {
          x: startingPosition.x + player.sector.x * MAZE_WIDTH,
          y: startingPosition.y + player.sector.y * MAZE_HEIGHT,
        };

        // Send initial game state to player
        socket.emit("game-state", {
          position: startingPosition,
          visibleArea: getVisibleArea(startingPosition, gameState, player),
          players: getVisiblePlayers(
            startingPosition,
            gameState.players,
            socket.id,
          ),
          direction: "right", // Default direction
          mazeDimensions: mazeDimensions,
          sector: player.sector, // Send the player's sector
          absolutePosition: absolutePosition, // Send absolute position
        });
      } catch (error) {
        console.error("Error in join-game handler:", error);
        socket.emit("error", {
          message: "Failed to join game. Please try again.",
        });
      }
    });

    // Update the socket.on("move") handler to track sector changes
    socket.on("move", async (direction) => {
      try {
        const player = gameState.players.get(socket.id);
        if (!player) {
          console.log("Player not found for move:", socket.id);
          return;
        }

        // Check if player is in game over state
        if (player.gameOver) {
          console.log(
            `Player ${socket.id} is in game over state. Movement ignored.`,
          );
          socket.emit("game-over", { score: player.score });
          return;
        }

        const prevLives = player.lives;
        console.log(`Player ${socket.id} attempting to move: ${direction}`);
        const oldSectorId = getSectorId(player.position, player.sector);
        const oldSector = { ...player.sector };
        const newPosition = handlePlayerMovement(player, direction, gameState);

        // Check if player lost a life
        if (player.lives < prevLives) {
          socket.emit("life-lost", player.lives);
        }

        if (newPosition) {
          console.log(`Player ${socket.id} moved to:`, newPosition);
          player.position = newPosition;
          player.direction = direction; // Update player direction

          // Update player's sector if they moved through a tunnel
          const playerSector = updatePlayerSector(player, gameState);
          const newSectorId = getSectorId(newPosition, playerSector);
          const sectorKey = `${playerSector.x},${playerSector.y}`;

          // Check if player moved to a new sector
          const movedToNewSector = oldSectorId !== newSectorId;

          // If player moved to a new sector, load it from database or generate new content
          if (movedToNewSector) {
            if (db) {
              try {
                const sectorState = await db.getGameState(newSectorId);
                if (sectorState) {
                  updateSectorState(gameState, newSectorId, sectorState);
                } else if (!gameState.sectorContent.has(sectorKey)) {
                  // Generate new content if not loaded from DB, but without ghosts initially
                  generateSectorContent(gameState, playerSector, false);
                }
              } catch (error) {
                console.error("Error loading new sector state:", error);
                // Generate new content if DB load fails, but without ghosts initially
                if (!gameState.sectorContent.has(sectorKey)) {
                  generateSectorContent(gameState, playerSector, false);
                }
              }
            } else if (!gameState.sectorContent.has(sectorKey)) {
              // Generate new content if no DB, but without ghosts initially
              generateSectorContent(gameState, playerSector, false);
            }
          }

          // Calculate absolute position
          const absolutePosition = {
            x: newPosition.x + player.sector.x * MAZE_WIDTH,
            y: newPosition.y + player.sector.y * MAZE_HEIGHT,
          };

          // Update player's view
          socket.emit("update-view", {
            position: newPosition,
            visibleArea: getVisibleArea(newPosition, gameState, player),
            players: getVisiblePlayers(
              newPosition,
              gameState.players,
              socket.id,
            ),
            direction: direction,
            tunnelTransition: player.tunnelTransition,
            powerMode: player.powerMode && player.powerModeEndTime > Date.now(),
            sector: playerSector, // Send the updated sector
            absolutePosition: absolutePosition, // Send absolute position
          });

          // If score was updated, send a score update
          if (player.scoreUpdated) {
            socket.emit("score-update", player.score);
            player.scoreUpdated = false;
          }

          // Notify other players about this player's movement
          socket.broadcast.emit("player-moved", {
            id: socket.id,
            position: newPosition,
            direction: direction,
            sector: playerSector, // Include sector in player movement updates
          });

          // Save current sector state
          if (db) {
            try {
              // Create a valid state object to save
              const sectorStateToSave = {
                ghosts: Array.from(gameState.ghosts.entries())
                  .filter(
                    ([_, ghost]) =>
                      getSectorId(ghost.position, ghost.sector) === newSectorId,
                  )
                  .map(([id, ghost]) => [id, { ...ghost }]),
                pellets: Array.from(gameState.pellets.entries())
                  .filter(
                    ([_, pellet]) =>
                      getSectorId(pellet.position, pellet.sector) ===
                      newSectorId,
                  )
                  .map(([id, pellet]) => [id, { ...pellet }]),
                droppers: Array.from(gameState.droppers.entries())
                  .filter(
                    ([_, dropper]) =>
                      getSectorId(dropper.position, dropper.sector) ===
                      newSectorId,
                  )
                  .map(([id, dropper]) => [id, { ...dropper }]),
              };

              // Only save if we have valid data
              if (
                sectorStateToSave &&
                (sectorStateToSave.ghosts.length > 0 ||
                  sectorStateToSave.pellets.length > 0 ||
                  sectorStateToSave.droppers.length > 0)
              ) {
                await db.saveGameState(newSectorId, sectorStateToSave);
              }
            } catch (error) {
              console.error("Error saving sector state:", error);
              // Continue without saving the state
            }
          }

          // Update player score in database
          if (db && player.score > 0) {
            try {
              const result = await db.updatePlayerScore(
                player.id,
                player.username,
                player.score,
              );

              // If the score was updated, broadcast a leaderboard update
              if (result.updated) {
                io.emit("leaderboard_updated");
              }
            } catch (error) {
              console.error("Error updating player score:", error);
              // Continue without updating the score
            }
          }
        } else {
          console.log(`Player ${socket.id} movement blocked:`, direction);

          // Check if player is in game over state after movement attempt
          if (player.gameOver) {
            console.log(`Player ${socket.id} is out of lives. Game over.`);
            socket.emit("game-over", { score: player.score });
          }
        }
      } catch (error) {
        console.error("Error in move handler:", error);
        // Don't crash the server, just log the error
      }
    });

    socket.on("respawn", async () => {
      try {
        const player = gameState.players.get(socket.id);
        if (!player) {
          console.log("Player not found for respawn:", socket.id);
          return;
        }

        // Reset player state
        player.gameOver = false;
        player.lives = 3;
        player.score = 0;
        player.tunnelTransition = null;

        // Get the center of the maze as the respawn position
        const respawnPosition = maze.findStartingPosition();

        // Clear ghosts near the respawn position in this sector
        clearGhostsNearPosition(gameState, respawnPosition, 5, player.sector);

        // Update player position
        player.position = respawnPosition;

        // Calculate absolute position
        const absolutePosition = {
          x: respawnPosition.x + player.sector.x * MAZE_WIDTH,
          y: respawnPosition.y + player.sector.y * MAZE_HEIGHT,
        };

        // Send updated game state to player
        socket.emit("game-state", {
          position: respawnPosition,
          visibleArea: getVisibleArea(respawnPosition, gameState, player),
          players: getVisiblePlayers(
            respawnPosition,
            gameState.players,
            socket.id,
          ),
          direction: "right", // Reset direction
          mazeDimensions: mazeDimensions,
          sector: player.sector,
          absolutePosition: absolutePosition,
        });

        console.log(`Player ${socket.id} respawned at:`, respawnPosition);
      } catch (error) {
        console.error("Error in respawn handler:", error);
      }
    });

    socket.on("disconnect", () => {
      try {
        const player = gameState.players.get(socket.id);
        if (player) {
          // Check if this was the last player in this sector
          const sectorKey = `${player.sector.x},${player.sector.y}`;
          let playersInSector = 0;

          for (const [id, p] of gameState.players.entries()) {
            if (
              id !== socket.id &&
              p.sector.x === player.sector.x &&
              p.sector.y === player.sector.y
            ) {
              playersInSector++;
            }
          }

          // If this was the last player, mark the sector for potential cleanup
          if (playersInSector === 0) {
            const sectorData = gameState.sectorContent.get(sectorKey);
            if (sectorData) {
              sectorData.lastActive = Date.now();
              gameState.sectorContent.set(sectorKey, sectorData);
              gameState.activeSectors.delete(sectorKey);
            }
          }
        }

        gameState.players.delete(socket.id);
        console.log("Player disconnected:", socket.id);
      } catch (error) {
        console.error("Error in disconnect handler:", error);
      }
    });
  });

  // Start game loops with error handling
  setInterval(() => {
    try {
      // Store the io reference in gameState so it can be accessed by ghost manager
      gameState.io = io;
      updateGhosts(gameState);
    } catch (error) {
      console.error("Error updating ghosts:", error);
    }
  }, 1000);

  // Update the setInterval for ghost spawning to use the new scheduleGhostSpawning function
  setInterval(() => {
    try {
      // Only spawn ghosts in active sectors
      for (const sectorKey of gameState.activeSectors) {
        const sectorData = gameState.sectorContent.get(sectorKey);

        const [sectorX, sectorY] = sectorKey.split(",").map(Number);
        const sector = { x: sectorX, y: sectorY };

        // Count ghosts in this sector
        let ghostsInSector = 0;
        for (const [_, ghost] of gameState.ghosts.entries()) {
          if (
            ghost.sector &&
            ghost.sector.x === sector.x &&
            ghost.sector.y === sector.y
          ) {
            ghostsInSector++;
          }
        }

        // Spawn ghosts if needed
        if (ghostsInSector < 4) {
          spawnGhosts(gameState, sector);
        }
      }
    } catch (error) {
      console.error("Error spawning ghosts:", error);
    }
  }, GHOST_SPAWN_INTERVAL);

  setInterval(() => {
    try {
      // Only handle pellets in active sectors
      for (const sectorKey of gameState.activeSectors) {
        const [sectorX, sectorY] = sectorKey.split(",").map(Number);
        const sector = { x: sectorX, y: sectorY };
        handlePellets(gameState, sector);
      }
    } catch (error) {
      console.error("Error handling pellets:", error);
    }
  }, DROPPER_SPAWN_INTERVAL);

  // Clean up inactive sectors
  setInterval(() => {
    try {
      const now = Date.now();
      const inactiveSectors = [];

      // Find sectors that have been inactive for too long
      for (const [sectorKey, sectorData] of gameState.sectorContent.entries()) {
        if (
          !gameState.activeSectors.has(sectorKey) &&
          sectorData.lastActive &&
          now - sectorData.lastActive > SECTOR_CLEANUP_INTERVAL
        ) {
          inactiveSectors.push(sectorKey);
        }
      }

      // Clean up inactive sectors
      for (const sectorKey of inactiveSectors) {
        const [sectorX, sectorY] = sectorKey.split(",").map(Number);
        const sector = { x: sectorX, y: sectorY };

        // Remove ghosts in this sector
        for (const [ghostId, ghost] of gameState.ghosts.entries()) {
          if (
            ghost.sector &&
            ghost.sector.x === sector.x &&
            ghost.sector.y === sector.y
          ) {
            gameState.ghosts.delete(ghostId);
          }
        }

        // Remove pellets in this sector
        for (const [pelletId, pellet] of gameState.pellets.entries()) {
          if (
            pellet.sector &&
            pellet.sector.x === sector.x &&
            pellet.sector.y === sector.y
          ) {
            gameState.pellets.delete(pelletId);
          }
        }

        // Remove droppers in this sector
        for (const [dropperId, dropper] of gameState.droppers.entries()) {
          if (
            dropper.sector &&
            dropper.sector.x === sector.x &&
            dropper.sector.y === sector.y
          ) {
            gameState.droppers.delete(dropperId);
          }
        }

        // Remove sector from content map
        gameState.sectorContent.delete(sectorKey);
        console.log(`Cleaned up inactive sector ${sectorKey}`);
      }
    } catch (error) {
      console.error("Error cleaning up inactive sectors:", error);
    }
  }, SECTOR_CLEANUP_INTERVAL);

  // Send regular updates to all players
  setInterval(() => {
    try {
      // Update all connected players with the latest game state
      for (const [playerId, player] of gameState.players.entries()) {
        // Skip players in game over state
        if (player.gameOver) continue;

        const socket = io.sockets.sockets.get(playerId);
        if (socket) {
          // Calculate absolute position
          const absolutePosition = {
            x: player.position.x + player.sector.x * MAZE_WIDTH,
            y: player.position.y + player.sector.y * MAZE_HEIGHT,
          };

          socket.emit("update-view", {
            position: player.position,
            visibleArea: getVisibleArea(player.position, gameState, player),
            players: getVisiblePlayers(
              player.position,
              gameState.players,
              playerId,
            ),
            direction: player.direction,
            tunnelTransition: player.tunnelTransition,
            powerMode: player.powerMode && player.powerModeEndTime > Date.now(),
            sector: player.sector,
            absolutePosition: absolutePosition,
          });
        }
      }
    } catch (error) {
      console.error("Error sending updates:", error);
    }
  }, UPDATE_INTERVAL);
}

// Function to clear ghosts near a position in a specific sector
function clearGhostsNearPosition(gameState, position, radius, sector) {
  if (!position || !sector) return;

  const ghostsToRemove = [];

  for (const [ghostId, ghost] of gameState.ghosts.entries()) {
    if (!ghost.position || !ghost.sector) continue;

    // Only consider ghosts in the same sector
    if (ghost.sector.x !== sector.x || ghost.sector.y !== sector.y) {
      continue;
    }

    const distance = Math.sqrt(
      Math.pow(ghost.position.x - position.x, 2) +
        Math.pow(ghost.position.y - position.y, 2),
    );

    if (distance < radius) {
      ghostsToRemove.push(ghostId);
    }
  }

  // Remove the ghosts
  ghostsToRemove.forEach((id) => {
    gameState.ghosts.delete(id);
    console.log(`Removed ghost ${id} near player spawn point`);
  });
}

// Update the getSectorId function to include player sector
function getSectorId(position, playerSector = { x: 0, y: 0 }) {
  if (
    !position ||
    typeof position.x !== "number" ||
    typeof position.y !== "number"
  ) {
    console.warn("Invalid position for getSectorId:", position);
    return "0,0"; // Default sector
  }

  // Include the player's sector in the sector ID
  return `${playerSector.x},${playerSector.y}`;
}

function updateSectorState(gameState, sectorId, sectorState) {
  try {
    // Update game state with loaded sector data
    if (sectorState && sectorState.ghosts) {
      sectorState.ghosts.forEach(([id, ghost]) => {
        if (id && ghost && ghost.position) {
          gameState.ghosts.set(id, ghost);
        }
      });
    }

    if (sectorState && sectorState.pellets) {
      sectorState.pellets.forEach(([id, pellet]) => {
        if (id && pellet && pellet.position) {
          gameState.pellets.set(id, pellet);
        }
      });
    }

    if (sectorState && sectorState.droppers) {
      sectorState.droppers.forEach(([id, dropper]) => {
        if (id && dropper && dropper.position) {
          gameState.droppers.set(id, dropper);
        }
      });
    }

    // Mark this sector as having content and being active
    const [sectorX, sectorY] = sectorId.split(",").map(Number);
    const sector = { x: sectorX, y: sectorY };
    const sectorKey = `${sectorX},${sectorY}`;

    gameState.sectorContent.set(sectorKey, {
      generated: Date.now(),
      lastActive: Date.now(),
    });

    gameState.activeSectors.add(sectorKey);
  } catch (error) {
    console.error("Error updating sector state:", error);
  }
}

// Update the getVisibleArea function to filter by sector
function getVisibleArea(position, gameState, player) {
  try {
    // Get the complete maze
    const mazeFull = gameState.maze.getStandardMaze();

    // Check if player is in a tunnel position
    const isTunnel = gameState.maze.isTunnelPosition(position.x, position.y);

    // Calculate absolute coordinates based on sector
    const absoluteX = position.x + player.sector.x * mazeFull[0].length;
    const absoluteY = position.y + player.sector.y * mazeFull.length;

    return {
      maze: mazeFull, // Return the complete maze
      pellets: getVisiblePellets(position, gameState.pellets, player),
      ghosts: getVisibleGhosts(position, gameState.ghosts, player),
      inTunnel: isTunnel ? isTunnel.direction : null,
      powerMode:
        player && player.powerMode && player.powerModeEndTime > Date.now(),
      absolutePosition: { x: absoluteX, y: absoluteY },
    };
  } catch (error) {
    console.error("Error getting visible area:", error);
    // Return empty data as fallback
    return {
      maze: [],
      pellets: [],
      ghosts: [],
      inTunnel: null,
      powerMode: false,
      absolutePosition: position,
    };
  }
}

// Update the getVisiblePellets function to filter by sector
function getVisiblePellets(position, pellets, player) {
  try {
    const visiblePellets = [];

    for (const [id, pellet] of pellets.entries()) {
      if (!pellet || !pellet.position) continue;

      // Only include pellets in the same sector as the player
      if (
        pellet.sector &&
        player.sector &&
        (pellet.sector.x !== player.sector.x ||
          pellet.sector.y !== player.sector.y)
      ) {
        continue;
      }

      // Include all pellets in the player's sector
      visiblePellets.push({
        id,
        x: pellet.position.x,
        y: pellet.position.y,
        isPowerPellet: pellet.isPowerPellet,
      });
    }

    return visiblePellets;
  } catch (error) {
    console.error("Error getting visible pellets:", error);
    return [];
  }
}

// Update the getVisibleGhosts function to filter by sector
function getVisibleGhosts(position, ghosts, player) {
  try {
    const visibleGhosts = [];
    const isPowerMode =
      player && player.powerMode && player.powerModeEndTime > Date.now();

    for (const [id, ghost] of ghosts.entries()) {
      if (!ghost || !ghost.position) continue;

      // Only include ghosts in the same sector as the player
      if (
        ghost.sector &&
        player.sector &&
        (ghost.sector.x !== player.sector.x ||
          ghost.sector.y !== player.sector.y)
      ) {
        continue;
      }

      // Include all ghosts in the player's sector
      visibleGhosts.push({
        id,
        x: ghost.position.x,
        y: ghost.position.y,
        color: isPowerMode ? "#0000FF" : ghost.color, // Blue when vulnerable
        vulnerable: isPowerMode,
      });
    }

    return visibleGhosts;
  } catch (error) {
    console.error("Error getting visible ghosts:", error);
    return [];
  }
}

// Update the getVisiblePlayers function to show all players in the same sector
function getVisiblePlayers(position, players, currentPlayerId) {
  try {
    const visiblePlayers = [];
    const currentPlayer = players.get(currentPlayerId);

    if (!currentPlayer || !currentPlayer.sector) {
      return visiblePlayers;
    }

    for (const [id, player] of players) {
      // Skip players in game over state
      if (player.gameOver) continue;

      if (!player || !player.position) continue;

      // Only include players in the same sector
      if (
        player.sector &&
        (player.sector.x !== currentPlayer.sector.x ||
          player.sector.y !== currentPlayer.sector.y)
      ) {
        continue;
      }

      // Include ALL players in the same sector, regardless of distance
      visiblePlayers.push({
        id,
        position: player.position,
        score: player.score,
        color: player.color,
        direction: player.direction,
        isCurrentPlayer: id === currentPlayerId,
      });
    }
    return visiblePlayers;
  } catch (error) {
    console.error("Error getting visible players:", error);
    return [];
  }
}
