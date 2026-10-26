/**
 * List formatting utility functions
 *
 * Converts between type/name pairs and stable listId strings,
 * and formats list IDs into UI labels.
 */

import { t, tWithParams } from "@/utils/i18n/i18n";

/**
 * Formats playlist information into currentList / listId string format.
 *
 * @param type List type ("all", "favorites", "playlist", "artist", "album")
 * @param name List name (required for playlist, artist, album types)
 * @returns Formatted list identifier string; falls back to "all" if invalid
 */
export function formatCurrentList(type: string, name?: string): string {
	if (type === "all") return "all";
	if (type === "favorites") return "favorites";
	if (type === "playlist" && name) return `playlist:${name}`;
	if (type === "artist" && name) return `artist:${name}`;
	if (type === "album" && name) return `album:${name}`;
	return "all";
}

/**
 * Formats stable list ID into localized display text (e.g. for queue header).
 */
export function formatListLabel(listId: string): string {
	if (!listId || listId === "all") return t("list.all");
	if (listId === "favorites") return t("list.favorites");
	if (listId.startsWith("playlist:")) {
		const name = listId.slice("playlist:".length);
		return tWithParams("list.playlistLabel", { name });
	}
	if (listId.startsWith("artist:")) {
		const raw = listId.slice("artist:".length).trim();
		const name = raw === "" ? t("meta.unknownArtist") : raw;
		return tWithParams("list.artistLabel", { name });
	}
	if (listId.startsWith("album:")) {
		const raw = listId.slice("album:".length).trim();
		const name = raw === "" ? t("meta.unknownAlbum") : raw;
		return tWithParams("list.albumLabel", { name });
	}
	return t("list.all");
}
