/**
 * Media Session API integration service
 *
 * Connects audio playback with OS-level media notifications, lock-screen controls,
 * and hardware media keys (headsets, AirPods, keyboards) on Android, iPadOS/iOS, and desktop.
 */

import { TFile } from "obsidian";
import type { TrackInfo } from "@/types";

/**
 * Callbacks triggered by OS media controls
 */
export interface MediaSessionCallbacks {
	onPlay: () => void | Promise<void>;
	onPause: () => void | Promise<void>;
	onPrevious: () => void | Promise<void>;
	onNext: () => void | Promise<void>;
	onSeekTo?: (time: number) => void;
	onSeekBackward?: (seconds: number) => void;
	onSeekForward?: (seconds: number) => void;
}

export class MediaSessionService {
	private readonly isAvailable: boolean = false;

	constructor(private callbacks: MediaSessionCallbacks) {
		const nav = typeof navigator !== "undefined" ? (navigator as unknown as { mediaSession?: MediaSession }) : undefined;
		this.isAvailable = Boolean(nav && nav.mediaSession);

		this.setupActionHandlers();
	}

	/**
	 * Configures OS media action listeners.
	 */
	private setupActionHandlers(): void {
		if (!this.isAvailable) return;

		try {
			const ms = navigator.mediaSession;
			ms.setActionHandler("play", () => {
				void this.callbacks.onPlay();
			});
			ms.setActionHandler("pause", () => {
				void this.callbacks.onPause();
			});
			ms.setActionHandler("previoustrack", () => {
				void this.callbacks.onPrevious();
			});
			ms.setActionHandler("nexttrack", () => {
				void this.callbacks.onNext();
			});

			if (this.callbacks.onSeekTo) {
				ms.setActionHandler("seekto", (details) => {
					if (details.seekTime !== undefined && Number.isFinite(details.seekTime)) {
						this.callbacks.onSeekTo?.(details.seekTime);
					}
				});
			}

			if (this.callbacks.onSeekBackward) {
				ms.setActionHandler("seekbackward", (details) => {
					const offset = details.seekOffset ?? 10;
					this.callbacks.onSeekBackward?.(offset);
				});
			}

			if (this.callbacks.onSeekForward) {
				ms.setActionHandler("seekforward", (details) => {
					const offset = details.seekOffset ?? 10;
					this.callbacks.onSeekForward?.(offset);
				});
			}
		} catch (e) {
			console.warn("Failed to set MediaSession action handlers:", e);
		}
	}

	/**
	 * Converts a local or blob cover URL into a Base64 data URI so native mobile OS
	 * notification handlers (such as Android SystemUI) can decode the bitmap across IPC.
	 */
	private async convertCoverToDataUri(url: string): Promise<string | null> {
		try {
			if (typeof document === "undefined") return null;
			return await new Promise<string | null>((resolve) => {
				const img = new Image();
				img.crossOrigin = "anonymous";
				const timer = window.setTimeout(() => resolve(null), 1200);
				img.onload = () => {
					window.clearTimeout(timer);
					try {
						const canvas = createEl("canvas");
						const size = Math.min(Math.max(img.width || 256, img.height || 256, 256), 512);
						canvas.width = size;
						canvas.height = size;
						const ctx = canvas.getContext("2d");
						if (!ctx) {
							resolve(null);
							return;
						}
						ctx.drawImage(img, 0, 0, size, size);
						resolve(canvas.toDataURL("image/jpeg", 0.85));
					} catch {
						resolve(null);
					}
				};
				img.onerror = () => {
					window.clearTimeout(timer);
					resolve(null);
				};
				img.src = url;
			});
		} catch {
			return null;
		}
	}

