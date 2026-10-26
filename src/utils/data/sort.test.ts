import { describe, expect, it } from "vite-plus/test";
import { sortByName, sortTracksByTrack } from "./sort";
import type { TFile } from "obsidian";
import type { MusicPlayerSettings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";
import { getOrCreateTrackId } from "@/utils/track/id";

function createMockTFile(path: string, name: string): TFile {
	return {
		path,
		name,
		basename: name.replace(/\.[^/.]+$/, ""),
		extension: name.split(".").pop() || "",
		stat: { ctime: 0, mtime: 0, size: 0 },
		parent: null,
		vault: null as unknown as any,
	} as unknown as TFile;
}

describe("data sort utilities", () => {
	describe("sortByName", () => {
		it("should sort items alphabetically and place unknownName at the very end", () => {
			const artists = ["Queen", "Unknown Artist", "Beatles", "ABBA", "Pink Floyd"];
			const sorted = sortByName(artists, (a) => a, "Unknown Artist");

			expect(sorted).toEqual(["ABBA", "Beatles", "Pink Floyd", "Queen", "Unknown Artist"]);
		});

		it("should use default unknownName 'Unknown' when not specified", () => {
			const items = ["Echo", "Unknown", "Alpha", "Charlie"];
			const sorted = sortByName(items, (x) => x);

			expect(sorted[sorted.length - 1]).toBe("Unknown");
			expect(sorted.slice(0, 3)).toEqual(["Alpha", "Charlie", "Echo"]);
		});

		it("should handle empty or single-element arrays cleanly", () => {
			expect(sortByName([], (x) => x)).toEqual([]);
			expect(sortByName(["Solo"], (x) => x)).toEqual(["Solo"]);
		});
	});

	describe("sortTracksByTrack", () => {
		it("should group by album and sort by track number within the same album", () => {
			const file1 = createMockTFile("music/track1.mp3", "track1.mp3");
			const file2 = createMockTFile("music/track2.mp3", "track2.mp3");
			const file3 = createMockTFile("music/track3.mp3", "track3.mp3");

			const settings: MusicPlayerSettings = {
				...DEFAULT_SETTINGS,
				trackIndex: {},
				tracks: {},
			};

			const id1 = getOrCreateTrackId(file1.path, settings);
			const id2 = getOrCreateTrackId(file2.path, settings);
			const id3 = getOrCreateTrackId(file3.path, settings);

			settings.tracks[id1] = {
				title: "Track 1",
				artist: "Artist A",
				album: "Album Alpha",
				track: 2,
			};
			settings.tracks[id2] = {
				title: "Track 2",
				artist: "Artist A",
				album: "Album Alpha",
				track: 1,
			};
			settings.tracks[id3] = {
				title: "Track 3",
				artist: "Artist B",
				album: "Album Beta",
				track: 1,
			};

			// Passing in scrambled order: [file1, file3, file2]
			const sorted = sortTracksByTrack([file1, file3, file2], settings);

			// In Album Alpha, track 1 (file2) comes before track 2 (file1)
			// Album Alpha comes before Album Beta
			expect(sorted.map((f) => f.path)).toEqual([
				"music/track2.mp3",
				"music/track1.mp3",
				"music/track3.mp3",
			]);
		});

		it("should sort tracks with missing track numbers to the end of their album", () => {
			const fileA = createMockTFile("music/A.mp3", "A.mp3");
			const fileB = createMockTFile("music/B.mp3", "B.mp3");

			const settings: MusicPlayerSettings = {
				...DEFAULT_SETTINGS,
				trackIndex: {},
				tracks: {},
			};

			const idA = getOrCreateTrackId(fileA.path, settings);
			const idB = getOrCreateTrackId(fileB.path, settings);

			settings.tracks[idA] = {
				title: "No track num",
				artist: "Artist",
				album: "Same Album",
			};
			settings.tracks[idB] = {
				title: "Track 5",
				artist: "Artist",
				album: "Same Album",
				track: 5,
			};

			const sorted = sortTracksByTrack([fileA, fileB], settings);
			expect(sorted.map((f) => f.path)).toEqual(["music/B.mp3", "music/A.mp3"]);
		});

		it("should filter out null or undefined items safely", () => {
			const file = createMockTFile("music/track.mp3", "track.mp3");
			const settings: MusicPlayerSettings = {
				...DEFAULT_SETTINGS,
				trackIndex: {},
				tracks: {},
			};

			// @ts-expect-error testing runtime resilience against nulls
			const sorted = sortTracksByTrack([null, file, undefined], settings);
			expect(sorted).toEqual([file]);
		});
	});
});
