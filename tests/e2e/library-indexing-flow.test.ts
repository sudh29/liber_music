import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import MusicPlayerPlugin from "@/main";
import { rebuildAllData } from "@/utils/library/updater";
import * as metadataModule from "@/utils/audio/metadata";

describe("E2E 2: Vault Audio Discovery & Indexing Pipeline", () => {
	it("should discover audio tracks, parse metadata, bind companion .lrc, and index library", async () => {
		const app = new App();
		const plugin = new MusicPlayerPlugin(app, { id: "test", version: "1.0.0" });
		await plugin.onload();

		// Populate vault with files
		app.vault.createFolder("Music/Rock");
		app.vault.createFolder("Music/Jazz");
		app.vault.createFile("Music/Rock/bohemian.mp3", new ArrayBuffer(100));
		app.vault.createFile("Music/Rock/bohemian.lrc", "[00:10.00]Mama, just killed a man");
		app.vault.createFile("Music/Jazz/take5.flac", new ArrayBuffer(100));

		// Mock tag extraction for the files
		vi.spyOn(metadataModule, "getEmbeddedAudioMetadataFromBuffer").mockImplementation(async (buf: ArrayBuffer) => {
			return {
				title: "Bohemian Rhapsody",
				artist: "Queen",
				album: "A Night at the Opera",
				duration: 354,
				replayGainDb: -1.2,
			};
		});

		const count = await rebuildAllData(app, plugin);

		expect(count).toBe(2);

		// Verify Queen is in artists index
		expect(plugin.settings.artists["Queen"]).toBeDefined();
		expect(plugin.settings.albums["A Night at the Opera"]).toBeDefined();

		// Verify companion lrc was bound
		const bohemianEntry = Object.entries(plugin.settings.trackIndex).find(
			([, p]) => p === "Music/Rock/bohemian.mp3"
		);
		expect(bohemianEntry).toBeDefined();

		const bohemianTrack = plugin.settings.tracks[bohemianEntry![0]];
		expect(bohemianTrack).toBeDefined();
		expect(bohemianTrack?.lyrics).toBe("[00:10.00]Mama, just killed a man");

		vi.restoreAllMocks();
	});
});
