import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MediaSessionService, MediaSessionCallbacks } from "./MediaSessionService";
import { TFile } from "obsidian";

describe("MediaSessionService", () => {
	let mockMediaSession: {
		metadata: unknown;
		playbackState: string;
		setActionHandler: ReturnType<typeof vi.fn>;
		setPositionState: ReturnType<typeof vi.fn>;
	};
	let callbacks: MediaSessionCallbacks;

	beforeEach(() => {
		mockMediaSession = {
			metadata: null,
			playbackState: "none",
			setActionHandler: vi.fn(),
			setPositionState: vi.fn(),
		};

		if (typeof (globalThis as any).navigator === "undefined") {
			(globalThis as any).navigator = { mediaSession: mockMediaSession };
		} else {
			(globalThis.navigator as any).mediaSession = mockMediaSession;
		}
		if (typeof window !== "undefined" && window.navigator) {
			(window.navigator as unknown as { mediaSession: unknown }).mediaSession = mockMediaSession;
		}

		class MockMediaMetadata {
			title?: string;
			artist?: string;
			album?: string;
			artwork?: any[];
			constructor(init: any) {
				Object.assign(this, init);
			}
		}
		(globalThis as any).MediaMetadata = MockMediaMetadata;

		callbacks = {
			onPlay: vi.fn(),
			onPause: vi.fn(),
			onPrevious: vi.fn(),
			onNext: vi.fn(),
			onSeekTo: vi.fn(),
			onSeekBackward: vi.fn(),
			onSeekForward: vi.fn(),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should register OS action handlers on initialization", () => {
		new MediaSessionService(callbacks);

		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("play", expect.any(Function));
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("pause", expect.any(Function));
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("previoustrack", expect.any(Function));
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("nexttrack", expect.any(Function));
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekto", expect.any(Function));
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekbackward", expect.any(Function));
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekforward", expect.any(Function));
	});

	it("should trigger callbacks when action handlers are invoked", () => {
		new MediaSessionService(callbacks);

		const handlers = new Map<string, (details?: unknown) => void>();
		for (const call of mockMediaSession.setActionHandler.mock.calls) {
			handlers.set(call[0], call[1]);
		}

		handlers.get("play")?.();
		expect(callbacks.onPlay).toHaveBeenCalledTimes(1);

		handlers.get("pause")?.();
		expect(callbacks.onPause).toHaveBeenCalledTimes(1);

		handlers.get("previoustrack")?.();
		expect(callbacks.onPrevious).toHaveBeenCalledTimes(1);

		handlers.get("nexttrack")?.();
		expect(callbacks.onNext).toHaveBeenCalledTimes(1);

		handlers.get("seekto")?.({ seekTime: 42 });
		expect(callbacks.onSeekTo).toHaveBeenCalledWith(42);

		handlers.get("seekbackward")?.({ seekOffset: 15 });
		expect(callbacks.onSeekBackward).toHaveBeenCalledWith(15);

		handlers.get("seekforward")?.({ seekOffset: 15 });
		expect(callbacks.onSeekForward).toHaveBeenCalledWith(15);
	});

	it("should update metadata and artwork", () => {
		const service = new MediaSessionService(callbacks);
		const mockFile = { basename: "Song", path: "Music/Song.mp3" } as TFile;

		service.updateMetadata(
			mockFile,
			{ title: "My Song", artist: "Artist A", album: "Album B" },
			"data:image/jpeg;base64,1234"
		);

		expect(mockMediaSession.metadata).toBeDefined();
	});

	it("should update playback state", () => {
		const service = new MediaSessionService(callbacks);

		service.updatePlaybackState(true);
		expect(mockMediaSession.playbackState).toBe("playing");

		service.updatePlaybackState(false);
		expect(mockMediaSession.playbackState).toBe("paused");
	});

	it("should sync position state with clamp safety", () => {
		const service = new MediaSessionService(callbacks);

		service.updatePositionState(200, 50, 1.25);
		expect(mockMediaSession.setPositionState).toHaveBeenCalledWith({
			duration: 200,
			playbackRate: 1.25,
			position: 50,
		});

		// Clamping position beyond duration
		service.updatePositionState(200, 250, 1.0);
		expect(mockMediaSession.setPositionState).toHaveBeenCalledWith({
			duration: 200,
			playbackRate: 1.0,
			position: 200,
		});
	});

	it("should clean up handlers and state on destroy", () => {
		const service = new MediaSessionService(callbacks);
		service.destroy();

		expect(mockMediaSession.metadata).toBeNull();
		expect(mockMediaSession.playbackState).toBe("none");
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("play", null);
		expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("pause", null);
	});

	it("should support PNG data URL and HTTP cover art in metadata", () => {
		const service = new MediaSessionService(callbacks);
		const mockFile = { basename: "Song", path: "Music/Song.mp3" } as TFile;

		service.updateMetadata(mockFile, undefined, "data:image/png;base64,pngdata");
		expect(mockMediaSession.metadata).toBeDefined();

		service.updateMetadata(mockFile, undefined, "http://localhost/cover.jpg");
		expect(mockMediaSession.metadata).toBeDefined();

		service.updateMetadata(mockFile, undefined, "blob:http://localhost/uuid");
		expect(mockMediaSession.metadata).toBeDefined();
	});

	it("should ignore position state sync when duration is invalid or 0", () => {
		const service = new MediaSessionService(callbacks);
		mockMediaSession.setPositionState.mockClear();

		service.updatePositionState(0, 10, 1.0);
		service.updatePositionState(-50, 10, 1.0);
		service.updatePositionState(NaN, 10, 1.0);
		service.updatePositionState(100, -10, 1.0);

		expect(mockMediaSession.setPositionState).not.toHaveBeenCalled();
	});

	it("should handle exceptions in MediaSession calls gracefully", () => {
		mockMediaSession.setActionHandler.mockImplementation(() => {
			throw new Error("Action not supported");
		});

		expect(() => new MediaSessionService(callbacks)).not.toThrow();
	});
});
