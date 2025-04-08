import { v4 as uuidv4 } from "uuid";

const GHOST_COLORS = ["#FF0000", "#00FFFF", "#FFB8FF", "#FFB852"];
// Reduce ghost lifetime from 2 minutes to 1 minute for faster turnover
const GHOST_LIFETIME = 60000; // 1 minute (was 120000)
const MAX_GHOSTS_PER_SECTOR = 4; // Strict limit on ghosts per sector

export function spawnGhosts(gameState, targetSector = null) {
  const { players, ghosts, maze } = gameState;

  // Only spawn ghosts if there are players in the game
  if (players.size === 0) return;

  // Strict check: Count ghosts in this sector and enforce the limit
  const ghostsInSector = countGhostsInSector(gameState, targetSector);

  // If we already have the maximum number of ghosts, don't spawn more
  if (ghostsInSector >= MAX_GHOSTS_PER_SECTOR) {
    // Cleanup excess ghosts if somehow we have more than the limit
    if (ghostsInSector > MAX_GHOSTS_PER_SECTOR) {
      cleanupExcessGhosts(gameState, targetSector);
    }
    return;
  }

  // Spawn a single ghost
  const ghostId = uuidv4();

  // Get maze dimensions
  const mazeDimensions = maze.getMazeDimensions();

  // Choose a random position in the maze that's not a wall and not near a player
  let ghostPosition;
  let validPosition = false;
  let attempts = 0;

  while (!validPosition && attempts < 20) {
    attempts++;

    // Generate random position
    const randomX = Math.floor(Math.random() * mazeDimensions.width);
    const randomY = Math.floor(Math.random() * mazeDimensions.height);

    // Check if it's a valid position (not a wall)
    if (maze.isValidPosition(randomX, randomY)) {
      // Check if it's not too close to any player in this sector
      let tooCloseToPlayer = false;

      for (const [_, player] of players.entries()) {
        if (!player.position || !player.sector) continue;

        // Only check players in the target sector
        if (
          targetSector &&
          (player.sector.x !== targetSector.x ||
            player.sector.y !== targetSector.y)
        ) {
          continue;
        }

        const distance = Math.sqrt(
          Math.pow(player.position.x - randomX, 2) +
            Math.pow(player.position.y - randomY, 2),
        );

        if (distance < 5) {
          // Keep ghosts at least 5 units away from players
          tooCloseToPlayer = true;
          break;
        }
      }

      if (!tooCloseToPlayer) {
        ghostPosition = { x: randomX, y: randomY };
        validPosition = true;
      }
    }
  }

  // If we couldn't find a valid position, don't spawn a ghost
  if (!validPosition) return;

  // Create the ghost
  const ghost = {
    id: ghostId,
    position: ghostPosition,
    color: GHOST_COLORS[ghostsInSector % GHOST_COLORS.length],
    createdAt: Date.now(),
    target: null,
    moveCounter: 0, // Add a counter to control ghost movement speed
    sector: targetSector || { x: 0, y: 0 }, // Assign to target sector or default
  };

  ghosts.set(ghostId, ghost);

  // Set a timeout to remove the ghost after its lifetime
  setTimeout(() => {
    ghosts.delete(ghostId);
  }, GHOST_LIFETIME);
}

// Helper function to count ghosts in a specific sector
function countGhostsInSector(gameState, sector) {
  if (!sector) return 0;

  let count = 0;
  for (const [_, ghost] of gameState.ghosts.entries()) {
    if (
      ghost.sector &&
      ghost.sector.x === sector.x &&
      ghost.sector.y === sector.y
    ) {
      count++;
    }
  }
  return count;
}

// New function to clean up excess ghosts if we somehow exceed the limit
function cleanupExcessGhosts(gameState, sector) {
  if (!sector) return;

  // Get all ghosts in this sector
  const sectorGhosts = [];
  for (const [ghostId, ghost] of gameState.ghosts.entries()) {
    if (
      ghost.sector &&
      ghost.sector.x === sector.x &&
      ghost.sector.y === sector.y
    ) {
      sectorGhosts.push({ id: ghostId, createdAt: ghost.createdAt || 0 });
    }
  }

  // If we have more than the maximum, remove the oldest ones
  if (sectorGhosts.length > MAX_GHOSTS_PER_SECTOR) {
    // Sort by creation time (oldest first)
    sectorGhosts.sort((a, b) => a.createdAt - b.createdAt);

    // Remove excess ghosts
    const excessCount = sectorGhosts.length - MAX_GHOSTS_PER_SECTOR;
    for (let i = 0; i < excessCount; i++) {
      gameState.ghosts.delete(sectorGhosts[i].id);
      console.log(
        `Removed excess ghost ${sectorGhosts[i].id} from sector ${sector.x},${sector.y}`,
      );
    }
  }
}

