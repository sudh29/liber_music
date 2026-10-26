/**
 * Mock HTML5 Audio Element simulator for testing AudioService and playback flows.
 */

export class MockAudioElement extends EventTarget {
	public src: string = "";
	public currentTime: number = 0;
	public duration: number = 180; // default 3 minutes
	public volume: number = 1.0;
	public playbackRate: number = 1.0;
	public paused: boolean = true;
	public ended: boolean = false;
	public readyState: number = 4; // HAVE_ENOUGH_DATA
	public error: MediaError | null = null;

	constructor(src?: string) {
		super();
		if (src) {
			this.src = src;
		}
	}

	async play(): Promise<void> {
		this.paused = false;
		this.ended = false;
		this.dispatchEvent(new Event("play"));
		return Promise.resolve();
	}

	pause(): void {
		this.paused = true;
		this.dispatchEvent(new Event("pause"));
	}

	load(): void {
		this.dispatchEvent(new Event("loadstart"));
	}

	// Simulation helper methods
	_simulateLoadedMetadata(duration: number): void {
		this.duration = duration;
		this.dispatchEvent(new Event("loadedmetadata"));
	}

	_simulateTimeUpdate(time: number): void {
		this.currentTime = time;
		this.dispatchEvent(new Event("timeupdate"));
	}

	_simulateSeeked(): void {
		this.dispatchEvent(new Event("seeked"));
	}

	_simulateEnded(): void {
		this.ended = true;
		this.paused = true;
		this.currentTime = this.duration;
		this.dispatchEvent(new Event("ended"));
	}

	_simulateError(message: string = "Audio decoding error"): void {
		this.error = {
			code: 4,
			message,
			MEDIA_ERR_ABORTED: 1,
			MEDIA_ERR_NETWORK: 2,
			MEDIA_ERR_DECODE: 3,
			MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
		} as MediaError;
		this.dispatchEvent(new Event("error"));
	}
}

/**
 * Installs MockAudioElement into the global scope if window/global is present.
 */
export function installMockAudio(): () => void {
	const originalAudio = (globalThis as any).Audio;
	(globalThis as any).Audio = MockAudioElement as any;

	return () => {
		(globalThis as any).Audio = originalAudio;
	};
}
