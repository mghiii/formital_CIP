import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#f7f8fb",
        ink: "#111827",
        muted: "#667085",
        primary: "#0f766e",
        danger: "#b42318",
        "formital-green": "#1f7a3a",
        "formital-green-dark": "#14532d",
        "formital-red": "#d71920"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
