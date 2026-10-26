import { describe, expect, it } from "vite-plus/test";
import { generateTrackId, getOrCreateTrackId, getTrackPath, isValidTrackId } from "./id";

describe("track id utility", () => {
	it("should generate deterministic 16-character hex track IDs", () => {
		const id1 = generateTrackId("Music/Jazz/take5.mp3");
		const id2 = generateTrackId("Music/Jazz/take5.mp3");
		const id3 = generateTrackId("Music/Rock/bohemian.flac");

		expect(id1).toBe(id2);
		expect(id1.length).toBe(16);
		expect(id1).not.toBe(id3);
	});

	it("should register new path and retrieve existing track ID in settings", () => {
		const settings = { trackIndex: {} as Record<string, string> };

		const id = getOrCreateTrackId("Music/Pop/song.mp3", settings);
		expect(id).toBeDefined();
		expect(settings.trackIndex[id]).toBe("Music/Pop/song.mp3");

		// Fetching same path should reuse existing ID
		const idAgain = getOrCreateTrackId("Music/Pop/song.mp3", settings);
		expect(idAgain).toBe(id);

		// Helper getters
		expect(getTrackPath(id, settings)).toBe("Music/Pop/song.mp3");
		expect(isValidTrackId(id, settings)).toBe(true);
		expect(isValidTrackId("non-existent-id", settings)).toBe(false);
		expect(getTrackPath("non-existent-id", settings)).toBeNull();
	});
});
