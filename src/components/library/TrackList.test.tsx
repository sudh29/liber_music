// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { TrackList } from "./TrackList";
import type { ReactLibrarySnapshot, ReactTrackInfo } from "@/types";

describe("TrackList", () => {
	const mockTracks: ReactTrackInfo[] = [
		{
			path: "track1.mp3",
			title: "Song Number One",
			artist: "Artist Alpha",
			album: "Album Omega",
			rating: 4,
		},
	];

	const mockLibrary: ReactLibrarySnapshot = {
		allTracks: mockTracks,
		favorites: [],
		playlists: [],
		artists: [],
		albums: [],
		currentPath: "track1.mp3",
		currentList: "all",
	};

	it("renders track details, rating badge, and metadata editor button", () => {
		const onPlay = vi.fn();
		const onOpenMetadataEditor = vi.fn();

		render(
			<TrackList
				tracks={mockTracks}
				activePath="track1.mp3"
				sectionId="all"
				currentList="all"
				onPlay={onPlay}
				onToggleFavorite={vi.fn()}
				onAddToPlaylist={vi.fn()}
				onOpenMetadataEditor={onOpenMetadataEditor}
				library={mockLibrary}
			/>
		);

		expect(screen.getByText("Song Number One")).toBeDefined();
		expect(screen.getByText("Artist Alpha")).toBeDefined();
		expect(screen.getByText("★ 4")).toBeDefined();

		// Click metadata editor button
		const editBtn = screen.getByLabelText("Edit metadata tags");
		expect(editBtn).toBeDefined();
		fireEvent.click(editBtn);
		expect(onOpenMetadataEditor).toHaveBeenCalledWith("track1.mp3");
	});

	it("renders empty state when tracks array is empty", () => {
		render(
			<TrackList
				tracks={[]}
				activePath={null}
				sectionId="all"
				currentList="all"
				onPlay={vi.fn()}
				onToggleFavorite={vi.fn()}
				onAddToPlaylist={vi.fn()}
				library={mockLibrary}
			/>
		);

		expect(screen.getByText("No tracks")).toBeDefined();
	});

	it("virtualizes list when tracks count exceeds 60", () => {
		const largeTracks: ReactTrackInfo[] = Array.from({ length: 100 }, (_, i) => ({
			path: `music/track_${i}.mp3`,
			title: `Track ${i}`,
			artist: "Artist",
		}));

		const { container } = render(
			<TrackList
				tracks={largeTracks}
				activePath="music/track_0.mp3"
				sectionId="all"
				currentList="all"
				onPlay={vi.fn()}
				onToggleFavorite={vi.fn()}
				onAddToPlaylist={vi.fn()}
				library={{ ...mockLibrary, allTracks: largeTracks }}
			/>
		);

		const renderedRows = container.querySelectorAll(".track-item");
		// Virtualized: mounts fewer than 100 rows
		expect(renderedRows.length).toBeLessThan(100);
		expect(renderedRows.length).toBeGreaterThan(0);
	});
});
