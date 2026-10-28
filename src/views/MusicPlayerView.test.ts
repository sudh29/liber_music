import { describe, expect, it, vi, beforeEach } from "vitest";
import { App, WorkspaceLeaf, TFile } from "obsidian";
import { MusicPlayerView, VIEW_TYPE_MUSIC_PLAYER } from "./MusicPlayerView";
import type MusicPlayerPlugin from "@/main";

describe("MusicPlayerView", () => {
	let app: App;
	let leaf: WorkspaceLeaf;
	let mockPlugin: MusicPlayerPlugin;

	beforeEach(() => {
		app = new App();
		leaf = new WorkspaceLeaf(app);
		mockPlugin = {
			app,
			settings: {
				volume: 0.8,
				playbackRate: 1.0,
				autoPlayOpenTrackPath: "",
				keepScreenAwake: false,
				crossfadeDuration: 0,
				eqEnabled: false,
				eqPreset: "flat",
				eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				preampGainDb: 0,
				tracks: {},
				trackIndex: {},
				playlists: {},
				favorites: [],
			},
			loadSettings: vi.fn().mockResolvedValue(undefined),
			saveSettings: vi.fn().mockResolvedValue(undefined),
		} as unknown as MusicPlayerPlugin;
	});

	it("initializes all core services without undefined errors", () => {
		const view = new MusicPlayerView(leaf, mockPlugin);

		expect(view).toBeDefined();
		expect(view.getViewType()).toBe(VIEW_TYPE_MUSIC_PLAYER);
		expect(view.getDisplayText()).toBe("Liber Music Player");
		expect(view.getIcon()).toBe("lucide-music");

		// SnapshotService must be instantiated and accessible
		expect((view as any).snapshotService).toBeDefined();
		expect(typeof (view as any).snapshotService.getTrackCoverAsync).toBe("function");
		expect(view.playbackService).toBeDefined();
	});

	it("delegates getTrackCoverAsync to SnapshotService correctly", async () => {
		const view = new MusicPlayerView(leaf, mockPlugin);
		const spy = vi.spyOn((view as any).snapshotService, "getTrackCoverAsync").mockResolvedValue("cover.png");
		const dummyFile = new TFile("test.mp3", "test.mp3");

		const cover = await view.getTrackCoverAsync(dummyFile);
		expect(cover).toBe("cover.png");
		expect(spy).toHaveBeenCalledWith(dummyFile, undefined);
		spy.mockRestore();
	});

	it("handles getTrackCoverAsync with null/undefined track safely", async () => {
		const view = new MusicPlayerView(leaf, mockPlugin);
		const spy = vi.spyOn((view as any).snapshotService, "getTrackCoverAsync").mockResolvedValue(undefined);

		const cover = await view.getTrackCoverAsync(null);
		expect(cover).toBeUndefined();
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});
