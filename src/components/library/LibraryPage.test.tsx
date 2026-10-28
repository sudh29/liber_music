// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { LibraryPage } from "./LibraryPage";
import type { ReactLibrarySnapshot } from "@/types";

describe("LibraryPage", () => {
	const mockLibrary: ReactLibrarySnapshot = {
		allTracks: [
			{ path: "song1.mp3", title: "Track One", artist: "Artist A", album: "Album X" },
			{ path: "song2.mp3", title: "Track Two", artist: "Artist B", album: "Album Y" },
		],
		favorites: [
			{ path: "song1.mp3", title: "Track One", artist: "Artist A", album: "Album X" },
		],
		playlists: [
			{
				name: "⭐ High Rated",
				tracks: [{ path: "song1.mp3", title: "Track One", artist: "Artist A" }],
				isSmart: true,
				smartDefinition: { id: "sp_1", name: "⭐ High Rated", matchType: "all", rules: [] },
			},
			{
				name: "📁 Rock",
				tracks: [{ path: "song2.mp3", title: "Track Two", artist: "Artist B" }],
				isFolder: true,
			},
			{
				name: "Custom Playlist",
				tracks: [{ path: "song1.mp3", title: "Track One", artist: "Artist A" }],
			},
		],
		artists: [
			{ name: "Artist A", tracks: [{ path: "song1.mp3", title: "Track One", artist: "Artist A" }] },
		],
		albums: [
			{ name: "Album X", tracks: [{ path: "song1.mp3", title: "Track One", artist: "Artist A" }] },
		],
		currentPath: "song1.mp3",
		currentList: "all",
	};

	const defaultProps = {
		library: mockLibrary,
		activePath: "song1.mp3",
		currentList: "all",
		onPlay: vi.fn(),
		onDoubleClick: vi.fn(),
		onToggleFavorite: vi.fn(),
		onAddToPlaylist: vi.fn(),
		onRemoveFromPlaylist: vi.fn(),
		onCreatePlaylist: vi.fn(),
		onCreateSmartPlaylist: vi.fn(),
		onEditSmartPlaylist: vi.fn(),
		onDeleteSmartPlaylist: vi.fn(),
		onOpenMetadataEditor: vi.fn(),
		onPlayCategory: vi.fn(),
		onEditPlaylist: vi.fn(),
		onDeletePlaylist: vi.fn(),
	};

	it("renders all tracks tab by default", () => {
		render(<LibraryPage {...defaultProps} />);
		expect(screen.getByText("Track One")).toBeDefined();
		expect(screen.getByText("Track Two")).toBeDefined();
	});

	it("switches to playlists tab and renders smart, folder, and custom playlists", () => {
		render(<LibraryPage {...defaultProps} />);

		// Switch to Playlists tab
		const playlistsTab = screen.getByText("Playlists");
		fireEvent.click(playlistsTab);

		expect(screen.getByText("⭐ High Rated")).toBeDefined();
		expect(screen.getByText("📁 Rock")).toBeDefined();
		expect(screen.getByText("Custom Playlist")).toBeDefined();
	});

	it("triggers edit and delete callbacks for smart playlists", () => {
		render(<LibraryPage {...defaultProps} />);
		const playlistsTab = screen.getByText("Playlists");
		fireEvent.click(playlistsTab);

		// Find edit button for smart playlist (label: Edit Smart Playlist)
		const editSmartBtn = screen.getByLabelText("Edit Smart Playlist");
		fireEvent.click(editSmartBtn);
		expect(defaultProps.onEditSmartPlaylist).toHaveBeenCalledWith("sp_1");

		// Find delete button for smart playlist (label: Delete Smart Playlist)
		const deleteSmartBtn = screen.getByLabelText("Delete Smart Playlist");
		fireEvent.click(deleteSmartBtn);
		expect(defaultProps.onDeleteSmartPlaylist).toHaveBeenCalledWith("sp_1");
	});

	it("triggers create playlist and create smart playlist buttons", () => {
		render(<LibraryPage {...defaultProps} />);
		const playlistsTab = screen.getByText("Playlists");
		fireEvent.click(playlistsTab);

		const addSmartBtn = screen.getByLabelText("Create Smart Playlist");
		fireEvent.click(addSmartBtn);
		expect(defaultProps.onCreateSmartPlaylist).toHaveBeenCalled();

		const addNormalBtn = screen.getByLabelText("New playlist");
		fireEvent.click(addNormalBtn);
		expect(defaultProps.onCreatePlaylist).toHaveBeenCalled();
	});
});
