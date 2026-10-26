/**
 * LRC lyrics parser module.
 * 
 * Provides lyric parsing and processing capabilities:
 * - Parses LRC formatted lyrics
 * - Strips time tags from lyric text
 * - Supports timestamps for karaoke display
 * 
 * LRC format example:
 * [00:12.34]This is the first lyric line
 * [00:15.67]This is the second lyric line
 */

/**
 * Lyric line interface.
 * 
 * Represents a single lyric line with timing and text information.
 */
export interface LyricLine {
	/** Lyric line timestamp (seconds) */
	time: number;
	/** Lyric text (may contain timestamps for karaoke effects) */
	text: string;
}

/**
 * Lyric parser class.
 * 
 * Provides static methods to parse and process lyric text.
 */
export class LyricsParser {
	/**
	 * Parses LRC formatted lyric content.
	 * 
	 * Converts LRC text into an array of LyricLine objects.
	 * Supports standard LRC format: [mm:ss.xx]text
	 * 
	 * @param lrcContent LRC formatted text
	 * @returns Parsed lyric line array sorted by time
	 * 
	 * @example
	 * ```typescript
	 * const lrc = "[00:12.34]First line\n[00:15.67]Second line";
	 * const lines = LyricsParser.parseLRC(lrc);
	 * // lines: [
	 * //   { time: 12.34, text: "First line" },
	 * //   { time: 15.67, text: "Second line" }
	 * // ]
	 * ```
	 */
	static parseLRC(lrcContent: string): LyricLine[] {
		// Split lines
		const lines = lrcContent.split("\n");
		// Timestamp regex: [mm:ss.xx]
		const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/g;
		const lyrics: LyricLine[] = [];

		// Process each line
		lines.forEach((line) => {
			// Find all timestamps
			const matches = [...line.matchAll(timeRegex)];
			if (matches.length === 0) {
				return;
			}

			// Extract text (remove inline timestamps; do not trim to preserve word spacing and leading indent)
			const text = line.replace(/\[(\d{2}):(\d{2})\.(\d{2})\]/g, "");
			if (text.trim().length === 0) {
				return;
			}

			// If line contains multiple timestamps, create a line for each
			matches.forEach((match) => {
				// Parse time: minutes, seconds, centiseconds
				const minutesStr = match[1];
				const secondsStr = match[2];
				const hundredthsStr = match[3];
				if (!minutesStr || !secondsStr || !hundredthsStr) {
					return; // Skip invalid match
				}
				const minutes = parseInt(minutesStr);
				const seconds = parseInt(secondsStr);
				const hundredths = parseInt(hundredthsStr);
				// Convert to seconds
				const time = minutes * 60 + seconds + hundredths / 100;

				lyrics.push({
					time: time,
					text: text,
				});
			});
		});

		// Sort by timestamp
		return lyrics.sort((a, b) => a.time - b.time);
	}

	/**
	 * Strips timestamps from lyric text, returning plain text.
	 * 
	 * Removes all formats of timestamps (square and angle brackets).
	 * 
	 * @param text Lyric text containing timestamps
	 * @returns Cleaned plain text
	 * 
	 * @example
	 * ```typescript
	 * const text = "[00:12.34]Lyrics<00:15.67>more text";
	 * const clean = LyricsParser.cleanText(text);
	 * // clean: "Lyricsmore text"
	 * ```
	 */
	static cleanText(text: string): string {
		return text
			.replace(/\[\d+:\d+\.\d+\]/g, "") // Remove [mm:ss.xx]
			.replace(/\[\d+:\d+\]/g, "") // Remove [mm:ss]
			.replace(/\[.*?\]/g, "") // Remove any other bracketed text
			.replace(/<\d+:\d+\.\d+>/g, "") // Remove <mm:ss.xx>
			.replace(/<\d+:\d+>/g, "") // Remove <mm:ss>
			.replace(/<.*?>/g, "") // Remove any other angle-bracketed text
			.trimEnd(); // Trim trailing whitespace only, preserving leading indentation
	}
}
