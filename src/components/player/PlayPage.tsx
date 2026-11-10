/**
 * Play page component - Minimalist Material 3 Layout
 * 
 * Inspired by Obsidian-Music (Varun7009/Obsidian-Music):
 * - Clean, distraction-free modern playback layout
 * - Fluid sizing that dynamically adapts to Obsidian leaves/sidebars without vertical scrollbars
 * - Integrated favorite button within track header
 * - Material 3 dynamic color theming based on current album artwork
 * - Secondary controls (equalizer, visualizer, styles) relocated to Settings
 */

import React from "react";
import "./PlayPage.css";
import { AlbumDisc } from "@/components/player/AlbumDisc";
import { AlbumCard } from "@/components/player/AlbumCard";
import { LyricsTriplet } from "@/components/player/LyricsTriplet";
import { LyricsExtendedTriplet } from "@/components/player/LyricsExtendedTriplet";
import { LyricsFull } from "@/components/player/LyricsFull";
import { LyricsExtendedFull } from "@/components/player/LyricsExtendedFull";
import { TrackHeader } from "@/components/player/TrackHeader";
import { ProgressBar } from "@/components/player/ProgressBar";
import { PlaybackControls } from "@/components/player/PlaybackControls";
import { StarRating } from "@/components/player/StarRating";
import { AudioVisualizer } from "@/components/player/AudioVisualizer";
import { applyPaletteTheme, extractPaletteFromImageUrl } from "@/utils/ui/palette";
import { useLyricsAutoScroll } from "@/hooks/useLyricsAutoScroll";
import type { PlayMode } from "@/main";
import type { LyricLine } from "@/utils/lyrics/parser";
import type { ExtendedLyricLine } from "@/utils/lyrics/extendedParser";
import type { EqualizerService } from "@/services/EqualizerService";

export type PlayPageViewMode = "disc" | "lyrics";

export interface PlayPageProps {
	/** Display view mode */
	viewMode: PlayPageViewMode;
	/** Switch to alternate mode */
	onSwitchViewMode: () => void;
	
	// Basic track info
	title: string;
	artist: string;
	
	// Playback state
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	playMode: PlayMode;
	isShuffle?: boolean;
	artworkDisplayMode?: "vinyl" | "card";
	rating?: number;
	showStarRating?: boolean;
	
	// Disc mode props
	coverUrl?: string;
	prevCoverUrl?: string;
	nextCoverUrl?: string;
	prevLyric?: string;
	currentLyric?: string;
	nextLyric?: string;
	prevExtendedLyric?: ExtendedLyricLine;
	currentExtendedLyric?: ExtendedLyricLine;
	nextExtendedLyric?: ExtendedLyricLine;
	lastAction?: "next" | "prev" | null;
	
	// Lyrics mode props
	fullLyrics: LyricLine[];
	fullExtendedLyrics: ExtendedLyricLine[];
	playingIndex: number;
	/** Whether this is initial mount to lyrics mode */
	isInitialMount?: boolean;
	/** Callback when initial mount completes */
	onInitialMountComplete?: () => void;
	
	// Playback controls
	onPrev: () => void;
	onNext: () => void;
	onTogglePlay: () => void;
	onToggleMode: () => void;
	onToggleShuffle?: () => void;
	onToggleArtworkDisplayMode?: () => void;
	onRate?: (rating: number) => void;
	onOpenPlaylist: () => void;
	onSeek: (ratio: number) => void;
	onSeekBackward: (seconds: number) => void;
	onSeekForward: (seconds: number) => void;
	
