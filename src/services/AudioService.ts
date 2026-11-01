/**
 * Audio element management service
 * 
 * Manages the lifecycle of HTMLAudioElement, including:
 * - Creating audio elements
 * - Binding event listeners
 * - Cleaning up audio elements
 * - Managing volume and playback rate
 */

import { App, Platform, TFile } from "obsidian";
import { EqualizerService } from "./EqualizerService";
import { shouldTranscodeVorbis, transcodeOggVorbisToWavBlob } from "@/utils/audio/vorbisDecoder";
import type MusicPlayerPlugin from "@/main";

/**
 * Audio event handlers interface
 * 
 * Defines event callback functions for the audio element.
 */
export interface AudioEventHandlers {
	/** Callback when playback time updates */
	onTimeUpdate: () => void;
	/** Callback when metadata is loaded */
	onLoadedMetadata: () => void;
	/** Callback when playback ends */
	onEnded: () => void;
	/** Callback when audio error occurs */
	onError?: (error: MediaError | null, event: Event) => void;
}

/**
 * Audio service class
 * 
 * Manages the full lifecycle of HTMLAudioElement: creation, configuration, event binding, and cleanup.
 * Provides audio playback control methods (play, pause, seek, volume, rate, etc.).
 */
export class AudioService {
	/** Current audio element instance */
	private audioElement: HTMLAudioElement | null = null;
	/** Current Blob URL in use (for resource revocation) */
	private currentBlobUrl: string | null = null;
	/** Reference to current event handlers bound to audioElement (for proper removal) */
	private currentHandlers: AudioEventHandlers | null = null;

	/** Outgoing audio element preserved during dual-pipeline crossfade transitions */
	private outgoingAudioElement: HTMLAudioElement | null = null;
	private outgoingBlobUrl: string | null = null;
	private outgoingHandlers: AudioEventHandlers | null = null;

