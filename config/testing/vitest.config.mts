import react from "@vitejs/plugin-react"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Unit tests live alongside source as *.test.ts under src/ (and next to the dev scripts in scripts/).
// This config sits in config/testing/, so point the root back at the project root.
export default defineConfig({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    plugins: [
        svelte({
            onwarn: (warning) => {
                if (warning.code.startsWith("a11y-")) return
                if (warning.code === "element_invalid_self_closing_tag") return
            }
        }),
        react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } })
    ],
    resolve: {
        alias: {
            $lib: fileURLToPath(new URL("../../src/frontend/lib", import.meta.url))
        }
    },
    test: {
        include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
        environment: "node"
    }
})
