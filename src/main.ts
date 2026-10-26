/**
 * Music Player plugin main entry point
 * 
 * Defines plugin core lifecycle, settings management, and registration:
 * - Plugin lifecycle (onload, onunload)
 * - Settings load and persistence
 * - View registration and activation
 * - Commands and ribbon icon registration
 */

// Buffer polyfill for mobile support (must precede metadata imports)
import { initBufferPolyfill } from "./utils/polyfills/buffer";
initBufferPolyfill();

import { Plugin } from 'obsidian';
import { MusicPlayerView, VIEW_TYPE_MUSIC_PLAYER } from './views/MusicPlayerView';
import { generateArtistsAndAlbums } from './utils/data/transform';
import { getTrackPath } from './utils/track/id';
import { MusicPlayerSettingTab } from './settings/SettingTab';
import type { MusicPlayerSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import { t } from './utils/i18n/i18n';

/**
 * Playback modes:
 * - normal: sequential playback, stops at end of list
 * - repeat-all: loops playlist from beginning
 * - repeat-one: repeats current track indefinitely
 * - shuffle: random playback
 */
export type PlayMode = 'normal' | 'repeat-all' | 'repeat-one' | 'shuffle';

/**
 * Music player main plugin class
 */
export default class MusicPlayerPlugin extends Plugin {
	/** Plugin settings object storing configuration and library metadata */
	declare settings: MusicPlayerSettings;

	/**
	 * Plugin initialization on load
	 */
	async onload() {
		// Load persisted settings
		await this.loadSettings();

		// Register music player view in sidebar
		this.registerView(
			VIEW_TYPE_MUSIC_PLAYER,
			(leaf) => new MusicPlayerView(leaf, this)
		);

		// Add ribbon icon (desktop sidebar & mobile ribbon/drawer)
		this.addRibbonIcon('lucide-music', t('ribbon.musicPlayer'), () => {
			void this.activateView();
		});

		// Add command: open player
		this.addCommand({
			id: 'open-player',
			name: t('commands.openPlayer'),
			callback: () => {
				void this.activateView();
			}
		});

		// Add command: open settings
		this.addCommand({
			id: 'open-settings',
			name: t('commands.openSettings'),
			callback: () => {
				void this.openSettings();
			}
		});

		// Add settings tab
		this.addSettingTab(new MusicPlayerSettingTab(this.app, this));
	}

	/**
	 * Plugin cleanup on unload
	 */
	onunload() {
		// Note: Don't detach leaves in onunload per Obsidian guidelines
	}

	/**
	 * Loads settings from disk and performs migrations
	 */
	async loadSettings() {
		const loadedData = await this.loadData() as Partial<MusicPlayerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		// Migration: autoPlayOpenTrackId -> autoPlayOpenTrackPath
		const loadedWithLegacy = loadedData as { autoPlayOpenTrackId?: string } | null;
		let shouldPersistMigration = false;
		if (
			loadedWithLegacy?.autoPlayOpenTrackId?.trim() &&
			!(this.settings.autoPlayOpenTrackPath ?? "").trim()
		) {
			const p = getTrackPath(loadedWithLegacy.autoPlayOpenTrackId.trim(), this.settings);
			if (p) {
				this.settings.autoPlayOpenTrackPath = p;
				shouldPersistMigration = true;
			}
		}
		if (loadedWithLegacy && "autoPlayOpenTrackId" in loadedWithLegacy) {
			delete (this.settings as { autoPlayOpenTrackId?: string }).autoPlayOpenTrackId;
			shouldPersistMigration = true;
		}
		if (shouldPersistMigration) {
			await this.saveSettings();
		}
		
		// Ensure trackIndex exists
		if (!this.settings.trackIndex) {
			this.settings.trackIndex = {};
		}
		
		// Synchronize artist and album structures with track data
		if (Object.keys(this.settings.tracks || {}).length > 0) {
			const { artists, albums } = generateArtistsAndAlbums(this.settings);
			this.settings.artists = artists;
			this.settings.albums = albums;

			const shouldSave = JSON.stringify(artists) !== JSON.stringify(loadedData?.artists) || 
						  JSON.stringify(albums) !== JSON.stringify(loadedData?.albums);

			if (shouldSave) {
				await this.saveSettings();
			}
		}
	}

	/**
	 * Persists settings to storage
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Reveals or creates the music player view in the right sidebar
	 */
	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_MUSIC_PLAYER)[0];

		if (!leaf) {
			const newLeaf = workspace.getRightLeaf(false);
			if (!newLeaf) {
				return;
			}
			leaf = newLeaf;
			await leaf.setViewState({
				type: VIEW_TYPE_MUSIC_PLAYER,
				active: true,
			});
		}

		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Opens plugin settings tab in Obsidian settings modal
	 */
	async openSettings() {
		const appWithSetting = this.app as unknown as {
			setting?: {
				open: () => void | Promise<void>;
				openTabById?: (id: string) => void | Promise<void>;
			};
		};

		const setting = appWithSetting.setting;
		if (!setting) {
			return;
		}

		await setting.open();

		if (typeof setting.openTabById === "function") {
			await setting.openTabById(this.manifest.id);
		}
	}
}
