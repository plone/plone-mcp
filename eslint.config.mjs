// @ts-check

// import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default defineConfig(
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
          project: [
            "./tsconfig.json",
            "./tsconfig.test.json",
            "./tsconfig.eslint.json",
          ],
        },
      },
    },
    rules: {
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
);
