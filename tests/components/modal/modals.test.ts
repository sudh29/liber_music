// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import {
	ConfirmModal,
	PlaylistPickerModal,
	QueueModal,
	TextInputModal,
	TrackSearchModal,
} from "@/components";
import type MusicPlayerPlugin from "@/main";

describe("Modals", () => {
	const app = new App();

	describe("TextInputModal", () => {
		it("should prompt user and resolve with entered value on Enter key", async () => {
			const modal = new TextInputModal(app, "Enter playlist name", "Default Value");
			const promptPromise = modal.prompt();

			// Modal is open, simulate typing and pressing Enter
			const inputEl = (modal as any).inputEl as HTMLInputElement;
			inputEl.value = "New Jazz";
			inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

			const result = await promptPromise;
			expect(result).toBe("New Jazz");
		});

		it("should resolve with null on Escape key", async () => {
			const modal = new TextInputModal(app, "Enter name");
			const promptPromise = modal.prompt();

			const inputEl = (modal as any).inputEl as HTMLInputElement;
			inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

			const result = await promptPromise;
			expect(result).toBeNull();
		});

		it("should resolve with null if closed without submitting", async () => {
			const modal = new TextInputModal(app, "Enter name");
			const promptPromise = modal.prompt();

			modal.close();

			const result = await promptPromise;
			expect(result).toBeNull();
		});
	});

	describe("ConfirmModal", () => {
		it("should resolve with true when submitted", async () => {
			const modal = new ConfirmModal(app, "Delete Playlist", "Are you sure?");
			const promptPromise = modal.prompt();

			(modal as any).submit(true);

			const result = await promptPromise;
			expect(result).toBe(true);
		});

		it("should resolve with false when cancelled", async () => {
			const modal = new ConfirmModal(app, "Delete Playlist", "Are you sure?");
			const promptPromise = modal.prompt();

			(modal as any).cancel(false);

			const result = await promptPromise;
			expect(result).toBe(false);
		});

		it("should resolve with false on close without submit", async () => {
			const modal = new ConfirmModal(app, "Delete Playlist", "Are you sure?");
			const promptPromise = modal.prompt();

			modal.close();

			const result = await promptPromise;
			expect(result).toBe(false);
		});
	});

	describe("PlaylistPickerModal", () => {
		it("should list existing playlists and resolve on selection", async () => {
			const playlists = ["Rock", "Pop", "Classical"];
			const modal = new PlaylistPickerModal(app, playlists);

			expect(modal.getItems()).toEqual(playlists);
			expect(modal.getItemText("Rock")).toBe("Rock");

			const promptPromise = modal.prompt();

			modal.onChooseItem("Classical", new MouseEvent("click"));

			const result = await promptPromise;
			expect(result).toBe("Classical");
		});

		it("should resolve with null if closed without choosing", async () => {
			const modal = new PlaylistPickerModal(app, ["Rock"]);
			const promptPromise = modal.prompt();

			modal.close();

			// onClose uses setTimeout(..., 0)
			await new Promise((r) => setTimeout(r, 10));

			const result = await promptPromise;
			expect(result).toBeNull();
		});
	});

	describe("QueueModal & TrackSearchModal", () => {
		const plugin = {
			settings: {
				tracks: {
					"id-1": { title: "Song 1", artist: "Artist 1", album: "Album 1" },
				},
				trackIndex: { "id-1": "song1.mp3" },
			},
		} as unknown as MusicPlayerPlugin;

		it("should provide items and text for QueueModal", () => {
			const tracks = [new TFile("song1.mp3"), new TFile("song2.mp3")];
			const queueModal = new QueueModal(app, plugin, tracks, tracks[0]);

			expect(queueModal.getItems()).toEqual(tracks);
			const text = queueModal.getItemText(tracks[0]!);
			expect(text).toContain("Song 1");
		});

		it("should provide items and text for TrackSearchModal", () => {
			const tracks = [new TFile("song1.mp3")];
			const searchModal = new TrackSearchModal(app, plugin, tracks);

			expect(searchModal.getItems()).toEqual(tracks);
			const text = searchModal.getItemText(tracks[0]!);
			expect(text).toContain("Song 1");
		});
	});
});
