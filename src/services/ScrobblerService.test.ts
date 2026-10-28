import { describe, it, expect, vi, beforeEach } from "vitest";
import { TFile } from "obsidian";
import { ScrobblerService, appendEntryToDailyNote } from "./ScrobblerService";

describe("ScrobblerService", () => {
	describe("appendEntryToDailyNote", () => {
		it("should create new section if file is empty", () => {
			const result = appendEntryToDailyNote("", "## 🎧 Music Log", "- 14:23 — Song");
			expect(result).toBe("## 🎧 Music Log\n- 14:23 — Song\n");
		});

		it("should append heading and bullet to end if heading is missing", () => {
			const existing = "# My Notes\n\nSome content here.";
			const result = appendEntryToDailyNote(existing, "## 🎧 Music Log", "- 14:23 — Song");
			expect(result).toBe("# My Notes\n\nSome content here.\n\n## 🎧 Music Log\n- 14:23 — Song\n");
		});

		it("should append bullet directly under heading if heading exists at end of file", () => {
			const existing = "# Daily Journal\n\n## 🎧 Music Log\n- 12:00 — First Song";
			const result = appendEntryToDailyNote(existing, "## 🎧 Music Log", "- 14:23 — Second Song");
			expect(result).toBe("# Daily Journal\n\n## 🎧 Music Log\n- 12:00 — First Song\n- 14:23 — Second Song\n");
		});

		it("should insert bullet before next heading of equal level", () => {
			const existing = "# Daily Journal\n\n## 🎧 Music Log\n- 12:00 — First Song\n\n## Tasks\n- [ ] Do laundry";
			const result = appendEntryToDailyNote(existing, "## 🎧 Music Log", "- 14:23 — Second Song");
			expect(result).toContain("## 🎧 Music Log\n- 12:00 — First Song\n- 14:23 — Second Song");
			expect(result).toContain("## Tasks\n- [ ] Do laundry");
		});
	});

	describe("ScrobblerService integration", () => {
		let mockApp: any;
		let mockPlugin: any;
		let scrobbler: ScrobblerService;
		let mockFile: TFile;

		beforeEach(() => {
			mockFile = new TFile();
			mockFile.path = "Music/Song.mp3";
			mockFile.basename = "Song";

			mockApp = {
				vault: {
					getAbstractFileByPath: vi.fn(),
					read: vi.fn(),
					modify: vi.fn().mockResolvedValue(undefined),
					create: vi.fn().mockResolvedValue(new TFile()),
					createFolder: vi.fn().mockResolvedValue(undefined),
					adapter: {
						exists: vi.fn().mockResolvedValue(false),
						read: vi.fn(),
						write: vi.fn().mockResolvedValue(undefined),
					},
				},
				internalPlugins: {
					getPluginById: vi.fn().mockReturnValue({
						instance: {
							options: {
								folder: "Daily Notes",
								format: "YYYY-MM-DD",
							},
						},
					}),
				},
			};

			mockPlugin = {
				manifest: { dir: ".obsidian/plugins/liber-music-player-plugin" },
				settings: {
					dailyNotesScrobbler: true,
					dailyNotesHeading: "## 🎧 Music Log",
				},
			};

			scrobbler = new ScrobblerService(mockApp, mockPlugin);
		});

		it("should calculate correct daily note path based on internal plugin options", () => {
			const path = scrobbler.getDailyNotePath();
			expect(path).toMatch(/^Daily Notes\/\d{4}-\d{2}-\d{2}\.md$/);
		});

		it("should record track to existing daily note", async () => {
			const mockDailyNote = new TFile();
			mockDailyNote.path = "Daily Notes/2026-10-28.md";
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockDailyNote);
			mockApp.vault.read.mockResolvedValue("# Daily Note\n\n## 🎧 Music Log\n");

			const result = await scrobbler.scrobbleTrack(mockFile, {
				title: "Bohemian Rhapsody",
				artist: "Queen",
				album: "A Night at the Opera",
			});

			expect(result).toBe(true);
			expect(mockApp.vault.modify).toHaveBeenCalledWith(
				mockDailyNote,
				expect.stringContaining("Bohemian Rhapsody")
			);
			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				expect.stringContaining("history.json"),
				expect.stringContaining("Bohemian Rhapsody")
			);
		});

		it("should create daily note if it does not exist", async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await scrobbler.scrobbleTrack(mockFile, {
				title: "Nocturne",
				artist: "Chopin",
				album: "Opus 9",
			});

			expect(result).toBe(true);
			expect(mockApp.vault.create).toHaveBeenCalledWith(
				expect.stringContaining(".md"),
				expect.stringContaining("Nocturne")
			);
		});

		it("should skip scrobbling if track was scrobbled within 60 seconds", async () => {
			const mockDailyNote = new TFile();
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockDailyNote);
			mockApp.vault.read.mockResolvedValue("# Daily Note\n");

			const first = await scrobbler.scrobbleTrack(mockFile);
			expect(first).toBe(true);

			const second = await scrobbler.scrobbleTrack(mockFile);
			expect(second).toBe(false);
		});

		it("should record to history.json even if daily notes scrobbler is toggled off", async () => {
			mockPlugin.settings.dailyNotesScrobbler = false;

			const result = await scrobbler.scrobbleTrack(mockFile, {
				title: "Offline Track",
				artist: "Offline Artist",
				album: "Offline Album",
			});

			expect(result).toBe(true);
			expect(mockApp.vault.modify).not.toHaveBeenCalled();
			expect(mockApp.vault.create).not.toHaveBeenCalled();
			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				expect.stringContaining("history.json"),
				expect.stringContaining("Offline Track")
			);
		});
	});
});