	/**
	 * When seek finishes near media end (including decode alignment pushing currentTime to duration),
	 * some environments do not fire ended; this emits the same ended callback.
	 */
	private readonly onSeekedEmitEndedIfAtClose = (): void => {
		const el = this.audioElement;
		const h = this.currentHandlers;
		if (!el || !h) return;
		const d = el.duration;
		const t = el.currentTime;
		if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(t)) return;
		if (el.ended) {
			h.onEnded();
			return;
		}
		// Decode alignment may stop at duration without entering ended; check with small epsilon
		if (t > 0.02 && t >= d - 1e-4) {
			h.onEnded();
		}
	};

	/**
	 * Callback when audio element encounters a decoding or network error.
	 */
	private readonly onAudioError = (event: Event): void => {
		const el = this.audioElement;
		const h = this.currentHandlers;
		if (!el || !h) return;
		h.onError?.(el.error ?? null, event);
	};

	/**
	 * Creates an audio service instance.
	 * 
	 * @param app - Obsidian App instance
	 * @param equalizerService - Optional equalizer service
	 * @param plugin - Optional plugin reference for accessing settings
	 */
	constructor(
		private app: App,
		private equalizerService?: EqualizerService,
		private plugin?: MusicPlayerPlugin
	) {}

	/**
	 * Sets the plugin reference.
	 */
	setPlugin(plugin: MusicPlayerPlugin): void {
		this.plugin = plugin;
	}

	/**
	 * Sets the equalizer service and connects active audio element if available.
	 */
	setEqualizerService(eqService: EqualizerService): void {
		this.equalizerService = eqService;
		if (this.audioElement && (typeof eqService.isEnabled !== "function" || eqService.isEnabled())) {
			this.equalizerService.attachAudioElement(this.audioElement);
		}
	}

	/**
	 * Synchronizes equalizer attachment based on its enabled state.
	 */
	syncEqualizerState(): void {
		if (this.equalizerService && this.audioElement && this.equalizerService.isEnabled()) {
			this.equalizerService.attachAudioElement(this.audioElement);
		}
	}

	/**
	 * Creates and initializes the audio element.
	 * 
	 * Cleans up any existing audio element first. Binds all event listeners to the new element.
	 * Uses Blob URL for playback so vault files are not locked, allowing them to be renamed or deleted.
	 * If the track is an Ogg Vorbis file on an unsupported platform (e.g. iOS/iPadOS/Safari),
	 * it is automatically decoded via WebAssembly and transcoded to a 16-bit PCM WAV Blob.
	 * 
	 * @param trackFile - Audio file to play
	 * @param volume - Initial volume (0-1)
	 * @param playbackRate - Initial playback rate (0.25-4.0)
	 * @param handlers - Event handler object
	 * @returns Created audio element
	 */
	async createAudioElement(
		trackFile: TFile,
		volume: number,
		playbackRate: number,
		handlers: AudioEventHandlers,
		preserveOutgoingForCrossfade: boolean = false
	): Promise<HTMLAudioElement> {
		const canCrossfade = preserveOutgoingForCrossfade && Boolean(this.audioElement && !this.audioElement.paused);
		if (canCrossfade && this.audioElement) {
			// Move active element to outgoing slot for dual-pipeline crossfading
			await this.cleanupOutgoing();
			this.outgoingAudioElement = this.audioElement;
			this.outgoingBlobUrl = this.currentBlobUrl;
			this.outgoingHandlers = this.currentHandlers;
			this.audioElement = null;
			this.currentBlobUrl = null;
			this.currentHandlers = null;
		} else {
			// Clean up existing audio element and Blob URL
			await this.cleanup();
		}

		// Read file into memory and create Blob URL
		// Prevents file lock so file can be safely renamed or removed
		try {
			const wasmEnabled = this.plugin?.settings.enableWasmVorbisDecoder ?? true;
			const needsTranscode = wasmEnabled && shouldTranscodeVorbis(trackFile.extension);
			const isLargeFile = Boolean(trackFile.stat?.size && trackFile.stat.size > 15 * 1024 * 1024);

			// For large files (>15MB) or on mobile platforms (Android/iOS WebView) that do not require WASM transcoding,
			// stream directly via Obsidian's local resource handler to prevent memory exhaustion / OOM kills
			if (!needsTranscode && (isLargeFile || Platform.isMobile)) {
				const url = this.app.vault.getResourcePath(trackFile);
				this.audioElement = new Audio(url);
			} else {
				const binary = await this.app.vault.readBinary(trackFile);
				let blob: Blob;

				if (needsTranscode) {
					try {
						blob = await transcodeOggVorbisToWavBlob(binary);
					} catch (decodeErr) {
						console.warn(`WASM Vorbis decoding failed for ${trackFile.path}, falling back to native:`, decodeErr);
						blob = new Blob([binary], { type: this.getMimeType(trackFile.extension) });
					}
				} else {
					blob = new Blob([binary], { type: this.getMimeType(trackFile.extension) });
				}

				const blobUrl = URL.createObjectURL(blob);
				this.currentBlobUrl = blobUrl;

				// Create new audio element
				this.audioElement = new Audio(blobUrl);
			}

			this.audioElement.volume = canCrossfade ? 0 : volume;
			this.audioElement.playbackRate = playbackRate;

			// Store current handlers for proper cleanup
			this.currentHandlers = handlers;

			// Bind event listeners
			this.audioElement.addEventListener("timeupdate", handlers.onTimeUpdate);
			this.audioElement.addEventListener("loadedmetadata", handlers.onLoadedMetadata);
			this.audioElement.addEventListener("ended", handlers.onEnded);
			this.audioElement.addEventListener("seeked", this.onSeekedEmitEndedIfAtClose);
			this.audioElement.addEventListener("error", this.onAudioError);

			// Connect to Web Audio equalizer graph only if actively enabled to preserve native mobile background audio
			if (this.equalizerService && (typeof this.equalizerService.isEnabled !== "function" || this.equalizerService.isEnabled())) {
				this.equalizerService.attachAudioElement(this.audioElement);
			}

			return this.audioElement;
		} catch (error) {
			console.error(`Failed to create audio element via Blob URL, falling back to direct file path: ${trackFile.path}`, error);
			// Fallback to vault resource path if Blob URL fails
			const url = this.app.vault.getResourcePath(trackFile);
			this.audioElement = new Audio(url);
			this.audioElement.volume = volume;
			this.audioElement.playbackRate = playbackRate;

			this.currentHandlers = handlers;

			this.audioElement.addEventListener("timeupdate", handlers.onTimeUpdate);
			this.audioElement.addEventListener("loadedmetadata", handlers.onLoadedMetadata);
			this.audioElement.addEventListener("ended", handlers.onEnded);
			this.audioElement.addEventListener("seeked", this.onSeekedEmitEndedIfAtClose);
			this.audioElement.addEventListener("error", this.onAudioError);

			if (this.equalizerService) {
				this.equalizerService.attachAudioElement(this.audioElement);
			}

			return this.audioElement;
		}
	}

	/**
	 * Clamps seek target time slightly before duration.
	 * If currentTime equals duration, typical browsers do not fire ended and play() gets stuck.
	 * Epsilon absorbs format-specific seek alignment margins (e.g. MP3 frames).
	 */
	private clampSeekTimeToPlayableEnd(time: number, duration: number): number {
		if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return 0;
		const epsilon = Math.min(0.28, Math.max(duration * 0.0025, 0.002));
		const maxTime = Math.max(0, duration - epsilon);
		return Math.min(Math.max(time, 0), maxTime);
	}

	/**
	 * Resolves MIME type from file extension.
	 *
	 * @param extension - File extension (without dot)
	 * @returns MIME type string
	 */
	private getMimeType(extension: string): string {
		const ext = extension?.toLowerCase() || '';
		const mimeTypes: Record<string, string> = {
			'mp3': 'audio/mpeg',
			'flac': 'audio/flac',
			'wav': 'audio/wav',
			'ogg': 'audio/ogg',
			'm4a': 'audio/mp4',
			'aac': 'audio/aac',
			'opus': 'audio/opus',
			'wma': 'audio/x-ms-wma',
		};
		return mimeTypes[ext] || 'audio/mpeg';
	}

	/**
	 * Gets current audio element
	 * 
	 * @returns Current audio element, or null if absent
	 */
	getAudioElement(): HTMLAudioElement | null {
		return this.audioElement;
	}

	/**
	 * Gets active outgoing audio element during crossfade, if any
	 */
	getOutgoingAudioElement(): HTMLAudioElement | null {
		return this.outgoingAudioElement;
	}

	/**
	 * Cleans up the outgoing audio element preserved during a dual-pipeline crossfade transition.
	 */
	async cleanupOutgoing(): Promise<void> {
		if (this.outgoingAudioElement) {
			try {
				if (!this.outgoingAudioElement.paused) {
					this.outgoingAudioElement.pause();
				}
			} catch {
				// Ignore pause errors on outgoing element
			}

			if (this.outgoingHandlers) {
				this.outgoingAudioElement.removeEventListener("timeupdate", this.outgoingHandlers.onTimeUpdate);
				this.outgoingAudioElement.removeEventListener("loadedmetadata", this.outgoingHandlers.onLoadedMetadata);
				this.outgoingAudioElement.removeEventListener("ended", this.outgoingHandlers.onEnded);
			}

			this.outgoingAudioElement = null;
			this.outgoingHandlers = null;
		}

		if (this.outgoingBlobUrl) {
			try {
				URL.revokeObjectURL(this.outgoingBlobUrl);
			} catch {
				// Ignore URL revoke error
			}
			this.outgoingBlobUrl = null;
		}
	}

	/**
	 * Cleans up audio element:
	 * Pauses playback, removes event listeners, revokes Blob URL, and nullifies references.
	 * Called when creating a new audio element or destroying the service.
	 * 
	 * Handles active playback gracefully to avoid AbortError when pause() interrupts pending play().
	 */
	async cleanup(): Promise<void> {
		await this.cleanupOutgoing();
		if (this.audioElement) {
			if (!this.audioElement.paused) {
				this.audioElement.pause();
				// Short wait allows pending play() Promise to settle
				await new Promise(resolve => window.setTimeout(resolve, 10));
			}
			
			// Remove event listeners
			if (this.currentHandlers) {
				this.audioElement.removeEventListener("timeupdate", this.currentHandlers.onTimeUpdate);
				this.audioElement.removeEventListener("loadedmetadata", this.currentHandlers.onLoadedMetadata);
				this.audioElement.removeEventListener("ended", this.currentHandlers.onEnded);
				this.audioElement.removeEventListener("seeked", this.onSeekedEmitEndedIfAtClose);
				this.audioElement.removeEventListener("error", this.onAudioError);
			}

			this.audioElement = null;
			this.currentHandlers = null;
		}
		
		// Revoke Blob URL to release memory
		if (this.currentBlobUrl) {
			URL.revokeObjectURL(this.currentBlobUrl);
			this.currentBlobUrl = null;
		}
	}

	/**
	 * Pauses audio playback
	 */
	pause(): void {
		this.audioElement?.pause();
		if (this.outgoingAudioElement && !this.outgoingAudioElement.paused) {
			try {
				this.outgoingAudioElement.pause();
			} catch {
				// Ignore pause error on outgoing element
			}
		}
	}

	/**
	 * Starts audio playback
	 * 
	 * @returns Promise that resolves when playback starts
	 */
	async play(): Promise<void> {
		if (!this.audioElement) {
			return;
		}
		
		try {
			if (this.equalizerService && (typeof this.equalizerService.isEnabled !== "function" || this.equalizerService.isEnabled())) {
				await this.equalizerService.resumeContext();
			}
			await this.audioElement.play();
		} catch (error) {
			// AbortError when pause() interrupts play() during track changes is normal
			if (error instanceof DOMException && error.name === 'AbortError') {
				console.debug('Playback aborted (likely caused by track change):', error.message);
				return;
			}
			throw error;
		}
	}

	/**
	 * Sets playback volume
	 * 
	 * Clamped to [0, 1].
	 * 
	 * @param volume - Volume value (0-1)
	 */
	setVolume(volume: number): void {
		if (this.audioElement) {
			this.audioElement.volume = Math.max(0, Math.min(1, volume));
		}
	}

	/**
	 * Sets playback rate
	 * 
	 * Clamped to [0.25, 4.0].
	 * 
	 * @param rate - Playback rate (0.25-4.0)
	 */
	setPlaybackRate(rate: number): void {
		if (this.audioElement) {
			this.audioElement.playbackRate = Math.max(0.25, Math.min(4.0, rate));
		}
	}

	/**
	 * Seeks to relative playback ratio
	 * 
	 * @param ratio - Playback position ratio (0-1, where 0 is start, 1 is end)
	 */
	seekToRatio(ratio: number): void {
		if (!this.audioElement) return;
		const clamped = Math.min(Math.max(ratio, 0), 1);
		const duration = this.audioElement.duration;
		if (!Number.isFinite(duration) || duration <= 0) return;
		const target = clamped * duration;
		this.audioElement.currentTime = this.clampSeekTimeToPlayableEnd(target, duration);
	}

	/**
	 * Fast-forwards audio by specified seconds
	 * 
	 * @param seconds - Number of seconds to fast-forward (positive)
	 */
	seekForward(seconds: number): void {
		if (!this.audioElement) return;
		const duration = this.audioElement.duration;
		if (!Number.isFinite(duration) || duration <= 0) return;
		const newTime = this.audioElement.currentTime + seconds;
		this.audioElement.currentTime = this.clampSeekTimeToPlayableEnd(newTime, duration);
	}

	/**
	 * Rewinds audio by specified seconds
	 * 
	 * @param seconds - Number of seconds to rewind (positive)
	 */
	seekBackward(seconds: number): void {
		if (!this.audioElement) return;
		const newTime = Math.max(this.audioElement.currentTime - seconds, 0);
		this.audioElement.currentTime = newTime;
	}
}
