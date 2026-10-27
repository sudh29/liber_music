/**
 * Playback service
 * 
 * Orchestrates playback workflows by coordinating multiple services:
 * - Playing track by index (playTrack)
 * - Playing track by path (playByPath)
 * - Playing category (playCategory)
 * - Previous/next track navigation (playPrevious/playNext)
 * - Toggling play/pause (togglePlay)
 * - Handling track completion (handleTrackEnd)
 * - Restoring last played track (restoreLastPlayedTrack)
 */

import { Notice, Platform, TFile } from "obsidian";
import { StateService } from "./StateService";
import { AudioService } from "./AudioService";
import { LyricsService } from "./LyricsService";
import { type CurrentList, ListService } from "./ListService";
import { SnapshotService } from "./SnapshotService";
import { MediaSessionService } from "./MediaSessionService";
import { WakeLockService } from "./WakeLockService";
import { findTrackIndexInGlobalList, getNextIndex, getPreviousIndex, handleTrackEnd } from "@/utils/playback/control";
import { ShuffleManager } from "@/utils/playback/shuffle";
import { ANIMATION_TIMINGS } from "@/constants/ui";
import type MusicPlayerPlugin from "@/main";
import type { PlayMode } from "@/main";
import { t, tWithParams } from "@/utils/i18n/i18n";
import { applyReplayGainToVolume } from "@/utils/audio/metadata";
import { getOrCreateTrackId } from "@/utils/track/id";

/**
 * Playback service callbacks interface
 * 
 * Defines callback hooks triggered during playback lifecycle.
 */
export interface PlaybackCallbacks {
	/** Callback on library update */
	onLibraryUpdated?: () => Promise<void>;
	/** Callback on progress update */
	onProgressUpdate?: () => void;
	/** Callback on duration/metadata update */
	onDurationUpdate?: () => void;
	/** Callback when track ends */
	onTrackEnd?: () => void;
	/** Callback when music list refresh is required */
	onRefreshMusicList?: () => void;
}

/**
 * Playback service class
 * 
 * Orchestrates state management, audio playback, and lyric loading.
 */
export class PlaybackService {
	/**
	 * Playback request ID (auto-incrementing)
	 * 
	 * Implements "latest request supersedes":
	 * - Incremented at the start of each play workflow
	 * - Checked before asynchronous phases
	 * - Aborts stale requests when newer requests arrive, avoiding multiple concurrent Audio instances
	 */
	private playRequestId = 0;

	/**
	 * Deduplicates redundant handleTrackEnd triggers from both ended and seeked events
	 */
	private lastHandleTrackEndAt = 0;

	/**
	 * Smart non-repeating shuffle manager
	 */
	private shuffleManager = new ShuffleManager();

	/**
	 * Creates a playback service instance.
	 * 
	 * @param plugin - Plugin instance
	 * @param stateService - State management service
	 * @param audioService - Audio element service
	 * @param lyricsService - Lyrics parsing service
	 * @param listService - Playlist and queue service
	 * @param snapshotService - Snapshot service (for cover resolution)
	 * @param callbacks - Playback callbacks collection
	 */
	constructor(
		private plugin: MusicPlayerPlugin,
		private stateService: StateService,
		private audioService: AudioService,
		private lyricsService: LyricsService,
		private listService: ListService,
		private snapshotService: SnapshotService,
		private callbacks: PlaybackCallbacks = {},
		private mediaSessionService?: MediaSessionService,
		private wakeLockService?: WakeLockService
	) {}

	/**
	 * Computes the previous or next track based on active list and play mode.
	 * 
	 * @param currentTrack - Current track
	 * @param currentList - Current list context
	 * @param trackList - All tracks
	 * @param favorites - Favorites list
	 * @param playMode - Play mode (normal, repeat-all, repeat-one, shuffle)
	 * @param direction - Navigation direction ("previous" | "next")
	 * @returns Object with global index and target file, or null if unresolvable
	 */
	private calculateNextTrack(
		currentTrack: TFile | null,
		currentList: CurrentList | null,
		trackList: TFile[],
		favorites: TFile[],
		playMode: string,
		direction: "previous" | "next"
	): { globalIndex: number; target: TFile } | null {
		const { list } = this.listService.getCurrentPlaylistForTrack(
			currentTrack,
			currentList,
			trackList,
			favorites
		);
		if (!list.length || !currentTrack) return null;

		const currentIdxInList = list.findIndex((f) => f.path === currentTrack.path);
		if (currentIdxInList === -1) return null;

		const isShuffle = this.plugin.settings?.isShuffle ?? false;
		const nextIdxInList = direction === "previous"
			? getPreviousIndex(currentIdxInList, list, playMode as PlayMode, isShuffle, this.shuffleManager)
			: getNextIndex(currentIdxInList, list, playMode as PlayMode, isShuffle, this.shuffleManager);
		
		const target = list[nextIdxInList];
		if (!target) {
			return null;
		}
		const globalIdx = findTrackIndexInGlobalList(target, trackList);
		if (globalIdx === -1) return null;

		return { globalIndex: globalIdx, target };
	}

