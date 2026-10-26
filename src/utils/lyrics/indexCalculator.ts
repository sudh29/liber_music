/**
 * Lyrics index calculation utility function.
 * 
 * Centralizes lyric index calculation logic to avoid duplicate implementations.
 * Supports both standard lyrics and word-by-word timed lyrics, optimized with binary search.
 */

import type { LyricLine } from "@/utils/lyrics/parser";
import type { ExtendedLyricLine } from "@/utils/lyrics/extendedParser";

/**
 * Lyrics index calculator options interface.
 */
export interface LyricsIndexCalculatorOptions {
	/** Standard lyrics list (LRC format) */
	fullLyrics: LyricLine[];
	/** Word-by-word timed lyrics list (karaoke format parsed result) */
	fullExtendedLyrics: ExtendedLyricLine[];
	/** Current playback time (seconds) */
	currentTime: number;
}

/**
 * Calculates current playing lyric line index.
 * 
 * Uses binary search algorithm to find the lyric line to display based on current playback time.
 * Prioritizes word-by-word lyrics (if present), otherwise uses standard lyrics.
 * 
 * Advance display offset:
 * - Word-by-word lyrics: 0.2s advance (requires finer timing control)
 * - Standard lyrics: 0.5s advance (consistent with triplet view, shifts up before line starts)
 * 
 * @param options Lyric data and time options
 * @returns Index of the current lyric line to display, or -1 if no matching line
 * 
 * @example
 * ```typescript
 * const index = calculateLyricsIndex({
 *   fullLyrics: [...],
 *   fullExtendedLyrics: [...],
 *   currentTime: 12.5
 * });
 * // index: 2 (indicates 3rd line should be displayed)
 * ```
 */
export function calculateLyricsIndex({
	fullLyrics,
	fullExtendedLyrics,
	currentTime,
}: LyricsIndexCalculatorOptions): number {
	// Determine whether to use extended lyrics
	const useExtendedLyrics = fullExtendedLyrics && fullExtendedLyrics.length > 0;
	const lyricsToUse = useExtendedLyrics ? fullExtendedLyrics : fullLyrics;

	if (!lyricsToUse?.length) return -1;

	// For extended lyrics, shorter advance time (0.2s) for tighter synchronization
	// For standard lyrics, 0.5s advance to scroll line before vocal starts
	const advanceTime = useExtendedLyrics ? 0.2 : 0.5;
	const adjustedTime = currentTime + advanceTime;

	// Binary search for performance
	let left = 0;
	let right = lyricsToUse.length - 1;
	let result = -1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const cur = lyricsToUse[mid];
		const next = lyricsToUse[mid + 1];

		if (cur && adjustedTime >= cur.time) {
			if (!next || adjustedTime < next.time) {
				result = mid;
				break;
			}
			left = mid + 1;
		} else {
			right = mid - 1;
		}
	}

	return result;
}
