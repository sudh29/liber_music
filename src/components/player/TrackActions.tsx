/**
 * Track actions component
 * 
 * Provides action buttons for the currently playing track, including:
 * - Add to playlist
 * - Toggle favorite status
 * - Volume control (0%–100%)
 * - Playback rate control (0.5x–2.0x)
 * 
 * Supports popups for volume and playback rate adjustments.
 */

import React from "react";
import "./TrackActions.css";
import { IconButton } from "@/components/shared/IconButton";
import { setIcon } from "obsidian";
import { t } from "@/utils/i18n/i18n";

import { StarRating } from "./StarRating";

/**
 * Props interface for TrackActions component
 */
export interface TrackActionsProps {
	/** Path of currently playing track */
	currentPath: string | null;
	/** Optional section ID to update list context */
	sectionId?: string | null;
	/** Whether the track is favorited */
	isFavorite: boolean;
	/** Current volume (0-1) */
	volume: number;
	/** Current playback rate (0.5-2.0) */
	playbackRate: number;
	/** Artwork display mode ('vinyl' | 'card') */
	artworkDisplayMode?: "vinyl" | "card";
	/** Current track rating (0 - 5) */
	rating?: number;
	/** Callback function to add track to playlist */
	onAddToPlaylist: (path: string, sectionId?: string) => void;
	/** Callback function to toggle favorite status */
	onToggleFavorite: (path: string, sectionId?: string) => void;
	/** Callback function on volume change */
	onVolumeChange: (volume: number) => void;
	/** Callback function on playback rate change */
	onPlaybackRateChange: (rate: number) => void;
	/** Callback function to toggle artwork display mode */
	onToggleArtworkDisplayMode?: () => void;
	/** Callback function to set track rating */
	onRate?: (rating: number) => void;
	/** Callback function to open 10-band equalizer modal */
	onOpenEqualizer?: () => void;
}

/**
 * Track actions component
 * 
 * Displays action buttons and popups for current track: add to playlist, favorite, volume, and playback rate.
 * 
 * @param props Component properties
 */
