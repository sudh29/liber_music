import { describe, expect, it } from "vite-plus/test";
import { LyricsParser } from "./parser";

describe("LyricsParser", () => {
	it("should parse simple LRC content into sorted LyricLine array", () => {
		const lrc = `
[00:05.50]First line of the song
[00:02.10]Intro line
[00:10.00]Chorus line
`;
		const parsed = LyricsParser.parseLRC(lrc);

		expect(parsed).toHaveLength(3);
		// Check that lines are sorted by timestamp
		expect(parsed[0]?.time).toBe(2.1);
		expect(parsed[0]?.text).toBe("Intro line");
		expect(parsed[1]?.time).toBe(5.5);
		expect(parsed[1]?.text).toBe("First line of the song");
		expect(parsed[2]?.time).toBe(10.0);
		expect(parsed[2]?.text).toBe("Chorus line");
	});

	it("should handle multiple timestamps on a single line (repeated chorus)", () => {
		const lrc = "[00:03.00][00:15.00]Repeated lyric text";
		const parsed = LyricsParser.parseLRC(lrc);

		expect(parsed).toHaveLength(2);
		expect(parsed[0]?.time).toBe(3.0);
		expect(parsed[0]?.text).toBe("Repeated lyric text");
		expect(parsed[1]?.time).toBe(15.0);
		expect(parsed[1]?.text).toBe("Repeated lyric text");
	});

	it("should clean all bracket and angle tag variations using cleanText", () => {
		const text = "[01:23.45]<01:23.45>Hello <01:24.00>World[ar:Artist]<extra>";
		const cleaned = LyricsParser.cleanText(text);
		expect(cleaned).toBe("Hello World");
	});
});
