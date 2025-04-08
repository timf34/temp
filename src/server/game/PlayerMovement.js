// Update the checkGhostCollision function to strictly check sector boundaries
function checkGhostCollision(position, ghosts, player) {
  const isPowerMode = player.powerMode && player.powerModeEndTime > Date.now();
  const ghostsEaten = [];

  for (const [id, ghost] of ghosts.entries()) {
    if (!ghost.position || !ghost.sector) continue;

    // STRICT sector check - only consider ghosts in the EXACT same sector
    if (
      ghost.sector.x !== player.sector.x ||
      ghost.sector.y !== player.sector.y
    ) {
      continue;
    }

    const distance = Math.sqrt(
      Math.pow(ghost.position.x - position.x, 2) +
        Math.pow(ghost.position.y - position.y, 2),
    );

    if (distance < 0.8) {
      // If in power mode, eat the ghost instead of losing a life
      if (isPowerMode) {
        ghostsEaten.push(id);
      } else {
        return { collision: true, ghostsEaten: [] };
      }
    }
  }

  return {
    collision: false,
    ghostsEaten,
  };
}

// Export the function to be used in other modules
export function handlePlayerMovement(player, direction, gameState) {
  if (!player || !player.position) {
    console.error("Invalid player data in handlePlayerMovement");
    return null;
  }

  const { position } = player;
  const { maze, pellets, ghosts } = gameState;

  // Check if power mode has expired
  if (player.powerMode && player.powerModeEndTime < Date.now()) {
    player.powerMode = false;
    console.log(`Player ${player.id} power mode expired`);
  }

  // Calculate new position based on direction - EXACT ONE CELL MOVEMENT
  // First, ensure current position is exactly on a grid cell
  const currentGridX = Math.round(position.x);
  const currentGridY = Math.round(position.y);

  // Set the player's position to the exact grid cell to prevent drift
  player.position = { x: currentGridX, y: currentGridY };

  // Calculate target position (exactly one cell in the requested direction)
  const newPosition = {
    x: currentGridX,
    y: currentGridY,
  };

  switch (direction) {
    case "up":
      newPosition.y -= 1;
      break;
    case "down":
      newPosition.y += 1;
      break;
    case "left":
      newPosition.x -= 1;
      break;
    case "right":
      newPosition.x += 1;
      break;
    default:
      console.log("Invalid direction:", direction);
      return null;
  }

  // Get maze dimensions for sector transitions
  const mazeDimensions = maze.getMazeDimensions();

  // UPDATED TRANSITION LOGIC
  // Check if the player is trying to move outside of the current page boundaries
  let sectorChange = null;
  let tunnelTransition = null;

  // 1. Handle the tunnel row specially (row 10)
  const tunnelRow = maze.getTunnelRow();
  if (currentGridY === tunnelRow) {
    if (newPosition.x < 0) {
      // Moving left out of bounds at the tunnel
      tunnelTransition = "left-to-right";
      sectorChange = { direction: "left" };
      newPosition.x = mazeDimensions.width - 1; // Appear on right side of previous sector
    } else if (newPosition.x >= mazeDimensions.width) {
      // Moving right out of bounds at the tunnel
      tunnelTransition = "right-to-left";
      sectorChange = { direction: "right" };
      newPosition.x = 0; // Appear on left side of next sector
    }
  }
  // 2. Handle normal boundaries (not tunnel)
  else {
    // Check if the new position is outside the boundaries
    if (newPosition.x < 0) {
      // Moving left out of bounds
      tunnelTransition = "left-to-right";
      sectorChange = { direction: "left" };
      newPosition.x = mazeDimensions.width - 1;
    } else if (newPosition.x >= mazeDimensions.width) {
      // Moving right out of bounds
      tunnelTransition = "right-to-left";
      sectorChange = { direction: "right" };
      newPosition.x = 0;
    } else if (newPosition.y < 0) {
      // Moving up out of bounds
      sectorChange = { direction: "up" };
      newPosition.y = mazeDimensions.height - 1;
    } else if (newPosition.y >= mazeDimensions.height) {
      // Moving down out of bounds
      sectorChange = { direction: "down" };
      newPosition.y = 0;
    } else if (!isValidMove(newPosition, maze)) {
      // Normal wall collision - can't move
      console.log("Invalid move - wall collision");
      return null;
    }
  }

  // If we're doing a sector change, update the player's sector change info
  if (sectorChange) {
    player.tunnelTransition = tunnelTransition;
    player.sectorChange = sectorChange;
    console.log(
      `Player sector transition: ${sectorChange.direction}, new position: ${newPosition.x},${newPosition.y}`,
    );
  } else {
    // Only check if the move is valid if we're not changing sectors
    if (!isValidMove(newPosition, maze)) {
      console.log("Invalid move - wall collision");
      return null;
    }

    // Clear the tunnel transition flag if not in a tunnel
    player.tunnelTransition = null;
    player.sectorChange = null;
  }

  // Check for pellet collection
  const pelletsCollected = checkPelletCollection(
    player,
    newPosition,
    gameState,
  );
  if (pelletsCollected) {
    // Update the player's score in the game state
    player.scoreUpdated = true;
  }

  // Check for ghost collision - only with ghosts in the same sector
  const { collision, ghostsEaten } = checkGhostCollision(
    newPosition,
    gameState.ghosts,
    player,
  );

  // Handle ghost eating in power mode
  if (ghostsEaten.length > 0) {
    for (const ghostId of ghostsEaten) {
      gameState.ghosts.delete(ghostId);
      // Award points for eating ghosts
      player.score += 200;
      player.scoreUpdated = true;
      console.log(`Player ${player.id} ate a ghost! Score +200`);
    }
  }

  if (collision) {
    handleGhostCollision(player, gameState);

    // If player still has lives, respawn them
    if (player.lives > 0) {
      // Find a safe starting position in the center of the maze
      const safePosition = maze.findStartingPosition();

      // Clear ghosts near the respawn position
      clearGhostsNearPosition(gameState, safePosition, 5, player.sector);

      console.log("Player hit by ghost, respawning at:", safePosition);
      return safePosition;
    } else {
      // Player is out of lives - game over
      console.log(`Player ${player.id} is out of lives. Game over.`);
      player.gameOver = true;
      return null;
    }
  }

  return newPosition;
}

