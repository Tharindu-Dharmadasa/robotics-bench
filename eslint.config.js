import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const SIMULATION_INTERNALS_PATTERNS = [
  {
    group: [
      "**/simulation/unionFindNetlist*",
      "**/simulation/dcNodalSolver*",
      "**/simulation/faultValidator*",
      "**/simulation/behavioralEngine*",
      "../simulation/unionFindNetlist*",
      "../simulation/dcNodalSolver*",
      "../simulation/faultValidator*",
      "../simulation/behavioralEngine*",
      "../../simulation/unionFindNetlist*",
      "../../simulation/dcNodalSolver*",
      "../../simulation/faultValidator*",
      "../../simulation/behavioralEngine*",
    ],
    message:
      "Direct imports of simulation internals are forbidden; use EngineClient / worker bridge.",
  },
];

const REACT_THREE_PATHS = [
  { name: "react", message: "React import is forbidden in this layer." },
  { name: "react-dom", message: "react-dom import is forbidden in this layer." },
  { name: "three", message: "Three.js import is forbidden in this layer." },
];

const STATE_UI_PATHS = [
  { name: "zustand", message: "zustand is forbidden in this layer." },
  { name: "zundo", message: "zundo is forbidden in this layer." },
  { name: "idb-keyval", message: "idb-keyval is forbidden in this layer." },
];

const STATE_UI_PATTERNS = [
  {
    group: [
      "**/store/**",
      "**/components/**",
      "../store/**",
      "../components/**",
      "../../store/**",
      "../../components/**",
    ],
    message: "Imports from store/ or components/ are forbidden in this layer.",
  },
];

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  // Legacy baseline exceptions (existing app files not modified per Task 1.1)
  {
    files: ["src/components/Batch23Geometry.tsx"],
    rules: {
      "no-irregular-whitespace": "off",
    },
  },
  {
    files: ["src/components/PartGeometry.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    files: ["src/customLab/**/*.{ts,tsx}"],
    rules: {
      "no-useless-escape": "off",
    },
  },
  // Rule (a): components, store, utils must not import simulation internals
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/store/**/*.{ts,tsx}",
      "src/utils/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: SIMULATION_INTERNALS_PATTERNS,
        },
      ],
    },
  },
  // Rule (a) + Rule (b): pure math/validation utils must not import simulation internals, react, or three
  {
    files: [
      "src/utils/breadboardGrid.ts",
      "src/utils/manifestValidation.ts",
      "src/utils/wireValidation.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: REACT_THREE_PATHS,
          patterns: SIMULATION_INTERNALS_PATTERNS,
        },
      ],
    },
  },
  // Rule (b) + Rule (c): types, registry, simulation must not import react, three, store, components, zustand, zundo, or idb-keyval
  {
    files: [
      "src/types/**/*.{ts,tsx}",
      "src/registry/**/*.{ts,tsx}",
      "src/simulation/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [...REACT_THREE_PATHS, ...STATE_UI_PATHS],
          patterns: STATE_UI_PATTERNS,
        },
      ],
    },
  }
);
