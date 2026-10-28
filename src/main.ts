/**
 * Liber Music Player Plugin main entry point
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

import { Notice, Plugin } from 'obsidian';
import { MusicPlayerView, VIEW_TYPE_MUSIC_PLAYER } from './views/MusicPlayerView';
import { generateArtistsAndAlbums } from './utils/data/transform';
import { getTrackPath } from './utils/track/id';
import { MusicPlayerSettingTab } from './settings/SettingTab';
import type { MusicPlayerSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import { t } from './utils/i18n/i18n';
import { MusicCodeblockRenderChild } from './components/codeblock/MusicCodeblockRenderChild';
import { EqualizerModal } from './components/modal/EqualizerModal';
import { MetadataEditorModal } from './components/modal/MetadataEditorModal';
import { SmartPlaylistModal } from './components/modal/SmartPlaylistModal';
import { parseObsidianMusicProtocol } from './utils/protocol/uri';
import { resolveVaultAudioFile } from './utils/codeblock/resolver';
import { codeblockCoordinator } from './utils/codeblock/coordinator';

/**
 * Playback modes:
 * - normal: sequential playback, stops at end of list
 * - repeat-all: loops playlist from beginning
 * - repeat-one: repeats current track indefinitely
 * - shuffle: random playback
 */
export type PlayMode = 'normal' | 'repeat-all' | 'repeat-one' | 'shuffle';

/**
 * Liber music player main plugin class
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

		// Add command: open 10-band equalizer
		this.addCommand({
			id: 'open-equalizer',
			name: t('commands.openEqualizer') || 'Open 10-Band Equalizer',
			callback: async () => {
				await this.activateView();
				const view = this.getView();
				if (view) {
					new EqualizerModal(this.app, this, view.equalizerService).open();
				}
			}
		});

		// Add command: edit metadata of current track
		this.addCommand({
			id: 'edit-track-metadata',
			name: t('commands.editMetadata') || 'Edit Track Metadata',
			callback: async () => {
				await this.activateView();
				const view = this.getView();
				if (view && view.currentTrack) {
					new MetadataEditorModal(this.app, this, view.currentTrack.path, {
						onSave: async () => {
							await view.refreshMusicList();
						},
					}).open();
				} else {
					new Notice(t('notice.noTrackPlaying') || 'No track is currently playing.');
				}
			}
		});

		// Add command: create smart playlist
		this.addCommand({
			id: 'create-smart-playlist',
			name: t('commands.createSmartPlaylist') || 'Create Smart Playlist',
			callback: async () => {
				await this.activateView();
				const view = this.getView();
				new SmartPlaylistModal(this.app, this, {
					onSave: async () => {
						if (view) {
							await view.refreshMusicList();
						}
					},
				}).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new MusicPlayerSettingTab(this.app, this));

		// Register markdown codeblock processor: ```music
		this.registerMarkdownCodeBlockProcessor('music', (source, el, ctx) => {
			const child = new MusicCodeblockRenderChild(el, this, source);
			ctx.addChild(child);
		});

		// Register obsidian protocol handler: obsidian://music-player?track=...&t=...
		this.registerObsidianProtocolHandler('music-player', (params) => {
			void this.handleProtocolAction(params);
		});

		// Coordinate single-source playback between in-note codeblocks and sidebar player
		codeblockCoordinator.setGlobalPauseCallback(() => {
			this.pauseActivePlayback();
		});
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
		const view = this.getView();
		if (view) {
			if (view.crossfadeService && this.settings.crossfadeDuration !== undefined) {
				view.crossfadeService.setDuration(this.settings.crossfadeDuration);
			}
			if (view.equalizerService) {
				if (this.settings.eqEnabled !== undefined && view.equalizerService.isEnabled() !== this.settings.eqEnabled) {
					view.equalizerService.setEnabled(this.settings.eqEnabled);
				}
				if (this.settings.eqPreset && view.equalizerService.getState().preset !== this.settings.eqPreset) {
					view.equalizerService.setPreset(this.settings.eqPreset);
				}
			}
		}
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

	/**
	 * Gets the active MusicPlayerView instance from workspace leaves, if open.
	 */
	getView(): MusicPlayerView | null {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MUSIC_PLAYER);
		const firstLeaf = leaves[0];
		if (firstLeaf && firstLeaf.view instanceof MusicPlayerView) {
			return firstLeaf.view;
		}
		return null;
	}

	/**
	 * Pauses active playback in the sidebar player view.
	 */
	pauseActivePlayback(): void {
		const view = this.getView();
		if (view && view.isPlaying) {
			void view.playbackService.togglePlay();
		}
	}

	/**
	 * Handles obsidian://music-player protocol deep links
	 */
	async handleProtocolAction(params: Record<string, string>): Promise<void> {
		const payload = parseObsidianMusicProtocol(params);

		// Activate/reveal the sidebar player view
		await this.activateView();

		if (!payload.track) {
			return;
		}

		const file = resolveVaultAudioFile(this.app, payload.track, this.settings.trackIndex);
		if (!file) {
			new Notice(t('notice.trackMissing'));
			return;
		}

		const view = this.getView();
		if (!view) {
			return;
		}

		await view.playbackService.playByPath(file.path, false, false);

		if (payload.time !== undefined && payload.time > 0) {
			view.playbackService.seekToTime(payload.time);
		}

		if (!payload.autoplay && view.isPlaying) {
			await view.playbackService.togglePlay();
		}
	}
}
