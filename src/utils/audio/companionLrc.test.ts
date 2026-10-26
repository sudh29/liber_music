import { describe, expect, it, vi } from "vite-plus/test";
import { getCompanionLrcFile, getCompanionLrcPath, readCompanionLrc } from "./companionLrc";
import { App, TFile } from "obsidian";

function createMockTFile(path: string, name: string): TFile {
	const file = new TFile();
	file.path = path;
	file.name = name;
	file.basename = name.replace(/\.[^/.]+$/, "");
	file.extension = name.split(".").pop() || "";
	return file;
}

describe("companionLrc utility", () => {
	it("should compute companion .lrc path correctly", () => {
		expect(getCompanionLrcPath("Music/Band/song.flac")).toBe("Music/Band/song.lrc");
		expect(getCompanionLrcPath("track.mp3")).toBe("track.lrc");
		expect(getCompanionLrcPath("nested/dir/audio.wav")).toBe("nested/dir/audio.lrc");
		expect(getCompanionLrcPath("")).toBe("");
	});

	it("should locate existing companion .lrc file in vault", () => {
		const app = new App();
		const lrcFile = createMockTFile("Music/song.lrc", "song.lrc");

		vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p: string) => {
			if (p === "Music/song.lrc") return lrcFile;
			return null;
		});

		const audioFile = createMockTFile("Music/song.mp3", "song.mp3");
		const found = getCompanionLrcFile(app, audioFile);

		expect(found).toBe(lrcFile);

		// Non-existent path returns null
		const notFound = getCompanionLrcFile(app, "Music/other.mp3");
		expect(notFound).toBeNull();
	});

	it("should read companion .lrc file content via vault.read", async () => {
		const app = new App();
		const lrcFile = createMockTFile("Music/song.lrc", "song.lrc");

		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(lrcFile);
		vi.spyOn(app.vault, "read").mockResolvedValue("[00:01.00]Companion lyrics line\n");

		const content = await readCompanionLrc(app, "Music/song.mp3");
		expect(content).toBe("[00:01.00]Companion lyrics line\n");
	});

	it("should return null if companion .lrc file is missing or empty", async () => {
		const app = new App();
		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(null);

		const result = await readCompanionLrc(app, "Music/no-lyrics.mp3");
		expect(result).toBeNull();
	});
});
