import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { rebuildAllData } from "./updater";
import type MusicPlayerPlugin from "@/main";
import * as metadataModule from "../audio/metadata";

describe("library/updater utilities", () => {
	function createPlugin() {
		const app = new App();
		const plugin = {
			app,
			settings: {
				musicFolder: "",
				trackIndex: { "obsolete-id": "deleted.mp3" },
				tracks: {
					"obsolete-id": { title: "Deleted" },
				},
				favorites: ["obsolete-id"],
				playlists: {
					Rock: ["obsolete-id"],
				},
				artists: {},
				albums: {},
			},
			saveSettings: vi.fn().mockResolvedValue(undefined),
		} as unknown as MusicPlayerPlugin;

		return { app, plugin };
	}

	it("should clear library data and notify when 0 audio files are found", async () => {
		const { app, plugin } = createPlugin();

		const count = await rebuildAllData(app, plugin);

		expect(count).toBe(0);
		expect(plugin.settings.tracks).toEqual({});
		expect(plugin.settings.favorites).toEqual([]);
		expect(plugin.settings.playlists).toEqual({});
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
	});

	it("should scan files, extract metadata, generate categories, and clean stale IDs", async () => {
		const { app, plugin } = createPlugin();

		app.vault.createFile("music/track1.mp3", new ArrayBuffer(100));
		app.vault.createFile("music/track1.lrc", "[00:10.00]Companion lyrics");

		vi.spyOn(metadataModule, "getEmbeddedAudioMetadataFromBuffer").mockResolvedValue({
			title: "Song 1",
			artist: "Queen",
			album: "Night at the Opera",
			duration: 250,
			replayGainDb: -1.5,
		});

		const count = await rebuildAllData(app, plugin);

		expect(count).toBe(1);
		const trackKeys = Object.keys(plugin.settings.tracks);
		expect(trackKeys).toHaveLength(1);

		const track = plugin.settings.tracks[trackKeys[0]!];
		expect(track?.title).toBe("Song 1");
		expect(track?.artist).toBe("Queen");
		expect(track?.album).toBe("Night at the Opera");
		expect(track?.lyrics).toBe("[00:10.00]Companion lyrics");

		// Artists and albums index generated
		expect(plugin.settings.artists["Queen"]).toEqual(trackKeys);
		expect(plugin.settings.albums["Night at the Opera"]).toEqual(trackKeys);

		// Stale favorites and playlists cleaned up
		expect(plugin.settings.favorites).not.toContain("obsolete-id");
		expect(plugin.settings.playlists["Rock"]).not.toContain("obsolete-id");
		expect(plugin.saveSettings).toHaveBeenCalledTimes(1);

		vi.restoreAllMocks();
	});

	it("should clean stale trackIndex entries if any are present before cleanup", async () => {
		const { app, plugin } = createPlugin();
		app.vault.createFile("music/song.mp3", new ArrayBuffer(50));

		// Mock track metadata
		vi.spyOn(metadataModule, "getEmbeddedAudioMetadataFromBuffer").mockResolvedValue({
			title: "Song",
			artist: "Artist",
		});

		// Spy on saveSettings to inject a stale trackIndex right before cleanup
		const originalSave = plugin.saveSettings;
		plugin.saveSettings = vi.fn().mockImplementation(async () => {
			plugin.settings.trackIndex["stale-unindexed-id"] = "music/deleted.mp3";
			return originalSave();
		});

		const count = await rebuildAllData(app, plugin);
		expect(count).toBe(1);
		vi.restoreAllMocks();
	});

	it("should catch and rethrow errors during rebuildAllData and show notice", async () => {
		const { app, plugin } = createPlugin();
		app.vault.createFile("music/corrupt.mp3", new ArrayBuffer(50));

		plugin.saveSettings = vi.fn().mockRejectedValue(new Error("Disk write fault"));
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(rebuildAllData(app, plugin)).rejects.toThrow("Disk write fault");
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Error rebuilding music library:"),
			expect.any(Error)
		);
		errorSpy.mockRestore();
		vi.restoreAllMocks();
	});
});

