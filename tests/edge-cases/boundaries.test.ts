// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { App } from "obsidian";
import { LyricsParser } from "@/utils/lyrics/parser";
import { parseLyricsOffset } from "@/utils/lyrics/offset";
import { applyReplayGainToVolume, parseReplayGain } from "@/utils/audio/replayGain";
import { scanVaultAudioFiles } from "@/utils/library/scanVaultAudio";
import { StateService } from "@/services/StateService";
import { AudioService } from "@/services/AudioService";

describe("Phase 6: Edge Cases & Stress Boundaries Matrix", () => {
	describe("1. Lyrics Parser Edge Cases", () => {
		it("should parse multi-timestamp single line lyrics ([00:10.00][00:25.00] Chorus)", () => {
			const lrc = "[00:10.00][00:25.00]Repeating Chorus";
			const parsed = LyricsParser.parseLRC(lrc);

			expect(parsed).toHaveLength(2);
			expect(parsed[0]).toEqual({ time: 10, text: "Repeating Chorus" });
			expect(parsed[1]).toEqual({ time: 25, text: "Repeating Chorus" });
		});

		it("should sort out-of-order lyric timestamps chronologically", () => {
			const lrc = "[00:30.00]Third line\n[00:10.00]First line\n[00:20.00]Second line";
			const parsed = LyricsParser.parseLRC(lrc);

			expect(parsed.map((p) => p.text)).toEqual(["First line", "Second line", "Third line"]);
			expect(parsed.map((p) => p.time)).toEqual([10, 20, 30]);
		});

		it("should handle negative and large offsets safely in seconds", () => {
			expect(parseLyricsOffset("[offset:-2500]")).toBe(-2.5);
			expect(parseLyricsOffset("[offset:+150000]")).toBe(150);
			expect(parseLyricsOffset("[offset:invalid]")).toBe(0);
			expect(parseLyricsOffset("")).toBe(0);
		});

		it("should handle empty or whitespace-only .lrc strings gracefully", () => {
			expect(LyricsParser.parseLRC("")).toEqual([]);
			expect(LyricsParser.parseLRC("   \n\t  \n")).toEqual([]);
		});
	});

	describe("2. ReplayGain & Loudness Edge Cases", () => {
		it("should clamp extreme high track gain (+18.0 dB) to avoid audio clipping", () => {
			const baseVolume = 1.0;
			const compensated = applyReplayGainToVolume(baseVolume, 18.0);
			expect(compensated).toBeLessThanOrEqual(1.0);
			expect(compensated).toBeGreaterThanOrEqual(0.0);
		});

		it("should clamp extreme negative track gain (-35.0 dB) without going negative", () => {
			const baseVolume = 0.5;
			const compensated = applyReplayGainToVolume(baseVolume, -35.0);
			expect(compensated).toBeGreaterThanOrEqual(0.0);
		});

		it("should handle NaN or undefined replayGainDb safely", () => {
			expect(applyReplayGainToVolume(0.8, NaN)).toBe(0.8);
			expect(applyReplayGainToVolume(0.8, undefined)).toBe(0.8);
			expect(parseReplayGain("invalid")).toBeUndefined();
			expect(parseReplayGain("-6.2 dB")).toBe(-6.2);
		});
	});

	describe("3. Audio & State Boundary Clamping", () => {
		it("should clamp volume and rate at extreme values in StateService", () => {
			const state = new StateService(-5.0, 99.0);
			expect(state.getState().volume).toBe(0.0);
			expect(state.getState().playbackRate).toBe(4.0);
		});

		it("should clamp seek times safely when duration is 0 or negative", () => {
			const app = new App();
			const audioService = new AudioService(app);
			const clamp = (audioService as any).clampSeekTimeToPlayableEnd;

			expect(clamp(10, 0)).toBe(0);
			expect(clamp(10, -5)).toBe(0);
			expect(clamp(-10, 100)).toBe(0);
			expect(clamp(150, 100)).toBeLessThan(100);
		});
	});

	describe("4. Library & File System Boundary Cases", () => {
		it("should handle audio files with unicode characters, emojis, and spaces", () => {
			const app = new App();
			app.vault.createFile("Music/🎵 Anime/01. 炎 - LiSA.mp3");
			app.vault.createFile("Music/Special's & Quotes/track.flac");

			const files = scanVaultAudioFiles(app, "Music");
			expect(files).toHaveLength(2);
			expect(files.some((f) => f.path.includes("炎"))).toBe(true);
			expect(files.some((f) => f.path.includes("Quotes"))).toBe(true);
		});

		it("should handle non-existent or deleted music folder gracefully", () => {
			const app = new App();
			const files = scanVaultAudioFiles(app, "DeletedFolder/Nested/Path");
			expect(files).toEqual([]);
		});
	});
});
