import { describe, expect, it } from "vitest";
import {
	createDefaultSmartPlaylistTemplate,
	evaluateRule,
	evaluateSmartPlaylist,
	extractFieldValue,
} from "./smartPlaylist";
import type { SmartPlaylistDefinition, TrackInfo } from "@/types/settings";

describe("smartPlaylist", () => {
	const sampleTrack: TrackInfo = {
		title: "Bohemian Rhapsody",
		artist: "Queen",
		album: "A Night at the Opera",
		genre: ["Rock", "Opera"],
		year: 1975,
		rating: 5,
		duration: 354,
	};

	describe("extractFieldValue", () => {
		it("extracts string fields correctly", () => {
			expect(extractFieldValue("title", sampleTrack, "Music/queen.mp3")).toBe("Bohemian Rhapsody");
			expect(extractFieldValue("artist", sampleTrack, "Music/queen.mp3")).toBe("Queen");
			expect(extractFieldValue("album", sampleTrack, "Music/queen.mp3")).toBe("A Night at the Opera");
			expect(extractFieldValue("genre", sampleTrack, "Music/queen.mp3")).toBe("Rock, Opera");
			expect(extractFieldValue("path", sampleTrack, "Music/queen.mp3")).toBe("Music/queen.mp3");
		});

		it("extracts numeric fields correctly", () => {
			expect(extractFieldValue("year", sampleTrack, "Music/queen.mp3")).toBe(1975);
			expect(extractFieldValue("rating", sampleTrack, "Music/queen.mp3")).toBe(5);
			expect(extractFieldValue("duration", sampleTrack, "Music/queen.mp3")).toBe(354);
		});

		it("handles missing/undefined fields gracefully", () => {
			const emptyTrack: TrackInfo = { title: "", artist: "", album: "" };
			expect(extractFieldValue("year", emptyTrack, "")).toBe(0);
			expect(extractFieldValue("rating", emptyTrack, "")).toBe(0);
			expect(extractFieldValue("duration", emptyTrack, "")).toBe(0);
			expect(extractFieldValue("genre", emptyTrack, "")).toBe("");
			expect(extractFieldValue("title", emptyTrack, "")).toBe("");
		});
	});

	describe("evaluateRule", () => {
		it("evaluates string operators (equals, contains, notEquals, notContains)", () => {
			expect(
				evaluateRule(
					{ id: "1", field: "artist", operator: "equals", value: "queen" },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "2", field: "artist", operator: "notEquals", value: "beatles" },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "3", field: "title", operator: "contains", value: "rhapsody" },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "4", field: "album", operator: "notContains", value: "day" },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "5", field: "title", operator: "contains", value: "xyz" },
					sampleTrack,
					""
				)
			).toBe(false);
		});

		it("evaluates numeric operators (greaterThan, lessThan, equals, between)", () => {
			expect(
				evaluateRule(
					{ id: "1", field: "year", operator: "greaterThan", value: 1970 },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "2", field: "year", operator: "lessThan", value: 1980 },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "3", field: "year", operator: "equals", value: 1975 },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "4", field: "year", operator: "between", value: 1970, secondValue: 1980 },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "5", field: "year", operator: "between", value: 1980, secondValue: 1990 },
					sampleTrack,
					""
				)
			).toBe(false);
		});

		it("evaluates rating and duration rules", () => {
			expect(
				evaluateRule(
					{ id: "1", field: "rating", operator: "greaterThan", value: 4 },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "2", field: "duration", operator: "greaterThan", value: 300 },
					sampleTrack,
					""
				)
			).toBe(true);

			expect(
				evaluateRule(
					{ id: "3", field: "duration", operator: "lessThan", value: 100 },
					sampleTrack,
					""
				)
			).toBe(false);
		});

		it("evaluates string comparison on path", () => {
			expect(
				evaluateRule(
					{ id: "1", field: "path", operator: "contains", value: "classic" },
					sampleTrack,
					"Music/Classic/Queen.mp3"
				)
			).toBe(true);
		});
	});

	describe("evaluateSmartPlaylist", () => {
		const track1 = {
			id: "t1",
			path: "Music/Rock/track1.mp3",
			info: { title: "Song A", artist: "Artist 1", album: "Album 1", year: 1985, rating: 5, duration: 200 },
		};
		const track2 = {
			id: "t2",
			path: "Music/Jazz/track2.mp3",
			info: { title: "Song B", artist: "Artist 2", album: "Album 2", year: 1995, rating: 3, duration: 400 },
		};
		const track3 = {
			id: "t3",
			path: "Music/Rock/track3.mp3",
			info: { title: "Song C", artist: "Artist 1", album: "Album 3", year: 1975, rating: 4, duration: 150 },
		};

		const library = [track1, track2, track3];

		it("returns all tracks when rules are empty", () => {
			const def: SmartPlaylistDefinition = {
				id: "all",
				name: "All",
				matchType: "all",
				rules: [],
			};
			expect(evaluateSmartPlaylist(def, library)).toEqual(["t1", "t2", "t3"]);
		});

		it("filters with matchType 'all' (AND)", () => {
			const def: SmartPlaylistDefinition = {
				id: "smart1",
				name: "Rock & 4+ Stars",
				matchType: "all",
				rules: [
					{ id: "r1", field: "path", operator: "contains", value: "Rock" },
					{ id: "r2", field: "rating", operator: "greaterThan", value: 3 },
				],
			};
			// t1 (Rock, 5) and t3 (Rock, 4) match
			expect(evaluateSmartPlaylist(def, library)).toEqual(["t1", "t3"]);
		});

		it("filters with matchType 'any' (OR)", () => {
			const def: SmartPlaylistDefinition = {
				id: "smart2",
				name: "Jazz or 5 Stars",
				matchType: "any",
				rules: [
					{ id: "r1", field: "path", operator: "contains", value: "Jazz" },
					{ id: "r2", field: "rating", operator: "equals", value: 5 },
				],
			};
			// t1 (rating 5) and t2 (Jazz) match
			expect(evaluateSmartPlaylist(def, library)).toEqual(["t1", "t2"]);
		});

		it("sorts by numeric and string fields in asc and desc", () => {
			const defSortYearDesc: SmartPlaylistDefinition = {
				id: "smart3",
				name: "Sorted by Year Desc",
				matchType: "all",
				rules: [],
				sortBy: "year",
				sortOrder: "desc",
			};
			// 1995 (t2), 1985 (t1), 1975 (t3)
			expect(evaluateSmartPlaylist(defSortYearDesc, library)).toEqual(["t2", "t1", "t3"]);

			const defSortTitleAsc: SmartPlaylistDefinition = {
				id: "smart4",
				name: "Sorted by Title Asc",
				matchType: "all",
				rules: [],
				sortBy: "title",
				sortOrder: "asc",
			};
			expect(evaluateSmartPlaylist(defSortTitleAsc, library)).toEqual(["t1", "t2", "t3"]);
		});

		it("applies limit correctly", () => {
			const defLimit: SmartPlaylistDefinition = {
				id: "smart5",
				name: "Top 2",
				matchType: "all",
				rules: [],
				sortBy: "rating",
				sortOrder: "desc",
				limit: 2,
			};
			// Sorted by rating desc: t1 (5), t3 (4), t2 (3) -> top 2: t1, t3
			expect(evaluateSmartPlaylist(defLimit, library)).toEqual(["t1", "t3"]);
		});
	});

	describe("createDefaultSmartPlaylistTemplate", () => {
		it("creates highRated template", () => {
			const def = createDefaultSmartPlaylistTemplate("highRated");
			expect(def.name).toContain("High Rated");
			expect(def.rules[0]?.field).toBe("rating");
		});

		it("creates classics template", () => {
			const def = createDefaultSmartPlaylistTemplate("classics");
			expect(def.name).toContain("Classics");
			expect(def.rules.length).toBe(2);
		});

		it("creates longTracks template", () => {
			const def = createDefaultSmartPlaylistTemplate("longTracks");
			expect(def.name).toContain("Epics & Jams");
			expect(def.rules[0]?.field).toBe("duration");
		});

		it("creates recent and default template", () => {
			const def = createDefaultSmartPlaylistTemplate("recent");
			expect(def.name).toContain("New Additions");
			expect(def.limit).toBe(50);

			const defDefault = createDefaultSmartPlaylistTemplate("unknown" as any);
			expect(defDefault.name).toContain("New Additions");
		});
	});

	describe("evaluateRule edge cases & operators", () => {
		const sampleTrack: TrackInfo = {
			title: "Hotel California",
			artist: "Eagles",
			album: "Hotel California",
			year: 1976,
			genre: ["Rock", "Classic Rock"],
			rating: 4,
			duration: 390,
		};

		it("handles extractFieldValue fallbacks", () => {
			expect(extractFieldValue("unknown" as any, sampleTrack, "music/track.mp3")).toBe("");
			expect(extractFieldValue("genre", { title: "X", artist: "Y", album: "Z", genre: "Pop" }, "")).toBe("Pop");
			expect(extractFieldValue("year", { title: "X", artist: "Y", album: "Z" }, "")).toBe(0);
		});

		it("evaluates numeric notEquals, contains, notContains, and invalid operators", () => {
			expect(evaluateRule({ id: "1", field: "year", operator: "notEquals", value: 2000 }, sampleTrack, "")).toBe(true);
			expect(evaluateRule({ id: "2", field: "year", operator: "notEquals", value: 1976 }, sampleTrack, "")).toBe(false);
			expect(evaluateRule({ id: "3", field: "year", operator: "contains", value: "97" }, sampleTrack, "")).toBe(true);
			expect(evaluateRule({ id: "4", field: "year", operator: "notContains", value: "99" }, sampleTrack, "")).toBe(true);
			expect(evaluateRule({ id: "5", field: "year", operator: "unknown" as any, value: 1976 }, sampleTrack, "")).toBe(false);
		});

		it("evaluates string notEquals, greaterThan, lessThan, between, and invalid operators", () => {
			expect(evaluateRule({ id: "1", field: "artist", operator: "notEquals", value: "Beatles" }, sampleTrack, "")).toBe(true);
			expect(evaluateRule({ id: "2", field: "artist", operator: "greaterThan", value: "Abba" }, sampleTrack, "")).toBe(true);
			expect(evaluateRule({ id: "3", field: "artist", operator: "lessThan", value: "Zz Top" }, sampleTrack, "")).toBe(true);
			expect(evaluateRule({ id: "4", field: "artist", operator: "between", value: "D" }, sampleTrack, "")).toBe(true);
			expect(evaluateRule({ id: "5", field: "artist", operator: "unknown" as any, value: "Eagles" }, sampleTrack, "")).toBe(false);
		});
	});
});
