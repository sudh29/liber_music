/**
 * Music library state management hook
 * 
 * Manages library state:
 * - All tracks
 * - Favorites
 * - Playlists
 * - Artists
 * - Albums
 * - Current list identifier
 * - Currently playing track path
 * 
 * Subscribes to library update events, refreshing automatically when external updates occur.
 */

import * as React from "react";
import type { ReactLibrarySnapshot } from "@/types";
import type { MusicPlayerView } from "@/views/MusicPlayerView";

/**
 * Return interface for useLibraryState hook
 */
export interface UseLibraryStateReturn {
	/** Current library snapshot */
	library: ReactLibrarySnapshot;
	/** Rebuilds all library data */
	rebuildAllData: () => Promise<void>;
	/** Manually refreshes library snapshot */
	refreshSnapshot: () => void;
}

/**
 * Music library state hook
 * 
 * @param view MusicPlayerView instance
 * @returns Library state and action handlers
 */
export function useLibraryState(view: MusicPlayerView): UseLibraryStateReturn {
	const [library, setLibrary] = React.useState<ReactLibrarySnapshot>(
		() => view.getReactLibrarySnapshot()
	);

	const refreshSnapshot = React.useCallback(() => {
		setLibrary(view.getReactLibrarySnapshot());
	}, [view]);

	React.useEffect(() => {
		const listener = () => {
			refreshSnapshot();
		};
		view.subscribeLibraryUpdates(listener);
		return () => {
			view.unsubscribeLibraryUpdates(listener);
		};
	}, [view, refreshSnapshot]);

	const rebuildAllData = React.useCallback(async () => {
		await view.rebuildAllData();
	}, [view]);

	return {
		library,
		rebuildAllData,
		refreshSnapshot,
	};
}
