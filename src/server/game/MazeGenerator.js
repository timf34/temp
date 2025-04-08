export function createMaze() {
  // Create a standard Pac-Man style maze with fixed layout
  const standardMaze = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 2, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 2, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], // tunnel row
    [1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 1],
    [1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];

  // Define the maze width and height
  const MAZE_WIDTH = standardMaze[0].length;
  const MAZE_HEIGHT = standardMaze.length;

  // Define the player spawn position (center of the maze)
  // This is a guaranteed walkable cell (not a wall)
  const PLAYER_SPAWN_X = 9;
  const PLAYER_SPAWN_Y = 16;

  // Tunnel row index
  const TUNNEL_ROW = 10;

  return {
    // Return the standard maze layout
    generate: () => {
      return standardMaze;
    },

    // Check if a position is valid for movement
    isValidPosition: (x, y) => {
      try {
        // Convert to maze coordinates
        const mazeX = Math.floor(x);
        const mazeY = Math.floor(y);

        // Ensure coordinates are within bounds
        if (
          mazeX < 0 ||
          mazeX >= MAZE_WIDTH ||
          mazeY < 0 ||
          mazeY >= MAZE_HEIGHT
        ) {
          return false;
        }

        // Check if the position is a wall
        return standardMaze[mazeY][mazeX] !== 1;
      } catch (error) {
        console.error("Error in isValidPosition:", error);
        return false;
      }
    },

    // Find a valid starting position
    findStartingPosition: () => {
      // Return a guaranteed walkable position (not a wall)
      return { x: PLAYER_SPAWN_X, y: PLAYER_SPAWN_Y };
    },

    // Get maze dimensions
    getMazeDimensions: () => {
      return { width: MAZE_WIDTH, height: MAZE_HEIGHT };
    },

    // Check if position is at a tunnel edge
    isTunnelPosition: (x, y) => {
      const mazeX = Math.floor(x);
      const mazeY = Math.floor(y);

      // Check if we're in the tunnel row (row 10)
      if (mazeY === TUNNEL_ROW) {
        // Left edge of the maze
        if (mazeX <= 0) return { direction: "left" };
        // Right edge of the maze
        if (mazeX >= MAZE_WIDTH - 1) return { direction: "right" };
      }

      return false;
    },

    // Get the standard maze layout
    getStandardMaze: () => {
      return standardMaze;
    },

    // Get the tunnel row index
    getTunnelRow: () => {
      return TUNNEL_ROW;
    },
  };
}
