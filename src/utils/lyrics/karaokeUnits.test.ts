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

		// "state-of-the-art"
		const hyphenChars: ExtendedLyricChar[] = "state-of-the-art".split("").map((char, i) => ({
			char,
			time: 3.0 + i * 0.1,
		}));
		const hyphenUnits = buildKaraokeUnits(hyphenChars, { lineTimeStamps: 3.0 });
		expect(hyphenUnits).toHaveLength(1);
		expect(hyphenUnits[0]?.text).toBe("state-of-the-art");
	});

	it("should not merge apostrophe or hyphen if not surrounded by alphanumeric characters", () => {
		// "-rock-" with spaces or edges
		const chars: ExtendedLyricChar[] = [
			{ char: "-", time: 1.0 },
			{ char: "r", time: 1.1 },
			{ char: "o", time: 1.2 },
			{ char: "c", time: 1.3 },
			{ char: "k", time: 1.4 },
			{ char: "-", time: 1.5 },
			{ char: " ", time: 1.6 },
		];
		const units = buildKaraokeUnits(chars, { lineTimeStamps: 1.0 });
		expect(units.map((u) => u.text)).toEqual(["-", "rock", "-", " "]);
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

		// Standalone punctuation fallback
		const punctChars: ExtendedLyricChar[] = [{ char: "!", time: 6.0 }];
		const punctUnits = buildKaraokeUnits(punctChars, { lineTimeStamps: 6.0 });
		expect(punctUnits[0]?.text).toBe("!");
		expect(punctUnits[0]?.charEndTime).toBeCloseTo(6.12, 2);

		// Trailing apostrophe: "rock'" followed by nothing or space
		const trailingChars: ExtendedLyricChar[] = [
			{ char: "r", time: 7.0 },
			{ char: "o", time: 7.1 },
			{ char: "c", time: 7.2 },
			{ char: "k", time: 7.3 },
			{ char: "'", time: 7.4 },
		];
		const trailingUnits = buildKaraokeUnits(trailingChars, { lineTimeStamps: 7.0 });
		expect(trailingUnits.map((u) => u.text)).toEqual(["rock", "'"]);

		// Apostrophe followed by space: "it' s"
		const spacedChars: ExtendedLyricChar[] = [
			{ char: "i", time: 8.0 },
			{ char: "t", time: 8.1 },
			{ char: "'", time: 8.2 },
			{ char: " ", time: 8.3 },
			{ char: "s", time: 8.4 },
		];
		const spacedUnits = buildKaraokeUnits(spacedChars, { lineTimeStamps: 8.0 });
		expect(spacedUnits.map((u) => u.text)).toEqual(["it", "'", " ", "s"]);
	});
});
