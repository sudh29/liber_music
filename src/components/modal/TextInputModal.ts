/**
 * Text input modal dialog module
 * 
 * Provides a simple text input dialog for retrieving user input.
 * Desktop and mobile compatible, supporting Enter to confirm and Escape to cancel.
 */

import { App } from "obsidian";
import { BaseModal } from "./BaseModal";
import "./TextInputModal.css";
import { t } from "@/utils/i18n/i18n";

/**
 * Text input modal class
 * 
 * Extends BaseModal with an input text field and confirm/cancel buttons.
 */
export class TextInputModal extends BaseModal<string | null> {
	private inputEl: HTMLInputElement;

	/**
	 * Constructor
	 * 
	 * @param app Obsidian App instance
	 * @param promptText Prompt title text
	 * @param defaultValue Default input value (default: empty string)
	 */
	constructor(app: App, promptText: string, defaultValue: string = "") {
		super(app, promptText);
		
		const container = this.contentEl.createDiv({ cls: "prompt-input-container" });
		this.inputEl = container.createEl("input", {
			type: "text",
			cls: "prompt-input",
			value: defaultValue,
		});

		this.createButtonContainer(
			t("common.ok"),
			t("common.cancel"),
			() => this.submit(this.inputEl.value),
			() => this.cancel(null)
		);
		
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				this.submit(this.inputEl.value);
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.cancel(null);
			}
		});
	}

	/**
	 * Called when modal opens.
	 * Focuses and selects input text automatically.
	 */
	onOpen() {
		void super.onOpen();
		this.inputEl.focus();
		this.inputEl.select();
	}

	/**
	 * Called when modal closes.
	 * Resolves with null if not submitted.
	 */
	onClose() {
		super.onClose();
		if (!this.submitted) {
			this.resolve(null);
		}
	}
}
