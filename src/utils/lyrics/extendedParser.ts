/**
 * Extended word-by-word timed lyrics parser module.
 * 
 * Provides word-by-word lyric parsing capabilities:
 * - Parses lyrics with per-character/word time tags (karaoke text embedded in LYRICS tags)
 * - Supported formats: <mm:ss.xx>char or [mm:ss.xx]char
 * - Used for karaoke word-by-word progressive highlight effects
 * 
 * Format examples:
 * [00:12.34]This<00:12.45>is<00:12.56>a<00:12.67>song
 * or
 * <00:12.34>This<00:12.45>is<00:12.56>a<00:12.67>song
 */

/**
 * Extended lyric character interface.
 * Represents a single character with its corresponding timestamp.
 */
export interface ExtendedLyricChar {
	/** Character content */
	char: string;
	/** Timestamp for character in seconds */
	time: number;
}

/**
 * Extended lyric line interface.
 * Represents a line of extended lyrics containing line timing and character array.
 */
export interface ExtendedLyricLine {
	/** Line timestamp in seconds */
	time: number;
	/** Array of characters in line */
	chars: ExtendedLyricChar[];
	/** Plain text of line for display */
	text: string;
	/**
	 * All timestamps present in this line (leading line time + each character tag), sorted ascending without duplicates.
	 * Used to compute end time for each character/word: takes the next timestamp strictly greater than character start time.
	 */
	lineTimeStamps: readonly number[];
}

/**
 * Extended lyric parser class.
 * 
 * Provides static methods to parse word-by-word timed lyric text.
 */
export class LyricsExtendedParser {
	/**
	 * Parses extended word-by-word lyric text.
	 * 
	 * Converts lyric text containing per-character time tags into an array of ExtendedLyricLine objects.
	 * Supports formats:
	 * - [mm:ss.xx]char<mm:ss.xx>char (line timestamp + character timestamps)
	 * - <mm:ss.xx>char<mm:ss.xx>char (character timestamps only)
	 * 
	 * @param extendedContent Extended lyric text
	 * @returns Array of extended lyric lines sorted by time
	 * 
	 * @example
	 * ```typescript
	 * const extended = "[00:12.34]This<00:12.45>is<00:12.56>a<00:12.67>song";
	 * const lines = LyricsExtendedParser.parse(extended);
	 * ```
	 */
	static parse(extendedContent: string): ExtendedLyricLine[] {
		if (!extendedContent || !extendedContent.trim()) {
			return [];
		}

		const lines: ExtendedLyricLine[] = [];
		// Split lines
		const textLines = extendedContent.split(/\r?\n/);

		// Line timestamp regex: [mm:ss.xx]
		const lineTimeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/;
		// Character timestamp regex: <mm:ss.xx> or [mm:ss.xx]
		const charTimeRegex = /[<[](\d{2}):(\d{2})\.(\d{2})[>\]]/g;

		const parseTagToSeconds = (m: RegExpMatchArray): number | null => {
			const minutesStr = m[1];
			const secondsStr = m[2];
			const hundredthsStr = m[3];
			if (!minutesStr || !secondsStr || !hundredthsStr) return null;
			const minutes = parseInt(minutesStr);
			const seconds = parseInt(secondsStr);
			const hundredths = parseInt(hundredthsStr);
			return minutes * 60 + seconds + hundredths / 100;
		};

		textLines.forEach((line) => {
			if (!line.trim()) return;

			// Find line timestamp
			const lineTimeMatch = line.match(lineTimeRegex);
			let lineTime = 0;
			
			if (lineTimeMatch) {
				// Parse line time: minutes, seconds, centiseconds
				const minutesStr = lineTimeMatch[1];
				const secondsStr = lineTimeMatch[2];
				const hundredthsStr = lineTimeMatch[3];
				if (minutesStr && secondsStr && hundredthsStr) {
					const minutes = parseInt(minutesStr);
					const seconds = parseInt(secondsStr);
					const hundredths = parseInt(hundredthsStr);
					lineTime = minutes * 60 + seconds + hundredths / 100;
				}
			}

			// Remove line timestamp, retaining character timestamps and text
			let processedLine = line.replace(lineTimeRegex, "");

			const stampSet = new Set<number>();
			if (lineTime > 0) {
				stampSet.add(lineTime);
			}

			// Parse character timestamps
			const chars: ExtendedLyricChar[] = [];
			const matches = [...processedLine.matchAll(charTimeRegex)];
			for (const m of matches) {
				const t = parseTagToSeconds(m);
				if (t !== null) stampSet.add(t);
			}

			if (matches.length === 0) {
				// If no character timestamps, treat line as single group (preserving spaces)
				if (processedLine.trim().length > 0) {
					for (const char of processedLine) {
						chars.push({ char, time: lineTime });
					}
				}
			} else {
				// Has character timestamps, parse time for each character
				let lastIndex = 0;
				let lastTime = lineTime;

				matches.forEach((match) => {
					const time = parseTagToSeconds(match);
					if (time === null) {
						return;
					}

					// Get text preceding current timestamp
					const matchIndex = match.index ?? 0;
					const beforeText = processedLine.substring(lastIndex, matchIndex);

					// Associate each character with preceding timestamp
					for (const char of beforeText) {
						chars.push({ char, time: lastTime });
					}

					// Update index and timestamp
					const matchLength = match[0]?.length ?? 0;
					lastIndex = matchIndex + matchLength;
					lastTime = time;
				});

				// Handle remaining text after last timestamp
				const remainingText = processedLine.substring(lastIndex);
				for (const char of remainingText) {
					chars.push({ char, time: lastTime });
				}
			}

			const lineTimeStamps = [...stampSet].sort((a, b) => a - b);

			// Add parsed characters to result
			if (chars.length > 0) {
				// Generate plain text (all timestamps stripped)
				const text = chars.map((c) => c.char).join("");

				// If no line time, use first character's time
				const finalLineTime = lineTime > 0 ? lineTime : (chars[0]?.time || 0);

				lines.push({
					time: finalLineTime,
					chars,
					text,
					lineTimeStamps,
				});
			}
		});

		// Sort by timestamp
		return lines.sort((a, b) => a.time - b.time);
	}
}
