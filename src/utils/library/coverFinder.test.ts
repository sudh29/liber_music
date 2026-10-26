import { describe, expect, it } from "vitest";
import { App, TFile } from "obsidian";
import { getTrackCover } from "./coverFinder";

describe("library/coverFinder utilities", () => {
	it("should find folder cover (cover.jpg) as Priority 1", async () => {
		const app = new App();
		app.vault.createFolder("Music/Rock");
		const track = app.vault.createFile("Music/Rock/song.mp3");
		app.vault.createFile("Music/Rock/cover.jpg");
		app.vault.createFile("Music/Rock/song.jpg");

		const coverUrl = await getTrackCover(app, track, { includeEmbedded: false });
		expect(coverUrl).toBe("app://obsidian.md/Music/Rock/cover.jpg");
	});

	it("should find Capitalized Cover (Cover.png) as Priority 1", async () => {
		const app = new App();
		app.vault.createFolder("Music/Jazz");
		const track = app.vault.createFile("Music/Jazz/tune.mp3");
		app.vault.createFile("Music/Jazz/Cover.png");

		const coverUrl = await getTrackCover(app, track, { includeEmbedded: false });
		expect(coverUrl).toBe("app://obsidian.md/Music/Jazz/Cover.png");
	});

	it("should find songName.jpg as Priority 2 when folder cover does not exist", async () => {
		const app = new App();
		app.vault.createFolder("Music/Pop");
		const track = app.vault.createFile("Music/Pop/hit.mp3");
		app.vault.createFile("Music/Pop/hit.jpg");

		const coverUrl = await getTrackCover(app, track, { includeEmbedded: false });
		expect(coverUrl).toBe("app://obsidian.md/Music/Pop/hit.jpg");
	});

	it("should return undefined when no image file exists and embedded is disabled", async () => {
		const app = new App();
		const track = app.vault.createFile("song.mp3");

		const coverUrl = await getTrackCover(app, track, { includeEmbedded: false });
		expect(coverUrl).toBeUndefined();
	});

	it("should convert to base64 Data URL if getResourcePath throws an error", async () => {
		const app = new App();
		const track = app.vault.createFile("track.mp3");
		app.vault.createFile("cover.png", new ArrayBuffer(8));

		// Force getResourcePath to throw
		app.vault.getResourcePath = () => {
			throw new Error("Resource path error");
		};

		const coverUrl = await getTrackCover(app, track, { includeEmbedded: false });
		expect(coverUrl).toBeDefined();
		expect(coverUrl).toMatch(/^data:image\/png;base64,/);
	});
});
