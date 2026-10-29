// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { App, TFile } from 'obsidian';
import MusicPlayerPlugin from '@/main';
import { MusicPlayerSettingTab } from '@/settings/SettingTab';

describe('MusicPlayerSettingTab', () => {
	it('should return all expected setting definition items', () => {
		const app = new App();
		const plugin = new MusicPlayerPlugin(app, { id: 'test', version: '1.5.0' });
		const tab = new MusicPlayerSettingTab(app, plugin);

		const definitions = tab.getSettingDefinitions();
		expect(definitions).toBeInstanceOf(Array);
		expect(definitions.length).toBe(16);

		const keys = definitions.map((d: any) => d.control?.key);
		expect(keys).toContain('musicFolder');
		expect(keys).toContain('autoPlayOnOpen');
		expect(keys).toContain('autoPlayOpenTrackPath');
		expect(keys).toContain('keepScreenAwake');
		expect(keys).toContain('dailyNotesScrobbler');
		expect(keys).toContain('dailyNotesHeading');
		expect(keys).toContain('crossfadeDuration');
		expect(keys).toContain('replayGainMode');
		expect(keys).toContain('eqEnabled');
		expect(keys).toContain('eqPreset');
		expect(keys).toContain('turntableStyle');
		expect(keys).toContain('dynamicAlbumTheme');
		expect(keys).toContain('showVisualizer');
		expect(keys).toContain('syncFolderPlaylists');
		expect(keys).toContain('folderPlaylistDepth');
		expect(keys).toContain('enableWasmVorbisDecoder');
	});

	it('should properly configure crossfade slider bounds', () => {
		const app = new App();
		const plugin = new MusicPlayerPlugin(app, { id: 'test', version: '1.5.0' });
		const tab = new MusicPlayerSettingTab(app, plugin);

		const definitions = tab.getSettingDefinitions();
		const crossfadeDef = definitions.find((d: any) => d.control?.key === 'crossfadeDuration');
		expect(crossfadeDef).toBeDefined();
		expect(crossfadeDef.control.type).toBe('slider');
		expect(crossfadeDef.control.min).toBe(0);
		expect(crossfadeDef.control.max).toBe(10);
		expect(crossfadeDef.control.step).toBe(1);
	});

	it('should evaluate visibility callbacks for conditional settings', async () => {
		const app = new App();
		const plugin = new MusicPlayerPlugin(app, { id: 'test', version: '1.5.0' });
		await plugin.loadSettings();
		const tab = new MusicPlayerSettingTab(app, plugin);

		const definitions = tab.getSettingDefinitions();
		const autoPlayTrackDef = definitions.find((d: any) => d.control?.key === 'autoPlayOpenTrackPath');
		const dailyNotesHeadingDef = definitions.find((d: any) => d.control?.key === 'dailyNotesHeading');
		const eqPresetDef = definitions.find((d: any) => d.control?.key === 'eqPreset');
		const folderDepthDef = definitions.find((d: any) => d.control?.key === 'folderPlaylistDepth');

		// Default state: false
		plugin.settings.autoPlayOnOpen = false;
		plugin.settings.dailyNotesScrobbler = false;
		plugin.settings.eqEnabled = false;
		plugin.settings.syncFolderPlaylists = false;

		expect(autoPlayTrackDef.visible()).toBe(false);
		expect(dailyNotesHeadingDef.visible()).toBe(false);
		expect(eqPresetDef.visible()).toBe(false);
		expect(folderDepthDef.visible()).toBe(false);

		// Enabled state
		plugin.settings.autoPlayOnOpen = true;
		plugin.settings.dailyNotesScrobbler = true;
		plugin.settings.eqEnabled = true;
		plugin.settings.syncFolderPlaylists = true;

		expect(autoPlayTrackDef.visible()).toBe(true);
		expect(dailyNotesHeadingDef.visible()).toBe(true);
		expect(eqPresetDef.visible()).toBe(true);
		expect(folderDepthDef.visible()).toBe(true);
	});

	it('should filter audio files for autoPlayOpenTrackPath picker', () => {
		const app = new App();
		const plugin = new MusicPlayerPlugin(app, { id: 'test', version: '1.5.0' });
		const tab = new MusicPlayerSettingTab(app, plugin);

		const definitions = tab.getSettingDefinitions();
		const autoPlayTrackDef = definitions.find((d: any) => d.control?.key === 'autoPlayOpenTrackPath');
		const filter = autoPlayTrackDef.control.filter;

		const mp3File = new TFile('song.mp3');
		const flacFile = new TFile('track.flac');
		const mdFile = new TFile('notes.md');

		expect(filter(mp3File)).toBe(true);
		expect(filter(flacFile)).toBe(true);
		expect(filter(mdFile)).toBe(false);
	});

	it('should offer complete acoustic presets in eqPreset dropdown', () => {
		const app = new App();
		const plugin = new MusicPlayerPlugin(app, { id: 'test', version: '1.5.0' });
		const tab = new MusicPlayerSettingTab(app, plugin);

		const definitions = tab.getSettingDefinitions();
		const eqPresetDef = definitions.find((d: any) => d.control?.key === 'eqPreset');
		expect(eqPresetDef.control.type).toBe('dropdown');
		expect(eqPresetDef.control.options).toHaveProperty('Flat');
		expect(eqPresetDef.control.options).toHaveProperty('Bass Boost');
		expect(eqPresetDef.control.options).toHaveProperty('Harman Target Curve');
		expect(eqPresetDef.control.options).toHaveProperty('Custom');
	});
});
