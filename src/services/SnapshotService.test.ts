import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { SnapshotService, SnapshotState } from "./SnapshotService";
import type MusicPlayerPlugin from "@/main";
import type { ListService, LibraryService } from "./index";

describe("SnapshotService", () => {
	function createService() {
		const app = new App();
		const plugin = {
			settings: {
				trackIndex: {
					"track-1": "music/song1.mp3",
				},
				tracks: {
					"track-1": {
						id: "track-1",
						path: "music/song1.mp3",
						title: "Bohemian Rhapsody",
						artist: "Queen",
						album: "A Night at the Opera",
						duration: 354,
						lyrics: "[00:10.00]Is this the real life?",
					},
				},
				favorites: ["track-1"],
				playlists: {
					Rock: ["track-1"],
				},
				artists: {},
				albums: {},
			},
		} as unknown as MusicPlayerPlugin;

		const listService = {
			getCurrentPlaylistForTrack: vi.fn().mockReturnValue({ list: [] }),
		} as unknown as ListService;

		const libraryService = {
			getArtists: vi.fn().mockReturnValue([]),
			getAlbums: vi.fn().mockReturnValue([]),
		} as unknown as LibraryService;

		const service = new SnapshotService(app, plugin, listService, libraryService);
		return { service, app, plugin };
	}

	describe("getPlaybackSnapshot", () => {
		it("should construct valid playback snapshot with metadata, lyrics, and favorite status", () => {
			const { service } = createService();
			const track = new TFile("music/song1.mp3");

			const state: SnapshotState = {
				currentTrack: track,
				currentIndex: 0,
				isPlaying: true,
				playMode: "normal",
				currentLyrics: [
					{ time: 10, text: "Is this the real life?" },
					{ time: 20, text: "Is this just fantasy?" },
				],
				currentExtendedLyrics: [],
				volume: 0.8,
				playbackRate: 1.0,
				audioElement: { currentTime: 15, duration: 354, volume: 0.8, playbackRate: 1.0 } as any,
				trackList: [track],
				currentList: null,
				favorites: [track],
				currentListId: "all",
				currentSectionIdForPlaylist: null,
			};

			const snapshot = service.getPlaybackSnapshot(state);

			expect(snapshot.title).toBe("Bohemian Rhapsody");
			expect(snapshot.artist).toBe("Queen");
			expect(snapshot.isPlaying).toBe(true);
			expect(snapshot.currentTime).toBe(15);
			expect(snapshot.duration).toBe(354);
			expect(snapshot.isFavorite).toBe(true);
			expect(snapshot.currentLyric).toBe("Is this the real life?");
			expect(snapshot.nextLyric).toBe("Is this just fantasy?");
		});

		it("should handle null currentTrack with fallback labels", () => {
			const { service } = createService();
			const state: SnapshotState = {
				currentTrack: null,
				currentIndex: -1,
				isPlaying: false,
				playMode: "normal",
				currentLyrics: [],
				currentExtendedLyrics: [],
				volume: 1.0,
				playbackRate: 1.0,
				audioElement: null,
				trackList: [],
				currentList: null,
				favorites: [],
				currentListId: "all",
				currentSectionIdForPlaylist: null,
			};

			const snapshot = service.getPlaybackSnapshot(state);
			expect(snapshot.title).toBe("No track selected");
			expect(snapshot.artist).toBe("Unknown artist");
			expect(snapshot.isPlaying).toBe(false);
			expect(snapshot.currentTime).toBe(0);
			expect(snapshot.isFavorite).toBe(false);
		});

		it("should parse filename to resolve artist and title when track is not in settings.tracks", () => {
			const { service } = createService();
			const track = new TFile("music/western/1985 - Bryan Adams - Summer Of 69.mp3");

			const state: SnapshotState = {
				currentTrack: track,
				currentIndex: 0,
				isPlaying: true,
				playMode: "normal",
				currentLyrics: [],
				currentExtendedLyrics: [],
				volume: 1.0,
				playbackRate: 1.0,
				audioElement: null,
				trackList: [track],
				currentList: null,
				favorites: [],
				currentListId: "all",
				currentSectionIdForPlaylist: null,
			};

			const snapshot = service.getPlaybackSnapshot(state);
			expect(snapshot.title).toBe("Summer Of 69");
			expect(snapshot.artist).toBe("Bryan Adams");
		});
	});

	describe("getLibrarySnapshot", () => {
		it("should construct library snapshot with all tracks, favorites, and playlists", () => {
			const { service } = createService();
			const track = new TFile("music/song1.mp3");

			const snapshot = service.getLibrarySnapshot([track], track, "all");

			expect(snapshot.allTracks).toHaveLength(1);
			expect(snapshot.allTracks[0]?.title).toBe("Bohemian Rhapsody");
			expect(snapshot.favorites).toHaveLength(1);
			expect(snapshot.playlists).toHaveLength(1);
			expect(snapshot.playlists[0]?.name).toBe("Rock");
		});

		it("should parse filename fallback for unindexed tracks in library snapshot and resolve ratings by path", () => {
			const { service, plugin } = createService();
			plugin.settings.ratings = {
				"music/bollywood/1997 - Celine Dion - Titanic - My Heart Will Go On.mp3": 5,
			};

			const track = new TFile("music/bollywood/1997 - Celine Dion - Titanic - My Heart Will Go On.mp3");
			const snapshot = service.getLibrarySnapshot([track], null, "all");

			expect(snapshot.allTracks).toHaveLength(1);
			const trackInfo = snapshot.allTracks[0];
			expect(trackInfo?.title).toBe("My Heart Will Go On");
			expect(trackInfo?.artist).toBe("Celine Dion");
			expect(trackInfo?.album).toBe("Titanic");
			expect(trackInfo?.rating).toBe(5);
		});

		it("should include evaluated smart playlists and folder auto-synced playlists", () => {
			const { service, plugin } = createService();
			plugin.settings.smartPlaylists = {
				"smart_1": {
					id: "smart_1",
					name: "Epic Songs",
					matchType: "all",
					rules: [{ id: "r1", field: "duration", operator: "greaterThan", value: 300 }],
				},
			};
			plugin.settings.syncFolderPlaylists = true;
			plugin.settings.musicFolder = "music";

			const track1 = new TFile("music/Rock/song1.mp3");
			const track2 = new TFile("music/Jazz/song2.mp3");

			plugin.settings.trackIndex = {
				"track-1": "music/Rock/song1.mp3",
				"track-2": "music/Jazz/song2.mp3",
			};
			plugin.settings.tracks = {
				"track-1": { title: "Bohemian Rhapsody", artist: "Queen", album: "Opera", duration: 354 },
				"track-2": { title: "Short Song", artist: "Short", album: "Mini", duration: 120 },
			};

			const snapshot = service.getLibrarySnapshot([track1, track2], null, "all");

			// Playlists should contain: smart playlist "Epic Songs", custom playlist "Rock", folder playlists "📁 Jazz", "📁 Rock"
			const names = snapshot.playlists.map((p) => p.name);
			expect(names).toContain("Epic Songs");
			expect(names).toContain("📁 Rock");
			expect(names).toContain("📁 Jazz");

			const smartPl = snapshot.playlists.find((p) => p.name === "Epic Songs");
			expect(smartPl?.isSmart).toBe(true);
			expect(smartPl?.tracks).toHaveLength(1);
			expect(smartPl?.tracks[0]?.title).toBe("Bohemian Rhapsody");

			const folderPl = snapshot.playlists.find((p) => p.name === "📁 Rock");
			expect(folderPl?.isFolder).toBe(true);
		});
	});
});

