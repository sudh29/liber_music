/**
 * In-App Audio Metadata Editor Modal
 * 
 * Allows users to inspect and edit ID3/Vorbis tags:
 * - Title, Artist, Album
 * - Release Year, Genre, Track Number
 * - Star Rating (0 - 5)
 * - Synchronized or plain lyrics (with companion .lrc sync)
 */

import { App, Modal, normalizePath, Notice, TFile } from "obsidian";
import type MusicPlayerPlugin from "@/main";
import { getOrCreateTrackId } from "@/utils/track/id";
import { parseTrackFilename } from "@/utils/audio/filenameParser";
import { generateArtistsAndAlbums } from "@/utils/data/transform";
import { getCompanionLrcPath } from "@/utils/audio/companionLrc";
import { t } from "@/utils/i18n/i18n";
import type { TrackInfo } from "@/types/settings";
import "./MetadataEditorModal.css";

export interface MetadataEditorModalOptions {
	onSave?: (updatedInfo: TrackInfo) => Promise<void> | void;
}

export class MetadataEditorModal extends Modal {
	private trackId: string;
	private currentInfo: TrackInfo;
	private rating: number = 0;

	// Inputs
	private titleInput!: HTMLInputElement;
	private artistInput!: HTMLInputElement;
	private albumInput!: HTMLInputElement;
	private yearInput!: HTMLInputElement;
	private genreInput!: HTMLInputElement;
	private trackNumInput!: HTMLInputElement;
	private lyricsTextarea!: HTMLTextAreaElement;
	private starElements: HTMLElement[] = [];

