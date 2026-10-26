// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
	useLyricsIndex,
	useNavigation,
	usePageState,
	usePlaybackControl,
} from "@/hooks";
import type { MusicPlayerView } from "@/views/MusicPlayerView";

describe("React Hooks", () => {
	describe("usePageState", () => {
		it("should manage lastAction transitions", () => {
			const { result } = renderHook(() => usePageState());
			expect(result.current.lastAction).toBeNull();

			const onNext = vi.fn();
			act(() => {
				result.current.handleNextWithFlag(onNext);
			});
			expect(result.current.lastAction).toBe("next");
			expect(onNext).toHaveBeenCalledTimes(1);

			const onPrev = vi.fn();
			act(() => {
				result.current.handlePrevWithFlag(onPrev);
			});
			expect(result.current.lastAction).toBe("prev");
			expect(onPrev).toHaveBeenCalledTimes(1);

			act(() => {
				result.current.clearLastAction();
			});
			expect(result.current.lastAction).toBeNull();
		});
	});

	describe("useNavigation", () => {
		it("should manage tab and page switching", () => {
			const { result } = renderHook(() => useNavigation());
			expect(result.current.tab).toBe("currentDisc");
			expect(result.current.currentPage).toBe("disc");

			act(() => {
				result.current.openLibrary();
			});
			expect(result.current.tab).toBe("library");

			act(() => {
				result.current.switchToLyrics();
			});
			expect(result.current.currentPage).toBe("lyrics");
			expect(result.current.shouldMarkInitialLyricsMount).toBe(true);

			act(() => {
				result.current.switchToDisc();
			});
			expect(result.current.currentPage).toBe("disc");
		});
	});

	describe("useLyricsIndex", () => {
		it("should calculate active lyric line index based on playback time", () => {
			const fullLyrics = [
				{ time: 10, text: "Line 1" },
				{ time: 20, text: "Line 2" },
				{ time: 30, text: "Line 3" },
			];

			const { result, rerender } = renderHook(
				({ time }) =>
					useLyricsIndex({
						fullLyrics,
						fullExtendedLyrics: [],
						currentTime: time,
					}),
				{ initialProps: { time: 5 } }
			);

			expect(result.current).toBe(-1); // before first lyric

			rerender({ time: 12 });
			expect(result.current).toBe(0); // at first lyric

			rerender({ time: 25 });
			expect(result.current).toBe(1); // at second lyric

			rerender({ time: 35 });
			expect(result.current).toBe(2); // at third lyric
		});
	});

	describe("usePlaybackControl", () => {
		it("should delegate control actions to the MusicPlayerView", async () => {
			const mockView = {
				togglePlay: vi.fn().mockResolvedValue(undefined),
				playPrevious: vi.fn().mockResolvedValue(undefined),
				playNext: vi.fn().mockResolvedValue(undefined),
				togglePlayMode: vi.fn().mockResolvedValue(undefined),
				seekToRatio: vi.fn(),
				seekForward: vi.fn(),
				seekBackward: vi.fn(),
				openPlaylistSheet: vi.fn().mockResolvedValue(undefined),
				openSearchModalPublic: vi.fn(),
			} as unknown as MusicPlayerView;

			const { result } = renderHook(() => usePlaybackControl(mockView));

			await act(async () => {
				await result.current.togglePlay();
				await result.current.playNext();
				await result.current.playPrevious();
				await result.current.togglePlayMode();
				result.current.seekToRatio(0.5);
				result.current.seekForward(5);
				result.current.seekBackward(5);
				await result.current.openPlaylistSheet();
				result.current.openSearchModal();
			});

			expect(mockView.togglePlay).toHaveBeenCalledTimes(1);
			expect(mockView.playNext).toHaveBeenCalledTimes(1);
			expect(mockView.playPrevious).toHaveBeenCalledTimes(1);
			expect(mockView.togglePlayMode).toHaveBeenCalledTimes(1);
			expect(mockView.seekToRatio).toHaveBeenCalledWith(0.5);
			expect(mockView.seekForward).toHaveBeenCalledWith(5);
			expect(mockView.seekBackward).toHaveBeenCalledWith(5);
			expect(mockView.openPlaylistSheet).toHaveBeenCalledTimes(1);
			expect((mockView as any).openSearchModalPublic).toHaveBeenCalledTimes(1);
		});
	});
});
