/**
 * Playback coordinator for embedded music codeblocks
 * 
 * Ensures single-source playback coordination:
 * - Only one embedded note codeblock plays at a time
 * - Pauses the global sidebar player when an in-note snippet begins
 */

export class CodeblockCoordinator {
	private activeAudio: HTMLAudioElement | null = null;
	private activeStopCallback: (() => void) | null = null;
	private globalPauseCallback: (() => void) | null = null;

	/**
	 * Registers a callback to pause the global sidebar player.
	 */
	setGlobalPauseCallback(callback: () => void): void {
		this.globalPauseCallback = callback;
	}

	/**
	 * Registers that a codeblock audio element has started playing.
	 * Automatically pauses any other active codeblock audio and the sidebar player.
	 * 
	 * @param audio - Playing HTMLAudioElement
	 * @param onStop - Callback to reset play button state when paused by coordinator
	 */
	registerPlaying(audio: HTMLAudioElement, onStop?: () => void): void {
		if (this.activeAudio && this.activeAudio !== audio) {
			try {
				this.activeAudio.pause();
			} catch {
				// Ignore audio pause error
			}
			if (this.activeStopCallback) {
				this.activeStopCallback();
			}
		}

		this.activeAudio = audio;
		this.activeStopCallback = onStop || null;

		// Pause global sidebar player if active
		if (this.globalPauseCallback) {
			try {
				this.globalPauseCallback();
			} catch {
				// Ignore pause callback error
			}
		}
	}

	/**
	 * Unregisters an audio element if it was the currently active element.
	 */
	unregisterPlaying(audio: HTMLAudioElement): void {
		if (this.activeAudio === audio) {
			this.activeAudio = null;
			this.activeStopCallback = null;
		}
	}

	/**
	 * Stops currently active codeblock audio.
	 */
	stopActive(): void {
		if (this.activeAudio) {
			try {
				this.activeAudio.pause();
			} catch {
				// Ignore audio pause error
			}
			if (this.activeStopCallback) {
				this.activeStopCallback();
			}
			this.activeAudio = null;
			this.activeStopCallback = null;
		}
	}

	/**
	 * Gets currently active audio element, if any.
	 */
	getActiveAudio(): HTMLAudioElement | null {
		return this.activeAudio;
	}
}

/** Global singleton coordinator instance */
export const codeblockCoordinator = new CodeblockCoordinator();
