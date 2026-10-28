import { describe, expect, it } from "vitest";
import { ShuffleManager } from "./shuffle";

describe("ShuffleManager (Non-Repeating Smart Shuffle)", () => {
	it("should initialize unplayed deck containing all other tracks when current playing index provided", () => {
		const manager = new ShuffleManager();
		manager.initialize(5, 2);

		expect(manager.getPlayedCount()).toBe(1);
		expect(manager.getRemainingCount()).toBe(4);
	});

	it("should play every song exactly once without repeating until entire list is exhausted", () => {
		const manager = new ShuffleManager();
		const totalTracks = 10;
		manager.initialize(totalTracks, 0);

		const playedIndices = [0];

		for (let i = 0; i < totalTracks - 1; i++) {
			const next = manager.getNextTrack();
			expect(next).not.toBeNull();
			playedIndices.push(next!);
		}

		// All 10 unique indices must have been played
		expect(new Set(playedIndices).size).toBe(totalTracks);
		expect(manager.getRemainingCount()).toBe(0);

		// Next call must return null (deck exhausted)
		expect(manager.getNextTrack()).toBeNull();
	});

	it("should start a new cycle and avoid repeating the last played song as first of new cycle", () => {
		const manager = new ShuffleManager();
		manager.initialize(4, 0);

		// Play all remaining 3 songs
		const t1 = manager.getNextTrack();
		const t2 = manager.getNextTrack();
		const lastSong = manager.getNextTrack()!;
		expect(manager.getNextTrack()).toBeNull();

		// Start new cycle
		const firstOfNew = manager.startNewCycle();
		expect(firstOfNew).not.toBeNull();
		expect(firstOfNew).not.toBe(lastSong);
	});

	it("should accurately navigate backwards through played history", () => {
		const manager = new ShuffleManager();
		manager.initialize(5, 0);

		const second = manager.getNextTrack()!;
		const third = manager.getNextTrack()!;

		expect(manager.getPreviousTrack()).toBe(second);
		expect(manager.getPreviousTrack()).toBe(0);
		// At beginning of history: returns null
		expect(manager.getPreviousTrack()).toBeNull();
	});

	it("should handle manual track selection by user without repeating played tracks", () => {
		const manager = new ShuffleManager();
		manager.initialize(5, 0); // 0 played, [1, 2, 3, 4] in unplayed deck

		// User clicks track 3
		manager.onTrackSelected(3);

		expect(manager.getPlayedCount()).toBe(2);
		expect(manager.getRemainingCount()).toBe(3);

		// The remaining 3 tracks should not include 0 or 3
		const remaining: number[] = [];
		for (let i = 0; i < 3; i++) {
			remaining.push(manager.getNextTrack()!);
		}

		expect(remaining).not.toContain(0);
		expect(remaining).not.toContain(3);
		expect(new Set(remaining).size).toBe(3);
	});


	it("should handle boundary conditions: 0 or 1 tracks", () => {
		const manager = new ShuffleManager();
		manager.initialize(0);
		expect(manager.getNextTrack()).toBeNull();
		expect(manager.getPreviousTrack()).toBeNull();

		manager.initialize(1, 0);
		expect(manager.getNextTrack()).toBeNull();
		expect(manager.startNewCycle()).toBe(0);
	});

	it("should reset shuffle deck and history on reset()", () => {
		const manager = new ShuffleManager();
		manager.initialize(5, 0);
		manager.getNextTrack();
		manager.reset(5, 2);

		expect(manager.getPlayedCount()).toBe(1);
		expect(manager.getRemainingCount()).toBe(4);
	});

	it("should ignore onTrackSelected when index is out of bounds or identical to current", () => {
		const manager = new ShuffleManager();
		manager.initialize(5, 1);

		// Out of bounds
		manager.onTrackSelected(-1);
		manager.onTrackSelected(99);
		expect(manager.getPlayedCount()).toBe(1);

		// Duplicate of current track (index 1)
		manager.onTrackSelected(1);
		expect(manager.getPlayedCount()).toBe(1);
	});
});
