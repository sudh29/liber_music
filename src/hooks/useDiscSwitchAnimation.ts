/**
 * Album disc transition animation hook
 * 
 * Manages disc slide animations during track switching:
 * - Cover image preloading
 * - Disc slide transition (previous / next)
 * - Tonearm in/out coordination and timing
 * - Timeout scheduling and cleanup
 */

import React from "react";
import { ANIMATION_TIMINGS } from "@/constants/ui";

/**
 * Hook input parameters
 */
export interface UseDiscSwitchAnimationParams {
	/** Whether audio is currently playing */
	isPlaying: boolean;
	/** Current cover image URL */
	coverUrl?: string;
	/** Previous track cover image URL */
	prevCoverUrl?: string;
	/** Next track cover image URL */
	nextCoverUrl?: string;
	/** Current track unique identifier */
	trackKey?: string;
	/** Last triggered action ("next" | "prev" | null) */
	lastAction?: "next" | "prev" | null;
	/** Callback to toggle play/pause */
	onTogglePlay?: () => void;
	/** Workspace leaf width (for animation offset calculations) */
	workspaceLeafWidth: number;
	/** Callback to reset rotation angle on track change */
	onResetRotation?: () => void;
}

/**
 * Hook return values
 */
export interface UseDiscSwitchAnimationReturn {
	/** Currently visible cover URL */
	displayCoverUrl: string | undefined;
	/** Current disc offset in pixels */
	currentDiscOffset: number;
	/** Next disc offset in pixels */
	nextDiscOffset: number;
	/** Whether next disc is visible */
	nextDiscVisible: boolean;
	/** Next disc cover URL */
	nextDiscCoverUrl: string | undefined;
	/** Whether slide animation is active */
	isAnimating: boolean;
	/** Whether transition CSS should be applied */
	shouldAnimate: boolean;
	/** Whether tonearm is in transition */
	isNeedleAnimating: boolean;
	/** Whether tonearm is in playing posture */
	isNeedlePlaying: boolean;
	/** Handler function to initiate transition */
	handleSwitch: (isNext: boolean) => Promise<void>;
}

/**
 * Preloads cover image
 */
function preloadCover(coverUrl: string | undefined): Promise<void> {
	return new Promise((resolve) => {
		if (!coverUrl) {
			resolve();
			return;
		}

		const img = new Image();
		
		const timeout = window.setTimeout(() => {
			resolve();
		}, 1000);

		img.onload = () => {
			window.clearTimeout(timeout);
			resolve();
		};
		img.onerror = () => {
			window.clearTimeout(timeout);
			resolve();
		};
		
		img.src = coverUrl;
		
		if (img.complete) {
			window.clearTimeout(timeout);
			resolve();
		}
	});
}

/**
 * Album disc transition animation hook
 * 
 * Coordinates cover preloading, sliding disc translation, and tonearm liftoff/drop.
 * 
 * @param params Hook parameters
 * @returns Hook return values
 */
