import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { PlaylistService } from "./PlaylistService";
import type MusicPlayerPlugin from "@/main";
import { ConfirmModal, PlaylistPickerModal, TextInputModal } from "@/components";

describe("PlaylistService", () => {
	function createService(initialPlaylists: Record<string, string[]> = {}) {
		const app = new App();
		const plugin = {
			settings: {
				playlists: { ...initialPlaylists },
			},
			saveSettings: vi.fn().mockResolvedValue(undefined),
		} as unknown as MusicPlayerPlugin;

		const service = new PlaylistService(app, plugin);
		return { service, app, plugin };
	}

	describe("createPlaylist", () => {
		it("should create a new playlist when user confirms with valid name", async () => {
			const { service, plugin } = createService();
			vi.spyOn(TextInputModal.prototype, "prompt").mockResolvedValue("Jazz Classics");

			const created = await service.createPlaylist();

			expect(created).toBe("Jazz Classics");
			expect(plugin.settings.playlists["Jazz Classics"]).toEqual([]);
			expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		});

		it("should return null if user cancels prompt", async () => {
			const { service } = createService();
			vi.spyOn(TextInputModal.prototype, "prompt").mockResolvedValue(null);

			expect(await service.createPlaylist()).toBeNull();
		});

		it("should return null if playlist name already exists", async () => {
			const { service } = createService({ Rock: [] });
			vi.spyOn(TextInputModal.prototype, "prompt").mockResolvedValue("Rock");

			expect(await service.createPlaylist()).toBeNull();
		});

		it("should return null if playlist name is empty whitespace", async () => {
			const { service } = createService();
			vi.spyOn(TextInputModal.prototype, "prompt").mockResolvedValue("   ");

			expect(await service.createPlaylist()).toBeNull();
		});
	});

	describe("editPlaylistName", () => {
		it("should rename playlist successfully", async () => {
			const { service, plugin } = createService({ OldRock: ["track1"] });
			vi.spyOn(TextInputModal.prototype, "prompt").mockResolvedValue("Classic Rock");

			const success = await service.editPlaylistName("OldRock");

			expect(success).toBe(true);
			expect(plugin.settings.playlists["Classic Rock"]).toEqual(["track1"]);
			expect(plugin.settings.playlists["OldRock"]).toBeUndefined();
			expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		});

		it("should fail if playlist to rename does not exist", async () => {
			const { service } = createService();
			expect(await service.editPlaylistName("NonExistent")).toBe(false);
		});

		it("should fail if new name is identical or already exists", async () => {
			const { service } = createService({ Rock: [], Pop: [] });
			vi.spyOn(TextInputModal.prototype, "prompt").mockResolvedValue("Rock");
			expect(await service.editPlaylistName("Rock")).toBe(false);

			vi.spyOn(TextInputModal.prototype, "prompt").mockResolvedValue("Pop");
			expect(await service.editPlaylistName("Rock")).toBe(false);
		});
	});

	describe("deletePlaylist", () => {
		it("should delete playlist when user confirms", async () => {
			const { service, plugin } = createService({ ToDelete: ["t1"] });
			vi.spyOn(ConfirmModal.prototype, "prompt").mockResolvedValue(true);

			const success = await service.deletePlaylist("ToDelete");

			expect(success).toBe(true);
			expect(plugin.settings.playlists["ToDelete"]).toBeUndefined();
			expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		});

		it("should not delete playlist when user cancels", async () => {
			const { service, plugin } = createService({ KeepMe: [] });
			vi.spyOn(ConfirmModal.prototype, "prompt").mockResolvedValue(false);

			const success = await service.deletePlaylist("KeepMe");

			expect(success).toBe(false);
			expect(plugin.settings.playlists["KeepMe"]).toBeDefined();
		});
	});

	describe("addToPlaylist", () => {
		it("should add track to existing playlist", async () => {
			const { service, plugin } = createService({ Favorites: ["t1"] });
			vi.spyOn(PlaylistPickerModal.prototype, "prompt").mockResolvedValue("Favorites");

			const success = await service.addToPlaylist("t2");

			expect(success).toBe(true);
			expect(plugin.settings.playlists["Favorites"]).toEqual(["t1", "t2"]);
			expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		});

		it("should not add duplicate track ID to playlist", async () => {
			const { service, plugin } = createService({ Favorites: ["t1"] });
			vi.spyOn(PlaylistPickerModal.prototype, "prompt").mockResolvedValue("Favorites");

			const success = await service.addToPlaylist("t1");

			expect(success).toBe(false);
			expect(plugin.settings.playlists["Favorites"]).toEqual(["t1"]);
		});

		it("should return false if modal prompt is cancelled", async () => {
			const { service } = createService({ Favorites: [] });
			vi.spyOn(PlaylistPickerModal.prototype, "prompt").mockResolvedValue(null);

			expect(await service.addToPlaylist("t1")).toBe(false);
		});
	});

	describe("removeFromPlaylist", () => {
		it("should remove track from playlist", async () => {
			const { service, plugin } = createService({ Hits: ["t1", "t2"] });

			const success = await service.removeFromPlaylist("t1", "Hits");

			expect(success).toBe(true);
			expect(plugin.settings.playlists["Hits"]).toEqual(["t2"]);
			expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
		});

		it("should return false when track is not in playlist", async () => {
			const { service } = createService({ Hits: ["t1"] });
			expect(await service.removeFromPlaylist("t99", "Hits")).toBe(false);
		});

		it("should return false when playlist does not exist", async () => {
			const { service } = createService();
			expect(await service.removeFromPlaylist("t1", "NonExistent")).toBe(false);
		});
	});
});