	// Track metadata and secondary controls
	currentPath: string | null;
	sectionId?: string | null;
	isFavorite: boolean;
	volume: number;
	playbackRate: number;
	onAddToPlaylist: (path: string, sectionId?: string) => void;
	onToggleFavorite: (path: string, sectionId?: string) => void;
	onVolumeChange: (volume: number) => void;
	onPlaybackRateChange: (rate: number) => void;
	onOpenEqualizer?: () => void;
	/** Turntable body faceplate style */
	turntableStyle?: 'obsidian' | 'walnut' | 'acrylic';
	/** Whether real-time audio spectrum visualizer is enabled */
	showVisualizer?: boolean;
	/** Whether dynamic album art accent theming is enabled */
	dynamicAlbumTheme?: boolean;
	/** Equalizer service instance for frequency data */
	equalizerService?: EqualizerService;
	/** Callback function to toggle audio visualizer */
	onToggleVisualizer?: () => void;
	/** Callback function to cycle turntable style */
	onToggleTurntableStyle?: () => void;
	/** Callback function to open metadata editor */
	onOpenMetadataEditor?: () => void;
}

export function PlayPage({
	viewMode,
	onSwitchViewMode,
	title,
	artist,
	isPlaying,
	currentTime,
	duration,
	playMode,
	isShuffle = false,
	artworkDisplayMode = "card",
	rating = 0,
	showStarRating = false,
	coverUrl,
	prevCoverUrl,
	nextCoverUrl,
	prevLyric,
	currentLyric,
	nextLyric,
	prevExtendedLyric,
	currentExtendedLyric,
	nextExtendedLyric,
	lastAction,
	fullLyrics,
	fullExtendedLyrics,
	playingIndex,
	isInitialMount = false,
	onInitialMountComplete,
	onPrev,
	onNext,
	onTogglePlay,
	onToggleMode,
	onToggleShuffle,
	onRate,
	onOpenPlaylist,
	onSeek,
	onSeekBackward,
	onSeekForward,
	currentPath,
	sectionId,
	isFavorite,
	onToggleFavorite,
	turntableStyle = "obsidian",
	showVisualizer = false,
	dynamicAlbumTheme = true,
	equalizerService,
	onToggleVisualizer,
}: PlayPageProps) {
	// Determine whether to use extended lyrics
	const useExtendedLyrics = viewMode === "disc" 
		? currentExtendedLyric !== undefined
		: fullExtendedLyrics && fullExtendedLyrics.length > 0;

	const lyricsToUse = viewMode === "lyrics" 
		? (useExtendedLyrics ? fullExtendedLyrics : fullLyrics)
		: null;

	// Use lyrics auto-scroll Hook
	const { scrollRef, lineRefs } = useLyricsAutoScroll({
		viewMode,
		lyricsToUse,
		playingIndex,
		isInitialMount,
		onInitialMountComplete,
	});

	// Track current track path to detect track switching
	const prevPathRef = React.useRef<string | null>(currentPath);

	// Compute effective playingIndex: return -1 immediately after track switch, otherwise return actual playingIndex
	const effectivePlayingIndex = React.useMemo(() => {
		if (prevPathRef.current !== currentPath) {
			prevPathRef.current = currentPath;
			return -1;
		}
		return playingIndex;
	}, [playingIndex, currentPath]);

	const activeIndex = viewMode === "lyrics" ? effectivePlayingIndex : -1;

	const handleSeekToTime = React.useCallback(
		(time: number) => {
			if (!Number.isFinite(time) || duration <= 0) return;
			const ratio = Math.min(Math.max(time / duration, 0), 1);
			onSeek(ratio);
		},
		[duration, onSeek]
	);

	const rootRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		let isCancelled = false;
		if (!dynamicAlbumTheme) {
			applyPaletteTheme(rootRef.current, null, false);
			return;
		}

		void extractPaletteFromImageUrl(coverUrl).then((theme) => {
			if (!isCancelled && rootRef.current) {
				applyPaletteTheme(rootRef.current, theme, true);
			}
		});

		return () => {
			isCancelled = true;
		};
	}, [coverUrl, dynamicAlbumTheme]);

	return (
		<div ref={rootRef} className={`play-page-wrapper play-page-${viewMode}`}>
			{/* Artwork mode: rendered simultaneously, display toggled via CSS */}
			<div 
				className={`disc-and-lyrics-triplet-wrapper ${viewMode === "disc" ? "visible" : "hidden"}`} 
				onClick={onSwitchViewMode}
			>
				<div className="disc-wrapper">
					{artworkDisplayMode === "vinyl" ? (
						<AlbumDisc
							coverUrl={coverUrl}
							trackKey={currentPath || undefined}
							isPlaying={isPlaying}
							onPrev={onPrev}
							onNext={onNext}
							onTogglePlay={onTogglePlay}
							prevCoverUrl={prevCoverUrl}
							nextCoverUrl={nextCoverUrl}
							lastAction={lastAction}
							turntableStyle={turntableStyle}
						/>
					) : (
						<AlbumCard
							coverUrl={coverUrl}
							title={title}
							artist={artist}
							isPlaying={isPlaying}
							onTogglePlay={onTogglePlay}
							onPrev={onPrev}
							onNext={onNext}
						/>
					)}
				</div>
				<div className="lyrics-triplet-wrapper">
					{useExtendedLyrics ? (
						<LyricsExtendedTriplet 
							prev={prevExtendedLyric} 
							current={currentExtendedLyric} 
							next={nextExtendedLyric}
							currentTime={currentTime}
						/>
					) : (
						<LyricsTriplet prev={prevLyric} current={currentLyric} next={nextLyric} />
					)}
				</div>
			</div>

			{/* Lyrics mode: rendered simultaneously, display toggled via CSS */}
			<div 
				key={currentPath || "no-track"}
				className={`lyrics-list-wrapper ${viewMode === "lyrics" ? "visible" : "hidden"}`} 
				onClick={onSwitchViewMode}
			>
				{useExtendedLyrics ? (
					<LyricsExtendedFull
						fullLyrics={fullExtendedLyrics}
						currentTime={currentTime}
						activeIndex={activeIndex}
						playingIndex={effectivePlayingIndex}
						onToggleMode={onSwitchViewMode}
						onSeek={handleSeekToTime}
						scrollRef={scrollRef}
						lineRefs={lineRefs}
						currentPath={currentPath}
						trackTitle={title}
					/>
				) : (
					<LyricsFull
						fullLyrics={fullLyrics}
						activeIndex={activeIndex}
						playingIndex={effectivePlayingIndex}
						onToggleMode={onSwitchViewMode}
						onSeek={handleSeekToTime}
						scrollRef={scrollRef}
						lineRefs={lineRefs}
						currentPath={currentPath}
						trackTitle={title}
					/>
				)}
			</div>

			{showVisualizer && (
				<AudioVisualizer
					equalizerService={equalizerService}
					isPlaying={isPlaying}
					onToggleVisualizer={onToggleVisualizer}
				/>
			)}

			<div className="player-bottom-section" onClick={(e) => e.stopPropagation()}>
				<TrackHeader
					title={title}
					artist={artist}
					isFavorite={isFavorite}
					onToggleFavorite={() => {
						if (currentPath) {
							onToggleFavorite(currentPath, sectionId || undefined);
						}
					}}
				/>

				{showStarRating && onRate && (
					<div className="player-rating-row">
						<StarRating rating={rating} onRate={onRate} />
					</div>
				)}

				<ProgressBar
					current={currentTime}
					duration={duration}
					onSeek={onSeek}
					onSeekBackward={onSeekBackward}
					onSeekForward={onSeekForward}
				/>

				<PlaybackControls
					isPlaying={isPlaying}
					playMode={playMode}
					isShuffle={isShuffle}
					onTogglePlay={onTogglePlay}
					onPrev={onPrev}
					onNext={onNext}
					onToggleMode={onToggleMode}
					onToggleShuffle={onToggleShuffle}
					onOpenPlaylist={onOpenPlaylist}
				/>
			</div>
		</div>
	);
}
