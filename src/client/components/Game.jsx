"use client";

import { useEffect, useRef, useState } from "react";

function Game({ gameState, onMove, gameOver: propsGameOver }) {
  const canvasRef = useRef(null);
  const [touchStart, setTouchStart] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 }); // Square canvas
  const [ghostCollision, setGhostCollision] = useState(false);
  const [tunnelTransition, setTunnelTransition] = useState(null);
  const [transitionOffset, setTransitionOffset] = useState(0);
  const animationRef = useRef(null);
  const lastGameStateRef = useRef(null);
  const mazeOffsetRef = useRef({ x: 0, y: 0 });
  const [showPlayerCount, setShowPlayerCount] = useState(true);
  const transitionInProgressRef = useRef(false); // Track if a transition is already in progress
  const lastTransitionRef = useRef(null); // Track the last transition to avoid duplicates

  // Add touch controls for mobile devices
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      onMove(deltaX > 0 ? "right" : "left");
    } else {
      // Vertical swipe
      onMove(deltaY > 0 ? "down" : "up");
    }

    setTouchStart(null);
  };

  // Resize canvas to fill container as a square
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        const size = Math.min(width, height); // Make it square
        setCanvasSize({ width: size, height: size });
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  // Reset ghost collision state after a delay
  useEffect(() => {
    if (ghostCollision) {
      const timer = setTimeout(() => {
        setGhostCollision(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [ghostCollision]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      const directions = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };

      if (directions[e.key]) {
        e.preventDefault(); // Prevent scrolling with arrow keys
        onMove(directions[e.key]);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [onMove]);

  // Update lastGameStateRef when gameState changes and handle transitions
  useEffect(() => {
    if (gameState) {
      lastGameStateRef.current = gameState;

      // Check for ghost collision
      const prevPlayerPos = gameState.players?.find(
        (p) => p.isCurrentPlayer,
      )?.position;
      if (
        prevPlayerPos &&
        (!gameState.players ||
          !gameState.players.some((p) => p.isCurrentPlayer))
      ) {
        setGhostCollision(true);
      }

      // Check for tunnel transition - only start a new transition if:
      // 1. One isn't already in progress
      // 2. This is a different transition than the last one we processed
      if (
        gameState.tunnelTransition &&
        !transitionInProgressRef.current &&
        gameState.tunnelTransition !== lastTransitionRef.current
      ) {
        console.log("Starting new transition:", gameState.tunnelTransition);
        setTunnelTransition(gameState.tunnelTransition);
        setTransitionOffset(0); // Reset transition offset
        transitionInProgressRef.current = true; // Mark that a transition is in progress
        lastTransitionRef.current = gameState.tunnelTransition; // Remember this transition

        // Auto-clear the transition after a timeout as a safety measure
        setTimeout(() => {
          if (transitionInProgressRef.current) {
            console.log("Auto-clearing stuck transition");
            setTunnelTransition(null);
            setTransitionOffset(0);
            transitionInProgressRef.current = false;
          }
        }, 1000); // Safety timeout after 1 second
      }
    }
  }, [gameState]);

  // Handle tunnel transition animation
  useEffect(() => {
    if (tunnelTransition) {
      let animationStartTime = null;
      const animationDuration = 500; // 500ms for the transition

      const animateTunnelTransition = (timestamp) => {
        if (!animationStartTime) animationStartTime = timestamp;
        const elapsed = timestamp - animationStartTime;
        const progress = Math.min(elapsed / animationDuration, 1);

        // Calculate the offset based on the direction
        const maxOffset = canvasSize.width;
        let newOffset = 0;

        if (tunnelTransition === "left-to-right") {
          // Moving from left to right (maze slides left)
          newOffset = -maxOffset * progress;
        } else if (tunnelTransition === "right-to-left") {
          // Moving from right to left (maze slides right)
          newOffset = maxOffset * progress;
        }

        setTransitionOffset(newOffset);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animateTunnelTransition);
        } else {
          // Animation complete - IMPORTANT: Reset the transition state
          console.log("Transition animation complete, resetting state");
          setTunnelTransition(null);
          setTransitionOffset(0);
          transitionInProgressRef.current = false; // Mark that the transition is complete
        }
      };

      animationRef.current = requestAnimationFrame(animateTunnelTransition);

      // Clean up animation on unmount or when tunnelTransition changes
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [tunnelTransition, canvasSize.width]);

  // Add game over display and fix pellet rendering
  useEffect(() => {
    const renderGame = () => {
      const currentGameState = lastGameStateRef.current;
      if (!currentGameState) {
        animationRef.current = requestAnimationFrame(renderGame);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        animationRef.current = requestAnimationFrame(renderGame);
        return;
      }

      const ctx = canvas.getContext("2d");
      const {
        visibleArea,
        players,
        position,
        powerMode,
        sector,
        absolutePosition,
      } = currentGameState;

      // Clear canvas
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate cell size to fill the canvas completely
      const mazeWidth = visibleArea?.maze?.[0]?.length || 19;
      const mazeHeight = visibleArea?.maze?.length || 22;

      // Adjust cell size to ensure the maze fills the canvas
      const cellSize = Math.min(
        canvas.width / mazeWidth,
        canvas.height / mazeHeight,
      );

      // Calculate offset to center the maze
      const offsetX = (canvas.width - mazeWidth * cellSize) / 2;
      const offsetY = (canvas.height - mazeHeight * cellSize) / 2;

      // Save the canvas state for the transition animation
      ctx.save();

      // Apply transition offset if in tunnel transition
      if (tunnelTransition) {
        ctx.translate(transitionOffset, 0);
      }

      // Apply centering offset
      ctx.translate(offsetX, offsetY);

      // Draw maze walls - FIXED POSITION, NOT MOVING WITH PLAYER
      if (visibleArea && visibleArea.maze) {
        visibleArea.maze.forEach((row, y) => {
          row.forEach((cell, x) => {
            const cellX = x * cellSize;
            const cellY = y * cellSize;

            if (cell === 1) {
              // Wall - make it very visible
              ctx.fillStyle = "#0000FF"; // Blue walls
              ctx.fillRect(cellX, cellY, cellSize, cellSize);

              // Add a border to make walls more visible
              ctx.strokeStyle = "#00FFFF";
              ctx.lineWidth = 1;
              ctx.strokeRect(cellX, cellY, cellSize, cellSize);
            } else if (cell === 2) {
              // Power pellet location - don't draw here, will be drawn from pellets array
            } else if (cell === 0) {
              // Path - don't draw dots here, will be drawn from pellets array
            }
          });
        });
      }

      // Draw pellets - FIXED POSITION
      if (visibleArea && visibleArea.pellets) {
        visibleArea.pellets.forEach((pellet) => {
          // Convert to canvas coordinates
          const pelletX = pellet.x * cellSize + cellSize / 2;
          const pelletY = pellet.y * cellSize + cellSize / 2;

          // Power pellets are larger and pulsing
          if (pellet.isPowerPellet) {
            ctx.fillStyle = "#FFFFFF";
            const pulseSize =
              cellSize * 0.5 + Math.sin(Date.now() / 200) * cellSize * 0.1;
            ctx.beginPath();
            ctx.arc(pelletX, pelletY, pulseSize / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(pelletX, pelletY, cellSize * 0.1, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Draw ghosts - FIXED POSITION
      if (visibleArea && visibleArea.ghosts) {
        visibleArea.ghosts.forEach((ghost) => {
          // Convert to canvas coordinates
          const ghostX = ghost.x * cellSize + cellSize / 2;
          const ghostY = ghost.y * cellSize + cellSize / 2;

          // Use blue color for vulnerable ghosts in power mode
          ctx.fillStyle = ghost.vulnerable
            ? "#0000FF"
            : ghost.color || "#FF0000";

          // Draw ghost body
          ctx.beginPath();
          ctx.arc(ghostX, ghostY, cellSize * 0.4, Math.PI, 0);

          // Draw the bottom part of the ghost
          const ghostBottom = ghostY;
          const ghostSize = cellSize * 0.8;
          ctx.lineTo(ghostX + ghostSize / 2, ghostBottom + ghostSize / 2);

          // Draw wavy bottom
          const waveWidth = ghostSize / 6;
          for (let i = 0; i < 3; i++) {
            ctx.lineTo(
              ghostX + ghostSize / 2 - waveWidth * (i + 1),
              ghostBottom + ghostSize / 2 - (i % 2) * waveWidth,
            );
          }

          ctx.lineTo(ghostX - ghostSize / 2, ghostBottom + ghostSize / 2);
          ctx.closePath();
          ctx.fill();

          // Draw eyes (white for normal, scared for vulnerable)
          if (ghost.vulnerable) {
            // Draw scared eyes
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(
              ghostX - ghostSize / 6,
              ghostY - ghostSize / 6,
              ghostSize / 8,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.beginPath();
            ctx.arc(
              ghostX + ghostSize / 6,
              ghostY - ghostSize / 6,
              ghostSize / 8,
              0,
              Math.PI * 2,
            );
            ctx.fill();

            // Draw scared mouth
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = ghostSize / 12;
            ctx.beginPath();
            ctx.moveTo(ghostX - ghostSize / 4, ghostY + ghostSize / 8);
            ctx.lineTo(ghostX - ghostSize / 8, ghostY);
            ctx.lineTo(ghostX, ghostY + ghostSize / 8);
            ctx.lineTo(ghostX + ghostSize / 8, ghostY);
            ctx.lineTo(ghostX + ghostSize / 4, ghostY + ghostSize / 8);
            ctx.stroke();
          } else {
            // Draw normal eyes
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(
              ghostX - ghostSize / 6,
              ghostY - ghostSize / 6,
              ghostSize / 6,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.beginPath();
            ctx.arc(
              ghostX + ghostSize / 6,
              ghostY - ghostSize / 6,
              ghostSize / 6,
              0,
              Math.PI * 2,
            );
            ctx.fill();

            // Draw pupils
            ctx.fillStyle = "#000000";
            ctx.beginPath();
            ctx.arc(
              ghostX - ghostSize / 6,
              ghostY - ghostSize / 6,
              ghostSize / 12,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.beginPath();
            ctx.arc(
              ghostX + ghostSize / 6,
              ghostY - ghostSize / 6,
              ghostSize / 12,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        });
      }

      // Draw players (Pac-Man) - PLAYER MOVES, NOT THE MAZE
      if (players) {
        players.forEach((player) => {
          if (!player.position) return;

          // Convert to canvas coordinates
          const playerX = player.position.x * cellSize + cellSize / 2;
          const playerY = player.position.y * cellSize + cellSize / 2;

          // Draw a highlight circle around current player
          if (player.isCurrentPlayer) {
            ctx.fillStyle = "rgba(255, 255, 0, 0.3)"; // Semi-transparent yellow
            ctx.beginPath();
            ctx.arc(playerX, playerY, cellSize * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }

          // Draw Pac-Man with color based on player
          ctx.fillStyle = player.color || "#FFFF00"; // Use player color or default to yellow

          // Calculate mouth angle based on movement direction
          const mouthAngle = Math.sin(Date.now() / 150) * 0.3 + 0.3; // More pronounced mouth animation

          // Calculate rotation based on direction
          let startAngle = 0;
          let endAngle = 0;

          switch (player.direction) {
            case "right":
              startAngle = mouthAngle;
              endAngle = Math.PI * 2 - mouthAngle;
              break;
            case "left":
              startAngle = Math.PI + mouthAngle;
              endAngle = Math.PI - mouthAngle;
              break;
            case "up":
              startAngle = Math.PI * 1.5 + mouthAngle;
              endAngle = Math.PI * 1.5 - mouthAngle;
              break;
            case "down":
              startAngle = Math.PI * 0.5 + mouthAngle;
              endAngle = Math.PI * 0.5 - mouthAngle;
              break;
            default:
              startAngle = mouthAngle;
              endAngle = Math.PI * 2 - mouthAngle;
          }

          // Draw Pac-Man body with proper rotation
          ctx.beginPath();
          ctx.moveTo(playerX, playerY);
          ctx.arc(playerX, playerY, cellSize * 0.6, startAngle, endAngle);
          ctx.lineTo(playerX, playerY);
          ctx.closePath();
          ctx.fill();

          // Add "YOU" text above current player
          if (player.isCurrentPlayer) {
            ctx.font = `${cellSize * 0.5}px Arial`;
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText("YOU", playerX, playerY - cellSize * 0.8);

            // Add power mode indicator
            if (powerMode) {
              ctx.fillStyle = "#00FFFF";
              ctx.fillText("POWER!", playerX, playerY - cellSize * 1.3);
            }
          } else {
            // Add username above other players
            ctx.font = `${cellSize * 0.3}px Arial`;
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText(
              player.username || "Player",
              playerX,
              playerY - cellSize * 0.8,
            );
          }
        });
      }

      // Display sector and absolute position information
      if (sector && absolutePosition) {
        ctx.font = "16px Arial";
        ctx.fillStyle = "#FFFF00";
        ctx.textAlign = "left";
        ctx.fillText(`Sector: ${sector.x}, ${sector.y}`, 10, 20);
        ctx.fillText(
          `Position: ${Math.floor(absolutePosition.x)}, ${Math.floor(absolutePosition.y)}`,
          10,
          40,
        );

        // Display player count in this sector
        if (showPlayerCount && players) {
          ctx.fillText(`Players in sector: ${players.length}`, 10, 60);
        }
      }

      // Restore the canvas state after drawing the maze and entities
      ctx.restore();

      // If in tunnel transition, draw the next maze
      if (tunnelTransition) {
        ctx.save();

        // Apply centering offset
        ctx.translate(offsetX, offsetY);

        // Draw the next maze based on transition direction
        if (tunnelTransition === "left-to-right") {
          // Draw the next maze to the right
          ctx.translate(canvas.width + transitionOffset, 0);
        } else if (tunnelTransition === "right-to-left") {
          // Draw the next maze to the left
          ctx.translate(-canvas.width + transitionOffset, 0);
        }

        // Calculate the next sector based on transition direction
        const nextSector = { ...sector };
        if (tunnelTransition === "left-to-right") {
          nextSector.x += 1;
        } else if (tunnelTransition === "right-to-left") {
          nextSector.x -= 1;
        }

        // Draw the maze for the next sector
        if (visibleArea && visibleArea.maze) {
          visibleArea.maze.forEach((row, y) => {
            row.forEach((cell, x) => {
              const cellX = x * cellSize;
              const cellY = y * cellSize;

              if (cell === 1) {
                // Wall
                ctx.fillStyle = "#0000FF";
                ctx.fillRect(cellX, cellY, cellSize, cellSize);
                ctx.strokeStyle = "#00FFFF";
                ctx.lineWidth = 1;
                ctx.strokeRect(cellX, cellY, cellSize, cellSize);
              }
            });
          });
        }

        // Display sector information for the next sector
        ctx.font = "16px Arial";
        ctx.fillStyle = "#FFFF00";
        ctx.textAlign = "left";
        ctx.fillText(`Next Sector: ${nextSector.x}, ${nextSector.y}`, 10, 20);

        // Calculate and display absolute position for the next sector
        if (absolutePosition) {
          const mazeWidth = visibleArea?.maze?.[0]?.length || 19;
          const absX =
            absolutePosition.x + (nextSector.x - sector.x) * mazeWidth;
          const absY = absolutePosition.y;
          ctx.fillText(
            `Next Position: ${Math.floor(absX)}, ${Math.floor(absY)}`,
            10,
            40,
          );
        }

        ctx.restore();
      }

      // Show ghost collision message
      if (ghostCollision) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(
          canvas.width / 4,
          canvas.height / 3,
          canvas.width / 2,
          canvas.height / 3,
        );

        ctx.font = "bold 24px Arial";
        ctx.fillStyle = "#FF0000";
        ctx.textAlign = "center";
        ctx.fillText(
          "GHOST GOT YOU!",
          canvas.width / 2,
          canvas.height / 2 - 20,
        );

        ctx.font = "18px Arial";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText("Respawning...", canvas.width / 2, canvas.height / 2 + 20);
      }

      // Show game over message if player is out of lives
      const currentPlayer = players?.find((p) => p.isCurrentPlayer);
      if (currentPlayer?.gameOver || (propsGameOver && !ghostCollision)) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = "bold 36px Arial";
        ctx.fillStyle = "#FF0000";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);

        ctx.font = "24px Arial";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(
          `Final Score: ${currentPlayer?.score || 0}`,
          canvas.width / 2,
          canvas.height / 2 + 10,
        );
      }

      // Continue the animation loop
      animationRef.current = requestAnimationFrame(renderGame);
    };

    // Start the animation loop
    animationRef.current = requestAnimationFrame(renderGame);

    // Clean up on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    canvasSize,
    ghostCollision,
    propsGameOver,
    tunnelTransition,
    transitionOffset,
    showPlayerCount,
  ]);

  return (
    <div className="flex justify-center items-center w-full h-[600px]">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="border-2 border-maze-blue rounded"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}

export default Game;
