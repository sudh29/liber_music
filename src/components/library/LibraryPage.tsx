/**
 * Music library page component
 * 
 * Provides complete music library management interface, including:
 * - Tab switching (favorites, all, playlists, artists, albums)
 * - Track list display (supports cover, title, artist, album info)
 * - Track actions (play, favorite, add to playlist, remove from playlist)
 * - Playlist management (create, rename, delete)
 * - Category playback (play by artist, album, playlist)
 * - Highlight currently playing track
 */

import React from "react";
import { App, setIcon, TFile } from "obsidian";
import type { ReactLibrarySnapshot, ReactTrackInfo } from "@/types";
import { PlayingIndicator } from "@/components/player/PlayingIndicator";
import { IconButton } from "@/components/shared/IconButton";
import { LibraryTabs, type TabId } from "@/components/library/LibraryTabs";
import { TrackList } from "@/components/library/TrackList";
import "./LibraryPage.css";
import { t } from "@/utils/i18n/i18n";

/**
 * Props interface for LibraryPage component
 */
export interface LibraryPageProps {
	/** Music library snapshot data, including all tracks, favorites, playlists, artists, albums */
	library: ReactLibrarySnapshot;
	/** Currently playing track path (for active highlighting) */
	activePath: string | null;
	/** Callback function to play track */
	onPlay: (path: string, sectionId?: string) => void;
	/** Callback function on double click (play and switch to disc view) */
	onDoubleClick?: (path: string, sectionId?: string) => void;
	/** Callback function to toggle favorite status */
	onToggleFavorite: (path: string, sectionId?: string) => void;
	/** Callback function to add track to playlist */
	onAddToPlaylist: (path: string, sectionId?: string) => void;
	/** Callback function to remove track from playlist */
	onRemoveFromPlaylist: (path: string, playlistName: string) => void;
	/** Callback function to create playlist */
	onCreatePlaylist: () => void;
	/** Callback function to play category (artist, album, playlist) */
	onPlayCategory: (categoryType: string, categoryName: string, tracks: ReactTrackInfo[]) => void;
	/** Callback function to edit playlist name (optional) */
	onEditPlaylist?: (playlistName: string) => Promise<void>;
	/** Callback function to delete playlist (optional) */
	onDeletePlaylist?: (playlistName: string) => Promise<void>;
	/** Current playing list identifier (to highlight tracks in currently playing list) */
	currentList?: string;
	/** Async function to fetch track cover (folder cover preferred, embedded cover secondary) */
	getTrackCover?: (file: TFile) => Promise<string | undefined>;
	/** Obsidian App instance */
	app?: App;
}

/**
 * Add playlist button component (internal)
 * 
 * Displays a plus icon button to create a new playlist
 * 
 * @param props Button properties
 */
function AddPlaylistButton({ onClick }: { onClick: () => void }) {
	const iconRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (iconRef.current) {
			setIcon(iconRef.current, "plus");
		}
	}, []);

	return (
		<div className="add-playlist-btn">
			<div
				ref={iconRef}
				className="add-playlist-icon clickable-icon"
				aria-label={t("library.newPlaylist")}
				onClick={onClick}
			/>
		</div>
	);
}

/**
 * Music library page component
 * 
 * Provides complete library management interface: tabs, track list display, track actions, etc.
 * 
 * @param props Component properties
 */
