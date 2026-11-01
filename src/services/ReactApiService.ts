/**
 * React API service
 * 
 * Provides unified API interfaces consumed by React components:
 * - Playback control (play by path, play category)
 * - Favorite management (toggle favorite status)
 * - Playlist management (add, remove, create, edit, delete)
 * - Audio controls (volume, playback rate)
 * 
 * Encapsulates complex service interactions into simple hooks-ready APIs.
 */

import { TFile } from "obsidian";
import type { ReactApi, ReactTrackInfo } from "@/types";
import MusicPlayerPlugin from "@/main";
import { StateService } from "./StateService";
import { ListService } from "./ListService";
import { PlaybackService } from "./PlaybackService";
import { AudioService } from "./AudioService";
import { FavoriteService } from "./FavoriteService";
import { PlaylistService } from "./PlaylistService";
import { getOrCreateTrackId } from "@/utils/track/id";
import { MetadataEditorModal } from "@/components/modal/MetadataEditorModal";
import { SmartPlaylistModal } from "@/components/modal/SmartPlaylistModal";

/**
 * React API service callbacks interface
 */
export interface ReactApiServiceCallbacks {
	/** Callback function on library updates */
	onLibraryUpdated: () => Promise<void>;
	/** Callback when selecting song directly (clears lastAction) */
	onDirectPlay?: () => void;
	/** Callback to display notice */
	onShowNotice?: (message: string, timeout?: number) => void;
}

/**
 * React API service class
 * 
 * Encapsulates API methods needed by React components with unified state and library updates.
 */
export class ReactApiService {
	/**
	 * Creates a React API service instance.
	 * 
	 * @param plugin - Plugin instance
	 * @param stateService - State management service
	 * @param listService - List service
	 * @param playbackService - Playback service
	 * @param audioService - Audio service
	 * @param favoriteService - Favorite service
	 * @param playlistService - Playlist service
	 * @param callbacks - Callbacks collection
	 */
	constructor(
		private plugin: MusicPlayerPlugin,
		private stateService: StateService,
		private listService: ListService,
		private playbackService: PlaybackService,
		private audioService: AudioService,
		private favoriteService: FavoriteService,
		private playlistService: PlaylistService,
		private callbacks: ReactApiServiceCallbacks
	) {}

	/**
	 * Returns unified React API interface object.
	 * 
	 * @returns React API interface object
	 */
	getApi(): ReactApi {
		return {
			playByPath: async (path: string, sectionId?: string) => {
				// Clear lastAction to update cover directly without sliding animation
				if (this.callbacks.onDirectPlay) {
					this.callbacks.onDirectPlay();
				}
				const state = this.stateService.getState();
				this.updateSectionId(sectionId);
				if (sectionId) {
					const { list, listId } = this.listService.setCurrentListContext(
						sectionId,
						state.currentSectionIdForPlaylist,
						state.trackList,
						state.favorites
					);
					if (list) {
						this.stateService.setCurrentList(list);
						this.stateService.setCurrentListId(listId);
					}
				}
				// Pass delayPlay=false and skipLibraryUpdate=true for immediate response in React clicks
				await this.playbackService.playByPath(path, false, true);
			},
			playCategory: async (categoryType: string, categoryName: string, tracks: ReactTrackInfo[]) => {
				if (this.callbacks.onDirectPlay) {
					this.callbacks.onDirectPlay();
				}
				const state = this.stateService.getState();
				// Convert ReactTrackInfo[] to TFile[] by looking up path in trackList
				const toFiles: TFile[] = (tracks || [])
					.map((t: ReactTrackInfo) => {
						if (t?.path) {
							return state.trackList.find((f) => f.path === t.path);
						}
						return null;
					})
					.filter((f): f is TFile => f !== null && f !== undefined);
				await this.playbackService.playCategory(categoryType, categoryName, toFiles);
			},
			toggleFavorite: async (path: string, sectionId?: string) => {
				this.updateSectionId(sectionId);
				await this.toggleFavoriteByPath(path);
			},
			addToPlaylist: async (path: string, sectionId?: string) => {
				this.updateSectionId(sectionId);
				await this.addToPlaylistByPath(path);
			},
			removeFromPlaylist: async (path: string, playlistName: string) => {
				await this.removeFromPlaylistByPath(path, playlistName);
			},
			createPlaylist: async () => {
				await this.createPlaylist();
			},
			editPlaylistName: async (oldName: string) => {
				return this.editPlaylistName(oldName);
			},
			deletePlaylist: async (playlistName: string) => {
				await this.deletePlaylist(playlistName);
			},
			setVolume: async (volume: number) => {
				const clampedVolume = Math.max(0, Math.min(1, volume));
				const audioElement = this.audioService.getAudioElement();
				if (audioElement) audioElement.volume = clampedVolume;
				this.stateService.setVolume(clampedVolume);
				// Persist settings (debounced to avoid disk writes on rapid slider drags)
				this.plugin.settings.volume = clampedVolume;
				if (typeof this.plugin.requestSaveSettings === "function") {
					await this.plugin.requestSaveSettings();
				} else if (typeof this.plugin.saveSettings === "function") {
					await this.plugin.saveSettings();
				}
			},
			getVolume: () => {
				const state = this.stateService.getState();
				const audioElement = this.audioService.getAudioElement();
				return audioElement?.volume ?? state.volume ?? 1.0;
			},
			setPlaybackRate: async (rate: number) => {
				const clampedRate = Math.max(0.25, Math.min(4.0, rate));
				const audioElement = this.audioService.getAudioElement();
				if (audioElement) audioElement.playbackRate = clampedRate;
				this.stateService.setPlaybackRate(clampedRate);
				// Persist settings (debounced to avoid disk writes on rapid slider drags)
				this.plugin.settings.playbackRate = clampedRate;
				if (typeof this.plugin.requestSaveSettings === "function") {
					await this.plugin.requestSaveSettings();
				} else if (typeof this.plugin.saveSettings === "function") {
					await this.plugin.saveSettings();
				}
			},
			getPlaybackRate: () => {
				const state = this.stateService.getState();
				const audioElement = this.audioService.getAudioElement();
				return audioElement?.playbackRate ?? state.playbackRate ?? 1.0;
			},
			toggleShuffle: async () => {
				return this.playbackService.toggleShuffle();
			},
			toggleArtworkDisplayMode: async () => {
				return this.playbackService.toggleArtworkDisplayMode();
			},
			setRating: async (path: string, rating: number) => {
				await this.playbackService.setTrackRating(path, rating);
			},
			openMetadataEditor: (path: string) => {
				const modal = new MetadataEditorModal(this.plugin.app, this.plugin, path, {
					onSave: async () => {
						await this.callbacks.onLibraryUpdated();
					},
				});
				modal.open();
			},
			createSmartPlaylist: async () => {
				const modal = new SmartPlaylistModal(this.plugin.app, this.plugin, {
					onSave: async () => {
						await this.callbacks.onLibraryUpdated();
					},
				});
				modal.open();
			},
			editSmartPlaylist: async (id: string) => {
				const def = this.plugin.settings.smartPlaylists?.[id];
				if (!def) return;
				const modal = new SmartPlaylistModal(this.plugin.app, this.plugin, {
					initialDefinition: def,
					onSave: async () => {
						await this.callbacks.onLibraryUpdated();
					},
				});
				modal.open();
			},
			deleteSmartPlaylist: async (id: string) => {
				const success = await this.playlistService.deleteSmartPlaylist(id);
				if (success) {
					await this.callbacks.onLibraryUpdated();
				}
			},
		};
	}

