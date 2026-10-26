/**
 * Confirm dialog module
 * 
 * Provides a simple confirmation dialog for destructive or critical operations.
 * Mobile and desktop compatible, supporting Enter to confirm and Escape to cancel.
 */

import { App } from "obsidian";
import { BaseModal } from "./BaseModal";
import "./ConfirmModal.css";
import { t } from "@/utils/i18n/i18n";

/**
 * Confirm dialog class
 * 
 * Extends BaseModal with a prompt message and confirm/cancel buttons.
 */
export class ConfirmModal extends BaseModal<boolean> {
	private confirmText: string;
	private cancelText: string;

	/**
	 * Constructor
	 * 
	 * @param app Obsidian App instance
	 * @param title Dialog title
	 * @param message Prompt message text
	 * @param confirmText Confirm button text
	 * @param cancelText Cancel button text
	 */
	constructor(
		app: App,
		title: string,
		private message: string,
		confirmText?: string,
		cancelText?: string
	) {
		super(app, title);
		this.confirmText = confirmText ?? t("common.ok");
		this.cancelText = cancelText ?? t("common.cancel");
	}

	/**
	 * Called when modal opens.
	 * Builds dialog contents.
	 */
	onOpen() {
		void super.onOpen();
		
		const messageContainer = this.contentEl.createDiv({ cls: "prompt-message-container" });
		messageContainer.createEl("pre", { text: this.message, cls: "prompt-message" });

		this.createButtonContainer(
			this.confirmText,
			this.cancelText,
			() => this.submit(true),
			() => this.cancel(false)
		);
		
		this.setupKeyboardHandlers(
			() => this.submit(true),
			() => this.cancel(false)
		);
	}

	/**
	 * Called when modal closes.
	 * Returns false if user did not explicitly submit.
	 */
	onClose() {
		super.onClose();
		if (!this.submitted) {
			this.resolve(false);
		}
	}
}
