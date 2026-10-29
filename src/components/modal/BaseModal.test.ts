import { describe, it, expect, vi } from "vitest";
import { App } from "obsidian";
import { BaseModal } from "./BaseModal";

class TestModal extends BaseModal<string | null> {
	constructor(app: App) {
		super(app, "Test Modal");
	}

	public triggerSubmit(val: string) {
		this.submit(val);
	}

	public triggerCancel(val: string | null) {
		this.cancel(val);
	}
}

describe("BaseModal", () => {
	it("resolves value when submitted", async () => {
		const app = new App();
		const modal = new TestModal(app);
		const promptPromise = modal.prompt();

		modal.triggerSubmit("submitted_value");
		const result = await promptPromise;

		expect(result).toBe("submitted_value");
	});

	it("resolves value when cancelled", async () => {
		const app = new App();
		const modal = new TestModal(app);
		const promptPromise = modal.prompt();

		modal.triggerCancel(null);
		const result = await promptPromise;

		expect(result).toBeNull();
	});

	it("resolves null when modal is closed without explicit submit or cancel", async () => {
		const app = new App();
		const modal = new TestModal(app);
		const promptPromise = modal.prompt();

		// Simulate user clicking outside or pressing Escape / X button
		modal.close();
		const result = await promptPromise;

		expect(result).toBeNull();
	});
});

