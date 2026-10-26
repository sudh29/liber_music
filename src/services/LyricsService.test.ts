import { describe, expect, it, vi } from "vitest";
import { LyricsService } from "./LyricsService";
import { App, TFile } from "obsidian";
import type MusicPlayerPlugin from "@/main";
import { DEFAULT_SETTINGS } from "@/types";
import { getOrCreateTrackId } from "@/utils/track/id";

function createMockTFile(path: string, name?: string): TFile {
	const file = new TFile(path);
	file.path = path;
	file.name = name || path.split("/").pop() || "song.mp3";
	file.basename = file.name.replace(/\.[^/.]+$/, "");
	file.extension = file.name.split(".").pop() || "mp3";
	return file;
}

describe("LyricsService", () => {
	it("should parse and return embedded lyrics synchronously when present", () => {
		const app = new App();
		const plugin = {
			app,
			settings: {
				...DEFAULT_SETTINGS,
				trackIndex: {},
				tracks: {},
			},
			saveSettings: vi.fn(),
		} as unknown as MusicPlayerPlugin;

		const trackPath = "Music/song.mp3";
		const trackId = getOrCreateTrackId(trackPath, plugin.settings);
		plugin.settings.tracks[trackId] = {
			title: "Song",
			artist: "Artist",
			album: "Album",
			lyrics: "[00:02.50]Hello from embedded tag",
		};

		const service = new LyricsService(plugin);
		const { lyrics, extendedLyrics } = service.loadLyrics(trackPath);

		expect(extendedLyrics).toHaveLength(0);
		expect(lyrics).toHaveLength(1);
		expect(lyrics[0]?.text).toBe("Hello from embedded tag");
		expect(lyrics[0]?.time).toBe(2.5);
	});

	it("should parse word-by-word karaoke lyrics into extendedLyrics", () => {
		const app = new App();
		const plugin = {
			app,
			settings: {
				...DEFAULT_SETTINGS,
				trackIndex: {},
				tracks: {},
			},
			saveSettings: vi.fn(),
		} as unknown as MusicPlayerPlugin;

		const service = new LyricsService(plugin);
		// Karaoke formatted line with word timestamps
		const raw = "[00:01.00] <00:01.00>Hel<00:01.50>lo <00:02.00>world";
		const { lyrics, extendedLyrics } = service.parseLyrics(raw);

		expect(extendedLyrics.length).toBeGreaterThan(0);
		expect(lyrics.length).toBe(0);
	});

	it("should parse untimed raw lyrics assigning estimated intervals", () => {
		const app = new App();
		const plugin = {
			app,
			settings: {
				...DEFAULT_SETTINGS,
				trackIndex: {},
				tracks: {},
			},
		} as unknown as MusicPlayerPlugin;

		const service = new LyricsService(plugin);
		const raw = "Verse 1 line\nVerse 1 second line";
		const { lyrics } = service.parseLyrics(raw);

		expect(lyrics).toHaveLength(2);
		expect(lyrics[0]?.time).toBe(0);
		expect(lyrics[1]?.time).toBe(3);
	});

	it("should apply lyrics offset tag [offset:500]", () => {
		const app = new App();
		const plugin = {
			app,
			settings: {
				...DEFAULT_SETTINGS,
				tracks: {},
			},
		} as unknown as MusicPlayerPlugin;

		const service = new LyricsService(plugin);
		const raw = "[offset:500]\n[00:02.00]Line 1";
		const { lyrics } = service.parseLyrics(raw);

		expect(lyrics).toHaveLength(1);
		// 500ms offset shifts lyrics earlier (2.0 - 0.5 = 1.5)
		expect(lyrics[0]?.time).toBe(1.5);
	});

	it("should return empty lyrics when raw string is whitespace or empty", () => {
		const app = new App();
		const plugin = {
			app,
			settings: { ...DEFAULT_SETTINGS, tracks: {} },
		} as unknown as MusicPlayerPlugin;

		const service = new LyricsService(plugin);
		expect(service.parseLyrics("").lyrics).toEqual([]);
		expect(service.parseLyrics("   ").lyrics).toEqual([]);
	});

	it("should load companion .lrc asynchronously when embedded lyrics are absent", async () => {
		const app = new App();
		const saveSettingsSpy = vi.fn().mockResolvedValue(undefined);
		const plugin = {
			app,
			settings: {
				...DEFAULT_SETTINGS,
				trackIndex: {},
				tracks: {},
			},
			saveSettings: saveSettingsSpy,
		} as unknown as MusicPlayerPlugin;

		const trackPath = "Music/Rock/bohemian.flac";
		const trackId = getOrCreateTrackId(trackPath, plugin.settings);
		plugin.settings.tracks[trackId] = {
			title: "Bohemian",
			artist: "Queen",
			album: "A Night at the Opera",
			lyrics: "",
		};

		const companionLrcFile = createMockTFile("Music/Rock/bohemian.lrc", "bohemian.lrc");

		vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) => {
			if (p === "Music/Rock/bohemian.lrc") return companionLrcFile;
			return null;
		});
		vi.spyOn(app.vault, "read").mockResolvedValue("[00:05.00]Is this the real life?");

		const service = new LyricsService(plugin);
		const result = await service.loadLyricsAsync(trackPath);

		expect(result.lyrics).toHaveLength(1);
		expect(result.lyrics[0]?.text).toBe("Is this the real life?");
		expect(result.lyrics[0]?.time).toBe(5.0);
		expect(plugin.settings.tracks[trackId]?.lyrics).toBe("[00:05.00]Is this the real life?");
		expect(saveSettingsSpy).toHaveBeenCalled();
	});

	it("should handle error when saving companion lyrics in loadLyricsAsync", async () => {
		const app = new App();
		const plugin = {
			app,
			settings: {
				...DEFAULT_SETTINGS,
				trackIndex: {},
				tracks: {
					"id-1": { title: "Song", lyrics: "" },
				},
			},
			saveSettings: vi.fn().mockRejectedValue(new Error("Disk write protected")),
		} as unknown as MusicPlayerPlugin;

		const companionFile = createMockTFile("Music/song.lrc");
		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(companionFile);
		vi.spyOn(app.vault, "read").mockResolvedValue("[00:01.00]Line");

		const service = new LyricsService(plugin);
		const result = await service.loadLyricsAsync("Music/song.mp3");

		expect(result.lyrics).toHaveLength(1);
	});

	it("should trigger background companion load in synchronous loadLyrics if companion file exists", async () => {
		const app = new App();
		const saveSettingsSpy = vi.fn().mockResolvedValue(undefined);
		const plugin = {
			app,
			settings: {
				...DEFAULT_SETTINGS,
				trackIndex: {
					"id-1": "Music/track.mp3",
				},
				tracks: {
					"id-1": { title: "Song", lyrics: "" },
				},
			},
			saveSettings: saveSettingsSpy,
		} as unknown as MusicPlayerPlugin;

		const companionLrc = createMockTFile("Music/track.lrc");
		vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p) => {
			if (p === "Music/track.lrc") return companionLrc;
			return null;
		});
		vi.spyOn(app.vault, "read").mockResolvedValue("[00:01.00]Background line");

		const service = new LyricsService(plugin);
		// First synchronous call returns empty lyrics while background task is dispatched
		const syncResult = service.loadLyrics("Music/track.mp3");
		expect(syncResult.lyrics).toEqual([]);

		await new Promise((r) => setTimeout(r, 20));
		expect(plugin.settings.tracks["id-1"]?.lyrics).toBe("[00:01.00]Background line");
		expect(saveSettingsSpy).toHaveBeenCalled();
	});
});