export function useDiscSwitchAnimation({
	isPlaying,
	coverUrl,
	prevCoverUrl,
	nextCoverUrl,
	trackKey,
	lastAction,
	onTogglePlay,
	workspaceLeafWidth,
	onResetRotation,
}: UseDiscSwitchAnimationParams): UseDiscSwitchAnimationReturn {
	const prevCoverUrlRef = React.useRef<string | undefined>(coverUrl);
	const prevTrackKeyRef = React.useRef<string | undefined>(trackKey);
	const isAnimatingRef = React.useRef(false);
	const latestCoverUrlRef = React.useRef<string | undefined>(coverUrl);
	const [displayCoverUrl, setDisplayCoverUrl] = React.useState<string | undefined>(coverUrl);
	const [currentDiscOffset, setCurrentDiscOffset] = React.useState(0);
	const [nextDiscOffset, setNextDiscOffset] = React.useState(0);
	const [nextDiscVisible, setNextDiscVisible] = React.useState(false);
	const [nextDiscCoverUrl, setNextDiscCoverUrl] = React.useState<string | undefined>(undefined);
	const [shouldAnimate, setShouldAnimate] = React.useState(false);
	const [isAnimating, setIsAnimating] = React.useState(false);
	const [isNeedleAnimating, setIsNeedleAnimating] = React.useState(false);
	const isNeedlePlaying = isPlaying && !isNeedleAnimating;
	const timeoutRefs = React.useRef<number[]>([]);

	React.useEffect(() => {
		latestCoverUrlRef.current = coverUrl;
	}, [coverUrl]);

	const handleSwitch = React.useCallback(async (isNext: boolean) => {
		if (isAnimatingRef.current || isAnimating || workspaceLeafWidth === 0) {
			return;
		}
		
		isAnimatingRef.current = true;
		setIsAnimating(true);
		setIsNeedleAnimating(true);
		
		const incomingCover = isNext ? nextCoverUrl : prevCoverUrl;
		const initialOffset = isNext ? workspaceLeafWidth : -workspaceLeafWidth;
		
		await preloadCover(incomingCover);
		
		setNextDiscCoverUrl(incomingCover);
		setNextDiscOffset(initialOffset);
		setCurrentDiscOffset(0);
		setShouldAnimate(false);
		setNextDiscVisible(true);
		
		timeoutRefs.current.forEach((id) => window.clearTimeout(id));
		timeoutRefs.current = [];
		
		const domUpdateTimeout = window.setTimeout(() => {
			setShouldAnimate(true);
			const currentOffset = isNext ? -workspaceLeafWidth : workspaceLeafWidth;
			setCurrentDiscOffset(currentOffset);
			setNextDiscOffset(0);
		}, ANIMATION_TIMINGS.DOM_UPDATE_DELAY);
		timeoutRefs.current.push(domUpdateTimeout);
		
		const discAnimationComplete = ANIMATION_TIMINGS.DISC_ANIMATION_DURATION + ANIMATION_TIMINGS.DISC_ANIMATION_BUFFER;
		const needleStartTime = discAnimationComplete + ANIMATION_TIMINGS.NEEDLE_DELAY - ANIMATION_TIMINGS.NEEDLE_TRANSITION_DURATION;
		const needleTimeout = window.setTimeout(() => {
			setIsNeedleAnimating(false);
		}, needleStartTime);
		timeoutRefs.current.push(needleTimeout);
		
		const animationCompleteTimeout = window.setTimeout(() => {
			setDisplayCoverUrl(latestCoverUrlRef.current);
			
			setShouldAnimate(false);
			setCurrentDiscOffset(0);
			setNextDiscOffset(isNext ? workspaceLeafWidth : -workspaceLeafWidth);
			setNextDiscVisible(false);
			
			if (onResetRotation) {
				onResetRotation();
			}
			
			setIsAnimating(false);
			isAnimatingRef.current = false;
			setIsNeedleAnimating(false);
		}, ANIMATION_TIMINGS.DISC_ANIMATION_DURATION + ANIMATION_TIMINGS.DISC_ANIMATION_BUFFER);
		timeoutRefs.current.push(animationCompleteTimeout);
	}, [isAnimating, workspaceLeafWidth, isPlaying, onTogglePlay, coverUrl, nextCoverUrl, prevCoverUrl, onResetRotation]);

	React.useEffect(() => {
		const trackChanged = trackKey !== prevTrackKeyRef.current;
		const coverChanged = coverUrl !== prevCoverUrlRef.current;

		if ((coverChanged || trackChanged) && !isAnimating && !isAnimatingRef.current && workspaceLeafWidth > 0) {
			const isNext = lastAction === "next";
			const isPrev = lastAction === "prev";
			
			if (isNext || isPrev) {
				void handleSwitch(isNext);
				prevCoverUrlRef.current = coverUrl;
				prevTrackKeyRef.current = trackKey;
				return;
			}
		}

		if (!isAnimating && !isAnimatingRef.current) {
			if (coverChanged || trackChanged) {
				const wantsSlide = lastAction === "next" || lastAction === "prev";
				if (wantsSlide && workspaceLeafWidth === 0) {
					return;
				}
				setDisplayCoverUrl(coverUrl);
				prevCoverUrlRef.current = coverUrl;
				prevTrackKeyRef.current = trackKey;
				if (trackChanged && onResetRotation) {
					onResetRotation();
				}
			}
		} else {
			if (coverChanged) {
				prevCoverUrlRef.current = coverUrl;
			}
			if (trackChanged) {
				prevTrackKeyRef.current = trackKey;
			}
		}
	}, [coverUrl, trackKey, isAnimating, workspaceLeafWidth, handleSwitch, lastAction]);

	React.useEffect(() => {
		if (!isAnimating && !isAnimatingRef.current && coverUrl !== displayCoverUrl) {
			setDisplayCoverUrl(coverUrl);
		}
	}, [coverUrl, isAnimating, displayCoverUrl]);

	React.useEffect(() => {
		return () => {
			timeoutRefs.current.forEach((id) => window.clearTimeout(id));
			timeoutRefs.current = [];
		};
	}, []);

	return {
		displayCoverUrl,
		currentDiscOffset,
		nextDiscOffset,
		nextDiscVisible,
		nextDiscCoverUrl,
		isAnimating,
		shouldAnimate,
		isNeedleAnimating,
		isNeedlePlaying,
		handleSwitch,
	};
}
