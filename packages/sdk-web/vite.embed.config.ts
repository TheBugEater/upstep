import { defineConfig } from "vite";
import { resolve } from "path";
export default defineConfig({
  build: {
    outDir: resolve(__dirname, "../../apps/web/public/sdk"),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/embed.ts"),
      name: "UpStepEmbed",
      formats: ["iife"],
      fileName: () => "upstep.js",
    },
  },
});
