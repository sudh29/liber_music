/**
 * Music library management service
 * 
 * Manages music library business logic:
 * - Rebuilding all data (complete vault rescanning and metadata re-indexing)
 * - Refreshing music list (reading from settings and building categorized collections)
 * - Retrieving track lists, favorites, playlists, artists, albums
 * - Orchestrating library update lifecycle
 */

import { App, TFile } from "obsidian";
import MusicPlayerPlugin from "@/main";
import { rebuildAllData as updateMusicLibrary } from "@/utils/library/updater";
import { scanVaultAudioFiles } from "@/utils/library/scanVaultAudio";
import { sortTracksByTrack } from "@/utils/data/sort";
import { isSupportedAudioExtension } from "@/constants";
import { StateService } from "./StateService";
import { PlaylistService } from "./PlaylistService";
import { LyricsService } from "./LyricsService";
import { generateArtistsAndAlbums } from "@/utils/data/transform";
import { getOrCreateTrackId, getTrackPath } from "@/utils/track/id";
import { evaluateSmartPlaylist } from "@/utils/library/smartPlaylist";
import { generateFolderPlaylists } from "@/utils/library/folderSync";

export interface LibraryOrchestrationCallbacks {
	/** Callback invoked on library updates */
	onLibraryUpdated?: () => Promise<void>;
}

export class LibraryService {
	constructor(
		private app: App,
		private plugin: MusicPlayerPlugin,
		private stateService?: StateService,
		private playlistService?: PlaylistService,
		private lyricsService?: LyricsService,
		private callbacks: LibraryOrchestrationCallbacks = {}
	) {}

	/**
	 * Synchronizes the current playback list with the latest library data.
	 *
	 * Context: Library snapshots are built on the latest trackList, automatically omitting deleted files;
	 * however, the current playback list (state.currentList.tracks) was assigned at selection time.
	 * Re-evaluating tracks by currentList.type and name ensures consistency.
	 */
	private syncCurrentListAfterRefresh(): void {
		if (!this.stateService) return;
		const state = this.stateService.getState();
		const currentList = state.currentList;
		if (!currentList) return;

		const { type, name } = currentList;
		const trackList = state.trackList;
		const favorites = state.favorites;

		let tracks: TFile[] | null = null;
		if (type === "all") {
			tracks = trackList;
		} else if (type === "favorites") {
			tracks = favorites;
		} else if (type === "playlist") {
			const smartDef = Object.values(this.plugin.settings.smartPlaylists || {}).find(d => d.name === name);
			if (smartDef) {
				const trackItems = trackList.map(f => {
					const trackId = getOrCreateTrackId(f.path, this.plugin.settings);
					const meta = this.plugin.settings.tracks[trackId] || { title: f.basename, artist: "", album: "" };
					return { id: trackId, path: f.path, info: meta };
				});
				const matchedIds = new Set(evaluateSmartPlaylist(smartDef, trackItems));
				tracks = trackList.filter(f => {
					const trackId = getOrCreateTrackId(f.path, this.plugin.settings);
					return matchedIds.has(trackId);
				});
			} else if (name.startsWith("📁 ") && this.plugin.settings.syncFolderPlaylists) {
				const folderPlaylists = generateFolderPlaylists(
					trackList,
					this.plugin.settings.musicFolder || "",
					this.plugin.settings.folderPlaylistDepth ?? 1
				);
				const fp = folderPlaylists.find(p => p.name === name);
				tracks = fp ? sortTracksByTrack(fp.files, this.plugin.settings) : [];
			} else if (this.playlistService) {
				const playlistMap = this.playlistService.getPlaylistMap();
				const playlistTrackIds = playlistMap[name] || [];
				// Map path to file for fast lookup
				const pathToFileMap = new Map(trackList.map(f => [f.path, f]));
				const playlistFiles = playlistTrackIds
					.map(id => {
						const path = getTrackPath(id, this.plugin.settings);
						return path ? pathToFileMap.get(path) : null;
					})
					.filter((file): file is TFile => file !== null);
				tracks = sortTracksByTrack(playlistFiles, this.plugin.settings);
			} else {
				tracks = [];
			}
		} else if (type === "artist") {
			tracks = this.getArtists(trackList).find((a) => a.name === name)?.tracks ?? [];
		} else if (type === "album") {
			tracks = this.getAlbums(trackList).find((a) => a.name === name)?.tracks ?? [];
		} else {
			// Fallback: use existing tracks
			tracks = currentList.tracks || [];
		}

		// Only write back when changes exist to avoid redundant state updates
		const same =
			tracks.length === currentList.tracks.length &&
			tracks.every((f, i) => f.path === currentList.tracks[i]?.path);
		if (!same) {
			this.stateService.setCurrentList({ type, name, tracks });
		}

		// Sync currentTrack and currentIndex:
		// 1. If current track is missing from trackList (deleted, moved, or outside scan scope), clear state
		// 2. If index shifted, update index
		if (state.currentTrack) {
			const newIdx = trackList.findIndex((f) => f.path === state.currentTrack!.path);
			if (newIdx === -1) {
				this.stateService.setCurrentTrack(null, -1);
				this.stateService.setIsPlaying(false);
				this.stateService.resetLyrics();
			} else if (newIdx !== state.currentIndex) {
				const track = trackList[newIdx];
				if (track) {
					this.stateService.setCurrentTrack(track, newIdx);
				}
			}
		}
	}

