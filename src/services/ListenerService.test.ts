import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import { ListenerService } from "./ListenerService";
import type { LibraryService } from "./LibraryService";
import { StateService } from "./StateService";
import { AudioService } from "./AudioService";
import { LyricsService } from "./LyricsService";
import type MusicPlayerPlugin from "@/main";

describe("ListenerService", () => {
	function createService() {
		const app = new App();
		const plugin = {
			settings: {
				musicFolder: "Music",
				tracks: {},
				trackIndex: {},
			},
		} as unknown as MusicPlayerPlugin;

		const libraryService = {
			removeTrackFromLibrary: vi.fn().mockResolvedValue(undefined),
			updateTrackMetadata: vi.fn().mockResolvedValue(undefined),
			renameTrackInLibrary: vi.fn().mockResolvedValue(undefined),
		} as unknown as LibraryService;

		const stateService = new StateService();
		const audioService = new AudioService(app, plugin);
		const lyricsService = new LyricsService(plugin);

		const audioEventHandlers = {
			onTimeUpdate: vi.fn(),
			onEnded: vi.fn(),
			onError: vi.fn(),
			onPlay: vi.fn(),
			onPause: vi.fn(),
		};

		const service = new ListenerService(
			app,
			plugin,
			libraryService,
			stateService,
			audioService,
			lyricsService,
			audioEventHandlers
		);

		return {
			service,
			app,
			plugin,
			libraryService,
			stateService,
			audioService,
			lyricsService,
			audioEventHandlers,
		};
	}

	it("should respond to file delete event in music folder", async () => {
		const { service, app, libraryService } = createService();
		service.setup();

		const file = new TFile("Music/deleted.mp3");
		app.vault.trigger("delete", file);

		await new Promise((r) => setTimeout(r, 10));
		expect(libraryService.removeTrackFromLibrary).toHaveBeenCalledWith("Music/deleted.mp3");

		service.cleanup();
	});

	it("should ignore delete events outside the music folder", async () => {
		const { service, app, libraryService } = createService();
		service.setup();

		const file = new TFile("Notes/deleted.mp3");
		app.vault.trigger("delete", file);

		await new Promise((r) => setTimeout(r, 10));
		expect(libraryService.removeTrackFromLibrary).not.toHaveBeenCalled();

		service.cleanup();
	});

	it("should ignore non-audio files", async () => {
		const { service, app, libraryService } = createService();
		service.setup();

		const file = new TFile("Music/document.pdf");
		app.vault.trigger("create", file);

		await new Promise((r) => setTimeout(r, 10));
		expect(libraryService.updateTrackMetadata).not.toHaveBeenCalled();

		service.cleanup();
	});

	it("should respond to file create and modify events in music folder", async () => {
		const { service, app, libraryService } = createService();
		service.setup();

		const file = new TFile("Music/new.flac");
		app.vault.trigger("create", file);

		await new Promise((r) => setTimeout(r, 10));
		expect(libraryService.updateTrackMetadata).toHaveBeenCalledWith("Music/new.flac");

		app.vault.trigger("modify", file);
		await new Promise((r) => setTimeout(r, 10));
		expect(libraryService.updateTrackMetadata).toHaveBeenCalledWith("Music/new.flac");

		service.cleanup();
	});

	it("should handle file moved OUT of music folder by removing from library", async () => {
		const { service, app, libraryService } = createService();
		service.setup();

		const movedFile = new TFile("Notes/track.mp3");
		app.vault.trigger("rename", movedFile, "Music/track.mp3");

		await new Promise((r) => setTimeout(r, 10));
		expect(libraryService.removeTrackFromLibrary).toHaveBeenCalledWith("Music/track.mp3");

		service.cleanup();
	});

	it("should handle file moved INTO music folder by updating metadata", async () => {
		const { service, app, libraryService } = createService();
		service.setup();

		const movedFile = new TFile("Music/track.mp3");
		app.vault.trigger("rename", movedFile, "Downloads/track.mp3");

		await new Promise((r) => setTimeout(r, 10));
		expect(libraryService.updateTrackMetadata).toHaveBeenCalledWith("Music/track.mp3");

		service.cleanup();
	});

	it("should respond to file rename events in music folder and seamlessly re-attach playing track", async () => {
		const {
			service,
			app,
			libraryService,
			stateService,
			audioService,
			lyricsService,
		} = createService();
		service.setup();

		const oldFile = new TFile("Music/old.mp3");
		const newFile = new TFile("Music/renamed.mp3");

		// Simulate currently playing track
		stateService.setCurrentTrack(oldFile, 0);
		stateService.setIsPlaying(true);

		const pauseSpy = vi.spyOn(audioService, "pause");
		const cleanupSpy = vi.spyOn(audioService, "cleanup").mockResolvedValue(undefined);
		const createAudioSpy = vi.spyOn(audioService, "createAudioElement").mockResolvedValue({} as any);
		const playSpy = vi.spyOn(audioService, "play").mockResolvedValue(undefined);
		vi.spyOn(lyricsService, "loadLyrics").mockReturnValue({ lyrics: [], extendedLyrics: [] });

		// When renameTrackInLibrary runs, simulate that stateService currentTrack is updated to newFile
		vi.mocked(libraryService.renameTrackInLibrary).mockImplementation(async () => {
			stateService.setCurrentTrack(newFile, 0);
		});

		app.vault.trigger("rename", newFile, "Music/old.mp3");

		await new Promise((r) => setTimeout(r, 20));

		expect(pauseSpy).toHaveBeenCalled();
		expect(cleanupSpy).toHaveBeenCalled();
		expect(libraryService.renameTrackInLibrary).toHaveBeenCalledWith(
			"Music/old.mp3",
			"Music/renamed.mp3"
		);
		expect(createAudioSpy).toHaveBeenCalledWith(
			newFile,
			expect.any(Number),
			expect.any(Number),
			expect.any(Object)
		);
		expect(playSpy).toHaveBeenCalled();
		expect(stateService.getState().isPlaying).toBe(true);

		service.cleanup();
	});

	it("should ignore rename when neither old nor new path is an audio file", async () => {
		const { service, app, libraryService } = createService();
		service.setup();

		const nonAudio = new TFile("Music/document.txt");
		app.vault.trigger("rename", nonAudio, "Music/notes.txt");

		await new Promise((r) => setTimeout(r, 10));
		expect(libraryService.renameTrackInLibrary).not.toHaveBeenCalled();

		service.cleanup();
	});
});
