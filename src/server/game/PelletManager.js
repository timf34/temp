import { v4 as uuidv4 } from "uuid";

const PELLET_VALUE = 10;
const POWER_PELLET_VALUE = 50;
const POWER_PELLET_CHANCE = 0.1; // 10% chance for a power pellet
const DROPPER_LIFETIME = 60000; // 1 minute

// Initialize the maze with pellets based on the maze layout
function initializePellets(gameState, sector = { x: 0, y: 0 }) {
  const { maze, pellets } = gameState;
  const mazeLayout = maze.getStandardMaze();
  let pelletCount = 0;
  const sectorKey = `${sector.x},${sector.y}`;

  console.log(`Initializing pellets for sector ${sectorKey}...`);

  // Loop through the maze and add pellets where there are paths
  mazeLayout.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === 0) {
        // Regular path - add a regular pellet
        const pelletId = `pellet-${sectorKey}-${x}-${y}`;
        pellets.set(pelletId, {
          id: pelletId,
          position: { x, y },
          value: PELLET_VALUE,
          isPowerPellet: false,
          sector: { ...sector }, // Set the sector for this pellet
          createdAt: Date.now(),
        });
        pelletCount++;
      } else if (cell === 2) {
        // Power pellet location - add a power pellet
        const pelletId = `power-${sectorKey}-${x}-${y}`;
        pellets.set(pelletId, {
          id: pelletId,
          position: { x, y },
          value: POWER_PELLET_VALUE,
          isPowerPellet: true,
          sector: { ...sector }, // Set the sector for this pellet
          createdAt: Date.now(),
        });
        pelletCount++;
      }
    });
  });

  console.log(`Initialized ${pelletCount} pellets in sector ${sectorKey}`);
}

// Generate pellets for a specific sector
function generatePelletsForSector(gameState, sector) {
  const { maze, pellets } = gameState;
  const mazeLayout = maze.getStandardMaze();
  let pelletCount = 0;
  const sectorKey = `${sector.x},${sector.y}`;

  console.log(`Generating pellets for sector ${sectorKey}...`);

  // Loop through the maze and add pellets where there are paths
  mazeLayout.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === 0) {
        // Regular path - add a regular pellet
        const pelletId = `pellet-${sectorKey}-${x}-${y}`;
        pellets.set(pelletId, {
          id: pelletId,
          position: { x, y },
          value: PELLET_VALUE,
          isPowerPellet: false,
          sector: { ...sector }, // Set the sector for this pellet
          createdAt: Date.now(),
        });
        pelletCount++;
      } else if (cell === 2) {
        // Power pellet location - add a power pellet
        const pelletId = `power-${sectorKey}-${x}-${y}`;
        pellets.set(pelletId, {
          id: pelletId,
          position: { x, y },
          value: POWER_PELLET_VALUE,
          isPowerPellet: true,
          sector: { ...sector }, // Set the sector for this pellet
          createdAt: Date.now(),
        });
        pelletCount++;
      }
    });
  });

  console.log(`Generated ${pelletCount} pellets for sector ${sectorKey}`);
  return pelletCount;
}

// Add this function to respawn pellets after some time
function respawnPellets(gameState, sector) {
  const { maze, pellets } = gameState;
  const mazeLayout = maze.getStandardMaze();
  const now = Date.now();
  const sectorKey = `${sector.x},${sector.y}`;

  // Create a map of existing pellet positions in this sector
  const existingPelletPositions = new Map();
  for (const [_, pellet] of pellets.entries()) {
    if (!pellet || !pellet.position || !pellet.sector) continue;

    // Only consider pellets in this sector
    if (pellet.sector.x !== sector.x || pellet.sector.y !== sector.y) {
      continue;
    }

    const key = `${Math.floor(pellet.position.x)},${Math.floor(pellet.position.y)}`;
    existingPelletPositions.set(key, true);
  }

  // Check each cell in the maze
  mazeLayout.forEach((row, y) => {
    row.forEach((cell, x) => {
      const posKey = `${x},${y}`;

      // If this is a path or power pellet location and there's no pellet here
      if ((cell === 0 || cell === 2) && !existingPelletPositions.has(posKey)) {
        // Add a new pellet
        const pelletId = `pellet-${sectorKey}-${x}-${y}-${now}`;
        const isPowerPellet = cell === 2;

        pellets.set(pelletId, {
          id: pelletId,
          position: { x, y },
          value: isPowerPellet ? POWER_PELLET_VALUE : PELLET_VALUE,
          isPowerPellet,
          sector: { ...sector },
          createdAt: now,
        });

        console.log(
          `Respawned a ${isPowerPellet ? "power " : ""}pellet at ${x}, ${y} in sector ${sectorKey}`,
        );
      }
    });
  });
}

// Update the handlePellets function to ensure pellets are initialized for a specific sector
export function handlePellets(gameState, sector = { x: 0, y: 0 }) {
  const { players, pellets, droppers } = gameState;
  const sectorKey = `${sector.x},${sector.y}`;

  // Skip if no players
  if (players.size === 0) return;

  // Count pellets in this sector
  let pelletsInSector = 0;
  for (const [_, pellet] of pellets.entries()) {
    if (
      pellet.sector &&
      pellet.sector.x === sector.x &&
      pellet.sector.y === sector.y
    ) {
      pelletsInSector++;
    }
  }

  // If no pellets exist in this sector, initialize it
  if (pelletsInSector === 0) {
    console.log(`No pellets found in sector ${sectorKey}, initializing...`);
    initializePellets(gameState, sector);
  }

  // Periodically respawn pellets in this sector
  if (Math.random() < 0.1) {
    // 10% chance each call
    respawnPellets(gameState, sector);
  }

  // Spawn new droppers in this sector
  spawnDroppers(gameState, sector);

  // Update existing droppers in this sector
  updateDroppers(gameState, sector);
}

