// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLazyTrackCovers } from "./useLazyTrackCovers";
import { App, TFile } from "obsidian";
import type { ReactTrackInfo } from "@/types";

describe("useLazyTrackCovers hook", () => {
	let mockObserverInstance: any;
	let observerCallback: any;

	beforeEach(() => {
		vi.useFakeTimers();

		mockObserverInstance = {
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn(),
		};

		class MockIntersectionObserver {
			observe = mockObserverInstance.observe;
			unobserve = mockObserverInstance.unobserve;
			disconnect = mockObserverInstance.disconnect;
			constructor(cb: any) {
				observerCallback = cb;
			}
		}

		global.IntersectionObserver = MockIntersectionObserver as any;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("initializes trackRefs map matching tracks length", () => {
		const tracks: ReactTrackInfo[] = [
			{ path: "song1.mp3", title: "Song 1" },
			{ path: "song2.mp3", title: "Song 2" },
		];

		const { result } = renderHook(() =>
			useLazyTrackCovers({
				tracks,
			})
		);

		expect(result.current.trackRefs.size).toBe(2);
		expect(result.current.trackRefs.has("song1.mp3")).toBe(true);
		expect(result.current.trackRefs.has("song2.mp3")).toBe(true);
	});

	it("observes track elements and loads covers on intersection", async () => {
		const app = new App();
		const file = new TFile("song1.mp3");
		vi.spyOn(app.vault, "getAbstractFileByPath").mockReturnValue(file);

		const getTrackCover = vi.fn().mockResolvedValue("data:image/jpeg;base64,mock123");

		const tracks: ReactTrackInfo[] = [
			{ path: "song1.mp3", title: "Song 1", album: "Rock Album" },
		];

		const { result } = renderHook(() =>
			useLazyTrackCovers({
				tracks,
				app,
				getTrackCover,
			})
		);

		// Attach mock DOM element
		const div = document.createElement("div");
		div.setAttribute("data-track-path", "song1.mp3");
		const ref = result.current.trackRefs.get("song1.mp3");
		if (ref) {
			Object.defineProperty(ref, "current", { value: div, writable: true });
		}

		// Trigger intersection
		act(() => {
			observerCallback([
				{
					isIntersecting: true,
					target: div,
				},
			]);
		});

		// Advance timer for batch flush (50ms)
		await act(async () => {
			vi.advanceTimersByTime(100);
			await Promise.resolve();
		});

		expect(getTrackCover).toHaveBeenCalledWith(file);
		expect(mockObserverInstance.unobserve).toHaveBeenCalledWith(div);
	});

	it("stops loading and clears pending queue when stopLoading is called", () => {
		const { result } = renderHook(() =>
			useLazyTrackCovers({
				tracks: [{ path: "song1.mp3", title: "Song 1" }],
			})
		);

		act(() => {
			result.current.stopLoading();
		});

		expect(result.current.embeddedCovers.size).toBe(0);
	});
});
