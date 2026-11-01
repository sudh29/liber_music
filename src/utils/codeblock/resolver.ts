/**
 * Vault audio file resolution utility for codeblock player and protocol handlers
 */

import { App, TFile, TFolder } from "obsidian";
import { isSupportedAudioExtension } from "@/constants/audio";

function collectFolderAudioFiles(folder: TFolder): TFile[] {
	const files: TFile[] = [];
	for (const child of folder.children) {
		if (child instanceof TFile) {
			if (isSupportedAudioExtension(child.extension)) {
				files.push(child);
			}
		} else if (child instanceof TFolder) {
			files.push(...collectFolderAudioFiles(child));
		}
	}
	return files;
}

/**
 * Resolves an audio file from the vault using multiple search strategies:
 * 1. Exact path match
 * 2. Lookup in settings trackIndex (trackId or relative path)
 * 3. Fast metadataCache linkpath lookup
 * 4. Music folder search (if configured) or vault-wide fallback match
 * 
 * @param app - Obsidian App instance
 * @param trackIdentifier - Vault path, filename, or track ID
 * @param trackIndex - Optional trackIndex map from plugin settings
 * @param musicFolder - Optional root music folder from plugin settings
 * @returns Resolved TFile or null if not found
 */
export function resolveVaultAudioFile(
	app: App,
	trackIdentifier: string,
	trackIndex?: Record<string, string>,
	musicFolder?: string
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
		for (const [, path] of Object.entries(trackIndex)) {
			if (path === cleanIdentifier || path.endsWith("/" + cleanIdentifier)) {
				const file = app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile && isSupportedAudioExtension(file.extension)) {
					return file;
				}
			}
		}
	}

	// Strategy 3: Fast metadataCache linkpath lookup
	if (app.metadataCache?.getFirstLinkpathDest) {
		const cachedFile = app.metadataCache.getFirstLinkpathDest(cleanIdentifier, "");
		if (cachedFile instanceof TFile && isSupportedAudioExtension(cachedFile.extension)) {
			return cachedFile;
		}
	}

	// Strategy 4: Scoped folder search or vault-wide search by filename or basename
	const targetBasename = cleanIdentifier.includes("/")
		? cleanIdentifier.slice(cleanIdentifier.lastIndexOf("/") + 1)
		: cleanIdentifier;

	const targetWithoutExt = targetBasename.replace(/\.[^/.]+$/, "").toLowerCase();

	// Search scoped folder first when musicFolder is configured to prevent full-vault scanning lag
	if (musicFolder && musicFolder.trim()) {
		const folder = app.vault.getAbstractFileByPath(musicFolder.trim());
		if (folder instanceof TFolder) {
			const folderFiles = collectFolderAudioFiles(folder);
			for (const file of folderFiles) {
				if (file.name === targetBasename || file.path.endsWith(cleanIdentifier)) {
					return file;
				}
				if (file.basename.toLowerCase() === targetWithoutExt) {
					return file;
				}
			}
		}
	}

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
