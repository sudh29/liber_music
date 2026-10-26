/**
 * Playback queue modal dialog module
 * 
 * Provides a fuzzy search queue modal dialog:
 * - View all tracks in current queue
 * - Search tracks via keywords
 * - View track cover, title, artist, and album
 * - Highlight currently playing track
 * - Select track to play
 */

import { App, FuzzyMatch, FuzzySuggestModal, TFile } from "obsidian";
import MusicPlayerPlugin from "@/main";
import { getTrackCover } from "@/utils/library/coverFinder";
import { getOrCreateTrackId } from "@/utils/track/id";
import { renderTrackItemContent } from "@/utils/ui/trackItemRenderer";
import "@/components/shared/TrackItem.css";

/**
 * Playback queue modal class
 * 
 * Extends Obsidian FuzzySuggestModal for displaying and selecting queued tracks.
 */
export class QueueModal extends FuzzySuggestModal<TFile> {
	private resolve: ((value: TFile | null) => void) | null;
	private items: TFile[] = [];
	private currentTrack: TFile | null = null;
	private chosen: boolean = false;
	private plugin: MusicPlayerPlugin;
	private coverCache: Map<string, string> = new Map();
	private albumCoverCache: Map<string, string> = new Map();
	private loadingPromises: Set<Promise<void>> = new Set();
	private shouldStopLoading: boolean = false;
	private observer: IntersectionObserver | null = null;

	/**
	 * Constructor
	 * 
	 * @param app Obsidian App instance
	 * @param plugin Plugin instance
	 * @param playlist Queued tracks array
	 * @param currentTrack Currently playing track (optional, for active highlight)
	 */
	constructor(
		app: App,
		plugin: MusicPlayerPlugin,
		playlist: TFile[],
		currentTrack: TFile | null = null,
	) {
		super(app);
		this.app = app;
		this.plugin = plugin;
		this.items = playlist;
		this.currentTrack = currentTrack;
		this.modalEl.addClass("music-player");
	}

	/**
	 * Returns items available for fuzzy search
	 * @returns Array of queued track files
	 */
	getItems(): TFile[] {
		return this.items;
	}

	/**
	 * Returns display text for search matching
	 * 
	 * @param item Track file
	 * @returns Track title, or filename if missing
	 */
	getItemText(item: TFile): string {
		const trackId = getOrCreateTrackId(item.path, this.plugin.settings);
		const track = this.plugin.settings.tracks[trackId];
		return track?.title || item.basename;
	}

	/**
	 * Retrieves cover image URL for track
	 * 
	 * Checks cache, album cover cache, and resolves cover via getTrackCover.
	 * 
	 * @param file Track file
	 * @returns Cover image URL, or null if not found
	 */
	async getCoverImageUrl(file: TFile): Promise<string | null> {
		if (this.shouldStopLoading) {
			return null;
		}

		if (this.coverCache.has(file.path)) {
			return this.coverCache.get(file.path) || null;
		}

		const trackId = getOrCreateTrackId(file.path, this.plugin.settings);
		const track = this.plugin.settings.tracks[trackId];
		if (track?.album) {
			const albumCover = this.albumCoverCache.get(track.album);
			if (albumCover) {
				this.coverCache.set(file.path, albumCover);
				return albumCover;
			}
		}

		if (this.shouldStopLoading) {
			return null;
		}

		const coverUrl = await getTrackCover(this.app, file) || null;
		
		if (this.shouldStopLoading) {
			return null;
		}

		if (coverUrl) {
			this.coverCache.set(file.path, coverUrl);
			if (track?.album) {
				this.albumCoverCache.set(track.album, coverUrl);
			}
			return coverUrl;
		}

		return null;
	}

	/**
	 * Renders playlist queue suggestion item.
	 * 
	 * @param item Fuzzy match result object
	 * @param el DOM element to render into
	 */
	renderSuggestion(item: FuzzyMatch<TFile>, el: HTMLElement): void {
		const file = item.item;
		const trackId = getOrCreateTrackId(file.path, this.plugin.settings);
		const track = this.plugin.settings.tracks[trackId];
		const isActive = !!(this.currentTrack && file.path === this.currentTrack.path);
		
		el.addClass("playlist-item");
		if (isActive) {
			el.addClass("is-active");
		}

		super.renderSuggestion(item, el);
		
		let contentEl = el.querySelector(".suggestion-content") as HTMLElement;
		if (!contentEl) {
			contentEl = el;
			el.empty();
		}

		renderTrackItemContent(contentEl, {
			file,
			track,
			isActive,
			coverCache: this.coverCache,
			observer: this.observer,
		});
	}

