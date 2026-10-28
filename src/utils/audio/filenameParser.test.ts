import { describe, expect, it } from "vitest";
import { parseTrackFilename } from "./filenameParser";

describe("filenameParser", () => {
	it("should parse 4-part 'YYYY - Artist - Album - Title' format", () => {
		const result = parseTrackFilename("1997 - Celine Dion - Titanic - My Heart Will Go On.mp3");
		expect(result).toEqual({
			year: 1997,
			artist: "Celine Dion",
			album: "Titanic",
			title: "My Heart Will Go On",
		});
	});

	it("should parse Bollywood multi-artist 4-part format", () => {
		const result = parseTrackFilename("1976 - Lata Mangeshkar - Kabhi Kabhie - Kabhi Kabhie Mere Dil Mein.mp3");
		expect(result).toEqual({
			year: 1976,
			artist: "Lata Mangeshkar",
			album: "Kabhi Kabhie",
			title: "Kabhi Kabhie Mere Dil Mein",
		});
	});

	it("should parse 3-part 'YYYY - Artist - Title' format", () => {
		const result = parseTrackFilename("1985 - Bryan Adams - Summer Of 69.mp3");
		expect(result).toEqual({
			year: 1985,
			artist: "Bryan Adams",
			title: "Summer Of 69",
		});
	});

	it("should parse 'Artist - Title' format", () => {
		const result = parseTrackFilename("Coldplay - Yellow.flac");
		expect(result).toEqual({
			artist: "Coldplay",
			title: "Yellow",
		});
	});

	it("should parse 'Track - Artist - Title' format", () => {
		const result = parseTrackFilename("03 - Queen - Bohemian Rhapsody.mp3");
		expect(result).toEqual({
			trackNumber: 3,
			artist: "Queen",
			title: "Bohemian Rhapsody",
		});
	});

	it("should parse 'Track - Title' format", () => {
		const result = parseTrackFilename("01 - Intro.mp3");
		expect(result).toEqual({
			trackNumber: 1,
			title: "Intro",
		});
	});

	it("should parse 'Track. Artist - Title' format", () => {
		const result = parseTrackFilename("05. Adele - Hello.wav");
		expect(result).toEqual({
			trackNumber: 5,
			artist: "Adele",
			title: "Hello",
		});
	});

	it("should parse 'Track. Title' format", () => {
		const result = parseTrackFilename("02. Interlude.m4a");
		expect(result).toEqual({
			trackNumber: 2,
			title: "Interlude",
		});
	});

	it("should handle full paths and extract basename", () => {
		const result = parseTrackFilename("music/western/2000 - Linkin Park - So Far Away.mp3");
		expect(result).toEqual({
			year: 2000,
			artist: "Linkin Park",
			title: "So Far Away",
		});
	});

	it("should handle single title with no delimiters", () => {
		const result = parseTrackFilename("Imagine.mp3");
		expect(result).toEqual({
			title: "Imagine",
		});
	});

	it("should handle empty or whitespace string", () => {
		expect(parseTrackFilename("")).toEqual({ title: "" });
		expect(parseTrackFilename("   ")).toEqual({ title: "" });
	});

	it("should handle unicode en-dash and em-dash delimiters", () => {
		const result1 = parseTrackFilename("1982 – Michael Jackson – Thriller.mp3");
		expect(result1).toEqual({
			year: 1982,
			artist: "Michael Jackson",
			title: "Thriller",
		});

		const result2 = parseTrackFilename("Eagles — Hotel California.mp3");
		expect(result2).toEqual({
			artist: "Eagles",
			title: "Hotel California",
		});
	});

	it("should handle 5+ parts by combining remainder into title", () => {
		const result = parseTrackFilename("2023 - B Praak - Animal - Saari Duniya Jalaa Denge - Extended.mp3");
		expect(result).toEqual({
			year: 2023,
			artist: "B Praak",
			album: "Animal",
			title: "Saari Duniya Jalaa Denge - Extended",
		});
	});

	it("should parse 2-part 'YYYY - Title' format", () => {
		const result = parseTrackFilename("1999 - Smooth.mp3");
		expect(result).toEqual({
			year: 1999,
			title: "Smooth",
		});
	});

	it("should parse 3-part 'Artist - Album - Title' without leading year or track number", () => {
		const result = parseTrackFilename("Queen - A Night at the Opera - Bohemian Rhapsody.mp3");
		expect(result).toEqual({
			artist: "Queen",
			album: "A Night at the Opera",
			title: "Bohemian Rhapsody",
		});
	});

	it("should parse 4+ parts without leading year or track number", () => {
		const result = parseTrackFilename("Pink Floyd - The Wall - Disc 1 - In The Flesh.mp3");
		expect(result).toEqual({
			artist: "Pink Floyd",
			album: "The Wall",
			title: "Disc 1 - In The Flesh",
		});
	});

	it("should handle Windows backslash paths and extensionless filenames", () => {
		const winResult = parseTrackFilename("C:\\Music\\Pink Floyd - Money.mp3");
		expect(winResult).toEqual({
			artist: "Pink Floyd",
			title: "Money",
		});

		const noExt = parseTrackFilename("Coldplay - Yellow");
		expect(noExt).toEqual({
			artist: "Coldplay",
			title: "Yellow",
		});
	});
});
