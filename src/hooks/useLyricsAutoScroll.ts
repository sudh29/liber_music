/**
 * Lyrics auto-scroll hook
 * 
 * Manages automatic scrolling of lyrics lines:
 * - Keeps currently playing line centered based on playingIndex
 * - Scrolls immediately to active line upon entering lyrics mode
 * - Differentiates between programmatic scrolling and user interaction
 * - Pauses auto-scroll on user interaction (touch/drag/wheel) and returns to active line once user interaction ends
 */

import React from "react";
import type { LyricLine } from "@/utils/lyrics/parser";
import type { ExtendedLyricLine } from "@/utils/lyrics/extendedParser";

/**
 * Hook input parameters
 */
export interface UseLyricsAutoScrollParams {
	/** Display mode */
	viewMode: "disc" | "lyrics";
	/** Lyrics data in use (standard or word-by-word) */
	lyricsToUse: LyricLine[] | ExtendedLyricLine[] | null;
	/** Playing lyric line index */
	playingIndex: number;
	/** Whether this is initial mount to lyrics mode */
	isInitialMount?: boolean;
	/** Callback when initial mount scroll completes */
	onInitialMountComplete?: () => void;
}

/**
 * Hook return values
 */
export interface UseLyricsAutoScrollReturn {
	/** Scroll container ref */
	scrollRef: React.RefObject<HTMLDivElement>;
	/** Lyric line element refs array */
	lineRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

/**
 * Lyrics auto-scroll hook
 * 
 * @param params Hook parameters
 * @returns Hook return values
 */
export function useLyricsAutoScroll({
	viewMode,
	lyricsToUse,
	playingIndex,
	isInitialMount = false,
	onInitialMountComplete,
}: UseLyricsAutoScrollParams): UseLyricsAutoScrollReturn {
	const scrollRef = React.useRef<HTMLDivElement | null>(null);
	const lineRefs = React.useRef<(HTMLDivElement | null)[]>([]);
	const isAutoScrollingRef = React.useRef(false);
	const autoScrollSuppressUntilRef = React.useRef<number>(0);
	const isInitialScrollRef = React.useRef(false);
	const latestPlayingIndexRef = React.useRef(playingIndex);
	const isAutoScrollPausedRef = React.useRef(false);
	const lastUserInteractionAtRef = React.useRef<number>(0);
	const isUserInteractingRef = React.useRef(false);
	const wheelIdleTimerRef = React.useRef<number | null>(null);
	const scrollIdleTimerRef = React.useRef<number | null>(null);

	// Ensure lineRefs matches lyrics count; reset scroll states on track change
	React.useEffect(() => {
		if (viewMode === "lyrics" && lyricsToUse && lyricsToUse.length > 0) {
			lineRefs.current = new Array(lyricsToUse.length).fill(null) as (HTMLDivElement | null)[];
		} else {
			lineRefs.current = [];
		}
		isAutoScrollPausedRef.current = false;
		isUserInteractingRef.current = false;
		isAutoScrollingRef.current = false;
		lastScrollIndexRef.current = -1;
		lastUserInteractionAtRef.current = 0;
		if (scrollIdleTimerRef.current !== null) {
			window.clearTimeout(scrollIdleTimerRef.current);
			scrollIdleTimerRef.current = null;
		}
		if (wheelIdleTimerRef.current !== null) {
			window.clearTimeout(wheelIdleTimerRef.current);
			wheelIdleTimerRef.current = null;
		}
	}, [viewMode, lyricsToUse]);

	// Helper: Jump specified line to center immediately (no animation)
	const jumpLineToCenterAbove = React.useCallback((lineIndex: number) => {
		const container = scrollRef.current;
		const lineEl = lineRefs.current[lineIndex];
		if (!container || !lineEl) return false;

		const originalScrollBehavior = container.style.scrollBehavior;
		container.setCssProps({ scrollBehavior: 'auto' });

		const containerRect = container.getBoundingClientRect();
		const lineRect = lineEl.getBoundingClientRect();
		const containerHeight = containerRect.height;
		const centerY = containerHeight / 2;

		const lineTopRelative = lineRect.top - containerRect.top + container.scrollTop;
		const lineHeight = lineRect.height;
		const targetScrollTop = lineTopRelative - centerY + lineHeight / 2;

		container.scrollTop = Math.max(0, targetScrollTop);

		window.setTimeout(() => {
			container.setCssProps({ scrollBehavior: originalScrollBehavior });
		}, 0);

		return true;
	}, []);

	// Helper: Smooth scroll specified line to center
	const lastScrollIndexRef = React.useRef<number>(-1);
	const scrollLineToCenterAbove = React.useCallback((lineIndex: number) => {
		if (lastScrollIndexRef.current === lineIndex) return;
		lastScrollIndexRef.current = lineIndex;

		const container = scrollRef.current;
		const lineEl = lineRefs.current[lineIndex];
		if (!container || !lineEl) return;

		const containerRect = container.getBoundingClientRect();
		const lineRect = lineEl.getBoundingClientRect();
		const containerHeight = containerRect.height;
		const centerY = containerHeight / 2;

		const lineTopRelative = lineRect.top - containerRect.top + container.scrollTop;
		const lineHeight = lineRect.height;
		const targetScrollTop = lineTopRelative - centerY + lineHeight / 2;

		const currentScrollTop = container.scrollTop;
		if (Math.abs(targetScrollTop - currentScrollTop) < 10) return;

		container.scrollTo({
			top: targetScrollTop,
			behavior: 'smooth'
		});
	}, []);

	// Scroll immediately on initial entry to lyrics mode
	React.useLayoutEffect(() => {
		if (viewMode === "lyrics" && isInitialMount) {
			isInitialScrollRef.current = true;
		} else if (viewMode === "disc") {
			isInitialScrollRef.current = false;
			isAutoScrollPausedRef.current = false;
			isUserInteractingRef.current = false;
			if (wheelIdleTimerRef.current !== null) {
				window.clearTimeout(wheelIdleTimerRef.current);
				wheelIdleTimerRef.current = null;
			}
			if (scrollIdleTimerRef.current !== null) {
				window.clearTimeout(scrollIdleTimerRef.current);
				scrollIdleTimerRef.current = null;
			}
			return;
		}

		if (viewMode !== "lyrics" || !isInitialScrollRef.current) return;
		
		if (playingIndex < 0 && (!lyricsToUse || lyricsToUse.length === 0)) {
			return;
		}

		if (playingIndex < 0) {
			isInitialScrollRef.current = false;
			if (onInitialMountComplete) {
				onInitialMountComplete();
			}
			return;
		}

		const attemptScroll = () => {
			const container = scrollRef.current;
			const lineEl = lineRefs.current[playingIndex];
			
			if (!container || !lineEl) {
				window.setTimeout(attemptScroll, 10);
				return;
			}

			if (container.clientHeight === 0) {
				window.setTimeout(attemptScroll, 10);
				return;
			}

			const success = jumpLineToCenterAbove(playingIndex);
			if (success) {
				isInitialScrollRef.current = false;
				if (onInitialMountComplete) {
					onInitialMountComplete();
				}
			} else {
				window.setTimeout(() => {
					jumpLineToCenterAbove(playingIndex);
					isInitialScrollRef.current = false;
					if (onInitialMountComplete) {
						onInitialMountComplete();
					}
				}, 50);
			}
		};

		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				attemptScroll();
			});
		});
	}, [viewMode, isInitialMount, playingIndex, lyricsToUse, jumpLineToCenterAbove, onInitialMountComplete]);

	// Listen for user scroll interactions
	React.useEffect(() => {
		if (viewMode !== "lyrics") {
			isAutoScrollPausedRef.current = false;
			if (wheelIdleTimerRef.current !== null) {
				window.clearTimeout(wheelIdleTimerRef.current);
				wheelIdleTimerRef.current = null;
			}
			if (scrollIdleTimerRef.current !== null) {
				window.clearTimeout(scrollIdleTimerRef.current);
				scrollIdleTimerRef.current = null;
			}
			return;
		}

		const container = scrollRef.current;
		if (!container) return;

		const supportsPointerEvents =
			typeof window !== "undefined" && "PointerEvent" in window;

		const resumeAutoScrollImmediately = () => {
			isAutoScrollPausedRef.current = false;
			isUserInteractingRef.current = false;
			const idx = latestPlayingIndexRef.current;
			if (idx >= 0) {
				isAutoScrollingRef.current = true;
				autoScrollSuppressUntilRef.current = Date.now() + 1500;
				scrollLineToCenterAbove(idx);
				window.setTimeout(() => {
					if (Date.now() >= autoScrollSuppressUntilRef.current) {
						isAutoScrollingRef.current = false;
					}
				}, 1600);
			}
		};

		const pauseAutoScrollForUserInteraction = () => {
			isAutoScrollPausedRef.current = true;
			lastUserInteractionAtRef.current = Date.now();
		};

		const handleScroll = () => {
			const now = Date.now();
			const isProbablyProgrammatic =
				isAutoScrollingRef.current &&
				!isUserInteractingRef.current &&
				now < autoScrollSuppressUntilRef.current;

			if (isProbablyProgrammatic) return;

			isUserInteractingRef.current = true;
			if (scrollIdleTimerRef.current !== null) {
				window.clearTimeout(scrollIdleTimerRef.current);
			}
			scrollIdleTimerRef.current = window.setTimeout(() => {
				scrollIdleTimerRef.current = null;
				resumeAutoScrollImmediately();
			}, 500);

			pauseAutoScrollForUserInteraction();
		};

		const handlePointerDown = () => {
			isUserInteractingRef.current = true;
			pauseAutoScrollForUserInteraction();
		};

		const handlePointerUp = () => {
			resumeAutoScrollImmediately();
		};

		const handleTouchStart = () => {
			isUserInteractingRef.current = true;
			pauseAutoScrollForUserInteraction();
		};

		const handleTouchEnd = () => {
			resumeAutoScrollImmediately();
		};

		const handleWheel = () => {
			isUserInteractingRef.current = true;
			pauseAutoScrollForUserInteraction();

			if (wheelIdleTimerRef.current !== null) {
				window.clearTimeout(wheelIdleTimerRef.current);
			}
			wheelIdleTimerRef.current = window.setTimeout(() => {
				wheelIdleTimerRef.current = null;
				resumeAutoScrollImmediately();
			}, 500);
		};

		container.addEventListener('scroll', handleScroll, { passive: true });
		if (supportsPointerEvents) {
			container.addEventListener('pointerdown', handlePointerDown, { passive: true });
			container.addEventListener('pointerup', handlePointerUp, { passive: true });
			container.addEventListener('pointercancel', handlePointerUp, { passive: true });
		} else {
			container.addEventListener('touchstart', handleTouchStart, { passive: true });
			container.addEventListener('touchend', handleTouchEnd, { passive: true });
			container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
		}
		container.addEventListener('wheel', handleWheel, { passive: true });

		return () => {
			container.removeEventListener('scroll', handleScroll);
			if (supportsPointerEvents) {
				container.removeEventListener('pointerdown', handlePointerDown);
				container.removeEventListener('pointerup', handlePointerUp);
				container.removeEventListener('pointercancel', handlePointerUp);
			} else {
				container.removeEventListener('touchstart', handleTouchStart);
				container.removeEventListener('touchend', handleTouchEnd);
				container.removeEventListener('touchcancel', handleTouchEnd);
			}
			container.removeEventListener('wheel', handleWheel);
			if (wheelIdleTimerRef.current !== null) {
				window.clearTimeout(wheelIdleTimerRef.current);
			}
			if (scrollIdleTimerRef.current !== null) {
				window.clearTimeout(scrollIdleTimerRef.current);
			}
		};
	}, [viewMode, lyricsToUse]);

	// Auto-scroll active line to center on playback progress
	React.useEffect(() => {
		latestPlayingIndexRef.current = playingIndex;
		if (viewMode !== "lyrics" || isInitialScrollRef.current) return;
		if (playingIndex < 0) return;
		if (isAutoScrollPausedRef.current) return;
		if (isUserInteractingRef.current) return;

		isAutoScrollingRef.current = true;
		autoScrollSuppressUntilRef.current = Date.now() + 1500;
		scrollLineToCenterAbove(playingIndex);
		window.setTimeout(() => {
			if (Date.now() >= autoScrollSuppressUntilRef.current) {
				isAutoScrollingRef.current = false;
			}
		}, 1600);
	}, [viewMode, playingIndex, scrollLineToCenterAbove]);

	// Clean up timers on unmount
	React.useEffect(() => {
		return () => {
			if (wheelIdleTimerRef.current !== null) {
				window.clearTimeout(wheelIdleTimerRef.current);
			}
			if (scrollIdleTimerRef.current !== null) {
				window.clearTimeout(scrollIdleTimerRef.current);
			}
		};
	}, []);

	return {
		scrollRef,
		lineRefs,
	};
}
