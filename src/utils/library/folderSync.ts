/**
 * Automated Folder-to-Playlist Auto-Sync Engine
 * 
 * Analyzes audio files and dynamically discovers parent folder groupings,
 * exposing them as automated folder playlists in the library.
 */

import { TFile } from "obsidian";

export interface FolderPlaylistResult {
	/** Formatted folder playlist name, e.g. "📁 Classical" */
	name: string;
	/** Raw folder relative path */
	folderPath: string;
	/** Files contained within this folder */
	files: TFile[];
}

/**
 * Extracts normalized directory path of a file relative to the configured musicFolder.
 */
export function getRelativeDirectoryPath(
	filePath: string,
	musicFolder: string = "",
	depth: number = 1
): string | null {
	const normFile = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
	const normBase = musicFolder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

	let subPath = normFile;
	if (normBase.length > 0) {
		if (!normFile.startsWith(normBase)) {
			// Outside configured musicFolder
			return null;
		}
		// Strip base folder prefix
		subPath = normFile.slice(normBase.length).replace(/^\/+/, "");
	}

	const parts = subPath.split("/").filter(Boolean);
	if (parts.length <= 1) {
		// File is in the root of the music folder (no subfolder)
		return null;
	}

	// Remove filename (last segment)
	parts.pop();

	// Truncate to depth
	const targetDepth = Math.max(1, depth);
	const targetParts = parts.slice(0, targetDepth);

	return targetParts.join("/");
}

/**
 * Scans vault audio files and dynamically groups them into folder playlists.
 */
export function generateFolderPlaylists(
	files: TFile[],
	musicFolder: string = "",
	depth: number = 1
): FolderPlaylistResult[] {
	const folderMap = new Map<string, TFile[]>();

	for (const file of files) {
		const relDir = getRelativeDirectoryPath(file.path, musicFolder, depth);
		if (!relDir) continue;

		if (!folderMap.has(relDir)) {
			folderMap.set(relDir, []);
		}
		folderMap.get(relDir)!.push(file);
	}

	const results: FolderPlaylistResult[] = [];
	for (const [folderPath, folderFiles] of folderMap.entries()) {
		// Format playlist name with folder emoji
		const folderName = folderPath.split("/").pop() || folderPath;
		results.push({
			name: `📁 ${folderName}`,
			folderPath,
			files: folderFiles,
		});
	}

	return results.sort((a, b) => a.name.localeCompare(b.name, "en"));
}
