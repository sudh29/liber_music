/**
 * Lyrics index calculation hook
 * 
 * Computes active playing lyric line index based on current playback time.
 */

import * as React from "react";
import type { LyricLine } from "@/utils/lyrics/parser";
import type { ExtendedLyricLine } from "@/utils/lyrics/extendedParser";
import { calculateLyricsIndex } from "@/utils/lyrics/indexCalculator";

export interface UseLyricsIndexOptions {
	/** Standard lyrics list */
	fullLyrics: LyricLine[];
	/** Word-by-word lyrics list */
	fullExtendedLyrics: ExtendedLyricLine[];
	/** Current playback time in seconds */
	currentTime: number;
}

/**
 * Lyrics index calculation hook
 * 
 * @param options Lyrics data and playback time
 * @returns Active playing lyric line index (-1 if no matching lyric)
 */
export function useLyricsIndex({
	fullLyrics,
	fullExtendedLyrics,
	currentTime,
}: UseLyricsIndexOptions): number {
	const playingIndex = React.useMemo(() => {
		return calculateLyricsIndex({
			fullLyrics,
			fullExtendedLyrics,
			currentTime,
		});
	}, [fullLyrics, fullExtendedLyrics, currentTime]);

	return playingIndex;
}
