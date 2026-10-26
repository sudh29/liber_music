/**
 * Playback controls component
 * 
 * Provides basic music playback controls, including:
 * - Play/pause button
 * - Previous/next track buttons
 * - Play mode toggle button (sequential, repeat all, repeat one, shuffle)
 * - Queue / playlist view button
 */

import React from "react";
import type { PlayMode } from "@/main";
import { setIcon } from "obsidian";
import { t } from "@/utils/i18n/i18n";

/**
 * Props interface for PlaybackControls component
 */
export interface PlaybackControlsProps {
	/** Whether playback is currently active */
	isPlaying: boolean;
	/** Current play mode */
	playMode: PlayMode;
	/** Callback function to toggle play/pause */
	onTogglePlay: () => void;
	/** Callback function to play previous track */
	onPrev: () => void;
	/** Callback function to play next track */
	onNext: () => void;
	/** Callback function to toggle play mode */
	onToggleMode: () => void;
	/** Callback function to open playback queue */
	onOpenPlaylist: () => void;
}

/**
 * Get accessibility label for play mode
 */
function playModeLabel(mode: PlayMode): string {
	if (mode === "repeat-one") return t("playback.mode.repeatOne");
	if (mode === "repeat-all") return t("playback.mode.repeatAll");
	if (mode === "shuffle") return t("playback.mode.shuffle");
	return t("playback.mode.normal");
}

/**
 * Get Obsidian icon name corresponding to play mode
 * 
 * @param mode Play mode
 * @returns Icon name
 */
function playModeIcon(mode: PlayMode): string {
	if (mode === "repeat-one") return "repeat-1";
	if (mode === "repeat-all") return "repeat";
	if (mode === "shuffle") return "shuffle";
	return "list-ordered"; // Sequential playback
}

/**
 * Set Obsidian icon on button element
 * 
 * @param ref Button element ref
 * @param icon Icon name
 */
function setButtonIcon(ref: React.RefObject<HTMLElement>, icon: string) {
	if (ref.current) setIcon(ref.current, icon);
}

/**
 * Playback controls component
 * 
 * Displays playback control buttons: play/pause, prev/next, play mode toggle, and queue modal.
 * 
 * @param props Component properties
 */
export function PlaybackControls(props: PlaybackControlsProps) {
	const { isPlaying, playMode, onTogglePlay, onPrev, onNext, onToggleMode, onOpenPlaylist } = props;

	const modeRef = React.useRef<HTMLButtonElement | null>(null);
	const prevRef = React.useRef<HTMLButtonElement | null>(null);
	const playPauseRef = React.useRef<HTMLButtonElement | null>(null);
	const nextRef = React.useRef<HTMLButtonElement | null>(null);
	const playlistRef = React.useRef<HTMLButtonElement | null>(null);

	// Set Obsidian built-in icons
	React.useEffect(() => {
		setButtonIcon(modeRef, playModeIcon(playMode));
		setButtonIcon(prevRef, "skip-back");
		setButtonIcon(nextRef, "skip-forward");
		setButtonIcon(playPauseRef, isPlaying ? "pause" : "play");
		setButtonIcon(playlistRef, "list-music");
	}, [playMode, isPlaying]);

	return (
		<div className="controls-row" onClick={(e) => e.stopPropagation()}>
			<button
				ref={modeRef}
				className="play-control-btn clickable-icon"
				aria-label={playModeLabel(playMode)}
				onClick={onToggleMode}
			>
				<div className="mode-tooltip">{playModeLabel(playMode)}</div>
			</button>

			<button ref={prevRef} className="play-control-btn clickable-icon" aria-label={t("playback.prev")} onClick={onPrev}>
			</button>

			<button
				ref={playPauseRef}
				className="play-control-btn clickable-icon play-pause-btn"
				onClick={onTogglePlay}
				aria-label={isPlaying ? t("playback.pause") : t("playback.play")}
			>
			</button>

			<button ref={nextRef} className="play-control-btn clickable-icon" aria-label={t("playback.next")} onClick={onNext}>
			</button>

			<button
				ref={playlistRef}
				className="play-control-btn clickable-icon"
				aria-label={t("playback.queue")}
				onClick={onOpenPlaylist}
			>
			</button>
		</div>
	);
}

