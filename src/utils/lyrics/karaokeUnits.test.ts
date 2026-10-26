import { describe, expect, it } from "vitest";
import { buildKaraokeUnits } from "./karaokeUnits";
import type { ExtendedLyricChar } from "./extendedParser";

describe("lyrics/karaokeUnits", () => {
	it("should return an empty array when given no characters", () => {
		const units = buildKaraokeUnits([], { lineTimeStamps: 10 });
		expect(units).toEqual([]);
	});

	it("should segment CJK characters into individual karaoke units", () => {
		const chars: ExtendedLyricChar[] = [
			{ char: "明", time: 10.0 },
			{ char: "月", time: 10.5 },
			{ char: "几", time: 11.0 },
			{ char: "时", time: 11.5 },
			{ char: "有", time: 12.0 },
		];
		const units = buildKaraokeUnits(chars, { lineTimeStamps: 10.0 });
		expect(units).toHaveLength(5);
		expect(units[0]).toMatchObject({ text: "明", charTime: 10.0 });
		expect(units[1]).toMatchObject({ text: "月", charTime: 10.5 });
		expect(units[4]).toMatchObject({ text: "有", charTime: 12.0 });
	});

	it("should merge Latin word characters into a single karaoke unit", () => {
		const chars: ExtendedLyricChar[] = [
			{ char: "H", time: 1.0 },
			{ char: "e", time: 1.1 },
			{ char: "l", time: 1.2 },
			{ char: "l", time: 1.3 },
			{ char: "o", time: 1.4 },
		];
		const units = buildKaraokeUnits(chars, { lineTimeStamps: 1.0 });
		expect(units).toHaveLength(1);
		expect(units[0]?.text).toBe("Hello");
		expect(units[0]?.charTime).toBe(1.0);
		expect(units[0]?.charEndTime).toBeGreaterThan(1.4);
	});

	it("should support Latin words with internal apostrophes and hyphens", () => {
		// "don't"
		const chars: ExtendedLyricChar[] = [
			{ char: "d", time: 2.0 },
			{ char: "o", time: 2.1 },
			{ char: "n", time: 2.2 },
			{ char: "'", time: 2.3 },
			{ char: "t", time: 2.4 },
		];
		const units = buildKaraokeUnits(chars, { lineTimeStamps: 2.0 });
		expect(units).toHaveLength(1);
		expect(units[0]?.text).toBe("don't");
		expect(units[0]?.charTime).toBe(2.0);
	});

	it("should handle mixed CJK and Latin sentences", () => {
		const chars: ExtendedLyricChar[] = [
			{ char: "今", time: 3.0 },
			{ char: "夜", time: 3.5 },
			{ char: " ", time: 4.0 },
			{ char: "g", time: 4.1 },
			{ char: "o", time: 4.2 },
		];
		const units = buildKaraokeUnits(chars, { lineTimeStamps: 3.0 });
		expect(units.map((u) => u.text)).toEqual(["今", "夜", " ", "go"]);
	});

	it("should compute fallback endTime when last char lacks explicit end time", () => {
		const chars: ExtendedLyricChar[] = [{ char: "A", time: 5.0 }];
		const units = buildKaraokeUnits(chars, { lineTimeStamps: 5.0 });
		expect(units[0]?.charEndTime).toBeCloseTo(5.12, 2);
	});
});
