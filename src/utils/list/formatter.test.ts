import { describe, expect, it } from "vitest";
import { formatCurrentList, formatListLabel } from "./formatter";

describe("list/formatter utilities", () => {
	describe("formatCurrentList", () => {
		it("should format standard list types correctly", () => {
			expect(formatCurrentList("all")).toBe("all");
			expect(formatCurrentList("favorites")).toBe("favorites");
			expect(formatCurrentList("playlist", "Chill")).toBe("playlist:Chill");
			expect(formatCurrentList("artist", "Queen")).toBe("artist:Queen");
			expect(formatCurrentList("album", "The Wall")).toBe("album:The Wall");
		});

		it("should fall back to 'all' when required name is missing", () => {
			expect(formatCurrentList("playlist")).toBe("all");
			expect(formatCurrentList("artist")).toBe("all");
			expect(formatCurrentList("album")).toBe("all");
		});

		it("should fall back to 'all' for unknown types", () => {
			expect(formatCurrentList("unknown")).toBe("all");
		});
	});

	describe("formatListLabel", () => {
		it("should return localized labels for standard lists", () => {
			expect(formatListLabel("all")).toBe("All");
			expect(formatListLabel("favorites")).toBe("Favorites");
			expect(formatListLabel("")).toBe("All");
		});

		it("should format playlist, artist, and album labels with parameters", () => {
			expect(formatListLabel("playlist:Rock")).toBe("Playlist · Rock");
			expect(formatListLabel("artist:The Beatles")).toBe("Artist · The Beatles");
			expect(formatListLabel("album:Abbey Road")).toBe("Album · Abbey Road");
		});

		it("should fall back to unknown artist and album when name is empty", () => {
			expect(formatListLabel("artist:")).toBe("Artist · Unknown artist");
			expect(formatListLabel("album:  ")).toBe("Album · Unknown album");
		});

		it("should fall back to 'All' for unparseable listId strings", () => {
			expect(formatListLabel("customUnknownThing")).toBe("All");
		});
	});
});
