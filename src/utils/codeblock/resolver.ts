/**
 * Vault audio file resolution utility for codeblock player and protocol handlers
 */

import { App, TFile } from "obsidian";
import { isSupportedAudioExtension } from "@/constants/audio";

/**
 * Resolves an audio file from the vault using multiple search strategies:
 * 1. Exact path match
 * 2. Lookup in settings trackIndex (trackId or relative path)
 * 3. Sibling or vault-wide filename match
 * 
 * @param app - Obsidian App instance
 * @param trackIdentifier - Vault path, filename, or track ID
 * @param trackIndex - Optional trackIndex map from plugin settings
 * @returns Resolved TFile or null if not found
 */
export function resolveVaultAudioFile(
	app: App,
	trackIdentifier: string,
	trackIndex?: Record<string, string>
): TFile | null {
	if (!trackIdentifier || !trackIdentifier.trim()) {
		return null;
	}

	const cleanIdentifier = trackIdentifier.trim().replace(/^\[\[(.*)\]\]$/, "$1");

	// Strategy 1: Direct vault path lookup
	const directFile = app.vault.getAbstractFileByPath(cleanIdentifier);
	if (directFile instanceof TFile && isSupportedAudioExtension(directFile.extension)) {
		return directFile;
	}

	// Strategy 2: Lookup via plugin settings trackIndex
	if (trackIndex) {
		// As track ID
		if (trackIndex[cleanIdentifier]) {
			const file = app.vault.getAbstractFileByPath(trackIndex[cleanIdentifier]);
			if (file instanceof TFile && isSupportedAudioExtension(file.extension)) {
				return file;
			}
		}

		// As partial path in trackIndex values
		for (const [id, path] of Object.entries(trackIndex)) {
			if (path === cleanIdentifier || path.endsWith("/" + cleanIdentifier)) {
				const file = app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile && isSupportedAudioExtension(file.extension)) {
					return file;
				}
			}
		}
	}

	// Strategy 3: Vault-wide search by filename or basename
	const targetBasename = cleanIdentifier.includes("/")
		? cleanIdentifier.slice(cleanIdentifier.lastIndexOf("/") + 1)
		: cleanIdentifier;

	const targetWithoutExt = targetBasename.replace(/\.[^/.]+$/, "").toLowerCase();

	const allFiles = app.vault.getFiles();
	for (const file of allFiles) {
		if (!isSupportedAudioExtension(file.extension)) {
			continue;
		}

		if (file.name === targetBasename || file.path.endsWith(cleanIdentifier)) {
			return file;
		}

		if (file.basename.toLowerCase() === targetWithoutExt) {
			return file;
		}
	}

	return null;
}
