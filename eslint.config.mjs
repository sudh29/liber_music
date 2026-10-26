import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default tseslint.config(
	js.configs.recommended,
	{
		ignores: [
			"node_modules/**",
			"dist/**",
			"coverage/**",
			"references/**",
			"scripts/**",
			"esbuild.config.mjs",
			"eslint.config.mjs",
			"version-bump.mjs",
			"versions.json",
			"package.json",
			"main.js",
			"vite.config.ts",
			"tests/**",
		],
	},
	{
		files: ["main.ts", "src/**/*.ts", "src/**/*.tsx"],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				Buffer: "readonly",
				global: "readonly",
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						"eslint.config.mjs",
						"manifest.json",
					],
				},
				tsconfigRootDir: import.meta.dirname,
				sourceType: "module",
				ecmaVersion: 2022,
			},
		},
		rules: {
			// TypeScript ESLint rules
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					args: "none",
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/require-await": "error",
			"@typescript-eslint/no-unnecessary-type-assertion": "error",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-misused-promises": "error",
			"@typescript-eslint/await-thenable": "error",
			"@typescript-eslint/no-base-to-string": "warn",
			"@typescript-eslint/no-this-alias": "error",
			"@typescript-eslint/no-deprecated": "warn",

			// General ESLint rules
			"no-console": ["error", { allow: ["warn", "error", "debug"] }],
			"no-case-declarations": "error",
			"no-constant-condition": "error",
			"prefer-const": "error",
			"no-var": "error",
			"no-undef": "off", // Buffer is provided via polyfill
			"sort-imports": [
				"warn",
				{
					ignoreCase: true,
					ignoreDeclarationSort: true,
					ignoreMemberSort: false,
					memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
				},
			],
		},
	},
	...obsidianmd.configs.recommended,
	// Relax type safety checks for specific files
	// These files interact with Node.js APIs and third-party libraries where type safety warnings are unavoidable
	{
		files: [
			"src/utils/polyfills/buffer.ts",
			"src/utils/audio/metadata.ts",
			"src/utils/library/coverFinder.ts",
			"src/utils/library/updater.ts",
			"src/services/LibraryService.ts",
			"src/services/ListenerService.ts",
			"src/services/ListService.ts",
		],
		rules: {
			"import/no-nodejs-modules": "off",
			// npm package `buffer` shares name with Node builtin; this is browser polyfill only, not desktop Node API
			"obsidianmd/no-nodejs-modules": "off",
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-return": "off",
		},
	},
	{
		files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		rules: {
			"obsidianmd/no-tfile-tfolder-cast": "off",
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
		},
	},
);