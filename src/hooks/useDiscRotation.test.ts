// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDiscRotation } from "./useDiscRotation";

describe("useDiscRotation hook", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("initializes with rotationAngle 0 and provides currentDiscRef and resetRotation", () => {
		const { result } = renderHook(() => useDiscRotation({ isPlaying: false }));
		expect(result.current.rotationAngle).toBe(0);
		expect(result.current.currentDiscRef.current).toBeNull();
		expect(typeof result.current.resetRotation).toBe("function");
	});

	it("does not spin or schedule rAF updates when paused", () => {
		const rafSpy = vi.spyOn(window, "requestAnimationFrame");
		const { result } = renderHook(() => useDiscRotation({ isPlaying: false }));

		act(() => {
			vi.advanceTimersByTime(2000);
		});

		expect(result.current.rotationAngle).toBe(0);
		expect(rafSpy).not.toHaveBeenCalled();
	});

	it("rotates disc continuously when isPlaying is true and element ref is attached", () => {
		let rafCallback: FrameRequestCallback | null = null;
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
			rafCallback = cb;
			return 123;
		});

		const { result, rerender } = renderHook(
			({ isPlaying }) => useDiscRotation({ isPlaying }),
			{ initialProps: { isPlaying: true } }
		);

		// Attach DOM ref to simulate disc element
		const mockDiv = document.createElement("div");
		Object.defineProperty(result.current.currentDiscRef, "current", {
			value: mockDiv,
			writable: true,
		});

		// Advance time by 5000ms (1/4 turn = 90 deg)
		act(() => {
			vi.advanceTimersByTime(5000);
			if (rafCallback) {
				rafCallback(performance.now());
			}
		});

		expect(result.current.rotationAngle).toBeGreaterThan(0);
		const angleAfter5s = result.current.rotationAngle;

		// Pause playback
		rerender({ isPlaying: false });
		expect(result.current.rotationAngle).toBe(angleAfter5s);

		// Reset rotation
		act(() => {
			result.current.resetRotation();
		});
		expect(result.current.rotationAngle).toBe(0);
	});

	it("restarts animation frame on resetRotation if playing", () => {
		const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
		const { result } = renderHook(() => useDiscRotation({ isPlaying: true }));

		act(() => {
			result.current.resetRotation();
		});

		expect(result.current.rotationAngle).toBe(0);
		expect(rafSpy).toHaveBeenCalled();
	});

	it("cancels animation frame when switching from playing to paused and upon unmount", () => {
		let rafId = 999;
		vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => rafId);
		const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");

		const { rerender, unmount } = renderHook(
			({ isPlaying }) => useDiscRotation({ isPlaying }),
			{ initialProps: { isPlaying: true } }
		);

		rerender({ isPlaying: false });
		expect(cancelSpy).toHaveBeenCalledWith(rafId);

		// Switch back to playing then unmount
		rafId = 1000;
		rerender({ isPlaying: true });
		unmount();
		expect(cancelSpy).toHaveBeenCalledWith(1000);
	});
});
