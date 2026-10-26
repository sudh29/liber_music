import { describe, expect, it, vi } from "vitest";
import { LyricsService } from "./LyricsService";
import { App, TFile } from "obsidian";
import type MusicPlayerPlugin from "@/main";
import { DEFAULT_SETTINGS } from "@/types";
import { getOrCreateTrackId } from "@/utils/track/id";

function createMockTFile(path: string, name: string): TFile {
	const file = new TFile();
	file.path = path;
	file.name = name;
	file.basename = name.replace(/\.[^/.]+$/, "");
	file.extension = name.split(".").pop() || "";
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
});
