/**
 * Playlist and queue management service
 * 
 * Manages playlist business logic, including:
 * - Resolving current active playlist queue
 * - Formatting list identifiers
 * - Setting current list context from sectionId
 */

import { TFile } from "obsidian";
import { LibraryService, PlaylistService } from "./index";
import type { MusicPlayerSettings } from "@/types";
import { formatCurrentList as formatCurrentListUtil } from "@/utils/list/formatter";
import { sortTracksByTrack } from "@/utils/data/sort";
import { getOrCreateTrackId } from "@/utils/track/id";
import { t } from "@/utils/i18n/i18n";

/**
 * Current list interface
 * 
 * Defines the structure of the active playlist queue
 */
export interface CurrentList {
	/** List type ("all", "favorites", "playlist", "artist", "album") */
	type: string;
	/** List name */
	name: string;
	/** Array of tracks in list */
	tracks: TFile[];
}

/**
 * List management service class
 * 
 * Manages playlist queue business logic, providing retrieval and formatting methods.
 */
export class ListService {
	/**
	 * Creates a list management service instance.
	 * 
	 * @param libraryService - Library service for retrieving artist/album classifications
	 * @param playlistService - Playlist service for retrieving custom playlists
	 * @param plugin - Plugin instance for accessing settings
	 */
	constructor(
		private libraryService: LibraryService,
		private playlistService: PlaylistService,
		private plugin: { settings: MusicPlayerSettings }
	) {}

	/**
	 * Infers the active playlist from the currently playing track.
	 * 
	 * Resolution priority:
	 * 1. Explicit currentList if populated
	 * 2. Custom playlist if track belongs to one
	 * 3. Favorites if track is favorited
	 * 4. All tracks
	 * 
	 * @param currentTrack - Currently playing track
	 * @param currentList - Current list context
	 * @param trackList - All tracks list
	 * @param favorites - Favorite tracks list
	 * @returns Object containing track list sorted by settings
	 */
	getCurrentPlaylistForTrack(
		currentTrack: TFile | null,
		currentList: CurrentList | null,
		trackList: TFile[],
		_favorites: TFile[]
	): { list: TFile[] } {
		if (currentList && currentList.tracks.length > 0) {
			return { list: currentList.tracks };
		}
		if (!currentTrack) {
			return { list: trackList };
		}
		return { list: this.inferPlaylistFromTrack(currentTrack, trackList).list };
	}

	/**
	 * Infers track list and stable listId when no explicit currentList is set.
	 */
	private inferPlaylistFromTrack(
		currentTrack: TFile,
		trackList: TFile[]
	): { list: TFile[]; listId: string } {
		let list: TFile[] = trackList;
		let listId = "all";

		const path = currentTrack.path;
		const playlistMap = this.plugin.settings.playlists || {};
		const favoriteIds = new Set(this.plugin.settings.favorites || []);

		const inPlaylists: string[] = [];
		for (const [name, paths] of Object.entries(playlistMap)) {
			if (Array.isArray(paths) && paths.includes(path)) inPlaylists.push(name);
		}

		if (inPlaylists.length > 0) {
			const first = inPlaylists[0];
			if (!first) {
				return { list: trackList, listId };
			}
			const set = new Set(playlistMap[first] || []);
			const filteredTracks = trackList.filter((f) => set.has(f.path));
			list = sortTracksByTrack(filteredTracks, this.plugin.settings);
			listId = `playlist:${first}`;
		} else {
			const trackId = getOrCreateTrackId(path, this.plugin.settings);
			if (favoriteIds.has(trackId)) {
				const filteredTracks = trackList.filter((f) => {
					const id = getOrCreateTrackId(f.path, this.plugin.settings);
					return favoriteIds.has(id);
				});
				list = sortTracksByTrack(filteredTracks, this.plugin.settings);
				listId = "favorites";
			} else {
				list = trackList;
				listId = "all";
			}
		}

		return { list, listId };
	}

