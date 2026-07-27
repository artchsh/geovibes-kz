/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#f65050",
        action: "#f65050",
        darkSurface: "#1a1a1a",
        accentOrange: "#f38c4c",
        pink: "#ffe1e1",
        text: "#0f172a",
        muted: "#64748b",
        faint: "#94a3b8",
        border: "#eeeeee",
        bg: "#f7f7f7",
        white: "#ffffff",
      },
      fontFamily: {
        display: ["Oswald_400Regular"],
        "display-bold": ["Oswald_700Bold"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