function isValidMove(position, maze) {
  if (!position || !maze) return false;

  try {
    // Check if the position is valid in the maze (not a wall)
    return maze.isValidPosition(position.x, position.y);
  } catch (error) {
    console.error("Error checking valid move:", error);
    return false;
  }
}

// Fix the pellet collection function to properly remove pellets
function checkPelletCollection(player, position, gameState) {
  const { pellets } = gameState;
  let pelletsCollected = false;

  // Check if there's a pellet at the player's position
  for (const [id, pellet] of pellets.entries()) {
    if (!pellet || !pellet.position || !pellet.sector) continue;

    // Only check pellets in the same sector
    if (
      pellet.sector.x !== player.sector.x ||
      pellet.sector.y !== player.sector.y
    ) {
      continue;
    }

    // Use a more precise collision detection for pellets
    const distance = Math.sqrt(
      Math.pow(pellet.position.x - position.x, 2) +
        Math.pow(pellet.position.y - position.y, 2),
    );

    // Use a smaller collision radius for better pellet collection
    if (distance < 0.5) {
      // Remove the pellet
      pellets.delete(id);
      console.log(
        `Player ${player.id} collected a pellet. Score +${pellet.value || 10}`,
      );

      // Increase player's score
      player.score += pellet.value || 10;
      pelletsCollected = true;

      // If it's a power pellet, make the player able to eat ghosts
      if (pellet.isPowerPellet) {
        player.powerMode = true;
        player.powerModeEndTime = Date.now() + 10000; // Power mode lasts for 10 seconds
        console.log(`Player ${player.id} activated power mode!`);
      }
    }
  }

  return pelletsCollected;
}

function handleGhostCollision(player, gameState) {
  // Only reduce lives if player has lives left
  if (player.lives > 0) {
    player.lives -= 1;
    console.log(
      `Player ${player.id} lost a life. Lives remaining: ${player.lives}`,
    );
  }
}

// Function to clear ghosts near a position
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
