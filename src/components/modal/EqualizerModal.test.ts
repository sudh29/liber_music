import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { EqualizerModal } from "./EqualizerModal";
import { EqualizerService } from "../../services/EqualizerService";
import { installMockAudio, installMockWebAudio } from "../../../tests/mocks/audio";

describe("EqualizerModal", () => {
	let app: App;
	let eqService: EqualizerService;
	let uninstallAudio: () => void;
	let uninstallWebAudio: () => void;
	let plugin: any;

	beforeEach(() => {
		uninstallAudio = installMockAudio();
		uninstallWebAudio = installMockWebAudio();
		app = new App();
		eqService = new EqualizerService({
			enabled: true,
			preset: "Bass Boost",
			preampGainDb: 2.0,
		});
		plugin = {
			settings: {},
			saveSettings: vi.fn(),
		};
	});

	afterEach(() => {
		uninstallAudio();
		uninstallWebAudio();
		vi.restoreAllMocks();
	});

	it("should open modal and render 10 frequency sliders and preamp", () => {
		const modal = new EqualizerModal(app, plugin, eqService);
		modal.onOpen();

		expect(modal.contentEl).toBeDefined();

		// Check title rendered
		const title = modal.contentEl.querySelector(".music-player-eq-title");
		expect(title).toBeDefined();

		// Check preamp slider rendered
		const preamp = modal.contentEl.querySelector(".music-player-eq-preamp-slider") as HTMLInputElement;
		expect(preamp).toBeDefined();
		expect(preamp.value).toBe("2");

		// Check 10 vertical band sliders
		const sliders = modal.contentEl.querySelectorAll(".music-player-eq-vslider");
		expect(sliders.length).toBe(10);

		// Check frequency labels
		const freqs = modal.contentEl.querySelectorAll(".music-player-eq-band-freq");
		expect(freqs.length).toBe(10);
		expect(freqs[0]?.textContent).toBe("31Hz");
		expect(freqs[9]?.textContent).toBe("16kHz");
	});

	it("should handle live slider adjustments", () => {
		const modal = new EqualizerModal(app, plugin, eqService);
		modal.onOpen();

		const sliders = modal.contentEl.querySelectorAll(".music-player-eq-vslider");
		const firstSlider = sliders[0] as HTMLInputElement;

		firstSlider.value = "6";
		firstSlider.dispatchEvent(new Event("input"));

		expect(eqService.getState().bands[0]).toBe(6);
		expect(eqService.getState().preset).toBe("Custom");

		// Adjust preamp
		const preamp = modal.contentEl.querySelector(".music-player-eq-preamp-slider") as HTMLInputElement;
		preamp.value = "4";
		preamp.dispatchEvent(new Event("input"));

		expect(eqService.getState().preampDb).toBe(4);
	});

	it("should handle preset changes and reset button", () => {
		const modal = new EqualizerModal(app, plugin, eqService);
		modal.onOpen();

		const presetSelect = modal.contentEl.querySelector(".music-player-eq-preset-select") as HTMLSelectElement;
		presetSelect.value = "Rock & Metal";
		presetSelect.dispatchEvent(new Event("change"));

		expect(eqService.getState().preset).toBe("Rock & Metal");

		// Click reset button
		const resetBtn = modal.contentEl.querySelector(".music-player-eq-btn") as HTMLButtonElement;
		resetBtn.click();

		expect(eqService.getState().preset).toBe("Flat");
		expect(eqService.getState().preampDb).toBe(0);
	});

	it("should clean up content on close", () => {
		const modal = new EqualizerModal(app, plugin, eqService);
		modal.onOpen();
		expect(modal.contentEl.children.length).toBeGreaterThan(0);

		modal.onClose();
		expect(modal.contentEl.children.length).toBe(0);
	});
});
