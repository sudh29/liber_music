// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLyricsIndex } from "./useLyricsIndex";

describe("useLyricsIndex hook", () => {
	it("computes active lyrics index based on current playback time", () => {
		const fullLyrics = [
			{ time: 2.0, text: "Line 1" },
			{ time: 5.0, text: "Line 2" },
			{ time: 8.0, text: "Line 3" },
		];
		const fullExtendedLyrics: any[] = [];

		const { result, rerender } = renderHook(
			({ currentTime }) =>
				useLyricsIndex({
					fullLyrics,
					fullExtendedLyrics,
					currentTime,
				}),
			{ initialProps: { currentTime: 0.5 } }
		);

		// At t = 0.5, adjusted = 1.0 (< 2.0) -> -1
		expect(result.current).toBe(-1);

		// Advance to t = 2.0
		rerender({ currentTime: 2.0 });
		expect(result.current).toBe(0);

		// Advance to t = 5.0
		rerender({ currentTime: 5.0 });
		expect(result.current).toBe(1);
	});
});
