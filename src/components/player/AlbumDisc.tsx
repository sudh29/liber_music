/**
 * Album disc component
 * 
 * Displays album cover and disc animation effects, including:
 * - Disc rotation animation (when playing)
 * - Switch animation (sliding effect on prev/next track)
 * - Tonearm animation (needle movement on play/pause)
 * - Supports dragging cover to adjust playback progress
 * 
 * Cover switch logic:
 * - Component receives three covers simultaneously: prevCoverUrl, coverUrl, nextCoverUrl
 * - On previous track, prevCoverUrl slides in from the left
 * - On next track, nextCoverUrl slides in from the right
 * - Upon completion, coverUrl is updated to the new current cover
 * 
 * Animation notes:
 * - Disc rotates continuously during playback
 * - Sliding transition animation when switching tracks
 * - Tonearm moves onto the record when playing and returns when paused
 */

import React from "react";
import "./AlbumDisc.css";
import { useDiscRotation } from "@/hooks/useDiscRotation";
import { t } from "@/utils/i18n/i18n";
import { useDiscSwitchAnimation } from "@/hooks/useDiscSwitchAnimation";

/**
 * Props interface for AlbumDisc component
 */
export interface AlbumDiscProps {
	/** Cover image URL for the current track */
	coverUrl?: string;
	/** Unique track key (e.g. path) to trigger animation even when cover URL is identical */
	trackKey?: string;
	/** Whether playback is active */
	isPlaying: boolean;
	/** Callback function to play previous track (optional) */
	onPrev?: () => void;
	/** Callback function to play next track (optional) */
	onNext?: () => void;
	/** Callback function to toggle play/pause (optional) */
	onTogglePlay?: () => void;
	/** Previous track cover image URL (for switch animation) */
	prevCoverUrl?: string;
	/** Next track cover image URL (for switch animation) */
	nextCoverUrl?: string;
	/** Last action ("next" or "prev") triggering switch animation */
	lastAction?: "next" | "prev" | null;
	/** Turntable body faceplate style */
	turntableStyle?: 'obsidian' | 'walnut' | 'acrylic';
}

/**
 * Album disc component
 * 
 * Displays album cover and vinyl disc animations, supporting rotation on playback and slide animation on track changes.
 * 
 * @param props Component properties
 */
