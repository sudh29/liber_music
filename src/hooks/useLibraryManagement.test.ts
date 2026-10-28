// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLibraryManagement } from "./useLibraryManagement";
import type { MusicPlayerView } from "@/views/MusicPlayerView";

describe("useLibraryManagement hook", () => {
	function createMockView() {
		const reactApi = {
			playByPath: vi.fn().mockResolvedValue(undefined),
			toggleFavorite: vi.fn().mockResolvedValue(undefined),
			addToPlaylist: vi.fn().mockResolvedValue(undefined),
			removeFromPlaylist: vi.fn().mockResolvedValue(undefined),
			createPlaylist: vi.fn().mockResolvedValue(undefined),
			editPlaylistName: vi.fn().mockResolvedValue(undefined),
			deletePlaylist: vi.fn().mockResolvedValue(undefined),
			playCategory: vi.fn().mockResolvedValue(undefined),
		};

		const view = {
			reactApi,
			rebuildAllData: vi.fn().mockResolvedValue(undefined),
		} as unknown as MusicPlayerView;

		return { view, reactApi };
	}

	it("delegates playback and library actions to reactApi and view", async () => {
		const { view, reactApi } = createMockView();
		const { result } = renderHook(() => useLibraryManagement(view));

		await result.current.handlePlay("music/track.mp3", "playlist:Rock");
		expect(reactApi.playByPath).toHaveBeenCalledWith("music/track.mp3", "playlist:Rock");

		await result.current.rebuildAllData();
		expect(view.rebuildAllData).toHaveBeenCalledTimes(1);

		await result.current.toggleFavorite("music/track.mp3", "all");
		expect(reactApi.toggleFavorite).toHaveBeenCalledWith("music/track.mp3", "all");

		await result.current.addToPlaylist("music/track.mp3", "playlist:Metal");
		expect(reactApi.addToPlaylist).toHaveBeenCalledWith("music/track.mp3", "playlist:Metal");

		await result.current.removeFromPlaylist("music/track.mp3", "Metal");
		expect(reactApi.removeFromPlaylist).toHaveBeenCalledWith("music/track.mp3", "Metal");

		await result.current.createPlaylist();
		expect(reactApi.createPlaylist).toHaveBeenCalledTimes(1);

		await result.current.editPlaylistName("OldName");
		expect(reactApi.editPlaylistName).toHaveBeenCalledWith("OldName");

		await result.current.deletePlaylist("OldName");
		expect(reactApi.deletePlaylist).toHaveBeenCalledWith("OldName");

		const mockTracks = [{ path: "music/track.mp3", title: "Track" }] as any;
		await result.current.playCategory("album", "Night at the Opera", mockTracks);
		expect(reactApi.playCategory).toHaveBeenCalledWith("album", "Night at the Opera", mockTracks);
	});
});
