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
import { parseTrackFilename } from "@/utils/audio/filenameParser";
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
	 * Ensures a track metadata entry exists in plugin settings,
	 * populating it from parsed filename if not yet indexed.
	 */
	private ensureTrackEntry(trackPath: string, trackId: string) {
		if (!this.plugin.settings.tracks[trackId]) {
			const parsed = parseTrackFilename(trackPath);
			this.plugin.settings.tracks[trackId] = {
				title: parsed.title,
				artist: parsed.artist || "",
				album: parsed.album || "",
				year: parsed.year,
				lyrics: "",
			};
		}
		return this.plugin.settings.tracks[trackId];
	}

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
	 * If settings lack lyrics, triggers background companion load.
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
			void this.loadCompanionLrcAsync(trackPath, companionFile ?? undefined);
			return { lyrics: [], extendedLyrics: [] };
		}

		return this.parseLyrics(rawLyrics);
	}

	/**
	 * Asynchronously loads lyrics: checks settings first, companion `.lrc` file second,
	 * and embedded audio tags directly from the audio binary third.
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

		// 1. Try companion .lrc file (supports memory TFile and vault adapter fallback)
		const companionText = await readCompanionLrc(this.plugin.app, trackPath);
		if (companionText && companionText.trim()) {
			const entry = this.ensureTrackEntry(trackPath, trackId);
			entry.lyrics = companionText;
			try {
				await this.plugin.saveSettings();
			} catch (err) {
				console.warn("Failed to save companion lyrics to settings:", err);
			}
			return this.parseLyrics(companionText);
		}

		// 2. Try extracting embedded lyrics directly from audio file binary
		try {
			const file = this.plugin.app.vault.getAbstractFileByPath(trackPath);
			if (file instanceof TFile) {
				const { readAudioFileBinary, readAudioFileHeaderBinary, getEmbeddedAudioMetadataFromBuffer } = await import("@/utils/audio/metadata");
				let binary = await readAudioFileHeaderBinary(this.plugin.app, file);
				let audioMetadata = binary ? await getEmbeddedAudioMetadataFromBuffer(binary) : null;

				if (!audioMetadata?.lyricsText?.trim()) {
					const fullBinary = await readAudioFileBinary(this.plugin.app, file);
					if (fullBinary) {
						audioMetadata = await getEmbeddedAudioMetadataFromBuffer(fullBinary);
					}
				}

				if (audioMetadata) {
					const entry = this.ensureTrackEntry(trackPath, trackId);
					let changed = false;

					if (audioMetadata.lyricsText?.trim() && entry.lyrics !== audioMetadata.lyricsText) {
						entry.lyrics = audioMetadata.lyricsText;
						changed = true;
					}
					if (audioMetadata.artist?.trim() && entry.artist !== audioMetadata.artist.trim()) {
						entry.artist = audioMetadata.artist.trim();
						changed = true;
					}
					if (audioMetadata.title?.trim() && entry.title !== audioMetadata.title.trim()) {
						entry.title = audioMetadata.title.trim();
						changed = true;
					}
					if (audioMetadata.album?.trim() && entry.album !== audioMetadata.album.trim()) {
						entry.album = audioMetadata.album.trim();
						changed = true;
					}
					if (audioMetadata.duration && entry.duration !== audioMetadata.duration) {
						entry.duration = audioMetadata.duration;
						changed = true;
					}

					if (changed) {
						try {
							await this.plugin.saveSettings();
						} catch (err) {
							console.warn("Failed to save embedded metadata to settings:", err);
						}
					}

					if (audioMetadata.lyricsText?.trim()) {
						return this.parseLyrics(audioMetadata.lyricsText);
					}
				}


			}
		} catch (error) {
			console.warn(`Failed to extract embedded lyrics fallback for (${trackPath}):`, error);
		}

		return { lyrics: [], extendedLyrics: [] };
	}

	/**
	 * Background loader for companion .lrc file, persisting to settings.
	 */
	private async loadCompanionLrcAsync(trackPath: string, lrcFile?: TFile): Promise<void> {
		try {
			let content: string | null = null;
			if (lrcFile) {
				content = typeof this.plugin.app.vault.cachedRead === "function"
					? await this.plugin.app.vault.cachedRead(lrcFile)
					: await this.plugin.app.vault.read(lrcFile);
			} else {
				content = await readCompanionLrc(this.plugin.app, trackPath);
			}

			if (content && content.trim()) {
				const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
				const track = this.ensureTrackEntry(trackPath, trackId);
				track.lyrics = content;
				try {
					await this.plugin.saveSettings();
				} catch (err) {
					console.warn("Failed to save background companion lyrics:", err);
				}
			}
		} catch (error) {
			console.warn(`Failed to load companion lyrics (${trackPath}):`, error);
		}
	}
}

