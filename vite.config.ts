import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// When VERCEL=1 (set automatically by Vercel CI) use the vercel preset,
// otherwise fall back to the default node-server preset for local dev.
const preset = process.env.VERCEL ? "vercel" : "node-server";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      server: {
        entry: "server",
        preset,
      },
    }),
    react(),
    tailwindcss(),
  ],
});