	/**
	 * Converts playlist metadata to currentList string representation.
	 * 
	 * @param type - List type ("all", "favorites", "playlist", "artist", "album")
	 * @param name - List name (optional)
	 * @returns Formatted list identifier string
	 */
	formatCurrentList(type: string, name?: string): string {
		return formatCurrentListUtil(type, name);
	}

	/**
	 * Sets current playlist from sectionId.
	 * 
	 * Fetches list data and constructs CurrentList based on sectionId:
	 * - "all" - All tracks
	 * - "favorites" - Favorites
	 * - "playlist-xxx" - Playlist
	 * - "artist-xxx" - Artist
	 * - "album-xxx" - Album
	 * 
	 * @param sectionId - Section ID string
	 * @param trackList - All tracks list
	 * @param favorites - Favorite tracks list
	 * @returns CurrentList object, or null if invalid sectionId
	 */
	setCurrentListFromSectionId(
		sectionId: string,
		trackList: TFile[],
		favorites: TFile[]
	): CurrentList | null {
		if (sectionId === "all") {
			return { type: "all", name: t("list.all"), tracks: trackList };
		} else if (sectionId === "favorites") {
			return { type: "favorites", name: t("list.favorites"), tracks: favorites };
		} else if (sectionId.startsWith("playlist-")) {
			const playlistName = sectionId.replace("playlist-", "");
			const playlistMap = this.playlistService.getPlaylistMap();
			const playlistPaths = playlistMap[playlistName] || [];
			const tracks = trackList.filter((f) => playlistPaths.includes(f.path));
			const sortedTracks = sortTracksByTrack(tracks, this.plugin.settings);
			return { type: "playlist", name: playlistName, tracks: sortedTracks };
		} else if (sectionId.startsWith("artist-")) {
			const artistName = sectionId.replace("artist-", "");
			const artists = this.libraryService.getArtists(trackList);
			const artist = artists.find((a) => a.name === artistName);
			if (artist) {
				return { type: "artist", name: artistName, tracks: artist.tracks };
			}
		} else if (sectionId.startsWith("album-")) {
			const albumName = sectionId.replace("album-", "");
			const albums = this.libraryService.getAlbums(trackList);
			const album = albums.find((a) => a.name === albumName);
			if (album) {
				return { type: "album", name: albumName, tracks: album.tracks };
			}
		}
		return null;
	}

	/**
	 * Calculates current list identifier string.
	 * 
	 * @param currentTrack - Currently playing track
	 * @param currentList - Current list object
	 * @param trackList - All tracks list
	 * @param favorites - Favorite tracks list
	 * @returns List identifier string ("all", "favorites", "playlist:xxx", etc.)
	 */
	calculateCurrentListId(
		currentTrack: TFile | null,
		currentList: CurrentList | null,
		trackList: TFile[],
		_favorites: TFile[]
	): string {
		if (currentList) {
			return this.formatCurrentList(currentList.type, currentList.name);
		}
		if (!currentTrack) return "all";

		return this.inferPlaylistFromTrack(currentTrack, trackList).listId;
	}

	/**
	 * Sets current list context from sectionId.
	 * 
	 * @param sectionId - Optional section ID
	 * @param currentSectionId - Current section ID
	 * @param trackList - All tracks list
	 * @param favorites - Favorite tracks list
	 * @returns Object containing list and listId
	 */
	setCurrentListContext(
		sectionId: string | undefined,
		currentSectionId: string | null,
		trackList: TFile[],
		favorites: TFile[]
	): { list: CurrentList | null; listId: string | null } {
		if (!sectionId) {
			return { list: null, listId: null };
		}
		const list = this.setCurrentListFromSectionId(sectionId, trackList, favorites);
		if (list) {
			return {
				list,
				listId: this.formatCurrentList(list.type, list.name),
			};
		}
		return { list: null, listId: null };
	}
}
