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
		let rafCb: FrameRequestCallback | null = null;
		const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
			rafCb = cb;
			return 123;
		});

		renderHook(() => usePlaybackState(mockView, { activeTab: "currentDisc" }));

		expect(rafSpy).toHaveBeenCalled();
		expect(rafCb).not.toBeNull();

		act(() => {
			vi.advanceTimersByTime(25);
			if (rafCb) {
				rafCb(performance.now());
			}
		});

		expect(mockView.getReactPlaybackSnapshot).toHaveBeenCalled();
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

	it("skips sync when tab becomes hidden during visibilitychange", () => {
		const addEventSpy = vi.spyOn(document, "addEventListener");

		renderHook(() => usePlaybackState(mockView));
		const visCall = addEventSpy.mock.calls.find((c: any) => c[0] === "visibilitychange");
		const visHandler = visCall[1];

		Object.defineProperty(document, "hidden", { value: true, configurable: true });
		mockView.getReactPlaybackSnapshot.mockClear();

		act(() => {
			visHandler();
		});

		// Since document.hidden is true, syncSnapshot should not be called
		expect(mockView.getReactPlaybackSnapshot).not.toHaveBeenCalled();

		Object.defineProperty(document, "hidden", { value: false, configurable: true });
	});

	it("functions safely when view has no audioElement", () => {
		const viewWithoutAudio = {
			...mockView,
			audioElement: null,
		};

		const { unmount } = renderHook(() => usePlaybackState(viewWithoutAudio));
		expect(mockView.getReactPlaybackSnapshot).toHaveBeenCalled();
		expect(() => unmount()).not.toThrow();
	});

	it("skips duplicate snapshot sync if rAF fires within 16ms", () => {
		Object.defineProperty(document, "hidden", { value: false, configurable: true });
		mockView.state.isPlaying = true;
		let rafCb: FrameRequestCallback | null = null;
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
			rafCb = cb;
			return 101;
		});

		renderHook(() => usePlaybackState(mockView, { activeTab: "currentDisc" }));

		// First frame: advances and syncs
		act(() => {
			vi.advanceTimersByTime(20);
			if (rafCb) rafCb(performance.now());
		});
		expect(mockView.getReactPlaybackSnapshot).toHaveBeenCalledTimes(2);

		// Second frame immediately (< 16ms)
		mockView.getReactPlaybackSnapshot.mockClear();
		act(() => {
			if (rafCb) rafCb(performance.now());
		});
		expect(mockView.getReactPlaybackSnapshot).not.toHaveBeenCalled();
	});

	it("cancels active rAF on visibilitychange and unmount when playing on currentDisc", () => {
		Object.defineProperty(document, "hidden", { value: false, configurable: true });
		mockView.state.isPlaying = true;
		const cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame");
		const addEventSpy = vi.spyOn(document, "addEventListener");

		const { unmount } = renderHook(() => usePlaybackState(mockView, { activeTab: "currentDisc" }));

		const visCall = addEventSpy.mock.calls.find((c: any) => c[0] === "visibilitychange");
		const visHandler = visCall[1];

		act(() => {
			visHandler();
		});
		expect(cancelRafSpy).toHaveBeenCalled();

		unmount();
		expect(cancelRafSpy).toHaveBeenCalled();
	});

	it("handles undefined view.state with fallback isPlaying false", () => {
		const viewWithoutState = {
			...mockView,
			state: undefined as any,
		};
		const { result } = renderHook(() => usePlaybackState(viewWithoutState));
		expect(result.current.playback).toBeDefined();
	});
});
