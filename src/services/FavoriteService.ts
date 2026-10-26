/**
 * Favorite management service
 * 
 * Manages favorite-related business logic, including:
 * - Toggling favorite status
 * - Checking if a track is favorited
 * 
 * Favorite data is persisted in plugin settings via the favorites array storing track IDs.
 */

import MusicPlayerPlugin from "@/main";

/**
 * Favorite management service class
 * 
 * Provides add/remove/check operations for track favorites persisted to plugin settings.
 * Operations are based on unique track IDs.
 */
export class FavoriteService {
	/**
	 * Creates a favorite management service instance.
	 * 
	 * @param plugin - Plugin instance for accessing and persisting settings
	 */
	constructor(private plugin: MusicPlayerPlugin) {}

	/**
	 * Checks whether a track is favorited.
	 * 
	 * @param trackId - Track ID
	 * @returns True if favorited, false otherwise
	 */
	isFavorite(trackId: string): boolean {
		const favoriteIds = new Set(this.plugin.settings.favorites || []);
		return favoriteIds.has(trackId);
	}

	/**
	 * Toggles track favorite status.
	 * 
	 * If favorited, unfavorites; if not favorited, marks as favorite.
	 * Persists settings to storage immediately.
	 * 
	 * @param trackId - Track ID
	 * @returns New favorite status (true if favorited, false otherwise)
	 */
	async toggleFavorite(trackId: string): Promise<boolean> {
		const ids = new Set(this.plugin.settings.favorites || []);
		const wasFavorite = ids.has(trackId);

		// Toggle status
		if (wasFavorite) {
			ids.delete(trackId);
		} else {
			ids.add(trackId);
		}

		this.plugin.settings.favorites = Array.from(ids);
		await this.plugin.saveSettings();
		return !wasFavorite;
	}

	/**
	 * Retrieves all favorited track IDs.
	 * 
	 * @returns Array of favorited track IDs
	 */
	getFavoriteIds(): string[] {
		return this.plugin.settings.favorites || [];
	}
}
