/**
 * Music Codeblock Render Child
 * 
 * Embedded in-note markdown audio player component for ```music codeblocks.
 * Inherits from Obsidian's MarkdownRenderChild for automatic lifecycle teardown.
 */

import { MarkdownRenderChild, Notice, setIcon, TFile } from "obsidian";
import type MusicPlayerPlugin from "@/main";
import { parseMusicCodeblock, type MusicCodeblockConfig } from "@/utils/codeblock/parser";
import { resolveVaultAudioFile } from "@/utils/codeblock/resolver";
import { codeblockCoordinator } from "@/utils/codeblock/coordinator";
import { formatTime } from "@/utils/protocol/uri";
import { LyricsParser, type LyricLine } from "@/utils/lyrics/parser";
import { getCompanionLrcFile } from "@/utils/audio/companionLrc";
import { t } from "@/utils/i18n/i18n";
import "./MusicCodeblock.css";

/** DOM helper functions that work in both Obsidian runtime and Happy-DOM/Vitest */
function emptyEl(el: HTMLElement): void {
	if (typeof el.empty === "function") {
		el.empty();
	} else {
		while (el.firstChild) {
			el.removeChild(el.firstChild);
		}
	}
}

function addCls(el: HTMLElement, ...classes: string[]): void {
	if (typeof el.addClass === "function") {
		el.addClass(...classes);
	} else {
		classes.forEach((c) => el.classList.add(c));
	}
}

function removeCls(el: HTMLElement, ...classes: string[]): void {
	if (typeof el.removeClass === "function") {
		el.removeClass(...classes);
	} else {
		classes.forEach((c) => el.classList.remove(c));
	}
}

function createDiv(parent: HTMLElement, options?: { cls?: string; text?: string; attr?: Record<string, string> }): HTMLDivElement {
	let div: HTMLDivElement;
	if (typeof parent.createDiv === "function") {
		div = parent.createDiv({ cls: options?.cls, text: options?.text });
	} else {
		div = document.createElement("div");
		if (options?.cls) div.className = options.cls;
		if (options?.text) div.textContent = options.text;
		parent.appendChild(div);
	}
	if (options?.attr) {
		for (const [k, v] of Object.entries(options.attr)) {
			div.setAttribute(k, v);
		}
	}
	return div;
}

function createSpan(parent: HTMLElement, options?: { cls?: string; text?: string }): HTMLSpanElement {
	if (typeof parent.createSpan === "function") {
		return parent.createSpan(options);
	}
	const span = document.createElement("span");
	if (options?.cls) span.className = options.cls;
	if (options?.text) span.textContent = options.text;
	parent.appendChild(span);
	return span;
}

function createEl<K extends keyof HTMLElementTagNameMap>(
	parent: HTMLElement,
	tag: K,
	options?: { cls?: string; type?: string; text?: string; attr?: Record<string, string> }
): HTMLElementTagNameMap[K] {
	if (typeof parent.createEl === "function") {
		return parent.createEl(tag, options);
	}
	const el = document.createElement(tag);
	if (options?.cls) el.className = options.cls;
	if (options?.type && "type" in el) (el as any).type = options.type;
	if (options?.text) el.textContent = options.text;
	if (options?.attr) {
		for (const [k, v] of Object.entries(options.attr)) {
			el.setAttribute(k, v);
		}
	}
	parent.appendChild(el);
	return el;
}

export class MusicCodeblockRenderChild extends MarkdownRenderChild {
	private audio: HTMLAudioElement | null = null;
	private config: MusicCodeblockConfig;
	private isPlaying: boolean = false;
	private playButtonEl: HTMLElement | null = null;
	private progressBarEl: HTMLInputElement | null = null;
	private timeDisplayEl: HTMLElement | null = null;
	private lyricsContainerEl: HTMLElement | null = null;
	private lyricLines: LyricLine[] = [];
	private activeLyricIndex: number = -1;

	constructor(
		containerEl: HTMLElement,
		private plugin: MusicPlayerPlugin,
		private source: string
	) {
		super(containerEl);
		this.config = parseMusicCodeblock(source);
	}