	/**
	 * Preloads cover image.
	 * 
	 * @param coverUrl - Cover image URL
	 * @returns Promise that settles when image loads or times out
	 */
	private preloadCover(coverUrl: string | undefined): Promise<void> {
		return new Promise((resolve) => {
			if (!coverUrl) {
				resolve();
				return;
			}

			const img = new Image();
			
			// Set 2s timeout to avoid blocking animations
			const timeout = window.setTimeout(() => {
				resolve();
			}, 2000);

			img.onload = () => {
				window.clearTimeout(timeout);
				resolve();
			};
			img.onerror = () => {
				window.clearTimeout(timeout);
				resolve();
			};
			
			img.src = coverUrl;
			
			if (img.complete) {
				window.clearTimeout(timeout);
				resolve();
			}
		});
	}

	/**
	 * Plays track at specified index in trackList.
	 * 
	 * Full workflow:
	 * 1. Validate index bounds
	 * 2. Update current track and index (triggers AlbumDisc slide animation)
	 * 3. Reset lyrics
	 * 4. Compute and set current list ID
	 * 5. Refresh music list
	 * 6. Notify library update
	 * 7. If delayPlay is true, preload cover and wait for disc animation to settle
	 * 8. Create Audio element and attach listeners
	 * 9. Load lyrics
	 * 10. Start playback (if autoPlay is true)
	 * 11. Update playback state
	 * 
	 * @param index - Track index in trackList
	 * @param delayPlay - Whether to delay play until cover loads and animation completes (default: false)
	 * @param targetTrack - Optional target track from active queue
	 * @param direction - Optional direction ("prev" | "next") for temporary cover clearing
	 * @param autoPlay - Whether to automatically start playback (default: true)
	 * @param skipLibraryUpdate - Whether to skip synchronous wait for library update (for fast direct clicks)
	 */
	async playTrack(
		index: number,
		delayPlay: boolean = false,
		targetTrack?: TFile,
		direction?: "prev" | "next",
		autoPlay: boolean = true,
		skipLibraryUpdate: boolean = false
	): Promise<void> {
		const requestId = ++this.playRequestId;

		const state = this.stateService.getState();
		if (index < 0 || index >= state.trackList.length) return;
		
		const track = targetTrack || state.trackList[index];
		if (!track) {
			return;
		}
		
		if (delayPlay) {
			const coverUrl = await this.snapshotService.getTrackCoverAsync(track);
			if (requestId !== this.playRequestId) {
				return;
			}
			await this.preloadCover(coverUrl);
		}
		
		this.stateService.setCurrentTrack(track, index);
		this.stateService.resetLyrics();

		const currentListStr = this.listService.calculateCurrentListId(
			track,
			state.currentList,
			state.trackList,
			state.favorites
		);
		this.stateService.setCurrentListId(currentListStr);
		
		if (this.callbacks.onRefreshMusicList) {
			this.callbacks.onRefreshMusicList();
		}

		if (this.callbacks.onLibraryUpdated) {
			if (skipLibraryUpdate) {
				void this.callbacks.onLibraryUpdated();
			} else {
				await this.callbacks.onLibraryUpdated();
			}
		}

		if (requestId !== this.playRequestId) {
			return;
		}

		const { list: activeList } = this.listService.getCurrentPlaylistForTrack(
			track,
			state.currentList,
			state.trackList,
			state.favorites
		);
		const trackIdxInList = activeList.findIndex((f) => f.path === track.path);
		if (trackIdxInList !== -1) {
			this.shuffleManager.onTrackSelected(trackIdxInList, activeList.length);
		}

		if (delayPlay) {
			window.setTimeout(() => {
				if (direction === "prev") {
					this.stateService.setPendingPrevCoverUrl(undefined);
				} else if (direction === "next") {
					this.stateService.setPendingNextCoverUrl(undefined);
				}
			}, ANIMATION_TIMINGS.DISC_ANIMATION_DURATION + ANIMATION_TIMINGS.DISC_ANIMATION_BUFFER);
		}

		const userVolume = state.volume ?? 1.0;
		const trackId = getOrCreateTrackId(track.path, this.plugin.settings);
		const trackInfo = this.plugin.settings.tracks[trackId];
		const effectiveVolume = applyReplayGainToVolume(userVolume, trackInfo?.replayGainDb);
		const savedPlaybackRate = this.audioService.getAudioElement()?.playbackRate ?? state.playbackRate ?? 1.0;
		
		await this.audioService.createAudioElement(track, effectiveVolume, savedPlaybackRate, {
			onTimeUpdate: () => {
				this.callbacks.onProgressUpdate?.();
				const el = this.audioService.getAudioElement();
				if (el && Number.isFinite(el.duration) && el.duration > 0) {
					this.mediaSessionService?.updatePositionState(el.duration, el.currentTime, el.playbackRate);
				}
			},
			onLoadedMetadata: () => {
				this.callbacks.onDurationUpdate?.();
				const el = this.audioService.getAudioElement();
				if (el && Number.isFinite(el.duration) && el.duration > 0) {
					this.mediaSessionService?.updatePositionState(el.duration, el.currentTime, el.playbackRate);
				}
			},
			onEnded: () => {
				this.callbacks.onTrackEnd?.();
			},
			onError: (err) => {
				this.handlePlaybackError(err, track);
			},
		});

		const { lyrics, extendedLyrics } = await this.lyricsService.loadLyricsAsync(track.path);
		this.stateService.setLyrics(lyrics, extendedLyrics);

		// Sync OS media notification & lock-screen widgets
		void this.snapshotService.getTrackCoverAsync(track).then((coverUrl) => {
			if (requestId === this.playRequestId) {
				this.mediaSessionService?.updateMetadata(track, trackInfo, coverUrl);
			}
		});

		if (autoPlay) {
			if (requestId !== this.playRequestId) {
				return;
			}

			try {
				await this.audioService.play();
				this.stateService.setIsPlaying(true);
				this.mediaSessionService?.updatePlaybackState(true);
				this.wakeLockService?.onPlaybackStateChange(true);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				this.handlePlaybackError(null, track);
			}
		} else {
			this.stateService.setIsPlaying(false);
			this.mediaSessionService?.updatePlaybackState(false);
			this.wakeLockService?.onPlaybackStateChange(false);
		}
	}

