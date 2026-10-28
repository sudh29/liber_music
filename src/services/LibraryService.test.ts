import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { LibraryService } from "./LibraryService";
import { StateService } from "./StateService";
import { PlaylistService } from "./PlaylistService";
import { LyricsService } from "./LyricsService";
import type MusicPlayerPlugin from "@/main";

function createMockTFile(path: string, name?: string): TFile {
	const file = new TFile(path);
	file.path = path;
	file.name = name || path.split("/").pop() || "track.mp3";
	file.basename = file.name.replace(/\.[^/.]+$/, "");
	file.extension = file.name.split(".").pop() || "mp3";
	return file;
}

describe("LibraryService", () => {
	function createService(overrides?: {
		settings?: any;
		onLibraryUpdated?: () => Promise<void>;
	}) {
		const app = new App();
		const defaultSettings = {
			musicFolder: "music",
			tracks: {
				"id-1": { title: "Song 1", artist: "Queen", album: "Opera", path: "music/song1.mp3" },
				"id-2": { title: "Song 2", artist: "Queen", album: "Opera", path: "music/song2.mp3" },
				"id-3": { title: "Song 3", artist: "Bowie", album: "Heroes", path: "music/song3.mp3" },
			},
			trackIndex: {
				"id-1": "music/song1.mp3",
				"id-2": "music/song2.mp3",
				"id-3": "music/song3.mp3",
			},
			favorites: ["id-1"],
			playlists: {
				Favorites: ["id-1", "id-2"],
			},
			artists: {
				Queen: ["id-1", "id-2"],
				Bowie: ["id-3"],
			},
			albums: {
				Opera: ["id-1", "id-2"],
				Heroes: ["id-3"],
			},
		};

		const plugin = {
			app,
			settings: overrides?.settings || defaultSettings,
			saveSettings: vi.fn().mockResolvedValue(undefined),
		} as unknown as MusicPlayerPlugin;

		const stateService = new StateService();
		const playlistService = new PlaylistService(app, plugin, stateService);
		const lyricsService = new LyricsService(plugin);

		const service = new LibraryService(
			app,
			plugin,
			stateService,
			playlistService,
			lyricsService,
			{ onLibraryUpdated: overrides?.onLibraryUpdated }
		);

		return { service, app, plugin, stateService, playlistService, lyricsService };
	}

	it("should retrieve categorized artists with track lists", () => {
		const { service } = createService();
		const trackList = [
			createMockTFile("music/song1.mp3"),
			createMockTFile("music/song2.mp3"),
			createMockTFile("music/song3.mp3"),
		];

		const artists = service.getArtists(trackList);
		expect(artists).toHaveLength(2);

		const queen = artists.find((a) => a.name === "Queen");
		expect(queen).toBeDefined();
		expect(queen?.tracks).toHaveLength(2);
	});

	it("should retrieve categorized albums with track lists", () => {
		const { service } = createService();
		const trackList = [
			createMockTFile("music/song1.mp3"),
			createMockTFile("music/song2.mp3"),
			createMockTFile("music/song3.mp3"),
		];

		const albums = service.getAlbums(trackList);
		expect(albums).toHaveLength(2);

		const opera = albums.find((a) => a.name === "Opera");
		expect(opera).toBeDefined();
		expect(opera?.tracks).toHaveLength(2);
	});

	it("should retrieve favorites and playlistMap", () => {
		const { service } = createService();
		const trackList = [
			createMockTFile("music/song1.mp3"),
			createMockTFile("music/song2.mp3"),
		];

		const favs = service.getFavorites(trackList);
		expect(favs).toHaveLength(1);
		expect(favs[0].path).toBe("music/song1.mp3");

		const playlists = service.getPlaylistMap();
		expect(playlists.Favorites).toEqual(["id-1", "id-2"]);
	});

	describe("checkLibraryConsistency", () => {
		it("should return true if file count differs from stored track count", async () => {
			const { service } = createService();
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue([
				createMockTFile("music/song1.mp3"),
				createMockTFile("music/song2.mp3"),
			]);

			const inconsistent = await service.checkLibraryConsistency();
			expect(inconsistent).toBe(true);
		});

		it("should return true if stored track path does not exist in vault files", async () => {
			const { service } = createService();
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue([
				createMockTFile("music/song1.mp3"),
				createMockTFile("music/song2.mp3"),
				createMockTFile("music/other.mp3"),
			]);

			const inconsistent = await service.checkLibraryConsistency();
			expect(inconsistent).toBe(true);
		});

		it("should return true if abstract file in vault is missing or not a TFile", async () => {
			const { service, app } = createService();
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue([
				createMockTFile("music/song1.mp3"),
				createMockTFile("music/song2.mp3"),
				createMockTFile("music/song3.mp3"),
			]);
			vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((path) => {
				if (path === "music/song3.mp3") return null;
				return createMockTFile(path);
			});

			const inconsistent = await service.checkLibraryConsistency();
			expect(inconsistent).toBe(true);
		});

		it("should return false if all stored tracks exist and match vault files", async () => {
			const { service, app } = createService();
			const files = [
				createMockTFile("music/song1.mp3"),
				createMockTFile("music/song2.mp3"),
				createMockTFile("music/song3.mp3"),
			];
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue(files);
			vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((path) => {
				return files.find((f) => f.path === path) || null;
			});

			const inconsistent = await service.checkLibraryConsistency();
			expect(inconsistent).toBe(false);
		});
	});

	describe("refreshMusicList and synchronization", () => {
		it("should throw error if stateService or playlistService are not provided", () => {
			const app = new App();
			const plugin = { app, settings: {} } as unknown as MusicPlayerPlugin;
			const bareService = new LibraryService(app, plugin);
			expect(() => bareService.refreshMusicList()).toThrow(
				"refreshMusicList requires StateService and PlaylistService instances"
			);
		});

		it("should refresh trackList, favorites, playlists, and synchronize currentList", () => {
			const { service, stateService } = createService();
			const files = [
				createMockTFile("music/song1.mp3"),
				createMockTFile("music/song2.mp3"),
				createMockTFile("music/song3.mp3"),
			];
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue(files);

			stateService.setCurrentList({
				type: "all",
				name: "All",
				tracks: [files[0]],
			});

			service.refreshMusicList();

			const state = stateService.getState();
			expect(state.trackList).toHaveLength(3);
			expect(state.favorites).toHaveLength(1);
			expect(state.currentList?.tracks).toHaveLength(3);
		});

		it("should synchronize currentList of type favorites, playlist, artist, and album", () => {
			const { service, stateService } = createService();
			const files = [
				createMockTFile("music/song1.mp3"),
				createMockTFile("music/song2.mp3"),
				createMockTFile("music/song3.mp3"),
			];
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue(files);

			// Test favorites list sync
			stateService.setCurrentList({ type: "favorites", name: "Favorites", tracks: [] });
			service.refreshMusicList();
			expect(stateService.getState().currentList?.tracks).toHaveLength(1);

			// Test playlist list sync
			stateService.setCurrentList({ type: "playlist", name: "Favorites", tracks: [] });
			service.refreshMusicList();
			expect(stateService.getState().currentList?.tracks).toHaveLength(2);

			// Test artist list sync
			stateService.setCurrentList({ type: "artist", name: "Queen", tracks: [] });
			service.refreshMusicList();
			expect(stateService.getState().currentList?.tracks).toHaveLength(2);

			// Test album list sync
			stateService.setCurrentList({ type: "album", name: "Heroes", tracks: [] });
			service.refreshMusicList();
			expect(stateService.getState().currentList?.tracks).toHaveLength(1);
		});

		it("should sync smart playlists and folder playlists in refreshMusicList", () => {
			const smartDef = {
				id: "s1",
				name: "Queen Only",
				matchType: "all" as const,
				rules: [{ id: "r1", field: "artist" as const, operator: "equals" as const, value: "Queen" }],
				sortBy: "title" as const,
				sortOrder: "asc" as const,
			};

			const { service, stateService } = createService({
				settings: {
					musicFolder: "music",
					tracks: {
						"id-1": { title: "Song 1", artist: "Queen", album: "Opera", path: "music/Rock/song1.mp3" },
						"id-2": { title: "Song 2", artist: "Queen", album: "Opera", path: "music/Rock/song2.mp3" },
						"id-3": { title: "Song 3", artist: "Bowie", album: "Heroes", path: "music/Jazz/song3.mp3" },
					},
					trackIndex: {
						"id-1": "music/Rock/song1.mp3",
						"id-2": "music/Rock/song2.mp3",
						"id-3": "music/Jazz/song3.mp3",
					},
					favorites: [],
					playlists: {},
					artists: {},
					albums: {},
					smartPlaylists: {
						s1: smartDef,
					},
					syncFolderPlaylists: true,
					folderPlaylistDepth: 1,
				},
			});

			const file1 = createMockTFile("music/Rock/song1.mp3");
			const file2 = createMockTFile("music/Rock/song2.mp3");
			const file3 = createMockTFile("music/Jazz/song3.mp3");

			vi.spyOn(service, "getAllMusicFiles").mockReturnValue([file1, file2, file3]);

			// 1. Sync smart playlist
			stateService.setCurrentList({ type: "playlist", name: "Queen Only", tracks: [] });
			service.refreshMusicList();
			expect(stateService.getState().currentList?.tracks).toHaveLength(2);

			// 2. Sync folder playlist
			stateService.setCurrentList({ type: "playlist", name: "📁 Rock", tracks: [] });
			service.refreshMusicList();
			expect(stateService.getState().currentList?.tracks).toHaveLength(2);
		});

		it("should clear playback state when current track is deleted from library", () => {
			const { service, stateService } = createService();
			const deletedTrack = createMockTFile("music/deleted.mp3");
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue([
				createMockTFile("music/song1.mp3"),
			]);

			stateService.setCurrentTrack(deletedTrack, 0);
			stateService.setIsPlaying(true);
			stateService.setCurrentList({ type: "all", name: "All", tracks: [deletedTrack] });

			service.refreshMusicList();

			const state = stateService.getState();
			expect(state.currentTrack).toBeNull();
			expect(state.currentIndex).toBe(-1);
			expect(state.isPlaying).toBe(false);
		});

		it("should update currentIndex when track position shifts", () => {
			const { service, stateService } = createService();
			const file1 = createMockTFile("music/song1.mp3");
			const file2 = createMockTFile("music/song2.mp3");

			stateService.setTrackList([file1, file2]);
			stateService.setCurrentList({ type: "all", name: "All", tracks: [file1, file2] });
			// Initially file2 was at index 0 (outdated index)
			stateService.setCurrentTrack(file2, 0);

			(service as any).syncCurrentListAfterRefresh();

			expect(stateService.getState().currentIndex).toBe(1);
		});
	});

	describe("refreshCurrentTrackDisplay & handleLibraryUpdated", () => {
		it("should refresh lyrics for current track", async () => {
			const { service, stateService, lyricsService } = createService();
			const track = createMockTFile("music/song1.mp3");
			stateService.setCurrentTrack(track, 0);

			vi.spyOn(lyricsService, "loadLyrics").mockReturnValue({
				lyrics: [{ time: 10, text: "We will rock you" }],
				extendedLyrics: [],
			});

			await service.refreshCurrentTrackDisplay();

			expect(stateService.getState().currentLyrics).toHaveLength(1);
			expect(stateService.getState().currentLyrics[0].text).toBe("We will rock you");
		});

		it("should handle error in refreshCurrentTrackDisplay gracefully", async () => {
			const { service, stateService, lyricsService } = createService();
			const track = createMockTFile("music/song1.mp3");
			stateService.setCurrentTrack(track, 0);

			vi.spyOn(lyricsService, "loadLyrics").mockImplementation(() => {
				throw new Error("Disk read error");
			});

			await expect(service.refreshCurrentTrackDisplay()).resolves.toBeUndefined();
		});

		it("should trigger registered listeners in handleLibraryUpdated and survive listener errors", async () => {
			const { service } = createService();
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue([]);

			const goodListener = vi.fn();
			const faultyListener = vi.fn().mockImplementation(() => {
				throw new Error("Boom");
			});

			const listeners = new Set([faultyListener, goodListener]);
			await service.handleLibraryUpdated(listeners);

			expect(faultyListener).toHaveBeenCalled();
			expect(goodListener).toHaveBeenCalled();
		});
	});

	describe("removeTrackFromLibrary", () => {
		it("should clean up track references from trackIndex, favorites, playlists, and state", async () => {
			const onUpdated = vi.fn().mockResolvedValue(undefined);
			const { service, plugin, stateService } = createService({
				onLibraryUpdated: onUpdated,
			});

			const trackToRemove = "music/song1.mp3";
			const file2 = createMockTFile("music/song2.mp3");
			const file3 = createMockTFile("music/song3.mp3");
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue([file2, file3]);

			// Track 1 is currently playing
			stateService.setCurrentTrack(createMockTFile(trackToRemove), 0);
			stateService.setIsPlaying(true);

			await service.removeTrackFromLibrary(trackToRemove);

			// Assert removed from trackIndex and tracks
			expect(plugin.settings.trackIndex["id-1"]).toBeUndefined();
			expect(plugin.settings.tracks["id-1"]).toBeUndefined();

			// Assert removed from favorites
			expect(plugin.settings.favorites).not.toContain("id-1");

			// Assert removed from playlist
			expect(plugin.settings.playlists.Favorites).not.toContain("id-1");
			expect(plugin.settings.playlists.Favorites).toContain("id-2");

			// Assert settings saved
			expect(plugin.saveSettings).toHaveBeenCalled();

			// Assert playback state was reset
			expect(stateService.getState().currentTrack).toBeNull();
			expect(stateService.getState().isPlaying).toBe(false);

			// Assert callback was triggered
			expect(onUpdated).toHaveBeenCalled();
		});
	});

	describe("renameTrackInLibrary", () => {
		it("should skip if old and new paths are identical", async () => {
			const { service, plugin } = createService();
			await service.renameTrackInLibrary("music/song1.mp3", "music/song1.mp3");
			expect(plugin.saveSettings).not.toHaveBeenCalled();
		});

		it("should skip if new file does not exist or is not a supported audio file", async () => {
			const { service, app, plugin } = createService();

			// File does not exist
			vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(null);
			await service.renameTrackInLibrary("music/song1.mp3", "music/song_new.mp3");
			expect(plugin.saveSettings).not.toHaveBeenCalled();

			// Not supported audio file (e.g. text file)
			const txtFile = createMockTFile("music/notes.txt", "notes.txt");
			vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(txtFile);
			await service.renameTrackInLibrary("music/song1.mp3", "music/notes.txt");
			expect(plugin.saveSettings).not.toHaveBeenCalled();
		});

		it("should update trackIndex, save settings, and update currentTrack when playing", async () => {
			const onUpdated = vi.fn().mockResolvedValue(undefined);
			const { service, app, plugin, stateService } = createService({
				onLibraryUpdated: onUpdated,
			});

			const oldPath = "music/song1.mp3";
			const newPath = "music/renamed_song1.mp3";
			const newFile = createMockTFile(newPath, "renamed_song1.mp3");

			vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation((p) => {
				if (p === newPath) return newFile;
				return null;
			});
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue([
				newFile,
				createMockTFile("music/song2.mp3"),
				createMockTFile("music/song3.mp3"),
			]);

			stateService.setCurrentTrack(createMockTFile(oldPath), 0);

			await service.renameTrackInLibrary(oldPath, newPath);

			expect(plugin.settings.trackIndex["id-1"]).toBe(newPath);
			expect(plugin.saveSettings).toHaveBeenCalled();
			expect(stateService.getState().currentTrack?.path).toBe(newPath);
			expect(onUpdated).toHaveBeenCalled();
		});
	});

	describe("updateTrackMetadata", () => {
		it("should skip if file does not exist or is not audio", async () => {
			const { service, app, plugin } = createService();
			vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(null);

			await service.updateTrackMetadata("music/nonexistent.mp3");
			expect(plugin.saveSettings).not.toHaveBeenCalled();

			const txtFile = createMockTFile("music/doc.pdf", "doc.pdf");
			vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(txtFile);
			await service.updateTrackMetadata("music/doc.pdf");
			expect(plugin.saveSettings).not.toHaveBeenCalled();
		});

		it("should extract metadata, update settings, and update playing track lyrics", async () => {
			const onUpdated = vi.fn().mockResolvedValue(undefined);
			const { service, app, plugin, stateService, lyricsService } = createService({
				onLibraryUpdated: onUpdated,
			});

			const file = createMockTFile("music/song1.mp3");
			vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(file);
			vi.spyOn(app.vault.adapter, "readBinary").mockResolvedValue(new ArrayBuffer(64));
			vi.spyOn(service, "getAllMusicFiles").mockReturnValue([file]);

			// Currently playing
			stateService.setCurrentTrack(file, 0);

			const metadataModule = await import("@/utils/audio/metadata");
			vi.spyOn(metadataModule, "getEmbeddedAudioMetadataFromBuffer").mockResolvedValue({
				title: "Bohemian Rhapsody",
				artist: "Queen",
				album: "A Night at the Opera",
				lyricsText: "[00:01.00]Is this the real life?",
				year: 1975,
				genre: "Rock",
				track: 1,
				duration: 354,
			});

			vi.spyOn(lyricsService, "loadLyrics").mockReturnValue({
				lyrics: [{ time: 1, text: "Is this the real life?" }],
				extendedLyrics: [],
			});

			await service.updateTrackMetadata("music/song1.mp3");

			expect(plugin.settings.tracks["id-1"].title).toBe("Bohemian Rhapsody");
			expect(plugin.settings.tracks["id-1"].year).toBe(1975);
			expect(plugin.saveSettings).toHaveBeenCalled();
			expect(stateService.getState().currentLyrics[0].text).toBe("Is this the real life?");
			expect(onUpdated).toHaveBeenCalled();
		});

		it("should handle error in updateTrackMetadata gracefully", async () => {
			const { service, app } = createService();
			vi.spyOn(app.vault, "getAbstractFileByPath").mockImplementation(() => {
				throw new Error("Vault error");
			});

			await expect(service.updateTrackMetadata("music/song1.mp3")).resolves.toBeUndefined();
		});

		it("should handle error in removeTrackFromLibrary gracefully", async () => {
			const { service, plugin } = createService();
			vi.spyOn(plugin, "saveSettings").mockRejectedValue(new Error("Save failed"));

			await expect(service.removeTrackFromLibrary("music/song1.mp3")).resolves.toBeUndefined();
		});

		it("should log and rethrow error in renameTrackInLibrary", async () => {
			const { service, app, plugin } = createService();
			const file = createMockTFile("new.mp3");
			vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(file);
			vi.spyOn(plugin, "saveSettings").mockRejectedValue(new Error("Rename persist failed"));

			await expect(service.renameTrackInLibrary("old.mp3", "new.mp3")).rejects.toThrow("Rename persist failed");
		});
	});
});
