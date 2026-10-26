// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import MusicPlayerPlugin from "@/main";
import { VIEW_TYPE_MUSIC_PLAYER } from "@/views/MusicPlayerView";

describe("E2E 1: Plugin Lifecycle & View Activation", () => {
	it("should initialize plugin, register views, commands, and ribbon icon on onload", async () => {
		const app = new App();
		const manifest = { id: "liber-music-player-plugin", version: "1.3.8" };
		const plugin = new MusicPlayerPlugin(app, manifest);

		// 1. Trigger onload
		await plugin.onload();

		// Check registered commands
		expect(plugin.commands.some((c) => c.id === "open-player")).toBe(true);
		expect(plugin.commands.some((c) => c.id === "open-settings")).toBe(true);

		// Check ribbon icon
		expect(plugin.ribbonIcons.some((r) => r.icon === "lucide-music")).toBe(true);

		// Check view registered
		expect(plugin.views.has(VIEW_TYPE_MUSIC_PLAYER)).toBe(true);

		// Check settings tab registered
		expect(plugin.settingTab).toBeDefined();

		// 2. Trigger activateView
		await plugin.activateView();
		const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_MUSIC_PLAYER);
		expect(leaves).toHaveLength(1);

		// 3. Trigger onunload
		plugin.onunload();
	});
});
