import { describe, expect, it } from "vitest";
import { generateArtistsAndAlbums } from "./transform";
import type { MusicPlayerSettings } from "@/types";

describe("data/transform utilities", () => {
	it("should generate artist and album lookup maps correctly", () => {
		const settings: MusicPlayerSettings = {
			tracks: {
				"track-1": {
					id: "track-1",
					path: "music/song1.mp3",
					title: "Song 1",
					artist: "Queen",
					album: "A Night at the Opera",
					duration: 200,
					lyrics: "",
				},
				"track-2": {
					id: "track-2",
					path: "music/song2.mp3",
					title: "Song 2",
					artist: "Queen",
					album: "Sheer Heart Attack",
					duration: 180,
					lyrics: "",
				},
				"track-3": {
					id: "track-3",
					path: "music/song3.mp3",
					title: "Song 3",
					artist: "David Bowie",
					album: "Heroes",
					duration: 240,
					lyrics: "",
				},
			},
			trackIndex: {},
			favorites: [],
			playlists: {},
			artists: {},
			albums: {},
			musicFolder: "",
			volume: 1,
			playbackRate: 1,
			playMode: "normal",
		};

		const { artists, albums } = generateArtistsAndAlbums(settings);

		expect(artists["Queen"]).toEqual(["track-1", "track-2"]);
		expect(artists["David Bowie"]).toEqual(["track-3"]);
		expect(albums["A Night at the Opera"]).toEqual(["track-1"]);
		expect(albums["Sheer Heart Attack"]).toEqual(["track-2"]);
		expect(albums["Heroes"]).toEqual(["track-3"]);
	});

	it("should trim whitespace around artist and album names", () => {
		const settings: MusicPlayerSettings = {
			tracks: {
				"track-1": {
					id: "track-1",
					path: "music/song1.mp3",
					title: "Song 1",
					artist: "  Pink Floyd  ",
					album: " The Dark Side of the Moon ",
					duration: 250,
					lyrics: "",
				},
			},
			trackIndex: {},
			favorites: [],
			playlists: {},
			artists: {},
			albums: {},
			musicFolder: "",
			volume: 1,
			playbackRate: 1,
			playMode: "normal",
		};

		const { artists, albums } = generateArtistsAndAlbums(settings);
		expect(artists["Pink Floyd"]).toEqual(["track-1"]);
		expect(albums["The Dark Side of the Moon"]).toEqual(["track-1"]);
	});

	it("should handle empty strings or undefined artist/album gracefully", () => {
		const settings: MusicPlayerSettings = {
			tracks: {
				"track-empty": {
					id: "track-empty",
					path: "music/empty.mp3",
					title: "No Meta",
					duration: 100,
					lyrics: "",
				} as any,
			},
			trackIndex: {},
			favorites: [],
			playlists: {},
			artists: {},
			albums: {},
			musicFolder: "",
			volume: 1,
			playbackRate: 1,
			playMode: "normal",
		};

		const { artists, albums } = generateArtistsAndAlbums(settings);
		expect(artists[""]).toEqual(["track-empty"]);
		expect(albums[""]).toEqual(["track-empty"]);
	});

	it("should avoid duplicate track IDs if called repeatedly", () => {
		const settings: MusicPlayerSettings = {
			tracks: {
				"track-1": {
					id: "track-1",
					path: "music/song1.mp3",
					artist: "Artist",
					album: "Album",
				} as any,
			},
			trackIndex: {},
			favorites: [],
			playlists: {},
			artists: {},
			albums: {},
			musicFolder: "",
			volume: 1,
			playbackRate: 1,
			playMode: "normal",
		};

		const result = generateArtistsAndAlbums(settings);
		expect(result.artists["Artist"]).toHaveLength(1);
		expect(result.albums["Album"]).toHaveLength(1);
	});
});
