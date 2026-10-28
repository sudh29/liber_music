import { describe, it, expect } from "vitest";
import {
	formatTime,
	parseTimeString,
	generateObsidianTrackUri,
	generateLyricMarkdownLink,
	parseObsidianMusicProtocol,
} from "./uri";

describe("URI & Protocol Utilities", () => {
	describe("formatTime", () => {
		it("should format seconds into MM:SS correctly", () => {
			expect(formatTime(0)).toBe("00:00");
			expect(formatTime(5)).toBe("00:05");
			expect(formatTime(65)).toBe("01:05");
			expect(formatTime(142)).toBe("02:22");
		});

		it("should format hours into HH:MM:SS when duration exceeds 1 hour", () => {
			expect(formatTime(3600)).toBe("01:00:00");
			expect(formatTime(3665)).toBe("01:01:05");
			expect(formatTime(7325)).toBe("02:02:05");
		});

		it("should handle invalid or negative values safely", () => {
			expect(formatTime(-10)).toBe("00:00");
			expect(formatTime(NaN)).toBe("00:00");
			expect(formatTime(Infinity)).toBe("00:00");
		});
	});

	describe("parseTimeString", () => {
		it("should parse numeric strings or numbers", () => {
			expect(parseTimeString(142)).toBe(142);
			expect(parseTimeString("142")).toBe(142);
			expect(parseTimeString("142.5")).toBe(142.5);
		});

		it("should parse MM:SS colon separated strings", () => {
			expect(parseTimeString("01:23")).toBe(83);
			expect(parseTimeString("00:45")).toBe(45);
			expect(parseTimeString("10:00")).toBe(600);
		});

		it("should parse HH:MM:SS colon separated strings", () => {
			expect(parseTimeString("01:02:03")).toBe(3723);
			expect(parseTimeString("02:00:00")).toBe(7200);
		});

		it("should return 0 for invalid inputs", () => {
			expect(parseTimeString("")).toBe(0);
			expect(parseTimeString("invalid")).toBe(0);
			expect(parseTimeString(null)).toBe(0);
			expect(parseTimeString(undefined)).toBe(0);
			expect(parseTimeString("-10")).toBe(0);
		});
	});

	describe("generateObsidianTrackUri", () => {
		it("should generate clean URI without timestamp", () => {
			const uri = generateObsidianTrackUri("Music/Rock/Song.mp3");
			expect(uri).toBe("obsidian://music-player?track=Music%2FRock%2FSong.mp3");
		});

		it("should strip wikilink brackets if present", () => {
			const uri = generateObsidianTrackUri("[[Music/Rock/Song.mp3]]");
			expect(uri).toBe("obsidian://music-player?track=Music%2FRock%2FSong.mp3");
		});

		it("should include rounded timestamp when provided", () => {
			const uri = generateObsidianTrackUri("Music/Song.mp3", 142.7);
			expect(uri).toBe("obsidian://music-player?track=Music%2FSong.mp3&t=143");
		});

		it("should support autoplay=false parameter", () => {
			const uri = generateObsidianTrackUri("Music/Song.mp3", 60, false);
			expect(uri).toBe("obsidian://music-player?track=Music%2FSong.mp3&t=60&autoplay=false");
		});
	});

	describe("generateLyricMarkdownLink", () => {
		it("should generate markdown citation link with lyric text", () => {
			const link = generateLyricMarkdownLink(
				"Music/Queen - Bohemian Rhapsody.mp3",
				83,
				"Is this the real life? Is this just fantasy?"
			);
			expect(link).toBe(
				'[01:23 — "Is this the real life? Is this just fantasy?"](obsidian://music-player?track=Music%2FQueen%20-%20Bohemian%20Rhapsody.mp3&t=83)'
			);
		});

		it("should fall back to title when lyric text is missing", () => {
			const link = generateLyricMarkdownLink(
				"Music/Track.mp3",
				125,
				"",
				"Track Name"
			);
			expect(link).toBe(
				"[Track Name (02:05)](obsidian://music-player?track=Music%2FTrack.mp3&t=125)"
			);
		});
	});

	describe("parseObsidianMusicProtocol", () => {
		it("should parse standard track and t query parameters", () => {
			const payload = parseObsidianMusicProtocol({
				track: "Music%2FRock%2FSong.mp3",
				t: "142",
			});
			expect(payload.track).toBe("Music/Rock/Song.mp3");
			expect(payload.time).toBe(142);
			expect(payload.autoplay).toBe(true);
		});

		it("should handle colon formatted timestamps in protocol", () => {
			const payload = parseObsidianMusicProtocol({
				track: "Classical/Nocturne.mp3",
				t: "02:15",
				autoplay: "false",
			});
			expect(payload.track).toBe("Classical/Nocturne.mp3");
			expect(payload.time).toBe(135);
			expect(payload.autoplay).toBe(false);
		});

		it("should handle alternative parameter names", () => {
			const payload = parseObsidianMusicProtocol({
				file: "Audio/Beatles.flac",
				time: "45",
				play: "0",
			});
			expect(payload.track).toBe("Audio/Beatles.flac");
			expect(payload.time).toBe(45);
			expect(payload.autoplay).toBe(false);
		});

		it("should handle malformed URI decoding by falling back to raw track string", () => {
			const payload = parseObsidianMusicProtocol({
				track: "%E0%A4%A",
			});
			expect(payload.track).toBe("%E0%A4%A");
		});

		it("should handle colon time strings with non-numeric parts or excess segments", () => {
			expect(parseTimeString("12:abc")).toBe(0);
			expect(parseTimeString("12:-5")).toBe(0);
			expect(parseTimeString("01:02:03:04")).toBe(0);
		});
	});
});
