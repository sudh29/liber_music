/**
 * Universal Vorbis WebAssembly Decoder and Transcoder
 * 
 * Provides WASM-powered Ogg Vorbis decoding and WAV transcoding
 * to achieve 100% audio codec parity on iOS/iPadOS and Safari.
 */

import { Platform } from "obsidian";
import { OggVorbisDecoder, type OggVorbisDecodedAudio } from "@wasm-audio-decoders/ogg-vorbis";

/**
 * Checks whether the current runtime environment natively supports OGG Vorbis in HTMLAudioElement.
 */
export function isNativeOggSupported(): boolean {
	if (typeof Audio === "undefined") return false;
	try {
		const testAudio = new Audio();
		const canPlay = testAudio.canPlayType('audio/ogg; codecs="vorbis"');
		return canPlay === "probably" || canPlay === "maybe";
	} catch {
		return false;
	}
}

/**
 * Determines whether an audio file needs WASM Vorbis transcoding.
 * Returns true for Ogg Vorbis files on iOS/iPadOS, Safari, or runtimes lacking native OGG support.
 *
 * @param extension - File extension without dot
 * @param forceTranscode - Optional flag to force transcoding (e.g. for testing)
 */
export function shouldTranscodeVorbis(extension: string, forceTranscode = false): boolean {
	const ext = extension?.toLowerCase().trim();
	if (ext !== "ogg" && ext !== "opus") {
		return false;
	}
	if (forceTranscode) {
		return true;
	}
	const isAppleDevice = typeof Platform !== "undefined" && (Platform.isIosApp || (Platform as any).isSafari);
	return isAppleDevice || !isNativeOggSupported();
}

/**
 * Decodes Ogg Vorbis binary audio data to PCM using WebAssembly.
 *
 * @param data - Raw binary Ogg Vorbis ArrayBuffer or Uint8Array
 * @returns Decoded audio object with planar channelData, sampleRate, and samplesDecoded
 */
export async function decodeOggVorbis(
	data: ArrayBuffer | Uint8Array
): Promise<OggVorbisDecodedAudio> {
	const uint8Data = data instanceof Uint8Array ? data : new Uint8Array(data);
	const decoder = new OggVorbisDecoder();
	await decoder.ready;
	try {
		const decoded = await decoder.decodeFile(uint8Data);
		return decoded;
	} finally {
		decoder.free();
	}
}

/**
 * Transcodes planar PCM audio data to a standard 16-bit RIFF WAV ArrayBuffer.
 *
 * @param channelData - Planar Float32Array channel audio samples
 * @param sampleRate - Audio sample rate (e.g. 44100)
 * @param samplesDecoded - Total sample frames per channel
 * @returns Standard 44-byte RIFF WAV binary ArrayBuffer
 */
export function pcmToWavBuffer(
	channelData: Float32Array[],
	sampleRate: number,
	samplesDecoded: number
): ArrayBuffer {
	const numChannels = Math.max(1, channelData.length);
	const dataSize = samplesDecoded * numChannels * 2;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	// Write ASCII string helper
	const writeString = (offset: number, str: string): void => {
		for (let i = 0; i < str.length; i++) {
			view.setUint8(offset + i, str.charCodeAt(i));
		}
	};

	// 0-3: Chunk ID "RIFF"
	writeString(0, "RIFF");
	// 4-7: Chunk Size (36 + SubChunk2Size)
	view.setUint32(4, 36 + dataSize, true);
	// 8-11: Format "WAVE"
	writeString(8, "WAVE");
	// 12-15: Subchunk 1 ID "fmt "
	writeString(12, "fmt ");
	// 16-19: Subchunk 1 Size (16 for PCM)
	view.setUint32(16, 16, true);
	// 20-21: Audio Format (1 = PCM)
	view.setUint16(20, 1, true);
	// 22-23: Num Channels
	view.setUint16(22, numChannels, true);
	// 24-27: Sample Rate
	view.setUint32(24, sampleRate, true);
	// 28-31: Byte Rate (SampleRate * NumChannels * BitsPerSample/8)
	view.setUint32(28, sampleRate * numChannels * 2, true);
	// 32-33: Block Align (NumChannels * BitsPerSample/8)
	view.setUint16(32, numChannels * 2, true);
	// 34-35: Bits Per Sample (16-bit)
	view.setUint16(34, 16, true);
	// 36-39: Subchunk 2 ID "data"
	writeString(36, "data");
	// 40-43: Subchunk 2 Size
	view.setUint32(40, dataSize, true);

	// Write interleaved 16-bit PCM samples
	let offset = 44;
	for (let i = 0; i < samplesDecoded; i++) {
		for (let ch = 0; ch < numChannels; ch++) {
			const channelSamples = channelData[ch];
			const s = channelSamples ? Math.max(-1, Math.min(1, channelSamples[i] ?? 0)) : 0;
			// Convert float [-1.0, 1.0] to signed 16-bit integer [-32768, 32767]
			const val = s < 0 ? s * 0x8000 : s * 0x7fff;
			view.setInt16(offset, Math.round(val), true);
			offset += 2;
		}
	}

	return buffer;
}

/**
 * Transcodes planar PCM audio data into a Web Audio API AudioBuffer.
 *
 * @param channelData - Planar Float32Array channel audio samples
 * @param sampleRate - Audio sample rate (e.g. 44100)
 * @param samplesDecoded - Total sample frames per channel
 * @param audioContext - Target AudioContext
 */
export function pcmToAudioBuffer(
	channelData: Float32Array[],
	sampleRate: number,
	samplesDecoded: number,
	audioContext: AudioContext
): AudioBuffer {
	const numChannels = Math.max(1, channelData.length);
	const audioBuffer = audioContext.createBuffer(numChannels, samplesDecoded, sampleRate);
	for (let ch = 0; ch < numChannels; ch++) {
		const samples = channelData[ch];
		if (samples) {
			audioBuffer.copyToChannel(samples as any, ch);
		}
	}
	return audioBuffer;
}

/**
 * Transcodes raw Ogg Vorbis binary data to a RIFF WAV Blob.
 *
 * @param data - Raw binary Ogg Vorbis ArrayBuffer or Uint8Array
 * @returns Compliant audio/wav Blob playable by any HTMLAudioElement
 */
export async function transcodeOggVorbisToWavBlob(
	data: ArrayBuffer | Uint8Array
): Promise<Blob> {
	const decoded = await decodeOggVorbis(data);
	const wavBuffer = pcmToWavBuffer(
		decoded.channelData,
		decoded.sampleRate,
		decoded.samplesDecoded
	);
	return new Blob([wavBuffer], { type: "audio/wav" });
}
