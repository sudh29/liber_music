import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateCrossfadeGains, CrossfadeService } from "./CrossfadeService";
import { MockAudioElement } from "../../tests/mocks/audio";

describe("CrossfadeService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("calculateCrossfadeGains", () => {
		it("should calculate correct gains at progress boundaries", () => {
			const start = calculateCrossfadeGains(0, 1.0);
			expect(start.outgoingGain).toBe(1.0);
			expect(start.incomingGain).toBe(0.0);

			const mid = calculateCrossfadeGains(0.5, 1.0);
			expect(mid.outgoingGain).toBeCloseTo(0.707, 2);
			expect(mid.incomingGain).toBeCloseTo(0.707, 2);

			const end = calculateCrossfadeGains(1.0, 1.0);
			expect(end.outgoingGain).toBe(0.0);
			expect(end.incomingGain).toBe(1.0);
		});

		it("should scale with targetVolume correctly", () => {
			const midHalf = calculateCrossfadeGains(0.5, 0.5);
			expect(midHalf.outgoingGain).toBeCloseTo(0.354, 2);
			expect(midHalf.incomingGain).toBeCloseTo(0.354, 2);
		});
	});

	describe("Gapless Pre-buffering", () => {
		it("should trigger pre-buffer callback when near end in gapless mode (0s)", () => {
			const onPrebuffer = vi.fn().mockResolvedValue(undefined);
			const service = new CrossfadeService(0, {
				onTriggerTransition: vi.fn(),
				onPrebufferNextTrack: onPrebuffer,
			});

			const audioEl = new MockAudioElement() as unknown as HTMLAudioElement;

			// Current time far from end (duration 100, current 50)
			service.onTimeUpdate(50, 100, audioEl);
			expect(onPrebuffer).not.toHaveBeenCalled();

			// Current time within 2s of end (current 98.5)
			service.onTimeUpdate(98.5, 100, audioEl);
			expect(onPrebuffer).toHaveBeenCalledTimes(1);

			// Subsequent calls should not re-trigger prebuffering
			service.onTimeUpdate(99.0, 100, audioEl);
			expect(onPrebuffer).toHaveBeenCalledTimes(1);
		});
	});

	describe("Crossfade Transitions", () => {
		it("should initiate crossfade when remaining time reaches crossfade duration", async () => {
			const incomingEl = new MockAudioElement() as unknown as HTMLAudioElement;
			const onTrigger = vi.fn().mockResolvedValue(incomingEl);
			const onComplete = vi.fn();

			const service = new CrossfadeService(4, {
				onTriggerTransition: onTrigger,
				onTransitionComplete: onComplete,
			});

			const outgoingEl = new MockAudioElement() as unknown as HTMLAudioElement;
			outgoingEl.volume = 1.0;

			// 5s remaining: should not trigger (duration 100, currentTime 95)
			service.onTimeUpdate(95, 100, outgoingEl);
			expect(service.isCrossfadeActive()).toBe(false);

			// 3.5s remaining: within 4s crossfade window
			service.onTimeUpdate(96.5, 100, outgoingEl);
			expect(service.isCrossfadeActive()).toBe(true);

			// Flush async transition promise
			await vi.advanceTimersByTimeAsync(0);
			expect(onTrigger).toHaveBeenCalledTimes(1);

			// Advance timers across the 4s duration
			vi.advanceTimersByTime(2000);
			expect(outgoingEl.volume).toBeLessThan(1.0);
			expect(incomingEl.volume).toBeGreaterThan(0.0);

			vi.advanceTimersByTime(2500);
			expect(outgoingEl.volume).toBe(0);
			expect(incomingEl.volume).toBe(1.0);
			expect(onComplete).toHaveBeenCalledTimes(1);
			expect(service.isCrossfadeActive()).toBe(false);
		});

		it("should allow cancelling active crossfade", async () => {
			const incomingEl = new MockAudioElement() as unknown as HTMLAudioElement;
			const onTrigger = vi.fn().mockResolvedValue(incomingEl);
			const onComplete = vi.fn();

			const service = new CrossfadeService(3, {
				onTriggerTransition: onTrigger,
				onTransitionComplete: onComplete,
			});

			const outgoingEl = new MockAudioElement() as unknown as HTMLAudioElement;
			service.onTimeUpdate(97.5, 100, outgoingEl);
			await vi.advanceTimersByTimeAsync(0);

			expect(service.isCrossfadeActive()).toBe(true);
			service.cancelCrossfade();
			expect(service.isCrossfadeActive()).toBe(false);

			// Timers advancing should not trigger completion
			vi.advanceTimersByTime(4000);
			expect(onComplete).not.toHaveBeenCalled();
		});

		it("should handle transition failure or null element gracefully", async () => {
			const onTrigger = vi.fn().mockRejectedValue(new Error("Playback error"));
			const service = new CrossfadeService(3, {
				onTriggerTransition: onTrigger,
			});

			const outgoingEl = new MockAudioElement() as unknown as HTMLAudioElement;
			service.onTimeUpdate(98, 100, outgoingEl);
			await vi.advanceTimersByTimeAsync(0);

			expect(service.isCrossfadeActive()).toBe(false);

			// Test returning null incomingElement
			onTrigger.mockResolvedValueOnce(null);
			service.onTimeUpdate(98, 100, outgoingEl);
			await vi.advanceTimersByTimeAsync(0);
			expect(service.isCrossfadeActive()).toBe(false);
		});

		it("should clear transitionTimer during cancelCrossfade if scheduled", () => {
			const service = new CrossfadeService(3);
			const timerId = setTimeout(() => {}, 5000);
			(service as any).transitionTimer = timerId;

			service.cancelCrossfade();
			expect((service as any).transitionTimer).toBeNull();
		});

		it("should reset track state and cancel crossfade on resetTrackState", () => {
			const service = new CrossfadeService(3);
			service.resetTrackState();
			expect(service.isCrossfadeActive()).toBe(false);
		});

		it("should ignore onTimeUpdate with invalid parameters", () => {
			const service = new CrossfadeService(3);
			const audioEl = new MockAudioElement() as unknown as HTMLAudioElement;

			service.onTimeUpdate(NaN, 100, audioEl);
			service.onTimeUpdate(10, 0, audioEl);
			service.onTimeUpdate(10, -5, audioEl);
			expect(service.isCrossfadeActive()).toBe(false);
		});

		it("should return duration and clamp on setDuration", () => {
			const service = new CrossfadeService(5);
			expect(service.getDuration()).toBe(5);

			service.setDuration(15);
			expect(service.getDuration()).toBe(10);

			service.setDuration(-5);
			expect(service.getDuration()).toBe(0);
		});

		it("should clean up cleanly on dispose", () => {
			const service = new CrossfadeService(5);
			service.dispose();
			expect(service.isCrossfadeActive()).toBe(false);
		});
	});
});
