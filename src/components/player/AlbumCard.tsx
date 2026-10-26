/**
 * Modern Album Card component (2026 Standard)
 * 
 * Mode B artwork presentation:
 * - 16px rounded corner album art card
 * - Ambient mesh blur reflection backdrop
 * - Gentle subtle breathing glow on playback
 * - Smooth transition on track change
 */

import React from "react";
import "./AlbumCard.css";

export interface AlbumCardProps {
	/** Current cover image URL */
	coverUrl?: string;
	/** Track title */
	title?: string;
	/** Artist name */
	artist?: string;
	/** Whether track is playing */
	isPlaying: boolean;
	/** Callback to toggle play/pause */
	onTogglePlay?: () => void;
	/** Callback for previous track */
	onPrev?: () => void;
	/** Callback for next track */
	onNext?: () => void;
}

export function AlbumCard({
	coverUrl,
	title,
	isPlaying,
	onTogglePlay,
}: AlbumCardProps) {
	return (
		<div className="album-card-wrapper" onClick={onTogglePlay}>
			{/* Ambient mesh reflection backdrop */}
			{coverUrl ? (
				<div
					className={`album-card-ambient-backdrop ${isPlaying ? "is-playing" : ""}`}
					style={{ backgroundImage: `url("${coverUrl}")` }}
					aria-hidden="true"
				/>
			) : (
				<div className={`album-card-ambient-backdrop placeholder-glow ${isPlaying ? "is-playing" : ""}`} />
			)}

			{/* Main artwork card */}
			<div className={`album-card-surface ${isPlaying ? "is-playing" : ""}`}>
				{coverUrl ? (
					<img
						src={coverUrl}
						alt={title || "Album Art"}
						className="album-card-image"
						loading="eager"
					/>
				) : (
					<div className="album-card-placeholder">
						<span className="album-card-placeholder-icon">♪</span>
					</div>
				)}
				{/* Glass highlight sheen */}
				<div className="album-card-glass-sheen" />
			</div>
		</div>
	);
}
