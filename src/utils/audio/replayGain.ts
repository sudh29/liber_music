/**
 * ReplayGain volume gain parsing and compensation calculation module.
 * 
 * Conforms to EBU R128 / ReplayGain standards:
 * - Parses ID3 (TXXX:REPLAYGAIN_TRACK_GAIN) and Vorbis (REPLAYGAIN_TRACK_GAIN) tags
 * - Calculates linear volume multiplier: 10 ^ (gainDb / 20)
 * - Combines base volume to calculate compensated actual player volume (clamped to [0.0, 1.0])
 */

/**
 * Parses ReplayGain gain values (dB) in various formats.
 * 
 * Supported formats:
 * - Numeric: -6.2
 * - String: "-6.2 dB", "+1.50 dB", "-4.5dB"
 * - Object: containing ratio or gain property
 * 
 * @param gain Raw gain tag value
 * @returns Parsed dB numeric value, or undefined if unparseable
 */
export function parseReplayGain(gain: unknown): number | undefined {
	if (typeof gain === "number" && Number.isFinite(gain)) {
		return gain;
	}

	if (typeof gain === "string") {
		const trimmed = gain.trim();
		const match = /^([+-]?\d+(?:\.\d+)?)\s*(?:db)?$/i.exec(trimmed);
		if (match && match[1]) {
			const parsed = Number.parseFloat(match[1]);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
	}

	if (gain && typeof gain === "object") {
		const maybeRatio = (gain as { ratio?: unknown }).ratio;
		if (typeof maybeRatio === "number" && Number.isFinite(maybeRatio) && maybeRatio > 0) {
			// Convert ratio to dB: 20 * log10(ratio)
			return 20 * Math.log10(maybeRatio);
		}
	}

	return undefined;
}

/**
 * Calculates linear volume multiplier based on dB gain value.
 * 
 * Formula: multiplier = 10 ^ (gainDb / 20)
 * Examples:
 * - 0 dB -> 1.0
 * - -6.02 dB -> ~0.5
 * - +6.02 dB -> ~2.0
 * 
 * @param gainDb Track gain (dB)
 * @returns Linear multiplier
 */
export function calculateReplayGainMultiplier(gainDb: number | undefined): number {
	if (gainDb === undefined || !Number.isFinite(gainDb)) {
		return 1.0;
	}
	return Math.pow(10, gainDb / 20);
}

/**
 * Combines user-set volume with ReplayGain gain to calculate final volume applied to HTMLAudioElement.
 * 
 * @param baseVolume User base volume (0.0 - 1.0)
 * @param gainDb Track gain (dB)
 * @returns Final volume clamped to [0.0, 1.0]
 */
export function applyReplayGainToVolume(
	baseVolume: number,
	gainDb: number | undefined
): number {
	const validBase = Number.isFinite(baseVolume) ? Math.min(Math.max(baseVolume, 0), 1) : 1.0;
	const multiplier = calculateReplayGainMultiplier(gainDb);
	const adjusted = validBase * multiplier;
	return Math.min(Math.max(adjusted, 0.0), 1.0);
}
