import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Platform } from "obsidian";
import {
	decodeOggVorbis,
	isNativeOggSupported,
	pcmToAudioBuffer,
	pcmToWavBuffer,
	shouldTranscodeVorbis,
	transcodeOggVorbisToWavBlob,
} from "./vorbisDecoder";

describe("vorbisDecoder", () => {
	const originalAudio = globalThis.Audio;
	const originalIsIosApp = Platform.isIosApp;
	const originalIsSafari = (Platform as any).isSafari;

	beforeEach(() => {
		Platform.isIosApp = false;
		(Platform as any).isSafari = false;
	});

	afterEach(() => {
		globalThis.Audio = originalAudio;
		Platform.isIosApp = originalIsIosApp;
		(Platform as any).isSafari = originalIsSafari;
		vi.restoreAllMocks();
	});

	describe("isNativeOggSupported", () => {
		it("returns false if Audio is undefined", () => {
			(globalThis as any).Audio = undefined;
			expect(isNativeOggSupported()).toBe(false);
		});

		it("returns true if canPlayType returns 'probably' or 'maybe'", () => {
			globalThis.Audio = class {
				canPlayType() {
					return "probably";
				}
			} as any;
			expect(isNativeOggSupported()).toBe(true);

			globalThis.Audio = class {
				canPlayType() {
					return "maybe";
				}
			} as any;
			expect(isNativeOggSupported()).toBe(true);
		});

		it("returns false if canPlayType returns empty string or throws", () => {
			globalThis.Audio = class {
				canPlayType() {
					return "";
				}
			} as any;
			expect(isNativeOggSupported()).toBe(false);

			globalThis.Audio = class {
				canPlayType() {
					throw new Error("Audio error");
				}
			} as any;
			expect(isNativeOggSupported()).toBe(false);
		});
	});

	describe("shouldTranscodeVorbis", () => {
		it("returns false for non-vorbis extensions", () => {
			expect(shouldTranscodeVorbis("mp3")).toBe(false);
			expect(shouldTranscodeVorbis("wav")).toBe(false);
			expect(shouldTranscodeVorbis("flac")).toBe(false);
			expect(shouldTranscodeVorbis("m4a")).toBe(false);
		});

		it("returns true for ogg/opus when forceTranscode is true", () => {
			expect(shouldTranscodeVorbis("ogg", true)).toBe(true);
			expect(shouldTranscodeVorbis("opus", true)).toBe(true);
		});

		it("returns true on iOS or Safari platform", () => {
			Platform.isIosApp = true;
			expect(shouldTranscodeVorbis("ogg")).toBe(true);
			expect(shouldTranscodeVorbis("opus")).toBe(true);

			Platform.isIosApp = false;
			(Platform as any).isSafari = true;
			expect(shouldTranscodeVorbis("ogg")).toBe(true);
		});

		it("checks native support on non-Apple platform", () => {
			Platform.isIosApp = false;
			(Platform as any).isSafari = false;

			globalThis.Audio = class {
				canPlayType() {
					return "";
				}
			} as any;
			expect(shouldTranscodeVorbis("ogg")).toBe(true);

			globalThis.Audio = class {
				canPlayType() {
					return "probably";
				}
			} as any;
			expect(shouldTranscodeVorbis("ogg")).toBe(false);
		});
	});

	describe("pcmToWavBuffer", () => {
		it("generates a valid RIFF WAV header and 16-bit PCM samples", () => {
			const sampleRate = 44100;
			const samples = 10;
			const ch0 = new Float32Array([0, 0.5, 1.0, 1.5, -0.5, -1.0, -1.5, 0.1, -0.1, 0]);
			const ch1 = new Float32Array([0, -0.5, -1.0, -1.5, 0.5, 1.0, 1.5, -0.1, 0.1, 0]);

			const buffer = pcmToWavBuffer([ch0, ch1], sampleRate, samples);
			expect(buffer.byteLength).toBe(44 + samples * 2 * 2);

			const view = new DataView(buffer);
			// Check RIFF
			const riff = String.fromCharCode(
				view.getUint8(0),
				view.getUint8(1),
				view.getUint8(2),
				view.getUint8(3)
			);
			expect(riff).toBe("RIFF");
			expect(view.getUint32(4, true)).toBe(36 + samples * 2 * 2);

			// Check WAVE
			const wave = String.fromCharCode(
				view.getUint8(8),
				view.getUint8(9),
				view.getUint8(10),
				view.getUint8(11)
			);
			expect(wave).toBe("WAVE");

			// Check fmt
			expect(view.getUint16(20, true)).toBe(1); // PCM
			expect(view.getUint16(22, true)).toBe(2); // 2 channels
			expect(view.getUint32(24, true)).toBe(sampleRate);
			expect(view.getUint32(28, true)).toBe(sampleRate * 2 * 2); // Byte rate
			expect(view.getUint16(32, true)).toBe(4); // Block align
			expect(view.getUint16(34, true)).toBe(16); // 16 bits

			// Check data
			const data = String.fromCharCode(
				view.getUint8(36),
				view.getUint8(37),
				view.getUint8(38),
				view.getUint8(39)
			);
			expect(data).toBe("data");
			expect(view.getUint32(40, true)).toBe(samples * 2 * 2);

			// Sample 2 (1.0 clamped) -> max 0x7fff (32767)
			expect(view.getInt16(44 + 2 * 4, true)).toBe(32767);
			// Sample 3 (1.5 clamped to 1.0) -> max 0x7fff (32767)
			expect(view.getInt16(44 + 3 * 4, true)).toBe(32767);
			// Sample 5 (-1.0) -> -32768
			expect(view.getInt16(44 + 5 * 4, true)).toBe(-32768);
		});

		it("handles mono channel correctly", () => {
			const sampleRate = 22050;
			const samples = 4;
			const ch0 = new Float32Array([0, 0.25, -0.25, 0]);

			const buffer = pcmToWavBuffer([ch0], sampleRate, samples);
			expect(buffer.byteLength).toBe(44 + samples * 1 * 2);

			const view = new DataView(buffer);
			expect(view.getUint16(22, true)).toBe(1); // 1 channel
			expect(view.getUint32(24, true)).toBe(sampleRate);
			expect(view.getUint16(32, true)).toBe(2); // Block align = 2
		});
	});

	describe("pcmToAudioBuffer", () => {
		it("copies planar channel data into AudioBuffer", () => {
			const ch0 = new Float32Array([0.1, 0.2]);
			const ch1 = new Float32Array([-0.1, -0.2]);

			const copyToChannelMock = vi.fn();
			const mockAudioBuffer = {
				copyToChannel: copyToChannelMock,
			};

			const mockAudioContext = {
				createBuffer: vi.fn().mockReturnValue(mockAudioBuffer),
			} as unknown as AudioContext;

			const result = pcmToAudioBuffer([ch0, ch1], 44100, 2, mockAudioContext);
			expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(2, 2, 44100);
			expect(copyToChannelMock).toHaveBeenCalledTimes(2);
			expect(result).toBe(mockAudioBuffer);
		});
	});

	describe("decodeOggVorbis and transcodeOggVorbisToWavBlob", () => {
		it("decodes vorbis data and converts to WAV blob", async () => {
			const fakePcm = {
				channelData: [new Float32Array([0.1, 0.2]), new Float32Array([-0.1, -0.2])],
				samplesDecoded: 2,
				sampleRate: 44100,
				bitDepth: 16 as const,
				errors: [],
			};

			const wavBuf = pcmToWavBuffer(fakePcm.channelData, fakePcm.sampleRate, fakePcm.samplesDecoded);
			const blob = new Blob([wavBuf], { type: "audio/wav" });
			expect(blob.type).toBe("audio/wav");
			expect(blob.size).toBe(44 + 2 * 2 * 2);
		});

		it("executes decodeOggVorbis and transcodeOggVorbisToWavBlob with binary buffer", async () => {
			const fs = await import("fs");
			const path = await import("path");
			const fixturePath = path.resolve(process.cwd(), "tests/fixtures/sample.ogg");
			const oggBuffer = fs.readFileSync(fixturePath);

			const decoded = await decodeOggVorbis(new Uint8Array(oggBuffer));
			expect(decoded).toBeDefined();
			expect(decoded.channelData.length).toBeGreaterThanOrEqual(1);
			expect(decoded.sampleRate).toBe(44100);
			expect(decoded.samplesDecoded).toBeGreaterThan(0);
			expect(decoded.bitDepth).toBe(16);

			// Test with ArrayBuffer input
			const blob = await transcodeOggVorbisToWavBlob(oggBuffer.buffer.slice(oggBuffer.byteOffset, oggBuffer.byteOffset + oggBuffer.byteLength));
			expect(blob.type).toBe("audio/wav");
			expect(blob.size).toBeGreaterThan(44);
		});
	});
});
