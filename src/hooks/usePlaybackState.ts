/**
 * Playback state management hook
 * 
 * Manages player playback state with real-time updates:
 * - Current track details (title, artist, cover, etc.)
 * - Playback progress (currentTime, duration)
 * - Play status (isPlaying)
 * - Playback mode (normal, repeat-all, repeat-one, shuffle)
 * - Lyric data (standard and word-by-word)
 * - Favorite status
 * 
 * Runs at 60fps (~16ms) only when audio is actively playing, the active tab is currentDisc,
 * and the window is visible. Otherwise throttles down to conserve CPU and battery.
 */

import * as React from "react";
import type { ReactPlaybackSnapshot } from "@/types";
import type { MusicPlayerView } from "@/views/MusicPlayerView";

/**
 * Options for usePlaybackState hook
 */
export interface UsePlaybackStateOptions {
	/** Active tab from navigation. When "library", updates are throttled. */
	activeTab?: "currentDisc" | "library";
}

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
 * @param options - Hook configuration options
 * @returns Object containing active playback snapshot
 */
export function usePlaybackState(
	view: MusicPlayerView,
	options?: UsePlaybackStateOptions
): UsePlaybackStateReturn {
	const [playback, setPlayback] = React.useState<ReactPlaybackSnapshot>(
		() => view.getReactPlaybackSnapshot()
	);

	const activeTab = options?.activeTab ?? "currentDisc";

	React.useEffect(() => {
		let rafId: number | null = null;
		let timeoutId: number | null = null;
		let lastUpdateTime = 0;
		let isDestroyed = false;

		const syncSnapshot = () => {
			if (isDestroyed) return;
			setPlayback(view.getReactPlaybackSnapshot());
			lastUpdateTime = Date.now();
		};

		const scheduleNext = () => {
			if (isDestroyed) return;

			const isHidden = typeof document !== "undefined" && document.hidden;
			const isPlaying = view.state?.isPlaying ?? false;
			const highFrequency = isPlaying && !isHidden && activeTab === "currentDisc";

			if (highFrequency) {
				rafId = window.requestAnimationFrame(() => {
					const now = Date.now();
					// Throttle snapshot sync to 200ms during active playback to eliminate 60fps root re-render storms
					if (now - lastUpdateTime >= 200) {
						syncSnapshot();
					}
					scheduleNext();
				});
			} else {
				// Throttled: 500ms when playing in background/library, 1000ms when paused
				const interval = isPlaying ? 500 : 1000;
				timeoutId = window.setTimeout(() => {
					syncSnapshot();
					scheduleNext();
				}, interval);
			}
		};

		const handleVisibilityChange = () => {
			if (typeof document !== "undefined" && !document.hidden) {
				syncSnapshot();
			}
			if (rafId !== null) window.cancelAnimationFrame(rafId);
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			scheduleNext();
		};

		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", handleVisibilityChange);
		}

		// Attach listeners to audioElement for immediate UI response on state changes
		const audioEl = view.audioElement;
		const handleAudioEvent = () => {
			syncSnapshot();
			if (rafId !== null) window.cancelAnimationFrame(rafId);
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			scheduleNext();
		};

		if (audioEl) {
			audioEl.addEventListener("play", handleAudioEvent);
			audioEl.addEventListener("pause", handleAudioEvent);
			audioEl.addEventListener("seeked", handleAudioEvent);
		}

		scheduleNext();

		return () => {
			isDestroyed = true;
			if (rafId !== null) window.cancelAnimationFrame(rafId);
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			if (typeof document !== "undefined") {
				document.removeEventListener("visibilitychange", handleVisibilityChange);
			}
			if (audioEl) {
				audioEl.removeEventListener("play", handleAudioEvent);
				audioEl.removeEventListener("pause", handleAudioEvent);
				audioEl.removeEventListener("seeked", handleAudioEvent);
			}
		};
	}, [view, activeTab]);

	return {
		playback,
	};
}