export function TrackActions({
	currentPath,
	sectionId,
	isFavorite,
	volume,
	playbackRate,
	artworkDisplayMode = "vinyl",
	rating = 0,
	onAddToPlaylist,
	onToggleFavorite,
	onVolumeChange,
	onPlaybackRateChange,
	onToggleArtworkDisplayMode,
	onRate,
	onOpenEqualizer,
}: TrackActionsProps) {
	const [isVolumeMenuVisible, setIsVolumeMenuVisible] = React.useState(false);
	const [isPlaybackRateMenuVisible, setIsPlaybackRateMenuVisible] = React.useState(false);
	const [isVolumeDragging, setIsVolumeDragging] = React.useState(false);
	const volumeButtonRef = React.useRef<HTMLButtonElement>(null);
	const volumeMenuRef = React.useRef<HTMLDivElement>(null);
	const volumeTrackRef = React.useRef<HTMLDivElement>(null);
	const playbackRateButtonRef = React.useRef<HTMLButtonElement>(null);
	const playbackRateMenuRef = React.useRef<HTMLDivElement>(null);

	// Set volume icon: use volume-x when 0, otherwise volume-2
	React.useEffect(() => {
		if (volumeButtonRef.current && currentPath) {
			if (volume === 0) {
				setIcon(volumeButtonRef.current, "volume-x");
			} else {
				setIcon(volumeButtonRef.current, "volume-2");
			}
		}
	}, [volume, currentPath]);

	// Set playback rate icon
	React.useEffect(() => {
		if (playbackRateButtonRef.current && currentPath) {
			setIcon(playbackRateButtonRef.current, "gauge-circle");
		}
	}, [currentPath]);

	const handleAddToPlaylist = React.useCallback(() => {
		if (currentPath) {
			onAddToPlaylist(currentPath, sectionId || undefined);
		}
	}, [currentPath, sectionId, onAddToPlaylist]);

	const handleToggleFavorite = React.useCallback(() => {
		if (currentPath) {
			onToggleFavorite(currentPath, sectionId || undefined);
		}
	}, [currentPath, sectionId, onToggleFavorite]);

	// Calculate volume (0-1) from pointer clientY; vertical slider with 100% at the top
	const updateVolumeFromY = React.useCallback((clientY: number) => {
		const track = volumeTrackRef.current;
		if (!track) return;
		const rect = track.getBoundingClientRect();
		const ratio = 1 - (clientY - rect.top) / rect.height;
		const clamped = Math.max(0, Math.min(1, ratio));
		onVolumeChange(Math.round(clamped * 100) / 100);
	}, [onVolumeChange]);

	// Intercept touchmove while dragging (non-passive + preventDefault) to prevent WebView scrolling
	React.useEffect(() => {
		if (!isVolumeDragging) return;
		const blockTouchMove = (e: TouchEvent) => {
			e.preventDefault();
		};
		window.activeDocument.addEventListener("touchmove", blockTouchMove, { passive: false });
		return () => {
			window.activeDocument.removeEventListener("touchmove", blockTouchMove);
		};
	}, [isVolumeDragging]);

	// Pointer down on track or thumb - begin dragging (supports mouse and touch)
	const handleVolumePointerDown = React.useCallback((e: React.PointerEvent) => {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		setIsVolumeDragging(true);
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			// Continue even if capture fails
		}
		updateVolumeFromY(e.clientY);
	}, [updateVolumeFromY]);

	// Pointer move during drag: continuous updates via pointer capture
	const handleVolumePointerMove = React.useCallback((e: React.PointerEvent) => {
		if (!isVolumeDragging) return;
		e.preventDefault();
		e.stopPropagation();
		updateVolumeFromY(e.clientY);
	}, [isVolumeDragging, updateVolumeFromY]);

	// Pointer up: release pointer capture and end drag
	const handleVolumePointerUp = React.useCallback((e: React.PointerEvent) => {
		if (!isVolumeDragging) return;
		e.stopPropagation();
		try {
			if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
				(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
			}
		} catch {
			// Ignore if already released
		}
		setIsVolumeDragging(false);
	}, [isVolumeDragging]);

	const handleVolumeButtonClick = React.useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		setIsVolumeMenuVisible(prev => !prev);
		setIsPlaybackRateMenuVisible(false);
	}, []);

	const handlePlaybackRateButtonClick = React.useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		setIsPlaybackRateMenuVisible(prev => !prev);
		setIsVolumeMenuVisible(false);
	}, []);

	const handlePlaybackRateSelect = React.useCallback((rate: number) => {
		onPlaybackRateChange(rate);
		setIsPlaybackRateMenuVisible(false);
	}, [onPlaybackRateChange]);

	// Dismiss volume and playback rate menus when clicking outside
	React.useEffect(() => {
		if (!isVolumeMenuVisible && !isPlaybackRateMenuVisible) return;

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			
			// Check if click was inside volume button or menu
			const isClickInsideVolume = 
				(volumeButtonRef.current?.contains(target)) ||
				(volumeMenuRef.current?.contains(target));
			
			// Check if click was inside playback rate button or menu
			const isClickInsidePlaybackRate =
				(playbackRateButtonRef.current?.contains(target)) ||
				(playbackRateMenuRef.current?.contains(target));
			
			// Close volume menu if clicked outside
			if (isVolumeMenuVisible && !isClickInsideVolume) {
				setIsVolumeMenuVisible(false);
			}
			
			// Close playback rate menu if clicked outside
			if (isPlaybackRateMenuVisible && !isClickInsidePlaybackRate) {
				setIsPlaybackRateMenuVisible(false);
			}
		};

		window.activeDocument.addEventListener("mousedown", handleClickOutside);
		return () => window.activeDocument.removeEventListener("mousedown", handleClickOutside);
	}, [isVolumeMenuVisible, isPlaybackRateMenuVisible]);

	if (!currentPath) {
		return null;
	}

	const playbackRateOptions = [2.0, 1.5, 1.0, 0.75, 0.5];
	const displayVolumePercent = Math.round(volume * 100);

	return (
		<div className="track-actions-container" onClick={(e) => e.stopPropagation()}>
			<div className="track-actions-left">
				<IconButton
					icon="list-plus"
					label={t("track.addToPlaylist")}
					className="track-action-btn clickable-icon"
					onClick={handleAddToPlaylist}
				/>

				<div className="playback-rate-control-wrapper">
					<button
						ref={playbackRateButtonRef}
						className="track-action-btn clickable-icon playback-rate-btn"
						aria-label={t("playback.rate")}
						onClick={handlePlaybackRateButtonClick}
					/>
					{isPlaybackRateMenuVisible && (
						<div ref={playbackRateMenuRef} className="playback-rate-menu-popup">
							{playbackRateOptions.map((rate) => (
								<button
									key={rate}
									className={`playback-rate-option ${Math.abs(playbackRate - rate) < 0.01 ? "active" : ""}`}
									onClick={() => handlePlaybackRateSelect(rate)}
								>
									{rate.toFixed(1)}x
								</button>
							))}
						</div>
					)}
				</div>

				{onToggleArtworkDisplayMode && (
					<IconButton
						icon={artworkDisplayMode === "vinyl" ? "image" : "disc"}
						label={artworkDisplayMode === "vinyl" ? "Switch to Album Card mode" : "Switch to Vinyl Disc mode"}
						className="track-action-btn clickable-icon artwork-mode-btn"
						onClick={onToggleArtworkDisplayMode}
					/>
				)}

				{onOpenEqualizer && (
					<IconButton
						icon="sliders-horizontal"
						label={t("equalizer.title") || "10-Band Equalizer"}
						className="track-action-btn clickable-icon equalizer-btn"
						onClick={onOpenEqualizer}
					/>
				)}
			</div>

			<div className="track-actions-center">
				<StarRating rating={rating} onRate={onRate} />
			</div>

			<div className="track-actions-right">
				<div className="volume-control-wrapper">
					<button
						ref={volumeButtonRef}
						className="track-action-btn clickable-icon volume-btn"
						aria-label={t("playback.volume")}
						onClick={handleVolumeButtonClick}
					/>
					{isVolumeMenuVisible && (
						<div ref={volumeMenuRef} className="volume-menu-popup volume-slider-popup">
							<span className="volume-slider-value">{displayVolumePercent}%</span>
							<div
								ref={volumeTrackRef}
								className="volume-slider-track"
								onPointerDown={handleVolumePointerDown}
								onPointerMove={handleVolumePointerMove}
								onPointerUp={handleVolumePointerUp}
								onPointerCancel={handleVolumePointerUp}
							>
								<div
									className="volume-slider-fill"
									style={{ height: `${displayVolumePercent}%` }}
								/>
								<div
									className="volume-slider-thumb"
									style={{ bottom: `${displayVolumePercent}%` }}
									onPointerDown={handleVolumePointerDown}
								/>
							</div>
						</div>
					)}
				</div>

				<IconButton
					icon="heart"
					label={isFavorite ? t("track.removeFavorite") : t("track.addFavorite")}
					className={`track-action-btn clickable-icon ${isFavorite ? "active" : ""}`}
					onClick={handleToggleFavorite}
				/>
			</div>
		</div>
	);
}

