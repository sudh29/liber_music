/**
 * Full lyrics list component
 * 
 * Displays the full lyrics list, supporting:
 * - Auto-scroll to currently playing lyric line
 * - Highlight currently playing lyric line
 * - Click lyric line to seek to timestamp
 */

import React from "react";
import { Notice } from "obsidian";
import "./LyricsFull.css";
import type { LyricLine } from "@/utils/lyrics/parser";
import { t } from "@/utils/i18n/i18n";
import { generateLyricMarkdownLink } from "@/utils/protocol/uri";
import { copyTextToClipboard } from "@/utils/ui/clipboard";

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
	/** Current playing track path (for deep-linking) */
	currentPath?: string | null;
	/** Current track title */
	trackTitle?: string;
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
	currentPath,
	trackTitle,
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

	const handleCopyLyricLink = (e: React.MouseEvent, line: LyricLine) => {
		e.stopPropagation();
		if (!currentPath) return;
		const link = generateLyricMarkdownLink(currentPath, line.time, line.text, trackTitle);
		void copyTextToClipboard(link).then((success) => {
			if (success) {
				new Notice(t("playback.copiedTimestampLink"));
			}
		});
	};

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
						{currentPath && Number.isFinite(line.time) && (
							<button
								type="button"
								className="lyrics-copy-btn"
								title={t("playback.copyTimestampLink")}
								aria-label={t("playback.copyTimestampLink")}
								onClick={(e) => handleCopyLyricLink(e, line)}
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
									<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
									<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
								</svg>
							</button>
						)}
					</div>
				);
			})}
			<div className="lyrics-spacer" style={{ height: halfHeight }} aria-hidden="true" />
		</div>
	);
}

