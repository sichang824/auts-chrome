import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// https://vite.dev/config/
const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
  build: {
    outDir: resolve(rootDir, "../dist/extension"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(rootDir, "popup.html"),
        options: resolve(rootDir, "options.html"),
        // Extension runtime scripts implemented in TypeScript
        background: resolve(rootDir, "src/extension/service_worker.ts"),
        bridge: resolve(rootDir, "src/extension/bridge.ts"),
      },
      output: {
        // Keep fixed names for extension runtime scripts, hashed names for the rest
        entryFileNames: (chunk) =>
          chunk.name === "background" || chunk.name === "bridge"
            ? "[name].js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
