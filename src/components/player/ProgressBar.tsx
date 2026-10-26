/**
 * Playback progress bar component
 *
 * Supports pointer dragging (visual-only feedback while dragging, seeks on release) and single click seek;
 * Left time click/double-click seeks backward, right time click/double-click seeks forward.
 */

import React from "react";
import "./ProgressBar.css";
import { t } from "@/utils/i18n/i18n";

/** Delay differentiating single and double clicks (ms) */
const CLICK_VS_DOUBLE_MS = 280;

/**
 * Props interface for ProgressBar component
 */
export interface ProgressBarProps {
	/** Current playback time in seconds */
	current: number;
	/** Total duration in seconds */
	duration: number;
	/** Seek to ratio (0–1); single click seeks immediately, dragging calls once on release */
	onSeek: (ratio: number) => void;
	/** Seek backward by seconds */
	onSeekBackward: (seconds: number) => void;
	/** Seek forward by seconds */
	onSeekForward: (seconds: number) => void;
}

/**
 * Format time to MM:SS string
 * 
 * @param sec Number of seconds
 * @returns Formatted time string (e.g. "3:45")
 */
export function formatTime(sec: number): string {
	if (!Number.isFinite(sec) || sec < 0) return "0:00";
	const s = Math.floor(sec);
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Progress bar: pointer down provides visual feedback, dragging continuously updates local ratio without seeking,
 * seeks once on release.
 */
export function ProgressBar({ current, duration, onSeek, onSeekBackward, onSeekForward }: ProgressBarProps) {
	const barRef = React.useRef<HTMLDivElement | null>(null);
	const dragActiveRef = React.useRef(false);
	const [isDragging, setIsDragging] = React.useState(false);
	/** Local ratio during drag (0–1), visual only until release */
	const [dragRatio, setDragRatio] = React.useState<number | null>(null);
	/** Temporarily lock displayed ratio after release until real currentTime catches up */
	const pendingRatioRef = React.useRef(false);

	/** DOM timer id (number used to avoid NodeJS.Timeout conflict under tsc) */
	const leftClickTimerRef = React.useRef<number | null>(null);
	const rightClickTimerRef = React.useRef<number | null>(null);

	React.useEffect(() => {
		return () => {
			if (leftClickTimerRef.current) window.clearTimeout(leftClickTimerRef.current);
			if (rightClickTimerRef.current) window.clearTimeout(rightClickTimerRef.current);
		};
	}, []);

	/**
	 * Intercept touchmove on activeDocument while dragging (non-passive + preventDefault)
	 * to prevent Obsidian / WebView from interpreting horizontal swipe as sidebar gestures.
	 */
	React.useEffect(() => {
		if (!isDragging) return;
		const blockTouchMove = (e: TouchEvent) => {
			e.preventDefault();
		};
		window.activeDocument.addEventListener("touchmove", blockTouchMove, { passive: false });
		return () => {
			window.activeDocument.removeEventListener("touchmove", blockTouchMove);
		};
	}, [isDragging]);

	const ratioFromClientX = React.useCallback((clientX: number): number | null => {
		const el = barRef.current;
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		const w = rect.width;
		if (w <= 0) return null;
		return Math.min(Math.max((clientX - rect.left) / w, 0), 1);
	}, []);

	/**
	 * After releasing seek, real currentTime takes a moment to update. Retain dragRatio for display
	 * until current catches up to target ratio (or timeout fallback) to avoid UI flicker.
	 */
	React.useEffect(() => {
		if (!pendingRatioRef.current || dragRatio === null) return;
		const target = dragRatio;
		const settle = () => {
			pendingRatioRef.current = false;
			setDragRatio(null);
		};
		// Consider caught up when current progress is within 1% of target
		if (duration > 0 && Math.abs(current / duration - target) < 0.01) {
			settle();
			return;
		}
		// Timeout fallback: avoid freezing progress bar if seek callback is delayed
		const timer = window.setTimeout(settle, 700);
		return () => window.clearTimeout(timer);
	}, [current, duration, dragRatio]);

	const endBarDrag = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		if (!dragActiveRef.current) return;
		e.stopPropagation();
		const target = e.currentTarget;
		const ratio = ratioFromClientX(e.clientX);
		try {
			if (target.hasPointerCapture(e.pointerId)) {
				target.releasePointerCapture(e.pointerId);
			}
		} catch {
			// Ignore if already released
		}
		dragActiveRef.current = false;
		setIsDragging(false);
		// Retain dragRatio for visual presentation until real current catches up
		if (ratio !== null) {
			pendingRatioRef.current = true;
			onSeek(ratio);
		} else {
			setDragRatio(null);
		}
	}, [onSeek, ratioFromClientX]);

	const onBarLostPointerCapture = React.useCallback(() => {
		dragActiveRef.current = false;
		setIsDragging(false);
		// If seek was triggered and awaiting current update, retain dragRatio to avoid flicker
		if (!pendingRatioRef.current) {
			setDragRatio(null);
		}
	}, []);

	const onBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		e.stopPropagation();
		if (e.pointerType === "touch") {
			e.preventDefault();
		}
		dragActiveRef.current = true;
		setIsDragging(true);
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			dragActiveRef.current = false;
			setIsDragging(false);
			return;
		}
		// Record drag origin for visual feedback, seek on release
		const ratio = ratioFromClientX(e.clientX);
		if (ratio !== null) setDragRatio(ratio);
	};

	const onBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!dragActiveRef.current) return;
		e.stopPropagation();
		e.preventDefault();
		// Only update local ratio during drag to avoid excessive seek operations and lag
		const ratio = ratioFromClientX(e.clientX);
		if (ratio !== null) setDragRatio(ratio);
	};

	const scheduleLeftSingle = () => {
		if (leftClickTimerRef.current) window.clearTimeout(leftClickTimerRef.current);
		leftClickTimerRef.current = window.setTimeout(() => {
			leftClickTimerRef.current = null;
			onSeekBackward(5);
		}, CLICK_VS_DOUBLE_MS);
	};

	const onLeftTimeClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		scheduleLeftSingle();
	};

	const onLeftTimeDoubleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		if (leftClickTimerRef.current) {
			window.clearTimeout(leftClickTimerRef.current);
			leftClickTimerRef.current = null;
		}
		onSeekBackward(15);
	};

	const scheduleRightSingle = () => {
		if (rightClickTimerRef.current) window.clearTimeout(rightClickTimerRef.current);
		rightClickTimerRef.current = window.setTimeout(() => {
			rightClickTimerRef.current = null;
			onSeekForward(5);
		}, CLICK_VS_DOUBLE_MS);
	};

	const onRightTimeClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		scheduleRightSingle();
	};

	const onRightTimeDoubleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		if (rightClickTimerRef.current) {
			window.clearTimeout(rightClickTimerRef.current);
			rightClickTimerRef.current = null;
		}
		onSeekForward(15);
	};

	// Use local ratio during drag for visual display, falling back to real playback progress on release
	const displayRatio = dragRatio !== null ? dragRatio : duration > 0 ? current / duration : 0;
	const displayPercent = Math.min(Math.max(displayRatio * 100, 0), 100);
	const displayCurrent = dragRatio !== null ? dragRatio * duration : current;

	return (
		<div className="play-progress-container">
			<span
				className="play-time current-time"
				aria-label={t("playback.progress.currentHint")}
				onClick={onLeftTimeClick}
				onDoubleClick={onLeftTimeDoubleClick}
			>
				{formatTime(displayCurrent)}
			</span>
			<div
				ref={barRef}
				className={`play-progress-bar${isDragging ? " is-dragging" : ""}`}
				onPointerDown={onBarPointerDown}
				onPointerMove={onBarPointerMove}
				onPointerUp={endBarDrag}
				onPointerCancel={endBarDrag}
				onLostPointerCapture={onBarLostPointerCapture}
			>
				<div className="play-progress-fill" style={{ width: `${displayPercent}%` }} />
			</div>
			<span
				className="play-time duration"
				aria-label={t("playback.progress.durationHint")}
				onClick={onRightTimeClick}
				onDoubleClick={onRightTimeDoubleClick}
			>
				{formatTime(duration)}
			</span>
		</div>
	);
}

