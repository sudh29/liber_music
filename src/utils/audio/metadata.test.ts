import { describe, expect, it, vi, beforeEach } from "vitest";
import { App, TFile } from "obsidian";

const mockParseBuffer = vi.fn();

vi.mock("music-metadata", () => ({
	parseBuffer: (...args: any[]) => mockParseBuffer(...args),
}));

const mockFs = {
	existsSync: vi.fn(),
	openSync: vi.fn(),
	readSync: vi.fn(),
	closeSync: vi.fn(),
};

vi.mock("node:fs", () => ({
	...mockFs,
	default: mockFs,
}));

import {
	getEmbeddedAudioMetadataFromBuffer,
	getEmbeddedCoverFromFile,
	METADATA_HEADER_CHUNK_SIZE,
	readAudioFileBinary,
	readAudioFileHeaderBinary,
} from "./metadata";

function createMockTFile(path: string, name?: string): TFile {
	const file = new TFile(path);
	file.path = path;
	file.name = name || path.split("/").pop() || "song.mp3";
	file.basename = file.name.replace(/\.[^/.]+$/, "");
	file.extension = file.name.split(".").pop() || "mp3";
	return file;
}

describe("metadata audio utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should define METADATA_HEADER_CHUNK_SIZE as 512KB", () => {
		expect(METADATA_HEADER_CHUNK_SIZE).toBe(512 * 1024);
	});

	describe("readAudioFileBinary", () => {
		it("should read binary using adapter.readBinary when available", async () => {
			const app = new App();
			const file = createMockTFile("music/test.mp3");
			const buffer = new ArrayBuffer(128);

			vi.spyOn(app.vault.adapter, "readBinary").mockResolvedValue(buffer);

			const result = await readAudioFileBinary(app, file);
			expect(result).toBe(buffer);
		});

		it("should fall back to vault.readBinary when adapter.readBinary fails", async () => {
			const app = new App();
			const file = createMockTFile("music/test.mp3");
			const buffer = new ArrayBuffer(256);

			vi.spyOn(app.vault.adapter, "readBinary").mockRejectedValue(new Error("Adapter failure"));
			vi.spyOn(app.vault, "readBinary").mockResolvedValue(buffer);

			const result = await readAudioFileBinary(app, file);
			expect(result).toBe(buffer);
		});

		it("should return null if both adapter and vault read fail", async () => {
			const app = new App();
			const file = createMockTFile("music/test.mp3");

			vi.spyOn(app.vault.adapter, "readBinary").mockRejectedValue(new Error("Adapter failure"));
			vi.spyOn(app.vault, "readBinary").mockRejectedValue(new Error("Vault failure"));

			const result = await readAudioFileBinary(app, file);
			expect(result).toBeNull();
		});

		it("should return null if read result is not an ArrayBuffer", async () => {
			const app = new App();
			const file = createMockTFile("music/test.mp3");

			// @ts-expect-error testing invalid return type
			vi.spyOn(app.vault.adapter, "readBinary").mockResolvedValue("invalid string");

			const result = await readAudioFileBinary(app, file);
			expect(result).toBeNull();
		});

		it("should catch unexpected error and log error in outer catch block", async () => {
			const app = new App();
			let accessCount = 0;
			const corruptFile = {
				get path(): string {
					accessCount++;
					if (accessCount <= 2) {
						throw new Error("Vault filesystem engine crash");
					}
					return "music/test.mp3";
				},
			} as any;

			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const result = await readAudioFileBinary(app, corruptFile);
			expect(result).toBeNull();
			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error reading audio file"),
				expect.any(Error)
			);
			errorSpy.mockRestore();
		});
	});

	describe("readAudioFileHeaderBinary", () => {
		it("should slice large buffer down to maxBytes in fallback mode", async () => {
			const app = new App();
			const file = createMockTFile("music/large.flac");

			const largeBuffer = new ArrayBuffer(1024 * 1024);
			vi.spyOn(app.vault.adapter, "readBinary").mockResolvedValue(largeBuffer);

			const result = await readAudioFileHeaderBinary(app, file, 64 * 1024);
			expect(result).not.toBeNull();
			expect(result?.byteLength).toBe(64 * 1024);
		});

		it("should preserve buffer intact if already smaller than maxBytes", async () => {
			const app = new App();
			const file = createMockTFile("music/small.mp3");

			const smallBuffer = new ArrayBuffer(1024);
			vi.spyOn(app.vault.adapter, "readBinary").mockResolvedValue(smallBuffer);

			const result = await readAudioFileHeaderBinary(app, file, 64 * 1024);
			expect(result).not.toBeNull();
			expect(result?.byteLength).toBe(1024);
		});

		it("should use desktop fs.readSync if getBasePath exists", async () => {
			const app = new App();
			const file = createMockTFile("music/desktop.mp3");

			(app.vault.adapter as any).getBasePath = () => "/vault";

			mockFs.existsSync.mockReturnValue(true);
			mockFs.openSync.mockReturnValue(42 as any);
			mockFs.readSync.mockImplementation((_fd: any, buf: any) => {
				buf.fill(1);
				return 512;
			});
			mockFs.closeSync.mockReturnValue(undefined);

			const result = await readAudioFileHeaderBinary(app, file, 512);
			expect(result).not.toBeNull();
			expect(result?.byteLength).toBe(512);
			expect(mockFs.openSync).toHaveBeenCalled();
			expect(mockFs.closeSync).toHaveBeenCalledWith(42);
		});
	});

	describe("getEmbeddedAudioMetadataFromBuffer", () => {
		it("should reject non-ArrayBuffer and empty buffer gracefully", async () => {
			// @ts-expect-error invalid param
			expect(await getEmbeddedAudioMetadataFromBuffer("not-buffer")).toBeNull();
			expect(await getEmbeddedAudioMetadataFromBuffer(new ArrayBuffer(0))).toBeNull();
		});

		it("should extract metadata, cover picture base64 data URL, and replayGain", async () => {
			const buffer = new ArrayBuffer(100);
			const pictureData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // mock jpeg bytes

			mockParseBuffer.mockResolvedValue({
				format: { duration: 180 },
				common: {
					title: "Starman",
					artist: ["David Bowie", "The Spiders from Mars"],
					album: "Ziggy Stardust",
					albumartist: ["David Bowie"],
					year: 1972,
					genre: ["Glam Rock", "Classic Rock"],
					track: { no: 4, of: 11 },
					picture: [{ data: pictureData, format: "image/jpeg" }],
					replaygain_track_gain: "-4.5 dB",
				},
				native: {},
				quality: { warnings: [] },
			});

			const metadata = await getEmbeddedAudioMetadataFromBuffer(buffer);
			expect(metadata).not.toBeNull();
			expect(metadata?.title).toBe("Starman");
			expect(metadata?.artist).toBe("David Bowie, The Spiders from Mars");
			expect(metadata?.album).toBe("Ziggy Stardust");
			expect(metadata?.albumArtist).toBe("David Bowie");
			expect(metadata?.year).toBe(1972);
			expect(metadata?.genre).toBe("Glam Rock, Classic Rock");
			expect(metadata?.track).toBe(4);
			expect(metadata?.duration).toBe(180);
			expect(metadata?.coverDataUrl).toContain("data:image/jpeg;base64,");
			expect(metadata?.replayGainDb).toBe(-4.5);
		});

		it("should fall back to native tags for title and artist if common is missing", async () => {
			const buffer = new ArrayBuffer(100);

			mockParseBuffer.mockResolvedValue({
				format: { duration: 200 },
				common: {
					track: 2,
					genre: "Rock",
					artist: undefined,
					title: undefined,
				},
				native: {
					"ID3v2.3": [
						{ id: "TIT2", value: "Native Title" },
						{ id: "TPE1", value: "Native Artist" },
					],
				},
				quality: { warnings: [] },
			});

			const metadata = await getEmbeddedAudioMetadataFromBuffer(buffer);
			expect(metadata?.title).toBe("Native Title");
			expect(metadata?.artist).toBe("Native Artist");
			expect(metadata?.track).toBe(2);
		});

		it("should extract lyrics from native tags and prioritize timestamped lyrics", async () => {
			const buffer = new ArrayBuffer(100);

			mockParseBuffer.mockResolvedValue({
				format: {},
				common: {
					lyrics: ["Untimed lyrics line 1\nUntimed lyrics line 2"],
				},
				native: {
					"ID3v2.3": [
						{
							id: "TXXX:LYRICS",
							value: "[00:01.00]Timestamped line 1\n[00:05.00]Timestamped line 2",
						},
					],
				},
				quality: { warnings: [] },
			});

			const metadata = await getEmbeddedAudioMetadataFromBuffer(buffer);
			expect(metadata?.lyricsText).toContain("[00:01.00]Timestamped line 1");
		});

		it("should group multiple chunks under the same format and tag ID and handle slash rejoining", async () => {
			const buffer = new ArrayBuffer(100);

			mockParseBuffer.mockResolvedValue({
				format: {},
				common: {},
				native: {
					"ID3v2.3": [
						{
							id: "TXXX:UNSYNCED_LYRICS",
							value: "First verse chunk",
						},
						{
							id: "TXXX:UNSYNCED_LYRICS",
							value: "second verse chunk",
						},
					],
				},
				quality: { warnings: [] },
			});

			const metadata = await getEmbeddedAudioMetadataFromBuffer(buffer);
			expect(metadata?.lyricsText).toBe("First verse chunk/second verse chunk");
		});

		it("should match lyrics tags by description when id is not an explicit lyrics id", async () => {
			const buffer = new ArrayBuffer(100);

			mockParseBuffer.mockResolvedValue({
				format: {},
				common: {},
				native: {
					"ID3v2.3": [
						// Non-matching tag (COMM) with non-matching description object
						{
							id: "COMM",
							value: { description: "comment", text: "just a comment" },
						},
						// Tag with invalid description types to test descriptionFromUnknown
						{
							id: "OTHER",
							value: { description: 123, text: "invalid desc" },
						},
						{
							id: "OTHER2",
							value: "plain string no desc",
						},
						// Empty text tag that should be skipped
						{
							id: "USLT",
							value: "   ",
						},
						// Matching by description
						{
							id: "TXXX",
							value: {
								description: "SubRip Lyrics",
								text: "[00:03.50]Synchronized via description",
							},
						},
					],
				},
				quality: { warnings: [] },
			});

			const metadata = await getEmbeddedAudioMetadataFromBuffer(buffer);
			expect(metadata?.lyricsText).toBe("[00:03.50]Synchronized via description");
		});

		it("should fall back to common.lyrics if native lyrics tags are absent", async () => {
			const buffer = new ArrayBuffer(100);

			mockParseBuffer.mockResolvedValue({
				format: {},
				common: {
					lyrics: [
						{ text: "Common lyrics line 1" },
						"Common lyrics line 2",
						null,
						123,
						{ text: 456 },
						{ other: "no-text" },
					],
				},
				native: {},
				quality: { warnings: [] },
			});

			const metadata = await getEmbeddedAudioMetadataFromBuffer(buffer);
			expect(metadata?.lyricsText).toBe("Common lyrics line 1\nCommon lyrics line 2");
		});

		it("should return null and log error if parseBuffer throws", async () => {
			const buffer = new ArrayBuffer(100);
			mockParseBuffer.mockRejectedValue(new Error("Corrupt audio"));

			const metadata = await getEmbeddedAudioMetadataFromBuffer(buffer);
			expect(metadata).toBeNull();
		});
	});

	describe("getEmbeddedCoverFromFile", () => {
		it("should return undefined if file extension is unsupported", async () => {
			const app = new App();
			const file = createMockTFile("music/song.txt", "song.txt");

			const cover = await getEmbeddedCoverFromFile(app, file);
			expect(cover).toBeUndefined();
		});

		it("should return undefined if readAudioFileBinary returns null", async () => {
			const app = new App();
			const file = createMockTFile("music/song.mp3");

			vi.spyOn(app.vault.adapter, "readBinary").mockRejectedValue(new Error("Read failed"));
			vi.spyOn(app.vault, "readBinary").mockRejectedValue(new Error("Read failed"));

			const cover = await getEmbeddedCoverFromFile(app, file);
			expect(cover).toBeUndefined();
		});

		it("should return coverDataUrl when cover exists", async () => {
			const app = new App();
			const file = createMockTFile("music/song.mp3");
			const buffer = new ArrayBuffer(100);

			vi.spyOn(app.vault.adapter, "readBinary").mockResolvedValue(buffer);
			mockParseBuffer.mockResolvedValue({
				format: {},
				common: {
					picture: [{ data: new Uint8Array([1, 2, 3]), format: "image/png" }],
				},
				native: {},
				quality: { warnings: [] },
			});

			const cover = await getEmbeddedCoverFromFile(app, file);
			expect(cover).toContain("data:image/png;base64,");
		});

		it("should return undefined and catch errors if processing fails", async () => {
			const app = new App();
			const file = createMockTFile("music/song.mp3");

			vi.spyOn(app.vault.adapter, "readBinary").mockImplementation(() => {
				throw new Error("Fatal disk crash");
			});

			const cover = await getEmbeddedCoverFromFile(app, file);
			expect(cover).toBeUndefined();
		});

		it("should catch unexpected error and log error in getEmbeddedCoverFromFile outer catch block", async () => {
			const app = new App();
			const corruptFile = {
				path: "music/crash.mp3",
				get extension(): string {
					throw new Error("Extension getter failure");
				},
			} as any;

			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const cover = await getEmbeddedCoverFromFile(app, corruptFile);
			expect(cover).toBeUndefined();
			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error getting embedded cover"),
				expect.any(Error)
			);
			errorSpy.mockRestore();
		});
	});
});
