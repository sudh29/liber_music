import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { AssetService } from "./AssetService";
import type MusicPlayerPlugin from "@/main";

describe("AssetService", () => {
	function createService() {
		const app = new App();
		const plugin = {
			manifest: { id: "liber-music-player" },
		} as unknown as MusicPlayerPlugin;

		const service = new AssetService(app, plugin);
		return { service, app, plugin };
	}

	it("should load asset, convert to data URI, and cache the result", async () => {
		const { service, app } = createService();
		const buffer = new TextEncoder().encode("fake-image-bytes").buffer;

		app.vault.adapter.exists = vi.fn().mockResolvedValue(true);
		app.vault.adapter.readBinary = vi.fn().mockResolvedValue(buffer);

		const dataUri1 = await service.getAssetPath("disc.png");
		expect(dataUri1).toMatch(/^data:image\/png;base64,/);

		// Subsequent call should use cache
		const dataUri2 = await service.getAssetPath("disc.png");
		expect(dataUri2).toBe(dataUri1);
		expect(app.vault.adapter.readBinary).toHaveBeenCalledTimes(1);
	});

	it("should return transparent 1x1 fallback image when asset file does not exist", async () => {
		const { service, app } = createService();

		app.vault.adapter.exists = vi.fn().mockResolvedValue(false);

		const fallbackUri = await service.getAssetPath("missing.png");
		expect(fallbackUri).toBe(
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
		);
	});

	it("should handle svg and jpeg extensions with appropriate MIME types", async () => {
		const { service, app } = createService();
		const buffer = new ArrayBuffer(8);

		app.vault.adapter.exists = vi.fn().mockResolvedValue(true);
		app.vault.adapter.readBinary = vi.fn().mockResolvedValue(buffer);

		const svgUri = await service.getAssetPath("icon.svg");
		expect(svgUri).toMatch(/^data:image\/svg\+xml;base64,/);

		const jpgUri = await service.getAssetPath("photo.jpg");
		expect(jpgUri).toMatch(/^data:image\/jpeg;base64,/);

		const webpUri = await service.getAssetPath("needle.webp");
		expect(webpUri).toMatch(/^data:image\/webp;base64,/);
	});
});
