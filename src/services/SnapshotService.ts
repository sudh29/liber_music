/**
 * Snapshot generation service
 * 
 * Generates snapshot states consumed by React components:
 * - Playback state snapshot
 * - Music library snapshot
 */

import { App, TFile } from "obsidian";
import MusicPlayerPlugin from "@/main";
import type { ReactLibrarySnapshot, ReactPlaybackSnapshot, ReactTrackInfo } from "@/types";
import type { PlayMode } from "@/main";
import type { LyricLine } from "@/utils/lyrics/parser";
import type { ExtendedLyricLine } from "@/utils/lyrics/extendedParser";
import { getTrackCover, type GetTrackCoverOptions } from "@/utils/library/coverFinder";
import { calculateLyricsIndex } from "@/utils/lyrics/indexCalculator";
import type { CurrentList, ListService } from "./ListService";
import type { LibraryService } from "./LibraryService";
import { sortTracksByTrack } from "@/utils/data/sort";
import { getOrCreateTrackId, getTrackPath } from "@/utils/track/id";
import { parseTrackFilename } from "@/utils/audio/filenameParser";
import { t } from "@/utils/i18n/i18n";

/**
 * Snapshot state interface
 * 
 * Defines state fields required to construct playback and library snapshots.
 */
export interface SnapshotState {
	/** Currently playing track */
	currentTrack: TFile | null;
	/** Current track index in trackList */
	currentIndex: number;
	/** Whether audio is currently playing */
	isPlaying: boolean;
	/** Playback mode */
	playMode: PlayMode;
	/** Standard lyrics for current track */
	currentLyrics: LyricLine[];
	/** Word-by-word lyrics for current track */
	currentExtendedLyrics: ExtendedLyricLine[];
	/** Playback volume */
	volume: number;
	/** Playback rate */
	playbackRate: number;
	/** HTML Audio element */
	audioElement: HTMLAudioElement | null;
	/** All tracks list */
	trackList: TFile[];
	/** Current list context */
	currentList: CurrentList | null;
	/** Favorites list */
	favorites: TFile[];
	/** Current list identifier */
	currentListId: string | null;
	/** Section ID for current playlist */
	currentSectionIdForPlaylist: string | null;
	/** Pending next track cover URL for transition animations */
	pendingNextCoverUrl?: string;
	/** Pending previous track cover URL for transition animations */
	pendingPrevCoverUrl?: string;
}

/**
 * Snapshot generation service class
 * 
 * Converts internal application state into immutable snapshots for React components.
 */
export class SnapshotService {
	/**
	 * Creates a snapshot service instance.
	 * 
	 * @param app - Obsidian App instance for resource resolution
	 * @param plugin - Plugin instance for settings access
	 * @param listService - List service for current queue retrieval
	 * @param libraryService - Library service for categorized collections
	 */
	constructor(
		private app: App,
		private plugin: MusicPlayerPlugin,
		private listService: ListService,
		private libraryService: LibraryService
	) {}

	/**
	 * Resolves track cover URL synchronously.
	 * Returns undefined; embedded covers are loaded asynchronously at component level.
	 * 
	 * @param trackFile - Track file
	 * @returns Always returns undefined for async loading
	 */
	private resolveTrackCoverUrl(trackFile: TFile | null | undefined): string | undefined {
		return undefined;
	}

	/**
	 * Asynchronously retrieves track cover (folder cover prioritized over embedded tag cover).
	 * 
	 * @param trackFile - Track file
	 * @param options - Optional resolution options
	 * @returns Cover image URL (file path or base64 Data URL), or undefined if not found
	 */
	public async getTrackCoverAsync(
		trackFile: TFile | null | undefined,
		options?: GetTrackCoverOptions
	): Promise<string | undefined> {
		if (!trackFile) return undefined;
		return await getTrackCover(this.app, trackFile, options);
	}

