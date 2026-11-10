/**
 * Audiophile 10-Band Graphic & Parametric Equalizer Web Audio Service
 * 
 * Manages the Web Audio DSP node graph:
 * [MediaElementSource] -> [Preamp Gain] -> [10 BiquadFilterNodes] -> [Master Gain] -> [Destination]
 * 
 * Delivers bit-transparent bypass when disabled (0dB filters) and smooth
 * real-time parameter modulation without audio clicks or dropouts.
 */

import {
	clampEqGain,
	dbToGain,
	EQ_BAND_CONFIGS,
	EQ_BAND_COUNT,
	EQ_PRESETS,
	normalizeEqBands,
} from "@/utils/audio/equalizer";

export interface EqState {
	enabled: boolean;
	preset: string;
	bands: number[];
	preampDb: number;
}

export interface AudioSpectrumEnergy {
	bass: number;
	mid: number;
	treble: number;
	overall: number;
}

export class EqualizerService {
	private audioContext: AudioContext | null = null;
	private activeElement: HTMLAudioElement | null = null;
	private sourceNode: MediaElementAudioSourceNode | null = null;
	private preampNode: GainNode | null = null;
	private filterNodes: BiquadFilterNode[] = [];
	private masterGainNode: GainNode | null = null;
	private analyserNode: AnalyserNode | null = null;
	private frequencyDataBuffer: Uint8Array | null = null;
	private elementSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

	private enabled: boolean = false;
	private preset: string = "Flat";
	private bands: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	private preampDb: number = 0;

	private isDisposed: boolean = false;

	private onStateChange?: (state: EqState) => void;

	constructor(
		initialSettings?: {
			enabled?: boolean;
			preset?: string;
			bands?: number[];
			preampGainDb?: number;
		},
		onStateChange?: (state: EqState) => void
	) {
		this.enabled = initialSettings?.enabled ?? false;
		this.preset = initialSettings?.preset ?? "Flat";
		this.bands = normalizeEqBands(initialSettings?.bands);
		this.preampDb = clampEqGain(initialSettings?.preampGainDb ?? 0);
		this.onStateChange = onStateChange;
	}

	/**
	 * Gets or lazily creates the Web Audio AudioContext.
	 */
	getAudioContext(): AudioContext | null {
		if (this.isDisposed) {
			return null;
		}

		if (this.audioContext) {
			return this.audioContext;
		}

		if (typeof window === "undefined") {
			return null;
		}

		const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!AudioCtx) {
			return null;
		}

