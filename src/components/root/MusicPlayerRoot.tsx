/**
 * Music player root component
 * 
 * Root component of the React application, responsible for:
 * - Tab switching (currentDisc / library)
 * - Page switching (disc / lyrics)
 * - Navigation bar rendering (via portal)
 * - Rendering corresponding page components based on Tab (PlayPage, LibraryPage)
 * 
 * Note: State management is handled through hooks, not manually managed in this component.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { Platform, TFile } from "obsidian";
import "./MusicPlayerRoot.css";
import { ConfirmModal, LibraryPage, NavigationBar, PlayPage } from "@/components";
import { t } from "@/utils/i18n/i18n";
import {
	useLibraryManagement,
	useLibraryState,
	useLyricsIndex,
	useNavigation,
	usePageState,
	usePlaybackControl,
	usePlaybackState,
	useTrackCovers,
} from "@/hooks";
import type { MusicPlayerView } from "@/views/MusicPlayerView";

export interface MusicPlayerRootProps {
	view: MusicPlayerView;
	navHost: HTMLElement;
}

export function MusicPlayerRoot({ view, navHost }: MusicPlayerRootProps) {
	// Manage state with hooks
	const { playback } = usePlaybackState(view);
	const { library, refreshSnapshot } = useLibraryState(view);

	// Navigation state management
	const navigation = useNavigation();
	const pageState = usePageState();

	// Encapsulate business logic with hooks
	const playbackControl = usePlaybackControl(view);
	const libraryManagement = useLibraryManagement(view);
	
	// Track rebuild status
	const [isRebuilding, setIsRebuilding] = React.useState(false);
	const isRebuildingRef = React.useRef(false);
	
	// Track whether library index needs rebuild
	const [needsRebuild, setNeedsRebuild] = React.useState(() => view.getNeedsRebuild());
	
	// Subscribe to library update events to synchronize needsRebuild state
	React.useEffect(() => {
		const updateNeedsRebuild = () => {
			setNeedsRebuild(view.getNeedsRebuild());
		};
		view.subscribeLibraryUpdates(updateNeedsRebuild);
		return () => {
			view.unsubscribeLibraryUpdates(updateNeedsRebuild);
		};
	}, [view]);
	
	// Wrap rebuildAllData, adding confirmation modal and status tracking
	const handleRebuild = React.useCallback(async () => {
		// If currently rebuilding, return immediately
		if (isRebuildingRef.current) return;

		const message = t("rebuild.body");

		const modal = new ConfirmModal(
			view.app,
			t("rebuild.title"),
			message
		);
		const confirmed = await modal.prompt();
		if (!confirmed) return;

		isRebuildingRef.current = true;
		setIsRebuilding(true);

		try {
			await libraryManagement.rebuildAllData();
		} finally {
			isRebuildingRef.current = false;
			setIsRebuilding(false);
		}
	}, [libraryManagement, view]);
	
	// Single click track in library: play track only, do not switch page
	const handlePlayWithClearAction = React.useCallback(
		(path: string, sectionId?: string) => {
			pageState.clearLastAction();
			void libraryManagement.handlePlay(path, sectionId);
		},
		[pageState, libraryManagement]
	);

	// Double click track in library: play and switch to disc page
	const handleDoubleClick = React.useCallback(
		(path: string, sectionId?: string) => {
			pageState.clearLastAction();
			// Switch to disc page first, then play asynchronously
			navigation.openDisc();
			void libraryManagement.handlePlay(path, sectionId);
		},
		[pageState, libraryManagement, navigation]
	);

	// Register playback action callbacks to let shortcuts set lastAction
	// Note: These callbacks only set lastAction; actual playback is performed in view.playPrevious/playNext
	React.useEffect(() => {
		const handlePrevCallback = () => {
			pageState.handlePrevWithFlag(() => {
				// No-op, actual playback is performed in view.playPrevious()
			});
		};
		const handleNextCallback = () => {
			pageState.handleNextWithFlag(() => {
				// No-op, actual playback is performed in view.playNext()
			});
		};
		const handleDirectPlayCallback = () => {
			// Clear lastAction to update cover directly without animation
			pageState.clearLastAction();
		};
		view.setPlaybackActionCallbacks(handlePrevCallback, handleNextCallback, handleDirectPlayCallback);
	}, [view, pageState]);

	// When switching to "library" tab, actively refresh track list & snapshot once to avoid stale data
	// Note: Search modal always calls refreshMusicList on open, keeping it fresh.
	React.useEffect(() => {
		if (navigation.tab !== "library") return;
		void (async () => {
			await view.refreshMusicList();
			refreshSnapshot();
		})();
	}, [navigation.tab, view, refreshSnapshot]);

	// Use hook to calculate lyrics index
	const playingIndex = useLyricsIndex({
		fullLyrics: playback.fullLyrics,
		fullExtendedLyrics: playback.fullExtendedLyrics,
		currentTime: playback.currentTime,
	});

	// Handle previous / next track (with lastAction flag)
	const handlePrevWithFlag = React.useCallback(() => {
		pageState.handlePrevWithFlag(() => {
			void playbackControl.playPrevious();
		});
	}, [pageState, playbackControl]);

	const handleNextWithFlag = React.useCallback(() => {
		pageState.handleNextWithFlag(() => {
			void playbackControl.playNext();
		});
	}, [pageState, playbackControl]);

	// Handle volume and playback rate changes
	const api = view.reactApi;
	const handleVolumeChange = React.useCallback(async (volume: number) => {
		await api.setVolume(volume);
	}, [api]);

	const handlePlaybackRateChange = React.useCallback(async (rate: number) => {
		await api.setPlaybackRate(rate);
	}, [api]);

	// Use Hook to manage cover loading
	const { finalCoverUrl, finalPrevCoverUrl, finalNextCoverUrl } = useTrackCovers({
		playback,
		view,
	});

	return (
		<>
			{createPortal(
				<NavigationBar
					activeTab={navigation.tab}
					currentPage={navigation.tab === "currentDisc" ? navigation.currentPage : undefined}
					onOpenLibrary={navigation.openLibrary}
					onOpenDisc={navigation.openDisc}
					onOpenLyrics={navigation.openLyrics}
					onRebuild={handleRebuild}
					onSearch={playbackControl.openSearchModal}
					onSettings={() => {
						void view.plugin.openSettings();
					}}
					isRebuilding={isRebuilding}
					needsRebuild={needsRebuild}
				/>,
				navHost
			)}

			{navigation.tab === "currentDisc" ? (
				<PlayPage
						viewMode={navigation.currentPage}
						onSwitchViewMode={
							navigation.currentPage === "disc" 
								? navigation.switchToLyrics 
								: navigation.switchToDisc
						}
						title={playback.title}
						artist={playback.artist}
						coverUrl={finalCoverUrl}
						isPlaying={playback.isPlaying}
						currentTime={playback.currentTime}
						duration={playback.duration}
						playMode={playback.playMode}
						prevLyric={playback.prevLyric}
						currentLyric={playback.currentLyric}
						nextLyric={playback.nextLyric}
						prevExtendedLyric={playback.prevExtendedLyric}
						currentExtendedLyric={playback.currentExtendedLyric}
						nextExtendedLyric={playback.nextExtendedLyric}
						lastAction={pageState.lastAction}
						fullLyrics={playback.fullLyrics}
						fullExtendedLyrics={playback.fullExtendedLyrics}
						playingIndex={playingIndex}
						isInitialMount={navigation.shouldMarkInitialLyricsMount}
						onInitialMountComplete={navigation.clearInitialLyricsMount}
						onPrev={handlePrevWithFlag}
						onNext={handleNextWithFlag}
						onTogglePlay={() => { void playbackControl.togglePlay(); }}
						onToggleMode={() => { void playbackControl.togglePlayMode(); }}
						onOpenPlaylist={() => { void playbackControl.openPlaylistSheet(); }}
						onSeek={playbackControl.seekToRatio}
						onSeekBackward={playbackControl.seekBackward}
						onSeekForward={playbackControl.seekForward}
						prevCoverUrl={finalPrevCoverUrl}
						nextCoverUrl={finalNextCoverUrl}
						currentPath={playback.currentPath}
						sectionId={playback.sectionId || undefined}
						isFavorite={playback.isFavorite}
						volume={playback.volume}
						playbackRate={playback.playbackRate}
						onAddToPlaylist={(path, sectionId) => { void libraryManagement.addToPlaylist(path, sectionId); }}
						onToggleFavorite={(path, sectionId) => { void libraryManagement.toggleFavorite(path, sectionId); }}
						onVolumeChange={(volume) => { void handleVolumeChange(volume); }}
						onPlaybackRateChange={(rate) => { void handlePlaybackRateChange(rate); }}
					/>
			) : null}

			{navigation.tab === "library" ? (
				<LibraryPage
					library={library}
					activePath={library.currentPath}
					currentList={library.currentList}
					onPlay={handlePlayWithClearAction}
					onDoubleClick={handleDoubleClick}
					onToggleFavorite={(path, sectionId) => { void libraryManagement.toggleFavorite(path, sectionId); }}
					onAddToPlaylist={(path, sectionId) => { void libraryManagement.addToPlaylist(path, sectionId); }}
					onRemoveFromPlaylist={(path, playlistName) => { void libraryManagement.removeFromPlaylist(path, playlistName); }}
					onCreatePlaylist={() => { void libraryManagement.createPlaylist(); }}
					onPlayCategory={(categoryType, categoryName, tracks) => { void libraryManagement.playCategory(categoryType, categoryName, tracks); }}
					onEditPlaylist={(playlistName) => { return libraryManagement.editPlaylistName(playlistName); }}
					onDeletePlaylist={(playlistName) => { return libraryManagement.deletePlaylist(playlistName); }}
					getTrackCover={async (file: TFile) => {
						// Mobile track list: skip embedded audio covers by default (performance); look for cover/same-name image in directory
						return await view.getTrackCoverAsync(file, { includeEmbedded: !Platform.isMobileApp });
					}}
					app={view.app}
				/>
			) : null}
		</>
	);
}