	/**
	 * Called when user selects track from list (click or Enter)
	 * 
	 * @param item Selected track file
	 * @param evt Mouse or keyboard event
	 */
	onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.shouldStopLoading = true;
		this.loadingPromises.clear();
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
		this.shouldStopLoading = true;
		this.loadingPromises.clear();
		
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		
		super.onClose();
		
		window.setTimeout(() => {
			if (this.chosen) {
				this.chosen = false;
				return;
			}
			
			if (this.resolve) {
				const resolve = this.resolve;
				this.resolve = null;
				resolve(null);
			}
		}, 0);
	}

	/**
	 * Loads cover when cover container is visible.
	 * 
	 * @param coverContainer Cover container element
	 * @param file Track file
	 * @param track Track metadata
	 */
	private loadCoverWhenVisible(coverContainer: HTMLElement, file: TFile, track: { title?: string } | undefined): void {
		if (this.coverCache.has(file.path)) {
			const coverUrl = this.coverCache.get(file.path);
			if (coverUrl && coverContainer.parentElement) {
				coverContainer.empty();
				const coverImg = coverContainer.createEl("img");
				coverImg.src = coverUrl;
				coverImg.alt = track?.title || file.basename;
			}
			return;
		}

		const loadPromise = (async () => {
			try {
				if (this.shouldStopLoading) {
					return;
				}

				const coverUrl = await this.getCoverImageUrl(file);

				if (this.shouldStopLoading) {
					return;
				}

				if (coverUrl && coverContainer.parentElement) {
					coverContainer.empty();
					const coverImg = coverContainer.createEl("img");
					coverImg.src = coverUrl;
					coverImg.alt = track?.title || file.basename;
				}
			} catch (err) {
				if (!this.shouldStopLoading) {
					console.error(`Failed to load cover (${file.path}):`, err);
				}
			}
		})();

		this.loadingPromises.add(loadPromise);
		
		loadPromise.finally(() => {
			this.loadingPromises.delete(loadPromise);
		}).catch(() => {
			// Ignore errors
		});
	}

	/**
	 * Sets up Intersection Observer for visible cover containers.
	 */
	private setupIntersectionObserver(): void {
		if (this.observer) {
			this.observer.disconnect();
		}

		this.observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !this.shouldStopLoading) {
						const coverContainer = entry.target as HTMLElement;
						const trackPath = coverContainer.getAttribute("data-track-path");
						if (!trackPath) return;

						if (this.coverCache.has(trackPath)) {
							const coverUrl = this.coverCache.get(trackPath);
							if (coverUrl && coverContainer.parentElement) {
								coverContainer.empty();
								const coverImg = coverContainer.createEl("img");
								coverImg.src = coverUrl;
								const file = this.items.find(f => f.path === trackPath);
								if (file) {
									const trackId = getOrCreateTrackId(file.path, this.plugin.settings);
									const track = this.plugin.settings.tracks[trackId];
									coverImg.alt = track?.title || file.basename;
								}
							}
							this.observer?.unobserve(coverContainer);
							return;
						}

						const file = this.items.find(f => f.path === trackPath);
						if (file) {
							const trackId = getOrCreateTrackId(file.path, this.plugin.settings);
							const track = this.plugin.settings.tracks[trackId];
							this.loadCoverWhenVisible(coverContainer, file, track);
							this.observer?.unobserve(coverContainer);
						}
					}
				});
			},
			{
				rootMargin: '100px',
				threshold: 0.01,
			}
		);

		window.setTimeout(() => {
			if (this.observer && this.modalEl) {
				const coverContainers = this.modalEl.querySelectorAll('[data-track-path]');
				coverContainers.forEach((container) => {
					this.observer?.observe(container);
				});
			}
		}, 0);
	}

	/**
	 * Displays queue modal and awaits user selection.
	 * 
	 * @returns Promise resolving to selected track file, or null if cancelled
	 */
	async prompt(): Promise<TFile | null> {
		this.shouldStopLoading = false;
		this.loadingPromises.clear();
		
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.chosen = false;
			this.open();
			
			window.setTimeout(() => {
				this.setupIntersectionObserver();
				if (!this.resolve) {
					this.resolve = resolve;
				}
			}, 100);
		});
	}
}