		try {
			this.audioContext = new AudioCtx();
			this.initNodeGraph();
			return this.audioContext;
		} catch (error) {
			console.warn("Failed to initialize AudioContext for EqualizerService:", error);
			return null;
		}
	}

	/**
	 * Resumes audio context if currently suspended (e.g. following browser autoplay policies).
	 */
	async resumeContext(): Promise<void> {
		const ctx = this.getAudioContext();
		if (ctx && ctx.state === "suspended") {
			try {
				await ctx.resume();
			} catch (error) {
				console.debug("AudioContext resume failed:", error);
			}
		}
	}

	/**
	 * Builds the core filter and gain graph.
	 */
	private initNodeGraph(): void {
		if (!this.audioContext) return;

		this.preampNode = this.audioContext.createGain();
		this.masterGainNode = this.audioContext.createGain();
		this.filterNodes = [];

		let prevNode: AudioNode = this.preampNode;

		for (let i = 0; i < EQ_BAND_COUNT; i++) {
			const config = EQ_BAND_CONFIGS[i] ?? { frequency: 1000, type: "peaking", q: 1.41 };
			const filter = this.audioContext.createBiquadFilter();
			filter.type = config.type;
			filter.frequency.value = config.frequency;
			filter.Q.value = config.q;
			filter.gain.value = 0; // default flat

			prevNode.connect(filter);
			prevNode = filter;
			this.filterNodes.push(filter);
		}

		this.analyserNode = this.audioContext.createAnalyser();
		this.analyserNode.fftSize = 64; // 32 frequency bins
		this.analyserNode.smoothingTimeConstant = 0.8;
		this.frequencyDataBuffer = new Uint8Array(this.analyserNode.frequencyBinCount);

		prevNode.connect(this.masterGainNode);
		this.masterGainNode.connect(this.audioContext.destination);
		this.masterGainNode.connect(this.analyserNode);

		this.applyGainsToGraph();
	}

	/**
	 * Attaches an HTMLAudioElement to the Web Audio processing graph.
	 *
	 * Safe against duplicate attachments on the same audio element.
	 */
	attachAudioElement(element: HTMLAudioElement): boolean {
		const ctx = this.getAudioContext();
		if (!ctx) return false;

		if (this.activeElement === element && this.sourceNode) {
			return true;
		}

		try {
			// Disconnect previous source if different
			if (this.sourceNode) {
				try {
					this.sourceNode.disconnect();
				} catch {
					// Ignore disconnect error
				}
			}

			// Retrieve cached MediaElementSource or construct once
			let source = this.elementSources.get(element);
			if (!source) {
				source = ctx.createMediaElementSource(element);
				this.elementSources.set(element, source);
			}

			this.activeElement = element;
			this.sourceNode = source;

			if (this.preampNode) {
				this.sourceNode.connect(this.preampNode);
			}

			void this.resumeContext();
			return true;
		} catch (error) {
			console.warn("EqualizerService failed to attach audio element:", error);
			return false;
		}
	}

	/**
	 * Applies current gains and preamp values to the DSP nodes.
	 */
	private applyGainsToGraph(): void {
		if (!this.preampNode || this.filterNodes.length === 0) {
			return;
		}

		if (!this.enabled) {
			// Bit-transparent bypass: 0dB across all filters and unity preamp
			this.preampNode.gain.value = 1.0;
			for (const filter of this.filterNodes) {
				filter.gain.value = 0;
			}
			return;
		}

		// Apply preamp gain
		this.preampNode.gain.value = dbToGain(this.preampDb);

		// Apply band gains
		for (let i = 0; i < this.filterNodes.length; i++) {
			const filter = this.filterNodes[i];
			const gain = this.bands[i] ?? 0;
			if (filter) {
				filter.gain.value = gain;
			}
		}
	}

	/**
	 * Returns whether Equalizer DSP is active.
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Gets current preset identifier.
	 */
	getCurrentPreset(): string {
		return this.preset;
	}

	/**
	 * Toggles Equalizer on/off.
	 */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		this.applyGainsToGraph();
		this.emitChange();
	}

	/**
	 * Selects an acoustic preset profile.
	 */
	setPreset(presetName: string): boolean {
		const presetBands = EQ_PRESETS[presetName];
		if (!presetBands) return false;

		this.preset = presetName;
		this.bands = [...presetBands];
		this.applyGainsToGraph();
		this.emitChange();
		return true;
	}

	/**
	 * Sets the gain in dB for a specific octave band (0-9).
	 */
	setBandGain(bandIndex: number, gainDb: number): void {
		if (bandIndex < 0 || bandIndex >= EQ_BAND_COUNT) return;

		const clamped = clampEqGain(gainDb);
		this.bands[bandIndex] = clamped;

		// Match existing preset if identical, otherwise 'Custom'
		this.preset = this.detectPresetName(this.bands);

		if (this.enabled && this.filterNodes[bandIndex]) {
			this.filterNodes[bandIndex].gain.value = clamped;
		}

		this.emitChange();
	}

	/**
	 * Sets all 10 band gains at once.
	 */
	setBands(bands: number[]): void {
		this.bands = normalizeEqBands(bands);
		this.preset = this.detectPresetName(this.bands);
		this.applyGainsToGraph();
		this.emitChange();
	}

	/**
	 * Sets preamp gain in dB (-12 to +12).
	 */
	setPreamp(gainDb: number): void {
		this.preampDb = clampEqGain(gainDb);
		if (this.enabled && this.preampNode) {
			this.preampNode.gain.value = dbToGain(this.preampDb);
		}
		this.emitChange();
	}

	/**
	 * Resets EQ to Flat 0dB profile.
	 */
	reset(): void {
		this.setPreset("Flat");
		this.setPreamp(0);
	}

	/**
	 * Returns current EQ state.
	 */
	getState(): EqState {
		return {
			enabled: this.enabled,
			preset: this.preset,
			bands: [...this.bands],
			preampDb: this.preampDb,
		};
	}

	/**
	 * Detects whether given band array matches a named preset.
	 */
	private detectPresetName(bands: number[]): string {
		for (const [name, presetBands] of Object.entries(EQ_PRESETS)) {
			if (presetBands.every((val, idx) => Math.abs(val - (bands[idx] ?? 0)) < 0.05)) {
				return name;
			}
		}
		return "Custom";
	}

	private emitChange(): void {
		this.onStateChange?.(this.getState());
	}

	/**
	 * Gets real-time audio spectrum frequency data array (0-255 per bin).
	 */
	getFrequencyData(): Uint8Array | null {
		if (!this.analyserNode) {
			const ctx = this.getAudioContext();
			if (!ctx || !this.analyserNode) return null;
		}
		if (!this.analyserNode || !this.frequencyDataBuffer) return null;
		this.analyserNode.getByteFrequencyData(this.frequencyDataBuffer as Uint8Array<ArrayBuffer>);
		return this.frequencyDataBuffer;
	}

	/**
	 * Computes normalized frequency energy (0.0 - 1.0) for bass, midrange, treble, and overall.
	 */
	getSpectrumEnergy(): AudioSpectrumEnergy {
		const data = this.getFrequencyData();
		if (!data || data.length === 0) {
			return { bass: 0, mid: 0, treble: 0, overall: 0 };
		}

		const len = data.length;
		const bassEnd = Math.max(1, Math.floor(len * 0.25));
		const midEnd = Math.max(bassEnd + 1, Math.floor(len * 0.75));

		let bassSum = 0;
		for (let i = 0; i < bassEnd; i++) bassSum += data[i]!;
		const bass = Math.min(1.0, bassSum / (bassEnd * 255));

		let midSum = 0;
		for (let i = bassEnd; i < midEnd; i++) midSum += data[i]!;
		const mid = Math.min(1.0, midSum / ((midEnd - bassEnd) * 255));

		let trebleSum = 0;
		for (let i = midEnd; i < len; i++) trebleSum += data[i]!;
		const treble = Math.min(1.0, trebleSum / ((len - midEnd) * 255));

		let totalSum = 0;
		for (let i = 0; i < len; i++) totalSum += data[i]!;
		const overall = Math.min(1.0, totalSum / (len * 255));

		return {
			bass: Math.round(bass * 100) / 100,
			mid: Math.round(mid * 100) / 100,
			treble: Math.round(treble * 100) / 100,
			overall: Math.round(overall * 100) / 100,
		};
	}

	/**
	 * Returns the internal Web Audio AnalyserNode.
	 */
	getAnalyserNode(): AnalyserNode | null {
		return this.analyserNode;
	}

	/**
	 * Disposes audio context and disconnects all nodes.
	 */
	async dispose(): Promise<void> {
		this.isDisposed = true;
		if (this.sourceNode) {
			try {
				this.sourceNode.disconnect();
			} catch {
				// Ignore source disconnect error
			}
			this.sourceNode = null;
		}

		if (this.analyserNode) {
			try {
				this.analyserNode.disconnect();
			} catch {
				// Ignore analyser disconnect error
			}
			this.analyserNode = null;
		}
		this.frequencyDataBuffer = null;

		if (this.audioContext && this.audioContext.state !== "closed") {
			try {
				await this.audioContext.close();
			} catch {
				// Ignore audio context close error
			}
			this.audioContext = null;
		}

		this.activeElement = null;
		this.preampNode = null;
		this.filterNodes = [];
		this.masterGainNode = null;
	}
}