	constructor(
		app: App,
		public plugin: MusicPlayerPlugin,
		public trackPath: string,
		private options: MetadataEditorModalOptions = {}
	) {
		super(app);
		this.trackId = getOrCreateTrackId(trackPath, plugin.settings);

		const meta = plugin.settings.tracks[this.trackId];
		const parsed = parseTrackFilename(trackPath);

		this.rating = meta?.rating ?? plugin.settings.ratings?.[this.trackId] ?? 0;

		const genreStr = Array.isArray(meta?.genre) ? meta.genre.join(", ") : meta?.genre || "";

		this.currentInfo = {
			title: meta?.title || parsed.title || "",
			artist: meta?.artist || parsed.artist || "",
			album: meta?.album || parsed.album || "",
			year: meta?.year ?? parsed.year,
			genre: genreStr,
			track: meta?.track,
			lyrics: meta?.lyrics || "",
			rating: this.rating,
			duration: meta?.duration,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass("metadata-editor-modal");

		this.setTitle(t("metadata.editTitle"));

		// Path indicator
		const pathEl = contentEl.createDiv({ cls: "metadata-editor-path" });
		pathEl.setText(this.trackPath);

		// Grid form container
		const formGrid = contentEl.createDiv({ cls: "metadata-form-grid" });

		// Title
		const titleGroup = formGrid.createDiv({ cls: "metadata-form-field" });
		titleGroup.createEl("label", { cls: "metadata-form-label", text: t("metadata.title") });
		this.titleInput = titleGroup.createEl("input", {
			cls: "metadata-form-input",
			type: "text",
			value: this.currentInfo.title,
		});

		// Artist
		const artistGroup = formGrid.createDiv({ cls: "metadata-form-field" });
		artistGroup.createEl("label", { cls: "metadata-form-label", text: t("metadata.artist") });
		this.artistInput = artistGroup.createEl("input", {
			cls: "metadata-form-input",
			type: "text",
			value: this.currentInfo.artist,
		});

		// Album
		const albumGroup = formGrid.createDiv({ cls: "metadata-form-field" });
		albumGroup.createEl("label", { cls: "metadata-form-label", text: t("metadata.album") });
		this.albumInput = albumGroup.createEl("input", {
			cls: "metadata-form-input",
			type: "text",
			value: this.currentInfo.album,
		});

		// Genre
		const genreGroup = formGrid.createDiv({ cls: "metadata-form-field" });
		genreGroup.createEl("label", { cls: "metadata-form-label", text: t("metadata.genre") });
		this.genreInput = genreGroup.createEl("input", {
			cls: "metadata-form-input",
			type: "text",
			value: typeof this.currentInfo.genre === "string" ? this.currentInfo.genre : "",
		});

		// Year
		const yearGroup = formGrid.createDiv({ cls: "metadata-form-field" });
		yearGroup.createEl("label", { cls: "metadata-form-label", text: t("metadata.year") });
		this.yearInput = yearGroup.createEl("input", {
			cls: "metadata-form-input",
			type: "number",
			value: this.currentInfo.year ? String(this.currentInfo.year) : "",
		});

		// Track Number
		const trackGroup = formGrid.createDiv({ cls: "metadata-form-field" });
		trackGroup.createEl("label", { cls: "metadata-form-label", text: t("metadata.trackNumber") });
		this.trackNumInput = trackGroup.createEl("input", {
			cls: "metadata-form-input",
			type: "number",
			value: this.currentInfo.track ? String(this.currentInfo.track) : "",
		});

		// Rating
		const ratingGroup = formGrid.createDiv({ cls: "metadata-form-field full-width" });
		ratingGroup.createEl("label", { cls: "metadata-form-label", text: t("metadata.rating") });
		const starsContainer = ratingGroup.createDiv({ cls: "metadata-star-rating" });
		this.starElements = [];

		for (let i = 1; i <= 5; i++) {
			const star = starsContainer.createEl("span", {
				cls: `metadata-star-btn ${i <= this.rating ? "active" : ""}`,
				text: "★",
			});
			star.addEventListener("click", () => {
				this.rating = this.rating === i ? 0 : i;
				this.updateStarRatingDisplay();
			});
			this.starElements.push(star);
		}

		// Lyrics
		const lyricsGroup = formGrid.createDiv({ cls: "metadata-form-field full-width" });
		lyricsGroup.createEl("label", { cls: "metadata-form-label", text: t("metadata.lyrics") });
		this.lyricsTextarea = lyricsGroup.createEl("textarea", {
			cls: "metadata-lyrics-textarea",
			text: this.currentInfo.lyrics || "",
			value: this.currentInfo.lyrics || "",
		});
		this.lyricsTextarea.value = this.currentInfo.lyrics || "";

		// Buttons
		const btnContainer = contentEl.createDiv({ cls: "metadata-btn-container" });
		const cancelBtn = btnContainer.createEl("button", { text: t("common.cancel") });
		cancelBtn.addEventListener("click", () => this.close());

		const saveBtn = btnContainer.createEl("button", { text: t("common.save"), cls: "mod-cta" });
		saveBtn.addEventListener("click", () => void this.saveMetadata());
	}

	private updateStarRatingDisplay(): void {
		this.starElements.forEach((el, index) => {
			if (index < this.rating) {
				el.addClass("active");
			} else {
				el.removeClass("active");
			}
		});
	}

	private async saveMetadata(): Promise<void> {
		const yearVal = parseInt(this.yearInput.value.trim(), 10);
		const trackNumVal = parseInt(this.trackNumInput.value.trim(), 10);

		const updatedInfo: TrackInfo = {
			...this.currentInfo,
			title: this.titleInput.value.trim() || this.currentInfo.title,
			artist: this.artistInput.value.trim() || this.currentInfo.artist,
			album: this.albumInput.value.trim() || this.currentInfo.album,
			genre: this.genreInput.value.trim(),
			year: isNaN(yearVal) ? undefined : yearVal,
			track: isNaN(trackNumVal) ? undefined : trackNumVal,
			rating: this.rating,
			lyrics: this.lyricsTextarea.value,
		};

		// 1. Update settings
		this.plugin.settings.tracks[this.trackId] = updatedInfo;
		if (!this.plugin.settings.ratings) {
			this.plugin.settings.ratings = {};
		}
		this.plugin.settings.ratings[this.trackId] = this.rating;

		// 2. Recompute artist and album collections
		const { artists, albums } = generateArtistsAndAlbums(this.plugin.settings);
		this.plugin.settings.artists = artists;
		this.plugin.settings.albums = albums;

		// 3. Companion .lrc file synchronization (if lyrics changed)
		const trimmedLyrics = this.lyricsTextarea.value.trim();
		if (trimmedLyrics !== (this.currentInfo.lyrics || "").trim()) {
			try {
				const lrcPath = getCompanionLrcPath(this.trackPath);
				if (lrcPath) {
					const normalizedPath = normalizePath(lrcPath);
					const existing = this.app.vault.getAbstractFileByPath(normalizedPath) || this.app.vault.getAbstractFileByPath(lrcPath);
					if (trimmedLyrics) {
						if (existing instanceof TFile) {
							await this.app.vault.modify(existing, trimmedLyrics);
						} else {
							await this.app.vault.create(normalizedPath, trimmedLyrics);
						}
					} else if (existing instanceof TFile) {
						await this.app.vault.modify(existing, "");
					}
				}
			} catch (err) {
				console.warn("Could not write companion .lrc file:", err);
			}
		}

		// 4. Save settings to disk
		await this.plugin.saveSettings();
		new Notice(t("metadata.saveSuccess"));

		// 5. Notify callback
		if (this.options.onSave) {
			await this.options.onSave(updatedInfo);
		}

		this.close();
	}
}
