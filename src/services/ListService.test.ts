import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { ListService } from "./ListService";
import type { LibraryService, PlaylistService } from "./index";
import type { MusicPlayerSettings } from "@/types";

describe("ListService", () => {
	function createService(settingsOverrides: Partial<MusicPlayerSettings> = {}) {
		const settings: MusicPlayerSettings = {
			tracks: {},
			trackIndex: {},
			favorites: [],
			playlists: {},
			artists: {},
			albums: {},
			musicFolder: "",
			volume: 1,
			playbackRate: 1,
			playMode: "normal",
			...settingsOverrides,
		};

		const libraryService = {
			getArtists: vi.fn().mockReturnValue([
				{ name: "Queen", tracks: [new TFile("queen1.mp3")] },
			]),
			getAlbums: vi.fn().mockReturnValue([
				{ name: "Opera", tracks: [new TFile("opera1.mp3")] },
			]),
		} as unknown as LibraryService;

		const playlistService = {
			getPlaylistMap: vi.fn().mockReturnValue({
				Rock: ["rock1.mp3", "rock2.mp3"],
			}),
		} as unknown as PlaylistService;

		const plugin = { settings };

		const listService = new ListService(libraryService, playlistService, plugin);

		return { listService, libraryService, playlistService, settings };
	}

	describe("getCurrentPlaylistForTrack & calculateCurrentListId", () => {
		it("should return explicit currentList when provided", () => {
			const { listService } = createService();
			const explicitTracks = [new TFile("a.mp3"), new TFile("b.mp3")];
			const currentList = { type: "playlist", name: "Custom", tracks: explicitTracks };

			const result = listService.getCurrentPlaylistForTrack(
				explicitTracks[0]!,
				currentList,
				[],
				[]
			);
			expect(result.list).toEqual(explicitTracks);

			const listId = listService.calculateCurrentListId(explicitTracks[0]!, currentList, [], []);
			expect(listId).toBe("playlist:Custom");
		});

		it("should fall back to all tracks when currentTrack is null", () => {
			const { listService } = createService();
			const globalTracks = [new TFile("song.mp3")];

			const result = listService.getCurrentPlaylistForTrack(null, null, globalTracks, []);
			expect(result.list).toEqual(globalTracks);

			const listId = listService.calculateCurrentListId(null, null, globalTracks, []);
			expect(listId).toBe("all");
		});

		it("should infer custom playlist if track belongs to one", () => {
			const { listService } = createService({
				playlists: {
					Rock: ["rock1.mp3", "rock2.mp3"],
				},
			});

			const trackList = [
				new TFile("rock1.mp3"),
				new TFile("rock2.mp3"),
				new TFile("pop.mp3"),
			];
			const currentTrack = trackList[0]!;

			const result = listService.getCurrentPlaylistForTrack(currentTrack, null, trackList, []);
			expect(result.list.map((t) => t.path)).toEqual(["rock1.mp3", "rock2.mp3"]);

			const listId = listService.calculateCurrentListId(currentTrack, null, trackList, []);
			expect(listId).toBe("playlist:Rock");
		});

		it("should infer favorites list if track is in favorites", () => {
			const { listService } = createService({
				trackIndex: { "fav-1": "music/fav.mp3" },
				favorites: ["fav-1"],
			});

			const trackList = [
				new TFile("music/fav.mp3"),
				new TFile("music/other.mp3"),
			];
			const currentTrack = trackList[0]!;

			const result = listService.getCurrentPlaylistForTrack(currentTrack, null, trackList, []);
			expect(result.list.map((t) => t.path)).toEqual(["music/fav.mp3"]);

			const listId = listService.calculateCurrentListId(currentTrack, null, trackList, []);
			expect(listId).toBe("favorites");
		});
	});

	describe("setCurrentListFromSectionId", () => {
		it("should handle 'all' sectionId", () => {
			const { listService } = createService();
			const tracks = [new TFile("t.mp3")];
			const result = listService.setCurrentListFromSectionId("all", tracks, []);
			expect(result).toEqual({ type: "all", name: "All", tracks });
		});

		it("should handle 'favorites' sectionId", () => {
			const { listService } = createService();
			const favorites = [new TFile("fav.mp3")];
			const result = listService.setCurrentListFromSectionId("favorites", [], favorites);
			expect(result).toEqual({ type: "favorites", name: "Favorites", tracks: favorites });
		});

		it("should handle 'playlist-xxx' sectionId", () => {
			const { listService } = createService({
				playlists: {
					Rock: ["rock1.mp3"],
				},
			});
			const tracks = [new TFile("rock1.mp3"), new TFile("other.mp3")];
			const result = listService.setCurrentListFromSectionId("playlist-Rock", tracks, []);

			expect(result?.type).toBe("playlist");
			expect(result?.name).toBe("Rock");
			expect(result?.tracks.map((t) => t.path)).toEqual(["rock1.mp3"]);
		});

		it("should handle 'artist-xxx' sectionId", () => {
			const { listService } = createService();
			const result = listService.setCurrentListFromSectionId("artist-Queen", [], []);
			expect(result?.type).toBe("artist");
			expect(result?.name).toBe("Queen");
			expect(result?.tracks).toHaveLength(1);
		});

		it("should handle 'album-xxx' sectionId", () => {
			const { listService } = createService();
			const result = listService.setCurrentListFromSectionId("album-Opera", [], []);
			expect(result?.type).toBe("album");
			expect(result?.name).toBe("Opera");
			expect(result?.tracks).toHaveLength(1);
		});

		it("should return null for unrecognized sectionId", () => {
			const { listService } = createService();
			expect(listService.setCurrentListFromSectionId("invalid-section", [], [])).toBeNull();
		});
	});

	describe("setCurrentListContext", () => {
		it("should return null when sectionId is undefined", () => {
			const { listService } = createService();
			const result = listService.setCurrentListContext(undefined, null, [], []);
			expect(result).toEqual({ list: null, listId: null });
		});

		it("should return formatted context for valid sectionId", () => {
			const { listService } = createService();
			const tracks = [new TFile("1.mp3")];
			const result = listService.setCurrentListContext("all", null, tracks, []);
			expect(result.list?.type).toBe("all");
			expect(result.listId).toBe("all");
		});

		it("should fall back to all tracks when track is not in any playlist or favorites", () => {
			const { listService } = createService({
				playlists: {},
				favorites: [],
			});
			const trackList = [new TFile("unrelated.mp3")];
			const result = listService.getCurrentPlaylistForTrack(trackList[0]!, null, trackList, []);
			expect(result.list).toEqual(trackList);
			const listId = listService.calculateCurrentListId(trackList[0]!, null, trackList, []);
			expect(listId).toBe("all");
		});

		it("should return null list and listId when sectionId is unrecognized in setCurrentListContext", () => {
			const { listService } = createService();
			const result = listService.setCurrentListContext("invalid-section", null, [], []);
			expect(result).toEqual({ list: null, listId: null });
		});

		it("should handle empty-named playlist gracefully", () => {
			const track = new TFile("song.mp3");
			const { listService } = createService({
				playlists: {
					"": ["song.mp3"],
				},
			});
			const result = listService.getCurrentPlaylistForTrack(track, null, [track], []);
			expect(result.list).toEqual([track]);
		});
	});
});
