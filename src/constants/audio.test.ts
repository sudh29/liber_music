import { describe, expect, it } from "vite-plus/test";
import {
	DEFAULT_PLAYBACK_RATE,
	DEFAULT_VOLUME,
	isSupportedAudioExtension,
	SUPPORTED_AUDIO_FORMATS,
} from "./audio";

describe("audio constants and extension validation", () => {
	it("should have expected supported formats and defaults", () => {
		expect(SUPPORTED_AUDIO_FORMATS).toEqual([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]);
		expect(DEFAULT_VOLUME).toBe(1.0);
		expect(DEFAULT_PLAYBACK_RATE).toBe(1.0);
	});

	it("should identify supported extensions with or without leading dot", () => {
		expect(isSupportedAudioExtension("mp3")).toBe(true);
		expect(isSupportedAudioExtension(".mp3")).toBe(true);
		expect(isSupportedAudioExtension("wav")).toBe(true);
		expect(isSupportedAudioExtension(".wav")).toBe(true);
		expect(isSupportedAudioExtension("ogg")).toBe(true);
		expect(isSupportedAudioExtension(".ogg")).toBe(true);
		expect(isSupportedAudioExtension("flac")).toBe(true);
		expect(isSupportedAudioExtension(".flac")).toBe(true);
		expect(isSupportedAudioExtension("m4a")).toBe(true);
		expect(isSupportedAudioExtension(".m4a")).toBe(true);
		expect(isSupportedAudioExtension("aac")).toBe(true);
		expect(isSupportedAudioExtension(".aac")).toBe(true);
	});

	it("should be case-insensitive", () => {
		expect(isSupportedAudioExtension("MP3")).toBe(true);
		expect(isSupportedAudioExtension(".WAV")).toBe(true);
		expect(isSupportedAudioExtension(".FlAc")).toBe(true);
		expect(isSupportedAudioExtension("OGG")).toBe(true);
	});

	it("should reject unsupported extensions and non-string inputs", () => {
		expect(isSupportedAudioExtension("txt")).toBe(false);
		expect(isSupportedAudioExtension(".lrc")).toBe(false);
		expect(isSupportedAudioExtension(".mp4")).toBe(false);
		expect(isSupportedAudioExtension(".jpg")).toBe(false);
		expect(isSupportedAudioExtension("")).toBe(false);
		expect(isSupportedAudioExtension(null)).toBe(false);
		expect(isSupportedAudioExtension(undefined)).toBe(false);
		expect(isSupportedAudioExtension(123)).toBe(false);
		expect(isSupportedAudioExtension({})).toBe(false);
	});
});
