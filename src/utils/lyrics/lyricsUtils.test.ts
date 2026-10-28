import { describe, expect, it } from "vite-plus/test";
import { isTimestampedKaraokeLyrics } from "./formatDetection";
import { calculateLyricsIndex } from "./indexCalculator";
import { LyricsExtendedParser } from "./extendedParser";
import { linearFillProgress, resolveCharEndTimes } from "./charFillProgress";
import { stripLeadingLyricsMetadata } from "./normalizeLyrics";

describe("lyrics formatDetection", () => {
	it("should detect karaoke lyrics by angle brackets", () => {
		expect(isTimestampedKaraokeLyrics("[00:01.00]Hello <00:01.50>World")).toBe(true);
		expect(isTimestampedKaraokeLyrics("<00:01.00>Only <00:02.00>angles")).toBe(true);
	});

	it("should detect karaoke lyrics by multiple square bracket timestamps on the same line", () => {
		expect(isTimestampedKaraokeLyrics("[00:01.00]Hello [00:02.00]World")).toBe(true);
	});

	it("should return false for regular single-timestamp lines and empty text", () => {
		expect(isTimestampedKaraokeLyrics("")).toBe(false);
		expect(isTimestampedKaraokeLyrics("   ")).toBe(false);
		expect(
			isTimestampedKaraokeLyrics("[00:01.00]Just regular line\n[00:05.00]Another line"),
		).toBe(false);
	});
});

describe("lyrics normalizeLyrics", () => {
	it("should strip metadata preceding the first timestamp", () => {
		const raw = "[ti:My Song]\n[ar:Singer]\n[al:Album]\n[00:10.50]First line of song";
		const stripped = stripLeadingLyricsMetadata(raw);
		expect(stripped).toBe("[00:10.50]First line of song");
	});

	it("should return unchanged text if no timestamp exists", () => {
		expect(stripLeadingLyricsMetadata("No timestamps at all")).toBe("No timestamps at all");
	});
});

describe("calculateLyricsIndex", () => {
	it("should return -1 when lyrics are empty", () => {
		const idx = calculateLyricsIndex({
			fullLyrics: [],
			fullExtendedLyrics: [],
			currentTime: 10,
		});
		expect(idx).toBe(-1);
	});

	it("should find the active line using binary search with standard 0.5s advance", () => {
		const fullLyrics = [
			{ time: 2.0, text: "Line 1" },
			{ time: 5.0, text: "Line 2" },
			{ time: 8.0, text: "Line 3" },
		];

		// At t = 1.0, adjusted = 1.5 (< 2.0) -> -1
		expect(calculateLyricsIndex({ fullLyrics, fullExtendedLyrics: [], currentTime: 1.0 })).toBe(
			-1,
		);

		// At t = 1.6, adjusted = 2.1 (>= 2.0 and < 5.0) -> index 0
		expect(calculateLyricsIndex({ fullLyrics, fullExtendedLyrics: [], currentTime: 1.6 })).toBe(
			0,
		);

		// At t = 4.8, adjusted = 5.3 (>= 5.0 and < 8.0) -> index 1
		expect(calculateLyricsIndex({ fullLyrics, fullExtendedLyrics: [], currentTime: 4.8 })).toBe(
			1,
		);

		// At t = 10.0, adjusted = 10.5 (>= 8.0, last line) -> index 2
		expect(
			calculateLyricsIndex({ fullLyrics, fullExtendedLyrics: [], currentTime: 10.0 }),
		).toBe(2);
	});

	it("should prioritize fullExtendedLyrics with 0.2s advance when present", () => {
		const fullLyrics = [{ time: 10.0, text: "Unused" }];
		const fullExtendedLyrics = [
			{ time: 2.0, text: "Karaoke 1", chars: [], lineTimeStamps: [2.0] },
			{ time: 4.0, text: "Karaoke 2", chars: [], lineTimeStamps: [4.0] },
		];

		// At t = 1.7, adjusted = 1.7 + 0.2 = 1.9 (< 2.0) -> -1
		expect(calculateLyricsIndex({ fullLyrics, fullExtendedLyrics, currentTime: 1.7 })).toBe(-1);

		// At t = 1.85, adjusted = 1.85 + 0.2 = 2.05 (>= 2.0 and < 4.0) -> index 0
		expect(calculateLyricsIndex({ fullLyrics, fullExtendedLyrics, currentTime: 1.85 })).toBe(0);
	});
});

describe("charFillProgress", () => {
	it("should compute linear fill clamped between 0 and 1", () => {
		expect(linearFillProgress(1.0, 2.0, 4.0)).toBe(0);
		expect(linearFillProgress(5.0, 2.0, 4.0)).toBe(1);
		expect(linearFillProgress(3.0, 2.0, 4.0)).toBe(0.5);
		expect(linearFillProgress(2.5, 2.0, 4.0)).toBe(0.25);
	});

	it("should resolve character end times based on line time stamps", () => {
		const chars = [
			{ time: 1.0, char: "A" },
			{ time: 1.5, char: "B" },
			{ time: 2.0, char: "C" },
		];
		const stamps = [1.0, 1.5, 2.0, 2.8];

		const endTimes = resolveCharEndTimes(chars, stamps);
		expect(endTimes).toEqual([1.5, 2.0, 2.8]);
	});

	it("should fall back to default offset when no next stamp exists", () => {
		const chars = [{ time: 3.0, char: "Z" }];
		const endTimes = resolveCharEndTimes(chars, [3.0]);
		expect(endTimes[0]).toBeCloseTo(3.12);
	});
});

describe("LyricsExtendedParser", () => {
	it("should parse karaoke formatted lines with angle brackets", () => {
		const lrc = "[01:00.00]<01:00.00>He<01:00.30>llo <01:00.70>world";
		const parsed = LyricsExtendedParser.parse(lrc);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]?.time).toBe(60.0);
		expect(parsed[0]?.text).toBe("Hello world");
		expect(parsed[0]?.chars.length).toBeGreaterThan(0);
	});

	it("should return empty array for empty input", () => {
		expect(LyricsExtendedParser.parse("")).toEqual([]);
		expect(LyricsExtendedParser.parse("   ")).toEqual([]);
	});

	it("should parse line with line timestamp but without character timestamps", () => {
		const lrc = "[00:05.00]Simple line without char stamps";
		const parsed = LyricsExtendedParser.parse(lrc);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]?.time).toBe(5.0);
		expect(parsed[0]?.text).toBe("Simple line without char stamps");
		expect(parsed[0]?.chars.length).toBe("Simple line without char stamps".length);
		expect(parsed[0]?.chars[0]?.time).toBe(5.0);
	});

	it("should skip lines with empty text after removing timestamps", () => {
		const lrc = "[00:01.00]   \n[00:02.00]\n[00:03.00]Valid line";
		const parsed = LyricsExtendedParser.parse(lrc);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]?.text).toBe("Valid line");
	});
});
