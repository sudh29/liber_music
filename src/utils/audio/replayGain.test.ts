import { describe, expect, it } from "vite-plus/test";
import {
	applyReplayGainToVolume,
	calculateReplayGainMultiplier,
	parseReplayGain,
} from "./replayGain";

describe("replayGain utility", () => {
	describe("parseReplayGain", () => {
		it("should parse numeric gain values directly", () => {
			expect(parseReplayGain(-4.5)).toBe(-4.5);
			expect(parseReplayGain(0)).toBe(0);
			expect(parseReplayGain(2.1)).toBe(2.1);
		});

		it("should parse string values with dB suffix and optional signs", () => {
			expect(parseReplayGain("-6.50 dB")).toBe(-6.5);
			expect(parseReplayGain("+1.2 dB")).toBe(1.2);
			expect(parseReplayGain("-3.4dB")).toBe(-3.4);
			expect(parseReplayGain("0.0 dB")).toBe(0);
		});

		it("should parse ratio objects", () => {
			// ratio = 1.0 -> 0 dB
			expect(parseReplayGain({ ratio: 1.0 })).toBeCloseTo(0);
			// ratio = 0.5 -> -6.02 dB
			expect(parseReplayGain({ ratio: 0.5 })).toBeCloseTo(-6.02, 1);
		});

		it("should return undefined for invalid or missing inputs", () => {
			expect(parseReplayGain(undefined)).toBeUndefined();
			expect(parseReplayGain(null)).toBeUndefined();
			expect(parseReplayGain("invalid")).toBeUndefined();
			expect(parseReplayGain({})).toBeUndefined();
		});
	});

	describe("calculateReplayGainMultiplier", () => {
		it("should return 1.0 for undefined or 0 dB", () => {
			expect(calculateReplayGainMultiplier(undefined)).toBe(1.0);
			expect(calculateReplayGainMultiplier(0)).toBe(1.0);
		});

		it("should calculate correct exponential multiplier for dB values", () => {
			// -6 dB -> ~0.501
			expect(calculateReplayGainMultiplier(-6)).toBeCloseTo(0.501, 2);
			// -20 dB -> 0.1
			expect(calculateReplayGainMultiplier(-20)).toBeCloseTo(0.1, 2);
			// +6 dB -> ~1.995
			expect(calculateReplayGainMultiplier(6)).toBeCloseTo(1.995, 2);
		});
	});

	describe("applyReplayGainToVolume", () => {
		it("should adjust base volume with gain multiplier clamped to [0.0, 1.0]", () => {
			// 1.0 volume with -6 dB -> ~0.5
			expect(applyReplayGainToVolume(1.0, -6)).toBeCloseTo(0.501, 2);

			// 0.5 volume with 0 dB -> 0.5
			expect(applyReplayGainToVolume(0.5, 0)).toBe(0.5);

			// 1.0 volume with +6 dB -> clamped to 1.0
			expect(applyReplayGainToVolume(1.0, 6)).toBe(1.0);

			// 0.2 volume with +6 dB -> 0.2 * 1.995 ~= 0.399
			expect(applyReplayGainToVolume(0.2, 6)).toBeCloseTo(0.399, 2);
		});

		it("should handle invalid base volumes gracefully", () => {
			expect(applyReplayGainToVolume(-1, 0)).toBe(0);
			expect(applyReplayGainToVolume(2, 0)).toBe(1.0);
			expect(applyReplayGainToVolume(NaN, 0)).toBe(1.0);
		});
	});
});