export function LibraryPage(props: LibraryPageProps) {
	const { library, activePath, currentList } = props;
	const [activeTab, setActiveTab] = React.useState<TabId>("all");
	const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({});

	const toggleSection = (key: string) => {
		setCollapsedSections((prev) => {
			const current = prev[key] ?? true;
			return {
				...prev,
				[key]: !current,
			};
		});
	};

	const renderPlaylists = (list: Array<{ name: string; tracks: ReactTrackInfo[] }>, type: "playlists" | "artists" | "albums") => {
		const categoryType = type === "playlists" ? "playlist" : type.slice(0, -1);
		
		// Helper function: check if sectionId matches currentList
		const isSectionMatched = (sectionId: string): boolean => {
			if (!currentList || !activePath) return false;
			
			if (currentList === "all" && sectionId === "all") return true;
			if (currentList === "favorites" && sectionId === "favorites") return true;
			
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
		};

		return (
			<div className="section-list">
				{!list.length ? (
					type === "playlists" ? (
						<div className="empty">{t("library.empty.noPlaylists")}</div>
					) : (
						<div className="empty">{t("library.empty.noData")}</div>
					)
				) : null}
				{list.map((item) => {
					const key = `${categoryType}:${item.name}`;
					const isCollapsed = collapsedSections[key] ?? true;
					// Check if current category matches currentList
					const sectionId = `${categoryType}-${item.name}`;
					const matched = isSectionMatched(sectionId);

					return (
						<div key={item.name} className="section">
							<div
								className={`section-header ${matched ? "is-active" : ""}`}
								onClick={() => toggleSection(key)}
							>
								<div className="section-header-left">
									<IconButton
										icon={isCollapsed ? "chevron-right" : "chevron-down"}
										label={isCollapsed ? t("library.expand") : t("library.collapse")}
										className="section-action-btn clickable-icon"
										onClick={(e) => {
											e.stopPropagation();
											toggleSection(key);
										}}
									/>
									{matched ? (
										<div className="section-playing-indicator">
											<PlayingIndicator />
										</div>
									) : null}
									<div className={`section-title ${matched ? "is-active" : ""}`}>
										<span>{item.name}</span>
										<span className="section-count">({item.tracks.length})</span>
									</div>
								</div>
								<div
									className="section-actions"
									onClick={(e) => e.stopPropagation()}
								>
									<IconButton
										icon="play-circle"
										label={t("library.playCategory")}
										className="section-action-btn clickable-icon"
										onClick={() =>
											props.onPlayCategory(categoryType, item.name, item.tracks)
										}
									/>
									{type === "playlists" && props.onEditPlaylist ? (
										<IconButton
											icon="pencil"
											label={t("library.renamePlaylist")}
											className="section-action-btn clickable-icon"
											onClick={() => {
												void props.onEditPlaylist?.(item.name);
											}}
										/>
									) : null}
									{type === "playlists" && props.onDeletePlaylist ? (
										<IconButton
											icon="trash-2"
											label={t("library.deletePlaylist")}
											className="section-action-btn clickable-icon"
											onClick={() => {
												void props.onDeletePlaylist?.(item.name);
											}}
										/>
									) : null}
								</div>
							</div>
							{!isCollapsed ? (
								item.tracks.length > 0 ? (
									<TrackList
										tracks={item.tracks}
										activePath={activePath}
										sectionId={`${categoryType}-${item.name}`}
										currentList={currentList}
										onPlay={props.onPlay}
										onDoubleClick={props.onDoubleClick}
										onToggleFavorite={props.onToggleFavorite}
										onAddToPlaylist={props.onAddToPlaylist}
										onRemoveFromPlaylist={props.onRemoveFromPlaylist}
										playlistName={type === "playlists" ? item.name : undefined}
										library={library}
										getTrackCover={props.getTrackCover}
										app={props.app}
									/>
								) : (
									<div className="empty">{t("library.empty.noTracks")}</div>
								)
							) : null}
						</div>
					);
				})}

				{type === "playlists" ? <AddPlaylistButton onClick={props.onCreatePlaylist} /> : null}
			</div>
		);
	};

	return (
		<div className="tracklist">
			<LibraryTabs
				activeTab={activeTab}
				onChangeTab={setActiveTab}
				currentList={currentList}
				activePath={activePath}
			/>

			<div className="tab-body">
				{activeTab === "favorites" ? (
					library.favorites.length > 0 ? (
						<TrackList
							tracks={library.favorites}
							activePath={activePath}
							sectionId="favorites"
							currentList={currentList}
							onPlay={props.onPlay}
							onDoubleClick={props.onDoubleClick}
							onToggleFavorite={props.onToggleFavorite}
							onAddToPlaylist={props.onAddToPlaylist}
							onRemoveFromPlaylist={props.onRemoveFromPlaylist}
							library={library}
							getTrackCover={props.getTrackCover}
							app={props.app}
						/>
					) : (
						<div className="empty">{t("library.empty.noTracks")}</div>
					)
				) : null}

				{activeTab === "all" ? (
					<TrackList
						tracks={library.allTracks}
						activePath={activePath}
						sectionId="all"
						currentList={currentList}
						onPlay={props.onPlay}
						onDoubleClick={props.onDoubleClick}
						onToggleFavorite={props.onToggleFavorite}
						onAddToPlaylist={props.onAddToPlaylist}
						onRemoveFromPlaylist={props.onRemoveFromPlaylist}
						library={library}
						getTrackCover={props.getTrackCover}
						app={props.app}
					/>
				) : null}

				{activeTab === "playlists" ? renderPlaylists(library.playlists, "playlists") : null}
				{activeTab === "artists" ? renderPlaylists(library.artists, "artists") : null}
				{activeTab === "albums" ? renderPlaylists(library.albums, "albums") : null}
			</div>
		</div>
	);
}
