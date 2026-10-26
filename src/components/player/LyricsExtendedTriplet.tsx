/**
 * Word-by-word synchronized lyrics triplet view component
 * 
 * Displays three lines of word-by-word lyrics (prev, current, next), supporting word-by-word karaoke highlights.
 * The current line is highlighted word-by-word, while other lines display plain text.
 */

import React from "react";
import "./LyricsExtendedTriplet.css";
import type { ExtendedLyricLine } from "@/utils/lyrics/extendedParser";
import { linearFillProgress } from "@/utils/lyrics/charFillProgress";
import { buildKaraokeUnits } from "@/utils/lyrics/karaokeUnits";

/**
 * Props interface for LyricsExtendedTriplet component
 */
export interface LyricsExtendedTripletProps {
	/** Previous line of extended lyrics */
	prev?: ExtendedLyricLine;
	/** Current line of extended lyrics */
	current?: ExtendedLyricLine;
	/** Next line of extended lyrics */
	next?: ExtendedLyricLine;
	/** Current playback time in seconds, used to compute word fill progress */
	currentTime: number;
}

/**
 * Props interface for LineComponent (internal)
 */
interface LineComponentProps {
	line?: ExtendedLyricLine;
	currentTime: number;
	isCurrent: boolean;
}

const LineComponent = React.memo(({ line, currentTime, isCurrent }: LineComponentProps) => {
	if (!line) {
		return <span className="lyric-text"></span>;
	}

	const unitsData = React.useMemo(() => {
		if (!isCurrent || !line.chars.length) return [];
		return buildKaraokeUnits(line.chars, line);
	}, [line, isCurrent]);

	// For non-current lines, display plain text (no word-by-word effect needed)
	if (!isCurrent) {
		return (
			<span className="lyrics-extended-triplet-text lyrics-extended-triplet-plain">
				{line.text}
			</span>
		);
	}

	// Current line: reveal highlight from left to right (clip + width, avoiding scaleX distortion on Latin characters)
	return (
		<div className="lyrics-extended-triplet-text lyrics-extended-triplet-karaoke">
			{unitsData.map(({ text, charTime, charEndTime }, unitIndex) => {
				const fillProgress = linearFillProgress(currentTime, charTime, charEndTime);
				const isWs = text.length === 1 && /\s/.test(text);
				const isWordUnit =
					!isWs && text.length > 1 && /^[A-Za-z0-9'-]+$/.test(text);

				return (
					<span
						key={unitIndex}
						className={`lyrics-extended-triplet-char${isWs ? " is-ws" : ""}${
							isWordUnit ? " is-word-unit" : ""
						}`}
					>
						<span className="lyrics-extended-triplet-char-bg">{text}</span>
						<span
							className="lyrics-extended-triplet-char-fill-clip"
							style={{ width: `${fillProgress * 100}%` }}
						>
							<span className="lyrics-extended-triplet-char-fill">{text}</span>
						</span>
					</span>
				);
			})}
		</div>
	);
}, (prevProps, nextProps) => {
	if (prevProps.line !== nextProps.line) return false;
	if (prevProps.isCurrent !== nextProps.isCurrent) return false;
	if (prevProps.isCurrent && prevProps.currentTime !== nextProps.currentTime) return false;
	return true;
});

LineComponent.displayName = 'LineComponent';

/**
 * Word-by-word synchronized lyrics triplet view component
 * 
 * Displays three lines of word-by-word lyrics, supporting karaoke word-by-word highlights on the current line.
 * 
 * @param props Component properties
 */
export function LyricsExtendedTriplet({ 
	prev, 
	current, 
	next, 
	currentTime 
}: LyricsExtendedTripletProps) {
	return (
		<div className="lyrics-triplet">
			<div className="lyric-line-prev">
				<LineComponent line={prev} currentTime={currentTime} isCurrent={false} />
			</div>
			<div className="lyric-line-current">
				<LineComponent line={current} currentTime={currentTime} isCurrent={true} />
			</div>
			<div className="lyric-line-next">
				<LineComponent line={next} currentTime={currentTime} isCurrent={false} />
			</div>
		</div>
	);
}

