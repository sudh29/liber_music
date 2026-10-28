/**
 * Markdown codeblock configuration parser for Liber Music Player
 * 
 * Parses ```music codeblock blocks:
 * 
 * ```music
 * track: "Music/Classical/Chopin - Nocturne Op. 9.mp3"
 * start: "01:23"
 * end: "03:45"
 * showLyrics: true
 * compact: true
 * autoplay: false
 * title: "Custom Title"
 * artist: "Custom Artist"
 * ```
 */

import { parseTimeString } from "@/utils/protocol/uri";

/**
 * Parsed configuration object for an embedded music codeblock
 */
export interface MusicCodeblockConfig {
	/** Audio file path or filename */
	track: string;
	/** Start offset in seconds */
	start: number;
	/** Optional end offset in seconds */
	end?: number;
	/** Whether to display scrollable/synced lyrics */
	showLyrics: boolean;
	/** Whether to render in ultra-compact single-line mode */
	compact: boolean;
	/** Whether to start playback automatically on note load */
	autoplay: boolean;
	/** Optional custom title override */
	title?: string;
	/** Optional custom artist override */
	artist?: string;
}

/**
 * Parses a YAML or key-value music codeblock string into a structured configuration.
 * 
 * @param source - Raw codeblock text
 * @returns Structured MusicCodeblockConfig
 */
export function parseMusicCodeblock(source: string): MusicCodeblockConfig {
	const config: MusicCodeblockConfig = {
		track: "",
		start: 0,
		showLyrics: false,
		compact: false,
		autoplay: false,
	};

	if (!source || !source.trim()) {
		return config;
	}

	const lines = source.split("\n");
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}

		// Match "key: value" or "key: 'value'" or 'key: "value"'
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) {
			// If a line is just a track path without "track:" prefix
			if (!config.track && (line.includes(".mp3") || line.includes(".flac") || line.includes(".ogg") || line.includes(".wav") || line.includes(".m4a"))) {
				config.track = stripQuotes(line);
			}
			continue;
		}

		const key = line.slice(0, colonIndex).trim().toLowerCase();
		const rawValue = line.slice(colonIndex + 1).trim();
		const val = stripQuotes(rawValue);

		switch (key) {
			case "track":
			case "file":
			case "path":
			case "song":
				config.track = val.replace(/^\[\[(.*)\]\]$/, "$1"); // Strip Obsidian [[wikilink]] syntax
				break;
			case "start":
			case "from":
			case "t":
				config.start = parseTimeString(val);
				break;
			case "end":
			case "to":
				config.end = parseTimeString(val);
				break;
			case "showlyrics":
			case "lyrics":
				config.showLyrics = val.toLowerCase() === "true" || val === "1" || val.toLowerCase() === "yes";
				break;
			case "compact":
			case "mini":
			case "inline":
				config.compact = val.toLowerCase() === "true" || val === "1" || val.toLowerCase() === "yes";
				break;
			case "autoplay":
			case "play":
				config.autoplay = val.toLowerCase() === "true" || val === "1" || val.toLowerCase() === "yes";
				break;
			case "title":
				config.title = val;
				break;
			case "artist":
				config.artist = val;
				break;
		}
	}

	return config;
}

/**
 * Removes surrounding single or double quotes from a string.
 */
function stripQuotes(str: string): string {
	const trimmed = str.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}
