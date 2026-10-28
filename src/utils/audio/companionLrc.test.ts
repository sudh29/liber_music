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
		expect(getCompanionLrcPath("Music/song.remix.v2.flac")).toBe("Music/song.remix.v2.lrc");
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

		// Path that is already .lrc should return null
		expect(getCompanionLrcFile(app, "Music/song.lrc")).toBeNull();

		// Target file that is not .lrc (e.g. txt) should return null
		const txtFile = createMockTFile("Music/track.lrc", "track.lrc");
		txtFile.extension = "txt";
		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(txtFile);
		expect(getCompanionLrcFile(app, "Music/track.mp3")).toBeNull();
	});

	it("should read companion .lrc file content via vault.read and ignore whitespace-only content", async () => {
		const app = new App();
		const lrcFile = createMockTFile("Music/song.lrc", "song.lrc");

		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(lrcFile);
		vi.spyOn(app.vault, "read").mockResolvedValueOnce("[00:01.00]Companion lyrics line\n");

		const content = await readCompanionLrc(app, "Music/song.mp3");
		expect(content).toBe("[00:01.00]Companion lyrics line\n");

		// When content is only whitespace, should return null
		vi.spyOn(app.vault, "read").mockResolvedValueOnce("   \n\t  ");
		expect(await readCompanionLrc(app, "Music/song.mp3")).toBeNull();
	});

	it("should read companion .lrc via vault adapter when getAbstractFileByPath returns null", async () => {
		const app = new App();
		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(null);

		const existsSpy = vi.fn().mockResolvedValue(true);
		const readSpy = vi.fn().mockResolvedValue("[00:02.00]Adapter fallback lyrics\n");
		(app.vault as unknown as { adapter: { exists: typeof existsSpy; read: typeof readSpy } }).adapter = {
			exists: existsSpy,
			read: readSpy,
		};

		const content = await readCompanionLrc(app, "Music/song.mp3");
		expect(existsSpy).toHaveBeenCalledWith("Music/song.lrc");
		expect(readSpy).toHaveBeenCalledWith("Music/song.lrc");
		expect(content).toBe("[00:02.00]Adapter fallback lyrics\n");
	});

	it("should return null if companion .lrc file is missing in both vault and adapter", async () => {
		const app = new App();
		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(null);
		(app.vault as unknown as { adapter: { exists: (p: string) => Promise<boolean> } }).adapter = {
			exists: vi.fn().mockResolvedValue(false),
		};

		const result = await readCompanionLrc(app, "Music/no-lyrics.mp3");
		expect(result).toBeNull();
	});

	it("should catch adapter error and return null", async () => {
		const app = new App();
		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(null);
		(app.vault as unknown as { adapter: { exists: any; read: any } }).adapter = {
			exists: vi.fn().mockResolvedValue(true),
			read: vi.fn().mockRejectedValue(new Error("Adapter read error")),
		};

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const result = await readCompanionLrc(app, "Music/corrupt.mp3");
		expect(result).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Adapter read failed for companion .lrc"),
			expect.any(Error)
		);
		warnSpy.mockRestore();
	});

	it("should catch unexpected error in outer try/catch and return null", async () => {
		const app = new App();
		vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation(() => {
			throw new Error("Vault internal error");
		});

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const result = await readCompanionLrc(app, "Music/crash.mp3");
		expect(result).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read companion .lrc lyric file"),
			expect.any(Error)
		);
		warnSpy.mockRestore();
	});

	it("should return null immediately if input audioPath is already an .lrc path", async () => {
		const app = new App();
		const result = await readCompanionLrc(app, "Music/already.lrc");
		expect(result).toBeNull();
	});

	it("should return null if adapter read returns only whitespace", async () => {
		const app = new App();
		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(null);
		(app.vault as unknown as { adapter: { exists: any; read: any } }).adapter = {
			exists: vi.fn().mockResolvedValue(true),
			read: vi.fn().mockResolvedValue("   \t  \n  "),
		};

		const result = await readCompanionLrc(app, "Music/whitespace.mp3");
		expect(result).toBeNull();
	});
});