	async onload(): Promise<void> {
		emptyEl(this.containerEl);
		addCls(this.containerEl, "music-codeblock-wrapper");

		if (!this.config.track) {
			this.renderError("No audio track specified in codeblock. Example: track: \"Music/Song.mp3\"");
			return;
		}

		// Resolve audio file from vault
		const file = resolveVaultAudioFile(
			this.plugin.app,
			this.config.track,
			this.plugin.settings.trackIndex
		);

		if (!file) {
			this.renderError(`Audio file not found: "${this.config.track}". Check file path or rebuild library.`);
			return;
		}

		await this.renderPlayer(file);
	}

	onunload(): void {
		if (this.audio) {
			codeblockCoordinator.unregisterPlaying(this.audio);
			try {
				this.audio.pause();
				this.audio.src = "";
			} catch {}
			this.audio = null;
		}
		emptyEl(this.containerEl);
	}

	/**
	 * Renders the interactive audio player
	 */
	private async renderPlayer(file: TFile): Promise<void> {
		const trackInfo = this.plugin.settings.tracks?.[file.path];
		const title = this.config.title || trackInfo?.title || file.basename;
		const artist = this.config.artist || trackInfo?.artist || t("meta.unknownArtist");

		const audioSrc = this.plugin.app.vault.getResourcePath(file);
		this.audio = document.createElement("audio");
		this.audio.src = audioSrc;
		this.audio.preload = "metadata";

		if (this.config.start > 0) {
			this.audio.currentTime = this.config.start;
		}

		// Container element
		const playerEl = createDiv(this.containerEl, {
			cls: `music-codeblock-container ${this.config.compact ? "is-compact" : "is-card"}`,
		});

		if (this.config.compact) {
			this.renderCompactLayout(playerEl, file, title, artist);
		} else {
			await this.renderCardLayout(playerEl, file, title, artist, trackInfo?.lyrics);
		}

		this.setupAudioListeners();

		if (this.config.autoplay) {
			setTimeout(() => {
				this.togglePlay();
			}, 300);
		}
	}

	/**
	 * Renders compact single-line player layout
	 */
	private renderCompactLayout(
		playerEl: HTMLElement,
		file: TFile,
		title: string,
		artist: string
	): void {
		// Play button
		this.playButtonEl = createDiv(playerEl, {
			cls: "music-codeblock-btn music-codeblock-play-btn",
			attr: { "aria-label": "Play/Pause", role: "button", tabindex: "0" },
		});
		setIcon(this.playButtonEl, "play");
		this.playButtonEl.addEventListener("click", () => this.togglePlay());

		// Track metadata
		const metaEl = createDiv(playerEl, { cls: "music-codeblock-meta" });
		const titleEl = createSpan(metaEl, { cls: "music-codeblock-title", text: title });
		titleEl.title = title;
		createSpan(metaEl, { cls: "music-codeblock-artist", text: ` · ${artist}` });

		// Scrubber range input
		this.progressBarEl = createEl(playerEl, "input", {
			type: "range",
			cls: "music-codeblock-scrubber",
			attr: { min: "0", max: "100", value: "0" },
		});
		this.progressBarEl.addEventListener("input", (e) => this.handleSeek(e));

		// Time indicator
		const endLimit = this.config.end;
		this.timeDisplayEl = createSpan(playerEl, {
			cls: "music-codeblock-time",
			text: `${formatTime(this.config.start)} / ${endLimit ? formatTime(endLimit) : "00:00"}`,
		});

		// External open in sidebar button
		const extBtn = createDiv(playerEl, {
			cls: "music-codeblock-btn music-codeblock-ext-btn",
			attr: { "aria-label": "Open in sidebar player", role: "button", tabindex: "0" },
		});
		setIcon(extBtn, "external-link");
		extBtn.addEventListener("click", () => this.openInSidebar(file));
	}

