/**
 * Playlist management service
 * 
 * Manages playlist business logic, including:
 * - Creating playlists
 * - Editing playlist names
 * - Deleting playlists
 * - Adding tracks to playlists
 * - Removing tracks from playlists
 * 
 * Playlist data is persisted in settings via the playlists object (playlist name -> track IDs array).
 */

import { App } from "obsidian";
import MusicPlayerPlugin from "@/main";
import { ConfirmModal, PlaylistPickerModal, TextInputModal } from "@/components";
import { t, tWithParams } from "@/utils/i18n/i18n";

/**
 * Playlist management service class
 * 
 * Provides CRUD operations for custom playlists persisted to plugin settings.
 * Displays interactive modal dialogs when needed.
 */
export class PlaylistService {
	/**
	 * Creates a playlist management service instance.
	 * 
	 * @param app - Obsidian App instance for modal presentation
	 * @param plugin - Plugin instance for settings persistence
	 */
	constructor(
		private app: App,
		private plugin: MusicPlayerPlugin
	) {}

	/**
	 * Retrieves playlist mapping table.
	 * 
	 * @returns Playlist mapping object (playlist name -> track IDs array)
	 */
	getPlaylistMap(): Record<string, string[]> {
		return this.plugin.settings.playlists || {};
	}

	/**
	 * Creates a new playlist.
	 * 
	 * Prompts user for a name and initializes an empty playlist if non-existent.
	 * 
	 * @returns Newly created playlist name, or null if cancelled or duplicate
	 */
	async createPlaylist(): Promise<string | null> {
		const modal = new TextInputModal(this.app, t("playlist.promptNewName"));
		const name = await modal.prompt();
		if (!name) return null;
		const trimmed = name.trim();
		if (!trimmed) return null;

		const playlistMap = this.getPlaylistMap();
		if (!playlistMap[trimmed]) {
			playlistMap[trimmed] = [];
			this.plugin.settings.playlists = playlistMap;
			await this.plugin.saveSettings();
			return trimmed;
		}

		return null;
	}

	/**
	 * Edits playlist name.
	 * 
	 * Prompts user for new name and renames playlist in settings.
	 */
	async editPlaylistName(oldName: string): Promise<boolean> {
		const playlistMap = this.getPlaylistMap();
		if (!playlistMap[oldName]) return false;

		const modal = new TextInputModal(this.app, t("playlist.renamePrompt"), oldName);
		const newName = await modal.prompt();
		if (!newName) return false;
		const trimmed = newName.trim();
		if (!trimmed || trimmed === oldName) return false;

		if (playlistMap[trimmed]) {
			return false;
		}

		const tracks = playlistMap[oldName];
		if (tracks === undefined) {
			return false;
		}
		delete playlistMap[oldName];
		playlistMap[trimmed] = tracks;
		this.plugin.settings.playlists = playlistMap;
		await this.plugin.saveSettings();
		return true;
	}

	/**
	 * Deletes a playlist.
	 * 
	 * Prompts user for confirmation before removing playlist from settings.
	 */
	async deletePlaylist(playlistName: string): Promise<boolean> {
		const playlistMap = this.getPlaylistMap();
		if (!playlistMap[playlistName]) return false;

		const modal = new ConfirmModal(
			this.app,
			t("playlist.deleteTitle"),
			tWithParams("playlist.deleteMessage", { name: playlistName }),
			t("common.ok"),
			t("common.cancel")
		);
		const confirmed = await modal.prompt();
		
		if (!confirmed) return false;

		delete playlistMap[playlistName];
		this.plugin.settings.playlists = playlistMap;
		await this.plugin.saveSettings();
		return true;
	}

	/**
	 * Adds track to a playlist.
	 * 
	 * Displays playlist picker modal and appends track ID to selected playlist.
	 * 
	 * @param trackId - Track ID
	 */
	async addToPlaylist(trackId: string): Promise<boolean> {
		const playlistMap = this.getPlaylistMap();
		const allNames = Object.keys(playlistMap);
		const modal = new PlaylistPickerModal(this.app, allNames);
		const name = await modal.prompt();
		if (!name) return false;
		const trimmed = name.trim();
		if (!trimmed) return false;

		if (!playlistMap[trimmed]) {
			playlistMap[trimmed] = [];
		}

		const playlist = playlistMap[trimmed];
		if (playlist && !playlist.includes(trackId)) {
			playlist.push(trackId);
			this.plugin.settings.playlists = playlistMap;
			await this.plugin.saveSettings();
			return true;
		}

		return false;
	}

	/**
	 * Removes track from a playlist.
	 * 
	 * Removes track ID from specified playlist, retaining empty playlist if zero tracks remain.
	 * 
	 * @param trackId - Track ID
	 * @param playlistName - Playlist name
	 */
	async removeFromPlaylist(trackId: string, playlistName: string): Promise<boolean> {
		const playlistMap = this.getPlaylistMap();
		const playlist = playlistMap[playlistName];
		if (!playlist) return false;

		const index = playlist.indexOf(trackId);
		if (index > -1) {
			playlist.splice(index, 1);
			this.plugin.settings.playlists = playlistMap;
			await this.plugin.saveSettings();
			return true;
		}

		return false;
	}

	/**
	 * Gets smart playlists mapping table.
	 */
	getSmartPlaylists(): Record<string, import("@/types").SmartPlaylistDefinition> {
		return this.plugin.settings.smartPlaylists || {};
	}

	/**
	 * Saves or updates a smart playlist definition.
	 */
	async saveSmartPlaylist(definition: import("@/types").SmartPlaylistDefinition): Promise<void> {
		if (!this.plugin.settings.smartPlaylists) {
			this.plugin.settings.smartPlaylists = {};
		}
		this.plugin.settings.smartPlaylists[definition.id] = definition;
		await this.plugin.saveSettings();
	}

	/**
	 * Deletes a smart playlist by ID.
	 */
	async deleteSmartPlaylist(id: string): Promise<boolean> {
		if (!this.plugin.settings.smartPlaylists || !this.plugin.settings.smartPlaylists[id]) {
			return false;
		}

		const modal = new ConfirmModal(
			this.app,
			t("playlist.deleteTitle"),
			tWithParams("playlist.deleteMessage", { name: this.plugin.settings.smartPlaylists[id]?.name || id }),
			t("common.ok"),
			t("common.cancel")
		);
		const confirmed = await modal.prompt();
		if (!confirmed) return false;

		delete this.plugin.settings.smartPlaylists[id];
		await this.plugin.saveSettings();
		return true;
	}
}
