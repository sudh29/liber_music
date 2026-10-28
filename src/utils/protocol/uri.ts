/**
 * Obsidian URI protocol and deep-linking utilities for Liber Music Player
 * 
 * Supports generating and parsing obsidian://music-player URIs:
 * - obsidian://music-player?track=Music%2FSong.mp3
 * - obsidian://music-player?track=Music%2FSong.mp3&t=142
 * - obsidian://music-player?track=Music%2FSong.mp3&t=02:22&autoplay=true
 */

/**
 * Formats seconds into MM:SS or HH:MM:SS string.
 * 
 * @param seconds - Duration or timestamp in seconds
 * @returns Formatted time string
 */
export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return "00:00";
	}
	const totalSec = Math.floor(seconds);
	const hrs = Math.floor(totalSec / 3600);
	const mins = Math.floor((totalSec % 3600) / 60);
	const secs = totalSec % 60;

	const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

	if (hrs > 0) {
		return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
	}
	return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Parses time string (e.g. "142", "02:22", "01:23:45") or number into seconds.
 * 
 * @param timeInput - Time string or number
 * @returns Seconds as a number (or 0 if invalid)
 */
export function parseTimeString(timeInput: string | number | undefined | null): number {
	if (timeInput === undefined || timeInput === null) {
		return 0;
	}
	if (typeof timeInput === "number") {
		return Number.isFinite(timeInput) && timeInput >= 0 ? timeInput : 0;
	}

	const str = String(timeInput).trim();
	if (!str) {
		return 0;
	}

	// Plain number
	if (!str.includes(":")) {
		const num = parseFloat(str);
		return Number.isFinite(num) && num >= 0 ? num : 0;
	}

	// Colon-separated parts (MM:SS or HH:MM:SS)
	const parts = str.split(":").map((p) => parseFloat(p.trim()));
	if (parts.some((n) => !Number.isFinite(n) || n < 0)) {
		return 0;
	}

	if (parts.length === 2) {
		const mins = parts[0] ?? 0;
		const secs = parts[1] ?? 0;
		return mins * 60 + secs;
	}

	if (parts.length === 3) {
		const hrs = parts[0] ?? 0;
		const mins = parts[1] ?? 0;
		const secs = parts[2] ?? 0;
		return hrs * 3600 + mins * 60 + secs;
	}

	return 0;
}

/**
 * Generates an obsidian://music-player deep link URI.
 * 
 * @param trackPath - Relative or vault path of the audio file
 * @param timeSec - Optional timestamp in seconds to seek to
 * @param autoplay - Whether to autoplay upon opening (default: true)
 * @returns obsidian:// URI string
 */
export function generateObsidianTrackUri(
	trackPath: string,
	timeSec?: number,
	autoplay: boolean = true
): string {
	const cleanPath = trackPath.trim().replace(/^\[\[(.*)\]\]$/, "$1");
	const encodedPath = encodeURIComponent(cleanPath);
	let uri = `obsidian://music-player?track=${encodedPath}`;

	if (timeSec !== undefined && Number.isFinite(timeSec) && timeSec > 0) {
		uri += `&t=${Math.round(timeSec)}`;
	}

	if (!autoplay) {
		uri += `&autoplay=false`;
	}

	return uri;
}

/**
 * Generates a markdown link citing a timestamped lyric or audio track.
 * 
 * @param trackPath - Audio file path
 * @param timeSec - Timestamp in seconds
 * @param lyricText - Optional lyric text to include in citation
 * @param fallbackTitle - Optional title if lyric text is empty
 * @returns Markdown formatted link: [MM:SS — "Lyric"](obsidian://music-player?...)
 */
export function generateLyricMarkdownLink(
	trackPath: string,
	timeSec: number,
	lyricText?: string,
	fallbackTitle?: string
): string {
	const uri = generateObsidianTrackUri(trackPath, timeSec);
	const timeFormatted = formatTime(timeSec);

	const cleanLyric = (lyricText || "").trim();
	const label = cleanLyric
		? `${timeFormatted} — "${cleanLyric}"`
		: fallbackTitle
			? `${fallbackTitle} (${timeFormatted})`
			: `${timeFormatted}`;

	return `[${label}](${uri})`;
}

/**
 * Protocol data payload interface
 */
export interface MusicProtocolPayload {
	/** Track file path or filename */
	track?: string;
	/** Timestamp to seek to in seconds */
	time?: number;
	/** Whether to start playing immediately */
	autoplay: boolean;
}

/**
 * Parses protocol query parameters from obsidian://music-player actions.
 * 
 * @param params - Query parameters from ObsidianProtocolHandler
 * @returns Parsed protocol action payload
 */
export function parseObsidianMusicProtocol(params: Record<string, string>): MusicProtocolPayload {
	const rawTrack = params.track || params.file || params.path || "";
	let track: string | undefined = undefined;

	if (rawTrack.trim()) {
		try {
			track = decodeURIComponent(rawTrack.trim());
		} catch {
			track = rawTrack.trim();
		}
	}

	const rawTime = params.t ?? params.time ?? params.start;
	const time = rawTime !== undefined ? parseTimeString(rawTime) : undefined;

	const rawAutoplay = params.autoplay ?? params.play;
	const autoplay = rawAutoplay !== "false" && rawAutoplay !== "0";

	return {
		track,
		time,
		autoplay,
	};
}
