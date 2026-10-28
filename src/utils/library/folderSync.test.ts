import { describe, expect, it } from "vitest";
import { generateFolderPlaylists, getRelativeDirectoryPath } from "./folderSync";
import { TFile } from "../../../tests/mocks/obsidian";

describe("folderSync", () => {
	describe("getRelativeDirectoryPath", () => {
		it("extracts relative folder path when musicFolder is set", () => {
			expect(getRelativeDirectoryPath("Music/Rock/Queen.mp3", "Music", 1)).toBe("Rock");
			expect(getRelativeDirectoryPath("Music/Classical/Chopin/Op9.mp3", "Music", 1)).toBe("Classical");
			expect(getRelativeDirectoryPath("Music/Classical/Chopin/Op9.mp3", "Music", 2)).toBe("Classical/Chopin");
		});

		it("returns null for files located directly in musicFolder root", () => {
			expect(getRelativeDirectoryPath("Music/RootTrack.mp3", "Music", 1)).toBeNull();
		});

		it("returns null for files outside configured musicFolder", () => {
			expect(getRelativeDirectoryPath("Podcasts/Episode1.mp3", "Music", 1)).toBeNull();
		});

		it("handles root vault (empty musicFolder)", () => {
			expect(getRelativeDirectoryPath("Ambient/Rain.mp3", "", 1)).toBe("Ambient");
			expect(getRelativeDirectoryPath("RootTrack.mp3", "", 1)).toBeNull();
		});
	});

	describe("generateFolderPlaylists", () => {
		it("groups audio files by their parent directories", () => {
			const files = [
				new TFile("Music/Rock/track1.mp3") as any,
				new TFile("Music/Rock/track2.mp3") as any,
				new TFile("Music/Jazz/track3.mp3") as any,
				new TFile("Music/Root.mp3") as any,
			];

			const playlists = generateFolderPlaylists(files, "Music", 1);
			expect(playlists.length).toBe(2);
			expect(playlists[0]?.name).toBe("📁 Jazz");
			expect(playlists[0]?.files.length).toBe(1);
			expect(playlists[1]?.name).toBe("📁 Rock");
			expect(playlists[1]?.files.length).toBe(2);
		});

		it("returns empty array when all files are in root or empty list", () => {
			const files = [new TFile("Music/Root1.mp3") as any, new TFile("Music/Root2.mp3") as any];
			const playlists = generateFolderPlaylists(files, "Music", 1);
			expect(playlists).toEqual([]);
		});
	});
});
