// @ts-check

// import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default defineConfig(
  {
    ignores: ["dist/**", "dist-test/**", "coverage/**", "node_modules/**"],
  },
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Module resolution is owned by `tsc` (pnpm type-check); the eslint
      // resolver cannot follow the SDK's package `exports` subpaths.
      "import/no-unresolved": "off",
      "import/order": [
        "error",
        {
          groups: [
            // Imports of builtins are first
            "builtin",
            "external",
            "internal",
            //
            // Then sibling and parent imports. They can be mingled together
            ["parent", "sibling"],

            // Then index file imports
            "index",

            // Then any arcane TypeScript imports
            "object",
            "type",
            "unknown",
          ],
          pathGroups: [
            {
              // Minimatch pattern used to match against specifiers
              pattern: "plone-mcp/**",
              // The predefined group this PathGroup is defined in relation to
              group: "internal",
              // How matching imports will be positioned relative to "group"
              position: "after",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-dynamic-delete": "off",
    },
  },
);
