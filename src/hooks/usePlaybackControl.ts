/**
 * Playback control logic hook
 * 
 * Encapsulates playback control business logic for React components.
 * Memoized with useCallback to prevent redundant re-renders.
 * 
 * Capabilities:
 * - Play/pause toggling
 * - Previous/next track navigation
 * - Playback mode toggling
 * - Seek and skip controls
 * - Queue modal management
 * - Search modal invocation
 */

import * as React from "react";
import type { MusicPlayerView } from "@/views/MusicPlayerView";

/**
 * Return interface for usePlaybackControl hook
 */
export interface UsePlaybackControlReturn {
	/** Toggles play/pause state */
	togglePlay: () => Promise<void>;
	/** Plays previous track */
	playPrevious: () => Promise<void>;
	/** Plays next track */
	playNext: () => Promise<void>;
	/** Toggles play mode (normal, repeat-all, repeat-one) */
	togglePlayMode: () => Promise<void>;
	/** Toggles smart non-repeating shuffle */
	toggleShuffle: () => Promise<boolean>;
	/** Toggles artwork display mode ('vinyl' <-> 'card') */
	toggleArtworkDisplayMode: () => Promise<"vinyl" | "card">;
	/** Sets track rating */
	setRating: (path: string, rating: number) => Promise<void>;
	/** Seeks to position ratio (0 to 1) */
	seekToRatio: (ratio: number) => void;
	/** Fast-forwards audio by specified seconds */
	seekForward: (seconds: number) => void;
	/** Rewinds audio by specified seconds */
	seekBackward: (seconds: number) => void;
	/** Opens queue / playlist modal */
	openPlaylistSheet: () => Promise<void>;
	/** Opens search modal */
	openSearchModal: () => void;
}

/**
 * Playback control logic hook
 * 
 * @param view - MusicPlayerView instance
 * @returns Playback control action handlers
 */
export function usePlaybackControl(view: MusicPlayerView): UsePlaybackControlReturn {
	const togglePlay = React.useCallback(async () => {
		await view.togglePlay();
	}, [view]);

	const playPrevious = React.useCallback(async () => {
		await view.playPrevious();
	}, [view]);

	const playNext = React.useCallback(async () => {
		await view.playNext();
	}, [view]);

	const togglePlayMode = React.useCallback(async () => {
		await view.togglePlayMode();
	}, [view]);

	const toggleShuffle = React.useCallback(async () => {
		return view.toggleShuffle();
	}, [view]);

	const toggleArtworkDisplayMode = React.useCallback(async () => {
		return view.toggleArtworkDisplayMode();
	}, [view]);

	const setRating = React.useCallback(
		async (path: string, rating: number) => {
			await view.setRating(path, rating);
		},
		[view]
	);

	const seekToRatio = React.useCallback(
		(ratio: number) => {
			view.seekToRatio(ratio);
		},
		[view]
	);

	const seekForward = React.useCallback(
		(seconds: number) => {
			view.seekForward(seconds);
		},
		[view]
	);

	const seekBackward = React.useCallback(
		(seconds: number) => {
			view.seekBackward(seconds);
		},
		[view]
	);

	const openPlaylistSheet = React.useCallback(async () => {
		await view.openPlaylistSheet();
	}, [view]);

	const openSearchModal = React.useCallback(() => {
		view.openSearchModalPublic();
	}, [view]);

	return {
		togglePlay,
		playPrevious,
		playNext,
		togglePlayMode,
		toggleShuffle,
		toggleArtworkDisplayMode,
		setRating,
		seekToRatio,
		seekForward,
		seekBackward,
		openPlaylistSheet,
		openSearchModal,
	};
}
