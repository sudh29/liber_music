import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import {
	findTrackIndexInGlobalList,
	getNextIndex,
	getPreviousIndex,
	handleTrackEnd,
	togglePlayMode,
} from "./control";
import { ShuffleManager } from "./shuffle";


describe("playback/control utilities", () => {
	const mockFiles = [
		new TFile("music/track1.mp3", "track1.mp3"),
		new TFile("music/track2.mp3", "track2.mp3"),
		new TFile("music/track3.mp3", "track3.mp3"),
	];

	describe("getPreviousIndex", () => {
		it("should decrement index sequentially in normal mode", () => {
			expect(getPreviousIndex(2, mockFiles, "normal")).toBe(1);
			expect(getPreviousIndex(1, mockFiles, "normal")).toBe(0);
		});

		it("should wrap to last track from index 0 in normal mode", () => {
			expect(getPreviousIndex(0, mockFiles, "normal")).toBe(2);
		});

		it("should wrap to last track from index 0 in repeat-all mode", () => {
			expect(getPreviousIndex(0, mockFiles, "repeat-all")).toBe(2);
			expect(getPreviousIndex(1, mockFiles, "repeat-all")).toBe(0);
		});

		it("should pick a random index in shuffle mode", () => {
			vi.spyOn(Math, "random").mockReturnValue(0.4);
			const idx = getPreviousIndex(1, mockFiles, "shuffle");
			expect(idx).toBe(1); // floor(0.4 * 3) = 1
			vi.restoreAllMocks();
		});

		it("should handle single item list gracefully", () => {
			const singleList = [mockFiles[0]!];
			expect(getPreviousIndex(0, singleList, "normal")).toBe(0);
		});

		it("should use shuffleManager in getPreviousIndex when shuffle is active", () => {
			const manager = new ShuffleManager();
			manager.initialize(mockFiles.length, 0);
			// Advance to next track so previous track exists in history
			const nextIdx = manager.getNextTrack();
			expect(nextIdx).not.toBeNull();

			const prev = getPreviousIndex(nextIdx!, mockFiles, "normal", true, manager);
			expect(prev).toBe(0); // returned to previous track
		});
	});

	describe("getNextIndex", () => {
		it("should increment index sequentially in normal mode", () => {
			expect(getNextIndex(0, mockFiles, "normal")).toBe(1);
			expect(getNextIndex(1, mockFiles, "normal")).toBe(2);
		});

		it("should wrap to 0 from the last index in normal mode", () => {
			expect(getNextIndex(2, mockFiles, "normal")).toBe(0);
		});

		it("should wrap to 0 from the last index in repeat-all mode", () => {
			expect(getNextIndex(2, mockFiles, "repeat-all")).toBe(0);
		});

		it("should pick a random index in shuffle mode", () => {
			vi.spyOn(Math, "random").mockReturnValue(0.7);
			const idx = getNextIndex(0, mockFiles, "shuffle");
			expect(idx).toBe(2); // floor(0.7 * 3) = 2
			vi.restoreAllMocks();
		});

		it("should handle single item list gracefully", () => {
			const singleList = [mockFiles[0]!];
			expect(getNextIndex(0, singleList, "normal")).toBe(0);
		});

		it("should auto-initialize uninitialized shuffleManager and return valid next track", () => {
			const manager = new ShuffleManager(); // totalCount is 0
			const nextIdx = getNextIndex(0, mockFiles, "normal", true, manager);
			expect(nextIdx).toBeGreaterThanOrEqual(0);
			expect(nextIdx).toBeLessThan(mockFiles.length);
			expect(nextIdx).not.toBe(0); // Should not repeat current track
			expect(manager.getTotalCount()).toBe(mockFiles.length);
		});

		it("should cycle into a new deck when deck is exhausted on Next click", () => {
			const manager = new ShuffleManager();
			manager.initialize(mockFiles.length, 0);
			// Exhaust the deck
			while (manager.getRemainingCount() > 0) {
				manager.getNextTrack();
			}
			expect(manager.getRemainingCount()).toBe(0);

			const nextIdx = getNextIndex(2, mockFiles, "normal", true, manager);
			expect(nextIdx).toBeGreaterThanOrEqual(0);
			expect(nextIdx).toBeLessThan(mockFiles.length);
		});
	});


	describe("handleTrackEnd", () => {
		it("should repeat current track in repeat-one mode", () => {
			const result = handleTrackEnd("repeat-one", 1, mockFiles);
			expect(result).toEqual({
				shouldPlayNext: false,
				shouldRepeat: true,
				shouldStop: false,
			});
		});

		it("should always play next in repeat-all mode even at the end of list", () => {
			const result = handleTrackEnd("repeat-all", 2, mockFiles);
			expect(result).toEqual({
				shouldPlayNext: true,
				shouldRepeat: false,
				shouldStop: false,
			});
		});

		it("should play next when not at the end of list in normal mode", () => {
			const result = handleTrackEnd("normal", 0, mockFiles);
			expect(result).toEqual({
				shouldPlayNext: true,
				shouldRepeat: false,
				shouldStop: false,
			});
		});

		it("should stop playback when at the end of list in normal mode", () => {
			const result = handleTrackEnd("normal", 2, mockFiles);
			expect(result).toEqual({
				shouldPlayNext: false,
				shouldRepeat: false,
				shouldStop: true,
			});
		});

		it("should always play next in shuffle mode", () => {
			const result = handleTrackEnd("shuffle", 2, mockFiles);
			expect(result).toEqual({
				shouldPlayNext: true,
				shouldRepeat: false,
				shouldStop: false,
			});
		});

		it("should stop playback on unrecognized playMode", () => {
			const result = handleTrackEnd("unknown" as any, 0, mockFiles);
			expect(result).toEqual({
				shouldPlayNext: false,
				shouldRepeat: false,
				shouldStop: true,
			});
		});

		it("should handle shuffleManager in handleTrackEnd when deck has remaining tracks", () => {
			const manager = new ShuffleManager();
			manager.initialize(mockFiles.length, 0);
			// 2 tracks remaining
			const res = handleTrackEnd("normal", 0, mockFiles, true, manager);
			expect(res).toEqual({ shouldPlayNext: true, shouldRepeat: false, shouldStop: false });
		});

		it("should handle shuffleManager in handleTrackEnd when deck is exhausted in repeat-all mode", () => {
			const manager = new ShuffleManager();
			manager.initialize(mockFiles.length, 0);
			while (manager.getRemainingCount() > 0) {
				manager.getNextTrack();
			}
			const res = handleTrackEnd("repeat-all", 2, mockFiles, true, manager);
			expect(res).toEqual({ shouldPlayNext: true, shouldRepeat: false, shouldStop: false });
		});

		it("should handle shuffleManager in handleTrackEnd when deck is exhausted in normal mode (should stop)", () => {
			const manager = new ShuffleManager();
			manager.initialize(mockFiles.length, 0);
			while (manager.getRemainingCount() > 0) {
				manager.getNextTrack();
			}
			const res = handleTrackEnd("normal", 2, mockFiles, true, manager);
			expect(res).toEqual({ shouldPlayNext: false, shouldRepeat: false, shouldStop: true });
		});

		it("should return shouldStop for unhandled playback modes", () => {
			const res = handleTrackEnd("custom" as any, 0, mockFiles, false);
			expect(res).toEqual({ shouldPlayNext: false, shouldRepeat: false, shouldStop: true });
		});
	});

	describe("togglePlayMode", () => {
		it("should cycle through repeat modes sequentially", () => {
			expect(togglePlayMode("normal")).toBe("repeat-all");
			expect(togglePlayMode("repeat-all")).toBe("repeat-one");
			expect(togglePlayMode("repeat-one")).toBe("normal");
			expect(togglePlayMode("shuffle" as any)).toBe("normal");
		});

		it("should reset to normal mode when given an unrecognized mode", () => {
			expect(togglePlayMode("invalid" as any)).toBe("normal");
		});
	});

	describe("findTrackIndexInGlobalList", () => {
		it("should locate track index by path match", () => {
			const target = new TFile("music/track2.mp3");
			expect(findTrackIndexInGlobalList(target, mockFiles)).toBe(1);
		});

		it("should return -1 when track is not present in list", () => {
			const notInList = new TFile("music/track99.mp3");
			expect(findTrackIndexInGlobalList(notInList, mockFiles)).toBe(-1);
		});

		it("should return -1 when list is empty", () => {
			const target = new TFile("music/track1.mp3");
			expect(findTrackIndexInGlobalList(target, [])).toBe(-1);
		});
	});
});
