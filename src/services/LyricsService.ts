/**
 * Lyrics management service
 * 
 * Manages lyrics-related business logic, including:
 * - Loading lyrics (from plugin settings or fallback to companion .lrc file in the same directory)
 * - Parsing lyrics (LRC format and word-by-word karaoke lyrics)
 * - Handling format transformation and timeline offset shifts
 * 
 * Lyrics are prioritized from audio embedded metadata (LYRICS/USLT/TXXX),
 * falling back to companion `.lrc` files in the same directory when absent.
 */

import { LyricLine, LyricsParser } from "@/utils/lyrics/parser";
import { ExtendedLyricLine, LyricsExtendedParser } from "@/utils/lyrics/extendedParser";
import { isTimestampedKaraokeLyrics } from "@/utils/lyrics/formatDetection";
import { stripLeadingLyricsMetadata } from "@/utils/lyrics/normalizeLyrics";
import { applyLyricsOffset, parseLyricsOffset, stripLyricsOffsetTags } from "@/utils/lyrics/offset";
import MusicPlayerPlugin from "@/main";
import { getOrCreateTrackId } from "@/utils/track/id";
import { getCompanionLrcFile, readCompanionLrc } from "@/utils/audio/companionLrc";
import { TFile } from "obsidian";

/**
 * Lyrics management service class
 * 
 * Provides lyric loading and parsing functions, supporting standard LRC and word-by-word karaoke formats.
 */
export class LyricsService {
	/**
	 * Creates a lyrics management service instance.
	 * 
	 * @param plugin - Plugin instance for accessing settings and vault file APIs
	 */
	constructor(private plugin: MusicPlayerPlugin) {}

	/**
	 * Parses raw lyric text, automatically distinguishing word-by-word (karaoke) or line-by-line LRC format,
	 * and applies timeline offset shifting.
	 * 
	 * @param rawLyrics Raw lyrics string
	 * @returns Standard and extended parsed lyric lines
	 */
	parseLyrics(rawLyrics: string): {
		lyrics: LyricLine[];
		extendedLyrics: ExtendedLyricLine[];
	} {
		const lyrics: LyricLine[] = [];
		const extendedLyrics: ExtendedLyricLine[] = [];

		if (!rawLyrics || !rawLyrics.trim()) {
			return { lyrics, extendedLyrics };
		}

		// [offset:±ms] is a lyric parameter: shifts timeline without rendering in lyrics
		const offsetSeconds = parseLyricsOffset(rawLyrics);
		const lyricsText = stripLeadingLyricsMetadata(stripLyricsOffsetTags(rawLyrics));
		if (!lyricsText.trim()) {
			return { lyrics, extendedLyrics };
		}

		if (isTimestampedKaraokeLyrics(lyricsText)) {
			const parsed = LyricsExtendedParser.parse(lyricsText);
			if (parsed.length > 0) {
				extendedLyrics.push(...parsed);
			}
		}

		if (extendedLyrics.length === 0) {
			const parsedLyrics = LyricsParser.parseLRC(lyricsText);

			if (parsedLyrics.length > 0) {
				lyrics.push(
					...parsedLyrics.map((line) => ({
						time: line.time,
						text: LyricsParser.cleanText(line.text),
					}))
				);
			} else {
				const lines = lyricsText.split(/\r?\n/).filter((l) => l.trim().length > 0);
				lyrics.push(
					...lines.map((line, index) => ({
						time: index * 3,
						text: LyricsParser.cleanText(line),
					}))
				);
			}
		}

		// Apply offset (positive = lyrics appear earlier)
		applyLyricsOffset(lyrics, extendedLyrics, offsetSeconds);

		return { lyrics, extendedLyrics };
	}

	/**
	 * Synchronously loads lyrics (for existing cache or fast rendering).
	 * If settings lack lyrics, checks vault for companion `.lrc` and triggers background load.
	 * 
	 * @param trackPath - Audio file path
	 * @returns Object containing standard and extended lyrics
	 */
	loadLyrics(trackPath: string): {
		lyrics: LyricLine[];
		extendedLyrics: ExtendedLyricLine[];
	} {
		const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
		const track = this.plugin.settings.tracks[trackId];
		const rawLyrics = track?.lyrics && track.lyrics.trim() !== "" ? track.lyrics : "";

		if (!rawLyrics.trim()) {
			const companionFile = getCompanionLrcFile(this.plugin.app, trackPath);
			if (companionFile) {
				void this.loadCompanionLrcAsync(trackPath, companionFile);
			}
			return { lyrics: [], extendedLyrics: [] };
		}

		return this.parseLyrics(rawLyrics);
	}

	/**
	 * Asynchronously loads lyrics: checks settings first, then companion `.lrc` file in same directory.
	 * 
	 * @param trackPath - Audio file path
	 * @returns Promise resolving to standard and extended lyrics
	 */
	async loadLyricsAsync(trackPath: string): Promise<{
		lyrics: LyricLine[];
		extendedLyrics: ExtendedLyricLine[];
	}> {
		const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
		const track = this.plugin.settings.tracks[trackId];
		const rawLyrics = track?.lyrics && track.lyrics.trim() !== "" ? track.lyrics : "";

		if (rawLyrics.trim()) {
			return this.parseLyrics(rawLyrics);
		}

		const companionText = await readCompanionLrc(this.plugin.app, trackPath);
		if (companionText && companionText.trim()) {
			if (track) {
				track.lyrics = companionText;
				try {
					await this.plugin.saveSettings();
				} catch (err) {
					console.warn("Failed to save companion lyrics to settings:", err);
				}
			}
			return this.parseLyrics(companionText);
		}

		return { lyrics: [], extendedLyrics: [] };
	}

	/**
	 * Background loader for companion .lrc file, persisting to settings.
	 */
	private async loadCompanionLrcAsync(trackPath: string, lrcFile: TFile): Promise<void> {
		try {
			const content = await this.plugin.app.vault.read(lrcFile);
			if (content && content.trim()) {
				const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
				const track = this.plugin.settings.tracks[trackId];
				if (track) {
					track.lyrics = content;
					await this.plugin.saveSettings();
				}
			}
		} catch (error) {
			console.warn(`Failed to load companion lyrics (${trackPath}):`, error);
		}
	}
}
