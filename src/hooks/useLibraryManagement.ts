/**
 * Music library management logic hook
 * 
 * Encapsulates music library business logic for React components.
 * Functions are memoized with useCallback to prevent unnecessary re-renders.
 * 
 * Capabilities:
 * - Playing tracks
 * - Rebuilding all library data
 * - Managing favorites
 * - Managing playlists (create, edit, delete, add/remove tracks)
 * - Category playback (by artist, album, playlist)
 */

import * as React from "react";
import type { MusicPlayerView } from "@/views/MusicPlayerView";
import type { ReactTrackInfo } from "@/types";

/**
 * Return interface for useLibraryManagement hook
 */
export interface UseLibraryManagementReturn {
	/** Plays a track by path */
	handlePlay: (path: string, sectionId?: string) => Promise<void>;
	/** Rebuilds all library data */
	rebuildAllData: () => Promise<void>;
	/** 
	 * Toggles favorite status for track
	 * @param path - Track file path
	 * @param sectionId - Optional section ID to update list context
	 */
	toggleFavorite: (path: string, sectionId?: string) => Promise<void>;
	/** 
	 * Adds track to a playlist
	 * @param path - Track file path
	 * @param sectionId - Optional section ID to update list context
	 */
	addToPlaylist: (path: string, sectionId?: string) => Promise<void>;
	/** 
	 * Removes track from a playlist
	 * @param path - Track file path
	 * @param playlistName - Playlist name
	 */
	removeFromPlaylist: (path: string, playlistName: string) => Promise<void>;
	/** Creates a new playlist */
	createPlaylist: () => Promise<void>;
	/** 
	 * Edits playlist name
	 * @param oldName - Old playlist name
	 */
	editPlaylistName: (oldName: string) => Promise<void>;
	/** 
	 * Deletes a playlist
	 * @param playlistName - Name of playlist to delete
	 */
	deletePlaylist: (playlistName: string) => Promise<void>;
	/** 
	 * Plays entire category collection
	 * @param categoryType - Category type ("artist", "album", "playlist")
	 * @param categoryName - Category name
	 * @param tracks - Array of tracks in category
	 */
	playCategory: (categoryType: string, categoryName: string, tracks: ReactTrackInfo[]) => Promise<void>;
}

/**
 * Music library management hook
 * 
 * Exposes library management actions to React components.
 * 
 * @param view - MusicPlayerView instance
 * @returns Library management methods collection
 */
export function useLibraryManagement(view: MusicPlayerView): UseLibraryManagementReturn {
	const api = view.reactApi;

	const handlePlay = React.useCallback(
		async (path: string, sectionId?: string) => {
			await api.playByPath(path, sectionId);
		},
		[api]
	);

	const rebuildAllData = React.useCallback(async () => {
		await view.rebuildAllData();
	}, [view]);

	const toggleFavorite = React.useCallback(
		async (path: string, sectionId?: string) => {
			await api.toggleFavorite(path, sectionId);
		},
		[api]
	);

	const addToPlaylist = React.useCallback(
		async (path: string, sectionId?: string) => {
			await api.addToPlaylist(path, sectionId);
		},
		[api]
	);

	const removeFromPlaylist = React.useCallback(
		async (path: string, playlistName: string) => {
			await api.removeFromPlaylist(path, playlistName);
		},
		[api]
	);

	const createPlaylist = React.useCallback(async () => {
		await api.createPlaylist();
	}, [api]);

	const editPlaylistName = React.useCallback(
		async (oldName: string) => {
			await api.editPlaylistName(oldName);
		},
		[api]
	);

	const deletePlaylist = React.useCallback(
		async (playlistName: string) => {
			await api.deletePlaylist(playlistName);
		},
		[api]
	);

	const playCategory = React.useCallback(
		async (categoryType: string, categoryName: string, tracks: ReactTrackInfo[]) => {
			await api.playCategory(categoryType, categoryName, tracks);
		},
		[api]
	);

	return {
		handlePlay,
		rebuildAllData,
		toggleFavorite,
		addToPlaylist,
		removeFromPlaylist,
		createPlaylist,
		editPlaylistName,
		deletePlaylist,
		playCategory,
	};
}
