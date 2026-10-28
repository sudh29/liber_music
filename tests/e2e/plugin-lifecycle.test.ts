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
		expect(plugin.commands.some((c) => c.id === "open-equalizer")).toBe(true);

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

		// 3. Test open-equalizer command callback
		const eqCmd = plugin.commands.find((c) => c.id === "open-equalizer");
		expect(eqCmd).toBeDefined();
		await eqCmd?.callback();

		// 4. Test saveSettings synchronizes live view services
		const view = plugin.getView();
		expect(view).toBeDefined();
		if (view) {
			plugin.settings.crossfadeDuration = 5;
			plugin.settings.eqEnabled = true;
			plugin.settings.eqPreset = "Bass Boost";
			await plugin.saveSettings();

			expect(view.crossfadeService.getDuration()).toBe(5);
			expect(view.equalizerService.isEnabled()).toBe(true);
			expect(view.equalizerService.getState().preset).toBe("Bass Boost");
		}

		// 5. Trigger onunload
		plugin.onunload();
	});
});