	/**
	 * Generates playback snapshot.
	 * 
	 * Converts playback state to React-friendly format:
	 * - Track details (title, artist, cover)
	 * - Progress and timing
	 * - Lyrics context (previous, current, next, full)
	 * - Playback status and mode
	 * - Volume and playback rate
	 */
	getPlaybackSnapshot(state: SnapshotState): ReactPlaybackSnapshot {
		const {
			currentTrack,
			isPlaying,
			playMode,
			currentLyrics,
			currentExtendedLyrics,
			audioElement,
			volume,
			playbackRate,
		} = state;

		const currentPath = currentTrack?.path;
		const trackId = currentPath ? getOrCreateTrackId(currentPath, this.plugin.settings) : null;
		const track = trackId ? this.plugin.settings.tracks[trackId] : undefined;

		const parsed = currentPath ? parseTrackFilename(currentPath) : null;
		const title = track?.title?.trim() || parsed?.title || (currentPath ? currentPath.split("/").pop() || "" : t("playback.noTrack"));
		const artistStr = (track?.artist ?? "").trim() || (parsed?.artist ?? "").trim();
		const artist = artistStr === "" ? t("meta.unknownArtist") : artistStr;
		const coverUrl = this.resolveTrackCoverUrl(currentTrack);

		const currentTime = audioElement?.currentTime ?? 0;
		const duration = audioElement?.duration ?? track?.duration ?? 0;

		const useExtendedLyrics = currentExtendedLyrics && currentExtendedLyrics.length > 0;
		
		const idx = calculateLyricsIndex({
			fullLyrics: currentLyrics,
			fullExtendedLyrics: currentExtendedLyrics,
			currentTime,
		});

		// Standard triplet lyric text
		const prevLyric = idx > 0 && !useExtendedLyrics ? currentLyrics[idx - 1]?.text ?? "" : "";
		const currentLyric = idx >= 0 && !useExtendedLyrics ? currentLyrics[idx]?.text ?? "" : "";
		const nextLyric = idx >= 0 && !useExtendedLyrics ? currentLyrics[idx + 1]?.text ?? "" : "";

		// Word-by-word extended triplet lyric data
		const prevExtendedLyric = idx > 0 && useExtendedLyrics ? currentExtendedLyrics[idx - 1] : undefined;
		const currentExtendedLyric = idx >= 0 && useExtendedLyrics ? currentExtendedLyrics[idx] : undefined;
		const nextExtendedLyric = idx >= 0 && useExtendedLyrics ? currentExtendedLyrics[idx + 1] : undefined;

		// Check favorite status
		const favoriteIds = new Set(this.plugin.settings.favorites || []);
		const isFavorite = trackId ? favoriteIds.has(trackId) : false;

		// Resolve prev/next covers for sliding animations
		let prevCoverUrl: string | undefined = state.pendingPrevCoverUrl;
		let nextCoverUrl: string | undefined = state.pendingNextCoverUrl;

		if (!prevCoverUrl || !nextCoverUrl) {
			if (currentTrack) {
				const { list } = this.listService.getCurrentPlaylistForTrack(
					currentTrack,
					state.currentList,
					state.trackList,
					state.favorites
				);

				if (list.length > 0) {
					const currentIdxInList = list.findIndex((f) => f.path === currentTrack.path);
					
					if (currentIdxInList >= 0) {
						if (!prevCoverUrl) {
							const prevIdxInList = currentIdxInList > 0 ? currentIdxInList - 1 : list.length - 1;
							const prevTrack = list[prevIdxInList];
							if (prevTrack) {
								prevCoverUrl = this.resolveTrackCoverUrl(prevTrack);
							}
						}

						if (!nextCoverUrl) {
							const nextIdxInList = currentIdxInList < list.length - 1 ? currentIdxInList + 1 : 0;
							const nextTrack = list[nextIdxInList];
							if (nextTrack) {
								nextCoverUrl = this.resolveTrackCoverUrl(nextTrack);
							}
						}
					}
				}
			}
		}

		return {
			title,
			artist,
			coverUrl,
			isPlaying,
			currentTime,
			duration,
			playMode,
			prevLyric,
			currentLyric,
			nextLyric,
			prevExtendedLyric,
			currentExtendedLyric,
			nextExtendedLyric,
			fullLyrics: currentLyrics,
			fullExtendedLyrics: currentExtendedLyrics,
			prevCoverUrl,
			nextCoverUrl,
			currentPath: currentPath || null,
			sectionId: state.currentSectionIdForPlaylist || null,
			volume: audioElement?.volume ?? volume ?? 1.0,
			playbackRate: audioElement?.playbackRate ?? playbackRate ?? 1.0,
			isFavorite,
			isShuffle: this.plugin.settings.isShuffle ?? false,
			rating: track?.rating ?? (trackId ? this.plugin.settings.ratings?.[trackId] : 0) ?? 0,
			artworkDisplayMode: this.plugin.settings.artworkDisplayMode ?? 'vinyl',
			turntableStyle: this.plugin.settings.turntableStyle ?? 'obsidian',
			dynamicAlbumTheme: this.plugin.settings.dynamicAlbumTheme ?? true,
			showVisualizer: this.plugin.settings.showVisualizer ?? true,
		};
	}

