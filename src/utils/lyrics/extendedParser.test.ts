import { describe, expect, it } from "vitest";
import { LyricsExtendedParser } from "./extendedParser";

describe("LyricsExtendedParser", () => {
	it("should return empty array for empty or whitespace content", () => {
		expect(LyricsExtendedParser.parse("")).toEqual([]);
		expect(LyricsExtendedParser.parse("   \n\t  ")).toEqual([]);
	});

	it("should parse standard line timestamps with angle bracket character timestamps", () => {
		const lrc = "[01:10.50]<01:10.50>Hel<01:10.80>lo <01:11.20>World";
		const lines = LyricsExtendedParser.parse(lrc);

		expect(lines).toHaveLength(1);
		const line = lines[0];
		expect(line?.time).toBe(70.5);
		expect(line?.text).toBe("Hello World");
		expect(line?.lineTimeStamps).toEqual([70.5, 70.8, 71.2]);

		// Chars mapping
		expect(line?.chars[0]).toEqual({ char: "H", time: 70.5 });
		expect(line?.chars[1]).toEqual({ char: "e", time: 70.5 });
		expect(line?.chars[2]).toEqual({ char: "l", time: 70.5 });
		// After 70.80: "lo "
		expect(line?.chars[3]).toEqual({ char: "l", time: 70.8 });
		expect(line?.chars[4]).toEqual({ char: "o", time: 70.8 });
		expect(line?.chars[5]).toEqual({ char: " ", time: 70.8 });
		// After 71.20: "World"
		expect(line?.chars[6]).toEqual({ char: "W", time: 71.2 });
	});

	it("should support lyrics without leading line timestamps and derive time from first character", () => {
		const lrc = "<00:05.20>Start<00:06.00>End";
		const lines = LyricsExtendedParser.parse(lrc);

		expect(lines).toHaveLength(1);
		expect(lines[0]?.time).toBe(5.2);
		expect(lines[0]?.text).toBe("StartEnd");
		expect(lines[0]?.lineTimeStamps).toEqual([5.2, 6.0]);
	});

	it("should handle square-bracket inline character timestamps", () => {
		const lrc = "[00:02.00]One[00:02.50]Two[00:03.00]Three";
		const lines = LyricsExtendedParser.parse(lrc);

		expect(lines).toHaveLength(1);
		expect(lines[0]?.time).toBe(2.0);
		expect(lines[0]?.text).toBe("OneTwoThree");
		expect(lines[0]?.lineTimeStamps).toEqual([2.0, 2.5, 3.0]);
	});

	it("should parse plain lines without character timestamps and assign line time to each character", () => {
		const lrc = "[00:15.00]Simple un-timed line";
		const lines = LyricsExtendedParser.parse(lrc);

		expect(lines).toHaveLength(1);
		expect(lines[0]?.time).toBe(15.0);
		expect(lines[0]?.text).toBe("Simple un-timed line");
		expect(lines[0]?.chars).toHaveLength("Simple un-timed line".length);
		expect(lines[0]?.chars.every((c) => c.time === 15.0)).toBe(true);
		expect(lines[0]?.lineTimeStamps).toEqual([15.0]);
	});

	it("should skip empty lines and lines consisting solely of timestamps or whitespace", () => {
		const lrc = [
			"",
			"   ",
			"[00:01.00]",
			"[00:02.00]   ",
			"[00:05.00]Actual line",
		].join("\n");

		const lines = LyricsExtendedParser.parse(lrc);
		expect(lines).toHaveLength(1);
		expect(lines[0]?.text).toBe("Actual line");
	});

	it("should sort lines chronologically by line time", () => {
		const lrc = [
			"[00:20.00]Second line",
			"[00:05.00]First line",
			"[00:35.00]Third line",
		].join("\n");

		const lines = LyricsExtendedParser.parse(lrc);
		expect(lines).toHaveLength(3);
		expect(lines[0]?.time).toBe(5.0);
		expect(lines[1]?.time).toBe(20.0);
		expect(lines[2]?.time).toBe(35.0);
	});

	it("should ignore invalid inline bracket timestamps when parsing character timing", () => {
		const lrc = "[00:01.00]Valid <99:99:99> Text";
		const lines = LyricsExtendedParser.parse(lrc);
		expect(lines).toHaveLength(1);
		expect(lines[0]?.text).toBe("Valid <99:99:99> Text");
	});
});
