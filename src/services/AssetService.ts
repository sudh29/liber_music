/**
 * Asset management service
 *
 * Manages loading and caching of plugin asset files.
 * Asset files (e.g. images) are converted to base64 Data URIs for consumption in React components.
 *
 * Reads files under `<configDir>/plugins/<id>/` via {@link App.vault.adapter} without Node `fs`,
 * ensuring compatibility with Obsidian Mobile and eslint-plugin-obsidianmd's `import/no-nodejs-modules` rule.
 */

import { App, normalizePath } from "obsidian";
import MusicPlayerPlugin from "@/main";

/** Converts ArrayBuffer to base64 without Node Buffer, compatible with browser / mobile */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const chunkSize = 8192;
	let binary = "";
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const end = Math.min(i + chunkSize, bytes.length);
		const chunk = bytes.subarray(i, end);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

function extensionFromFilename(filename: string): string {
	const lastDot = filename.lastIndexOf(".");
	return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : "";
}

function mimeTypeForImageExtension(ext: string): string {
	switch (ext) {
		case ".png":
			return "image/png";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".gif":
			return "image/gif";
		case ".svg":
			return "image/svg+xml";
		case ".webp":
			return "image/webp";
		default:
			return "image/png";
	}
}

/**
 * Asset management service class.
 *
 * Provides asset loading and caching by converting files into base64 Data URIs.
 * In-memory cache prevents redundant file reads.
 */
export class AssetService {
	/** Asset file cache (filename -> base64 Data URI) */
	private assetCache: Map<string, string> = new Map();

	/**
	 * Creates an asset service instance.
	 *
	 * @param app - Obsidian App instance for accessing vault adapter
	 * @param plugin - Plugin instance for retrieving plugin ID
	 */
	constructor(
		private app: App,
		private plugin: MusicPlayerPlugin
	) {}

	/**
	 * Retrieves base64 Data URI for a plugin asset file.
	 *
	 * Reads asset file from plugin directory and converts to base64 Data URI.
	 * Returns cached result if already loaded.
	 * Returns a transparent 1x1 placeholder image if file is missing or read fails.
	 *
	 * @param filename - Asset filename (relative to plugin directory)
	 * @returns base64 Data URI string
	 */
	async getAssetPath(filename: string): Promise<string> {
		if (this.assetCache.has(filename)) return this.assetCache.get(filename)!;
		try {
			const pluginId = this.plugin.manifest.id;
			const basePath = this.plugin.manifest.dir ?? `${this.app.vault.configDir}/plugins/${pluginId}`;
			const relativePath = normalizePath(`${basePath}/${filename}`);
			const adapter = this.app.vault.adapter;
			if (!(await adapter.exists(relativePath))) {
				throw new Error(`Asset file does not exist: ${relativePath}`);
			}
			const fileBuffer = await adapter.readBinary(relativePath);
			const base64 = arrayBufferToBase64(fileBuffer);
			const ext = extensionFromFilename(filename);
			const mimeType = mimeTypeForImageExtension(ext);
			const dataUri = `data:${mimeType};base64,${base64}`;
			this.assetCache.set(filename, dataUri);
			return dataUri;
		} catch (error) {
			console.error(`Failed to load asset file ${filename}:`, error);
			return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
		}
	}
}
