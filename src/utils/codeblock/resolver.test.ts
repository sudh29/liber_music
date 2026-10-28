import { describe, it, expect, vi } from "vitest";
import { TFile } from "obsidian";
import { resolveVaultAudioFile } from "./resolver";

describe("resolveVaultAudioFile", () => {
	it("should resolve file via direct vault path", () => {
		const mockFile = new TFile();
		mockFile.path = "Music/Rock/Queen - Bohemian Rhapsody.mp3";
		mockFile.extension = "mp3";

		const mockApp: any = {
			vault: {
				getAbstractFileByPath: vi.fn().mockImplementation((path) => {
					if (path === "Music/Rock/Queen - Bohemian Rhapsody.mp3") return mockFile;
					return null;
				}),
				getFiles: vi.fn().mockReturnValue([mockFile]),
			},
		};

		const result = resolveVaultAudioFile(mockApp, "Music/Rock/Queen - Bohemian Rhapsody.mp3");
		expect(result).toBe(mockFile);
	});

	it("should resolve file from trackIndex map", () => {
		const mockFile = new TFile();
		mockFile.path = "Music/Classical/Chopin.flac";
		mockFile.extension = "flac";

		const mockApp: any = {
			vault: {
				getAbstractFileByPath: vi.fn().mockImplementation((path) => {
					if (path === "Music/Classical/Chopin.flac") return mockFile;
					return null;
				}),
				getFiles: vi.fn().mockReturnValue([mockFile]),
			},
		};

		const trackIndex = {
			"track-123": "Music/Classical/Chopin.flac",
		};

		const result = resolveVaultAudioFile(mockApp, "track-123", trackIndex);
		expect(result).toBe(mockFile);
	});

	it("should resolve file via filename match across vault", () => {
		const mockFile = new TFile();
		mockFile.path = "Vault/Subfolder/Deep/song.ogg";
		mockFile.name = "song.ogg";
		mockFile.basename = "song";
		mockFile.extension = "ogg";

		const mockApp: any = {
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
				getFiles: vi.fn().mockReturnValue([mockFile]),
			},
		};

		const result = resolveVaultAudioFile(mockApp, "song.ogg");
		expect(result).toBe(mockFile);
	});

	it("should return null if file cannot be found or has unsupported extension", () => {
		const textFile = new TFile();
		textFile.path = "Document.txt";
		textFile.extension = "txt";

		const mockApp: any = {
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(textFile),
				getFiles: vi.fn().mockReturnValue([textFile]),
			},
		};

		const result = resolveVaultAudioFile(mockApp, "Document.txt");
		expect(result).toBeNull();
	});
});
