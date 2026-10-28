import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { SmartPlaylistModal } from "./SmartPlaylistModal";
import type { SmartPlaylistDefinition } from "@/types/settings";

describe("SmartPlaylistModal", () => {
	let app: App;
	let plugin: any;

	beforeEach(() => {
		app = new App();
		plugin = {
			app,
			settings: {
				trackIndex: {
					"id_1": "Music/Rock/Song1.mp3",
					"id_2": "Music/Jazz/Song2.mp3",
				},
				tracks: {
					"id_1": {
						title: "Rock Anthem",
						artist: "The Rockers",
						album: "Rock Album",
						year: 1980,
						rating: 5,
					},
					"id_2": {
						title: "Jazz Mood",
						artist: "The Smooth Cats",
						album: "Jazz Nights",
						year: 2005,
						rating: 3,
					},
				},
				smartPlaylists: {},
			},
			saveSettings: vi.fn().mockResolvedValue(undefined),
		};
	});

	it("should open and display live match preview count", () => {
		const modal = new SmartPlaylistModal(app, plugin);
		modal.onOpen();

		const badge = modal.contentEl.querySelector(".smart-preview-badge");
		expect(badge).toBeDefined();
		// Default rule is rating > 3; only id_1 has rating 5 > 3
		expect(badge?.textContent).toContain("1");

		const nameInput = modal.contentEl.querySelector(".smart-playlist-name-input") as HTMLInputElement;
		expect(nameInput).toBeDefined();
	});

	it("should allow adding a new rule and updating preview", () => {
		const modal = new SmartPlaylistModal(app, plugin);
		modal.onOpen();

		const buttons = modal.contentEl.querySelectorAll("button");
		// Find add rule button
		const addBtn = Array.from(buttons).find((b) => b.textContent?.includes("Add") || b.textContent?.includes("Condition"));
		expect(addBtn).toBeDefined();
		addBtn!.click();

		const rows = modal.contentEl.querySelectorAll(".smart-rule-row");
		expect(rows.length).toBe(2);
	});

	it("should save smart playlist definition to plugin settings", async () => {
		const onSave = vi.fn();
		const customDef: SmartPlaylistDefinition = {
			id: "smart_custom_1",
			name: "My Custom Rock",
			matchType: "all",
			rules: [
				{ id: "r1", field: "title", operator: "contains", value: "Rock" },
			],
			sortBy: "year",
			sortOrder: "desc",
			limit: 25,
		};

		const modal = new SmartPlaylistModal(app, plugin, {
			initialDefinition: customDef,
			onSave,
		});
		modal.onOpen();

		const saveBtn = modal.contentEl.querySelector(".mod-cta") as HTMLButtonElement;
		expect(saveBtn).toBeDefined();
		saveBtn.click();

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(plugin.settings.smartPlaylists["smart_custom_1"]).toBeDefined();
		expect(plugin.settings.smartPlaylists["smart_custom_1"].name).toBe("My Custom Rock");
		expect(plugin.settings.smartPlaylists["smart_custom_1"].limit).toBe(25);
		expect(plugin.saveSettings).toHaveBeenCalled();
		expect(onSave).toHaveBeenCalled();
	});
});
