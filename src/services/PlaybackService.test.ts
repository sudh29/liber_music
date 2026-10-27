// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { PlaybackService } from "./PlaybackService";
import { StateService } from "./StateService";
import { AudioService } from "./AudioService";
import { LyricsService } from "./LyricsService";
import { ListService } from "./ListService";
import { SnapshotService } from "./SnapshotService";
import type MusicPlayerPlugin from "@/main";
import { installMockAudio } from "../../tests/mocks/audio";

describe("PlaybackService", () => {
	let app: App;
	let plugin: MusicPlayerPlugin;
	let stateService: StateService;
	let audioService: AudioService;
	let lyricsService: LyricsService;
	let listService: ListService;
	let snapshotService: SnapshotService;
	let playbackService: PlaybackService;
	let uninstallAudio: () => void;
	let mockFiles: TFile[];

	beforeEach(() => {
		uninstallAudio = installMockAudio();
		app = new App();

		mockFiles = [
			app.vault.createFile("track1.mp3", new ArrayBuffer(50)),
			app.vault.createFile("track2.mp3", new ArrayBuffer(50)),
			app.vault.createFile("track3.mp3", new ArrayBuffer(50)),
		];

		plugin = {
			app,
			settings: {
				trackIndex: {
					"track1.mp3": "track1.mp3",
					"track2.mp3": "track2.mp3",
					"track3.mp3": "track3.mp3",
				},
				tracks: {
					"track1.mp3": { id: "track1.mp3", path: "track1.mp3", title: "Song 1", lyrics: "[00:01.00]Hi", duration: 100 },
					"track2.mp3": { id: "track2.mp3", path: "track2.mp3", title: "Song 2", lyrics: "", duration: 120 },
					"track3.mp3": { id: "track3.mp3", path: "track3.mp3", title: "Song 3", lyrics: "", duration: 150 },
				},
				favorites: [],
				playlists: {},
				artists: {},
				albums: {},
				musicFolder: "",
				volume: 1.0,
				playbackRate: 1.0,
				playMode: "normal",
				autoPlayOpenTrackPath: "track2.mp3",
			},
			saveSettings: vi.fn().mockResolvedValue(undefined),
		} as unknown as MusicPlayerPlugin;

		(globalThis as any).URL.createObjectURL = vi.fn().mockReturnValue("blob:uuid");
		(globalThis as any).URL.revokeObjectURL = vi.fn();

		stateService = new StateService(1.0, 1.0);
		stateService.setTrackList(mockFiles);

		audioService = new AudioService(app);
		lyricsService = new LyricsService(plugin);

		listService = {
			getCurrentPlaylistForTrack: vi.fn().mockReturnValue({ list: mockFiles }),
			setCurrentListContext: vi.fn().mockReturnValue({ list: null, listId: "all" }),
			calculateCurrentListId: vi.fn().mockReturnValue("all"),
			formatCurrentList: vi.fn().mockReturnValue("all"),
		} as unknown as ListService;

		snapshotService = {
			getTrackCoverAsync: vi.fn().mockResolvedValue(undefined),
		} as unknown as SnapshotService;

		playbackService = new PlaybackService(
			plugin,
			stateService,
			audioService,
			lyricsService,
			listService,
			snapshotService
		);
	});

	afterEach(() => {
		uninstallAudio();
		vi.restoreAllMocks();
	});

	it("should play track by index and update state and audio element", async () => {
		await playbackService.playTrack(0);

		const state = stateService.getState();
		expect(state.currentTrack).toBe(mockFiles[0]);
		expect(state.currentIndex).toBe(0);
		expect(state.isPlaying).toBe(true);
		expect(audioService.getAudioElement()?.paused).toBe(false);
	});

	it("should play track by path", async () => {
		await playbackService.playByPath("track2.mp3");

		const state = stateService.getState();
		expect(state.currentTrack?.path).toBe("track2.mp3");
		expect(state.currentIndex).toBe(1);
		expect(state.isPlaying).toBe(true);
	});

	it("should toggle play and pause states", async () => {
		await playbackService.playTrack(0);
		expect(stateService.getState().isPlaying).toBe(true);

		await playbackService.togglePlay();
		expect(stateService.getState().isPlaying).toBe(false);

		await playbackService.togglePlay();
		expect(stateService.getState().isPlaying).toBe(true);
	});

	it("should navigate to next and previous tracks", async () => {
		await playbackService.playTrack(0);

		await playbackService.playNext();
		expect(stateService.getState().currentIndex).toBe(1);

		await playbackService.playNext();
		expect(stateService.getState().currentIndex).toBe(2);

		await playbackService.playPrevious();
		expect(stateService.getState().currentIndex).toBe(1);
	});

	it("should handle track end according to playback mode", async () => {
		await playbackService.playTrack(0);

		// Manually advance via handleTrackEnd
		playbackService.handleTrackEnd();
		await new Promise((r) => setTimeout(r, 60));
		expect(stateService.getState().currentIndex).toBe(1);

		// Repeat-one mode: track ends -> repeats current track
		stateService.setPlayMode("repeat-one");
		playbackService.handleTrackEnd();
		await new Promise((r) => setTimeout(r, 60));
		expect(stateService.getState().currentIndex).toBe(1);
	});

	it("should deduplicate rapid handleTrackEnd calls (debounce within 450ms)", async () => {
		await playbackService.playTrack(0);

		// Synchronous double calls
		playbackService.handleTrackEnd();
		playbackService.handleTrackEnd();

		await new Promise((r) => setTimeout(r, 60));
		// Only advanced once to index 1
		expect(stateService.getState().currentIndex).toBe(1);
	});

	it("should abort stale playback requests if user rapidly switches tracks (race condition guard)", async () => {
		const p1 = playbackService.playTrack(0);
		const p2 = playbackService.playTrack(2);

		await Promise.all([p1, p2]);

		// The latest request (index 2) must prevail
		expect(stateService.getState().currentIndex).toBe(2);
		expect(stateService.getState().currentTrack).toBe(mockFiles[2]);
	});

	it("should restore last played track on startup without autoplaying when autoPlay is false", async () => {
		plugin.settings.autoPlayOpenTrackPath = "track2.mp3";

		await playbackService.restoreLastPlayedTrack(false);

		const state = stateService.getState();
		expect(state.currentTrack?.path).toBe("track2.mp3");
		expect(state.currentIndex).toBe(1);
		expect(state.isPlaying).toBe(false); // restored in paused state
	});

	it("should stop playback at the end of playlist in normal mode", async () => {
		stateService.setPlayMode("normal");
		// Play last track in list
		await playbackService.playTrack(2);
		expect(stateService.getState().isPlaying).toBe(true);

		await new Promise((r) => setTimeout(r, 500)); // wait past 450ms debounce
		playbackService.handleTrackEnd();

		expect(stateService.getState().isPlaying).toBe(false);
	});

	it("should do nothing in restoreLastPlayedTrack if trackList is empty", async () => {
		stateService.setTrackList([]);
		await playbackService.restoreLastPlayedTrack(true);
		expect(stateService.getState().currentTrack).toBeNull();
	});

	it("should handle AbortError gracefully during repeat play", async () => {
		await playbackService.playTrack(0);
		stateService.setPlayMode("repeat-one");

		const abortError = new DOMException("Interrupted", "AbortError");
		vi.spyOn(audioService, "play").mockRejectedValue(abortError);

		await new Promise((r) => setTimeout(r, 500));
		expect(() => playbackService.handleTrackEnd()).not.toThrow();
	});

	it("should toggle shuffle and artwork display mode correctly", async () => {
		const res1 = await playbackService.toggleShuffle();
		expect(res1).toBe(true);
		expect(plugin.settings.isShuffle).toBe(true);
		expect(plugin.saveSettings).toHaveBeenCalled();

		const res2 = await playbackService.toggleShuffle();
		expect(res2).toBe(false);
		expect(plugin.settings.isShuffle).toBe(false);

		const artMode1 = await playbackService.toggleArtworkDisplayMode();
		expect(artMode1).toBe("card");
		expect(plugin.settings.artworkDisplayMode).toBe("card");

		const artMode2 = await playbackService.toggleArtworkDisplayMode();
		expect(artMode2).toBe("vinyl");
		expect(plugin.settings.artworkDisplayMode).toBe("vinyl");
	});

	it("should set and persist track ratings", async () => {
		await playbackService.setTrackRating("song1.mp3", 4);
		expect(plugin.settings.ratings?.["song1.mp3"]).toBe(4);
		expect(plugin.saveSettings).toHaveBeenCalled();

		// Clear rating when 0
		await playbackService.setTrackRating("song1.mp3", 0);
		expect(plugin.settings.ratings?.["song1.mp3"]).toBeUndefined();
	});

	it("should seek audio to specific time in seconds and update mediaSession position", async () => {
		const mockMediaSession = {
			updatePositionState: vi.fn(),
			updateMetadata: vi.fn(),
			updatePlaybackState: vi.fn(),
		} as any;
		const serviceWithMedia = new PlaybackService(
			plugin,
			stateService,
			audioService,
			lyricsService,
			listService,
			snapshotService,
			{},
			mockMediaSession
		);

		// 1. Safe when no audio element
		serviceWithMedia.seekToTime(50);
		expect(mockMediaSession.updatePositionState).not.toHaveBeenCalled();

		// 2. Plays track and seeks
		await serviceWithMedia.playTrack(0);
		const audioEl = audioService.getAudioElement() as any;
		audioEl.duration = 200;

		serviceWithMedia.seekToTime(75);
		expect(audioEl.currentTime).toBe(75);
		expect(mockMediaSession.updatePositionState).toHaveBeenCalledWith(200, 75, audioEl.playbackRate);

		// 3. Clamping beyond duration
		serviceWithMedia.seekToTime(300);
		expect(audioEl.currentTime).toBe(200);
	});

	it("should play a category collection of tracks", async () => {
		const categoryTracks = [mockFiles[1]!, mockFiles[2]!];
		await playbackService.playCategory("artist", "Artist 1", categoryTracks);

		const state = stateService.getState();
		expect(state.currentList.type).toBe("artist");
		expect(state.currentList.name).toBe("Artist 1");
		expect(state.currentTrack).toBe(mockFiles[1]);
		expect(state.isPlaying).toBe(true);
	});

	it("should handle audio errors and alert on iPadOS/iOS OGG playback", async () => {
		const oggFile = app.vault.createFile("track.ogg", new ArrayBuffer(50));
		stateService.setTrackList([oggFile, ...mockFiles]);

		// Simulate iOS platform
		const { Platform } = await import("obsidian");
		const originalIos = Platform.isIosApp;
		(Platform as any).isIosApp = true;

		try {
			await playbackService.playTrack(0);

			// Trigger error on audio element
			const audioEl = audioService.getAudioElement()!;
			audioEl.dispatchEvent(new Event("error"));

			expect(stateService.getState().isPlaying).toBe(false);
		} finally {
			(Platform as any).isIosApp = originalIos;
		}
	});

	it("should integrate with MediaSession and WakeLock during play and pause", async () => {
		const mockMediaSession = {
			updateMetadata: vi.fn(),
			updatePlaybackState: vi.fn(),
			updatePositionState: vi.fn(),
		} as any;
		const mockWakeLock = {
			onPlaybackStateChange: vi.fn(),
		} as any;

		const service = new PlaybackService(
			plugin,
			stateService,
			audioService,
			lyricsService,
			listService,
			snapshotService,
			{},
			mockMediaSession,
			mockWakeLock
		);

		await service.playTrack(0);
		expect(mockMediaSession.updatePlaybackState).toHaveBeenCalledWith(true);
		expect(mockWakeLock.onPlaybackStateChange).toHaveBeenCalledWith(true);

		await service.togglePlay();
		expect(mockMediaSession.updatePlaybackState).toHaveBeenCalledWith(false);
		expect(mockWakeLock.onPlaybackStateChange).toHaveBeenCalledWith(false);
	});

	it("should update track rating on existing track and invoke onLibraryUpdated callback", async () => {
		const onLibraryUpdated = vi.fn().mockResolvedValue(undefined);
		const service = new PlaybackService(
			plugin,
			stateService,
			audioService,
			lyricsService,
			listService,
			snapshotService,
			{ onLibraryUpdated }
		);

		await service.setTrackRating("track1.mp3", 5);
		expect(plugin.settings.tracks["track1.mp3"].rating).toBe(5);
		expect(onLibraryUpdated).toHaveBeenCalled();
	});

	it("should handle standard audio playback error on non-iOS platform and advance to next track", async () => {
		await playbackService.playTrack(0);

		const audioEl = audioService.getAudioElement()!;
		audioEl.dispatchEvent(new Event("error"));

		expect(stateService.getState().isPlaying).toBe(false);

		// Wait for the 800ms auto-advance timeout
		await new Promise((r) => setTimeout(r, 850));
		expect(stateService.getState().currentIndex).toBe(1);
	});

	it("should support delayPlay with direction prev and next", async () => {
		await playbackService.playTrack(1, true, undefined, "next", false, true);
		expect(stateService.getState().currentIndex).toBe(1);

		await playbackService.playTrack(0, true, undefined, "prev", false, false);
		expect(stateService.getState().currentIndex).toBe(0);
	});
});

