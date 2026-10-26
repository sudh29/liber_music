/**
 * Audio metadata extraction module
 * 
 * Extracts embedded metadata from binary audio files, including:
 * - Album cover images
 * - Lyric text (prioritizes native timestamped synced lyrics, otherwise falls back to common.lyrics)
 * - Basic track information (title, artist, album, etc.)
 * - Track number and duration
 * 
 * Note: Lyrics are read from embedded tags; prioritizes library-parsed common.lyrics, consistent with the original implementation.
 * Multiple frames sharing the same ID (caused by tag editors splitting overly long text) are joined together to avoid reading only the first frame.
 */

// Buffer polyfill for mobile environments
// music-metadata-browser uses Buffer internally, requiring it in the global scope
import { initBufferPolyfill } from "../polyfills/buffer";
initBufferPolyfill();

import { App, TFile } from "obsidian";
import { IAudioMetadata, parseBuffer } from "music-metadata";
import { isSupportedAudioExtension } from "@/constants/audio";
import { parseReplayGain } from "./replayGain";
export { getCompanionLrcFile, getCompanionLrcPath, readCompanionLrc } from "./companionLrc";
export { applyReplayGainToVolume, calculateReplayGainMultiplier, parseReplayGain } from "./replayGain";

/**
 * Multiple lyric values collected under the same (format, tagID).
 */
interface LyricsTagGroup {
	/** Tag format (e.g. ID3v2.3, vorbis) */
	format: string;
	/** Tag ID (uppercase, e.g. TXXX:LYRICS) */
	id: string;
	/** Values ordered by occurrence in file */
	chunks: string[];
}

/**
 * Checks whether a chunk starts with a new document/line (LRC metadata tag or line timestamp).
 * Used to distinguish "split portions of the same lyric" from "multiple independently written tags".
 */
const LRC_DOC_START =
	/^[\s\ufeff]*\[(?:(?:ar|ti|al|by|offset|hash|id|total|sign|qq|qr|author|auth|au|length|language|re|ve|edition|date|genre|encoder|coder|source|media|uploads|program|lrccreator)\s*:|\d{1,3}:\d{1,2}(?:\.\d{1,3})?\])/i;

/**
 * Merges multiple values under the same tag ID.
 *
 * ID3v2.3 TXXX frames can be split by "/" in music-metadata:
 * FrameParser.splitValue splits frames with major < 4 by "/" when values do not contain NUL
 * (an ID3v2.3 separator rule for name frames like TCOM/TEXT erroneously applied to single-value TXXX),
 * consuming "/" as a delimiter. Rejoining with "/" restores the original content; if a chunk starts
 * with a new document header (metadata or line timestamp tag), it is treated as an independently written tag and joined by newline.
 *
 * ID3v2.4 is split by NUL only; Vorbis / APE are true multi-value tags, joined with newline.
 *
 * @param format Tag format (e.g. ID3v2.3)
 * @param id Tag ID (uppercase)
 * @param chunks Values ordered by occurrence in file
 * @returns Combined full text
 */
function joinLyricFrameTexts(format: string, id: string, chunks: readonly string[]): string {
	const slashSeparated = format === "ID3v2.3" && id.startsWith("TXXX");
	let result = "";
	for (const chunk of chunks) {
		if (!chunk) continue;
		if (result) {
			result += slashSeparated && !LRC_DOC_START.test(chunk) ? "/" : "\n";
		}
		result += chunk;
	}
	return result;
}

/**
 * Merges multiple sub-values from a single tag value (Vorbis / APE multi-value tags) by newline.
 */
function joinLyricValues(chunks: readonly string[]): string {
	return chunks.filter((chunk) => chunk).join("\n");
}

/**
 * Extracts lyric text from a single tag value.
 * 
 * Supports various value formats: string, string array, object text property (string or string array).
 * 
 * @param value Tag value
 * @returns Extracted text, or null if unextractable
 */
