// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EqualizerService } from "./EqualizerService";
import {
	installMockAudio,
	installMockWebAudio,
	MockAudioElement,
	MockAudioContext,
} from "../../tests/mocks/audio";
import { EQ_BAND_COUNT, EQ_PRESETS } from "../utils/audio/equalizer";

describe("EqualizerService", () => {
	let uninstallAudio: () => void;
	let uninstallWebAudio: () => void;

	beforeEach(() => {
		uninstallAudio = installMockAudio();
		uninstallWebAudio = installMockWebAudio();
	});

	afterEach(() => {
		uninstallAudio();
		uninstallWebAudio();
		vi.restoreAllMocks();
	});

	it("should initialize with default settings and bypass gains", () => {
		const service = new EqualizerService();
		const state = service.getState();

		expect(state.enabled).toBe(false);
		expect(state.preset).toBe("Flat");
		expect(state.bands.length).toBe(EQ_BAND_COUNT);
		expect(state.bands.every((b) => b === 0)).toBe(true);
		expect(state.preampDb).toBe(0);
	});

	it("should initialize with custom settings", () => {
		const service = new EqualizerService({
			enabled: true,
			preset: "Bass Boost",
			bands: EQ_PRESETS["Bass Boost"],
			preampGainDb: 2.5,
		});
		const state = service.getState();

		expect(state.enabled).toBe(true);
		expect(state.preset).toBe("Bass Boost");
		expect(state.bands).toEqual(EQ_PRESETS["Bass Boost"]);
		expect(state.preampDb).toBe(2.5);
	});

	it("should construct Web Audio node graph and attach audio element", () => {
		const service = new EqualizerService();
		const audioEl = new MockAudioElement("music/track.mp3") as unknown as HTMLAudioElement;

		const attached = service.attachAudioElement(audioEl);
		expect(attached).toBe(true);

		const ctx = service.getAudioContext() as unknown as MockAudioContext;
		expect(ctx).toBeDefined();

		// Calling attach again on the same element should be safe
		const reattached = service.attachAudioElement(audioEl);
		expect(reattached).toBe(true);
	});

	it("should apply bit-transparent bypass when disabled and apply gains when enabled", () => {
		let reportedState: any = null;
		const service = new EqualizerService(
			{
				enabled: false,
				preset: "Bass Boost",
				bands: EQ_PRESETS["Bass Boost"],
				preampGainDb: 3.0,
			},
			(s) => {
				reportedState = s;
			}
		);

		const audioEl = new MockAudioElement() as unknown as HTMLAudioElement;
		service.attachAudioElement(audioEl);

		// Initially disabled
		service.setEnabled(false);
		expect(service.getState().enabled).toBe(false);

		// Enable EQ
		service.setEnabled(true);
		expect(service.getState().enabled).toBe(true);
		expect(reportedState.enabled).toBe(true);
	});

	it("should switch presets and update bands", () => {
		const service = new EqualizerService();
		const audioEl = new MockAudioElement() as unknown as HTMLAudioElement;
		service.attachAudioElement(audioEl);
		service.setEnabled(true);

		const success = service.setPreset("Rock & Metal");
		expect(success).toBe(true);
		expect(service.getState().preset).toBe("Rock & Metal");
		expect(service.getState().bands).toEqual(EQ_PRESETS["Rock & Metal"]);

		const invalid = service.setPreset("NonExistentPreset");
		expect(invalid).toBe(false);
	});

	it("should set individual band gain and detect Custom preset", () => {
		const service = new EqualizerService();
		const audioEl = new MockAudioElement() as unknown as HTMLAudioElement;
		service.attachAudioElement(audioEl);
		service.setEnabled(true);

		service.setBandGain(0, 6.0);
		expect(service.getState().bands[0]).toBe(6.0);
		expect(service.getState().preset).toBe("Custom");

		// Out of bounds band index is ignored
		service.setBandGain(-1, 5.0);
		service.setBandGain(15, 5.0);
		expect(service.getState().bands.length).toBe(10);
	});

	it("should set preamp gain with clamping", () => {
		const service = new EqualizerService();
		const audioEl = new MockAudioElement() as unknown as HTMLAudioElement;
		service.attachAudioElement(audioEl);
		service.setEnabled(true);

		service.setPreamp(4.5);
		expect(service.getState().preampDb).toBe(4.5);

		service.setPreamp(30);
		expect(service.getState().preampDb).toBe(12);

		service.setPreamp(-30);
		expect(service.getState().preampDb).toBe(-12);
	});

	it("should set all bands simultaneously", () => {
		const service = new EqualizerService();
		const newBands = [1, 2, 3, 2, 1, 0, -1, -2, -1, 0];
		service.setBands(newBands);
		expect(service.getState().bands).toEqual(newBands);
		expect(service.getState().preset).toBe("Custom");
	});

	it("should reset to Flat preset", () => {
		const service = new EqualizerService({
			enabled: true,
			preset: "Bass Boost",
			bands: EQ_PRESETS["Bass Boost"],
			preampGainDb: 5,
		});

		service.reset();
		expect(service.getState().preset).toBe("Flat");
		expect(service.getState().bands).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(service.getState().preampDb).toBe(0);
	});

	it("should resume suspended AudioContext", async () => {
		const service = new EqualizerService();
		const ctx = service.getAudioContext() as unknown as MockAudioContext;
		expect(ctx.state).toBe("suspended");

		await service.resumeContext();
		expect(ctx.state).toBe("running");
	});

	it("should clean up cleanly on dispose", async () => {
		const service = new EqualizerService();
		const audioEl = new MockAudioElement() as unknown as HTMLAudioElement;
		service.attachAudioElement(audioEl);

		await service.dispose();
		expect(service.getAudioContext()).toBeNull();
	});

	it("should provide audio spectrum frequency data and energy metrics", () => {
		const service = new EqualizerService();
		const audioEl = new MockAudioElement() as unknown as HTMLAudioElement;
		service.attachAudioElement(audioEl);

		const analyser = service.getAnalyserNode();
		expect(analyser).toBeDefined();

		const freqData = service.getFrequencyData();
		expect(freqData).toBeInstanceOf(Uint8Array);
		expect(freqData?.length).toBe(32);

		const energy = service.getSpectrumEnergy();
		expect(energy.bass).toBeGreaterThanOrEqual(0);
		expect(energy.bass).toBeLessThanOrEqual(1);
		expect(energy.mid).toBeGreaterThanOrEqual(0);
		expect(energy.treble).toBeGreaterThanOrEqual(0);
		expect(energy.overall).toBeGreaterThanOrEqual(0);
	});

	it("should return zero energy when frequency data is unavailable", () => {
		const service = new EqualizerService();
		// No audio element attached, mock getFrequencyData returning null
		vi.spyOn(service, "getFrequencyData").mockReturnValue(null);

		const energy = service.getSpectrumEnergy();
		expect(energy).toEqual({ bass: 0, mid: 0, treble: 0, overall: 0 });
	});

	it("should return null for getFrequencyData if audioContext is unavailable", () => {
		const service = new EqualizerService();
		vi.spyOn(service, "getAudioContext").mockReturnValue(null as any);

		expect(service.getFrequencyData()).toBeNull();
	});

	it("should expose isEnabled and getCurrentPreset getters and detect named presets", () => {
		const service = new EqualizerService();
		expect(service.isEnabled()).toBe(false);
		expect(service.getCurrentPreset()).toBe("Flat");

		service.setEnabled(true);
		expect(service.isEnabled()).toBe(true);

		// Set preset to Rock & Metal
		expect(service.setPreset("Rock & Metal")).toBe(true);
		expect(service.getCurrentPreset()).toBe("Rock & Metal");

		// Set bands matching Bass Boost preset exactly
		service.setBands([...EQ_PRESETS["Bass Boost"]!]);
		expect(service.getCurrentPreset()).toBe("Bass Boost");

		// Custom bands not matching any preset
		service.setBands([1.2, 3.4, 5.6, 0, 0, 0, 0, 0, 0, 0]);
		expect(service.getCurrentPreset()).toBe("Custom");
	});

	it("should handle AudioContext constructor failure gracefully", () => {
		const origAudioContext = (globalThis as any).AudioContext;
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		(globalThis as any).AudioContext = vi.fn().mockImplementation(() => {
			throw new Error("Hardware audio context busy");
		});

		const service = new EqualizerService();
		const ctx = service.getAudioContext();

		expect(ctx).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to initialize AudioContext"),
			expect.any(Error)
		);

		(globalThis as any).AudioContext = origAudioContext;
		warnSpy.mockRestore();
	});

	it("should disconnect previous sourceNode when attaching a different audio element", () => {
		const service = new EqualizerService();
		const audioEl1 = new MockAudioElement("track1.mp3") as unknown as HTMLAudioElement;
		const audioEl2 = new MockAudioElement("track2.mp3") as unknown as HTMLAudioElement;

		expect(service.attachAudioElement(audioEl1)).toBe(true);
		const source1 = (service as any).sourceNode;
		const disconnectSpy = vi.spyOn(source1, "disconnect");

		expect(service.attachAudioElement(audioEl2)).toBe(true);
		expect(disconnectSpy).toHaveBeenCalled();
	});

	it("should catch and log error if createMediaElementSource throws", () => {
		const service = new EqualizerService();
		const audioEl = new MockAudioElement("track1.mp3") as unknown as HTMLAudioElement;
		const ctx = service.getAudioContext()!;
		vi.spyOn(ctx, "createMediaElementSource").mockImplementation(() => {
			throw new Error("CORS or source creation failure");
		});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		expect(service.attachAudioElement(audioEl)).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(
			"EqualizerService failed to attach audio element:",
			expect.any(Error)
		);
		warnSpy.mockRestore();
	});
});
