/**
 * Raw lyric preprocessing: normalizes embedded tag text before passing to LRC/karaoke parsers.
 */

/**
 * Strips all text preceding the first `[mm:ss.xx]` timestamp (including centiseconds);
 * handles multi-line prefixes or inline left padding.
 * Returns text unchanged if pattern is not present. Used to remove [ar:], [hash:], [language:] non-song headers.
 */
export function stripLeadingLyricsMetadata(text: string): string {
	const match = /\[\d{2}:\d{2}\.\d{2}\]/.exec(text);
	if (!match || match.index === undefined) {
		return text;
	}
	return text.slice(match.index);
}
