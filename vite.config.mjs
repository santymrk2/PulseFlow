import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
    plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } }), tailwindcss()],
    // `public/` holds static assets (global.css, fonts, …) copied as-is.
    publicDir: "public",
    // los .module.css portados de Svelte usan clases kebab-case; el código React las lee como styles.camelCase
    css: { modules: { localsConvention: "camelCase" } },
    // The SPA entry is the root `index.html` (dev + build).
    server: {
        port: 1420,
        host: "127.0.0.1",
        strictPort: true
    },
    build: {
        // Static SPA output consumed by Tauri (`frontendDist`).
        outDir: "dist",
        emptyOutDir: true
    },
    resolve: {
        dedupe: ["react", "react-dom"],
        alias: {
            // `$lib/*` → `src/frontend/lib/*`
            $lib: fileURLToPath(new URL("./src/frontend/lib", import.meta.url))
        }
    }
})
