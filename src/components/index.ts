/**
 * Components unified exports
 * 
 * Exports common React components for use throughout the plugin.
 */

// Root Component
export { MusicPlayerRoot } from "./root/MusicPlayerRoot";

// Page Components
export { PlayPage } from "./player/PlayPage";
export type { PlayPageViewMode, PlayPageProps } from "./player/PlayPage";
export { LibraryPage } from "./library/LibraryPage";

// Modal Components
export { TextInputModal } from "./modal/TextInputModal";
export { PlaylistPickerModal } from "./modal/PlaylistPickerModal";
export { QueueModal } from "./modal/QueueModal";
export { TrackSearchModal } from "./modal/TrackSearchModal";
export { ConfirmModal } from "./modal/ConfirmModal";
export { EqualizerModal } from "./modal/EqualizerModal";

// Player Components
export { AlbumDisc } from "./player/AlbumDisc";
export { PlaybackControls } from "./player/PlaybackControls";
export { ProgressBar } from "./player/ProgressBar";
export { TrackActions } from "./player/TrackActions";
export { TrackHeader } from "./player/TrackHeader";
export { PlayingIndicator, createPlayingIndicatorHTML } from "./player/PlayingIndicator";
export { LyricsFull } from "./player/LyricsFull";
export { LyricsTriplet } from "./player/LyricsTriplet";
export { LyricsExtendedFull } from "./player/LyricsExtendedFull";
export { LyricsExtendedTriplet } from "./player/LyricsExtendedTriplet";
export { AudioVisualizer } from "./player/AudioVisualizer";

// Shared Components
export { IconButton } from "./shared/IconButton";
export { NavigationBar } from "./shared/NavigationBar";
