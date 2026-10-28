// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLibraryState } from "./useLibraryState";
import type { MusicPlayerView } from "@/views/MusicPlayerView";
import type { ReactLibrarySnapshot } from "@/types";

describe("useLibraryState hook", () => {
	function createMockView() {
		let currentSnapshot: ReactLibrarySnapshot = {
			tracks: [],
			trackMap: {},
			favorites: [],
			playlists: {},
			smartPlaylists: {},
			artists: {},
			albums: {},
			currentListId: "all-list",
			currentTrackPath: "song1.mp3",
		};

		const listeners: Array<() => void> = [];

		const view = {
			getReactLibrarySnapshot: vi.fn().mockImplementation(() => currentSnapshot),
			subscribeLibraryUpdates: vi.fn().mockImplementation((cb) => {
				listeners.push(cb);
			}),
			unsubscribeLibraryUpdates: vi.fn().mockImplementation((cb) => {
				const idx = listeners.indexOf(cb);
				if (idx >= 0) listeners.splice(idx, 1);
			}),
			rebuildAllData: vi.fn().mockResolvedValue(undefined),
			emitUpdate: () => {
				for (const cb of listeners) cb();
			},
			setSnapshot: (s: ReactLibrarySnapshot) => {
				currentSnapshot = s;
			},
		} as unknown as MusicPlayerView & { emitUpdate: () => void; setSnapshot: (s: ReactLibrarySnapshot) => void };

		return { view, currentSnapshot };
	}

	it("initializes with snapshot and listens to library update subscriptions", async () => {
		const { view } = createMockView();
		const { result, unmount } = renderHook(() => useLibraryState(view));

		expect(result.current.library.currentListId).toBe("all-list");
		expect(view.subscribeLibraryUpdates).toHaveBeenCalledTimes(1);

		// Trigger library update event
		view.setSnapshot({
			tracks: [{ path: "song2.mp3", title: "Song 2" } as any],
			trackMap: {},
			favorites: ["id-2"],
			playlists: {},
			smartPlaylists: {},
			artists: {},
			albums: {},
			currentListId: "fav-list",
			currentTrackPath: "song2.mp3",
		});

		act(() => {
			view.emitUpdate();
		});

		expect(result.current.library.currentTrackPath).toBe("song2.mp3");

		// Test rebuildAllData
		await result.current.rebuildAllData();
		expect(view.rebuildAllData).toHaveBeenCalledTimes(1);

		// Test manual refreshSnapshot
		act(() => {
			result.current.refreshSnapshot();
		});

		// Test unmount unsubscribes
		unmount();
		expect(view.unsubscribeLibraryUpdates).toHaveBeenCalledTimes(1);
	});
});
