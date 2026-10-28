/**
 * Track list component
 * 
 * Displays list of tracks, supporting:
 * - Cover image display (lazy loaded, only visible tracks)
 * - Track information display (title, artist, album, rating)
 * - Active track highlight
 * - Track actions (play, favorite, add to playlist, remove from playlist, edit tags)
 * - Virtualized windowing for 5,000+ tracks to eliminate DOM bloat
 * - Component-level memoization to eliminate render churn
 */

import React from "react";
import { App, TFile } from "obsidian";
import type { ReactLibrarySnapshot, ReactTrackInfo } from "@/types";
import { PlayingIndicator } from "@/components/player/PlayingIndicator";
import { IconButton } from "@/components/shared/IconButton";
import { useLazyTrackCovers } from "@/hooks/useLazyTrackCovers";
import "./LibraryPage.css";
import { t } from "@/utils/i18n/i18n";

/**
 * Props interface for TrackList component
 */
export interface TrackListProps {
	/** Track list to display */
	tracks: ReactTrackInfo[];
	/** Currently playing track path */
	activePath: string | null;
	/** List section ID (used to match currentList) */
	sectionId: string;
	/** Current playing list identifier */
	currentList?: string;
	/** Callback function to play track */
	onPlay: (path: string, sectionId?: string) => void;
	/** Callback function on double click (play and switch to disc view) */
	onDoubleClick?: (path: string, sectionId?: string) => void;
	/** Callback function to toggle favorite status */
	onToggleFavorite: (path: string, sectionId?: string) => void;
	/** Callback function to add track to playlist */
	onAddToPlaylist: (path: string, sectionId?: string) => void;
	/** Callback function to remove track from playlist (optional) */
	onRemoveFromPlaylist?: (path: string, playlistName: string) => void;
	/** Playlist name (used for removing from playlist) */
	playlistName?: string;
	/** Music library snapshot data */
	library: ReactLibrarySnapshot;
	/** Async function to fetch track cover (folder cover preferred, embedded cover secondary) */
	getTrackCover?: (file: TFile) => Promise<string | undefined>;
	/** Obsidian App instance */
	app?: App;
	/** Callback function to open in-app metadata editor */
	onOpenMetadataEditor?: (path: string) => void;
}

interface TrackItemRowProps {
	track: ReactTrackInfo;
	isActive: boolean;
	isFavorite: boolean;
	coverUrl?: string;
	trackRef?: React.RefObject<HTMLDivElement>;
	sectionId: string;
	playlistName?: string;
	onClick: (e: React.MouseEvent<HTMLDivElement>, path: string) => void;
	onDoubleClick: (e: React.MouseEvent<HTMLDivElement>, path: string) => void;
	onAddToPlaylist: (path: string, sectionId?: string) => void;
	onToggleFavorite: (path: string, sectionId?: string) => void;
	onOpenMetadataEditor?: (path: string) => void;
	onRemoveFromPlaylist?: (path: string, playlistName: string) => void;
}

/**
 * Memoized single track item row to prevent re-rendering unaffected tracks on state changes.
 */
const TrackItemRow = React.memo(function TrackItemRow({
	track,
	isActive,
	isFavorite,
	coverUrl,
	trackRef,
	sectionId,
	playlistName,
	onClick,
	onDoubleClick,
	onAddToPlaylist,
	onToggleFavorite,
	onOpenMetadataEditor,
	onRemoveFromPlaylist,
}: TrackItemRowProps) {
	return (
		<div
			ref={trackRef}
			data-track-path={track.path}
			className={`track-item ${isActive ? "is-active" : ""}`}
			onClick={(e) => onClick(e, track.path)}
			onDoubleClick={(e) => onDoubleClick(e, track.path)}
		>
			<div className="track-item-container">
				<div className="track-main-wrapper">
					<div className="track-cover">
						{coverUrl ? (
							<img src={coverUrl} alt={track.title} />
						) : (
							<div className="track-cover-placeholder">{track.title?.[0] ?? "♪"}</div>
						)}
					</div>
					<div className="track-main">
						<div className="track-title">
							{isActive ? (
								<span className="track-playing-indicator">
									<PlayingIndicator />
								</span>
							) : null}
							{track.title}
						</div>
						<div className="track-sub">
							<span className="track-artist">{track.artist}</span>
							{track.album ? <span className="track-album"> · {track.album}</span> : null}
							{track.rating && track.rating > 0 ? (
								<span className="track-rating-badge" title={`${track.rating} / 5`}>
									★ {track.rating}
								</span>
							) : null}
						</div>
					</div>
				</div>
				<div className="track-actions">
					<IconButton
						icon="list-plus"
						label={t("track.addToPlaylist")}
						className="track-action-btn clickable-icon"
						onClick={(e) => {
							e.stopPropagation();
							onAddToPlaylist(track.path, sectionId);
						}}
						onDoubleClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
						}}
					/>
					<IconButton
						icon="heart"
						label={isFavorite ? t("track.removeFavorite") : t("track.addFavorite")}
						className={`track-action-btn clickable-icon ${isFavorite ? "active" : ""}`}
						onClick={(e) => {
							e.stopPropagation();
							onToggleFavorite(track.path, sectionId);
						}}
						onDoubleClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
						}}
					/>
					{onOpenMetadataEditor ? (
						<IconButton
							icon="file-pen"
							label={t("metadata.editTooltip")}
							className="track-action-btn clickable-icon"
							onClick={(e) => {
								e.stopPropagation();
								onOpenMetadataEditor(track.path);
							}}
							onDoubleClick={(e) => {
								e.stopPropagation();
								e.preventDefault();
							}}
						/>
					) : null}
					{playlistName ? (
						<IconButton
							icon="trash-2"
							label={t("track.removeFromPlaylist")}
							className="track-action-btn clickable-icon"
							onClick={(e) => {
								e.stopPropagation();
								onRemoveFromPlaylist?.(track.path, playlistName);
							}}
							onDoubleClick={(e) => {
								e.stopPropagation();
								e.preventDefault();
							}}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
});

