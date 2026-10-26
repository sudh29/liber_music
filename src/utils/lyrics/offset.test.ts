import { describe, expect, it } from "vite-plus/test";
import { applyLyricsOffset, parseLyricsOffset, stripLyricsOffsetTags } from "./offset";
import type { LyricLine } from "./parser";
import type { ExtendedLyricLine } from "./extendedParser";

describe("lyrics offset utility", () => {
	describe("parseLyricsOffset", () => {
		it("should return 0 when no offset tag is present", () => {
			expect(parseLyricsOffset("")).toBe(0);
			expect(parseLyricsOffset("[00:01.00]Hello world")).toBe(0);
		});

		it("should parse positive offset in milliseconds to seconds", () => {
			const lrc = "[ti:Test]\n[offset:500]\n[00:02.00]Lyric line";
			expect(parseLyricsOffset(lrc)).toBe(0.5);

			const withPlus = "[offset:+1200]\n[00:02.00]Lyric line";
			expect(parseLyricsOffset(withPlus)).toBe(1.2);
		});

		it("should parse negative offset in milliseconds to seconds", () => {
			const lrc = "[offset:-800]\n[00:02.00]Lyric line";
			expect(parseLyricsOffset(lrc)).toBe(-0.8);
		});

		it("should handle whitespace and case-insensitivity in tag", () => {
			expect(parseLyricsOffset("[ OFFSET : 2500 ]")).toBe(2.5);
			expect(parseLyricsOffset("[Offset:-300]")).toBe(-0.3);
		});

		it("should ignore invalid numbers and return 0", () => {
			expect(parseLyricsOffset("[offset:abc]")).toBe(0);
			expect(parseLyricsOffset("[offset:]")).toBe(0);
		});

		it("should pick the first offset tag if multiple exist", () => {
			const text = "[offset:1000]\n[offset:2000]\n[00:01.00]Line";
			expect(parseLyricsOffset(text)).toBe(1.0);
		});
	});

	describe("stripLyricsOffsetTags", () => {
		it("should remove single and multiple offset tags completely", () => {
			const text =
				"[ti:Song]\n[offset:500]\n[00:01.00]Line 1\n[offset:-200]\n[00:05.00]Line 2";
			const stripped = stripLyricsOffsetTags(text);
			expect(stripped).not.toContain("[offset:");
			expect(stripped).toContain("[ti:Song]");
			expect(stripped).toContain("[00:01.00]Line 1");
			expect(stripped).toContain("[00:05.00]Line 2");
		});

		it("should handle empty or untagged text unchanged", () => {
			expect(stripLyricsOffsetTags("")).toBe("");
			expect(stripLyricsOffsetTags("[00:01.00]Simple")).toBe("[00:01.00]Simple");
		});
	});

	describe("applyLyricsOffset", () => {
		it("should shift normal lyric lines by positive offset and clamp negative results to 0", () => {
			const lyrics: LyricLine[] = [
				{ time: 1.0, text: "Line 1" },
				{ time: 5.0, text: "Line 2" },
			];
			const extendedLyrics: ExtendedLyricLine[] = [];

			// Positive offset of 2.0s means lyrics start 2.0s earlier (time - 2.0)
			applyLyricsOffset(lyrics, extendedLyrics, 2.0);

			expect(lyrics[0]?.time).toBe(0); // 1.0 - 2.0 = -1.0 -> clamped to 0
			expect(lyrics[1]?.time).toBe(3.0); // 5.0 - 2.0 = 3.0
		});

		it("should shift normal lyric lines by negative offset (delaying playback)", () => {
			const lyrics: LyricLine[] = [
				{ time: 1.0, text: "Line 1" },
				{ time: 4.5, text: "Line 2" },
			];
			const extendedLyrics: ExtendedLyricLine[] = [];

			// Negative offset of -1.5s means time - (-1.5) = time + 1.5
			applyLyricsOffset(lyrics, extendedLyrics, -1.5);

			expect(lyrics[0]?.time).toBe(2.5);
			expect(lyrics[1]?.time).toBe(6.0);
		});

		it("should shift extended karaoke lyrics and all constituent character timestamps", () => {
			const extendedLyrics: ExtendedLyricLine[] = [
				{
					time: 2.0,
					text: "Hi",
					chars: [
						{ char: "H", time: 2.0 },
						{ char: "i", time: 2.5 },
					],
					lineTimeStamps: [2.0, 2.5],
				},
			];

			applyLyricsOffset([], extendedLyrics, 1.0);

			expect(extendedLyrics[0]?.time).toBe(1.0);
			expect(extendedLyrics[0]?.chars[0]?.time).toBe(1.0);
			expect(extendedLyrics[0]?.chars[1]?.time).toBe(1.5);
			expect(extendedLyrics[0]?.lineTimeStamps).toEqual([1.0, 1.5]);
		});

		it("should do nothing if offset is 0 or NaN", () => {
			const lyrics: LyricLine[] = [{ time: 3.0, text: "Stay" }];
			applyLyricsOffset(lyrics, [], 0);
			expect(lyrics[0]?.time).toBe(3.0);

			applyLyricsOffset(lyrics, [], Number.NaN);
			expect(lyrics[0]?.time).toBe(3.0);
		});
	});
});
