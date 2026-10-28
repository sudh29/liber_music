/**
 * Mock HTML5 Audio Element simulator for testing AudioService and playback flows.
 */

export class MockAudioElement extends EventTarget {
	public src: string = "";
	public currentTime: number = 0;
	public duration: number = 180; // default 3 minutes
	public volume: number = 1.0;
	public playbackRate: number = 1.0;
	public paused: boolean = true;
	public ended: boolean = false;
	public readyState: number = 4; // HAVE_ENOUGH_DATA
	public error: MediaError | null = null;

	constructor(src?: string) {
		super();
		if (src) {
			this.src = src;
		}
	}

	async play(): Promise<void> {
		this.paused = false;
		this.ended = false;
		this.dispatchEvent(new Event("play"));
		return Promise.resolve();
	}

	pause(): void {
		this.paused = true;
		this.dispatchEvent(new Event("pause"));
	}

	load(): void {
		this.dispatchEvent(new Event("loadstart"));
	}

	// Simulation helper methods
	_simulateLoadedMetadata(duration: number): void {
		this.duration = duration;
		this.dispatchEvent(new Event("loadedmetadata"));
	}

	_simulateTimeUpdate(time: number): void {
		this.currentTime = time;
		this.dispatchEvent(new Event("timeupdate"));
	}

	_simulateSeeked(): void {
		this.dispatchEvent(new Event("seeked"));
	}

	_simulateEnded(): void {
		this.ended = true;
		this.paused = true;
		this.currentTime = this.duration;
		this.dispatchEvent(new Event("ended"));
	}

	_simulateError(message: string = "Audio decoding error"): void {
		this.error = {
			code: 4,
			message,
			MEDIA_ERR_ABORTED: 1,
			MEDIA_ERR_NETWORK: 2,
			MEDIA_ERR_DECODE: 3,
			MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
		} as MediaError;
		this.dispatchEvent(new Event("error"));
	}
}

/**
 * Installs MockAudioElement into the global scope if window/global is present.
 */
export function installMockAudio(): () => void {
	const originalAudio = (globalThis as any).Audio;
	(globalThis as any).Audio = MockAudioElement as any;

	return () => {
		(globalThis as any).Audio = originalAudio;
	};
}

export class MockAudioParam {
	public value: number;
	public defaultValue: number;
	public minValue: number;
	public maxValue: number;

	constructor(defaultValue: number, min = -Infinity, max = Infinity) {
		this.value = defaultValue;
		this.defaultValue = defaultValue;
		this.minValue = min;
		this.maxValue = max;
	}

	setValueAtTime(value: number, _startTime: number): this {
		this.value = value;
		return this;
	}

	linearRampToValueAtTime(value: number, _endTime: number): this {
		this.value = value;
		return this;
	}

	exponentialRampToValueAtTime(value: number, _endTime: number): this {
		this.value = value;
		return this;
	}
}

export class MockAudioNode {
	public context: MockAudioContext;
	public connectedNodes: (MockAudioNode | MockAudioParam)[] = [];

	constructor(context: MockAudioContext) {
		this.context = context;
	}

	connect(destination: MockAudioNode | MockAudioParam): any {
		this.connectedNodes.push(destination);
		return destination;
	}

	disconnect(): void {
		this.connectedNodes = [];
	}
}

export class MockGainNode extends MockAudioNode {
	public gain: MockAudioParam;
	constructor(context: MockAudioContext, defaultGain = 1.0) {
		super(context);
		this.gain = new MockAudioParam(defaultGain);
	}
}

export class MockBiquadFilterNode extends MockAudioNode {
	public type: string = "peaking";
	public frequency: MockAudioParam;
	public Q: MockAudioParam;
	public gain: MockAudioParam;

	constructor(context: MockAudioContext) {
		super(context);
		this.frequency = new MockAudioParam(350, 0, 24000);
		this.Q = new MockAudioParam(1, 0.0001, 1000);
		this.gain = new MockAudioParam(0, -40, 40);
	}
}

export class MockMediaElementAudioSourceNode extends MockAudioNode {
	public mediaElement: HTMLAudioElement;
	constructor(context: MockAudioContext, mediaElement: HTMLAudioElement) {
		super(context);
		this.mediaElement = mediaElement;
	}
}

export class MockAnalyserNode extends MockAudioNode {
	public fftSize: number = 64;
	public frequencyBinCount: number = 32;
	public minDecibels: number = -100;
	public maxDecibels: number = -30;
	public smoothingTimeConstant: number = 0.8;

	getByteFrequencyData(array: Uint8Array): void {
		for (let i = 0; i < array.length; i++) {
			array[i] = Math.max(0, 160 - i * 4);
		}
	}

	getByteTimeDomainData(array: Uint8Array): void {
		for (let i = 0; i < array.length; i++) {
			array[i] = 128;
		}
	}
}

export class MockAudioContext extends EventTarget {
	public state: "suspended" | "running" | "closed" = "suspended";
	public currentTime: number = 0;
	public destination: MockAudioNode;
	private attachedElements = new WeakSet<any>();

	constructor() {
		super();
		this.destination = new MockAudioNode(this);
	}

	async resume(): Promise<void> {
		this.state = "running";
		this.dispatchEvent(new Event("statechange"));
	}

	async suspend(): Promise<void> {
		this.state = "suspended";
		this.dispatchEvent(new Event("statechange"));
	}

	async close(): Promise<void> {
		this.state = "closed";
		this.dispatchEvent(new Event("statechange"));
	}

	createGain(): MockGainNode {
		return new MockGainNode(this);
	}

	createBiquadFilter(): MockBiquadFilterNode {
		return new MockBiquadFilterNode(this);
	}

	createAnalyser(): MockAnalyserNode {
		return new MockAnalyserNode(this);
	}

	createMediaElementSource(element: HTMLAudioElement): MockMediaElementAudioSourceNode {
		if (this.attachedElements.has(element)) {
			const err = new DOMException("MediaElementAudioSourceNode already created for this element", "InvalidStateError");
			throw err;
		}
		this.attachedElements.add(element);
		return new MockMediaElementAudioSourceNode(this, element);
	}
}

/**
 * Installs MockAudioContext into globalThis.
 */
export function installMockWebAudio(): () => void {
	const originalContext = (globalThis as any).AudioContext;
	const originalWebkit = (globalThis as any).webkitAudioContext;

	(globalThis as any).AudioContext = MockAudioContext as any;
	(globalThis as any).webkitAudioContext = MockAudioContext as any;

	return () => {
		(globalThis as any).AudioContext = originalContext;
		(globalThis as any).webkitAudioContext = originalWebkit;
	};
}
