// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import MusicPlayerPlugin from "@/main";
import { StateService } from "@/services/StateService";
import { AudioService } from "@/services/AudioService";
import { LyricsService } from "@/services/LyricsService";
import { ListService } from "@/services/ListService";
import { SnapshotService } from "@/services/SnapshotService";
import { PlaybackService } from "@/services/PlaybackService";
import { installMockAudio, MockAudioElement } from "../mocks/audio";

describe("E2E 3: Complete Playback Flow & Mode Transitions", () => {
	let app: App;
	let plugin: MusicPlayerPlugin;
	let stateService: StateService;
	let audioService: AudioService;
	let lyricsService: LyricsService;
	let listService: ListService;
	let snapshotService: SnapshotService;
	let playbackService: PlaybackService;
	let uninstallAudio: () => void;
	let mockTracks: TFile[];

	beforeEach(async () => {
		uninstallAudio = installMockAudio();
		app = new App();
		plugin = new MusicPlayerPlugin(app, { id: "test", version: "1.0.0" });
		await plugin.onload();

		mockTracks = [
			app.vault.createFile("track1.mp3", new ArrayBuffer(10)),
			app.vault.createFile("track2.mp3", new ArrayBuffer(10)),
			app.vault.createFile("track3.mp3", new ArrayBuffer(10)),
		];

		plugin.settings.trackIndex = {
			"t-1": "track1.mp3",
			"t-2": "track2.mp3",
			"t-3": "track3.mp3",
		};
		plugin.settings.tracks = {
			"t-1": { id: "t-1", path: "track1.mp3", title: "Song 1", lyrics: "[00:10.00]First lyric\n[00:20.00]Second lyric", duration: 100 },
			"t-2": { id: "t-2", path: "track2.mp3", title: "Song 2", lyrics: "", duration: 150 },
			"t-3": { id: "t-3", path: "track3.mp3", title: "Song 3", lyrics: "", duration: 200 },
		};

		stateService = new StateService(1.0, 1.0);
		stateService.setTrackList(mockTracks);

		audioService = new AudioService(app);
		lyricsService = new LyricsService(plugin);

		listService = {
			getCurrentPlaylistForTrack: vi.fn().mockReturnValue({ list: mockTracks }),
			setCurrentListContext: vi.fn().mockReturnValue({ list: null, listId: "all" }),
			calculateCurrentListId: vi.fn().mockReturnValue("all"),
			formatCurrentList: vi.fn().mockReturnValue("all"),
		} as unknown as ListService;

		snapshotService = new SnapshotService(app, plugin, listService, {} as any);

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

	it("should execute full user journey from start, timeupdate, lyrics sync, pause/resume, and track end", async () => {
		// 1. User starts track 1
		await playbackService.playTrack(0);
		expect(stateService.getState().currentIndex).toBe(0);
		expect(stateService.getState().isPlaying).toBe(true);

		const audioEl = audioService.getAudioElement() as unknown as MockAudioElement;
		expect(audioEl).toBeDefined();

		// 2. Audio progresses to 15s -> verify snapshot shows synchronized lyric
		audioEl.currentTime = 15;
		const snapshotAt15 = snapshotService.getPlaybackSnapshot({
			...stateService.getState(),
			audioElement: audioEl as any,
		});
		expect(snapshotAt15.currentLyric).toBe("First lyric");
		expect(snapshotAt15.nextLyric).toBe("Second lyric");

		// 3. User pauses and resumes
		await playbackService.togglePlay();
		expect(stateService.getState().isPlaying).toBe(false);
		expect(audioEl.paused).toBe(true);

		await playbackService.togglePlay();
		expect(stateService.getState().isPlaying).toBe(true);
		expect(audioEl.paused).toBe(false);

		// 4. Track ends in normal mode -> transitions to track 2
		playbackService.handleTrackEnd();
		await new Promise((r) => setTimeout(r, 60));
		expect(stateService.getState().currentIndex).toBe(1);

		// 5. User changes mode to repeat-one -> track ends -> repeats track 2
		stateService.setPlayMode("repeat-one");
		playbackService.handleTrackEnd();
		await new Promise((r) => setTimeout(r, 60));
		expect(stateService.getState().currentIndex).toBe(1);

		// 6. User changes mode to repeat-all -> advance to last track
		stateService.setPlayMode("repeat-all");
		await playbackService.playTrack(2);
		expect(stateService.getState().currentIndex).toBe(2);

		// End of playlist wraps back to track 1 (index 0) after debounce interval
		await new Promise((r) => setTimeout(r, 500));
		playbackService.handleTrackEnd();
		await new Promise((r) => setTimeout(r, 60));
		expect(stateService.getState().currentIndex).toBe(0);
	});
});
