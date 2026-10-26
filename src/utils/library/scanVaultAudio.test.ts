import { describe, expect, it } from "vitest";
import { App } from "obsidian";
import { scanVaultAudioFiles } from "./scanVaultAudio";

describe("library/scanVaultAudio utilities", () => {
	it("should find all supported audio files across the vault when musicFolder is empty", () => {
		const app = new App();
		app.vault.createFile("song1.mp3");
		app.vault.createFile("notes/readme.md");
		app.vault.createFile("sub/song2.flac");
		app.vault.createFile("sub/deep/song3.ogg");
		app.vault.createFile("sub/deep/picture.png");

		const results = scanVaultAudioFiles(app, "");
		const paths = results.map((f) => f.path);

		expect(paths).toContain("song1.mp3");
		expect(paths).toContain("sub/song2.flac");
		expect(paths).toContain("sub/deep/song3.ogg");
		expect(paths).not.toContain("notes/readme.md");
		expect(paths).not.toContain("sub/deep/picture.png");
	});

	it("should filter audio files strictly inside configured musicFolder", () => {
		const app = new App();
		app.vault.createFolder("AudioBooks");
		app.vault.createFolder("Music");
		app.vault.createFile("AudioBooks/chapter1.mp3");
		app.vault.createFile("Music/track1.mp3");
		app.vault.createFile("Music/Jazz/track2.wav");

		const results = scanVaultAudioFiles(app, "Music");
		const paths = results.map((f) => f.path);

		expect(paths).toContain("Music/track1.mp3");
		expect(paths).toContain("Music/Jazz/track2.wav");
		expect(paths).not.toContain("AudioBooks/chapter1.mp3");
	});

	it("should return an empty array if configured musicFolder does not exist", () => {
		const app = new App();
		app.vault.createFile("track.mp3");

		const results = scanVaultAudioFiles(app, "NonExistentFolder");
		expect(results).toEqual([]);
	});

	it("should support all valid audio extensions (m4a, aac, flac, wav, etc.)", () => {
		const app = new App();
		app.vault.createFile("1.m4a");
		app.vault.createFile("2.aac");
		app.vault.createFile("3.flac");
		app.vault.createFile("4.wav");
		app.vault.createFile("5.txt");
		app.vault.createFile("6.wma");

		const results = scanVaultAudioFiles(app, "");
		expect(results).toHaveLength(4);
	});
});
