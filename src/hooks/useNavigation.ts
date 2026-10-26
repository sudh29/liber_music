/**
 * Navigation state management hook
 * 
 * Manages tab switching and page transitions, simplifying MusicPlayerRoot.
 */

import * as React from "react";

export type TabType = "currentDisc" | "library";
export type PageType = "disc" | "lyrics";

export interface UseNavigationReturn {
	/** Currently active tab */
	tab: TabType;
	/** Currently active page (only applicable under currentDisc tab) */
	currentPage: PageType;
	/** Switches to library tab */
	openLibrary: () => void;
	/** Switches to currentDisc tab on disc page */
	openDisc: () => void;
	/** Switches to currentDisc tab on lyrics page */
	openLyrics: () => void;
	/** Switches to lyrics page within currentDisc tab */
	switchToLyrics: () => void;
	/** Switches to disc page within currentDisc tab */
	switchToDisc: () => void;
	/** Whether initial lyrics mount flag should be marked */
	shouldMarkInitialLyricsMount: boolean;
	/** Clears initial lyrics mount flag */
	clearInitialLyricsMount: () => void;
}

/**
 * Navigation state management hook
 * 
 * @returns Navigation state and action handlers
 */
export function useNavigation(): UseNavigationReturn {
	const [tab, setTab] = React.useState<TabType>("currentDisc");
	const [currentPage, setCurrentPage] = React.useState<PageType>("disc");
	const [pendingPage, setPendingPage] = React.useState<PageType | null>(null);
	const [shouldMarkInitialLyricsMount, setShouldMarkInitialLyricsMount] = React.useState(false);

	// Handle pending page transitions
	React.useEffect(() => {
		if (pendingPage && tab === "currentDisc") {
			setCurrentPage(pendingPage);
			if (pendingPage === "lyrics") {
				setShouldMarkInitialLyricsMount(true);
			}
			setPendingPage(null);
		}
	}, [pendingPage, tab]);

	const openLibrary = React.useCallback(() => {
		setTab("library");
	}, []);

	const openDisc = React.useCallback(() => {
		setTab("currentDisc");
		if (currentPage !== "disc") {
			setPendingPage("disc");
		}
	}, [currentPage]);

	const openLyrics = React.useCallback(() => {
		if (tab !== "currentDisc") {
			setPendingPage("lyrics");
			setTab("currentDisc");
		} else {
			setShouldMarkInitialLyricsMount(true);
			setCurrentPage("lyrics");
		}
	}, [tab]);

	const switchToLyrics = React.useCallback(() => {
		setShouldMarkInitialLyricsMount(true);
		setCurrentPage("lyrics");
	}, []);

	const switchToDisc = React.useCallback(() => {
		setCurrentPage("disc");
	}, []);

	const clearInitialLyricsMount = React.useCallback(() => {
		setShouldMarkInitialLyricsMount(false);
	}, []);

	return {
		tab,
		currentPage,
		openLibrary,
		openDisc,
		openLyrics,
		switchToLyrics,
		switchToDisc,
		shouldMarkInitialLyricsMount,
		clearInitialLyricsMount,
	};
}
