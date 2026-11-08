import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync } from "node:fs";
export default defineConfig({
  plugins: [
    {
      name: "hosted-embed",
      closeBundle() {
        const target = resolve(__dirname, "../../apps/web/public/sdk");
        mkdirSync(target, { recursive: true });
        copyFileSync(
          resolve(__dirname, "dist/upstep.global.js"),
          resolve(target, "upstep.js"),
        );
      },
    },
  ],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/embed.ts"),
      name: "UpStepEmbed",
      formats: ["iife"],
      fileName: () => "upstep.global.js",
    },
  },
});
