import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "**/.wrangler/", "dist/", "src/tables.js"] },
  js.configs.recommended,
  { languageOptions: { globals: { ...globals.serviceworker, ...globals.node } } },
];
