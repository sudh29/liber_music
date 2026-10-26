/**
 * Data sorting utility module
 * 
 * Provides utility functions for sorting track and item lists.
 */

import type { TFile } from "obsidian";
import type { MusicPlayerSettings } from "@/types";
import { getOrCreateTrackId } from "@/utils/track/id";

/**
 * Sorts tracks by track number within each album.
 * First groups tracks by album, then sorts each album by track number.
 * 
 * @param tracks Array of track files
 * @param settings Plugin settings containing track metadata
 * @returns Sorted array of track files
 */
export function sortTracksByTrack(
	tracks: TFile[],
	settings: MusicPlayerSettings
): TFile[] {
	// Filter out undefined and null values
	const validTracks = tracks.filter((file): file is TFile => file != null);
	
	// Group by album
	const albumMap = new Map<string, TFile[]>();
	validTracks.forEach((file) => {
		const trackId = getOrCreateTrackId(file.path, settings);
		const track = settings.tracks[trackId];
		const album = (track?.album ?? "").trim();
		if (!albumMap.has(album)) {
			albumMap.set(album, []);
		}
		albumMap.get(album)!.push(file);
	});

	// Sort tracks within each album by track number
	const sortedTracks: TFile[] = [];
	Array.from(albumMap.entries())
		.sort((a, b) => a[0].localeCompare(b[0], "en"))
		.forEach(([, albumTracks]) => {
			const sortedAlbumTracks = albumTracks.sort((a, b) => {
				const trackIdA = getOrCreateTrackId(a.path, settings);
				const trackIdB = getOrCreateTrackId(b.path, settings);
				const trackA = settings.tracks[trackIdA];
				const trackB = settings.tracks[trackIdB];
				const trackNumberA = trackA?.track ?? Number.MAX_SAFE_INTEGER;
				const trackNumberB = trackB?.track ?? Number.MAX_SAFE_INTEGER;
				return trackNumberA - trackNumberB;
			});
			sortedTracks.push(...sortedAlbumTracks);
		});

	return sortedTracks;
}

/**
 * Sorts items alphabetically by name (for artists, albums, etc.).
 * Unknown items are placed at the end.
 * 
 * @param items Array of items to sort
 * @param getName Function extracting item name
 * @param unknownName Identifier for unknown items (e.g. "Unknown Artist", "Unknown")
 * @returns Sorted array
 */
export function sortByName<T>(
	items: T[],
	getName: (item: T) => string,
	unknownName: string = "Unknown"
): T[] {
	return items.sort((a, b) => {
		const nameA = getName(a);
		const nameB = getName(b);
		if (nameA === unknownName) return 1;
		if (nameB === unknownName) return -1;
		return nameA.localeCompare(nameB, "en");
	});
}
