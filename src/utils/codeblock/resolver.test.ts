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

	it("should return null for empty or whitespace-only identifier", () => {
		const mockApp: any = { vault: {} };
		expect(resolveVaultAudioFile(mockApp, "")).toBeNull();
		expect(resolveVaultAudioFile(mockApp, "   ")).toBeNull();
	});

	it("should resolve wikilink formatted identifier", () => {
		const mockFile = new TFile();
		mockFile.path = "Music/Song.mp3";
		mockFile.extension = "mp3";

		const mockApp: any = {
			vault: {
				getAbstractFileByPath: vi.fn().mockImplementation((path) => {
					if (path === "Music/Song.mp3") return mockFile;
					return null;
				}),
				getFiles: vi.fn().mockReturnValue([mockFile]),
			},
		};

		const result = resolveVaultAudioFile(mockApp, "[[Music/Song.mp3]]");
		expect(result).toBe(mockFile);
	});

	it("should resolve via partial path match in trackIndex values", () => {
		const mockFile = new TFile();
		mockFile.path = "Vault/Music/Ambient/Chill.mp3";
		mockFile.extension = "mp3";

		const mockApp: any = {
			vault: {
				getAbstractFileByPath: vi.fn().mockImplementation((path) => {
					if (path === "Vault/Music/Ambient/Chill.mp3") return mockFile;
					return null;
				}),
				getFiles: vi.fn().mockReturnValue([]),
			},
		};

		const trackIndex = {
			"t-1": "Vault/Music/Ambient/Chill.mp3",
		};

		const result = resolveVaultAudioFile(mockApp, "Chill.mp3", trackIndex);
		expect(result).toBe(mockFile);
	});

	it("should resolve via basename match without extension in vault search", () => {
		const mockAudio = new TFile();
		mockAudio.path = "Audio/MySong.mp3";
		mockAudio.name = "MySong.mp3";
		mockAudio.basename = "MySong";
		mockAudio.extension = "mp3";

		const mockNonAudio = new TFile();
		mockNonAudio.path = "Audio/Notes.md";
		mockNonAudio.extension = "md";

		const mockApp: any = {
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
				getFiles: vi.fn().mockReturnValue([mockNonAudio, mockAudio]),
			},
		};

		const result = resolveVaultAudioFile(mockApp, "mysong");
		expect(result).toBe(mockAudio);
	});

	it("should resolve via metadataCache getFirstLinkpathDest without scanning vault files", () => {
		const mockAudio = new TFile();
		mockAudio.path = "Audio/FastTrack.mp3";
		mockAudio.extension = "mp3";

		const getFilesSpy = vi.fn().mockReturnValue([]);
		const mockApp: any = {
			vault: {
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
				getFiles: getFilesSpy,
			},
			metadataCache: {
				getFirstLinkpathDest: vi.fn().mockImplementation((path) => {
					if (path === "FastTrack") return mockAudio;
					return null;
				}),
			},
		};

		const result = resolveVaultAudioFile(mockApp, "FastTrack");
		expect(result).toBe(mockAudio);
		expect(getFilesSpy).not.toHaveBeenCalled();
	});
});
