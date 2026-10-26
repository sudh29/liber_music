import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
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
			"@": path.resolve(__dirname, "./src"),
			"buffer-polyfill": path.resolve(__dirname, "./src/utils/polyfills/buffer.ts"),
			"obsidian": path.resolve(__dirname, "./tests/mocks/obsidian.ts"),
		},
	},
});
