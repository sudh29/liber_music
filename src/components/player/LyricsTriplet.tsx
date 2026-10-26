/**
 * Triplet lyrics view component
 * 
 * Displays previous, current, and next lines of lyrics for the disc view.
 * The current line is highlighted, providing a clean lyrics browsing experience.
 */

import React from "react";
import "./LyricsTriplet.css";

/**
 * Props interface for LyricsTriplet component
 */
export interface LyricsTripletProps {
	/** Previous line text */
	prev?: string;
	/** Current line text */
	current?: string;
	/** Next line text */
	next?: string;
}

/**
 * Triplet lyrics view component
 * 
 * Displays three lines of lyrics (prev, current, next), with current line highlighted.
 * 
 * @param props Component properties
 */
export function LyricsTriplet({ prev = "", current = "", next = "" }: LyricsTripletProps) {
	return (
		<div className="lyrics-triplet">
			<div className="lyric-line-prev">
				<span className="lyric-text">{prev}</span>
			</div>
			<div className="lyric-line-current">
				<span className="lyric-text">{current}</span>
			</div>
			<div className="lyric-line-next">
				<span className="lyric-text">{next}</span>
			</div>
		</div>
	);
}

