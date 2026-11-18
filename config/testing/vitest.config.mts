import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Unit tests live alongside source as *.test.ts under src/ (and next to the dev scripts in scripts/).
// This config sits in config/testing/, so point the root back at the project root.
export default defineConfig({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } })],
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
