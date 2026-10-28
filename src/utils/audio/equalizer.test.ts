import { describe, expect, it } from "vitest";
import {
	clampEqGain,
	dbToGain,
	formatEqFrequency,
	gainToDb,
	normalizeEqBands,
	EQ_BAND_CONFIGS,
	EQ_BAND_COUNT,
	EQ_FREQUENCIES,
	EQ_PRESETS,
} from "./equalizer";

describe("equalizer utils", () => {
	it("should define 10 standard ISO octave frequencies", () => {
		expect(EQ_FREQUENCIES.length).toBe(10);
		expect(EQ_FREQUENCIES).toEqual([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
		expect(EQ_BAND_COUNT).toBe(10);
	});

	it("should configure filter types correctly across bands", () => {
		expect(EQ_BAND_CONFIGS[0]?.type).toBe("lowshelf");
		expect(EQ_BAND_CONFIGS[1]?.type).toBe("peaking");
		expect(EQ_BAND_CONFIGS[8]?.type).toBe("peaking");
		expect(EQ_BAND_CONFIGS[9]?.type).toBe("highshelf");
	});

	it("should clamp gain values within dB bounds", () => {
		expect(clampEqGain(-20)).toBe(-12);
		expect(clampEqGain(25)).toBe(12);
		expect(clampEqGain(4.55)).toBe(4.6);
		expect(clampEqGain(NaN)).toBe(0);
		expect(clampEqGain(-Infinity)).toBe(-12);
	});

	it("should convert dB to linear multiplier and back", () => {
		expect(dbToGain(0)).toBe(1.0);
		expect(dbToGain(6)).toBeCloseTo(1.995, 2);
		expect(dbToGain(-6)).toBeCloseTo(0.501, 2);
		expect(dbToGain(NaN)).toBe(1.0);

		expect(gainToDb(1.0)).toBe(0);
		expect(gainToDb(2.0)).toBeCloseTo(6.02, 1);
		expect(gainToDb(0)).toBe(-Infinity);
		expect(gainToDb(-5)).toBe(-Infinity);
	});

	it("should format frequency labels clearly", () => {
		expect(formatEqFrequency(31)).toBe("31Hz");
		expect(formatEqFrequency(500)).toBe("500Hz");
		expect(formatEqFrequency(1000)).toBe("1kHz");
		expect(formatEqFrequency(2500)).toBe("2.5kHz");
		expect(formatEqFrequency(16000)).toBe("16kHz");
	});

	it("should normalize eq bands array safely", () => {
		expect(normalizeEqBands(undefined)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(normalizeEqBands([1, 2])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(normalizeEqBands([0, -15, 20, 3, 0, 0, 0, 0, 0, 0])).toEqual([
			0, -12, 12, 3, 0, 0, 0, 0, 0, 0,
		]);
	});

	it("should contain all specified acoustic presets", () => {
		expect(EQ_PRESETS["Flat"]).toBeDefined();
		expect(EQ_PRESETS["Bass Boost"]).toBeDefined();
		expect(EQ_PRESETS["Vocal Clarity"]).toBeDefined();
		expect(EQ_PRESETS["Acoustic"]).toBeDefined();
		expect(EQ_PRESETS["Rock & Metal"]).toBeDefined();
		expect(EQ_PRESETS["Harman Target Curve"]).toBeDefined();
		expect(EQ_PRESETS["Electronic"]).toBeDefined();

		for (const presetName of Object.keys(EQ_PRESETS)) {
			expect(EQ_PRESETS[presetName]?.length).toBe(10);
		}
	});
});
