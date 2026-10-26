/**
 * State management service
 * 
 * Manages player states:
 * - Playback status (current track, isPlaying, playMode, etc.)
 * - Track list and lyric data
 * - Active playlist queue context
 */

import { TFile } from "obsidian";
import type { PlayMode } from "@/main";
import type { LyricLine } from "@/utils/lyrics/parser";
import type { ExtendedLyricLine } from "@/utils/lyrics/extendedParser";
import type { CurrentList } from "./ListService";

/**
 * Player state interface
 * 
 * Defines full state structure for music player.
 */
export interface PlayerState {
	/** Currently playing track */
	currentTrack: TFile | null;
	/** Current track index in trackList */
	currentIndex: number;
	/** Whether audio is currently playing */
	isPlaying: boolean;
	/** Playback mode (normal, repeat-all, repeat-one, shuffle) */
	playMode: PlayMode;
	/** Standard lyrics for current track */
	currentLyrics: LyricLine[];
	/** Word-by-word lyrics for current track */
	currentExtendedLyrics: ExtendedLyricLine[];
	/** Volume (0-1) */
	volume: number;
	/** Playback rate (0.25-4.0) */
	playbackRate: number;
	/** All music tracks */
	trackList: TFile[];
	/** Favorite tracks */
	favorites: TFile[];
	/** Playlist map (name -> track paths array) */
	playlistMap: Record<string, string[]>;
	/** Current list context */
	currentList: CurrentList | null;
	/** Current list identifier */
	currentListId: string | null;
	/** Current playlist section ID */
	currentSectionIdForPlaylist: string | null;
	/** Pending next track cover URL for transition animation */
	pendingNextCoverUrl?: string;
	/** Pending previous track cover URL for transition animation */
	pendingPrevCoverUrl?: string;
}

/**
 * State management service class
 * 
 * Manages music player states with get/set accessors.
 * Returns shallow state copies to preserve immutability.
 */
export class StateService {
	/** Internal state object */
	private state: PlayerState;

	/**
	 * Creates a state management service instance.
	 * 
	 * @param initialVolume - Initial volume (0-1) restored from settings
	 * @param initialPlaybackRate - Initial playback rate (0.25-4.0) restored from settings
	 */
	constructor(initialVolume = 1.0, initialPlaybackRate = 1.0) {
		this.state = {
			currentTrack: null,
			currentIndex: -1,
			isPlaying: false,
			playMode: "normal",
			currentLyrics: [],
			currentExtendedLyrics: [],
			volume: Math.max(0, Math.min(1, initialVolume)),
			playbackRate: Math.max(0.25, Math.min(4.0, initialPlaybackRate)),
			trackList: [],
			favorites: [],
			playlistMap: {},
			currentList: null,
			currentListId: "all",
			currentSectionIdForPlaylist: null,
			pendingNextCoverUrl: undefined,
			pendingPrevCoverUrl: undefined,
		};
	}

	/**
	 * Gets shallow copy of current state.
	 * 
	 * @returns Current state copy
	 */
	getState(): PlayerState {
		return { ...this.state };
	}

	/**
	 * Sets currently playing track.
	 * 
	 * @param track - Track file or null
	 * @param index - Index in track list
	 */
	setCurrentTrack(track: TFile | null, index: number) {
		this.state.currentTrack = track;
		this.state.currentIndex = index;
	}

	/**
	 * Sets playback status.
	 * 
	 * @param isPlaying - Whether audio is playing
	 */
	setIsPlaying(isPlaying: boolean) {
		this.state.isPlaying = isPlaying;
	}

	/**
	 * Sets playback mode.
	 * 
	 * @param playMode - Play mode
	 */
	setPlayMode(playMode: PlayMode) {
		this.state.playMode = playMode;
	}

	/**
	 * Sets lyric data.
	 * 
	 * @param lyrics - Standard lyrics array
	 * @param extendedLyrics - Word-by-word lyrics array
	 */
	setLyrics(lyrics: LyricLine[], extendedLyrics: ExtendedLyricLine[]) {
		this.state.currentLyrics = lyrics;
		this.state.currentExtendedLyrics = extendedLyrics;
	}

	/**
	 * Resets lyric data for current track.
	 */
	resetLyrics() {
		this.state.currentLyrics = [];
		this.state.currentExtendedLyrics = [];
	}

	/**
	 * Sets volume.
	 * 
	 * @param volume - Volume (0-1)
	 */
	setVolume(volume: number) {
		this.state.volume = volume;
	}

	/**
	 * Sets playback rate.
	 * 
	 * @param rate - Playback rate (0.25-4.0)
	 */
	setPlaybackRate(rate: number) {
		this.state.playbackRate = rate;
	}

	/**
	 * Sets track list.
	 * 
	 * @param trackList - All music tracks
	 */
	setTrackList(trackList: TFile[]) {
		this.state.trackList = trackList;
	}

	/**
	 * Sets favorites list.
	 * 
	 * @param favorites - Favorite tracks list
	 */
	setFavorites(favorites: TFile[]) {
		this.state.favorites = favorites;
	}

	/**
	 * Sets playlist map.
	 * 
	 * @param playlistMap - Playlist mapping object
	 */
	setPlaylistMap(playlistMap: Record<string, string[]>) {
		this.state.playlistMap = playlistMap;
	}

	/**
	 * Sets current list context.
	 * 
	 * @param list - Active list context or null
	 */
	setCurrentList(list: CurrentList | null) {
		this.state.currentList = list;
	}

	/**
	 * Sets current list identifier.
	 * 
	 * @param listId - List identifier string ("all", "favorites", "playlist:xxx")
	 */
	setCurrentListId(listId: string | null) {
		this.state.currentListId = listId;
	}

	/**
	 * Sets current playlist section ID.
	 * 
	 * @param sectionId - Section ID
	 */
	setCurrentSectionIdForPlaylist(sectionId: string | null) {
		this.state.currentSectionIdForPlaylist = sectionId;
	}

	/**
	 * Sets pending next cover URL for transition animations.
	 * 
	 * @param coverUrl - Cover URL or undefined to clear
	 */
	setPendingNextCoverUrl(coverUrl: string | undefined) {
		this.state.pendingNextCoverUrl = coverUrl;
	}

	/**
	 * Sets pending previous cover URL for transition animations.
	 * 
	 * @param coverUrl - Cover URL or undefined to clear
	 */
	setPendingPrevCoverUrl(coverUrl: string | undefined) {
		this.state.pendingPrevCoverUrl = coverUrl;
	}
}
