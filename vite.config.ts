import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// https://vite.dev/config/
const rootDir = fileURLToPath(new URL(".", import.meta.url));
const bundledScriptUrls = parseBundledScriptUrls(process.env.AUTS_BUNDLED_SCRIPT_URLS || "");
console.log(
  `[AUTS build] bundled URL scripts: ${bundledScriptUrls.length > 0 ? `${bundledScriptUrls.length} enabled` : "disabled"}`
);

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  define: {
    __AUTS_BUNDLED_SCRIPT_URLS__: JSON.stringify(bundledScriptUrls),
  },
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
  build: {
    outDir: resolve(rootDir, "./dist/extension"),
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

function parseBundledScriptUrls(value: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const rawEntry of value.split(/[\n,;]/)) {
    const entry = rawEntry.trim();
    if (!entry || entry.startsWith("#")) continue;
    try {
      const href = new URL(entry).href;
      if (seen.has(href)) continue;
      seen.add(href);
      urls.push(href);
    } catch {
      console.warn(`[AUTS build] Ignoring invalid AUTS_BUNDLED_SCRIPT_URLS entry: ${entry}`);
    }
  }
  return urls;
}
