// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { copyTextToClipboard } from "./clipboard";

describe("copyTextToClipboard", () => {
	const originalClipboard = navigator.clipboard;

	afterEach(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: originalClipboard,
			configurable: true,
			writable: true,
		});
		delete (document as any).execCommand;
	});

	it("uses navigator.clipboard.writeText when available and successful", async () => {
		const writeTextMock = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: writeTextMock },
			configurable: true,
			writable: true,
		});

		const result = await copyTextToClipboard("test-link");
		expect(result).toBe(true);
		expect(writeTextMock).toHaveBeenCalledWith("test-link");
	});

	it("falls back to document.execCommand when navigator.clipboard.writeText rejects", async () => {
		const writeTextMock = vi.fn().mockRejectedValue(new Error("Permission denied"));
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: writeTextMock },
			configurable: true,
			writable: true,
		});

		const execCommandMock = vi.fn().mockReturnValue(true);
		(document as any).execCommand = execCommandMock;

		const result = await copyTextToClipboard("fallback-text");
		expect(result).toBe(true);
		expect(execCommandMock).toHaveBeenCalledWith("copy");
	});

	it("falls back to document.execCommand when navigator.clipboard is undefined", async () => {
		Object.defineProperty(navigator, "clipboard", {
			value: undefined,
			configurable: true,
			writable: true,
		});

		const execCommandMock = vi.fn().mockReturnValue(true);
		(document as any).execCommand = execCommandMock;

		const result = await copyTextToClipboard("fallback-text");
		expect(result).toBe(true);
		expect(execCommandMock).toHaveBeenCalledWith("copy");
	});
});
