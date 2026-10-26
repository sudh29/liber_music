import { describe, expect, it } from "vitest";
import { t, tWithParams } from "./i18n";

describe("i18n utilities", () => {
	it("should translate known English keys", () => {
		expect(t("common.ok")).toBe("OK");
		expect(t("common.cancel")).toBe("Cancel");
		expect(t("list.all")).toBe("All");
		expect(t("list.favorites")).toBe("Favorites");
	});

	it("should return the key itself if not found in dictionary", () => {
		expect(t("non.existent.key")).toBe("non.existent.key");
	});

	it("should replace parameters using tWithParams", () => {
		const result = tWithParams("list.playlistLabel", { name: "Metal" });
		expect(result).toBe("Playlist · Metal");
	});

	it("should replace multiple parameters including numbers", () => {
		const result = tWithParams("notice.processingFile", {
			basename: "song.mp3",
			current: 1,
			total: 5,
		});
		expect(result).toContain("song.mp3");
		expect(result).toContain("1");
		expect(result).toContain("5");
	});
});
