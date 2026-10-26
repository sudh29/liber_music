/**
 * LRC lyric offset ([offset:±ms]) parsing and application module.
 * 
 * Matches standard music player behavior:
 * - Offset is a lyric parameter and not rendered in lyric text
 * - Positive offset advances the lyrics (subtracts offset from all timestamps), negative offset delays lyrics
 */

import type { LyricLine } from "./parser";
import type { ExtendedLyricLine } from "./extendedParser";

/** Pattern for [offset:±ms] tags (case-insensitive, allows + sign and whitespace) */
const OFFSET_TAG_SOURCE = String.raw`\[\s*offset\s*:\s*([+-]?\d+)\s*\]`;

/** Timestamp lower bound to prevent negative time after offset application */
const MIN_TIME = 0;

/** Clamps time to not fall below 0 */
function clampTime(time: number): number {
	return time < MIN_TIME ? MIN_TIME : time;
}

/**
 * Parses offset value ([offset:±ms]) from lyric text, returning seconds.
 * 
 * Takes the first offset tag found; returns 0 if absent or malformed.
 * 
 * @param text Raw lyric text
 * @returns Offset in seconds, positive value means lyrics advance earlier
 */
export function parseLyricsOffset(text: string): number {
	if (!text) return 0;
	// Use non-global RegExp single match to avoid shared lastIndex state issues
	const match = new RegExp(OFFSET_TAG_SOURCE, "i").exec(text);
	const raw = match?.[1];
	if (!raw) return 0;
	const milliseconds = Number.parseInt(raw, 10);
	if (!Number.isFinite(milliseconds)) return 0;
	return milliseconds / 1000;
}

/**
 * Removes all [offset:...] tags from lyric text.
 * 
 * Offset is a parameter rather than content and should be stripped before parsing and display.
 * 
 * @param text Raw lyric text
 * @returns Text with offset tags removed
 */
export function stripLyricsOffsetTags(text: string): string {
	return text.replace(new RegExp(OFFSET_TAG_SOURCE, "gi"), "");
}

/**
 * Applies offset to parsed lyric data (modifies in place).
 * 
 * Line array is already sorted by time; uniform shift preserves order, clamping only the head to 0.
 * For word-by-word lyrics, line time, character times, and line timestamps are shifted together.
 * 
 * @param lyrics Standard lyric line array
 * @param extendedLyrics Extended lyric line array
 * @param offsetSeconds Offset in seconds, positive value means lyrics advance earlier
 */
export function applyLyricsOffset(
	lyrics: LyricLine[],
	extendedLyrics: ExtendedLyricLine[],
	offsetSeconds: number
): void {
	if (!offsetSeconds || !Number.isFinite(offsetSeconds)) return;

	for (const line of lyrics) {
		line.time = clampTime(line.time - offsetSeconds);
	}

	for (const line of extendedLyrics) {
		line.time = clampTime(line.time - offsetSeconds);
		for (const char of line.chars) {
			char.time = clampTime(char.time - offsetSeconds);
		}
		line.lineTimeStamps = line.lineTimeStamps.map((t) => clampTime(t - offsetSeconds));
	}
}
