/**
 * Audiophile 10-Band Graphic & Parametric Equalizer Definitions
 * 
 * Provides ISO standard octave frequencies, filter specifications,
 * acoustic profile presets, and gain conversion algorithms.
 */

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const EQ_BAND_COUNT = 10;
export const EQ_MIN_GAIN_DB = -12;
export const EQ_MAX_GAIN_DB = 12;
export const EQ_DEFAULT_Q = 1.41; // 1-octave bandwidth filter Q

export type BiquadFilterTypeName = 'lowshelf' | 'peaking' | 'highshelf';

export interface EqBandConfig {
	frequency: number;
	type: BiquadFilterTypeName;
	q: number;
}

export const EQ_BAND_CONFIGS: readonly EqBandConfig[] = [
	{ frequency: 31, type: 'lowshelf', q: 1.0 },
	{ frequency: 62, type: 'peaking', q: EQ_DEFAULT_Q },
	{ frequency: 125, type: 'peaking', q: EQ_DEFAULT_Q },
	{ frequency: 250, type: 'peaking', q: EQ_DEFAULT_Q },
	{ frequency: 500, type: 'peaking', q: EQ_DEFAULT_Q },
	{ frequency: 1000, type: 'peaking', q: EQ_DEFAULT_Q },
	{ frequency: 2000, type: 'peaking', q: EQ_DEFAULT_Q },
	{ frequency: 4000, type: 'peaking', q: EQ_DEFAULT_Q },
	{ frequency: 8000, type: 'peaking', q: EQ_DEFAULT_Q },
	{ frequency: 16000, type: 'highshelf', q: 1.0 },
] as const;

/**
 * Curated acoustic presets
 */
export const EQ_PRESETS: Record<string, number[]> = {
	'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	'Bass Boost': [5, 4, 3, 1.5, 0, 0, 0, 0, 0, 0],
	'Vocal Clarity': [-2, -1, 0, 2, 4, 3, 2, 0, -1, -2],
	'Acoustic': [3, 2, 0, 0, 1, 2, 3, 2, 1, 0],
	'Rock & Metal': [4, 3, 1, -1, -2, 1, 3, 4, 3, 2],
	'Harman Target Curve': [5.5, 4.5, 3.0, 1.0, 0.5, 1.0, 3.0, 4.0, 2.0, 0],
	'Electronic': [4.5, 3.5, 1.0, 0, -1.0, 1.5, 2.5, 3.0, 3.5, 4.0],
};

/**
 * Clamps gain value within allowed dB bounds
 */
export function clampEqGain(gain: number, min = EQ_MIN_GAIN_DB, max = EQ_MAX_GAIN_DB): number {
	if (Number.isNaN(gain)) return 0;
	return Math.max(min, Math.min(max, Math.round(gain * 10) / 10));
}

/**
 * Converts dB gain to linear multiplier
 */
export function dbToGain(db: number): number {
	if (!Number.isFinite(db)) return 1.0;
	return Math.pow(10, db / 20);
}

/**
 * Converts linear gain multiplier to dB
 */
export function gainToDb(gain: number): number {
	if (!Number.isFinite(gain) || gain <= 0) return -Infinity;
	return 20 * Math.log10(gain);
}

/**
 * Formats a frequency number into a clean human label (e.g. 31Hz, 1kHz, 16kHz)
 */
export function formatEqFrequency(hz: number): string {
	if (hz >= 1000) {
		const khz = hz / 1000;
		return Number.isInteger(khz) ? `${khz}kHz` : `${khz.toFixed(1)}kHz`;
	}
	return `${hz}Hz`;
}

/**
 * Validates and normalizes a 10-band array, ensuring all values are finite and clamped
 */
export function normalizeEqBands(bands?: number[]): number[] {
	const defaultBands = EQ_PRESETS['Flat'] ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	if (!Array.isArray(bands) || bands.length !== EQ_BAND_COUNT) {
		return [...defaultBands];
	}
	return bands.map((g) => clampEqGain(g));
}
