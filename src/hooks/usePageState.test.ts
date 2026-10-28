// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePageState } from "./usePageState";

describe("usePageState hook", () => {
	it("initializes with lastAction null", () => {
		const { result } = renderHook(() => usePageState());
		expect(result.current.lastAction).toBeNull();
	});

	it("sets lastAction to prev and executes callback", () => {
		const { result } = renderHook(() => usePageState());
		const onPrev = vi.fn();

		act(() => {
			result.current.handlePrevWithFlag(onPrev);
		});

		expect(result.current.lastAction).toBe("prev");
		expect(onPrev).toHaveBeenCalledTimes(1);
	});

	it("sets lastAction to next and executes callback", () => {
		const { result } = renderHook(() => usePageState());
		const onNext = vi.fn();

		act(() => {
			result.current.handleNextWithFlag(onNext);
		});

		expect(result.current.lastAction).toBe("next");
		expect(onNext).toHaveBeenCalledTimes(1);
	});

	it("clears lastAction flag", () => {
		const { result } = renderHook(() => usePageState());

		act(() => {
			result.current.handleNextWithFlag(vi.fn());
		});
		expect(result.current.lastAction).toBe("next");

		act(() => {
			result.current.clearLastAction();
		});
		expect(result.current.lastAction).toBeNull();
	});
});
