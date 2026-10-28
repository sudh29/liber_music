// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNavigation } from "./useNavigation";

describe("useNavigation hook", () => {
	it("initializes with currentDisc tab and disc page", () => {
		const { result } = renderHook(() => useNavigation());
		expect(result.current.tab).toBe("currentDisc");
		expect(result.current.currentPage).toBe("disc");
		expect(result.current.shouldMarkInitialLyricsMount).toBe(false);
	});

	it("switches to library tab and back to disc", () => {
		const { result } = renderHook(() => useNavigation());

		act(() => {
			result.current.openLibrary();
		});
		expect(result.current.tab).toBe("library");

		act(() => {
			result.current.openDisc();
		});
		expect(result.current.tab).toBe("currentDisc");
		expect(result.current.currentPage).toBe("disc");
	});

	it("switches to lyrics page and manages initial lyrics mount flag", () => {
		const { result } = renderHook(() => useNavigation());

		act(() => {
			result.current.switchToLyrics();
		});
		expect(result.current.currentPage).toBe("lyrics");
		expect(result.current.shouldMarkInitialLyricsMount).toBe(true);

		act(() => {
			result.current.clearInitialLyricsMount();
		});
		expect(result.current.shouldMarkInitialLyricsMount).toBe(false);

		act(() => {
			result.current.switchToDisc();
		});
		expect(result.current.currentPage).toBe("disc");
	});

	it("handles openLyrics from library tab via pendingPage", () => {
		const { result } = renderHook(() => useNavigation());

		act(() => {
			result.current.openLibrary();
		});
		expect(result.current.tab).toBe("library");

		act(() => {
			result.current.openLyrics();
		});
		expect(result.current.tab).toBe("currentDisc");
		expect(result.current.currentPage).toBe("lyrics");
		expect(result.current.shouldMarkInitialLyricsMount).toBe(true);
	});
});
