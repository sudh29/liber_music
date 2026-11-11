// @vitest-environment happy-dom
import "@/../tests/setup-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { ViewSetupService } from "./ViewSetupService";
import type { MusicPlayerView } from "@/views/MusicPlayerView";

// Mock MusicPlayerRoot to keep ViewSetupService test lightweight and focused
vi.mock("@/components", () => ({
	MusicPlayerRoot: () => null,
}));

describe("ViewSetupService", () => {
	it("should set up view DOM with leafContent, header, and content container", () => {
		const app = new App();
		const service = new ViewSetupService(app);

		const wrapper = document.createElement("div");
		wrapper.className = "workspace-leaf-content";

		const viewHeader = document.createElement("div");
		viewHeader.className = "view-header";
		wrapper.appendChild(viewHeader);

		const viewContent = document.createElement("div");
		viewContent.className = "view-content";
		wrapper.appendChild(viewContent);

		const containerEl = document.createElement("div");
		viewContent.appendChild(containerEl);

		const mockView = {} as unknown as MusicPlayerView;

		const result = service.setupView(containerEl, mockView);

		expect(wrapper.classList.contains("music-player")).toBe(true);
		expect(viewContent.classList.contains("music-player")).toBe(true);
		expect(result.container).toBe(viewContent);
		expect(result.navHost).toBeUndefined();
		expect(result.reactRoot).toBeDefined();
		expect(viewContent.querySelector(".music-player-react-root")).not.toBeNull();
	});

	it("should reuse existing navHost and clean up old react mount points", () => {
		const app = new App();
		const service = new ViewSetupService(app);

		const wrapper = document.createElement("div");
		wrapper.className = "workspace-leaf-content";

		const existingNavHost = document.createElement("nav-header");
		existingNavHost.innerHTML = "<span>old</span>";
		wrapper.appendChild(existingNavHost);

		const containerEl = document.createElement("div");
		const oldMount = document.createElement("div");
		oldMount.className = "music-player-react-root";
		containerEl.appendChild(oldMount);
		wrapper.appendChild(containerEl);

		const mockView = {} as unknown as MusicPlayerView;

		const result = service.setupView(containerEl, mockView);

		expect(existingNavHost.classList.contains("music-player")).toBe(true);
		expect(existingNavHost.innerHTML).toBe("");
		expect(result.container.querySelectorAll(".music-player-react-root").length).toBe(1);
		expect(result.navHost).toBe(existingNavHost);
	});

	it("should fall back to container children when no leafContent is present", () => {
		const app = new App();
		const service = new ViewSetupService(app);

		const containerEl = document.createElement("div");
		const child = document.createElement("div");
		containerEl.appendChild(child);

		const mockView = {} as unknown as MusicPlayerView;
		const result = service.setupView(containerEl, mockView);

		expect(result.container).toBe(child);
	});

	it("should throw error if content container cannot be located", () => {
		const app = new App();
		const service = new ViewSetupService(app);

		const containerEl = document.createElement("div");
		// No children, no leafContent

		const mockView = {} as unknown as MusicPlayerView;
		expect(() => service.setupView(containerEl, mockView)).toThrow(
			"Unable to locate content container"
		);
	});
});
