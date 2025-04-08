"use client"

import { useState } from "react"

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username.trim()) {
      onLogin(username.trim())
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <form onSubmit={handleSubmit} className="bg-maze-blue p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center text-pacman-yellow">Distributed Pac-Man</h1>
        <div className="mb-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className="w-full px-4 py-2 rounded bg-black text-white border border-pacman-yellow focus:outline-none focus:ring-2 focus:ring-pacman-yellow"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-pacman-yellow text-black font-bold py-2 px-4 rounded hover:bg-yellow-400 transition-colors"
        >
          Start Game
        </button>
      </form>
    </div>
  )
}

export default LoginForm

