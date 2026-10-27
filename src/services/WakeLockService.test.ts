// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WakeLockService } from "./WakeLockService";

describe("WakeLockService", () => {
	let mockSentinel: {
		release: ReturnType<typeof vi.fn>;
		addEventListener: ReturnType<typeof vi.fn>;
	};
	let mockWakeLock: {
		request: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockSentinel = {
			release: vi.fn().mockResolvedValue(undefined),
			addEventListener: vi.fn(),
		};
		mockWakeLock = {
			request: vi.fn().mockResolvedValue(mockSentinel),
		};

		Object.defineProperty(navigator, "wakeLock", {
			value: mockWakeLock,
			configurable: true,
			writable: true,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should request wake lock when enabled and playing", async () => {
		const service = new WakeLockService();
		service.setEnabled(true);
		service.onPlaybackStateChange(true);

		// Allow microtask to resolve
		await Promise.resolve();

		expect(mockWakeLock.request).toHaveBeenCalledWith("screen");
	});

	it("should not request wake lock when disabled", async () => {
		const service = new WakeLockService();
		service.setEnabled(false);
		service.onPlaybackStateChange(true);

		await Promise.resolve();

		expect(mockWakeLock.request).not.toHaveBeenCalled();
	});

	it("should release wake lock on pause", async () => {
		const service = new WakeLockService();
		service.setEnabled(true);
		service.onPlaybackStateChange(true);
		await Promise.resolve();

		expect(mockWakeLock.request).toHaveBeenCalledTimes(1);

		service.onPlaybackStateChange(false);
		await Promise.resolve();

		expect(mockSentinel.release).toHaveBeenCalledTimes(1);
	});

	it("should release lock when setEnabled is toggled to false", async () => {
		const service = new WakeLockService();
		service.setEnabled(true);
		service.onPlaybackStateChange(true);
		await Promise.resolve();

		service.setEnabled(false);
		await Promise.resolve();

		expect(mockSentinel.release).toHaveBeenCalledTimes(1);
	});

	it("should release lock on destroy", async () => {
		const service = new WakeLockService();
		service.setEnabled(true);
		service.onPlaybackStateChange(true);
		await Promise.resolve();

		service.destroy();
		await Promise.resolve();

		expect(mockSentinel.release).toHaveBeenCalledTimes(1);
	});

	it("should re-acquire lock on visibilitychange when visible and playing and enabled", async () => {
		const service = new WakeLockService();
		service.setEnabled(true);
		service.onPlaybackStateChange(true);
		await Promise.resolve();
		expect(mockWakeLock.request).toHaveBeenCalledTimes(1);

		// Trigger release callback from system
		const releaseListener = mockSentinel.addEventListener.mock.calls.find((c) => c[0] === "release")?.[1];
		releaseListener?.();

		// Simulate tab becoming visible
		Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
		document.dispatchEvent(new Event("visibilitychange"));
		await Promise.resolve();

		expect(mockWakeLock.request).toHaveBeenCalledTimes(2);
		service.destroy();
	});

	it("should handle wake lock request rejections gracefully", async () => {
		mockWakeLock.request.mockRejectedValueOnce(new Error("Low battery power-saving"));
		const service = new WakeLockService();
		service.setEnabled(true);

		// Should not throw
		expect(() => service.onPlaybackStateChange(true)).not.toThrow();
		await Promise.resolve();
		service.destroy();
	});

	it("should handle wake lock release rejections gracefully", async () => {
		mockSentinel.release.mockRejectedValueOnce(new Error("Release failed"));
		const service = new WakeLockService();
		service.setEnabled(true);
		service.onPlaybackStateChange(true);
		await Promise.resolve();

		expect(() => service.onPlaybackStateChange(false)).not.toThrow();
		await Promise.resolve();
		service.destroy();
	});

	it("should do nothing when navigator.wakeLock is unsupported", async () => {
		Object.defineProperty(navigator, "wakeLock", { value: undefined, configurable: true });
		const service = new WakeLockService();
		service.setEnabled(true);
		expect(() => service.onPlaybackStateChange(true)).not.toThrow();
		service.destroy();
	});
});
