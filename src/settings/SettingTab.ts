/**
 * Settings tab page
 * Uses Obsidian's declarative setting API (getSettingDefinitions / SettingDefinitionItem).
 */
import { App, PluginSettingTab, SettingDefinitionItem, TFile } from 'obsidian';
import type MusicPlayerPlugin from '../main';
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
		];
	}
}
