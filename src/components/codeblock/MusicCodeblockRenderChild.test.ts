// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TFile } from "obsidian";
import { MusicCodeblockRenderChild } from "./MusicCodeblockRenderChild";

describe("MusicCodeblockRenderChild", () => {
	let containerEl: HTMLElement;
	let mockPlugin: any;
	let mockFile: TFile;

	beforeEach(() => {
		containerEl = document.createElement("div");
		mockFile = new TFile();
		mockFile.path = "Music/Song.mp3";
		mockFile.basename = "Song";
		mockFile.extension = "mp3";

		mockPlugin = {
			app: {
				vault: {
					getAbstractFileByPath: vi.fn().mockImplementation((path) => {
						if (path === "Music/Song.mp3") return mockFile;
						return null;
					}),
					getResourcePath: vi.fn().mockReturnValue("app://local/Music/Song.mp3"),
					getFiles: vi.fn().mockReturnValue([mockFile]),
					read: vi.fn().mockResolvedValue("[00:05.00]Line 1\n[00:10.00]Line 2"),
				},
			},
			settings: {
				tracks: {
					"Music/Song.mp3": {
						title: "Sample Song",
						artist: "Sample Artist",
						album: "Sample Album",
					},
				},
				trackIndex: {},
			},
		};
	});

	it("should display error message when track parameter is missing", async () => {
		const child = new MusicCodeblockRenderChild(containerEl, mockPlugin, "autoplay: true");
		await child.onload();

		expect(containerEl.querySelector(".music-codeblock-error")).not.toBeNull();
		expect(containerEl.textContent).toContain("No audio track specified");
	});

	it("should display error message when audio file is not found", async () => {
		const child = new MusicCodeblockRenderChild(containerEl, mockPlugin, 'track: "NonExistent.mp3"');
		await child.onload();

		expect(containerEl.querySelector(".music-codeblock-error")).not.toBeNull();
		expect(containerEl.textContent).toContain("Audio file not found");
	});

	it("should render card layout by default with title and artist", async () => {
		const source = `track: "Music/Song.mp3"`;
		const child = new MusicCodeblockRenderChild(containerEl, mockPlugin, source);
		await child.onload();

		const card = containerEl.querySelector(".music-codeblock-container.is-card");
		expect(card).not.toBeNull();
		expect(containerEl.textContent).toContain("Sample Song");
		expect(containerEl.textContent).toContain("Sample Artist");
		expect(containerEl.querySelector(".music-codeblock-play-btn")).not.toBeNull();
	});

	it("should render compact layout when compact: true is configured", async () => {
		const source = `
track: "Music/Song.mp3"
compact: true
`;
		const child = new MusicCodeblockRenderChild(containerEl, mockPlugin, source);
		await child.onload();

		const compact = containerEl.querySelector(".music-codeblock-container.is-compact");
		expect(compact).not.toBeNull();
		expect(containerEl.querySelector(".music-codeblock-scrubber")).not.toBeNull();
	});

	it("should render lyrics when showLyrics: true is configured", async () => {
		const source = `
track: "Music/Song.mp3"
showLyrics: true
`;
		mockPlugin.settings.tracks["Music/Song.mp3"].lyrics = "[00:05.00]First line\n[00:10.00]Second line";
		const child = new MusicCodeblockRenderChild(containerEl, mockPlugin, source);
		await child.onload();

		const lyricsContainer = containerEl.querySelector(".music-codeblock-lyrics-container");
		expect(lyricsContainer).not.toBeNull();
		expect(containerEl.textContent).toContain("First line");
		expect(containerEl.textContent).toContain("Second line");
	});

	it("should clean up audio element and DOM on onunload", async () => {
		const source = `track: "Music/Song.mp3"`;
		const child = new MusicCodeblockRenderChild(containerEl, mockPlugin, source);
		await child.onload();

		child.onunload();
		expect(containerEl.children.length).toBe(0);
	});

	it("should route openInSidebar through plugin handleProtocolAction instead of navigating window", async () => {
		mockPlugin.handleProtocolAction = vi.fn().mockResolvedValue(undefined);
		const source = `track: "Music/Song.mp3"`;
		const child = new MusicCodeblockRenderChild(containerEl, mockPlugin, source);
		await child.onload();

		const sidebarBtn = containerEl.querySelector<HTMLElement>(".music-codeblock-ext-btn");
		expect(sidebarBtn).not.toBeNull();
		sidebarBtn?.click();

		expect(mockPlugin.handleProtocolAction).toHaveBeenCalledWith({
			track: "Music/Song.mp3",
			time: "0",
			autoplay: "true",
		});
	});
});