function extractTagLyricsText(value: unknown): string | null {
	// Format 1: Direct string
	if (typeof value === "string") return value;
	// Format 1b: String array (multi-value lyrics in some Vorbis / APE tags)
	if (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((item: unknown) => typeof item === "string")
	) {
		return joinLyricValues(value);
	}
	// Format 2/3: text property on object (string or string array, such as USLT)
	if (value !== null && typeof value === "object") {
		const textProp = (value as { text?: unknown }).text;
		if (typeof textProp === "string") return textProp;
		if (
			Array.isArray(textProp) &&
			textProp.length > 0 &&
			textProp.every((item: unknown) => typeof item === "string")
		) {
			return joinLyricValues(textProp);
		}
	}
	return null;
}

/**
 * Extracts lyric text from native tags (collecting all matching frames and merging by tag).
 *
 * Multiple values under the same (format, tagID) arise for two reasons: tag editors splitting long text
 * across multiple frames of the same ID, or music-metadata mistakenly splitting ID3v2.3 TXXX values on "/".
 * Taking only the first frame loses subsequent lyrics, so values are grouped and joined by (format, tagID).
 * When multiple candidate groups exist (e.g. TXXX:LYRICS and USLT both present), timestamped lyrics
 * (supporting word-by-word/line-by-line sync) are prioritized, followed by the more complete group.
 *
 * @param native Native tag object
 * @param idMatcher Tag ID matcher function returning true if matched
 * @param descriptionMatcher Optional description matcher function for extra matching
 * @returns Extracted text value, or undefined if not found
 */
function extractTextFromNativeTags(
	native: IAudioMetadata["native"] | undefined,
	idMatcher: (id: string, upperId: string) => boolean,
	descriptionMatcher?: (description: string) => boolean
): string | undefined {
	if (!native) return undefined;

	const descriptionFromUnknown = (v: unknown): string => {
		if (typeof v !== "object" || v === null || !("description" in v)) return "";
		const d = (v as { description?: unknown }).description;
		return typeof d === "string" ? d : "";
	};

	// Group and collect matching text by (format, tagID) preserving appearance order
	const groups = new Map<string, LyricsTagGroup>();

	for (const format of Object.keys(native)) {
		const nativeTags = native[format] || [];
		// Traverse all tags for this format
		for (const tag of nativeTags) {
			const id = String(tag.id || "");
			const upperId = id.toUpperCase();
			const value: unknown = tag.value;

			const isMatched = idMatcher(id, upperId);
			const desc = descriptionFromUnknown(value);
			const matchesByDescription =
				!isMatched && !!descriptionMatcher && desc !== "" && descriptionMatcher(desc);
			if (!isMatched && !matchesByDescription) continue;

			const text = extractTagLyricsText(value);
			if (text === null || text.trim() === "") continue;

			const key = `${format}\u0000${upperId}`;
			const existing = groups.get(key);
			if (existing) {
				existing.chunks.push(text);
			} else {
				groups.set(key, { format, id: upperId, chunks: [text] });
			}
		}
	}

	if (groups.size === 0) return undefined;

	// Pick the best candidate group: prefer timestamped (synchronizable), then higher content length
	let best: string | undefined;
	let bestScore = -1;
	for (const group of groups.values()) {
		const joined = joinLyricFrameTexts(group.format, group.id, group.chunks);
		const hasTimestamps = /\d{1,3}:\d{1,2}\.\d{1,3}/.test(joined);
		const score = (hasTimestamps ? 1_000_000 : 0) + joined.length;
		if (score > bestScore) {
			bestScore = score;
			best = joined;
		}
	}

	return best;
}

/**
 * Extracts text from common.lyrics element.
 *
 * In music-metadata 12+, elements are { language, descriptor, text } objects (aggregated from USLT etc.),
 * while earlier versions were strings; both formats are supported.
 */
function lyricsEntryToText(entry: unknown): string {
	if (typeof entry === "string") return entry;
	if (entry !== null && typeof entry === "object" && "text" in entry) {
		const text = (entry as { text?: unknown }).text;
		if (typeof text === "string") return text;
	}
	return "";
}

/**
 * Extracts embedded lyrics:
 * 1. Native tags: ID contains lyrics, or USLT / SYLT; TXXX with description containing lyrics
 *    (extractTextFromNativeTags prioritizes timestamped synchronizable lyrics)
 * 2. Fall back to common.lyrics (M4A and other formats with aggregated fields only)
 *
 * Native tags must take priority: in v12+, USLT is aggregated into common.lyrics;
 * checking common first would overwrite word-by-word timestamped lyrics in TXXX:LYRICS with plain text.
 */