	/**
	 * Renders full card layout with optional lyrics
	 */
	private async renderCardLayout(
		playerEl: HTMLElement,
		file: TFile,
		title: string,
		artist: string,
		embeddedLyrics?: string
	): Promise<void> {
		// Top header row
		const headerEl = createDiv(playerEl, { cls: "music-codeblock-header" });

		const iconEl = createDiv(headerEl, { cls: "music-codeblock-disc-icon" });
		setIcon(iconEl, "disc");

		const metaEl = createDiv(headerEl, { cls: "music-codeblock-meta" });
		createDiv(metaEl, { cls: "music-codeblock-title", text: title });
		createDiv(metaEl, { cls: "music-codeblock-artist", text: artist });

		const extBtn = createDiv(headerEl, {
			cls: "music-codeblock-btn music-codeblock-ext-btn",
			attr: { "aria-label": "Open in sidebar player", role: "button", tabindex: "0" },
		});
		setIcon(extBtn, "external-link");
		extBtn.addEventListener("click", () => this.openInSidebar(file));

		// Controls row
		const controlsEl = createDiv(playerEl, { cls: "music-codeblock-controls" });

		this.playButtonEl = createDiv(controlsEl, {
			cls: "music-codeblock-btn music-codeblock-play-btn is-prominent",
			attr: { "aria-label": "Play/Pause", role: "button", tabindex: "0" },
		});
		setIcon(this.playButtonEl, "play");
		this.playButtonEl.addEventListener("click", () => this.togglePlay());

		const timelineEl = createDiv(controlsEl, { cls: "music-codeblock-timeline" });
		this.progressBarEl = createEl(timelineEl, "input", {
			type: "range",
			cls: "music-codeblock-scrubber",
			attr: { min: "0", max: "100", value: "0" },
		});
		this.progressBarEl.addEventListener("input", (e) => this.handleSeek(e));

		this.timeDisplayEl = createDiv(timelineEl, {
			cls: "music-codeblock-time-row",
			text: `${formatTime(this.config.start)} / 00:00`,
		});

		// Lyrics section (if showLyrics enabled)
		if (this.config.showLyrics) {
			await this.setupLyrics(playerEl, file, embeddedLyrics);
		}
	}

	/**
	 * Loads and displays lyrics inside codeblock
	 */
	private async setupLyrics(
		playerEl: HTMLElement,
		file: TFile,
		embeddedLyrics?: string
	): Promise<void> {
		let lyricsText = embeddedLyrics;

		// Check for companion .lrc if embedded lyrics are absent
		if (!lyricsText) {
			const companionLrc = getCompanionLrcFile(this.plugin.app, file.path);
			if (companionLrc) {
				try {
					lyricsText = typeof this.plugin.app.vault.cachedRead === "function"
						? await this.plugin.app.vault.cachedRead(companionLrc)
						: await this.plugin.app.vault.read(companionLrc);
				} catch {}
			}
		}

		if (lyricsText) {
			this.lyricLines = LyricsParser.parseLRC(lyricsText);
		}

		if (this.lyricLines.length > 0) {
			this.lyricsContainerEl = createDiv(playerEl, { cls: "music-codeblock-lyrics-container" });
			const listEl = createDiv(this.lyricsContainerEl, { cls: "music-codeblock-lyrics-list" });

			this.lyricLines.forEach((line, index) => {
				const lineEl = createDiv(listEl, {
					cls: "music-codeblock-lyric-line",
					text: line.text,
				});
				lineEl.setAttribute("data-index", String(index));
				lineEl.addEventListener("click", () => {
					if (this.audio && Number.isFinite(line.time)) {
						this.audio.currentTime = line.time;
						if (!this.isPlaying) {
							this.togglePlay();
						}
					}
				});
			});
		}
	}