/**
 * Track list component
 * 
 * Displays track list, supporting lazy cover loading, playback, favorites, and playlists.
 * Automatically activates DOM windowing for large lists (> 60 tracks) to maintain 60fps scrolling.
 * 
 * @param props Component properties
 */
export function TrackList({
	tracks,
	activePath,
	sectionId,
	currentList,
	onPlay,
	onDoubleClick,
	onToggleFavorite,
	onAddToPlaylist,
	onRemoveFromPlaylist,
	playlistName,
	library,
	getTrackCover,
	app,
	onOpenMetadataEditor,
}: TrackListProps) {
	// Use lazy track covers hook
	const { embeddedCovers, trackRefs, stopLoading } = useLazyTrackCovers({
		tracks,
		app,
		getTrackCover,
	});

	// Handle double click: stop cover loading and delegate to onDoubleClick
	const handleDoubleClick = React.useCallback(
		(e: React.MouseEvent<HTMLDivElement>, path: string) => {
			e.stopPropagation();
			stopLoading();
			if (onDoubleClick) {
				void onDoubleClick(path, sectionId);
			}
		},
		[onDoubleClick, sectionId, stopLoading]
	);

	// Handle single click: play current track immediately without latency
	const handleClick = React.useCallback(
		(e: React.MouseEvent<HTMLDivElement>, path: string) => {
			e.stopPropagation();
			onPlay(path, sectionId);
		},
		[onPlay, sectionId]
	);

	// Check if current sectionId matches currentList
	// Only highlight active track when sectionId matches
	const isSectionMatched = React.useMemo(() => {
		if (!currentList || !activePath) return false;
		
		if (currentList === "all" && sectionId === "all") {
			return true;
		}
		
		if (currentList === "favorites" && sectionId === "favorites") {
			return true;
		}
		
		if (currentList.startsWith("playlist:")) {
			const listName = currentList.replace("playlist:", "");
			return sectionId === `playlist-${listName}`;
		}
		
		if (currentList.startsWith("artist:")) {
			const listName = currentList.replace("artist:", "");
			return sectionId === `artist-${listName}`;
		}
		
		if (currentList.startsWith("album:")) {
			const listName = currentList.replace("album:", "");
			return sectionId === `album-${listName}`;
		}
		
		return false;
	}, [currentList, sectionId, activePath]);

	// Create favorite path set for O(1) lookup, memoized to prevent reallocations
	const favoritesSet = React.useMemo(
		() => new Set(library.favorites.map((f: ReactTrackInfo) => f.path)),
		[library.favorites]
	);

	// DOM Virtualization: activate when tracks > 60
	const ITEM_HEIGHT = 56;
	const OVERSCAN = 6;
	const shouldVirtualize = tracks.length > 60;

	const [scrollTop, setScrollTop] = React.useState(0);
	const [containerHeight, setContainerHeight] = React.useState(600);
	const containerRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (!shouldVirtualize) return;
		const el = containerRef.current;
		if (!el) return;
		const scrollParent = el.closest(".tab-body") || el.parentElement || el;

		const onScroll = () => {
			setScrollTop(scrollParent.scrollTop);
		};

		const updateHeight = () => {
			setContainerHeight(scrollParent.clientHeight || 600);
		};

		updateHeight();
		scrollParent.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", updateHeight);
		return () => {
			scrollParent.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", updateHeight);
		};
	}, [shouldVirtualize]);

	if (!tracks.length) {
		return <div className="empty">{t("library.empty.noTracks")}</div>;
	}

	const startIndex = shouldVirtualize
		? Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN)
		: 0;
	const endIndex = shouldVirtualize
		? Math.min(tracks.length, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN)
		: tracks.length;

	const visibleTracks = shouldVirtualize ? tracks.slice(startIndex, endIndex) : tracks;
	const topSpacerHeight = shouldVirtualize ? startIndex * ITEM_HEIGHT : 0;
	const bottomSpacerHeight = shouldVirtualize ? (tracks.length - endIndex) * ITEM_HEIGHT : 0;

	return (
		<div className="track-list" ref={containerRef}>
			{topSpacerHeight > 0 && <div style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />}
			{visibleTracks.map((track) => {
				const isFavorite = favoritesSet.has(track.path);
				const isActive = isSectionMatched && activePath === track.path;
				
				let trackRef = trackRefs.get(track.path);
				if (!trackRef) {
					trackRef = React.createRef<HTMLDivElement>();
					trackRefs.set(track.path, trackRef);
				}
				
				const coverUrl = track.coverUrl || embeddedCovers.get(track.path);
				
				return (
					<TrackItemRow
						key={track.path}
						track={track}
						isActive={isActive}
						isFavorite={isFavorite}
						coverUrl={coverUrl}
						trackRef={trackRef}
						sectionId={sectionId}
						playlistName={playlistName}
						onClick={handleClick}
						onDoubleClick={handleDoubleClick}
						onAddToPlaylist={onAddToPlaylist}
						onToggleFavorite={onToggleFavorite}
						onOpenMetadataEditor={onOpenMetadataEditor}
						onRemoveFromPlaylist={onRemoveFromPlaylist}
					/>
				);
			})}
			{bottomSpacerHeight > 0 && <div style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />}
		</div>
	);
}
