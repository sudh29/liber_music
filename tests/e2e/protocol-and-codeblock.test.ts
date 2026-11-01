// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { App, TFile } from "obsidian";
import MusicPlayerPlugin from "@/main";

describe("Protocol & Codeblock Lifecycle Integration", () => {
	let plugin: MusicPlayerPlugin;
	let mockApp: any;
	let mockFile: TFile;
	let mockView: any;

	beforeEach(() => {
		mockFile = new TFile();
		mockFile.path = "Music/Jazz/TakeFive.mp3";
		mockFile.basename = "TakeFive";
		mockFile.extension = "mp3";

		mockView = {
			isPlaying: false,
			playbackService: {
				playByPath: vi.fn().mockImplementation(async () => {
					mockView.isPlaying = true;
				}),
				seekToTime: vi.fn(),
				togglePlay: vi.fn().mockImplementation(async () => {
					mockView.isPlaying = !mockView.isPlaying;
				}),
			},
		};

		mockApp = new App();
		mockApp.vault.getAbstractFileByPath = vi.fn().mockImplementation((path: string) => {
			if (path === "Music/Jazz/TakeFive.mp3") return mockFile;
			return null;
		});
		mockApp.vault.getFiles = vi.fn().mockReturnValue([mockFile]);
		mockApp.workspace.getLeavesOfType = vi.fn().mockReturnValue([
			{
				view: mockView,
			},
		]);

		plugin = new MusicPlayerPlugin(mockApp, { id: "liber-music-player" });
		plugin.settings = {
			musicFolder: "",
			trackIndex: {
				"track-1": "Music/Jazz/TakeFive.mp3",
			},
			favorites: [],
			tracks: {},
			playlists: {},
			artists: {},
			albums: {},
			autoPlayOnOpen: false,
			autoPlayOpenTrackPath: "",
			volume: 1.0,
			playbackRate: 1.0,
			isShuffle: false,
			artworkDisplayMode: "vinyl",
		};
	});

	it("should register codeblock processor and protocol handler on onload", async () => {
		const registerCodeblockSpy = vi.spyOn(plugin, "registerMarkdownCodeBlockProcessor");
		const registerProtocolSpy = vi.spyOn(plugin, "registerObsidianProtocolHandler");

		await plugin.onload();

		expect(registerCodeblockSpy).toHaveBeenCalledWith("music", expect.any(Function));
		expect(registerProtocolSpy).toHaveBeenCalledWith("music-player", expect.any(Function));
	});

	it("should handle valid protocol deep-link with track and timestamp", async () => {
		vi.spyOn(plugin, "activateView").mockResolvedValue(undefined);
		vi.spyOn(plugin, "getView").mockReturnValue(mockView);

		await plugin.handleProtocolAction({
			track: "Music%2FJazz%2FTakeFive.mp3",
			t: "142",
		});

		expect(plugin.activateView).toHaveBeenCalled();
		expect(mockView.playbackService.playByPath).toHaveBeenCalledWith(
			"Music/Jazz/TakeFive.mp3",
			false,
			false
		);
		expect(mockView.playbackService.seekToTime).toHaveBeenCalledWith(142);
	});

	it("should respect autoplay=false in protocol action", async () => {
		vi.spyOn(plugin, "activateView").mockResolvedValue(undefined);
		vi.spyOn(plugin, "getView").mockReturnValue(mockView);

		await plugin.handleProtocolAction({
			track: "Music/Jazz/TakeFive.mp3",
			autoplay: "false",
		});

		expect(mockView.playbackService.playByPath).toHaveBeenCalled();
		expect(mockView.playbackService.togglePlay).toHaveBeenCalled();
	});

	it("should pause active sidebar player via pauseActivePlayback", () => {
		mockView.isPlaying = true;
		vi.spyOn(plugin, "getView").mockReturnValue(mockView);

		plugin.pauseActivePlayback();
		expect(mockView.playbackService.togglePlay).toHaveBeenCalled();
	});
});
