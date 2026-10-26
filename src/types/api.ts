/**
 * API interface definitions
 * 
 * Defines the contract between React components and player services.
 */

import type { ReactTrackInfo } from "./library";

/**
 * React API interface
 * 
 * Exposes core player operations to React hooks:
 * - Playback control (by path, by category)
 * - Favorite management (toggle)
 * - Playlist management (add, remove, create, edit, delete)
 * - Audio parameters (volume, playback rate)
 */
export interface ReactApi {
	/** 
	 * Plays a track by its vault file path
	 * @param path - Music file path
	 * @param sectionId - Optional section ID for list context
	 */
	playByPath: (path: string, sectionId?: string) => Promise<void>;
	
	/** 
	 * Plays a category (artist, album, playlist)
	 * @param categoryType - Category type ("artist", "album", "playlist")
	 * @param categoryName - Category name
	 * @param tracks - List of tracks in this category
	 */
	playCategory: (categoryType: string, categoryName: string, tracks: ReactTrackInfo[]) => Promise<void>;
	
	/** 
	 * Toggles favorite state of a track
	 * @param path - Music file path
	 * @param sectionId - Optional section ID for updating list context
	 */
	toggleFavorite: (path: string, sectionId?: string) => Promise<void>;
	
	/** 
	 * Adds track to a playlist
	 * @param path - Music file path
	 * @param sectionId - Optional section ID for list context
	 */
	addToPlaylist: (path: string, sectionId?: string) => Promise<void>;
	
	/** 
	 * Removes a track from a playlist
	 * @param path - Music file path
	 * @param playlistName - Target playlist name
	 */
	removeFromPlaylist: (path: string, playlistName: string) => Promise<void>;
	
	/** Creates a new playlist */
	createPlaylist: () => Promise<void>;
	
	/** 
	 * Renames a playlist
	 * @param oldName - Current playlist name
	 */
	editPlaylistName: (oldName: string) => Promise<void>;
	
	/** 
	 * Deletes a playlist
	 * @param playlistName - Name of playlist to delete
	 */
	deletePlaylist: (playlistName: string) => Promise<void>;
	
	/** 
	 * Sets volume level
	 * @param volume - Volume level (0.0 - 1.0)
	 */
	setVolume: (volume: number) => Promise<void>;
	
	/** 
	 * Gets current volume level
	 * @returns Volume level (0.0 - 1.0)
	 */
	getVolume: () => number;
	
	/** 
	 * Sets playback rate
	 * @param rate - Playback rate (0.25 - 4.0)
	 */
	setPlaybackRate: (rate: number) => Promise<void>;
	
	/** 
	 * Gets current playback rate
	 * @returns Playback rate (0.25 - 4.0)
	 */
	getPlaybackRate: () => number;

	/**
	 * Toggles non-repeating shuffle state
	 * @returns New shuffle boolean
	 */
	toggleShuffle: () => Promise<boolean>;

	/**
	 * Toggles artwork display mode between 'vinyl' and 'card'
	 * @returns New artwork display mode
	 */
	toggleArtworkDisplayMode: () => Promise<"vinyl" | "card">;

	/**
	 * Sets track rating (0 to 5)
	 * @param path - Track path
	 * @param rating - Rating (0-5)
	 */
	setRating: (path: string, rating: number) => Promise<void>;
}

