// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePlaybackControl } from "./usePlaybackControl";
import type { MusicPlayerView } from "@/views/MusicPlayerView";

describe("usePlaybackControl hook", () => {
	function createMockView() {
		const view = {
			togglePlay: vi.fn().mockResolvedValue(undefined),
			playPrevious: vi.fn().mockResolvedValue(undefined),
			playNext: vi.fn().mockResolvedValue(undefined),
			togglePlayMode: vi.fn().mockResolvedValue(undefined),
			toggleShuffle: vi.fn().mockResolvedValue(true),
			toggleArtworkDisplayMode: vi.fn().mockResolvedValue("card"),
			setRating: vi.fn().mockResolvedValue(undefined),
			seekToRatio: vi.fn(),
			seekForward: vi.fn(),
			seekBackward: vi.fn(),
			openPlaylistSheet: vi.fn().mockResolvedValue(undefined),
			openSearchModalPublic: vi.fn(),
		} as unknown as MusicPlayerView;

		return { view };
	}

	it("delegates playback control actions to view methods", async () => {
		const { view } = createMockView();
		const { result } = renderHook(() => usePlaybackControl(view));

		await result.current.togglePlay();
		expect(view.togglePlay).toHaveBeenCalledTimes(1);

		await result.current.playPrevious();
		expect(view.playPrevious).toHaveBeenCalledTimes(1);

		await result.current.playNext();
		expect(view.playNext).toHaveBeenCalledTimes(1);

		await result.current.togglePlayMode();
		expect(view.togglePlayMode).toHaveBeenCalledTimes(1);

		const shuffleRes = await result.current.toggleShuffle();
		expect(shuffleRes).toBe(true);
		expect(view.toggleShuffle).toHaveBeenCalledTimes(1);

		const artRes = await result.current.toggleArtworkDisplayMode();
		expect(artRes).toBe("card");
		expect(view.toggleArtworkDisplayMode).toHaveBeenCalledTimes(1);

		await result.current.setRating("music/song.mp3", 5);
		expect(view.setRating).toHaveBeenCalledWith("music/song.mp3", 5);

		result.current.seekToRatio(0.5);
		expect(view.seekToRatio).toHaveBeenCalledWith(0.5);

		result.current.seekForward(10);
		expect(view.seekForward).toHaveBeenCalledWith(10);

		result.current.seekBackward(10);
		expect(view.seekBackward).toHaveBeenCalledWith(10);

		await result.current.openPlaylistSheet();
		expect(view.openPlaylistSheet).toHaveBeenCalledTimes(1);

		result.current.openSearchModal();
		expect(view.openSearchModalPublic).toHaveBeenCalledTimes(1);
	});
});
