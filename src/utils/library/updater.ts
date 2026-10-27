/**
 * Music library updater utility module
 * 
 * Provides library scanning and rebuild functionality:
 * - Scans audio files
 * - Extracts audio metadata (title, artist, album, lyrics, replay gain)
 * - Generates artist and album index structures
 * - Updates plugin settings
 */

import { App, Notice } from "obsidian";
import MusicPlayerPlugin from "@/main";
import {
	getEmbeddedAudioMetadataFromBuffer,
	readAudioFileBinary,
	readAudioFileHeaderBinary,
	readCompanionLrc,
} from "../audio/metadata";
import { generateArtistsAndAlbums } from "../data/transform";
import { scanVaultAudioFiles } from "./scanVaultAudio";
import { parseTrackFilename } from "../audio/filenameParser";
import { t, tWithParams } from "@/utils/i18n/i18n";

/**
 * Rebuilds all music library data.
 * 
 * Completely scans music files, extracts metadata, indexes categories,
 * removes obsolete tracks from playlists and favorites, and persists data.json.
 * 
 * @param app Obsidian App instance
 * @param plugin MusicPlayerPlugin instance
 * @returns Number of successfully indexed tracks
 */
export async function rebuildAllData(
	app: App,
	plugin: MusicPlayerPlugin
): Promise<number> {
	const notice = new Notice(t("notice.scanning"), 0);
	
	try {
		// 1. Scan audio files matching music folder configuration
		const filteredFiles = scanVaultAudioFiles(app, plugin.settings.musicFolder ?? "");

		// 2. If no audio files are found, reset data structures
		if (filteredFiles.length === 0) {
			console.warn("No audio files found. Check music folder configuration.");
			plugin.settings.musicFolder = plugin.settings.musicFolder || '';
			plugin.settings.trackIndex = {};
			plugin.settings.tracks = {};
			plugin.settings.favorites = [];
			plugin.settings.playlists = {};
			plugin.settings.artists = {};
			plugin.settings.albums = {};
			await plugin.saveSettings();
			new Notice(t("notice.noMusicCleared"), 5000);
			return 0;
		}

		// 3. Initialize state structures
		plugin.settings.musicFolder = plugin.settings.musicFolder || '';
		plugin.settings.trackIndex = {};
		plugin.settings.tracks = {};
		plugin.settings.favorites = plugin.settings.favorites || [];
		plugin.settings.playlists = plugin.settings.playlists || {};
		plugin.settings.artists = {};
		plugin.settings.albums = {};

		let processed = 0;
		const total = filteredFiles.length;
		
		// 4. Process each audio file
		for (const file of filteredFiles) {
			try {
				notice.setMessage(
					tWithParams("notice.processingFile", {
						basename: file.basename,
						current: processed + 1,
						total,
					})
				);
				
				// Read 256KB header slice first to conserve memory on mobile and lossless files
				let binary = await readAudioFileHeaderBinary(app, file);
				let audioMetadata = binary ? await getEmbeddedAudioMetadataFromBuffer(binary) : null;

				// Fallback to full binary read if header does not contain valid metadata
				if (!audioMetadata || (!audioMetadata.title && !audioMetadata.artist)) {
					const fullBinary = await readAudioFileBinary(app, file);
					if (fullBinary) {
						const fullMeta = await getEmbeddedAudioMetadataFromBuffer(fullBinary);
						if (fullMeta) {
							audioMetadata = fullMeta;
						}
					}
				}

				const parsed = parseTrackFilename(file.path);
				const title = audioMetadata?.title?.trim() || parsed.title || file.basename;
				const artist = audioMetadata?.artist?.trim() || parsed.artist || '';
				const album = audioMetadata?.album?.trim() || parsed.album || '';
				const year = audioMetadata?.year || parsed.year;

				const { getOrCreateTrackId } = await import("@/utils/track/id");
				const trackId = getOrCreateTrackId(file.path, plugin.settings);

				// Embedded lyrics take priority; fallback to companion .lrc file in same directory
				let lyrics = audioMetadata?.lyricsText || '';
				if (!lyrics.trim()) {
					const companion = await readCompanionLrc(app, file);
					if (companion) {
						lyrics = companion;
					}
				}
				
				plugin.settings.tracks[trackId] = {
					title,
					artist,
					album,
					lyrics,
					year,
					genre: Array.isArray(audioMetadata?.genre) ? 
						audioMetadata?.genre[0] : audioMetadata?.genre,
					track: audioMetadata?.track,
					duration: audioMetadata?.duration,
					replayGainDb: audioMetadata?.replayGainDb,
				};

				processed++;
				console.debug(`Processed file: ${file.path} (${processed}/${total})`);
				
				if (processed % 5 === 0 || processed === total) {
					notice.setMessage(tWithParams("notice.progressTracks", { current: processed, total }));
				}

				// Yield to event loop periodically to allow mobile browser GC to reclaim ArrayBuffers
				if (processed % 4 === 0) {
					await new Promise((resolve) => window.setTimeout(resolve, 0));
				}
			} catch (error) {
				console.error(`Error processing file ${file.path}:`, error);
			}
		}

		// 5. Generate artist and album index maps
		notice.setMessage(t("notice.generatingCategories"));
		const { artists, albums } = generateArtistsAndAlbums(plugin.settings);
		plugin.settings.artists = artists;
		plugin.settings.albums = albums;

		// 6. Clean up obsolete IDs from index, favorites, and playlists
		notice.setMessage(t("notice.cleaningInvalid"));
		const validTrackIds = new Set(Object.keys(plugin.settings.tracks));
		
		if (plugin.settings.trackIndex) {
			const originalTrackIndexCount = Object.keys(plugin.settings.trackIndex).length;
			const cleanedTrackIndex: Record<string, string> = {};
			for (const [trackId, path] of Object.entries(plugin.settings.trackIndex)) {
				if (validTrackIds.has(trackId)) {
					cleanedTrackIndex[trackId] = path;
				}
			}
			plugin.settings.trackIndex = cleanedTrackIndex;
			const removedTrackIndexCount = originalTrackIndexCount - Object.keys(plugin.settings.trackIndex).length;
			if (removedTrackIndexCount > 0) {
				console.debug(`Removed ${removedTrackIndexCount} stale IDs from trackIndex`);
			}
		}
		
		if (plugin.settings.favorites) {
			const originalFavoritesCount = plugin.settings.favorites.length;
			plugin.settings.favorites = plugin.settings.favorites.filter(id => validTrackIds.has(id));
			const removedFavoritesCount = originalFavoritesCount - plugin.settings.favorites.length;
			if (removedFavoritesCount > 0) {
				console.debug(`Removed ${removedFavoritesCount} missing tracks from favorites`);
			}
		}
		
		if (plugin.settings.playlists) {
			let totalRemovedFromPlaylists = 0;
			for (const [playlistName, trackIds] of Object.entries(plugin.settings.playlists)) {
				if (Array.isArray(trackIds)) {
					const originalCount = trackIds.length;
					plugin.settings.playlists[playlistName] = trackIds.filter(id => validTrackIds.has(id));
					const updatedPlaylist = plugin.settings.playlists[playlistName];
					const removedCount = originalCount - (updatedPlaylist?.length ?? 0);
					if (removedCount > 0) {
						totalRemovedFromPlaylists += removedCount;
						console.debug(`Removed ${removedCount} missing tracks from playlist "${playlistName}"`);
					}
				}
			}
			if (totalRemovedFromPlaylists > 0) {
				console.debug(`Removed ${totalRemovedFromPlaylists} missing tracks from all playlists`);
			}
		}

		// 7. Save settings
		notice.setMessage(t("notice.saving"));
		await plugin.saveSettings();

		new Notice(tWithParams("notice.rebuildDone", { count: processed }), 3000);
		
		return processed;
		
	} catch (error) {
		console.error("Error rebuilding music library:", error);
		new Notice(t("notice.rebuildError"), 5000);
		throw error;
	} finally {
		notice.hide();
	}
}