// Update the updateGhosts function to respect sector boundaries
export function updateGhosts(gameState) {
  const { players, ghosts, maze } = gameState;

  // Skip if no players or ghosts
  if (players.size === 0 || ghosts.size === 0) return;

  // Check for excess ghosts in each active sector and clean them up
  const activeSectors = new Set();
  for (const [_, player] of players.entries()) {
    if (player.sector) {
      const sectorKey = `${player.sector.x},${player.sector.y}`;
      activeSectors.add(sectorKey);
    }
  }

  for (const sectorKey of activeSectors) {
    const [x, y] = sectorKey.split(",").map(Number);
    const sector = { x, y };
    const ghostCount = countGhostsInSector(gameState, sector);

    if (ghostCount > MAX_GHOSTS_PER_SECTOR) {
      cleanupExcessGhosts(gameState, sector);
    }
  }

  // Update each ghost
  for (const [ghostId, ghost] of ghosts.entries()) {
    if (!ghost.position || !ghost.sector) continue;

    // Increment the move counter
    ghost.moveCounter = (ghost.moveCounter || 0) + 1;

    // Only move every 3 frames to slow down ghosts
    if (ghost.moveCounter % 3 !== 0) continue;

    // Find the closest player to target in the same sector
    let closestPlayer = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const [_, player] of players.entries()) {
      // Skip players in game over state
      if (player.gameOver) continue;

      if (!player.position || !player.sector) continue;

      // Only target players in the same sector as the ghost
      if (
        ghost.sector.x !== player.sector.x ||
        ghost.sector.y !== player.sector.y
      ) {
        continue;
      }

      const distance = calculateDistance(ghost.position, player.position);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    }

    // If there's a player to target, move towards them
    if (closestPlayer && closestPlayer.position) {
      ghost.target = closestPlayer.id;

      // Calculate direction towards player
      const dx = closestPlayer.position.x - ghost.position.x;
      const dy = closestPlayer.position.y - ghost.position.y;

      // Ensure ghost position is on a grid cell
      const currentGridX = Math.round(ghost.position.x);
      const currentGridY = Math.round(ghost.position.y);

      // Set the ghost's position to the exact grid cell
      ghost.position = { x: currentGridX, y: currentGridY };

      // Determine the best direction to move (up, down, left, right)
      const possibleMoves = [
        {
          direction: "right",
          x: currentGridX + 1,
          y: currentGridY,
          priority: dx > 0 ? 1 : 4,
        },
        {
          direction: "left",
          x: currentGridX - 1,
          y: currentGridY,
          priority: dx < 0 ? 1 : 4,
        },
        {
          direction: "down",
          x: currentGridX,
          y: currentGridY + 1,
          priority: dy > 0 ? 1 : 4,
        },
        {
          direction: "up",
          x: currentGridX,
          y: currentGridY - 1,
          priority: dy < 0 ? 1 : 4,
        },
      ];

      // Filter out invalid moves (walls)
      const validMoves = possibleMoves.filter((move) =>
        maze.isValidPosition(move.x, move.y),
      );

      // If there are no valid moves, don't move the ghost
      if (validMoves.length === 0) {
        continue;
      }

      // Sort by priority (lower is better)
      validMoves.sort((a, b) => a.priority - b.priority);

      // Occasionally make a random move to make ghosts less predictable (20% chance)
      const moveIndex =
        Math.random() < 0.2 ? Math.floor(Math.random() * validMoves.length) : 0;

      const chosenMove = validMoves[moveIndex];
      ghost.position = { x: chosenMove.x, y: chosenMove.y };
      ghost.lastDirection = chosenMove.direction;

      // Check for sector transitions
      const mazeDimensions = maze.getMazeDimensions();

      // Handle sector transitions for ghosts
      if (ghost.position.x < 0) {
        ghost.position.x = mazeDimensions.width - 1;
        ghost.sector.x -= 1;
      } else if (ghost.position.x >= mazeDimensions.width) {
        ghost.position.x = 0;
        ghost.sector.x += 1;
      } else if (ghost.position.y < 0) {
        ghost.position.y = mazeDimensions.height - 1;
        ghost.sector.y -= 1;
      } else if (ghost.position.y >= mazeDimensions.height) {
        ghost.position.y = 0;
        ghost.sector.y += 1;
      }

      // Check for collisions with players after ghost movement
      // This ensures stationary players will still lose a life if hit by a ghost
      for (const [playerId, player] of players.entries()) {
        // Skip players in game over state
        if (player.gameOver) continue;

        if (!player.position || !player.sector) continue;

        // Only check players in the same sector as the ghost
        if (
          ghost.sector.x !== player.sector.x ||
          ghost.sector.y !== player.sector.y
        ) {
          continue;
        }

        // Calculate distance between ghost and player
        const collisionDistance = Math.sqrt(
          Math.pow(ghost.position.x - player.position.x, 2) +
            Math.pow(ghost.position.y - player.position.y, 2),
        );

        // If the ghost is close enough to the player, consider it a collision
        if (collisionDistance < 0.8) {
          const isPowerMode =
            player.powerMode && player.powerModeEndTime > Date.now();

          if (isPowerMode) {
            // If player is in power mode, remove the ghost
            ghosts.delete(ghostId);
            // Award points for eating ghosts
            player.score += 200;
            player.scoreUpdated = true;
            console.log(
              `Stationary player ${playerId} ate a ghost! Score +200`,
            );
            break; // Exit the loop since this ghost is removed
          } else {
            // Player loses a life
            if (player.lives > 0) {
              player.lives -= 1;
              console.log(
                `Stationary player ${playerId} lost a life. Lives remaining: ${player.lives}`,
              );

              // Find the socket to inform client about life loss
              const socket = gameState.io?.sockets.sockets.get(playerId);
              if (socket) {
                socket.emit("life-lost", player.lives);
              }

              // Respawn the player at the center of the maze
              const safePosition = maze.findStartingPosition();
              player.position = { ...safePosition };

              // Clear ghosts near the respawn position
              const ghostsToRemove = [];
              for (const [otherGhostId, otherGhost] of ghosts.entries()) {
                if (
                  otherGhost.sector.x === player.sector.x &&
                  otherGhost.sector.y === player.sector.y
                ) {
                  const distance = Math.sqrt(
                    Math.pow(otherGhost.position.x - safePosition.x, 2) +
                      Math.pow(otherGhost.position.y - safePosition.y, 2),
                  );

                  if (distance < 5) {
                    ghostsToRemove.push(otherGhostId);
                  }
                }
              }

              // Remove the ghosts
              ghostsToRemove.forEach((id) => {
                ghosts.delete(id);
              });

              if (player.lives <= 0) {
                player.gameOver = true;
                // Find the socket to inform client about game over
                if (socket) {
                  socket.emit("game-over", { score: player.score });
                }
              }
            }
          }
        }
      }
    }
  }
}

