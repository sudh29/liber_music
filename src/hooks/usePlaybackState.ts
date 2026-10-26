/**
 * Playback state management hook
 * 
 * Manages player playback state with real-time updates via requestAnimationFrame:
 * - Current track details (title, artist, cover, etc.)
 * - Playback progress (currentTime, duration)
 * - Play status (isPlaying)
 * - Playback mode (normal, repeat-all, repeat-one, shuffle)
 * - Lyric data (standard and word-by-word)
 * - Favorite status
 * 
 * Runs at 60fps (~16ms) to ensure smooth karaoke lyric animations.
 */

import * as React from "react";
import type { ReactPlaybackSnapshot } from "@/types";
import type { MusicPlayerView } from "@/views/MusicPlayerView";

/**
 * Return interface for usePlaybackState hook
 */
export interface UsePlaybackStateReturn {
	/** Active playback snapshot */
	playback: ReactPlaybackSnapshot;
}

/**
 * Playback state hook
 * 
 * @param view - MusicPlayerView instance
 * @returns Object containing active playback snapshot
 */
export function usePlaybackState(view: MusicPlayerView): UsePlaybackStateReturn {
	const [playback, setPlayback] = React.useState<ReactPlaybackSnapshot>(
		() => view.getReactPlaybackSnapshot()
	);

	// Poll snapshot at 60fps for smooth word-by-word lyric animations
	React.useEffect(() => {
		let rafId: number;
		let lastUpdateTime = 0;
		const updateInterval = 16;

		const updatePlayback = () => {
			const now = Date.now();
			if (now - lastUpdateTime >= updateInterval) {
				setPlayback(view.getReactPlaybackSnapshot());
				lastUpdateTime = now;
			}
			rafId = window.requestAnimationFrame(updatePlayback);
		};

		rafId = window.requestAnimationFrame(updatePlayback);
		return () => cancelAnimationFrame(rafId);
	}, [view]);

	return {
		playback,
	};
}
