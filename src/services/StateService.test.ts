import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { StateService } from "./StateService";

describe("StateService", () => {
	it("should initialize with default states and clamped volume/playbackRate", () => {
		const stateService = new StateService(1.5, -0.5);
		const state = stateService.getState();

		expect(state.volume).toBe(1.0); // clamped to max 1.0
		expect(state.playbackRate).toBe(0.25); // clamped to min 0.25
		expect(state.currentTrack).toBeNull();
		expect(state.currentIndex).toBe(-1);
		expect(state.isPlaying).toBe(false);
		expect(state.playMode).toBe("normal");
		expect(state.trackList).toEqual([]);
		expect(state.favorites).toEqual([]);
		expect(state.currentListId).toBe("all");
	});

	it("should return a shallow copy to preserve immutability", () => {
		const stateService = new StateService();
		const copy1 = stateService.getState();
		copy1.volume = 0.2;

		const copy2 = stateService.getState();
		expect(copy2.volume).toBe(1.0);
	});

	it("should update playback attributes correctly", () => {
		const stateService = new StateService();
		const track = new TFile("song.mp3");

		stateService.setCurrentTrack(track, 2);
		stateService.setIsPlaying(true);
		stateService.setPlayMode("repeat-all");
		stateService.setVolume(0.75);
		stateService.setPlaybackRate(1.25);

		const state = stateService.getState();
		expect(state.currentTrack).toBe(track);
		expect(state.currentIndex).toBe(2);
		expect(state.isPlaying).toBe(true);
		expect(state.playMode).toBe("repeat-all");
		expect(state.volume).toBe(0.75);
		expect(state.playbackRate).toBe(1.25);
	});

	it("should update track lists and active playlist context", () => {
		const stateService = new StateService();
		const tracks = [new TFile("a.mp3"), new TFile("b.mp3")];
		const favorites = [tracks[0]!];

		stateService.setTrackList(tracks);
		stateService.setFavorites(favorites);
		stateService.setPlaylistMap({ Rock: ["a.mp3"] });
		stateService.setCurrentList({ type: "playlist", name: "Rock", tracks });
		stateService.setCurrentListId("playlist:Rock");
		stateService.setCurrentSectionIdForPlaylist("playlist:Rock");

		const state = stateService.getState();
		expect(state.trackList).toEqual(tracks);
		expect(state.favorites).toEqual(favorites);
		expect(state.playlistMap).toEqual({ Rock: ["a.mp3"] });
		expect(state.currentList?.name).toBe("Rock");
		expect(state.currentListId).toBe("playlist:Rock");
		expect(state.currentSectionIdForPlaylist).toBe("playlist:Rock");
	});

	it("should update transition cover URLs", () => {
		const stateService = new StateService();
		stateService.setPendingNextCoverUrl("app://obsidian.md/next.jpg");
		stateService.setPendingPrevCoverUrl("app://obsidian.md/prev.jpg");

		expect(stateService.getState().pendingNextCoverUrl).toBe("app://obsidian.md/next.jpg");
		expect(stateService.getState().pendingPrevCoverUrl).toBe("app://obsidian.md/prev.jpg");
	});

	it("should update and reset lyrics state", () => {
		const stateService = new StateService();
		const lyrics = [{ time: 10, text: "Line 1" }];
		const extLyrics = [{ lineTimeStamps: 10, chars: [{ char: "A", time: 10 }] }];

		stateService.setLyrics(lyrics, extLyrics);

		expect(stateService.getState().currentLyrics).toEqual(lyrics);
		expect(stateService.getState().currentExtendedLyrics).toEqual(extLyrics);

		stateService.resetLyrics();
		expect(stateService.getState().currentLyrics).toEqual([]);
		expect(stateService.getState().currentExtendedLyrics).toEqual([]);
	});
});
