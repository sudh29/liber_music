/**
 * Determines whether a lyric text snippet resembles word-by-word/karaoke or standard line-by-line LRC.
 *
 * Word-by-word: Angle bracket timestamps <mm:ss.xx> appear within a line, or two or more [mm:ss.xx] appear in one line.
 * Line-by-line: Typically only one leading [mm:ss.xx] per line with no angle bracket timestamps.
 */
export function isTimestampedKaraokeLyrics(text: string): boolean {
	if (!text?.trim()) return false;
	if (/<\d{2}:\d{2}\.\d{2}>/.test(text)) return true;
	for (const line of text.split(/\r?\n/)) {
		const tags = line.match(/\[\d{2}:\d{2}\.\d{2}\]/g);
		if (tags && tags.length >= 2) return true;
	}
	return false;
}
