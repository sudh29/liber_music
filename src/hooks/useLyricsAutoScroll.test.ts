// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLyricsAutoScroll } from "./useLyricsAutoScroll";
import type { LyricLine } from "@/utils/lyrics/parser";

describe("useLyricsAutoScroll hook", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Obsidian HTMLElement helper polyfill
		if (!HTMLElement.prototype.setCssProps) {
			(HTMLElement.prototype as any).setCssProps = function (props: Record<string, string>) {
				Object.assign(this.style, props);
			};
		}
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	function createMockContainer(lineCount: number) {
		const container = document.createElement("div");
		container.style.height = "400px";
		Object.defineProperty(container, "clientHeight", { value: 400, configurable: true });
		Object.defineProperty(container, "scrollTop", { value: 0, writable: true, configurable: true });
		container.scrollTo = vi.fn().mockImplementation(({ top }) => {
			container.scrollTop = top;
		});
		container.getBoundingClientRect = vi.fn().mockReturnValue({
			top: 0,
			height: 400,
			bottom: 400,
		} as DOMRect);

		const lineElements: HTMLDivElement[] = [];
		for (let i = 0; i < lineCount; i++) {
			const line = document.createElement("div");
			line.style.height = "30px";
			line.getBoundingClientRect = vi.fn().mockReturnValue({
				top: i * 40,
				height: 30,
				bottom: i * 40 + 30,
			} as DOMRect);
			container.appendChild(line);
			lineElements.push(line);
		}

		return { container, lineElements };
	}

	it("initializes refs and resizes lineRefs based on lyrics length", () => {
		const lyrics: LyricLine[] = [
			{ time: 1.0, text: "Line 1" },
			{ time: 5.0, text: "Line 2" },
			{ time: 9.0, text: "Line 3" },
		];

		const { result } = renderHook(() =>
			useLyricsAutoScroll({
				viewMode: "lyrics",
				lyricsToUse: lyrics,
				playingIndex: 0,
			})
		);

		expect(result.current.scrollRef.current).toBeNull();
		expect(result.current.lineRefs.current).toHaveLength(3);
	});

	it("does not auto-scroll when in disc mode", () => {
		const lyrics: LyricLine[] = [{ time: 1.0, text: "Line 1" }];
		const { result } = renderHook(() =>
			useLyricsAutoScroll({
				viewMode: "disc",
				lyricsToUse: lyrics,
				playingIndex: 0,
			})
		);

		expect(result.current.lineRefs.current).toEqual([]);
	});

	it("smooth-scrolls active line to center when playingIndex updates", () => {
		const lyrics: LyricLine[] = [
			{ time: 1.0, text: "Line 1" },
			{ time: 5.0, text: "Line 2" },
			{ time: 9.0, text: "Line 3" },
		];
		const { container, lineElements } = createMockContainer(3);

		const { result, rerender } = renderHook(
			({ playingIndex }) =>
				useLyricsAutoScroll({
					viewMode: "lyrics",
					lyricsToUse: lyrics,
					playingIndex,
				}),
			{ initialProps: { playingIndex: 0 } }
		);

		// Attach DOM elements
		Object.defineProperty(result.current.scrollRef, "current", {
			value: container,
			writable: true,
		});
		result.current.lineRefs.current = lineElements;

		// Update to line index 2
		rerender({ playingIndex: 2 });

		act(() => {
			vi.advanceTimersByTime(50);
		});

		expect(container.scrollTo).toHaveBeenCalledWith({
			top: expect.any(Number),
			behavior: "smooth",
		});
	});

	it("pauses auto-scroll on wheel interaction and resumes after 500ms idle", () => {
		const lyrics: LyricLine[] = [
			{ time: 1.0, text: "Line 1" },
			{ time: 5.0, text: "Line 2" },
		];
		const { container, lineElements } = createMockContainer(2);

		const { result, rerender } = renderHook(
			({ playingIndex }) =>
				useLyricsAutoScroll({
					viewMode: "lyrics",
					lyricsToUse: lyrics,
					playingIndex,
				}),
			{ initialProps: { playingIndex: 0 } }
		);

		Object.defineProperty(result.current.scrollRef, "current", {
			value: container,
			writable: true,
		});
		result.current.lineRefs.current = lineElements;

		// Dispatch wheel event to pause
		act(() => {
			container.dispatchEvent(new Event("wheel"));
		});

		// While user interaction is paused, update playing index
		rerender({ playingIndex: 1 });

		// Advance timer past 500ms to trigger resume
		act(() => {
			vi.advanceTimersByTime(600);
		});

		expect(container.scrollTo).toHaveBeenCalled();
	});

	it("completes initial mount scroll callback when isInitialMount is true", () => {
		const lyrics: LyricLine[] = [{ time: 1.0, text: "Line 1" }];
		const { container, lineElements } = createMockContainer(1);
		const onInitialMountComplete = vi.fn();

		const rafCallbacks: FrameRequestCallback[] = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});

		const { result } = renderHook(() =>
			useLyricsAutoScroll({
				viewMode: "lyrics",
				lyricsToUse: lyrics,
				playingIndex: 0,
				isInitialMount: true,
				onInitialMountComplete,
			})
		);

		Object.defineProperty(result.current.scrollRef, "current", {
			value: container,
			writable: true,
		});
		result.current.lineRefs.current = lineElements;

		// Flush nested rAF
		act(() => {
			while (rafCallbacks.length > 0) {
				const cb = rafCallbacks.shift();
				cb?.(performance.now());
			}
			vi.advanceTimersByTime(50);
		});

		expect(onInitialMountComplete).toHaveBeenCalled();
	});
});
