// @vitest-environment happy-dom
import "../../setup-dom";
import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import {
	createPlayingIndicator,
	createPlayPlaceholderSVG,
	renderTrackItemContent,
} from "@/utils/ui/trackItemRenderer";

describe("ui/trackItemRenderer", () => {
	it("should create SVG play icon placeholder", () => {
		const container = document.createElement("div");
		const svg = createPlayPlaceholderSVG(container);

		expect(svg).toBeDefined();
		expect(svg.tagName.toLowerCase()).toBe("svg");
		expect(svg.getAttribute("width")).toBe("24");
	});

	it("should create playing indicator with 4 equalizer bars", () => {
		const container = document.createElement("div");
		createPlayingIndicator(container);

		expect(container.getAttribute("aria-label")).toBe("Playing");
		const bars = container.querySelectorAll(".equalizer-bar");
		expect(bars).toHaveLength(4);
	});

	it("should render track item DOM content with cached cover", () => {
		const container = document.createElement("div");
		const file = new TFile("music/track.mp3");
		const coverCache = new Map<string, string>([["music/track.mp3", "app://cover.jpg"]]);

		const coverEl = renderTrackItemContent(container, {
			file,
			track: { title: "Track Title", artist: "Artist Name", album: "Album Name" } as any,
			isActive: false,
			coverCache,
		});

		expect(coverEl).toBeDefined();
		expect(container.querySelector(".playlist-item-title")?.textContent).toBe("Track Title");
		expect(container.querySelector(".playlist-item-meta")?.textContent).toContain("Artist Name • Album Name");

		const img = container.querySelector("img");
		expect(img?.src).toBe("app://cover.jpg");
	});

	it("should render active playing indicator when isActive is true", () => {
		const container = document.createElement("div");
		const file = new TFile("music/active.mp3");

		renderTrackItemContent(container, {
			file,
			isActive: true,
			coverCache: new Map(),
		});

		expect(container.querySelector(".playing-indicator")).toBeDefined();
	});

	it("should attach observer when cover is not cached", () => {
		const container = document.createElement("div");
		const file = new TFile("music/uncached.mp3");
		const observer = { observe: vi.fn() } as unknown as IntersectionObserver;

		renderTrackItemContent(container, {
			file,
			isActive: false,
			coverCache: new Map(),
			observer,
		});

		expect(observer.observe).toHaveBeenCalledTimes(1);
	});
});
