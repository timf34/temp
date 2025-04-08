/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "pacman-yellow": "#FFFF00",
        "ghost-red": "#FF0000",
        "ghost-blue": "#00FFFF",
        "maze-blue": "#0000FF",
      },
    },
  },
  plugins: [],
}

