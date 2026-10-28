import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { AudioService } from "./AudioService";
import { installMockAudio, MockAudioElement } from "../../tests/mocks/audio";

describe("AudioService", () => {
	let app: App;
	let audioService: AudioService;
	let uninstallAudio: () => void;

	beforeEach(() => {
		uninstallAudio = installMockAudio();
		app = new App();
		audioService = new AudioService(app);

		// Mock URL.createObjectURL and URL.revokeObjectURL
		(globalThis as any).URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-uuid");
		(globalThis as any).URL.revokeObjectURL = vi.fn();
	});

	afterEach(() => {
		uninstallAudio();
		vi.restoreAllMocks();
	});

	it("should create audio element with Blob URL and bind event listeners", async () => {
		const trackFile = app.vault.createFile("music/song.mp3", new ArrayBuffer(1024));
		const handlers = {
			onTimeUpdate: vi.fn(),
			onLoadedMetadata: vi.fn(),
			onEnded: vi.fn(),
		};

		const audioEl = await audioService.createAudioElement(trackFile, 0.8, 1.25, handlers);

		expect(audioEl).toBeDefined();
		expect(audioEl.volume).toBe(0.8);
		expect(audioEl.playbackRate).toBe(1.25);
		expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);

		// Dispatch events on audio element
		audioEl.dispatchEvent(new Event("timeupdate"));
		expect(handlers.onTimeUpdate).toHaveBeenCalledTimes(1);

		audioEl.dispatchEvent(new Event("loadedmetadata"));
		expect(handlers.onLoadedMetadata).toHaveBeenCalledTimes(1);

		audioEl.dispatchEvent(new Event("ended"));
		expect(handlers.onEnded).toHaveBeenCalledTimes(1);
	});

	it("should fall back to getResourcePath if blob creation fails", async () => {
		const trackFile = app.vault.createFile("music/fallback.mp3");
		app.vault.readBinary = vi.fn().mockRejectedValue(new Error("Disk read failed"));

		const handlers = {
			onTimeUpdate: vi.fn(),
			onLoadedMetadata: vi.fn(),
			onEnded: vi.fn(),
		};

		const audioEl = await audioService.createAudioElement(trackFile, 0.5, 1.0, handlers);
		expect(audioEl.src).toBe("app://obsidian.md/music/fallback.mp3");
	});

	it("should revoke previous Blob URL when cleaning up or creating new audio element", async () => {
		const track1 = app.vault.createFile("song1.mp3", new ArrayBuffer(512));
		const track2 = app.vault.createFile("song2.mp3", new ArrayBuffer(512));
		const handlers = { onTimeUpdate: vi.fn(), onLoadedMetadata: vi.fn(), onEnded: vi.fn() };

		await audioService.createAudioElement(track1, 1, 1, handlers);
		expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();

		await audioService.createAudioElement(track2, 1, 1, handlers);
		expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/test-uuid");

		await audioService.cleanup();
		expect(audioService.getAudioElement()).toBeNull();
	});

	it("should control play, pause, seek, volume, and playback rate", async () => {
		const track = app.vault.createFile("song.mp3", new ArrayBuffer(100));
		const audioEl = (await audioService.createAudioElement(track, 0.5, 1.0, {
			onTimeUpdate: vi.fn(),
			onLoadedMetadata: vi.fn(),
			onEnded: vi.fn(),
		})) as unknown as MockAudioElement;

		audioEl.duration = 200;

		await audioService.play();
		expect(audioEl.paused).toBe(false);

		audioService.pause();
		expect(audioEl.paused).toBe(true);

		audioService.setVolume(0.9);
		expect(audioEl.volume).toBe(0.9);

		// Clamping volume between 0 and 1
		audioService.setVolume(1.5);
		expect(audioEl.volume).toBe(1.0);
		audioService.setVolume(-0.2);
		expect(audioEl.volume).toBe(0.0);

		audioService.setPlaybackRate(1.5);
		expect(audioEl.playbackRate).toBe(1.5);

		// Clamping rate between 0.25 and 4.0
		audioService.setPlaybackRate(5.0);
		expect(audioEl.playbackRate).toBe(4.0);
		audioService.setPlaybackRate(0.1);
		expect(audioEl.playbackRate).toBe(0.25);

		// Seeking with playable end clamp
		audioService.seekToRatio(0.5);
		expect(audioEl.currentTime).toBe(100);

		audioService.seekForward(5);
		expect(audioEl.currentTime).toBe(105);

		audioService.seekBackward(10);
		expect(audioEl.currentTime).toBe(95);
	});

	it("should clamp seek time safely when duration is 0 or negative", () => {
		const track = app.vault.createFile("zero.mp3", new ArrayBuffer(10));
		// Use private method via casting for edge cases
		const clamp = (audioService as any).clampSeekTimeToPlayableEnd;
		expect(clamp(50, 0)).toBe(0);
		expect(clamp(50, -10)).toBe(0);
		expect(clamp(NaN, 100)).toBe(0);
		expect(clamp(50, NaN)).toBe(0);
	});

	it("should map MIME types accurately for audio codecs", () => {
		const getMime = (audioService as any).getMimeType.bind(audioService);
		expect(getMime("mp3")).toBe("audio/mpeg");
		expect(getMime("wav")).toBe("audio/wav");
		expect(getMime("ogg")).toBe("audio/ogg");
		expect(getMime("flac")).toBe("audio/flac");
		expect(getMime("aac")).toBe("audio/aac");
		expect(getMime("m4a")).toBe("audio/mp4");
		expect(getMime("opus")).toBe("audio/opus");
		expect(getMime("unknown")).toBe("audio/mpeg");
	});

	it("should trigger onEnded on seeked event if currentTime is at or near media end", async () => {
		const track = app.vault.createFile("nearEnd.mp3", new ArrayBuffer(100));
		const onEnded = vi.fn();
		const audioEl = (await audioService.createAudioElement(track, 1, 1, {
			onTimeUpdate: vi.fn(),
			onLoadedMetadata: vi.fn(),
			onEnded,
		})) as unknown as MockAudioElement;

		audioEl.duration = 100;
		audioEl.currentTime = 99.99995; // at duration - 1e-4

		audioEl._simulateSeeked();
		expect(onEnded).toHaveBeenCalledTimes(1);
	});

	it("should trigger onError handler when audio error event occurs", async () => {
		const track = app.vault.createFile("corrupt.mp3", new ArrayBuffer(50));
		const onError = vi.fn();
		const audioEl = await audioService.createAudioElement(track, 1, 1, {
			onTimeUpdate: vi.fn(),
			onLoadedMetadata: vi.fn(),
			onEnded: vi.fn(),
			onError,
		});

		audioEl.dispatchEvent(new Event("error"));
		expect(onError).toHaveBeenCalledTimes(1);
	});

	it("should handle null audioElement safely across all methods", async () => {
		// When audioElement is null
		expect(audioService.getAudioElement()).toBeNull();
		await expect(audioService.play()).resolves.toBeUndefined();
		expect(() => audioService.pause()).not.toThrow();
		expect(() => audioService.setVolume(0.5)).not.toThrow();
		expect(() => audioService.setPlaybackRate(1.5)).not.toThrow();
		expect(() => audioService.seekToRatio(0.5)).not.toThrow();
		expect(() => audioService.seekForward(5)).not.toThrow();
		expect(() => audioService.seekBackward(5)).not.toThrow();
	});

	it("should swallow AbortError and rethrow other errors in play()", async () => {
		const track = app.vault.createFile("abort.mp3", new ArrayBuffer(50));
		const audioEl = (await audioService.createAudioElement(track, 1, 1, {
			onTimeUpdate: vi.fn(),
			onLoadedMetadata: vi.fn(),
			onEnded: vi.fn(),
		})) as unknown as MockAudioElement;

		// 1. AbortError is caught silently
		vi.spyOn(audioEl, "play").mockRejectedValueOnce(new DOMException("Interrupted", "AbortError"));
		await expect(audioService.play()).resolves.toBeUndefined();

		// 2. Other errors are rethrown
		vi.spyOn(audioEl, "play").mockRejectedValueOnce(new Error("Network error"));
		await expect(audioService.play()).rejects.toThrow("Network error");
	});

	it("should integrate with EqualizerService on createAudioElement and play", async () => {
		const mockEq = {
			attachAudioElement: vi.fn(),
			resumeContext: vi.fn().mockResolvedValue(undefined),
		} as any;

		audioService.setEqualizerService(mockEq);

		const track = app.vault.createFile("eq_track.mp3", new ArrayBuffer(50));
		const audioEl = await audioService.createAudioElement(track, 1, 1, {
			onTimeUpdate: vi.fn(),
			onLoadedMetadata: vi.fn(),
			onEnded: vi.fn(),
		});

		expect(mockEq.attachAudioElement).toHaveBeenCalledWith(audioEl);

		await audioService.play();
		expect(mockEq.resumeContext).toHaveBeenCalledTimes(1);
	});
});
