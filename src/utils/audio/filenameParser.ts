/**
 * Audio track filename parser utility
 * 
 * Extracts metadata (title, artist, album, year, track number) from track filenames
 * when embedded ID3 metadata tags are missing or not yet indexed.
 * 
 * Supports common naming conventions:
 * - `YYYY - Artist - Album - Title` (e.g. `1997 - Celine Dion - Titanic - My Heart Will Go On.mp3`)
 * - `YYYY - Artist - Title` (e.g. `1985 - Bryan Adams - Summer Of 69.mp3`)
 * - `Track - Artist - Title` (e.g. `01 - Queen - Bohemian Rhapsody.mp3`)
 * - `Artist - Title` (e.g. `Coldplay - Yellow.mp3`)
 * - `Track - Title` or `Track. Title` (e.g. `01 - Intro.mp3`, `01. Intro.mp3`)
 * - Simple title fallback (e.g. `Summer Of 69.mp3`)
 */

export interface ParsedTrackFilename {
	title: string;
	artist?: string;
	album?: string;
	year?: number;
	trackNumber?: number;
}

/**
 * Strips file extension and path from filename.
 */
function cleanFilename(rawName: string): string {
	if (!rawName) return "";
	// Strip path if provided
	const basename = rawName.split("/").pop()?.split("\\").pop() || rawName;
	// Strip extension
	return basename.replace(/\.[^/.]+$/, "").trim();
}

/**
 * Parses track metadata from a filename or basename.
 * 
 * @param rawFilename - Filename, basename, or path
 * @returns Parsed metadata components
 */
export function parseTrackFilename(rawFilename: string): ParsedTrackFilename {
	const cleaned = cleanFilename(rawFilename);
	if (!cleaned) {
		return { title: "" };
	}

	// 1. Check for leading track number with dot: e.g. "01. Title" or "01. Artist - Title"
	const dotTrackMatch = cleaned.match(/^(\d{1,3})\.\s+(.+)$/);
	if (dotTrackMatch) {
		const trackNumber = parseInt(dotTrackMatch[1] ?? "", 10);
		const remainder = dotTrackMatch[2] ?? "";
		const subParsed = parseTrackFilename(remainder);
		return {
			...subParsed,
			trackNumber: !isNaN(trackNumber) ? trackNumber : undefined,
		};
	}

	// 2. Split by dash separators (handles standard '-', en-dash '–', em-dash '—')
	const parts = cleaned
		.split(/\s+[-–—]\s+/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

	if (parts.length === 1) {
		// Single part: Just title
		return { title: parts[0] ?? cleaned };
	}

	const firstPart = parts[0] ?? "";
	const isFourDigitYear = /^\d{4}$/.test(firstPart);
	const isTrackNumber = /^\d{1,3}$/.test(firstPart);

	if (isFourDigitYear) {
		const year = parseInt(firstPart, 10);
		if (parts.length === 2) {
			// YYYY - Title
			return {
				year,
				title: parts[1] ?? "",
			};
		}
		if (parts.length === 3) {
			// YYYY - Artist - Title
			return {
				year,
				artist: parts[1],
				title: parts[2] ?? "",
			};
		}
		if (parts.length >= 4) {
			// YYYY - Artist - Album - Title (or more sub-parts joined into title)
			return {
				year,
				artist: parts[1],
				album: parts[2],
				title: parts.slice(3).join(" - "),
			};
		}
	}

	if (isTrackNumber) {
		const trackNumber = parseInt(firstPart, 10);
		if (parts.length === 2) {
			// 01 - Title
			return {
				trackNumber,
				title: parts[1] ?? "",
			};
		}
		if (parts.length >= 3) {
			// 01 - Artist - Title
			return {
				trackNumber,
				artist: parts[1],
				title: parts.slice(2).join(" - "),
			};
		}
	}

	// General: Artist - Title (or Artist - Album - Title)
	if (parts.length === 2) {
		return {
			artist: parts[0],
			title: parts[1] ?? "",
		};
	}

	if (parts.length === 3) {
		return {
			artist: parts[0],
			album: parts[1],
			title: parts[2] ?? "",
		};
	}

	// 4+ parts without leading year: Artist - Album - Subtitle - Title
	return {
		artist: parts[0],
		album: parts[1],
		title: parts.slice(2).join(" - "),
	};
}