	/**
	 * Builds artwork array for MediaMetadata with standard multi-resolution specs.
	 */
	private buildArtworkEntries(src: string): MediaImage[] {
		const type = src.startsWith("data:image/png") ? "image/png" : "image/jpeg";
		return [
			{ src, sizes: "96x96", type },
			{ src, sizes: "128x128", type },
			{ src, sizes: "192x192", type },
			{ src, sizes: "256x256", type },
			{ src, sizes: "384x384", type },
			{ src, sizes: "512x512", type },
		];
	}

	/**
	 * Updates notification / lock-screen track metadata (title, artist, album, cover art).
	 */
	public updateMetadata(track: TFile, trackInfo?: TrackInfo, coverUrl?: string): void {
		if (!this.isAvailable) return;

		try {
			const title = trackInfo?.title || track.basename;
			const artist = trackInfo?.artist || "Unknown Artist";
			const album = trackInfo?.album || "Unknown Album";

			const artwork: MediaImage[] = [];
			const isSupportedUrl = Boolean(
				coverUrl && (
					coverUrl.startsWith("http://") ||
					coverUrl.startsWith("https://") ||
					coverUrl.startsWith("data:") ||
					coverUrl.startsWith("blob:") ||
					coverUrl.startsWith("app:") ||
					coverUrl.startsWith("capacitor:") ||
					coverUrl.startsWith("file:")
				)
			);

			if (coverUrl && isSupportedUrl) {
				artwork.push(...this.buildArtworkEntries(coverUrl));
			}

			if (typeof MediaMetadata !== "undefined") {
				navigator.mediaSession.metadata = new MediaMetadata({
					title,
					artist,
					album,
					artwork,
				});

				// On Android WebView, blob: and capacitor: URIs cannot be resolved by Android SystemUI across IPC.
				// Asynchronously convert to a Base64 data: URI and update metadata artwork for native notification rendering.
				if (coverUrl && (coverUrl.startsWith("blob:") || coverUrl.startsWith("capacitor:") || coverUrl.startsWith("app:"))) {
					void this.convertCoverToDataUri(coverUrl).then((dataUri) => {
						if (dataUri && navigator.mediaSession.metadata) {
							navigator.mediaSession.metadata.artwork = this.buildArtworkEntries(dataUri);
						}
					});
				}
			}
		} catch (e) {
			console.warn("Failed to update MediaSession metadata:", e);
		}
	}

	/**
	 * Syncs playback state ("playing" | "paused" | "none") with the OS.
	 */
	public updatePlaybackState(isPlaying: boolean): void {
		if (!this.isAvailable) return;

		try {
			navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
		} catch (e) {
			console.warn("Failed to update MediaSession playback state:", e);
		}
	}

	/**
	 * Syncs playback timeline (duration, position, rate) with lock screen scrubbers.
	 */
	public updatePositionState(duration: number, currentTime: number, playbackRate: number = 1.0): void {
		if (!this.isAvailable) return;
		if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime) || currentTime < 0) return;

		try {
			if ("setPositionState" in navigator.mediaSession && typeof navigator.mediaSession.setPositionState === "function") {
				navigator.mediaSession.setPositionState({
					duration: Math.max(duration, 0),
					playbackRate: Math.max(0.25, Math.min(playbackRate, 4.0)),
					position: Math.max(0, Math.min(currentTime, duration)),
				});
			}
		} catch {
			// Ignore minor position state timing conflicts during seeks
		}
	}

	/**
	 * Cleans up media session handlers and resets metadata.
	 */
	public destroy(): void {
		if (!this.isAvailable) return;

		try {
			const ms = navigator.mediaSession;
			ms.metadata = null;
			ms.playbackState = "none";
			const actions: MediaSessionAction[] = [
				"play",
				"pause",
				"previoustrack",
				"nexttrack",
				"seekto",
				"seekbackward",
				"seekforward",
			];
			for (const action of actions) {
				try {
					ms.setActionHandler(action, null);
				} catch {
					// Ignore unsupported action unbinding
				}
			}
		} catch {
			// Ignore cleanup errors
		}
	}
}
