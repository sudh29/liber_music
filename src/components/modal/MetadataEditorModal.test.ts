import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { MetadataEditorModal } from "./MetadataEditorModal";

describe("MetadataEditorModal", () => {
	let app: App;
	let plugin: any;

	beforeEach(() => {
		app = new App();
		plugin = {
			app,
			settings: {
				trackIndex: {
					"id_1": "Music/Artist/Song.mp3",
				},
				tracks: {
					"id_1": {
						title: "Original Title",
						artist: "Original Artist",
						album: "Original Album",
						year: 2000,
						genre: "Rock",
						track: 1,
						rating: 3,
						lyrics: "[00:10.00]Hello world",
					},
				},
				ratings: {
					"id_1": 3,
				},
				artists: {},
				albums: {},
			},
			saveSettings: vi.fn().mockResolvedValue(undefined),
		};
	});

	it("should open and populate existing track metadata", () => {
		const modal = new MetadataEditorModal(app, plugin, "Music/Artist/Song.mp3");
		modal.onOpen();

		const titleInput = modal.contentEl.querySelector(".metadata-form-input") as HTMLInputElement;
		expect(titleInput.value).toBe("Original Title");

		const stars = modal.contentEl.querySelectorAll(".metadata-star-btn");
		expect(stars.length).toBe(5);
		// 3 stars active
		expect((stars[0] as any).hasClass("active")).toBe(true);
		expect((stars[1] as any).hasClass("active")).toBe(true);
		expect((stars[2] as any).hasClass("active")).toBe(true);
		expect((stars[3] as any).hasClass("active")).toBe(false);

		const textarea = modal.contentEl.querySelector(".metadata-lyrics-textarea") as HTMLTextAreaElement;
		expect(textarea.value).toBe("[00:10.00]Hello world");
	});

	it("should save updated fields, ratings, and call onSave callback", async () => {
		const onSave = vi.fn();
		const modal = new MetadataEditorModal(app, plugin, "Music/Artist/Song.mp3", { onSave });
		modal.onOpen();

		const inputs = modal.contentEl.querySelectorAll(".metadata-form-input") as NodeListOf<HTMLInputElement>;
		// Change title (index 0)
		inputs[0]!.value = "Updated Title";
		// Change artist (index 1)
		inputs[1]!.value = "Updated Artist";
		// Change album (index 2)
		inputs[2]!.value = "Updated Album";
		// Change year (index 4)
		inputs[4]!.value = "2024";

		// Click 5th star
		const stars = modal.contentEl.querySelectorAll(".metadata-star-btn");
		(stars[4] as HTMLElement).click();

		// Click Save button
		const saveBtn = modal.contentEl.querySelector(".mod-cta") as HTMLButtonElement;
		saveBtn.click();

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(plugin.settings.tracks["id_1"].title).toBe("Updated Title");
		expect(plugin.settings.tracks["id_1"].artist).toBe("Updated Artist");
		expect(plugin.settings.tracks["id_1"].album).toBe("Updated Album");
		expect(plugin.settings.tracks["id_1"].year).toBe(2024);
		expect(plugin.settings.tracks["id_1"].rating).toBe(5);
		expect(plugin.settings.ratings["id_1"]).toBe(5);
		expect(plugin.saveSettings).toHaveBeenCalled();
		expect(onSave).toHaveBeenCalled();
	});

	it("should update companion .lrc file if lyrics are modified", async () => {
		// Mock vault modify/create
		const mockLrcFile = new TFile("Music/Artist/Song.lrc");
		(app.vault as any).getAbstractFileByPath = vi.fn().mockImplementation((p: string) => {
			if (p.endsWith(".lrc")) return mockLrcFile;
			return null;
		});
		(app.vault as any).modify = vi.fn().mockResolvedValue(undefined);

		const modal = new MetadataEditorModal(app, plugin, "Music/Artist/Song.mp3");
		modal.onOpen();

		const textarea = modal.contentEl.querySelector(".metadata-lyrics-textarea") as HTMLTextAreaElement;
		textarea.value = "[00:12.00]Brand new lyrics";

		const saveBtn = modal.contentEl.querySelector(".mod-cta") as HTMLButtonElement;
		saveBtn.click();

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(app.vault.modify).toHaveBeenCalledWith(mockLrcFile, "[00:12.00]Brand new lyrics");
	});

	it("should clear companion .lrc file if lyrics are emptied", async () => {
		const mockLrcFile = new TFile("Music/Artist/Song.lrc");
		(app.vault as any).getAbstractFileByPath = vi.fn().mockImplementation((p: string) => {
			if (p.endsWith(".lrc")) return mockLrcFile;
			return null;
		});
		(app.vault as any).modify = vi.fn().mockResolvedValue(undefined);

		// Initialize with some lyrics
		plugin.settings.tracks["id_1"].lyrics = "Old lyrics";

		const modal = new MetadataEditorModal(app, plugin, "Music/Artist/Song.mp3");
		modal.onOpen();

		const textarea = modal.contentEl.querySelector(".metadata-lyrics-textarea") as HTMLTextAreaElement;
		textarea.value = "   "; // empty/whitespace

		const saveBtn = modal.contentEl.querySelector(".mod-cta") as HTMLButtonElement;
		saveBtn.click();

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(app.vault.modify).toHaveBeenCalledWith(mockLrcFile, "");
	});
});
