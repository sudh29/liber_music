/**
 * Settings tab page
 * Uses Obsidian's declarative setting API (getSettingDefinitions / SettingDefinitionItem).
 */
import { App, PluginSettingTab, SettingDefinitionItem, TFile } from 'obsidian';
import type MusicPlayerPlugin from '../main';
import { EQ_PRESETS } from '../utils/audio/equalizer';
import { t } from '../utils/i18n/i18n';

/**
 * Supported audio extensions for file picker filtering.
 */
const AUDIO_EXTENSIONS = ['mp3', 'flac', 'wav', 'm4a', 'ogg', 'aac', 'wma', 'opus'];

/**
 * Liber Music Player plugin settings tab
 */
export class MusicPlayerSettingTab extends PluginSettingTab {
	plugin: MusicPlayerPlugin;

	constructor(app: App, plugin: MusicPlayerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: t('settings.musicFolder.name'),
				desc: t('settings.musicFolder.desc'),
				control: {
					key: 'musicFolder',
					type: 'folder',
					placeholder: t('settings.musicFolder.placeholder'),
				},
			},
			{
				name: t('settings.autoPlay.name'),
				desc: t('settings.autoPlay.desc'),
				control: {
					key: 'autoPlayOnOpen',
					type: 'toggle',
				},
			},
			{
				name: t('settings.autoPlayTrack.name'),
				desc: t('settings.autoPlayTrack.desc'),
				// Only visible when auto-play on open is enabled
				visible: () => this.plugin.settings.autoPlayOnOpen ?? false,
				control: {
					key: 'autoPlayOpenTrackPath',
					type: 'file',
					placeholder: t('settings.autoPlayTrack.placeholder'),
					filter: (file: TFile) =>
						AUDIO_EXTENSIONS.includes(file.extension.toLowerCase()),
				},
			},
			{
				name: t('settings.keepScreenAwake.name'),
				desc: t('settings.keepScreenAwake.desc'),
				control: {
					key: 'keepScreenAwake',
					type: 'toggle',
				},
			},
			{
				name: t('settings.dailyNotesScrobbler.name'),
				desc: t('settings.dailyNotesScrobbler.desc'),
				control: {
					key: 'dailyNotesScrobbler',
					type: 'toggle',
				},
			},
			{
				name: t('settings.dailyNotesHeading.name'),
				desc: t('settings.dailyNotesHeading.desc'),
				visible: () => this.plugin.settings.dailyNotesScrobbler ?? false,
				control: {
					key: 'dailyNotesHeading',
					type: 'text',
					placeholder: '## 🎧 Music Log',
				},
			},
			{
				name: t('settings.crossfadeDuration.name'),
				desc: t('settings.crossfadeDuration.desc'),
				control: {
					key: 'crossfadeDuration',
					type: 'slider',
					min: 0,
					max: 10,
					step: 1,
				},
			},
			{
				name: t('settings.replayGainMode.name'),
				desc: t('settings.replayGainMode.desc'),
				control: {
					key: 'replayGainMode',
					type: 'dropdown',
					options: {
						track: t('settings.replayGainMode.track'),
						album: t('settings.replayGainMode.album'),
						off: t('settings.replayGainMode.off'),
					},
				},
			},
			{
				name: t('settings.eqEnabled.name'),
				desc: t('settings.eqEnabled.desc'),
				control: {
					key: 'eqEnabled',
					type: 'toggle',
				},
			},
			{
				name: t('settings.eqPreset.name'),
				desc: t('settings.eqPreset.desc'),
				visible: () => this.plugin.settings.eqEnabled ?? false,
				control: {
					key: 'eqPreset',
					type: 'dropdown',
					options: {
						...Object.keys(EQ_PRESETS).reduce<Record<string, string>>((acc, name) => {
							acc[name] = name;
							return acc;
						}, {}),
						Custom: 'Custom',
					},
				},
			},
			{
				name: t('settings.artworkDisplayMode.name'),
				desc: t('settings.artworkDisplayMode.desc'),
				control: {
					key: 'artworkDisplayMode',
					type: 'dropdown',
					options: {
						card: t('settings.artworkDisplayMode.card'),
						vinyl: t('settings.artworkDisplayMode.vinyl'),
					},
				},
			},
			{
				name: t('settings.showStarRating.name'),
				desc: t('settings.showStarRating.desc'),
				control: {
					key: 'showStarRatingOnPlayer',
					type: 'toggle',
				},
			},
			{
				name: t('settings.turntableStyle.name'),
				desc: t('settings.turntableStyle.desc'),
				visible: () => (this.plugin.settings.artworkDisplayMode ?? 'card') === 'vinyl',
				control: {
					key: 'turntableStyle',
					type: 'dropdown',
					options: {
						obsidian: 'Brushed Obsidian (Stealth Dark)',
						walnut: 'Vintage Walnut (Wood Grain)',
						acrylic: 'Cyberpunk Acrylic (Frosted Glass)',
					},
				},
			},
			{
				name: t('settings.dynamicAlbumTheme.name'),
				desc: t('settings.dynamicAlbumTheme.desc'),
				control: {
					key: 'dynamicAlbumTheme',
					type: 'toggle',
				},
			},
			{
				name: t('settings.showVisualizer.name'),
				desc: t('settings.showVisualizer.desc'),
				control: {
					key: 'showVisualizer',
					type: 'toggle',
				},
			},
			{
				name: t('settings.syncFolderPlaylists.name'),
				desc: t('settings.syncFolderPlaylists.desc'),
				control: {
					key: 'syncFolderPlaylists',
					type: 'toggle',
				},
			},
			{
				name: t('settings.folderPlaylistDepth.name'),
				desc: t('settings.folderPlaylistDepth.desc'),
				visible: () => this.plugin.settings.syncFolderPlaylists ?? false,
				control: {
					key: 'folderPlaylistDepth',
					type: 'dropdown',
					options: {
						'1': 'Level 1 (Top-level subfolders)',
						'2': 'Level 2 (Nested subfolders)',
						'3': 'Level 3 (Deep folders)',
					},
				},
			},
			{
				name: t('settings.enableWasmVorbisDecoder.name'),
				desc: t('settings.enableWasmVorbisDecoder.desc'),
				control: {
					key: 'enableWasmVorbisDecoder',
					type: 'toggle',
				},
			},
		];
	}
}
