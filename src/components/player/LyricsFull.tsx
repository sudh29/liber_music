/**
 * Full lyrics list component
 * 
 * Displays the full lyrics list, supporting:
 * - Auto-scroll to currently playing lyric line
 * - Highlight currently playing lyric line
 * - Click lyric line to seek to timestamp
 */

import React from "react";
import "./LyricsFull.css";
import type { LyricLine } from "@/utils/lyrics/parser";
import { t } from "@/utils/i18n/i18n";

/**
 * Props interface for LyricsFull component
 */
export interface LyricsFullProps {
	/** Full list of lyric lines */
	fullLyrics: LyricLine[];
	/** Currently active lyric line index (used for scroll positioning) */
	activeIndex: number;
	/** Currently playing lyric line index, used for enlarged font highlight */
	playingIndex: number;
	/** Callback function to toggle display mode */
	onToggleMode: () => void;
	/** Seek callback when a lyric line is clicked (does not force playback to start) */
	onSeek: (time: number) => void;
	/** Ref to scroll container */
	scrollRef: React.RefObject<HTMLDivElement>;
	/** Array of line refs for scroll targeting */
	lineRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

/**
 * Full lyrics list component
 * 
 * Displays full lyrics list, supporting auto-scroll, highlights, and click seeking.
 * 
 * @param props Component properties
 */
export function LyricsFull({
	fullLyrics,
	activeIndex,
	playingIndex,
	onToggleMode,
	onSeek,
	scrollRef,
	lineRefs,
}: LyricsFullProps) {
	// Place half-container-height padding at top and bottom so the first and last
	// lines can be scrolled to the center (otherwise first line clamps to top, last to bottom)
	// Note: hooks must be called before early return to avoid React "rendered fewer hooks than expected" error
	const [halfHeight, setHalfHeight] = React.useState(0);
	React.useLayoutEffect(() => {
		const container = scrollRef.current;
		if (!container) return;
		const update = () => setHalfHeight(container.clientHeight / 2);
		update();
		const ro = new ResizeObserver(update);
		ro.observe(container);
		return () => ro.disconnect();
	}, [scrollRef, fullLyrics]);

	// If no lyrics, display placeholder message
	// Do not intercept clicks on empty state; let parent onClick handle it (switch to disc view)
	if (!fullLyrics || fullLyrics.length === 0) {
		return (
			<div className="lyrics lyrics-empty">
				<span className="lyrics-empty-text">{t("playback.noLyrics")}</span>
			</div>
		);
	}

	return (
		<div className="lyrics lyrics-scroll" ref={scrollRef}>
			<div className="lyrics-spacer" style={{ height: halfHeight }} aria-hidden="true" />
			{fullLyrics.map((line, index) => {
				// Text has been sanitized prior to storage in LyricsService (including bracket noise); display directly
				const displayText = line.text;
				const isActive = index === activeIndex;
				const isPlaying = index === playingIndex;
				const isPlayed = playingIndex >= 0 && index < playingIndex;
				return (
					<div
						key={index}
						ref={(el) => {
							lineRefs.current[index] = el;
						}}
						className={`lyrics-line ${isActive ? "is-active" : ""} ${isPlaying ? "is-playing" : ""} ${isPlayed ? "is-played" : ""}`}
					>
						<span
							className="lyrics-text"
							onClick={(e) => {
								e.stopPropagation();
								if (Number.isFinite(line.time)) {
									onSeek(line.time);
								}
							}}
						>
							{displayText}
						</span>
					</div>
				);
			})}
			<div className="lyrics-spacer" style={{ height: halfHeight }} aria-hidden="true" />
		</div>
	);
}