	/**
	 * Plays track by vault file path.
	 * 
	 * @param path - Track path
	 * @param delayPlay - Whether to delay play until cover loads and animation completes (default: true)
	 * @param skipLibraryUpdate - Whether to skip synchronous wait for library update
	 * @returns True if found and played, false otherwise
	 */
	async playByPath(path: string, delayPlay: boolean = true, skipLibraryUpdate: boolean = false): Promise<boolean> {
		const state = this.stateService.getState();
		const idx = state.trackList.findIndex((f) => f.path === path);
		if (idx !== -1) {
			await this.playTrack(idx, delayPlay, undefined, undefined, true, skipLibraryUpdate);
			return true;
		}
		return false;
	}

	/**
	 * Plays category collection (artist, album, playlist).
	 * 
	 * @param categoryType - Category type ("artist", "album", "playlist")
	 * @param categoryName - Category name
	 * @param tracks - Category tracks list
	 */
	async playCategory(categoryType: string, categoryName: string, tracks: TFile[]): Promise<void> {
		if (tracks.length === 0) return;
		const firstTrack = tracks[0];
		if (!firstTrack) return;
		const state = this.stateService.getState();
		this.stateService.setCurrentList({ type: categoryType, name: categoryName, tracks });
		this.stateService.setCurrentListId(this.listService.formatCurrentList(categoryType, categoryName));
		
		const idx = state.trackList.findIndex((f) => f.path === firstTrack.path);
		if (idx !== -1) await this.playTrack(idx);
	}