	/**
	 * Generates library snapshot.
	 */
	getLibrarySnapshot(
		trackList: TFile[],
		currentTrack: TFile | null,
		currentListId: string | null
	): ReactLibrarySnapshot {
		const validTrackList = trackList.filter((file): file is TFile => file != null);
		
		const mapToTrack = (file: TFile): ReactTrackInfo => {
			const trackId = getOrCreateTrackId(file.path, this.plugin.settings);
			const meta = this.plugin.settings.tracks[trackId];
			const parsed = parseTrackFilename(file.path);

			const artistStr = (meta?.artist ?? "").trim() || (parsed.artist ?? "").trim();
			const artist = artistStr === "" ? t("meta.unknownArtist") : artistStr;

			let album: string | undefined;
			if (meta?.album !== undefined && meta?.album !== null) {
				const bv = String(meta.album).trim();
				album = bv === "" ? (parsed.album || t("meta.unknownAlbum")) : bv;
			} else if (parsed.album) {
				album = parsed.album;
			}

			const title = meta?.title?.trim() || parsed.title || file.name;

			return {
				path: file.path,
				title,
				artist,
				album,
				coverUrl: this.resolveTrackCoverUrl(file),
				duration: meta?.duration,
				rating: meta?.rating ?? this.plugin.settings.ratings?.[trackId] ?? this.plugin.settings.ratings?.[file.path] ?? 0,
			};
		};

		const pathToIdMap = new Map<string, string>();
		validTrackList.forEach(file => {
			const trackId = getOrCreateTrackId(file.path, this.plugin.settings);
			pathToIdMap.set(file.path, trackId);
		});

		const favoritesSet = new Set(this.plugin.settings.favorites || []);
		const allTracks = validTrackList.map(mapToTrack);
		const favorites = validTrackList
			.filter((f) => {
				const trackId = pathToIdMap.get(f.path);
				return trackId && favoritesSet.has(trackId);
			})
			.map(mapToTrack);

		const playlistsData = Object.entries(this.plugin.settings.playlists || {}).map(([name, trackIds]) => {
			const playlistFiles = trackIds
				.map(id => {
					const path = getTrackPath(id, this.plugin.settings);
					return path ? validTrackList.find(f => f.path === path) : null;
				})
				.filter((file): file is TFile => file != null);
			const sortedTracks = sortTracksByTrack(playlistFiles, this.plugin.settings);
			return {
				name,
				tracks: sortedTracks.map(mapToTrack),
			};
		});
		const playlists = playlistsData.sort((a, b) => a.name.localeCompare(b.name, "en"));

		const artistsData = this.libraryService.getArtists(validTrackList);
		const artists = artistsData.map(({ name, tracks }) => ({
			name,
			tracks: tracks.map(mapToTrack),
		}));

		const albumsData = this.libraryService.getAlbums(validTrackList);
		const albums = albumsData.map(({ name, tracks }) => ({
			name,
			tracks: tracks.map(mapToTrack),
		}));

		return {
			allTracks,
			favorites,
			playlists,
			artists,
			albums,
			currentPath: currentTrack?.path || null,
			currentList: currentListId || "all",
		};
	}
}
