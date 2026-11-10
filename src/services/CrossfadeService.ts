/**
 * Audiophile Gapless Playback & Configurable Crossfading Service
 * 
 * Supports:
 * - Strict gapless pre-buffering (duration = 0s)
 * - Configurable equal-power crossfading (duration 1s - 10s)
 *   using acoustic constant-power panning curve: cos(t * π/2) / sin(t * π/2)
 */

export interface CrossfadeGains {
	outgoingGain: number;
	incomingGain: number;
}

/**
 * Calculates equal-power crossfade volume multipliers.
 * 
 * Total acoustic energy is preserved across the blend:
 * outgoing^2 + incoming^2 = 1.0
 * 
 * @param progress - Normalized crossfade progress (0.0 to 1.0)
 * @param targetVolume - Maximum target volume (0.0 to 1.0)
 */
export function calculateCrossfadeGains(progress: number, targetVolume = 1.0): CrossfadeGains {
	const clampedProgress = Math.max(0, Math.min(1, progress));
	const clampedVol = Math.max(0, Math.min(1, targetVolume));

	// Equal-power sinusoidal curve
	const outgoing = Math.cos(clampedProgress * (Math.PI / 2)) * clampedVol;
	const incoming = Math.sin(clampedProgress * (Math.PI / 2)) * clampedVol;

	return {
		outgoingGain: Math.max(0, Math.min(1, Math.round(outgoing * 1000) / 1000)),
		incomingGain: Math.max(0, Math.min(1, Math.round(incoming * 1000) / 1000)),
	};
}

export interface CrossfadeCallbacks {
	/** Called when current track approaches end to trigger next track playback */
	onTriggerTransition: () => Promise<HTMLAudioElement | null>;
	/** Called when transition completes */
	onTransitionComplete?: () => void;
	/** Called to pre-buffer upcoming track in gapless mode */
	onPrebufferNextTrack?: () => Promise<void>;
}

export class CrossfadeService {
	private crossfadeDuration: number = 0; // 0 = gapless, >0 = crossfade seconds
	private isTransitioning: boolean = false;
	private hasPrebuffered: boolean = false;
	private transitionTimer: number | null = null;
	private activeCrossfadeCancel: (() => void) | null = null;

	constructor(
		crossfadeDuration = 0,
		private callbacks?: CrossfadeCallbacks
	) {
		this.setDuration(crossfadeDuration);
	}

	/**
	 * Sets transition and buffering callbacks.
	 */
	setCallbacks(callbacks?: CrossfadeCallbacks): void {
		this.callbacks = callbacks;
	}

	/**
	 * Sets crossfade duration in seconds [0, 10].
	 */
	setDuration(seconds: number): void {
		this.crossfadeDuration = Math.max(0, Math.min(10, Math.round(seconds)));
	}

	getDuration(): number {
		return this.crossfadeDuration;
	}

	isCrossfadeActive(): boolean {
		return this.isTransitioning;
	}

	/**
	 * Called periodically on timeupdate of the currently playing track.
	 * Checks whether pre-buffering or crossfading should trigger.
	 */
	onTimeUpdate(
		currentTime: number,
		duration: number,
		currentAudioElement: HTMLAudioElement,
		targetVolume: number = 1.0
	): void {
		if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) {
			return;
		}

		if (this.isTransitioning) {
			return;
		}

		// 1. Strict gapless pre-buffering (2s before end)
		if (this.crossfadeDuration === 0) {
			const timeRemaining = duration - currentTime;
			if (timeRemaining <= 2.0 && !this.hasPrebuffered) {
				this.hasPrebuffered = true;
				void this.callbacks?.onPrebufferNextTrack?.();
			}
			return;
		}

		// 2. Crossfade trigger
		// Clamp effective crossfade to half duration for very short tracks
		const effectiveDuration = Math.min(this.crossfadeDuration, duration / 2);
		const timeRemaining = duration - currentTime;

		if (timeRemaining <= effectiveDuration && timeRemaining > 0) {
			this.startCrossfade(currentAudioElement, effectiveDuration, targetVolume);
		}
	}

	/**
	 * Resets pre-buffered flag (called when new track starts playing)
	 */
	resetTrackState(): void {
		this.cancelCrossfade();
		this.hasPrebuffered = false;
	}

	/**
	 * Initiates equal-power crossfade transition between outgoing and incoming audio.
	 */
	private startCrossfade(
		outgoingElement: HTMLAudioElement,
		durationSec: number,
		targetVolume: number
	): void {
		this.isTransitioning = true;

		void (async () => {
			let incomingElement: HTMLAudioElement | null = null;
			try {
				incomingElement = (await this.callbacks?.onTriggerTransition()) ?? null;
			} catch (error) {
				console.warn("Crossfade transition trigger failed:", error);
				this.isTransitioning = false;
				return;
			}

			if (!incomingElement || !this.isTransitioning) {
				this.isTransitioning = false;
				return;
			}

			// If outgoing element is paused or identical to incoming element,
			// crossfading two streams is impossible. Set target volume immediately.
			if (outgoingElement.paused || outgoingElement === incomingElement) {
				try {
					incomingElement.volume = targetVolume;
				} catch {
					// Ignore volume assignment error on detached audio element
				}
				this.isTransitioning = false;
				this.callbacks?.onTransitionComplete?.();
				return;
			}

			// Initial state
			incomingElement.volume = 0;

			const startTime = Date.now();
			const totalMs = Math.max(200, durationSec * 1000);
			let isCancelled = false;

			this.activeCrossfadeCancel = () => {
				isCancelled = true;
			};

			const intervalId = window.setInterval(() => {
				if (isCancelled) {
					window.clearInterval(intervalId);
					return;
				}

				const elapsed = Date.now() - startTime;
				const progress = Math.min(1.0, elapsed / totalMs);
				const { outgoingGain, incomingGain } = calculateCrossfadeGains(progress, targetVolume);

				try {
					outgoingElement.volume = outgoingGain;
					incomingElement.volume = incomingGain;
				} catch {
					// Ignore volume update error during transition
				}

				if (progress >= 1.0) {
					window.clearInterval(intervalId);
					try {
						outgoingElement.pause();
					} catch {
						// Ignore pause error on outgoing element
					}
					this.isTransitioning = false;
					this.activeCrossfadeCancel = null;
					this.callbacks?.onTransitionComplete?.();
				}
			}, 30);
		})();
	}

	/**
	 * Cancels active crossfade immediately (e.g. on manual skip/seek/pause).
	 */
	cancelCrossfade(): void {
		if (this.activeCrossfadeCancel) {
			this.activeCrossfadeCancel();
			this.activeCrossfadeCancel = null;
		}
		if (this.transitionTimer !== null) {
			window.clearTimeout(this.transitionTimer);
			this.transitionTimer = null;
		}
		this.isTransitioning = false;
	}

	dispose(): void {
		this.cancelCrossfade();
	}
}
