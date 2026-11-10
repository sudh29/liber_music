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
				manifest: { id: "liber-music-player", dir: ".obsidian/plugins/liber-music-player" },
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

		it("should return false when track is null or undefined", async () => {
			const result = await scrobbler.scrobbleTrack(null as any);
			expect(result).toBe(false);
		});

		it("should prepend new record to existing history.json records", async () => {
			mockApp.vault.adapter.exists.mockResolvedValue(true);
			mockApp.vault.adapter.read.mockResolvedValue(
				JSON.stringify([{ title: "Older Song", trackPath: "Music/Older.mp3" }])
			);

			await scrobbler.scrobbleTrack(mockFile, { title: "New Song" });

			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				expect.stringContaining("history.json"),
				expect.stringMatching(/"title": "New Song"[\s\S]*"title": "Older Song"/)
			);
		});

		it("should reset records to empty array if history.json contains invalid JSON or non-array", async () => {
			mockApp.vault.adapter.exists.mockResolvedValue(true);
			mockApp.vault.adapter.read.mockResolvedValue("{ malformed json }");

			await scrobbler.scrobbleTrack(mockFile, { title: "Fresh Song" });

			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				expect.stringContaining("history.json"),
				expect.stringContaining("Fresh Song")
			);

			// Test non-array JSON object
			mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify({ notAnArray: true }));
			const freshFile = new TFile();
			freshFile.path = "Music/Another.mp3";
			freshFile.basename = "Another";

			await scrobbler.scrobbleTrack(freshFile, { title: "Another Song" });
			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				expect.stringContaining("history.json"),
				expect.stringContaining("Another Song")
			);
		});

		it("should cap history.json records to 1000 entries", async () => {
			mockApp.vault.adapter.exists.mockResolvedValue(true);
			const hugeHistory = Array.from({ length: 1050 }, (_, i) => ({
				title: `Song ${i}`,
				trackPath: `Music/Song${i}.mp3`,
			}));
			mockApp.vault.adapter.read.mockResolvedValue(JSON.stringify(hugeHistory));

			await scrobbler.scrobbleTrack(mockFile, { title: "Overflow Song" });

			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				expect.stringContaining("history.json"),
				expect.toSatisfy((content: string) => {
					const parsed = JSON.parse(content);
					return Array.isArray(parsed) && parsed.length === 1000 && parsed[0].title === "Overflow Song";
				})
			);
		});

		it("should handle history.json write error gracefully", async () => {
			mockApp.vault.adapter.exists.mockResolvedValue(false);
			mockApp.vault.adapter.write.mockRejectedValue(new Error("Disk full"));
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await scrobbler.scrobbleTrack(mockFile);
			expect(result).toBe(true);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Failed to record track to history.json"),
				expect.any(Error)
			);
			warnSpy.mockRestore();
		});

		it("should create parent folder for daily notes if folder does not exist", async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			mockApp.vault.createFolder.mockRejectedValueOnce(new Error("Folder already exists"));

			const result = await scrobbler.scrobbleTrack(mockFile, { title: "Folder Test" });
			expect(result).toBe(true);
			expect(mockApp.vault.createFolder).toHaveBeenCalledWith("Daily Notes");
			expect(mockApp.vault.create).toHaveBeenCalled();
		});

		it("should handle error gracefully when recording to daily note fails", async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
			mockApp.vault.create.mockRejectedValue(new Error("Vault write error"));
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			const result = await scrobbler.scrobbleTrack(mockFile);
			expect(result).toBe(true);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Failed to record track to Daily Notes"),
				expect.any(Error)
			);
			warnSpy.mockRestore();
		});
	});
});
