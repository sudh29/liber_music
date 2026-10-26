import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
	plugins: [
		react({
			compiler: true, // Enables Oxc's native Rust React Compiler (oxc-transform-react) instead of Babel
		}),
	],
	staged: {
		"*.{ts,tsx,js,mjs}": "vp lint",
	},
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/utils/**", "src/constants/**", "src/services/**"],
			exclude: ["**/*.test.ts", "**/index.ts"],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
			"buffer-polyfill": path.resolve(import.meta.dirname, "./src/utils/polyfills/buffer.ts"),
			obsidian: path.resolve(import.meta.dirname, "./tests/mocks/obsidian.ts"),
		},
	},
	fmt: {},
	lint: {
		plugins: ["oxc", "typescript", "unicorn"],
		categories: {
			correctness: "warn",
		},
		ignorePatterns: [
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
			"tests/**",
		],
		rules: {
			"no-unused-vars": "off",
			"no-console": "off",
			"unicorn/no-new-array": "off",
		},
	},
});
