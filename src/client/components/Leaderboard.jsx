"use client";

import { useState, useEffect } from "react";
import { io } from "socket.io-client";

function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get the WebContainer host URL from the current window location
    const host = window.location.hostname;
    const apiUrl = `${window.location.protocol}//${host.replace("--5173", "--3000")}/leaderboard`;
    const socketUrl = `${window.location.protocol}//${host.replace("--5173", "--3000")}`;

    // Connect to socket for real-time updates
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: "/socket.io",
    });

    async function fetchLeaderboard() {
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error("Failed to fetch leaderboard");
        }

        const data = await response.json();
        setLeaderboard(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError("Failed to load leaderboard. Please try again later.");
        setLoading(false);
      }
    }

    fetchLeaderboard();

    // Listen for leaderboard updates
    socket.on("leaderboard_updated", () => {
      console.log("Leaderboard updated, refreshing...");
      fetchLeaderboard();
    });

    // Refresh leaderboard every 30 seconds as a fallback
    const interval = setInterval(fetchLeaderboard, 30000);

    return () => {
      clearInterval(interval);
      socket.off("leaderboard_updated");
      socket.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-maze-blue p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-pacman-yellow">
          Top Players
        </h2>
        <div className="text-white text-center py-4">
          Loading leaderboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-maze-blue p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-pacman-yellow">
          Top Players
        </h2>
        <div className="text-red-500 text-center py-4">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-maze-blue p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-pacman-yellow">Top Players</h2>
      {leaderboard.length === 0 ? (
        <div className="text-white text-center py-4">
          No scores yet. Be the first!
        </div>
      ) : (
        <div className="overflow-y-auto max-h-60">
          <table className="w-full">
            <thead>
              <tr className="border-b border-pacman-yellow">
                <th className="text-left text-pacman-yellow py-2">Rank</th>
                <th className="text-left text-pacman-yellow py-2">Player</th>
                <th className="text-right text-pacman-yellow py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player, index) => (
                <tr key={player.player_id} className="border-b border-blue-900">
                  <td className="text-white py-2">{index + 1}</td>
                  <td className="text-white py-2">{player.username}</td>
                  <td className="text-white py-2 text-right">{player.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
