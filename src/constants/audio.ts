/**
 * Audio constant definitions
 */

/** Supported audio file extensions */
export const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'] as const;

/**
 * Determines whether an extension is a supported audio format (case-insensitive).
 * @param ext Extension with or without leading dot (e.g. `mp3`, `.mp3`)
 */
export function isSupportedAudioExtension(ext: unknown): boolean {
	const raw = typeof ext === "string" ? ext : "";
	const lower = raw.toLowerCase();
	const normalized: string = lower.startsWith(".") ? lower : `.${lower}`;
	return (SUPPORTED_AUDIO_FORMATS as readonly string[]).includes(normalized);
}

/** Default volume level (0.0 - 1.0) */
export const DEFAULT_VOLUME = 1.0;

/** Default playback rate (1.0 is normal speed) */
export const DEFAULT_PLAYBACK_RATE = 1.0;

/** Supported image extensions for album cover detection */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'] as const;
