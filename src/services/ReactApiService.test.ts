import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { ReactApiService } from "./ReactApiService";
import { StateService } from "./StateService";
import { AudioService } from "./AudioService";
import type { ListService, PlaybackService, FavoriteService, PlaylistService } from "./index";
import type MusicPlayerPlugin from "@/main";
import { MetadataEditorModal } from "@/components/modal/MetadataEditorModal";
import { SmartPlaylistModal } from "@/components/modal/SmartPlaylistModal";

vi.mock("@/components/modal/MetadataEditorModal", () => {
	const MockModal = vi.fn().mockImplementation(function (_app, _plugin, _path, options) {
		return {
			open: vi.fn(),
			options,
		};
	});
	return { MetadataEditorModal: MockModal };
});

vi.mock("@/components/modal/SmartPlaylistModal", () => {
	const MockModal = vi.fn().mockImplementation(function (_app, _plugin, options) {
		return {
			open: vi.fn(),
			options,
		};
	});
	return { SmartPlaylistModal: MockModal };
});

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
			toggleShuffle: vi.fn().mockResolvedValue(true),
			toggleArtworkDisplayMode: vi.fn().mockResolvedValue("card"),
			setTrackRating: vi.fn().mockResolvedValue(undefined),
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

	it("should delegate toggleShuffle, toggleArtworkDisplayMode, and setRating to playbackService", async () => {
		const { service, playbackService } = createService();
		const api = service.getApi();

		const shuffleRes = await api.toggleShuffle();
		expect(shuffleRes).toBe(true);
		expect(playbackService.toggleShuffle).toHaveBeenCalled();

		const artRes = await api.toggleArtworkDisplayMode();
		expect(artRes).toBe("card");
		expect(playbackService.toggleArtworkDisplayMode).toHaveBeenCalled();

		await api.setRating("song1.mp3", 4);
		expect(playbackService.setTrackRating).toHaveBeenCalledWith("song1.mp3", 4);
	});

	it("should open metadata editor modal and trigger smart playlist actions", async () => {
		const { service, playlistService, callbacks, plugin } = createService();
		const mockDeleteSmartPlaylist = vi.fn().mockResolvedValue(true);
		(playlistService as unknown as { deleteSmartPlaylist: typeof mockDeleteSmartPlaylist }).deleteSmartPlaylist = mockDeleteSmartPlaylist;
		plugin.settings.smartPlaylists = {
			"sp1": { id: "sp1", name: "Smart 1", matchType: "all", rules: [] },
		};

		const api = service.getApi();

		// openMetadataEditor and invoke onSave
		api.openMetadataEditor("song1.mp3");
		const metaCalls = (MetadataEditorModal as unknown as { mock: { results: Array<{ value: { open: () => void; options: { onSave?: () => Promise<void> } } }> } }).mock.results;
		const metaModalInstance = metaCalls[metaCalls.length - 1]?.value;
		expect(metaModalInstance?.open).toBeDefined();
		await metaModalInstance?.options.onSave?.();
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(1);

		// createSmartPlaylist and invoke onSave
		await api.createSmartPlaylist();
		const smartCalls = (SmartPlaylistModal as unknown as { mock: { results: Array<{ value: { open: () => void; options: { onSave?: () => Promise<void> } } }> } }).mock.results;
		const createSmartInstance = smartCalls[smartCalls.length - 1]?.value;
		expect(createSmartInstance?.open).toBeDefined();
		await createSmartInstance?.options.onSave?.();
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(2);

		// editSmartPlaylist and invoke onSave
		await api.editSmartPlaylist("sp1");
		const editSmartInstance = smartCalls[smartCalls.length - 1]?.value;
		await editSmartInstance?.options.onSave?.();
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(3);

		// editSmartPlaylist with nonexistent id should return early
		const countBefore = smartCalls.length;
		await api.editSmartPlaylist("nonexistent-id");
		expect(smartCalls.length).toBe(countBefore);

		// deleteSmartPlaylist returning false
		mockDeleteSmartPlaylist.mockResolvedValueOnce(false);
		await api.deleteSmartPlaylist("sp1");
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(3);

		// deleteSmartPlaylist returning true
		mockDeleteSmartPlaylist.mockResolvedValueOnce(true);
		await api.deleteSmartPlaylist("sp1");
		expect(mockDeleteSmartPlaylist).toHaveBeenCalledWith("sp1");
		expect(callbacks.onLibraryUpdated).toHaveBeenCalledTimes(4);
	});

	it("should return fallback volume and playbackRate when audio element is absent or has default values", () => {
		const { service, stateService, audioService } = createService();
		const api = service.getApi();

		// When audio element has values
		const mockAudioEl = { volume: 0.75, playbackRate: 1.25 } as unknown as HTMLAudioElement;
		vi.spyOn(audioService, "getAudioElement").mockReturnValue(mockAudioEl);
		expect(api.getVolume()).toBe(0.75);
		expect(api.getPlaybackRate()).toBe(1.25);

		// When audio element is null, fallback to stateService or 1.0
		vi.spyOn(audioService, "getAudioElement").mockReturnValue(null);
		stateService.setVolume(0.6);
		stateService.setPlaybackRate(1.5);
		expect(api.getVolume()).toBe(0.6);
		expect(api.getPlaybackRate()).toBe(1.5);

		// When stateService properties are null / undefined
		vi.spyOn(stateService, "getState").mockReturnValue({} as any);
		expect(api.getVolume()).toBe(1.0);
		expect(api.getPlaybackRate()).toBe(1.0);
	});
});

