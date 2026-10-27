/**
 * Music player settings type definitions
 * 
 * Centralized settings types for the plugin.
 */

/**
 * Track information interface
 * Stores metadata for an individual track.
 */
export interface TrackInfo {
	/** Track title */
	title: string;
	/** Artist name */
	artist: string;
	/** Album name */
	album: string;
	/** Original lyric text (standard LRC or karaoke format, auto-detected by parser) */
	lyrics?: string;
	/** Release year */
	year?: number;
	/** Genre */
	genre?: string | string[];
	/** Track number */
	track?: number;
	/** Duration in seconds */
	duration?: number;
	/** ReplayGain track gain in dB */
	replayGainDb?: number;
	/** User star rating (0 to 5) */
	rating?: number;
}

/**
 * Music player settings interface
 * Stores plugin configuration and persistent user data.
 * 
 * Uses ID indexing:
 * - trackIndex: Map of Track ID -> File path (primary table)
 * - tracks: Map of Track ID -> TrackInfo
 * - favorites, playlists, artists, albums: Use Track ID arrays rather than path arrays
 * Renaming files only requires updating trackIndex while preserving all other associations.
 */
export interface MusicPlayerSettings {
	/** Music folder path relative to vault root (empty scans entire vault) */
	musicFolder: string;
	/** Primary ID to file path mapping */
	trackIndex: Record<string, string>;
	/** List of favorite track IDs */
	favorites: string[];
	/** Map of track ID to TrackInfo */
	tracks: Record<string, TrackInfo>;
	/** Map of playlist name to array of track IDs */
	playlists: Record<string, string[]>;
	/** Map of artist name to array of track IDs */
	artists: Record<string, string[]>;
	/** Map of album name to array of track IDs */
	albums: Record<string, string[]>;
	/** Auto-play on open */
	autoPlayOnOpen: boolean;
	/**
	 * Vault path of track to play on open.
	 * Empty string falls back to the first track in the All list.
	 */
	autoPlayOpenTrackPath: string;
	/** Persisted volume (0.0 - 1.0) */
	volume: number;
	/** Persisted playback rate (0.25 - 4.0) */
	playbackRate: number;
	/** Persisted shuffle state (independent of repeat mode) */
	isShuffle: boolean;
	/** Artwork presentation mode: rotating vinyl disc or modern card */
	artworkDisplayMode: 'vinyl' | 'card';
	/** Track ID to star rating mapping (0 to 5) */
	ratings?: Record<string, number>;
	/** Whether to prevent display sleep via Screen Wake Lock while audio is playing */
	keepScreenAwake?: boolean;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: MusicPlayerSettings = {
	musicFolder: '',           // Default: scan entire vault
	trackIndex: {},            // Default: empty ID mapping
	favorites: [],             // Default: no favorites
	tracks: {},                // Default: empty track data
	playlists: {},             // Default: no playlists
	artists: {},               // Default: no artist data
	albums: {},                // Default: no album data
	autoPlayOnOpen: false,     // Default: do not auto-play
	autoPlayOpenTrackPath: '', // Default: first track in All list
	volume: 1.0,               // Default: 100% volume
	playbackRate: 1.0,         // Default: normal speed
	isShuffle: false,          // Default: sequential playback
	artworkDisplayMode: 'vinyl', // Default: classic vinyl mode
	ratings: {},               // Default: no ratings
	keepScreenAwake: false,     // Default: do not keep screen awake
};
