/**
 * Playlist picker modal dialog module
 * 
 * Provides a fuzzy search playlist selection dialog:
 * - Choose from existing playlists
 * - Filter playlists via search input
 * - Select matching existing playlist
 * 
 * Note: If input playlist does not exist, returns null rather than creating automatically.
 */

import { App, FuzzySuggestModal } from "obsidian";

/**
 * Playlist picker modal class
 * 
 * Extends Obsidian FuzzySuggestModal for selecting playlists.
 */
export class PlaylistPickerModal extends FuzzySuggestModal<string> {
	private resolve: ((value: string | null) => void) | null;
	private allowNew: boolean = true;
	private items: string[] = [];
	private chosen: boolean = false;

	/**
	 * Constructor
	 * @param app Obsidian App instance
	 * @param existingPlaylists Array of existing playlist names (default: empty array)
	 * @param allowNew Whether to allow new playlists (default: true)
	 */
	constructor(app: App, existingPlaylists: string[] = [], allowNew: boolean = true) {
		super(app);
		this.items = existingPlaylists;
		this.allowNew = allowNew;
	}

	/**
	 * Returns available items
	 * @returns Array of playlist names
	 */
	getItems(): string[] {
		return this.items;
	}

	/**
	 * Returns display text for item
	 * @param item Playlist name
	 * @returns Playlist name
	 */
	getItemText(item: string): string {
		return item;
	}

	/**
	 * Called when user selects an item from list (click or Enter)
	 * 
	 * @param item Selected playlist name
	 * @param evt Mouse or keyboard event
	 */
	onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.chosen = true;
		
		const resolve = this.resolve;
		if (!resolve) {
			this.close();
			return;
		}
		
		this.resolve = null;
		resolve(item);
		
		window.setTimeout(() => {
			this.close();
		}, 0);
	}

	/**
	 * Called when modal closes.
	 */
	onClose(): void {
		super.onClose();
		
		window.setTimeout(() => {
			if (this.chosen) {
				this.chosen = false;
				return;
			}
			
			const inputValue = this.inputEl?.value?.trim();
			if (inputValue && this.items.includes(inputValue)) {
				if (this.resolve) {
					const resolve = this.resolve;
					this.resolve = null;
					resolve(inputValue);
					return;
				}
			}
			
			if (this.resolve) {
				const resolve = this.resolve;
				this.resolve = null;
				resolve(null);
			}
		}, 0);
	}

	/**
	 * Displays modal and awaits user selection
	 * 
	 * @returns Promise resolving to selected playlist name, or null if cancelled
	 */
	async prompt(): Promise<string | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.chosen = false;
			this.open();
		});
	}
}
