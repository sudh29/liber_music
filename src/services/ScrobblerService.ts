/**
 * Daily Notes Scrobbler & Listening History Service
 * 
 * Records finished or 70%+ completed track playback into:
 * 1. Today's Daily Note under a configured heading (e.g. "## 🎧 Music Log")
 * 2. An offline JSON audit log at .obsidian/plugins/liber-music-player-plugin/history.json
 */

import { App, normalizePath, TFile } from "obsidian";
import type MusicPlayerPlugin from "@/main";
import type { TrackInfo } from "@/types";
import { formatTime, generateObsidianTrackUri } from "@/utils/protocol/uri";

/**
 * Single listening session record in JSON history
 */
export interface HistoryRecord {
	timestamp: string;
	trackPath: string;
	title: string;
	artist: string;
	album: string;
	duration: number;
}

/**
 * Appends a log entry under a specified markdown heading in note content.
 * 
 * If heading exists, inserts the bullet point within that section.
 * If heading does not exist, appends the heading and bullet point at the end of content.
 * 
 * @param content - Existing markdown note content
 * @param heading - Markdown heading (e.g. "## 🎧 Music Log")
 * @param entry - Bullet point string to append
 * @returns Updated markdown note content
 */
export function appendEntryToDailyNote(content: string, heading: string, entry: string): string {
	const trimmedContent = content.trimEnd();
	const cleanHeading = heading.trim();
	const bullet = entry.trim();

	if (!trimmedContent) {
		return `${cleanHeading}\n${bullet}\n`;
	}

	const headingIndex = trimmedContent.indexOf(cleanHeading);
	if (headingIndex === -1) {
		// Heading not present: append at end with spacing
		return `${trimmedContent}\n\n${cleanHeading}\n${bullet}\n`;
	}

	// Heading exists: find where the section ends (next heading of equal or higher level, or end of file)
	const afterHeadingIndex = headingIndex + cleanHeading.length;
	const rest = trimmedContent.slice(afterHeadingIndex);

	// Match next heading of #, ##, or ###
	const headingMatch = cleanHeading.match(/^(#+)/);
	const headingLevel = headingMatch?.[1] ? headingMatch[1].length : 2;
	const nextHeadingRegex = new RegExp(`(^|\\n)(#{1,${headingLevel}})\\s+`, "m");

	const nextHeadingMatch = rest.match(nextHeadingRegex);
	if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
		const insertPos = afterHeadingIndex + nextHeadingMatch.index;
		const sectionBody = trimmedContent.slice(afterHeadingIndex, insertPos).trimEnd();
		const beforeSection = trimmedContent.slice(0, afterHeadingIndex);
		const afterSection = trimmedContent.slice(insertPos);

		const updatedBody = sectionBody ? `${sectionBody}\n${bullet}` : `\n${bullet}`;
		return `${beforeSection}${updatedBody}\n${afterSection.trimStart() ? afterSection : ""}\n`;
	}

	// No subsequent heading: append to bottom of file
	return `${trimmedContent}\n${bullet}\n`;
}

/**
 * Daily Notes Scrobbler service class
 */
export class ScrobblerService {
	private lastScrobbledKey: string | null = null;
	private lastScrobbledAt: number = 0;

	constructor(
		private app: App,
		private plugin: MusicPlayerPlugin
	) {}

	/**
	 * Resolves today's daily note path based on Obsidian configuration.
	 * 
	 * @returns Vault path for today's daily note
	 */
	getDailyNotePath(): string {
		const now = new Date();
		const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
		const defaultDateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

		const appAny = this.app as unknown as {
			internalPlugins?: {
				getPluginById: (id: string) => {
					instance?: {
						options?: {
							folder?: string;
							format?: string;
						};
					};
				} | null;
			};
		};

		const dailyNotesPlugin = appAny.internalPlugins?.getPluginById("daily-notes");
		const folder = dailyNotesPlugin?.instance?.options?.folder?.trim() || "";
		
		const filename = `${defaultDateStr}.md`;
		return normalizePath(folder ? `${folder}/${filename}` : filename);
	}

	/**
	 * Records a track play to Daily Notes and offline history.json.
	 * 
	 * @param track - Audio file TFile
	 * @param trackInfo - Optional parsed track metadata
	 * @param currentTime - Optional current play duration in seconds
	 * @param duration - Optional total track duration in seconds
	 * @returns True if scrobbled, false if skipped (disabled, duplicate, or failed)
	 */
	async scrobbleTrack(
		track: TFile,
		trackInfo?: TrackInfo,
		currentTime?: number,
		duration?: number
	): Promise<boolean> {
		if (!track) {
			return false;
		}

		// Prevent duplicate scrobbles for the same track within 60 seconds
		const now = Date.now();
		const sessionKey = `${track.path}`;
		if (this.lastScrobbledKey === sessionKey && now - this.lastScrobbledAt < 60000) {
			return false;
		}

		this.lastScrobbledKey = sessionKey;
		this.lastScrobbledAt = now;

		// 1. Record to offline JSON history log
		await this.recordToJsonHistory(track, trackInfo, duration);

		// 2. Record to Daily Notes if enabled
		if (this.plugin.settings?.dailyNotesScrobbler) {
			await this.recordToDailyNote(track, trackInfo);
		}

		return true;
	}

	/**
	 * Appends track record to today's daily note.
	 */
	private async recordToDailyNote(track: TFile, trackInfo?: TrackInfo): Promise<void> {
		try {
			const notePath = this.getDailyNotePath();
			const heading = this.plugin.settings?.dailyNotesHeading || "## 🎧 Music Log";

			const now = new Date();
			const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
			const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

			const title = (trackInfo?.title || track.basename).trim();
			const artist = (trackInfo?.artist || "Unknown Artist").trim();
			const playUri = generateObsidianTrackUri(track.path);
			const logEntry = `- ${timeStr} — **${title}** by *${artist}* ([play](${playUri}))`;

			const abstractFile = this.app.vault.getAbstractFileByPath(notePath);
			if (abstractFile instanceof TFile) {
				if (typeof this.app.vault.process === "function") {
					await this.app.vault.process(abstractFile, (content: string) => {
						return appendEntryToDailyNote(content, heading, logEntry);
					});
				} else {
					const content = await this.app.vault.read(abstractFile);
					const updatedContent = appendEntryToDailyNote(content, heading, logEntry);
					await this.app.vault.modify(abstractFile, updatedContent);
				}
			} else {
				// Note doesn't exist yet: create it with folder hierarchy if needed
				const folderIndex = notePath.lastIndexOf("/");
				if (folderIndex !== -1) {
					const folderPath = notePath.slice(0, folderIndex);
					if (!this.app.vault.getAbstractFileByPath(folderPath)) {
						try {
							await this.app.vault.createFolder(folderPath);
						} catch {
							// Folder may already exist or cannot be created
						}
					}
				}
				const initialContent = `${heading}\n${logEntry}\n`;
				await this.app.vault.create(notePath, initialContent);
			}
		} catch (error) {
			console.warn("Failed to record track to Daily Notes:", error);
		}
	}

	/**
	 * Appends track record to local history.json file.
	 */
	private async recordToJsonHistory(
		track: TFile,
		trackInfo?: TrackInfo,
		duration?: number
	): Promise<void> {
		try {
			const historyPath = normalizePath(`${this.plugin.manifest.dir || ".obsidian/plugins/liber-music-player-plugin"}/history.json`);
			const record: HistoryRecord = {
				timestamp: new Date().toISOString(),
				trackPath: track.path,
				title: trackInfo?.title || track.basename,
				artist: trackInfo?.artist || "Unknown Artist",
				album: trackInfo?.album || "Unknown Album",
				duration: duration || trackInfo?.duration || 0,
			};

			let records: HistoryRecord[] = [];
			const exists = await this.app.vault.adapter.exists(historyPath);
			if (exists) {
				try {
					const raw = await this.app.vault.adapter.read(historyPath);
					records = JSON.parse(raw);
					if (!Array.isArray(records)) {
						records = [];
					}
				} catch {
					records = [];
				}
			}

			// Prepend new record and cap to 1,000 entries
			records.unshift(record);
			if (records.length > 1000) {
				records = records.slice(0, 1000);
			}

			await this.app.vault.adapter.write(historyPath, JSON.stringify(records, null, 2));
		} catch (error) {
			console.warn("Failed to record track to history.json:", error);
		}
	}
}
