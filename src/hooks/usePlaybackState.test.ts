// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlaybackState } from "./usePlaybackState";
import type { MusicPlayerView } from "@/views/MusicPlayerView";
import type { ReactPlaybackSnapshot } from "@/types";

describe("usePlaybackState hook", () => {
	let mockView: any;
	let mockAudioEl: any;
	let snapshot: ReactPlaybackSnapshot;

	beforeEach(() => {
		vi.useFakeTimers();

		mockAudioEl = {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		};

		snapshot = {
			title: "Song 1",
			artist: "Queen",
			isPlaying: false,
			currentTime: 0,
			duration: 200,
		} as unknown as ReactPlaybackSnapshot;

		mockView = {
			state: { isPlaying: false },
			audioElement: mockAudioEl,
			getReactPlaybackSnapshot: vi.fn().mockImplementation(() => ({ ...snapshot })),
		} as unknown as MusicPlayerView;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("initializes with current playback snapshot", () => {
		const { result } = renderHook(() => usePlaybackState(mockView));
		expect(result.current.playback.title).toBe("Song 1");
		expect(mockView.getReactPlaybackSnapshot).toHaveBeenCalledTimes(1);
	});

	it("throttles updates when paused", () => {
		const setTimeoutSpy = vi.spyOn(window, "setTimeout");
		const rafSpy = vi.spyOn(window, "requestAnimationFrame");

		renderHook(() => usePlaybackState(mockView));

		expect(setTimeoutSpy).toHaveBeenCalled();
		expect(rafSpy).not.toHaveBeenCalled();

		// Advance timer
		act(() => {
			vi.advanceTimersByTime(1000);
		});

		expect(mockView.getReactPlaybackSnapshot).toHaveBeenCalledTimes(2);
	});

	it("runs 60fps rAF loop when playing on currentDisc tab", () => {
		mockView.state.isPlaying = true;
		const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(123 as any);

		renderHook(() => usePlaybackState(mockView, { activeTab: "currentDisc" }));

		expect(rafSpy).toHaveBeenCalled();
	});

	it("throttles updates when on library tab even if playing", () => {
		mockView.state.isPlaying = true;
		const setTimeoutSpy = vi.spyOn(window, "setTimeout");
		const rafSpy = vi.spyOn(window, "requestAnimationFrame");

		renderHook(() => usePlaybackState(mockView, { activeTab: "library" }));

		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
		expect(rafSpy).not.toHaveBeenCalled();
	});

	it("listens to audio element events for immediate sync", () => {
		expect(mockAudioEl.addEventListener).not.toHaveBeenCalled();

		const { unmount } = renderHook(() => usePlaybackState(mockView));

		expect(mockAudioEl.addEventListener).toHaveBeenCalledWith("play", expect.any(Function));
		expect(mockAudioEl.addEventListener).toHaveBeenCalledWith("pause", expect.any(Function));
		expect(mockAudioEl.addEventListener).toHaveBeenCalledWith("seeked", expect.any(Function));

		// Find the play handler and invoke it
		const playCall = mockAudioEl.addEventListener.mock.calls.find((c: any) => c[0] === "play");
		const playHandler = playCall[1];

		act(() => {
			snapshot.isPlaying = true;
			playHandler();
		});

		expect(mockView.getReactPlaybackSnapshot).toHaveBeenCalled();

		unmount();

		expect(mockAudioEl.removeEventListener).toHaveBeenCalledWith("play", expect.any(Function));
		expect(mockAudioEl.removeEventListener).toHaveBeenCalledWith("pause", expect.any(Function));
		expect(mockAudioEl.removeEventListener).toHaveBeenCalledWith("seeked", expect.any(Function));
	});

	it("handles visibilitychange event to sync when window becomes visible", () => {
		const addEventSpy = vi.spyOn(document, "addEventListener");
		const removeEventSpy = vi.spyOn(document, "removeEventListener");

		const { unmount } = renderHook(() => usePlaybackState(mockView));

		expect(addEventSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

		const visCall = addEventSpy.mock.calls.find((c: any) => c[0] === "visibilitychange");
		const visHandler = visCall[1];

		// Simulate tab becoming visible
		Object.defineProperty(document, "hidden", { value: false, configurable: true });

		act(() => {
			visHandler();
		});

		expect(mockView.getReactPlaybackSnapshot).toHaveBeenCalled();

		unmount();
		expect(removeEventSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
	});
});
