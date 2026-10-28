// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDiscSwitchAnimation } from "./useDiscSwitchAnimation";
import { ANIMATION_TIMINGS } from "@/constants/ui";

describe("useDiscSwitchAnimation hook", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("initializes with provided cover URL and default state", () => {
		const { result } = renderHook(() =>
			useDiscSwitchAnimation({
				isPlaying: false,
				coverUrl: "cover1.jpg",
				workspaceLeafWidth: 400,
			})
		);

		expect(result.current.displayCoverUrl).toBe("cover1.jpg");
		expect(result.current.currentDiscOffset).toBe(0);
		expect(result.current.nextDiscOffset).toBe(0);
		expect(result.current.nextDiscVisible).toBe(false);
		expect(result.current.isAnimating).toBe(false);
		expect(result.current.shouldAnimate).toBe(false);
		expect(result.current.isNeedlePlaying).toBe(false);
	});

	it("animates disc slide transition forward on handleSwitch(true)", async () => {
		const onResetRotation = vi.fn();
		const { result } = renderHook(() =>
			useDiscSwitchAnimation({
				isPlaying: true,
				coverUrl: "cover1.jpg",
				nextCoverUrl: "cover2.jpg",
				workspaceLeafWidth: 500,
				onResetRotation,
			})
		);

		await act(async () => {
			void result.current.handleSwitch(true);
		});

		expect(result.current.isAnimating).toBe(true);
		expect(result.current.nextDiscVisible).toBe(true);
		expect(result.current.nextDiscOffset).toBe(500);

		// Advance past DOM update delay
		act(() => {
			vi.advanceTimersByTime(ANIMATION_TIMINGS.DOM_UPDATE_DELAY + 10);
		});
		expect(result.current.shouldAnimate).toBe(true);
		expect(result.current.currentDiscOffset).toBe(-500);
		expect(result.current.nextDiscOffset).toBe(0);

		// Advance to animation completion
		act(() => {
			vi.advanceTimersByTime(
				ANIMATION_TIMINGS.DISC_ANIMATION_DURATION + ANIMATION_TIMINGS.DISC_ANIMATION_BUFFER
			);
		});

		expect(result.current.isAnimating).toBe(false);
		expect(result.current.nextDiscVisible).toBe(false);
		expect(onResetRotation).toHaveBeenCalled();
	});

	it("animates disc slide transition backward on handleSwitch(false)", async () => {
		const { result } = renderHook(() =>
			useDiscSwitchAnimation({
				isPlaying: true,
				coverUrl: "cover2.jpg",
				prevCoverUrl: "cover1.jpg",
				workspaceLeafWidth: 500,
			})
		);

		await act(async () => {
			void result.current.handleSwitch(false);
		});

		expect(result.current.isAnimating).toBe(true);
		expect(result.current.nextDiscOffset).toBe(-500);

		// Advance to finish
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(result.current.isAnimating).toBe(false);
	});

	it("does not start animation if workspaceLeafWidth is 0", async () => {
		const { result } = renderHook(() =>
			useDiscSwitchAnimation({
				isPlaying: true,
				coverUrl: "cover1.jpg",
				workspaceLeafWidth: 0,
			})
		);

		await act(async () => {
			await result.current.handleSwitch(true);
		});

		expect(result.current.isAnimating).toBe(false);
	});

	it("handles track and cover change props without slide if lastAction is null", () => {
		const onResetRotation = vi.fn();
		const { result, rerender } = renderHook(
			(props) => useDiscSwitchAnimation(props),
			{
				initialProps: {
					isPlaying: false,
					coverUrl: "cover1.jpg",
					trackKey: "track-1",
					lastAction: null,
					workspaceLeafWidth: 400,
					onResetRotation,
				},
			}
		);

		expect(result.current.displayCoverUrl).toBe("cover1.jpg");

		// Change trackKey
		rerender({
			isPlaying: false,
			coverUrl: "cover2.jpg",
			trackKey: "track-2",
			lastAction: null,
			workspaceLeafWidth: 400,
			onResetRotation,
		});

		expect(result.current.displayCoverUrl).toBe("cover2.jpg");
		expect(result.current.isAnimating).toBe(false);
		expect(onResetRotation).toHaveBeenCalled();
	});

	it("cleans up active timers upon unmount", async () => {
		const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
		const { result, unmount } = renderHook(() =>
			useDiscSwitchAnimation({
				isPlaying: true,
				coverUrl: "cover1.jpg",
				nextCoverUrl: "cover2.jpg",
				workspaceLeafWidth: 400,
			})
		);

		await act(async () => {
			void result.current.handleSwitch(true);
		});

		unmount();
		expect(clearTimeoutSpy).toHaveBeenCalled();
	});

	it("returns early without resetting rotation if wantsSlide is true and workspaceLeafWidth is 0", () => {
		const onResetRotation = vi.fn();
		const { rerender } = renderHook(
			(props) => useDiscSwitchAnimation(props),
			{
				initialProps: {
					isPlaying: false,
					coverUrl: "cover1.jpg",
					trackKey: "track-1",
					lastAction: "next" as const,
					workspaceLeafWidth: 0,
					onResetRotation,
				},
			}
		);

		rerender({
			isPlaying: false,
			coverUrl: "cover1.jpg",
			trackKey: "track-2",
			lastAction: "next" as const,
			workspaceLeafWidth: 0,
			onResetRotation,
		});

		expect(onResetRotation).not.toHaveBeenCalled();
	});

	it("updates refs when cover or track changes while animating", async () => {
		const { result, rerender } = renderHook(
			(props) => useDiscSwitchAnimation(props),
			{
				initialProps: {
					isPlaying: true,
					coverUrl: "cover1.jpg",
					nextCoverUrl: "cover2.jpg",
					trackKey: "track-1",
					workspaceLeafWidth: 400,
				},
			}
		);

		await act(async () => {
			void result.current.handleSwitch(true);
		});

		expect(result.current.isAnimating).toBe(true);

		rerender({
			isPlaying: true,
			coverUrl: "cover-new.jpg",
			nextCoverUrl: "cover2.jpg",
			trackKey: "track-new",
			workspaceLeafWidth: 400,
		});

		expect(result.current.isAnimating).toBe(true);
	});

	it("automatically triggers handleSwitch when trackKey changes with lastAction next", () => {
		const { result, rerender } = renderHook(
			(props) => useDiscSwitchAnimation(props),
			{
				initialProps: {
					isPlaying: true,
					coverUrl: "cover1.jpg",
					nextCoverUrl: "cover2.jpg",
					trackKey: "t1",
					lastAction: null as "next" | "prev" | null,
					workspaceLeafWidth: 400,
				},
			}
		);

		rerender({
			isPlaying: true,
			coverUrl: "cover2.jpg",
			nextCoverUrl: "cover3.jpg",
			trackKey: "t2",
			lastAction: "next",
			workspaceLeafWidth: 400,
		});

		expect(result.current.isAnimating).toBe(true);
	});

	it("resolves preloadCoverImage even if image loading errors", async () => {
		const origImage = globalThis.Image;
		try {
			(globalThis as any).Image = class {
				onload: (() => void) | null = null;
				onerror: (() => void) | null = null;
				complete = false;
				set src(_v: string) {
					queueMicrotask(() => this.onerror?.());
				}
			};

			const { result } = renderHook(() =>
				useDiscSwitchAnimation({
					isPlaying: true,
					coverUrl: "corrupt.jpg",
					nextCoverUrl: "corrupt2.jpg",
					workspaceLeafWidth: 400,
				})
			);

			await act(async () => {
				await result.current.handleSwitch(true);
			});

			expect(result.current.isAnimating).toBe(true);
		} finally {
			(globalThis as any).Image = origImage;
		}
	});
});