function extractLyricsFromMetadata(metadata: IAudioMetadata): string | undefined {
	const fromNative = extractTextFromNativeTags(
		metadata.native,
		(id, upperId) => {
			const isLyricsId = /lyrics/i.test(id);
			const isStandardLyrics = upperId === "USLT" || upperId === "SYLT";
			return isLyricsId || isStandardLyrics;
		},
		(desc) => /lyrics/i.test(desc)
	);
	if (fromNative?.trim()) {
		return fromNative;
	}

	const common = metadata.common.lyrics;
	if (common && Array.isArray(common) && common.length > 0) {
		const joined = common
			.map(lyricsEntryToText)
			.filter((text) => text.trim() !== "")
			.join("\n");
		if (joined.trim()) return joined;
	}

	return undefined;
}

/**
 * Embedded audio metadata interface.
 * Represents all metadata information extracted from an audio file.
 */
export interface EmbeddedAudioMetadata {
	/** Cover image base64 Data URL (e.g. data:image/jpeg;base64,...) */
	coverDataUrl?: string;
	/** Lyric text content */
	lyricsText?: string;
	/** Song title */
	title?: string;
	/** Artist name */
	artist?: string;
	/** Album name */
	album?: string;
	/** Album artist (may differ from track artist) */
	albumArtist?: string;
	/** Release year */
	year?: number;
	/** Genre (string or array of strings) */
	genre?: string | string[];
	/** Track number (position within album) */
	track?: number;
	/** Duration in seconds */
	duration?: number;
	/** ReplayGain track gain (dB) */
	replayGainDb?: number;
}

/**
 * Reads binary data of an audio file (mobile compatible).
 * 
 * Uses adapter.readBinary as preferred method (mobile compatible),
 * falling back to vault.readBinary if failed.
 * 
 * @param app Obsidian App instance
 * @param file Audio file
 * @returns Binary data (ArrayBuffer) of audio file, or null if read failed
 */
export async function readAudioFileBinary(
	app: App,
	file: TFile
): Promise<ArrayBuffer | null> {
	try {
		// Use adapter.readBinary for mobile compatibility
		// On mobile, vault.readBinary may not work properly, so adapter.readBinary is preferred
		let binary: ArrayBuffer;
		try {
			binary = await app.vault.adapter.readBinary(file.path);
		} catch (adapterError) {
			// If adapter.readBinary fails, attempt vault.readBinary as fallback
			console.warn(`Failed to read with adapter.readBinary, falling back to vault.readBinary (${file.path}):`, adapterError);
			try {
				binary = await app.vault.readBinary(file);
			} catch (vaultError) {
				console.error(`Unable to read file ${file.path}:`, vaultError);
				return null;
			}
		}
		
		// Ensure binary is an ArrayBuffer
		if (!(binary instanceof ArrayBuffer)) {
			console.error(`File ${file.path} read result is not an ArrayBuffer:`, typeof binary);
			return null;
		}
		
		return binary;
	} catch (error) {
		console.error(`Error reading audio file (${file.path}):`, error);
		return null;
	}
}

/** Default metadata probe header chunk size: 256KB */
export const METADATA_HEADER_CHUNK_SIZE = 256 * 1024;

/**
 * Optimized header binary read for large audio files:
 * Reads only the initial 256KB header to prevent loading entire 50MB+ lossless audio files and causing mobile OOM crashes.
 *
 * @param app Obsidian App instance
 * @param file Audio file
 * @param maxBytes Maximum bytes to read (default 256KB)
 * @returns Header binary slice
 */
