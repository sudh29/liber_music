/**
 * Vault file event listener service
 * 
 * Listens for vault filesystem changes (delete, create, rename, modify),
 * triggering consistency checks or metadata updates when music files change.
 * Scope is restricted to configured music folder, or full vault if unset.
 */

import { App, TAbstractFile, TFile } from "obsidian";
import MusicPlayerPlugin from "@/main";
import { isSupportedAudioExtension, SUPPORTED_AUDIO_FORMATS } from "@/constants";
import { LibraryService } from "./LibraryService";
import { StateService } from "./StateService";
import { type AudioEventHandlers, AudioService } from "./AudioService";
import { LyricsService } from "./LyricsService";

/**
 * Vault file event listener service class
 * 
 * Monitors audio file changes and triggers updates.
 * Restricted to the configured music folder, or the entire vault if unset.
 */
export class ListenerService {
	private vaultEventListeners: Array<() => void> = [];

	constructor(
		private app: App,
		private plugin: MusicPlayerPlugin,
		private libraryService: LibraryService,
		private stateService?: StateService,
		private audioService?: AudioService,
		private lyricsService?: LyricsService,
		private audioEventHandlers?: AudioEventHandlers
	) {}

	/**
	 * Checks whether file is an audio file.
	 * 
	 * @param file - File to check
	 * @returns True if audio file, false otherwise
	 */
	private isMusicFile(file: TAbstractFile): boolean {
		if (!(file instanceof TFile)) {
			return false;
		}
		const ext = file.extension?.toLowerCase() || '';
		return isSupportedAudioExtension(ext);
	}

	/**
	 * Checks whether file resides within the configured music folder.
	 * 
	 * @param file - File to check
	 * @returns True if within music folder, false otherwise
	 */
	private isInMusicFolder(file: TAbstractFile): boolean {
		if (!this.plugin.settings.musicFolder) {
			return true; // If no folder configured, all files apply
		}
		const folder = this.plugin.settings.musicFolder.replace(/\/$/, "");
		return file.path.startsWith(folder + "/") || file.path === folder;
	}

	/**
	 * Checks whether path resides within the configured music folder.
	 * 
	 * @param path - Path to check
	 * @returns True if within music folder, false otherwise
	 */
	private isPathInMusicFolder(path: string): boolean {
		if (!this.plugin.settings.musicFolder) {
			return true;
		}
		const folder = this.plugin.settings.musicFolder.replace(/\/$/, "");
		return path.startsWith(folder + "/") || path === folder;
	}

	/**
	 * Handles file delete events.
	 * 
	 * @param filePath - Deleted file path
	 */
	private async handleFileDelete(filePath: string): Promise<void> {
		try {
			await this.libraryService.removeTrackFromLibrary(filePath);
		} catch (error) {
			console.error(`Error handling file deletion: ${filePath}`, error);
		}
	}

	/**
	 * Handles file create events.
	 * 
	 * @param filePath - Newly created file path
	 */
	private async handleFileCreate(filePath: string): Promise<void> {
		try {
			await this.libraryService.updateTrackMetadata(filePath);
			console.debug(`Added new audio file to library: ${filePath}`);
		} catch (error) {
			console.error(`Error handling file creation: ${filePath}`, error);
		}
	}

	/**
	 * Handles file modify events.
	 * 
	 * @param filePath - Modified file path
	 */
	private async handleFileModify(filePath: string): Promise<void> {
		try {
			await this.libraryService.updateTrackMetadata(filePath);
		} catch (error) {
			console.error(`Error handling file modification: ${filePath}`, error);
		}
	}

	/**
	 * Handles file rename events.
	 * 
	 * Updates vault path mappings across library data.
	 * 
	 * @param oldPath - Old file path
	 * @param newPath - New file path
	 */
	private async handleFileRename(oldPath: string, newPath: string): Promise<void> {
		try {
			await this.libraryService.renameTrackInLibrary(oldPath, newPath);
			console.debug(`Completed file rename: ${oldPath} -> ${newPath}`);
		} catch (error) {
			console.error(`Error handling file rename: ${oldPath} -> ${newPath}`, error);
		}
	}