export function AlbumDisc({
	coverUrl,
	trackKey,
	isPlaying,
	onPrev,
	onNext,
	onTogglePlay,
	prevCoverUrl,
	nextCoverUrl,
	lastAction,
	turntableStyle = 'obsidian',
}: AlbumDiscProps) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const shadowLeftRef = React.useRef<HTMLDivElement>(null);
	const shadowRightRef = React.useRef<HTMLDivElement>(null);
	const panContainerRef = React.useRef<HTMLDivElement>(null);
	const [workspaceLeafWidth, setWorkspaceLeafWidth] = React.useState(0);

	// Use disc rotation Hook
	const { rotationAngle, currentDiscRef, resetRotation } = useDiscRotation({ isPlaying });

	// Use disc switch animation Hook
	const {
		displayCoverUrl,
		currentDiscOffset,
		nextDiscOffset,
		nextDiscVisible,
		nextDiscCoverUrl,
		isAnimating,
		shouldAnimate,
		isNeedlePlaying,
	} = useDiscSwitchAnimation({
		isPlaying,
		coverUrl,
		prevCoverUrl,
		nextCoverUrl,
		trackKey,
		lastAction,
		onTogglePlay,
		workspaceLeafWidth,
		onResetRotation: resetRotation,
	});

	// Get workspace-leaf width (initial width may be 0 when sidebar is reopened, observe size changes continuously)
	React.useEffect(() => {
		const panContainer = panContainerRef.current;
		if (!panContainer) return;

		let workspaceLeaf: HTMLElement | null = null;
		let element: HTMLElement | null = panContainer;
		while (element && !workspaceLeaf) {
			element = element.parentElement;
			if (element?.classList.contains("workspace-leaf")) {
				workspaceLeaf = element;
			}
		}

		const updateWidth = () => {
			if (workspaceLeaf) {
				setWorkspaceLeafWidth(workspaceLeaf.offsetWidth || 0);
			} else {
				const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
				setWorkspaceLeafWidth(windowWidth);
			}
		};

		updateWidth();

		if (workspaceLeaf) {
			const observer = new ResizeObserver(updateWidth);
			observer.observe(workspaceLeaf);
			return () => observer.disconnect();
		}

		window.addEventListener("resize", updateWidth);
		return () => window.removeEventListener("resize", updateWidth);
	}, []);

	const discClasses = [
		"album-image",
		// No longer using "playing" class, rotation is controlled via JavaScript
	].filter(Boolean).join(" ");

	// Use JavaScript to control rotation, applying angle regardless of play or pause
	const discStyle: React.CSSProperties = {
		transition: "none", // Do not animate transition, apply angle directly
		transform: `rotate(${rotationAngle}deg)`,
	};

	const coverStyle: React.CSSProperties = displayCoverUrl
		? { backgroundImage: `url("${displayCoverUrl}")` }
		: {};

	return (
		<div className={`album-container-wrapper turntable-style-${turntableStyle} ${isPlaying ? "is-playing" : ""}`}>
			{/* Ambient Backlight Glow (2026 Modern Aesthetic) */}
			{displayCoverUrl ? (
				<div
					className={`disc-ambient-glow ${isPlaying ? "is-playing" : ""}`}
					style={{ backgroundImage: `url("${displayCoverUrl}")` }}
					aria-hidden="true"
				/>
			) : null}

			{/* Reactive Groove Halo */}
			<div className="disc-groove-halo" aria-hidden="true" />

			{/* Fixed semi-transparent background */}
			<div className="disc-shadow"></div>

			{/* Sliding container - contains needle and disc */}
			<div className="pan-container" ref={panContainerRef}>
				{/* Tonearm - positioned relative to disc */}
				<div className={`needle ${isNeedlePlaying ? "playing" : ""}`}>
					<div
						role="img"
						aria-label={t("a11y.tonearm")}
						className="needle-image needle-image-embedded"
					/>
				</div>
				
				{/* Left shadow disc (previous track) */}
				<div 
					ref={shadowLeftRef}
					className="album-container shadow-disc"
					style={{ 
						position: 'absolute',
						left: '0',
						bottom: '10px',
						transform: `translateX(${-workspaceLeafWidth}px)`,
						opacity: 0,
						pointerEvents: 'none',
						zIndex: -1,
					}}
				>
					<div
						role="img"
						aria-label={t("a11y.vinyl")}
						className="disc-background disc-background-embedded"
					/>
					<div 
						className="album-image"
						style={{ 
							backgroundImage: prevCoverUrl ? `url("${prevCoverUrl}")` : undefined 
						}}
					>
						{!prevCoverUrl && (
							<div className="album-placeholder">♪</div>
						)}
					</div>
				</div>

				{/* Currently playing disc (clicks no longer toggle playback, display and animation only) */}
				<div 
					className="album-container"
					ref={containerRef}
					style={{
						position: 'absolute',
						left: '0',
						bottom: '10px',
						transform: `translateX(${currentDiscOffset}px)`,
						transition: isAnimating ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
						zIndex: nextDiscVisible ? 1 : 2,
						willChange: isAnimating ? 'transform' : 'auto',
					}}
				>
					{/* Vinyl disc background image */}
					<div
						role="img"
						aria-label={t("a11y.vinyl")}
						className="disc-background disc-background-embedded"
					/>

					{/* Album cover */}
					<div 
						ref={currentDiscRef}
						className={discClasses} 
						style={{ ...discStyle, ...coverStyle }}
					>
						{!displayCoverUrl && (
							<div className="album-placeholder">
								♪
							</div>
						)}
					</div>
				</div>

				{/* Next disc (for switch animation) */}
				{nextDiscVisible && (
					<div 
						className="album-container"
						style={{
							position: 'absolute',
							left: '0',
							bottom: '10px',
							transform: `translateX(${nextDiscOffset}px)`,
							transition: shouldAnimate ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
							zIndex: 2,
							willChange: shouldAnimate ? 'transform' : 'auto',
						}}
					>
						{/* Vinyl disc background image */}
						<div
							role="img"
							aria-label={t("a11y.vinyl")}
							className="disc-background disc-background-embedded"
						/>

						{/* Album cover */}
						<div 
							className={discClasses}
							style={{
								transition: "none",
								transform: 'rotate(0deg)',
								backgroundImage: nextDiscCoverUrl ? `url("${nextDiscCoverUrl}")` : undefined,
							}}
						>
							{!nextDiscCoverUrl && (
								<div className="album-placeholder">
									♪
								</div>
							)}
						</div>
					</div>
				)}

				{/* Right shadow disc (next track) */}
				<div 
					ref={shadowRightRef}
					className="album-container shadow-disc"
					style={{ 
						position: 'absolute',
						left: '0',
						bottom: '10px',
						transform: `translateX(${workspaceLeafWidth}px)`,
						opacity: 0,
						pointerEvents: 'none',
						zIndex: -1,
					}}
				>
					<div
						role="img"
						aria-label={t("a11y.vinyl")}
						className="disc-background disc-background-embedded"
					/>
					<div 
						className="album-image"
						style={{ 
							backgroundImage: nextCoverUrl ? `url("${nextCoverUrl}")` : undefined 
						}}
					>
						{!nextCoverUrl && (
							<div className="album-placeholder">♪</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