export async function readAudioFileHeaderBinary(
	app: App,
	file: TFile,
	maxBytes: number = METADATA_HEADER_CHUNK_SIZE
): Promise<ArrayBuffer | null> {
	// 1. On desktop (Electron) with Node.js fs environment, use fs.openSync + fs.readSync to read only the first maxBytes
	try {
		const adapter = app.vault.adapter as unknown as { getBasePath?: () => string };
		if (typeof adapter.getBasePath === "function") {
			const fs = await import("node:fs");
			const path = await import("node:path");
			const basePath = adapter.getBasePath();
			const fullPath = path.join(basePath, file.path);
			if (fs.existsSync(fullPath)) {
				const fd = fs.openSync(fullPath, "r");
				try {
					const buffer = Buffer.alloc(maxBytes);
					const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
					const slice = buffer.subarray(0, bytesRead);
					return slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
				} finally {
					fs.closeSync(fd);
				}
			}
		}
	} catch {
		// Ignore and fall back to adapter read
	}

	// 2. On mobile/sandbox environment, use adapter to read and slice
	const fullBuffer = await readAudioFileBinary(app, file);
	if (!fullBuffer) return null;
	if (fullBuffer.byteLength <= maxBytes) {
		return fullBuffer;
	}
	return fullBuffer.slice(0, maxBytes);
}

/**
 * Extracts embedded metadata from an audio file binary buffer.
 * 
 * Uses music-metadata-browser library to parse audio files, extracting:
 * 1. Cover image: converted to Data URL
 * 2. Lyrics: prioritizes synchronizable timestamped lyrics from native tags, falling back to common.lyrics
 * 3. Basic information: title, artist, album, year, genre, track number, duration, etc.
 * 
 * @param buffer Binary data (ArrayBuffer) of audio file
 * @returns Extracted metadata object, or null if parsing failed
 * 
 * @example
 * ```typescript
 * const binary = await vault.readBinary(file);
 * const metadata = await getEmbeddedAudioMetadataFromBuffer(binary);
 * if (metadata) {
 *   console.log(metadata.title, metadata.artist);
 * }
 * ```
 */
