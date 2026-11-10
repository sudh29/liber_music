// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { setupKeyboardShortcuts } from "./shortcuts";
import { MusicPlayerView } from "@/views/MusicPlayerView";

describe("keyboard/shortcuts utilities", () => {
	function createMockView() {
		const container = document.createElement("div");
		document.body.appendChild(container);

		const mockView = {
			containerEl: container,
			plugin: {
				app: {
					workspace: {
						getActiveViewOfType: vi.fn(),
					},
				},
			},
			togglePlay: vi.fn(),
			playPrevious: vi.fn(),
			playNext: vi.fn(),
			seekBackward: vi.fn(),
			seekForward: vi.fn(),
		} as unknown as MusicPlayerView;

		// Default view is active
		(mockView.plugin.app.workspace.getActiveViewOfType as any).mockReturnValue(mockView);

		return { mockView, container };
	}

	it("should trigger togglePlay on Space key", () => {
		const { mockView } = createMockView();
		const handler = setupKeyboardShortcuts(mockView);

		window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
		expect(mockView.togglePlay).toHaveBeenCalledTimes(1);

		handler.cleanup();
	});

	it("should trigger playPrevious on ArrowUp and playNext on ArrowDown", () => {
		const { mockView } = createMockView();
		const handler = setupKeyboardShortcuts(mockView);

		window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", bubbles: true }));
		expect(mockView.playPrevious).toHaveBeenCalledTimes(1);

		window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowDown", bubbles: true }));
		expect(mockView.playNext).toHaveBeenCalledTimes(1);

		handler.cleanup();
	});

	it("should trigger seekBackward(5) on ArrowLeft and seekForward(5) on ArrowRight", () => {
		const { mockView } = createMockView();
		const handler = setupKeyboardShortcuts(mockView);

		window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft", bubbles: true }));
		expect(mockView.seekBackward).toHaveBeenCalledWith(5);

		window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight", bubbles: true }));
		expect(mockView.seekForward).toHaveBeenCalledWith(5);

		handler.cleanup();
	});

	it("should trigger seekBackward(15) and seekForward(15) with Ctrl key", () => {
		const { mockView } = createMockView();
		const handler = setupKeyboardShortcuts(mockView);

		window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft", ctrlKey: true, bubbles: true }));
		expect(mockView.seekBackward).toHaveBeenCalledWith(15);

		window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight", ctrlKey: true, bubbles: true }));
		expect(mockView.seekForward).toHaveBeenCalledWith(15);

		handler.cleanup();
	});

	it("should trigger seekBackward(15) and seekForward(15) with Meta key (Cmd on macOS/iPadOS)", () => {
		const { mockView } = createMockView();
		const handler = setupKeyboardShortcuts(mockView);

		window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft", metaKey: true, bubbles: true }));
		expect(mockView.seekBackward).toHaveBeenCalledWith(15);

		window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight", metaKey: true, bubbles: true }));
		expect(mockView.seekForward).toHaveBeenCalledWith(15);

		handler.cleanup();
	});

	it("should ignore shortcuts when view is not connected to DOM", () => {
		const { mockView, container } = createMockView();
		container.remove(); // disconnect from DOM

		const handler = setupKeyboardShortcuts(mockView);
		window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
		expect(mockView.togglePlay).not.toHaveBeenCalled();

		handler.cleanup();
	});

	it("should ignore shortcuts when view is not the active workspace leaf", () => {
		const { mockView } = createMockView();
		(mockView.plugin.app.workspace.getActiveViewOfType as any).mockReturnValue(null);

		const handler = setupKeyboardShortcuts(mockView);
		window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
		expect(mockView.togglePlay).not.toHaveBeenCalled();

		handler.cleanup();
	});

	it("should ignore shortcuts when focus is inside an input or textarea element", () => {
		const { mockView } = createMockView();
		const handler = setupKeyboardShortcuts(mockView);

		const input = document.createElement("input");
		document.body.appendChild(input);

		const event = new KeyboardEvent("keydown", { code: "Space", bubbles: true });
		Object.defineProperty(event, "target", { value: input });

		window.dispatchEvent(event);
		expect(mockView.togglePlay).not.toHaveBeenCalled();

		input.remove();
		handler.cleanup();
	});

	it("should stop listening after cleanup is called", () => {
		const { mockView } = createMockView();
		const handler = setupKeyboardShortcuts(mockView);

		handler.cleanup();
		window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true }));
		expect(mockView.togglePlay).not.toHaveBeenCalled();
	});
});
