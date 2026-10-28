// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTrackCovers } from "./useTrackCovers";
import type { MusicPlayerView } from "@/views/MusicPlayerView";
import type { ReactPlaybackSnapshot } from "@/types";

describe("useTrackCovers hook", () => {
	function createMockView() {
		const track1 = { path: "music/track1.mp3", title: "Track 1" } as any;
		const track2 = { path: "music/track2.mp3", title: "Track 2" } as any;
		const track3 = { path: "music/track3.mp3", title: "Track 3" } as any;

		const view = {
			state: {
				trackList: [track1, track2, track3],
			},
			getTrackCoverAsync: vi.fn().mockImplementation(async (track) => {
				if (track.path === "music/track1.mp3") return "embedded://cover1.jpg";
				if (track.path === "music/track2.mp3") return "embedded://cover2.jpg";
				if (track.path === "music/track3.mp3") return "embedded://cover3.jpg";
				return undefined;
			}),
		} as unknown as MusicPlayerView;

		return { view, track1, track2, track3 };
	}

	it("uses playback provided cover URLs directly when present", () => {
		const { view } = createMockView();
		const playback: ReactPlaybackSnapshot = {
			currentPath: "music/track1.mp3",
			coverUrl: "dir://track1.jpg",
			prevCoverUrl: "dir://track3.jpg",
			nextCoverUrl: "dir://track2.jpg",
		} as any;

		const { result } = renderHook(() => useTrackCovers({ playback, view }));

		expect(result.current.finalCoverUrl).toBe("dir://track1.jpg");
		expect(result.current.finalPrevCoverUrl).toBe("dir://track3.jpg");
		expect(result.current.finalNextCoverUrl).toBe("dir://track2.jpg");
		expect(view.getTrackCoverAsync).not.toHaveBeenCalled();
	});

	it("falls back to view.getTrackCoverAsync for embedded covers when playback cover URLs are missing", async () => {
		const { view } = createMockView();
		const playback: ReactPlaybackSnapshot = {
			currentPath: "music/track2.mp3",
			coverUrl: undefined,
			prevCoverUrl: undefined,
			nextCoverUrl: undefined,
		} as any;

		const { result } = renderHook(() => useTrackCovers({ playback, view }));

		// Wait for microtasks
		await act(async () => {
			await Promise.resolve();
		});

		expect(result.current.finalCoverUrl).toBe("embedded://cover2.jpg");
		// Track 2 prev is Track 1
		expect(result.current.finalPrevCoverUrl).toBe("embedded://cover1.jpg");
		// Track 2 next is Track 3
		expect(result.current.finalNextCoverUrl).toBe("embedded://cover3.jpg");
		expect(view.getTrackCoverAsync).toHaveBeenCalledTimes(3);
	});

	it("wraps around edges: track 1 prev wraps to last track, last track next wraps to first track", async () => {
		const { view } = createMockView();
		const playback: ReactPlaybackSnapshot = {
			currentPath: "music/track1.mp3",
		} as any;

		const { result } = renderHook(() => useTrackCovers({ playback, view }));

		await act(async () => {
			await Promise.resolve();
		});

		expect(result.current.finalCoverUrl).toBe("embedded://cover1.jpg");
		// Track 1 prev wraps to Track 3
		expect(result.current.finalPrevCoverUrl).toBe("embedded://cover3.jpg");
		// Track 1 next is Track 2
		expect(result.current.finalNextCoverUrl).toBe("embedded://cover2.jpg");
	});

	it("handles missing or empty currentPath gracefully", () => {
		const { view } = createMockView();
		const playback: ReactPlaybackSnapshot = {
			currentPath: undefined,
		} as any;

		const { result } = renderHook(() => useTrackCovers({ playback, view }));

		expect(result.current.finalCoverUrl).toBeUndefined();
		expect(result.current.finalPrevCoverUrl).toBeUndefined();
		expect(result.current.finalNextCoverUrl).toBeUndefined();
	});
});