export async function getEmbeddedAudioMetadataFromBuffer(
	buffer: ArrayBuffer,
): Promise<EmbeddedAudioMetadata | null> {
	try {
		// Verify buffer type
		if (!(buffer instanceof ArrayBuffer)) {
			console.error("getEmbeddedAudioMetadataFromBuffer: buffer is not an ArrayBuffer", typeof buffer);
			return null;
		}
		
		// Check buffer size
		if (buffer.byteLength === 0) {
			console.error("getEmbeddedAudioMetadataFromBuffer: buffer is empty");
			return null;
		}
		
		// Convert ArrayBuffer to Uint8Array
		// Use Uint8Array instead of Node.js Buffer for browser and mobile environments
		const uint8Array = new Uint8Array(buffer);
		
		// Parse audio metadata with duration calculation enabled
		const metadata: IAudioMetadata = await parseBuffer(uint8Array, "audio", {
			duration: true,
		});

		const result: EmbeddedAudioMetadata = {};

		// Extract cover image
		// Cover image is typically stored in metadata.common.picture array
		const picture = metadata.common.picture && metadata.common.picture[0];
		if (picture && picture.data) {
			// Convert image data to Uint8Array (browser compatible)
			const pictureData = new Uint8Array(picture.data);

			// Use Buffer (polyfilled at top) to convert binary data to base64
			// Generates a base64 Data URL persistable in data.json
			const base64 = Buffer.from(pictureData).toString("base64");
			const mimeType = picture.format || "image/jpeg";
			result.coverDataUrl = `data:${mimeType};base64,${base64}`;
		}

		// Lyrics: common.lyrics -> native tag matching -> USLT fallback
		const lyricsText = extractLyricsFromMetadata(metadata);
		if (lyricsText?.trim()) {
			result.lyricsText = lyricsText;
		}

		// Extract basic metadata information
		// Track title: prioritize common.title, otherwise search native tags
		if (metadata.common.title) {
			result.title = metadata.common.title;
		} else {
			const extractedTitle = extractTextFromNativeTags(
				metadata.native,
				(id) => {
					// Check title-related tags
					const upperId = id.toUpperCase();
					return /^(TIT2|TITLE|TITLE_MAIN|TITLE_MAIN_MAIN|TITLE_ORIGINAL)$/i.test(upperId);
				}
			);
			if (extractedTitle) {
				result.title = extractedTitle.trim();
			}
		}

		// Track duration (seconds)
		if (metadata.format?.duration) {
			result.duration = metadata.format.duration;
		}
		
		// Artist name (may be array, joined if so)
		// Prioritize common.artist, otherwise search native tags
		if (metadata.common.artist) {
			result.artist = Array.isArray(metadata.common.artist)
				? metadata.common.artist.join(", ")
				: metadata.common.artist;
		} else {
			const extractedArtist = extractTextFromNativeTags(
				metadata.native,
				(id) => {
					// Check artist-related tags
					const upperId = id.toUpperCase();
					return /^(TPE1|ARTIST|ARTIST_MAIN|ARTIST_ORIGINAL)$/i.test(upperId);
				}
			);
			if (extractedArtist) {
				result.artist = extractedArtist.trim();
			}
		}
		
		// Album name
		if (metadata.common.album) {
			result.album = metadata.common.album;
		}
		
		// Album artist (may be array, joined if so)
		if (metadata.common.albumartist) {
			result.albumArtist = Array.isArray(metadata.common.albumartist)
				? metadata.common.albumartist.join(", ")
				: metadata.common.albumartist;
		}
		
		// Release year
		if (metadata.common.year) {
			result.year = metadata.common.year;
		}
		
		// Music genre (may be array, joined if so)
		if (metadata.common.genre) {
			result.genre = Array.isArray(metadata.common.genre)
				? metadata.common.genre.join(", ")
				: metadata.common.genre;
		}
		
		// Track number (may be object {no: 1, of: 10} or direct number)
		if (metadata.common.track) {
			result.track = typeof metadata.common.track === "object"
				? metadata.common.track.no || undefined
				: metadata.common.track;
		}

		// ReplayGain track gain (dB)
		const rawGain =
			(metadata.common as { replaygain_track_gain?: unknown })?.replaygain_track_gain ??
			extractTextFromNativeTags(
				metadata.native,
				(id) => /replaygain_track_gain/i.test(id) || /TXXX:REPLAYGAIN_TRACK_GAIN/i.test(id)
			);
		const parsedGain = parseReplayGain(rawGain);
		if (parsedGain !== undefined) {
			result.replayGainDb = parsedGain;
		}

		return result;
	} catch (e) {
		// Log detailed error information on failure for debugging (especially on mobile)
		const errorMessage = e instanceof Error ? e.message : String(e);
		const errorDetails: Record<string, unknown> = {
			error: errorMessage,
			bufferSize: buffer?.byteLength ?? 0,
			bufferType: buffer ? (buffer instanceof ArrayBuffer ? 'ArrayBuffer' : typeof buffer) : 'null/undefined'
		};
		
		// Log stack trace only in dev or supported environments
		if (e instanceof Error && e.stack) {
			try {
				errorDetails.stack = e.stack;
			} catch {
				// Ignore failure retrieving stack trace
			}
		}
		
		console.error("Failed to parse embedded audio metadata:", errorDetails);
		return null;
	}
}

/**
 * Extracts embedded album cover from an audio file.
 * 
 * Reads audio file binary data, extracts embedded cover, and returns base64 Data URL.
 * Convenience helper wrapping file read and cover extraction workflow.
 * 
 * @param app Obsidian App instance
 * @param file Audio file
 * @returns Cover image base64 Data URL, or undefined if not found
 * 
 * @example
 * ```typescript
 * const coverUrl = await getEmbeddedCoverFromFile(app, file);
 * if (coverUrl) {
 *   console.log('Cover:', coverUrl);
 * }
 * ```
 */
export async function getEmbeddedCoverFromFile(
	app: App,
	file: TFile
): Promise<string | undefined> {
	try {
		// Check whether extension is supported
		const ext = file.extension?.toLowerCase() || '';
		if (!isSupportedAudioExtension(ext)) {
			return undefined;
		}

		// Read audio file binary data (mobile compatible)
		const buffer = await readAudioFileBinary(app, file);
		if (!buffer) {
			return undefined;
		}
		
		// Extract metadata (including embedded cover)
		const metadata = await getEmbeddedAudioMetadataFromBuffer(buffer);
		
		// Return base64 Data URL if cover exists
		return metadata?.coverDataUrl;
	} catch (error) {
		console.error(`Error getting embedded cover (${file.path}):`, error);
		return undefined;
	}
}
