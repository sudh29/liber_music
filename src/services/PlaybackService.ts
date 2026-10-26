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

import { TFile } from "obsidian";
import { StateService } from "./StateService";
import { AudioService } from "./AudioService";
import { LyricsService } from "./LyricsService";
import { type CurrentList, ListService } from "./ListService";
import { SnapshotService } from "./SnapshotService";
import { findTrackIndexInGlobalList, getNextIndex, getPreviousIndex, handleTrackEnd } from "@/utils/playback/control";
import { ANIMATION_TIMINGS } from "@/constants/ui";
import type MusicPlayerPlugin from "@/main";
import type { PlayMode } from "@/main";
import { t } from "@/utils/i18n/i18n";
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
		private callbacks: PlaybackCallbacks = {}
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

		const nextIdxInList = direction === "previous"
			? getPreviousIndex(currentIdxInList, list, playMode as PlayMode)
			: getNextIndex(currentIdxInList, list, playMode as PlayMode);
		
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

		if (delayPlay) {
			await new Promise(resolve =>
				window.setTimeout(resolve, ANIMATION_TIMINGS.DISC_ANIMATION_DURATION + ANIMATION_TIMINGS.DISC_ANIMATION_BUFFER)
			);
			
			if (direction === "prev") {
				this.stateService.setPendingPrevCoverUrl(undefined);
			} else if (direction === "next") {
				this.stateService.setPendingNextCoverUrl(undefined);
			}
		}

		const userVolume = state.volume ?? 1.0;
		const trackId = getOrCreateTrackId(track.path, this.plugin.settings);
		const trackInfo = this.plugin.settings.tracks[trackId];
		const effectiveVolume = applyReplayGainToVolume(userVolume, trackInfo?.replayGainDb);
		const savedPlaybackRate = this.audioService.getAudioElement()?.playbackRate ?? state.playbackRate ?? 1.0;
		
		await this.audioService.createAudioElement(track, effectiveVolume, savedPlaybackRate, {
			onTimeUpdate: this.callbacks.onProgressUpdate || (() => {}),
			onLoadedMetadata: this.callbacks.onDurationUpdate || (() => {}),
			onEnded: this.callbacks.onTrackEnd || (() => {}),
		});

		const { lyrics, extendedLyrics } = await this.lyricsService.loadLyricsAsync(track.path);
		this.stateService.setLyrics(lyrics, extendedLyrics);
		if (autoPlay) {
			if (requestId !== this.playRequestId) {
				return;
			}

			await this.audioService.play();
			this.stateService.setIsPlaying(true);
		} else {
			this.stateService.setIsPlaying(false);
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
		} else {
			const d = audioElement.duration;
			const t = audioElement.currentTime;
			if (Number.isFinite(d) && d > 0 && Number.isFinite(t) && (audioElement.ended || t >= d - 0.06)) {
				audioElement.currentTime = 0;
			}
			await this.audioService.play();
			this.stateService.setIsPlaying(true);
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

		const { shouldPlayNext, shouldRepeat, shouldStop } = handleTrackEnd(
			state.playMode,
			currentIdxInList,
			list
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
}
