/**
 * Base modal dialog class
 * 
 * Provides common modal functionality:
 * - Button creation and event binding
 * - Keyboard shortcuts (Enter to confirm, Escape to cancel)
 * - Event listener cleanup
 */

import { App, Modal } from "obsidian";
import "./BaseModal.css";

/**
 * Base modal class
 * 
 * Abstract base class providing common modal behavior.
 */
export abstract class BaseModal<TResult> extends Modal {
	/** WeakMap to store keydown handlers for each modal instance */
	private static handlerMap = new WeakMap<BaseModal<unknown>, (e: KeyboardEvent) => void>();
	/** Promise resolve function returning user selection */
	protected resolve: (value: TResult) => void;
	/** Flag indicating whether user has submitted */
	protected submitted = false;
	/** Flag indicating whether the prompt promise has settled */
	protected settled = false;

	/**
	 * Constructor
	 * 
	 * @param app Obsidian App instance
	 * @param title Modal dialog title
	 */
	constructor(app: App, title: string) {
		super(app);
		this.modalEl.addClass("music-player-modal");
		this.setTitle(title);
	}

	/**
	 * Creates button container with confirm and cancel buttons.
	 * 
	 * @param confirmText Confirm button text
	 * @param cancelText Cancel button text
	 * @param onConfirm Confirm click callback
	 * @param onCancel Cancel click callback
	 * @returns Button container element
	 */
	protected createButtonContainer(
		confirmText: string,
		cancelText: string,
		onConfirm: () => void,
		onCancel: () => void
	): HTMLElement {
		const buttonContainer = this.contentEl.createDiv({ cls: "prompt-button-container" });
		const confirmBtn = buttonContainer.createEl("button", { text: confirmText, cls: "mod-cta" });
		const cancelBtn = buttonContainer.createEl("button", { text: cancelText });

		confirmBtn.addEventListener("click", () => {
			void onConfirm();
		});
		cancelBtn.addEventListener("click", () => {
			void onCancel();
		});

		return buttonContainer;
	}

	/**
	 * Sets up keyboard event handlers for Enter and Escape.
	 * 
	 * @param onEnter Enter key callback
	 * @param onEscape Escape key callback
	 */
	protected setupKeyboardHandlers(onEnter: () => void, onEscape: () => void): void {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				void onEnter();
			} else if (e.key === "Escape") {
				e.preventDefault();
				void onEscape();
			}
		};
		this.contentEl.addEventListener("keydown", handleKeyDown);
		
		BaseModal.handlerMap.set(this, handleKeyDown);
	}

	/**
	 * Returns default cancellation value when modal is dismissed without submitting.
	 */
	protected getCancelValue(): TResult {
		return null as unknown as TResult;
	}

	/**
	 * Called when modal is closed.
	 * Cleans up keyboard event listeners and ensures prompt promise settles.
	 */
	onClose() {
		const handler = BaseModal.handlerMap.get(this);
		if (handler) {
			this.contentEl.removeEventListener("keydown", handler);
			BaseModal.handlerMap.delete(this);
		}
		if (!this.settled && this.resolve) {
			this.settled = true;
			this.resolve(this.getCancelValue());
		}
	}

	/**
	 * Submits result.
	 * 
	 * @param result Result value to return
	 */
	protected submit(result: TResult): void {
		this.submitted = true;
		this.settled = true;
		this.resolve(result);
		this.close();
	}

	/**
	 * Cancels operation.
	 * 
	 * @param result Default result value on cancellation
	 */
	protected cancel(result: TResult): void {
		this.settled = true;
		this.resolve(result);
		this.close();
	}

	/**
	 * Displays modal and awaits user action.
	 * 
	 * @returns Promise resolving to user action result
	 */
	async prompt(): Promise<TResult> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
