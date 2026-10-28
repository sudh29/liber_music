import { describe, it, expect } from "vitest";
import { parseMusicCodeblock } from "./parser";

describe("parseMusicCodeblock", () => {
	it("should parse standard YAML-style music codeblocks", () => {
		const source = `
track: "Music/Classical/Chopin - Nocturne Op. 9.mp3"
start: "01:23"
end: "03:45"
showLyrics: true
compact: true
autoplay: false
title: "Nocturne"
artist: "Chopin"
`;
		const config = parseMusicCodeblock(source);
		expect(config.track).toBe("Music/Classical/Chopin - Nocturne Op. 9.mp3");
		expect(config.start).toBe(83);
		expect(config.end).toBe(225);
		expect(config.showLyrics).toBe(true);
		expect(config.compact).toBe(true);
		expect(config.autoplay).toBe(false);
		expect(config.title).toBe("Nocturne");
		expect(config.artist).toBe("Chopin");
	});

	it("should handle wikilink bracket syntax in track path", () => {
		const source = `track: [[Music/Rock/Queen - Bohemian Rhapsody.mp3]]`;
		const config = parseMusicCodeblock(source);
		expect(config.track).toBe("Music/Rock/Queen - Bohemian Rhapsody.mp3");
	});

	it("should support numeric timestamps and aliases", () => {
		const source = `
file: 'Audio/Song.flac'
from: 45
to: 120
lyrics: 1
mini: yes
play: true
`;
		const config = parseMusicCodeblock(source);
		expect(config.track).toBe("Audio/Song.flac");
		expect(config.start).toBe(45);
		expect(config.end).toBe(120);
		expect(config.showLyrics).toBe(true);
		expect(config.compact).toBe(true);
		expect(config.autoplay).toBe(true);
	});

	it("should fallback cleanly on empty or comment-only blocks", () => {
		const emptyConfig = parseMusicCodeblock("");
		expect(emptyConfig.track).toBe("");
		expect(emptyConfig.start).toBe(0);

		const commentConfig = parseMusicCodeblock("# Just a comment\n# Another comment");
		expect(commentConfig.track).toBe("");
	});

	it("should parse bare audio file paths without track keyword", () => {
		const source = `"Music/Ambient/Rain.ogg"`;
		const config = parseMusicCodeblock(source);
		expect(config.track).toBe("Music/Ambient/Rain.ogg");
	});
});
