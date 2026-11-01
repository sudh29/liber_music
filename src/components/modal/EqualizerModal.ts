/**
 * Audiophile 10-Band Graphic Equalizer Modal
 * 
 * Provides an interactive modal window with:
 * - Master bypass switch
 * - Acoustic presets selector
 * - Preamp gain control
 * - 10 ISO octave frequency vertical sliders (31Hz to 16kHz)
 */

import { App, Modal, Setting } from "obsidian";
import type MusicPlayerPlugin from "@/main";
import { EqualizerService } from "@/services/EqualizerService";
import {
	EQ_BAND_COUNT,
	EQ_FREQUENCIES,
	EQ_PRESETS,
	formatEqFrequency,
} from "@/utils/audio/equalizer";
import { t } from "@/utils/i18n/i18n";
import "./EqualizerModal.css";

// Safe DOM helper functions
function createDiv(parent: HTMLElement, className?: string): HTMLDivElement {
	return parent.createDiv({ cls: className });
}

function createSpan(parent: HTMLElement, className?: string, text?: string): HTMLSpanElement {
	return parent.createSpan({ cls: className, text });
}

function createEl<K extends keyof HTMLElementTagNameMap>(
	parent: HTMLElement,
	tag: K,
	options?: { cls?: string; text?: string; type?: string; value?: string }
): HTMLElementTagNameMap[K] {
	return parent.createEl(tag, options);
}

export class EqualizerModal extends Modal {
	private bandBadges: HTMLSpanElement[] = [];
	private bandSliders: HTMLInputElement[] = [];
	private presetSelect: HTMLSelectElement | null = null;
	private preampBadge: HTMLSpanElement | null = null;
	private preampSlider: HTMLInputElement | null = null;
	private toggleSwitch: HTMLInputElement | null = null;

