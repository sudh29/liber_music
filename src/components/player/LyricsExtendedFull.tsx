/**
 * Word-by-word synchronized lyrics full view component
 * 
 * Displays the complete word-by-word lyrics list, supporting:
 * - Auto-scroll to currently playing lyric line
 * - Highlight currently playing lyric line
 * - Word-by-word highlighted karaoke effect
 * - Click lyric line to seek to corresponding timestamp
 */

import React from "react";
import { Notice } from "obsidian";
import "./LyricsExtendedFull.css";
import type { ExtendedLyricLine } from "@/utils/lyrics/extendedParser";
import { linearFillProgress } from "@/utils/lyrics/charFillProgress";
import { buildKaraokeUnits } from "@/utils/lyrics/karaokeUnits";
import { t } from "@/utils/i18n/i18n";
import { generateLyricMarkdownLink } from "@/utils/protocol/uri";
import { copyTextToClipboard } from "@/utils/ui/clipboard";

/**
 * Props interface for LyricsExtendedFull component
 */
export interface LyricsExtendedFullProps {
	/** Full list of extended lyric lines */
	fullLyrics: ExtendedLyricLine[];
	/** Current playback time in seconds, used to compute word fill progress */
	currentTime: number;
	/** Currently active lyric line index (used for scroll positioning) */
	activeIndex: number;
	/** Currently playing lyric line index, used for enlarged highlight */
	playingIndex: number;
	/** Callback function to toggle display mode */
	onToggleMode: () => void;
	/** Seek callback when a lyric line is clicked (does not force playback to start) */
	onSeek: (time: number) => void;
	/** Ref to scroll container */
	scrollRef: React.RefObject<HTMLDivElement>;
	/** Array of line refs for scroll targeting */
	lineRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
	/** Current playing track path */
	currentPath?: string | null;
	/** Current track title */
	trackTitle?: string;
}

/**
 * Props interface for LineComponent (internal, memoized)
 */
interface LineProps {
	line: ExtendedLyricLine;
	index: number;
	currentTime: number;
	isActive: boolean;
	isPlaying: boolean;
	playingIndex: number;
	onSeek: (time: number) => void;
	lineRef: (el: HTMLDivElement | null) => void;
	currentPath?: string | null;
	trackTitle?: string;
}

const LineComponent = React.memo(({ line, index, currentTime, isActive, isPlaying, playingIndex, onSeek, lineRef, currentPath, trackTitle }: LineProps) => {
	const unitsData = React.useMemo(() => buildKaraokeUnits(line.chars, line), [line]);

	// Calculate progress for each character, only when current line is active
	const shouldCalculateProgress = isActive || isPlaying;
	
	// Determine if lyric line has already played (index < playingIndex)
	const isPlayed = playingIndex >= 0 && index < playingIndex;
	
	return (
		<div
			ref={lineRef}
			className={`lyrics-extended-line ${isActive ? "is-active" : ""} ${isPlaying ? "is-playing" : ""} ${isPlayed ? "is-played" : ""}`}
		>
			<div
				className="lyrics-extended-text"
				onClick={(e) => {
					e.stopPropagation();
					if (Number.isFinite(line.time)) {
						onSeek(line.time);
					}
				}}
			>
				{unitsData.map(({ text, charTime, charEndTime }, unitIndex) => {
					const fillProgress = isPlayed
						? 1
						: shouldCalculateProgress
							? linearFillProgress(currentTime, charTime, charEndTime)
							: currentTime >= charEndTime
								? 1
								: 0;
					const isWs = text.length === 1 && /\s/.test(text);
					const isWordUnit =
						!isWs && text.length > 1 && /^[A-Za-z0-9'-]+$/.test(text);

					return (
						<span
							key={unitIndex}
							className={`lyrics-extended-char${isWs ? " is-ws" : ""}${
								isWordUnit ? " is-word-unit" : ""
							}`}
						>
							<span className="lyrics-extended-char-bg">{text}</span>
							<span
								className="lyrics-extended-char-fill-clip"
								style={{ width: `${fillProgress * 100}%` }}
							>
								<span className="lyrics-extended-char-fill">{text}</span>
							</span>
						</span>
					);
				})}
			</div>
			{currentPath && Number.isFinite(line.time) && (
				<button
					type="button"
					className="lyrics-copy-btn"
					title={t("playback.copyTimestampLink")}
					aria-label={t("playback.copyTimestampLink")}
					onClick={(e) => {
						e.stopPropagation();
						const lineText = line.chars ? line.chars.map((c) => c.char).join("") : "";
						const link = generateLyricMarkdownLink(currentPath, line.time, lineText, trackTitle);
						void copyTextToClipboard(link).then((success) => {
							if (success) {
								new Notice(t("playback.copiedTimestampLink"));
							}
						});
					}}
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
					</svg>
				</button>
			)}
		</div>
	);
}, (prevProps, nextProps) => {
	if (prevProps.index !== nextProps.index) return false;
	if (prevProps.line !== nextProps.line) return false;
	if (prevProps.isActive !== nextProps.isActive) return false;
	if (prevProps.isPlaying !== nextProps.isPlaying) return false;
	if (prevProps.playingIndex !== nextProps.playingIndex) return false;
	if (prevProps.currentTime !== nextProps.currentTime) return false;
	if (prevProps.currentPath !== nextProps.currentPath) return false;
	if (prevProps.trackTitle !== nextProps.trackTitle) return false;
	return true;
});

LineComponent.displayName = 'LineComponent';

export function LyricsExtendedFull({
	fullLyrics,
	currentTime,
	activeIndex,
	playingIndex,
	onToggleMode,
	onSeek,
	scrollRef,
	lineRefs,
	currentPath,
	trackTitle,
}: LyricsExtendedFullProps) {
	// Place half-container-height padding at top and bottom so the first and last
	// lines can be scrolled to the center (consistent with LyricsFull;
	// without spacer, Math.max(0, ...) clamps the first line to the top)
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
	if (!fullLyrics || fullLyrics.length === 0) {
		return (
			<div className="lyrics-extended lyrics-extended-empty">
				<span className="lyrics-extended-empty-text">{t("playback.noSyncedLyrics")}</span>
			</div>
		);
	}

	return (
		<div
			className="lyrics-extended lyrics-extended-scroll"
			ref={scrollRef}
			style={{
				paddingTop: 0,
				paddingBottom: 0,
			}}
		>
			{/* Top and bottom spacer padding (.lyrics-spacer defined in LyricsFull.css, globally active) */}
			<div className="lyrics-spacer" style={{ height: halfHeight }} aria-hidden="true" />
			{fullLyrics.map((line, index) => (
				<LineComponent
					key={index}
					line={line}
					index={index}
					currentTime={currentTime}
					isActive={index === activeIndex}
					isPlaying={index === playingIndex}
					playingIndex={playingIndex}
					onSeek={onSeek}
					lineRef={(el) => {
						lineRefs.current[index] = el;
					}}
					currentPath={currentPath}
					trackTitle={trackTitle}
				/>
			))}
			<div className="lyrics-spacer" style={{ height: halfHeight }} aria-hidden="true" />
		</div>
	);
}

