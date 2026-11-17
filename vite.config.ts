import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
	plugins: [
		react({
			compiler: false,
		}),
	],
	staged: {
		"*.{ts,tsx,js,mjs}": "vp lint",
	},
	test: {
		globals: true,
		isolate: true,
		environment: "node",
		setupFiles: [path.resolve(import.meta.dirname, "./tests/setup-dom.ts")],
		include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: [
				"src/utils/**",
				"src/constants/**",
				"src/services/**",
				"src/hooks/useDiscRotation.ts",
				"src/hooks/useDiscSwitchAnimation.ts",
				"src/hooks/useLibraryManagement.ts",
				"src/hooks/useLibraryState.ts",
				"src/hooks/useLyricsIndex.ts",
				"src/hooks/useNavigation.ts",
				"src/hooks/usePageState.ts",
				"src/hooks/usePlaybackControl.ts",
				"src/hooks/usePlaybackState.ts",
				"src/hooks/useTrackCovers.ts",
			],
			exclude: ["**/*.test.{ts,tsx}", "**/index.ts"],
			thresholds: {
				statements: 95,
				branches: 82,
				functions: 95,
				lines: 95,
			},
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