function calculateDistance(pos1, pos2) {
  if (!pos1 || !pos2) return Number.POSITIVE_INFINITY;
  return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
}

// Add a delayed ghost spawning function
export function scheduleGhostSpawning(gameState, sector, delay = 10000) {
  const sectorKey = `${sector.x},${sector.y}`;

  // Check if this sector already has ghosts scheduled
  if (gameState.sectorContent.get(sectorKey)?.ghostsScheduled) {
    return;
  }

  // Mark this sector as having ghosts scheduled
  const sectorData = gameState.sectorContent.get(sectorKey) || {};
  sectorData.ghostsScheduled = true;
  gameState.sectorContent.set(sectorKey, sectorData);

  console.log(
    `Scheduling ghost spawning for sector ${sectorKey} in ${delay / 1000} seconds`,
  );

  // Schedule ghost spawning after the delay
  setTimeout(() => {
    try {
      // Check if the sector is still active
      if (gameState.activeSectors.has(sectorKey)) {
        // Count current ghosts in this sector
        const currentGhostCount = countGhostsInSector(gameState, sector);

        // Only spawn ghosts if we're under the limit
        if (currentGhostCount < MAX_GHOSTS_PER_SECTOR) {
          // Calculate how many ghosts to spawn
          const ghostsToSpawn = MAX_GHOSTS_PER_SECTOR - currentGhostCount;
          const ghostColors = ["#FF0000", "#00FFFF", "#FFB8FF", "#FFB852"];
          let ghostsAdded = 0;

          for (let i = 0; i < ghostsToSpawn; i++) {
            // Find a valid position for the ghost
            let ghostPosition = null;
            let attempts = 0;
            const maze = gameState.maze;
            const mazeLayout = maze.getStandardMaze();

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
              const ghostId = `ghost-${sectorKey}-${i}-${Date.now()}`;
              gameState.ghosts.set(ghostId, {
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

          console.log(
            `Spawned ${ghostsAdded} ghosts in sector ${sectorKey} after delay`,
          );
        } else {
          console.log(
            `Sector ${sectorKey} already has ${currentGhostCount} ghosts, not spawning more`,
          );
        }

        // Update sector data to indicate ghosts have been generated
        const sectorData = gameState.sectorContent.get(sectorKey) || {};
        sectorData.ghostsGenerated = true;
        gameState.sectorContent.set(sectorKey, sectorData);
      }
    } catch (error) {
      console.error(
        `Error spawning delayed ghosts for sector ${sectorKey}:`,
        error,
      );
    }
  }, delay);
}
