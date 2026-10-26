import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { ReactApiService } from "./ReactApiService";
import { StateService } from "./StateService";
import { AudioService } from "./AudioService";
import type { ListService, PlaybackService, FavoriteService, PlaylistService } from "./index";
import type MusicPlayerPlugin from "@/main";

describe("ReactApiService", () => {
	function createService() {
		const app = new App();
		const plugin = {
			settings: {
				volume: 1.0,
				playbackRate: 1.0,
				trackIndex: { "id-1": "song1.mp3" },
				tracks: {},
				favorites: ["id-1"],
				playlists: {},
			},
			saveData: vi.fn().mockResolvedValue(undefined),
		} as unknown as MusicPlayerPlugin;

		const stateService = new StateService();
		stateService.setTrackList([new TFile("song1.mp3")]);

		const listService = {
			setCurrentListContext: vi.fn().mockReturnValue({
				list: { type: "all", name: "All", tracks: [] },
				listId: "all-list",
			}),
		} as unknown as ListService;

		const playbackService = {
			playByPath: vi.fn().mockResolvedValue(undefined),
			playCategory: vi.fn().mockResolvedValue(undefined),
		} as unknown as PlaybackService;

		const audioService = new AudioService(app);

		const favoriteService = {
			toggleFavorite: vi.fn().mockResolvedValue(true),
		} as unknown as FavoriteService;

		const playlistService = {
			getPlaylistMap: vi.fn().mockReturnValue({ "My Playlist": ["id-1"] }),
			addToPlaylist: vi.fn().mockResolvedValue(true),
			removeFromPlaylist: vi.fn().mockResolvedValue(true),
			createPlaylist: vi.fn().mockResolvedValue("New Playlist"),
			editPlaylistName: vi.fn().mockResolvedValue(true),
			deletePlaylist: vi.fn().mockResolvedValue(true),
		} as unknown as PlaylistService;

		const callbacks = {
			onLibraryUpdated: vi.fn().mockResolvedValue(undefined),
			onDirectPlay: vi.fn(),
		};

		const service = new ReactApiService(
			plugin,
			stateService,
			listService,
			playbackService,
			audioService,
			favoriteService,
			playlistService,
			callbacks
		);

		return {
			service,
			plugin,
			stateService,
			listService,
			playbackService,
			audioService,
			favoriteService,
			playlistService,
			callbacks,
		};
	}

	it("should delegate playByPath and update section context if sectionId provided", async () => {
		const { service, playbackService, listService, callbacks, stateService } = createService();
		const api = service.getApi();

		await api.playByPath("song1.mp3", "playlist:MyList");

		expect(callbacks.onDirectPlay).toHaveBeenCalledTimes(1);
		expect(listService.setCurrentListContext).toHaveBeenCalledWith(
			"playlist:MyList",
			null,
			expect.any(Array),
			expect.any(Array)
		);
		expect(stateService.getState().currentListId).toBe("all-list");
		expect(playbackService.playByPath).toHaveBeenCalledWith("song1.mp3", false, true);
	});

	it("should delegate playCategory and convert ReactTrackInfo to TFile objects", async () => {
		const { service, playbackService } = createService();
		const api = service.getApi();

		await api.playCategory("album", "Opera", [{ path: "song1.mp3", title: "Song 1" }]);

		expect(playbackService.playCategory).toHaveBeenCalledWith(
			"album",
			"Opera",
			expect.arrayContaining([expect.objectContaining({ path: "song1.mp3" })])
		);
	});

	it("should set and persist volume and playback rate with boundary clamping", async () => {
		const { service, plugin, stateService } = createService();
		const api = service.getApi();

		// Clamping tests
		await api.setVolume(1.5);
		expect(plugin.settings.volume).toBe(1.0);
		expect(stateService.getState().volume).toBe(1.0);
		expect(api.getVolume()).toBe(1.0);

		await api.setVolume(-0.2);
		expect(plugin.settings.volume).toBe(0);
		expect(api.getVolume()).toBe(0);

		await api.setPlaybackRate(5.0);
		expect(plugin.settings.playbackRate).toBe(4.0);
		expect(api.getPlaybackRate()).toBe(4.0);

		await api.setPlaybackRate(0.1);
		expect(plugin.settings.playbackRate).toBe(0.25);
		expect(api.getPlaybackRate()).toBe(0.25);
	});

	it("should delegate playlist operations and trigger onLibraryUpdated", async () => {
		const { service, playlistService, callbacks } = createService();
		const api = service.getApi();

		await api.createPlaylist();
		expect(playlistService.createPlaylist).toHaveBeenCalledTimes(1);
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(1);

		await api.addToPlaylist("song1.mp3", "playlist:Rock");
		expect(playlistService.addToPlaylist).toHaveBeenCalledWith("id-1");
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(2);

		await api.removeFromPlaylist("song1.mp3", "Rock");
		expect(playlistService.removeFromPlaylist).toHaveBeenCalledWith("id-1", "Rock");
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(3);

		await api.editPlaylistName("OldName");
		expect(playlistService.editPlaylistName).toHaveBeenCalledWith("OldName");
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(4);

		await api.deletePlaylist("Old");
		expect(playlistService.deletePlaylist).toHaveBeenCalledWith("Old");
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(5);
	});

	it("should delegate favorite operations and trigger onLibraryUpdated", async () => {
		const { service, favoriteService, callbacks } = createService();
		const api = service.getApi();

		await api.toggleFavorite("song1.mp3", "all");
		expect(favoriteService.toggleFavorite).toHaveBeenCalledWith("id-1");
		expect(callbacks.onLibraryUpdated).toHaveBeenCalled();
	});

	it("should do nothing in toggleFavorite or addToPlaylist if path not found in trackList", async () => {
		const { service, favoriteService, playlistService } = createService();
		const api = service.getApi();

		await api.toggleFavorite("nonexistent.mp3");
		expect(favoriteService.toggleFavorite).not.toHaveBeenCalled();

		await api.addToPlaylist("nonexistent.mp3");
		expect(playlistService.addToPlaylist).not.toHaveBeenCalled();
	});
});