function spawnDroppers(gameState, sector) {
  const { players, droppers, maze } = gameState;
  const sectorKey = `${sector.x},${sector.y}`;

  // Count droppers in this sector
  let droppersInSector = 0;
  for (const [_, dropper] of droppers.entries()) {
    if (
      dropper.sector &&
      dropper.sector.x === sector.x &&
      dropper.sector.y === sector.y
    ) {
      droppersInSector++;
    }
  }

  // Limit the number of droppers per sector
  if (droppersInSector >= 3) return;

  // Only spawn a dropper occasionally (10% chance per call)
  if (Math.random() > 0.1) return;

  // Find players in this sector
  const playersInSector = [];
  for (const [_, player] of players.entries()) {
    if (
      player.sector &&
      player.sector.x === sector.x &&
      player.sector.y === sector.y
    ) {
      playersInSector.push(player);
    }
  }

  // If no players in this sector, don't spawn droppers
  if (playersInSector.length === 0) return;

  // Choose a random player in this sector
  const randomPlayer =
    playersInSector[Math.floor(Math.random() * playersInSector.length)];
  const dropperId = uuidv4();

  // Get maze dimensions
  const mazeDimensions = maze.getMazeDimensions();

  // Choose a random position in the maze that's not a wall
  let dropperPosition;
  let validPosition = false;
  let attempts = 0;

  while (!validPosition && attempts < 20) {
    attempts++;

    // Generate random position
    const randomX = Math.floor(Math.random() * mazeDimensions.width);
    const randomY = Math.floor(Math.random() * mazeDimensions.height);

    // Check if it's a valid position (not a wall)
    if (maze.isValidPosition(randomX, randomY)) {
      dropperPosition = { x: randomX, y: randomY };
      validPosition = true;
    }
  }

  // If we couldn't find a valid position, don't spawn a dropper
  if (!validPosition) return;

  // Create the dropper
  const dropper = {
    id: dropperId,
    position: dropperPosition,
    createdAt: Date.now(),
    lastDropTime: Date.now(),
    dropInterval: 5000 + Math.random() * 5000, // Drop every 5-10 seconds
    pelletCount: 5 + Math.floor(Math.random() * 10), // Drop 5-15 pellets
    sector: { ...sector }, // Set the sector for this dropper
  };

  droppers.set(dropperId, dropper);
  console.log(`Spawned dropper ${dropperId} in sector ${sectorKey}`);

  // Set a timeout to remove the dropper after its lifetime
  setTimeout(() => {
    droppers.delete(dropperId);
  }, DROPPER_LIFETIME);
}

function updateDroppers(gameState, sector) {
  const { pellets, droppers, maze } = gameState;
  const now = Date.now();
  const sectorKey = `${sector.x},${sector.y}`;

  // Update each dropper in this sector
  for (const [dropperId, dropper] of droppers.entries()) {
    // Skip droppers in other sectors
    if (
      !dropper.sector ||
      dropper.sector.x !== sector.x ||
      dropper.sector.y !== sector.y
    ) {
      continue;
    }

    // Check if it's time to drop a pellet
    if (
      now - dropper.lastDropTime >= dropper.dropInterval &&
      dropper.pelletCount > 0
    ) {
      // Drop a pellet
      const pelletId = `pellet-${sectorKey}-${dropper.position.x}-${dropper.position.y}-${now}`;
      const isPowerPellet = Math.random() < POWER_PELLET_CHANCE;

      // Make sure the pellet is in a valid position
      if (maze.isValidPosition(dropper.position.x, dropper.position.y)) {
        const pellet = {
          id: pelletId,
          position: { ...dropper.position },
          value: isPowerPellet ? POWER_PELLET_VALUE : PELLET_VALUE,
          isPowerPellet,
          sector: { ...dropper.sector }, // Set the sector to match the dropper
          createdAt: now,
        };

        pellets.set(pelletId, pellet);
        console.log(
          `Dropper ${dropperId} dropped a pellet at ${dropper.position.x}, ${dropper.position.y} in sector ${sectorKey}`,
        );
      }

      // Update dropper state
      dropper.lastDropTime = now;
      dropper.pelletCount -= 1;

      // If no more pellets to drop, remove the dropper
      if (dropper.pelletCount <= 0) {
        droppers.delete(dropperId);
        console.log(
          `Dropper ${dropperId} in sector ${sectorKey} has no more pellets and was removed`,
        );
      }
    }
  }
}

export function getVisiblePellets(
  position,
  pellets,
  player,
  visibilityRadius = 10,
) {
  const visiblePellets = [];

  for (const [id, pellet] of pellets.entries()) {
    if (!pellet || !pellet.position || !pellet.sector) continue;

    // Only include pellets in the same sector as the player
    if (
      player.sector &&
      (pellet.sector.x !== player.sector.x ||
        pellet.sector.y !== player.sector.y)
    ) {
      continue;
    }

    const distance = Math.sqrt(
      Math.pow(pellet.position.x - position.x, 2) +
        Math.pow(pellet.position.y - position.y, 2),
    );

    if (distance <= visibilityRadius) {
      visiblePellets.push({
        id,
        x: pellet.position.x,
        y: pellet.position.y,
        isPowerPellet: pellet.isPowerPellet,
      });
    }
  }

  return visiblePellets;
}

// Export the function to generate pellets for a sector
export { generatePelletsForSector };