	/**
	 * Sets up vault filesystem listeners.
	 * 
	 * Listens for delete, create, rename, and modify events.
	 * Cleans up any prior listeners first.
	 */
	public setup(): void {
		this.cleanup();

		// File delete event
		const deleteHandler = (file: TAbstractFile) => {
			if (file instanceof TFile) {
				const ext = file.extension?.toLowerCase() || '';
				const isMusic = isSupportedAudioExtension(ext);
				if (isMusic && this.isInMusicFolder(file)) {
					void this.handleFileDelete(file.path);
				}
			}
		};
		this.app.vault.on('delete', deleteHandler);

		// File create event
		const createHandler = (file: TAbstractFile) => {
			if (this.isMusicFile(file) && this.isInMusicFolder(file)) {
				void this.handleFileCreate(file.path);
			}
		};
		this.app.vault.on('create', createHandler);

		// File rename event (including move)
		const renameHandler = async (file: TAbstractFile, oldPath: string) => {
			const wasMusicFile = oldPath && SUPPORTED_AUDIO_FORMATS.some(ext => 
				oldPath.toLowerCase().endsWith(ext)
			);
			const isMusicFile = this.isMusicFile(file);
			
			if (!wasMusicFile && !isMusicFile) {
				return;
			}

			const wasInMusicFolder = this.isPathInMusicFolder(oldPath);
			const isInMusicFolder = this.isInMusicFolder(file);

			// Case 1: File moved out of music folder
			if (wasMusicFile && wasInMusicFolder && !isInMusicFolder) {
				console.debug(`Audio file moved out of music folder: ${oldPath} -> ${file.path}`);
				await this.handleFileDelete(oldPath);
				return;
			}

			// Case 2: File moved into music folder
			if (isMusicFile && !wasInMusicFolder && isInMusicFolder) {
				console.debug(`Audio file moved into music folder: ${oldPath} -> ${file.path}`);
				await this.handleFileCreate(file.path);
				return;
			}

			// Case 3: File renamed or moved within music folder
			if ((wasMusicFile || isMusicFile) && wasInMusicFolder && isInMusicFolder) {
				let wasPlaying = false;
				let savedCurrentTime = 0;
				let savedVolume = 1.0;
				let savedPlaybackRate = 1.0;
				
				if (this.stateService && this.audioService) {
					const state = this.stateService.getState();
					if (state.currentTrack && state.currentTrack.path === oldPath) {
						console.debug(`Active playing track renamed: ${oldPath} -> ${file.path}`);
						
						wasPlaying = state.isPlaying;
						const audioElement = this.audioService.getAudioElement();
						if (audioElement) {
							savedCurrentTime = audioElement.currentTime || 0;
							savedVolume = audioElement.volume ?? state.volume ?? 1.0;
							savedPlaybackRate = audioElement.playbackRate ?? state.playbackRate ?? 1.0;
						} else {
							savedVolume = state.volume ?? 1.0;
							savedPlaybackRate = state.playbackRate ?? 1.0;
						}
						
						if (wasPlaying) {
							this.audioService.pause();
							this.stateService.setIsPlaying(false);
						}
						
						await this.audioService.cleanup();
					}
				}
				
				await this.handleFileRename(oldPath, file.path);
				
				// If track was playing, recreate audio element with new path
				if (wasPlaying && this.stateService && this.audioService && this.lyricsService && this.audioEventHandlers && file instanceof TFile) {
					const state = this.stateService.getState();
					if (state.currentTrack && state.currentTrack.path === file.path) {
						console.debug(`Recreating audio element with new path: ${file.path}`);
						
						await this.audioService.createAudioElement(
							file,
							savedVolume,
							savedPlaybackRate,
							this.audioEventHandlers
						);
						
						const newAudioElement = this.audioService.getAudioElement();
						if (newAudioElement && savedCurrentTime > 0) {
							newAudioElement.currentTime = savedCurrentTime;
						}
						
						const { lyrics, extendedLyrics } = this.lyricsService.loadLyrics(file.path);
						this.stateService.setLyrics(lyrics, extendedLyrics);
						
						try {
							await this.audioService.play();
							this.stateService.setIsPlaying(true);
							console.debug(`Resumed playback with new path: ${file.path}`);
						} catch (playError) {
							console.error(`Error resuming playback: ${file.path}`, playError);
						}
					}
				}
				return;
			}
		};
		this.app.vault.on('rename', renameHandler);

		// File modify event
		const modifyHandler = (file: TAbstractFile) => {
			if (this.isMusicFile(file) && this.isInMusicFolder(file)) {
				void this.handleFileModify(file.path);
			}
		};
		this.app.vault.on('modify', modifyHandler);

		// Store remover callbacks
		this.vaultEventListeners.push(
			() => this.app.vault.off('delete', deleteHandler),
			() => this.app.vault.off('create', createHandler),
			() => this.app.vault.off('rename', renameHandler),
			() => this.app.vault.off('modify', modifyHandler)
		);
	}

	/**
	 * Cleans up vault filesystem listeners.
	 */
	public cleanup(): void {
		this.vaultEventListeners.forEach(remove => remove());
		this.vaultEventListeners = [];
	}
}
