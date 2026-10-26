/**
 * Scans vault audio files independently of the main plugin class.
 * Reusable by LibraryService, settings tab, and background workers.
 *
 * Traverses folder trees iteratively to avoid vault.getFiles() full vault scans.
 */

import type { App } from "obsidian";
import { TFile, TFolder } from "obsidian";
import { isSupportedAudioExtension } from "@/constants";

function collectAudioFilesInFolder(folder: TFolder): TFile[] {
	const results: TFile[] = [];
	const stack: TFolder[] = [folder];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) continue;

		for (const child of current.children) {
			if (child instanceof TFolder) {
				stack.push(child);
			} else if (child instanceof TFile) {
				const ext = child.extension?.toLowerCase() ?? "";
				if (isSupportedAudioExtension(ext)) {
					results.push(child);
				}
			}
		}
	}

	return results;
}

function getScanRootFolder(app: App, musicFolder: string): TFolder | null {
	const normalized = musicFolder.replace(/\/$/, "");
	if (normalized) {
		const folder = app.vault.getFolderByPath(normalized);
		return folder ?? null;
	}
	return app.vault.getRoot();
}

/**
 * Returns an unsorted list of supported audio files filtered by the configured music folder.
 */
export function scanVaultAudioFiles(app: App, musicFolder: string): TFile[] {
	const root = getScanRootFolder(app, musicFolder);
	if (!root) {
		return [];
	}
	return collectAudioFilesInFolder(root);
}