	/**
	 * Updates section ID for playlist context.
	 * 
	 * @param sectionId - Optional section ID
	 */
	private updateSectionId(sectionId?: string) {
		if (sectionId !== undefined) {
			const state = this.stateService.getState();
			this.stateService.setCurrentSectionIdForPlaylist(sectionId ?? state.currentSectionIdForPlaylist);
		}
	}

	/**
	 * Toggles track favorite status by path.
	 * 
	 * @param path - Track path
	 */
	private async toggleFavoriteByPath(path: string) {
		const state = this.stateService.getState();
		const file = state.trackList.find((f) => f.path === path);
		if (!file) return;
		const trackId = getOrCreateTrackId(file.path, this.plugin.settings);
		await this.favoriteService.toggleFavorite(trackId);
		await this.callbacks.onLibraryUpdated();
	}

	/**
	 * Executes playlist action and refreshes library state.
	 * 
	 * @param action - Action function returning Promise<boolean>
	 */
	private async updatePlaylistAndRefresh(action: () => Promise<boolean>) {
		const success = await action();
		if (success) {
			this.stateService.setPlaylistMap(this.playlistService.getPlaylistMap());
			await this.callbacks.onLibraryUpdated();
		}
	}

	/**
	 * Adds track to playlist by path.
	 * 
	 * @param path - Track path
	 */
	private async addToPlaylistByPath(path: string) {
		const state = this.stateService.getState();
		const file = state.trackList.find((f) => f.path === path);
		if (!file) return;
		const trackId = getOrCreateTrackId(file.path, this.plugin.settings);
		await this.updatePlaylistAndRefresh(() => this.playlistService.addToPlaylist(trackId));
	}

	/**
	 * Removes track from playlist by path.
	 * 
	 * @param path - Track path
	 * @param playlistName - Playlist name
	 */
	private async removeFromPlaylistByPath(path: string, playlistName: string) {
		const trackId = getOrCreateTrackId(path, this.plugin.settings);
		await this.updatePlaylistAndRefresh(() => this.playlistService.removeFromPlaylist(trackId, playlistName));
	}

	/**
	 * Creates new playlist.
	 */
	private async createPlaylist() {
		const playlistName = await this.playlistService.createPlaylist();
		if (playlistName) {
			this.stateService.setPlaylistMap(this.playlistService.getPlaylistMap());
			await this.callbacks.onLibraryUpdated();
		}
	}

	/**
	 * Edits playlist name.
	 * 
	 * @param oldName - Old playlist name
	 */
	private async editPlaylistName(oldName: string) {
		await this.updatePlaylistAndRefresh(() => this.playlistService.editPlaylistName(oldName));
	}

	/**
	 * Deletes playlist.
	 * 
	 * @param playlistName - Playlist name to delete
	 */
	private async deletePlaylist(playlistName: string) {
		await this.updatePlaylistAndRefresh(() => this.playlistService.deletePlaylist(playlistName));
	}
}
