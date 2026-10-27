/**
 * Screen Wake Lock management service
 *
 * Prevents mobile and tablet displays from sleeping while music is playing.
 * Gracefully handles background visibility changes and devices without Wake Lock API support.
 */

interface WakeLockSentinelLike {
	release(): Promise<void>;
	addEventListener(type: "release", listener: () => void): void;
	removeEventListener?(type: "release", listener: () => void): void;
}

interface NavigatorWithWakeLock {
	wakeLock?: {
		request(type: "screen"): Promise<WakeLockSentinelLike>;
	};
}

export class WakeLockService {
	private sentinel: WakeLockSentinelLike | null = null;
	private enabled: boolean = false;
	private isPlaying: boolean = false;
	private visibilityHandler: (() => void) | null = null;

	constructor() {
		if (typeof document !== "undefined") {
			this.visibilityHandler = () => {
				if (document.visibilityState === "visible" && this.enabled && this.isPlaying) {
					void this.acquireLock();
				}
			};
			document.addEventListener("visibilitychange", this.visibilityHandler);
		}
	}

	/**
	 * Configures whether Screen Wake Lock is enabled by user settings.
	 */
	public setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (!enabled) {
			void this.releaseLock();
		} else if (this.isPlaying) {
			void this.acquireLock();
		}
	}

	/**
	 * Updates playback state to acquire or release lock accordingly.
	 */
	public onPlaybackStateChange(isPlaying: boolean): void {
		this.isPlaying = isPlaying;
		if (isPlaying && this.enabled) {
			void this.acquireLock();
		} else if (!isPlaying) {
			void this.releaseLock();
		}
	}

	/**
	 * Requests screen wake lock from navigator if supported.
	 */
	private async acquireLock(): Promise<void> {
		if (typeof navigator === "undefined") return;
		const nav = navigator as unknown as NavigatorWithWakeLock;
		if (!nav.wakeLock || typeof nav.wakeLock.request !== "function") return;
		if (this.sentinel) return;

		try {
			const lock = await nav.wakeLock.request("screen");
			this.sentinel = lock;
			lock.addEventListener("release", () => {
				if (this.sentinel === lock) {
					this.sentinel = null;
				}
			});
		} catch (err) {
			// Expected when system power-saving is active or document is hidden
			console.debug("Screen Wake Lock request was rejected:", err);
		}
	}

	/**
	 * Releases active screen wake lock.
	 */
	private async releaseLock(): Promise<void> {
		if (this.sentinel) {
			const lock = this.sentinel;
			this.sentinel = null;
			try {
				await lock.release();
			} catch {
				// Ignore release errors
			}
		}
	}

	/**
	 * Cleans up listeners and releases locks on service destruction.
	 */
	public destroy(): void {
		if (this.visibilityHandler && typeof document !== "undefined") {
			document.removeEventListener("visibilitychange", this.visibilityHandler);
			this.visibilityHandler = null;
		}
		void this.releaseLock();
	}
}