	/**
	 * Sets up HTMLAudioElement event handlers
	 */
	private setupAudioListeners(): void {
		if (!this.audio) return;

		this.audio.addEventListener("loadedmetadata", () => {
			if (!this.audio) return;
			const duration = this.config.end || this.audio.duration;
			if (this.timeDisplayEl) {
				this.timeDisplayEl.textContent = `${formatTime(this.config.start)} / ${formatTime(duration)}`;
			}
		});

		this.audio.addEventListener("timeupdate", () => {
			if (!this.audio) return;
			const cur = this.audio.currentTime;
			const start = this.config.start;
			const duration = this.config.end || this.audio.duration || 1;

			// Check end bounds
			if (this.config.end && cur >= this.config.end) {
				this.audio.pause();
				this.audio.currentTime = start;
				this.setPlayState(false);
				codeblockCoordinator.unregisterPlaying(this.audio);
				return;
			}

			// Update progress bar
			if (this.progressBarEl) {
				const percent = Math.min(100, Math.max(0, ((cur - start) / (duration - start)) * 100));
				this.progressBarEl.value = String(percent);
			}

			// Update time text
			if (this.timeDisplayEl) {
				this.timeDisplayEl.textContent = `${formatTime(cur)} / ${formatTime(duration)}`;
			}

			// Synchronize lyrics
			if (this.lyricsContainerEl && this.lyricLines.length > 0) {
				this.updateLyricsHighlight(cur);
			}
		});

		this.audio.addEventListener("ended", () => {
			if (!this.audio) return;
			this.audio.currentTime = this.config.start;
			this.setPlayState(false);
			codeblockCoordinator.unregisterPlaying(this.audio);
		});
	}

	/**
	 * Synchronizes active lyric line and scrolls into view
	 */
	private updateLyricsHighlight(currentTime: number): void {
		if (!this.lyricsContainerEl) return;

		let activeIdx = -1;
		for (let i = 0; i < this.lyricLines.length; i++) {
			const line = this.lyricLines[i];
			if (line && currentTime >= line.time) {
				activeIdx = i;
			} else {
				break;
			}
		}

		if (activeIdx !== this.activeLyricIndex) {
			this.activeLyricIndex = activeIdx;
			const allLines = this.lyricsContainerEl.querySelectorAll<HTMLElement>(".music-codeblock-lyric-line");
			allLines.forEach((el, idx) => {
				if (idx === activeIdx) {
					addCls(el, "is-active");
					if (typeof el.scrollIntoView === "function") {
						el.scrollIntoView({ behavior: "smooth", block: "center" });
					}
				} else {
					removeCls(el, "is-active");
				}
			});
		}
	}

	/**
	 * Toggles playback of this codeblock audio
	 */
	private togglePlay(): void {
		if (!this.audio) return;

		if (this.isPlaying) {
			this.audio.pause();
			this.setPlayState(false);
			codeblockCoordinator.unregisterPlaying(this.audio);
		} else {
			codeblockCoordinator.registerPlaying(this.audio, () => this.setPlayState(false));
			this.audio.play().then(() => {
				this.setPlayState(true);
			}).catch((err) => {
				console.warn("Codeblock playback error:", err);
				this.setPlayState(false);
			});
		}
	}

	/**
	 * Updates play button SVG icon and component state
	 */
	private setPlayState(playing: boolean): void {
		this.isPlaying = playing;
		if (this.playButtonEl) {
			setIcon(this.playButtonEl, playing ? "pause" : "play");
			if (playing) {
				addCls(this.playButtonEl, "is-playing");
			} else {
				removeCls(this.playButtonEl, "is-playing");
			}
		}
	}

	/**
	 * Handles slider scrubbing
	 */
	private handleSeek(e: Event): void {
		if (!this.audio) return;
		const input = e.target as HTMLInputElement;
		const percent = parseFloat(input.value) / 100;
		const start = this.config.start;
		const duration = this.config.end || this.audio.duration || 1;

		const targetTime = start + percent * (duration - start);
		this.audio.currentTime = targetTime;
	}

	/**
	 * Opens this track in the main sidebar player
	 */
	private openInSidebar(file: TFile): void {
		const time = this.audio ? this.audio.currentTime : this.config.start;
		void this.plugin.handleProtocolAction({
			track: file.path,
			time: String(Math.floor(time)),
			autoplay: "true",
		});
	}

	/**
	 * Renders error alert box
	 */
	private renderError(message: string): void {
		const errorEl = createDiv(this.containerEl, { cls: "music-codeblock-error" });
		createSpan(errorEl, { cls: "music-codeblock-error-icon", text: "⚠️ " });
		createSpan(errorEl, { text: message });
	}
}
