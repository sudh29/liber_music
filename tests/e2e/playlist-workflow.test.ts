// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import MusicPlayerPlugin from "@/main";
import { PlaylistService } from "@/services/PlaylistService";
import { ListService } from "@/services/ListService";
import { StateService } from "@/services/StateService";
import { ConfirmModal, PlaylistPickerModal, TextInputModal } from "@/components";

describe("E2E 4: Custom Playlist CRUD & Queue Switching Workflow", () => {
	it("should manage full playlist lifecycle: creation, adding tracks, playing within queue, and deletion", async () => {
		const app = new App();
		const plugin = new MusicPlayerPlugin(app, { id: "test", version: "1.0.0" });
		await plugin.onload();

		const track1 = app.vault.createFile("music/song1.mp3");
		const track2 = app.vault.createFile("music/song2.mp3");
		const track3 = app.vault.createFile("music/song3.mp3");
		const allTracks = [track1, track2, track3];

		const playlistService = new PlaylistService(app, plugin);
		const listService = new ListService({} as any, playlistService, plugin);
		const stateService = new StateService();
		stateService.setTrackList(allTracks);

		// 1. Create playlist "Morning Vibes" via TextInputModal
		vi.spyOn(TextInputModal.prototype, "prompt").mockResolvedValue("Morning Vibes");
		const createdName = await playlistService.createPlaylist();
		expect(createdName).toBe("Morning Vibes");
		expect(plugin.settings.playlists["Morning Vibes"]).toEqual([]);

		// 2. Add song1 and song2 to "Morning Vibes" via PlaylistPickerModal
		vi.spyOn(PlaylistPickerModal.prototype, "prompt").mockResolvedValue("Morning Vibes");
		await playlistService.addToPlaylist("music/song1.mp3");
		await playlistService.addToPlaylist("music/song2.mp3");

		expect(plugin.settings.playlists["Morning Vibes"]).toEqual([
			"music/song1.mp3",
			"music/song2.mp3",
		]);

		// 3. User selects "Morning Vibes" as active playlist
		const queueContext = listService.setCurrentListFromSectionId(
			"playlist-Morning Vibes",
			allTracks,
			[]
		);
		expect(queueContext).toBeDefined();
		expect(queueContext?.type).toBe("playlist");
		expect(queueContext?.tracks).toHaveLength(2);
		expect(queueContext?.tracks.map((t) => t.path)).toEqual([
			"music/song1.mp3",
			"music/song2.mp3",
		]);

		stateService.setCurrentList(queueContext);
		expect(stateService.getState().currentList?.name).toBe("Morning Vibes");

		// 4. Remove song1 from playlist
		await playlistService.removeFromPlaylist("music/song1.mp3", "Morning Vibes");
		expect(plugin.settings.playlists["Morning Vibes"]).toEqual(["music/song2.mp3"]);

		// 5. Delete playlist with ConfirmModal
		vi.spyOn(ConfirmModal.prototype, "prompt").mockResolvedValue(true);
		const deleted = await playlistService.deletePlaylist("Morning Vibes");
		expect(deleted).toBe(true);
		expect(plugin.settings.playlists["Morning Vibes"]).toBeUndefined();

		vi.restoreAllMocks();
	});
});
