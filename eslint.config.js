import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
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

  // *.svelte.js files (e.g. cache.svelte.js) use Svelte 5 runes and must be
  // parsed by svelte-eslint-parser, not the default JS parser.
  {
    files: ["**/*.svelte", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        svelteConfig,
      },
    },
  },

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

  {
    ignores: [
      "build/**",
      ".svelte-kit/**",
      "node_modules/**",
      "python/**",
      "*.min.js",
      "commit.txt",
    ],
  },
];
