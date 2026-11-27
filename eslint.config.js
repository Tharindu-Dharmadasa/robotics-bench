// ESLint flat config
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import globals from "globals";
import path from "path";

const compat = new FlatCompat({
  baseDirectory: path.resolve(process.cwd()),
});

export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      "@typescript-eslint": compat.plugins["@typescript-eslint"],
    },
    rules: {
      // rule a: ban any simulation imports (will be scoped via overrides)
      "no-restricted-imports": ["error", { "patterns": ["**/simulation/**"] }],
    },
    // Apply rule a only to components, store, utils
    overrides: [
      {
        files: ["src/components/**/*.ts", "src/store/**/*.ts", "src/utils/**/*.ts"],
        rules: {
          "no-restricted-imports": ["error", { "patterns": ["**/simulation/**"] }],
        },
      },
    ],
  },
  // rule b: ban react and three in certain folders
  {
    files: [
      "src/types/**/*.ts",
      "src/registry/**/*.ts",
      "src/simulation/**/*.ts",
      "src/utils/breadboardGrid.ts",
      "src/utils/manifestValidation.ts",
      "src/utils/wireValidation.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          "paths": [
            { "name": "react", "message": "React import forbidden in this layer" },
            { "name": "react-dom", "message": "React-DOM import forbidden" },
            { "name": "three", "message": "Three.js import forbidden" },
          ],
        },
      ],
    },
  },
  // rule c: ban zustand, zundo, idb-keyval in same layers as rule b
  {
    files: [
      "src/types/**/*.ts",
      "src/registry/**/*.ts",
      "src/simulation/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          "paths": [
            { "name": "zustand", "message": "zustand forbidden in this layer" },
            { "name": "zundo", "message": "zundo forbidden in this layer" },
            { "name": "idb-keyval", "message": "idb-keyval forbidden in this layer" },
          ],
        },
      ],
    },
  },
];
