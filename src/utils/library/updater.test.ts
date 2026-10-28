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
		plugin.settings.trackIndex = {
			"stale-id": "music/deleted.mp3",
		};

		vi.spyOn(metadataModule, "getEmbeddedAudioMetadataFromBuffer").mockResolvedValue({
			title: "Song",
			artist: "Artist",
		});

		const count = await rebuildAllData(app, plugin);
		expect(count).toBe(1);
		expect(plugin.settings.trackIndex["stale-id"]).toBeUndefined();
		vi.restoreAllMocks();
	});

	it("should fall back to full binary read when header binary yields no metadata, and handle batch yielding and errors", async () => {
		const { app, plugin } = createPlugin();

		// Create 4 files to trigger processed % 4 === 0 event-loop yield
		for (let i = 1; i <= 4; i++) {
			app.vault.createFile(`music/track${i}.mp3`, new ArrayBuffer(50));
		}

		// Mock readAudioFileHeaderBinary to return null for track1, prompting full read
		const headerSpy = vi.spyOn(metadataModule, "readAudioFileHeaderBinary").mockImplementation(async (_app, file) => {
			if (file.path === "music/track1.mp3") return null;
			return new ArrayBuffer(10);
		});

		const fullReadSpy = vi.spyOn(metadataModule, "readAudioFileBinary").mockResolvedValue(new ArrayBuffer(100));

		vi.spyOn(metadataModule, "getEmbeddedAudioMetadataFromBuffer").mockImplementation(async (buffer) => {
			if (buffer.byteLength === 100) {
				return { title: "From Full Binary", artist: "Artist 1" };
			}
			return { title: "From Header", artist: "Header Artist" };
		});

		const count = await rebuildAllData(app, plugin);
		expect(count).toBe(4);
		expect(fullReadSpy).toHaveBeenCalled();

		headerSpy.mockRestore();
		fullReadSpy.mockRestore();
		vi.restoreAllMocks();
	});

	it("should catch inner file processing errors and continue processing remaining files", async () => {
		const { app, plugin } = createPlugin();
		app.vault.createFile("music/fail.mp3", new ArrayBuffer(50));
		app.vault.createFile("music/ok.mp3", new ArrayBuffer(50));

		vi.spyOn(metadataModule, "readAudioFileHeaderBinary").mockImplementation(async (_app, file) => {
			if (file.path === "music/fail.mp3") {
				throw new Error("File corrupt");
			}
			return new ArrayBuffer(10);
		});

		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const count = await rebuildAllData(app, plugin);
		expect(count).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Error processing file music/fail.mp3:"),
			expect.any(Error)
		);
		errorSpy.mockRestore();
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

	it("should incrementally reuse cached track info when mtime and size match without re-reading", async () => {
		const { app, plugin } = createPlugin();
		const file = app.vault.createFile("music/track.mp3", new ArrayBuffer(100));
		// Provide mock stat
		(file as any).stat = { mtime: 1700000000, size: 100 };

		const metaSpy = vi.spyOn(metadataModule, "getEmbeddedAudioMetadataFromBuffer").mockResolvedValue({
			title: "Cached Song",
			artist: "Cached Artist",
		});

		// Pass 1: Cold scan
		const count1 = await rebuildAllData(app, plugin);
		expect(count1).toBe(1);
		expect(metaSpy).toHaveBeenCalledTimes(1);

		const trackKeys = Object.keys(plugin.settings.tracks);
		const trackId = trackKeys[0]!;
		expect(plugin.settings.tracks[trackId]?.mtime).toBe(1700000000);
		expect(plugin.settings.tracks[trackId]?.size).toBe(100);

		// Pass 2: Incremental rebuild with identical stat
		metaSpy.mockClear();
		const count2 = await rebuildAllData(app, plugin);
		expect(count2).toBe(1);
		// Zero binary parses!
		expect(metaSpy).not.toHaveBeenCalled();
		expect(plugin.settings.tracks[trackId]?.title).toBe("Cached Song");

		vi.restoreAllMocks();
	});
});

