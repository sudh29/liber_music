/**
 * UI constant definitions
 */

/** Page view types */
export const PAGE_TYPES = {
	LIBRARY: 'library',
	DISC: 'disc',
	LYRICS: 'lyrics',
} as const;

export type PageType = typeof PAGE_TYPES[keyof typeof PAGE_TYPES];

/** Library tab types */
export const TAB_TYPES = {
	FAVORITES: 'favorites',
	ALL: 'all',
	PLAYLISTS: 'playlists',
	ARTISTS: 'artists',
	ALBUMS: 'albums',
} as const;

export type TabType = typeof TAB_TYPES[keyof typeof TAB_TYPES];

/** Animation timing constants in milliseconds */
export const ANIMATION_TIMINGS = {
	/** DOM update delay ensuring elements are mounted before triggering animations */
	DOM_UPDATE_DELAY: 20,
	/** Vinyl disc sliding animation duration */
	DISC_ANIMATION_DURATION: 500,
	/** Buffer time after disc animation completes */
	DISC_ANIMATION_BUFFER: 50,
	/** Needle transition duration matching CSS transition */
	NEEDLE_TRANSITION_DURATION: 300,
	/** Needle delay relative to disc movement */
	NEEDLE_DELAY: 150,
} as const;
