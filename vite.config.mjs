import tailwindcss from "@tailwindcss/vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const production = process.env.NODE_ENV === "production"

export default defineConfig({
    plugins: [
        svelte({
            compilerOptions: {
                dev: !production
            },
            onwarn: (warning, handler) => {
                // disable A11y warnings
                if (warning.code.startsWith("a11y-")) return
                // Svelte 5 no longer requires self-closing non-void tags
                if (warning.code === "element_invalid_self_closing_tag") return
                handler(warning)
            }
        }),
        tailwindcss()
    ],
    // `public/` holds static assets (global.css, fonts, …) copied as-is.
    publicDir: "public",
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
        dedupe: ["svelte"],
        alias: {
            // shadcn-svelte convention: `$lib/*` → `src/frontend/lib/*`
            $lib: fileURLToPath(new URL("./src/frontend/lib", import.meta.url))
        }
    }
})
