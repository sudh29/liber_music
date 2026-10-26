import { describe, expect, it, vi } from "vite-plus/test";
import {
	getEmbeddedAudioMetadataFromBuffer,
	METADATA_HEADER_CHUNK_SIZE,
	readAudioFileHeaderBinary,
} from "./metadata";
import { App, TFile } from "obsidian";

function createMockTFile(path: string, name: string): TFile {
	const file = new TFile();
	file.path = path;
	file.name = name;
	file.basename = name.replace(/\.[^/.]+$/, "");
	file.extension = name.split(".").pop() || "";
	return file;
}

describe("metadata audio header chunking and extraction", () => {
	it("should define METADATA_HEADER_CHUNK_SIZE as 256KB", () => {
		expect(METADATA_HEADER_CHUNK_SIZE).toBe(256 * 1024);
	});

	it("should slice large buffer down to maxBytes in readAudioFileHeaderBinary", async () => {
		const app = new App();
		const file = createMockTFile("Music/large.flac", "large.flac");

		// Simulate 1MB buffer
		const largeBuffer = new ArrayBuffer(1024 * 1024);
		vi.spyOn(app.vault.adapter, "readBinary").mockResolvedValue(largeBuffer);

		const result = await readAudioFileHeaderBinary(app, file, 64 * 1024);
		expect(result).not.toBeNull();
		expect(result?.byteLength).toBe(64 * 1024);
	});

	it("should preserve buffer intact if already smaller than maxBytes", async () => {
		const app = new App();
		const file = createMockTFile("Music/small.mp3", "small.mp3");

		const smallBuffer = new ArrayBuffer(1024);
		vi.spyOn(app.vault.adapter, "readBinary").mockResolvedValue(smallBuffer);

		const result = await readAudioFileHeaderBinary(app, file, 64 * 1024);
		expect(result).not.toBeNull();
		expect(result?.byteLength).toBe(1024);
	});

	it("should reject non-ArrayBuffer inputs in getEmbeddedAudioMetadataFromBuffer gracefully", async () => {
		// @ts-expect-error testing invalid runtime argument
		const result = await getEmbeddedAudioMetadataFromBuffer("not-a-buffer");
		expect(result).toBeNull();
	});

	it("should reject empty ArrayBuffer in getEmbeddedAudioMetadataFromBuffer gracefully", async () => {
		const emptyBuffer = new ArrayBuffer(0);
		const result = await getEmbeddedAudioMetadataFromBuffer(emptyBuffer);
		expect(result).toBeNull();
	});
});
