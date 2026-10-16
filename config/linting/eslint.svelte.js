// Svelte 5 lint config.
// Uses `svelte-eslint-parser` (with @typescript-eslint as the inner parser for
// `<script lang="ts">`) — replacing the old Svelte 3-only `eslint-plugin-svelte3`.
module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "prettier",
    ],
    parser: "svelte-eslint-parser",
    parserOptions: {
        parser: "@typescript-eslint/parser",
        project: "config/typescript/tsconfig.svelte.json",
        extraFileExtensions: [".svelte"],
        ecmaVersion: 2021,
        sourceType: "module",
    },
    plugins: ["@typescript-eslint"],
    rules: {
        "@typescript-eslint/no-floating-promises": "off",
        "@typescript-eslint/no-misused-promises": "off",
        "@typescript-eslint/no-unused-vars": ["error", { "varsIgnorePattern": "^_", "argsIgnorePattern": "^_" }],
        "--TEMPORARILY-DISABLED": "off",
        "@typescript-eslint/restrict-plus-operands": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/naming-convention": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-unsafe-call": "off",
    },
}; // always check js config files before executing!!