	/**
	 * Plays previous track in queue.
	 */
	async playPrevious(): Promise<void> {
		const state = this.stateService.getState();
		const result = this.calculateNextTrack(
			state.currentTrack,
			state.currentList,
			state.trackList,
			state.favorites,
			state.playMode,
			"previous"
		);
		if (!result) return;
		
		const coverUrl = await this.snapshotService.getTrackCoverAsync(result.target);
		await this.preloadCover(coverUrl);
		
		this.stateService.setPendingPrevCoverUrl(coverUrl);
		await this.playTrack(result.globalIndex, true, result.target, "prev");
	}

	/**
	 * Plays next track in queue.
	 */
	async playNext(): Promise<void> {
		const state = this.stateService.getState();
		const result = this.calculateNextTrack(
			state.currentTrack,
			state.currentList,
			state.trackList,
			state.favorites,
			state.playMode,
			"next"
		);
		if (!result) return;
		
		const coverUrl = await this.snapshotService.getTrackCoverAsync(result.target);
		await this.preloadCover(coverUrl);
		
		this.stateService.setPendingNextCoverUrl(coverUrl);
		await this.playTrack(result.globalIndex, true, result.target, "next");
	}

	/**
	 * Toggles playback between play and pause.
	 */
	async togglePlay(): Promise<void> {
		const state = this.stateService.getState();
		const audioElement = this.audioService.getAudioElement();
		
		if (!audioElement || !state.currentTrack) {
			if (state.trackList.length > 0) await this.playTrack(0);
			return;
		}
		
		if (state.isPlaying) {
			this.audioService.pause();
			this.stateService.setIsPlaying(false);
			this.mediaSessionService?.updatePlaybackState(false);
			this.wakeLockService?.onPlaybackStateChange(false);
		} else {
			const d = audioElement.duration;
			const t = audioElement.currentTime;
			if (Number.isFinite(d) && d > 0 && Number.isFinite(t) && (audioElement.ended || t >= d - 0.06)) {
				audioElement.currentTime = 0;
			}
			try {
				await this.audioService.play();
				this.stateService.setIsPlaying(true);
				this.mediaSessionService?.updatePlaybackState(true);
				this.wakeLockService?.onPlaybackStateChange(true);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				if (state.currentTrack) {
					this.handlePlaybackError(null, state.currentTrack);
				}
			}
		}
	}

	/**
	 * Handles track end event from audio player.
	 */
	handleTrackEnd(): void {
		const now = Date.now();
		if (now - this.lastHandleTrackEndAt < 450) return;
		this.lastHandleTrackEndAt = now;

		const state = this.stateService.getState();
		const { list } = this.listService.getCurrentPlaylistForTrack(
			state.currentTrack,
			state.currentList,
			state.trackList,
			state.favorites
		);
		
		const currentIdxInList = state.currentTrack
			? list.findIndex((f) => f.path === state.currentTrack!.path)
			: -1;

		const isShuffle = this.plugin.settings?.isShuffle ?? false;
		const { shouldPlayNext, shouldRepeat, shouldStop } = handleTrackEnd(
			state.playMode,
			currentIdxInList,
			list,
			isShuffle,
			this.shuffleManager
		);

		const audioElement = this.audioService.getAudioElement();
		if (shouldRepeat && audioElement) {
			audioElement.currentTime = 0;
			void this.audioService.play().catch((error) => {
				if (error instanceof DOMException && error.name === 'AbortError') {
					console.debug('Repeat play interrupted (likely caused by track change):', error.message);
				} else {
					console.error('Error during repeat play:', error);
				}
			});
		} else if (shouldPlayNext) {
			void this.playNext();
		} else if (shouldStop) {
			this.stateService.setIsPlaying(false);
			this.mediaSessionService?.updatePlaybackState(false);
			this.wakeLockService?.onPlaybackStateChange(false);
		}
	}

	/**
	 * Restores last played track from settings.
	 * 
	 * @param autoPlay - Whether to automatically start playback (default: true)
	 */
	async restoreLastPlayedTrack(autoPlay: boolean = true): Promise<void> {
		const state = this.stateService.getState();
		if (!state.trackList.length) return;
		this.stateService.setCurrentList({ type: "all", name: t("list.all"), tracks: state.trackList });
		this.stateService.setCurrentListId("all");

		let index = 0;
		const path = (this.plugin.settings.autoPlayOpenTrackPath ?? "").trim();
		if (path) {
			const found = state.trackList.findIndex((f) => f.path === path);
			if (found >= 0) {
				index = found;
			}
		}

		await this.playTrack(index, false, undefined, undefined, autoPlay);
	}

