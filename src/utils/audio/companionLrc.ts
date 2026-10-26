/**
 * Companion .lrc lyric file resolution module in the same directory.
 * 
 * When audio file embedded metadata tags lack lyrics, automatically search for a matching `.lrc` file:
 * e.g., `Music/Artist/Song.flac` -> `Music/Artist/Song.lrc`
 */

import { App, TFile } from "obsidian";

/**
 * Computes the companion .lrc file path from the audio file path.
 * 
 * @param audioPath Relative path of the audio file in the vault
 * @returns Companion .lrc file path
 * 
 * @example
 * getCompanionLrcPath("Music/Song.mp3") === "Music/Song.lrc"
 */
export function getCompanionLrcPath(audioPath: string): string {
	if (!audioPath) return "";
	return audioPath.replace(/\.[^/.]+$/, ".lrc");
}

/**
 * Checks and retrieves the companion .lrc file matching the audio file.
 * 
 * @param app Obsidian App instance
 * @param audioFile Audio file object or path
 * @returns TFile if matching companion .lrc exists, null otherwise
 */
export function getCompanionLrcFile(
	app: App,
	audioFile: TFile | string
): TFile | null {
	const audioPath = typeof audioFile === "string" ? audioFile : audioFile.path;
	const lrcPath = getCompanionLrcPath(audioPath);
	if (!lrcPath || lrcPath === audioPath) return null;

	const target = app.vault.getAbstractFileByPath(lrcPath);
	if (target instanceof TFile && target.extension?.toLowerCase() === "lrc") {
		return target;
	}
	return null;
}

/**
 * Attempts to read lyric text from a companion .lrc file in the same directory.
 * 
 * @param app Obsidian App instance
 * @param audioFile Audio file object or path
 * @returns Lyric text content, or null if non-existent or read failed
 */
export async function readCompanionLrc(
	app: App,
	audioFile: TFile | string
): Promise<string | null> {
	try {
		const lrcFile = getCompanionLrcFile(app, audioFile);
		if (!lrcFile) return null;

		const content = await app.vault.read(lrcFile);
		return content && content.trim().length > 0 ? content : null;
	} catch (error) {
		console.warn("Failed to read companion .lrc lyric file:", error);
		return null;
	}
}
