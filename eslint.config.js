import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";
import svelteConfig from "./svelte.config.js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,

  ...svelte.configs.recommended,

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // *.svelte and *.svelte.{js,ts} files must be parsed by svelte-eslint-parser.
  // Use the TypeScript parser as the inner parser so <script lang="ts"> works.
  {
    files: ["**/*.svelte", "**/*.svelte.js", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        svelteConfig,
      },
    },
  },

  // Global rules (apply to all files)
  {
    rules: {
      "svelte/no-target-blank": "error",
      "svelte/infinite-reactive-loop": "error",
      "svelte/no-dom-manipulating": "error",
      "svelte/no-store-async": "error",
      "svelte/derived-has-same-inputs-outputs": "warn",

      eqeqeq: ["error", "always"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-return-assign": "error",
      "no-throw-literal": "error",
      "no-console": "warn",
      "no-use-before-define": ["error", { functions: false, classes: true, variables: true }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-floating-decimal": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },

  // TypeScript files: use the TypeScript parser and TS-aware rules.
  // Must come after the global rules block so these overrides take effect.
  {
    files: ["**/*.ts", "**/*.svelte.ts"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
      // Svelte 5 runes used in *.svelte.ts reactive modules
      globals: {
        $state: "readonly",
        $derived: "readonly",
        $effect: "readonly",
        $props: "readonly",
        $bindable: "readonly",
        $inspect: "readonly",
      },
    },
    rules: {
      // TypeScript handles undefined-variable checking; no-undef produces false
      // positives on types and ambient declarations.
      "no-undef": "off",
      // Swap out the JS rule for the TypeScript-aware version so that
      // parameter names in function types are not flagged as unused.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // For Svelte components with <script lang="ts">, also swap to the TS-aware
  // no-unused-vars so function-type parameter names aren't flagged.
  {
    files: ["**/*.svelte"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    ignores: [
      "build/**",
      ".svelte-kit/**",
      "node_modules/**",
      "python/**",
      "*.min.js",
      "commit.txt",
      "**/*.d.ts",
    ],
  },
];
