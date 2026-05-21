import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "Consolas", "monospace"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        noc: {
          bg: "#0a0c0f",
          surface: "#0f1216",
          panel: "#141820",
          border: "#1e2530",
          accent: "#1a2535",
          text: "#c8d4e0",
          muted: "#4a5a6a",
          dim: "#2a3545",
        },
      },
    },
  },
  plugins: [],
};

export default config;