	constructor(
		app: App,
		public plugin: MusicPlayerPlugin,
		public equalizerService: EqualizerService
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		if (typeof contentEl.empty === "function") {
			contentEl.empty();
		} else {
			while (contentEl.firstChild) {
				contentEl.removeChild(contentEl.firstChild);
			}
		}

		this.modalEl.addClass("music-player-eq-modal");

		const state = this.equalizerService.getState();

		// Header Row
		const header = createDiv(contentEl, "music-player-eq-header");
		const title = createDiv(header, "music-player-eq-title");
		title.textContent = t("equalizer.title") || "10-Band Equalizer";

		// Master Toggle Switch
		const toggleWrap = createDiv(header, "music-player-eq-toggle-wrap");
		const toggleLabel = createSpan(
			toggleWrap,
			`music-player-eq-toggle-label ${state.enabled ? "active" : ""}`,
			state.enabled ? (t("equalizer.active") || "Active") : (t("equalizer.bypassed") || "Bypassed")
		);

		new Setting(toggleWrap).addToggle((toggle) => {
			toggle.setValue(state.enabled);
			toggle.onChange((val) => {
				this.equalizerService.setEnabled(val);
				toggleLabel.textContent = val ? (t("equalizer.active") || "Active") : (t("equalizer.bypassed") || "Bypassed");
				if (val) {
					toggleLabel.addClass("active");
				} else {
					toggleLabel.removeClass("active");
				}
			});
			this.toggleSwitch = toggle?.toggleEl?.find ? (toggle.toggleEl.find("input") as HTMLInputElement) : null;
		});

		// Controls Bar (Presets + Reset)
		const controlsRow = createDiv(contentEl, "music-player-eq-controls-row");

		const selectWrap = createDiv(controlsRow);
		const select = createEl(selectWrap, "select", { cls: "music-player-eq-preset-select" });
		this.presetSelect = select;

		const presets = Object.keys(EQ_PRESETS);
		for (const presetName of presets) {
			const opt = createEl(select, "option", { text: presetName, value: presetName });
			opt.selected = presetName === state.preset;
		}
		// Custom option
		const customOpt = createEl(select, "option", { text: "Custom", value: "Custom" });
		customOpt.selected = state.preset === "Custom";

		select.addEventListener("change", (e) => {
			const target = e.target as HTMLSelectElement | null;
			const val = target?.value ?? select.value;
			if (val !== "Custom") {
				this.equalizerService.setPreset(val);
				this.updateSlidersFromState();
			}
		});

		const resetBtn = createEl(controlsRow, "button", { cls: "music-player-eq-btn", text: t("equalizer.reset") || "Reset" });

		resetBtn.addEventListener("click", () => {
			this.equalizerService.reset();
			this.updateSlidersFromState();
		});

		// Preamp Slider
		const preampRow = createDiv(contentEl, "music-player-eq-preamp-row");
		const preampLabel = createSpan(preampRow, "music-player-eq-preamp-label", t("equalizer.preamp") || "Preamp");
		preampLabel.textContent = t("equalizer.preamp") || "Preamp";

		const pSlider = createEl(preampRow, "input", { cls: "music-player-eq-preamp-slider" });
		pSlider.type = "range";
		pSlider.min = "-12";
		pSlider.max = "12";
		pSlider.step = "0.5";
		pSlider.value = String(state.preampDb);
		this.preampSlider = pSlider;

		this.preampBadge = createSpan(
			preampRow,
			"music-player-eq-preamp-val",
			this.formatDb(state.preampDb)
		);

		pSlider.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement | null;
			const val = parseFloat(target?.value ?? pSlider.value);
			this.equalizerService.setPreamp(val);
			if (this.preampBadge) {
				this.preampBadge.textContent = this.formatDb(val);
			}
		});

		// 10-Band Sliders Grid
		const bandsGrid = createDiv(contentEl, "music-player-eq-bands-container");
		this.bandBadges = [];
		this.bandSliders = [];

		for (let i = 0; i < EQ_BAND_COUNT; i++) {
			const col = createDiv(bandsGrid, "music-player-eq-band-col");
			const gain = state.bands[i] ?? 0;

			// Value Badge
			const badge = createSpan(
				col,
				`music-player-eq-band-db ${gain > 0 ? "boost" : gain < 0 ? "cut" : ""}`,
				this.formatDb(gain)
			);
			this.bandBadges.push(badge);

			// Track wrapper with zero line
			const trackWrap = createDiv(col, "music-player-eq-slider-track-wrap");
			createDiv(trackWrap, "music-player-eq-zero-line");

			// Vertical Slider
			const slider = createEl(trackWrap, "input", { cls: "music-player-eq-vslider" });
			slider.type = "range";
			slider.min = "-12";
			slider.max = "12";
			slider.step = "0.5";
			slider.value = String(gain);
			this.bandSliders.push(slider);

			slider.addEventListener("input", (e) => {
				const target = e.target as HTMLInputElement | null;
				const val = parseFloat(target?.value ?? slider.value);
				this.equalizerService.setBandGain(i, val);
				badge.textContent = this.formatDb(val);
				badge.className = `music-player-eq-band-db ${val > 0 ? "boost" : val < 0 ? "cut" : ""}`;

				// Update preset selector to 'Custom'
				if (this.presetSelect) {
					this.presetSelect.value = this.equalizerService.getState().preset;
				}
			});

			// Frequency Label
			const freqLabel = createSpan(
				col,
				"music-player-eq-band-freq",
				formatEqFrequency(EQ_FREQUENCIES[i] ?? 1000)
			);
			freqLabel.textContent = formatEqFrequency(EQ_FREQUENCIES[i] ?? 1000);
		}
	}

	private updateSlidersFromState(): void {
		const state = this.equalizerService.getState();

		if (this.presetSelect) {
			this.presetSelect.value = state.preset;
		}

		if (this.preampSlider && this.preampBadge) {
			this.preampSlider.value = String(state.preampDb);
			this.preampBadge.textContent = this.formatDb(state.preampDb);
		}

		for (let i = 0; i < EQ_BAND_COUNT; i++) {
			const gain = state.bands[i] ?? 0;
			const slider = this.bandSliders[i];
			const badge = this.bandBadges[i];

			if (slider) slider.value = String(gain);
			if (badge) {
				badge.textContent = this.formatDb(gain);
				badge.className = `music-player-eq-band-db ${gain > 0 ? "boost" : gain < 0 ? "cut" : ""}`;
			}
		}
	}

	private formatDb(db: number): string {
		if (db > 0) return `+${db.toFixed(1)} dB`;
		if (db === 0) return "0.0 dB";
		return `${db.toFixed(1)} dB`;
	}

	onClose(): void {
		const { contentEl } = this;
		if (typeof contentEl.empty === "function") {
			contentEl.empty();
		} else {
			while (contentEl.firstChild) {
				contentEl.removeChild(contentEl.firstChild);
			}
		}
	}
}
