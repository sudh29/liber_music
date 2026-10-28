// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodeblockCoordinator } from "./coordinator";

describe("CodeblockCoordinator", () => {
	let coordinator: CodeblockCoordinator;
	let audio1: HTMLAudioElement;
	let audio2: HTMLAudioElement;

	beforeEach(() => {
		coordinator = new CodeblockCoordinator();
		audio1 = document.createElement("audio");
		audio2 = document.createElement("audio");
		vi.spyOn(audio1, "pause").mockImplementation(() => {});
		vi.spyOn(audio2, "pause").mockImplementation(() => {});
	});

	it("should register playing audio and pause previous audio", () => {
		const onStop1 = vi.fn();
		coordinator.registerPlaying(audio1, onStop1);
		expect(coordinator.getActiveAudio()).toBe(audio1);

		const onStop2 = vi.fn();
		coordinator.registerPlaying(audio2, onStop2);
		expect(audio1.pause).toHaveBeenCalled();
		expect(onStop1).toHaveBeenCalled();
		expect(coordinator.getActiveAudio()).toBe(audio2);
	});

	it("should trigger global pause callback when audio starts", () => {
		const globalPause = vi.fn();
		coordinator.setGlobalPauseCallback(globalPause);

		coordinator.registerPlaying(audio1);
		expect(globalPause).toHaveBeenCalledTimes(1);
	});

	it("should unregister audio cleanly when finished", () => {
		coordinator.registerPlaying(audio1);
		coordinator.unregisterPlaying(audio1);
		expect(coordinator.getActiveAudio()).toBeNull();
	});

	it("should stop active audio and invoke callback on stopActive", () => {
		const onStop = vi.fn();
		coordinator.registerPlaying(audio1, onStop);

		coordinator.stopActive();
		expect(audio1.pause).toHaveBeenCalled();
		expect(onStop).toHaveBeenCalled();
		expect(coordinator.getActiveAudio()).toBeNull();
	});
});
