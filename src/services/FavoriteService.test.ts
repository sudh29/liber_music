import { describe, expect, it, vi } from "vitest";
import { FavoriteService } from "./FavoriteService";
import type MusicPlayerPlugin from "@/main";

describe("FavoriteService", () => {
	function createMockPlugin(initialFavorites: string[] = []) {
		return {
			settings: {
				favorites: [...initialFavorites],
			},
			saveSettings: vi.fn().mockResolvedValue(undefined),
		} as unknown as MusicPlayerPlugin;
	}

	it("should check if track is favorite correctly", () => {
		const plugin = createMockPlugin(["track-1", "track-2"]);
		const service = new FavoriteService(plugin);

		expect(service.isFavorite("track-1")).toBe(true);
		expect(service.isFavorite("track-2")).toBe(true);
		expect(service.isFavorite("track-99")).toBe(false);
	});

	it("should toggle favorite from false to true and persist", async () => {
		const plugin = createMockPlugin(["track-1"]);
		const service = new FavoriteService(plugin);

		const result = await service.toggleFavorite("track-2");
		expect(result).toBe(true); // newly favorited
		expect(service.isFavorite("track-2")).toBe(true);
		expect(plugin.settings.favorites).toContain("track-2");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	it("should toggle favorite from true to false and persist", async () => {
		const plugin = createMockPlugin(["track-1", "track-2"]);
		const service = new FavoriteService(plugin);

		const result = await service.toggleFavorite("track-1");
		expect(result).toBe(false); // now unfavorited
		expect(service.isFavorite("track-1")).toBe(false);
		expect(plugin.settings.favorites).not.toContain("track-1");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	it("should return favorite IDs array", () => {
		const plugin = createMockPlugin(["t-1", "t-2"]);
		const service = new FavoriteService(plugin);

		expect(service.getFavoriteIds()).toEqual(["t-1", "t-2"]);
	});

	it("should handle empty or undefined favorites in settings gracefully", () => {
		const plugin = { settings: {}, saveSettings: vi.fn() } as unknown as MusicPlayerPlugin;
		const service = new FavoriteService(plugin);

		expect(service.isFavorite("t-1")).toBe(false);
		expect(service.getFavoriteIds()).toEqual([]);
	});
});