	/**
	 * Checks whether library track list requires an update (called on startup without blocking UI).
	 * 
	 * Compares actual vault audio files against IDs stored in settings.tracks.
	 * If discrepancy is detected (files deleted, added, or path changes), returns true.
	 * 
	 * Logic:
	 * 1. Fast check: compare count of files vs count of stored IDs
	 * 2. If counts match, verify every stored ID resolves to a valid existing file
	 * 
	 * @returns Promise<boolean> True if inconsistency detected, false otherwise
	 */
	async checkLibraryConsistency(): Promise<boolean> {
		return Promise.resolve().then(() => {
			const actualFiles = this.getAllMusicFiles();
			const actualPaths = new Set(actualFiles.map(f => f.path));
			
			const storedTrackIds = Object.keys(this.plugin.settings.tracks || {});
			
			// 1. Fast check: different counts indicate inconsistency
			if (actualPaths.size !== storedTrackIds.length) {
				return true;
			}
			
			// 2. Check each stored ID's path
			for (const trackId of storedTrackIds) {
				const path = getTrackPath(trackId, this.plugin.settings);
				if (!path) {
					return true;
				}
				if (!actualPaths.has(path)) {
					return true;
				}
				const file = this.app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) {
					return true;
				}
			}
			
			return false;
		});
	}

	/**
	 * Rebuilds all music library data.
	 * 
	 * Rescans vault files, extracts metadata, and updates settings.
	 */
	async rebuildAllData(): Promise<number> {
		return await updateMusicLibrary(this.app, this.plugin);
	}

	/**
	 * Scans and returns all audio files in vault based on settings.
	 */
	getAllMusicFiles(): TFile[] {
		return scanVaultAudioFiles(this.app, this.plugin.settings.musicFolder ?? "");
	}

	/**
	 * Gets favorite tracks sorted by track number.
	 */
	getFavorites(trackList: TFile[]): TFile[] {
		const favoriteIds = new Set(this.plugin.settings.favorites || []);
		const pathToFileMap = new Map(trackList.map(f => [f.path, f]));
		
		const favoriteFiles = Array.from(favoriteIds)
			.map(id => {
				const path = getTrackPath(id, this.plugin.settings);
				return path ? pathToFileMap.get(path) : null;
			})
			.filter((file): file is TFile => file !== null);
		
		return sortTracksByTrack(favoriteFiles, this.plugin.settings);
	}

	/**
	 * Gets playlist mapping table.
	 */
	getPlaylistMap(): Record<string, string[]> {
		return this.plugin.settings.playlists || {};
	}

	/**
	 * Gets artist collections sorted by track number and artist name.
	 */
	getArtists(trackList: TFile[]): Array<{ name: string; tracks: TFile[] }> {
		const artistsData = this.plugin.settings.artists || {};
		const pathToFileMap = new Map(trackList.map(f => [f.path, f]));
		
		return Object.entries(artistsData)
			.map(([name, trackIds]) => {
				const tracks = trackIds
					.map(id => {
						const path = getTrackPath(id, this.plugin.settings);
						return path ? pathToFileMap.get(path) : null;
					})
					.filter((file): file is TFile => file != null);
				
				return {
					name,
					tracks: sortTracksByTrack(tracks, this.plugin.settings),
				};
			})
			.filter((artist) => artist.tracks.length > 0)
			.sort((a, b) => a.name.localeCompare(b.name, "en"));
	}

	/**
	 * Gets album collections sorted by track number and album name.
	 */
	getAlbums(trackList: TFile[]): Array<{ name: string; tracks: TFile[] }> {
		const albumsData = this.plugin.settings.albums || {};
		const pathToFileMap = new Map(trackList.map(f => [f.path, f]));
		
		return Object.entries(albumsData)
			.map(([name, trackIds]) => {
				const tracks = trackIds
					.map(id => {
						const path = getTrackPath(id, this.plugin.settings);
						return path ? pathToFileMap.get(path) : null;
					})
					.filter((file): file is TFile => file != null);
				
				return {
					name,
					tracks: sortTracksByTrack(tracks, this.plugin.settings),
				};
			})
			.filter((album) => album.tracks.length > 0)
			.sort((a, b) => a.name.localeCompare(b.name, "en"));
	}

	/**
	 * Refreshes music track list.
	 * 
	 * Fetches latest track list, favorites, and playlists, updating state.
	 * All lists are consistently sorted by track number.
	 */
	refreshMusicList(): void {
		if (!this.stateService || !this.playlistService) {
			throw new Error("refreshMusicList requires StateService and PlaylistService instances");
		}
		const list = this.getAllMusicFiles();
		const sortedList = sortTracksByTrack(list, this.plugin.settings);
		this.stateService.setTrackList(sortedList);
		this.stateService.setFavorites(this.getFavorites(sortedList));
		this.stateService.setPlaylistMap(this.playlistService.getPlaylistMap());
		this.syncCurrentListAfterRefresh();
	}

	/**
	 * Refreshes current track display.
	 * 
	 * Reloads standard and extended lyrics for current track.
	 */
	async refreshCurrentTrackDisplay(): Promise<void> {
		if (!this.stateService || !this.lyricsService) {
			throw new Error("refreshCurrentTrackDisplay requires StateService and LyricsService instances");
		}
		const state = this.stateService.getState();
		if (!state.currentTrack) return;
		try {
			const { lyrics, extendedLyrics } = this.lyricsService.loadLyrics(state.currentTrack.path);
			this.stateService.setLyrics(lyrics, extendedLyrics);
		} catch (error) {
			console.error("Error refreshing current track display:", error);
		}
	}

	/**
	 * Handles post-library update refresh workflow:
	 * 1. Refresh music track list
	 * 2. Refresh current track display
	 * 3. Trigger registered listeners
	 * 
	 * @param listeners - Set of library update listener callbacks
	 */
	async handleLibraryUpdated(listeners: Set<() => void>): Promise<void> {
		if (!this.stateService) {
			throw new Error("handleLibraryUpdated requires StateService instance");
		}
		try {
			this.refreshMusicList();
			await this.refreshCurrentTrackDisplay();
			for (const listener of listeners) {
				try {
					listener();
				} catch (e) {
					console.error("Error executing library update listener:", e);
				}
			}
		} catch (error) {
			console.error("Error handling library update refresh:", error);
		}
	}

	/**
	 * Removes a single deleted track from the library.
	 * 
	 * Cleans up associated references when a music file is deleted:
	 * - Removes ID mapping from trackIndex
	 * - Removes metadata entry from tracks
	 * - Removes from favorites (if present)
	 * - Removes from all playlists (if present)
	 * - Regenerates artists and albums mapping
	 * - Cleans up playback state if the playing track was deleted
	 * - Updates state and notifies listeners
	 * 
	 * @param trackPath - Deleted track path
	 */
	async removeTrackFromLibrary(trackPath: string): Promise<void> {
		try {
			const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
			
			// 1. Remove ID mapping from trackIndex
			if (this.plugin.settings.trackIndex && this.plugin.settings.trackIndex[trackId]) {
				delete this.plugin.settings.trackIndex[trackId];
			}

			// 2. Remove metadata from tracks
			if (this.plugin.settings.tracks && this.plugin.settings.tracks[trackId]) {
				delete this.plugin.settings.tracks[trackId];
			}

			// 3. Remove from favorites
			if (this.plugin.settings.favorites) {
				const originalFavoritesCount = this.plugin.settings.favorites.length;
				this.plugin.settings.favorites = this.plugin.settings.favorites.filter(
					id => id !== trackId
				);
				if (this.plugin.settings.favorites.length < originalFavoritesCount) {
					console.debug(`Removed deleted track from favorites: ${trackPath}`);
				}
			}

			// 4. Remove from playlists
			if (this.plugin.settings.playlists) {
				let totalRemovedFromPlaylists = 0;
				for (const [playlistName, trackIds] of Object.entries(this.plugin.settings.playlists)) {
					if (Array.isArray(trackIds)) {
						const originalCount = trackIds.length;
						this.plugin.settings.playlists[playlistName] = trackIds.filter(
							id => id !== trackId
						);
						const updatedPlaylist = this.plugin.settings.playlists[playlistName];
						const removedCount = originalCount - (updatedPlaylist?.length ?? 0);
						if (removedCount > 0) {
							totalRemovedFromPlaylists += removedCount;
							console.debug(`Removed deleted track from playlist "${playlistName}": ${trackPath}`);
						}
					}
				}
				if (totalRemovedFromPlaylists > 0) {
					console.debug(`Removed ${totalRemovedFromPlaylists} deleted track reference(s) from playlists`);
				}
			}

			// 5. Regenerate artists and albums
			const { artists, albums } = generateArtistsAndAlbums(this.plugin.settings);
			this.plugin.settings.artists = artists;
			this.plugin.settings.albums = albums;

			// 6. Save settings
			await this.plugin.saveSettings();

			// 7. Clear playback state if the playing track was deleted
			if (this.stateService) {
				const state = this.stateService.getState();
				if (state.currentTrack && state.currentTrack.path === trackPath) {
					this.stateService.setCurrentTrack(null, -1);
					this.stateService.setIsPlaying(false);
					this.stateService.resetLyrics();
					console.debug(`Currently playing track was deleted; cleared playback state: ${trackPath}`);
				}

				// 8. Update lists in StateService
				this.refreshMusicList();
			}

			// 9. Notify React components via callback
			if (this.callbacks.onLibraryUpdated) {
				await this.callbacks.onLibraryUpdated();
			}

			console.debug(`Removed deleted track from library: ${trackPath}`);
		} catch (error) {
			console.error(`Error removing track from library: ${trackPath}`, error);
		}
	}

	/**
	 * Handles file renaming.
	 * 
	 * Updates vault path mappings when an audio file is renamed.
	 * With ID system:
	 * - Only trackIndex mapping needs updating (track ID remains stable)
	 * - References in favorites, playlists, artists, albums remain untouched
	 * 
	 * @param oldPath - Old file path
	 * @param newPath - New file path
	 */
	async renameTrackInLibrary(oldPath: string, newPath: string): Promise<void> {
		try {
			if (oldPath === newPath) {
				console.warn(`Old and new paths are identical, skipping rename: ${oldPath}`);
				return;
			}
			
			// 1. Verify new path is a valid music file
			const newFile = this.app.vault.getAbstractFileByPath(newPath);
			if (!newFile || !(newFile instanceof TFile)) {
				console.warn(`New path file does not exist, cannot rename: ${oldPath} -> ${newPath}`);
				return;
			}

			const ext = newFile.extension?.toLowerCase() || '';
			if (!isSupportedAudioExtension(ext)) {
				console.warn(`New path is not a supported audio file, skipping rename: ${oldPath} -> ${newPath}`);
				return;
			}

			// 2. Resolve track ID
			const trackId = getOrCreateTrackId(oldPath, this.plugin.settings);
			
			// 3. Update trackIndex path mapping
			if (this.plugin.settings.trackIndex && this.plugin.settings.trackIndex[trackId]) {
				this.plugin.settings.trackIndex[trackId] = newPath;
				console.debug(`Updated path mapping: ${oldPath} -> ${newPath} (ID: ${trackId})`);
			} else {
				const newTrackId = getOrCreateTrackId(newPath, this.plugin.settings);
				const oldTrackData = this.plugin.settings.tracks?.[trackId];
				if (oldTrackData) {
					this.plugin.settings.tracks[newTrackId] = oldTrackData;
					delete this.plugin.settings.tracks[trackId];
					this.updateTrackIdReferences(trackId, newTrackId);
				}
			}

			// 4. Regenerate artists and albums
			const { artists, albums } = generateArtistsAndAlbums(this.plugin.settings);
			this.plugin.settings.artists = artists;
			this.plugin.settings.albums = albums;

			// 5. Save settings
			await this.plugin.saveSettings();

			// 6. Update current playing track reference if matching
			if (this.stateService) {
				const state = this.stateService.getState();
				if (state.currentTrack && state.currentTrack.path === oldPath) {
					this.stateService.setCurrentTrack(newFile, state.currentIndex);
					console.debug(`Current playing track path updated: ${oldPath} -> ${newPath}`);
				}

				// 7. Update lists
				this.refreshMusicList();
			}

			// 8. Trigger library update callback
			if (this.callbacks.onLibraryUpdated) {
				await this.callbacks.onLibraryUpdated();
			}

			console.debug(`Completed track rename: ${oldPath} -> ${newPath}`);
		} catch (error) {
			console.error(`Error updating track rename: ${oldPath} -> ${newPath}`, error);
			throw error;
		}
	}

	/**
	 * Updates track ID references across playlists and favorites during migration.
	 * 
	 * @param oldTrackId - Old track ID
	 * @param newTrackId - New track ID
	 */
	private updateTrackIdReferences(oldTrackId: string, newTrackId: string): void {
		// Update favorites
		if (this.plugin.settings.favorites) {
			const index = this.plugin.settings.favorites.indexOf(oldTrackId);
			if (index !== -1) {
				this.plugin.settings.favorites[index] = newTrackId;
			}
		}

		// Update playlists
		if (this.plugin.settings.playlists) {
			for (const [playlistName, trackIds] of Object.entries(this.plugin.settings.playlists)) {
				if (Array.isArray(trackIds)) {
					const index = trackIds.indexOf(oldTrackId);
					if (index !== -1) {
						const playlist = this.plugin.settings.playlists[playlistName];
						if (playlist) {
							playlist[index] = newTrackId;
						}
					}
				}
			}
		}
	}

	/**
	 * Updates metadata for a single audio file.
	 * 
	 * Rescans metadata when an audio file is modified on disk:
	 * - Extracts embedded tags (title, artist, album, lyrics, etc.)
	 * - Updates settings.tracks
	 * - Regenerates artists and albums mapping
	 * - Updates active playback information if track is currently playing
	 * 
	 * @param trackPath - Track path to update
	 */
	async updateTrackMetadata(trackPath: string): Promise<void> {
		try {
			// 1. Get file object
			const file = this.app.vault.getAbstractFileByPath(trackPath);
			if (!file || !(file instanceof TFile)) {
				console.warn(`File does not exist, cannot update metadata: ${trackPath}`);
				return;
			}

			// 2. Verify audio extension
			const ext = file.extension?.toLowerCase() || '';
			if (!isSupportedAudioExtension(ext)) {
				console.warn(`Not an audio file, skipping metadata update: ${trackPath}`);
				return;
			}

			// 3. Read binary and extract metadata
			const { readAudioFileBinary, getEmbeddedAudioMetadataFromBuffer, readCompanionLrc } = await import("@/utils/audio/metadata");
			const { parseTrackFilename } = await import("@/utils/audio/filenameParser");
			
			const binary = await readAudioFileBinary(this.app, file);
			const audioMetadata = binary ? await getEmbeddedAudioMetadataFromBuffer(binary) : null;

			const parsed = parseTrackFilename(file.path);
			const title = audioMetadata?.title?.trim() || parsed.title || file.basename;
			const artist = audioMetadata?.artist?.trim() || parsed.artist || '';
			const album = audioMetadata?.album?.trim() || parsed.album || '';
			const year = audioMetadata?.year || parsed.year;

			let lyrics = audioMetadata?.lyricsText || '';
			if (!lyrics.trim()) {
				const companion = await readCompanionLrc(this.app, file);
				if (companion) {
					lyrics = companion;
				}
			}

			// 4. Update track metadata in settings
			const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
			this.plugin.settings.tracks[trackId] = {
				title,
				artist,
				album,
				lyrics,
				year,
				genre: Array.isArray(audioMetadata?.genre) ? 
					audioMetadata?.genre[0] : audioMetadata?.genre,
				track: audioMetadata?.track,
				duration: audioMetadata?.duration
			};

			// 5. Regenerate artists and albums
			const { generateArtistsAndAlbums } = await import("@/utils/data/transform");
			const { artists, albums } = generateArtistsAndAlbums(this.plugin.settings);
			this.plugin.settings.artists = artists;
			this.plugin.settings.albums = albums;

			// 6. Save settings
			await this.plugin.saveSettings();

			// 7. Update active playback display if currently playing
			if (this.stateService) {
				const state = this.stateService.getState();
				if (state.currentTrack && state.currentTrack.path === trackPath) {
					if (this.lyricsService) {
						const { lyrics, extendedLyrics } = this.lyricsService.loadLyrics(trackPath);
						this.stateService.setLyrics(lyrics, extendedLyrics);
					}
					console.debug(`Updated active track metadata: ${trackPath}`);
				}

				// 8. Refresh list
				this.refreshMusicList();
			}

			// 9. Notify React components
			if (this.callbacks.onLibraryUpdated) {
				await this.callbacks.onLibraryUpdated();
			}

			console.debug(`Updated track metadata: ${trackPath}`);
		} catch (error) {
			console.error(`Error updating track metadata: ${trackPath}`, error);
		}
	}
}
