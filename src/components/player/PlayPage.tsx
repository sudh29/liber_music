/**
 * Play page component
 * 
 * Combines DiscPage and LyricsPage functionality, toggling modes via viewMode:
 * - "disc": Displays album disc cover and triplet lyrics
 * - "lyrics": Displays full scrollable lyrics list
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
import { TrackActions } from "@/components/player/TrackActions";
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
	artworkDisplayMode = "vinyl",
	rating = 0,
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
	onToggleArtworkDisplayMode,
	onRate,
	onOpenPlaylist,
	onSeek,
	onSeekBackward,
	onSeekForward,
	currentPath,
	sectionId,
	isFavorite,
	volume,
	playbackRate,
	onAddToPlaylist,
	onToggleFavorite,
	onVolumeChange,
	onPlaybackRateChange,
	onOpenEqualizer,
	turntableStyle = "obsidian",
	showVisualizer = true,
	dynamicAlbumTheme = true,
	equalizerService,
	onToggleVisualizer,
	onToggleTurntableStyle,
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
	// Because container is remounted via key={currentPath}, new container mounts with effectivePlayingIndex = -1
	// Once mounted, playingIndex synchronizes normally without delayed cleanup flags
	const effectivePlayingIndex = React.useMemo(() => {
		// Detect track switch: if currentPath differs from ref, a track change just occurred
		if (prevPathRef.current !== currentPath) {
			// Track switched, update ref and return -1
			// New container remounts via key, using -1 on initial render, then syncing playingIndex
			prevPathRef.current = currentPath;
			return -1;
		}
		
		// Normal case: return actual playingIndex
		return playingIndex;
	}, [playingIndex, currentPath]); // Dependent on currentPath to recalculate on track change

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
			<TrackHeader title={title} artist={artist} />

			{showVisualizer && (
				<AudioVisualizer
					equalizerService={equalizerService}
					isPlaying={isPlaying}
					onToggleVisualizer={onToggleVisualizer}
				/>
			)}

			{/* Disc mode: rendered simultaneously, display toggled via CSS */}
			<div 
				className={`disc-and-lyrics-triplet-wrapper ${viewMode === "disc" ? "visible" : "hidden"}`} 
				onClick={onSwitchViewMode}
			>
				<div className="disc-wrapper" onClick={onSwitchViewMode}>
					{artworkDisplayMode === "card" ? (
						<AlbumCard
							coverUrl={coverUrl}
							title={title}
							artist={artist}
							isPlaying={isPlaying}
							onTogglePlay={onTogglePlay}
							onPrev={onPrev}
							onNext={onNext}
						/>
					) : (
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
					)}
				</div>
				<div className="lyrics-triplet-wrapper" onClick={onSwitchViewMode}>
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
			{/* Use currentPath as key so container remounts on track change, auto-resetting scroll position */}
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

			<TrackActions
				currentPath={currentPath}
				sectionId={sectionId}
				isFavorite={isFavorite}
				volume={volume}
				playbackRate={playbackRate}
				artworkDisplayMode={artworkDisplayMode}
				rating={rating}
				onAddToPlaylist={onAddToPlaylist}
				onToggleFavorite={onToggleFavorite}
				onVolumeChange={onVolumeChange}
				onPlaybackRateChange={onPlaybackRateChange}
				onToggleArtworkDisplayMode={onToggleArtworkDisplayMode}
				onRate={onRate}
				onOpenEqualizer={onOpenEqualizer}
				turntableStyle={turntableStyle}
				showVisualizer={showVisualizer}
				onToggleVisualizer={onToggleVisualizer}
				onToggleTurntableStyle={onToggleTurntableStyle}
			/>
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
	);
}

