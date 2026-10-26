/**
 * Data transformation utilities
 * 
 * Provides utilities to generate artist and album lookup maps from track settings.
 */

import type { MusicPlayerSettings } from '@/types';

/**
 * Generates artist and album index maps from track metadata.
 * 
 * Iterates through all tracks and builds two lookup maps:
 * - artists: Artist name -> array of track IDs
 * - albums: Album name -> array of track IDs
 * 
 * @param settings Plugin settings containing tracks map
 * @returns Object containing generated artists and albums maps
 */
export function generateArtistsAndAlbums(settings: MusicPlayerSettings) {
    const artists: Record<string, string[]> = {};
    const albums: Record<string, string[]> = {};

    Object.entries(settings.tracks).forEach(([trackId, track]) => {
        const trackData = track;
        const artist = (trackData.artist ?? "").trim();
        const album = (trackData.album ?? "").trim();

        if (!artists[artist]) {
            artists[artist] = [];
        }
        const artistTracks = artists[artist];
        if (artistTracks && !artistTracks.includes(trackId)) {
            artistTracks.push(trackId);
        }

        if (!albums[album]) {
            albums[album] = [];
        }
        const albumTracks = albums[album];
        if (albumTracks && !albumTracks.includes(trackId)) {
            albumTracks.push(trackId);
        }
    });

    return { artists, albums };
}