	/**
	 * Toggles non-repeating shuffle state.
	 *
	 * @returns New shuffle state boolean
	 */
	async toggleShuffle(): Promise<boolean> {
		const current = this.plugin.settings?.isShuffle ?? false;
		const next = !current;
		this.plugin.settings.isShuffle = next;
		await this.plugin.saveSettings();
		if (next) {
			const state = this.stateService.getState();
			const { list } = this.listService.getCurrentPlaylistForTrack(
				state.currentTrack,
				state.currentList,
				state.trackList,
				state.favorites
			);
			const currentIdx = state.currentTrack ? list.findIndex((f) => f.path === state.currentTrack?.path) : -1;
			this.shuffleManager.initialize(list.length, currentIdx >= 0 ? currentIdx : -1);
		}
		if (this.callbacks.onLibraryUpdated) {
			void this.callbacks.onLibraryUpdated();
		}
		return next;
	}

	/**
	 * Toggles artwork display mode between 'vinyl' and 'card'.
	 *
	 * @returns New artwork display mode
	 */
	async toggleArtworkDisplayMode(): Promise<"vinyl" | "card"> {
		const current = this.plugin.settings?.artworkDisplayMode ?? "vinyl";
		const next = current === "vinyl" ? "card" : "vinyl";
		this.plugin.settings.artworkDisplayMode = next;
		await this.plugin.saveSettings();
		if (this.callbacks.onLibraryUpdated) {
			void this.callbacks.onLibraryUpdated();
		}
		return next;
	}

	/**
	 * Sets track rating (0 to 5) and persists to settings.
	 *
	 * @param trackPath - Path of the track
	 * @param rating - Rating between 0 and 5
	 */
	async setTrackRating(trackPath: string, rating: number): Promise<void> {
		const clampedRating = Math.max(0, Math.min(5, Math.round(rating)));
		if (!this.plugin.settings.ratings) {
			this.plugin.settings.ratings = {};
		}
		if (clampedRating === 0) {
			delete this.plugin.settings.ratings[trackPath];
		} else {
			this.plugin.settings.ratings[trackPath] = clampedRating;
		}

		// Also update track info if exists
		const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
		if (this.plugin.settings.tracks[trackId]) {
			this.plugin.settings.tracks[trackId].rating = clampedRating;
		}

		await this.plugin.saveSettings();
		if (this.callbacks.onLibraryUpdated) {
			void this.callbacks.onLibraryUpdated();
		}
	}

	/**
	 * Seeks audio to specific time in seconds and syncs MediaSession.
	 *
	 * @param seconds Target time in seconds
	 */
	seekToTime(seconds: number): void {
		const el = this.audioService.getAudioElement();
		if (!el) return;
		const d = el.duration;
		if (!Number.isFinite(d) || d <= 0) return;
		const target = Math.max(0, Math.min(seconds, d));
		el.currentTime = target;
		this.mediaSessionService?.updatePositionState(d, target, el.playbackRate);
	}

	/**
	 * Handles audio playback or decode failure gracefully.
	 * 
	 * Alerts user to iPadOS WebKit OGG incompatibility or decode failures and auto-advances.
	 *
	 * @param error MediaError object or null
	 * @param track Audio file that failed
	 */
	private handlePlaybackError(error: MediaError | null, track: TFile): void {
		console.error(`Playback failure on ${track.path}:`, error);
		const ext = track.extension?.toLowerCase();
		const isIosOrSafari = Platform.isIosApp || Platform.isSafari;

		if (ext === "ogg" && isIosOrSafari) {
			new Notice(t("notice.unsupportedFormatOggIos"), 6000);
		} else {
			new Notice(tWithParams("notice.playbackError", { name: track.basename }), 4000);
		}

		this.stateService.setIsPlaying(false);
		this.mediaSessionService?.updatePlaybackState(false);
		this.wakeLockService?.onPlaybackStateChange(false);

		// Auto advance to next track after a brief moment
		window.setTimeout(() => {
			void this.playNext();
		}, 800);
	}
}

