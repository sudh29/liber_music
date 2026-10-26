/**
 * Cover finder utility module
 * 
 * Locates track cover images by priority:
 * 1. Image named "cover" in same folder (cover.jpg, cover.png, etc.)
 * 2. Image matching track basename in same folder (e.g. song.mp3 -> song.jpg)
 * 3. Embedded artwork extracted from audio file metadata
 */

import { App, TFile } from "obsidian";
import { getEmbeddedCoverFromFile } from "@/utils/audio/metadata";
import { IMAGE_EXTENSIONS } from "@/constants/audio";

/**
 * Converts an image file into a URL suitable for <img src="...">
 * - Prefers Obsidian app.vault.getResourcePath for lower memory usage and speed
 * - Falls back to base64 Data URL if resource path fails
 * 
 * @param app Obsidian App instance
 * @param file Image file
 * @returns Image URL, or undefined on failure
 */
async function imageFileToUrl(app: App, file: TFile): Promise<string | undefined> {
	try {
		try {
			const resourcePath = app.vault.getResourcePath(file);
			if (resourcePath) return resourcePath;
		} catch {
			// Fallback to readBinary
		}

		const binary = await app.vault.readBinary(file);
		const base64 = Buffer.from(binary).toString("base64");
		const ext = file.extension?.toLowerCase() || "";
		const mimeTypes: Record<string, string> = {
			"jpg": "image/jpeg",
			"jpeg": "image/jpeg",
			"png": "image/png",
			"gif": "image/gif",
			"webp": "image/webp",
			"bmp": "image/bmp",
		};
		const mimeType = mimeTypes[ext] || "image/jpeg";
		return `data:${mimeType};base64,${base64}`;
	} catch (error) {
		console.error(`Failed to read image file (${file.path}):`, error);
		return undefined;
	}
}

export interface GetTrackCoverOptions {
	/** Whether to extract embedded artwork from audio metadata */
	includeEmbedded?: boolean;
}

/**
 * Resolves cover image URL for a track file.
 * 
 * @param app Obsidian App instance
 * @param trackFile Track audio file
 * @param options Lookup options
 * @returns Cover image URL, or undefined if not found
 */
export async function getTrackCover(
	app: App,
	trackFile: TFile,
	options: GetTrackCoverOptions = {}
): Promise<string | undefined> {
	const { includeEmbedded = true } = options;
	const trackDir = trackFile.parent?.path || "";
	const trackNameWithoutExt = trackFile.basename;

	const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

	// Priority 1: cover.(jpg/png/...)
	for (const extWithDot of IMAGE_EXTENSIONS) {
		const ext = extWithDot.startsWith(".") ? extWithDot.slice(1) : extWithDot;
		const p = join(trackDir, `cover.${ext}`);
		const f = app.vault.getAbstractFileByPath(p);
		if (f && f instanceof TFile) {
			const url = await imageFileToUrl(app, f);
			if (url) return url;
		}
		const p2 = join(trackDir, `Cover.${ext}`);
		const f2 = app.vault.getAbstractFileByPath(p2);
		if (f2 && f2 instanceof TFile) {
			const url = await imageFileToUrl(app, f2);
			if (url) return url;
		}
	}

	// Priority 2: songName.(jpg/png/...)
	for (const extWithDot of IMAGE_EXTENSIONS) {
		const ext = extWithDot.startsWith(".") ? extWithDot.slice(1) : extWithDot;
		const p = join(trackDir, `${trackNameWithoutExt}.${ext}`);
		const f = app.vault.getAbstractFileByPath(p);
		if (f && f instanceof TFile) {
			const url = await imageFileToUrl(app, f);
			if (url) return url;
		}
	}

	// Priority 3: Embedded metadata artwork
	if (!includeEmbedded) return undefined;
	return await getEmbeddedCoverFromFile(app, trackFile);
}
