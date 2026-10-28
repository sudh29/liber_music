import { describe, expect, it, vi } from "vitest";
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

	it("should find cover from vault _assets covers cache as Priority 2.5", async () => {
		const app = new App();
		app.vault.createFolder("music/jazz");
		app.vault.createFolder("music/_assets/covers/jazz");
		const track = app.vault.createFile("music/jazz/autumn_leaves.mp3");
		app.vault.createFile("music/_assets/covers/jazz/autumn_leaves.jpg");

		const coverUrl = await getTrackCover(app, track, { includeEmbedded: false });
		expect(coverUrl).toBe("app://obsidian.md/music/_assets/covers/jazz/autumn_leaves.jpg");
	});

	it("should find genre cover from vault _assets covers cache as Priority 2.5 fallback", async () => {
		const app = new App();
		app.vault.createFolder("music/classical");
		app.vault.createFolder("music/_assets/covers/classical");
		const track = app.vault.createFile("music/classical/symphony.mp3");
		app.vault.createFile("music/_assets/covers/classical/cover.png");

		const coverUrl = await getTrackCover(app, track, { includeEmbedded: false });
		expect(coverUrl).toBe("app://obsidian.md/music/_assets/covers/classical/cover.png");
	});

	it("should return undefined and log error if both getResourcePath and readBinary throw", async () => {
		const app = new App();
		const track = app.vault.createFile("track.mp3");
		app.vault.createFile("cover.jpg");

		app.vault.getResourcePath = () => {
			throw new Error("Resource error");
		};
		app.vault.readBinary = () => {
			throw new Error("Read binary error");
		};

		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const coverUrl = await getTrackCover(app, track, { includeEmbedded: false });
		expect(coverUrl).toBeUndefined();
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read image file"),
			expect.any(Error)
		);
		consoleSpy.mockRestore();
	});

	it("should map various image extensions to appropriate mimeTypes in data URL fallback", async () => {
		const extensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
		for (const ext of extensions) {
			const app = new App();
			const track = app.vault.createFile(`track.${ext}.mp3`);
			const imgFile = app.vault.createFile(`cover.${ext}`, new ArrayBuffer(4));
			imgFile.extension = ext;

			app.vault.getResourcePath = () => {
				throw new Error("No resource path");
			};

			const coverUrl = await getTrackCover(app, track, { includeEmbedded: false });
			expect(coverUrl).toBeDefined();
			const expectedMime = ext === "jpg" ? "jpeg" : ext;
			expect(coverUrl).toMatch(new RegExp(`^data:image\\/${expectedMime};base64,`));
		}
	});

	it("should fall back to embedded artwork (Priority 3) when enabled", async () => {
		const app = new App();
		const track = app.vault.createFile("solo.mp3");

		// Without embedded, returns undefined
		const noEmbedded = await getTrackCover(app, track, { includeEmbedded: false });
		expect(noEmbedded).toBeUndefined();

		// With embedded, attempts getEmbeddedCoverFromFile
		const withEmbedded = await getTrackCover(app, track, { includeEmbedded: true });
		expect(withEmbedded).toBeUndefined(); // mock metadata reader returns undefined for empty arrayBuffer
	});
});

