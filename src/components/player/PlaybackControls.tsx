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
	/** Whether non-repeating shuffle is active */
	isShuffle?: boolean;
	/** Callback function to toggle play/pause */
	onTogglePlay: () => void;
	/** Callback function to play previous track */
	onPrev: () => void;
	/** Callback function to play next track */
	onNext: () => void;
	/** Callback function to toggle repeat mode */
	onToggleMode: () => void;
	/** Callback function to toggle shuffle */
	onToggleShuffle?: () => void;
	/** Callback function to open playback queue */
	onOpenPlaylist: () => void;
}

/**
 * Get accessibility label for play mode
 */
function playModeLabel(mode: PlayMode): string {
	if (mode === "repeat-one") return t("playback.mode.repeatOne");
	if (mode === "repeat-all") return t("playback.mode.repeatAll");
	return t("playback.mode.normal");
}

/**
 * Get Obsidian icon name corresponding to repeat mode
 * 
 * @param mode Play mode
 * @returns Icon name
 */
function playModeIcon(mode: PlayMode): string {
	if (mode === "repeat-one") return "repeat-1";
	return "repeat";
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
 * 2026 Layout:
 * [Shuffle (Dedicated Toggle)] [Previous] [Play / Pause (Hero Accent)] [Next] [Repeat (Off / All / One)] [Queue Modal]
 * 
 * @param props Component properties
 */
export function PlaybackControls(props: PlaybackControlsProps) {
	const {
		isPlaying,
		playMode,
		isShuffle = false,
		onTogglePlay,
		onPrev,
		onNext,
		onToggleMode,
		onToggleShuffle,
		onOpenPlaylist,
	} = props;

	const shuffleIconRef = React.useRef<HTMLSpanElement | null>(null);
	const prevRef = React.useRef<HTMLButtonElement | null>(null);
	const playPauseRef = React.useRef<HTMLButtonElement | null>(null);
	const nextRef = React.useRef<HTMLButtonElement | null>(null);
	const modeIconRef = React.useRef<HTMLSpanElement | null>(null);
	const playlistRef = React.useRef<HTMLButtonElement | null>(null);

	// Set Obsidian built-in icons
	React.useEffect(() => {
		setButtonIcon(shuffleIconRef, "shuffle");
		setButtonIcon(prevRef, "skip-back");
		setButtonIcon(playPauseRef, isPlaying ? "pause" : "play");
		setButtonIcon(nextRef, "skip-forward");
		setButtonIcon(modeIconRef, playModeIcon(playMode));
		setButtonIcon(playlistRef, "list-music");
	}, [playMode, isPlaying, isShuffle]);

	return (
		<div className="controls-row" onClick={(e) => e.stopPropagation()}>
			<button
				type="button"
				className={`play-control-btn clickable-icon shuffle-btn ${isShuffle ? "is-active" : ""}`}
				aria-label={isShuffle ? `${t("playback.mode.shuffle")} (On)` : `${t("playback.mode.shuffle")} (Off)`}
				onClick={onToggleShuffle}
				title={isShuffle ? "Shuffle: On (Non-repeating)" : "Shuffle: Off"}
			>
				<span ref={shuffleIconRef} className="control-icon-wrapper" />
				{isShuffle && <span className="active-dot" />}
			</button>

			<button
				ref={prevRef}
				type="button"
				className="play-control-btn clickable-icon prev-btn"
				aria-label={t("playback.prev")}
				onClick={onPrev}
			/>

			<button
				ref={playPauseRef}
				type="button"
				className="play-control-btn clickable-icon play-pause-btn hero-play-btn"
				onClick={onTogglePlay}
				aria-label={isPlaying ? t("playback.pause") : t("playback.play")}
			/>

			<button
				ref={nextRef}
				type="button"
				className="play-control-btn clickable-icon next-btn"
				aria-label={t("playback.next")}
				onClick={onNext}
			/>

			<button
				type="button"
				className={`play-control-btn clickable-icon repeat-btn ${playMode !== "normal" ? "is-active" : ""}`}
				aria-label={playModeLabel(playMode)}
				onClick={onToggleMode}
				title={playModeLabel(playMode)}
			>
				<span ref={modeIconRef} className="control-icon-wrapper" />
				{playMode !== "normal" && <span className="active-dot" />}
			</button>

			<button
				ref={playlistRef}
				type="button"
				className="play-control-btn clickable-icon queue-btn"
				aria-label={t("playback.queue")}
				onClick={onOpenPlaylist}
			/>
		</div>
	);
}


