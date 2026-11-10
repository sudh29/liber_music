/**
 * Track header component
 * 
 * Displays song title and artist information, with integrated minimalist favorite heart button.
 */

import React from "react";
import "./TrackHeader.css";
import { setIcon } from "obsidian";
import { t } from "@/utils/i18n/i18n";

/**
 * Props interface for TrackHeader component
 */
export interface TrackHeaderProps {
	/** Track title */
	title: string;
	/** Artist name */
	artist: string;
	/** Whether the track is favorited */
	isFavorite?: boolean;
	/** Callback function to toggle favorite status */
	onToggleFavorite?: () => void;
}

/**
 * Track header component
 * 
 * Displays song title and artist information, with integrated minimalist favorite heart button.
 * 
 * @param props Component properties
 */
export function TrackHeader({ title, artist, isFavorite = false, onToggleFavorite }: TrackHeaderProps) {
	const favoriteBtnRef = React.useRef<HTMLButtonElement | null>(null);

	React.useEffect(() => {
		if (favoriteBtnRef.current) {
			setIcon(favoriteBtnRef.current, "heart");
		}
	}, [isFavorite]);

	return (
		<div className="track-header">
			<div className="track-header-info">
				<h2 className="track-title" title={title}>{title}</h2>
				<div className="artist-name" title={artist}>{artist}</div>
			</div>
			{onToggleFavorite && (
				<button
					ref={favoriteBtnRef}
					type="button"
					className={`track-header-favorite-btn clickable-icon ${isFavorite ? "is-favorite" : ""}`}
					aria-label={isFavorite ? t("track.removeFavorite") : t("track.addFavorite")}
					title={isFavorite ? t("track.removeFavorite") : t("track.addFavorite")}
					onClick={(e) => {
						e.stopPropagation();
						onToggleFavorite();
					}}
				/>
			)}
		</div>
	);
}
