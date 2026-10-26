/**
 * Track cover loader hook
 * 
 * Manages cover loading for current, previous, and next tracks.
 * Prioritizes directory cover files, falling back to embedded covers.
 */

import React from "react";
import type { MusicPlayerView } from "@/views/MusicPlayerView";
import type { ReactPlaybackSnapshot } from "@/types";

/**
 * Hook input parameters
 */
export interface UseTrackCoversParams {
	/** Playback state snapshot */
	playback: ReactPlaybackSnapshot;
	/** MusicPlayerView instance */
	view: MusicPlayerView;
}

/**
 * Hook return values
 */
export interface UseTrackCoversReturn {
	/** Active track cover URL (directory cover prioritized, then embedded) */
	finalCoverUrl: string | undefined;
	/** Previous track cover URL */
	finalPrevCoverUrl: string | undefined;
	/** Next track cover URL */
	finalNextCoverUrl: string | undefined;
}

/**
 * Track covers hook
 * 
 * @param params Hook parameters
 * @returns Hook return values
 */
export function useTrackCovers({
	playback,
	view,
}: UseTrackCoversParams): UseTrackCoversReturn {
	const [embeddedCoverUrl, setEmbeddedCoverUrl] = React.useState<string | undefined>(undefined);
	const [embeddedPrevCoverUrl, setEmbeddedPrevCoverUrl] = React.useState<string | undefined>(undefined);
	const [embeddedNextCoverUrl, setEmbeddedNextCoverUrl] = React.useState<string | undefined>(undefined);

	// Load active track embedded cover
	React.useEffect(() => {
		if (playback.coverUrl) {
			setEmbeddedCoverUrl(undefined);
			return;
		}

		if (playback.currentPath) {
			const currentTrack = view.state.trackList.find(t => t.path === playback.currentPath);
			if (currentTrack) {
				void view.getTrackCoverAsync(currentTrack).then(cover => {
					setEmbeddedCoverUrl(cover);
				});
			}
		} else {
			setEmbeddedCoverUrl(undefined);
		}
	}, [playback.coverUrl, playback.currentPath, view]);

	// Load previous track embedded cover
	React.useEffect(() => {
		if (playback.prevCoverUrl) {
			setEmbeddedPrevCoverUrl(undefined);
			return;
		}

		if (playback.currentPath && view.state.trackList.length > 0) {
			const currentIndex = view.state.trackList.findIndex(t => t.path === playback.currentPath);
			if (currentIndex >= 0) {
				const prevIndex = currentIndex > 0 ? currentIndex - 1 : view.state.trackList.length - 1;
				const prevTrack = view.state.trackList[prevIndex];
				if (prevTrack) {
					void view.getTrackCoverAsync(prevTrack).then(cover => {
						setEmbeddedPrevCoverUrl(cover);
					});
				}
			}
		} else {
			setEmbeddedPrevCoverUrl(undefined);
		}
	}, [playback.prevCoverUrl, playback.currentPath, view]);

	// Load next track embedded cover
	React.useEffect(() => {
		if (playback.nextCoverUrl) {
			setEmbeddedNextCoverUrl(undefined);
			return;
		}

		if (playback.currentPath && view.state.trackList.length > 0) {
			const currentIndex = view.state.trackList.findIndex(t => t.path === playback.currentPath);
			if (currentIndex >= 0) {
				const nextIndex = currentIndex < view.state.trackList.length - 1 ? currentIndex + 1 : 0;
				const nextTrack = view.state.trackList[nextIndex];
				if (nextTrack) {
					void view.getTrackCoverAsync(nextTrack).then(cover => {
						setEmbeddedNextCoverUrl(cover);
					});
				}
			}
		} else {
			setEmbeddedNextCoverUrl(undefined);
		}
	}, [playback.nextCoverUrl, playback.currentPath, view]);

	const finalCoverUrl = playback.coverUrl || embeddedCoverUrl;
	const finalPrevCoverUrl = playback.prevCoverUrl || embeddedPrevCoverUrl;
	const finalNextCoverUrl = playback.nextCoverUrl || embeddedNextCoverUrl;

	return {
		finalCoverUrl,
		finalPrevCoverUrl,
		finalNextCoverUrl,
	};
}
