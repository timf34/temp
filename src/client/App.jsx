"use client";

import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import Game from "./components/Game";
import LoginForm from "./components/LoginForm";
import Leaderboard from "./components/Leaderboard";

// Get the WebContainer host URL from the current window location
const host = window.location.hostname;
const socketUrl = `http://${host}:80`;

console.log("Connecting to socket at:", socketUrl);

// Initialize socket with WebContainer-compatible URL and options
const socket = io(socketUrl, {
  transports: ["websocket", "polling"],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  autoConnect: true,
  path: "/socket.io",
});

function App() {
  const [gameState, setGameState] = useState(null);
  const [player, setPlayer] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [debugInfo, setDebugInfo] = useState({ connected: false, events: [] });
  const [showControls, setShowControls] = useState(true);

  const handleLogin = (username) => {
    console.log("Logging in with username:", username);
    socket.emit("join-game", { username });
  };

  const handleMove = useCallback((direction) => {
    console.log("Sending move:", direction);
    socket.emit("move", direction);
  }, []);

  const handleRespawn = useCallback(() => {
    console.log("Requesting respawn");
    socket.emit("respawn");
  }, []);

  const toggleLeaderboard = () => {
    setShowLeaderboard((prev) => !prev);
  };

  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

  useEffect(() => {
    socket.on("connect", () => {
      setConnectionError(false);
      console.log("Connected to game server");
      setDebugInfo((prev) => ({
        ...prev,
        connected: true,
        events: [...prev.events.slice(-5), "Connected"],
      }));
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setConnectionError(true);
      setDebugInfo((prev) => ({
        ...prev,
        connected: false,
        events: [
          ...prev.events.slice(-5),
          `Connection error: ${error.message}`,
        ],
      }));
    });

    socket.on("game-state", (initialState) => {
      console.log("Received initial game state:", initialState);
      setGameState(initialState);
      setPlayer({
        position: initialState.position,
        score: 0,
        lives: 3,
        direction: initialState.direction || "right",
        gameOver: false,
      });
      setDebugInfo((prev) => ({
        ...prev,
        events: [...prev.events.slice(-5), "Received game state"],
      }));
    });

    socket.on("update-view", (update) => {
      console.log("Received view update");
      setGameState(update);
      setPlayer((prev) => ({
        ...prev,
        position: update.position,
        direction: update.direction || prev.direction,
      }));
    });

    socket.on("score-update", (score) => {
      setPlayer((prev) => ({
        ...prev,
        score,
      }));
    });

    socket.on("life-lost", (lives) => {
      setPlayer((prev) => ({
        ...prev,
        lives,
      }));

      // Show notification that player lost a life
      setDebugInfo((prev) => ({
        ...prev,
        events: [
          ...prev.events.slice(-5),
          "Lost a life! Lives remaining: " + lives,
        ],
      }));
    });

    socket.on("game-over", (data) => {
      setPlayer((prev) => ({
        ...prev,
        gameOver: true,
        lives: 0,
      }));

      // Show game over notification
      setDebugInfo((prev) => ({
        ...prev,
        events: [
          ...prev.events.slice(-5),
          `Game Over! Final score: ${data.score}`,
        ],
      }));
    });

    socket.on("error", (error) => {
      console.error("Game error:", error);
      setDebugInfo((prev) => ({
        ...prev,
        events: [...prev.events.slice(-5), `Game error: ${error.message}`],
      }));
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("game-state");
      socket.off("update-view");
      socket.off("score-update");
      socket.off("life-lost");
      socket.off("game-over");
      socket.off("error");
    };
  }, []);

  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-red-500 text-xl">
          Unable to connect to game server. Please try again later.
        </div>
      </div>
    );
  }

  if (!player) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="text-xl">
            Score: <span className="text-pacman-yellow">{player.score}</span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={toggleControls}
              className="bg-maze-blue text-pacman-yellow px-4 py-2 rounded hover:bg-blue-800 transition-colors"
            >
              {showControls ? "Hide Controls" : "Show Controls"}
            </button>
            <button
              onClick={toggleLeaderboard}
              className="bg-maze-blue text-pacman-yellow px-4 py-2 rounded hover:bg-blue-800 transition-colors"
            >
              {showLeaderboard ? "Hide Leaderboard" : "Show Leaderboard"}
            </button>
          </div>
          <div className="text-xl">
            Lives: <span className="text-pacman-yellow">{player.lives}</span>
          </div>
        </div>

        {showControls && (
          <div className="mb-4 p-4 bg-maze-blue rounded-lg text-white">
            <h3 className="text-lg font-bold text-pacman-yellow mb-2">
              Game Controls
            </h3>
            <p>
              Use <span className="font-bold">Arrow Keys</span> or{" "}
              <span className="font-bold">WASD</span> to move Pac-Man
            </p>
            <p>Collect white dots for points. Avoid ghosts!</p>
            <p className="mt-2 text-pacman-yellow">
              Look for the bright yellow Pac-Man with "YOU" text above it
            </p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          <div className={`${showLeaderboard ? "md:w-3/4" : "w-full"}`}>
            {gameState && (
              <Game
                gameState={gameState}
                onMove={handleMove}
                gameOver={player.gameOver}
              />
            )}

            {player.gameOver && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleRespawn}
                  className="bg-pacman-yellow text-black font-bold py-2 px-4 rounded hover:bg-yellow-400 transition-colors"
                >
                  Play Again
                </button>
              </div>
            )}

            {/* Debug info */}
            <div className="mt-4 text-white text-sm opacity-70 p-2 bg-gray-900 rounded">
              <p>
                Connection status:{" "}
                {debugInfo.connected ? "Connected ✅" : "Disconnected ❌"}
              </p>
              <p>
                Position:{" "}
                {player.position
                  ? `X: ${player.position.x.toFixed(2)}, Y: ${player.position.y.toFixed(2)}`
                  : "Unknown"}
              </p>
              <p>Direction: {player.direction}</p>
              <p>Recent events: {debugInfo.events.join(" → ")}</p>
            </div>
          </div>

          {showLeaderboard && (
            <div className="md:w-1/4">
              <Leaderboard />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
